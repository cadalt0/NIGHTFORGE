import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { WalletManager, WalletContext } from '../wallet/manager.js';
import { ProviderFactory } from '../providers/factory.js';
import { ConfigLoader } from '../config/loader.js';
import { FileSystem } from '../utils/file-system.js';
import { Logger } from '../utils/logger.js';
import { DeploymentInfo, DeployOptions } from '../types/index.js';
import { WebSocket } from 'ws';
import { ensureProjectDeps, getProjectRoot, importProjectModule } from '../utils/midnight-loader.js';
import { withSpinner } from '../utils/cli-spinner.js';
import { WalletStorage } from '../wallet/storage.js';
import { convertDustViaWalletSync, deployViaWalletSync, getWalletSyncBalance, waitForWalletSyncDustBalance } from '../utils/walletsync-client.js';
import { getDeploySyncState } from '../wallet/deploy-sync-state.js';

// Enable WebSocket for GraphQL subscriptions
// @ts-ignore
globalThis.WebSocket = WebSocket;

function formatTokenBalance(balance: bigint, decimals: number): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = balance / divisor;
  const remainder = balance % divisor;
  const fractional = remainder.toString().padStart(decimals, '0');
  return `${whole.toLocaleString()}.${fractional}`;
}

export class Deployer {
  static async deploy(contractName: string, options: DeployOptions): Promise<void> {
    Logger.header('Nightforge - Contract Deployment');

    try {
      // Load config
      const config = await ConfigLoader.load();
      const networkConfig = config.networks[options.network];
      
      if (!networkConfig) {
        throw new Error(`Network "${options.network}" not found in config`);
      }

      const projectRoot = getProjectRoot();

      let proofServerUrl: string;
      if (options.proofServerUrl) {
        try {
          proofServerUrl = new URL(options.proofServerUrl).toString();
        } catch {
          throw new Error(`Invalid remote proof server URL: ${options.proofServerUrl}`);
        }
      } else {
        const proofServerStatusPath = path.join(WalletStorage.getBaseDir(), 'proof-server-status.json');
        if (!FileSystem.exists(proofServerStatusPath)) {
          Logger.error('Proof server status not found');
          Logger.info('Please start the proof server with: npx nightforge proof-server start');
          throw new Error('Proof server is not running');
        }

        let proofServerStatus: { running: boolean; url: string; state?: string };
        try {
          proofServerStatus = FileSystem.readJSON<{ running: boolean; url: string; state?: string }>(proofServerStatusPath);
        } catch (error) {
          Logger.error('Failed to read proof-server-status.json');
          Logger.info('Please start the proof server with: npx nightforge proof-server start');
          throw new Error('Proof server is not running');
        }

        if (!proofServerStatus.running || proofServerStatus.state !== 'ready') {
          Logger.error('Proof server is not running or not ready');
          Logger.info('Please start the proof server with: npx nightforge proof-server start');
          throw new Error('Proof server is not running');
        }

        proofServerUrl = proofServerStatus.url;
      }

      networkConfig.proofServer = proofServerUrl;
      Logger.info(`Using proof server: ${proofServerUrl}`);

      ensureProjectDeps(projectRoot);
      const { setNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');
      const { deployContract } = await importProjectModule(projectRoot, 'midnight-js-contracts');
      const { CompiledContract } = await importProjectModule(projectRoot, 'compact-js');

      setNetworkId(options.network as any);

      // Find contract
      const managedDir = path.join(projectRoot, config.contracts?.outputDir || 'contracts/managed');
      const zkConfigPath = path.join(managedDir, contractName);

      if (!FileSystem.exists(path.join(zkConfigPath, 'contract', 'index.js'))) {
        throw new Error(
          `Contract "${contractName}" not compiled. Run: npx nightforge compile`
        );
      }

      Logger.section('Step 1: Loading Contract');
      const contractPath = path.join(zkConfigPath, 'contract', 'index.js');
      const contractModule = await import(pathToFileURL(contractPath).href);
      
      const compiledContract = CompiledContract.make(contractName, contractModule.Contract).pipe(
        CompiledContract.withVacantWitnesses,
        CompiledContract.withCompiledFileAssets(zkConfigPath)
      );
      Logger.success(`Loaded contract: ${contractName}`);

      // Wallet setup
      Logger.section('Step 2: Wallet Setup');
      const selectedWallet = options.wallet
        ? WalletStorage.loadWallet(options.wallet)
        : WalletStorage.getActiveWallet();

      if (selectedWallet?.name) {
        Logger.info(`Using stored wallet: ${selectedWallet.name}`);
        if (selectedWallet.network && selectedWallet.network !== options.network) {
          Logger.warn(
            `Wallet "${selectedWallet.name}" network is "${selectedWallet.network}" but deploy network is "${options.network}"`
          );
        }
      }

      if (!options.legacy) {
        const syncWalletName = selectedWallet?.name ?? options.wallet;
        if (!syncWalletName) {
          throw new Error('walletsync deploy requires a stored wallet. Set an active wallet or pass --wallet, or use --legacy.');
        }

        const deploySyncState = await getDeploySyncState(syncWalletName);

        if (deploySyncState.kind !== 'ready') {
          if (deploySyncState.kind === 'syncing') {
            throw new Error('Wallet sync is in progress. Please wait 1-2 minutes.');
          }

          if (deploySyncState.kind === 'unmapped') {
            throw new Error('Walletsync wallet mapping missing. Please configure the wallet and run sync before deploy.');
          }

          throw new Error('Walletsync is unavailable. Please run "nightforge sync" first, or use --legacy.');
        }

        Logger.info(`Balance (walletsync ${deploySyncState.alias}): ${formatTokenBalance(deploySyncState.nightBalance, 6)} tNight`);
        Logger.info(`DUST (walletsync ${deploySyncState.alias}): ${formatTokenBalance(deploySyncState.dustBalance, 15)}`);

        if (deploySyncState.nightBalance === 0n) {
          throw new Error('Wallet has no funds. Fund the wallet and retry deploy.');
        }

        if (deploySyncState.dustBalance === 0n) {
          throw new Error('No DUST available. Run "npx nightforge wallet dust" and retry deploy.');
        }

        // Deploy through walletsync synced wallet
        Logger.section('Step 3: Deploying Contract');
        const deployResult = await deployViaWalletSync(
          {
            contractName,
            zkConfigPath,
            proofServerUrl,
            privateStateId: `${contractName}State`,
            initialPrivateState: {},
            args: [],
          },
          syncWalletName,
        );

        if (deployResult.status !== 'ok') {
          if (deployResult.status === 'syncing') {
            throw new Error('Wallet sync is in progress. Please wait 1-2 minutes.');
          }
          if (deployResult.status === 'unmapped') {
            throw new Error('Walletsync wallet mapping missing for deploy.');
          }
          if (deployResult.status === 'error') {
            throw new Error(`Walletsync deploy failed: ${deployResult.message}`);
          }
          throw new Error('Walletsync deploy endpoint unavailable. Please run "nightforge sync" first, or use --legacy.');
        }

        const contractAddress = deployResult.contractAddress;
        Logger.log(`\nContract Address: ${contractAddress}\n`);

        const deploymentInfo: DeploymentInfo = {
          contractAddress,
          network: options.network,
          deployedAt: new Date().toISOString(),
          deployer: selectedWallet?.address ?? 'walletsync',
        };

        FileSystem.writeJSON(path.join(projectRoot, 'deployment.json'), deploymentInfo);
        Logger.success('Saved deployment info to deployment.json');
        Logger.section('Deployment Complete!');
        return;
      }

      let seed = options.privateKey || process.env.MIDNIGHT_PRIVATE_KEY;
      let walletNameForLog: string | undefined;

      if (!seed) {
        const selectedWallet = options.wallet
          ? WalletStorage.loadWallet(options.wallet)
          : WalletStorage.getActiveWallet();

        if (selectedWallet?.seed) {
          seed = selectedWallet.seed;
          walletNameForLog = selectedWallet.name;
          Logger.info(`Using stored wallet: ${selectedWallet.name}`);

          if (selectedWallet.network && selectedWallet.network !== options.network) {
            Logger.warn(
              `Wallet "${selectedWallet.name}" network is "${selectedWallet.network}" but deploy network is "${options.network}"`
            );
          }
        }
      }
      
      if (!seed) {
        throw new Error(
          'No private key provided. Use --private-key, set MIDNIGHT_PRIVATE_KEY, create a wallet with "npx nightforge wallet create", or select one with --wallet.'
        );
      }

      const walletCtx = await withSpinner('Loading wallet...', async () =>
        WalletManager.create(seed, networkConfig)
      );
      if (walletNameForLog) {
        Logger.success(`Wallet: ${walletNameForLog} (${walletCtx.address})`);
      } else {
        Logger.success(`Wallet: ${walletCtx.address}`);
      }

      await withSpinner('Syncing with network...', async () =>
        WalletManager.waitForSync(walletCtx.wallet)
      );

      let balance: bigint | null = null;
      if (!options.legacy) {
        const syncWalletName = walletNameForLog ?? options.wallet;
        if (!syncWalletName) {
          throw new Error('walletsync is required for deploy. Use --wallet or start from a stored wallet, or pass --legacy to use the old flow.');
        }

        const syncBalance = await getWalletSyncBalance(syncWalletName);
        if (!syncBalance) {
          throw new Error('Walletsync balance is unavailable. Please run "nightforge sync" first, or use --legacy.');
        }

        balance = syncBalance.nightBalance;
        Logger.info(`Balance (walletsync ${syncBalance.alias}): ${syncBalance.nightBalance.toLocaleString()} tNight`);
      } else {
        balance = await WalletManager.getBalance(walletCtx.wallet);
        Logger.info(`Balance: ${balance.toLocaleString()} tNight`);
      }

      // Check funds
      if (balance === 0n) {
        Logger.warn('Wallet has no funds!');
        Logger.info(`Visit: https://faucet.preprod.midnight.network/`);
        Logger.info(`Address: ${walletCtx.address}`);
        await withSpinner('Waiting for funds...', async () =>
          WalletManager.waitForFunds(walletCtx.wallet)
        );
      }

      // Ensure DUST
      Logger.section('Step 3: DUST Token Setup');
      const syncWalletName = walletNameForLog ?? options.wallet;
      if (!options.legacy) {
        if (!syncWalletName) {
          throw new Error('walletsync is required for deploy. Use --wallet or start from a stored wallet, or pass --legacy to use the old flow.');
        }

        const deploySyncState = await getDeploySyncState(syncWalletName);

        if (deploySyncState.kind !== 'ready') {
          if (deploySyncState.kind === 'syncing') {
            throw new Error('Wallet sync is in progress. Please wait 1-2 minutes.');
          }

          if (deploySyncState.kind === 'unmapped') {
            throw new Error('Walletsync wallet mapping missing. Please configure the wallet and run sync before deploy.');
          }

          throw new Error('Walletsync is unavailable. Please run "nightforge sync" first, or use --legacy.');
        }

        Logger.info(`Using walletsync (${deploySyncState.alias}) for deploy readiness`);

        if (deploySyncState.dustBalance > 0n) {
          Logger.success(`DUST already available: ${deploySyncState.dustBalance.toLocaleString()}`);
        } else {
          const convertResult = await convertDustViaWalletSync(syncWalletName);

          if (convertResult.status === 'ok' && convertResult.outcome === 'already-has-dust') {
            Logger.success(`DUST already available: ${convertResult.dustBalance.toLocaleString()}`);
          } else {
            const submitMessage =
              convertResult.status === 'ok'
                ? `DUST conversion submitted via walletsync (${convertResult.alias}).`
                : convertResult.status === 'ambiguous'
                  ? `Walletsync returned: ${convertResult.message}`
                  : convertResult.status === 'syncing'
                    ? 'Wallet sync is in progress. Waiting for DUST confirmation...'
                    : convertResult.status === 'error'
                      ? `Walletsync DUST conversion returned: ${convertResult.message}`
                      : 'Walletsync DUST endpoint unavailable right now. Waiting for confirmation...';

            Logger.warn(submitMessage);
            Logger.info('Waiting for DUST confirmation...');

            const confirmation = await waitForWalletSyncDustBalance(syncWalletName, process.cwd(), 120000, 4000);
            if (confirmation.status === 'confirmed') {
              Logger.success(`DUST confirmed: ${confirmation.balance.dustBalance.toLocaleString()}`);
            } else {
              throw new Error(`DUST conversion did not confirm. Last walletsync message: ${submitMessage}`);
            }
          }
        }
      } else {
        await withSpinner('Ensuring DUST tokens...', async () =>
          WalletManager.ensureDust(walletCtx)
        );
      }

      // Deploy
      Logger.section('Step 4: Deploying Contract');
      const providers = await withSpinner('Setting up providers...', async () =>
        ProviderFactory.create(
          walletCtx,
          networkConfig,
          zkConfigPath,
          `${contractName}-state`
        )
      );

      const deployed = await withSpinner('Deploying contract (this may take 30-60s)...', async () =>
        deployContract(providers, {
          compiledContract: compiledContract as any,
          args: [],
          privateStateId: `${contractName}State`,
          initialPrivateState: {},
        })
      );

      const contractAddress = deployed.deployTxData.public.contractAddress;
      Logger.log(`\nContract Address: ${contractAddress}\n`);

      // Save deployment info
      const deploymentInfo: DeploymentInfo = {
        contractAddress,
        network: options.network,
        deployedAt: new Date().toISOString(),
        deployer: walletCtx.address,
      };

      FileSystem.writeJSON(path.join(projectRoot, 'deployment.json'), deploymentInfo);
      Logger.success('Saved deployment info to deployment.json');

      await walletCtx.wallet.stop();
      Logger.section('Deployment Complete!');
    } catch (error) {
      Logger.error('Deployment failed', error as Error);
      process.exit(1);
    }
  }
}

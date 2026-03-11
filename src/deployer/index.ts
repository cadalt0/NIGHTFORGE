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

// Enable WebSocket for GraphQL subscriptions
// @ts-ignore
globalThis.WebSocket = WebSocket;

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

      // Check for local proof server status - REQUIRED for deployment
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

      networkConfig.proofServer = proofServerStatus.url;
      Logger.info(`Using local proof server: ${proofServerStatus.url}`);

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

      const balance = await WalletManager.getBalance(walletCtx.wallet);
      Logger.info(`Balance: ${balance.toLocaleString()} tNight`);

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
      await withSpinner('Ensuring DUST tokens...', async () =>
        WalletManager.ensureDust(walletCtx)
      );

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

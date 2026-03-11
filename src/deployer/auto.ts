import * as path from 'node:path';
import chalk from 'chalk';
import ora from 'ora';
import { WalletManager } from '../wallet/manager.js';
import { ConfigLoader } from '../config/loader.js';
import { FileSystem } from '../utils/file-system.js';
import { Logger } from '../utils/logger.js';
import { Deployer } from './index.js';
import { ensureProjectDeps, getProjectRoot, importProjectModule } from '../utils/midnight-loader.js';
import { generateReadableName, StoredWalletData, WalletStorage } from '../wallet/storage.js';
import * as Rx from 'rxjs';

interface AutoDeployOptions {
  network: string;
  wallet?: string;
}

export class AutoDeployer {
  static async deploy(contractName: string, options: AutoDeployOptions): Promise<void> {
          // Step 5: Check if contract is compiled (same as normal deploy)
    const config = await ConfigLoader.load();
    const projectRoot = getProjectRoot();
    const managedDir = path.join(projectRoot, config.contracts?.outputDir || 'contracts/managed');
    const zkConfigPath = path.join(managedDir, contractName);
    if (!FileSystem.exists(path.join(zkConfigPath, 'contract', 'index.js'))) {
      console.log('\n' + chalk.redBright.bold('✗ Contract not compiled!'));
      console.log(chalk.bgRed.white.bold(`  Contract: ${contractName}  `));
      console.log(chalk.redBright('───────────────────────────────────────────────────────────────'));
      console.log(chalk.yellow('  Run: ') + chalk.cyan.bold('npx nightforge compile') + chalk.yellow(' to build your contract before deploying.'));
      console.log(chalk.redBright('───────────────────────────────────────────────────────────────\n'));
      return;
    }
    console.log('\n' + chalk.bold.cyan('═══════════════════════════════════════════════════════════════'));
    console.log(chalk.bold.cyan('  🚀 Nightforge - Auto Deployment Mode'));
    console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════════'));
    console.log();

    try {
      // Step 1: Ensure wallet exists
      let seed: string;
      let address: string;
      let walletName: string;

      let walletData: StoredWalletData | undefined = options.wallet
        ? WalletStorage.loadWallet(options.wallet)
        : WalletStorage.getActiveWallet();

      if (!walletData) {
        walletData = await this.createWallet(options.network);
      }

      seed = walletData.seed;
      address = walletData.address;
      walletName = walletData.name;

      WalletStorage.setActiveWallet(walletName);

      console.log(chalk.green('✓') + ' Wallet loaded: ' + chalk.cyan(`${walletName} (${address})`));
      console.log();

      // Step 2: Combined balance check (tNight and DUST)
      await this.checkBalances(seed, options.network);

      // Step 2: Wait for tNight funds
      await this.waitForFunds(seed, address, options.network);

      // Step 3: Convert to DUST
      await this.convertToDust(seed, options.network);

      // Step 4: Wait for proof server
      await this.waitForProofServer(projectRoot);

      // Step 5: Deploy contract
      console.log();
      console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════════'));
      console.log(chalk.bold.cyan('  📦 Starting Contract Deployment'));
      console.log(chalk.bold.cyan('═══════════════════════════════════════════════════════════════'));
      console.log();

      await Deployer.deploy(contractName, {
        network: options.network,
        privateKey: seed,
      });

    } catch (error: any) {
      Logger.error(error.message);
      process.exit(1);
    }
  }

  // Combined balance check for tNight and DUST
  private static async checkBalances(seed: string, network: string): Promise<void> {
    const config = await ConfigLoader.load();
    const networkConfig = config.networks[network];
    const projectRoot = getProjectRoot();
    ensureProjectDeps(projectRoot);
    const { setNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');
    setNetworkId(network as any);

    const walletCtx = await WalletManager.create(seed, networkConfig);
    await WalletManager.waitForSync(walletCtx.wallet);

    const balance = await WalletManager.getBalance(walletCtx.wallet);
    const dustBalance = await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.filter((s: any) => s.isSynced),
        Rx.map((s: any) => s.dust.walletBalance(new Date()))
      )
    );

    // Formatting copied from wallet command
    function formatBalance(balance: bigint, decimals: number = 6): string {
      const divisor = 10n ** BigInt(decimals);
      const whole = balance / divisor;
      const remainder = balance % divisor;
      const fractional = remainder.toString().padStart(decimals, '0');
      return `${whole.toLocaleString()}.${fractional}`;
    }
    function formatDustBalance(balance: bigint): string {
      return formatBalance(balance, 15);
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`  Balance: ${formatBalance(balance)} tNight`);
    console.log(`  DUST:    ${formatDustBalance(dustBalance as bigint)}`);
    console.log('═'.repeat(80) + '\n');

    // Use shutdown method if available, else skip
    if (typeof walletCtx.wallet.shutdown === 'function') {
      await walletCtx.wallet.shutdown();
    }
    // If not available, do nothing (matches normal deploy usage)
  }

  private static async createWallet(network: string): Promise<StoredWalletData> {
    console.log(chalk.yellow('⚠') + '  No wallet found. Creating new wallet...');
    console.log();

    const projectRoot = getProjectRoot();
    ensureProjectDeps(projectRoot);
    const { setNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');
    setNetworkId(network as any);

    const seed = await WalletManager.generateSeed();
    const config = await ConfigLoader.load();
    const networkConfig = config.networks[network];

    if (!networkConfig) {
      throw new Error(`Network "${network}" not found in config`);
    }

    const walletCtx = await WalletManager.create(seed, networkConfig);
    const address = walletCtx.address;
    const generatedName = await generateReadableName();
    const walletName = WalletStorage.buildWalletName(generatedName, address);

    const walletPath = WalletStorage.saveWallet({
      name: walletName,
      seed,
      address,
      network,
    });
    WalletStorage.setActiveWallet(walletName);

    console.log(chalk.green('✓') + ' Wallet created successfully!');
    console.log();
    console.log(chalk.bold('  Name:    ') + chalk.cyan(walletName));
    console.log(chalk.bold('  Address: ') + chalk.cyan(address));
    console.log(chalk.bold('  Network: ') + chalk.cyan(network));
    console.log(chalk.bold('  Saved:   ') + chalk.cyan(walletPath));
    console.log();

    if (typeof walletCtx.wallet.shutdown === 'function') {
      await walletCtx.wallet.shutdown();
    }
    return WalletStorage.loadWallet(walletName);
  }

  private static async waitForFunds(seed: string, address: string, network: string): Promise<void> {
    console.log(chalk.bold.yellow('💰 Waiting for tNight funds...'));
    console.log();
    console.log(chalk.dim('  Your wallet needs tNight tokens to proceed with deployment.'));
    console.log();
    console.log(chalk.bold('  📍 Wallet Address:'));
    console.log('  ' + chalk.cyan(address));
    console.log();
    console.log(chalk.bold('  🚰 Get test tokens from the faucet:'));
    console.log('  ' + chalk.blue.underline('https://faucet.midnight.network'));
    console.log();
    console.log(chalk.dim('  Checking balance every 10 seconds...'));
    console.log();

    const config = await ConfigLoader.load();
    const networkConfig = config.networks[network];
    const projectRoot = getProjectRoot();
    ensureProjectDeps(projectRoot);
    const { setNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');
    setNetworkId(network as any);

    let walletCtx: any;
    const spinner = ora({
      text: 'Waiting for funds...',
      spinner: 'dots',
      color: 'cyan',
    }).start();

    try {
      walletCtx = await WalletManager.create(seed, networkConfig);

      // Poll for balance
      let balance = 0n;
      while (balance === 0n) {
        try {
          balance = await WalletManager.getBalance(walletCtx.wallet);
          
          if (balance > 0n) {
            spinner.succeed(chalk.green('Funds detected! Balance: ') + chalk.cyan(this.formatBalance(balance, 6) + ' tNight'));
            console.log();
            break;
          }
        } catch (error) {
          // Continue polling on error
        }

        await this.sleep(10000); // Check every 10 seconds
      }

    } finally {
      if (walletCtx && typeof walletCtx.wallet.shutdown === 'function') {
        await walletCtx.wallet.shutdown();
      }
    }
  }

  private static async convertToDust(seed: string, network: string): Promise<void> {
    console.log(chalk.bold.yellow('🔄 Converting tNight to DUST...'));
    console.log();
    console.log(chalk.dim('  DUST tokens are required for contract deployment.'));
    console.log();

    const config = await ConfigLoader.load();
    const networkConfig = config.networks[network];
    const projectRoot = getProjectRoot();
    ensureProjectDeps(projectRoot);
    const { setNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');
    setNetworkId(network as any);

    let walletCtx: any;
    const spinner = ora({
      text: 'Registering for DUST generation...',
      spinner: 'dots',
      color: 'cyan',
    }).start();

    try {
      walletCtx = await WalletManager.create(seed, networkConfig);

      // Register for DUST
      spinner.text = 'Registering tNight for DUST generation...';
      await WalletManager.ensureDust(walletCtx);

      spinner.succeed(chalk.green('DUST tokens ready!'));
      console.log();

    } finally {
      if (walletCtx && typeof walletCtx.wallet.shutdown === 'function') {
        await walletCtx.wallet.shutdown();
      }
    }
  }

  private static async waitForProofServer(projectRoot: string): Promise<void> {
    console.log(chalk.bold.yellow('🔧 Waiting for proof server...'));
    console.log();
    console.log(chalk.dim('  A local proof server is required for deployment.'));
    console.log();
    console.log(chalk.bold('  Start the proof server with:'));
    console.log('  ' + chalk.cyan('npx nightforge proof-server start'));
    console.log();

    const proofServerStatusPath = path.join(projectRoot, 'proof-server-status.json');
    const spinner = ora({
      text: 'Checking for proof server...',
      spinner: 'dots',
      color: 'cyan',
    }).start();

    let attempts = 0;
    while (true) {
      attempts++;

      if (FileSystem.exists(proofServerStatusPath)) {
        try {
          const status = FileSystem.readJSON<{ running: boolean; state?: string; url?: string }>(proofServerStatusPath);
          
          if (status.running && status.state === 'ready' && status.url) {
            spinner.succeed(chalk.green('Proof server ready! ') + chalk.cyan(status.url));
            console.log();
            return;
          }

          if (status.running && status.state !== 'ready') {
            spinner.text = `Proof server starting (state: ${status.state})...`;
          }
        } catch (error) {
          // Continue checking
        }
      } else {
        if (attempts === 1) {
          spinner.text = 'Waiting for proof-server-status.json...';
        }
      }

      await this.sleep(3000); // Check every 3 seconds
    }
  }

  private static formatBalance(balance: bigint, decimals: number): string {
    const divisor = 10n ** BigInt(decimals);
    const whole = balance / divisor;
    const remainder = balance % divisor;
    const fractional = remainder.toString().padStart(decimals, '0');
    return `${whole.toLocaleString()}.${fractional}`;
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

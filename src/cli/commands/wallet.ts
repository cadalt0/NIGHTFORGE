import { Command } from 'commander';
import inquirer from 'inquirer';
import * as fs from 'node:fs';
import { WalletManager } from '../../wallet/manager.js';
import { ConfigLoader } from '../../config/loader.js';
import { FileSystem } from '../../utils/file-system.js';
import { Logger } from '../../utils/logger.js';
import * as path from 'node:path';
import { ensureProjectDeps, getProjectRoot, importProjectModule } from '../../utils/midnight-loader.js';
import * as Rx from 'rxjs';

function formatBalance(balance: bigint, decimals: number = 6): string {
  const divisor = 10n ** BigInt(decimals);
  const whole = balance / divisor;
  const remainder = balance % divisor;
  const fractional = remainder.toString().padStart(decimals, '0');
  return `${whole.toLocaleString()}.${fractional}`;
}

function formatDustBalance(balance: bigint): string {
  // DUST is represented in SPECK where 1 DUST = 10^15 SPECK
  return formatBalance(balance, 15);
}

const walletCmd = new Command('wallet')
  .description('Manage Midnight wallets');

function getDefaultWalletPath(customPath?: string): string {
  return path.resolve(customPath || './wallet.json');
}

function saveWalletFile(data: {
  address: string;
  seed: string;
  network: string;
}, customPath?: string): string {
  const walletPath = getDefaultWalletPath(customPath);
  FileSystem.writeJSON(walletPath, {
    ...data,
    updatedAt: new Date().toISOString(),
  });
  return walletPath;
}

async function createWallet(options: { network: string; export?: string }) {
  const projectRoot = getProjectRoot();
  ensureProjectDeps(projectRoot);
  const { setNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');

  const config = await ConfigLoader.load();
  const networkConfig = config.networks[options.network];

  if (!networkConfig) {
    throw new Error(`Network "${options.network}" not found`);
  }

  setNetworkId(options.network as any);

  const seed = await WalletManager.generateSeed();
  const walletCtx = await WalletManager.create(seed, networkConfig);

  Logger.success('Wallet created successfully!\n');
  
  Logger.log('═'.repeat(80));
  Logger.log(`  Address: ${walletCtx.address}`);
  Logger.log(`  Network: ${options.network}`);
  Logger.log('═'.repeat(80));
  
  Logger.warn('\n⚠️  SAVE THIS SEED (keep it secret!):\n');
  Logger.log('┌' + '─'.repeat(78) + '┐');
  Logger.log(`│  ${seed}  │`);
  Logger.log('└' + '─'.repeat(78) + '┘\n');

  const savedPath = saveWalletFile(
    { address: walletCtx.address, seed, network: options.network },
    options.export
  );
  Logger.success(`✓ Wallet saved to: ${savedPath}\n`);
  
  Logger.log('💰 Fund your wallet:');
  Logger.log('   → https://faucet.preprod.midnight.network/\n');

  await walletCtx.wallet.stop();
}

async function restoreWallet(options: { network: string }) {
  const projectRoot = getProjectRoot();
  ensureProjectDeps(projectRoot);
  const { setNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');

  const { seed } = await inquirer.prompt([
    {
      type: 'input',
      name: 'seed',
      message: 'Enter your wallet seed (64 characters):',
      validate: (input: string) => {
        if (input.length !== 64) {
          return 'Seed must be 64 characters';
        }
        if (!/^[0-9a-fA-F]+$/.test(input)) {
          return 'Seed must be hexadecimal';
        }
        return true;
      },
    },
  ]);

  const config = await ConfigLoader.load();
  const networkConfig = config.networks[options.network];

  if (!networkConfig) {
    throw new Error(`Network "${options.network}" not found`);
  }

  setNetworkId(options.network as any);

  Logger.info('Restoring wallet...');
  const walletCtx = await WalletManager.create(seed, networkConfig);

  Logger.success('Wallet restored successfully!\n');
  
  Logger.log('═'.repeat(80));
  Logger.log(`  Address: ${walletCtx.address}`);
  Logger.log(`  Network: ${options.network}`);
  Logger.log('═'.repeat(80) + '\n');

  const savedPath = saveWalletFile(
    { address: walletCtx.address, seed, network: options.network }
  );
  Logger.success(`✓ Wallet saved to: ${savedPath}\n`);
  
  Logger.log('💰 Fund your wallet:');
  Logger.log('   → https://faucet.preprod.midnight.network/\n');

  await walletCtx.wallet.stop();
}

async function showBalance(options: { network: string }) {
  const projectRoot = getProjectRoot();
  ensureProjectDeps(projectRoot);
  const { setNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');

  const { seed } = await inquirer.prompt([
    {
      type: 'input',
      name: 'seed',
      message: 'Enter your wallet seed:',
    },
  ]);

  const config = await ConfigLoader.load();
  const networkConfig = config.networks[options.network];

  if (!networkConfig) {
    throw new Error(`Network "${options.network}" not found`);
  }

  setNetworkId(options.network as any);

  Logger.info('Loading wallet...');
  const walletCtx = await WalletManager.create(seed, networkConfig);

  Logger.info('Syncing with network...');
  await WalletManager.waitForSync(walletCtx.wallet);

  const balance = await WalletManager.getBalance(walletCtx.wallet);

  Logger.log(`\nAddress: ${walletCtx.address}`);
  Logger.log(`Network: ${options.network}`);
  Logger.log(`Balance: ${formatBalance(balance)} tNight\n`);

  await walletCtx.wallet.stop();
}

async function removeWallet(options: { path?: string }) {
  const walletPath = getDefaultWalletPath(options.path);

  if (!FileSystem.exists(walletPath)) {
    Logger.warn(`Wallet file not found: ${walletPath}`);
    return;
  }

  fs.unlinkSync(walletPath);
  Logger.success(`Removed wallet file: ${walletPath}`);
}

async function registerForDustIfNeeded(walletCtx: any, askConfirmation: boolean): Promise<void> {
  const dustState: any = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced))
  );

  if (dustState.dust.walletBalance(new Date()) > 0n) {
    Logger.success('DUST tokens already available!\n');
    return;
  }

  const nightUtxos = dustState.unshielded.availableCoins.filter(
    (c: any) => !c.meta?.registeredForDustGeneration
  );

  if (nightUtxos.length === 0) {
    Logger.warn('No eligible tNight UTXOs found for DUST registration.\n');
    return;
  }

  if (askConfirmation) {
    Logger.log('💡 DUST tokens not found. You need to register your tNight for DUST generation.\n');

    const { confirm } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'confirm',
        message: 'Press Enter to register for DUST generation',
        default: true,
      },
    ]);

    if (!confirm) {
      Logger.warn('DUST registration cancelled.\n');
      return;
    }
  } else {
    Logger.info('DUST not found. Registering automatically...');
  }

  Logger.info('Registering for DUST generation...');
  const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
    nightUtxos,
    walletCtx.unshieldedKeystore.getPublicKey(),
    (payload: any) => walletCtx.unshieldedKeystore.signData(payload),
  );
  await walletCtx.wallet.submitTransaction(
    await walletCtx.wallet.finalizeRecipe(recipe)
  );

  Logger.info('Waiting for DUST tokens...');
  await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.throttleTime(5000),
      Rx.filter((s: any) => s.isSynced),
      Rx.filter((s: any) => s.dust.walletBalance(new Date()) > 0n)
    ),
  );

  Logger.success('DUST tokens ready!\n');
}

async function showBalanceFromFile(walletPath: string, network: string) {
  const projectRoot = getProjectRoot();
  ensureProjectDeps(projectRoot);
  const { setNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');

  if (!FileSystem.exists(walletPath)) {
    Logger.error(`Wallet file not found: ${walletPath}`);
    return;
  }

  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const config = await ConfigLoader.load();
  const networkConfig = config.networks[network];

  if (!networkConfig) {
    throw new Error(`Network "${network}" not found`);
  }

  setNetworkId(network as any);

  Logger.info('Loading wallet...');
  const walletCtx = await WalletManager.create(walletData.seed, networkConfig);

  Logger.info('Syncing with network...');
  await WalletManager.waitForSync(walletCtx.wallet);

  const balance = await WalletManager.getBalance(walletCtx.wallet);
  const dustBalance = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.filter((s: any) => s.isSynced),
      Rx.map((s: any) => s.dust.walletBalance(new Date()))
    )
  ) as bigint;

  Logger.log('\n═'.repeat(80));
  Logger.log(`  Address: ${walletCtx.address}`);
  Logger.log(`  Network: ${network}`);
  Logger.log(`  Balance: ${formatBalance(balance)} tNight`);
  Logger.log(`  DUST:    ${formatDustBalance(dustBalance)}`);
  Logger.log('═'.repeat(80) + '\n');

  if (balance > 0n && dustBalance === 0n) {
    await registerForDustIfNeeded(walletCtx, true);

    const updatedDust = await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(
        Rx.filter((s: any) => s.isSynced),
        Rx.map((s: any) => s.dust.walletBalance(new Date()))
      )
    ) as bigint;

    Logger.log('═'.repeat(80));
    Logger.log(`  Updated DUST: ${formatBalance(updatedDust)}`);
    Logger.log('═'.repeat(80) + '\n');
  }

  await walletCtx.wallet.stop();
}

async function convertToDust(walletPath: string, network: string) {
  const projectRoot = getProjectRoot();
  ensureProjectDeps(projectRoot);
  const { setNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');

  if (!FileSystem.exists(walletPath)) {
    Logger.error(`Wallet file not found: ${walletPath}`);
    return;
  }

  const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf-8'));
  const config = await ConfigLoader.load();
  const networkConfig = config.networks[network];

  if (!networkConfig) {
    throw new Error(`Network "${network}" not found`);
  }

  setNetworkId(network as any);

  Logger.info('Loading wallet...');
  const walletCtx = await WalletManager.create(walletData.seed, networkConfig);

  Logger.info('Checking balance...');

  await WalletManager.waitForSync(walletCtx.wallet);
  const balance = await WalletManager.getBalance(walletCtx.wallet);

  if (balance <= 0n) {
    Logger.warn('\n⚠️  No balance found. Please fund your wallet first!');
    Logger.log('💰 Fund your wallet:');
    Logger.log('   → https://faucet.preprod.midnight.network/\n');
    await walletCtx.wallet.stop();
    return;
  }

  Logger.success(`Balance found: ${formatBalance(balance)} tNight\n`);

  Logger.log('─── DUST Token Setup ───────────────────────────────────────────\n');
  await registerForDustIfNeeded(walletCtx, false);

  const finalBalance = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.filter((s: any) => s.isSynced),
      Rx.map((s: any) => s.dust.walletBalance(new Date()))
    )
  ) as bigint;

  Logger.log('═'.repeat(80));
  Logger.log(`  DUST Balance: ${formatDustBalance(finalBalance)}`);
  Logger.log('═'.repeat(80) + '\n');

  await walletCtx.wallet.stop();
}

walletCmd.action(async () => {
  Logger.header('Wallet Manager');

  try {
    const walletPath = getDefaultWalletPath();
    const walletExists = FileSystem.exists(walletPath);

    const choices: any[] = [
      { name: 'Create wallet', value: 'create' },
      { name: 'Restore wallet', value: 'restore' },
    ];

    if (walletExists) {
      choices.push(
        { name: 'Check balance', value: 'balance' },
        { name: 'Convert to DUST', value: 'dust' },
        { name: 'Remove wallet file', value: 'remove' }
      );
    }

    const { action, network } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select wallet action:',
        choices,
      },
      {
        type: 'list',
        name: 'network',
        message: 'Select network:',
        choices: ['preprod'],
        default: 'preprod',
      },
    ]);

    if (action === 'create') {
      await createWallet({ network });
    } else if (action === 'restore') {
      await restoreWallet({ network });
    } else if (action === 'balance') {
      await showBalanceFromFile(walletPath, network);
    } else if (action === 'dust') {
      await convertToDust(walletPath, network);
    } else {
      await removeWallet({});
    }
  } catch (error) {
    Logger.error('Wallet operation failed', error as Error);
    process.exit(1);
  }
});

// Create wallet
walletCmd
  .command('create')
  .description('Create a new wallet')
  .option('-n, --network <network>', 'Network to create wallet for', 'preprod')
  .option('-e, --export <path>', 'Export wallet to file')
  .action(async (options) => {
    Logger.header('Create New Wallet');

    try {
      await createWallet({ network: options.network, export: options.export });
    } catch (error) {
      Logger.error('Failed to create wallet', error as Error);
      process.exit(1);
    }
  });

// Restore wallet
walletCmd
  .command('restore')
  .description('Restore wallet from seed')
  .option('-n, --network <network>', 'Network', 'preprod')
  .action(async (options) => {
    Logger.header('Restore Wallet');

    try {
      await restoreWallet({ network: options.network });
    } catch (error) {
      Logger.error('Failed to restore wallet', error as Error);
      process.exit(1);
    }
  });

// Check balance
walletCmd
  .command('balance')
  .description('Check wallet balance')
  .option('-n, --network <network>', 'Network', 'preprod')
  .option('-p, --path <path>', 'Wallet file path', './wallet.json')
  .action(async (options) => {
    Logger.header('Wallet Balance');

    try {
      await showBalanceFromFile(options.path, options.network);
    } catch (error) {
      Logger.error('Failed to check balance', error as Error);
      process.exit(1);
    }
  });

walletCmd
  .command('remove')
  .description('Remove local wallet file')
  .option('-p, --path <path>', 'Wallet file path', './wallet.json')
  .action(async (options) => {
    Logger.header('Remove Wallet File');

    try {
      await removeWallet({ path: options.path });
    } catch (error) {
      Logger.error('Failed to remove wallet file', error as Error);
      process.exit(1);
    }
  });

walletCmd
  .command('dust')
  .description('Convert balance to DUST tokens')
  .option('-n, --network <network>', 'Network', 'preprod')
  .option('-p, --path <path>', 'Wallet file path', './wallet.json')
  .action(async (options) => {
    Logger.header('Convert to DUST');

    try {
      await convertToDust(options.path, options.network);
    } catch (error) {
      Logger.error('Failed to convert to DUST', error as Error);
      process.exit(1);
    }
  });

export const walletCommand = walletCmd;

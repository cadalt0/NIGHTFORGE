import { Command } from 'commander';
import inquirer from 'inquirer';
import { WalletManager } from '../../wallet/manager.js';
import { ConfigLoader } from '../../config/loader.js';
import { Logger } from '../../utils/logger.js';
import { ensureProjectDeps, getProjectRoot, importProjectModule } from '../../utils/midnight-loader.js';
import * as Rx from 'rxjs';
import { generateReadableName, WalletStorage } from '../../wallet/storage.js';
import { getDustSyncState } from '../../wallet/dust-sync-state.js';
import { withSpinner } from '../../utils/cli-spinner.js';
import { convertDustViaWalletSync, getWalletSyncBalance, probeWalletSyncBalance, waitForWalletSyncDustBalance } from '../../utils/walletsync-client.js';

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

async function buildUniqueWalletName(address: string, requestedName?: string): Promise<string> {
  if (requestedName) {
    const forcedName = WalletStorage.buildWalletName(requestedName, address);
    if (WalletStorage.walletExists(forcedName)) {
      throw new Error(`Wallet "${forcedName}" already exists. Wallet names are never overwritten.`);
    }
    return forcedName;
  }

  for (let i = 0; i < 50; i++) {
    const baseName = await generateReadableName();
    const candidate = WalletStorage.buildWalletName(baseName, address);
    if (!WalletStorage.walletExists(candidate)) {
      return candidate;
    }
  }

  throw new Error('Unable to generate a unique wallet name. Please pass --name.');
}

function saveWalletFile(data: {
  name: string;
  address: string;
  seed: string;
  network: string;
}): string {
  const walletPath = WalletStorage.saveWallet(data);
  WalletStorage.setActiveWallet(data.name);
  return walletPath;
}

function resolveWalletNameOrActive(walletName?: string): string {
  if (walletName) {
    return WalletStorage.sanitizeName(walletName);
  }

  const active = WalletStorage.getActiveWalletName();
  if (!active) {
    throw new Error('No active wallet found. Create one with "npx nightforge wallet create" or pass --name.');
  }
  return active;
}

function getWalletData(walletName?: string) {
  const targetName = resolveWalletNameOrActive(walletName);
  return WalletStorage.loadWallet(targetName);
}

async function createWallet(options: { network: string; name?: string }) {
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
  const walletName = await buildUniqueWalletName(walletCtx.address, options.name);

  Logger.success('Wallet created successfully!\n');
  
  Logger.log('═'.repeat(80));
  Logger.log(`  Name:    ${walletName}`);
  Logger.log(`  Address: ${walletCtx.address}`);
  Logger.log(`  Network: ${options.network}`);
  Logger.log('═'.repeat(80));
  
  Logger.warn('\n⚠️  SAVE THIS SEED (keep it secret!):\n');
  Logger.log('┌' + '─'.repeat(78) + '┐');
  Logger.log(`│  ${seed}  │`);
  Logger.log('└' + '─'.repeat(78) + '┘\n');

  const savedPath = saveWalletFile(
    { name: walletName, address: walletCtx.address, seed, network: options.network }
  );
  Logger.success(`✓ Active wallet: ${walletName}`);
  Logger.success(`✓ Wallet saved to: ${savedPath}\n`);
  
  Logger.log('💰 Fund your wallet:');
  Logger.log('   → https://faucet.preprod.midnight.network/\n');

  // Cleanup wallet in background and exit immediately (don't wait for connections to close)
  walletCtx.wallet.stop().catch(() => {});
  process.exit(0);
}

async function restoreWallet(options: { network: string; name?: string }) {
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
  const walletName = await buildUniqueWalletName(walletCtx.address, options.name);

  Logger.success('Wallet restored successfully!\n');
  
  Logger.log('═'.repeat(80));
  Logger.log(`  Name:    ${walletName}`);
  Logger.log(`  Address: ${walletCtx.address}`);
  Logger.log(`  Network: ${options.network}`);
  Logger.log('═'.repeat(80) + '\n');

  const savedPath = saveWalletFile(
    { name: walletName, address: walletCtx.address, seed, network: options.network }
  );
  Logger.success(`✓ Active wallet: ${walletName}`);
  Logger.success(`✓ Wallet saved to: ${savedPath}\n`);
  
  Logger.log('💰 Fund your wallet:');
  Logger.log('   → https://faucet.preprod.midnight.network/\n');

  // Cleanup wallet in background and exit immediately (don't wait for connections to close)
  walletCtx.wallet.stop().catch(() => {});
  process.exit(0);
}

async function removeWallet(options: { name?: string }) {
  const walletName = resolveWalletNameOrActive(options.name);
  const removedPath = WalletStorage.removeWallet(walletName);
  Logger.success(`Removed wallet: ${walletName}`);
  Logger.info(`Removed file: ${removedPath}`);

  const remaining = WalletStorage.listWalletNames();
  if (remaining.length === 0) {
    Logger.warn('No wallets remaining.');
    return;
  }

  if (!WalletStorage.getActiveWalletName()) {
    WalletStorage.setActiveWallet(remaining[0]);
    Logger.info(`Active wallet switched to: ${remaining[0]}`);
  }
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

async function showBalanceFromStorage(walletName: string | undefined, network: string, legacy: boolean = false) {
  const walletData = getWalletData(walletName);

  if (!legacy) {
    const syncResult = await probeWalletSyncBalance(walletData.name);
    if (syncResult.status === 'ok') {
      const syncBalance = syncResult.balance;
      Logger.info(`Using walletsync (${syncBalance.alias})`);
      Logger.log('\n' + '═'.repeat(80));
      Logger.log(`  Name:    ${walletData.name}`);
      Logger.log(`  Address: ${syncBalance.unshieldedAddress ?? walletData.address}`);
      Logger.log(`  Network: ${network}`);
      Logger.log(`  Balance: ${formatBalance(syncBalance.nightBalance)} tNight`);
      Logger.log(`  DUST:    ${formatDustBalance(syncBalance.dustBalance)}`);
      Logger.log('═'.repeat(80) + '\n');

      if (syncBalance.nightBalance > 0n && syncBalance.dustBalance === 0n) {
        Logger.warn('DUST not found in walletsync snapshot.');
        Logger.info('Run "npx nightforge wallet dust --legacy" to register DUST from this wallet.');
      }
      return;
    }

    if (syncResult.status === 'syncing') {
      throw new Error('Wallet sync is in progress. Please wait 1-2 minutes.');
    }

    throw new Error(
      'Walletsync is required for "wallet balance". Please run "nightforge sync" first, or use --legacy.'
    );
  }

  const projectRoot = getProjectRoot();
  ensureProjectDeps(projectRoot);
  const { setNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');

  const config = await ConfigLoader.load();
  const networkConfig = config.networks[network];

  if (!networkConfig) {
    throw new Error(`Network "${network}" not found`);
  }

  setNetworkId(network as any);

  const walletCtx = await withSpinner('Loading wallet...', async () =>
    WalletManager.create(walletData.seed, networkConfig)
  );

  await withSpinner('Syncing with network...', async () =>
    WalletManager.waitForSync(walletCtx.wallet)
  );

  const balance = await WalletManager.getBalance(walletCtx.wallet);
  const dustBalance = await Rx.firstValueFrom(
    walletCtx.wallet.state().pipe(
      Rx.filter((s: any) => s.isSynced),
      Rx.map((s: any) => s.dust.walletBalance(new Date()))
    )
  ) as bigint;

  Logger.log('\n' + '═'.repeat(80));
  Logger.log(`  Name:    ${walletData.name}`);
  Logger.log(`  Address: ${walletCtx.address}`);
  Logger.log(`  Network: ${network}`);
  Logger.log(`  Balance: ${formatBalance(balance)} tNight`);
  Logger.log(`  DUST:    ${formatDustBalance(dustBalance)}`);
  Logger.log('═'.repeat(80) + '\n');

  if (balance > 0n && dustBalance === 0n) {
    await withSpinner('Registering for DUST (if needed)...', async () =>
      registerForDustIfNeeded(walletCtx, true)
    );

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

async function convertToDust(walletName: string | undefined, network: string, legacy: boolean = false) {
  const walletData = getWalletData(walletName);

  if (!legacy) {
    const syncState = await getDustSyncState(walletData.name);

    if (syncState.kind === 'ready') {
      Logger.info(`Using walletsync (${syncState.alias}) for DUST pre-check`);

      if (syncState.nightBalance <= 0n) {
        Logger.warn('\n⚠️  No balance found. Please fund your wallet first!');
        Logger.log('💰 Fund your wallet:');
        Logger.log('   → https://faucet.preprod.midnight.network/\n');
        return;
      }

      if (syncState.dustBalance > 0n) {
        Logger.success(`DUST already available: ${formatDustBalance(syncState.dustBalance)}\n`);
        return;
      }

      Logger.info('DUST not found in walletsync snapshot. Requesting DUST conversion via walletsync...');
      const convertResult = await convertDustViaWalletSync(walletData.name);

      let submitMessage = 'DUST conversion request sent via walletsync.';

      if (convertResult.status === 'ok') {
        if (convertResult.outcome === 'already-has-dust') {
          Logger.success(`DUST already available: ${formatDustBalance(convertResult.dustBalance)}\n`);
          return;
        }

        if (convertResult.outcome === 'no-eligible-utxos') {
          Logger.warn('No eligible tNight UTXOs found for DUST registration.');
          Logger.log('Fund or refresh wallet state, then retry.\n');
          return;
        }

        submitMessage = `DUST conversion submitted via walletsync (${convertResult.alias}).`;
      }

      if (convertResult.status === 'ambiguous') {
        submitMessage = `Walletsync returned: ${convertResult.message}`;
      }

      if (convertResult.status === 'syncing') {
        submitMessage = 'Wallet sync is in progress. Waiting for DUST confirmation...';
      }

      if (convertResult.status === 'error') {
        submitMessage = `Walletsync DUST conversion returned: ${convertResult.message}`;
      }

      if (convertResult.status === 'unavailable') {
        submitMessage = 'Walletsync DUST endpoint unavailable right now. Waiting for confirmation...';
      }

      Logger.warn(submitMessage);
      Logger.info('Waiting for DUST confirmation...');

      const confirmation = await waitForWalletSyncDustBalance(walletData.name, process.cwd(), 120000, 4000);
      if (confirmation.status === 'confirmed') {
        Logger.success(`DUST confirmed: ${formatDustBalance(confirmation.balance.dustBalance)}\n`);
        return;
      }

      if (confirmation.status === 'timeout') {
        throw new Error(`DUST conversion did not confirm after waiting. Last walletsync message: ${submitMessage}`);
      }

      if (confirmation.status === 'unmapped') {
        throw new Error('Walletsync wallet mapping missing for DUST confirmation.');
      }

      throw new Error(`DUST conversion did not confirm. Last walletsync message: ${submitMessage}`);
    } else if (syncState.kind === 'syncing') {
      throw new Error('Wallet sync is in progress. Please wait 1-2 minutes.');
    } else {
      throw new Error('Walletsync is required for "wallet dust". Please run "nightforge sync" first, or use --legacy.');
    }
  }

  const projectRoot = getProjectRoot();
  ensureProjectDeps(projectRoot);
  const { setNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');

  const config = await ConfigLoader.load();
  const networkConfig = config.networks[network];

  if (!networkConfig) {
    throw new Error(`Network "${network}" not found`);
  }

  setNetworkId(network as any);

  const walletCtx = await withSpinner('Loading wallet...', async () =>
    WalletManager.create(walletData.seed, networkConfig)
  );

  const balance = await withSpinner('Checking balance...', async () => {
    await WalletManager.waitForSync(walletCtx.wallet);
    return WalletManager.getBalance(walletCtx.wallet);
  });

  if (balance <= 0n) {
    Logger.warn('\n⚠️  No balance found. Please fund your wallet first!');
    Logger.log('💰 Fund your wallet:');
    Logger.log('   → https://faucet.preprod.midnight.network/\n');
    await walletCtx.wallet.stop();
    return;
  }

  Logger.success(`Balance found: ${formatBalance(balance)} tNight\n`);

  Logger.log('─── DUST Token Setup ───────────────────────────────────────────\n');
  await withSpinner('Registering for DUST (if needed)...', async () =>
    registerForDustIfNeeded(walletCtx, false)
  );

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

function listWallets(): void {
  const names = WalletStorage.listWalletNames();
  const active = WalletStorage.getActiveWalletName();

  if (names.length === 0) {
    Logger.warn('No wallets found. Create one with "npx nightforge wallet create".');
    return;
  }

  Logger.log('\nStored wallets:\n');
  for (const name of names) {
    const marker = active === name ? ' (active)' : '';
    Logger.log(`  - ${name}${marker}`);
  }
  Logger.log('');
}

function useWallet(walletName: string): void {
  const safeName = WalletStorage.sanitizeName(walletName);
  WalletStorage.setActiveWallet(safeName);
  Logger.success(`Active wallet set to: ${safeName}`);
}

walletCmd.action(async () => {
  Logger.header('Wallet Manager');

  try {
    const wallets = WalletStorage.listWalletNames();
    const hasWallets = wallets.length > 0;

    const choices: any[] = [
      { name: 'Create wallet', value: 'create' },
      { name: 'Restore wallet', value: 'restore' },
    ];

    if (hasWallets) {
      choices.push(
        { name: 'List wallets', value: 'list' },
        { name: 'Switch active wallet', value: 'use' },
        { name: 'Check balance', value: 'balance' },
        { name: 'Convert to DUST', value: 'dust' },
        { name: 'Remove wallet', value: 'remove' }
      );
    }

    const { action } = await inquirer.prompt([
      {
        type: 'list',
        name: 'action',
        message: 'Select wallet action:',
        choices,
      },
    ]);

    let network = 'preprod';
    if (action === 'create' || action === 'restore' || action === 'balance' || action === 'dust') {
      const networkAnswer = await inquirer.prompt([
        {
          type: 'list',
          name: 'network',
          message: 'Select network:',
          choices: ['preprod'],
          default: 'preprod',
        },
      ]);
      network = networkAnswer.network;
    }

    if (action === 'create') {
      await createWallet({ network });
    } else if (action === 'restore') {
      await restoreWallet({ network });
    } else if (action === 'list') {
      listWallets();
    } else if (action === 'use') {
      const { walletName } = await inquirer.prompt([
        {
          type: 'list',
          name: 'walletName',
          message: 'Select wallet:',
          choices: wallets,
        },
      ]);
      useWallet(walletName);
    } else if (action === 'balance') {
      await showBalanceFromStorage(undefined, network);
    } else if (action === 'dust') {
      await convertToDust(undefined, network);
    } else {
      const { walletName } = await inquirer.prompt([
        {
          type: 'list',
          name: 'walletName',
          message: 'Select wallet to remove:',
          choices: wallets,
        },
      ]);
      await removeWallet({ name: walletName });
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
  .option('--name <name>', 'Base wallet name (final name adds address suffix)')
  .action(async (options) => {
    Logger.header('Create New Wallet');

    try {
      await createWallet({ network: options.network, name: options.name });
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
  .option('--name <name>', 'Base wallet name (final name adds address suffix)')
  .action(async (options) => {
    Logger.header('Restore Wallet');

    try {
      await restoreWallet({ network: options.network, name: options.name });
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
  .option('--name <name>', 'Wallet name (defaults to active wallet)')
  .option('--legacy', 'Use legacy direct wallet sync flow instead of walletsync service')
  .action(async (options) => {
    Logger.header('Wallet Balance');

    try {
      await showBalanceFromStorage(options.name, options.network, Boolean(options.legacy));
    } catch (error) {
      Logger.error('Failed to check balance', error as Error);
      process.exit(1);
    }
  });

walletCmd
  .command('remove')
  .description('Remove a stored wallet')
  .option('--name <name>', 'Wallet name (defaults to active wallet)')
  .action(async (options) => {
    Logger.header('Remove Wallet');

    try {
      await removeWallet({ name: options.name });
    } catch (error) {
      Logger.error('Failed to remove wallet', error as Error);
      process.exit(1);
    }
  });

walletCmd
  .command('dust')
  .description('Convert balance to DUST tokens')
  .option('-n, --network <network>', 'Network', 'preprod')
  .option('--name <name>', 'Wallet name (defaults to active wallet)')
  .option('--legacy', 'Use legacy direct wallet sync flow instead of walletsync service')
  .action(async (options) => {
    Logger.header('Convert to DUST');

    try {
      await convertToDust(options.name, options.network, Boolean(options.legacy));
    } catch (error) {
      Logger.error('Failed to convert to DUST', error as Error);
      process.exit(1);
    }
  });

walletCmd
  .command('list')
  .description('List stored wallets')
  .action(() => {
    Logger.header('Wallet List');
    listWallets();
  });

walletCmd
  .command('use')
  .description('Set active wallet')
  .argument('<name>', 'Wallet name to set active')
  .action((name) => {
    Logger.header('Switch Active Wallet');
    try {
      useWallet(name);
    } catch (error) {
      Logger.error('Failed to switch wallet', error as Error);
      process.exit(1);
    }
  });

export const walletCommand = walletCmd;

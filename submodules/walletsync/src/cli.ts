import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Socket } from 'node:net';
import { ensureWorkspaceFiles, envExamplePath, envPath, walletAliases, walletNameKey } from './config.js';
import { WalletSyncRuntime } from './runtime.js';
import type { WalletAlias } from './types.js';

const NIGHT_TOKEN_TYPE = '0000000000000000000000000000000000000000000000000000000000000000';

function formatUnits(raw: bigint, decimals: number): string {
  if (decimals <= 0) {
    return raw.toString();
  }
  const base = 10n ** BigInt(decimals);
  const whole = raw / base;
  const fraction = raw % base;
  if (fraction === 0n) {
    return whole.toString();
  }
  const fractionText = fraction.toString().padStart(decimals, '0').replace(/0+$/, '');
  return `${whole.toString()}.${fractionText}`;
}

function labelToken(token: string): string {
  return token === NIGHT_TOKEN_TYPE ? 'NIGHT' : token;
}

function usage(): void {
  console.log([
    'MidNight-walletsync commands:',
    '  init',
    '  sync [--port <port>]',
    '  status',
    '  balance <n1|n2|...>',
  ].join('\n'));
}

function parsePortArg(args: string[]): number | undefined {
  const index = args.indexOf('--port');
  if (index === -1) {
    return undefined;
  }

  const raw = args[index + 1];
  if (!raw) {
    throw new Error('Missing value for --port');
  }

  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`Invalid port "${raw}". Expected an integer between 1 and 65535.`);
  }

  return port;
}

function printSnapshot(snapshot: any, nightDecimals: number, dustDecimals: number): void {
  const unshieldedBalances = snapshot.unshieldedBalances ?? {};
  const shieldedBalances = snapshot.shieldedBalances ?? {};
  const nightRaw = BigInt(unshieldedBalances[NIGHT_TOKEN_TYPE] ?? '0') + BigInt(shieldedBalances[NIGHT_TOKEN_TYPE] ?? '0');
  const dustRaw = BigInt(snapshot.dustBalanceRaw ?? '0');

  const labeledUnshielded = Object.fromEntries(
    Object.entries(unshieldedBalances).map(([token, amount]) => [labelToken(token), amount]),
  );
  const labeledShielded = Object.fromEntries(
    Object.entries(shieldedBalances).map(([token, amount]) => [labelToken(token), amount]),
  );

  const otherUnshielded = Object.fromEntries(
    Object.entries(unshieldedBalances).filter(([token]) => token !== NIGHT_TOKEN_TYPE),
  );
  const otherShielded = Object.fromEntries(
    Object.entries(shieldedBalances).filter(([token]) => token !== NIGHT_TOKEN_TYPE),
  );

  console.log('=== WALLET BALANCE ===');
  console.log(`alias: ${snapshot.alias}`);
  console.log(`updatedAt: ${snapshot.updatedAt}`);
  console.log(`synced: ${snapshot.isSynced}`);
  console.log(`unshielded address: ${snapshot.unshieldedAddress}`);
  console.log(`shielded address: ${snapshot.shieldedAddress}`);
  console.log(`dust address: ${snapshot.dustAddress}`);
  console.log('');
  console.log('unshielded balances:');
  console.log(JSON.stringify(labeledUnshielded, null, 2));
  console.log(`NIGHT: ${formatUnits(nightRaw, nightDecimals)}`);
  console.log(`DUST: ${formatUnits(dustRaw, dustDecimals)}`);
  console.log('');
  console.log('other unshielded tokens (raw):');
  console.log(JSON.stringify(otherUnshielded, null, 2));
  console.log('other shielded tokens (raw):');
  console.log(JSON.stringify(otherShielded, null, 2));
  console.log('');
  console.log('shielded balances:');
  console.log(JSON.stringify(labeledShielded, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  const cwd = process.cwd();

  if (!command) {
    usage();
    return;
  }

  if (command === 'init') {
    const config = ensureWorkspaceFiles(cwd);
    const example = config.walletCount > 1
      ? walletAliases(config.walletCount)
          .map((alias) => `${walletNameKey(alias)}=nightforge-wallet-name-here`)
          .join('\n')
      : '# Single wallet mode uses active Nightforge wallet from ~/.nightforge/config.json';
    writeFileSync(envExamplePath(cwd), `${example}\n`, 'utf8');
    console.log(`Created ${join(cwd, 'midnightwalletsync.config.json')}`);
    console.log(`Created ${envExamplePath(cwd)}`);
    return;
  }

  const config = ensureWorkspaceFiles(cwd);

  if (command === 'sync') {
    const portOverride = parsePortArg(args);
    const runtimeConfig = portOverride ? { ...config, port: portOverride } : config;
    const runtime = WalletSyncRuntime.fromWorkspace(cwd, runtimeConfig);

    let shuttingDown = false;
    let stopping = false;

    const stopRuntime = async () => {
      if (stopping) return;
      stopping = true;
      try {
        await runtime.stopAll();
      } catch (error) {
        console.error('[warn] runtime stop error:', error);
      } finally {
        stopping = false;
      }
    };

    process.on('uncaughtException', (error) => {
      console.error('[error] uncaught exception in sync runtime:', error);
    });

    process.on('unhandledRejection', (reason) => {
      console.error('[error] unhandled rejection in sync runtime:', reason);
    });

    const server = runtime.createServer();
    const sockets = new Set<Socket>();
    server.on('connection', (socket) => {
      sockets.add(socket);
      socket.on('close', () => sockets.delete(socket));
    });

    const shutdown = async () => {
      if (shuttingDown) return;
      shuttingDown = true;

      for (const socket of sockets) {
        try {
          socket.destroy();
        } catch {
          // ignore socket close errors
        }
      }

      const forceExit = setTimeout(() => {
        console.error('[warn] forced shutdown after timeout');
        process.exit(0);
      }, 3000);
      forceExit.unref();

      await new Promise<void>((resolve) => {
        server.close(() => resolve());
      });

      await Promise.race([stopRuntime(), sleep(2500)]);
      clearTimeout(forceExit);
      process.exit(0);
    };
    const keepAlive = new Promise<void>((resolve) => {
      process.once('SIGINT', () => { void shutdown().finally(resolve); });
      process.once('SIGTERM', () => { void shutdown().finally(resolve); });
    });
    server.listen(runtimeConfig.port, '127.0.0.1', () => {
      console.log(`[info] server listening on http://127.0.0.1:${runtimeConfig.port}`);
    });

    while (!shuttingDown) {
      try {
        await runtime.startAll();
        console.log('[info] all wallets synced');
        break;
      } catch (error) {
        console.error('[error] walletsync runtime error:', error);
        if (shuttingDown) {
          break;
        }
        await stopRuntime();
        console.log('[warn] walletsync will retry in 3s...');
        await sleep(3000);
      }
    }

    await keepAlive;
    return;
  }

  if (command === 'status') {
    const runtime = WalletSyncRuntime.fromWorkspace(cwd, config);
    console.log(`Config file: ${join(cwd, 'midnightwalletsync.config.json')}`);
    console.log(`Env file: ${envPath(cwd)}`);
    console.log(`Wallets: ${runtime.listAliases().join(', ')}`);
    return;
  }

  if (command === 'balance') {
    const alias = (args[0] ?? 'n1') as WalletAlias;
    const snapshotPath = join(cwd, config.stateDir, `${alias}.json`);
    const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8'));
    if (!snapshot.isSynced) {
      console.log('[info] wallet is not fully synced yet');
      return;
    }
    printSnapshot(snapshot, config.nightDecimals, config.dustDecimals);
    return;
  }

  usage();
}

main().catch((error) => {
  console.error('[error]', error);
  process.exit(1);
});

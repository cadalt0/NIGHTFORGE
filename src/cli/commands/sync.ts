import { Command } from 'commander';
import * as path from 'node:path';
import { ChildProcess, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { FileSystem } from '../../utils/file-system.js';
import { Logger } from '../../utils/logger.js';

const DEFAULT_WALLETSYNC_PORT = 8787;

function runChild(child: ChildProcess): Promise<number> {
  return new Promise((resolve) => {
    const forwardSignal = (signal: NodeJS.Signals) => {
      if (!child.killed) {
        try {
          child.kill(signal);
        } catch {
          // ignore signal forwarding errors
        }
      }
    };

    const onSigInt = () => forwardSignal('SIGINT');
    const onSigTerm = () => forwardSignal('SIGTERM');
    process.once('SIGINT', onSigInt);
    process.once('SIGTERM', onSigTerm);

    const cleanup = () => {
      process.removeListener('SIGINT', onSigInt);
      process.removeListener('SIGTERM', onSigTerm);
    };

    child.on('close', (code, signal) => {
      cleanup();
      if (typeof code === 'number') {
        resolve(code);
        return;
      }

      if (signal === 'SIGINT') {
        resolve(130);
        return;
      }

      if (signal === 'SIGTERM') {
        resolve(143);
        return;
      }

      resolve(1);
    });

    child.on('error', () => {
      cleanup();
      resolve(1);
    });
  });
}

function runNpx(args: string[], cwd: string): Promise<number> {
  const child = spawn('npx', args, {
    cwd,
    stdio: 'inherit',
    shell: true,
  });

  return runChild(child);
}

function runNode(scriptPath: string, args: string[], cwd: string): Promise<number> {
  const child = spawn('node', [scriptPath, ...args], {
    cwd,
    stdio: 'inherit',
    shell: false,
  });

  return runChild(child);
}

function bundledWalletsyncBinPath(): string {
  const currentFile = fileURLToPath(import.meta.url);
  const commandsDir = path.dirname(currentFile);
  const nightforgeRoot = path.resolve(commandsDir, '../../..');
  return path.join(nightforgeRoot, 'submodules', 'walletsync', 'bin', 'midnightsync.js');
}

async function runWalletsync(args: string[], cwd: string): Promise<number> {
  const bundledBin = bundledWalletsyncBinPath();
  if (FileSystem.exists(bundledBin)) {
    return runNode(bundledBin, args, cwd);
  }
  return runNpx(['midnightsync', ...args], cwd);
}

async function ensureWalletsyncInitialized(cwd: string): Promise<void> {
  const configPath = path.join(cwd, 'midnightwalletsync.config.json');
  const envPath = path.join(cwd, '.env');

  if (FileSystem.exists(configPath) && FileSystem.exists(envPath)) {
    return;
  }

  Logger.info('Walletsync is not initialized in this folder. Running setup...');
  const code = await runWalletsync(['init'], cwd);
  if (code !== 0) {
    throw new Error('Failed to initialize walletsync. Run: nightforge sync --init');
  }

  Logger.success('Walletsync setup complete.');
}

function persistWalletsyncPort(cwd: string, port: number): void {
  const configPath = path.join(cwd, 'midnightwalletsync.config.json');
  let current: Record<string, unknown> = {};

  if (FileSystem.exists(configPath)) {
    try {
      current = FileSystem.readJSON<Record<string, unknown>>(configPath);
    } catch {
      current = {};
    }
  }

  const next = {
    ...current,
    port,
  };

  FileSystem.writeJSON(configPath, next);
}

export const syncCommand = new Command('sync')
  .description('Run walletsync (required for walletsync-first balance checks)')
  .option('--init', 'Initialize walletsync files only')
  .option('--status', 'Show walletsync status')
  .option('--balance [alias]', 'Read walletsync balance for alias (default n1)')
  .option('-p, --port <port>', 'Run walletsync sync server on a custom port')
  .action(async (options) => {
    try {
      const cwd = process.cwd();
      const syncArgs: string[] = ['sync'];
      let effectivePort = DEFAULT_WALLETSYNC_PORT;

      if (options.port !== undefined) {
        const portRaw = String(options.port).trim();
        const port = Number(portRaw);
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
          throw new Error(`Invalid port "${portRaw}". Expected an integer between 1 and 65535.`);
        }
        effectivePort = port;
        syncArgs.push('--port', String(port));
      }

      if (options.init) {
        const code = await runWalletsync(['init'], cwd);
        if (code !== 0) {
          throw new Error('Walletsync init failed.');
        }
        return;
      }

      if (options.status) {
        const code = await runWalletsync(['status'], cwd);
        if (code !== 0) {
          throw new Error('Walletsync status failed. Run: nightforge sync --init');
        }
        return;
      }

      if (options.balance !== undefined) {
        const alias = typeof options.balance === 'string' && options.balance.trim().length > 0
          ? options.balance.trim()
          : 'n1';
        const code = await runWalletsync(['balance', alias], cwd);
        if (code !== 0) {
          throw new Error('Walletsync balance failed. Make sure sync is running.');
        }
        return;
      }

      await ensureWalletsyncInitialized(cwd);
      persistWalletsyncPort(cwd, effectivePort);
      Logger.info(`Using walletsync port: ${effectivePort}`);

      Logger.info('Starting walletsync. Keep this terminal open.');
      const code = await runWalletsync(syncArgs, cwd);
      if (code === 130 || code === 143) {
        Logger.info('Walletsync stopped by user.');
        return;
      }
      if (code !== 0) {
        throw new Error('Walletsync failed to start. Check config and installed dependencies.');
      }
    } catch (error) {
      Logger.error('Sync command failed', error as Error);
      process.exit(1);
    }
  });

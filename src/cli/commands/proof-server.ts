import { Command } from 'commander';
import { spawn, ChildProcess } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { WalletStorage } from '../../wallet/storage.js';
import { Logger } from '../../utils/logger.js';
import { startSpinner } from '../../utils/cli-spinner.js';

let proofServerProcess: ChildProcess | null = null;
const statusFileName = 'proof-server-status.json';

export const proofServerCommand = new Command('proof-server')
  .description('Manage the proof server (Docker)')
  .option('-s, --stop', 'Stop the proof server')
  .option('-v, --version <version>', 'Proof server version', '7.0.0')
  .option('-p, --port <port>', 'Port to run on', '6300')
  .action(async (options) => {
    if (options.stop) {
      stopProofServer();
      return;
    }

    startProofServer(options.version, options.port);
  });

function startProofServer(version: string, port: string): void {
  Logger.header('Midnight Proof Server');

  try {
    const dockerSpinner = startSpinner('Checking Docker...');
    // Check if Docker is running
    const dockerCheck = spawn('docker', ['info'], { stdio: 'pipe' });

    dockerCheck.on('error', () => {
      dockerSpinner.fail('Docker check failed');
      Logger.error('Docker is not installed or not running');
      Logger.info('Install Docker: https://docs.docker.com/get-docker/');
      process.exit(1);
    });

    dockerCheck.on('close', (code) => {
      if (code !== 0) {
        dockerSpinner.fail('Docker not running');
        Logger.error('Docker is not running. Please start Docker and try again.');
        process.exit(1);
      }

      dockerSpinner.succeed('Docker running');
      Logger.info(`Starting proof server on port ${port}...`);
      let statusWritten = false;
      WalletStorage.ensureInitialized();
      const statusFilePath = path.join(WalletStorage.getBaseDir(), statusFileName);
      
      proofServerProcess = spawn(
        'docker',
        [
          'run',
          '--rm',
          '-p',
          `${port}:6300`,
          `midnightntwrk/proof-server:${version}`,
          '--',
          'midnight-proof-server',
          '-v',
        ],
        { stdio: ['ignore', 'pipe', 'pipe'] }
      );

      const writeStatus = (running: boolean, extra: Record<string, unknown> = {}) => {
        const status = {
          running,
          port,
          url: `http://127.0.0.1:${port}`,
          version,
          pid: proofServerProcess?.pid ?? null,
          updatedAt: new Date().toISOString(),
          ...extra,
        };
        fs.writeFileSync(statusFilePath, JSON.stringify(status, null, 2));
      };

      // Always refresh status at startup (including restarts)
      writeStatus(true, { state: 'starting' });

      const handleLogChunk = (chunk: Buffer) => {
        const text = chunk.toString();
        process.stdout.write(text);

        if (!statusWritten && text.includes('listening on:')) {
          statusWritten = true;
          writeStatus(true, { state: 'ready' });
          Logger.success(`Server status saved: ${statusFileName}`);
        }
      };

      proofServerProcess.stdout?.on('data', handleLogChunk);
      proofServerProcess.stderr?.on('data', (chunk: Buffer) => {
        const text = chunk.toString();
        process.stderr.write(text);

        if (!statusWritten && text.includes('listening on:')) {
          statusWritten = true;
          writeStatus(true, { state: 'ready' });
          Logger.success(`Server status saved: ${statusFileName}`);
        }
      });

      proofServerProcess.on('error', (error) => {
        Logger.error('Failed to start proof server', error);
        process.exit(1);
      });

      proofServerProcess.on('close', (code) => {
        writeStatus(false, {
          state: 'stopped',
          exitCode: code,
        });

        if (code !== 0) {
          Logger.error(`Proof server exited with code ${code}`);
        } else {
          Logger.info('Proof server stopped');
        }
      });

      Logger.success(`Proof server running on http://127.0.0.1:${port}`);
      Logger.info('Press Ctrl+C to stop');

      // Handle Ctrl+C
      process.on('SIGINT', () => {
        Logger.info('\nStopping proof server...');
        writeStatus(false, {
          state: 'stopped',
          reason: 'SIGINT',
        });
        stopProofServer();
        process.exit(0);
      });
    });
  } catch (error) {
    Logger.error('Failed to start proof server', error as Error);
    process.exit(1);
  }
}

function stopProofServer(): void {
  if (proofServerProcess) {
    Logger.info('Stopping proof server...');
    proofServerProcess.kill();
    proofServerProcess = null;
    Logger.success('Proof server stopped');
  } else {
    Logger.warn('Proof server is not running');
  }
}

export { startProofServer, stopProofServer };


#!/usr/bin/env node

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = join(__dirname, '..');

// Resolve tsx from package-local node_modules first, then hoisted node_modules.
const localTsxPath = join(rootDir, 'node_modules', '.bin', 'tsx');
const hoistedTsxPath = join(rootDir, '..', '.bin', 'tsx');
const tsxPath = existsSync(localTsxPath) ? localTsxPath : hoistedTsxPath;

const child = spawn(tsxPath, [join(rootDir, 'src', 'cli.ts'), ...process.argv.slice(2)], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NODE_OPTIONS: '--no-deprecation',
  },
  stdio: 'inherit',
});

const forwardSignal = (signal) => {
  if (!child.killed) {
    try {
      child.kill(signal);
    } catch {
      // ignore forwarding errors
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

child.on('error', (error) => {
  cleanup();
  console.error('[error] failed to start CLI:', error.message);
  process.exit(1);
});

child.on('close', (code, signal) => {
  cleanup();

  if (typeof code === 'number') {
    process.exit(code);
    return;
  }

  if (signal === 'SIGINT') {
    process.exit(130);
    return;
  }

  if (signal === 'SIGTERM') {
    process.exit(143);
    return;
  }

  process.exit(1);
});

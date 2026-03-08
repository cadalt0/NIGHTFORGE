#!/usr/bin/env node
import { Command } from 'commander';
import { deployCommand } from './commands/deploy.js';
import { compileCommand } from './commands/compile.js';
import { walletCommand } from './commands/wallet.js';
import { initCommand } from './commands/init.js';
import { proofServerCommand, startProofServer, stopProofServer } from './commands/proof-server.js';
import { cleanCommand } from './commands/clean.js';

const program = new Command();

program
  .name('nightforge')
  .description('A comprehensive development tool for Midnight blockchain')
  .version('0.1.0');

// Register commands
program.addCommand(initCommand);
program.addCommand(compileCommand);
program.addCommand(deployCommand);
program.addCommand(walletCommand);
program.addCommand(proofServerCommand);

// Register ps alias for proof-server
const psCommand = new Command('ps')
  .description('Shorthand for proof-server')
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

program.addCommand(psCommand);
program.addCommand(cleanCommand);

program.parse();


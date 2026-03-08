#!/usr/bin/env node
import { Command } from 'commander';
import { deployCommand } from './commands/deploy.js';
import { compileCommand } from './commands/compile.js';
import { walletCommand } from './commands/wallet.js';
import { initCommand } from './commands/init.js';
import { proofServerCommand } from './commands/proof-server.js';
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
program.addCommand(cleanCommand);

program.parse();

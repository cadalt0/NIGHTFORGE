import { Command } from 'commander';
import { Compiler } from '../../compiler/index.js';

export const compileCommand = new Command('compile')
  .description('Compile Compact smart contracts')
  .argument('[contract]', 'Specific contract to compile (optional, compiles all if not provided)')
  .option('-f, --force', 'Force recompilation even if up to date')
  .option('-q, --quiet', 'Suppress output')
  .action(async (contract, options) => {
    await Compiler.compile(contract, {
      force: options.force,
      quiet: options.quiet,
    });
  });

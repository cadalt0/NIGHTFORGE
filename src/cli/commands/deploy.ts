import { Command } from 'commander';
import { Deployer } from '../../deployer/index.js';
import { AutoDeployer } from '../../deployer/auto.js';

export const deployCommand = new Command('deploy')
  .description('Deploy a smart contract to the Midnight network')
  .argument('[contract]', 'Contract name to deploy (defaults to first contract found)')
  .option('-n, --network <network>', 'Network to deploy to', 'preprod')
  .option('-p, --private-key <key>', 'Private key (seed) for deployment wallet')
  .option('-s, --script <path>', 'Custom deployment script')
    .option('--auto', 'Auto mode: create wallet, wait for funds, convert to DUST, start deployment')
  .action(async (contract, options) => {
    const contractName = contract || 'example';
    
        if (options.auto) {
          await AutoDeployer.deploy(contractName, {
            network: options.network,
          });
          return;
        }
    
    await Deployer.deploy(contractName, {
      network: options.network,
      privateKey: options.privateKey,
      script: options.script,
    });
  });

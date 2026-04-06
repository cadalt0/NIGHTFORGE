import { Command } from 'commander';
import { Deployer } from '../../deployer/index.js';
import { AutoDeployer } from '../../deployer/auto.js';

export const deployCommand = new Command('deploy')
  .description('Deploy a smart contract to the Midnight network')
  .argument('[contract]', 'Contract name to deploy (defaults to first contract found)')
  .option('-n, --network <network>', 'Network to deploy to', 'preprod')
  .option('-p, --private-key <key>', 'Private key (seed) for deployment wallet')
  .option('-w, --wallet <name>', 'Stored wallet name to use (defaults to active wallet)')
  .option('-s, --script <path>', 'Custom deployment script')
  .option('--remote <url>', 'Use a remote proof server URL instead of local proof server checks')
  .option('--legacy', 'Use legacy direct wallet checks instead of walletsync service')
  .option('--auto', 'Auto mode: create wallet, wait for funds, convert to DUST, start deployment')
  .action(async (contract, options) => {
    const rawContractName = contract || 'example';
    const contractName = String(rawContractName).replace(/\.compact$/i, '');
    
    if (options.auto) {
      await AutoDeployer.deploy(contractName, {
        network: options.network,
        wallet: options.wallet,
        legacy: Boolean(options.legacy),
        proofServerUrl: options.remote,
      });
      return;
    }

    await Deployer.deploy(contractName, {
      network: options.network,
      privateKey: options.privateKey,
      wallet: options.wallet,
      script: options.script,
      legacy: Boolean(options.legacy),
      proofServerUrl: options.remote,
    });
  });

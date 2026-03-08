import { Command } from 'commander';
import inquirer from 'inquirer';
import * as path from 'node:path';
import { spawn } from 'node:child_process';
import chalk from 'chalk';
import ora from 'ora';
import { FileSystem } from '../../utils/file-system.js';
import { Logger } from '../../utils/logger.js';

function runInstall(cwd: string): Promise<{ code: number; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn('npm', ['install'], {
      cwd,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let stderr = '';
    child.stderr?.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (code) => {
      resolve({ code: code ?? 1, stderr });
    });

    child.on('error', (error) => {
      resolve({ code: 1, stderr: error.message });
    });
  });
}

const configTemplate = `const config = {
  networks: {
    preprod: {
      indexer: 'https://indexer.preprod.midnight.network/api/v3/graphql',
      indexerWS: 'wss://indexer.preprod.midnight.network/api/v3/graphql/ws',
      node: 'https://rpc.preprod.midnight.network',
      proofServer: 'http://127.0.0.1:6300',
    },
  },
  contracts: {
    outputDir: 'contracts/managed',
  },
  paths: {
    contracts: './contracts',
    scripts: './scripts',
  },
};

export default config;
`;

const contractTemplate = `// Hello World Compact contract
pragma language_version 0.21;

// Public on-chain state
export ledger message: Bytes<11>;

// Initialize state during deploy 
constructor() {
  message = "Hello World";
}

// Read current message
export circuit getMessage(): Bytes<11> {
  return message;
}

// Update current message
export circuit storeMessage(newMessage: Bytes<11>): [] {
  message = disclose(newMessage);
}

// Hardcoded default: "Hello World"
`;

const gitignoreTemplate = `node_modules/
dist/
*.log
.env
.env.local
deployment.json
contracts/managed/
.cache/
`;

export const initCommand = new Command('init')
  .description('Initialize a new Midnight project')
  .argument('[project-name]', 'Name of the project')
  .option('-t, --template <name>', 'Project template (default, token, nft)', 'default')
  .option('--no-install', 'Skip automatic dependency installation')
  .action(async (projectName, options) => {
    Logger.header('Initialize Midnight Project');

    try {
      // Prompt for project name if not provided
      let name = projectName;
      if (!name) {
        Logger.section('Project Setup');
        Logger.log(chalk.cyan('✨ Let\'s create your Midnight app.'));
        Logger.log(chalk.gray('Pick a project name (letters, numbers, - and _).\n'));

        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'projectName',
            message: chalk.cyan('🚀 Project name:'),
            default: 'my-midnight-app',
            validate: (input: string) => {
              if (!input || input.trim().length === 0) {
                return 'Project name is required';
              }
              if (!/^[a-z0-9-_]+$/i.test(input)) {
                return 'Project name can only contain letters, numbers, hyphens, and underscores';
              }
              return true;
            },
          },
        ]);
        name = answers.projectName;
      }

      const projectPath = path.resolve(process.cwd(), name);

      // Check if directory already exists
      if (FileSystem.exists(projectPath)) {
        Logger.error(`Directory "${name}" already exists`);
        process.exit(1);
      }

      const setupSpinner = ora(`Setting up ${chalk.cyan(name)}...`).start();

      // Create directory structure
      FileSystem.createDir(projectPath);
      FileSystem.createDir(path.join(projectPath, 'contracts'));
      FileSystem.createDir(path.join(projectPath, 'scripts'));

      // Create config file
      FileSystem.writeFile(path.join(projectPath, 'midnight.config.js'), configTemplate);

      // Create package.json
      const packageJson = {
        name,
        version: '1.0.0',
        type: 'module',
        scripts: {
          compile: 'npx nightforge compile',
          deploy: 'npx nightforge deploy',
          'proof-server': 'npx nightforge proof-server',
          forge: 'nightforge'
        },
        devDependencies: {
          '@types/node': '^22.0.0',
          '@types/ws': '^8.18.1',
          'typescript': '^5.9.3',
        },
        dependencies: {
          '@midnight-ntwrk/compact-runtime': '0.14.0',
          '@midnight-ntwrk/compact-js': '2.4.0',
          '@midnight-ntwrk/ledger': '^4.0.0',
          '@midnight-ntwrk/ledger-v7': '7.0.0',
          '@midnight-ntwrk/midnight-js-contracts': '3.0.0',
          '@midnight-ntwrk/midnight-js-http-client-proof-provider': '3.0.0',
          '@midnight-ntwrk/midnight-js-indexer-public-data-provider': '3.0.0',
          '@midnight-ntwrk/midnight-js-level-private-state-provider': '3.0.0',
          '@midnight-ntwrk/midnight-js-network-id': '3.0.0',
          '@midnight-ntwrk/midnight-js-node-zk-config-provider': '3.0.0',
          '@midnight-ntwrk/midnight-js-types': '3.0.0',
          '@midnight-ntwrk/midnight-js-utils': '^3.1.0',
          '@midnight-ntwrk/wallet-sdk-address-format': '3.0.0',
          '@midnight-ntwrk/wallet-sdk-dust-wallet': '1.0.0',
          '@midnight-ntwrk/wallet-sdk-facade': '1.0.0',
          '@midnight-ntwrk/wallet-sdk-hd': '3.0.0',
          '@midnight-ntwrk/wallet-sdk-shielded': '1.0.0',
          '@midnight-ntwrk/wallet-sdk-unshielded-wallet': '1.0.0',
          'rxjs': '^7.8.2',
          'ws': '^8.19.0',
        },
      };
      FileSystem.writeJSON(path.join(projectPath, 'package.json'), packageJson);

      // Create sample contract
      FileSystem.writeFile(
        path.join(projectPath, 'contracts', 'example.compact'),
        contractTemplate
      );

      // Create .gitignore
      FileSystem.writeFile(path.join(projectPath, '.gitignore'), gitignoreTemplate);

      setupSpinner.succeed(`Project scaffold ready: ${chalk.cyan(name)}`);

      if (options.install) {
        const installSpinner = ora(`Installing dependencies for ${chalk.cyan(name)}...`).start();
        const result = await runInstall(projectPath);

        if (result.code === 0) {
          installSpinner.succeed('Dependencies installed');
        } else {
          installSpinner.fail('Auto-install failed');
          if (process.env.DEBUG) {
            const stderr = result.stderr?.trim();
            if (stderr) Logger.log(stderr);
          }
          Logger.warn('Auto-install failed. Run "npm install" inside project.');
        }
      }

      Logger.section('Project Created!');
    } catch (error) {
      Logger.error('Failed to initialize project', error as Error);
      process.exit(1);
    }
  });

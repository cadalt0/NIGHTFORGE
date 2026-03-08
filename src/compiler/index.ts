import * as path from 'node:path';
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import { ConfigLoader } from '../config/loader.js';
import { FileSystem } from '../utils/file-system.js';
import { Logger } from '../utils/logger.js';
import { CompileOptions } from '../types/index.js';

export class Compiler {
  static async compile(contractPath?: string, options: CompileOptions = {}): Promise<void> {
    Logger.header('Nightforge - Compiler');

    try {
      const config = await ConfigLoader.load();
      const projectRoot = FileSystem.findProjectRoot() || process.cwd();
      const contractsDir = path.join(projectRoot, config.paths?.contracts || './contracts');
      const outputDir = path.join(projectRoot, config.contracts?.outputDir || 'contracts/managed');

      // Find contracts to compile
      const contracts = contractPath
        ? [contractPath]
        : this.findContracts(contractsDir);

      if (contracts.length === 0) {
        Logger.warn('No .compact files found');
        return;
      }

      Logger.info(`Found ${contracts.length} contract(s) to compile\n`);

      for (const contract of contracts) {
        const contractName = path.basename(contract, '.compact');
        const contractFullPath = path.isAbsolute(contract) 
          ? contract 
          : path.join(contractsDir, contract);
        const outputPath = path.join(outputDir, contractName);

        Logger.info(`Compiling: ${contractName}...`);

        await this.compileContract(contractFullPath, outputPath, options);

        Logger.success(`Compiled: ${contractName}`);
      }

      Logger.section('Compilation Complete!');
    } catch (error) {
      Logger.error('Compilation failed', error as Error);
      process.exit(1);
    }
  }

  private static findContracts(dir: string): string[] {
    const contracts: string[] = [];

    const scanDir = (currentDir: string) => {
      if (!FileSystem.exists(currentDir)) return;

      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDir(fullPath);
        } else if (item.endsWith('.compact')) {
          contracts.push(fullPath);
        }
      }
    };

    scanDir(dir);
    return contracts;
  }

  private static async compileContract(
    inputPath: string,
    outputPath: string,
    options: CompileOptions
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const args = ['compile', inputPath, outputPath];
      
      const compactProcess = spawn('compact', args, {
        stdio: options.quiet ? 'pipe' : 'inherit',
      });

      compactProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Compilation failed with exit code ${code}`));
        }
      });

      compactProcess.on('error', (error) => {
        reject(new Error(`Failed to start compiler: ${error.message}`));
      });
    });
  }
}

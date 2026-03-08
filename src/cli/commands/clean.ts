import { Command } from 'commander';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { ConfigLoader } from '../../config/loader.js';
import { FileSystem } from '../../utils/file-system.js';
import { Logger } from '../../utils/logger.js';

export const cleanCommand = new Command('clean')
  .description('Clean build artifacts and cache')
  .option('-a, --all', 'Clean everything including node_modules')
  .action(async (options) => {
    Logger.header('Clean Build Artifacts');

    try {
      const config = await ConfigLoader.load();
      const projectRoot = FileSystem.findProjectRoot() || process.cwd();

      const dirsToClean = [
        path.join(projectRoot, config.contracts?.outputDir || 'contracts/managed'),
        path.join(projectRoot, config.paths?.cache || '.cache'),
        path.join(projectRoot, 'dist'),
      ];

      if (options.all) {
        dirsToClean.push(path.join(projectRoot, 'node_modules'));
      }

      let cleaned = 0;

      for (const dir of dirsToClean) {
        if (FileSystem.exists(dir)) {
          Logger.info(`Cleaning: ${path.basename(dir)}`);
          fs.rmSync(dir, { recursive: true, force: true });
          cleaned++;
        }
      }

      if (cleaned === 0) {
        Logger.info('Nothing to clean');
      } else {
        Logger.success(`Cleaned ${cleaned} directory/directories`);
      }
    } catch (error) {
      Logger.error('Failed to clean', error as Error);
      process.exit(1);
    }
  });

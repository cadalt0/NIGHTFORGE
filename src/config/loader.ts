import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MidnightConfig, MidnightConfigSchema } from '../types/index.js';
import { FileSystem } from '../utils/file-system.js';
import { Logger } from '../utils/logger.js';

export class ConfigLoader {
  private static configCache: MidnightConfig | null = null;

  static async load(projectRoot?: string): Promise<MidnightConfig> {
    if (this.configCache) {
      return this.configCache;
    }

    const root = projectRoot || FileSystem.findProjectRoot() || process.cwd();
    const configPaths = [
      path.join(root, 'midnight.config.ts'),
      path.join(root, 'midnight.config.js'),
    ];

    let lastError: Error | null = null;

    for (const configPath of configPaths) {
      if (FileSystem.exists(configPath)) {
        try {
          const configModule = await import(pathToFileURL(configPath).href);
          const config = configModule.default || configModule;
          
          const validated = MidnightConfigSchema.parse(config);
          this.configCache = this.enrichConfig(validated);
          return this.configCache;
        } catch (error) {
          lastError = error as Error;
          Logger.warn(`Skipping invalid config: ${configPath}`);
        }
      }
    }

    if (lastError) {
      Logger.error('Failed to load any valid midnight config', lastError);
      throw lastError;
    }

    // Return default config if none found
    Logger.warn('No midnight.config file found, using defaults');
    return this.getDefaultConfig();
  }

  private static enrichConfig(config: MidnightConfig): MidnightConfig {
    // Add WebSocket URLs if missing
    for (const [networkName, networkConfig] of Object.entries(config.networks)) {
      if (!networkConfig.indexerWS && networkConfig.indexer) {
        config.networks[networkName].indexerWS = networkConfig.indexer
          .replace('http://', 'ws://')
          .replace('https://', 'wss://') + '/ws';
      }
    }

    return config;
  }

  static getDefaultConfig(): MidnightConfig {
    return {
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
        cache: './.cache',
      },
    };
  }

  static clearCache(): void {
    this.configCache = null;
  }
}

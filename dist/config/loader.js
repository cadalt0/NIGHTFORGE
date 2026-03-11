import * as path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MidnightConfigSchema } from '../types/index.js';
import { FileSystem } from '../utils/file-system.js';
import { Logger } from '../utils/logger.js';
export class ConfigLoader {
    static configCache = null;
    static async load(projectRoot) {
        if (this.configCache) {
            return this.configCache;
        }
        const root = projectRoot || FileSystem.findProjectRoot() || process.cwd();
        const configPaths = [
            path.join(root, 'midnight.config.ts'),
            path.join(root, 'midnight.config.js'),
        ];
        let lastError = null;
        for (const configPath of configPaths) {
            if (FileSystem.exists(configPath)) {
                try {
                    const configModule = await import(pathToFileURL(configPath).href);
                    const config = configModule.default || configModule;
                    const validated = MidnightConfigSchema.parse(config);
                    this.configCache = this.enrichConfig(validated);
                    return this.configCache;
                }
                catch (error) {
                    lastError = error;
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
    static enrichConfig(config) {
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
    static getDefaultConfig() {
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
    static clearCache() {
        this.configCache = null;
    }
}
//# sourceMappingURL=loader.js.map
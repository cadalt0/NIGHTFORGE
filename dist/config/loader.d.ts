import { MidnightConfig } from '../types/index.js';
export declare class ConfigLoader {
    private static configCache;
    static load(projectRoot?: string): Promise<MidnightConfig>;
    private static enrichConfig;
    static getDefaultConfig(): MidnightConfig;
    static clearCache(): void;
}
//# sourceMappingURL=loader.d.ts.map
import { z } from 'zod';
// Network configuration schema
export const NetworkConfigSchema = z.object({
    indexer: z.string().url(),
    indexerWS: z.string().url().optional(),
    node: z.string().url(),
    proofServer: z.string().url(),
});
// Main config schema
export const MidnightConfigSchema = z.object({
    networks: z.record(NetworkConfigSchema),
    contracts: z.object({
        outputDir: z.string().default('contracts/managed'),
    }).optional(),
    paths: z.object({
        contracts: z.string().default('./contracts'),
        scripts: z.string().default('./scripts'),
        cache: z.string().default('./.cache'),
    }).optional(),
    compiler: z.object({
        version: z.string().optional(),
    }).optional(),
});
//# sourceMappingURL=index.js.map
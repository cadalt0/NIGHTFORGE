import { z } from 'zod';
export declare const NetworkConfigSchema: z.ZodObject<{
    indexer: z.ZodString;
    indexerWS: z.ZodOptional<z.ZodString>;
    node: z.ZodString;
    proofServer: z.ZodString;
}, "strip", z.ZodTypeAny, {
    indexer: string;
    node: string;
    proofServer: string;
    indexerWS?: string | undefined;
}, {
    indexer: string;
    node: string;
    proofServer: string;
    indexerWS?: string | undefined;
}>;
export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;
export declare const MidnightConfigSchema: z.ZodObject<{
    networks: z.ZodRecord<z.ZodString, z.ZodObject<{
        indexer: z.ZodString;
        indexerWS: z.ZodOptional<z.ZodString>;
        node: z.ZodString;
        proofServer: z.ZodString;
    }, "strip", z.ZodTypeAny, {
        indexer: string;
        node: string;
        proofServer: string;
        indexerWS?: string | undefined;
    }, {
        indexer: string;
        node: string;
        proofServer: string;
        indexerWS?: string | undefined;
    }>>;
    contracts: z.ZodOptional<z.ZodObject<{
        outputDir: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        outputDir: string;
    }, {
        outputDir?: string | undefined;
    }>>;
    paths: z.ZodOptional<z.ZodObject<{
        contracts: z.ZodDefault<z.ZodString>;
        scripts: z.ZodDefault<z.ZodString>;
        cache: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        contracts: string;
        scripts: string;
        cache: string;
    }, {
        contracts?: string | undefined;
        scripts?: string | undefined;
        cache?: string | undefined;
    }>>;
    compiler: z.ZodOptional<z.ZodObject<{
        version: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        version?: string | undefined;
    }, {
        version?: string | undefined;
    }>>;
}, "strip", z.ZodTypeAny, {
    networks: Record<string, {
        indexer: string;
        node: string;
        proofServer: string;
        indexerWS?: string | undefined;
    }>;
    contracts?: {
        outputDir: string;
    } | undefined;
    paths?: {
        contracts: string;
        scripts: string;
        cache: string;
    } | undefined;
    compiler?: {
        version?: string | undefined;
    } | undefined;
}, {
    networks: Record<string, {
        indexer: string;
        node: string;
        proofServer: string;
        indexerWS?: string | undefined;
    }>;
    contracts?: {
        outputDir?: string | undefined;
    } | undefined;
    paths?: {
        contracts?: string | undefined;
        scripts?: string | undefined;
        cache?: string | undefined;
    } | undefined;
    compiler?: {
        version?: string | undefined;
    } | undefined;
}>;
export type MidnightConfig = z.infer<typeof MidnightConfigSchema>;
export interface WalletKeys {
    seed: string;
    address: string;
    network: string;
}
export interface DeploymentInfo {
    contractAddress: string;
    network: string;
    deployedAt: string;
    deployer: string;
    transactionHash?: string;
}
export interface DeployOptions {
    network: string;
    script?: string;
    privateKey?: string;
    wallet?: string;
}
export interface CompileOptions {
    force?: boolean;
    quiet?: boolean;
}
export interface WalletCreateOptions {
    network?: string;
    export?: string;
}
//# sourceMappingURL=index.d.ts.map
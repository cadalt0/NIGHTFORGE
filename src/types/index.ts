import { z } from 'zod';

// Network configuration schema
export const NetworkConfigSchema = z.object({
  indexer: z.string().url(),
  indexerWS: z.string().url().optional(),
  node: z.string().url(),
  proofServer: z.string().url(),
});

export type NetworkConfig = z.infer<typeof NetworkConfigSchema>;

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

export type MidnightConfig = z.infer<typeof MidnightConfigSchema>;

// Wallet types
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

// Command options
export interface DeployOptions {
  network: string;
  script?: string;
  privateKey?: string;
}

export interface CompileOptions {
  force?: boolean;
  quiet?: boolean;
}

export interface WalletCreateOptions {
  network?: string;
  export?: string;
}

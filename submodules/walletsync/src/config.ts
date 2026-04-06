import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import { join } from 'node:path';
import type { MidnightWalletSyncConfig, WalletAlias } from './types.js';

export const CONFIG_FILE_NAME = 'midnightwalletsync.config.json';
export const ENV_FILE_NAME = '.env';
export const ENV_EXAMPLE_FILE_NAME = '.env.example';

export function defaultConfig(): MidnightWalletSyncConfig {
  return {
    network: 'preprod',
    walletCount: 1,
    stateDir: '.midnightwalletsync',
    port: 8787,
    nightDecimals: 6,
    dustDecimals: 15,
    indexer: 'https://indexer.preprod.midnight.network/api/v4/graphql',
    indexerWS: 'wss://indexer.preprod.midnight.network/api/v4/graphql/ws',
    node: 'https://rpc.preprod.midnight.network',
    nodeWS: 'wss://rpc.preprod.midnight.network',
    proofServer: 'https://proof.preprod.midnight.network',
  };
}

export function configPath(cwd = process.cwd()): string {
  return join(cwd, CONFIG_FILE_NAME);
}

export function envPath(cwd = process.cwd()): string {
  return join(cwd, ENV_FILE_NAME);
}

export function envExamplePath(cwd = process.cwd()): string {
  return join(cwd, ENV_EXAMPLE_FILE_NAME);
}

export function normalizeConfig(config: Partial<MidnightWalletSyncConfig>): MidnightWalletSyncConfig {
  const base = defaultConfig();
  const walletCount = Number(config.walletCount ?? base.walletCount);
  return {
    network: String(config.network ?? base.network),
    walletCount: Number.isFinite(walletCount) && walletCount > 0 ? Math.floor(walletCount) : base.walletCount,
    stateDir: String(config.stateDir ?? base.stateDir),
    port: Number(config.port ?? base.port),
    nightDecimals: Number(config.nightDecimals ?? base.nightDecimals),
    dustDecimals: Number(config.dustDecimals ?? base.dustDecimals),
    indexer: String(config.indexer ?? base.indexer),
    indexerWS: String(config.indexerWS ?? base.indexerWS),
    node: String(config.node ?? base.node),
    nodeWS: String(config.nodeWS ?? base.nodeWS),
    proofServer: String(config.proofServer ?? base.proofServer),
  };
}

export function writeDefaultConfig(cwd = process.cwd()): MidnightWalletSyncConfig {
  const config = defaultConfig();
  writeFileSync(configPath(cwd), `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  return config;
}

export function ensureConfig(cwd = process.cwd()): MidnightWalletSyncConfig {
  const path = configPath(cwd);
  if (!existsSync(path)) {
    return writeDefaultConfig(cwd);
  }
  const raw = readFileSync(path, 'utf8');
  return normalizeConfig(JSON.parse(raw) as Partial<MidnightWalletSyncConfig>);
}

function parseEnvFile(content: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

export function loadEnvMap(cwd = process.cwd()): Record<string, string> {
  const fromProcess = Object.fromEntries(
    Object.entries(process.env).flatMap(([key, value]) => (typeof value === 'string' ? [[key, value]] : [])),
  );
  const file = envPath(cwd);
  if (!existsSync(file)) {
    return fromProcess;
  }
  const fileEnv = parseEnvFile(readFileSync(file, 'utf8'));
  return {
    ...fromProcess,
    ...fileEnv,
  };
}

export interface StoredWalletData {
  name: string;
  address: string;
  seed: string;
  network: string;
  createdAt: string;
  updatedAt: string;
}

function sanitizeWalletName(name: string): string {
  const sanitized = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (!sanitized) {
    throw new Error('Invalid wallet name');
  }

  return sanitized;
}

function nightforgeBaseDir(): string {
  return join(os.homedir(), '.nightforge');
}

function nightforgeWalletsDir(): string {
  return join(nightforgeBaseDir(), 'wallets');
}

function nightforgeConfigPath(): string {
  return join(nightforgeBaseDir(), 'config.json');
}

function walletPathFromName(walletName: string): string {
  const safeName = sanitizeWalletName(walletName);
  return join(nightforgeWalletsDir(), `${safeName}.json`);
}

function loadWalletByName(walletName: string): StoredWalletData {
  const safeName = sanitizeWalletName(walletName);
  const path = walletPathFromName(safeName);
  if (!existsSync(path)) {
    throw new Error(`Wallet "${safeName}" not found in Nightforge storage`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as StoredWalletData;
}

function getActiveWalletNameFromNightforge(): string | undefined {
  const cfgPath = nightforgeConfigPath();
  if (!existsSync(cfgPath)) {
    return undefined;
  }

  try {
    const cfg = JSON.parse(readFileSync(cfgPath, 'utf8')) as { activeWallet?: string };
    return typeof cfg.activeWallet === 'string' ? cfg.activeWallet : undefined;
  } catch {
    return undefined;
  }
}

export function walletNameKey(alias: WalletAlias): string {
  return `wallet_${alias.toUpperCase()}`;
}

export function resolveWalletForAlias(
  envMap: Record<string, string>,
  alias: WalletAlias,
  walletCount: number,
): StoredWalletData {
  // Single-wallet mode: always use active Nightforge wallet.
  if (walletCount <= 1) {
    const active = getActiveWalletNameFromNightforge();
    if (!active) {
      throw new Error(
        'No active Nightforge wallet found. Run "npx nightforge wallet use <name>" or create a wallet first.',
      );
    }
    return loadWalletByName(active);
  }

  // Multi-wallet mode: resolve by env wallet name mapping.
  const key = walletNameKey(alias);
  const walletName = envMap[key];
  if (!walletName) {
    throw new Error(`Missing wallet mapping for ${alias}. Expected ${key} in .env`);
  }

  return loadWalletByName(walletName);
}

export function walletAliases(walletCount: number): WalletAlias[] {
  return Array.from({ length: walletCount }, (_, index) => `n${index + 1}` as WalletAlias);
}

export function ensureWorkspaceFiles(cwd = process.cwd()): MidnightWalletSyncConfig {
  const config = ensureConfig(cwd);
  if (!existsSync(envExamplePath(cwd))) {
    const lines = config.walletCount > 1
      ? walletAliases(config.walletCount).map((alias) => `${walletNameKey(alias)}=nightforge-wallet-name-here`)
      : ['# Single wallet mode uses active Nightforge wallet from ~/.nightforge/config.json'];
    writeFileSync(envExamplePath(cwd), `${lines.join('\n')}\n`, 'utf8');
  }
  if (!existsSync(envPath(cwd))) {
    writeFileSync(envPath(cwd), `# Copy values from .env.example into this file\n`, 'utf8');
  }
  mkdirSync(join(cwd, config.stateDir), { recursive: true });
  return config;
}

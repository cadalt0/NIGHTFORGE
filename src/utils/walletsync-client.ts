import * as fs from 'node:fs';
import * as path from 'node:path';
import { WalletStorage } from '../wallet/storage.js';

const NIGHT_TOKEN_TYPE = '0000000000000000000000000000000000000000000000000000000000000000';

interface WalletSyncConfigFile {
  port?: number;
  walletCount?: number;
}

interface WalletSyncSnapshotResponse {
  ok: boolean;
  alias: string;
  updatedAt: string;
  isSynced: boolean;
  shieldedBalances?: Record<string, string>;
  unshieldedBalances?: Record<string, string>;
  dustBalanceRaw?: string;
  shieldedAddress?: string;
  unshieldedAddress?: string;
  dustAddress?: string;
}

interface WalletSyncDeployResponse extends WalletSyncSnapshotResponse {}

interface WalletSyncDustResponse {
  ok: boolean;
  alias?: string;
  status?: 'already-has-dust' | 'no-eligible-utxos' | 'submitted' | 'syncing';
  dustBalanceRaw?: string;
  message?: string;
}

interface WalletSyncDeploySubmitResponse {
  ok: boolean;
  alias?: string;
  status?: 'deployed';
  contractAddress?: string;
  message?: string;
}

export interface WalletSyncBalance {
  alias: string;
  updatedAt: string;
  isSynced: boolean;
  nightBalance: bigint;
  dustBalance: bigint;
  unshieldedAddress?: string;
  shieldedAddress?: string;
  dustAddress?: string;
}

export type WalletSyncProbeResult =
  | { status: 'ok'; balance: WalletSyncBalance }
  | { status: 'syncing' }
  | { status: 'unavailable' }
  | { status: 'unmapped' };

export type WalletSyncDeployProbeResult =
  | { status: 'ok'; balance: WalletSyncBalance }
  | { status: 'syncing' }
  | { status: 'unavailable' }
  | { status: 'unmapped' };

export type WalletSyncDustConvertResult =
  | { status: 'ok'; alias: string; outcome: 'already-has-dust' | 'no-eligible-utxos' | 'submitted' | 'syncing'; dustBalance: bigint }
  | { status: 'ambiguous'; alias: string; message: string }
  | { status: 'syncing' }
  | { status: 'error'; message: string }
  | { status: 'unavailable' }
  | { status: 'unmapped' };

export type WalletSyncDustConfirmationResult =
  | { status: 'confirmed'; balance: WalletSyncBalance }
  | { status: 'syncing' }
  | { status: 'timeout' }
  | { status: 'unavailable' }
  | { status: 'unmapped' };

export type WalletSyncDeployResult =
  | { status: 'ok'; alias: string; contractAddress: string }
  | { status: 'syncing' }
  | { status: 'error'; message: string }
  | { status: 'unavailable' }
  | { status: 'unmapped' };

export interface WalletSyncDeployRequest {
  contractName: string;
  zkConfigPath: string;
  proofServerUrl: string;
  privateStateId?: string;
  initialPrivateState?: Record<string, unknown>;
  args?: unknown[];
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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function loadEnvMap(cwd: string): Record<string, string> {
  const envPath = path.join(cwd, '.env');
  if (!fs.existsSync(envPath)) {
    return {};
  }
  return parseEnvFile(fs.readFileSync(envPath, 'utf8'));
}

function loadWalletSyncConfig(cwd: string): { port: number; walletCount: number } {
  const cfgPath = path.join(cwd, 'midnightwalletsync.config.json');
  if (!fs.existsSync(cfgPath)) {
    return { port: 8787, walletCount: 1 };
  }

  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8')) as WalletSyncConfigFile;
    return {
      port: typeof cfg.port === 'number' ? cfg.port : 8787,
      walletCount: typeof cfg.walletCount === 'number' && cfg.walletCount > 0 ? Math.floor(cfg.walletCount) : 1,
    };
  } catch {
    return { port: 8787, walletCount: 1 };
  }
}

function walletAliasKey(index: number): string {
  return `wallet_N${index}`;
}

function resolveAliasForWallet(cwd: string, walletName?: string): string | null {
  const { walletCount } = loadWalletSyncConfig(cwd);
  const activeWallet = WalletStorage.getActiveWalletName();
  const requested = walletName ? WalletStorage.sanitizeName(walletName) : activeWallet;

  if (!requested) {
    return walletCount <= 1 ? 'n1' : null;
  }

  if (walletCount <= 1) {
    if (activeWallet && requested !== WalletStorage.sanitizeName(activeWallet)) {
      return null;
    }
    return 'n1';
  }

  const envMap = loadEnvMap(cwd);
  for (let i = 1; i <= walletCount; i++) {
    const value = envMap[walletAliasKey(i)];
    if (!value) {
      continue;
    }
    if (WalletStorage.sanitizeName(value) === requested) {
      return `n${i}`;
    }
  }

  return null;
}

function toBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number') return BigInt(value);
  if (typeof value === 'string' && value.trim().length > 0) return BigInt(value);
  return 0n;
}

export async function getWalletSyncBalance(walletName?: string, cwd: string = process.cwd()): Promise<WalletSyncBalance | null> {
  const result = await probeWalletSyncBalance(walletName, cwd);
  return result.status === 'ok' ? result.balance : null;
}

export async function probeWalletSyncBalance(
  walletName?: string,
  cwd: string = process.cwd(),
): Promise<WalletSyncProbeResult> {
  const { port } = loadWalletSyncConfig(cwd);
  const alias = resolveAliasForWallet(cwd, walletName);

  if (!alias) {
    return { status: 'unmapped' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(`http://127.0.0.1:${port}/balance/${alias}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'accept': 'application/json' },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 503) {
        return { status: 'syncing' };
      }
      return { status: 'unavailable' };
    }

    const body = (await response.json()) as WalletSyncSnapshotResponse;
    if (!body.ok || !body.isSynced) {
      return { status: 'syncing' };
    }

    const unshieldedNight = toBigInt(body.unshieldedBalances?.[NIGHT_TOKEN_TYPE]);
    const shieldedNight = toBigInt(body.shieldedBalances?.[NIGHT_TOKEN_TYPE]);
    const dustBalance = toBigInt(body.dustBalanceRaw);

    return {
      status: 'ok',
      balance: {
        alias,
        updatedAt: body.updatedAt,
        isSynced: body.isSynced,
        nightBalance: unshieldedNight + shieldedNight,
        dustBalance,
        unshieldedAddress: body.unshieldedAddress,
        shieldedAddress: body.shieldedAddress,
        dustAddress: body.dustAddress,
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function probeWalletSyncDeployState(
  walletName?: string,
  cwd: string = process.cwd(),
): Promise<WalletSyncDeployProbeResult> {
  const { port } = loadWalletSyncConfig(cwd);
  const alias = resolveAliasForWallet(cwd, walletName);

  if (!alias) {
    return { status: 'unmapped' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1500);

    const response = await fetch(`http://127.0.0.1:${port}/deploy/${alias}`, {
      method: 'GET',
      signal: controller.signal,
      headers: { 'accept': 'application/json' },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      if (response.status === 503) {
        return { status: 'syncing' };
      }
      return { status: 'unavailable' };
    }

    const body = (await response.json()) as WalletSyncDeployResponse;
    if (!body.ok || !body.isSynced) {
      return { status: 'syncing' };
    }

    const unshieldedNight = toBigInt(body.unshieldedBalances?.[NIGHT_TOKEN_TYPE]);
    const shieldedNight = toBigInt(body.shieldedBalances?.[NIGHT_TOKEN_TYPE]);
    const dustBalance = toBigInt(body.dustBalanceRaw);

    return {
      status: 'ok',
      balance: {
        alias,
        updatedAt: body.updatedAt,
        isSynced: body.isSynced,
        nightBalance: unshieldedNight + shieldedNight,
        dustBalance,
        unshieldedAddress: body.unshieldedAddress,
        shieldedAddress: body.shieldedAddress,
        dustAddress: body.dustAddress,
      },
    };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function convertDustViaWalletSync(
  walletName?: string,
  cwd: string = process.cwd(),
): Promise<WalletSyncDustConvertResult> {
  const { port } = loadWalletSyncConfig(cwd);
  const alias = resolveAliasForWallet(cwd, walletName);

  if (!alias) {
    return { status: 'unmapped' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(`http://127.0.0.1:${port}/dust/${alias}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const rawText = await response.text();
      let errorBody: WalletSyncDustResponse | null = null;
      try {
        errorBody = JSON.parse(rawText) as WalletSyncDustResponse;
      } catch {
        errorBody = null;
      }

      if (response.status === 503) {
        return { status: 'syncing' };
      }
      if (errorBody?.message) {
        if (/Transaction submission error/i.test(errorBody.message) || /Invalid Transaction/i.test(errorBody.message)) {
          return { status: 'ambiguous', alias, message: errorBody.message };
        }
        return { status: 'error', message: errorBody.message };
      }
      return { status: 'error', message: rawText.trim() || `HTTP ${response.status} from walletsync dust endpoint` };
    }

    const body = (await response.json()) as WalletSyncDustResponse;
    if (!body.ok || !body.alias || !body.status) {
      return { status: 'unavailable' };
    }

    if (body.status === 'syncing') {
      return { status: 'syncing' };
    }

    return {
      status: 'ok',
      alias: body.alias,
      outcome: body.status,
      dustBalance: toBigInt(body.dustBalanceRaw),
    };
  } catch {
    return { status: 'unavailable' };
  }
}

export async function waitForWalletSyncDustBalance(
  walletName?: string,
  cwd: string = process.cwd(),
  timeoutMs: number = 45000,
  pollMs: number = 3000,
): Promise<WalletSyncDustConfirmationResult> {
  const alias = resolveAliasForWallet(cwd, walletName);
  if (!alias) {
    return { status: 'unmapped' };
  }

  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const balanceResult = await probeWalletSyncBalance(walletName, cwd);
    if (balanceResult.status === 'ok') {
      if (balanceResult.balance.dustBalance > 0n) {
        return { status: 'confirmed', balance: balanceResult.balance };
      }
    } else if (balanceResult.status === 'unmapped') {
      return { status: 'unmapped' };
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  return { status: 'timeout' };
}

export async function deployViaWalletSync(
  request: WalletSyncDeployRequest,
  walletName?: string,
  cwd: string = process.cwd(),
): Promise<WalletSyncDeployResult> {
  const { port } = loadWalletSyncConfig(cwd);
  const alias = resolveAliasForWallet(cwd, walletName);

  if (!alias) {
    return { status: 'unmapped' };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120000);

    const response = await fetch(`http://127.0.0.1:${port}/deploy/${alias}`, {
      method: 'POST',
      signal: controller.signal,
      headers: { accept: 'application/json', 'content-type': 'application/json' },
      body: JSON.stringify(request),
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const rawText = await response.text();
      let errorBody: WalletSyncDeploySubmitResponse | null = null;
      try {
        errorBody = JSON.parse(rawText) as WalletSyncDeploySubmitResponse;
      } catch {
        errorBody = null;
      }

      if (response.status === 503) {
        return { status: 'syncing' };
      }

      if (errorBody?.message) {
        return { status: 'error', message: errorBody.message };
      }

      return { status: 'error', message: rawText.trim() || `HTTP ${response.status} from walletsync deploy endpoint` };
    }

    const body = (await response.json()) as WalletSyncDeploySubmitResponse;
    if (!body.ok || body.status !== 'deployed' || !body.alias || !body.contractAddress) {
      return { status: 'unavailable' };
    }

    return { status: 'ok', alias: body.alias, contractAddress: body.contractAddress };
  } catch {
    return { status: 'unavailable' };
  }
}

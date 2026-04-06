import { probeWalletSyncBalance } from '../utils/walletsync-client.js';

export type DustSyncState =
  | {
      kind: 'ready';
      alias: string;
      nightBalance: bigint;
      dustBalance: bigint;
    }
  | { kind: 'syncing' }
  | { kind: 'unavailable' }
  | { kind: 'unmapped' };

export async function getDustSyncState(walletName: string, cwd: string = process.cwd()): Promise<DustSyncState> {
  const result = await probeWalletSyncBalance(walletName, cwd);

  if (result.status === 'ok') {
    return {
      kind: 'ready',
      alias: result.balance.alias,
      nightBalance: result.balance.nightBalance,
      dustBalance: result.balance.dustBalance,
    };
  }

  if (result.status === 'syncing') {
    return { kind: 'syncing' };
  }

  if (result.status === 'unmapped') {
    return { kind: 'unmapped' };
  }

  return { kind: 'unavailable' };
}

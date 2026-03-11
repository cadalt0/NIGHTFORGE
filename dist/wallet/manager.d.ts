import { NetworkConfig } from '../types/index.js';
export interface WalletContext {
    wallet: any;
    shieldedSecretKeys: any;
    dustSecretKey: any;
    unshieldedKeystore: any;
    address: string;
    seed: string;
}
export declare class WalletManager {
    private static getModules;
    static deriveKeys(seed: string): Promise<any>;
    static create(seed: string, networkConfig: NetworkConfig): Promise<WalletContext>;
    static generateSeed(): Promise<string>;
    static waitForSync(wallet: any): Promise<void>;
    static waitForFunds(wallet: any): Promise<void>;
    static ensureDust(walletCtx: WalletContext): Promise<void>;
    static getBalance(wallet: any): Promise<bigint>;
}
//# sourceMappingURL=manager.d.ts.map
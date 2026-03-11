export interface StoredWalletData {
    name: string;
    address: string;
    seed: string;
    network: string;
    createdAt: string;
    updatedAt: string;
}
interface WalletStorageConfig {
    activeWallet?: string;
}
export declare class WalletStorage {
    static getBaseDir(): string;
    static getWalletsDir(): string;
    static getConfigPath(): string;
    static ensureInitialized(): void;
    static sanitizeName(name: string): string;
    static getAddressSuffix(address: string): string;
    static buildWalletName(baseName: string, address: string): string;
    static getWalletPath(walletName: string): string;
    static walletExists(walletName: string): boolean;
    static saveWallet(wallet: Omit<StoredWalletData, 'createdAt' | 'updatedAt'>): string;
    static listWalletNames(): string[];
    static loadWallet(walletName: string): StoredWalletData;
    static removeWallet(walletName: string): string;
    static getConfig(): WalletStorageConfig;
    static saveConfig(config: WalletStorageConfig): void;
    static getActiveWalletName(): string | undefined;
    static setActiveWallet(walletName: string): void;
    static getActiveWallet(): StoredWalletData | undefined;
}
export declare function generateReadableName(): Promise<string>;
export {};
//# sourceMappingURL=storage.d.ts.map
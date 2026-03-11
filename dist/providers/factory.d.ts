import { WalletContext } from '../wallet/manager.js';
import { NetworkConfig } from '../types/index.js';
export interface Providers {
    privateStateProvider: any;
    publicDataProvider: any;
    zkConfigProvider: any;
    proofProvider: any;
    walletProvider: any;
    midnightProvider: any;
}
export declare class ProviderFactory {
    private static getModules;
    static signTransactionIntents(tx: {
        intents?: Map<number, any>;
    }, signFn: (payload: Uint8Array) => any, proofMarker: 'proof' | 'pre-proof', ledger: any): void;
    static create(walletCtx: WalletContext, networkConfig: NetworkConfig, zkConfigPath: string, privateStateStoreName?: string): Promise<Providers>;
}
//# sourceMappingURL=factory.d.ts.map
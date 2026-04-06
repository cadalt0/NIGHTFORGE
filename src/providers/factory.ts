import * as Rx from 'rxjs';
import { WalletContext } from '../wallet/manager.js';
import { NetworkConfig } from '../types/index.js';
import { ensureProjectDeps, getProjectRoot, importProjectModule } from '../utils/midnight-loader.js';

export interface Providers {
  privateStateProvider: any;
  publicDataProvider: any;
  zkConfigProvider: any;
  proofProvider: any;
  walletProvider: any;
  midnightProvider: any;
}

export class ProviderFactory {
  private static getPrivateStoragePassword(): string {
    const fromEnv = process.env.MIDNIGHT_PRIVATE_STATE_PASSWORD?.trim();
    if (fromEnv && fromEnv.length >= 16) {
      return fromEnv;
    }
    return 'Nightforge#Sync2026';
  }

  private static async getModules() {
    const projectRoot = getProjectRoot();
    ensureProjectDeps(projectRoot);

    const ledger = await importProjectModule(projectRoot, 'ledger-v7');
    const { httpClientProofProvider } = await importProjectModule(projectRoot, 'midnight-js-http-client-proof-provider');
    const { indexerPublicDataProvider } = await importProjectModule(projectRoot, 'midnight-js-indexer-public-data-provider');
    const { levelPrivateStateProvider } = await importProjectModule(projectRoot, 'midnight-js-level-private-state-provider');
    const { NodeZkConfigProvider } = await importProjectModule(projectRoot, 'midnight-js-node-zk-config-provider');

    return {
      ledger,
      httpClientProofProvider,
      indexerPublicDataProvider,
      levelPrivateStateProvider,
      NodeZkConfigProvider,
    };
  }

  static signTransactionIntents(
    tx: { intents?: Map<number, any> },
    signFn: (payload: Uint8Array) => any,
    proofMarker: 'proof' | 'pre-proof',
    ledger: any
  ): void {
    if (!tx.intents || tx.intents.size === 0) return;

    for (const segment of tx.intents.keys()) {
      const intent = tx.intents.get(segment);
      if (!intent) continue;

      const cloned = ledger.Intent.deserialize('signature', proofMarker, 'pre-binding', intent.serialize());

      const sigData = cloned.signatureData(segment);
      const signature = signFn(sigData);

      if (cloned.fallibleUnshieldedOffer) {
        const sigs = cloned.fallibleUnshieldedOffer.inputs.map(
          (_: any, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature
        );
        cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
      }

      if (cloned.guaranteedUnshieldedOffer) {
        const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
          (_: any, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature
        );
        cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
      }

      tx.intents.set(segment, cloned);
    }
  }

  static async create(
    walletCtx: WalletContext,
    networkConfig: NetworkConfig,
    zkConfigPath: string,
    privateStateStoreName: string = 'default-state'
  ): Promise<Providers> {
    const modules = await this.getModules();
    const { ledger, httpClientProofProvider, indexerPublicDataProvider, levelPrivateStateProvider, NodeZkConfigProvider } = modules;

    const state: any = await Rx.firstValueFrom(
      walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced))
    );

    const walletProvider = {
      getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
      getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
      async balanceTx(tx: any, ttl?: Date) {
        const recipe = await walletCtx.wallet.balanceUnboundTransaction(
          tx,
          {
            shieldedSecretKeys: walletCtx.shieldedSecretKeys,
            dustSecretKey: walletCtx.dustSecretKey,
          },
          { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) }
        );

        const signFn = (payload: Uint8Array) => walletCtx.unshieldedKeystore.signData(payload);

        ProviderFactory.signTransactionIntents(recipe.baseTransaction, signFn, 'proof', ledger);
        if (recipe.balancingTransaction) {
          ProviderFactory.signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof', ledger);
        }

        return walletCtx.wallet.finalizeRecipe(recipe);
      },
      submitTx: (tx: any) => walletCtx.wallet.submitTransaction(tx) as any,
    };

    const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);

    return {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName,
        accountId: walletCtx.address,
        walletProvider,
        privateStoragePasswordProvider: async () => ProviderFactory.getPrivateStoragePassword(),
      }),
      publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS!),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
      walletProvider,
      midnightProvider: walletProvider,
    };
  }
}

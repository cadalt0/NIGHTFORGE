import * as Rx from 'rxjs';
import { ensureProjectDeps, getProjectRoot, importProjectModule } from '../utils/midnight-loader.js';
export class ProviderFactory {
    static async getModules() {
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
    static signTransactionIntents(tx, signFn, proofMarker, ledger) {
        if (!tx.intents || tx.intents.size === 0)
            return;
        for (const segment of tx.intents.keys()) {
            const intent = tx.intents.get(segment);
            if (!intent)
                continue;
            const cloned = ledger.Intent.deserialize('signature', proofMarker, 'pre-binding', intent.serialize());
            const sigData = cloned.signatureData(segment);
            const signature = signFn(sigData);
            if (cloned.fallibleUnshieldedOffer) {
                const sigs = cloned.fallibleUnshieldedOffer.inputs.map((_, i) => cloned.fallibleUnshieldedOffer.signatures.at(i) ?? signature);
                cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
            }
            if (cloned.guaranteedUnshieldedOffer) {
                const sigs = cloned.guaranteedUnshieldedOffer.inputs.map((_, i) => cloned.guaranteedUnshieldedOffer.signatures.at(i) ?? signature);
                cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
            }
            tx.intents.set(segment, cloned);
        }
    }
    static async create(walletCtx, networkConfig, zkConfigPath, privateStateStoreName = 'default-state') {
        const modules = await this.getModules();
        const { ledger, httpClientProofProvider, indexerPublicDataProvider, levelPrivateStateProvider, NodeZkConfigProvider } = modules;
        const state = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s) => s.isSynced)));
        const walletProvider = {
            getCoinPublicKey: () => state.shielded.coinPublicKey.toHexString(),
            getEncryptionPublicKey: () => state.shielded.encryptionPublicKey.toHexString(),
            async balanceTx(tx, ttl) {
                const recipe = await walletCtx.wallet.balanceUnboundTransaction(tx, {
                    shieldedSecretKeys: walletCtx.shieldedSecretKeys,
                    dustSecretKey: walletCtx.dustSecretKey,
                }, { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) });
                const signFn = (payload) => walletCtx.unshieldedKeystore.signData(payload);
                ProviderFactory.signTransactionIntents(recipe.baseTransaction, signFn, 'proof', ledger);
                if (recipe.balancingTransaction) {
                    ProviderFactory.signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof', ledger);
                }
                return walletCtx.wallet.finalizeRecipe(recipe);
            },
            submitTx: (tx) => walletCtx.wallet.submitTransaction(tx),
        };
        const zkConfigProvider = new NodeZkConfigProvider(zkConfigPath);
        return {
            privateStateProvider: levelPrivateStateProvider({
                privateStateStoreName,
                walletProvider,
            }),
            publicDataProvider: indexerPublicDataProvider(networkConfig.indexer, networkConfig.indexerWS),
            zkConfigProvider,
            proofProvider: httpClientProofProvider(networkConfig.proofServer, zkConfigProvider),
            walletProvider,
            midnightProvider: walletProvider,
        };
    }
}
//# sourceMappingURL=factory.js.map
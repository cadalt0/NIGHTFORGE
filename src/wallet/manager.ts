import { Buffer } from 'buffer';
import * as Rx from 'rxjs';
import { NetworkConfig } from '../types/index.js';
import { Logger } from '../utils/logger.js';
import { ensureProjectDeps, getProjectRoot, importProjectModule } from '../utils/midnight-loader.js';

export interface WalletContext {
  wallet: any;
  shieldedSecretKeys: any;
  dustSecretKey: any;
  unshieldedKeystore: any;
  address: string;
  seed: string;
}

export class WalletManager {
  private static async getModules() {
    const projectRoot = getProjectRoot();
    ensureProjectDeps(projectRoot);

    let ledger: any;
    try {
      // Prefer v7 because wallet flows below rely on symbols like
      // `ZswapSecretKeys` and `DustSecretKey` that are not available
      // in older ledger package variants.
      ledger = await importProjectModule(projectRoot, 'ledger-v7');
    } catch {
      ledger = await importProjectModule(projectRoot, 'ledger');
    }
    const { WalletFacade } = await importProjectModule(projectRoot, 'wallet-sdk-facade');
    const { DustWallet } = await importProjectModule(projectRoot, 'wallet-sdk-dust-wallet');
    const { HDWallet, Roles, generateRandomSeed } = await importProjectModule(projectRoot, 'wallet-sdk-hd');
    const { ShieldedWallet } = await importProjectModule(projectRoot, 'wallet-sdk-shielded');
    const {
      createKeystore,
      InMemoryTransactionHistoryStorage,
      PublicKey,
      UnshieldedWallet,
    } = await importProjectModule(projectRoot, 'wallet-sdk-unshielded-wallet');
    const { getNetworkId } = await importProjectModule(projectRoot, 'midnight-js-network-id');
    const { toHex } = await importProjectModule(projectRoot, 'midnight-js-utils');

    return {
      ledger,
      WalletFacade,
      DustWallet,
      HDWallet,
      Roles,
      generateRandomSeed,
      ShieldedWallet,
      createKeystore,
      InMemoryTransactionHistoryStorage,
      PublicKey,
      UnshieldedWallet,
      getNetworkId,
      toHex,
    };
  }

  static async deriveKeys(seed: string) {
    const { HDWallet, Roles } = await this.getModules();
    const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
    if (hdWallet.type !== 'seedOk') throw new Error('Invalid seed');

    const result = hdWallet.hdWallet
      .selectAccount(0)
      .selectRoles([Roles.Zswap, Roles.NightExternal, Roles.Dust])
      .deriveKeysAt(0);

    if (result.type !== 'keysDerived') throw new Error('Key derivation failed');
    hdWallet.hdWallet.clear();
    return result.keys;
  }

  static async create(seed: string, networkConfig: NetworkConfig): Promise<WalletContext> {
    const modules = await this.getModules();
    const {
      ledger,
      WalletFacade,
      DustWallet,
      Roles,
      ShieldedWallet,
      createKeystore,
      InMemoryTransactionHistoryStorage,
      PublicKey,
      UnshieldedWallet,
      getNetworkId,
    } = modules;

    const keys = await this.deriveKeys(seed);
    const networkId = getNetworkId();

    const shieldedSecretKeys = ledger.ZswapSecretKeys.fromSeed(keys[Roles.Zswap]);
    const dustSecretKey = ledger.DustSecretKey.fromSeed(keys[Roles.Dust]);
    const unshieldedKeystore = createKeystore(keys[Roles.NightExternal], networkId);

    const walletConfig = {
      networkId,
      indexerClientConnection: {
        indexerHttpUrl: networkConfig.indexer,
        indexerWsUrl: networkConfig.indexerWS || networkConfig.indexer.replace('http', 'ws') + '/ws',
      },
      provingServerUrl: new URL(networkConfig.proofServer),
      relayURL: new URL(networkConfig.node.replace(/^http/, 'ws')),
    };

    const shieldedWallet = ShieldedWallet(walletConfig).startWithSecretKeys(shieldedSecretKeys);
    const unshieldedWallet = UnshieldedWallet({
      networkId,
      indexerClientConnection: walletConfig.indexerClientConnection,
      txHistoryStorage: new InMemoryTransactionHistoryStorage(),
    }).startWithPublicKey(PublicKey.fromKeyStore(unshieldedKeystore));

    const dustWallet = DustWallet({
      ...walletConfig,
      costParameters: {
        additionalFeeOverhead: 300_000_000_000_000n,
        feeBlocksMargin: 5,
      },
    }).startWithSecretKey(dustSecretKey, ledger.LedgerParameters.initialParameters().dust);

    const wallet = new WalletFacade(shieldedWallet, unshieldedWallet, dustWallet);
    await wallet.start(shieldedSecretKeys, dustSecretKey);

    return {
      wallet,
      shieldedSecretKeys,
      dustSecretKey,
      unshieldedKeystore,
      address: unshieldedKeystore.getBech32Address().toString(),
      seed,
    };
  }

  static async generateSeed(): Promise<string> {
    const { generateRandomSeed, toHex } = await this.getModules();
    return toHex(Buffer.from(generateRandomSeed()));
  }

  static async waitForSync(wallet: any): Promise<void> {
    await Rx.firstValueFrom(wallet.state().pipe(Rx.throttleTime(5000), Rx.filter((s: any) => s.isSynced)));
  }

  static async waitForFunds(wallet: any): Promise<void> {
    const { ledger } = await this.getModules();
    Logger.info('Waiting for funds...');
    await Rx.firstValueFrom(
      wallet.state().pipe(
        Rx.throttleTime(10000),
        Rx.filter((s: any) => s.isSynced),
        Rx.map((s: any) => s.unshielded.balances[ledger.unshieldedToken().raw] ?? 0n),
        Rx.filter((b: bigint) => b > 0n)
      )
    );
    Logger.success('Funds received!');
  }

  static async ensureDust(walletCtx: WalletContext): Promise<void> {
    const state: any = await Rx.firstValueFrom(walletCtx.wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));

    if (state.dust.walletBalance(new Date()) === 0n) {
      const nightUtxos = state.unshielded.availableCoins.filter((c: any) => !c.meta?.registeredForDustGeneration);

      if (nightUtxos.length > 0) {
        Logger.info('Registering for DUST generation...');
        const recipe = await walletCtx.wallet.registerNightUtxosForDustGeneration(
          nightUtxos,
          walletCtx.unshieldedKeystore.getPublicKey(),
          (payload: Uint8Array) => walletCtx.unshieldedKeystore.signData(payload)
        );
        await walletCtx.wallet.submitTransaction(await walletCtx.wallet.finalizeRecipe(recipe));
      }

      Logger.info('Waiting for DUST tokens...');
      await Rx.firstValueFrom(
        walletCtx.wallet.state().pipe(
          Rx.throttleTime(5000),
          Rx.filter((s: any) => s.isSynced),
          Rx.filter((s: any) => s.dust.walletBalance(new Date()) > 0n)
        )
      );
      Logger.success('DUST tokens ready!');
    }
  }

  static async getBalance(wallet: any): Promise<bigint> {
    const { ledger } = await this.getModules();
    const state: any = await Rx.firstValueFrom(wallet.state().pipe(Rx.filter((s: any) => s.isSynced)));
    return state.unshielded.balances[ledger.unshieldedToken().raw] ?? 0n;
  }
}

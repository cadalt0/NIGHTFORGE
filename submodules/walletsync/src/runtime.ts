import { Buffer } from 'node:buffer';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as path from 'node:path';
import { MidnightBech32m, ShieldedAddress, UnshieldedAddress } from '@midnight-ntwrk/wallet-sdk-address-format';
import type { MidnightWalletSyncConfig, WalletAlias, WalletSnapshot } from './types.js';
import { loadEnvMap, resolveWalletForAlias, walletAliases } from './config.js';
import { saveSnapshot, snapshotPath } from './snapshot.js';

function formatBalances(balances: Record<string, bigint>): Record<string, string> {
  return Object.fromEntries(Object.entries(balances).map(([token, amount]) => [token, amount.toString()]));
}

function formatAddress(networkId: string, address: unknown): string {
  try {
    if (address && typeof address === 'object') {
      return MidnightBech32m.encode(networkId, address as never).asString();
    }
  } catch {
    // fall through
  }
  return String(address);
}

function snapshotFromState(alias: WalletAlias, networkId: string, state: any): WalletSnapshot {
  return {
    alias,
    updatedAt: new Date().toISOString(),
    isSynced: Boolean(state.isSynced),
    shieldedBalances: formatBalances(state.shielded.balances),
    unshieldedBalances: formatBalances(state.unshielded.balances),
    dustBalanceRaw: state.dust.balance(new Date()).toString(),
    shieldedAddress: formatAddress(networkId, state.shielded.address),
    unshieldedAddress: formatAddress(networkId, state.unshielded.address),
    dustAddress: formatAddress(networkId, state.dust.address),
  };
}

function readDustBalance(state: any): bigint {
  const dust = state?.dust;
  if (!dust) {
    return 0n;
  }

  if (typeof dust.walletBalance === 'function') {
    return dust.walletBalance(new Date()) as bigint;
  }

  if (typeof dust.balance === 'function') {
    return dust.balance(new Date()) as bigint;
  }

  return 0n;
}

function createLogger() {
  return {
    info: (...args: unknown[]) => console.log('[info]', ...args),
    debug: (...args: unknown[]) => console.debug('[debug]', ...args),
    error: (...args: unknown[]) => console.error('[error]', ...args),
  } as const;
}

async function readRequestBody(req: IncomingMessage): Promise<string> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function importProjectModule(cwd: string, packageName: string): Promise<any> {
  const specifier = `@midnight-ntwrk/${packageName}`;

  const packageRoot = path.join(cwd, 'node_modules', '@midnight-ntwrk', packageName);
  const packageJsonPath = path.join(packageRoot, 'package.json');
  const candidates: string[] = [];

  if (existsSync(packageJsonPath)) {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as any;
    const exportsField = pkg?.exports;
    const exportRoot = exportsField?.['.'] ?? exportsField;
    if (typeof exportRoot === 'string') {
      candidates.push(path.join(packageRoot, exportRoot));
    } else if (exportRoot && typeof exportRoot === 'object') {
      if (typeof exportRoot.import === 'string') candidates.push(path.join(packageRoot, exportRoot.import));
      if (typeof exportRoot.node === 'string') candidates.push(path.join(packageRoot, exportRoot.node));
      if (typeof exportRoot.default === 'string') candidates.push(path.join(packageRoot, exportRoot.default));
      if (typeof exportRoot.require === 'string') candidates.push(path.join(packageRoot, exportRoot.require));
    }

    if (typeof pkg?.module === 'string') candidates.push(path.join(packageRoot, pkg.module));
    if (typeof pkg?.main === 'string') candidates.push(path.join(packageRoot, pkg.main));
  }

  candidates.push(
    path.join(packageRoot, 'index.mjs'),
    path.join(packageRoot, 'index.js'),
    path.join(packageRoot, 'index.cjs'),
  );

  const modulePath = candidates.find((c) => existsSync(c));
  if (!modulePath) {
    throw new Error(`Cannot resolve module entry for ${specifier}`);
  }

  return import(pathToFileURL(modulePath).href);
}

function signTransactionIntents(
  tx: { intents?: Map<number, any> },
  signFn: (payload: Uint8Array) => any,
  proofMarker: 'proof' | 'pre-proof',
  ledger: any,
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
        (_: any, i: number) => cloned.fallibleUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.fallibleUnshieldedOffer = cloned.fallibleUnshieldedOffer.addSignatures(sigs);
    }

    if (cloned.guaranteedUnshieldedOffer) {
      const sigs = cloned.guaranteedUnshieldedOffer.inputs.map(
        (_: any, i: number) => cloned.guaranteedUnshieldedOffer!.signatures.at(i) ?? signature,
      );
      cloned.guaranteedUnshieldedOffer = cloned.guaranteedUnshieldedOffer.addSignatures(sigs);
    }

    tx.intents.set(segment, cloned);
  }
}

function getPrivateStoragePassword(): string {
  const fromEnv = process.env.MIDNIGHT_PRIVATE_STATE_PASSWORD?.trim();
  if (fromEnv && fromEnv.length >= 16) {
    return fromEnv;
  }
  return 'Nightforge#Sync2026';
}

function resolveLocalProofServerUrl(fallback: string): string {
  const statusPath = path.join(process.env.HOME ?? '', '.nightforge', 'proof-server-status.json');
  if (!existsSync(statusPath)) {
    return fallback;
  }

  try {
    const status = JSON.parse(readFileSync(statusPath, 'utf8')) as {
      running?: boolean;
      state?: string;
      url?: string;
    };
    if (status.running && status.state === 'ready' && typeof status.url === 'string' && status.url.trim()) {
      return status.url.trim();
    }
  } catch {
    // Use fallback if status cannot be read.
  }

  return fallback;
}

type DeployRequestBody = {
  contractName: string;
  zkConfigPath: string;
  proofServerUrl: string;
  privateStateId?: string;
  initialPrivateState?: Record<string, unknown>;
  args?: unknown[];
};

type WalletServiceSdk = {
  ledgerRuntime: any;
  hdWalletModule: any;
  keystoreModule: any;
};

class WalletService {
  readonly wallet: any;
  private latestState: any | null = null;

  private constructor(
    private readonly logger: ReturnType<typeof createLogger>,
    private readonly cwd: string,
    private readonly projectRoot: string,
    private readonly config: MidnightWalletSyncConfig,
    private readonly networkId: string,
    wallet: any,
    private readonly shieldedSecretKeys: any,
    private readonly dustSecretKey: any,
    private readonly unshieldedKeystore: any,
    private readonly seed: string,
    private readonly shieldedSeedBytes: Uint8Array,
    private readonly dustSeedBytes: Uint8Array,
    private readonly sdk: WalletServiceSdk,
  ) {
    this.wallet = wallet;
  }

  static async build(
    logger: ReturnType<typeof createLogger>,
    cwd: string,
    config: MidnightWalletSyncConfig,
    seed: string,
    walletName: string,
  ) {
    const projectRoot = cwd;
    const proofServerUrl = resolveLocalProofServerUrl(config.proofServer);
    const [ledgerRuntime, testKitModule, hdWalletModule, keystoreModule] = await Promise.all([
      importProjectModule(projectRoot, 'ledger-v8'),
      importProjectModule(projectRoot, 'testkit-js'),
      importProjectModule(projectRoot, 'wallet-sdk-hd'),
      importProjectModule(projectRoot, 'wallet-sdk-unshielded-wallet'),
    ]);

    const { LedgerParameters, ZswapSecretKeys, DustSecretKey } = ledgerRuntime;
    const { FluentWalletBuilder } = testKitModule;
    const { HDWallet, Roles } = hdWalletModule;
    const { createKeystore } = keystoreModule;

    const environment = {
      walletNetworkId: config.network,
      networkId: config.network,
      indexer: config.indexer,
      indexerWS: config.indexerWS,
      node: config.node,
      nodeWS: config.nodeWS,
      proofServer: proofServerUrl,
    };
    const dustOptions = {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 1_000n,
      feeBlocksMargin: 5,
    };
    const walletFacadeBuilder = FluentWalletBuilder.forEnvironment(environment).withDustOptions(dustOptions);
    const buildResult = await walletFacadeBuilder.withSeed(seed).buildWithoutStarting();
    const { wallet, seeds } = buildResult as {
      wallet: any;
      seeds: { masterSeed: string; shielded: Uint8Array; dust: Uint8Array };
    };
    logger.info(`Wallet built for wallet name: ${walletName}`);
    const hdWallet = HDWallet.fromSeed(Buffer.from(seed, 'hex'));
    if (hdWallet.type !== 'seedOk') {
      throw new Error('Invalid seed for wallet sync runtime');
    }

    const derived = hdWallet.hdWallet.selectAccount(0).selectRoles([Roles.NightExternal]).deriveKeysAt(0);
    if (derived.type !== 'keysDerived') {
      hdWallet.hdWallet.clear();
      throw new Error('Failed to derive NightExternal key for dust registration');
    }

    const unshieldedKeystore = createKeystore(derived.keys[Roles.NightExternal], environment.networkId);
    hdWallet.hdWallet.clear();

    return new WalletService(
      logger,
      cwd,
      projectRoot,
      config,
      environment.networkId,
      wallet,
      ZswapSecretKeys.fromSeed(seeds.shielded),
      DustSecretKey.fromSeed(seeds.dust),
      unshieldedKeystore,
      seed,
      seeds.shielded,
      seeds.dust,
      { ledgerRuntime, hdWalletModule, keystoreModule },
    );
  }

  async start(): Promise<void> {
    this.logger.info('Starting wallet...');
    await this.wallet.start(this.shieldedSecretKeys, this.dustSecretKey);
  }

  async stop(): Promise<void> {
    await this.wallet.stop();
  }

  async waitSynced(): Promise<any> {
    return this.wallet.waitForSyncedState();
  }

  async convertDustFromSyncedState(): Promise<
    | { status: 'already-has-dust'; dustBalanceRaw: string }
    | { status: 'no-eligible-utxos'; dustBalanceRaw: string }
    | { status: 'submitted'; dustBalanceRaw: string }
    | { status: 'syncing'; dustBalanceRaw: string }
  > {
    const syncedState: any = this.latestState;
    if (!syncedState || !syncedState.isSynced) {
      return { status: 'syncing', dustBalanceRaw: '0' };
    }

    const currentDust = readDustBalance(syncedState);
    if (currentDust > 0n) {
      return { status: 'already-has-dust', dustBalanceRaw: currentDust.toString() };
    }

    const nightUtxos = (syncedState.unshielded?.availableCoins ?? []).filter(
      (coin: any) => !coin?.meta?.registeredForDustGeneration,
    );

    if (nightUtxos.length === 0) {
      return { status: 'no-eligible-utxos', dustBalanceRaw: currentDust.toString() };
    }

    const recipe = await this.wallet.registerNightUtxosForDustGeneration(
      nightUtxos,
      this.unshieldedKeystore.getPublicKey(),
      (payload: Uint8Array) => this.unshieldedKeystore.signData(payload),
    );

    const finalized = await this.wallet.finalizeRecipe(recipe as never);
    try {
      await this.wallet.submitTransaction(finalized as never);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      // Node may return an "Invalid Transaction" after a race/duplicate submission,
      // while the registration is already accepted and later visible in synced state.
      // Treat this known case as non-fatal and let caller confirm by polling balance.
      if (!/Custom error:\s*173|Invalid Transaction|Transaction submission error/i.test(message)) {
        throw error;
      }
      this.logger.info(`Dust submit returned non-fatal node response: ${message}`);
      return { status: 'submitted', dustBalanceRaw: readDustBalance(syncedState).toString() };
    }

    // Return immediately after successful submit. DUST balance may take time to reflect
    // in snapshots/indexer, so caller should poll balance after a short delay.
    return { status: 'submitted', dustBalanceRaw: currentDust.toString() };
  }

  async deployContractFromSyncedState(request: DeployRequestBody): Promise<{ contractAddress: string }> {
    const syncedState: any = this.latestState;
    if (!syncedState || !syncedState.isSynced) {
      throw new Error('Wallet is not fully synced yet.');
    }

    const requestedProjectRoot = path.resolve(request.zkConfigPath, '..', '..', '..');
    if (requestedProjectRoot !== this.projectRoot) {
      throw new Error('zkConfigPath project root does not match walletsync runtime root. Restart sync from the target project directory.');
    }

    const projectRoot = this.projectRoot;
    const contractPath = path.join(request.zkConfigPath, 'contract', 'index.js');
    if (!existsSync(contractPath)) {
      throw new Error(`Contract not compiled at ${contractPath}`);
    }

    const [{ deployContract }, { CompiledContract }, { httpClientProofProvider }, { indexerPublicDataProvider }, { levelPrivateStateProvider }, { NodeZkConfigProvider }, { setNetworkId }] = await Promise.all([
      importProjectModule(projectRoot, 'midnight-js-contracts'),
      importProjectModule(projectRoot, 'compact-js'),
      importProjectModule(projectRoot, 'midnight-js-http-client-proof-provider'),
      importProjectModule(projectRoot, 'midnight-js-indexer-public-data-provider'),
      importProjectModule(projectRoot, 'midnight-js-level-private-state-provider'),
      importProjectModule(projectRoot, 'midnight-js-node-zk-config-provider'),
      importProjectModule(projectRoot, 'midnight-js-network-id'),
    ]);

    setNetworkId(this.config.network as any);

    // Recreate wallet secret keys using the project's ledger-v8 classes
    // This is critical to avoid cross-module class instance mismatches
    const { ledgerRuntime, hdWalletModule, keystoreModule } = this.sdk;
    const { createKeystore: projectCreateKeystore } = keystoreModule;
    const { ZswapSecretKeys: ProjectZswapSecretKeys, DustSecretKey: ProjectDustSecretKey } = ledgerRuntime;

    const projectShieldedSecretKeys = ProjectZswapSecretKeys.fromSeed(this.shieldedSeedBytes);
    const projectDustSecretKey = ProjectDustSecretKey.fromSeed(this.dustSeedBytes);

    // Derive unshielded keystore for signing using HDWallet
    const { HDWallet: ProjectHDWallet, Roles: ProjectRoles } = hdWalletModule;

    const projectHdWalletResult = ProjectHDWallet.fromSeed(Buffer.from(this.seed, 'hex'));
    if (projectHdWalletResult.type !== 'seedOk') {
      throw new Error('Failed to create HDWallet from seed');
    }

    const projectHdWallet = projectHdWalletResult.hdWallet;
    const derivedKeysResult = projectHdWallet.selectAccount(0).selectRoles([ProjectRoles.NightExternal]).deriveKeysAt(0);
    if (derivedKeysResult.type !== 'keysDerived') {
      projectHdWallet.clear();
      throw new Error('Failed to derive NightExternal key');
    }
    const projectUnshieldedKeystore = projectCreateKeystore(derivedKeysResult.keys[ProjectRoles.NightExternal], this.config.network);
    projectHdWallet.clear();

    const contractModule = await import(pathToFileURL(contractPath).href);
    const compiledContract = CompiledContract.make(request.contractName, contractModule.Contract).pipe(
      CompiledContract.withVacantWitnesses,
      CompiledContract.withCompiledFileAssets(request.zkConfigPath),
    );

    const wallet = this.wallet;
    const indexer = this.config.indexer;
    const indexerWS = this.config.indexerWS;
    const accountId = formatAddress(this.networkId, syncedState.unshielded.address);

    const walletProvider = {
      getCoinPublicKey: () => syncedState.shielded.coinPublicKey.toHexString(),
      getEncryptionPublicKey: () => syncedState.shielded.encryptionPublicKey.toHexString(),
      async balanceTx(tx: any, ttl?: Date): Promise<any> {
        const recipe: any = await wallet.balanceUnboundTransaction(
          tx,
          {
            shieldedSecretKeys: projectShieldedSecretKeys,
            dustSecretKey: projectDustSecretKey,
          },
          { ttl: ttl ?? new Date(Date.now() + 30 * 60 * 1000) },
        );

        const signFn = (payload: Uint8Array) => projectUnshieldedKeystore.signData(payload);
        signTransactionIntents(recipe.baseTransaction, signFn, 'proof', ledgerRuntime);
        if (recipe.balancingTransaction) {
          signTransactionIntents(recipe.balancingTransaction, signFn, 'pre-proof', ledgerRuntime);
        }

        return wallet.finalizeRecipe(recipe);
      },
      submitTx: (tx: any) => wallet.submitTransaction(tx) as any,
    };

    const zkConfigProvider = new NodeZkConfigProvider(request.zkConfigPath);
    const providers = {
      privateStateProvider: levelPrivateStateProvider({
        privateStateStoreName: `${request.contractName}-state`,
        accountId,
        walletProvider,
        privateStoragePasswordProvider: async () => getPrivateStoragePassword(),
      }),
      publicDataProvider: indexerPublicDataProvider(indexer, indexerWS),
      zkConfigProvider,
      proofProvider: httpClientProofProvider(request.proofServerUrl, zkConfigProvider),
      walletProvider,
      midnightProvider: walletProvider,
    };

    const deployed = await deployContract(providers, {
      compiledContract: compiledContract as any,
      args: Array.isArray(request.args) ? request.args : [],
      privateStateId: request.privateStateId ?? `${request.contractName}State`,
      initialPrivateState: request.initialPrivateState ?? {},
    });

    const contractAddress = deployed?.deployTxData?.public?.contractAddress;
    if (!contractAddress) {
      throw new Error('Deployment completed but contract address is missing in result.');
    }

    return { contractAddress: String(contractAddress) };
  }

  subscribeSnapshots(
    alias: WalletAlias,
    stateDir: string,
    onSnapshot?: (snapshot: WalletSnapshot) => void,
  ): void {
    this.wallet.state().subscribe((state: any) => {
      this.latestState = state;
      const snapshot = snapshotFromState(alias, this.networkId, state);
      saveSnapshot(this.cwd, stateDir, snapshot);
      onSnapshot?.(snapshot);
    });
  }
}

export class WalletSyncRuntime {
  private readonly logger = createLogger();
  private readonly envMap: Record<string, string>;
  private readonly aliases: WalletAlias[];
  private readonly services = new Map<WalletAlias, WalletService>();

  constructor(
    private readonly cwd: string,
    readonly config: MidnightWalletSyncConfig,
  ) {
    this.envMap = loadEnvMap(cwd);
    this.aliases = walletAliases(config.walletCount);
  }

  static fromWorkspace(cwd: string, config: MidnightWalletSyncConfig) {
    return new WalletSyncRuntime(cwd, config);
  }

  private walletFor(alias: WalletAlias) {
    const wallet = resolveWalletForAlias(this.envMap, alias, this.config.walletCount);
    return wallet;
  }

  async startAll(onSnapshot?: (alias: WalletAlias, snapshot: WalletSnapshot) => void): Promise<void> {
    for (const alias of this.aliases) {
      const wallet = this.walletFor(alias);
      const service = await WalletService.build(this.logger, this.cwd, this.config, wallet.seed, wallet.name);
      this.services.set(alias, service);
      service.subscribeSnapshots(alias, this.config.stateDir, (snapshot) => onSnapshot?.(alias, snapshot));
    }
    await Promise.all(
      Array.from(this.services.entries()).map(async ([alias, service]) => {
        await service.start();
        await service.waitSynced();
        this.logger.info(`Wallet ${alias} synced`);
      }),
    );
  }

  async stopAll(): Promise<void> {
    await Promise.all(Array.from(this.services.values()).map((service) => service.stop()));
  }

  readSnapshot(alias: WalletAlias): WalletSnapshot | null {
    const path = snapshotPath(this.cwd, this.config.stateDir, alias);
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as WalletSnapshot;
    } catch {
      return null;
    }
  }

  listAliases(): WalletAlias[] {
    return [...this.aliases];
  }

  get port(): number {
    return this.config.port;
  }

  createServer() {
    return createServer(async (req: IncomingMessage, res: ServerResponse) => {
      const requestUrl = new URL(req.url ?? '/', `http://127.0.0.1:${this.port}`);
      const pathParts = requestUrl.pathname.split('/').filter(Boolean);

      if (requestUrl.pathname === '/health') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true }));
        return;
      }

      if (requestUrl.pathname === '/wallets') {
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, wallets: this.listAliases() }, null, 2));
        return;
      }

      if (pathParts[0] === 'balance' && pathParts.length === 2) {
        const alias = pathParts[1] as WalletAlias;
        const snapshot = this.readSnapshot(alias);
        if (!snapshot) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, message: `No snapshot for ${alias}` }));
          return;
        }
        if (!snapshot.isSynced) {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, message: 'Wallet not fully synced yet.' }));
          return;
        }
        res.writeHead(200, { 'content-type': 'application/json' });
        res.end(JSON.stringify({ ok: true, ...snapshot }, null, 2));
        return;
      }

      if (pathParts[0] === 'deploy' && pathParts.length === 2) {
        const alias = pathParts[1] as WalletAlias;
        const service = this.services.get(alias);
        if (!service) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, message: `Unknown wallet alias ${alias}` }));
          return;
        }

        const snapshot = this.readSnapshot(alias);
        if (!snapshot) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, message: `No snapshot for ${alias}` }));
          return;
        }
        if (!snapshot.isSynced) {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, message: 'Wallet not fully synced yet.' }));
          return;
        }

        if (req.method === 'GET') {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: true, ...snapshot }, null, 2));
          return;
        }

        if (req.method !== 'POST') {
          res.writeHead(405, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, message: 'Use GET /deploy/:alias or POST /deploy/:alias' }));
          return;
        }

        try {
          const rawBody = await readRequestBody(req);
          const parsed = JSON.parse(rawBody || '{}') as Partial<DeployRequestBody>;

          if (!parsed.contractName || !parsed.zkConfigPath || !parsed.proofServerUrl) {
            res.writeHead(400, { 'content-type': 'application/json' });
            res.end(JSON.stringify({ ok: false, message: 'contractName, zkConfigPath, and proofServerUrl are required' }));
            return;
          }

          const result = await service.deployContractFromSyncedState({
            contractName: parsed.contractName,
            zkConfigPath: parsed.zkConfigPath,
            proofServerUrl: parsed.proofServerUrl,
            privateStateId: parsed.privateStateId,
            initialPrivateState: parsed.initialPrivateState,
            args: parsed.args,
          });

          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: true, alias, status: 'deployed', contractAddress: result.contractAddress }, null, 2));
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          this.logger.error(`DEPLOY endpoint failure for ${alias}: ${message}`);
          if (stack) {
            this.logger.error(stack);
          }
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, message }, null, 2));
          return;
        }
      }

      if (req.method === 'POST' && pathParts[0] === 'dust' && pathParts.length === 2) {
        const alias = pathParts[1] as WalletAlias;
        const service = this.services.get(alias);
        if (!service) {
          res.writeHead(404, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, message: `Unknown wallet alias ${alias}` }));
          return;
        }

        const snapshot = this.readSnapshot(alias);
        if (!snapshot || !snapshot.isSynced) {
          res.writeHead(503, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, message: 'Wallet not fully synced yet.' }));
          return;
        }

        try {
          const result = await service.convertDustFromSyncedState();
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: true, alias, ...result }, null, 2));
          return;
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;
          this.logger.error(`DUST endpoint failure for ${alias}: ${message}`);
          if (stack) {
            this.logger.error(stack);
          }
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ ok: false, message }, null, 2));
          return;
        }
      }

      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, message: 'Use /health, /wallets, /balance/:alias, POST /deploy/:alias, or POST /dust/:alias' }));
    });
  }
}

import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { FileSystem } from '../utils/file-system.js';
export class WalletStorage {
    static getBaseDir() {
        return path.join(os.homedir(), '.nightforge');
    }
    static getWalletsDir() {
        return path.join(this.getBaseDir(), 'wallets');
    }
    static getConfigPath() {
        return path.join(this.getBaseDir(), 'config.json');
    }
    static ensureInitialized() {
        FileSystem.createDir(this.getWalletsDir());
        if (!FileSystem.exists(this.getConfigPath())) {
            FileSystem.writeJSON(this.getConfigPath(), {});
        }
    }
    static sanitizeName(name) {
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
    static getAddressSuffix(address) {
        const compact = address.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
        const suffix = compact.slice(-5);
        if (!suffix) {
            throw new Error('Invalid wallet address');
        }
        return suffix;
    }
    static buildWalletName(baseName, address) {
        const base = this.sanitizeName(baseName);
        const suffix = this.getAddressSuffix(address);
        return `${base}-${suffix}`;
    }
    static getWalletPath(walletName) {
        const safeName = this.sanitizeName(walletName);
        return path.join(this.getWalletsDir(), `${safeName}.json`);
    }
    static walletExists(walletName) {
        return FileSystem.exists(this.getWalletPath(walletName));
    }
    static saveWallet(wallet) {
        this.ensureInitialized();
        const walletPath = this.getWalletPath(wallet.name);
        if (this.walletExists(wallet.name)) {
            throw new Error(`Wallet "${wallet.name}" already exists. Choose a different name.`);
        }
        const now = new Date().toISOString();
        FileSystem.writeJSON(walletPath, {
            ...wallet,
            createdAt: now,
            updatedAt: now,
        });
        try {
            fs.chmodSync(walletPath, 0o600);
        }
        catch {
            // Ignore chmod errors on platforms/filesystems that do not support POSIX perms.
        }
        return walletPath;
    }
    static listWalletNames() {
        this.ensureInitialized();
        const files = fs.readdirSync(this.getWalletsDir(), { withFileTypes: true });
        return files
            .filter((f) => f.isFile() && f.name.endsWith('.json'))
            .map((f) => f.name.replace(/\.json$/, ''))
            .sort();
    }
    static loadWallet(walletName) {
        const walletPath = this.getWalletPath(walletName);
        if (!FileSystem.exists(walletPath)) {
            throw new Error(`Wallet "${walletName}" not found`);
        }
        return FileSystem.readJSON(walletPath);
    }
    static removeWallet(walletName) {
        const safeName = this.sanitizeName(walletName);
        const walletPath = this.getWalletPath(safeName);
        if (!FileSystem.exists(walletPath)) {
            throw new Error(`Wallet "${safeName}" not found`);
        }
        fs.unlinkSync(walletPath);
        const config = this.getConfig();
        if (config.activeWallet === safeName) {
            delete config.activeWallet;
            this.saveConfig(config);
        }
        return walletPath;
    }
    static getConfig() {
        this.ensureInitialized();
        return FileSystem.readJSON(this.getConfigPath());
    }
    static saveConfig(config) {
        this.ensureInitialized();
        FileSystem.writeJSON(this.getConfigPath(), config);
    }
    static getActiveWalletName() {
        const config = this.getConfig();
        return config.activeWallet;
    }
    static setActiveWallet(walletName) {
        const safeName = this.sanitizeName(walletName);
        if (!this.walletExists(safeName)) {
            throw new Error(`Wallet "${safeName}" not found`);
        }
        this.saveConfig({
            ...this.getConfig(),
            activeWallet: safeName,
        });
    }
    static getActiveWallet() {
        const active = this.getActiveWalletName();
        if (!active) {
            return undefined;
        }
        if (!this.walletExists(active)) {
            return undefined;
        }
        return this.loadWallet(active);
    }
}
export async function generateReadableName() {
    const mod = await import('@cadalt/random-name-generator');
    const generateName = mod.generateName || mod.default?.generateName;
    if (typeof generateName !== 'function') {
        throw new Error('Failed to load random name generator');
    }
    const generated = generateName();
    if (typeof generated !== 'string' || !generated.trim()) {
        throw new Error('Random name generator returned an invalid name');
    }
    return WalletStorage.sanitizeName(generated);
}
//# sourceMappingURL=storage.js.map
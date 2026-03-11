import * as path from 'node:path';
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { FileSystem } from './file-system.js';
export function getProjectRoot() {
    return FileSystem.findProjectRoot() || process.cwd();
}
export function ensureProjectDeps(projectRoot) {
    const sdkRoot = path.join(projectRoot, 'node_modules', '@midnight-ntwrk');
    if (!FileSystem.exists(sdkRoot)) {
        throw new Error('Midnight SDK packages are not installed in this project. Run: npm install');
    }
}
export async function importProjectModule(projectRoot, packageName) {
    const specifier = `@midnight-ntwrk/${packageName}`;
    const packageRoot = path.join(projectRoot, 'node_modules', '@midnight-ntwrk', packageName);
    const packageJsonPath = path.join(packageRoot, 'package.json');
    const candidates = [];
    if (fs.existsSync(packageJsonPath)) {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
        const exportsField = pkg?.exports;
        const exportRoot = exportsField?.['.'] ?? exportsField;
        if (typeof exportRoot === 'string') {
            candidates.push(path.join(packageRoot, exportRoot));
        }
        else if (exportRoot && typeof exportRoot === 'object') {
            if (typeof exportRoot.import === 'string') {
                candidates.push(path.join(packageRoot, exportRoot.import));
            }
            if (typeof exportRoot.node === 'string') {
                candidates.push(path.join(packageRoot, exportRoot.node));
            }
            if (typeof exportRoot.default === 'string') {
                candidates.push(path.join(packageRoot, exportRoot.default));
            }
            if (typeof exportRoot.require === 'string') {
                candidates.push(path.join(packageRoot, exportRoot.require));
            }
            if (typeof exportRoot.browser === 'string') {
                candidates.push(path.join(packageRoot, exportRoot.browser));
            }
        }
        if (typeof pkg?.module === 'string') {
            candidates.push(path.join(packageRoot, pkg.module));
        }
        if (typeof pkg?.main === 'string') {
            candidates.push(path.join(packageRoot, pkg.main));
        }
    }
    candidates.push(path.join(packageRoot, 'index.mjs'), path.join(packageRoot, 'index.js'), path.join(packageRoot, 'index.cjs'), path.join(packageRoot, `${packageName}.mjs`), path.join(packageRoot, `${packageName}.js`), path.join(packageRoot, `${packageName}.cjs`), path.join(packageRoot, 'midnight_ledger_wasm_fs.js'), path.join(packageRoot, 'dist', 'index.mjs'), path.join(packageRoot, 'dist', 'index.js'), path.join(packageRoot, 'dist', 'index.cjs'));
    if (fs.existsSync(packageRoot)) {
        try {
            const jsFiles = fs
                .readdirSync(packageRoot)
                .filter((name) => /\.(mjs|cjs|js)$/.test(name))
                .filter((name) => !name.endsWith('.d.ts'));
            const preferred = jsFiles.find((name) => name.includes('_fs'))
                || jsFiles.find((name) => !name.includes('_bg'))
                || jsFiles[0];
            if (preferred) {
                candidates.push(path.join(packageRoot, preferred));
            }
        }
        catch {
            // Ignore directory read issues and continue with known candidates.
        }
    }
    const modulePath = candidates.find((c) => fs.existsSync(c));
    if (!modulePath) {
        throw new Error(`Cannot resolve module entry for ${specifier}`);
    }
    return import(pathToFileURL(modulePath).href);
}
//# sourceMappingURL=midnight-loader.js.map
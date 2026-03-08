import * as path from 'node:path';
import * as fs from 'node:fs';
import { pathToFileURL } from 'node:url';
import { FileSystem } from './file-system.js';

export function getProjectRoot(): string {
  return FileSystem.findProjectRoot() || process.cwd();
}

export function ensureProjectDeps(projectRoot: string): void {
  const sdkRoot = path.join(projectRoot, 'node_modules', '@midnight-ntwrk');
  if (!FileSystem.exists(sdkRoot)) {
    throw new Error('Midnight SDK packages are not installed in this project. Run: npm install');
  }
}

export async function importProjectModule(
  projectRoot: string,
  packageName: string
): Promise<any> {
  const specifier = `@midnight-ntwrk/${packageName}`;

  const packageRoot = path.join(
    projectRoot,
    'node_modules',
    '@midnight-ntwrk',
    packageName
  );

  const packageJsonPath = path.join(packageRoot, 'package.json');

  const candidates: string[] = [];

  if (fs.existsSync(packageJsonPath)) {
    const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8')) as any;

    const exportsField = pkg?.exports;
    const exportRoot = exportsField?.['.'] ?? exportsField;
    if (typeof exportRoot === 'string') {
      candidates.push(path.join(packageRoot, exportRoot));
    } else if (exportRoot && typeof exportRoot === 'object') {
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

  candidates.push(
    path.join(packageRoot, 'dist', 'index.mjs'),
    path.join(packageRoot, 'dist', 'index.js'),
    path.join(packageRoot, 'dist', 'index.cjs')
  );

  const modulePath = candidates.find((c) => fs.existsSync(c));

  if (!modulePath) {
    throw new Error(`Cannot resolve module entry for ${specifier}`);
  }

  return import(pathToFileURL(modulePath).href);
}

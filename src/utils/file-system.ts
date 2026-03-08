import * as fs from 'node:fs';
import * as path from 'node:path';

export class FileSystem {
  static exists(filePath: string): boolean {
    return fs.existsSync(filePath);
  }

  static readFile(filePath: string): string {
    return fs.readFileSync(filePath, 'utf-8');
  }

  static writeFile(filePath: string, content: string): void {
    const dir = path.dirname(filePath);
    if (!this.exists(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  static readJSON<T = any>(filePath: string): T {
    const content = this.readFile(filePath);
    return JSON.parse(content);
  }

  static writeJSON(filePath: string, data: any, pretty = true): void {
    const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    this.writeFile(filePath, content);
  }

  static createDir(dirPath: string): void {
    if (!this.exists(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  static copyFile(source: string, destination: string): void {
    const dir = path.dirname(destination);
    if (!this.exists(dir)) {
      this.createDir(dir);
    }
    fs.copyFileSync(source, destination);
  }

  static findProjectRoot(startDir: string = process.cwd()): string | null {
    let currentDir = startDir;
    
    while (currentDir !== path.parse(currentDir).root) {
      if (
        this.exists(path.join(currentDir, 'midnight.config.ts')) ||
        this.exists(path.join(currentDir, 'midnight.config.js'))
      ) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    return null;
  }
}

import * as fs from 'node:fs';
import * as path from 'node:path';
export class FileSystem {
    static exists(filePath) {
        return fs.existsSync(filePath);
    }
    static readFile(filePath) {
        return fs.readFileSync(filePath, 'utf-8');
    }
    static writeFile(filePath, content) {
        const dir = path.dirname(filePath);
        if (!this.exists(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, content, 'utf-8');
    }
    static readJSON(filePath) {
        const content = this.readFile(filePath);
        return JSON.parse(content);
    }
    static writeJSON(filePath, data, pretty = true) {
        const content = pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
        this.writeFile(filePath, content);
    }
    static createDir(dirPath) {
        if (!this.exists(dirPath)) {
            fs.mkdirSync(dirPath, { recursive: true });
        }
    }
    static copyFile(source, destination) {
        const dir = path.dirname(destination);
        if (!this.exists(dir)) {
            this.createDir(dir);
        }
        fs.copyFileSync(source, destination);
    }
    static findProjectRoot(startDir = process.cwd()) {
        let currentDir = startDir;
        while (currentDir !== path.parse(currentDir).root) {
            if (this.exists(path.join(currentDir, 'midnight.config.ts')) ||
                this.exists(path.join(currentDir, 'midnight.config.js'))) {
                return currentDir;
            }
            currentDir = path.dirname(currentDir);
        }
        return null;
    }
}
//# sourceMappingURL=file-system.js.map
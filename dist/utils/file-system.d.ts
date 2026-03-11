export declare class FileSystem {
    static exists(filePath: string): boolean;
    static readFile(filePath: string): string;
    static writeFile(filePath: string, content: string): void;
    static readJSON<T = any>(filePath: string): T;
    static writeJSON(filePath: string, data: any, pretty?: boolean): void;
    static createDir(dirPath: string): void;
    static copyFile(source: string, destination: string): void;
    static findProjectRoot(startDir?: string): string | null;
}
//# sourceMappingURL=file-system.d.ts.map
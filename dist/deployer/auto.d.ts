interface AutoDeployOptions {
    network: string;
    wallet?: string;
}
export declare class AutoDeployer {
    static deploy(contractName: string, options: AutoDeployOptions): Promise<void>;
    private static checkBalances;
    private static createWallet;
    private static waitForFunds;
    private static convertToDust;
    private static waitForProofServer;
    private static formatBalance;
    private static sleep;
}
export {};
//# sourceMappingURL=auto.d.ts.map
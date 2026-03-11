export declare function startSpinner(text: string): import("ora").Ora;
export declare function withSpinner<T>(text: string, fn: () => Promise<T>, successText?: string): Promise<T>;
declare const _default: {
    startSpinner: typeof startSpinner;
    withSpinner: typeof withSpinner;
};
export default _default;
//# sourceMappingURL=cli-spinner.d.ts.map
/** Laisse respirer la boucle d’événements (évite gel Obsidian sur gros documents). */
export declare function yieldToMainThread(): Promise<void>;
export declare function withAsyncTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T>;
//# sourceMappingURL=asyncYield.d.ts.map
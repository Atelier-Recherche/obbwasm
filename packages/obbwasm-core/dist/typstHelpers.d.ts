/** Supprime BOM UTF-8 et caractères zero-width qui cassent le tokenizer Typst dans les sources virtuelles. */
export declare function sanitizeTypstCompilerSource(source: string): string;
export declare function overrideTypstLet(source: string, key: string, valueExpr: string): string;
export declare function firstDiagnosticMessage(compiled: unknown): string;
//# sourceMappingURL=typstHelpers.d.ts.map
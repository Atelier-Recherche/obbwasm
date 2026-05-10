import type { BookLayoutState } from "./bookOptions/types.js";
import { type ObbWasmAssetLoader } from "./assetLoader.js";
export type PandocConvertFn = (options: Record<string, unknown>, stdin: string | null, files: Record<string, string | Blob>) => Promise<{
    stdout: string;
    stderr: string;
    warnings: unknown[];
    files: Record<string, string | Blob>;
    mediaFiles: Record<string, string | Blob>;
}>;
export declare function pandocMarkdownToTypst(params: {
    convert: PandocConvertFn;
    /** Pandoc `from` ; défaut `markdown` (plugin Obsidian). */
    sourceFormat?: string;
    sourceText: string;
    sourceBlob?: Blob | null;
    sourceFileName?: string;
    titleFallback: string;
    bibliography?: {
        name: string;
        blob: Blob;
    } | null;
}): Promise<{
    typst: string;
    stderr: string;
}>;
export declare function compileTypstBookToPdf(params: {
    compiler: import("@myriaddreamin/typst.ts/compiler").TypstCompiler;
    loader: ObbWasmAssetLoader;
    templateMainSource: string;
    generatedTypst: string;
    bookLayout: BookLayoutState;
    meta: {
        title: string;
        author: string;
        publisher: string;
    };
}): Promise<{
    pdf: Uint8Array | null;
    diagnostics: unknown;
    stderrLog: string;
}>;
//# sourceMappingURL=pandocMarkdown.d.ts.map
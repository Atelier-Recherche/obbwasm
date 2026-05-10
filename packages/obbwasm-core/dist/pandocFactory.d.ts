import type { PandocConvertFn } from "./pandocMarkdown.js";
/** Charge dynamiquement pandoc.wasm (plugin Obsidian, chemins disque, etc.). */
export declare function createPandocConvertFromWasmBuffer(loadWasm: () => Promise<ArrayBuffer>): Promise<PandocConvertFn>;
//# sourceMappingURL=pandocFactory.d.ts.map
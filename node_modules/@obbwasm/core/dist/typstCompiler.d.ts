import type { TypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import type { ObbWasmAssetLoader } from "./assetLoader.js";
export declare function createTypstCompiler(params: {
    getTypstWasmBuffer: () => Promise<ArrayBuffer>;
    loader: ObbWasmAssetLoader;
    onFontProgress?: (loaded: number, total: number) => void;
}): Promise<TypstCompiler>;
/** Réinitialise l’état global du loader wasm Typst (tests / hot reload). */
export declare function resetTypstWasmImporterRegistration(): void;
//# sourceMappingURL=typstCompiler.d.ts.map
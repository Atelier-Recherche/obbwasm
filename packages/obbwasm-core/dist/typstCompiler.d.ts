import type { TypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import { loadFonts } from "@myriaddreamin/typst.ts/options.init";
import type { ObbWasmAssetLoader } from "./assetLoader.js";
/** 2e argument de {@link loadFonts} (Typst upstream). {@code { assets: false }} désactive les polices CDN. */
export type LoadFontsUpstreamOptions = NonNullable<Parameters<typeof loadFonts>[1]>;
export declare function createTypstCompiler(params: {
    getTypstWasmBuffer: () => Promise<ArrayBuffer>;
    loader: ObbWasmAssetLoader;
    onFontProgress?: (loaded: number, total: number) => void;
    /**
     * Sous environnements où le bundler préfixe CDN + `node-fetch-cache` pour les polices
     * cassent (ex. Obsidian desktop), passez `{ assets: ["text"], fetcher: … }` avec un `fetch`
     * compatible (ex. `requestUrl` côté Obsidian). Sans option : `assets: ["text"]` et `globalThis.fetch` si défini.
     */
    loadFontsOptions?: LoadFontsUpstreamOptions;
}): Promise<TypstCompiler>;
/** Réinitialise l’état global du loader wasm Typst (tests / hot reload). L’importeur est réinjecté au prochain createTypstCompiler. */
export declare function resetTypstWasmImporterRegistration(): void;
//# sourceMappingURL=typstCompiler.d.ts.map
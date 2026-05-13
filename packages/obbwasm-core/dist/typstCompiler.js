import { loadFonts } from "@myriaddreamin/typst.ts/options.init";
import { setImportWasmModule } from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler.mjs";
export async function createTypstCompiler(params) {
    const { getTypstWasmBuffer, loader, onFontProgress, loadFontsOptions } = params;
    const { createTypstCompiler: mk } = await import("@myriaddreamin/typst.ts/compiler");
    /*
     * Charger le .wasm depuis la RAM. Sous Electron, `typst.ts` importe par défaut le paquet
     * `@myriaddreamin/typst-ts-web-compiler` qui pointe vers `wasm-pack-shim.mjs` et ré-enregistre
     * `import("fs")` dans `compiler.init()` — d’où l’alias bundler vers `typst_ts_web_compiler.mjs`
     * (plugin esbuild + site Vite).
     */
    setImportWasmModule(async () => getTypstWasmBuffer());
    const compiler = mk();
    const fontItems = await loader.listFontEntries();
    const fontBuffers = [];
    const n = Math.max(fontItems.length, 1);
    for (let i = 0; i < fontItems.length; i++) {
        const item = fontItems[i];
        onFontProgress?.(i + 1, fontItems.length);
        try {
            const buf = await loader.fetchFontBuffer(item.path);
            fontBuffers.push(new Uint8Array(buf));
        }
        catch {
            /* skip bad font */
        }
    }
    onFontProgress?.(fontItems.length, n);
    /** Polices « text » distantes (Pandoc → Typst utilise New Computer Modern, DejaVu Mono, etc.). */
    const fontLoadOpts = { ...(loadFontsOptions ?? {}) };
    if (fontLoadOpts.assets === undefined) {
        fontLoadOpts.assets = ["text"];
    }
    if (fontLoadOpts.assets !== false && fontLoadOpts.fetcher === undefined) {
        const f = globalThis.fetch;
        if (typeof f === "function") {
            fontLoadOpts.fetcher = f.bind(globalThis);
        }
    }
    await compiler.init({
        beforeBuild: [loadFonts(fontBuffers, fontLoadOpts)],
    });
    return compiler;
}
/** Réinitialise l’état global du loader wasm Typst (tests / hot reload). L’importeur est réinjecté au prochain createTypstCompiler. */
export function resetTypstWasmImporterRegistration() {
    /* gardé pour compat API ; le shim est écrasé à chaque createTypstCompiler. */
}
//# sourceMappingURL=typstCompiler.js.map
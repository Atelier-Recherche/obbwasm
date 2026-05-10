import { setImportWasmModule } from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler.mjs";
let typstWasmImporterRegistered = false;
export async function createTypstCompiler(params) {
    const { getTypstWasmBuffer, loader, onFontProgress } = params;
    if (!typstWasmImporterRegistered) {
        setImportWasmModule(async () => getTypstWasmBuffer());
        typstWasmImporterRegistered = true;
    }
    const { createTypstCompiler: mk } = await import("@myriaddreamin/typst.ts/compiler");
    const { loadFonts } = await import("@myriaddreamin/typst.ts/options.init");
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
    await compiler.init({
        beforeBuild: [loadFonts(fontBuffers)],
    });
    return compiler;
}
/** Réinitialise l’état global du loader wasm Typst (tests / hot reload). */
export function resetTypstWasmImporterRegistration() {
    typstWasmImporterRegistered = false;
}
//# sourceMappingURL=typstCompiler.js.map
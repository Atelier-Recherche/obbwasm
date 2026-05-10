/** Charge dynamiquement pandoc.wasm (plugin Obsidian, chemins disque, etc.). */
export async function createPandocConvertFromWasmBuffer(loadWasm) {
    const { createPandocInstance } = await import("pandoc-wasm/src/core.js");
    const wasm = await loadWasm();
    const inst = await createPandocInstance(wasm);
    return inst.convert;
}
//# sourceMappingURL=pandocFactory.js.map
import type { PandocConvertFn } from "./pandocMarkdown.js";

/** Charge dynamiquement pandoc.wasm (plugin Obsidian, chemins disque, etc.). */
export async function createPandocConvertFromWasmBuffer(loadWasm: () => Promise<ArrayBuffer>): Promise<PandocConvertFn> {
  const { createPandocInstance } = await import("pandoc-wasm/src/core.js");
  const wasm = await loadWasm();
  const inst = await createPandocInstance(wasm);
  return inst.convert;
}

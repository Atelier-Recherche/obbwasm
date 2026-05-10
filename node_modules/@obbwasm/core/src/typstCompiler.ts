import type { TypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import { setImportWasmModule } from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler.mjs";
import type { ObbWasmAssetLoader } from "./assetLoader.js";

let typstWasmImporterRegistered = false;

export async function createTypstCompiler(params: {
  getTypstWasmBuffer: () => Promise<ArrayBuffer>;
  loader: ObbWasmAssetLoader;
  onFontProgress?: (loaded: number, total: number) => void;
}): Promise<TypstCompiler> {
  const { getTypstWasmBuffer, loader, onFontProgress } = params;

  if (!typstWasmImporterRegistered) {
    setImportWasmModule(async () => getTypstWasmBuffer());
    typstWasmImporterRegistered = true;
  }

  const { createTypstCompiler: mk } = await import("@myriaddreamin/typst.ts/compiler");
  const { loadFonts } = await import("@myriaddreamin/typst.ts/options.init");
  const compiler = mk();

  const fontItems = await loader.listFontEntries();
  const fontBuffers: Uint8Array[] = [];
  const n = Math.max(fontItems.length, 1);
  for (let i = 0; i < fontItems.length; i++) {
    const item = fontItems[i];
    onFontProgress?.(i + 1, fontItems.length);
    try {
      const buf = await loader.fetchFontBuffer(item.path);
      fontBuffers.push(new Uint8Array(buf));
    } catch {
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
export function resetTypstWasmImporterRegistration(): void {
  typstWasmImporterRegistered = false;
}

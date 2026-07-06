import type { TypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import type { ObbWasmAssetLoader } from "./assetLoader.js";

/** Expose les polices du bundle dans l’ombre Typst (`/typeset/fonts/…`) en plus de loadFonts. */
export async function mountTypstFontShadows(
  compiler: TypstCompiler,
  loader: ObbWasmAssetLoader,
): Promise<void> {
  const items = await loader.listFontEntries();
  for (const item of items) {
    try {
      const buf = await loader.fetchFontBuffer(item.path);
      const norm = item.path.replace(/\\/g, "/").replace(/^\/+/, "");
      if (!norm) continue;
      compiler.mapShadow(`/${norm}`, new Uint8Array(buf));
    } catch {
      /* ignore */
    }
  }
}

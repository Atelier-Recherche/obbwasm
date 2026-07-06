import type { TypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import type { ObbWasmAssetLoader } from "./assetLoader.js";
/** Expose les polices du bundle dans l’ombre Typst (`/typeset/fonts/…`) en plus de loadFonts. */
export declare function mountTypstFontShadows(compiler: TypstCompiler, loader: ObbWasmAssetLoader): Promise<void>;
//# sourceMappingURL=typstFontShadow.d.ts.map
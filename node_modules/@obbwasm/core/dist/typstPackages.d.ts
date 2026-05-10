import type { TypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import type { ObbWasmAssetLoader } from "./assetLoader.js";
/** Monte les paquets Typst listés par le loader (ZIP). */
export declare function mountTypstPackagesFromLoader(compiler: TypstCompiler, loader: ObbWasmAssetLoader): Promise<void>;
/** Monte les paquets Typst (ZIP) dans le shadow FS du compilateur. */
export declare function mountTypstPackageZips(compiler: TypstCompiler, packages: Array<{
    id: string;
}>, fetchZip: (id: string) => Promise<ArrayBuffer | null>): Promise<void>;
//# sourceMappingURL=typstPackages.d.ts.map
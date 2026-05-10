import type { TypstCompiler } from "@myriaddreamin/typst.ts/compiler";
import JSZip from "jszip";
import type { ObbWasmAssetLoader } from "./assetLoader.js";

/** Monte les paquets Typst listés par le loader (ZIP). */
export async function mountTypstPackagesFromLoader(compiler: TypstCompiler, loader: ObbWasmAssetLoader): Promise<void> {
  const pkgs = (await loader.listTypstPackages?.()) ?? [];
  if (!pkgs.length || !loader.fetchTypstPackageZip) return;
  await mountTypstPackageZips(compiler, pkgs, (id) => loader.fetchTypstPackageZip!(id));
}

/** Monte les paquets Typst (ZIP) dans le shadow FS du compilateur. */
export async function mountTypstPackageZips(
  compiler: TypstCompiler,
  packages: Array<{ id: string }>,
  fetchZip: (id: string) => Promise<ArrayBuffer | null>,
): Promise<void> {
  for (const pkg of packages) {
    const buf = await fetchZip(pkg.id);
    if (!buf) continue;
    const zip = await JSZip.loadAsync(buf);
    for (const path of Object.keys(zip.files)) {
      const entry = zip.files[path];
      if (!entry || entry.dir) continue;
      const u8 = await entry.async("uint8array");
      const vfs = path.startsWith("/") ? path : `/${path}`;
      compiler.mapShadow(vfs, u8);
    }
  }
}

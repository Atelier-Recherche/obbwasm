import type JSZip from "jszip";

const TYPST_MARKER = "/typeset/typst/";

/**
 * Depuis une archive GitHub, copie uniquement `typeset/typst/**` (pas oldlatex, etc.)
 * vers `destRoot/typeset/typst/...`.
 */
export async function extractTypesetFromGithubRepoZip(
  zip: JSZip,
  destRoot: string,
  fs: typeof import("node:fs"),
  path: typeof import("node:path"),
): Promise<number> {
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  if (names.length === 0) return 0;
  let prefix: string | null = null;
  for (const name of names) {
    const idx = name.indexOf(TYPST_MARKER);
    if (idx >= 0) {
      prefix = name.slice(0, idx + TYPST_MARKER.length);
      break;
    }
  }
  if (!prefix) return 0;
  let n = 0;
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    const relInsideTypst = name.slice(prefix.length);
    if (!relInsideTypst) continue;
    const outPath = path.join(destRoot, "typeset", "typst", relInsideTypst);
    const parent = path.dirname(outPath);
    if (!fs.existsSync(parent)) fs.mkdirSync(parent, { recursive: true });
    const entry = zip.files[name];
    if (!entry || entry.dir) continue;
    const buf = await entry.async("nodebuffer");
    fs.writeFileSync(outPath, buf);
    n++;
  }
  return n;
}

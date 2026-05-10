import type JSZip from "jszip";

/**
 * Depuis une archive GitHub (`repo-main/typeset/...`), copie tout `typeset/**`
 * dans `destRoot` de façon à obtenir `destRoot/typeset/typst/...`.
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
    const idx = name.indexOf("/typeset/");
    if (idx >= 0) {
      prefix = name.slice(0, idx + "/typeset/".length);
      break;
    }
  }
  if (!prefix) return 0;
  let n = 0;
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    const rel = name.slice(prefix.length);
    if (!rel) continue;
    const outPath = path.join(destRoot, rel);
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

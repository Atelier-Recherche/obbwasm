import type JSZip from "jszip";

const LEGACY_TYPESET_TYST = "/typeset/typst/";
const TYPESET_SLASH = "/typeset/";
const FLAT_FIRST_SEG = new Set(["layout", "shared", "cover", "impose", "fonts", "presets"]);

function findTypesetExtractRoot(names: string[]): { prefix: string; legacyTypst: boolean } | null {
  for (const name of names) {
    const i = name.indexOf(LEGACY_TYPESET_TYST);
    if (i >= 0) {
      return { prefix: name.slice(0, i + LEGACY_TYPESET_TYST.length), legacyTypst: true };
    }
  }
  for (const name of names) {
    const j = name.indexOf(TYPESET_SLASH);
    if (j < 0) continue;
    const rest = name.slice(j + TYPESET_SLASH.length);
    const seg = rest.split("/")[0] ?? "";
    if (!seg || seg === "oldlatex") continue;
    if (FLAT_FIRST_SEG.has(seg) || seg.startsWith("README")) {
      return { prefix: name.slice(0, j + TYPESET_SLASH.length), legacyTypst: false };
    }
  }
  return null;
}

/**
 * Depuis une archive GitHub, copie `typeset/**` utile vers `destRoot/typeset/...`
 * (structure plate : layout, shared, fonts, …). Accepte encore les archives avec
 * `typeset/typst/**` et les aplatit.
 */
export async function extractTypesetFromGithubRepoZip(
  zip: JSZip,
  destRoot: string,
  fs: typeof import("node:fs"),
  path: typeof import("node:path"),
): Promise<number> {
  const names = Object.keys(zip.files).filter((n) => !zip.files[n].dir);
  if (names.length === 0) return 0;
  const found = findTypesetExtractRoot(names);
  if (!found) return 0;
  const { prefix, legacyTypst } = found;
  let n = 0;
  for (const name of names) {
    if (!name.startsWith(prefix)) continue;
    let rel = name.slice(prefix.length);
    if (!rel) continue;
    if (legacyTypst) {
      /* déjà relatif à typeset/typst/ → on écrit sous destRoot/typeset/<rel> */
    } else {
      /* relatif à typeset/ */
    }
    const outPath = path.join(destRoot, "typeset", ...rel.split("/").filter(Boolean));
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

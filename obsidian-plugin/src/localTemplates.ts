import { displayTitle, parseTemplateMeta } from "@obbwasm/core";
import type { TemplatesManifestV1 } from "./templatesManifest.js";

/**
 * Fusionne le manifest avec les `.typ` présents sous `typeset/layout` ou `typeset/typst/layout`
 * (ids `local:<nom-fichier>`).
 */
export function mergeManifestWithLocalDiscovered(
  base: TemplatesManifestV1,
  bundleRoot: string,
  fs: typeof import("node:fs"),
  path: typeof import("node:path"),
): TemplatesManifestV1 {
  const seen = new Set(base.templates.map((t) => t.mainTypPath.replace(/\\/g, "/")));
  const extra: TemplatesManifestV1["templates"] = [];
  const layoutDirs = [
    path.join(bundleRoot, "typeset", "layout"),
    path.join(bundleRoot, "typeset", "typst", "layout"),
  ];
  for (const dir of layoutDirs) {
    if (!fs.existsSync(dir)) continue;
    let entries: import("node:fs").Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      if (!ent.isFile() || !ent.name.toLowerCase().endsWith(".typ")) continue;
      const abs = path.join(dir, ent.name);
      const mainTypPath = path.relative(bundleRoot, abs).replace(/\\/g, "/");
      if (seen.has(mainTypPath)) continue;
      seen.add(mainTypPath);
      let src = "";
      try {
        src = fs.readFileSync(abs, "utf8");
      } catch {
        continue;
      }
      const meta = parseTemplateMeta(src);
      const id = `local:${ent.name.replace(/\.typ$/i, "")}`;
      extra.push({
        id,
        name: displayTitle(meta, ent.name),
        mainTypPath,
        variables: {},
      });
    }
  }
  return { ...base, templates: [...base.templates, ...extra] };
}

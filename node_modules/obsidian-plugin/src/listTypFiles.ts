import { nodeFs, nodePath } from "./platform.js";

/** Chemins projet relatifs `typeset/typst/cover/*.typ` ou `impose`. */
export function listTypFiles(bundleRoot: string, kind: "cover" | "impose"): string[] {
  const fs = nodeFs();
  const path = nodePath();
  const dir = path.join(bundleRoot, "typeset", "typst", kind);
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop()!;
    let entries: import("node:fs").Dirent[];
    try {
      entries = fs.readdirSync(d, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const ent of entries) {
      const full = path.join(d, ent.name);
      if (ent.isDirectory()) stack.push(full);
      else if (ent.isFile() && ent.name.toLowerCase().endsWith(".typ")) {
        const rel = path.relative(bundleRoot, full).replace(/\\/g, "/");
        out.push(rel);
      }
    }
  }
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

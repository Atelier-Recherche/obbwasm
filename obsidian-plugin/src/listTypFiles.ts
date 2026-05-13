import { tryNodeFs, tryNodePath } from "./platform.js";

/** Chemins projet relatifs `typeset/cover/*.typ` ou `impose`. */
export function listTypFiles(bundleRoot: string, kind: "cover" | "impose"): string[] {
  const fs = tryNodeFs();
  const path = tryNodePath();
  if (!fs || !path) return [];
  const flat = path.join(bundleRoot, "typeset", kind);
  const legacy = path.join(bundleRoot, "typeset", "typst", kind);
  const dir = fs.existsSync(flat) ? flat : legacy;
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

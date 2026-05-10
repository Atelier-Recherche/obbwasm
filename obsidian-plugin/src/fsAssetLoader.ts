import type { ObbWasmAssetLoader } from "@obbwasm/core";
import { nodeFs, nodePath } from "./platform.js";

function walkFontFiles(
  bundleRoot: string,
  dir: string,
  fs: typeof import("node:fs"),
  path: typeof import("node:path"),
): Array<{ path: string; name: string }> {
  const out: Array<{ path: string; name: string }> = [];
  if (!fs.existsSync(dir)) return out;
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
      else if (ent.isFile()) {
        const ext = path.extname(ent.name).toLowerCase();
        if (ext === ".ttf" || ext === ".otf") {
          const rel = path.relative(bundleRoot, full).replace(/\\/g, "/");
          out.push({ path: rel, name: ent.name });
        }
      }
    }
  }
  return out;
}

/** Racine du bundle décompressé contenant `typeset/` (chemins relatifs comme dans le dépôt). */
export function createFsAssetLoader(templatesRoot: string): ObbWasmAssetLoader {
  const fs = nodeFs();
  const path = nodePath();
  const root = templatesRoot;

  return {
    async fetchTextFile(projectRelativePath: string): Promise<string | null> {
      const full = path.join(root, projectRelativePath.replace(/^\/+/, ""));
      if (!fs.existsSync(full)) return null;
      try {
        return fs.readFileSync(full, "utf8");
      } catch {
        return null;
      }
    },
    async listFontEntries() {
      const fontsDir = path.join(root, "typeset", "typst", "fonts");
      return walkFontFiles(root, fontsDir, fs, path);
    },
    async fetchFontBuffer(relPath: string): Promise<ArrayBuffer> {
      const full = path.join(root, relPath.replace(/^\/+/, ""));
      const buf = fs.readFileSync(full);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    },
  };
}

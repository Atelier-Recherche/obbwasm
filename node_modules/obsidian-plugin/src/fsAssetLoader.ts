import type { ObbWasmAssetLoader } from "@obbwasm/core";
import JSZip from "jszip";
import { tryNodeFs, tryNodePath } from "./platform.js";

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

function resolveFontsDir(root: string, path: typeof import("node:path"), fs: typeof import("node:fs")): string {
  const flat = path.join(root, "typeset", "fonts");
  const legacy = path.join(root, "typeset", "typst", "fonts");
  if (fs.existsSync(flat)) return flat;
  return legacy;
}

async function zipPackageDirToBuffer(
  absPkgDir: string,
  fs: typeof import("node:fs"),
  path: typeof import("node:path"),
): Promise<ArrayBuffer | null> {
  if (!fs.existsSync(absPkgDir)) return null;
  const zip = new JSZip();
  const walk = (dir: string, prefix: string) => {
    let entries: import("node:fs").Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      const zr = prefix ? `${prefix}/${ent.name}` : ent.name;
      if (ent.isDirectory()) walk(abs, zr);
      else zip.file(zr, fs.readFileSync(abs));
    }
  };
  walk(absPkgDir, "");
  return await zip.generateAsync({ type: "arraybuffer" });
}

/** Racine du bundle décompressé contenant `typeset/` (chemins relatifs comme dans le dépôt). */
export function createFsAssetLoader(templatesRoot: string): ObbWasmAssetLoader {
  const fs = tryNodeFs();
  const path = tryNodePath();
  const root = templatesRoot;

  if (!fs || !path) {
    return {
      async fetchTextFile() {
        return null;
      },
      async listFontEntries() {
        return [];
      },
      async fetchFontBuffer() {
        return new ArrayBuffer(0);
      },
      async listTypstPackages() {
        return [];
      },
      async fetchTypstPackageZip() {
        return null;
      },
    };
  }

  const packagesRoot = path.join(root, "typeset", "typst-packages");

  return {
    async fetchTextFile(projectRelativePath: string): Promise<string | null> {
      const rel = projectRelativePath.replace(/^\/+/, "");
      const candidates = [rel];
      if (rel.startsWith("typeset/shared/")) {
        candidates.push(rel.replace("typeset/shared/", "typeset/typst/shared/"));
      }
      for (const c of candidates) {
        const full = path.join(root, c);
        if (!fs.existsSync(full)) continue;
        try {
          return fs.readFileSync(full, "utf8");
        } catch {
          /* ignore */
        }
      }
      return null;
    },
    async listFontEntries() {
      const fontsDir = resolveFontsDir(root, path, fs);
      return walkFontFiles(root, fontsDir, fs, path);
    },
    async fetchFontBuffer(relPath: string): Promise<ArrayBuffer> {
      const full = path.join(root, relPath.replace(/^\/+/, ""));
      const buf = fs.readFileSync(full);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    },
    async listTypstPackages() {
      if (!fs.existsSync(packagesRoot)) return [];
      const out: Array<{ id: string }> = [];
      for (const name of fs.readdirSync(packagesRoot)) {
        const full = path.join(packagesRoot, name);
        if (fs.statSync(full).isDirectory()) out.push({ id: name });
      }
      out.sort((a, b) => a.id.localeCompare(b.id));
      return out;
    },
    async fetchTypstPackageZip(id: string): Promise<ArrayBuffer | null> {
      if (!id || id.includes("..") || id.includes("/") || id.includes("\\")) return null;
      const full = path.join(packagesRoot, id);
      return zipPackageDirToBuffer(full, fs, path);
    },
  };
}

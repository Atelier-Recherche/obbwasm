/** Décode base64 → octets (navigateur / Node). */
function base64ToBytes(b64: string): Uint8Array | null {
  const clean = b64.replace(/\s/g, "");
  if (!clean) return null;
  const g = globalThis as {
    Buffer?: { from(data: string, enc: string): Uint8Array };
    atob?: (s: string) => string;
  };
  try {
    if (typeof g.Buffer !== "undefined") {
      return new Uint8Array(g.Buffer.from(clean, "base64"));
    }
    if (typeof g.atob === "function") {
      const bin = g.atob(clean);
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
  } catch {
    return null;
  }
  return null;
}

function extFromDataUriMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("jpeg") || m.includes("jpg")) return ".jpg";
  if (m.includes("gif")) return ".gif";
  if (m.includes("webp")) return ".webp";
  return ".png";
}

/**
 * Remplace `![](data:image/…;base64,…)` par des chemins relatifs (`obb-embed-N.ext`)
 * pour alléger l’entrée Pandoc et éviter des `image("data:…")` invalides côté Typst.
 */
export function extractMarkdownDataUriImages(markdown: string): {
  markdown: string;
  files: Record<string, Uint8Array>;
} {
  const files: Record<string, Uint8Array> = {};
  let counter = 0;
  const re = /!\[([^\]]*)\]\(\s*(data:image\/([a-zA-Z0-9+.-]+);base64,([A-Za-z0-9+/=\s]+))\s*\)/gi;
  const out = markdown.replace(re, (_full, alt: string, _uri: string, mime: string, b64: string) => {
    const bytes = base64ToBytes(b64);
    if (!bytes?.length) return "";
    const ext = extFromDataUriMime(mime);
    const name = `obb-embed-${counter++}${ext}`;
    files[name] = bytes;
    files[`media/${name}`] = bytes;
    return `![${alt}](${name})`;
  });
  return { markdown: out, files };
}

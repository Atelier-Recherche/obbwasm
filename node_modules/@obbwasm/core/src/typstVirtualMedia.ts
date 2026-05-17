/**
 * Réécrit les chemins dans les appels Typst `image("…")` vers `/obb-media/…`
 * et fusionne les octets dans `mediaFiles`, pour que Typst WASM ne tente pas
 * de lire des chemins absolus Windows ou hors de la racine virtuelle `/`.
 */

import { yieldToMainThread } from "./asyncYield.js";
import { normalizeImageBytesForTypstAsync, OBB_PLACEHOLDER_PNG } from "./imageFormat.js";
import { resolveRemoteImageFetchUrl } from "./remoteImageUrl.js";

export const OBB_MEDIA_PREFIX = "/obb-media/";

function extFromPath(p: string): string {
  const base = p.split(/[/\\]/).pop() ?? "";
  const i = base.lastIndexOf(".");
  if (i <= 0) return ".png";
  const ext = base.slice(i).toLowerCase();
  if (/^\.[a-z0-9]{1,8}$/.test(ext)) return ext;
  return ".png";
}

/** Normalise un chemin pour la recherche dans mediaFiles (coffre, Windows, URL). */
export function normalizeMediaLookupPath(path: string): string {
  let s = path.replace(/\\/g, "/").replace(/^file:\/\//i, "").split("?")[0] ?? "";
  try {
    s = decodeURIComponent(s);
  } catch {
    /* ignore */
  }
  s = s.replace(/^[a-zA-Z]:\//, "");
  return s.replace(/^\/+/, "");
}

/** Chemins que Typst WASM refuse (hors racine virtuelle `/`). */
export function isUnsafeTypstFilePath(path: string): boolean {
  const s = path.replace(/\\/g, "/");
  if (/^[a-zA-Z]:\//.test(s)) return true;
  if (s.startsWith("//")) return true;
  if (/(^|\/)\.\.(\/|$)/.test(s)) return true;
  if (s.startsWith(OBB_MEDIA_PREFIX) || s.startsWith("/obb-media/")) return false;
  if (/^https?:\/\//i.test(s)) return false;
  return false;
}

function mediaKeyNorm(k: string): string {
  return normalizeMediaLookupPath(k).toLowerCase();
}

function mountVirtualBytes(merged: Record<string, Uint8Array>, virtual: string, bytes: Uint8Array): void {
  const normKey = virtual.replace(/^\/+/, "");
  merged[`/${normKey}`] = bytes;
}

/** Indexe des alias (basename, chemin normalisé) pour retrouver les octets Pandoc / coffre. */
function indexMediaAliases(files: Record<string, Uint8Array>): Record<string, Uint8Array> {
  const out: Record<string, Uint8Array> = { ...files };
  for (const [k, buf] of Object.entries(files)) {
    const nk = mediaKeyNorm(k);
    if (nk && out[nk] === undefined) out[nk] = buf;
    const base = nk.split("/").pop();
    if (base && out[base] === undefined) out[base] = buf;
    const withMedia = `media/${base}`;
    if (base && out[withMedia] === undefined) out[withMedia] = buf;
  }
  return out;
}

/** Cherche les octets Pandoc pour un chemin tel qu’émis dans le Typst (absolu relatif, URL-encoded, etc.). */
export function findMediaBytes(files: Record<string, Uint8Array>, path: string): Uint8Array | undefined {
  const norm = normalizeMediaLookupPath(path);
  const variants = new Set<string>([
    path,
    path.replace(/\\/g, "/"),
    norm,
    `/${norm}`,
    norm ? `media/${norm.split("/").pop()}` : "",
  ]);
  for (const v of variants) {
    if (!v) continue;
    if (files[v]) return files[v];
    const vn = mediaKeyNorm(v);
    if (files[vn]) return files[vn];
    for (const [k, buf] of Object.entries(files)) {
      if (mediaKeyNorm(k) === vn) return buf;
    }
  }
  const parts = norm.split("/").filter(Boolean);
  for (let len = parts.length; len > 0; len--) {
    const suffix = parts.slice(-len).join("/");
    const suffixLower = suffix.toLowerCase();
    for (const [k, buf] of Object.entries(files)) {
      const kn = k.replace(/\\/g, "/");
      const knNorm = mediaKeyNorm(kn);
      if (knNorm === suffixLower || knNorm.endsWith("/" + suffixLower)) return buf;
      if (kn === suffix || kn.endsWith("/" + suffix)) return buf;
    }
  }
  return undefined;
}

/**
 * Pandoc émet `image("chemin")` ou `image(path: "chemin")` (souvent dans `#box(image("…"))`).
 * Les cas `image(bytes(...))` sont exclus (pas de guillemet juste après `(`).
 */
const IMAGE_DOUBLE_RE = /image\s*\(\s*[\r\n\s]*"([^"]+)"/g;
const IMAGE_SINGLE_RE = /image\s*\(\s*[\r\n\s]*'([^']+)'/g;
const IMAGE_PATH_KW_DOUBLE_RE = /image\s*\(\s*path\s*:\s*"([^"]+)"/g;
const IMAGE_PATH_KW_SINGLE_RE = /image\s*\(\s*path\s*:\s*'([^']+)'/g;

export async function virtualizeTypstMediaPaths(params: {
  typst: string;
  mediaFiles: Record<string, Uint8Array>;
  fetchBytes?: (url: string) => Promise<Uint8Array | null>;
  /** Si fourni, lignes de diagnostic (PDF médias / URLs). */
  debugLog?: string[];
}): Promise<{ typst: string; mediaFiles: Record<string, Uint8Array> }> {
  const { fetchBytes } = params;
  const dbg = params.debugLog;
  const merged = indexMediaAliases(params.mediaFiles ?? {});
  const pathToVirtual = new Map<string, string>();
  let counter = 0;

  function assignPlaceholder(rawPath: string): string {
    const virtual = `${OBB_MEDIA_PREFIX}missing${counter++}.png`;
    mountVirtualBytes(merged, virtual, OBB_PLACEHOLDER_PNG);
    pathToVirtual.set(rawPath, virtual);
    dbg?.push(
      `⚠ placeholder (fichier introuvable ou hors racine Typst) : ${rawPath.slice(0, 120)}${rawPath.length > 120 ? "…" : ""} → ${virtual}`,
    );
    return virtual;
  }

  async function resolveOne(rawPath: string): Promise<string> {
    if (rawPath.startsWith(OBB_MEDIA_PREFIX) || rawPath.startsWith("/obb-media/")) {
      return rawPath.startsWith("/") ? rawPath : `/${rawPath.replace(/^\/+/, "")}`;
    }
    const cached = pathToVirtual.get(rawPath);
    if (cached) return cached;

    let bytes = findMediaBytes(merged, rawPath);
    if (!bytes && /^https?:\/\//i.test(rawPath) && fetchBytes) {
      const fetchUrl = resolveRemoteImageFetchUrl(rawPath);
      if (fetchUrl !== rawPath) {
        dbg?.push(`→ URL directe : ${fetchUrl.slice(0, 120)}${fetchUrl.length > 120 ? "…" : ""}`);
      }
      dbg?.push(`→ fetch URL (${fetchUrl.slice(0, 120)}${fetchUrl.length > 120 ? "…" : ""})`);
      const got = await fetchBytes(fetchUrl);
      if (got?.length) bytes = got;
      else dbg?.push(`  → réponse vide ou erreur réseau`);
    }
    if (!bytes) {
      dbg?.push(`✗ aucun octet pour : ${rawPath.slice(0, 160)}${rawPath.length > 160 ? "…" : ""}`);
      return assignPlaceholder(rawPath);
    }

    const norm = await normalizeImageBytesForTypstAsync(bytes, rawPath);
    if (norm.convertedFrom) {
      dbg?.push(`✓ converti ${norm.convertedFrom} → PNG pour Typst (${norm.bytes.length} octets)`);
    }
    if (norm.usedPlaceholder) {
      dbg?.push(
        `⚠ image remplacée par placeholder (non-PNG / HTML / vide / conversion échouée) : ${rawPath.slice(0, 120)}${rawPath.length > 120 ? "…" : ""}`,
      );
    }
    const ext = norm.resolvedExt || extFromPath(rawPath);
    const virtual = `${OBB_MEDIA_PREFIX}img${counter++}${ext}`;
    mountVirtualBytes(merged, virtual, norm.bytes);
    pathToVirtual.set(rawPath, virtual);
    dbg?.push(`✓ virtuel : ${rawPath.length > 90 ? `${rawPath.slice(0, 90)}…` : rawPath} → ${virtual} (${norm.bytes.length} octets)`);
    return virtual;
  }

  async function applyReplacements(original: string, re: RegExp, quote: '"' | "'"): Promise<string> {
    re.lastIndex = 0;
    const matches = [...original.matchAll(re)];
    let result = "";
    let lastIdx = 0;
    const q = quote;
    let processed = 0;
    for (const m of matches) {
      const full = m[0];
      const path = m[1];
      const idx = m.index ?? 0;
      result += original.slice(lastIdx, idx);
      const resolved = await resolveOne(path);
      result += full.replace(`${q}${path}${q}`, `${q}${resolved}${q}`);
      lastIdx = idx + full.length;
      processed++;
      if (processed % 8 === 0) await yieldToMainThread();
    }
    result += original.slice(lastIdx);
    return result;
  }

  const keysIn = Object.keys(params.mediaFiles ?? {});
  dbg?.push(`[media] ${keysIn.length} entrée(s) mediaFiles : ${keysIn.slice(0, 25).join(", ") || "(vide)"}${keysIn.length > 25 ? " …" : ""}`);

  let out = params.typst;
  const nDouble = [...params.typst.matchAll(IMAGE_DOUBLE_RE)].length;
  const nSingle = [...params.typst.matchAll(IMAGE_SINGLE_RE)].length;
  dbg?.push(`[media] occurrences image("…") dans Typst : ~${nDouble} (guillemets doubles), ~${nSingle} (simples)`);

  for (const re of [
    IMAGE_DOUBLE_RE,
    IMAGE_SINGLE_RE,
    IMAGE_PATH_KW_DOUBLE_RE,
    IMAGE_PATH_KW_SINGLE_RE,
  ]) {
    re.lastIndex = 0;
    let quote: '"' | "'";
    if (re === IMAGE_SINGLE_RE || re === IMAGE_PATH_KW_SINGLE_RE) {
      quote = "'";
    } else {
      quote = '"';
    }
    out = await applyReplacements(out, re, quote);
  }

  const stillUnsafe = [...out.matchAll(IMAGE_DOUBLE_RE)].filter((m) => {
    const p = m[1];
    return p && !p.startsWith(OBB_MEDIA_PREFIX) && !p.startsWith("/obb-media/") && isUnsafeTypstFilePath(p);
  });
  if (stillUnsafe.length) {
    dbg?.push(`⚠ ${stillUnsafe.length} chemin(s) image encore hors /obb-media/ après virtualisation`);
  }

  const stillHttps = out.match(/image\s*\(\s*"https?:\/\/[^"]+"/g);
  if (stillHttps?.length) {
    dbg?.push(`⚠ il reste ${stillHttps.length} image(s) avec URL https brute (non résolue vers /obb-media/)`);
  }

  return { typst: out, mediaFiles: merged };
}

/**
 * Réécrit les chemins dans les appels Typst `image("…")` vers `/obb-media/…`
 * et fusionne les octets dans `mediaFiles`, pour que Typst WASM ne tente pas
 * de lire des chemins absolus Windows ou hors de la racine virtuelle `/`.
 */
import { normalizeImageBytesForTypst } from "./imageFormat.js";
export const OBB_MEDIA_PREFIX = "/obb-media/";
function extFromPath(p) {
    const base = p.split(/[/\\]/).pop() ?? "";
    const i = base.lastIndexOf(".");
    if (i <= 0)
        return ".png";
    const ext = base.slice(i).toLowerCase();
    if (/^\.[a-z0-9]{1,8}$/.test(ext))
        return ext;
    return ".png";
}
/** Cherche les octets Pandoc pour un chemin tel qu’émis dans le Typst (absolu relatif, URL-encoded, etc.). */
export function findMediaBytes(files, path) {
    const norm = path.replace(/\\/g, "/").replace(/^file:\/\//i, "").split("?")[0];
    let decoded = norm;
    try {
        decoded = decodeURIComponent(norm);
    }
    catch {
        /* ignore */
    }
    const variants = new Set([
        path,
        norm,
        decoded,
        norm.replace(/^\/+/, ""),
        decoded.replace(/^\/+/, ""),
    ]);
    for (const v of variants) {
        for (const cand of [v, `/${v.replace(/^\/+/, "")}`, v.replace(/^\/+/, "")]) {
            if (files[cand])
                return files[cand];
        }
    }
    const parts = norm.split("/").filter(Boolean);
    for (let len = parts.length; len > 0; len--) {
        const suffix = parts.slice(-len).join("/");
        for (const [k, buf] of Object.entries(files)) {
            const kn = k.replace(/\\/g, "/");
            if (kn === suffix || kn.endsWith("/" + suffix))
                return buf;
        }
    }
    return undefined;
}
/**
 * Pandoc émet `image("chemin")` sans `#` devant la fonction, souvent dans `#box(image("…"))`.
 * Ne pas exiger `\b` avant `image` : le motif doit matcher tout appel `image("…")`, pas seulement `#image`.
 * Les cas `image(bytes(...))` sont exclus car la suite de `(` n’est pas un guillemet.
 */
const IMAGE_DOUBLE_RE = /image\s*\(\s*[\r\n\s]*"([^"]+)"/g;
const IMAGE_SINGLE_RE = /image\s*\(\s*[\r\n\s]*'([^']+)'/g;
export async function virtualizeTypstMediaPaths(params) {
    const { fetchBytes } = params;
    const dbg = params.debugLog;
    const merged = { ...params.mediaFiles };
    const pathToVirtual = new Map();
    let counter = 0;
    async function resolveOne(rawPath) {
        if (rawPath.startsWith(OBB_MEDIA_PREFIX) || rawPath.startsWith("/obb-media/")) {
            return rawPath.startsWith("/") ? rawPath : `/${rawPath.replace(/^\/+/, "")}`;
        }
        const cached = pathToVirtual.get(rawPath);
        if (cached)
            return cached;
        let bytes = findMediaBytes(merged, rawPath);
        if (!bytes && /^https?:\/\//i.test(rawPath) && fetchBytes) {
            dbg?.push(`→ fetch URL (${rawPath.slice(0, 120)}${rawPath.length > 120 ? "…" : ""})`);
            const got = await fetchBytes(rawPath);
            if (got?.length)
                bytes = got;
            else
                dbg?.push(`  → réponse vide ou erreur réseau`);
        }
        if (!bytes) {
            dbg?.push(`✗ aucun octet pour : ${rawPath.slice(0, 160)}${rawPath.length > 160 ? "…" : ""}`);
            return rawPath;
        }
        const norm = normalizeImageBytesForTypst(bytes, rawPath);
        if (norm.usedPlaceholder) {
            dbg?.push(`⚠ image remplacée par placeholder (non-PNG / HTML / vide) : ${rawPath.slice(0, 120)}${rawPath.length > 120 ? "…" : ""}`);
        }
        const ext = norm.resolvedExt || extFromPath(rawPath);
        const virtual = `${OBB_MEDIA_PREFIX}img${counter++}${ext}`;
        const normKey = virtual.replace(/^\/+/, "");
        merged[normKey] = norm.bytes;
        merged[virtual] = norm.bytes;
        pathToVirtual.set(rawPath, virtual);
        dbg?.push(`✓ virtuel : ${rawPath.length > 90 ? `${rawPath.slice(0, 90)}…` : rawPath} → ${virtual} (${norm.bytes.length} octets)`);
        return virtual;
    }
    async function applyReplacements(original, re, quote) {
        re.lastIndex = 0;
        const matches = [...original.matchAll(re)];
        let result = "";
        let lastIdx = 0;
        const q = quote;
        for (const m of matches) {
            const full = m[0];
            const path = m[1];
            const idx = m.index ?? 0;
            result += original.slice(lastIdx, idx);
            const resolved = await resolveOne(path);
            const inner = resolved !== path
                ? full.replace(`${q}${path}${q}`, `${q}${resolved}${q}`)
                : full;
            result += inner;
            lastIdx = idx + full.length;
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
    IMAGE_DOUBLE_RE.lastIndex = 0;
    IMAGE_SINGLE_RE.lastIndex = 0;
    out = await applyReplacements(out, IMAGE_DOUBLE_RE, '"');
    out = await applyReplacements(out, IMAGE_SINGLE_RE, "'");
    const stillHttps = out.match(/image\s*\(\s*"https?:\/\/[^"]+"/g);
    if (stillHttps?.length) {
        dbg?.push(`⚠ il reste ${stillHttps.length} image(s) avec URL https brute (non résolue vers /obb-media/)`);
    }
    return { typst: out, mediaFiles: merged };
}
//# sourceMappingURL=typstVirtualMedia.js.map
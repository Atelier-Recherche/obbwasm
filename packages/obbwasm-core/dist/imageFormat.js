/**
 * Détecte le format réel d’une image (évite `.png` par défaut quand le buffer est du JPEG, etc.)
 * et fournit un PNG minimal de secours si le contenu n’est pas une image valide.
 */
/** PNG 1×1 transparent (remplace HTML d’erreur ou octets non-image pour éviter l’échec Typst). */
const PLACEHOLDER_PNG_B64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
/** 70 octets — même image que PLACEHOLDER_PNG_B64 si base64 indisponible. */
const FALLBACK_1X1_PNG = Uint8Array.from([
    137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 13, 73, 68, 65, 84, 120, 218, 99, 252, 207, 192, 80, 15, 0, 4, 133, 1, 128, 132, 169, 140, 33, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
]);
function base64ToUint8(b64) {
    const g = globalThis;
    if (typeof g.Buffer !== "undefined") {
        return new Uint8Array(g.Buffer.from(b64, "base64"));
    }
    if (typeof g.atob === "function") {
        const bin = g.atob(b64);
        const out = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++)
            out[i] = bin.charCodeAt(i);
        return out;
    }
    return new Uint8Array(FALLBACK_1X1_PNG);
}
export const OBB_PLACEHOLDER_PNG = (() => {
    const u = base64ToUint8(PLACEHOLDER_PNG_B64);
    return u.length > 0 ? u : FALLBACK_1X1_PNG;
})();
/** Extension de fichier (avec point) à utiliser pour Typst / VFS. */
export function imageExtFromMagic(bytes) {
    if (!bytes || bytes.length < 8)
        return null;
    const b0 = bytes[0];
    const b1 = bytes[1];
    const b2 = bytes[2];
    const b3 = bytes[3];
    if (b0 === 0x89 && b1 === 0x50 && b2 === 0x4e && b3 === 0x47)
        return ".png";
    if (b0 === 0xff && b1 === 0xd8 && b2 === 0xff)
        return ".jpg";
    if (b0 === 0x47 && b1 === 0x49 && b2 === 0x46)
        return ".gif";
    if (b0 === 0x52 && b1 === 0x49 && b2 === 0x46 && b3 === 0x46 && bytes.length >= 12) {
        const t8 = String.fromCharCode(bytes[8] ?? 0, bytes[9] ?? 0, bytes[10] ?? 0, bytes[11] ?? 0);
        if (t8 === "WEBP")
            return ".webp";
    }
    if (b0 === 0x42 && b1 === 0x4d)
        return ".bmp";
    return null;
}
/** HTML / texte d’erreur renvoyé à la place d’une image (URL HTTP, mauvais chemin, etc.). */
export function looksLikeNonImageBytes(bytes) {
    if (!bytes?.length)
        return true;
    const n = Math.min(bytes.length, 64);
    const head = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, n)).trimStart();
    if (head.startsWith("<") || head.startsWith("{") || head.startsWith("<!"))
        return true;
    if (head.toLowerCase().startsWith("http/"))
        return true;
    return false;
}
/**
 * Retourne les octets à monter dans le monde Typst : buffer corrigé si l’extension ne correspond pas au magic,
 * ou placeholder PNG si le contenu n’est pas une image reconnue.
 */
export function normalizeImageBytesForTypst(bytes, pathHint) {
    if (!bytes?.length) {
        return { bytes: OBB_PLACEHOLDER_PNG, usedPlaceholder: true, resolvedExt: ".png" };
    }
    if (looksLikeNonImageBytes(bytes) && !imageExtFromMagic(bytes)) {
        return { bytes: OBB_PLACEHOLDER_PNG, usedPlaceholder: true, resolvedExt: ".png" };
    }
    const magic = imageExtFromMagic(bytes);
    const fromPath = pathHint.replace(/\\/g, "/").split("/").pop() ?? "";
    const dot = fromPath.lastIndexOf(".");
    const pathExt = dot > 0 ? fromPath.slice(dot).toLowerCase() : "";
    const knownPath = /^\.(png|jpe?g|gif|webp|bmp)$/i.test(pathExt) ? pathExt : "";
    if (pathExt === ".png" && magic && magic !== ".png") {
        return { bytes, usedPlaceholder: false, resolvedExt: magic };
    }
    if (pathExt === ".png" && !magic && bytes.length >= 4 && bytes[0] !== 0x89) {
        return { bytes: OBB_PLACEHOLDER_PNG, usedPlaceholder: true, resolvedExt: ".png" };
    }
    const resolvedExt = magic ?? (knownPath || ".png");
    return { bytes, usedPlaceholder: false, resolvedExt };
}
const TYPST_CONVERT_TO_PNG = new Set([".webp", ".avif"]);
function mimeForImageExt(ext) {
    switch (ext.toLowerCase()) {
        case ".webp":
            return "image/webp";
        case ".avif":
            return "image/avif";
        case ".jpg":
        case ".jpeg":
            return "image/jpeg";
        case ".gif":
            return "image/gif";
        default:
            return "image/png";
    }
}
/**
 * Décode WebP / AVIF via le moteur image du navigateur (Electron / Chromium) → PNG pour Typst WASM.
 */
export async function rasterBytesToPng(bytes, mime) {
    if (!bytes?.length)
        return null;
    const g = globalThis;
    if (typeof g.createImageBitmap !== "function")
        return null;
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    const blob = new Blob([copy], { type: mime });
    let bitmap;
    try {
        bitmap = await g.createImageBitmap(blob);
    }
    catch {
        return null;
    }
    try {
        const w = bitmap.width;
        const h = bitmap.height;
        if (w < 1 || h < 1)
            return null;
        let pngBlob = null;
        if (typeof g.OffscreenCanvas === "function") {
            const canvas = new g.OffscreenCanvas(w, h);
            const ctx = canvas.getContext("2d");
            if (!ctx)
                return null;
            ctx.drawImage(bitmap, 0, 0);
            pngBlob = await canvas.convertToBlob({ type: "image/png" });
        }
        else if (g.document) {
            const canvas = g.document.createElement("canvas");
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext("2d");
            if (!ctx)
                return null;
            ctx.drawImage(bitmap, 0, 0);
            pngBlob = await new Promise((resolve) => {
                canvas.toBlob((b) => resolve(b), "image/png");
            });
        }
        if (!pngBlob?.size)
            return null;
        return new Uint8Array(await pngBlob.arrayBuffer());
    }
    finally {
        bitmap.close();
    }
}
/**
 * Normalise les octets image pour Typst : placeholder si invalide, WebP/AVIF → PNG si possible.
 */
export async function normalizeImageBytesForTypstAsync(bytes, pathHint) {
    const base = normalizeImageBytesForTypst(bytes, pathHint);
    if (base.usedPlaceholder)
        return base;
    const ext = base.resolvedExt.toLowerCase();
    if (!TYPST_CONVERT_TO_PNG.has(ext))
        return base;
    const png = await rasterBytesToPng(base.bytes, mimeForImageExt(ext));
    if (png?.length) {
        return {
            bytes: png,
            usedPlaceholder: false,
            resolvedExt: ".png",
            convertedFrom: ext,
        };
    }
    return {
        bytes: OBB_PLACEHOLDER_PNG,
        usedPlaceholder: true,
        resolvedExt: ".png",
    };
}
//# sourceMappingURL=imageFormat.js.map
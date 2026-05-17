/**
 * Détecte le format réel d’une image (évite `.png` par défaut quand le buffer est du JPEG, etc.)
 * et fournit un PNG minimal de secours si le contenu n’est pas une image valide.
 */
export declare const OBB_PLACEHOLDER_PNG: Uint8Array;
/** Extension de fichier (avec point) à utiliser pour Typst / VFS. */
export declare function imageExtFromMagic(bytes: Uint8Array): string | null;
/** HTML / texte d’erreur renvoyé à la place d’une image (URL HTTP, mauvais chemin, etc.). */
export declare function looksLikeNonImageBytes(bytes: Uint8Array): boolean;
/**
 * Retourne les octets à monter dans le monde Typst : buffer corrigé si l’extension ne correspond pas au magic,
 * ou placeholder PNG si le contenu n’est pas une image reconnue.
 */
export declare function normalizeImageBytesForTypst(bytes: Uint8Array, pathHint: string): {
    bytes: Uint8Array;
    usedPlaceholder: boolean;
    resolvedExt: string;
};
/**
 * Décode WebP / AVIF via le moteur image du navigateur (Electron / Chromium) → PNG pour Typst WASM.
 */
export declare function rasterBytesToPng(bytes: Uint8Array, mime: string): Promise<Uint8Array | null>;
/**
 * Normalise les octets image pour Typst : placeholder si invalide, WebP/AVIF → PNG si possible.
 */
export declare function normalizeImageBytesForTypstAsync(bytes: Uint8Array, pathHint: string): Promise<{
    bytes: Uint8Array;
    usedPlaceholder: boolean;
    resolvedExt: string;
    convertedFrom?: string;
}>;
//# sourceMappingURL=imageFormat.d.ts.map
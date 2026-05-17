/**
 * Réécrit les chemins dans les appels Typst `image("…")` vers `/obb-media/…`
 * et fusionne les octets dans `mediaFiles`, pour que Typst WASM ne tente pas
 * de lire des chemins absolus Windows ou hors de la racine virtuelle `/`.
 */
export declare const OBB_MEDIA_PREFIX = "/obb-media/";
/** Normalise un chemin pour la recherche dans mediaFiles (coffre, Windows, URL). */
export declare function normalizeMediaLookupPath(path: string): string;
/** Chemins que Typst WASM refuse (hors racine virtuelle `/`). */
export declare function isUnsafeTypstFilePath(path: string): boolean;
/** Cherche les octets Pandoc pour un chemin tel qu’émis dans le Typst (absolu relatif, URL-encoded, etc.). */
export declare function findMediaBytes(files: Record<string, Uint8Array>, path: string): Uint8Array | undefined;
export declare function virtualizeTypstMediaPaths(params: {
    typst: string;
    mediaFiles: Record<string, Uint8Array>;
    fetchBytes?: (url: string) => Promise<Uint8Array | null>;
    /** Si fourni, lignes de diagnostic (PDF médias / URLs). */
    debugLog?: string[];
}): Promise<{
    typst: string;
    mediaFiles: Record<string, Uint8Array>;
}>;
//# sourceMappingURL=typstVirtualMedia.d.ts.map
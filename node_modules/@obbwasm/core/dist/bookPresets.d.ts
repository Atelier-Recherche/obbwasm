import type { BookLayoutState } from "./bookOptions/types.js";
/** Version du fichier JSON préréglage (incrémenter si le schéma change). */
export declare const BOOK_LAYOUT_PRESET_SCHEMA_VERSION = 1;
/**
 * Dossier relatif à la racine bundle / projet (après migration sans `typst/` intermédiaire).
 * Fichiers : `*.json` (un préréglage par fichier).
 */
export declare const BOOK_PRESETS_RELATIVE_DIR = "typeset/presets";
/** Chemins coffre (plugin Obsidian) pour Pandoc / glossaire / index — optionnel dans le JSON. */
export type VaultCompilePaths = Partial<{
    bibliographyVaultPath: string;
    cslVaultPath: string;
    glossaryVaultPath: string;
    nameIndexVaultPath: string;
}>;
/** Métadonnées livre (titre, auteur, éditeur ou édition) — optionnel dans le JSON. */
export type BookCompileMeta = Partial<{
    title: string;
    author: string;
    publisher: string;
}>;
export type BookLayoutPresetFileV1 = {
    version: typeof BOOK_LAYOUT_PRESET_SCHEMA_VERSION;
    /** Libellé affiché (optionnel ; défaut = nom de fichier). */
    name?: string;
    createdAt?: string;
    updatedAt?: string;
    /** État complet des options livre (même forme que `BookLayoutState`). */
    payload: BookLayoutState;
    vaultCompilePaths?: VaultCompilePaths;
    bookCompileMeta?: BookCompileMeta;
};
/** Fusionne un payload partiel avec les défauts (migration / fichiers incomplets). */
export declare function normalizePresetPayload(raw: unknown): BookLayoutState;
/** Extrait les chemins coffre reconnus depuis un objet JSON brut. */
export declare function normalizeVaultCompilePaths(raw: unknown): VaultCompilePaths;
/** Extrait titre / auteur / éditeur depuis un objet JSON brut. */
export declare function normalizeBookCompileMeta(raw: unknown): BookCompileMeta;
export declare function parseBookLayoutPresetJson(text: string): BookLayoutPresetFileV1 | null;
export declare function serializeBookLayoutPreset(payload: BookLayoutState, meta?: {
    name?: string;
}, extra?: {
    vaultCompilePaths?: VaultCompilePaths;
    bookCompileMeta?: BookCompileMeta;
    updatedAt?: string;
}): string;
//# sourceMappingURL=bookPresets.d.ts.map
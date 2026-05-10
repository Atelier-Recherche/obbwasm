/** Gabarit livre (liste serveur ou catalogue téléchargé). */
export type ObbTemplateRecord = {
  id: string;
  name: string;
  mainTypPath: string;
  variables: Record<string, string>;
};

/**
 * Fournit sources .typ, polices et paquets Typst optionnels.
 * Implémentations : HTTP (site PHP), système de fichiers (plugin Obsidian).
 */
export interface ObbWasmAssetLoader {
  fetchTextFile(projectRelativePath: string): Promise<string | null>;
  listFontEntries(): Promise<Array<{ path: string; name: string }>>;
  fetchFontBuffer(path: string): Promise<ArrayBuffer>;
  listTypstPackages?(): Promise<Array<{ id: string }>>;
  fetchTypstPackageZip?(id: string): Promise<ArrayBuffer | null>;
}

export const BOOK_OPTIONS_DEFAULTS_PATH = "typeset/typst/shared/book-options-defaults.typ";

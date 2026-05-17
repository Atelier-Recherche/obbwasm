/** Identifiants Typst déclarés dans une ou plusieurs sources `.typ`. */
export declare function collectTypstLabelIds(...sources: Array<string | null | undefined>): Set<string>;
/**
 * Wikilinks Obsidian hors glossaire / index : pas de note cible dans le même PDF —
 * on garde le libellé affiché pour éviter des `#link(<slug>)` vers des labels inexistants.
 */
export declare function stripNonBookWikiLinks(markdown: string): string;
/**
 * Remplace les liens internes Pandoc vers des labels absents par le texte seul (ou rien).
 */
export declare function patchPandocTypstBrokenLabelRefs(typst: string, definedLabels?: Iterable<string>): string;
/** Variante async : cède le thread tous les ~64 Ko pour les très longs Typst. */
export declare function patchPandocTypstBrokenLabelRefsAsync(typst: string, definedLabels?: Iterable<string>): Promise<string>;
/**
 * Ajoute `#label("…")` après les titres Pandoc qui n’en ont pas encore (auto_identifiers).
 */
export declare function injectTypstHeadingLabels(typst: string): string;
//# sourceMappingURL=pandocTypstLabels.d.ts.map
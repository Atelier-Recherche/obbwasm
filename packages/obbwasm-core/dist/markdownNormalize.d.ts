/** Obsidian `![[fichier]]` → `![](fichier)` pour que Pandoc traite les images locales. */
export declare function normalizeWikiImagesForPandoc(markdown: string): string;
/**
 * Raccourcis du type `[@clef p44]` (sans virgule) : Pandoc envoie un locator littéral « p44 » à citeproc,
 * qui ajoute déjà le libellé de page du CSL (« p. ») → rendu « p. p44 ». Même problème avec `[@clef, p44]`.
 * La forme canonique Pandoc est `[@clef, 44]` ou `[@clef, p. 44]` (virgule après la clé).
 */
export declare function normalizePandocCitationPageShorthand(markdown: string): string;
//# sourceMappingURL=markdownNormalize.d.ts.map
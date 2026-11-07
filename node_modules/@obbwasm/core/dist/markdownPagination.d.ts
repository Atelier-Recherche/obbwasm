/** Préfixe d’id HTML/EPUB pour les ancres de pagination synchronisée PDF. */
export declare const OBB_PAG_ID_PREFIX = "obb-pag-";
/** Jeton texte extrait de la couche PDF (pdf.js) et présent dans le Markdown source. */
export declare const OBB_PAG_TOKEN_PREFIX = "OBBPAG";
export declare function obbPagId(n: number): string;
export declare function obbPagToken(n: number): string;
/** Span Markdown (Pandoc) : texte jeton + id stable pour l’EPUB. */
export declare function obbPagMarkdownSpan(n: number): string;
/**
 * Injecte des ancres `[OBBPAGn]{#obb-pag-n}` en tête de chaque titre ATX et paragraphe
 * (blocs séparés par une ligne vide). Ignore YAML front matter et fences de code.
 */
export declare function injectMarkdownPaginationAnchors(markdown: string): {
    markdown: string;
    maxAnchor: number;
};
/**
 * Adoucit les jetons OBBPAGn sans les sortir de la couche texte PDF.
 * Important : un texte trop petit / blanc (ex. 0.001pt) est souvent absent de
 * l’extraction pdf.js → page-list EPUB vide ou fausse.
 * Ces jetons ne sont injectés que pour le PDF intermédiaire de sync EPUB.
 */
export declare function hideTypstPaginationTokens(typst: string): string;
/**
 * Construit la carte ancre → numéro de page PDF à partir des textes page par page (pdf.js).
 * Le numéro de page est 1-based (comme `counter(page)` Typst).
 * Les espaces éventuellement insérés par la couche texte PDF sont ignorés.
 */
export declare function buildPageMapFromPdfTexts(pageTexts: string[]): Map<number, number>;
//# sourceMappingURL=markdownPagination.d.ts.map
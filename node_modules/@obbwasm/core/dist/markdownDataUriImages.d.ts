/**
 * Remplace `![](data:image/…;base64,…)` par des chemins relatifs (`obb-embed-N.ext`)
 * pour alléger l’entrée Pandoc et éviter des `image("data:…")` invalides côté Typst.
 */
export declare function extractMarkdownDataUriImages(markdown: string): {
    markdown: string;
    files: Record<string, Uint8Array>;
};
//# sourceMappingURL=markdownDataUriImages.d.ts.map
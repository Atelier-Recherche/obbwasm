export type PrepareMarkdownOptions = {
    bibliography?: boolean;
    /** Injecte les ancres OBBPAG pour synchroniser EPUB ↔ pages PDF (défaut false). */
    paginationAnchors?: boolean;
};
/**
 * Preprocess Markdown partagé (footnotes, wikilinks, médias, ancres pagination).
 */
export declare function prepareMarkdownForBookExport(sourceText: string, opts?: PrepareMarkdownOptions): {
    markdown: string;
    maxAnchor: number;
    dataUriFiles: Record<string, Uint8Array>;
};
//# sourceMappingURL=prepareMarkdown.d.ts.map
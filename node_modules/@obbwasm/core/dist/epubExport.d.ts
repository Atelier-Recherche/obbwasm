import type { PandocConvertFn } from "./pandocMarkdown.js";
export { buildPageMapFromPdfTexts } from "./markdownPagination.js";
export { prepareMarkdownForBookExport } from "./prepareMarkdown.js";
export { compactTextForPageAlign, findPdfPageBreaksInHtml, pdfPageFingerprint, } from "./epubPageAlign.js";
export declare function pandocMarkdownToEpub(params: {
    convert: PandocConvertFn;
    sourceText: string;
    titleFallback: string;
    bibliography?: {
        name: string;
        blob: Blob;
    } | null;
    csl?: {
        name: string;
        blob: Blob;
    } | null;
    extraFiles?: Record<string, string | Blob>;
    /**
     * Ancres OBBPAG (legacy). Défaut false : la sync pages utilise l’alignement
     * texte PDF → HTML (coupures mid-paragraphe, un marqueur par page).
     */
    paginationAnchors?: boolean;
    /**
     * Page de titre Pandoc EPUB (défaut false).
     * Aligner sur l’option livre `title-page` du PDF pour rester cohérent.
     */
    epubTitlePage?: boolean;
}): Promise<{
    epub: Uint8Array;
    stderr: string;
    preparedMarkdown: string;
    maxAnchor: number;
}>;
/**
 * Injecte les pagebreaks EPUB3 en alignant le texte de chaque page PDF sur le XHTML
 * (une marque par page, y compris au milieu d’un paragraphe).
 */
export declare function patchEpubPrintPageList(epubBytes: Uint8Array, pageTexts: string[]): Promise<Uint8Array>;
//# sourceMappingURL=epubExport.d.ts.map
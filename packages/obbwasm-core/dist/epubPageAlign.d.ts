/**
 * Aligne les coupures de page EPUB sur le début de chaque page du PDF
 * (y compris au milieu d’un paragraphe), une seule marque par n° de page.
 */
export type EpubPageBreak = {
    page: number;
    htmlOffset: number;
};
/** Compacte pour matching insensible espaces / tirets de coupure / casse. */
export declare function compactTextForPageAlign(s: string): string;
/**
 * Indexe le HTML : texte visible + carte compactIndex → offset HTML.
 * Ignore le contenu des balises.
 */
export declare function indexHtmlForPageAlign(html: string): {
    compact: string;
    /** compact[i] → index dans html du caractère source (approx. début). */
    compactToHtml: number[];
};
/** Empreinte du début de page PDF (sans le n° de page courant collé en tête). */
export declare function pdfPageFingerprint(pageText: string, pageNumber: number, len?: number): string;
/**
 * Calcule les offsets HTML où commencer chaque page PDF (recherche séquentielle).
 * @param pageNumberOffset — ajouter à l’index (0 → pages 1..n ; 5 → pages 6..)
 */
export declare function findPdfPageBreaksInHtml(html: string, pageTexts: string[], pageNumberOffset?: number): EpubPageBreak[];
/** Insère les spans pagebreak (une fois par page) ; offsets du plus grand au plus petit. */
export declare function insertPageBreaksIntoHtml(html: string, breaks: EpubPageBreak[], makeSpan: (page: number) => string): string;
//# sourceMappingURL=epubPageAlign.d.ts.map
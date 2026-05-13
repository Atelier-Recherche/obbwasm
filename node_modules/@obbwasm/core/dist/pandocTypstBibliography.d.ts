/**
 * Pandoc + citeproc ajoute en fin de document Typst un bloc du type :
 * `#block[ … ] <refs>` (références numérotées / labels `<ref-…>`).
 * On le découpe pour pouvoir le placer selon `bibliography-position` dans le gabarit.
 */
export declare function splitPandocTypstBodyAndBibliography(typst: string): {
    body: string;
    bibliography: string | null;
};
//# sourceMappingURL=pandocTypstBibliography.d.ts.map
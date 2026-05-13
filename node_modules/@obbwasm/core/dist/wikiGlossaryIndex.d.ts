/** Aligné sur `pandocMarkdown.PandocConvertFn` (évite import circulaire). */
type PandocConvertFn = (options: Record<string, unknown>, stdin: string | null, files: Record<string, string | Blob>) => Promise<{
    stdout: string;
    stderr: string;
    warnings: unknown[];
    files: Record<string, string | Blob>;
    mediaFiles: Record<string, string | Blob>;
}>;
type HrMode = "line" | "pagebreak";
/** Normalise une ancre / titre de section pour coïncider avec `[[…#ancre]]` (style Obsidian). */
export declare function slugifyObsidianAnchor(raw: string): string;
/**
 * Transforme les wikiliens glossaire / index en liens Markdown `obb-glossary:` / `obb-index:`
 * (schéma factice lu par Pandoc puis patché en Typst).
 */
export declare function normalizeWikiGlossaryIndexLinks(markdown: string): string;
/**
 * Remplace les `#link("obb-glossary:…")` / `#link("obb-index:…")` émis par Pandoc
 * par des liens vers des `#label` Typst (`obb-gl-*`, `obb-ix-*`).
 */
export declare function patchPandocTypstObbWikiRefs(typst: string): string;
/** Découpe un Markdown en sections niveau 1 (`# titre`). */
export declare function splitMarkdownH1Sections(md: string): Array<{
    title: string;
    body: string;
}>;
/**
 * Fragment Typst pour le bloc glossaire ou index des noms (titres H2 + label + corps Pandoc).
 */
export declare function buildObbBackMatterTypstFragment(params: {
    convert: PandocConvertFn;
    markdown: string | null | undefined;
    labelPrefix: "obb-gl-" | "obb-ix-";
    /** Passe `markdownHorizontalRuleFromBookValues` depuis l’appelant. */
    markdownHorizontalRule: HrMode;
}): Promise<string>;
export {};
//# sourceMappingURL=wikiGlossaryIndex.d.ts.map
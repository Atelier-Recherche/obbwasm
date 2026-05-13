import type { BookLayoutState } from "./bookOptions/types.js";
import { type ObbWasmAssetLoader } from "./assetLoader.js";
export type PandocConvertFn = (options: Record<string, unknown>, stdin: string | null, files: Record<string, string | Blob>) => Promise<{
    stdout: string;
    stderr: string;
    warnings: unknown[];
    files: Record<string, string | Blob>;
    mediaFiles: Record<string, string | Blob>;
}>;
/** Obsidian `![[fichier]]` → `![](fichier)` pour que Pandoc traite les images locales. */
export declare function normalizeWikiImagesForPandoc(markdown: string): string;
/**
 * Raccourcis du type `[@clef p44]` (sans virgule) : Pandoc envoie un locator littéral « p44 » à citeproc,
 * qui ajoute déjà le libellé de page du CSL (« p. ») → rendu « p. p44 ». Même problème avec `[@clef, p44]`.
 * La forme canonique Pandoc est `[@clef, 44]` ou `[@clef, p. 44]` (virgule après la clé).
 */
export declare function normalizePandocCitationPageShorthand(markdown: string): string;
/** Rendu Typst pour une ligne `---` / `***` / `___` (séparateur horizontal Markdown). */
export type MarkdownHorizontalRuleTypst = "line" | "pagebreak";
/** Lit l’option livre « Séparateur Markdown » (registre : `markdown-horizontal-rule`). */
export declare function markdownHorizontalRuleFromBookValues(values: Record<string, boolean | string>): MarkdownHorizontalRuleTypst;
/**
 * Le writer Pandoc → Typst émet `#horizontalrule` pour les séparateurs Markdown (`---`).
 * Ce symbole n’existe pas en Typst standard → erreur « unknown variable: horizontalrule ».
 */
export declare function patchPandocTypstFragments(typst: string, mode?: MarkdownHorizontalRuleTypst): string;
export declare function pandocMarkdownToTypst(params: {
    convert: PandocConvertFn;
    /** Pandoc `from` ; défaut `markdown` (plugin Obsidian). */
    sourceFormat?: string;
    sourceText: string;
    sourceBlob?: Blob | null;
    sourceFileName?: string;
    titleFallback: string;
    bibliography?: {
        name: string;
        blob: Blob;
    } | null;
    /** Style de citations CSL (avec bibliographie ; ignoré sans `.bib`). */
    csl?: {
        name: string;
        blob: Blob;
    } | null;
    /** Fichiers additionnels accessibles par Pandoc (images markdown, etc.). */
    extraFiles?: Record<string, string | Blob>;
    /** Séparateurs `---` dans le Markdown : ligne Typst ou saut de page. */
    markdownHorizontalRule?: MarkdownHorizontalRuleTypst;
}): Promise<{
    typst: string;
    stderr: string;
    mediaFiles: Record<string, Uint8Array>;
}>;
export declare function compileTypstBookToPdf(params: {
    compiler: import("@myriaddreamin/typst.ts/compiler").TypstCompiler;
    loader: ObbWasmAssetLoader;
    templateMainSource: string;
    generatedTypst: string;
    bookLayout: BookLayoutState;
    meta: {
        title: string;
        author: string;
        publisher: string;
    };
    /** Assets (images) à exposer au monde Typst. */
    mediaFiles?: Record<string, Uint8Array>;
    /** Télécharge les images http(s) référencées dans le Typst (plugin / navigateur). */
    fetchRemoteBytes?: (url: string) => Promise<Uint8Array | null>;
    /** Diagnostic virtualisation chemins (rempli si tableau fourni). */
    mediaDebugLog?: string[];
    /** Pandoc WASM — requis pour générer glossaire / index depuis du Markdown. */
    pandocConvert?: PandocConvertFn;
    /** Contenu de la note « glossaire » (`# entrée` + définition). */
    glossaryMarkdown?: string | null;
    /** Contenu de la note « index » des noms (`# entrée` + notice). */
    nameIndexMarkdown?: string | null;
}): Promise<{
    pdf: Uint8Array | null;
    diagnostics: unknown;
    stderrLog: string;
}>;
//# sourceMappingURL=pandocMarkdown.d.ts.map
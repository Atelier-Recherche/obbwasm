import type { BookLayoutState, SectionId } from "./types";
import type { StringOverrideKey } from "./registry";
/** Valeur numérique pour `line-spacing: Xem` (preset custom). */
export declare function clampLineSpacingEmString(raw: string): string;
/** Garantit la section `body` (contenu Pandoc) dans l’ordre émis vers Typst. */
export declare function ensureSectionOrderForTypst(order: SectionId[]): SectionId[];
/**
 * Tableau Typst pour `section-order`.
 * Typst : un seul élément doit s’écrire `("body",)` avec une virgule finale ; sinon `("body")`
 * est une chaîne parenthésée et `for sid in …` itère sur les caractères → PDF vide.
 */
export declare function typstSectionOrderArray(order: string[]): string;
/**
 * Lignes à mettre dans `let opts = (` … `)` pour `render(opts)`.
 */
export declare function buildTypstOptsLines(state: BookLayoutState, resolvedDocStrings: Record<StringOverrideKey | string, string>, meta: {
    title: string;
    author: string;
    publisher: string;
}): string[];
//# sourceMappingURL=typstSerialize.d.ts.map
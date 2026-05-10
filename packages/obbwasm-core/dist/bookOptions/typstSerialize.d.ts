import type { BookLayoutState } from "./types";
import type { StringOverrideKey } from "./registry";
/** Tableau Typst de chaînes pour `section-order`. */
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
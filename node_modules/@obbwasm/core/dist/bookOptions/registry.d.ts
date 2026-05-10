import type { BookOptionDef } from "./types";
/** Registre unique : id stable → métadonnées + clé Typst. */
export declare const BOOK_OPTIONS: BookOptionDef[];
/** Clés de surcharge pour titres (optionnel, sinon chaîne selon documentLang). */
export declare const STRING_OVERRIDE_KEYS: readonly ["label-toc", "label-bibliography", "label-index", "label-glossary", "label-list-figures", "label-annexes"];
export type StringOverrideKey = (typeof STRING_OVERRIDE_KEYS)[number];
export declare const BOOK_OPTION_BY_ID: Record<string, BookOptionDef>;
//# sourceMappingURL=registry.d.ts.map
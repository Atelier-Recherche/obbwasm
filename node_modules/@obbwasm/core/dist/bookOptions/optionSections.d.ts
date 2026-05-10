/**
 * Regroupe les ids du registre pour l’affichage en sections (colonnes responsives).
 */
export declare const BOOK_OPTION_SECTION_KEYS: readonly ["structure", "headersPages", "typography", "content", "backMatter"];
export type BookOptionSectionKey = (typeof BOOK_OPTION_SECTION_KEYS)[number];
/** Chaque option du registre apparaît une fois. */
export declare const BOOK_OPTION_SECTION_IDS: Record<BookOptionSectionKey, string[]>;
//# sourceMappingURL=optionSections.d.ts.map
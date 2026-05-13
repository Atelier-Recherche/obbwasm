/**
 * Regroupe les ids du registre pour l’affichage en sections (colonnes responsives).
 */
export const BOOK_OPTION_SECTION_KEYS = [
  "structure",
  "headersPages",
  "typography",
  "content",
  "backMatter",
] as const;

export type BookOptionSectionKey = (typeof BOOK_OPTION_SECTION_KEYS)[number];

/** Chaque option du registre apparaît une fois. */
export const BOOK_OPTION_SECTION_IDS: Record<BookOptionSectionKey, string[]> = {
  structure: [
    "cover-page",
    "half-title-page",
    "title-page",
    "front-title-recto-with-blank-before",
    "section-new-page",
    "section-title-recto-with-blank-before",
    "toc-position",
    "toc-depth",
    "bibliography-position",
  ],
  headersPages: [
    "chapter-title-in-header",
    "page-number-placement",
    "header-footer-rule",
    "page-number-style",
    "chapter-start-odd",
    "binding-gutter-mm",
    "transition-blank-style",
    "widows-orphans",
  ],
  typography: [
    "auto-heading-numbering",
    "h1-typography",
    "drop-cap-first-para",
    "line-spacing-preset",
    "line-spacing-em",
    "body-text-alignment",
    "markdown-horizontal-rule",
    "accent-color",
  ],
  content: ["caption-position", "footnote-scope", "image-treatment"],
  backMatter: ["show-index", "list-figures-style", "show-glossary", "show-annexes", "show-back-cover"],
};

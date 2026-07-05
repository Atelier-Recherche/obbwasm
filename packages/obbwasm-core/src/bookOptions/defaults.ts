import type { BookLayoutState, SectionId } from "./types";

/** Ordre par défaut quand toutes les sections concernées sont actives. */
export const CANONICAL_SECTION_ORDER: SectionId[] = [
  "cover",
  "titleCredits",
  "toc",
  "body",
  "annexes",
  "listFigures",
  "bibliography",
  "indexGlossary",
  "backCover",
];

export function defaultSectionOrder(): SectionId[] {
  return ["body"];
}

/** Valeurs initiales des options (bool / enum string / color). */
export function defaultBookValues(): Record<string, boolean | string> {
  return {
    "chapter-title-in-header": true,
    "page-number-placement": "outer",
    "header-footer-rule": "none",
    "page-number-style": "arabic",
    "auto-heading-numbering": false,
    "h1-typography": "centered",
    "drop-cap-first-para": false,
    "line-spacing-preset": "standard",
    "line-spacing-em": "1.2",
    "body-text-alignment": "justify",
    "markdown-horizontal-rule": "line",
    "chapter-start-odd": false,
    "binding-gutter-mm": "0",
    "transition-blank-style": "empty",
    "caption-position": "below",
    "footnote-scope": "document",
    "image-treatment": "auto-margins",
    "accent-color": "#333333",
    "show-index": false,
    "list-figures-style": "none",
    "show-glossary": false,
    "cover-page": false,
    "half-title-page": false,
    "title-page": false,
    "front-title-recto-with-blank-before": false,
    "section-new-page": false,
    "hide-page-number-on-section-title": true,
    "section-title-recto-with-blank-before": false,
    "toc-position": "none",
    "toc-depth": "3",
    "bibliography-position": "none",
    "widows-orphans": "on",
    "show-annexes": false,
    "show-back-cover": false,
  };
}

export function defaultBookLayoutState(): BookLayoutState {
  return {
    documentLang: "fr",
    stringOverrides: {},
    sectionOrder: defaultSectionOrder(),
    values: defaultBookValues(),
  };
}

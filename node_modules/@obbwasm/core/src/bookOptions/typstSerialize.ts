import type { BookLayoutState, SectionId } from "./types";
import type { StringOverrideKey } from "./registry";

/** Motifs Typst pour `counter(page).display(...)`. */
function pageNumberPattern(style: string): string {
  if (style === "roman") return "i";
  if (style === "page-n-of-m") return "1"; // complété par en-tête personnalisé si besoin
  return "1";
}

/** Numérotation des titres : chaîne Typst ou none. */
function headingNumberingPattern(auto: boolean): string {
  return auto ? "1.1.1" : "none";
}

function typstBool(v: boolean): string {
  return v ? "true" : "false";
}

function typstStr(s: string): string {
  return JSON.stringify(s);
}

/** Garantit la section `body` (contenu Pandoc) dans l’ordre émis vers Typst. */
export function ensureSectionOrderForTypst(order: SectionId[]): SectionId[] {
  const o = [...order];
  if (!o.includes("body")) {
    const ti = o.indexOf("toc");
    const insert = ti >= 0 ? ti + 1 : 0;
    o.splice(insert, 0, "body");
  }
  return o;
}

/**
 * Tableau Typst pour `section-order`.
 * Typst : un seul élément doit s’écrire `("body",)` avec une virgule finale ; sinon `("body")`
 * est une chaîne parenthésée et `for sid in …` itère sur les caractères → PDF vide.
 */
export function typstSectionOrderArray(order: string[]): string {
  if (order.length === 0) return `()`;
  const inner = order.map((id) => typstStr(id)).join(", ");
  return order.length === 1 ? `(${inner},)` : `(${inner})`;
}

/**
 * Lignes à mettre dans `let opts = (` … `)` pour `render(opts)`.
 */
export function buildTypstOptsLines(
  state: BookLayoutState,
  resolvedDocStrings: Record<StringOverrideKey | string, string>,
  meta: { title: string; author: string; publisher: string },
): string[] {
  const v = state.values;
  const getStr = (key: string, fallback = ""): string => String(v[key] ?? fallback);
  const getBool = (key: string): boolean => v[key] === true;

  const autoNum = getBool("auto-heading-numbering");
  const pageStyle = getStr("page-number-style", "arabic");
  const tocPos = getStr("toc-position", "none");
  const bibPos = getStr("bibliography-position", "none");
  const bindMm = getStr("binding-gutter-mm", "0");

  const tocAtStart = tocPos === "start";
  const tocAtEnd = tocPos === "end";

  const bibAtStart = bibPos === "start";
  const bibAtEnd = bibPos === "end";

  const lines: string[] = [
    `    title: ${typstStr(meta.title)},`,
    `    author: ${typstStr(meta.author)},`,
    `    edition: ${typstStr(meta.publisher)},`,
    `    cover-page: ${typstBool(getBool("cover-page"))},`,
    `    half-title-page: ${typstBool(getBool("half-title-page"))},`,
    `    title-page: ${typstBool(getBool("title-page"))},`,
    `    front-title-recto-with-blank-before: ${typstBool(getBool("front-title-recto-with-blank-before"))},`,
    `    section-new-page: ${typstBool(getBool("section-new-page"))},`,
    `    section-title-recto-with-blank-before: ${typstBool(getBool("section-title-recto-with-blank-before"))},`,
    `    toc-at-start: ${typstBool(tocAtStart)},`,
    `    toc-at-end: ${typstBool(tocAtEnd)},`,
    `    toc-position: ${typstStr(tocPos)},`,
    `    toc-depth: ${typstStr(getStr("toc-depth", "3"))},`,
    `    bibliography-at-start: ${typstBool(bibAtStart)},`,
    `    bibliography-at-end: ${typstBool(bibAtEnd)},`,
    `    bibliography-position: ${typstStr(bibPos)},`,
    `    chapter-title-in-header: ${typstBool(getBool("chapter-title-in-header"))},`,
    `    page-number-placement: ${typstStr(getStr("page-number-placement", "outer"))},`,
    `    header-footer-rule: ${typstStr(getStr("header-footer-rule", "none"))},`,
    `    page-number-style: ${typstStr(pageStyle)},`,
    `    page-numbering-pattern: ${typstStr(pageNumberPattern(pageStyle))},`,
    `    heading-numbering: ${typstStr(headingNumberingPattern(autoNum))},`,
    `    auto-heading-numbering: ${typstBool(autoNum)},`,
    `    h1-typography: ${typstStr(getStr("h1-typography", "centered"))},`,
    `    drop-cap-first-para: ${typstBool(getBool("drop-cap-first-para"))},`,
    `    line-spacing-preset: ${typstStr(getStr("line-spacing-preset", "standard"))},`,
    `    body-text-alignment: ${typstStr(getStr("body-text-alignment", "justify"))},`,
    `    chapter-start-odd: ${typstBool(getBool("chapter-start-odd"))},`,
    `    binding-gutter: ${bindMm}mm,`,
    `    transition-blank-style: ${typstStr(getStr("transition-blank-style", "empty"))},`,
    `    caption-position: ${typstStr(getStr("caption-position", "below"))},`,
    `    footnote-scope: ${typstStr(getStr("footnote-scope", "document"))},`,
    `    image-treatment: ${typstStr(getStr("image-treatment", "auto-margins"))},`,
    `    accent-color: ${typstStr(getStr("accent-color", "#333333"))},`,
    `    show-index: ${typstBool(getBool("show-index"))},`,
    `    list-figures-style: ${typstStr(getStr("list-figures-style", "none"))},`,
    `    show-glossary: ${typstBool(getBool("show-glossary"))},`,
    `    widows-orphans: ${typstStr(getStr("widows-orphans", "on"))},`,
    `    show-annexes: ${typstBool(getBool("show-annexes"))},`,
    `    show-back-cover: ${typstBool(getBool("show-back-cover"))},`,
    `    document-lang: ${typstStr(state.documentLang)},`,
    `    section-order: ${typstSectionOrderArray(ensureSectionOrderForTypst(state.sectionOrder).map(String))},`,
    `    label-toc: ${typstStr(resolvedDocStrings["label-toc"] ?? "")},`,
    `    label-bibliography: ${typstStr(resolvedDocStrings["label-bibliography"] ?? "")},`,
    `    label-index: ${typstStr(resolvedDocStrings["label-index"] ?? "")},`,
    `    label-glossary: ${typstStr(resolvedDocStrings["label-glossary"] ?? "")},`,
    `    label-list-figures: ${typstStr(resolvedDocStrings["label-list-figures"] ?? "")},`,
    `    label-annexes: ${typstStr(resolvedDocStrings["label-annexes"] ?? "")},`,
  ];

  return lines;
}

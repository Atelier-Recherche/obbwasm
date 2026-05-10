import type { DocumentLang } from "./types";
import type { StringOverrideKey } from "./registry";
import fr from "../locales/fr.json";
import en from "../locales/en.json";
import de from "../locales/de.json";
import es from "../locales/es.json";

type DocBlock = typeof fr.doc;

const DOC_BY_LANG: Record<DocumentLang, DocBlock> = {
  fr: fr.doc,
  en: en.doc,
  de: de.doc,
  es: es.doc,
};

const OVERRIDE_TO_DOCKEY: Record<StringOverrideKey, keyof DocBlock> = {
  "label-toc": "labelToc",
  "label-bibliography": "labelBibliography",
  "label-index": "labelIndex",
  "label-glossary": "labelGlossary",
  "label-list-figures": "labelListFigures",
  "label-annexes": "labelAnnexes",
};

/** Chaînes injectées dans Typst (fallback selon la langue du document). */
export function resolveDocStrings(
  documentLang: DocumentLang,
  overrides: Partial<Record<StringOverrideKey, string>>,
): Record<StringOverrideKey, string> {
  const doc = DOC_BY_LANG[documentLang] ?? DOC_BY_LANG.fr;
  const out = {} as Record<StringOverrideKey, string>;
  (Object.keys(OVERRIDE_TO_DOCKEY) as StringOverrideKey[]).forEach((key) => {
    const raw = overrides[key]?.trim();
    const fallback = doc[OVERRIDE_TO_DOCKEY[key]] ?? "";
    out[key] = raw || fallback;
  });
  return out;
}

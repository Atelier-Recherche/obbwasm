/**
 * Pandoc + citeproc ajoute en fin de document Typst un bloc du type :
 * `#block[ … ] <refs>` (références numérotées / labels `<ref-…>`).
 * On le découpe pour pouvoir le placer selon `bibliography-position` dans le gabarit.
 */
export function splitPandocTypstBodyAndBibliography(typst: string): {
  body: string;
  bibliography: string | null;
} {
  const trimmed = typst.replace(/\s+$/, "");
  const re = /\n#block\[[\s\S]*\]\s*<refs>\s*$/;
  const m = trimmed.match(re);
  if (!m || m.index === undefined || m.index < 0) {
    return { body: typst, bibliography: null };
  }
  const bibliography = trimmed.slice(m.index).trim();
  const body = trimmed.slice(0, m.index).trimEnd();
  return { body, bibliography };
}

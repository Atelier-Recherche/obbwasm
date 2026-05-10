/** Bloc commenté en tête des .typ — parsé sans exécuter Typst. */

export type TemplateMeta = {
  nomComplet: string;
  version: string;
  detail: string;
  format: string;
};

const EMPTY: TemplateMeta = {
  nomComplet: "",
  version: "",
  detail: "",
  format: "",
};

/**
 * Extrait les métadonnées entre marqueurs :
 * // @obbwasm-meta begin
 * // nom-complet: ...
 * // version: v1.0
 * // detail: ...
 * // format: slug
 * // @obbwasm-meta end
 */
export function parseTemplateMeta(source: string): TemplateMeta {
  const lines = source.split(/\r?\n/);
  let i = 0;
  for (; i < lines.length; i++) {
    if (lines[i].includes("@obbwasm-meta begin")) {
      i += 1;
      break;
    }
  }
  const out = { ...EMPTY };
  for (; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes("@obbwasm-meta end")) break;
    const m = line.match(/^\/\/\s*([a-z-]+)\s*:\s*(.*)$/i);
    if (!m) continue;
    const key = m[1].toLowerCase();
    const val = m[2].trim();
    if (key === "nom-complet") out.nomComplet = val;
    else if (key === "version") out.version = val;
    else if (key === "detail") out.detail = val;
    else if (key === "format") out.format = val;
  }
  return out;
}

export function displayTitle(meta: TemplateMeta, fallbackName: string): string {
  return meta.nomComplet.trim() || fallbackName;
}

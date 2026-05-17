import { yieldToMainThread } from "./asyncYield.js";
import { slugifyObsidianAnchor } from "./wikiGlossaryIndex.js";

/** Identifiants Typst déclarés dans une ou plusieurs sources `.typ`. */
export function collectTypstLabelIds(...sources: Array<string | null | undefined>): Set<string> {
  const ids = new Set<string>();
  for (const typst of sources) {
    if (!typst) continue;
    for (const m of typst.matchAll(/#label\(\s*"([^"]+)"\s*\)/g)) {
      ids.add(m[1]);
    }
    for (const m of typst.matchAll(/#heading\([^)]*label:\s*"([^"]+)"/g)) {
      ids.add(m[1]);
    }
    // Pandoc Typst : `#heading(…)[Titre] <identifiant>`
    for (const m of typst.matchAll(/#heading\([^)]*\)\[[^\]]+\]\s*<([a-zA-Z0-9_.:-]+)>/g)) {
      ids.add(m[1]);
    }
    // Titres setext-style Pandoc : `= Titre <id>`
    for (const m of typst.matchAll(/^=+\s+[^\n<]*<([a-zA-Z0-9_.:-]+)>\s*$/gm)) {
      ids.add(m[1]);
    }
  }
  return ids;
}

/**
 * Wikilinks Obsidian hors glossaire / index : pas de note cible dans le même PDF —
 * on garde le libellé affiché pour éviter des `#link(<slug>)` vers des labels inexistants.
 */
export function stripNonBookWikiLinks(markdown: string): string {
  return markdown.replace(/\[\[([^\]]+)\]\]/g, (full, inner: string, offset, whole) => {
    // Notes de bas de page Word/HTML : [[12]](#_ftn12) — pas un wikilink Obsidian.
    if (whole.slice(offset + full.length).startsWith("(")) return full;
    const noteKey = inner.split("#")[0].split("|")[0].trim().toLowerCase();
    if (noteKey === "glossaire" || noteKey === "index") return full;
    if (inner.includes("|")) {
      return inner.split("|").pop()!.trim();
    }
    if (inner.includes("#")) {
      const anchor = inner.split("#").pop()!.trim();
      return anchor || inner.trim();
    }
    return inner.trim();
  });
}

function stripTypstLinkMatch(full: string, slug: string, text: string | undefined, defined: Set<string>): string {
  if (defined.has(slug)) return full;
  if (text !== undefined && text.length > 0) return text;
  return "";
}

/** Ferme `]` en comptant les crochets imbriqués (évite regex catastrophiques sur gros textes). */
function closeTypstBracketContent(s: string, openBracket: number): number {
  let depth = 0;
  for (let i = openBracket; i < s.length; i++) {
    const c = s[i];
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

function skipWs(s: string, i: number): number {
  while (i < s.length && /\s/.test(s[i]!)) i++;
  return i;
}

/**
 * Parse `#link(<slug>)` / `#link(label("slug"))` + corps `[…]` optionnel sans backtracking exponentiel.
 */
function patchTypstLinksLinear(typst: string, defined: Set<string>): string {
  const needle = "#link(";
  let out = "";
  let i = 0;

  while (i < typst.length) {
    const start = typst.indexOf(needle, i);
    if (start === -1) {
      out += typst.slice(i);
      break;
    }
    out += typst.slice(i, start);

    let p = start + needle.length;
    p = skipWs(typst, p);

    let slug: string | null = null;

    if (typst.startsWith("label(", p)) {
      p += 6;
      p = skipWs(typst, p);
      if (typst[p] !== '"') {
        out += typst.slice(start, start + needle.length);
        i = start + needle.length;
        continue;
      }
      p++;
      const slugStart = p;
      while (p < typst.length && typst[p] !== '"') p++;
      slug = typst.slice(slugStart, p);
      if (typst[p] === '"') p++;
      p = skipWs(typst, p);
      if (!typst.startsWith(")", p)) {
        out += typst.slice(start, start + needle.length);
        i = start + needle.length;
        continue;
      }
      p++;
    } else if (typst[p] === "<") {
      p++;
      const slugStart = p;
      while (p < typst.length && /[a-zA-Z0-9_.:-]/.test(typst[p]!)) p++;
      slug = typst.slice(slugStart, p);
      p = skipWs(typst, p);
      if (typst[p] !== ">") {
        out += typst.slice(start, start + needle.length);
        i = start + needle.length;
        continue;
      }
      p++;
    } else {
      out += typst.slice(start, start + needle.length);
      i = start + needle.length;
      continue;
    }

    p = skipWs(typst, p);
    if (typst[p] !== ")") {
      out += typst.slice(start, start + needle.length);
      i = start + needle.length;
      continue;
    }
    p++;

    let text: string | undefined;
    let end = p;
    end = skipWs(typst, end);
    if (typst[end] === "[") {
      const close = closeTypstBracketContent(typst, end);
      if (close !== -1) {
        text = typst.slice(end + 1, close);
        end = close + 1;
      }
    }

    const full = typst.slice(start, end);
    out += stripTypstLinkMatch(full, slug ?? "", text, defined);
    i = end;
  }

  return out;
}

/**
 * Remplace les liens internes Pandoc vers des labels absents par le texte seul (ou rien).
 */
export function patchPandocTypstBrokenLabelRefs(
  typst: string,
  definedLabels?: Iterable<string>,
): string {
  if (!typst) return typst;
  const defined = definedLabels ? new Set(definedLabels) : collectTypstLabelIds(typst);
  let s = patchTypstLinksLinear(typst, defined);
  s = s.replace(/\n{3,}/g, "\n\n");
  return s;
}

/** Variante async : cède le thread tous les ~64 Ko pour les très longs Typst. */
export async function patchPandocTypstBrokenLabelRefsAsync(
  typst: string,
  definedLabels?: Iterable<string>,
): Promise<string> {
  if (!typst || typst.length < 200_000) {
    return patchPandocTypstBrokenLabelRefs(typst, definedLabels);
  }
  await yieldToMainThread();
  return patchPandocTypstBrokenLabelRefs(typst, definedLabels);
}

/**
 * Ajoute `#label("…")` après les titres Pandoc qui n’en ont pas encore (auto_identifiers).
 */
export function injectTypstHeadingLabels(typst: string): string {
  return typst.replace(/#heading\(([^)]*)\)\[([^\]]+)\](?!\s*<)/g, (full, args: string, title: string) => {
    if (/label\s*:/.test(args)) return full;
    const slug = slugifyObsidianAnchor(title);
    if (!slug) return full;
    return `${full}\n#label("${slug}")`;
  });
}

/** Obsidian `![[fichier]]` → `![](fichier)` pour que Pandoc traite les images locales. */
export function normalizeWikiImagesForPandoc(markdown: string): string {
  return markdown.replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, path: string) => `![](${path.trim()})`);
}

/**
 * Raccourcis du type `[@clef p44]` (sans virgule) : Pandoc envoie un locator littéral « p44 » à citeproc,
 * qui ajoute déjà le libellé de page du CSL (« p. ») → rendu « p. p44 ». Même problème avec `[@clef, p44]`.
 * La forme canonique Pandoc est `[@clef, 44]` ou `[@clef, p. 44]` (virgule après la clé).
 */
export function normalizePandocCitationPageShorthand(markdown: string): string {
  let s = markdown;
  s = s.replace(/\[@([^\s\],]+)\s*,\s*p(\d+)\]/g, "[@$1, $2]");
  s = s.replace(/\[@([^\s\],]+)\s+p(\d+)\]/g, "[@$1, $2]");
  return s;
}

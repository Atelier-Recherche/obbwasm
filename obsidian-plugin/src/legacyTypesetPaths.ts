/** Migre les chemins enregistrés avant l’aplatissement `typeset/typst/` → `typeset/`. */
export function migrateLegacyTypesetPath(p: string): string {
  const t = p?.trim() ?? "";
  if (!t) return t;
  return t.replace(/typeset\/typst\//g, "typeset/");
}

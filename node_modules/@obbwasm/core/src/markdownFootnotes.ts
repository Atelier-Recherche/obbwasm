/**
 * Normalise les notes inline Pandoc/Obsidian `^[…]`.
 * Un `]` de fermeture échappé (`\]`) empêche Pandoc de reconnaître la note ;
 * on le déséchappe uniquement quand aucun `]` non échappé ne ferme la note.
 */
export function normalizeInlineFootnotes(markdown: string): string {
  if (!markdown || !markdown.includes("^[")) return markdown;

  let out = "";
  let i = 0;
  const s = markdown;

  while (i < s.length) {
    if (s[i] === "^" && s[i + 1] === "[") {
      const bodyStart = i + 2;
      let j = bodyStart;
      let depth = 1;
      const escapedCloseAtDepth1: number[] = [];

      while (j < s.length) {
        const c = s[j]!;
        if (c === "\\" && j + 1 < s.length) {
          if (s[j + 1] === "]" && depth === 1) {
            escapedCloseAtDepth1.push(j);
          }
          j += 2;
          continue;
        }
        if (c === "[") {
          depth++;
          j++;
          continue;
        }
        if (c === "]") {
          depth--;
          j++;
          if (depth === 0) break;
          continue;
        }
        j++;
      }

      if (depth === 0) {
        // Note correctement fermée : conserver telle quelle (y compris `\]` internes).
        out += s.slice(i, j);
        i = j;
        continue;
      }

      if (escapedCloseAtDepth1.length > 0) {
        const closePos = escapedCloseAtDepth1[0]!;
        out += s.slice(i, closePos);
        out += "]";
        i = closePos + 2;
        continue;
      }

      out += s[i];
      i++;
      continue;
    }

    out += s[i];
    i++;
  }

  return out;
}

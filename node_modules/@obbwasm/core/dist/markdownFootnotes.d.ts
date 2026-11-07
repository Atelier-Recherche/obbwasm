/**
 * Normalise les notes inline Pandoc/Obsidian `^[…]`.
 * Un `]` de fermeture échappé (`\]`) empêche Pandoc de reconnaître la note ;
 * on le déséchappe uniquement quand aucun `]` non échappé ne ferme la note.
 */
export declare function normalizeInlineFootnotes(markdown: string): string;
//# sourceMappingURL=markdownFootnotes.d.ts.map
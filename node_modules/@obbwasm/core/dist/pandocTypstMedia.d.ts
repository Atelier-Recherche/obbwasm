/**
 * Correctifs du writer Pandoc → Typst (images, liens vides) avant virtualisation des médias.
 */
/** Retire les images / liens Markdown sans cible (évite `URL must not be empty` côté Typst). */
export declare function stripBrokenMarkdownMedia(markdown: string): string;
/**
 * Pandoc récent : `image.decode(read("…"))` → `image("…")` (Typst 0.15+).
 * Supprime aussi les `image("")` / `#link("")` qui provoquent « URL must not be empty ».
 */
export declare function patchPandocTypstMedia(typst: string): string;
//# sourceMappingURL=pandocTypstMedia.d.ts.map
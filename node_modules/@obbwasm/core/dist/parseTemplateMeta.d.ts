/** Bloc commenté en tête des .typ — parsé sans exécuter Typst. */
export type TemplateMeta = {
    nomComplet: string;
    version: string;
    detail: string;
    format: string;
    /** Identifiants d’options supportées par le gabarit (vide = tout le registre affiché). */
    supportedOptions: string[];
};
/**
 * Extrait les métadonnées entre marqueurs :
 * // @obbwasm-meta begin
 * // nom-complet: ...
 * // version: v1.0
 * // detail: ...
 * // format: slug
 * // supported-options: cover-page, toc-position, …
 * // @obbwasm-meta end
 */
export declare function parseTemplateMeta(source: string): TemplateMeta;
export declare function filterOptionIdsByTemplate(allIds: string[], supportedOptions: string[]): string[];
export declare function displayTitle(meta: TemplateMeta, fallbackName: string): string;
/**
 * Compte pour pastille « X / Y » : Y = taille du registre ;
 * X = nombre d’options déclarées dans le gabarit (ids valides), ou tout le registre si la ligne est absente / vide.
 */
export declare function supportedOptionsBadgeCounts(meta: TemplateMeta | undefined): {
    supported: number;
    total: number;
};
//# sourceMappingURL=parseTemplateMeta.d.ts.map
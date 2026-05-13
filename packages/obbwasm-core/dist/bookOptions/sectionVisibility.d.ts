import type { SectionId } from "./types";
export declare function isSectionActive(values: Record<string, boolean | string>, id: SectionId): boolean;
/** Retire les sections inactives et insère les sections activées manquantes (ordre canonique relatif). */
export declare function mergeSectionOrderWithActive(prev: SectionId[], values: Record<string, boolean | string>): SectionId[];
export declare function applyTocAndBibPlacement(order: SectionId[], values: Record<string, boolean | string>): SectionId[];
/**
 * Ajoute ou retire des sections selon les options actives, sans réordonner la TOC ni la bibliographie :
 * l’ordre manuel (liste à flèches / glisser-déposer) reste donc stable au chargement et après un simple ↑↓.
 */
export declare function reconcileSectionOrder(prev: SectionId[], values: Record<string, boolean | string>): SectionId[];
/**
 * Met à jour `toc-position` et `bibliography-position` pour refléter la position réelle de ces blocs
 * par rapport au corps (après réordonnancement manuel).
 */
export declare function syncPlacementValuesFromSectionOrder(values: Record<string, boolean | string>, sectionOrder: SectionId[]): Record<string, boolean | string>;
//# sourceMappingURL=sectionVisibility.d.ts.map
import type { SectionId } from "./types";
export declare function isSectionActive(values: Record<string, boolean | string>, id: SectionId): boolean;
/** Retire les sections inactives et insère les sections activées manquantes (ordre canonique relatif). */
export declare function mergeSectionOrderWithActive(prev: SectionId[], values: Record<string, boolean | string>): SectionId[];
export declare function applyTocAndBibPlacement(order: SectionId[], values: Record<string, boolean | string>): SectionId[];
/** Réconciliation complète après changement d’option ou chargement. */
export declare function reconcileSectionOrder(prev: SectionId[], values: Record<string, boolean | string>): SectionId[];
//# sourceMappingURL=sectionVisibility.d.ts.map
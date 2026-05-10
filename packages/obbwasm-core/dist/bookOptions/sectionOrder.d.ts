import type { SectionId } from "./types";
/** Sections situées avant le corps dans l’ordre « livre » classique. */
declare const BEFORE_BODY: SectionId[];
declare const AFTER_BODY: SectionId[];
declare function ensureContains(order: SectionId[], id: SectionId): SectionId[];
declare function removeId(order: SectionId[], id: SectionId): SectionId[];
/**
 * Place la section TOC avant ou après le corps, ou retire la TOC.
 */
export declare function applyTocPosition(order: SectionId[], tocPosition: "none" | "start" | "end"): SectionId[];
/**
 * Bibliographie : avant/après corps ou retirée de l’ordre (le bloc est encore contrôlé par bibliography-position côté Typst).
 */
export declare function applyBibliographyPosition(order: SectionId[], bibPosition: "none" | "start" | "end"): SectionId[];
export declare function deriveTocPosition(order: SectionId[]): "none" | "start" | "end";
export declare function deriveBibliographyPosition(order: SectionId[]): "none" | "start" | "end";
export { BEFORE_BODY, AFTER_BODY, ensureContains, removeId };
//# sourceMappingURL=sectionOrder.d.ts.map
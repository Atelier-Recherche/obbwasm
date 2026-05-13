import { CANONICAL_SECTION_ORDER } from "./defaults";
import { applyBibliographyPosition, applyTocPosition, deriveBibliographyPosition, deriveTocPosition, } from "./sectionOrder";
export function isSectionActive(values, id) {
    const tp = String(values["toc-position"] ?? "none");
    const bp = String(values["bibliography-position"] ?? "none");
    const lfs = String(values["list-figures-style"] ?? "none");
    switch (id) {
        case "cover":
            return values["cover-page"] === true;
        case "titleCredits":
            return values["half-title-page"] === true || values["title-page"] === true;
        case "toc":
            return tp !== "none";
        case "body":
            return true;
        case "annexes":
            return values["show-annexes"] === true;
        case "listFigures":
            return lfs !== "none";
        case "bibliography":
            return bp !== "none";
        case "indexGlossary":
            return values["show-index"] === true || values["show-glossary"] === true;
        case "backCover":
            return values["show-back-cover"] === true;
        default:
            return false;
    }
}
/** Retire les sections inactives et insère les sections activées manquantes (ordre canonique relatif). */
export function mergeSectionOrderWithActive(prev, values) {
    const activeSet = new Set(CANONICAL_SECTION_ORDER.filter((id) => isSectionActive(values, id)));
    let next = prev.filter((id) => activeSet.has(id));
    for (const id of CANONICAL_SECTION_ORDER) {
        if (!activeSet.has(id) || next.includes(id))
            continue;
        const canonIdx = CANONICAL_SECTION_ORDER.indexOf(id);
        let insertAt = next.length;
        for (let i = 0; i < next.length; i++) {
            const ni = CANONICAL_SECTION_ORDER.indexOf(next[i]);
            if (ni > canonIdx) {
                insertAt = i;
                break;
            }
        }
        next.splice(insertAt, 0, id);
    }
    if (!next.includes("body")) {
        const tocI = next.indexOf("toc");
        const insert = tocI >= 0 ? tocI + 1 : 0;
        next.splice(insert, 0, "body");
    }
    return next;
}
export function applyTocAndBibPlacement(order, values) {
    const tp = String(values["toc-position"] ?? "none");
    const bp = String(values["bibliography-position"] ?? "none");
    let o = order;
    if (tp === "none") {
        o = o.filter((id) => id !== "toc");
    }
    else if (tp === "start") {
        o = applyTocPosition(o, "start");
    }
    else {
        o = applyTocPosition(o, "end");
    }
    if (bp === "none") {
        o = o.filter((id) => id !== "bibliography");
    }
    else if (bp === "start") {
        o = applyBibliographyPosition(o, "start");
    }
    else {
        o = applyBibliographyPosition(o, "end");
    }
    return o;
}
/**
 * Ajoute ou retire des sections selon les options actives, sans réordonner la TOC ni la bibliographie :
 * l’ordre manuel (liste à flèches / glisser-déposer) reste donc stable au chargement et après un simple ↑↓.
 */
export function reconcileSectionOrder(prev, values) {
    return mergeSectionOrderWithActive(prev, values);
}
/**
 * Met à jour `toc-position` et `bibliography-position` pour refléter la position réelle de ces blocs
 * par rapport au corps (après réordonnancement manuel).
 */
export function syncPlacementValuesFromSectionOrder(values, sectionOrder) {
    const next = { ...values };
    const tp = deriveTocPosition(sectionOrder);
    const bp = deriveBibliographyPosition(sectionOrder);
    if (String(values["toc-position"] ?? "none") !== "none" && tp !== "none") {
        next["toc-position"] = tp;
    }
    if (String(values["bibliography-position"] ?? "none") !== "none" && bp !== "none") {
        next["bibliography-position"] = bp;
    }
    return next;
}
//# sourceMappingURL=sectionVisibility.js.map
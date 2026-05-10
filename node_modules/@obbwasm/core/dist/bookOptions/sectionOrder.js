import { CANONICAL_SECTION_ORDER } from "./defaults";
/** Sections situées avant le corps dans l’ordre « livre » classique. */
const BEFORE_BODY = ["cover", "titleCredits", "toc"];
const AFTER_BODY = ["annexes", "listFigures", "bibliography", "indexGlossary", "backCover"];
function ensureContains(order, id) {
    if (order.includes(id))
        return [...order];
    const canon = CANONICAL_SECTION_ORDER.indexOf(id);
    if (canon < 0)
        return [...order, id];
    let insertAt = order.length;
    for (let i = 0; i < order.length; i++) {
        const idx = CANONICAL_SECTION_ORDER.indexOf(order[i]);
        if (idx > canon) {
            insertAt = i;
            break;
        }
    }
    const next = [...order];
    next.splice(insertAt, 0, id);
    return next;
}
function removeId(order, id) {
    return order.filter((x) => x !== id);
}
/**
 * Place la section TOC avant ou après le corps, ou retire la TOC.
 */
export function applyTocPosition(order, tocPosition) {
    let next = removeId(order, "toc");
    if (tocPosition === "none")
        return next;
    const bodyIdx = next.indexOf("body");
    if (tocPosition === "start") {
        const insert = bodyIdx >= 0 ? bodyIdx : next.length;
        next = [...next.slice(0, insert), "toc", ...next.slice(insert)];
        return next;
    }
    // end
    const insert = bodyIdx >= 0 ? bodyIdx + 1 : next.length;
    next = [...next.slice(0, insert), "toc", ...next.slice(insert)];
    return next;
}
/**
 * Bibliographie : avant/après corps ou retirée de l’ordre (le bloc est encore contrôlé par bibliography-position côté Typst).
 */
export function applyBibliographyPosition(order, bibPosition) {
    let next = removeId(order, "bibliography");
    if (bibPosition === "none")
        return next;
    const bodyIdx = next.indexOf("body");
    if (bibPosition === "start") {
        const insert = bodyIdx >= 0 ? bodyIdx : next.length;
        next = [...next.slice(0, insert), "bibliography", ...next.slice(insert)];
        return next;
    }
    const insert = bodyIdx >= 0 ? bodyIdx + 1 : next.length;
    next = [...next.slice(0, insert), "bibliography", ...next.slice(insert)];
    return next;
}
export function deriveTocPosition(order) {
    const ti = order.indexOf("toc");
    const bi = order.indexOf("body");
    if (ti < 0)
        return "none";
    if (bi < 0)
        return "start";
    return ti < bi ? "start" : "end";
}
export function deriveBibliographyPosition(order) {
    const ix = order.indexOf("bibliography");
    const bi = order.indexOf("body");
    if (ix < 0)
        return "none";
    if (bi < 0)
        return "start";
    return ix < bi ? "start" : "end";
}
export { BEFORE_BODY, AFTER_BODY, ensureContains, removeId };
//# sourceMappingURL=sectionOrder.js.map
import type { SectionId } from "./types";
import { CANONICAL_SECTION_ORDER } from "./defaults";
import { applyBibliographyPosition, applyTocPosition } from "./sectionOrder";

export function isSectionActive(values: Record<string, boolean | string>, id: SectionId): boolean {
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
export function mergeSectionOrderWithActive(
  prev: SectionId[],
  values: Record<string, boolean | string>,
): SectionId[] {
  const activeSet = new Set(CANONICAL_SECTION_ORDER.filter((id) => isSectionActive(values, id)));
  let next = prev.filter((id) => activeSet.has(id));
  for (const id of CANONICAL_SECTION_ORDER) {
    if (!activeSet.has(id) || next.includes(id)) continue;
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

export function applyTocAndBibPlacement(
  order: SectionId[],
  values: Record<string, boolean | string>,
): SectionId[] {
  const tp = String(values["toc-position"] ?? "none") as "none" | "start" | "end";
  const bp = String(values["bibliography-position"] ?? "none") as "none" | "start" | "end";
  let o = order;
  if (tp === "none") {
    o = o.filter((id) => id !== "toc");
  } else if (tp === "start") {
    o = applyTocPosition(o, "start");
  } else {
    o = applyTocPosition(o, "end");
  }
  if (bp === "none") {
    o = o.filter((id) => id !== "bibliography");
  } else if (bp === "start") {
    o = applyBibliographyPosition(o, "start");
  } else {
    o = applyBibliographyPosition(o, "end");
  }
  return o;
}

/** Réconciliation complète après changement d’option ou chargement. */
export function reconcileSectionOrder(
  prev: SectionId[],
  values: Record<string, boolean | string>,
): SectionId[] {
  let next = mergeSectionOrderWithActive(prev, values);
  next = applyTocAndBibPlacement(next, values);
  return next;
}

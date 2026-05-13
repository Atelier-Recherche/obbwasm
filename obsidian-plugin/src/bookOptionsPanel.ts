import type { BookLayoutState, BookOptionDef, DocumentLang, SectionId } from "@obbwasm/core";
import {
  BOOK_OPTION_BY_ID,
  BOOK_OPTION_SECTION_IDS,
  BOOK_OPTION_SECTION_KEYS,
  BOOK_OPTIONS,
  STRING_OVERRIDE_KEYS,
  countBookOptionsNonDefaultInDefs,
  countNonEmptyStringOverrides,
  expandDependentBookOptionIds,
  filterOptionIdsByTemplate,
  mergeVisibleBookOptionIds,
  syncPlacementValuesFromSectionOrder,
  type TemplateMeta,
} from "@obbwasm/core";
import type frType from "./locales/fr.json";

type Fr = typeof frType;

const OVERRIDE_KEY_TO_DOC: Record<string, keyof Fr["doc"]> = {
  "label-toc": "labelToc",
  "label-bibliography": "labelBibliography",
  "label-index": "labelIndex",
  "label-glossary": "labelGlossary",
  "label-list-figures": "labelListFigures",
  "label-annexes": "labelAnnexes",
};

function optLabel(fr: Fr, def: BookOptionDef): string {
  const o = (fr.options as Record<string, { label?: string }>)[def.labelKey];
  return o?.label ?? def.id;
}

function optEnumLabel(fr: Fr, def: BookOptionDef, value: string): string {
  if (def.kind !== "enum" || !def.enumValues) return value;
  const o = (fr.options as Record<string, { values?: Record<string, string> }>)[def.labelKey];
  return o?.values?.[value] ?? value;
}

function sectionLabel(fr: Fr, id: SectionId): string {
  return (fr.sections as Record<string, string>)[id] ?? id;
}

export function moveInOrder(order: SectionId[], id: SectionId, dir: -1 | 1): SectionId[] {
  const i = order.indexOf(id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return order;
  const next = [...order];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

export type BookOptionsPanelCallbacks = {
  getLayout: () => BookLayoutState;
  setLayout: (next: BookLayoutState) => Promise<void>;
  patchValues: (patch: Partial<Record<string, boolean | string>>) => Promise<void>;
  fr: Fr;
  templateMeta: TemplateMeta | null;
  openSections: Partial<Record<string, boolean>>;
};

export function mountBookOptionsPanel(root: HTMLElement, cb: BookOptionsPanelCallbacks): void {
  const { fr, templateMeta, openSections, getLayout, setLayout, patchValues } = cb;
  root.replaceChildren();

  const allIds = BOOK_OPTIONS.map((o) => o.id);
  const supported = templateMeta?.supportedOptions ?? [];
  const visibleOptionIds = mergeVisibleBookOptionIds(
    expandDependentBookOptionIds(filterOptionIdsByTemplate(allIds, supported)),
  );

  const wrap = document.createElement("div");
  wrap.className = "obb-book-options-form";
  root.appendChild(wrap);

  const hBook = document.createElement("h4");
  hBook.className = "obb-book-options-heading";
  hBook.textContent = fr.ui.bookOptions;
  wrap.appendChild(hBook);

  const metaSaysNone =
    templateMeta != null &&
    supported.length === 1 &&
    supported[0].toLowerCase() === "none";
  if (metaSaysNone && visibleOptionIds.length === 0) {
    const empty = document.createElement("p");
    empty.className = "obbwasm-help-text";
    empty.textContent = fr.ui.bookOptionsNone;
    wrap.appendChild(empty);
    return;
  }

  const langRow = document.createElement("div");
  langRow.className = "obb-book-opt-lang-row";
  const langLab = document.createElement("span");
  langLab.className = "obb-book-opt-label";
  langLab.textContent = fr.ui.documentLanguage;
  const langSel = document.createElement("select");
  langSel.className = "dropdown";
  for (const lang of ["fr", "en", "de", "es"] as DocumentLang[]) {
    const opt = document.createElement("option");
    opt.value = lang;
    opt.textContent =
      lang === "fr" ? "Français" : lang === "en" ? "English" : lang === "de" ? "Deutsch" : "Español";
    langSel.appendChild(opt);
  }
  langSel.value = getLayout().documentLang;
  langSel.addEventListener("change", async () => {
    const layout = getLayout();
    await setLayout({ ...layout, documentLang: langSel.value as DocumentLang });
  });
  langRow.appendChild(langLab);
  langRow.appendChild(langSel);
  wrap.appendChild(langRow);

  const defsById: Record<string, BookOptionDef> = { ...BOOK_OPTION_BY_ID };
  const allow = new Set(visibleOptionIds);

  for (const sectionKey of BOOK_OPTION_SECTION_KEYS) {
    const ids = BOOK_OPTION_SECTION_IDS[sectionKey];
    const defs = ids
      .map((id) => defsById[id])
      .filter((d): d is BookOptionDef => !!d && allow.has(d.id))
      .filter((d) => {
        if (d.id !== "line-spacing-em") return true;
        return getLayout().values["line-spacing-preset"] === "custom";
      });
    if (defs.length === 0) continue;

    const expanded = openSections[sectionKey] === true;
    const nonDefault = countBookOptionsNonDefaultInDefs(defs, getLayout().values);
    const section = document.createElement("section");
    section.className = "obb-book-options-section" + (expanded ? " is-open" : "");

    const head = document.createElement("button");
    head.type = "button";
    head.className = "obb-book-options-section-toggle";
    head.setAttribute("aria-expanded", expanded ? "true" : "false");

    const chev = document.createElement("span");
    chev.className = "obb-book-options-chevron";
    chev.textContent = "▶";
    chev.style.cssText = `display:inline-block;transition:transform .15s;transform:${expanded ? "rotate(90deg)" : "none"}`;

    const title = document.createElement("span");
    title.className = "obb-book-options-section-heading";
    title.textContent = (fr.ui.optionSections as Record<string, string>)[sectionKey] ?? sectionKey;

    const pill = document.createElement("span");
    pill.className = "obb-book-options-count-pill";
    pill.textContent = String(defs.length);

    const pillNd = document.createElement("span");
    pillNd.className =
      "obb-book-options-count-pill" + (nonDefault > 0 ? " obb-book-options-count-pill--nondefault" : " obb-book-options-count-pill--zero");
    pillNd.textContent = String(nonDefault);
    pillNd.title = fr.ui.bookOptionsNonDefaultHint;

    const countWrap = document.createElement("span");
    countWrap.className = "obb-book-options-section-count";
    countWrap.append(pill, pillNd);

    head.append(chev, title, countWrap);

    const grid = document.createElement("div");
    grid.className = "obb-book-options-section-grid";
    grid.hidden = !expanded;

    head.addEventListener("click", () => {
      const on = grid.hidden;
      openSections[sectionKey] = on;
      grid.hidden = !on;
      head.setAttribute("aria-expanded", on ? "true" : "false");
      chev.style.transform = on ? "rotate(90deg)" : "none";
      section.classList.toggle("is-open", on);
    });

    for (const def of defs) {
      grid.appendChild(renderControl(fr, def, getLayout, patchValues));
    }

    section.append(head, grid);
    wrap.appendChild(section);
  }

  const labelsFilled = countNonEmptyStringOverrides(getLayout().stringOverrides, STRING_OVERRIDE_KEYS);
  const labExpanded = openSections.labels === true;
  const labelsSection = document.createElement("section");
  labelsSection.className = "obb-book-options-section obb-book-options-labels" + (labExpanded ? " is-open" : "");

  const lHead = document.createElement("button");
  lHead.type = "button";
  lHead.className = "obb-book-options-section-toggle";
  lHead.setAttribute("aria-expanded", labExpanded ? "true" : "false");

  const lChev = document.createElement("span");
  lChev.className = "obb-book-options-chevron";
  lChev.textContent = "▶";
  lChev.style.cssText = `display:inline-block;transition:transform .15s;transform:${labExpanded ? "rotate(90deg)" : "none"}`;

  const lTitle = document.createElement("span");
  lTitle.className = "obb-book-options-section-heading";
  lTitle.textContent = fr.ui.customLabels;

  const lPill = document.createElement("span");
  lPill.className = "obb-book-options-count-pill";
  lPill.textContent = String(STRING_OVERRIDE_KEYS.length);

  const lPillNd = document.createElement("span");
  lPillNd.className =
    "obb-book-options-count-pill" + (labelsFilled > 0 ? " obb-book-options-count-pill--nondefault" : " obb-book-options-count-pill--zero");
  lPillNd.textContent = String(labelsFilled);
  lPillNd.title = fr.ui.bookOptionsLabelsFilledHint;

  const lCountWrap = document.createElement("span");
  lCountWrap.className = "obb-book-options-section-count";
  lCountWrap.append(lPill, lPillNd);

  lHead.append(lChev, lTitle, lCountWrap);

  const labelsBody = document.createElement("div");
  labelsBody.className = "obb-book-options-labels-grid";
  labelsBody.hidden = !labExpanded;

  const hint = document.createElement("p");
  hint.className = "obbwasm-help-text";
  hint.textContent = fr.ui.stringsPlaceholder;
  labelsBody.appendChild(hint);

  for (const key of STRING_OVERRIDE_KEYS) {
    const row = document.createElement("label");
    row.className = "obb-book-opt-field";
    const sp = document.createElement("span");
    sp.className = "obb-book-opt-label";
    const docK = OVERRIDE_KEY_TO_DOC[key];
    sp.textContent = docK ? String((fr.doc as Record<string, string>)[docK] ?? key) : key;
    const inp = document.createElement("input");
    inp.type = "text";
    inp.value = getLayout().stringOverrides[key] ?? "";
    inp.spellcheck = false;
    inp.addEventListener("change", async () => {
      const layout = getLayout();
      await setLayout({
        ...layout,
        stringOverrides: { ...layout.stringOverrides, [key]: inp.value },
      });
    });
    row.append(sp, inp);
    labelsBody.appendChild(row);
  }

  lHead.addEventListener("click", () => {
    const on = labelsBody.hidden;
    openSections.labels = on;
    labelsBody.hidden = !on;
    lHead.setAttribute("aria-expanded", on ? "true" : "false");
    lChev.style.transform = on ? "rotate(90deg)" : "none";
    labelsSection.classList.toggle("is-open", on);
  });

  labelsSection.append(lHead, labelsBody);
  wrap.appendChild(labelsSection);
}

function renderControl(
  fr: Fr,
  def: BookOptionDef,
  getLayout: () => BookLayoutState,
  patchValues: (p: Partial<Record<string, boolean | string>>) => Promise<void>,
): HTMLElement {
  if (def.kind === "number") {
    const row = document.createElement("label");
    row.className = "obb-book-opt-field inline-field";
    const sp = document.createElement("span");
    sp.className = "obb-book-opt-label";
    sp.textContent = optLabel(fr, def);
    const inp = document.createElement("input");
    inp.type = "number";
    inp.step = "0.05";
    inp.min = "0.5";
    inp.max = "4";
    const cur0 = getLayout().values[def.id];
    inp.value = typeof cur0 === "string" ? cur0 : "1.2";
    inp.addEventListener("change", async () => {
      await patchValues({ [def.id]: inp.value });
    });
    row.append(sp, inp);
    return row;
  }

  if (def.kind === "bool") {
    const row = document.createElement("div");
    row.className = "obb-book-opt-bool";
    const btn = document.createElement("button");
    btn.type = "button";
    const sync = () => {
      const val = getLayout().values[def.id];
      btn.className = "obb-toggle-chip" + (val === true ? " is-on" : "");
    };
    sync();
    btn.textContent = optLabel(fr, def);
    btn.addEventListener("click", async () => {
      const cur = getLayout().values[def.id];
      await patchValues({ [def.id]: !(cur === true) });
      sync();
    });
    row.appendChild(btn);
    return row;
  }

  if (def.kind === "enum" && def.enumValues) {
    const row = document.createElement("label");
    row.className = "obb-book-opt-field inline-field";
    const sp = document.createElement("span");
    sp.className = "obb-book-opt-label";
    sp.textContent = optLabel(fr, def);
    const sel = document.createElement("select");
    sel.className = "dropdown";
    const cur0 = getLayout().values[def.id];
    const cur = typeof cur0 === "string" ? cur0 : def.enumValues[0];
    for (const ev of def.enumValues) {
      const opt = document.createElement("option");
      opt.value = ev;
      opt.textContent = optEnumLabel(fr, def, ev);
      sel.appendChild(opt);
    }
    sel.value = cur;
    sel.addEventListener("change", async () => {
      await patchValues({ [def.id]: sel.value });
    });
    row.append(sp, sel);
    return row;
  }

  const row = document.createElement("label");
  row.className = "obb-book-opt-field inline-field";
  const sp = document.createElement("span");
  sp.className = "obb-book-opt-label";
  sp.textContent = optLabel(fr, def);
  const inp = document.createElement("input");
  inp.type = "text";
  inp.value = typeof getLayout().values[def.id] === "string" ? String(getLayout().values[def.id]) : "";
  inp.spellcheck = false;
  inp.addEventListener("change", async () => {
    await patchValues({ [def.id]: inp.value });
  });
  row.append(sp, inp);
  return row;
}

export function mountSectionOrderPanel(
  root: HTMLElement,
  fr: Fr,
  getLayout: () => BookLayoutState,
  setLayout: (next: BookLayoutState) => Promise<void>,
): void {
  root.replaceChildren();
  const h = document.createElement("h4");
  h.className = "obb-book-options-heading";
  h.textContent = fr.ui.sectionOrder;
  root.appendChild(h);

  const hint = document.createElement("p");
  hint.className = "obbwasm-help-text";
  hint.textContent = fr.ui.sectionOrderHint.replace("Glisser-déposer", "Flèches");
  root.appendChild(hint);

  const list = document.createElement("div");
  list.className = "obb-section-order-list";
  root.appendChild(list);

  function redraw() {
    list.replaceChildren();
    for (const id of getLayout().sectionOrder) {
      const row = document.createElement("div");
      row.className = "obb-section-order-row";
      const grip = document.createElement("span");
      grip.className = "obb-section-order-grip";
      grip.textContent = "⋮⋮";
      const lab = document.createElement("span");
      lab.textContent = sectionLabel(fr, id);
      const btns = document.createElement("span");
      btns.className = "obb-section-order-btns";
      const up = document.createElement("button");
      up.type = "button";
      up.textContent = "↑";
      up.className = "mod-muted";
      const down = document.createElement("button");
      down.type = "button";
      down.textContent = "↓";
      down.className = "mod-muted";
      up.addEventListener("click", async () => {
        const layout = getLayout();
        const sectionOrder = moveInOrder(layout.sectionOrder, id, -1);
        const values = syncPlacementValuesFromSectionOrder(layout.values, sectionOrder);
        await setLayout({ ...layout, sectionOrder, values });
        redraw();
      });
      down.addEventListener("click", async () => {
        const layout = getLayout();
        const sectionOrder = moveInOrder(layout.sectionOrder, id, 1);
        const values = syncPlacementValuesFromSectionOrder(layout.values, sectionOrder);
        await setLayout({ ...layout, sectionOrder, values });
        redraw();
      });
      btns.append(up, down);
      row.append(grip, lab, btns);
      list.appendChild(row);
    }
  }

  redraw();
}

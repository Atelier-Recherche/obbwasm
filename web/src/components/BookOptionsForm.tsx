import { useState } from "react";
import { ChevronRight } from "lucide-react";
import type { BookOptionDef } from "../bookOptions/types";
import { BOOK_OPTIONS } from "../bookOptions/registry";
import type { BookLayoutState, DocumentLang } from "../bookOptions/types";
import { STRING_OVERRIDE_KEYS } from "../bookOptions/registry";
import {
  BOOK_OPTION_SECTION_IDS,
  BOOK_OPTION_SECTION_KEYS,
  type BookOptionSectionKey,
} from "../bookOptions/optionSections";
import { useI18n } from "../i18n/context";
import { ToggleChip } from "./ToggleChip";

const OVERRIDE_UI: Record<string, string> = {
  "label-toc": "doc.labelToc",
  "label-bibliography": "doc.labelBibliography",
  "label-index": "doc.labelIndex",
  "label-glossary": "doc.labelGlossary",
  "label-list-figures": "doc.labelListFigures",
  "label-annexes": "doc.labelAnnexes",
};

type CollapsibleKey = BookOptionSectionKey | "labels";

type Props = {
  visibleOptionIds: string[];
  bookLayout: BookLayoutState;
  setBookLayout: React.Dispatch<React.SetStateAction<BookLayoutState>>;
  patchBookValues: (patch: Partial<Record<string, boolean | string>>) => void;
};

export function BookOptionsForm({ visibleOptionIds, bookLayout, setBookLayout, patchBookValues }: Props) {
  const { t } = useI18n();
  const allow = new Set(visibleOptionIds);
  const [openSections, setOpenSections] = useState<Partial<Record<CollapsibleKey, boolean>>>({});

  const defsById = Object.fromEntries(BOOK_OPTIONS.map((o) => [o.id, o])) as Record<string, BookOptionDef>;

  function toggleSection(key: CollapsibleKey) {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function isExpanded(key: CollapsibleKey): boolean {
    return openSections[key] === true;
  }

  function setOverride(key: string, value: string) {
    setBookLayout((prev) => ({
      ...prev,
      stringOverrides: { ...prev.stringOverrides, [key]: value },
    }));
  }

  function setDocumentLang(lang: DocumentLang) {
    setBookLayout((prev) => ({ ...prev, documentLang: lang }));
  }

  function renderControl(def: BookOptionDef) {
    const label = t(`options.${def.labelKey}.label`);
    const val = bookLayout.values[def.id];

    if (def.kind === "bool") {
      return (
        <ToggleChip
          key={def.id}
          enabled={val === true}
          onToggle={() => patchBookValues({ [def.id]: !(val === true) })}
          label={label}
        />
      );
    }

    if (def.kind === "enum" && def.enumValues) {
      return (
        <label key={def.id} className="book-opt-field inline-field">
          <span className="book-opt-label">{label}</span>
          <select
            value={typeof val === "string" ? val : def.enumValues[0]}
            onChange={(e) => patchBookValues({ [def.id]: e.target.value })}
          >
            {def.enumValues.map((ev) => (
              <option key={ev} value={ev}>
                {t(`options.${def.labelKey}.values.${ev}`)}
              </option>
            ))}
          </select>
        </label>
      );
    }

    if (def.kind === "color" || def.kind === "string") {
      return (
        <label key={def.id} className="book-opt-field inline-field">
          <span className="book-opt-label">{label}</span>
          <input
            type="text"
            value={typeof val === "string" ? val : ""}
            onChange={(e) => patchBookValues({ [def.id]: e.target.value })}
            spellCheck={false}
          />
        </label>
      );
    }

    return null;
  }

  const hasVisibleOptions = visibleOptionIds.length > 0;

  return (
    <div className="book-options-form">
      <div className="book-options-doc-lang">
        <label className="book-opt-field inline-field">
          <span className="book-opt-label">{t("ui.documentLanguage")}</span>
          <select value={bookLayout.documentLang} onChange={(e) => setDocumentLang(e.target.value as DocumentLang)}>
            <option value="fr">Français</option>
            <option value="en">English</option>
            <option value="de">Deutsch</option>
            <option value="es">Español</option>
          </select>
        </label>
      </div>

      {!hasVisibleOptions ? (
        <p className="sub book-options-empty">{t("ui.bookOptionsNone")}</p>
      ) : (
        <div className="book-options-sections">
          {BOOK_OPTION_SECTION_KEYS.map((sectionKey) => {
            const ids = BOOK_OPTION_SECTION_IDS[sectionKey];
            const defs = ids.map((id) => defsById[id]).filter((def): def is BookOptionDef => !!def && allow.has(def.id));
            if (defs.length === 0) return null;
            const expanded = isExpanded(sectionKey);
            return (
              <section key={sectionKey} className={`book-options-section ${expanded ? "is-open" : ""}`}>
                <button
                  type="button"
                  className="book-options-section-toggle"
                  aria-expanded={expanded}
                  onClick={() => toggleSection(sectionKey)}
                >
                  <ChevronRight className="book-options-section-chevron" aria-hidden size={18} />
                  <span className="book-options-section-heading">{t(`ui.optionSections.${sectionKey}`)}</span>
                  <span className="book-options-count-pill">{defs.length}</span>
                </button>
                {expanded ? <div className="book-options-section-grid">{defs.map((def) => renderControl(def))}</div> : null}
              </section>
            );
          })}
        </div>
      )}

      <section className={`book-options-section book-options-section-labels ${isExpanded("labels") ? "is-open" : ""}`}>
        <button
          type="button"
          className="book-options-section-toggle"
          aria-expanded={isExpanded("labels")}
          onClick={() => toggleSection("labels")}
        >
          <ChevronRight className="book-options-section-chevron" aria-hidden size={18} />
          <span className="book-options-section-heading">{t("ui.customLabels")}</span>
          <span className="book-options-count-pill">{STRING_OVERRIDE_KEYS.length}</span>
        </button>
        {isExpanded("labels") ? (
          <>
            <p className="sub book-options-labels-hint">{t("ui.stringsPlaceholder")}</p>
            <div className="book-options-section-grid book-options-labels-grid">
              {STRING_OVERRIDE_KEYS.map((key) => (
                <label key={key} className="book-opt-field">
                  <span className="book-opt-label">{t(OVERRIDE_UI[key] ?? key)}</span>
                  <input
                    type="text"
                    value={bookLayout.stringOverrides[key] ?? ""}
                    placeholder={t(OVERRIDE_UI[key] ?? "")}
                    onChange={(e) => setOverride(key, e.target.value)}
                    spellCheck={false}
                  />
                </label>
              ))}
            </div>
          </>
        ) : null}
      </section>
    </div>
  );
}

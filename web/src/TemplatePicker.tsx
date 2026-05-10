import { useEffect, useRef, useState } from "react";
import { ChevronDown, Eye, Loader2 } from "lucide-react";
import type { TemplateMeta } from "./parseTemplateMeta";
import { displayTitle } from "./parseTemplateMeta";

export type TemplateItem = {
  id: string;
  name: string;
  mainTypPath: string;
  variables: Record<string, string>;
};

type Props = {
  templates: TemplateItem[];
  selectedId: string;
  metaById: Record<string, TemplateMeta>;
  loading: boolean;
  onOpenMenu: () => void;
  onSelect: (id: string) => void;
  onPreview: (id: string) => void;
};

export function TemplatePicker({
  templates,
  selectedId,
  metaById,
  loading,
  onOpenMenu,
  onSelect,
  onPreview,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = templates.find((t) => t.id === selectedId);
  const metaSel = selected ? metaById[selected.id] : undefined;
  const summary = selected
    ? displayTitle(metaSel ?? { nomComplet: "", version: "", detail: "", format: "" }, selected.name)
    : "Choisir un gabarit";

  function handleToggle() {
    const next = !open;
    setOpen(next);
    if (next) onOpenMenu();
  }

  return (
    <div className="template-picker" ref={rootRef}>
      <button
        type="button"
        className="template-picker-trigger"
        aria-expanded={open}
        aria-haspopup="listbox"
        onClick={handleToggle}
      >
        <span className="template-picker-trigger-text">{loading ? "Chargement…" : summary}</span>
        {loading ? <Loader2 className="icon-spin" size={18} aria-hidden /> : <ChevronDown size={18} aria-hidden />}
      </button>
      {open && (
        <div className="template-picker-panel" role="listbox" aria-label="Gabarits">
          {templates.length === 0 && !loading && <p className="template-picker-empty">Aucun gabarit.</p>}
          <ul className="template-picker-grid">
            {templates.map((t) => {
              const m = metaById[t.id];
              const title = displayTitle(m ?? { nomComplet: "", version: "", detail: "", format: "" }, t.name);
              const active = t.id === selectedId;
              return (
                <li key={t.id}>
                  <div className={`template-card ${active ? "active" : ""}`}>
                    <button
                      type="button"
                      className="template-card-main"
                      role="option"
                      aria-selected={active}
                      onClick={() => {
                        onSelect(t.id);
                        setOpen(false);
                      }}
                    >
                      <span className="template-card-title">{title}</span>
                      {m?.detail ? <span className="template-card-detail">{m.detail}</span> : null}
                      <span className="template-card-tags">
                        {m?.format ? <span className="tag tag-format">{m.format}</span> : null}
                        {m?.version ? <span className="tag tag-version">{m.version}</span> : null}
                      </span>
                    </button>
                    <button
                      type="button"
                      className="template-card-preview"
                      title="Aperçu infos"
                      aria-label={`Aperçu ${title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreview(t.id);
                      }}
                    >
                      <Eye size={18} aria-hidden />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

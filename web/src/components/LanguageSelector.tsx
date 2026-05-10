import { useEffect, useRef, useState } from "react";
import type { UiLocale } from "../bookOptions/types";
import { useI18n } from "../i18n/context";

const LOCALES: { id: UiLocale; label: string }[] = [
  { id: "fr", label: "Français" },
  { id: "en", label: "English" },
  { id: "de", label: "Deutsch" },
  { id: "es", label: "Español" },
];

/** Drapeaux indicatifs (émojis) pour le menu compact. */
const FLAG_EMOJI: Record<UiLocale, string> = {
  fr: "🇫🇷",
  en: "🇬🇧",
  de: "🇩🇪",
  es: "🇪🇸",
};

export function LanguageSelector() {
  const { locale, setUiLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(ev: MouseEvent) {
      const el = wrapRef.current;
      if (el && !el.contains(ev.target as Node)) setOpen(false);
    }
    function onKey(ev: KeyboardEvent) {
      if (ev.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lang-menu-wrap" ref={wrapRef}>
      <button
        type="button"
        className="lang-flag-btn"
        aria-label={t("ui.language")}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
      >
        <span className="lang-flag-emoji" aria-hidden>
          {FLAG_EMOJI[locale]}
        </span>
      </button>
      {open ? (
        <ul className="lang-dropdown" role="menu">
          {LOCALES.map((l) => (
            <li key={l.id} role="none">
              <button
                type="button"
                className={`lang-dropdown-item ${l.id === locale ? "active" : ""}`}
                role="menuitemradio"
                aria-checked={l.id === locale}
                onClick={() => {
                  setUiLocale(l.id);
                  setOpen(false);
                }}
              >
                <span className="lang-flag-emoji" aria-hidden>
                  {FLAG_EMOJI[l.id]}
                </span>
                <span className="lang-dropdown-label">{l.label}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

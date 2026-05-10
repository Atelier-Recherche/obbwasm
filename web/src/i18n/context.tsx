import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { UiLocale } from "../bookOptions/types";
import fr from "../locales/fr.json";
import en from "../locales/en.json";
import de from "../locales/de.json";
import es from "../locales/es.json";

export type Messages = typeof fr;

const LOCALES: Record<UiLocale, Messages> = {
  fr,
  en,
  de,
  es,
};

function getPath(obj: unknown, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return typeof cur === "string" ? cur : undefined;
}

function initialLocale(): UiLocale {
  try {
    const s = localStorage.getItem("obbwasm-ui-locale");
    if (s === "fr" || s === "en" || s === "de" || s === "es") return s;
  } catch {
    /* ignore */
  }
  const nav = navigator.language.slice(0, 2).toLowerCase();
  if (nav === "fr" || nav === "de" || nav === "es") return nav;
  return "en";
}

type I18nContextValue = {
  locale: UiLocale;
  setUiLocale: (l: UiLocale) => void;
  t: (key: string) => string;
  messages: Messages;
};

const I18nCtx = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<UiLocale>(initialLocale);

  const setUiLocale = useCallback((l: UiLocale) => {
    setLocaleState(l);
    try {
      localStorage.setItem("obbwasm-ui-locale", l);
    } catch {
      /* ignore */
    }
  }, []);

  const messages = LOCALES[locale];

  const t = useCallback(
    (key: string) => {
      const msg = getPath(messages, key);
      return msg ?? key;
    },
    [messages],
  );

  const value = useMemo(
    () => ({ locale, setUiLocale, t, messages }),
    [locale, setUiLocale, t, messages],
  );

  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nCtx);
  if (!ctx) throw new Error("useI18n requires I18nProvider");
  return ctx;
}

import { useCallback, useEffect, useRef, useState } from "react";
import type { BookLayoutState } from "@obbwasm/core";
import { normalizeBookCompileMeta, normalizePresetPayload } from "@obbwasm/core";
import { useI18n } from "../i18n/context";

type AuthUser = { email: string; isAdmin: boolean };

type Props = {
  apiBase: string;
  apiFetch: (input: string | URL, init?: RequestInit) => Promise<Response>;
  authUser: AuthUser | null;
  bookLayout: BookLayoutState;
  setBookLayout: React.Dispatch<React.SetStateAction<BookLayoutState>>;
  bookCompileMeta: { title: string; author: string; publisher: string };
  onBookCompileMetaLoaded: (meta: Partial<{ title: string; author: string; publisher: string }>) => void;
};

type PresetRow = { id: string; name: string; updatedAt?: string };

export function BookLayoutPresetsWeb({
  apiBase,
  apiFetch,
  authUser,
  bookLayout,
  setBookLayout,
  bookCompileMeta,
  onBookCompileMetaLoaded,
}: Props) {
  const { t } = useI18n();
  const [items, setItems] = useState<PresetRow[]>([]);
  const [name, setName] = useState("");
  const [sel, setSel] = useState("");
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flashFeedback = useCallback((message: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(message);
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimer.current = null;
    }, 4500);
  }, []);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    [],
  );

  const refresh = useCallback(async () => {
    if (!authUser) {
      setItems([]);
      return;
    }
    const r = await apiFetch(`${apiBase}/book-presets.php`, { credentials: "include" });
    const j = (await r.json()) as { ok?: boolean; items?: PresetRow[] };
    setItems(j.ok && Array.isArray(j.items) ? j.items : []);
  }, [apiBase, apiFetch, authUser]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  if (!authUser) {
    return <p className="sub">{t("ui.bookPresetsNeedLogin")}</p>;
  }

  return (
    <div className="book-layout-presets-web">
      <h3>{t("ui.bookLayoutPresets")}</h3>
      <p className="sub">{t("ui.presetIncludesBookMeta")}</p>
      {feedback ? (
        <p className="book-preset-feedback" role="status">
          {feedback}
        </p>
      ) : null}
      <div className="book-layout-presets-row">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("ui.presetNamePlaceholder")}
        />
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            const body = {
              action: "save",
              version: 1,
              name: name.trim() || "Préréglage",
              payload: bookLayout,
              bookCompileMeta: {
                title: bookCompileMeta.title,
                author: bookCompileMeta.author,
                publisher: bookCompileMeta.publisher,
              },
            };
            const r = await apiFetch(`${apiBase}/book-presets.php`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
              credentials: "include",
            });
            const j = (await r.json()) as { ok?: boolean };
            if (j.ok) {
              const savedName = name.trim() || "Préréglage";
              setName("");
              flashFeedback(`${t("ui.presetSavedBanner")} « ${savedName} ».`);
              await refresh();
            }
          }}
        >
          {t("ui.presetSave")}
        </button>
      </div>
      <div className="book-layout-presets-row">
        <select className="dropdown" value={sel} onChange={(e) => setSel(e.target.value)}>
          <option value="">{items.length ? t("ui.presetPick") : t("ui.presetListEmpty")}</option>
          {items.map((it) => (
            <option key={it.id} value={it.id}>
              {it.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          className="btn-ghost"
          disabled={!sel}
          onClick={async () => {
            const r = await apiFetch(`${apiBase}/book-presets.php?id=${encodeURIComponent(sel)}`, {
              credentials: "include",
            });
            const j = (await r.json()) as { ok?: boolean; item?: { payload?: unknown; bookCompileMeta?: unknown } };
            if (j.ok && j.item?.payload) {
              setBookLayout(normalizePresetPayload(j.item.payload));
              const meta = normalizeBookCompileMeta(j.item.bookCompileMeta);
              if (Object.keys(meta).length > 0) onBookCompileMetaLoaded(meta);
              const row = items.find((it) => it.id === sel);
              const label = row?.name ?? sel;
              flashFeedback(`${t("ui.presetLoadedBanner")} « ${label} ».`);
            }
          }}
        >
          {t("ui.presetLoad")}
        </button>
        <button
          type="button"
          className="btn-ghost"
          disabled={!sel}
          onClick={async () => {
            await apiFetch(`${apiBase}/book-presets.php`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: "delete", id: sel }),
              credentials: "include",
            });
            setSel("");
            await refresh();
          }}
        >
          {t("ui.presetDelete")}
        </button>
      </div>
    </div>
  );
}

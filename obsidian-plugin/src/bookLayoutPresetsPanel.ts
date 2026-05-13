import type frType from "./locales/fr.json";
import type { BookCompileMeta, BookLayoutState, VaultCompilePaths } from "@obbwasm/core";
import { Notice } from "obsidian";

type Fr = typeof frType;

export type StoredBookPreset = {
  id: string;
  name: string;
  updatedAt: string;
  payload: BookLayoutState;
  vaultCompilePaths?: VaultCompilePaths;
  bookCompileMeta?: BookCompileMeta;
};

export type PresetLoadDetail =
  | { kind: "stored"; id: string }
  | { kind: "file"; relPath: string };

export type BookLayoutPresetsApi = {
  listStored(): StoredBookPreset[];
  listFilePresets(): { relPath: string; label: string }[];
  /** Si `overwriteId` est fourni, remplace le préréglage existant de cet id (même nom). */
  saveCurrentAs(name: string, overwriteId?: string): Promise<void>;
  loadStored(id: string): Promise<void>;
  deleteStored(id: string): Promise<void>;
  loadFromFile(relPath: string): Promise<void>;
  onChanged(): Promise<void>;
  /** Après chargement réussi (Notice côté plugin, etc.). */
  onPresetLoaded?: (d: PresetLoadDetail) => void | Promise<void>;
  /** Après enregistrement dans l’extension. */
  onPresetSaved?: (name: string) => void | Promise<void>;
};

export function mountBookLayoutPresetsPanel(root: HTMLElement, fr: Fr, api: BookLayoutPresetsApi): void {
  root.replaceChildren();
  root.className = "obb-book-presets-panel";

  const h = document.createElement("h4");
  h.className = "obb-book-options-heading";
  h.textContent = fr.ui.bookLayoutPresets;
  root.appendChild(h);

  const row1 = document.createElement("div");
  row1.className = "obbwasm-field-row";
  const nameInp = document.createElement("input");
  nameInp.type = "text";
  nameInp.className = "obbwasm-field-input";
  nameInp.placeholder = fr.ui.presetNamePlaceholder;
  const saveBtn = document.createElement("button");
  saveBtn.type = "button";
  saveBtn.textContent = fr.ui.presetSave;
  saveBtn.classList.add("mod-cta");
  saveBtn.addEventListener("click", async () => {
    const name = nameInp.value.trim() || "Préréglage";
    const key = name.trim().toLowerCase();
    const dup = api.listStored().find((p) => p.name.trim().toLowerCase() === key);
    let overwriteId: string | undefined;
    if (dup) {
      const msg = fr.ui.presetOverwriteConfirm.replace("{{name}}", dup.name);
      if (!window.confirm(msg)) {
        return;
      }
      overwriteId = dup.id;
    }
    try {
      await api.saveCurrentAs(name, overwriteId);
      nameInp.value = "";
      await api.onPresetSaved?.(name);
      await api.onChanged();
      redraw();
    } catch (e) {
      new Notice((e as Error).message, 8000);
    }
  });
  row1.append(nameInp, saveBtn);
  root.appendChild(row1);

  const row2 = document.createElement("div");
  row2.className = "obbwasm-field-row";
  const sel = document.createElement("select");
  sel.className = "dropdown";
  const loadBtn = document.createElement("button");
  loadBtn.type = "button";
  loadBtn.textContent = fr.ui.presetLoad;
  loadBtn.addEventListener("click", async () => {
    const v = sel.value;
    if (!v) return;
    if (v.startsWith("file:")) {
      const rel = v.slice("file:".length);
      await api.loadFromFile(rel);
      await api.onPresetLoaded?.({ kind: "file", relPath: rel });
    } else {
      await api.loadStored(v);
      await api.onPresetLoaded?.({ kind: "stored", id: v });
    }
    await api.onChanged();
  });
  const delBtn = document.createElement("button");
  delBtn.type = "button";
  delBtn.textContent = fr.ui.presetDelete;
  delBtn.addEventListener("click", async () => {
    const v = sel.value;
    if (!v || v.startsWith("file:")) return;
    await api.deleteStored(v);
    await api.onChanged();
    redraw();
  });
  row2.appendChild(sel);
  row2.appendChild(loadBtn);
  row2.appendChild(delBtn);
  root.appendChild(row2);

  const hint = document.createElement("p");
  hint.className = "obbwasm-help-text";
  hint.textContent = fr.ui.presetFilesHint;
  root.appendChild(hint);

  function redraw() {
    const cur = sel.value;
    sel.replaceChildren();
    const stored = api.listStored();
    const files = api.listFilePresets();
    if (stored.length === 0 && files.length === 0) {
      const o = document.createElement("option");
      o.value = "";
      o.textContent = fr.ui.presetStoredEmpty;
      sel.appendChild(o);
      return;
    }
    for (const p of stored) {
      const o = document.createElement("option");
      o.value = p.id;
      o.textContent = `${p.name} (${fr.ui.presetSourceExtension})`;
      sel.appendChild(o);
    }
    for (const f of files) {
      const o = document.createElement("option");
      o.value = `file:${f.relPath}`;
      o.textContent = `${f.label} (${fr.ui.presetSourceFile})`;
      sel.appendChild(o);
    }
    if (cur && [...sel.options].some((x) => x.value === cur)) sel.value = cur;
  }

  redraw();
}

import { defaultBookLayoutState } from "./bookOptions/defaults.js";
import type { BookLayoutState, DocumentLang, SectionId } from "./bookOptions/types.js";

/** Version du fichier JSON préréglage (incrémenter si le schéma change). */
export const BOOK_LAYOUT_PRESET_SCHEMA_VERSION = 1;

/**
 * Dossier relatif à la racine bundle / projet (après migration sans `typst/` intermédiaire).
 * Fichiers : `*.json` (un préréglage par fichier).
 */
export const BOOK_PRESETS_RELATIVE_DIR = "typeset/presets";

/** Chemins coffre (plugin Obsidian) pour Pandoc / glossaire / index — optionnel dans le JSON. */
export type VaultCompilePaths = Partial<{
  bibliographyVaultPath: string;
  cslVaultPath: string;
  glossaryVaultPath: string;
  nameIndexVaultPath: string;
}>;

/** Métadonnées livre (titre, auteur, éditeur ou édition) — optionnel dans le JSON. */
export type BookCompileMeta = Partial<{
  title: string;
  author: string;
  publisher: string;
}>;

export type BookLayoutPresetFileV1 = {
  version: typeof BOOK_LAYOUT_PRESET_SCHEMA_VERSION;
  /** Libellé affiché (optionnel ; défaut = nom de fichier). */
  name?: string;
  createdAt?: string;
  updatedAt?: string;
  /** État complet des options livre (même forme que `BookLayoutState`). */
  payload: BookLayoutState;
  vaultCompilePaths?: VaultCompilePaths;
  bookCompileMeta?: BookCompileMeta;
};

const SECTION_IDS = new Set<string>([
  "cover",
  "titleCredits",
  "toc",
  "body",
  "annexes",
  "listFigures",
  "bibliography",
  "indexGlossary",
  "backCover",
]);

function isDocumentLang(x: unknown): x is DocumentLang {
  return x === "fr" || x === "en" || x === "de" || x === "es";
}

function isSectionId(x: unknown): x is SectionId {
  return typeof x === "string" && SECTION_IDS.has(x);
}

/** Fusionne un payload partiel avec les défauts (migration / fichiers incomplets). */
export function normalizePresetPayload(raw: unknown): BookLayoutState {
  const base = defaultBookLayoutState();
  if (!raw || typeof raw !== "object") return base;
  const o = raw as Record<string, unknown>;
  const documentLang = isDocumentLang(o.documentLang) ? o.documentLang : base.documentLang;
  const stringOverrides =
    o.stringOverrides && typeof o.stringOverrides === "object" && !Array.isArray(o.stringOverrides)
      ? { ...base.stringOverrides, ...(o.stringOverrides as Record<string, string>) }
      : base.stringOverrides;
  let sectionOrder = base.sectionOrder;
  if (Array.isArray(o.sectionOrder) && o.sectionOrder.every(isSectionId)) {
    sectionOrder = o.sectionOrder as SectionId[];
  }
  const values =
    o.values && typeof o.values === "object" && !Array.isArray(o.values)
      ? { ...base.values, ...(o.values as Record<string, boolean | string>) }
      : base.values;
  return {
    documentLang,
    stringOverrides,
    sectionOrder,
    values,
  };
}

const VAULT_COMPILE_PATH_KEYS = [
  "bibliographyVaultPath",
  "cslVaultPath",
  "glossaryVaultPath",
  "nameIndexVaultPath",
] as const satisfies readonly (keyof VaultCompilePaths)[];

/** Extrait les chemins coffre reconnus depuis un objet JSON brut. */
export function normalizeVaultCompilePaths(raw: unknown): VaultCompilePaths {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: VaultCompilePaths = {};
  for (const k of VAULT_COMPILE_PATH_KEYS) {
    const v = o[k];
    if (typeof v === "string") (out as Record<string, string>)[k] = v;
  }
  return out;
}

const BOOK_COMPILE_META_KEYS = ["title", "author", "publisher"] as const satisfies readonly (keyof BookCompileMeta)[];

/** Extrait titre / auteur / éditeur depuis un objet JSON brut. */
export function normalizeBookCompileMeta(raw: unknown): BookCompileMeta {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const out: BookCompileMeta = {};
  for (const k of BOOK_COMPILE_META_KEYS) {
    const v = o[k];
    if (typeof v === "string") (out as Record<string, string>)[k] = v;
  }
  return out;
}

export function parseBookLayoutPresetJson(text: string): BookLayoutPresetFileV1 | null {
  try {
    const data = JSON.parse(text) as unknown;
    if (!data || typeof data !== "object") return null;
    const rec = data as Record<string, unknown>;
    const ver = rec.version;
    if (ver !== BOOK_LAYOUT_PRESET_SCHEMA_VERSION) return null;
    const payload = normalizePresetPayload(rec.payload);
    const vaultRaw = rec.vaultCompilePaths;
    const vaultCompilePaths =
      vaultRaw !== undefined && vaultRaw !== null ? normalizeVaultCompilePaths(vaultRaw) : undefined;
    const metaRaw = rec.bookCompileMeta;
    const bookCompileMeta =
      metaRaw !== undefined && metaRaw !== null ? normalizeBookCompileMeta(metaRaw) : undefined;
    return {
      version: BOOK_LAYOUT_PRESET_SCHEMA_VERSION,
      name: typeof rec.name === "string" ? rec.name : undefined,
      createdAt: typeof rec.createdAt === "string" ? rec.createdAt : undefined,
      updatedAt: typeof rec.updatedAt === "string" ? rec.updatedAt : undefined,
      payload,
      vaultCompilePaths:
        vaultCompilePaths && Object.keys(vaultCompilePaths).length > 0 ? vaultCompilePaths : undefined,
      bookCompileMeta: bookCompileMeta && Object.keys(bookCompileMeta).length > 0 ? bookCompileMeta : undefined,
    };
  } catch {
    return null;
  }
}

export function serializeBookLayoutPreset(
  payload: BookLayoutState,
  meta?: { name?: string },
  extra?: { vaultCompilePaths?: VaultCompilePaths; bookCompileMeta?: BookCompileMeta; updatedAt?: string },
): string {
  const now = new Date().toISOString();
  const file: BookLayoutPresetFileV1 = {
    version: BOOK_LAYOUT_PRESET_SCHEMA_VERSION,
    name: meta?.name,
    createdAt: now,
    updatedAt: extra?.updatedAt ?? now,
    payload,
  };
  const v = extra?.vaultCompilePaths;
  if (v && Object.keys(v).length > 0) file.vaultCompilePaths = v;
  const m = extra?.bookCompileMeta;
  if (m && Object.keys(m).length > 0) file.bookCompileMeta = m;
  return JSON.stringify(file, null, 2);
}

import {
  BOOK_PRESETS_RELATIVE_DIR,
  buildImpositionMainTyp,
  chunkArray,
  compileTypstBookToPdf,
  yieldToMainThread,
  createPandocConvertFromWasmBuffer,
  createTypstCompiler,
  defaultBookLayoutState,
  firstDiagnosticMessage,
  mountTypstPackagesFromLoader,
  overrideTypstLet,
  pandocMarkdownToTypst,
  markdownHorizontalRuleFromBookValues,
  normalizeWikiImagesForPandoc,
  resolveRemoteImageFetchUrl,
  normalizeBookCompileMeta,
  normalizeVaultCompilePaths,
  parseBookLayoutPresetJson,
  normalizePresetPayload,
  parseImpositionTemplateSpec,
  parseTemplateMeta,
  applyTocAndBibPlacement,
  reconcileSectionOrder,
  reorderSpreadSequence,
  resetTypstWasmImporterRegistration,
  spineThicknessMm,
  type BookCompileMeta,
  type BookLayoutState,
  type TemplateMeta,
  type VaultCompilePaths,
} from "@obbwasm/core";
import type { TypstCompiler } from "@myriaddreamin/typst.ts";
import JSZip from "jszip";
import {
  FileView,
  ItemView,
  Notice,
  Plugin,
  PluginSettingTab,
  Platform,
  Setting,
  WorkspaceLeaf,
  normalizePath,
  requestUrl,
  type App,
  type FileSystemAdapter,
  type TFile,
} from "obsidian";
import { mountBookLayoutPresetsPanel, type PresetLoadDetail, type StoredBookPreset } from "./bookLayoutPresetsPanel.js";
import { mountBookOptionsPanel, mountSectionOrderPanel } from "./bookOptionsPanel.js";
import { createFsAssetLoader } from "./fsAssetLoader.js";
import { EMBEDDED_TEMPLATES_MANIFEST } from "./embeddedTemplatesManifest.js";
import frLocale from "./locales/fr.json";
import { extractTypesetFromGithubRepoZip } from "./githubArchive.js";
import { migrateLegacyTypesetPath } from "./legacyTypesetPaths.js";
import { listTypFiles } from "./listTypFiles.js";
import { mergeManifestWithLocalDiscovered } from "./localTemplates.js";
import { nodeFs, nodePath, tryNodeFs, tryNodePath } from "./platform.js";
import { countPdfPages, initPdfJsWorker } from "./pdfPageCount.js";
import type { TemplatesManifestV1 } from "./templatesManifest.js";
import { DEFAULT_TEMPLATES_MANIFEST_URL, GITHUB_REPO_ARCHIVE_MAIN } from "./urls.js";
import { PANDOC_WASM_DOWNLOAD_URL, TYPST_COMPILER_WASM_DOWNLOAD_URL } from "./wasmFetch.js";

export const VIEW_TYPE_OBB = "obbwasm-book-preview";

/** Au-delà, l’iframe PDF fait planter Obsidian sur de gros livres. */
const PDF_PREVIEW_MAX_BYTES = 12 * 1024 * 1024;
/** Comptage PDF.js optionnel au-delà de cette taille (économie mémoire). */
const PDF_PAGE_COUNT_MAX_BYTES = 24 * 1024 * 1024;
/** Hauteur par défaut du panneau aperçu PDF (redimensionnable). */
const PREVIEW_PANEL_HEIGHT_DEFAULT = 360;
const PREVIEW_PANEL_HEIGHT_MIN = 160;

/** Chemins normalisés comparables (casse Windows pour chemins coffre). */
function vaultPathsEqual(a: string, b: string): boolean {
  const x = normalizePath(a).replace(/\\/g, "/");
  const y = normalizePath(b).replace(/\\/g, "/");
  if (Platform.isWin) return x.toLowerCase() === y.toLowerCase();
  return x === y;
}

/**
 * Chemins de fichier qu’un onglet est susceptible d’afficher (volet différé inclus :
 * `view.file` peut être absent alors que `getViewState().state.file` contient déjà le chemin).
 */
function collectOpenFilePathsFromLeaf(leaf: WorkspaceLeaf): string[] {
  const paths: string[] = [];
  const st = leaf.getViewState();
  if (st.type === VIEW_TYPE_OBB) return paths;

  const state = st.state as Record<string, unknown> | undefined;
  const sf = state?.file;
  if (typeof sf === "string") paths.push(sf);
  else if (sf && typeof sf === "object" && "path" in sf && typeof (sf as { path: unknown }).path === "string") {
    paths.push((sf as { path: string }).path);
  }

  const view = leaf.view;
  if (view instanceof FileView && view.file) paths.push(view.file.path);
  return paths;
}

function requireDesktopFs(): void {
  if (!tryNodeFs()) {
    throw new Error(
      "Cette action nécessite Obsidian bureau (accès fichiers local). Sur mobile, elle n’est pas encore disponible.",
    );
  }
}

function validateWasmPath(fs: typeof import("node:fs"), absPath: string, label: string): void {
  const p = absPath?.trim();
  if (!p) throw new Error(`${label}: chemin vide.`);
  if (!fs.existsSync(p)) throw new Error(`${label}: fichier introuvable : ${p}`);
  const st = fs.statSync(p);
  if (!st.isFile()) throw new Error(`${label}: ce n'est pas un fichier : ${p}`);
  if (st.size === 0) throw new Error(`${label}: fichier vide (0 octet) : ${p}`);
}

/** Évite de capturer des data: URI entiers (très longs) dans les refs d’images. */
const RX_MD_IMG = /!\[[^\]]*]\(((?!data:)[^)\s]+)(?:\s+"[^"]*")?\)/g;
const RX_WIKI_IMG = /!\[\[([^[\]]+)\]\]/g;

function extractMarkdownImageRefs(source: string): string[] {
  const out = new Set<string>();
  for (const rx of [RX_MD_IMG, RX_WIKI_IMG]) {
    rx.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(source)) !== null) {
      const raw = (m[1] ?? "").trim();
      if (!raw || /^data:/i.test(raw)) continue;
      const noAlias = raw.split("|")[0]?.trim() ?? raw;
      const noAnchor = noAlias.split("#")[0]?.trim() ?? noAlias;
      if (noAnchor) out.add(noAnchor);
    }
  }
  return [...out];
}

function uniqueNormalizedPaths(paths: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const n = normalizePath(p);
    if (seen.has(n)) continue;
    seen.add(n);
    out.push(n);
  }
  return out;
}

/**
 * Résout une image locale comme le ferait Obsidian : d’abord relatif au dossier de la note,
 * puis chemin depuis la racine du coffre (évite Brochure/Brochure/… si la note est déjà sous Brochure),
 * puis lien implicite, puis fichier du même nom dans un sous-dossier direct (ex. imagetelechargement/logo.png).
 */
function resolveLocalImageToFile(app: App, sourceFile: TFile, refRaw: string): TFile | null {
  const normRef = normalizePath(refRaw.trim().replace(/^\.\//, ""));
  if (!normRef) return null;

  const candidates = uniqueNormalizedPaths(
    sourceFile.parent
      ? [normalizePath(`${sourceFile.parent.path}/${normRef}`), normRef]
      : [normRef],
  );

  for (const c of candidates) {
    const af = app.vault.getAbstractFileByPath(c);
    if (af && "extension" in af) return af as TFile;
  }

  const dest = app.metadataCache.getFirstLinkpathDest(refRaw.trim(), sourceFile.path);
  if (dest && "extension" in dest) return dest as TFile;

  if (!normRef.includes("/") && sourceFile.parent) {
    for (const child of sourceFile.parent.children) {
      if (!("children" in child)) continue;
      const subPath = normalizePath(`${child.path}/${normRef}`);
      const af = app.vault.getAbstractFileByPath(subPath);
      if (af && "extension" in af) return af as TFile;
    }
  }

  return null;
}

/** En-têtes adaptés aux images distantes (Referer = origine du site, utile WordPress / anti-hotlink). */
function httpHeadersForImageRequest(url: string): Record<string, string> {
  const h: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
  };
  try {
    h.Referer = `${new URL(url).origin}/`;
  } catch {
    /* ignore */
  }
  return h;
}

/**
 * `fetch` compatible pour {@link createTypstCompiler} : charge les polices typst-assets (jsDelivr)
 * sans `import("node-fetch-cache")` (cassé sous Obsidian / Electron).
 */
async function typstFontFetcherObsidian(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url =
    typeof input === "string"
      ? input
      : input instanceof URL
        ? input.href
        : typeof (input as Request).url === "string"
          ? (input as Request).url
          : String(input);
  const res = await requestUrl({
    url,
    method: "GET",
    throw: false,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ObbWasm-Obsidian/1)",
      Accept: "*/*",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (res.status !== 200 || res.arrayBuffer == null) {
    throw new Error(`Téléchargement police HTTP ${res.status} : ${url.slice(0, 120)}`);
  }
  return new Response(res.arrayBuffer, { status: res.status });
}

interface ObbWasmPluginSettings {
  pandocWasmPath: string;
  typstWasmPath: string;
  templatesRoot: string;
  selectedTemplateId: string;
  title: string;
  author: string;
  publisher: string;
  bookLayoutJson: string;
  grammage: number;
  innerPages: number;
  impositionPaperThicknessMm: number;
  selectedCoverTemplatePath: string;
  selectedImpositionTemplatePath: string;
  /** Console : journal Pandoc / médias / virtualisation Typst. */
  debugMedia: boolean;
  /** Chemin coffre vers un fichier .bib (Pandoc citeproc). */
  bibliographyVaultPath: string;
  /** Chemin coffre vers un style CSL (utilisé seulement si le .bib est chargé). */
  cslVaultPath: string;
  /** Note « glossaire » : sections `# entrée` + définition (`[[glossaire#entrée]]`). */
  glossaryVaultPath: string;
  /** Note « index » des noms : sections `# entrée` + notice (`[[index#entrée]]`). */
  nameIndexVaultPath: string;
  /** Préréglages de mise en page sauvegardés dans l’extension (JSON tableau). */
  bookPresetsStoredJson: string;
  /** Hauteur du panneau aperçu PDF (px), réglable par glisser-déposer. */
  previewPanelHeightPx: number;
}

const DEFAULT_SETTINGS: ObbWasmPluginSettings = {
  pandocWasmPath: "",
  typstWasmPath: "",
  templatesRoot: "",
  selectedTemplateId: "",
  title: "Titre",
  author: "Auteur",
  publisher: "Édition",
  bookLayoutJson: "",
  grammage: 80,
  innerPages: 200,
  impositionPaperThicknessMm: 0.1,
  selectedCoverTemplatePath: "",
  selectedImpositionTemplatePath: "",
  debugMedia: false,
  bibliographyVaultPath: "",
  cslVaultPath: "",
  glossaryVaultPath: "",
  nameIndexVaultPath: "",
  bookPresetsStoredJson: "",
  previewPanelHeightPx: PREVIEW_PANEL_HEIGHT_DEFAULT,
};

export default class ObbWasmBookPlugin extends Plugin {
  settings: ObbWasmPluginSettings = { ...DEFAULT_SETTINGS };
  typstCompiler: TypstCompiler | null = null;
  pandocConvert: Awaited<ReturnType<typeof createPandocConvertFromWasmBuffer>> | null = null;
  cachedManifest: TemplatesManifestV1 | null = null;
  /** Métadonnées du gabarit `.typ` (supported-options) pour le formulaire d’options. */
  templateMeta: TemplateMeta | null = null;
  /** Dernier PDF intérieur produit par « Compiler la note » — utilisé pour l’imposition. */
  lastInteriorPdf: Uint8Array | null = null;
  /** Vue livre ouverte — mise à jour du statut de compilation. */
  private bookPreviewView: ObbBookView | null = null;

  /** URI du worker PDF.js (requis pour compter les pages / imposition). */
  private configurePdfJsWorker(): void {
    const rel = normalizePath(`${this.app.vault.configDir}/plugins/${this.manifest.id}/pdf.worker.min.mjs`);
    try {
      initPdfJsWorker(this.app.vault.adapter.getResourcePath(rel));
      return;
    } catch {
      /* fallback desktop */
    }
    const path = nodePath();
    const fs = tryNodeFs();
    if (!fs) return;
    const abs = path.join(this.pluginDir(), "pdf.worker.min.mjs");
    if (!fs.existsSync(abs)) return;
    const href = abs.replace(/\\/g, "/");
    initPdfJsWorker(href.startsWith("/") ? `file://${href}` : `file:///${href}`);
  }

  async onload(): Promise<void> {
    this.configurePdfJsWorker();
    await this.loadSettings();
    this.resolveTemplatesManifest();
    await this.refreshTemplateMeta();
    this.registerView(VIEW_TYPE_OBB, (leaf) => new ObbBookView(leaf, this));
    this.addRibbonIcon("book-open", "OBB livre PDF", () => void this.activateView());
    this.addCommand({
      id: "open-obb-book-view",
      name: "Ouvrir la vue livre OBB",
      callback: () => void this.activateView(),
    });
    this.addSettingTab(new ObbWasmSettingTab(this.app, this));
  }

  /**
   * Chemin absolu du dossier du plugin. Ne pas se fier seul à `manifest.dir` :
   * il peut être relatif et se résoudre alors contre le cwd (ex. System32).
   */
  private pluginDir(): string {
    const path = nodePath();
    const id = this.manifest.id;
    const adapter = this.app.vault.adapter as Partial<FileSystemAdapter>;
    if (typeof adapter.getBasePath === "function") {
      const base = adapter.getBasePath();
      return path.join(base, ".obsidian", "plugins", id);
    }
    const fromManifest = this.manifest.dir?.trim();
    if (!fromManifest) {
      throw new Error("Répertoire plugin inconnu (vault sans chemin local).");
    }
    if (!path.isAbsolute(fromManifest)) {
      throw new Error(
        "manifest.dir est relatif sans FileSystemAdapter — ouvrez un vault local (desktop).",
      );
    }
    return fromManifest;
  }

  getDataDir(): string {
    const path = nodePath();
    return path.join(this.pluginDir(), "data");
  }

  getDefaultTemplatesRoot(): string {
    try {
      const path = nodePath();
      return path.join(this.pluginDir(), "bundle");
    } catch {
      return "";
    }
  }

  resolveTemplatesRoot(): string {
    const t = this.settings.templatesRoot.trim();
    if (t) return t;
    return this.getDefaultTemplatesRoot();
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<ObbWasmPluginSettings> | undefined;
    this.settings = { ...DEFAULT_SETTINGS, ...data };
    if (!this.settings.bookLayoutJson) {
      this.settings.bookLayoutJson = JSON.stringify(defaultBookLayoutState());
    }
    if (!this.settings.bookPresetsStoredJson) {
      this.settings.bookPresetsStoredJson = "";
    }
    this.settings.selectedCoverTemplatePath = migrateLegacyTypesetPath(this.settings.selectedCoverTemplatePath);
    this.settings.selectedImpositionTemplatePath = migrateLegacyTypesetPath(
      this.settings.selectedImpositionTemplatePath,
    );
    try {
      const fs = nodeFs();
      const path = nodePath();
      const dataDir = this.getDataDir();
      if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
      if (!this.settings.pandocWasmPath) {
        this.settings.pandocWasmPath = path.join(dataDir, "pandoc.wasm");
      }
      if (!this.settings.typstWasmPath) {
        this.settings.typstWasmPath = path.join(dataDir, "typst_ts_web_compiler_bg.wasm");
      }
      if (!this.settings.templatesRoot) {
        this.settings.templatesRoot = this.getDefaultTemplatesRoot();
      }
    } catch {
      /* Obsidian mobile / sandbox : pas de require('fs'). */
    }
    const g = Number(this.settings.grammage);
    this.settings.grammage = [80, 100, 120].includes(g) ? g : 80;
    const ip = Number(this.settings.innerPages);
    this.settings.innerPages = Number.isFinite(ip) && ip >= 0 ? Math.round(ip) : 200;
    const th = Number(this.settings.impositionPaperThicknessMm);
    this.settings.impositionPaperThicknessMm =
      Number.isFinite(th) && th > 0 ? Number(th.toFixed(4)) : 0.1;
    const ph = Number(this.settings.previewPanelHeightPx);
    this.settings.previewPanelHeightPx =
      Number.isFinite(ph) && ph >= PREVIEW_PANEL_HEIGHT_MIN
        ? Math.round(ph)
        : PREVIEW_PANEL_HEIGHT_DEFAULT;
    await this.ensureCoverImpositionDefaults();
  }

  /** Si le bundle contient des .typ couverture / imposition, préremplit les sélections vides. */
  async ensureCoverImpositionDefaults(): Promise<void> {
    const fs = tryNodeFs();
    const path = tryNodePath();
    if (!fs || !path) return;
    const root = this.settings.templatesRoot.trim() || this.getDefaultTemplatesRoot();
    if (!root || !fs.existsSync(path.join(root, "typeset"))) return;
    const covers = listTypFiles(root, "cover");
    const imposes = listTypFiles(root, "impose");
    let dirty = false;
    if (!this.settings.selectedCoverTemplatePath && covers.length > 0) {
      this.settings.selectedCoverTemplatePath = covers[0]!;
      dirty = true;
    }
    if (!this.settings.selectedImpositionTemplatePath && imposes.length > 0) {
      this.settings.selectedImpositionTemplatePath = imposes[0]!;
      dirty = true;
    }
    if (dirty) await this.saveSettings();
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  invalidateWasmCaches(): void {
    this.typstCompiler = null;
    this.pandocConvert = null;
    resetTypstWasmImporterRegistration();
  }

  readWasmFile(absPath: string, label: string): ArrayBuffer {
    const fs = nodeFs();
    validateWasmPath(fs, absPath, label);
    const buf = fs.readFileSync(absPath);
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  }

  private mergeManifestWithLocals(base: TemplatesManifestV1): TemplatesManifestV1 {
    const fs = tryNodeFs();
    const path = tryNodePath();
    if (!fs || !path) return base;
    try {
      const root = this.resolveTemplatesRoot();
      if (!root) return base;
      return mergeManifestWithLocalDiscovered(base, root, fs, path);
    } catch {
      return base;
    }
  }

  /**
   * Manifest pour la liste des gabarits : fichier cache dans le dossier plugin,
   * sinon copie embarquée (évite liste vide si le JSON distant est indisponible).
   */
  resolveTemplatesManifest(): TemplatesManifestV1 {
    let base: TemplatesManifestV1 = EMBEDDED_TEMPLATES_MANIFEST;
    const fs = tryNodeFs();
    const path = tryNodePath();
    if (fs && path) {
      try {
        const cached = path.join(this.pluginDir(), "templates-manifest.cached.json");
        if (fs.existsSync(cached)) {
          const raw = fs.readFileSync(cached, "utf8");
          const json = JSON.parse(raw) as TemplatesManifestV1;
          if (json.version === 1 && Array.isArray(json.templates) && json.templates.length > 0) {
            base = json;
          }
        }
      } catch {
        /* garde embarqué */
      }
    }
    const merged = this.mergeManifestWithLocals(base);
    this.cachedManifest = merged;
    return merged;
  }

  /** Lit le `.typ` du gabarit sélectionné pour savoir quelles options afficher. */
  async refreshTemplateMeta(): Promise<void> {
    const manifest = this.resolveTemplatesManifest();
    const tpls = manifest.templates;
    const id = this.settings.selectedTemplateId || tpls[0]?.id || "";
    const rec = tpls.find((x) => x.id === id) ?? tpls[0];
    if (!rec?.mainTypPath) {
      this.templateMeta = null;
      return;
    }
    const loader = createFsAssetLoader(this.resolveTemplatesRoot());
    const src = await loader.fetchTextFile(rec.mainTypPath);
    this.templateMeta = src ? parseTemplateMeta(src) : null;
  }

  /** Met à jour cachedManifest — alias pour les réglages / rafraîchissement UI. */
  hydrateManifestFromDisk(): void {
    this.resolveTemplatesManifest();
  }

  async ensurePandocConvert(): Promise<Awaited<ReturnType<typeof createPandocConvertFromWasmBuffer>>> {
    if (this.pandocConvert) return this.pandocConvert;
    const fs = nodeFs();
    const p = this.settings.pandocWasmPath;
    validateWasmPath(fs, p, "pandoc.wasm");
    const fn = await createPandocConvertFromWasmBuffer(async () => this.readWasmFile(p, "pandoc.wasm"));
    this.pandocConvert = fn;
    return fn;
  }

  async ensureTypstCompiler(): Promise<TypstCompiler> {
    if (this.typstCompiler) return this.typstCompiler;
    const fs = nodeFs();
    const p = this.settings.typstWasmPath;
    validateWasmPath(fs, p, "Typst wasm");
    const loader = createFsAssetLoader(this.resolveTemplatesRoot());
    const compiler = await createTypstCompiler({
      getTypstWasmBuffer: async () => this.readWasmFile(p, "Typst wasm"),
      loader,
      loadFontsOptions: {
        assets: ["text"],
        fetcher: typstFontFetcherObsidian,
      },
    });
    this.typstCompiler = compiler;
    return compiler;
  }

  parseBookLayout(): BookLayoutState {
    try {
      const j = JSON.parse(this.settings.bookLayoutJson || "{}") as BookLayoutState;
      if (!j?.values) return defaultBookLayoutState();
      const def = defaultBookLayoutState();
      const values = { ...def.values, ...j.values };
      return {
        ...def,
        ...j,
        values,
        stringOverrides: { ...def.stringOverrides, ...(j.stringOverrides ?? {}) },
        sectionOrder: reconcileSectionOrder(j.sectionOrder ?? def.sectionOrder, values),
      };
    } catch {
      return defaultBookLayoutState();
    }
  }

  /** Manifest officiel (raw GitHub) — `requestUrl` évite la CORS du navigateur (`fetch` depuis app:// échoue). */
  async fetchManifestFromRepo(): Promise<TemplatesManifestV1 | null> {
    try {
      const res = await requestUrl({
        url: DEFAULT_TEMPLATES_MANIFEST_URL,
        method: "GET",
        throw: false,
      });
      if (res.status !== 200 || !res.text) return null;
      const json = JSON.parse(res.text) as TemplatesManifestV1;
      if (json.version !== 1 || !Array.isArray(json.templates)) return null;
      const merged = this.mergeManifestWithLocals(json);
      this.cachedManifest = merged;
      const fs = tryNodeFs();
      const path = tryNodePath();
      if (fs && path) {
        try {
          fs.writeFileSync(path.join(this.pluginDir(), "templates-manifest.cached.json"), res.text, "utf8");
        } catch {
          /* ignore */
        }
      }
      return merged;
    } catch {
      return null;
    }
  }

  async loadLocalManifest(): Promise<TemplatesManifestV1> {
    return this.resolveTemplatesManifest();
  }

  async downloadWasm(destAbs: string, url: string): Promise<void> {
    const fs = nodeFs();
    const res = await requestUrl({ url, method: "GET", throw: false });
    if (res.status !== 200) throw new Error(`HTTP ${res.status}`);
    const dir = nodePath().dirname(destAbs);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const buf = Buffer.from(res.arrayBuffer);
    fs.writeFileSync(destAbs, buf);
    validateWasmPath(fs, destAbs, "Wasm téléchargé");
  }

  /**
   * Télécharge le manifest (liste gabarits) puis l’archive ZIP du dépôt, et extrait `typeset/`.
   * Utilise uniquement `requestUrl` (pas `fetch`) pour éviter la CORS depuis `app://obsidian.md`.
   */
  async downloadTemplates(): Promise<void> {
    requireDesktopFs();
    const fs = nodeFs();
    const path = nodePath();
    let zipUrl = GITHUB_REPO_ARCHIVE_MAIN;

    const remote = await this.fetchManifestFromRepo();
    const gotRemoteManifest = remote !== null;
    if (remote?.bundleZipUrl?.trim()) zipUrl = remote.bundleZipUrl.trim();

    const zipRes = await requestUrl({ url: zipUrl, method: "GET", throw: false });
    if (zipRes.status !== 200) {
      throw new Error(`Téléchargement ZIP (${zipUrl}) : HTTP ${zipRes.status}`);
    }

    const zip = await JSZip.loadAsync(zipRes.arrayBuffer);
    const root = this.resolveTemplatesRoot();
    if (!fs.existsSync(root)) fs.mkdirSync(root, { recursive: true });
    const n = await extractTypesetFromGithubRepoZip(zip, root, fs, path);
    if (n === 0) {
      throw new Error(
        "Aucun dossier typeset reconnu dans le ZIP (attendu : typeset/layout/… ou typeset/typst/…) — vérifiez le dépôt.",
      );
    }

    const legacyOldlatex = path.join(root, "typeset", "oldlatex");
    if (fs.existsSync(legacyOldlatex)) {
      fs.rmSync(legacyOldlatex, { recursive: true, force: true });
    }

    if (!gotRemoteManifest) {
      const snap = JSON.stringify(EMBEDDED_TEMPLATES_MANIFEST, null, 2);
      fs.writeFileSync(path.join(this.pluginDir(), "templates-manifest.cached.json"), snap, "utf8");
      this.cachedManifest = this.mergeManifestWithLocals(EMBEDDED_TEMPLATES_MANIFEST);
    } else {
      this.cachedManifest = this.mergeManifestWithLocals(this.cachedManifest ?? EMBEDDED_TEMPLATES_MANIFEST);
    }

    this.typstCompiler = null;
    await this.ensureCoverImpositionDefaults();
    await this.refreshTemplateMeta();
    new Notice(`Gabarits installés (${n} fichiers Typst).`);
  }

  /**
   * Ajoute les images référencées dans la note en tant que fichiers d’entrée Pandoc.
   * Cela permet à Pandoc de générer des `mediaFiles` que Typst pourra ensuite résoudre.
   */
  async collectPandocImageFiles(file: TFile, markdown: string): Promise<Record<string, Blob>> {
    const refs = extractMarkdownImageRefs(markdown);
    if (!refs.length) return {};
    const out: Record<string, Blob> = {};
    for (const refRaw of refs) {
      const ref = decodeURIComponent(refRaw.trim());
      if (!ref || /^data:/i.test(ref) || /^\/\//.test(ref)) continue;
      if (/^https?:\/\//i.test(ref)) {
        try {
          const fetchUrl = resolveRemoteImageFetchUrl(ref.trim());
          const res = await requestUrl({
            url: fetchUrl,
            method: "GET",
            throw: false,
            headers: httpHeadersForImageRequest(fetchUrl),
          });
          if (res.status !== 200 || !res.arrayBuffer) continue;
          const blob = new Blob([new Uint8Array(res.arrayBuffer)]);
          const keys = new Set<string>([ref, refRaw.trim(), refRaw]);
          const tail = ref.split("/").pop()?.split("?")[0];
          if (tail) {
            keys.add(tail);
            keys.add(`media/${tail}`);
          }
          for (const k of keys) out[k] = blob;
        } catch {
          /* distant inaccessible */
        }
        continue;
      }
      const hit = resolveLocalImageToFile(this.app, file, refRaw.trim());
      if (!hit) continue;
      try {
        const bin = await this.app.vault.adapter.readBinary(hit.path);
        const blob = new Blob([bin]);
        const normRef = normalizePath(ref.replace(/^\.\//, ""));
        const keys = new Set<string>([
          hit.path,
          normalizePath(hit.path),
          ref,
          refRaw.trim(),
          refRaw,
          normRef,
          hit.name,
          `media/${hit.name}`,
        ]);
        if (file.parent?.path) {
          const base = file.parent.path;
          const joined = normalizePath(`${base}/${normRef}`);
          const alreadyUnderParent =
            normRef === base || normRef.startsWith(`${base}/`);
          if (!alreadyUnderParent) keys.add(joined);
        }
        const tail = hit.path.split("/").pop();
        if (tail) {
          keys.add(tail);
          keys.add(`media/${tail}`);
        }
        for (const k of keys) out[k] = blob;
      } catch {
        /* image illisible: on ignore */
      }
    }
    return out;
  }

  /**
   * Charge un .bib (et optionnellement un .csl) depuis des chemins relatifs à la racine du coffre.
   * Noms virtuels stables pour le VFS Pandoc.
   */
  /** Lit un fichier texte du coffre (chemins relatifs). */
  async readVaultTextRelative(vaultRelativePath: string): Promise<string | null> {
    const p = vaultRelativePath?.trim();
    if (!p) return null;
    const norm = normalizePath(p);
    const af = this.app.vault.getAbstractFileByPath(norm);
    if (!af || !("extension" in af)) return null;
    const tf = af as TFile;
    try {
      return await this.app.vault.read(tf);
    } catch {
      return null;
    }
  }

  async resolveBibliographyForPandoc(): Promise<{
    bibliography: { name: string; blob: Blob } | null;
    csl: { name: string; blob: Blob } | null;
  }> {
    const PANDOC_BIB = "obb-refs.bib";
    const PANDOC_CSL = "obb-style.csl";
    let bibliography: { name: string; blob: Blob } | null = null;
    let csl: { name: string; blob: Blob } | null = null;
    const bibPath = this.settings.bibliographyVaultPath?.trim();
    if (bibPath) {
      const norm = normalizePath(bibPath);
      const af = this.app.vault.getAbstractFileByPath(norm);
      if (af && "extension" in af) {
        const tf = af as TFile;
        if (tf.extension.toLowerCase() === "bib") {
          try {
            const bin = await this.app.vault.adapter.readBinary(tf.path);
            bibliography = { name: PANDOC_BIB, blob: new Blob([bin]) };
          } catch {
            /* fichier illisible */
          }
        }
      }
    }
    if (bibliography) {
      const cslPath = this.settings.cslVaultPath?.trim();
      if (cslPath) {
        const norm = normalizePath(cslPath);
        const af = this.app.vault.getAbstractFileByPath(norm);
        if (af && "extension" in af) {
          const tf = af as TFile;
          if (tf.extension.toLowerCase() === "csl") {
            try {
              const bin = await this.app.vault.adapter.readBinary(tf.path);
              csl = { name: PANDOC_CSL, blob: new Blob([bin]) };
            } catch {
              /* */
            }
          }
        }
      }
    }
    return { bibliography, csl };
  }

  /** Applique chemins coffre + métadonnées livre issus d’un préréglage (plugin). */
  applyPresetCompileFields(vault?: VaultCompilePaths, meta?: BookCompileMeta): void {
    if (vault && Object.keys(vault).length > 0) {
      if (typeof vault.bibliographyVaultPath === "string") {
        this.settings.bibliographyVaultPath = vault.bibliographyVaultPath;
      }
      if (typeof vault.cslVaultPath === "string") {
        this.settings.cslVaultPath = vault.cslVaultPath;
      }
      if (typeof vault.glossaryVaultPath === "string") {
        this.settings.glossaryVaultPath = vault.glossaryVaultPath;
      }
      if (typeof vault.nameIndexVaultPath === "string") {
        this.settings.nameIndexVaultPath = vault.nameIndexVaultPath;
      }
    }
    if (meta && Object.keys(meta).length > 0) {
      if (typeof meta.title === "string") this.settings.title = meta.title;
      if (typeof meta.author === "string") this.settings.author = meta.author;
      if (typeof meta.publisher === "string") this.settings.publisher = meta.publisher;
    }
  }

  parseStoredBookPresets(): StoredBookPreset[] {
    try {
      const raw = this.settings.bookPresetsStoredJson?.trim();
      if (!raw) return [];
      const arr = JSON.parse(raw) as unknown;
      if (!Array.isArray(arr)) return [];
      const out: StoredBookPreset[] = [];
      for (const row of arr) {
        if (!row || typeof row !== "object") continue;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id : "";
        const name = typeof o.name === "string" ? o.name : "Sans nom";
        const updatedAt = typeof o.updatedAt === "string" ? o.updatedAt : "";
        const payload = o.payload;
        if (!id || !payload || typeof payload !== "object") continue;
        const pl = payload as BookLayoutState;
        const def = defaultBookLayoutState();
        const vaultRaw = o.vaultCompilePaths;
        const vaultCompilePaths =
          vaultRaw !== undefined && vaultRaw !== null ? normalizeVaultCompilePaths(vaultRaw) : undefined;
        const metaRaw = o.bookCompileMeta;
        const bookCompileMeta =
          metaRaw !== undefined && metaRaw !== null ? normalizeBookCompileMeta(metaRaw) : undefined;
        out.push({
          id,
          name,
          updatedAt,
          payload: {
            ...def,
            ...pl,
            values: { ...def.values, ...pl.values },
            stringOverrides: { ...def.stringOverrides, ...pl.stringOverrides },
            sectionOrder: pl.sectionOrder ?? def.sectionOrder,
          },
          vaultCompilePaths:
            vaultCompilePaths && Object.keys(vaultCompilePaths).length > 0 ? vaultCompilePaths : undefined,
          bookCompileMeta: bookCompileMeta && Object.keys(bookCompileMeta).length > 0 ? bookCompileMeta : undefined,
        });
      }
      return out;
    } catch {
      return [];
    }
  }

  private persistStoredBookPresets(list: StoredBookPreset[]): void {
    this.settings.bookPresetsStoredJson = JSON.stringify(list);
  }

  async saveBookLayoutPreset(name: string, overwriteId?: string): Promise<void> {
    const cur = this.parseBookLayout();
    const list = this.parseStoredBookPresets();
    const trimmed = name.trim() || "Préréglage";
    const entry = {
      name: trimmed,
      updatedAt: new Date().toISOString(),
      payload: cur,
      vaultCompilePaths: {
        bibliographyVaultPath: this.settings.bibliographyVaultPath,
        cslVaultPath: this.settings.cslVaultPath,
        glossaryVaultPath: this.settings.glossaryVaultPath,
        nameIndexVaultPath: this.settings.nameIndexVaultPath,
      },
      bookCompileMeta: {
        title: this.settings.title,
        author: this.settings.author,
        publisher: this.settings.publisher,
      },
    };
    if (overwriteId) {
      const ix = list.findIndex((x) => x.id === overwriteId);
      if (ix < 0) throw new Error("Préréglage à remplacer introuvable.");
      list[ix] = { ...list[ix], ...entry };
    } else {
      const dup = list.find((p) => p.name.trim().toLowerCase() === trimmed.toLowerCase());
      if (dup) {
        throw new Error("Préréglage en double : utilisez la confirmation d’écrasement.");
      }
      const id = `p_${Date.now().toString(36)}`;
      list.push({ id, ...entry });
    }
    this.persistStoredBookPresets(list);
    await this.saveSettings();
  }

  async loadBookLayoutPreset(id: string): Promise<void> {
    const p = this.parseStoredBookPresets().find((x) => x.id === id);
    if (!p) throw new Error("Préréglage introuvable.");
    const def = defaultBookLayoutState();
    const merged: BookLayoutState = {
      ...def,
      ...p.payload,
      values: { ...def.values, ...p.payload.values },
      stringOverrides: { ...def.stringOverrides, ...p.payload.stringOverrides },
      sectionOrder: p.payload.sectionOrder ?? def.sectionOrder,
    };
    merged.sectionOrder = reconcileSectionOrder(merged.sectionOrder, merged.values);
    this.settings.bookLayoutJson = JSON.stringify(merged);
    this.applyPresetCompileFields(p.vaultCompilePaths, p.bookCompileMeta);
    await this.saveSettings();
  }

  async deleteBookLayoutPreset(id: string): Promise<void> {
    const list = this.parseStoredBookPresets().filter((x) => x.id !== id);
    this.persistStoredBookPresets(list);
    await this.saveSettings();
  }

  listBookPresetFiles(): { relPath: string; label: string }[] {
    const fs = tryNodeFs();
    const path = tryNodePath();
    if (!fs || !path) return [];
    const root = this.resolveTemplatesRoot();
    if (!root) return [];
    const dir = path.join(root, BOOK_PRESETS_RELATIVE_DIR);
    if (!fs.existsSync(dir)) return [];
    const out: { relPath: string; label: string }[] = [];
    for (const name of fs.readdirSync(dir)) {
      if (!name.toLowerCase().endsWith(".json")) continue;
      const rel = path.relative(root, path.join(dir, name)).replace(/\\/g, "/");
      out.push({ relPath: rel, label: name });
    }
    out.sort((a, b) => a.relPath.localeCompare(b.relPath));
    return out;
  }

  reportCompilePhase(phase: string): void {
    this.bookPreviewView?.setStatus(`Compilation… (${phase})`, { busy: true });
  }

  async loadBookLayoutPresetFromFile(relPath: string): Promise<void> {
    requireDesktopFs();
    const fs = nodeFs();
    const path = nodePath();
    const norm = relPath.replace(/\\/g, "/");
    if (!norm.startsWith(`${BOOK_PRESETS_RELATIVE_DIR}/`)) {
      throw new Error("Fichier préréglage : chemin doit être sous typeset/presets/.");
    }
    const root = this.resolveTemplatesRoot();
    const full = path.join(root, norm);
    const raw = fs.readFileSync(full, "utf8");
    const parsed = parseBookLayoutPresetJson(raw);
    if (!parsed) throw new Error("JSON préréglage invalide (version ou schéma).");
    const payload = normalizePresetPayload(parsed.payload);
    const def = defaultBookLayoutState();
    const merged: BookLayoutState = {
      ...def,
      ...payload,
      values: { ...def.values, ...payload.values },
      stringOverrides: { ...def.stringOverrides, ...payload.stringOverrides },
      sectionOrder: payload.sectionOrder ?? def.sectionOrder,
    };
    merged.sectionOrder = reconcileSectionOrder(merged.sectionOrder, merged.values);
    this.settings.bookLayoutJson = JSON.stringify(merged);
    this.applyPresetCompileFields(parsed.vaultCompilePaths, parsed.bookCompileMeta);
    await this.saveSettings();
  }

  async compileActiveNoteToPdf(): Promise<{ pdf: Uint8Array; fileBase: string; folder: string }> {
    requireDesktopFs();
    const file = this.app.workspace.getActiveFile();
    if (!file) throw new Error("Aucun fichier actif.");
    const text = await this.app.vault.read(file);
    const convert = await this.ensurePandocConvert();
    const normalizedMd = normalizeWikiImagesForPandoc(text);
    const extraFiles = await this.collectPandocImageFiles(file, normalizedMd);
    const mediaDebugLog = this.settings.debugMedia ? [] as string[] : undefined;
    const bookLayout = this.parseBookLayout();
    const { bibliography, csl } = await this.resolveBibliographyForPandoc();
    const glossaryMarkdown = await this.readVaultTextRelative(this.settings.glossaryVaultPath);
    const nameIndexMarkdown = await this.readVaultTextRelative(this.settings.nameIndexVaultPath);
    const reportPhase = (msg: string) => this.reportCompilePhase(msg);
    reportPhase("Pandoc…");
    await yieldToMainThread();
    const { typst, stderr, mediaFiles } = await pandocMarkdownToTypst({
      convert,
      sourceFormat: "md",
      sourceText: text,
      titleFallback: this.settings.title || file.basename,
      extraFiles,
      bibliography,
      csl,
      markdownHorizontalRule: markdownHorizontalRuleFromBookValues(bookLayout.values),
    });
    await yieldToMainThread();
    mediaDebugLog?.push(`[pandoc] stderr (${stderr.length} car.) : ${stderr.slice(0, 600)}`);
    mediaDebugLog?.push(`[pandoc] mediaFiles (${Object.keys(mediaFiles).length}) : ${Object.keys(mediaFiles).join(", ") || "(vide)"}`);
    mediaDebugLog?.push(`[typst brut] ${typst.match(/image\s*\(/g)?.length ?? 0} appel(s) image(`);

    const manifest = this.resolveTemplatesManifest();
    const templates = manifest?.templates ?? [];
    const sel =
      templates.find((t) => t.id === this.settings.selectedTemplateId) ??
      templates[0] ??
      null;
    if (!sel?.mainTypPath) throw new Error("Aucun gabarit — renseignez le manifest et un bundle typeset.");

    const loader = createFsAssetLoader(this.resolveTemplatesRoot());
    const tplSrc = await loader.fetchTextFile(sel.mainTypPath);
    if (!tplSrc) throw new Error(`Template introuvable dans le bundle : ${sel.mainTypPath}`);

    const compiler = await this.ensureTypstCompiler();
    const out = await compileTypstBookToPdf({
      compiler,
      loader,
      templateMainSource: tplSrc,
      generatedTypst: typst,
      bookLayout,
      meta: {
        title: this.settings.title,
        author: this.settings.author,
        publisher: this.settings.publisher,
      },
      pandocConvert: convert,
      glossaryMarkdown: glossaryMarkdown ?? undefined,
      nameIndexMarkdown: nameIndexMarkdown ?? undefined,
      mediaFiles,
      mediaDebugLog,
      onCompilePhase: reportPhase,
      typstCompileTimeoutMs: 600_000,
      fetchRemoteBytes: async (url: string) => {
        try {
          const fetchUrl = resolveRemoteImageFetchUrl(url);
          const res = await requestUrl({
            url: fetchUrl,
            method: "GET",
            throw: false,
            headers: httpHeadersForImageRequest(fetchUrl),
          });
          mediaDebugLog?.push(`[http] ${fetchUrl.slice(0, 100)} → status ${res.status}`);
          if (res.status !== 200 || !res.arrayBuffer) return null;
          return new Uint8Array(res.arrayBuffer);
        } catch {
          return null;
        }
      },
    });
    if (mediaDebugLog?.length) {
      console.info(`[obbwasm médias]\n${mediaDebugLog.join("\n")}`);
    }
    if (!out.pdf) {
      const msg = JSON.stringify(out.diagnostics ?? []);
      throw new Error(`Compilation sans PDF. ${msg.slice(0, 400)}`);
    }
    this.lastInteriorPdf = new Uint8Array(out.pdf);
    try {
      if (out.pdf.byteLength <= PDF_PAGE_COUNT_MAX_BYTES) {
        const pc = await countPdfPages(out.pdf);
        if (pc > 0) {
          this.settings.innerPages = pc;
          await this.saveSettings();
        }
      }
    } catch {
      /* ignore */
    }
    return {
      pdf: this.lastInteriorPdf,
      fileBase: file.basename.replace(/\.md$/i, ""),
      folder: file.parent?.path ?? "",
    };
  }

  async compileCoverPdf(): Promise<Uint8Array> {
    requireDesktopFs();
    const loader = createFsAssetLoader(this.resolveTemplatesRoot());
    const rel = this.settings.selectedCoverTemplatePath.trim();
    if (!rel) throw new Error("Choisissez un gabarit de couverture (.typ).");
    const src = await loader.fetchTextFile(rel);
    if (!src) throw new Error(`Couverture introuvable dans le bundle : ${rel}`);
    const spine = spineThicknessMm(this.settings.innerPages, this.settings.grammage);
    let source = String(src);
    source = overrideTypstLet(source, "title", JSON.stringify(this.settings.title));
    source = overrideTypstLet(source, "author", JSON.stringify(this.settings.author));
    source = overrideTypstLet(source, "edition", JSON.stringify(this.settings.publisher));
    source = overrideTypstLet(source, "spine-thickness", `${spine}mm`);

    const compiler = await this.ensureTypstCompiler();
    compiler.reset();
    compiler.resetShadow();
    await mountTypstPackagesFromLoader(compiler, loader);
    compiler.addSource("/main.typ", source);

    const compiled = await compiler.runWithWorld(
      {
        root: "/",
        mainFilePath: "/main.typ",
        inputs: {
          title: this.settings.title,
          author: this.settings.author,
        },
      },
      async (world) => world.pdf({ diagnostics: "unix" }),
    );
    if (!compiled?.result) {
      const hint = firstDiagnosticMessage(compiled);
      throw new Error(hint || JSON.stringify(compiled?.diagnostics ?? [], null, 0).slice(0, 400));
    }
    return Uint8Array.from(compiled.result);
  }

  async compileImpositionPdf(): Promise<Uint8Array> {
    requireDesktopFs();
    const bytes = this.lastInteriorPdf;
    if (!bytes?.length) {
      throw new Error("Générez d’abord le PDF intérieur (« Compiler la note active »).");
    }
    const pathSel = this.settings.selectedImpositionTemplatePath.trim();
    if (!pathSel) throw new Error("Choisissez un gabarit d’imposition (.typ, ex. …-4spread.typ).");
    const spec = parseImpositionTemplateSpec(pathSel);
    if (!spec) {
      throw new Error(
        "Nom de fichier imposition non reconnu (attendu : …-Nspread.typ ou …-Nsignature.typ).",
      );
    }
    const loader = createFsAssetLoader(this.resolveTemplatesRoot());
    const totalPages = await countPdfPages(bytes);
    const allPages = Array.from({ length: totalPages }, (_, i) => i + 1);
    const orderedBase = spec.kind === "spread" ? reorderSpreadSequence(allPages) : allPages;
    const missing = (spec.packetSize - (orderedBase.length % spec.packetSize)) % spec.packetSize;
    const ordered = orderedBase.concat(Array.from({ length: missing }, () => 0));
    const packets = chunkArray(ordered, spec.packetSize);

    const compiler = await this.ensureTypstCompiler();
    compiler.reset();
    compiler.resetShadow();
    await mountTypstPackagesFromLoader(compiler, loader);
    compiler.mapShadow("/export.pdf", bytes);
    compiler.mapShadow("export.pdf", bytes);

    const compensationMm = Number((-11 * this.settings.impositionPaperThicknessMm).toFixed(2));
    const mainSource = buildImpositionMainTyp(spec.kind, spec.packetSize, packets, compensationMm);
    compiler.addSource("/main.typ", mainSource);

    const compiled = await compiler.runWithWorld(
      { root: "/", mainFilePath: "/main.typ", inputs: {} },
      async (world) => world.pdf({ diagnostics: "unix" }),
    );
    if (!compiled?.result) {
      const hint = firstDiagnosticMessage(compiled);
      throw new Error(hint || "Imposition sans PDF.");
    }
    return Uint8Array.from(compiled.result);
  }

  /** Chemin coffre normalisé du PDF auxiliaire pour la note active (`suffix` ex. `-obb`). */
  getAuxPdfDestPath(suffix: string): string {
    const file = this.app.workspace.getActiveFile();
    const base = file?.basename.replace(/\.md$/i, "") ?? "export";
    const folder = file?.parent?.path ?? "";
    return normalizePath(folder ? `${folder}/${base}${suffix}.pdf` : `${base}${suffix}.pdf`);
  }

  /**
   * Indique si ce fichier du coffre est ouvert dans un onglet (visionneuse PDF, etc.).
   * Ne se limite pas à `type === "pdf"` : les volets différés n’exposent pas toujours la vue PDF réelle.
   */
  isPdfOpenInWorkspace(vaultRelativePath: string): boolean {
    let found = false;
    this.app.workspace.iterateAllLeaves((leaf) => {
      if (found) return;
      for (const p of collectOpenFilePathsFromLeaf(leaf)) {
        if (vaultPathsEqual(p, vaultRelativePath)) {
          found = true;
          return;
        }
      }
    });
    return found;
  }

  /** Enregistre un PDF auxiliaire à côté de la note active (suffixe avant `.pdf`). */
  async saveAuxPdf(pdf: Uint8Array, suffix: string): Promise<string> {
    const dest = this.getAuxPdfDestPath(suffix);
    if (this.isPdfOpenInWorkspace(dest)) {
      throw new Error(frLocale.ui.savePdfBlockedOpenViewer);
    }
    const outBin = new Uint8Array(pdf.byteLength);
    outBin.set(pdf);
    const buf = outBin.buffer.slice(outBin.byteOffset, outBin.byteOffset + outBin.byteLength);
    const existing = this.app.vault.getAbstractFileByPath(dest);
    try {
      if (existing && "extension" in existing) {
        await this.app.vault.modifyBinary(existing as TFile, buf);
      } else {
        await this.app.vault.createBinary(dest, buf);
      }
    } catch (e) {
      const raw = e instanceof Error ? e.message : String(e);
      if (this.isPdfOpenInWorkspace(dest)) {
        throw new Error(frLocale.ui.savePdfBlockedOpenViewer);
      }
      if (/EBUSY|EPERM|locked|being used|accès refusé|denied|in use/i.test(raw)) {
        throw new Error(`${frLocale.ui.savePdfBlockedOpenViewer} (${raw})`);
      }
      throw e;
    }
    return dest;
  }

  async activateView(): Promise<void> {
    let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_OBB)[0];
    if (!leaf) {
      leaf = this.app.workspace.getRightLeaf(false) ?? this.app.workspace.getLeaf(true);
    }
    await leaf.setViewState({ type: VIEW_TYPE_OBB, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}

class ObbBookView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ObbWasmBookPlugin,
  ) {
    super(leaf);
  }

  getViewType(): string {
    return VIEW_TYPE_OBB;
  }

  getDisplayText(): string {
    return "OBB livre PDF";
  }

  getIcon(): string {
    return "book-open";
  }

  private frame!: HTMLIFrameElement;
  private statusEl!: HTMLDivElement;
  private statusTextEl!: HTMLElement;
  private compileActionButtons: HTMLButtonElement[] = [];
  private spineHintEl!: HTMLSpanElement;
  private innerPagesInput!: HTMLInputElement;
  private bookOptsRoot!: HTMLElement;
  private sectionOrderRoot!: HTMLElement;
  private metaInputs!: { title: HTMLInputElement; author: HTMLInputElement; publisher: HTMLInputElement };
  private citeVaultInputs!: {
    bib: HTMLInputElement;
    csl: HTMLInputElement;
    glossary: HTMLInputElement;
    nameIndex: HTMLInputElement;
  };
  /** Sections repliables des options livre (persistant lors des reconstructions). */
  private bookOptSectionOpen: Partial<Record<string, boolean>> = {};
  /** Dernière URL blob de l’aperçu PDF — révoquée avec délai pour éviter un crash iframe. */
  private previewBlobUrl: string | null = null;
  /** Panneau aperçu PDF (bas de la vue) — replié par défaut. */
  private previewPanelOpen = false;
  private previewPanelRoot!: HTMLElement;
  private previewPanelBody!: HTMLElement;
  private previewResizeHandle!: HTMLElement;
  private previewPanelChevron!: HTMLElement;
  private previewResizeCleanup: (() => void) | null = null;

  private bindMeta(input: HTMLInputElement, key: "title" | "author" | "publisher"): void {
    input.value = this.plugin.settings[key];
    input.addEventListener("change", async () => {
      this.plugin.settings[key] = input.value;
      await this.plugin.saveSettings();
    });
  }

  private updateSpineHint(): void {
    const spine = spineThicknessMm(this.plugin.settings.innerPages, this.plugin.settings.grammage);
    this.spineHintEl.setText(`Épaisseur dos estimée : ${spine} mm (pages intérieures × grammage).`);
  }

  private setPreviewPanelOpen(open: boolean): void {
    this.previewPanelOpen = open;
    if (this.previewPanelBody) this.previewPanelBody.hidden = !open;
    if (this.previewResizeHandle) this.previewResizeHandle.hidden = !open;
    if (this.previewPanelChevron) this.previewPanelChevron.textContent = open ? "▾" : "▸";
  }

  private getPreviewPanelHeightLimits(): { min: number; max: number } {
    const min = PREVIEW_PANEL_HEIGHT_MIN;
    const viewH = this.contentEl?.clientHeight ?? 600;
    const max = Math.max(min, Math.floor(viewH * 0.92));
    return { min, max };
  }

  private applyPreviewPanelHeight(px: number): void {
    if (!this.previewPanelBody) return;
    const { min, max } = this.getPreviewPanelHeightLimits();
    const h = Math.min(max, Math.max(min, Math.round(px)));
    this.previewPanelBody.style.height = `${h}px`;
    this.previewPanelBody.style.flexBasis = `${h}px`;
  }

  private readPreviewPanelHeight(): number {
    const { min, max } = this.getPreviewPanelHeightLimits();
    const saved = this.plugin.settings.previewPanelHeightPx;
    return Math.min(max, Math.max(min, saved));
  }

  private setupPreviewPanelResize(handle: HTMLElement): void {
    this.previewResizeCleanup?.();
    let startY = 0;
    let startH = 0;

    const onPointerMove = (e: PointerEvent) => {
      const dy = startY - e.clientY;
      this.applyPreviewPanelHeight(startH + dy);
    };

    const onPointerUp = async (e: PointerEvent) => {
      handle.releasePointerCapture(e.pointerId);
      handle.classList.remove("obbwasm-preview-resize-handle--active");
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      const h = this.previewPanelBody?.clientHeight ?? startH;
      const { min, max } = this.getPreviewPanelHeightLimits();
      const clamped = Math.min(max, Math.max(min, h));
      this.plugin.settings.previewPanelHeightPx = clamped;
      await this.plugin.saveSettings();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 || !this.previewPanelOpen) return;
      e.preventDefault();
      startY = e.clientY;
      startH = this.previewPanelBody?.clientHeight ?? this.readPreviewPanelHeight();
      handle.setPointerCapture(e.pointerId);
      handle.classList.add("obbwasm-preview-resize-handle--active");
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", onPointerUp);
      window.addEventListener("pointercancel", onPointerUp);
    };

    handle.addEventListener("pointerdown", onPointerDown);
    this.previewResizeCleanup = () => {
      handle.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }

  private showPdfPreview(data: Uint8Array): void {
    if (data.byteLength > PDF_PREVIEW_MAX_BYTES) {
      this.clearPdfPreview();
      this.setPreviewPanelOpen(false);
      return;
    }
    const blob = new Blob([data], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const previous = this.previewBlobUrl;
    this.previewBlobUrl = url;
    this.frame.src = url;
    this.setPreviewPanelOpen(true);
    if (previous?.startsWith("blob:")) {
      window.setTimeout(() => URL.revokeObjectURL(previous), 750);
    }
  }

  /** Libère l’aperçu blob (évite conflits avec l’écriture du PDF sur disque). */
  private clearPdfPreview(): void {
    if (this.previewBlobUrl?.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(this.previewBlobUrl);
      } catch {
        /* */
      }
    }
    this.previewBlobUrl = null;
    if (this.frame) {
      this.frame.src = "about:blank";
    }
  }

  private async patchBookValues(patch: Partial<Record<string, boolean | string>>): Promise<void> {
    const layout = this.plugin.parseBookLayout();
    const nextValues: Record<string, boolean | string> = { ...layout.values };
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) nextValues[k] = v;
    }
    let sectionOrder = reconcileSectionOrder(layout.sectionOrder, nextValues);
    if (patch["toc-position"] !== undefined || patch["bibliography-position"] !== undefined) {
      sectionOrder = applyTocAndBibPlacement(sectionOrder, nextValues);
    }
    this.plugin.settings.bookLayoutJson = JSON.stringify({
      ...layout,
      values: nextValues,
      sectionOrder,
    });
    await this.plugin.saveSettings();
    await this.rebuildBookOptionsUI();
  }

  private syncCompileFieldsFromPluginSettings(): void {
    const s = this.plugin.settings;
    this.metaInputs.title.value = s.title;
    this.metaInputs.author.value = s.author;
    this.metaInputs.publisher.value = s.publisher;
    this.citeVaultInputs.bib.value = s.bibliographyVaultPath;
    this.citeVaultInputs.csl.value = s.cslVaultPath;
    this.citeVaultInputs.glossary.value = s.glossaryVaultPath;
    this.citeVaultInputs.nameIndex.value = s.nameIndexVaultPath;
  }

  private async rebuildBookOptionsUI(): Promise<void> {
    if (!this.bookOptsRoot || !this.sectionOrderRoot) return;
    mountBookOptionsPanel(this.bookOptsRoot, {
      fr: frLocale,
      templateMeta: this.plugin.templateMeta,
      openSections: this.bookOptSectionOpen,
      getLayout: () => this.plugin.parseBookLayout(),
      setLayout: async (next) => {
        this.plugin.settings.bookLayoutJson = JSON.stringify(next);
        await this.plugin.saveSettings();
      },
      patchValues: (p) => this.patchBookValues(p),
    });
    mountSectionOrderPanel(this.sectionOrderRoot, frLocale, () => this.plugin.parseBookLayout(), async (next) => {
      this.plugin.settings.bookLayoutJson = JSON.stringify(next);
      await this.plugin.saveSettings();
    });
  }

  async onOpen(): Promise<void> {
    this.plugin.bookPreviewView = this;
    this.plugin.resolveTemplatesManifest();
    await this.plugin.refreshTemplateMeta();
    const container = this.contentEl;
    container.empty();
    container.addClass("obbwasm-view");
    const scroll = container.createDiv({ cls: "obbwasm-view-scroll" });

    scroll.createEl("div", { cls: "obbwasm-section-title", text: "Métadonnées" });
    const meta = scroll.createDiv({ cls: "obbwasm-section" });
    const t = this.labeledText(meta, "Titre");
    const a = this.labeledText(meta, "Auteur");
    const p = this.labeledText(meta, "Éditeur / édition");
    this.metaInputs = { title: t, author: a, publisher: p };
    this.bindMeta(t, "title");
    this.bindMeta(a, "author");
    this.bindMeta(p, "publisher");

    scroll.createEl("div", { cls: "obbwasm-section-title", text: "Citations (Pandoc)" });
    const citeSec = scroll.createDiv({ cls: "obbwasm-section" });
    citeSec.createEl("p", {
      cls: "obbwasm-help-text",
      text: "Chemins relatifs à la racine du coffre. Le style CSL n’est utilisé que si le fichier .bib est trouvé.",
    });
    const bibPathInput = this.labeledText(citeSec, "Bibliographie (.bib)");
    bibPathInput.placeholder = "ex. Bibliographie/refs.bib";
    bibPathInput.value = this.plugin.settings.bibliographyVaultPath;
    bibPathInput.addEventListener("change", async () => {
      this.plugin.settings.bibliographyVaultPath = bibPathInput.value;
      await this.plugin.saveSettings();
    });
    const cslPathInput = this.labeledText(citeSec, "Style de citations (.csl)");
    cslPathInput.placeholder = "ex. Styles/apa.csl";
    cslPathInput.value = this.plugin.settings.cslVaultPath;
    cslPathInput.addEventListener("change", async () => {
      this.plugin.settings.cslVaultPath = cslPathInput.value;
      await this.plugin.saveSettings();
    });
    citeSec.createEl("p", {
      cls: "obbwasm-help-text",
      text: "Notes markdown du coffre : une section # titre par entrée (Wikilinks [[glossaire#…]] / [[index#…]]).",
    });
    const glossaryPathInput = this.labeledText(citeSec, "Note glossaire (vault)");
    glossaryPathInput.placeholder = "ex. Livre/glossaire.md";
    glossaryPathInput.value = this.plugin.settings.glossaryVaultPath;
    glossaryPathInput.addEventListener("change", async () => {
      this.plugin.settings.glossaryVaultPath = glossaryPathInput.value;
      await this.plugin.saveSettings();
    });
    const nameIndexPathInput = this.labeledText(citeSec, "Note index des noms (vault)");
    nameIndexPathInput.placeholder = "ex. Livre/index.md";
    nameIndexPathInput.value = this.plugin.settings.nameIndexVaultPath;
    nameIndexPathInput.addEventListener("change", async () => {
      this.plugin.settings.nameIndexVaultPath = nameIndexPathInput.value;
      await this.plugin.saveSettings();
    });
    this.citeVaultInputs = {
      bib: bibPathInput,
      csl: cslPathInput,
      glossary: glossaryPathInput,
      nameIndex: nameIndexPathInput,
    };

    scroll.createEl("div", { cls: "obbwasm-section-title", text: "Mise en page livre" });
    const layoutSec = scroll.createDiv({ cls: "obbwasm-section" });
    const gramRow = layoutSec.createDiv({ cls: "obbwasm-field-row" });
    gramRow.createSpan({ cls: "obbwasm-field-label", text: "Grammage papier (dos)" });
    const gramSel = gramRow.createEl("select", { cls: "dropdown" });
    for (const g of [80, 100, 120] as const) {
      gramSel.createEl("option", { text: `${g} g/m²`, value: String(g) });
    }
    gramSel.value = String(this.plugin.settings.grammage);
    gramSel.addEventListener("change", async () => {
      this.plugin.settings.grammage = Number(gramSel.value);
      await this.plugin.saveSettings();
      this.updateSpineHint();
    });

    const tplRow = layoutSec.createDiv({ cls: "obbwasm-field-row" });
    tplRow.createSpan({ cls: "obbwasm-field-label", text: "Gabarit (manifest)" });
    const tplSel = tplRow.createEl("select", { cls: "dropdown" });
    const manifest = this.plugin.cachedManifest;
    const tpls = manifest?.templates ?? [];
    const selId = this.plugin.settings.selectedTemplateId || tpls[0]?.id || "";
    for (const x of tpls) {
      tplSel.createEl("option", { text: `${x.name} (${x.id})`, value: x.id });
    }
    if (tpls.length === 0) {
      tplSel.createEl("option", { text: "(réglages : Télécharger les gabarits)", value: "" });
    }
    tplSel.value = selId && tpls.some((x) => x.id === selId) ? selId : tpls[0]?.id ?? "";
    tplSel.addEventListener("change", async () => {
      this.plugin.settings.selectedTemplateId = tplSel.value;
      await this.plugin.saveSettings();
      await this.plugin.refreshTemplateMeta();
      await this.rebuildBookOptionsUI();
    });

    this.bookOptsRoot = layoutSec.createDiv({ cls: "obb-book-opts-root" });
    this.sectionOrderRoot = layoutSec.createDiv({ cls: "obb-section-order-root" });
    const presetsRoot = layoutSec.createDiv({ cls: "obb-presets-root" });
    mountBookLayoutPresetsPanel(presetsRoot, frLocale, {
      listStored: () => this.plugin.parseStoredBookPresets(),
      listFilePresets: () => this.plugin.listBookPresetFiles(),
      saveCurrentAs: (name, overwriteId) => this.plugin.saveBookLayoutPreset(name, overwriteId),
      loadStored: (id) => this.plugin.loadBookLayoutPreset(id),
      deleteStored: (id) => this.plugin.deleteBookLayoutPreset(id),
      loadFromFile: (rel) => this.plugin.loadBookLayoutPresetFromFile(rel),
      onPresetLoaded: async (d: PresetLoadDetail) => {
        if (d.kind === "stored") {
          const row = this.plugin.parseStoredBookPresets().find((x) => x.id === d.id);
          const name = row?.name ?? d.id;
          new Notice(`${frLocale.ui.presetLoadedNoticePrefix} « ${name} ».`);
        } else {
          const short = d.relPath.replace(/^typeset\/presets\//, "");
          new Notice(`${frLocale.ui.presetLoadedFileNoticePrefix} ${short}`);
        }
      },
      onPresetSaved: (name) => {
        new Notice(`${frLocale.ui.presetSavedNoticePrefix} « ${name} ».`);
      },
      onChanged: async () => {
        await this.plugin.refreshTemplateMeta();
        await this.rebuildBookOptionsUI();
        this.syncCompileFieldsFromPluginSettings();
      },
    });
    await this.rebuildBookOptionsUI();

    scroll.createEl("div", { cls: "obbwasm-section-title", text: "Intérieur" });
    const intSec = scroll.createDiv({ cls: "obbwasm-section" });
    const intActions = intSec.createDiv({ cls: "obbwasm-actions-row" });
    intActions.createEl("button", { text: "Compiler la note active → PDF" }, (b) => {
      b.addClass("mod-cta");
      this.compileActionButtons.push(b);
      b.addEventListener("click", () => void this.runCompile());
    });
    this.mountCompileStatusRow(intSec);

    scroll.createEl("div", { cls: "obbwasm-section-title", text: "Couverture" });
    const covSec = scroll.createDiv({ cls: "obbwasm-section" });
    const covRow = covSec.createDiv({ cls: "obbwasm-field-row" });
    covRow.createSpan({ cls: "obbwasm-field-label", text: "Gabarit .typ" });
    const covSel = covRow.createEl("select", { cls: "dropdown" });
    const root = this.plugin.resolveTemplatesRoot();
    const covers = listTypFiles(root, "cover");
    for (const c of covers) {
      covSel.createEl("option", { text: c, value: c });
    }
    if (covers.length === 0) {
      covSel.createEl("option", { text: "(aucun — réglages : Télécharger les gabarits)", value: "" });
    }
    covSel.value =
      this.plugin.settings.selectedCoverTemplatePath &&
      covers.includes(this.plugin.settings.selectedCoverTemplatePath)
        ? this.plugin.settings.selectedCoverTemplatePath
        : covers[0] ?? "";
    covSel.addEventListener("change", async () => {
      this.plugin.settings.selectedCoverTemplatePath = covSel.value;
      await this.plugin.saveSettings();
    });

    const ipRow = covSec.createDiv({ cls: "obbwasm-field-row" });
    ipRow.createSpan({ cls: "obbwasm-field-label", text: "Pages intérieures (dos)" });
    this.innerPagesInput = ipRow.createEl("input", {
      cls: "obbwasm-field-input",
      type: "number",
      attr: { min: "1", step: "1" },
    });
    this.innerPagesInput.value = String(this.plugin.settings.innerPages);
    this.innerPagesInput.addEventListener("change", async () => {
      const n = Number(this.innerPagesInput.value);
      this.plugin.settings.innerPages = Number.isFinite(n) && n > 0 ? Math.round(n) : 1;
      await this.plugin.saveSettings();
      this.updateSpineHint();
    });

    this.spineHintEl = covSec.createEl("p", { cls: "obbwasm-help-text" });
    this.updateSpineHint();

    covSec.createDiv({ cls: "obbwasm-actions-row" }).createEl("button", { text: "Générer couverture PDF" }, (b) => {
      b.addEventListener("click", () => void this.runCover());
    });

    scroll.createEl("div", { cls: "obbwasm-section-title", text: "Imposition" });
    const impSec = scroll.createDiv({ cls: "obbwasm-section" });
    impSec.createEl("p", {
      cls: "obbwasm-help-text",
      text: "Utilise le dernier PDF intérieur compilé ci-dessus. Compensation = −11 × épaisseur feuille (mm).",
    });
    const impRow = impSec.createDiv({ cls: "obbwasm-field-row" });
    impRow.createSpan({ cls: "obbwasm-field-label", text: "Gabarit imposition" });
    const impSel = impRow.createEl("select", { cls: "dropdown" });
    const imposes = listTypFiles(root, "impose");
    for (const im of imposes) {
      impSel.createEl("option", { text: im, value: im });
    }
    if (imposes.length === 0) {
      impSel.createEl("option", { text: "(aucun)", value: "" });
    }
    impSel.value =
      this.plugin.settings.selectedImpositionTemplatePath &&
      imposes.includes(this.plugin.settings.selectedImpositionTemplatePath)
        ? this.plugin.settings.selectedImpositionTemplatePath
        : imposes[0] ?? "";
    impSel.addEventListener("change", async () => {
      this.plugin.settings.selectedImpositionTemplatePath = impSel.value;
      await this.plugin.saveSettings();
    });

    const thickRow = impSec.createDiv({ cls: "obbwasm-field-row" });
    thickRow.createSpan({ cls: "obbwasm-field-label", text: "Épaisseur feuille (mm)" });
    const thickIn = thickRow.createEl("input", {
      cls: "obbwasm-field-input",
      type: "number",
      attr: { min: "0.01", step: "0.01" },
    });
    thickIn.value = String(this.plugin.settings.impositionPaperThicknessMm);
    thickIn.addEventListener("change", async () => {
      const v = Number(thickIn.value);
      this.plugin.settings.impositionPaperThicknessMm =
        Number.isFinite(v) && v > 0 ? Number(v.toFixed(4)) : 0.1;
      thickIn.value = String(this.plugin.settings.impositionPaperThicknessMm);
      await this.plugin.saveSettings();
    });

    impSec.createDiv({ cls: "obbwasm-actions-row" }).createEl("button", { text: "Générer imposition PDF" }, (b) => {
      b.addEventListener("click", () => void this.runImposition());
    });

    this.previewPanelRoot = container.createDiv({ cls: "obbwasm-preview-panel" });
    const previewToggle = this.previewPanelRoot.createEl("button", {
      cls: "obbwasm-preview-panel-toggle",
      type: "button",
    });
    this.previewPanelChevron = previewToggle.createSpan({ cls: "obbwasm-preview-chevron", text: "▸" });
    previewToggle.createSpan({ text: " Aperçu PDF" });
    previewToggle.addEventListener("click", () => {
      this.setPreviewPanelOpen(!this.previewPanelOpen);
    });

    this.previewResizeHandle = this.previewPanelRoot.createDiv({
      cls: "obbwasm-preview-resize-handle",
      attr: { title: "Glisser pour redimensionner l’aperçu" },
    });
    this.previewResizeHandle.hidden = true;
    this.setupPreviewPanelResize(this.previewResizeHandle);

    this.previewPanelBody = this.previewPanelRoot.createDiv({ cls: "obbwasm-preview-panel-body" });
    this.previewPanelBody.hidden = true;
    this.applyPreviewPanelHeight(this.readPreviewPanelHeight());

    const frameHolder = this.previewPanelBody.createDiv({ cls: "obbwasm-view-body" });
    const iframe = frameHolder.createEl("iframe", {
      cls: "obbwasm-preview-frame",
      attr: { title: "Aperçu PDF" },
    });
    this.frame = iframe;
  }

  private mountCompileStatusRow(container: HTMLElement): void {
    const row = container.createDiv({ cls: "obbwasm-view-status" });
    row.createSpan({ cls: "obbwasm-status-spinner", attr: { "aria-hidden": "true" } });
    this.statusTextEl = row.createSpan({ cls: "obbwasm-status-text", text: "Prêt." });
    this.statusEl = row;
  }

  private labeledText(container: HTMLElement, label: string): HTMLInputElement {
    const row = container.createDiv({ cls: "obbwasm-field-row" });
    row.createSpan({ cls: "obbwasm-field-label", text: label });
    return row.createEl("input", { type: "text", cls: "obbwasm-field-input" });
  }

  setStatus(msg: string, options?: { busy?: boolean }): void {
    if (this.statusTextEl) this.statusTextEl.setText(msg);
    if (options?.busy !== undefined) this.setCompileBusy(options.busy);
  }

  setCompileBusy(busy: boolean): void {
    this.statusEl?.toggleClass("obbwasm-view-status--busy", busy);
    for (const btn of this.compileActionButtons) btn.disabled = busy;
  }

  async runCompile(): Promise<void> {
    this.setCompileBusy(true);
    this.setStatus("Compilation… — les gros fichiers peuvent prendre plusieurs minutes.");
    this.setPreviewPanelOpen(true);
    try {
      if (this.plugin.isPdfOpenInWorkspace(this.plugin.getAuxPdfDestPath("-obb"))) {
        throw new Error(frLocale.ui.savePdfBlockedOpenViewer);
      }
      const { pdf, fileBase } = await this.plugin.compileActiveNoteToPdf();
      this.clearPdfPreview();
      const dest = await this.plugin.saveAuxPdf(pdf, "-obb");
      const previewSkipped = pdf.byteLength > PDF_PREVIEW_MAX_BYTES;
      if (!previewSkipped) this.showPdfPreview(pdf);
      this.setStatus(
        previewSkipped
          ? `OK — ${fileBase}.pdf (${pdf.byteLength} octets, aperçu désactivé — PDF volumineux)`
          : `OK — ${fileBase}.pdf (${pdf.byteLength} octets)`,
      );
      new Notice(
        previewSkipped
          ? `PDF enregistré : ${dest} (aperçu désactivé, fichier volumineux)`
          : `PDF enregistré : ${dest}`,
      );
      this.innerPagesInput.value = String(this.plugin.settings.innerPages);
      this.updateSpineHint();
    } catch (e) {
      const msg = (e as Error).message;
      this.setStatus(`Erreur : ${msg}`);
      new Notice(msg, 8000);
    } finally {
      this.setCompileBusy(false);
    }
  }

  async runCover(): Promise<void> {
    this.setCompileBusy(true);
    this.setStatus("Couverture…", { busy: true });
    try {
      if (this.plugin.isPdfOpenInWorkspace(this.plugin.getAuxPdfDestPath("-obb-cover"))) {
        throw new Error(frLocale.ui.savePdfBlockedOpenViewer);
      }
      const pdf = await this.plugin.compileCoverPdf();
      this.clearPdfPreview();
      const dest = await this.plugin.saveAuxPdf(pdf, "-obb-cover");
      this.showPdfPreview(pdf);
      this.setStatus(`Couverture — ${dest}`);
      new Notice(`Couverture : ${dest}`);
    } catch (e) {
      const msg = (e as Error).message;
      this.setStatus(`Erreur : ${msg}`);
      new Notice(msg, 8000);
    } finally {
      this.setCompileBusy(false);
    }
  }

  async runImposition(): Promise<void> {
    this.setCompileBusy(true);
    this.setStatus("Imposition…", { busy: true });
    try {
      if (this.plugin.isPdfOpenInWorkspace(this.plugin.getAuxPdfDestPath("-obb-imposition"))) {
        throw new Error(frLocale.ui.savePdfBlockedOpenViewer);
      }
      const pdf = await this.plugin.compileImpositionPdf();
      this.clearPdfPreview();
      const dest = await this.plugin.saveAuxPdf(pdf, "-obb-imposition");
      this.showPdfPreview(pdf);
      this.setStatus(`Imposition — ${dest}`);
      new Notice(`Imposition : ${dest}`);
    } catch (e) {
      const msg = (e as Error).message;
      this.setStatus(`Erreur : ${msg}`);
      new Notice(msg, 8000);
    } finally {
      this.setCompileBusy(false);
    }
  }

  async onClose(): Promise<void> {
    this.previewResizeCleanup?.();
    this.previewResizeCleanup = null;
    this.setCompileBusy(false);
    if (this.plugin.bookPreviewView === this) this.plugin.bookPreviewView = null;
    if (this.previewBlobUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(this.previewBlobUrl);
      this.previewBlobUrl = null;
    }
  }
}

class ObbWasmSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ObbWasmBookPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    this.plugin.hydrateManifestFromDisk();
    new Setting(containerEl).setName("OBB WASM Book").setHeading();

    new Setting(containerEl)
      .setName("Typst compiler wasm")
      .setDesc("Chemin du fichier typst_ts_web_compiler_bg.wasm")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.typstWasmPath)
          .onChange(async (v) => {
            this.plugin.settings.typstWasmPath = v;
            this.plugin.invalidateWasmCaches();
            await this.plugin.saveSettings();
          }),
      )
      .addButton((b) =>
        b.setButtonText("Télécharger").onClick(async () => {
          try {
            await this.plugin.downloadWasm(this.plugin.settings.typstWasmPath, TYPST_COMPILER_WASM_DOWNLOAD_URL);
            this.plugin.invalidateWasmCaches();
            new Notice("Typst wasm téléchargé.");
          } catch (e) {
            new Notice((e as Error).message, 8000);
          }
        }),
      );

    new Setting(containerEl)
      .setName("Pandoc wasm")
      .setDesc("Chemin du fichier pandoc.wasm")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.pandocWasmPath)
          .onChange(async (v) => {
            this.plugin.settings.pandocWasmPath = v;
            this.plugin.pandocConvert = null;
            await this.plugin.saveSettings();
          }),
      )
      .addButton((b) =>
        b.setButtonText("Télécharger").onClick(async () => {
          try {
            await this.plugin.downloadWasm(this.plugin.settings.pandocWasmPath, PANDOC_WASM_DOWNLOAD_URL);
            this.plugin.pandocConvert = null;
            new Notice("Pandoc wasm téléchargé.");
          } catch (e) {
            new Notice((e as Error).message, 8000);
          }
        }),
      );

    new Setting(containerEl)
      .setName("Racine bundle gabarits")
      .setDesc("Dossier contenant typeset/ (défaut : sous le plugin).")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.templatesRoot)
          .setPlaceholder(this.plugin.getDefaultTemplatesRoot())
          .onChange(async (v) => {
            this.plugin.settings.templatesRoot = v;
            this.plugin.typstCompiler = null;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Journal diagnostic médias")
      .setDesc(
        "Écrit dans la console développeur (Ctrl+Shift+I → Console) : Pandoc, chemins d’images, HTTP, virtualisation Typst.",
      )
      .addToggle((tg) =>
        tg.setValue(this.plugin.settings.debugMedia).onChange(async (v) => {
          this.plugin.settings.debugMedia = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Gabarits Typst (dépôt officiel)")
      .setDesc("Télécharge les templates Typst depuis le dépôt officiel.")
      .addButton((b) =>
        b.setButtonText("Télécharger").onClick(async () => {
          try {
            await this.plugin.downloadTemplates();
            this.display();
          } catch (e) {
            new Notice((e as Error).message, 10000);
          }
        }),
      );

    const tpls = this.plugin.cachedManifest?.templates ?? [];
    if (tpls.length > 0) {
      new Setting(containerEl)
        .setName("Gabarit")
        .setDesc("Liste issue du manifest (champ « ID gabarit » est synchronisé).")
        .addDropdown((dd) => {
          for (const x of tpls) {
            dd.addOption(x.id, `${x.name} (${x.id})`);
          }
          const first = tpls[0]?.id ?? "";
          dd.setValue(this.plugin.settings.selectedTemplateId || first).onChange(async (v) => {
            this.plugin.settings.selectedTemplateId = v;
            await this.plugin.saveSettings();
            await this.plugin.refreshTemplateMeta();
          });
        });
    }
    new Setting(containerEl)
      .setName("ID gabarit (manuel)")
      .setDesc(tpls.length ? "Surcharge si besoin (sinon utiliser la liste ci-dessus)." : "Identifiant dans le manifest.")
      .addText((t) =>
        t.setValue(this.plugin.settings.selectedTemplateId).onChange(async (v) => {
          this.plugin.settings.selectedTemplateId = v;
          await this.plugin.saveSettings();
          await this.plugin.refreshTemplateMeta();
        }),
      );
  }
}

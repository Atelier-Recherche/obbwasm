import {
  buildImpositionMainTyp,
  chunkArray,
  compileTypstBookToPdf,
  createPandocConvertFromWasmBuffer,
  createTypstCompiler,
  defaultBookLayoutState,
  firstDiagnosticMessage,
  mountTypstPackagesFromLoader,
  overrideTypstLet,
  pandocMarkdownToTypst,
  parseImpositionTemplateSpec,
  reorderSpreadSequence,
  resetTypstWasmImporterRegistration,
  spineThicknessMm,
  type BookLayoutState,
} from "@obbwasm/core";
import type { TypstCompiler } from "@myriaddreamin/typst.ts";
import JSZip from "jszip";
import {
  ItemView,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  WorkspaceLeaf,
  normalizePath,
  requestUrl,
  type App,
  type FileSystemAdapter,
} from "obsidian";
import { createFsAssetLoader } from "./fsAssetLoader.js";
import { extractTypesetFromGithubRepoZip } from "./githubArchive.js";
import { listTypFiles } from "./listTypFiles.js";
import { nodeFs, nodePath } from "./platform.js";
import { countPdfPages } from "./pdfPageCount.js";
import type { TemplatesManifestV1 } from "./templatesManifest.js";
import { DEFAULT_TEMPLATES_MANIFEST_URL, GITHUB_REPO_ARCHIVE_MAIN } from "./urls.js";
import { PANDOC_WASM_DOWNLOAD_URL, TYPST_COMPILER_WASM_DOWNLOAD_URL } from "./wasmFetch.js";

export const VIEW_TYPE_OBB = "obbwasm-book-preview";

function validateWasmPath(fs: typeof import("node:fs"), absPath: string, label: string): void {
  const p = absPath?.trim();
  if (!p) throw new Error(`${label}: chemin vide.`);
  if (!fs.existsSync(p)) throw new Error(`${label}: fichier introuvable : ${p}`);
  const st = fs.statSync(p);
  if (!st.isFile()) throw new Error(`${label}: ce n'est pas un fichier : ${p}`);
  if (st.size === 0) throw new Error(`${label}: fichier vide (0 octet) : ${p}`);
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
};

export default class ObbWasmBookPlugin extends Plugin {
  settings: ObbWasmPluginSettings = { ...DEFAULT_SETTINGS };
  typstCompiler: TypstCompiler | null = null;
  pandocConvert: Awaited<ReturnType<typeof createPandocConvertFromWasmBuffer>> | null = null;
  cachedManifest: TemplatesManifestV1 | null = null;
  /** Dernier PDF intérieur produit par « Compiler la note » — utilisé pour l’imposition. */
  lastInteriorPdf: Uint8Array | null = null;

  async onload(): Promise<void> {
    await this.loadSettings();
    await this.loadLocalManifest();
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
    const path = nodePath();
    return path.join(this.pluginDir(), "bundle");
  }

  resolveTemplatesRoot(): string {
    return this.settings.templatesRoot.trim() || this.getDefaultTemplatesRoot();
  }

  async loadSettings(): Promise<void> {
    const data = (await this.loadData()) as Partial<ObbWasmPluginSettings> | undefined;
    this.settings = { ...DEFAULT_SETTINGS, ...data };
    if (!this.settings.bookLayoutJson) {
      this.settings.bookLayoutJson = JSON.stringify(defaultBookLayoutState());
    }
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
    const g = Number(this.settings.grammage);
    this.settings.grammage = [80, 100, 120].includes(g) ? g : 80;
    const ip = Number(this.settings.innerPages);
    this.settings.innerPages = Number.isFinite(ip) && ip >= 0 ? Math.round(ip) : 200;
    const th = Number(this.settings.impositionPaperThicknessMm);
    this.settings.impositionPaperThicknessMm =
      Number.isFinite(th) && th > 0 ? Number(th.toFixed(4)) : 0.1;
    await this.ensureCoverImpositionDefaults();
  }

  /** Si le bundle contient des .typ couverture / imposition, préremplit les sélections vides. */
  async ensureCoverImpositionDefaults(): Promise<void> {
    const fs = nodeFs();
    const path = nodePath();
    const root = this.settings.templatesRoot.trim() || this.getDefaultTemplatesRoot();
    if (!fs.existsSync(path.join(root, "typeset"))) return;
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

  /** Met à jour cachedManifest depuis le fichier cache (sync), utile à l’ouverture des réglages. */
  hydrateManifestFromDisk(): void {
    const fs = nodeFs();
    const path = nodePath();
    const cached = path.join(this.pluginDir(), "templates-manifest.cached.json");
    if (!fs.existsSync(cached)) return;
    try {
      const raw = fs.readFileSync(cached, "utf8");
      const json = JSON.parse(raw) as TemplatesManifestV1;
      if (json.version === 1 && Array.isArray(json.templates)) {
        this.cachedManifest = json;
      }
    } catch {
      /* ignore */
    }
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
    });
    this.typstCompiler = compiler;
    return compiler;
  }

  parseBookLayout(): BookLayoutState {
    try {
      const j = JSON.parse(this.settings.bookLayoutJson || "{}") as BookLayoutState;
      return j?.values ? j : defaultBookLayoutState();
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
      this.cachedManifest = json;
      const fs = nodeFs();
      const path = nodePath();
      fs.writeFileSync(path.join(this.pluginDir(), "templates-manifest.cached.json"), res.text, "utf8");
      return json;
    } catch {
      return null;
    }
  }

  async loadLocalManifest(): Promise<TemplatesManifestV1 | null> {
    const fs = nodeFs();
    const path = nodePath();
    const cached = path.join(this.pluginDir(), "templates-manifest.cached.json");
    if (!fs.existsSync(cached)) return this.cachedManifest;
    try {
      const raw = fs.readFileSync(cached, "utf8");
      const json = JSON.parse(raw) as TemplatesManifestV1;
      if (json.version === 1 && Array.isArray(json.templates)) {
        this.cachedManifest = json;
        return json;
      }
    } catch {
      /* ignore */
    }
    return this.cachedManifest;
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
    const fs = nodeFs();
    const path = nodePath();
    let zipUrl = GITHUB_REPO_ARCHIVE_MAIN;

    const manRes = await requestUrl({
      url: DEFAULT_TEMPLATES_MANIFEST_URL,
      method: "GET",
      throw: false,
    });
    if (manRes.status === 200 && manRes.text) {
      try {
        const json = JSON.parse(manRes.text) as TemplatesManifestV1;
        if (json.version === 1 && Array.isArray(json.templates)) {
          this.cachedManifest = json;
          fs.writeFileSync(
            path.join(this.pluginDir(), "templates-manifest.cached.json"),
            manRes.text,
            "utf8",
          );
          if (json.bundleZipUrl?.trim()) zipUrl = json.bundleZipUrl.trim();
        }
      } catch {
        /* manifest invalide → ZIP par défaut */
      }
    }

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
        "Aucun dossier typeset/ reconnu dans le ZIP — vérifiez l’URL ou le dépôt.",
      );
    }
    this.typstCompiler = null;
    await this.ensureCoverImpositionDefaults();
    new Notice(`Gabarits installés (${n} fichiers).`);
  }

  async compileActiveNoteToPdf(): Promise<{ pdf: Uint8Array; fileBase: string; folder: string }> {
    const file = this.app.workspace.getActiveFile();
    if (!file) throw new Error("Aucun fichier actif.");
    const text = await this.app.vault.read(file);
    const convert = await this.ensurePandocConvert();
    const { typst } = await pandocMarkdownToTypst({
      convert,
      sourceFormat: "md",
      sourceText: text,
      titleFallback: this.settings.title || file.basename,
    });

    const manifest = (await this.loadLocalManifest()) ?? (await this.fetchManifestFromRepo());
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
    const bookLayout = this.parseBookLayout();
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
    });
    if (!out.pdf) {
      const msg = JSON.stringify(out.diagnostics ?? []);
      throw new Error(`Compilation sans PDF. ${msg.slice(0, 400)}`);
    }
    const pdfCopy = new Uint8Array(out.pdf);
    this.lastInteriorPdf = pdfCopy;
    try {
      const pc = await countPdfPages(new Uint8Array(out.pdf));
      if (pc > 0) {
        this.settings.innerPages = pc;
        await this.saveSettings();
      }
    } catch {
      /* ignore */
    }
    return {
      pdf: out.pdf,
      fileBase: file.basename.replace(/\.md$/i, ""),
      folder: file.parent?.path ?? "",
    };
  }

  async compileCoverPdf(): Promise<Uint8Array> {
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

  /** Enregistre un PDF auxiliaire à côté de la note active (suffixe avant `.pdf`). */
  async saveAuxPdf(pdf: Uint8Array, suffix: string): Promise<string> {
    const file = this.app.workspace.getActiveFile();
    const base = file?.basename.replace(/\.md$/i, "") ?? "export";
    const folder = file?.parent?.path ?? "";
    const dest = normalizePath(folder ? `${folder}/${base}${suffix}.pdf` : `${base}${suffix}.pdf`);
    const outBin = new Uint8Array(pdf.byteLength);
    outBin.set(pdf);
    await this.app.vault.adapter.writeBinary(dest, outBin.buffer);
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
  private spineHintEl!: HTMLSpanElement;
  private innerPagesInput!: HTMLInputElement;

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

  private showPdfPreview(data: Uint8Array): void {
    const blob = new Blob([new Uint8Array(data)], { type: "application/pdf" });
    const prev = this.frame.src;
    if (prev.startsWith("blob:")) URL.revokeObjectURL(prev);
    this.frame.src = URL.createObjectURL(blob);
  }

  async onOpen(): Promise<void> {
    await this.plugin.loadLocalManifest();
    const container = this.contentEl;
    container.empty();
    container.addClass("obbwasm-view");
    const scroll = container.createDiv({ cls: "obbwasm-view-scroll" });

    scroll.createEl("h3", { cls: "obbwasm-section-title", text: "Métadonnées" });
    const meta = scroll.createDiv({ cls: "obbwasm-section" });
    const t = this.labeledText(meta, "Titre");
    this.bindMeta(t, "title");
    const a = this.labeledText(meta, "Auteur");
    this.bindMeta(a, "author");
    const p = this.labeledText(meta, "Éditeur / édition");
    this.bindMeta(p, "publisher");

    scroll.createEl("h3", { cls: "obbwasm-section-title", text: "Mise en page livre" });
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
    });

    layoutSec.createEl("p", {
      cls: "obbwasm-help-text",
      text: "Options fines (titres de chapitres, langue, etc.) : JSON identique au studio web.",
    });
    const taRow = layoutSec.createDiv({ cls: "obbwasm-field-row obbwasm-field-row-stack" });
    taRow.createSpan({ cls: "obbwasm-field-label", text: "Options livre (JSON)" });
    const ta = taRow.createEl("textarea", { cls: "obbwasm-json-area" });
    ta.rows = 6;
    ta.value = this.plugin.settings.bookLayoutJson;
    ta.addEventListener("change", async () => {
      this.plugin.settings.bookLayoutJson = ta.value;
      await this.plugin.saveSettings();
    });

    scroll.createEl("h3", { cls: "obbwasm-section-title", text: "Intérieur" });
    const intSec = scroll.createDiv({ cls: "obbwasm-section obbwasm-actions-row" });
    intSec.createEl("button", { text: "Compiler la note active → PDF" }, (b) => {
      b.addClass("mod-cta");
      b.addEventListener("click", () => void this.runCompile());
    });

    scroll.createEl("h3", { cls: "obbwasm-section-title", text: "Couverture" });
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

    scroll.createEl("h3", { cls: "obbwasm-section-title", text: "Imposition" });
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

    const status = container.createDiv({ cls: "obbwasm-view-status", text: "Prêt." });
    const frameHolder = container.createDiv({ cls: "obbwasm-view-body" });
    const iframe = frameHolder.createEl("iframe", {
      cls: "obbwasm-preview-frame",
      attr: { title: "Aperçu PDF" },
    });
    this.frame = iframe;
    this.statusEl = status;
  }

  private labeledText(container: HTMLElement, label: string): HTMLInputElement {
    const row = container.createDiv({ cls: "obbwasm-field-row" });
    row.createSpan({ cls: "obbwasm-field-label", text: label });
    return row.createEl("input", { type: "text", cls: "obbwasm-field-input" });
  }

  setStatus(msg: string): void {
    this.statusEl.setText(msg);
  }

  async runCompile(): Promise<void> {
    this.setStatus("Compilation…");
    try {
      const { pdf, fileBase } = await this.plugin.compileActiveNoteToPdf();
      this.showPdfPreview(pdf);
      this.setStatus(`OK — ${fileBase}.pdf (${pdf.byteLength} octets)`);
      const dest = await this.plugin.saveAuxPdf(pdf, "-obb");
      new Notice(`PDF enregistré : ${dest}`);
      this.innerPagesInput.value = String(this.plugin.settings.innerPages);
      this.updateSpineHint();
    } catch (e) {
      const msg = (e as Error).message;
      this.setStatus(`Erreur : ${msg}`);
      new Notice(msg, 8000);
    }
  }

  async runCover(): Promise<void> {
    this.setStatus("Couverture…");
    try {
      const pdf = await this.plugin.compileCoverPdf();
      this.showPdfPreview(pdf);
      const dest = await this.plugin.saveAuxPdf(pdf, "-obb-cover");
      this.setStatus(`Couverture — ${dest}`);
      new Notice(`Couverture : ${dest}`);
    } catch (e) {
      const msg = (e as Error).message;
      this.setStatus(`Erreur : ${msg}`);
      new Notice(msg, 8000);
    }
  }

  async runImposition(): Promise<void> {
    this.setStatus("Imposition…");
    try {
      const pdf = await this.plugin.compileImpositionPdf();
      this.showPdfPreview(pdf);
      const dest = await this.plugin.saveAuxPdf(pdf, "-obb-imposition");
      this.setStatus(`Imposition — ${dest}`);
      new Notice(`Imposition : ${dest}`);
    } catch (e) {
      const msg = (e as Error).message;
      this.setStatus(`Erreur : ${msg}`);
      new Notice(msg, 8000);
    }
  }

  async onClose(): Promise<void> {
    if (this.frame?.src.startsWith("blob:")) URL.revokeObjectURL(this.frame.src);
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
    containerEl.createEl("h2", { text: "OBB WASM Book" });

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
      .setName("Gabarits Typst (dépôt officiel)")
      .setDesc("Télécharge le manifest, puis l’archive et extrait typeset/ (pas de fetch : compatible Obsidian).")
      .addButton((b) =>
        b.setButtonText("Télécharger les gabarits").onClick(async () => {
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
        }),
      );
  }
}

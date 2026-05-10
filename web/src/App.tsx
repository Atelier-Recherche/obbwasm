import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import {
  BookOpen,
  BookMarked,
  LayoutGrid,
  FileText,
  Moon,
  Sun,
  Download,
  Upload,
  Package,
  Bug,
  Loader2,
  LogIn,
  LogOut,
  Shield,
  Send,
  Save,
  ArrowBigRight,
  Printer,
} from "lucide-react";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TypstCompiler } from "@myriaddreamin/typst.ts";
import typstCompilerWasmUrl from "@myriaddreamin/typst-ts-web-compiler/wasm?url";
import { setImportWasmModule } from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler.mjs";
import { ProgressOverlay } from "./ProgressOverlay";
import { PdfPageViewer } from "./PdfPageViewer";
import { WasmIcon } from "./WasmIcon";
import { TemplatePicker } from "./TemplatePicker";
import {
  parseTemplateMeta,
  displayTitle,
  filterOptionIdsByTemplate,
  type TemplateMeta,
} from "./parseTemplateMeta";
import { BOOK_OPTIONS } from "./bookOptions/registry";
import { defaultBookLayoutState } from "./bookOptions/defaults";
import { reconcileSectionOrder } from "./bookOptions/sectionVisibility";
import { buildTypstOptsLines } from "./bookOptions/typstSerialize";
import { resolveDocStrings } from "./bookOptions/docStrings";
import { useI18n } from "./i18n/context";
import { BookOptionsForm } from "./components/BookOptionsForm";
import { SectionOrderList } from "./components/SectionOrderList";
import { LanguageSelector } from "./components/LanguageSelector";
import { fetchCachedArrayBuffer } from "./wasmCache";
import { defaultMdPresets, loadMdPresets, saveMdPresets } from "./pandocMdPresets";

GlobalWorkerOptions.workerSrc = workerSrc;

type Template = {
  id: string;
  name: string;
  mainTypPath: string;
  variables: Record<string, string>;
};

type TabId = "contenu" | "couverture" | "imposition" | "pdf";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8088/api";

/** A false : imposition « automatique » (serveur) masquee — remettre true pour reactiver le dev. */
const IMPOSITION_AUTO_ENABLED = false;

function apiFetch(input: string | URL, init?: RequestInit): Promise<Response> {
  return fetch(input, { ...init, credentials: "include" });
}

type AuthUser = { email: string; isAdmin: boolean };

const paperThicknessByWeight: Record<number, number> = {
  80: 0.1,
  100: 0.12,
  120: 0.14,
};

function extractMarkdownImages(input: string): string[] {
  const re = /!\[[^\]]*]\(([^)]+)\)/g;
  const out: string[] = [];
  let m: RegExpExecArray | null = re.exec(input);
  while (m !== null) {
    out.push(m[1]);
    m = re.exec(input);
  }
  return out;
}

function applyMicroTypography(text: string): string {
  return text
    .replace(/(\d+)\s+(%|kg|g|cm|mm|m|km|€)/g, "$1\u00A0$2")
    .replace(/\s+([;:!?])/g, "\u00A0$1");
}

function findInvisibleChars(text: string): string[] {
  const issues: string[] = [];
  const zeroWidth = /[\u200B-\u200D\uFEFF]/g;
  if (zeroWidth.test(text)) {
    issues.push("Caracteres invisibles detectes (zero-width / BOM).");
  }
  const ctrl = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;
  if (ctrl.test(text)) {
    issues.push("Caracteres de controle non imprimes detectes.");
  }
  return issues;
}

function parseMm(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const m = value.match(/([\d.]+)\s*mm/i);
  if (!m) return fallback;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : fallback;
}

function overrideTypstLet(source: string, key: string, valueExpr: string): string {
  const rx = new RegExp(`#let\\s+${key}\\s*=\\s*.*`, "g");
  if (rx.test(source)) {
    return source.replace(rx, `#let ${key} = ${valueExpr}`);
  }
  return `#let ${key} = ${valueExpr}\n${source}`;
}

function firstDiagnosticMessage(compiled: unknown): string {
  const list = (compiled as { diagnostics?: Array<{ message?: string }> } | null)?.diagnostics ?? [];
  if (!Array.isArray(list) || list.length === 0) return "";
  const msg = list[0]?.message;
  return typeof msg === "string" ? msg : "";
}

type ImpositionTemplateSpec = {
  packetSize: number;
  kind: "signature" | "spread";
};

function parseImpositionTemplateSpec(path: string): ImpositionTemplateSpec | null {
  const m = path.match(/(\d+)(signature|spread)\.typ$/i);
  if (!m) return null;
  const packetSize = Number(m[1]);
  const kind = m[2].toLowerCase() as "signature" | "spread";
  if (!Number.isFinite(packetSize) || packetSize <= 0) return null;
  return { packetSize, kind };
}

function reorderSpreadSequence(pages: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = pages.length - 1;
  while (i <= j) {
    out.push(pages[i]);
    if (i !== j) out.push(pages[j]);
    i += 1;
    j -= 1;
  }
  return out;
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function buildImpositionMainTyp(
  kind: "signature" | "spread",
  packetSize: number,
  packets: number[][],
  compensationMm: number,
): string {
  if (packetSize % 4 !== 0 || packetSize <= 0) {
    throw new Error(`Template ${packetSize}${kind} non supporte (taille de paquet multiple de 4 requise).`);
  }
  const lines: string[] = [
    `#let source-pdf = "export.pdf"`,
    `#let compensation = ${compensationMm}mm`,
    `#set page(width: 297mm, height: 210mm, margin: 0mm)`,
    `#let render-page(page-num, width: 143.5mm) = {`,
    `  if page-num <= 0 {`,
    `    box(width: width, height: 210mm)[]`,
    `  } else {`,
    `    image(source-pdf, page: page-num, width: width)`,
    `  }`,
    `}`,
    `#let pair(left-page, right-page) = [`,
    `  #place(left + top, render-page(left-page))`,
    `  #place(left + top, dx: 143.5mm + compensation, dy: 0mm, render-page(right-page))`,
    `]`,
    `#let side(left-page, right-page, left-align: true) = {`,
    `  if left-align [`,
    `    #place(left + top, render-page(left-page, width: 148mm))`,
    `    #place(left + top, dx: 148mm, dy: 0mm, render-page(right-page, width: 148mm))`,
    `  ] else [`,
    `    #place(right + top, dx: -296mm, dy: 0mm, render-page(left-page, width: 148mm))`,
    `    #place(right + top, dx: -148mm, dy: 0mm, render-page(right-page, width: 148mm))`,
    `  ]`,
    `}`,
  ];

  const pageAt = (arr: number[], idx: number): number => arr[idx] ?? 0;

  packets.forEach((pack, idx) => {
    if (kind === "spread") {
      // Mode spread: pour chaque bloc de 4 pages du paquet, ordre template:
      // (2,1) puis (3,4), repete.
      for (let base = 0; base < packetSize; base += 4) {
        const p1 = pageAt(pack, base + 0);
        const p2 = pageAt(pack, base + 1);
        const p3 = pageAt(pack, base + 2);
        const p4 = pageAt(pack, base + 3);
        lines.push(`#pair(${p2}, ${p1})`);
        lines.push(`#pagebreak()`);
        lines.push(`#pair(${p3}, ${p4})`);
        if (base + 4 < packetSize) lines.push(`#pagebreak()`);
      }
    } else {
      // Mode signature: imposition "booklet" sur le paquet entier.
      // Feuille i: face A = (fin, debut), face B = (debut+1, fin-1)
      // puis progression vers le centre.
      const sheets = packetSize / 4;
      for (let s = 0; s < sheets; s += 1) {
        const frontLeft = pageAt(pack, packetSize - 1 - 2 * s);
        const frontRight = pageAt(pack, 2 * s);
        const backLeft = pageAt(pack, 2 * s + 1);
        const backRight = pageAt(pack, packetSize - 2 - 2 * s);
        lines.push(`#side(${frontLeft}, ${frontRight}, left-align: true)`);
        lines.push(`#pagebreak()`);
        lines.push(`#side(${backLeft}, ${backRight}, left-align: false)`);
        if (s + 1 < sheets) lines.push(`#pagebreak()`);
      }
    }
    if (idx !== packets.length - 1) lines.push(`#pagebreak()`);
  });
  return lines.join("\n");
}

async function loadPdfPageCount(file: File): Promise<number> {
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  return pdf.numPages;
}

async function renderPdfFirstPageToDataUrl(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const pdf = await getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.5 });
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/png");
}

export default function App() {
  const typstWasmImporterReady = useRef(false);
  const compilerRef = useRef<TypstCompiler | null>(null);
  const [wasmReady, setWasmReady] = useState(false);
  const [tab, setTab] = useState<TabId>("contenu");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [selectedCoverTemplatePath, setSelectedCoverTemplatePath] = useState("typeset/typst/cover/Garamond-brsnoba5-cover-A3.typ");
  const [selectedImpositionTemplatePath, setSelectedImpositionTemplatePath] = useState("typeset/typst/impose/brsnoba5-A4-4spread.typ");
  const [sourceText, setSourceText] = useState("");
  const [sourceFileBlob, setSourceFileBlob] = useState<File | null>(null);
  const [sourceFileName, setSourceFileName] = useState("");
  const [sourceFormat, setSourceFormat] = useState("md");
  const [bookLayout, setBookLayout] = useState(defaultBookLayoutState);
  const [title, setTitle] = useState("Titre");
  const [author, setAuthor] = useState("Auteur");
  const [publisher, setPublisher] = useState("Edition");
  const [grammage, setGrammage] = useState(80);
  const [innerPages, setInnerPages] = useState(0);
  const [impositionPaperThicknessMm, setImpositionPaperThicknessMm] = useState(0.1);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [generatedPdfName, setGeneratedPdfName] = useState("");
  const [coverPreviewUrl, setCoverPreviewUrl] = useState("");
  const [coverPdfName, setCoverPdfName] = useState("");
  const [coverPdfFile, setCoverPdfFile] = useState<File | null>(null);
  const [impositionPreviewUrl, setImpositionPreviewUrl] = useState("");
  const [impositionPdfName, setImpositionPdfName] = useState("");
  const [status, setStatus] = useState("Pret.");
  const [generatedTypst, setGeneratedTypst] = useState("");
  const [renderLog, setRenderLog] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [previewImgDataUrl, setPreviewImgDataUrl] = useState("");
  const [bibFile, setBibFile] = useState<File | null>(null);
  const [colorTheme, setColorTheme] = useState<"light" | "dark">("light");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginMessage, setLoginMessage] = useState("");
  const [forkName, setForkName] = useState("");
  const [submissionName, setSubmissionName] = useState("");
  const [adminSubmissions, setAdminSubmissions] = useState<Array<Record<string, unknown>>>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateMetaById, setTemplateMetaById] = useState<Record<string, TemplateMeta>>({});
  const [templatePreviewId, setTemplatePreviewId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ phase: string; ratio?: number } | null>(null);
  const [templateEditorSource, setTemplateEditorSource] = useState("");
  const [templateEditorLoading, setTemplateEditorLoading] = useState(false);
  const [showMdPresetEditor, setShowMdPresetEditor] = useState(false);
  const [mdPresetJson, setMdPresetJson] = useState("");
  const [typstPkgUploadName, setTypstPkgUploadName] = useState("");

  const { t } = useI18n();

  const patchBookValues = useCallback((patch: Partial<Record<string, boolean | string>>) => {
    setBookLayout((prev) => {
      const nextValues: Record<string, boolean | string> = { ...prev.values };
      for (const [k, v] of Object.entries(patch)) {
        if (v !== undefined) nextValues[k] = v;
      }
      const sectionOrder = reconcileSectionOrder(prev.sectionOrder, nextValues);
      return { ...prev, values: nextValues, sectionOrder };
    });
  }, []);

  const visibleOptionIds = useMemo(() => {
    const supported = templateMetaById[selectedTemplate]?.supportedOptions ?? [];
    const all = BOOK_OPTIONS.map((o) => o.id);
    return filterOptionIdsByTemplate(all, supported);
  }, [selectedTemplate, templateMetaById]);

  const imageRefs = useMemo(() => extractMarkdownImages(sourceText), [sourceText]);
  const lintIssues = useMemo(() => findInvisibleChars(sourceText), [sourceText]);
  const selectedTemplateObj = useMemo(
    () => templates.find((t) => t.id === selectedTemplate),
    [templates, selectedTemplate],
  );

  const templateListSig = useMemo(() => templates.map((t) => `${t.id}:${t.mainTypPath}`).join("|"), [templates]);

  const coverTemplateChoices = useMemo(() => {
    const layoutPath = selectedTemplateObj?.mainTypPath ?? "";
    if (layoutPath.includes("Garamond-brsnoba5-layout.typ")) {
      return [{ id: "typeset/typst/cover/Garamond-brsnoba5-cover-A3.typ", name: "Garamond brsnoba5 - Cover A3" }];
    }
    return [{ id: "typeset/typst/cover/Garamond-brsnoba5-cover-A3.typ", name: "Garamond brsnoba5 - Cover A3" }];
  }, [selectedTemplateObj?.mainTypPath]);

  const impositionTemplateChoices = useMemo(() => {
    return [
      { id: "typeset/typst/impose/brsnoba5-A4-4spread.typ", name: "brsnoba5 A4 - 4spread" },
      { id: "typeset/typst/impose/brsnoba5-A4-4signature.typ", name: "brsnoba5 A4 - 4signature" },
    ];
  }, []);

  useEffect(() => {
    if (!coverTemplateChoices.some((x) => x.id === selectedCoverTemplatePath)) {
      setSelectedCoverTemplatePath(coverTemplateChoices[0]?.id ?? "");
    }
  }, [coverTemplateChoices, selectedCoverTemplatePath]);

  useEffect(() => {
    if (!impositionTemplateChoices.some((x) => x.id === selectedImpositionTemplatePath)) {
      setSelectedImpositionTemplatePath(impositionTemplateChoices[0]?.id ?? "");
    }
  }, [impositionTemplateChoices, selectedImpositionTemplatePath]);

  useEffect(() => {
    const saved = localStorage.getItem("obbwasm-theme");
    if (saved === "dark" || saved === "light") {
      setColorTheme(saved);
      document.documentElement.dataset.theme = saved;
      return;
    }
    const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? false;
    const initial = prefersDark ? "dark" : "light";
    setColorTheme(initial);
    document.documentElement.dataset.theme = initial;
  }, []);

  function toggleColorTheme() {
    const next = colorTheme === "dark" ? "light" : "dark";
    setColorTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem("obbwasm-theme", next);
  }

  const templatePageW = parseMm(selectedTemplateObj?.variables?.["page-width"], 143.5);
  const templatePageH = parseMm(selectedTemplateObj?.variables?.["page-height"], 210);
  const bookFormat = `${templatePageW}x${templatePageH}`;

  const paperThickness = paperThicknessByWeight[grammage] ?? 0.1;
  const spineThickness = useMemo(
    () => Number(((innerPages / 2) * paperThickness).toFixed(2)),
    [innerPages, paperThickness],
  );

  useEffect(() => {
    setImpositionPaperThicknessMm(paperThickness);
  }, [paperThickness]);

  useEffect(() => {
    if (templates.length === 0) return;
    let cancelled = false;
    void (async () => {
      const entries = await Promise.all(
        templates.map(async (t) => {
          try {
            const res = await apiFetch(`${apiBase}/template-source.php?path=${encodeURIComponent(t.mainTypPath)}`);
            const data = await res.json();
            if (!data.ok || typeof data.source !== "string") return [t.id, null] as const;
            return [t.id, parseTemplateMeta(data.source)] as const;
          } catch {
            return [t.id, null] as const;
          }
        }),
      );
      if (cancelled) return;
      setTemplateMetaById((prev) => {
        const next = { ...prev };
        for (const [id, meta] of entries) {
          if (meta) next[id] = meta;
        }
        return next;
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [templateListSig]);

  function pushLog(message: string) {
    const ts = new Date().toISOString();
    setLogs((prev) => [`[${ts}] ${message}`, ...prev].slice(0, 200));
  }

  async function fetchTemplates() {
    setTemplatesLoading(true);
    try {
      const res = await apiFetch(`${apiBase}/templates.php`);
      const data = await res.json();
      if (data.ok) {
        setTemplates(data.items);
        setSelectedTemplate((prev) => prev || (data.items[0]?.id ?? ""));
      }
    } finally {
      setTemplatesLoading(false);
    }
  }

  async function ensureTemplatesLoaded() {
    if (templates.length > 0) return;
    await fetchTemplates();
  }

  async function mountTypstPackages(compiler: TypstCompiler) {
    let listRes: Response;
    try {
      listRes = await apiFetch(`${apiBase}/typst-packages.php`);
    } catch {
      return;
    }
    const listData = await listRes.json().catch(() => ({}));
    if (!listData.ok || !Array.isArray(listData.items) || listData.items.length === 0) return;
    for (const pkg of listData.items as { id: string }[]) {
      const zres = await apiFetch(`${apiBase}/typst-packages.php?action=archive&id=${encodeURIComponent(pkg.id)}`);
      if (!zres.ok) continue;
      const buf = await zres.arrayBuffer();
      const zip = await JSZip.loadAsync(buf);
      for (const path of Object.keys(zip.files)) {
        const entry = zip.files[path];
        if (!entry || entry.dir) continue;
        const u8 = await entry.async("uint8array");
        const vfs = path.startsWith("/") ? path : `/${path}`;
        compiler.mapShadow(vfs, u8);
      }
    }
  }

  async function uploadSource(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await apiFetch(`${apiBase}/upload.php`, { method: "POST", body: form });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error ?? "Upload source impossible");
    return data.item;
  }

  async function handleSourceFile(file: File) {
    setSourceFileName(file.name);
    setSourceFileBlob(file);
    setStatus("Upload source...");
    pushLog(`Upload source: ${file.name} (${file.type || "type-inconnu"}, ${file.size} bytes)`);
    await uploadSource(file);
    if (["md", "html", "txt", "latex", "rtf"].includes(sourceFormat)) {
      const text = await file.text();
      setSourceText(applyMicroTypography(text));
      setStatus("Source texte chargee + micro-typographie appliquee.");
      pushLog(`Source texte chargee (${text.length} chars).`);
    } else {
      setSourceText("");
      setStatus("Source binaire chargee. Conversion via Pandoc WASM utilisera le fichier brut.");
      pushLog("Source binaire detectee: pas de pre-lecture texte.");
    }
  }

  async function handlePdfFile(file: File) {
    setPdfFile(file);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setGeneratedPdfName(file.name);
    const count = await loadPdfPageCount(file);
    setInnerPages(count);
    const imgData = await renderPdfFirstPageToDataUrl(file);
    setPreviewImgDataUrl(imgData);
    pushLog(`PDF pret: ${file.name}, ${file.size} bytes, ${count} pages.`);
  }

  function setPreviewFromBytes(bytes: Uint8Array, target: "content" | "cover" | "imposition", fileName: string) {
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    if (target === "content") {
      setPreviewUrl(url);
      setGeneratedPdfName(fileName);
    } else if (target === "cover") {
      setCoverPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      setCoverPdfName(fileName);
      setCoverPdfFile(new File([blob], fileName, { type: "application/pdf" }));
    } else {
      setImpositionPreviewUrl(url);
      setImpositionPdfName(fileName);
    }
  }

  function downloadGeneratedPdf() {
    if (!pdfFile || !previewUrl) {
      setStatus("Aucun PDF genere a telecharger.");
      return;
    }
    const a = document.createElement("a");
    a.href = previewUrl;
    a.download = generatedPdfName || "typst-wasm-output.pdf";
    a.click();
  }

  async function saveProject() {
    const payload = {
      name: sourceFileName ? `Projet ${sourceFileName}` : "Nouveau projet",
      templateId: selectedTemplate,
      settings: {
        moduleA: {
          sourceFormat,
          bookLayout,
          bookFormat,
          templateVars: selectedTemplateObj?.variables ?? {},
          bibliography: true,
        },
        moduleB: {
          title,
          author,
          publisher,
          grammage,
          innerPages,
          spineThicknessMm: spineThickness,
        },
        moduleC: {
          impositionStrategy: "template" as const,
          selectedImpositionTemplatePath,
          impositionPaperThicknessMm,
        },
      },
    };
    const res = await apiFetch(`${apiBase}/projects.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    setStatus(data.ok ? `Projet enregistre: ${data.item.id}` : `Erreur: ${data.error}`);
    pushLog(data.ok ? `Projet enregistre: ${data.item.id}` : `Erreur save project: ${data.error}`);
  }

  async function ensureWasmCompiler(): Promise<TypstCompiler> {
    if (compilerRef.current) return compilerRef.current;
    setProgress({ phase: "Chargement moteur Typst WASM…" });
    try {
      if (!typstWasmImporterReady.current) {
        setImportWasmModule(async () => {
          return await fetchCachedArrayBuffer(typstCompilerWasmUrl);
        });
        typstWasmImporterReady.current = true;
      }
      const typst = await import("@myriaddreamin/typst.ts");
      const compiler = typst.createTypstCompiler();
      const fontsRes = await apiFetch(`${apiBase}/font-assets.php?action=list`);
      const fontsData = await fontsRes.json();
      const fontItems: Array<{ path: string; name: string; size: number }> = fontsData?.ok ? fontsData.items ?? [] : [];
      const fontBuffers: Uint8Array[] = [];
      const n = Math.max(fontItems.length, 1);
      for (let i = 0; i < fontItems.length; i++) {
        const item = fontItems[i];
        setProgress({ phase: `Polices ${i + 1} / ${fontItems.length}`, ratio: (i + 1) / n });
        try {
          const res = await apiFetch(`${apiBase}/font-assets.php?action=file&path=${encodeURIComponent(item.path)}`);
          if (!res.ok) {
            pushLog(`Font skip (${item.name}): HTTP ${res.status}`);
            continue;
          }
          const buf = await res.arrayBuffer();
          fontBuffers.push(new Uint8Array(buf));
        } catch (e) {
          pushLog(`Font load error (${item.name}): ${(e as Error).message}`);
        }
      }
      setProgress({ phase: "Initialisation compilateur…", ratio: undefined });
      await compiler.init({
        beforeBuild: [typst.loadFonts(fontBuffers)],
      });
      compilerRef.current = compiler;
      setWasmReady(true);
      pushLog(`Typst compiler init OK (fonts chargees: ${fontBuffers.length}/${fontItems.length}).`);
      return compiler;
    } finally {
      setProgress(null);
    }
  }

  async function convertWithPandocWasm() {
    if (!sourceText.trim() && !sourceFileBlob) {
      setStatus("Aucune source chargee.");
      return;
    }
    setProgress({ phase: "Conversion Pandoc → Typst…" });
    setStatus("Conversion Pandoc WASM -> Typst...");
    try {
      const pandoc = await import("pandoc-wasm");
      const options: Record<string, unknown> = {
        from: sourceFormat === "md" ? "markdown" : sourceFormat,
        to: "typst",
        standalone: false,
      };
      const files: Record<string, string | Blob> = {};
      let stdin: string | null = sourceText;
      if (!stdin && sourceFileBlob) {
        const ext = sourceFileName.split(".").pop() || sourceFormat;
        const inputName = `input.${ext}`;
        files[inputName] = sourceFileBlob;
        options["input-files"] = [inputName];
        stdin = null;
      }
      if (bibFile) {
        options.citeproc = true;
        options.bibliography = bibFile.name;
        files[bibFile.name] = bibFile;
      }
      const result = await pandoc.convert(options, stdin, files);
      const out = result.stdout || "";
      if (!out.trim() && sourceText.trim()) {
        // Fallback explicite pour eviter un PDF vide.
        const fallback = `= ${title}\n\n${sourceText}`;
        setGeneratedTypst(fallback);
        pushLog("Pandoc stdout vide, fallback Typst applique depuis source texte.");
      } else {
        setGeneratedTypst(out);
      }
      setRenderLog(result.stderr || "");
      pushLog(`Pandoc preview: ${out.slice(0, 220).replace(/\s+/g, " ")}`);
      pushLog(`Pandoc done: stdout=${out.length} chars, stderr=${(result.stderr || "").length} chars.`);
      setStatus("Typst genere via Pandoc WASM.");
    } catch (err) {
      setStatus(`Erreur Pandoc WASM: ${(err as Error).message}`);
      pushLog(`Erreur Pandoc WASM: ${(err as Error).message}`);
    } finally {
      setProgress(null);
    }
  }

  async function convertNormalizeToMd() {
    if (!sourceText.trim() && !sourceFileBlob) {
      setStatus("Aucune source chargee pour normaliser.");
      return;
    }
    const presets = loadMdPresets();
    const baseKey = sourceFormat in presets ? sourceFormat : "md";
    const opts = { ...(presets[baseKey] ?? defaultMdPresets[sourceFormat] ?? defaultMdPresets.md) };
    setProgress({ phase: "Normalisation → Markdown…" });
    setStatus("Normalisation Pandoc WASM → Markdown...");
    try {
      const pandoc = await import("pandoc-wasm");
      const options: Record<string, unknown> = {
        ...opts,
        to: "markdown",
      };
      if (!options.from && sourceFormat !== "md") {
        options.from = sourceFormat === "txt" ? "plain" : sourceFormat;
      }
      if (sourceFormat === "md") {
        options.from = "markdown";
      }
      const files: Record<string, string | Blob> = {};
      let stdin: string | null = sourceText;
      if (!stdin && sourceFileBlob) {
        const ext = sourceFileName.split(".").pop() || sourceFormat;
        const inputName = `input.${ext}`;
        files[inputName] = sourceFileBlob;
        options["input-files"] = [inputName];
        stdin = null;
      }
      const result = await pandoc.convert(options, stdin, files);
      const out = result.stdout || "";
      setSourceText(applyMicroTypography(out));
      setSourceFormat("md");
      setRenderLog(result.stderr || "");
      setStatus("Markdown genere (etape pre-contenu).");
      pushLog(`Normalisation MD: ${out.length} caracteres.`);
    } catch (err) {
      setStatus(`Erreur normalisation MD: ${(err as Error).message}`);
    } finally {
      setProgress(null);
    }
  }

  async function compileTypstToPdfWasm() {
    if (!generatedTypst.trim()) {
      setStatus("Aucun Typst genere.");
      return;
    }
    setProgress({ phase: "Compilation Typst → PDF…" });
    setStatus("Compilation Typst WASM -> PDF...");
    try {
      const tpl = templates.find((t) => t.id === selectedTemplate);
      if (!tpl?.mainTypPath) {
        setStatus("Aucun template selectionne.");
        pushLog("Compile stop: template absent.");
        return;
      }
      pushLog(`Template compile: ${tpl.mainTypPath}`);
      const tplRes = await apiFetch(`${apiBase}/template-source.php?path=${encodeURIComponent(tpl.mainTypPath)}`);
      const tplData = await tplRes.json();
      if (!tplData.ok || !tplData.source) {
        setStatus(`Template non charge: ${tplData.error ?? "inconnu"}`);
        pushLog(`Template load error: ${tplData.error ?? "inconnu"}`);
        return;
      }

      const compiler = await ensureWasmCompiler();
      compiler.reset();
      compiler.resetShadow();
      await mountTypstPackages(compiler);
      const defaultsPath = "typeset/typst/shared/book-options-defaults.typ";
      const defRes = await apiFetch(`${apiBase}/template-source.php?path=${encodeURIComponent(defaultsPath)}`);
      const defData = await defRes.json();
      if (defData.ok && defData.source) {
        compiler.addSource("/typeset/typst/shared/book-options-defaults.typ", String(defData.source));
      } else {
        pushLog(`Defaults typ optionnels non charges: ${defData.error ?? "?"}`);
      }
      compiler.addSource("/template.typ", String(tplData.source));
      compiler.addSource("/content.typ", generatedTypst);
      const resolvedStrings = resolveDocStrings(bookLayout.documentLang, bookLayout.stringOverrides);
      const optLines = buildTypstOptsLines(bookLayout, resolvedStrings, {
        title,
        author,
        publisher,
      });
      compiler.addSource(
        "/main.typ",
        [`#import "/template.typ": render`, ``, `#{`, `  let opts = (`, ...optLines, `  )`, `  render(opts)`, `}`].join("\n"),
      );
      pushLog("Main.typ: opts (mise en page = fichier .typ du template uniquement).");
      const compiled = await compiler.runWithWorld(
        {
          root: "/",
          mainFilePath: "/main.typ",
          inputs: {
            title,
            author,
          },
        },
        async (world) => world.pdf({ diagnostics: "unix" }),
      );

      if (!compiled?.result) {
        setRenderLog(JSON.stringify(compiled?.diagnostics ?? [], null, 2));
        setStatus("Compilation Typst WASM sans resultat PDF.");
        pushLog("Typst world.pdf sans resultat.");
        return;
      }

      const bytes = Uint8Array.from(compiled.result);
      const blob = new Blob([bytes], { type: "application/pdf" });
      const file = new File([blob], "typst-wasm-output.pdf", { type: "application/pdf" });
      await handlePdfFile(file);
      setRenderLog(JSON.stringify(compiled.diagnostics ?? [], null, 2));
      setStatus("PDF genere en WASM.");
      pushLog(`Typst world.pdf OK: ${bytes.byteLength} bytes PDF, diags=${(compiled.diagnostics ?? []).length}.`);
    } catch (err) {
      setStatus(`Erreur Typst WASM: ${(err as Error).message}`);
      pushLog(`Erreur Typst WASM: ${(err as Error).message}`);
    } finally {
      setProgress(null);
    }
  }

  async function compileCoverTypstToPdfWasm() {
    setProgress({ phase: "Couverture Typst → PDF…" });
    setStatus("Compilation couverture Typst WASM -> PDF...");
    try {
      const path = selectedCoverTemplatePath;
      if (!path) {
        setStatus("Aucun template couverture selectionne.");
        return;
      }
      const tplRes = await apiFetch(`${apiBase}/template-source.php?path=${encodeURIComponent(path)}`);
      const tplData = await tplRes.json();
      if (!tplData.ok || !tplData.source) {
        setStatus(`Template couverture non charge: ${tplData.error ?? "inconnu"}`);
        return;
      }

      const compiler = await ensureWasmCompiler();
      compiler.reset();
      compiler.resetShadow();
      await mountTypstPackages(compiler);
      let source = String(tplData.source);
      source = overrideTypstLet(source, "title", JSON.stringify(title));
      source = overrideTypstLet(source, "author", JSON.stringify(author));
      source = overrideTypstLet(source, "edition", JSON.stringify(publisher));
      source = overrideTypstLet(source, "spine-thickness", `${spineThickness}mm`);
      compiler.addSource("/main.typ", source);
      const compiled = await compiler.runWithWorld(
        { root: "/", mainFilePath: "/main.typ", inputs: { title, author } },
        async (world) => world.pdf({ diagnostics: "unix" }),
      );
      if (!compiled?.result) {
        setRenderLog(JSON.stringify(compiled?.diagnostics ?? [], null, 2));
        setStatus("Compilation couverture sans resultat PDF.");
        return;
      }
      const bytes = Uint8Array.from(compiled.result);
      setPreviewFromBytes(bytes, "cover", "cover-output.pdf");
      setRenderLog(JSON.stringify(compiled.diagnostics ?? [], null, 2));
      setStatus("PDF couverture genere.");
      pushLog(`Cover PDF OK: ${bytes.byteLength} bytes.`);
    } catch (err) {
      setStatus(`Erreur couverture Typst WASM: ${(err as Error).message}`);
      pushLog(`Erreur couverture Typst WASM: ${(err as Error).message}`);
    } finally {
      setProgress(null);
    }
  }

  async function compileImpositionTypstToPdfWasm() {
    setProgress({ phase: "Imposition Typst → PDF…" });
    setStatus("Compilation imposition Typst WASM -> PDF...");
    try {
      const path = selectedImpositionTemplatePath;
      if (!path) {
        setStatus("Aucun template imposition selectionne.");
        return;
      }
      const spec = parseImpositionTemplateSpec(path);
      if (!spec) {
        setStatus("Nom du template imposition invalide (attendu: ...-4signature.typ ou ...-4spread.typ).");
        return;
      }
      if (!pdfFile) {
        setStatus("Aucun PDF interieur disponible (genere ou charge).");
        return;
      }
      const totalPages = await loadPdfPageCount(pdfFile);
      const allPages = Array.from({ length: totalPages }, (_, i) => i + 1);
      const orderedBase = spec.kind === "spread" ? reorderSpreadSequence(allPages) : allPages;
      const missing = (spec.packetSize - (orderedBase.length % spec.packetSize)) % spec.packetSize;
      const ordered = orderedBase.concat(Array.from({ length: missing }, () => 0));
      const packets = chunkArray(ordered, spec.packetSize);
      pushLog(`Imposition: ${spec.kind}, paquet=${spec.packetSize}, pages=${totalPages}, padding=${missing}, paquets=${packets.length}`);

      const compiler = await ensureWasmCompiler();
      compiler.reset();
      compiler.resetShadow();
      await mountTypstPackages(compiler);
      const pdfBytes = new Uint8Array(await pdfFile.arrayBuffer());
      compiler.mapShadow("/export.pdf", pdfBytes);
      compiler.mapShadow("export.pdf", pdfBytes);
      const compensationMm = Number((-11 * impositionPaperThicknessMm).toFixed(2));
      const mainSource = buildImpositionMainTyp(spec.kind, spec.packetSize, packets, compensationMm);
      compiler.addSource("/main.typ", mainSource);
      const compiled = await compiler.runWithWorld(
        { root: "/", mainFilePath: "/main.typ", inputs: {} },
        async (world) => world.pdf({ diagnostics: "unix" }),
      );
      if (!compiled?.result) {
        setRenderLog(
          [
            "=== diagnostics ===",
            JSON.stringify(compiled?.diagnostics ?? [], null, 2),
            "",
            "=== main.typ (generated) ===",
            mainSource,
          ].join("\n"),
        );
        const firstDiag = firstDiagnosticMessage(compiled);
        setStatus(firstDiag ? `Compilation imposition echouee: ${firstDiag}` : "Compilation imposition sans resultat PDF.");
        return;
      }
      const bytes = Uint8Array.from(compiled.result);
      setPreviewFromBytes(bytes, "imposition", "imposition-output.pdf");
      setRenderLog(JSON.stringify(compiled.diagnostics ?? [], null, 2));
      setStatus("PDF imposition genere.");
      pushLog(`Imposition PDF OK: ${bytes.byteLength} bytes.`);
    } catch (err) {
      setStatus(`Erreur imposition Typst WASM: ${(err as Error).message}`);
      pushLog(`Erreur imposition Typst WASM: ${(err as Error).message}`);
    } finally {
      setProgress(null);
    }
  }

  async function loadTemplateSourceForEdit() {
    const tpl = templates.find((t) => t.id === selectedTemplate);
    if (!tpl?.mainTypPath) {
      setStatus("Selectionnez un gabarit.");
      return;
    }
    setTemplateEditorLoading(true);
    try {
      const res = await apiFetch(`${apiBase}/template-source.php?path=${encodeURIComponent(tpl.mainTypPath)}`);
      const data = await res.json();
      if (data.ok && typeof data.source === "string") {
        setTemplateEditorSource(data.source);
        setStatus("Source gabarit chargee pour edition.");
      } else {
        setStatus(`Lecture gabarit: ${data.error ?? "erreur"}`);
      }
    } finally {
      setTemplateEditorLoading(false);
    }
  }

  async function saveTemplateSourceEdit() {
    const tpl = templates.find((t) => t.id === selectedTemplate);
    if (!tpl?.mainTypPath) return;
    if (!tpl.mainTypPath.startsWith("user-templates/")) {
      setStatus("Dupliquez le gabarit pour obtenir une copie editable (Import ZIP ou Dupliquer).");
      return;
    }
    const res = await apiFetch(`${apiBase}/template-save.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: tpl.mainTypPath, source: templateEditorSource }),
    });
    const data = await res.json();
    setStatus(data.ok ? "Gabarit enregistre." : `Erreur: ${data.error ?? ""}`);
    if (data.ok) void fetchTemplates();
  }

  async function uploadTypstPackageZip(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("name", typstPkgUploadName.trim() || file.name.replace(/\.zip$/i, ""));
    const res = await apiFetch(`${apiBase}/typst-packages.php`, { method: "POST", body: form });
    const data = await res.json();
    setStatus(data.ok ? `Paquet Typst publie: ${data.item?.id ?? ""}` : `Paquet: ${data.error ?? "erreur"}`);
  }

  async function exportPrintPack() {
    const zip = new JSZip();
    const manifest = {
      generatedAt: new Date().toISOString(),
      sourceFormat,
      templateId: selectedTemplate,
      moduleA: {
        bookLayout,
        bookFormat,
        templateVars: selectedTemplateObj?.variables ?? {},
        imageRefs,
      },
      moduleB: { title, author, publisher, grammage, innerPages, spineThicknessMm: spineThickness },
      moduleC: {
        impositionStrategy: "template" as const,
        selectedImpositionTemplatePath,
        impositionPaperThicknessMm,
      },
    };
    zip.file("manifest.json", JSON.stringify(manifest, null, 2));
    zip.file("README.txt", "Pack impression V1: manifest + contenus references.");
    if (pdfFile) {
      zip.file(`input/${pdfFile.name}`, await pdfFile.arrayBuffer());
    }
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "print-pack-v1.zip";
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("Pack impression exporte.");
  }

  async function refreshAuth() {
    try {
      const res = await apiFetch(`${apiBase}/auth.php?action=me`);
      const data = await res.json();
      if (data.ok && data.authenticated && data.user) {
        setAuthUser({ email: data.user.email, isAdmin: !!data.user.isAdmin });
      } else {
        setAuthUser(null);
      }
    } catch {
      setAuthUser(null);
    } finally {
      setAuthChecked(true);
    }
  }

  async function requestMagicLink() {
    setLoginMessage("");
    try {
      const res = await apiFetch(`${apiBase}/auth.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request-link", email: loginEmail.trim() }),
      });
      const data = (await res.json()) as {
        message?: string;
        error?: string;
        mailDelivered?: boolean;
        debugLogPath?: string;
      };
      setLoginMessage(data.message ?? data.error ?? "Reponse inattendue.");
      if (typeof data.mailDelivered === "boolean") {
        console.info("[auth] mailDelivered=", data.mailDelivered, "serverLog=", data.debugLogPath ?? "");
      }
      if (data.mailDelivered === false) {
        console.warn(
          "[auth] Echec envoi mail cote serveur. Details dans le fichier journal PHP :",
          data.debugLogPath ?? "(voir app/data/logs/obbwasm-mail.log)",
        );
        setLoginMessage(
          (data.message ?? "") +
            " — L'envoi a echoue : voir le journal sur le serveur (F12 > Console pour le chemin).",
        );
      }
    } catch (e) {
      setLoginMessage(`Erreur: ${(e as Error).message}`);
    }
  }

  async function logout() {
    await apiFetch(`${apiBase}/auth.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "logout" }),
    });
    setAuthUser(null);
  }

  async function forkSelectedTemplate() {
    if (!selectedTemplate) {
      setStatus("Selectionnez un template a dupliquer.");
      return;
    }
    const res = await apiFetch(`${apiBase}/templates.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "fork",
        sourceId: selectedTemplate,
        name: forkName.trim() || undefined,
      }),
    });
    const data = await res.json();
    if (data.ok) {
      await fetchTemplates();
      setSelectedTemplate(data.item.id);
      setStatus(`Template duplique: ${data.item.name}`);
    } else {
      setStatus(`Fork: ${data.error ?? "erreur"}`);
    }
  }

  async function exportSelectedThemeZip() {
    if (!selectedTemplate) return;
    const res = await apiFetch(`${apiBase}/theme-export.php?templateId=${encodeURIComponent(selectedTemplate)}`);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setStatus(`Export: ${(err as { error?: string }).error ?? res.statusText}`);
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `theme-${selectedTemplate}.zip`;
    a.click();
    URL.revokeObjectURL(a.href);
    setStatus("Theme exporte (ZIP).");
  }

  async function importThemeFromFile(file: File) {
    const form = new FormData();
    form.append("file", file);
    form.append("name", submissionName.trim() || file.name.replace(/\.zip$/i, ""));
    const res = await apiFetch(`${apiBase}/theme-import.php`, { method: "POST", body: form });
    const data = await res.json();
    if (data.ok) {
      await fetchTemplates();
      setSelectedTemplate(data.item.id);
      setStatus(`Theme importe: ${data.item.name}`);
    } else {
      setStatus(`Import theme: ${data.error ?? "erreur"}`);
    }
  }

  async function submitThemeForReview(file: File) {
    const form = new FormData();
    form.append("action", "submit");
    form.append("name", submissionName.trim() || "Soumission");
    form.append("file", file);
    const res = await apiFetch(`${apiBase}/theme-submissions.php`, { method: "POST", body: form });
    const data = await res.json();
    if (data.ok) {
      setStatus(`Soumission enregistree (${data.item.id}).`);
    } else {
      setStatus(`Soumission: ${data.error ?? "erreur"}`);
    }
  }

  async function loadAdminSubmissions() {
    const res = await apiFetch(`${apiBase}/theme-submissions.php?action=list`);
    const data = await res.json();
    if (data.ok) {
      setAdminSubmissions(data.items ?? []);
    }
  }

  async function approveSubmission(id: string) {
    const res = await apiFetch(`${apiBase}/theme-submissions.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "approve", id }),
    });
    const data = await res.json();
    if (data.ok) {
      await fetchTemplates();
      await loadAdminSubmissions();
      setStatus(`Theme approuve: ${data.template?.name ?? id}`);
    } else {
      setStatus(`Approbation: ${data.error ?? "erreur"}`);
    }
  }

  async function rejectSubmission(id: string) {
    const res = await apiFetch(`${apiBase}/theme-submissions.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "reject", id, note: "" }),
    });
    const data = await res.json();
    if (data.ok) {
      await loadAdminSubmissions();
      setStatus("Soumission refusee.");
    } else {
      setStatus(`Refus: ${data.error ?? "erreur"}`);
    }
  }

  useEffect(() => {
    void fetchTemplates();
  }, []);

  useEffect(() => {
    void refreshAuth();
    const q = new URLSearchParams(window.location.search).get("auth");
    if (q === "ok") {
      setStatus("Connexion reussie.");
      window.history.replaceState({}, "", window.location.pathname);
    } else if (q === "invalid" || q === "error") {
      setStatus("Lien de connexion invalide ou expire.");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  return (
    <div className="app">
      <header className="app-header">
        <div className="app-header-main">
          <h1>{t("ui.brand")}</h1>
        </div>
        <div className="app-header-auth">
          {!authChecked ? (
            <span className="auth-status">
              <Loader2 className="icon-spin" aria-hidden size={18} /> Session…
            </span>
          ) : authUser ? (
            <>
              <span className="auth-email" title={authUser.email}>
                {authUser.isAdmin && <Shield size={16} className="icon-inline" aria-hidden />}
                {authUser.email}
              </span>
              <button type="button" className="btn-ghost" onClick={() => void logout()}>
                <LogOut size={16} aria-hidden /> Deconnexion
              </button>
            </>
          ) : (
            <div className="auth-login-inline">
              <input
                type="email"
                placeholder="email@exemple.fr"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="email"
              />
              <button type="button" className="btn-primary" onClick={() => void requestMagicLink()}>
                <LogIn size={16} aria-hidden /> Lien magique
              </button>
              {loginMessage && <span className="login-hint">{loginMessage}</span>}
            </div>
          )}
          <div className="app-header-tools">
            <button
              type="button"
              className="btn-icon"
              onClick={() => setShowDebug((v) => !v)}
              title={showDebug ? "Masquer le journal" : "Afficher le journal debug"}
            >
              <Bug size={18} aria-hidden />
              <span className="sr-only">{showDebug ? "Masquer debug" : "Debug"}</span>
            </button>
            <button
              type="button"
              className="btn-icon btn-theme-toggle"
              onClick={toggleColorTheme}
              title="Theme clair / sombre"
            >
              {colorTheme === "dark" ? <Sun size={18} aria-hidden /> : <Moon size={18} aria-hidden />}
              <span className="sr-only">Basculer theme</span>
            </button>
            <LanguageSelector />
            <WasmIcon active={wasmReady} />
          </div>
        </div>
      </header>

      <ProgressOverlay phase={progress?.phase ?? null} ratio={progress?.ratio} />

      {authUser?.isAdmin && (
        <section className="panel admin-panel">
          <h2>
            <Shield size={20} aria-hidden /> Moderation themes
          </h2>
          <button type="button" onClick={() => void loadAdminSubmissions()}>
            Rafraichir la file
          </button>
          <ul className="admin-list">
            {adminSubmissions.map((s) => (
              <li key={String(s.id)}>
                <span className="admin-meta">
                  {(s.name as string) ?? s.id} — {(s.status as string) ?? "?"} — {(s.submitterEmail as string) ?? ""}
                </span>
                {s.status === "pending" && (
                  <span className="admin-actions">
                    <button type="button" onClick={() => void approveSubmission(String(s.id))}>Approuver</button>
                    <button type="button" onClick={() => void rejectSubmission(String(s.id))}>Refuser</button>
                  </span>
                )}
              </li>
            ))}
          </ul>
          <h3 className="admin-subheading">Paquets Typst globaux</h3>
          <p className="sub">
            Deposez un ZIP (arborescence des fichiers .typ du paquet). Visible et monte pour tous les utilisateurs lors des compilations.
          </p>
          <div className="admin-pkg-row">
            <input
              type="text"
              placeholder="Libelle (optionnel)"
              value={typstPkgUploadName}
              onChange={(e) => setTypstPkgUploadName(e.target.value)}
              className="fork-name-input"
            />
            <label className="btn-file">
              <Upload size={16} aria-hidden /> Publier ZIP paquet
              <input
                type="file"
                accept=".zip,application/zip"
                hidden
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) void uploadTypstPackageZip(f);
                }}
              />
            </label>
          </div>
        </section>
      )}

      {showDebug && (
        <section className="panel">
          <h2>Journal d'execution</h2>
          <p>Template actif: {selectedTemplateObj?.name || "aucun"} | Format template: {bookFormat} mm</p>
          {renderLog && <textarea readOnly value={renderLog} />}
          <textarea readOnly value={logs.join("\n")} />
        </section>
      )}

      <nav className="tabs" role="tablist" aria-label="Modules">
        <button type="button" role="tab" aria-selected={tab === "contenu"} className={tab === "contenu" ? "active" : ""} onClick={() => setTab("contenu")}>
          <BookOpen size={18} aria-hidden /> {t("ui.tabContent")}
        </button>
        <button type="button" role="tab" aria-selected={tab === "couverture"} className={tab === "couverture" ? "active" : ""} onClick={() => setTab("couverture")}>
          <BookMarked size={18} aria-hidden /> {t("ui.tabCover")}
        </button>
        <button type="button" role="tab" aria-selected={tab === "imposition"} className={tab === "imposition" ? "active" : ""} onClick={() => setTab("imposition")}>
          <LayoutGrid size={18} aria-hidden /> {t("ui.tabImposition")}
        </button>
        <button type="button" role="tab" aria-selected={tab === "pdf"} className={tab === "pdf" ? "active" : ""} onClick={() => setTab("pdf")}>
          <FileText size={18} aria-hidden /> {t("ui.tabPdf")}
        </button>
      </nav>

      {tab === "contenu" && (
        <section className="panel panel-contenu">
          <div className="content-toolbar sticky-toolbar">
            <TemplatePicker
              templates={templates}
              selectedId={selectedTemplate}
              metaById={templateMetaById}
              loading={templatesLoading}
              onOpenMenu={() => void ensureTemplatesLoaded()}
              onSelect={(id) => setSelectedTemplate(id)}
              onPreview={(id) => setTemplatePreviewId(id)}
            />
            {authUser && (
              <div className="content-toolbar-auth">
                <input
                  className="fork-name-input"
                  placeholder="Nom du fork (optionnel)"
                  value={forkName}
                  onChange={(e) => setForkName(e.target.value)}
                />
                <button type="button" onClick={() => void forkSelectedTemplate()}>
                  Dupliquer
                </button>
                <button type="button" onClick={() => void exportSelectedThemeZip()} title="Exporter le theme en ZIP">
                  <Download size={16} aria-hidden /> Export
                </button>
                <label className="btn-file">
                  <Upload size={16} aria-hidden /> Import
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void importThemeFromFile(f);
                    }}
                  />
                </label>
                <input
                  className="fork-name-input"
                  placeholder="Nom soumission / import"
                  value={submissionName}
                  onChange={(e) => setSubmissionName(e.target.value)}
                />
                <label className="btn-file">
                  <Send size={16} aria-hidden /> Soumettre
                  <input
                    type="file"
                    accept=".zip,application/zip"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = "";
                      if (f) void submitThemeForReview(f);
                    }}
                  />
                </label>
              </div>
            )}
            <button
              type="button"
              className="btn-icon"
              title="Enregistrer le projet sur le serveur"
              aria-label="Enregistrer le projet"
              onClick={() => void saveProject()}
            >
              <Save size={18} aria-hidden />
            </button>
            <button
              type="button"
              className="btn-with-icon"
              title={t("ui.tooltipMdToTypst")}
              onClick={() => void convertWithPandocWasm()}
            >
              <ArrowBigRight size={18} aria-hidden /> {t("ui.mdToTypst")}
            </button>
            <button
              type="button"
              className="btn-with-icon"
              title={t("ui.tooltipCompilePdf")}
              onClick={() => void compileTypstToPdfWasm()}
            >
              <Printer size={18} aria-hidden /> {t("ui.pdf")}
            </button>
            <button type="button" className="btn-with-icon" title={t("ui.downloadInterior")} onClick={downloadGeneratedPdf}>
              <Download size={16} aria-hidden /> {t("ui.download")}
            </button>
            <button type="button" className="btn-with-icon" onClick={() => void exportPrintPack()}>
              <Package size={16} aria-hidden /> Pack
            </button>
          </div>

          <section className="subpanel">
            <h3>Etape optionnelle — normaliser en Markdown</h3>
            <p className="sub">
              Utile pour homogeneiser epub / docx / pdf / etc. avant le flux Typst. Les resultats PDF→MD peuvent etre imparfaits.
            </p>
            <div className="checks">
              <button type="button" onClick={() => void convertNormalizeToMd()}>
                Vers Markdown
              </button>
              <button
                type="button"
                className="btn-ghost"
                onClick={() => {
                  setShowMdPresetEditor((v) => {
                    const next = !v;
                    if (next) setMdPresetJson((j) => j || JSON.stringify(loadMdPresets(), null, 2));
                    return next;
                  });
                }}
              >
                {showMdPresetEditor ? "Masquer" : "Editer"} preregleges JSON
              </button>
            </div>
            {showMdPresetEditor && (
              <>
                <textarea
                  className="preset-json"
                  value={mdPresetJson}
                  onChange={(e) => setMdPresetJson(e.target.value)}
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={() => {
                    try {
                      const parsed = JSON.parse(mdPresetJson || "{}") as Record<string, Record<string, unknown>>;
                      saveMdPresets(parsed);
                      setStatus("Preregleges Markdown enregistres (local).");
                    } catch {
                      setStatus("JSON invalide pour les preregleges.");
                    }
                  }}
                >
                  Enregistrer preregleges
                </button>
              </>
            )}
          </section>

          {authUser && (
            <section className="subpanel">
              <h3>Edition gabarit (.typ)</h3>
              <p className="sub">
                Seules les copies sous <code>user-templates/</code> sont enregistrables. Utilisez Dupliquer ou Import ZIP.
              </p>
              <div className="checks">
                <button type="button" onClick={() => void loadTemplateSourceForEdit()} disabled={templateEditorLoading}>
                  {templateEditorLoading ? "Chargement…" : "Charger source"}
                </button>
                <button type="button" onClick={() => void saveTemplateSourceEdit()}>
                  Enregistrer sur le serveur
                </button>
              </div>
              <textarea
                value={templateEditorSource}
                onChange={(e) => setTemplateEditorSource(e.target.value)}
                placeholder="Chargez la source du gabarit selectionne…"
                spellCheck={false}
              />
            </section>
          )}

          <div className="grid">
            <label>
              {t("ui.title")}
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              {t("ui.author")}
              <input value={author} onChange={(e) => setAuthor(e.target.value)} />
            </label>
            <label>
              {t("ui.publisher")}
              <input value={publisher} onChange={(e) => setPublisher(e.target.value)} />
            </label>
            <label>
              {t("ui.sourceFormat")}
              <select value={sourceFormat} onChange={(e) => setSourceFormat(e.target.value)}>
                {["docx", "md", "html", "odt", "epub", "latex", "txt", "rtf"].map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("ui.sourceFile")}
              <input type="file" onChange={(e) => e.target.files?.[0] && handleSourceFile(e.target.files[0])} />
            </label>
            <label>
              {t("ui.bibFile")}
              <input type="file" accept=".bib" onChange={(e) => setBibFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <section className="subpanel book-layout-panel">
            <h3>{t("ui.bookOptions")}</h3>
            <BookOptionsForm
              visibleOptionIds={visibleOptionIds}
              bookLayout={bookLayout}
              setBookLayout={setBookLayout}
              patchBookValues={patchBookValues}
            />
            <h3>{t("ui.sectionOrder")}</h3>
            <p className="sub">{t("ui.sectionOrderHint")}</p>
            <SectionOrderList
              sectionOrder={bookLayout.sectionOrder}
              onReorder={(next) => setBookLayout((prev) => ({ ...prev, sectionOrder: next }))}
            />
          </section>
          <textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)} />
          <p>
            {t("ui.imagesDetected")}: {imageRefs.length}
          </p>
          {lintIssues.length > 0 && <p className="warn">{lintIssues.join(" | ")}</p>}
          {generatedTypst && <textarea readOnly value={generatedTypst} />}
        </section>
      )}

      {tab === "couverture" && (
        <section className="panel">
          <div className="grid">
            <label>
              {t("ui.title")}
              <input value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <label>
              {t("ui.author")}
              <input value={author} onChange={(e) => setAuthor(e.target.value)} />
            </label>
            <label>
              {t("ui.editor")}
              <input value={publisher} onChange={(e) => setPublisher(e.target.value)} />
            </label>
            <label>
              {t("ui.grammage")}
              <select value={grammage} onChange={(e) => setGrammage(Number(e.target.value))}>
                <option value={80}>80g</option>
                <option value={100}>100g</option>
                <option value={120}>120g</option>
              </select>
            </label>
            <label>
              {t("ui.innerPages")}
              <input type="number" value={innerPages} onChange={(e) => setInnerPages(Number(e.target.value))} />
            </label>
            <label>
              {t("ui.spineCalc")}
              <input readOnly value={spineThickness} />
            </label>
            <label>
              {t("ui.coverTemplate")}
              <select value={selectedCoverTemplatePath} onChange={(e) => setSelectedCoverTemplatePath(e.target.value)}>
                {coverTemplateChoices.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <p>
            {t("ui.coverFormula")}: {spineThickness} mm
          </p>
          <div className="cover-toolbar">
            <label className="cover-toolbar-file">
              {t("ui.pdfInteriorCount")}
              <input type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && handlePdfFile(e.target.files[0])} />
            </label>
            <button type="button" className="btn-primary cover-toolbar-generate" onClick={() => void compileCoverTypstToPdfWasm()}>
              {t("ui.generateCoverPdf")}
            </button>
          </div>
          {coverPreviewUrl ? (
            <PdfPageViewer
              file={coverPdfFile}
              url={coverPreviewUrl}
              downloadFileName={coverPdfName || "cover-output.pdf"}
            />
          ) : null}
        </section>
      )}

      {tab === "imposition" && (
        <section className="panel">
          {!IMPOSITION_AUTO_ENABLED && <p className="muted-banner">{t("ui.impositionDisabled")}</p>}
          <div className="checks pdf-upload-row">
            <label>
              {t("ui.pdfInterior")}
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => e.target.files?.[0] && handlePdfFile(e.target.files[0])}
              />
            </label>
            {pdfFile ? (
              <span className="pdf-pages-hint">
                {innerPages} {t("ui.pagesHint")} — {pdfFile.name}
              </span>
            ) : (
              <span className="pdf-pages-hint muted">{t("ui.noPdfHint")}</span>
            )}
            {previewImgDataUrl ? (
              <img src={previewImgDataUrl} alt="" className="pdf-thumb" width={72} height={96} />
            ) : null}
          </div>
          <div className="grid">
            <label>
              {t("ui.impositionTemplate")}
              <select value={selectedImpositionTemplatePath} onChange={(e) => setSelectedImpositionTemplatePath(e.target.value)}>
                {impositionTemplateChoices.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              {t("ui.paperThicknessMm")}
              <input
                type="number"
                step="0.01"
                min="0.01"
                value={impositionPaperThicknessMm}
                onChange={(e) => setImpositionPaperThicknessMm(Number(e.target.value))}
              />
            </label>
          </div>
          <div className="info">
            <button type="button" className="btn-primary" onClick={() => void compileImpositionTypstToPdfWasm()}>
              {t("ui.generateImpositionPdf")}
            </button>
            {impositionPreviewUrl && (
              <a href={impositionPreviewUrl} download={impositionPdfName || "imposition-output.pdf"}>
                {t("ui.downloadPair")} {impositionPdfName || "imposition-output.pdf"}
              </a>
            )}
          </div>
          {impositionPreviewUrl && <iframe className="preview" src={impositionPreviewUrl} title="preview-imposition" />}
        </section>
      )}

      {tab === "pdf" && (
        <section className="panel">
          {!previewUrl ? (
            <p>{t("ui.pdfTabEmpty")}</p>
          ) : (
            <PdfPageViewer
              file={pdfFile}
              url={previewUrl}
              downloadFileName={generatedPdfName || "typst-wasm-output.pdf"}
            />
          )}
        </section>
      )}

      {templatePreviewId ? (
        <div
          className="modal-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="tpl-preview-title"
          onClick={() => setTemplatePreviewId(null)}
          onKeyDown={(e) => e.key === "Escape" && setTemplatePreviewId(null)}
        >
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
            <h2 id="tpl-preview-title">{t("ui.modalTemplatePreview")}</h2>
            {(() => {
              const tpl = templates.find((x) => x.id === templatePreviewId);
              if (!tpl) return <p>{t("ui.templateNotFound")}</p>;
              const m = templateMetaById[tpl.id];
              const title = displayTitle(
                m ?? { nomComplet: "", version: "", detail: "", format: "", supportedOptions: [] },
                tpl.name,
              );
              return (
                <>
                  <p className="modal-title-text">{title}</p>
                  {m?.detail ? <p className="modal-detail">{m.detail}</p> : null}
                  <ul className="modal-meta-list">
                    {m?.format ? (
                      <li>
                        <strong>{t("ui.format")}</strong> : {m.format}
                      </li>
                    ) : null}
                    {m?.version ? (
                      <li>
                        <strong>{t("ui.version")}</strong> : {m.version}
                      </li>
                    ) : null}
                    <li>
                      <strong>{t("ui.file")}</strong> : {tpl.mainTypPath}
                    </li>
                    {m?.supportedOptions && m.supportedOptions.length > 0 ? (
                      <li>
                        <strong>supported-options</strong> : {m.supportedOptions.join(", ")}
                      </li>
                    ) : null}
                  </ul>
                  <p className="sub">{t("ui.variablesJson")}</p>
                  <pre className="modal-pre">{JSON.stringify(tpl.variables, null, 2)}</pre>
                </>
              );
            })()}
            <button type="button" className="btn-primary modal-close" onClick={() => setTemplatePreviewId(null)}>
              {t("ui.close")}
            </button>
          </div>
        </div>
      ) : null}

      <footer>{status}</footer>
    </div>
  );
}

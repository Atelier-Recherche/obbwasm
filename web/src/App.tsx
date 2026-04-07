import { useEffect, useMemo, useRef, useState } from "react";
import JSZip from "jszip";
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { TypstCompiler } from "@myriaddreamin/typst.ts";
import typstCompilerWasmUrl from "@myriaddreamin/typst-ts-web-compiler/wasm?url";
import { setImportWasmModule } from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler.mjs";

GlobalWorkerOptions.workerSrc = workerSrc;

type Template = {
  id: string;
  name: string;
  mainTypPath: string;
  variables: Record<string, string>;
};

type ImpositionMode =
  | "saddle-stitch"
  | "section-sewing"
  | "perfect-bound"
  | "n-up"
  | "cut-stack";

const apiBase = import.meta.env.VITE_API_BASE ?? "http://127.0.0.1:8088/api";

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
  const [tab, setTab] = useState<"contenu" | "couverture" | "impression" | "pdf">("contenu");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [sourceFileBlob, setSourceFileBlob] = useState<File | null>(null);
  const [sourceFileName, setSourceFileName] = useState("");
  const [sourceFormat, setSourceFormat] = useState("md");
  const [includeCoverPage, setIncludeCoverPage] = useState(false);
  const [tocPosition, setTocPosition] = useState<"none" | "start" | "end">("none");
  const [sectionBreakH1H2, setSectionBreakH1H2] = useState(false);
  const [title, setTitle] = useState("Titre");
  const [author, setAuthor] = useState("Auteur");
  const [publisher, setPublisher] = useState("Edition");
  const [grammage, setGrammage] = useState(80);
  const [innerPages, setInnerPages] = useState(0);
  const [impositionMode, setImpositionMode] = useState<ImpositionMode>("saddle-stitch");
  const [sheetFormat, setSheetFormat] = useState<"A4" | "A3">("A4");
  const [signatureSize, setSignatureSize] = useState(16);
  const [nUp, setNUp] = useState(2);
  const [creepPerLeaf, setCreepPerLeaf] = useState(0.08);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [generatedPdfName, setGeneratedPdfName] = useState("");
  const [status, setStatus] = useState("Pret.");
  const [generatedTypst, setGeneratedTypst] = useState("");
  const [renderLog, setRenderLog] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const [previewImgDataUrl, setPreviewImgDataUrl] = useState("");
  const [bibFile, setBibFile] = useState<File | null>(null);
  const [colorTheme, setColorTheme] = useState<"light" | "dark">("light");

  const imageRefs = useMemo(() => extractMarkdownImages(sourceText), [sourceText]);
  const lintIssues = useMemo(() => findInvisibleChars(sourceText), [sourceText]);
  const selectedTemplateObj = useMemo(
    () => templates.find((t) => t.id === selectedTemplate),
    [templates, selectedTemplate],
  );

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

  const needsMultiple = impositionMode === "section-sewing" ? signatureSize : 4;
  const missingPages = innerPages > 0 ? (needsMultiple - (innerPages % needsMultiple)) % needsMultiple : 0;
  const creep = useMemo(
    () => Number((((innerPages / 2) - 1) * creepPerLeaf).toFixed(2)),
    [innerPages, creepPerLeaf],
  );

  const poses = useMemo(() => {
    const [w, h] = bookFormat.split("x").map(Number);
    const sheet = sheetFormat === "A4" ? [210, 297] : [297, 420];
    const upPortrait = Math.floor(sheet[0] / w) * Math.floor(sheet[1] / h);
    const upLandscape = Math.floor(sheet[0] / h) * Math.floor(sheet[1] / w);
    return Math.max(upPortrait, upLandscape);
  }, [bookFormat, sheetFormat]);

  function pushLog(message: string) {
    const ts = new Date().toISOString();
    setLogs((prev) => [`[${ts}] ${message}`, ...prev].slice(0, 200));
  }

  async function fetchTemplates() {
    const res = await fetch(`${apiBase}/templates.php`);
    const data = await res.json();
    if (data.ok) {
      setTemplates(data.items);
      if (!selectedTemplate && data.items.length > 0) {
        setSelectedTemplate(data.items[0].id);
      }
    }
  }

  async function uploadSource(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${apiBase}/upload.php`, { method: "POST", body: form });
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
          includeCoverPage,
          tocPosition,
          sectionBreakH1H2,
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
          impositionMode,
          sheetFormat,
          signatureSize,
          nUp,
          creepPerLeafMm: creepPerLeaf,
          estimatedTotalCreepMm: creep,
          poses,
          missingPages,
        },
      },
    };
    const res = await fetch(`${apiBase}/projects.php`, {
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
    if (!typstWasmImporterReady.current) {
      setImportWasmModule(async () => {
        const res = await fetch(typstCompilerWasmUrl);
        if (!res.ok) throw new Error(`Impossible de charger le WASM Typst: ${res.status}`);
        return await res.arrayBuffer();
      });
      typstWasmImporterReady.current = true;
    }
    const typst = await import("@myriaddreamin/typst.ts");
    const compiler = typst.createTypstCompiler();
    const fontsRes = await fetch(`${apiBase}/font-assets.php?action=list`);
    const fontsData = await fontsRes.json();
    const fontItems: Array<{ path: string; name: string; size: number }> = fontsData?.ok ? fontsData.items ?? [] : [];
    const fontBuffers: Uint8Array[] = [];
    for (const item of fontItems) {
      try {
        const res = await fetch(`${apiBase}/font-assets.php?action=file&path=${encodeURIComponent(item.path)}`);
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
    await compiler.init({
      beforeBuild: [typst.loadFonts(fontBuffers)],
    });
    compilerRef.current = compiler;
    setWasmReady(true);
    pushLog(`Typst compiler init OK (fonts chargees: ${fontBuffers.length}/${fontItems.length}).`);
    return compiler;
  }

  async function convertWithPandocWasm() {
    if (!sourceText.trim() && !sourceFileBlob) {
      setStatus("Aucune source chargee.");
      return;
    }
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
    }
  }

  async function compileTypstToPdfWasm() {
    if (!generatedTypst.trim()) {
      setStatus("Aucun Typst genere.");
      return;
    }
    setStatus("Compilation Typst WASM -> PDF...");
    try {
      const tpl = templates.find((t) => t.id === selectedTemplate);
      if (!tpl?.mainTypPath) {
        setStatus("Aucun template selectionne.");
        pushLog("Compile stop: template absent.");
        return;
      }
      pushLog(`Template compile: ${tpl.mainTypPath}`);
      const tplRes = await fetch(`${apiBase}/template-source.php?path=${encodeURIComponent(tpl.mainTypPath)}`);
      const tplData = await tplRes.json();
      if (!tplData.ok || !tplData.source) {
        setStatus(`Template non charge: ${tplData.error ?? "inconnu"}`);
        pushLog(`Template load error: ${tplData.error ?? "inconnu"}`);
        return;
      }

      const compiler = await ensureWasmCompiler();
      compiler.reset();
      compiler.resetShadow();
      compiler.addSource("/template.typ", String(tplData.source));
      compiler.addSource("/content.typ", generatedTypst);
      compiler.addSource(
        "/main.typ",
        [
          `#import "/template.typ": render`,
          ``,
          `#{`,
          `  let opts = (`,
          `    title: ${JSON.stringify(title)},`,
          `    author: ${JSON.stringify(author)},`,
          `    edition: ${JSON.stringify(publisher)},`,
          `    cover-page: ${includeCoverPage ? "true" : "false"},`,
          `    section-new-page: ${sectionBreakH1H2 ? "true" : "false"},`,
          `    toc-at-start: ${tocPosition === "start" ? "true" : "false"},`,
          `    toc-at-end: ${tocPosition === "end" ? "true" : "false"},`,
          `  )`,
          `  render(opts)`,
          `}`,
        ].join("\n"),
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
    }
  }

  async function exportPrintPack() {
    const zip = new JSZip();
    const manifest = {
      generatedAt: new Date().toISOString(),
      sourceFormat,
      templateId: selectedTemplate,
      moduleA: {
        includeCoverPage,
        tocPosition,
        sectionBreakH1H2,
        bookFormat,
        templateVars: selectedTemplateObj?.variables ?? {},
        imageRefs,
      },
      moduleB: { title, author, publisher, grammage, innerPages, spineThicknessMm: spineThickness },
      moduleC: { impositionMode, sheetFormat, signatureSize, nUp, creepMm: creep, poses, missingPages },
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

  async function computeImpositionServerSide() {
    const res = await fetch(`${apiBase}/imposition-calc.php`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        innerPages,
        signatureSize,
        mode: impositionMode,
        creepPerLeafMm: creepPerLeaf,
      }),
    });
    const data = await res.json();
    if (!data.ok) {
      setStatus(`Erreur calcul imposition: ${data.error ?? "inconnue"}`);
      return;
    }
    setStatus(
      `Calcul serveur: multiple ${data.needsMultiple}, pages manquantes ${data.missingPages}, chasse ${data.creepTotalMm} mm`,
    );
  }

  return (
    <div className="app">
      <header>
        <h1>OBBWASM Studio</h1>
        <p className="sub">Modules A/B/C + preview PDF + stockage JSON via PHP (styles portes par template)</p>
      </header>

      <div className="toolbar">
        <button onClick={fetchTemplates}>Charger templates</button>
        <select value={selectedTemplate} onChange={(e) => setSelectedTemplate(e.target.value)}>
          <option value="">Selectionner un template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <button onClick={saveProject}>Enregistrer projet</button>
        <button onClick={convertWithPandocWasm}>Pandoc WASM {"->"} Typst</button>
        <button onClick={compileTypstToPdfWasm}>Typst WASM {"->"} PDF</button>
        <button onClick={downloadGeneratedPdf}>Telecharger PDF genere</button>
        <button onClick={exportPrintPack}>Generer pack impression</button>
        <button onClick={() => setShowDebug((v) => !v)}>{showDebug ? "Masquer debug" : "Afficher debug"}</button>
        <button type="button" onClick={toggleColorTheme} title="Basculer theme clair / sombre">
          Theme: {colorTheme === "dark" ? "sombre" : "clair"}
        </button>
        <span>WASM: {wasmReady ? "pret" : "non initialise"}</span>
      </div>

      {showDebug && (
        <section className="panel">
          <h2>Journal d'execution</h2>
          <p>Template actif: {selectedTemplateObj?.name || "aucun"} | Format template: {bookFormat} mm</p>
          {renderLog && <textarea readOnly value={renderLog} />}
          <textarea readOnly value={logs.join("\n")} />
        </section>
      )}

      <nav className="tabs">
        <button className={tab === "contenu" ? "active" : ""} onClick={() => setTab("contenu")}>Contenu</button>
        <button className={tab === "couverture" ? "active" : ""} onClick={() => setTab("couverture")}>Couverture</button>
        <button className={tab === "impression" ? "active" : ""} onClick={() => setTab("impression")}>Impression</button>
        <button className={tab === "pdf" ? "active" : ""} onClick={() => setTab("pdf")}>PDF genere</button>
      </nav>

      {tab === "contenu" && (
        <section className="panel">
          <h2>Module A - Pipeline de Contenu</h2>
          <div className="grid">
            <label>Titre<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label>Auteur<input value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
            <label>Maison d'edition<input value={publisher} onChange={(e) => setPublisher(e.target.value)} /></label>
            <label>
              Format source
              <select value={sourceFormat} onChange={(e) => setSourceFormat(e.target.value)}>
                {["docx", "md", "html", "odt", "epub", "latex", "txt", "rtf"].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </label>
            <label>
              Source manuscrit
              <input type="file" onChange={(e) => e.target.files?.[0] && handleSourceFile(e.target.files[0])} />
            </label>
            <label>
              Bibliographie (.bib)
              <input type="file" accept=".bib" onChange={(e) => setBibFile(e.target.files?.[0] ?? null)} />
            </label>
          </div>
          <div className="checks">
            <label><input type="checkbox" checked={includeCoverPage} onChange={(e) => setIncludeCoverPage(e.target.checked)} /> Cover page interne</label>
            <label><input type="checkbox" checked={sectionBreakH1H2} onChange={(e) => setSectionBreakH1H2(e.target.checked)} /> Forcer H1/H2 nouvelle page</label>
            <label>
              TOC
              <select value={tocPosition} onChange={(e) => setTocPosition(e.target.value as "none" | "start" | "end")}>
                <option value="none">Aucun</option>
                <option value="start">Debut</option>
                <option value="end">Fin</option>
              </select>
            </label>
          </div>
          <textarea value={sourceText} onChange={(e) => setSourceText(e.target.value)} />
          <p>Images detectees: {imageRefs.length}</p>
          {lintIssues.length > 0 && <p className="warn">{lintIssues.join(" | ")}</p>}
          {generatedTypst && <textarea readOnly value={generatedTypst} />}
        </section>
      )}

      {tab === "couverture" && (
        <section className="panel">
          <h2>Module B - Couverture (Wrap)</h2>
          <div className="grid">
            <label>Titre<input value={title} onChange={(e) => setTitle(e.target.value)} /></label>
            <label>Auteur<input value={author} onChange={(e) => setAuthor(e.target.value)} /></label>
            <label>Editeur<input value={publisher} onChange={(e) => setPublisher(e.target.value)} /></label>
            <label>
              Grammage
              <select value={grammage} onChange={(e) => setGrammage(Number(e.target.value))}>
                <option value={80}>80g</option>
                <option value={100}>100g</option>
                <option value={120}>120g</option>
              </select>
            </label>
            <label>Pages interieures<input type="number" value={innerPages} onChange={(e) => setInnerPages(Number(e.target.value))} /></label>
            <label>Tranche calculee (mm)<input readOnly value={spineThickness} /></label>
          </div>
          <p>Formule: (NbPages / 2) x EpaisseurFeuille = {spineThickness} mm</p>
          <label>PDF interieur pour comptage + preview<input type="file" accept="application/pdf" onChange={(e) => e.target.files?.[0] && handlePdfFile(e.target.files[0])} /></label>
          {previewUrl && <iframe className="preview" src={previewUrl} title="preview" />}
        </section>
      )}

      {tab === "impression" && (
        <section className="panel">
          <h2>Module C - Imposition</h2>
          <div className="grid">
            <label>
              Mode
              <select value={impositionMode} onChange={(e) => setImpositionMode(e.target.value as ImpositionMode)}>
                <option value="saddle-stitch">Cahier unique (Saddle Stitch)</option>
                <option value="section-sewing">Multi-signatures (Section Sewing)</option>
                <option value="perfect-bound">Perfect Bound</option>
                <option value="n-up">N-Up</option>
                <option value="cut-stack">Cut &amp; Stack</option>
              </select>
            </label>
            <label>
              Feuille impression
              <select value={sheetFormat} onChange={(e) => setSheetFormat(e.target.value as "A4" | "A3")}>
                <option value="A4">A4</option>
                <option value="A3">A3</option>
              </select>
            </label>
            <label>Taille signature<input type="number" value={signatureSize} onChange={(e) => setSignatureSize(Number(e.target.value))} /></label>
            <label>N-Up<input type="number" value={nUp} onChange={(e) => setNUp(Number(e.target.value))} /></label>
            <label>Creep par feuille (mm)<input type="number" step="0.01" value={creepPerLeaf} onChange={(e) => setCreepPerLeaf(Number(e.target.value))} /></label>
          </div>
          <div className="info">
            <p>Poses possibles sur {sheetFormat}: {poses}</p>
            <p>Chasse estimee: {creep} mm</p>
            <p>Pages a ajouter pour respecter le multiple: {missingPages}</p>
            <button onClick={computeImpositionServerSide}>Verifier imposition cote serveur</button>
            {poses < 1 && <p className="warn">Le format livre ne rentre pas dans la feuille choisie.</p>}
            {missingPages > 0 && <p className="warn">Proposer {missingPages} pages blanches (notes/garde).</p>}
          </div>
        </section>
      )}

      {tab === "pdf" && (
        <section className="panel">
          <h2>PDF genere</h2>
          {!previewUrl && <p>Aucun PDF genere pour le moment.</p>}
          {previewUrl && (
            <>
              <div className="checks">
                <a href={previewUrl} download={generatedPdfName || "typst-wasm-output.pdf"}>
                  Telecharger {generatedPdfName || "typst-wasm-output.pdf"}
                </a>
              </div>
              {previewImgDataUrl ? (
                <img src={previewImgDataUrl} alt="Apercu PDF page 1" className="pdf-image-preview" />
              ) : (
                <iframe className="preview" src={previewUrl} title="preview-global" />
              )}
            </>
          )}
        </section>
      )}

      <footer>{status}</footer>
    </div>
  );
}

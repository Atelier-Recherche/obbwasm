import type { BookLayoutState } from "./bookOptions/types.js";
import { buildTypstOptsLines } from "./bookOptions/typstSerialize.js";
import { resolveDocStrings } from "./bookOptions/docStrings.js";
import { BOOK_OPTIONS_DEFAULTS_PATH, type ObbWasmAssetLoader } from "./assetLoader.js";
import { mountTypstPackagesFromLoader } from "./typstPackages.js";
import { mountTypstFontShadows } from "./typstFontShadow.js";
import { virtualizeTypstMediaPaths } from "./typstVirtualMedia.js";
import { splitPandocTypstBodyAndBibliography } from "./pandocTypstBibliography.js";
import { withAsyncTimeout, yieldToMainThread } from "./asyncYield.js";
import { extractMarkdownDataUriImages } from "./markdownDataUriImages.js";
import { sanitizeTypstCompilerSource } from "./typstHelpers.js";
import {
  collectTypstLabelIds,
  injectTypstHeadingLabels,
  patchPandocTypstBrokenLabelRefs,
  patchPandocTypstBrokenLabelRefsAsync,
  stripNonBookWikiLinks,
} from "./pandocTypstLabels.js";
import { patchPandocTypstMedia, stripBrokenMarkdownMedia } from "./pandocTypstMedia.js";
import {
  buildObbBackMatterTypstFragment,
  normalizeWikiGlossaryIndexLinks,
  patchPandocTypstObbWikiRefs,
} from "./wikiGlossaryIndex.js";

export type PandocConvertFn = (
  options: Record<string, unknown>,
  stdin: string | null,
  files: Record<string, string | Blob>,
) => Promise<{
  stdout: string;
  stderr: string;
  warnings: unknown[];
  files: Record<string, string | Blob>;
  mediaFiles: Record<string, string | Blob>;
}>;

async function toUint8Array(data: string | Blob): Promise<Uint8Array> {
  if (typeof data === "string") return new TextEncoder().encode(data);
  return new Uint8Array(await data.arrayBuffer());
}

/** Obsidian `![[fichier]]` → `![](fichier)` pour que Pandoc traite les images locales. */
export function normalizeWikiImagesForPandoc(markdown: string): string {
  return markdown.replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, path: string) => `![](${path.trim()})`);
}

/**
 * Raccourcis du type `[@clef p44]` (sans virgule) : Pandoc envoie un locator littéral « p44 » à citeproc,
 * qui ajoute déjà le libellé de page du CSL (« p. ») → rendu « p. p44 ». Même problème avec `[@clef, p44]`.
 * La forme canonique Pandoc est `[@clef, 44]` ou `[@clef, p. 44]` (virgule après la clé).
 */
export function normalizePandocCitationPageShorthand(markdown: string): string {
  let s = markdown;
  s = s.replace(/\[@([^\s\],]+)\s*,\s*p(\d+)\]/g, "[@$1, $2]");
  s = s.replace(/\[@([^\s\],]+)\s+p(\d+)\]/g, "[@$1, $2]");
  return s;
}

/** Pandoc sans citeproc laisse des clés brutes (@clef) dans le Typst émis. */
export function detectUnprocessedPandocCitations(typst: string): boolean {
  return /\s@[A-Za-z][\w:-]*(?:[.,;:!?)}\]]|\s|$)/.test(typst);
}

/** Rendu Typst pour une ligne `---` / `***` / `___` (séparateur horizontal Markdown). */
export type MarkdownHorizontalRuleTypst = "line" | "pagebreak";

/** Lit l’option livre « Séparateur Markdown » (registre : `markdown-horizontal-rule`). */
export function markdownHorizontalRuleFromBookValues(
  values: Record<string, boolean | string>,
): MarkdownHorizontalRuleTypst {
  return values["markdown-horizontal-rule"] === "pagebreak" ? "pagebreak" : "line";
}

/**
 * Le writer Pandoc → Typst émet `#horizontalrule` pour les séparateurs Markdown (`---`).
 * Ce symbole n’existe pas en Typst standard → erreur « unknown variable: horizontalrule ».
 */
export function patchPandocTypstFragments(
  typst: string,
  mode: MarkdownHorizontalRuleTypst = "line",
): string {
  if (!typst.includes("horizontalrule")) return typst;
  const replacement =
    mode === "pagebreak" ? "#pagebreak()" : "#line(length: 100%, stroke: 0.55pt + luma(210))";
  return typst.replace(/#horizontalrule\s*\(\s*\)/g, replacement).replace(/#horizontalrule\b/g, replacement);
}

export async function pandocMarkdownToTypst(params: {
  convert: PandocConvertFn;
  /** Pandoc `from` ; défaut `markdown` (plugin Obsidian). */
  sourceFormat?: string;
  sourceText: string;
  sourceBlob?: Blob | null;
  sourceFileName?: string;
  titleFallback: string;
  bibliography?: { name: string; blob: Blob } | null;
  /** Style de citations CSL (avec bibliographie ; ignoré sans `.bib`). */
  csl?: { name: string; blob: Blob } | null;
  /** Fichiers additionnels accessibles par Pandoc (images markdown, etc.). */
  extraFiles?: Record<string, string | Blob>;
  /** Séparateurs `---` dans le Markdown : ligne Typst ou saut de page. */
  markdownHorizontalRule?: MarkdownHorizontalRuleTypst;
}): Promise<{ typst: string; stderr: string; mediaFiles: Record<string, Uint8Array> }> {
  const {
    convert,
    sourceFormat = "md",
    sourceText,
    sourceBlob,
    sourceFileName,
    titleFallback,
    bibliography,
    csl,
    extraFiles,
    markdownHorizontalRule = "line",
  } = params;
  const from =
    sourceFormat === "md"
      ? bibliography
        ? "markdown+footnotes+citations"
        : "markdown+footnotes"
      : sourceFormat === "txt"
        ? "plain"
        : sourceFormat;
  let sourceTextForConvert = sourceText;
  let dataUriFiles: Record<string, Uint8Array> = {};
  if (from === "markdown" && typeof sourceTextForConvert === "string" && sourceTextForConvert.length > 0) {
    const dataUri = extractMarkdownDataUriImages(sourceTextForConvert);
    dataUriFiles = dataUri.files;
    sourceTextForConvert = dataUri.markdown;
    sourceTextForConvert = normalizeWikiImagesForPandoc(sourceTextForConvert);
    sourceTextForConvert = normalizeWikiGlossaryIndexLinks(sourceTextForConvert);
    sourceTextForConvert = stripNonBookWikiLinks(sourceTextForConvert);
    sourceTextForConvert = stripBrokenMarkdownMedia(sourceTextForConvert);
    if (bibliography) {
      sourceTextForConvert = normalizePandocCitationPageShorthand(sourceTextForConvert);
    }
  }
  // Ne pas passer `extract-media` : pandoc-wasm pré-remplit ce chemin comme *fichier* vide,
  // alors que Pandoc essaye d'y créer un répertoire → erreur WASI, stdout vide et aucun média.
  // Sans extraction, le writer Typst référence les chemins du Markdown (`image("…")`) ;
  // les octets fournis dans `extraFiles` sont fusionnés ci‑dessous dans `mediaFiles`.
  const options: Record<string, unknown> = {
    from,
    to: "typst",
    standalone: false,
  };
  const files: Record<string, string | Blob> = {};
  if (extraFiles) {
    for (const [k, v] of Object.entries(extraFiles)) files[k] = v;
  }
  for (const [k, bytes] of Object.entries(dataUriFiles)) {
    files[k] = new Blob([Uint8Array.from(bytes)]);
  }
  let stdin: string | null = sourceTextForConvert;
  if (!stdin && sourceBlob) {
    const ext = sourceFileName?.split(".").pop() || "md";
    const inputName = `input.${ext}`;
    files[inputName] = sourceBlob;
    options["input-files"] = [inputName];
    stdin = null;
  }
  if (bibliography) {
    options.citeproc = true;
    options.bibliography = bibliography.name;
    files[bibliography.name] = bibliography.blob;
    if (csl) {
      options.csl = csl.name;
      files[csl.name] = csl.blob;
    }
  }
  const result = await convert(options, stdin, files);
  let out = patchPandocTypstObbWikiRefs(
    patchPandocTypstMedia(patchPandocTypstFragments(result.stdout || "", markdownHorizontalRule)),
  );
  let stderr = result.stderr || "";
  if (bibliography && detectUnprocessedPandocCitations(out)) {
    stderr += "\n[obbwasm] citeproc : clés @… encore présentes dans le Typst (vérifiez le .bib).";
  } else if (!bibliography && detectUnprocessedPandocCitations(out)) {
    stderr +=
      "\n[obbwasm] Citations non formatées : renseignez le fichier .bib (paramètres plugin → Citations).";
  }
  out = injectTypstHeadingLabels(out);
  out = patchPandocTypstBrokenLabelRefs(out);
  const mediaFiles: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(result.mediaFiles ?? {})) {
    mediaFiles[k] = await toUint8Array(v);
  }
  if (extraFiles) {
    for (const [k, v] of Object.entries(extraFiles)) {
      if (!mediaFiles[k]) {
        mediaFiles[k] = await toUint8Array(v);
      }
    }
  }
  for (const [k, bytes] of Object.entries(dataUriFiles)) {
    if (!mediaFiles[k]) mediaFiles[k] = bytes;
  }
  if (!out.trim() && sourceTextForConvert.trim()) {
    return {
      typst: `= ${titleFallback}\n\n${sourceTextForConvert}`,
      stderr: (result.stderr || "") + "\n[obbwasm] Pandoc stdout vide, fallback Typst.",
      mediaFiles,
    };
  }
  return { typst: out, stderr, mediaFiles };
}

export async function compileTypstBookToPdf(params: {
  compiler: import("@myriaddreamin/typst.ts/compiler").TypstCompiler;
  loader: ObbWasmAssetLoader;
  templateMainSource: string;
  generatedTypst: string;
  bookLayout: BookLayoutState;
  meta: { title: string; author: string; publisher: string };
  /** Assets (images) à exposer au monde Typst. */
  mediaFiles?: Record<string, Uint8Array>;
  /** Télécharge les images http(s) référencées dans le Typst (plugin / navigateur). */
  fetchRemoteBytes?: (url: string) => Promise<Uint8Array | null>;
  /** Diagnostic virtualisation chemins (rempli si tableau fourni). */
  mediaDebugLog?: string[];
  /** Rapport d’étape (Pandoc, médias, Typst…) pour l’UI. */
  onCompilePhase?: (phase: string) => void;
  /** Délai max compilation Typst WASM (ms). 0 = illimité. */
  typstCompileTimeoutMs?: number;
  /** Pandoc WASM — requis pour générer glossaire / index depuis du Markdown. */
  pandocConvert?: PandocConvertFn;
  /** Contenu de la note « glossaire » (`# entrée` + définition). */
  glossaryMarkdown?: string | null;
  /** Contenu de la note « index » des noms (`# entrée` + notice). */
  nameIndexMarkdown?: string | null;
}): Promise<{ pdf: Uint8Array | null; diagnostics: unknown; stderrLog: string }> {
  const { compiler, loader, templateMainSource, bookLayout, meta, fetchRemoteBytes } = params;
  const phase = (msg: string) => params.onCompilePhase?.(msg);
  const virt = await virtualizeTypstMediaPaths({
    typst: params.generatedTypst,
    mediaFiles: { ...(params.mediaFiles ?? {}) },
    fetchBytes: fetchRemoteBytes,
    debugLog: params.mediaDebugLog,
  });
  await yieldToMainThread();
  phase("Préparation des médias…");
  const bibPos = String(params.bookLayout.values["bibliography-position"] ?? "none");
  const split = splitPandocTypstBodyAndBibliography(virt.typst);
  let contentTypst = virt.typst;
  let bibliographyTypst = "// Bibliographie Pandoc : vide (pas de liste citeproc).\n";
  if (split.bibliography) {
    if (bibPos === "none") {
      contentTypst = `${split.body}\n\n${split.bibliography}`;
    } else {
      contentTypst = split.body;
      bibliographyTypst = split.bibliography;
    }
  }
  const mediaFiles = virt.mediaFiles;
  let normDefaults = await loader.fetchTextFile(BOOK_OPTIONS_DEFAULTS_PATH);
  if (!normDefaults?.trim()) {
    normDefaults = await loader.fetchTextFile("typeset/typst/shared/book-options-defaults.typ");
  }
  if (!normDefaults?.trim()) {
    throw new Error(
      `Gabarit requis absent du bundle : ${BOOK_OPTIONS_DEFAULTS_PATH}. Extrayez le dossier typeset (fichiers .typ inclus).`,
    );
  }

  compiler.reset();
  compiler.resetShadow();

  await mountTypstPackagesFromLoader(compiler, loader);
  await mountTypstFontShadows(compiler, loader);
  for (const [rel, bytes] of Object.entries(mediaFiles ?? {})) {
    const norm = rel.replace(/\\/g, "/").replace(/^\/+/, "");
    if (!norm) continue;
    compiler.mapShadow(`/${norm}`, bytes);
  }

  const defaultsSrc = sanitizeTypstCompilerSource(String(normDefaults));
  const templateSrc = sanitizeTypstCompilerSource(templateMainSource);

  const hrMode = markdownHorizontalRuleFromBookValues(bookLayout.values);
  let glossaryTypst = "// Glossaire ObbWasm : vide.\n";
  let nameIndexTypst = "// Index des noms ObbWasm : vide.\n";
  if (params.pandocConvert) {
    phase("Glossaire / index…");
    const conv = params.pandocConvert;
    glossaryTypst = sanitizeTypstCompilerSource(
      await buildObbBackMatterTypstFragment({
        convert: conv,
        markdown: params.glossaryMarkdown,
        labelPrefix: "obb-gl-",
        markdownHorizontalRule: hrMode,
      }),
    );
    nameIndexTypst = sanitizeTypstCompilerSource(
      await buildObbBackMatterTypstFragment({
        convert: conv,
        markdown: params.nameIndexMarkdown,
        labelPrefix: "obb-ix-",
        markdownHorizontalRule: hrMode,
      }),
    );
  }
  await yieldToMainThread();
  phase("Liens internes…");

  const labelIds = collectTypstLabelIds(contentTypst, glossaryTypst, nameIndexTypst, bibliographyTypst);
  contentTypst = await patchPandocTypstBrokenLabelRefsAsync(contentTypst, labelIds);
  glossaryTypst = await patchPandocTypstBrokenLabelRefsAsync(glossaryTypst, labelIds);
  nameIndexTypst = await patchPandocTypstBrokenLabelRefsAsync(nameIndexTypst, labelIds);
  bibliographyTypst = await patchPandocTypstBrokenLabelRefsAsync(bibliographyTypst, labelIds);
  await yieldToMainThread();

  const contentSrc = sanitizeTypstCompilerSource(contentTypst);
  const bibSrc = sanitizeTypstCompilerSource(bibliographyTypst);

  compiler.addSource("/typeset/shared/book-options-defaults.typ", defaultsSrc);
  compiler.addSource("/typeset/typst/shared/book-options-defaults.typ", defaultsSrc);
  compiler.addSource("/template.typ", templateSrc);
  compiler.addSource("/content.typ", contentSrc);
  compiler.addSource("/obb-generated-bibliography.typ", bibSrc);
  compiler.addSource("/obb-generated-glossary.typ", glossaryTypst);
  compiler.addSource("/obb-generated-name-index.typ", nameIndexTypst);
  const resolvedStrings = resolveDocStrings(bookLayout.documentLang, bookLayout.stringOverrides);
  const optLines = buildTypstOptsLines(bookLayout, resolvedStrings, meta);
  compiler.addSource(
    "/main.typ",
    sanitizeTypstCompilerSource(
      [`#import "/template.typ": render`, ``, `#{`, `  let opts = (`, ...optLines, `  )`, `  render(opts)`, `}`].join("\n"),
    ),
  );

  await yieldToMainThread();
  phase("Typst (PDF)…");
  const typstTimeout = params.typstCompileTimeoutMs ?? 0;
  let compiled: { result?: Uint8Array; diagnostics?: unknown } | null | undefined;
  try {
    const runPdf = compiler.runWithWorld(
      {
        root: "/",
        mainFilePath: "/main.typ",
        inputs: {
          title: meta.title,
          author: meta.author,
        },
      },
      async (world) => world.pdf({ diagnostics: "unix" }),
    );
    compiled = (await (typstTimeout > 0
      ? withAsyncTimeout(runPdf, typstTimeout, "Compilation Typst")
      : runPdf)) as { result?: Uint8Array; diagnostics?: unknown };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      pdf: null,
      diagnostics: [{ message: msg }],
      stderrLog: msg,
    };
  }

  if (!compiled?.result) {
    return { pdf: null, diagnostics: compiled?.diagnostics ?? [], stderrLog: "" };
  }
  return {
    pdf: Uint8Array.from(compiled.result),
    diagnostics: compiled.diagnostics ?? [],
    stderrLog: "",
  };
}

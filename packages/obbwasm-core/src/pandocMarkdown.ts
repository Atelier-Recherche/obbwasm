import type { BookLayoutState } from "./bookOptions/types.js";
import { buildTypstOptsLines } from "./bookOptions/typstSerialize.js";
import { resolveDocStrings } from "./bookOptions/docStrings.js";
import { BOOK_OPTIONS_DEFAULTS_PATH, type ObbWasmAssetLoader } from "./assetLoader.js";
import { mountTypstPackagesFromLoader } from "./typstPackages.js";

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

export async function pandocMarkdownToTypst(params: {
  convert: PandocConvertFn;
  /** Pandoc `from` ; défaut `markdown` (plugin Obsidian). */
  sourceFormat?: string;
  sourceText: string;
  sourceBlob?: Blob | null;
  sourceFileName?: string;
  titleFallback: string;
  bibliography?: { name: string; blob: Blob } | null;
}): Promise<{ typst: string; stderr: string }> {
  const { convert, sourceFormat = "md", sourceText, sourceBlob, sourceFileName, titleFallback, bibliography } = params;
  const from =
    sourceFormat === "md"
      ? "markdown"
      : sourceFormat === "txt"
        ? "plain"
        : sourceFormat;
  const options: Record<string, unknown> = {
    from,
    to: "typst",
    standalone: false,
  };
  const files: Record<string, string | Blob> = {};
  let stdin: string | null = sourceText;
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
  }
  const result = await convert(options, stdin, files);
  const out = result.stdout || "";
  if (!out.trim() && sourceText.trim()) {
    return {
      typst: `= ${titleFallback}\n\n${sourceText}`,
      stderr: (result.stderr || "") + "\n[obbwasm] Pandoc stdout vide, fallback Typst.",
    };
  }
  return { typst: out, stderr: result.stderr || "" };
}

export async function compileTypstBookToPdf(params: {
  compiler: import("@myriaddreamin/typst.ts/compiler").TypstCompiler;
  loader: ObbWasmAssetLoader;
  templateMainSource: string;
  generatedTypst: string;
  bookLayout: BookLayoutState;
  meta: { title: string; author: string; publisher: string };
}): Promise<{ pdf: Uint8Array | null; diagnostics: unknown; stderrLog: string }> {
  const { compiler, loader, templateMainSource, generatedTypst, bookLayout, meta } = params;
  const normDefaults = await loader.fetchTextFile(BOOK_OPTIONS_DEFAULTS_PATH);

  compiler.reset();
  compiler.resetShadow();

  await mountTypstPackagesFromLoader(compiler, loader);

  if (normDefaults) {
    compiler.addSource("/typeset/typst/shared/book-options-defaults.typ", String(normDefaults));
  }

  compiler.addSource("/template.typ", templateMainSource);
  compiler.addSource("/content.typ", generatedTypst);
  const resolvedStrings = resolveDocStrings(bookLayout.documentLang, bookLayout.stringOverrides);
  const optLines = buildTypstOptsLines(bookLayout, resolvedStrings, meta);
  compiler.addSource(
    "/main.typ",
    [`#import "/template.typ": render`, ``, `#{`, `  let opts = (`, ...optLines, `  )`, `  render(opts)`, `}`].join("\n"),
  );

  const compiled = await compiler.runWithWorld(
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

  if (!compiled?.result) {
    return { pdf: null, diagnostics: compiled?.diagnostics ?? [], stderrLog: "" };
  }
  return {
    pdf: Uint8Array.from(compiled.result),
    diagnostics: compiled.diagnostics ?? [],
    stderrLog: "",
  };
}

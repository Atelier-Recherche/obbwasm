import { buildTypstOptsLines } from "./bookOptions/typstSerialize.js";
import { resolveDocStrings } from "./bookOptions/docStrings.js";
import { BOOK_OPTIONS_DEFAULTS_PATH } from "./assetLoader.js";
import { mountTypstPackagesFromLoader } from "./typstPackages.js";
export async function pandocMarkdownToTypst(params) {
    const { convert, sourceFormat = "md", sourceText, sourceBlob, sourceFileName, titleFallback, bibliography } = params;
    const from = sourceFormat === "md"
        ? "markdown"
        : sourceFormat === "txt"
            ? "plain"
            : sourceFormat;
    const options = {
        from,
        to: "typst",
        standalone: false,
    };
    const files = {};
    let stdin = sourceText;
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
export async function compileTypstBookToPdf(params) {
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
    compiler.addSource("/main.typ", [`#import "/template.typ": render`, ``, `#{`, `  let opts = (`, ...optLines, `  )`, `  render(opts)`, `}`].join("\n"));
    const compiled = await compiler.runWithWorld({
        root: "/",
        mainFilePath: "/main.typ",
        inputs: {
            title: meta.title,
            author: meta.author,
        },
    }, async (world) => world.pdf({ diagnostics: "unix" }));
    if (!compiled?.result) {
        return { pdf: null, diagnostics: compiled?.diagnostics ?? [], stderrLog: "" };
    }
    return {
        pdf: Uint8Array.from(compiled.result),
        diagnostics: compiled.diagnostics ?? [],
        stderrLog: "",
    };
}
//# sourceMappingURL=pandocMarkdown.js.map
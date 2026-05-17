import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { execSync } from "child_process";
import { setImportWasmModule } from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler.mjs";
import { patchPandocTypstBrokenLabelRefs, collectTypstLabelIds } from "../packages/obbwasm-core/dist/pandocTypstLabels.js";
import { patchPandocTypstMedia } from "../packages/obbwasm-core/dist/pandocTypstMedia.js";
import { stripBrokenMarkdownMedia } from "../packages/obbwasm-core/dist/pandocTypstMedia.js";
import { OBB_PLACEHOLDER_PNG } from "../packages/obbwasm-core/dist/imageFormat.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const md = readFileSync(join(root, "Essais_science_1.md"), "utf8");

// preprocess like core (minimal)
let s = md;
const { extractMarkdownDataUriImages } = await import("../packages/obbwasm-core/dist/markdownDataUriImages.js");
const d = extractMarkdownDataUriImages(s);
s = d.markdown;
s = s.replace(/\[\[([^\]]+)\]\]/g, (f, inner, off, whole) =>
  whole.slice(off + f.length).startsWith("(") ? f : inner.trim(),
);
s = stripBrokenMarkdownMedia(s);

let t = Date.now();
let typst = execSync("pandoc -f markdown -t typst --standalone=false", {
  input: s,
  maxBuffer: 100 * 1024 * 1024,
  encoding: "utf8",
});
console.log("pandoc", Date.now() - t, "ms");

typst = patchPandocTypstMedia(typst);
const ids = collectTypstLabelIds(typst);
typst = patchPandocTypstBrokenLabelRefs(typst, ids);
console.log("#link empty", (typst.match(/#link\s*\(\s*""\s*\)/g) || []).length);
console.log("links left", (typst.match(/#link\(/g) || []).length);

const wasmPath = join(
  root,
  "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
);
const wasm = readFileSync(wasmPath);
setImportWasmModule(async () => wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));

const { createTypstCompiler } = await import("@myriaddreamin/typst.ts/compiler");
const compiler = createTypstCompiler();
await compiler.init({});

const tpl = readFileSync(join(root, "typeset/layout/Garamond-brsnoba5-layout.typ"), "utf8");
const defaults = readFileSync(join(root, "typeset/shared/book-options-defaults.typ"), "utf8");

compiler.reset();
compiler.resetShadow();
for (const [k, bytes] of Object.entries(d.files)) {
  compiler.mapShadow(`/${k}`, bytes);
  compiler.mapShadow(k, bytes);
}
for (const m of typst.matchAll(/image\s*\(\s*"([^"]+)"/g)) {
  const p = m[1];
  if (!p.startsWith("/")) compiler.mapShadow(p, OBB_PLACEHOLDER_PNG);
}

compiler.addSource("/typeset/shared/book-options-defaults.typ", defaults);
compiler.addSource("/template.typ", tpl);
compiler.addSource("/content.typ", typst);
compiler.addSource("/obb-generated-bibliography.typ", "// empty\n");
compiler.addSource("/obb-generated-glossary.typ", "// empty\n");
compiler.addSource("/obb-generated-name-index.typ", "// empty\n");
compiler.addSource(
  "/main.typ",
  `#import "/template.typ": render
#{
  render((
    title: "Test",
    author: "Test",
    publisher: "",
    toc-position: "none",
    bibliography-position: "none",
    show-glossary: false,
    show-index: false,
    cover-page: false,
    half-title-page: false,
    title-page: false,
  ))
}`,
);

console.log("typst Garamond compile…");
t = Date.now();
try {
  const compiled = await compiler.runWithWorld(
    { root: "/", mainFilePath: "/main.typ", inputs: { title: "T", author: "A" } },
    async (world) => world.pdf({ diagnostics: "unix" }),
  );
  console.log(compiled?.result ? `OK ${Date.now() - t} ms pdf ${compiled.result.length}` : `FAIL ${Date.now() - t} ms`, compiled?.diagnostics);
} catch (e) {
  console.log("ERR", Date.now() - t, e);
}

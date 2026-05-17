import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { setImportWasmModule } from "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const wasmPath = join(
  root,
  "node_modules/@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler_bg.wasm",
);

const content = readFileSync(join(root, "_essais_content.typ"), "utf8");
console.log("content.typ", content.length, "chars");

const wasm = readFileSync(wasmPath);
setImportWasmModule(async () => wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));

const { createTypstCompiler } = await import("@myriaddreamin/typst.ts/compiler");
const compiler = createTypstCompiler();
await compiler.init({});

compiler.reset();
compiler.resetShadow();
compiler.addSource(
  "/main.typ",
  `#set page(paper: "a5", margin: 2cm)
#set text(size: 9pt)
#include "/content.typ"
`,
);
compiler.addSource("/content.typ", content);

console.log("Typst compile start…");
const t0 = Date.now();
const compiled = await compiler.runWithWorld(
  { root: "/", mainFilePath: "/main.typ", inputs: {} },
  async (world) => world.pdf({ diagnostics: "unix" }),
);
const ms = Date.now() - t0;
if (compiled?.result) {
  console.log("OK", ms, "ms", "pdf bytes", compiled.result.length);
} else {
  console.log("FAIL", ms, "ms", JSON.stringify(compiled?.diagnostics)?.slice(0, 500));
}

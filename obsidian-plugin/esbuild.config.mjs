import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootNodeModules = path.join(__dirname, "..", "node_modules");
const pandocCoreAbs = path.join(rootNodeModules, "pandoc-wasm", "src", "core.js");
/** Évite wasm-pack-shim.mjs qui ré-enregistre import('fs') sous Electron (Obsidian). */
const typstWasmCoreAbs = path.join(
  rootNodeModules,
  "@myriaddreamin",
  "typst-ts-web-compiler",
  "pkg",
  "typst_ts_web_compiler.mjs",
);
if (!fs.existsSync(pandocCoreAbs)) {
  throw new Error(`pandoc core introuvable : ${pandocCoreAbs}`);
}
if (!fs.existsSync(typstWasmCoreAbs)) {
  throw new Error(`typst wasm pkg introuvable : ${typstWasmCoreAbs}`);
}

await esbuild.build({
  entryPoints: [path.join(__dirname, "src/main.ts")],
  bundle: true,
  outfile: path.join(__dirname, "main.js"),
  platform: "browser",
  format: "cjs",
  target: "es2022",
  sourcemap: "inline",
  external: ["obsidian"],
  logLevel: "info",
  plugins: [
    {
      name: "resolve-pandoc-core",
      setup(build) {
        build.onResolve({ filter: /^pandoc-wasm\/src\/core\.js$/ }, () => ({
          path: pandocCoreAbs,
        }));
      },
    },
    {
      name: "resolve-typst-wasm-no-node-shim",
      setup(build) {
        build.onResolve({ filter: /^@myriaddreamin\/typst-ts-web-compiler$/ }, () => ({
          path: typstWasmCoreAbs,
        }));
      },
    },
  ],
});

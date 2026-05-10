import * as esbuild from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootNodeModules = path.join(__dirname, "..", "node_modules");
const pandocCoreAbs = path.join(rootNodeModules, "pandoc-wasm", "src", "core.js");
if (!fs.existsSync(pandocCoreAbs)) {
  throw new Error(`pandoc core introuvable : ${pandocCoreAbs}`);
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
  ],
});

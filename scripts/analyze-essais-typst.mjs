import { readFileSync, writeFileSync } from "fs";
import { execSync } from "child_process";

const md = readFileSync("Essais_science_1.md", "utf8");
let s = md.replace(/!\[([^\]]*)\]\(\s*data:image\/[^)]+\)/gi, "![x](obb.png)");
s = s.replace(/\[\[([^\]]+)\]\]/g, (f, inner, off, whole) =>
  whole.slice(off + f.length).startsWith("(") ? f : inner.trim(),
);
const typst = execSync("pandoc -f markdown -t typst --standalone=false", {
  input: s,
  maxBuffer: 100 * 1024 * 1024,
  encoding: "utf8",
});
const headingLabels = [...typst.matchAll(/\] <([a-zA-Z0-9_.-]+)>/g)].map((m) => m[1]);
const linkSlugs = [...typst.matchAll(/#link\(<([^>]+)>/g)].map((m) => m[1]);
const defined = new Set(headingLabels);
const missing = linkSlugs.filter((x) => !defined.has(x));
console.log("typst chars", typst.length);
console.log("defined labels", defined.size);
console.log("links", linkSlugs.length);
console.log("missing links", missing.length);
console.log("missing sample", [...new Set(missing)].slice(0, 15));
writeFileSync("_essais_content.typ", typst);

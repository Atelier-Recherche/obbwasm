import { readFileSync } from "fs";
import { execSync } from "child_process";
import { extractMarkdownDataUriImages } from "../packages/obbwasm-core/dist/markdownDataUriImages.js";
import { patchPandocTypstBrokenLabelRefs, collectTypstLabelIds } from "../packages/obbwasm-core/dist/pandocTypstLabels.js";
import { patchPandocTypstMedia } from "../packages/obbwasm-core/dist/pandocTypstMedia.js";

let s = readFileSync("Essais_science_1.md", "utf8");
const d = extractMarkdownDataUriImages(s);
s = d.markdown;
s = s.replace(/\[\[([^\]]+)\]\]/g, (f, inner, off, whole) =>
  whole.slice(off + f.length).startsWith("(") ? f : inner.trim(),
);
let typst = execSync("pandoc -f markdown -t typst --standalone=false", {
  input: s,
  maxBuffer: 100 * 1024 * 1024,
  encoding: "utf8",
});
typst = patchPandocTypstMedia(typst);
typst = patchPandocTypstBrokenLabelRefs(typst, collectTypstLabelIds(typst));
const lines = typst.split("\n");
for (let i = 55; i < 72; i++) console.log(`${i + 1}:`, lines[i]);
console.log("empty image", (typst.match(/image\s*\(\s*""\s*\)/g) || []).length);
console.log("decode", (typst.match(/image\.decode/g) || []).length);
console.log("link empty", (typst.match(/#link\s*\(\s*""\s*\)/g) || []).length);

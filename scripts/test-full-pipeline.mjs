import { readFileSync } from "fs";
import { execSync } from "child_process";
import { extractMarkdownDataUriImages } from "../packages/obbwasm-core/dist/markdownDataUriImages.js";
import { stripNonBookWikiLinks } from "../packages/obbwasm-core/dist/pandocTypstLabels.js";
import { stripBrokenMarkdownMedia } from "../packages/obbwasm-core/dist/pandocTypstMedia.js";
function normalizeWikiImagesForPandoc(markdown) {
  return markdown.replace(/!\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, (_, path) => `![](${path.trim()})`);
}
import { normalizeWikiGlossaryIndexLinks } from "../packages/obbwasm-core/dist/wikiGlossaryIndex.js";
import { patchPandocTypstMedia } from "../packages/obbwasm-core/dist/pandocTypstMedia.js";

let s = readFileSync("Essais_science_1.md", "utf8");
const d = extractMarkdownDataUriImages(s);
s = d.markdown;
s = normalizeWikiImagesForPandoc(s);
s = normalizeWikiGlossaryIndexLinks(s);
s = stripNonBookWikiLinks(s);
s = stripBrokenMarkdownMedia(s);
console.log("empty md links", (s.match(/\]\(\s*\)/g) || []).length);
let typst = execSync("pandoc -f markdown -t typst --standalone=false", {
  input: s,
  maxBuffer: 100 * 1024 * 1024,
  encoding: "utf8",
});
typst = patchPandocTypstMedia(typst);
console.log("#link empty", (typst.match(/#link\s*\(\s*""\s*\)/g) || []).length);

import { readFileSync } from "fs";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

async function texts(pdfPath) {
  const data = new Uint8Array(readFileSync(pdfPath));
  const doc = await getDocument({ data, useSystemFonts: true, disableFontFace: true }).promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  const items = tc.items
    .map((i) => ({ t: i.str.trim(), x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) }))
    .filter((i) => i.t);
  console.log(pdfPath, "page1:", items);
}

await texts("_test_slot-fn.pdf");
await texts("_test_inline.pdf");

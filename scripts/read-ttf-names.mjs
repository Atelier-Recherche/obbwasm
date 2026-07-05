import { readFileSync } from "fs";

function readNames(p) {
  const b = readFileSync(p);
  const numTables = b.readUInt16BE(4);
  let nameOffset = 0;
  for (let i = 0; i < numTables; i++) {
    const off = 12 + i * 16;
    if (b.toString("ascii", off, off + 4) === "name") {
      nameOffset = b.readUInt32BE(off + 8);
      break;
    }
  }
  const count = b.readUInt16BE(nameOffset + 2);
  const stringOffset = b.readUInt16BE(nameOffset + 4) + nameOffset;
  const labels = { 1: "family", 2: "subfamily", 4: "full", 16: "typoFamily", 17: "typoSubfamily" };
  const out = {};
  for (let i = 0; i < count; i++) {
    const rec = nameOffset + 6 + i * 12;
    const platform = b.readUInt16BE(rec);
    const nameId = b.readUInt16BE(rec + 6);
    const len = b.readUInt16BE(rec + 8);
    const off = b.readUInt16BE(rec + 10) + stringOffset;
    if (platform === 3 && labels[nameId]) {
      out[labels[nameId]] = b.toString("utf16le", off, off + len).replace(/\0/g, "");
    }
  }
  return out;
}

for (const f of [
  "typeset/fonts/FeFCrm2.ttf",
  "typeset/fonts/FeFCit2.ttf",
  "typeset/fonts/FeENsc2.ttf",
]) {
  console.log(f, readNames(f));
}

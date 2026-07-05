/** Spec parsée depuis le nom du fichier imposition (ex. ...-4spread.typ). */
export type ImpositionTemplateSpec = {
  packetSize: number;
  kind: "signature" | "spread";
};

/** Géométrie lue dans le bloc `@obbwasm-meta` du gabarit `.typ`. */
export type ImpositionLayout = {
  mode: "signature-2up" | "signature-grid" | "spread-pair";
  packetSize: number;
  sheetWidth: string;
  sheetHeight: string;
  cellWidth: string;
  cellHeight: string;
  gridCols: number;
  gridRows: number;
  /** Décalage vertical de la 2e rangée (ex. `-0.4mm` pour calage A3). */
  gridRow2DyOffset: string;
};

type GridSlotDef = {
  xMm: number;
  yMm: number;
  packIndex: number;
  flip: boolean;
};

export function parseImpositionTemplateSpec(path: string): ImpositionTemplateSpec | null {
  const m = path.match(/(\d+)(signature|spread)\.typ$/i);
  if (!m) return null;
  const packetSize = Number(m[1]);
  const kind = m[2].toLowerCase() as "signature" | "spread";
  if (!Number.isFinite(packetSize) || packetSize <= 0) return null;
  return { packetSize, kind };
}

/** Lit `imposition-mode`, dimensions et grille dans `@obbwasm-meta`. */
export function parseImpositionMeta(source: string): ImpositionLayout | null {
  const block = source.match(/\/\/ @obbwasm-meta begin([\s\S]*?)\/\/ @obbwasm-meta end/);
  if (!block) return null;
  const kv: Record<string, string> = {};
  for (const line of block[1].split(/\r?\n/)) {
    const m = line.match(/^\s*\/\/\s*([\w-]+):\s*(.+?)\s*$/);
    if (m) kv[m[1]] = m[2].trim();
  }
  const modeRaw = kv["imposition-mode"];
  if (!modeRaw) return null;
  const mode = modeRaw as ImpositionLayout["mode"];
  if (mode !== "signature-grid" && mode !== "signature-2up" && mode !== "spread-pair") return null;

  const num = (key: string, fallback: number) => {
    const v = kv[key];
    if (v == null) return fallback;
    const n = Number(String(v).replace(/mm$/i, ""));
    return Number.isFinite(n) ? n : fallback;
  };

  return {
    mode,
    packetSize: num("packet-size", 0),
    sheetWidth: kv["sheet-width"] ?? "297mm",
    sheetHeight: kv["sheet-height"] ?? "210mm",
    cellWidth: kv["cell-width"] ?? "148mm",
    cellHeight: kv["cell-height"] ?? "210mm",
    gridCols: num("grid-cols", 2),
    gridRows: num("grid-rows", 1),
    gridRow2DyOffset: kv["grid-row2-dy-offset"] ?? "0mm",
  };
}

export function reorderSpreadSequence(pages: number[]): number[] {
  const out: number[] = [];
  let i = 0;
  let j = pages.length - 1;
  while (i <= j) {
    out.push(pages[i]);
    if (i !== j) out.push(pages[j]);
    i += 1;
    j -= 1;
  }
  return out;
}

export function chunkArray<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function parseMm(value: string): number {
  const n = Number(String(value).replace(/mm$/i, "").trim());
  return Number.isFinite(n) ? n : 0;
}

/** Placement des pages dans une grille cahier (indices 0-based dans le paquet). */
function getSignatureGridSlotMap(cols: number, rows: number, packetSize: number): {
  front: GridSlotDef[];
  back: GridSlotDef[];
} {
  if (cols === 2 && rows === 2 && packetSize === 8) {
    return {
      front: [
        { xMm: 0, yMm: 0, packIndex: 4, flip: true },
        { xMm: 1, yMm: 0, packIndex: 3, flip: true },
        { xMm: 0, yMm: 1, packIndex: 7, flip: false },
        { xMm: 1, yMm: 1, packIndex: 0, flip: false },
      ],
      back: [
        { xMm: 0, yMm: 0, packIndex: 2, flip: true },
        { xMm: 1, yMm: 0, packIndex: 5, flip: true },
        { xMm: 0, yMm: 1, packIndex: 1, flip: false },
        { xMm: 1, yMm: 1, packIndex: 6, flip: false },
      ],
    };
  }

  if (cols === 4 && rows === 2 && packetSize === 16) {
    const top = [4, 11, 8, 7];
    const bottom = [1, 12, 15, 0];
    const topBack = [6, 9, 10, 5];
    const bottomBack = [3, 14, 13, 2];
    const face = (indices: number[], flip: boolean, row: number): GridSlotDef[] =>
      indices.map((packIndex, col) => ({ xMm: col, yMm: row, packIndex, flip }));
    return {
      front: [...face(top, true, 0), ...face(bottom, false, 1)],
      back: [...face(topBack, true, 0), ...face(bottomBack, false, 1)],
    };
  }

  throw new Error(
    `Grille signature ${cols}x${rows} pour paquet ${packetSize} non supportee (modes generiques a etendre).`,
  );
}

function buildSignatureGridImpositionTyp(layout: ImpositionLayout, packets: number[][]): string {
  const cols = layout.gridCols;
  const rowGutter =
    parseMm(layout.gridRow2DyOffset) !== 0 ? layout.gridRow2DyOffset : "0pt";
  const colDefs = Array.from({ length: cols }, () => layout.cellWidth).join(", ");

  const map = getSignatureGridSlotMap(cols, layout.gridRows, layout.packetSize);

  const renderCell = (pageNum: number, flip: boolean): string => {
    if (pageNum <= 0) {
      return `box(width: cell-w, height: cell-h)[]`;
    }
    if (flip) {
      return [
        `box(width: cell-w, height: cell-h, clip: true)[`,
        `  #align(center + horizon)[`,
        `    #rotate(180deg, image(source-pdf, page: ${pageNum}, width: cell-w, height: cell-h, fit: "contain"))`,
        `  ]`,
        `]`,
      ].join("\n");
    }
    return [
      `box(width: cell-w, height: cell-h, clip: true)[`,
      `  #image(source-pdf, page: ${pageNum}, width: cell-w, height: cell-h, fit: "contain")`,
      `]`,
    ].join("\n");
  };

  const lines: string[] = [
    `#let source-pdf = "export.pdf"`,
    `#let cell-w = ${layout.cellWidth}`,
    `#let cell-h = ${layout.cellHeight}`,
    `#let sheet-w = ${layout.sheetWidth}`,
    `#let sheet-h = ${layout.sheetHeight}`,
    `#set page(width: sheet-w, height: sheet-h, margin: 0mm)`,
  ];

  const pageAt = (arr: number[], idx: number): number => arr[idx] ?? 0;

  const gridOrder = (face: GridSlotDef[]) =>
    [...face].sort((a, b) => a.yMm - b.yMm || a.xMm - b.xMm);

  const emitFace = (pack: number[], face: GridSlotDef[], alignRight: boolean) => {
    const ordered = gridOrder(face);
    if (alignRight) {
      lines.push(`#align(right)[`);
    }
    lines.push(`#grid(`);
    lines.push(`  columns: (${colDefs}),`);
    lines.push(`  column-gutter: 0pt,`);
    lines.push(`  row-gutter: ${rowGutter},`);
    for (const s of ordered) {
      const pg = pageAt(pack, s.packIndex);
      lines.push(`  ${renderCell(pg, s.flip)},`);
    }
    lines.push(`)`);
    if (alignRight) {
      lines.push(`]`);
    }
  };

  packets.forEach((pack, idx) => {
    emitFace(pack, map.front, false);
    lines.push(`#pagebreak()`);
    emitFace(pack, map.back, true);
    if (idx !== packets.length - 1) lines.push(`#pagebreak()`);
  });

  return lines.join("\n");
}

export function buildImpositionMainTyp(
  kind: "signature" | "spread",
  packetSize: number,
  packets: number[][],
  compensationMm: number,
): string {
  if (packetSize % 4 !== 0 || packetSize <= 0) {
    throw new Error(`Template ${packetSize}${kind} non supporte (taille de paquet multiple de 4 requise).`);
  }
  const lines: string[] = [
    `#let source-pdf = "export.pdf"`,
    `#let compensation = ${compensationMm}mm`,
    `#set page(width: 297mm, height: 210mm, margin: 0mm)`,
    `#let render-page(page-num, width: 143.5mm) = {`,
    `  if page-num <= 0 {`,
    `    box(width: width, height: 210mm)[]`,
    `  } else {`,
    `    image(source-pdf, page: page-num, width: width)`,
    `  }`,
    `}`,
    `#let pair(left-page, right-page) = [`,
    `  #place(left + top, render-page(left-page))`,
    `  #place(left + top, dx: 143.5mm + compensation, dy: 0mm, render-page(right-page))`,
    `]`,
    `#let side(left-page, right-page, left-align: true) = {`,
    `  if left-align [`,
    `    #place(left + top, render-page(left-page, width: 148mm))`,
    `    #place(left + top, dx: 148mm, dy: 0mm, render-page(right-page, width: 148mm))`,
    `  ] else [`,
    `    #place(right + top, dx: -296mm, dy: 0mm, render-page(left-page, width: 148mm))`,
    `    #place(right + top, dx: -148mm, dy: 0mm, render-page(right-page, width: 148mm))`,
    `  ]`,
    `}`,
  ];

  const pageAt = (arr: number[], idx: number): number => arr[idx] ?? 0;

  packets.forEach((pack, idx) => {
    if (kind === "spread") {
      for (let base = 0; base < packetSize; base += 4) {
        const p1 = pageAt(pack, base + 0);
        const p2 = pageAt(pack, base + 1);
        const p3 = pageAt(pack, base + 2);
        const p4 = pageAt(pack, base + 3);
        lines.push(`#pair(${p2}, ${p1})`);
        lines.push(`#pagebreak()`);
        lines.push(`#pair(${p3}, ${p4})`);
        if (base + 4 < packetSize) lines.push(`#pagebreak()`);
      }
    } else {
      const sheets = packetSize / 4;
      for (let s = 0; s < sheets; s += 1) {
        const frontLeft = pageAt(pack, packetSize - 1 - 2 * s);
        const frontRight = pageAt(pack, 2 * s);
        const backLeft = pageAt(pack, 2 * s + 1);
        const backRight = pageAt(pack, packetSize - 2 - 2 * s);
        lines.push(`#side(${frontLeft}, ${frontRight}, left-align: true)`);
        lines.push(`#pagebreak()`);
        lines.push(`#side(${backLeft}, ${backRight}, left-align: false)`);
        if (s + 1 < sheets) lines.push(`#pagebreak()`);
      }
    }
    if (idx !== packets.length - 1) lines.push(`#pagebreak()`);
  });
  return lines.join("\n");
}

/** Choisit le générateur selon le meta du gabarit (pas de nom de format hardcodé). */
export function buildImpositionTyp(params: {
  layout: ImpositionLayout | null;
  kind: "signature" | "spread";
  packetSize: number;
  packets: number[][];
  compensationMm: number;
}): string {
  const { layout, kind, packetSize, packets, compensationMm } = params;
  const effectivePacket = layout?.packetSize && layout.packetSize > 0 ? layout.packetSize : packetSize;

  if (layout?.mode === "signature-grid") {
    const gridLayout = { ...layout, packetSize: effectivePacket };
    if (gridLayout.gridCols * gridLayout.gridRows * 2 !== effectivePacket) {
      throw new Error(
        `Grille ${gridLayout.gridCols}x${gridLayout.gridRows} incompatible avec paquet ${effectivePacket} pages.`,
      );
    }
    return buildSignatureGridImpositionTyp(gridLayout, packets);
  }

  const spreadKind = layout?.mode === "spread-pair" ? "spread" : kind;
  return buildImpositionMainTyp(spreadKind, effectivePacket, packets, compensationMm);
}

/** Grammes -> épaisseur feuille mm (même table que le site). */
export const PAPER_THICKNESS_MM: Record<number, number> = {
  80: 0.1,
  100: 0.12,
  120: 0.14,
};

export function spineThicknessMm(innerPages: number, grammage: number): number {
  const paperThickness = PAPER_THICKNESS_MM[grammage] ?? 0.1;
  return Number(((innerPages / 2) * paperThickness).toFixed(2));
}

export function parseImpositionTemplateSpec(path) {
    const m = path.match(/(\d+)(signature|spread)\.typ$/i);
    if (!m)
        return null;
    const packetSize = Number(m[1]);
    const kind = m[2].toLowerCase();
    if (!Number.isFinite(packetSize) || packetSize <= 0)
        return null;
    return { packetSize, kind };
}
export function reorderSpreadSequence(pages) {
    const out = [];
    let i = 0;
    let j = pages.length - 1;
    while (i <= j) {
        out.push(pages[i]);
        if (i !== j)
            out.push(pages[j]);
        i += 1;
        j -= 1;
    }
    return out;
}
export function chunkArray(arr, size) {
    const out = [];
    for (let i = 0; i < arr.length; i += size)
        out.push(arr.slice(i, i + size));
    return out;
}
/**
 * Paquets d’imposition à partir des pages 1..N.
 *
 * Spread (« à cheval ») : une seule brochure imbriquée (feuilles emboîtées).
 *   — blancs en fin pour atteindre un multiple de 4 (une feuille = 4 pages) ;
 *   — puis reorder global du bloc → ex. 5 pages → [1,□,2,□,3,□,4,5]
 *     donc première feuille □|1 / 2|□ (pas des cahiers 4|1 indépendants).
 *
 * Signature : cahiers séparés de `packetSize` pages (padding + découpe séquentielle ;
 *   le mapping left/right est dans buildImpositionMainTyp).
 */
export function buildImpositionPackets(kind, pages, packetSize) {
    if (kind === "spread") {
        const sheetUnit = 4;
        const missing = (sheetUnit - (pages.length % sheetUnit)) % sheetUnit;
        const padded = pages.concat(Array.from({ length: missing }, () => 0));
        return [reorderSpreadSequence(padded)];
    }
    const missing = (packetSize - (pages.length % packetSize)) % packetSize;
    const padded = pages.concat(Array.from({ length: missing }, () => 0));
    return chunkArray(padded, packetSize);
}
export function buildImpositionMainTyp(kind, packetSize, packets, compensationMm) {
    if (packetSize % 4 !== 0 || packetSize <= 0) {
        throw new Error(`Template ${packetSize}${kind} non supporte (taille de paquet multiple de 4 requise).`);
    }
    const lines = [
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
    const pageAt = (arr, idx) => arr[idx] ?? 0;
    packets.forEach((pack, idx) => {
        if (kind === "spread") {
            // Une brochure : autant de feuilles (4 pages) que pack.length / 4.
            for (let base = 0; base < pack.length; base += 4) {
                const p1 = pageAt(pack, base + 0);
                const p2 = pageAt(pack, base + 1);
                const p3 = pageAt(pack, base + 2);
                const p4 = pageAt(pack, base + 3);
                lines.push(`#pair(${p2}, ${p1})`);
                lines.push(`#pagebreak()`);
                lines.push(`#pair(${p3}, ${p4})`);
                if (base + 4 < pack.length)
                    lines.push(`#pagebreak()`);
            }
        }
        else {
            const sheets = packetSize / 4;
            for (let s = 0; s < sheets; s += 1) {
                const frontLeft = pageAt(pack, packetSize - 1 - 2 * s);
                const frontRight = pageAt(pack, 2 * s);
                const backLeft = pageAt(pack, 2 * s + 1);
                const backRight = pageAt(pack, packetSize - 2 - 2 * s);
                lines.push(`#side(${frontLeft}, ${frontRight}, left-align: true)`);
                lines.push(`#pagebreak()`);
                lines.push(`#side(${backLeft}, ${backRight}, left-align: false)`);
                if (s + 1 < sheets)
                    lines.push(`#pagebreak()`);
            }
        }
        if (idx !== packets.length - 1)
            lines.push(`#pagebreak()`);
    });
    return lines.join("\n");
}
/** Grammes -> épaisseur feuille mm (même table que le site). */
export const PAPER_THICKNESS_MM = {
    80: 0.1,
    100: 0.12,
    120: 0.14,
};
export function spineThicknessMm(innerPages, grammage) {
    const paperThickness = PAPER_THICKNESS_MM[grammage] ?? 0.1;
    return Number(((innerPages / 2) * paperThickness).toFixed(2));
}
//# sourceMappingURL=imposition.js.map
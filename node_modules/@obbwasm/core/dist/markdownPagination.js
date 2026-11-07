/** Préfixe d’id HTML/EPUB pour les ancres de pagination synchronisée PDF. */
export const OBB_PAG_ID_PREFIX = "obb-pag-";
/** Jeton texte extrait de la couche PDF (pdf.js) et présent dans le Markdown source. */
export const OBB_PAG_TOKEN_PREFIX = "OBBPAG";
export function obbPagId(n) {
    return `${OBB_PAG_ID_PREFIX}${n}`;
}
export function obbPagToken(n) {
    return `${OBB_PAG_TOKEN_PREFIX}${n}`;
}
/** Span Markdown (Pandoc) : texte jeton + id stable pour l’EPUB. */
export function obbPagMarkdownSpan(n) {
    return `[${obbPagToken(n)}]{#${obbPagId(n)}}`;
}
const FENCE_RE = /^(`{3,}|~{3,})/;
function isYamlFrontMatterStart(lines, index) {
    return index === 0 && lines[0]?.trim() === "---";
}
/**
 * Injecte des ancres `[OBBPAGn]{#obb-pag-n}` en tête de chaque titre ATX et paragraphe
 * (blocs séparés par une ligne vide). Ignore YAML front matter et fences de code.
 */
export function injectMarkdownPaginationAnchors(markdown) {
    if (!markdown)
        return { markdown: markdown || "", maxAnchor: 0 };
    const lines = markdown.split("\n");
    const out = [];
    let n = 0;
    let i = 0;
    let inFence = false;
    let fenceMarker = "";
    if (isYamlFrontMatterStart(lines, 0)) {
        out.push(lines[0]);
        i = 1;
        while (i < lines.length) {
            out.push(lines[i]);
            if (lines[i].trim() === "---") {
                i++;
                break;
            }
            i++;
        }
    }
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();
        if (!inFence) {
            const fence = trimmed.match(FENCE_RE);
            if (fence) {
                inFence = true;
                fenceMarker = fence[1][0];
                out.push(line);
                i++;
                continue;
            }
        }
        else {
            if (trimmed.startsWith(fenceMarker.repeat(3)) || FENCE_RE.test(trimmed)) {
                inFence = false;
                fenceMarker = "";
            }
            out.push(line);
            i++;
            continue;
        }
        if (!trimmed) {
            out.push(line);
            i++;
            continue;
        }
        // Bloc : titre ou paragraphe / liste / citation jusqu’à ligne vide ou fence.
        const blockLines = [];
        while (i < lines.length) {
            const L = lines[i];
            const t = L.trim();
            if (blockLines.length > 0 && !t)
                break;
            if (blockLines.length > 0 && FENCE_RE.test(t))
                break;
            blockLines.push(L);
            i++;
            if (/^#{1,6}\s/.test(t))
                break; // titre = un seul « bloc » ligne
        }
        const first = blockLines[0] ?? "";
        const firstTrim = first.trim();
        const already = firstTrim.includes(OBB_PAG_TOKEN_PREFIX) || /\{#[\w-]*obb-pag-\d+\}/.test(firstTrim);
        if (!already && firstTrim && !/^[-*_]{3,}$/.test(firstTrim)) {
            n += 1;
            const span = obbPagMarkdownSpan(n);
            if (/^#{1,6}\s/.test(firstTrim)) {
                // `# Titre` → `# [OBBPAG1]{#obb-pag-1} Titre`
                blockLines[0] = first.replace(/^(#{1,6}\s+)/, `$1${span} `);
            }
            else {
                const indent = first.match(/^\s*/)?.[0] ?? "";
                blockLines[0] = `${indent}${span}${first.slice(indent.length)}`;
            }
        }
        out.push(...blockLines);
    }
    return { markdown: out.join("\n"), maxAnchor: n };
}
/**
 * Adoucit les jetons OBBPAGn sans les sortir de la couche texte PDF.
 * Important : un texte trop petit / blanc (ex. 0.001pt) est souvent absent de
 * l’extraction pdf.js → page-list EPUB vide ou fausse.
 * Ces jetons ne sont injectés que pour le PDF intermédiaire de sync EPUB.
 */
export function hideTypstPaginationTokens(typst) {
    if (!typst || !typst.includes(OBB_PAG_TOKEN_PREFIX))
        return typst;
    const wrapPrefix = "#text(size: 1pt, fill: luma(92%))[";
    return typst.replace(new RegExp(`${OBB_PAG_TOKEN_PREFIX}(\\d+)`, "g"), (full, n, offset, s) => {
        if (offset >= wrapPrefix.length && s.slice(offset - wrapPrefix.length, offset) === wrapPrefix) {
            return full;
        }
        // Déjà enveloppé avec l’ancien style quasi invisible → remplacer.
        const oldPrefix = "#text(size: 0.001pt, fill: rgb(255, 255, 255))[";
        if (offset >= oldPrefix.length && s.slice(offset - oldPrefix.length, offset) === oldPrefix) {
            return full;
        }
        return `${wrapPrefix}${OBB_PAG_TOKEN_PREFIX}${n}]`;
    });
}
/**
 * Construit la carte ancre → numéro de page PDF à partir des textes page par page (pdf.js).
 * Le numéro de page est 1-based (comme `counter(page)` Typst).
 * Les espaces éventuellement insérés par la couche texte PDF sont ignorés.
 */
export function buildPageMapFromPdfTexts(pageTexts) {
    const map = new Map();
    // O B B P A G 1 2 toléré si pdf.js espace les glyphes.
    const re = /O\s*B\s*B\s*P\s*A\s*G\s*(\d+)/gi;
    for (let page = 0; page < pageTexts.length; page++) {
        const text = pageTexts[page] ?? "";
        re.lastIndex = 0;
        let m;
        while ((m = re.exec(text)) !== null) {
            const id = Number(m[1]);
            if (!Number.isFinite(id) || id <= 0)
                continue;
            if (!map.has(id))
                map.set(id, page + 1);
        }
    }
    return map;
}
//# sourceMappingURL=markdownPagination.js.map
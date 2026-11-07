/**
 * Aligne les coupures de page EPUB sur le début de chaque page du PDF
 * (y compris au milieu d’un paragraphe), une seule marque par n° de page.
 */
/** Compacte pour matching insensible espaces / tirets de coupure / casse. */
export function compactTextForPageAlign(s) {
    return s
        .normalize("NFKC")
        .replace(/\u00ad/g, "")
        .replace(/(\p{L})-\s+(\p{L})/gu, "$1$2")
        .toLowerCase()
        .replace(/[^\p{L}\p{N}]+/gu, "");
}
/**
 * Indexe le HTML : texte visible + carte compactIndex → offset HTML.
 * Ignore le contenu des balises.
 */
export function indexHtmlForPageAlign(html) {
    const compactChars = [];
    const compactToHtml = [];
    let i = 0;
    while (i < html.length) {
        if (html[i] === "<") {
            const close = html.indexOf(">", i);
            if (close === -1)
                break;
            // Ne pas indexer script/style
            const tag = html.slice(i, close + 1).toLowerCase();
            if (tag.startsWith("<script") || tag.startsWith("<style")) {
                const name = tag.startsWith("<script") ? "script" : "style";
                const end = html.toLowerCase().indexOf(`</${name}>`, close);
                i = end === -1 ? html.length : end + name.length + 3;
                continue;
            }
            i = close + 1;
            continue;
        }
        // entité basique
        if (html[i] === "&") {
            const semi = html.indexOf(";", i);
            if (semi !== -1 && semi - i < 12) {
                const ent = html.slice(i, semi + 1);
                let ch = "";
                if (ent === "&nbsp;" || ent === "&#160;")
                    ch = " ";
                else if (ent === "&amp;")
                    ch = "&";
                else if (ent === "&lt;")
                    ch = "<";
                else if (ent === "&gt;")
                    ch = ">";
                else if (ent === "&quot;")
                    ch = '"';
                else if (ent === "&apos;" || ent === "&#39;")
                    ch = "'";
                else if (/^&#\d+;$/.test(ent))
                    ch = String.fromCharCode(Number(ent.slice(2, -1)));
                else if (/^&#x[0-9a-f]+;$/i.test(ent))
                    ch = String.fromCharCode(parseInt(ent.slice(3, -1), 16));
                if (ch) {
                    const c = compactTextForPageAlign(ch);
                    for (let k = 0; k < c.length; k++) {
                        compactChars.push(c[k]);
                        compactToHtml.push(i);
                    }
                    i = semi + 1;
                    continue;
                }
            }
        }
        const c = compactTextForPageAlign(html[i]);
        for (let k = 0; k < c.length; k++) {
            compactChars.push(c[k]);
            compactToHtml.push(i);
        }
        i++;
    }
    return { compact: compactChars.join(""), compactToHtml };
}
/** Empreinte du début de page PDF (sans le n° de page courant collé en tête). */
export function pdfPageFingerprint(pageText, pageNumber, len = 64) {
    let t = pageText.normalize("NFKC");
    // pdf.js colle souvent le folio en tête : "2Derrida…" / "12technologie…"
    t = t.replace(new RegExp(`^\\s*${pageNumber}(?=\\D|$)`), "");
    // en-têtes très courts répétés en tête (une ligne de chiffres seuls)
    t = t.replace(/^\s*\d{1,3}\s*/, "");
    const compact = compactTextForPageAlign(t);
    if (compact.length <= len)
        return compact;
    return compact.slice(0, len);
}
/**
 * Calcule les offsets HTML où commencer chaque page PDF (recherche séquentielle).
 * @param pageNumberOffset — ajouter à l’index (0 → pages 1..n ; 5 → pages 6..)
 */
export function findPdfPageBreaksInHtml(html, pageTexts, pageNumberOffset = 0) {
    if (!html || !pageTexts.length)
        return [];
    const { compact, compactToHtml } = indexHtmlForPageAlign(html);
    const breaks = [];
    let searchFrom = 0;
    for (let p = 0; p < pageTexts.length; p++) {
        const pageNumber = pageNumberOffset + p + 1;
        let found = -1;
        for (const len of [72, 56, 40, 28, 20]) {
            const fp = pdfPageFingerprint(pageTexts[p] ?? "", pageNumber, len);
            if (fp.length < 12)
                continue;
            const idx = compact.indexOf(fp, searchFrom);
            if (idx !== -1) {
                found = idx;
                break;
            }
            if (len >= 40) {
                const longer = compactTextForPageAlign((pageTexts[p] ?? "").replace(new RegExp(`^\\s*${pageNumber}`), ""));
                if (longer.length > len + 20) {
                    const fp2 = longer.slice(15, 15 + len);
                    if (fp2.length >= 12) {
                        const idx2 = compact.indexOf(fp2, searchFrom);
                        if (idx2 !== -1) {
                            found = idx2;
                            break;
                        }
                    }
                }
            }
        }
        if (found === -1)
            continue;
        breaks.push({ page: pageNumber, htmlOffset: compactToHtml[found] ?? 0 });
        searchFrom = found + 8;
    }
    return breaks;
}
/** Insère les spans pagebreak (une fois par page) ; offsets du plus grand au plus petit. */
export function insertPageBreaksIntoHtml(html, breaks, makeSpan) {
    if (!breaks.length)
        return html;
    // dédupliquer : garder la première occurrence de chaque n°
    const seen = new Set();
    const unique = breaks.filter((b) => {
        if (seen.has(b.page))
            return false;
        seen.add(b.page);
        return true;
    });
    unique.sort((a, b) => b.htmlOffset - a.htmlOffset);
    let out = html;
    for (const b of unique) {
        const pos = Math.max(0, Math.min(b.htmlOffset, out.length));
        out = out.slice(0, pos) + makeSpan(b.page) + out.slice(pos);
    }
    return out;
}
//# sourceMappingURL=epubPageAlign.js.map
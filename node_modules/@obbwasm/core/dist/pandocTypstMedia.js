/**
 * Correctifs du writer Pandoc → Typst (images, liens vides) avant virtualisation des médias.
 */
function closeTypstBracketContent(s, openBracket) {
    let depth = 0;
    for (let i = openBracket; i < s.length; i++) {
        const c = s[i];
        if (c === "[")
            depth++;
        else if (c === "]") {
            depth--;
            if (depth === 0)
                return i;
        }
    }
    return -1;
}
function skipWs(s, i) {
    while (i < s.length && /\s/.test(s[i]))
        i++;
    return i;
}
/** `#link("")[#strong[…];]` — crochets imbriqués, non géré par une regex simple. */
function stripEmptyTypstUrlLinks(typst) {
    let s = typst;
    for (const needle of ['#link("")', "#link('')"]) {
        let out = "";
        let i = 0;
        while (i < s.length) {
            const start = s.indexOf(needle, i);
            if (start === -1) {
                out += s.slice(i);
                break;
            }
            out += s.slice(i, start);
            let p = start + needle.length;
            p = skipWs(s, p);
            if (s[p] === "[") {
                const close = closeTypstBracketContent(s, p);
                if (close !== -1) {
                    out += s.slice(p + 1, close);
                    p = close + 1;
                }
            }
            i = p;
        }
        s = out;
    }
    return s;
}
/** Retire les images / liens Markdown sans cible (évite `URL must not be empty` côté Typst). */
export function stripBrokenMarkdownMedia(markdown) {
    let s = markdown;
    s = s.replace(/!\[[^\]]*\]\(\s*\)/g, "");
    s = s.replace(/!\[\[\s*\]\]/g, "");
    s = s.replace(/\[\s*\]\(\s*\)/g, "");
    s = s.replace(/\[([^\]]+)\]\(\s*\)/g, "$1");
    s = s.replace(/<\s*>/g, "");
    return s;
}
/**
 * Pandoc récent : `image.decode(read("…"))` → `image("…")` (Typst 0.15+).
 * Supprime aussi les `image("")` / `#link("")` qui provoquent « URL must not be empty ».
 */
export function patchPandocTypstMedia(typst) {
    if (!typst)
        return typst;
    let s = typst;
    s = s.replace(/image\.decode\s*\(\s*read\s*\(\s*"([^"]*)"\s*,\s*encoding:\s*none\s*\)\s*\)/gi, (_, path) => (path.trim() ? `image("${path}")` : ""));
    s = s.replace(/image\.decode\s*\(\s*read\s*\(\s*'([^']*)'\s*,\s*encoding:\s*none\s*\)\s*\)/gi, (_, path) => (path.trim() ? `image('${path}')` : ""));
    s = s.replace(/image\.decode\s*\(\s*"([^"]*)"\s*\)/gi, (_, path) => path.trim() ? `image("${path}")` : "");
    s = s.replace(/image\.decode\s*\(\s*'([^']*)'\s*\)/gi, (_, path) => path.trim() ? `image('${path}')` : "");
    s = stripEmptyTypstUrlLinks(s);
    s = s.replace(/#box\s*\(\s*image\s*\(\s*""\s*\)\s*\)/g, "");
    s = s.replace(/#box\s*\(\s*image\s*\(\s*''\s*\)\s*\)/g, "");
    s = s.replace(/image\s*\(\s*""\s*\)/g, "");
    s = s.replace(/image\s*\(\s*''\s*\)/g, "");
    s = s.replace(/image\s*\(\s*path\s*:\s*""\s*\)/g, "");
    s = s.replace(/image\s*\(\s*path\s*:\s*''\s*\)/g, "");
    s = s.replace(/\n{3,}/g, "\n\n");
    return s;
}
//# sourceMappingURL=pandocTypstMedia.js.map
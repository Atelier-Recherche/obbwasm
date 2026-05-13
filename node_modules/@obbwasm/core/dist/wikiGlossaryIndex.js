function patchHr(typst, mode) {
    if (!typst.includes("horizontalrule"))
        return typst;
    const replacement = mode === "pagebreak" ? "#pagebreak()" : "#line(length: 100%, stroke: 0.55pt + luma(210))";
    return typst.replace(/#horizontalrule\s*\(\s*\)/g, replacement).replace(/#horizontalrule\b/g, replacement);
}
/**
 * Obsidian : `[[glossaire#ancre|affichage]]` ou `[[glossaire#ancre]]`
 * → lien Markdown analysé par Pandoc puis réécrit vers une cible Typst (`#link(label(...))[…]`).
 *
 * Note nommée « glossaire » (insensible à la casse) ; ancre = bloc après `# titre` dans glossaire.md.
 */
const RX_WIKI_GLOSS = /\[\[(glossaire)#([^\]|]+)(?:\|([^\]]+))?\]\]/gi;
/** Idem pour l’index des noms : note « index », fichier typique `index.md`. */
const RX_WIKI_NAME_INDEX = /\[\[(index)#([^\]|]+)(?:\|([^\]]+))?\]\]/gi;
/** Normalise une ancre / titre de section pour coïncider avec `[[…#ancre]]` (style Obsidian). */
export function slugifyObsidianAnchor(raw) {
    const s = raw
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9\-]/gi, "");
    return s || "section";
}
function escapeTypstLabelSlug(slug) {
    return slug.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
/**
 * Transforme les wikiliens glossaire / index en liens Markdown `obb-glossary:` / `obb-index:`
 * (schéma factice lu par Pandoc puis patché en Typst).
 */
export function normalizeWikiGlossaryIndexLinks(markdown) {
    let s = markdown;
    s = s.replace(RX_WIKI_GLOSS, (_m, _note, anchor, alias) => {
        const a = slugifyObsidianAnchor(anchor);
        const display = (alias ?? anchor).trim();
        return `[${display}](obb-glossary:${a})`;
    });
    s = s.replace(RX_WIKI_NAME_INDEX, (_m, _note, anchor, alias) => {
        const a = slugifyObsidianAnchor(anchor);
        const display = (alias ?? anchor).trim();
        return `[${display}](obb-index:${a})`;
    });
    return s;
}
/**
 * Remplace les `#link("obb-glossary:…")` / `#link("obb-index:…")` émis par Pandoc
 * par des liens vers des `#label` Typst (`obb-gl-*`, `obb-ix-*`).
 */
export function patchPandocTypstObbWikiRefs(typst) {
    if (!typst.includes("obb-glossary") && !typst.includes("obb-index"))
        return typst;
    let s = typst;
    s = s.replace(/#link\(\s*"obb-glossary:([^"]+)"\s*\)/g, (_, slug) => {
        const esc = escapeTypstLabelSlug(slug);
        return `#link(label("obb-gl-${esc}"))`;
    });
    s = s.replace(/#link\(\s*"obb-index:([^"]+)"\s*\)/g, (_, slug) => {
        const esc = escapeTypstLabelSlug(slug);
        return `#link(label("obb-ix-${esc}"))`;
    });
    return s;
}
/** Découpe un Markdown en sections niveau 1 (`# titre`). */
export function splitMarkdownH1Sections(md) {
    const text = md.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
    const lines = text.split("\n");
    const sections = [];
    let curTitle = null;
    let curBody = [];
    const flush = () => {
        if (curTitle !== null) {
            sections.push({ title: curTitle, body: curBody.join("\n").trim() });
        }
        curBody = [];
    };
    for (const line of lines) {
        const hm = line.match(/^#\s+(.+)$/);
        if (hm) {
            flush();
            curTitle = hm[1].trim();
        }
        else if (curTitle !== null) {
            curBody.push(line);
        }
    }
    flush();
    return sections;
}
function escapeTypstHeadingBracketContent(title) {
    return title.replace(/\\/g, "\\").replace(/\[/g, "\\[").replace(/\]/g, "\\]");
}
async function pandocBodyToTypstFragment(convert, body, markdownHorizontalRule) {
    const trimmed = body.trim();
    if (!trimmed)
        return "";
    const result = await convert({ from: "markdown", to: "typst", standalone: false }, trimmed, {});
    let out = patchHr(result.stdout || "", markdownHorizontalRule);
    out = patchPandocTypstObbWikiRefs(out);
    return out.trim();
}
/**
 * Fragment Typst pour le bloc glossaire ou index des noms (titres H2 + label + corps Pandoc).
 */
export async function buildObbBackMatterTypstFragment(params) {
    const md = params.markdown?.trim();
    if (!md)
        return "// Vide — aucune note source ou fichier absent.\n";
    const sections = splitMarkdownH1Sections(md);
    if (sections.length === 0)
        return "// Vide — aucune section `# titre` trouvée.\n";
    const chunks = [];
    for (const sec of sections) {
        const slug = slugifyObsidianAnchor(sec.title);
        const titleEsc = escapeTypstHeadingBracketContent(sec.title);
        const bodyTypst = await pandocBodyToTypstFragment(params.convert, sec.body, params.markdownHorizontalRule);
        chunks.push(`#heading(level: 2)[${titleEsc}]\n` +
            `#label("${params.labelPrefix}${slug}")\n` +
            `parbreak()\n` +
            bodyTypst +
            `\n#pagebreak()\n`);
    }
    return chunks.join("\n");
}
//# sourceMappingURL=wikiGlossaryIndex.js.map
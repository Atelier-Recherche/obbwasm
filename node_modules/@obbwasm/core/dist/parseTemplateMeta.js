import { BOOK_OPTION_BY_ID, BOOK_OPTIONS } from "./bookOptions/registry";
const EMPTY = {
    nomComplet: "",
    version: "",
    detail: "",
    format: "",
    supportedOptions: [],
};
/**
 * Extrait les métadonnées entre marqueurs :
 * // @obbwasm-meta begin
 * // nom-complet: ...
 * // version: v1.0
 * // detail: ...
 * // format: slug
 * // supported-options: cover-page, toc-position, …
 * // @obbwasm-meta end
 */
export function parseTemplateMeta(source) {
    const lines = source.split(/\r?\n/);
    let i = 0;
    for (; i < lines.length; i++) {
        if (lines[i].includes("@obbwasm-meta begin")) {
            i += 1;
            break;
        }
    }
    const out = { ...EMPTY };
    for (; i < lines.length; i++) {
        const line = lines[i];
        if (line.includes("@obbwasm-meta end"))
            break;
        const m = line.match(/^\/\/\s*([a-z-]+)\s*:\s*(.*)$/i);
        if (!m)
            continue;
        const key = m[1].toLowerCase();
        const val = m[2].trim();
        if (key === "nom-complet")
            out.nomComplet = val;
        else if (key === "version")
            out.version = val;
        else if (key === "detail")
            out.detail = val;
        else if (key === "format")
            out.format = val;
        else if (key === "supported-options") {
            out.supportedOptions = val
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean);
        }
    }
    return out;
}
/** Mot-clé réservé dans `supported-options: none` → aucune option livre dans l’UI. */
const SUPPORTED_OPTIONS_NONE = "none";
export function filterOptionIdsByTemplate(allIds, supportedOptions) {
    if (supportedOptions.length === 1 &&
        supportedOptions[0].toLowerCase() === SUPPORTED_OPTIONS_NONE) {
        return [];
    }
    if (supportedOptions.length === 0)
        return allIds;
    const allow = new Set(supportedOptions);
    return allIds.filter((id) => allow.has(id));
}
export function displayTitle(meta, fallbackName) {
    return meta.nomComplet.trim() || fallbackName;
}
/**
 * Compte pour pastille « X / Y » : Y = taille du registre ;
 * X = nombre d’options déclarées dans le gabarit (ids valides), ou tout le registre si la ligne est absente / vide.
 */
export function supportedOptionsBadgeCounts(meta) {
    const total = BOOK_OPTIONS.length;
    if (!meta || meta.supportedOptions.length === 0) {
        return { supported: total, total };
    }
    if (meta.supportedOptions.length === 1 &&
        meta.supportedOptions[0].toLowerCase() === SUPPORTED_OPTIONS_NONE) {
        return { supported: 0, total };
    }
    const valid = meta.supportedOptions.filter((id) => id in BOOK_OPTION_BY_ID);
    return { supported: valid.length, total };
}
//# sourceMappingURL=parseTemplateMeta.js.map
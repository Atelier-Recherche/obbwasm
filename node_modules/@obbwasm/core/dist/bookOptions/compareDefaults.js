import { defaultBookValues } from "./defaults.js";
/** Indique si la valeur courante diffère du registre des défauts pour cette option. */
export function isBookOptionValueNonDefault(def, current) {
    const defaults = defaultBookValues();
    const d = defaults[def.id];
    if (d === undefined)
        return false;
    if (def.kind === "bool") {
        return (current === true) !== (d === true);
    }
    return String(current ?? "") !== String(d);
}
/** Nombre d’options dans `defs` dont la valeur n’est pas celle par défaut. */
export function countBookOptionsNonDefaultInDefs(defs, values) {
    return defs.reduce((n, def) => n + (isBookOptionValueNonDefault(def, values[def.id]) ? 1 : 0), 0);
}
/** Nombre de clés de `keys` pour lesquelles `overrides[k]` est non vide (après trim). */
export function countNonEmptyStringOverrides(overrides, keys) {
    let n = 0;
    for (const k of keys) {
        if ((overrides[k] ?? "").trim() !== "")
            n++;
    }
    return n;
}
//# sourceMappingURL=compareDefaults.js.map
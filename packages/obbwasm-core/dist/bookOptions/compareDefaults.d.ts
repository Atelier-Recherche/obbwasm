import type { BookOptionDef } from "./types.js";
/** Indique si la valeur courante diffère du registre des défauts pour cette option. */
export declare function isBookOptionValueNonDefault(def: BookOptionDef, current: boolean | string | undefined): boolean;
/** Nombre d’options dans `defs` dont la valeur n’est pas celle par défaut. */
export declare function countBookOptionsNonDefaultInDefs(defs: BookOptionDef[], values: Record<string, boolean | string>): number;
/** Nombre de clés de `keys` pour lesquelles `overrides[k]` est non vide (après trim). */
export declare function countNonEmptyStringOverrides(overrides: Record<string, string>, keys: readonly string[]): number;
//# sourceMappingURL=compareDefaults.d.ts.map
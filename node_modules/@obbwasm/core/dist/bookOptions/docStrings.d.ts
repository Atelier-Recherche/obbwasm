import type { DocumentLang } from "./types";
import type { StringOverrideKey } from "./registry";
/** Chaînes injectées dans Typst (fallback selon la langue du document). */
export declare function resolveDocStrings(documentLang: DocumentLang, overrides: Partial<Record<StringOverrideKey, string>>): Record<StringOverrideKey, string>;
//# sourceMappingURL=docStrings.d.ts.map
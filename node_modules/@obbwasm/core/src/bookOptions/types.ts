/** Langues UI et métadonnées document (Typst / chaînes). */
export type UiLocale = "fr" | "en" | "de" | "es";

export type DocumentLang = UiLocale;

/** Sections globales ordonnables (ids stables). */
export type SectionId =
  | "cover"
  | "titleCredits"
  | "toc"
  | "body"
  | "annexes"
  | "listFigures"
  | "bibliography"
  | "indexGlossary"
  | "backCover";

export type OptionKind = "bool" | "enum" | "string" | "color" | "number";

export type BookOptionDef = {
  id: string;
  kind: OptionKind;
  /** Clé principale dans le dict Typst `conf` (snake-kebab). */
  typstKey: string;
  /** Pour les enums : valeurs Typst (chaînes). */
  enumValues?: string[];
  /** Clé i18n sous options.<id>.label */
  labelKey: string;
  /** Clé racine pour les valeurs d'enum : options.<id>.values.<val> */
  enumValueKeys?: boolean;
  /** Surcharge texte pour label libre (clé dans stringOverrides). */
  stringOverrideKey?: string;
};

export type BookLayoutState = {
  documentLang: DocumentLang;
  /** Surcharges optionnelles pour les libellés document (clés = stringOverrideKey du registre). */
  stringOverrides: Record<string, string>;
  /** Sections actives dans l’ordre (sous-ensemble de SectionId). */
  sectionOrder: SectionId[];
  /** Valeurs par option id (bool, string pour enum/color). */
  values: Record<string, boolean | string>;
};

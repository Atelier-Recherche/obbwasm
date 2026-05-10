export type TemplatesManifestV1 = {
  version: 1;
  templates: Array<{
    id: string;
    name: string;
    mainTypPath: string;
    variables?: Record<string, string>;
  }>;
  /** ZIP contenant la racine du dépôt avec au minimum `typeset/`. */
  bundleZipUrl?: string;
};

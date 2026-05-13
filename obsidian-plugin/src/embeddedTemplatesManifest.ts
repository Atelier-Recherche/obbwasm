import type { TemplatesManifestV1 } from "./templatesManifest.js";

/** Liste des gabarits — identique à `templates-manifest.github.json` (hors réseau). */
export const EMBEDDED_TEMPLATES_MANIFEST: TemplatesManifestV1 = {
  version: 1,
  bundleZipUrl: "https://github.com/Atelier-Recherche/obbwasm/archive/refs/heads/main.zip",
  templates: [
    {
      id: "garamond-brsnoba5",
      name: "Garamond brSNOba5",
      mainTypPath: "typeset/typst/layout/Garamond-brsnoba5-layout.typ",
    },
    {
      id: "garamond-a4",
      name: "Garamond A4",
      mainTypPath: "typeset/typst/layout/Garamond-A4-layout.typ",
    },
    {
      id: "times-brsnoba5",
      name: "Times brSNOba5",
      mainTypPath: "typeset/typst/layout/Times-brsnoba5-layout.typ",
    },
    {
      id: "basic-test",
      name: "Basic test",
      mainTypPath: "typeset/typst/layout/Basic-test-layout.typ",
    },
  ],
};

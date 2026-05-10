// @obbwasm-meta begin
// nom-complet: Gabarit test minimal (sans police custom)
// version: v1.0
// detail: Validation pipeline Pandoc WASM → Typst WASM → PDF, B5 143.5×210 mm.
// format: basic-b5
// supported-options: none
// @obbwasm-meta end
//
// Template de test ultra basique (sans fonte custom).
// Objectif: valider le pipeline Pandoc WASM -> Typst WASM -> PDF.

#let render(_opts) = {
  set page(
    width: 143.5mm,
    height: 210mm,
    margin: (x: 18mm, top: 24mm, bottom: 22mm),
    numbering: "1",
  )

  // Pas de configuration de fonte: Typst utilise la fonte par défaut.
  set par(justify: false)

  [
    #include "content.typ"
  ]
}

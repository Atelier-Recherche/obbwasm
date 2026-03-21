// Equivalent Typst de Garamond-A4-layout.tex
// Variante A4 avec option d'affichage des numeros de page.

#import "../shared/layout-base.typ": apply-layout, default-config

#let conf = (
  ..default-config,
  font-family: "Garamond Premier Pro",
  font-size: 11pt,
  page-width: 210mm,
  page-height: 297mm,
  margin-x: 25mm,
  margin-top: 30mm,
  margin-bottom: 30mm,
  show-page-numbers: true,
)

#let render(opts) = {
  let merged = conf + opts
  apply-layout(merged, include("content.typ"))
}

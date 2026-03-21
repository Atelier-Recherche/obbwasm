// Equivalent Typst de Garamond-brsnoba5-layout.tex
// Parametres de controle exposes pour compatibilite avec l'ancien template.

#import "../shared/layout-base.typ": apply-layout, default-config

#let conf = (
  ..default-config,
  font-family: "Garamond Premier Pro",
  font-size: 9pt,
  page-width: 143.5mm,
  page-height: 210mm,
  margin-x: 18mm,
  margin-top: 24mm,
  margin-bottom: 22mm,
  section-new-page: false,
  toc-at-start: false,
  toc-at-end: false,
)

#let render(opts) = {
  let merged = conf + opts
  apply-layout(merged, include("content.typ"))
}

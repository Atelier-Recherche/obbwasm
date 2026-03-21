// Equivalent Typst de Times-brsnoba5-layout.tex
// Utilisation:
//   typst compile Times-brsnoba5-layout.typ
// Puis injecter le contenu dans `book-body` (future génération Pandoc -> Typst).

#import "../shared/layout-base.typ": apply-layout, default-config

#let conf = (
  ..default-config,
  font-family: "Times New Roman",
  font-size: 9pt,
  page-width: 143.5mm,
  page-height: 210mm,
  margin-x: 18mm,
  margin-top: 24mm,
  margin-bottom: 22mm,
)

#let render(opts) = {
  let merged = conf + opts
  apply-layout(merged, include("content.typ"))
}

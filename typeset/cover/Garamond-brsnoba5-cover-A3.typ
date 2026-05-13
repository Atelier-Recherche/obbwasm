// Port Typst de Garamond-brsnoba5-cover-A3.tex
// Couverture A3 paysage: 4e + tranche + 1ere de couverture.

#let title = "Titre"
#let author = "Auteur"
#let edition = "Edition"
#let spine-thickness = 8mm

#let panel-width = 143.5mm
#let panel-height = 210mm
#let margin-top = 10mm
#let margin-left = 10mm
#let bg = luma(90%)

#set page(width: 420mm, height: 297mm, margin: 0mm)
#set text(font: "Garamond Premier Pro", size: 12pt)

#box(width: 100%, height: 100%, [
  // Panneau gauche (4e de couverture)
  #place(left + top, rect(
    width: panel-width,
    height: panel-height,
    fill: bg,
    inset: 0pt,
    [
      #pad(left: margin-left, top: margin-top, [
        #align(center + top, [
          #text(size: 1.5em, title)
          #v(4mm)
          #author
        ])
      ])
    ],
  ))

  // Panneau droit (1ere de couverture)
  #place(
    left + top,
    dx: panel-width + spine-thickness,
    dy: 0mm,
    rect(
    width: panel-width,
    height: panel-height,
    fill: bg,
    inset: 0pt,
    [
      #pad(left: margin-left, top: margin-top, [
        #align(center + top, edition)
      ])
    ],
  ))
])

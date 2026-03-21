// Port Typst de brsnoba5-A4-4spread.tex
// Imposition fixe 4 pages pour mode "a cheval".

#let source-pdf = "export.pdf"
#let page-width = 143.5mm
#let page-height = 210mm
#let compensation = -1.10mm

#set page(width: 297mm, height: 210mm, margin: 0mm)

#let pair(left-page, right-page) = {
  box(width: 100%, height: 100%, [
    #place(left + top, image(source-pdf, page: left-page, width: page-width))
    #place(
      left + top,
      dx: page-width + compensation,
      dy: 0mm,
      image(source-pdf, page: right-page, width: page-width),
    )
  ])
}

#pair(2, 1)
#pagebreak()
#pair(3, 4)

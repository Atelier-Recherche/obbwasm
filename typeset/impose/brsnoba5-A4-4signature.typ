// Port Typst de brsnoba5-A4-4signature.tex
// Imposition fixe 4 pages en mode "signature".

#let source-pdf = "export.pdf"
#let block-width = 148mm
#let block-height = 143.5mm

#set page(width: 297mm, height: 210mm, margin: 0mm)

#let side(left-page, right-page, left-align: true) = {
  box(width: 100%, height: 100%, [
    #if left-align {
      #place(left + top, image(source-pdf, page: left-page, width: block-width))
      #place(
        left + top,
        dx: block-width,
        dy: 0mm,
        image(source-pdf, page: right-page, width: block-width),
      )
    } else {
      #place(
        right + top,
        dx: -2 * block-width,
        dy: 0mm,
        image(source-pdf, page: left-page, width: block-width),
      )
      #place(
        right + top,
        dx: -1 * block-width,
        dy: 0mm,
        image(source-pdf, page: right-page, width: block-width),
      )
    }
  ])
}

#side(4, 1, left-align: true)
#pagebreak()
#side(2, 3, left-align: false)

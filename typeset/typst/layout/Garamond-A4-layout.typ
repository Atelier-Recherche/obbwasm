// @obbwasm-meta begin
// nom-complet: Gabarits livre format A4 avec police Garamond
// version: v1.0
// detail: Mise en page A4 (210mm x 297mm), 11pt, marges élargies.
// format: garamond-a4
// supported-options: cover-page, half-title-page, title-page, toc-position, section-new-page, auto-heading-numbering
// @obbwasm-meta end
//
// Gabarit autonome — équivalent cible : Garamond-A4-layout.tex (A4, 11pt, marges élargies).
// Même logique fancyhdr / titlesec que Garamond-brsnoba5-layout.typ.
//
// LIMITES Typst vs LaTeX : voir Garamond-brsnoba5-layout.typ (commentaires LIMITES).

#let run-section-title = state("garamond-a4-section-mark", none)

#let default-config = (
  page-width: 210mm,
  page-height: 297mm,
  margin-x: 25mm,
  margin-top: 30mm,
  margin-bottom: 30mm,
  font-family: "Garamond Premier Pro",
  font-size: 11pt,
  line-spacing: 1.25em,
  show-page-numbers: true,
  cover-page: false,
  half-title-page: false,
  title-page: false,
  toc-at-start: false,
  toc-at-end: false,
  section-new-page: false,
  section-title-pad-top: 2cm,
  title: "Titre",
  author: "Auteur",
  edition: "Edition",
  cover-image: none,
  page-numbering-pattern: "1",
  heading-numbering: "none",
)

#let _front_half_title(conf) = {
  pagebreak()
  align(center + horizon, text(size: 1.6em, conf.title))
  pagebreak()
}

#let _front_title_page(conf) = {
  pagebreak()
  align(center + horizon, [
    #text(size: 1.6em, conf.title)
    #v(8mm)
    #if conf.cover-image != none [
      #image(conf.cover-image, width: 60%)
      #v(8mm)
    ]
    #conf.author
  ])
  pagebreak()
}

#let _page-margins(conf) = (
  x: conf.margin-x,
  top: conf.margin-top,
  bottom: conf.margin-bottom,
)

#let apply-layout(conf, body) = {
  set page(
    width: conf.page-width,
    height: conf.page-height,
    margin: _page-margins(conf),
    header: context {
      let p = counter(page).get().first()
      if p == 1 or not conf.show-page-numbers {
        []
      } else {
        let odd = calc.odd(p)
        let pg = text(size: 10pt, counter(page).display(conf.page-numbering-pattern))
        let run = run-section-title.get()
        let run-cell = if run == none { [] } else { run }
        grid(
          columns: (1fr, 1fr),
          column-gutter: 0.75em,
          if odd { align(left)[#pg] } else { align(left)[#run-cell] },
          if odd { align(right)[#run-cell] } else { align(right)[#pg] },
        )
      }
    },
    numbering: none,
  )

  set text(font: conf.font-family, size: conf.font-size)
  set par(leading: conf.line-spacing)

  if conf.heading-numbering == "none" {
    set heading(numbering: none)
  } else {
    set heading(numbering: conf.heading-numbering)
  }

  show footnote.entry: it => block(breakable: false, it)

  show heading.where(level: 1): it => {
    run-section-title.update(it.body)
    if conf.section-new-page {
      pagebreak(to: "odd", weak: true)
    }
    v(conf.section-title-pad-top)
    align(center, {
      set text(size: 1.35em)
      it
    })
    v(2em)
  }

  show heading.where(level: 2): it => {
    if conf.section-new-page {
      pagebreak()
    }
    block(above: 0.8em, below: 0.4em, {
      set text(weight: "bold")
      it
    })
  }

  show heading.where(level: 3): it => {
    block(above: 0.6em, below: 0.3em, emph(it))
  }

  if conf.cover-page {
    pagebreak()
    align(center + horizon, [
      #text(size: 1.8em, conf.title)
      #v(10mm)
      #conf.author
      #v(4mm)
      #conf.edition
    ])
    pagebreak()
  }
  if conf.half-title-page {
    _front_half_title(conf)
  }
  if conf.title-page {
    _front_title_page(conf)
  }
  if conf.toc-at-start {
    outline()
    pagebreak()
  }

  body

  if conf.toc-at-end {
    pagebreak()
    outline()
  }
}

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

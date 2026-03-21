// Base commune pour les templates de mise en page.
// Les paramètres sont pensés pour être injectés depuis JSON (future intégration React/PHP).

#let default-config = (
  page-width: 143.5mm,
  page-height: 210mm,
  margin-x: 18mm,
  margin-top: 24mm,
  margin-bottom: 22mm,
  font-family: "Garamond Premier Pro",
  font-size: 9pt,
  line-spacing: 1.25em,
  show-page-numbers: true,
  cover-page: false,
  half-title-page: false,
  title-page: false,
  toc-at-start: false,
  toc-at-end: false,
  section-new-page: false,
  title: "Titre",
  author: "Auteur",
  edition: "Edition",
  cover-image: none,
  // Style de numerotation des pages (voir reference Typst "numbering pattern")
  page-numbering-pattern: "1",
  // "none" = pas de numerotation de titres (comme \\setsecnumdepth{none} memoir)
  heading-numbering: "none",
  // Typst n'a pas d'equivalent exact a \\interfootnotelinepenalty: on force chaque
  // entree de note en bloc non fragmentable (effet proche pour notes courtes).
  prevent-footnote-break: false,
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

#let apply-layout(conf, body) = {
  set page(
    width: conf.page-width,
    height: conf.page-height,
    margin: (
      x: conf.margin-x,
      top: conf.margin-top,
      bottom: conf.margin-bottom,
    ),
    header: if conf.show-page-numbers {
      context {
        if counter(page).get().first() == 1 {
          []
        } else {
          align(center, text(size: 10pt, counter(page).display()))
        }
      }
    } else {
      none
    },
    numbering: none,
  )

  set text(
    font: conf.font-family,
    size: conf.font-size,
  )
  set par(leading: conf.line-spacing)
  set heading(numbering: none)

  show heading.where(level: 1): it => {
    if conf.section-new-page {
      pagebreak()
    }
    block(above: 2cm, below: 0.8em, align(center, text(size: 1.35em, it.body)))
  }
  show heading.where(level: 2): it => {
    if conf.section-new-page {
      pagebreak()
    }
    block(above: 0.8em, below: 0.4em, text(weight: "bold", it.body))
  }
  show heading.where(level: 3): it => {
    block(above: 0.6em, below: 0.3em, emph(it.body))
  }

  if conf.cover-page {
 
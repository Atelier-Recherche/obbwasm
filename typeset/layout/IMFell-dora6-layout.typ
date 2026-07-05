// @obbwasm-meta begin
// nom-complet: IMfrench Dora6 
// version: v1.0
// detail: Modèle 91.77mm x 148.5mm, titres FeENsc2, corps FeFCrm2 (9pt × 0.90).
// format: dora6
// supported-options: chapter-title-in-header, page-number-placement, page-number-style, auto-heading-numbering, line-spacing-preset, line-spacing-em, body-text-alignment, chapter-start-odd, binding-gutter-mm, half-title-page, title-page, front-title-recto-with-blank-before, section-new-page, hide-page-number-on-section-title, section-title-recto-with-blank-before, toc-position, toc-depth, bibliography-position, widows-orphans, show-index, show-glossary, show-annexes, show-back-cover
// @obbwasm-meta end

#import "/typeset/shared/book-options-defaults.typ": book-options-defaults

#let body-font = "IM FELL French Canon"
#let title-font = "IM FELL English"
#let header-font = "IM FELL French Canon"

// FeFCrm2 / FeFCit2 / FeFCrm2bold / FeFCit2bold — même famille, variantes via weight + style.
#let apply-dora-text-styles() = {
  set strong(delta: 0)
  show strong: set text(font: body-font, weight: "bold")
  show emph: set text(font: body-font, style: "italic")
}

#let _section-open-page(conf) = {
  if conf.section-title-recto-with-blank-before {
    // Équivalent LaTeX \sectionbreak : \clearpage puis verso blanc si besoin.
    pagebreak()
    if calc.even(counter(page).get().first()) {
      set page(header: [])
      pagebreak()
    }
    set page(header: [])
  } else {
    if conf.chapter-start-odd {
      let p0 = counter(page).get().first()
      if calc.even(p0) {
        pagebreak()
      }
    }
    if conf.section-new-page {
      pagebreak()
    }
  }
}

#let run-section-title = state("french-dora6-section-mark", none)

#let default-config = (
  ..book-options-defaults,
  page-width: 91.77mm,
  page-height: 148.5mm,
  margin-x: 12mm,
  margin-top: 20mm,
  margin-bottom: 12mm,
  font-family: body-font,
  font-size: 8.1pt,
  line-spacing: 1.2em,
  auto-break-long-tokens: true,
  auto-break-chunk-size: 24,
  section-title-pad-top: 2cm,
  title: "Titre",
  subtitle: "",
  author: "Auteur",
  edition: "Edition",
  cover-image: none,
  cover-page: false,
  half-title-page: false,
  title-page: true,
  front-title-recto-with-blank-before: false,
  section-title-recto-with-blank-before: true,
  hide-page-number-on-section-title: true,
  show-page-numbers: true,
  section-new-page: false,
  chapter-start-odd: true,
  chapter-title-in-header: true,
  page-number-placement: "outer",
  header-footer-rule: "none",
  heading-numbering: "none",
  h1-typography: "centered",
  section-order: ("titleCredits", "body"),
  toc-at-start: false,
  toc-at-end: false,
)

#let _line-leading(conf) = {
  if conf.line-spacing-preset == "narrow" { 1.05em }
  else if conf.line-spacing-preset == "wide" { 1.35em }
  else if conf.line-spacing-preset == "custom" { conf.line-spacing }
  else { conf.line-spacing }
}

#let _title-line(conf) = {
  let sub = conf.at("subtitle", default: "")
  if sub != "" {
    text(font: title-font, size: 12pt)[#sub#conf.title]
  } else {
    text(font: title-font, size: 12pt, conf.title)
  }
}

#let _front-matter-page() = {
  set page(header: [])
}

// Calé sur LaTeX \sectionbreak : page impaire (recto), verso blanc si besoin.
#let _ensure-recto-with-blank-before() = {
  _front-matter-page()
  pagebreak()
  if calc.even(counter(page).get().first()) {
    _front-matter-page()
    pagebreak()
  }
}

#let _front_half_title(conf) = {
  if conf.front-title-recto-with-blank-before {
    _ensure-recto-with-blank-before()
  }
  _front-matter-page()
  align(center + horizon, _title-line(conf))
  pagebreak()
}

#let _front_title_page(conf) = {
  if conf.front-title-recto-with-blank-before {
    _ensure-recto-with-blank-before()
  }
  _front-matter-page()
  box(width: 100%, height: 100%)[
    #align(center)[#_title-line(conf)]
    #v(1fr)
    #align(center)[#conf.author]
  ]
  pagebreak()
}

#let _toc-depth-num(conf) = {
  let d = conf.toc-depth
  if d == "1" { 1 } else if d == "2" { 2 } else { 3 }
}

#let _emit-outline(conf) = {
  let depth = _toc-depth-num(conf)
  if conf.label-toc != "" {
    outline(title: [#conf.label-toc], depth: depth)
  } else {
    outline(depth: depth)
  }
}

#let _page-margins(conf) = (
  inside: conf.margin-x + conf.binding-gutter,
  outside: conf.margin-x,
  top: conf.margin-top,
  bottom: conf.margin-bottom,
)

#let _header-inner(conf) = context {
  let p = counter(page).get().first()
  let has-level-1-heading = query(heading.where(level: 1))
    .any(h => counter(page).at(h.location()).first() == p)
  let hide-on-section-title = conf.at("hide-page-number-on-section-title", default: true)
  if p == 1 or not conf.show-page-numbers or (hide-on-section-title and has-level-1-heading) {
    []
  } else {
    let odd = calc.odd(p)
    let pg = text(font: header-font, size: 10pt, counter(page).display(conf.page-numbering-pattern))
    let run = run-section-title.get()
    let show-run = conf.chapter-title-in-header and run != none
    let run-cell = if show-run {
      text(font: header-font, size: 5.02pt, run)
    } else {
      []
    }
    let inner = if conf.page-number-placement == "center" {
      align(center)[#pg]
    } else if conf.page-number-placement == "outer" {
      // Extérieur (reliure à gauche) : recto → droite, verso → gauche
      grid(
        columns: (1fr, 1fr),
        column-gutter: 0.75em,
        if odd { align(left)[#run-cell] } else { align(left)[#pg] },
        if odd { align(right)[#pg] } else { align(right)[#run-cell] },
      )
    } else {
      // Intérieur (spread) : recto → gauche, verso → droite
      grid(
        columns: (1fr, 1fr),
        column-gutter: 0.75em,
        if odd { align(left)[#pg] } else { align(left)[#run-cell] },
        if odd { align(right)[#run-cell] } else { align(right)[#pg] },
      )
    }
    block(below: 0.35em, width: 100%)[#inner]
  }
}

#let _cover-block(conf) = {
  pagebreak()
  align(center + horizon, [
    #text(font: title-font, size: 14pt, conf.title)
    #v(10mm)
    #conf.author
    #v(4mm)
    #conf.edition
  ])
  pagebreak()
}

#let _placeholder-page(title-text) = {
  pagebreak()
  heading(level: 1, title-text)
  parbreak()
  text(font: body-font, style: "italic")[Bloc généré par le gabarit — branchez votre contenu ou votre collecte Typst ici.]
  pagebreak()
}

// Titres de fin de livre : pas de \sectionbreak ni padding chapitre (évite pages blanches).
#let _back-matter-title(title-text) = {
  block(above: 0.5em, below: 1em)[
    #align(center, text(font: title-font, size: 12pt, title-text))
  ]
}

#let emit-section(conf, sid, body) = {
  if sid == "cover" and conf.cover-page {
    _cover-block(conf)
  } else if sid == "titleCredits" and (conf.half-title-page or conf.title-page) {
    if conf.half-title-page {
      _front_half_title(conf)
    }
    if conf.title-page {
      _front_title_page(conf)
    }
    set page(header: _header-inner(conf))
  } else if sid == "toc" and conf.toc-position != "none" {
    _emit-outline(conf)
    pagebreak()
  } else if sid == "body" {
    body
  } else if sid == "annexes" and conf.show-annexes {
    _placeholder-page(if conf.label-annexes != "" { conf.label-annexes } else { "Annexes" })
  } else if sid == "listFigures" and conf.list-figures-style != "none" {
    _placeholder-page(if conf.label-list-figures != "" { conf.label-list-figures } else { "Figures" })
  } else if sid == "bibliography" and conf.bibliography-position != "none" {
    pagebreak()
    _back-matter-title(if conf.label-bibliography != "" { conf.label-bibliography } else { "Bibliographie" })
    include("/obb-generated-bibliography.typ")
  } else if sid == "indexGlossary" and (conf.show-index or conf.show-glossary) {
    if conf.show-index {
      pagebreak()
      _back-matter-title(if conf.label-index != "" { conf.label-index } else { "Index des noms" })
      include("/obb-generated-name-index.typ")
    }
    if conf.show-glossary {
      pagebreak()
      _back-matter-title(if conf.label-glossary != "" { conf.label-glossary } else { "Glossaire" })
      include("/obb-generated-glossary.typ")
    }
  } else if sid == "backCover" and conf.show-back-cover {
    pagebreak()
    align(center + horizon)[
      #text(font: body-font, style: "italic")[Quatrième de couverture]
    ]
    pagebreak()
  }
}

#let apply-layout(conf, body) = {
  // Marqueur footnote : IM Fell — exposants typographiques trop petits ; métriques explicites.
  show footnote: set super(size: 0.68em, baseline: -0.58em, typographic: false)
  show footnote.entry: it => block(breakable: false)[#it]

  set page(
    width: conf.page-width,
    height: conf.page-height,
    binding: left,
    margin: _page-margins(conf),
    header: _header-inner(conf),
    header-ascent: 13.6pt,
    footer-descent: 13pt,
    numbering: none,
  )

  let body-align = conf.at("body-text-alignment", default: "justify")
  let body-justify = (
    body-align == "justify"
      or body-align == "justify-last-left"
      or body-align == "justify-last-right"
  )
  set text(
    font: conf.font-family,
    size: conf.font-size,
    lang: conf.document-lang,
    hyphenate: if body-justify { auto } else { false },
  )
  apply-dora-text-styles()

  if body-align == "center" {
    set align(center)
  } else if body-align == "right" {
    set align(end)
  } else if body-align == "justify-last-right" {
    set align(end)
  } else if body-align == "left" {
    set align(start)
  } else if (body-align == "justify" or body-align == "justify-last-left") {
    set align(start)
  } else {
    set align(start)
  }
  show par: set par(
    leading: _line-leading(conf),
    justify: body-justify,
  )

  if conf.auto-break-long-tokens {
    let chunk-rx = regex("[A-Za-z0-9]{" + str(conf.auto-break-chunk-size) + "}")
    show chunk-rx: it => [#it#sym.zws]
  }

  if conf.heading-numbering == "none" {
    set heading(numbering: none)
  } else {
    set heading(numbering: conf.heading-numbering)
  }

  show figure: set align(center)
  show figure.where(kind: image): it => {
    block(width: 100%, breakable: false, align(center)[#it])
  }
  show image: it => {
    block(width: 100%, breakable: false, align(center)[
      #box(width: 100%, it)
    ])
  }

  show heading.where(level: 1): it => {
    run-section-title.update(it.body)
    _section-open-page(conf)
    v(conf.section-title-pad-top)
    align(center, text(font: title-font, size: 12pt, it.body))
    v(2em)
  }

  show heading.where(level: 2): it => {
    block(above: 0.8em, below: 0.4em, {
      emph(it.body)
    })
  }

  show heading.where(level: 3): it => {
    block(above: 0.6em, below: 0.3em, emph(it))
  }

  for sid in conf.section-order [
    #emit-section(conf, sid, body)
  ]
}

#let conf = (
  ..default-config,
  font-family: body-font,
  font-size: 8.1pt,
  page-width: 91.77mm,
  page-height: 148.5mm,
  margin-x: 12mm,
  margin-top: 20mm,
  margin-bottom: 12mm,
  title-page: true,
  chapter-start-odd: true,
  section-title-recto-with-blank-before: true,
  section-order: ("titleCredits", "body"),
)

#let render(opts) = {
  let merged = conf + opts
  apply-layout(merged, [
    #include "/content.typ"
  ])
}

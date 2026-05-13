// @obbwasm-meta begin
// nom-complet: Gabarits pour livre format BrochSnob5 avec police Garamond
// version: v2.0
// detail: Modèle B5 (143.5mm x 210mm), options ObbWasm (registre partagé + ordre des sections).
// format: brsnoba5
// supported-options: chapter-title-in-header, page-number-placement, header-footer-rule, page-number-style, auto-heading-numbering, h1-typography, drop-cap-first-para, line-spacing-preset, line-spacing-em, body-text-alignment, chapter-start-odd, binding-gutter-mm, transition-blank-style, caption-position, footnote-scope, image-treatment, accent-color, show-index, list-figures-style, show-glossary, cover-page, half-title-page, title-page, front-title-recto-with-blank-before, section-new-page, section-title-recto-with-blank-before, toc-position, toc-depth, bibliography-position, widows-orphans, show-annexes, show-back-cover
// @obbwasm-meta end

#import "/typeset/shared/book-options-defaults.typ": book-options-defaults

#let run-section-title = state("garamond-b5-section-mark", none)

#let default-config = (
  ..book-options-defaults,
  page-width: 143.5mm,
  page-height: 210mm,
  margin-x: 18mm,
  margin-top: 24mm,
  margin-bottom: 22mm,
  font-family: "Garamond Premier Pro",
  font-size: 9pt,
  line-spacing: 1.2em,
  auto-break-long-tokens: true,
  auto-break-chunk-size: 24,
  section-title-pad-top: 2cm,
  title: "Titre",
  author: "Auteur",
  edition: "Edition",
  cover-image: none,
  cover-page: false,
  half-title-page: false,
  title-page: false,
  front-title-recto-with-blank-before: false,
  section-title-recto-with-blank-before: false,
  show-page-numbers: true,
  section-new-page: false,
  toc-at-start: false,
  toc-at-end: false,
)

#let _line-leading(conf) = {
  if conf.line-spacing-preset == "narrow" { 1.05em }
  else if conf.line-spacing-preset == "wide" { 1.35em }
  else if conf.line-spacing-preset == "custom" { conf.line-spacing }
  else { conf.line-spacing }
}

#let _front_half_title(conf) = {
  if conf.front-title-recto-with-blank-before {
    let p = counter(page).get().first()
    if calc.odd(p) {
      { set page(header: []); pagebreak(); pagebreak() }
    } else {
      { set page(header: []); pagebreak(); pagebreak(); pagebreak() }
    }
  } else {
    pagebreak()
  }
  align(center + horizon, text(size: 1.6em, conf.title))
  pagebreak()
}

#let _front_title_page(conf) = {
  if conf.front-title-recto-with-blank-before {
    let p = counter(page).get().first()
    if calc.odd(p) {
      { set page(header: []); pagebreak(); pagebreak() }
    } else {
      { set page(header: []); pagebreak(); pagebreak(); pagebreak() }
    }
  } else {
    pagebreak()
  }
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

#let _toc-depth-num(conf) = {
  let d = conf.toc-depth
  if d == "1" { 1 } else if d == "2" { 2 } else { 3 }
}

#let _emit_outline(conf) = {
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
  if p == 1 or has-level-1-heading or not conf.show-page-numbers {
    []
  } else {
    let odd = calc.odd(p)
    let pg = text(size: 10pt, counter(page).display(conf.page-numbering-pattern))
    let run = run-section-title.get()
    let show-run = conf.chapter-title-in-header and run != none
    let run-cell = if show-run { run } else { [] }
    let rule = if conf.header-footer-rule == "thin" {
      line(length: 100%, stroke: 0.35pt + rgb(conf.accent-color))
    } else if conf.header-footer-rule == "thick" {
      line(length: 100%, stroke: 0.75pt + rgb(conf.accent-color))
    } else {
      []
    }
    let inner = if conf.page-number-placement == "center" {
      align(center)[#pg]
    } else {
      grid(
        columns: (1fr, 1fr),
        column-gutter: 0.75em,
        if odd { align(left)[#pg] } else { align(left)[#run-cell] },
        if odd { align(right)[#run-cell] } else { align(right)[#pg] },
      )
    }
    block(below: 0.35em, width: 100%)[
      #inner
      #if conf.header-footer-rule != "none" [
        #v(0.25em)
        #rule
      ]
    ]
  }
}

#let _h1-align(conf, inner) = {
  if conf.h1-typography == "left" {
    align(left, inner)
  } else if conf.h1-typography == "centered" {
    align(center, inner)
  } else {
    align(center, inner)
  }
}

#let _cover-block(conf) = {
  pagebreak()
  align(center + horizon, [
    #text(size: 1.8em, fill: rgb(conf.accent-color), conf.title)
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
  text(style: "italic")[Bloc généré par le gabarit — branchez votre contenu ou votre collecte Typst ici.]
  pagebreak()
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
  } else if sid == "toc" and conf.toc-position != "none" {
    _emit_outline(conf)
    pagebreak()
  } else if sid == "body" {
    body
  } else if sid == "annexes" and conf.show-annexes {
    _placeholder-page(if conf.label-annexes != "" { conf.label-annexes } else { "Annexes" })
  } else if sid == "listFigures" and conf.list-figures-style != "none" {
    _placeholder-page(if conf.label-list-figures != "" { conf.label-list-figures } else { "Figures" })
  } else if sid == "bibliography" and conf.bibliography-position != "none" {
    pagebreak()
    heading(level: 1, if conf.label-bibliography != "" { conf.label-bibliography } else { "Bibliographie" })
    parbreak()
    include("/obb-generated-bibliography.typ")
    pagebreak()
  } else if sid == "indexGlossary" and (conf.show-index or conf.show-glossary) {
    if conf.show-index {
      pagebreak()
      heading(level: 1, if conf.label-index != "" { conf.label-index } else { "Index des noms" })
      parbreak()
      include("/obb-generated-name-index.typ")
      pagebreak()
    }
    if conf.show-glossary {
      pagebreak()
      heading(level: 1, if conf.label-glossary != "" { conf.label-glossary } else { "Glossaire" })
      parbreak()
      include("/obb-generated-glossary.typ")
      pagebreak()
    }
  } else if sid == "backCover" and conf.show-back-cover {
    pagebreak()
    align(center + horizon)[
      #text(style: "italic")[Quatrième de couverture]
    ]
    pagebreak()
  }
}

#let apply-layout(conf, body) = {
  set page(
    width: conf.page-width,
    height: conf.page-height,
    binding: left,
    margin: _page-margins(conf),
    header: _header-inner(conf),
    numbering: none,
  )

  let body-align = conf.at("body-text-alignment", default: "justify")
  // Comparaisons explicites (fiables sur toutes les versions WASM) : la justification
  // contrôle les lignes complètes ; l’alignement courant règle surtout la dernière ligne
  // (voir doc Typst `par.justify` + alignement courant).
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
  // Règle Typst officielle « show-set » : s’applique à chaque élément `par` (corps Pandoc inclus).
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

  show footnote.entry: it => block(breakable: false, it)

  show heading.where(level: 1): it => {
    run-section-title.update(it.body)
    if conf.chapter-start-odd {
      let p0 = counter(page).get().first()
      if calc.even(p0) {
        pagebreak()
      }
    }
    if conf.section-title-recto-with-blank-before {
      let p = counter(page).get().first()
      if calc.odd(p) {
        { set page(header: []); pagebreak(); pagebreak() }
      } else {
        { set page(header: []); pagebreak(); pagebreak(); pagebreak() }
      }
    } else if conf.section-new-page {
      pagebreak()
    }
    v(conf.section-title-pad-top)
    let h1-inner = if conf.h1-typography == "uppercase" {
      text(size: 1.35em, fill: rgb(conf.accent-color), weight: "bold", tracking: 0.06em, it.body)
    } else if conf.h1-typography == "normal" {
      text(size: 1.35em, fill: rgb(conf.accent-color), weight: "regular", it.body)
    } else {
      text(size: 1.35em, fill: rgb(conf.accent-color), it.body)
    }
    _h1-align(conf, h1-inner)
    v(2em)
  }

  show heading.where(level: 2): it => {
    block(above: 0.8em, below: 0.4em, {
      set text(weight: "bold", fill: rgb(conf.accent-color))
      it
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
  apply-layout(merged, [
    #include "/content.typ"
  ])
}

// Gabarit autonome (pas de fichier partagé) — équivalent cible : Garamond-brsnoba5-layout.tex
//
// LIMITES Typst (moteur) vs LaTeX — pas d’équivalent fidèle :
// - Notes : voir #show footnote.entry (évite la fragmentation d’une entrée, cf. forum Typst
//   https://forum.typst.app/t/how-do-i-avoid-splitting-footnote-on-multiple-pages/4055 ).
//   Une note plus haute qu’une page peut encore poser problème (débordement).
// - Pages du sommaire en \thispagestyle{empty} : non reproduit ici.
// - En-têtes : approximation recto/verso (impair = pg à gauche, titre à droite ; pair = inverse),
//   comme fancyhdr RE/LO pour le numéro et LE/RO pour la marque (ici une seule marque section).

#let run-section-title = state("garamond-b5-section-mark", none)

#let default-config = (
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
  front-title-recto-with-blank-before: false,
  section-title-recto-with-blank-before: false,
  show-page-numbers: true,
  cover-page: false,
  half-title-page: false,
  title-page: false,
  toc-at-start: false,
  toc-at-end: false,
  section-new-page: false,
  // \titleformat{\section}{...\vspace*{2cm}} — espace au-dessus du titre
  section-title-pad-top: 2cm,
  title: "Titre",
  author: "Auteur",
  edition: "Edition",
  cover-image: none,
  page-numbering-pattern: "1",
  heading-numbering: "none",
)

#let _front_half_title(conf) = {
  if conf.front-title-recto-with-blank-before {
    let p = counter(page).get().first()
    if calc.odd(p) {
      {
        set page(header: [])
        pagebreak()
        pagebreak()
      }
    } else {
      {
        set page(header: [])
        pagebreak()
        pagebreak()
        pagebreak()
      }
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
      {
        set page(header: [])
        pagebreak()
        pagebreak()
      }
    } else {
      {
        set page(header: [])
        pagebreak()
        pagebreak()
        pagebreak()
      }
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
      let has-level-1-heading = query(heading.where(level: 1))
        .any(h => counter(page).at(h.location()).first() == p)
      if p == 1 or has-level-1-heading or not conf.show-page-numbers {
        []
      } else {
        let odd = calc.odd(p)
        let pg = text(size: 10pt, counter(page).display(conf.page-numbering-pattern))
        let run = run-section-title.get()
        let run-cell = if run == none { [] } else { run }
        // Odd : numéro côté gauche, titre côté droit ; even : titre gauche, numéro droit
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

  // Permet la coupure automatique des tres longues chaines (URL, magnet, hashes),
  // sans impacter le texte courant. On coupe seulement tous les N caracteres
  // alphanumeriques consecutifs (N configurable).
  if conf.auto-break-long-tokens {
    let chunk-rx = regex("[A-Za-z0-9]{" + str(conf.auto-break-chunk-size) + "}")
    show chunk-rx: it => [#it#sym.zws]
  }

  if conf.heading-numbering == "none" {
    set heading(numbering: none)
  } else {
    set heading(numbering: conf.heading-numbering)
  }

  // Empêche qu’une même entrée de note soit découpée entre deux pages (pas le corps principal).
  show footnote.entry: it => block(breakable: false, it)

  show heading.where(level: 1): it => {
    run-section-title.update(it.body)
    if conf.section-title-recto-with-blank-before {
      // Mode prioritaire et autonome:
      // - page vierge juste avant le H1
      // - H1 sur page de droite (impaire)
      let p = counter(page).get().first()
      if calc.odd(p) {
        {
          set page(header: [])
          pagebreak()
          pagebreak()
        }
      } else {
        {
          set page(header: [])
          pagebreak()
          pagebreak()
          pagebreak()
        }
      }
    } else if conf.section-new-page {
      // Mode simple: saut de page H1 uniquement.
      pagebreak()
    }
    v(conf.section-title-pad-top)
    align(center, {
      set text(size: 1.35em)
      it
    })
    v(2em)
  }

  show heading.where(level: 2): it => {
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

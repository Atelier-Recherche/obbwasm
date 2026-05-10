# Options de livre ObbWasm (Typst)

Ce dépôt définit un **catalogue commun** de clés `conf` pour les gabarits de mise en page, un fichier de **valeurs par défaut** partagé, et une convention de **métadonnées** dans le bloc `@obbwasm-meta`.

## Fichiers

- [**shared/book-options-defaults.typ**](shared/book-options-defaults.typ) — dictionnaire `book-options-defaults` : toutes les clés connues avec des valeurs neutres.
- Un gabarit de mise en page importe ce fichier puis fusionne avec ses propres réglages :
  - `#import "/typeset/typst/shared/book-options-defaults.typ": book-options-defaults`
  - `#let default-config = ( ..book-options-defaults, font-family: ..., )`

## Métadonnées `@obbwasm-meta`

Dans l’en-tête commenté du `.typ` :

- `supported-options: id1, id2, ...` — liste d’**identifiants d’options** (même noms que dans le registre front-end). Si la ligne est absente, l’interface affiche **toutes** les options du registre. Si elle est présente, seules ces options sont proposées dans l’UI.
- `supported-options: none` — aucune option de mise en page dans l’UI (ex. gabarit minimal qui ignore `opts`).

Les identifiants correspondent aux clés du registre TypeScript (`web/src/bookOptions/registry.ts`), par ex. `toc-position`, `cover-page`, `accent-color`.

## Clés `conf` principales

| Identifiant registre (UI) | Clé Typst dans `conf` | Rôle |
|---------------------------|------------------------|------|
| `cover-page` | `cover-page` | Page de couverture interne |
| `half-title-page` | `half-title-page` | Faux-titre |
| `title-page` | `title-page` | Page de titre |
| `front-title-recto-with-blank-before` | `front-title-recto-with-blank-before` | Page de titre en recto avec page blanche avant |
| `section-new-page` | `section-new-page` | Saut de page avant chaque H1 |
| `section-title-recto-with-blank-before` | `section-title-recto-with-blank-before` | Chapitre en recto + blanc avant |
| `toc-position` | `toc-position` | `"none"` \| `"start"` \| `"end"` (+ variantes `toc-at-start` / `toc-at-end` encore envoyées pour compatibilité) |
| `toc-depth` | `toc-depth` | `"1"` \| `"2"` \| `"3"` — profondeur du sommaire |
| `bibliography-position` | `bibliography-position` | Idem pour la bibliographie |
| `chapter-title-in-header` | `chapter-title-in-header` | Titre de section courant dans l’en-tête |
| `page-number-placement` | `page-number-placement` | `"spread"` \| `"center"` \| `"outer"` |
| `header-footer-rule` | `header-footer-rule` | `"none"` \| `"thin"` \| `"thick"` |
| `page-number-style` | `page-number-style` / `page-numbering-pattern` | Style des numéros de page |
| `auto-heading-numbering` | `heading-numbering` | Numérotation des titres |
| `h1-typography` | `h1-typography` | Style du H1 |
| `line-spacing-preset` | `line-spacing-preset` | Interlignage logique |
| `chapter-start-odd` | `chapter-start-odd` | Chapitre sur page impaire |
| `binding-gutter-mm` | `binding-gutter` (longueur Typst, ex. `5mm`) | Gouttière de reliure |
| `accent-color` | `accent-color` | Couleur d’accent (hex, pour `rgb()`) |
| `document-lang` | `document-lang` | Code langue (`fr`, `en`, …) pour `#set text(lang: ...)` |
| `section-order` | `section-order` | Tableau de chaînes : ordre d’émission des sections (`"cover"`, `"titleCredits"`, `"toc"`, `"body"`, …) |
| Libellés optionnels | `label-toc`, `label-bibliography`, … | Textes pour titres de blocs (sommaire, etc.) — sinon chaînes selon la langue du document côté app |

## Ordre des sections (`section-order`)

Valeurs possibles pour les éléments du tableau : `cover`, `titleCredits`, `toc`, `body`, `annexes`, `listFigures`, `bibliography`, `indexGlossary`, `backCover`.

Le gabarit **Garamond** (`layout/Garamond-brsnoba5-layout.typ`) parcourt `conf.section-order` et appelle des blocs (`emit-section`) dans cet ordre. Les autres gabarits peuvent ignorer cette clé tant qu’ils ne l’utilisent pas.

## Chaînes document (libellés)

L’application envoie les clés `label-*` déjà résolues (surcharge utilisateur ou traduction selon la langue du document). Dans le `.typ`, testez par exemple :

```typst
#if conf.label-toc != "" [
  outline(title: [#conf.label-toc], depth: 2)
] else [
  outline(depth: 2)
]
```

## Compilation WASM (front)

Lors de la compilation dans le navigateur, le fichier `book-options-defaults.typ` est monté sous  
`/typeset/typst/shared/book-options-defaults.typ` en plus du gabarit principal. Les gabarits qui importent ce chemin absolu fonctionnent sans modification du bundler.

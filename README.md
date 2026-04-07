# OBBWASM

Studio de composition et preparation impression, avec pipeline **100% WASM** dans le navigateur:

- Conversion documentaire via **Pandoc WASM**
- Composition typographique via **Typst WASM**
- Preview PDF via **pdf.js**
- API utilitaire minimale en **PHP + JSON**

## Stack

- Frontend: React + TypeScript + Vite
- WASM:
  - `pandoc-wasm` (conversion vers Typst)
  - `@myriaddreamin/typst.ts` (compilation Typst vers PDF)
- Preview: `pdfjs-dist`
- Backend utilitaire: PHP 8+
- Stockage: JSON fichiers (`app/data`)

## Structure du projet

```text
obbwasm/
  app/
    api/
      common.php
      health.php
      templates.php
      projects.php
      upload.php
      convert.php
      imposition-calc.php
      render-typst.php
    data/
      templates/
      projects/
      assets/
    public/
      index.html
  typeset/
    old latex/
    typst/
      layout/
      impose/
      cover/
  web/
    src/
      App.tsx
      main.tsx
      style.css
      types.d.ts
    vite.config.ts
    package.json
```

## Prerequis

- Node.js 20+ (23 teste)
- npm 10+
- PHP 8.2+

## Execution en local

### 1) API PHP

Depuis la racine:

```bash
php -S 127.0.0.1:8088 -t app
```

API disponible sur `http://127.0.0.1:8088/api`.

### 2) Frontend React

Dans `web/`:

```bash
npm install
npm run dev
```

Frontend disponible sur `http://localhost:5173`.

Par defaut, le frontend appelle l'API sur `http://127.0.0.1:8088/api`.

Pour changer l'URL API:

```bash
# PowerShell
$env:VITE_API_BASE="https://mon-domaine/api"
npm run dev
```

## Build production (frontend)

Dans `web/`:

```bash
npm run build
```

Sortie dans `web/dist/`.

## Deploiement serveur

Deux options simples.

### Option A (recommandee): frontend statique + API PHP

1. Builder le frontend (`web/dist`).
2. Servir `web/dist` via Nginx/Apache (ou CDN statique).
3. Servir `app/api` et `app/data` via PHP-FPM/Apache PHP.
4. Configurer `VITE_API_BASE` au build pour pointer sur l'URL API publique.

Exemple:

```bash
# build avec URL API cible
VITE_API_BASE="https://example.com/api" npm run build
```

### Option B: serveur PHP unique (simple)

1. Builder le frontend.
2. Copier le contenu de `web/dist` dans `app/public`.
3. Lancer PHP en `-t app` (ou configurer VirtualHost sur `app`).

## Flux fonctionnel actuel

1. Upload source (module Contenu)
2. Conversion `Pandoc WASM -> Typst`
3. Compilation `Typst WASM -> PDF`
4. Preview PDF
5. Reglages couverture/imposition
6. Export du pack impression (ZIP)

## Notes importantes

- Le projet est oriente **WASM navigateur** pour la conversion/rendu.
- L'endpoint `render-typst.php` existe encore pour debug serveur, mais le flux principal passe par Typst WASM dans le frontend.
- `pandoc.wasm` est volumineux; le chargement est declenche a la demande.

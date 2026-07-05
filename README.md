<div align="center">

<table>
<tr>
<td><img src="readme-media/BookBrew.png" alt="BookBrew" width="140" /></td>
<td align="left">
<h1 style="margin:0">BookBrew</h1>
<p style="margin:0.25em 0 0"><strong>Studio de composition livre</strong><br/>Markdown → PDF · Pandoc WASM · Typst WASM · plugin Obsidian</p>
</td>
</tr>
</table>

<a href="https://atelier.atechnologie.fr/" title="l'Atelier – Association de fabrication de livres et d'outils de recherche"><img src="readme-media/logoasso.jpg" alt="l'Atelier" width="200" /></a>  
<sub>Développé par <a href="https://atelier.atechnologie.fr/">l'Atelier</a> — fabrication de livres et outils de recherche (EHESS)</sub>

<p>
🇫🇷 <a href="README.md"><b>Français</b></a> ·
🇬🇧 <a href="README.en.md">English</a> ·
🇩🇪 <a href="README.de.md">Deutsch</a> ·
🇪🇸 <a href="README.es.md">Español</a>
</p>

<p>
<a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/🌐_l'Atelier-atelier.atechnologie.fr-2d5016?style=for-the-badge" alt="Site l'Atelier" /></a>
<a href="https://github.com/Morglaf/obbwasm"><img src="https://img.shields.io/badge/📦_Dépôt-GitHub-181717?style=for-the-badge&logo=github" alt="Dépôt GitHub" /></a>
<a href="https://obsidian.md/plugins?search=BRAT#"><img src="https://img.shields.io/badge/⬇️_Plugin_Obsidian-BRAT-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white" alt="Installer le plugin via BRAT" /></a>
</p>

</div>

---

## 📸 Aperçu

| Options de mise en page | Aperçu PDF |
| :---: | :---: |
| <img src="readme-media/screen1.jpg" alt="Panneau options livre dans Obsidian" width="400" /> | <img src="readme-media/screen2.jpg" alt="Aperçu PDF dans Obsidian" width="400" /> |

<p align="center">
<img src="readme-media/screenweb.png" alt="Application web BookBrew" width="820" /><br/>
<sub>Application web (React + Vite) — même pipeline WASM</sub>
</p>

---

## 📖 À propos

**BookBrew** (dépôt `obbwasm`) est un studio de composition et de préparation à l’impression, avec un pipeline **100 % WebAssembly** dans le navigateur (et dans Obsidian) :

- 📝 Conversion documentaire via **Pandoc WASM**
- 📐 Composition typographique via **Typst WASM**
- 👁️ Aperçu PDF via **pdf.js**
- 🌐 Application web **React + Vite** et **plugin Obsidian** partageant le cœur `@obbwasm/core`
- 🗄️ API utilitaire optionnelle en **PHP + JSON** (projets, gabarits, préréglages)

Aucune installation locale de Pandoc ou Typst n’est requise pour le flux principal.

---

## ⬇️ Plugin Obsidian (BRAT)

1. 🔌 Installer **BRAT** : [Obsidian — BRAT](https://obsidian.md/plugins?search=BRAT#)
2. ➕ Ajouter ce dépôt avec l’option *« Add Beta plugin »* :  
   `https://github.com/Morglaf/obbwasm`  
   (dossier plugin : `obsidian-plugin/` — voir le workflow de release pour les assets `main.js`, `manifest.json`, `styles.css`, WASM)

3. 📥 Télécharger les **gabarits Typst** depuis les réglages du plugin (ou pointer vers un dossier `typeset/` local).

> 💡 Compilation d’une note Markdown active → PDF intérieur, couverture, imposition ; préréglages de mise en page ; glossaire et index des noms.

---

## ⚙️ Fonctionnement

| Composant | Rôle |
| --- | --- |
| **Pandoc WASM** | Markdown (+ bibliographie `.bib` / CSL) → Typst |
| **Typst WASM** | Gabarits `typeset/` (Garamond, imposition, couverture) → PDF |
| **Médias** | Images locales, URLs distantes (WebP → PNG), images base64 extraites |
| **Plugin** | Coffre Obsidian, préréglages JSON, aperçu PDF redimensionnable |

📱 Le plugin cible **Obsidian bureau** (Windows, macOS, Linux) ; l’app web tourne dans tout navigateur récent.

---

## 💻 Développement local

**Prérequis** : [Node.js](https://nodejs.org/) 20+, npm 10+, [PHP](https://www.php.net/) 8.2+ (API optionnelle).

```bash
npm install
```

### Application web

```bash
npm run dev -w web
```

Frontend : `http://localhost:5173` — API par défaut : `http://127.0.0.1:8088/api`.

```bash
# API PHP (racine du dépôt)
php -S 127.0.0.1:8088 -t app
```

Build production :

```bash
npm run build -w web
```

### Plugin Obsidian

```bash
npm run build -w @obbwasm/core
npm run build -w obsidian-plugin
```

Copie locale vers le coffre : script `deployplugin.ps1` (à adapter selon votre chemin vault).

Release plugin (semver + tag → GitHub Actions) : `Release-Plugin.ps1`.

---

## 📁 Structure du dépôt

```text
obbwasm/
  packages/obbwasm-core/   # Pandoc/Typst WASM, options livre, médias
  obsidian-plugin/         # Extension Obsidian
  web/                     # Interface React
  typeset/                 # Gabarits Typst (layout, couverture, imposition)
  app/                     # API PHP + données JSON
  readme-media/            # Captures pour ce README
```

---

## 🚀 Déploiement

**Option A (recommandée)** : frontend statique (`web/dist`) + API PHP (`app/api`, `app/data`).

```bash
VITE_API_BASE="https://example.com/api" npm run build -w web
```

**Option B** : serveur PHP unique — copier `web/dist` dans `app/public`, servir avec `php -S` ou Apache/Nginx.

Déploiement gabarits + site : voir `deploy.ps1` à la racine.

---

## Conformité catalogue Obsidian (plugin)

| Élément | Détail |
| --- | --- |
| **ID plugin** | `obbwasm-book` |
| **Licence** | MIT — [LICENSE](LICENSE) |
| **Réseau** | Oui — téléchargement optionnel de gabarits Typst depuis GitHub (configurable) ; images distantes dans les documents si présentes dans le Markdown |
| **Fichiers hors vault** | accès aux fichiers du coffre Obsidian pour la composition |
| **Télémétrie / mise à jour auto** | non |
| **Release** | `.\Release-Plugin.ps1` |

---

## ⚠️ Notes

- `pandoc.wasm` et `typst_ts_web_compiler_bg.wasm` sont volumineux ; chargement à la demande.
- Les gros documents peuvent prendre **plusieurs minutes** à compiler (Pandoc puis Typst) ; l’interface affiche une progression.
- L’endpoint `render-typst.php` reste disponible pour du debug serveur ; le flux principal est WASM côté client.

---

## 🔗 Ressources

| | |
| --- | --- |
| 🌐 **l'Atelier** | [atelier.atechnologie.fr](https://atelier.atechnologie.fr/) |
| 📦 **Dépôt** | [github.com/Morglaf/obbwasm](https://github.com/Morglaf/obbwasm) |
| 📄 **Pandoc** | [pandoc.org](https://pandoc.org/) |
| 📐 **Typst** | [typst.app](https://typst.app/) |
| 🔌 **Obsidian** | [obsidian.md](https://obsidian.md/) |

---

<div align="center">

<sub>🇫🇷 <a href="README.md">Français</a> · <a href="README.en.md">🇬🇧 English</a> · <a href="README.de.md">🇩🇪 Deutsch</a> · <a href="README.es.md">🇪🇸 Español</a> · BookBrew / OBB WASM — <a href="https://atelier.atechnologie.fr/">l'Atelier</a></sub>

</div>

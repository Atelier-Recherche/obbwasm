<div align="center">

<table>
<tr>
<td><img src="readme-media/BookBrew.png" alt="BookBrew" width="140" /></td>
<td align="left">
<h1 style="margin:0">BookBrew</h1>
<p style="margin:0.25em 0 0"><strong>Book composition studio</strong><br/>Markdown → PDF · Pandoc WASM · Typst WASM · Obsidian plugin</p>
</td>
</tr>
</table>

<a href="https://atelier.atechnologie.fr/" title="l'Atelier – book fabrication and research tools association"><img src="readme-media/logoasso.jpg" alt="l'Atelier" width="200" /></a>  
<sub>Developed by <a href="https://atelier.atechnologie.fr/">l'Atelier</a> — book fabrication and research tools (EHESS)</sub>

<p>
🇫🇷 <a href="README.md">Français</a> ·
🇬🇧 <a href="README.en.md"><b>English</b></a> ·
🇩🇪 <a href="README.de.md">Deutsch</a> ·
🇪🇸 <a href="README.es.md">Español</a>
</p>

<p>
<a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/🌐_l'Atelier-atelier.atechnologie.fr-2d5016?style=for-the-badge" alt="l'Atelier website" /></a>
<a href="https://github.com/Atelier-Recherche/obbwasm"><img src="https://img.shields.io/badge/📦_Repository-GitHub-181717?style=for-the-badge&logo=github" alt="GitHub repository" /></a>
<a href="https://obsidian.md/plugins?search=BRAT#"><img src="https://img.shields.io/badge/⬇️_Obsidian_Plugin-BRAT-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white" alt="Install plugin via BRAT" /></a>
</p>

</div>

---

## 📸 Preview

| Layout options | PDF preview |
| :---: | :---: |
| <img src="readme-media/screen1.jpg" alt="Book layout options panel in Obsidian" width="400" /> | <img src="readme-media/screen2.jpg" alt="PDF preview in Obsidian" width="400" /> |

<p align="center">
<img src="readme-media/screenweb.png" alt="BookBrew web application" width="820" /><br/>
<sub>Web app (React + Vite) — same WASM pipeline</sub>
</p>

---

## 📖 About

**BookBrew** (repository `obbwasm`) is a composition and print-preparation studio with a **100% WebAssembly** pipeline in the browser (and in Obsidian):

- 📝 Document conversion via **Pandoc WASM**
- 📐 Typesetting via **Typst WASM**
- 👁️ PDF preview via **pdf.js**
- 🌐 **React + Vite** web app and **Obsidian plugin** sharing the `@obbwasm/core` package
- 🗄️ Optional **PHP + JSON** utility API (projects, templates, presets)

No local Pandoc or Typst installation is required for the main workflow.

---

## ⬇️ Obsidian plugin (BRAT)

1. 🔌 Install **BRAT**: [Obsidian — BRAT](https://obsidian.md/plugins?search=BRAT#)
2. ➕ Add this repository with *“Add Beta plugin”*:  
   `https://github.com/Atelier-Recherche/obbwasm`  
   (plugin folder: `obsidian-plugin/` — see the release workflow for `main.js`, `manifest.json`, `styles.css`, WASM assets)

3. 📥 Download **Typst templates** from the plugin settings (or point to a local `typeset/` folder).

> 💡 Compile the active Markdown note → interior PDF, cover, imposition; layout presets; glossary and name index.

---

## ⚙️ How it works

| Component | Role |
| --- | --- |
| **Pandoc WASM** | Markdown (+ `.bib` bibliography / CSL) → Typst |
| **Typst WASM** | `typeset/` templates (Garamond, imposition, cover) → PDF |
| **Media** | Local images, remote URLs (WebP → PNG), extracted base64 images |
| **Plugin** | Obsidian vault, JSON presets, resizable PDF preview |

📱 The plugin targets **Obsidian desktop** (Windows, macOS, Linux); the web app runs in any recent browser.

---

## 💻 Local development

**Requirements**: [Node.js](https://nodejs.org/) 20+, npm 10+, [PHP](https://www.php.net/) 8.2+ (optional API).

```bash
npm install
```

### Web application

```bash
npm run dev -w web
```

Frontend: `http://localhost:5173` — default API: `http://127.0.0.1:8088/api`.

```bash
# PHP API (repository root)
php -S 127.0.0.1:8088 -t app
```

Production build:

```bash
npm run build -w web
```

### Obsidian plugin

```bash
npm run build -w @obbwasm/core
npm run build -w obsidian-plugin
```

Copy to your vault: `deployplugin.ps1` script (adjust your vault path).

Plugin release (semver + tag → GitHub Actions): `Release-Plugin.ps1`.

---

## 📁 Repository structure

```text
obbwasm/
  packages/obbwasm-core/   # Pandoc/Typst WASM, book options, media
  obsidian-plugin/         # Obsidian extension
  web/                     # React UI
  typeset/                 # Typst templates (layout, cover, imposition)
  app/                     # PHP API + JSON data
  readme-media/            # Screenshots for this README
```

---

## 🚀 Deployment

**Option A (recommended)**: static frontend (`web/dist`) + PHP API (`app/api`, `app/data`).

```bash
VITE_API_BASE="https://example.com/api" npm run build -w web
```

**Option B**: single PHP server — copy `web/dist` into `app/public`, serve with `php -S` or Apache/Nginx.

Templates + site deployment: see `deploy.ps1` at the repository root.

---

## ⚠️ Notes

- `pandoc.wasm` and `typst_ts_web_compiler_bg.wasm` are large; they load on demand.
- Large documents may take **several minutes** to compile (Pandoc then Typst); the UI shows progress.
- The `render-typst.php` endpoint remains available for server-side debugging; the main flow is client-side WASM.

---

## 🔗 Resources

| | |
| --- | --- |
| 🌐 **l'Atelier** | [atelier.atechnologie.fr](https://atelier.atechnologie.fr/) |
| 📦 **Repository** | [github.com/Atelier-Recherche/obbwasm](https://github.com/Atelier-Recherche/obbwasm) |
| 📄 **Pandoc** | [pandoc.org](https://pandoc.org/) |
| 📐 **Typst** | [typst.app](https://typst.app/) |
| 🔌 **Obsidian** | [obsidian.md](https://obsidian.md/) |

---

<div align="center">

<sub><a href="README.md">🇫🇷 Français</a> · 🇬🇧 English · <a href="README.de.md">🇩🇪 Deutsch</a> · <a href="README.es.md">🇪🇸 Español</a> · BookBrew / OBB WASM — <a href="https://atelier.atechnologie.fr/">l'Atelier</a></sub>

</div>

<div align="center">

<table>
<tr>
<td><img src="readme-media/BookBrew.png" alt="BookBrew" width="140" /></td>
<td align="left">
<h1 style="margin:0">BookBrew</h1>
<p style="margin:0.25em 0 0"><strong>Estudio de composición de libros</strong><br/>Markdown → PDF · Pandoc WASM · Typst WASM · plugin Obsidian</p>
</td>
</tr>
</table>

<a href="https://atelier.atechnologie.fr/" title="l'Atelier – asociación de fabricación de libros y herramientas de investigación"><img src="readme-media/logoasso.jpg" alt="l'Atelier" width="200" /></a>  
<sub>Desarrollado por <a href="https://atelier.atechnologie.fr/">l'Atelier</a> — fabricación de libros y herramientas de investigación (EHESS)</sub>

<p>
🇫🇷 <a href="README.md">Français</a> ·
🇬🇧 <a href="README.en.md">English</a> ·
🇩🇪 <a href="README.de.md">Deutsch</a> ·
🇪🇸 <a href="README.es.md"><b>Español</b></a>
</p>

<p>
<a href="https://atelier.atechnologie.fr/"><img src="https://img.shields.io/badge/🌐_l'Atelier-atelier.atechnologie.fr-2d5016?style=for-the-badge" alt="Sitio l'Atelier" /></a>
<a href="https://github.com/Morglaf/obbwasm"><img src="https://img.shields.io/badge/📦_Repositorio-GitHub-181717?style=for-the-badge&logo=github" alt="Repositorio GitHub" /></a>
<a href="https://obsidian.md/plugins?search=BRAT#"><img src="https://img.shields.io/badge/⬇️_Plugin_Obsidian-BRAT-7c3aed?style=for-the-badge&logo=obsidian&logoColor=white" alt="Instalar plugin vía BRAT" /></a>
</p>

</div>

---

## 📸 Vista previa

| Opciones de maquetación | Vista previa PDF |
| :---: | :---: |
| <img src="readme-media/screen1.jpg" alt="Panel de opciones de libro en Obsidian" width="400" /> | <img src="readme-media/screen2.jpg" alt="Vista previa PDF en Obsidian" width="400" /> |

<p align="center">
<img src="readme-media/screenweb.png" alt="Aplicación web BookBrew" width="820" /><br/>
<sub>Aplicación web (React + Vite) — mismo pipeline WASM</sub>
</p>

---

## 📖 Acerca del proyecto

**BookBrew** (repositorio `obbwasm`) es un estudio de composición y preparación de impresión con un pipeline **100 % WebAssembly** en el navegador (y en Obsidian):

- 📝 Conversión documental con **Pandoc WASM**
- 📐 Composición tipográfica con **Typst WASM**
- 👁️ Vista previa PDF con **pdf.js**
- 🌐 Aplicación web **React + Vite** y **plugin Obsidian** que comparten el núcleo `@obbwasm/core`
- 🗄️ API auxiliar opcional en **PHP + JSON** (proyectos, plantillas, preajustes)

No se requiere instalar Pandoc ni Typst localmente para el flujo principal.

---

## ⬇️ Plugin Obsidian (BRAT)

1. 🔌 Instalar **BRAT**: [Obsidian — BRAT](https://obsidian.md/plugins?search=BRAT#)
2. ➕ Añadir este repositorio con *« Add Beta plugin »*:  
   `https://github.com/Morglaf/obbwasm`  
   (carpeta del plugin: `obsidian-plugin/` — ver el workflow de release para `main.js`, `manifest.json`, `styles.css`, WASM)

3. 📥 Descargar las **plantillas Typst** desde los ajustes del plugin (o apuntar a una carpeta `typeset/` local).

> 💡 Compilar la nota Markdown activa → PDF interior, cubierta, imposición; preajustes de maquetación; glosario e índice de nombres.

---

## ⚙️ Funcionamiento

| Componente | Función |
| --- | --- |
| **Pandoc WASM** | Markdown (+ bibliografía `.bib` / CSL) → Typst |
| **Typst WASM** | Plantillas `typeset/` (Garamond, imposición, cubierta) → PDF |
| **Medios** | Imágenes locales, URL remotas (WebP → PNG), imágenes base64 extraídas |
| **Plugin** | Bóveda Obsidian, preajustes JSON, vista previa PDF redimensionable |

📱 El plugin está pensado para **Obsidian de escritorio** (Windows, macOS, Linux); la app web funciona en cualquier navegador reciente.

---

## 💻 Desarrollo local

**Requisitos**: [Node.js](https://nodejs.org/) 20+, npm 10+, [PHP](https://www.php.net/) 8.2+ (API opcional).

```bash
npm install
```

### Aplicación web

```bash
npm run dev -w web
```

Frontend: `http://localhost:5173` — API por defecto: `http://127.0.0.1:8088/api`.

```bash
# API PHP (raíz del repositorio)
php -S 127.0.0.1:8088 -t app
```

Build de producción:

```bash
npm run build -w web
```

### Plugin Obsidian

```bash
npm run build -w @obbwasm/core
npm run build -w obsidian-plugin
```

Copia al vault: script `deployplugin.ps1` (adaptar la ruta del vault).

Release del plugin (semver + tag → GitHub Actions): `Release-Plugin.ps1`.

---

## 📁 Estructura del repositorio

```text
obbwasm/
  packages/obbwasm-core/   # Pandoc/Typst WASM, opciones de libro, medios
  obsidian-plugin/         # Extensión Obsidian
  web/                     # Interfaz React
  typeset/                 # Plantillas Typst (maquetación, cubierta, imposición)
  app/                     # API PHP + datos JSON
  readme-media/            # Capturas para este README
```

---

## 🚀 Despliegue

**Opción A (recomendada)**: frontend estático (`web/dist`) + API PHP (`app/api`, `app/data`).

```bash
VITE_API_BASE="https://example.com/api" npm run build -w web
```

**Opción B**: servidor PHP único — copiar `web/dist` en `app/public`, servir con `php -S` o Apache/Nginx.

Plantillas + sitio: ver `deploy.ps1` en la raíz del repositorio.

---

## ⚠️ Notas

- `pandoc.wasm` y `typst_ts_web_compiler_bg.wasm` son grandes; se cargan bajo demanda.
- Los documentos largos pueden tardar **varios minutos** en compilarse (Pandoc y luego Typst); la interfaz muestra el progreso.
- El endpoint `render-typst.php` sigue disponible para depuración en servidor; el flujo principal es WASM en el cliente.

---

## 🔗 Recursos

| | |
| --- | --- |
| 🌐 **l'Atelier** | [atelier.atechnologie.fr](https://atelier.atechnologie.fr/) |
| 📦 **Repositorio** | [github.com/Morglaf/obbwasm](https://github.com/Morglaf/obbwasm) |
| 📄 **Pandoc** | [pandoc.org](https://pandoc.org/) |
| 📐 **Typst** | [typst.app](https://typst.app/) |
| 🔌 **Obsidian** | [obsidian.md](https://obsidian.md/) |

---

<div align="center">

<sub><a href="README.md">🇫🇷 Français</a> · <a href="README.en.md">🇬🇧 English</a> · <a href="README.de.md">🇩🇪 Deutsch</a> · 🇪🇸 Español · BookBrew / OBB WASM — <a href="https://atelier.atechnologie.fr/">l'Atelier</a></sub>

</div>

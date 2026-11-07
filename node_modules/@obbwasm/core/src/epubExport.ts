import JSZip from "jszip";
import {
  findPdfPageBreaksInHtml,
  insertPageBreaksIntoHtml,
} from "./epubPageAlign.js";
import { prepareMarkdownForBookExport } from "./prepareMarkdown.js";
import type { PandocConvertFn } from "./pandocMarkdown.js";

export { buildPageMapFromPdfTexts } from "./markdownPagination.js";
export { prepareMarkdownForBookExport } from "./prepareMarkdown.js";
export {
  compactTextForPageAlign,
  findPdfPageBreaksInHtml,
  pdfPageFingerprint,
} from "./epubPageAlign.js";

async function toUint8Array(data: string | Blob): Promise<Uint8Array> {
  if (typeof data === "string") {
    // Sortie binaire parfois renvoyée en « binary string » (latin1) plutôt qu’UTF-8.
    const bytes = new Uint8Array(data.length);
    for (let i = 0; i < data.length; i++) bytes[i] = data.charCodeAt(i) & 0xff;
    return bytes;
  }
  return new Uint8Array(await data.arrayBuffer());
}

/** Signature ZIP / EPUB (`PK`). */
function looksLikeZip(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b;
}

async function pickEpubBytes(
  files: Record<string, string | Blob>,
  preferredName: string,
  stdout: string,
): Promise<{ name: string; bytes: Uint8Array } | null> {
  const tryOne = async (data: string | Blob): Promise<Uint8Array | null> => {
    const bytes = await toUint8Array(data);
    return looksLikeZip(bytes) ? bytes : null;
  };

  if (files[preferredName]) {
    const bytes = await tryOne(files[preferredName]!);
    if (bytes) return { name: preferredName, bytes };
  }

  for (const [name, data] of Object.entries(files ?? {})) {
    if (!/\.epub$/i.test(name)) continue;
    const bytes = await tryOne(data);
    if (bytes) return { name, bytes };
  }

  // Dernier recours : stdout si Pandoc a écrit le binaire sans output-file.
  if (stdout && stdout.length > 100) {
    const bytes = await toUint8Array(stdout);
    if (looksLikeZip(bytes)) return { name: preferredName, bytes };
  }

  return null;
}

export async function pandocMarkdownToEpub(params: {
  convert: PandocConvertFn;
  sourceText: string;
  titleFallback: string;
  bibliography?: { name: string; blob: Blob } | null;
  csl?: { name: string; blob: Blob } | null;
  extraFiles?: Record<string, string | Blob>;
  /**
   * Ancres OBBPAG (legacy). Défaut false : la sync pages utilise l’alignement
   * texte PDF → HTML (coupures mid-paragraphe, un marqueur par page).
   */
  paginationAnchors?: boolean;
  /**
   * Page de titre Pandoc EPUB (défaut false).
   * Aligner sur l’option livre `title-page` du PDF pour rester cohérent.
   */
  epubTitlePage?: boolean;
}): Promise<{ epub: Uint8Array; stderr: string; preparedMarkdown: string; maxAnchor: number }> {
  const prepared = prepareMarkdownForBookExport(params.sourceText, {
    bibliography: Boolean(params.bibliography),
    paginationAnchors: params.paginationAnchors === true,
  });

  const outputName = "book.epub";
  // pandoc-wasm attend la clé « output-file » (pas « output ») pour les binaires.
  const options: Record<string, unknown> = {
    from: "markdown",
    to: "epub",
    standalone: true,
    "output-file": outputName,
    // Pandoc ajoute sinon une page de titre dès qu’un metadata title est présent.
    "epub-title-page": params.epubTitlePage === true,
  };
  if (params.titleFallback?.trim()) {
    options.metadata = { title: params.titleFallback.trim() };
  }

  const files: Record<string, string | Blob> = {};
  if (params.extraFiles) {
    for (const [k, v] of Object.entries(params.extraFiles)) files[k] = v;
  }
  for (const [k, bytes] of Object.entries(prepared.dataUriFiles)) {
    files[k] = new Blob([Uint8Array.from(bytes)]);
  }
  if (params.bibliography) {
    options.citeproc = true;
    options.bibliography = params.bibliography.name;
    files[params.bibliography.name] = params.bibliography.blob;
    if (params.csl) {
      options.csl = params.csl.name;
      files[params.csl.name] = params.csl.blob;
    }
  }

  const result = await params.convert(options, prepared.markdown, files);
  const picked = await pickEpubBytes(result.files ?? {}, outputName, result.stdout || "");
  if (!picked) {
    const keys = Object.keys(result.files ?? {}).join(", ") || "(aucun)";
    throw new Error(
      `Pandoc n’a pas produit d’EPUB valide (ZIP). Fichiers: ${keys}. stderr: ${(result.stderr || "").slice(0, 400)}`,
    );
  }

  return {
    epub: picked.bytes,
    stderr: result.stderr || "",
    preparedMarkdown: prepared.markdown,
    maxAnchor: prepared.maxAnchor,
  };
}

function pageBreakSpan(page: number): string {
  // EPUB3 : pagebreak + title (n° imprimé) ; pas de texte visible — la page-list suffit.
  return (
    `<span epub:type="pagebreak" role="doc-pagebreak" id="page-${page}" ` +
    `title="${page}" aria-label="${page}"/>`
  );
}

/**
 * Injecte les pagebreaks EPUB3 en alignant le texte de chaque page PDF sur le XHTML
 * (une marque par page, y compris au milieu d’un paragraphe).
 */
export async function patchEpubPrintPageList(
  epubBytes: Uint8Array,
  pageTexts: string[],
): Promise<Uint8Array> {
  if (!pageTexts.length) return epubBytes;

  if (!looksLikeZip(epubBytes)) {
    throw new Error(
      `Données EPUB invalides (pas un ZIP, ${epubBytes.byteLength} octets) — impossible d’injecter la page-list.`,
    );
  }

  const zip = await JSZip.loadAsync(epubBytes);
  const pageListEntries: { page: number; href: string }[] = [];

  const htmlPaths = Object.keys(zip.files)
    .filter((p) => !zip.files[p]!.dir && /\.(x?html?)$/i.test(p))
    .filter((p) => !/nav\.xhtml$/i.test(p) && !/toc\.xhtml$/i.test(p) && !/obb-page-list/i.test(p))
    .sort();

  // Un seul flux texte si plusieurs fichiers chapitre : on aligne page par page
  // en avançant dans la liste des pages PDF à mesure que des coupures sont trouvées.
  let pageOffset = 0;
  for (const path of htmlPaths) {
    let html = await zip.file(path)!.async("string");
    const remaining = pageTexts.slice(pageOffset);
    if (!remaining.length) break;

    const breaks = findPdfPageBreaksInHtml(html, remaining, pageOffset);
    if (!breaks.length) continue;

    // Chemin relatif depuis EPUB/ (nav.xhtml) — ex. text/ch001.xhtml
    const hrefPath = path.replace(/^EPUB\//i, "");
    html = insertPageBreaksIntoHtml(html, breaks, (page) => {
      if (!pageListEntries.some((e) => e.page === page)) {
        pageListEntries.push({ page, href: `${hrefPath}#page-${page}` });
      }
      return pageBreakSpan(page);
    });
    zip.file(path, html);

    const maxPage = breaks.reduce((m, b) => Math.max(m, b.page), pageOffset);
    pageOffset = maxPage; // index 0-based pour slice = n° de page déjà couverte
  }

  pageListEntries.sort((a, b) => a.page - b.page);
  const seen = new Set<number>();
  const unique = pageListEntries.filter((e) => {
    if (seen.has(e.page)) return false;
    seen.add(e.page);
    return true;
  });

  if (unique.length === 0) {
    throw new Error(
      "Impossible d’aligner les pages PDF sur l’EPUB (texte introuvable). Vérifiez que le PDF et le Markdown correspondent.",
    );
  }

  await ensureEpubPageListNav(zip, unique);

  return zip.generateAsync({
    type: "uint8array",
    mimeType: "application/epub+zip",
    compression: "DEFLATE",
  });
}

async function ensureEpubPageListNav(
  zip: JSZip,
  entries: { page: number; href: string }[],
): Promise<void> {
  const navPath =
    Object.keys(zip.files).find((p) => /nav\.xhtml$/i.test(p)) ||
    Object.keys(zip.files).find((p) => /toc\.xhtml$/i.test(p));

  const olItems = entries
    .map((e) => `      <li><a href="${escapeXml(e.href)}">${e.page}</a></li>`)
    .join("\n");

  const pageListNav = [
    `<nav epub:type="page-list" id="obb-page-list" hidden="hidden">`,
    `  <h1>Pages</h1>`,
    `  <ol>`,
    olItems,
    `  </ol>`,
    `</nav>`,
  ].join("\n");

  if (navPath && zip.file(navPath)) {
    let nav = await zip.file(navPath)!.async("string");
    if (/epub:type=["']page-list["']/.test(nav)) {
      nav = nav.replace(
        /<nav[^>]*epub:type=["']page-list["'][^>]*>[\s\S]*?<\/nav>/i,
        pageListNav,
      );
    } else if (/<\/body>/i.test(nav)) {
      nav = nav.replace(/<\/body>/i, `${pageListNav}\n</body>`);
    } else {
      nav += `\n${pageListNav}\n`;
    }
    if (!/xmlns:epub=/.test(nav) && /<html\b/i.test(nav)) {
      nav = nav.replace(
        /<html\b([^>]*)>/i,
        `<html$1 xmlns:epub="http://www.idpf.org/2007/ops">`,
      );
    }
    zip.file(navPath, nav);
    return;
  }

  const contentPath =
    Object.keys(zip.files).find((p) => /content\.opf$/i.test(p)) ||
    Object.keys(zip.files).find((p) => /\.opf$/i.test(p));
  const baseDir = contentPath ? contentPath.replace(/[^/]+$/, "") : "";
  const newNavPath = `${baseDir}obb-page-list.xhtml`;
  const navDoc = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="fr" xml:lang="fr">
<head><title>Pages</title><meta charset="utf-8"/></head>
<body>
${pageListNav}
</body>
</html>
`;
  zip.file(newNavPath, navDoc);

  if (contentPath && zip.file(contentPath)) {
    let opf = await zip.file(contentPath)!.async("string");
    const navHref = newNavPath.slice(baseDir.length);
    if (!opf.includes(navHref) && /<manifest[\s\S]*?>/i.test(opf)) {
      opf = opf.replace(
        /(<manifest[^>]*>)/i,
        `$1\n    <item id="obb-page-list" href="${escapeXml(navHref)}" media-type="application/xhtml+xml" properties="nav"/>`,
      );
      zip.file(contentPath, opf);
    }
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");
}

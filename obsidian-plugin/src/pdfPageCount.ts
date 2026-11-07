import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";

let workerConfigured = false;

/** À appeler au chargement du plugin (URI du worker servi par Obsidian ou file:// desktop). */
export function initPdfJsWorker(workerSrc: string): void {
  const src = workerSrc?.trim();
  if (!src) return;
  GlobalWorkerOptions.workerSrc = src;
  workerConfigured = true;
}

function ensurePdfJsWorker(): void {
  if (!workerConfigured && !GlobalWorkerOptions.workerSrc) {
    throw new Error(
      'PDF.js : worker non configuré. Vérifiez que "pdf.worker.min.mjs" est bien dans le dossier du plugin.',
    );
  }
}

/** Compte les pages d’un PDF (imposition, métadonnées). */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  ensurePdfJsWorker();
  const loadingTask = getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
    disableRange: true,
    disableStream: true,
  });
  const pdf = await loadingTask.promise;
  try {
    return pdf.numPages;
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
}

/** Textes bruts page par page (jetons OBBPAG pour sync EPUB). */
export async function extractPdfPageTexts(bytes: Uint8Array): Promise<string[]> {
  ensurePdfJsWorker();
  const loadingTask = getDocument({
    data: bytes.slice(),
    useSystemFonts: true,
    disableRange: true,
    disableStream: true,
  });
  const pdf = await loadingTask.promise;
  try {
    const texts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const parts: string[] = [];
      for (const item of content.items) {
        if (item && typeof item === "object" && "str" in item) {
          parts.push(String((item as { str: string }).str));
        }
      }
      texts.push(parts.join(""));
    }
    return texts;
  } finally {
    await pdf.destroy().catch(() => undefined);
  }
}

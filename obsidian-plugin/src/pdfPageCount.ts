import { getDocument } from "pdfjs-dist";

/** Compte les pages sans worker PDF.js (renderer Electron). */
export async function countPdfPages(bytes: Uint8Array): Promise<number> {
  const loadingTask = getDocument({
    data: bytes,
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

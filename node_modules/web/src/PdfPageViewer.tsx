import { useEffect, useRef, useState } from "react";
import { getDocument } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut } from "lucide-react";

type Props = {
  file: File | null;
  /** URL blob du même PDF (si `file` est absent, utilisée seule) */
  url: string;
  /** Nom du fichier pour l’attribut `download` du lien */
  downloadFileName?: string;
};

const SCALE_MIN = 0.6;
const SCALE_MAX = 2.5;
const SCALE_STEP = 0.15;

export function PdfPageViewer({ file, url, downloadFileName }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [scale, setScale] = useState(1.25);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);

  useEffect(() => {
    if (!file && !url) {
      const p = pdfRef.current;
      pdfRef.current = null;
      void p?.destroy().catch(() => {});
      setNumPages(0);
      setLoadError(null);
      return;
    }

    let cancelled = false;
    setLoadError(null);

    void (async () => {
      const prev = pdfRef.current;
      pdfRef.current = null;
      void prev?.destroy().catch(() => {});

      try {
        const task = file ? getDocument({ data: await file.arrayBuffer() }) : getDocument({ url });
        const pdf = await task.promise;
        if (cancelled) {
          await pdf.destroy();
          return;
        }
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setPage(1);
      } catch (e) {
        if (!cancelled) {
          setLoadError((e as Error).message ?? "Lecture PDF impossible");
          setNumPages(0);
        }
      }
    })();

    return () => {
      cancelled = true;
      const p = pdfRef.current;
      pdfRef.current = null;
      void p?.destroy().catch(() => {});
    };
  }, [file, url]);

  useEffect(() => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas || numPages === 0 || page < 1 || page > numPages) return;

    let cancelled = false;
    setRendering(true);

    void (async () => {
      try {
        const pdfPage = await pdf.getPage(page);
        if (cancelled) return;
        const viewport = pdfPage.getViewport({ scale });
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);
        await pdfPage.render({ canvas, canvasContext: ctx, viewport }).promise;
      } catch (e) {
        if (!cancelled) setLoadError((e as Error).message ?? "Rendu page impossible");
      } finally {
        if (!cancelled) setRendering(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [page, numPages, scale]);

  if (!file && !url) {
    return null;
  }

  if (loadError && numPages === 0) {
    return <p className="warn">{loadError}</p>;
  }

  const canPrev = page > 1;
  const canNext = page < numPages;

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer-toolbar">
        <button
          type="button"
          className="btn-icon"
          disabled={!canPrev || rendering}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          aria-label="Page precedente"
        >
          <ChevronLeft size={22} aria-hidden />
        </button>
        <label className="pdf-viewer-page-label">
          Page
          <input
            type="number"
            min={1}
            max={Math.max(1, numPages)}
            value={page}
            onChange={(e) => {
              const v = Number(e.target.value);
              if (!Number.isFinite(v)) return;
              setPage(Math.min(Math.max(1, Math.floor(v)), numPages));
            }}
            aria-label="Numero de page"
          />
          <span className="pdf-viewer-page-total"> / {numPages || "…"}</span>
        </label>
        <button
          type="button"
          className="btn-icon"
          disabled={!canNext || rendering}
          onClick={() => setPage((p) => Math.min(numPages, p + 1))}
          aria-label="Page suivante"
        >
          <ChevronRight size={22} aria-hidden />
        </button>
        <a
          className="btn-icon pdf-viewer-download"
          href={url}
          download={downloadFileName ?? "document.pdf"}
          title={`Telecharger ${downloadFileName ?? "PDF"}`}
          aria-label="Telecharger le PDF"
        >
          <Download size={18} aria-hidden />
        </a>
        <span className="pdf-viewer-zoom">
          <button
            type="button"
            className="btn-icon"
            disabled={scale <= SCALE_MIN}
            onClick={() => setScale((s) => Math.max(SCALE_MIN, s - SCALE_STEP))}
            aria-label="Zoom arriere"
          >
            <ZoomOut size={18} aria-hidden />
          </button>
          <span className="pdf-viewer-zoom-value">{Math.round(scale * 100)}%</span>
          <button
            type="button"
            className="btn-icon"
            disabled={scale >= SCALE_MAX}
            onClick={() => setScale((s) => Math.min(SCALE_MAX, s + SCALE_STEP))}
            aria-label="Zoom avant"
          >
            <ZoomIn size={18} aria-hidden />
          </button>
        </span>
      </div>
      <div className="pdf-viewer-canvas-wrap">
        {rendering ? <div className="pdf-viewer-loading">Rendu…</div> : null}
        <canvas ref={canvasRef} className="pdf-viewer-canvas" />
      </div>
      {loadError && numPages > 0 ? <p className="warn pdf-viewer-warn">{loadError}</p> : null}
    </div>
  );
}

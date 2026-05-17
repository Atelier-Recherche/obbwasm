/**
 * Résout les URLs « proxy » (Next.js Image, etc.) vers l’URL directe du fichier image.
 */
export function resolveRemoteImageFetchUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return trimmed;
  try {
    const u = new URL(trimmed);
    if (u.pathname.includes("/_next/image")) {
      const inner = u.searchParams.get("url");
      if (inner) return safeDecodeUriComponent(inner);
    }
    const qUrl = u.searchParams.get("url");
    if (qUrl && looksLikeImagePath(qUrl)) {
      return safeDecodeUriComponent(qUrl);
    }
  } catch {
    /* URL relative ou invalide — laisser tel quel */
  }
  return trimmed;
}

function safeDecodeUriComponent(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function looksLikeImagePath(s: string): boolean {
  const decoded = safeDecodeUriComponent(s);
  return /\.(webp|avif|jpe?g|png|gif|svg)(\?|#|$)/i.test(decoded);
}

const CACHE_NAME = "obbwasm-v1";

/** Met en cache le WASM Typst (et autres URLs idempotentes) pour les visites suivantes. */
export async function fetchCachedArrayBuffer(url: string): Promise<ArrayBuffer> {
  try {
    const cache = await caches.open(CACHE_NAME);
    const req = new Request(url, { mode: "cors" });
    const hit = await cache.match(req);
    if (hit) {
      return await hit.arrayBuffer();
    }
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    await cache.put(req, res.clone());
    return await res.arrayBuffer();
  } catch {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Impossible de charger ${url}: ${res.status}`);
    return await res.arrayBuffer();
  }
}

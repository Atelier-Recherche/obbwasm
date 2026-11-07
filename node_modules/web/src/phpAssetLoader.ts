import type { ObbWasmAssetLoader } from "@obbwasm/core";

export function createPhpAssetLoader(
  apiBase: string,
  apiFetch: (input: string | URL, init?: RequestInit) => Promise<Response>,
): ObbWasmAssetLoader {
  return {
    async fetchTextFile(projectRelativePath: string) {
      const res = await apiFetch(`${apiBase}/template-source.php?path=${encodeURIComponent(projectRelativePath)}`);
      const data = (await res.json()) as { ok?: boolean; source?: string };
      return data.ok && typeof data.source === "string" ? data.source : null;
    },
    async listFontEntries() {
      const res = await apiFetch(`${apiBase}/font-assets.php?action=list`);
      const data = (await res.json()) as { ok?: boolean; items?: Array<{ path: string; name: string }> };
      return data.ok ? data.items ?? [] : [];
    },
    async fetchFontBuffer(path: string) {
      const res = await apiFetch(`${apiBase}/font-assets.php?action=file&path=${encodeURIComponent(path)}`);
      if (!res.ok) throw new Error(`Police HTTP ${res.status}`);
      return await res.arrayBuffer();
    },
    async listTypstPackages() {
      const res = await apiFetch(`${apiBase}/typst-packages.php`);
      const data = (await res.json()) as { ok?: boolean; items?: Array<{ id: string }> };
      return data.ok ? data.items ?? [] : [];
    },
    async fetchTypstPackageZip(id: string) {
      const res = await apiFetch(`${apiBase}/typst-packages.php?action=archive&id=${encodeURIComponent(id)}`);
      if (!res.ok) return null;
      return await res.arrayBuffer();
    },
  };
}

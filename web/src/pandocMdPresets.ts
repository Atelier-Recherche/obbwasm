/** Options Pandoc WASM pour normaliser vers Markdown par format source. */

export type MdNormalizePreset = Record<string, unknown>;

const STORAGE_KEY = "obbwasm-pandoc-md-presets-v1";

export const defaultMdPresets: Record<string, MdNormalizePreset> = {
  md: { to: "markdown", standalone: false },
  docx: { from: "docx", to: "markdown", standalone: false },
  html: { from: "html", to: "markdown", standalone: false },
  epub: { from: "epub", to: "markdown", standalone: false },
  latex: { from: "latex", to: "markdown", standalone: false },
  odt: { from: "odt", to: "markdown", standalone: false },
  rtf: { from: "rtf", to: "markdown", standalone: false },
  txt: { from: "plain", to: "markdown", standalone: false },
  pdf: {
    from: "pdf",
    to: "markdown",
    standalone: false,
  },
};

export function loadMdPresets(): Record<string, MdNormalizePreset> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...defaultMdPresets };
    const parsed = JSON.parse(raw) as Record<string, MdNormalizePreset>;
    return { ...defaultMdPresets, ...parsed };
  } catch {
    return { ...defaultMdPresets };
  }
}

export function saveMdPresets(presets: Record<string, MdNormalizePreset>): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

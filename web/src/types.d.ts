declare module "pandoc-wasm" {
  export interface PandocConvertResult {
    stdout: string;
    stderr: string;
    warnings: unknown[];
    files: Record<string, string | Blob>;
    mediaFiles: Record<string, string | Blob>;
  }

  export function convert(
    options: Record<string, unknown>,
    stdin: string | null,
    files: Record<string, string | Blob>,
  ): Promise<PandocConvertResult>;
}

declare module "@myriaddreamin/typst-ts-web-compiler/pkg/typst_ts_web_compiler.mjs" {
  export function setImportWasmModule(
    importer: (wasm_name: string, url: string) => Promise<ArrayBuffer>,
  ): void;
}

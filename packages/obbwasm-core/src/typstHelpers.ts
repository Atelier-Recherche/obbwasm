export function overrideTypstLet(source: string, key: string, valueExpr: string): string {
  const rx = new RegExp(`#let\\s+${key}\\s*=\\s*.*`, "g");
  if (rx.test(source)) {
    return source.replace(rx, `#let ${key} = ${valueExpr}`);
  }
  return `#let ${key} = ${valueExpr}\n${source}`;
}

export function firstDiagnosticMessage(compiled: unknown): string {
  const list = (compiled as { diagnostics?: Array<{ message?: string }> } | null)?.diagnostics ?? [];
  if (!Array.isArray(list) || list.length === 0) return "";
  const msg = list[0]?.message;
  return typeof msg === "string" ? msg : "";
}

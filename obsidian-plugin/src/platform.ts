/** Accès Node dans Obsidian desktop (renderer Electron). */
export function nodeFs(): typeof import("node:fs") {
  interface ReqWin {
    require?: (id: string) => unknown;
  }
  const req = (window as ReqWin).require;
  if (!req) throw new Error("FS indisponible (mobile ou sandbox).");
  return req("fs") as typeof import("node:fs");
}

export function nodePath(): typeof import("node:path") {
  interface ReqWin {
    require?: (id: string) => unknown;
  }
  const req = (window as ReqWin).require;
  if (!req) throw new Error("path indisponible.");
  return req("path") as typeof import("node:path");
}

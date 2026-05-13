/** Accès Node dans Obsidian desktop (renderer Electron). */
export function nodeFs(): typeof import("node:fs") {
  interface ReqWin {
    require?: (id: string) => unknown;
  }
  const req = (window as ReqWin).require;
  if (!req) throw new Error("FS indisponible (mobile ou sandbox).");
  return req("fs") as typeof import("node:fs");
}

/** `null` si l’environnement n’expose pas `fs` (ex. Obsidian mobile). */
export function tryNodeFs(): typeof import("node:fs") | null {
  interface ReqWin {
    require?: (id: string) => unknown;
  }
  const req = (window as ReqWin).require;
  if (!req) return null;
  try {
    return req("fs") as typeof import("node:fs");
  } catch {
    return null;
  }
}

export function nodePath(): typeof import("node:path") {
  interface ReqWin {
    require?: (id: string) => unknown;
  }
  const req = (window as ReqWin).require;
  if (!req) throw new Error("path indisponible.");
  return req("path") as typeof import("node:path");
}

export function tryNodePath(): typeof import("node:path") | null {
  interface ReqWin {
    require?: (id: string) => unknown;
  }
  const req = (window as ReqWin).require;
  if (!req) return null;
  try {
    return req("path") as typeof import("node:path");
  } catch {
    return null;
  }
}

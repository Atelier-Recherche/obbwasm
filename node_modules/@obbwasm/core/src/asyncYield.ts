/** Laisse respirer la boucle d’événements (évite gel Obsidian sur gros documents). */
export function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, 0);
  });
}

export function withAsyncTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> {
  if (ms <= 0) return promise;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} : délai dépassé (${Math.round(ms / 1000)} s).`)), ms);
    }),
  ]);
}

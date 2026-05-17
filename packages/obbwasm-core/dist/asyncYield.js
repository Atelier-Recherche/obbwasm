/** Laisse respirer la boucle d’événements (évite gel Obsidian sur gros documents). */
export function yieldToMainThread() {
    return new Promise((resolve) => {
        setTimeout(resolve, 0);
    });
}
export function withAsyncTimeout(promise, ms, label) {
    if (ms <= 0)
        return promise;
    return Promise.race([
        promise,
        new Promise((_, reject) => {
            setTimeout(() => reject(new Error(`${label} : délai dépassé (${Math.round(ms / 1000)} s).`)), ms);
        }),
    ]);
}
//# sourceMappingURL=asyncYield.js.map
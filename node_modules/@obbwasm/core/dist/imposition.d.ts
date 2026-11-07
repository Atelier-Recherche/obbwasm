/** Spec parsée depuis le nom du fichier imposition (ex. ...-4spread.typ). */
export type ImpositionTemplateSpec = {
    packetSize: number;
    kind: "signature" | "spread";
};
export declare function parseImpositionTemplateSpec(path: string): ImpositionTemplateSpec | null;
export declare function reorderSpreadSequence(pages: number[]): number[];
export declare function chunkArray<T>(arr: T[], size: number): T[][];
/**
 * Paquets d’imposition à partir des pages 1..N.
 *
 * Spread (« à cheval ») : une seule brochure imbriquée (feuilles emboîtées).
 *   — blancs en fin pour atteindre un multiple de 4 (une feuille = 4 pages) ;
 *   — puis reorder global du bloc → ex. 5 pages → [1,□,2,□,3,□,4,5]
 *     donc première feuille □|1 / 2|□ (pas des cahiers 4|1 indépendants).
 *
 * Signature : cahiers séparés de `packetSize` pages (padding + découpe séquentielle ;
 *   le mapping left/right est dans buildImpositionMainTyp).
 */
export declare function buildImpositionPackets(kind: "signature" | "spread", pages: number[], packetSize: number): number[][];
export declare function buildImpositionMainTyp(kind: "signature" | "spread", packetSize: number, packets: number[][], compensationMm: number): string;
/** Grammes -> épaisseur feuille mm (même table que le site). */
export declare const PAPER_THICKNESS_MM: Record<number, number>;
export declare function spineThicknessMm(innerPages: number, grammage: number): number;
//# sourceMappingURL=imposition.d.ts.map
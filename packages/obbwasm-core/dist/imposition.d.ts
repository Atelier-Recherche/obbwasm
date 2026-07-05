/** Spec parsée depuis le nom du fichier imposition (ex. ...-4spread.typ). */
export type ImpositionTemplateSpec = {
    packetSize: number;
    kind: "signature" | "spread";
};
/** Géométrie lue dans le bloc `@obbwasm-meta` du gabarit `.typ`. */
export type ImpositionLayout = {
    mode: "signature-2up" | "signature-grid" | "spread-pair";
    packetSize: number;
    sheetWidth: string;
    sheetHeight: string;
    cellWidth: string;
    cellHeight: string;
    gridCols: number;
    gridRows: number;
    /** Décalage vertical de la 2e rangée (ex. `-0.4mm` pour calage A3). */
    gridRow2DyOffset: string;
};
export declare function parseImpositionTemplateSpec(path: string): ImpositionTemplateSpec | null;
/** Lit `imposition-mode`, dimensions et grille dans `@obbwasm-meta`. */
export declare function parseImpositionMeta(source: string): ImpositionLayout | null;
export declare function reorderSpreadSequence(pages: number[]): number[];
export declare function chunkArray<T>(arr: T[], size: number): T[][];
export declare function buildImpositionMainTyp(kind: "signature" | "spread", packetSize: number, packets: number[][], compensationMm: number): string;
/** Choisit le générateur selon le meta du gabarit (pas de nom de format hardcodé). */
export declare function buildImpositionTyp(params: {
    layout: ImpositionLayout | null;
    kind: "signature" | "spread";
    packetSize: number;
    packets: number[][];
    compensationMm: number;
}): string;
/** Grammes -> épaisseur feuille mm (même table que le site). */
export declare const PAPER_THICKNESS_MM: Record<number, number>;
export declare function spineThicknessMm(innerPages: number, grammage: number): number;
//# sourceMappingURL=imposition.d.ts.map
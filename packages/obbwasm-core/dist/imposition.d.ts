/** Spec parsée depuis le nom du fichier imposition (ex. ...-4spread.typ). */
export type ImpositionTemplateSpec = {
    packetSize: number;
    kind: "signature" | "spread";
};
export declare function parseImpositionTemplateSpec(path: string): ImpositionTemplateSpec | null;
export declare function reorderSpreadSequence(pages: number[]): number[];
export declare function chunkArray<T>(arr: T[], size: number): T[][];
export declare function buildImpositionMainTyp(kind: "signature" | "spread", packetSize: number, packets: number[][], compensationMm: number): string;
/** Grammes -> épaisseur feuille mm (même table que le site). */
export declare const PAPER_THICKNESS_MM: Record<number, number>;
export declare function spineThicknessMm(innerPages: number, grammage: number): number;
//# sourceMappingURL=imposition.d.ts.map
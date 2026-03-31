// lib/types/graph.ts
export interface FeatureAnswer {
    id: string;
    x: number | '';
    y: number | '';
}

export interface EquationEntry {
    id: string;
    expr: string;
    color: string;
}

export interface GraphFeatureData {
    equations: EquationEntry[];
    xLabel?: string;
    yLabel?: string;
    xMin: number; xMax: number;
    yMin: number; yMax: number;
    features: FeatureAnswer[];
}
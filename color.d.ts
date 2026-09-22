// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
export type Rgba = readonly [number, number, number, number];
export declare const WHITE: Rgba;
/** Parse '#rgb' | '#rrggbb' | '#rrggbbaa' to [r,g,b,a] floats 0..1 (cached). */
export declare function rgba(hex: string): Rgba;

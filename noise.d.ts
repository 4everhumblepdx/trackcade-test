// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Tiny fast seeded PRNG (mulberry32) — good enough for permutation shuffles. */
export declare function mulberry32(seed: number): () => number;
/** Seeded permutation table (512 entries, doubled) for the lattice hash. */
export declare function noisePerm(seed?: number): Uint8Array;
/**
 * 2D Perlin gradient noise in ~[-1, 1]. `period` > 0 wraps the lattice so
 * the pattern TILES every `period` units (keep period ≤ 256).
 */
export declare function perlin2(x: number, y: number, perm: Uint8Array, period?: number): number;
export interface FbmOptions {
    octaves?: number;
    lacunarity?: number;
    gain?: number;
    /** Tiling period of the BASE octave (each octave wraps at period·lacunarityⁿ). */
    period?: number;
}
/** Fractal Brownian motion over perlin2 — layered detail, still ~[-1, 1]. */
export declare function fbm2(x: number, y: number, perm: Uint8Array, opts?: FbmOptions): number;
export interface NoiseTextureOptions {
    /** Texture size in px (default 256). */
    size?: number;
    /** Feature size in px — one lattice cell of the base octave (default size/4). */
    cell?: number;
    octaves?: number;
    seed?: number;
    /** Seamless wrap (default true) — uvScroll loops with no visible edge. */
    tile?: boolean;
    lacunarity?: number;
    gain?: number;
}
/** Noise field as Float32Array in [0, 1], row-major size×size. DOM-free. */
export declare function noiseData(opts?: NoiseTextureOptions): {
    data: Float32Array<ArrayBuffer>;
    size: number;
};
/**
 * Noise as a canvas, ready for `game.assets.frames()`. Two shapes:
 * - default: opaque grayscale (a lookup/pattern texture);
 * - `alpha: true`: WHITE with noise in the ALPHA channel — the smoke/steam
 *   shape (tint it with the sprite verb, stack layers, scroll it).
 * `mask: 'radial'` multiplies in a soft circular falloff — the PUFF shape
 * (a single billow of smoke/steam/cloud with no visible quad edge). Masked
 * textures no longer tile; draw them whole and vary with `rot`/seeds.
 */
export declare function noiseCanvas(opts?: NoiseTextureOptions & {
    alpha?: boolean;
    mask?: 'radial';
}): HTMLCanvasElement;

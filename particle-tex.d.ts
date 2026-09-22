// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
export type ParticleTexKind = 'soft' | 'flare' | 'ring' | 'star' | 'spark' | 'petal';
export interface ParticleTexOptions {
    /** Which classic: 'soft' (radial glow puff), 'flare' (glow + streak
     * cross), 'ring' (soft halo band), 'star' (5-point star in a glow),
     * 'spark' (a thin horizontal streak — pair with `spin` or velocity),
     * 'petal' (a flower petal with the sakura notch at the tip — pair with
     * `spin` + the GPU emitter's `flutter`/`tumble`). */
    kind?: ParticleTexKind;
    /** Texture size in px (default 64 — particles are small on screen). */
    size?: number;
    /** Star points (star only, default 5). */
    points?: number;
    /** Core-to-halo balance 0..1 (default 0.5): higher = a bigger hot core. */
    core?: number;
}
/** Paint a classic particle texture onto a fresh canvas (all white +
 * alpha — tint at emit time). */
export declare function particleCanvas(opts?: ParticleTexOptions): HTMLCanvasElement;

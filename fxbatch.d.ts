// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { Frame } from './atlas.js';
export interface SpriteFx {
    /** Soft additive halo emanating from the body. */
    glow?: {
        color?: string;
        size?: number;
    };
    /** Solid rim around the body (selection look). */
    outline?: {
        color?: string;
        size?: number;
    };
    /** Gaussian-ish blur of the sprite itself. */
    blur?: {
        size?: number;
    };
    /** Colour over the pixels; with `duration` it decays + auto-clears (hit feedback). */
    flash?: {
        color?: string;
        amount?: number;
        duration?: number; /** @internal */
        _left?: number;
    };
    /** Persistent colour overlay (status looks) — one colour, or a 4-corner GRADIENT
     * across the sprite: colors = [topLeft, topRight, bottomLeft, bottomRight]. */
    tint?: {
        color?: string;
        colors?: [string, string, string, string];
        amount?: number;
    };
    /** Chunky-pixel downsample of this sprite only. */
    pixelate?: {
        size?: number;
    };
    /** Horizontal band ripple (hologram). */
    wobble?: {
        size?: number;
        speed?: number;
    };
    /** Slice offsets + RGB split. */
    glitch?: {
        amount?: number;
        speed?: number;
    };
    /** Organic noise dissolve: t 0 (whole) → 1 (gone), burning edge. */
    dissolve?: {
        t: number;
        seed?: number;
        color?: string;
    };
    /** Expanding circular clip: t 0 (hidden) → 1 (shown); invert flips. */
    reveal?: {
        t: number;
        invert?: boolean;
    };
    /** Random draw-offset jitter; with `duration` it decays + auto-clears. CPU — rides the normal batches. */
    shake?: {
        amount: number;
        duration?: number; /** @internal */
        _left?: number;
    };
    /** Squash-and-stretch oscillation (Hz); `cycles` makes it a one-shot pop. CPU. */
    squash?: {
        amount?: number;
        speed?: number;
        cycles?: number; /** @internal */
        _t?: number;
    };
}
/** True when the bag needs the fx shader (glow is the GlowPass's job; shake/squash are CPU transforms). */
export declare function fxNeedsShader(fx: SpriteFx): boolean;
/** The dedicated per-object-fx batch (see file header). API mirrors QuadBatch. */
export declare class FxBatch {
    private format;
    /** The surface's submission-order log — see batch.ts's DrawOrder. */
    private order;
    private layer;
    private uploaded;
    /** @see QuadBatch.setLayer */
    setLayer(n: number): void;
    private data;
    private count;
    private capacity;
    private uniformData;
    private filter;
    private device;
    private pipeline;
    private layout;
    private sampler;
    private uniforms;
    private instances;
    private textureView;
    private bind;
    constructor(device: GPUDevice, format: GPUTextureFormat, opts?: {
        filter?: GPUFilterMode;
        capacity?: number;
    });
    rebuild(device: GPUDevice): void;
    setTexture(view: GPUTextureView): void;
    private makeBind;
    begin(x: number, y: number, w: number, h: number): void;
    /** Queue one fx sprite (margin expansion + uv extrapolation done here). */
    push(x: number, y: number, w: number, h: number, f: Frame, rot: number, flipX: boolean, z: number, fx: SpriteFx, time: number, tr: number, tg: number, tb: number, ta: number): void;
    private grow;
    private upload;
    flush(pass: GPURenderPassEncoder): number;
}

// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { GrassOptions } from '../grass3d.js';
/** Per-frame uniforms the blade program consumes (world.ts's FrameU is a
 * structural superset). */
export interface GrassFrameU {
    vp: Float32Array;
    camPos: readonly number[];
    fogColor: readonly number[];
    params: readonly number[];
    lightDir: readonly number[];
    right: readonly number[];
    ambSky: readonly number[];
    ambGround: readonly number[];
    sunCol: readonly number[];
}
/** A follow-window blade field bound to one terrain — the GL Grass3d. */
export declare class GlGrass3d {
    private readonly field;
    private readonly colormap;
    /** Live dials (grass3d parity where portable). */
    showBlades: boolean;
    /** Straw/hay recolour 0..1 — live. */
    dryness: number;
    dead: boolean;
    readonly span: number;
    readonly cells: number;
    private height;
    private width;
    private windDir;
    private windStr;
    private dynamic;
    private groundTint;
    private green;
    /** Far billboard cards (grass3d parity where portable). */
    showCards: boolean;
    /** Fraction of the field that flowers (drift-gated). Live-mutable. */
    flowerAmount: number;
    private farSpan;
    private cardW;
    private cardH;
    private flowerCount;
    private cardFrames;
    private gl;
    private prog;
    private vao;
    private inst;
    private data;
    private count;
    private cardProg;
    private cardVao;
    private cardInst;
    private cardData;
    private cardCount;
    private cardTex;
    constructor(gl: WebGL2RenderingContext, field: {
        heights: Float32Array;
        res: number;
        size: number;
    }, colormap: {
        pixels: Uint8ClampedArray;
        res: number;
    }, opts?: GrassOptions);
    rebuild(gl: WebGL2RenderingContext): void;
    private makeCardTexture;
    /** Grass CLUMP silhouette — grass3d.drawGrassClump, verbatim. */
    private drawGrassClump;
    /** FLOWER cluster — grass3d.drawFlowerClump, verbatim (albedo petals). */
    private drawFlowerClump;
    /** Terrain height — the baked-heightfield bilinear the compute used
     * (dim = res+1; texel i ↔ world (i/res − 0.5)·size). */
    private groundAt;
    /** CPU SPAWN — bladeComputeWGSL's per-cell maths over the follow lattice,
     * packing surviving blades (≤ MAX_BLADES) for one instanced draw. */
    spawn(camX: number, camY: number, camZ: number, planes: Float32Array | null): void;
    /** Low-frequency value noise (cardComputeWGSL's vnoise — flower drifts). */
    private vnoise;
    /** CPU card spawn — cardComputeWGSL's per-cell maths over a coarser far
     * lattice (128² vs 300²), capped at 16k. Existence is WORLD-anchored
     * (grassy ground + far-edge taper only — no camera terms, the flicker/mow
     * lesson); the frustum cull applies only past 30u like the original. */
    private spawnCards;
    /** Draw the packed blades — inside the OPAQUE pass (depth write on, cull
     * off; blades are double-sided). Returns draws issued. */
    draw(frame: GrassFrameU): number;
    /** Draw the far cards — cardRenderWGSL's pass (Y-billboards, alpha test,
     * depth write on, cull off), sharing the frame uniforms. */
    private drawCards;
    destroy(): void;
}

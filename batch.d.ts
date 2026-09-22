// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { Frame } from './atlas.js';
/** Max distinct z values per frame — z is normalized by this in the shader. */
export declare const Z_RANGE: number;
/** The depth buffer format every pipeline in the frame's pass must match. */
export declare const DEPTH_FORMAT: GPUTextureFormat;
export interface BatchOptions {
    /** Opaque alpha-cutout pipeline (depth write) vs translucent blend pipeline (depth test only). */
    cutout?: boolean;
    /** Set false for screen-space content (HUD) that must ignore world depth entirely. */
    depthTest?: boolean;
    /** Blend equation for non-cutout batches: normal alpha or additive (glows, fire, magic). */
    blend?: 'alpha' | 'add';
    /** Texture sampling: 'linear' (smooth, the default) or 'nearest'. */
    filter?: GPUFilterMode;
    /** Pixel-art blocky sampling: texel-snapped with a 1-screen-pixel AA seam
     * (native-res sprites, fat crisp texels). Forces a linear sampler. */
    blocky?: boolean;
    capacity?: number;
}
/**
 * SUBMISSION ORDER ACROSS PASSES.
 *
 * A sprite and a line of MSDF text are different shaders, so they can never
 * share one batch — but a game that draws a sign, then a wall in front of it,
 * means exactly what it wrote. This records which batch each push went to, in
 * order, so the frame can walk the surface back in submission order and swap
 * pipelines where it has to: sprites … break … text … resume sprites.
 *
 * That costs draw calls, deliberately. A frame that never interleaves records a
 * single segment per batch and is exactly as cheap as it was; only a frame that
 * actually alternates pays, and only in proportion to how often it alternates.
 *
 * `src` identifies the batch. Segments are contiguous instance spans, so each
 * one is a single instanced draw at an offset.
 */
export declare class DrawOrder {
    /** Contiguous spans in submission order. */
    readonly segs: {
        src: number;
        layer: number;
        first: number;
        n: number;
    }[];
    /** Highest layer recorded this frame. */
    maxLayer: number;
    /** Start a frame. */
    begin(): void;
    /** Record that `src` pushed the instance at `index`, on `layer`. */
    put(src: number, index: number, layer: number): void;
}
/**
 * Batch ids used by DrawOrder on a surface. EVERY 2D pass a surface owns is in
 * here: quads, text and panels alike, so call order means the same thing across
 * all of them. `d.panel(...)` then `d.text(...)` puts the text on the panel,
 * because that is what the game wrote.
 */
export declare const SRC_QUADS = 0;
export declare const SRC_TEXT = 1;
export declare const SRC_PANELS = 2;
export declare const SRC_LABELS = 3;
export declare const SRC_CUTOUT = 4;
export declare const SRC_ADD = 5;
export declare const SRC_TRI = 6;
export declare const SRC_GRID = 7;
export declare const SRC_FX = 8;
/**
 * One batch = one pipeline + one atlas texture + one instance buffer. Grows
 * (×2) when a frame pushes past capacity — never shrinks, never drops quads.
 */
export declare class QuadBatch {
    private format;
    private data;
    private count;
    private capacity;
    private cutout;
    private depthTest;
    private additive;
    private blocky;
    private filter;
    private uniformData;
    private device;
    private pipeline;
    private layout;
    private sampler;
    private uniforms;
    private instances;
    private textureView;
    private bind;
    /**
     * LAYERS. A batch normally has exactly one (0) and `flush(pass)` draws the
     * lot — that is every sprite batch in the engine. The UI-label batch uses
     * more: a window claims the next layer up, so everything belonging to it
     * draws above everything on the layer below, and `flush(pass, n)` is called
     * once per layer in step with the panel and MSDF passes. Contiguous spans
     * rather than a per-instance field: layers are claimed in blocks, so the run
     * list stays one or two entries long in practice.
     */
    private runs;
    private layer;
    /** The highest layer pushed this frame — how many times the frame must flush. */
    maxLayer: number;
    /** One upload serves every layer's draw. */
    private uploaded;
    /**
     * The surface's submission-order log, when this batch takes part in one.
     * Set on the SCENE blend batch, whose content must interleave with the text
     * pass; null on every batch whose slot in the frame is fixed.
     */
    private order;
    private src;
    constructor(device: GPUDevice, format: GPUTextureFormat, opts?: BatchOptions);
    /** (Re)create every GPU-side object — the device-loss recovery path. */
    rebuild(device: GPUDevice): void;
    /** Point the batch at its atlas texture (initially and after rebuild/repack). */
    setTexture(view: GPUTextureView): void;
    private makeBind;
    /** Start a frame: map the world rect [x, y, w, h] onto the full canvas. */
    begin(viewX: number, viewY: number, viewW: number, viewH: number): void;
    /**
     * Queue one instance. `z`: raw depth (0..Z_RANGE, bigger = in front).
     * `sx/sy` scroll and `rx/ry` repeat the frame's texture across the quad
     * (frame-fraction units; 0,0,1,1 = the plain sprite).
     */
    push(x: number, y: number, w: number, h: number, frame: Frame, mode: number, rot: number, flipOrThick: number, z: number, r: number, g: number, b: number, a: number, sx?: number, sy?: number, rx?: number, ry?: number): void;
    private grow;
    /**
     * Every instance pushed from here until the next `setLayer`/`begin` belongs to
     * `n`. Only the UI-label batch uses this; a sprite batch stays on layer 0 and
     * the run list stays a single span.
     */
    setLayer(n: number): void;
    /** Upload once, whichever walk asks first. */
    private upload;
    /**
     * Upload + draw ONE layer of everything pushed since begin(). The default (0)
     * is the whole batch for every single-layer caller, so this stays one
     * writeBuffer and one draw for sprites.
     */
    flush(pass: GPURenderPassEncoder, layer?: number): number;
}

// Docs: engine/webgpu/msdf.md — usage, recipes & traps (this file = exact type signatures)
import { type ClipRect } from './ui.js';
declare const STRIDE = 28;
/**
 * The MSDF glyph batch: accumulates quads across many texts and fonts into one
 * instance buffer, then draws one sub-range per atlas texture. `begin()` sets the
 * world view each frame; texts push quads via `alloc()`+direct writes; `flush()`
 * uploads once and issues one `draw` per texture run.
 */
export declare class MsdfRenderer {
    private format;
    private capacity;
    private buffer;
    f32: Float32Array;
    u32: Uint32Array;
    private count;
    /** Contiguous spans sharing a texture AND a clip rect (see ui.ts) — a clipped
     *  label costs one extra run and one scissor, nothing per glyph. */
    private runs;
    private uploaded;
    private viewData;
    private targetW;
    private targetH;
    /** The clip every subsequent alloc() inherits — set by Draw around a clipped
     *  region, so text submitters need no clip argument threaded through them. */
    clip: ClipRect | null;
    /** Draw layer every subsequent alloc() inherits — see UiRenderer.flush. */
    layer: number;
    /** Highest layer used this frame — how many times the frame must flush. */
    maxLayer: number;
    /** The surface's submission-order log — set when this pass interleaves with
     *  the scene's quads rather than owning a fixed slot in the frame. */
    private order;
    /**
     * Device pixels per draw unit on this surface THIS frame. UnicodeText reads it
     * to decide how finely to rasterize itself (see unicode-text.ts).
     */
    pxPerUnit: number;
    private device;
    private pipeline;
    private layout;
    private sampler;
    private uniforms;
    private instances;
    private binds;
    constructor(device: GPUDevice, format: GPUTextureFormat, capacity?: number);
    /** (Re)create every GPU object — the device-loss recovery path. */
    rebuild(device: GPUDevice): void;
    /**
     * Forget a texture's cached bind group. Called when a UnicodeText block
     * re-rasterizes and throws its old texture away — without this the cache
     * would keep one bind group per dead view for the life of the game.
     */
    release(view: GPUTextureView): void;
    private bindFor;
    /** Start a frame: map the world rect [x, y, w, h] onto the full canvas.
     *  `pxPerUnit` is the canvas's device-pixel width divided by `w`. */
    begin(x: number, y: number, w: number, h: number, pxPerUnit?: number, targetW?: number, targetH?: number): void;
    /**
     * Reserve one glyph/rect instance for `view` and return its base float offset
     * into `this.f32`/`this.u32` (write the 28 slots yourself). Read `f32`/`u32`
     * AFTER calling — a growth reallocates them.
     */
    alloc(view: GPUTextureView): number;
    private grow;
    /** Upload everything pushed since begin() and draw one range per texture. */
    flush(pass: GPURenderPassEncoder, layer?: number): number;
}
export { STRIDE as MSDF_STRIDE };
/** Pack `0xRRGGBB` + `0..1` alpha into the ABGR u32 the shader unpacks. */
export declare function packColor(rgb: number, alpha: number): number;
/**
 * Pack the glyph `params`: weight (signed field fraction, 128 neutral), rounded
 * (0..1), width (outline width / shadow spread, field fraction over [0,0.5]),
 * softness (field fraction). All continuous, so all per-corner for free.
 */
export declare function packParams(weightNorm: number, roundedNorm: number, widthNorm: number, softNorm: number): number;
/** A plain hard-edged solid rect (underline/strikethrough): sentinel 255, no radius/border/blur. */
export declare const SOLID_PARAMS = 255;
/** A finished premultiplied raster (a UnicodeText block): sentinel 253, tinted by `col`. */
export declare const BITMAP_PARAMS = 253;
/** Pack a solid rect's params (radius/border/softness, fractions of half-thickness). */
export declare function packSolidParams(radiusNorm: number, borderNorm: number, softNorm: number): number;
/** Pack a dashed rect's params (radius/duty/softness); U spans one cell per dash. */
export declare function packDashParams(radiusNorm: number, dutyNorm: number, softNorm: number): number;

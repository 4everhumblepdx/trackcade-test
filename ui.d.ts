// Docs: engine/webgpu/ui.md — usage, recipes & traps (this file = exact type signatures)
import type { Rgba } from './color.js';
import type { ResolvedUiStyle } from './ui-style.js';
declare const STRIDE = 40;
/**
 * The UI panel batch: accumulates every panel pushed this frame into one
 * instance buffer and draws them in submission order. Mirrors MsdfRenderer's
 * shape (begin / push / flush, one run per texture) so both text and UI behave
 * identically under device loss and growth.
 */
export declare class UiRenderer {
    private format;
    private capacity;
    private buffer;
    private f32;
    private u32;
    private count;
    /**
     * Contiguous spans sharing a texture AND a clip rect, drawn one at a time.
     * The clip is the whole clipping mechanism: there is no per-instance clip
     * cost, just a scissor set per run — and runs only split where the game
     * actually pushed a clip.
     */
    private runs;
    /** The instance buffer uploads once a frame however many layers are flushed. */
    private uploaded;
    /** Highest layer pushed this frame — how many times the frame must flush. */
    maxLayer: number;
    /** The surface's submission-order log — see batch.ts's DrawOrder. */
    private order;
    private viewData;
    /** Framebuffer size in device pixels — what a normalised clip scales into. */
    private targetW;
    private targetH;
    private device;
    private pipeline;
    private layout;
    private sampler;
    private uniforms;
    private instances;
    /** The default bound texture: 1×1 white, so an untextured panel samples 1.0. */
    private blank;
    private binds;
    constructor(device: GPUDevice, format: GPUTextureFormat, capacity?: number);
    /** (Re)create every GPU object — the device-loss recovery path. */
    rebuild(device: GPUDevice): void;
    /** Forget a texture's cached bind group (device-loss / texture churn). */
    release(view: GPUTextureView): void;
    private bindFor;
    /** Start a frame: map the surface rect [x, y, w, h] onto the full canvas.
     *  `targetW/H` are the render target's device-pixel size — clip rects arrive
     *  normalised to the surface and are scaled into it. */
    begin(x: number, y: number, w: number, h: number, targetW?: number, targetH?: number): void;
    /**
     * Push one panel. `x, y` is the TOP-LEFT corner and `w, h` the size, both in
     * the surface's units — the same convention as `d.rect`. `rot` turns the
     * panel about its own centre.
     */
    push(x: number, y: number, w: number, h: number, s: ResolvedUiStyle, rot?: number, clip?: ClipRect | null, layer?: number): number;
    /**
     * Rewrite an already-pushed panel's rectangle. This is what lets a container
     * SIZE ITSELF TO ITS CONTENT in immediate mode: the frame is pushed first
     * (it has to paint under the content), the content is drawn and measured, and
     * the frame's rect is corrected before anything is uploaded.
     */
    patchRect(index: number, x: number, y: number, w: number, h: number): void;
    private grow;
    flush(pass: GPURenderPassEncoder, layer?: number): number;
}
export { STRIDE as UI_STRIDE };
/**
 * A clip rect NORMALISED to its surface (0..1 across and down), so the same
 * value works in world units, HUD pixels and at any canvas size. `x1`/`y1` are
 * the far edges. Produced by Draw's clip stack; consumed as a scissor.
 */
export interface ClipRect {
    x0: number;
    y0: number;
    x1: number;
    y1: number;
}
/** Do two clips (either possibly null) describe the same region? */
export declare function sameClip(a: ClipRect | null, b: ClipRect | null): boolean;
/** Normalised clip → integer device pixels, TOP-LEFT origin (WebGPU's scissor
 *  convention; the GL twin flips Y). Clamped to the target and never negative. */
export declare function clipToPixels(c: ClipRect, targetW: number, targetH: number): {
    x: number;
    y: number;
    w: number;
    h: number;
};
/** Pack an `Rgba` (0..1 floats) + an optional extra alpha into the ABGR u32
 *  the shader unpacks. */
export declare function packUiColor(c: Rgba, alpha?: number): number;

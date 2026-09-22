// Docs: engine/webgpu/draw.md — usage, recipes & traps (this file = exact type signatures)
/** One packed frame: half-texel-inset UVs + the frame's pixel size. */
export interface Frame {
    u0: number;
    v0: number;
    u1: number;
    v1: number;
    /** Source pixel size — the natural draw size for sprite(). */
    w: number;
    h: number;
}
export interface PackedBox {
    x: number;
    y: number;
}
/**
 * Pure shelf-packing: place `cells` (in order) into rows that wrap at `maxW`.
 * Returns each cell's position plus the finished sheet size. Exported for
 * headless tests; Atlas.build() drives it.
 */
export declare function packShelves(cells: ReadonlyArray<{
    w: number;
    h: number;
}>, maxW?: number, pad?: number): {
    boxes: PackedBox[];
    width: number;
    height: number;
};
/**
 * The engine's frame store. `add()` canvases (a horizontal strip slices into
 * frames via `frameW`) and get back the first frame's index; `build()` packs
 * everything into one canvas + UV table. Frame 0 is always a built-in white
 * square — the tintable solid, and the texture the shape verbs ride on.
 */
export declare class Atlas {
    private maxW;
    private pad;
    private cells;
    /** True when frames were added since the last build() — build() repacks. */
    dirty: boolean;
    /**
     * Monotonic build counter — bumped on every build(). The GPU owner uploads
     * whenever this differs from what it last uploaded, so a repack that clears
     * `dirty` WITHOUT going through the owner (e.g. frameSize() calling build()
     * to measure) can't leave the uploaded texture stale against the new UVs.
     */
    generation: number;
    frames: Frame[];
    canvas: HTMLCanvasElement | null;
    constructor(maxW?: number, pad?: number);
    /** Register a canvas (or strip of square-ish frames). Returns the first frame index. */
    add(src: HTMLCanvasElement, frameW?: number): number;
    /** Number of frames a strip of width `srcW` sliced at `frameW` yields. */
    static count(srcW: number, frameW: number): number;
    /** Pack all cells (plus the white frame 0) into one canvas + UV table. */
    build(): {
        canvas: HTMLCanvasElement;
        frames: Frame[];
    };
}
/**
 * Upload an image source (canvas, image, or bitmap) to a sampleable rgba8unorm
 * texture. `premultiply` asks the copy to premultiply RGB by alpha — set it for
 * anything a PREMULTIPLIED-blend shader samples directly (rasterized text
 * blocks); leave it off for the atlas, whose batches do the multiply themselves.
 */
export declare function textureFromCanvas(device: GPUDevice, source: HTMLCanvasElement | OffscreenCanvas | HTMLImageElement | ImageBitmap, premultiply?: boolean): GPUTexture;
/**
 * Rasterize a text string to a canvas once — register it as a frame and it
 * batches like any sprite. (Interim text path: the bitmap-font atlas + HUD
 * pass land in a later milestone.)
 */
export declare function rasterText(text: string, opts?: {
    font?: string;
    color?: string;
    pad?: number;
}): HTMLCanvasElement;

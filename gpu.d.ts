// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** GPUBufferUsage / GPUTextureUsage / GPUShaderStage bit constants, spelled out
 * so the module never touches the runtime globals (absent in Node). */
export declare const BITS: {
    readonly MAP_READ: 1;
    readonly COPY_SRC: 4;
    readonly COPY_DST: 8;
    readonly INDIRECT: 256;
    readonly VERTEX: 32;
    readonly UNIFORM: 64;
    readonly STORAGE: 128;
    readonly TEXTURE_BINDING: 4;
    readonly RENDER_ATTACHMENT: 16;
    readonly STAGE_VERTEX: 1;
    readonly STAGE_FRAGMENT: 2;
    readonly STAGE_COMPUTE: 4;
};
/**
 * Create a shader module and log any WGSL compile errors to the console —
 * WGSL failures are otherwise SILENT (a pipeline just draws nothing). Every
 * module in the engine goes through this (or replicates it); compute kernels
 * especially, since a broken kernel has no visual symptom at all.
 */
export declare function shaderModule(device: GPUDevice, code: string, label: string): GPUShaderModule;
export interface GpuOptions {
    /** Cap on devicePixelRatio for the backing store (default 1 — render at CSS
     * pixels; retina cap 2 pays 4× the fragments for sharpness). Edge smoothing
     * comes from MSAA (world3d msaa) far more cheaply than from dpr. */
    dprCap?: number;
    /** Called with any GPU/page error message (uncaptured errors, device loss). */
    onError?: (msg: string) => void;
}
/** The live GPU handles for one canvas, with device-loss recovery built in. */
export declare class Gpu {
    device: GPUDevice;
    readonly context: GPUCanvasContext;
    readonly format: GPUTextureFormat;
    readonly canvas: HTMLCanvasElement;
    private opts;
    private rebuildFns;
    private lostForever;
    private destroyed;
    private dirty;
    private ro;
    private dprMql;
    private onDprChange;
    private constructor();
    /**
     * Request adapter + device and configure the canvas for premultiplied-alpha
     * presentation. Returns null where WebGPU is absent or the adapter request
     * fails (possible even when navigator.gpu exists — blocklisted GPUs).
     */
    static init(canvas: HTMLCanvasElement, opts?: GpuOptions): Promise<Gpu | null>;
    /** Watch the canvas for size / dpr changes (see the `dirty` flag) — the fit
     *  is applied lazily on the next `fit()`, so nothing polls the DOM per frame. */
    private watchSize;
    /** Force the next `fit()` to re-measure (e.g. after a manual layout change). */
    markDirty(): void;
    /**
     * Register a callback that recreates an owner's GPU resources from CPU-side
     * state. Fired (in registration order) after a lost device is replaced.
     * Returns an unsubscribe function.
     */
    onRebuild(fn: (device: GPUDevice) => void): () => void;
    /**
     * Size the backing store to the canvas's CSS size × dpr (capped). Called per
     * frame but does NOTHING (not even a DOM read) unless a resize/dpr change has
     * flagged it dirty — so the steady state is a single boolean check.
     */
    fit(): boolean;
    /** True once the device is gone and could not be replaced. */
    get dead(): boolean;
    /** Tear down: stop watching size, drop rebuild hooks, and destroy the device
     *  (frees every GPU texture/buffer the engine created). Idempotent. */
    destroy(): void;
    private adopt;
    private recover;
}
/**
 * A dev-visible error trap: page errors, unhandled rejections and engine
 * messages append to a fixed overlay. WGSL failures are otherwise SILENT in
 * embedded previews — install this in anything you need to debug visually.
 */
export declare function installErrorOverlay(): (msg: string) => void;

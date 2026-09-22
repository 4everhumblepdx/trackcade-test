// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
export interface GlOptions {
    /** Cap on devicePixelRatio for the backing store (default 1 — see gpu.ts). */
    dprCap?: number;
    /** Called with any GL/page error message (context loss, shader failures). */
    onError?: (msg: string) => void;
}
/** The live WebGL2 handles for one canvas, with context-loss recovery built in. */
export declare class GlContext {
    gl: WebGL2RenderingContext;
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
     * Acquire a WebGL2 context configured for premultiplied-alpha presentation
     * (matching the WebGPU surface) with an antialiased, depth'd default
     * framebuffer. Returns null where WebGL2 is absent.
     */
    static init(canvas: HTMLCanvasElement, opts?: GlOptions): GlContext | null;
    /** Watch the canvas for size / dpr changes — same event-driven scheme as Gpu. */
    private watchSize;
    /** Force the next `fit()` to re-measure (e.g. after a manual layout change). */
    markDirty(): void;
    /** Register a rebuild callback fired after a lost context is restored. */
    onRebuild(fn: (gl: WebGL2RenderingContext) => void): () => void;
    /** Size the backing store to CSS size × dpr (capped) — the Gpu.fit twin. */
    fit(): boolean;
    /** True once the context is gone for good (only after destroy()). */
    get dead(): boolean;
    /** Tear down: stop watching size and drop rebuild hooks. Idempotent. */
    destroy(): void;
}

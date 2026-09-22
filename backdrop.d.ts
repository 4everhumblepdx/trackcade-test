// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import { BackdropHandle, type BackdropDef, type BackgroundSource } from '../backdrop.js';
export declare const GLSL_BACKDROP_SNIPPETS: Record<string, string>;
/** Splice a GLSL snippet into the fullscreen backdrop template — the GLSL
 *  mirror of buildBackdropWGSL (headless-testable string assembly). */
export declare function buildBackdropGLSL(def: BackdropDef, snippet: string): string;
/** Fullscreen blit that draws the background image (opaque) beneath the
 *  layers — the GLSL twin of BG_BLIT_WGSL. */
export declare const BG_BLIT_FS_GLSL: string;
export declare class GlBackdropChain {
    private gl;
    private handles;
    private programs;
    private warned;
    private warnedGpuTex;
    private bgProgram;
    private bgTex;
    private defaultTex;
    private hasBg;
    private bgSource;
    constructor(gl: WebGL2RenderingContext);
    /** A layer draws only when its name has a GLSL port. */
    private runnable;
    /** Anything to draw? True when a drawable layer or a background exists. */
    get active(): boolean;
    /**
     * Set (or clear, with null) the background image the backdrops render OVER.
     * Canvas / image / bitmap sources upload to a texture (straight alpha — the
     * same recipe as the original's textureFromCanvas); GPUTexture sources are
     * WebGPU-only and are ignored with one warn.
     */
    setBackground(source: BackgroundSource | null): void;
    /** Append a layer (built-in name or a custom BackdropDef — the block path). */
    add(backdrop: string | BackdropDef, params?: Record<string, number>): BackdropHandle;
    drop(handle: BackdropHandle): void;
    clear(): void;
    /** (Re)create GL objects — the context-restore recovery path. */
    rebuild(gl: WebGL2RenderingContext): void;
    private programFor;
    /** 1x1 transparent texture so the uBg sampler is always complete. */
    private ensureDefaultTex;
}

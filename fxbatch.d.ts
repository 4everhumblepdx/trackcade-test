// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { Frame } from '../atlas.js';
import type { SpriteFx } from '../fxbatch.js';
/** Vertex shader — the GLSL port of fxbatch.ts's `vs`. */
export declare const buildFxVertGLSL: () => string;
/** Fragment shader — the GLSL port of fxbatch.ts's `fs` (the whole
 *  über-shader: uv distortions, RGB split, 32-tap halo rings, alpha gates,
 *  colour-over, outline compose). */
export declare const buildFxFragGLSL: () => string;
/** The dedicated per-object-fx batch — the GL twin of FxBatch. */
export declare class GlFxBatch {
    /** The surface's submission-order log — see batch.ts's DrawOrder. */
    private order;
    private layer;
    /** @see QuadBatch.setLayer */
    setLayer(n: number): void;
    private data;
    private count;
    private capacity;
    private filter;
    private uniformData;
    private gl;
    private program;
    private vao;
    private instances;
    private uViewLoc;
    private texture;
    constructor(gl: WebGL2RenderingContext, opts?: {
        filter?: string;
        capacity?: number;
    });
    /** (Re)create every GL-side object — the context-loss recovery path. */
    rebuild(gl: WebGL2RenderingContext): void;
    /** Point the batch at the shared atlas (a WebGLTexture on this backend). */
    setTexture(view: unknown): void;
    begin(x: number, y: number, w: number, h: number): void;
    /** Queue one fx sprite (margin expansion + uv extrapolation done here) —
     *  a verbatim twin of FxBatch.push's packing. */
    push(x: number, y: number, w: number, h: number, f: Frame, rot: number, flipX: boolean, z: number, fx: SpriteFx, time: number, tr: number, tg: number, tb: number, ta: number): void;
    private grow;
    /** Program, VAO, upload, texture and pipeline state — both draw paths. */
    private bindForDraw;
    flush(_pass?: unknown): number;
}

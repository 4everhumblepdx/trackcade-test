// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { Frame } from '../atlas.js';
import type { BatchOptions } from '../batch.js';
/** Vertex shader — the GLSL port of batch.ts's `vs`. Corner from gl_VertexID. */
export declare const buildQuadVertGLSL: () => string;
/** Fragment shader — the GLSL port of batch.ts's shade()/fs_blend/fs_cutout. */
export declare const buildQuadFragGLSL: (blocky: boolean, cutout: boolean) => string;
/**
 * One batch = one program + the shared atlas texture + one instance VBO. The
 * CPU half (data array, begin/push/grow) is a verbatim twin of QuadBatch.
 */
export declare class GlQuadBatch {
    private data;
    private count;
    private capacity;
    private cutout;
    private depthTest;
    private additive;
    private blocky;
    private filter;
    private uniformData;
    /** Layer spans — the verbatim twin of QuadBatch's; see batch.ts. */
    private runs;
    /** The surface's submission-order log, when this batch takes part in one. */
    private order;
    private src;
    private layer;
    maxLayer: number;
    private gl;
    private program;
    private vao;
    private instances;
    private uViewLoc;
    private texture;
    constructor(gl: WebGL2RenderingContext, opts?: BatchOptions);
    /** (Re)create every GL-side object — the context-loss recovery path. */
    rebuild(gl: WebGL2RenderingContext): void;
    /** Point the batch at its atlas texture (a WebGLTexture on this backend). */
    setTexture(view: unknown): void;
    /** Start a frame: map the world rect [x, y, w, h] onto the full canvas. */
    begin(viewX: number, viewY: number, viewW: number, viewH: number): void;
    /** Queue one instance — identical signature + packing to QuadBatch.push. */
    push(x: number, y: number, w: number, h: number, frame: Frame, mode: number, rot: number, flipOrThick: number, z: number, r: number, g: number, b: number, a: number, sx?: number, sy?: number, rx?: number, ry?: number): void;
    private grow;
    /** @see QuadBatch.setLayer — the verbatim twin. */
    setLayer(n: number): void;
    /** Upload + draw ONE layer of everything pushed since begin() — one
     *  bufferSubData, one instanced draw per span. `pass` is unused on this
     *  backend (WebGPU twin parity). */
    /** Program, VAO, upload, texture and pipeline state — shared by both draws. */
    private bindForDraw;
    flush(_pass?: unknown, layer?: number): number;
}

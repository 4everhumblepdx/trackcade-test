// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { Frame } from '../atlas.js';
import type { Deform, DeformDef } from '../gridbatch.js';
/** Vertex shader — the GLSL port of buildGridWGSL's vertex template (the four
 *  built-in kinds; the cell/corner decode from the flat vertex index). */
/** Custom-def splice: each registered def with a `glsl` snippet becomes an
 *  else-if branch, in the SAME variable scope as the built-ins (`p`, `shade`,
 *  `uvn`, `size`, `amount`, `t`, `TAU`) — mirroring buildGridWGSL's splice. */
export declare const buildGridVertGLSL: (customs?: ReadonlyArray<{
    id: number;
    glsl: string;
}>) => string;
/** Fragment shader — the same atlas mapping as GlQuadBatch (un-inset extent,
 *  clamped back in, optional blocky texel snap), × tint × the deform shade. */
export declare const buildGridFragGLSL: (blocky: boolean) => string;
/**
 * One program + instance VBO for every deformed sprite this frame — the GL
 * twin of GridBatch. All deformation is vertex-stage; the instanced draw
 * issues SEGS²×6 verts per sprite from gl_VertexID.
 */
export declare class GlGridBatch {
    /** The surface's submission-order log — see batch.ts's DrawOrder. */
    private order;
    private layer;
    /** @see QuadBatch.setLayer */
    setLayer(n: number): void;
    private data;
    private count;
    private capacity;
    private blocky;
    private filter;
    private uniformData;
    private time;
    private kinds;
    private customs;
    private warnedDefs;
    private gl;
    private program;
    private vao;
    private instances;
    private uViewLoc;
    private uTimeLoc;
    private texture;
    constructor(gl: WebGL2RenderingContext, opts?: {
        filter?: string;
        blocky?: boolean;
    });
    /** (Re)create every GL-side object — the context-loss recovery path. */
    rebuild(gl: WebGL2RenderingContext): void;
    /** (Re)compile the grid program with the registered GLSL custom branches. */
    private makeProgram;
    /** Register a custom deformer. A def carrying a `glsl` twin snippet is
     *  spliced into the grid program exactly like the WGSL is on WebGPU (same
     *  id scheme, so `deform: { kind }` routing matches); a WGSL-only def
     *  renders UNDEFORMED here with a one-shot warn naming it. */
    register(def: DeformDef): void;
    /** Point the batch at the shared atlas (a WebGLTexture on this backend). */
    setTexture(view: unknown): void;
    begin(viewX: number, viewY: number, viewW: number, viewH: number, time: number): void;
    /** Queue one deformed sprite — identical packing to GridBatch.push. */
    push(x: number, y: number, w: number, h: number, frame: Frame, rot: number, flipX: boolean, z: number, deform: Deform, r: number, g: number, b: number, a: number): void;
    private grow;
    /** Program, VAO, upload, texture and pipeline state — both draw paths. */
    private bindForDraw;
    flush(_pass?: unknown): number;
}

// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
export declare const buildTriVertGLSL: () => string;
export declare const buildTriFragGLSL: () => string;
/** An instanced flat-triangle batch (alpha blend, no depth). */
export declare class GlTriBatch {
    /** The surface's submission-order log — see batch.ts's DrawOrder. */
    private order;
    private layer;
    /** @see QuadBatch.setLayer */
    setLayer(n: number): void;
    private data;
    private count;
    private capacity;
    private uniformData;
    private gl;
    private program;
    private vao;
    private instances;
    private uViewLoc;
    constructor(gl: WebGL2RenderingContext);
    rebuild(gl: WebGL2RenderingContext): void;
    begin(viewX: number, viewY: number, viewW: number, viewH: number): void;
    push(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number, g: number, b: number, a: number): void;
    private grow;
    /** Program, VAO, upload and pipeline state — shared by both draw paths. */
    private bindForDraw;
    flush(_pass?: unknown): void;
}

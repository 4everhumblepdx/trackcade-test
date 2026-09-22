// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import { type ClipRect } from '../ui.js';
/** Vertex shader — the GLSL port of msdf.ts's `vs`. The pos array<vec2f, 4>
 *  arrives as two vec4 slots (TL.xy TR.xy | BL.xy BR.xy). */
export declare const buildMsdfVertGLSL: () => string;
/** Fragment shader — the GLSL port of msdf.ts's `fs` (both lanes, verbatim
 *  field math; dpdx/dpdy become dFdx/dFdy). */
export declare const buildMsdfFragGLSL: () => string;
/**
 * The MSDF glyph batch — the GL twin of MsdfRenderer. The CPU half (alloc /
 * runs / grow) is a verbatim twin; flush uploads the mixed stream once and
 * draws one attribute-offset sub-range per atlas texture.
 */
export declare class GlMsdfRenderer {
    /** The packed instance stream MsdfText writes into (see msdf.ts). */
    f32: Float32Array;
    u32: Uint32Array;
    private count;
    private capacity;
    private runs;
    private uniformData;
    private targetW;
    private targetH;
    /** The clip every subsequent alloc() inherits (see msdf.ts). */
    clip: ClipRect | null;
    /** Draw layer every subsequent alloc() inherits — see ui.ts's UiRenderer.flush. */
    layer: number;
    /** Highest layer used this frame — how many times the frame must flush. */
    maxLayer: number;
    /** The surface's submission-order log — see batch.ts's DrawOrder. */
    private order;
    /** Device pixels per draw unit this frame — UnicodeText's raster budget. */
    pxPerUnit: number;
    private gl;
    private program;
    private vao;
    private instances;
    private uViewLoc;
    constructor(gl: WebGL2RenderingContext);
    /** (Re)create every GL-side object — the context-loss recovery path. */
    rebuild(gl: WebGL2RenderingContext): void;
    /** Start a frame: map the world rect [x, y, w, h] onto the full canvas. */
    begin(viewX: number, viewY: number, viewW: number, viewH: number, pxPerUnit?: number, targetW?: number, targetH?: number): void;
    /** Twin of MsdfRenderer.release — this backend binds textures directly, so
     *  there is no per-view cache to evict. */
    release(_view: unknown): void;
    /** Reserve one instance for `view`'s texture; returns its float offset. */
    alloc(view: unknown): number;
    private grow;
    /** Point every attribute at the interleaved stream, `byteOffset` in — the
     *  firstInstance emulation (offset = run.first × 112 bytes). The u32 slots
     *  bind through vertexAttribIPointer so the shader sees true uints. */
    private bindAttribs;
    /** Upload everything pushed since begin() and draw one range per texture. */
    /** Program, VAO, upload and pipeline state — shared by both draw paths. */
    private bindForDraw;
    flush(_pass?: unknown, layer?: number): number;
}

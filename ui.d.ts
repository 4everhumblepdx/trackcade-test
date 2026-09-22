// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import { type ClipRect } from '../ui.js';
import type { ResolvedUiStyle } from '../ui-style.js';
/** Vertex shader — the GLSL port of ui.ts's `vs`. */
export declare const buildUiVertGLSL: () => string;
/** Fragment shader — the GLSL port of ui.ts's `fs`, field maths verbatim. */
export declare const buildUiFragGLSL: () => string;
/**
 * The UI panel batch — the GL twin of UiRenderer. The CPU half (push / grow)
 * is a verbatim twin; flush uploads the mixed stream once and draws it.
 */
export declare class GlUiRenderer {
    private f32;
    private u32;
    private count;
    private capacity;
    private uniformData;
    /** Clip runs — the GL twin of UiRenderer's, drawn with gl.scissor. */
    private runs;
    private targetW;
    private targetH;
    private gl;
    private program;
    private vao;
    private instances;
    private blank;
    private uViewLoc;
    constructor(gl: WebGL2RenderingContext);
    /** (Re)create every GL-side object — the context-loss recovery path. */
    rebuild(gl: WebGL2RenderingContext): void;
    /** Twin of UiRenderer.release — this backend binds textures directly. */
    release(_view: unknown): void;
    /** Start a frame: map the surface rect [x, y, w, h] onto the full canvas. */
    begin(x: number, y: number, w: number, h: number, targetW?: number, targetH?: number): void;
    /** Highest layer pushed this frame — how many times the frame must flush. */
    maxLayer: number;
    /** The surface's submission-order log — see batch.ts's DrawOrder. */
    private order;
    /** Push one panel — the exact twin of UiRenderer.push. */
    push(x: number, y: number, w: number, h: number, s: ResolvedUiStyle, rot?: number, clip?: ClipRect | null, layer?: number): number;
    /** Twin of UiRenderer.patchRect — see there for why containers need it. */
    patchRect(index: number, x: number, y: number, w: number, h: number): void;
    private grow;
    /** Point every attribute at the interleaved stream. The two packed colour
     *  slots bind through vertexAttribIPointer so the shader sees true uints. */
    private bindAttribs;
    /** Apply a normalised clip as a GL scissor. GL's origin is BOTTOM-left, so
     *  the top-left rect from clipToPixels is flipped in Y here. */
    private applyClip;
    /** Upload everything pushed since begin() and draw it. */
    /** Program, VAO, upload and pipeline state — shared by both draw paths. */
    private bindForDraw;
    flush(_pass?: unknown, layer?: number): number;
}

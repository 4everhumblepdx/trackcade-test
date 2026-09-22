// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Prefix for every shader in the backend (version + float precision). */
export declare const GLSL_HEADER = "#version 300 es\n";
export declare const GLSL_FRAG_HEADER: string;
/**
 * Compile + link a program, logging info logs on failure (with numbered source
 * for shader errors — GLSL error lines are useless without it). Returns null on
 * failure so callers can no-op draw instead of throwing mid-frame.
 */
export declare function compileProgram(gl: WebGL2RenderingContext, vsSource: string, fsSource: string, label: string): WebGLProgram | null;
/**
 * Declare `count` consecutive vec4 instance attributes starting at `firstLoc`,
 * all reading from the currently bound interleaved instance VBO (stride =
 * count*16 bytes). The universal storage-buffer → instanced-attribute mapping.
 */
export declare function instanceVec4Attribs(gl: WebGL2RenderingContext, firstLoc: number, count: number, 
/**
 * Byte offset of the first instance to read. GL has no `firstInstance` draw
 * parameter, so drawing a SPAN of the buffer means re-pointing the attributes
 * at its start — the same trick the GL UI renderer uses for its runs. 0 (the
 * default) reads from the beginning, which is every single-span caller.
 */
byteOffset?: number): void;
/** Upload an image/canvas source to a straight-alpha RGBA texture (the twin of
 *  atlas.ts textureFromCanvas — same no-premultiply recipe). */
export declare function textureFromSource(gl: WebGL2RenderingContext, source: TexImageSource, opts?: {
    filter?: 'linear' | 'nearest';
    premultiply?: boolean;
}): WebGLTexture;
/** A grow-on-demand instance VBO: upload `count*floatsPer` floats per frame. */
export declare class InstanceBuffer {
    private gl;
    private vbo;
    private byteCapacity;
    constructor(gl: WebGL2RenderingContext);
    /** Bind + (re)upload the live prefix of `data`. Returns the bound VBO. */
    upload(data: Float32Array, floatCount: number): WebGLBuffer;
    /** Drop the VBO handle (context restore recreates lazily). */
    reset(gl: WebGL2RenderingContext): void;
}

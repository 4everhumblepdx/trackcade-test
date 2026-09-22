// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import { PostHandle } from '../post.js';
import { type EffectDef } from '../effects.js';
export declare const GLSL_EFFECT_SNIPPETS: Record<string, string>;
/** Fullscreen-triangle vertex shader shared by every pass (uv.y = 0 at TOP —
 *  the same corner math as buildEffectWGSL's vs). */
export declare const POST_VS_GLSL: string;
/** Splice a GLSL snippet into the full-screen post template — the GLSL mirror
 *  of buildEffectWGSL (headless-testable string assembly). */
export declare function buildEffectGLSL(def: EffectDef, snippet: string): string;
export declare class GlPostChain {
    private gl;
    private handles;
    private programs;
    private warned;
    private targets;
    private depth;
    private width;
    private height;
    constructor(gl: WebGL2RenderingContext);
    /** A pass runs only when its name has a GLSL port. */
    /** A def's GLSL: the built-in registry, or its own `glsl` twin field. */
    private snippetFor;
    private runnable;
    /** Any runnable effects? (The renderer skips the offscreen path when not.) */
    get active(): boolean;
    /** Append an effect (built-in name or a custom EffectDef — the block path). */
    add(effect: string | EffectDef, params?: Record<string, number>): PostHandle;
    drop(handle: PostHandle): void;
    clear(): void;
    /** Bind + size the offscreen scene FBO the world should render into this
     *  frame (colour + DEPTH_COMPONENT24; sizes track the canvas). The renderer
     *  sets viewport/clear itself, exactly as it does on the default framebuffer. */
    sceneTarget(w: number, h: number): void;
    /** The scene FBO + its sampleable depth texture (valid after sceneTarget).
     *  Depth CANNOT be sampled while this FBO is bound — consumers blit a copy
     *  first (the world's depth-effect passes own that dance). */
    get scene(): {
        fbo: WebGLFramebuffer;
        depthTex: WebGLTexture;
        width: number;
        height: number;
    } | null;
    /** The no-post path when the scene still rendered offscreen (a world using
     *  the depth-texture seam): present the scene colour onto the canvas. NOT a
     *  blitFramebuffer — the canvas backbuffer is MULTISAMPLED (antialias: true)
     *  and single→multisample blits are INVALID_OPERATION; a fullscreen copy
     *  draw through the effect template keeps orientation identical to a real
     *  post pass landing on the canvas. */
    blitToCanvas(): void;
    /** Run every runnable pass, ping-ponging between the two colour targets; the
     *  last one lands on the default framebuffer (the canvas). */
    run(time: number): void;
    /** (Re)create GL objects — the context-restore recovery path. */
    rebuild(gl: WebGL2RenderingContext): void;
    private programFor;
    private destroyTargets;
}

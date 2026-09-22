// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Stamp vertex shader — the GLSL port of STAMP_WGSL's `vs`. */
export declare const buildGlowStampVertGLSL: () => string;
/** Stamp fragment shader — tinted silhouette, additive-summed. */
export declare const buildGlowStampFragGLSL: () => string;
/** Shared fullscreen-triangle vertex shader (identity mapping — see header). */
export declare const buildFullscreenVertGLSL: () => string;
/** Separable 13-tap gaussian blur fragment — the GLSL port of BLUR_WGSL. */
export declare const buildGlowBlurFragGLSL: () => string;
/** Additive composite fragment — the GLSL port of COMPOSITE_WGSL. */
export declare const buildGlowCompositeFragGLSL: () => string;
export declare class GlGlowPass {
    private data;
    private count;
    private capacity;
    private maxSize;
    private extraActive;
    private view;
    private gl;
    private stampProgram;
    private blurProgram;
    private compProgram;
    private uViewLoc;
    private uDirLoc;
    private uStrengthLoc;
    private vao;
    private instances;
    private targets;
    private targetW;
    private targetH;
    private atlasTexture;
    constructor(gl: WebGL2RenderingContext);
    get active(): boolean;
    private makeTarget;
    private blurTo;
    /** Point the stamp pass at the shared atlas (a WebGLTexture here). */
    setTexture(view: unknown): void;
    /** (Re)create every GL-side object — the context-loss recovery path. */
    rebuild(gl: WebGL2RenderingContext): void;
}

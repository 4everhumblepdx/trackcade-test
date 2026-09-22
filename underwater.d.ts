// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import { Underwater3d } from '../underwater3d.js';
import { type Mat4 } from '../math3d.js';
export declare class GlUnderwaterLayer {
    /** Set by pack() each frame; composite() no-ops when off. */
    active: boolean;
    /** The baked caustic tile (RG8, mipped, repeat) — the mesh FS taps it. */
    causticTex: WebGLTexture | null;
    private gl;
    private mulProg;
    private addProg;
    private shaftProg;
    private fsVao;
    private shaftVao;
    private shaftInst;
    private blackTex;
    private shaftTarget;
    private shaftW;
    private shaftH;
    private shaftDrawn;
    private shaftCount;
    private instData;
    private invVP;
    private vp;
    private cam;
    private sigma;
    private sunSigma;
    private water;
    private screen;
    private sun;
    private sunColT;
    private parm;
    private fade;
    constructor(gl: WebGL2RenderingContext);
    rebuild(gl: WebGL2RenderingContext): void;
    /** Pack this frame's uniforms + the shaft ring from the live handle —
     * Underwater3dLayer.pack()'s maths, verbatim. */
    pack(uw: Underwater3d, vp: Mat4, eye: {
        x: number;
        y: number;
        z: number;
    }, sun: {
        x: number;
        y: number;
        z: number;
    }, sunI: number, time: number, storm: number): void;
    /** Draw the shaft ring into the half-res R8 target (additive), then
     * restore the caller's FBO + viewport. */
    renderShafts(depthTex: WebGLTexture | null, width: number, height: number, restoreFbo: WebGLFramebuffer | null): void;
    /** The two blended fullscreen draws into the (bound) scene FBO — multiply
     * extinction, then add in-scatter/meniscus/shafts. Returns draws issued. */
    composite(depthTex: WebGLTexture | null): number;
}

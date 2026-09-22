// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import { Water3d } from '../water3d.js';
/** The per-frame uniform values the water programs consume (the world's
 * FrameU is structurally a superset — world.ts passes it straight in). */
export interface WaterFrameU {
    vp: Float32Array;
    camPos: readonly number[];
    fogColor: readonly number[];
    params: readonly number[];
    lightDir: readonly number[];
    ambSky: readonly number[];
    ambGround: readonly number[];
    sunCol: readonly number[];
}
export declare class GlWaterLayer {
    private gl;
    private gridProg;
    private ribbonProg;
    private decayProg;
    private stampProg;
    private vao;
    private fsVao;
    private gridVbufFine;
    private gridVbufCoarse;
    private gridVertsFine;
    private gridVertsCoarse;
    private rippleTex;
    private dummyGround;
    private foamA;
    private foamB;
    private foamOrigin;
    private wellPrev;
    private stampData;
    private gpu;
    constructor(gl: WebGL2RenderingContext);
    /** (Re)create every GL object — context-restore path (per-water records
     * recreate lazily, incl. the ground re-bake from the live ground fn). */
    rebuild(gl: WebGL2RenderingContext): void;
    /** The FOAM STAMP pass — decay+diffuse last frame (camera-shifted) into
     * the other target, stamp every well (intensity rides its speed), SWAP.
     * Runs before the main passes; restores the caller's FBO + viewport. */
    foamPass(waters: Water3d[], eyeX: number, eyeZ: number, dt: number, restoreFbo: WebGLFramebuffer | null, width: number, height: number): void;
    /** Pack + draw every live water — Water3dLayer.update()+draw(), GL-side.
     * Caller state: pass B (premultiplied blend, depth test read-only, cull
     * off). Returns the draw-call count. */
    draw(waters: Water3d[], frame: WaterFrameU, lightData: Float32Array, lightCount: number, envTex: WebGLTexture | null, depthTex: WebGLTexture | null, whiteTex: WebGLTexture | null, time: number, projA: number, projB: number, width: number, height: number): number;
    get count(): number;
}

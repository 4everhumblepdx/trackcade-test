// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import { Visibility2d } from '../visibility2d.js';
import type { Light2d, PointLight2dOptions, SpotLight2dOptions } from '../lights2d.js';
/** Light-triangle vertex shader — the GLSL port of lights2d.ts's `vs`. */
export declare const buildLightVertGLSL: () => string;
/** Light-triangle fragment shader — per-pixel falloff + spot cone. */
export declare const buildLightFragGLSL: () => string;
/** Ambient fullscreen-triangle vertex shader. */
export declare const buildAmbientVertGLSL: () => string;
/** Ambient fragment — the colour the scene multiplies down to. */
export declare const buildAmbientFragGLSL: () => string;
/**
 * The 2D light layer — the GL twin of Lights2d. Add occluders + lights,
 * mutate them each frame; draw('under'/'over') renders each phase into the
 * current framebuffer.
 */
export declare class GlLights2d {
    /** Scenery that casts shadows — add rects / segments / polys to it. */
    readonly occluders: Visibility2d;
    /** The active lights (mutate freely; `point()`/`spot()` append here). */
    readonly lights: Light2d[];
    /** Ambient (base) light colour — the scene is multiplied down to this
     *  before the over-lights add (white = no darkening). */
    ambient: [number, number, number];
    /** Lights drawn last frame after culling — for HUD/debug. */
    visible: number;
    /** Of those, how many cast shadows (the expensive ones) — for HUD/debug. */
    visibleShadow: number;
    private data;
    private count;
    private capacity;
    private time;
    private uniformData;
    private ambientData;
    private vx;
    private vy;
    private vw;
    private vh;
    private underTris;
    private gl;
    private program;
    private ambientProgram;
    private uViewLoc;
    private uColorLoc;
    private vao;
    private instances;
    private vbo;
    constructor(gl: WebGL2RenderingContext);
    /** (Re)create every GL-side object — the context-loss recovery path. */
    rebuild(gl: WebGL2RenderingContext): void;
    private makeLight;
    /** Add a point light; returns its handle (mutate to move / recolour it). */
    point(x: number, y: number, opts?: PointLight2dOptions): Light2d;
    /** Add a spot light (a cone). `dir` faces in radians, `cone` is the full angle. */
    spot(x: number, y: number, opts?: SpotLight2dOptions): Light2d;
    /** Remove a light. */
    remove(light: Light2d): void;
    /** Remove all lights. */
    clear(): void;
    /** Start a frame: map the world rect onto the canvas (same as the batches). */
    begin(viewX: number, viewY: number, viewW: number, viewH: number, time: number): void;
    private flicker;
    private pushTri;
    private grow;
    /** Bind the 4 instance vec4s at `byteOffset` — the firstInstance emulation
     *  for the 'over' sub-range. Needs the instance VBO bound. */
    private bindAttribs;
    /**
     * Draw one compositing PHASE into the current framebuffer. `'under'`
     * (called before the sprite batches) builds + uploads the whole frame and
     * draws the floor lights; `'over'` (called after the scene) multiplies the
     * scene to the ambient colour then draws the lights that cover the sprites.
     */
    draw(_pass?: unknown, phase?: 'under' | 'over'): void;
}

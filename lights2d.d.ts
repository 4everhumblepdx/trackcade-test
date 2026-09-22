// Docs: engine/webgpu/lights2d.md — usage, recipes & traps (this file = exact type signatures)
import { Visibility2d } from './visibility2d.js';
/** A live 2D light — mutate its fields (position, colour, radius…) each frame. */
export interface Light2d {
    /** Light kind. */ type: 'point' | 'spot';
    /** World X. */ x: number;
    /** World Y. */ y: number;
    /** Reach in world units (falloff hits 0 here). */ radius: number;
    /** Peak brightness. */ intensity: number;
    /** Colour `[r, g, b]`, 0..1. */ color: [number, number, number];
    /** Falloff exponent — 1 ≈ linear, 2 = softer core, higher = tighter. */ falloff: number;
    /** Spot facing in radians (spot only). */ dir: number;
    /** Spot full cone angle in radians (spot only). */ cone: number;
    /** Flicker amount 0..1 (candles/torches); 0 = steady. */ flicker: number;
    /** Flicker speed multiplier. */ flickerSpeed: number;
    /** Per-light phase so many flames don't sync. */ phase: number;
    /** Compositing HEIGHT. `'over'` (default) sits ABOVE the scene — it brightens
     *  the sprites under it (an overhead street lamp). `'under'` lights the FLOOR
     *  BENEATH the sprites — drawn before them, so opaque sprites occlude it and
     *  their pixels are never tinted (a glow that follows the paddle/ball). */
    layer: 'over' | 'under';
    /** Cast shadows off the occluders (opt-in — the per-light visibility
     *  raycast). `false` (default) = a cheap glowing radial light, so thousands
     *  are affordable. */ shadows: boolean;
    /** Penumbra size in world units when `shadows` is on — the light is sampled
     *  as a small disc of this radius, so shadow edges go SOFT. `0` = razor-hard.
     *  Softness costs extra visibility samples, so keep shadow-casters to dozens
     *  (glows without shadows still scale to thousands). */ softness: number;
    /** Toggle without removing. */ on: boolean;
}
/** Options for {@link Lights2d.point}. */
export interface PointLight2dOptions {
    radius?: number;
    intensity?: number;
    color?: [number, number, number];
    falloff?: number;
    flicker?: number;
    flickerSpeed?: number;
    phase?: number;
    /** Cast shadows off occluders (default `false` — a plain glow). */
    shadows?: boolean;
    /** Penumbra size in world units (default `6` when shadows are on; `0` = hard). */
    softness?: number;
    /** `'over'` (default) covers the sprites; `'under'` lights the floor beneath them. */
    layer?: 'over' | 'under';
}
/** Options for {@link Lights2d.spot}. */
export interface SpotLight2dOptions extends PointLight2dOptions {
    /** Facing in radians. */ dir?: number;
    /** Full cone angle in radians (default ~0.9). */ cone?: number;
}
/**
 * The 2D light layer. Add occluders (scenery) + lights, update them each frame,
 * and the layer draws additive, shadowed, colour-mixing lights over the scene.
 * Reach it from a `Game` as `game.lights2d` (created on first use).
 *
 * ```ts
 * const lights = game.lights2d;
 * lights.occluders.addRect(x, y, w, h);            // scenery casts shadow
 * const torch = lights.point(300, 200, { radius: 260, color: [1, 0.7, 0.35], flicker: 0.4 });
 * const lamp  = lights.spot(500, 120, { radius: 400, dir: Math.PI / 2, cone: 0.8, color: [0.6, 0.8, 1] });
 * // each frame just mutate torch.x / torch.y / … ; draw a dark overlay first for atmosphere.
 * ```
 */
export declare class Lights2d {
    private format;
    /** Scenery that casts shadows — add rects / segments / polys to it. */
    readonly occluders: Visibility2d;
    /** The active lights (mutate freely; `point()`/`spot()` append here). */
    readonly lights: Light2d[];
    /** Ambient (base) light colour, `[r,g,b]` 0..1 — the scene is multiplied down
     *  to this before the lights add, so unlit surfaces show DIMLY instead of pure
     *  black. `[1,1,1]` (default) = no ambient darkening; `[0,0,0]` = black unlit;
     *  `[0.12,0.12,0.16]` = a dim blue night. Tint it warm/cool for mood. */
    ambient: [number, number, number];
    private data;
    private count;
    private capacity;
    private time;
    private uniformData;
    private vx;
    private vy;
    private vw;
    private vh;
    private underTris;
    /** Lights drawn last frame after culling — for HUD/debug. */
    visible: number;
    /** Of those, how many cast shadows (the expensive ones) — for HUD/debug. */
    visibleShadow: number;
    private device;
    private pipeline;
    private layout;
    private uniforms;
    private instances;
    private bind;
    private ambientPipeline;
    private ambientUniform;
    private ambientBind;
    private ambientData;
    constructor(device: GPUDevice, format: GPUTextureFormat);
    /** (Re)create every GPU object — the device-loss recovery path. */
    rebuild(device: GPUDevice): void;
    private makeBind;
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
    /**
     * Draw one compositing PHASE. `'under'` (called before the sprite batches)
     * builds + uploads the whole frame and draws the floor lights; `'over'`
     * (called after the scene) draws the lights that cover the sprites. Between
     * them the game draws its sprites, so `'under'` lights never touch them.
     */
    draw(pass: GPURenderPassEncoder, phase: 'under' | 'over'): void;
}

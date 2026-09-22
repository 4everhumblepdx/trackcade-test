// Docs: engine/webgpu/particles3d.md — usage, recipes & traps (this file = exact type signatures)
import { type RampName } from './particles.js';
import type { VfxDef } from './vfx.js';
export interface Emit3dOptions {
    x: number;
    y: number;
    z: number;
    /** Particles in this burst (default 12). */
    count?: number;
    /** Initial speed ± speedVar, world units/s (default 3 ± 1.2). speedVar: 0 = a clean shell. */
    speed?: number;
    speedVar?: number;
    /** Emission cone axis (any length; default: none = every direction). */
    dir?: {
        x?: number;
        y?: number;
        z?: number;
    };
    /** Cone full angle around `dir`, radians (default 2π = a full sphere). */
    spread?: number;
    /** Jitter the spawn point within this sphere radius. Default 0 = point. */
    spawnRadius?: number;
    /** Spawn along a 3D path (Path3d or any { at(t) → point }): each particle
     * starts at a random arc-length fraction; x/y/z become an OFFSET. */
    path?: {
        at(t: number): {
            x: number;
            y: number;
            z: number;
        };
    };
    /** Spawn ON a mesh's surface: a SurfaceSampler over its unit geometry
     * (world.surface(mesh) builds one). Pair with `on` for the live
     * transform; x/y/z become an offset. Without an explicit `dir`,
     * particles launch along the surface NORMAL. */
    surface?: SurfaceSampler;
    /** The live handle whose transform places `surface` samples (a Mesh3d:
     * x/y/z, yaw/pitch/roll, w/h/d are read at emit time). */
    on?: {
        x: number;
        y: number;
        z: number;
        yaw: number;
        pitch: number;
        roll: number;
        w: number;
        h: number;
        d: number;
    };
    /** Particles sample the CLUSTERED LIGHTS (world.light) + ambient — smoke
     * that picks up lantern colour. Additive particles usually want false. */
    lit?: boolean;
    /** Spawn uniformly inside a box of these extents (centred on x/y/z). */
    box?: {
        w?: number;
        h?: number;
        d?: number;
    };
    /** Spawn on a horizontal (XZ) ring of this radius (warp fields, halos). */
    ring?: number;
    /** Lifetime seconds ± lifeVar (default 0.7 ± 0.3). */
    life?: number;
    lifeVar?: number;
    /** Quad half-size (disc radius), world units ± sizeVar (default 0.12 ± 0.05). */
    size?: number;
    sizeVar?: number;
    /** Size over life: true = shrink to nothing, false = constant, or the
     * FINAL size as a fraction of `size` — 0.5 = half, and >1 GROWS
     * (billowing smoke: 2.5 = swells to 2.5×). Default true. */
    shrink?: boolean | number;
    /** Fade alpha over life (default true). */
    fade?: boolean;
    /** DOWNWARD acceleration, units/s² (y-up: positive pulls toward the floor).
     * Negative = embers rising. Default 0. */
    gravity?: number;
    /** Velocity damping per second, 0..1 (default 0). */
    drag?: number;
    /** Smooth lateral (XZ) wander acceleration, units/s² — snow, dust motes. */
    sway?: number;
    /** Sway oscillation frequency, cycles/s (default 1.5). */
    swayFreq?: number;
    /** One colour… */
    color?: string;
    /** …or a palette picked per particle. */
    colors?: string[];
    /** A colour ramp walked over the particle's life — a RAMPS name ('fire',
     * 'smoke', …) or custom hex stops. Overrides color/colors. */
    ramp?: RampName | string[];
    /** Alpha multiplier for the whole emit (default 1). */
    alpha?: number;
    /** Per-particle brightness flicker 0..1 (fireflies, embers, magic dust). */
    twinkle?: number;
    /** Additive blend — glows/fire/sparks (default false = normal alpha). */
    add?: boolean;
    /** Untextured falloff: 1 (default) = a gaussian glow puff (the classic
     * radial particle texture, analytic), 0 = a crisp AA disc. Ignored with
     * `frame`. */
    soft?: number;
    /** Draw an atlas frame instead of the glow puff (star/flare/snowflake/
     * debris textures — `particleCanvas()` generates the classics at
     * runtime; `color`/`ramp` tint the texture). */
    frame?: number;
    /** Random spin up to ±spin rad/s (spins the camera-facing quad). */
    spin?: number;
}
export interface Burst3dOptions {
    /** Cone axis for the recipe's directional emits (layers with a `spread`). */
    dir?: {
        x?: number;
        y?: number;
        z?: number;
    };
    /** Size multiplier from the def's 2D-tuned numbers (default 0.1 — the
     * same 2D→3D convention as trail widths). */
    scale?: number;
    /** Rings lie FLAT in the world XZ plane (default true — a camera-facing
     * ring reads as a 2D effect pasted on the screen; a flat one reads as a
     * shockwave IN the world). false = camera-facing. */
    flat?: boolean;
}
/** The per-instance quad the renderer packs. mode: 0 soft disc, 1 atlas
 * frame, 2 ring (p = stroke thickness as a fraction of the radius). */
/**
 * Area-weighted sampling over a stride-8 triangle soup — the MESH-SURFACE
 * emitter shape. Build once per geometry (the CDF is baked); sample() picks
 * a triangle proportionally to its area and a uniform barycentric point on
 * it, returning position AND face normal (particles can launch along it).
 * Pure — dist-tested.
 */
export declare class SurfaceSampler {
    private cdf;
    private verts;
    constructor(verts: Float32Array);
    /** r1..r3 are uniform randoms 0..1 (pass your seeded rng's outputs). */
    sample(r1: number, r2: number, r3: number): {
        x: number;
        y: number;
        z: number;
        nx: number;
        ny: number;
        nz: number;
    };
}
export type Fx3dWriter = (x: number, y: number, z: number, size: number, rot: number, mode: number, r: number, g: number, b: number, a: number, add: boolean, frame: number, p: number, lit?: boolean) => void;
export declare class Particles3d {
    private rng;
    private pool;
    private alive;
    private clock;
    private bursts;
    /** Pass a seeded rng (e.g. mulberry32) for deterministic headless tests. */
    constructor(rng?: () => number);
    /** Live particle count (bursts' rings/flashes not included). */
    get count(): number;
    /** Spawn a burst of particles. Call once for an explosion, every frame for a stream. */
    emit(opts: Emit3dOptions): void;
    /**
     * Trigger a one-shot VfxDef.burst recipe at a point — the same defs as the
     * 2D `scene.vfx.burst()` ('impact', 'shockwave', …): particle layers ride
     * this pool, rings + flashes render as camera-facing quads. The def's
     * 2D-tuned sizes/speeds are scaled by `opts.scale` (default 0.1).
     */
    burst(def: VfxDef, x: number, y: number, z: number, opts?: Burst3dOptions): void;
    /** Age + integrate particles, run burst recipes (world.tick calls this). */
    /**
     * A CONTINUOUS emitter — the ONLY correct way to run a steady effect
     * (fire, smoke, drips, auras). `rate` is particles per SECOND, wall
     * clock: the engine owns the accumulator, so the alive count is
     * rate × life at ANY refresh rate — per-frame emit() loops double on a
     * 120 Hz display (never do that; emit() is for one-shot BURSTS).
     * Every option is live: mutate handle.rate, handle.x/y/z, handle.on…
     * kill() stops it (existing particles age out naturally).
     */
    stream(opts: Emit3dOptions & {
        rate: number;
    }): Emit3dOptions & {
        rate: number;
        dead: boolean;
        kill(): void;
    };
    private streams;
    update(dt: number): void;
    private updateSim;
    /** Push every live particle + burst ring/flash quad to the writer.
     * Returns the instance count. (The renderer owns the buffer format.) */
    pack(write: Fx3dWriter): number;
    /** Kill everything (world teardown / scene change). */
    clear(): void;
}

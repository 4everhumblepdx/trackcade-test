// Docs: engine/webgpu/particles3d.md — usage, recipes & traps (this file = exact type signatures)
import { type RampName } from './particles.js';
import type { Mat4 } from './math3d.js';
import type { Atlas } from './atlas.js';
export type GpuForce = 
/** Constant acceleration — gravity is { kind: 'accel', y: -9.8 }, wind is a sideways one. */
{
    kind: 'accel';
    x?: number;
    y?: number;
    z?: number;
}
/** Velocity damping per second (0..~5). */
 | {
    kind: 'drag';
    amount?: number;
}
/** Divergence-free curl-noise flow — smoke/magic that SWIRLS. `scale` =
 * noise features per world unit (default 0.35), `speed` = how fast the
 * flow field itself evolves (default 0.4). */
 | {
    kind: 'curl';
    strength?: number;
    scale?: number;
    speed?: number;
}
/** Pull toward (push from, with negative strength) a point. `radius` is
 * the falloff softening distance (default 3). */
 | {
    kind: 'attract';
    x?: number;
    y?: number;
    z?: number;
    strength?: number;
    radius?: number;
}
/** Swirl around an axis through a point (tornado). `ax/ay/az` = axis
 * (default +Y up); tangential force peaks one unit from the axis. */
 | {
    kind: 'vortex';
    x?: number;
    y?: number;
    z?: number;
    ax?: number;
    ay?: number;
    az?: number;
    strength?: number;
}
/** Orbit a point around the +Y axis: tangential drive + a spring toward
 * the `radius` shell (accretion discs, halos). */
 | {
    kind: 'orbit';
    x?: number;
    y?: number;
    z?: number;
    strength?: number;
    radius?: number;
    spring?: number;
};
export declare const MAX_GPU_FORCES = 8;
/** Pack a force list into the uniform's 8×2-vec4 layout (pure, dist-tested). */
export declare function packForces(forces: GpuForce[]): Float32Array<ArrayBuffer>;
/** PCG hash (u32 in, u32 out) — the kernel's randomness source. */
export declare function pcg(v: number): number;
/** u32 hash → [0, 1). */
export declare function rand01(h: number): number;
/** 3D value noise on an integer lattice, trilinear smoothstep — [0, 1). */
export declare function vnoise3(x: number, y: number, z: number, seed: number): number;
/** Curl of a hash-noise potential field — divergence-free by construction
 * (∇·(∇×ψ) = 0), which is WHY curl flow swirls instead of clumping: the
 * dist test asserts numerical divergence ≈ 0. */
export declare function curl3(x: number, y: number, z: number, seed: number): [number, number, number];
/** CPU twin of the kernel's WRAP fold: map `v` into the extent-`e` box
 * centred on `c`, torus-style (e <= 0 = unwrapped). Runs per axis; the
 * kernel applies it AFTER the integration step. */
export declare function wrap1(v: number, c: number, e: number): number;
/** Is pool slot `i` inside this frame's spawn ring window [s0, s0+n) mod cap? */
export declare function inSpawnWindow(i: number, spawn0: number, n: number, capacity: number): boolean;
/** The CPU-visible particle state (the kernel's 12-float record). */
export interface GpuP {
    x: number;
    y: number;
    z: number;
    age: number;
    vx: number;
    vy: number;
    vz: number;
    life: number;
    size: number;
    seed: number;
    spin: number;
}
/** Spawn-shape/motion inputs the init consumes (a subset of the emitter opts,
 * already defaulted — see GpuEmitter.resolved). */
export interface GpuSpawn {
    x: number;
    y: number;
    z: number;
    dirX: number;
    dirY: number;
    dirZ: number;
    spread: number;
    speed: number;
    speedVar: number;
    life: number;
    lifeVar: number;
    size: number;
    sizeVar: number;
    spin: number;
    spawnRadius: number;
    ring: number;
    boxW: number;
    boxH: number;
    boxD: number;
}
/** CPU twin of the kernel's spawn init: particle `i` under frame-seed `seed`.
 * Deterministic — same (i, seed) always births the same particle. */
export declare function spawnGpuParticle(i: number, seed: number, s: GpuSpawn): GpuP;
/** CPU twin of the kernel's integration step (no collision — that needs a
 * depth buffer). Mutates and returns `p`. `flutter`/`flutterFreq` mirror
 * the emitter options (the falling-leaf rock). */
export declare function stepGpuParticle(p: GpuP, forces: Float32Array | number[], forceCount: number, dt: number, time: number, flutter?: number, flutterFreq?: number): GpuP;
/** Assemble the compute kernel (pure string work — dist-tested). `ms` picks
 * the depth binding type to match the world's MSAA mode. */
export declare function buildGpuParticleComputeWGSL(ms: boolean): string;
/** Assemble the render shader (camera-facing/velocity-stretched quads with
 * ramp-over-life, twinkle, soft depth fade). Pure string work. */
export declare function buildGpuParticleRenderWGSL(ms: boolean): string;
export interface GpuEmitterOptions {
    x?: number;
    y?: number;
    z?: number;
    /** Pool size — the max simultaneously alive (default 65536). The pool is a
     * RING: if rate × life exceeds it, the oldest particles are recycled. */
    capacity?: number;
    /** Continuous spawn rate, particles/second (default 0 — burst-driven). */
    rate?: number;
    /** Emission cone axis (any length; omit = every direction). */
    dir?: {
        x?: number;
        y?: number;
        z?: number;
    };
    /** Cone full angle around dir, radians (default 2π). */
    spread?: number;
    /** RADIAL emission: velocity points AWAY from the emitter origin — pair
     * with `ring`/`spawnRadius`/`box` spawn shapes for shockwaves, novas and
     * explosion shells (overrides dir/spread). */
    radial?: boolean;
    speed?: number;
    speedVar?: number;
    /** Jitter the spawn point within this sphere radius. */
    spawnRadius?: number;
    /** Spawn uniformly inside a box of these extents. */
    box?: {
        w?: number;
        h?: number;
        d?: number;
    };
    /** Spawn on a horizontal (XZ) ring of this radius. */
    ring?: number;
    life?: number;
    lifeVar?: number;
    size?: number;
    sizeVar?: number;
    /** Size over life — true shrinks to 0, false constant, a number = final
     * fraction (>1 grows). Default true. */
    shrink?: boolean | number;
    /** Alpha out at the end of life: true = over the WHOLE life (linear),
     * false = never, a number = only over that final FRACTION of life
     * (0.12 = opaque until the last 12% — petals/leaves/debris want this;
     * a whole-life fade leaves most of the pool translucent). Default true. */
    fade?: boolean | number;
    /** Colour ramp over life ('fire', 'smoke', … or hex stops). */
    ramp?: RampName | string[];
    color?: string;
    /** A palette picked per particle (mutually exclusive with ramp). */
    colors?: string[];
    alpha?: number;
    twinkle?: number;
    /** Additive blend. DEFAULT TRUE here (unlike the CPU pool): a 100k pool is
     * unsorted, and additive is the only order-independent look. */
    add?: boolean;
    /** Untextured falloff: 1 = gaussian glow puff (default), 0 = crisp disc. */
    soft?: number;
    /** Atlas frame instead of the disc (tinted by color/ramp). */
    frame?: number;
    /** Random spin up to ±spin rad/s. */
    spin?: number;
    /** Velocity stretch: elongate the quad along motion by stretch × speed
     * (motion-blurred sparks). Default 0. */
    stretch?: number;
    /** FLUTTER: the falling-leaf rock — horizontal oscillating acceleration,
     * per-particle direction + phase (petals, leaves, paper, feathers).
     * Units/s²; try 1.5–3 with gentle gravity. Default 0. */
    flutter?: number;
    /** Flutter oscillation frequency, cycles/s (default 0.7). */
    flutterFreq?: number;
    /** TUMBLE 0..1: fake the quad turning over in 3D — its across-axis
     * squashes on a per-particle cosine (thin + dimmed when edge-on).
     * Petals/leaves/confetti read flat without it. Default 0. */
    tumble?: number;
    /** Tumble rate, turns/s (default 0.6). */
    tumbleSpeed?: number;
    /** Soft-particle fade distance in world units (default 0.25; 0 = off). */
    softFade?: number;
    /** WRAP: fold particle positions torus-style into a box of these extents
     * centred on the emitter origin (true = the spawn `box` extents). THE
     * large-area recipe: size the box a little past the fog distance, move
     * the emitter with the camera every frame, and a bounded pool reads as
     * weather over an unlimited world — particles recycle across the
     * trailing edge; fallers wrap back to the top (infinite rain from one
     * burst). A zero extent leaves that axis unwrapped. Rested particles
     * never wrap (they're lying on geometry). */
    wrap?: boolean | {
        w?: number;
        h?: number;
        d?: number;
    };
    /** The force stack (data — see GpuForce). Live-mutable. */
    forces?: GpuForce[];
    /** DEPTH-BUFFER collision: particles bounce off (or die on) whatever is
     * on screen. true = { bounce: 0.5 }. `rest: true` = once a bounce has
     * bled the speed off, the particle COMES TO REST where it lies: the sim
     * freezes it, spin/tumble stop, and it settles FLAT in the world plane
     * (petals and snow on the ground) until its life fades out.
     * `respawn: true` = on contact the particle is instantly REBORN via the
     * spawn init — the infinite-rain mode: one burst + wrap recycles
     * forever, nothing accumulates, nothing bounces. Directional emitters
     * re-enter at the box face OPPOSITE `dir` (rain: the top face), keeping
     * the sky's influx uniform — a volume rebirth would paint the ground's
     * height map into the sky's rain density (columns over tall objects
     * cycle at different rates). Omni emitters rebirth in the volume.
     * `thickness` = contact distance in world units: a hit needs the
     * particle within this true 3D distance of the visible surface point
     * (not merely close along the view ray — that over-triggers at grazing
     * angles). */
    collide?: boolean | {
        bounce?: number;
        friction?: number;
        kill?: boolean;
        rest?: boolean;
        respawn?: boolean;
        thickness?: number;
    };
}
/** A persistent GPU emitter. Mutate the public fields freely — the uniform is
 * repacked every frame. `kill()` releases the pool. */
export declare class GpuEmitter {
    x: number;
    y: number;
    z: number;
    /** Particles per second (live). */
    rate: number;
    /** The full option surface — mutate anything (forces included). */
    readonly opts: GpuEmitterOptions;
    readonly capacity: number;
    /** Alive count, ~2 frames stale (async readback). */
    alive: number;
    dead: boolean;
    constructor(opts: GpuEmitterOptions);
    /** Queue an immediate one-shot spawn of `count` particles this frame. */
    burst(count: number): void;
    /** Release the emitter and its GPU pool. */
    kill(): void;
}
export declare class GpuParticles {
    private format;
    private sampleCount;
    private filter;
    private emitters;
    private device;
    private computePipeline;
    private resetPipeline;
    private renderPipeline;
    private computeLayout;
    private renderLayout;
    private sampler;
    private uniformScratch;
    private depthTex;
    private depthView;
    private pendingMaps;
    constructor(device: GPUDevice, format: GPUTextureFormat, sampleCount: number, filter: GPUFilterMode);
    /** Live emitters (dead ones are reaped in compute()). */
    get list(): readonly GpuEmitter[];
    /** Total alive particles across emitters (readback — ~2 frames stale). */
    get count(): number;
    emitter(opts: GpuEmitterOptions): GpuEmitter;
    /** (Re)create pipelines; per-emitter buffers are re-allocated too (their
     * particle state is GPU-only and simply restarts — device loss already
     * blanks the screen for a frame). */
    rebuild(device: GPUDevice): void;
    private allocate;
    private release;
    /** Pack the per-frame uniform for one emitter (pure-ish: writes scratch). */
    private packUniform;
    /**
     * Encode this frame's sim: per emitter — reset the indirect args (encoder-
     * ordered, so the pre-reset count can be copied out for the readback),
     * repack + upload the uniform, dispatch the update kernel. Runs BEFORE the
     * render passes; collision reads `depth` (last frame's content).
     */
    compute(encoder: GPUCommandEncoder, dt: number, time: number, depth: GPUTexture, prevVP: Mat4 | null, prevInv: Mat4 | null, projA: number, projB: number, atlas: Atlas): void;
    /** Draw every emitter into the (translucent) pass — one drawIndirect each. */
    render(pass: GPURenderPassEncoder, worldUniforms: GPUBuffer, atlasView: GPUTextureView | null): void;
    /** Kick off the alive-count readbacks — call AFTER queue.submit() (a
     * pending map on a buffer inside a submit is a validation error). */
    afterSubmit(): void;
    /** Kill everything (world teardown). */
    clear(): void;
}
export declare const GPU_PARTICLE_LAYOUT: {
    readonly P_FLOATS: 12;
    readonly EU_TOTAL: 184;
    readonly offsets: {
        readonly spawn: 0;
        readonly origin: 4;
        readonly dir: 8;
        readonly box: 12;
        readonly motion: 16;
        readonly shape: 20;
        readonly look: 24;
        readonly look2: 28;
        readonly uv: 32;
        readonly hit: 36;
        readonly softp: 40;
        readonly screen: 44;
        readonly flut: 48;
        readonly wrapv: 52;
        readonly forces: 56;
        readonly prevVP: 120;
        readonly prevInv: 136;
        readonly ramp: 152;
    };
};

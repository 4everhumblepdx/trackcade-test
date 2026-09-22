// Docs: engine/webgpu/agents.md — usage, recipes & traps (this file = exact type signatures)
import type { Path3d } from './path3d.js';
import type { FlowField } from './navgrid3d.js';
import { type NavMesh3d, type NavMeshOptions, type PathPlanner } from './agentnav3d.js';
export interface Vec3 {
    x: number;
    y: number;
    z: number;
}
type Vec3Like = Vec3;
/** A steering target: a fixed point, another agent (tracked live), or a fn. */
export type TargetLike = Vec3Like | Agent3d | (() => Vec3Like);
export interface BehaviorBase {
    weight?: number;
    priority?: number;
}
export type BehaviorSpec = (BehaviorBase & {
    kind: 'seek';
    target: TargetLike;
}) | (BehaviorBase & {
    kind: 'flee';
    target: TargetLike;
    radius?: number;
}) | (BehaviorBase & {
    kind: 'arrive';
    target: TargetLike;
    slowRadius?: number;
    tolerance?: number;
}) | (BehaviorBase & {
    kind: 'pursue';
    target: Agent3d;
    maxPredict?: number;
}) | (BehaviorBase & {
    kind: 'evade';
    target: Agent3d;
    maxPredict?: number;
    radius?: number;
}) | (BehaviorBase & {
    kind: 'wander';
    radius?: number;
    distance?: number;
    jitter?: number;
    vertical?: number;
}) | (BehaviorBase & {
    kind: 'follow';
    path: Path3d;
    lookAhead?: number;
    loop?: boolean;
    speed?: number;
}) | (BehaviorBase & {
    kind: 'flock';
    separation?: number;
    alignment?: number;
    cohesion?: number;
    radius?: number;
    neighbors?: number;
}) | (BehaviorBase & {
    kind: 'avoid';
    lookAhead?: number;
    radius?: number;
    planar?: boolean;
}) | (BehaviorBase & {
    kind: 'terrain';
    clearance: number;
    groundAt: (x: number, z: number) => number;
    lookAhead?: number;
}) | (BehaviorBase & {
    kind: 'ceiling';
    below: number | ((x: number, z: number) => number);
    margin?: number;
}) | (BehaviorBase & {
    kind: 'contain';
    box?: {
        min: Vec3;
        max: Vec3;
    };
    sphere?: {
        center: Vec3;
        radius: number;
    };
    soft?: number;
}) | (BehaviorBase & {
    kind: 'leader';
    leader: Agent3d;
    behind?: number;
}) | (BehaviorBase & {
    kind: 'edge';
    walkable: (x: number, z: number) => boolean;
    lookAhead?: number;
}) | (BehaviorBase & {
    kind: 'navigate';
    grid: PathPlanner;
    target: TargetLike;
    repathEvery?: number;
    arrive?: number;
    tolerance?: number;
}) | (BehaviorBase & {
    kind: 'flow';
    field: FlowField;
}) | (BehaviorBase & {
    kind: 'custom';
    fn: (agent: Agent3d, out: Vec3, dt: number) => void;
});
export declare class SpatialHash3 {
    private cellSize;
    private tableSize;
    private mask;
    private counts;
    private starts;
    private items;
    private cellOf;
    private seenBuckets;
    /** drop the Y dimension for surface-bound swarms (ground crowds). */
    flat: boolean;
    constructor(cellSize: number, capacity: number, tablePow?: number);
    private key;
    /** Rebuild from the live agent positions (indices 0..n-1). */
    build(agents: Agent3d[]): void;
    /** Nearest up-to-k neighbours of agent `self` within `radius`, written into
     * `outIdx` (indices) / `outD2` (squared distances); returns the count. */
    query(agents: Agent3d[], self: number, radius: number, k: number, outIdx: Int32Array, outD2: Float32Array): number;
}
/** Brute-force nearest-k (small flocks skip the hash — the physics.ts lesson). */
export declare function neighborsBrute(agents: Agent3d[], self: number, radius: number, k: number, outIdx: Int32Array, outD2: Float32Array): number;
export interface FieldOptions {
    pos?: Vec3;
    follow?: {
        x: number;
        y: number;
        z: number;
    };
    radius: number;
    strength: number;
    falloff?: 'linear' | 'invsq';
    mode?: 'attract' | 'repel';
}
export declare class Field3d {
    pos: Vec3;
    follow: {
        x: number;
        y: number;
        z: number;
    } | null;
    radius: number;
    strength: number;
    falloff: 'linear' | 'invsq';
    mode: 'attract' | 'repel';
    dead: boolean;
    constructor(o: FieldOptions);
    at(): Vec3;
    kill(): void;
}
export interface ObstacleOptions {
    sphere?: {
        center: Vec3;
        radius: number;
    };
    box?: {
        min: Vec3;
        max: Vec3;
    };
}
export declare class Obstacle3d {
    sphere: {
        center: Vec3;
        radius: number;
    } | null;
    box: {
        min: Vec3;
        max: Vec3;
    } | null;
    dead: boolean;
    constructor(o: ObstacleOptions);
    kill(): void;
}
export interface AgentConfig {
    pos?: Vec3;
    vel?: Vec3;
    maxSpeed?: number;
    maxForce?: number;
    mass?: number;
    behaviors?: BehaviorSpec[];
    handle?: {
        x: number;
        y: number;
        z: number;
        yaw?: number;
        pitch?: number;
        roll?: number;
    } | null;
    seed?: number;
    /** Steering solved every Nth fixed step (LOD); velocity integrates always. */
    tickEvery?: number;
    /** Radians/sec the heading damps toward velocity (never snaps). */
    turnRate?: number;
    /** Max pitch (radians) — clamp for flyers/swimmers. */
    maxPitch?: number;
    /** Bank into turns: roll ∝ lateral steering (0 = none). */
    bank?: number;
    /** GROUND agents: glue the body to a surface. Steering owns XZ; after each
     * step the Y is SNAPPED to `at(x,z) + offset` (walkers, monsters, herds —
     * `at` can return terrain OR a ramp/plank/platform top). `slope: true` also
     * pitches the body to the surface gradient so it climbs ramps convincingly. */
    ground?: {
        at: (x: number, z: number) => number;
        offset?: number;
        slope?: boolean;
    } | null;
}
export declare class Agent3d {
    readonly id: number;
    pos: Vec3;
    prev: Vec3;
    vel: Vec3;
    maxSpeed: number;
    maxForce: number;
    mass: number;
    behaviors: BehaviorSpec[];
    handle: {
        x: number;
        y: number;
        z: number;
        yaw?: number;
        pitch?: number;
        roll?: number;
    } | null;
    tickEvery: number;
    turnRate: number;
    maxPitch: number;
    bank: number;
    ground: {
        at: (x: number, z: number) => number;
        offset: number;
        slope: boolean;
    } | null;
    yaw: number;
    pitch: number;
    roll: number;
    /** panic timer (s) — a repulsor spike scatters a shoal (speed x panicMult). */
    panic: number;
    /** wander target on the projected sphere (persisted for a smooth walk). */
    wx: number;
    wy: number;
    wz: number;
    /** follow-behaviour progress along its path (world distance). */
    followD: number;
    /** avoid-behaviour hysteresis: the committed dodge side (±1) + its hold timer,
     * so the agent arcs around an obstacle on ONE side instead of jittering. */
    avoidSide: number;
    avoidHold: number;
    /** navigate-behaviour state: the current A* waypoint list + cursor + timers. */
    navPath: Vec3[] | null;
    navIdx: number;
    navTimer: number;
    navGoalX: number;
    navGoalZ: number;
    /** per-instance wiggle phase (fish tail / wing flap) — rides a spare slot. */
    phase: number;
    rng: () => number;
    dead: boolean;
    /** last accumulated steering force (for gizmos). */
    force: Vec3;
    constructor(c?: AgentConfig);
    private wander0;
    get speed(): number;
    kill(): void;
}
interface StepCtx {
    agents: Agent3d[];
    fields: Field3d[];
    obstacles: Obstacle3d[];
    nIdx: Int32Array;
    nD2: Float32Array;
    nCount: number;
}
/** Integrate one agent for a fixed step, then damp its body language. */
export declare function integrateAgent(a: Agent3d, ctx: StepCtx, dt: number, solveSteering: boolean): void;
/** Damp the heading toward the velocity (never snap) and write the pose onto
 * the render handle, interpolated between the last two sim steps by `alpha`. */
export declare function writePose(a: Agent3d, alpha: number): void;
/** Shortest-arc angle damp (handles the ±π wrap). */
export declare function dampAngle(cur: number, target: number, k: number): number;
export declare const AGENT_PRESETS: Record<string, () => AgentConfig>;
export interface AgentsOptions {
    fixedStep?: number;
    hashCell?: number;
}
export declare class Agents3d {
    readonly agents: Agent3d[];
    readonly fields: Field3d[];
    readonly obstacles: Obstacle3d[];
    /** gizmos through game.debug (velocity/force/neighbours) when true. */
    debug: boolean;
    private fixedDt;
    private acc;
    private hash;
    private hashCell;
    private nIdx;
    private nD2;
    private alpha;
    constructor(opts?: AgentsOptions);
    spawn(config: AgentConfig): Agent3d;
    /** A flock of `n` agents sharing a config (or bind to existing handles). */
    flock(config: AgentConfig & {
        preset?: keyof typeof AGENT_PRESETS;
    }, nOrHandles: number | Array<AgentConfig['handle']>): Agent3d[];
    /** Bake a recast NAVMESH (Tier-3) from geometry — real level meshes or a
     * terrain heightfield. Async: lazily loads the vendored WASM core on first
     * call. The result drops into a `navigate` behaviour like a NavGrid:
     *   const nav = await world.agents().navmesh({ from: 'terrain', heightAt, size: 400 });
     *   agents.spawn({ behaviors: [{ kind: 'navigate', grid: nav, target }] }); */
    navmesh(opts: NavMeshOptions): Promise<NavMesh3d>;
    readonly navmeshes: NavMesh3d[];
    attractor(o: Omit<FieldOptions, 'mode'>): Field3d;
    repulsor(o: Omit<FieldOptions, 'mode'>): Field3d;
    obstacle(o: ObstacleOptions): Obstacle3d;
    /** Called each display frame by World3d; runs ≤3 fixed steps + interpolates. */
    tick(dt: number): void;
    private _stepIdx;
    /** One fixed simulation step (public for dist tests). */
    step(dt: number, stepIdx?: number): void;
    private reap;
    /** Drop every agent/field/obstacle/navmesh (render handles are yours to kill).
     * Lets a demo tear a scene down and rebuild another. */
    clear(): void;
    get count(): number;
}
export {};

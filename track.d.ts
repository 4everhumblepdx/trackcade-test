// Docs: engine/webgpu/track.md — usage, recipes & traps (this file = exact type signatures)
/**
 * Track networks — the "Bloons" tower-defense model: enemies follow a FIXED,
 * authored path (which may fork and merge); guns are placed BESIDE it and just
 * shoot. Pure CPU math, zero engine dependency; import it directly
 * (`import { Track } from '../engine/webgpu.js'`). NOT wired into `Game`.
 *
 * This is the counterpart to `FlowGrid` (open-field, towers reshape routes):
 * here the route is authored and immutable. A `Track` is a directed graph of
 * named nodes connected by {@link Path} edges (straight or curved). A
 * {@link TrackWalker} walks from a spawn node to a goal node, choosing a branch
 * at each junction — all the arc-length curve maths is reused from `Path`, so
 * hundreds of followers are cheap.
 *
 * Feeds either engine dimension: read `walker.x` / `walker.y` (world position)
 * and `walker.angle` each frame to place a sprite or a 3D mesh (use x/y as x/z
 * on the ground plane). For the towers: `track.distanceToTrack(x, y)` validates
 * "not on the path" placement, and `walker.distanceToGoal` ranks targets by how
 * far along the track they are (the classic "first"/"last" targeting).
 */
import { Path, type PathPoint, type PathSegmentData, type PathOptions } from './path.js';
import type { Vec2 } from './util.js';
/** One directed edge of the track in the data notation. */
export interface TrackEdgeData {
    /** Name of the node this edge leaves. */
    from: string;
    /** Name of the node this edge arrives at. */
    to: string;
    /** Optional curve geometry (any {@link PathSegmentData} chain, continuing from
     *  `from`'s point). Omit for a straight line between the two nodes. */
    via?: PathSegmentData[];
    /** Relative likelihood of taking this edge at a branching node (default `1`). */
    weight?: number;
}
/** The plain-data track notation — JSON-friendly, author it inline. */
export interface TrackData {
    /** Named node positions, `name: [x, y]`. */
    nodes: Record<string, PathPoint>;
    /** The directed edges connecting them. */
    edges: TrackEdgeData[];
    /** Entry node names (default: every node with no incoming edge). */
    spawns?: string[];
    /** Exit node names — reaching one ends the run / "leaks" (default: every node
     *  with no outgoing edge). */
    goals?: string[];
}
/** Parse-time transform for the whole network (same as {@link PathOptions}). */
export type TrackOptions = PathOptions;
/** A baked edge: its {@link Path}, endpoints, length and a sampled polyline. */
export interface TrackEdge {
    /** Node name this edge leaves. */
    from: string;
    /** Node name this edge arrives at. */
    to: string;
    /** The arc-length curve for this edge. */
    path: Path;
    /** Geometric length in world units. */
    length: number;
    /** Branch weight at the `from` node. */
    weight: number;
    /** A sampled polyline of the edge, for drawing + nearest-point queries. */
    points: Vec2[];
}
/**
 * A network of authored path segments that enemies follow. Build it once, then
 * `spawn()` walkers and advance them each frame.
 *
 * ```ts
 * const track = new Track({
 *   nodes: { in: [0, 300], fork: [400, 300], top: [800, 120], bot: [800, 480], out: [1200, 300] },
 *   edges: [
 *     { from: 'in', to: 'fork' },
 *     { from: 'fork', to: 'top', via: [{ quad: [[600, 120], [800, 120]] }] },   // branch A
 *     { from: 'fork', to: 'bot', via: [{ quad: [[600, 480], [800, 480]] }] },   // branch B
 *     { from: 'top', to: 'out' }, { from: 'bot', to: 'out' },                    // merge
 *   ],
 * });
 * const w = track.spawn(140);                    // 140 units/s
 * // per frame: w.advance(dt); sprite.x = w.x; sprite.y = w.y;  if (w.done) leak();
 * ```
 */
export declare class Track {
    /** All baked edges. */
    readonly edges: TrackEdge[];
    /** Spawn node names. */
    readonly spawns: string[];
    /** Goal node names. */
    readonly goals: string[];
    private nodes;
    constructor(data: TrackData, options?: TrackOptions);
    /** Sample a Path into a polyline (≈ one point per 8 units, min 2). */
    private _sample;
    /** Dijkstra on the REVERSED graph from every goal → shortest along-track
     *  distance from each node to a goal (used for target ranking). */
    private _computeToGoal;
    /** The world position of a named node, or `null` if unknown. */
    nodeAt(name: string): Vec2 | null;
    /** The total length of the track (sum of all edges). */
    get length(): number;
    /**
     * Create a follower. It enters at `from` (or a random spawn node) and picks a
     * branch at each junction using the edge weights and `rng` (default
     * `Math.random`). `speed` is world units per second; `startDist` staggers a
     * stream by starting it that far along.
     */
    spawn(speed: number, opts?: {
        from?: string;
        rng?: () => number;
        startDist?: number;
    }): TrackWalker;
    /**
     * Shortest distance from world point `(x, y)` to the track centre-line — for
     * validating tower placement ("must be off the path by `margin`") and for
     * range-of-track checks. Returns `Infinity` for an empty track.
     */
    distanceToTrack(x: number, y: number): number;
}
/**
 * A single follower walking a {@link Track}. Construct via `track.spawn()`;
 * call `advance(dt)` each frame and read `x` / `y` / `angle` / `done`.
 */
export declare class TrackWalker {
    private track;
    private rng;
    /** Current world X. */
    x: number;
    /** Current world Y. */
    y: number;
    /** Heading in radians (direction of travel). */
    angle: number;
    /** `true` once a goal node is reached (the enemy "leaked"). */
    done: boolean;
    /** Total distance travelled along the track so far. */
    travelled: number;
    /** Travel speed in world units per second — mutate live (slows, boosts). */
    speed: number;
    private edge;
    private edgeDist;
    constructor(track: Track, edge: TrackEdge | null, speed: number, rng: () => number);
    /** Remaining along-track distance to the nearest goal — SMALLER means FURTHER
     *  along (use it to target the "first" enemy: the one closest to leaking). */
    get distanceToGoal(): number;
    /** Advance by `dt` seconds, carrying across junctions and choosing branches.
     *  Returns `this.done`. */
    advance(dt: number): boolean;
    private _writePose;
}

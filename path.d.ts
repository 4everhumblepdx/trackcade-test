// Docs: engine/webgpu/track.md — usage, recipes & traps (this file = exact type signatures)
import type { Vec2 } from './util.js';
/** An easing: the name of a standard ease (see tween's `standardEasingFunctions` —
 *  'linear', 'easeInQuad', 'easeOutCubic', 'bounce', …) or your own (t: 0..1) => 0..1. */
export type PathEase = string | ((t: number) => number);
/** A point in the data notation — `[x, y]`. */
export type PathPoint = [number, number];
/** One segment of the plain-data path notation. Every segment continues from the
 *  path's current point; coordinates are absolute (transform at parse time via
 *  {@link PathOptions}). Exactly one of the shape keys per segment. */
export interface PathSegmentData {
    /** Straight line to `[x, y]`. */
    line?: PathPoint;
    /** Quadratic bézier: `[control, to]`. */
    quad?: [PathPoint, PathPoint];
    /** Cubic bézier: `[control1, control2, to]`. */
    cubic?: [PathPoint, PathPoint, PathPoint];
    /** Elliptical arc about a centre. Starts at the current point (start angle and
     *  x-radius are derived from it); sweeps to absolute angle `to` (DEGREES —
     *  beyond ±360 keeps orbiting). `ry` defaults to the derived x-radius (circle). */
    arc?: {
        center: PathPoint;
        to: number;
        ry?: number;
    };
    /** Spiral about a centre: like `arc`, but the radius glides to `endRadius`
     *  over `turns` full revolutions (positive = clockwise, negative = counter). */
    spiral?: {
        center: PathPoint;
        turns: number;
        endRadius: number;
    };
    /** Sinusoidal wave: ride the straight chord to `to` while oscillating
     *  perpendicular by `amplitude` px over `cycles` full waves.
     *  `shape: 'triangle'` makes it a zigzag. */
    wave?: {
        to: PathPoint;
        amplitude: number;
        cycles: number;
        shape?: 'sine' | 'triangle';
    };
    /** Ease applied across THIS segment's travel (name or function). */
    ease?: PathEase;
}
/** The plain-data path notation — JSON-friendly: author it inline, in config
 *  tables, or load it with `loadJson`. */
export interface PathData {
    /** Where the path begins, `[x, y]`. */
    start: PathPoint;
    /** The chained segments, each continuing from the previous end point. */
    segments: PathSegmentData[];
    /** Ease applied across the WHOLE path's travel (on top of per-segment eases). */
    ease?: PathEase;
}
/** Parse-time options — transform the authored coordinates once, at the bake. */
export interface PathOptions {
    /** Mirror every x about this vertical axis (`flipX: W / 2` flips a wave to
     *  the other side of the screen). */
    flipX?: number;
    /** Mirror every y about this horizontal axis. */
    flipY?: number;
    /** Translate the whole path by `[dx, dy]`. */
    offset?: PathPoint;
    /** Samples baked per segment (the arc-length table resolution). Default 48 —
     *  raise for very long or very curly segments. */
    samplesPerSegment?: number;
}
/**
 * A 2D path: curve segments chained into one constant-speed route, baked once.
 *
 * ```ts
 * const swoop = new Path({
 *   start: [400, 40],
 *   segments: [
 *     { cubic: [[300, 40], [220, 200], [120, 200]], ease: 'easeOutQuad' },
 *     { wave: { to: [-20, 120], amplitude: 18, cycles: 2 } },
 *   ],
 * });
 * const p = swoop.getPoint(0.5);          // halfway ALONG the route (by distance)
 * sprite.x = p.x; sprite.y = p.y;
 * sprite.rot = swoop.getAngle(0.5);       // facing its direction of travel
 * ```
 *
 * `getPoint(t)` is O(log samples) — a binary search over the baked table — so
 * hundreds of followers per frame are cheap.
 */
export declare class Path {
    /** Total geometric length of the path, in pixels. */
    readonly length: number;
    private readonly segments;
    private readonly pathEase;
    constructor(data: PathData, options?: PathOptions);
    /** Build a Path from a JSON string or an already-parsed data object. */
    static fromJSON(json: string | PathData, options?: PathOptions): Path;
    /** The point at `t` (0 = start, 1 = end) measured BY DISTANCE along the path
     *  (constant speed unless eased). Pass `out` to avoid allocating. */
    getPoint(t: number, out?: Vec2): Vec2;
    /** The direction of travel at `t`, in radians (atan2 convention — feed it
     *  straight to `sprite.rot` so art faces along the path). */
    getAngle(t: number): number;
}
/**
 * Walks a {@link Path} at a speed in px/s — the per-frame driver for a follower.
 * Construct once, call `advance(dt)` each frame, read `t` / `done`:
 *
 * ```ts
 * const walker = new PathWalker(swoop, 120);          // 120 px/s, once through
 * // in update(dt):
 * walker.advance(dt);
 * const p = path.getPoint(walker.t);
 * this.x = p.x; this.y = p.y;
 * if (walker.done) this.kill();
 * ```
 */
export declare class PathWalker {
    readonly path: Path;
    /** `'once'` (default) stop at the end · `'loop'` wrap to the start · `'yoyo'` bounce. */
    readonly mode: 'once' | 'loop' | 'yoyo';
    /** Current progress 0..1 (by distance). */
    t: number;
    /** `true` once a `'once'` walk reaches the end (never for loop/yoyo). */
    done: boolean;
    /** Travel speed in px/s — change it live (boosts, slow-motion). */
    speed: number;
    private dir;
    constructor(path: Path, speed: number, 
    /** `'once'` (default) stop at the end · `'loop'` wrap to the start · `'yoyo'` bounce. */
    mode?: 'once' | 'loop' | 'yoyo', 
    /** Start partway along (0..1) — stagger a stream of followers. */
    startT?: number);
    /** Advance by `dt` seconds. Returns `this.done` for convenience. */
    advance(dt: number): boolean;
    /** Reset to the start (or `startT`), forward, not done. */
    reset(startT?: number): void;
}

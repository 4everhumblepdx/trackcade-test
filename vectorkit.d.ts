// Docs: engine/webgpu/vector.md — usage, recipes & traps (this file = exact type signatures)
import type { Vec2 } from './util.js';
import type { Draw } from './draw.js';
/** A wall segment from `a` to `b` — terrain pieces, cave walls, arena edges. */
export interface Segment {
    a: Vec2;
    b: Vec2;
}
/**
 * 2D vector math over plain `{x, y}` data, as a single namespace so the generic
 * names (`add`, `scale`, `dot`…) don't collide with anything in a game's scope.
 */
export declare const vec: {
    add(a: Vec2, b: Vec2): Vec2;
    sub(a: Vec2, b: Vec2): Vec2;
    scale(a: Vec2, s: number): Vec2;
    dot(a: Vec2, b: Vec2): number;
    len2(a: Vec2): number;
    len(a: Vec2): number;
    dist2(a: Vec2, b: Vec2): number;
    dist(a: Vec2, b: Vec2): number;
    /** Zero-safe normalize: a zero vector returns `{0,0}` rather than NaN. */
    normalize(a: Vec2): Vec2;
    /** Clamp a vector's magnitude to at most `max` (terminal-velocity caps). */
    clampLen(a: Vec2, max: number): Vec2;
    /** A unit (or `mag`-length) vector at the given angle in radians. */
    fromAngle(rad: number, mag?: number): Vec2;
    /** The angle of a vector in radians (-PI..PI). */
    angleOf(a: Vec2): number;
    /** Rotate a vector by `rad` radians. */
    rotate(a: Vec2, rad: number): Vec2;
    /** Linear interpolation between two points. */
    lerp(a: Vec2, b: Vec2, t: number): Vec2;
    /**
     * Move `from` toward `to` by at most `maxStep`, never overshooting (it clamps
     * exactly at `to`).
     */
    stepToward(from: Vec2, to: Vec2, maxStep: number): Vec2;
    /** Turn one heading toward another by at most `maxStep` radians (capped steering). */
    turnToward(fromRad: number, toRad: number, maxStep: number): number;
};
/** Transform local-space vertices to world space by position and rotation. */
export declare function transformVerts(localVerts: Vec2[], pos: Vec2, rot?: number): Vec2[];
/**
 * Ray-casting (even-odd) point-in-polygon test. `worldPoly` MUST be in world
 * space — call `transformVerts` first. Handles convex AND concave simple
 * polygons of either winding.
 */
export declare function pointInPolygon(point: Vec2, worldPoly: Vec2[]): boolean;
/** Cheap bounding-circle overlap — the pragmatic default hit test for vector games. */
export declare function circleHit(aPos: Vec2, aRadius: number, bPos: Vec2, bRadius: number): boolean;
/**
 * Generate an irregular asteroid-style silhouette as local-space vertices.
 * Generate ONCE at spawn, store on the entity, never per frame (it would shimmer).
 */
export declare function generatePolygon(baseRadius: number, vertexCount?: number, jaggedness?: number, rng?: () => number): Vec2[];
/** Signed angle from one heading to another, in radians (-PI..PI) — capped-turn steering. */
export declare function signedAngle(fromRad: number, toRad: number): number;
/** Intersection point of segment p1→p2 with segment p3→p4, or null if they don't cross within both spans. */
export declare function segmentIntersection(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2): Vec2 | null;
/** The earliest contact a swept point made: where, which segment, how far along the path (0..1). */
export interface SweepHit {
    point: Vec2;
    index: number;
    t: number;
}
/**
 * Sweep a moving point's path (prev → cur) against static wall segments and return
 * the EARLIEST contact, or null. The core anti-tunnel test for bodies vs line
 * geometry (terrain, cave walls).
 */
export declare function sweepVsSegments(prev: Vec2, cur: Vec2, segments: Segment[]): SweepHit | null;
/** Turn a terrain polyline (or any open path) into wall segments for `sweepVsSegments`. */
export declare function polylineSegments(points: Vec2[]): Segment[];
/** Tuning for `resolveSurface` — how a body bounces, scrubs, and settles on contact. */
export interface SurfaceResponse {
    /** 0 = no bounce (pure slide), 1 = full elastic bounce. Default 0. */
    restitution?: number;
    /** 0 = frictionless, 1 = grip (kills tangential speed on contact). Default 0. */
    friction?: number;
    /** Only bounce if the approach speed exceeds this — below it the body SETTLES. Default 0. */
    bounceThreshold?: number;
}
/**
 * The general surface-collision response. Splits the velocity into normal and
 * tangential parts against the outward unit `normal`: the normal part bounces
 * back scaled by `restitution`; the tangential part is scaled by (1 - `friction`).
 * `bounceThreshold` suppresses the bounce below a minimum approach speed so a
 * resting body settles instead of jittering.
 */
export declare function resolveSurface(vel: Vec2, normal: Vec2, opts?: SurfaceResponse): Vec2;
/**
 * Continuous ground friction for a grounded body — damps the velocity ALONG the
 * surface, scaled by how flat it is (≈ cos of the slope): full on flat ground,
 * less on a steep slope, none on a wall. Call each frame while grounded.
 */
export declare function surfaceFriction(vel: Vec2, normal: Vec2, coefficient: number, dt: number, gravityDir?: Vec2): Vec2;
/** A point gravity source (a star, a well) for `gravityAccel`. */
export interface GravitySource {
    x: number;
    y: number;
    mass: number;
}
/** Tuning for `gravityAccel`. */
export interface GravityOptions {
    /** Gravitational constant — scales how deep every well feels. Default 1. */
    G?: number;
    /** Softening floor on r² (> 0) so the pull never blows up at a well's centre. Default 1. */
    minR2?: number;
}
/**
 * The summed inverse-square gravitational acceleration on a body at `pos` from
 * all `sources` (softened — no singularity at the centre). Add it to the body's
 * accel before `integrateMotion`; apply to ships AND bullets so shots curve too.
 */
export declare function gravityAccel(pos: Vec2, sources: GravitySource[], opts?: GravityOptions): Vec2;
/** A bare point body for `integrateMotion`/`predictPath`. */
export interface Body {
    x: number;
    y: number;
    vx: number;
    vy: number;
}
/** Per-frame inputs to `integrateMotion`. */
export interface MotionOptions {
    /** Frame time in seconds. */
    delta: number;
    /** Summed acceleration this frame (thrust + any extra pulls). */
    accel?: Vec2;
    /** Optional constant gravity vector (added to accel). */
    gravity?: Vec2;
    /** Per-second linear drag coefficient (0/undefined = none). */
    drag?: number;
    /** Terminal-speed clamp (undefined = uncapped). */
    maxSpeed?: number;
}
/**
 * Advance a bare body one frame, in place — semi-implicit Euler (velocity before
 * position; stable under gravity and frame-rate independent) with a
 * terminal-speed clamp.
 */
export declare function integrateMotion(body: Body, opts: MotionOptions): void;
/**
 * Forward-simulate a body under an acceleration function, returning sampled
 * positions (steps + 1, starting at the current position) — aim arcs, shot
 * previews. Pass the SAME acceleration the physics uses so the prediction matches.
 */
export declare function predictPath(body: Body, accelFn: (state: Body) => Vec2, steps: number, dt: number, opts?: {
    maxSpeed?: number;
    drag?: number;
}): Vec2[];
/** Options for `generateTerrain` — a midpoint-displacement heightfield polyline. */
export interface HeightfieldOptions {
    /** Span on x — terrain runs 0..width. */
    width: number;
    /** Average ground height (screen y; larger = lower on screen). */
    baseY: number;
    /** Initial vertical displacement. Default `baseY * 0.4`. */
    amplitude?: number;
    /** 0..1: how much amplitude survives each subdivision. Default 0.5. */
    roughness?: number;
    /** Subdivision passes (more = finer detail, 2^iterations + 1 points). Default 6. */
    iterations?: number;
    /** Clamp ceiling — the highest the ground may rise. Default 0. */
    minY?: number;
    /** Clamp floor — the lowest the ground may sink. Default `baseY * 2`. */
    maxY?: number;
    /** Injectable RNG for deterministic terrain. Default `Math.random`. */
    rng?: () => number;
}
/**
 * Midpoint-displacement terrain as a polyline, sorted left-to-right and
 * single-valued in x — ready for `heightAtX` and `polylineSegments`. Generate
 * once per level; never per frame.
 */
export declare function generateTerrain(opts: HeightfieldOptions): Vec2[];
/**
 * Sample the y of a terrain polyline at world x, linearly interpolating between
 * the two vertices spanning x. Points must be sorted by x ascending. Returns
 * Infinity if x is outside the polyline (treat as: no ground here).
 */
export declare function heightAtX(polyline: Vec2[], x: number): number;
/**
 * Slope-limited horizontal step along a heightfield. Returns the ALLOWED x: `toX`
 * if the step's uphill slope is within `maxClimbSlope` (rise/run — ~1 is 45°),
 * otherwise `fromX` (refused). Downhill is always allowed.
 */
export declare function climbableX(terrain: Vec2[], fromX: number, toX: number, maxClimbSlope: number): number;
/**
 * Blow a crater into a heightfield polyline, in place — destructible terrain.
 * Lowers the surface within `radius` of (cx, cy) following a circular bowl, ONLY
 * ever pushing the ground down and clamping to `floorY`, so the surface stays
 * single-valued and `heightAtX` stays valid.
 */
export declare function craterHeightfield(polyline: Vec2[], cx: number, cy: number, radius: number, floorY: number): void;
/** One drifting line fragment of a shattered polygon. */
export interface Fragment {
    /** Segment endpoints relative to the fragment centre. */
    a: Vec2;
    b: Vec2;
    /** World position of the centre. */
    x: number;
    y: number;
    vx: number;
    vy: number;
    rot: number;
    vrot: number;
    life: number;
    maxLife: number;
}
/** Tuning for `shatterPolygon`. */
export interface ShatterOptions {
    /** Outward drift speed of the fragments (px/s). Default 60. */
    speed?: number;
    /** Fragment lifetime in seconds (alpha fades over it). Default 0.8. */
    life?: number;
    /** Max spin rate in rad/s (each fragment gets a random spin within ±spin/2). Default 2. */
    spin?: number;
}
/**
 * Break a WORLD-space polygon into line fragments that drift and spin apart.
 * Pass `transformVerts(entity.verts, pos, rot)` — never local vertices. Append
 * the result to a `Fragment[]` you own; advance with `updateFragments`, draw
 * with `drawFragments`.
 */
export declare function shatterPolygon(worldVerts: Vec2[], opts?: ShatterOptions): Fragment[];
/** Advance line fragments and return the survivors — reassign: `this.frags = updateFragments(this.frags, dt)`. */
export declare function updateFragments(frags: Fragment[], dt: number): Fragment[];
/**
 * Draw line fragments through the v2 Draw verbs (world space — they scroll with
 * the camera). REWRITTEN from the raster original: each fragment is one `d.line`
 * whose alpha fades with remaining life (was `ctx.globalAlpha` + `r.drawLine`).
 */
export declare function drawFragments(d: Draw, frags: Fragment[], color?: string, width?: number): void;
/**
 * Wrap a position back into `[0, width) × [0, height)` after integrating
 * movement. Mutates `position` in place. Call once per frame.
 */
export declare function wrapPosition(position: Vec2, width: number, height: number): void;
/**
 * Return every screen position at which a wrapping sprite should be drawn this
 * frame — the real position plus mirrors for each edge the sprite straddles
 * (corners yield the diagonal mirror too, so up to 4 positions).
 */
export declare function wrapPositions(position: Vec2, radius: number, width: number, height: number): Vec2[];
export { glyphOutline, textOutline, textWidth, VECTOR_CHARSET } from './vecfont.js';
export type { Glyph, VecTextOptions, VecTextAlign } from './vecfont.js';
export { arcPoints, arcSteps, ringSections, arcHit, generateTube } from './vecshapes.js';
export type { RingSection, RingSectionOptions, Tube, TubeOptions, TubeProfile, LanePose } from './vecshapes.js';
export { project, projectPoint, horizon, focalLength, wireBox, wireGrid, placeModel, placeModelOnGround, wireBounds } from './vecshapes.js';
export { convexHull, simplifyHull, hullFor, convexPieces, isConvex, triangulate, MAX_HULL_POINTS } from './vecshapes.js';
export type { Vec3, WireModel, WireCamera, WireView, WireEdge, WireBounds } from './vecshapes.js';

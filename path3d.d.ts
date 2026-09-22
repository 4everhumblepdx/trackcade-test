// Docs: engine/webgpu/world3d.md — usage, recipes & traps (this file = exact type signatures)
export interface Path3dOptions {
    /** Join the last point back to the first (loops: coasters, patrols). */
    closed?: boolean;
    /** Samples baked per segment (default 24; more = smoother frames). */
    samplesPerSegment?: number;
}
export interface PathFrame {
    x: number;
    y: number;
    z: number;
    /** Unit tangent — the travel direction. */
    tx: number;
    ty: number;
    tz: number;
    /** Parallel-transported unit normal (no roll flips around loops). */
    nx: number;
    ny: number;
    nz: number;
    /** Binormal = tangent × normal. */
    bx: number;
    by: number;
    bz: number;
}
type P3 = {
    x: number;
    y: number;
    z: number;
};
/** CENTRIPETAL Catmull-Rom on one segment (p0..p3 window, u 0..1 across
 * p1→p2) — Barry–Goldman with sqrt-chord knots. Centripetal is the game
 * choice: uniform CR OVERSHOOTS wildly when control points are unevenly
 * spaced (a 1-unit hop next to a 99-unit run loops back on itself);
 * centripetal never self-intersects within a segment. */
export declare function catmullRom3(p0: number[], p1: number[], p2: number[], p3: number[], u: number): [number, number, number];
export declare class Path3d {
    /** Total arc length (world units). */
    readonly length: number;
    readonly closed: boolean;
    private px;
    private py;
    private pz;
    private tx;
    private ty;
    private tz;
    private nx;
    private ny;
    private nz;
    private cum;
    private n;
    constructor(points: Array<[number, number, number]> | P3[], opts?: Path3dOptions);
    /** Sample index + blend for an arc-length fraction (binary search). */
    private locate;
    /** Position at arc-length fraction t (0..1; closed paths wrap). */
    at(t: number): P3;
    /** Position at a distance in world units along the path. */
    atDist(d: number): P3;
    /** Full frame at t: position + tangent + parallel-transported normal +
     * binormal (all unit) — orient a cart, bank a camera, place a rail tie. */
    frame(t: number): PathFrame;
    /** n points evenly spaced by ARC LENGTH — feed world.tube({ path }) or a
     * vector polyline directly. Closed paths omit the duplicate end point. */
    points(count: number): Array<[number, number, number]>;
}
export declare class DynamicPath3d {
    /** Samples per baked segment (fixed at construction). */
    private per;
    private pts;
    private ptsBase;
    private bakedSegs;
    private sx;
    private sy;
    private sz;
    private stx;
    private sty;
    private stz;
    private snx;
    private sny;
    private snz;
    private cum;
    constructor(opts?: {
        samplesPerSegment?: number;
    });
    /** Distance at the START of the ridable window (advances with trim()). */
    get start(): number;
    /** Distance at the END of the ridable window (grows with add()). Keep
     * adding while `head - riderDist` shrinks — the rider must never catch
     * the head. 0 until three waypoints exist. */
    get head(): number;
    /** Ridable yet? (needs 3 waypoints for the first baked segment). */
    get ready(): boolean;
    /** Append a waypoint AHEAD. Bakes every segment that just became stable
     * and drops control points the baker no longer needs. */
    add(x: number | {
        x: number;
        y: number;
        z: number;
    }, y?: number, z?: number): void;
    private bakeSeg;
    /** Drop everything WHOLLY behind distance d (keeps the bracketing sample
     * so frameAt(d) still interpolates). Distances stay absolute. */
    trim(d: number): void;
    private locate;
    /** Position at ABSOLUTE distance d (clamped to [start, head]). */
    at(d: number): {
        x: number;
        y: number;
        z: number;
    };
    /** Full frame at ABSOLUTE distance d — same contract as Path3d.frame. */
    frameAt(d: number): PathFrame;
    /** n points between two absolute distances — draw the plotted route. */
    pointsBetween(d0: number, d1: number, n: number): Array<[number, number, number]>;
}
export {};

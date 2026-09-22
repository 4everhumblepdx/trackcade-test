export interface Vec {
    x: number;
    y: number;
}
/** A marble: colour + its arc-length position `s` along the path. `id` is stable. */
export interface Marble {
    id: number;
    color: number;
    s: number;
}
/** The path as arc-length sampling: total length + point at distance s. */
export interface PathSampler {
    length: number;
    point(s: number): Vec;
}
export interface RailConfig {
    path: PathSampler;
    seed?: number;
    colors?: number;
    /** Marble spacing along the path (arc-length units). Default 22. */
    spacing?: number;
    /** Total marbles the spawner will feed. Default 60. */
    feedCount?: number;
    /** How far the chain advances per `advance(1)` unit. Default 1. */
    speed?: number;
}
export interface InsertResult {
    insertedId: number;
    pops: {
        id: number;
        color: number;
        s: number;
    }[];
    /** Rejoin chain reactions after the gap closed. */
    rejoinPops: {
        id: number;
        color: number;
        s: number;
    }[][];
    gained: number;
}
export interface AdvanceResult {
    reachedEnd: boolean;
    /** The frontmost marble's arc-length (distance to the skull = length - this). */
    frontS: number;
}
export declare function createRail(cfg: RailConfig): Rail;
export declare class Rail {
    readonly path: PathSampler;
    readonly colors: number;
    readonly spacing: number;
    score: number;
    /** Ordered marbles, front (largest s, nearest the skull) first. */
    chain: Marble[];
    private rng;
    private nextId;
    private feedLeft;
    private speed;
    constructor(cfg: RailConfig);
    /** World position of a marble. */
    posOf(m: Marble): Vec;
    get frontS(): number;
    /** Colours still present in the chain (shooter draws from these). */
    liveColors(): number[];
    /** Push the whole chain forward; feed new marbles at the back while feed remains. */
    advance(dist?: number): AdvanceResult;
    /** Find the insertion index nearest arc-length `s` (where a shot wedges in). */
    insertionIndexAt(s: number): number;
    /** Insert a marble of `color` at arc-length `s`; resolve matches + rejoin combos. */
    insert(s: number, color: number): InsertResult;
    private resort;
    /** Pop the contiguous same-colour run around a marble id if length ≥3. */
    private popAround;
    /** After a pop, the rear segment rolls forward to close the gap; if the joining
     * ends form 3+ of a colour, they auto-pop (the combo). Returns popped, or []. */
    private closeGapAndCheck;
    get won(): boolean;
    /** For a target colour, the arc-length that would pop the most (autoplay/AI). */
    findShots(): {
        s: number;
        color: number;
        pops: number;
    }[];
    /** Auto-play: fire best shots while advancing; returns inserts made. */
    autoplay(maxShots?: number): InsertResult[];
    debugChain(): string;
}
/** A simple straight-line path sampler (handy for tests/examples without Track). */
export declare function linePath(from: Vec, to: Vec): PathSampler;
/** A sampled polyline path (approximate arc-length). */
export declare function polyPath(points: Vec[]): PathSampler;

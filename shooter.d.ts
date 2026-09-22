export interface XY {
    x: number;
    y: number;
}
/** A world-space point (for the aim ray / flight path). */
export interface Vec {
    x: number;
    y: number;
}
export interface ShooterConfig {
    cols: number;
    rows: number;
    seed?: number;
    colors?: number;
    /** Radius of a bubble in world units (grid geometry derives from this). Default 16. */
    radius?: number;
    /** Pre-fill this many top rows with bubbles. Default 5. */
    fillRows?: number;
    /** Ceiling steps down one row after this many shots. 0 disables. Default 0. */
    ceilingEveryShots?: number;
}
export interface ShotResult {
    /** World-space flight path (launcher → snap centre), reflecting off walls. */
    path: Vec[];
    snap: XY | null;
    pops: XY[];
    drops: XY[];
    ceilingStepped: boolean;
    topOut: boolean;
    won: boolean;
    gained: number;
}
export declare function createBubbleField(cfg: ShooterConfig): BubbleField;
export declare class BubbleField {
    readonly cols: number;
    readonly rows: number;
    readonly colors: number;
    readonly radius: number;
    score: number;
    shots: number;
    topOut: boolean;
    private grid;
    private rng;
    private ceilingEvery;
    private ceilingRow;
    constructor(cfg: ShooterConfig);
    private idx;
    /** Odd rows are offset and hold one fewer bubble. */
    private rowWidth;
    private inBounds;
    bubble(x: number, y: number): number | null;
    /** World-space centre of a grid cell. Odd rows shift right by half a bubble. */
    centre(x: number, y: number): Vec;
    /** Field width/height in world units. */
    get width(): number;
    get height(): number;
    /** Hex neighbours of (x,y) — 6-way, offset-aware. */
    private neighbours;
    /** Colours still present on the field (shots draw only from these). */
    liveColors(): number[];
    /** Nearest empty cell to a world point that is adjacent to an existing bubble
     * or the ceiling — the snap target. */
    private snapCell;
    /** Trace the shot from the launcher (bottom centre) at `angle` (radians, 0 = up,
     * +ve = clockwise), reflecting off side walls, until it hits a bubble or the ceiling. */
    aim(angle: number, launcher?: Vec): {
        path: Vec[];
        hit: XY | null;
    };
    /** Fire a bubble of `color` (or a live colour) at `angle`. Full resolution. */
    shoot(angle: number, color?: number): ShotResult;
    private floodColor;
    /** Drop every bubble not connected to the top row (ceiling). Returns dropped cells. */
    private dropOrphans;
    private stepCeiling;
    private bottomReached;
    get won(): boolean;
    /** Candidate shots scored by pops + drops (drops dominate — the AI surface). */
    findShots(samples?: number): {
        angle: number;
        pops: number;
        drops: number;
        score: number;
    }[];
    private simulateShot;
    /** Auto-play best-shot until cleared or stuck. */
    autoplay(maxShots?: number): ShotResult[];
    debugGrid(): string;
}

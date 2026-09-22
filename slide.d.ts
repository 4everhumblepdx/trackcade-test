export type Dir = 'up' | 'down' | 'left' | 'right';
export interface XY {
    x: number;
    y: number;
}
/** A live tile. `value` is the number shown; `id` is stable for animation. */
export interface Tile {
    id: number;
    value: number;
    x: number;
    y: number;
}
/** Per-move tile movement (for the presenter). */
export interface TileMove {
    id: number;
    from: XY;
    to: XY;
}
/** A merge that happened this move. `into` survives; `gone` is removed after sliding. */
export interface TileMerge {
    intoId: number;
    goneId: number;
    at: XY;
    value: number;
}
export interface SlideResult {
    valid: boolean;
    moves: TileMove[];
    merges: TileMerge[];
    spawn: {
        id: number;
        value: number;
        at: XY;
    } | null;
    gained: number;
    gameOver: boolean;
    won: boolean;
}
export interface SpawnPolicy {
    /** `anyEmpty` (2048) or `oppositeEdge` (Threes — only lanes that shifted). */
    where: 'anyEmpty' | 'oppositeEdge';
    /** `weighted` (value→weight table) or `bag` (shuffled multiset, refilled). */
    table: 'weighted' | 'bag';
    /** For `weighted`: [value, weight] pairs. For `bag`: the multiset values. */
    values: [number, number][] | number[];
    /** Show the next tile before it spawns (Threes). */
    preview?: boolean;
}
export interface SlideConfig {
    cols: number;
    rows: number;
    seed?: number;
    /** `full` slides tiles as far as possible (2048); `one` moves one cell (Threes). */
    step: 'full' | 'one';
    /** Merge predicate → the resulting value, or null for no merge. Default: equal→sum. */
    canMerge?: (a: number, b: number) => number | null;
    spawn: SpawnPolicy;
    /** Tiles spawned at game start. Default 2. */
    startTiles?: number;
    /** Reaching this value flags `won` (play continues). Default 2048; 0 disables. */
    winValue?: number;
}
/** 2048: slide all the way, equal tiles sum, spawn 2 (90%) / 4 (10%) anywhere. */
export declare function config2048(over?: Partial<SlideConfig>): SlideConfig;
/** Threes: one-step slide, 1+2=3 then equal-doubles, spawn on the swiped-from edge. */
export declare function configThrees(over?: Partial<SlideConfig>): SlideConfig;
export declare function createSlide(cfg: SlideConfig): Slide;
export declare class Slide {
    readonly cols: number;
    readonly rows: number;
    score: number;
    moveCount: number;
    won: boolean;
    private cfg;
    private grid;
    private rng;
    private nextId;
    private bag;
    private nextValue;
    constructor(cfg: SlideConfig);
    private idx;
    tile(x: number, y: number): Tile | null;
    /** All live tiles. */
    tiles(): Tile[];
    /** The previewed next value (Threes), or null. */
    peek(): number | null;
    private merge;
    private drawValue;
    private spawnTile;
    private oppositeEdgeCells;
    /** Lane cells ordered from the destination wall inward (for the given move dir). */
    private laneCells;
    private laneCount;
    move(dir: Dir): SlideResult;
    private resolveOneStep;
    private isGameOver;
    /** Directions that would change the board. */
    legalMoves(): Dir[];
    private wouldChange;
    private serialize;
    private restore;
    /** Auto-play by a simple corner-stacking policy. */
    autoplay(maxMoves?: number): SlideResult[];
    debugGrid(): string;
}

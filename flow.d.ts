export interface XY {
    x: number;
    y: number;
}
export declare const UP = 1, RIGHT = 2, DOWN = 4, LEFT = 8;
export interface Tile {
    /** 4-bit edge mask of connection stubs. */
    mask: number;
    kind?: 'source' | 'drain' | 'normal';
    /** Netwalk: locked against accidental rotation. */
    locked?: boolean;
}
export interface FlowConfig {
    cols: number;
    rows: number;
    seed?: number;
    /** Toroidal wrap for adjacency. Default false. */
    wrap?: boolean;
}
export declare function createFlowGrid(cfg: FlowConfig): FlowGrid;
export declare class FlowGrid {
    readonly cols: number;
    readonly rows: number;
    private wrap;
    private tiles;
    private server;
    private rng;
    queue: number[];
    private flowHead;
    private filled;
    filledDist: number;
    private solvedMask;
    constructor(cfg: FlowConfig);
    private idx;
    private inBounds;
    private neighbour;
    tile(x: number, y: number): Tile;
    setTile(x: number, y: number, t: Tile): void;
    get serverPos(): XY | null;
    /** Rotate a tile (Netwalk). +1 = clockwise. Ignored if locked. */
    rotate(x: number, y: number, steps?: number): void;
    /** Toggle a tile's lock (misclick guard). */
    lock(x: number, y: number, on: boolean): void;
    /** Cells connected to the server via mutually-matching stubs (the lit network). */
    connectivity(): {
        lit: boolean[];
        litCount: number;
    };
    /** Solved (Netwalk) when every tile with any stub is lit and no dangling stubs
     * point at walls or unmatched neighbours. */
    get solved(): boolean;
    /** Generate a solvable Netwalk: carve a random spanning tree from the server,
     * set edge masks, then scramble rotations. Always solvable. */
    generateNet(): void;
    /** Rotation steps per cell that solve the generated Netwalk (autoplay/hints).
     * Uses the solved orientation recorded at generation time. Null if not generated. */
    solveNet(): number[][] | null;
    /** Seed a Pipe Mania game: a forced queue of pipe masks and a start tile. */
    startPipes(queue: number[], start: XY, fromDir: number): void;
    /** Place the next queued pipe at an empty cell. Returns false if occupied/filled. */
    placePipe(x: number, y: number): boolean;
    /** Advance the fluid one pipe segment. Returns the outcome. */
    advanceFlow(): {
        entered: XY | null;
        spilled: boolean;
        dist: number;
    };
    isFilled(x: number, y: number): boolean;
    debugMasks(): string;
}

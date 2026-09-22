export interface XY {
    x: number;
    y: number;
}
export type NonoMark = 'unknown' | 'fill' | 'cross';
export interface NonogramConfig {
    cols: number;
    rows: number;
    seed?: number;
    /** Fill probability for generated solutions. Default 0.55. */
    density?: number;
    /** An explicit solution instead of generating one. */
    solution?: boolean[][];
}
/** Run-length clues for one line, e.g. [3,1] = a run of 3 then a run of 1. */
export type Clue = number[];
export declare function createNonogram(cfg: NonogramConfig): Nonogram;
export declare class Nonogram {
    readonly cols: number;
    readonly rows: number;
    rowClues: Clue[];
    colClues: Clue[];
    private solution;
    private marks;
    constructor(cfg: NonogramConfig);
    /** Generate a solution whose clues are solvable by the line-solver alone. */
    private generateSolvable;
    /** Iterated line-solver: does constraint propagation alone reach the solution? */
    private lineSolvable;
    /** Constrain one line by intersecting all clue placements; returns true if it changed. */
    private solveLine;
    /** Player marks a cell. */
    set(x: number, y: number, mark: NonoMark): void;
    mark(x: number, y: number): NonoMark;
    /** Is a row/column's clue currently satisfied by the fills (drives clue dimming)? */
    lineSatisfied(axis: 'row' | 'col', i: number): boolean;
    /** Solved = every clue satisfied (allows alternate solutions). */
    get solved(): boolean;
    /** The reference solution (for auto-solve demos / checking). */
    solutionAt(x: number, y: number): boolean;
    /** Auto-solve one forced deduction; returns cells it filled/crossed, or []. */
    solveStep(): {
        at: XY;
        mark: NonoMark;
    }[];
}
export interface LightsOutConfig {
    cols: number;
    rows: number;
    seed?: number;
    /** Toggle footprint. Default the plus/cross (self + 4 orthogonal). */
    stamp?: 'cross' | '3x3' | XY[];
    /** Random presses used to scramble from all-off (guarantees solvability). Default cols*rows. */
    scrambles?: number;
    /** Toroidal wrap for the stamp. Default false. */
    wrap?: boolean;
}
export declare function createLightsOut(cfg: LightsOutConfig): LightsOut;
export declare class LightsOut {
    readonly cols: number;
    readonly rows: number;
    private on;
    private stampCells;
    private wrap;
    moves: number;
    constructor(cfg: LightsOutConfig);
    private idx;
    light(x: number, y: number): boolean;
    private applyStamp;
    /** Press a cell; returns the toggled cells for the presenter. */
    press(x: number, y: number): XY[];
    get solved(): boolean;
    get litCount(): number;
    /** Minimal press-set that solves the current board, via GF(2) elimination. */
    solution(): XY[];
}
export interface FloodConfig {
    cols: number;
    rows: number;
    colors?: number;
    seed?: number;
    /** Max moves to win. Default: calibrated from the greedy bot + slack. */
    moveLimit?: number;
    /** Flood origin. Default top-left. */
    origin?: XY;
}
export declare function createFlood(cfg: FloodConfig): Flood;
export declare class Flood {
    readonly cols: number;
    readonly rows: number;
    readonly colors: number;
    readonly origin: XY;
    moveLimit: number;
    moves: number;
    private grid;
    private region;
    private rng;
    constructor(cfg: FloodConfig);
    private idx;
    colorAt(x: number, y: number): number;
    inRegion(x: number, y: number): boolean;
    get currentColor(): number;
    private recomputeRegion;
    /** How many new cells picking `color` would absorb (the strategy assist). */
    preview(color: number): number;
    private countConnectedOfColor;
    /** Recolour the region to `color` and absorb newly-adjacent same-colour cells. */
    pick(color: number): {
        color: number;
        absorbed: XY[];
        won: boolean;
        movesLeft: number;
    };
    get won(): boolean;
    get lost(): boolean;
    /** Every colour choice sorted by cells gained (greedy autoplay/hints). */
    findMoves(): {
        color: number;
        gain: number;
    }[];
    /** Greedy solve (a copy) to calibrate a fair move limit. */
    private calibrateLimit;
}

export interface XY {
    x: number;
    y: number;
}
/** A tray piece shape: cells relative to (0,0), plus a deal weight. */
export interface PieceDef {
    cells: XY[];
    /** Relative deal frequency. Default 1. */
    weight?: number;
    /** Optional label carried onto placed cells and journal events. */
    tag?: string;
}
/** A clearable region: a named set of cells that vanishes when all are filled. */
export interface RegionDef {
    id: string;
    cells: XY[];
}
/** A live tray piece. */
export interface Piece {
    id: number;
    cells: XY[];
    tag?: string;
}
/** One placed board cell. */
export interface PlacedCell {
    /** Piece-instance id that filled it (for colour/theming). */
    fill: number;
    tag?: string;
}
export type PlacerStep = {
    type: 'place';
    pieceId: number;
    cells: XY[];
    fill: number;
} | {
    type: 'regionClear';
    regions: string[];
    cells: XY[];
} | {
    type: 'trayRefill';
    pieces: {
        id: number;
        cells: XY[];
    }[];
} | {
    type: 'gameOver';
};
export interface PlaceResult {
    valid: boolean;
    steps: PlacerStep[];
    /** Regions cleared this placement (combo size). */
    combo: number;
    /** Consecutive clearing placements including this one (0 if this cleared nothing). */
    streak: number;
    gained: number;
    gameOver: boolean;
}
/** A legal placement found by `findPlacements`. */
export interface Placement {
    pieceId: number;
    at: XY;
    /** Regions this placement would complete. */
    clears: number;
    /** Heuristic value, higher = better. */
    value: number;
}
export interface PlacerConfig {
    cols: number;
    rows: number;
    seed?: number;
    /** Extra clearable regions beyond the default rows+columns (e.g. sudoku boxes). */
    regions?: RegionDef[];
    /** The deal pool. Default: the 1010! set. */
    pieces?: PieceDef[];
    /** Pieces per tray. Default 3. */
    traySize?: number;
    /** Allow rotating tray pieces 90° (`board.rotatePiece`). Off in the classic
     * games (1010!/Block Blast/Woodoku place pieces as dealt); opt in for a variant. */
    rotate?: boolean;
    /** Adaptive/weighted piece generation hook (Block Blast style). Given board
     * fill ratio 0..1, return the pool to draw from. Default: the static pool. */
    pieceFilter?: (fillRatio: number, pool: PieceDef[]) => PieceDef[];
    /** Score a completed-regions batch. Default: Block-Blast-like steep multi curve. */
    scorer?: (ev: {
        cellsPlaced: number;
        regions: number;
        streak: number;
    }) => number;
}
/** The canonical 1010! piece set: lines 1–5, squares, L/T/S shapes. */
export declare const PIECES_1010: PieceDef[];
/** Tetromino set (Block Blast leans on these), no rotation in tray games. */
export declare const PIECES_BLOCKS: PieceDef[];
/** Build the nine 3×3 sudoku-box regions for a 9×9 board (Woodoku/Blockudoku). */
export declare function sudokuBoxes(): RegionDef[];
export declare function createPlacer(cfg: PlacerConfig): Placer;
export declare class Placer {
    readonly cols: number;
    readonly rows: number;
    tray: Piece[];
    score: number;
    placements: number;
    gameOver: boolean;
    /** Current clearing streak (consecutive placements that cleared ≥1 region). */
    streak: number;
    private cfg;
    private grid;
    private regions;
    private pool;
    private rng;
    private nextId;
    private trayCells;
    constructor(cfg: PlacerConfig);
    private idx;
    private inBounds;
    /** The placed cell at (x,y), or null. */
    cell(x: number, y: number): PlacedCell | null;
    private fillRatio;
    private refillTray;
    /** Can `pieceId` be placed with its origin at `at`? */
    canPlace(pieceId: number, at: XY): boolean;
    /** Rotate a tray piece 90° in place (`dir` 1 = CW, -1 = CCW). No-op unless
     * `rotate` is configured. Cells are re-normalised to a (0,0) origin. */
    rotatePiece(pieceId: number, dir?: 1 | -1): void;
    /** Does ANY tray piece fit ANYWHERE? (the mid-tray game-over test). */
    private anyMoveExists;
    /** Place a tray piece; commit, clear completed regions, refill when empty. */
    place(pieceId: number, at: XY): PlaceResult;
    private defaultScore;
    /** Every legal placement of every tray piece (or one piece), scored, best first. */
    findPlacements(pieceId?: number): Placement[];
    private wouldClear;
    /** Auto-play by a policy until game over; returns each result. */
    autoplay(maxPlacements?: number): PlaceResult[];
    /** Rows of `#`/`.` — handy in tests. */
    debugGrid(): string;
}

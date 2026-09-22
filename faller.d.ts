export interface XY {
    x: number;
    y: number;
}
/** A cell in the well: colour index, or -1 empty. `virus` marks Dr. Mario targets. */
export interface Cell {
    color: number;
    virus?: boolean;
}
export type RotationSystem = 'srs' | 'cycle' | 'orbit' | 'none';
export type MatchRule = 'rows' | {
    lines: number;
    diagonals?: boolean;
} | {
    flood: number;
};
export interface PieceDef {
    /** Cells relative to the piece origin, per rotation state 0..3. */
    states: XY[][];
    /** One colour per cell index (Columns/Puyo/Dr.Mario), or a single colour. */
    colors?: number[];
}
export interface WellConfig {
    cols: number;
    rows: number;
    seed?: number;
    colors?: number;
    /** Piece set. Default tetrominoes. */
    pieces?: 'tetromino' | 'columns' | 'puyo' | 'capsule' | PieceDef[];
    rotation?: RotationSystem;
    match?: MatchRule;
    /** `perCell` (Columns/Puyo — cells fall independently after lock) or
     * `perObject` (Dr. Mario — capsule halves stay rigid until a partner clears). */
    gravity?: 'perCell' | 'perObject';
    /** Cells fallen per gravity tick. Default 1. */
    /** Ticks a piece rests before locking. Default 2. */
    lockDelayTicks?: number;
    /** Max lock-delay resets from moves/rotations before a forced lock (anti-stall). */
    lockResetCap?: number;
    /** Pre-seed viruses (Dr. Mario). Count is 4×(level+1) capped at 84. */
    viruses?: number;
    hiddenRows?: number;
}
export interface ActivePiece {
    kind: string;
    state: number;
    x: number;
    y: number;
    cells: XY[];
    colors: number[];
}
export type FallerStep = {
    type: 'spawn';
    piece: ActivePiece;
} | {
    type: 'move';
    dx: number;
    dy: number;
} | {
    type: 'rotate';
    state: number;
    kicked: boolean;
} | {
    type: 'lock';
    cells: {
        at: XY;
        color: number;
    }[];
    tspin?: 'none' | 'mini' | 'full';
} | {
    type: 'match';
    groups: {
        cells: XY[];
        color: number;
    }[];
    chain: number;
} | {
    type: 'clear';
    cells: XY[];
    lines?: number;
} | {
    type: 'fall';
    moves: {
        from: XY;
        to: XY;
    }[];
} | {
    type: 'gameOver';
};
export interface TickResult {
    steps: FallerStep[];
    /** Rows/groups cleared this tick. */
    cleared: number;
    /** Cascade depth reached (Puyo chain). */
    chain: number;
    gained: number;
    gameOver: boolean;
    /** True when a new piece locked this tick. */
    locked: boolean;
}
export declare function createWell(cfg: WellConfig): Well;
export declare class Well {
    readonly cols: number;
    readonly rows: number;
    readonly hiddenRows: number;
    score: number;
    level: number;
    lines: number;
    active: ActivePiece | null;
    hold: string | null;
    gameOver: boolean;
    private cfg;
    private grid;
    private rng;
    private pieces;
    private order;
    private bag;
    private nextQueue;
    private rotation;
    private match;
    private lockTimer;
    private lockResets;
    private resting;
    private lastWasRotate;
    private lastKick;
    private holdUsed;
    constructor(cfg: WellConfig);
    private totalRows;
    private idx;
    private inBounds;
    /** Cell at play coordinates (y=0 is the top visible row). */
    cell(x: number, y: number): Cell | null;
    private gcell;
    private buildPieces;
    private drawKind;
    private placeViruses;
    private pieceColors;
    private spawn;
    private absCells;
    private collides;
    /** Shift the active piece; returns whether it moved (resets lock delay). */
    shift(dir: -1 | 1): boolean;
    /** Rotate the active piece with kicks; returns whether it rotated. */
    rotate(dir: -1 | 1): boolean;
    private kicksFor;
    private onSuccessfulManeuver;
    /** Soft-drop one row (or hard drop). Returns cells fallen. */
    softDrop(): boolean;
    hardDrop(): TickResult;
    /** Hold the active piece (one swap until next lock). */
    holdPiece(): boolean;
    /** The ghost-piece landing cells (hard-drop projection). */
    ghost(): XY[];
    /** One gravity tick: advance the piece, handle lock delay, then resolve on lock. */
    tick(): TickResult;
    private lockAndResolve;
    private viewPiece;
    /** Per-cell gravity: every unsupported cell falls (Columns/Puyo). Returns moves. */
    private settleCells;
    private findMatches;
    private floodMatches;
    private detectTspin;
    private scoreClear;
    private emptyTick;
    /** Remaining viruses (Dr. Mario win = 0). */
    get virusCount(): number;
    /** The upcoming pieces. */
    next(): string[];
    /** Every reachable final placement (x, rotation), scored — the AI/autoplay surface. */
    findPlacements(): {
        x: number;
        state: number;
        score: number;
    }[];
    /** Drive the active piece to a chosen placement and hard-drop it. */
    place(x: number, state: number): TickResult;
    /** Auto-play by a simple flat-stacking policy until game over. */
    autoplay(maxPieces?: number): TickResult[];
    debugGrid(): string;
}

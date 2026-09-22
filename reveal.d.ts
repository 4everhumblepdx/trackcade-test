export interface XY {
    x: number;
    y: number;
}
export type CellState = 'hidden' | 'flagged' | 'question' | 'revealed';
export interface CellView {
    state: CellState;
    /** Adjacent mine count (0–8). Meaningful once revealed. */
    number: number;
    /** True only after game end (loss reveals all). */
    mine?: boolean;
}
/** A distance-ordered flood: `waves[0]` is the clicked cell, `waves[n]` are cells
 * n steps away — the presenter animates them as an expanding ripple. */
export interface RevealResult {
    waves: {
        cells: {
            at: XY;
            number: number;
        }[];
    }[];
    detonated: XY | null;
    state: 'playing' | 'won' | 'lost';
    /** All mines + wrong flags, populated on loss for the reveal-everything render. */
    reveal?: {
        mines: XY[];
        wrongFlags: XY[];
    };
}
export interface MinefieldConfig {
    cols: number;
    rows: number;
    mines: number;
    seed?: number;
    /** `cell` = first click is never a mine; `area` = its 3×3 is mine-free (modern default). */
    firstClickSafe?: 'cell' | 'area';
}
export declare function createMinefield(cfg: MinefieldConfig): Minefield;
export declare class Minefield {
    readonly cols: number;
    readonly rows: number;
    readonly mines: number;
    state: 'playing' | 'won' | 'lost';
    private cfg;
    private mine;
    private number;
    private cellState;
    private placed;
    private rng;
    private revealedCount;
    constructor(cfg: MinefieldConfig);
    private idx;
    private inBounds;
    private neighbours;
    /** The player-visible view of a cell. */
    cell(x: number, y: number): CellView;
    /** Mines minus flags placed (may go negative). */
    get minesLeft(): number;
    private placeMines;
    /** Reveal a cell. First reveal places mines (excluding the safe zone). */
    reveal(x: number, y: number): RevealResult;
    /** Distance-ordered BFS flood from the given seeds; zero-cells open neighbours. */
    private floodReveal;
    /** Flag → question → hidden cycle. Flags block reveal. */
    flag(x: number, y: number): void;
    /** Chord: on a revealed number whose adjacent flags equal it, reveal the rest.
     * A wrong flag here detonates. */
    chord(x: number, y: number): RevealResult;
    private win;
    private lose;
    /** A provably-safe hidden cell derived from revealed numbers, or null.
     * Two rules: a satisfied number's other neighbours are safe; a number whose
     * hidden-neighbour count equals its value means all those hidden are mines. */
    hint(): {
        safe: XY[];
        mines: XY[];
    };
    /** Auto-solve as far as pure deduction allows (for tests / no-guess play).
     * Returns false when stuck (needs a guess) or finished. */
    step(): boolean;
    debugGrid(): string;
}

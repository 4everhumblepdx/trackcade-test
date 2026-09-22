import type { Action, Block, BlockInit, BoardConfig, Cell, CellLayer, GoalState, MoveResult, OverlayEntry, PredictedMove, XY } from './types.js';
/** Options for {@link Board.autoplay}. */
export interface AutoplayOptions {
    /** Move policy. Default `'best'`. A function receives the sorted move list. */
    policy?: 'best' | 'random' | 'worst' | ((moves: PredictedMove[], board: Board) => PredictedMove);
    /** Stop after this many moves. Default 100. */
    maxMoves?: number;
    /** Called after each move with its result. */
    onMove?: (result: MoveResult, move: PredictedMove) => void;
}
/** Create a board. See {@link BoardConfig} for every option. */
export declare function createBoard(cfg: BoardConfig): Board;
export declare class Board {
    readonly cols: number;
    readonly rows: number;
    readonly preset: 'match3' | 'collapse' | 'chain';
    readonly colors: number;
    /** Cumulative score. */
    score: number;
    /** Valid moves made so far. */
    moveCount: number;
    /** Remaining move budget when `moveLimit` was configured, else `Infinity`. */
    movesLeft: number;
    /** Live goal counters (empty when no goals configured). */
    goals: GoalState[];
    private cfg;
    private cells;
    private grid;
    private overlays;
    private rng;
    private nextId;
    private presenting;
    constructor(cfg: BoardConfig);
    private idx;
    private pos;
    private inBounds;
    /** The cell at (x, y). Mutating it mutates the board's substrate. */
    cell(x: number, y: number): Cell;
    /** The block at (x, y), or null. */
    block(x: number, y: number): Block | null;
    /** The overlay at (x, y), or null. */
    overlay(x: number, y: number): OverlayEntry | null;
    /** Place (or clear, with null) a block during level setup. */
    setBlock(x: number, y: number, init: BlockInit | null): Block | null;
    /** Attach an overlay (chain/vine/cage…) during level setup. */
    setOverlay(x: number, y: number, entry: OverlayEntry | null): void;
    /** Add a damageable cell layer (jelly…) during level setup. */
    addLayer(x: number, y: number, layer: CellLayer): void;
    /** Visit every cell. */
    forEach(fn: (x: number, y: number, cell: Cell, block: Block | null, overlay: OverlayEntry | null) => void): void;
    /** Rows of colour digits (`.` empty, `#` blocked, `~` conduit, `*` colourless) — handy in tests. */
    debugGrid(): string;
    private parseLayout;
    private makeBlock;
    /** Match keys encode colour + tier so merge-mode blocks only match equals. */
    private static decode;
    private mergeStyle;
    private snapshot;
    private refillMode;
    /** One deal/refill block init: from the weighted `spawnTable` when present,
     * else a plain colour from `spawnWeights`. */
    private spawnInit;
    private restable;
    private deal;
    /** A dealt block that (match3 preset) avoids completing a run with placed neighbours. */
    private dealInit;
    private scanView;
    private findGroups;
    /** Swap two adjacent blocks. Instant full resolution; play back `result.steps`. */
    swap(a: XY, b: XY): MoveResult;
    /** Rotate the 2×2 block whose top-left is `at`, 'cw' or 'ccw' (Bejeweled Twist).
     * Reverts if it makes no match, unless `operatorFreeMove`. */
    rotate(at: XY, dir?: 'cw' | 'ccw'): MoveResult;
    /** Slide a whole row by `by` cells with wraparound (Chuzzle / 10000000). */
    shiftRow(row: number, by: number): MoveResult;
    /** Slide a whole column by `by` cells with wraparound. */
    shiftColumn(col: number, by: number): MoveResult;
    private shiftLine;
    /** Tap a cell: collapse preset clears the flood group; a tapped special fires. */
    tap(at: XY): MoveResult;
    /**
     * Chain preset: validate a drawn path without playing it. A path is valid when
     * every cell holds a matchable block of ONE colour(+tier), consecutive cells
     * are adjacent (see `chain.adjacency`), no cell repeats — except that the
     * FINAL cell may revisit an earlier one, closing a `loop` — and the unique
     * length reaches `chain.minLength`. Use per-step while the player drags.
     */
    pathAt(cells: XY[]): {
        valid: boolean;
        loop: boolean;
        color: number;
        cells: XY[];
    };
    /** Chain preset: commit a drawn path. A closed loop clears EVERY block of the
     * path's colour (when `chain.loopClearsColor` isn't false). */
    playPath(cells: XY[]): MoveResult;
    /** Apply an inventory power-up / tool action. Cascades follow; does not consume a move. */
    applyAction(action: Action): MoveResult;
    /** Run the turn systems (conveyors, spreaders, bomb fuses) manually when `autoTick: false`. */
    endTurn(): MoveResult;
    private actionAnchor;
    private swappable;
    private newCtx;
    private mark;
    private resolveCascades;
    private buildMatchEvent;
    private groupNeighbours;
    /** The shape → special table (match3), or the group-size thresholds (collapse/chain). */
    private specialFor;
    private applyHits;
    private clearBlocksNow;
    private detonate;
    private actionForSpecial;
    /** Seeker priority: a layered cell, else a blocker block, else a random block. */
    private seekTarget;
    private commonestColor;
    private actionCells;
    private comboActions;
    private canFall;
    private canEnterFalling;
    /** Can a block entering this conduit keep going and eventually rest?
     * Portal-aware: a conduit carrying a portal drains into the portal target —
     * that's how a split board teleports its overflow into another section. */
    private conduitDrains;
    /** Can a falling block land in (or pass through) this cell right now? */
    private acceptsFalling;
    /** Does the straight-up column feed cell (x, y)? Vertical fill beats diagonal
     * slide. When explicit spawner cells exist, only their columns count as fed
     * from the top (split boards refill sections through portals, not the sky). */
    private columnFeeds;
    private fallStep;
    /** One full settle pass, accumulating per-block travel paths. Returns true if anything moved. */
    private settleInto;
    private spawnerCells;
    /** Settle + refill + ingredient exits until stable; emits one `fall` step
     * (plus `ingredientExit` steps); then the collapse-preset column close-up. */
    private gravity;
    /** Collapse preset: close fully-empty columns toward the left. */
    private collapseColumns;
    private tick;
    private tickConveyors;
    private tickSpread;
    private tickBombs;
    private doShuffle;
    /** Every legal move, with its predicted primary outcome, best first. */
    findMoves(): PredictedMove[];
    /** Greedy longest simple path through a same-colour region (chain autoplay/hints). */
    private longestPathIn;
    /** The single best move, or null. */
    hint(): PredictedMove | null;
    private predictSwap;
    /**
     * Play the board by itself: pick a move per `policy`, apply it, repeat.
     * Stops on `maxMoves`, no moves left, all goals done, or a lose trigger.
     */
    autoplay(opts?: AutoplayOptions): MoveResult[];
    /** Mark a result's region as visually busy while the game plays it back. */
    beginPresent(result: MoveResult): void;
    /** Release a region when its playback finishes. */
    endPresent(result: MoveResult): void;
    /** Cell indices currently visually busy. */
    busy(): number[];
    /**
     * Conservative admission for parallel play: false when the COLUMNS of the
     * candidate cells intersect any busy region (cascades pull whole columns).
     */
    canMove(a: XY, b?: XY): boolean;
    private scoreFor;
    private goal;
    private endMove;
    private finish;
}

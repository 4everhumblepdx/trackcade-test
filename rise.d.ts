export interface XY {
    x: number;
    y: number;
}
export interface Panel {
    id: number;
    color: number;
    /** Chain-eligible: this panel fell because of a clear (provenance flag). */
    chainFlag?: boolean;
    /** Multi-cell garbage block membership (shared id), if this is garbage. */
    garbage?: {
        blockId: number;
    };
}
export type RiseStep = {
    type: 'rise';
    row: {
        color: number;
    }[];
} | {
    type: 'swap';
    a: XY;
    b: XY;
} | {
    type: 'match';
    cells: XY[];
    chain: number;
    combo: number;
} | {
    type: 'clear';
    cells: XY[];
} | {
    type: 'fall';
    moves: {
        id: number;
        from: XY;
        to: XY;
    }[];
} | {
    type: 'garbageBreak';
    blockId: number;
    row: XY[];
    spawned: {
        at: XY;
        color: number;
    }[];
} | {
    type: 'topOut';
};
export interface RiseResult {
    steps: RiseStep[];
    cleared: number;
    chain: number;
    combo: number;
    /** Stop-time hint (bigger for chains/near-top) the game applies to its clock. */
    stopTime: number;
    topOut: boolean;
}
export interface RiseConfig {
    cols: number;
    rows: number;
    seed?: number;
    colors?: number;
    /** Initial filled rows from the bottom. Default 4. */
    fillRows?: number;
}
export declare function createRiseBoard(cfg: RiseConfig): RiseBoard;
export declare class RiseBoard {
    readonly cols: number;
    readonly rows: number;
    readonly colors: number;
    topOut: boolean;
    score: number;
    private grid;
    private rng;
    private nextId;
    private nextGarbageId;
    constructor(cfg: RiseConfig);
    private idx;
    private inBounds;
    panel(x: number, y: number): Panel | null;
    /** A panel that doesn't complete a run with its placed neighbours (clean deal). */
    private freshPanel;
    /** Push a new row up from the bottom (the game calls this on its clock). */
    rise(): RiseResult;
    /** Swap two horizontally-adjacent cells (panel↔panel or panel↔empty). Legal
     * anytime — no match required. Then resolve matches + provenance chains. */
    swap(a: XY, b: XY): RiseResult;
    /** Add a multi-cell garbage block at the top (from a versus attack). */
    addGarbage(x: number, y: number, w: number, h: number, color?: number): void;
    private resolve;
    /** Gravity with provenance: a panel that falls because of a clear gets chainFlag. */
    private settle;
    private findMatches;
    private colorAt;
    private breakGarbage;
    /** Legal swaps that would make a match (autoplay/hints). */
    findMoves(): {
        a: XY;
        b: XY;
    }[];
    debugGrid(): string;
}

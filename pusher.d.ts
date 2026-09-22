export interface XY {
    x: number;
    y: number;
}
export type Dir = 'up' | 'down' | 'left' | 'right';
export interface MoveResult {
    moved: boolean;
    pushed: {
        from: XY;
        to: XY;
    } | null;
    ontoDeadSquare: boolean;
    solved: boolean;
}
export interface PusherConfig {
    /** XSB rows: `#` wall · space/`-` floor · `@` player · `+` player-on-goal ·
     * `$` box · `*` box-on-goal · `.` goal. */
    level: string[];
}
export declare function createPusher(cfg: PusherConfig): Pusher;
export declare class Pusher {
    readonly cols: number;
    readonly rows: number;
    moves: number;
    pushes: number;
    private wall;
    private goal;
    private box;
    private player;
    private dead;
    private history;
    private future;
    constructor(cfg: PusherConfig);
    private idx;
    private inBounds;
    isWall(x: number, y: number): boolean;
    isGoal(x: number, y: number): boolean;
    isBox(x: number, y: number): boolean;
    isDead(x: number, y: number): boolean;
    get playerPos(): XY;
    get metrics(): {
        moves: number;
        pushes: number;
    };
    /** Solved when every box sits on a goal. */
    get solved(): boolean;
    /** Move the player in `dir`, pushing a single box if one is ahead. */
    move(dir: Dir): MoveResult;
    /** Undo the last move (pulling a pushed box back). */
    undo(): boolean;
    /** Redo an undone move. */
    redo(): boolean;
    /** Dead squares: cells from which no box can ever reach a goal. Precomputed by
     * reverse-pulling boxes from every goal; anything unreached is dead. */
    private computeDeadSquares;
    /** Is the box at (x,y) frozen (immovable on both axes and not on a goal)? */
    isFrozen(x: number, y: number): boolean;
    private frozenAxis;
    /** Optional BFS solver for small levels (hints). Returns a move sequence or null. */
    solve(maxNodes?: number): Dir[] | null;
    private snapshot;
    private key;
    private solvedFrom;
    private applyTo;
    debugGrid(): string;
}
export interface History<T> {
    do(action: T): void;
    undo(): T | null;
    redo(): T | null;
    canUndo(): boolean;
    canRedo(): boolean;
    clear(): void;
    readonly length: number;
}
/** Unbounded undo/redo over caller-supplied apply/revert. */
export declare function createHistory<T>(hooks: {
    apply: (a: T) => void;
    revert: (a: T) => void;
}): History<T>;

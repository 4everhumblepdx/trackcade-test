export interface XY {
    x: number;
    y: number;
}
export type Dir = 'up' | 'down' | 'left' | 'right';
/** A board cell: terrain + optional entity. */
export interface Kind {
    id: string;
    /** Objects roll off this (boulders slide off rounded piles). */
    rounded?: boolean;
    /** Falls under gravity (boulders, diamonds). */
    falls?: boolean;
    /** The player can walk into it, consuming it (dirt, diamonds). */
    consumable?: boolean;
    /** Blocks movement/falls entirely (walls). */
    solid?: boolean;
    /** Collected toward the level quota (diamonds). */
    collectible?: boolean;
    /** A wall-following enemy: 'left' or 'right' hand. */
    enemy?: 'left' | 'right';
    /** Butterfly enemies explode into diamonds. */
    explodesToDiamonds?: boolean;
    /** Tile effect on a mover entering (ice slide / force floor push). */
    slide?: Dir | 'entryDir';
    player?: boolean;
}
export interface GridSimConfig {
    level: string[];
    /** char → Kind mapping. Defaults to the Boulder Dash set. */
    legend?: Record<string, Kind>;
    seed?: number;
    /** Diamonds needed to open the exit. Default: all diamonds on the board. */
    quota?: number;
}
interface EntityCell {
    kind: string;
    falling?: boolean;
    scanned?: number;
    dir?: Dir;
}
export interface TickResult {
    moves: {
        from: XY;
        to: XY;
        kind: string;
    }[];
    explosions: XY[];
    collected: number;
    dead: boolean;
    exited: boolean;
    tick: number;
}
/** The Boulder Dash legend. */
export declare const BOULDERDASH_LEGEND: Record<string, Kind>;
export declare function createGridSim(cfg: GridSimConfig): GridSim;
export declare class GridSim {
    readonly cols: number;
    readonly rows: number;
    readonly quota: number;
    collected: number;
    dead: boolean;
    exited: boolean;
    tickCount: number;
    player: XY;
    private legend;
    private terrain;
    private ents;
    private rng;
    private pendingInput;
    private exitOpen;
    private exitPos;
    constructor(cfg: GridSimConfig);
    private idx;
    private inBounds;
    terrainAt(x: number, y: number): string;
    entityAt(x: number, y: number): EntityCell | null;
    kindOf(id: string): Kind;
    get exitReady(): boolean;
    /** Queue a player move for the next tick. */
    input(dir: Dir): void;
    private isEmptyFor;
    /** One deterministic scan (top-left → bottom-right). One tick = one beat. */
    tick(): TickResult;
    private movePlayer;
    private updateFaller;
    private checkCrush;
    private terrainKindAt;
    private canFallInto;
    private moveEnt;
    private updateEnemy;
    private explode;
    /** A greedy demo pilot: walk toward the nearest diamond, dig through dirt. */
    autoInput(): Dir | null;
    private nearestDiamond;
    private bfsTo;
    debugGrid(): string;
}
export interface SnakeConfig {
    cols: number;
    rows: number;
    seed?: number;
    wrap?: boolean;
    start?: XY;
}
export declare function createSnake(cfg: SnakeConfig): Snake;
export declare class Snake {
    readonly cols: number;
    readonly rows: number;
    body: XY[];
    food: XY;
    dead: boolean;
    score: number;
    private dir;
    private queued;
    private grow;
    private wrap;
    private rng;
    constructor(cfg: SnakeConfig);
    private spawnFood;
    /** Queue a direction (buffer up to 2; reject 180° reversals of the LAST-USED dir). */
    input(dir: Dir): void;
    /** One movement tick. */
    step(): {
        moved: boolean;
        ate: boolean;
        dead: boolean;
    };
    /** A greedy demo pilot: head toward the food, avoiding immediate self-collision. */
    autoInput(): void;
}
export {};

export interface XY {
    x: number;
    y: number;
}
/** A placed item: a tier in a named chain, or a special kind. */
export interface Item {
    id: number;
    /** Chain colour/type; items merge only with equal (type, tier). */
    type: number;
    tier: number;
    kind?: 'walker' | 'tombstone' | 'generator' | 'block';
    /** Generator: remaining charges. */
    charges?: number;
}
export type PlaceStep = {
    type: 'place';
    at: XY;
    item: Item;
} | {
    type: 'merge';
    at: XY;
    from: XY[];
    result: Item;
} | {
    type: 'walk';
    moves: {
        id: number;
        from: XY;
        to: XY;
    }[];
} | {
    type: 'tombstone';
    cells: XY[];
} | {
    type: 'generatorSpawn';
    from: XY;
    at: XY;
    item: Item;
} | {
    type: 'gameOver';
};
export interface PlaceResult {
    valid: boolean;
    steps: PlaceStep[];
    merges: number;
    topTier: number;
    gameOver: boolean;
}
export interface PlaceMergeConfig {
    cols: number;
    rows: number;
    seed?: number;
    maxTier?: number;
    /** Weighted deal table: [type, tier, weight]. Default: mostly tier-0 grass. */
    deal?: [number, number, number][];
    /** Chance per turn a walker spawns from the deal instead. Default 0.08. */
    walkerChance?: number;
}
export declare function createPlaceMerge(cfg: PlaceMergeConfig): PlaceMerge;
export declare class PlaceMerge {
    readonly cols: number;
    readonly rows: number;
    readonly maxTier: number;
    gameOver: boolean;
    score: number;
    turns: number;
    private grid;
    private rng;
    private nextId;
    private cfg;
    private dealItem;
    private stored;
    constructor(cfg: PlaceMergeConfig);
    private idx;
    private inBounds;
    item(x: number, y: number): Item | null;
    /** The item about to be placed. */
    get deal(): Item;
    get storage(): Item | null;
    private roll;
    private neighbours;
    private group;
    /** Place the current deal at an empty cell. Resolves merges, runs the turn. */
    place(at: XY): PlaceResult;
    /** Stow the deal in the one storage slot (swaps with a stored item). */
    store(): void;
    private takeStored;
    private resolveMerges;
    private moveWalkers;
    private anyEmpty;
    private topTier;
    /** Legal placements (every empty cell), best first by predicted merge size. */
    findPlaces(): {
        at: XY;
        merges: number;
    }[];
    /** Auto-play: always place where it merges most (else an open cell). */
    autoplay(maxTurns?: number): PlaceResult[];
    debugGrid(): string;
}

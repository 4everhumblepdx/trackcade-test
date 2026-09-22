// Docs: engine/webgpu/levelgen.md — usage, recipes & traps (this file = exact type signatures)
/**
 * Organic CAVE generator — cellular-automata caverns. Pure CPU math, zero
 * engine dependency; import it directly (`import { Cave } from
 * '../engine/webgpu.js'`). NOT wired into `Game`.
 *
 * The organic counterpart to `Maze` (rectilinear corridors) and `Dungeon`
 * (rooms + tunnels): random-fill the grid, then smooth it a few times with a
 * majority rule so blobs coalesce into rounded caverns (the Terraria/Spelunky
 * look). Output is a thick 0/1 tile grid ready for a `Tilemap` /
 * `CollisionGrid` / wall-box build, or to seed a `FlowGrid`'s obstacles. By
 * default disconnected pockets are filled in, so the whole floor is one
 * reachable cave.
 */
import type { Cell } from './util.js';
/** Configuration for a new {@link Cave}. `cols`/`rows` are required. */
export interface CaveOptions {
    /** Grid width in tiles. */
    cols: number;
    /** Grid height in tiles. */
    rows: number;
    /** Seed for reproducible caves (string is hashed). Omit for random. */
    seed?: number | string;
    /** Initial wall probability, 0…1. Higher = tighter caves. Default `0.45`. */
    fillProb?: number;
    /** Cellular-automata smoothing passes. More = rounder. Default `4`. */
    iterations?: number;
    /** Neighbour wall count (of 8) at/above which a cell becomes wall. Default `5`. */
    wallThreshold?: number;
    /** Discard disconnected floor pockets, keeping the largest cavern (so the
     *  cave is one connected space). Default `true`. */
    keepLargest?: boolean;
}
/** Options for {@link Cave.tiles} — the 0/1 grid. */
export interface CaveTileOptions {
    /** Value for wall tiles. Default `1`. */
    wall?: number;
    /** Value for floor tiles. Default `0`. */
    floor?: number;
}
/**
 * A generated cave: the tile grid plus the queries a game needs. Construct once
 * (generation runs in the constructor); read from it every frame.
 *
 * ```ts
 * const cave = new Cave({ cols: 80, rows: 50, seed: 'cavern-1', fillProb: 0.46 });
 * const grid = cave.tiles();                    // 0 floor / 1 wall → CollisionGrid
 * const [entrance, exit] = cave.farthestPair(); // two far-apart floor cells
 * ```
 */
export declare class Cave {
    /** Grid width in tiles. */
    readonly cols: number;
    /** Grid height in tiles. */
    readonly rows: number;
    /** The numeric seed actually used. */
    readonly seed: number;
    /** Per-tile data, row-major: `1` wall, `0` floor. Prefer {@link isWall} /
     *  {@link tiles}, but exposed for custom exporters. */
    readonly grid: Uint8Array;
    constructor(opts: CaveOptions);
    /** Row-major tile index for `(col, row)`. No bounds check. */
    index(col: number, row: number): number;
    /** Is `(col, row)` inside the grid? */
    inBounds(col: number, row: number): boolean;
    /** Is the tile solid rock? Out-of-bounds reads as wall. */
    isWall(col: number, row: number): boolean;
    /** Is the tile open (walkable) cavern floor? */
    isFloor(col: number, row: number): boolean;
    /** Which cell contains world/pixel position `(x, y)` at `cellSize` units per
     *  tile from `(originX, originY)`. `null` when outside the grid. */
    cellAt(x: number, y: number, cellSize?: number, originX?: number, originY?: number): Cell | null;
    /** Count of open floor tiles. */
    get openCount(): number;
    /** Every open floor cell — for scattering spawns / ore / pickups. */
    floors(): Cell[];
    /** Two far-apart floor cells (an approximate cave "diameter"), good for an
     *  entrance/exit pair. Returns `[]` if there's no floor. */
    farthestPair(): [Cell, Cell] | [];
    /** Shortest walkable path from `from` to `to` (4-dir BFS through floor),
     *  inclusive; `[]` if unreachable. */
    path(from: Cell, to: Cell): Cell[];
    /** The cave as a THICK 0/1 tile grid (`grid[y][x]`), ready for a `Tilemap` /
     *  `CollisionGrid` / wall-box build. */
    tiles(opts?: CaveTileOptions): number[][];
    /** ASCII rendering (`#` wall, space floor) — tests + console. */
    toString(): string;
    /** One cellular-automata pass: a cell becomes wall when ≥ `threshold` of its
     *  8 neighbours are wall (out-of-bounds counts as wall). */
    private _smooth;
    /** Flood-fill floor regions; keep the largest, turn the rest to wall. */
    private _keepLargest;
    /** BFS from a floor cell; return the farthest reachable floor cell. */
    private _bfsFarthest;
}

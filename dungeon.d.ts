// Docs: engine/webgpu/levelgen.md — usage, recipes & traps (this file = exact type signatures)
/**
 * Roguelike DUNGEON generator — rooms joined by corridors, with doors and
 * tagged rooms. Pure CPU math, zero engine dependency; import it directly
 * (`import { Dungeon } from '../engine/webgpu.js'`). NOT wired into `Game`.
 *
 * The sibling to `Maze`: where a maze is wall-per-edge corridors, a dungeon is
 * open ROOMS connected by tunnels — the Rogue/Nethack/Zelda layout. It works
 * straight in tile space (one cell = one floor tile you walk on), so the output
 * is a thick 0/1 grid ready for a `Tilemap` / `CollisionGrid` / wall-box build,
 * or to seed a `FlowGrid`'s obstacles. Rooms are placed, connected into one
 * network (plus optional extra loops), doorways are detected, and rooms are
 * TAGGED (start / boss / treasure / junction) so a game can place the player,
 * the objective, and loot without post-analysis.
 */
import type { Cell } from './util.js';
/** How a room reads in the layout — for placing the player, objective and loot. */
export type RoomTag = 'start' | 'boss' | 'treasure' | 'junction' | 'normal';
/** One generated room (a rectangle of floor), in tile coordinates. */
export interface DungeonRoom {
    /** Stable room index. */
    id: number;
    /** Left column (inclusive). */
    col: number;
    /** Top row (inclusive). */
    row: number;
    /** Width in tiles. */
    w: number;
    /** Height in tiles. */
    h: number;
    /** Centre column (floored). */
    cx: number;
    /** Centre row (floored). */
    cy: number;
    /** Role in the layout (see {@link RoomTag}). */
    tag: RoomTag;
}
/** Configuration for a new {@link Dungeon}. `cols`/`rows` are required. */
export interface DungeonOptions {
    /** Grid width in tiles. */
    cols: number;
    /** Grid height in tiles. */
    rows: number;
    /** Seed for reproducible dungeons (string is hashed). Omit for random. */
    seed?: number | string;
    /** How many times to try placing a room. Default scales with area. */
    roomAttempts?: number;
    /** Minimum room side in tiles. Default `4`. */
    minRoom?: number;
    /** Maximum room side in tiles. Default `9`. */
    maxRoom?: number;
    /** Minimum wall gap kept between rooms. Default `1`. */
    roomMargin?: number;
    /** Extra corridors beyond the connecting tree, for loops. Default `2`. */
    extraConnections?: number;
    /** Corridor width in tiles. Default `1` (doors are only detected at width 1). */
    corridorWidth?: number;
}
/** Options for {@link Dungeon.tiles} — the 0/1(/door) grid. */
export interface DungeonTileOptions {
    /** Value for wall tiles. Default `1`. */
    wall?: number;
    /** Value for floor tiles. Default `0`. */
    floor?: number;
    /** Value for door tiles. Default = `floor` (doors read as walkable floor). */
    door?: number;
}
/**
 * A generated dungeon: the tile grid plus room/door metadata and the queries a
 * game needs. Construct once (generation runs in the constructor); read from it
 * every frame.
 *
 * ```ts
 * const dungeon = new Dungeon({ cols: 60, rows: 40, seed: 'level-1', extraConnections: 3 });
 * const grid = dungeon.tiles();                        // 0 floor / 1 wall → CollisionGrid
 * const start = dungeon.roomsByTag('start')[0];        // where to drop the player
 * const boss = dungeon.roomsByTag('boss')[0];          // the objective room
 * ```
 */
export declare class Dungeon {
    /** Grid width in tiles. */
    readonly cols: number;
    /** Grid height in tiles. */
    readonly rows: number;
    /** The numeric seed actually used. */
    readonly seed: number;
    /** Per-tile data, row-major: `1` wall, `0` floor, `2` door. Prefer
     *  {@link isWall} / {@link tiles}, but exposed for custom exporters. */
    readonly grid: Uint8Array;
    /** Every placed room. */
    readonly rooms: DungeonRoom[];
    /** Detected doorway tiles (1-wide thresholds into rooms). */
    readonly doors: Cell[];
    /** Room-graph edges as `[roomId, roomId]` pairs (which rooms are joined). */
    readonly connections: Array<[number, number]>;
    constructor(opts: DungeonOptions);
    /** Row-major tile index for `(col, row)`. No bounds check. */
    index(col: number, row: number): number;
    /** Is `(col, row)` inside the grid? */
    inBounds(col: number, row: number): boolean;
    /** Is the tile solid wall? Out-of-bounds reads as wall. */
    isWall(col: number, row: number): boolean;
    /** Is the tile walkable (floor or door)? */
    isFloor(col: number, row: number): boolean;
    /** Which cell contains world/pixel position `(x, y)` at `cellSize` units per
     *  tile from `(originX, originY)`. `null` when outside the grid. */
    cellAt(x: number, y: number, cellSize?: number, originX?: number, originY?: number): Cell | null;
    /** The room whose rectangle contains `(col, row)`, or `null` (a corridor / wall). */
    roomAt(col: number, row: number): DungeonRoom | null;
    /** All rooms carrying a given {@link RoomTag}. */
    roomsByTag(tag: RoomTag): DungeonRoom[];
    /** Every walkable (floor or door) cell — for scattering pickups / spawns. */
    floors(): Cell[];
    /** Shortest walkable path from `from` to `to` (4-dir BFS through floor +
     *  doors), inclusive; `[]` if unreachable. */
    path(from: Cell, to: Cell): Cell[];
    /** The dungeon as a THICK 0/1 tile grid (`grid[y][x]`), ready for a `Tilemap`
     *  / `CollisionGrid` / wall-box build. Doors default to the floor value. */
    tiles(opts?: DungeonTileOptions): number[][];
    /** ASCII rendering (`#` wall, `+` door, `.` floor) — tests + console. */
    toString(): string;
    private _setFloor;
    private _placeRooms;
    private _carveH;
    private _carveV;
    private _corridor;
    private _connectRooms;
    /** Mark 1-wide corridor tiles that thread into a room as doors. */
    private _detectDoors;
    private _tagRooms;
}

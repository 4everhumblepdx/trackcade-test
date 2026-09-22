// Docs: engine/webgpu/maze.md — usage, recipes & traps (this file = exact type signatures)
/**
 * Standalone 2D maze generator + game-query toolkit — pure CPU math, zero
 * engine dependency. Import it directly (`import { Maze } from '../engine/webgpu.js'`);
 * it is NOT wired into `Game` or any scene.
 *
 * A maze is a `cols × rows` grid of cells; every cell tracks which of its four
 * sides (N/E/S/W) still carry a wall as a 4-bit mask. Ten classic algorithms
 * carve that grid — each with its own visual "texture" (winding vs. bushy vs.
 * roomy) — then optional post-passes braid in loops (multiple routes), stamp
 * open rooms, and punch border exits.
 *
 * The result feeds either engine dimension:
 *   • `maze.tiles()` → a `(2·cols+1) × (2·rows+1)` 0/1 grid for THICK walls
 *     (Rogue/dungeon style: one tile per wall cell) — drop into a `Tilemap`,
 *     `CollisionGrid`, or a wall-per-solid-cell 3D build.
 *   • `maze.walls()` → thin edge segments (puzzle-book style) for line drawing.
 *
 * Plus the queries a game actually needs: `canMove()`, `cellAt()`,
 * `directionToExit()`, `path()`, `distanceField()`, `deadEnds()`.
 */
import type { Cell } from './util.js';
/** A cardinal direction as an index: N E S W = `0 1 2 3`. Read the named values
 *  off the class — `Maze.N`, `Maze.E`, `Maze.S`, `Maze.W`. */
export type Dir = 0 | 1 | 2 | 3;
/**
 * Which carving algorithm to run. Each biases the maze's look:
 * - `backtracker` (default) — long, winding corridors, few branches ("rivery").
 * - `prim` / `kruskal` — short branches, bushy, many junctions; look alike.
 * - `wilson` / `aldous-broder` — unbiased uniform spanning tree (no texture); Aldous-Broder is slow, keep it to small grids.
 * - `hunt-and-kill` — backtracker-ish but with more, shorter dead-ends.
 * - `eller` — row-at-a-time, uniform-ish, very fast.
 * - `recursive-division` — nested chambers, naturally roomy/rectilinear.
 * - `binary-tree` — trivial, strong NE diagonal bias + two open border runs.
 * - `sidewinder` — trivial, one fully-open top row, horizontal-run texture.
 */
export type MazeAlgorithm = 'backtracker' | 'prim' | 'kruskal' | 'wilson' | 'aldous-broder' | 'hunt-and-kill' | 'eller' | 'recursive-division' | 'binary-tree' | 'sidewinder';
/** Open-room carving controls (passed as `rooms` in {@link MazeOptions}). */
export interface RoomOptions {
    /** How many rectangular rooms to attempt to stamp. Default `3`. */
    count?: number;
    /** Minimum room side in cells. Default `2`. */
    minSize?: number;
    /** Maximum room side in cells. Default `4`. */
    maxSize?: number;
}
/** One requested border opening (passed in the `exits` array). */
export interface ExitSpec {
    /** Which outer edge to open. */
    side: 'N' | 'E' | 'S' | 'W';
    /** Position ALONG that edge (column for N/S, row for E/W). Random if omitted. */
    at?: number;
}
/** A resolved exit: the border cell and the outward direction it opens. */
export interface Exit {
    /** Column of the border cell. */
    col: number;
    /** Row of the border cell. */
    row: number;
    /** Outward direction through the border wall. */
    dir: Dir;
}
/** A carved room rectangle, in cell coordinates (top-left inclusive). */
export interface Room {
    /** Left column. */ col: number;
    /** Top row. */ row: number;
    /** Width in cells. */ w: number;
    /** Height in cells. */ h: number;
}
/** Options for {@link Maze.tiles} — the thick 0/1 wall grid. */
export interface TileOptions {
    /** Value written for wall tiles. Default `1`. */
    wall?: number;
    /** Value written for open (floor) tiles. Default `0`. */
    open?: number;
}
/** A thin wall segment in cell units (0 … cols / 0 … rows), for line drawing. */
export interface WallSeg {
    /** Start X in cell units. */ x1: number;
    /** Start Y in cell units. */ y1: number;
    /** End X in cell units. */ x2: number;
    /** End Y in cell units. */ y2: number;
}
/** Configuration for a new {@link Maze}. `cols`/`rows` are required. */
export interface MazeOptions {
    /** Grid width in cells. */
    cols: number;
    /** Grid height in cells. */
    rows: number;
    /** Carving algorithm. Default `'backtracker'`. */
    algorithm?: MazeAlgorithm;
    /** Seed for reproducible mazes — same seed + options ⇒ identical maze. A
     *  string is hashed. Omit for a fresh random maze each call. */
    seed?: number | string;
    /**
     * Fraction of dead-ends (0…1) to open into loops, giving MULTIPLE routes
     * between any two points (a "braided" maze). `0` = perfect maze (exactly one
     * path anywhere); `1` = every dead-end removed. Default `0`.
     */
    braid?: number;
    /** Carve open rooms into the maze. A number is shorthand for `{ count }`. */
    rooms?: RoomOptions | number;
    /**
     * Border openings. A number `n` punches `n` exits spread around the border
     * (n=1 → one; n=2 → opposite corners; more → cycled sides). An array places
     * them explicitly. Default `2`. Use `0` for a fully sealed maze.
     */
    exits?: number | ExitSpec[];
}
/**
 * A generated 2D maze: the wall grid plus the geometry exporters and gameplay
 * queries a game needs. Construct once (generation runs in the constructor);
 * the instance is then immutable data you read from every frame.
 *
 * ```ts
 * const maze = new Maze({ cols: 20, rows: 15, algorithm: 'prim', seed: 'level-1', braid: 0.3 });
 * const grid = maze.tiles();                 // thick walls → CollisionGrid / Tilemap
 * if (maze.canMove(c, r, E)) c++;            // gameplay movement test
 * const dir = maze.directionToExit(c, r);    // hint arrow toward nearest exit
 * ```
 */
export declare class Maze {
    /** North direction index (row − 1). */ static readonly N: Dir;
    /** East direction index (col + 1). */ static readonly E: Dir;
    /** South direction index (row + 1). */ static readonly S: Dir;
    /** West direction index (col − 1). */ static readonly W: Dir;
    /** Grid width in cells. */
    readonly cols: number;
    /** Grid height in cells. */
    readonly rows: number;
    /** Algorithm used to carve this maze. */
    readonly algorithm: MazeAlgorithm;
    /** The numeric seed actually used (after hashing a string seed). */
    readonly seed: number;
    /** The resolved border exits (entrances and exits are interchangeable). */
    readonly exits: Exit[];
    /** The open rooms that were stamped (empty when `rooms` was not requested). */
    readonly rooms: Room[];
    /** Cached BFS distance-to-nearest-exit field; built lazily by {@link exitField}. */
    private _exitField;
    constructor(opts: MazeOptions);
    /** Row-major cell index for `(col, row)`. No bounds check. */
    index(col: number, row: number): number;
    /** Is `(col, row)` inside the grid? */
    inBounds(col: number, row: number): boolean;
    /** Is there a wall on the `dir` side of cell `(col, row)`? Out-of-bounds cells
     *  read as fully walled. */
    wall(col: number, row: number, dir: Dir): boolean;
    /**
     * Can an actor in cell `(col, row)` step in `dir`? True when no wall blocks
     * that side. Stepping through a border opening (an {@link Exit}) counts as a
     * move that LEAVES the maze, so this returns true there too — check
     * {@link inBounds} on the target if you need to distinguish "exited".
     */
    canMove(col: number, row: number, dir: Dir): boolean;
    /** The cell reached by stepping `dir` from `(col, row)` (may be out of bounds). */
    step(col: number, row: number, dir: Dir): Cell;
    /** Open (wall-free) in-bounds neighbours of `(col, row)`, each with the `dir`
     *  taken to reach it. */
    neighbours(col: number, row: number): Array<Cell & {
        dir: Dir;
    }>;
    /**
     * Which cell contains pixel/world position `(x, y)`? Maps by the thin-wall
     * layout where one cell spans `cellSize` units from `(originX, originY)`.
     * Returns `null` when the point is outside the grid. (For a THICK
     * {@link tiles} render, cell `(c, r)` is tile `(2c+1, 2r+1)`.)
     */
    cellAt(x: number, y: number, cellSize?: number, originX?: number, originY?: number): Cell | null;
    /**
     * Expand to a THICK 0/1 wall grid of size `(2·cols+1) × (2·rows+1)`,
     * row-major (`grid[y][x]`). Cell centres and open passages become floor;
     * walls and the pillars between them stay solid. Feed straight into a
     * `Tilemap` / `CollisionGrid`, or place one wall box per solid tile for a
     * Rogue-style 3D dungeon. Exits appear as gaps punched in the outer ring.
     */
    tiles(opts?: TileOptions): number[][];
    /**
     * The maze as THIN wall segments in cell units (`0…cols` × `0…rows`) — the
     * puzzle-book look. Each internal edge appears once; border edges are
     * included except where an exit opens. Draw each as a line
     * (`d.line(x1*scale, y1*scale, x2*scale, y2*scale, ...)`).
     */
    walls(): WallSeg[];
    /**
     * BFS distance (in cells, through open passages) from every cell to the
     * NEAREST of `targets`, as a row-major `Int32Array`. Unreachable cells are
     * `-1`. Cheap to reuse: compute one field toward a goal, then read a
     * direction from any cell in O(1) with {@link directionTo}.
     */
    distanceField(targets: Cell[]): Int32Array;
    /**
     * Shortest path from `from` to `to` as an inclusive list of cells (`[from …
     * to]`), or `[]` when unreachable. For repeated queries toward one goal,
     * build a {@link distanceField} once and step it with {@link directionTo}.
     */
    path(from: Cell, to: Cell): Cell[];
    /**
     * The first `Dir` to step from `(col, row)` to get closer to a goal, or `-1`
     * if there's nowhere better to go. Pass a precomputed {@link distanceField}
     * to reuse it across cells/frames; pass a single `Cell` for a one-off.
     */
    directionTo(col: number, row: number, goal: Cell | Int32Array): Dir | -1;
    /** The distance-to-nearest-exit field (built once, then cached). `-1` where
     *  no exit is reachable, or everywhere when the maze has no exits. */
    exitField(): Int32Array;
    /** The `Dir` to step from `(col, row)` toward the nearest {@link Exit}, or
     *  `-1` if already at an exit / none is reachable. */
    directionToExit(col: number, row: number): Dir | -1;
    /** Every dead-end cell (exactly one open side). Handy for placing treasure,
     *  keys, or spawn points. */
    deadEnds(): Cell[];
    /** A compact ASCII rendering (`#` walls, space floor) — for tests and
     *  console debugging. */
    toString(): string;
    /** Remove the wall between adjacent cells `(col,row)` and its `dir` neighbour
     *  (clears the bit on BOTH cells). */
    private _carve;
    /** Add the wall between `(col,row)` and its `dir` neighbour (sets both bits). */
    private _addWall;
    /** Count of open (wall-free) sides of a cell. */
    private _openCount;
    /** Fisher–Yates shuffle in place using the maze rng. */
    private _shuffle;
    private _generate;
    /** Recursive backtracker (randomised DFS) — long winding corridors. */
    private _backtracker;
    /** Randomised Prim's — bushy, many short branches. */
    private _prim;
    /** Randomised Kruskal's — uniform texture, many junctions (union-find). */
    private _kruskal;
    /** Wilson's — loop-erased random walks → an unbiased uniform spanning tree. */
    private _wilson;
    /** Aldous–Broder — random walk, carve on first visit. Uniform but slow. */
    private _aldousBroder;
    /** Hunt-and-kill — walk-carve then scan for the next unvisited neighbour. */
    private _huntAndKill;
    /** Eller's — row-at-a-time set merging, constant memory. */
    private _eller;
    /** Recursive division — add walls with one gap, recurse each side (roomy). */
    private _division;
    /** Binary tree — each cell carves N or E. Trivial, strong diagonal bias. */
    private _binaryTree;
    /** Sidewinder — horizontal runs closed off with one upward carve each. */
    private _sidewinder;
    /** Force the outer border walls closed (division + trivial algos leave gaps). */
    private _sealBorder;
    /** Stamp open rectangular rooms — removing internal walls only, so the maze
     *  stays fully connected (rooms just add openness). */
    private _carveRooms;
    /** Braid: open a fraction of dead-ends into loops (multiple routes). */
    private _braid;
    /** Punch the requested border exits, filling {@link exits}. */
    private _punchExits;
}

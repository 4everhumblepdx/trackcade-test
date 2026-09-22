// Docs: engine/webgpu/flowfield.md — usage, recipes & traps (this file = exact type signatures)
/**
 * Flow-field pathfinding on a grid — pure CPU math, zero engine dependency.
 * Import it directly (`import { FlowGrid } from '../engine/webgpu.js'`); it is
 * NOT wired into `Game` or any scene.
 *
 * The tower-defense pattern (after redblobgames.com/pathfinding/tower-defense):
 * instead of running A* once PER enemy, run ONE search from the goal(s) across
 * the whole grid to get an **integration field** (distance-to-goal per cell),
 * then take its negative gradient to get a **flow field** (each cell's step
 * direction toward the goal). Every enemy just reads the flow at its position —
 * hundreds of units, one search. When a tower is built the field is recomputed
 * once and everyone re-routes.
 *
 * The grid is mutable: block/unblock cells (towers, walls), weight cells (mud,
 * roads), move the goals — the field rebuilds lazily on the next query. It
 * feeds either engine dimension: `steer(x, y)` returns a smooth
 * (interpolated) direction vector for an enemy at any world position;
 * `flowVec(col, row)` / `distance(col, row)` are the raw per-cell values for a
 * tile render or a 3D build. `canBuild(col, row)` is the placement guard that
 * refuses a tower which would fully wall spawns off from the goal.
 */
import type { Vec2, Cell } from './util.js';
/** A flow direction as an 8-way index (0=E, 1=SE, 2=S, 3=SW, 4=W, 5=NW, 6=N,
 *  7=NE), or `-1` for "no flow" (a goal cell, a blocked cell, or unreachable). */
export type FlowDir = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** Configuration for a new {@link FlowGrid}. `cols`/`rows` are required. */
export interface FlowGridOptions {
    /** Grid width in cells. */
    cols: number;
    /** Grid height in cells. */
    rows: number;
    /** Goal cell(s) — the field flows toward the NEAREST of these (multi-goal is
     *  the "supernode" trick, seeded for free). At least one is needed for a
     *  useful field. */
    goals?: Cell[];
    /** Spawn cell(s). Only used by {@link FlowGrid.canBuild} to guarantee a
     *  tower never fully walls a spawn off from the goal. */
    spawns?: Cell[];
    /** Allow 8-way (diagonal) movement. Default `true`. */
    diagonal?: boolean;
    /** Let diagonal moves slip between two blocked cells at a corner. Default
     *  `false` (units won't squeeze between two towers placed corner-to-corner). */
    cutCorners?: boolean;
}
/**
 * A mutable grid carrying a flow field toward one or more goals. Build it, set
 * goals + obstacles, then read `steer()` / `flowVec()` / `distance()` every
 * frame. Edits (block, weight, goals) mark the field dirty; it rebuilds itself
 * on the next query — call {@link update} up front if you want the cost paid at
 * a known time.
 *
 * ```ts
 * const grid = new FlowGrid({ cols: 40, rows: 30, goals: [{ col: 39, row: 15 }], spawns: [{ col: 0, row: 15 }] });
 * if (grid.canBuild(c, r)) grid.build(c, r);          // place a tower
 * enemy.vel = scale(grid.steer(enemy.x, enemy.y, TILE), speed);  // follow the flow
 * ```
 */
export declare class FlowGrid {
    /** Grid width in cells. */
    readonly cols: number;
    /** Grid height in cells. */
    readonly rows: number;
    /** Whether diagonal movement is allowed. */
    diagonal: boolean;
    /** Whether diagonal moves may cut blocked corners. */
    cutCorners: boolean;
    /** The current goal cells (flow points toward the nearest). */
    goals: Cell[];
    /** The current spawn cells (used by {@link canBuild}). */
    spawns: Cell[];
    /** `1` where a cell is blocked (tower/wall), else `0`. Row-major. */
    readonly blocked: Uint8Array;
    /** Per-cell entry cost (terrain weight); `1` is normal, higher is slower. */
    readonly weight: Float32Array;
    /** Flow field: the {@link FlowDir} each cell steps toward its goal. */
    readonly flow: Int8Array;
    private _dirty;
    constructor(opts: FlowGridOptions);
    /** Row-major cell index for `(col, row)`. No bounds check. */
    index(col: number, row: number): number;
    /** Is `(col, row)` inside the grid? */
    inBounds(col: number, row: number): boolean;
    /** Which cell contains world/pixel position `(x, y)`, at `cellSize` units per
     *  cell from `(originX, originY)`. `null` when outside the grid. */
    cellAt(x: number, y: number, cellSize?: number, originX?: number, originY?: number): Cell | null;
    /** Is the cell an obstacle (tower/wall)? Out-of-bounds reads as blocked. */
    isBlocked(col: number, row: number): boolean;
    /** Block or unblock a cell (place/remove a tower or wall). */
    setBlocked(col: number, row: number, on: boolean): void;
    /** Place a tower/wall at `(col, row)` (alias for `setBlocked(…, true)`). */
    build(col: number, row: number): void;
    /** Remove a tower/wall at `(col, row)` (alias for `setBlocked(…, false)`). */
    unbuild(col: number, row: number): void;
    /** Clear every obstacle. */
    clearBlocked(): void;
    /** Set a cell's terrain entry cost (`1` normal; `>1` slow mud; `<1` fast
     *  road). Cells stay passable; block with {@link setBlocked} instead. */
    setWeight(col: number, row: number, w: number): void;
    /** Replace the goal cells and mark the field dirty. */
    setGoals(goals: Cell[]): void;
    /** Replace the spawn cells (used only by {@link canBuild}). */
    setSpawns(spawns: Cell[]): void;
    /**
     * Rebuild the integration + flow fields (Dijkstra from all goals). Called
     * automatically by the queries when the grid is dirty; call it yourself to
     * pay the cost at a controlled time. Orthogonal steps cost `weight`,
     * diagonal steps `weight · √2`.
     */
    update(): void;
    private _ensure;
    /** Distance (field cost) from `(col, row)` to the nearest goal, or
     *  `Infinity` if blocked/unreachable. */
    distance(col: number, row: number): number;
    /** Can an enemy at `(col, row)` reach a goal? */
    reachable(col: number, row: number): boolean;
    /** The {@link FlowDir} `(col, row)` flows toward its goal (`-1` at a goal /
     *  blocked / unreachable cell). */
    flowDir(col: number, row: number): FlowDir;
    /** The unit flow VECTOR at cell `(col, row)` — the direction to move, as a
     *  `{x, y}` (zero when there's no flow). */
    flowVec(col: number, row: number): Vec2;
    /**
     * The smooth steering direction for an enemy at world position `(x, y)` —
     * bilinearly interpolates the flow arrows of the four surrounding cells so
     * units off the cell centre don't jerk between headings. Returns a
     * unit-length `{x, y}` (zero at the goal / in a dead pocket). `cellSize` +
     * `origin` map world units to the grid (same convention as {@link cellAt}).
     */
    steer(x: number, y: number, cellSize?: number, originX?: number, originY?: number): Vec2;
    /**
     * Would blocking `(col, row)` still leave EVERY spawn able to reach a goal?
     * The tower-placement guard: returns `false` for a build that would fully
     * wall a spawn off (or that isn't a legal, currently-open cell). Runs a
     * connectivity check with the same movement rules — it does not mutate the
     * grid.
     */
    canBuild(col: number, row: number): boolean;
    /**
     * Trace the route from `(col, row)` by following the flow field to a goal —
     * an inclusive list of cells, for drawing a preview path or a debug overlay.
     * Empty when unreachable; capped so a broken field can't loop forever.
     */
    path(from: Cell, maxSteps?: number): Cell[];
}

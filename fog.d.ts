// Docs: engine/webgpu/fog.md — usage, recipes & traps (this file = exact type signatures)
/**
 * FOG OF WAR / field-of-view on a grid — pure CPU math, zero engine dependency.
 * Import it directly (`import { FogGrid } from '../engine/webgpu.js'`); it is
 * NOT wired into `Game`.
 *
 * The vision side of grid games (the counterpart to the routing components):
 * **recursive shadowcasting** computes what a light source can SEE from a point,
 * with opaque cells (walls, objects) casting real shadows behind them. Place
 * several LIGHTS — the player's own sight, a torch that extends it, a distant
 * lamp that reveals a far room — and the lit area is their combined, shadowed
 * reach. A cell's brightness falls off to its light's radius.
 *
 * On top of that it keeps FOG-OF-WAR memory: every cell is `unseen` (never
 * lit), `explored` (seen before, now dark), or `visible` (lit right now).
 *
 * Blockers come from any tile grid — `fog.blockFrom(maze.tiles())` wires a
 * generated level's walls as shadow casters. `canSee(a, b)` is a direct
 * line-of-sight test for AI ("can the guard see the player?").
 */
import type { Cell } from './util.js';
/** Brightness falloff from a light's centre to its radius. */
export type LightFalloff = 'none' | 'linear' | 'smooth' | 'quadratic';
/** A cell's fog state — `unseen` (never lit), `explored` (remembered, dark now),
 *  `visible` (lit this frame). */
export type FogState = 'unseen' | 'explored' | 'visible';
/** A light / vision source. Mutate `col`/`row` to move it, then call
 *  {@link FogGrid.compute}. */
export interface FogLight {
    /** Column. */ col: number;
    /** Row. */ row: number;
    /** Sight/illumination radius in cells. */ radius: number;
    /** Peak brightness at the centre, 0…1. Default `1`. */ intensity: number;
    /** Falloff for this light (defaults to the grid's). */ falloff?: LightFalloff;
}
/** Configuration for a new {@link FogGrid}. `cols`/`rows` are required. */
export interface FogGridOptions {
    /** Grid width in cells. */
    cols: number;
    /** Grid height in cells. */
    rows: number;
    /** Default brightness falloff for lights. Default `'smooth'`. */
    falloff?: LightFalloff;
    /** Track fog-of-war memory (cells stay `explored` once seen). Default `true`. */
    memory?: boolean;
}
/**
 * A grid tracking what's lit, what's remembered, and what's dark. Set the
 * opaque cells (blockers), place lights, call `compute()` each frame, then read
 * `lightAt` / `state` per cell.
 *
 * ```ts
 * const fog = new FogGrid({ cols: dungeon.cols, rows: dungeon.rows });
 * fog.blockFrom(dungeon.tiles());                 // walls block light
 * const eye = fog.addLight(px, py, 7);            // the player's vision
 * fog.addLight(torchX, torchY, 5, { intensity: 0.8 });   // a torch that reveals a far room
 * // each frame: eye.col = px; eye.row = py; fog.compute();
 * // then draw: fog.state(c, r) → 'visible' | 'explored' | 'unseen'; fog.lightAt(c, r) → 0..1
 * ```
 */
export declare class FogGrid {
    /** Grid width in cells. */
    readonly cols: number;
    /** Grid height in cells. */
    readonly rows: number;
    /** Default falloff for lights. */
    falloff: LightFalloff;
    /** Whether fog-of-war memory is tracked. */
    memory: boolean;
    /** `1` where a cell blocks light/sight (walls, objects). Row-major. */
    readonly opaque: Uint8Array;
    /** Current-frame brightness per cell, `0`…`1`. Row-major. Prefer
     *  {@link lightAt} / {@link isVisible}. */
    readonly light: Float32Array;
    /** `1` where a cell has ever been lit (fog-of-war memory). Row-major. */
    readonly explored: Uint8Array;
    /** The active light / vision sources — mutate freely, then `compute()`. */
    readonly lights: FogLight[];
    constructor(opts: FogGridOptions);
    /** Row-major cell index for `(col, row)`. No bounds check. */
    index(col: number, row: number): number;
    /** Is `(col, row)` inside the grid? */
    inBounds(col: number, row: number): boolean;
    /** Which cell contains world/pixel position `(x, y)` at `cellSize` units per
     *  cell from `(originX, originY)`. `null` when outside the grid. */
    cellAt(x: number, y: number, cellSize?: number, originX?: number, originY?: number): Cell | null;
    /** Does the cell block light/sight? Out-of-bounds reads as opaque. */
    isOpaque(col: number, row: number): boolean;
    /** Set/clear a blocker (a wall or a light-blocking object). */
    setOpaque(col: number, row: number, on: boolean): void;
    /** Clear every blocker. */
    clearOpaque(): void;
    /**
     * Load blockers from a tile grid (`grid[row][col]`) — e.g. `maze.tiles()`,
     * `dungeon.tiles()`, `cave.tiles()`. Cells equal to `wallValue` (default `1`)
     * become opaque; everything else is clear. The grid must match this size.
     */
    blockFrom(grid: number[][], wallValue?: number): void;
    /** Add a light / vision source and return its handle (mutate `col`/`row` to
     *  move it). `radius` is in cells; `intensity` 0…1 (default 1). */
    addLight(col: number, row: number, radius: number, opts?: {
        intensity?: number;
        falloff?: LightFalloff;
    }): FogLight;
    /** Remove a light previously returned by {@link addLight}. */
    removeLight(src: FogLight): void;
    /** Remove all lights. */
    clearLights(): void;
    /**
     * Recompute the light field from all sources (recursive shadowcasting through
     * the opaque cells) and fold currently-lit cells into the explored memory.
     * Each cell keeps the BRIGHTEST light reaching it. Call once per frame after
     * moving lights / blockers.
     */
    compute(): void;
    /** Brightness at `(col, row)` this frame, `0`…`1` (`0` = dark). */
    lightAt(col: number, row: number): number;
    /** Is the cell lit right now? */
    isVisible(col: number, row: number): boolean;
    /** Has the cell ever been lit (fog-of-war memory)? */
    isExplored(col: number, row: number): boolean;
    /** The cell's fog state: `visible` (lit now), `explored` (remembered), or
     *  `unseen`. With `memory: false`, only `visible` / `unseen`. */
    state(col: number, row: number): FogState;
    /**
     * Direct line-of-sight between two cells — `true` if no opaque cell blocks the
     * line (endpoints excluded). The AI "can the guard see the player?" test,
     * independent of the light field. Pass `range` to also cap the distance.
     */
    canSee(fromCol: number, fromRow: number, toCol: number, toRow: number, range?: number): boolean;
    /** Manually mark a shadowcast FOV around `(col, row)` as explored (reveal a
     *  map region without a persistent light). */
    reveal(col: number, row: number, radius: number): void;
    /** Mark the whole map explored (reveal the level). */
    revealAll(): void;
    /** Forget all fog-of-war memory. */
    resetMemory(): void;
}

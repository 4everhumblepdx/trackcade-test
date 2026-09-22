// Docs: engine/webgpu/tilemaps.md — usage, recipes & traps (this file = exact type signatures)
/** Static sprite-vs-world tile collision: swept AABB + slope trace used by Physics each frame. */
import { TileGrid } from './tile-grid.js';
import type { Vec2 } from './util.js';
/**
 * Slope line definition for a single tile: `[x1, y1, x2, y2, solid]` in tile-local 0..1 coordinates.
 * Solid `true` means the area behind the line is filled (one-way platforms set `false`).
 * Synonym: slope tile, angled tile, ramp definition.
 */
export type TileDef = [number, number, number, number, boolean];
/** Map of tile index → `TileDef`. Pass to `CollisionGrid` to define which tile indices are slopes. */
export type TileDefs = Record<number, TileDef>;
/**
 * Tangent and outward normal vectors for a slope tile hit during a swept trace.
 * `x`/`y` = tangent (slide direction); `nx`/`ny` = surface normal (reflect direction).
 */
export interface SlopeNormal {
    /** Tangent vector X component (slope slide direction). */
    x: number;
    /** Tangent vector Y component (slope slide direction). */
    y: number;
    /** Surface normal X component (outward from slope face). */
    nx: number;
    /** Surface normal Y component (outward from slope face). */
    ny: number;
}
/**
 * Result returned by `CollisionGrid.trace()` after a swept AABB movement test.
 * `Physics.handleMovementTrace` reads this to resolve velocity and snap position.
 */
export interface TraceResult {
    /** Which axes collided and whether a slope was hit. */
    collision: {
        x: boolean;
        y: boolean;
        slope: SlopeNormal | false;
    };
    /** Final snapped world position after resolving all collisions. */
    position: Vec2;
    /** Tile index that caused each axis collision (0 if no collision on that axis). */
    tile: Vec2;
}
/**
 * Structural interface satisfied by both `CollisionGrid` and the no-op dummy.
 * Pass to `Scene.collisionMap` to swap in a custom collision implementation.
 */
export interface CollisionGridLike {
    /** Swept AABB trace from `(x, y)` by `(vx, vy)` for a box of `objectWidth × objectHeight`. */
    trace(x: number, y: number, vx: number, vy: number, objectWidth: number, objectHeight: number): TraceResult;
}
/**
 * Tile-based static collision map used as a scene's `collisionMap`.
 * Tile index `1` = fully solid; indices `2..lastSlope` = slope tiles defined in `tiledef`; indices above `lastSlope` = fully solid.
 * The swept trace is sub-stepped so fast-moving sprites never tunnel through walls.
 * Synonym: world collision, tile collision, static geometry, tilemap collision.
 */
export declare class CollisionGrid extends TileGrid implements CollisionGridLike {
    /** Slope line definitions keyed by tile index. Defaults to `CollisionGrid.defaultTileDef`. */
    tiledef: TileDefs;
    constructor(tilesize: number, data: number[][], tiledef?: TileDefs);
    /**
     * Swept AABB trace from world position `(x, y)` by velocity `(vx, vy)` for a box of `objectWidth × objectHeight` pixels.
     * Sub-steps the movement so no tile is ever skipped at high speed. Returns a `TraceResult` with the resolved position and collision flags.
     * Called automatically by `Physics.updateBody`; call manually only for custom movement.
     */
    trace(x: number, y: number, vx: number, vy: number, objectWidth: number, objectHeight: number): TraceResult;
    /**
     * Built-in slope tile definitions covering 15°, 22°, 45°, 67°, and 75° ramps in all four diagonal directions, plus cardinal one-way edges.
     * Assigned automatically when no `tiledef` is passed to the constructor.
     * Synonym: default slopes, ramp tiles, angled tiles.
     */
    static defaultTileDef: TileDefs;
    /**
     * A no-op `CollisionGridLike` that never blocks movement — use as a scene's `collisionMap` when you have no tile collision.
     * Synonym: passthrough collision, no collision map, open world.
     */
    static staticNoCollision: CollisionGridLike;
}

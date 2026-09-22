// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Base 2-D grid of tile indices shared by CollisionGrid and Tilemap. */
export declare class TileGrid {
    /** Width of each tile in pixels. */
    tilesize: number;
    /** Grid width in tiles. */
    width: number;
    /** Grid height in tiles. */
    height: number;
    /** Grid width in pixels (`width * tilesize`). */
    pxWidth: number;
    /** Grid height in pixels (`height * tilesize`). */
    pxHeight: number;
    /** Raw tile index data — `data[row][col]`, 0 = empty. */
    data: number[][];
    /** Optional identifier for this grid, set by the level loader. */
    name: string | null;
    constructor(tilesize: number, data: number[][]);
    /**
     * Returns the tile index at world pixel position `(x, y)`, or `0` when the position is outside the grid.
     * Use to query what tile a sprite is standing on or overlapping.
     */
    getTile(x: number, y: number): number;
    /**
     * Writes a tile index at world pixel position `(x, y)`. Silently ignores positions outside the grid.
     * Use to break or place tiles at runtime (destructible terrain, pickups).
     */
    setTile(x: number, y: number, tile: number): void;
}

// Docs: engine/webgpu/tilemaps.md — usage, recipes & traps (this file = exact type signatures)
/** Drawable tile layer: pushes a tileset's frames over a TileGrid with parallax, repeat, and per-tile animation. */
import { TileGrid } from './tile-grid.js';
/** The Draw surface a Tilemap needs — just the sprite verb (lets tests pass a recorder). */
export interface TileDrawLike {
    /** Push one textured quad — same signature as `Draw.sprite`. */
    sprite(frame: number, x: number, y: number, opts?: {
        w?: number;
        h?: number;
    }): void;
}
/**
 * A per-tile frame animation played in place of a tile index.
 * v2 simplification of raster's `Animation` objects: pure `{ time, seq }` data
 * (like a sprite `AnimDef`), advanced by the map's single `update(dt)` clock —
 * every animated tile in a map shares one timeline instead of raster's
 * per-Animation timers. `seq` entries are 0-based frame offsets within the
 * tileset strip (i.e. tile index − 1), drawn as `firstFrame + offset`.
 */
export interface TileAnim {
    /** Seconds per animation frame. */
    time: number;
    /** Frame OFFSETS within the tileset strip (0-based, = tile index − 1). */
    seq: number[];
}
/**
 * A rendered tile layer attached to a scene. Tile index `1` maps to the first tile in the tileset strip; `0` = empty (not drawn).
 * Supports parallax scrolling (`distance`), seamless wrapping (`repeat`), and per-tile frame animations.
 * Synonym: tile layer, tilemap layer, background layer, parallax layer.
 */
export declare class Tilemap extends TileGrid {
    /**
     * Atlas frame index of tile 1 — register the tileset strip with
     * `game.assets.frames(canvas, tileSize)` / `game.assets.loadFrames(url, tileSize)` and pass
     * the returned index. Tile index N draws atlas frame `firstFrame + N - 1`.
     */
    firstFrame: number;
    /**
     * Parallax distance factor. `1` = scrolls 1:1 with the camera (default, foreground).
     * Values `> 1` scroll slower (distant background); values `< 1` scroll faster (close foreground).
     * Synonym: parallax, depth, scroll speed.
     */
    distance: number;
    /**
     * When `true` the layer tiles seamlessly in both axes. Use for looping backgrounds and infinite ground layers.
     * Default `false`.
     */
    repeat: boolean;
    /**
     * When `true` this layer is drawn after all sprites (in front). Default `false` (drawn behind sprites).
     * Use for foreground detail tiles that overlap the player (cave ceilings, archways).
     */
    foreground: boolean;
    /** When `false` the layer is skipped entirely during draw. Default `true`. */
    enabled: boolean;
    /**
     * Per-tile animation map — key is tile index − 1 (0-based, matching raster),
     * value is the `TileAnim` played in place of that tile.
     */
    animations: Record<number, TileAnim>;
    constructor(tilesize: number, data: number[][], firstFrame?: number);
    /** Advance the per-tile animations. Called by `Scene.update()` each frame. */
    update(dt: number): void;
    /**
     * Pushes every visible non-zero tile as one batch instance for the given view rect
     * (world units — the scene passes `viewRect()`), applying `distance` parallax and
     * `repeat` wrapping. Called automatically by `Scene.draw`; call manually only if
     * compositing layers yourself.
     */
    draw(d: TileDrawLike, view: {
        x: number;
        y: number;
        w: number;
        h: number;
    }): void;
}

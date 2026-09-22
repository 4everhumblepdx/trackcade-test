// Docs: engine/webgpu/tilemaps.md — usage, recipes & traps (this file = exact type signatures)
/** Level loading — populate a Scene from declarative LevelData (e.g. exported from a tile editor). */
import type { Scene } from './scene.js';
import { type CollisionGridLike } from './collision-grid.js';
import { Tilemap } from './tilemap.js';
import type { Sprite, SpriteConfig } from './sprite.js';
/** One sprite entry in a `LevelData` — spawned at `(x, y)` with optional initial settings. */
export interface LevelSpriteData {
    /** Sprite class to instantiate. Must be constructible with no arguments (the v2 config-ctor contract). */
    type: new () => Sprite;
    /** World x position in pixels. */
    x: number;
    /** World y position in pixels. */
    y: number;
    /** Optional initial property overrides merged onto the new sprite. */
    settings?: Partial<SpriteConfig> & Record<string, unknown>;
}
/** One tile layer in a `LevelData` — either a collision grid or a visual tilemap. */
export interface LevelLayerData {
    /** Layer name. Use `'collision'` to designate the tile-based collision grid. */
    name: string;
    /** Tile size in pixels (e.g. `16`, `32`). */
    tilesize: number;
    /** 2-D array of tile indices. */
    data: number[][];
    /**
     * Atlas frame index of tile 1 for this layer's tileset strip (from
     * `game.assets.frames()` / `game.assets.loadFrames()`). Replaces raster's `tilesetName`
     * texture path — v2 tilesets are registered atlas strips. Default `0`.
     */
    firstFrame?: number;
    /** Tile the layer horizontally and vertically (for looping backgrounds). Default `false`. */
    repeat?: boolean;
    /** Parallax scroll factor — `1` locks to the world, `0.5` scrolls at half speed. Default `1`. */
    distance?: number;
    /** When `true`, this layer draws in front of sprites. Default `false`. */
    foreground?: boolean;
}
/** Complete level definition passed to `loadLevel()`. Export this from a level-editor tool or hand-author it. */
export interface LevelData {
    /** Sprites to spawn when the level loads. */
    sprites: LevelSpriteData[];
    /** Tile layers — one named `'collision'` for physics, the rest as visual tilemaps. */
    layer: LevelLayerData[];
}
/**
 * Populate `scene` from declarative `LevelData`: spawns sprites, builds a `CollisionGrid` from
 * the layer named `'collision'`, and creates a `Tilemap` for every other layer.
 * Replaces the scene's current sprites and maps — call from `setup()`.
 */
export declare function loadLevel(scene: Scene, data: LevelData): void;
/**
 * Look up a loaded map by its layer `name`. Pass `'collision'` to get the collision grid.
 * Returns `null` if no layer with that name exists.
 */
export declare function getMapByName(scene: Scene, name: string): CollisionGridLike | Tilemap | null;

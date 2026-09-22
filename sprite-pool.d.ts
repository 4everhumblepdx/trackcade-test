// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/**
 * SpritePool — object pool for recycling frequently-spawned sprites to avoid GC churn.
 *
 * Use for short-lived sprites that spawn and die at high frequency: bullets, coins, sparks,
 * explosions. Every Scene owns a default pool at `scene.pool`. Spawn a recyclable sprite with
 * `scene.pool.spawn(Bullet, x, y)` — it reuses a dead instance if one is available, else
 * constructs a fresh one. Spawning via the pool opts the class in, so killed instances return
 * here automatically for reuse (the scene's dead-sprite sweep hands them back).
 *
 * A plain `new Bullet()` + `scene.add(...)` always builds a fresh instance — the pool is the
 * opt-in path for recycling.
 */
import type { Sprite } from './sprite.js';
import type { Scene } from './scene.js';
/** Constructor signature required for a class to be spawned from a {@link SpritePool}.
 *  v2 sprites take their config object in the subclass constructor, so pooled classes
 *  must be constructible with no arguments. */
export type PooledClass = new () => Sprite;
/** A sprite with the optional pool re-arm hook. Implement `reset(x, y)` on a pooled
 *  subclass to re-initialise per-life state (velocity, timers, animation) when a
 *  recycled instance is spawned — the pool calls it after clearing `dead` and placing
 *  the sprite. Without it, the pool only sets `x`/`y` and clears `dead`. */
export interface PoolableSprite extends Sprite {
    /** Optional re-arm hook, called by {@link SpritePool.spawn} on every pooled spawn. */
    reset?(x?: number, y?: number): void;
}
/** Object pool that recycles sprite instances (bullets, coins, sparks) to avoid GC pressure. */
export declare class SpritePool {
    private readonly scene;
    /**
     * @param scene The scene this pool belongs to. Spawned sprites are added to this scene.
     */
    constructor(scene: Scene);
    /**
     * Spawn a sprite of `cls` at `(x, y)`, reusing a recycled instance when one is available.
     * Spawning via the pool opts the class in so its killed instances return here for reuse.
     * Configure per-spawn properties (speed, colour, etc.) on the returned sprite after calling this.
     * @param cls The sprite class to spawn. Must be constructible with no arguments.
     * @param x World x position (optional — omit to keep the sprite's config/current position).
     * @param y World y position.
     * @returns The spawned (or recycled) sprite instance, live in the scene.
     */
    spawn<T extends Sprite>(cls: new () => T, x?: number, y?: number): T;
    /**
     * Returns `true` if `cls` has been spawned from this pool and recycling is active for it.
     * Used internally to decide whether a killed sprite should be returned to the pool.
     */
    isEnabled(cls: PooledClass): boolean;
    /**
     * Return a killed sprite to the pool if its class has been spawned from here.
     * Called automatically by the scene when a dead sprite is swept. Returns `true` if recycled,
     * `false` if the class is not pooled (the caller should dispose it normally).
     */
    tryReturn(instance: Sprite): boolean;
    /**
     * Discard all recycled instances of `cls`, freeing their memory.
     * Fresh instances will be constructed on the next `spawn` call.
     */
    drain(cls: PooledClass): void;
    /**
     * Discard all recycled instances of every class in this pool, freeing their memory.
     * Use when resetting a level or scene — any live sprites are unaffected.
     */
    drainAll(): void;
}

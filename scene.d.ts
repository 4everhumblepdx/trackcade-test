// Docs: engine/webgpu/scenes.md, engine/webgpu/sprites.md — usage, recipes & traps (this file = exact type signatures)
import { Sprite } from './sprite.js';
import { Camera } from './camera.js';
import { type CollisionGridLike } from './collision-grid.js';
import type { Tilemap } from './tilemap.js';
import { SceneInput } from './scene-input.js';
import { SpritePool } from './sprite-pool.js';
import { VfxSystem } from './vfx.js';
import { Physics } from './physics.js';
import type { Contact } from './physics.js';
import type { Physics2d } from './physics2d.js';
import type { Draw } from './draw.js';
import type { Game } from './game.js';
import type { Preload } from './preload.js';
import type { Audio } from './audio.js';
import type { Tween } from './tween/index.js';
import type { EventDescriptor, EventFn, HitFn } from './glue.js';
/** Constructor type for a sprite class used in collision rules (`solid` / `on`). */
export type SpriteClass = abstract new (...args: never[]) => Sprite;
/** Constructor type for a Scene subclass — the roster holds these. */
export type SceneClass = new () => Scene;
/** The scene roster for Game.create: `play` is required; `title`, `gameOver`,
 * `intro` or any custom role key is optional (title/gameOver have built-in
 * fallbacks for goto targets). */
export type SceneRoster = {
    play: SceneClass;
} & Partial<Record<string, SceneClass>>;
export declare class Scene {
    /** The owning Game — set before setup(). Global services + game.go() live here. */
    game: Game;
    /** This scene's camera: follow a sprite, set bounds, shake(), or write x/y. */
    readonly camera: Camera;
    /**
     * Typed keyboard + pointer input for this scene. Bind actions with `this.input.bind({...})`,
     * then read `this.input.keys.<name>.held` / `.pressed` in `update()`.
     */
    readonly input: SceneInput;
    /**
     * The motion + collision system: gravity, worldBounds, effectors, joints, the
     * `solid(A, B)` solve and the `on(A, B)` overlap detection. Configure with
     * `this.physics.gravity = 360` and `this.physics.worldBounds = { x, y, w, h }`.
     */
    readonly physics: Physics;
    /**
     * Optional full-body physics world (Box2D v3). Assign one from
     * `await Physics2d.create(...)` in `setup()` and the scene steps and syncs it
     * for you each frame. Bound sprites are driven by the simulation; unbound
     * sprites keep using the arcade `physics`. `null` = no full-body physics (the
     * default — nothing is loaded).
     */
    physics2d: Physics2d | null;
    /** Downward acceleration in world units/s² applied to dynamic bodies (× sprite.gravity). Alias of `physics.gravity`. */
    get gravity(): number;
    set gravity(v: number);
    readonly sprites: Sprite[];
    /** The tile-based static collision map traced by physics. Defaults to the no-op grid (nothing blocks). */
    collisionMap: CollisionGridLike;
    /** Tilemap layers drawn as the scrolling background (and optional foreground layers). */
    backgroundMaps: Tilemap[];
    /** Object pool for recycling frequently-spawned sprites — `this.pool.spawn(Bullet, x, y)`. */
    readonly pool: SpritePool;
    /**
     * Object VFX — trails and one-shot bursts, all data: `sprite.vfx =
     * 'flameTrail'`, `this.vfx.burst('shockwave', x, y)`, or a manual
     * `this.vfx.trail(def)` you feed with point(). See vfx.md.
     */
    readonly vfx: VfxSystem;
    /** Declarative collision pairs and event listeners, set by the subclass from its `events/` folder. */
    events: EventDescriptor[];
    private solids;
    private ons;
    private _listeners;
    /** Resolves a sprite's default size from its first frame (wired by Game). */
    frameSizer: ((frame: number) => {
        w: number;
        h: number;
    }) | null;
    /** Wired by Game: the current view rect, for '%' config placement. */
    viewRect: (() => {
        x: number;
        y: number;
        w: number;
        h: number;
    }) | null;
    /** Add a sprite (returns it). Default w/h resolve from its first frame. */
    add<T extends Sprite>(sprite: T): T;
    /** Declare that instances of A and B can never overlap (walls, floors, crates).
     *  Pass `cb` to also react to each resolved contact (damage, sound, …). */
    solid(a: SpriteClass, b: SpriteClass, cb?: HitFn): void;
    /** Declare an overlap callback between instances of A and B (pickups, bullets, hits).
     *  The handler also receives the minimal-penetration `Contact` (side + overlap) —
     *  ignore it, or feed it to `this.physics.reflect(sprite, contact)`. */
    on(a: SpriteClass, b: SpriteClass, cb: (a: Sprite, b: Sprite, contact: Contact) => void): void;
    /** Listen for a named game event emitted by `emit()`. Typically declared via `on('name', fn)` in `events/`. */
    on(name: string, fn: EventFn): void;
    /** Fire a named game event — every listener registered for `name` runs synchronously with the scene and optional payload. */
    emit(name: string, payload?: unknown): void;
    /**
     * Declare assets to load BEFORE the scene runs — queue them on `load`
     * (`load.image(url)`, `load.json(url)`, `load.audio(url)`…); the engine
     * shows a progress bar while anything genuinely loads, then calls
     * `setup()`. Return a Promise to await custom async work. Skip entirely
     * for procedural (asset-free) scenes. Base is a no-op.
     */
    preload(_load: Preload): void | Promise<void>;
    /**
     * Build the scene — called once on transition, with any go() payload.
     * May be async: return a Promise (e.g. `await game.assets.msdfFont(...)`,
     * `await game.world3d(...)`, `await Physics2d.create(...)`) and the engine
     * keeps the loading screen up and awaits it before the scene first renders.
     */
    setup(_data?: unknown): void | Promise<void>;
    /** Screen-space UI — called every frame with the HUD draw surface. */
    drawHud(_d: Draw): void;
    /** Audio service — play synth SFX with `this.sound.play('hit')` or music with `this.sound.music(url)`. */
    get sound(): Audio;
    /** Tween service — animate any object property, e.g. `this.tween.to(sprite, { x: 200 }, { duration: 0.4 })`. */
    get tween(): Tween;
    /** All live sprites that are instances of `type`. */
    getSpritesByType<T extends Sprite>(type: abstract new (...args: never[]) => T): T[];
    /** A world X at fraction f across this frame's view (0 = left, 1 = right). */
    vw(f: number): number;
    /** A world Y at fraction f down this frame's view (0 = top, 1 = bottom). */
    vh(f: number): number;
    /** This frame's view width in world units. */
    get width(): number;
    /** This frame's view height in world units. */
    get height(): number;
    /** Horizontal centre of the view (world X). */
    get centerX(): number;
    /** Vertical centre of the view (world Y). */
    get centerY(): number;
    /** Transition to the scene registered as 'intro'. */
    gotoIntro(data?: unknown): void;
    /** Transition to the scene registered as 'title' (built-in fallback exists). */
    gotoTitle(data?: unknown): void;
    /** Transition to the scene registered as 'play'. */
    gotoPlay(data?: unknown): void;
    /** Transition to 'gameOver' — pass a result, e.g. { win: true, score } (built-in fallback exists). */
    gotoGameOver(result?: unknown): void;
    /** One update: behaviour → motion (physics) → joints → solids → overlaps → sweep dead. */
    update(dt: number): void;
    /**
     * Push the frame: background tilemaps → every sprite (scene order = paint order
     * unless z set) → foreground tilemaps. Raster's layer order preserved: maps draw
     * in `backgroundMaps` order, breaking to the sprite pass at the first
     * `foreground` map, which draws (with the rest) after the sprites.
     */
    draw(d: Draw): void;
}
/**
 * Separate two overlapping AABBs along the axis of least penetration.
 * static/none bodies never move; two dynamics split the correction.
 * Exported for tests.
 */
export declare function separate(a: Sprite, b: Sprite): void;

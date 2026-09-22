// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Per-Scene motion and collision system; owns gravity, worldBounds, the tile-collision trace, AABB overlap, and pure geometry helpers. Ported from the raster engine's proven Physics. */
import type { Scene } from './scene.js';
import type { Sprite } from './sprite.js';
import type { Effector } from './effectors.js';
import type { Joint } from './joints.js';
/** The collision contact descriptor — which side of sprite `b` the overlap was first detected on (minimal-penetration axis). */
export interface Contact {
    /** The side of `b` that `a` contacted. */
    side: 'top' | 'bottom' | 'left' | 'right';
    /**
     * Penetration depth (world units) along the contact axis — how far `a` has sunk into `b`.
     * `reflect()` pushes `a` out by this amount so a sustained overlap can't keep
     * re-triggering every frame (the classic "ball stuck inside the paddle").
     * Always set by the `on(A, B)` system; optional only for hand-built contacts,
     * where it defaults to no positional separation.
     */
    overlap?: number;
}
export declare class Physics {
    private readonly scene;
    /** Downward acceleration (world units/s²) applied to every body scaled by its `gravity` factor. Default `0` (no gravity). */
    gravity: number;
    /** World rectangle that bodies with `collideWorldBounds = true` are clamped inside. `null` = use the screen dimensions. */
    worldBounds: {
        x: number;
        y: number;
        w: number;
        h: number;
    } | null;
    /**
     * Continuous collision detection for the `on(A, B)` overlap checks. When `true`
     * (default), a pair whose discrete boxes miss is also swept along its relative
     * motion this frame, so a fast bullet can't tunnel through a thin sprite between
     * frames. The sweep only runs for pairs where a sprite moved more than half its
     * hitbox, so slow sprites cost nothing extra. Set `false` to force pure discrete
     * (per-frame) overlap — the cheapest path if you never have fast movers.
     */
    continuous: boolean;
    /**
     * Solid-solver relaxation passes per frame. Each pass re-checks every `solid(A, B)` pair,
     * so a push that drives one body into a third is handed down the chain within the same
     * frame (crate rows, small stacks). Passes stop early once nothing moves, and a finishing
     * pass always resolves contacts against static/kinematic bodies LAST, so residual overlap
     * only ever remains between dynamic bodies — never against a wall or floor. Raise for
     * taller stacks / longer push chains; `1` is the cheapest single pass. Default `4`.
     */
    solverIterations: number;
    /**
     * Spatial-hash grid cell size (world units) for the broad-phase overlap pass.
     * `null` (default) auto-sizes the grid from the average sprite size each frame.
     * The hash only engages on large scenes (many candidate pairs); small scenes
     * stay on the brute-force all-pairs scan, which is faster there. Set explicitly
     * to tune the grid for a known world (≈ the typical colliding-sprite size).
     */
    hashCellSize: number | null;
    /**
     * Force-field effectors active this scene — wind, conveyors, gravity wells, water. Each is applied
     * to every **dynamic** body during `updateBody` (static/kinematic/sensor bodies ignore them), after
     * the body's own velocity integration and before it moves.
     * Add one with {@link addEffector} (or push directly); remove with {@link removeEffector}. Empty by default.
     */
    effectors: Effector[];
    /**
     * Arcade joints active this scene — ropes, rods, grapples pinning a sprite to a point or
     * another sprite. Solved each frame after sprite updates and before collision (so the
     * solid pass sees constrained positions). Add with {@link addJoint}; remove with
     * {@link removeJoint}. A joint whose sprite (or anchor sprite) is killed removes itself.
     */
    joints: Joint[];
    constructor(scene: Scene);
    /** Returns the screen rectangle `{x:0,y:0,w,h}` — the default world bounds when `worldBounds` is null. */
    screenBounds(): {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /**
     * Add a force-field effector (wind / conveyor / gravity well / water) to the scene and return it,
     * so you can keep a reference to move or toggle it later. `this.physics.addEffector(new AreaEffector({…}))`.
     */
    addEffector<T extends Effector>(effector: T): T;
    /** Remove a previously-added effector. Returns `true` if it was present. */
    removeEffector(effector: Effector): boolean;
    /**
     * Add an arcade joint (rope / rod / grapple) to the scene and return it, so you can keep a
     * reference to reel (`joint.length`), re-hook (`joint.anchor`), or release it later.
     * `this.physics.addJoint(new Joint({ sprite, anchor, mode: 'rope' }))`.
     */
    addJoint<T extends Joint>(joint: T): T;
    /** Remove (release) a previously-added joint. Returns `true` if it was present. */
    removeJoint(joint: Joint): boolean;
    /**
     * Integrates one velocity axis for `dt` seconds under acceleration and friction, clamped to `±max`.
     * Use when you need raw velocity math outside a full body update.
     * @param vel Current velocity.
     * @param accel Acceleration to apply (0 = none).
     * @param friction Deceleration to apply when accel is 0 (0 = none).
     * @param max Maximum absolute velocity.
     * @param dt Delta-time in seconds.
     * @returns The new velocity after integration.
     */
    getNewVelocity(vel: number, accel: number, friction: number, max: number, dt: number): number;
    /**
     * Reflects a body's velocity off a collision contact — flips `vy` for top/bottom hits, `vx` for left/right hits.
     * Idempotent within a frame via the `_reflected` guard, so hitting multiple bricks at once reflects only once.
     * Use in an `on(A, B)` handler: `this.physics.reflect(ball, contact)`.
     */
    reflect(sprite: Sprite, contact: Contact): void;
    /**
     * Returns `true` when two sprites' AABB hitboxes overlap (position + size).
     * Use for manual overlap checks; the `on(A, B)` system calls this automatically each frame.
     * Synonyms: collision, overlap, intersect, hitbox test.
     */
    static touches(a: Sprite, b: Sprite): boolean;
    /**
     * Returns the distance (world units) between the centres of two sprites' bounding boxes.
     * Use for proximity checks, aggro ranges, or audio attenuation.
     */
    static distanceTo(a: Sprite, b: Sprite): number;
    /**
     * Returns the heading angle (radians, `atan2` convention) from `a`'s centre to `b`'s centre.
     * Use to aim a projectile or steer an enemy toward the player.
     */
    static angleTo(a: Sprite, b: Sprite): number;
    /**
     * Returns the minimal-penetration `Contact` for two overlapping sprites.
     * Provides the `side` (`'top'|'bottom'|'left'|'right'`) needed to call `reflect()` correctly.
     * Automatically provided as the third argument in `on(A, B, contact)` handlers.
     */
    static contactBetween(a: Sprite, b: Sprite): Contact;
    /**
     * Returns `true` when a body moved more than half its hitbox this frame — the
     * cheap test that decides whether a pair needs the swept (continuous) check.
     * A body that moves no further than its own half-extent always overlaps the
     * next frame's box, so nothing its own size or smaller can slip between samples.
     */
    static movedFast(s: Sprite): boolean;
    /**
     * Resolves one solid contact between two sprites, honouring their `body` types:
     * separates the pair along the minimal-penetration axis (dynamic↔dynamic split the push
     * 50/50; a dynamic takes the full push off a static/kinematic), resolves the velocity
     * along that axis (inelastic stop, or a rebound scaled by `bounce`), sets the `touching`
     * flags for both sides of the contact, and carries a rider standing on a kinematic body
     * by the platform's frame delta. Separation is propagated through solid-paired bodies in
     * the way, so the solver can never bury bodies in each other — a push the receiving side
     * can't absorb is handed back, and a kinematic whose push is refused (a chain jammed
     * against a wall) YIELDS by the remainder instead of crushing. Pairs containing a
     * `sensor` — and immovable-vs-immovable pairs — get no response. Called by
     * `checkOverlaps` for each touching `solid(A, B)` pair; call directly only for a
     * hand-rolled contact.
     */
    solveContact(a: Sprite, b: Sprite, contact: Contact, carry?: boolean, force?: boolean): void;
}

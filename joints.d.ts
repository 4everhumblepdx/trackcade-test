// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { Sprite } from './sprite.js';
import type { Vec2 } from './util.js';
/** How a {@link Joint} constrains the distance: `'rope'` only pulls (slack allowed), `'rod'` is rigid. */
export type JointMode = 'rope' | 'rod';
/** Config for a {@link Joint}. */
export interface JointOptions {
    /** The body pinned on the end of the joint. */
    sprite: Sprite;
    /**
     * What the other end is pinned to: a world point `{x, y}`, or a sprite — the joint
     * follows it, so a moving platform drags the pinned body along. Reassign at runtime
     * to re-hook.
     */
    anchor: Vec2 | Sprite;
    /** Rope/rod length in world units. Default: the anchor→sprite distance at creation. Set at runtime to reel in/out. */
    length?: number;
    /**
     * `'rope'` (default): pulls only when taut — hangs slack inside `length`, snaps tight at it.
     * `'rod'`: rigid — holds the sprite at exactly `length` (a stick pendulum).
     */
    mode?: JointMode;
    /** Pin offset from an anchor SPRITE's centre (world units) — hook a specific spot (a platform's underside). Default centre. */
    offset?: Vec2;
    /** Fraction of speed shed per second while the joint is engaged — makes a swing die down. Default `0` (swings forever). */
    damping?: number;
}
/**
 * A distance joint from a sprite's centre to an anchor — the arcade rope/rod. `'rope'` mode
 * hangs slack and only pulls when taut (grappling hooks, wrecking balls, hanging lamps on
 * chains); `'rod'` mode is rigid (stick pendulums). The anchor may be a moving sprite, which
 * drags the body along; `length` is live, so shrinking it reels the body in.
 */
export declare class Joint {
    /** The body pinned on the end. */
    sprite: Sprite;
    /** The other end: a world point or a sprite (live — reassign to re-hook). */
    anchor: Vec2 | Sprite;
    /** Current rope/rod length (world units). Set it to reel in or pay out. */
    length: number;
    /** `'rope'` (pull-only, slack allowed) or `'rod'` (rigid). */
    mode: JointMode;
    /** Pin offset from an anchor sprite's centre. */
    offset: Vec2;
    /** Fraction of speed shed per second while engaged. */
    damping: number;
    /** When `false`, the joint is skipped entirely (cheap on/off — release and re-grab a grapple). Default `true`. */
    enabled: boolean;
    /** `true` when the joint pulled this frame (rope at full stretch / rod always). Read for effects — rope tension sounds, sparks. */
    taut: boolean;
    constructor(opts: JointOptions);
    /** World position of the anchored end this frame (an anchor sprite's centre plus `offset`, or the fixed point). The returned object is reused — copy it if you keep it. */
    anchorPoint(): Vec2;
    /** Current anchor→sprite-centre distance (world units). Compare with `length` to read the slack. */
    distance(): number;
    /**
     * Solve one frame: project the sprite back onto the constraint and remove the radial
     * velocity component, relative to the anchor's own velocity, so tangential (swing)
     * motion is preserved. Called by `Physics.updateJoints` each frame between sprite
     * updates and the collision pass; call directly only if you drive the update loop
     * yourself.
     */
    update(dt: number): void;
}

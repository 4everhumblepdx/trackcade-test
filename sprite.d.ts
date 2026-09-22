// Docs: engine/webgpu/sprites.md — usage, recipes & traps (this file = exact type signatures)
import type { SpriteFx } from './fxbatch.js';
import type { Deform } from './gridbatch.js';
import type { VfxDef } from './vfx.js';
export interface AnimDef {
    /** Seconds per animation frame. */
    time: number;
    /** Frame OFFSETS within the sprite's strip (0-based). */
    seq: number[];
    /** Play once and hold the last frame (default: loop). */
    once?: boolean;
}
export interface SpriteConfig {
    /** First atlas frame index (from game.assets.frames()); default 0 = the white square. */
    frames?: number;
    /** Static frame offset within the strip (when not animating). */
    frame?: number;
    /** World units, or a view percentage ('34%' = that fraction across the
     * view when the sprite is add()ed — placement sugar, resolved once). */
    x?: number | `${number}%`;
    y?: number | `${number}%`;
    /** Draw + hitbox size in world units (default: the frame's natural pixel
     * size). Percentages resolve against the view ('80%' of view width). */
    w?: number | `${number}%`;
    h?: number | `${number}%`;
    /** Named animations (data, never hand-timed loops). */
    anims?: Record<string, AnimDef>;
    /** Animation to start playing (default: 'idle' if defined). */
    play?: string;
    /** Physics body type: `'dynamic'` (full physics, pushed by the solver — the default),
     * `'static'` (never moves), `'kinematic'` (scripted motion — no gravity/effectors,
     * pushes and carries dynamics), `'sensor'` (overlap detection only — never any
     * collision response), or `'none'` (skips physics entirely — user-moved). */
    body?: 'dynamic' | 'static' | 'kinematic' | 'sensor' | 'none';
    vx?: number;
    vy?: number;
    /** Per-frame velocity delta in world units per second squared. Physics adds this to `vel` every update. Useful for thrust, wind, or homing. Default `{ x: 0, y: 0 }`. */
    acceleration?: {
        x?: number;
        y?: number;
    };
    /** Deceleration in world units/s² that drags `vel` toward 0 on each axis (ground drag / air resistance). Applied only when that axis has no `acceleration`; higher values stop the sprite faster. Typical range ~100–1000. Default `{ x: 0, y: 0 }` (no friction). */
    friction?: {
        x?: number;
        y?: number;
    };
    /** Speed cap in world units per second per axis. Physics clamps `vel` to this after integration. The default is high (`{ x: 2000, y: 2000 }`) so gravity and acceleration are not silently throttled; lower it per sprite to set a terminal/top speed. */
    maxVelocity?: {
        x?: number;
        y?: number;
    };
    /** Multiplier on scene.gravity (default 1 for dynamic bodies). */
    gravity?: number;
    /** Restitution 0..1 on solid contacts (default 0). */
    bounce?: number;
    /** Minimum impact speed (world units per second) required for a bounce to occur. Prevents endless micro-bouncing at rest. Default 40. */
    minBounceVelocity?: number;
    /** Keep this body inside the physics world bounds (hard clamp — no tunnelling at any speed). Default false. */
    collideWorldBounds?: boolean;
    /** Per-edge world-bounds bounce. Set the edges that should reflect velocity; leave others unset to let the sprite pass through. E.g. a Breakout ball: `{ top: true, left: true, right: true }`. Independent of `collideWorldBounds`. Default null. */
    bounceEdges?: {
        top?: boolean;
        bottom?: boolean;
        left?: boolean;
        right?: boolean;
    } | null;
    tint?: string;
    alpha?: number;
    rot?: number;
    flipX?: boolean;
    /** Force the blend pass (translucent sprites route there automatically). */
    blend?: boolean;
    /** Tile the frame across the sprite: repeat counts per axis (default 1). */
    uvRepeat?: {
        x?: number;
        y?: number;
    };
    /** Scroll the texture inside the sprite, in frame fractions (mutate per frame for conveyors/parallax). */
    uvScroll?: {
        x?: number;
        y?: number;
    };
    /** Depth override (bigger = in front); default: scene order. */
    z?: number;
    /** Per-object effects — a stacking bag: { glow, outline, flash, shake, … }. */
    fx?: SpriteFx;
    /** Vertex-stage deformation (wave/sway/flip/jelly) — see draw.md. */
    deform?: Deform;
    /** Object VFX beyond the sprite's bounds — a trail streamed from its centre
     * ('flameTrail', 'sparkTrail'… or a VfxDef). Bursts trigger via scene.vfx. */
    vfx?: string | VfxDef;
}
export declare class Sprite {
    frames: number;
    frame: number;
    x: number;
    y: number;
    w: number;
    h: number;
    body: 'dynamic' | 'static' | 'kinematic' | 'sensor' | 'none';
    vel: {
        x: number;
        y: number;
    };
    /** Per-frame velocity delta in world units per second squared. Physics adds this to `vel` every update. Useful for thrust, wind, or homing. */
    acceleration: {
        x: number;
        y: number;
    };
    /** Deceleration in world units/s² that drags `vel` toward 0 on each axis (ground drag / air resistance). Applied only when that axis has no `acceleration`. */
    friction: {
        x: number;
        y: number;
    };
    /** Speed cap in world units per second per axis. Physics clamps `vel` to this after integration. */
    maxVelocity: {
        x: number;
        y: number;
    };
    gravity: number;
    bounce: number;
    /** Minimum impact speed (world units per second) required for a bounce to occur. Prevents endless micro-bouncing at rest. */
    minBounceVelocity: number;
    /** Keep this body inside the physics world bounds (hard clamp — no tunnelling at any speed). */
    collideWorldBounds: boolean;
    /** Per-edge world-bounds bounce. Set the edges that should reflect velocity; leave others unset to let the sprite pass through. */
    bounceEdges: {
        top?: boolean;
        bottom?: boolean;
        left?: boolean;
        right?: boolean;
    } | null;
    /** Position at the start of this frame's physics step — set by `Physics.updateBody`, read by the swept (CCD) checks and platform carry. */
    last: {
        x: number;
        y: number;
    };
    tint?: string;
    alpha: number;
    rot: number;
    flipX: boolean;
    blend: boolean;
    uvRepeat?: {
        x?: number;
        y?: number;
    };
    uvScroll?: {
        x?: number;
        y?: number;
    };
    z?: number;
    /** Set/clear at any time: sprite.fx = { glow: { color: '#ffd147' } } — effects stack. */
    fx?: SpriteFx;
    /** Set/clear at any time — mutate .phase for manual control (card flips). */
    deform?: Deform;
    /** Set/clear at any time: 'flameTrail' streams a ribbon from the centre; clearing fades it out. */
    vfx?: string | VfxDef;
    anims: Record<string, AnimDef>;
    /** Solid contacts this frame (set by the scene's solid() solver). */
    readonly touching: {
        up: boolean;
        down: boolean;
        left: boolean;
        right: boolean;
    };
    /** Set by kill(); the scene sweeps dead sprites at the end of the update. */
    dead: boolean;
    private animName;
    private animT;
    constructor(config?: SpriteConfig);
    /** Per-frame behaviour — override in subclasses. dt is display-frame seconds. */
    update(dt: number): void;
    /** Switch to a named animation (no-op if already playing it; `restart` to force). */
    play(name: string, restart?: boolean): void;
    /** The animation currently playing (null = static `frame`). */
    get playing(): string | null;
    /** True once a `once` animation has held its final frame. */
    get animDone(): boolean;
    /** Advance animation time (the scene calls this). */
    stepAnim(dt: number): void;
    /** The atlas frame to draw right now. */
    get drawFrame(): number;
    get centerX(): number;
    get centerY(): number;
    /** Remove this sprite at the end of the scene update. */
    kill(): void;
}
/** AABB overlap test (exported for game logic + tests). */
export declare function overlaps(a: Sprite, b: Sprite): boolean;

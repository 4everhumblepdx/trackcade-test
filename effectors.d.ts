// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { Sprite } from './sprite.js';
import type { Vec2 } from './util.js';
import type { Physics } from './physics.js';
/** How a {@link PointEffector}'s pull/push scales from its centre to the edge of its radius. */
export type Falloff = 'constant' | 'linear' | 'quadratic';
/**
 * Base class for the force-field effectors ({@link AreaEffector}, {@link SurfaceEffector},
 * {@link PointEffector}, {@link BuoyancyEffector}). Add one to a scene's physics with
 * `this.physics.addEffector(effector)`; each frame it applies a force to the **dynamic**
 * bodies inside its region (other body types ignore effectors). Toggle it with `enabled`,
 * or restrict which bodies it touches with `filter`.
 */
export declare abstract class Effector {
    /** When `false`, the effector is skipped entirely (cheap on/off switch). Default `true`. */
    enabled: boolean;
    /** Optional predicate — only sprites it returns `true` for are affected. Default: every body in the region. */
    filter?: (sprite: Sprite) => boolean;
}
/** Config for an {@link AreaEffector}. */
export interface AreaEffectorOptions {
    /** Region top-left X (world units). */
    x: number;
    /** Region top-left Y (world units). */
    y: number;
    /** Region width (world units). */
    w: number;
    /** Region height (world units). */
    h: number;
    /** Force as an acceleration `{x, y}` (world units/s²) added to every body whose centre is inside — wind, an updraft, a river current. */
    force: Vec2;
    /** Linear drag inside the region (fraction of velocity shed per second). `0` = none (default). Combine with `force` for a flow that pulls bodies toward a terminal speed. */
    drag?: number;
    /** Affect only sprites this returns `true` for. Default: all. */
    filter?: (sprite: Sprite) => boolean;
}
/**
 * A rectangular zone that pushes the bodies inside it in a constant direction — wind, an updraft,
 * a mid-air conveyor, a river current. `force` is an acceleration (like gravity), so every body is
 * pushed equally regardless of size. Add an optional `drag` to make it behave like a flowing medium
 * (bodies ease toward the flow speed instead of accelerating forever).
 */
export declare class AreaEffector extends Effector {
    x: number;
    y: number;
    w: number;
    h: number;
    /** Acceleration (world units/s²) applied to bodies in the region. Mutate at runtime to change the wind. */
    force: Vec2;
    /** Linear drag inside the region (fraction of velocity shed per second). */
    drag: number;
    constructor(opts: AreaEffectorOptions);
    apply(sprite: Sprite, dt: number): void;
}
/** Config for a {@link SurfaceEffector}. */
export interface SurfaceEffectorOptions {
    /** Region top-left X (world units). */
    x: number;
    /** Region top-left Y (world units). */
    y: number;
    /** Region width (world units). */
    w: number;
    /** Region height (world units). */
    h: number;
    /** Belt speed along X (world units/s) — positive carries bodies right, negative carries them left. */
    speed: number;
    /** How firmly the belt grips: the most a body's horizontal speed can change per second (world units/s²). Higher = snappier. Default `1200`. */
    grip?: number;
    /** Affect only sprites this returns `true` for. Default: all. */
    filter?: (sprite: Sprite) => boolean;
}
/**
 * A conveyor belt: a zone that carries the bodies in it toward a target horizontal `speed`. Unlike
 * {@link AreaEffector} (which keeps accelerating), the surface eases a body's X velocity *to* the
 * belt speed and holds it there, so a crate riding the belt travels at belt speed and stops being
 * pushed once it matches. Place the region as a thin band over the belt's surface (where the riding
 * bodies' centres sit).
 */
export declare class SurfaceEffector extends Effector {
    x: number;
    y: number;
    w: number;
    h: number;
    /** Belt speed along X (world units/s); positive = right. Mutate to reverse or speed up the belt. */
    speed: number;
    /** Max change to a body's horizontal speed per second (world units/s²). */
    grip: number;
    constructor(opts: SurfaceEffectorOptions);
    apply(sprite: Sprite, dt: number): void;
}
/** Config for a {@link PointEffector}. */
export interface PointEffectorOptions {
    /** Point X (world units). */
    x: number;
    /** Point Y (world units). */
    y: number;
    /** Bodies within this distance of the point are affected. */
    radius: number;
    /** Acceleration magnitude (world units/s²). **Positive REPELS** (pushes away — an explosion or fan); **negative ATTRACTS** (pulls in — a gravity well or magnet). */
    force: number;
    /** How the force scales from the centre to the edge of the radius: `'constant'` (uniform), `'linear'` (`1 − d/r`, default), `'quadratic'` (`(1 − d/r)²`, a soft falloff that's gentle at the rim and strong in the middle). */
    falloff?: Falloff;
    /** Linear drag inside the radius (fraction of velocity shed per second). `0` = none (default). Add a little to make orbits decay / debris settle. */
    drag?: number;
    /** Affect only sprites this returns `true` for. Default: all. */
    filter?: (sprite: Sprite) => boolean;
}
/**
 * A point that attracts or repels every body within `radius` — a gravity well, a magnet, a tractor
 * beam, or (with a positive `force`) an explosion shockwave. The force points along the line between
 * the body and the point; `falloff` controls how it weakens with distance. Move `x`/`y` at runtime
 * to drag the well around, or flip `force`'s sign to switch between pulling and pushing.
 */
export declare class PointEffector extends Effector {
    x: number;
    y: number;
    radius: number;
    /** Acceleration magnitude (world units/s²); positive repels, negative attracts. */
    force: number;
    falloff: Falloff;
    /** Linear drag inside the radius (fraction of velocity shed per second). */
    drag: number;
    constructor(opts: PointEffectorOptions);
    apply(sprite: Sprite, dt: number): void;
}
/** Config for a {@link BuoyancyEffector}. */
export interface BuoyancyEffectorOptions {
    /** Fluid volume top-left X (world units). */
    x: number;
    /** Fluid volume top-left Y (world units). */
    y: number;
    /** Fluid volume width (world units). */
    w: number;
    /** Fluid volume height (world units). */
    h: number;
    /** Y of the fluid surface — bodies dipping below it get lift. Default = the volume top (`y`). */
    surfaceLevel?: number;
    /** Buoyancy strength relative to gravity: a body settles at submerged-fraction `1/density`, so `1` floats just under the surface, `2` floats half-out, `<1` sinks. Default `1`. */
    density?: number;
    /** Fluid resistance — fraction of velocity shed per second while submerged (damps the bobbing). Default `4`. */
    drag?: number;
    /** Optional current: an acceleration `{x, y}` (world units/s²) applied while submerged — a river, a riptide. */
    flow?: Vec2;
    /** Affect only sprites this returns `true` for. Default: all. */
    filter?: (sprite: Sprite) => boolean;
}
/**
 * A body of fluid (water, lava, slime) that makes the bodies dipping into it float. A submerged body
 * gets an upward lift proportional to how deep it is and to `density`, so it decelerates as it sinks,
 * rises back, and settles at the surface — `drag` damps the bob into a gentle float. Buoyancy works
 * *against gravity*, so the scene needs `physics.gravity > 0`. Add a `flow` for a current that carries
 * floating bodies along.
 */
export declare class BuoyancyEffector extends Effector {
    x: number;
    y: number;
    w: number;
    h: number;
    /** Y of the fluid surface. */
    surfaceLevel: number;
    density: number;
    /** Fluid resistance (fraction of velocity shed per second while submerged). */
    drag: number;
    /** Optional current (acceleration, world units/s²) applied while submerged, or `null`. */
    flow: Vec2 | null;
    constructor(opts: BuoyancyEffectorOptions);
    apply(sprite: Sprite, dt: number, physics: Physics): void;
}

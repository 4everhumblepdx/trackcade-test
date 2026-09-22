// Docs: engine/webgpu/visibility2d.md — usage, recipes & traps (this file = exact type signatures)
/**
 * 2D VISIBILITY / line-of-sight against real scenery — pure CPU geometry, zero
 * engine dependency. Import it directly (`import { Visibility2d } from
 * '../engine/webgpu.js'`); it is NOT wired into `Game`.
 *
 * The NON-grid counterpart to `FogGrid`: shadows thrown by actual line-segment
 * occluders (walls, crates, polygons), not tiles. From a light/eye point it
 * computes the **visibility polygon** — the exact lit area, with hard shadows
 * behind occluders (the classic top-down-2D "throw a light and it casts shadows
 * off the scenery" look). Feed that polygon to a renderer (fill it, one light
 * per colour, additive), or use the detection queries directly:
 * `canSee(a, b)` for "can the guard see the player?" and `raycast()` for the
 * first thing a ray hits.
 *
 * Algorithm (redblobgames.com/articles/visibility): cast rays to every occluder
 * corner (± a hair, to slip past edges), keep the nearest hit per ray, and sort
 * the hits by angle into a fan around the light. Add world `bounds` (or a
 * `maxDist`) so rays always terminate.
 */
import type { Vec2 } from './util.js';
/** An occluder edge — a line segment `(x1,y1)–(x2,y2)` that casts shadow. */
export interface Segment {
    /** Start X. */ x1: number;
    /** Start Y. */ y1: number;
    /** End X. */ x2: number;
    /** End Y. */ y2: number;
}
/** A ray hit: the point and the distance along the ray. */
export interface RayHit2d {
    /** Hit X. */ x: number;
    /** Hit Y. */ y: number;
    /** Distance from the ray origin to the hit. */ dist: number;
}
/**
 * A set of 2D occluders you query for visibility and line-of-sight. Add
 * scenery as segments / rects / polygons (and a world `bounds`), then call
 * `visibility(x, y)` for the lit polygon or `canSee` / `raycast` for detection.
 * Add/remove occluders freely between frames — there's no bake.
 *
 * ```ts
 * const vis = new Visibility2d();
 * vis.setBounds(0, 0, worldW, worldH);          // rays terminate at the edges
 * for (const c of crates) vis.addRect(c.x, c.y, c.w, c.h);
 * const poly = vis.visibility(light.x, light.y, light.radius);   // lit-area polygon → render it
 * if (vis.canSee(guard.x, guard.y, player.x, player.y)) alert();  // line-of-sight
 * ```
 */
export declare class Visibility2d {
    /** The occluder segments (excludes the world bounds — those live separately). */
    readonly segments: Segment[];
    private bx;
    private by;
    private bw;
    private bh;
    private hasBounds;
    constructor(bounds?: {
        x: number;
        y: number;
        w: number;
        h: number;
    });
    /** Set the world rectangle — rays that hit no occluder stop at these edges
     *  (so `visibility` always closes into a polygon). */
    setBounds(x: number, y: number, w: number, h: number): void;
    /** Add one occluder segment; returns it (mutate or keep a reference). */
    addSegment(x1: number, y1: number, x2: number, y2: number): Segment;
    /** Add a box occluder (its four edges). */
    addRect(x: number, y: number, w: number, h: number): void;
    /** Add a polygon occluder from points (`[{x,y}…]` or flat `[x,y,…]`). Closed
     *  by default (the last point links back to the first). */
    addPoly(points: ReadonlyArray<Vec2> | ReadonlyArray<number>, closed?: boolean): void;
    /** Remove all occluders (bounds are kept). */
    clear(): void;
    /**
     * The visibility polygon from `(lx, ly)` — the ordered fan of points bounding
     * the lit area, with hard shadows behind occluders. Clamped to `maxDist` (the
     * light radius) when given. Render it as a triangle fan from the light, or
     * read it for custom shading. Empty only if there's no geometry to hit.
     */
    visibility(lx: number, ly: number, maxDist?: number): Vec2[];
    /**
     * Direct line-of-sight — `true` if no occluder segment crosses the line from
     * `(ax,ay)` to `(bx,by)`. The AI "can the guard see the player?" test; pass
     * `maxDist` to cap the range. Ignores the world bounds (they enclose, not block).
     */
    canSee(ax: number, ay: number, bx: number, by: number, maxDist?: number): boolean;
    /**
     * The first occluder (or bounds) a ray hits from `(ox,oy)` heading
     * `(dirX,dirY)`. Returns `{x, y, dist}` or `null` if nothing is hit within
     * `maxDist`. Direction need not be normalised.
     */
    raycast(ox: number, oy: number, dirX: number, dirY: number, maxDist?: number): RayHit2d | null;
}

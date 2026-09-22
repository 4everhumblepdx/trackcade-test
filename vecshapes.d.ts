// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { VecPt } from './vector.js';
/**
 * How many segments an arc of this sweep needs to read as a curve — one per
 * ~11°, minimum 1. Every arc here uses it when `steps` is omitted.
 *
 * It is purely ANGULAR, so it takes no view of radius: a huge circle gets the
 * same 32 segments as a tiny one and reads as faceted, while a narrow ring
 * section gets only two. Pass an explicit `steps` in both cases — up for a
 * smooth curve at a large radius, down for deliberate chunky chords.
 */
export declare function arcSteps(sweep: number): number;
/**
 * Points along a circular arc from `from` to `to` radians — the retained path.
 *
 * ```ts
 * const shield = game.vector.shape(
 *   vectorKit.arcPoints(0, 0, 120, -0.4, 0.4),
 *   { x: cx, y: cy, closed: false, color: '#41d6ff' },
 * );
 * ```
 *
 * Returns `steps + 1` points. Build the arc about the ORIGIN and put the centre
 * in the shape's `x`/`y` if you want it to rotate — a shape spins about its own
 * origin, so an arc built at `(cx, cy)` would orbit instead of turning in place.
 *
 * `layer.arc()` is the immediate shortcut over the top of this.
 */
export declare function arcPoints(cx: number, cy: number, r: number, from: number, to: number, steps?: number): Array<{
    x: number;
    y: number;
}>;
/** Tuning for `ringSections`. */
export interface RingSectionOptions {
    /** Gap between neighbouring sections in radians (default 0.14). */
    gap?: number;
    /** Segments per section (default: derived from the sweep by `arcSteps`). */
    steps?: number;
    /** Where the first section starts (default -PI/2 — straight up). */
    from?: number;
    /** Total sweep the sections divide (default a full turn). */
    span?: number;
}
/** One section of a segmented ring. */
export interface RingSection {
    /** The arc outline — hand it straight to `shape()` or `poly()`. */
    points: Array<{
        x: number;
        y: number;
    }>;
    /** Start and end angle in radians, MONOTONIC (`to` > `from`, never wrapped)
     *  so `arcHit` can test the span without unwrapping anything. */
    from: number;
    to: number;
    /** 0-based, clockwise from `opts.from`. */
    index: number;
}
/**
 * Cut a ring into `count` separately drawable sections — Star Castle's shields.
 *
 * ```ts
 * const shields = vectorKit.ringSections(0, 0, 140, 12, { gap: 0.16 })
 *   .map((s) => ({ ...s, shape: game.vector.shape(s.points, { x: cx, y: cy, closed: false }) }));
 * ```
 *
 * Each section is its OWN point array, so each becomes its own `VectorShape`
 * and can `shatter()` while its neighbours keep turning. Build at the origin
 * and carry the centre on the shapes, so the whole ring rotates as one.
 */
export declare function ringSections(cx: number, cy: number, r: number, count: number, opts?: RingSectionOptions): RingSection[];
/**
 * Is `(px, py)` ON an arc — within `tol` of the radius AND inside the sweep?
 *
 * The hit test segmented rings need: a shot only kills the shield section it
 * actually crossed. Test in the ring's LOCAL space — subtract the centre and
 * rotate the point by `-ring.rot` first, so a spinning ring needs no
 * per-section bookkeeping.
 */
export declare function arcHit(cx: number, cy: number, r: number, from: number, to: number, px: number, py: number, tol?: number): boolean;
/** A web silhouette. `vee` is the open one; the rest close into a loop. */
export type TubeProfile = 'circle' | 'square' | 'plus' | 'vee' | 'star';
/** Tuning for `generateTube`. */
export interface TubeOptions {
    /** Playable lanes around the web (default 16). */
    lanes?: number;
    /** Rim silhouette (default 'circle'). */
    profile?: TubeProfile;
    /** Near-rim centre in world units (default 0, 0). */
    x?: number;
    y?: number;
    /** Near-rim radius (default 300) — the rim in the player's face. */
    near?: number;
    /** Far-rim radius (default `near * 0.3`). Smaller = a deeper tube. */
    far?: number;
    /** The vanishing point — the far rim's centre (default the near centre).
     *  Offset it and the tube leans away instead of receding straight back. */
    vanishX?: number;
    vanishY?: number;
    /** Spin the whole web about its centre, radians (default 0). */
    rot?: number;
    /** Force the loop open or closed. Default: the profile decides ('vee' is
     *  open, the rest close), which is also whether lane 0 and lane n-1 are
     *  neighbours — i.e. whether the player wraps. */
    closed?: boolean;
}
/** Where something on a lane sits, faces, and how big to draw it. */
export interface LanePose {
    x: number;
    y: number;
    /** Facing OUT of the tube (from the far rim toward the near one) — the
     *  direction an enemy is travelling, and the way a rim ship points. */
    angle: number;
    /** 1 on the near rim, `far / near` at the vanishing end. Multiply sprite or
     *  line size by it and things shrink correctly as they climb. */
    scale: number;
}
/** A generated web. `nearRim`/`farRim`/`spokes` draw it; `laneAt` plays it. */
export interface Tube {
    /** Playable lanes (NOT the vertex count — an open web has one more vertex). */
    lanes: number;
    closed: boolean;
    nearRim: VecPt[];
    farRim: VecPt[];
    /** Near vertex → far vertex, one per rim vertex. */
    spokes: Array<[VecPt, VecPt]>;
    /** Rim VERTEX `i` at depth `t` (0 = near, 1 = far). Wraps when closed. */
    rimAt(i: number, t: number): VecPt;
    /**
     * Rim position at a CONTINUOUS vertex parameter — `u` 0..lanes, sliding along
     * the rim rather than hopping vertex to vertex. `rimPointAt(2.5, 0)` is
     * halfway along the near rim's third edge. Wraps or clamps like everything
     * else. This is the glide primitive; `laneAt` is built on it.
     */
    rimPointAt(u: number, t: number): VecPt;
    /**
     * The middle of LANE `lane` at depth `t` — position, facing and scale.
     *
     * `lane` is CONTINUOUS: whole numbers sit in the middle of a lane, and
     * everything between glides smoothly along the rim (round corners included),
     * so a claw can slide rather than snap. `t` runs 0 (near rim) to 1 (far).
     */
    laneAt(lane: number, t: number): LanePose;
    /** Bring a lane position into range — wraps on a closed web, clamps on an
     *  open one. Feed a fractional lane through this after moving it. */
    wrapLane(v: number): number;
    /** Signed lane distance `from` → `to`, taking the SHORT way round a closed
     *  web (lane 15 → lane 0 of 16 is +1, not -15). Steering and AI both need
     *  this; getting it wrong makes things scurry the long way round. */
    laneDelta(from: number, to: number): number;
    /** Move a lane position toward `to` by at most `maxStep` lanes, the short way
     *  round, never overshooting — one frame of a smooth glide.
     *
     *  Steps in LANES, so on a profile whose lanes differ in length this changes
     *  speed as it goes. Use `glide` to move at a constant speed instead. */
    stepLane(from: number, to: number, maxStep: number): number;
    /** Total near-rim length in world units — the closing edge included when the
     *  web is closed. `perimeter / speed` is how long one lap takes. */
    perimeter: number;
    /** Near-rim length of lane `i` in world units. Equal for a circle or a
     *  square; 2:1 between a star's longest and shortest. */
    laneLength(i: number): number;
    /**
     * Move a lane position along the rim by `dist` WORLD UNITS, signed, wrapping
     * or clamping like `wrapLane`. This is the constant-speed step:
     *
     * ```ts
     * lane = web.advance(lane, dir * 880 * dt);   // 880 world units per second,
     * ```                                         // on every profile alike
     *
     * where `wrapLane(lane + dir * n * dt)` would have moved at `n` lanes per
     * second and so sped up and slowed down around the rim.
     */
    advance(lane: number, dist: number): number;
    /** Signed rim DISTANCE `from` → `to` in world units, the short way round —
     *  `laneDelta` measured in world units instead of lanes. */
    arcDelta(from: number, to: number): number;
    /** Move toward `to` by at most `maxDist` WORLD UNITS, the short way round,
     *  never overshooting. The constant-speed twin of `stepLane`. */
    glide(from: number, to: number, maxDist: number): number;
    /** Where `lane` sits on the circle, radians about the web's centre. */
    angleOf(lane: number): number;
    /** The lane at a given angle on the circle — the inverse of `angleOf`, and
     *  the whole of mouse steering: `laneAtAngle(atan2(my - cy, mx - cx))`. */
    laneAtAngle(angle: number): number;
    /** Turn `dAngle` radians round the circle — **positive is clockwise on
     *  screen**, on every profile alike. Clamps at the ends of an open web.
     *
     *  This paces by ANGLE, so on a star the claw covers more ground near a spike
     *  tip than in a notch. `steer` paces by DISTANCE instead and holds one
     *  speed — prefer it for a player-controlled ship. */
    turn(lane: number, dAngle: number): number;
    /** The angles the rim actually spans. A full turn when closed; on an open web
     *  the reachable arc, past which `turn` and `laneAtAngle` clamp. */
    angleSpan: {
        from: number;
        to: number;
    };
    /** The lane at the BOTTOM of the web — where a tube game's ship starts.
     *
     *  Not a detail: Tempest and everything after it put the ship at the bottom
     *  middle, and the whole feel of the controls is calibrated from there. Start
     *  it at the top and every profile plays inverted. */
    bottom: number;
    /**
     * Move a ship `dist` world units the way the PLAYER reads it — **positive is
     * to their right** — at one constant speed whatever the rim is doing.
     *
     * ```ts
     * lane = web.steer(lane, dir * 880 * dt);      // dir: -1 left, +1 right
     * ```
     *
     * This is `advance` with the sign sorted out. Some silhouettes wind clockwise
     * on screen and some anticlockwise, so "forward along the path" is rightward
     * on one and leftward on the next; `steer` folds in that single build-time
     * winding so left is left on all of them.
     *
     * Read at the BOTTOM, where the ship lives. A ring has no global left and
     * right — carry on far enough round and the ship is climbing the far side, at
     * which point the screen direction is reversed. Every tube game does this.
     */
    steer(lane: number, dist: number): number;
    /** The fractional lane nearest a world point — mouse and spinner control.
     *  `laneAt(laneOf(x, y), 0)` lands on the rim under the cursor. */
    laneOf(x: number, y: number): number;
}
/**
 * Build a tube playfield.
 *
 * ```ts
 * const web = vectorKit.generateTube({ x: cx, y: cy, near: 300, far: 80, lanes: 16, profile: 'star' });
 * game.vector.poly(web.nearRim, { color: '#41d6ff' }, web.closed);
 * game.vector.poly(web.farRim,  { color: '#2a4a7a' }, web.closed);
 * for (const [a, b] of web.spokes) game.vector.seg(a.x, a.y, b.x, b.y, { color: '#2a4a7a' });
 *
 * const p = web.laneAt(playerLane, 0);        // the claw, on the near rim
 * const e = web.laneAt(enemyLane, enemyT);    // a flipper, climbing out
 * ```
 *
 * The geometry is STATIC — generate once per level, not per frame. Only
 * `laneAt` runs in the loop, and it is a lerp and an atan2.
 */
export declare function generateTube(opts?: TubeOptions): Tube;
/** A point in 3D world space (x right, y up, z forward). */
export interface Vec3 {
    x: number;
    y: number;
    z: number;
}
/** A wireframe model: shared points, plus the index pairs that join them. */
export interface WireModel {
    points: Vec3[];
    edges: Array<[number, number]>;
}
/** Where the camera is and which way it is looking. */
export interface WireCamera {
    x: number;
    y: number;
    z: number;
    /** Heading in radians — 0 looks along +z, increasing turns RIGHT. */
    yaw?: number;
    /** Tilt in radians — increasing looks UP. */
    pitch?: number;
    /** Vertical field of view in radians (default 1.05, about 60°). */
    fov?: number;
}
/** The screen rect to project into (world units — usually `game.view`). */
export interface WireView {
    w: number;
    h: number;
    /** Nothing closer than this is drawn (default 1). Keeps the divide sane. */
    near?: number;
}
/** One projected edge, with the depth at each end so width can taper. */
export interface WireEdge {
    a: {
        x: number;
        y: number;
    };
    b: {
        x: number;
        y: number;
    };
    /** Distance in front of the camera at each end, AFTER near-plane clipping. */
    za: number;
    zb: number;
}
/**
 * Pixels per world unit at one unit of depth. Divide by an edge's `za`/`zb` for
 * the scale at that end — the whole of perspective in one number.
 *
 * ```ts
 * const f = vectorKit.focalLength(view);
 * layer.seg(e.a.x, e.a.y, e.b.x, e.b.y, { width: Math.max(0.4, 3 * f / e.za / 40) });
 * ```
 */
export declare function focalLength(view: WireView, fov?: number): number;
/**
 * Project ONE world point to the screen, or `null` if it is behind the near
 * plane. Handy for placing 2D things (labels, a targeting box, a sprite) on a
 * 3D position without projecting a whole model.
 */
export declare function projectPoint(p: Vec3, cam: WireCamera, view: WireView): {
    x: number;
    y: number;
    z: number;
} | null;
/**
 * Project a wireframe model to 2D segments, near-plane clipped.
 *
 * ```ts
 * for (const e of vectorKit.project(tank, cam, view)) {
 *   game.vector.seg(e.a.x, e.a.y, e.b.x, e.b.y, { color: '#41d6ff', width: 3 * f / e.za });
 * }
 * ```
 *
 * An edge straddling the near plane is CUT at it rather than dropped, so
 * geometry doesn't pop out of existence as you walk into it — the one thing a
 * naive projector always gets wrong (divide by a negative z and the edge
 * whips across the screen backwards).
 */
export declare function project(model: WireModel, cam: WireCamera, view: WireView): WireEdge[];
/**
 * The ground line — where a flat plane at infinite distance lands on screen.
 *
 * It depends only on `pitch` (yaw slides along it, and there is no roll), so it
 * is a horizontal line at `h/2 + f·tan(pitch)`. Draw it first and everything
 * else sits in a world.
 */
export declare function horizon(cam: WireCamera, view: WireView): [{
    x: number;
    y: number;
}, {
    x: number;
    y: number;
}];
/**
 * A wireframe box centred on `(cx, cy, cz)` — eight points and twelve edges of
 * pure boilerplate, and the staple obstacle of every first-person vector game.
 */
export declare function wireBox(w: number, h: number, d: number, cx?: number, cy?: number, cz?: number): WireModel;
/** A model's axis-aligned extent, and the size and centre it implies. */
export interface WireBounds {
    min: Vec3;
    max: Vec3;
    size: Vec3;
    center: Vec3;
}
/**
 * Measure a model: the corners of its axis-aligned box, and the size and centre
 * they imply. For a cheap distance cull, or for scaling something to fit.
 *
 * To stand a model on the ground use `placeModelOnGround`, which does the sum
 * for you.
 */
export declare function wireBounds(model: WireModel): WireBounds;
/**
 * Move and turn a model without touching the original — the way you place many
 * copies of one shape, or drive a tank around. `yaw` turns it about its own
 * vertical axis first, then it is offset to `(x, y, z)`.
 *
 * `y` positions the model's OWN ORIGIN, wherever the model happens to keep it.
 * If what you want is for the thing to stand on the floor, reach for
 * `placeModelOnGround` and give it no `y` at all.
 */
export declare function placeModel(model: WireModel, x: number, y: number, z: number, yaw?: number): WireModel;
/**
 * Stand a model on the ground at `(x, z)` — the placement a first-person
 * wireframe scene actually wants.
 *
 * ```ts
 * const block = vectorKit.placeModelOnGround(vectorKit.wireBox(120, 280, 90), 900, -1400);
 * const tank  = vectorKit.placeModelOnGround(TANK, tx, tz, heading);
 * ```
 *
 * No height to work out and none to get wrong. Models keep their origin
 * wherever suits them — `wireBox` about its centre, a hand-built pyramid at its
 * base — so "put it at y = 0" means different things for different models and
 * silently buries the ones built about their middle. This asks each model where
 * its own floor is and drops it exactly there, so a box, a pyramid and a
 * multi-part tank all land flush without the caller knowing how any of them
 * were built.
 *
 * `groundY` moves the floor; `yaw` turns the model about its vertical axis,
 * which cannot change how tall it is, so it stays flush at any heading.
 */
export declare function placeModelOnGround(model: WireModel, x: number, z: number, yaw?: number, groundY?: number): WireModel;
/**
 * A ground grid as a wireframe model — `n` lines each way at `step` apart,
 * centred on `(cx, cz)` at height `y`. The cheapest way to make a first-person
 * scene feel like it has a floor.
 */
export declare function wireGrid(n: number, step: number, y?: number, cx?: number, cz?: number): WireModel;
/** The most vertices a Box2D polygon shape can hold (B2_MAX_POLYGON_VERTICES). */
export declare const MAX_HULL_POINTS = 8;
/**
 * The convex hull of a point set (monotone chain), counter-clockwise in
 * standard axes — which is CLOCKWISE on screen, y being down.
 *
 * Fewer than three distinct points comes back as-is; collinear points are
 * dropped.
 */
export declare function convexHull(points: readonly VecPt[]): VecPt[];
/**
 * Reduce a CONVEX outline to at most `max` vertices, dropping the ones that
 * cost the least area — so the silhouette survives as well as it can.
 *
 * This is the step that stops an 11-point asteroid becoming a null Box2D
 * shape. Run `convexHull` first; on a concave input the areas are meaningless.
 */
export declare function simplifyHull(points: readonly VecPt[], max?: number): VecPt[];
/**
 * Outline → a point list Box2D will actually accept: convex, at most
 * `MAX_HULL_POINTS` vertices, in the shape's own local frame.
 *
 * **Do not re-centre the result on its centroid.** Box2D computes centroid,
 * mass and inertia from the polygon in body-local space, so passing the raw
 * local points keeps the drawn outline and the collision shape registered.
 * Re-centring looks tidier and is the bug — a shape that spins about a point
 * it isn't drawn around.
 */
export declare function hullFor(points: readonly VecPt[], max?: number): VecPt[];
/**
 * Split a simple polygon into CONVEX pieces (ear clipping, then merging ears
 * back together while the join stays convex and within `max` vertices).
 *
 * The honest way to give a concave silhouette — a ship, a plus, a letter — real
 * collision instead of the hull's approximation: each piece becomes its own
 * Box2D polygon on ONE body, so the notch is a notch.
 *
 * Returns `[points]` unchanged when the outline is already convex and short
 * enough, so the cheap case stays cheap.
 */
export declare function convexPieces(points: readonly VecPt[], max?: number): VecPt[][];
/** True if every turn goes the same way (a convex simple polygon). */
export declare function isConvex(p: readonly VecPt[]): boolean;
/**
 * Ear-clipping triangulation of a simple polygon — index triples into
 * `points`. Handles concave outlines and either winding; no holes, no
 * self-intersection. Degenerate input fans the remainder rather than looping.
 *
 * This is what turns a vector OUTLINE into a filled face. It lives here rather
 * than being borrowed from the 3D geometry module because the vector layer
 * must never pull in the 3D chunk.
 */
export declare function triangulate(points: readonly VecPt[]): Array<[number, number, number]>;

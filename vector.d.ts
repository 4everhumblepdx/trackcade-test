// Docs: engine/webgpu/vector.md — usage, recipes & traps (this file = exact type signatures)
import { type VecTextOptions } from './vecfont.js';
export declare const LINE_FLOATS = 24;
export declare const FILL_FLOATS = 8;
export declare const XFORM_FLOATS = 8;
/** Assemble the line shader (pure string work — dist-tested). Two variants:
 * the SCENE shader draws crisp AA cores only, and the STAMP shader feeds the
 * shared GlowPass (soft tinted cores into the half-res blur target — glow as
 * a POST pass: in-shader halos couldn't join at polyline corners, a blurred
 * image of the finished lines joins perfectly, and the quads shrink to core
 * size). */
export declare function buildLineWGSL(stamp?: boolean): string;
/**
 * The FILL shader — solid faces under the line art.
 *
 * A triangulated outline, one vertex at a time: local position, the shape's
 * transform slot, a depth, and a colour PER VERTEX (which is what gives the
 * gradient — no extra uniform, no second pass). It shares the same `xf`
 * transform table as the lines, so a filled shape moves for the same 8 floats.
 *
 * Depth is the point of it. The fill pass WRITES depth where the line pass
 * only tests it, so a nearer filled shape hides both the fills and the lines
 * behind it — corridors, Elite hulls, a Tempest web with solid lanes.
 */
export declare function buildFillWGSL(): string;
export interface VecPt {
    x: number;
    y: number;
}
/** A clip rectangle in WORLD units. */
export interface VecClipRect {
    x: number;
    y: number;
    w: number;
    h: number;
}
/**
 * World clip rect → an integer pixel scissor on a `pxW × pxH` target, given the
 * view rect the layer was begun with. `null` = nothing of the rect is on the
 * target, so the whole draw can be skipped.
 *
 * Pure so both backends share it AND so the half-res glow target gets the same
 * arithmetic — a halo clipped to a different rectangle than its line is the
 * bug this exists to prevent.
 */
export declare function clipToScissor(clip: VecClipRect, viewX: number, viewY: number, viewW: number, viewH: number, pxW: number, pxH: number): {
    x: number;
    y: number;
    w: number;
    h: number;
} | null;
/** Expand a polyline into segment endpoint pairs (closed joins last→first). */
export declare function polySegs(points: readonly VecPt[], closed?: boolean): Array<[VecPt, VecPt]>;
/**
 * Where each segment of a chain should stop, so neighbours ABUT instead of
 * overlapping — four floats per segment, matching `polySegs` order.
 *
 * Each segment end carries the inward normal of the plane it is cut on: the
 * two segments meeting at a joint share one plane, the ANGLE BISECTOR, and
 * take opposite sides of it. Between them they still tile the whole join —
 * each contributes half of the round cap — so the picture is unchanged while
 * every pixel is painted exactly once.
 *
 * That is the difference between this and cutting each segment square across
 * its own end, which is the obvious thing to try and notches every corner: two
 * perpendicular cuts leave an uncovered wedge between them, whereas one shared
 * plane has no space between its two sides.
 *
 * Painting once is what makes ALPHA work on an outline. Overlapping caps blend
 * twice, so at `alpha` 0.35 a joint reaches 1 − 0.65² = 0.58 while the rest of
 * the line sits at 0.35, and every corner beads. Fully opaque lines never
 * showed it, because drawing the same colour over itself changes nothing.
 *
 * A free end — either end of an open chain — gets a zero normal, which the
 * shader reads as "no cut" and leaves as a round cap.
 */
export declare function chainJoins(points: readonly VecPt[], closed?: boolean): Float32Array;
/**
 * `chainJoins` for a list of segments rather than a path — the emitter's
 * particle outlines arrive already cut into pairs.
 *
 * Two segments are joined when one ends where the next begins, which is the
 * only thing that actually matters and needs no separate `closed` flag: a loop
 * is simply a list whose last segment lands back on the first.
 */
export declare function segJoins(segs: ReadonlyArray<readonly [VecPt, VecPt]>): Float32Array;
/**
 * A COLOUR PER PARTICLE, rather than one colour for the whole burst.
 *
 * The emitter hands each particle the next index from a running counter, so a
 * stream keeps walking the source across frames instead of restarting every
 * call — that is what makes a thruster cycle the spectrum smoothly rather than
 * strobing one hue per frame.
 *
 * - `'rainbow'` — the full hue wheel
 * - `{ hue: [from, to], step?, sat?, val? }` — an arc of it (`[200, 320]` for
 *   an ice plume, `[0, 60]` for flame)
 * - `{ from, to }` — walk between two literal colours
 * - `string[]` — cycle an explicit palette
 * - `(i) => string` — anything else; `i` is the particle's index in the run
 *
 * `step` is DEGREES PER PARTICLE and defaults to 1, so a burst of `count`
 * spans `count × step` degrees. Raise it to fan a single burst across the
 * wheel; leave it at 1 for a stream that cycles gradually.
 */
export type VecColorSource = 'rainbow' | (string & {}) | readonly string[] | ((i: number) => string) | {
    hue: readonly [number, number];
    step?: number;
    sat?: number;
    val?: number;
} | {
    from: string;
    to: string;
    step?: number;
};
/**
 * One packed style per segment, or null when the chain is uniform.
 *
 * This is what makes colour work on CHAINS, and it covers both ways of asking:
 *
 * - `colors` — a SOURCE stepped once per segment (rainbow polygons, hue-graded
 *   terrain). Per index, because that is what a source means.
 * - `color2` — a GRADIENT from `color`, run once along the WHOLE run by ARC
 *   LENGTH. A single instanced segment can only ramp end to end, so without
 *   this the whole from→to repeats inside every segment and a polyline comes
 *   out banded, one full ramp per edge. Measuring by length rather than by
 *   segment index matters as soon as the edges differ: a long edge would
 *   otherwise sweep the same amount of colour as a short one and the ramp
 *   would visibly stall and rush.
 *
 * On a CLOSED outline the ramp runs the whole way round and meets itself at the
 * first point, so `color` and `color2` sit next to each other there — the seam
 * any linear gradient on a loop has. Pick close colours, or leave it open.
 */
export declare function segmentStyles(raw: LineStyle, segs: ReadonlyArray<readonly [VecPt, VecPt]>): PackedStyle[] | null;
/**
 * The translation that realises a shape's `pivot` — where the shape is actually
 * drawn, which is what you want for framing a camera on it or hanging something
 * off it.
 *
 * The shader only knows `world = rotate(scale(local)) + T`, with no pivot in
 * it. Turning about an arbitrary point is the same transform with a different
 * T, so the whole feature lives here and costs nothing per vertex:
 *
 *   world(p) = R·S·(p − pivot) + pivot + xy  =  R·S·p + (xy + pivot − R·S·pivot)
 *
 * The pivot itself therefore lands at exactly `(x + pivot.x, y + pivot.y)`,
 * which is the point a shatter should burst from.
 */
export declare function shapeOrigin(s: {
    x: number;
    y: number;
    rot: number;
    scale: number;
    pivot: VecPt | null;
}): VecPt;
/** Resolve a colour source for particle `i`. Pure — shared by both backends. */
export declare function resolveVecColor(src: VecColorSource, i: number): string;
/** The outline a vector particle is cut from. */
export type VecShapeKind = 'line' | 'triangle' | 'square' | 'diamond' | 'circle' | 'cross' | 'star';
/** Outline for one particle kind, centred on the origin at RADIUS 1. */
export declare function particleOutline(kind: VecShapeKind, circleSides?: number): Array<[VecPt, VecPt]>;
/** A burst of vector particles. Everything is optional except x/y. */
export interface VecEmitOptions {
    x: number;
    y: number;
    /** Particles in the burst (default 12). */
    count?: number;
    /** Outline to cut them from — one kind, or an array to mix per particle. */
    shape?: VecShapeKind | VecShapeKind[];
    /** Radius in world units (default 6) ± `sizeVar` (default 2). */
    size?: number;
    sizeVar?: number;
    /** Initial speed (default 90) ± `speedVar` (default 40). */
    speed?: number;
    speedVar?: number;
    /** Direction in radians (default 0) ± `spread`/2 (default a full circle). */
    angle?: number;
    spread?: number;
    /** Space the angles EVENLY across the spread — a clean ring or fan. */
    even?: boolean;
    /** Jitter the spawn point within this radius (default 0). */
    spawnRadius?: number;
    /** Random spin up to ±spin rad/s (default 3). */
    spin?: number;
    /** Seconds (default 1.2) ± `lifeVar` (default 0.4). */
    life?: number;
    lifeVar?: number;
    /** Velocity damping per second (default 0.4). */
    drag?: number;
    /** Downward acceleration (default 0); negative rises. */
    gravity?: number;
    /** Final size as a fraction of the start (default 1 = no change; 0 shrinks
     *  away, >1 grows — expanding shockwave rings are `shrink: 3`). */
    shrink?: number;
    /** Line look: `color`, `width`, `glow` — the same style shapes take. */
    style?: LineStyle;
    /**
     * A colour PER PARTICLE, overriding `style.color`. Rainbow plumes, flame
     * ramps and two-colour gradients without hard-coding a palette:
     *
     * ```ts
     * colors: 'rainbow'                       // the whole wheel
     * colors: { hue: [0, 60], step: 4 }       // flame: red → orange → yellow
     * colors: { from: '#41d6ff', to: '#ff5fa2' }
     * colors: (i) => i % 2 ? '#fff' : '#0ff'
     * ```
     */
    colors?: VecColorSource;
    /** Segments per circle (default 10). Fewer = chunkier, cheaper. */
    circleSides?: number;
}
/** One shatter fragment's kinematic state (pure step: stepFragment). */
export interface VecFragment {
    /** Fragment transform (world). */
    x: number;
    y: number;
    rot: number;
    scale: number;
    vx: number;
    vy: number;
    spin: number;
    age: number;
    life: number;
}
/** Spawn kinematics for one shattered segment. The fragment transform sits
 * ON the segment's world MIDPOINT (x, y) — so its spin turns the piece
 * about its own centre, never orbiting the shape origin — and flies along
 * the outward unit direction (dirX, dirY) with jitter + spin from `rand`. */
export declare function spawnFragment(x: number, y: number, dirX: number, dirY: number, opts: {
    speed?: number;
    spin?: number;
    life?: number;
}, rand: () => number): VecFragment;
/** Advance one fragment; returns false once expired. Pure — dist-tested. */
export declare function stepFragment(f: VecFragment, dt: number, drag?: number): boolean;
/** Fragment alpha over age: hold, then fade the last 40%. */
export declare function fragmentAlpha(age: number, life: number): number;
/** One star. Mutate these directly — the field re-reads them every frame, so
 *  anything the built-in motion does not cover, you can just do yourself. */
export interface VecStar {
    /** DRIFT: world position. WARP: lateral offset from the tunnel axis, before
     *  projection — screen position is derived, not stored. */
    x: number;
    y: number;
    /** DRIFT: which layer, normalised — 0 (nearest, full speed) to 1 (farthest).
     *  WARP: distance down the tunnel, `near`..`far`. */
    z: number;
}
/** `'drift'` scrolls a flat field in any direction; `'warp'` flies INTO the
 *  screen (or out of it, at negative speed). */
export type VecStarMode = 'drift' | 'warp';
/** Tuning for `layer.starfield()`. Every field is also a live property on the
 *  returned object — change any of them, any frame. */
export interface VecStarfieldOptions {
    /** How many stars (default 240). */
    count?: number;
    /** `'drift'` (default) or `'warp'`. */
    mode?: VecStarMode;
    /** The rectangle the field lives in. Default: the layer's current view, so
     *  it follows a resize on its own. */
    bounds?: VecClipRect;
    /**
     * DRIFT: world units per second for the NEAREST layer. WARP: units of depth
     * per second toward the camera. **Negative reverses it** — a drift field
     * scrolls the other way, a warp field flies backwards out of the screen.
     */
    speed?: number;
    /** DRIFT: direction of travel in radians (default 0 = right, +y is down).
     *  Turn it live and the whole field banks. */
    angle?: number;
    /**
     * DRIFT: how many parallax LAYERS, each slower, smaller and dimmer than the
     * one in front (default 4). `0` or `1` is a flat field with no parallax.
     *
     * `count` is shared out across them automatically and the depth spacing is
     * worked out from the layer count, so this is the only knob: ask for 4 and
     * you get four clearly separated sheets of sky. Set it any time and the
     * field re-layers itself.
     */
    layers?: number;
    /** WARP: the vanishing point (default the centre of `bounds`). Move it to
     *  steer — the field swings about it like a camera turning. */
    origin?: VecPt;
    /** WARP: focal length in world units (default 260). Bigger = narrower field
     *  of view, so stars come at you from further ahead. */
    focal?: number;
    /** WARP: nearest depth before a star recycles (default 12). */
    near?: number;
    /** WARP: the depth stars spawn at (default 900). */
    far?: number;
    /**
     * BEND the field sideways with depth. A vector is a constant lean; a
     * FUNCTION `(t, time) => ({x, y})` is a curve, where `t` is 0 near to 1 far
     * and `time` is seconds since the field was made — which is how you get a
     * tunnel that snakes, undulates or whips over as the ship turns.
     *
     * ```ts
     * field.bend = (t, time) => ({ x: Math.sin(time + t * 3) * 260 * t, y: 0 });
     * ```
     *
     * **`'warp'` only.** A flat field has no depth axis to bend along, so
     * bending one just slides its parallax bands sideways past each other, which
     * reads as a glitch rather than a curve. It is ignored in `'drift'`.
     */
    bend?: VecPt | ((t: number, time: number) => VecPt) | null;
    /** WARP: roll the whole field about `origin`, radians/second. */
    spin?: number;
    /** Star size in world units at the nearest depth (default 2.2). */
    size?: number;
    /**
     * Tail length, in SECONDS of travel. **0 (the default) is no tail at all** —
     * plain dots.
     *
     * Each star remembers where it has BEEN, so a tail is a real trail: turn the
     * field and the tails bend, leaving a curve painted on the screen. It fades
     * and thins away to nothing behind, and it lengthens with speed and with
     * nearness on its own — wind it up with the throttle and you have the
     * hyperspace jump.
     */
    streak?: number;
    /** Star colour (default '#ffffff'). */
    color?: string;
    /** A colour SOURCE indexed per star, for a mixed-temperature sky. Resolved
     *  when a star is (re)spawned, not per frame. */
    colors?: VecColorSource | null;
    /** Halo intensity (default 0.5). */
    glow?: number;
    /** Depth for the vector pass. Default: behind everything else in the layer. */
    z?: number;
    /** Deterministic layouts — pass the game's seeded rng. */
    rng?: () => number;
}
/**
 * A STARFIELD — the backdrop every game in this canon has, and the one thing
 * all of ours were hand-rolling.
 *
 * Two modes off one object. `'drift'` scrolls a flat parallax field in any
 * direction; `'warp'` flies into the screen down a projected tunnel. Both are
 * fully live: `speed`, `angle`, `origin`, `bend`, `spin`, `streak`, `size`,
 * `glow` and `color` are plain properties, so a ship that accelerates, banks
 * or jumps to lightspeed is a few assignments and no rebuild.
 *
 * ```ts
 * const sky = game.vector.starfield({ count: 300, speed: 60, angle: Math.PI });
 * sky.speed = 60 + throttle * 900;              // accelerate
 * sky.angle += turn * dt;                       // bank
 *
 * const tunnel = game.vector.starfield({ mode: 'warp', speed: 320, streak: 0.05 });
 * tunnel.bend = (t, time) => ({ x: Math.sin(time * 1.2 + t * 4) * 300 * t, y: 0 });
 * ```
 *
 * `stars` is the raw array, so anything the built-ins do not cover you can do
 * by hand — and `each` runs a callback over every star each step if you would
 * rather not write the loop.
 */
export declare class VecStarfield {
    private host;
    mode: VecStarMode;
    bounds: VecClipRect | null;
    speed: number;
    angle: number;
    origin: VecPt | null;
    focal: number;
    near: number;
    far: number;
    bend: VecPt | ((t: number, time: number) => VecPt) | null;
    spin: number;
    size: number;
    streak: number;
    color: string;
    colors: VecColorSource | null;
    glow: number;
    z: number | undefined;
    dead: boolean;
    /** Every star, live. Move them, cull them, sort them — it is just an array. */
    readonly stars: VecStar[];
    /** Run over every star each step, after the built-in motion and before the
     *  draw. The escape hatch for anything the options do not express. */
    each: ((s: VecStar, dt: number, field: VecStarfield) => void) | null;
    private sampling;
    /**
     * DRIFT parallax layers — see the option. Assign any time; the field
     * re-layers on the spot.
     */
    get layers(): number;
    set layers(n: number);
    private time;
    private scratch;
    private rng;
    /** The rectangle in play — the explicit `bounds`, else the live view. */
    get rect(): {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /** Grow or shrink the field, keeping the stars already placed. */
    resize(count: number): void;
    /** Re-scatter every star — a new level, a jump, a different sky. */
    reset(): void;
    step(dt: number): void;
    /** Remove the field from the layer. */
    kill(): void;
}
/** Tuning for `layer.trail()`. Everything is optional. */
export interface VecTrailOptions {
    /** Samples kept (default 32). The oldest is the tail. */
    length?: number;
    /**
     * Minimum world distance between samples (default 4). Without it a slow or
     * stationary emitter fills the buffer with duplicate points and the trail
     * collapses to a dot — the single thing most hand-rolled trails get wrong.
     */
    minDist?: number;
    /**
     * Split a move LONGER than this into several samples (default 0 = off).
     *
     * Without it a trail lays down exactly one sample per frame, so its shape
     * depends on frame rate: the same object at 30fps leaves chords twice as
     * long as at 60, and a fast mover on a curve draws a visible polygon. Set
     * it to the longest chord you are happy with and the ribbon looks the same
     * at any frame rate.
     *
     * It is off by default because on a LENGTH-bound trail it also shortens the
     * ribbon — `length: 32, maxDist: 8` can never span more than 256 units. On
     * a `life`-bound trail there is no such interaction, so turn it on freely.
     */
    maxDist?: number;
    /** Seconds a sample survives. Omit and the trail is length-bound only. */
    life?: number;
    /** Stroke width at the head (default 3) and at the tail (default 0). */
    width?: number;
    tailWidth?: number;
    /** Alpha at the head (default 1) and at the tail (default 0). */
    alpha?: number;
    tailAlpha?: number;
    /** Head colour, and optionally a different tail colour to grade toward. */
    color?: string;
    tailColor?: string;
    /** …or a full colour SOURCE stepped along the trail — the same sources
     *  `colors` and the emitter take (`'rainbow'`, `{ hue }`, a palette, a fn). */
    colors?: VecColorSource;
    /** Halo intensity at the head (default 0.7); it fades out with the alpha. */
    glow?: number;
    /** Beam dwell 0..1 (default 0). */
    dwell?: number;
    /** Depth, as on any line. */
    z?: number;
}
/**
 * A ribbon that follows a moving point, tapering and fading toward its tail.
 *
 * ```ts
 * const wake = game.vector.trail({ length: 40, width: 4, color: '#41d6ff', tailColor: '#ff2d95' });
 * wake.push(ship.x, ship.y);        // once a frame; the layer draws it
 * wake.kill();                      // when the ship dies
 * ```
 *
 * The layer draws every live trail for you, so there is no per-frame draw call
 * to forget. Samples are dropped by `length`, by `life`, or both.
 */
export declare class VecTrail {
    private host;
    /** Live-tunable — change any of these between frames. */
    length: number;
    minDist: number;
    maxDist: number;
    life: number;
    width: number;
    tailWidth: number;
    alpha: number;
    tailAlpha: number;
    color: string;
    tailColor: string | null;
    colors: VecColorSource | null;
    glow: number;
    dwell: number;
    z: number | undefined;
    dead: boolean;
    private ages;
    /** How many samples the trail is currently holding. */
    get count(): number;
    /** The samples, oldest first — read-only. */
    get points(): readonly VecPt[];
    /**
     * Add a sample. Call once a frame with the thing's position; a move shorter
     * than `minDist` is folded into the head rather than added, so standing
     * still does not eat the buffer.
     */
    push(x: number, y: number): void;
    /** Drop every sample — a teleport, so the ribbon doesn't smear across it. */
    clear(): void;
    /** Stop drawing this trail and let the layer forget it. */
    kill(): void;
}
export interface LineStyle {
    /** Stroke width, world units (default 2). */
    width?: number;
    color?: string;
    /** Colour at the far endpoint — a gradient along the line. ONE line: on a
     *  polyline this repeats per segment and reads as banding. For a chain, use
     *  `colors`. */
    color2?: string;
    /**
     * A colour SOURCE walked one step PER SEGMENT — the chain-safe way to grade
     * a line. `'rainbow'`, `{ hue: [from, to] }`, `{ from, to }`, a palette
     * array, or your own `(i) => string`. Overrides `color`.
     *
     * ```ts
     * game.vector.shape(pts, { colors: 'rainbow', width: 2, glow: 0.9 });
     * game.vector.poly(ridge, { colors: { hue: [200, 320] } });
     * ```
     *
     * The same sources the emitter takes — see {@link VecColorSource}.
     */
    colors?: VecColorSource;
    alpha?: number;
    /** Phosphor halo intensity 0..~1.5 (default 0.5; 0 = clean line). The
     * halo radius is width × (3 + glow × 5). */
    glow?: number;
    /** Dash period in world units (half duty; 0 = solid). Dashes gate the
     * CORE only — the halo stays continuous, which is what sells it. */
    dash?: number;
    /**
     * BEAM DWELL 0..1 (default 0) — how much the ends of each segment brighten
     * and fatten, the way a real display's beam does where it slows down.
     *
     * On a closed outline the endpoints coincide at every joint, so it is the
     * CORNERS that light up: the single most recognisable property of a vector
     * monitor after the halo itself. Try 0.5–0.8 with `glow` up.
     */
    dwell?: number;
    /** Depth (0..Z_RANGE like sprites; default mid-range). */
    z?: number;
}
/** A shape's solid face. Absent (or transparent) = outline only, the default. */
export interface VecFill {
    /**
     * The face colour, as HEX (`#rgb`, `#rrggbb`, `#rrggbbaa`) — the engine's
     * colour parser takes nothing else and falls back to white. `'transparent'`,
     * `'none'` or a zero alpha mean no fill at all.
     *
     * Optional only because `stops` can supply the colours instead; give one or
     * the other or you get no face.
     */
    color?: string;
    /** Gradient end colour — a two-stop ramp. Omit for a flat face. */
    to?: string;
    /**
     * A MULTI-STOP ramp, evenly spaced along the gradient axis. Overrides `to`.
     * Pairs with `colorKit`: `stops: colorKit.rainbow(6)` or
     * `colorKit.ramp('fire', 5)`.
     */
    stops?: string[];
    /** Gradient direction in SHAPE-LOCAL radians (default 0 = left→right). The
     *  gradient spans the outline's own bounding box along that axis, so it
     *  rotates with the shape and never needs re-authoring at a new size. */
    angle?: number;
    /**
     * RADIAL instead of linear: the ramp runs from the outline's centroid out to
     * its furthest vertex, so `angle` is ignored. The centre-glow look — a
     * Tempest well, a shield bubble, a planet.
     */
    radial?: boolean;
}
export interface VectorShapeOptions extends LineStyle {
    /**
     * A SOLID FACE under the outline — the Tempest 2000 look, and what makes a
     * corridor a corridor.
     *
     * ```ts
     * game.vector.shape(pts, { fill: '#1b2a6b' });                       // flat
     * game.vector.shape(pts, { fill: { color: '#4b1d7a', to: '#ff2d95' } }); // gradient
     * ```
     *
     * Fills WRITE DEPTH, so a nearer shape hides the fills AND the outlines
     * behind it — set `z` per shape to order them. Outlines still draw over
     * their own fill (equal depth passes), so a shape is never hidden by itself.
     */
    fill?: string | string[] | VecFill | null;
    x?: number;
    y?: number;
    rot?: number;
    scale?: number;
    /**
     * The point the shape TURNS AND SCALES ABOUT, in the same space as the
     * points you handed in. Default `null` — the origin, `(0, 0)`.
     *
     * Build geometry wherever it is natural and say where its centre is:
     *
     * ```ts
     * const ring = vectorKit.ringSections(cx, cy, 250, 12);          // built in place
     * game.vector.shape(ring[0].points, { pivot: { x: cx, y: cy } }); // and it spins in place
     * ```
     *
     * Without it a shape turns about `(0, 0)` in its own point space, so anything
     * built away from the origin ORBITS the origin instead of turning where it
     * sits. `x`/`y` still translate, measured from the pivot.
     */
    pivot?: VecPt | null;
    /** Join the last point back to the first (default true). */
    closed?: boolean;
    /**
     * SCREEN WRAP. Give the shape the world size and it is drawn at its mirror
     * positions too, so a rock straddling an edge stays whole instead of being
     * sliced in half — the thing every Asteroids-like needs and the one thing a
     * single retained transform cannot express.
     *
     * ```ts
     * game.vector.shape(rockPoints, { x, y, wrap: { w: view.w, h: view.h } });
     * ```
     *
     * Keep the position itself in range with `vectorKit.wrapPosition`; this is
     * only the drawing half.
     */
    wrap?: {
        w: number;
        h: number;
    } | null;
}
/**
 * Triangulate an outline into fill vertices — `[x, y, r, g, b, a]` per vertex,
 * three per triangle — with the gradient resolved PER VERTEX at pack time.
 *
 * `VectorShape` calls this for you; it is exported because it is pure and
 * testable, and because it is the honest description of what a fill costs:
 * one ear-clip when the outline changes, then nothing at runtime.
 *
 * An unparseable, `'transparent'`, `'none'` or zero-alpha colour yields no
 * vertices at all — that is how "no fill" is spelled.
 */
export declare function buildFill(points: readonly VecPt[], fill: string | string[] | VecFill | null | undefined): number[];
/** A LineStyle resolved to the numbers an instance carries. `segmentStyles`
 *  returns these; nothing else needs to build one. */
export interface PackedStyle {
    coreHalf: number;
    stampHalf: number;
    z: number;
    dash: number;
    glow: number;
    capped: number;
    dwell: number;
    c0: [number, number, number, number];
    c1: [number, number, number, number];
}
/** A retained line shape: segments under one live transform. Mutate
 * x/y/rot/scale/alpha/glowMul freely — the per-frame cost is 8 floats. */
export declare class VectorShape {
    x: number;
    y: number;
    rot: number;
    scale: number;
    /** Whole-shape alpha multiplier (fade without touching colours). */
    alpha: number;
    /** Whole-shape halo multiplier (pump the glow on hits). */
    glowMul: number;
    /** @see VectorShapeOptions.wrap — set or clear it at any time. */
    wrap: {
        w: number;
        h: number;
    } | null;
    /** @see VectorShapeOptions.pivot — set or clear it at any time; it is read
     *  per frame, so nothing re-packs. */
    pivot: VecPt | null;
    dead: boolean;
    /** @see VectorShapeOptions.fill — assign at any time; re-packs next frame. */
    get fill(): string | string[] | VecFill | null;
    set fill(f: string | string[] | VecFill | null);
    constructor(layer: VectorLayer, points: readonly VecPt[], opts: VectorShapeOptions);
    /** True when this shape contributes a solid face. */
    get filled(): boolean;
    /** Merge new style fields (width/color/glow/dash/…) — hit flashes, retro
     * width toggles. Re-packs on the next frame. */
    restyle(style: Partial<LineStyle>): void;
    /** Replace the outline (deformable terrain: splice + set). Re-packs only
     * on the next flush. */
    setPoints(points: readonly VecPt[], closed?: boolean): void;
    /** Explode the outline: every segment flies off on its own transform with
     * outward velocity + spin, fading over `life`. The shape itself dies. */
    shatter(opts?: {
        speed?: number;
        spin?: number;
        life?: number;
        drag?: number;
    }): void;
    kill(): void;
}
export declare class VectorLayer {
    private format;
    /**
     * Clip the WHOLE layer to a world-space rectangle — a radar scope, a
     * Battlezone viewport, a split screen, Tempest's tube mouth. `null` (the
     * default) draws everywhere.
     *
     * ```ts
     * game.vector.clip = { x: 40, y: 40, w: 320, h: 320 };
     * ```
     *
     * It is a scissor on the whole layer draw, not per shape — the layer is one
     * pass, and that is the level at which clipping is free. The GLOW STAMP is
     * scissored with it, so halos are cut at the same edge instead of leaking
     * out of the window (which is what makes it look like a window at all).
     *
     * `d.pushClip` does NOT reach the vector layer; this is its clip.
     */
    clip: VecClipRect | null;
    private shapes;
    private fragments;
    private trails;
    /** The view rect this layer is drawing — what an unbounded starfield uses. */
    get viewRect(): {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /**
     * A STARFIELD behind the game — parallax drift, or a warp tunnel into the
     * screen. Everything about it is a live property; see `VecStarfield`.
     *
     * ```ts
     * const sky = game.vector.starfield({ count: 300, speed: 60, angle: Math.PI });
     * sky.speed = 60 + throttle * 900;                    // live
     * const tunnel = game.vector.starfield({ mode: 'warp', speed: 320, streak: 0.05 });
     * ```
     *
     * The layer steps and draws it — there is nothing to call per frame.
     * `kill()` removes it.
     */
    starfield(opts?: VecStarfieldOptions): VecStarfield;
    /** Runs across frames so a stream cycles a colour source smoothly. */
    private colorSeq;
    private rng;
    /**
     * SOLID FACES on or off. `null` (the default) is AUTO — the pass runs only
     * when at least one live shape actually has a fill, so a pure line-art game
     * never pays for it. `true`/`false` force it.
     */
    fills: boolean | null;
    private staticData;
    private staticCount;
    /** Fill vertices: opaque ones first (they write depth), then translucent. */
    private fillData;
    private fillOpaque;
    private fillBlend;
    private dynData;
    private dynCount;
    private dynGlow;
    private xformData;
    private uniformData;
    private device;
    private pipeline;
    private stampPipeline;
    private layout;
    private uniforms;
    private staticBuf;
    private dynBuf;
    private fillBuf;
    private fillBind;
    private fillPipeline;
    private fillBlendPipeline;
    private xformBuf;
    private staticBind;
    private dynBind;
    constructor(device: GPUDevice, format: GPUTextureFormat);
    /** Live counts (debug/HUD). */
    get counts(): {
        shapes: number;
        fragments: number;
        segments: number;
    };
    /** Add a retained shape from an outline (see VectorShapeOptions). */
    shape(points: readonly VecPt[], opts?: VectorShapeOptions): VectorShape;
    /**
     * A TRAIL — the ribbon a moving thing leaves behind.
     *
     * ```ts
     * const wake = game.vector.trail({ length: 40, width: 4, color: '#41d6ff', tailColor: '#ff2d95' });
     * wake.push(ship.x, ship.y);          // once a frame, and that is all
     * ```
     *
     * The layer ages and draws every live trail itself, so there is no per-frame
     * draw call to forget. `kill()` when the thing making it dies.
     *
     * This is what replaced full-screen phosphor feedback. Feedback smeared the
     * whole image and blew out anything that stood still; a trail is geometry
     * owned by one object, so it tapers, grades, and leaves nothing behind
     * something that is not moving.
     */
    trail(opts?: VecTrailOptions): VecTrail;
    /** Immediate one-frame segment (aim lines, scanner sweeps, lightning). */
    seg(x0: number, y0: number, x1: number, y1: number, style?: LineStyle): void;
    /** Immediate one-frame polyline. */
    poly(points: readonly VecPt[], style?: LineStyle, closed?: boolean): void;
    /**
     * Immediate arc — `from` and `to` in radians, clockwise (y is down, so
     * -PI/2 is straight up). A full circle is `arc(x, y, r, 0, Math.PI * 2)`.
     *
     * ```ts
     * game.vector.arc(cx, cy, 90, -0.5, 0.5, { color: '#41d6ff', glow: 0.9 });
     * ```
     *
     * `steps` overrides the tessellation (default: one segment per ~11°). For a
     * ring that ROTATES or breaks apart, build it retained instead — see
     * `vectorKit.ringSections()`.
     */
    arc(cx: number, cy: number, r: number, from: number, to: number, style?: LineStyle, steps?: number): void;
    /**
     * Draw a line of text AS LINE ART — the same beam that draws everything else.
     *
     * ```ts
     * game.vector.text('SCORE 004200', 20, 20, { size: 26, style: { color: '#39f0a0', glow: 0.8 } });
     * game.vector.text('GAME OVER', cx, cy, { size: 70, align: 'center', colors: 'rainbow' });
     * ```
     *
     * Caps-only (lowercase folds up), straight strokes only, `\n` starts a new
     * line. It takes everything a line takes — `width`, `glow`, `dash`, and a
     * `colors` SOURCE stepped per stroke.
     *
     * This is the immediate path. To make text a real object that can fly,
     * rotate and `shatter()`, build it with `vectorKit.textOutline()` and hand
     * the polylines to `shape()`.
     */
    text(str: string, x: number, y: number, opts?: VecTextOptions & {
        style?: LineStyle;
    }): void;
    /**
     * Spawn a burst of VECTOR particles — little outlines that fly, spin, fade
     * and glow with the rest of the layer.
     *
     * ```ts
     * game.vector.emit({ x, y, count: 24, shape: ['triangle', 'square'],
     *                    size: 7, speed: 160, spin: 6,
     *                    style: { color: '#41d6ff', width: 2, glow: 0.9 } });
     * ```
     *
     * They cost what any other segments cost: same buffers, same transform slot,
     * same glow stamp. Mixing `shape` kinds picks one per particle.
     */
    emit(opts: VecEmitOptions): void;
    /** Advance fragments and trails (Game ticks this). */
    update(dt: number): void;
    /** Start a frame (same world rect as the sprite batches). */
    begin(viewX: number, viewY: number, viewW: number, viewH: number): void;
    /** How wide the widest live glow stamp is (0 = nothing glows) — Game
     * wakes the shared GlowPass with it. Valid after prepare(). */
    glowSize: number;
    /**
     * Upload everything for this frame: repack static data if dirty, pack the
     * live transform table, upload the dynamic pushes, and measure the glow.
     * Game calls this BEFORE the GlowPass renders (the stamps draw there).
     */
    prepare(): void;
    /**
     * Draw the crisp scene lines (static + dynamic, two draws max).
     *
     * `pxW`/`pxH` are the target's pixel size — needed only to turn `clip` into
     * a scissor; omit them and clipping is skipped.
     */
    draw(pass: GPURenderPassEncoder, pxW?: number, pxH?: number): void;
    /** Draw the soft glow stamps into the GlowPass's half-res target pass
     * (Game hands this as the extra-stamps callback). Zero-glow segments
     * contribute nothing (brightness multiplies to 0). */
    stampGlow(pass: GPURenderPassEncoder, pxW?: number, pxH?: number): void;
    /** Kill everything (scene teardown). */
    clear(): void;
    /** (Re)create GPU objects — device-loss recovery. */
    rebuild(device: GPUDevice): void;
    private makeBinds;
    private pushDyn;
    private repackStatic;
}

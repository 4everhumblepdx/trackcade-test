// Docs: engine/webgpu/physics2d.md — usage, recipes & traps (this file = exact type signatures)
/**
 * Physics2d — OPTIONAL full-body rigid-body physics for the engine. A thin,
 * engine-vocabulary wrapper over a vendored Box2D v3 core that ships as a
 * SEPARATE chunk (`physics2d-core.mjs`, ~640 KB): games that never call
 * `Physics2d.create()` never load a byte of it. This is the 2D twin of
 * `Physics3d` — for physics-strenuous titles (stacks, ragdolls, ropes, vehicles,
 * dominoes) where the arcade `solid(A, B)` solver isn't enough.
 *
 *   // setup() — one await, then attach to the scene and it's hands-free:
 *   this.world = await Physics2d.create({ gravity: 900 });   // units/s² downward
 *   this.physics2d = this.world;                    // the scene steps + syncs
 *   this.world.bind(ground, { type: 'static' });    // immovable level geometry
 *   const crate = this.world.bind(crateSprite, { bounce: 0.2, friction: 0.6 });
 *   crate.impulse({ x: 0, y: -400 });               // units/s kick (screen-up)
 *
 * What the wrapper hides ON PURPOSE (never reach past it): the WASM module and
 * its manual memory rules (every Box2D getter returns a handle that must be
 * freed — the wrapper does this for you), the meters/world-units + y-up/y-down
 * coordinate bridge (you work in the sprite's world units; Box2D works in
 * meters, y-up), body/shape handle plumbing, collision bitmasks (use string
 * `group`/`hits` names), and the fixed-timestep accumulator.
 *
 * You steer dynamic bodies with `impulse`/`force`/`velocity` — NEVER by setting
 * `sprite.x/y` (the sim overwrites them every frame; use `teleport` for a hard
 * move). Bound sprites skip the arcade integrator automatically.
 */
import type { Sprite } from './sprite.js';
import type { Vec2 } from './util.js';
import type { VectorShape, VecPt } from './vector.js';
type B2 = any;
/** Options for `Physics2d.create`. */
export interface Physics2dOptions {
    /**
     * Gravity. A number is downward world-units/s² (screen-down positive) — `900`
     * default, a lively arcade weight. Or a full `{x, y}` vector (y positive = down).
     */
    gravity?: number | Vec2;
    /**
     * World units per simulated metre. Box2D is tuned for bodies roughly 0.1–10 m,
     * so the wrapper simulates in metres and scales by this. The default `32` makes
     * a 32-unit sprite a 1-m body — good for most games. Larger worlds with big
     * sprites can raise it; you rarely need to touch it. Fixed at create time.
     */
    pixelsPerMeter?: number;
    /**
     * Solver sub-steps per 60 Hz frame — how many times the constraint solver
     * refines each step. `4` (default) is right for most games. Raise (e.g. `8`)
     * for demanding contact chains — tall stacks, precise restitution (a Newton's
     * cradle), fast joints — at a proportional CPU cost. Lower is not advised.
     */
    substeps?: number;
    /** Override the physics core module URL (rarely needed — the default finds the shipped chunk). */
    module?: string;
}
/** Options for `world.bind`. */
export interface BindOptions {
    /**
     * `'dynamic'` (default) — fully simulated. `'static'` — immovable level
     * geometry (walls, floors). `'kinematic'` — YOU move the sprite
     * (`sprite.x/y` / `sprite.rot` as usual) and it pushes dynamic bodies
     * without being pushed back (moving platforms, doors, paddles).
     */
    type?: 'dynamic' | 'static' | 'kinematic';
    /**
     * Collision shape: `'auto'` (default — a `'box'` the size of the sprite's
     * hitbox), `'box'` (axis of `sprite.w/h`), or `'circle'` (radius from
     * `sprite.w/h`, or `radius`). Balls, wheels and round pickups want `'circle'`.
     */
    shape?: 'auto' | 'box' | 'circle';
    /** Circle radius in world units (circle shape only). Default: half the smaller of `sprite.w/h`. */
    radius?: number;
    /** Surface grip 0..1+. Default `0.6`. */
    friction?: number;
    /** Bounciness 0..1 (a ball at `1` never loses height). Default `0`. */
    bounce?: number;
    /**
     * Mass density (dynamic bodies): mass = density × area. With the default
     * `pixelsPerMeter`, a 32-unit box at density `1` weighs 1 unit. Default `1`.
     */
    density?: number;
    /** Collision group name (see `hits`). Bodies default to the `'default'` group. */
    group?: string;
    /** Group names this body collides with. Omit = collides with everything. */
    hits?: string[];
    /**
     * Family name: bodies sharing a family NEVER collide with each other while
     * still colliding with the rest of the world — the ragdoll / linked-creature
     * knob (limbs must overlap at the joints without shoving each other apart).
     */
    family?: string;
    /** Freeze rotation — the body slides and stacks but never spins (top-down pucks, upright characters, paddles). Default `false`. */
    fixedRotation?: boolean;
    /** Continuous collision for fast movers (bullets) — stops tunnelling through thin walls. Costs a little; set it only on the fast body. Default `false`. */
    bullet?: boolean;
    /** Linear drag (air resistance), 0 = none. Default `0`. */
    damping?: number;
    /** Angular drag. Default `0.05` (spins settle). */
    angularDamping?: number;
    /** Gravity multiplier for this body (`0` = floats, `2` = falls twice as hard). Default `1`. */
    gravityScale?: number;
    /**
     * Shift the centre of mass off the shape's centre, in world units relative to
     * the sprite centre (`+y` = down). A low centre of mass makes a body
     * bottom-heavy so it resists tipping — a car with `balance: { y: 16 }` stays
     * planted and won't wheelie/flip; a roly-poly toy uses a big `+y`. Default:
     * the geometric centre.
     */
    balance?: Vec2;
    /** Sensor mode: overlaps fire `onEnter`/`onExit` but apply NO contact forces (pickup zones, trigger plates, goal areas). */
    trigger?: boolean;
    /** A body entered this trigger (trigger bodies only). */
    onEnter?: (other: Body2d) => void;
    /** A body left this trigger (trigger bodies only). */
    onExit?: (other: Body2d) => void;
    /** Contact started (`speed` = approach speed in units/s — gate impact sounds/damage on it). */
    onHit?: (other: Body2d, speed: number) => void;
    /** Contact began (any speed — standing-on bookkeeping, "what am I touching"). */
    onTouch?: (other: Body2d) => void;
    /** Contact ended — the pair separated (left the platform, dropped the crate). */
    onRelease?: (other: Body2d) => void;
}
/** The bit of the vector layer `debugDraw` needs — `game.vector` satisfies it. */
export interface DebugDrawTarget {
    seg(x0: number, y0: number, x1: number, y1: number, style?: Record<string, unknown>): void;
    poly(points: readonly VecPt[], style?: Record<string, unknown>, closed?: boolean): void;
    arc(cx: number, cy: number, r: number, from: number, to: number, style?: Record<string, unknown>, steps?: number): void;
}
/** Options for `world.debugDraw`. */
export interface DebugDrawOptions {
    /** Awake dynamic/kinematic bodies (default '#39f0a0'). */
    color?: string;
    /** Bodies Box2D has put to sleep (default '#2b5da0') — seeing them go quiet
     *  is half the value of a debug view. */
    sleepColor?: string;
    /** Static geometry (default '#4a6fa5'). */
    staticColor?: string;
    width?: number;
    glow?: number;
    /** Segments per circle (default 16). */
    circleSteps?: number;
}
/** Options for `world.chain` — static line geometry has no mass or density. */
export interface ChainOptions {
    /** Join the last point back to the first (a rim, a closed arena). */
    loop?: boolean;
    friction?: number;
    bounce?: number;
    group?: string;
    hits?: string[];
    onHit?: (other: Body2d, speed: number) => void;
    onTouch?: (other: Body2d) => void;
    onRelease?: (other: Body2d) => void;
}
/** Options for `world.bindShape` — `BindOptions` with the shape modes a vector
 *  outline needs instead of a sprite's box/circle. */
export interface BindShapeOptions extends Omit<BindOptions, 'shape' | 'radius'> {
    /**
     * `'hull'` (default) — the convex hull of the outline, reduced to Box2D's
     * eight-vertex limit. `'box'` — the outline's bounding box. `'circle'` — a
     * disc covering it (or `radius`). `'decompose'` — split a CONCAVE outline
     * into convex pieces, all on this one body, so a ship's notch is a real
     * notch instead of being filled in by the hull.
     *
     * `'hull'` is the right default for line art and much the cheaper of the
     * two; reach for `'decompose'` when the dent matters to play.
     */
    shape?: 'hull' | 'box' | 'circle' | 'decompose';
    /** Circle radius in world units (circle shape only). Default: the outline's
     *  furthest point from its origin. */
    radius?: number;
    /** Cap the hull's vertex count (default 8, Box2D's own limit). */
    maxVertices?: number;
}
/** A physics joint. Call `destroy()` to break it (the bodies stay). */
export interface Joint2d {
    destroy(): void;
    /**
     * Drive (or brake) the joint's motor at runtime — the knob for powered wheels,
     * pinball flippers, elevators and gears. On a `pin` joint, `speed` is rad/s
     * (screen-clockwise) and `effort` a torque budget; on a `slider`, `speed` is
     * units/s along its axis and `effort` a force budget. `speed: 0` with a budget
     * holds position; omit `effort` to keep the previous budget. A no-op on
     * `rope`/`weld` joints (they have no motor). Enables the motor on first call.
     */
    motor(speed: number, effort?: number): void;
}
/** Options for `world.pin` (revolute joint — a hinge / pivot). */
export interface PinOptions {
    /** World-space pivot point. Default: the midpoint between the two bodies. */
    at?: Vec2;
    /** Swing limits in radians `[min, max]`. Omit for free spin. */
    limits?: [number, number];
    /** Drive the hinge at this angular speed (rad/s, screen-clockwise +) with `maxTorque` budget — a motor / powered wheel. */
    motorSpeed?: number;
    /** Torque budget for `motorSpeed`. Required if you set a motor. */
    maxTorque?: number;
}
/** Options for `world.rope` (distance joint — a rod / rope / spring). */
export interface RopeOptions {
    /** Rest length in world units. Default: the current distance between the anchor points. */
    length?: number;
    /** Min/max length — a rope that can go slack but not stretch (`[0, length]`), or a rigid rod (`[length, length]`, the default). */
    range?: [number, number];
    /** Springiness in Hz (0 = rigid rod, 4 = bouncy tether). Default `0`. */
    hertz?: number;
    /** Spring damping 0..1 (only with `hertz`). Default `0.5`. */
    damping?: number;
    /** Anchor point on body A (world space). Default: A's centre. */
    atA?: Vec2;
    /** Anchor point on body B (world space). Default: B's centre. */
    atB?: Vec2;
}
/** Options for `world.slider` (prismatic joint — motion along one axis only). */
export interface SliderOptions {
    /** World-space axis the body slides along (any length). Default `{x:1, y:0}` (horizontal). */
    axis?: Vec2;
    /** Travel limits along the axis `[min, max]`. Omit for free travel. */
    limits?: [number, number];
    /** Drive along the axis at this speed (units/s) with `maxForce` budget — a powered piston / elevator. */
    motorSpeed?: number;
    /** Force budget for `motorSpeed`. */
    maxForce?: number;
}
/** Options for `world.wheel` (a spring-suspension car axle). */
export interface WheelOptions {
    /** World-space attach point — the wheel's centre. */
    at: Vec2;
    /** Suspension direction the wheel travels along (any length). Default `{x:0, y:1}` (vertical). */
    axis?: Vec2;
    /** Suspension spring frequency in Hz (stiffness). Default `4`. */
    hertz?: number;
    /** Suspension damping ratio 0..1. Default `0.7`. */
    damping?: number;
    /** Suspension travel limits along the axis `[min, max]`. Omit for free travel. */
    travel?: [number, number];
    /** Drive the wheel at this angular speed (rad/s, screen-clockwise) — set with `maxTorque`, or drive live via the returned joint's `motor()`. */
    motorSpeed?: number;
    /** Drive torque budget for the motor. */
    maxTorque?: number;
}
/** Options for `world.grab`. */
export interface GrabOptions {
    /**
     * `true` (default) is a firm, responsive grab — the clicked point tracks the
     * pointer closely with little lag, and the body rotates naturally to follow
     * (it dangles from the grab point). `false` is a soft, springy rubber-band
     * pull — good for slingshots and tractor beams. Both cap their force so a
     * dragged jointed body (a ragdoll) never gets torn apart.
     */
    stiff?: boolean;
    /** Pull strength for the elastic (`stiff: false`) mode — higher snaps harder. Default `1`. */
    strength?: number;
}
/** A drag handle from `world.grab` — a mouse/touch joint. Move the target each frame, then release. */
export interface Grab2d {
    /** Move the grab target to a new world point (call each frame with the pointer). */
    moveTo(point: Vec2): void;
    /** Let go — the body keeps whatever velocity it had, so a moving release throws it. */
    release(): void;
}
/** A ray hit. */
export interface RayHit {
    /** The body the ray struck. */
    body: Body2d;
    /** World hit point. */
    point: Vec2;
    /** Surface normal at the hit (unit vector). */
    normal: Vec2;
    /** Distance from the ray origin in world units. */
    distance: number;
}
/**
 * A physics body driving (dynamic) or moved-by (kinematic/static) a sprite. Get
 * one from `world.bind(sprite, ...)`. Steer dynamic bodies with
 * `impulse`/`force`/`velocity`; read `velocity`/`mass`; break with `destroy()`.
 */
export declare class Body2d {
    /**
     * The sprite this body drives (dynamic) or follows (kinematic/static).
     *
     * `undefined` on a body bound to a VECTOR SHAPE — check `shape` instead, or
     * `target` for whichever it is.
     */
    readonly sprite: Sprite;
    /** The vector shape this body drives, if it was bound with `bindShape`. */
    readonly shape?: VectorShape;
    /** Whichever of the two this body drives — `sprite` or `shape`. */
    readonly target: Sprite | VectorShape;
    /** `'sprite'` (top-left anchored, needs the half-size offset) or `'shape'`
     *  (origin-centred, the body pose maps straight on). */
    readonly kind: 'sprite' | 'shape';
    /** `'dynamic' | 'static' | 'kinematic'`. */
    readonly type: 'dynamic' | 'static' | 'kinematic';
    /** Contact started (approach speed in units/s). Assign any time. */
    onHit: ((other: Body2d, speed: number) => void) | null;
    /** Contact began / ended (any speed). */
    onTouch: ((other: Body2d) => void) | null;
    onRelease: ((other: Body2d) => void) | null;
    /** Trigger callbacks (trigger bodies). */
    onEnter: ((other: Body2d) => void) | null;
    onExit: ((other: Body2d) => void) | null;
    _pose1: Float32Array<ArrayBuffer>;
    /** Current velocity in units/s (screen space). */
    get velocity(): Vec2;
    set velocity(v: Vec2);
    /** Angular velocity in rad/s (screen-clockwise positive). */
    get spin(): number;
    set spin(v: number);
    /** The body's mass. */
    get mass(): number;
    /**
     * Instant kick in units/s (screen space): `impulse({y: -400})` pops the body
     * upward, scaled by mass so the same call gives the same launch speed whatever
     * the body weighs. Pass `at` (world point) to also spin it — off-centre hits
     * tumble.
     */
    impulse(v: Partial<Vec2>, at?: Vec2): void;
    /** Continuous push in units/s² (accumulates until the next step) — thrusters, wind. Mass-scaled like `impulse`. */
    force(v: Partial<Vec2>): void;
    /**
     * Spin the body: **angular acceleration in rad/s²**, screen-clockwise
     * positive, accumulating until the next step. Wakes the body.
     *
     * Scaled by the body's own rotational inertia, exactly as `force` is scaled
     * by its mass — so the number means the same thing on a pebble and on a
     * chassis, and `torque(4)` reaches 4 rad/s in a second (less whatever
     * `angularDamping` takes back). Raw Box2D torque is in kg·m² and a small
     * sprite's inertia is a fraction of one, so an unscaled value that looks
     * modest spins a light body into a blur.
     */
    torque(t: number): void;
    /** The body's rotational inertia — what `torque` scales by, as `mass` is what
     *  `force` scales by. */
    get inertia(): number;
    /** Instantly move the body (and its sprite) to a world position (its CENTRE) — respawns. Clears velocity. Optional `angle` in screen-clockwise radians. */
    teleport(position: Vec2, angle?: number): void;
    /**
     * Remove this body from the world (the sprite stays where it was — kill it
     * separately if you want it gone). Safe to call twice.
     */
    destroy(): void;
}
/**
 * The physics world. `await Physics2d.create()` once in an async `setup()`, bind
 * sprites, attach to the scene (`scene.physics2d = world`) and everything
 * else is hands-free — the scene steps and syncs it each frame. All shapes are
 * built from each sprite's CURRENT `x/y/w/h` at bind time — place the sprite
 * first, bind second.
 */
export declare class Physics2d {
    _scratch2: B2;
    _zeroVec: B2;
    /** Diagnostic: bodies found stale during sync (should stay 0). */
    invalidBodies: number;
    private constructor();
    /**
     * Load the physics core (first call fetches the ~640 KB chunk; later calls are
     * instant) and create a world. One world per scene is the pattern.
     */
    static create(opts?: Physics2dOptions): Promise<Physics2d>;
    /**
     * Give a sprite a physics body. The shape is built from `sprite.w/h` and
     * `sprite.x/y` as they are RIGHT NOW — place the sprite first. Returns the
     * `Body2d`; dynamic bodies then own the sprite's `x/y` and `rot`.
     */
    bind(sprite: Sprite, opts?: BindOptions): Body2d;
    /** The `Body2d` bound to a sprite, or `undefined`. */
    bodyFor(sprite: Sprite): Body2d | undefined;
    /** The `Body2d` bound to a vector shape, or `undefined`. */
    bodyForShape(shape: VectorShape): Body2d | undefined;
    /**
     * Give a VECTOR SHAPE a physics body — line art with real rigid-body
     * physics, which is the pairing the two were always going to make.
     *
     * ```ts
     * const rock = game.vector.shape(vectorKit.generatePolygon(40, 11), { x: 300, y: 120, glow: 0.9 });
     * world.bindShape(rock, { bounce: 0.4, friction: 0.3 });
     * ```
     *
     * A vector shape fits Box2D BETTER than a sprite does: it is already
     * origin-centred with live `x`/`y`/`rot`, so the body pose maps onto it with
     * no offset, where a sprite needs a half-size correction every sync.
     *
     * The outline is taken as it is RIGHT NOW, in the shape's own local frame,
     * with `scale` baked in — place and scale the shape first, bind second.
     * Changing `scale` afterwards moves the drawing and NOT the collision shape;
     * rebind if you need it to follow.
     *
     * Shapes are convex: `'hull'` (the default) takes the convex hull of the
     * outline and reduces it to Box2D's eight-vertex limit, so a jagged
     * eleven-point asteroid still collides as its own silhouette rather than
     * silently becoming a null shape.
     */
    bindShape(shape: VectorShape, opts?: BindShapeOptions): Body2d;
    /**
     * A STATIC CHAIN body from a polyline — terrain, cave walls, a tube rim, a
     * ring of arcs. This is the shape Box2D wants for one-sided world geometry:
     * no thickness, no mass, and no internal edges for a fast body to catch on.
     *
     * ```ts
     * const ground = vectorKit.generateTerrain({ width: 1400, baseY: 600 });
     * game.vector.shape(ground, { closed: false, color: '#39f0a0' });
     * world.chain(ground, { friction: 0.9 });
     * ```
     *
     * `loop: true` closes it — which is exactly what `web.closed` and a closed
     * `ringSections` ring mean. Returns the body so you can `destroy()` it and
     * rebuild after deforming the line (a crater re-chains that stretch).
     *
     * A chain is ONE-SIDED. Points left-to-right along the top of your terrain
     * gives solid ground below, which is what a heightfield from
     * `generateTerrain` already is. Reverse the order (or the loop's winding) to
     * put the solid side on the other face — a ceiling, or a cave you are inside.
     */
    chain(points: readonly VecPt[], opts?: ChainOptions): Body2d;
    /**
     * A CAPSULE body for one thick stroke — a rod, a beam, a girder. The right
     * primitive for a line with width: a two-point polygon is degenerate, and a
     * box has corners a capsule does not.
     */
    capsule(x0: number, y0: number, x1: number, y1: number, radius: number, opts?: BindShapeOptions): Body2d;
    /**
     * Draw the whole physics world as LINE ART, through the vector layer.
     *
     * ```ts
     * override draw(d: Draw): void {
     *   super.draw(d);
     *   this.world.debugDraw(this.game.vector);
     * }
     * ```
     *
     * Every shape Box2D is actually simulating, in its actual pose — the fastest
     * way to see that a hull came out the shape you meant, that a chain is on the
     * side you meant, or that a sensor is where you meant. It works for SPRITE
     * bodies too, so an ordinary sprite game gets a glowing collision overlay for
     * one line.
     *
     * Built on the typed shape API (`b2Body_GetShapes` + `b2Shape_GetPolygon` and
     * friends) rather than Box2D's own debug-draw command buffer: that buffer is
     * an undocumented 140-byte packed struct, and reading it means hard-coding
     * offsets that a Box2D bump would silently move.
     */
    debugDraw(layer: DebugDrawTarget, opts?: DebugDrawOptions): void;
    /**
     * Cast a ray from `from` to `to` (both world space); returns the nearest body
     * hit, or `null`. Line-of-sight, laser sights, ground probes.
     */
    raycast(from: Vec2, to: Vec2): RayHit | null;
    /**
     * A radial explosion at `at` (world space) within `radius` units, kicking every
     * dynamic body outward with `strength` (impulse per unit of overlap). Barrels,
     * bombs, shockwaves.
     */
    explosion(at: Vec2, radius: number, strength: number): void;
    /** A revolute joint (hinge / pivot) between two bodies — see-saws, ragdoll joints, powered wheels, doors. */
    pin(a: Body2d, b: Body2d, opts?: PinOptions): Joint2d;
    /** A distance joint (rigid rod by default, or a slack rope / bouncy spring) between two bodies. */
    rope(a: Body2d, b: Body2d, opts?: RopeOptions): Joint2d;
    /** A prismatic joint (slider): body B may only move along one axis relative to body A — pistons, elevators, sliding doors. */
    slider(a: Body2d, b: Body2d, opts?: SliderOptions): Joint2d;
    /** A weld joint: locks two bodies rigidly together (breakable structures, compound bodies). */
    weld(a: Body2d, b: Body2d, at?: Vec2): Joint2d;
    /**
     * A wheel joint — a spring-suspension axle for a vehicle. The wheel body
     * travels along `axis` (the suspension, default vertical) against a spring and
     * spins freely, with an optional drive motor. THE way to build a car: the
     * chassis floats on the springs above the wheels, so bumps are absorbed and the
     * body stays level — unlike a rigid `pin` axle, which fights every torque and
     * judders. Drive it live via the returned joint's `motor(speed, torque)`.
     */
    wheel(a: Body2d, b: Body2d, opts: WheelOptions): Joint2d;
    /**
     * Grab a body and drag it toward a moving target point — a mouse / touch joint.
     * Returns a handle: call `moveTo(point)` each frame with the pointer, and
     * `release()` to let go (the body keeps its velocity, so a moving release throws
     * it). Grab a ragdoll limb and the joints drag the rest along.
     */
    grab(body: Body2d, at: Vec2, opts?: GrabOptions): Grab2d;
    /**
     * Step the world and sync every dynamic sprite. The scene calls this for you
     * once you set `scene.physics2d = world`; call it yourself only if you drive
     * the world outside a scene.
     */
    update(dt: number): void;
    /** Tear the world down (frees the WASM side). Sprites stay where they were. */
    destroy(): void;
}
export {};

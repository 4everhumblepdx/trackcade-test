// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/**
 * Physics3d — OPTIONAL rigid-body physics for the World3d layer. A thin,
 * engine-vocabulary wrapper over a vendored WASM physics core that ships as a
 * SEPARATE chunk (`physics3d-core.mjs`, ~1 MB): games that never call
 * `Physics3d.create()` never load a byte of it.
 *
 *   // setup() — one await, then attach to the world and it's hands-free:
 *   this.sim = await Physics3d.create({ gravity: -20 });
 *   world.physics = this.sim;                    // the game steps + syncs it
 *   this.sim.bind(ground, { type: 'static' });   // level geometry
 *   const crate = this.sim.bind(crateMesh, { bounce: 0.2 });
 *   crate.impulse({ x: 0, y: 6, z: -3 });
 *
 * What the wrapper hides ON PURPOSE (never reach past it): the WASM module
 * and its manual memory rules, body/shape handle plumbing, quaternion
 * conventions (bodies write the mesh's yaw/pitch/roll pose — steer dynamics
 * with forces, never by setting the rotation), density units (a 1×1×1 box has
 * mass 1), bigint collision bits (use string `group`/`hits` names), and the
 * fixed-timestep accumulator.
 *
 * V2 NOTE: World3d meshes are retained INSTANCED handles (x/y/z, w/h/d,
 * yaw/pitch/roll) with no vertex data on the handle, so the collision shapes
 * derivable from w/h/d alone are the primitives: `box`, `sphere`, `capsule`.
 * For loaded models there is also `'hull'` — the caller PASSES the convex
 * points (`hullOfVerts` over the model's unit-fit geometry) since the handle
 * carries no vertex data; the wrapper scales them by w/h/d exactly like box
 * half-extents. (Raster's `ring`/`mesh` shapes did not survive the port.)
 */
import { type V3 as Vec3 } from './math3d.js';
/**
 * The structural mesh shape `bind()` accepts — anything with a World3d
 * `Mesh3d`'s pose fields (a real Mesh3d, or a plain object in headless tests).
 * `w/h/d` are the FULL sizes along each axis (the v2 unit-geometry rule: a
 * sphere with w=h=d=2 has radius 1); `yaw/pitch/roll` are Euler radians
 * applied in the renderer's Y→X→Z order.
 */
export interface MeshLike3d {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
    yaw: number;
    pitch: number;
    roll: number;
}
/** Options for `Physics3d.create`. */
export interface Physics3dOptions {
    /** Gravity: a number is world-units/s² straight down (`-20` default — arcade-weighty), or a full vector. */
    gravity?: number | Vec3;
    /** Override the physics core module URL (rarely needed — the default finds the shipped chunk). */
    module?: string;
}
/** Options for `world.bind`. */
export interface BindOptions {
    /**
     * `'dynamic'` (default) — fully simulated. `'static'` — immovable level
     * geometry. `'kinematic'` — YOU move the mesh (position/rotation as usual)
     * and it pushes dynamic bodies physically (moving platforms, doors on
     * rails).
     */
    type?: 'dynamic' | 'static' | 'kinematic';
    /**
     * Collision shape: `'auto'` (default — a box of the mesh's w/h/d),
     * `'sphere'`, `'capsule'` (upright), or `'hull'` (convex wrap of the
     * `points` you supply — loaded OBJ/GLB models, ramps, rocks; build them
     * with `hullOfVerts` over the model's geometry). Match it to the visual:
     * World3d spheres want `'sphere'`, capsule pawns want `'capsule'`,
     * everything box-ish (boxes, roundedBoxes, panels) is happy as a box.
     * NOTE a hull is CONVEX — a donut's hull is a solid disc.
     */
    shape?: 'auto' | 'box' | 'sphere' | 'capsule' | 'hull';
    /**
     * The `'hull'` shape's point cloud: flat xyz triples in the mesh's LOCAL /
     * unit space (the same space as unit-fit model geometry — spanning ±0.5
     * per full-size axis). The wrapper scales them by the mesh's w/h/d exactly
     * like it derives box half-extents. Feed it `hullOfVerts(model.verts)`.
     * Required for `shape: 'hull'` (missing/degenerate points fall back to the
     * w/h/d box).
     */
    points?: Float32Array;
    /** Surface grip 0..1+. Default `0.5`. */
    friction?: number;
    /** Bounciness 0..1. Default `0`. */
    bounce?: number;
    /** Rolling resistance 0..~0.1 — rolling bodies naturally slow down (rubber tyres, felt balls). Default `0` (rolls forever). */
    rollingResistance?: number;
    /** Total mass (dynamic bodies). Default: ~1 per cubic unit of bounds. */
    mass?: number;
    /** Collision group name (see `hits`). Default `'default'`. */
    group?: string;
    /** Group names this body collides with. Default: everything. */
    hits?: string[];
    /** Sensor mode: overlaps fire `onEnter`/`onExit` but apply NO contact forces (pickup zones, pressure plates). */
    trigger?: boolean;
    /** A body entered this trigger (trigger bodies only). */
    onEnter?: (other: Body3d) => void;
    /** A body left this trigger (trigger bodies only). */
    onExit?: (other: Body3d) => void;
    /** Contact started with another body (`speed` = approach speed — gate impact sounds on it). Fires only above the solver's impact threshold; use `onTouch` for every contact. */
    onHit?: (other: Body3d, speed: number) => void;
    /** Contact BEGAN with another body (any speed — standing-on bookkeeping, stickiness, "what am I touching"). */
    onTouch?: (other: Body3d) => void;
    /** Contact ENDED with another body — the pair separated (left the platform, dropped the crate). */
    onRelease?: (other: Body3d) => void;
    /** Continuous collision for fast movers (bullets) — stops tunneling through thin walls. */
    fast?: boolean;
    /** Linear damping (air drag). Default `0`. */
    damping?: number;
    /** Angular damping. Default `0.05`. */
    angularDamping?: number;
    /** Gravity multiplier for this body (0 = floats). Default `1`. */
    gravityScale?: number;
    /** Freeze all rotation (top-down pucks, upright props). Default `false`. */
    lockRotation?: boolean;
    /** Allow very fast rotation (the solver clamps angular speed by default) — set on WHEELS and other high-RPM bodies or their top speed rev-limits. Default `false`. */
    fastSpin?: boolean;
    /**
     * Center-of-mass offset in the mesh's LOCAL space. A car with `balance:
     * {y: -0.4}` carries its weight low like a real car (planted, hard to
     * flip); a roly-poly toy uses a big negative y. Default: the geometric
     * center of the collision shape.
     */
    balance?: Vec3;
    /**
     * Conveyor belt: the surface drags whatever rests on it at this velocity
     * (the body itself stays put — usually a `'static'` belt). The vector is in
     * the shape's LOCAL space: an unrotated belt moving cargo along world −Z is
     * `{ x: 0, y: 0, z: -3 }`; rotate the mesh and the belt direction turns
     * with it. Higher `friction` = more grip on the cargo.
     */
    conveyor?: Vec3;
    /**
     * Family name: bodies sharing a family NEVER collide with each other while
     * still colliding with the rest of the world — the ragdoll/compound-creature
     * knob (limbs must overlap at the joints without fighting). Independent of
     * `group`/`hits`.
     */
    family?: string;
}
/** Options for `world.character`. */
export interface Character3dOptions {
    /** Capsule radius. Default `0.4`. */
    radius?: number;
    /** Total capsule height. Default `1.7`. */
    height?: number;
    /** Ground friction while standing still. Default `0.1` (low — movement is velocity-driven). */
    friction?: number;
    /** Collision group. Default `'characters'`. */
    group?: string;
}
/** Options for `world.hinge`. */
export interface HingeOptions {
    /** World-space anchor point the hinge rotates around. */
    at: Vec3;
    /** World-space hinge axis. Default `{x:0, y:1, z:0}` (a door). */
    axis?: Vec3;
    /** Swing limits in radians `[min, max]` about the axis. Omit for free spin. */
    limits?: [number, number];
    /** Drive the hinge: radians/second (+ torque budget). The windmill/motor knob. */
    motor?: {
        speed: number;
        torque?: number;
    };
}
/** Options for `world.slider`. */
export interface SliderOptions {
    /** World-space anchor on the slide axis. */
    at: Vec3;
    /** World-space slide axis. Default `{x:0, y:1, z:0}` (an elevator). */
    axis?: Vec3;
    /** Travel limits along the axis `[min, max]` in world units. */
    limits?: [number, number];
    /** Drive the slide: units/second (+ force budget). */
    motor?: {
        speed: number;
        force?: number;
    };
}
/** Options for `world.spring`. */
export interface SpringOptions {
    /** Rest length. Default: the current distance between the two anchors. */
    length?: number;
    /** Spring stiffness in Hz (oscillations/sec). Default `3`. */
    hertz?: number;
    /** Damping 0..1 (1 = no wobble). Default `0.35`. */
    damping?: number;
    /** World anchor on body A. Default: A's origin. */
    atA?: Vec3;
    /** World anchor on body B. Default: B's origin. */
    atB?: Vec3;
}
/** Options for `world.socket` (ball-and-socket joint). */
export interface SocketOptions {
    /** World-space anchor — the ball center (a shoulder, a hip, a chain link). */
    at: Vec3;
    /**
     * The rest-pose axis the swing cone opens around, world space — point it
     * along the CHILD limb (shoulder → elbow). Default `{x:0, y:-1, z:0}`
     * (a limb hanging down).
     */
    axis?: Vec3;
    /** Max swing away from `axis` in radians. Omit for a free ball joint. */
    swing?: number;
    /** Twist limits about `axis` in radians `[min, max]`. Omit for free twist. */
    twist?: [number, number];
    /** Joint stiffness: a soft spring pulling back to the rest pose (Hz). Adds life to ragdolls. Default off. */
    stiffness?: number;
}
/** Options for `world.wheel` — a vehicle wheel with suspension, drive and steering. */
export interface WheelOptions {
    /** World-space wheel center at rest pose. */
    at: Vec3;
    /** World-space axle (spin) axis. Default `{x:1, y:0, z:0}` — a car facing ±Z. */
    axle?: Vec3;
    /** Suspension spring stiffness in Hz. Default `3.5`. */
    hertz?: number;
    /** Suspension damping 0..1 (1 = no bounce). Default `0.7`. */
    damping?: number;
    /** Suspension travel `[down, up]` in world units around the rest pose. Default `[-0.25, 0.15]`. */
    travel?: [number, number];
    /** This wheel is powered — `joint.motor(speed)` drives it (rad/s). Torque budget optional. */
    drive?: boolean | {
        torque?: number;
    };
    /** This wheel steers — `joint.steer(angle)` aims it (radians). `limit` caps the lock. Default lock `0.65`. */
    steer?: boolean | {
        limit?: number;
        torque?: number;
    };
}
/** Options for `world.grab` (motor joint — hold + drive a body relative to another). */
export interface GrabOptions {
    /** Max holding force (how heavy a thing it can carry against gravity/knocks). Default `200`. */
    force?: number;
    /** Max holding torque (how firmly it resists spinning away). Default `100`. */
    torque?: number;
    /** Hold spring stiffness in Hz. Default `5` (snappy). Lower = laggy tractor-beam feel. */
    stiffness?: number;
    /** Hold damping 0..1. Default `0.8`. */
    damping?: number;
}
/** A joint — keep the handle to drive its motor or `destroy()` it. */
export interface Joint3d {
    /** Retune the motor (hinge: rad/s; slider: units/s; wheel: spin rad/s). No-op on springs/welds. */
    motor(speed: number, strength?: number): void;
    /** Steer a wheel joint to this angle in radians (no-op on other joints). */
    steer?(angle: number): void;
    /** Grab joints: drive the held body at this relative velocity (units/s, optional angular rad/s). */
    drive?(linear: Vec3, angular?: Vec3): void;
    /** Remove the joint (bodies separate). */
    destroy(): void;
}
/**
 * A physics body bound to a mesh. Dynamic bodies OWN the mesh transform —
 * steer them with `impulse`/`force`/`velocity`, never by writing x/y/z
 * (except `teleport`). Kinematic bodies are the reverse: move the MESH.
 */
export declare class Body3d {
    /** The mesh this body drives (dynamic) or follows (kinematic). */
    readonly mesh: MeshLike3d;
    /** `'dynamic' | 'static' | 'kinematic'`. */
    readonly type: 'dynamic' | 'static' | 'kinematic';
    /** Contact callback (assign any time). */
    onHit: ((other: Body3d, speed: number) => void) | null;
    /** Contact began / ended (any speed). */
    onTouch: ((other: Body3d) => void) | null;
    onRelease: ((other: Body3d) => void) | null;
    /** Trigger callbacks (trigger bodies). */
    onEnter: ((other: Body3d) => void) | null;
    onExit: ((other: Body3d) => void) | null;
    /** Current linear velocity. */
    get velocity(): Vec3;
    set velocity(v: Vec3);
    /** Current angular velocity (rad/s per axis). */
    get spin(): Vec3;
    set spin(v: Vec3);
    /** The body's mass (dynamic bodies). */
    get mass(): number;
    /**
     * Instant kick, scaled so `impulse({y: 6})` pops a 1-mass crate ~as high as
     * you'd guess regardless of its actual mass. Pass `at` (world point) to
     * also spin it — hits off-center tumble.
     */
    impulse(v: Partial<Vec3>, at?: Vec3): void;
    /** Continuous push (accumulates until the next step) — thrusters, wind. Mass-scaled like `impulse`. */
    force(v: Partial<Vec3>): void;
    /** Instantly move the body (and its mesh) — respawns. Clears velocity. Optional `rotation` is Euler radians (the mesh's yaw/pitch/roll convention); omitted = upright. */
    teleport(position: Vec3, rotation?: {
        yaw?: number;
        pitch?: number;
        roll?: number;
    }): void;
    _pose1: Float32Array<ArrayBuffer>;
    /**
     * Remove this body from the world (the mesh stays where it was). Safe to
     * call twice — the second call is a no-op. (Body slots are recycled by the
     * solver; an unguarded double-destroy could kill an unrelated NEW body.)
     */
    destroy(): void;
}
/**
 * A capsule character controller: a rotation-locked dynamic body with
 * velocity-driven movement — pushes crates, rides platforms, climbs shallow
 * steps by capsule shape, and reports `grounded` for jump gating.
 *
 *   this.hero = this.sim.character(heroMesh, { radius: 0.4, height: 1.6 });
 *   // in update(): this.hero.move({ x, z }, 6); if (jump && this.hero.grounded) this.hero.jump(9);
 */
export declare class Character3d extends Body3d {
    /** Steer: set horizontal velocity toward `dir` (any length) at `speed`, keeping vertical motion. */
    move(dir: {
        x: number;
        z: number;
    }, speed: number): void;
    /** Standing on something (within a small tolerance below the feet)? */
    get grounded(): boolean;
    /** Jump with takeoff speed `v` (only fires while `grounded`). Returns whether it fired. */
    jump(v: number): boolean;
}
/**
 * The physics world. `await Physics3d.create()` once in an async setup, bind
 * meshes, attach to the world (`world.physics = sim`) and everything else is
 * hands-free. All shapes are built from each mesh's CURRENT pose + w/h/d at
 * bind time — place meshes first, bind second.
 */
export declare class Physics3d {
    private evTouch;
    private evHit;
    private evSensor;
    /** Diagnostic: count of body handles found stale during sync (should stay 0). */
    invalidBodies: number;
    private constructor();
    /**
     * Load the physics core (first call fetches the ~1 MB chunk; later calls
     * are instant) and create a world. One world per scene is the pattern.
     */
    static create(opts?: Physics3dOptions): Promise<Physics3d>;
    /**
     * Give a mesh a physics body. The shape is built from the mesh's w/h/d;
     * position/rotation come from where the mesh IS right now. Returns the
     * `Body3d` (dynamic bodies then own the mesh's transform).
     */
    bind(mesh: MeshLike3d, opts?: BindOptions): Body3d;
    /** The capsule character controller (see `Character3d`). The mesh should be roughly `height` tall with its origin at the center. */
    character(mesh: MeshLike3d, opts?: Character3dOptions): Character3d;
    /** Look up the body bound to a mesh (or `null`). */
    bodyOf(mesh: MeshLike3d): Body3d | null;
    /**
     * Nearest physics hit along a ray — the PHYSICS-world query (line of sight
     * to bodies, ground checks). Pass `ignore` to skip one body (the shooter).
     */
    raycast(origin: Vec3, dir: Vec3, maxDistance?: number, ignore?: Body3d, opts?: {
        hits?: string[];
    }): {
        body: Body3d;
        point: Vec3;
        normal: Vec3;
        distance: number;
    } | null;
    /**
     * EVERY hit along a ray, sorted nearest-first — pierce-through weapons,
     * "what's between me and the target" lists. Pass `hits` to only see those
     * collision groups.
     */
    raycastAll(origin: Vec3, dir: Vec3, maxDistance?: number, opts?: {
        hits?: string[];
    }): {
        body: Body3d;
        point: Vec3;
        normal: Vec3;
        distance: number;
    }[];
    /**
     * Every body overlapping a SPHERE (exact narrowphase) — blast radii, aura
     * effects, "who is standing near the shrine". Pass `hits` to restrict to
     * collision groups.
     */
    overlap(center: Vec3, radius: number, opts?: {
        hits?: string[];
    }): Body3d[];
    /** Every body overlapping an axis-aligned BOX of `size` at `center` — room zones, platform occupancy. */
    overlapBox(center: Vec3, size: Vec3, opts?: {
        hits?: string[];
    }): Body3d[];
    /** Radial blast: every dynamic body within `radius` gets a mass-scaled outward kick (with a little lift). */
    explosion(at: Vec3, radius: number, strength: number): void;
    /**
     * A hinge (revolute joint): doors, windmill hubs, seesaws, drawbridges,
     * wheels. Anchor at the world point, spinning about `axis`. Add `motor` to
     * drive it; `limits` to stop the swing.
     */
    hinge(a: Body3d, b: Body3d, opts: HingeOptions): Joint3d;
    /**
     * A ball-and-socket (spherical joint): shoulders, hips, necks, chain links,
     * hanging signs. Free rotation about the anchor, optionally fenced by a
     * `swing` cone around `axis` and `twist` limits about it — the ragdoll
     * joint (pair with `family` on the limb bodies so they overlap in peace).
     */
    socket(a: Body3d, b: Body3d, opts: SocketOptions): Joint3d;
    /** A slider (prismatic joint): elevators, pistons, sliding doors, plungers. */
    slider(a: Body3d, b: Body3d, opts: SliderOptions): Joint3d;
    /**
     * A vehicle wheel: suspension spring + spin motor + steering in ONE joint —
     * the entire car recipe is a chassis, four wheel bodies, four of these.
     * Drive with `joint.motor(radPerSec)`, aim with `joint.steer(angle)`.
     * Convention: suspension travels world-vertical at the rest pose; the wheel
     * spins about `axle` (default +X — a car built facing ±Z).
     */
    wheel(chassis: Body3d, wheelBody: Body3d, opts: WheelOptions): Joint3d;
    /** A springy rope (distance joint with a soft spring): pendulums, cranes, bungees, suspension. */
    spring(a: Body3d, b: Body3d, opts?: SpringOptions): Joint3d;
    /**
     * A motorized grip (motor joint): softly HOLDS body `b` at its current pose
     * relative to `a`, with force/torque budgets — tractor beams, grabber claws,
     * magnets, telekinesis, "carry the crate in front of the player". Unlike
     * `weld` it's springy and breakable-feeling; unlike `spring` it holds
     * orientation too. `joint.drive(v)` slides the held pose around.
     */
    grab(a: Body3d, b: Body3d, opts?: GrabOptions): Joint3d;
    /** Lock two bodies rigidly together (build a compound after the fact, glue a rider to a platform). */
    weld(a: Body3d, b: Body3d, at?: Vec3): Joint3d;
    /**
     * Advance the simulation and sync every bound mesh. Attach the world to the
     * 3D layer (`world.physics = sim`) and this is called for you every frame —
     * call it yourself only when running physics without a World3d.
     */
    update(dt: number): void;
    /** Tear the world down (frees the WASM side). The meshes stay. */
    destroy(): void;
}

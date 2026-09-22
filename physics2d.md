# Box2D physics — rigid bodies, joints, ragdolls (`Physics2d`)

Real rigid-body simulation: stacking, tipping, friction, restitution, joints,
motors, ragdolls, vehicles. Box2D v3 through a WASM core that is **lazily
loaded** (~640 KB, fetched on the first `Physics2d.create()` and cached after).

```ts
const world = await Physics2d.create({ gravity: 900 });
this.physics2d = world;                        // the scene steps and syncs it
world.bind(ground, { type: 'static' });
const crate = world.bind(box, { bounce: 0.2, friction: 0.8 });
crate.impulse({ x: 300, y: -400 });
```

**This is not the default collision system.** `sprites.md`'s arcade overlap
tests are cheaper and are the right answer for a platformer, a shooter, a
top-down game — anything where you want *control* over the response. Reach for
Box2D when the simulation IS the game: a physics puzzler, a bridge builder, a
pinball table, a car, a ragdoll. A bound sprite skips the arcade integrator
entirely; the two do not share a body.

## The world

`Physics2d.create(opts)` is async — it loads the core. Await it in the scene's
`preload`, or behind the loading screen.

- `gravity` — a number is downward units/s² (`900` default, a lively arcade
  weight), or a full `{x, y}` (**+y is down**, screen convention).
- `pixelsPerMeter` (32) — Box2D is tuned for bodies roughly 0.1–10 m, so the
  wrapper simulates in metres and scales. At the default a 32-unit sprite is a
  1-metre body. Fixed at create time; you rarely touch it. If your sprites are
  hundreds of units across and everything feels like it is falling through
  treacle, this is the dial.
- `substeps` (4) — solver refinement per step. Raise to 8 for tall stacks,
  precise restitution (a Newton's cradle), or stiff joint chains.

Assign it to `scene.physics2d` and the scene steps it, syncs every bound
target, and fires the callbacks — before joints and collision see positions.
Outside a scene, call `world.update(dt)` yourself.

**The step is fixed at 60 Hz**, accumulated, capped at 3 steps per frame so a
hitch cannot spiral into a death loop. Rendering **interpolates** between the
last two poses, so bodies are smooth at any display rate — which also means a
body's rendered position is a frame behind the solver's. Read `body.velocity`,
not the sprite's frame-to-frame delta.

## Giving something a body

Four ways in, and they differ only in where the shape comes from.

| | |
|---|---|
| `bind(sprite, opts)` | a box or circle from the sprite's CURRENT `x/y/w/h` |
| `bindShape(shape, opts)` | a hull (or decomposition) of a `VectorShape`'s outline |
| `chain(points, opts)` | a one-sided polyline — terrain, tracks, arena walls |
| `capsule(x0,y0,x1,y1,r, opts)` | a stadium — limbs, logs, rounded platforms |

All of them read the geometry as it is **right now**. Place the sprite, then
bind. `body.destroy()` removes it; `world.bodyFor(sprite)` and
`bodyForShape(shape)` find one again. Binding the same target twice returns the
existing body rather than making a second.

`scale` is baked at bind time — Box2D fixtures do not scale. Changing a bound
shape's `scale` moves the drawing and leaves the body where it was.

### BindOptions

- `type` — `'dynamic'` (default), `'static'` (walls, floors — never moves),
  `'kinematic'` (**you** move the target and it shoves dynamic bodies without
  being shoved back: moving platforms, doors, paddles).
- `shape` — `'auto'` (a box the size of the hitbox), `'box'`, `'circle'`
  (+ `radius`). `bindShape` instead takes `'hull'` (default), `'box'`,
  `'circle'`, `'decompose'`.
- `friction` (0.6), `bounce` (0), `density` (1 — mass is density × area).
- `damping` (0) linear drag, `angularDamping` (0.05 — spins settle),
  `gravityScale` (1 — `0` floats, `2` falls twice as hard).
- `fixedRotation` — slides and stacks but never spins. Top-down pucks, upright
  characters, paddles.
- `bullet` — continuous collision, so a fast mover cannot tunnel through a thin
  wall. Costs a little; set it on the fast body only, never on the wall.
- `balance: { x, y }` — shift the centre of mass off the shape's centre, in
  units from the sprite centre (+y down). A low centre of mass resists tipping:
  a car with `balance: { y: 16 }` stays planted instead of wheelie-ing over.
- `trigger` — a sensor. Overlaps fire `onEnter`/`onExit` and apply **no**
  contact forces: pickups, goal areas, trigger plates.

### Who collides with whom

Two orthogonal knobs, and picking the wrong one is the usual mistake.

- **`group` / `hits`** — a body is in `group` and collides only with the group
  names listed in `hits` (omit `hits` = collides with everything). This is the
  layer system: `{ group: 'enemy', hits: ['wall', 'bullet'] }`. Up to 31 of
  them; asking for a 32nd throws rather than silently failing.
- **`family`** — bodies sharing a family **never** collide with each other,
  while still colliding with the rest of the world. This is the ragdoll knob:
  limbs must overlap at the joints without shoving each other apart. A group
  cannot express it, because the limbs still need to hit the floor.

### Contact callbacks

Assignable at bind time or any time after, on the body.

| | |
|---|---|
| `onHit(other, speed)` | contact started, with approach speed in units/s — **gate impact sounds and damage on this**, or a resting crate machine-guns you with hits |
| `onTouch(other)` / `onRelease(other)` | contact began / ended at any speed — "what am I standing on" bookkeeping |
| `onEnter(other)` / `onExit(other)` | trigger bodies only |

## Moving a body

```ts
body.velocity = { x: 200, y: 0 };     // and readable
body.spin = 4;                        // rad/s, screen-clockwise +
body.impulse({ x: 0, y: -450 });      // a jump: instant change, mass-scaled
body.force({ x: 120, y: 0 });         // sustained push, per step
body.torque(6);                       // ANGULAR acceleration, rad/s^2, per step
body.teleport({ x, y }, angle);       // hard move, clears the interpolation
body.mass;                            // read-only
```

`force` and `torque` are cleared after every step, so apply them **each frame**
while the input is held. Both are **accelerations**, scaled by the body's own mass
and rotational inertia — so the number means the same thing on a pebble and on
a chassis, and you tune it once rather than per body. (`body.mass` and
`body.inertia` are readable if you want the raw figures.)

`impulse` takes an optional world point to apply at, which is how you make
something spin by hitting it off-centre. Prefer impulse/force over writing
`velocity` every frame — overwriting velocity fights the solver and makes
stacks jitter.

## Joints

Every one returns a `Joint2d` with `destroy()` and `motor(speed, effort)`.
Breaking a joint leaves both bodies alive.

| | |
|---|---|
| `pin(a, b, { at, limits, motorSpeed, maxTorque })` | a hinge — see-saws, doors, ragdoll joints, powered wheels |
| `rope(a, b, { length, limits, hertz, damping })` | a distance constraint; `hertz: 0` is a rigid rod, `limits: [0, len]` a rope that can go slack |
| `slider(a, b, { axis, limits, motorSpeed, maxForce })` | a prismatic axle — pistons, elevators, sliding doors |
| `weld(a, b, at?)` | rigidly fused; the breakable-structure primitive |
| `wheel(a, b, { at, axis, hertz, damping, motorSpeed, maxTorque })` | a spring-suspension axle |

**`wheel` is how you build a car.** A rigid `pin` axle fights every torque and
judders; a wheel joint floats the chassis on springs above the wheels, so bumps
are absorbed and the body stays level. Drive it live with `joint.motor(speed,
torque)`.

## Grabbing, casting, exploding

```ts
const grab = world.grab(body, pointer);   // on press
grab.moveTo(pointer);                     // each frame
grab.release();                           // keeps its velocity — a moving release throws
```

`stiff: true` (default) tracks the pointer closely and lets the body dangle
from the grab point; `stiff: false` is a springy rubber band for slingshots and
tractor beams. Both cap their force, so dragging a ragdoll cannot tear it apart.

`world.raycast(from, to)` returns the nearest `{ body, point, normal, distance }`
or `null` — line of sight, laser sights, ground checks under a character.

`world.explosion(at, radius, strength)` applies a falloff impulse to everything
in range.

## debugDraw — see what is actually being simulated

```ts
world.debugDraw(game.vector, { awake: '#39f0a0', asleep: '#2b5da0' });
```

Draws every body's real shape in its real pose through the **vector layer**, so
it comes out as glowing line art rather than flat overlay lines. Sleeping
bodies get their own colour, which is the fastest way to see a stack settle —
and the fastest way to spot a body that should have gone to sleep and hasn't.

This walks the world with the public query API (`b2Body_GetShapes` and
friends), NOT Box2D's own debug-draw command buffer — that buffer is a C
callback surface embind does not expose cleanly, and its layout can move under
a Box2D bump without a word.

Any object with `seg`/`poly`/`arc` satisfies it, so a HUD surface or a custom
target works too.

## Traps

Every one of these was hit while building this, and none of them errors.

- **Place first, bind second.** Shapes are built from the target's geometry at
  bind time.
- **Box2D polygons are convex and capped at 8 vertices.** `bindShape` hulls and
  reduces automatically; 9+ points passed raw returns a null shape and draws
  nothing, with no error. Use `'decompose'` when a concave notch matters to
  play — a ship's cockpit dent, a U-shaped bucket that must actually hold
  things.
- **An open chain treats its first and last points as GHOST vertices** and
  builds only `count - 3` segments. `chain()` extrapolates a ghost past each
  end so the terrain you passed in is the terrain you get.
- **A chain is one-sided**, and the y flip into Box2D's y-up frame reverses
  which side. `chain()` reverses the point order after the flip, so screen-space
  winding means what it looks like. Either of those two bugs alone drops
  everything through the floor.
- **The outline is never re-centred on its centroid.** Box2D computes centre of
  mass from the shape, so an off-centre outline spins about its true balance
  point — which is what you want, and is why a lopsided rock tumbles correctly.
- **Angles are screen-clockwise** here and counter-clockwise in Box2D; the
  wrapper flips on the way in and out. If you reach past it into `_body`, you
  own the conversion.
- **Don't write `velocity` every frame** to steer something that also collides.
  Use `force`/`impulse`, or the solver spends every step undoing your assignment.

## Relates to

- [sprites.md](sprites.md) — arcade overlap collision, the cheaper default.
- [vector.md](vector.md) — `bindShape` drives vector outlines; `debugDraw`
  renders through that layer.
- [scenes.md](scenes.md) — `scene.physics2d` is what steps the world.

Examples: `physics2d.ts` and the set beside it (bowling, bridge, buggy, cradle,
dominoes, launcher, pinball, plinko, pyramid, ragdoll, tumbler, wreckingball),
`joint-swing/grapple/climb.ts`, and `vector-physics.ts` / `vector-lander.ts`
for the vector-shape path.

Signatures: engine/webgpu/physics2d.d.ts.

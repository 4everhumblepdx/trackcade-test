# Terrain — landscapes, deformable snow/sand, grass, riding the ground

Everything here lives ON the 3D world: `const world = await game.world3d()`
first (see [world3d.md](world3d.md)), then `world.terrain()` and build up.

## How do I…

**…a LANDSCAPE (hills, an island, mountains, dunes)?** `const terrain =
world.terrain()` — one call, zero assets: a seeded heightfield chunked into
static meshes and coloured by height/slope bands. Options: `{ size: 400,
res: 128, height: 30, seed, shape: 'island' | 'hills' | 'mountains' |
'dunes' | 'flat' | (x, z) => h01, surface: 'grass' | 'sand' | 'snow' |
'rock', bands: [{ h, color, steep }], featureSize }`.

- `featureSize` is world units per landform (default size/3). When you grow
  `size`, keep it absolute (~300) so a bigger terrain gains MORE hills, not
  the same hills zoomed up.
- `terrain.heightAt(x, z)` is triangle-exact against the render — place
  karts/characters/pickups with it and they sit ON the ground.
  `terrain.normalAt` / `slopeAt` give lean and steepness.
- Terrain is centred on the origin; `y` offsets the base. `terrain.kill()`
  removes it (reseed freely). Custom `bands` heights are normalised 0..1 of
  `height`; `steep` is the cliff colour blended in by slope.
- Example: examples/terrain3d.ts (walk mode has a human-scale character on
  `heightAt` — the best judge of scale).

**…SNOW/SAND the player CARVES (SSX trails, tyre tracks, footprints)?**
`terrain.deformable()` then `terrain.carver(thing, { radius, depth })` —
`thing` (any live `{x, y, z}` — a mesh, a group) now cuts a trail wherever
it touches the ground. Options: `deformable({ depth: 0.6, heal: 0,
thickness: 0.6, patch: 240, cells: 288, layer, window, res, under, albedo,
sparkle, rim, sink })` — `heal: 0.16` makes SAND that drifts shut; snow
(heal 0) persists. Manual dents: `terrain.carve(x, z, r, d)` (craters,
explosions).

- Carvers cut only while MOVING and only ON CONTACT — catch air and the
  trail breaks there (it checks `target.y` vs the ground, so keep the
  target's y honest).
- After deformable(): `terrain.heightAt` = the carved snow surface,
  `terrain.groundAt` = the bedrock `thickness` below (carves clamp to it),
  `carveDepthAt` reads the carve alone. Ease a rider's y toward heightAt
  (or use `TerrainRider`, which does).
- One deform window per terrain; it follows the FIRST carver — give the
  player's vehicle the first `carver()` call. Size `window` for speed
  (persistence ≈ 0.8 × window ÷ speed sec; texel = window/res ≲ carver
  radius).
- Full ride (board physics, spray, snow↔sand): examples/snowboard3d.ts.

**…grow GRASS on the terrain?** `const grass = terrain.grass({ height,
cells, dynamic, wind, color })` — a grass field bound to the terrain that
follows the camera: real wind-bent blades up close, billboard clump cards
out to the fog, so there is no visible "end of the grass zone". `density` =
total grass; `dynamic` (0..1) = the fraction that's real blades vs cheap
cards — the perf lever. Grass grows only where the terrain's colormap is
grassy, and re-lights with `world.sky()` for free. Example:
examples/veg-grass3d.ts.

**…anything that RIDES the terrain smoothly (board, kart, ball, walker,
GLB)?** `new TerrainRider({ groundAt })` — the shared no-jitter ground
controller. It owns the VERTICAL (ride height, orientation, the
grounded↔airborne state machine); YOU own horizontal motion (steer/thrust/
carve). Each frame: move x/z your way, then `rider.step(dt, x, z, yaw,
speed)` and read `rider.y / pitch / roll / grounded / landed / airTime`
(+ `groundY`/`lastGroundY` for an energy model that trades height for
speed).

- Pick the CONTACT SHAPE: `radius` → SPHERE (a ball/wheel — rides the
  averaged ground over its contact disc, smooth on inclines);
  `length`/`width` → PLANK (a board/kart/box — rests on its highest
  footprint contact, bridges dips, pivots crests, banks to the slope unless
  `tilt: false`); neither → point.
- Suspension ease (`followK`, capped by `followKMax`); air with
  momentum-carrying takeoff, `launch(vy)` jumps and a `landed` frame flag;
  `detach: Infinity` = glued (a ball stuck to a seabed).
- If the vehicle also carves, ride the fresh field: `groundAt: (x,z) =>
  terrain.field.heightAt(x,z)` — else it rides its own rut.
- Chase camera: `rig.follow(obj, { offset: { y: 2 } })` with the live
  handle — it re-reads `obj` at tick time (after your callback), so the
  camera can't lag a frame behind the rider. `rig.follow(null)` releases.
- Examples: snowboard3d.ts (plank board + air + carve), water3d.ts (glued
  sphere seabed ball).

## Relates to

- [world3d.md](world3d.md) — the 3D world this builds on: camera + orbit rig
  (`floor:` ground clamp!), meshes, lights, shadows.
- [sky-water3d.md](sky-water3d.md) — the sky re-lights the terrain through the
  day; water shoals against `terrain.heightAt` and streams carve channels
  into the terrain shape.
- [particles3d.md](particles3d.md) — snow spray, dust and weather over the
  landscape.

Signatures: engine/webgpu/terrain3d.d.ts, engine/webgpu/grass3d.d.ts, engine/webgpu/rider3d.d.ts, engine/webgpu/world3d.d.ts.

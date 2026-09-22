# The 3D world — perspective, boxes & billboards (opt-in)

2D is the default; `const world = await game.world3d()` ONCE (in setup — the
3D core is a separate lazy chunk, loaded on that first call: 2D games never
ship it; the one-await pattern physics uses) adds a perspective world that
renders UNDER the 2D layer and HUD. It holds two kinds of retained handles:

- **Meshes** — real geometry, instanced per shape (a thousand crates is still
  one draw call): `world.box()` (flat-shaded), the SMOOTH high-res primitives
  `world.sphere()`, `world.cylinder()`, `world.torus()`, `world.roundedBox()`
  (chamfered box), `world.cone()`, `world.capsule()` (pill), plus
  `world.wedge()` (a ramp — slope rises toward -x), `world.plane()`
  (double-sided flat quad), `world.circle()` / `world.ring()` (flat disc /
  annulus, both take `arc` for pie slices), `world.panel()` (an extruded
  ROUNDED-CORNER rectangle — cards/plaques, scale `h` thin), `world.disc()`
  (a filleted cylinder — coin / chip / puck; roll it upright for a wheel),
  `world.torusKnot()` (the (p,q) pretzel), the platonic solids
  `world.tetrahedron()` / `octahedron()` / `dodecahedron()` /
  `icosahedron()` (all take `detail` — 0 is faceted, higher rounds toward a
  geo-sphere), and the PATH family: `world.lathe({ points })` (a [d, y]
  profile bottom→top revolved around Y — vases, pawns), `world.tube({ path })`
  (a tube along a 3D polyline — pipes, coils; `closed` loops it),
  `world.shape({ outline })` (a flat filled [x, z] polygon, no holes) and
  `world.extrude({ outline, bevel })` (that polygon through unit height with
  a rounded bevel). Path inputs AUTO-FIT to the unit box — author in any
  scale, size with w/h/d. All take the same config; add `gloss: 0..1` for a
  Blinn-Phong highlight. The 3D pass renders with 4× MSAA by default —
  this is NOT a retro-only layer.

  **Textures + normal maps on every mesh**: any primitive takes
  `texture: <atlas frame>` (from `game.assets.frames()` / `await game.assets.loadFrames(url)`)
  plus optional `normalMap: <frame>` (a tangent-space map — tangents are
  reconstructed per fragment, no tangent data needed), `tile: n | {x, y}`
  (UV repeat — seamless textures tile across the surface) and `bump`
  (map strength, default 1). `color` MULTIPLIES the texture and defaults to
  white when `texture` is set — pass a colour to tint. UVs come from the
  geometry: spheres are EQUIRECT (a planet map wraps once — `sphere({
  texture: PLANET })` just works), cylinders/cones/torus/lathe/tube wrap
  their natural unwrap, and everything else (boxes, polyhedra, extrusions,
  custom soup) gets box-projected UVs automatically. All fields live-mutable
  like the rest of the handle. See `examples/textures3d.ts` for every
  primitive textured + normal-mapped from one gold pair.

  **Subdivision params on everything**: `sphere({ segs: 8, rings: 5 })`,
  `cylinder({ segs, rTop, rBottom, open, arc })` (frustums, uncapped tubes,
  portions), `cone({ segs, open, arc })`, `torus({ tube, segs, sides, arc })`,
  `plane({ segs })` (grid it under deformers — 2 tris interpolate everything
  across one diagonal), `box({ segs })`, `roundedBox({ r, segs })`,
  `capsule({ segs, rings, r })`, `panel({ r, segs })`,
  `disc({ fillet, segs, filletSegs })`. Geometry is BUCKETED BY PARAMS:
  every mesh sharing a parameter set shares ONE instanced draw, so a chunky
  low-poly game passes low segs everywhere and still pays one draw per
  shape. Each distinct parameter set = one extra bucket — vary with intent,
  not per mesh. Partial shapes always look SOLID: a capped `arc` portion is
  sealed with flat cut walls (a cut sausage / cheese wedge), `open` shells
  are double-sided (an open pipe shows its inside), and a lathe profile
  that stops short of the axis auto-seals its ends — no hollow interiors,
  no pinholes.
- **Billboards** — camera-facing sprites from the same atlas as 2D frames
  (the Paper-Mario look). Alpha-cutout: no sorting, depth just works, dense
  forests are free.

And the world hosts the bigger systems, each with its own doc:

- **Terrain, deformable snow/sand, grass, terrain riders** →
  [terrain3d.md](terrain3d.md)
- **Sky dome (day/night), lens flare, god rays, water** →
  [sky-water3d.md](sky-water3d.md)
- **Particles (CPU bursts + GPU storms), trails, wisps** →
  [particles3d.md](particles3d.md)

Everything gets per-fragment distance fog. **The 3D world is Y-UP** (x right,
z toward the camera) — the opposite of the 2D layer's y-down. Ground level
is y = 0; billboards stand ON their position (base-anchored). **`+Z` is
"forward" everywhere**: a mesh at `yaw 0` faces +Z, and `forward(yaw, pitch)`
(the inverse of `lookAtEuler`) plus `world.camera.face(yaw)` use that ONE
convention — so a first-person camera's `yaw` means the same as a mesh's.
Aim things with those helpers rather than hand-rolling `sin/cos` (that's how
you end up with a stray `−Z` and a view or barrel pointing the wrong way).

**YAW TURNS RIGHT AS IT INCREASES** — the mainstream / three.js / FPS sense
(clockwise seen from above). So to steer a player or camera, `right` (D / →)
is `yaw += rate*dt` and `left` (A / ←) is `yaw -= rate*dt`; move along
`forward(yaw)`. Left is minus, right is plus. To face a heading from a
velocity, use `lookAtEuler` (or `Math.atan2(-dx, dz)`).

```ts
// Drive a model with the camera behind it — left/right turn, up/down drive.
if (game.input.key('ArrowRight', 'KeyD')) player.yaw += 2.5 * dt;   // right = +yaw
if (game.input.key('ArrowLeft',  'KeyA')) player.yaw -= 2.5 * dt;   // left  = −yaw
const f = forward(player.yaw);
if (game.input.key('ArrowUp', 'KeyW')) { player.x += f.x * spd * dt; player.z += f.z * spd * dt; }
world.follow(player, { offset: { y: 6, z: 12 } });            // chase cam behind it
```

```ts
import { Game } from '../engine/webgpu.js';

const game = await Game.create({ background: '#101833' });
const TREE = game.assets.frames(treeCanvas);
const world = await game.world3d({ fov: 60, fog: { color: '#101833', near: 22, far: 70 } });

world.box({ x: 0, y: -0.5, z: 0, w: 120, h: 1, d: 120, color: '#33465f' }); // ground slab
const crate = world.box({ x: 3, y: 0.5, z: -2, color: '#a07840' });
world.billboard({ frame: TREE, x: -4, y: 0, z: 5, w: 2.4, h: 3.6 });

game.run((d, dt, t) => {
  crate.yaw += dt;                                  // handles are mutable
  world.camera.x = Math.sin(t * 0.1) * 26;          // orbit
  world.camera.z = Math.cos(t * 0.1) * 26;
  game.hud.text(font, 'HUD', 8, 8);                 // 2D always composites on top
});
```

## How do I…

**…move the camera?** Two ways. For gameplay cameras, mutate `world.camera`
— `x/y/z` (position), `tx/ty/tz` (look-at target), `fov` — per frame. For a
FIRST-PERSON camera, set the eye `x/y/z` then `world.camera.face(yaw, pitch)`
— it aims the target with the `+Z`-forward convention (same `yaw` as a mesh),
no hand-rolled trig; `camera.lookDir(dx, dy, dz)` aims along a direction and
`camera.lookAt(x, y, z)` at a point. For
inspect/orbit cameras (editors, showcases, DEBUGGING), attach the engine's
rig once: `const rig = world.orbit({ yaw, pitch, dist, target, fly: true })`
— left-drag orbits (drag left, view swings left), right-drag or
shift+drag pans, the wheel zooms toward the cursor (`zoomToCursor:
false` for centre zoom), and with
`fly: true` WASD/arrows move + Q/E rise/sink (shift = 3× speed). Flying
translates camera and pivot together at a CONSTANT speed — and the first
fly keypress flips the rig (stickily) into EXPLORE mode: from then on a
drag LOOKS AROUND from the camera's current position instead of swinging
it about the pivot, and any idle autoRotate stops. Until you fly, the rig
is a pure orbit — showcase scenes behave exactly as before. The rig
writes the camera every frame; `rig.yaw/pitch/dist/target` stay live,
`rig.enabled = false` pauses it, `rig.detach()` unwires it. TO
CHASE A MOVING OBJECT, `rig.follow(handle, { offset, ease })` — it re-reads
the live handle at tick time (after your callback), so the camera can't
lag a frame behind a rider/physics update (a hand-copied per-frame target
lags and jitters). ON
TERRAIN, ALWAYS wire the ground clamp so orbiting low never tunnels under
the landscape: `floor: (x, z) => terrain.heightAt(x, z)` (+ `floorMargin`,
default 1.5) — the eye is lifted, the look-at target is untouched.

**…animate a box / billboard?** Mutate the handle: `box.x/yaw/pitch/roll`,
`bb.x/frame/flipX/tint`. Remove with `.kill()`. Animate billboard frames by
writing `bb.frame = BASE + (t / 0.16 | 0) % 4` — same strips as 2D sprites.

**…make a ground / wall / platform?** A flat box: `{ w: 120, h: 1, d: 120 }`.
Real geometry always — two crossed sprites read as broken. For a real
landscape, `world.terrain()` — see [terrain3d.md](terrain3d.md).

**…a polished / metallic look?** Smooth primitives + `gloss`:
`world.sphere({ color: '#c94f4f', gloss: 0.85 })` reads as a marble;
`world.roundedBox({ gloss: 0.7 })` as a die. `gloss: 0` (default) is matte.
Retro pixel-look games just use `box()` + billboards; high-res games use the
smooth shapes — same world, same draws, mix freely.

**…load a real 3D MODEL?** Two loaders, one handle:
`await world.loadObj('./assets/models/skull.obj', { x, y, z, w: 4, h: 4,
d: 4 })` and `await world.loadGlb('./assets/models/Duck.glb', {...})` →
`Model3d`: mutate `x/y/z/yaw/pitch/roll/w/h/d/alpha` (or `size = 4`
uniform sugar) and every material part follows; `parts` exposes the
individual Mesh3d handles (tint one material, hide another);
`model.kill()` removes it. Models are UNIT-FIT like every primitive —
w/h/d size them in world units. OBJ resolves its MTL + textures beside
the file; GLB maps its PBR factors (baseColor, metallic/roughness,
normal map) straight onto the mesh shader. Loading the same url twice
shares the geometry — ten ducks = one set of draws. **Preload on the loading bar:** declare `load.glb(url)` /
`load.obj(url)` in the scene's `preload()` — that fetches + parses +
decodes textures device-free (no World3d), so the built-in progress bar
covers models; `world.loadGlb/loadObj(url)` in `setup()` then builds
instantly from that cache (a cache miss just fetches on its own, so
ad-hoc loads still work). Declare in preload, BUILD in setup —
`scenes.md`. PBR dials on EVERY mesh: `metallic` (0..1) and `rough`
(0.045..1; or the `gloss` sugar, rough = 1 - gloss×0.85) — live
per-instance, no repack. ENVIRONMENT reflections are ON by default
(IBL-lite): glossy/metallic surfaces reflect an equirect sky — a
PROCEDURAL one baked from the hemisphere ambient + the sun (it re-bakes
when setSun/setAmbient move), so metals read correctly with zero assets.
`world.env(url)` swaps in a real panorama, `world.env({ strength })`
tunes it, `world.env(false)` disables. Roughness picks the reflection
blur (mirror → sharp sky, matte → the averaged tail).

**…an ANIMATED / SKINNED character?** `world.loadGlb()` returns an
`AnimatedModel3d` whenever the file carries a rig: `model.play('run',
{ loop, fade })` crossfades clips (`model.anims` lists them), the mixer
ticks automatically. A crowd of 50–200 characters is a single draw call
(see examples/crowd3d.ts) and their sun shadows animate too; hundreds
are fine. Drive the model's transform through the usual handle —
animated models scale UNIFORMLY (`size`).

**…assemblies (turrets, windmills, attachment points)?** `world.group()`
is a pure transform node: parent meshes, models or other groups to it
(`parent:` in config or the live `.parent` field) and pose the whole
assembly through one handle. `Group3d.scale` scales the subtree; mesh
parents contribute position + rotation only. `group.lookAt(x, y, z)` /
`world.lookAt(handle, …)` aims local +Z at a target (a turret tracking a
target is one call per frame). Chains nest arbitrarily.

**…SHADOWS? Follow the LADDER — you rarely need to decide anything:**
1. **Do nothing.** BLOB shadows are ON by default: a soft dark ellipse
   grounds every mesh, model and billboard under any lighting, for one
   instanced draw. Big footprints (floors) are skipped automatically;
   per-mesh `blob: false`/`true` overrides; `world.blobs` tunes live.
2. **Sunny outdoor scene?** `world.shadows(true)` — the REAL directional
   map (objects cast onto each other and the ground; costs one depth
   pass). This automatically switches the blobs OFF; `shadows(false)`
   brings them back. Pick one.
3. **Night/interior scene lit by point or spot lights?** Stay on blobs
   (local lights cast no real shadows — blobs are what grounds objects
   there), and optionally add `world.ssao(true)` for crevice/contact
   richness. SSAO is polish, not a requirement: ~0.5 ms desktop / ~2 ms
   mobile-class — enable it on scenes whose creases pay for it.

**…ground a MULTI-PART object (chair, desk, robot) with ONE clean blob?**
An assembly of boxes each drops its OWN auto blob → a messy cluster of
overlapping ellipses. Turn the parts' auto blobs off and cast a single
contact shadow for the whole thing with `world.blobShadow`:

```ts
const chair = world.group({ x, z });
world.box({ parent: chair, /* … */, blob: false });   // parts: no auto blob
// …more parts, all blob:false…
world.blobShadow({ parent: chair, w: 0.8, d: 0.8 });   // one soft blob
```

`world.blobShadow({ parent, w, d, yaw?, alpha? })` returns a retained handle
(mutate its fields / `.kill()`); parented, it rides the parent's world pose,
and it only draws while blob shadows are enabled (nothing to hide when they're
off). A whole scene of assemblies can gate every auto blob off in one line —
`world.blobs.max = 0` — then give each object its own `blobShadow`. **Trap:**
`w×d` is the object FOOTPRINT (the box it would cast for) rotated by `yaw`, not
a radius — a thin shelf wants a thin `d`; `alpha` defaults to `world.blobs.alpha`.

**…MORE LIGHT — points, spots, shadows, AO (Lighting 2.0)?** Three
independent switches, all live:
- `world.light({ type: 'point'|'spot', x, y, z, color, intensity,
  radius, dir, cone })` → a live Light3d handle. Hundreds of dynamic
  lights are fine. Falloff is INVERSE-SQUARE: `intensity` is
  divided by distance², so a light throwing across d units wants
  intensity ≈ punch × d² (a street lamp 14 up: ~200; a candle 1 away:
  ~2) — a distant spot at intensity 10 is INVISIBLE, not broken.
  Register as many lights as the world needs (thousands): each frame the
  ACTIVATION POOL uploads only the 256 whose spheres come closest to the
  camera — sprawling worlds place a lantern per street and forget them.
- `world.setAmbient(intensity, sky?, ground?)` — HEMISPHERE ambient:
  `sky` tints light from above, `ground` the bounce from below, blended
  per surface normal (also `light: { ambient, sky, ground }` at create).
  Moonlight-blue sky over lamplit-amber ground transforms a night scene
  for the cost of a mix(). Dim the world's `ambient` so locals read.
  Give every light a visible SOURCE: any mesh takes `emissive: 0..n`
  (unlit colour added on top — bulbs/lava/signage; >1 blooms under the
  bloom post). Emissive is visual only — it does not cast light, so pair
  an emissive orb WITH the world.light riding the same position.
- `world.shadows(true | { size, res, bias })` — the SUN casts: a
  depth-only pass into a shadow map (ortho box of half-extent `size`
  follows the camera target), 3×3 PCF. `world.setSun(x, y, z, ambient?)`
  re-aims it live (time-of-day). Skinned + parented content casts
  correctly.
- `world.ssao(true | { radius, strength, power })` — half-res ambient
  occlusion from the depth buffer alone, multiplied over the 3D image.
  The cheapest richness in the plan; flat-lit scenes gain contact depth.
Environment reflections (on by default) keep metals alive between lights; `world.env(false)` for a strictly local-lit look.

**…a visible BEAM / cone of light from a spot (flashlight, searchlight, lighthouse)?**
A spot only lights the *surfaces* its cone touches — the shaft itself is
invisible until you add one. Pass `beam` to a spot light and the engine
spawns a glowing volumetric cone and keeps it aimed, sized (to the light's
`cone.outer`) and coloured to the light EVERY frame — mutate the light and
the shaft follows, no bookkeeping:
```js
// held on the Game
this.beacon = this.world.light({
  type: 'spot', x: 0, y: 40, z: 0, color: '#fff2cf',
  intensity: 90000, radius: 600, cone: { inner: 0.05, outer: 0.12 },
  beam: { length: 560, intensity: 0.75 },   // true = defaults; or tune it
});
// in update(dt): sweep it — the beam turns with the light
this.t += dt;
this.beacon.dir = { x: Math.sin(this.t), y: -0.16, z: Math.cos(this.t) };
```
The shaft is ADDITIVE (brightest down the core, soft at the silhouette,
fading along its length) and it reads the scene depth, so it DISSOLVES where
it meets terrain/geometry instead of cutting through. `beam` config: `length`
(throw, default = `radius`), `color` (default = follows the light live),
`intensity` (additive glow, default 0.6 — push past 1 for thick fog, drop to
~0.2 for a hint). **Traps:** it's spot-only (ignored on points). The shaft is
*unlit glow*, separate from the light's throw — the beam's width tracks
`cone.outer`, so a wide cone makes a fat beam AND a soft light pool; narrow it
for a tight searchlight. And additive light reads best against dark air / rain
/ fog — over a bright daylit sky it barely shows (raise `intensity`).

**…physics colliders for a MODEL?** `hullOfVerts(soupOrBucketVerts, 48)`
quickhulls the unit-fit geometry; `physics.bind(part, { shape: 'hull',
points })` creates a REAL convex hull in the 3D physics core (scaled by
the mesh's w/h/d like box half-extents). Skulls land face-down. A hull is
CONVEX — a donut's hull is a solid disc; compound concave shapes = bind
parts separately.

**…a HUGE world (tens of thousands of meshes)?** Mark world geometry
`static: true`: it packs to the GPU once and is culled entirely on the
GPU — 76k static buildings cost the same per frame as 76. Static meshes
never move (later transform writes are ignored), cast no blob shadows,
and kill() takes effect within about half a second. Rule:
buildings/terrain/props = static; characters/pickups/doors = dynamic
(the default, CPU frustum-culled automatically; the engine warns once
if a scene crosses ~20k dynamic meshes).

**…a BIG sprawling world?** FRUSTUM CULLING is on by default: meshes
outside the camera (and outside the shadow box when shadows are on — an
off-screen tower still throws its shadow in) skip packing, upload and
drawing entirely, so a huge world only pays for the visible slice.
`world.counts` reports `meshes` (alive) vs `drawn` vs `culled`.
World STREAMING (chunks of meshes appearing/vanishing) is game-side:
create on approach, `kill()` on leave — both are cheap.

**…RETRO VECTOR line art in the 3D world (wireframes)?** Two calls:
- `world.lines(polylines, { color, width, alpha, closed })` — polylines
  of [x, y, z] points as glowing line segments. `width` is SCREEN PIXELS
  (hairlines stay hairlines at any distance; width < 1 = flat-cut
  hairline); depth is REAL, so lines occlude behind solid geometry. The
  handle is live (x/y/z, yaw/pitch/roll, scale, color, width) and every
  shape shares ONE instanced draw. Grid floors, HUD-in-world, Asteroids.
- `await world.loadWireframe(url, { scale, color, width, angle })` — any
  OBJ/GLB as CLEAN OUTLINE edges: the soup is welded and only boundary +
  crease edges (> `angle` degrees, default 20) survive — a cube is 12
  edges, not 36 triangle sides. SMOOTH models (most GLBs) barely crease,
  so when no `angle` is given and crease coverage is sparse the loader
  falls back to the FULL-MESH look automatically (every unique edge —
  `angle: 0` forces it, a positive `angle` forces crease-only).
  `world.wireframeEdges(verts, angle)` runs the same extractor over a
  custom soup. Pair with `game.post.add('bloom')` for the phosphor glow.
  Add `hiddenLine: true` for the TEMPEST / STAR WARS solid-vector look:
  the model's own surface fills the depth buffer INVISIBLY (colour
  writes off), so back edges vanish while the background stays visible
  around the object — works over any scene, no plain-background trick.
  See examples/wireframe3d.ts (the ship and duck are hidden-line; the
  skull is see-through for contrast).

**…click on things in the 3D world (picking / point-and-click)?** The
camera kit:
- `await world.pick(e, { occlude })` → `{ mesh, id }` or null — the mesh
  under the pointer, done on the GPU: it renders an id per instance into a
  1-pixel buffer and reads it back, so it's PIXEL-EXACT (true silhouette +
  depth, no bounding-box slop) and **O(1) at any object count**. It's
  `async` — `await` it (a ~1-frame GPU→CPU readback). Tracks MOVING and
  just-SPAWNED meshes automatically (it renders the same per-frame instance
  data the scene draws — you always pick what's on screen).
  - **OPT-IN.** Only meshes with `mesh.inputEnabled = true` are ever
    returned (default false — nothing clickable by accident). `Model3d`
    exposes the same flag, fanning out to all parts, so any part of an
    enabled model resolves to it. No more "filter by identity" Set.
  - `occlude` (default `true`): non-pickable geometry still BLOCKS — click a
    wall in front of a unit and you get null, not the unit. `occlude:false` =
    see-through, the pick reaches the nearest enabled mesh behind it.
  - TRAP: a picked MODEL returns the part-`Mesh3d` you hit, not the `Model3d`
    handle — keep a `Map<Mesh3d, model>` (one entry per part) to get the model.
  - COVERAGE: dynamic AND static (`world.static`) meshes + models, opaque +
    translucent. NOT skinned/animated GLB, terrain, grass, billboards. Needs
    a rendered frame first, so call it from an input handler.
- `world.screenRay(e).ground(h?)` → where on the plane y = h the click
  lands — the RTS "walk here" move (sync; the pick returned null). The ray
  itself has origin + dir for anything fancier.
- `game.project3d(x, y, z)` → that 3D point in the 2D LAYER's coordinates
  (+ `visible`, `depth`): draw names/health bars with the ordinary 2D
  verbs and they pin to moving 3D objects.

**…test an arbitrary WORLD-SPACE ray (a bullet hits a model, AI
line-of-sight)?** NOT `pick` — that's the *camera* ray at a screen pixel.
Use the physics cast on the world's body sim (`world.physics`, a `Physics3d`):
`world.physics.raycast(origin, dir, maxDist, ignore?, { hits })` →
`{ body, point, normal, distance }` (shape-accurate against colliders, with the
surface normal + collision-layer filter), or `world.physics.raycastAll(...)` for
every hit along the ray. (Needs bodies — attach a `Physics3d` first.)

**…a patrol route / coaster / camera rail (SPLINE PATHS)?** `new
Path3d(points, { closed })` — a centripetal Catmull-Rom through 3D
points, ARC-LENGTH parameterised (t 0..1 moves at constant speed no
matter how unevenly the control points are spaced; closed loops wrap).
`path.at(t)` / `path.atDist(d)` position; `path.frame(t)` adds the unit
tangent + a parallel-transported normal/binormal (no roll flips around
loops) — orient a cart with `lookAtEuler(0,0,0, f.tx,f.ty,f.tz)`;
`path.points(n)` feeds `world.tube({ path })` for the track itself, and
`world.fx.emit({ path, ... })` spawns particles ALONG the spline (x/y/z
become an offset). The frame's normal starts WORLD-UP and parallel
transport carries it through vertical loops (INVERTING on top): orient a
cart fully — banking and inversion included — by building a matrix from
(n × t, n, t) and running `decomposeTRS` on it (frameEuler in
examples/coaster3d.ts). BRANCHING tracks are several OPEN paths sharing
endpoint control points + a state switch when t reaches 1 — the junction
cart in the same example. TRAP: a frame's `ny < 0.6` means the track is
steep or inverted there — the rule for skipping support posts.

**…a creature that roams WITHOUT a pre-authored path (DYNAMIC paths)?**
`new DynamicPath3d()` — the rolling window: `add(x, y, z)` plots
waypoints AHEAD (an AI picks them as it goes), the rider samples
`frameAt(distance)` (ABSOLUTE distance, monotonic forever — a 0..1
fraction would remap as the path grows), and `trim(d)` drops everything
behind. Already-ridable track never reshapes when you add (`head` trails
~2 waypoints behind your latest add). The loop is three lines:
```ts
dist += speed * dt;
while (path.head - dist < 45) path.add(ai.nextWaypoint());
path.trim(dist - 25);
const f = path.frameAt(dist);   // position + tangent + up
```
See the drone weaving through examples/night-city.ts street canyons.
`pointsBetween(d0, d1, n)` draws the plotted route ahead.

**…a chase camera without the boilerplate?** `world.follow(handle,
{ offset, look, ease })` — eases the camera to handle + offset and aims
at handle + look every frame; any live handle works (mesh, model,
group). `follow(null)` stops. Use `world.orbit()` INSTEAD for
inspect/editor cameras — not both.

**…put UI or a score in a 3D game?** `game.hud` — the screen-space pass owns UI.
The HUD is a separate screen-space pass by design; in-world HUDs z-fight.

**…a character made of several billboards (body + hat)?** Bake the parts into
ONE frame — compound billboards shear apart in perspective.

**…tune the mood?** `fog` (color/near/far — match `background` for infinite
haze), `light` option (`{ x, y, z, ambient }` — direction light travels,
ambient 0..1 floor).

Trap: `world3d()` is async (the 3D chunk loads on first call) and idempotent
— it creates the world once and later awaits resolve to the same instance.
Trap: 3D y is UP; copying 2D y-down math will mirror your world.

## Relates to

- [terrain3d.md](terrain3d.md) — landscapes, deformable snow/sand, grass,
  and riding the ground (`TerrainRider`).
- [sky-water3d.md](sky-water3d.md) — the procedural sky dome, day/night,
  lens flare, god rays, seas and streams.
- [particles3d.md](particles3d.md) — 3D particles (CPU + GPU tiers),
  trails and wisps.
- [sprites.md](sprites.md) / [draw.md](draw.md) — the 2D layer drawn OVER the world.
- [text.md](text.md) — the HUD pass, which is where a 3D game's UI lives.

Signatures: engine/webgpu/world3d.d.ts, engine/webgpu/math3d.d.ts, engine/webgpu/game.d.ts, engine/webgpu/model3d.d.ts, engine/webgpu/path3d.d.ts, engine/webgpu/orbit3d.d.ts, engine/webgpu/lights3d.d.ts.

## Rigid-body physics — Physics3d (optional, lazy)

Bind meshes to a real 3D physics world (a separate ~1 MB chunk, loaded
only on create()):

```ts
const world = await game.world3d();
world.physics = await Physics3d.create({ gravity: -20 });
world.physics.bind(ground, { type: 'static' });
const crate = world.physics.bind(crateMesh, { bounce: 0.2 });
crate.impulse({ x: 0, y: 6, z: -3 });
```

The Game steps it each frame; bound meshes get position + yaw/pitch/roll
written from the body pose (tumbling included). Shapes: box / sphere /
capsule (hull/terrain meshes are not available on v2's instanced meshes).
Steer dynamics with forces. See physics3d.d.ts
for joints, raycasts, groups and the character/vehicle recipes.

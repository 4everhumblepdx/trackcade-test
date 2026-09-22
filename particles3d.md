# 3D particles, trails & wisps — CPU bursts, GPU storms, ribbons of light

Everything here lives ON the 3D world: `const world = await game.world3d()`
first (see [world3d.md](world3d.md)). Two particle tiers share one vocabulary:

- **`world.fx` (CPU)** — pooled sim, ONE instanced draw of camera-facing
  quads (soft discs, atlas frames, SDF rings), additive or alpha,
  depth-tested against the solid world. For bursts, streams and gameplay
  one-offs (thousands). Plus `world.burst()` — the 2D VfxDef burst recipes
  in 3D.
- **`world.emitter()` (GPU compute)** — a persistent pool of up to hundreds
  of thousands of particles simulated entirely on the GPU: curl-noise
  storms, depth-buffer collision, soft particles, velocity stretch.
- **Trails** (`world.trail()`) — ONE view-expanded Catmull-Rom ribbon per
  trail, and **wisps** (`world.wisp()`) — steam/smoke as a true-3D twisting
  noise ribbon.

The 2D option surface carries over: `ramp`, `sway`, `twinkle`,
`spawnRadius`, `shrink` etc. all work as in [particles.md](particles.md).

## How do I…

**…explosions / fire / fountains in 3D?** `world.fx.emit({ x, y, z, ... })`
— the same option surface as 2D `game.fx` (see [particles.md](particles.md):
`ramp`, `sway`, `twinkle`, `spawnRadius`, `shrink` fraction all work), with
3D differences: sizes/speeds are MESH scale (size ~0.1, speed ~3 — a tenth
of everything 2D), direction is `dir: { x, y, z }` + `spread` (a cone full
angle; omit both = every direction), `gravity` pulls toward the floor
(negative = rises), and spawn shapes add `box: { w, h, d }` and `ring: r`
(horizontal ring) beside `spawnRadius` (sphere). Emit per frame = a stream:
`world.fx.emit({ x, y, z, count: 3, dir: { y: 1 }, spread: 0.5, ramp: 'fire', add: true, gravity: -1.5 })`
is a campfire. Untextured particles are gaussian GLOW PUFFS by default
(`soft: 0` hardens them to crisp discs); for the real look use TEXTURED
frames — `frame: game.assets.frames(particleCanvas({ kind: 'soft' | 'flare' |
'star' | 'spark' | 'ring' }))` or a loaded PNG — tinted per particle by
`color`/`colors`/`ramp`, spun with `spin`, varied with `sizeVar` (see
particles.md "Make it beautiful"). Everything alive is one instanced draw
of camera-facing quads, depth-tested against the world (never written),
additive where `add: true`.

**…a steady particle STREAM (fire, smoke, drips)?** `world.fx.stream({
rate, ...emitOptions })` — `rate` is particles per SECOND (wall clock;
the ENGINE owns the accumulator, so alive = rate × life at any refresh
rate). The handle is live (`stream.rate = 0` pauses, mutate x/y/z/on/
lit freely), `kill()` stops it. `stream` is the verb for anything CONTINUOUS
(the engine owns the accumulator; a per-frame `emit()` count doubles on a
120 Hz display). `emit()` is for one-shot BURSTS (explosions, impacts).
Budget: alive = rate × life; a LIT smoke column earns ~15/s × 4.5 s ≈
67 puffs, carried by SIZE not count.

**…a one-shot impact / shockwave in 3D?** `world.burst('impact', x, y, z,
{ dir?, scale?, flat? })` — the SAME VfxDef burst recipes as 2D
(`'impact'`, `'shockwave'`, `'hitSpark'`, custom `registerVfx` defs):
particle layers ride `world.fx`; expanding rings lie FLAT in the world XZ
plane by default (a camera-facing ring reads as a 2D effect pasted on the
screen — `flat: false` restores it); flashes stay camera-facing glows.
Defs carry 2D-tuned numbers; `scale` (default 0.1) maps them to mesh scale
— the trail-width convention. `dir` aims directional emit layers (e.g.
`{ y: 1 }` sprays upward).

**…give a moving object a trail?** `world.trail(def, opts?)` — the def is a
VfxDef name (`'flameTrail'`, `'sparkTrail'`, `'smokeTrail'`,
`'rainbowTrail'`, `'trail'`, or a custom `registerVfx` def — the SAME data
family as 2D `sprite.vfx`). ONE ribbon per trail, a Catmull-Rom curve
through the position history, expanded perpendicular to the VIEW (reads
right from every angle — never a chain of flat quads), noise-fluttered
toward the tail, with a white-hot core and a tail that ERODES into ragged
wisps. Feed it yourself (`t.point(x, y, z)` per frame)
or pass `follow: mesh` and it auto-feeds from the handle (+ `offset`) and
fades out when the mesh dies. `t.release()` stops feeding and lets the
ribbon fade. WIDTH RULE: keep a trail NARROWER than the object it streams
from — `follow:` trails default to the handle's own size, and the ribbon
swells from inside the emitter instead of capping at full width. Manual
trails don't know their emitter: pass `opts.width` (world units) sized to
it (unset it falls back to a tenth of the def's 2D width). The head rides
the exact live `point()` position — feeding is lag-free by construction.
THE AFTERIMAGE PRINCIPLE: the ribbon's noise pattern is keyed to absolute
travelled distance, so it stays pinned to the world path and the ribbon
slides through it — the trail reads as traces LEFT BEHIND, never as a
decorated appendage glued to the object. Slow movers keep the same pattern
density per world unit; pair very slow movement with a longer `life` if
you want a longer wake.
Style
fields are live-mutable on the handle: `width, life, colors, alpha,
turbulence` (flutter laid along the path, world units), `erode` (HOW it
dies: 0 = fades by dimming, 1 = shreds apart along the fibres), `core`
(0..1 white-hot centre line — best on additive defs), `fiber` (texture
depth: 0 = a clean band of light, 1 = fully streaked) and `hard` (edge:
0 = soft gaussian, 1 = crisp neon band). The Tron light-wall is the
`'lightTrail'` def: taper/turbulence/erode/fiber all zeroed, hard + core
up, long life — pair with bloom. Add `facing: 'up'` (def field or trail
option) for the true light-CYCLE wall: a VERTICAL ribbon standing on the
fed path — base-anchored, `width` tall, visible from both sides — feed it
at ground level and it rises like the bike is laying it down. 'view' (the
default) always faces the camera (comets, magic). The noise texture is auto-generated
(override with `opts.noiseFrame`). All trails in the world are one
instanced draw; they depth-test against solids but never write depth.

**…sparks shed along a trail's path / an electric ribbon?** Two VfxDef
trail data fields (they compose): `sparks: { per, speed, life, size, ramp,
gravity, drag, twinkle }` sheds particles ARC-SPACED along the LAID-DOWN
path (per world unit of travel, never per frame — the afterimage principle
applied to particles: embers land where the object flew and stay there;
`'emberTrail'` in the pack), and `crackle: 0..1` adds a SPARKLER inside the
ribbon — dozens of tiny white-hot points popping in and out along the
surface (lightning/plasma; `'stormTrail'` in the pack — pair with bloom;
give the trail enough `life` that there's ribbon to sparkle over). Both
work through `world.trail()` (sparks ride
`world.fx`); `sparks` also works on 2D trails (rides `game.fx`); `crackle`
is live-mutable on the Trail3d handle.

**…STEAM / CHIMNEY SMOKE (a twisting ribbon, not particles)?** `world.wisp()`
— steam/smoke as a TRUE-3D twisting ribbon:
a subdivided plane twisted around its own axis and wind-blown, both
driven BY a tileable noise texture (`game.assets.frames(noiseCanvas({ ... }))`)
sampled in the vertex stage; the fragment scrolls the noise upward with
a density remap and edge fades. Anchored at its BASE; all fields
live-mutable: `{ frame, x/y/z, w/h, color, alpha, twist, wind, speed,
remap: [lo, hi], yaw }`. The wisp Y-BILLBOARDS toward the camera by
itself (upright; `yaw` is an extra offset) — a single plane seen
edge-on collapses into a column of twist crossings, so it never is —
and edge-on twisted slices dissolve instead of stacking into a bright
line. Coffee steam: defaults. Chimney smoke: bigger w/h, lower remap
lo (denser), darker color. Alpha-blended, no depth write, drawn after
everything solid.

**…SIX FIGURES of particles (storms, blizzards, magic fields, mass
fireworks)?** `world.emitter({ ... })` — the GPU-COMPUTE tier. Where
`world.fx` is a CPU pool for bursts and streams (thousands), an emitter is a
PERSISTENT pool (default capacity 65536, up to ~2M) simulated entirely in a
compute kernel; the GPU also writes its own draw count, so the CPU cost is
constant regardless of count. Same option vocabulary as `world.fx.emit`
(`dir`/`spread`, `box`/`ring`/`spawnRadius`, `life`/`size`/`shrink`/`fade`,
`ramp`/`color`/`colors`, `twinkle`, `soft`, `frame`, `spin`) plus the
Tier-B extras:

- `rate` — particles/second, continuous; `handle.burst(n)` one-shots.
  A ring pool: rate × life beyond `capacity` recycles the oldest.
- `fade` additionally takes a NUMBER — the final fraction of life to fade
  over (0.12 = opaque until the last 12%; long-lived petals/leaves/debris
  want this — `true` fades over the WHOLE life and leaves most of the
  pool translucent).
- `forces: [...]` — DATA, composable: `{ kind: 'accel', y: -9 }` (gravity/
  wind), `{ kind: 'drag', amount }`, **`{ kind: 'curl', strength, scale,
  speed }`** (divergence-free noise flow — smoke/magic that SWIRLS; the
  single biggest wow), `{ kind: 'attract', x,y,z, strength, radius }`
  (negative strength repulses), `{ kind: 'vortex', x,y,z, ax,ay,az,
  strength }` (tornado), `{ kind: 'orbit', x,y,z, strength, radius,
  spring }` (accretion disc).
- `collide: true | { bounce, friction, kill, rest, respawn, thickness }` —
  **DEPTH-BUFFER collision**: particles bounce off (or die on) whatever is
  on screen, no colliders anywhere. `rest: true` = once a bounce bleeds
  the speed off the particle COMES TO REST: frozen mid-sim, spin/tumble
  stop, and it settles FLAT in the world plane until its life fades
  (petals and snow accumulating on geometry). `respawn: true` = on contact
  the particle is instantly REBORN via the spawn init — the infinite-rain
  mode (pair with `wrap`): nothing bounces, nothing accumulates. TRAP: a
  bounce only reads right under REAL physics — pair it with a strong
  gravity `accel` capped by `drag` at terminal velocity; a weak accel
  with spawn-injected speed makes every bounce float like the moon.
  Kill/respawn rain casts true RAIN SHADOWS — the air under trees and
  overhangs stays dry. Off-screen geometry doesn't exist to collision, so
  it is for eye-candy (rain, sparks, debris); gameplay logic stays on the
  CPU side.
- `softFade` (0.25 world units) — SOFT PARTICLES: quads fade where they
  near scene depth, so nothing ever shows a hard intersection line.
- `stretch` — velocity stretch: elongates the quad along motion by
  stretch × speed (motion-blurred sparks; try 0.05–0.1).
- `flutter` (+ `flutterFreq`) — the falling-leaf ROCK: a per-particle
  horizontal oscillation. `tumble` 0..1 (+ `tumbleSpeed`) — the quad
  visibly turns over (thin + dimmed edge-on). Together with the
  `particleCanvas({ kind: 'petal' })` texture, slow `spin` and a breeze
  (`accel` x + gentle `curl`), this IS the sakura/autumn-leaves recipe —
  petals without flutter+tumble read as flat confetti. See the demo's
  'sakura' preset.

- `radial: true` — velocity points AWAY from the emitter origin (overrides
  dir/spread): pair with `ring`/`spawnRadius` spawn shapes for shockwaves,
  novas and explosion shells.
- `wrap: true | { w, h, d }` — fold positions torus-style into a box
  around the emitter origin. **THE any-size-world recipe**: size the box a
  little past the fog distance and set `e.x/z` to the CAMERA POSITION
  (`world.camera.x/z`, not the look target) every frame — a bounded pool
  then reads as weather over an unlimited world; fallers wrap back to the
  top (rain = one burst with a long `life`, `fade: false`, recycled
  forever — zero spawn cost). See examples/particles-field.html.

**THE BOOM DOCTRINE** (explosions, pyroclastic clouds, anything cinematic
that detonates): compose a handful of PERSISTENT pooled emitters and
re-burst them per explosion — one allocation, reused forever. The proven layers
(examples/particles-boom.html): additive flash (soft, grows, 0.2s life) →
`radial` fireball on the `'fire'` ramp with curl roil + hard drag →
pyroclastic smoke = big alpha `'smoke'`-ramp puffs with `shrink: 3+`
(GROW), slight buoyant accel, curl, and `collide` bounce+friction so the
cloud ROLLS ALONG THE GROUND (the crawling skirt is the whole look) →
`radial` flat dust shockwave (ring spawn, huge speed, huge drag) →
textured debris under real gravity with `collide.rest` (rubble that
stays) → velocity-`stretch`ed sparks that skitter. Move all emitters to
the blast point, `burst()` each, stagger the smoke ~0.06s behind the
fire. Gameplay one-offs (pickups, small hits) stay on the CPU tier
(`world.fx` / `world.burst`) — no pool setup, dies with the scene.
REFERENCE NUMBERS (~315 particles per boom): flash 3 @ size 1.6 · fireball 46 @
2.5, shrink 1.9 · pyroclastic 40 + 11 late @ 3.5, shrink 2.3, alpha 0.7 ·
shockwave 40 @ 1.4 · sparks 74 @ 0.095, stretch 0.24 · debris 100 @ 0.18
(debris is the ONE layer where count is the look — discrete chunks read
as chunks). Start every explosion from these and scale counts (not
sizes) with blast radius. The instinct to add count is almost always
wrong — visual mass = count × size × alpha, and size is cheapest. The
cost of big alpha particles is FILL RATE, not count: smoke is a few
hundred BIG puffs, the visual mass of thousands of small ones.

The handle is live: mutate `e.x/y/z/rate` or anything in `e.opts`
(forces included) per frame; `e.alive` is the async-readback count
(~2 frames stale); `e.kill()` releases the pool. Traps: `add` defaults
TRUE here (the pool is unsorted — additive is the only order-independent
blend; alpha smoke works but keep it dim: `alpha: 0.5`); per-emitter
options split in two: SPAWN-TIME params (`life`/`speed`/`size`/spawn
shape/`dir`) bake into each particle at birth — retune them freely
between `burst()`s to get several effect VARIANTS out of one shared pool
(the shmup's three explosion types) — while RENDER params
(`ramp`/`colors`/`alpha`/`shrink`/`fade`/`twinkle`) are uniform and
RETROACTIVE: changing them retunes everything already alive
(per-particle palette picks stay stable via each particle's seed).
Proof: examples/particles-gpu.html (curl storm, bouncing ember rain,
fireworks, tornado).

**…particles FROM a model's surface, or particles LIT by the lights?**
- SURFACE emitter: `const s = world.surface(mesh)` (once — it bakes an
  area-weighted sampler over the mesh's triangles; for a loaded model
  pass one of `model.parts`), then `world.fx.emit({ surface: s, on:
  mesh, ... })` — particles spawn ON the surface (following the live
  transform) and launch along the surface NORMALS unless you pass
  `dir`. Auras, dissolves, a burning ship shedding embers from its hull.
- LIT particles: `world.fx.emit({ lit: true, ... })` — each particle
  samples the froxel light structure + ambient: grey smoke picks up
  lantern colour as it drifts. Use on ALPHA-blended particles (smoke,
  dust); additive sparks are self-luminous — leave them unlit.
  See examples/surface-fx3d.ts for both, with an A/B toggle.

**…particles ALONG a spline?** `world.fx.emit({ path, ... })` spawns
particles along a `Path3d` (x/y/z become an offset) — see
[world3d.md](world3d.md) § spline paths.

## Relates to

- [world3d.md](world3d.md) — the world, camera and lights these draw into.
- [particles.md](particles.md) — the 2D system: the shared option
  vocabulary, `ramp`s, `particleCanvas` textures, "Make it beautiful".
- [vfx.md](vfx.md) — the VfxDef data family (`registerVfx`) trails and
  bursts consume.

Signatures: engine/webgpu/particles3d.d.ts, engine/webgpu/particles-gpu.d.ts, engine/webgpu/world3d.d.ts.

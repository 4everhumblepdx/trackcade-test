# Sky & water — the procedural dome, day/night, lens flare, god rays, seas & streams

Everything here lives ON the 3D world: `const world = await game.world3d()`
first (see [world3d.md](world3d.md)). Sky and water pair naturally with
[terrain3d.md](terrain3d.md) — the sky re-lights the landscape through the
day, and water shoals against the real beach.

## How do I…

**…a SKY (clouds, sun, day/night)?** `const sky = world.sky()` — a
procedural dome behind everything: gradient, sun disc + glow, two drifting
cloud layers, stars and a moon at night. Zero assets. ONE dial runs the
day: `sky.time` (0..24 h) moves the sun AND drives its colour/intensity,
the ambient, the fog colour and the env bake together — noon, golden hour,
starry night are the same scene at different times. `sky.cycle(120)` = a
full day every 2 minutes. `sky.storm` 0→1 is the weather dial: clouds pack
+ darken, the sun dims. Live fields: `coverage` (0..1 sky fraction),
`density`, `wind {x,z}`, `cloudSpeed` (drift-rate multiplier; 1 = visibly
alive, 0 = frozen), `clouds`, `stars`. `drive: false` keeps manual
setSun/setAmbient control (dome visuals only). At night the world light
comes down from the moon automatically. The sky sets fog colour per frame
when driving — set only fog near/far yourself. Example: examples/sky3d.ts.

**…LENS FLARE and GOD RAYS?** Both ride the sun. FLARE is on automatically
when a sky is attached (`world.sky({ flare: false })` opts out;
`world.flare(true)` forces it in manual-lighting scenes): a ghost chain
along the sun→centre axis, depth-occluded (a hill covering the sun
collapses it smoothly) and faded by night/storm/off-screen. GOD RAYS are
one call: `world.rays(true)` (tune `{ strength, decay }`) — screen-space
shafts from the sun's position that stream past terrain silhouettes; one
half-res pass. Both follow the sky's time dial for free. Best at golden
hour looking toward the sun.

**…WATER (sea, lakes, streams, waterfalls)?** ONE system, every scale.

GRID waters: `const sea = world.water({ preset: 'sea', level: 4, ground:
(x, z) => terrain.heightAt(x, z) })` — ALWAYS pass `ground` when the water
meets land: waves then shoal against the real beach and the waterline stays
stable. Presets `'sea' | 'ocean' | 'lake' | 'pool'` differ in wave tables +
colour; all get depth-blended shorelines, animated shore foam, crest
whitecaps (auto-gated by wave height), sky reflections and sun glint.

- **Boats ride the swell**: `sea.heightAt(x, z)` is the exact wave the GPU
  draws — sample it at 4 hull points for height + pitch/roll
  (examples/water3d.ts).
- **Hulls stay dry + leave wakes**: `const well = sea.well({ w: 5.2, d:
  12.5 })` presses the surface down inside an oriented box (max 4 per
  water) — set `well.x/z/yaw` and `well.floor` (just under the bilge) each
  frame as the boat moves. Wells also stamp time-fading foam wakes;
  `well.wake` (0..1) scales it — drive it with boat speed so parked boats
  sit clean. `heightAt` ignores wells.
- **Sea state**: `water.swell` (0 glass → 1 ferocious — couple to
  `sky.storm` for weather) and `water.tide` (waterline breathing over
  `tidePeriod` seconds; 1–2 units on a shallow beach reads as the sea
  drawing back and running in).
- **Sea colour**: `water.setTint('caribbean' | 'azure' | 'temperate' |
  'emerald' | 'northsea')` — palette + optical depth together.
- **Beaches need a shallow apron**: waves visibly lap where the seabed
  stays shallow for a stretch; a seabed that drops off right at the
  waterline kills the effect. Surf breaker lines march up any shallow
  shore automatically. Rocks/piers in the water grow foam collars for free.

RIBBON waters: `world.water({ path: [[x,y,z], ...], width: 5, flow: 6 })` —
a strip flowing along the points; steep sections foam white and run fast,
so a WATERFALL is a stream whose path drops off a cliff. Streams over
terrain: plot the course with a monotonic waterline, then carve the channel
into the terrain shape along it (min the heightfield against a bed profile
— see the example). Lakes: dish a basin into the terrain shape, set
`level` between floor and rim.

Water is lit by the same sun/fog/env as everything, so the sky's time dial
changes it for free. Clustered point lights don't reach it (sun/env/fog
do). Waves, colours and flow are live-mutable.

## Relates to

- [underwater.md](underwater.md) — dive BELOW a sea/pool and make it feel
  underwater: absorption/murk, caustics on the sand, the Snell's-window
  surface from below (`world.underwater`).
- [world3d.md](world3d.md) — the world, camera, fog and lighting the sky drives.
- [terrain3d.md](terrain3d.md) — the landscape water shoals against and
  streams carve into.
- [backdrops.md](backdrops.md) — the 2D backdrop layer (use `world.sky()`
  instead in any 3D scene).

Signatures: engine/webgpu/sky3d.d.ts, engine/webgpu/water3d.d.ts, engine/webgpu/rays.d.ts, engine/webgpu/flare3d.d.ts.

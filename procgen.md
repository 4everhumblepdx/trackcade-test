# Procgen art packs — zero-file assets, pulled in as groups

Procgen art is NOT core engine surface: it arrives as PACKS — themed
groups of generators (the MCP art-block delivery shape). The engine ships
two reference packs.

## 2D — the procgen library (import * as procgen)

A procedural library of **106 generators**, every one returning a canvas for `game.assets.frames(...)`. All
options-driven (size, colours, seeds) so one generator yields endless
variants.

```ts
import * as procgen from '../engine/packs/procgen.js'; // its own artifact — not in webgpu.js
const HERO = game.assets.frames(procgen.characterSheet({ size: 16, body: '#8ecae6' }), 16); // 4-frame walk
const COIN = game.assets.frames(procgen.coinSheet({ size: 16 }), 16);                       // 4-frame spin
const WALL = game.assets.frames(procgen.brickTile({ size: 16 }));
```

Highlights: characters (characterSheet, personSheet — 6-frame run+jump,
wizard, ghost, alien, slime, bat, robot, frog…), 20+ terrain tiles
(grass/brick/metal/ice/marble/circuit/cobble…), items and treasure
(coinSheet, gems, crown, sword, potion…), space (ships, ufo, planets,
asteroids), plants and props (trees, mushroom, cactus, house, lamppost,
torchSheet), fruit, and env/normal maps for 3D materials. Sheet frame
counts are in each generator's doc comment. Pixel art wants
`pixelArt: true`.

## 3D — registerArt3d(world)

Custom geometries via `world.custom()` — faceted crystal, jittered rock,
fluted ruin pillar, obelisk spire — ONE instanced draw per shape however
many you place, plus composite spawners:

```ts
import { registerArt3d } from '../engine/packs/art3d.js'; // its own artifact
const art = registerArt3d(await game.world3d());
art.crystal({ x: 2, z: -4, color: '#7fd4ff' });
art.tree({ x: -3, z: 2, scale: 1.4 });                 // trunk + two cones
art.crystalCluster({ x: 0, z: -8, count: 5, seed: 2 }); // deterministic scatter
```

Everything is deterministic (same seed, same shapes — procgen never
flickers between runs). Building your own pack: paint canvases and
register with `game.assets.frames`, or build triangle soup with the exported
geometry `Builder` (winding self-corrects) and add via `world.custom`.

## 3D — CSG: carve geometry with booleans

**…drill a hole / notch / engraving into a solid?** Boolean geometry —
`Solid.subtract` / `.union` / `.intersect` over any triangle-soup (the
geometry generators' output). It lives purely at the geometry layer (soup in →
soup out): the result is one baked mesh you hand to `world.custom`, so CSG costs
nothing per frame and needs no special material. Normals and UVs interpolate
across the cut, so a drilled hole lights as a true concave hollow.

```ts
import {
  Game, Solid, roundedBoxVerts, cylinderVerts,
} from '../engine/webgpu.js';

const game = await Game.create();
const world = await game.world3d();

// A rounded cube with four sockets drilled into the top face. TRAP: union the
// cutting tools FIRST, then subtract ONCE — N sequential subtracts re-split the
// whole body each time and blow the polygon count up by an order of magnitude.
function socketBoxVerts() {
  const tool = cylinderVerts(14);                       // unit cylinder (Y axis)
  const holes = [[-0.22, -0.22], [0.22, -0.22], [-0.22, 0.22], [0.22, 0.22]]
    .map(([x, z]) => Solid.fromVerts(tool, { scale: [0.16, 0.2, 0.16], pos: [x, 0.45, z] }));
  return Solid.fromVerts(roundedBoxVerts(0.15, 3)).subtract(Solid.union(holes)).toVerts();
}

// world.custom buckets by name → the boolean BAKES ONCE, every instance shares
// it (colour/alpha still vary per instance).
world.custom('socketBox', socketBoxVerts, { w: 2, h: 2, d: 2, color: '#d8514c' });
```

- A `Solid` is one colour per instance (like any mesh). For a **contrasting**
  pip/inlay, drop a small separate mesh into the hole — the carved recess
  removes the material above it, so the insert reads as recessed, not stuck on.
- Bake-time only: build the `Solid` in the `world.custom` generator (called once
  per name) at load time. Keep tools **clean and closed** — this is the
  csg.js BSP boolean, superb for convex tools out of convex-ish bodies, not a
  CAD kernel for arbitrary self-intersecting meshes.
- Also exported: `transformVerts(verts, { pos, scale, yaw, pitch, roll })` to
  place a tool, and low-level `subtractVerts` / `unionVerts` / `intersectVerts`
  if you'd rather skip the `Solid` wrapper.

## Relates to

- [draw.md](draw.md) — game.assets.frames / frameSize.
- [world3d.md](world3d.md) — the 3D layer packs extend.

Signatures: engine/webgpu/art2d.d.ts, engine/webgpu/art3d.d.ts.

## Noise textures — steam, smoke, fire, water, clouds (engine core)

Perlin noise in a fragment shader is paid every pixel, every frame. The
engine's answer is a noise TEXTURE: seeded, tileable Perlin fBm generated
on the CPU at load (a 256×256, 4-octave texture is single-digit
milliseconds) and then sampled for free like any sprite.

```ts
import { Game, noiseCanvas } from '../engine/webgpu.js';

// White with noise in the ALPHA channel — the smoke/steam shape.
const F_STEAM = game.assets.frames(noiseCanvas({ size: 256, cell: 56, octaves: 3, seed: 7, alpha: true }));

game.run((d, dt, t) => {
  // Scroll it forever — tile: true (the default) means NO visible seam.
  d.sprite(F_STEAM, x, y, { w: 120, h: 200, tint: '#cfd8ec', alpha: 0.5, uvScroll: { y: -t * 0.15 } });
});
```

- `noiseCanvas({ size, cell, octaves, seed, tile, alpha, mask })` → canvas
  for `game.assets.frames()`. `cell` = feature size in px; `alpha: true` = white +
  noise alpha (tint it per sprite); `mask: 'radial'` bakes a soft circular
  falloff — the PUFF shape; default = opaque grayscale (patterns, dissolve
  masks, lookups). Same seed = same texture, every machine.
- STEAM in 3D: `world.wisp({ frame })` IS this technique natively (true
  3D twist — see particles3d.md); prefer it in any 3D scene.
- STEAM in 2D (wispy, elegant — coffee, kettles, vents): the RIBBON recipe.
  ONE tall sprite over a TILEABLE grayscale noise frame with the 'steam'
  DeformDef (see examples/smoke.ts — the def is pure data): vertex twist +
  wind sampled FROM the noise texture, fragment scrolls the noise upward,
  smoothstep(0.4, 1.0) remap, all four edges faded (long fade at the top).
  A scrolling noise curtain needs the remap + edge fades — without them it
  reads as banded rectangles.
- SMOKE (heavy, billowing — fires, explosions, chimneys): radial-masked
  PUFFS. Each billow spawns at the source, rises with growing sway,
  expands, slowly rotates (`rot`) and fades (alpha in fast, out slow).
  2 layers × ~12 puffs from 2 seeds — examples/smoke.ts (the campfire).
- Pure fns for custom work: `perlin2(x, y, perm, period)`, `fbm2`,
  `noisePerm(seed)`, `noiseData(opts)` (Float32Array in [0,1], DOM-free).

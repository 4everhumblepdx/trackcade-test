# Voxels — Minecraft-style block worlds: build, mine, place, hit

Everything here lives ON the 3D world: `const world = await game.world3d()`
first (see [world3d.md](world3d.md)), then `const vox = world.voxels()`. The
voxel layer is a lazy part of the 3D core — 2D games never load it.

## How do I…

**…a BLOCK WORLD (Minecraft-style landscape)?** `const vox = world.voxels()` —
one call, zero art files. It builds a bounded, editable volume split into
CHUNKS; each chunk meshes only its EXPOSED faces (interior faces cost nothing)
into one draw call, with baked ambient occlusion and a procedural block
"texture pack". It's lit and fogged by THIS world's sun and sky, so it matches
the day/night dial automatically. Options: `{ sizeX: 128, sizeY: 48, sizeZ:
128, chunk: 16, blockSize: 1, tileRes: 16, seed: 1, mipmaps: true, cullDist }`.
`chunk` is the chunk edge in blocks (bigger = fewer draws, costlier single
edits); `blockSize` is world-units per block; `tileRes` is the block-texture
resolution. There is ONE voxel world per `world` (a second `voxels()` returns
the same handle). Author it with `generate` (below) before the first frame.

**…FILL the world with terrain?** `vox.generate((x, y, z) => blockId)` — called
once for every cell; return `0` (air) or a block id. Drive it with the engine's
noise for rolling hills:
```ts
import { Game } from '../engine/webgpu.js';
import { fbm2, noisePerm } from '../engine/webgpu.js';   // seeded, tileable
const game = await Game.create({ pixelArt: true });   // worldHeight (2D/HUD only) defaults to 768; the 3D world uses its own fov
const world = await game.world3d({ fog: { color: '#a9c7e8', near: 120, far: 400 } });
world.sky({ time: 11 }); world.shadows?.({ size: 120 });
const vox = world.voxels({ sizeX: 160, sizeY: 48, sizeZ: 160, blockSize: 1 });
const perm = noisePerm(7);
vox.generate((x, y, z) => {
  const h = 18 + Math.floor(fbm2(x * 0.02, z * 0.02, perm, { octaves: 4 }) * 14);
  if (y > h) return y <= 20 ? 9 /*water*/ : 0;            // sea level 20
  if (y === h) return h <= 21 ? 5 /*sand*/ : 1 /*grass*/;
  if (y > h - 4) return 2 /*dirt*/;
  return 3 /*stone*/;
});
world.orbit({ fly: true, dist: 30, target: { x: 80, y: 24, z: 80 } });   // WASD/QE free-cam
game.run(() => {});
```
The block ids are on `BLOCK` (import it) — `air, grass, dirt, stone, cobble,
sand, log, planks, leaves, water, snow, glass, brick, coalOre, goldOre, gravel,
bedrock`. `generate` marks every touched chunk dirty; the world remeshes them
over the next frames (budget-capped so a huge fill can't stall one frame).

**…a ready-made landscape (and a reseed button)?** Skip hand-rolling noise —
`vox.landscape({ type, seed })` fills the world with a finished land type:
`'island'` (land ringed by sea), `'plains'` (gentle, a little water),
`'hills'`, `'mountains'` (ridged peaks + snow caps), `'flat'`. Every type is
SOLID from the surface down to bedrock, so you can dig straight through it; the
sea, beaches, snow line, dirt band and an ore-flecked stone core are all baked
in. It's deterministic by `seed`. A reseed button is just calling it again —
`landscape` clears the world first, so a new seed swaps the whole world and only
the changed chunks remesh:
```ts
let seed = 1;
const rebuild = () => vox.landscape({ type: 'hills', seed });
rebuild();
reseedButton.on('click', () => { seed++; rebuild(); });   // instant new world
```

**…walk and JUMP a character on the blocks (player OR mob)?** `new
VoxelBody(vox.world, spawn, opts)` is an AABB that walks the voxel grid —
gravity, jumping, wall collisions, and auto step-up over single-block terraces,
all resolved against the blocks. It's the SAME body for the player and for AI.
Feed it a wished horizontal velocity + a jump flag each frame; read `onGround`
and `blocked`:
```ts
import { VoxelBody } from '../engine/webgpu.js';
const player = new VoxelBody(vox.world, { x: 80, y: vox.world.columnTop(80, 80) + 1, z: 80 }, { width: 0.6, height: 1.8 });
game.run((d, dt) => {
  let mx = 0, mz = 0;                                 // camera-relative WASD
  if (game.input.key('KeyW')) mz += 1; if (game.input.key('KeyS')) mz -= 1;
  if (game.input.key('KeyA')) mx -= 1; if (game.input.key('KeyD')) mx += 1;
  const cy = Math.cos(rig.yaw), sy = Math.sin(rig.yaw), spd = 5;
  const wishX = (cy * mx - sy * mz) * spd, wishZ = (-sy * mx - cy * mz) * spd;
  player.step(dt, wishX, wishZ, game.input.key('Space'));
  // render at player.x/y/z (× blockSize); position the camera off it
});
```
Positions are in BLOCK units (multiply by `blockSize` for rendering, like the
raycast). `step` is substepped internally so fast motion never tunnels through a
wall. `stepHeight` defaults to 1.05 (walks single-block terraces smoothly); set
it ~0.6 for jump-required full blocks.

**…ANIMALS / CREEPERS that roam and chase (AI)?** `new VoxelAgent(vox.world,
spawn, { mode, speed })` wraps a `VoxelBody` with a small brain and drives it —
call `agent.update(dt, target?)` each frame. Modes: `'wander'` (roams, randomly
re-heads), `'seek'` (chases the `target` point — a creeper after the player),
`'flee'` (bolts away — a skittish animal), `'idle'`. All of them AUTO-JUMP when
a wall blocks them, so they climb terraces like a real mob. `agent.heading` is
where it's facing (point its mesh there); `agent.body` is the physics body:
```ts
import { VoxelAgent } from '../engine/webgpu.js';
const sheep = new VoxelAgent(vox.world, spawnOnGrass(), { mode: 'wander', speed: 2.2 });
const creeper = new VoxelAgent(vox.world, spawnOnGrass(), { mode: 'seek', speed: 3.6 });
game.run((d, dt) => {
  sheep.update(dt);                                   // roams on its own
  creeper.update(dt, { x: player.x, z: player.z });   // hunts the player
  // draw a box/billboard at agent.body.x/y/z, yaw = agent.heading
});
```

**…MINE a block (break it) / PLACE a block?** Raycast from the camera (or any
origin/direction) and edit the hit. `vox.raycast(ox,oy,oz, dx,dy,dz, maxDist)`
returns `{ x, y, z, nx, ny, nz, dist }` — the solid block hit and the face
NORMAL it entered through — or `null`. Break = set the hit cell to air; place =
set `hit + normal` (the empty cell in front of the face) to your block:
```ts
import { BLOCK } from '../engine/webgpu.js';
canvas.addEventListener('pointerdown', (e) => {
  const ray = world.screenRay(e);                         // {origin, dir, ground}
  if (!ray) return;
  const hit = vox.raycast(ray.origin.x, ray.origin.y, ray.origin.z, ray.dir.x, ray.dir.y, ray.dir.z, 48);
  if (!hit) return;
  if (e.button === 0) vox.set(hit.x, hit.y, hit.z, BLOCK.air);                        // break
  else vox.set(hit.x + hit.nx, hit.y + hit.ny, hit.z + hit.nz, BLOCK.stone);          // place
});
```
`vox.set(x, y, z, id)` / `vox.get(x, y, z)` are the edit API — a set marks just
the owning chunk (and a bordering neighbour) dirty, so one block change
re-meshes ~one chunk, not the world. THE CONTRACT: `raycast` reads the SAME
grid the mesher rasterises, so the block you pick is exactly the block you see.
For a centre-screen crosshair, cast from the camera eye down its forward axis
(`world.camera` gives eye + target — direction = target − eye).

**…the WHOLE build/mine cursor (outline, ghost, cadence, anti-embed) done for
me?** `world.voxelEditor(vox, opts)` wraps the lot: a debounced raycast, the
black target OUTLINE, the placement GHOST (red when blocked), held-button
cadence, optional per-block hardness (multi-hit mining), and an anti-embed
guard. It carries NO effects — it EMITS `onHit`/`onBreak`/`onPlace` (also
returned from `update`), so YOU spawn the debris/drops/sounds. Feed it a camera
ray each frame (e.g. from [mcControls](minecraft-controls.md)):
```ts
const edit = world.voxelEditor(vox, {
  reach: 12, blocked: (x, y, z) => insidePlayer(x, y, z),   // keeps the player's own cells free
  onBreak: (e) => shatter(e.x, e.y, e.z, e.id),             // YOUR fx; id = what was there
});
game.run((d, dt) => {
  edit.block = PALETTE[mc.sel];                             // what a place drops
  edit.update(dt, { origin: eye, dir: mc.forward(), mining: mc.mining, placing: mc.placing });
});
```
`hardness: (id) => hits` turns instant creative breaking into survival mining
(each hit fires `onHit` with `progress` 0..1; the last fires `onBreak`).
`outline`/`ghost: false` hide either cursor. TRAP — the editor writes the block
ITSELF and hands your `onBreak` the id — the block is already gone by then, so
that handler is purely for the effect (particles, sound, score). It also writes
`world.camera`'s target only via your ray — pair it with a control rig, which
owns the camera on its own.

**…give the player MINECRAFT CONTROLS (mouse+keyboard AND mobile)?** One import
covers the lot — the optional rig `mcControls(game, opts)`: pointer-lock look,
WASD + sprint, jump/fly, break/place, a hotbar, and the full mobile touch layout
(joystick + drag-look + tap/hold), plus apply-helpers that move the camera and a
`VoxelBody` for you. Full recipe + traps in
[minecraft-controls.md](minecraft-controls.md). The raycast break/place it
drives is the "…MINE / PLACE a block?" entry above.

**…know what's under a point (walk/stand on the surface)?**
`vox.world.columnTop(x, z)` returns the highest solid block Y in a column (or
-1). `vox.get(x, y, z) !== 0` is the solid test for a character's feet/AABB —
step the player in floats and sample the integer cells around the hull. Water
(`BLOCK.water`) reports as non-solid to the raycast (you swim through it) but
still draws.

**…make it look right (the Minecraft feel)?** It's already baked: per-vertex
AMBIENT OCCLUSION darkens tucked corners (the signature crease shading), and
`pixelArt: true` on `Game.create` gives crisp nearest-filtered texels. Keep
`mipmaps: true` (default) so distant faces don't shimmer. Use `world.sky({
time })` and the blocks pick up the sun colour, hemisphere ambient and fog
automatically — spin `sky.time` and the whole world goes to dusk with them.
(Voxels take the baked AO, not the sun shadow map — the Minecraft read.)

**…a custom block palette / my own textures?** The pack is procedural (16×16
pixel generators, no image files) — the ready set covers grass/dirt/stone/
cobble/sand/log/planks/leaves/water/snow/glass/brick/ores/gravel/bedrock, which
is enough for most builds. `TILES` is the tile list and `BLOCKS` the id→face
table (`{ top, bottom, side, opaque?, solid?, cutout? }`); a block sets `opaque:
false` to show faces behind it (leaves, glass, water) and `cutout: true` to
alpha-test (leaves/glass holes). Extending the palette is an engine change (add
a generator + a `BLOCKS` row), not a per-game one.

## Performance notes

- **One draw call per non-empty in-range chunk.** Empty chunks and chunks past
  `cullDist` (defaults to the fog far, else 512 units) are skipped every frame.
- **Edits are local.** `set` re-meshes only the owning chunk (+ a neighbour if
  the block sits on a chunk face). A big burst is budget-capped across frames.
- **Interior faces never exist.** The mesher emits a face only where the
  neighbour is air or a non-opaque different block — a solid mountain is a thin
  shell of geometry.
- **Physics: not needed.** Minecraft-style movement is grid queries against
  `vox.get`, not a rigid-body sim. Reach for Box3D physics only if you want
  blocks to tumble as dynamic bodies (a different, heavier thing).

## Relates to

- [world3d.md](world3d.md) — the 3D world, camera, `world.orbit({ fly })`
  free-cam, lights and shadows the voxels are lit by.
- [terrain3d.md](terrain3d.md) — the SMOOTH heightfield landscape (bands +
  `heightAt`). Use terrain for organic ground you ride; use voxels for blocky
  worlds you dig and build.
- [sky-water3d.md](sky-water3d.md) — the sky dome + day/night dial that tints
  the blocks, and standalone water bodies.

Signatures: engine/webgpu/voxel3d.d.ts, engine/webgpu/world3d.d.ts, engine/webgpu/voxeledit3d.d.ts.

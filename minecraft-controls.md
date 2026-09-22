# Minecraft controls — a drop-in first-person rig (mouse+keyboard AND mobile)

An OPTIONAL control rig for voxel / block games: `mcControls(game, opts)` gives
the player the exact scheme a Minecraft player expects, on BOTH input surfaces,
with zero wiring of your own. Pair it with a [`world.voxels()`](voxels.md)
world. It's an INPUT rig — it owns look + input INTENT + the on-screen HUD, and
its apply-helpers move a camera or a `VoxelBody` for you; YOU drive the block
edits from `mc.mining / placing / sel` against `vox.raycast` (that's the game).

What you get, free, from one call:
- **Desktop** — click to LOCK the pointer (then mouse looks freely, Esc
  releases), WASD/arrows relative to look, double-tap-W / Ctrl **sprint**,
  Space = **jump** (walk) or **rise** (fly), Shift = sneak/sink, double-tap-Space
  toggles **fly**, LEFT **breaks** / RIGHT **places** (held = repeat), wheel +
  number keys 1–9 pick the **hotbar**.
- **Mobile** (auto — the Bedrock layout) — a floating **thumb-joystick**,
  drag-to-look, quick **tap = place** / stationary **hold = break**, a jump/rise
  button (double-tap toggles fly) + a sneak/sink button, tap a hotbar slot.
- **HUD** — `mc.drawHud(d, t, font)` paints the crosshair, hotbar, and (on
  touch) the joystick + buttons. Sizes are fractions of the view, so bake the
  font BIG and let it scale down crisply.

## How do I…

**…wire the whole thing up?** `mcControls(game, opts)`, then a four-step frame:
`poll()` → move (`flyStep`/`walkStep`) → aim (`firstPerson`/`thirdPerson`) →
`drawHud()`. Read `mc.forward()` + `mc.mining/placing/sel` to edit the world.
```ts
import { Game, mcControls, BLOCK, VoxelBody } from '../engine/webgpu.js';
const game = await Game.create({ pixelArt: true });   // worldHeight (2D/HUD only) defaults to 768; the 3D world uses its own fov
const world = await game.world3d(); world.sky({ time: 10 });
const vox = world.voxels({ sizeX: 96, sizeY: 40, sizeZ: 96 }); vox.landscape({ type: 'hills', seed: 3 });

const PALETTE = [BLOCK.grass, BLOCK.dirt, BLOCK.stone, BLOCK.cobble, BLOCK.planks, BLOCK.log, BLOCK.glass, BLOCK.brick];
const mc = mcControls(game, {                             // creative fly + build + 8-slot hotbar
  pitch: 0.2, vertical: 'fly', canFly: true, canBreak: true, canPlace: true,
  hotbar: { names: ['grass','dirt','stone','cobble','planks','log','glass','brick'],
            colors: ['#6aa84f','#7a5a3a','#8a8a8a','#6f6f6f','#b58a4b','#6b4f2a','#bfe0ea','#9e4b3b'] },
});
const eye = { x: 48, y: 26, z: 20 }, EYE = 1.62;
const player = new VoxelBody(vox.world, { x: eye.x, y: eye.y - EYE, z: eye.z }, { width: 0.6, height: 1.8 });
const edit = world.voxelEditor(vox, { reach: 12 });      // raycast + outline + ghost + cadence, for free
const font = game.assets.font({ font: 'bold 64px system-ui' });  // big bake → HUD scales it down crisply
game.run((d, dt, t) => {
  mc.poll();                                              // 1. read input into intent
  if (mc.fly) { mc.flyStep(eye, dt, 16); player.x = eye.x; player.y = eye.y - EYE; player.z = eye.z; player.vy = 0; }
  else { mc.walkStep(player, dt); eye.x = player.x; eye.y = player.y + EYE; eye.z = player.z; }  // gravity/jump in the body
  mc.firstPerson(world.camera, eye);                      // 2. aim the camera (or mc.thirdPerson(cam, head, 6))
  edit.block = PALETTE[mc.sel];                           // 3. the editor raycasts + edits from the intent…
  edit.update(dt, { origin: eye, dir: mc.forward(), mining: mc.mining, placing: mc.placing });
  mc.drawHud(d, t, font);                                 // 4. crosshair + hotbar + touch controls
});
```
That's the whole game. The rig is INPUT; [`world.voxelEditor`](voxels.md) is the
block editor — it owns the raycast, the target outline, the placement ghost,
cadence and the anti-embed guard, and emits `onHit`/`onBreak`/`onPlace` so YOU
add effects. Pass `blocked`/`hardness`/`onBreak` in its options (see voxels.md).

**…make it survival (walk) vs creative (fly)?** `vertical: 'jump'` = survival:
Space jumps, gravity always on — drive a `VoxelBody` with `mc.walkStep(body,
dt)` every frame and put the eye at `body.y + 1.62`. `vertical: 'fly'` (+
`canFly` to let double-tap-Space toggle) = creative: `mc.flyStep(eye, dt,
speed)` moves a free `{x,y,z}` eye (sprint doubles speed; Space/Shift rise/sink).
Support BOTH in one game by branching on `mc.fly` (as above) and parking the
body under the eye while flying so a drop into walk falls from there.

**…show the placement PREVIEW / target outline?** `world.voxelEditor` draws
both — a black wireframe on the BREAK target and a translucent GHOST on the
PLACE cell (`hit + normal`), tinted `edit.ghostColor`, turning red where
blocked. They sit one cell apart by design (face-based placement, like
Minecraft). `outline`/`ghost: false` hides either. (`cubeEdges()` is still
exported if you want to roll a custom `world.lines()` outline.)

**…stop the auto-builder walling me in / twitching / over-reaching?** All in the
editor: `blocked: (x,y,z) => …` (skip the eye's cell, or the body AABB
`floor(x±0.32)`,`floor(y)…floor(y+1.8)`) refuses the place and reddens the
ghost; `reach` bounds the ray (≈5–12); the target is debounced (~3 frames) so
the cursor doesn't flicker at block seams. `breakRate`/`placeRate` set the
held-button cadence; `hardness: (id) => hits` makes mining take several hits.

**…tune look speed / the hotbar / sensitivity live?** `mc.sensitivity` (rad per
px, default 0.0022) is a live field — bind a slider to it. The hotbar is
`{ names, colors }` (any length); `mc.sel` is the selected index (wheel / number
keys / tap drive it). `canBreak` / `canPlace` gate the two edit actions
independently (a look-only explore cam sets both false).

## API surface

- `mcControls(game, opts) → McControls` (factory; `new McControls(game, opts)`
  works too). `opts`: `yaw, pitch, vertical:'fly'|'jump', canFly, canBreak,
  canPlace, hotbar:{names,colors}, sensitivity`.
- Per-frame: **`poll()`** (read input first), **`flyStep(eye, dt, speed)`**,
  **`walkStep(body, dt, {walk,run,sneak}?)`**, **`firstPerson(cam, eye)`**,
  **`thirdPerson(cam, target, dist, lift?)`**, **`drawHud(d, t, font?)`**.
- Read: `yaw, pitch, forward()`, `wish(speed)`, `mining, placing, sel, fly,
  sprint, sneak, up, jumpHeld`, `locked, touch`.
- `cubeEdges(h?)` — the 12-edge unit-cube polyline for `world.lines()` block
  outlines. `mc.detach()` unwires every listener + releases the pointer.

## Relates to

- [voxels.md](voxels.md) — the block world this drives: `world.voxels()`,
  `VoxelBody`, `vox.raycast` / `vox.set`, land presets.
- [world3d.md](world3d.md) — `world.camera` (the rig owns it outright),
  `world.lines()` for the block outline, `world.box()`.

Signatures: engine/webgpu/mccontrols.d.ts.

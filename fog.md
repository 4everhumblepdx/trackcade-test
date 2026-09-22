# Fog of war & field-of-view

`FogGrid` is a **standalone** visibility component — pure CPU math, zero engine
hooks. Import it directly (`import { FogGrid } from '../engine/webgpu.js'`); it
is NOT wired into `Game`. It's the *vision* side of grid games (the counterpart
to the routing components): what a viewer/light can SEE, with walls casting real
shadows, plus fog-of-war memory.

## Concepts

- **Blockers** (`opaque`) — cells that stop light/sight (walls, objects). Load
  them from any tile grid: `fog.blockFrom(dungeon.tiles())`.
- **Lights** — each a point with a `radius` and `intensity`. `compute()` runs
  **recursive shadowcasting** from every light, so cells behind a blocker fall
  into shadow, and brightness falls off to the radius. The player's own sight is
  just a light; a torch is another; a distant lamp reveals its own room.
- **Fog memory** — every cell is `unseen` (never lit), `explored` (seen before,
  dark now), or `visible` (lit this frame). Toggle with `memory`.
- **`canSee(a, b)`** — a direct line-of-sight test (independent of the light
  field) for AI: *can the guard see the player?*

## How do I…

**…add fog of war to a level?** Block from the level's walls, add the player's
sight as a light, and recompute as they move:

```ts
import { FogGrid } from '../engine/webgpu.js';

const fog = new FogGrid({ cols: dungeon.cols, rows: dungeon.rows });   // memory on by default
fog.blockFrom(dungeon.tiles());                       // walls cast shadows
const eye = fog.addLight(player.col, player.row, 8);  // 8-cell sight radius

// each frame, after the player moves:
eye.col = player.col; eye.row = player.row;
fog.compute();
```
Then render per cell by `fog.state(c, r)`:

```ts
for (const cell of cells) {
  const st = fog.state(c, r);                         // 'unseen' | 'explored' | 'visible'
  if (st === 'unseen') continue;                      // draw nothing (black)
  const dim = st === 'explored' ? 0.18 : fog.lightAt(c, r);   // 0..1 brightness
  drawTile(c, r, dim);
}
```

**…place torches / lamps that extend sight or reveal a far area?** More lights —
the lit region is their combined, shadowed reach:

```ts
fog.addLight(torch.col, torch.row, 5, { intensity: 0.85 });   // brightens nearby
fog.addLight(farLamp.col, farLamp.row, 6);                    // reveals a distant room
```
Each cell keeps the BRIGHTEST light reaching it. `removeLight(src)` / `clearLights()`.

**…soften the light edge?** `falloff` per light (or a grid default):
`'smooth'` (default), `'linear'`, `'quadratic'`, or `'none'` (hard circle).

**…do enemy line-of-sight ("can the guard see me?")?** `canSee` walks the line
and fails on the first blocker; pass a range cap:

```ts
if (fog.canSee(guard.col, guard.row, player.col, player.row, guard.viewRange)) alert(guard);
```

**…want pure dynamic lighting with NO memory?** `new FogGrid({ …, memory: false })`
— cells go straight back to `unseen` when unlit (torch-lit rooms, a lighting
pass), no explored tier.

**…reveal or reset the map?** `fog.revealAll()` (whole map explored),
`fog.resetMemory()` (forget), or `fog.reveal(col, row, radius)` to mark a
shadowcast region explored without leaving a light on (a scouted area, a map
pickup).

**…move / place blocking objects at runtime?** `fog.setOpaque(col, row, on)`
(a closing door, a destroyed wall) — they cast/stop shadows on the next
`compute()`.

## Queries

- `state(c, r)` → `'unseen' | 'explored' | 'visible'` · `lightAt(c, r)` → `0..1`
- `isVisible(c, r)` · `isExplored(c, r)` · `isOpaque(c, r)`
- `canSee(c0, r0, c1, r1, range?)` → line-of-sight bool
- `cellAt(x, y, cellSize, ox?, oy?)` → which cell a world position is in
- Raw fields: `opaque`, `light`, `explored`, `lights[]`

## Relates to

- [levelgen.md](levelgen.md) / [maze.md](maze.md) — `blockFrom(tiles())` wires a generated level's walls as shadow casters.
- [flowfield.md](flowfield.md) — the movement side; pair pathfinding (how to move) with fog (what's known).
- [draw.md](draw.md) — render `state()` / `lightAt()` per tile.

Signatures: engine/webgpu/fog.d.ts.

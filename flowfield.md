# Flow-field pathfinding — tower defense & swarms

`FlowGrid` is a **standalone** pathfinder: pure data, zero engine hooks. It
solves the "many units, one goal" problem — instead of running A* per enemy,
run **one** search from the goal across the whole grid, and every unit just
reads its local flow direction. Placing an obstacle (a tower) recomputes the
one field and the whole crowd re-routes.

```ts
import { FlowGrid } from '../engine/webgpu.js';

const grid = new FlowGrid({
  cols: 40, rows: 30,
  goals: [{ col: 39, row: 15 }],           // the base
  spawns: [{ col: 0, row: 15 }],           // for the build guard
});
```

## Concepts (redblobgames.com/pathfinding/tower-defense)

- **Integration field** — `distance(col, row)`: cost to the nearest goal per
  cell (Dijkstra from all goals at once; `Infinity` = walled off). Multiple
  goals just seed the search together (the "supernode" trick).
- **Flow field** — the negative gradient of that field: each cell's step
  direction toward the goal. Read it per cell (`flowVec`) or, for a unit that
  isn't on a cell centre, interpolated and smooth (`steer`).
- **One search, all units.** Build the field once; hundreds of enemies each do
  an O(1) `steer()` lookup per frame. Re-jostled or newly-spawned units already
  have their path — no per-unit recompute.
- **Mutable grid.** Block/unblock cells (towers, walls), weight cells (mud,
  roads), move the goals — the field rebuilds **lazily** on the next query.
- Movement is 8-way by default and **won't cut between two diagonal towers**
  (`cutCorners: false`) — units can't squeeze through a corner gap.

## How do I…

**…make a swarm of enemies walk to the base?** One field, and each enemy reads
`steer()` at its world position:

```ts
const grid = new FlowGrid({ cols: 40, rows: 30, goals: [base], spawns: [gate] });
const TILE = 20;   // world units per cell

for (const e of enemies) {
  const dir = grid.steer(e.x, e.y, TILE);   // smooth unit vector toward the base
  e.x += dir.x * e.speed * dt;
  e.y += dir.y * e.speed * dt;
}
```
Trap: `steer` returns a **unit** vector (or `{0,0}` at the goal / in a dead
pocket) — multiply by your own speed. `cellSize` + optional `originX/Y` map
world units to the grid, same as `cellAt`.

**…let the player build towers while a route to the base stays open?** Guard
with `canBuild`, then `build`:

```ts
const cell = grid.cellAt(pointer.x, pointer.y, TILE);       // { col, row } | null
if (cell && grid.canBuild(cell.col, cell.row)) grid.build(cell.col, cell.row);
// else: illegal — it would trap a spawn, or it's the goal/spawn/occupied
```
`canBuild` runs a connectivity check with the real movement rules and **does not
mutate** the grid. `build`/`unbuild`/`clearBlocked` place and remove; the field
recomputes on the next `steer`/`distance` call.

**…feed the SAME field to a 3D game?** The grid lives on the ground plane —
pass world X/Z where the 2D API wants x/y (one unit per cell):

```ts
for (const enemy of mobs) {
  const s = grid.steer(enemy.x, enemy.z, 1);   // cell = 1 world unit
  enemy.x += s.x * speed * dt;
  enemy.z += s.y * speed * dt;                 // note: s.y drives Z
}
```

**…add terrain that slows units (mud) or speeds them (roads)?** Per-cell
weight — cells stay passable, just cost more/less to enter, so the flow bends
around expensive ground:

```ts
grid.setWeight(c, r, 4);     // mud: 4× cost   ·   grid.setWeight(c, r, 0.5) road
```
Trap: weight ≠ block. Use `setBlocked(c, r, true)` (or `build`) for a real wall.

**…draw the field for debugging / a minimap?** The raw arrays are public:
`grid.dist` (integration field, `Infinity` = unreachable) and per-cell
`grid.flowVec(c, r)` for an arrow. `grid.distance` / `grid.reachable` /
`grid.flowDir` are the guarded accessors.

**…preview the route a spawn will take?** `path` follows the flow to a goal:

```ts
const route = grid.path({ col: 0, row: 15 });   // [{col,row}, …] to the base, [] if trapped
```

**…have several exits/bases?** Pass them all as `goals` — the field flows to
the nearest. `setGoals([...])` swaps them at runtime (field goes dirty).

## Relates to

- [maze.md](maze.md) — the sibling grid component; `Maze.tiles()` can seed a
  `FlowGrid`'s obstacles (block every wall tile) for maze-shaped enemy routing.
- [agents.md](agents.md) — steering/flocking for units once they have a heading.
- [draw.md](draw.md) / [world3d.md](world3d.md) — render the grid, towers, enemies.

Signatures: engine/webgpu/flowgrid.d.ts.

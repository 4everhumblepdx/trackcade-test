# Level generators — dungeons & caves

`Dungeon` and `Cave` are **standalone** procedural level generators — pure data,
zero engine hooks. Import them directly (`import { Dungeon, Cave } from
'../engine/webgpu.js'`). They're the siblings of `Maze`: all three emit the
**same thick 0/1 tile grid**, so whatever renders/collides a maze renders a
dungeon or cave unchanged.

| Generator | Shape | Use it for |
|---|---|---|
| [`Maze`](maze.md) | wall-per-edge corridors | puzzle mazes, Pac-Man, tight labyrinths |
| **`Dungeon`** | open ROOMS joined by tunnels + doors | Rogue / Nethack / Zelda, shooters, RPG floors |
| **`Cave`** | organic cellular-automata caverns | Terraria / Spelunky, mining, natural caves |

All three are **deterministic** (same `seed` + options ⇒ identical level; a
string seed is hashed) and share the `Cell` (`{col,row}`) vocabulary,
`tiles()`, `isWall`/`isFloor`, `cellAt`, and a BFS `path()`.

## Feeding the engine (same as Maze)

```ts
import { Dungeon, CollisionGrid } from '../engine/webgpu.js';

const dungeon = new Dungeon({ cols: 60, rows: 40, seed: 'floor-1' });
const grid = dungeon.tiles();                    // (cols × rows) of 0 floor / 1 wall
const collision = new CollisionGrid(24, grid);   // 24px tiles → sprite collision
```
Both work directly in TILE space (one cell = one floor tile you walk on — no
`2·+1` doubling like Maze). `tiles({ wall, open })` remaps the values; a 3D
dungeon is one wall box per solid tile (see [world3d.md](world3d.md)); block a
`FlowGrid`'s obstacles from the same grid for enemy routing ([flowfield.md](flowfield.md)).

## Dungeon — how do I…

**…place the player, the objective and loot?** Rooms are TAGGED — no analysis
needed:

```ts
const start = dungeon.roomsByTag('start')[0];    // drop the player at start.cx/cy
const boss  = dungeon.roomsByTag('boss')[0];     // the objective (graph-farthest room)
for (const t of dungeon.roomsByTag('treasure')) spawnChest(t.cx, t.cy);   // dead-end rooms
// tags: 'start' | 'boss' | 'treasure' | 'junction' | 'normal'; every room has {col,row,w,h,cx,cy,tag,id}
```

**…know which room a position is in?** `roomAt` (null in a corridor / wall):

```ts
const room = dungeon.roomAt(col, row);           // DungeonRoom | null
if (room?.tag === 'boss') triggerFight();
```

**…find / draw the doors?** `dungeon.doors` is the threshold tiles (1-wide
openings into rooms) — place doors, gates, or ambushes there.

**…tune the layout?** `minRoom`/`maxRoom` (room size), `roomAttempts` (density),
`extraConnections` (loops beyond the single connecting tree — more = multiple
routes), `corridorWidth`. Rooms never overlap; the dungeon is always one
connected network.

## Cave — how do I…

**…make an organic cavern?** Random fill → cellular-automata smoothing → keep
the largest region (so it's one connected space):

```ts
const cave = new Cave({ cols: 90, rows: 56, seed: 'cavern', fillProb: 0.46, iterations: 4 });
```
`fillProb` (initial wall density, higher = tighter), `iterations` (smoothing
passes, more = rounder), `wallThreshold` (the CA majority rule), `keepLargest`
(default true — set false to leave disconnected pockets).

**…place an entrance and exit?** `farthestPair()` gives the two most distant
floor cells (an approximate cave diameter):

```ts
const [entrance, exit] = cave.farthestPair();
const route = cave.path(entrance, exit);         // BFS route between them
```

**…scatter ore / spawns?** `cave.floors()` is every open cell; `cave.openCount`
is how much cave you got.

## Shared queries (both)

- `tiles(opts)` → the 0/1 grid · `isWall(c,r)` / `isFloor(c,r)` · `inBounds` · `index`
- `cellAt(x, y, cellSize, ox?, oy?)` → which cell a world position is in (or `null`)
- `path(from, to)` → shortest walkable route (4-dir BFS), inclusive; `[]` if unreachable
- `floors()` → all walkable cells · `toString()` → ASCII (debug/tests)

## Relates to

- [maze.md](maze.md) — the third generator; same tile-grid contract.
- [tilemaps.md](tilemaps.md) — feed `tiles()` into a `Tilemap` / `CollisionGrid`.
- [flowfield.md](flowfield.md) — block a `FlowGrid` from `tiles()` for enemy pathfinding through the level.
- [world3d.md](world3d.md) — one wall box per solid tile for a 3D dungeon/cave.

Signatures: engine/webgpu/dungeon.d.ts, engine/webgpu/cave.d.ts.

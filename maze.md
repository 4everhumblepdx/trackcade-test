# Mazes — generation + gameplay queries

`Maze` is a **standalone** generator: pure data, zero engine hooks. Construct
one (generation runs in the constructor), then read from it — the walls, two
render-ready output shapes, and the queries a game needs (which cell am I in,
can I move that way, which way is the exit).

```ts
import { Maze } from '../engine/webgpu.js';

const maze = new Maze({ cols: 24, rows: 18, algorithm: 'backtracker', seed: 'level-1' });
```

## Concepts

- A maze is a `cols × rows` grid of **cells**. Each cell remembers which of its
  four sides still has a wall. Directions are `Maze.N / Maze.E / Maze.S / Maze.W`
  (= `0 1 2 3`); N is `row−1`, S is `row+1`, E is `col+1`, W is `col−1`.
- **Two output shapes from the same maze:**
  - `maze.tiles()` → a **THICK** `(2·cols+1) × (2·rows+1)` 0/1 grid — one solid
    tile per wall (Rogue/dungeon/first-person). This is what you feed a
    `Tilemap`, a `CollisionGrid`, or a wall-box build.
  - `maze.walls()` → **THIN** edge segments in cell units — the puzzle-book look,
    drawn as lines.
- Post-passes (all optional): `braid` opens loops (multiple routes), `rooms`
  stamps open halls, `exits` punches border openings.
- **Deterministic:** same `seed` + options ⇒ identical maze. Omit `seed` for a
  fresh one each call. A string seed is hashed.

## How do I…

**…generate a maze and drop it into the 2D tile engine (thick walls)?** Expand
to the tile grid and hand it to a `CollisionGrid` / `Tilemap`:

```ts
import { Maze, CollisionGrid } from '../engine/webgpu.js';

const maze = new Maze({ cols: 20, rows: 15, seed: 7, exits: 2 });
const grid = maze.tiles();                 // (2·20+1) × (2·15+1) of 0/1
const collision = new CollisionGrid(32, grid);   // 32px tiles, 1 = solid wall
```
Trap: the tile grid is TWICE the cell resolution + 1. Cell `(c, r)` is tile
`(2c+1, 2r+1)`; the tile between two cells is the wall. `tiles({ wall, open })`
remaps the two values (e.g. `{ wall: 1, open: 0 }` is the default).

**…build the maze in 3D (Rogue / first-person)?** One wall box per solid tile,
one unit per tile:

```ts
const grid = maze.tiles();
for (let z = 0; z < grid.length; z++)
  for (let x = 0; x < grid[z].length; x++)
    if (grid[z][x]) world.box({ x: x + 0.5, y: 0.5, z: z + 0.5, w: 1, h: 1, d: 1, color: '#7a4a3a' });
```

**…draw it puzzle-book style (thin walls)?** Each edge is one line segment in
cell units — scale to pixels:

```ts
const S = 28;   // pixels per cell
game.run((d) => {
  for (const w of maze.walls()) d.line(w.x1 * S, w.y1 * S, w.x2 * S, w.y2 * S, 3, '#7f9ce0');
});
```

**…choose the maze's *look*?** The `algorithm` biases the texture (all produce a
solvable maze):

| algorithm | texture |
|---|---|
| `backtracker` (default) | long winding corridors, few branches |
| `prim`, `kruskal` | bushy, many short branches + junctions |
| `wilson`, `aldous-broder` | unbiased/uniform (no texture); Aldous-Broder is slow — small grids only |
| `hunt-and-kill` | winding with more dead-ends |
| `eller` | uniform, one row at a time, very fast |
| `recursive-division` | nested chambers, rectilinear/roomy |
| `binary-tree`, `sidewinder` | trivial, strong directional bias |

**…make MULTIPLE ways to the exit (loops)?** `braid` — the fraction of
dead-ends to open. `0` = perfect maze (exactly one path between any two cells);
higher = more loops:

```ts
new Maze({ cols: 30, rows: 30, braid: 0.4 });   // ~40% of dead-ends become loops
```

**…add open rooms / islands inside the maze?** `rooms` stamps rectangular halls
(walls stay connected — rooms only add openness):

```ts
new Maze({ cols: 40, rows: 30, rooms: { count: 5, minSize: 3, maxSize: 6 } });
// or shorthand: rooms: 5
```
Read them back from `maze.rooms` (`{ col, row, w, h }`).

**…control the entrance / exits?** `exits` — a count (spread around the border)
or explicit specs. `0` seals the maze:

```ts
new Maze({ cols: 20, rows: 20, exits: 2 });                          // opposite N/S
new Maze({ cols: 20, rows: 20, exits: [{ side: 'W', at: 0 }, { side: 'E', at: 19 }] });
```
Resolved openings are in `maze.exits` (`{ col, row, dir }`).

**…know which cell an actor is in?** From a world/pixel position (matches the
THIN layout of `cellSize` units per cell):

```ts
const here = maze.cellAt(player.x, player.y, S);   // { col, row } | null (outside)
```
Trap: `cellAt` is for the thin cell-per-`cellSize` mapping. For a THICK
`tiles()` render, the actor's tile coords already tell you the cell — `col =
(tileX-1)/2`.

**…test movement — "can I go this way?"** No wall on that side:

```ts
if (maze.canMove(c, r, Maze.E)) { c += 1; }        // step east
```
Trap: stepping through a border opening returns `true` (it's an exit — a move
that LEAVES the maze). Check `maze.inBounds(t.col, t.row)` on the target if you
need to tell "exited" from "moved". `maze.step(c, r, dir)` gives the target cell;
`maze.neighbours(c, r)` lists the open ones.

**…get the direction to the exit (a hint arrow, or an AI chaser)?** One call —
it runs a BFS toward the nearest exit and caches it:

```ts
const dir = maze.directionToExit(c, r);            // Maze.N/E/S/W, or -1 if at an exit
```
For any other goal, build a distance field once and read a direction from any
cell in O(1):

```ts
const field = maze.distanceField([{ col: gx, row: gy }]);  // BFS distances, -1 = unreachable
const step = maze.directionTo(c, r, field);                // next Dir toward the goal
const route = maze.path({ col: c, row: r }, { col: gx, row: gy });  // full cell list
```

**…place keys / treasure / spawns sensibly?** `maze.deadEnds()` returns every
dead-end cell (exactly one open side).

## Relates to

- [tilemaps.md](tilemaps.md) — feed `tiles()` into a `Tilemap` / `CollisionGrid`.
- [world3d.md](world3d.md) — `world.box()` walls for a 3D dungeon.
- [draw.md](draw.md) — `d.line` for thin walls, `d.rect` for thick tiles.
- [index.md](index.md) — `worldHeight`, the frame lifecycle.

Signatures: engine/webgpu/maze.d.ts.

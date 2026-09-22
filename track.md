# Fixed-path tower defense — Track networks (Bloons style)

`Track` is a **standalone** component for the *other* tower-defense model: enemies
follow a **fixed, authored path** (which may fork and merge); guns are placed
**beside** it and just shoot. Pure data, zero engine hooks. Import it directly
(`import { Track } from '../engine/webgpu.js'`).

Pick the right tool:

| You want… | Use |
|---|---|
| Enemies follow a **set track** you draw; towers shoot from the side (Bloons) | **`Track`** (this doc) |
| Towers are **obstacles** that reshape the route on an open field (Desktop TD) | [flowfield.md](flowfield.md) (`FlowGrid`) |

`Track` builds on the engine's `Path` (arc-length curve following) and adds the
one thing it lacks — **branching**: a directed graph of named nodes joined by
`Path` edges, and a `TrackWalker` that picks a branch at each junction.

## Concepts

- A **node** is a named point; a **spawn** node is an entry, a **goal** node is
  an exit (reaching one = the enemy "leaked"). By default spawns are nodes with
  no incoming edge and goals are nodes with no outgoing edge.
- An **edge** is a `Path` from one node to another — a straight line, or any
  authored curve (`via:` = a `PathSegmentData` chain: `line`/`quad`/`cubic`/
  `arc`/`wave`…). At a junction the walker chooses an out-edge by `weight`.
- A **`TrackWalker`** carries `x` / `y` / `angle` (world pose, arc-length so speed
  is constant), `done` (leaked), `travelled`, and `distanceToGoal` — the
  remaining along-track distance, for target ranking.

## How do I…

**…make enemies follow a branching path?** Author the track, `spawn()` walkers,
advance them:

```ts
const track = new Track({
  nodes: { in: [0, 300], fork: [400, 300], top: [800, 120], bot: [800, 480], out: [1200, 300] },
  edges: [
    { from: 'in', to: 'fork' },
    { from: 'fork', to: 'top', via: [{ cubic: [[550, 300], [650, 120], [800, 120]] }] },  // branch A
    { from: 'fork', to: 'bot', via: [{ cubic: [[550, 300], [650, 480], [800, 480]] }] },  // branch B
    { from: 'top', to: 'out' }, { from: 'bot', to: 'out' },                                // merge
  ],
});

const w = track.spawn(140);                 // 140 units/s, random branch at the fork
// per frame:
if (w.advance(dt)) leaked();                // true once it reaches a goal
sprite.x = w.x; sprite.y = w.y; sprite.rot = w.angle;
```
Trap: `spawn()` picks a branch at each junction with the edge `weight`s (default
equal) and its `rng` (default `Math.random`; pass `{ rng }` for reproducible
waves). To bias a lane, weight its edge (`{ from:'fork', to:'top', weight: 3 }`).

**…do the same in 3D?** The track lives on the ground plane — read `walker.x` as
world X and `walker.y` as world Z:

```ts
enemyMesh.x = w.x; enemyMesh.z = w.y;       // w.y drives Z on the ground
```

**…let towers target the "first" enemy (nearest the exit)?** Rank by
`distanceToGoal` — SMALLER means further along the track:

```ts
let best = null, bestGoal = Infinity;
for (const e of enemies) {
  if (dist(e.walker, turret) > turret.range) continue;
  if (e.walker.distanceToGoal < bestGoal) { bestGoal = e.walker.distanceToGoal; best = e; }
}
if (best) fireAt(best);                      // then best.hp -= dmg, and kill at 0
```
For "last" targeting, pick the LARGEST `distanceToGoal` instead.

**…stop the player building a tower ON the path?** `distanceToTrack` is the
shortest distance from a point to the track centre-line:

```ts
if (track.distanceToTrack(x, y) > TOWER_CLEARANCE) placeTurret(x, y);   // else: too close
```

**…draw the track / lay it down as 3D road?** Every edge carries a sampled
polyline in `edge.points`:

```ts
for (const e of track.edges)
  for (let i = 0; i < e.points.length - 1; i++)
    d.line(e.points[i].x, e.points[i].y, e.points[i + 1].x, e.points[i + 1].y, 24, '#39456e');
```

**…stagger a wave so enemies spread out from the spawn?** `startDist` moves a
fresh walker that far up the track:

```ts
for (let i = 0; i < 10; i++) track.spawn(140, { startDist: i * 40 });
```

**…transform the whole track (fit to screen / mirror)?** Pass `PathOptions` as
the 2nd arg: `new Track(data, { offset: [ox, oy], flipX: W / 2 })` — applied to
every edge at bake time.

**…have multiple entrances or exits?** List them: any node in `spawns` is an
entry, any in `goals` ends the run. A `spawn()` with no `from` picks a random
spawn node.

## Relates to

- [flowfield.md](flowfield.md) — the OTHER tower-defense model (obstacles reshape routes).
- [sprites.md](sprites.md) / [world3d.md](world3d.md) — draw the enemies + turrets that follow the track.
- Built on `Path` (arc-length spline following) — see engine/webgpu/path.d.ts.

Signatures: engine/webgpu/track.d.ts.

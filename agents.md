# Agents — steering, flocking & movement with INTENT

Everything that moves *on its own* in a 3D world: fireflies drifting round a
fire, fish shoaling and fleeing, monsters hunting, birds flocking, minions
following a leader, patrols along a route. Get the world
(`const world = await game.world3d()`), spawn agents, bind each to a render
handle you already made. Byte-free until `world.agents()` — it's a CPU system,
not a render layer, so it costs nothing to draw (agents write onto retained
handles → one instanced draw per shape, however many agents).

## How do I…

**…start a flock in one line?** Named presets compose the behaviours for the
marquee cases:

```ts
const agents = world.agents();
const bodies = Array.from({ length: 200 }, () => world.wedge({ w: 0.7, h: 0.4, d: 1.6, color: '#8fa6c8' }));
const shoal = agents.flock({ preset: 'shoal' }, bodies);   // 200 fish, k-nearest flocking
```

Presets: `firefly` (wander), `fish` (wander + wiggle), `shoal` (flock), `bird`
(flock, hard banking), `hunter` (avoidance), `patrol`. Every knob overrides.

**…build a specific agent?** `agents.spawn(config)` — steering is DATA
(`behaviors: BehaviorSpec[]`), the same shape as `EffectDef`/`VfxDef`:

```ts
const firefly = agents.spawn({
  handle: dot,                       // a Mesh3d/Billboard3d/group — its pose is written each frame
  pos: { x: 4, y: 3, z: 0 },
  maxSpeed: 3.5, maxForce: 14, turnRate: 5, maxPitch: 1.2, bank: 0.6,
  behaviors: [
    { kind: 'contain', sphere: { center: fire, radius: 26 }, soft: 6 },   // stay near the fire
    { kind: 'wander', jitter: 1, vertical: 1 },                            // drift
  ],
});
```

**Behaviour kinds:** `seek` / `flee` / `arrive` (with a `tolerance` deadzone so
it stops without jitter) / `pursue` / `evade` (lead/dodge a moving `Agent3d`) /
`wander` / `flock` (`separation`/`alignment`/`cohesion`, `neighbors` = k, default
7) / `avoid` (whisker feelers vs `agents.obstacle(...)` spheres) / `terrain`
(stay `clearance` above `groundAt`) / `ceiling` / `contain` (box or sphere) /
`leader` (tuck behind a leader) / `follow` (ride a `Path3d`) / `custom` (an
escape-hatch fn). They **blend by priority** (Buckland's truncated running sum):
avoidance/containment claim the force budget first, then flocking, then goals —
so an agent never seeks its way into a wall.

**…make fish/birds FLEE the player, then regroup?** Fields + panic.
`agents.attractor({...})` pulls, `agents.repulsor({ follow: cameraOrHandle,
radius, strength })` pushes; a strong repulsor spike arms **panic** (~2 s of
2.5× speed, a shoal *scatters and rejoins* instead of politely detouring — what
reads as real flight). Fields take a fixed `pos` or a live `follow` handle.

**…patrol a route / follow a leader?** `{ kind: 'follow', path: myPath3d,
loop: true }` rides a `Path3d` ([world3d.md](world3d.md)); `{ kind: 'leader',
leader: bossAgent, behind: 2 }` tucks minions in behind.

**…keep swimmers under the water / flyers above the ground?**
`{ kind: 'terrain', groundAt: (x,z) => terrain.heightAt(x,z), clearance: 2 }`
lifts flyers over hills; `{ kind: 'ceiling', below: water.levelNow() }` caps
swimmers under the surface — the underwater fish tie-in ([underwater.md](underwater.md)).

**…make GROUND walkers — monsters, herds, minions on foot?** Give the agent a
`ground` config: steering then owns XZ only and the body is SNAPPED to the
surface each step (`slope: true` also tilts it to the gradient, so it leans up
ramps). The surface fn can be terrain OR authored geometry:

```ts
agents.spawn({
  handle: monster,
  ground: { at: (x, z) => terrain.heightAt(x, z), offset: 0.6, slope: true },
  maxPitch: 0.6,
  behaviors: [{ kind: 'pursue', target: player }, { kind: 'avoid', planar: true, radius: 1 }],
});
```

Use `avoid` with `planar: true` on the ground so walkers weave *around*
obstacles (not up over them). `avoid` casts the heading ray at obstacle
spheres, then COMMITS to one side of the nearest threat and steers tangentially
(arcs around) — held with hysteresis so it never flip-flops, and it doesn't
brake radially, so a walker won't jitter or reverse out when the goal sits
directly behind a boulder. Pass `radius` for the agent's own girth.

`avoid` is REACTIVE (local) — it reliably clears convex obstacles (boulders,
pillars) but, having no plan, it can still be trapped by a concave dead-end or
a long wall. When agents must route through real blockers to a goal, use
`navigate` (Tier-1 A*, below) — that plans around the whole field and never
walks into a pocket.

**…walk across BUILDINGS — up ramps, along planks, without falling off the
sides?** Two pieces. (1) The `ground.at(x, z)` returns the walkable-surface
height — return the ramp/plank/platform top inside its footprint, terrain
elsewhere — so the body climbs the ramp and rides the plank. (2) An `edge`
behaviour keeps them ON it: `{ kind: 'edge', walkable: (x, z) => bool }`
whisker-samples ahead + to the sides and turns back from any ledge, so a
walker crossing a narrow plank hugs the middle and never steps off. (For
arbitrary level geometry, bake a navmesh — Tier-3 below; for authored
structures this footprint-function approach is exact and cheap.)

**…make a monster PATHFIND around obstacles (not just bump-and-avoid)?**
Tier-1 A* over a `NavGrid` built from the terrain height:

```ts
const grid = new NavGrid({ heightAt: (x, z) => terrain.heightAt(x, z), size: 150, res: 72,
  maxStep: 3, blocked: (x, z) => nearAnyRock(x, z) });   // maxStep cuts cliffs
monster = agents.spawn({ ground: { at: terrain.heightAt, offset: 0.9, slope: true },
  behaviors: [
    { kind: 'avoid', planar: true, priority: 4 },                 // local dodge
    { kind: 'navigate', grid, target: () => player.pos, repathEvery: 0.5, arrive: 4 },  // global route
  ] });
```

`navigate` runs A* + string-pulling to the (moving) target and re-plans on
`repathEvery` (or when the goal drifts past `tolerance`). It
walks AROUND blocked/steep ground and returns no path up a sheer cliff (the
agent then just heads over and `avoid` copes). Pair it with `avoid` for local
dodging. `monster.navPath` is the current waypoint list (draw it to debug).

**…chase the player with a HORDE (hundreds)?** Tier-2 flow field — ONE Dijkstra
integration from the goal, then every agent is an O(1) lookup:

```ts
let field = grid.flowField(player.pos);       // rebuild (throttled) as the goal moves
const flow = { kind: 'flow', field };         // SHARE this one spec across all agents
agents.flock({ behaviors: [flow, { kind: 'flock', separation: 1.6, radius: 4 }],
  ground: { at: terrain.heightAt } }, 300);
// on the goal moving: field = grid.flowField(player.pos); flow.field = field;
```

Beats N × A* the moment N hits double digits.

**…navigate REAL level geometry (buildings, walls, ramps, multi-level)?**
Tier-3 recast NAVMESH — `await agents.navmesh(...)` bakes a Detour navmesh from
raw triangle geometry (a vendored WASM core, lazy-loaded like the physics
cores; byte-free until you bake one):

```ts
// From authored meshes (your level's collision tris — CCW so walkable faces up):
const nav = await world.agents().navmesh({ positions, indices, agentRadius: 1.2, agentMaxClimb: 0.5 });
// …or auto-triangulate a terrain heightfield:
const nav = await world.agents().navmesh({ from: 'terrain', heightAt: (x,z)=>terrain.heightAt(x,z), size: 400 });
monster = agents.spawn({ behaviors: [{ kind: 'navigate', grid: nav, target: () => player.pos }] });
```

A baked `NavMesh3d` satisfies the SAME `path()` contract as a `NavGrid`, so it
drops straight into the `navigate` behaviour. It's the right tool when the
walkable surface is real geometry (doorways, bridges, overhangs) rather than
"terrain + a list of round obstacles"; for open terrain the grid A* is lighter.
`nav.crowd({...})` exposes recast's Crowd for dense local avoidance.

**…tune it visually?** Set `agents.debug = true` (with `game.debug`) — the
world draws each agent's velocity (green), net steering force (orange), avoid
feeler (cyan), live A* path (violet) and every field's radius ring (magenta).
Body language is automatic: the heading DAMPS toward velocity (never snaps),
`bank` leans into turns (birds/fish), `maxPitch` clamps the climb, and a
per-agent `phase` (∝ speed) is there for a tail-wiggle vertex flag.

## Performance & determinism

- Agents are pure steering, not rigid bodies. Budget: hundreds of flocking
  agents well under a millisecond of CPU; `tickEvery` staggers far-away
  agents (solve at ½/¼ rate; motion stays smooth).
- Seeded per-agent PRNG for wander → reproducible runs.

## Traps

- **Bind a handle** (`handle:`) or the agent moves invisibly — it steers a point
  and writes `x/y/z` (+`yaw/pitch/roll` when the handle has them) each frame.
- **`arrive` needs its `tolerance` deadzone** and **`pursue` its clamped
  prediction** (both defaulted) — without them you get terminal jitter and
  orbiting. Cohesion is arrive-damped so a flock never pulses.
- Damp orientation: below a speed epsilon the heading holds (a
  frame-snapped yaw vibrates at low speed).
- Pathfinding is TIERED — reach for the cheapest that works: open steering +
  `avoid` (flyers/swimmers/open hunters) → `navigate` over a `NavGrid` (Tier-1
  A*, a monster around blockers on terrain) → `flow` (Tier-2 field, a horde on
  one goal) → `navmesh` (Tier-3 recast, real authored level geometry). All
  four are built; pick the lightest that fits.
- Re-plan `navigate` on a timer (every few tenths of a second); a `NavGrid`'s `res` (or a
  navmesh `cellSize`) is the cost knob.
- Navmesh source meshes must wind CCW so walkable faces point UP, or recast
  bakes 0 polygons (`buildNavMesh` throws) — `terrainMesh()` already does this.
  Re-bake the vendored core only via `yarn build:nav-core` (it's committed).

## Relates to

- [world3d.md](world3d.md) — the handles agents drive (mesh/billboard/model/
  group), `Path3d` routes, terrain `heightAt`, spotlight beams.
- [underwater.md](underwater.md) — fish/shoals as swimmers capped under the
  water surface.
- [particles3d.md](particles3d.md) — the fire/bubbles/sparks agents move among.

Signatures: engine/webgpu/agents3d.d.ts, engine/webgpu/navgrid3d.d.ts, engine/webgpu/agentnav3d.d.ts

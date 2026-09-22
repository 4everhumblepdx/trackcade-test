# 2D shadows & line-of-sight from real scenery

`Visibility2d` is a **standalone** geometry component — pure CPU, zero engine
hooks. Import it directly (`import { Visibility2d } from '../engine/webgpu.js'`);
it is NOT wired into `Game`. It's the **non-grid** counterpart to `FogGrid`:
shadows thrown by ACTUAL scenery (line-segment / box / polygon occluders), not
tiles — the top-down look where a light casts hard shadows off the crates.

Two things come out of it:
- **A visibility polygon** — the exact lit area from a point, with hard shadows
  behind occluders. Feed it to a renderer to draw a light.
- **Detection** — `canSee(a, b)` ("can the guard see the player?") and
  `raycast()` (first hit along a ray), for AI and hit-scan.

> **Rendering note.** This component gives you the shadow *geometry*. The 2D
> layer has no arbitrary-polygon fill yet, so filling the lit polygon *softly /
> additively* (coloured lights that mix, like a real light map) needs a small
> core 2D light pass — not there today. The `lights2d` example fills the polygon
> with a fan of lines as a stand-in. `canSee`/`raycast` need no rendering at all.

## How do I…

**…set up the scene?** Add the world bounds (so rays terminate) and the scenery
as occluders:

```ts
const vis = new Visibility2d({ x: 0, y: 0, w: worldW, h: worldH });
for (const c of crates) vis.addRect(c.x, c.y, c.w, c.h);   // box occluders
vis.addSegment(x1, y1, x2, y2);                            // a single wall edge
vis.addPoly([{x,y}, …]);                                   // a polygon occluder
```
Add/remove occluders any time — there's no bake. `clear()` drops them (bounds stay).

**…get a light's shadowed area?** `visibility(x, y, radius?)` returns the lit
polygon (an angle-sorted fan of points around the light), clamped to `radius`:

```ts
const poly = vis.visibility(light.x, light.y, light.radius);
// render as a triangle fan from (light.x, light.y) through poly — or read it for shading
```

**…do "can the guard see the player?"** `canSee` — no occluder crosses the line:

```ts
if (vis.canSee(guard.x, guard.y, player.x, player.y, guard.viewRange)) alert(guard);
```
It ignores the world bounds (they enclose, they don't block). Combine with a
facing/angle check for a vision cone.

**…hit-scan a shot / find the nearest wall?** `raycast`:

```ts
const hit = vis.raycast(gun.x, gun.y, aimX, aimY, range);   // { x, y, dist } | null
if (hit) spark(hit.x, hit.y);
```

## Which shadow component?

| | Occluders | Best for |
|---|---|---|
| [`FogGrid`](fog.md) | grid tiles | roguelikes, grid dungeons, fog-of-war memory |
| **`Visibility2d`** | real segments/boxes/polys | top-down shooters/stealth, free-placed scenery |

## Relates to

- [fog.md](fog.md) — the grid version (+ fog-of-war memory, which this doesn't track).
- [draw.md](draw.md) — render the polygon / light; `line`/`circle` verbs.
- [flowfield.md](flowfield.md) — pair movement (routing) with vision (this).

Signatures: engine/webgpu/visibility2d.d.ts.

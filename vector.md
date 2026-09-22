# The vector renderer — glowing line art (`game.vector`)

First-class line rendering with the VECTOR-MONITOR look: every line is a
crisp AA core wrapped in an additive PHOSPHOR HALO, drawn as instanced
segments (masses of independent lines = one draw). **Pair with
`game.post.add('bloom')`** — the halo is designed to feed it; that combination
IS the aesthetic. Asteroids, thrust, gravitar, wireframe everything.

```ts
const rock = game.vector.shape(points, { x, y, width: 2.2, glow: 0.85, color: '#7df' });
rock.rot += dt;                        // retained: transforms are live
rock.shatter({ speed: 110, spin: 4 }); // the outline flies apart, fading
game.vector.seg(x0, y0, x1, y1, { glow: 1, color2: '#08f' }); // immediate
```

## The two modes

- **Retained** — `game.vector.shape(points, opts)` → `VectorShape`. The
  segments live under ONE per-shape transform: mutate `x/y/rot/scale/alpha/
  glowMul` per frame for FREE (only an 8-float transform uploads — vertices
  never re-pack). `opts.closed` (default true) joins the outline;
  `setPoints(points, closed)` replaces it (deformable terrain: splice a
  crater into your polyline and set it back); `kill()` removes it.
  **`opts.pivot`** is the point it turns and scales about, in the same space
  as the points you passed — build geometry where it belongs and say where
  its centre is, rather than building at the origin and carrying the centre
  in `x`/`y`. It is read per frame, so setting or clearing it re-packs
  nothing, and `shatter()` bursts from it.
- **Ordering** — retained shapes draw first, then immediate pushes on top,
  and lines test depth but never write it, so line-over-line is submission
  order. `starfield()` is the exception, drawn behind both.
- **Immediate** — `game.vector.seg(x0,y0,x1,y1, style)` and
  `game.vector.poly(points, style, closed?)` push one-frame lines (aim
  lines, radar sweeps, lightning). Re-push every frame like draw verbs.
  A ZERO-LENGTH `seg(x, y, x, y)` is a **dot** of the style's width — the
  cheapest point there is, and what the starfield draws.

## LineStyle (shared by both)

- `width` (2) — stroke width, world units
- `color` / `color2` — hex; color2 = the far endpoint → a GRADIENT along
  the line. On a polyline or an outline the ramp runs **once along the whole
  chain**, measured by ARC LENGTH, so a long edge and a short one each get
  their fair share of it and the ramp neither stalls nor rushes. Works the
  same immediate or retained. On a CLOSED outline it meets itself at the
  first point, so `color` and `color2` end up adjacent there — the seam any
  linear gradient on a loop has; pick close colours, or leave it open. For a
  ramp stepped per segment from a source instead, use `colors` — which also
  walks by arc length when it is a RAMP (`'rainbow'`, `{ hue }`, `{ from, to }`),
  so an uneven chain does not stall the colour on its long edges. An ARRAY or a
  FUNCTION source stays per-segment, because `['#f00', '#0f0']` and `i => …` are
  discrete by intent.
- `glow` (0.5) — phosphor halo intensity 0..~1.5; **0 = the clean
  Asteroids/Thrust look, a first-class style**. Halos join cleanly at
  corners and overlaps saturate instead of knotting.
  HAIRLINES (width < 1) cut flat at the ends instead: a sub-1 core is
  AA-limited (peak alpha < 1) so its caps double-blend into spiky dots at
  every joint, while a flat cut's notch is sub-pixel at that scale.
  `shape.restyle({ width, glow, color… })` retunes a live shape.
- `dash` (0) — dash period in world units, half duty. Dashes gate the CORE
  only; the halo stays continuous, which is what sells it as a beam.
- `dwell` (0) — BEAM DWELL 0..1. A real display's beam decelerates at the end
  of every stroke, so more electrons land and the spot burns brighter and
  fatter. It is the tell of a vector monitor after the halo itself. Try 0.5–0.8
  with `glow` up. Costs nothing: it rides a spare slot in the instance that was
  already there.
  **Scaled by how sharply the beam turns**: a stroke's free ends get the full
  boost (the beam stops dead), a hairpin nearly all of it, a shallow bend in a
  polyline almost none. So a smooth curve stays smooth while a spiky outline
  lights up at its points, instead of every joint glowing the same. (Hairlines
  cut flat at the ends, so they show less of it.)
- `alpha` — **works on chains.** Neighbouring segments are cut on the angle
  bisector they share, so an outline is painted once rather than twice over at
  every joint, and a half-transparent shape comes out evenly transparent
  instead of beaded at the corners. That makes `shape.alpha = t` a real fade:
  ghost outlines, dying enemies, distance haze. (Hairlines are the exception —
  they bead regardless, being AA-limited.)
- `z` — depth, 0..Z_RANGE like everything 2D; with `fill` set it also orders
  shapes against each other, see below

## shatter() — the exploding outline

`shape.shatter({ speed, spin, life, drag })`: every segment re-parents to
its own fragment transform with outward velocity (away from the shape
centre, rotated with the shape) plus spin, holds alpha then fades over the
last 40% of `life`. The shape dies. One call = the classic vector-game
death. `game.vector.counts` reports `{ shapes, fragments, segments }`.

## text() — the score, drawn with the beam

`game.vector.text(str, x, y, opts)` draws a **caps-only stroked face** — straight
segments on a 0..1 em box, exactly what the hardware of the era could draw. Raster
text on a line-art screen reads as a different game; this is the same beam.

```ts
game.vector.text('SCORE 004200', 20, 20, { size: 24, style: { color: '#39f0a0', glow: 0.8 } });
game.vector.text('GAME OVER', cx, cy, { size: 70, align: 'center',
                                        style: { colors: { hue: [0, 60] } } });
```

`size` is the cap height in world units; `align` is `left | center | right`;
`\n` starts a new line; `spacing` and `lineGap` are fractions of `size`.
Lowercase folds to uppercase. It takes everything a line takes — `width`,
`glow`, `dash`, and a `colors` source stepped per stroke.

**`vectorKit.textWidth(str, opts)`** measures a line, so columns lay themselves
out instead of using magic numbers.

**On the HUD:** `d.vectorText(str, x, y, opts)` draws the same glyphs through
the draw verbs, so they work on the HUD surface where the vector layer cannot
reach. Plain quads — no halo, no `dwell` — but screen-space and correctly
ordered with every other HUD element.

**The retained path:** `vectorKit.textOutline(str, x, y, opts)` returns the
polylines instead of drawing them. Hand those to `shape()` and the text becomes
a real object that can fly, rotate, restyle and **`shatter()`** — which is how
the GAME OVER in `examples/vector-text.ts` blows apart and reforms.

## arc() and segmented rings — Star Castle's shields

`game.vector.arc(cx, cy, r, from, to, style?, steps?)` is the immediate curve —
angles in radians, **clockwise** (y is down, so `-PI/2` is straight up). A full
circle is `arc(x, y, r, 0, Math.PI * 2)`.

**`steps` is the smoothness dial** — the segment count for the arc — and every
arc verb takes it: `arc(…, style, steps)`, `arcPoints(…, steps)`,
`ringSections(…, { steps })`. Omit it and you get `vectorKit.arcSteps(sweep)`:
one segment per ~11°, which is purely **angular** and takes no view of radius.
So a big circle gets the same 32 segments as a small one and reads as faceted,
while a narrow ring section gets only two. Raise it for a smooth curve at a
large radius; drop it to 1–3 for deliberate chunky chords.

```ts
game.vector.arc(cx, cy, 66, t * 2.4, t * 2.4 + 0.9, { color: '#7cd8ff', glow: 1.2 });  // radar sweep
game.vector.arc(cx, cy, 46, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, { width: 4 });  // gauge
```

**The retained path — a ring that breaks apart.** `vectorKit.ringSections(cx, cy,
r, count, { gap, steps, from, span })` returns one `{ points, from, to, index }`
per section. Each `points` array becomes its **own** `VectorShape`, so a section
`shatter()`s while its neighbours keep turning:

```ts
const ring = vectorKit.ringSections(cx, cy, 250, 12, { gap: 0.16 }).map((s) => ({
  ...s, shape: game.vector.shape(s.points, { pivot: { x: cx, y: cy }, closed: false, color: '#ff5fa2' }),
}));
```

Build the ring where it goes and name the point it turns about with `pivot` —
a shape spins about its own origin, so without one a ring built at `(cx, cy)`
orbits `(0, 0)` rather than turning in place. `vectorKit.arcPoints()` is the
single-arc version of the same thing.

**Hit testing:** `vectorKit.arcHit(cx, cy, r, from, to, px, py, tol)` — on the
radius AND inside the span. Un-rotate the point into ring-local space first and
a spinning ring needs no per-section bookkeeping:

```ts
const c = Math.cos(-ring.rot), s = Math.sin(-ring.rot);
const lx = dx * c - dy * s, ly = dx * s + dy * c;
const i = ring.live.findIndex((sec) => vectorKit.arcHit(0, 0, r, sec.from, sec.to, lx, ly, 16));
```

The spans `ringSections` hands back are **monotonic** (`to > from`, never
wrapped past ±PI), which is what lets `arcHit` skip unwrapping. See
`examples/vector-rings.ts`.

## generateTube() — Tempest's playfield

`vectorKit.generateTube({ x, y, near, far, lanes, profile, … })` builds a web:
two copies of one silhouette — a big **near rim** at the screen plane and a
small **far rim** shrunk toward a vanishing point — joined by **spokes**.

```ts
const web = vectorKit.generateTube({ x: cx, y: cy, near: 320, far: 84, lanes: 16, profile: 'star' });
game.vector.poly(web.farRim,  { color: '#1d3a63' }, web.closed);
for (const [a, b] of web.spokes) game.vector.seg(a.x, a.y, b.x, b.y, { color: '#2b5da0' });
game.vector.poly(web.nearRim, { color: '#41d6ff', glow: 0.9 }, web.closed);
```

Profiles: `circle` `square` `plus` `star` `vee`. The first four close into a
loop; `vee` is open. Corner profiles are sampled **corner-first**: every corner
lands on a lane boundary and the remaining lanes spread along the edges by
length, so a square stays square at any lane count. Lane widths therefore vary
a little between edges — that is the authentic trade, and the right one, since
the silhouette is the reason to pick a profile at all. (Ask for fewer lanes than
the profile has edges and it falls back to equal-arc sampling, rounding the
shape off.) `vanishX`/`vanishY` move the
far rim's centre — offset it and the tube leans away instead of receding
straight back. Generate **once per level**; the geometry is static.

**`laneAt(lane, t)` is the gameplay half** — `{ x, y, angle, scale }` for `t`
from 0 (on the near rim) to 1 (at the far rim). A lane is the strip between rim
vertices `lane` and `lane + 1`, so a 16-lane web has 16 lanes and 16 vertices
(an open one has 17 vertices). `angle` faces **out** of the tube — the way an
enemy is travelling and the way a rim ship points — and `scale` is 1 at the near
rim falling to `far / near`, so multiplying your art by it makes things shrink
correctly as they climb.

```ts
const p = web.laneAt(playerLane, 0);     // the claw, on the rim
const e = web.laneAt(enemy.lane, enemy.t);
```

Every entity becomes just `(lane, t)`, which is what makes profile switching
free — nothing in the game code knows the shape.

### Gliding — the lane is continuous

`lane` is a **float**, not an index. Whole numbers sit in the middle of a lane
and everything between slides along the actual rim edges, turning each corner
properly rather than cutting across it, so a claw glides instead of snapping.
Four helpers carry the awkward part — whether the web loops:

| | |
|---|---|
| `wrapLane(v)` | bring a position back in range: **wraps** when closed, **clamps** when open |
| `laneDelta(a, b)` | signed distance, the **short way** round (lane 15 → 0 of 16 is `+1`, not `-15`) |
| `stepLane(from, to, maxStep)` | one frame of a glide — short way, never overshoots |
| `laneOf(x, y)` | the fractional lane nearest a world point — the inverse of `laneAt`, for mouse/spinner steering |

Doing this by hand is where tube games go wrong: `%` alone sends things the long
way round the seam, and `Math.min/max` clamping silently breaks a closed web.

### Move in world units, not lanes

**A lane is a slot, not a distance.** Only a circle and a square have lanes of
equal length; a `plus` runs 1.63:1 longest to shortest and a `star` exactly 2:1.
So `wrapLane(pos + n * dt)` — moving `n` lanes a second — really does travel at
double speed across a star's spike and half speed through the notch. It looks
fine on a circle and wrong on everything else.

Four more helpers step in **world units** instead, which is what "a set speed"
means:

| | |
|---|---|
| `perimeter` | total near-rim length; `perimeter / speed` is one lap |
| `laneLength(i)` | how long lane `i` actually is |
| `advance(lane, dist)` | move `dist` world units along the rim, signed, wrapping or clamping |
| `glide(from, to, maxDist)` | `stepLane` in world units — short way, never overshoots |
| `arcDelta(a, b)` | `laneDelta` in world units |

```ts
pos = web.advance(pos, dir * 880 * dt);                  // 880 units/sec, every profile alike
pos = web.glide(pos, web.laneOf(m.x, m.y), 880 * dt);    // steer to the cursor
enemy.lane = web.glide(enemy.lane, enemy.to, 380 * dt);  // a flipper sliding over
if (Math.abs(web.laneDelta(enemy.lane, shot.lane)) < 0.5) hit();
```

Reach for `stepLane`/`wrapLane` only when you genuinely mean lanes — snapping to
a slot, or hit tests like the one above. For anything that *moves*, use these.

### Steering: the hidden circle

**Never ask the silhouette which way it points.** Its line segments give a
different answer at every corner, and steering built on them feels inverted —
that is the classic tube-game bug, not a subtle one.

Instead the rim is *also* parameterised by **angle about the web's centre**: a
circle that is never drawn and exists purely to gauge direction. "Round" then
means one thing on a disc, a square and a star alike, with no segment checks
anywhere and nothing special at a corner.

| | |
|---|---|
| `angleOf(lane)` | where a lane sits on the circle |
| `laneAtAngle(a)` | the lane at that angle — the inverse |
| `turn(lane, dAngle)` | go round by an angle, **+ is clockwise on screen**; clamps at an open web's ends |
| `angleSpan` | what the rim actually covers — a full turn when closed, less when open |

### Start at the bottom, and steer from there

Two things that are not cosmetic:

| | |
|---|---|
| `bottom` | the lane at the bottom middle — **where the ship starts** |
| `steer(lane, dist)` | move the ship, **+ is the player's right** |

```ts
lane = web.bottom;                                    // Tempest starts you here
lane = web.steer(lane, dir * 880 * dt);               // dir: -1 left, +1 right
lane = web.laneAtAngle(Math.atan2(my - cy, mx - cx)); // mouse: that is all of it
```

Tempest and everything after it put the ship at the **bottom middle**, and the
whole feel of the controls is calibrated from there. Put it at the top and
every profile plays inverted — the ring reads one way above the middle and the
other way below it, and the top is simply the wrong place to judge from.

`steer` is `advance` with the sign sorted out. Some silhouettes wind clockwise
on screen and some anticlockwise, so "forward along the path" is rightward on
one and leftward on the next: differentiate a clockwise rim at the bottom and
its tangent is `(-1, 0)`. `steer` folds in that one build-time winding, so left
is left on all of them. (This is exactly why a `vee` can feel correct while
every closed profile feels inverted — the vee is the only silhouette here that
winds anticlockwise.)

Both movers go round the circle; they differ only in **pacing**. `steer`/
`advance` pace by distance and hold one speed everywhere. `turn` paces by angle,
so on a star it sprints across a spike tip and dawdles in a notch. Prefer
`steer` for a ship — it steers just as unambiguously, because every profile is
star-shaped about its centre and so the angle runs monotonically along the rim:
forward along the path is always forward round the circle.

A ring still has no *global* left and right. Carry on far enough and the ship is
climbing the far side, where the screen direction is reversed. Every tube game
does this; calibrating at the bottom is what makes it feel right anyway.

Three things that look like fixes and are not. Recomputing "which way is left on
screen" each frame **stalls** the ship dead at the leftmost point of the web,
where both its neighbours lie to the right; latching that guess once per press
only defers the problem half a lap. Steering toward a compass point — glide to
`laneAtAngle` of the direction held — cannot reach the top half of anything from
left/right keys alone, because left and right are the only targets there are.
And starting the ship at the top makes every closed profile play inverted, which
no amount of work on the direction logic will fix. See
`examples/vector-tube.ts`.
`web.closed` is the only flag you should ever need to read yourself.

`rimPointAt(u, t)` is the raw continuous walk (`u` 0..lanes along the rim) if you
want to slide something that isn't lane-centred. `rimAt(i, t)` gives a spoke's
waypoints, which is how you taper spoke width with depth (one line can't change
width along its length — draw a short chain). See `examples/vector-tube.ts`.

## project() — first-person wireframe

Battlezone, Star Wars, Red Baron, Elite: 3D line art with **no 3D chunk
loaded**. Points through a camera, edges clipped at the near plane, out as
ordinary 2D segments.

Axes are the 3D convention — **x right, y UP, z forward** — not the 2D layer's
y-down screen space; the projection converts. A camera at `yaw: 0` looks along
`+z`, increasing `yaw` turns RIGHT, increasing `pitch` looks UP.

```ts
const cam = { x: 0, y: 90, z: -400, yaw: 0, pitch: 0, fov: 1.05 };
for (const e of vectorKit.project(model, cam, view)) {
  const s = Math.min(1, 700 / Math.max(e.za, e.zb));      // depth falloff
  game.vector.seg(e.a.x, e.a.y, e.b.x, e.b.y, { color: '#41d6ff', width: 3 * s, alpha: 0.45 + 0.55 * s });
}
```

A model is `{ points: Vec3[], edges: [i, j][] }`. Each projected edge carries
`za`/`zb`, the depth at both ends — that is what tapers width, glow and alpha
with distance, and it is most of the look.

**Scale the falloff to a reference distance, not to `f/z` raw.** `f/z` is the
true pixels-per-unit, but drop it straight into a width and everything goes
faint the moment the world is a few thousand units across. Pick the distance
you consider full strength and divide by that.

- `projectPoint(p, cam, view)` — one point, or `null` behind the near plane.
  For putting a label or a sprite on a 3D position.
- `horizon(cam, view)` — the ground line. Depends only on `pitch` (there is no
  roll), so it is always level; yaw slides along it.
- `focalLength(view, fov)` — pixels per world unit at one unit of depth.
- `wireBox(w, h, d, cx, cy, cz)`, `wireGrid(n, step, y)`, and
  `placeModel(model, x, y, z, yaw)` to position a copy without touching the
  original (edges are shared, not copied).
- `placeModelOnGround(model, x, z, yaw, groundY)` — **stand a model on the
  floor.** An x and a z, no height. Models keep their origin wherever suits
  them, so it asks each one where its own base is; a `wireBox` built about its
  centre and a pyramid built on its base both land flush.
- `wireBounds(model)` → `{ min, max, size, center }`. Cheap culling, and scaling
  to fit.

Edges that **straddle** the near plane are CUT at it, not dropped — walk into a
block and it stays put. Dropping them makes geometry pop out of existence; not
clipping at all divides by a negative `z` and whips the edge backwards across
the screen. See `examples/vector-wireframe.ts`.

## fill — solid faces

A `VectorShape` can carry a **solid face** under its outline. It is
triangulated once (ear clipping, CPU, only when the outline changes) and drawn
by a pass of the renderer's own.

```ts
game.vector.shape(pts, { fill: '#1b2a6b' });                            // flat
game.vector.shape(pts, { fill: { color: '#4b1d7a', to: '#ff2d95' } });  // gradient
shape.fill = null;                                                      // outline only again
```

Colours are **hex only** (`#rgb`, `#rrggbb`, `#rrggbbaa`) — the engine's parser
takes nothing else and falls back to white. `'transparent'`, `'none'`, a zero
alpha, or omitting `fill` all mean no face, which is the default.

**Gradients are per VERTEX**, resolved at pack time. No uniform, no second
pass, and they rotate and scale with the shape. That is the Tempest 2000 look.

| | |
|---|---|
| `fill: '#hex'` | flat |
| `fill: { color, to }` | two-stop, left→right |
| `fill: { color, to, angle }` | rotated, in **shape-local** radians |
| `fill: { stops: [...] }` or `fill: [...]` | multi-stop ramp, evenly spaced |
| `fill: { stops, radial: true }` | centroid → furthest vertex; `angle` ignored |

`colorKit` feeds them directly: `fill: colorKit.rainbow(7)`,
`fill: { stops: colorKit.ramp(0, 55, 5) }`.

A **radial** fill needs geometry the ramp can live on, and the layer builds it:
a convex outline is fanned from its centroid (otherwise every vertex of a
regular polygon sits at the same radius, lands on the last stop, and the face
comes out flat), and a multi-stop radial is subdivided into one concentric
**ring per stop** (otherwise a plain fan has vertices only at t=0 and t=1, and
every middle stop is interpolated straight past). A concave outline falls back
to plain ear clipping — its gradient is only as smooth as its vertices, but no
geometry is ever generated outside the shape.

**Fills WRITE DEPTH; lines only test it.** So `z` on a filled shape becomes a
real painter's order: a nearer shape hides the fills *and* the outlines behind
it. A shape never hides itself — its own outline sits at equal depth, and the
test is less-equal. This is what makes a corridor a corridor (Ultima's walls,
an Elite hull, a Tempest web with solid lanes). Remember `Z_RANGE` is 2²⁰, so
useful values are in the hundreds of thousands, not single digits.

Translucent faces (alpha < 1) are drawn after the opaque ones and do **not**
write depth — a see-through face that stamped depth would punch a hole in
everything behind it.

**The pass costs nothing until you use it.** `layer.fills` defaults to `null`,
which auto-enables only when a live shape actually has a fill; `true`/`false`
force it. See `examples/vector-fill.ts`.

## clip — a window on the whole layer

`game.vector.clip = { x, y, w, h }` (world units, `null` to clear) scissors the
entire vector layer. Radar scopes, a Battlezone viewport, Tempest's tube mouth,
split screen.

```ts
game.vector.clip = { x: 40, y: 40, w: 320, h: 320 };
```

**The glow stamp is scissored with it**, using the same rect arithmetic against
the half-res target — so halos are cut at exactly the line's edge. A halo
leaking past the boundary is what gives a fake window away, and it is the one
thing that makes this worth doing in the renderer rather than by culling.

**It is a SETTING, not a bracket.** It is read once, at draw time, for the whole
frame — so you cannot clip some of your submissions and leave the rest; set it
and clear it in the same frame and whatever it held last simply wins. Chrome
that has to escape the window (a scope frame, corner ticks) goes through the
`d.*` verbs, which have their own clip (`d.pushClip`) and are untouched by this
one. Per-shape clipping is deliberately not offered: the layer is one pass, and
that is the level at which clipping is free.

`d.pushClip` does NOT reach the vector layer. See `examples/vector-clip.ts`.

## trail() — the ribbon a moving thing leaves behind

```ts
const wake = game.vector.trail({ length: 40, width: 4, color: '#41d6ff', tailColor: '#ff2d95' });
wake.push(ship.x, ship.y);      // once a frame — the layer ages and draws it
wake.clear();                   // on a teleport, so it doesn't smear across
wake.kill();                    // when the thing making it dies
```

There is no per-frame draw call: the layer owns every live trail, steps it in
`update` and emits it in `prepare`.

| | |
|---|---|
| `length` (32) | samples kept; the oldest is the tail |
| `life` | seconds a sample survives — use instead of, or with, `length` |
| `minDist` (4) | a move smaller than this folds into the head |
| `maxDist` (0 = off) | a move LARGER than this is split, so the ribbon is frame-rate independent |
| `width` / `tailWidth` (3 / 0) | taper |
| `alpha` / `tailAlpha` (1 / 0) | fade |
| `color` / `tailColor` | grade along the length |
| `colors` | …or a full `VecColorSource` stepped along it |
| `glow` (0.7), `dwell`, `z` | as on any line |

**`minDist` and `maxDist` are the two that matter**, and they guard opposite
ends. Without `minDist` a slow or stopped emitter fills the buffer with
duplicate points and the ribbon collapses to a dot. Without `maxDist` a trail
lays down exactly one sample per FRAME, so its shape follows the frame rate —
the same object at 30fps leaves chords twice as long as at 60, and a fast mover
on a curve draws a visible polygon. Set `maxDist` to the longest chord you are
happy with and the ribbon looks identical at any frame rate.

`maxDist` is off by default only because on a LENGTH-bound trail it also
shortens the ribbon (`length: 32, maxDist: 8` can never span more than 256
units). On a `life`-bound trail there is no such interaction — turn it on.

The taper runs on **arc length**, not sample index, so uneven spacing still
gives an even-looking ribbon.

Trails emit as ordinary immediate segments, so they paint above anything the
game pushed itself that frame. Give one a lower `z` if a filled shape needs to
cover it.

**This replaced phosphor persistence, which is gone.** Full-screen feedback
smeared the whole image: it could not be aimed at one object or tuned per
object, and anything STANDING STILL re-accumulated its own halo every frame
until it was a saturated blob — which is exactly what made small detail
unreadable. A trail is geometry belonging to one object, so it tapers, grades,
and a stationary thing leaves nothing at all. See `examples/vector-trails.ts`.

## emit() — particles made of line art

`game.vector.emit({ x, y, … })` spawns tiny OUTLINES that fly, spin, fade and
glow with the rest of the layer — same buffers, same transform table, same glow
stamp, so a burst of shards costs what its segments cost and nothing more.

```ts
game.vector.emit({
  x, y, count: 30,
  shape: ['triangle', 'square', 'star'],   // one kind, or a mix picked per particle
  size: 7, speed: 220, spin: 6,
  life: 1.5, drag: 0.9, gravity: 120,
  shrink: 0.25,                            // end size as a fraction of the start
  style: { color: '#41d6ff', width: 2, glow: 0.9 },
});
```

`shape`: `line` · `triangle` · `square` · `diamond` · `circle` · `cross` ·
`star` (`circleSides` sets a circle's segment count). Each particle is ONE rigid
outline under ONE transform, so `spin` turns it about its own centre rather than
tearing it apart.

Options mirror the sprite emitter where they overlap — `count`, `size`/`sizeVar`,
`speed`/`speedVar`, `angle`/`spread`/`even`, `spawnRadius`, `life`/`lifeVar`,
`drag`, `gravity`, `spin`. **`shrink` > 1 GROWS**: an expanding shockwave ring is
`{ shape: 'circle', even: true, shrink: 3, spread: 2π }`.

### colours — a SOURCE, not a colour

`colors` is on **`LineStyle`**, so every verb takes it — `shape()`, `poly()`,
`seg()`, `restyle()` and `emit()` alike. It hands out the next colour from a
source **per segment** (per particle, for the emitter), so no hard-coded
palettes:

```ts
colors: 'rainbow'                          // the whole hue wheel
colors: { hue: [0, 60], step: 3 }          // flame: red → orange → yellow
colors: { hue: [180, 260], sat: 0.8 }      // an arc of it — ice, toxic, void
colors: { from: '#41d6ff', to: '#ff5fa2' } // between two literal colours
colors: ['#f00', '#0f0', '#00f']           // cycle an explicit palette
colors: (i) => PALETTE[i % PALETTE.length] // anything else
```

`step` is **degrees per particle** (default 1), so a burst of `count` spans
`count × step` degrees — raise it to fan one burst across the wheel, leave it
at 1 for a stream that cycles gradually. The cursor lives on the LAYER, so a
per-frame stream keeps walking the source instead of restarting every call.

`colors` overrides `color`; everything else (width, glow, dash, z) still applies.

**On chains it is the fix for `color2` banding.** A `color2` gradient repeats the
whole from→to across EVERY segment of a polyline, which reads as stripes; a
source walks continuously along the run instead:

```ts
game.vector.shape(ring, { colors: { hue: [0, 360], step: 360 / ring.length } });  // rainbow polygon
game.vector.shape(ridge, { closed: false, colors: { hue: [190, 320] } });         // graded terrain
```

`shatter()` keeps it: each shard flies off with **its own segment's** colour, so
an exploded rainbow outline stays a rainbow. See `examples/vector-emitter.ts`.

A stream (thruster, sparks, rain) is a small `emit()` **every frame** — the same
pattern the sprite system uses. `game.vector.counts` reports
`{ shapes, fragments, segments }`; emitted particles count as fragments.

## starfield() — the backdrop, in two modes

```ts
const sky = game.vector.starfield({ count: 300, speed: 60, angle: Math.PI });
const tunnel = game.vector.starfield({ mode: 'warp', speed: 320, streak: 0.05 });
```

The layer steps and draws it; there is nothing to call per frame, and `kill()`
removes it. **Everything is a live property** — this is a driven object, not a
configured one:

| | |
|---|---|
| `'drift'` (default) | a flat parallax field. `speed` + `angle` (any direction), `layers` = how many parallax sheets |
| `'warp'` | flies INTO the screen. `origin` (the vanishing point), `focal`, `near`/`far`, `spin` |

**`layers` (4) is the parallax knob and the only one you need.** `count` is
dealt out across the layers evenly and the depth spacing is worked out from the
count, so each layer comes out slower, smaller and dimmer than the one in
front. `0` or `1` is a flat field with no parallax. Assign it any time and the
field re-layers on the spot.

`speed` **negative reverses** either mode.

`colors` takes **the same colour sources as everything else in the layer** —
`'rainbow'`, a `{ hue }` arc, a `{ from, to }` walk, an array, or a function of
the star index — resolved once per star at spawn rather than per frame. One
wrinkle worth knowing: `'rainbow'` is hue = index mod 360, so a field of fewer
than 360 stars never reaches the blues. For a full sweep across however many
you have, drive an arc with the count: `{ hue: [0, 360], step: 360 / count }`.

`streak` is ONE knob — the tail's length in seconds of travel, **0 for plain
dots** — and it turns a star into a real **trail**: each one remembers where it
has actually BEEN, so when the field turns the tails bend and a curve stays
painted on the screen. A line drawn backwards along the current heading instead
swings the whole tail round rigidly the moment you turn, which is the tell that
it isn't a trail.

History is sampled on a clock, so a tail is the same length at 30 Hz and at
144 Hz, and it lengthens with speed and with nearness by itself. Turning one on
does not conjure a tail; it grows in over `streak` seconds, as a trail should.

`bend` warps the field with depth, **in warp mode only**: a **vector** leans
it, a **function** `(t, time) => point` curves it, where `t` is 0 near to 1
far. That is how a tunnel snakes rather than just tilting. A flat field has no
depth axis to bend along — bending one only slides its parallax bands past each
other, which reads as a glitch — so drift ignores it.

```ts
tunnel.bend = (t, time) => ({ x: Math.sin(time * 1.2 + t * 4) * 300 * t, y: 0 });
ship.turning && (tunnel.origin = { x: cx - bank * 220, y: cy });
```

Anything the options do not cover, do by hand: **`field.stars`** is the raw
array (drift keeps world positions, warp keeps a lateral offset plus a depth),
and **`field.each = (s, dt, field) => …`** runs over every star each step.
`resize(n)` grows or shrinks it, `reset()` re-scatters.

Density is handled for you and is the part worth knowing about: warp stars
spawn inside the FRUSTUM at their own depth and recycle **as soon as they leave
the view**, not when they reach the near plane. Stars spread outward as they
approach, so most of a field leaves the screen long before it arrives — recycle
late and you get a tenth of the stars you asked for.

With a `streak`, "leaves the view" means the whole RIBBON, not the star: a
star is kept alive, and drawn, until its tail has cleared too. Culling on the
head makes a long tail blink out the moment its star crosses the edge, which is
very visible with 300 of them. So a drift star runs past the rect by up to a
tail length before it comes back in through the edge the field is flowing from.

A starfield draws **behind everything else in the layer** — retained shapes and
your own immediate pushes both. That is not the usual rule (immediate normally
draws over retained, and lines test depth without writing it, so line-over-line
is submission order); a backdrop is the one thing defined by being behind, so
its span of the frame is drawn before the rest.

Unbounded fields track the layer's view, so they follow a resize; pass `bounds`
to pin one to a rectangle instead. See `examples/vector-stars.ts`.

## Box2D physics on the vector layer

**[physics2d.md](physics2d.md) is the physics doc** — worlds, bodies, joints,
groups, raycasts, triggers, and the traps. This section is only the part that
is specific to line art.

The engine's optional Box2D v3 (`Physics2d`) can drive **vector shapes**, not
just sprites — and line art is the better fit of the two. A `VectorShape` is
already origin-centred with live `x`/`y`/`rot`, so a body pose maps straight
on; a `Sprite` is top-left anchored and needs a half-size correction on every
sync.

```ts
const world = await Physics2d.create({ gravity: 700 });   // in preload()
this.physics2d = world;                                   // the scene steps it
const rock = game.vector.shape(vectorKit.generatePolygon(40, 11), { x: 300, y: 120 });
world.bindShape(rock, { bounce: 0.4, friction: 0.3 });
```

`bindShape` takes the same options as `bind` — type, friction, bounce, density,
group/hits/family, trigger, `onHit`/`onTouch`/`onEnter` — plus `shape`:

| `shape` | |
|---|---|
| `'hull'` (default) | convex hull of the outline, reduced to Box2D's **8-vertex** limit |
| `'decompose'` | concave outline → several convex pieces on ONE body, so a notch is a notch |
| `'box'` / `'circle'` | the outline's bounding box, or a disc covering it |

**Why hulling is not optional.** Box2D polygons are convex and capped at eight
vertices, and handing `b2ComputeHull` more than eight returns a hull of count
**0** — a null shape, with no error. An eleven-point asteroid would silently
have no collision at all. `bindShape` runs `convexHull` → `simplifyHull` first;
`vectorKit.hullFor()` is the same thing if you want it yourself.

**The outline is never re-centred on its centroid.** Box2D computes centroid,
mass and inertia from the polygon in body-local space, so passing the raw local
points is what keeps the drawing and the collision shape registered. Re-centring
looks tidier and produces a shape that spins about a point it isn't drawn around.

`scale` is baked at bind time — Box2D fixtures don't scale. Changing it
afterwards moves the drawing and not the collision shape.

### Line geometry — `world.chain()`

```ts
const ground = vectorKit.generateTerrain({ width: 1400, baseY: 600 });
game.vector.shape(ground, { closed: false, color: '#39f0a0' });
world.chain(ground, { friction: 0.9 });
```

Any polyline becomes static world geometry with no thickness, no mass and no
internal corners for a fast body to snag on — terrain, cave walls, tube rims,
`ringSections`. `loop: true` closes it, which is exactly what `web.closed` and
a closed ring mean. Two traps, both handled inside `chain()` and both silent if
you roll your own:

- An **open** Box2D v3 chain treats its first and last points as GHOST vertices
  and builds only `count - 3` segments. A four-point line gives you one.
- A chain is **one-sided**, and flipping y into Box2D's y-up frame reverses
  which side. Terrain written left-to-right comes out solid from *below* and
  everything falls through it.

`world.capsule(x0, y0, x1, y1, radius)` is the body for a single thick stroke —
a rod or a beam. A two-point polygon is degenerate and a box has corners a
capsule doesn't.

### debugDraw — the physics world AS line art

```ts
override draw(d: Draw): void {
  super.draw(d);
  this.world.debugDraw(this.game.vector);   // green = awake, blue = asleep, grey = static
}
```

The pairing in reverse, and it works for **sprite** games too: every shape
Box2D is actually simulating, in its actual pose, as glowing outlines. The
fastest way to see that a hull came out the shape you meant, that a chain is
solid on the side you meant, or that a body has gone to sleep — none of which
is visible in the art.

Built on the typed shape API (`b2Body_GetShapes` + `b2Shape_GetPolygon` and
friends), NOT Box2D's own debug-draw command buffer: that buffer is an
undocumented 140-byte packed struct, so reading it means hard-coding offsets
that a Box2D bump would move without a word.

See `examples/vector-physics.ts`, `examples/vector-lander.ts` and
`examples/vector-debugdraw.ts` — and [physics2d.md](physics2d.md) for
everything that is not vector-specific.

## The gameplay maths — `vectorKit` / `colorKit`

The vector-game logic layer ships as namespaced pure modules (no DOM/GPU):
`vectorKit` — `generatePolygon` (asteroid silhouettes), `generateTerrain` +
`heightAtX` + `craterHeightfield` (heightfield polylines), `pointInPolygon`,
`segmentIntersection`, `sweepVsSegments` (bullet vs walls), `resolveSurface`
(bounce/slide), `gravityAccel`, `integrateMotion`, `predictPath`,
`shatterPolygon`, `arcPoints` / `ringSections` / `arcHit` (arcs and
destructible rings), `generateTube` (the Tempest playfield),
`project` / `horizon` / `wireBox` (first-person wireframe),
`convexHull` / `simplifyHull` / `hullFor` / `convexPieces` (outlines Box2D will accept),
`textOutline` / `textWidth` (the stroked
face). `colorKit` — `hsv`, `wheel`, `rainbow`, `ramp`,
`gradient`, `lerp`, `shift` (all return '#rrggbb'). Both are namespaced
because their names (lerp, ramp…) are too generic for the flat surface.

## How do I…

**…an asteroid?** `generatePolygon` once at spawn →
`game.vector.shape(pts, { x, y, glow: 0.85 })` → mutate `x/y/rot` per
frame → `shatter()` on death (spawn two smaller shapes for the split).

**…deformable terrain?** `generateTerrain` → `shape(pts, { closed:
false })`; on impact `craterHeightfield(pts, x, y, r, floor)` then
`setPoints(pts, false)`. Collision against it: `heightAtX` /
`polylineSegments` + `sweepVsSegments` from vectorKit.

**…pump a shape's glow on hit?** `shape.glowMul = 3` then ease back — the
halo multiplier is live per shape.

**…a Tempest-style tube game?** `generateTube()` once per level → draw
`farRim`, `spokes`, `nearRim` back to front → store every entity as
`{ lane, t }` with a FRACTIONAL lane → move it with `advance`/`glide` →
`laneAt(lane, t)` each frame for where to draw it and how big.

**…a first-person wireframe game?** build `{ points, edges }` models →
`horizon()` → `project()` each frame → one `seg()` per edge, width and alpha
scaled by `za`/`zb`.

**…a destructible shield ring?** `ringSections(0, 0, r, 12, { gap })` → one
`shape()` per section, all carrying the same `x/y` centre → set every
section's `rot` to the ring's angle each frame → `arcHit` in ring-local space
to find what was hit → `shatter()` just that one.

Traps: the vector layer is **world space** and draws BEFORE the HUD pass, so
`vector.text` in a scrolling game slides off with the world. For a HUD use
**`d.vectorText(str, x, y, { size, color, width, align })`** in `drawHud` — the
same stroked face, drawn as plain quads on the HUD surface in screen space. The
trade is the beam: no phosphor halo and no `dwell` on that path, so keep
`game.vector.text()` for glowing text inside the world. The world is Y-DOWN
(2D screen convention). Retained edits
(add/kill/setPoints/shatter) re-pack the static buffer next frame — cheap
at vector-game scale; keep per-frame `setPoints` to a handful of shapes, since
transforms are the per-frame channel. Immediate lines exist for ONE frame.
Lines draw over sprites of lower z, under per-object fx. For 3D
world-space lines and wireframe models see [world3d.md](world3d.md).

**Under the bonnet**, three pure helpers are public because they are the
contract the renderer keeps and are worth being able to test or reuse:
`polySegs`/`chainJoins`/`segJoins` (a chain cut into segments, and the bisector
planes that stop neighbours overlapping), `segmentStyles` (the per-segment
colours a `colors` source or a `color2` chain gradient resolves to), and
`shapeOrigin` (where a `pivot` actually puts a shape). Games rarely need them;
nothing else does the job if you do.

## Relates to

- [effects.md](effects.md) — bloom, the halo's other half.
- [draw.md](draw.md) — `d.line` is a plain quad; THIS is the line engine.
- [physics2d.md](physics2d.md) — Box2D, which `bindShape` and `debugDraw` bridge to.

Signatures: engine/webgpu/vector.d.ts, engine/webgpu/vectorkit.d.ts, engine/webgpu/colorkit.d.ts.

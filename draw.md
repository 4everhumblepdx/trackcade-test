# Drawing — sprites, shapes and text

Everything on screen goes through the **Draw verbs** handed to your `run()`
callback. Immediate-mode: no display objects, no Graphics, no retained state —
call a verb, it's in this frame, in call order. Sprites and shapes share one
batch, so interleave freely; the frame is still a single draw call.

Colours are CSS hex strings: `'#f80'`, `'#ff8800'`, `'#ff880080'` (alpha
suffix). Positions and sizes are world units (see index.md's layout model).

## The verbs

```ts
game.run((d, dt, t) => {
  d.sprite(frame, x, y, { w?, h?, rot?, flipX?, tint?, alpha?, uvRepeat?, uvScroll? }); // textured quad
  d.rect(x, y, w, h, color?, alpha?, rot?);      // solid rectangle
  d.line(x0, y0, x1, y1, width, color?, alpha?); // segment with width
  d.poly(points, width, color?, alpha?);         // polyline + round joints (stroke)
  d.fill(points, color?, alpha?);                // FILLED polygon (any simple shape, ear-clipped)
  d.circle(cx, cy, radius, color?, alpha?);      // SDF — crisp at any radius
  d.ring(cx, cy, radius, thickness, color?, alpha?);
  d.panel(x, y, w, h, style?);                   // UI: rim/bevel/gloss/shadow, no art — ui.md
  d.ui.button(x, y, w, h, 'Start');              // …and the widgets over it — ui.md
  d.pushClip(x, y, w, h); … d.popClip();          // scissor panels + text (scrolling regions)
});
```

## How do I…

**…get a sprite on screen?** Register its pixels as frames first (any canvas;
a horizontal strip slices into frames at `frameW`), then draw by index:

```ts
const F_SHIP = game.assets.frames(shipCanvas, 16);   // 4-frame 64×16 strip → 4 frames
game.run((d) => {
  d.sprite(F_SHIP + 2, x, y);                 // third frame, natural size
  d.sprite(F_SHIP, x, y, { w: 32, h: 32, tint: '#ff8080' }); // scaled + tinted
});
```
Trap: `frames()` returns the FIRST frame's index — add the frame offset
yourself (`F_SHIP + n`). A frame's natural size is `game.assets.frameSize(i)`.

**…use a PNG file instead of canvas art?** `loadFrames` — same slicing, async:

```ts
const F_COIN = await game.assets.loadFrames('./assets/coin-16x16x4.png', 16); // strip: 4 frames
const F_CARD = await game.assets.loadFrames('./assets/cards80x112.png', 80, 112); // GRID: row-major
const F_BACK = await game.assets.loadFrames('./assets/backscroll.png');       // one frame
```
Trap: await it BEFORE `run()` — the frame indices must exist when you draw.
Grid sheets slice left→right then top→bottom.

**…show text?** Pick the path by SCRIPT first:

- **Not plain Latin** (Chinese, Japanese, Korean, Arabic, Hebrew, Thai, Hindi,
  Cyrillic, Greek, emoji) → `d.unicodeText`. **Mandatory** — the other two paths
  cannot render those scripts. [unicode-text.md](unicode-text.md).
- **Latin, sharp and styled** → `d.msdfText` ([msdf.md](msdf.md)).
- **Latin pixel labels, a quick HUD line** → `d.text` ([text.md](text.md)).

For a FIXED Latin string you can also rasterize it once and draw it as a sprite:

```ts
const F_SCORE_LABEL = game.assets.text('SCORE', { font: 'bold 22px monospace', color: '#ffd147' });
game.run((d) => d.sprite(F_SCORE_LABEL, 8, 8));
```
Trap: `game.assets.text()` bakes the string — it is NOT for per-frame changing text.
For a score, bake the digits '0'–'9' once and draw them per character (they're
consecutive frames if you register them consecutively).

**…draw a health bar / debug plot / rope?** Verbs, no objects:

```ts
d.rect(8, 8, 60, 8, '#301020');                  // back
d.rect(8, 8, 60 * hp, 8, '#e04848');             // fill
d.poly(samples.map((v, i) => ({ x: i * 4, y: 100 + v * 30 })), 1.5, '#5cd9b3');
```

**…rotate something about its centre?** `rot` (radians, clockwise) on
`sprite()` and `rect()`. `line()` is already a rotated rect — give it the two
endpoints.

**…flip a sprite to face left?** `{ flipX: true }`. There is no flipY — flip
the art or rotate.

**…make a sprite pulse/tint?** `{ tint: '#ff4040', alpha: 0.5 + Math.sin(t) * 0.5 }` —
tint and alpha are per-instance data; they never cost extra draw calls.

**…control what's in front?** Call order paints back-to-front by default.
Pass `{ z }` on `sprite()` to override (bigger = in front) — e.g. draw a boss
under a HUD you pushed earlier. Shapes always render in call order among
themselves.

**…tile a texture across a region (ground strip, wall, fence)?** There is no
TileSprite object — ANY sprite tiles. Draw one sprite the size of the region
and set `uvRepeat` to the tile counts:

```ts
// a 1200×32 ground strip from one 32×32 tile — ONE instance, not 38
d.sprite(F_GROUND, 0, 448, { w: 1200, h: 32, uvRepeat: { x: 1200 / 32 } });
```

**…scroll a texture (parallax, conveyor, lava, waterfall)?** `uvScroll`, in
frame fractions (1 = one full frame). The geometry never moves — only the
texture. Animate it per frame:

```ts
d.sprite(F_CLOUDS, 0, 0, { w: vw, h: 200, uvRepeat: { x: 3 }, uvScroll: { x: t * 0.05 } });
d.sprite(F_BELT, bx, by, { w: 240, h: 16, uvRepeat: { x: 15 }, uvScroll: { x: t * 2 } });
```
For camera-linked parallax, derive the scroll from the camera:
`uvScroll: { x: game.camera.x * 0.0005 }` — smaller factor = further away.
Both options also live on retained sprites (`SpriteConfig.uvRepeat` /
`.uvScroll`; mutate `sprite.uvScroll.x` per frame). Trap: repeats wrap the
FRAME's atlas rect, so author the tile's art to loop seamlessly.

**…wave a flag / flip a card / jiggle a slime?** Pass `deform` and the
sprite becomes a GPU-deformed grid (no new object, no CPU vertex work):

```ts
d.sprite(F_FLAG, x, y, { deform: { kind: 'wave', amount: 8, speed: 0.7 } });   // cloth, pinned left
d.sprite(F_PLANT, x, y, { deform: { kind: 'sway', amount: 12, speed: 0.5 } }); // bends, pinned bottom
d.sprite(F_SLIME, x, y, { deform: { kind: 'jelly', amount: 0.15 } });          // squash wobble
```

A card flip is `kind: 'flip'` (`speed` = turns/sec; `phase` = start angle).
Past 90° the sprite renders MIRRORED — swap to the back frame for a real
two-sided card:

```ts
const deform = { kind: 'flip', speed: 0.4, phase: 0 } as const;
const front = facing(deform, t) >= 0;      // import { facing }
d.sprite(front ? F_ACE : F_CARD_BACK, x, y, { w: 90, h: 126, deform });
```
`amount` is world units (wave/sway) or a fraction (jelly). `speed: 0` +
mutating `phase` gives manual control (a flip driven by a tween). Also on
retained sprites via `SpriteConfig.deform`.

**…add a deformer that doesn't exist (page curl, ripple, melt)?** Custom
deformers are DATA — request one by name (they arrive as blocks, like post
effects; a def is pure data). Registering and using one:

```ts
game.assets.deformer(curlDef);    // a DeformDef delivered as data — once, at load
d.sprite(F_PAGE, x, y, { deform: { kind: 'curl', amount: 20, speed: 0.25 } });
```
The trap: a def's `code` is WGSL — on the WebGL fallback renderer a def
without a `glsl` twin snippet renders UNDEFORMED (one console warn). Defs
that must degrade gracefully ship BOTH dialects (same variable scope: `p`,
`shade`, `uvn`, `size`, `amount`, `t`, `TAU`).

**…run physics or a rope/cloth sim?** Not in the frame callback — register it
on the fixed clock so irregular dt can't explode it:

```ts
game.onStep((step) => rope.integrate(step));   // fixed 60 Hz (fixedStep option)
```

**…react to clicks/taps at a world position?**

```ts
game.canvas.addEventListener('pointerdown', (e) => {
  const p = game.input.toWorld(e);   // world units through this frame's view
});
```

## What the engine does for you

- **Batching + depth.** One texture atlas; sprites and shapes route themselves
  between an opaque alpha-cutout pass (depth-buffered, so overdraw costs
  nothing) and a blend pass for translucency. Per-sprite tint/rotation/flip
  never breaks a batch and the buffers grow themselves.
- **Draw order is CALL order.** Every 2D pass — quads, text, panels, filled
  polygons, particles, deformed and fx sprites — is replayed in the order you
  drew it, so `d.panel(...)` then `d.text(...)` puts the text on the panel. Pass
  an explicit `z` to override within the sprite batch.
- **Device-loss recovery.** On mobile the GPU device is routinely lost when a
  tab is backgrounded; the engine rebuilds everything itself.
- **Backing store.** Native resolution at devicePixelRatio, capped 2×.

## Relates to

- [unicode-text.md](unicode-text.md) — `d.unicodeText`: **every non-Latin script** (CJK, Arabic, Hebrew, Thai, Indic, emoji), right-to-left, vertical CJK.
- [msdf.md](msdf.md) / [text.md](text.md) — `d.msdfText` / `d.text`: the Latin-only paths.
- [text-layout.md](text-layout.md) — `text.bounds()` / `textOverlaps()` so HUD text never overlaps, plus hover/click states.
- [index.md](index.md) — the layout model (`worldHeight`, `game.view`), the frame lifecycle.

Signatures: engine/webgpu/draw.d.ts, engine/webgpu/game.d.ts, engine/webgpu/atlas.d.ts, engine/webgpu/unicode-text.d.ts.

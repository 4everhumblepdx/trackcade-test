# Text layout & interaction — bounds, overlap, hover & click

Three surfaces on the text objects (`UnicodeText` and `MsdfText`):

- `text.bounds(x, y, opts)` — the box a block actually paints.
- `textOverlaps([...])` — which blocks collide, and the move that separates them.
- `hover` / `pressed` styles + `onClick` — menus and links (`UnicodeText` only).

## Bounds

`text.width` / `text.height` are the **text box**: align to it.
`text.bounds(x, y, opts)` is the **painted box**: the text box grown by stroke,
glow, shadow and background-plate ink, through the same `origin` / `scale` /
`rotation` you draw with. **Space layout against `bounds()`.** A 40px title with a
24px glow paints 48px wider and 48px taller than its text box.

```ts
const b = title.bounds(16, 12);
d.unicodeText(title, 16, 12);
d.unicodeText(subtitle, 16, b.bottom + 8);      // cannot crowd the title
```

`bounds()` returns `{ x, y, w, h, right, bottom, cx, cy }`.

**It reserves the worst case:** the box covers the largest of the base, hover and
pressed states, so a menu spaced by `bounds()` still clears when an item lights up
or grows on hover.

**Trap:** `bounds()` is in the SURFACE's units — world units off `game.draw`, CSS
pixels off `game.hud`. Measure and place on the same surface.

## Overlap

`textOverlaps(items, { gap })` takes a list of placements and returns every
colliding pair. An empty array means the layout is clean.

```ts
import { textOverlaps } from '../engine/webgpu.js';

const clashes = textOverlaps([
  { text: score, x: 16, y: 12, id: 'score' },
  { text: timer, x: 16, y: 52, id: 'timer' },
  { text: combo, x: hud.w - 16, y: 12, opts: { origin: { x: 1 } }, id: 'combo' },
], { gap: 6 });                        // require 6px of breathing room

for (const c of clashes) console.warn(`${c.idA} overlaps ${c.idB}`, c.push);
```

Each result carries `{ a, b, idA, idB, rect, push }`:
- `a` / `b` — indices into the array you passed. `idA` / `idB` — your `id`s, or `#0`.
- `rect` — the overlapping region.
- **`push`** — the smallest move that separates the pair. Add it to item `b`'s
  position, subtract it from `a`'s, or split it between them.

Items can also be plain rects, `{ x, y, w, h, id }`, so text can be checked
against a panel, a button or a safe area:

```ts
textOverlaps([{ text: subtitle, x: cx, y: 400, opts: { origin: { x: 0.5 } } },
              { x: 0, y: 430, w: hud.w, h: 90, id: 'dialogue-box' }]);
```

**Run it at build time, not every frame** — once in `setup()`, and again when the
language or a number format changes. It is O(n²) in the number of items.

## Debug overlay

`game.debug = true` draws every text block's painted box: green normally, **red
where two collide**, with the clash tinted. The boxes are the real extents,
including ink and the hover state.

```ts
game.debug = true;                                  // the whole overlay
game.debug = { textBounds: true, stats: false };    // unlisted keys stay ON
```

## Hover & click

A block with a `hover` (or `pressed`) style becomes interactive: it hit-tests the
pointer, swaps to that look, and asks for the hand cursor. Each state is
rasterized to its own texture the first time it is entered and reused after that,
so a state change is a texture swap, not a re-rasterize.

```ts
const play = game.assets.unicodeText('ゲームを始める', {
  fontSize: 30, color: '#c9d3f5',
  hover: {
    color: '#ffffff',
    underline: { color: '#ffd23f', thickness: 3 },
    background: { color: '#2f3d6b', padding: 12, radius: 8 },
    scale: 1.04,
  },
  pressed: { color: '#ffd23f' },
});
play.onClick(() => game.go('play'));

game.run(() => { game.hud.unicodeText(play, 70, 120); });   // drawing IS the update
```

**Drawing drives it.** The hit test runs inside `d.unicodeText(...)` against THAT
surface's pointer (world coords off `game.draw`, CSS pixels off `game.hud`), so
the state getters are current immediately after the call.

Or poll:

```ts
game.hud.unicodeText(play, 70, 120);
if (play.hovered) game.sound.play('tick');
if (play.clicked) game.go('play');        // true for ONE frame
if (play.held) …                          // pointer down on it right now
```

### How do I…

**…make a plain hyperlink?** Colour + underline:
```ts
game.assets.unicodeText('اقرأ المزيد', { color: '#6fb3ff', hover: { color: '#fff', underline: true } });
```

**…underline / strike text without hovering?** Normal style keys:
`{ underline: true }`, `{ strikethrough: { color: '#f77', thickness: 2 } }`. A
rule takes `{ color, thickness, offset }` in px; `color` defaults to the fill.

**…hit-test without changing the look?** `interactive: true`. Calling `onClick`
also switches it on.

**…make a small label easier to tap?** `hitPadding: 8` grows the clickable box on
every side without moving any art. A background plate's padding is already in the
hit box.

**…turn the hand cursor off?** `cursor: false` on the block.

**…build a menu that can't collide however long the translations get?** Stack by
`bounds()`; a longer string or a bigger hover plate pushes the next item down:
```ts
let y = 90;
for (const item of items) { d.unicodeText(item, 70, y); y = item.bounds(70, y).bottom + 6; }
```

**…lay a button out around its text?** `bounds()` gives the box to draw behind. A
`background` plate on the text itself moves, wraps and hit-tests with the text.

**…do this with Latin MSDF text?** `MsdfText` has the same `bounds(x, y, opts)`
and works in `textOverlaps()`. Trap: its ink margin is an **estimate** and errs
generous — outline width and shadow spread are distance-field fractions, so their
pixel size also depends on the atlas's `distanceRange`. Hover/click states are
`UnicodeText` only.

## Traps

- **Draw an interactive block ONCE per frame.** The press/click edge machine
  advances inside the draw call; drawing the same object twice runs it twice.
- **A click needs press AND release on the block.** A drag that started elsewhere
  never fires `onClick`, so a pan does not trigger the buttons it crosses.
- **Rotated blocks hit-test their AABB**, not the rotated quad. Fine for a tilted
  label, wrong for a heavily rotated one.
- **Hover styles are appearance only.** No `fontSize` / `maxWidth` — a state
  change must not reflow the text. Use `scale` for grow-on-hover (draw-time, no
  re-raster).

## Relates to

- [unicode-text.md](unicode-text.md) — the text objects: **every non-Latin script**, styles, wrapping.
- [msdf.md](msdf.md) — the Latin MSDF path (same `bounds()`, no hover states).
- [debug.md](debug.md) — the rest of the overlay.
- [scenes.md](scenes.md) — `game.input` and the scene lifecycle.

Signatures: engine/webgpu/text-bounds.d.ts, engine/webgpu/unicode-text.d.ts, engine/webgpu/msdf-text.d.ts.

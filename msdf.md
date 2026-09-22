# MSDF text — crisp, scalable, styled fonts

> **LATIN ONLY. STOP if your text is not plain Latin letters + digits.**
> An MSDF atlas holds a fixed charset and lays glyphs out left-to-right with no
> shaping and no bidi: CJK renders blank, Arabic renders reversed and unjoined.
> Chinese, Japanese, Korean, Arabic, Hebrew, Thai, Hindi, Cyrillic, Greek and
> emoji go through **`game.assets.unicodeText()` + `d.unicodeText()`** —
> [unicode-text.md](unicode-text.md). No exceptions.

The **default** path for good-looking **Latin** text. An MSDF font is an atlas `.png` + an
[msdf-atlas-gen](https://github.com/Chlumsky/msdf-atlas-gen) `.json` layout;
sampled through the distance-field shader, a glyph stays razor-sharp at **any**
scale (no re-bake, no blur) and carries a field the shader reads for faux-bold
weight, outlines, glows, soft shadows and rounded decorations — all in **one draw
call per font**. Use it for titles, HUD, damage numbers, dialogue, UI. (Bitmap
`d.text` — see [text.md](text.md) — is now just for tiny pixel labels.)

```ts
import { Game } from '../engine/webgpu.js';

const game = await Game.create();   // worldHeight defaults to 768
// Async: an atlas PNG + its JSON. Await in setup (or queue in preload — below).
const inter = await game.assets.msdfFont('./assets/fonts/Inter_Regular_mtsdf.png',
                                  './assets/fonts/Inter_Regular_mtsdf.json');

// A retained, styled block — build ONCE, mutate, draw every frame.
const title = game.assets.msdfText(inter, 'Hello', { fontSize: 64, color: '#ffd147', align: 'center' });

game.run((d) => {
  d.msdfText(title, game.view.w / 2, 60, { origin: { x: 0.5 } });   // centred at x
});
```

**The model.** `game.assets.msdfText(font, str, opts)` returns a retained `MsdfText`
that lays out once (wrap, kerning, alignment, rich runs, decorations) and
re-submits cheaply. Mutate it with chainable setters (`setText`, `setColor`,
`setWeight`, …) — only a real change re-lays-out. Draw it each frame with
`d.msdfText(text, x, y, opts)`.

The SURFACE you draw through picks the space: `game.draw` is **world** space
(ordered among the 2D scene in call order, under the HUD — it scrolls with the
camera and stacks exactly like `d.text`);
`game.hud` is **screen** space in CSS pixels, camera-proof and painted over the
HUD sprites. The same block can be drawn through both.

**Continuous style channels are field fractions** (normalised by the atlas
`distanceRange`), so `weight: 0.1` or `outline.width: 0.15` look the same on any
font, whatever its atlas size.

## How do I…

**…load a font (and show the loading bar)?** Queue the pair in `preload`, build
it in `setup`:
```ts
preload(load) { load.msdfFont('./assets/fonts/Inter_Regular_mtsdf.png', './assets/fonts/Inter_Regular_mtsdf.json'); }
async setup() { this.inter = await this.game.assets.msdfFont('./assets/fonts/Inter_Regular_mtsdf.png', './assets/fonts/Inter_Regular_mtsdf.json'); }
```
Trap: the JSON must be **msdf-atlas-gen** format, *not* AngelCode/BMFont. Generate
a pair at [snowb.org](https://snowb.org) (export "MSDF Atlas JSON") or with
`msdf-atlas-gen -font F.ttf -type mtsdf -pxrange 8 -imageout f.png -json f.json`.

**…change the text every frame (score/timer)?** Keep ONE object and `setText`:
```ts
const score = game.assets.msdfText(inter, '', { fontSize: 40, color: '#fff' });
game.run((d) => { score.setText(`SCORE ${game.score}`); d.msdfText(score, 16, 16); });
```
Trap: build `game.assets.msdfText(...)` blocks in `setup()` — each call allocates + re-lays a
brand-new object every frame. Build once, mutate.

**…make it bold, without a bold font?** `weight` fattens the letterform in field
units (negative thins it) with no change to advance:
`game.assets.msdfText(f, 'Bold', { weight: 0.14 })` — or `text.setWeight(0.14)`.

**…add an outline?** `outline: { width, color }` (width in field units, ~0.1–0.2):
```ts
game.assets.msdfText(f, 'OUTLINE', { color: '#101828', outline: { width: 0.16, color: '#5cff9e' } });
```

**…make neon / a glow?** An outline with `width: 0` but a `softness` becomes a
glow hugging the letters; add `innerColor` for a hot core:
```ts
game.assets.msdfText(f, 'NEON', { color: '#0c0d18', outline: { width: 0, softness: 0.4, color: '#ff2fb0', innerColor: '#fff' } });
```
Trap: `softness` and `rounded` read the true-SDF alpha channel, so they need an
**MTSDF** atlas (`-type mtsdf`); on a plain `msdf` atlas they're ignored (a hard
outline still works). `spread` (a fat *hard* shadow/outline) works on plain msdf.

**…drop a soft shadow?** `shadow: { x, y, color, alpha, softness }`:
```ts
game.assets.msdfText(f, 'SHADOW', { shadow: { x: 4, y: 5, color: '#000', alpha: 0.6, softness: 0.3 } });
```
`spread` dilates the silhouette (a chunky sticker shadow); `innerColor` ramps the
blur to a second colour.

**…a vertical colour gradient?** Pass `color` as `{ top, bottom }`:
`game.assets.msdfText(f, 'GRADIENT', { color: { top: '#ffe14d', bottom: '#ff5d8f' } })`.

**…faux italic?** `skew` shears each glyph about its baseline:
`{ skew: 0.28 }` (positive leans right). No italic font needed.

**…mix fonts, colours and sizes in one line (rich text)?** `setRichText` with
styled segments — their text concatenates into `text`:
```ts
text.setRichText([
  { text: 'Deal ' },
  { text: '250', color: '#ffd23f', fontScale: 1.3, weight: 0.1 },
  { text: ' damage' },
]);
```
Each segment takes any style key, plus `font` (another `MsdfFont`, or a face name
in a merged atlas) and `fontScale` (a size multiplier). Trap: a run whose `font`
uses a **different texture** ends the draw call — pack faces into one **merged**
atlas (`msdf-atlas-gen -font A.ttf -and -font B.ttf …`) so mixed-font lines stay
one draw call; reach the extra faces with `font.face('Name')`.

**…style words by content?** `addStyle(target, style)` overlays a style on a
substring, a `RegExp`, or a `{ start, length }` span:
```ts
text.addStyle('CRIT', { color: '#ff3355', weight: 0.1 });
text.addStyle(/\d+/, { color: '#ffd23f' });   // every number
```

**…underline / strike / highlight?** Object-level flags or per-run keys:
```ts
game.assets.msdfText(f, 'link', { underline: true });
game.assets.msdfText(f, 'done', { strikethrough: { color: '#f77' } });
game.assets.msdfText(f, 'NEW', { color: '#000', highlight: { color: '#ffd23f', radius: 1, padding: 0.15 } });
text.addStyle('key term', { highlight: { color: '#2f7dff', radius: 0.4 } });
```
A rule takes `{ color, alpha, thickness, offset, dash }`; `dash: { length, gap,
radius }` cuts it into (rounded) dashes. A highlight pill takes `{ color, radius,
softness, borderWidth, borderColor, padding }`. Decorations batch **with** the
glyphs — a shadowed, outlined, highlighted text is still one draw call.

**…wrap / align / space text?** `maxWidth` word-wraps; `align` is
`'left' | 'center' | 'right'` (centres lines within the block); `lineSpacing`
and `letterSpacing` are extra px. `fitInside(w, h)` binary-searches the largest
`fontSize` whose wrapped layout fits a box.

**…centre a whole block, or rotate/scale it?** The block's anchor is the `origin`
draw option (fraction of the block): `origin: { x: 0.5, y: 0.5 }` centres it on
`(x, y)`; `scale` and `rotation` transform it about that origin.

**…read its size?** `text.width` / `text.height` (in px, after layout) are the
TEXT box. For the box it actually **paints** (outline + shadow ink) use
`text.bounds(x, y, opts)`, and check a whole HUD for collisions with
`textOverlaps([...])` — see [text-layout.md](text-layout.md).

## Relates to

- [unicode-text.md](unicode-text.md) — **the mandatory path for any non-Latin script** (CJK, Arabic, Hebrew, Thai, Indic, Cyrillic, emoji).
- [text-layout.md](text-layout.md) — `bounds()` and `textOverlaps()` for laying HUDs out without collisions.
- [text.md](text.md) — the bitmap-font path (`d.text`) for tiny pixel labels and the screen-space HUD.
- [draw.md](draw.md) — the rest of the immediate-mode verbs.
- [index.md](index.md) — `game.view` for on-screen layout; the frame lifecycle.

Signatures: engine/webgpu/msdf-text.d.ts, engine/webgpu/msdf-font.d.ts, engine/webgpu/msdf.d.ts, engine/webgpu/game.d.ts, engine/webgpu/draw.d.ts.

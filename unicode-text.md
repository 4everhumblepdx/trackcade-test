# Unicode text — CJK, Arabic, Hebrew, Thai, Indic, Cyrillic, emoji

> ## THE RULE
> **If the text is not plain Latin letters + digits, it MUST go through
> `game.assets.unicodeText()` + `d.unicodeText()`. No exceptions.**
>
> Chinese · Japanese · Korean · Arabic · Hebrew · Persian · Urdu · Thai · Lao ·
> Khmer · Hindi/Devanagari · Bengali · Tamil · Greek · Cyrillic · Vietnamese ·
> accented Latin · emoji — **all of it goes here.**
>
> `d.text` (bitmap) and `d.msdfText` (MSDF) bake a fixed charset and advance a pen
> left-to-right with no shaping and no bidi. On these scripts they render blank
> space, tofu boxes (□□□), or Arabic reversed and unjoined.

`unicodeText` passes the string to the browser's text engine: shaping (Arabic
joining forms, Indic reordering), the Unicode bidi algorithm, and per-character
fallback to a system font that has the glyph. The result is rasterized once into
its own texture and drawn as one quad, whatever the script or paragraph length.

```ts
import { Game } from '../engine/webgpu.js';

const game = await Game.create();

// Build ONCE (setup / module scope) — never inside run().
const title = game.assets.unicodeText('こんにちは世界', {
  fontSize: 64,
  color: { top: '#ffe14d', bottom: '#ff5d8f' },   // vertical gradient
  stroke: { color: '#2a1a3a', width: 5 },
});

game.run((d) => {
  d.unicodeText(title, game.view.w / 2, 80, { origin: { x: 0.5 } });
});
```

**Which path when**

| The text is… | Use |
|---|---|
| ANY non-Latin script, or mixed scripts, or emoji | **`d.unicodeText`** ← this doc |
| Latin/digits, sharp at any scale | [msdf.md](msdf.md) |
| Latin/digits, tiny pixel labels in a pixel-art game | [text.md](text.md) |

Unsure whether a string counts as Latin? Use `unicodeText`; it renders Latin
correctly too.

## The model

`game.assets.unicodeText(str, opts)` returns a retained, mutable `UnicodeText`.
It lays out and rasterizes lazily: change nothing and a frame costs one quad
push. Mutate it with the chainable setters (`setText`, `setColor`,
`setMaxWidth`, …); only a real change re-rasterizes.

Draw it with `d.unicodeText(text, x, y, opts)` on either surface: `game.draw`
(world space, scrolls with the camera) or `game.hud` (screen space, CSS pixels,
camera-proof). The same object can be drawn on both.

Sizes are in the surface's units — world units on `game.draw`, CSS pixels on
`game.hud`. The block re-rasterizes itself when it would otherwise be drawn
blurry (zooming camera, `scale`), so it stays crisp at any draw size.

## How do I…

**…show Japanese / Chinese / Korean text?** Pass the string. The system font
stack covers CJK on every desktop and mobile OS:
```ts
const label = game.assets.unicodeText('スコア', { fontSize: 28, color: '#ffd23f' });
game.run((d) => { game.hud.unicodeText(label, 16, 12); });
```

**…show Arabic or Hebrew?** Pass the string; joining and right-to-left order are
automatic. `direction` defaults to `'auto'` (the Unicode first-strong rule), and
`align` then defaults to `'right'`:
```ts
game.assets.unicodeText('مرحبا بالعالم', { fontSize: 40 });          // auto → RTL, right-aligned
game.assets.unicodeText('المستوى 7 من 12', { fontSize: 28 });        // digits stay LTR inside it
```
Set `direction: 'rtl' | 'ltr'` explicitly when a string opens with a digit or a
Latin name but the paragraph is RTL.

**…wrap a paragraph?** `maxWidth` (px). The wrap uses the break opportunities the
script allows: spaces for Latin/Arabic, between characters for CJK (kinsoku
applies — `。」` never start a line, `「` never ends one), and dictionary word
boundaries for Thai and Khmer, which have no spaces:
```ts
const box = game.assets.unicodeText(longJapaneseString, {
  fontSize: 24, maxWidth: 520, lineHeight: 1.65, color: '#eef2ff',
  background: { color: '#1b2540ee', padding: 20, radius: 12 },
});
```

**…change the text every frame (score, timer, dialogue, typewriter)?** Keep ONE
object and `setText`:
```ts
const score = game.assets.unicodeText('', { fontSize: 26, color: '#fff' });
game.run(() => { score.setText(`得点 ${points}`); game.hud.unicodeText(score, 16, 12); });
```
**Trap:** `setText` re-rasterizes and re-uploads a texture; setting identical text
is a no-op. Never construct `game.assets.unicodeText(...)` inside `run()` — that
allocates a canvas and a GPU texture per frame. For a fast-ticking counter in
Latin digits, use a bitmap font (`d.text`) next to the `unicodeText` label.

**…put it on the HUD (screen space)?** Draw it through `game.hud`: sizes are CSS
pixels and the camera can't move it. It orders against the HUD's own sprites in
call order, exactly as `d.text` does.
```ts
game.hud.unicodeText(label, game.hud.w - 16, 14, { origin: { x: 1 } });  // top-right
```

**…a gradient fill?** `color` takes a solid string, a `{ top, bottom }` pair, or a
multi-stop gradient with an angle:
```ts
{ color: { top: '#ffe14d', bottom: '#ff5d8f' } }
{ color: { stops: ['#ff5d5d', '#ffd23f', '#5cff9e'], angle: 0 } }   // 0 = left→right
```

**…an outline?** `stroke: { color, width }`. `align: 'outer'` (default) leaves the
letterform's interior clear; `'center'` straddles the edge and fills the counters
of dense CJK characters:
```ts
{ color: '#101828', stroke: { color: '#5cff9e', width: 5 } }
```

**…a glow / neon?** `glow: { color, blur, strength }` — a blurred halo stacked
`strength` times (1–6):
```ts
{ color: '#ffffff', glow: { color: '#ff2fb0', blur: 22, strength: 4 } }
```

**…a drop shadow?** `shadow: { x, y, blur, color }`, or an array for a layered one
(first is furthest back). The shadow is cast by the stroke + fill silhouette, so
an outlined title throws the outline's shadow:
```ts
{ shadow: [{ x: 0, y: 8, blur: 2, color: '#00000055' }, { x: 4, y: 5, blur: 12, color: '#000000cc' }] }
```

**…a dialogue box / name plate?** `background` paints a rounded plate behind the
block, sized from the wrapped text — no separate rect to keep in sync:
```ts
{ background: { color: '#241c3dcc', padding: 22, radius: 14, borderColor: '#6b5aa8', borderWidth: 2 } }
```

**…vertical Japanese (tategaki)?** `vertical: true`. Columns run top-to-bottom and
stack right-to-left, brackets and long-vowel marks rotate a quarter turn, and
`、。` sit in the cell's top-right. `maxWidth` caps a COLUMN's length:
```ts
game.assets.unicodeText('古池や\n蛙飛び込む\n水の音', { fontSize: 34, vertical: true });
```

**…centre / rotate / scale / fade it?** Draw-time options. None re-rasterize
except a scale-up, which re-rasterizes to stay sharp:
```ts
d.unicodeText(t, cx, cy, { origin: { x: 0.5, y: 0.5 }, rotation: 0.2, scale: 1.3, alpha: 0.8, tint: '#ffd0d0' });
```

**…fit text into a box?** `fitInside(w, h)` binary-searches the largest `fontSize`
whose wrapped layout fits:
```ts
game.assets.unicodeText(localised, { fontSize: 48 }).fitInside(300, 90);
```

**…read its size?** `text.width` / `text.height` are the TEXT box (align to it);
`text.lines` are the wrapped lines; `text.resolvedDirection` is `'ltr' | 'rtl'`.
For the box it PAINTS (text plus stroke, glow, shadow and plate ink) use
`text.bounds(x, y, opts)` and space layout against that —
[text-layout.md](text-layout.md).

**…stop my HUD overlapping?** `textOverlaps([...])` reports every colliding pair
plus the smallest move that fixes it; `game.debug = true` draws the boxes and
reddens the clashes. See [text-layout.md](text-layout.md).

**…make text hoverable / clickable (a menu, a link)?** Give it a `hover` (and
optional `pressed`) style, then read `text.clicked` or `text.onClick(fn)`. Full
surface in [text-layout.md](text-layout.md):
```ts
const play = game.assets.unicodeText('ゲームを始める', {
  fontSize: 30, color: '#c9d3f5',
  hover: { color: '#fff', underline: true, background: { color: '#2f3d6b', padding: 12, radius: 8 } },
});
play.onClick(() => game.go('play'));
game.run(() => { game.hud.unicodeText(play, 70, 120); });   // drawing IS the update
```

**…underline it?** `{ underline: true }`, or `{ underline: { color, thickness,
offset } }`. `strikethrough` takes the same shape.

**…control the FONT?** The default family is `'sans-serif'`. The browser falls
back per character to a system font that has the glyph, so CJK, Arabic, Thai and
emoji need no font file. Set `fontFamily` / `fontWeight` / `fontStyle`, or pass a
CSS shorthand as `font`:
```ts
{ fontFamily: '"Noto Sans JP", sans-serif', fontWeight: 700 }
{ font: 'italic 700 48px "Noto Naskh Arabic", serif' }
```
**Trap:** tofu (□□□) means no system font has the glyph. Ship a font file (below);
changing the string won't fix it.

**…use a real font FILE (woff2 / ttf)?** Queue it in `preload()` under a family
name, then name that family:
```ts
override preload(load: Preload): void { load.font('NotoJP', './fonts/noto-sans-jp.woff2'); }
override setup(): void {
  this.title = this.game.assets.unicodeText('タイトル', { fontFamily: 'NotoJP', fontSize: 64 });
}
```
**Trap:** a full CJK font is 4–8 MB. Subset it (`pyftsubset` / `glyphhanger`) or
use the system stack. A face that arrives late is not baked in permanently (the
block re-rasterizes on the next change), but the first frames show the fallback,
so preload it.

**…space the letters out?** `letterSpacing` (px). **Trap: never on Arabic** or any
joining script — it breaks the cursive joins into disconnected letters. Safe on
CJK, Latin, Cyrillic and Greek.

**…free the texture?** `text.destroy()`. Worth it for a large one-off block (a
cutscene paragraph) you won't show again.

## Traps

- **Layout is per-block, not per-character.** No rich-text runs here (that is
  MSDF's `setRichText`). Two styles on one line = two blocks, placed with `.width`.
- **Latin digits inside RTL text are correct as-is.** `المستوى 7` renders the
  number left-to-right. Do not reverse the string to "fix" it.

## Relates to

- [text-layout.md](text-layout.md) — `bounds()`, `textOverlaps()`, hover/click states.
- [msdf.md](msdf.md) — the scalable **Latin** path, with per-run rich text.
- [text.md](text.md) — bitmap glyphs for tiny **Latin** pixel labels, and the HUD surface.
- [draw.md](draw.md) — the rest of the immediate-mode verbs.
- [index.md](index.md) — `game.view` / `game.hud.w` for layout; the frame lifecycle.

Signatures: engine/webgpu/unicode-text.d.ts, engine/webgpu/game-assets.d.ts, engine/webgpu/draw.d.ts.

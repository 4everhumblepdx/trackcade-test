# Text & the HUD pass

> **LATIN ONLY. STOP if your text is not plain Latin letters + digits.**
> Bitmap fonts bake a fixed charset (printable ASCII by default) and advance a
> pen left-to-right. CJK, Arabic, Hebrew, Thai, Hindi, Cyrillic, Greek and emoji
> render blank, as tofu boxes, or (Arabic) reversed and unjoined. **Every
> non-Latin string goes through `game.assets.unicodeText()` + `d.unicodeText()`**
> — [unicode-text.md](unicode-text.md). No exceptions.
>
> For scalable, **styled** Latin text (weight, outline, glow, shadow, gradient,
> rich runs, decorations) use MSDF fonts: [msdf.md](msdf.md). This doc is the
> bitmap/pixel-label path and the screen-space HUD surface.
>
> The HUD surface (`game.hud`, below) is script-agnostic: it takes
> `d.unicodeText` too, so a Japanese HUD label is `game.hud.unicodeText(...)`.

Two text paths and a screen-space surface:

- **`game.assets.font(opts)` + `d.text(...)`** — a bitmap font: glyphs bake ONCE
  (white, shelf-packed into the atlas) and draw as batched quads. **This is
  the path for anything dynamic** — scores, timers, dialogue — a string that
  changes every frame costs only its quad pushes.
- **`game.assets.text(str)`** — rasterize a FIXED string once, returns a frame index
  to draw with `d.sprite()`. Fine for one-off labels; `font()` covers anything
  that changes.
- **`game.hud`** — the same Draw verbs in SCREEN space (**CSS pixels**): origin
  (0,0) at the window's top-left, ignores the camera, always paints over the
  world. A `16px` font is 16 real pixels here, the same size in every game
  regardless of `worldHeight`. Put score/health/prompts here. Size the HUD with
  `game.hud.w` / `game.hud.h` (the window in CSS px). `game.view` is the world.

```ts
import { Game } from '../engine/webgpu.js';

const game = await Game.create();   // worldHeight defaults to 768
const font = game.assets.font({ font: 'bold 16px monospace' });

game.run((d) => {
  game.hud.text(font, `SCORE ${score}`, 8, 8, { color: '#ffd147' });
  game.hud.text(font, 'PAUSED', game.hud.w / 2, 100, { align: 'center', scale: 2 });
});
```

## How do I…

**…show a live score / timer?** Bake a font once at boot, `d.text` it every
frame with the current string. Trap: `game.assets.font()` and `game.assets.text()`
are load-time operations — call them in `setup()`, leaving run() to draw.

**…colour text?** `{ color: '#ff6b6b' }` — glyphs are white; tint is
per-instance (a rainbow costs nothing: draw each char with its own color).

**…center / right-align?** `{ align: 'center' }` anchors x at the middle,
`'right'` at the end. `font.measure(str, scale)` gives the rendered width for
manual layout.

**…make a HUD that doesn't scroll with the camera?** Draw it through
`game.hud` — screen space (CSS pixels), camera-proof, drawn last. `game.hud.w` /
`game.hud.h` are the window's size in CSS px for HUD layout (they change with
window size — anchor to edges/centre, not magic numbers). In a scene, override
`drawHud(d)` — its `d` **is** `game.hud`, so `d.h - 20` is 20px off the bottom.

**…put text IN the world (a sign, a floating damage number)?** Use `d.text`
on the WORLD surface (`d`, the run() callback argument) — it scrolls with the
camera like any sprite.

**…where does `d.text` sit in the stack?** Exactly where you drew it. It is an
ordinary scene verb: draw it before a sprite and the sprite covers it, draw it
after and it covers the sprite. A floating damage number can pass behind a wall.

**Every 2D verb follows the same rule** — `d.msdfText`, `d.unicodeText` and
`d.panel` included. They are different shaders, so the frame breaks its batches
and swaps pipeline to keep the order you wrote; a few extra draw calls buy an
API with no ordering rules to learn. A Japanese sign stacks like a Latin one,
and text lands on a panel simply by being drawn after it.

**…label a button or a panel with it?** Draw the panel, then the text. Call
order is the whole rule — panels are in the same ordering as everything else:

```ts
d.panel(x, y, 200, 48, 'glossy');
d.text(font, 'PLAY', x + 100, y + 16, { align: 'center' });
```

For a control you want to react and sink, `d.ui.button(x, y, 200, 48, 'PLAY')`
or `d.panel(..., { label: 'PLAY' })` centres and offsets the caption for you.
See [ui.md](ui.md).

**…get a different look?** `font` takes any CSS shorthand:
`game.assets.font({ font: 'bold 42px monospace' })`. Scale at draw time is cheap but
chunky (glyphs are bitmaps) — bake at the size you'll mostly draw at.

**…use a real font FILE (woff2 / ttf / otf)?** Queue it in `preload()` under a
family name, then bake against that name in `setup()`:

```ts
override preload(load: Preload): void {
  load.font('Orbitron', './fonts/orbitron.woff2');   // an awaited asset like any other
}
override setup(): void {
  this.font = this.game.assets.font({ font: 'bold 32px Orbitron' });
}
```

**Trap:** baking rasterizes whatever face the browser has for that family AT
THAT MOMENT, and glyphs go onto the atlas **once** — a face that arrives late
leaves the fallback (Arial-ish) baked in permanently, with no error.
`load.font()` queues the file; `setup()` runs after it lands. The engine also
awaits `document.fonts` before any `setup()` (covers `@font-face` in the host
page) and warns to the console if you bake a family it can't see.

## Relates to

- [unicode-text.md](unicode-text.md) — **the mandatory path for any non-Latin script** (CJK, Arabic, Hebrew, Thai, Indic, Cyrillic, emoji), on the world surface or this HUD.
- [msdf.md](msdf.md) — crisp scalable styled Latin text; the default for titles/HUD.
- [draw.md](draw.md) — the rest of the verbs; `d.text` is one of them.
- [index.md](index.md) — the layout model (`game.view` for HUD anchoring).

Signatures: engine/webgpu/font.d.ts, engine/webgpu/draw.d.ts, engine/webgpu/game.d.ts.

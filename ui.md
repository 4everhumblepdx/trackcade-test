# UI — widgets and panels, with no art

Two layers. `d.ui.*` is the widget set, named after HTML's. `d.panel()` is the
material primitive they are built from — reach for it when the widget set has no
name for what you want: dialogs, tooltips, cards, inventory slots, name plates.

```ts
if (d.ui.button(x, y, 180, 52, 'Start')) startGame();   // a whole button
sound  = d.ui.checkbox(x, y, 'Sound', sound);           // value in, value out
volume = d.ui.slider(x, y, 240, volume);
name   = d.ui.input(x, y, 240, 40, name);               // single line
notes  = d.ui.textarea(x, y, 320, 160, notes);          // wraps, scrolls, clipped
```

The game owns every value. There are no widget objects to construct or destroy:
each call takes the current value and returns the new one.

## The widgets

| | |
|---|---|
| `ui.button(x, y, w, h, label, opts?)` | → `true` on the frame it is clicked |
| `ui.checkbox(x, y, label, checked, opts?)` | → the new checked value (the label is clickable too) |
| `ui.toggle(x, y, on, opts?)` | → the new value; the knob slides between ends |
| `ui.slider(x, y, w, value, opts?)` | → the new value (`min`, `max`, `step`) |
| `ui.progress(x, y, w, h, frac, opts?)` | a read-only bar — health, XP, loading |
| `ui.window(x, y, w, h \| 'auto', title?, opts?)` | a frame; **returns its INNER rect**. With `body` it sizes itself to its content |
| `ui.radio(x, y, label, group, value, opts?)` | → the value the group should now hold |
| `ui.input(x, y, w, h, value, opts?)` | → the edited string — SINGLE-LINE, scrolls, never wraps |
| `ui.textarea(x, y, w, h, value, opts?)` | → the edited string — MULTI-LINE, wraps, scrolls, clipped |
| `ui.select(x, y, w, h, value, options, opts?)` | → the chosen value; drops a scrolling list over everything |
| `ui.list(x, y, w, h, contentHeight, body, opts?)` | a scrolling, clipped region — you draw the rows |
| `ui.header(x, y, w, h, text, opts?)` | a title band / section heading — inert, never a button |
| `ui.label(x, y, str, opts?)` | text (`align`, `size`, `color`, `wrap`) |
| `ui.measure(str, size?)` | the width of a string |
| `ui.textSize(str, opts?)` | the laid-out `{ w, h }`, honouring `wrap` |

`ui.hovered` reports whether the widget from the LAST call was hovered.

## Theming

Three built-in themes, each generated from one base colour. This is usually the
only styling a game needs.

```ts
d.ui.setTheme('casual',  { color: '#7ac74f' });   // the default look, in green
d.ui.setTheme('compact', { color: '#4d9cb5' });   // small and flat, teal accent
d.ui.setTheme('sharp',   { color: '#000080' });   // square and hard-edged, navy
```

| | |
|---|---|
| **`casual`** (default) | fat rims, gradients, gloss, big radii, 18px labels. Arcade, puzzle, match-3, kids' games. |
| **`compact`** | 1px rims, tight radii, no gloss, 13px labels, the base colour used only as an ACCENT. Strategy, sim, editors, tools. |
| **`sharp`** | square corners, hard 2px rims, flat faces, no bevel, gloss or blur. The only LIGHT theme; the base colour is the accent. Retro, terminal, tycoon, in-fiction computers. |

`color` drives the whole palette — buttons, rims, fills, knobs, accents. `text`
and `fontSize` are the other two options.

An object merges into the current theme instead of replacing it:
```ts
d.ui.setTheme({ fontSize: 20, window: 'glass' });
```
Keys: `button`, `window`, `header`, `headerRule`, `headerText`, `headerInherit`,
`track`, `fill`, `knob`, `tick`, `scrollbar`, `text`, `textMuted`, `fontSize`,
`size`, `gap`, `pad`, `scrollbarSize`.

A window's title bar inherits its container's colour and corner radius, so
retheming `window` alone still matches. `headerInherit: false` keeps the caption
fixed instead, and `headerText` sets its label colour — `sharp` uses both.

A theme **persists** across frames and screens. `ui.resetTheme()` returns to
`casual`, which a screen that themes only part of itself should do first.

## Fonts and scripts

Widget labels route themselves. A label the current font can draw goes down the
crisp MSDF path; anything else (CJK, Arabic, Hebrew, Thai, Devanagari, emoji)
goes through `UnicodeText`, with shaping, bidi and system font fallback.

```ts
if (d.ui.button(x, y, 200, 64, '開始')) start();     // nothing to set up
```

Widgets bake a plain system font on first use, so they work with zero setup.
Give them an MSDF font and Latin labels stay crisp at any scale:
```ts
game.draw.ui.setFont(await game.assets.msdfFont(png, json));
```
Blocks are cached per (string, size, colour), so a label costs one quad a frame
whatever the script. [fonts.md](fonts.md) lists 24 ready-baked MSDF fonts on the
CDN.

## The panel primitive

`d.panel()` draws interface furniture from numbers, not textures. A panel is a
rounded box whose rim, bevel, gloss, inner shadow and drop shadow are computed
per pixel from the shape's own signed distance field. Nothing is authored,
nothing is loaded, and nothing stretches: the same call gives a 40-unit chip and
a 900-unit dialog the same crisp 5-unit rim, at any zoom, on any DPI.

```ts
d.panel(x, y, 200, 64, 'glossy');                                  // a named style
d.panel(x, y, 200, 64, { base: 'glossy', fill: '#e6408f' });       // …with an override
```

`game.draw` puts panels in world space (they scroll with the camera); `game.hud`
puts them in screen space, CSS pixels. Same verb.

**Panels obey call order like every other verb.** Draw a panel then text and
the text is on the panel; draw text then a panel over it and the panel covers
it. Sprites, shapes, text and panels are one ordering — the frame breaks its
batches and swaps shaders to keep it, which is worth far more than the draw
calls it saves.

```ts
d.panel(x, y, 200, 48, 'glossy');
d.text(font, 'PLAY', x + 100, y + 16, { align: 'center' });   // on the panel
```

For a control that reacts and sinks, let the component carry its caption — it
centres the label and offsets it with the panel's own press:

```ts
d.ui.button(x, y, 200, 48, 'PLAY');
d.panel(x, y, 200, 48, { base: 'glossy', pressed: true }, { label: 'PLAY' });
```

Every length — `radius`, `border`, `bevelWidth`, `shadowBlur` — is in the
surface's own units, the same ones `w`/`h` are in. Angles are degrees.

## The built-in styles

| | |
|---|---|
| `flat` | a plain rounded rect — the neutral base |
| `glossy` | the candy/casual button: fat rim, gradient, bevel, gloss cap |
| `panel` | a container/frame to sit other UI on |
| `glass` | translucent card with a bright rim |
| `metal` | cool gradient, tight bevel, thin bright rim |
| `inset` | a SUNKEN well — slider tracks, progress backgrounds, empty slots |
| `bar` | the fill that rides inside an `inset` track |

These are materials, not themes — the colours are defaults. One line recolours
any of them:

```ts
d.panel(x, y, w, h, { base: 'glossy', fill: '#7ac74f', fillTo: '#4e9b2c' });
```

## How do I…

**…make a bespoke control?** A panel plus a text block:
```ts
d.panel(x, y, 200, 64, 'glossy');
d.msdfText(labelBlock, x + 100, y + 14, { origin: { x: 0.5 } });
```
Or let the panel carry it, which needs no font file and no measuring — the
caption centres itself and follows the panel's sink:
```ts
d.panel(x, y, 200, 64, { base: 'glossy', hover: true, pressed: true }, { label: 'PLAY' });
```
**Not** `d.text` on the panel: that is a scene verb and the panel pass paints
over it.

**…float a dialog over a screen that already has text on it?** Put it on a
LAYER. Everything inside claims the layer above whatever is already drawn —
panels, captions and MSDF text together — so it covers the screen below
completely. No stencils, no second surface, no ordering rules:

```ts
d.panel(20, 20, 400, 300, 'panel');            // the page…
d.ui.label(40, 40, 'lots of body copy…');

if (confirming) d.ui.modal(() => {             // …and the dialog OVER it
  d.panel(140, 120, 300, 140, 'glossy');
  d.ui.label(290, 150, 'Delete the save?', { align: 'center' });
  if (d.ui.button(170, 200, 110, 34, 'Delete')) doIt();
  if (d.ui.button(300, 200, 110, 34, 'Cancel')) confirming = false;
});
```

`ui.window(x, y, w, h, title, { body })` already does this for you — its frame
and its contents are one object on one layer. Reach for `modal()` only when you
are drawing the frame yourself. Layers nest, and an open `ui.select` list still
floats above every one of them.

**…make it react to the pointer?** Add `hover: true` / `pressed: true`; the panel
hit-tests itself and the call reports back:
```ts
if (d.panel(x, y, 200, 64, { base: 'glossy', hover: true, pressed: true }).clicked) {
  startGame();
}
```
`true` uses the engine defaults — hover brightens, pressed darkens and sinks the
panel by 2 — and they are relative shifts, so they read correctly on any
material and palette. `d.panel()` returns `{ hovered, pressed, active, clicked,
offsetX, offsetY }`. `clicked` needs the press AND the release on the same panel.

**…author the states myself?** Give either one a style instead of `true`, stating
only what changes:
```ts
d.panel(x, y, w, h, {
  base: 'glossy',
  hover:   { brightness: 0.2, gloss: 0.75, shadowBlur: 20 },
  pressed: { brightness: -0.15, gloss: 0.1, offsetY: 4, shadow: 0.12 },
});
```
Use `brightness` (-1..1) to lighten or darken; `tint` is a multiply and can only
darken.

**…hit-test without changing the look?** `interactive: true`.

**…move the label with a sinking button?** The offset is applied inside
`d.panel` and reported back:
```ts
const s = d.panel(x, y, w, h, { base: 'glossy', hover: true, pressed: true });
d.msdfText(labelBlock, x + w / 2, y + s.offsetY + 14, { origin: { x: 0.5 } });
```

**…drag something?** `active` stays true for a press that STARTED on the panel
however far the pointer has moved; `pressed` goes false as soon as it leaves.
That is the difference between a button and a slider.

**…make a pill or a circle?** `radius: 'pill'` rounds the short axis fully; a
square panel with `radius: 'pill'` is a circle.

**…build a bar by hand?** An `inset` track with a `bar` inside it:
```ts
d.panel(x, y, 460, 26, 'inset');
d.panel(x + 4, y + 4, (460 - 8) * frac, 18, 'bar');
```

**…wrap a paragraph inside a box?** Give `label` a `wrap` width. `x` is then the
LEFT edge of the wrap box and `align` positions each line inside it:
```ts
d.ui.label(x, y, longText, { wrap: 300, align: 'center' });
const { w, h } = d.ui.textSize(longText, { wrap: 300 });
```

**…stop a container crowding its content?** Pass `'auto'` and a `body`. The
window measures what you drew and guarantees the theme's padding on every side,
including the bottom:
```ts
ui.window(x, y, 320, 'auto', 'Settings', { body: (r) => {
  sound = ui.checkbox(r.x, r.y, 'Sound', sound);
  if (ui.button(r.x, r.y + 40, r.w, 44, 'Save')) save();
}});
```
Measurement counts what is VISIBLE, not what was drawn, so a `list` or
`textarea` contributes its own box and never the rows hanging below it —
scrolling one does not resize the window.

**…give a section a heading?** `ui.header(x, y, w, h, text)`. It is inert: no
hover, no press, no clicks. Pass `{ inside: containerStyle }` and it takes that
container's colour and radius, which is what `window` does for its title bar.

**…clip or scroll something myself?** `d.pushClip(x, y, w, h)` / `d.popClip()`.
Nested clips intersect, and a panel clipped entirely out of view stops
HIT-TESTING too, so scrolled-away rows are not secretly clickable.
`d.visible(x, y, w, h)` is the same rect test, for skipping rows before you build
them.
```ts
d.pushClip(x, y, w, h);
for (const item of items) d.ui.button(x, y + item.top - scroll, w, 40, item.name);
d.popClip();
```
`ui.list()` and `ui.textarea()` are this with the scrolling wired.

**…which way does dragging scroll?** Dragging the CONTENT follows your finger, so
pulling down reveals what is above (touch). Dragging the SCROLLBAR moves the
thumb to the pointer, so pulling down reveals what is below (desktop). The wheel
scrolls over either.

**…round only some corners?** `radius: [topLeft, topRight, bottomRight, bottomLeft]`.

**…change where the light comes from?** `light` is degrees clockwise from
straight up (default `0` = above). `light: 180` flips the relief so the shape
reads as carved in — the only difference between `glossy` and `inset`.

**…ship a whole UI theme?** Styles are plain JSON, so a theme is data:
```ts
import { defineUiStyle } from '../engine/webgpu.js';
defineUiStyle('rune', { base: 'panel', fill: '#26324a', borderColor: '#7fd4c1' });
```

## The style fields

Everything is optional; `base` inherits the rest.

**Silhouette** `radius` · **Body** `fill`, `fillTo`, `fillAngle` (0 = top→bottom,
90 = left→right) · **Rim** `border` (drawn INSIDE the edge), `borderColor`,
`borderColorTo` · **Relief** `bevel` (0..1), `bevelWidth`, `light` · **Gloss**
`gloss` (0..1), `glossHeight` (fraction of the panel), `glossInset`,
`glossColor` · **Inner shadow** `innerShadow` (0..1), `innerShadowWidth`,
`innerShadowColor` · **Drop shadow** `shadow` (0..1), `shadowX`, `shadowY`,
`shadowBlur`, `shadowSpread`, `shadowColor` · **Whole panel** `brightness`
(-1..1), `tint`, `alpha`, `offsetX`, `offsetY` · **Interaction** `hover`,
`pressed`, `interactive`, `cursor`

`bevel` lights the surface from the distance field's own gradient and runs after
the rim, so a rim gets a lit top and a shaded underside for free. Turn it off
and a panel goes flat.

## Traps

- **`border` is drawn inside the silhouette**, so it eats into the body — it
  never grows the panel's footprint.
- **A gradient needs `fillTo`.** `fill` alone is a flat colour.
- **`gloss` and `bevel` default to 0** on `flat`/`panel`: a style that looks
  lifeless has probably inherited from the wrong `base`.
- **Layers are for what call order cannot say.** "Above everything already on
  screen" is not an ordering — it is a layer. Use `d.ui.modal()`, or
  `d.ui.window()` with a `body`, and the whole dialog rises as one. Everything
  else is just the order you drew it in.
- **Implicit ids follow panel order.** A conditionally-drawn interactive panel
  shifts the ids after it — pass `{ id: 'name' }` and the press state follows the
  panel rather than the slot. Widgets use the same rule.
- **`tint` cannot brighten** — reach for `brightness`.
- **Hit-testing is a rectangle**, not the rounded silhouette.
- **`ui.setTheme` persists across frames and screens.** `resetTheme()` first.
- **`input` never wraps** — that is `textarea`. A word wider than a `textarea` is
  clipped, because word-wrap has nowhere to break it.
- **Clipping covers PANELS AND TEXT, not sprites or shapes.** `d.sprite`,
  `d.rect`, `d.line` and `d.fill` ignore it, so a scroll list with sprite icons
  will spill.
- **Clips are axis-aligned rectangles.** A rotated panel is cut by the upright
  rect.
- **Nothing auto-sizes to text.** A caption wider than its panel paints over its
  neighbours — size the panel with `ui.measure()` / `ui.textSize()`.
- **Text fields have no selection or clipboard** — typing, Backspace, Delete,
  arrows and Home/End only.
- **Widget LAYOUT is left-to-right even when the text is not.** A checkbox in an
  Arabic UI still puts its box on the left; the text inside each widget is
  correctly shaped and bidi'd.
- **The text-field caret is LTR**, so RTL editing is approximate.

## See also

- [fonts.md](fonts.md) — the hosted MSDF fonts to give `ui.setFont()`.
- [msdf.md](msdf.md) — the text that goes ON the panels (`d.msdfText`).
- [text-layout.md](text-layout.md) — `bounds()` for sizing a panel to its label.
- [draw.md](draw.md) — the rest of the immediate-mode verbs.
- [index.md](index.md) — `game.view` / `game.hud` for layout; the frame lifecycle.

Signatures: engine/webgpu/ui-widgets.d.ts, engine/webgpu/ui.d.ts, engine/webgpu/ui-style.d.ts, engine/webgpu/draw.d.ts.

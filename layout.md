# Layout & the art axis — there is no resize code

Two decisions shape every screen in the engine: how big the world is
(`worldHeight`) and whether art is smooth or blocky (`pixelArt`). Both are set
once, at `Game.create()`, and neither has a resize path to write.

## The layout model

`worldHeight` is the logical height of the visible 2D **world** — **default 768,
and you rarely set it.** Each frame the visible world is that many units tall
and as wide as the window's aspect makes it; read `game.view` (`{x, y, w, h}`)
and derive width-dependent layout from it *inside* the frame callback. There
are no resize events, safe areas, pinning, or canvas sizes — `worldHeight` is a
logical unit, NOT a pixel size (the canvas is always full physical resolution).
Rotating or resizing the window just re-fits the view.

- **`worldHeight` sizes the 2D WORLD only — not the HUD.** The 3D world
  (`game.world3d()`) has its own perspective camera (`fov`) and ignores
  `worldHeight` entirely; leave it at 768 for 3D games. For a chunky pixel-art /
  retro look set a low `worldHeight` (e.g. `240`) and pair it with
  `pixelArt: true` — sprites are authored 1:1 at that scale.
- **The HUD (`game.hud`) is SCREEN PIXELS**, independent of `worldHeight` and
  the camera. A `14px` HUD font is 14 real pixels in *every* game, so text stays
  a sane, consistent size whatever `worldHeight` you pick. Position HUD furniture
  against the HUD's own extent — `game.hud.w` / `game.hud.h` (the window in CSS
  pixels), e.g. `d.text(font, 'SCORE', 8, game.hud.h - 20)`. Draw the HUD in a
  scene's `drawHud(d)` (its `d` **is** `game.hud`) or via `game.hud.*`.

Fractional placement: retained sprites take percentage strings directly in
their config — `new Sprite({ x: '75%', y: '20%', w: '10%' })` — resolved
once at `add()` time (see [sprites.md](sprites.md)). For immediate-mode verbs,
`game.vw(f)` / `game.vh(f)` give the world X/Y at fraction f across/down
this frame's view (camera-aware). For SIZES, multiply the view directly:
`w: game.view.w * 0.25`.

Map pointer events to world coordinates with `game.input.toWorld(event)`.

## The art axis — smooth by default

`Game.create({ pixelArt })` is the ONE art switch, chosen once per game:

- **`false` (default) — SMOOTH.** Linear sampling; gradient/high-res art
  scales cleanly. Most games want this.
- **`true` — PIXEL ART (blocky).** The choice for pixel-art games.
  Sprites render at native resolution but sample their texels BLOCKY —
  snapped to texel centres with a one-screen-pixel anti-aliased seam — so
  pixels are fat and crisp while motion, rotation and scaling stay
  float-smooth. Author art at 1:1 world scale (a 16-unit sprite = 16
  texels) and it just looks right. Keep movement in floats.

For a whole-frame chunky-grid look (everything quantised, CRT on top),
stack the `pixelate` post effect — it is a look, not the art axis.

## Relates to

- [scenes.md](scenes.md) — the frame lifecycle and whole-game structure.
- [draw.md](draw.md) — the verbs that draw into this world.
- [text.md](text.md) — the HUD surface in detail.
- [effects.md](effects.md) — `pixelate` and the rest of the post chain.

Signatures: engine/webgpu/game.d.ts.

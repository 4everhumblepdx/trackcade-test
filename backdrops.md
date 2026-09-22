# Backdrops — full-screen backgrounds as data

A backdrop is a shader background drawn BEHIND the world (and behind the
3D layer when one is active). Layers stack in add order and are
CAMERA-AWARE — starfields parallax against the scrolling foreground with
zero game code.

```ts
game.backdrop.add('sky', { curve: 1.4 });               // core, by name
const stars = game.backdrop.add('stars');               // stacked over it
stars.set('density', 1.6).setColor('tint', '#cfe0ff');   // retune live
game.backdrop.add(BACKDROP_PACK.aurora);                // pack = pure DATA
```

**Core** (by name): `sky` (two-colour gradient, `curve`), `stars`
(three-layer parallax starfield: `density`, `twinkle`, `drift`).
**BACKDROP_PACK** (imported, passed as data — the on-demand path):
`aurora`, `nebula`, `sunset`. New looks arrive as `BackdropDef` blocks —
request them by name.

## How do I…

**…give a night game a sky?** `game.backdrop.add('sky')` +
`game.backdrop.add('stars')` — two lines, done. The `background` colour only
shows where no backdrop covers.

**…recolour one?** Each def declares up to two colour slots —
`handle.setColor('top', '#20124a')`; scalars via `handle.set(name, v)`.

**…swap backdrops on a scene change?** Backdrops are game-level (they
survive transitions, like post effects): call `game.backdrop.clear()` and
re-add in the new scene's `setup()`.

**…combine with 3D?** Backdrops draw first inside the 3D pass — meshes,
fog and billboards render over them.

**…render a backdrop over an image?** `game.backdrop.background(img)` — a
canvas, image, bitmap or GPUTexture (or `null` to clear). The backdrops
draw OVER it, so an overlay effect (rain, fog, a colour wash) sits on your
title art, and a read-effect can sample the image below it. Full-cover
backdrops paint over it.

Traps: layers after an opaque one are wasted unless they carry alpha
(stars/aurora do; nebula/sunset/sky are opaque — put them FIRST). This is
the background layer, not post: for whole-screen colour grading use
`game.post`. And a custom `BackdropDef`'s `code` is WGSL — on the WebGL
fallback renderer a def without a `glsl` twin snippet (same variable scope,
GLSL ES 3.0) is skipped with one console warn; ship both dialects for
backdrops that must degrade gracefully (the built-ins all do).

## Relates to

- [effects.md](effects.md) — the same effects-as-data doctrine (post + deformers).
- [index.md](index.md) — the frame lifecycle.

Signatures: engine/webgpu/backdrop.d.ts.

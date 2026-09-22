# Effects — per-object fx, and the full-screen post chain

Three different tools — pick by WHAT the effect is attached to:

- **Per-OBJECT fx** — glow / outline / dissolve on a SINGLE sprite:
  `sprite.fx = { kind: 'glow' }`. Use for pickups, selection, spawn/despawn.
- **The POST chain** — full-screen passes over the finished frame:
  `game.post.add('bloom')`. Use for mood/look (retro, neon, underwater).
- **PARTICLES** — fire, smoke, sparks, explosions as things IN the world:
  `game.fx.emit({ ramp: 'fire' })`. **This is the one to reach for when you
  want "a fire effect"** — see [particles.md](particles.md). `game.fx` is
  particles; `game.post` is image processing. They are unrelated.

## Per-object fx (one sprite, everything else untouched)

`sprite.fx` is a STACKING BAG of modifiers (also per draw call via
`d.sprite(F, x, y, { fx })`):

```ts
sprite.fx = { glow: { color: '#ffd147', size: 20 } };        // soft halo
sprite.fx = { outline: { color: '#ffffff', size: 3 } };      // selection rim
sprite.fx = { flash: { color: '#ffffff', duration: 0.25 } }; // hit feedback — auto-clears
sprite.fx = { tint: { color: '#9eeaff', amount: 0.5 } };     // frozen/poisoned status look
sprite.fx = { tint: { colors: ['#ff6b9e', '#ffd147', '#4fa3ff', '#5cd9b3'] } }; // GRADIENT tint [TL,TR,BL,BR]
sprite.fx = { dissolve: { t: progress, seed: 3 } };          // 0 whole → 1 gone, burning edge
sprite.fx = { reveal: { t: progress } };                     // circular clip in
sprite.fx = { blur: { size: 6 } };                           // out-of-focus / stealth
sprite.fx = { pixelate: { size: 6 } };                       // this sprite only
sprite.fx = { wobble: { size: 3 } };                         // hologram ripple
sprite.fx = { glitch: { amount: 8 } };                       // slices + RGB split
sprite.fx = { shake: { amount: 4, duration: 0.4 } };         // CPU jitter — auto-clears
sprite.fx = { squash: { cycles: 1 } };                       // one-shot landing pop
sprite.fx = { glow: { color: '#9eeaff' }, tint: { color: '#9eeaff' } }; // they STACK
sprite.fx = undefined;                                       // back to normal
```

Rules: ONE uv distortion applies (pixelate >
glitch > wobble), ONE alpha gate (reveal > dissolve), glow/outline share the
halo slot, flash/tint share the colour slot — everything else stacks freely.
Timed fx (`flash`/`shake` with `duration`, `squash` with `cycles`) self-clear
on RETAINED sprites (the scene drives them); on the immediate verb path you
drive them yourself. Animate anything by reassigning per frame
(`glow.size: 20 + Math.sin(t * 3) * 8` pulses).

Trap: `dissolve` needs YOU to drive `t` (e.g. a death timer) — at `t: 1` the
sprite is invisible but still updates/collides until you `kill()` it. Its
pattern is scatter noise.

## The post chain (whole-screen looks)

The world (2D + 3D + particles) renders offscreen, each active effect runs
as a full-screen pass in ADD ORDER, and the HUD stays crisp on top.

```ts
game.post.add('bloom');                          // glows leak light
game.post.add('vignette', { strength: 0.35 });   // darkened corners
const px = game.post.add('pixelate', { size: 5 });
px.set('size', 8);                           // retune live, zero cost
px.remove();                                 // drop it
game.post.clear();                            // drop everything
```

## Core effects vs on-demand effects

The engine bundles only THREE core post effects (requested by name):

| name | params (defaults) | look |
|---|---|---|
| `pixelate` | size 4 | chunky screen-space pixels |
| `bloom` | threshold 0.55, strength 0.9, radius 2.5 | bright areas glow |
| `vignette` | strength 0.45 | darkened corners |

Everything else is DATA delivered on demand: an `EffectDef` object passed to
the same call. Fetch effect blocks from the content library and hand them
over verbatim — no engine involvement:

```ts
game.post.add(effectBlockFromLibrary, { curve: 0.2 });   // an EffectDef object
```

(The engine repo carries a sample pack — CRT, scanlines, posterize,
grayscale, wave, chroma — as `EFFECT_PACK` in the bundle for testing; treat
it as a preview of library blocks, not core surface.)

## How do I…

**…make a pickup irresistible?** `coin.fx = { kind: 'glow', color: '#ffd147', size: 8 }`
— per-object, pulsing if you animate `size`.

**…show which unit is selected?** `unit.fx = { kind: 'outline', color: '#ffffff' }`,
clear it on deselect.

**…despawn something dramatically?** Drive a dissolve over ~0.5s, then
`kill()`: `s.fx = { kind: 'dissolve', t: timer / 0.5 }`.

**…make the whole scene glow (neon/magic)?** `game.post.add('bloom')` + draw the
glowing things bright (white-ish cores, additive particles). Bloom picks up
anything over `threshold`.

**…animate a post effect?** Keep the handle and `set()` per frame — params
are uniforms, free to change.

**…apply post effects to the HUD too?** `game.hudAboveFx = false` — by
default the HUD draws AFTER the chain (crisp score over a blurry world).

**Effects are DATA** — you pick one by name and set its params. If a look you
need has no core effect and no library block, compose it from the effects that
exist and note the gap in the build notes.

## The snippet contract (for effect AUTHORS, not game builders)

`code` runs inside the template's fragment stage with: `uv` (0..1), `time`
(seconds), `texel` (1/resolution), declared params by name, `tex(p)` to
sample the source frame, and must leave its result in `color` (vec4f,
premultiplied). Max 8 params. Trap: WGSL forbids swizzle assignment — assign the
whole vector: `color = vec4f(color.rgb * k, color.a)`.

**The WebGL twin.** `code` is WGSL; on the WebGL fallback renderer a def
without a `glsl` field (the same snippet in GLSL ES 3.0 — identical variable
scope, `vec4f`→`vec4` etc.) is SKIPPED with one console warn. Ship both
dialects on any def that must degrade gracefully; the core effects all do.

## Relates to

- [particles.md](particles.md) — additive particles + bloom is the signature combo.
- [text.md](text.md) — the HUD pass that rides above the chain.

Signatures: engine/webgpu/post.d.ts, engine/webgpu/effects.d.ts, engine/webgpu/game.d.ts.

The same data-delivery shape exists for VERTEX-stage effects: custom
sprite deformers are `DeformDef`s registered with `game.assets.deformer(def)` —
see draw.md's deformer entries.

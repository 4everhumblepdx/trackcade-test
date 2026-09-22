# Object VFX — trails & bursts as data

A VFX happens TO or BECAUSE OF an object but extends far beyond its
bounds: trails streaming behind things, shockwaves and hit-sparks popping
where something landed. A `VfxDef` is pure data over two primitives:

- **trail** — continuous: a fading, tapering ribbon built from position
  history (width, life, colour gradient, additive).
- **burst** — one-shot: a timed recipe of layers — particle emits,
  expanding rings, flash discs (each with an optional `delay`).

```ts
sprite.vfx = 'flameTrail';                    // streams from the centre;
                                              // clearing (or death) fades it out
const t = this.vfx.trail('sparkTrail');       // manual — verb-mode movers
t.point(x, y);                                // feed each frame; t.release() to end

this.vfx.burst('shockwave', x, y);            // one-shot at a point
this.vfx.burst('hitSpark', x, y, { angle });  // directional recipes

registerVfx({ name: 'voidTrail', trail: { width: 18, colors: [...] } });
```

**Core** (deliberately tiny): `trail`, `impact`. **VFX_PACK** (data):
`flameTrail`, `sparkTrail`, `smokeTrail`, `rainbowTrail`, `lightTrail`,
`emberTrail` (sheds sparks), `stormTrail` (crackles), `shockwave`,
`hitSpark`. New looks arrive as `VfxDef` blocks — request by name.

**Trails can SHED PARTICLES along their laid path**: `trail.sparks = { per,
speed, life, size, ramp, gravity, drag, twinkle }` drops particles
ARC-SPACED per world unit of head travel (never per frame), at the exact
crossing points — embers land where the object flew and stay there. Works
in 2D (rides `game.fx`) and 3D (rides `world.fx`). `'emberTrail'` is the
pack reference.

**The SAME trail defs work in 3D**: `world.trail('flameTrail', { follow:
mesh })` renders the def as a true-3D ribbon (Catmull-Rom smoothed,
view-facing, noise-eroded tail). Trail defs may carry 3D-only knobs —
`turbulence` (tail flutter, world units), `erode` (0..1 tail shredding),
`core` (0..1 white-hot centre), `fiber`/`hard` (texture/edge character) and
`crackle` (0..1 — a sparkler of tiny flickering points inside the ribbon —
`'stormTrail'`)
— which the 2D ribbon ignores. Bursts work in 3D too: `world.burst(name,
x, y, z)`. See [particles3d.md](particles3d.md).

## How do I…

**…give the player's dash a trail?** `sprite.vfx = 'sparkTrail'` while
dashing, `sprite.vfx = undefined` after — the ribbon fades out on its own.

**…explode on hit?** In the collision callback:
`this.vfx.burst('impact', coin.centerX, coin.centerY)`.

**…knock-back flourish?** A directional burst:
`this.vfx.burst('hitSpark', x, y, { angle: hitAngle })` — the recipe's
emits rotate with it (pair with a velocity kick in gameplay code).

**…design a new one?** Compose data: a burst is `[{ flash }, { ring,
delay }, { emit }]`; a trail is width/life/colors/add. No code, no WGSL.

Trails draw UNDER the sprites (streaming behind the body); burst rings and
flashes pop OVER the world; burst particles ride the particle system.
Everything dies with the scene. `sprite.fx` (glow/outline/dissolve) styles
the sprite's OWN pixels — `sprite.vfx` paints the world around it; they
compose.

## Relates to

- [effects.md](effects.md) / [backdrops.md](backdrops.md) — the sibling effects-as-data families.
- [particles.md](particles.md) — the system burst emits ride on.

Signatures: engine/webgpu/vfx.d.ts.

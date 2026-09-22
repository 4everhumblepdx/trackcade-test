# Particles & juice — fx, shake, flash

`game.fx` is the particle system: pooled, zero instance management. One verb:

```ts
game.fx.emit({ x, y, count: 40, speed: 150, colors: ['#ffd147', '#ff5533'], add: true });
```

An explosion is one `emit()`. A stream (fountain, exhaust, rain) is a small
`emit()` **every frame** — particles are pooled, this is the intended pattern.

## Where particles draw

Particles are ordinary display-list content: they land where you draw them. Name
an emitter with `group`, then draw it at the point in the scene it belongs —
that is how an exhaust plume gets BEHIND its ship:

```ts
emit({ x, y, group: 'exhaust', … });          // in update()

override draw(d: Draw): void {                 // in draw()
  super.draw(d);
  this.game.fx.draw(d, 'exhaust');            // …behind the ship
  d.sprite(shipFrame, x, y);
  this.game.fx.draw(d, 'sparks');             // …and in front of it
}
```

Anything you do NOT place this way draws after the scene, as it always has — so
a game that never names a group is unaffected. A group is remembered for the
rest of the frame, so it cannot draw twice.

## EmitOptions (all optional except x/y)

- `count` (12) — particles in the burst
- `speed` (90) ± `speedVar` (40) — initial speed. **`speedVar: 0` = a clean ring.**
- `angle` (0, radians clockwise) ± `spread`/2 (default full circle) — direction
- `even` (false) — space angles EVENLY across the spread (a perfect ring/fan)
- `spawnRadius` (0) — jitter the spawn point within this radius (area emits)
- `life` (0.7) ± `lifeVar` (0.3) — seconds
- `size` (4) ± `sizeVar` (2); `shrink` (true) — true = shrink to nothing,
  false = none, or a NUMBER = the final size fraction (0.5 = half;
  **>1 GROWS** — billowing smoke is `shrink: 2.5`)
- `fade` (true) — alpha out over life; `alpha` (1) — whole-emit multiplier
- `gravity` (0) — downward accel; **negative = embers rising**
- `drag` (0) — velocity damping /s
- `sway` (0) — smooth side-to-side wander accel (snow, petals, embers);
  `swayFreq` (1.5) cycles/s
- `color` / `colors: []` — hex; a palette is picked per particle
- `ramp` — a colour walked over EACH particle's life: a name (`'fire'`,
  `'spark'`, `'ember'`, `'smoke'`, `'ice'`, `'magic'`, `'toxic'`, `'rainbow'`)
  or custom hex stops `['#fff', '#f80', '#500']`. Overrides color/colors —
  the single biggest upgrade for fire/smoke/magic
- `twinkle` (0) — per-particle brightness flicker 0..1 (fireflies, dust)
- `add` (false) — **additive blend: light accumulates. Use for fire, sparks,
  magic, glows — this is the eye-candy switch**
- `frame` — draw an atlas frame instead of a disc (debris, petals); `spin` (0)
  — random ±rad/s, visible with frames

## Make it beautiful: TEXTURED particles

Bare discs read as "emitting circles" — a particle system reads as gorgeous
when it's a **textured shape × colour tint × size variance × spin × fade**.
The classic textures generate at load, no files:

```ts
import { particleCanvas } from '../engine/webgpu.js';
const SOFT = game.assets.frames(particleCanvas({ kind: 'soft' }));   // radial glow puff
const STAR = game.assets.frames(particleCanvas({ kind: 'star' }));   // star in a glow
game.fx.emit({ x, y, frame: SOFT, ramp: 'fire', add: true, sizeVar: 3, spin: 2 });
```

Kinds: `soft` (the canonical radial glow), `flare` (glow + streak cross),
`ring` (halo band), `star` (`points` option), `spark` (thin streak),
`petal` (a sakura petal with the notched tip — pair with `spin`, pink
tints, and in 3D the GPU emitter's `flutter`/`tumble`). All painted WHITE
— `color`/`colors`/`ramp` tint per particle. Real PNG packs work the same
via `game.assets.loadFrames()`.

## How do I…

**…an explosion with punch?** Layer 2–3 emits + camera + flash:

```ts
game.fx.emit({ x, y, count: 80, speed: 160, colors: ['#ffd147', '#ff5533'], add: true, drag: 2 });
game.fx.emit({ x, y, count: 20, frame: DEBRIS, spin: 12, gravity: 400, speed: 120 });
game.camera.shake(7, 0.35);
game.camera.flash('#fff3d0', 0.15);
```

**…a pickup sparkle?** `game.fx.emit({ x, y, count: 14, speed: 70, life: 0.45, size: 2.5, colors: ['#ffd147', '#fff2b0'], add: true })`

**…proper fire?** A per-frame stream walking the fire ramp:
`game.fx.emit({ x, y, count: 3, angle: -Math.PI / 2, spread: 0.5, spawnRadius: 8, ramp: 'fire', add: true, gravity: -120, drag: 0.6 })`

**…snow / falling petals?** `sway` + slow gravity, no shrink:
`{ count: 1, spawnRadius: 200, speed: 4, gravity: 25, sway: 30, twinkle: 0.4, shrink: false, life: 6 }` per frame from high up.

**…particles in the 3D world?** `world.fx.emit({ x, y, z, ... })` — the same
option surface (plus `dir`/cone `spread`, `box`/`ring` spawn shapes) on the
world3d layer. See [particles3d.md](particles3d.md).

**…SIX FIGURES of particles?** `world.emitter({ ... })` — the GPU-compute
tier (3D only): a persistent pool of up to hundreds of thousands, simulated
entirely on the GPU with forces-as-data (curl noise, attract, vortex, orbit),
depth-buffer collision and soft particles. `world.fx` for bursts and small
streams; an emitter when the COUNT is the effect. See
[particles3d.md](particles3d.md) § GPU emitters.

**…a directed jet (exhaust, waterfall)?** `angle` + a small `spread`:
`{ angle: -Math.PI / 2, spread: 0.5, gravity: 300 }` — up, then arcing down.

**…screen shake / hit flash?** `game.camera.shake(power, duration)` (decaying
jitter; camera x/y stay clean) and `game.camera.flash(color, duration)` (full-screen
fade-out drawn over the HUD).

Trap: `add: true` never darkens — dense additive particles bloom to white
(that's the look). Anything that should OCCLUDE (smoke, chunks) needs
`add: false`. Trap: a per-frame stream emit in the run() callback scales with
the display's refresh rate (a 120 Hz screen emits 2× the particles) — fine for
pure decoration, but for a consistent rate emit from `game.onStep(...)`
(fixed 60 Hz) instead.

## Relates to

- [draw.md](draw.md) — one-off shapes; particles are for the animated many.
- [sprites.md](sprites.md) — the camera being shaken.

Signatures: engine/webgpu/particles.d.ts, engine/webgpu/camera.d.ts, engine/webgpu/game.d.ts.

# Underwater — being BELOW the water, not just under the shader

Everything here lives ON the 3D world and PAIRS with a water body: get the
world (`const world = await game.world3d()`), make a sea/lake/pool
([sky-water3d.md](sky-water3d.md)), then turn one dial on. Byte-free until you
call it — 2D games and 3D games that never dive pay nothing.

## How do I…

**…make it FEEL underwater?** `const uw = world.underwater({ water: sea })`.
From then on, when the camera drops below the surface the whole world responds:
light is absorbed per-channel (red dies first, the murk closes in), a soft
vignette gathers at the edges, the seabed dapples with **caustics**, and the
water surface seen from below becomes a bright **Snell's window** ringed by
total-internal-reflection murk. Surfacing restores the game's own fog exactly.
Pass no `water:` and it binds the first grid water automatically.

**…pick the LOOK?** One `preset:` fills everything — `'reef'` (default, bright
tropical shallows), `'ocean'` (deeper, bluer), `'pool'` (clear, strong window),
`'murk'` (thick green-grey, the submersible/beams setting). Every knob
overrides the preset and is **live-mutable** on the handle:

```ts
const uw = world.underwater({
  water: sea,
  preset: 'reef',
  sigma: [0.35, 0.07, 0.03],   // per-channel view extinction (murk closing in)
  sunSigma: [0.12, 0.045, 0.02], // downwelling sun-fade
  waterColor: '#1a6f8f',       // in-scatter murk colour
  clarity: 1,                  // 0..1 master σ scale (crystal → as authored)
  maxView: 70,                 // artistic far clamp
  caustics: { strength: 1, scale: 6, speed: 1, rgbSplit: 0.0035, maxDepth: 20 },
  snell: true,                 // surface-from-below window
  rays: true,                  // underwater god-ray shafts (see below)
  vignette: 0.25,
  grade: 0.6,
  wobble: 0,                   // screen wobble — off; clamped ≤ 0.003 (nausea rule)
});
uw.setPreset('murk');          // swap the whole optics live
uw.sigma[0] = 0.5;             // or nudge one channel
```

**…the god-ray SHAFTS (the ABZU light wall)?** On by default with `rays`: a
camera-following ring of thin, pale, flickering light beams at a fixed
distance — a "wall" of light that spans the view and stays just out of reach,
leaning along the refracted sun. It reaches from the waves down, fades before
the seabed, thins in the shallows, and fades away in deep water. Live-tune on
the handle (or `rays: { intensity }`):

```ts
uw.rayStrength = 0.8;   // brightness (pale is the ABZU look)
uw.rayGap     = 12;     // arc packing — smaller = more, tighter beams
uw.rayNear    = 40;     // the wall's distance from the camera
uw.rayFlicker = 0.7;    // fade-in/out speed (0 = steady, 2 = frantic)
uw.rayBand    = 0;      // how far below the surface the tops start
uw.rays       = false;  // off entirely
```

The wall auto-fades with camera depth, sun height (none at night) and storm.
Best at a low afternoon sun. `world.rays()` is the separate ABOVE-water
god-ray pass — leave both on; the engine crossfades them at the surface.

**…keep a PUDDLE from going underwater?** It won't. `minDepth` (default 0.75
world units) is the guard: a body whose seabed under the camera is shallower
than this never activates. Pass the water's `ground:` fn (you already do for
shorelines) so the guard knows the depth.

**…read the state / drive it from gameplay?** `uw.submerged` (bool),
`uw.depth` (camera depth below the surface), `uw.active` (the composite is
running — true just above the line too, for the clean half-in/half-out split).
`enable: 'auto'` (default) uses the wave-height test; `enable: true|false`
forces it (cutscenes).

**…get the "shimmering across the sand" from ABOVE the water?** Free — caustics
are gated on the body + sun, not on the camera being under. Fly over a reef and
the sand dapples through the surface; dive and it dapples around you. They fade
to zero by `caustics.maxDepth`, respect the shadow map (gone under a dock/boat),
turn golden at sunset, vanish at night, and storm damps + speeds them. Only
up-facing geometry receives them.

**…light the murk with a submersible headlight?** No new API — a spotlight beam
already does it: `world.light({ type: 'spot', beam: true, ... })` renders a
volumetric cone (see [world3d.md](world3d.md)). Underwater it composes for
free: the beam is additive, so in `murk` fog it fades to nothing at range —
a headlight boring a short cone through gloom.

**…add bubbles / a scuba stream / fish?** Those are content, not this feature:
a slow `world.emitter()` with an upward accel + curl wobble sells rising
bubbles ([particles3d.md](particles3d.md)); fish/shoals are the agents system
([agents.md](agents.md)).

## Traps

- **Pass the water's `ground:`** (`terrain.heightAt`) for exact shoaling AND
  the puddle guard's depth test. Without it the guard assumes deep water.
- **No screen wobble by default.** Whole-screen distortion is a
  motion-sickness trigger; `wobble` is clamped ≤ 0.003 uv even when on. Do the
  chromatic flavour with `caustics.rgbSplit`.
- **`maxView` is safe**: the camera far-plane follows the GAME's fog, so a
  small `maxView` fades distant meshes without clipping them.
- **Remove any screen-veil overlay the game drew before adopting this** (e.g.
  a fullscreen `hud.rect` tint while the camera is under) — it sits on top of
  the real composite and no optics dial will change it.

## Relates to

- [sky-water3d.md](sky-water3d.md) — the water body this rides on and the sky
  that drives the sun/storm it responds to.
- [terrain3d.md](terrain3d.md) — the seabed that shoals the water and receives
  the caustics; pass its `heightAt` as the water `ground:`.
- [world3d.md](world3d.md) — the world, camera, fog, spotlight beams (sub
  headlights) and god rays (`world.rays`) it composes with.

Signatures: engine/webgpu/underwater3d.d.ts

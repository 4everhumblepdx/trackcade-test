# 2D lighting — atmosphere & eye-candy

`game.lights2d` is a real 2D LIGHT layer: additive **point** and **spot** lights
with soft radial/cone falloff, colour mixing, candle **flicker**, and **hard
shadows** off scenery (opt-in). It's a GPU pass built into the engine (created on
first access — games that don't light it pay nothing), works over SDF shapes AND
PNG sprites, and it **scales**: lights are cheap additive glows, culled when
off-screen, so a world can hold **thousands**. Pair with `game.post.add('bloom')` for
the glow.

Names don't clash with the 3D lights (`world.light` / `Light3d`) — this is
`game.lights2d`, handles are `Light2d`.

## Two kinds of light: cheap glow vs. shadow-caster

By DEFAULT a light is a cheap **radial glow** — no per-light raycast, culled when
its reach circle leaves the view. That's the path for atmosphere at scale
(thousands of torches/embers/pickups). A light casts **shadows** only when you
ask (`shadows: true`) — that runs the per-light visibility polygon, and
`softness` (world units) gives a SOFT penumbra by sampling the light as a small
disc. Shadow-casting costs more per light, but the layer **only computes the
lights visible to the camera** — so you can define as many shadow lamps as you
like (a whole map of them); the per-frame cost is bounded by the on-screen few.

```ts
lights.point(x, y, { radius: 120, color: [1, 0.6, 0.2] });                            // cheap glow — thousands OK
lights.point(x, y, { radius: 400, color: [1, 1, 0.9], shadows: true });               // SOFT shadows (softness 6 default)
lights.point(x, y, { radius: 400, color: [1, 1, 0.9], shadows: true, softness: 0 });  // razor-hard shadows
```
`lights.visible` reports how many survived culling this frame (for a HUD).
Occluders are `lights.occluders` (a `Visibility2d`); for MOVING casters, clear
and re-add them each frame — the occluder set is culled per light, so many
lamps × many props stays cheap.

For the radiance/bloom look, add the bloom post once: `game.post.add('bloom')`.

## The model — ambient base, then add light

Set an **`ambient`** base colour and the layer multiplies your scene down to it,
then the lights ADD on top — brighter where lit, dim (never pure black) where
not. So you draw the scene at full brightness and let the lighting do the mood:

```ts
const lights = game.lights2d;
lights.ambient = [0.12, 0.12, 0.18];         // dim blue night — unlit surfaces show DIMLY
lights.occluders.addRect(x, y, w, h);        // scenery casts shadow (Visibility2d)
const torch = lights.point(300, 400, { radius: 260, color: [1, 0.65, 0.3], flicker: 0.4 });

game.run((d) => {
  d.rect(0, 0, game.view.w, game.view.h, '#4a4d5e');   // a floor (ambient lifts it to a dim base)
  d.sprite(F_CRATE, cx, cy);                            // draw the scene at full brightness
  torch.x = player.x; torch.y = player.y;               // just move the light — the layer does the rest
});
```
`ambient` is `[r,g,b]` 0..1: `[1,1,1]` (default) = no darkening, `[0,0,0]` = black
unlit, `[0.12,…]` = a dim base. Tint it (warm dusk, cool night). It MULTIPLIES,
so it lifts whatever you drew — unlit areas over a black background stay black;
draw a floor/tiles and ambient shows them dimly. Overlapping light colours **mix**
(additive); shadows are exact — each light only illuminates its visibility polygon.

## Height: floor lights vs. overhead lights (`layer`)

Every light has a `layer` that decides its compositing HEIGHT:

- **`'over'` (default)** — sits ABOVE the scene, drawn after everything, so it
  additively **covers the sprites** (an overhead street lamp brightening a
  character below it, atmospheric room light).
- **`'under'`** — lights the **FLOOR BENEATH the sprites**, drawn *before* them.
  The opaque sprites occlude it, so their pixels are **never tinted** — the glow
  only shows on the floor around/between them.

```ts
lights.point(paddle.x, paddle.y, { radius: 150, layer: 'under' });   // glow the floor under the paddle
lights.point(lamp.x,   lamp.y,   { radius: 300, layer: 'over'  });   // overhead lamp covers sprites below
```
Breakout-style accent glows (a light per paddle/ball/brick that lights the
playfield without touching the pieces) → `layer: 'under'`. A top-down torch the
player carries, or a side-on street lamp shining down onto actors → `layer:
'over'`.

## How do I…

**…add lights?** `point()` and `spot()` return a live handle you mutate:

```ts
const lamp  = lights.point(x, y, { radius: 340, color: [0.5, 0.7, 1], intensity: 1, falloff: 1.6 });
const torch = lights.point(x, y, { radius: 240, color: [1, 0.6, 0.25], flicker: 0.5, flickerSpeed: 1.4 });
const beam  = lights.spot(x, y, { radius: 460, dir: Math.PI / 2, cone: 0.7, color: [1, 0.95, 0.8] });
lamp.x = player.x; lamp.y = player.y;        // move it · lamp.on = false to hide · lights.remove(lamp)
```

**…point a light (flashlight / searchlight)?** A `spot` — `dir` (radians) aims it,
`cone` is the full angle. Add `shadows: true` for a directional soft-shadow cone;
mutate `dir` to sweep it:

```ts
const torchlight = lights.spot(player.x, player.y, { radius: 500, cone: 0.6, dir: aim, shadows: true, softness: 8 });
// each frame: torchlight.x = player.x; torchlight.y = player.y; torchlight.dir = aim;
```

**…have a WHOLE MAP of shadow-casting lamps?** Just define them all — the layer
**culls to the camera**: a light is only computed when its reach circle touches
the view (its `radius` is the padding), so hundreds/thousands of shadow lamps
cost only the on-screen dozen. `lights.visible` / `lights.visibleShadow` report
what was actually drawn / shadow-computed this frame.
`radius` = reach; `falloff` = softness (1 ≈ linear, higher = tighter core);
`dir`/`cone` (radians) aim a spot; `flicker` (0..1) + `flickerSpeed` give a
candle wobble; `color` is `[r,g,b]` 0..1.

**…make scenery cast shadows?** Add occluders to `lights.occluders` (a
`Visibility2d`): `addRect` / `addSegment` / `addPoly`. Rebuild them when the
scene changes (moving crates → `occluders.clear()` then re-add each frame):

```ts
lights.occluders.clear();
for (const crate of crates) lights.occluders.addRect(crate.x, crate.y, crate.w, crate.h);
```
Shadows terminate at the visible window automatically. See [visibility2d.md](visibility2d.md).

**…light PNG sprites?** Same as shapes — draw the sprite, dim, and the light
adds over it. Register the sprite's bounds as an occluder so it casts a shadow.
(The light is a screen-space add, so a flat sprite lights uniformly.)

**…tune the mood?** The darkening overlay's alpha is your ambient level (0 =
full bright, 0.9 = deep gloom). Warmer/cooler ambient = tint the overlay colour.

## Relates to

- [visibility2d.md](visibility2d.md) — the occluder/shadow geometry the lights use.
- [draw.md](draw.md) — draw the scene + the ambient overlay.
- [world3d.md](world3d.md) — the separate 3D lighting (`world.light`).

Signatures: engine/webgpu/lights2d.d.ts.

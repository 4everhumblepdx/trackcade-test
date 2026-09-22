# Sprites, animation, collision & camera — the retained layer

The scene is a FLAT list of sprites (no hierarchy, no display tree): add
sprites, declare collision rules, follow one with the camera. The scene
updates and draws itself every frame, UNDER whatever your `run()` callback
draws.

**The config rule: a sprite's looks and physics are DATA (the config object);
code adds only behaviour** (an `update()` override). Animations are `{ time,
seq }` data — declare them and the engine runs the loop.

```ts
import { Game, Sprite } from '../engine/webgpu.js';

const game = await Game.create();   // worldHeight defaults to 768
const HERO = game.assets.frames(heroCanvas, 16);   // 4-frame strip

class Player extends Sprite {
  constructor() {
    super({
      frames: HERO, x: 40, y: 180,
      anims: { idle: { time: 0.4, seq: [0] }, walk: { time: 0.11, seq: [0, 1, 2, 3] } },
    });
  }
  override update(dt: number): void {
    this.vel.x = game.input.key('ArrowLeft') ? -150 : game.input.key('ArrowRight') ? 150 : 0;
    this.play(this.vel.x ? 'walk' : 'idle');
    this.flipX = this.vel.x < 0 || (this.vel.x === 0 && this.flipX);
    if (this.touching.down && game.input.key('Space')) this.vel.y = -400;
  }
}

class Wall extends Sprite {}
game.scene.gravity = 1000;
game.scene.add(new Wall({ x: 0, y: 250, w: 600, h: 20, body: 'static', tint: '#46608c' }));
const player = game.scene.add(new Player());
game.scene.solid(Player, Wall);
game.camera.follow(player);
game.run();
```

## Bodies

| `body` | moves | collides | for |
|---|---|---|---|
| `'dynamic'` (default) | velocity + scene gravity | yes | players, enemies, crates |
| `'static'` | never | yes (immovable) | floors, walls, platforms |
| `'none'` | you (write x/y) | overlap callbacks only | pickups, decor, ghosts |

## Physics (scene.physics)

Every scene owns an arcade `physics` system. Dynamic bodies integrate
`vel` + `acceleration` − `friction`, clamped to `maxVelocity`, under
`scene.gravity` × the sprite's `gravity` factor. Extra body config:

- `body: 'kinematic'` — scripted motion (own velocity/friction, no gravity
  or effectors, immovable in solids — moving platforms CARRY riders);
  `'sensor'` — overlap callbacks only.
- `collideWorldBounds: true` — hard-clamped inside
  `scene.physics.worldBounds` (default: the view); sets `touching`.
- `bounceEdges: { top: true, left: true, right: true }` — per-edge
  reflection with `bounce` restitution (a Breakout ball, open floor).

Force fields: `scene.physics.effectors.push(new WindEffector({...}))` —
wind, conveyors, gravity wells, buoyancy/water; they act on dynamic bodies
only. Joints: `scene.physics.addJoint(new RopeJoint(sprite, anchor, len))`
— ropes, rods, pins between sprites or points; solved before collision.
Fast movers are swept (CCD) so bullets can't tunnel — `physics.continuous
= false` to force cheap discrete checks.

## Full-body physics — Physics2d (optional, lazy)

For physics-strenuous games (stacks, ragdolls, dominoes, vehicles) the
arcade solver isn't enough — bind sprites to a real Box2D world. The core
is a separate ~640 KB chunk loaded ONLY when you call create():

```ts
override async preload(): Promise<void> {
  this.physics2d = await Physics2d.create({ gravity: 900 });
}
override setup(): void {
  this.physics2d!.bind(ground, { type: 'static' });
  const crate = this.physics2d!.bind(crateSprite, { bounce: 0.2, friction: 0.6 });
  crate.impulse({ x: 0, y: -400 });
}
```

The scene steps + syncs bound sprites automatically; bound sprites skip
the arcade integrator. Steer with impulse/force/velocity, and `teleport` for a
hard move. See [physics2d.md](physics2d.md) for the whole of it — joints
(pin/rope/slider/weld/wheel + motors), collision groups vs families, raycasts,
triggers, grabs, explosions and debug draw.

## The two collision verbs

- `scene.solid(A, B)` — instances can never pass through each other. Sets
  `sprite.touching.{up,down,left,right}` and kills velocity into the contact
  (`bounce` in the config for restitution).
- `scene.on(A, B, (a, b) => …)` — overlap callback every frame they overlap
  (pickups, bullets, hits). It does NOT separate them.

Trap: pushable crates need `solid(Crate, Crate)` too — rules are per class
PAIR, nothing is implicit. Trap: `on` fires EVERY overlapping frame — `kill()`
the target or gate with a flag if you want once.

## How do I…

**…animate a sprite?** Declare `anims` in the config, switch with `play()`:
`this.play('walk')` is a no-op if already playing (safe to call every frame).
A one-shot: `{ time: 0.08, seq: [4, 5, 6], once: true }` — check `animDone`.

**…tile / scroll a sprite's texture (moving platform belt, long wall)?**
`uvRepeat: { x: n }` tiles the frame n times across the width; mutate
`sprite.uvScroll.x` per frame to scroll it (frame fractions — see draw.md's
tiling entry). One retained sprite = one instance, however long the wall.

**…place a sprite at a fraction of the screen?** Percentage strings in the
config — resolved ONCE against the view when the sprite is `add()`ed, then
it's plain world units (physics and all):

```ts
game.scene.add(new Sprite({ x: '75%', y: '20%' }));          // placement
game.scene.add(new Wall({ x: 0, y: '90%', w: '100%', h: 24, body: 'static' }));
```
For immediate-mode verbs use `game.vw(f)` / `game.vh(f)` instead. Trap: '%'
is placement sugar, not a live anchor — the sprite does NOT re-pin itself
when the window resizes.

**…jump only when standing?** `if (this.touching.down && game.input.key('Space')) this.vel.y = -400;`
`touching` is set by `solid()` — no rule, no flags.

**…remove a sprite?** `sprite.kill()` — swept at the end of the update, safe
to call inside collision callbacks.

**…make a patrol enemy turn at walls?** In `update()`: `if (this.touching.left) this.dir = 1;`
— walls flip it for free via the solid rule.

**…scroll the level?** `game.camera.follow(player)` +
`game.camera.bounds = { x: 0, y: 0, w: LEVEL_W, h: LEVEL_H }`. The camera is
the view's top-left; `follow` centres the sprite with smoothing
(`{ lerp: 12 }` snappier, `{ lerp: 0 }` locked).

**…draw a HUD that doesn't scroll?** Draw through `game.hud` — screen space,
camera-proof, always on top. See [text.md](text.md).

**…put something in front / behind?** Scene order is paint order (later add =
in front); set `z` in the config to override. The run() callback always draws
on top of the scene.

**…read the keyboard?** `game.input.key('ArrowLeft', 'KeyA')` — true while any
listed KeyboardEvent.code is held. `game.input.keys` is the raw held-set.

## Relates to

- [draw.md](draw.md) — the immediate-mode verbs the scene draws through.
- [index.md](index.md) — the layout model and frame lifecycle.

Signatures: engine/webgpu/sprite.d.ts, engine/webgpu/scene.d.ts, engine/webgpu/camera.d.ts, engine/webgpu/game.d.ts.

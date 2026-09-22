# Scenes — title / play / gameOver, the shape of a whole game

A **Scene is a game state**: Title, Play, GameOver, a shop, a level select.
Register a roster of Scene classes and transition between them — each
transition drops the old scene WHOLE (its sprites, camera and collision
rules die with it, no manual cleanup) and builds the next via `setup(data)`.

```ts
class Play extends Scene {
  score = 0;
  override setup(): void {                    // build the world (once)
    this.add(new Player());
    this.on(Player, Coin, (p, c) => { c.kill(); this.score++; });
    if (won) this.gotoGameOver({ win: true, score: this.score });
  }
  override update(dt: number): void {         // per-frame logic
    super.update(dt);                         // ← REQUIRED: advances sprites/physics
    /* spawn, check win/lose… */
  }
  override draw(d: Draw): void {              // world-space extras
    d.sprite(BACKDROP, 0, 0, { w: this.width, h: 200 });
    super.draw(d);                            // ← draws the scene's sprites
  }
  override drawHud(d: Draw): void {           // screen-space UI
    d.text(font, `SCORE ${this.score}`, 12, 12, { color: '#ffd147' });
  }
}

const game = await Game.create({ scenes: { title: Title, play: Play, gameOver: GameOver } });
// load frames/fonts here — setup() runs at game.run(), so they're ready
game.run();
```

## The frame lifecycle

1. `game.onStep(fn)` callbacks run at the fixed simulation step (default
   60 Hz; `fixedStep` option) — **physics and simulations go here**, where
   bursty dt can't destabilise them.
2. The `run(frame)` callback runs once per display frame (dt capped at 50 ms)
   — game logic + drawing with the verbs.
3. Everything pushed is rendered in submission order: draw order = call order.

## Transitions

`this.gotoPlay()`, `this.gotoTitle()`, `this.gotoGameOver(result)`,
`this.gotoIntro()` — or any custom role via `this.game.go('shop', data)`.
The payload arrives as the target scene's `setup(data)` argument.

Boot order: `intro` → `title` → `play` (first registered role wins).
**A bare `{ play }` roster is a complete game**: built-in fallback Title
("PRESS SPACE TO START") and GameOver ("YOU WIN!/GAME OVER" from
`{ win }` in the payload) cover the missing roles as goto targets.

## What a scene owns (common access)

- `this.add / this.solid / this.on / this.gravity` — the sprite world
- `this.camera` — per scene; a shaking Play camera never leaks into GameOver
- `this.getSpritesByType(Coin)` — live instances of a class
- `this.vw(f)` / `this.vh(f)` / `this.width` / `this.height` /
  `this.centerX` / `this.centerY` — view-relative layout
- `this.tween` — animate any property: `this.tween.to(sprite, { x: 200 }, { duration: 0.4 })`
- `this.sound` — synthesised SFX/jingles + music: `this.sound.play({ type: 'sine', freq: 880 })`
- `this.game` — the engine services (`assets`, `fx`, `post`, `backdrop`, `go`…)

## Loading assets — preload()

Declare assets in `preload(load)`; the engine loads them behind a progress
bar (skipped entirely when everything's already cached), THEN calls
`setup()`, where `game.assets.framesOf(url, frameW?, frameH?)` registers frames
synchronously:

```ts
class Play extends Scene {
  override preload(load: Preload): void {
    load.image('./assets/coin-16x16x4.png');   // also: load.json / load.text /
    load.audio('./sfx/hit.mp3');               // load.binary / load.msdfFont
    load.glb('./models/ship.glb');             // 3D models: load.glb / load.obj
    load.font('Orbitron', './fonts/orbitron.woff2');   // web fonts — see text.md
  }
  override async setup(): Promise<void> {
    const COIN = this.game.assets.framesOf('./assets/coin-16x16x4.png', 16);
    const ship = await (await this.game.world3d()).loadGlb('./models/ship.glb');
  }
}
```

`load.glb(url)` / `load.obj(url)` fetch + parse + decode a model's textures on
the loading bar (no World3d needed — data only). `world.loadGlb(url)` /
`loadObj(url)` in `setup()` then build the live model from that cache — an
instant hit. Declare in preload, BUILD in setup: game objects (and the world
itself) are created in `setup()`. See `world3d.md`.

Everything a scene needs goes in the queue — images, audio, JSON, models, MSDF
pairs, web fonts. `setup()` runs after every one has settled.

Re-declaring an already-loaded asset is FREE (no loading screen) — load
everything in the first scene, re-declare defensively in later ones.
Custom loading bar: `Game.create({ drawLoading: (d, progress) => ... })`.
The async path also works without scenes: `await game.assets.loadFrames(url)`.

## Typed input

Bind named actions in `setup()`; read edge/held state anywhere:

```ts
override setup(): void {
  const keys = this.input.bind({ left: ['ArrowLeft', 'KeyA'], jump: ['Space'] });
  this.input.onTap((e) => this.spawnAt(e.x, e.y));   // gestures: onTap /
}                                                     // onDoubleTap / onLongPress /
override update(dt: number): void {                   // onPan / onSwipe (world coords)
  super.update(dt);
  if (this.input.keys.jump.pressed) this.player.jump();  // down edge
  if (this.input.keys.left.held) this.player.x -= 200 * dt;
}
```

Subscriptions detach automatically when the scene transitions away — a
stale onTap can never re-fire into a dead scene.

**Transitions also wipe input state and start a GRACE period** (default
500 ms, `game.inputGrace` seconds, 0 disables): keys and gestures read as
inactive, so a key released just after the switch can't fire in the new
scene, and a player frantically tapping fire when they die can't instantly
dismiss the game-over screen. After the grace, held keys need a fresh
press to register.

## How do I…

**…react to a key ONCE (start, restart)?** `game.input.keyPressed('Space')` —
true only on the frame the key went down. `game.input.key(...)` is the held test.

**…carry the score to the game-over screen?**
`this.gotoGameOver({ win: false, score: this.score })` → read it in
`GameOver.setup(data)`.

**…keep something across scenes?** Module-level variables (or the game
object). Scenes are disposable; anything on `this` dies with the scene.

**…skip scenes entirely?** Omit `scenes` from Game.create and use the
`game.run(frame)` callback with `game.scene` — the single implicit scene.
Fine for demos and toys; real games want the roster.

Traps: an `update(dt)` override starts with `super.update(dt)` — that call IS
what advances sprites and physics; a `draw(d)` override starts with
`super.draw(d)`, which IS what paints the scene's sprites. Frames/fonts load
AFTER `Game.create` and BEFORE `game.run()` — `setup()` runs at run(), so
indices are valid by then.

## Relates to

- [sprites.md](sprites.md) — what lives inside a scene.
- [index.md](index.md) — the layout model, the frame lifecycle.

Signatures: engine/webgpu/scene.d.ts, engine/webgpu/defaults.d.ts, engine/webgpu/game.d.ts.

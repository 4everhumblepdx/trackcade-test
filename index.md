# Phaser AE v2 — the WebGPU engine

**This file is the index. Each row names what a doc covers; the doc has the
detail.** Start with the map below, then open the one doc you need.

`Game.create()` tries WebGPU and silently falls back to a WebGL2 backend where
it's absent — same game code, nothing to configure. `game.renderer` reports
`'webgpu' | 'webgl'`; `?webgl` (or `window.PHASER_WEBGPU = false` before
`Game.create()`) forces the fallback. Nearly everything runs on both; the
WebGPU-only pieces (clustered lights beyond 8, spot-light beam shafts, custom
WGSL without a GLSL twin) degrade to warn-once no-ops, and `world.emitter()`
GPU particles run as a capped CPU approximation.

```ts
import { Game } from '../engine/webgpu.js';

const game = await Game.create({ background: '#0b0e1a' });   // worldHeight defaults to 768
const F_HERO = game.assets.frames(someCanvas, 16);

game.run((d, dt, t) => {
  d.sprite(F_HERO, 120, 200);
  d.rect(0, 440, game.view.w, 40, '#3a5a40');
});
```

**Read next:** [layout.md](layout.md) for the screen model (`worldHeight`, the
view, the HUD, `pixelArt`) — there is no resize code to write.
[scenes.md](scenes.md) for the shape of a whole game.

## What hangs off `game`

Verbs every game calls are flat; everything else lives in the namespace that
owns it. If you're hunting for a call, this is the map:

| | |
|---|---|
| `game.run` `.go` `.onStep` `.time` `.debug` | the loop and scene transitions |
| `game.view` `.vw(f)` `.vh(f)` | this frame's visible world rect, and the world X/Y at a fraction across/down it |
| `game.pause` `.resume` `.stop` `.destroy` | run-loop lifecycle |
| `game.input` | **ALL input** — keys, bindings, gestures, pointer, `toWorld` |
| `game.assets` | register art you then draw with — frames, fonts, text, deformers |
| `game.draw` / `game.hud` | the draw verbs — world space / screen space |
| `game.scene` `.camera` | the active scene and its camera (shake, flash) |
| `game.fx` | **PARTICLES** — fire, smoke, sparks, explosions |
| `game.post` | full-screen effects OVER the frame: `post.add('bloom')` |
| `game.backdrop` | full-screen layers BEHIND the world: `backdrop.add('stars')` |
| `game.sound` `.tween` | audio, tweens |
| `game.vector` `.lights2d` `.screen` | line art, 2D lights, fullscreen/capture |
| `await game.world3d()` | the 3D world — everything 3D lives on it |

In a **scene**, `this.input` is the same surface, so there is one place to look
for anything input.

**Two easy mix-ups.** `game.fx` is particles (a thing IN the world); `game.post`
is full-frame image processing (bloom, CRT, pixelate). Nothing named "effects"
exists. And **pick a text path by SCRIPT, not by look**: `d.text` and
`d.msdfText` are Latin-only, so **any non-Latin string — CJK, Arabic, Hebrew,
Thai, Indic, Cyrillic, Greek, emoji — goes through `d.unicodeText`**
([unicode-text.md](unicode-text.md)), which renders Latin too.

## Capability map

### Structure, input, assets

| I want to… | Doc |
|---|---|
| Title / play / gameOver states, transitions, the frame lifecycle | [scenes.md](scenes.md) |
| Typed input: key bindings (held/pressed/released), tap/pan/swipe gestures | [scenes.md](scenes.md) |
| Tween/ease any property; synthesised SFX, jingles and music | [scenes.md](scenes.md) |
| Load asset files (images/json/audio) behind a progress bar | [scenes.md](scenes.md) |
| `worldHeight`, `game.view`, the HUD, `pixelArt`, fractional placement | [layout.md](layout.md) |
| Hitboxes, contacts, collision cells, stats — the debug overlay | [debug.md](debug.md) |
| Fullscreen, screenshots, video capture of play | [screen.md](screen.md) |

### Drawing & text

| I want to… | Doc |
|---|---|
| Sprites, rects, lines, polylines, circles, rings, tints; GPU grid deformers (flags, card flips, jiggle, sway) | [draw.md](draw.md) |
| Retained sprites: animation, gravity, solid/on collision, scrolling camera | [sprites.md](sprites.md) |
| Rich physics: acceleration/friction, world bounds, moving platforms, wind/conveyors/gravity wells, ropes & rods, CCD | [sprites.md](sprites.md) |
| Full-body physics: Box2D bodies, stacks, joints & motors, ragdolls, vehicles, raycasts, triggers, debug draw — a lazy optional module | [physics2d.md](physics2d.md) |
| Tile layers (parallax, repeat, animated) + tile collision with slopes | [tilemaps.md](tilemaps.md) |
| **Non-Latin text — CJK, Arabic, Hebrew, Thai, Indic, Cyrillic, Greek, emoji, RTL, vertical CJK. MANDATORY for those scripts** | [unicode-text.md](unicode-text.md) |
| Crisp scalable Latin text: weight, outline, glow, shadow, gradient, rich runs — the default Latin path | [msdf.md](msdf.md) |
| Pick a font — 24 ready-baked MSDF fonts on the CDN | [fonts.md](fonts.md) |
| Bitmap/pixel Latin text and the screen-space HUD | [text.md](text.md) |
| Text layout: the box a block paints, overlap tests, hover/click states for menus and links | [text-layout.md](text-layout.md) |

### Interface

| I want to… | Doc |
|---|---|
| UI widgets with no art — button, checkbox, radio, toggle, slider, progress, window, header, input, textarea, select, list, label; themes | [ui.md](ui.md) |
| Clip/mask a region, scroll it, wrap a paragraph in a box | [ui.md](ui.md) |
| Bespoke furniture — dialogs, tooltips, cards, inventory slots, name plates, speech plates (`d.panel`) | [ui.md](ui.md) |

### Look & feel

| I want to… | Doc |
|---|---|
| Explosions, sparkles, streams, glows, colour ramps, snow/embers; camera shake and flash | [particles.md](particles.md) |
| Make ONE sprite glow / outline / dissolve; full-screen looks (bloom, pixelate, CRT, the effect chain) | [effects.md](effects.md) |
| Sky / starfield / aurora / nebula behind the world — backdrops as data | [backdrops.md](backdrops.md) |
| Trails streaming behind objects; shockwaves and hit-sparks — object VFX as data | [vfx.md](vfx.md) |
| Glowing vector line art: wireframe shapes that fly/rotate/shatter, deformable terrain polylines, dashed lines, colour sources, trails, starfields (parallax + warp), the vector emitter | [vector.md](vector.md) |
| 2D lighting: additive point/spot lights, soft falloff, hard shadows off scenery, colour mixing, candle flicker | [lights2d.md](lights2d.md) |
| Zero-file art: 2D pixel sprites/tiles, 3D crystals/rocks/trees; boolean solid carving; tileable noise textures | [procgen.md](procgen.md) |

### 2D game logic

| I want to… | Doc |
|---|---|
| A complete match-3: matching, specials, combos, jelly/chains/vines/crates, cascades, goals, autoplay | [match3.md](match3.md) |
| Tile-matching variants: SameGame/Toon Blast, Two Dots, merge-and-explode, Puzzle Quest, split boards, paint-every-cell | [match3-variants.md](match3-variants.md) |
| Grid-game logic packs: 1010!/Block Blast/Woodoku, 2048/Threes, Minesweeper, Picross, Lights Out, Flood-It, Tetris/Puyo/Columns/Dr. Mario, Sokoban, Netwalk/Pipe Mania, Boulder Dash, Snake, Puzzle Bobble, Zuma | [grid-games.md](grid-games.md) |
| Mazes: 10 algorithms, thin walls or thick tiles, rooms, braided loops, exits, plus movement queries | [maze.md](maze.md) |
| Dungeons (rooms + corridors + tagged rooms) and caves (cellular automata) | [levelgen.md](levelgen.md) |
| Fog of war / field of view on a grid: shadowcasting, multiple lights, unseen/explored/visible memory, `canSee()` | [fog.md](fog.md) |
| Non-grid 2D shadows and line of sight off actual scenery — visibility polygons, `raycast()` | [visibility2d.md](visibility2d.md) |
| Flow-field pathfinding for many units — tower defense, swarms; mutable obstacles; the wall-off guard | [flowfield.md](flowfield.md) |
| Fixed-path tower defense (Bloons style): tracks that fork and merge, off-path placement, targeting | [track.md](track.md) |

### 3D

| I want to… | Doc |
|---|---|
| The 3D world: perspective camera, boxes, billboards, fog, light, groups, chase camera, spline paths — `await game.world3d()` | [world3d.md](world3d.md) |
| Load models: OBJ (+MTL) and GLB with PBR textures; animated/skinned GLB with crossfade; convex-hull colliders | [world3d.md](world3d.md) |
| Dozens of point/spot lights, sun shadows, SSAO, environment reflections | [world3d.md](world3d.md) |
| Click 3D objects (pixel-exact pick), point-and-click ground, world-space raycasts, pin 2D labels to 3D points | [world3d.md](world3d.md) |
| 3D vector line art: wireframe OBJ/GLB models, grids and frames | [world3d.md](world3d.md) |
| 3D particles: fire/fountains/debris, bursts, spark-shedding trails; 100k+ GPU particles with depth collision; particles from a model's surface, lit by the lights | [particles3d.md](particles3d.md) |
| Agents that move with intent: steering, flocking, fields, panic flee, follow paths and leaders | [agents.md](agents.md) |
| Terrain: islands/hills/mountains/dunes, exact ground queries, deformable snow/sand with persistent trails, grass, `TerrainRider` | [terrain3d.md](terrain3d.md) |
| Sky (clouds/sun/stars/moon, day-night, storms), water (Gerstner sea, shore foam, streams), lens flare, god rays | [sky-water3d.md](sky-water3d.md) |
| Underwater: light absorption, murk, caustics, Snell's window from below | [underwater.md](underwater.md) |
| Voxels: Minecraft-style worlds, build/mine/place, land presets, chunked meshing with baked AO, character controller, block editor | [voxels.md](voxels.md) |
| First-person voxel control rig: pointer-lock look, WASD, jump/fly, break/place, hotbar, full mobile touch layout | [minecraft-controls.md](minecraft-controls.md) |

Signatures: engine/webgpu/index.d.ts (flat), engine/webgpu/game.d.ts, engine/webgpu/draw.d.ts.

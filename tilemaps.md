# Tilemaps & tile collision

Tile LAYERS draw the world; a COLLISION GRID stops bodies. They are
independent — same data or different, your choice.

```ts
const tiles = game.assets.frames(tilesetCanvas, 16);      // or await game.assets.loadFrames(url, 16)

class Play extends Scene {
  override setup(): void {
    const level = new Tilemap(16, LEVEL, tiles);   // index 1 draws frame tiles+0; 0 = empty
    const far = new Tilemap(16, FAR, tiles);
    far.distance = 2;                              // parallax: scrolls at half speed
    far.repeat = true;                             // seamless wrap in both axes
    this.backgroundMaps.push(far, level);          // draw order; foreground:true draws over sprites

    this.collisionMap = new CollisionGrid(16, COLLISION);   // the swept tile trace
  }
}
```

Tiles are pushed as batch instances each frame — a screenful of tiles is
free; there is no chunk caching and none is needed.

## Collision — the tile trace

Dynamic bodies sweep against `scene.collisionMap` (walls, floors,
ceilings, SLOPES — a fast body can't tunnel). `touching.down/up/left/
right` are set by tile contacts exactly like sprite solids, and slopes
within the standing range count as ground (run up a 45° ramp, jump off
it).

Collision values use the Impact-style tiledef: `1` (or any unlisted
non-zero) = solid, `2` = 45° rise-right, `24` = 45° fall-right, and the
full 15°/22°/67°/75° family — see `CollisionGrid.defaultTileDef` in
collision-grid.d.ts. **Visual indices rarely match collision indices** —
keep two grids and remap:

```ts
const VISUAL_TO_COLLISION = [0, 1, 1, 2, 24, 0];   // e.g. 5 = decor, no hit
const COLLISION = LEVEL.map((r) => r.map((v) => VISUAL_TO_COLLISION[v]));
```

## Per-tile animation

`map.animations[3] = { time: 0.2, seq: [2, 3] }` — tile index 3 cycles
those strip offsets on the map's clock (water, torches). The scene ticks
it automatically.

## Levels from data

`loadLevel(scene, data)` populates a scene from a declarative `LevelData`
record (layers + collision + sprite spawns by class) — the tile-editor
export path.

Traps: `distance` divides the camera scroll (bigger = further away);
`repeat` wraps INDICES, so author repeating layers to loop. The collision
grid never draws — pair it with a matching visual layer.

## Relates to

- [sprites.md](sprites.md) — bodies, physics, solid/on rules.
- [scenes.md](scenes.md) — where setup() lives.

Signatures: engine/webgpu/tilemap.d.ts, engine/webgpu/collision-grid.d.ts, engine/webgpu/level.d.ts.

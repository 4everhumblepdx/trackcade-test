# The debug overlay — diagnostics for players AND agents

Every game ships the overlay, DISABLED by default. It is a conversation
tool: when the player says "the sprite doesn't hit properly!", turn it on
so they can SEE the problem and tell you what's wrong ("the hitbox isn't
aligned!").

```ts
game.debug = true;                    // everything below
game.debug = { hitboxes: true };      // just what you need (unlisted = on)
game.debug = false;                   // off — the default
```

What it draws (all through the normal verbs — zero cost while off):

- **hitboxes** — every sprite's AABB, colour-coded by body: dynamic green,
  static blue, kinematic orange, sensor purple, none grey.
- **velocity** — yellow motion vectors from each moving sprite's centre.
- **touching** — red edge markers where contacts are active this frame.
- **tiles** — collision-grid cells in view: blue solid outlines + PINK
  slope-surface lines (instantly shows visual/collision grid mismatches).
- **textBounds** — the box every text block PAINTS (ink and hover state
  included, not the tighter text box): green normally, **RED where two collide**.
- **stats** — an fps / sprite / particle / 3D-counts bar (dark backing, always legible).

## When to reach for it

- "It falls through the floor / walks through walls" → `{ tiles: true,
  hitboxes: true }` — is the collision grid where the art is?
- "The jump feels wrong / won't trigger" → `{ touching: true }` — is
  touching.down actually set when standing?
- "Pickups trigger from too far away" → `{ hitboxes: true }` — is the
  hitbox bigger than the art?
- "The HUD text overlaps / looks crowded" → `{ textBounds: true }` — the red
  boxes are the clashes; fix them with `textOverlaps()`
  ([text-layout.md](text-layout.md)).
- "It's slow" → `{ stats: true }` — sprite/particle counts and fps.

Turn it OFF again (`game.debug = false`) once the question is answered.

## Relates to

- [sprites.md](sprites.md) — bodies, touching, physics.
- [tilemaps.md](tilemaps.md) — the collision grid it visualises.
- [text-layout.md](text-layout.md) — `textOverlaps()`, the programmatic form of the red boxes.

Signatures: engine/webgpu/debug.d.ts, engine/webgpu/game.d.ts.

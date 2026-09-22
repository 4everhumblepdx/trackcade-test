# Match-3 variants — other genres from the same board (`packs/match3`)

Read [match3.md](match3.md) first — the board, the journal contract and the presenter
recipe live there. This doc is the recipe-per-variant map: every game below is the SAME
`createBoard` with different config, and the presenter loop is unchanged (new step
types slot into the same switch).

```js
import { createBoard } from '../engine/packs/match3.js'; // its own artifact — not in webgpu.js
```

## Click-to-collapse (SameGame / Toon Blast / Pet Rescue)

`preset: 'collapse'` — `board.tap(at)` clears the flood group of 2+ same-colour blocks
(the `tap` step carries the group), NO refill, empty columns close up toward the left,
and cascades never auto-match. Group-size rewards via `collapseSpecials` (default
5 → line, 7 → bomb, 9 → colour-clear, spawned at the tap cell). Scoring defaults to
(n−2)². The game ends when `findMoves()` is empty — clearing the whole board is the win.

## Chain drawing (Two Dots / Dungeon Raid / Best Fiends)

`preset: 'chain'` — the player DRAWS the match:

```js
const board = createBoard({ cols: 8, rows: 8, colors: 5, preset: 'chain' });
// While dragging: validate each candidate step (structure check: color >= 0).
const probe = board.pathAt([...drag, cell]);   // { valid, loop, color, cells }
// On release:
if (board.pathAt(drag).valid) present(board.playPath(drag));
```

Rules: consecutive cells must be adjacent (`chain: { adjacency: 8 }` allows diagonals),
one colour, no revisits — EXCEPT the final cell, which may close a **loop**: a looped
path clears EVERY block of that colour (`chain.loopClearsColor: false` disables).
Minimum length via `chain.minLength` (default 3). Refill is from the top; falls never
auto-match (cascade clears don't happen in chain games). `findMoves()` returns ready
`{ kind: 'path', path }` moves, so autoplay/hints work unchanged.
**TRAP:** `pathAt` only reports `valid` at full length — while the player drags a
1-2 cell path, accept steps on `color >= 0` (structurally sound), not on `valid`.

## Merge & explode (Triple Town lineage, with chain reactions)

`merge: { maxTier: 4 }` — matches LEVEL blocks UP instead of clearing. Two styles
(`merge.style`):

- **`'fuse'`** (default, Triple Town): blocks only match equals — same colour AND same
  `tier` — and the group is consumed into ONE next-tier block at the pivot (`merge`
  step: fly the consumed sprites into `at`; their `clear` step precedes it). Cascade
  refills re-match as normal.
- **`'levelAll'`**: ANY same-colour trio matches regardless of tier, and nothing is
  consumed — EVERY participant gains a tier in place (one `tierUp` step; a trio of
  [plain, plain, 1] becomes [1, 1, 2]). Because levelled triples then PERSIST on the
  board, only the group(s) containing the swapped cells resolve, and cascades never
  auto-match — explosions are the only thing that ever clears a block.

Either way, reaching `maxTier` **explodes**: the block clears (`explode` step, then
its `clear`) and every block in its 3×3 neighbourhood levels up (`tierUp`) —
neighbours pushed to `maxTier` explode in the next wave, chain-reacting across the
board. Place tiered starters with `setBlock(x, y, { color, tier })`; shape specials
are disabled in merge mode.

## Resource battles (Puzzle Quest / Gems of War)

Few colours (the original uses 4 mana colours — fewer colours = more matches) + a
**`spawnTable`** so deal AND refill mix in themed content:

```js
spawnTable: [
  { weight: 5, block: { color: 0 } }, /* …colours 1-3… */
  { weight: 3.5, block: { color: 4, tags: ['skull'] } },
  { weight: 0.4, block: { color: 4, tags: ['skull', 'super'], special: { kind: 'blast', radius: 1 } } },
],
specialSpawns: { four: null, five: null, longer: null, L: null, T: null, cross: null }, // no shape rewards
tapActivatesSpecials: false,
```

The '+5 super skull' is just a skull-coloured block with a blast payload — matching it
destroys its neighbours automatically. Read the resource layer off the totals:
`result.totals.clearedByColor[c]` → mana, `clearedByTag['skull']` → damage; grant an
extra turn when any `match` step has `length >= 4`. Spells are `board.applyAction(...)`
calls — their clears flow back through the same totals to the caster. `spawnTable`
replaces `spawnWeights` everywhere (entries may be factories for per-spawn variation).

## Split boards with teleport refill

Sections that feed each other instead of the sky. Carve the wall with `#`, give the
FEEDING section a bottom row of `~` conduit cells whose portals point at the top of
the fed section, and mark sky spawners ONLY on the feeding section:

```js
const board = createBoard({ cols: 13, rows: 8, diagonalSlide: false, layout: [
  '......#......', /* …6 more rows… */ '~~~~~~#......',
]});
for (let x = 0; x < 6; x++) board.cell(x, 7).portal = { to: { x: x + 7, y: 0 } };
for (let x = 0; x < 6; x++) board.cell(x, 0).spawner = true;
```

Clear a row on the right and its refill teleports in from the left tower's bottom
(fall paths show the jump — `path` entries more than 1 cell apart; present it as a
quick teleport, not a flight). **TRAP:** once ANY cell sets `spawner: true`, only
marked cells sky-spawn — forgetting the feeder's spawners starves the whole board.

## Paint the board (activate every cell)

No new mechanic — it's the jelly/ice layer INVERTED: every cell starts with a 1-hp
`'paint'` layer ("unpainted"), icy cells get `hp: 2`, and a match ON the cell strips
it (= paints it). Completion is a `clearLayer` goal — use a smaller `count` for
percentage targets:

```js
for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++)
  board.addLayer(x, y, { kind: 'paint', hp: icy.has(y * cols + x) ? 2 : 1 });
goals: [{ type: 'clearLayer', kind: 'paint', count: cols * rows }], // or 80%: Math.ceil(cols*rows*0.8)
```

Render painted = "cell whose layer is gone" (track layer state from `cellLayerDamage`
steps, not from the board — the board is already final).

## Relates to

- [match3.md](match3.md) — the board, journal contract, presenter recipe, obstacles.

Signatures: engine/packs/match3.d.ts.

# Match-3 — the tile-matching logic engine (`packs/match3`)

A headless match-3 board: grid + blocks + matching + specials + obstacles + goals,
with **zero rendering and zero timing**. Every move resolves INSTANTLY and returns an
ordered **event journal** (`MoveResult.steps`) that your game replays at its own pace
with tweens and effects. It is its own artifact — games that don't use it never load it:

```js
import { createBoard } from '../engine/packs/match3.js'; // its own artifact — not in webgpu.js
```

Deterministic: same `seed` + same moves = identical journals (pass a random seed for variety).

## The shape of every match-3 game

```js
import { Game } from '../engine/webgpu.js';
import { createBoard } from '../engine/packs/match3.js';

const board = createBoard({ cols: 8, rows: 8, colors: 6, seed: (Math.random() * 1e9) | 0 });
// board deals itself: guaranteed NO pre-existing matches and at least one legal move.

const result = board.swap({ x: 3, y: 4 }, { x: 3, y: 5 });
// board state is now FINAL — result.steps is the ordered replay script:
// swap → match (shape, cells, blocks) → clear → fall (+refill spawns) → cascade rounds…
// result.valid === false → steps is just [swap, swapBack]: play the bounce + shake.
```

**The presenter contract (the one big idea):** one step = one visual beat. Play steps
strictly in sequence; events INSIDE a step are simultaneous (tween them together).
Key sprites by **block id** — ids are stable across falls, teleports and shuffles.

```js
const sprites = new Map(); // block id → your sprite
async function present(result) {
  board.beginPresent(result);                 // marks the region visually busy
  for (const step of result.steps) {
    switch (step.type) {
      case 'swap': case 'swapBack': {         // 150ms position exchange
        const a = sprites.get(step.aBlock), b = sprites.get(step.bBlock);
        await Promise.all([tweenTo(a, step.type === 'swap' ? step.b : step.a),
                           tweenTo(b, step.type === 'swap' ? step.a : step.b)]);
        break;
      }
      case 'match':      await flash(step.matches.flatMap((m) => m.blocks)); break;
      case 'clear':      await Promise.all(step.blocks.map((c) => popAndRemove(sprites.get(c.id)))); break;
      case 'specialSpawn': sprites.set(step.block.id, makeSprite(step.block, step.at)); break;
      case 'detonate':   await beamOrBlastFx(step.kind, step.cells); break;
      case 'fall': {      // moves AND spawns are the SAME animation: walk the path
        const PER_CELL = 0.07;                // ONE shared cells-per-second speed
        const walk = (id, spawnBlock, path) => {
          if (spawnBlock) sprites.set(id, makeSprite(spawnBlock, path[0])); // spawn paths start above the board, pre-stacked
          return tweenAlongPath(sprites.get(id), path, (path.length - 1) * PER_CELL);
        };
        await Promise.all([
          ...step.moves.map((m) => walk(m.blockId, null, m.path)),
          ...step.spawns.map((s) => walk(s.block.id, s.block, s.path)),
        ]);
        break;
      }
      // overlayDamage / cellLayerDamage / blockDamage / conveyor / spread /
      // bombTick / ingredientExit / shuffle / cascadeStart / gameOver — same pattern.
    }
  }
  board.endPresent(result);
}
```

**TRAP — the classic refill overlap:** in a `fall` step, give every item ONE constant
cells-per-second speed: `duration = (path.length − 1) × PER_CELL`. Items travel
DIFFERENT distances, so a per-item duration means different speeds, and the refill
blocks visibly overlap the column settling below them. Spawns' `path` already starts
above the board, pre-stacked by spawn order — so animating spawns *identically to
moves* (the `walk` above), along that path at that same per-cell speed, is the entire
fix.

**TRAP:** the board is already in its final state the moment `swap()` returns. Drive
EVERY animation from the journal — it is the only source of truth for *what happened*,
a second move's visuals included. The board is the source of truth for *what is*.

## How do I…

**…know what shape the player made, and which blocks were in it?**
Every `match` step carries full `MatchEvent`s: `shape` (`three|four|five|longer|L|T|cross|square`),
`length`, `orientation`, `color`, `cells`, `blocks` (snapshots), `pivot` (the moved cell),
`overlays`/`layers` present, `chainDepth` (0 = direct, 1+ = cascade) and `cause`.
`result.totals` sums the move: `{ matches, blocksCleared, chainDepth, specialsMade, specialsFired, score }`.

**…get specials from big matches?** On by default: 4-in-a-row → row/column clearer
(perpendicular to the run), 5+ → colour-clear, L/T/cross → 3×3 bomb. Override per shape:
`specialSpawns: { four: { kind: 'blast', radius: 1 }, five: null }`. The special spawns
at the match's pivot (`specialSpawn` step). Swapping two specials fires the **pair combo
matrix** (line+line = cross, line+bomb = 3 rows + 3 columns, bomb+bomb = bigger blast,
colourClear+X = convert-and-fire that colour, colourClear+colourClear = board clear);
override with `comboMatrix: { 'blast+rowClear': (at) => [{ type: 'blast', at, radius: 2 }] }`.
Tapping a special on the board fires it (`board.tap(at)`; disable via `tapActivatesSpecials: false`).

**…give the player inventory power-ups (hammer, bombs, shuffles)?**
`board.applyAction(action)` — one vocabulary for every grid mutation, and cascades follow
automatically: `{type:'hammer',at}`, `{type:'blast',at,radius}`, `{type:'clearRow',row}`,
`{type:'clearColumn',col}`, `{type:'clearColor',color}`, `{type:'paint',at,color}`,
`{type:'splat',at,radius,count}`, `{type:'randomClear',count}`, `{type:'shuffle'}`,
`{type:'freeSwap',a,b}` (the glove — no match required). Actions don't consume a move.

**…add jelly / gold-gilding under the blocks?** Cell **layers**:
`board.addLayer(x, y, { kind: 'jelly', hp: 1 })` (double jelly = `hp: 2`). Any direct hit
on the cell damages the top layer (`cellLayerDamage` steps). Goal: `{ type: 'clearLayer', kind: 'jelly', count: n }`.

**…chain / cage / vine / ice-case the blocks?** The **overlay** sits on top:
`board.setOverlay(x, y, { kind: 'chain', hp: 1, locksMove: true })` — block can't be swapped,
still matches in place, match clears chain AND block. `locksMatch: true` = cage (can't
match at all). `absorbsClear: true` = ice casing: the match damages the overlay and the
**block survives** until the overlay is gone. `spreads: true` = vine: each turn in which
no overlay of that kind was damaged, it grows onto one adjacent block (`spread` step).

**…make ice-style blocks that need two matches?** `hp` on the block itself:
`board.setBlock(x, y, { color: 2, hp: 2 })` → first match emits `blockDamage`
(crack the sprite), second clears it.

**…add crates / stones cleared by adjacent matches?**
`board.setBlock(x, y, { kind: 'blocker', color: -1, hp: 2, tags: ['crate'] })` — never
matches, never swaps; damaged by `adjacent`/`blast`/`beam`/`tool` hits (tune with
`hitFilter`). Goal: `{ type: 'clearTagged', tag: 'crate', count: n }`.

**…drop butterflies/cherries to the bottom?** Ingredients + exit cells:
`board.setBlock(x, y, { kind: 'ingredient', color: -1 })` (falls, never matches, immune
to hits) and mark exits in the layout with `E`. When one rests on an exit it leaves the
board (`ingredientExit` step). Goal: `{ type: 'ingredients', count: 4 }`.

**…add move-fuse bombs?** `board.setBlock(x, y, { color: 1, bombTimer: 20 })` — ticks
down once per move (`bombTick` steps); at 0 the move's result carries `gameOver: 'bomb'`.

**…shape the board (holes, gaps, belts)?** The board is ALWAYS a rectangle; the
`layout` strings carve it: `.` normal · `#` blocked hole (no block ever; carves the
silhouette) · `~` conduit (holds nothing — falling blocks pass straight through; use a
band of them to split the board into visually separate sections that still feed each
other) · `<` `>` `^` `v` conveyor (shifts its block one step per turn; closed circuits
rotate) · `E` exit. Cells starved by holes/static blocks fill by **diagonal slide**
automatically. Per-cell extras on `board.cell(x,y)`: `flow` (custom fall routing),
`portal: { to }` (falling blocks teleport), `spawner: true` (mid-board refill entries —
when any cell is marked, ONLY marked cells spawn).

**…set level goals and a move budget?**
`goals: [{ type: 'clearColor', color: 2, count: 30 }, …]` (+ `clearLayer`, `clearTagged`,
`clearOverlay`, `ingredients`, `fireSpecials`, `score`) and `moveLimit: 25`. Read
`board.goals` (live counters) and `result.goalsDelta` for HUD deltas; `board.movesLeft`.

**…build a VARIANT (collapse/tap, chain-drawing, merge-and-explode, Puzzle-Quest
resource battles, split teleporting boards, paint-every-cell)?** Same board, different
config — every recipe is in [match3-variants.md](match3-variants.md).

**…let the game play itself (testing, demos, hints)?**
`board.findMoves()` — every legal move with predicted shape/length/value, best first.
`board.hint()` — the single best. `board.autoplay({ policy: 'best'|'random'|fn, maxMoves })`
plays whole games headlessly and returns every `MoveResult`. Deadlocks self-heal: when no
move exists after a move settles, a `shuffle` step is appended automatically (`autoShuffle`).

**…allow a second move while cascades animate elsewhere (Blitz feel)?**
`board.beginPresent(result)` / `board.endPresent(result)` mark regions busy;
`board.canMove(a, b)` admits a move only when its columns don't intersect a busy region.
Lock input entirely while `!idle` for the Candy-Crush feel instead.
**TRAP:** admission is column-conservative — check `canMove` BEFORE calling `swap()`;
a resolved move cannot be un-resolved.

**…run the turn systems manually?** By default every valid move also ticks conveyors,
spreaders and bomb fuses. Set `autoTick: false` and call `board.endTurn()` yourself
(returns those steps as a result to play back).

## Relates to

- [match3-variants.md](match3-variants.md) — collapse, chain-drawing, merge, Puzzle
  Quest, split boards, paint-the-board: the same board in other genres.
- [sprites.md](sprites.md) — sprites/tweens for the presenter; [text.md](text.md) HUD.
- [effects.md](effects.md), [vfx.md](vfx.md) — detonation flashes, shockwaves, glow.
- [procgen.md](procgen.md) — zero-file gem/tile art for the blocks.

Signatures: engine/packs/match3.d.ts.

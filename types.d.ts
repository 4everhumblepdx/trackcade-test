/** A direction on the board grid. `downLeft`/`downRight` appear in flow routing. */
export type Dir = 'up' | 'down' | 'left' | 'right' | 'downLeft' | 'downRight';
/** A board coordinate. `x` is the column (0 = left), `y` is the row (0 = top). */
export interface XY {
    x: number;
    y: number;
}
/**
 * What a board square fundamentally is:
 * - `normal`   — holds a block.
 * - `blocked`  — a hole/dead cell: never holds a block, stops falls (carves the
 *                board shape out of the rectangle).
 * - `conduit`  — holds nothing, but falling blocks pass straight through it
 *                (the "invisible gap rows" between board sections).
 * - `conveyor` — holds a block and shifts its content one step in `conveyor`
 *                direction on each turn tick.
 */
export type CellKind = 'normal' | 'blocked' | 'conduit' | 'conveyor';
/**
 * A damageable layer painted ON the cell itself (under the block): jelly,
 * gold-gilding, grass. Damaged by hits that land on the cell; removed at hp 0.
 */
export interface CellLayer {
    /** Game-defined label, e.g. `'jelly'`. Goals can target it. */
    kind: string;
    /** Hits remaining before the layer clears. Double jelly = 2. */
    hp: number;
    /** Which hit types damage it. Default: every direct hit (not `adjacent`). */
    hitFilter?: HitType[];
}
/** One board square. All fields optional except `kind`; a plain cell is `{ kind: 'normal' }`. */
export interface Cell {
    kind: CellKind;
    /**
     * Fall routing out of this cell, tried in order. Default `['down']`.
     * Diagonal slide past blocked cells is automatic (see `BoardConfig.diagonalSlide`);
     * set `flow` only for custom routing.
     */
    flow?: Dir[];
    /** Belt direction for `kind: 'conveyor'` cells. Belts chain into runs/loops. */
    conveyor?: Dir;
    /** A block that lands here is teleported to `to` and keeps falling from there. */
    portal?: {
        to: XY;
    };
    /** Marks a refill entry point. By default every top-row non-blocked cell spawns. */
    spawner?: boolean;
    /** Bottom slot: a non-matchable `ingredient` block resting here exits and counts. */
    exit?: boolean;
    /** Damageable under-layers (jelly etc.), topmost last. */
    layers?: CellLayer[];
}
/** Built-in special payload kinds. `custom` fires `action`. */
export type SpecialKind = 'rowClear' | 'colClear' | 'blast' | 'colorClear' | 'seeker' | 'custom';
/** The special payload carried by a special block. */
export interface SpecialDef {
    kind: SpecialKind;
    /** Blast radius in cells for `blast` (1 = 3×3). Default 1. */
    radius?: number;
    /** Explicit action for `kind: 'custom'`. */
    action?: Action;
}
/** What a block fundamentally is. */
export type BlockKind = 'normal' | 'special' | 'ingredient' | 'blocker';
/** Everything you can specify when creating/placing a block. */
export interface BlockInit {
    /** Colour index `0..colors-1`, or `-1` for colourless (ingredients, crates). */
    color?: number;
    kind?: BlockKind;
    special?: SpecialDef;
    /**
     * Matches needed to clear it. `1` (default) clears on first match; ice-style
     * blocks use `2+` — each match cracks a layer (`blockDamage` events) until 0.
     */
    hp?: number;
    /** `false` → never part of a match (ingredients, crates). Default from `kind`. */
    matchable?: boolean;
    /** `true` → never falls (meringue-style anchored blockers). */
    static?: boolean;
    /** Which hit types damage a `blocker` block. Default `['adjacent','blast','beam','tool']`. */
    hitFilter?: HitType[];
    /** Move-countdown fuse: ticks down once per move; reaching 0 fires a lose trigger. */
    bombTimer?: number;
    /** Free-form game labels, carried through every journal event. */
    tags?: string[];
    /** Merge-mode level (0-based). Blocks only match with the SAME colour + tier. */
    tier?: number;
}
/** A live block on the board. Identity (`id`) is stable across its whole life. */
export interface Block extends Required<Pick<BlockInit, 'color' | 'kind'>> {
    /** Stable id — key your sprites off this, never off grid position. */
    id: number;
    special?: SpecialDef;
    hp: number;
    matchable: boolean;
    static: boolean;
    hitFilter?: HitType[];
    bombTimer?: number;
    tags?: string[];
    tier: number;
}
/** An immutable copy of a block as it was when the event fired. */
export type BlockSnapshot = Readonly<Block>;
/** An overlay entry sitting on top of one cell's block. */
export interface OverlayEntry {
    /** Game-defined label, e.g. `'chain'`, `'vine'`, `'cage'`. */
    kind: string;
    /** Hits remaining before the overlay clears. */
    hp: number;
    /** Block cannot be swapped/moved (it can still fall away unless this is set). */
    locksMove?: boolean;
    /** Block cannot take part in a match at all (cage/bubble style). */
    locksMatch?: boolean;
    /**
     * `true` (ice-casing style): a match ON the block damages the overlay and the
     * block SURVIVES. `false` (chain style): the match clears overlay and block together.
     */
    absorbsClear?: boolean;
    /** Which hit types damage it. Default: all. */
    hitFilter?: HitType[];
    /**
     * Vine/chocolate growth: each turn tick in which NO overlay of this kind was
     * damaged, grow one copy onto a random adjacent uncovered block.
     */
    spreads?: boolean;
}
/**
 * Every clearing event lands as typed hits:
 * - `match`    — on the matched cells themselves
 * - `adjacent` — splash onto orthogonal neighbours of a clear (how crates die)
 * - `blast`    — bomb/area explosions
 * - `beam`     — row/column clears
 * - `tool`     — inventory power-ups (hammer etc.)
 * Cell layers, overlays and blocker blocks each declare which types damage them.
 */
export type HitType = 'match' | 'adjacent' | 'blast' | 'beam' | 'tool';
/** The hard-coded shape registry. `longer` = straight run of 6+. */
export type MatchShape = 'three' | 'four' | 'five' | 'longer' | 'L' | 'T' | 'cross' | 'square' | 'group';
/** One resolved match, with everything the game needs to know about it. */
export interface MatchEvent {
    shape: MatchShape;
    /** Total blocks involved. */
    length: number;
    orientation: 'h' | 'v' | 'both' | 'none';
    color: number;
    /** Every cell in the match. */
    cells: XY[];
    /** Every block in the match, snapshotted at match time. */
    blocks: BlockSnapshot[];
    /** The moved/tapped cell (specials spawn here); run intersection for cascades. */
    pivot: XY;
    /** Overlays present on matched cells at match time. */
    overlays: {
        at: XY;
        kind: string;
        hp: number;
    }[];
    /** Cell layers present under matched cells at match time. */
    layers: {
        at: XY;
        kind: string;
        hp: number;
    }[];
    /** 0 = made directly by the move; 1+ = cascade round that produced it. */
    chainDepth: number;
    cause: 'move' | 'cascade' | 'action';
}
/** A grid mutation. Applied via `board.applyAction`, special blocks, or combos. */
export type Action = {
    type: 'clearRow';
    row: number;
} | {
    type: 'clearColumn';
    col: number;
}
/** Square blast centred at `at`; `radius: 1` = 3×3. */
 | {
    type: 'blast';
    at: XY;
    radius: number;
} | {
    type: 'clearColor';
    color: number;
} | {
    type: 'paint';
    at: XY;
    color: number;
}
/** Clear one block (or one overlay/blocker layer) at a chosen cell. */
 | {
    type: 'hammer';
    at: XY;
}
/** Hit `count` random block cells within `radius` of `at`. */
 | {
    type: 'splat';
    at: XY;
    radius: number;
    count: number;
} | {
    type: 'randomClear';
    count: number;
} | {
    type: 'shuffle';
}
/** Swap two adjacent cells with no match requirement (the "glove"). */
 | {
    type: 'freeSwap';
    a: XY;
    b: XY;
}
/** Convert every block of `color` into `special`, then fire them all. */
 | {
    type: 'convertAndFire';
    color: number;
    special: SpecialDef;
} | {
    type: 'custom';
    cells: (ctx: {
        cols: number;
        rows: number;
    }) => XY[];
};
/** A block displacement within a fall step. `path` includes every cell traversed
 * (conduit/portal waypoints included) — tween through it, or teleport past it. */
export interface FallMove {
    blockId: number;
    from: XY;
    to: XY;
    path: XY[];
}
/** A refilled block. Animate it EXACTLY like a `FallMove`: walk `path` at the
 * same cells-per-second speed as every other item in the step. `path` starts
 * ABOVE the board (negative y for top entries), already stacked by spawn order,
 * so simultaneous spawns keep one-cell spacing and never overlap the blocks
 * falling below them. `entry`/`to`/`drop`/`stack` are informational extras. */
export interface RefillSpawn {
    block: BlockSnapshot;
    column: number;
    entry: XY;
    to: XY;
    drop: number;
    stack: number;
    path: XY[];
}
/**
 * One journal step = one visual beat. Steps are strictly sequential; events
 * inside a step are simultaneous (tween them together).
 */
export type Step = {
    type: 'swap';
    a: XY;
    b: XY;
    aBlock: number;
    bBlock: number;
}
/** The failed-swap bounce back. A `valid: false` result is exactly [swap, swapBack]. */
 | {
    type: 'swapBack';
    a: XY;
    b: XY;
    aBlock: number;
    bBlock: number;
}
/** Collapse preset: the tapped flood group about to clear. */
 | {
    type: 'tap';
    at: XY;
    group: XY[];
}
/** Marks each cascade round, for escalating pitch/fx. depth 0 = the direct result. */
 | {
    type: 'cascadeStart';
    depth: number;
} | {
    type: 'match';
    matches: MatchEvent[];
}
/** `fromShape: 'convert'` = mass conversion by a colour-clear combo. */
 | {
    type: 'specialSpawn';
    block: BlockSnapshot;
    at: XY;
    fromShape: MatchShape | 'convert';
}
/** A special (or pair combo) firing. `cells` = every cell it hits. */
 | {
    type: 'detonate';
    sourceId: number | null;
    at: XY;
    kind: SpecialKind | 'combo';
    cells: XY[];
} | {
    type: 'overlayDamage';
    hits: {
        at: XY;
        kind: string;
        remainingHp: number;
    }[];
} | {
    type: 'cellLayerDamage';
    hits: {
        at: XY;
        kind: string;
        remainingHp: number;
    }[];
}
/** Multi-hp blocks cracking (ice), or blockers losing a layer. */
 | {
    type: 'blockDamage';
    hits: {
        blockId: number;
        at: XY;
        remainingHp: number;
    }[];
} | {
    type: 'clear';
    blocks: {
        id: number;
        at: XY;
        block: BlockSnapshot;
        cause: HitType;
    }[];
} | {
    type: 'paint';
    blockId: number;
    at: XY;
    color: number;
} | {
    type: 'fall';
    moves: FallMove[];
    spawns: RefillSpawn[];
} | {
    type: 'conveyor';
    shifts: FallMove[];
} | {
    type: 'spread';
    growth: {
        kind: string;
        at: XY;
    }[];
} | {
    type: 'bombTick';
    ticks: {
        blockId: number;
        at: XY;
        remaining: number;
    }[];
} | {
    type: 'ingredientExit';
    blockId: number;
    at: XY;
    block: BlockSnapshot;
}
/** Move operators (A1). `rotate` = a 2×2 turn; `shift` = a wraparound line slide. */
 | {
    type: 'rotate';
    at: XY;
    dir: 'cw' | 'ccw';
    blocks: number[];
} | {
    type: 'shift';
    axis: 'row' | 'col';
    index: number;
    by: number;
    moves: FallMove[];
}
/** Chain preset: the committed player path. `loop` = the path closed a cycle. */
 | {
    type: 'path';
    cells: XY[];
    loop: boolean;
}
/** Merge mode: the consumed blocks (`from`) became one tier-`tier` block at `at`.
 * Present it by flying the `from` sprites into `at` (their `clear` step precedes this). */
 | {
    type: 'merge';
    at: XY;
    blockId: number;
    block: BlockSnapshot;
    tier: number;
    color: number;
    from: {
        blockId: number;
        at: XY;
    }[];
}
/** Merge mode: blocks levelled up by a neighbouring explosion. */
 | {
    type: 'tierUp';
    hits: {
        blockId: number;
        at: XY;
        tier: number;
    }[];
}
/** Merge mode: a max-tier block detonating (its `clear` follows). */
 | {
    type: 'explode';
    at: XY;
    blockId: number;
}
/** Deadlock auto-reshuffle: every moved block with from → to. */
 | {
    type: 'shuffle';
    moves: {
        blockId: number;
        from: XY;
        to: XY;
    }[];
} | {
    type: 'gameOver';
    reason: 'bomb' | 'noMoves';
};
/** A goal counter changing as a consequence of a move. */
export interface GoalDelta {
    id: string;
    /** How much this move progressed it. */
    amount: number;
    remaining: number;
    done: boolean;
}
/** What one move fully resolved to. All logic already happened; play `steps` back. */
export interface MoveResult {
    /** `false` → nothing changed; `steps` holds the swap/swapBack for the fail fx. */
    valid: boolean;
    steps: Step[];
    /** Every cell index (`y * cols + x`) touched — for parallel-move admission. */
    region: number[];
    totals: {
        matches: number;
        blocksCleared: number;
        chainDepth: number;
        specialsMade: number;
        specialsFired: number;
        score: number;
        /** Cleared blocks per colour — the resource layer (mana, orders) reads this. */
        clearedByColor: Record<number, number>;
        /** Cleared blocks per tag (skulls, crates, gems…). */
        clearedByTag: Record<string, number>;
    };
    goalsDelta: GoalDelta[];
    /** A lose trigger fired during this move (bomb expiry / unfixable deadlock). */
    gameOver?: 'bomb' | 'noMoves';
}
/** A legal move found by `findMoves`, with its predicted primary outcome. */
export interface PredictedMove {
    kind: 'swap' | 'tap' | 'path';
    a: XY;
    /** Present for swaps. */
    b?: XY;
    /** Present for chain-preset moves: a playable path through one colour group. */
    path?: XY[];
    /** Predicted best shape the move makes (or `group` for taps). */
    shape: MatchShape;
    /** Blocks in the predicted match/group. */
    length: number;
    /** Heuristic value — `findMoves` sorts by this, descending. */
    value: number;
}
/** A level goal, wired to journal events. */
export type GoalDef = {
    id?: string;
    type: 'score';
    count: number;
} | {
    id?: string;
    type: 'clearColor';
    color: number;
    count: number;
}
/** Count cleared blocks carrying this tag (crates, gems…). */
 | {
    id?: string;
    type: 'clearTagged';
    tag: string;
    count: number;
} | {
    id?: string;
    type: 'clearLayer';
    kind: string;
    count: number;
} | {
    id?: string;
    type: 'clearOverlay';
    kind: string;
    count: number;
} | {
    id?: string;
    type: 'ingredients';
    count: number;
} | {
    id?: string;
    type: 'fireSpecials';
    count: number;
};
/** Live goal state, readable on `board.goals`. */
export interface GoalState {
    id: string;
    def: GoalDef;
    target: number;
    remaining: number;
    done: boolean;
}
/** Weighted content table for refill spawns. Index = colour, value = weight. */
export type SpawnWeights = number[];
/** Board construction options. */
export interface BoardConfig {
    cols: number;
    rows: number;
    /** Number of block colours dealt (0..colors-1). Default 6. */
    colors?: number;
    /** PRNG seed. Same seed + same moves = identical journals. Default 1. */
    seed?: number;
    /**
     * `match3` (default): adjacent swap must make a match; line matcher; cascades re-match.
     * `collapse`: tap a flood group of `minGroup`+ same colour; no refill;
     * empty columns close up horizontally; cascades do NOT auto-match.
     * `chain`: the player draws a path through adjacent same-colour blocks
     * (`board.playPath`); refills from the top; cascades do NOT auto-match.
     */
    preset?: 'match3' | 'collapse' | 'chain';
    /** Chain preset tuning. */
    chain?: {
        /** Path step adjacency. Default 4 (orthogonal); 8 allows diagonals. */
        adjacency?: 4 | 8;
        /** Minimum path length. Default 3. */
        minLength?: number;
        /** Closing the path into a loop clears EVERY block of that colour. Default true. */
        loopClearsColor?: boolean;
    };
    /**
     * Merge resolution: matches LEVEL blocks UP instead of clearing them.
     * Reaching `maxTier` EXPLODES: the block clears and every neighbour (3×3)
     * levels up — neighbours that hit `maxTier` explode too, chain-reacting.
     * Shape specials are disabled in merge mode. Two styles:
     * - `'fuse'` (default, Triple-Town): blocks only match EQUAL colour+tier;
     *   the group is consumed into ONE next-tier block at the pivot; cascades
     *   re-match as normal.
     * - `'levelAll'`: ANY same-colour trio matches regardless of tier; nothing
     *   is consumed — EVERY participant gains a tier in place. Only the group(s)
     *   containing the swapped cells resolve, and cascades never auto-match
     *   (levelled triples persist on the board); explosions are the only exit.
     */
    merge?: {
        maxTier: number;
        explode?: boolean;
        style?: 'fuse' | 'levelAll';
    };
    /**
     * The board shape, one string per row. `.` normal · `#` blocked (hole) ·
     * `~` conduit · `<` `>` `^` `v` conveyor · `E` exit cell (normal + exit).
     * Omit for an all-normal rectangle.
     */
    layout?: string[];
    /** Collapse preset: minimum flood-group size. Default 2. */
    minGroup?: number;
    /** Recognise 2×2 squares as a match shape. Default false. */
    squareMatch?: boolean;
    /** Refill from the top after clears. Defaults: match3 `'top'`, collapse `'none'`. */
    refill?: 'top' | 'none';
    /** Blocks slide diagonally into cells that cannot be fed vertically (starved
     * by holes/static blocks). Default: true for match3, false for collapse. */
    diagonalSlide?: boolean;
    /** Collapse preset: empty columns close toward the left. Default true (collapse only). */
    horizontalCollapse?: boolean;
    /** Colour weights for fill/refill. Default uniform. */
    spawnWeights?: SpawnWeights;
    /**
     * Weighted deal/refill CONTENT — when present it replaces `spawnWeights`:
     * every dealt/refilled block picks an entry by weight (Puzzle-Quest skulls,
     * cannon-fed blockers, rare bombs…). Entries may be factories for per-spawn
     * variation. The initial deal still guarantees a no-match, movable board.
     */
    spawnTable?: {
        weight: number;
        block: BlockInit | (() => BlockInit);
    }[];
    /**
     * Shape → special spawned at the pivot. `null` disables one shape.
     * Default: four → row/colClear (perpendicular to the run), five/longer →
     * colorClear, L/T/cross → blast r1, square → seeker (if squareMatch).
     * Collapse preset instead uses `collapseSpecials`.
     */
    specialSpawns?: Partial<Record<MatchShape, SpecialDef | null>>;
    /** Collapse preset: group-size thresholds → special left at the tap cell.
     * Default: 5 → row/colClear, 7 → blast, 9 → colorClear. `{}` disables. */
    collapseSpecials?: Record<number, SpecialDef>;
    /** Override/extend the special+special swap combo matrix. Keys like `'blast+rowClear'`
     * (kinds sorted alphabetically, joined with `+`). */
    comboMatrix?: Record<string, (a: XY, ctx: {
        colorA: number;
        colorB: number;
    }) => Action[]>;
    /** Tapping a special block on the board fires it (Royal Match style). Default true. */
    tapActivatesSpecials?: boolean;
    /** Triple-Town-style placement merging: `board.place(at)` drops the current deal;
     * 3+ orthogonally-connected identical blocks (by colour) merge into the next tier
     * AT the placement cell and cascade. Enables `board.deal`, walkers (bears), and
     * generators. Set with `merge` (for maxTier) — no gravity, no refill. */
    placeMerge?: {
        maxTier: number;
    };
    /** Swap any two cells, not just adjacent ones (Pokémon Shuffle). Default false. */
    swapAnywhere?: boolean;
    /** A `rotate`/`shiftRow`/`shiftColumn` move need not create a match to be legal
     * (Bejeweled Twist). Default false — the operator reverts if it makes no match. */
    operatorFreeMove?: boolean;
    /** Auto-append the turn tick (conveyors, spread, bomb fuses) to every valid move.
     * Default true; set false and call `board.endTurn()` yourself. */
    autoTick?: boolean;
    /** Auto-shuffle when no legal move exists after a move settles. Default true (match3). */
    autoShuffle?: boolean;
    goals?: GoalDef[];
    /** Optional move budget — `board.movesLeft` counts down; purely informational. */
    moveLimit?: number;
    /** Replace the default scorer. `depth` is the cascade round (0 = direct). */
    scorer?: (ev: {
        kind: 'clear' | 'match';
        blocks: number;
        shape?: MatchShape;
        depth: number;
    }) => number;
}

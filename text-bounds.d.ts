// Docs: engine/webgpu/text-layout.md — usage, recipes & traps (this file = exact type signatures)
/** An axis-aligned box, with the derived edges layout code keeps recomputing. */
export interface TextBounds {
    x: number;
    y: number;
    w: number;
    h: number;
    right: number;
    bottom: number;
    /** Centre. */
    cx: number;
    cy: number;
}
/** The draw-time transform keys that move a block — the subset `bounds()` reads. */
export interface TextTransform {
    scale?: number;
    rotation?: number;
    origin?: {
        x?: number;
        y?: number;
    };
}
/** Anything that can report where it paints: `UnicodeText`, `MsdfText`. */
export interface BoundedText {
    bounds(x: number, y: number, opts?: TextTransform): TextBounds;
}
/** Build a {@link TextBounds} from a corner + size. */
export declare function makeBounds(x: number, y: number, w: number, h: number): TextBounds;
/**
 * The axis-aligned box of a `w`×`h` local rect drawn at (x, y) under `t`.
 * `inkX`/`inkY` shift the local rect so the ORIGIN stays anchored to the text
 * box even when the ink spills outside it.
 */
export declare function transformedBounds(w: number, h: number, x: number, y: number, t: TextTransform | undefined, inkX?: number, inkY?: number, boxW?: number, boxH?: number): TextBounds;
/** Do two boxes overlap? `gap` treats blocks closer than that as colliding. */
export declare function boundsOverlap(a: TextBounds, b: TextBounds, gap?: number): boolean;
/** The overlapping region of two boxes (zero-sized when they merely touch). */
export declare function boundsIntersection(a: TextBounds, b: TextBounds): TextBounds;
/** The smallest box containing both — useful for reserving space for a group. */
export declare function boundsUnion(a: TextBounds, b: TextBounds): TextBounds;
/** One entry to check: a text object at a position, or a plain rect (a panel, a button). */
export type TextItem = {
    text: BoundedText;
    x: number;
    y: number;
    opts?: TextTransform;
    id?: string;
} | {
    x: number;
    y: number;
    w: number;
    h: number;
    id?: string;
};
/** One colliding pair, with everything needed to fix it. */
export interface TextOverlap {
    /** Indices into the array you passed in. */
    a: number;
    b: number;
    /** `id` if you gave one, else `'#<index>'`. */
    idA: string;
    idB: string;
    /** The overlapping region. */
    rect: TextBounds;
    /**
     * The SMALLEST move that separates them along one axis: add it to item `b`'s
     * position (or subtract it from `a`'s, or split it between them).
     */
    push: {
        x: number;
        y: number;
    };
}
/**
 * Report every pair of text blocks (and plain rects) whose PAINTED boxes
 * collide. An empty array means the layout is clean — `if (textOverlaps(hud).length)`
 * is the whole check.
 *
 * Bounds include stroke / glow / shadow / plate ink and the largest hover or
 * pressed state, so a menu spaced by this can't collide when an item lights up.
 *
 * ```ts
 * const clashes = textOverlaps([
 *   { text: score,  x: 16, y: 12, id: 'score' },
 *   { text: timer,  x: 16, y: 44, id: 'timer' },
 *   { text: combo,  x: hud.w - 16, y: 12, opts: { origin: { x: 1 } }, id: 'combo' },
 * ], { gap: 6 });
 * for (const c of clashes) console.warn(`${c.idA} overlaps ${c.idB}`, c.push);
 * ```
 */
export declare function textOverlaps(items: readonly TextItem[], opts?: {
    gap?: number;
}): TextOverlap[];

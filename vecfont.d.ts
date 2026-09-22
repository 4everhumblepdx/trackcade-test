// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** A glyph: polylines of flat `x, y, x, y…` coordinates in the 0..1 em box. */
export type Glyph = readonly (readonly number[])[];
/** Every character the face can draw (space included). */
export declare const VECTOR_CHARSET: string;
/**
 * The strokes for one character, in the 0..1 em box. Lowercase folds to
 * uppercase — the faces of the era were caps-only and it halves the table.
 * An unknown character draws nothing (but still advances the pen).
 */
export declare function glyphOutline(ch: string): Glyph;
/** How a run of text sits against its anchor. */
export type VecTextAlign = 'left' | 'center' | 'right';
export interface VecTextOptions {
    /** Cap height in world units (default 24). The em box is square. */
    size?: number;
    /** Gap between glyphs as a fraction of `size` (default 0.28). */
    spacing?: number;
    /** Baseline-to-baseline gap as a fraction of `size` (default 1.6). */
    lineGap?: number;
    /** Horizontal anchor (default 'left'). */
    align?: VecTextAlign;
}
/** Width of one line in world units, for manual layout. */
export declare function textWidth(str: string, opts?: VecTextOptions): number;
/**
 * Lay a string out as POLYLINES in world space — the retained path.
 *
 * Feed the result to `layer.shape()` and the text becomes a real shape that can
 * fly, rotate, restyle and `shatter()`; `layer.text()` is the immediate
 * shortcut over the top of it. `\n` starts a new line.
 */
export declare function textOutline(str: string, x: number, y: number, opts?: VecTextOptions): Array<Array<{
    x: number;
    y: number;
}>>;

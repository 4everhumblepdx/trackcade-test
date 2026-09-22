// Docs: engine/webgpu/text.md — usage, recipes & traps (this file = exact type signatures)
import type { Atlas } from './atlas.js';
export interface Glyph {
    /** Atlas frame index. */
    frame: number;
    /** Draw size in pixels (== world units at scale 1). */
    w: number;
    h: number;
    /** Horizontal pen advance after this glyph. */
    advance: number;
}
export interface FontOptions {
    /** CSS font shorthand (default 'bold 16px monospace'). */
    font?: string;
    /** Characters to bake (default printable ASCII). */
    charset?: string;
}
/** A baked glyph set. Pure data after baking — measure() is headless math. */
export declare class BitmapFont {
    readonly glyphs: ReadonlyMap<string, Glyph>;
    readonly lineHeight: number;
    /** Pen advance for characters without a glyph (space, unknown). */
    readonly spaceAdvance: number;
    constructor(glyphs: ReadonlyMap<string, Glyph>, lineHeight: number, 
    /** Pen advance for characters without a glyph (space, unknown). */
    spaceAdvance: number);
    /** Rendered width of a single line, in world units. */
    measure(text: string, scale?: number): number;
}
/** Rasterize a charset into white glyphs on the atlas (called by game.assets.font()). */
export declare function bakeFont(atlas: Atlas, opts?: FontOptions): BitmapFont;

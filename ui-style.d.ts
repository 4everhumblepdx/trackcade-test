// Docs: engine/webgpu/ui.md — usage, recipes & traps (this file = exact type signatures)
import { type Rgba } from './color.js';
/** Corner radii: one value for all four, `'pill'` (fully round ends), or
 *  `[topLeft, topRight, bottomRight, bottomLeft]`. */
export type UiRadius = number | 'pill' | [number, number, number, number];
/**
 * A panel's look. **Every field is optional** — a style states only what it
 * changes, and `base` inherits the rest from a named style, so the common case
 * is one line: `{ base: 'glossy', fill: '#e6408f' }`.
 *
 * Lengths (`border`, `bevelWidth`, `radius`, `shadowBlur`, …) are in the
 * SURFACE's own units — world units on `game.draw`, CSS pixels on `game.hud` —
 * the same units the panel's own width and height are in. Angles are DEGREES.
 */
export interface UiStyle {
    /** Named style to inherit from (see `UI_STYLES`). Unknown names resolve to the defaults. */
    base?: string;
    /** Corner rounding. `'pill'` rounds the short axis fully. Default 12. */
    radius?: UiRadius;
    /** Fill colour (gradient START). Default '#5a6bb8'. */
    fill?: string;
    /** Gradient END colour. Omit for a flat fill. */
    fillTo?: string;
    /** Gradient direction in degrees: 0 = top→bottom, 90 = left→right. Default 0. */
    fillAngle?: number;
    /** Border/rim thickness, drawn INSIDE the silhouette. 0 disables it. Default 0. */
    border?: number;
    /** Rim colour (gradient START, along `fillAngle`). Default '#ffffff'. */
    borderColor?: string;
    /** Rim gradient END colour. Omit for a flat rim. */
    borderColorTo?: string;
    /** Bevel strength 0..1 — how hard the lit/shaded edge reads. 0 disables it. Default 0. */
    bevel?: number;
    /** How far the bevel reaches in from the edge. Default: the border width, or 6. */
    bevelWidth?: number;
    /** Where the light comes FROM, degrees clockwise from straight up. Default 0 (above). */
    light?: number;
    /** Gloss strength 0..1. 0 disables it. Default 0. */
    gloss?: number;
    /** Fraction of the panel's height the gloss covers. Default 0.45. */
    glossHeight?: number;
    /** How far the gloss is inset from the sides. Default 6. */
    glossInset?: number;
    /** Gloss colour. Default '#ffffff'. */
    glossColor?: string;
    /** Inner shadow strength 0..1. 0 disables it. Default 0. */
    innerShadow?: number;
    /** How far the inner shadow reaches in from the edge. Default 10. */
    innerShadowWidth?: number;
    /** Inner shadow colour. Default '#000000'. */
    innerShadowColor?: string;
    /** Drop shadow strength 0..1. 0 disables it. Default 0. */
    shadow?: number;
    /** Shadow offset. Default x 0, y 4. */
    shadowX?: number;
    shadowY?: number;
    /** Shadow blur radius. Default 10. */
    shadowBlur?: number;
    /** Grow the shadow's silhouette before blurring. Default 0. */
    shadowSpread?: number;
    /** Shadow colour. Default '#000000'. */
    shadowColor?: string;
    /**
     * Lighten (> 0) or darken (< 0) the body and rim, -1..1. This is the RELATIVE
     * knob the state styles want: `tint` can only multiply, so it can darken but
     * never brighten, and a hover that brightens has to work without knowing what
     * colour the panel is. Default 0.
     */
    brightness?: number;
    /** Multiply tint over the finished panel — disabled/greyed states. Default '#ffffff'. */
    tint?: string;
    /** Overall opacity. Default 1. */
    alpha?: number;
    /** Shift the whole panel. A pressed button sinking is `offsetY: 2`. Default 0. */
    offsetX?: number;
    offsetY?: number;
    /**
     * The look while the pointer is over the panel. `true` uses the engine
     * default (a brighten). **Setting this makes the panel interactive.**
     */
    hover?: boolean | UiStateStyle;
    /**
     * The look while the pointer is held down on it. `true` uses the engine
     * default (darken + sink). Also makes the panel interactive.
     */
    pressed?: boolean | UiStateStyle;
    /** Hit-test with no look change — for `panel().clicked` on a flat design. */
    interactive?: boolean;
    /** Show the hand cursor while hovered. Default `true` for interactive panels. */
    cursor?: boolean;
}
/**
 * A hover / pressed look: every APPEARANCE key of {@link UiStyle}, each
 * optional and each falling back to the panel's base look. States cannot
 * nest — a hover style has no `hover` of its own.
 */
export type UiStateStyle = Omit<UiStyle, 'base' | 'hover' | 'pressed' | 'interactive' | 'cursor'>;
/** Which look a panel is drawing this frame. */
export type UiState = 'base' | 'hover' | 'pressed';
/** A style with every field decided — what `UiRenderer.push` packs. Produced by
 *  `resolveUiStyle`; games use {@link UiStyle} and never build one by hand. */
export interface ResolvedUiStyle {
    radius: [number, number, number, number];
    fill: Rgba;
    fillTo: Rgba;
    fillAngle: number;
    border: number;
    borderColor: Rgba;
    borderColorTo: Rgba;
    bevel: number;
    bevelWidth: number;
    light: number;
    gloss: number;
    glossHeight: number;
    glossInset: number;
    glossColor: Rgba;
    innerShadow: number;
    innerShadowWidth: number;
    innerShadowColor: Rgba;
    shadow: number;
    shadowX: number;
    shadowY: number;
    shadowBlur: number;
    shadowSpread: number;
    shadowColor: Rgba;
    tint: Rgba;
    alpha: number;
    offsetX: number;
    offsetY: number;
    interactive: boolean;
    cursor: boolean;
    hasHover: boolean;
    hasPressed: boolean;
}
/** The built-in named styles. Extend with `defineUiStyle()`. */
export declare const UI_STYLES: Record<string, UiStyle>;
/**
 * Register a named style (or replace one). Styles are plain data, so a content
 * pack — or the game-building agent — can ship a whole UI theme without any
 * engine change: `defineUiStyle('rune', { base: 'panel', fill: '#26324a', … })`.
 */
export declare function defineUiStyle(name: string, def: UiStyle): void;
/**
 * Flatten a style (name, object, or object with `base`) into decided numbers,
 * optionally overlaid with its `hover` / `pressed` look.
 *
 * Pure — a shallow merge plus cached colour parses, cheap enough to call per
 * panel per frame, so animating a style field just works. Nothing is memoised
 * on the style object precisely so that a MUTATED style takes effect at once.
 */
export declare function resolveUiStyle(style?: string | UiStyle, state?: UiState): ResolvedUiStyle;

// Docs: engine/webgpu/draw.md, engine/webgpu/text-layout.md, engine/webgpu/unicode-text.md — usage, recipes & traps (this file = exact type signatures)
import { type TextBounds, type TextTransform } from './text-bounds.js';
export type UnicodeAlign = 'left' | 'center' | 'right';
/** `'auto'` picks RTL when the first strong character is Arabic/Hebrew/… */
export type UnicodeDirection = 'ltr' | 'rtl' | 'auto';
/** A multi-stop gradient. `stops` are CSS colours, or `[offset, colour]` pairs. */
export interface TextGradient {
    stops: Array<string | [number, string]>;
    /** Degrees: 90 (default) = top→bottom, 0 = left→right. */
    angle?: number;
}
/** A solid colour, a top→bottom pair, or a full gradient. */
export type TextFill = string | {
    top: string;
    bottom: string;
} | TextGradient;
export interface TextStroke {
    color?: string;
    /** Stroke width in px (default 4). */
    width?: number;
    /** `'outer'` (default) keeps the letterform's inside clean; `'center'` straddles the edge. */
    align?: 'outer' | 'center';
    join?: 'round' | 'bevel' | 'miter';
}
export interface TextShadow {
    x?: number;
    y?: number;
    blur?: number;
    color?: string;
}
/** A halo hugging the letters (a blurred, un-offset shadow, stacked for punch). */
export interface TextGlow {
    color?: string;
    /** Blur radius in px (default 12). */
    blur?: number;
    /** How many times the halo is stacked, 1..6 — brightness/tightness (default 3). */
    strength?: number;
}
/** An underline / strikethrough rule (`true` inherits the fill colour). */
export interface TextRule {
    color?: string;
    /** Line thickness in px (default ~6% of the font size). */
    thickness?: number;
    /** Shift from the default position, px (positive = down). */
    offset?: number;
}
/** A plate painted behind the text (dialogue boxes, name tags, menu buttons). */
export interface TextBackground {
    color?: string;
    /** Extra px around the text block (default 12). */
    padding?: number;
    /** Corner radius in px (default 0). */
    radius?: number;
    borderColor?: string;
    borderWidth?: number;
}
/** Everything a state (base / hover / pressed) can paint. */
export interface TextAppearance {
    color?: TextFill;
    stroke?: TextStroke | null;
    shadow?: TextShadow | TextShadow[] | null;
    glow?: TextGlow | null;
    background?: TextBackground | null;
    underline?: boolean | TextRule;
    strikethrough?: boolean | TextRule;
}
/**
 * A hover / pressed look. Every key is OPTIONAL and falls back to the base
 * style, so `{ color: '#fff', underline: true }` is a complete hyperlink hover.
 *
 * APPEARANCE ONLY — there is deliberately no `fontSize`/`maxWidth` here: a
 * hover that reflows the text would shift everything around it. Use `scale` for
 * a grow-on-hover (draw-time, no re-raster).
 */
export interface TextStateStyle extends TextAppearance {
    /** Uniform scale while in this state (default 1). */
    scale?: number;
    /** Alpha multiplier while in this state (default 1). */
    alpha?: number;
}
export interface UnicodeTextOptions extends TextAppearance {
    /**
     * A full CSS font shorthand — wins over the parts below.
     * e.g. `'700 48px "Noto Sans JP", sans-serif'`.
     */
    font?: string;
    /** Default `'sans-serif'` — the system stack, which falls back per character. */
    fontFamily?: string;
    /** Px (default 48). In world space this is world units; on the HUD, CSS px. */
    fontSize?: number;
    fontWeight?: string | number;
    fontStyle?: 'normal' | 'italic' | 'oblique';
    /** Default: `'left'` for LTR text, `'right'` for RTL. */
    align?: UnicodeAlign;
    /** Base paragraph direction. Default `'auto'`. */
    direction?: UnicodeDirection;
    /** Line box as a multiple of fontSize (default 1.3). */
    lineHeight?: number;
    /** Extra px between characters. TRAP: breaks Arabic joining — leave 0 for Arabic. */
    letterSpacing?: number;
    /** Word-wrap width in px (0 = no wrap). In vertical mode this caps COLUMN length. */
    maxWidth?: number;
    /** Transparent margin around the block in px (default 0). */
    padding?: number;
    /** CJK vertical writing (tategaki): columns stack downward, right to left. */
    vertical?: boolean;
    /**
     * Pin the raster supersample factor. Omit (the default) and the block
     * re-rasterizes itself to stay crisp at whatever size it's drawn.
     */
    resolution?: number;
    /** BCP-47 tag steering line breaking (default: the document's). */
    locale?: string;
    /** The look while the pointer is over it. Setting this makes the block interactive. */
    hover?: TextStateStyle;
    /** The look while the pointer is held down on it. Also makes it interactive. */
    pressed?: TextStateStyle;
    /** Hit-test without a style change (for `text.hovered` / `onClick`). */
    interactive?: boolean;
    /** Grow the clickable area by this many px on every side (fat-finger targets). */
    hitPadding?: number;
    /** Show the hand cursor while hovered. Default `true` for interactive blocks. */
    cursor?: boolean;
}
export interface UnicodeDrawOptions extends TextTransform {
    /** Uniform scale about the origin. */
    scale?: number;
    /** Rotation about the origin, radians. */
    rotation?: number;
    alpha?: number;
    /** Multiply-tint the whole block, hex (`'#ff8080'`). */
    tint?: string;
    /** Anchor as a fraction of the block (0,0 = top-left, 0.5,0.5 = centre). */
    origin?: {
        x?: number;
        y?: number;
    };
    /** Depth 0..1 (0 = frontmost). Text tests-never, so this only orders text vs text. */
    z?: number;
}
/** True when this codepoint is a strong right-to-left character. */
export declare function isRtlCodePoint(cp: number): boolean;
/**
 * The base paragraph direction of a string, by the Unicode "first strong
 * character" rule: leading digits, spaces and punctuation are skipped, then the
 * first letter decides. `'مرحبا 42'` → rtl, `'42 مرحبا'` → rtl, `'Hi مرحبا'` → ltr.
 */
export declare function detectDirection(text: string): 'ltr' | 'rtl';
/**
 * Indices at which a line may be broken (a break happens BEFORE the index).
 * Uses `Intl.Segmenter` word segmentation where available — that is what gets
 * Thai and Khmer (which have no spaces) right — plus per-character breaking for
 * CJK. Kinsoku rules then veto the ugly breaks.
 */
export declare function breakOpportunities(text: string, locale?: string): number[];
/** Split into user-perceived characters (grapheme clusters) — emoji and marks stay whole. */
export declare function graphemes(text: string, locale?: string): string[];
/**
 * A retained, styled block of text in ANY writing system. Create it with
 * `game.assets.unicodeText(str, opts)`, mutate it with the chainable setters,
 * and draw it with `d.unicodeText(text, x, y)` — on the world surface or the
 * HUD.
 *
 * The block lays out and rasterizes lazily: change nothing and a frame costs
 * one quad push.
 */
export declare class UnicodeText {
    private host;
    private _text;
    private o;
    private _lines;
    private _width;
    private _height;
    private dirty;
    private variants;
    private _hovered;
    private _down;
    private _clicked;
    /** The press started ON this block — a drag that began elsewhere can't click it. */
    private armed;
    private prevDown;
    private clickFns;
    get text(): string;
    /** TEXT-box width in px (== draw units at scale 1) — what you ALIGN to. For the
     *  box it actually paints (stroke/glow/shadow/plate) use {@link bounds}. */
    get width(): number;
    /** TEXT-box height in px — see {@link width}. */
    get height(): number;
    /** The wrapped lines (or columns, when vertical). */
    get lines(): readonly string[];
    /** The resolved base direction — useful when `direction: 'auto'`. */
    get resolvedDirection(): 'ltr' | 'rtl';
    /** `true` while the pointer is over this block. */
    get hovered(): boolean;
    /** `true` while the pointer is held down on this block. */
    get held(): boolean;
    /** `true` for the ONE frame a click completed on this block (press AND release on it). */
    get clicked(): boolean;
    /** `true` when this block hit-tests the pointer at all. */
    get isInteractive(): boolean;
    /** Run `fn` when the block is clicked. Returns an unsubscribe function. */
    onClick(fn: (text: UnicodeText) => void): () => void;
    setText(text: string | string[]): this;
    setFont(css: string): this;
    setFontFamily(family: string): this;
    setFontSize(px: number): this;
    setFontWeight(w: string | number): this;
    setColor(c: TextFill): this;
    setStroke(s: TextStroke | null): this;
    setShadow(s: TextShadow | TextShadow[] | null): this;
    setGlow(g: TextGlow | null): this;
    setBackground(b: TextBackground | null): this;
    setUnderline(u: boolean | TextRule): this;
    setStrikethrough(s: boolean | TextRule): this;
    setAlign(a: UnicodeAlign): this;
    setDirection(d: UnicodeDirection): this;
    setLineHeight(m: number): this;
    setLetterSpacing(px: number): this;
    setMaxWidth(px: number): this;
    setVertical(on: boolean): this;
    setPadding(px: number): this;
    /** The look while hovered (`null` removes it). Appearance keys only — see {@link TextStateStyle}. */
    setHoverStyle(s: TextStateStyle | null): this;
    /** The look while held down (`null` removes it). */
    setPressedStyle(s: TextStateStyle | null): this;
    private mark;
    /** Shrink `fontSize` (binary search) until the wrapped block fits `w`×`h` px. */
    fitInside(w: number, h: number, opts?: {
        minSize?: number;
        maxSize?: number;
        precision?: number;
    }): this;
    /** Free every GPU texture. The block re-rasterizes if drawn again. */
    destroy(): void;
    /**
     * The box this block actually PAINTS when drawn at (x, y) with `opts` — the
     * text box grown by stroke, glow, shadow and background-plate ink, then put
     * through origin / scale / rotation. **This is what you space layout against**;
     * `width`/`height` are the tighter text box you ALIGN to.
     *
     * Reserved worst case: the bounds cover the largest of the base, hover and
     * pressed states, so a menu spaced by this cannot collide when an item lights
     * up or grows on hover.
     *
     * ```ts
     * const b = score.bounds(16, 12);
     * timer.setMaxWidth(...); d.unicodeText(timer, 16, b.bottom + 8);   // never overlaps
     * ```
     */
    bounds(x: number, y: number, opts?: TextTransform): TextBounds;
    /**
     * The CLICKABLE box — the text box plus the background plate's padding and
     * `hitPadding`. Deliberately NOT the painted box: a soft glow should not
     * swallow the pointer twenty pixels away from any letter.
     */
    hitBounds(x: number, y: number, opts?: TextTransform): TextBounds;
    private hitPad;
    /** Which states this block can be in — only those actually styled. */
    private states;
    private maxBleed;
    private maxStateScale;
    /** The appearance of one state: its own keys over the base ones. */
    private styleFor;
    private cssFont;
    /** The em size the layout uses — parsed out of a `font` shorthand when given. */
    private emSize;
    private applyFont;
    private ensureLayout;
    private layout;
    /**
     * Greedy wrap at the script-correct break opportunities: take the LAST
     * opportunity that still fits, and hard-break by grapheme when even the first
     * one overflows (a long URL, or CJK with no opportunities at all).
     */
    private wrap;
    /** Vertical columns: graphemes stack downward, `maxWidth` caps the run length. */
    private layoutVertical;
    /** Per-side px of canvas the stroke/shadow/glow/plate ink needs beyond the text box. */
    private inkBleed;
    /** Paint one state's block into a fresh canvas at `res`× supersampling. */
    private raster;
    private paintBackground;
    /** The fill style: a colour string, or a gradient built across the block. */
    private makeFill;
    /** Where a line's anchor x sits, and which canvas textAlign to use for it. */
    private anchor;
    private paintHorizontal;
    /** Underline / strikethrough for one laid-out line. */
    private paintRules;
    private paintVertical;
    /** One run of text: shadows → glow → stroke → fill, in that order. */
    private paintOne;
    /**
     * Hit-test the pointer and advance the press/click edge machine. Returns the
     * state to draw. A click needs the press AND the release on this block, so a
     * drag that began elsewhere can't trigger it.
     */
    private updateInput;
    /**
     * Rasterize + upload this state if needed. `wanted` is how many device pixels
     * one draw unit covers this frame: the block re-rasterizes when it would
     * otherwise be drawn blurry. Quantised to half-steps and RAISE-ONLY (below
     * the cap), so a zooming camera can't churn a fresh texture every frame.
     */
    private ensureRaster;
}

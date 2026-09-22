// Docs: engine/webgpu/fonts.md, engine/webgpu/msdf.md, engine/webgpu/text-layout.md — usage, recipes & traps (this file = exact type signatures)
import type { MsdfFont } from './msdf-font.js';
import { type TextBounds, type TextTransform } from './text-bounds.js';
export type MsdfAlign = 'left' | 'center' | 'right';
/** A colour: `0xRRGGBB`, a CSS-ish `#rgb`/`#rrggbb`/`rgb(r,g,b)` string, or a top→bottom gradient. */
export type MsdfColor = number | string | {
    top: number | string;
    bottom: number | string;
};
export interface MsdfOutline {
    /** Outline width in distance-field units (bounded near 0.5). `0` disables it (unless softness > 0). */
    width?: number;
    color?: number | string;
    alpha?: number;
    /** Blur the outer edge (MTSDF only). With width 0 the outline IS a glow hugging the letters. */
    softness?: number;
    /** Round the outer corners off the true SDF, 0 sharp → 1 round (MTSDF only). */
    rounded?: number | boolean;
    /** Colour at the outline's inner edge — ramps from `color`; forces layered. */
    innerColor?: number | string;
    /** Draw the outline as a separate silhouette pass so a thick outline never covers a neighbour. */
    layered?: boolean;
}
export interface MsdfShadow {
    x?: number;
    y?: number;
    color?: number | string;
    alpha?: number;
    /** Blur (MTSDF only). */
    softness?: number;
    /** Dilate the silhouette before blurring — a fat hard shadow. Works on plain MSDF. */
    spread?: number;
    rounded?: number | boolean;
    innerColor?: number | string;
}
/** An underline / strikethrough rule (`true` inherits everything). */
export interface MsdfRule {
    color?: number | string;
    alpha?: number;
    /** Multiplier on the font's underline thickness. Default 1. */
    thickness?: number;
    /** Em-relative shift from the default position (positive = down). */
    offset?: number;
    /** Cut into dashes: `true` for defaults, or `{ length, gap, radius }` (em-relative). */
    dash?: boolean | {
        length?: number;
        gap?: number;
        radius?: number;
        softness?: number;
    };
}
/** A highlight pill painted behind a run (`true` = marker yellow). */
export interface MsdfHighlight {
    color?: number | string;
    alpha?: number;
    /** Corner radius 0 (square) → 1 (stadium). */
    radius?: number;
    /** Edge blur 0 → 1 (fades inward). */
    softness?: number;
    /** Border ring width 0 → 1. */
    borderWidth?: number;
    borderColor?: number | string;
    /** Em-relative padding (× fontSize). */
    padding?: number;
}
/** A per-run style override (rich text). Every field optional. */
export interface MsdfStyle {
    color?: MsdfColor;
    alpha?: number;
    weight?: number;
    outline?: MsdfOutline;
    shadow?: MsdfShadow;
    skew?: number;
    underline?: boolean | MsdfRule;
    strikethrough?: boolean | MsdfRule;
    highlight?: boolean | MsdfHighlight;
    /** Per-run font-size multiplier (structural — relayout). */
    fontScale?: number;
    /** Per-run font: another loaded MsdfFont, or a face name in a merged atlas. */
    font?: MsdfFont | string;
}
/** A rich-text segment: a bare string (unstyled) or styled text. */
export type MsdfSegment = string | (MsdfStyle & {
    text: string;
});
export interface MsdfTextOptions extends MsdfStyle {
    fontSize?: number;
    align?: MsdfAlign;
    lineSpacing?: number;
    letterSpacing?: number;
    /** Word-wrap width in pixels (0 = no wrap). */
    maxWidth?: number;
}
export interface MsdfDrawOptions {
    /** Uniform scale of the whole block about its origin. */
    scale?: number;
    /** Rotation of the whole block about its origin, in radians. */
    rotation?: number;
    /** Extra alpha multiplier on the whole block. */
    alpha?: number;
    /** Anchor as a fraction of the block (0,0 = top-left, 0.5,0.5 = centre). Default 0,0. */
    origin?: {
        x?: number;
        y?: number;
    };
    /** Depth 0..1 (0 = frontmost). Text tests-never, so this only orders text vs text. */
    z?: number;
}
/**
 * A styled, laid-out block of MSDF text. Create with `game.assets.msdfText(font, str,
 * opts)`; mutate with the chainable setters; draw with `d.msdfText(text, x, y)`.
 */
export declare class MsdfText {
    font: MsdfFont;
    private _text;
    private _segments;
    private _overlays;
    fontSize: number;
    align: MsdfAlign;
    lineSpacing: number;
    letterSpacing: number;
    maxWidth: number;
    private base;
    private laid;
    private rects;
    private lineTops;
    private _width;
    private _height;
    private dirty;
    constructor(font: MsdfFont, text?: string | string[], opts?: MsdfTextOptions);
    get width(): number;
    get height(): number;
    get text(): string;
    /**
     * The box this block PAINTS when drawn at (x, y) with `opts` — the text box
     * grown by outline / shadow ink, through origin / scale / rotation. Use it to
     * space HUD furniture, and `textOverlaps()` to check a whole layout;
     * `width`/`height` are the tighter text box you align to. See text-layout.md.
     *
     * The ink margin is an ESTIMATE that errs generous: outline width and shadow
     * spread are distance-FIELD fractions, whose pixel size depends on the atlas's
     * distanceRange as well as the font size.
     */
    bounds(x: number, y: number, opts?: TextTransform): TextBounds;
    setText(text: string | string[]): this;
    setFont(font: MsdfFont): this;
    setFontSize(size: number): this;
    setAlign(a: MsdfAlign): this;
    setLineSpacing(v: number): this;
    setLetterSpacing(v: number): this;
    setMaxWidth(v: number): this;
    setColor(c: MsdfColor, alpha?: number): this;
    setAlpha(a: number): this;
    setWeight(w: number): this;
    setOutline(o: MsdfOutline | null): this;
    setShadow(s: MsdfShadow | null): this;
    setSkew(k: number): this;
    setUnderline(u: boolean | MsdfRule): this;
    setStrikethrough(s: boolean | MsdfRule): this;
    setHighlight(h: boolean | MsdfHighlight): this;
    /** Set styled text from segments (their text is concatenated into `text`). */
    setRichText(segments: MsdfSegment[]): this;
    /** Overlay a style onto matching spans: a substring, a RegExp, or `{ start, length }`. */
    addStyle(target: string | RegExp | {
        start: number;
        length: number;
    }, style: MsdfStyle): this;
    /** Remove every `addStyle` overlay. */
    clearStyles(): this;
    private mark;
    /**
     * Shrink `fontSize` (binary search) so the word-wrapped text fits `w`×`h`.
     * Permanently sets `fontSize` and `maxWidth`. Shrink-only unless `maxSize` given.
     */
    fitInside(w: number, h: number, opts?: {
        maxSize?: number;
        minSize?: number;
        precision?: number;
    }): this;
    private resolveFace;
    /** Merge a layer's style keys onto a resolved char state. */
    private apply;
    /** Build the per-source-character resolved-style array. */
    private resolveChars;
    private ensure;
    private charAdvance;
    private rebuild;
    private baseResolved;
    /** Merge contiguous same-decoration glyph spans on one line into rects. */
    private buildLineRects;
    private emitRect;
    private wrap;
    private pushGlyph;
    private pushRect;
}

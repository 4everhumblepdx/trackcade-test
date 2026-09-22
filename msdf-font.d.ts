// Docs: engine/webgpu/fonts.md, engine/webgpu/msdf.md — usage, recipes & traps (this file = exact type signatures)
interface AtlasJSON {
    type: 'msdf' | 'mtsdf' | 'sdf';
    distanceRange: number;
    size: number;
    width: number;
    height: number;
    yOrigin: 'top' | 'bottom';
}
interface MetricsJSON {
    emSize: number;
    lineHeight: number;
    ascender: number;
    descender: number;
    underlineY: number;
    underlineThickness: number;
}
interface BoundsJSON {
    left: number;
    top: number;
    right: number;
    bottom: number;
}
interface GlyphJSON {
    unicode: number;
    advance: number;
    planeBounds?: BoundsJSON;
    atlasBounds?: BoundsJSON;
}
interface KerningJSON {
    unicode1: number;
    unicode2: number;
    advance: number;
}
interface VariantJSON {
    name?: string;
    metrics: MetricsJSON;
    glyphs: GlyphJSON[];
    kerning?: KerningJSON[];
}
/** Root msdf-atlas-gen JSON (single font, or a merged `variants` atlas). */
export interface MsdfFontJSON {
    atlas: AtlasJSON;
    metrics?: MetricsJSON;
    glyphs?: GlyphJSON[];
    kerning?: KerningJSON[];
    variants?: VariantJSON[];
}
/**
 * One glyph, laid out in the **y-down, em-normalized** convention (multiply by
 * font size for pixels). `xOffset`/`yOffset` position the quad's top-left from
 * the pen (yOffset negative = above the baseline); `w`/`h` are the quad size;
 * UVs are in image space (v grows downward, `vTop < vBottom`).
 */
export interface MsdfGlyph {
    code: number;
    advance: number;
    xOffset: number;
    yOffset: number;
    w: number;
    h: number;
    uMin: number;
    uMax: number;
    vTop: number;
    vBottom: number;
    kerning: Map<number, number>;
}
/** Parsed, renderer-ready data for one font face (one texture, one field). */
export interface MsdfFontData {
    name: string;
    fieldType: 'msdf' | 'mtsdf' | 'sdf';
    distanceRange: number;
    atlasWidth: number;
    atlasHeight: number;
    /** Em metrics, y-down: ascent/descent positive, underline offset positive-down. */
    ascent: number;
    descent: number;
    lineHeight: number;
    underlineOffset: number;
    underlineThickness: number;
    glyphs: Map<number, MsdfGlyph>;
}
/**
 * Parse an msdf-atlas-gen JSON into one entry per font face. A single-font JSON
 * yields one entry; a merged (`-and`) atlas yields one per variant, all sharing
 * the same texture. Pure — no DOM/GPU.
 */
export declare function parseMsdfFont(json: MsdfFontJSON, baseName?: string): MsdfFontData[];
/**
 * A loaded MSDF font: parsed metrics/glyphs + a GPU atlas texture. Faces sharing
 * a merged atlas share one `texture`. Get a glyph with `glyph(code)`; measure a
 * line with `measure(text, size)`. Draw with `game.assets.msdfText(...)` / `d.msdfText`.
 */
export declare class MsdfFont {
    readonly data: MsdfFontData;
    /** The atlas texture view (shared across faces of a merged atlas). */
    readonly view: GPUTextureView;
    /** Faces packed in the same texture, keyed by name (single-font: just this). */
    readonly faces: Map<string, MsdfFont>;
    constructor(data: MsdfFontData, 
    /** The atlas texture view (shared across faces of a merged atlas). */
    view: GPUTextureView, 
    /** Faces packed in the same texture, keyed by name (single-font: just this). */
    faces?: Map<string, MsdfFont>);
    get name(): string;
    get isMtsdf(): boolean;
    /** distanceRange / atlasSize — the shader's per-texture AA unit (x, y). */
    get unitRange(): [number, number];
    /** 1 / distanceRange — normalises weight/outline/shadow into field fractions. */
    get invRange(): number;
    glyph(code: number): MsdfGlyph | undefined;
    /** Another face packed in the same merged atlas, or `undefined`. */
    face(name: string): MsdfFont | undefined;
    /** Rendered width of a single line (no newlines), in pixels at `fontSize`. */
    measure(text: string, fontSize?: number, letterSpacing?: number): number;
}
/**
 * Upload an MSDF atlas image to a sampleable texture. MSDF/MTSDF values are raw
 * distances, so the copy must NOT premultiply alpha (the MTSDF alpha channel is
 * a true SDF, not opacity) — `copyExternalImageToTexture` leaves it unpremult
 * by default, which is exactly what we want. Linear filtering (set on the
 * renderer's sampler) is mandatory for MSDF.
 */
export declare function msdfTextureFrom(device: GPUDevice, img: TexImageSource, w: number, h: number): GPUTexture;
export {};

// Docs: engine/webgpu/unicode-text.md — usage, recipes & traps (this file = exact type signatures)
import { BitmapFont, type FontOptions } from './font.js';
import { MsdfFont } from './msdf-font.js';
import { MsdfText, type MsdfTextOptions } from './msdf-text.js';
import { UnicodeText, type UnicodeTextOptions } from './unicode-text.js';
import type { DeformDef } from './gridbatch.js';
import { type VfxDef } from './vfx.js';
/**
 * THE ASSET REGISTRY — bake or load something once, get back the handle the
 * draw verbs take: `game.assets.loadFrames(url)`, `game.assets.font()`,
 * `game.assets.msdfFont(png, json)`.
 *
 * Everything here is IDEMPOTENT in its inputs, so calling it in every scene's
 * setup() is free — a repeat request returns the same frame/font and adds
 * nothing to the atlas.
 */
export declare class Assets {
    private readonly host;
    /** Registered frames per url|frameW|frameH — loadFrames/framesOf are idempotent. */
    private frameCache;
    /** Baked bitmap fonts per font|charset — font() is idempotent. */
    private fontCache;
    /** Register sprite frames from a canvas (a horizontal strip slices at `frameW`). Returns the first frame index. */
    frames(src: HTMLCanvasElement, frameW?: number): number;
    /**
     * Load an image file (PNG…) and register its frames — the real-art path.
     * No frameW: one frame. frameW: a horizontal strip. frameW + frameH: a
     * GRID sheet, sliced row-major (left→right, top→bottom). Await this
     * BEFORE run() so the frame indices exist when you draw.
     * Returns the first frame index.
     */
    loadFrames(url: string, frameW?: number, frameH?: number): Promise<number>;
    /**
     * SYNCHRONOUS frames for a preloaded image (queue `load.image(url)` in the
     * scene's preload() first) — the setup()-friendly counterpart of
     * loadFrames. Same slicing rules; idempotent. Throws if the image hasn't
     * loaded yet.
     */
    framesOf(url: string, frameW?: number, frameH?: number): number;
    private registerImage;
    /** A frame's natural size in pixels (== world units at scale 1). */
    frameSize(frame: number): {
        w: number;
        h: number;
    };
    /**
     * Rasterize text once and register it as a frame (for FIXED strings; for
     * anything dynamic use font()). IDEMPOTENT in (str, font, color): a repeat
     * request returns the same frame and adds nothing to the atlas, so calling
     * it in every scene's setup() can't bloat or churn-repack the atlas.
     */
    text(str: string, opts?: {
        font?: string;
        color?: string;
    }): number;
    /**
     * Bake a bitmap font (white glyphs on the shared atlas). Draw with
     * `d.text(font, …)`. IDEMPOTENT: a bake is fully determined by (font,
     * charset), so an identical request returns the SAME BitmapFont and adds
     * NOTHING new to the atlas. Calling `game.assets.font('bold 26px monospace')`
     * in every scene's setup() is therefore free — it can't grow the atlas
     * without bound or churn-repack it (which used to smear glyphs onto static
     * 3D geometry). Bake as many DISTINCT fonts as you like; just don't expect a
     * repeat of the same one to cost anything.
     */
    font(opts?: FontOptions): BitmapFont;
    /**
     * Load an MSDF font — an atlas `.png` + an msdf-atlas-gen `.json` layout —
     * for crisp, scalable, styleable text (weight, outline, shadow, gradients).
     * Await in setup() (queue `load.msdfFont(png, json)` in preload() for the bar).
     * Returns the primary face; a merged (`-and`) atlas exposes the rest via
     * `font.face(name)`. Build text with `game.assets.msdfText(font, str)`; draw
     * it with `d.msdfText(text, x, y)`.
     */
    msdfFont(pngUrl: string, jsonUrl: string, name?: string): Promise<MsdfFont>;
    /** Create a styled, retained MSDF text block. Draw it with `d.msdfText(text, x, y)`. */
    msdfText(font: MsdfFont, text?: string | string[], opts?: MsdfTextOptions): MsdfText;
    /**
     * THE TEXT PATH FOR EVERY WRITING SYSTEM — Chinese, Japanese, Korean, Arabic,
     * Hebrew, Thai, Devanagari, Cyrillic, Greek, emoji (and Latin). The browser's
     * own text engine shapes the string (Arabic joining forms, Indic reordering),
     * applies right-to-left bidi, and falls back per character to a system font
     * that has the glyph; the finished block is rasterized ONCE into its own
     * texture and drawn as a single quad.
     *
     * `d.text` (bitmap) and `d.msdfText` (MSDF) bake a FIXED charset and advance a
     * pen left-to-right — they cannot render any of the above. **Any string that
     * is not plain Latin/digits belongs here.**
     *
     * Returns a retained, mutable block: build it in `setup()`, mutate it with the
     * chainable setters, draw it with `d.unicodeText(t, x, y)` on the world
     * surface or the HUD. See unicode-text.md.
     */
    unicodeText(text?: string | string[], opts?: UnicodeTextOptions): UnicodeText;
    /**
     * Register a CUSTOM vertex deformer (a DeformDef — pure data, the same
     * block-delivery shape as post EffectDefs). Use it by name afterwards:
     * `d.sprite(f, x, y, { deform: { kind: def.name, amount, speed } })`.
     * Call at load time (it recompiles the grid pipeline once).
     */
    deformer(def: DeformDef): void;
    /**
     * Register a CUSTOM vfx recipe (a VfxDef — pure data, the block path). Use it
     * by name afterwards: `this.vfx.burst(def.name, x, y)` for a one-shot, or
     * `this.vfx.trail(def.name)` for a mover's trail.
     */
    vfx(def: VfxDef): void;
}

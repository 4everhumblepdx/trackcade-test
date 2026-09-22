// Docs: engine/webgpu/draw.md, engine/webgpu/index.md, engine/webgpu/msdf.md, engine/webgpu/text.md, engine/webgpu/ui.md, engine/webgpu/unicode-text.md — usage, recipes & traps (this file = exact type signatures)
import { type VecTextOptions } from './vecfont.js';
import type { BitmapFont } from './font.js';
import { type SpriteFx } from './fxbatch.js';
import type { Deform } from './gridbatch.js';
import type { MsdfText, MsdfDrawOptions } from './msdf-text.js';
import type { UnicodeText, UnicodeDrawOptions } from './unicode-text.js';
import { type UiStyle } from './ui-style.js';
import { Ui } from './ui-widgets.js';
/**
 * What a `d.panel()` call reports back about the pointer, this frame. A panel
 * only hit-tests when its style is interactive (it has a `hover`/`pressed` look
 * or sets `interactive: true`); an inert panel reports all-false for free.
 */
export interface PanelState {
    /** The pointer is over the panel. */
    hovered: boolean;
    /** The pointer is held down ON the panel — the look-pressed state. */
    pressed: boolean;
    /**
     * A press that STARTED on this panel is still held, wherever the pointer has
     * moved to since. This is the DRAG flag: a slider keeps tracking when the
     * pointer wanders off the track, where `pressed` would have gone false.
     */
    active: boolean;
    /** Released over the panel this frame, after pressing on it — the click. */
    clicked: boolean;
    /** The offset the panel's style actually applied this frame (a pressed button
     *  sinking). Move a label by these and it stays with its panel. */
    offsetX: number;
    offsetY: number;
}
export interface SpriteOpts {
    /** Draw size in world units (default: the frame's pixel size). */
    w?: number;
    h?: number;
    /** Rotation about the sprite's centre, radians clockwise. */
    rot?: number;
    flipX?: boolean;
    /** Multiply-tint, hex. */
    tint?: string;
    alpha?: number;
    /** Depth override (bigger = in front); default: call order. */
    z?: number;
    /** Force the blend pass (e.g. additive-looking glows drawn as sprites). */
    blend?: boolean;
    /**
     * Tile the frame across the sprite: repeat counts per axis (default 1).
     * Combine with w/h for a tiled region — ground strips, walls, conveyors.
     */
    uvRepeat?: {
        x?: number;
        y?: number;
    };
    /**
     * Scroll the texture inside the sprite, in FRAME fractions (1 = one full
     * frame). Animate per frame for parallax/conveyors/lava — the geometry
     * never moves, only the texture.
     */
    uvScroll?: {
        x?: number;
        y?: number;
    };
    /** Per-OBJECT effects on THIS sprite only — a stacking bag (see effects.md). */
    fx?: SpriteFx;
    /**
     * Vertex-stage deformation: { kind: 'wave' | 'sway' | 'flip' | 'jelly',
     * amount?, speed?, phase? }. Subdivides the sprite into a grid deformed
     * entirely on the GPU — flags, hanging banners, card flips, jiggling
     * slimes. See draw.md's deformer entry.
     */
    deform?: Deform;
}
export declare class Draw {
    private cutout;
    private blend;
    private atlas;
    /** Additive batch (particles/glows); HUD surfaces reuse their blend batch. */
    private add;
    /** Per-object fx batch (outline/dissolve/…); absent on HUD surfaces. */
    private fxb;
    /** True blurred glow (bloom-style); absent on HUD surfaces. */
    private glow;
    /** Deformable grid sprites (wave/sway/flip/jelly); absent on HUD surfaces. */
    private grid;
    /** Filled-polygon batch (the `fill` verb); absent on HUD surfaces. */
    private tri;
    /**
     * The TEXT pass for THIS surface — world space for `game.draw`, screen space
     * for `game.hud`. `msdfText`/`unicodeText` submit into it, which is why the
     * same retained text object can be drawn in either space.
     */
    private textPass;
    /**
     * The pointer in THIS surface's units (world for `game.draw`, CSS pixels for
     * `game.hud`), or null when there is none / input is in its transition
     * grace. Interactive text hit-tests against it.
     */
    private pointerIn;
    /**
     * The UI PANEL pass for THIS surface (see ui.ts). Panels paint over the 2D
     * layer and UNDER this surface's text, so a button's label sits on its
     * body without the game having to think about order.
     */
    private uiPass;
    /**
     * The UI-LABEL batch for THIS surface. Bitmap labels that belong to UI
     * furniture go here rather than into `blend`, and it flushes per LAYER in
     * step with `uiPass` and `textPass` — panels, then their labels, then their
     * MSDF text, one layer at a time. That is what makes a control and its
     * caption one object, and what lets a window claim a layer and stack over
     * another window's text without a stencil.
     *
     * `d.text()` deliberately does NOT come here: it is a scene verb and keeps
     * its free z-ordering among sprites.
     */
    private textq;
    private zCursor;
    private time;
    private viewX;
    private viewY;
    private viewW;
    private viewH;
    /**
     * The clip stack. Each entry is NORMALISED to the surface (0..1), already
     * intersected with its parent, so a nested clip can only ever shrink — the
     * same rule CSS overflow follows.
     */
    private clipStack;
    /** 0 = the normal UI, 1 = overlays (open dropdowns, tooltips). See ui.ts. */
    /**
     * The current LAYER. 0 is the frame's ordinary content — sprites, shapes,
     * text and panels alike, ordered purely by the order the game drew them. A
     * window or modal claims 1, 2, … and everything it draws goes wholly above
     * everything below, which is the only thing call order cannot express.
     */
    private uiLayer;
    /** Deepest layer any window reached this frame — overlays go one above it. */
    private maxUiLayer;
    /** How far down anything has been drawn while measuring is on (see
     *  {@link beginMeasure}); -Infinity when nothing has been drawn yet. */
    private measureBottom;
    private measuring;
    /** This surface's width in its own units this frame (`game.view.w` for
     *  `game.draw`, the HUD reference for `game.hud`). */
    get w(): number;
    /** This surface's height in its own units this frame — see {@link w}. */
    get h(): number;
    private _ui;
    private uiDeps;
    /**
     * The WIDGET layer for this surface — `button`, `checkbox`, `toggle`,
     * `slider`, `progress`, `window`, `input`, `textarea`, `list` (see ui.md),
     * named after HTML's. Built on `panel()`,
     * so widgets inherit its size-independence and restyle from one theme.
     *
     * ```ts
     * if (d.ui.button(x, y, 180, 52, 'Start')) startGame();
     * ```
     */
    get ui(): Ui;
    /** Centre `opts.label` on a panel that has just been pushed, on its layer. */
    private panelLabel;
    /** Press state per interactive panel, keyed by its id (explicit or implicit). */
    private panelMemory;
    /** The implicit-id cursor: which interactive panel this is, in call order. */
    private panelSeq;
    private frameNo;
    /**
     * Clip everything drawn until the matching {@link popClip} to this rectangle,
     * in the SURFACE's own units. Nested clips intersect, so a child can never
     * paint outside its parent.
     *
     * This is how a scrolling region, a masked panel, or a text field that must
     * not spill over its neighbours are built:
     * ```ts
     * d.pushClip(x, y, w, h);
     * for (const item of items) d.ui.button(x, y + item.top - scroll, w, 40, item.name);
     * d.popClip();
     * ```
     *
     * **Panels and text obey it; sprites, lines and shapes do not yet** — it is a
     * hardware scissor on the UI and text passes (see ui.md).
     */
    pushClip(x: number, y: number, w: number, h: number): void;
    /** Pop the innermost clip pushed by {@link pushClip}. */
    popClip(): void;
    /** The clip in force right now, or null. */
    private get clip();
    /** Text submitters don't take a clip argument, so the text pass carries the
     *  current one and reads it inside alloc(). */
    private syncClip;
    /**
     * Is any of this rect visible through the current clip? Widgets use it to
     * skip work for rows scrolled out of view — clipping stops them DRAWING, this
     * stops them being built at all.
     */
    visible(x: number, y: number, w: number, h: number): boolean;
    /** A textured sprite: `frame` is an index from game.assets.frames()/game.assets.text(). */
    sprite(frame: number, x: number, y: number, opts?: SpriteOpts): void;
    /** A solid rectangle (optionally rotated about its centre). */
    rect(x: number, y: number, w: number, h: number, color?: string, alpha?: number, rot?: number): void;
    /** A line segment with width — a rotated solid quad centred on the segment. */
    line(x0: number, y0: number, x1: number, y1: number, width: number, color?: string, alpha?: number): void;
    /** A polyline: segments + round joints — smooth corners without miter maths. */
    poly(points: ReadonlyArray<{
        x: number;
        y: number;
    }>, width: number, color?: string, alpha?: number): void;
    /**
     * The stroked VECTOR FACE as ordinary polylines — the same glyphs
     * `game.vector.text()` draws, but through the draw verbs, so it works on the
     * **HUD surface** where the vector layer cannot reach.
     *
     * ```ts
     * override drawHud(d: Draw): void {
     *   d.vectorText('SCORE 004200', 22, 18, { size: 22, color: '#cdd8ff' });
     * }
     * ```
     *
     * Why this exists: the vector layer is one world-space pass drawn BEFORE the
     * HUD, so a scrolling game's readouts would slide away with the camera. This
     * puts the letterforms on the HUD in screen space, correctly ordered with
     * every other HUD element.
     *
     * The trade is the BEAM: these are plain quads, so there is no phosphor halo
     * and no `dwell`. For glowing text inside the world, use `game.vector.text()`.
     */
    vectorText(str: string, x: number, y: number, opts?: VecTextOptions & {
        width?: number;
        color?: string;
        alpha?: number;
    }): void;
    /**
     * A FILLED polygon of arbitrary shape (ear-clipped into triangles). Points in
     * world units, any simple polygon (convex or concave). Flat colour, alpha
     * blended — the fill counterpart to `poly()`'s stroke.
     */
    fill(points: ReadonlyArray<{
        x: number;
        y: number;
    }>, color?: string, alpha?: number): void;
    /** An anti-aliased filled circle (analytic SDF — crisp at any radius). */
    circle(cx: number, cy: number, radius: number, color?: string, alpha?: number): void;
    /** An anti-aliased ring / circle outline with a stroke thickness in world units. */
    ring(cx: number, cy: number, radius: number, thickness: number, color?: string, alpha?: number): void;
    /**
     * A UI PANEL — the procedural interface primitive: a rounded box whose rim,
     * bevel, gloss, inner shadow and drop shadow are all computed from the shape
     * itself (see ui.md). Buttons, frames, slots, bars, tooltips, dialogs.
     *
     * There is NO source art and nothing stretches: the same call gives a 40-unit
     * chip and a 900-unit dialog the same crisp 5-unit rim, at any zoom.
     *
     * ```ts
     * d.panel(x, y, 200, 64, 'glossy');                        // a named style
     * d.panel(x, y, 200, 64, { base: 'glossy', fill: '#e6408f', fillTo: '#a01f5e' });
     * ```
     *
     * Panels paint over the 2D scene and UNDER this surface's text, so a label
     * drawn after the panel lands on top of it whatever the call order.
     */
    panel(x: number, y: number, w: number, h: number, style?: string | UiStyle, opts?: {
        rot?: number;
        /**
         * Identity for the press/click machine. Defaults to the panel's position
         * among the INTERACTIVE panels drawn this frame, which is stable for a
         * fixed layout. Pass an explicit id when interactive panels appear and
         * disappear conditionally, or the ids after the gap shift by one.
         */
        id?: string | number;
        /**
         * A caption centred on the panel, drawn as PART OF IT — same layer, always
         * on top of the body, and it moves with the panel when a pressed style
         * sinks. This is the supported way to label a bespoke control.
         *
         * Do NOT reach for `d.text` here: that is a scene verb with its own
         * z-ordering among sprites, and nothing guarantees it lands on the panel.
         * Uses the zero-setup bitmap font; for styled or non-Latin captions build
         * the control from `d.ui.*` instead.
         */
        label?: string;
        /** Caption colour (default: the widget theme's text colour). */
        labelColor?: string;
        /** Caption size in surface units (default: the widget theme's fontSize). */
        labelSize?: number;
    }): PanelState;
    /**
     * A single line of bitmap-font text. Glyphs are pre-baked white quads —
     * per-frame changing strings cost nothing but pushes, and `color` tints
     * them per instance. x is the anchor per `align` (left edge by default).
     */
    text(font: BitmapFont, str: string, x: number, y: number, opts?: {
        scale?: number;
        color?: string;
        alpha?: number;
        align?: 'left' | 'center' | 'right';
        z?: number;
    }): void;
    /** Lay a string out as quads into `batch`, pen already positioned for align. */
    private glyphs;
    /**
     * Submit a retained MSDF text block (from `game.assets.msdfText(...)`) at (x, y) —
     * crisp at any scale, with per-object/run weight, outline, shadow, gradients
     * and decorations. Lay it out once (set text/style on the object), then draw
     * it each frame here; changing strings only re-lays-out that object.
     */
    msdfText(text: MsdfText, x: number, y: number, opts?: MsdfDrawOptions): void;
    /**
     * Draw a retained UNICODE text block (from `game.assets.unicodeText(...)`) at
     * (x, y) — **the path for Chinese, Japanese, Korean, Arabic, Hebrew, Thai,
     * Devanagari, Cyrillic and emoji**, with correct shaping, right-to-left bidi
     * and system font fallback. Styles (gradient / stroke / shadow / glow /
     * background plate) are baked into the block, so a frame is one quad.
     *
     * Works on BOTH surfaces: `game.draw` (world space, scrolls with the camera)
     * and `game.hud` (screen space, CSS pixels). See unicode-text.md.
     *
     * Drawing is also what drives INTERACTION: a block with a `hover`/`pressed`
     * style (or `interactive: true`) hit-tests this surface's pointer here, so
     * `text.hovered` / `text.clicked` are current straight after this call.
     */
    unicodeText(text: UnicodeText, x: number, y: number, opts?: UnicodeDrawOptions): void;
}

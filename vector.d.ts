// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import { type VecTextOptions } from '../vecfont.js';
import { VectorShape, VecTrail, VecStarfield, type VectorShapeOptions, type LineStyle, type VecPt, type VecClipRect, type VecTrailOptions, type VecStarfieldOptions, type VecEmitOptions } from '../vector.js';
/** Vertex shader — the GLSL port of buildLineWGSL's `vs`; the xf table reads
 *  from an RGBA32F data texture (2 texels per slot). */
export declare const buildLineVertGLSL: (stamp?: boolean) => string;
/** Vertex shader for SOLID FACES — the GLSL twin of buildFillWGSL. Reads the
 *  same xf transform texture as the lines, and carries a colour PER VERTEX so
 *  a gradient costs no uniform and no second pass. */
export declare const buildFillVertGLSL: () => string;
export declare const buildFillFragGLSL: () => string;
/** Fragment shader — the GLSL port of buildLineWGSL's `fs` (capsule SDF,
 *  dash gate, hairline flat cut; STAMP = soft glow core for the GlowPass). */
export declare const buildLineFragGLSL: (stamp?: boolean) => string;
/**
 * The layer: retained shapes + fragments + immediate pushes — the GL twin of
 * VectorLayer. Two programs, two instance VBOs (static repacks only when
 * dirty; dynamic re-uploads each frame), one xform data texture.
 */
export declare class GlVectorLayer {
    /** @see VectorLayer.clip — clip the whole layer to a world rect (the glow
     *  stamp is scissored with it, so halos are cut at the same edge). */
    clip: VecClipRect | null;
    /** @see VectorLayer.fills — null (default) auto-detects, true/false force. */
    fills: boolean | null;
    /** How wide the widest live glow stamp is (0 = nothing glows) — the
     * renderer wakes the shared GlowPass with it. Valid after prepare(). */
    glowSize: number;
    private shapes;
    private fragments;
    private trails;
    /** The view rect this layer is drawing — what an unbounded starfield uses. */
    get viewRect(): {
        x: number;
        y: number;
        w: number;
        h: number;
    };
    /**
     * A STARFIELD behind the game — parallax drift, or a warp tunnel into the
     * screen. Everything about it is a live property; see `VecStarfield`.
     *
     * ```ts
     * const sky = game.vector.starfield({ count: 300, speed: 60, angle: Math.PI });
     * sky.speed = 60 + throttle * 900;                    // live
     * const tunnel = game.vector.starfield({ mode: 'warp', speed: 320, streak: 0.05 });
     * ```
     *
     * The layer steps and draws it — there is nothing to call per frame.
     * `kill()` removes it.
     */
    starfield(opts?: VecStarfieldOptions): VecStarfield;
    /** Runs across frames so a stream cycles a colour source smoothly. */
    private colorSeq;
    private rng;
    private fillData;
    private fillOpaque;
    private fillBlend;
    private fillVbo;
    private fillVboBytes;
    private fillProgram;
    private uViewLocFill;
    private slotOf;
    private staticData;
    private staticCount;
    private dynData;
    private dynCount;
    private dynGlow;
    private xformData;
    private uniformData;
    private gl;
    private program;
    private stampProgram;
    private uViewLoc;
    private uViewLocStamp;
    private vao;
    private staticVbo;
    private staticVboBytes;
    private dynBuf;
    private dynVbo;
    private xfTex;
    private xfTexWidth;
    constructor(gl: WebGL2RenderingContext);
    /** Live counts (debug/HUD). */
    get counts(): {
        shapes: number;
        fragments: number;
        segments: number;
    };
    /** Add a retained shape from an outline (see VectorShapeOptions). */
    shape(points: readonly VecPt[], opts?: VectorShapeOptions): VectorShape;
    /** @see VectorLayer.trail — a ribbon that follows a moving point. */
    trail(opts?: VecTrailOptions): VecTrail;
    /** Immediate one-frame segment (aim lines, scanner sweeps, lightning). */
    seg(x0: number, y0: number, x1: number, y1: number, style?: LineStyle): void;
    /** Immediate one-frame polyline. */
    poly(points: readonly VecPt[], style?: LineStyle, closed?: boolean): void;
    /**
     * Immediate arc — `from` and `to` in radians, clockwise (y is down, so
     * -PI/2 is straight up). A full circle is `arc(x, y, r, 0, Math.PI * 2)`.
     *
     * ```ts
     * game.vector.arc(cx, cy, 90, -0.5, 0.5, { color: '#41d6ff', glow: 0.9 });
     * ```
     *
     * `steps` overrides the tessellation (default: one segment per ~11°). For a
     * ring that ROTATES or breaks apart, build it retained instead — see
     * `vectorKit.ringSections()`.
     */
    arc(cx: number, cy: number, r: number, from: number, to: number, style?: LineStyle, steps?: number): void;
    /**
     * Draw a line of text AS LINE ART — the same beam that draws everything else.
     *
     * ```ts
     * game.vector.text('SCORE 004200', 20, 20, { size: 26, style: { color: '#39f0a0', glow: 0.8 } });
     * game.vector.text('GAME OVER', cx, cy, { size: 70, align: 'center', colors: 'rainbow' });
     * ```
     *
     * Caps-only (lowercase folds up), straight strokes only, `\n` starts a new
     * line. It takes everything a line takes — `width`, `glow`, `dash`, and a
     * `colors` SOURCE stepped per stroke.
     *
     * This is the immediate path. To make text a real object that can fly,
     * rotate and `shatter()`, build it with `vectorKit.textOutline()` and hand
     * the polylines to `shape()`.
     */
    text(str: string, x: number, y: number, opts?: VecTextOptions & {
        style?: LineStyle;
    }): void;
    /** Advance fragments (Game ticks this). */
    /**
     * Spawn a burst of VECTOR particles — little outlines that fly, spin, fade
     * and glow with the rest of the layer.
     *
     * ```ts
     * game.vector.emit({ x, y, count: 24, shape: ['triangle', 'square'],
     *                    size: 7, speed: 160, spin: 6,
     *                    style: { color: '#41d6ff', width: 2, glow: 0.9 } });
     * ```
     *
     * They cost what any other segments cost: same buffers, same transform slot,
     * same glow stamp. Mixing `shape` kinds picks one per particle.
     */
    emit(opts: VecEmitOptions): void;
    update(dt: number): void;
    /** Start a frame (same world rect as the sprite batches). */
    begin(viewX: number, viewY: number, viewW: number, viewH: number): void;
    /**
     * Upload everything for this frame: repack static data if dirty, pack the
     * live transform table into the xf data texture, upload the dynamic
     * pushes, and measure the glow. The renderer calls this BEFORE the
     * GlowPass renders (the stamps draw there).
     */
    prepare(): void;
    /**
     * Draw the crisp scene lines (static + dynamic, two draws max) into the
     * current framebuffer. `pxW`/`pxH` are the framebuffer's pixel size, needed
     * only to turn `clip` into a scissor.
     */
    draw(pxW?: number, pxH?: number): void;
    /** Draw the soft glow stamps into the GlowPass's half-res target (the
     *  renderer hands this as the extra-stamps callback — the stamp FBO is
     *  bound). MAX blend so overlapping caps saturate; FUNC_ADD restored. */
    stampGlow(pxW?: number, pxH?: number): void;
    private drawWith;
    /** Kill everything (scene teardown). */
    clear(): void;
    /** (Re)create every GL-side object — the context-loss recovery path. */
    rebuild(gl: WebGL2RenderingContext): void;
    private pushDyn;
    private repackStatic;
}

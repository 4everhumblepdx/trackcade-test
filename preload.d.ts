// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import { Scene } from './scene.js';
import type { Draw } from './draw.js';
/**
 * Asset queue passed to `Scene.preload(load)`. Each method queues one asset;
 * the cache is warmed so later calls to `game.assets.framesOf(url)`, `loadJson`, or
 * `this.sound.play(url)` resolve instantly.
 */
export declare class Preload {
    private readonly _audio?;
    private readonly _loadModel?;
    private items;
    private _done;
    private _pending;
    private track;
    /** Queue an image — register its frames with `game.assets.framesOf(url, frameW?, frameH?)` in setup(). */
    image(url: string): void;
    /** Queue a GLB model — its geometry + textures load + cache now; `world.loadGlb(url)` in setup() builds it instantly. */
    glb(url: string): void;
    /** Queue an OBJ model (+ its MTL / textures) — caches now; `world.loadObj(url)` in setup() builds it instantly. */
    obj(url: string): void;
    private model;
    /** Queue a text / CSV file — available via `loadText(url)` once `preload` resolves. */
    text(url: string): void;
    /** Queue and parse a JSON file — available via `loadJson(url)` once `preload` resolves. */
    json(url: string): void;
    /** Queue an MSDF font pair (atlas .png + msdf-atlas-gen .json) — build it with `game.assets.msdfFont(png, json)` in setup(). */
    msdfFont(pngUrl: string, jsonUrl: string): void;
    /**
     * Queue a WEB FONT file (woff2 / woff / ttf / otf) under `family`, then bake
     * it in setup() with `game.assets.font({ font: '32px ' + family })`.
     *
     * REQUIRED for any non-system face. Baking rasterizes whatever the browser
     * has for that family AT THAT MOMENT: bake before the file lands and you
     * silently get the fallback (Arial-ish), permanently — glyphs go onto the
     * atlas once. Queuing here makes the font an awaited asset like any other,
     * so setup() can't run early.
     */
    font(family: string, url: string): void;
    /** Queue a binary file — available via `loadBinary(url)` once `preload` resolves. */
    binary(url: string): void;
    /** Queue an audio / SFX file — available via `this.sound.play(url)` once `preload` resolves. */
    audio(url: string): void;
    /** Number of assets queued. */
    get count(): number;
    /**
     * How many queued assets actually need loading — i.e. weren't already in a
     * cache when queued. The boot shows the loading screen only when this is
     * > 0, so re-declaring assets loaded once up-front (the "load everything at
     * the start, scenes reuse" pattern) costs nothing.
     */
    get pending(): number;
    /** Load progress 0..1 across all queued assets (1 when nothing is queued). */
    get progress(): number;
    /** Promise that resolves once every queued asset has settled (success or failure). */
    all(): Promise<void>;
}
/**
 * Built-in minimum time (ms) the loading bar takes to ease to full. A local/
 * cached load can complete inside a single frame; without this the bar would
 * snap straight to 100%. The displayed value never exceeds REAL progress.
 */
export declare const LOADING_MIN_MS = 300;
/**
 * The value the loading bar should display: the lesser of real load progress
 * and a linear ramp over `minMs` — eases an instant local load into a smooth
 * fill while never showing more than is actually loaded.
 */
export declare function loadingBarProgress(real: number, elapsedMs: number, minMs?: number): number;
/**
 * One frame of the loading fill CHASING its target. Real progress is a step
 * function — one jump per file that finishes — so a bar drawn straight from it
 * stands dead still through the whole of a big download and then snaps. Easing
 * keeps it gliding, which is what makes the bar read as alive.
 *
 * Framerate-independent exponential approach, plus a small floor so it creeps
 * even when the gap is tiny. Never overshoots the target and never goes
 * backwards. Exported for tests.
 */
export declare function easeLoadingFill(shown: number, target: number, dt: number): number;
/**
 * Built-in loading screen shown while a scene's assets load — a rounded
 * capsule bar filled with a flowing multi-colour gradient, a soft glow, and a
 * fountain of sparks trailing the leading edge, easing to full over at least
 * {@link LOADING_MIN_MS}, with a percentage readout. Sits on the game's
 * background colour. Replace with `GameOptions.drawLoading(d, progress)` for a
 * custom look.
 *
 * Everything animates on TIME, not on progress, and the fill eases toward its
 * target rather than snapping — so the bar keeps moving through a long
 * single-file download, when real progress reports nothing at all.
 */
export declare class LoadingScene extends Scene {
    progressFn: () => number;
    custom?: (d: Draw, progress: number) => void;
    private elapsedMs;
    /** The DISPLAYED fill, chasing the real value (see update). */
    private shown;
    private font;
    update(dt: number): void;
    drawHud(d: Draw): void;
}

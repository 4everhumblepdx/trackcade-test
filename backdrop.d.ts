// Docs: engine/webgpu/backdrops.md — usage, recipes & traps (this file = exact type signatures)
/** A backdrop as pure data — the MCP-block delivery shape. */
export interface BackdropDef {
    name: string;
    /** Scalar params (max 8) with defaults — retune live via handle.set(). */
    params?: Record<string, number>;
    /** Up to two named colour slots (declaration order → c0, c1). */
    colors?: Record<string, string>;
    /** The WGSL snippet — writes `color`. See the module header contract. */
    code: string;
    /** Optional GLSL ES 3.0 twin of `code` — same variable scope (`uv`, `px`,
     * `time`, `view`, `c0`/`c1`, named params, `TAU`, hash21/noise2/fbm2,
     * `bg`/`bgAt(p)`, result in `color`), spliced by the WebGL fallback. A def
     * without one is SKIPPED there (one console warn). */
    glsl?: string;
}
/** Pure WGSL assembly (headless-testable). */
export declare function buildBackdropWGSL(def: BackdropDef): string;
export declare const BACKDROPS: Record<string, BackdropDef>;
export declare const BACKDROP_PACK: Record<string, BackdropDef>;
/** A live backdrop layer — retune (`set`/`setColor`) or `remove()` it. */
export declare class BackdropHandle {
    readonly def: BackdropDef;
    private chain;
    /** Update a scalar parameter (by the name declared in the def). */
    set(param: string, value: number): this;
    /** Update a colour slot (by the name declared in the def). */
    setColor(name: string, hex: string): this;
    /** Remove this backdrop layer. */
    remove(): void;
}
/** Anything that can become the backdrops' background image. */
export type BackgroundSource = GPUTexture | HTMLCanvasElement | OffscreenCanvas | HTMLImageElement | ImageBitmap;
/**
 * All active backdrop layers. Drawn first in the frame — into the 3D pass
 * when a world exists (behind the meshes), else into the scene pass —
 * with pipelines cached per (def, sampleCount). Device-loss rebuildable.
 */
export declare class BackdropChain {
    private format;
    private layers;
    private pipelines;
    private layout;
    private device;
    private sampler;
    private defaultTex;
    private bgTex;
    private hasBg;
    private bgLayout;
    private bgPipelines;
    private bgBind;
    private bgBindTex;
    constructor(device: GPUDevice, format: GPUTextureFormat);
    /**
     * Set (or clear, with null) the background image the backdrops render OVER. It is
     * drawn beneath the layers (so overlays composite over the real pixels) and is
     * sampleable inside a snippet via `bg` / `bgAt(uv)`. Accepts a GPUTexture or any
     * canvas / image / bitmap (uploaded to a texture).
     */
    setBackground(source: BackgroundSource | null): void;
    /** Anything to draw? (Game skips the frame + draw entirely when not.) True when
     *  there are layers, or a background image is set (drawn even with no layer over it). */
    get active(): boolean;
    /** Append a layer (built-in name or a custom BackdropDef — the block path). */
    add(backdrop: string | BackdropDef, params?: Record<string, number>): BackdropHandle;
    /** Remove every layer. */
    clear(): void;
    /** (Re)create GPU objects — the device-loss recovery path. */
    rebuild(device: GPUDevice): void;
    private bgPipelineFor;
    private pipelineFor;
}
/**
 * THE BACKDROP STACK — full-screen layers drawn BEHIND the world and
 * camera-aware (a starfield parallaxes with the view): `game.backdrop.add('stars')`,
 * `game.backdrop.clear()`, `game.backdrop.background(img)`. Built-ins by name
 * ('sky', 'stars', 'aurora', 'nebula', 'sunset') or a custom BackdropDef.
 *
 * Behind the world; `game.post` is the twin that draws OVER the finished frame.
 */
export declare class BackdropLayer {
    private readonly chain;
    /**
     * Add a backdrop layer (layers stack in add order). Returns a handle:
     * `.set(param, v)` / `.setColor(name, hex)` to retune live, `.remove()` to drop.
     */
    add(backdrop: string | BackdropDef, params?: Record<string, number>): BackdropHandle;
    /** Remove every backdrop layer. */
    clear(): void;
    /**
     * Set (or clear, with null) the BACKGROUND IMAGE the layers render OVER — a
     * game's title art, a level's photo, or (in the Foundry) a checkerboard. It is
     * drawn beneath the backdrop layers and is sampleable inside a snippet via the
     * pre-sampled `bg` (vec4f at the current pixel) or `bgAt(uv)` (sample elsewhere,
     * e.g. for displacement / warp). Accepts a GPUTexture or any canvas / image / bitmap.
     */
    background(source: BackgroundSource | null): void;
}

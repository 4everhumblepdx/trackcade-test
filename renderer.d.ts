// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import { GlContext } from './context.js';
import { GlQuadBatch } from './quadbatch.js';
import { DrawOrder } from '../batch.js';
import { GlTriBatch } from './tribatch.js';
import { GlMsdfRenderer } from './msdf.js';
import { GlUiRenderer } from './ui.js';
import { GlFxBatch } from './fxbatch.js';
import { GlGridBatch } from './gridbatch.js';
import { GlVectorLayer } from './vector.js';
import { GlGlowPass } from './glowpass.js';
import { GlPostChain } from './post.js';
import { GlBackdropChain } from './backdrop.js';
import { GlLights2d } from './lights2d.js';
export interface GlRendererOptions {
    dprCap?: number;
    onError?: (msg: string) => void;
    /** Blocky pixel-art sampling for the sprite batches (see GameOptions.pixelArt). */
    pixelArt?: boolean;
}
/** The scene-FBO handles a depth-consuming world renders against. */
export interface GlSceneTarget {
    fbo: WebGLFramebuffer;
    depthTex: WebGLTexture;
    width: number;
    height: number;
}
/** The 3D surface the renderer needs — implemented by GlWorld3d (webgl3d/). */
export interface GlWorldLike {
    render(width: number, height: number, scene?: GlSceneTarget | null): void;
    setTexture(view: unknown): void;
    /** True when a depth-consuming feature (SSAO / rays / underwater / soft
     * water) is live — the renderer then routes the WHOLE scene through the
     * offscreen FBO so its depth is a sampleable texture. */
    readonly needsDepthTexture?: boolean;
}
export interface GlFrameOptions {
    width: number;
    height: number;
    bg: readonly [number, number, number, number];
    time: number;
    world: GlWorldLike | null;
    hudAboveFx: boolean;
}
export declare class GlRenderer {
    readonly ctx: GlContext;
    readonly cutoutBatch: GlQuadBatch;
    readonly blendBatch: GlQuadBatch;
    readonly addBatch: GlQuadBatch;
    readonly hudBatch: GlQuadBatch;
    /** `d.text()` glyphs — world and screen. Flushed in the TEXT slot, over panels. */
    readonly textBatch: GlQuadBatch;
    readonly hudTextBatch: GlQuadBatch;
    readonly triBatch: GlTriBatch;
    readonly msdf: GlMsdfRenderer;
    /** The screen-space text pass (`game.hud`'s msdfText / unicodeText). */
    readonly msdfHud: GlMsdfRenderer;
    /** The UI panel passes — world space and screen space (see ui.ts). */
    readonly ui: GlUiRenderer;
    readonly uiHud: GlUiRenderer;
    readonly fxBatch: GlFxBatch;
    readonly gridBatch: GlGridBatch;
    readonly vector: GlVectorLayer;
    readonly glowPass: GlGlowPass;
    readonly postChain: GlPostChain;
    readonly backdrops: GlBackdropChain;
    /** Submission order per surface — quads and scene text interleaved. Owned by
     *  Game (it drives begin()); the renderer only reads them at draw time. */
    readonly sceneOrder: DrawOrder;
    readonly hudOrder: DrawOrder;
    private lights;
    private atlasTexture;
    private world;
    /** The verbatim twin of Game.walkSurface — replay one surface's 2D content in
     *  the order the game drew it, one layer at a time. See there for why. */
    private walkSurface;
    private constructor();
    /** Acquire a WebGL2 context and stand the backend up. Null where absent. */
    static init(canvas: HTMLCanvasElement, opts?: GlRendererOptions): Promise<GlRenderer | null>;
    get gl(): WebGL2RenderingContext;
    fit(): boolean;
    get dead(): boolean;
    markDirty(): void;
    onRebuild(fn: () => void): () => void;
    /** The 2D lights layer, created on first access (mirrors Game.lights2d). */
    createLights2d(): GlLights2d;
    /** The GL 3D world, once game.world3d() has built one — lets the frame and
     *  atlas uploads reach it. */
    attachWorld(world: GlWorldLike | null): void;
    /** Upload the packed atlas canvas and point every twin at it. */
    uploadAtlas(canvas: HTMLCanvasElement): void;
    /** Upload an MSDF font atlas (no premultiply, linear — see msdf-font.ts). */
    msdfTexture(source: TexImageSource): WebGLTexture;
    /** Upload a rasterized UnicodeText block (PREMULTIPLIED — the text pass blends premultiplied). */
    textTexture(source: TexImageSource): WebGLTexture;
    /** Release a texture handed out by `textTexture` (a re-rasterized block). */
    deleteTexture(tex: WebGLTexture): void;
    /** Render one complete frame — the GL twin of the WebGPU encoder tail. */
    renderFrame(opts: GlFrameOptions): void;
    destroy(): void;
}

// Docs: engine/webgpu/debug.md, engine/webgpu/draw.md, engine/webgpu/effects.md, engine/webgpu/index.md, engine/webgpu/layout.md, engine/webgpu/msdf.md, engine/webgpu/particles.md, engine/webgpu/scenes.md, engine/webgpu/screen.md, engine/webgpu/sprites.md, engine/webgpu/text.md, engine/webgpu/world3d.md — usage, recipes & traps (this file = exact type signatures)
import { Draw } from './draw.js';
import { Scene, type SceneRoster } from './scene.js';
import type { Camera } from './camera.js';
import { Particles } from './particles.js';
import type { World3d, World3dOptions } from './world3d.js';
import { VectorLayer } from './vector.js';
import { Lights2d } from './lights2d.js';
import { Input } from './input.js';
import { type DebugOptions } from './debug.js';
import { Audio } from './audio.js';
import { Tween } from './tween/index.js';
import { Screen } from './screen.js';
import { Assets } from './game-assets.js';
import { PostLayer } from './post.js';
import { BackdropLayer } from './backdrop.js';
export interface GameOptions {
    /**
     * Where to mount the game. Pass a host element or a selector for one — the
     * engine ALWAYS creates its own `<canvas>` inside it (guaranteeing a WebGPU
     * context, never a stray WebGL one). Omit to fill the viewport (a fullscreen
     * canvas appended to `<body>`).
     */
    container?: HTMLElement | string;
    /** Logical world height — the ONE authored dimension (default 768). */
    worldHeight?: number;
    /** Clear colour, hex (default '#0b0e1a'). */
    background?: string;
    /** Fixed simulation step in seconds for onStep callbacks (default 1/60). */
    fixedStep?: number;
    /**
     * THE art axis. false (default): smooth — linear sampling, high-res art
     * scales cleanly. true: pixel art — sprites render at NATIVE resolution
     * but sample their texels BLOCKY (snapped to texel centres, one-screen-
     * pixel AA seams): fat crisp pixels with float-smooth motion, rotation
     * and scaling. Pick per game, never per sprite.
     */
    pixelArt?: boolean;
    /**
     * The scene roster: `{ play }` required, `title` / `gameOver` / `intro` /
     * custom roles optional (title and gameOver have built-in fallbacks as
     * go() targets). Boot order: intro → title → play, first registered wins.
     * Omit entirely for the single-scene shorthand (game.run(frame) drives an
     * implicit scene — fine for demos and toys).
     */
    scenes?: SceneRoster;
    /** Replace the built-in loading bar: draws on the HUD surface with the eased 0..1 progress. */
    drawLoading?: (d: Draw, progress: number) => void;
    /** Show the dev error overlay for GPU/page errors (default true). */
    overlay?: boolean;
}
/** The world rect on screen this frame, in world units. */
export interface ViewRect {
    x: number;
    y: number;
    w: number;
    h: number;
}
export declare class Game {
    /** Engine version string, stamped at build time. */
    readonly version: string;
    /** The draw verbs — valid inside the run() callback. WORLD space (scrolls with the camera). */
    readonly draw: Draw;
    /** The same verbs in SCREEN space: origin (0,0) top-left of the window, camera-proof,
     * always on top of the world. Score, health bars, prompts go here. */
    readonly hud: Draw;
    /** The ACTIVE scene (an implicit one when no roster was given). */
    current: Scene;
    /** Alias for the active scene — `game.scene.add(...)` etc. */
    get scene(): Scene;
    /** The active scene's camera (each scene owns its own). */
    get camera(): Camera;
    /** The particle system — emit() bursts/streams; updated + drawn automatically (over the scene). */
    readonly fx: Particles;
    /** This frame's visible world rect (camera origin + worldHeight fit). */
    readonly view: ViewRect;
    /** Keyboard and pointer input. Read key/mouse state from scenes via `this.input`. */
    readonly input: Input;
    /** Audio / SFX / music system. Play sounds with `this.game.sound.play('hit')` or stream music with `.music(url)`. */
    readonly sound: Audio;
    /** Motion / animation system (tween / ease / interpolate). Animate sprite properties with `this.tween.to(sprite, { x: 200 })`. Advanced by the run loop — tweens freeze when the game pauses. */
    readonly tween: Tween;
    /**
     * The PRESENTATION SURFACE — the canvas as a display, and what you capture off
     * it: `game.screen.fullscreen()`, `.screenshot(cb)`, `.record(60, 10, cb)`.
     * Host-shell API (a page's fullscreen / share button), not game API — nothing
     * here touches the simulation. To freeze the game use `game.pause()`.
     */
    readonly screen: Screen;
    /**
     * THE ASSET REGISTRY — bake or load something once, get the handle the draw
     * verbs take: `game.assets.loadFrames(url)`, `.font()`, `.msdfFont(png, json)`,
     * `.deformer(def)`. Every call is idempotent, so setup() can re-run for free.
     */
    readonly assets: Assets;
    /**
     * THE POST CHAIN — full-screen effects OVER the finished frame:
     * `game.post.add('bloom')`, `game.post.clear()`. For fire/smoke/sparks IN the
     * world you want `game.fx` (particles), not this.
     */
    readonly post: PostLayer;
    /**
     * THE BACKDROP STACK — full-screen layers BEHIND the world, camera-aware:
     * `game.backdrop.add('stars')`, `.clear()`, `.background(img)`.
     */
    readonly backdrop: BackdropLayer;
    /** HUD stays crisp above post effects (default). false = effects apply to the HUD too. */
    hudAboveFx: boolean;
    /**
     * Seconds of input GRACE after every scene transition (default 0.5 =
     * 500 ms): all keys and gestures read as inactive, so a player frantically
     * tapping fire when they die can't instantly dismiss the game-over screen.
     * Set 0 to disable.
     */
    inputGrace: number;
    /**
     * The DEBUG OVERLAY — ships in every game, off by default. Set `true` for
     * everything (hitboxes, velocity vectors, contacts, tile collision,
     * stats) or pick: `game.debug = { hitboxes: true }`. For players AND
     * agents: when a hitbox looks wrong, turn this on so they can SEE it.
     */
    get debug(): boolean | DebugOptions;
    set debug(v: boolean | DebugOptions);
    /** Seconds since run() started. */
    time: number;
    readonly canvas: HTMLCanvasElement;
    /** Which backend this game runs on: 'webgpu', or 'webgl' (the fallback). */
    readonly renderer: 'webgpu' | 'webgl';
    private gpu;
    /** The WebGL fallback backend (null on the WebGPU path). */
    private glr;
    /** The GL 3D world when the fallback carries one (this.world stays the
     *  public-typed handle; this is the concretely-typed twin reference). */
    private glWorld;
    private atlas;
    private cutoutBatch;
    private blendBatch;
    /** Bitmap labels for the WORLD surface's UI — flushed in the UI band, over panels. */
    private textBatch;
    /**
     * Submission order for each surface's SCENE content: its quads and its text
     * pass, interleaved. A sign drawn before a wall goes behind it — the frame
     * breaks the quad batch, draws the text, and resumes. See DrawOrder.
     */
    private sceneOrder;
    private hudOrder;
    /** The WORLD text pass (MSDF + Unicode blocks) — over the lit scene, under the HUD. */
    private msdf;
    private ui;
    /** The SCREEN-SPACE twin: the same text verbs on `game.hud`, in CSS pixels, over the HUD sprites. */
    private msdfHud;
    private uiHud;
    /** Bumped on every device/context rebuild — UnicodeText re-uploads when it changes. */
    private texEpoch;
    /** Set by a hovered interactive text block each frame; drives the hand cursor. */
    private cursorWanted;
    /** The cursor currently applied to the canvas, so we only touch style on change. */
    private cursorNow;
    private addBatch;
    private fxBatch;
    private gridBatch;
    private triBatch;
    /**
     * THE VECTOR LAYER — first-class line art (retained VectorShapes with
     * per-shape transforms, shatter(), deformable polylines, immediate
     * seg()/poly()): `game.vector.shape(points, { glow: 0.8 })`. Drawn in the
     * scene pass between the blend and grid batches; pair with bloom for the
     * full vector-monitor look. See skills/vector.md.
     */
    readonly vector: VectorLayer;
    private glowPass;
    private _lights2d;
    /**
     * The 2D LIGHT layer — additive point/spot lights with hard shadows off
     * scenery (`lights2d.occluders`), colour mixing and flicker. Created on first
     * access (games that don't light pay nothing). Draw your scene, drop a dark
     * ambient overlay, then this adds the lights back. See skills/lights2d.md.
     */
    get lights2d(): Lights2d;
    private core3d;
    private worldP;
    private ssaoPass;
    private raysPass;
    private pendingSsao;
    private pendingRays;
    private hudBatch;
    /** `d.text()` glyphs for the HUD surface — flushed in the text slot, over panels. */
    private hudTextBatch;
    private world;
    private postChain;
    private backdrops;
    private atlasView;
    private msaaColor;
    private worldDepth;
    private worldDepthView;
    private clock;
    private stepFns;
    private bg;
    private worldHeight;
    private debugOpts;
    private debugOverlay;
    private roster;
    private booted;
    private drawLoading?;
    /** Registered frames per url|frameW|frameH — loadFrames/framesOf are idempotent. */
    private frameCache;
    /** Baked bitmap fonts per font|charset — font() is idempotent (see below). */
    private fontCache;
    private raf;
    private last;
    private textureReady;
    /** atlas.generation last uploaded to the GPU — re-upload when it falls behind. */
    private uploadedGen;
    private depth;
    private pixelArt;
    private filter;
    /** The boot banner logs once per page, however many Games are constructed. */
    private static bannerShown;
    private running;
    private destroyed;
    private constructor();
    /**
     * The boot banner — one console line with colour blocks, the engine name +
     * version, and a clickable homepage link (devtools auto-link bare URLs).
     * Logged once per page, no matter how many Games are constructed.
     */
    private banner;
    /**
     * Boot the engine. WebGPU is tried first; where it's absent (or where
     * `window.PHASER_WEBGPU === false` / a `?webgl` URL param forces it, for
     * testing) the engine falls back to the WebGL2 backend — a separate, lazily
     * loaded render path with core feature parity (high-end effects are
     * WebGPU-only; see docs/webgl2-fallback-plan.md). Only when BOTH are absent
     * does this show an on-page message and reject.
     */
    static create(opts?: GameOptions): Promise<Game>;
    /**
     * Transition to the scene registered under `role` ('title', 'play',
     * 'gameOver', 'intro' or a custom key). The old scene — sprites, camera,
     * rules — is dropped whole; the new one is built via setup(data).
     * Built-in fallbacks cover 'title' and 'gameOver'.
     */
    go(role: string, data?: unknown): void;
    /** Wire a scene to this game's services (size/view hooks + back-reference). */
    private attach;
    /**
     * Opt into the 3D layer: a perspective world (Y-UP) of boxes + billboard
     * sprites rendered UNDER the 2D layer and HUD. The 3D core ships as a
     * separate lazy chunk (world3d-core.js) — the first call loads it, so:
     * `const world = await game.world3d({ ... })` (one await in setup, the
     * physics pattern). Idempotent: later calls resolve to the same world.
     */
    /**
     * SSAO (Lighting 2.0 tier 3) — screen-space ambient occlusion over the 3D
     * world: creases, contact points and corners darken naturally. Costs one
     * half-res estimate + blur per frame. `world.ssao(true)`,
     * `world.ssao({ radius, strength, power })` to tune, `false` to stop.
     * Requires a 3D world (it reads the world depth buffer).
     */
    /** Project a 3D world point into the 2D LAYER's coordinates — draw a
     * label/health bar at the returned x/y with the normal 2D verbs and it
     * pins to the 3D object. null before the first frame or without a world;
     * check `.visible` before drawing (behind-the-camera points project). */
    project3d(x: number, y: number, z: number): {
        x: number;
        y: number;
        depth: number;
        visible: boolean;
    } | null;
    private warnGlOnly;
    /** Load the 3D chunk once (idempotent) and stand up the ssao/rays passes. */
    private load3d;
    world3d(opts?: World3dOptions): Promise<World3d>;
    /** A world X at fraction f across this frame's view (0 = left edge, 1 = right). Camera-aware. */
    vw(f: number): number;
    /** A world Y at fraction f down this frame's view (0 = top edge, 1 = bottom). Camera-aware. */
    vh(f: number): number;
    /** Run `fn` at the fixed simulation step (see FixedClock) — physics/sims go here, not in the frame callback. */
    onStep(fn: (step: number) => void): void;
    /**
     * Start the frame loop. Each frame: fixed-step callbacks → scene update →
     * scene draw → your `frame` callback (drawn ON TOP of the scene) → render.
     */
    run(frame?: (draw: Draw, dt: number, t: number) => void): void;
    /** Stop the frame loop (run() restarts it). */
    /**
     * Draw one surface's UI stack, layer by layer.
     *
     * Panels, bitmap labels and MSDF text are three batches because they are three
     * shaders — but they are ONE stack, so they advance together. Walking layers
     * in step is what lets a window (see `Ui.window`) sit wholly above the window
     * below it: its panels cover the other's panels AND its text, with no stencil
     * and no separate surface.
     *
     * Layer 0 is the frame's ordinary UI, so the common case is one pass of the
     * loop and exactly the three draws it always was.
     */
    /**
     * Replay one surface's 2D content in the order the game drew it.
     *
     * Quads, text and panels are three shaders and can never share a batch, so the
     * frame breaks the batch and swaps pipeline wherever the game alternated. That
     * costs draw calls, deliberately: `d.panel(...)` then `d.text(...)` means the
     * text is ON the panel, and no ordering rule beats writing what you meant.
     *
     * LAYERS are the one thing call order cannot express — "this dialog is above
     * everything already on screen". Each layer is walked in full before the next,
     * so a modal covers the screen below it, text and furniture together.
     */
    private walkSurface;
    /** The surface's passes, indexed by SRC id — the walk's dispatch table. */
    private sceneSrcs;
    private hudSrcs;
    stop(): void;
    /** `true` while the loop is frozen by `pause()` (booted, not yet destroyed). */
    get paused(): boolean;
    /** `true` once `destroy()` has run — the instance is permanently inert. */
    get isDestroyed(): boolean;
    /**
     * Freeze the run loop — updates and rendering stop, the last frame stays on
     * screen — and silence all sound (muted, not stopped: music holds its place).
     * Idempotent; no-op after `destroy()`. Called by the host page's pause control.
     */
    pause(): void;
    /**
     * Restart the run loop after `pause()` and restore sound to its pre-pause mute
     * state. The first delta is clamped (last = -1) so time never jumps across the
     * gap. Idempotent; no-op after `destroy()` or before the first `run()`.
     */
    resume(): void;
    /**
     * Permanently stop the game: cancel the loop, tear down input / audio / tween,
     * and release resources. After this every method is a no-op. Idempotent.
     */
    destroy(): void;
    private ensureMsaa;
    /** The 3D passes' dedicated depth — SAMPLEABLE (soft particles, compute
     * collision) and persistent across frames (stored, never discarded), at
     * the world's sample count. Separate from the 2D layer's depth, which is
     * cleared by the scene pass every frame. */
    private ensureWorldDepth;
    private ensureDepth;
    private uploadAtlas;
}

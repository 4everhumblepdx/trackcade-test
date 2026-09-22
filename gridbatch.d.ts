// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { Frame } from './atlas.js';
/** Vertex-stage deformation for one sprite (routes it to the grid batch). */
export interface Deform {
    /** Built-in kind, or the name of a registered custom DeformDef. */
    kind: 'wave' | 'sway' | 'flip' | 'jelly' | (string & {});
    /** Strength — world units (wave/sway) or fraction (jelly). Unused by flip. */
    amount?: number;
    /** Animation rate in cycles (flip: turns) per second. 0 = drive phase yourself. */
    speed?: number;
    /** Phase offset in radians (also the manual control when speed is 0). */
    phase?: number;
}
/**
 * A CUSTOM deformer as pure DATA — the same delivery shape as post-effect
 * EffectDefs (the MCP-block path): register with game.assets.deformer(def), then
 * use it by name: `deform: { kind: def.name }`. The `code` snippet runs in
 * the VERTEX stage with these in scope:
 *   p      vec2f  centred vertex position in WORLD units — mutate this
 *   shade  f32    brightness multiplier (1 = lit) — mutate for fake light
 *   uvn    vec2f  0..1 position across the sprite
 *   size   vec2f  sprite size in world units
 *   amount f32    Deform.amount
 *   t      f32    phase + speed*time*2pi (the animation clock)
 *   TAU    const  2pi
 *   d.uv   vec4f  the frame's atlas rect — with `tex`/`samp` you may
 *          textureSampleLevel(tex, samp, uv, 0.0) IN THE VERTEX STAGE
 *          (drive twists/wind from the sprite's own texture).
 * The optional `fragment` snippet runs per-pixel AFTER the base sample with:
 *   color  vec4f  straight-alpha output (base: tex × tint × shade) — mutate
 *   tint   vec4f  the instance color
 *   uvn    vec2f  0..1 across the sprite · uvRect vec4f the atlas rect
 *   t / amount / shade  as above; tex/samp via textureSampleLevel
 * Wrap-scroll inside the frame with: uvRect.xy + fract(uv) * (uvRect.zw -
 * uvRect.xy) — on a TILEABLE noise frame the wrap is seamless.
 * Agents request deformers by name and never write WGSL — snippets arrive
 * as data, like effect blocks.
 */
export interface DeformDef {
    name: string;
    /** The WGSL vertex-stage snippet (the WebGPU renderer's dialect). */
    code: string;
    /** Optional WGSL fragment-stage snippet. */
    fragment?: string;
    /** Optional GLSL ES 3.0 twin of `code` — same variable scope (`p`, `shade`,
     * `uvn`, `size`, `amount`, `t`, `TAU`), spliced by the WebGL fallback. A def
     * without one renders UNDEFORMED there (with a one-shot console warn), so
     * ship both dialects for anything that must degrade gracefully. */
    glsl?: string;
}
/** The flip deformer's facing for frame-swapping: > 0 front, < 0 back (mirrored). */
export declare function facing(d: Deform, time: number): number;
/** Pure WGSL assembly (headless-testable): built-in kinds + spliced customs. */
export declare function buildGridWGSL(blocky: boolean, customs?: ReadonlyArray<{
    id: number;
    def: DeformDef;
}>): string;
export interface GridBatchOptions {
    /** Blocky pixel-art sampling (matches QuadBatch's flag). */
    blocky?: boolean;
    filter?: GPUFilterMode;
    capacity?: number;
}
/**
 * One pipeline + instance buffer for every deformed sprite this frame.
 * Flushed inside the scene pass after the blend batch (alpha, depth-tested,
 * push order). All deformation is vertex-stage — no CPU vertex writes.
 */
export declare class GridBatch {
    private format;
    /** The surface's submission-order log — see batch.ts's DrawOrder. */
    private order;
    private layer;
    private uploaded;
    /** @see QuadBatch.setLayer */
    setLayer(n: number): void;
    private data;
    private count;
    private capacity;
    private blocky;
    private filter;
    private uniformData;
    private customs;
    private kinds;
    private device;
    private pipeline;
    private layout;
    private sampler;
    private uniforms;
    private instances;
    private textureView;
    private bind;
    constructor(device: GPUDevice, format: GPUTextureFormat, opts?: GridBatchOptions);
    /**
     * Register a custom deformer (idempotent by name; re-registering replaces
     * the snippet). Recompiles the one pipeline — do it at load, not per frame.
     */
    register(def: DeformDef): void;
    rebuild(device: GPUDevice): void;
    private makePipeline;
    setTexture(view: GPUTextureView): void;
    private makeBind;
    begin(viewX: number, viewY: number, viewW: number, viewH: number, time: number): void;
    push(x: number, y: number, w: number, h: number, frame: Frame, rot: number, flipX: boolean, z: number, deform: Deform, r: number, g: number, b: number, a: number): void;
    private grow;
    private upload;
    flush(pass: GPURenderPassEncoder): number;
}

// Docs: engine/webgpu/effects.md — usage, recipes & traps (this file = exact type signatures)
import { type EffectDef } from './effects.js';
/** A live effect in the chain — retune or remove it at any time. */
export declare class PostHandle {
    readonly def: EffectDef;
    private chain;
    /** Update a parameter (by the name declared in the effect). */
    set(param: string, value: number): this;
    /** Remove this effect from the chain. */
    remove(): void;
}
export declare class PostChain {
    private format;
    private passes;
    private pipelines;
    private layout;
    private sampler;
    private device;
    private targets;
    constructor(device: GPUDevice, format: GPUTextureFormat);
    /** Any effects active? (Game skips the offscreen path entirely when not.) */
    get active(): boolean;
    /** Append an effect (built-in name or a custom EffectDef — the MCP-block path). */
    add(effect: string | EffectDef, params?: Record<string, number>): PostHandle;
    /** Remove every effect. */
    clear(): void;
    /** The offscreen view the world should render into this frame. */
    sceneView(width: number, height: number): GPUTextureView;
    /** Run every pass; the last one lands on `dst` (the swapchain). */
    run(encoder: GPUCommandEncoder, dst: GPUTextureView, time: number): void;
    /** (Re)create GPU objects — the device-loss recovery path. */
    rebuild(device: GPUDevice): void;
    private pipelineFor;
}
/**
 * THE POST CHAIN — full-screen effects applied OVER the finished frame:
 * `game.post.add('bloom')`, `game.post.clear()`. Built-ins by name
 * ('pixelate', 'vignette', 'bloom', 'crt', 'scanlines', 'posterize',
 * 'grayscale', 'wave', 'chroma') or a custom EffectDef (the block path).
 *
 * NOT particles — a fire/smoke/spark EFFECT IN the world is `game.fx`.
 */
export declare class PostLayer {
    private readonly chain;
    /**
     * Add an effect to the chain (applied in add order). Returns a handle:
     * `.set(param, value)` to retune live, `.remove()` to drop just this one.
     */
    add(effect: string | EffectDef, params?: Record<string, number>): PostHandle;
    /** Remove every post effect. */
    clear(): void;
}

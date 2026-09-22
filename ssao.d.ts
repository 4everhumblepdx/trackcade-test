// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** The spiral sample offsets baked into the AO shader — deterministic
 * (golden-angle spiral, radii √(i/n)), all inside the unit disc. Exported
 * for tests. */
export declare function ssaoKernel(n?: number): Array<[number, number]>;
/** The AO estimate pass. `ms` picks texture_depth_multisampled_2d (loading
 * sample 0) vs texture_depth_2d (loading mip 0) — the engine's opaque depth
 * target is MSAA by default but sampleCount 1 must work too. */
export declare function buildSsaoWGSL(ms: boolean): string;
/** BILATERAL 5-tap cross blur (one H+V ping-pong at half res): taps are
 * weighted by depth similarity (the g channel carries linear depth), so AO
 * never bleeds across a silhouette — a plain blur draws HALOS around every
 * object. Depth passes through for the second axis. */
export declare function buildSsaoBlurWGSL(): string;
/** Fullscreen multiply-darken: the fragment outputs vec4(ao, ao, ao, 1) and
 * the pipeline blends color { srcFactor: 'zero', dstFactor: 'src' } so
 * out.rgb = dst.rgb * ao (alpha left untouched). The linear sampler does the
 * half→full upscale for free. */
export declare function buildSsaoCompositeWGSL(): string;
export interface SsaoOptions {
    /** Sample radius in VIEW units (world units; default 0.8). */
    radius?: number;
    /** Darkening strength 0..2 (default 1). */
    strength?: number;
    /** Power curve sharpening (default 1.5). */
    power?: number;
}
export declare class SsaoPass {
    private format;
    /** Live-tunable options, read every render. */
    readonly opts: Required<SsaoOptions>;
    /** Off by default — render()/composite() no-op until switched on. */
    enabled: boolean;
    private device;
    private aoPipeline;
    private aoPipelineMS;
    private aoLayout;
    private aoLayoutMS;
    private blurPipeline;
    private compositePipeline;
    private blurLayout;
    private compLayout;
    private sampler;
    private aoUniforms;
    private blurUniformsH;
    private blurUniformsV;
    private targets;
    private compBind;
    private rendered;
    private uniformData;
    private invProj;
    constructor(device: GPUDevice, format: GPUTextureFormat);
    /** Encode the AO estimate (half res, pipeline variant picked by the depth
     * texture's sampleCount) then one H+V blur ping-pong. `proj` is the
     * camera's projection matrix (column-major 16); projA/projB the standard
     * linearisation terms far/(near-far) and near*far/(near-far). */
    render(encoder: GPUCommandEncoder, depth: GPUTexture, proj: Float32Array, projA: number, projB: number, canvasW: number, canvasH: number): void;
    private blurTo;
    /** Multiply the blurred AO into the open scene pass (which has a depth
     * attachment — the pipeline declares depth24plus, write off, compare
     * always). Skips when disabled or nothing rendered this frame. */
    composite(pass: GPURenderPassEncoder): void;
    rebuild(device: GPUDevice): void;
}

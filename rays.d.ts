// Docs: engine/webgpu/sky-water3d.md — usage, recipes & traps (this file = exact type signatures)
export interface RaysOptions {
    /** Overall shaft brightness (default 0.55). */
    strength?: number;
    /** Per-step energy falloff along the march (default 0.94). */
    decay?: number;
}
export declare class RaysPass {
    private format;
    /** Live-tunable, read every render. */
    readonly opts: Required<RaysOptions>;
    /** Off by default — render()/composite() no-op until switched on. */
    enabled: boolean;
    private device;
    private marchPipeline;
    private marchPipelineMS;
    private marchLayout;
    private marchLayoutMS;
    private compPipeline;
    private compLayout;
    private sampler;
    private uniforms;
    private compUniforms;
    private target;
    private compBind;
    private rendered;
    private data;
    constructor(device: GPUDevice, format: GPUTextureFormat);
    /** Encode the shaft march (half res). `sun` is the world's projected sun:
     * uv in [0,1], intensity already faded for off-screen / night / storm. */
    render(encoder: GPUCommandEncoder, depth: GPUTexture, sun: {
        x: number;
        y: number;
        intensity: number;
        color: [number, number, number];
    }, canvasW: number, canvasH: number): void;
    /** Add the shafts into the open scene pass (depth attached, write off). */
    composite(pass: GPURenderPassEncoder): void;
    rebuild(device: GPUDevice): void;
}

// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
export declare class GlowPass {
    private format;
    private data;
    private count;
    private maxSize;
    private extraActive;
    private view;
    private device;
    private stampPipeline;
    private blurPipeline;
    private compositePipeline;
    private stampLayout;
    private fsLayout;
    private sampler;
    private stampUniforms;
    private blurUniformsH;
    private blurUniformsV;
    private compUniforms;
    private instances;
    private capacity;
    private targets;
    private atlasView;
    private compBind;
    constructor(device: GPUDevice, format: GPUTextureFormat);
    get active(): boolean;
    private blurTo;
    setTexture(view: GPUTextureView): void;
    rebuild(device: GPUDevice): void;
}

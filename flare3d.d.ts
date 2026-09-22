// Docs: engine/webgpu/sky-water3d.md — usage, recipes & traps (this file = exact type signatures)
/** GPU plumbing — owned by World3d, drawn at the very end of pass B
 * (over the particles: flares are ON the lens). */
export declare class Flare3dLayer {
    private format;
    private sampleCount;
    private msDepth;
    private device;
    private pipeline;
    private layout;
    private buf;
    private bind;
    private depthView;
    private data;
    visible: boolean;
    constructor(device: GPUDevice, format: GPUTextureFormat, sampleCount: number, msDepth: boolean);
    rebuild(device: GPUDevice): void;
    /** Per-frame uniforms. `vis` already carries night/storm/off-screen fade. */
    update(sunNdcX: number, sunNdcY: number, vis: number, color: [number, number, number], screenW: number, screenH: number, depthView: GPUTextureView): void;
    draw(pass: GPURenderPassEncoder): void;
}

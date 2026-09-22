// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** GPU plumbing for the spotlight beams — owned by World3d, drawn in pass B. */
export declare class Beam3dLayer {
    private format;
    private sampleCount;
    private msDepth;
    private device;
    private pipeline;
    private layout;
    private ubuf;
    private ibuf;
    private bind;
    private depthView;
    private udata;
    private idata;
    private count;
    constructor(device: GPUDevice, format: GPUTextureFormat, sampleCount: number, msDepth: boolean);
    rebuild(device: GPUDevice): void;
    /**
     * Pack one instance per live beam and refresh the uniform. `beams` are the
     * light + its beam config; the geometry follows the light's pose/dir/cone
     * every frame. projA/projB linearise the sampled depth (see World3d.projInfo).
     */
    update(beams: ReadonlyArray<{
        light: BeamLight;
        opts: BeamOpts;
    }>, viewProj: ArrayLike<number>, camX: number, camY: number, camZ: number, projA: number, projB: number, softDist: number, depthView: GPUTextureView): void;
    draw(pass: GPURenderPassEncoder): void;
}
/** The subset of a Light3d the beam reads (structural — avoids an import cycle). */
interface BeamLight {
    x: number;
    y: number;
    z: number;
    radius: number;
    dir: {
        x: number;
        y: number;
        z: number;
    };
    cone: {
        inner: number;
        outer: number;
    };
}
interface BeamOpts {
    length?: number;
    intensity?: number;
    /** Pre-resolved rgb (0..1) — World3d resolves the colour string once. */
    rgb: [number, number, number];
}
export {};

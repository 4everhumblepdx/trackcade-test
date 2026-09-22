// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { Vec2 } from './util.js';
/** Ear-clip a simple polygon into triangles (flat index triples: `[a,b,c, …]`).
 *  Self-contained so the 2D draw path never imports the 3D geometry module. */
export declare function triangulate(pts: ReadonlyArray<Vec2>): number[];
/** An instanced flat-triangle batch (alpha blend). One per Draw surface. */
export declare class TriBatch {
    private format;
    /** The surface's submission-order log — see batch.ts's DrawOrder. */
    private order;
    private uploaded;
    /** Layer cursor — moved with the surface's other passes by Draw.setUiLayer. */
    private layer;
    private data;
    private count;
    private capacity;
    private uniformData;
    private device;
    private pipeline;
    private layout;
    private uniforms;
    private instances;
    private bind;
    constructor(device: GPUDevice, format: GPUTextureFormat);
    rebuild(device: GPUDevice): void;
    private makeBind;
    begin(viewX: number, viewY: number, viewW: number, viewH: number): void;
    /** @see QuadBatch.setLayer */
    setLayer(n: number): void;
    /** Push one triangle `(ax,ay)-(bx,by)-(cx,cy)` in colour `(r,g,b,a)` (0..1). */
    push(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, r: number, g: number, b: number, a: number): void;
    private grow;
    flush(pass: GPURenderPassEncoder): void;
    private upload;
}

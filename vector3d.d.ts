// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { Mat4 } from './math3d.js';
export declare const LINE3D_FLOATS = 16;
export interface VectorShape3dOptions {
    x?: number;
    y?: number;
    z?: number;
    yaw?: number;
    pitch?: number;
    roll?: number;
    scale?: number;
    color?: string;
    /** Core width in SCREEN PIXELS (default 1.5; < 1 = flat-cut hairline). */
    width?: number;
    alpha?: number;
    /** Join each polyline's last point back to its first. */
    closed?: boolean;
}
/** A retained 3D line shape — mutate the transform/style freely. */
export declare class VectorShape3d {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    roll: number;
    scale: number;
    color: string;
    width: number;
    alpha: number;
    dead: boolean;
    /** Shape-local segments [ax, ay, az, bx, by, bz]. */
    readonly segs: Array<[number, number, number, number, number, number]>;
    constructor(segs: Array<[number, number, number, number, number, number]>, o?: VectorShape3dOptions);
    kill(): void;
}
/** Polylines → shape-local segments (shared by lines() and wireframes). */
export declare function polylinesToSegs(polylines: Array<Array<[number, number, number]>>, closed?: boolean): Array<[number, number, number, number, number, number]>;
/**
 * Extract WIREFRAME edges from a stride-8 triangle soup. Verts are welded
 * by position (1e-4 grid); an edge is kept when it borders one face only
 * (boundary/open geometry) or its faces crease by more than `angle`
 * degrees. Returns segments in the soup's own coordinate space.
 */
export declare function wireframeEdges(verts: Float32Array, angle?: number): Array<[number, number, number, number, number, number]>;
/** The 3D line shader (pure string — dist-tested). Screen-space width in
 * pixels, depth from the real endpoints. */
export declare function buildLine3dWGSL(): string;
/** The retained 3D vector layer — world3d owns one; shapes pack every
 * frame (transforms are live) into one instanced draw. */
export declare class Vector3dLayer {
    private format;
    private sampleCount;
    private device;
    private pipeline;
    private layout;
    private bind;
    private uniforms;
    private buf;
    private data;
    private uniformData;
    readonly shapes: VectorShape3d[];
    /** Segments packed this frame (the draw count). */
    count: number;
    constructor(device: GPUDevice, format: GPUTextureFormat, sampleCount: number);
    rebuild(device: GPUDevice): void;
    private makeBind;
    /** Pack + upload every live shape's segments (world.prepare calls this). */
    prepare(vp: Mat4, screenW: number, screenH: number, near?: number): void;
    draw(pass: GPURenderPassEncoder): void;
}

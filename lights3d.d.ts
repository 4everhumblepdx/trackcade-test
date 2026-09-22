// Docs: engine/webgpu/world3d.md — usage, recipes & traps (this file = exact type signatures)
import type { Mat4 } from './math3d.js';
export declare const LIGHT_FLOATS = 16;
export declare const MAX_LIGHTS = 256;
export declare const CLUSTER_X = 16;
export declare const CLUSTER_Y = 8;
export declare const CLUSTER_Z = 24;
export declare const CLUSTER_COUNT: number;
export declare const MAX_PER_CLUSTER = 127;
export declare const LU_FLOATS: number;
export interface LightConfig {
    type?: 'point' | 'spot';
    x?: number;
    y?: number;
    z?: number;
    color?: string;
    /** Linear brightness multiplier (default 1). Falloff is INVERSE-SQUARE
     * (physical): brightness at distance d is ~intensity / d², so far throws
     * need BIG numbers — rule of thumb: intensity ≈ wanted-punch × d². A
     * lamp 14 units above the ground wants ~200, not ~10. */
    intensity?: number;
    /** Falloff radius in world units (default 8): the light reaches zero
     * here, and the cluster binning uses it — keep it honest. */
    radius?: number;
    /** Spot axis (spot only; any length; default straight down). */
    dir?: {
        x?: number;
        y?: number;
        z?: number;
    };
    /** Spot cone half-angles in radians: full brightness inside `inner`,
     * zero past `outer` (defaults 0.35 / 0.55). */
    cone?: {
        inner?: number;
        outer?: number;
    };
}
/** A live light — mutate everything per frame; kill() releases it. */
export declare class Light3d {
    type: 'point' | 'spot';
    x: number;
    y: number;
    z: number;
    color: string;
    intensity: number;
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
    dead: boolean;
    constructor(c: LightConfig);
    kill(): void;
}
export interface ClusterCfg {
    near: number;
    far: number;
    tanHalfX: number;
    tanHalfY: number;
}
/** Clustering uses its OWN near plane, clamped away from the camera near:
 * log slices from near 0.1 waste half the depth resolution inside 4.5
 * units of the camera, leaving the actual scene in a handful of HUGE
 * froxels that overflow any per-cluster cap. far/128 spreads the slices
 * over the visible range; slice 0 extends to the camera so fragments
 * closer than the clamp still shade (they read slice 0's list). */
export declare function clusterNear(near: number, far: number): number;
/** View-space AABB of froxel (tx, ty, slice). View space: x right, y up,
 * camera looks down -z; tile (0,0) is the TOP-LEFT of the screen (fragment
 * coordinate convention — the FS derives its tile the same way). */
export declare function froxelBounds(tx: number, ty: number, slice: number, cfg: ClusterCfg): {
    min: [number, number, number];
    max: [number, number, number];
};
/** The kernel's slice mapping: view distance → logarithmic z slice. */
export declare function zSlice(viewDist: number, cfg: ClusterCfg): number;
/** CPU twin of the binning kernel: lights are (viewX, viewY, viewZ, radius)
 * quads. Returns per-cluster light-index lists (tests compare against the
 * same maths the kernel runs). */
export declare function binLightsCpu(lights: ReadonlyArray<[number, number, number, number]>, cfg: ClusterCfg): number[][];
/** Assemble the cluster-binning kernel (pure string work — dist-tested). */
export declare function buildClusterWGSL(): string;
/** The ACTIVATION pool: when more lights are registered than `max`, keep
 * the ones whose light SPHERES come closest to the camera — view-space
 * distance minus radius, so a big streetlamp beats a nearby candle it
 * would out-reach. Pure (dist-tested); order is preserved under the cap. */
export declare function selectLights(list: Light3d[], view: Mat4, max: number): Light3d[];
export declare class Lights3d {
    private list;
    private lightData;
    private luData;
    private device;
    private pipeline;
    /** The group(1) layout the MESH pipeline shares (world3d builds its
     * pipeline layout with this). */
    layout: GPUBindGroupLayout;
    bind: GPUBindGroup;
    private lu;
    private lightsBuf;
    private clustersBuf;
    private computeBind;
    private sampler;
    private dummyShadow;
    private shadowView;
    private causticSampler;
    private dummyCaustic;
    private causticView;
    private grainView;
    constructor(device: GPUDevice);
    get count(): number;
    /** Lights actually uploaded + binned LAST frame (≤ MAX_LIGHTS — the
     * activation pool picks the nearest when more are registered). */
    activeCount: number;
    light(config?: LightConfig): Light3d;
    /** Point the group(1) bind at the shadow map (world3d owns the texture;
     * null reverts to the 1×1 dummy). */
    setShadowMap(view: GPUTextureView | null): void;
    /** Point the group(1) bind at the baked caustic pattern (underwater3d owns
     * the texture; null reverts to the 1×1 black dummy = no dapple). */
    setCaustic(view: GPUTextureView | null): void;
    /**
     * Per-frame: pack live lights into VIEW space, fill the shared LU uniform
     * (view/shadow matrices + cluster params), and encode the binning kernel.
     * Runs before the render passes (same encoder).
     */
    update(encoder: GPUCommandEncoder, view: Mat4, near: number, far: number, tanHalfX: number, tanHalfY: number, screenW: number, screenH: number, shadowVP: Mat4 | null, shadowBias: number, shadowTexel: number, shadowNormalOff?: number): void;
    rebuild(device: GPUDevice): void;
    private makeBind;
}

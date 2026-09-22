// Docs: engine/webgpu/world3d.md — usage, recipes & traps (this file = exact type signatures)
import type { Mesh3d, Group3d } from './world3d.js';
import { AnimMixer } from './anim3d.js';
export interface ModelConfig {
    x?: number;
    y?: number;
    z?: number;
    /** World size along each axis (default 1 across the largest extent —
     * models are unit-fit like every primitive). */
    w?: number;
    h?: number;
    d?: number;
    yaw?: number;
    pitch?: number;
    roll?: number;
    alpha?: number;
    /** Tint override for EVERY part (default: the model's own materials). */
    color?: string;
    /** PBR overrides applied to every part (default: material values for
     * GLB; matte dielectric for OBJ). */
    metallic?: number;
    rough?: number;
}
/** Uniformly scale + centre stride-8 vertex groups so the largest extent
 * spans 1 (positions only — normals are direction vectors). Mutates the
 * arrays; returns the applied transform. Pure — dist-tested. */
export declare function fitVerts(groups: Float32Array[], bounds: {
    min: [number, number, number];
    max: [number, number, number];
}): {
    scale: number;
    center: [number, number, number];
};
/** 0..1 rgb (+optional alpha) → the '#rrggbb' hex the engine speaks. */
export declare function rgbHex(r: number, g: number, b: number): string;
/**
 * A loaded model: one live handle over every material part. Mutate
 * x/y/z/yaw/pitch/roll/w/h/d/alpha exactly like a Mesh3d — every part
 * follows. Per-part access stays open through `parts` (tint one material,
 * hide another).
 */
export declare class Model3d {
    readonly parts: Mesh3d[];
    constructor(parts: Mesh3d[]);
    get x(): number;
    set x(v: number);
    get y(): number;
    set y(v: number);
    get z(): number;
    set z(v: number);
    get yaw(): number;
    set yaw(v: number);
    get pitch(): number;
    set pitch(v: number);
    get roll(): number;
    set roll(v: number);
    get w(): number;
    set w(v: number);
    get h(): number;
    set h(v: number);
    get d(): number;
    set d(v: number);
    get alpha(): number;
    set alpha(v: number);
    /** Uniform scale sugar: w = h = d = v. */
    set size(v: number);
    /** Opt this whole model in/out of picking (see Mesh3d.inputEnabled) — fans
     * out to every part, so world.pick() returns any part of an enabled model. */
    get inputEnabled(): boolean;
    set inputEnabled(v: boolean);
    /** Parent every part to a Group3d/Mesh3d (the whole model rides the
     * node; x/y/z become local to it). */
    get parent(): unknown;
    set parent(v: unknown);
    kill(): void;
}
export declare class AnimatedModel3d extends Model3d {
    /** Clip names (play() takes a name or index). */
    readonly anims: string[];
    readonly mixer: AnimMixer;
    /** The transform every part hangs off — drive the model through the
     * Model3d accessors as usual. */
    readonly root: Group3d;
    private skinned;
    private nodeParts;
    private fitM;
    private fitInv;
    private scratchA;
    private scratchB;
    private rig;
    get x(): number;
    set x(v: number);
    get y(): number;
    set y(v: number);
    get z(): number;
    set z(v: number);
    get yaw(): number;
    set yaw(v: number);
    get pitch(): number;
    set pitch(v: number);
    get roll(): number;
    set roll(v: number);
    /** Animated models scale UNIFORMLY through the root (per-axis w/h/d
     * belongs to the mixer's node scales). */
    set size(v: number);
    get w(): number;
    set w(v: number);
    get h(): number;
    set h(v: number);
    get d(): number;
    set d(v: number);
    get parent(): unknown;
    set parent(v: unknown);
    /** Play a clip by name or index; crossfades from the current one. */
    play(clip: string | number, opts?: {
        loop?: boolean;
        fade?: number;
    }): void;
    /** Advance the rig (the world ticks this every frame). */
    update(dt: number): void;
}
/** CPU-skin a stride-8 soup: pos by the weighted palette matrices, normals
 * by their rotation parts (renormalised). Pure — dist-tested. */
export declare function cpuSkin(base: Float32Array, joints: Uint16Array, weights: Float32Array, palette: Float32Array, out: Float32Array): void;

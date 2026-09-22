// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { GlbRig, GlbChannel, GlbSkinOut } from './glb.js';
/**
 * Shortest-path spherical lerp between quats a and b (components, not
 * objects — the hot path never allocates inputs). When the quats are
 * near-parallel the sin() denominator degenerates, so we fall back to
 * normalized lerp, which is indistinguishable there.
 */
export declare function quatSlerp(ax: number, ay: number, az: number, aw: number, bx: number, by: number, bz: number, bw: number, t: number): [number, number, number, number];
/**
 * Bake translation + quaternion + scale into a column-major mat4 (T·R·S —
 * scale first, then rotate, then translate; same convention as math3d).
 */
export declare function trsToMat4(t: readonly number[], r: readonly number[], s: readonly number[], out?: Float32Array): Float32Array;
/** out = a × b, allocation-free (out must not alias a or b). Column-major. */
export declare function mat4MulTo(a: Float32Array, b: Float32Array, out: Float32Array): void;
/**
 * Sample one animation channel at time `tt` (caller pre-wraps for looping)
 * into `out` (3 floats for translation/scale, 4 for rotation). Binary-searches
 * the keyframe span; STEP holds the left key, LINEAR lerps (slerp for
 * rotation), CUBICSPLINE reads the middle element of each in/value/out triplet
 * and lerps linearly between keys. Clamps outside the keyframe range.
 */
export declare function sampleChannel(ch: GlbChannel, tt: number, out: Float32Array): void;
/**
 * Compose world matrices for every node from local matrices. `parents[i]` is
 * the parent node index or -1 for roots — parents may appear ANYWHERE in the
 * array (glTF imposes no parent-before-child order), so nodes are resolved
 * iteratively until every one has a resolved parent. locals and worlds are
 * 16-floats-per-node arrays; worlds must not alias locals.
 */
export declare function composeWorlds(parents: Int32Array | number[], locals: Float32Array, worlds: Float32Array): void;
/**
 * palette[j] = worlds[skin.joints[j]] × inverseBind[j] — 16 floats per joint
 * into `out`. Allocation-free hot path, called per frame per skinned model.
 */
export declare function jointPalette(skin: GlbSkinOut, worlds: Float32Array, out: Float32Array): void;
/**
 * Decompose an affine TRS matrix (glTF forbids skew) into translation, scale
 * and Euler angles in the ENGINE's rotation order: the mesh shader applies
 * roll (Z), then pitch (X), then yaw (Y) — R = Ry(yaw)·Rx(pitch)·Rz(roll) —
 * so writing these onto a mesh's yaw/pitch/roll reproduces the matrix's
 * orientation exactly. Same convention (gimbal branch included) as
 * physics3d's quatToEuler: at pitch = ±90° roll is folded into yaw. Scale is
 * per-column length; a negative determinant folds into the sign of s.z.
 */
export declare function decomposeTRS(m: Float32Array): {
    t: [number, number, number];
    e: [number, number, number];
    s: [number, number, number];
};
/**
 * The pure clip mixer: tracks the active clip plus an optional crossfade from
 * the previous one. Every update(dt) advances time, samples each animated
 * channel, blends poses during a fade (lerp t/s, slerp r), bakes local
 * matrices and composes world matrices. Nodes no clip ever animates keep
 * their rest matrices, computed once. All per-frame work is allocation-free.
 */
export declare class AnimMixer {
    /** Clip names, in rig order — play() accepts a name or this index. */
    readonly anims: readonly string[];
    /** Local (16/node) and world (16/node) matrices, rebuilt by update(). */
    readonly locals: Float32Array;
    readonly worlds: Float32Array;
    /** Seconds into the current clip. */
    time: number;
    /** True while a clip is active (one-shots flip to false when they finish). */
    playing: boolean;
    /** One-shot finished — sticky until the next play(). */
    done: boolean;
    private readonly rig;
    private readonly parents;
    private readonly restPose;
    private readonly poseA;
    private readonly poseB;
    private readonly animated;
    private readonly sampleScratch;
    private current;
    private previous;
    private fadeTime;
    private fadeDuration;
    constructor(rig: GlbRig);
    /** Start a clip by name or index. Crossfades from the current clip over
     * `fade` seconds (0 = hard cut). Unknown names are ignored. */
    play(clip: string | number, opts?: {
        loop?: boolean;
        fade?: number;
    }): void;
    /** Advance by dt seconds and rebuild locals + worlds. Honours `playing`:
     * set it false to FREEZE the pose (walk → idle), true to resume. */
    update(dt: number): void;
    private advance;
    /** Write the clip's pose at its current time into `pose` (rest + channels). */
    private evaluate;
    /** out = mix(a, b, t) per node: lerp t/s, slerp r. out may alias b. */
    private blendPoses;
    /** Bake pose[node] (TRS) into this.locals[node]. */
    private bakeLocal;
}

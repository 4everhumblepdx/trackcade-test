// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
export type Quat = [number, number, number, number];
/** Quaternion for the engine euler order: q = qY(yaw) · qX(pitch) · qZ(roll).
 * YAW HANDEDNESS: yaw is CLOCKWISE-from-above — increasing yaw turns to the
 * RIGHT (the mainstream / three.js / FPS sense). That is baked in here by
 * building qY from −yaw (sy is negated); the WGSL rotate(), forward(),
 * lookAtEuler(), physics and picking all share this one sign. */
export declare function eulerToQuat(yaw: number, pitch: number, roll: number): Quat;
export declare function quatMul(a: Quat, b: Quat): Quat;
/** Rotate a point by a quaternion (q v q*). */
export declare function quatRotate(q: Quat, x: number, y: number, z: number): [number, number, number];
/** Quaternion → the engine's yaw/pitch/roll (Ry·Rx·Rz). physics3d's maths. */
export declare function quatToEuler(q: Quat): [number, number, number];
export interface ParentLike {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    roll: number;
    /** Uniform child-scale contribution (groups; mesh parents contribute 1). */
    scale?: number;
    parent?: ParentLike | null;
}
/**
 * Compose a child's LOCAL pose through its parent chain into world space.
 * Returns world position, world euler (engine order) and the accumulated
 * uniform scale. Guards against cycles (depth cap). Mesh parents contribute
 * position + rotation only — a crate's SIZE never inflates its rider;
 * `Group3d.scale` is the deliberate scaling knob.
 */
export declare function composeChain(localX: number, localY: number, localZ: number, localYaw: number, localPitch: number, localRoll: number, parent: ParentLike | null | undefined): {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    roll: number;
    scale: number;
};
/** Yaw/pitch that aim local +Z at a target (engine rotate order, roll 0):
 * forward(yaw, pitch) = (−cos p · sin y, −sin p, cos p · cos y). */
export declare function lookAtEuler(fromX: number, fromY: number, fromZ: number, toX: number, toY: number, toZ: number): {
    yaw: number;
    pitch: number;
};
/** Unit forward direction for a yaw/pitch (engine rotate order, roll 0) — the
 *  inverse of {@link lookAtEuler}: `forward(yaw, pitch) = (−cos p·sin y, −sin p,
 *  cos p·cos y)`. `+Z` is forward at yaw 0; INCREASING yaw turns to the RIGHT
 *  (mainstream / three.js / FPS). Use it for first-person movement and camera
 *  aim (`world.camera.face`). */
export declare function forward(yaw: number, pitch?: number): {
    x: number;
    y: number;
    z: number;
};

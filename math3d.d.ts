// Docs: engine/webgpu/world3d.md — usage, recipes & traps (this file = exact type signatures)
export type Mat4 = Float32Array;
export interface V3 {
    x: number;
    y: number;
    z: number;
}
export declare function vec3(x?: number, y?: number, z?: number): V3;
/** Perspective projection (fovY degrees, WebGPU depth range 0..1). */
export declare function mat4Perspective(fovYDeg: number, aspect: number, near: number, far: number): Mat4;
/** Orthographic projection (WebGPU depth 0..1) — shadow-map cameras. */
export declare function mat4Ortho(l: number, r: number, b: number, t: number, near: number, far: number): Mat4;
/** A view matrix looking from `eye` at `target` (y-up world). */
export declare function mat4LookAt(eye: V3, target: V3, up?: V3): Mat4;
/** m = a × b (column-major). */
export declare function mat4Mul(a: Mat4, b: Mat4): Mat4;
/** Transform a point (w=1) and perspective-divide — for tests + picking. */
export declare function mat4Project(m: Mat4, p: V3): V3;
/** General 4×4 inverse (column-major, cofactor expansion). Returns identity
 * for a singular input rather than NaNs — callers unproject with it and a
 * degenerate frame should read as "no transform", never as poison. */
export declare function mat4Inverse(m: Mat4): Mat4;
/** The camera's right/up basis from a view matrix (billboards face with these). */
export declare function viewBasis(view: Mat4): {
    right: V3;
    up: V3;
};
/**
 * Extract the six frustum planes of a column-major viewProj (WebGPU depth
 * 0..1; works for PERSPECTIVE and ORTHO alike): 24 floats, [a, b, c, d] ×
 * (left, right, bottom, top, near, far), xyz normalised. A point is inside
 * a plane when a·x + b·y + c·z + d ≥ 0. Gribb–Hartmann, near plane from
 * the z ≥ 0 clip (not GL's z ≥ -w).
 */
export declare function frustumPlanes(m: Mat4): Float32Array;
/** Sphere-vs-frustum: true when the sphere touches the volume (conservative
 * — corner cases may pass a sphere that is just outside; never culls a
 * visible one). `planes` from frustumPlanes(). */
export declare function sphereVsFrustum(planes: Float32Array, x: number, y: number, z: number, r: number): boolean;
/**
 * A world-space picking ray from an NDC point (nx, ny in -1..1, y UP) —
 * unproject near and far and take the difference. `invVp` is the inverse
 * of the camera's viewProj (mat4Inverse). Returns unit dir.
 */
export declare function rayFromNdc(invVp: Mat4, nx: number, ny: number): {
    origin: V3;
    dir: V3;
};
/** Ray vs sphere: nearest positive hit distance, or null. */
export declare function raySphere(origin: V3, dir: V3, c: V3, r: number): number | null;
/** Ray vs the horizontal plane y = h: hit point, or null (parallel/behind). */
export declare function rayPlaneY(origin: V3, dir: V3, h: number): V3 | null;
/**
 * Ray vs an ORIENTED box (the engine euler order: roll about z, pitch
 * about x, yaw about y — the mesh shader's rotate()): nearest positive hit
 * distance or null. Exact for boxes and a tight proxy for everything else —
 * bounding SPHERES are useless for flat meshes (a ground disc's sphere
 * swallows every click in the scene).
 */
export declare function rayObb(origin: V3, dir: V3, center: V3, half: V3, yaw: number, pitch: number, roll: number): number | null;
/**
 * Ray vs an oriented box derived from a mesh's LOCAL geometry AABB. `pos` +
 * `size` (w,h,d) + euler place a UNIT-fit geometry; `bounds` is that
 * geometry's local AABB (centre + half-extents, unit space). The box is the
 * AABB scaled by `size`, its centre offset rotated into world (mesh euler
 * order: roll·z → pitch·x → yaw·y). With no `bounds`, falls back to the
 * symmetric size/2 cube (only exact for `box`). Nearest positive t or null.
 *
 * This is what makes picking tight for off-centre / thin / multi-part model
 * geometry, whose symmetric w/h/d cube overshoots and swallows clicks behind
 * it.
 */
export declare function rayObbLocal(origin: V3, dir: V3, pos: V3, size: V3, yaw: number, pitch: number, roll: number, bounds?: {
    cx: number;
    cy: number;
    cz: number;
    hx: number;
    hy: number;
    hz: number;
}): number | null;

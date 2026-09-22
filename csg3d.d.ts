// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Placement of one solid before it joins the shared CSG space. `scale` is
 * uniform or per-axis; rotation follows the shader's roll·pitch·yaw order. */
export interface Transform {
    pos?: [number, number, number];
    scale?: number | [number, number, number];
    yaw?: number;
    pitch?: number;
    roll?: number;
}
/** Return a copy of `verts` with a placement baked in: scale → rotate → move.
 * Normals rotate too (divided by scale first for non-uniform, then renormalised). */
export declare function transformVerts(verts: Float32Array, xf: Transform): Float32Array<ArrayBuffer>;
/**
 * A solid you can boolean against another. Build from any triangle-soup
 * (a geometry3d generator's output), optionally with a placement, then chain
 * `.subtract()` / `.union()` / `.intersect()` and hand `.toVerts()` to
 * `world.custom(name, () => solid.toVerts(), cfg)` — one baked, instanced mesh.
 *
 * ```ts
 * const die = Solid.fromVerts(roundedBoxVerts(0.22, 3))
 *   .subtract(Solid.fromVerts(sphereVerts(16, 12), { pos: [0, 0.5, 0], scale: 0.2 }));
 * world.custom('die', () => die.toVerts(), { w: S, h: S, d: S, color });
 * ```
 * Bake-time only; keep tools clean/closed (see the robustness note up top).
 */
export declare class Solid {
    private polys;
    private constructor();
    /** Wrap a triangle-soup, optionally baking a placement into it. */
    static fromVerts(verts: Float32Array, xf?: Transform): Solid;
    /** Merge many solids into one. USE THIS to combine cutting tools before a
     * single subtract — "union the tools, subtract once" keeps the polygon count
     * (and the bake time) an order of magnitude below N sequential subtracts. */
    static union(solids: Solid[]): Solid;
    union(other: Solid): Solid;
    subtract(other: Solid): Solid;
    intersect(other: Solid): Solid;
    /** The result as interleaved (pos, normal, uv) soup for world.custom(). */
    toVerts(): Float32Array<ArrayBuffer>;
}
export declare function unionVerts(a: Float32Array, b: Float32Array): Float32Array<ArrayBuffer>;
export declare function subtractVerts(a: Float32Array, b: Float32Array): Float32Array<ArrayBuffer>;
export declare function intersectVerts(a: Float32Array, b: Float32Array): Float32Array<ArrayBuffer>;

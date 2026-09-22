// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/**
 * hull3d — pure convex-hull math for 3D model colliders (no DOM, no GPU, no
 * deps). Loaded OBJ/GLB models are arbitrary triangle soups; physics wants a
 * small CONVEX wrap of them. `quickhull` computes the hull of a point cloud,
 * `hullOfVerts` runs it over the engine's stride-8 vertex format and samples
 * the result down to a physics-friendly point count. Both run once per model
 * at load time — clarity over speed (meshes are ≤ ~30k verts).
 */
/**
 * 3D quickhull over a point cloud. Input: flat xyz triples. Output: the
 * hull's unique vertices as flat xyz triples (order unspecified). Handles
 * degenerate inputs by returning what it can (≤3 points / coplanar sets
 * return the input's unique extreme points — Box3D accepts them).
 */
export declare function quickhull(points: Float32Array | number[]): Float32Array;
/**
 * Convex hull of a stride-8 vertex soup (pos+normal+uv — the engine's
 * geometry format): dedupes positions (1e-5 grid), runs quickhull, and if
 * the hull has more than `maxPoints` vertices, SIMPLIFIES by greedy
 * farthest-point sampling down to `maxPoints` (physics cores want small
 * hulls; 32–64 is plenty).
 */
export declare function hullOfVerts(verts: Float32Array, maxPoints?: number): Float32Array;

// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import { VoxelWorld, type VoxelOptions, type VoxelTerrainOptions, type VoxelHit } from '../voxel3d.js';
/** The per-frame uniform values the voxel program consumes (a subset of the
 * world's shared frame bundle — world.ts passes its FrameU straight in). */
export interface VoxelFrameU {
    vp: Float32Array;
    camPos: readonly number[];
    fogColor: readonly number[];
    params: readonly number[];
    ambSky: readonly number[];
    ambGround: readonly number[];
    sunCol: readonly number[];
}
/** The renderable voxel world on the GL backend. `world.voxels()` builds it;
 * edit via set/get, pick with `raycast`; GlWorld3d draws it in-pass. */
export declare class GlVoxels3d {
    private camera;
    readonly world: VoxelWorld;
    readonly blockSize: number;
    private gl;
    private bufs;
    private prog;
    private u;
    private vao;
    private atlasTex;
    private readonly tileRes;
    private readonly seed;
    private readonly mip;
    private cullDist;
    constructor(gl: WebGL2RenderingContext, camera: {
        x: number;
        y: number;
        z: number;
    }, opts?: VoxelOptions);
    /** (Re)create every GL object from CPU state — context-restore path. */
    rebuild(gl: WebGL2RenderingContext): void;
    /** Bake + upload the procedural tile pack into a 2D ARRAY texture with a
     * CPU-halved mip chain (the WebGPU uploadAtlas recipe, texSubImage3D-ed). */
    private uploadAtlas;
    get(x: number, y: number, z: number): number;
    set(x: number, y: number, z: number, id: number): void;
    /** Author the world in bulk: `(x,y,z) => blockId`. */
    generate(fn: (x: number, y: number, z: number) => number): void;
    /** Build (or REBUILD) a landscape — voxelTerrain over a cleared world. */
    landscape(opts?: VoxelTerrainOptions): void;
    /** World-space Y (feet) to drop a body/mob at column (x, z). */
    spawnY(x: number, z: number): number;
    /** DDA raycast in world space → block coords + entry normal (voxel3d.ts). */
    raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist?: number): VoxelHit | null;
    /** Re-mesh dirty chunks + upload their VBOs (budget-capped, like the
     * original's per-frame remeshDirty). */
    remeshDirty(budget?: number): void;
    /** Draw every non-empty, in-range chunk — called by GlWorld3d inside the
     * opaque pass (depth write on, back-cull already set). Returns the number
     * of draw calls issued (for counts.draws). */
    render(frame: VoxelFrameU): number;
    /** Live stats for a HUD/debug panel. */
    get stats(): {
        chunks: number;
        verts: number;
    };
    destroy(): void;
}

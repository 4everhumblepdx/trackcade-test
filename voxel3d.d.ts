// Docs: engine/webgpu/voxels.md — usage, recipes & traps (this file = exact type signatures)
/** One face's tile picked by axis. */
export interface BlockDef {
    name: string;
    /** Tile layer index for the +Y face. */
    top: number;
    /** Tile layer index for the -Y face. */
    bottom: number;
    /** Tile layer index for the four side faces (±X, ±Z). */
    side: number;
    /** Fully hides faces behind it (default true). Leaves/glass/water = false. */
    opaque?: boolean;
    /** Blocks movement / is pickable by the raycast (default true). Water = false. */
    solid?: boolean;
    /** Alpha-tested in the shader (leaves, glass) — kept in the opaque pass. */
    cutout?: boolean;
}
export declare const TILES: readonly ['grassTop', 'grassSide', 'dirt', 'stone', 'cobble', 'sand', 'logTop', 'logSide', 'planks', 'leaves', 'water', 'snowTop', 'snowSide', 'glass', 'brick', 'coalOre', 'goldOre', 'gravel', 'bedrock'];
/** The block table. `BLOCKS[id]` — id 0 (air) is intentionally a hole. */
export declare const BLOCKS: (BlockDef | null)[];
/** Named ids so callers read `BLOCK.grass` not a magic number. */
export declare const BLOCK: {
    readonly air: 0;
    readonly grass: 1;
    readonly dirt: 2;
    readonly stone: 3;
    readonly cobble: 4;
    readonly sand: 5;
    readonly log: 6;
    readonly planks: 7;
    readonly leaves: 8;
    readonly water: 9;
    readonly snow: 10;
    readonly glass: 11;
    readonly brick: 12;
    readonly coalOre: 13;
    readonly goldOre: 14;
    readonly gravel: 15;
    readonly bedrock: 16;
};
/** Bake the whole pack: `count` layers of `res*res` RGBA, contiguous. Pure. */
export declare function bakeTiles(res?: number, seed?: number): {
    data: Uint8Array;
    layers: number;
    res: number;
};
/** Box-filter downsample one RGBA layer by 2× (for mip generation). Pure. */
export declare function halveRGBA(px: Uint8Array, w: number, h: number): {
    px: Uint8Array;
    w: number;
    h: number;
};
export interface VoxelWorldOptions {
    /** World size in blocks (X wide, Y tall, Z deep). Default 128×48×128. */
    sizeX?: number;
    sizeY?: number;
    sizeZ?: number;
    /** Chunk edge in blocks (default 16). Bigger = fewer draws, costlier edits. */
    chunk?: number;
}
/** A bounded grid of block ids, split into fixed-size chunks. Pure/testable. */
export declare class VoxelWorld {
    readonly sx: number;
    readonly sy: number;
    readonly sz: number;
    readonly ch: number;
    readonly cx: number;
    readonly cy: number;
    readonly cz: number;
    private chunks;
    /** Chunk indices needing a remesh. */
    readonly dirty: Set<number>;
    constructor(opts?: VoxelWorldOptions);
    inBounds(x: number, y: number, z: number): boolean;
    private chunkIndex;
    /** Block id at a cell, or 0 (air) outside the world. */
    get(x: number, y: number, z: number): number;
    /** Set a cell. Marks the owning chunk (and a bordering neighbour) dirty. */
    set(x: number, y: number, z: number, id: number): void;
    /** Highest solid block at column (x, z), or -1 if the column is empty. */
    columnTop(x: number, z: number): number;
    /** Mark every non-empty chunk dirty (after a bulk generate, or device loss). */
    markAllDirty(): void;
    /** Empty the world back to all-air. Marks every previously-filled chunk dirty
     * so its geometry clears on the next remesh (used by reseed). */
    clear(): void;
    /** Chunk grid coords from a linear chunk index (for the mesher). */
    chunkCoords(idx: number): [number, number, number];
    get chunkCount(): number;
    hasChunk(idx: number): boolean;
}
export declare const VOX_FLOATS = 8;
/** Ambient-occlusion brightness by occluder count (0 = darkest corner).
 * Deliberately gentle — the block look wants a hint of crease, not deep
 * shadow (Minecraft absorbs very little light per face). */
export declare const AO_LEVELS: number[];
interface Face {
    n: [number, number, number];
    u: [number, number, number];
    v: [number, number, number];
    off: [number, number, number];
    uv: [number, number][];
}
export declare const FACES: Face[];
/** Standard 3-sample corner AO: 0 (both sides closed) … 3 (all open). */
export declare function vertexAO(side1: boolean, side2: boolean, corner: boolean): number;
/** Pick the per-face tile layer for a block + face index (0..5, order = FACES). */
export declare function faceTile(def: BlockDef, face: number): number;
/**
 * Mesh one chunk into an interleaved Float32Array (VOX_FLOATS per vertex).
 * Only faces exposed to air / a non-opaque different block are emitted.
 * `get` is the WORLD accessor (crosses chunk borders for correct culling+AO).
 */
export declare function meshChunk(get: (x: number, y: number, z: number) => number, x0: number, y0: number, z0: number, ch: number): Float32Array;
export interface VoxelHit {
    /** The solid cell hit. */
    x: number;
    y: number;
    z: number;
    /** Face normal of entry (points back toward the ray origin). */
    nx: number;
    ny: number;
    nz: number;
    /** Ray distance to the hit. */
    dist: number;
}
/**
 * March a ray through the grid; return the first SOLID block hit (or null).
 * `place` = hit cell + face normal is the empty cell to build into.
 */
export declare function raycastVoxel(get: (x: number, y: number, z: number) => number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist?: number): VoxelHit | null;
export type VoxelTerrainType = 'island' | 'flat' | 'plains' | 'hills' | 'mountains';
export interface VoxelTerrainOptions {
    /** Landform (default 'island'). All types fill SOLID down to bedrock, so you
     * can dig right through them. 'island' + 'plains' add a sea; the rest are dry. */
    type?: VoxelTerrainType;
    seed?: number;
    /** Water fill height. Defaults per type ('island'/'plains' have one; -1 = dry). */
    seaLevel?: number;
    /** Scatter trees on grass (default true). */
    trees?: boolean;
    /** Tree density multiplier (default 1). */
    treeDensity?: number;
}
/**
 * Fill a VoxelWorld with a landscape. Pure + deterministic by seed — the same
 * (type, seed) is the same world on every machine. Every type is SOLID from the
 * surface down to bedrock (dig-through), coloured grass/sand/snow by height,
 * with an ore-flecked stone core. Reseed by calling `clear()` then this again.
 */
export declare function voxelTerrain(world: VoxelWorld, opts?: VoxelTerrainOptions): void;
export interface VoxelBodyOptions {
    /** Footprint width in blocks (default 0.6). */
    width?: number;
    /** Height in blocks (default 1.8). */
    height?: number;
    /** Auto-climb ledges up to this tall without jumping (default 1.05 — walks
     * single-block terraces smoothly; set ~0.6 for jump-required full blocks). */
    stepHeight?: number;
    /** Downward acceleration, blocks/s² (default 28). */
    gravity?: number;
    /** Jump launch speed, blocks/s (default 8.4 ≈ clears ~1.25 blocks). */
    jumpSpeed?: number;
    /** Terminal fall speed, blocks/s (default 40). */
    maxFall?: number;
}
/**
 * An axis-aligned body that walks the voxel world: gravity, jumping, per-axis
 * swept collision resolve against solid blocks, and auto step-up over 1-block
 * ledges. Feed it a wished horizontal velocity + a jump flag each `step`; it
 * resolves the move and reports `onGround` / `blocked`.
 */
export declare class VoxelBody {
    private world;
    x: number;
    y: number;
    z: number;
    vy: number;
    onGround: boolean;
    /** True when a wall stopped horizontal motion last step (AI: turn/jump). */
    blocked: boolean;
    readonly hw: number;
    readonly height: number;
    private stepH;
    private grav;
    private jump;
    private maxFall;
    constructor(world: VoxelWorld, spawn: {
        x: number;
        y: number;
        z: number;
    }, opts?: VoxelBodyOptions);
    /** Any solid block overlapping the AABB at the current position? */
    private collides;
    /**
     * Advance one tick. `wishX`/`wishZ` are desired horizontal velocity
     * (blocks/s); `jump` launches if standing. Substepped so fast motion can't
     * tunnel through a 1-block wall.
     */
    step(dt: number, wishX: number, wishZ: number, jump: boolean): void;
    private moveY;
    private moveHoriz;
}
export type VoxelAgentMode = 'wander' | 'seek' | 'flee' | 'idle';
export interface VoxelAgentOptions extends VoxelBodyOptions {
    mode?: VoxelAgentMode;
    /** Move speed, blocks/s (default 3). */
    speed?: number;
    /** Seed for wander randomness (default derived from spawn). */
    seed?: number;
}
/**
 * A mob: a VoxelBody plus a tiny brain. `wander` roams and randomly re-heads;
 * `seek`/`flee` chase or avoid a target; all of them AUTO-JUMP when a wall
 * blocks them (so they climb terraces like a Minecraft mob). Drive it with
 * `update(dt, target?)`.
 */
export declare class VoxelAgent {
    readonly body: VoxelBody;
    mode: VoxelAgentMode;
    speed: number;
    /** Current heading in radians (wander) — also where a mesh should face. */
    heading: number;
    private rnd;
    private reHead;
    constructor(world: VoxelWorld, spawn: {
        x: number;
        y: number;
        z: number;
    }, opts?: VoxelAgentOptions);
    /** One AI tick. `target` is required for seek/flee (a point to chase/avoid). */
    update(dt: number, target?: {
        x: number;
        z: number;
    }): void;
}
export interface VoxelOptions extends VoxelWorldOptions {
    /** Block-texture resolution in texels (default 16 — classic). */
    tileRes?: number;
    /** Texture-pack seed (default 1). */
    seed?: number;
    /** World-units per block (default 1). */
    blockSize?: number;
    /** Generate + smooth-filter mipmaps (default true — kills distant shimmer). */
    mipmaps?: boolean;
    /** Draw chunks past this distance from the camera are skipped (default: fog far, else 512). */
    cullDist?: number;
}
/** The renderable voxel world. `world.voxels()` builds it; edit via set/get,
 * pick blocks with `raycast`, and it draws itself inside the world's pass. */
export declare class Voxels3d {
    private device;
    private format;
    private sampleCount;
    private uniforms;
    private camera;
    readonly world: VoxelWorld;
    readonly blockSize: number;
    private bufs;
    private atlasTex;
    private sampler;
    private pipeline;
    private bind;
    private layout;
    private readonly tileRes;
    private readonly seed;
    private readonly mip;
    private cullDist;
    constructor(device: GPUDevice, format: GPUTextureFormat, sampleCount: number, uniforms: GPUBuffer, camera: {
        x: number;
        y: number;
        z: number;
    }, opts?: VoxelOptions);
    /** Device-loss recovery: adopt the fresh device + world uniforms, drop the
     * dead vertex buffers, and rebuild every GPU object from the CPU model. */
    rebuild(device: GPUDevice, uniforms: GPUBuffer): void;
    /** (Re)build all GPU resources — also the device-loss recovery entry point. */
    buildGpu(): void;
    private uploadAtlas;
    get(x: number, y: number, z: number): number;
    set(x: number, y: number, z: number, id: number): void;
    /** Author the world in bulk: `(x,y,z) => blockId`. Marks everything dirty. */
    generate(fn: (x: number, y: number, z: number) => number): void;
    /** Build (or REBUILD) a landscape: clears the world then fills it with the
     * chosen land type. Call again with a new `seed` for a reseed button. */
    landscape(opts?: VoxelTerrainOptions): void;
    /** World-space Y (feet) to drop a body/mob at column (x, z) — just above the
     * highest solid block. Returns `blockSize`-scaled units. */
    spawnY(x: number, z: number): number;
    /**
     * Raycast from a world-space origin/direction, returning the block hit (in
     * BLOCK coordinates) and the entry face normal — for breaking (`hit`) and
     * placing (`hit + normal`). Coordinates are divided by blockSize internally.
     */
    raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist?: number): VoxelHit | null;
    /** Re-mesh dirty chunks + upload their vertex buffers. Call once per frame
     * (world.prepare does this). Budget-capped so a big edit burst can't stall. */
    remeshDirty(budget?: number): void;
    /** Draw every non-empty, in-range chunk. Called from world.renderOpaque. */
    render(pass: GPURenderPassEncoder): void;
    /** Live stats for a HUD/debug panel: chunks currently drawn (non-empty) and
     * the total uploaded vertex count. */
    get stats(): {
        chunks: number;
        verts: number;
    };
    destroy(): void;
}
export {};

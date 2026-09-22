// Docs: engine/webgpu/terrain3d.md — usage, recipes & traps (this file = exact type signatures)
/** Deterministic integer-lattice hash → [0, 1). Same (ix, iz, seed) is the
 * same value on every machine — terrain is reproducible by seed. */
export declare function hash2(ix: number, iz: number, seed: number): number;
export type TerrainShape = 'island' | 'hills' | 'mountains' | 'dunes' | 'flat' | ((x: number, z: number) => number);
export interface TerrainBand {
    /** Normalised height [0, 1] this colour is centred on (relative to `height`). */
    h: number;
    color: string;
    /** Colour steep faces blend toward inside this band (cliffs). */
    steep?: string;
}
export interface TerrainOptions {
    /** World units per side (default 400). Terrain is centred on the origin. */
    size?: number;
    /** Grid quads per side (default 128 → 33k triangles). */
    res?: number;
    /** World height of a shape value of 1 (default 30). */
    height?: number;
    /** Base elevation added to every sample (default 0). */
    y?: number;
    seed?: number;
    /** Landform: preset name or a (x, z) → [0, 1] function (default 'island'). */
    shape?: TerrainShape;
    /** World units per large landform feature (default size/3). KEEP THIS
     * ABSOLUTE when you grow `size` (e.g. ~300) so a bigger terrain gains
     * MORE hills rather than the same hills zoomed up — that difference is
     * the whole sense of scale. */
    featureSize?: number;
    /** Band palette + material preset (default 'grass'). */
    surface?: 'grass' | 'sand' | 'snow' | 'rock';
    /** Override the surface preset's colour bands. */
    bands?: TerrainBand[];
    /** Baked colormap resolution (default 1024). */
    colormapRes?: number;
    /** Soft GROUND DETAIL baked into the grass bands of the colormap: fine
     * turf mottle so bare ground between blades reads as grass, not flat green
     * (0 = off/default — byte-identical to no detail; ~0.4 is a gentle meadow).
     * ZERO runtime cost — it's baked into the colormap already sampled as the
     * terrain's albedo, so it can never regress frame rate (unlike the removed
     * per-pixel detail shader). Only the grass bands take it; sand/rock/snow are
     * untouched. Pair with a higher `colormapRes` (e.g. 2048) for finer turf. */
    groundDetail?: number;
    /** Chunks per side (default auto — a divisor of res near res/16). */
    chunks?: number;
    /** `static: true` meshes (GPU-culled; default true). Set false only if
     * you plan to mutate chunk transforms — heights are edited via the field. */
    static?: boolean;
}
export declare class Heightfield {
    readonly size: number;
    readonly res: number;
    readonly height: number;
    readonly baseY: number;
    readonly seed: number;
    /** (res+1)² world-Y samples, row-major, z-major rows. */
    readonly heights: Float32Array;
    constructor(opts?: TerrainOptions);
    /** Grid sample, clamped at the edges. */
    gridY(ix: number, iz: number): number;
    /**
     * Ground height at a world position — TRIANGLE-EXACT: interpolates over
     * the same two triangles per quad the mesh rasterises (diagonal from
     * (ix+1, iz) to (ix, iz+1)), so objects placed here sit ON the render.
     * Clamps outside the terrain.
     */
    heightAt(x: number, z: number): number;
    /** SMOOTH vertex normal at a grid point (central differences) — the same
     * normals the mesh verts carry, so shading and queries agree. */
    vertexNormal(ix: number, iz: number): [number, number, number];
    /** Smooth surface normal at a world position (bilinear vertex normals). */
    normalAt(x: number, z: number): {
        x: number;
        y: number;
        z: number;
    };
    /** 0 = flat, 1 = vertical (it's just 1 - normalAt().y). */
    slopeAt(x: number, z: number): number;
}
export interface TerrainChunk {
    /** UNIT-space triangle soup (pos+normal+uv, 8 floats/vert): positions in
     * [-0.5, 0.5]³ of the placement below, normals already WORLD-space (the
     * instance carries no rotation, so they pass through the shader exactly). */
    verts: Float32Array<ArrayBuffer>;
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
}
/** Build one chunk's mesh. Edge verts sample the SHARED heightfield grid, so
 * adjacent chunks are seamless by construction. */
export declare function chunkVerts(hf: Heightfield, cx: number, cz: number, chunksPerSide: number, colormapRes?: number): TerrainChunk;
export interface TerrainSurface {
    bands: TerrainBand[];
    rough: number;
}
export declare const TERRAIN_SURFACES: Record<string, TerrainSurface>;
/**
 * Bake the band colormap: one RGBA pixel field over the whole terrain
 * (world XZ → uv), colour from the height-band gradient, blended toward the
 * band's `steep` colour on slopes, with two scales of noise jitter so flats
 * aren't airbrushed. Pure — world3d puts it on a canvas.
 */
export declare function bakeColormapPixels(hf: Heightfield, bands: TerrainBand[], res: number, seed?: number, detail?: number): Uint8ClampedArray<ArrayBuffer>;
/** One tileable grain field, size×size, values ~[0, 1] around a 0.5 mean:
 * three DECORRELATED octaves of wrapped-lattice value noise (the second
 * axis-swapped, the third diagonal-offset — same-orientation lattices gave
 * the sand a visible uniform grid with long stripes; Rich's image) + a
 * per-texel hash sparkle. */
export declare function bakeGrainField(size?: number): Float32Array;
/** Bake the grain into an r8unorm texture with a full box-filter mip chain
 * (the deep mips are the distance fade — they converge on the 0.5 mean). */
export declare function createGrainTexture(device: GPUDevice, size?: number): GPUTexture;
/** Pick a chunks-per-side that divides res — near res/16, capped at 8 per
 * side (64 buckets: past that, per-bucket cull dispatches + indirect draws
 * cost more than the culling saves). */
export declare function pickChunks(res: number, requested?: number): number;
export interface DeformOptions {
    /** Texels per side of the window (default 1024 — 4 MB of r32float). */
    res?: number;
    /** World units the window covers (default 480). Texel = window/res —
     * 0.47 u at the defaults. SIZE THIS FOR SPEED: the window rides
     * ~30% behind the carver, so trail persistence ≈ 0.8 × window — a
     * 28 u/s snowboarder keeps ~14 s of line at the default. Texels
     * should stay ≲ the carver radius or stamps fall between them. */
    window?: number;
    /** Maximum carve depth in world units (default 0.6). Stamps clamp here —
     * re-riding a trail compacts it, never digs to bedrock. */
    depth?: number;
    /** Refill rate, depth-units/second (default 0 — snow: trails persist).
     * Sand wants ~0.1–0.3 so tracks slowly drift shut. */
    heal?: number;
    /** Exposed under-layer colour (default per surface: compressed blue-white
     * for snow, dark wet sand, dirt for grass). */
    under?: string;
    /** Trench-edge normal strength (default 1 = physical gradient). */
    rim?: number;
    /** Snow glint strength (default 0.6 on 'snow' surfaces, else 0). */
    sparkle?: number;
    /** GEOMETRIC sink cap on the BASE terrain, world units (default 0.18).
     * The base mesh's verts are metres apart, so it can't render a
     * board-width trench — the far/persistent line is fragment work on it
     * (tint + rim normals) with at most this much real dip. The NEAR
     * trench is real geometry on the high-poly snow layer (see `layer`). */
    sink?: number;
    /** SNOW LAYER (E5, the real deformable geometry): a dense follow-grid
     * mesh — the WebGPU stand-in for tessellation (Batman: Arkham Origins /
     * UE RVT do this with hardware tessellation) — that REPLACES the base
     * terrain around the rider: the base discards a disc under it, the
     * patch renders the SAME surface (triangle-exact) minus the carve. One
     * surface, never two → no z-fighting, and the trench is real geometry
     * you can fly a probe line into. `false` disables it (base-only, the
     * flat fragment-trail look). Default on. */
    layer?: boolean;
    /** Snow/sand depth available to carve into (default 0.6): conceptually
     * the terrain surface IS the snow top and the ground sits `thickness`
     * below it — carves clamp here so a trench never reaches bedrock. */
    thickness?: number;
    /** Layer patch size in world units (default 240 — the real-geometry
     * radius around the rider; beyond it the base-terrain fragment trail
     * carries the line). */
    patch?: number;
    /** Grid cells per side of the patch (default 288 → ~0.83 u at the
     * default patch; keep the cell ≲ the carver radius). */
    cells?: number;
    /** Layer surface colour (default per surface: bright snow, warm sand). */
    albedo?: string;
}
export declare class DeformMap {
    readonly res: number;
    readonly window: number;
    readonly maxDepth: number;
    readonly sink: number;
    /** Depth of the deformable snow/sand layer above the base (see
     * DeformOptions.thickness). heightAt lifts the surface by this. */
    readonly thickness: number;
    /** High-poly patch size in world units (0 = no layer) — the feather
     * radius the RENDERED surface uses; snowSurfaceAt matches it. */
    readonly patchWin: number;
    /** Patch grid cells per side (the follow-grid resolution). */
    readonly patchCells: number;
    heal: number;
    /** The rider's live position, set by Terrain3d.stepCarvers (the deform
     * WINDOW rides ~30% behind this; the patch sits under the action). */
    focusX: number;
    focusZ: number;
    /** The patch centre SNAPPED to the cell grid. The follow-grid must land
     * on a fixed world lattice every frame — if it slid continuously with
     * the rider, each vertex would sample a moving world point and the
     * triangulation would SWIM (Rich: the trenches "ripple like water").
     * Snapping to whole cells makes the mesh world-stable (it re-indexes as
     * it shifts, but the surface is identical). */
    patchCx: number;
    patchCz: number;
    /** res² carve depths (≥ 0), row-major, z-major rows, texel centres. */
    readonly data: Float32Array;
    /** Window centre in world units — moves via follow(), quantised to texels. */
    cx: number;
    cz: number;
    /** Dirty texel rect [x0, z0) .. [x1, z1) for partial uploads. */
    dirtyX0: number;
    dirtyZ0: number;
    dirtyX1: number;
    dirtyZ1: number;
    /** The whole window changed (shift/heal) — upload everything. */
    fullDirty: boolean;
    private any;
    constructor(opts?: DeformOptions);
    /** World units per texel. */
    get texel(): number;
    private markDirty;
    /** Stamp one bowl-profiled dent: depth d at the centre easing to 0 at
     * radius r. MAX-blends with what's there (carving is compaction, not
     * excavation — the same pass twice is one trench, not two deep). */
    stamp(x: number, z: number, r: number, d: number): void;
    /** Stamp a capsule: discs along the segment every half-texel — the
     * board's frame-to-frame trail with no dashed gaps at speed. */
    line(x0: number, z0: number, x1: number, z1: number, r: number, d: number): void;
    /** Carve depth at a world position — the SAME manual bilinear over texel
     * centres the shader runs, including its window-edge fade, so a board at
     * heightAt() sits exactly on the rendered snow. 0 outside the window. */
    depthAt(x: number, z: number): number;
    /** Re-centre the window on (x, z) when it has drifted more than an eighth
     * of the window — COPY-ON-SHIFT: content moves by whole texels so every
     * carve keeps its world position; texels scrolling in are fresh snow.
     * Returns true when a shift happened (the texture needs a full upload). */
    follow(x: number, z: number): boolean;
    private healAcc;
    /** Uniform refill (sand): every carve shallows by heal·dt. Applied in
     * 0.1 s quanta — every heal tick re-uploads the whole map, and 10 Hz
     * is invisible on a slow drift-shut. */
    healStep(dt: number): void;
    clearDirty(): void;
}
/** The high-poly snow-layer PATCH: a unit grid in XZ ([-0.5, 0.5], y = 0),
 * `cells`² quads as a plain pos+normal+uv soup (the VS displaces it by the
 * baked base height + thickness − carve, so the trench is REAL geometry).
 * uv is 0..1 across the patch. Pure — world3d uploads it once. */
export declare function deformPatchVerts(cells: number): Float32Array<ArrayBuffer>;
import type { Mesh3d } from './world3d.js';
import type { Grass3d, GrassOptions } from './grass3d.js';
/** Returned by world.terrain(): the heightfield queries games drive off,
 * plus the chunk meshes. Kill removes the chunks AND their buckets. */
export declare class Terrain3d {
    readonly field: Heightfield;
    readonly meshes: Mesh3d[];
    private readonly onKill?;
    private readonly deformHook?;
    private readonly grassHook?;
    /** The deform window, once deformable() has been called. */
    deform: DeformMap | null;
    private carvers;
    constructor(field: Heightfield, meshes: Mesh3d[], onKill?: (() => void) | undefined, deformHook?: ((map: DeformMap, opts: DeformOptions) => void) | undefined, grassHook?: ((opts: GrassOptions) => Grass3d) | undefined);
    /**
     * Plant GRASS (E6 vegetation, Phase 2): a compute-driven follow-window of
     * instanced blades that ride this terrain's heightfield, tinted off its
     * colormap and lit like the ground. v1 is LUSH near the camera. Returns
     * the field handle (tune `span`, `cells`, `height`, `wind`, `color`).
     */
    grass(opts?: GrassOptions): Grass3d | null;
    /**
     * Make the surface DEFORMABLE (E5 — the SSX feature): boards, wheels and
     * feet carve persistent dents the terrain renders as displaced, tinted,
     * rim-lit trenches. Snow trails persist; pass `heal` for sand that drifts
     * shut. The window follows the first carver. Idempotent.
     */
    deformable(opts?: DeformOptions): DeformMap;
    /** Auto-trail: carve a capsule along `target`'s ground track every frame
     * (any live {x, y, z} — a mesh, a group). Only carves ON CONTACT: catch
     * air and the trail breaks exactly where you left the snow. */
    carver(target: {
        x: number;
        y: number;
        z: number;
    }, opts?: {
        radius?: number;
        depth?: number;
    }): {
        kill: () => void;
    };
    /** Manual one-off stamp (a landing crater, a shovel). */
    carve(x: number, z: number, r: number, d: number): void;
    /** Carve depth at (x, z) — 0 where untouched. */
    carveDepthAt(x: number, z: number): number;
    /** Advance the carvers + heal — world3d calls this once per frame with
     * wall-clock dt. Pure (no GPU): dist-testable. */
    stepCarvers(dt: number): void;
    /** Ground height at (x, z) — the SNOW SURFACE a rider rides on. With a
     * deformable layer, the heightfield itself IS the snow top (the ground
     * sits `thickness` below — see groundAt) and the carve digs a REAL
     * trench straight into it: `field − carve` (carves are clamped to the
     * layer depth, so never below bedrock). This is exactly what the
     * high-poly patch renders around the rider — rider, probe and pixels
     * agree. Without a layer: field minus the small fragment-shaded sink. */
    heightAt(x: number, z: number): number;
    /** Depth of the carvable snow/sand layer (0 if not deformable or layer
     * disabled). The BEDROCK under the snow is `field.heightAt − thickness`
     * — see groundAt. */
    get snowThickness(): number;
    /** The bedrock under the snow at (x, z): what a probe's base puck should
     * mark. Fresh snow sits `thickness` above it; a full-depth carve reaches
     * it exactly. Without a layer this is just the heightfield. */
    groundAt(x: number, z: number): number;
    /** @deprecated The patch now renders heightAt exactly (it replaces the
     * base terrain rather than floating above it) — use heightAt. */
    snowSurfaceAt(x: number, z: number): number;
    /** Smooth surface normal at (x, z). */
    normalAt(x: number, z: number): {
        x: number;
        y: number;
        z: number;
    };
    /** 0 flat → 1 vertical. */
    slopeAt(x: number, z: number): number;
    get size(): number;
    kill(): void;
}

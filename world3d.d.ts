// Docs: engine/webgpu/particles3d.md, engine/webgpu/terrain3d.md, engine/webgpu/voxels.md, engine/webgpu/world3d.md — usage, recipes & traps (this file = exact type signatures)
import type { Atlas } from './atlas.js';
import type { SsaoOptions } from './ssao.js';
import type { RaysOptions } from './rays.js';
import { OrbitRig, type OrbitOptions } from './orbit3d.js';
import type { Physics3d } from './physics3d.js';
import { type VfxDef } from './vfx.js';
import { Particles3d, type Burst3dOptions, SurfaceSampler } from './particles3d.js';
import { Model3d, type ModelConfig } from './model3d.js';
import { VectorShape3d, type VectorShape3dOptions } from './vector3d.js';
import { Light3d, type LightConfig } from './lights3d.js';
import { type GpuEmitter, type GpuEmitterOptions } from './particles-gpu.js';
import { Terrain3d, type TerrainOptions } from './terrain3d.js';
import { Sky3d, type SkyOptions } from './sky3d.js';
import { Water3d, type WaterOptions } from './water3d.js';
import { Voxels3d, type VoxelOptions } from './voxel3d.js';
import { VoxelEditor, type VoxelEditorOptions } from './voxeledit3d.js';
import { Underwater3d, type UnderwaterOptions } from './underwater3d.js';
import { Agents3d, type AgentsOptions } from './agents3d.js';
export interface Mesh3dConfig {
    x?: number;
    y?: number;
    z?: number;
    /** Size along each axis (default 1). Unit geometry: a sphere with w=h=d=2 has radius 1. */
    w?: number;
    h?: number;
    d?: number;
    color?: string;
    yaw?: number;
    pitch?: number;
    roll?: number;
    /** Specular strength 0..1 (default 0 = matte; ~0.6 = polished). Sugar:
     * maps onto PBR roughness as rough = 1 - gloss * 0.85; set `rough`
     * directly for exact control. */
    gloss?: number;
    /** PBR metalness 0..1 (default 0 = dielectric). Metals take their colour
     * into the reflection and go dark away from light (no IBL yet). */
    metallic?: number;
    /** PBR roughness 0.045..1 (default derived from gloss; 1 = matte). */
    rough?: number;
    alpha?: number;
    /** Atlas frame to texture the surface with (game.assets.frames()/loadFrames()).
     * Multiplies `color` — keep color white for the texture's own hues.
     * Default: untextured (flat colour). */
    texture?: number;
    /** Tangent-space normal map frame (pairs with `texture`; same UVs/tiling). */
    normalMap?: number;
    /** UV repeat across the surface: one number for both axes or {x, y}.
     * Default 1 — the frame stretches once over the natural unwrap. */
    tile?: number | {
        x: number;
        y: number;
    };
    /** Parent handle (a Group3d or another Mesh3d): this mesh's x/y/z and
     * yaw/pitch/roll become LOCAL to it — assemblies, turrets, attachment
     * points. Mesh parents contribute position + rotation only; Group3d.scale
     * is the scaling knob. Live-mutable. */
    parent?: Group3d | Mesh3d | null;
    /** Normal-map strength multiplier (default 1; 0 disables). */
    bump?: number;
    /** Self-illumination 0..n (default 0): adds `color × emissive` unlit —
     * light bulbs, lava, signage. >1 pushes into bloom when a bloom post is
     * on. Purely visual: it does NOT cast light (pair with world.light). */
    emissive?: number;
    /** Blob-shadow override: false = never cast one, true = cast even when
     * the footprint exceeds the auto threshold. Default: automatic. */
    blob?: boolean;
    /** STATIC: packed once and frustum-culled ON THE GPU — the CPU never
     * touches it again. For world geometry that never moves (buildings,
     * terrain props): 100k static meshes cost the CPU nothing per frame.
     * Static meshes cast no blob shadows and ignore later transform
     * mutations (kill() is honoured within ~half a second). */
    static?: boolean;
}
/** A retained mesh — mutate fields freely; kill() removes it. */
export declare class Mesh3d {
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    d: number;
    yaw: number;
    pitch: number;
    roll: number;
    color: string;
    alpha: number;
    gloss: number;
    /** PBR params (metallic 0..1; rough overrides the gloss mapping). */
    metallic: number;
    rough: number | null;
    /** Atlas frame texturing the surface (-1 = untextured flat colour). */
    texture: number;
    /** Normal map frame (-1 = none). */
    normalMap: number;
    tile: number | {
        x: number;
        y: number;
    };
    bump: number;
    /** Self-illumination (0 = none) — see Mesh3dConfig.emissive. */
    emissive: number;
    /** Close-range ground-grain strength (0 = off; terrain chunks set 1). */
    grain: number;
    /** Blob-shadow override (see Mesh3dConfig.blob). */
    blob: boolean | undefined;
    /** Static (GPU-culled) — see Mesh3dConfig.static. */
    readonly static: boolean;
    /** Parent (Group3d / Mesh3d) — pose becomes local to it. Live-mutable. */
    parent: Group3d | Mesh3d | null;
    /** OPT-IN to picking: world.pick() only ever returns meshes with this set
     * (default false — nothing is clickable by accident). A Model3d exposes the
     * same flag, fanning it out to all its parts. Live-mutable. */
    inputEnabled: boolean;
    dead: boolean;
    constructor(c?: Mesh3dConfig);
    kill(): void;
}
/** @deprecated alias — boxes are just meshes now. */
export declare const Box3d: typeof Mesh3d;
export type Box3d = Mesh3d;
export type Box3dConfig = Mesh3dConfig;
export interface Group3dConfig {
    x?: number;
    y?: number;
    z?: number;
    yaw?: number;
    pitch?: number;
    roll?: number;
    /** Uniform scale applied to children (default 1). */
    scale?: number;
    parent?: Group3d | Mesh3d | null;
}
/**
 * A pure TRANSFORM NODE (renders nothing): parent meshes/models/groups to it
 * and drive the whole assembly by mutating one handle — turrets, windmills,
 * orbit systems, attachment points. Chains nest (group → group → mesh).
 */
export declare class Group3d {
    x: number;
    y: number;
    z: number;
    yaw: number;
    pitch: number;
    roll: number;
    scale: number;
    parent: Group3d | Mesh3d | null;
    constructor(c?: Group3dConfig);
    /** Aim this node's local +Z at a world point (sets yaw + pitch). */
    lookAt(x: number, y: number, z: number): void;
}
/**
 * A visible VOLUMETRIC BEAM for a spot light — the glowing "cone of light" a
 * flashlight, searchlight or lighthouse casts through haze. Pass `beam: true`
 * (or a config) to `world.light({ type: 'spot', … })`: the engine draws an
 * ADDITIVE shaft (brightest down the core, soft at the edges, fading along its
 * length) and keeps it aimed, sized and coloured to the light every frame. It
 * reads the scene depth and DISSOLVES where it meets a solid — no cutting
 * through terrain. Purely visual — the *lighting* is still the spot itself.
 */
export interface BeamConfig {
    /** How far the visible shaft reaches, in world units. Default: the light's `radius`. */
    length?: number;
    /** Shaft colour. Default: follows the light's `color` live. */
    color?: string;
    /** Additive core strength (default 0.6): scales the shaft's glow. Push past
     * 1 for a thick searchlight in fog; drop toward 0.2 for a faint hint. */
    intensity?: number;
}
export interface Billboard3dConfig {
    /** Atlas frame index (game.assets.frames()). */
    frame: number;
    x?: number;
    y?: number;
    z?: number;
    /** World size (default 1×1). */
    w?: number;
    h?: number;
    tint?: string;
    flipX?: boolean;
}
/** A retained camera-facing sprite — mutate fields freely; kill() removes it. */
export declare class Billboard3d {
    frame: number;
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    tint?: string;
    flipX: boolean;
    dead: boolean;
    constructor(c: Billboard3dConfig);
    kill(): void;
}
export interface BlobShadow3dConfig {
    x?: number;
    y?: number;
    z?: number;
    /** Footprint the shadow grounds (world units) — the ellipse hugs w×d and
     * reads like the blob a w×d box would drop. Default 1×1. */
    w?: number;
    d?: number;
    /** Rotates the ellipse (radians) — a thin footprint gets a thin shadow. */
    yaw?: number;
    /** Opacity 0..1. Omit to inherit `world.blobs.alpha`. */
    alpha?: number;
    /** Parent (Group3d / Mesh3d) — the shadow rides its world pose. Live. */
    parent?: Group3d | Mesh3d | null;
}
/**
 * A single soft contact-shadow ellipse, decoupled from any mesh. Parent one to
 * an ASSEMBLY group (chair, desk, bed) and it drops ONE clean blob for the
 * whole thing — where the per-mesh auto blobs would otherwise stack into a
 * messy cluster (set `blob:false` on the parts, or scope auto blobs off). It
 * only ever draws while blob shadows are enabled, so nothing to hide. Mutate
 * fields freely; kill() removes it.
 */
export declare class BlobShadow3d {
    x: number;
    y: number;
    z: number;
    w: number;
    d: number;
    yaw: number;
    /** Base opacity, or null to inherit world.blobs.alpha. */
    alpha: number | null;
    parent: Group3d | Mesh3d | null;
    dead: boolean;
    constructor(c?: BlobShadow3dConfig);
    kill(): void;
}
export interface World3dOptions {
    /** Vertical field of view, degrees (default 60). */
    fov?: number;
    /** Distance fog (default: on, '#0b0e1a' 25..90). Set null for none. */
    fog?: {
        color: string;
        near: number;
        far: number;
    } | null;
    /** Light: direction the light TRAVELS (default down-forward) + ambient floor 0..1.
     * `sky`/`ground` tint the ambient as a HEMISPHERE (from-above vs bounce
     * colour, blended by surface normal; default white = flat classic). */
    light?: {
        x?: number;
        y?: number;
        z?: number;
        ambient?: number;
        sky?: string;
        ground?: string;
    };
    /** 4× MSAA on the 3D pass (default true — WebGPU offers only 1 or 4; 4× at
     * dpr 1 is the cheap way to smooth alpha edges. false = raw, fastest). */
    msaa?: boolean;
    /** Frustum culling at pack time (default true): off-screen meshes skip
     * packing, upload AND drawing — big sprawling worlds only pay for what
     * the camera (or the shadow box) can see. `world.cull` is live. */
    cull?: boolean;
    /** BLOB shadows (default true): a soft dark ellipse grounds every mesh,
     * model and billboard under any lighting — the cheap game default.
     * Pass false for none, or { alpha, max, fade, ground } to tune (footprints
     * over `max` cast nothing — floors; alpha fades to zero at `fade` height).
     * Calling world.shadows(true) switches to the REAL sun map and turns
     * blobs off (shadows(false) restores them). Live at `world.blobs`. */
    blobShadows?: boolean | {
        alpha?: number;
        max?: number;
        fade?: number;
        ground?: number;
        lift?: number;
    };
    /** Billboard sampling: 'linear' (smooth, default) or 'nearest' (pixel art). Game passes its own. */
    filter?: GPUFilterMode;
}
/** Pure blob-shadow parameters for one object (dist-tested): fw/fd = the
 * horizontal extents, bottom = height of the object's base above the ground
 * plane. Returns per-axis ELLIPSE radii, or null when the object casts no
 * blob (too big — floors/plazas; underground; higher than `fade` — blobs
 * are CONTACT shadows: stacked or flying objects must not project offset
 * ghosts onto the ground plane). `force` bypasses the footprint gate. */
export declare function blobParams(fw: number, fd: number, bottom: number, opts: {
    max: number;
    fade: number;
    alpha: number;
}, force?: boolean): {
    rx: number;
    rz: number;
    alpha: number;
} | null;
/** A steam/smoke ribbon in the 3D world. All fields live-mutable. */
export interface WispConfig {
    /** A TILEABLE grayscale noise frame (game.assets.frames(noiseCanvas({ ... }))). */
    frame: number;
    x?: number;
    y?: number;
    z?: number;
    /** Ribbon width/height in world units (anchored at its BASE, y up). */
    w?: number;
    h?: number;
    color?: string;
    alpha?: number;
    /** Twist strength in radians (the noise value scales it; ~10 = coffee). */
    twist?: number;
    /** Wind sway at the top, world units. */
    wind?: number;
    /** Animation speed multiplier (1 = the reference coffee pace). */
    speed?: number;
    /** smoothstep(lo, hi) density remap of the noise (default [0.4, 1]). */
    remap?: [number, number];
    /** EXTRA yaw on top of the auto-facing — the wisp Y-billboards toward the
     * camera by itself (a single plane seen edge-on collapses; this never is). */
    yaw?: number;
}
export declare class Wisp3d {
    frame: number;
    x: number;
    y: number;
    z: number;
    w: number;
    h: number;
    color: string;
    alpha: number;
    twist: number;
    wind: number;
    speed: number;
    remap: [number, number];
    yaw: number;
    dead: boolean;
    constructor(c: WispConfig);
    kill(): void;
}
/**
 * Resample a trail's raw point history (oldest first) into `n` control
 * points HEAD (newest) → TAIL, each xyz + fade k (1 head → 0 at end of
 * `life`), spaced UNIFORMLY IN ARC LENGTH — so the ribbon's parameter is
 * proportional to distance along the path (stable curves at any speed, and
 * the shader can reconstruct absolute travelled distance linearly).
 * Pure — exported for headless tests.
 */
export declare function resampleTrail(points: ReadonlyArray<{
    x: number;
    y: number;
    z: number;
    age: number;
}>, n: number, life: number, out?: Float32Array, offset?: number): Float32Array;
/**
 * The Catmull-Rom the trail VERTEX STAGE runs — kept in EXACT sync with
 * TRAIL_WGSL's cr() (change both together). Pure, exported for headless
 * tests: for collinear evenly spaced control points the t³ term must vanish
 * and the curve be exactly linear — a sign slip here once shipped as the
 * "stack of quads" bowtie ribbon (the curve oscillated between points).
 * `pts` is resampleTrail's layout (n × vec4: xyz + fade), s in [0,1].
 */
export declare function crTrail(pts: ArrayLike<number>, n: number, s: number): [number, number, number, number];
export interface Trail3dOptions {
    /** Ribbon width in world units (default: the def's 2D width × 0.1). */
    width?: number;
    /** Seconds a point survives (default: the def's life). */
    life?: number;
    /** Auto-feed from this handle each tick (mesh/billboard/anything with xyz).
     * The trail releases itself when the target dies. */
    follow?: {
        x: number;
        y: number;
        z: number;
        dead?: boolean;
    } | null;
    /** Feed offset from the followed handle (e.g. lift to an exhaust point). */
    offset?: {
        x?: number;
        y?: number;
        z?: number;
    };
    /** Min distance between recorded points, world units (default width × 0.5). */
    spacing?: number;
    /** Override the auto-generated tileable noise frame (turbulence + erosion). */
    noiseFrame?: number;
    /** Override the def's orientation: 'view' (camera-facing ribbon) or 'up'
     * (a vertical base-anchored wall — the Tron light-cycle trail). */
    facing?: 'view' | 'up';
}
/** A live 3D trail — feed `point(x, y, z)` per frame (or pass `follow`).
 * All style fields live-mutable, like every other 3D handle. */
export declare class Trail3d {
    width: number;
    life: number;
    colors: string[];
    add: boolean;
    taper: boolean;
    alpha: number;
    turbulence: number;
    erode: number;
    core: number;
    fiber: number;
    hard: number;
    /** Electric glint inside the ribbon 0..1 — live-mutable like the rest. */
    crackle: number;
    facing: 'view' | 'up';
    spacing: number;
    follow: {
        x: number;
        y: number;
        z: number;
        dead?: boolean;
    } | null;
    offset: {
        x: number;
        y: number;
        z: number;
    };
    /** The tileable noise frame driving flutter + erosion. */
    frame: number;
    hy: number; /** @internal */
    hz: number;
    private readonly sparks;
    private shedAcc;
    /** Record the head position for this frame. Lands EXACTLY on the live
     * head; a new history point is committed once it moves `spacing` away. */
    point(x: number, y: number, z: number): void;
    /** Stop feeding; the ribbon fades out, then auto-removes. */
    release(): void;
}
export declare class World3d {
    private format;
    private atlas;
    /** The perspective camera — mutate freely (world units, Y-UP). It's a
     *  look-at camera: eye `(x,y,z)` + target `(tx,ty,tz)`. The helpers set the
     *  target for you; `face()` is the first-person aim (+Z forward, same
     *  convention as a mesh's `yaw`). */
    readonly camera: {
        x: number;
        y: number;
        z: number;
        tx: number;
        ty: number;
        tz: number;
        fov: number;
        /** Aim the camera at an absolute world point. */
        lookAt(x: number, y: number, z: number): void;
        /** Aim the camera along a direction from its current position (e.g. a
         *  forward vector) — the target is placed one unit down that ray. */
        lookDir(dx: number, dy: number, dz: number): void;
        /** Aim the camera by yaw/pitch using the engine's `+Z`-forward convention —
         *  the same `yaw` a mesh uses. This is the first-person / look-around helper
         *  (set eye `x,y,z` first). */
        face(yaw: number, pitch?: number): void;
    };
    /** Frustum culling at pack time (live-togglable; see World3dOptions). */
    cull: boolean;
    /** Blob-shadow config (live): enabled/alpha/max/fade/ground/lift. `lift`
     * (default 0 = hug the ground) raises the ellipse by `lift × footprint` —
     * dial it up ONLY on undulating ground (sand ripples, dunes) where a
     * ground-hugging quad would bury its middle in the first bump and render as
     * a hollow ring. Flat worlds want 0 so the blob doesn't poke up through
     * ramps/sloped tops. */
    readonly blobs: {
        enabled: boolean;
        alpha: number;
        max: number;
        fade: number;
        ground: number;
        lift: number;
    };
    /**
     * Optional rigid-body physics world (`Physics3d`). Assign it once after
     * `await Physics3d.create(...)` and the Game steps + syncs every bound mesh
     * each frame — no per-frame physics code in the game. `null` = no physics
     * (the default — nothing is loaded). Type-only import: the ~1 MB core chunk
     * still loads lazily behind `Physics3d.create()`.
     */
    physics: Physics3d | null;
    fog: {
        color: string;
        near: number;
        far: number;
    } | null;
    /** Samples per pixel for the 3D pass (4 = smooth, 1 = raw). */
    readonly sampleCount: number;
    /**
     * The 3D particle system — `world.fx.emit({ x, y, z, ... })` for bursts
     * and streams (fire, fountains, debris), `world.burst()` for VfxDef
     * recipes. Pooled CPU sim, one instanced draw for everything live.
     */
    readonly fx: Particles3d;
    private gpu;
    /** Grass fields (E6 vegetation Phase 2) — compute-spawned instanced blades,
     * one follow-window per terrain that called terrain.grass(). colorKey is
     * the terrain's first chunk bucket, for re-reading its colormap on rebuild. */
    private grassFields;
    private animated;
    private shadowOpts;
    private shadowTex;
    private shadowPipeline;
    private shadowLayout;
    private shadowUni;
    private curVp;
    private curView;
    private curProj;
    private curBasis;
    private curNear;
    private curFar;
    private lastVp;
    private lastInv;
    private lastProjA;
    private lastProjB;
    private geos;
    private bills;
    private blobShadowsList;
    private vecLayer;
    private skyLayer;
    private skyHandle;
    private waterLayer;
    private waters;
    /** The voxel/Minecraft layer — null until `world.voxels()`. */
    private voxelLayer;
    /** The underwater feature — null until `world.underwater()`. Public so the
     * game reads `submerged`/`depth` and tunes it live. */
    underwater3d: Underwater3d | null;
    private underwaterLayer;
    /** The game's own fog, saved on the falling edge so it restores on surface. */
    private uwSavedFog;
    private depthViewFor;
    private depthViewCache;
    private flareLayer;
    /** null = automatic (on when a sky is attached with flare enabled). */
    private flareOn;
    private sunScreenCache;
    private ghostPipeline;
    private skinPipeline;
    private skinShadowPipeline;
    private skinLayout;
    private skinShadowLayout;
    private cullPipeline;
    private cullLayout;
    private cullUni;
    private staticPipeline;
    private staticShadowPipeline;
    private staticRescan;
    private warnedDynamicScale;
    private staticMeshLayout;
    private staticShadowLayout;
    private deformStaticLayout;
    private deformStaticPipeline;
    private deformSurfaceLayout;
    private deformSurfacePipeline;
    private deformRecs;
    private palettesData;
    private palettesTop;
    private palettesBuf;
    private ghostShapes;
    /** The steering/flocking movement system — null until `world.agents()`. */
    agents3d: Agents3d | null;
    private agentGizmos;
    private beams;
    private beamInput;
    private beamLayer;
    private blobData;
    private blobCount;
    private blobBuf;
    private blobBind;
    private blobLayout;
    private blobPipeline;
    private wisps;
    private trails;
    private trailNoise;
    private trailSeed;
    private animSeq;
    private time;
    private sun;
    private filter;
    private uniformData;
    private sunColData;
    private bbData;
    private wispData;
    private trailData;
    private fxData;
    private device;
    private meshPipeline;
    private meshBlendPipeline;
    private bbPipeline;
    private wispPipeline;
    private trailPipeline;
    private trailUpPipeline;
    private fxPipeline;
    private meshLayout;
    private bbLayout;
    private wispLayout;
    private pickPipeline?;
    private pickLayout?;
    private pickStaticPipeline?;
    private pickStaticLayout?;
    private pickBaseBuf?;
    private pickTex?;
    private pickDepth?;
    private pickW;
    private pickH;
    private uniforms;
    private bbBuf;
    private wispBuf;
    private trailBuf;
    private fxBuf;
    private sampler;
    private bbBind;
    private wispBind;
    private trailBind;
    private fxBind;
    private textureView;
    private whiteView;
    private envView;
    private envTex;
    private envSource;
    private envDirty;
    private envCustom;
    private envStrength;
    private flatNormalView;
    constructor(device: GPUDevice, format: GPUTextureFormat, atlas: Atlas, opts?: World3dOptions);
    /** Add a box (flat-shaded). `segs` grids each face (for deformers/vertex fx). */
    box(config?: Mesh3dConfig & {
        segs?: number;
    }): Mesh3d;
    /** Add a smooth UV sphere (unit diameter — w/h/d scale it). Drop `segs`/`rings` right down for a faceted low-poly look. */
    sphere(config?: Mesh3dConfig & {
        segs?: number;
        rings?: number;
    }): Mesh3d;
    /** Add a capped cylinder — or a frustum via `rTop`/`rBottom` (fractions of
     * the unit radius; rTop 0 = spun cone), `open` uncaps it, `arc` sweeps a portion. */
    cylinder(config?: Mesh3dConfig & {
        segs?: number;
        rTop?: number;
        rBottom?: number;
        open?: boolean;
        arc?: number;
    }): Mesh3d;
    /** Add a smooth torus (outer diameter 1, XZ plane). `tube` = tube thickness
     * (0..1 of the half-extent), `arc` sweeps a portion of the ring. */
    torus(config?: Mesh3dConfig & {
        tube?: number;
        segs?: number;
        sides?: number;
        arc?: number;
    }): Mesh3d;
    /** Add a torus knot — a (p, q) winding closed tube (the classic pretzel). */
    torusKnot(config?: Mesh3dConfig & {
        p?: number;
        q?: number;
        segs?: number;
        sides?: number;
        tube?: number;
    }): Mesh3d;
    /** Add a chamfered box — bevelled edges/corners (`r` = bevel radius fraction, `segs` = bevel smoothness). */
    roundedBox(config?: Mesh3dConfig & {
        r?: number;
        segs?: number;
    }): Mesh3d;
    /** Add a capped cone (apex up). `open` skips the base, `arc` sweeps a portion. */
    cone(config?: Mesh3dConfig & {
        segs?: number;
        open?: boolean;
        arc?: number;
    }): Mesh3d;
    /** Add a capsule/pill (total height 1; `r` = cap radius, default 0.25). */
    capsule(config?: Mesh3dConfig & {
        segs?: number;
        rings?: number;
        r?: number;
    }): Mesh3d;
    /** Add a wedge ramp — a unit box halved diagonally (slope rises toward -x). */
    wedge(config?: Mesh3dConfig): Mesh3d;
    /** Add a flat double-sided quad in the XZ plane. `segs` grids it — use
     * plenty under deformers/vertex effects (2 tris = one giant interpolation). */
    plane(config?: Mesh3dConfig & {
        segs?: number;
    }): Mesh3d;
    /** Add a flat disc or pie slice (`arc` 0..1), double-sided, XZ plane. */
    circle(config?: Mesh3dConfig & {
        segs?: number;
        arc?: number;
    }): Mesh3d;
    /** Add a flat ring/annulus (`inner` = inner radius fraction, `arc` = portion), double-sided, XZ plane. */
    ring(config?: Mesh3dConfig & {
        inner?: number;
        segs?: number;
        arc?: number;
    }): Mesh3d;
    /** Add a panel — an extruded ROUNDED-CORNER rectangle (cards, plaques; scale h thin). */
    panel(config?: Mesh3dConfig & {
        r?: number;
        segs?: number;
    }): Mesh3d;
    /** Add a disc — a filleted cylinder: coin / chip / puck / wheel (scale h thin; roll ±90° upright). */
    disc(config?: Mesh3dConfig & {
        fillet?: number;
        segs?: number;
        filletSegs?: number;
    }): Mesh3d;
    /** Add a tetrahedron (4-face solid). `detail` subdivides toward a sphere. */
    tetrahedron(config?: Mesh3dConfig & {
        detail?: number;
    }): Mesh3d;
    /** Add an octahedron (8-face solid). `detail` subdivides toward a sphere. */
    octahedron(config?: Mesh3dConfig & {
        detail?: number;
    }): Mesh3d;
    /** Add a dodecahedron (12-face solid). `detail` subdivides toward a sphere. */
    dodecahedron(config?: Mesh3dConfig & {
        detail?: number;
    }): Mesh3d;
    /** Add an icosahedron (20-face solid) — evenly-sized triangles; the best faceted "geo-sphere". */
    icosahedron(config?: Mesh3dConfig & {
        detail?: number;
    }): Mesh3d;
    /** Add a lathe — a [d, y] profile (bottom→top) revolved around Y (vases,
     * pawns, goblets). Auto-fit to the unit box; `arc` revolves a portion. */
    lathe(config: Mesh3dConfig & {
        points: Array<[number, number]>;
        segs?: number;
        arc?: number;
    }): Mesh3d;
    /** Add a tube swept along a 3D polyline (pipes, rails, worms). Auto-fit;
     * `r` = tube radius fraction, `closed` joins the ends into a loop. */
    tube(config: Mesh3dConfig & {
        path: number[][];
        r?: number;
        sides?: number;
        closed?: boolean;
    }): Mesh3d;
    /** Add a flat filled shape from a simple [x, z] outline (no holes),
     * double-sided, auto-fit (hearts, stars, arrows laid flat). */
    shape(config: Mesh3dConfig & {
        outline: Array<[number, number]>;
    }): Mesh3d;
    /** Add an extrusion of a simple [x, z] outline through unit height, with an
     * optional rounded `bevel` (fraction of the half-height) at both caps. */
    extrude(config: Mesh3dConfig & {
        outline: Array<[number, number]>;
        bevel?: number;
        bevelSegs?: number;
    }): Mesh3d;
    /**
     * Add a mesh with CUSTOM geometry — the procgen-pack door. `verts` is a
     * unit-sized triangle soup (interleaved pos+normal+uv, 8 floats per vertex
     * — build with the geometry3d `Builder`, which self-corrects winding and
     * box-projects UVs for any point that doesn't supply its own).
     * Same `name` = same instanced draw; the generator runs once per name.
     */
    custom(name: string, verts: () => Float32Array<ArrayBuffer>, config?: Mesh3dConfig): Mesh3d;
    private terrainRecs;
    private terrainSeq;
    /**
     * TERRAIN — a seeded-noise (or custom-shaped) heightfield, chunked into
     * `static: true` meshes (GPU-culled) and coloured by height/slope BANDS
     * baked into one shared colormap: `world.terrain()` alone is a full
     * island. Gameplay drives off the returned handle: `heightAt(x, z)` is
     * TRIANGLE-EXACT against the render (karts/characters sit ON the ground),
     * plus `normalAt`/`slopeAt`. Presets: shape 'island' | 'hills' |
     * 'mountains' | 'dunes' | fn, surface 'grass' | 'sand' | 'snow' | 'rock'.
     */
    terrain(opts?: TerrainOptions): Terrain3d;
    private makeDeformTex;
    /** Bake a heightfield's (res+1)² world-Y samples into an r32float texture
     * — the snow-layer VS reads the base height off this (manual bilinear).
     * Uploaded once; static (the base terrain never changes). */
    private makeBaseHeightTex;
    private deformSurfaceBind;
    /** The canvas the game renders to — set by game.world3d(), used by orbit(). */
    canvasEl: HTMLCanvasElement | null;
    /**
     * SSAO — screen-space ambient occlusion over this world: creases, contact
     * points and corners darken naturally. Costs one half-res estimate + blur
     * per frame. `world.ssao(true)`, `world.ssao({ radius, strength, power })`
     * to tune, `false` to stop. WebGPU only.
     */
    ssao(on?: boolean | SsaoOptions): void;
    /**
     * GOD RAYS — screen-space light shafts from this world's sun (one half-res
     * radial march against the opaque depth, composited additively). With a sky
     * attached the day/night dial moves and colours the shafts for free; they
     * fade when the sun leaves the frame and dim under storm. `world.rays(true)`,
     * `{ strength, decay }` to tune, `false` to stop. WebGPU only.
     */
    rays(on?: boolean | RaysOptions): void;
    private curInvVp;
    private followCfg;
    /** The attached orbit rig, if any (world.orbit()) — rig.enabled pauses it. */
    rig: OrbitRig | null;
    /**
     * Attach the ORBIT RIG — the standard 3D camera controller: left-drag
     * orbits, right-drag (or shift+drag) pans, the wheel dollies toward the
     * CURSOR, and `fly: true` adds WASD/arrow + Q/E flying (debug walks).
     * While attached and enabled it writes `world.camera` every frame — call
     * `.detach()` (or set `.enabled = false`) to drive the camera yourself.
     */
    /** A SurfaceSampler over a mesh's unit geometry — the MESH-SURFACE
     * emitter shape: world.fx.emit({ surface: world.surface(m), on: m, ... })
     * spawns particles ON the mesh, launching along its normals by default.
     * For a loaded model, pass one of model.parts. Built once per call —
     * cache the sampler, not the mesh. */
    surface(mesh: Mesh3d): SurfaceSampler;
    /** RETRO VECTOR LINES in the 3D world: polylines of [x, y, z] points →
   * one retained shape (live x/y/z, yaw/pitch/roll, scale, color, width in
   * SCREEN PIXELS — hairlines stay hairlines at any distance). Depth-tested
   * against the solid world; one instanced draw for every shape. */
    lines(polylines: Array<Array<[number, number, number]>>, opts?: VectorShape3dOptions): VectorShape3d;
    /** Steering GIZMOS (agents plan §5.8 — non-negotiable for tuning): when
     * `world.agents().debug` is on, draw each agent's velocity (green), net
     * steering force (orange), avoid feeler (cyan), live A* path (violet) and
     * every field's radius ring (magenta) as world-space lines, refilled each
     * frame. Off → the lines are emptied (nothing drawn). */
    private updateAgentGizmos;
    /** Crease/boundary edge extraction for a CUSTOM vert soup — the same
     * extractor `loadWireframe` uses, exposed on the world (the standalone
     * function lives in the lazy 3D chunk, not the main bundle). Feed the
     * result to `world.lines()`-style segs via `new VectorShape3d`, or just
     * use `loadWireframe` for files. */
    wireframeEdges(verts: Float32Array, angle?: number): Array<[number, number, number, number, number, number]>;
    /** A model as RETRO WIREFRAME: load OBJ or GLB, weld the triangle soup
     * and keep only boundary + crease edges (`angle` degrees, default 20 —
     * a cube is 12 edges, not 36 triangle sides), unit-fit like every model
     * (size with `scale`). Returns a live VectorShape3d. */
    loadWireframe(url: string, opts?: VectorShape3dOptions & {
        angle?: number;
        hiddenLine?: boolean;
    }): Promise<VectorShape3d>;
    /** A world-space PICKING RAY under a pointer event (the input.toWorld
   * input shape). `ground(h)` intersects it with the plane y = h — "where
   * on the floor did I click". null before the first rendered frame. */
    screenRay(e: {
        clientX: number;
        clientY: number;
    }): {
        origin: {
            x: number;
            y: number;
            z: number;
        };
        dir: {
            x: number;
            y: number;
            z: number;
        };
        ground: (h?: number) => {
            x: number;
            y: number;
            z: number;
        } | null;
    } | null;
    /** PICK the mesh under the pointer, on the GPU: render every pickable
     * instance's id into an r32uint target (scissored to the cursor pixel) and
     * read that one texel back — O(1) per click at any instance count, and
     * PIXEL-EXACT (the true silhouette + depth, not a bounding box). Async:
     * resolves after a GPU→CPU readback (~a frame). Returns the nearest pickable
     * mesh at the pointer, or null.
     *
     * OPT-IN: only meshes with `inputEnabled = true` are ever returned (a model's
     * flag fans out to its parts). `occlude` (default true) decides what the OTHER
     * geometry does: true = solid, it blocks clicks on enabled meshes behind it
     * (clicking scenery selects nothing); false = see-through, the pick passes
     * through to the nearest enabled mesh.
     *
     * COVERAGE: dynamic AND static meshes + loaded models (opaque + translucent;
     * static via the GPU-cull visIdx indirect draw). NOT skinned/animated GLB,
     * terrain, grass or billboards. For WORLD-SPACE ray tests (bullets, AI
     * line-of-sight) use world.physics.raycast — pick is screen picking, the
     * camera ray only. Needs a rendered frame first (reuses the last frame's
     * camera + packed buffers), so call it from a pointer handler, not before
     * the first frame. */
    pick(e: {
        clientX: number;
        clientY: number;
    }, opts?: {
        occlude?: boolean;
    }): Promise<{
        mesh: Mesh3d;
        id: number;
    } | null>;
    private ensurePickPipeline;
    private ensurePickTargets;
    /** PROJECT a world point to CANVAS pixels (CSS units, origin top-left):
     * label pins, health bars, off-screen arrows. `visible` = inside the
     * frustum; `depth` 0..1 for near/far sorting. game.project3d() converts
     * onward into the 2D layer's coordinates. */
    project(x: number, y: number, z: number): {
        x: number;
        y: number;
        depth: number;
        visible: boolean;
    } | null;
    /** FOLLOW camera: eases the camera to target + offset and aims at
     * target + look, every frame — the chase cam without the boilerplate.
     * Any live handle with x/y/z works (mesh, model, group). follow(null)
     * stops; using world.orbit() instead is the inspect-camera choice. */
    follow(target: {
        x: number;
        y: number;
        z: number;
    } | null, opts?: {
        offset?: {
            x?: number;
            y?: number;
            z?: number;
        };
        look?: {
            x?: number;
            y?: number;
            z?: number;
        };
        ease?: number;
    }): void;
    orbit(opts?: OrbitOptions): OrbitRig;
    /** Per-frame step: orbit rig, the wisp/trail clock, trail ageing, the
     * particle sim (the game calls this). */
    tick(dt: number): void;
    /**
     * Trigger a one-shot VfxDef.burst recipe at a point — the same def names
     * as 2D ('impact', 'shockwave', …): particle layers ride `world.fx`,
     * expanding rings + flash discs render as camera-facing quads. The def's
     * 2D-tuned numbers scale by `opts.scale` (default 0.1 — the trail-width
     * convention); `opts.dir` aims directional emits.
     */
    burst(vfx: string | VfxDef, x: number, y: number, z: number, opts?: Burst3dOptions): void;
    /**
     * Add a GPU-COMPUTE particle emitter — the high-count tier. Where
     * `world.fx` is the CPU pool for bursts and streams, an emitter is a
     * PERSISTENT pool of up to hundreds of thousands of particles simulated
     * entirely on the GPU: forces are data (accel / drag / CURL NOISE /
     * attract / vortex / orbit), particles collide with the DEPTH BUFFER
     * (`collide: true` — they bounce off whatever is on screen, no colliders),
     * fade softly into geometry, and velocity-stretch into sparks. Additive by
     * default (the pool is unsorted). Mutate the handle live (x/y/z/rate/
     * opts.forces…); `handle.burst(n)` one-shots; `handle.kill()` releases.
     */
    emitter(opts?: GpuEmitterOptions): GpuEmitter;
    /**
     * Add a dynamic POINT or SPOT light (Lighting 2.0 — clustered forward+:
     * the fragment shader only shades the lights that reach its screen
     * cluster, so dozens-to-hundreds are fine). Handles are live
     * (x/y/z/color/intensity/radius/dir/cone); kill() releases. `radius` is
     * honest — it drives both the falloff AND the cluster binning.
     */
    light(config?: LightConfig & {
        beam?: boolean | BeamConfig;
    }): Light3d;
    /**
     * Directional SHADOWS for the world's sun light: a depth-only pass into a
     * shadow map, PCF-filtered in the mesh shader. `size` = the half-extent
     * of the shadowed area around the camera target (world units — the map
     * follows the camera). Pass false to turn off.
     */
    shadows(on?: boolean | {
        size?: number;
        res?: number;
        bias?: number;
    }): void;
    /**
     * THE SKY — a procedural dome drawn behind everything: gradient + sun
     * disc + two drifting FBM cloud layers + stars and a moon at night. ONE
     * `sky.time` dial (0..24 h) drives the whole day: sky colours, sun
     * direction/colour/intensity, hemisphere ambient, fog colour and the env
     * bake move together (`drive: false` keeps manual lighting control).
     * `sky.cycle(120)` = a full day every two minutes. `sky.storm` 0→1 packs
     * and darkens the clouds and dims the sun. All fields live.
     */
    sky(opts?: SkyOptions): Sky3d;
    /**
     * WATER — one system, every scale. No `path` = a GRID water: a Gerstner-
     * wave surface (presets 'sea' | 'ocean' | 'lake' | 'pool') with soft
     * depth-blended shorelines, animated shore foam, crest whitecaps, sky
     * reflections and sun glint — `water.heightAt(x, z)` is the exact CPU
     * wave for boats. With `path` = a RIBBON water (preset 'stream'): a strip
     * flowing along the points; STEEP sections foam up and accelerate, so a
     * waterfall is just a stream over a cliff. Lit by the same sun/fog/env
     * as everything else — the sky dial changes the water for free.
     */
    /**
     * AGENTS — the steering/flocking/movement system (lazy, one per world).
     * Everything that moves with intent: fireflies (`wander` + `attractor`),
     * fish/shoals (`flock` + `flee`), monsters (`pursue` + `avoid`), birds,
     * patrols along a `Path3d`, minions following a leader. Agents write their
     * pose onto retained render handles (mesh/billboard/group), so rendering
     * costs nothing new. Ticks on a fixed step with render interpolation.
     *   const school = world.agents().flock({ preset: 'shoal', handle: ... }, 200);
     */
    agents(opts?: AgentsOptions): Agents3d;
    water(opts?: WaterOptions): Water3d;
    /**
     * VOXELS — a Minecraft-style block world: a chunked, editable volume with a
     * procedural block "texture pack", exposed-face meshing + baked AO, and a
     * `raycast` for hitting/placing blocks. Lit and fogged by THIS world's sun
     * and sky, so it matches the day/night dial for free. Author it with
     * `vox.generate((x,y,z) => id)`, edit with `vox.set(x,y,z,id)`. One per world.
     */
    voxels(opts?: VoxelOptions): Voxels3d;
    /** BLOCK EDITOR — the reusable "aim at a block and change it" logic: a
     *  debounced raycast, the target OUTLINE + placement GHOST, held-button
     *  cadence, optional per-block hardness, and an anti-embed guard. It carries
     *  no effects — it EMITS `onHit`/`onBreak`/`onPlace` (also returned from
     *  `update`) so the game spawns its own debris/drops/sounds. Drive it with a
     *  camera ray each frame (e.g. from `mcControls`). See minecraft-controls.md. */
    voxelEditor(vox: Voxels3d, opts?: VoxelEditorOptions): VoxelEditor;
    /**
     * UNDERWATER — makes being BELOW the water FEEL underwater: per-channel
     * light absorption (murk closes in, red dies first), a soft vignette, the
     * half-in/half-out waterline split, caustics on the seabed (M2) and the
     * Snell's-window surface from below (M3). Depth-gated by `minDepth` so a
     * puddle never triggers it, and byte-free until this call. Defaults to the
     * first grid water body; pass `water:` to pick another.
     */
    underwater(opts?: UnderwaterOptions): Underwater3d;
    /** Add the underwater absorption/murk over the resolved 3D image, inside the
     * open scene pass (called by the Game, next to the SSAO/rays composites). */
    compositeUnderwater(pass: GPURenderPassEncoder, worldDepth: GPUTexture): void;
    /** Encode the HALF-RES underwater shaft march — encoder-level, must run
     * BEFORE the scene pass whose composite samples it (game.ts calls this
     * next to the SSAO/god-ray passes). */
    renderUnderwaterShafts(encoder: GPUCommandEncoder, worldDepth: GPUTexture, canvasW: number, canvasH: number): void;
    /**
     * LENS FLARE on the sun — a procedural ghost chain, depth-occluded (a
     * hill covering the sun collapses it) and faded by night/storm/
     * off-screen. ON automatically when a sky is attached (`world.sky({
     * flare: false })` opts out); call this to force it either way in
     * manual-lighting scenes. Pair with `world.rays(true)` for light shafts.
     */
    flare(on?: boolean): void;
    /** The sun's screen position + faded intensity this frame (null when
     * behind the camera or fully faded) — god rays consume this. */
    get sunScreen(): {
        x: number;
        y: number;
        intensity: number;
        color: [number, number, number];
    } | null;
    /** Re-aim the directional SUN light (the direction light travels), and
     * optionally retune the ambient floor — time-of-day systems drive this
     * per frame. */
    setSun(x: number, y: number, z: number, ambient?: number): void;
    /** HEMISPHERE ambient: `intensity` scales it; `sky` tints light arriving
     * from above, `ground` from below (bounce), blended by each surface
     * normal — moonlight blue over lamplit amber transforms a night scene
     * for free. One colour = flat tinted ambient; default white = classic. */
    setAmbient(intensity: number, sky?: string, ground?: string): void;
    /** Create a transform-node GROUP (renders nothing): parent meshes/models
     * to it and pose the whole assembly through one handle. */
    group(config?: Group3dConfig): Group3d;
    /** Aim any posed handle's local +Z at a world point (meshes, groups,
     * models — anything with x/y/z + yaw/pitch). NOTE: uses the handle's OWN
     * coordinates, so for parented handles aim at a target in the SAME local
     * space as the handle. */
    lookAt(handle: {
        x: number;
        y: number;
        z: number;
        yaw: number;
        pitch: number;
    }, x: number, y: number, z: number): void;
    /**
     * Add a TRAIL — a VfxDef ribbon (vfx.ts: 'flameTrail', 'sparkTrail'…, or a
     * custom def) in TRUE 3D: a Catmull-Rom-smoothed, view-facing ribbon with
     * noise flutter, a white-hot core and a tail that ERODES into wisps.
     * Feed it `point(x, y, z)` per frame, or pass `follow` to auto-feed from a
     * mesh; `release()` fades it out. Width: a trail should never outsize the
     * object it streams from — when following, it defaults to the handle's own
     * size; otherwise to a tenth of the def's 2D width (override with
     * `opts.width`, world units).
     */
    trail(vfx: string | VfxDef, opts?: Trail3dOptions): Trail3d;
    /** Add a camera-facing sprite, anchored at its BASE point (it stands on x/y/z). */
    billboard(config: Billboard3dConfig): Billboard3d;
    /**
     * Add ONE soft contact-shadow ellipse (see `BlobShadow3d`). Parent it to an
     * assembly group so the whole object grounds with a single clean blob instead
     * of a per-mesh cluster. Only draws while blob shadows are enabled.
     */
    blobShadow(config?: BlobShadow3dConfig): BlobShadow3d;
    /**
     * Add a WISP — steam/smoke as a true-3D twisting ribbon (Bruno Simon's
     * coffee-smoke technique): a subdivided plane, vertex-twisted around its
     * own axis and wind-blown, both driven BY the noise texture; the fragment
     * scrolls the noise upward with a density remap and edge fades. Pass a
     * TILEABLE grayscale noise frame. Anchored at its BASE (stands on x/y/z).
     */
    wisp(config: WispConfig): Wisp3d;
    /** Live handle counts + draw-call count (HUD/debug). `gpuParticles` is the
     * GPU emitters' alive total — an async readback, ~2 frames stale. */
    get counts(): {
        meshes: number;
        drawn: number;
        culled: number;
        staticMeshes: number;
        billboards: number;
        blobs: number;
        lines: number;
        wisps: number;
        trails: number;
        particles: number;
        gpuParticles: number;
        waters: number;
        draws: number;
    };
    private mesh;
    private makeGeo;
    /** The skinned bucket's bind group (mesh layout + palette pool + bases). */
    private skinBindFor;
    private modelMesh;
    /**
     * Load a Wavefront OBJ (+ its MTL and diffuse textures where they exist)
     * as a live model: one bucket per material, all under one Model3d handle.
     * Real-world OBJs lie constantly — the declared mtllib name is tried
     * first, then <basename>.mtl beside the file; map_Kd paths resolve by
     * BASENAME beside the obj and silently fall back to the Kd colour.
     * Vertices unit-fit like every primitive (size with w/h/d).
     */
    loadObj(url: string, config?: ModelConfig): Promise<Model3d>;
    /**
     * Load a GLB (glTF 2.0 Binary) as a live model: one bucket per primitive,
     * PBR materials mapped straight onto the mesh shader (baseColor factor +
     * texture as sRGB, metallic/roughness factors, normal map + scale;
     * embedded images decode from the BIN chunk — no external files). Node
     * transforms are baked (static pose; skinning/animation is stage 3).
     * Vertices unit-fit like every primitive (size with w/h/d).
     */
    loadGlb(url: string, config?: ModelConfig): Promise<Model3d>;
    /**
     * ENVIRONMENT reflections (IBL-lite): glossy and metallic surfaces
     * reflect an equirect sky — the fix for "metals go dark away from
     * lights". ON by default with a PROCEDURAL sky baked from the
     * hemisphere ambient + the sun (re-baked when setSun/setAmbient move
     * them); pass a URL or canvas for a real panorama, `false` to disable,
     * or { strength } to tune. Roughness picks the mip: mirrors get the
     * sharp sky, matte surfaces a blurred average.
     */
    env(src?: string | HTMLCanvasElement | false | {
        strength?: number;
    }): Promise<void>;
    /** Bake the procedural equirect sky: hemisphere gradient + sun disc. */
    private bakeProceduralEnv;
    /** (Re)upload the env with a FULL MIP CHAIN — CPU-downsampled via canvas
     * (rough reflections sample deep mips; the 1×1 tail is the sky average). */
    private uploadEnv;
    private meshBindFor;
    /** Upload an image as a STANDALONE mesh texture (model loaders — bypasses
     * the shelf atlas). Colour textures upload as sRGB (authored images decode
     * correctly); normal maps stay linear. Sources are kept on the Geo for
     * device-loss re-upload. */
    private uploadTexture;
    /** (Re)create every GPU-side object — the device-loss recovery path. */
    rebuild(device: GPUDevice): void;
    /** Point the mesh + billboard + wisp pipelines at the shared atlas texture. */
    setTexture(view: GPUTextureView): void;
    /**
     * PER-FRAME PREP, encoded before any render pass: camera matrices, mesh/
     * billboard instance packing + uploads (buffer growth must happen before
     * the shadow pass references the buffers), the cluster-light kernel, the
     * GPU-particle sim (against LAST frame's depth + matrices), and the
     * directional shadow-map pass.
     */
    prepare(encoder: GPUCommandEncoder, aspect: number, dt: number, depth: GPUTexture, screenW: number, screenH: number): void;
    /** Render the OPAQUE half (meshes + billboards) into the depth-writing 3D
     * pass — prepare() has already packed and uploaded everything. */
    renderOpaque(pass: GPURenderPassEncoder): void;
    /** Render the TRANSLUCENT half (trails, particles, GPU emitters, wisps)
     * into pass B — depth read-only, so the pass can also SAMPLE that depth
     * (soft particles). Uses the uniforms renderOpaque() wrote this frame. */
    /** Pack a STATIC bucket (once — on creation, kill-rescan or device
     * loss): the full instance array uploads and stays; the GPU culls it
     * every frame after this. */
    private packStatic;
    private staticBinds;
    private pushBlob;
    renderTranslucent(pass: GPURenderPassEncoder): void;
}

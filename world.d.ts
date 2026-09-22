// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { Atlas } from '../atlas.js';
import { type SsaoOptions } from '../ssao.js';
import type { RaysOptions } from '../rays.js';
import { OrbitRig, type OrbitOptions } from '../orbit3d.js';
import { Agents3d, type AgentsOptions } from '../agents3d.js';
import { VoxelEditor, type VoxelEditorOptions } from '../voxeledit3d.js';
import type { VoxelOptions } from '../voxel3d.js';
import type { Physics3d } from '../physics3d.js';
import type { World3dOptions } from '../world3d.js';
import { type VfxDef } from '../vfx.js';
import { Particles3d, type Burst3dOptions, SurfaceSampler } from '../particles3d.js';
import type { GpuEmitter, GpuEmitterOptions } from '../particles-gpu.js';
import { Model3d, type ModelConfig } from '../model3d.js';
import { Light3d, type LightConfig } from '../lights3d.js';
import { Terrain3d, type TerrainOptions } from '../terrain3d.js';
import { Sky3d, type SkyOptions } from '../sky3d.js';
import { VectorShape3d, type VectorShape3dOptions } from '../vector3d.js';
import type { GlRenderer, GlSceneTarget } from '../webgl/renderer.js';
import { Trail3d, type Trail3dOptions } from './trails.js';
import { GlVoxels3d } from './voxels.js';
import { Water3d, type WaterOptions } from '../water3d.js';
import { Underwater3d, type UnderwaterOptions } from '../underwater3d.js';
export declare const MESH_FLOATS = 28;
export declare const BB_FLOATS = 16;
export declare const BLOB_FLOATS = 8;
export declare const FX_FLOATS = 16;
export interface Mesh3dConfig {
    x?: number;
    y?: number;
    z?: number;
    w?: number;
    h?: number;
    d?: number;
    color?: string;
    yaw?: number;
    pitch?: number;
    roll?: number;
    gloss?: number;
    metallic?: number;
    rough?: number;
    alpha?: number;
    texture?: number;
    normalMap?: number;
    tile?: number | {
        x: number;
        y: number;
    };
    parent?: Group3d | Mesh3d | null;
    bump?: number;
    emissive?: number;
    blob?: boolean;
    /** Accepted for parity; on the GL fallback static meshes are CPU-packed
     * and CPU-culled like everything else (no GPU cull path). */
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
    metallic: number;
    rough: number | null;
    texture: number;
    normalMap: number;
    tile: number | {
        x: number;
        y: number;
    };
    bump: number;
    emissive: number;
    grain: number;
    blob: boolean | undefined;
    readonly static: boolean;
    parent: Group3d | Mesh3d | null;
    inputEnabled: boolean;
    dead: boolean;
    constructor(c?: Mesh3dConfig);
    kill(): void;
}
/** @deprecated alias — boxes are just meshes now (World3d parity). */
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
    scale?: number;
    parent?: Group3d | Mesh3d | null;
}
/** A pure transform node (renders nothing) — parent meshes/models to it. */
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
export interface Billboard3dConfig {
    frame: number;
    x?: number;
    y?: number;
    z?: number;
    w?: number;
    h?: number;
    tint?: string;
    flipX?: boolean;
}
/** A retained camera-facing sprite — mutate freely; kill() removes it. */
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
    w?: number;
    d?: number;
    yaw?: number;
    alpha?: number;
    parent?: Group3d | Mesh3d | null;
}
/** A single soft contact-shadow ellipse, decoupled from any mesh. */
export declare class BlobShadow3d {
    x: number;
    y: number;
    z: number;
    w: number;
    d: number;
    yaw: number;
    alpha: number | null;
    parent: Group3d | Mesh3d | null;
    dead: boolean;
    constructor(c?: BlobShadow3dConfig);
    kill(): void;
}
/** A steam/smoke ribbon in the 3D world — world3d.ts's WispConfig. */
export interface WispConfig {
    /** A TILEABLE grayscale noise frame (game.assets.frames(noiseCanvas({ ... }))). */
    frame: number;
    x?: number;
    y?: number;
    z?: number;
    w?: number;
    h?: number;
    color?: string;
    alpha?: number;
    /** Twist strength in radians (~10 = coffee). */
    twist?: number;
    /** Wind sway at the top, world units. */
    wind?: number;
    /** Animation speed multiplier. */
    speed?: number;
    /** smoothstep(lo, hi) density remap of the noise (default [0.4, 1]). */
    remap?: [number, number];
    /** EXTRA yaw on top of the auto-facing (the wisp Y-billboards itself). */
    yaw?: number;
}
/** A retained wisp — world3d.ts's Wisp3d, duplicated (pure CPU handle). */
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
/** Pure blob-shadow parameters — world3d.ts's blobParams, duplicated (its
 * home module is WebGPU-only; same maths, same dist-test coverage there). */
export declare function blobParams(fw: number, fd: number, bottom: number, opts: {
    max: number;
    fade: number;
    alpha: number;
}, force?: boolean): {
    rx: number;
    rz: number;
    alpha: number;
} | null;
export declare class GlWorld3d {
    readonly renderer: GlRenderer;
    readonly atlas: Atlas;
    readonly opts: World3dOptions;
    /** The perspective camera — the same mutable look-at struct as World3d. */
    readonly camera: {
        x: number;
        y: number;
        z: number;
        tx: number;
        ty: number;
        tz: number;
        fov: number;
        lookAt(x: number, y: number, z: number): void;
        lookDir(dx: number, dy: number, dz: number): void;
        face(yaw: number, pitch?: number): void;
    };
    /** Frustum culling at pack time (live-togglable). */
    cull: boolean;
    /** Blob-shadow config (live) — same fields/defaults as World3d.blobs. */
    readonly blobs: {
        enabled: boolean;
        alpha: number;
        max: number;
        fade: number;
        ground: number;
        lift: number;
    };
    /** Rigid-body physics world — assigned by the game, stepped by game.ts. */
    physics: Physics3d | null;
    fog: {
        color: string;
        near: number;
        far: number;
    } | null;
    /** The GL path never multisamples its own pass (the canvas may). */
    readonly sampleCount = 1;
    /** The 3D CPU particle system — world.fx.emit / world.burst. */
    readonly fx: Particles3d;
    /** Live CPU-approximated emitters (see emitter()) — synced each tick. */
    private cpuEmitters;
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
    /** The underwater feature — null until `world.underwater()` (the CPU
     * handle is underwater3d.ts's, reused; game reads submerged/depth). */
    underwater3d: Underwater3d | null;
    /** The steering/flocking movement system — null until `world.agents()`
     * (agents3d.ts is pure CPU and reused verbatim). */
    agents3d: Agents3d | null;
    /** The attached orbit rig, if any (world.orbit()). */
    rig: OrbitRig | null;
    private gl;
    private geos;
    private bills;
    private blobShadowsList;
    private lightsList;
    private animated;
    private terrains;
    private terrainRecs;
    private terrainSeq;
    private skyHandle;
    private skyStateNow;
    private skyData;
    private followCfg;
    private sun;
    private sunColData;
    private time;
    private curVp;
    private curInvVp;
    private meshProg;
    private skinProg;
    private bbProg;
    private blobProg;
    private fxProg;
    private skyProg;
    private frameStamp;
    private atlasTex;
    private whiteTex;
    private flatNormalTex;
    private envTex;
    private envMips;
    private envSource;
    private envDirty;
    private envCustom;
    private envStrength;
    private envSunX;
    private envSunY;
    private envSunZ;
    private bbData;
    private bbCount;
    private bbVao;
    private bbInst;
    private blobData;
    private blobCount;
    private blobVao;
    private blobInst;
    private fxData;
    private vecShapes;
    private lineData;
    private lineVao;
    private lineInst;
    private lineProg;
    private linesLast;
    private ghostParts;
    private fxVao;
    private fxInst;
    private skyVao;
    private trails;
    private trailNoise;
    private trailSeed;
    private trailData;
    private trailTex;
    private trailTexRows;
    private trailVao;
    private trailProgView;
    private trailProgUp;
    private agentGizmos;
    private voxelLayer;
    private wisps;
    private wispData;
    private wispVao;
    private wispInst;
    private wispProg;
    private shadowOpts;
    private shadowTex;
    private shadowFbo;
    private shadowDummy;
    private shadowProg;
    private shadowSkinProg;
    private idMat;
    private flareOn;
    private sunScreenCache;
    private flareProg;
    private probeProg;
    private flareQuery;
    private flareQueryPending;
    private flareOcc;
    private flareOccTarget;
    private fsVao;
    private depthCopyTex;
    private depthCopyFbo;
    private depthCopyW;
    private depthCopyH;
    private ssaoEnabled;
    /** Live-tunable SSAO options (ssao.ts defaults). */
    readonly ssaoOpts: Required<SsaoOptions>;
    private ssaoProg;
    private ssaoBlurProg;
    private ssaoCompProg;
    private ssaoTargets;
    private ssaoW;
    private ssaoH;
    private raysEnabled;
    /** Live-tunable god-ray options (rays.ts defaults). */
    readonly raysOpts: Required<RaysOptions>;
    private raysProg;
    private raysCompProg;
    private raysTarget;
    private raysW;
    private raysH;
    private curProj;
    private curNear;
    private curFar;
    private waters;
    private waterLayer;
    private lastDt;
    private uwLayer;
    /** The game's own fog, saved while submerged (restored on surfacing). */
    private uwSavedFog;
    /** Grass fields (CPU-spawned blade approximation — webgl3d/grass.ts). */
    private grassFields;
    /** Deformable terrains (snow/sand carving — the GL DeformRec list). */
    private deformRecs;
    private deformProg;
    private patchProg;
    private beams;
    private beamProg;
    private beamVao;
    private beamInst;
    private beamData;
    private weatherPools;
    private pickProg;
    private pickFbo;
    private pickTex;
    private pickDepth;
    private pickW;
    private pickH;
    private pickVao;
    private pendingPicks;
    private palettesData;
    private palettesTop;
    private paletteTex;
    private paletteTexRows;
    private lightData;
    private lightCount;
    private drawsLast;
    private warned;
    private unRebuild;
    constructor(renderer: GlRenderer, atlas: Atlas, opts?: World3dOptions);
    private warnOnce;
    /** Add a box (flat-shaded). `segs` grids each face. */
    box(config?: Mesh3dConfig & {
        segs?: number;
    }): Mesh3d;
    /** Add a smooth UV sphere (unit diameter — w/h/d scale it). */
    sphere(config?: Mesh3dConfig & {
        segs?: number;
        rings?: number;
    }): Mesh3d;
    /** Add a capped cylinder — or a frustum via rTop/rBottom. */
    cylinder(config?: Mesh3dConfig & {
        segs?: number;
        rTop?: number;
        rBottom?: number;
        open?: boolean;
        arc?: number;
    }): Mesh3d;
    /** Add a smooth torus (outer diameter 1, XZ plane). */
    torus(config?: Mesh3dConfig & {
        tube?: number;
        segs?: number;
        sides?: number;
        arc?: number;
    }): Mesh3d;
    /** Add a torus knot — a (p, q) winding closed tube. */
    torusKnot(config?: Mesh3dConfig & {
        p?: number;
        q?: number;
        segs?: number;
        sides?: number;
        tube?: number;
    }): Mesh3d;
    /** Add a chamfered box — bevelled edges/corners. */
    roundedBox(config?: Mesh3dConfig & {
        r?: number;
        segs?: number;
    }): Mesh3d;
    /** Add a capped cone (apex up). */
    cone(config?: Mesh3dConfig & {
        segs?: number;
        open?: boolean;
        arc?: number;
    }): Mesh3d;
    /** Add a capsule/pill (total height 1; r = cap radius). */
    capsule(config?: Mesh3dConfig & {
        segs?: number;
        rings?: number;
        r?: number;
    }): Mesh3d;
    /** Add a wedge ramp — a unit box halved diagonally. */
    wedge(config?: Mesh3dConfig): Mesh3d;
    /** Add a flat double-sided quad in the XZ plane. */
    plane(config?: Mesh3dConfig & {
        segs?: number;
    }): Mesh3d;
    /** Add a flat disc or pie slice (arc 0..1), double-sided, XZ plane. */
    circle(config?: Mesh3dConfig & {
        segs?: number;
        arc?: number;
    }): Mesh3d;
    /** Add a flat ring/annulus, double-sided, XZ plane. */
    ring(config?: Mesh3dConfig & {
        inner?: number;
        segs?: number;
        arc?: number;
    }): Mesh3d;
    /** Add a panel — an extruded rounded-corner rectangle. */
    panel(config?: Mesh3dConfig & {
        r?: number;
        segs?: number;
    }): Mesh3d;
    /** Add a disc — a filleted cylinder: coin / chip / puck / wheel. */
    disc(config?: Mesh3dConfig & {
        fillet?: number;
        segs?: number;
        filletSegs?: number;
    }): Mesh3d;
    /** Add a tetrahedron. `detail` subdivides toward a sphere. */
    tetrahedron(config?: Mesh3dConfig & {
        detail?: number;
    }): Mesh3d;
    /** Add an octahedron. */
    octahedron(config?: Mesh3dConfig & {
        detail?: number;
    }): Mesh3d;
    /** Add a dodecahedron. */
    dodecahedron(config?: Mesh3dConfig & {
        detail?: number;
    }): Mesh3d;
    /** Add an icosahedron — the best faceted "geo-sphere". */
    icosahedron(config?: Mesh3dConfig & {
        detail?: number;
    }): Mesh3d;
    /** Add a lathe — a [d, y] profile revolved around Y. */
    lathe(config: Mesh3dConfig & {
        points: Array<[number, number]>;
        segs?: number;
        arc?: number;
    }): Mesh3d;
    /** Add a tube swept along a 3D polyline. */
    tube(config: Mesh3dConfig & {
        path: number[][];
        r?: number;
        sides?: number;
        closed?: boolean;
    }): Mesh3d;
    /** Add a flat filled shape from a simple [x, z] outline. */
    shape(config: Mesh3dConfig & {
        outline: Array<[number, number]>;
    }): Mesh3d;
    /** Add an extrusion of a simple [x, z] outline through unit height. */
    extrude(config: Mesh3dConfig & {
        outline: Array<[number, number]>;
        bevel?: number;
        bevelSegs?: number;
    }): Mesh3d;
    /** Add a mesh with CUSTOM geometry — same name = same instanced draw. */
    custom(name: string, verts: () => Float32Array<ArrayBuffer>, config?: Mesh3dConfig): Mesh3d;
    private mesh;
    private makeGeo;
    private modelMesh;
    /** Allocate a palette slice from the global pool (mat4-unit base). */
    private paletteAlloc;
    /** A VS-skinned bucket: interleaved 44-byte verts shared by every instance
     * (the twin of world3d.skinnedMesh — palettes ride an RGBA32F texture). */
    private skinnedMesh;
    /** Load a Wavefront OBJ (+ MTL + diffuse textures) — the twin of
     * World3d.loadObj, over the shared device-free cache. */
    loadObj(url: string, config?: ModelConfig): Promise<Model3d>;
    /** Load a GLB — static, node-animated and VS-skinned primitives, the twin
     * of World3d.loadGlb (AnimatedModel3d's CPU mixer is reused unchanged). */
    loadGlb(url: string, config?: ModelConfig): Promise<Model3d>;
    terrain(opts?: TerrainOptions): Terrain3d;
    /** (Re)create one deform rec's GL objects (carve tex, base heights, patch
     * VBO) — creation + context-restore path. */
    private ensureDeformGpu;
    /** Per-frame deform sync — world3d.prepare's deformRecs block, GL-side:
     * dirty-region R32F upload + the du/pu uniform packs. */
    private syncDeforms;
    /** Draw the high-poly snow-layer patches — after the base terrain in the
     * opaque pass (they overdraw the near field; the base discards the disc). */
    private drawDeformPatches;
    /** Add a camera-facing sprite, anchored at its BASE point. */
    billboard(config: Billboard3dConfig): Billboard3d;
    /** Add ONE soft contact-shadow ellipse (see BlobShadow3d). */
    blobShadow(config?: BlobShadow3dConfig): BlobShadow3d;
    /** Create a transform-node GROUP (renders nothing). */
    group(config?: Group3dConfig): Group3d;
    /** Aim any posed handle's local +Z at a world point. */
    lookAt(handle: {
        x: number;
        y: number;
        z: number;
        yaw: number;
        pitch: number;
    }, x: number, y: number, z: number): void;
    /**
     * Add a dynamic POINT or SPOT light. The fallback shades up to 8 lights as
     * uniform arrays (no clustering) — the nearest-to-camera 8 win each frame
     * when over budget. Handles are live; kill() releases.
     */
    light(config?: LightConfig & {
        beam?: boolean | {
            length?: number;
            intensity?: number;
            color?: string;
        };
    }): Light3d;
    /** The Lights3d-manager facade — game code reads `world.lights3d.count` (and
     * can add through it) on the WebGPU backend; this mirrors the surface over
     * the fallback's flat light list. `activeCount` = the ≤8 actually shaded. */
    readonly lights3d: {
        /** Live registered lights (Lights3d.count parity — dead ones drop). */
        readonly count: number;
        /** The ≤8 actually shaded this frame (the fallback's activation cap). */
        readonly activeCount: number;
        light: (config?: LightConfig) => Light3d;
    };
    /** Re-aim the directional SUN (the direction light travels) + ambient. */
    setSun(x: number, y: number, z: number, ambient?: number): void;
    /** Hemisphere ambient: intensity + sky/ground tints. */
    setAmbient(intensity: number, sky?: string, ground?: string): void;
    /** THE SKY — the full procedural dome (sky3d's day/night state machine +
     * the ported fragment shader: gradient, sun, clouds, stars, moon). */
    sky(opts?: SkyOptions): Sky3d;
    /** Attach the ORBIT RIG (orbit3d.ts reused verbatim — it only consumes
     * world.camera). */
    orbit(opts?: OrbitOptions): OrbitRig;
    /** FOLLOW camera — eases to target + offset, aims at target + look
     * (duplicated from World3d.follow, same defaults). */
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
    /** Trigger a one-shot VfxDef.burst recipe at a point. */
    burst(vfx: string | VfxDef, x: number, y: number, z: number, opts?: Burst3dOptions): void;
    /** A SurfaceSampler over a mesh's unit geometry (mesh-surface emitter). */
    surface(mesh: Mesh3d): SurfaceSampler;
    /** A world-space PICKING RAY under a pointer event. */
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
    /**
     * PICK the mesh under the pointer — PIXEL-EXACT on the GPU (the PICK_WGSL
     * id-buffer port; see pickGpu): render eligible instance ids depth-tested
     * into a cursor-scissored target and read the texel back async (~1–2
     * frames, the WebGPU latency). Falls back to the CPU obb test below only
     * when the pick program failed to compile. Same opt-in semantics:
     * only `inputEnabled` meshes resolve; with `occlude` (default true) other
     * geometry still BLOCKS clicks by its obb (terrain chunks excepted — a
     * chunk's box would swallow every click above a valley). Skinned/animated
     * parts, terrain, grass and billboards are not pickable, as on WebGPU.
     * Resolves the same `{ mesh, id } | null` shape (id is a stable per-mesh
     * ordinal here, not a pack index).
     */
    pick(e: {
        clientX: number;
        clientY: number;
    }, opts?: {
        occlude?: boolean;
    }): Promise<{
        mesh: Mesh3d;
        id: number;
    } | null>;
    /** PROJECT a world point to CANVAS pixels (CSS units, origin top-left). */
    project(x: number, y: number, z: number): {
        x: number;
        y: number;
        depth: number;
        visible: boolean;
    } | null;
    /** The GPU id-buffer pick — PICK_WGSL's architecture on GL: render every
     * eligible instance's id (base + gl_InstanceID, +1 so 0 = the clear
     * sentinel) RGBA8-encoded into a cursor-scissored canvas-sized target,
     * depth-tested, then read the one texel back ASYNC (PIXEL_PACK buffer +
     * fenceSync, polled in tick — the WebGPU mapAsync latency, ~1–2 frames).
     * Coverage parity: dynamic + static + loaded non-skinned models, opaque +
     * translucent; non-pickable geometry depth-blocks under `occlude` and
     * discards otherwise. Maps are SNAPSHOT before the async wait (the pack
     * arrays rewrite every frame). */
    private pickGpu;
    /** Poll the pick fences (called from tick — the async half). */
    private pollPicks;
    /** (Re)create the canvas-sized pick target (RGBA8 + depth renderbuffer). */
    private ensurePickTarget;
    /** Per-frame step: orbit/follow rigs, the sky clock (which drives the sun/
     * ambient/fog when attached), animated models, terrain carvers, particles. */
    tick(dt: number): void;
    /** Steering GIZMOS (World3d.updateAgentGizmos, verbatim): while
     * `world.agents().debug` is on, draw each agent's velocity (green), net
     * steering force (orange), avoid feeler (cyan), live A* path (violet) and
     * every field's radius ring (magenta) as world-space lines, refilled each
     * frame. Off → the lines are emptied (nothing drawn). */
    private updateAgentGizmos;
    /** Live handle counts + draw-call count — the World3d.counts shape (the
     * WebGPU-only layers report zero). */
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
    render(width: number, height: number, scene?: GlSceneTarget | null): void;
    /** useProgram + upload the per-frame uniforms once per program per frame. */
    private useProg;
    /** Bind a texture to a unit, defaulting the shared atlas's filter back to
     * LINEAR (the 2D batches flip it per flush on the same texture object). */
    private bindTex;
    private drawMeshBucket;
    private drawBillboards;
    private drawBlobs;
    private drawFx;
    /** Pack + draw the 3D vector lines — Vector3dLayer.prepare()+draw(), GL-side.
     * One instanced draw; screen-pixel width; premultiplied over, depth-tested
     * read-only (the translucent-pass recipe). */
    private drawLines;
    /** Pack + draw the spotlight beams — Beam3dLayer.update()+draw(), GL-side:
     * one instance per live beam, following its light's pose/dir/cone/colour;
     * additive, depth-tested read-only, cull off; the soft depth fade rides
     * the depth copy (no-ops gracefully when the scene isn't offscreen). */
    private drawBeams;
    /** Pack + draw the 3D trails — renderTranslucent's trail block, GL-side.
     * Instance data rides an RGBA32F texture (29 texels per trail row) because
     * 116 floats can't fit instance attributes; view-facing ribbons draw first
     * (cull ON — folds on tight curves double additive brightness, world3d's
     * "stack of quads" lesson), then the 'up' walls (cull OFF, double-sided)
     * via a uRowBase uniform standing in for GL's missing firstInstance. */
    private drawTrails;
    /** Pack + draw the wisps — World3d.renderTranslucent's wisp block, GL-side
     * (5 vec4 instance attributes, SEGX×SEGY×6 verts per instance, no cull,
     * premultiplied over, depth read-only — pass B has that state set). */
    private drawWisps;
    /** The depth-only SHADOW pass — every packed bucket (dynamic + static +
     * terrain + skinned) into the sun's ortho map, cull OFF (world3d's donut
     * lesson: both faces render, nearest wins). Instance data is uploaded here
     * and re-used by the main pass. */
    private drawShadowPass;
    /** (Re)create the shadow-map depth texture + FBO at the current res. */
    private ensureShadowTarget;
    /** Poll + issue the sun-occlusion query: a ~14px far-depth quad at the
     * sun's ndc position, colour writes off, inside ANY_SAMPLES_PASSED. The
     * async result (1–2 frames stale, like the WebGPU readbacks) eases
     * flareOcc toward 0/1 — binary vs the original's 9-tap fraction, smoothed
     * so the collapse still reads gradual. */
    private probeSunOcclusion;
    /** Draw the flare ghost chain — additive (ONE, ONE / alpha ZERO, ONE),
     * depth ignored, at the very end of pass B (flares live ON the lens). */
    private drawFlare;
    /** Blit the scene FBO's depth into the scratch copy (the seam's rule: an
     * FBO's own depth attachment cannot be sampled while that FBO is bound). */
    private blitDepthCopy;
    /** One half-res colour target (fbo + tex) for the effect chains. */
    private makeHalfTarget;
    /** SSAO — ssao.ts's render()+composite(), GL-side: half-res Alchemy AO
     * from the depth copy, bilateral H+V blur, multiply into the scene FBO. */
    private runSsao;
    /** GOD RAYS — rays.ts's render()+composite(), GL-side: a half-res radial
     * march over the depth copy toward the sun, added into the scene FBO. */
    private runRays;
    /** Hidden-line ghosts — the mesh program with COLOUR WRITES OFF: the
     * model's surface fills depth invisibly so edges behind it vanish
     * (world3d.ts's ghost pipeline, one single-instance draw per part). */
    private drawGhosts;
    /** Write + draw the sky — Sky3dLayer.write()'s packing logic verbatim,
     * uploaded as 12 vec4 uniforms (see buildGlSkyFragGLSL for the layout). */
    private drawSky;
    private pushBlob;
    /** Point the mesh/billboard/fx draws at the shared atlas texture. */
    setTexture(view: unknown): void;
    /** Upload a standalone image (model textures, terrain colormaps). Colour
     * sources upload as sRGB (the GL twin of uploadTexture's rgba8unorm-srgb);
     * normal/mr maps stay linear. Single level, LINEAR, clamped — matching the
     * WebGPU sampler (mips would sharpen minification but change the look). */
    private uploadTex;
    /** 1×1 solid-colour texture (the white + flat-normal stand-ins). */
    private soloTex;
    /** (Re)upload the joint-palette pool into its RGBA32F texture — 4 texels
     * per mat4, one mat4 per row (texelFetch by paletteBase + joint). */
    private uploadPalettes;
    private makeProg;
    /** (Re)create every GL-side object — the context-restore recovery path.
     * CPU state (handles, packed arrays, texture sources) is the truth. */
    rebuild(gl: WebGL2RenderingContext): void;
    destroy(): void;
    /** Wrap a stub handle so ANY method the WebGPU surface has but the literal
     *  doesn't becomes a safe no-op — game code written against the full API
     *  must never crash on the fallback (`agents.clear()` was the first bite). */
    private inertHandle;
    /**
     * WATER — real on the fallback: grid seas/lakes/pools (analytic Gerstner
     * in the VS with the exact CPU heightAt replica — the Water3d handle is
     * water3d.ts's, reused) and ribbon streams/waterfalls, with shore blend,
     * env fresnel, sun glint, foam, wells/wakes, swell/tide/tint dials. The
     * scene routes offscreen while any water lives (depth-copy shore reads).
     */
    water(opts?: WaterOptions): Water3d;
    /**
     * UNDERWATER — real on the fallback: submersion hysteresis + fog retarget
     * (CPU handle reused), the Beer–Lambert multiply + in-scatter composite,
     * the ABZU billboard shaft ring, and seabed caustic dapple in the mesh
     * shader — all over the scene depth copy (the seam). One per world.
     */
    underwater(opts?: UnderwaterOptions): Underwater3d;
    /**
     * VOXELS — the Minecraft-style block world, REAL on the fallback: the CPU
     * feature (grid, mesher + baked AO, DDA raycast, terrain gen, controllers)
     * is voxel3d.ts reused verbatim; the GL plumbing is webgl3d/voxels.ts
     * (2D-array tile pack + per-chunk VBOs drawn in the opaque pass). Lit and
     * fogged by THIS world's sun/sky. One per world.
     */
    voxels(opts?: VoxelOptions): GlVoxels3d;
    /** BLOCK EDITOR — voxeledit3d.ts reused verbatim (pure CPU: raycast,
     * outline + ghost via this world's lines()/box(), cadence, hardness). */
    voxelEditor(vox: GlVoxels3d, opts?: VoxelEditorOptions): VoxelEditor;
    /**
     * AGENTS — the steering/flocking movement system (agents3d.ts, pure CPU,
     * reused verbatim — lazy, one per world). Agents write their pose onto
     * retained render handles; debug gizmos draw through the vector-line layer.
     */
    agents(opts?: AgentsOptions): Agents3d;
    /** GPU-compute emitters run as a CAPPED CPU APPROXIMATION here: the shared
     * option vocabulary (cone/shell/box/ring spawn, life/size/ramp/fade/twinkle/
     * spin, accel+drag forces) maps onto an fx stream; the compute-only tier
     * (curl/vortex/attract/orbit forces, depth collision, wrap weather, velocity
     * stretch, flutter/tumble, 65k pools) is dropped and rates/bursts are capped
     * to a CPU budget — a campfire still burns, a blizzard becomes a flurry. */
    emitter(opts?: GpuEmitterOptions): GpuEmitter;
    /** Build one weather pool (see emitter()): ~4k drops spawned uniformly in
     * the wrap box around the LIVE emitter origin, integrated with the accel
     * force and torus-wrapped per axis (fallers re-enter at the top — the
     * depth-collision respawn approximation, no depth reads). */
    private makeWeatherEmitter;
    /** (Re)seed one drop uniformly in the wrap box around the live origin. */
    private weatherSpawn;
    /**
     * Add a WISP — steam/smoke as a true-3D twisting ribbon (WISP_WGSL ported;
     * Bruno Simon's coffee-smoke technique). Pass a TILEABLE grayscale noise
     * frame. Anchored at its BASE (stands on x/y/z). All fields live.
     */
    wisp(config: WispConfig): Wisp3d;
    /**
     * Add a TRAIL — a VfxDef ribbon in TRUE 3D (World3d.trail, GL-side): a
     * Catmull-Rom-smoothed, view-facing ribbon with noise flutter, a white-hot
     * core and a tail that erodes into wisps. Feed `point(x, y, z)` per frame
     * or pass `follow`; `release()` fades it out. Width defaults to the
     * followed handle's own size, else a tenth of the def's 2D width.
     */
    trail(vfx: string | VfxDef, opts?: Trail3dOptions): Trail3d;
    /** Retained 3D line shapes — World3d.lines, over the shared VectorShape3d. */
    lines(polylines: Array<Array<[number, number, number]>>, opts?: VectorShape3dOptions): VectorShape3d;
    /** Wireframe edge extraction — the shared pure extractor (vector3d.ts). */
    wireframeEdges(verts: Float32Array, angle?: number): Array<[number, number, number, number, number, number]>;
    /** Wireframe model loading — World3d.loadWireframe over the shared
     * model-data cache (verts arrive unit-fitted), incl. the sparse-crease
     * fallback and hidden-line ghosts. */
    loadWireframe(url: string, opts?: VectorShape3dOptions & {
        angle?: number;
        hiddenLine?: boolean;
    }): Promise<VectorShape3d>;
    /**
     * Directional SHADOWS for the world's sun — real on the fallback: a
     * depth-only ortho pass into a compare-mode depth texture (`size` =
     * half-extent around the camera target; the map follows it), PCF-sampled
     * in the mesh fragment. Turning it on swaps the blob ellipses for the
     * real map (world3d's exclusivity); `shadows(false)` restores them.
     */
    shadows(on?: boolean | {
        size?: number;
        res?: number;
        bias?: number;
    }): void;
    /**
     * LENS FLARE on the sun — the procedural ghost chain (flare3d.ts ported),
     * occluded by an async occlusion-query probe instead of the WebGPU depth
     * taps. ON automatically when a sky is attached (`sky({ flare: false })`
     * opts out); call this to force it either way.
     */
    flare(on?: boolean): void;
    /** Enable/disable SSAO (world.ssao forwards here). Requires the offscreen
     * scene route — needsDepthTexture flips the renderer's seam on. */
    setSsao(on: boolean | SsaoOptions): void;
    /** Enable/disable god rays (world.rays forwards here). */
    setRays(on: boolean | RaysOptions): void;
    /** True while a depth-consuming feature is live — the renderer then routes
     * the whole scene through the offscreen FBO (webgl/renderer.ts seam).
     * TODO(renderer): renderFrame currently only lands the offscreen frame on
     * the canvas via the post chain — the offscreen-without-post path needs an
     * `else if (offscreen) this.postChain.blitToCanvas()` after the post
     * branch, or SSAO/rays frames never reach the canvas. */
    get needsDepthTexture(): boolean;
    /** Env/IBL reflections are WebGPU-only on the fallback. */
    /** Environment reflections — the world3d.ts verb: `false` off, a strength
     * retune, a panorama url, or a canvas. The procedural sky is the default. */
    env(src?: string | HTMLCanvasElement | false | {
        strength?: number;
    }): Promise<void>;
    /** Bake the procedural equirect sky — world3d.ts's bakeProceduralEnv verbatim. */
    private bakeProceduralEnv;
    /** (Re)upload the env with a FULL CPU-downsampled mip chain (world3d.ts's
     * uploadEnv recipe — rough reflections sample deep mips; the tail is the
     * sky average). SRGB storage matches the WebGPU rgba8unorm-srgb. */
    private uploadEnv;
    /** The sun's screen position + faded intensity this frame (null when
     * behind the camera or fully faded) — World3d.sunScreen. */
    get sunScreen(): {
        x: number;
        y: number;
        intensity: number;
        color: [number, number, number];
    } | null;
}

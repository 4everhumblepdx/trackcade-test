// Docs: engine/webgpu/sky-water3d.md — usage, recipes & traps (this file = exact type signatures)
export interface WaveDef {
    dir: {
        x: number;
        z: number;
    };
    /** Amplitude in world units (crest = level + amp). */
    amp: number;
    /** Wavelength in world units. */
    len: number;
    /** Phase speed in world units / second. */
    speed: number;
    /** 0 = pure sine, 1 = sharp trochoidal crests. */
    steep: number;
}
/** Height offset of summed Gerstner waves at (x, z, t) — the CPU replica of
 * the vertex shader (sampled at the undisplaced position; the horizontal
 * swirl is < steep·amp and irrelevant for floating gameplay). */
export declare function gerstnerY(waves: WaveDef[], x: number, z: number, t: number): number;
/** The HORIZONTAL Gerstner displacement at a material point — the GPU VS
 * moves each grid vertex sideways by q·amp·cos (crests gather, troughs
 * spread; `q = steep/(k·amp·6)`, so amp cancels). heightAt inverts this so
 * boats sit on the surface that is VISIBLY at (x, z), not on the height of
 * water that has advected somewhere else — at high swell the difference is
 * a hull's worth of air (Rich's flying boat). Mirrors the VS exactly except
 * the camera-distance fade (gameplay queries are near the camera, fade = 1). */
export declare function gerstnerXZ(waves: WaveDef[], x: number, z: number, t: number, ampScale: number, steepScale: number, shoal: number): [number, number];
/** GERSTNER SELF-INTERSECTION GUARD. When the SUMMED crest steepness climbs
 * too high, the horizontal advection makes crest vertices cross past each
 * other and the surface folds — inverted, flat, jagged shards riding the
 * crests (Rich's teeth: onset at sea-preset swell ≈ 0.68 where Σ ≈ 3.8,
 * severe by 0.9 — later traced to water-over-water compositing, fixed by
 * the painter's-order grid; this guard stays for TRUE self-intersection).
 * Both the GPU packing and the CPU replica scale every wave's steepness by
 * this factor, so crests SATURATE instead of folding. Folding needs the sum
 * ≈ 6; 4.8 guards pathological custom wave tables while never touching the
 * shipped presets (the sea maxes at ≈ 4.5 at swell 1). */
export declare function steepNorm(waves: WaveDef[], steepScale: number): number;
export interface WaterPreset {
    waves: WaveDef[];
    shallow: string;
    deep: string;
    foam: string;
    alpha: number;
    ripple: number;
    absorb: number;
    foamWidth: number;
}
export declare const WATER_PRESETS: Record<string, WaterPreset>;
export interface WaterTint {
    shallow: string;
    deep: string;
    absorb: number;
    alpha: number;
}
export declare const WATER_TINTS: Record<string, WaterTint>;
/**
 * A water STRIP along a path: verts are pos(3) + uv(2: u = arc distance,
 * v = 0..1 across) + slope(1: 0 flat → 1 vertical, from the path tangent).
 * The right vector is horizontal (cross(tangent, up)) so the strip lies
 * FLAT on the land; on near-vertical drops it falls back to the path
 * frame's binormal so a waterfall face keeps its width.
 */
export declare function ribbonVerts(pts: Array<[number, number, number]>, width: number, step?: number): Float32Array<ArrayBuffer>;
/** Noise units per texture tile (lattice sizes wrap at TILE·2^octave). */
export declare const RIPPLE_TILE = 16;
/** The tileable fbm the texture bakes — periodic in both axes with period
 * RIPPLE_TILE (pure + deterministic; pinned by the dist tests). */
export declare function rippleFbm(px: number, py: number): number;
/** Bake the ripple field: size×size rgba8 texels over one tile, row-major.
 * RG = gradient (see the header note), B = field value, A = 255. */
export declare function bakeRippleField(size?: number): Uint8Array;
export interface WaterWellOptions {
    x?: number;
    z?: number;
    /** Yaw of the dry box (radians — match the hull's). */
    yaw?: number;
    /** Full extents of the dry box in world units (the hull footprint + margin). */
    w?: number;
    d?: number;
    /** Absolute Y the surface is pressed down to inside the box — set it just
     * below the hull's bottom. */
    floor?: number;
    /** Feather band outside the box before the surface returns (default 1.5). */
    feather?: number;
    /** Foam WAKE strength 0..1 trailing behind the box (0 = none, default 0.7):
     * a fading white streak in the water plane — the cheap boat wake. */
    wake?: number;
}
/** A DRY BOX on a grid water — "oi water, stay down": inside the (oriented)
 * box the surface is pressed to `floor`, so waves never rise through a
 * watertight hull; the dip around it reads as displacement. All fields are
 * live — reposition it every frame as the boat moves. Max 4 per water.
 * `heightAt` ignores wells (hulls ride the undisturbed wave). */
export declare class WaterWell {
    x: number;
    z: number;
    yaw: number;
    w: number;
    d: number;
    floor: number;
    feather: number;
    wake: number;
    dead: boolean;
    constructor(o?: WaterWellOptions);
    kill(): void;
}
export interface WaterOptions {
    /** 'sea' (default) | 'ocean' | 'lake' | 'pool' | 'stream'. A `path` makes
     * it a ribbon regardless. */
    preset?: keyof typeof WATER_PRESETS | string;
    /** Water surface height (grid waters; ribbons carry height in the path). */
    level?: number;
    x?: number;
    z?: number;
    /** Grid extent in world units (default 2400 × 2400). */
    w?: number;
    d?: number;
    /** Grid resolution per side (default 160 → ~51k tris shared by all). */
    waves?: WaveDef[];
    shallow?: string;
    deep?: string;
    foam?: string;
    alpha?: number;
    /** Detail ripple-normal strength 0..1. */
    ripple?: number;
    /** Thickness→deep-colour rate (higher = shallower water reads deep). */
    absorb?: number;
    /** Shore foam band width in world units. */
    foamWidth?: number;
    /** RIBBON: the stream's course (world points, downhill). */
    path?: Array<[number, number, number]>;
    /** RIBBON width in world units (default 3). */
    width?: number;
    /** RIBBON flow speed in world units / second (default 4). */
    flow?: number;
    /** SEA STATE dial 0..1 (default 0.5 = the preset as authored): scales
     * wave heights and crest sharpness together — 0 is glass, 1 is
     * ferocious (double height, whitecaps everywhere). Live. */
    swell?: number;
    /** TIDE: peak-to-peak waterline breathing in world units (default 0).
     * The level slides sinusoidally over `tidePeriod` — on a shallow beach
     * even 1–2 units reads as the sea drawing back and running in. */
    tide?: number;
    /** Seconds for a full tide cycle (default 45). */
    tidePeriod?: number;
    /** SEA COLOUR preset: 'caribbean' | 'azure' | 'temperate' | 'emerald' |
     * 'northsea' — swaps the palette AND the optical depth together (see
     * WATER_TINTS). Applied over the preset; live via water.setTint(). */
    tint?: keyof typeof WATER_TINTS | string;
    /** GROUND function — pass `terrain.heightAt` when the water meets land!
     * It is baked to a height texture once, giving the wave shader EXACT,
     * camera-independent water depth: waves shoal against the real beach,
     * the sheet parks below dry sand (no z-fighting, no view-dependent
     * popping), and the waterline is stable however the camera moves.
     * Without it, depth is estimated from the frame's depth buffer (fine
     * for open water, unstable in a shallow swash zone). */
    ground?: (x: number, z: number) => number;
}
/** Returned by world.water() — fields are live where noted. */
export declare class Water3d {
    readonly kind: 'grid' | 'ribbon';
    readonly preset: WaterPreset;
    level: number;
    x: number;
    z: number;
    readonly w: number;
    readonly d: number;
    waves: WaveDef[];
    shallow: string;
    deep: string;
    foam: string;
    alpha: number;
    ripple: number;
    absorb: number;
    foamWidth: number;
    flow: number;
    swell: number;
    tide: number;
    tidePeriod: number;
    readonly width: number;
    readonly path?: Array<[number, number, number]>;
    /** Ground height fn (baked once — see WaterOptions.ground). */
    readonly ground?: (x: number, z: number) => number;
    dead: boolean;
    /** Debug views (live): 0 off · 1 shoal factor (red = damped, green = full)
     * · 2 flat after the underside branch · 3 base optical colour · 4 after
     * env/glint lighting · 5 after foam. Staged returns isolate which stage
     * paints an artifact. */
    debug: number;
    /** Active dry boxes (see WaterWell) — packed each frame, max 4. */
    wells: WaterWell[];
    /** Add a DRY BOX (boat hull) to this water: inside it the surface is
     * pressed below the hull so waves never rise through the deck. Returns the
     * live handle — move it with the boat every frame. */
    well(opts?: WaterWellOptions): WaterWell;
    constructor(o?: WaterOptions);
    /** Swap the sea colour live: 'caribbean' | 'azure' | 'temperate' |
     * 'emerald' | 'northsea' (palette + optical depth together). */
    setTint(name: keyof typeof WATER_TINTS | string): void;
    /** Surface height at (x, z) RIGHT NOW — the exact wave the GPU draws:
     * swell, tide AND (when `ground` is set) the same SHOALING damp the
     * shader applies, so a hull sampled here never clips the rendered
     * surface anywhere, beach shallows included. Boats: sample it at bow/
     * stern/port/starboard for height + pitch + roll. Ribbons return the
     * still level (streams are shallow decoration, not swim volumes). */
    heightAt(x: number, z: number): number;
    kill(): void;
}
/** GPU plumbing for every water in the world — owned by World3d, drawn at
 * the head of the translucent pass (after blob shadows, under particles). */
export declare class Water3dLayer {
    private format;
    private sampleCount;
    private lightsLayout;
    private device;
    private gridPipeline;
    private ribbonPipeline;
    private layout;
    private gridVbuf;
    private gridVerts;
    private gridVbufCoarse;
    private gridVertsCoarse;
    private gpu;
    private depthView;
    private envView;
    private dummyGround;
    private rippleView;
    private rippleSamp;
    private foamTex;
    private foamView;
    private foamTmp;
    private foamTmpView;
    private foamSamp;
    private foamDecayPipe;
    private foamStampPipe;
    private foamUBO;
    private foamBind;
    private foamData;
    private foamOrigin;
    private wellPrev;
    private data;
    constructor(device: GPUDevice, format: GPUTextureFormat, sampleCount: number, lightsLayout: GPUBindGroupLayout);
    rebuild(device: GPUDevice): void;
    /** Per-frame: sync every water's uniforms; (re)build binds when the depth
     * or env texture changed (resize / env re-bake). */
    update(waters: Water3d[], uniforms: GPUBuffer, sampler: GPUSampler, envView: GPUTextureView, depthView: GPUTextureView, projA: number, projB: number, screenW: number, screenH: number, time: number, encoder?: GPUCommandEncoder, eyeX?: number, eyeZ?: number, dt?: number): void;
    draw(pass: GPURenderPassEncoder, lightsBind: GPUBindGroup): void;
    get count(): number;
}

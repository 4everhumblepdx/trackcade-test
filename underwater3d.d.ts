// Docs: engine/webgpu/underwater.md — usage, recipes & traps (this file = exact type signatures)
import type { Mat4 } from './math3d.js';
import type { Water3d } from './water3d.js';
export type UnderwaterPresetName = 'reef' | 'ocean' | 'pool' | 'murk';
export interface CausticOptions {
    /** Overall brightness (default from preset). */
    strength?: number;
    /** World units per caustic tile (default 6). */
    scale?: number;
    /** Animation speed multiplier (default 1). */
    speed?: number;
    /** Chromatic split in uv (default 0.0035, 0 = off). */
    rgbSplit?: number;
    /** Receiver depth at which caustics fade to zero (default 20). */
    maxDepth?: number;
}
export interface UnderwaterOptions {
    /** Which water body drives submersion; default = the first grid water. */
    water?: Water3d;
    /** 'auto' (default) = the camera-depth test; true/false forces it. */
    enable?: 'auto' | boolean;
    /** The body must be at least this deep to EVER activate (puddle guard). */
    minDepth?: number;
    /** Named starting point — fills everything below (default 'reef'). */
    preset?: UnderwaterPresetName;
    /** View extinction σ (murk closing in), e.g. reef [0.35, 0.07, 0.03]. */
    sigma?: [number, number, number];
    /** Downwelling σ (sun-fade with depth) — a decoupled dial. */
    sunSigma?: [number, number, number];
    /** In-scatter murk colour (engine hex). */
    waterColor?: string;
    /** 0..1 master clarity — scales σ (1 = as authored, 0 = crystal). */
    clarity?: number;
    /** Artistic far clamp for the fog retarget (world units). */
    maxView?: number;
    caustics?: boolean | CausticOptions;
    snell?: boolean;
    /** `intensity` scales brightness; `quantity` 0..1 sets how much of the
     * surface web sheds visible columns (0 = only the hottest cells). */
    rays?: boolean | {
        intensity?: number;
        quantity?: number;
    };
    /** Soft wide vignette 0..1 (default 0.25). */
    vignette?: number;
    /** Depth-grade / murk strength 0..1 (default 0.6). */
    grade?: number;
    /** Screen wobble in uv — clamped ≤ 0.003; default 0 (off). */
    wobble?: number;
}
export interface UnderwaterPreset {
    sigma: [number, number, number];
    sunSigma: [number, number, number];
    waterColor: string;
    maxView: number;
    caustics: Required<CausticOptions>;
    snell: boolean;
    vignette: number;
    grade: number;
}
/** Start values — Rich retunes by eye. BRIGHT-BY-DEFAULT: the original
 * triplets came from physical Jerlov tables (red dead in ~5 m) and read as
 * instant murk in a GAME — the references (stylised reef shots) have almost
 * no view extinction at all. `murk` keeps the heavy physical feel. */
export declare const UNDERWATER_PRESETS: Record<UnderwaterPresetName, UnderwaterPreset>;
/** The submersion decision. Hysteresis: the camera must cross `hysteresis`
 * BEYOND the surface line to flip state, so a hull bobbing exactly at the
 * waterline never strobes the whole effect on and off. `depth` is how far the
 * camera sits below the surface (0 when above). */
export declare function submersionState(prev: boolean, camY: number, surfY: number, hysteresis: number): {
    submerged: boolean;
    depth: number;
};
/** Per-channel Beer–Lambert transmittance exp(-σ·dist) — the CPU replica of
 * the shader's extinction law (used for the fog-colour darkening). */
export declare function absorb(sigma: readonly [number, number, number], dist: number): [number, number, number];
/** The GENTLE base tint every existing 3D shader gets for free: the water
 * colour, darkened with depth by the downwelling law and desaturated toward
 * grey-green by storm, over a fog band that closes in with σ and storm. The
 * composite owns the per-channel extinction; this only has to make the murk,
 * translucents, beams and particles agree with the underwater look. */
export declare function underwaterFog(opts: {
    waterColor: string;
    sunSigma: [number, number, number];
    sigma: [number, number, number];
    maxView: number;
}, depth: number, storm: number): {
    color: string;
    near: number;
    far: number;
};
/** One Hoskins caustic field, size×size texels over one tile, row-major.
 * Values are the raw pattern (mostly 0..1 with sparkle peaks above 1). Pure +
 * deterministic for the dist tests; `t` picks the phase slice to bake. */
export declare function bakeCausticField(size?: number, t?: number): Float32Array;
/** Bake the field into an r8unorm texture with a full 2×2-box mip chain (the
 * seabed recedes to the fog line — unmipped taps shimmer). The u8 texel stores
 * value/2 so the >1 sparkle peaks survive quantisation; the mesh FS multiplies
 * the tap by 2 to undo it. */
export declare function createCausticTexture(device: GPUDevice, size?: number): GPUTexture;
/** Returned by `world.underwater()`. Read `submerged`/`depth`; every option
 * below is a live-mutable field (no rebuild). */
export declare class Underwater3d {
    water: Water3d | null;
    enable: 'auto' | boolean;
    minDepth: number;
    sigma: [number, number, number];
    sunSigma: [number, number, number];
    waterColor: string;
    clarity: number;
    maxView: number;
    caustics: Required<CausticOptions>;
    causticsOn: boolean;
    snell: boolean;
    rays: boolean;
    /** Underwater shaft brightness multiplier (rays: { intensity }). */
    rayStrength: number;
    /** 0..1 — how much of the surface web sheds visible columns (rays:
     * { quantity }). 0 = a few hot cells only, 1 = most of the web. */
    rayQuantity: number;
    /** World units below the flat water level at which the beam tops start.
     * 0 = right up in the waves (Rich's preference for the ABZU wall); raise
     * to pull the tops down away from the surface. */
    rayBand: number;
    /** Shaft arc PACKING in world units — smaller = MANY more, tighter beams
     * in the ring (the ABZU wall is a dense field, not a few streaks). */
    rayGap: number;
    /** Shaft FLICKER 0..2 — the beams do NOT move; they FADE in and out on
     * their own phase+speed, like a long streak of piano keys constantly
     * playing (Rich/ABZU). 0 = all steady on; 1 = gentle; 2 = frantic. */
    rayFlicker: number;
    /** WALL DISTANCE (world units): the ring of beams sits this far from the
     * camera and follows it — "just out of reach". Raise to push the wall of
     * light further back. */
    rayNear: number;
    vignette: number;
    grade: number;
    wobble: number;
    /** Read-only, updated each tick. */
    submerged: boolean;
    /** Camera depth below the surface (0 when above). */
    depth: number;
    /** Whether the composite pass should run this frame (submerged, or within a
     * small band above the surface so the crossing splits cleanly). */
    active: boolean;
    /** 0 near the surface → 1 fully under (drives whole-frame vs split mask). */
    fullUnder: number;
    /** The surface height used for the mask this tick. */
    surfaceY: number;
    /** Caustics run whenever the body exists and the sun is up — NOT tied to the
     * camera being submerged (the seabed dapples when seen from ABOVE too). */
    causticActive: boolean;
    /** Storm- and sun-coupled caustic values, refreshed each tick. */
    causticStrengthNow: number;
    causticSpeedNow: number;
    /** The fog to apply while submerged (recomputed each tick). */
    fogNow: {
        color: string;
        near: number;
        far: number;
    };
    dead: boolean;
    /** True when no explicit waterColor was given: the palette then FOLLOWS
     * the water body's tint (seaColor dial and all) every tick. */
    autoColor: boolean;
    constructor(opts?: UnderwaterOptions, water?: Water3d | null);
    /** Apply a named preset over the live fields (keeps `water`/`enable`). */
    setPreset(name: UnderwaterPresetName): void;
    /** 0 near the surface → 1 at snorkel-to-dive depth: the preset optics are
     * tuned for BEING DOWN there — applied at full strength the moment the
     * camera dips under, ankle-deep water at a beach slammed to instant murk.
     * Updated each tick from camera depth; scales the view extinction. */
    shallowK: number;
    /** σ scaled by the clarity dial (0 = crystal, 1 = as authored) and the
     * shallow-water ramp (ankle-deep = near-clear, diving = full preset). */
    viewSigma(): [number, number, number];
    /** Downwelling sigma scaled by clarity and the shallow ramp — the dial and
     * snorkel depth brighten the sun-fade the same way they thin the murk. */
    sunSigmaNow(): [number, number, number];
    /** Update submersion state + the fog for this frame. Pure w.r.t. the world:
     * the caller reads `submerged`/`fogNow`/`active` and applies them. `surfY`
     * is the exact wave height at the camera column (water.heightAt); `sunI` is
     * the world sun intensity (0 at night → no caustics). */
    tick(camX: number, camY: number, camZ: number, surfY: number, storm: number, sunI?: number): void;
    /** God-ray shaft modulation while submerged (M4): reuse the surface god-ray
     * pass but ATTENUATE it by the downwelling law (shafts die with depth) and
     * TINT it toward the water hue. Null when not submerged or rays disabled —
     * the caller leaves the surface shafts untouched. */
    shaftMod(): {
        atten: number;
        tint: [number, number, number];
    } | null;
    kill(): void;
}
export declare class Underwater3dLayer {
    private format;
    /** Set by pack() each frame from the handle; composite() no-ops when off. */
    active: boolean;
    /** The baked tileable caustic pattern — world3d hands this to Lights3d so
     * the mesh FS (group(1) bindings 5/6) can tap it. Recreated on device loss;
     * the owner must re-call lights3d.setCaustic after rebuild(). */
    causticView: GPUTextureView;
    private device;
    private mulPipeline;
    private mulPipelineMS;
    private addPipeline;
    private addPipelineMS;
    private layout;
    private layoutMS;
    private uniforms;
    private linearSamp;
    private shaftTarget;
    private shaftView;
    private dummyShaft;
    private shaftDrawn;
    private data;
    private bilPipeline;
    private bilPipelineMS;
    private bilLayout;
    private bilLayoutMS;
    private sbUniform;
    private instBuffer;
    private sbData;
    private instData;
    private shaftCount;
    constructor(device: GPUDevice, format: GPUTextureFormat);
    /** Pack the composite uniforms for this frame from the live handle. `vp` is
     * this frame's view-projection (inverted here for world reconstruction).
     * `sun` is the world light DIRECTION (pointing down-scene), `sunI` its
     * intensity (0 at night), `time` the wall clock for the shaft drift. */
    pack(uw: Underwater3d, vp: Mat4, eye: {
        x: number;
        y: number;
        z: number;
    }, sun?: {
        x: number;
        y: number;
        z: number;
    }, sunI?: number, time?: number, storm?: number): void;
    /** Draw the BILLBOARD shafts into the half-res r8 target (additive),
     * encoder-level, BEFORE the scene pass that composites+blurs them. */
    renderShafts(encoder: GPUCommandEncoder, worldDepth: GPUTexture, canvasW: number, canvasH: number): void;
    /** The two blended draws, inside the open scene pass (depth attached
     * read-only; we sample the persistent worldDepth instead). */
    composite(pass: GPURenderPassEncoder, worldDepth: GPUTexture): void;
    rebuild(device: GPUDevice): void;
}

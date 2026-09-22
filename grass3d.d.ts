// Docs: engine/webgpu/terrain3d.md — usage, recipes & traps (this file = exact type signatures)
import type { Mat4 } from './math3d.js';
export interface GrassOptions {
    /** World units the follow window spans (default 84). Grass thins AND
     * shortens with distance and fades to nothing at the edge, so the window has
     * no hard rim; bigger = more reach + a longer falloff at the cost of more
     * blades. Never spawns past the terrain edge. */
    span?: number;
    /** Cells per side of the spawn lattice (default 320). One potential blade
     * per cell — but only `dynamic` fraction of them become real blades. */
    cells?: number;
    /** Fraction of the near field that's REAL GEOMETRY blades vs cheap
     * billboards (0..1, default 0.5). This is the perf/quality lever: 1 = all
     * blades (best, heaviest), low = mostly billboards filling in. Billboards
     * make up the difference within the blade radius. */
    dynamic?: number;
    /** Base blade height in world units (default 1.1 — tall enough to read at
     * bee scale). */
    height?: number;
    /** Blade width in world units (default 0.03). */
    width?: number;
    /** Far billboard-card ring: world span (default 360) and lattice cells
     * (default 300). Cards fake the grass from where the blades fade out to the
     * fog, so the field reaches the horizon. */
    farSpan?: number;
    farCells?: number;
    /** Billboard-card clump size in world units (width default 0.7, height
     * default ≈ blade height × 1.15). */
    cardWidth?: number;
    cardHeight?: number;
    /** How many procedural FLOWER-cluster billboard variants to bake (default 0 =
     * none). When >0 the card texture becomes an array [grass, flower…] and a
     * fraction of clumps (see live `flowerAmount`) turn into flower patches —
     * splashes of poppy/daisy/cornflower colour drifting through the meadow.
     * Flowers are ALBEDO (procedural), so they light correctly (a photo atlas of
     * pre-shaded flowers does not — see the handoff doc). */
    flowers?: number;
    /** Wind strength (default 0.25) and direction (radians, default 0.6). */
    wind?: number;
    windDir?: number;
    /** Tint blend toward the ground colormap colour (0 = pure grass green,
     * 1 = the ground colour). Default 0.5 so blades relate to the terrain. */
    groundTint?: number;
    /** Grass blade colour (the green the tint blends from). Default a fresh
     * meadow green. */
    color?: string;
    /** FAN the spawn window FORWARD instead of a full disc around the camera
     * (default 0 = full disc, unchanged). You only ever SEE the wedge in front,
     * so a full disc spends most of its lattice on cells behind you that are
     * culled every frame. `viewBias` (0..~0.7) slides the window's centre forward
     * along the flattened view direction — the same blade budget then reaches
     * further ahead where you can see it. Blades stay pinned to world cells, so
     * nothing swims; the window just re-aims as you turn. */
    viewBias?: number;
    /** ANGULAR width of the fan in degrees (default 360 = no angular cull — a
     * disc). Set e.g. 150 to spawn only within ±75° of the view direction. Keep
     * it GENEROUSLY wider than the camera FOV so cells enter/leave the wedge
     * OFF-SCREEN (a tight fan pops at the screen edges as you turn). A small full
     * disc is always kept right around the camera so turning never bares your feet. */
    fanAngle?: number;
}
/** A follow-window grass field bound to one terrain. */
export declare class Grass3d {
    private readonly field;
    private colormapView;
    private readonly sampler;
    private readonly format;
    private readonly sampleCount;
    private lightsLayout;
    private device;
    private computePipeline;
    private renderPipeline;
    private uniformBuf;
    private bladeBuf;
    /** Draw the near GEOMETRY BLADES (default true). Live toggle — mostly for
     * the debug bench, where you want to see one layer in isolation. */
    showBlades: boolean;
    /** Draw the far BILLBOARD CARDS (default true). The cards are ETERNAL (they
     * exist independent of `dynamic`, which only sets the near blade↔card mix),
     * so this flag is the ONLY way to actually turn the card layer off. */
    showCards: boolean;
    private argsBuf;
    private heightTex;
    private computeBind;
    private renderBind;
    private computeLayout;
    private renderLayout;
    private cardComputePipeline;
    private cardRenderPipeline;
    private cardBuf;
    private cardArgs;
    private cardTex;
    private cardComputeBind;
    private cardRenderBind;
    private cardRenderLayout;
    readonly span: number;
    readonly cells: number;
    private capacity;
    private height;
    private width;
    private windDir;
    private windStr;
    private dynamic;
    private groundTint;
    /** Forward window bias (0 = disc). Live-mutable — the debug bench drives it. */
    viewBias: number;
    /** cos(fanAngle/2); ≤ -1 means "no angular cull" (full disc). Live-mutable. */
    fanCos: number;
    private green;
    private farSpan;
    private farCells;
    private cardCap;
    private cardW;
    private cardH;
    /** Number of flower-cluster frames baked into the card array (0 = none). The
     * card texture holds 1 grass frame + this many flower frames. Baked at build,
     * so changing it needs a rebuild. */
    private flowerCount;
    /** Total card-texture array frames (1 grass + flowerCount). Set by
     * makeCardTexture; carried to the shaders in veg.x. */
    private cardFrames;
    /** Fraction of the field that flowers (0 = none, ~0.3 = generous drifts).
     * Gated by low-frequency noise so blooms cluster. Live-mutable (veg.z). */
    flowerAmount: number;
    /** Straw/hay recolour 0..1 — warms blades AND grass cards toward golden dry
     * grass, luminance-preserving. Live-mutable (veg.w). */
    dryness: number;
    private uni;
    constructor(field: {
        heights: Float32Array;
        res: number;
        size: number;
        baseY: number;
    }, colormapView: GPUTextureView, sampler: GPUSampler, format: GPUTextureFormat, sampleCount: number, lightsLayout: GPUBindGroupLayout, opts?: GrassOptions);
    /** Re-point at the terrain colormap (its view changes on device-loss). */
    setColormap(view: GPUTextureView): void;
    rebuild(device: GPUDevice, lightsLayout?: GPUBindGroupLayout): void;
    /**
     * The grass-CLUMP billboard texture — a tuft of blades drawn once into a
     * mip-mapped RGBA texture (alpha = the clump silhouette). Cards sample this;
     * mips keep the far field from aliasing on the alpha edges.
     */
    private makeCardTexture;
    /** The grass CLUMP — a tuft of sharp blade silhouettes (alpha = the clump
     * shape; the render tints it, so the RGB here is only a mip-safe fallback). */
    private drawGrassClump;
    /** A FLOWER cluster — a few grass blades so it sits in the meadow, thin green
     * stems, and 3–6 bright bloom heads near the top. Unlike the grass clump the
     * render uses this RGB directly as albedo, so the petal colours ARE the look.
     * `variant` cycles the palette (poppy / daisy / cornflower / buttercup / …). */
    private drawFlowerClump;
    /**
     * Build a mip-mapped RGBA-srgb **2d-array** texture from N equal-size (S×S)
     * level-0 layers (box-filtered mips per layer — WebGPU has no auto-gen). One
     * layer → a plain clump; many → grass + flower frames the cards index into.
     */
    private makeArrayTexture;
    private buildRenderBind;
    private worldUniforms;
    /** world3d hands its shared mesh-uniform buffer in (the U block). */
    setWorldUniforms(buf: GPUBuffer): void;
    /** Encode this frame's spawn: zero the count, then one thread per cell. */
    compute(encoder: GPUCommandEncoder, viewProj: Mat4, camX: number, camY: number, camZ: number, time: number, fwdX?: number, fwdZ?: number): void;
    /** Draw the field — far billboard cards first (behind), then near blades.
     * Two drawIndirect calls, both lit like the terrain. */
    render(pass: GPURenderPassEncoder, lightsBind: GPUBindGroup): void;
    destroy(): void;
}

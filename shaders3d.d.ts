// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** The fallback's local-light cap (plan §1: "fallback caps at 8 uniform lights"). */
export declare const GL_MAX_LIGHTS3D = 8;
/**
 * Mesh VERTEX shader — the GLSL port of MESH_WGSL's vs (and, with `skinned`,
 * of skinnedVariant(MESH_WGSL)'s): per-instance euler rotate + translate, the
 * tiled unwrap uv, the WebGPU→GL depth remap. Instance data is 7 vec4
 * attributes at locations 8..14 — the SAME 28-float packing as the WebGPU
 * instance storage buffer:
 *   iPos (xyz + yaw) | iSize (whd + pitch) | iColor | iRot (roll, grain,
 *   tileX, tileY) | iTexRect | iNormRect | iExtra (bump, metallic, rough,
 *   emissive).
 * The skinned variant mirrors SKINNED_VERTEX_BUFFERS (stride 44: pos, norm,
 * uv, uint16x4 joints, unorm8x4 weights) plus a per-instance palette base
 * (location 5); the joint palette lives in an RGBA32F texture, 4 texels per
 * mat4, texelFetch'd by paletteBase + joint.
 */
export declare const buildGlMeshVertGLSL: (skinned?: boolean, deform?: boolean) => string;
/**
 * Mesh FRAGMENT shader — the GLSL port of MESH_WGSL's fs CORE: Schüler
 * cotangent-frame normal mapping, PBR-lite GGX sun (pbrDirect verbatim),
 * hemisphere ambient, up to 8 uniform point/spot lights (replacing the
 * clustered path — same UE-style falloff and cone maths, evaluated in WORLD
 * space, which is equivalent), metallicRoughness texture multiply, emissive,
 * distance fog, env/IBL reflections, and the directional SHADOW MAP
 * (uniform-gated compare-mode PCF). Dropped vs the original: caustics and
 * ground grain (see the file header). Output premultiplied.
 */
export declare const buildGlMeshFragGLSL: (deform?: boolean) => string;
/**
 * Billboard shaders — the GLSL port of BB_WGSL: camera-facing atlas quads,
 * base-anchored, alpha-cutout (discard < 0.5 — depth just works), fogged.
 * Instance = 4 vec4 attributes (16 floats, the BB_FLOATS layout):
 * iPos (xyz + flipX) | iSize (w, h, -, -) | iColor | iUv (atlas rect).
 */
export declare const buildGlBillboardVertGLSL: () => string;
export declare const buildGlBillboardFragGLSL: () => string;
/**
 * Blob-shadow shaders — the GLSL port of BLOB_WGSL: a soft dark rotated
 * ellipse on the ground under each object, one instanced translucent draw.
 * Instance = 2 vec4 attributes (BLOB_FLOATS = 8):
 * iPos (x, groundY, z, radiusX) | iMisc (alpha, radiusZ, yaw, -).
 */
export declare const buildGlBlobVertGLSL: () => string;
export declare const buildGlBlobFragGLSL: () => string;
/**
 * CPU-particle shaders — the GLSL port of FX_WGSL: camera-facing quads for
 * `world.fx` / `world.burst()`. Modes: 0 soft disc (misc.w = glow dial),
 * 1 atlas frame, 2 SDF ring, 3 FLAT world-XZ ring (ground shockwaves).
 * Instance = 4 vec4 (FX_FLOATS = 16): iPos (xyz + half-size) | iColor |
 * iMisc (rot, mode, add+lit bits, p) | iUv. The WebGPU original's LIT mode
 * adds the froxel lights; on the fallback lit particles take the flat
 * ambient + sun approximation only (no clusters).
 */
export declare const buildGlFxVertGLSL: () => string;
export declare const buildGlFxFragGLSL: () => string;
/**
 * Sky VERTEX shader — SKY_WGSL's fullscreen triangle at MAXIMUM depth
 * (z = w = 1: far plane in both APIs, so no depth remap needed). Drawn after
 * the solids with LEQUAL + depth write off: only empty pixels shade.
 */
export declare const buildGlSkyVertGLSL: () => string;
/**
 * Sky FRAGMENT shader — the full uniform-only port of SKY_WGSL: gradient +
 * sun disc/glow + two FBM cloud decks + stars/constellations and the moon at
 * night. The uniform block is the SAME 12-vec4 packing Sky3dLayer.write()
 * produces (world.ts reuses that packing logic float-for-float):
 *   [0] fwd+tanX  [1] right+tanY  [2] up+time  [3] sunPos+sunI
 *   [4] sunCol+moon  [5] zenith+stars  [6] horizon+cutoff  [7] glow+density
 *   [8] cloudLit+uvScale  [9] cloudShade+windSpeed  [10] wind.xz+cloudsOn
 *   [11] fog+starAngle
 */
export declare const buildGlSkyFragGLSL: () => string;
/** Line vertex shader — instance = 4 vec4 attrs (LINE3D_FLOATS layout). */
export declare const buildGlLine3dVertGLSL: () => string;
/** Line fragment shader — the capsule SDF, verbatim. */
export declare const buildGlLine3dFragGLSL: () => string;
export declare const TRAIL_PTS = 16;
export declare const TRAIL_SEGS = 48;
/** Floats per trail instance — MUST match world3d.ts's TRAIL_FLOATS. */
export declare const TRAIL_FLOATS: number;
/** RGBA32F texels per data-texture row (= TRAIL_FLOATS / 4). */
export declare const TRAIL_TEXELS: number;
/**
 * Trail VERTEX shader — TRAIL_WGSL's vs. `up` bakes the WGSL `override UP`
 * (1 = the vertical base-anchored Tron wall; culling off — walls are seen
 * from both sides and cannot self-fold). The atlas noise flutter is a
 * vertex-stage texture fetch, exactly like the WGSL.
 */
export declare const buildGlTrailVertGLSL: (up?: boolean) => string;
/** Trail FRAGMENT shader — TRAIL_WGSL's fs, verbatim port: two-gaussian
 * width profile, fibre noise, the erode dim/shred blend, white-hot core,
 * crackle sparkler, fog. Premultiplied out; add writes alpha 0. */
export declare const buildGlTrailFragGLSL: () => string;
/** Voxel VERTEX shader — plain (non-instanced) chunk draws. */
export declare const buildGlVoxelVertGLSL: () => string;
/** Voxel FRAGMENT shader — flat daylight tone × per-face factor × AO,
 * alpha-cutout (leaves/glass), fogged. VOXEL_WGSL's fs, verbatim. */
export declare const buildGlVoxelFragGLSL: () => string;
export declare const WISP_SEGX = 12;
export declare const WISP_SEGY = 40;
export declare const WISP_FLOATS = 20;
export declare const buildGlWispVertGLSL: () => string;
export declare const buildGlWispFragGLSL: () => string;
/** Depth-only shadow VERTEX shader (plain or VS-skinned — the same instance
 * and vertex layouts as the mesh programs; no fragment work). */
export declare const buildGlShadowVertGLSL: (skinned?: boolean) => string;
/** Depth-only fragment — GLSL requires one; it writes nothing. */
export declare const buildGlShadowFragGLSL: () => string;
export declare const FLARE_ELEMS = 8;
export declare const buildGlFlareVertGLSL: () => string;
export declare const buildGlFlareFragGLSL: () => string;
/** The sun-occlusion PROBE — a tiny quad at the sun's screen position, at
 * FAR depth (z = w: LEQUAL passes only over sky/cleared pixels), drawn with
 * colour writes off inside an ANY_SAMPLES_PASSED query. The query's async
 * result stands in for the WebGPU original's 3×3 vertex-stage depth taps. */
export declare const buildGlSunProbeVertGLSL: () => string;
export declare const buildGlSunProbeFragGLSL: () => string;
export declare const buildGlFullscreenVertGLSL: () => string;
/** The AO estimate fragment. `taps` bakes ssao.ts's ssaoKernel — pass it in
 * so the kernel maths stays single-sourced (world.ts imports ssaoKernel). */
export declare const buildGlSsaoFragGLSL: (taps: ReadonlyArray<[number, number]>) => string;
/** Bilateral 5-tap cross blur (H then V) — buildSsaoBlurWGSL, verbatim. */
export declare const buildGlSsaoBlurFragGLSL: () => string;
/** Multiply-darken composite (blend ZERO, SRC_COLOR in GL state). */
export declare const buildGlSsaoCompositeFragGLSL: () => string;
export declare const buildGlRaysFragGLSL: () => string;
/** Additive shaft composite (blend ONE, ONE / alpha ZERO, ONE in GL state). */
export declare const buildGlRaysCompositeFragGLSL: () => string;
/** Water VERTEX shader — vsGrid (grid=true) / vsRibbon (grid=false). */
export declare const buildGlWaterVertGLSL: (grid: boolean) => string;
/** Water FRAGMENT shader — waterWGSL's fs, verbatim port (see the header
 * for the WP layout and the orientation rules). */
export declare const buildGlWaterFragGLSL: () => string;
/** Decay + diffuse fragment (fullscreen — pair with buildGlFullscreenVertGLSL). */
export declare const buildGlFoamDecayFragGLSL: () => string;
/** Well-stamp vertex/fragment — one soft ellipse per well, additive. */
export declare const buildGlFoamStampVertGLSL: () => string;
export declare const buildGlFoamStampFragGLSL: () => string;
/** MULTIPLY draw: out = dst * mix(1, transmit, below). Blend ZERO/SRC_COLOR. */
export declare const buildGlUnderwaterMulFragGLSL: () => string;
/** ADD draw: in-scatter + meniscus + the blurred shaft target. Blend ONE/ONE. */
export declare const buildGlUnderwaterAddFragGLSL: () => string;
/** Billboard SHAFT shaders — shaftBillWGSL: a ring of world-anchored beams,
 * cylindrical-billboarded down the refracted sun, piano-keys flicker, soft
 * depth occlusion. Instance = 2 vec4 attributes: (baseX, baseZ, length,
 * width) | (phase, brightness, flickerSpeed, 0). Additive into R8. */
export declare const buildGlShaftVertGLSL: () => string;
export declare const buildGlShaftFragGLSL: () => string;
export declare const GRASS_SEG = 4;
export declare const GRASS_BLADE_VERTS: number;
export declare const GRASS_BLADE_FLOATS = 12;
export declare const buildGlGrassVertGLSL: () => string;
export declare const buildGlGrassFragGLSL: () => string;
export declare const buildGlDeformPatchVertGLSL: () => string;
export declare const buildGlDeformPatchFragGLSL: () => string;
export declare const BEAM_SEGS = 40;
export declare const BEAM_VERTS: number;
export declare const BEAM_INST_FLOATS = 12;
export declare const buildGlBeamVertGLSL: () => string;
export declare const buildGlBeamFragGLSL: () => string;
export declare const buildGlGrassCardVertGLSL: () => string;
export declare const buildGlGrassCardFragGLSL: () => string;
export declare const buildGlPickVertGLSL: () => string;
export declare const buildGlPickFragGLSL: () => string;

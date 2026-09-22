import { n as rgba } from "./shared-DhV4JtEZ.js";
import { A as sphereVsFrustum, C as mat4Perspective, D as rayObbLocal, F as forward, I as lookAtEuler, M as viewBasis, N as composeChain, O as rayPlaneY, P as eulerToQuat, R as quatRotate, S as mat4Ortho, T as rayFromNdc, Z as loadImage, b as mat4LookAt, o as noiseCanvas, ut as resolveVfx, v as frustumPlanes, w as mat4Project, x as mat4Mul, y as mat4Inverse } from "./shared-DjLuB-Ve.js";
import { _ as sphereVerts, a as cubeVerts, b as tubeVerts, d as panelVerts, f as planeVerts, g as shapeVerts, h as roundedBoxVerts, i as coneVerts, l as extrudeVerts, m as ringVerts, n as capsuleVerts, o as cylinderVerts, p as polyhedronVerts, r as circleVerts, s as discVerts, u as latheVerts, v as torusKnotVerts, x as wedgeVerts, y as torusVerts } from "./shared-BKm0BaVz.js";
import { At as deformPatchVerts, B as halveRGBA, Bt as AnimatedModel3d, D as VoxelEditor, Dt as bakeColormapPixels, Et as Terrain3d, Ft as VectorShape3d, H as raycastVoxel, I as VoxelWorld, J as Water3d, Jt as Particles3d, Lt as polylinesToSegs, Mt as pickChunks, R as bakeTiles, Rt as wireframeEdges, Tt as TERRAIN_SURFACES, V as meshChunk, Vt as Model3d, W as voxelTerrain, Wt as rgbHex, Xt as OrbitRig, Yt as SurfaceSampler, Z as bakeRippleField, a as ssaoKernel, at as constellationDirs, c as Agents3d, kt as chunkVerts, pt as Light3d, rt as Sky3d, w as bakeCausticField, wt as Heightfield, x as Underwater3d, zt as loadModelData } from "./shared-D9JZoPnb.js";
import { a as instanceVec4Attribs, i as compileProgram, n as GLSL_HEADER, r as InstanceBuffer, t as GLSL_FRAG_HEADER } from "./shared-DByetpIq.js";
//#region src/lib/webgl3d/shaders3d.ts
/** The fallback's local-light cap (plan §1: "fallback caps at 8 uniform lights"). */
var GL_MAX_LIGHTS3D = 8;
var ROTATE_GLSL = `
vec3 rotate3d(vec3 v, float yaw, float pitch, float roll) {
  vec3 p = v;
  float cr = cos(roll); float sr = sin(roll);
  p = vec3(p.x * cr - p.y * sr, p.x * sr + p.y * cr, p.z);
  float cp = cos(pitch); float sp = sin(pitch);
  p = vec3(p.x, p.y * cp - p.z * sp, p.y * sp + p.z * cp);
  float cy = cos(yaw); float sy = sin(yaw);
  return vec3(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);
}
`;
var DEFORM_DECL_GLSL = `
uniform vec4 uDU[4];
uniform highp sampler2D uDeformTex;    // R32F carve window (manual bilinear)
float deformAt(float wx, float wz) {
  float uu = (wx - uDU[0].x) * uDU[0].z + 0.5;
  float vv = (wz - uDU[0].y) * uDU[0].z + 0.5;
  float edge = min(min(uu, 1.0 - uu), min(vv, 1.0 - vv));
  if (edge <= 0.0) { return 0.0; }
  vec2 g = vec2(uu, vv) * uDU[0].w - 0.5;
  vec2 g0 = floor(g);
  vec2 f = g - g0;
  int hi = int(uDU[0].w) - 1;
  int x0 = clamp(int(g0.x), 0, hi); int x1 = clamp(int(g0.x) + 1, 0, hi);
  int z0 = clamp(int(g0.y), 0, hi); int z1 = clamp(int(g0.y) + 1, 0, hi);
  float a = texelFetch(uDeformTex, ivec2(x0, z0), 0).r;
  float b = texelFetch(uDeformTex, ivec2(x1, z0), 0).r;
  float c = texelFetch(uDeformTex, ivec2(x0, z1), 0).r;
  float e = texelFetch(uDeformTex, ivec2(x1, z1), 0).r;
  float bi = mix(mix(a, b, f.x), mix(c, e, f.x), f.y);
  return bi * smoothstep(0.0, 0.06, edge);
}
`;
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
var buildGlMeshVertGLSL = (skinned = false, deform = false) => GLSL_HEADER + (deform ? DEFORM_DECL_GLSL : "") + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNorm;
layout(location=2) in vec2 aUv;
${skinned ? `layout(location=3) in uvec4 aJoints;
layout(location=4) in vec4 aWeights;
layout(location=5) in float iPalBase;   // per-instance palette base (mat4 units)
uniform highp sampler2D uPalette;       // RGBA32F, 4 texels per mat4 (one row each)
mat4 paletteMat(int m) {
  return mat4(
    texelFetch(uPalette, ivec2(0, m), 0),
    texelFetch(uPalette, ivec2(1, m), 0),
    texelFetch(uPalette, ivec2(2, m), 0),
    texelFetch(uPalette, ivec2(3, m), 0));
}
` : ""}layout(location=8) in vec4 iPos;      // xyz + yaw
layout(location=9) in vec4 iSize;     // whd + pitch
layout(location=10) in vec4 iColor;
layout(location=11) in vec4 iRot;     // roll, grain (unused on GL), tileX, tileY
layout(location=12) in vec4 iTexRect;
layout(location=13) in vec4 iNormRect;
layout(location=14) in vec4 iExtra;   // bump, metallic, rough, emissive
uniform mat4 uViewProj;
out vec3 vNormal;
out vec3 vWorld;
out vec4 vColor;
out vec3 vMr;
out vec2 vUv;
out vec4 vTexRect;
out vec4 vNormRect;
out float vBump;
${ROTATE_GLSL}
void main() {
${skinned ? `  // VS skinning (skinnedVariant port): pose the vertex from its palette
  // slice BEFORE the ordinary instance transform runs.
  vec3 sp3 = vec3(0.0);
  vec3 sn3 = vec3(0.0);
  int pb = int(iPalBase + 0.5);
  for (int k = 0; k < 4; k++) {
    float wgt = aWeights[k];
    if (wgt > 0.0) {
      mat4 pm = paletteMat(pb + int(aJoints[k]));
      sp3 += wgt * (pm * vec4(aPos, 1.0)).xyz;
      sn3 += wgt * (mat3(pm) * aNorm);
    }
  }
  vec3 vpos = sp3;
  vec3 vnorm = normalize(sn3);
` : `  vec3 vpos = aPos;
  vec3 vnorm = aNorm;
`}  vec3 world = rotate3d(vpos * iSize.xyz, iPos.w, iSize.w, iRot.x) + iPos.xyz;
${deform ? `  // Geometry sinks only to the CAP (deformVariant: the trench LOOK is
  // fragment work; a full-depth vertex drop tents wide at coarse verts).
  world.y -= min(deformAt(world.x, world.z), uDU[2].w);
` : ""}  vec4 clip = uViewProj * vec4(world, 1.0);
  clip.z = clip.z * 2.0 - clip.w;      // WebGPU z01 → GL z[-1,1]
  gl_Position = clip;
  vNormal = rotate3d(vnorm, iPos.w, iSize.w, iRot.x);
  vWorld = world;
  vColor = iColor;
  vMr = iExtra.yzw;
  vUv = aUv * iRot.zw;
  vTexRect = iTexRect;
  vNormRect = iNormRect;
  vBump = iExtra.x;
}
`;
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
var buildGlMeshFragGLSL = (deform = false) => GLSL_FRAG_HEADER + (deform ? DEFORM_DECL_GLSL : "") + `
in vec3 vNormal;
in vec3 vWorld;
in vec4 vColor;
in vec3 vMr;                          // metallic, roughness, emissive
in vec2 vUv;
in vec4 vTexRect;
in vec4 vNormRect;
in float vBump;
uniform sampler2D uTex;               // colour (atlas / standalone / 1×1 white)
uniform sampler2D uNormTex;           // normal map (atlas / standalone / 1×1 flat)
uniform sampler2D uMrTex;             // metallicRoughness (g=rough, b=metal; white default)
uniform vec4 uCamPos;
uniform vec4 uFogColor;               // rgb + ambient intensity
uniform vec4 uParams;                 // fogNear, fogFar, fogOn, time
uniform vec4 uLightDir;               // direction the sun light TRAVELS (unit)
uniform vec4 uAmbSky;                 // hemisphere ambient from above
uniform vec4 uAmbGround;              // ...and from below
uniform vec4 uSunCol;                 // sun rgb × intensity (w)
uniform vec4 uLights[32]; // 4 vec4 per light: pos+radius | rgbI+type | dir+cosOuter | cosInner
uniform float uLightCount;
uniform sampler2D uEnv;               // env equirect, CPU-mipped (IBL-lite)
uniform float uEnvMips;
// Directional SHADOW MAP (world.shadows()) — the map is a compare-mode depth
// texture, so each Poisson tap gets 2×2 hardware PCF for free. Gated by the
// uShadow.x uniform (no recompile to toggle).
uniform mediump sampler2DShadow uShadowMap;
uniform mat4 uShadowVP;
uniform vec4 uShadow;                 // on, biasNdc, texelUv, normalOffWorld
// UNDERWATER caustics — MESH_WGSL's uwC block (baked RG tile, two scrolled
// min-blended taps; uniform-gated so a world without water pays nothing).
uniform mediump sampler2D uCaustic;   // repeat + mips; R and G are two phases
uniform vec4 uUwC;                    // on, surfaceY, worldScale, speedNow
uniform vec4 uUwC2;                   // strengthNow, maxDepth, rgbSplit, downwelling sigma
out vec4 outColor;

const vec2 POISSON8[8] = vec2[8](
  vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
  vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893));

// Dithered rotated-poisson PCF with the slope-scaled normal offset —
// MESH_WGSL's shadowFactor, verbatim except the uv: the GL shadow map is
// rendered bottom-up, so v = ndc.y*0.5+0.5 (the WGSL flips it).
float shadowFactor(vec3 world, vec3 nrm) {
  float NL = max(dot(nrm, -uLightDir.xyz), 0.0);
  float slope = sqrt(max(1.0 - NL * NL, 0.0)) / max(NL, 0.15);
  float off = uShadow.w * min(1.0 + slope, 6.0);
  vec4 sc = uShadowVP * vec4(world + nrm * off, 1.0);
  vec3 ndc = sc.xyz / sc.w;
  if (abs(ndc.x) >= 1.0 || abs(ndc.y) >= 1.0 || ndc.z <= 0.0 || ndc.z >= 1.0) { return 1.0; }
  vec2 uv = ndc.xy * 0.5 + 0.5;
  float refZ = ndc.z - uShadow.y;
  float h = fract(sin(dot(world, vec3(12.9898, 78.233, 37.719))) * 43758.547);
  float ca = cos(h * 6.28318); float sa = sin(h * 6.28318);
  float sum = texture(uShadowMap, vec3(uv, refZ));
  for (int i = 0; i < 8; i++) {
    vec2 p = POISSON8[i] * (uShadow.z * 2.5);
    vec2 r = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
    sum += texture(uShadowMap, vec3(uv + r, refZ));
  }
  return sum / 9.0;
}

// One PBR-lite direct-light evaluation — MESH_WGSL's pbrDirect, verbatim.
vec3 pbrDirect(vec3 nrm, vec3 v, vec3 l, vec3 albedo, float metallic, float rough, vec3 radiance) {
  vec3 h = normalize(v + l);
  float NL = max(dot(nrm, l), 0.0);
  float NV = max(dot(nrm, v), 1e-4);
  float NH = max(dot(nrm, h), 0.0);
  float VH = max(dot(v, h), 0.0);
  float a2 = rough * rough * rough * rough;
  float dd2 = NH * NH * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159 * dd2 * dd2);
  float kk = (rough + 1.0) * (rough + 1.0) / 8.0;
  float G = (NV / (NV * (1.0 - kk) + kk)) * (NL / (NL * (1.0 - kk) + kk));
  vec3 F0 = mix(vec3(0.04), albedo, metallic);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - VH, 5.0);
  vec3 spec = D * G * F / (4.0 * NV * NL + 1e-4);
  vec3 kd = (vec3(1.0) - F) * (1.0 - metallic);
  return (kd * albedo / 3.14159 + spec) * NL * radiance;
}

// Tangent basis WITHOUT tangent attributes (Schüler) — MESH_WGSL's
// perturbNormal, incl. the no-epsilon det floor (close-up banding lesson).
vec3 perturbNormal(vec3 n, vec3 dp1, vec3 dp2, vec2 duv1, vec2 duv2, vec2 uv, vec4 rect, float bump) {
  vec2 nuv = rect.xy + fract(uv) * (rect.zw - rect.xy);
  vec3 mn = textureLod(uNormTex, nuv, 0.0).rgb * 2.0 - 1.0;
  vec3 dp2perp = cross(dp2, n);
  vec3 dp1perp = cross(n, dp1);
  vec3 T = dp2perp * duv1.x + dp1perp * duv2.x;
  vec3 B = dp2perp * duv1.y + dp1perp * duv2.y;
  float det = max(dot(T, T), dot(B, B));
  float scale = inversesqrt(max(det, 1e-30));
  return normalize(mat3(T * scale, B * scale, n) * vec3(mn.xy * bump, mn.z));
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 dp1 = dFdx(vWorld);
  vec3 dp2 = dFdy(vWorld);
  vec2 duv1 = dFdx(vUv);
  vec2 duv2 = dFdy(vUv);
${deform ? `  // THE HOLE: the high-poly snow patch replaces this terrain inside its cut
  // disc (one surface, never two — the z-fight lesson). After the derivative
  // reads above. Then the DISTANCE-LOD filtered carve (5 taps over the pixel
  // footprint), the rim normal tilt and the trench tint gate — deformVariant.
  if (uDU[3].w > 0.5 && distance(vWorld.xz, uDU[3].xy) < uDU[3].z) { discard; }
  float foot = (length(dp1.xz) + length(dp2.xz)) * 0.5;
  float carveF = (deformAt(vWorld.x, vWorld.z)
    + deformAt(vWorld.x + dp1.x * 0.5, vWorld.z + dp1.z * 0.5)
    + deformAt(vWorld.x - dp1.x * 0.5, vWorld.z - dp1.z * 0.5)
    + deformAt(vWorld.x + dp2.x * 0.5, vWorld.z + dp2.z * 0.5)
    + deformAt(vWorld.x - dp2.x * 0.5, vWorld.z - dp2.z * 0.5)) * 0.2;
  float te = max(max(uDU[2].z, 1e-3), foot * 0.75);
  float dcx = deformAt(vWorld.x + te, vWorld.z) - deformAt(vWorld.x - te, vWorld.z);
  float dcz = deformAt(vWorld.x, vWorld.z + te) - deformAt(vWorld.x, vWorld.z - te);
  n = normalize(n + vec3(dcx, 0.0, dcz) * (uDU[1].w / (2.0 * te)));
  float lodT = clamp(foot / (max(uDU[2].z, 1e-3) * 3.0), 0.0, 1.0);
  float trench = clamp(carveF / max(uDU[2].y, 1e-4), 0.0, 1.0);
  float tmix = smoothstep(mix(0.3, 0.02, lodT), mix(0.85, 0.3, lodT), trench);
` : ""}  if (vBump > 0.001) {
    n = perturbNormal(n, dp1, dp2, duv1, duv2, vUv, vNormRect, vBump);
  }
  vec2 tuv = vTexRect.xy + fract(vUv) * (vTexRect.zw - vTexRect.xy);
  vec4 t = textureLod(uTex, tuv, 0.0);
${deform ? `  // Under-layer tint, gated (the pale-halo + skylight-loss lessons).
  vec3 albedo = mix(vColor.rgb * t.rgb, uDU[1].rgb * (1.0 - 0.3 * trench), tmix * 0.95);` : "  vec3 albedo = vColor.rgb * t.rgb;"}
  vec4 mrT = textureLod(uMrTex, tuv, 0.0);
  float metallic = clamp(vMr.x * mrT.b, 0.0, 1.0);
  float rough = clamp(vMr.y * mrT.g, 0.045, 1.0);
  vec3 v = normalize(uCamPos.xyz - vWorld);
  vec3 F0amb = mix(vec3(0.04), albedo, metallic);
  vec3 ambient = mix(uAmbGround.rgb, uAmbSky.rgb, n.y * 0.5 + 0.5) * uFogColor.a;
  // The directional sun, shadowed when the map is on (uniform-gated).
  float sunVis = 1.0;
  if (uShadow.x > 0.5) { sunVis = shadowFactor(vWorld, n); }
  vec3 rgb = albedo * ambient * mix(1.0, 0.4, metallic) + F0amb * ambient * 0.6 * metallic
    + pbrDirect(n, v, -uLightDir.xyz, albedo, metallic, rough, uSunCol.rgb * (3.14159 * uSunCol.w)) * sunVis;
  // UNDERWATER caustics — dappled sunlight on the seabed (uniform-gated;
  // two scrolled taps of the baked pattern, min-blended — the Zucconi
  // recipe; ×2 undoes the bake's value/2 store).
  if (uUwC.x > 0.5) {
    float pd = uUwC.y - vWorld.y;
    float cf = clamp(n.y, 0.0, 1.0)
      * smoothstep(0.05, 0.6, pd)
      * smoothstep(uUwC2.y, uUwC2.y * 0.5, pd)
      * exp(-uUwC2.w * max(pd, 0.0))
      * (1.0 - smoothstep(70.0, 170.0, distance(uCamPos.xyz, vWorld)))
      * sunVis * uUwC2.x;
    float csc = max(uUwC.z, 0.1);
    vec2 cuv1 = vWorld.xz / csc + uUwC.w * uParams.w * vec2(0.05, 0.03);
    vec2 cuv2 = vec2(vWorld.z, -vWorld.x) / (csc * 0.41) - uUwC.w * uParams.w * vec2(0.035, 0.05);
    float cc0 = min(texture(uCaustic, cuv1).r, texture(uCaustic, cuv2).g) * 2.0;
    vec3 ccc = clamp(vec3(cc0) + vec3(0.6, 0.0, -0.5) * (cc0 * uUwC2.z * 22.0), vec3(0.0), vec3(2.0));
    rgb += uSunCol.rgb * ccc * cf;
  }
  // Local lights: the clustered loop's shading, over a flat 8-light array.
  int nl = int(uLightCount + 0.5);
  for (int i = 0; i < 8; i++) {
    if (i >= nl) { break; }
    vec4 l0 = uLights[i * 4];
    vec4 l1 = uLights[i * 4 + 1];
    vec3 toL = l0.xyz - vWorld;
    float dist = length(toL);
    if (dist >= l0.w) { continue; }
    vec3 ldir = toL / max(dist, 1e-4);
    float dr = dist / l0.w;
    float atten = 1.0 - dr * dr * dr * dr;
    atten = atten * atten / (dist * dist + 1.0);
    if (l1.w > 0.5) {                  // spot cone
      vec4 l2 = uLights[i * 4 + 2];
      vec4 l3 = uLights[i * 4 + 3];
      atten *= smoothstep(l2.w, l3.x, dot(-ldir, l2.xyz));
    }
    rgb += pbrDirect(n, v, ldir, albedo, metallic, rough, l1.rgb * atten * 3.14159);
  }
  // ENVIRONMENT reflections (IBL-lite) — MESH_WGSL's env block verbatim: the
  // reflected view samples the equirect sky, roughness picks the mip (mirror
  // -> sharp sky, matte -> the blurred average), Fresnel weights it — metals
  // reflect the world instead of going black away from lights.
  if (uAmbSky.w > 0.001) {
    vec3 R = reflect(-v, n);
    float eu = atan(R.x, R.z) / 6.28318530718 + 0.5;
    float ev = 0.5 - asin(clamp(R.y, -1.0, 1.0)) / 3.14159265;
    vec3 env = textureLod(uEnv, vec2(eu, ev), rough * (uEnvMips - 1.0)).rgb;
    float NV = max(dot(n, v), 0.0);
    vec3 Fe = F0amb + (max(vec3(1.0 - rough), F0amb) - F0amb) * pow(1.0 - NV, 5.0);
    rgb += env * Fe * uAmbSky.w * (1.0 - rough * 0.6);
  }
${deform ? `  // SNOW SPARKLE: pin-point sub-texel glints on the sun half-vector, dimmed
  // inside the compressed trench (deformVariant's "huge pixels" fix).
  if (uDU[2].x > 0.0) {
    vec2 sp = vWorld.xz * 7.0;
    vec2 cell = floor(sp);
    float hs = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.547);
    vec2 pnt = cell + vec2(hs, fract(hs * 91.17));
    vec3 hvS = normalize(v - uLightDir.xyz);
    float fac = pow(max(dot(n, hvS), 0.0), 6.0);
    float glint = smoothstep(0.16, 0.02, length(sp - pnt)) * step(0.6, fract(hs * 13.7)) * fac;
    rgb += uSunCol.rgb * uSunCol.w * glint * uDU[2].x * 2.2 * (1.0 - trench);
  }
` : ""}  rgb += albedo * vMr.z;               // self-illumination (still fogged)
  if (uParams.z > 0.5) {
    float f = smoothstep(uParams.x, uParams.y, distance(uCamPos.xyz, vWorld));
    rgb = mix(rgb, uFogColor.rgb, f);
  }
  float a = vColor.a * t.a;
  outColor = vec4(rgb * a, a);
}
`;
/**
* Billboard shaders — the GLSL port of BB_WGSL: camera-facing atlas quads,
* base-anchored, alpha-cutout (discard < 0.5 — depth just works), fogged.
* Instance = 4 vec4 attributes (16 floats, the BB_FLOATS layout):
* iPos (xyz + flipX) | iSize (w, h, -, -) | iColor | iUv (atlas rect).
*/
var buildGlBillboardVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iPos;      // xyz + flipX
layout(location=1) in vec4 iSize;
layout(location=2) in vec4 iColor;
layout(location=3) in vec4 iUv;
uniform mat4 uViewProj;
uniform vec4 uRight;                  // camera basis
uniform vec4 uUp;
out vec2 vUv;
out vec4 vColor;
out vec3 vWorld;
void main() {
  vec2 c01 = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 off = c01 - 0.5;
  // Anchor at the BASE (y offset 0..1): trees/characters stand on their point.
  vec3 world = iPos.xyz + uRight.xyz * (off.x * iSize.x) + uUp.xyz * (c01.y * iSize.y);
  float ux = c01.x;
  if (iPos.w > 0.5) { ux = 1.0 - ux; } // flipX
  vec4 clip = uViewProj * vec4(world, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vUv = vec2(mix(iUv.x, iUv.z, ux), mix(iUv.y, iUv.w, 1.0 - c01.y));
  vColor = iColor;
  vWorld = world;
}
`;
var buildGlBillboardFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vUv;
in vec4 vColor;
in vec3 vWorld;
uniform sampler2D uTex;
uniform vec4 uCamPos;
uniform vec4 uFogColor;
uniform vec4 uParams;
out vec4 outColor;
void main() {
  vec4 t = texture(uTex, vUv);
  float a = t.a * vColor.a;
  if (a < 0.5) { discard; }            // cutout: no sorting, depth just works
  vec3 rgb = t.rgb * vColor.rgb;
  if (uParams.z > 0.5) {
    float f = smoothstep(uParams.x, uParams.y, distance(uCamPos.xyz, vWorld));
    rgb = mix(rgb, uFogColor.rgb, f);
  }
  outColor = vec4(rgb, 1.0);
}
`;
/**
* Blob-shadow shaders — the GLSL port of BLOB_WGSL: a soft dark rotated
* ellipse on the ground under each object, one instanced translucent draw.
* Instance = 2 vec4 attributes (BLOB_FLOATS = 8):
* iPos (x, groundY, z, radiusX) | iMisc (alpha, radiusZ, yaw, -).
*/
var buildGlBlobVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iPos;      // x, groundY, z, radiusX
layout(location=1) in vec4 iMisc;     // alpha, radiusZ, yaw
uniform mat4 uViewProj;
out vec2 vUv;
out float vAlpha;
void main() {
  vec2 corner = vec2(float(gl_VertexID & 1) * 2.0 - 1.0, float(gl_VertexID >> 1) * 2.0 - 1.0);
  vec2 e = vec2(corner.x * iPos.w, corner.y * iMisc.y);
  float cy = cos(iMisc.z); float sy = sin(iMisc.z);
  vec3 world = vec3(iPos.x + e.x * cy - e.y * sy, iPos.y, iPos.z + e.x * sy + e.y * cy);
  vec4 clip = uViewProj * vec4(world, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vUv = corner;
  vAlpha = iMisc.x;
}
`;
var buildGlBlobFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vUv;
in float vAlpha;
out vec4 outColor;
void main() {
  float d = length(vUv);
  // Solid core to ~60% of the radius, then a soft edge (see BLOB_WGSL).
  float a = vAlpha * smoothstep(1.0, 0.6, d);
  outColor = vec4(0.0, 0.0, 0.0, a);   // premultiplied: rgb 0 darkens
}
`;
/**
* CPU-particle shaders — the GLSL port of FX_WGSL: camera-facing quads for
* `world.fx` / `world.burst()`. Modes: 0 soft disc (misc.w = glow dial),
* 1 atlas frame, 2 SDF ring, 3 FLAT world-XZ ring (ground shockwaves).
* Instance = 4 vec4 (FX_FLOATS = 16): iPos (xyz + half-size) | iColor |
* iMisc (rot, mode, add+lit bits, p) | iUv. The WebGPU original's LIT mode
* adds the froxel lights; on the fallback lit particles take the flat
* ambient + sun approximation only (no clusters).
*/
var buildGlFxVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iPos;      // xyz + size (half extent)
layout(location=1) in vec4 iColor;
layout(location=2) in vec4 iMisc;     // rot, mode, add(+2 lit), p
layout(location=3) in vec4 iUv;
uniform mat4 uViewProj;
uniform vec4 uRight;
uniform vec4 uUp;
out vec2 vUvn;
out vec2 vUv;
out vec4 vColor;
out vec3 vWorld;
out vec4 vMisc;
void main() {
  vec2 c01 = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 off = c01 - 0.5;
  float cr = cos(iMisc.x); float sr = sin(iMisc.x);
  off = vec2(off.x * cr - off.y * sr, off.x * sr + off.y * cr);
  // Centred camera-facing expansion; mode 3 lies FLAT in the world XZ plane.
  vec3 world = iPos.xyz + (uRight.xyz * off.x + uUp.xyz * off.y) * (iPos.w * 2.0);
  if (iMisc.y > 2.5) {
    world = iPos.xyz + vec3(off.x, 0.0, off.y) * (iPos.w * 2.0);
  }
  vec4 clip = uViewProj * vec4(world, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vUvn = c01;
  vUv = vec2(mix(iUv.x, iUv.z, c01.x), mix(iUv.y, iUv.w, 1.0 - c01.y));
  vColor = iColor;
  vWorld = world;
  vMisc = iMisc;
}
`;
var buildGlFxFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vUvn;
in vec2 vUv;
in vec4 vColor;
in vec3 vWorld;
in vec4 vMisc;
uniform sampler2D uTex;
uniform vec4 uCamPos;
uniform vec4 uFogColor;               // rgb + ambient
uniform vec4 uParams;
uniform vec4 uLights[32]; // the mesh shader's 8-light array
uniform float uLightCount;
out vec4 outColor;
void main() {
  vec4 t = texture(uTex, vUv);
  float dd = length(vUvn - 0.5) * 2.0;
  float mode = vMisc.y;
  vec3 rgb = vColor.rgb;
  float a = vColor.a;
  if (mode < 0.5) {
    // Soft disc: crisp AA disc → gaussian glow puff by the misc.w dial.
    float crisp = 1.0 - smoothstep(0.9, 1.0, dd);
    float glow = exp(-dd * dd * 5.0) * smoothstep(1.0, 0.7, dd);
    a *= mix(crisp, glow, clamp(vMisc.w, 0.0, 1.0));
  } else if (mode < 1.5) {
    rgb *= t.rgb;                      // atlas frame (debris/petals/chunks)
    a *= t.a;
  } else {
    // SDF ring (modes 2 + 3): a band of thickness p at the rim.
    float inner = 1.0 - max(vMisc.w, 0.02);
    a *= smoothstep(inner - 0.08, inner + 0.02, dd) * (1.0 - smoothstep(0.94, 1.0, dd));
  }
  // misc.z packs add (bit 0) + lit (bit 1). Lit particles take ambient + the
  // flat sun stand-in + the 8-light array — clusterGlow's formula over the
  // fallback's flat lights (same falloff + spot cone), so smoke still picks
  // up lantern colour.
  float lit = vMisc.z > 1.5 ? 1.0 : 0.0;
  float add = vMisc.z - 2.0 * lit;
  if (lit > 0.5) {
    vec3 glow = vec3(0.0);
    int nl = int(uLightCount + 0.5);
    for (int i = 0; i < 8; i++) {
      if (i >= nl) { break; }
      vec4 l0 = uLights[i * 4];
      vec4 l1 = uLights[i * 4 + 1];
      vec3 toL = l0.xyz - vWorld;
      float dist = length(toL);
      if (dist >= l0.w) { continue; }
      float dr = dist / l0.w;
      float atten = 1.0 - dr * dr * dr * dr;
      atten = atten * atten / (dist * dist + 1.0);
      if (l1.w > 0.5) {
        vec4 l2 = uLights[i * 4 + 2];
        vec4 l3 = uLights[i * 4 + 3];
        atten *= smoothstep(l2.w, l3.x, dot(-normalize(toL), l2.xyz));
      }
      glow += l1.rgb * atten;
    }
    rgb *= uFogColor.a + 0.5 + glow * 3.14159;
  }
  if (uParams.z > 0.5) {
    float f = smoothstep(uParams.x, uParams.y, distance(uCamPos.xyz, vWorld));
    rgb = mix(rgb, uFogColor.rgb * (1.0 - add), f);
  }
  outColor = vec4(rgb * a, a * (1.0 - add)); // add: alpha 0 = pure additive
}
`;
var CSTARS = constellationDirs();
var CSTARS_GLSL = `const vec4 CSTARS[${CSTARS.length}] = vec4[${CSTARS.length}](${CSTARS.map((s) => `vec4(${s.x.toFixed(6)}, ${s.y.toFixed(6)}, ${s.z.toFixed(6)}, ${s.b.toFixed(3)})`).join(", ")});`;
/**
* Sky VERTEX shader — SKY_WGSL's fullscreen triangle at MAXIMUM depth
* (z = w = 1: far plane in both APIs, so no depth remap needed). Drawn after
* the solids with LEQUAL + depth write off: only empty pixels shade.
*/
var buildGlSkyVertGLSL = () => GLSL_HEADER + `
out vec2 vNdc;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2) * 2.0 - 1.0, float(gl_VertexID & 2) * 2.0 - 1.0);
  gl_Position = vec4(p, 1.0, 1.0);
  vNdc = p;
}
`;
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
var buildGlSkyFragGLSL = () => GLSL_FRAG_HEADER + `
${CSTARS_GLSL}
in vec2 vNdc;
uniform vec4 uSky[12];
out vec4 outColor;

float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float h31(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }

float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = h21(i); float b = h21(i + vec2(1.0, 0.0));
  float c = h21(i + vec2(0.0, 1.0)); float d = h21(i + vec2(1.0, 1.0));
  return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}

// Rotated-octave fbm — billows, not plaid (see SKY_WGSL).
float fbm(vec2 p0) {
  vec2 p = p0;
  float s = 0.0; float amp = 0.5; float norm = 0.0;
  mat2 rot = mat2(0.8, 0.6, -0.6, 0.8);
  for (int o = 0; o < 5; o++) {
    s += vnoise(p) * amp;
    norm += amp;
    amp *= 0.55;
    p = rot * p * 2.05 + vec2(17.3, 9.1);
  }
  return s / norm;
}

// One cloud plane: (opacity, litness, body) — the BILLOW recipe.
vec3 cloudLayer(vec3 ray, float scale, vec2 windT, float cutoff, vec2 sunXZ) {
  vec2 uv = ray.xz / (ray.y + 0.10) * scale + windT;
  float warp = fbm(uv * 1.9 + vec2(31.7, 11.3)) - 0.5;
  vec2 wuv = uv + vec2(warp * 0.9);
  float n = (fbm(wuv) - 0.5) * 1.9 + 0.5;
  float detail = fbm(wuv * 3.3 + windT * 0.4) - 0.5;
  float dens = n + detail * 0.3;
  float c = smoothstep(cutoff, cutoff + 0.24, dens);
  float body = smoothstep(cutoff, cutoff + 0.55, dens);
  float n2 = fbm(wuv + sunXZ * 0.16);
  float lit = clamp(0.55 + (n - n2) * 4.0, 0.0, 1.3);
  return vec3(c, lit, body);
}

void main() {
  vec3 ray = normalize(uSky[0].xyz + uSky[1].xyz * (vNdc.x * uSky[0].w) + uSky[2].xyz * (vNdc.y * uSky[1].w));
  float h = ray.y;
  float time = uSky[2].w;

  // Gradient: horizon → zenith, with a sun-weighted glow band.
  vec3 col = mix(uSky[6].rgb, uSky[5].rgb, pow(clamp(h, 0.0, 1.0), 0.55));
  vec3 flatSun = normalize(vec3(uSky[3].x, 0.0, uSky[3].z) + vec3(1e-5));
  vec3 flatRay = normalize(vec3(ray.x, 0.0, ray.z) + vec3(1e-5));
  float sunSide = dot(flatSun, flatRay) * 0.5 + 0.5;
  col += uSky[7].rgb * exp(-abs(h) * 8.0) * (0.3 + 0.7 * sunSide);
  col = mix(col, uSky[11].rgb * 0.75, smoothstep(0.0, -0.22, h));

  // Clouds FIRST (composited last): the celestial bodies attenuate by them.
  float alpha0 = 0.0; float alpha1 = 0.0;
  vec3 cc0 = vec3(0.0); vec3 cc1 = vec3(0.0);
  if (uSky[10].z > 0.5 && h > 0.006) {
    float cutoff = uSky[6].w;
    float density = uSky[7].w;
    float scale = uSky[8].w;
    vec2 wt = uSky[10].xy * (time * uSky[9].w);
    vec2 sunXZ = uSky[3].xz;
    float fade = smoothstep(0.006, 0.045, h);
    vec3 c1 = cloudLayer(ray, scale * 2.6, wt * 1.6 + vec2(53.0), cutoff + 0.16, sunXZ);
    cc1 = mix(uSky[9].rgb, uSky[8].rgb, c1.y);
    alpha1 = min(c1.x * density * 0.4, 0.55) * fade;
    vec3 c0 = cloudLayer(ray, scale, wt, cutoff, sunXZ);
    float litCore = clamp(c0.y + c0.z * 0.35, 0.0, 1.35);
    cc0 = mix(uSky[9].rgb, uSky[8].rgb, litCore);
    alpha0 = min(c0.x * (0.55 + 0.45 * c0.z) * density, 0.96) * fade;
  }
  float clearSky = 1.0 - min(alpha0 + alpha1, 1.0);

  // Stars (night, above the horizon, BEHIND the clouds — steep snuff curve).
  float starVis = smoothstep(0.55, 0.95, clearSky);
  if (uSky[5].w > 0.001 && h > 0.0 && starVis > 0.01) {
    vec3 ax = normalize(vec3(0.16, 1.0, 0.09));
    float ca = cos(uSky[11].w); float sa = sin(uSky[11].w);
    vec3 sray = ray * ca + cross(ax, ray) * sa + ax * dot(ax, ray) * (1.0 - ca);
    float horizFade = smoothstep(0.0, 0.12, h) * uSky[5].w * starVis;
    vec3 sp = sray * 340.0;
    vec3 cell = floor(sp);
    float rz = h31(cell + vec3(0.5));
    if (rz > 0.93) {
      vec3 jitter = vec3(h31(cell + vec3(11.0)), h31(cell + vec3(23.0)), h31(cell + vec3(37.0)));
      float d = length(fract(sp) - 0.5 - (jitter - 0.5) * 0.5);
      float twr = h31(cell + vec3(71.3));
      float tw = 0.92 + 0.08 * sin(time * (0.4 + twr * 1.4) + twr * 44.0);
      float glint = step(0.8, twr) * pow(max(sin(time * (0.5 + twr * 0.9) + twr * 91.0), 0.0), 28.0) * 0.9;
      col += vec3(smoothstep(0.28, 0.0, d)) * (rz - 0.93) * 12.0 * (tw + glint) * horizFade;
    }
    for (int i = 0; i < ${CSTARS.length}; i++) {
      vec4 cs = CSTARS[i];
      float dd = dot(sray, cs.xyz);
      col += vec3(0.92, 0.95, 1.0) * (smoothstep(0.9999985, 0.9999995, dd) * 1.25 + pow(max(dd, 0.0), 300000.0) * 0.22) * cs.w * horizFade;
    }
  }

  // The sun: hard disc + tight glow + wide haze (dims behind cloud).
  float sd = dot(ray, uSky[3].xyz);
  float sunI = uSky[3].w;
  float sunClear = 0.12 + 0.88 * clearSky;
  col += uSky[4].rgb * smoothstep(0.99955, 0.99985, sd) * (1.6 + sunI * 2.2) * sunClear;
  col += uSky[4].rgb * pow(max(sd, 0.0), 220.0) * 0.55 * sunI * sunClear;
  col += uSky[4].rgb * pow(max(sd, 0.0), 7.0) * 0.14 * (0.25 + sunI);

  // The moon: the antipode, cool, mostly night.
  float moonA = uSky[4].w;
  if (moonA > 0.001) {
    float md = dot(ray, -uSky[3].xyz);
    vec3 moonCol = vec3(0.86, 0.9, 0.98);
    col += moonCol * smoothstep(0.99975, 0.99991, md) * 1.4 * moonA * sunClear;
    col += moonCol * pow(max(md, 0.0), 300.0) * 0.3 * moonA;
  }

  // Composite the decks over everything.
  col = mix(col, cc1, alpha1);
  col = mix(col, cc0, alpha0);
  outColor = vec4(col, 1.0);
}
`;
/** Line vertex shader — instance = 4 vec4 attrs (LINE3D_FLOATS layout). */
var buildGlLine3dVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iPosA;    // endpoint a (xyz) + core half-width px
layout(location=1) in vec4 iPosB;    // endpoint b (xyz) + capped
layout(location=2) in vec4 iC0;      // rgba at a
layout(location=3) in vec4 iC1;      // rgba at b
uniform mat4 uViewProj;
uniform vec4 uScreen;                // w, h, cameraNear, 0
out vec2 vLocal;                     // pixel space: along, across
out float vLen;
out float vCoreHalf;
out vec4 vC0;
out vec4 vC1;
out float vCapped;
void main() {
  vec4 ca = uViewProj * vec4(iPosA.xyz, 1.0);
  vec4 cb = uViewProj * vec4(iPosB.xyz, 1.0);
  // Near-plane clip in (WebGPU-convention) clip space — see vector3d.ts.
  if (ca.z < 0.0 && cb.z < 0.0) {
    gl_Position = vec4(0.0, 0.0, -2.0, 1.0);
    vLocal = vec2(0.0); vLen = 1.0; vCoreHalf = 0.0;
    vC0 = vec4(0.0); vC1 = vec4(0.0); vCapped = 0.0;
    return;
  }
  if (ca.z < 0.0) { ca = mix(ca, cb, ca.z / (ca.z - cb.z)); }
  else if (cb.z < 0.0) { cb = mix(cb, ca, cb.z / (cb.z - ca.z)); }
  vec2 half_ = vec2(uScreen.x, uScreen.y) * 0.5;
  vec2 pa = (ca.xy / ca.w) * half_;    // pixel space, y up — SDF only
  vec2 pb = (cb.xy / cb.w) * half_;
  vec2 ab = pb - pa;
  float len = max(1e-4, length(ab));
  vec2 dir = ab / len;
  vec2 n = vec2(-dir.y, dir.x);
  float reach = iPosA.w + 2.0;
  vec2 c01 = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  float along = mix(-reach, len + reach, c01.x);
  float across = (c01.y - 0.5) * 2.0 * reach;
  vec2 px = pa + dir * along + n * across;
  float tz = clamp(c01.x, 0.0, 1.0);
  float cw = mix(ca.w, cb.w, tz);
  // World-proportional depth bias toward the camera (vector3d.ts's lesson:
  // a constant NDC bias outweighs whole models at range).
  float cz = mix(ca.z, cb.z, tz) - (0.05 * uScreen.z) / cw;
  gl_Position = vec4(px / half_ * cw, cz * 2.0 - cw, cw);  // WebGPU z -> GL z
  vLocal = vec2(along, across);
  vLen = len;
  vCoreHalf = iPosA.w;
  vC0 = iC0;
  vC1 = iC1;
  vCapped = iPosB.w;
}
`;
/** Line fragment shader — the capsule SDF, verbatim. */
var buildGlLine3dFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vLocal;
in float vLen;
in float vCoreHalf;
in vec4 vC0;
in vec4 vC1;
in float vCapped;
out vec4 outColor;
void main() {
  float ax = vLocal.x;
  if (vCapped < 0.5) { ax = clamp(ax, 0.0, vLen); }
  vec2 q = vec2(ax - clamp(ax, 0.0, vLen), vLocal.y);
  float dist = length(q);
  float a = 1.0 - smoothstep(vCoreHalf - 0.5, vCoreHalf + 0.5, dist);
  if (vCapped < 0.5 && (vLocal.x < 0.0 || vLocal.x > vLen)) { a = 0.0; }
  float t = clamp(vLocal.x / max(vLen, 1e-4), 0.0, 1.0);
  vec4 c = mix(vC0, vC1, t);
  float alpha = c.a * a;
  outColor = vec4(c.rgb * alpha, alpha);   // premultiplied
}
`;
var TRAIL_PTS = 16;
var TRAIL_SEGS = 48;
/** Floats per trail instance — MUST match world3d.ts's TRAIL_FLOATS. */
var TRAIL_FLOATS = 116;
/** RGBA32F texels per data-texture row (= TRAIL_FLOATS / 4). */
var TRAIL_TEXELS = 116 / 4;
/**
* Trail VERTEX shader — TRAIL_WGSL's vs. `up` bakes the WGSL `override UP`
* (1 = the vertical base-anchored Tron wall; culling off — walls are seen
* from both sides and cannot self-fold). The atlas noise flutter is a
* vertex-stage texture fetch, exactly like the WGSL.
*/
var buildGlTrailVertGLSL = (up = false) => GLSL_HEADER + `
const float UP = ${up ? "1.0" : "0.0"};
const int SEGS = 48;
const int PTS = 16;
uniform highp sampler2D uTrail;      // RGBA32F, one row per trail (29 texels)
uniform sampler2D uTex;              // the shared atlas (tileable noise frame)
uniform int uRowBase;                // firstInstance stand-in (no baseInstance in GL)
uniform mat4 uViewProj;
uniform vec4 uCamPos;
uniform vec4 uParams;                // fogNear, fogFar, fogOn, TIME
uniform vec4 uRight;
uniform vec4 uUp;
out vec4 vSk;                        // s along (0 head), k fade, across, DIST
out vec4 vColor;
out vec3 vWorld;
out vec4 vUvRect;
out vec4 vMisc;                      // erode, core, add, seed
out vec4 vFh;                        // fiber depth, edge hardness, crackle, 0
vec4 T(int row, int i) { return texelFetch(uTrail, ivec2(i, row), 0); }
// Catmull-Rom through the control points at s in [0,1] — the EXACT twin of
// world3d.ts's cr()/crTrail() (the t³ sign lesson applies here too).
vec4 cr(int row, float s) {
  float f = clamp(s, 0.0, 1.0) * float(PTS - 1);
  int i1 = min(int(floor(f)), PTS - 1);
  float tt = f - floor(f);
  int i0 = max(i1, 1) - 1;
  int i2 = min(i1 + 1, PTS - 1);
  int i3 = min(i1 + 2, PTS - 1);
  vec4 a = T(row, 13 + i0);
  vec4 b = T(row, 13 + i1);
  vec4 c = T(row, 13 + i2);
  vec4 d = T(row, 13 + i3);
  float t2 = tt * tt;
  float t3 = t2 * tt;
  return 0.5 * (2.0 * b + (c - a) * tt
    + (2.0 * a - 5.0 * b + 4.0 * c - d) * t2
    + (3.0 * b - 3.0 * c + d - a) * t3);
}
void main() {
  int row = gl_InstanceID + uRowBase;
  vec4 p0 = T(row, 0);
  vec4 p1 = T(row, 1);
  vec4 p2 = T(row, 2);
  vec4 uvR = T(row, 4);
  int corner = gl_VertexID % 6;
  int cell = gl_VertexID / 6;
  vec2 o = vec2(float((0x1A >> corner) & 1), float((0x34 >> corner) & 1));
  float s = (float(cell) + o.y) / float(SEGS);             // 0 head → 1 tail
  float across = o.x;
  vec4 p = cr(row, s);
  float k = clamp(p.w, 0.0, 1.0);

  // Tangent by central difference on the SMOOTHED curve.
  float e = 1.0 / float(SEGS);
  vec3 tan3 = cr(row, s + e).xyz - cr(row, s - e).xyz;

  // The afterimage anchor: absolute distance travelled at this vertex.
  float t = uParams.w;
  float dist = p2.x - s * p2.y;

  // Noise flutter — laid down IN PLACE along the path, growing with age.
  vec2 span = uvR.zw - uvR.xy;
  float seed = p1.w;
  float n1 = textureLod(uTex, uvR.xy + fract(vec2(dist * 0.09 - t * 0.05, seed)) * span, 0.0).r - 0.5;
  float n2 = textureLod(uTex, uvR.xy + fract(vec2(dist * 0.09 - t * 0.04, seed + 0.37)) * span, 0.0).r - 0.5;
  vec3 center = p.xyz + (uRight.xyz * n1 + uUp.xyz * n2) * (p1.x * (1.0 - k) * 2.0);

  // Head swell: emerge from INSIDE the emitter (35% width at the very head).
  float halfW = 0.5 * p0.x * mix(1.0, k, p0.w);
  halfW *= 0.35 + 0.65 * smoothstep(0.0, 0.15, s);
  vec3 world;
  if (UP > 0.5) {
    world = center + vec3(0.0, across * 2.0 * halfW, 0.0);
  } else {
    vec3 viewDir = normalize(uCamPos.xyz - center);
    vec3 side = cross(tan3, viewDir);
    float sl = length(side);
    side = sl < 1e-5 ? uRight.xyz : side / sl;
    world = center + side * ((across - 0.5) * 2.0 * halfW);
  }

  // Head→tail 4-stop gradient (8 stored stops), evaluated per vertex.
  float ci = (1.0 - k) * 7.0;
  int i0c = int(clamp(floor(ci), 0.0, 7.0));
  vec4 col = mix(T(row, 5 + i0c), T(row, 5 + min(i0c + 1, 7)), fract(ci));

  vec4 clip = uViewProj * vec4(world, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vSk = vec4(s, k, across, dist);
  vColor = vec4(col.rgb, col.a * p0.y);
  vWorld = world;
  vUvRect = uvR;
  vMisc = vec4(p1.y, p1.z, p0.z, seed);
  vFh = vec4(p2.z, p2.w, T(row, 3).x, 0.0);
}
`;
/** Trail FRAGMENT shader — TRAIL_WGSL's fs, verbatim port: two-gaussian
* width profile, fibre noise, the erode dim/shred blend, white-hot core,
* crackle sparkler, fog. Premultiplied out; add writes alpha 0. */
var buildGlTrailFragGLSL = () => GLSL_FRAG_HEADER + `
in vec4 vSk;
in vec4 vColor;
in vec3 vWorld;
in vec4 vUvRect;
in vec4 vMisc;
in vec4 vFh;
uniform sampler2D uTex;
uniform vec4 uCamPos;
uniform vec4 uFogColor;
uniform vec4 uParams;
out vec4 outColor;
void main() {
  float k = vSk.y;
  float dd = abs(vSk.z - 0.5) * 2.0;                       // 0 centre → 1 edge
  // Soft two-gaussian width profile, blended toward a crisp neon band by
  // the edge-hardness dial (the Tron wall).
  float soft = exp(-dd * dd * 4.0) * smoothstep(1.0, 0.6, dd);
  float body = mix(soft, smoothstep(1.0, 0.85, dd), vFh.y);
  float a = vColor.a * body;
  // ONE anisotropic fibre sample, keyed on absolute travelled distance.
  vec2 span = vUvRect.zw - vUvRect.xy;
  float t = uParams.w;
  float fib = textureLod(uTex, vUvRect.xy + fract(vec2(vSk.w * 0.12 - t * 0.04, vSk.z * 0.4 + vMisc.w)) * span, 0.0).r;
  a *= mix(1.0, mix(0.6, 1.4, smoothstep(0.2, 0.8, fib)), vFh.x);
  // HOW THE TRAIL DIES — dim vs shred, BLENDED by the erode dial.
  float fade = pow(k, 1.4);
  float th = (1.0 - k) * 1.4 + dd * 0.2;
  float gate = smoothstep(th - 0.25, th + 0.25, fib + 0.25);
  a *= mix(fade, gate, vMisc.x);
  // White-hot centre line, strongest at the head.
  vec3 rgb = mix(vColor.rgb, vec3(1.0), vMisc.y * exp(-dd * dd * 18.0) * k);
  // CRACKLE — per-cell phase + staggered time sawtooth (never a tail
  // threshold on the noise; see world3d.ts's two-invisible-versions lesson).
  float ck = textureLod(uTex, vUvRect.xy + fract(vec2(vSk.w * 0.45, vSk.z * 0.9 + vMisc.w)) * span, 0.0).r;
  float pulse = smoothstep(0.87, 0.99, fract(ck * 9.7 + t * 0.5));
  float glint = pulse * vFh.z * body * mix(0.5, 1.0, k);
  rgb += vec3(glint * 2.0);
  a = max(a, min(1.0, glint * 1.6) * vColor.a);
  float add = vMisc.z;
  if (uParams.z > 0.5) {
    float f = smoothstep(uParams.x, uParams.y, distance(uCamPos.xyz, vWorld));
    rgb = mix(rgb, uFogColor.rgb * (1.0 - add), f);       // additive fogs to black
  }
  outColor = vec4(rgb * a, a * (1.0 - add));               // add: alpha 0 = pure additive
}
`;
/** Voxel VERTEX shader — plain (non-instanced) chunk draws. */
var buildGlVoxelVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in float aLayer;
layout(location=3) in float aFace;
layout(location=4) in float aAo;
uniform mat4 uViewProj;
out vec3 vWorld;
out vec2 vUv;
flat out int vLayer;
flat out int vFace;
out float vAo;
void main() {
  vec4 clip = uViewProj * vec4(aPos, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vWorld = aPos;
  vUv = aUv;
  vLayer = int(aLayer + 0.5);
  vFace = int(aFace + 0.5);
  vAo = aAo;
}
`;
/** Voxel FRAGMENT shader — flat daylight tone × per-face factor × AO,
* alpha-cutout (leaves/glass), fogged. VOXEL_WGSL's fs, verbatim. */
var buildGlVoxelFragGLSL = () => GLSL_FRAG_HEADER + `
in vec3 vWorld;
in vec2 vUv;
flat in int vLayer;
flat in int vFace;
in float vAo;
uniform mediump sampler2DArray uAtlas;
uniform vec4 uCamPos;
uniform vec4 uFogColor;              // rgb + ambient
uniform vec4 uParams;
uniform vec4 uAmbSky;
uniform vec4 uAmbGround;
uniform vec4 uSunCol;
out vec4 outColor;
// Fixed per-face brightness (the Minecraft trick — see VOXEL_WGSL):
//                       +X    -X    +Y    -Y    +Z    -Z
const float FACE[6] = float[6](0.82, 0.82, 1.0, 0.58, 0.92, 0.92);
void main() {
  vec4 tex = texture(uAtlas, vec3(vUv, float(vLayer)));
  if (tex.a < 0.5) { discard; }                            // cutout (leaves/glass)
  float day = clamp(uSunCol.w, 0.0, 1.0);
  vec3 tone = mix(uAmbSky.rgb * 0.55, uSunCol.rgb, day) + uAmbGround.rgb * (uFogColor.a * 0.22);
  vec3 rgb = tex.rgb * tone * FACE[vFace] * vAo;
  if (uParams.z > 0.5) {
    float f = smoothstep(uParams.x, uParams.y, distance(uCamPos.xyz, vWorld));
    rgb = mix(rgb, uFogColor.rgb, f);
  }
  outColor = vec4(rgb, 1.0);
}
`;
var WISP_SEGX = 12;
var WISP_SEGY = 40;
var WISP_FLOATS = 20;
var buildGlWispVertGLSL = () => GLSL_HEADER + `
const int SEGX = 12;
const int SEGY = 40;
layout(location=0) in vec4 iPos;      // x, y, z, twist
layout(location=1) in vec4 iSize;     // w, h, speed, wind
layout(location=2) in vec4 iColor;
layout(location=3) in vec4 iUv;       // the noise frame's atlas rect
layout(location=4) in vec4 iMisc;     // remap lo, remap hi, yaw
uniform sampler2D uTex;
uniform mat4 uViewProj;
uniform vec4 uCamPos;
uniform vec4 uParams;                 // fogNear, fogFar, fogOn, TIME
out vec2 vUvn;
out vec4 vColor;
out vec3 vWorld;
out vec4 vUvRect;
out vec3 vWp;                         // lo, hi, t
out float vFace;
void main() {
  int corner = gl_VertexID % 6;
  int cell = gl_VertexID / 6;
  float cx = float(cell % SEGX);
  float cy = float(cell / SEGX);
  vec2 o = vec2(float((0x1A >> corner) & 1), float((0x34 >> corner) & 1));
  float ux = (cx + o.x) / float(SEGX);
  float fy = 1.0 - (cy + o.y) / float(SEGY);               // 0 base → 1 top
  float t = uParams.w * iSize.z;
  vec2 span = iUv.zw - iUv.xy;

  // TRUE Y-axis twist, angle sampled from a drifting noise column.
  float twn = textureLod(uTex, iUv.xy + vec2(0.5, fract(fy * 0.2 - t * 0.03)) * span, 0.0).r;
  float ang = twn * iPos.w;
  vec3 lp = vec3((ux - 0.5) * iSize.x, fy * iSize.y, 0.0);
  float ca = cos(ang); float sa = sin(ang);
  lp = vec3(lp.x * ca - lp.z * sa, lp.y, lp.x * sa + lp.z * ca);

  // Wind: two independent noise channels drive x/z, pinned at the base.
  float wx = textureLod(uTex, iUv.xy + vec2(0.25, fract(t * 0.02)) * span, 0.0).r - 0.5;
  float wz = textureLod(uTex, iUv.xy + vec2(0.75, fract(t * 0.02)) * span, 0.0).r - 0.5;
  lp += vec3(wx, 0.0, wz) * fy * fy * iSize.w;

  // Y-BILLBOARD toward the camera (never seen edge-on); iMisc.z adds yaw.
  vec2 toCam = uCamPos.xz - iPos.xz;
  float yaw = atan(-toCam.x, toCam.y) + iMisc.z;
  float cy2 = cos(yaw); float sy2 = sin(yaw);
  vec3 world = iPos.xyz + vec3(lp.x * cy2 - lp.z * sy2, lp.y, lp.x * sy2 + lp.z * cy2);

  // How face-on the TWISTED surface is (edge-on slices dissolve in the fs).
  vec3 nl = vec3(sa, 0.0, ca);
  vec3 nw = vec3(nl.x * cy2 - nl.z * sy2, 0.0, nl.x * sy2 + nl.z * cy2);
  vec3 vd = normalize(uCamPos.xyz - world);
  float face = abs(dot(nw, vd));

  vec4 clip = uViewProj * vec4(world, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vUvn = vec2(ux, fy);
  vColor = iColor;
  vWorld = world;
  vUvRect = iUv;
  vWp = vec3(iMisc.x, iMisc.y, t);
  vFace = face;
}
`;
var buildGlWispFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vUvn;
in vec4 vColor;
in vec3 vWorld;
in vec4 vUvRect;
in vec3 vWp;
in float vFace;
uniform sampler2D uTex;
uniform vec4 uCamPos;
uniform vec4 uFogColor;
uniform vec4 uParams;
out vec4 outColor;
void main() {
  vec2 span = vUvRect.zw - vUvRect.xy;
  vec2 su = vec2(fract(vUvn.x * 0.5), fract(vUvn.y * 0.3 - vWp.z * 0.09));
  float s = textureLod(uTex, vUvRect.xy + su * span, 0.0).r;
  s = smoothstep(vWp.x, vWp.y, s);
  s *= smoothstep(0.0, 0.1, vUvn.x) * smoothstep(1.0, 0.9, vUvn.x);
  s *= smoothstep(0.0, 0.1, vUvn.y) * smoothstep(1.0, 0.4, vUvn.y);
  s *= mix(0.15, 1.0, smoothstep(0.0, 0.35, vFace));       // edge-on dissolves
  vec3 rgb = vColor.rgb;
  if (uParams.z > 0.5) {
    float f = smoothstep(uParams.x, uParams.y, distance(uCamPos.xyz, vWorld));
    rgb = mix(rgb, uFogColor.rgb, f);
  }
  float a = s * vColor.a;
  outColor = vec4(rgb * a, a);
}
`;
/** Depth-only shadow VERTEX shader (plain or VS-skinned — the same instance
* and vertex layouts as the mesh programs; no fragment work). */
var buildGlShadowVertGLSL = (skinned = false) => GLSL_HEADER + `
layout(location=0) in vec3 aPos;
${skinned ? `layout(location=3) in uvec4 aJoints;
layout(location=4) in vec4 aWeights;
layout(location=5) in float iPalBase;
uniform highp sampler2D uPalette;
mat4 paletteMat(int m) {
  return mat4(
    texelFetch(uPalette, ivec2(0, m), 0),
    texelFetch(uPalette, ivec2(1, m), 0),
    texelFetch(uPalette, ivec2(2, m), 0),
    texelFetch(uPalette, ivec2(3, m), 0));
}
` : ""}layout(location=8) in vec4 iPos;      // xyz + yaw
layout(location=9) in vec4 iSize;     // whd + pitch
layout(location=11) in vec4 iRot;     // roll, ...
uniform mat4 uViewProj;               // the LIGHT's ortho viewProj
${ROTATE_GLSL}
void main() {
${skinned ? `  vec3 sp3 = vec3(0.0);
  int pb = int(iPalBase + 0.5);
  for (int k = 0; k < 4; k++) {
    float wgt = aWeights[k];
    if (wgt > 0.0) { sp3 += wgt * (paletteMat(pb + int(aJoints[k])) * vec4(aPos, 1.0)).xyz; }
  }
  vec3 vpos = sp3;
` : `  vec3 vpos = aPos;
`}  vec3 world = rotate3d(vpos * iSize.xyz, iPos.w, iSize.w, iRot.x) + iPos.xyz;
  vec4 clip = uViewProj * vec4(world, 1.0);
  clip.z = clip.z * 2.0 - clip.w;      // WebGPU z01 → GL z[-1,1]
  gl_Position = clip;
}
`;
/** Depth-only fragment — GLSL requires one; it writes nothing. */
var buildGlShadowFragGLSL = () => GLSL_FRAG_HEADER + `
void main() {}
`;
var FLARE_ELEMS = 8;
var buildGlFlareVertGLSL = () => GLSL_HEADER + `
// Per element: (t along sun->centre axis, size px, type, alpha)
const vec4 EA[8] = vec4[8](
  vec4(0.0, 150.0, 2.0, 0.42),   // anamorphic streak
  vec4(0.0, 52.0, 0.0, 0.75),    // core glow
  vec4(0.0, 105.0, 1.0, 0.2),    // halo ring
  vec4(0.32, 20.0, 3.0, 0.28),   // ghost chain...
  vec4(0.52, 10.0, 3.0, 0.24),
  vec4(0.78, 30.0, 3.0, 0.18),
  vec4(1.22, 46.0, 0.0, 0.14),   // ...through the centre
  vec4(1.55, 16.0, 3.0, 0.2));
const vec4 EC[8] = vec4[8](
  vec4(1.0, 0.95, 0.85, 0.0),
  vec4(1.0, 0.97, 0.9, 0.0),
  vec4(1.0, 0.85, 0.65, 0.0),
  vec4(0.65, 1.0, 0.75, 0.0),
  vec4(0.6, 0.85, 1.0, 0.0),
  vec4(0.85, 0.65, 1.0, 0.0),
  vec4(1.0, 0.8, 0.6, 0.0),
  vec4(0.6, 1.0, 0.95, 0.0));
uniform vec4 uSun;                    // sun ndc x, y, visibility (incl. occlusion)
uniform vec4 uScr;                    // screenW, screenH
uniform vec4 uColor;                  // sun rgb
out vec2 vUv;
out vec4 vColor;
out float vKind;
void main() {
  vec2 corners[6] = vec2[6](
    vec2(-1.0, -1.0), vec2(1.0, -1.0), vec2(-1.0, 1.0),
    vec2(-1.0, 1.0), vec2(1.0, -1.0), vec2(1.0, 1.0));
  vec4 e = EA[gl_InstanceID];
  float vis = uSun.z;
  vec2 c = corners[gl_VertexID];
  vec2 anchor = uSun.xy * (1.0 - e.x);
  vec2 half_ = vec2(e.y / uScr.x * 2.0, e.y / uScr.y * 2.0);
  if (e.z > 1.5 && e.z < 2.5) { half_.x *= 6.0; half_.y *= 0.55; }   // streak
  gl_Position = vec4(anchor + c * half_ * step(0.001, vis), 0.0, 1.0);
  vUv = c;
  vColor = vec4(EC[gl_InstanceID].rgb * uColor.rgb, e.w * vis);
  vKind = e.z;
}
`;
var buildGlFlareFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vUv;
in vec4 vColor;
in float vKind;
out vec4 outColor;
void main() {
  float r = length(vUv);
  float a = 0.0;
  if (vKind < 0.5) {                                       // soft glow disc
    a = pow(smoothstep(1.0, 0.0, r), 2.2);
  } else if (vKind < 1.5) {                                // halo ring
    a = smoothstep(0.16, 0.0, abs(r - 0.7));
  } else if (vKind < 2.5) {                                // anamorphic streak
    a = pow(max(1.0 - abs(vUv.x), 0.0), 1.7) * pow(max(1.0 - abs(vUv.y), 0.0), 2.5);
  } else {                                                 // ghost disc
    a = smoothstep(1.0, 0.45, r) * (0.75 + 0.25 * smoothstep(0.0, 0.4, r));
  }
  float al = a * vColor.a;
  outColor = vec4(vColor.rgb * al, al);
}
`;
/** The sun-occlusion PROBE — a tiny quad at the sun's screen position, at
* FAR depth (z = w: LEQUAL passes only over sky/cleared pixels), drawn with
* colour writes off inside an ANY_SAMPLES_PASSED query. The query's async
* result stands in for the WebGPU original's 3×3 vertex-stage depth taps. */
var buildGlSunProbeVertGLSL = () => GLSL_HEADER + `
uniform vec4 uSunPos;                 // ndc x, y, half w (ndc), half h (ndc)
void main() {
  vec2 c = vec2(float(gl_VertexID & 1) * 2.0 - 1.0, float(gl_VertexID >> 1) * 2.0 - 1.0);
  gl_Position = vec4(uSunPos.xy + c * uSunPos.zw, 1.0, 1.0);
}
`;
var buildGlSunProbeFragGLSL = () => GLSL_FRAG_HEADER + `
out vec4 outColor;
void main() { outColor = vec4(0.0); }
`;
var buildGlFullscreenVertGLSL = () => GLSL_HEADER + `
out vec2 vUv;
void main() {
  vec2 p = vec2(float((gl_VertexID << 1) & 2) * 2.0 - 1.0, float(gl_VertexID & 2) * 2.0 - 1.0);
  gl_Position = vec4(p, 0.0, 1.0);
  vUv = p * 0.5 + 0.5;
}
`;
/** The AO estimate fragment. `taps` bakes ssao.ts's ssaoKernel — pass it in
* so the kernel maths stays single-sourced (world.ts imports ssaoKernel). */
var buildGlSsaoFragGLSL = (taps) => GLSL_FRAG_HEADER + `
uniform mat4 uInvProj;                // camera inverse PROJECTION (view space)
uniform mat4 uProj;
uniform vec4 uParams;                 // radius (view units), strength, power
uniform vec4 uDepthP;                 // projA, projB, far
uniform highp sampler2D uDepth;       // the full-res scene depth COPY
in vec2 vUv;
out vec4 outColor;
const vec2 KERNEL[${taps.length}] = vec2[${taps.length}](
  ${taps.map(([x, y]) => `vec2(${x.toFixed(8)}, ${y.toFixed(8)})`).join(",\n  ")});

vec3 viewPos(vec2 uv, float d) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, d, 1.0);   // d stays in the [0,1] convention
  vec4 p = uInvProj * ndc;
  return p.xyz / p.w;
}

// Deterministic full-res texel + its CENTRE uv — depth and uv must describe
// the SAME point (ssao.ts's banding lesson).
vec4 surfAt(ivec2 c, ivec2 dims, vec2 fdims) {
  ivec2 cc = clamp(c, ivec2(0), dims - 1);
  float d = texelFetch(uDepth, cc, 0).r;
  vec2 tuv = (vec2(cc) + 0.5) / fdims;
  return vec4(viewPos(tuv, d), d);
}

void main() {
  ivec2 dims = textureSize(uDepth, 0);
  vec2 fdims = vec2(dims);
  ivec2 base = ivec2(gl_FragCoord.xy) * 2;   // half-res pixel → full-res texel
  vec4 s0 = surfAt(base, dims, fdims);
  float d = s0.w;
  vec3 P = s0.xyz;

  // View normal from the CLOSER neighbour per axis (silhouette-safe).
  vec3 Pr = surfAt(base + ivec2(2, 0), dims, fdims).xyz;
  vec3 Pl = surfAt(base - ivec2(2, 0), dims, fdims).xyz;
  vec3 Pu = surfAt(base + ivec2(0, 2), dims, fdims).xyz;
  vec3 Pd = surfAt(base - ivec2(0, 2), dims, fdims).xyz;
  vec3 ddx_ = abs(Pr.z - P.z) < abs(Pl.z - P.z) ? Pr - P : P - Pl;
  vec3 ddy_ = abs(Pu.z - P.z) < abs(Pd.z - P.z) ? Pu - P : P - Pd;
  vec3 N = normalize(cross(ddy_, ddx_));
  if (N.z < 0.0) { N = -N; }

  if (d <= 0.0 || d >= 1.0) { outColor = vec4(1.0); return; }   // sky: no AO

  // Interleaved-gradient-noise rotation — load-bearing against banding.
  float ign = fract(52.9829189 * fract(0.06711056 * gl_FragCoord.x + 0.00583715 * gl_FragCoord.y));
  float ang = ign * 6.28318530718;
  float ca = cos(ang);
  float sa = sin(ang);

  vec3 up = abs(N.y) > 0.9 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 T0 = normalize(cross(up, N));
  vec3 B0 = cross(N, T0);
  vec3 T = T0 * ca + B0 * sa;
  vec3 B = B0 * ca - T0 * sa;

  // ALCHEMY estimator: occlusion along the normal (grazing-angle-safe).
  float radius = uParams.x;
  float bias = 0.02 + 0.002 * abs(P.z);
  float occ = 0.0;
  for (int i = 0; i < ${taps.length}; i++) {
    vec2 k = KERNEL[i];
    vec3 S = P + (T * k.x + B * k.y) * radius;
    vec4 sc = uProj * vec4(S, 1.0);
    if (sc.w <= 0.0) { continue; }
    vec2 sndc = sc.xy / sc.w;
    vec2 suv = sndc * 0.5 + 0.5;
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) { continue; }
    vec4 sq = surfAt(ivec2(suv * fdims), dims, fdims);
    if (sq.w <= 0.0 || sq.w >= 1.0) { continue; }
    vec3 v = sq.xyz - P;
    float vv = dot(v, v);
    float vn = dot(v, N);
    occ += max(0.0, vn - bias) * radius / (vv + 0.04 * radius * radius);
  }
  float ao = clamp(1.0 - uParams.y * 2.0 * occ / ${taps.length}.0, 0.0, 1.0);
  float zn = clamp(-P.z / uDepthP.z, 0.0, 1.0);
  outColor = vec4(pow(ao, uParams.z), zn, 0.0, 1.0);
}
`;
/** Bilateral 5-tap cross blur (H then V) — buildSsaoBlurWGSL, verbatim. */
var buildGlSsaoBlurFragGLSL = () => GLSL_FRAG_HEADER + `
uniform vec4 uTexel;                  // xy = one-texel step along the axis
uniform sampler2D uSrc;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 s = uTexel.xy;
  vec4 c0 = texture(uSrc, vUv);
  float acc = c0.r;
  float wsum = 1.0;
  for (int i = -2; i <= 2; i++) {
    if (i == 0) { continue; }
    vec4 t = texture(uSrc, vUv + s * float(i));
    float w = max(0.0, 1.0 - abs(t.g - c0.g) * 24.0);      // depth-similar only
    acc += t.r * w;
    wsum += w;
  }
  outColor = vec4(acc / wsum, c0.g, 0.0, 1.0);
}
`;
/** Multiply-darken composite (blend ZERO, SRC_COLOR in GL state). */
var buildGlSsaoCompositeFragGLSL = () => GLSL_FRAG_HEADER + `
uniform sampler2D uSrc;
in vec2 vUv;
out vec4 outColor;
void main() {
  float ao = texture(uSrc, vUv).r;
  outColor = vec4(ao, ao, ao, 1.0);
}
`;
var buildGlRaysFragGLSL = () => GLSL_FRAG_HEADER + `
uniform vec4 uSun;                    // sun uv (v-up), intensity·strength, decay
uniform vec4 uInfo;                   // halfW, halfH, fullW, fullH
uniform vec4 uColor;                  // sun rgb + aspect
uniform highp sampler2D uDepth;       // full-res scene depth copy
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 sunUV = uSun.xy;
  // March from THIS pixel toward the sun; a sample pours in light only when
  // it is sky AND near the sun (beams, not a wash — rays.ts's lesson).
  const float STEPS = 28.0;
  vec2 delta = (sunUV - vUv) / STEPS;
  vec2 p = vUv;
  float acc = 0.0;
  float w = 1.0;
  float norm = 0.0;
  for (int i = 0; i < 28; i++) {
    p += delta;
    ivec2 px = ivec2(clamp(p, vec2(0.0), vec2(0.9999)) * uInfo.zw);
    float d = texelFetch(uDepth, px, 0).r;
    float sd = length((p - sunUV) * vec2(uColor.w, 1.0));
    acc += step(0.99995, d) * smoothstep(0.42, 0.05, sd) * w;
    norm += w;
    w *= uSun.w;
  }
  float dist = length((vUv - sunUV) * vec2(uColor.w, 1.0));
  float fall = smoothstep(1.05, 0.12, dist);
  outColor = vec4(acc / max(norm, 1e-4) * uSun.z * fall, 0.0, 0.0, 1.0);
}
`;
/** Additive shaft composite (blend ONE, ONE / alpha ZERO, ONE in GL state). */
var buildGlRaysCompositeFragGLSL = () => GLSL_FRAG_HEADER + `
uniform sampler2D uSrc;
uniform vec4 uColor;                  // sun rgb
in vec2 vUv;
out vec4 outColor;
void main() {
  float r = texture(uSrc, vUv).r;
  outColor = vec4(uColor.rgb * r, 0.0);
}
`;
var WATER_WP_DECL = `
uniform vec4 uWP[32];
uniform mat4 uViewProj;
uniform vec4 uCamPos;
uniform vec4 uFogColor;
uniform vec4 uParams;                 // fogNear, fogFar, fogOn, time
uniform vec4 uLightDir;
uniform vec4 uAmbSky;                 // rgb + env strength
uniform vec4 uAmbGround;
uniform vec4 uSunCol;
uniform highp sampler2D uDepth;       // the scene depth COPY (1×1 white when absent)
`;
/** Water VERTEX shader — vsGrid (grid=true) / vsRibbon (grid=false). */
var buildGlWaterVertGLSL = (grid) => GLSL_HEADER + WATER_WP_DECL + `
${grid ? "layout(location=0) in vec2 aGrid;" : `layout(location=0) in vec3 aPos;
layout(location=1) in vec2 aUv;
layout(location=2) in float aSlope;`}
uniform highp sampler2D uGround;      // baked terrain heights (R32F; VS lerps)
out vec3 vWorld;
out vec3 vNormal;
out vec2 vUv;                         // grid: world-scaled ripple uv; ribbon: (arc, across)
out float vCrest;
out float vSlope;
out float vFade;
out float vShoal;
out float vDepthB;                    // baked still-water depth (<0 = no bake)

// Bilinear ground-height read (R32F is unfilterable — lerp by hand).
float groundAt(float wx, float wz) {
  float gs = uWP[6].w;
  float gu = clamp((wx - uWP[0].x) / uWP[0].z + 0.5, 0.0, 1.0) * (gs - 1.0);
  float gv = clamp((wz - uWP[0].y) / uWP[0].w + 0.5, 0.0, 1.0) * (gs - 1.0);
  float fu = floor(gu); float fv = floor(gv);
  float fx = gu - fu; float fy = gv - fv;
  int mxi = int(gs) - 1;
  int ix = int(fu); int iy = int(fv);
  float a = texelFetch(uGround, ivec2(min(ix, mxi), min(iy, mxi)), 0).r;
  float b = texelFetch(uGround, ivec2(min(ix + 1, mxi), min(iy, mxi)), 0).r;
  float c = texelFetch(uGround, ivec2(min(ix, mxi), min(iy + 1, mxi)), 0).r;
  float d = texelFetch(uGround, ivec2(min(ix + 1, mxi), min(iy + 1, mxi)), 0).r;
  return mix(mix(a, b, fx), mix(c, d, fx), fy);
}

void main() {
  float t = uParams.w;
${grid ? `
  // CAMERA-FOLLOWING TESSELLATION (see water3d.ts's essay): the radial warp
  // packs ~3× density into the middle, which follows the camera snapped to
  // the finest cell. Vertex position is pure sampling density.
  vec2 span = vec2(uWP[0].z, uWP[0].w);
  vec2 lo = vec2(uWP[0].x, uWP[0].y) - span * 0.5;
  vec2 hi = vec2(uWP[0].x, uWP[0].y) + span * 0.5;
  float resG = max(uWP[7].y, 32.0);
  vec2 cell0 = span * (0.3 / resG);
  vec2 ctr = floor(clamp(uCamPos.xz, lo, hi) / cell0) * cell0;
  vec2 warped = aGrid * (vec2(0.3) + 2.8 * aGrid * aGrid);
  vec2 pxz = clamp(ctr + warped * span, lo, hi);
  vec3 p = vec3(pxz.x, uWP[1].x, pxz.y);
  vec2 cellV = (vec2(0.3) + 8.4 * aGrid * aGrid) * (span / resG);
  float cellW = max(cellV.x, cellV.y);
  // SHOALING: exact baked depth when a ground fn was passed; the frame's
  // depth-buffer estimate otherwise (occlusion is not shallowness).
  float shoal = 1.0;
  float dry = -1000.0;
  float bakedDepth = -1.0;
  if (uWP[6].w > 0.5) {
    float gnd = groundAt(p.x, p.z);
    bakedDepth = uWP[1].x - gnd;
    float rampW = max(uWP[6].y * 1.2, 1.8);
    float smoothK = smoothstep(6.0, 24.0, cellW);
    float gd = gnd;
    if (smoothK > 0.001 && (uWP[1].x - gnd) < rampW * 2.0) {
      gd = mix(gnd, (gnd
        + groundAt(p.x + cellW, p.z) + groundAt(p.x - cellW, p.z)
        + groundAt(p.x, p.z + cellW) + groundAt(p.x, p.z - cellW)) * 0.2, smoothK);
    }
    float depth = uWP[1].x - gd;
    shoal = smoothstep(0.22, rampW, depth);
    dry = gnd;
  } else {
    vec4 clip0 = uViewProj * vec4(p, 1.0);
    if (clip0.w > 0.01) {
      vec3 ndc = clip0.xyz / clip0.w;          // WebGPU-convention z in [0,1]
      if (abs(ndc.x) < 1.0 && abs(ndc.y) < 1.0 && ndc.z > 0.0 && ndc.z < 1.0) {
        ivec2 px = ivec2((ndc.xy * 0.5 + 0.5) * uWP[5].zw);   // GL v-up, no flip
        float sceneD = texelFetch(uDepth, px, 0).r;
        float sceneZ = uWP[5].y / (uWP[5].x + sceneD);
        float waterZ = uWP[5].y / (uWP[5].x + ndc.z);
        float diff = sceneZ - waterZ;
        if (diff > -6.0) {
          float along = max(diff, 0.0);
          vec3 toCam = uCamPos.xyz - p;
          float vd = along * clamp(abs(toCam.y) / max(length(toCam), 1e-3), 0.06, 1.0);
          shoal = smoothstep(0.05, max(uWP[6].y * 1.2, 1.6), vd + 0.25);
        }
      }
    }
  }
  // HORIZON LOD + the wave sum with the Nyquist guards (verbatim).
  float camD = distance(uCamPos.xyz, p);
  float fade = 1.0 - smoothstep(700.0, 2400.0, camD);
  vec3 nrm = vec3(0.0, 1.0, 0.0);
  float lift = 0.0;
  for (int i = 0; i < 8; i++) {
    vec4 wa = uWP[16 + i * 2];
    vec4 wb = uWP[17 + i * 2];
    if (wa.z < 1e-5) { continue; }
    vec2 d = normalize(vec2(wa.x, wa.y) + vec2(1e-6));
    float k = 6.2831853 / max(wa.w, 1e-3);
    float ph = k * dot(d, vec2(p.x, p.z)) - k * wb.x * t;
    float s = sin(ph); float c = cos(ph);
    float cl = cellW / max(wa.w, 1e-3);
    float rep = 1.0 - smoothstep(0.3, 0.55, cl);
    float srep = 1.0 - smoothstep(0.12, 0.3, cl);
    float amp = wa.z * shoal * fade * rep;
    float sharp = wb.y * srep;
    float q = sharp / (k * wa.z * 6.0);
    p.x += q * amp * d.x * c;
    p.z += q * amp * d.y * c;
    p.y += amp * s;
    lift += amp * s;
    nrm.x -= d.x * amp * k * c;
    nrm.z -= d.y * amp * k * c;
    nrm.y -= sharp * amp * k * s / 6.0;
  }
  // DRY SAND: continuous sink below the waterline (no chunk popping).
  if (dry > -999.0) {
    float above = dry - uWP[1].x;
    if (above > 0.0) {
      p.y = min(p.y, mix(uWP[1].x, dry - 0.6, smoothstep(0.0, 0.6, above)));
    }
  }
  // WATER WELLS: dry oriented boxes (boat hulls), feathered outside.
  for (int wi = 0; wi < 4; wi++) {
    vec4 wA = uWP[8 + wi * 2];
    vec4 wB = uWP[9 + wi * 2];
    if (wB.w < 0.5) { continue; }
    float cy = cos(wA.z); float sy = sin(wA.z);
    vec2 dw = vec2(p.x - wA.x, p.z - wA.y);
    float lx = abs(cy * dw.x - sy * dw.y);
    float lz = abs(sy * dw.x + cy * dw.y);
    float fe = max(wB.z, 1e-3);
    float k2 = (1.0 - smoothstep(wB.x, wB.x + fe, lx)) * (1.0 - smoothstep(wB.y, wB.y + fe, lz));
    p.y = mix(p.y, min(p.y, wA.w), k2);
  }
  vWorld = p;
  vec4 clip = uViewProj * vec4(p, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vNormal = normalize(nrm);
  vUv = p.xz * 0.22;
  vCrest = lift / max(uWP[6].y, 1e-4);
  vSlope = 0.0;
  vFade = fade;
  vShoal = shoal;
  vDepthB = bakedDepth;
` : `
  vec3 p = aPos;
  // A whisper of bob so still sections aren't glass.
  p.y += sin(aUv.x * 1.7 - t * uWP[6].x * 0.8) * 0.03;
  vWorld = p;
  vec4 clip = uViewProj * vec4(p, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vNormal = vec3(0.0, 1.0, 0.0);
  vUv = aUv;
  vCrest = 0.0;
  vSlope = aSlope;
  vFade = 1.0;
  vShoal = 1.0;
  vDepthB = -1.0;
`}}
`;
/** Water FRAGMENT shader — waterWGSL's fs, verbatim port (see the header
* for the WP layout and the orientation rules). */
var buildGlWaterFragGLSL = () => GLSL_FRAG_HEADER + WATER_WP_DECL + `
uniform sampler2D uEnv;               // env equirect (mipped)
uniform float uEnvMips;
uniform sampler2D uRipple;            // baked tileable ripple field (repeat + mips)
uniform sampler2D uFoam;              // camera-following foam stamp (R8, clamp)
uniform vec4 uLights[32];
uniform float uLightCount;
in vec3 vWorld;
in vec3 vNormal;
in vec2 vUv;
in float vCrest;
in float vSlope;
in float vFade;
in float vShoal;
in float vDepthB;
out vec4 outColor;

// Point/spot lights on the surface (clusterWater over the 8-light array —
// world space, same falloff/cone/searchlight-streak maths).
vec3 lightsWater(vec3 world, vec3 n, vec3 v, vec3 base) {
  vec3 sum = vec3(0.0);
  int nl = int(uLightCount + 0.5);
  for (int i = 0; i < 8; i++) {
    if (i >= nl) { break; }
    vec4 l0 = uLights[i * 4];
    vec4 l1 = uLights[i * 4 + 1];
    vec3 toL = l0.xyz - world;
    float dist = length(toL);
    if (dist >= l0.w) { continue; }
    vec3 ld = toL / max(dist, 1e-4);
    float dr = dist / l0.w;
    float atten = 1.0 - dr * dr * dr * dr;
    atten = atten * atten / (dist * dist + 1.0);
    if (l1.w > 0.5) {
      vec4 l2 = uLights[i * 4 + 2];
      vec4 l3 = uLights[i * 4 + 3];
      atten *= smoothstep(l2.w, l3.x, dot(-ld, l2.xyz));
    }
    float ndl = max(dot(n, ld), 0.0);
    vec3 hv = normalize(ld + v);
    float spec = pow(max(dot(n, hv), 0.0), 260.0) * 3.0;
    sum += l1.rgb * atten * (base * ndl + vec3(spec));
  }
  return sum;
}

vec4 ripTap(vec2 p, float bias) {
  return texture(uRipple, p * 0.0625, bias);   // p / RIPPLE_TILE
}

void main() {
  float t = uParams.w;
  bool ribbon = uWP[4].w > 0.5;
  if (uWP[7].x > 0.5 && uWP[7].x < 1.5) {
    outColor = vec4(mix(vec3(0.9, 0.1, 0.1), vec3(0.1, 0.8, 0.2), vShoal), 1.0);
    return;
  }

  // Detail ripple normals: two counter-scrolled fields of the baked gradient.
  vec2 ruv = vUv;
  vec2 flowT = vec2(t * 0.06, t * 0.045);
  if (ribbon) {
    ruv = vec2(vUv.x * 0.55 - t * uWP[6].x * 0.6, vUv.y * 2.6);
    flowT = vec2(0.0);
  }
  float rip = uWP[1].z * (0.25 + 0.75 * vFade);
  vec4 rT0 = ripTap(ruv + flowT, -1.0);
  vec4 rT1 = ripTap(ruv * 1.7 - flowT * 1.3 + vec2(51.0), -1.0);
  vec2 dn = (rT0.rg - 0.5) * 0.8
          + (rT1.rg - 0.5) * 0.8 * smoothstep(0.3, 0.45, vFade);
  dn *= smoothstep(0.0, 0.06, vFade);
  float foamN = ripTap(vUv * 5.0 + vec2(t * 0.14, -t * 0.1), 0.0).b;
  float streakN = ripTap(vec2(vUv.x * 0.8 - t * uWP[6].x * 0.85, vUv.y * 5.0), 0.0).b;
  float glintK = 1.0 / (1.0 + dot(fwidth(ruv), vec2(1.0)) * 3.0);
  vec3 gN = vNormal;
  gN.y = max(gN.y, 0.35);
  vec3 n = normalize(gN + vec3(dn.x * rip * 2.2, 0.0, dn.y * rip * 2.2));

  // ── SURFACE FROM BELOW — Snell's window (see water3d.ts's saga notes).
  if (!ribbon && uCamPos.y < uWP[1].x) {
    vec3 vb = normalize(uCamPos.xyz - vWorld);
    float nvb = dot(n, vb);
    vec2 fuvU = (vWorld.xz - vec2(uWP[7].z, uWP[7].w)) / 360.0 + 0.5;
    float inbU = step(0.0, fuvU.x) * step(fuvU.x, 1.0) * step(0.0, fuvU.y) * step(fuvU.y, 1.0);
    float foamU = smoothstep(0.05, 0.8, textureLod(uFoam, fuvU, 0.0).r * inbU);
    float ci = clamp(-nvb, 0.0, 1.0);
    vec3 r = refract(-vb, -n, 1.333);
    float ripC = textureLod(uRipple, (ruv + flowT) * 0.0625, 1.5).b;
    vec3 bright = sqrt(uFogColor.rgb);
    vec3 mirror = bright * (0.68 + 0.75 * ripC);
    float sinT = 1.333 * sqrt(max(1.0 - ci * ci, 0.0));
    float windowK = smoothstep(1.12, 0.8, sinT);
    float skyLum = 0.35;
    if (dot(r, r) >= 1e-5) {
      vec3 rr = normalize(r);
      rr.y = max(rr.y, 0.3);
      float eu = atan(rr.x, rr.z) / 6.28318530718 + 0.5;
      float ev = 0.5 - asin(clamp(rr.y, -1.0, 1.0)) / 3.14159265;
      vec3 sky = textureLod(uEnv, vec2(eu, ev), 3.0).rgb;
      skyLum = dot(sky, vec3(0.3, 0.55, 0.15));
    }
    vec3 col = mirror * (1.0 + windowK * (0.25 + 0.9 * skyLum));
    vec3 hv2 = normalize(vb - uLightDir.xyz);
    col += uSunCol.rgb * uSunCol.w * pow(max(dot(-n, hv2), 0.0), 48.0) * 0.5;
    col = mix(col, uFogColor.rgb, 0.18);
    col *= 0.82 + 0.38 * ripC;
    ivec2 udims = textureSize(uDepth, 0);
    ivec2 upx = clamp(ivec2(gl_FragCoord.xy), ivec2(0), udims - 1);
    float behind = texelFetch(uDepth, upx, 0).r;
    float ab = 0.95;
    if (behind < 0.99999) {
      ab = mix(0.95, 0.4, windowK);
      ab = clamp(ab + (ripC - 0.5) * 0.3, 0.35, 0.98);
    }
    col = mix(col, vec3(0.92, 0.96, 0.97), foamU * 0.75);
    ab = max(ab, foamU * 0.95);
    if (uParams.z > 0.5) {
      float fb = smoothstep(uParams.x, uParams.y, distance(uCamPos.xyz, vWorld));
      col = mix(col, uFogColor.rgb, fb);
    }
    outColor = vec4(col * ab, ab);
    return;
  }
  if (uWP[7].x > 1.5 && uWP[7].x < 2.5) { outColor = vec4(0.1, 0.8, 0.2, 1.0); return; }

  // ── Scene thickness from the depth copy (soft shoreline). GL depth ==
  // the engine's z01 (the z remap), so the linearisation is unchanged.
  ivec2 px = ivec2(gl_FragCoord.xy);
  float sceneD = texelFetch(uDepth, px, 0).r;
  float sceneZ = uWP[5].y / (uWP[5].x + sceneD);
  float waterZ = uWP[5].y / (uWP[5].x + gl_FragCoord.z);
  float thickView = max(sceneZ - waterZ, 0.0);
  float thick = thickView;
  if (vDepthB >= 0.0) {
    float thickBaked = max(vWorld.y - (uWP[1].x - vDepthB), 0.0);
    thick = mix(thickBaked, thickView, glintK);
  }

  // ── Base colour + opacity by optical depth.
  float absorb = uWP[1].w;
  float depthK = 1.0 - exp(-thick * absorb);
  vec3 base = mix(uWP[2].rgb, uWP[3].rgb, depthK);
  float alpha = mix(0.3, uWP[1].y, 1.0 - exp(-thick * absorb * 1.7));
  float edge = smoothstep(0.0, 0.45, thick);
  if (ribbon) {
    base = mix(uWP[2].rgb, uWP[3].rgb, 0.45);
    alpha = uWP[1].y * (0.55 + 0.45 * vSlope);
    alpha *= smoothstep(0.0, 0.16, vUv.y) * smoothstep(1.0, 0.84, vUv.y);
  }
  if (uWP[7].x > 2.5 && uWP[7].x < 3.5) { outColor = vec4(base, 1.0); return; }

  // ── Lighting: ambient + sun + env fresnel + glint (far-field ripple
  // normal for the razor terms — the teeth saga's final fix, verbatim).
  vec3 v = normalize(uCamPos.xyz - vWorld);
  vec4 farT = ripTap(vWorld.xz * 0.021 + flowT * 2.0, 0.0);
  vec3 farN = normalize(vec3((farT.r - 0.5) * 1.1, 1.0, (farT.g - 0.5) * 1.1));
  vec3 nS = normalize(mix(farN, n, glintK * glintK));
  float NV = max(dot(nS, v), 1e-3);
  vec3 ambient = mix(uAmbGround.rgb, uAmbSky.rgb, 0.85) * uFogColor.a;
  vec3 rgb = base * (ambient + uSunCol.rgb * uSunCol.w * max(dot(nS, -uLightDir.xyz), 0.0) * 0.55);
  if (uAmbSky.w > 0.001) {
    vec3 R = reflect(-v, nS);
    R.y = max(R.y, 0.035);                     // water reflects SKY, never ground
    float eu = atan(R.x, R.z) / 6.28318530718 + 0.5;
    float ev = 0.5 - asin(clamp(R.y, -1.0, 1.0)) / 3.14159265;
    vec3 env = textureLod(uEnv, vec2(eu, ev), 1.0).rgb;
    float F = 0.02 + 0.98 * pow(1.0 - NV, 5.0);
    rgb = mix(rgb, env * uAmbSky.w, clamp(F * 2.4, 0.0, 0.75));
    alpha = min(alpha + F * 0.5, 1.0);
  }
  vec3 hv = normalize(v - uLightDir.xyz);
  rgb += uSunCol.rgb * uSunCol.w * pow(max(dot(nS, hv), 0.0), 340.0) * 2.4 * glintK;
  rgb += lightsWater(vWorld, n, v, base);
  if (uWP[7].x > 3.5 && uWP[7].x < 4.5) { outColor = vec4(rgb, 1.0); return; }

  // ── Foam: shore band, footprint-faded whitecaps, marching surf, hull stamp.
  float foam = 0.0;
  if (!ribbon && vFade > 0.04) {
    float fw = uWP[2].w;
    float shore = 1.0 - smoothstep(0.0, fw, thick + (foamN - 0.5) * fw * 0.9);
    float crest = smoothstep(uWP[3].w, uWP[3].w + 0.35, vCrest) * smoothstep(0.45, 0.72, foamN) * uWP[6].z * glintK;
    float surfLen = fw * 2.8;
    float sd = vDepthB >= 0.0 ? max(vDepthB, 0.0) : thick;
    float surf = 0.0;
    if (sd < surfLen * 2.4) {
      float ph = fract(sd / surfLen + t * 0.2 + (foamN - 0.5) * 0.35);
      float band = smoothstep(0.8, 0.94, ph) * smoothstep(1.0, 0.97, ph);
      surf = band * smoothstep(0.42, 0.68, foamN)
        * (1.0 - sd / (surfLen * 2.4))
        * (0.3 + 0.7 * uWP[6].z) * 0.85;
    }
    foam = max(max(shore * 0.9, crest * 0.8), surf);
    vec2 fuvL = (vWorld.xz - vec2(uWP[7].z, uWP[7].w)) / 360.0 + 0.5;
    float inb = step(0.0, fuvL.x) * step(fuvL.x, 1.0) * step(0.0, fuvL.y) * step(fuvL.y, 1.0);
    float stampF = textureLod(uFoam, fuvL, 0.0).r * inb;
    foam = max(foam, smoothstep(0.05, 0.85, stampF) * (0.35 + 0.65 * smoothstep(0.28, 0.6, foamN + stampF * 0.25)));
  } else if (ribbon) {
    float edges = 1.0 - smoothstep(0.05, 0.3, min(vUv.y, 1.0 - vUv.y));
    foam = clamp(vSlope * 1.6 * smoothstep(0.3, 0.75, streakN) + edges * 0.4 * smoothstep(0.4, 0.7, streakN), 0.0, 1.0);
  }
  rgb = mix(rgb, uWP[4].rgb * (0.35 + ambient * 0.9 + uSunCol.w * 0.5), foam);
  alpha = max(alpha, foam * 0.9);
  if (uWP[7].x > 4.5 && uWP[7].x < 5.5) { outColor = vec4(rgb, 1.0); return; }
  if (!ribbon) { alpha *= edge; }               // the seam dissolve, LAST

  if (uParams.z > 0.5) {
    float f = smoothstep(uParams.x, uParams.y, distance(uCamPos.xyz, vWorld));
    rgb = mix(rgb, uFogColor.rgb, f);
  }
  outColor = vec4(rgb * alpha, alpha);
}
`;
/** Decay + diffuse fragment (fullscreen — pair with buildGlFullscreenVertGLSL). */
var buildGlFoamDecayFragGLSL = () => GLSL_FRAG_HEADER + `
uniform vec4 uShift;                  // uv shift.xy, decay factor, texel size
uniform sampler2D uSrc;
in vec2 vUv;
out vec4 outColor;
void main() {
  vec2 uv = vUv + uShift.xy;
  float o = uShift.w * 2.6;
  float v = textureLod(uSrc, uv, 0.0).r * 0.44
    + (textureLod(uSrc, uv + vec2(o, 0.0), 0.0).r
     + textureLod(uSrc, uv - vec2(o, 0.0), 0.0).r
     + textureLod(uSrc, uv + vec2(0.0, o), 0.0).r
     + textureLod(uSrc, uv - vec2(0.0, o), 0.0).r) * 0.14;
  float inb = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  outColor = vec4(v * uShift.z * inb, 0.0, 0.0, 1.0);
}
`;
/** Well-stamp vertex/fragment — one soft ellipse per well, additive. */
var buildGlFoamStampVertGLSL = () => GLSL_HEADER + `
uniform vec4 uStamps[8];              // 4 stamps ×2: (u, v, yaw, inten), (halfU, halfV, 0, 0)
out vec2 vLocal;
out float vInten;
void main() {
  vec4 a = uStamps[gl_InstanceID * 2];
  vec4 b = uStamps[gl_InstanceID * 2 + 1];
  vec2 corners[6] = vec2[6](
    vec2(-1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, -1.0),
    vec2(1.0, -1.0), vec2(-1.0, 1.0), vec2(1.0, 1.0));
  vec2 corner = corners[gl_VertexID];
  float cy = cos(a.z); float sy = sin(a.z);
  vec2 ext = corner * vec2(b.x, b.y);
  vec2 uv = vec2(a.x + cy * ext.x + sy * ext.y, a.y - sy * ext.x + cy * ext.y);
  gl_Position = vec4(uv * 2.0 - 1.0, 0.0, 1.0);
  vLocal = corner;
  vInten = a.w;
}
`;
var buildGlFoamStampFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vLocal;
in float vInten;
out vec4 outColor;
void main() {
  float d = length(vLocal);
  outColor = vec4(smoothstep(1.0, 0.5, d) * vInten, 0.0, 0.0, 1.0);
}
`;
var UW_COMMON = `
uniform mat4 uInvVP;
uniform vec4 uCam;                    // xyz camera, w = on (0/1)
uniform vec4 uSigma;                  // rgb view extinction, w = surfaceY
uniform vec4 uSunSigma;               // rgb downwelling, w = fullUnder (0..1)
uniform vec4 uWater;                  // rgb murk colour, w = grade
uniform vec4 uScreen;                 // feather, meniscus, vignette, wobble
uniform highp sampler2D uDepth;       // the scene depth copy
in vec2 vUv;
out vec4 outColor;

vec3 worldAt(vec2 uv, float d) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, d, 1.0);
  vec4 w = uInvVP * ndc;
  return w.xyz / w.w;
}

// terms() — underwaterWGSL verbatim: reconstruction, the clamped underwater
// ray span, transmittances, the RAY-BASED waterline mask + meniscus.
vec4 termsA(out vec3 transmit, out vec3 inscat) {
  ivec2 dims = textureSize(uDepth, 0);
  ivec2 px = clamp(ivec2(vUv * vec2(dims)), ivec2(0), dims - 1);
  float d = texelFetch(uDepth, px, 0).r;
  vec3 world = worldAt(vUv, d);
  float viewDist = max(distance(uCam.xyz, world), 1e-4);
  vec3 rayDir = (world - uCam.xyz) / viewDist;
  float wDist = viewDist;
  if (rayDir.y > 1e-4) {
    wDist = min(wDist, max(uSigma.w - uCam.y, 0.0) / rayDir.y);
  }
  vec3 hit = uCam.xyz + rayDir * wDist;
  float pd = max(0.0, uSigma.w - hit.y);
  vec3 sunTint = exp(-uSunSigma.rgb * pd);
  vec3 viewTrans = exp(-uSigma.rgb * wDist);
  float r = length((vUv - vec2(0.5, 0.44)) * vec2(1.15, 1.0));
  float vig = 1.0 - uScreen.z * smoothstep(0.28, 0.85, r);
  transmit = sunTint * viewTrans * vig;
  inscat = uWater.rgb * (1.0 - viewTrans);
  float rayY = uCam.y + rayDir.y * 0.35;
  float below = smoothstep(-0.08, 0.08, uSigma.w - rayY);
  below = max(below, uSunSigma.w);
  float men = smoothstep(0.16, 0.0, abs(uSigma.w - rayY));
  return vec4(below * uCam.w, men * uScreen.y * (1.0 - uSunSigma.w) * uCam.w, 0.0, 0.0);
}
`;
/** MULTIPLY draw: out = dst * mix(1, transmit, below). Blend ZERO/SRC_COLOR. */
var buildGlUnderwaterMulFragGLSL = () => GLSL_FRAG_HEADER + UW_COMMON + `
void main() {
  vec3 transmit; vec3 inscat;
  vec4 t = termsA(transmit, inscat);
  vec3 m = mix(vec3(1.0), transmit, t.x);
  outColor = vec4(m, 1.0);
}
`;
/** ADD draw: in-scatter + meniscus + the blurred shaft target. Blend ONE/ONE. */
var buildGlUnderwaterAddFragGLSL = () => GLSL_FRAG_HEADER + UW_COMMON + `
uniform sampler2D uShaft;             // half-res billboard shaft target (clamp+linear)
void main() {
  vec3 transmit; vec3 inscat;
  vec4 t = termsA(transmit, inscat);
  vec3 add = inscat * t.x + uWater.rgb * (t.y * 0.6) + vec3(t.y * 0.25);
  // 9-tap bilinear blur of the half-res shafts (~7×7 full-res kernel).
  vec2 ts = 1.0 / vec2(textureSize(uShaft, 0));
  float sh = textureLod(uShaft, vUv, 0.0).r * 0.2;
  sh += textureLod(uShaft, vUv + vec2(1.5 * ts.x, 0.5 * ts.y), 0.0).r * 0.1;
  sh += textureLod(uShaft, vUv + vec2(-1.5 * ts.x, -0.5 * ts.y), 0.0).r * 0.1;
  sh += textureLod(uShaft, vUv + vec2(-0.5 * ts.x, 1.5 * ts.y), 0.0).r * 0.1;
  sh += textureLod(uShaft, vUv + vec2(0.5 * ts.x, -1.5 * ts.y), 0.0).r * 0.1;
  sh += textureLod(uShaft, vUv + vec2(2.5 * ts.x, -1.5 * ts.y), 0.0).r * 0.1;
  sh += textureLod(uShaft, vUv + vec2(-2.5 * ts.x, 1.5 * ts.y), 0.0).r * 0.1;
  sh += textureLod(uShaft, vUv + vec2(1.5 * ts.x, 2.5 * ts.y), 0.0).r * 0.1;
  sh += textureLod(uShaft, vUv + vec2(-1.5 * ts.x, -2.5 * ts.y), 0.0).r * 0.1;
  vec3 shaftCol = mix(vec3(1.0), uWater.rgb, 0.45);
  add += shaftCol * sh;
  outColor = vec4(add, 0.0);
}
`;
/** Billboard SHAFT shaders — shaftBillWGSL: a ring of world-anchored beams,
* cylindrical-billboarded down the refracted sun, piano-keys flicker, soft
* depth occlusion. Instance = 2 vec4 attributes: (baseX, baseZ, length,
* width) | (phase, brightness, flickerSpeed, 0). Additive into R8. */
var buildGlShaftVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iP0;       // baseX, baseZ, length, width
layout(location=1) in vec4 iP1;       // phase, brightness, flickerSpeed, 0
uniform mat4 uViewProj;
uniform vec4 uCam;
uniform vec4 uSun;                    // xyz refracted sun-DOWN dir, w = intensity
uniform vec4 uSunCol;                 // rgb (unused — composite tints), w = time
uniform vec4 uParm;                   // level, band, sunSigma, depthCap
uniform vec4 uFade;                   // nearStart, softK, farFade, flicker
out vec2 vUv;
out vec3 vWorld;
out float vBright;
void main() {
  vec2 corners[6] = vec2[6](
    vec2(0.0, 0.0), vec2(1.0, 0.0), vec2(0.0, 1.0),
    vec2(0.0, 1.0), vec2(1.0, 0.0), vec2(1.0, 1.0));
  vec2 uv = corners[gl_VertexID];
  vec3 base = vec3(iP0.x, uParm.x - uParm.y, iP0.y);
  vec3 axis = normalize(uSun.xyz + vec3(0.0, -1e-3, 0.0));
  vec3 toCam = uCam.xyz - base;
  vec3 right = cross(axis, toCam);
  float rl = length(right);
  right = rl > 1e-4 ? right / rl : vec3(1.0, 0.0, 0.0);
  float along = uv.y * iP0.z;
  float widen = 1.0 - uv.y * 0.35;
  vec3 world = base + axis * along + right * (uv.x - 0.5) * iP0.w * widen;
  float time = uSunCol.w;
  float flick = clamp(uFade.w, 0.0, 2.0);
  float spd = max(iP1.z, 0.3) * (0.7 + 0.3 * flick);
  float t2 = time * spd;
  float raw = smoothstep(-0.35, 0.65, sin(t2 + iP1.x) + 0.55 * sin(t2 * 0.63 + iP1.x * 2.1));
  float pulse = mix(1.0, raw, min(flick, 1.0));
  vec4 clip = uViewProj * vec4(world, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vUv = uv;
  vWorld = world;
  vBright = iP1.y * pulse;
}
`;
var buildGlShaftFragGLSL = () => GLSL_FRAG_HEADER + `
uniform mat4 uInvVP;
uniform vec4 uCam;
uniform vec4 uSun;
uniform vec4 uParm;                   // level, band, sunSigma, depthCap
uniform vec4 uFade;                   // nearStart, softK, farFade, flicker
uniform highp sampler2D uDepth;       // full-res scene depth copy
in vec2 vUv;
in vec3 vWorld;
in float vBright;
out vec4 outColor;
vec3 worldAt(vec2 uv, float d) {
  vec4 ndc = vec4(uv * 2.0 - 1.0, d, 1.0);
  vec4 w = uInvVP * ndc;
  return w.xyz / w.w;
}
void main() {
  float level = uParm.x;
  float sunSig = uParm.z;
  float cap = uParm.w;
  float edge = smoothstep(0.5, 0.1, abs(vUv.x - 0.5));
  float lenF = smoothstep(0.0, 0.1, vUv.y) * (1.0 - smoothstep(0.5, 1.0, vUv.y));
  float depthBelow = max(level - vWorld.y, 0.0);
  float beer = exp(-sunSig * depthBelow);
  float capF = 1.0 - smoothstep(cap * 0.55, cap, depthBelow);
  // Soft depth occlusion: half-res fragcoord ×2 = full-res depth texel.
  ivec2 dims = textureSize(uDepth, 0);
  ivec2 px = clamp(ivec2(gl_FragCoord.xy * 2.0), ivec2(0), dims - 1);
  float sceneD = texelFetch(uDepth, px, 0).r;
  vec3 sceneW = worldAt(gl_FragCoord.xy * 2.0 / vec2(dims), sceneD);
  float fragDist = distance(uCam.xyz, vWorld);
  float sceneDist = distance(uCam.xyz, sceneW);
  float softZ = smoothstep(0.0, uFade.y, sceneDist - fragDist);
  float nearF = smoothstep(uFade.x, uFade.x + 24.0, fragDist);
  float farF = 1.0 - smoothstep(uFade.z * 0.75, uFade.z, distance(uCam.xz, vWorld.xz));
  float a = 0.5 * edge * lenF * beer * capF * softZ * nearF * farF * vBright * uSun.w;
  outColor = vec4(a, 0.0, 0.0, 1.0);
}
`;
var GRASS_SEG = 4;
var GRASS_BLADE_VERTS = 10;
var GRASS_BLADE_FLOATS = 12;
var buildGlGrassVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iPosH;     // base xyz + height
layout(location=1) in vec4 iDir;      // facing.xy, bend, width
layout(location=2) in vec4 iCol;      // rgb + wind phase
uniform mat4 uViewProj;
uniform vec4 uParams;                 // fogNear, fogFar, fogOn, time
uniform vec4 uWind;                   // dirX, dirZ, strength, dryness
out vec3 vNormal;
out vec3 vWorld;
out vec3 vColor;
out float vT;
void main() {
  vec3 base = iPosH.xyz;
  float height = iPosH.w;
  vec2 facing = iDir.xy;
  float bend = iDir.z;
  float width = iDir.w;
  float phase = iCol.w;
  int seg = gl_VertexID / 2;
  float side = float(gl_VertexID % 2) * 2.0 - 1.0;
  float t = float(seg) / 4.0;
  // Wind: a coherent gust wave + per-blade flutter (grass3d verbatim; the
  // original packs time in camPos.w — here it rides uParams.w).
  float time = uParams.w;
  float travel = sin(dot(base.xz, uWind.xy) * 0.35 - time * 1.3);
  float flutter = sin(time * 2.4 + phase);
  float sway = (travel * 0.75 + flutter * 0.25) * uWind.z;
  float lean = bend + sway * 0.3;
  float fwd = lean * t * t;
  float y = height * (t - 0.12 * t * t);
  vec3 sideDir = vec3(-facing.y, 0.0, facing.x);
  float taper = width * (1.0 - t * 0.85);
  vec3 center = base + vec3(facing.x * fwd, y, facing.y * fwd);
  vec3 world = center + sideDir * taper * side;
  vec3 tangent = normalize(vec3(facing.x * (2.0 * lean * t), height * (1.0 - 0.24 * t) + 1e-3, facing.y * (2.0 * lean * t)));
  vec3 nrm = normalize(cross(sideDir, tangent));
  nrm = normalize(nrm + sideDir * side * 0.4);
  vec4 clip = uViewProj * vec4(world, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vNormal = nrm;
  vWorld = world;
  vColor = iCol.rgb;
  vT = t;
}
`;
var buildGlGrassFragGLSL = () => GLSL_FRAG_HEADER + `
in vec3 vNormal;
in vec3 vWorld;
in vec3 vColor;
in float vT;
uniform vec4 uCamPos;
uniform vec4 uFogColor;               // rgb + ambient
uniform vec4 uParams;
uniform vec4 uLightDir;
uniform vec4 uAmbSky;
uniform vec4 uAmbGround;
uniform vec4 uSunCol;
uniform vec4 uWind;                   // w = dryness
out vec4 outColor;
void main() {
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uCamPos.xyz - vWorld);
  if (dot(n, v) < 0.0) { n = -n; }               // double-sided
  // Root→tip gradient with the lifted root (no soil-shadow stubble).
  vec3 root = vColor * 0.70;
  vec3 tip = vColor * 1.18 * vec3(1.04, 1.06, 0.82);
  vec3 albedo = mix(root, tip, vT * vT);
  float dluma = dot(albedo, vec3(0.3333));
  albedo = mix(albedo, dluma * vec3(1.35, 1.12, 0.5), uWind.w);   // straw dryness
  // Sky-biased high-floor ambient; NO shadow map on grass (grass3d's rule).
  vec3 ambient = mix(uAmbGround.rgb, uAmbSky.rgb, n.y * 0.35 + 0.65) * uFogColor.a;
  // Wrapped diffuse on a mostly-UP normal — thin translucent blades never
  // hit NL = 0 (the roaming-black-spots lesson, verbatim).
  vec3 nLit = normalize(mix(n, vec3(0.0, 1.0, 0.0), 0.65));
  float nl = clamp((dot(nLit, -uLightDir.xyz) + 0.5) / 1.5, 0.0, 1.0);
  vec3 rgb = albedo * ambient + albedo * uSunCol.rgb * uSunCol.w * nl;
  // Translucency glow: back-lit blades pass a little sun through.
  float trans = pow(max(dot(-v, -uLightDir.xyz), 0.0), 2.0) * vT;
  rgb += albedo * uSunCol.rgb * uSunCol.w * trans * 0.5;
  if (uParams.z > 0.5) {
    float f = smoothstep(uParams.x, uParams.y, distance(uCamPos.xyz, vWorld));
    rgb = mix(rgb, uFogColor.rgb, f);
  }
  outColor = vec4(rgb, 1.0);
}
`;
var PATCH_COMMON = `
uniform vec4 uPU[5];
uniform mat4 uViewProj;
uniform vec4 uCamPos;
uniform vec4 uFogColor;
uniform vec4 uParams;
uniform vec4 uLightDir;
uniform vec4 uAmbSky;
uniform vec4 uAmbGround;
uniform vec4 uSunCol;
uniform highp sampler2D uBase;        // base heightfield (res+1)² R32F
uniform highp sampler2D uDeform;      // carve window R32F

// TRIANGLE-EXACT heightfield read (the shimmering-disc lesson).
float baseHeightAt(float wx, float wz) {
  float res = uPU[2].y;
  vec2 g = clamp(vec2(wx / uPU[2].x + 0.5, wz / uPU[2].x + 0.5), vec2(0.0), vec2(1.0)) * res;
  vec2 g0 = min(floor(g), vec2(res - 1.0));
  vec2 f = g - g0;
  int hi = int(res);
  int x0 = clamp(int(g0.x), 0, hi); int x1 = clamp(int(g0.x) + 1, 0, hi);
  int z0 = clamp(int(g0.y), 0, hi); int z1 = clamp(int(g0.y) + 1, 0, hi);
  float a = texelFetch(uBase, ivec2(x0, z0), 0).r;
  float b = texelFetch(uBase, ivec2(x1, z0), 0).r;
  float c = texelFetch(uBase, ivec2(x0, z1), 0).r;
  float dd = texelFetch(uBase, ivec2(x1, z1), 0).r;
  if (f.x + f.y <= 1.0) { return a + (b - a) * f.x + (c - a) * f.y; }
  return dd + (c - dd) * (1.0 - f.x) + (b - dd) * (1.0 - f.y);
}
float carveAt(float wx, float wz) {
  float uu = (wx - uPU[1].x) * uPU[1].z + 0.5;
  float vv = (wz - uPU[1].y) * uPU[1].z + 0.5;
  float edge = min(min(uu, 1.0 - uu), min(vv, 1.0 - vv));
  if (edge <= 0.0) { return 0.0; }
  vec2 g = vec2(uu, vv) * uPU[1].w - 0.5;
  vec2 g0 = floor(g); vec2 f = g - g0;
  int hi = int(uPU[1].w) - 1;
  int x0 = clamp(int(g0.x), 0, hi); int x1 = clamp(int(g0.x) + 1, 0, hi);
  int z0 = clamp(int(g0.y), 0, hi); int z1 = clamp(int(g0.y) + 1, 0, hi);
  float a = texelFetch(uDeform, ivec2(x0, z0), 0).r;
  float b = texelFetch(uDeform, ivec2(x1, z0), 0).r;
  float c = texelFetch(uDeform, ivec2(x0, z1), 0).r;
  float e = texelFetch(uDeform, ivec2(x1, z1), 0).r;
  return mix(mix(a, b, f.x), mix(c, e, f.x), f.y) * smoothstep(0.0, 0.06, edge);
}
// Base − carve + BERM lips, blending to the base pipeline's sink cap toward
// the cut circle so the boundary crossing lines up exactly.
float surfAt(float wx, float wz) {
  float c = carveAt(wx, wz);
  float s = c / max(uPU[2].w, 1e-4);
  float berm = uPU[4].y * smoothstep(0.02, 0.2, s) * (1.0 - smoothstep(0.2, 0.6, s));
  float r = distance(vec2(wx, wz), uPU[0].xy) / max(uPU[2].z, 1e-3);
  float k = smoothstep(0.75, 0.98, r);
  return baseHeightAt(wx, wz) - mix(c, min(c, uPU[4].w), k) + berm * (1.0 - k);
}
`;
var buildGlDeformPatchVertGLSL = () => GLSL_HEADER + PATCH_COMMON + `
layout(location=0) in vec3 aPos;
layout(location=1) in vec3 aNorm;
layout(location=2) in vec2 aUv;
out vec3 vWorld;
out vec3 vNormal;
out float vCarve;
void main() {
  float wx = aPos.x * uPU[0].z + uPU[0].x;
  float wz = aPos.z * uPU[0].z + uPU[0].y;
  // Analytic normal from 4 displaced neighbours ~1.5 cells out (verbatim).
  float e = uPU[0].z / uPU[0].w * 1.5;
  float hL = surfAt(wx - e, wz); float hR = surfAt(wx + e, wz);
  float hD = surfAt(wx, wz - e); float hU = surfAt(wx, wz + e);
  vec3 world = vec3(wx, surfAt(wx, wz), wz);
  vec4 clip = uViewProj * vec4(world, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vWorld = world;
  vNormal = normalize(vec3(hL - hR, 2.0 * e, hD - hU));
  vCarve = carveAt(wx, wz);
}
`;
var buildGlDeformPatchFragGLSL = () => GLSL_FRAG_HEADER + PATCH_COMMON + `
uniform sampler2D uColormap;          // the terrain's shared band colormap
uniform sampler2D uEnv;
uniform float uEnvMips;
uniform mediump sampler2DShadow uShadowMap;
uniform mat4 uShadowVP;
uniform vec4 uShadow;
in vec3 vWorld;
in vec3 vNormal;
in float vCarve;
out vec4 outColor;

// LIGHTING PARITY with the base terrain (DEFORM_SURFACE_WGSL's doctrine):
// pbrDirect + shadowFactor duplicated from the mesh port so the patch can
// never read as a disc sliding over the mountain.
vec3 pbrDirect(vec3 nrm, vec3 v, vec3 l, vec3 albedo, float metallic, float rough, vec3 radiance) {
  vec3 h = normalize(v + l);
  float NL = max(dot(nrm, l), 0.0);
  float NV = max(dot(nrm, v), 1e-4);
  float NH = max(dot(nrm, h), 0.0);
  float VH = max(dot(v, h), 0.0);
  float a2 = rough * rough * rough * rough;
  float dd2 = NH * NH * (a2 - 1.0) + 1.0;
  float D = a2 / (3.14159 * dd2 * dd2);
  float kk = (rough + 1.0) * (rough + 1.0) / 8.0;
  float G = (NV / (NV * (1.0 - kk) + kk)) * (NL / (NL * (1.0 - kk) + kk));
  vec3 F0 = mix(vec3(0.04), albedo, metallic);
  vec3 F = F0 + (1.0 - F0) * pow(1.0 - VH, 5.0);
  vec3 spec = D * G * F / (4.0 * NV * NL + 1e-4);
  vec3 kd = (vec3(1.0) - F) * (1.0 - metallic);
  return (kd * albedo / 3.14159 + spec) * NL * radiance;
}
const vec2 POISSON8[8] = vec2[8](
  vec2(-0.326, -0.406), vec2(-0.840, -0.074), vec2(-0.696, 0.457), vec2(-0.203, 0.621),
  vec2(0.962, -0.195), vec2(0.473, -0.480), vec2(0.519, 0.767), vec2(0.185, -0.893));
float shadowFactor(vec3 world, vec3 nrm) {
  float NL = max(dot(nrm, -uLightDir.xyz), 0.0);
  float slope = sqrt(max(1.0 - NL * NL, 0.0)) / max(NL, 0.15);
  float off = uShadow.w * min(1.0 + slope, 6.0);
  vec4 sc = uShadowVP * vec4(world + nrm * off, 1.0);
  vec3 ndc = sc.xyz / sc.w;
  if (abs(ndc.x) >= 1.0 || abs(ndc.y) >= 1.0 || ndc.z <= 0.0 || ndc.z >= 1.0) { return 1.0; }
  vec2 uv = ndc.xy * 0.5 + 0.5;
  float refZ = ndc.z - uShadow.y;
  float h = fract(sin(dot(world, vec3(12.9898, 78.233, 37.719))) * 43758.547);
  float ca = cos(h * 6.28318); float sa = sin(h * 6.28318);
  float sum = texture(uShadowMap, vec3(uv, refZ));
  for (int i = 0; i < 8; i++) {
    vec2 p = POISSON8[i] * (uShadow.z * 2.5);
    vec2 r = vec2(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
    sum += texture(uShadowMap, vec3(uv + r, refZ));
  }
  return sum / 9.0;
}

void main() {
  // Only inside the cut disc (+2% seam overlap) and never past the edge.
  float half_ = uPU[2].x * 0.5;
  if (abs(vWorld.x) > half_ || abs(vWorld.z) > half_) { discard; }
  if (distance(vWorld.xz, uPU[0].xy) > uPU[2].z * 1.02) { discard; }
  vec3 n = normalize(vNormal);
  vec3 v = normalize(uCamPos.xyz - vWorld);
  vec3 amb = mix(uAmbGround.rgb, uAmbSky.rgb, n.y * 0.5 + 0.5) * uFogColor.a;
  // The SAME band colormap as the base terrain (world XZ → uv).
  vec2 cuv = vec2(vWorld.x / uPU[2].x + 0.5, vWorld.z / uPU[2].x + 0.5);
  vec3 albedo = textureLod(uColormap, cuv, 0.0).rgb;
  float trench = clamp(vCarve / max(uPU[2].w, 1e-4), 0.0, 1.0);
  float tmix = smoothstep(0.25, 0.8, trench);
  albedo = mix(albedo, uPU[3].rgb * (1.0 - 0.3 * trench), tmix * 0.92);
  float rough = clamp(uPU[4].x, 0.045, 1.0);
  float sunVis = 1.0;
  if (uShadow.x > 0.5) { sunVis = shadowFactor(vWorld, n); }
  vec3 rgb = albedo * amb
    + pbrDirect(n, v, -uLightDir.xyz, albedo, 0.0, rough, uSunCol.rgb * (3.14159 * uSunCol.w)) * sunVis;
  if (uAmbSky.w > 0.001) {
    vec3 R = reflect(-v, n);
    float eu = atan(R.x, R.z) / 6.28318530718 + 0.5;
    float ev = 0.5 - asin(clamp(R.y, -1.0, 1.0)) / 3.14159265;
    vec3 env = textureLod(uEnv, vec2(eu, ev), rough * (uEnvMips - 1.0)).rgb;
    float NV = max(dot(n, v), 0.0);
    vec3 F0amb = vec3(0.04);
    vec3 Fe = F0amb + (max(vec3(1.0 - rough), F0amb) - F0amb) * pow(1.0 - NV, 5.0);
    rgb += env * Fe * uAmbSky.w * (1.0 - rough * 0.6);
  }
  // Snow sparkle: sub-texel point glints (not lit cells).
  if (uPU[3].w > 0.0) {
    vec2 sp = vWorld.xz * 7.0;
    vec2 cell = floor(sp);
    float hs = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.547);
    vec2 pnt = cell + vec2(hs, fract(hs * 91.17));
    vec3 hv = normalize(v - uLightDir.xyz);
    float fac = pow(max(dot(n, hv), 0.0), 6.0);
    float glint = smoothstep(0.16, 0.02, length(sp - pnt)) * step(0.6, fract(hs * 13.7)) * fac;
    rgb += uSunCol.rgb * uSunCol.w * glint * uPU[3].w * 2.2 * (1.0 - trench);
  }
  if (uParams.z > 0.5) {
    float f = smoothstep(uParams.x, uParams.y, distance(uCamPos.xyz, vWorld));
    rgb = mix(rgb, uFogColor.rgb, f);
  }
  outColor = vec4(rgb, 1.0);
}
`;
var BEAM_SEGS = 40;
var BEAM_VERTS = 120;
var BEAM_INST_FLOATS = 12;
var buildGlBeamVertGLSL = () => GLSL_HEADER + `
const int SEGS = 40;
const float TAU = 6.2831853;
layout(location=0) in vec4 iApex;     // x, y, z, length
layout(location=1) in vec4 iAxis;     // dir xyz (normalised on CPU), base radius
layout(location=2) in vec4 iColor;    // rgb, intensity
uniform mat4 uViewProj;
out vec3 vWorld;
out vec3 vNrm;
out float vAxial;                     // 0 at the lamp → 1 at the base
out float vViewDist;                  // linear eye distance (clip w)
out vec4 vColor;
void main() {
  int seg = gl_VertexID / 3;
  int corner = gl_VertexID % 3;
  vec3 apex = iApex.xyz;
  float L = iApex.w;
  vec3 axis = normalize(iAxis.xyz);
  float R = iAxis.w;
  vec3 up = abs(axis.y) > 0.99 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 uu = normalize(cross(up, axis));
  vec3 vv = cross(axis, uu);
  vec3 baseC = apex + axis * L;
  float a0 = float(seg) / float(SEGS) * TAU;
  float a1 = float(seg + 1) / float(SEGS) * TAU;
  vec3 world;
  float axial;
  vec3 nrm;
  if (corner == 0) {
    world = apex;
    axial = 0.0;
    float am = (a0 + a1) * 0.5;
    nrm = cos(am) * uu + sin(am) * vv;
  } else {
    float ang = corner == 2 ? a1 : a0;
    vec3 radial = cos(ang) * uu + sin(ang) * vv;
    world = baseC + radial * R;
    axial = 1.0;
    nrm = normalize(radial * L - axis * R);   // side normal tilted by the slope
  }
  vec4 clip = uViewProj * vec4(world, 1.0);
  vViewDist = clip.w;                          // BEFORE the z remap
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vWorld = world;
  vNrm = nrm;
  vAxial = axial;
  vColor = iColor;
}
`;
var buildGlBeamFragGLSL = () => GLSL_FRAG_HEADER + `
uniform vec4 uCamPos;
uniform vec4 uLin;                    // projA, projB, softDist
uniform highp sampler2D uDepth;       // scene depth copy (1×1 white when absent)
in vec3 vWorld;
in vec3 vNrm;
in float vAxial;
in float vViewDist;
in vec4 vColor;
out vec4 outColor;
void main() {
  vec3 V = normalize(uCamPos.xyz - vWorld);
  vec3 N = normalize(vNrm);
  // Bright down the CORE, soft at the silhouette (both walls add).
  float face = abs(dot(N, V));
  float a = vColor.a * face * face;
  a *= mix(1.0, 0.16, vAxial);                 // fade along the shaft
  a *= smoothstep(0.0, 0.06, vAxial);          // soften the exact apex
  // SOFT DEPTH FADE — dissolve as the shaft nears a solid.
  ivec2 dims = textureSize(uDepth, 0);
  ivec2 px = clamp(ivec2(gl_FragCoord.xy), ivec2(0), dims - 1);
  float d = texelFetch(uDepth, px, 0).r;
  if (d < 1.0) {
    float sceneDist = uLin.y / (uLin.x + d);
    a *= clamp((sceneDist - vViewDist) / max(uLin.z, 0.001), 0.0, 1.0);
  }
  outColor = vec4(vColor.rgb * a, 0.0);        // premultiplied additive
}
`;
var buildGlGrassCardVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iPosH;     // base xyz + height
layout(location=1) in vec4 iSw;       // width, phase, fade, frame
layout(location=2) in vec4 iCol;      // rgb tint
uniform mat4 uViewProj;
uniform vec4 uParams;                 // w = time
uniform vec4 uRight;                  // camera right (flattened in-shader)
uniform vec4 uWind;                   // dirX, dirZ, strength, dryness
out vec2 vUv;
out vec3 vWorld;
out vec3 vColor;
out float vUp;
flat out int vFrame;
void main() {
  float side = float(gl_VertexID & 1) * 2.0 - 1.0;
  float up = float(gl_VertexID >> 1);
  vec3 right = normalize(vec3(uRight.x, 0.0, uRight.z) + vec3(1e-4, 0.0, 0.0));
  float travel = sin(dot(iPosH.xz, uWind.xy) * 0.35 - uParams.w * 1.3);
  vec2 windDir = normalize(uWind.xy + vec2(1e-4, 0.0));
  float sway = travel * uWind.z * iPosH.w * 0.18 * up;
  vec3 world = iPosH.xyz + right * iSw.x * side
    + vec3(0.0, iPosH.w * up, 0.0)
    + vec3(windDir.x, 0.0, windDir.y) * sway;
  vec4 clip = uViewProj * vec4(world, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vUv = vec2(side * 0.5 + 0.5, 1.0 - up);
  vWorld = world;
  vColor = iCol.rgb;
  vUp = up;
  vFrame = int(iSw.w + 0.5);
}
`;
var buildGlGrassCardFragGLSL = () => GLSL_FRAG_HEADER + `
uniform mediump sampler2DArray uCardTex;
uniform vec4 uCamPos;
uniform vec4 uFogColor;               // rgb + ambient
uniform vec4 uParams;
uniform vec4 uLightDir;
uniform vec4 uAmbSky;
uniform vec4 uAmbGround;
uniform vec4 uSunCol;
uniform vec4 uWind;                   // w = dryness
in vec2 vUv;
in vec3 vWorld;
in vec3 vColor;
in float vUp;
flat in int vFrame;
out vec4 outColor;
void main() {
  vec4 tex = texture(uCardTex, vec3(vUv, float(vFrame)));
  // HARD alpha test — not a2c (the dusk-halo lesson, verbatim).
  if (tex.a < 0.5) { discard; }
  vec3 albedo;
  if (vFrame == 0) {
    // Grass clump: shape only; colour = the terrain-coherent tint + gradient.
    vec3 col = vColor * mix(0.55, 1.2, vUp);
    float luma = dot(col, vec3(0.3333));
    albedo = mix(col, luma * vec3(1.35, 1.12, 0.5), uWind.w);
  } else {
    albedo = tex.rgb;                 // flower frames ARE the albedo
  }
  // IDENTICAL wrap-lit formula to the blades (brightness twins).
  vec3 n = vec3(0.0, 1.0, 0.0);
  vec3 ambient = mix(uAmbGround.rgb, uAmbSky.rgb, n.y * 0.35 + 0.65) * uFogColor.a;
  float nl = clamp((dot(n, -uLightDir.xyz) + 0.5) / 1.5, 0.0, 1.0);
  vec3 rgb = albedo * ambient + albedo * uSunCol.rgb * uSunCol.w * nl;
  if (uParams.z > 0.5) {
    float f = smoothstep(uParams.x, uParams.y, distance(uCamPos.xyz, vWorld));
    rgb = mix(rgb, uFogColor.rgb, f);
  }
  outColor = vec4(rgb, 1.0);
}
`;
var buildGlPickVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec3 aPos;
layout(location=5) in float iOn;      // 1 = pickable (per instance)
layout(location=8) in vec4 iPos;      // xyz + yaw
layout(location=9) in vec4 iSize;     // whd + pitch
layout(location=11) in vec4 iRot;     // roll
uniform mat4 uViewProj;
uniform float uBase;                  // this span's id base
flat out vec2 vIdOn;                  // packed id (float-exact < 2^24), flag
${ROTATE_GLSL}
void main() {
  vec3 world = rotate3d(aPos * iSize.xyz, iPos.w, iSize.w, iRot.x) + iPos.xyz;
  vec4 clip = uViewProj * vec4(world, 1.0);
  clip.z = clip.z * 2.0 - clip.w;
  gl_Position = clip;
  vIdOn = vec2(uBase + float(gl_InstanceID), iOn);
}
`;
var buildGlPickFragGLSL = () => GLSL_FRAG_HEADER + `
flat in vec2 vIdOn;
uniform float uOcclude;
out vec4 outColor;
void main() {
  if (vIdOn.y < 0.5) {
    // Non-pickable: occlude mode writes depth + the no-hit sentinel; the
    // see-through mode discards (no depth, no id).
    if (uOcclude < 0.5) { discard; }
    outColor = vec4(0.0);
    return;
  }
  float id = vIdOn.x + 1.0;            // 0 stays the empty sentinel
  outColor = vec4(
    floor(mod(id, 256.0)),
    floor(mod(id / 256.0, 256.0)),
    floor(mod(id / 65536.0, 256.0)),
    255.0) / 255.0;
}
`;
//#endregion
//#region src/lib/webgl3d/trails.ts
/**
* Resample a trail's raw point history (oldest first) into `n` control
* points HEAD (newest) → TAIL, each xyz + fade k, spaced uniformly in ARC
* LENGTH — world3d.ts's resampleTrail, verbatim (pure, dist-testable).
*/
function resampleTrail(points, n, life, out, offset = 0) {
	const o = out ?? new Float32Array(n * 4);
	const m = points.length;
	const acc = new Float64Array(m);
	for (let i = 1; i < m; i++) {
		const a = points[i - 1], b = points[i];
		acc[i] = acc[i - 1] + Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
	}
	const total = m ? acc[m - 1] : 0;
	let i0 = m - 1;
	for (let j = 0; j < n; j++) {
		const target = total * (1 - j / (n - 1));
		while (i0 > 0 && acc[i0 - 1] >= target) i0--;
		const i1 = Math.max(0, i0 - 1);
		const seg = acc[i0] - acc[i1];
		const w = seg > 0 ? (acc[i0] - target) / seg : 0;
		const a = points[i0], b = points[i1];
		const base = offset + j * 4;
		o[base] = a.x + (b.x - a.x) * w;
		o[base + 1] = a.y + (b.y - a.y) * w;
		o[base + 2] = a.z + (b.z - a.z) * w;
		const age = a.age + (b.age - a.age) * w;
		o[base + 3] = Math.max(0, Math.min(1, 1 - age / life));
	}
	return o;
}
/** A live 3D trail — feed `point(x, y, z)` per frame (or pass `follow`).
* All style fields live-mutable. world3d.ts's Trail3d, duplicated. */
var Trail3d = class {
	width;
	life;
	colors;
	add;
	taper;
	alpha;
	turbulence;
	erode;
	core;
	fiber;
	hard;
	/** Electric glint inside the ribbon 0..1 — live-mutable like the rest. */
	crackle;
	facing;
	spacing;
	follow;
	offset;
	/** The tileable noise frame driving flutter + erosion. */
	frame;
	/** @internal */ seed;
	/** @internal */ points = [];
	/** @internal */ dead = false;
	/** @internal */ hx = 0;
	/** @internal */ hy = 0;
	/** @internal */ hz = 0;
	/** @internal */ hasHead = false;
	/** @internal Total distance travelled — the noise pattern's world anchor. */
	dist = 0;
	/** @internal Spark shedding pool (wired by world.trail()). */
	fx = null;
	sparks;
	shedAcc = 0;
	/** @internal — create via world.trail(). */
	constructor(def, frame, opts, seed) {
		const t = def.trail ?? {};
		this.width = opts.width ?? (t.width ?? 8) * .1;
		this.life = opts.life ?? t.life ?? .5;
		this.colors = [...t.colors ?? ["#ffffff"]];
		this.add = t.add ?? false;
		this.taper = t.taper ?? true;
		this.alpha = t.alpha ?? .8;
		this.turbulence = t.turbulence ?? .35;
		this.erode = t.erode ?? .55;
		this.core = t.core ?? .5;
		this.fiber = t.fiber ?? 1;
		this.hard = t.hard ?? 0;
		this.crackle = t.crackle ?? 0;
		this.sparks = t.sparks ?? null;
		this.facing = opts.facing ?? t.facing ?? "view";
		this.spacing = opts.spacing ?? Math.max(.02, this.width * .25);
		this.follow = opts.follow ?? null;
		this.offset = {
			x: opts.offset?.x ?? 0,
			y: opts.offset?.y ?? 0,
			z: opts.offset?.z ?? 0
		};
		this.frame = frame;
		this.seed = seed;
	}
	/** Record the head position for this frame. */
	point(x, y, z) {
		if (this.hasHead) {
			const seg = Math.hypot(x - this.hx, y - this.hy, z - this.hz);
			this.dist += seg;
			if (this.sparks && this.fx && seg > 0) {
				const s = this.sparks;
				const step = .1 / (s.per ?? .25);
				const dx = (x - this.hx) / seg, dy = (y - this.hy) / seg, dz = (z - this.hz) / seg;
				let travelled = this.shedAcc + seg;
				while (travelled >= step) {
					travelled -= step;
					const along = seg - travelled;
					this.fx.emit({
						x: this.hx + dx * along,
						y: this.hy + dy * along,
						z: this.hz + dz * along,
						count: 1,
						speed: (s.speed ?? 30) * .1,
						speedVar: (s.speed ?? 30) * .05,
						life: s.life ?? .45,
						lifeVar: (s.life ?? .45) * .3,
						size: (s.size ?? 2) * .1,
						sizeVar: (s.size ?? 2) * .04,
						colors: s.ramp ? void 0 : s.colors ?? this.colors,
						ramp: s.ramp,
						add: s.add ?? this.add,
						gravity: (s.gravity ?? 0) * .1,
						drag: s.drag ?? 1.5,
						twinkle: s.twinkle ?? .6
					});
				}
				this.shedAcc = travelled;
			}
		}
		this.hx = x;
		this.hy = y;
		this.hz = z;
		this.hasHead = true;
		const last = this.points[this.points.length - 1];
		if (last && Math.hypot(x - last.x, y - last.y, z - last.z) < this.spacing) return;
		this.points.push({
			x,
			y,
			z,
			age: 0
		});
	}
	/** Stop feeding; the ribbon fades out, then auto-removes. */
	release() {
		this.dead = true;
		this.follow = null;
	}
	/** @internal Age/expire points. Returns true while anything remains. */
	update(dt) {
		if (this.follow?.dead) this.release();
		for (const p of this.points) p.age += dt;
		while (this.points.length && this.points[0].age >= this.life) this.points.shift();
		return this.points.length > 0 || !this.dead;
	}
	/** @internal Feed from the followed handle's CURRENT position — called at
	* render time, after the game has moved the handle this frame. */
	feedFollow() {
		if (this.follow && !this.dead) this.point(this.follow.x + this.offset.x, this.follow.y + this.offset.y, this.follow.z + this.offset.z);
	}
	/** @internal True once there is enough to draw a ribbon. */
	get ready() {
		return this.points.length >= 2 || this.points.length === 1 && this.hasHead;
	}
	/** @internal Resample history + the live head into `out` at `offset`;
	* returns the resampled path's arc length. */
	pack(out, offset) {
		let pts = this.points;
		const last = pts[pts.length - 1];
		if (this.hasHead && last && (last.x !== this.hx || last.y !== this.hy || last.z !== this.hz)) pts = [...pts, {
			x: this.hx,
			y: this.hy,
			z: this.hz,
			age: 0
		}];
		resampleTrail(pts, 16, this.life, out, offset);
		let span = 0;
		for (let i = 1; i < pts.length; i++) {
			const a = pts[i - 1], b = pts[i];
			span += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
		}
		return span;
	}
};
//#endregion
//#region src/lib/webgl3d/voxels.ts
/** The renderable voxel world on the GL backend. `world.voxels()` builds it;
* edit via set/get, pick with `raycast`; GlWorld3d draws it in-pass. */
var GlVoxels3d = class {
	camera;
	world;
	blockSize;
	gl;
	bufs;
	prog = null;
	u = {};
	vao = null;
	atlasTex = null;
	tileRes;
	seed;
	mip;
	cullDist;
	constructor(gl, camera, opts = {}) {
		this.camera = camera;
		this.world = new VoxelWorld(opts);
		this.blockSize = opts.blockSize ?? 1;
		this.tileRes = opts.tileRes ?? 16;
		this.seed = opts.seed ?? 1;
		this.mip = opts.mipmaps ?? true;
		this.cullDist = opts.cullDist ?? 512;
		this.bufs = Array.from({ length: this.world.chunkCount }, () => ({
			vbuf: null,
			count: 0
		}));
		this.rebuild(gl);
	}
	/** (Re)create every GL object from CPU state — context-restore path. */
	rebuild(gl) {
		this.gl = gl;
		this.bufs = Array.from({ length: this.world.chunkCount }, () => ({
			vbuf: null,
			count: 0
		}));
		this.vao = null;
		this.prog = compileProgram(gl, buildGlVoxelVertGLSL(), buildGlVoxelFragGLSL(), "GlVoxels3d");
		this.u = {};
		if (this.prog) {
			for (const name of [
				"uViewProj",
				"uCamPos",
				"uFogColor",
				"uParams",
				"uAmbSky",
				"uAmbGround",
				"uSunCol"
			]) this.u[name] = gl.getUniformLocation(this.prog, name);
			gl.useProgram(this.prog);
			const loc = gl.getUniformLocation(this.prog, "uAtlas");
			if (loc) gl.uniform1i(loc, 0);
		}
		this.uploadAtlas();
		this.world.markAllDirty();
	}
	/** Bake + upload the procedural tile pack into a 2D ARRAY texture with a
	* CPU-halved mip chain (the WebGPU uploadAtlas recipe, texSubImage3D-ed). */
	uploadAtlas() {
		const gl = this.gl, res = this.tileRes;
		const { data, layers } = bakeTiles(res, this.seed);
		const mipCount = this.mip ? 1 + Math.floor(Math.log2(res)) : 1;
		if (this.atlasTex) gl.deleteTexture(this.atlasTex);
		this.atlasTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlasTex);
		gl.texStorage3D(gl.TEXTURE_2D_ARRAY, mipCount, gl.SRGB8_ALPHA8, res, res, layers);
		for (let l = 0; l < layers; l++) {
			let px = data.subarray(l * res * res * 4, (l + 1) * res * res * 4);
			let w = res, h = res;
			for (let m = 0; m < mipCount; m++) {
				gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, m, 0, 0, l, w, h, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
				if (m + 1 < mipCount) {
					const n = halveRGBA(px, w, h);
					px = n.px;
					w = n.w;
					h = n.h;
				}
			}
		}
		gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, this.mip ? gl.LINEAR_MIPMAP_LINEAR : gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.REPEAT);
	}
	get(x, y, z) {
		return this.world.get(x, y, z);
	}
	set(x, y, z, id) {
		this.world.set(x, y, z, id);
	}
	/** Author the world in bulk: `(x,y,z) => blockId`. */
	generate(fn) {
		const w = this.world;
		for (let y = 0; y < w.sy; y++) for (let z = 0; z < w.sz; z++) for (let x = 0; x < w.sx; x++) {
			const id = fn(x, y, z);
			if (id) w.set(x, y, z, id);
		}
	}
	/** Build (or REBUILD) a landscape — voxelTerrain over a cleared world. */
	landscape(opts = {}) {
		this.world.clear();
		voxelTerrain(this.world, opts);
	}
	/** World-space Y (feet) to drop a body/mob at column (x, z). */
	spawnY(x, z) {
		return (this.world.columnTop(x / this.blockSize | 0, z / this.blockSize | 0) + 1) * this.blockSize;
	}
	/** DDA raycast in world space → block coords + entry normal (voxel3d.ts). */
	raycast(ox, oy, oz, dx, dy, dz, maxDist = 64) {
		const b = this.blockSize;
		return raycastVoxel((x, y, z) => this.world.get(x, y, z), ox / b, oy / b, oz / b, dx, dy, dz, maxDist / b);
	}
	/** Re-mesh dirty chunks + upload their VBOs (budget-capped, like the
	* original's per-frame remeshDirty). */
	remeshDirty(budget = 8) {
		if (!this.world.dirty.size) return;
		const gl = this.gl, b = this.blockSize, ch = this.world.ch;
		let done = 0;
		for (const idx of this.world.dirty) {
			const [cx, cy, cz] = this.world.chunkCoords(idx);
			const verts = meshChunk((x, y, z) => this.world.get(x, y, z), cx * ch, cy * ch, cz * ch, ch);
			const buf = this.bufs[idx];
			if (verts.length === 0) {
				if (buf.vbuf) gl.deleteBuffer(buf.vbuf);
				buf.vbuf = null;
				buf.count = 0;
			} else {
				if (b !== 1) for (let i = 0; i < verts.length; i += 8) {
					verts[i] *= b;
					verts[i + 1] *= b;
					verts[i + 2] *= b;
				}
				buf.vbuf ??= gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, buf.vbuf);
				gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
				buf.count = verts.length / 8;
			}
			this.world.dirty.delete(idx);
			if (++done >= budget) break;
		}
	}
	/** Draw every non-empty, in-range chunk — called by GlWorld3d inside the
	* opaque pass (depth write on, back-cull already set). Returns the number
	* of draw calls issued (for counts.draws). */
	render(frame) {
		const gl = this.gl;
		if (!this.prog) return 0;
		this.remeshDirty();
		let draws = 0;
		let set = false;
		const b = this.blockSize, ch = this.world.ch, half = ch * b * .5, cull2 = this.cullDist * this.cullDist;
		for (let idx = 0; idx < this.bufs.length; idx++) {
			const buf = this.bufs[idx];
			if (!buf.vbuf || !buf.count) continue;
			const [cx, cy, cz] = this.world.chunkCoords(idx);
			const dx = cx * ch * b + half - this.camera.x;
			const dy = cy * ch * b + half - this.camera.y;
			const dz = cz * ch * b + half - this.camera.z;
			if (dx * dx + dy * dy + dz * dz > cull2) continue;
			if (!set) {
				gl.useProgram(this.prog);
				const u = this.u;
				if (u.uViewProj) gl.uniformMatrix4fv(u.uViewProj, false, frame.vp);
				if (u.uCamPos) gl.uniform4fv(u.uCamPos, frame.camPos);
				if (u.uFogColor) gl.uniform4fv(u.uFogColor, frame.fogColor);
				if (u.uParams) gl.uniform4fv(u.uParams, frame.params);
				if (u.uAmbSky) gl.uniform4fv(u.uAmbSky, frame.ambSky);
				if (u.uAmbGround) gl.uniform4fv(u.uAmbGround, frame.ambGround);
				if (u.uSunCol) gl.uniform4fv(u.uSunCol, frame.sunCol);
				gl.activeTexture(gl.TEXTURE0);
				gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.atlasTex);
				if (!this.vao) this.vao = gl.createVertexArray();
				gl.bindVertexArray(this.vao);
				set = true;
			}
			gl.bindBuffer(gl.ARRAY_BUFFER, buf.vbuf);
			const stride = 32;
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
			gl.enableVertexAttribArray(1);
			gl.vertexAttribPointer(1, 2, gl.FLOAT, false, stride, 12);
			gl.enableVertexAttribArray(2);
			gl.vertexAttribPointer(2, 1, gl.FLOAT, false, stride, 20);
			gl.enableVertexAttribArray(3);
			gl.vertexAttribPointer(3, 1, gl.FLOAT, false, stride, 24);
			gl.enableVertexAttribArray(4);
			gl.vertexAttribPointer(4, 1, gl.FLOAT, false, stride, 28);
			gl.drawArrays(gl.TRIANGLES, 0, buf.count);
			draws++;
		}
		if (set) gl.bindVertexArray(null);
		return draws;
	}
	/** Live stats for a HUD/debug panel. */
	get stats() {
		let chunks = 0, verts = 0;
		for (const b of this.bufs) if (b.count) {
			chunks++;
			verts += b.count;
		}
		return {
			chunks,
			verts
		};
	}
	destroy() {
		for (const b of this.bufs) if (b.vbuf) this.gl.deleteBuffer(b.vbuf);
		this.bufs = [];
		if (this.atlasTex) this.gl.deleteTexture(this.atlasTex);
		this.atlasTex = null;
	}
};
//#endregion
//#region src/lib/webgl3d/water.ts
var WP_FLOATS = 128;
var GRID_FINE = 288;
var GRID_COARSE = 96;
var GRID_SPLIT = 900;
var FOAM_RES = 512;
var FOAM_SPAN = 360;
var GlWaterLayer = class {
	gl;
	gridProg = {
		p: null,
		u: {}
	};
	ribbonProg = {
		p: null,
		u: {}
	};
	decayProg = {
		p: null,
		u: {}
	};
	stampProg = {
		p: null,
		u: {}
	};
	vao = null;
	fsVao = null;
	gridVbufFine = null;
	gridVbufCoarse = null;
	gridVertsFine = 0;
	gridVertsCoarse = 0;
	rippleTex = null;
	dummyGround = null;
	foamA = null;
	foamB = null;
	foamOrigin = [1e9, 1e9];
	wellPrev = /* @__PURE__ */ new WeakMap();
	stampData = /* @__PURE__ */ new Float32Array(32);
	gpu = /* @__PURE__ */ new Map();
	constructor(gl) {
		this.rebuild(gl);
	}
	/** (Re)create every GL object — context-restore path (per-water records
	* recreate lazily, incl. the ground re-bake from the live ground fn). */
	rebuild(gl) {
		this.gl = gl;
		this.gpu.clear();
		this.vao = null;
		this.fsVao = null;
		this.foamOrigin = [1e9, 1e9];
		const waterU = [
			"uWP",
			"uViewProj",
			"uCamPos",
			"uFogColor",
			"uParams",
			"uLightDir",
			"uAmbSky",
			"uAmbGround",
			"uSunCol",
			"uLights",
			"uLightCount"
		];
		const waterSamp = {
			uEnv: 0,
			uDepth: 1,
			uGround: 2,
			uRipple: 3,
			uFoam: 4
		};
		const make = (vs, fs, label, uniforms, samplers) => {
			const p = compileProgram(gl, vs, fs, label);
			const u = {};
			if (p) {
				for (const name of uniforms) u[name] = gl.getUniformLocation(p, name);
				gl.useProgram(p);
				for (const [name, unit] of Object.entries(samplers)) {
					const loc = gl.getUniformLocation(p, name);
					if (loc) gl.uniform1i(loc, unit);
				}
			}
			return {
				p,
				u
			};
		};
		const waterFs = buildGlWaterFragGLSL();
		this.gridProg = make(buildGlWaterVertGLSL(true), waterFs, "GlWaterLayer grid", waterU, waterSamp);
		this.ribbonProg = make(buildGlWaterVertGLSL(false), waterFs, "GlWaterLayer ribbon", waterU, waterSamp);
		this.decayProg = make(buildGlFullscreenVertGLSL(), buildGlFoamDecayFragGLSL(), "GlWaterLayer foam decay", ["uShift"], { uSrc: 0 });
		this.stampProg = make(buildGlFoamStampVertGLSL(), buildGlFoamStampFragGLSL(), "GlWaterLayer foam stamp", ["uStamps"], {});
		const buildGrid = (RES) => {
			const g = new Float32Array(RES * RES * 6 * 2);
			let o = 0;
			const cells = [];
			for (let iz = 0; iz < RES; iz++) for (let ix = 0; ix < RES; ix++) cells.push([ix, iz]);
			const ring = (c) => Math.max(Math.abs(c[0] + .5 - RES / 2), Math.abs(c[1] + .5 - RES / 2));
			cells.sort((a, b) => ring(b) - ring(a));
			for (const [ix, iz] of cells) {
				const x0 = ix / RES - .5, x1 = (ix + 1) / RES - .5;
				const z0 = iz / RES - .5, z1 = (iz + 1) / RES - .5;
				g[o++] = x0;
				g[o++] = z0;
				g[o++] = x0;
				g[o++] = z1;
				g[o++] = x1;
				g[o++] = z0;
				g[o++] = x1;
				g[o++] = z0;
				g[o++] = x0;
				g[o++] = z1;
				g[o++] = x1;
				g[o++] = z1;
			}
			const buf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, buf);
			gl.bufferData(gl.ARRAY_BUFFER, g, gl.STATIC_DRAW);
			return buf;
		};
		this.gridVbufFine = buildGrid(GRID_FINE);
		this.gridVertsFine = GRID_FINE * GRID_FINE * 6;
		this.gridVbufCoarse = buildGrid(GRID_COARSE);
		this.gridVertsCoarse = GRID_COARSE * GRID_COARSE * 6;
		{
			const RS = 512;
			const mips = 1 + Math.log2(RS);
			if (this.rippleTex) gl.deleteTexture(this.rippleTex);
			this.rippleTex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.rippleTex);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
			gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
			let level = bakeRippleField(RS);
			let w = RS;
			for (let m = 0; m < mips; m++) {
				gl.texImage2D(gl.TEXTURE_2D, m, gl.RGBA8, w, w, 0, gl.RGBA, gl.UNSIGNED_BYTE, level);
				if (m + 1 < mips) {
					const hw = w >> 1;
					const next = new Uint8Array(hw * hw * 4);
					for (let y = 0; y < hw; y++) for (let x = 0; x < hw; x++) for (let c = 0; c < 4; c++) {
						const i0 = (y * 2 * w + x * 2) * 4 + c, i1 = i0 + w * 4;
						next[(y * hw + x) * 4 + c] = level[i0] + level[i0 + 4] + level[i1] + level[i1 + 4] + 2 >> 2;
					}
					level = next;
					w = hw;
				}
			}
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
		}
		this.dummyGround = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.dummyGround);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, 1, 1, 0, gl.RED, gl.FLOAT, new Float32Array([-1e3]));
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		const mkFoam = () => {
			const tex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, FOAM_RES, FOAM_RES);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			const fbo = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
			gl.clearColor(0, 0, 0, 1);
			gl.clear(gl.COLOR_BUFFER_BIT);
			return {
				fbo,
				tex
			};
		};
		this.foamA = mkFoam();
		this.foamB = mkFoam();
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
	/** The FOAM STAMP pass — decay+diffuse last frame (camera-shifted) into
	* the other target, stamp every well (intensity rides its speed), SWAP.
	* Runs before the main passes; restores the caller's FBO + viewport. */
	foamPass(waters, eyeX, eyeZ, dt, restoreFbo, width, height) {
		const gl = this.gl;
		if (!this.decayProg.p || !this.foamA || !this.foamB) return;
		const texel = FOAM_SPAN / FOAM_RES;
		const ox = Math.round(eyeX / texel) * texel;
		const oz = Math.round(eyeZ / texel) * texel;
		const first = this.foamOrigin[0] > 1e8;
		const shiftX = first ? 0 : (ox - this.foamOrigin[0]) / FOAM_SPAN;
		const shiftZ = first ? 0 : (oz - this.foamOrigin[1]) / FOAM_SPAN;
		const decay = first ? 0 : Math.exp(-dt / 2.4);
		this.foamOrigin = [ox, oz];
		let nStamps = 0;
		const fd = this.stampData;
		for (const w of waters) {
			if (w.dead || w.kind !== "grid") continue;
			for (const wl of w.wells) {
				if (wl.dead || nStamps >= 4) continue;
				const prev = this.wellPrev.get(wl);
				const spd = prev ? Math.hypot(wl.x - prev[0], wl.z - prev[1]) / Math.max(dt, .001) : 0;
				this.wellPrev.set(wl, [wl.x, wl.z]);
				const inten = Math.min(.55, wl.wake * (.15 + .28 * spd) * dt);
				const o = nStamps * 8;
				const back = wl.d * .3;
				fd[o] = (wl.x - Math.sin(wl.yaw) * back - ox) / FOAM_SPAN + .5;
				fd[o + 1] = (wl.z - Math.cos(wl.yaw) * back - oz) / FOAM_SPAN + .5;
				fd[o + 2] = wl.yaw;
				fd[o + 3] = inten;
				fd[o + 4] = wl.w * .38 / FOAM_SPAN;
				fd[o + 5] = wl.d * .3 / FOAM_SPAN;
				nStamps++;
			}
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.foamB.fbo);
		gl.viewport(0, 0, FOAM_RES, FOAM_RES);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		if (!this.fsVao) this.fsVao = gl.createVertexArray();
		gl.bindVertexArray(this.fsVao);
		gl.useProgram(this.decayProg.p);
		if (this.decayProg.u.uShift) gl.uniform4f(this.decayProg.u.uShift, shiftX, shiftZ, decay, 1 / FOAM_RES);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.foamA.tex);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		if (nStamps > 0 && this.stampProg.p) {
			gl.useProgram(this.stampProg.p);
			if (this.stampProg.u.uStamps) gl.uniform4fv(this.stampProg.u.uStamps, fd);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, nStamps);
			gl.disable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		}
		gl.bindVertexArray(null);
		const t = this.foamA;
		this.foamA = this.foamB;
		this.foamB = t;
		gl.bindFramebuffer(gl.FRAMEBUFFER, restoreFbo);
		gl.viewport(0, 0, width, height);
	}
	/** Pack + draw every live water — Water3dLayer.update()+draw(), GL-side.
	* Caller state: pass B (premultiplied blend, depth test read-only, cull
	* off). Returns the draw-call count. */
	draw(waters, frame, lightData, lightCount, envTex, depthTex, whiteTex, time, projA, projB, width, height) {
		const gl = this.gl;
		if (!this.gridProg.p && !this.ribbonProg.p) return 0;
		for (const [w, rec] of this.gpu) if (w.dead || !waters.includes(w)) {
			if (rec.vbuf) gl.deleteBuffer(rec.vbuf);
			if (rec.groundTex) gl.deleteTexture(rec.groundTex);
			this.gpu.delete(w);
		}
		let draws = 0;
		if (!this.vao) this.vao = gl.createVertexArray();
		for (const w of waters) {
			if (w.dead) continue;
			let rec = this.gpu.get(w);
			if (!rec) {
				rec = {
					wp: new Float32Array(WP_FLOATS),
					vbuf: null,
					vertCount: this.gridVertsFine,
					groundTex: null,
					groundSize: 0
				};
				if (w.ribbon) {
					rec.vbuf = gl.createBuffer();
					gl.bindBuffer(gl.ARRAY_BUFFER, rec.vbuf);
					gl.bufferData(gl.ARRAY_BUFFER, w.ribbon, gl.STATIC_DRAW);
					rec.vertCount = w.ribbon.length / 6;
				}
				if (w.ground && w.kind === "grid") {
					const GS = Math.min(1024, Math.max(128, 1 << Math.ceil(Math.log2(Math.max(w.w, w.d) / 4))));
					const heights = new Float32Array(GS * GS);
					for (let iy = 0; iy < GS; iy++) {
						const wz = w.z + (iy / (GS - 1) - .5) * w.d;
						for (let ix = 0; ix < GS; ix++) heights[iy * GS + ix] = w.ground(w.x + (ix / (GS - 1) - .5) * w.w, wz);
					}
					rec.groundTex = gl.createTexture();
					gl.bindTexture(gl.TEXTURE_2D, rec.groundTex);
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, GS, GS, 0, gl.RED, gl.FLOAT, heights);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
					rec.groundSize = GS;
				}
				this.gpu.set(w, rec);
			}
			w.timeNow = time;
			const d = rec.wp;
			const sh = rgba(w.shallow), dp = rgba(w.deep), fm = rgba(w.foam);
			const scale = w.waveScale();
			let ampSum = 0;
			for (const wv of w.waves) ampSum += wv.amp * scale.amp;
			d.set([
				w.x,
				w.z,
				w.w,
				w.d
			], 0);
			d.set([
				w.levelNow(),
				w.alpha,
				w.ripple,
				w.absorb
			], 4);
			d.set([
				sh[0],
				sh[1],
				sh[2],
				w.foamWidth
			], 8);
			d.set([
				dp[0],
				dp[1],
				dp[2],
				.42
			], 12);
			d.set([
				fm[0],
				fm[1],
				fm[2],
				w.kind === "ribbon" ? 1 : 0
			], 16);
			d.set([
				projA,
				projB,
				width,
				height
			], 20);
			const crestGate = Math.min(1, Math.max(0, (ampSum - .25) / .35));
			d.set([
				w.flow,
				Math.max(ampSum, 1e-4),
				crestGate,
				rec.groundSize
			], 24);
			d.set([
				w.debug,
				Math.max(w.w, w.d) > GRID_SPLIT ? GRID_FINE : GRID_COARSE,
				this.foamOrigin[0],
				this.foamOrigin[1]
			], 28);
			w.wells = w.wells.filter((wl) => !wl.dead);
			for (let i = 0; i < 4; i++) {
				const wl = w.wells[i];
				if (wl) {
					d.set([
						wl.x,
						wl.z,
						wl.yaw,
						wl.floor
					], 32 + i * 8);
					d.set([
						Math.max(wl.w, 0) / 2,
						Math.max(wl.d, 0) / 2,
						wl.feather,
						1 + wl.wake
					], 36 + i * 8);
				} else {
					d.set([
						0,
						0,
						0,
						0
					], 32 + i * 8);
					d.set([
						0,
						0,
						0,
						0
					], 36 + i * 8);
				}
			}
			let sSum = 0;
			for (const wv of w.waves) if (wv.amp >= 1e-5) sSum += Math.min(1.4, wv.steep * scale.steep);
			const sNorm = sSum > 4.8 ? 4.8 / sSum : 1;
			for (let i = 0; i < 8; i++) {
				const wv = w.waves[i];
				if (wv) {
					d.set([
						wv.dir.x,
						wv.dir.z,
						wv.amp * scale.amp,
						wv.len
					], 64 + i * 8);
					d.set([
						wv.speed * scale.speed,
						Math.min(1.4, wv.steep * scale.steep) * sNorm,
						0,
						0
					], 68 + i * 8);
				} else {
					d.set([
						0,
						0,
						0,
						1
					], 64 + i * 8);
					d.set([
						0,
						0,
						0,
						0
					], 68 + i * 8);
				}
			}
			const prog = w.kind === "grid" ? this.gridProg : this.ribbonProg;
			if (!prog.p) continue;
			gl.useProgram(prog.p);
			const u = prog.u;
			if (u.uWP) gl.uniform4fv(u.uWP, d);
			if (u.uViewProj) gl.uniformMatrix4fv(u.uViewProj, false, frame.vp);
			if (u.uCamPos) gl.uniform4fv(u.uCamPos, frame.camPos);
			if (u.uFogColor) gl.uniform4fv(u.uFogColor, frame.fogColor);
			if (u.uParams) gl.uniform4fv(u.uParams, frame.params);
			if (u.uLightDir) gl.uniform4fv(u.uLightDir, frame.lightDir);
			if (u.uAmbSky) gl.uniform4fv(u.uAmbSky, frame.ambSky);
			if (u.uAmbGround) gl.uniform4fv(u.uAmbGround, frame.ambGround);
			if (u.uSunCol) gl.uniform4fv(u.uSunCol, frame.sunCol);
			if (u.uLights) gl.uniform4fv(u.uLights, lightData);
			if (u.uLightCount) gl.uniform1f(u.uLightCount, lightCount);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, envTex ?? whiteTex);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, depthTex ?? whiteTex);
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, rec.groundTex ?? this.dummyGround);
			gl.activeTexture(gl.TEXTURE3);
			gl.bindTexture(gl.TEXTURE_2D, this.rippleTex);
			gl.activeTexture(gl.TEXTURE4);
			gl.bindTexture(gl.TEXTURE_2D, this.foamA.tex);
			gl.bindVertexArray(this.vao);
			if (w.kind === "grid") {
				const fine = Math.max(w.w, w.d) > GRID_SPLIT;
				gl.bindBuffer(gl.ARRAY_BUFFER, fine ? this.gridVbufFine : this.gridVbufCoarse);
				gl.enableVertexAttribArray(0);
				gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 8, 0);
				gl.disableVertexAttribArray(1);
				gl.disableVertexAttribArray(2);
				gl.drawArrays(gl.TRIANGLES, 0, fine ? this.gridVertsFine : this.gridVertsCoarse);
			} else if (rec.vbuf) {
				gl.bindBuffer(gl.ARRAY_BUFFER, rec.vbuf);
				gl.enableVertexAttribArray(0);
				gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
				gl.enableVertexAttribArray(1);
				gl.vertexAttribPointer(1, 2, gl.FLOAT, false, 24, 12);
				gl.enableVertexAttribArray(2);
				gl.vertexAttribPointer(2, 1, gl.FLOAT, false, 24, 20);
				gl.drawArrays(gl.TRIANGLES, 0, rec.vertCount);
			}
			gl.bindVertexArray(null);
			draws++;
		}
		return draws;
	}
	get count() {
		return this.gpu.size;
	}
};
//#endregion
//#region src/lib/webgl3d/underwater.ts
var MAX_SHAFTS = 640;
/** Stable per-cell hash — underwater3d.ts's cellHash, duplicated (private
* there). Keeps each ring slot's shaft identical frame to frame. */
function cellHash(ix, iz, seed) {
	let h = ix * 374761393 + iz * 668265263 + seed * 1274126177 | 0;
	h = Math.imul(h ^ h >>> 13, 1274126177);
	h = (h ^ h >>> 16) >>> 0;
	return h / 4294967296;
}
var GlUnderwaterLayer = class {
	/** Set by pack() each frame; composite() no-ops when off. */
	active = false;
	/** The baked caustic tile (RG8, mipped, repeat) — the mesh FS taps it. */
	causticTex = null;
	gl;
	mulProg = {
		p: null,
		u: {}
	};
	addProg = {
		p: null,
		u: {}
	};
	shaftProg = {
		p: null,
		u: {}
	};
	fsVao = null;
	shaftVao = null;
	shaftInst;
	blackTex = null;
	shaftTarget = null;
	shaftW = 0;
	shaftH = 0;
	shaftDrawn = false;
	shaftCount = 0;
	instData = new Float32Array(MAX_SHAFTS * 8);
	invVP = /* @__PURE__ */ new Float32Array(16);
	vp = /* @__PURE__ */ new Float32Array(16);
	cam = [
		0,
		0,
		0,
		0
	];
	sigma = [
		0,
		0,
		0,
		0
	];
	sunSigma = [
		0,
		0,
		0,
		0
	];
	water = [
		0,
		0,
		0,
		0
	];
	screen = [
		0,
		0,
		0,
		0
	];
	sun = [
		0,
		-1,
		0,
		0
	];
	sunColT = [
		1,
		1,
		1,
		0
	];
	parm = [
		0,
		0,
		0,
		0
	];
	fade = [
		0,
		0,
		0,
		0
	];
	constructor(gl) {
		this.rebuild(gl);
	}
	rebuild(gl) {
		this.gl = gl;
		this.fsVao = null;
		this.shaftVao = null;
		this.shaftTarget = null;
		this.shaftW = 0;
		this.shaftH = 0;
		this.shaftInst = new InstanceBuffer(gl);
		const make = (vs, fs, label, uniforms, samplers) => {
			const p = compileProgram(gl, vs, fs, label);
			const u = {};
			if (p) {
				for (const name of uniforms) u[name] = gl.getUniformLocation(p, name);
				gl.useProgram(p);
				for (const [name, unit] of Object.entries(samplers)) {
					const loc = gl.getUniformLocation(p, name);
					if (loc) gl.uniform1i(loc, unit);
				}
			}
			return {
				p,
				u
			};
		};
		const fsVs = buildGlFullscreenVertGLSL();
		const compU = [
			"uInvVP",
			"uCam",
			"uSigma",
			"uSunSigma",
			"uWater",
			"uScreen"
		];
		this.mulProg = make(fsVs, buildGlUnderwaterMulFragGLSL(), "GlUnderwater mul", compU, { uDepth: 0 });
		this.addProg = make(fsVs, buildGlUnderwaterAddFragGLSL(), "GlUnderwater add", compU, {
			uDepth: 0,
			uShaft: 1
		});
		this.shaftProg = make(buildGlShaftVertGLSL(), buildGlShaftFragGLSL(), "GlUnderwater shafts", [
			"uViewProj",
			"uInvVP",
			"uCam",
			"uSun",
			"uSunCol",
			"uParm",
			"uFade"
		], { uDepth: 0 });
		this.blackTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.blackTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([
			0,
			0,
			0,
			255
		]));
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		const size = 512;
		const mips = 1 + Math.floor(Math.log2(size));
		if (this.causticTex) gl.deleteTexture(this.causticTex);
		this.causticTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.causticTex);
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
		let fieldR = bakeCausticField(size, 1);
		let fieldG = bakeCausticField(size, 3.7);
		let w = size;
		for (let m = 0; m < mips; m++) {
			const bytes = new Uint8Array(w * w * 2);
			for (let i = 0; i < w * w; i++) {
				const r = Math.round(fieldR[i] * .5 * 255);
				const g = Math.round(fieldG[i] * .5 * 255);
				bytes[i * 2] = r < 0 ? 0 : r > 255 ? 255 : r;
				bytes[i * 2 + 1] = g < 0 ? 0 : g > 255 ? 255 : g;
			}
			gl.texImage2D(gl.TEXTURE_2D, m, gl.RG8, w, w, 0, gl.RG, gl.UNSIGNED_BYTE, bytes);
			if (m + 1 < mips) {
				const hw = w >> 1;
				const nextR = new Float32Array(hw * hw);
				const nextG = new Float32Array(hw * hw);
				for (let y = 0; y < hw; y++) for (let x = 0; x < hw; x++) {
					const i0 = y * 2 * w + x * 2, i1 = i0 + w;
					nextR[y * hw + x] = (fieldR[i0] + fieldR[i0 + 1] + fieldR[i1] + fieldR[i1 + 1]) * .25;
					nextG[y * hw + x] = (fieldG[i0] + fieldG[i0 + 1] + fieldG[i1] + fieldG[i1 + 1]) * .25;
				}
				fieldR = nextR;
				fieldG = nextG;
				w = hw;
			}
		}
		gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
	}
	/** Pack this frame's uniforms + the shaft ring from the live handle —
	* Underwater3dLayer.pack()'s maths, verbatim. */
	pack(uw, vp, eye, sun, sunI, time, storm) {
		this.active = uw.active;
		if (!uw.active) return;
		this.vp.set(vp);
		this.invVP.set(mat4Inverse(vp));
		const sig = uw.viewSigma();
		const wc = rgba(uw.fogNow.color);
		this.cam = [
			eye.x,
			eye.y,
			eye.z,
			1
		];
		this.sigma = [
			sig[0],
			sig[1],
			sig[2],
			uw.surfaceY
		];
		const ss = uw.sunSigmaNow();
		this.sunSigma = [
			ss[0],
			ss[1],
			ss[2],
			uw.fullUnder
		];
		this.water = [
			wc[0],
			wc[1],
			wc[2],
			uw.grade
		];
		const feather = .12 + uw.fullUnder * .4;
		const meniscus = .5 * (1 - uw.fullUnder);
		this.screen = [
			feather,
			meniscus,
			uw.vignette,
			uw.wobble
		];
		const sl = Math.hypot(sun.x, sun.y, sun.z) || 1;
		const up = -sun.y / sl;
		const horizonK = Math.min(1, Math.max(0, (up - .08) / .2));
		const dk = Math.min(1, Math.max(0, (uw.depth - .2) / 1.2));
		const depthK = dk * dk * (3 - 2 * dk);
		const clr = Math.min(1, Math.max(0, uw.clarity));
		const dStart = 12 + 12 * clr, dEnd = 30 + 18 * clr;
		const dd = Math.min(1, Math.max(0, (uw.depth - dStart) / (dEnd - dStart)));
		const deepK = 1 - dd * dd * (3 - 2 * dd);
		const shaftI = uw.rays ? uw.rayStrength * Math.max(0, sunI) * horizonK * depthK * deepK * (1 - .7 * Math.min(1, storm)) : 0;
		const flatLevel = uw.water && !uw.water.dead ? uw.water.levelNow() : uw.surfaceY;
		const reach = 30 + 14 * clr;
		const radius = Math.max(uw.rayNear, 6);
		const beamSpacing = Math.max(uw.rayGap * .12, 1.2);
		const N = Math.min(MAX_SHAFTS, Math.max(24, Math.round(2 * Math.PI * radius / beamSpacing)));
		const TAU = 2 * Math.PI;
		const rr = 1 / 1.333;
		const ddx = sun.x / sl * rr, ddy = sun.y / sl, ddz = sun.z / sl * rr;
		const ddl = Math.hypot(ddx, ddy, ddz) || 1;
		this.sun = [
			ddx / ddl,
			ddy / ddl,
			ddz / ddl,
			shaftI
		];
		this.sunColT = [
			1,
			1,
			1,
			time
		];
		this.parm = [
			flatLevel,
			uw.rayBand,
			uw.sunSigma[1] * .6,
			reach
		];
		this.fade = [
			radius * .15,
			6,
			radius * 1.9,
			uw.rayFlicker
		];
		let n = 0;
		if (shaftI > .001) {
			const inst = this.instData;
			const groundFn = uw.water && !uw.water.dead && uw.water.ground ? uw.water.ground : null;
			const axisYabs = Math.max(Math.abs(ddy / ddl), .25);
			const baseY = flatLevel - uw.rayBand;
			for (let i = 0; i < N; i++) {
				const az = i / N * TAU + (cellHash(i, 0, 5) - .5) * (TAU / N) * .8;
				const rj = radius * (.85 + .3 * cellHash(i, 0, 3));
				const bx = eye.x + Math.cos(az) * rj;
				const bz = eye.z + Math.sin(az) * rj;
				let maxLen = reach;
				if (groundFn) maxLen = (baseY - groundFn(bx, bz) - 5) / axisYabs;
				const len = Math.max(0, Math.min(reach * (.85 + .3 * cellHash(i, 0, 17)), maxLen));
				const o = n * 8;
				inst[o] = bx;
				inst[o + 1] = bz;
				inst[o + 2] = len;
				inst[o + 3] = .5 + .9 * cellHash(i, 0, 19);
				inst[o + 4] = cellHash(i, 0, 23) * TAU;
				inst[o + 5] = .12 + .18 * cellHash(i, 0, 29);
				inst[o + 6] = 1.2 + 1.6 * cellHash(i, 0, 31);
				inst[o + 7] = 0;
				n++;
			}
		}
		this.shaftCount = n;
	}
	/** Draw the shaft ring into the half-res R8 target (additive), then
	* restore the caller's FBO + viewport. */
	renderShafts(depthTex, width, height, restoreFbo) {
		const gl = this.gl;
		this.shaftDrawn = false;
		if (!this.active || !depthTex) return;
		const hw = Math.max(1, width >> 1), hh = Math.max(1, height >> 1);
		if (!this.shaftTarget || this.shaftW !== hw || this.shaftH !== hh) {
			if (this.shaftTarget) {
				gl.deleteTexture(this.shaftTarget.tex);
				gl.deleteFramebuffer(this.shaftTarget.fbo);
			}
			const tex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texStorage2D(gl.TEXTURE_2D, 1, gl.R8, hw, hh);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			const fbo = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
			this.shaftTarget = {
				fbo,
				tex
			};
			this.shaftW = hw;
			this.shaftH = hh;
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.shaftTarget.fbo);
		gl.viewport(0, 0, hw, hh);
		gl.disable(gl.DEPTH_TEST);
		gl.clearColor(0, 0, 0, 1);
		gl.clear(gl.COLOR_BUFFER_BIT);
		if (this.shaftCount > 0 && this.shaftProg.p) {
			gl.useProgram(this.shaftProg.p);
			const u = this.shaftProg.u;
			if (u.uViewProj) gl.uniformMatrix4fv(u.uViewProj, false, this.vp);
			if (u.uInvVP) gl.uniformMatrix4fv(u.uInvVP, false, this.invVP);
			if (u.uCam) gl.uniform4fv(u.uCam, this.cam);
			if (u.uSun) gl.uniform4fv(u.uSun, this.sun);
			if (u.uSunCol) gl.uniform4fv(u.uSunCol, this.sunColT);
			if (u.uParm) gl.uniform4fv(u.uParm, this.parm);
			if (u.uFade) gl.uniform4fv(u.uFade, this.fade);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, depthTex);
			if (!this.shaftVao) this.shaftVao = gl.createVertexArray();
			gl.bindVertexArray(this.shaftVao);
			this.shaftInst.upload(this.instData, this.shaftCount * 8);
			instanceVec4Attribs(gl, 0, 2);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, this.shaftCount);
			gl.disable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.bindVertexArray(null);
		}
		this.shaftDrawn = true;
		gl.bindFramebuffer(gl.FRAMEBUFFER, restoreFbo);
		gl.viewport(0, 0, width, height);
	}
	/** The two blended fullscreen draws into the (bound) scene FBO — multiply
	* extinction, then add in-scatter/meniscus/shafts. Returns draws issued. */
	composite(depthTex) {
		const gl = this.gl;
		if (!this.active || !this.mulProg.p || !this.addProg.p || !depthTex) return 0;
		gl.disable(gl.DEPTH_TEST);
		gl.enable(gl.BLEND);
		if (!this.fsVao) this.fsVao = gl.createVertexArray();
		gl.bindVertexArray(this.fsVao);
		const setU = (prog) => {
			const u = prog.u;
			if (u.uInvVP) gl.uniformMatrix4fv(u.uInvVP, false, this.invVP);
			if (u.uCam) gl.uniform4fv(u.uCam, this.cam);
			if (u.uSigma) gl.uniform4fv(u.uSigma, this.sigma);
			if (u.uSunSigma) gl.uniform4fv(u.uSunSigma, this.sunSigma);
			if (u.uWater) gl.uniform4fv(u.uWater, this.water);
			if (u.uScreen) gl.uniform4fv(u.uScreen, this.screen);
		};
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, depthTex);
		gl.useProgram(this.mulProg.p);
		setU(this.mulProg);
		gl.blendFuncSeparate(gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.ONE);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.useProgram(this.addProg.p);
		setU(this.addProg);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, this.shaftDrawn && this.shaftTarget ? this.shaftTarget.tex : this.blackTex);
		gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.disable(gl.BLEND);
		gl.bindVertexArray(null);
		return 2;
	}
};
//#endregion
//#region src/lib/webgl3d/grass.ts
var MAX_BLADES = 4e4;
var MAX_CARDS = 16e3;
var CARD_CELLS = 128;
/** The sin-hash pair — bladeComputeWGSL's hash2/rand, ported exactly so the
* CPU field reproduces the GPU distribution. */
function hash2x(px, pz) {
	return fract(Math.sin(px * 127.1 + pz * 311.7) * 43758.5453);
}
function hash2y(px, pz) {
	return fract(Math.sin(px * 269.5 + pz * 183.3) * 43758.5453);
}
function rand2(px, pz) {
	return fract(Math.sin(px * 419.2 + pz * 71.9) * 43758.5453);
}
var fract = (v) => v - Math.floor(v);
var smooth01 = (e0, e1, x) => {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
	return t * t * (3 - 2 * t);
};
/** A follow-window blade field bound to one terrain — the GL Grass3d. */
var GlGrass3d = class {
	field;
	colormap;
	/** Live dials (grass3d parity where portable). */
	showBlades = true;
	/** Straw/hay recolour 0..1 — live. */
	dryness = 0;
	dead = false;
	span;
	cells;
	height;
	width;
	windDir;
	windStr;
	dynamic;
	groundTint;
	green;
	/** Far billboard cards (grass3d parity where portable). */
	showCards = true;
	/** Fraction of the field that flowers (drift-gated). Live-mutable. */
	flowerAmount = 0;
	farSpan;
	cardW;
	cardH;
	flowerCount;
	cardFrames = 1;
	gl;
	prog = {
		p: null,
		u: {}
	};
	vao = null;
	inst;
	data = new Float32Array(MAX_BLADES * 12);
	count = 0;
	cardProg = {
		p: null,
		u: {}
	};
	cardVao = null;
	cardInst;
	cardData = new Float32Array(MAX_CARDS * 12);
	cardCount = 0;
	cardTex = null;
	constructor(gl, field, colormap, opts = {}) {
		this.field = field;
		this.colormap = colormap;
		this.span = opts.span ?? 44;
		this.cells = Math.min(opts.cells ?? 224, 288);
		this.dynamic = opts.dynamic ?? .5;
		this.height = opts.height ?? 1.1;
		this.width = opts.width ?? .03;
		this.windDir = opts.windDir ?? .6;
		this.windStr = opts.wind ?? .25;
		this.groundTint = opts.groundTint ?? .3;
		const c = rgba(opts.color ?? "#6db544");
		this.green = [
			c[0],
			c[1],
			c[2]
		];
		this.farSpan = opts.farSpan ?? 360;
		this.cardW = opts.cardWidth ?? .7;
		this.cardH = opts.cardHeight ?? this.height;
		this.flowerCount = Math.max(0, Math.round(opts.flowers ?? 0));
		this.rebuild(gl);
	}
	rebuild(gl) {
		this.gl = gl;
		this.vao = null;
		this.inst = new InstanceBuffer(gl);
		const p = compileProgram(gl, buildGlGrassVertGLSL(), buildGlGrassFragGLSL(), "GlGrass3d blades");
		const u = {};
		if (p) for (const name of [
			"uViewProj",
			"uParams",
			"uWind",
			"uCamPos",
			"uFogColor",
			"uLightDir",
			"uAmbSky",
			"uAmbGround",
			"uSunCol"
		]) u[name] = gl.getUniformLocation(p, name);
		this.prog = {
			p,
			u
		};
		const cp = compileProgram(gl, buildGlGrassCardVertGLSL(), buildGlGrassCardFragGLSL(), "GlGrass3d cards");
		const cu = {};
		if (cp) {
			for (const name of [
				"uViewProj",
				"uParams",
				"uWind",
				"uRight",
				"uCamPos",
				"uFogColor",
				"uLightDir",
				"uAmbSky",
				"uAmbGround",
				"uSunCol"
			]) cu[name] = gl.getUniformLocation(cp, name);
			gl.useProgram(cp);
			const loc = gl.getUniformLocation(cp, "uCardTex");
			if (loc) gl.uniform1i(loc, 0);
		}
		this.cardProg = {
			p: cp,
			u: cu
		};
		this.cardVao = null;
		this.cardInst = new InstanceBuffer(gl);
		this.cardTex = this.makeCardTexture();
	}
	makeCardTexture() {
		if (typeof document === "undefined") return null;
		const gl = this.gl;
		const S = 256;
		const bake = (draw, fill, seed0 = 1234.5) => {
			const cv = document.createElement("canvas");
			cv.width = cv.height = S;
			const ctx = cv.getContext("2d");
			ctx.clearRect(0, 0, S, S);
			let seed = seed0;
			const rnd = () => {
				seed = (seed * 16807 + 7) % 2147483647;
				return seed % 1e4 / 1e4;
			};
			draw(ctx, rnd);
			const px = ctx.getImageData(0, 0, S, S).data;
			for (let i = 0; i < px.length; i += 4) {
				const a = px[i + 3] / 255;
				px[i] = px[i] * a + fill[0] * (1 - a);
				px[i + 1] = px[i + 1] * a + fill[1] * (1 - a);
				px[i + 2] = px[i + 2] * a + fill[2] * (1 - a);
			}
			return new Uint8Array(px.buffer.slice(0));
		};
		const layers = [bake((ctx, rnd) => this.drawGrassClump(ctx, S, rnd), [
			46,
			92,
			38
		])];
		for (let f = 0; f < this.flowerCount; f++) layers.push(bake((ctx, rnd) => this.drawFlowerClump(ctx, S, rnd, f), [
			46,
			92,
			38
		], 811.3 + f * 131.7));
		this.cardFrames = layers.length;
		const tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D_ARRAY, tex);
		const mips = 1 + Math.floor(Math.log2(S));
		gl.texStorage3D(gl.TEXTURE_2D_ARRAY, mips, gl.SRGB8_ALPHA8, S, S, layers.length);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		layers.forEach((lvl0, layer) => {
			gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, layer, S, S, 1, gl.RGBA, gl.UNSIGNED_BYTE, lvl0);
		});
		gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
		gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return tex;
	}
	/** Grass CLUMP silhouette — grass3d.drawGrassClump, verbatim. */
	drawGrassClump(ctx, S, rnd) {
		const blades = 17;
		for (let i = 0; i < blades; i++) {
			const bx = (.1 + rnd() * .8) * S;
			const topY = (.02 + rnd() * .35) * S;
			const w = (.018 + rnd() * .028) * S;
			const bend = (rnd() - .5) * .3 * S;
			const g0 = ctx.createLinearGradient(0, S, 0, topY);
			const lum = .55 + rnd() * .3;
			g0.addColorStop(0, `rgba(${34 * lum | 0}, ${70 * lum | 0}, ${28 * lum | 0}, 1)`);
			g0.addColorStop(1, `rgba(${120 * lum | 0}, ${180 * lum | 0}, ${70 * lum | 0}, 1)`);
			ctx.fillStyle = g0;
			ctx.beginPath();
			ctx.moveTo(bx - w, S);
			ctx.lineTo(bx + w, S);
			ctx.quadraticCurveTo(bx + bend * .5, (S + topY) * .5, bx + bend, topY);
			ctx.closePath();
			ctx.fill();
		}
	}
	/** FLOWER cluster — grass3d.drawFlowerClump, verbatim (albedo petals). */
	drawFlowerClump(ctx, S, rnd, variant) {
		for (let i = 0; i < 8; i++) {
			const bx = (.12 + rnd() * .76) * S;
			const topY = (.28 + rnd() * .32) * S;
			const w = (.014 + rnd() * .02) * S;
			const bend = (rnd() - .5) * .24 * S;
			const lum = .5 + rnd() * .25;
			ctx.fillStyle = `rgba(${40 * lum | 0}, ${86 * lum | 0}, ${34 * lum | 0}, 1)`;
			ctx.beginPath();
			ctx.moveTo(bx - w, S);
			ctx.lineTo(bx + w, S);
			ctx.quadraticCurveTo(bx + bend * .5, (S + topY) * .5, bx + bend, topY);
			ctx.closePath();
			ctx.fill();
		}
		const palettes = [
			{
				petal: [
					214,
					42,
					34
				],
				centre: [
					30,
					18,
					12
				],
				petals: 5,
				r: .11
			},
			{
				petal: [
					244,
					244,
					232
				],
				centre: [
					240,
					198,
					44
				],
				petals: 12,
				r: .085
			},
			{
				petal: [
					78,
					96,
					214
				],
				centre: [
					40,
					40,
					70
				],
				petals: 8,
				r: .075
			},
			{
				petal: [
					248,
					208,
					44
				],
				centre: [
					200,
					150,
					24
				],
				petals: 8,
				r: .09
			},
			{
				petal: [
					226,
					118,
					176
				],
				centre: [
					230,
					220,
					90
				],
				petals: 6,
				r: .09
			},
			{
				petal: [
					178,
					96,
					214
				],
				centre: [
					236,
					214,
					80
				],
				petals: 7,
				r: .08
			}
		];
		const pal = palettes[variant % palettes.length];
		const heads = 3 + (rnd() * 4 | 0);
		for (let h = 0; h < heads; h++) {
			const hx = (.2 + rnd() * .6) * S;
			const hy = (.08 + rnd() * .34) * S;
			const r = pal.r * S * (.8 + rnd() * .5);
			ctx.strokeStyle = "rgba(46, 96, 40, 1)";
			ctx.lineWidth = .012 * S;
			ctx.beginPath();
			ctx.moveTo(hx + (rnd() - .5) * .06 * S, S);
			ctx.quadraticCurveTo(hx, (hy + S) * .5, hx, hy);
			ctx.stroke();
			ctx.fillStyle = `rgb(${pal.petal[0]}, ${pal.petal[1]}, ${pal.petal[2]})`;
			for (let p = 0; p < pal.petals; p++) {
				const a = p / pal.petals * Math.PI * 2 + rnd() * .2;
				ctx.save();
				ctx.translate(hx, hy);
				ctx.rotate(a);
				ctx.beginPath();
				ctx.ellipse(0, -r * .72, r * .34, r * .72, 0, 0, Math.PI * 2);
				ctx.fill();
				ctx.restore();
			}
			ctx.fillStyle = `rgb(${pal.centre[0]}, ${pal.centre[1]}, ${pal.centre[2]})`;
			ctx.beginPath();
			ctx.arc(hx, hy, r * .42, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	/** Terrain height — the baked-heightfield bilinear the compute used
	* (dim = res+1; texel i ↔ world (i/res − 0.5)·size). */
	groundAt(wx, wz) {
		const res = this.field.res;
		const h = this.field.heights;
		const fx = (wx / this.field.size + .5) * res;
		const fz = (wz / this.field.size + .5) * res;
		const x0 = Math.min(Math.max(Math.floor(fx), 0), res);
		const z0 = Math.min(Math.max(Math.floor(fz), 0), res);
		const x1 = Math.min(x0 + 1, res);
		const z1 = Math.min(z0 + 1, res);
		const tx = fx - Math.floor(fx), tz = fz - Math.floor(fz);
		const dim = res + 1;
		const a = h[z0 * dim + x0], b = h[z0 * dim + x1];
		const cc = h[z1 * dim + x0], d = h[z1 * dim + x1];
		return a + (b - a) * tx + (cc + (d - cc) * tx - (a + (b - a) * tx)) * tz;
	}
	/** CPU SPAWN — bladeComputeWGSL's per-cell maths over the follow lattice,
	* packing surviving blades (≤ MAX_BLADES) for one instanced draw. */
	spawn(camX, camY, camZ, planes) {
		this.count = 0;
		if (!this.showBlades) return;
		const cells = this.cells;
		this.span / cells * (320 / cells) * cells / (320 / 1);
		const cellW = this.span / cells;
		const halfSpan = this.span * .5;
		const ox = Math.floor(camX / cellW) - cells * .5;
		const oz = Math.floor(camZ / cellW) - cells * .5;
		const ext = this.field.size * .5;
		const cm = this.colormap;
		const d = this.data;
		for (let iz = 0; iz < cells; iz++) {
			const wcz = oz + iz;
			for (let ix = 0; ix < cells; ix++) {
				const wcx = ox + ix;
				const jx = hash2x(wcx, wcz), jy = hash2y(wcx, wcz);
				const bx = (wcx + .5 + (jx - .5) * .9) * cellW;
				const bz = (wcz + .5 + (jy - .5) * .9) * cellW;
				const dx = bx - camX, dz = bz - camZ;
				const dist = Math.sqrt(dx * dx + dz * dz);
				if (dist > halfSpan) continue;
				if (Math.abs(bx) > ext || Math.abs(bz) > ext) continue;
				const keepProb = this.dynamic * (1 + -.88 * smooth01(halfSpan * .3, halfSpan, dist));
				if (rand2(wcx * 7.1, wcz * 3.3) > keepProb) continue;
				const tu = Math.min(Math.max((bx / this.field.size + .5) * cm.res, 0), cm.res - 1) | 0;
				const pi = ((Math.min(Math.max((bz / this.field.size + .5) * cm.res, 0), cm.res - 1) | 0) * cm.res + tu) * 4;
				const br = cm.pixels[pi] / 255, bg = cm.pixels[pi + 1] / 255, bb = cm.pixels[pi + 2] / 255;
				const grassy = smooth01(0, .05, bg - Math.max(br, bb));
				if (grassy < .25) continue;
				const gy = this.groundAt(bx, bz);
				const edgeFade = smooth01(halfSpan, halfSpan * .35, dist);
				const hgt = this.height * (.6 + rand2(wcz, wcx) * .7) * grassy * edgeFade;
				if (hgt < .03) continue;
				if (planes && !sphereVsFrustum(planes, bx, gy + hgt * .5, bz, hgt)) continue;
				const yaw = jx * 6.28318 + rand2(wcx * 1.3, wcz) * .6;
				const bend = .1 + jy * .22;
				const wdt = this.width * (.6 + rand2(wcx * 5.3, wcz) * .9);
				const hueV = (rand2(wcx * 2.7, wcz * 1.9) - .5) * .12;
				const bright = .82 + rand2(wcx, wcz * 2.1) * .36;
				const gt = this.groundTint;
				const r = Math.max(0, (this.green[0] * (1 - gt) + br * gt) * bright + hueV * .5);
				const g = Math.max(0, (this.green[1] * (1 - gt) + bg * gt) * bright + hueV);
				const bl = Math.max(0, (this.green[2] * (1 - gt) + bb * gt) * bright - hueV * .5);
				const phase = rand2(wcz * 3.7, wcx) * 6.28318;
				const o = this.count * 12;
				d[o] = bx;
				d[o + 1] = gy;
				d[o + 2] = bz;
				d[o + 3] = hgt;
				d[o + 4] = Math.sin(yaw);
				d[o + 5] = Math.cos(yaw);
				d[o + 6] = bend;
				d[o + 7] = wdt;
				d[o + 8] = r;
				d[o + 9] = g;
				d[o + 10] = bl;
				d[o + 11] = phase;
				this.count++;
				if (this.count >= MAX_BLADES) {
					iz = cells;
					break;
				}
			}
		}
		this.spawnCards(camX, camZ, planes);
	}
	/** Low-frequency value noise (cardComputeWGSL's vnoise — flower drifts). */
	vnoise(x, y) {
		const ix = Math.floor(x), iy = Math.floor(y);
		const fx = x - ix, fy = y - iy;
		const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
		const a = rand2(ix, iy), b = rand2(ix + 1, iy);
		const c = rand2(ix, iy + 1), d = rand2(ix + 1, iy + 1);
		return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
	}
	/** CPU card spawn — cardComputeWGSL's per-cell maths over a coarser far
	* lattice (128² vs 300²), capped at 16k. Existence is WORLD-anchored
	* (grassy ground + far-edge taper only — no camera terms, the flicker/mow
	* lesson); the frustum cull applies only past 30u like the original. */
	spawnCards(camX, camZ, planes) {
		this.cardCount = 0;
		if (!this.showCards || !this.cardTex) return;
		const cells = CARD_CELLS;
		const spacing = this.farSpan / cells;
		const halfSpan = this.farSpan * .5;
		const ox = Math.floor(camX / spacing) - cells * .5;
		const oz = Math.floor(camZ / spacing) - cells * .5;
		const ext = this.field.size * .5;
		const cm = this.colormap;
		const d = this.cardData;
		const fl = this.cardFrames - 1;
		for (let iz = 0; iz < cells; iz++) {
			const wcz = oz + iz;
			for (let ix = 0; ix < cells; ix++) {
				const wcx = ox + ix;
				const jx = hash2x(wcx * 1.7, wcz * 2.3), jy = hash2y(wcx * 1.7, wcz * 2.3);
				const bx = (wcx + .5 + (jx - .5) * .9) * spacing;
				const bz = (wcz + .5 + (jy - .5) * .9) * spacing;
				const dx = bx - camX, dz = bz - camZ;
				const dist = Math.sqrt(dx * dx + dz * dz);
				if (dist > halfSpan) continue;
				if (Math.abs(bx) > ext || Math.abs(bz) > ext) continue;
				const tu = Math.min(Math.max((bx / this.field.size + .5) * cm.res, 0), cm.res - 1) | 0;
				const pi = ((Math.min(Math.max((bz / this.field.size + .5) * cm.res, 0), cm.res - 1) | 0) * cm.res + tu) * 4;
				const br = cm.pixels[pi] / 255, bg = cm.pixels[pi + 1] / 255, bb = cm.pixels[pi + 2] / 255;
				const grassy = smooth01(0, .05, bg - Math.max(br, bb));
				if (grassy < .25) continue;
				const keepP = grassy * (1 - smooth01(halfSpan * .85, halfSpan, dist));
				if (rand2(wcx * 9.3, wcz * 5.7) > keepP) continue;
				const gy = this.groundAt(bx, bz);
				const hgt = this.cardH * (.7 + rand2(wcz * 2.2, wcx) * .6);
				if (planes && dist > 30 && !sphereVsFrustum(planes, bx, gy + hgt * .5, bz, hgt * 2)) continue;
				const wdt = this.cardW * (.7 + rand2(wcx * 3.1, wcz) * .6);
				const hueV = (rand2(wcx * 2.7, wcz * 1.9) - .5) * .1;
				const gt = Math.max(this.groundTint, .35);
				const bright = .82 + rand2(wcx, wcz) * .32;
				const r = Math.max(0, (this.green[0] * (1 - gt) + br * gt) * bright + hueV * .5);
				const g = Math.max(0, (this.green[1] * (1 - gt) + bg * gt) * bright + hueV);
				const bl = Math.max(0, (this.green[2] * (1 - gt) + bb * gt) * bright - hueV * .5);
				let frame = 0;
				if (fl > 0 && this.flowerAmount > .001) {
					if (this.vnoise(bx * .05, bz * .05) > 1 - this.flowerAmount && rand2(wcx * 5.9, wcz * 8.1) < .5) frame = 1 + (rand2(wcz * 1.3, wcx * 4.4) * fl | 0) % fl;
				}
				const o = this.cardCount * 12;
				d[o] = bx;
				d[o + 1] = gy;
				d[o + 2] = bz;
				d[o + 3] = hgt;
				d[o + 4] = wdt;
				d[o + 5] = rand2(wcz * 3.7, wcx) * 6.28318;
				d[o + 6] = 1;
				d[o + 7] = frame;
				d[o + 8] = r;
				d[o + 9] = g;
				d[o + 10] = bl;
				d[o + 11] = 0;
				this.cardCount++;
				if (this.cardCount >= MAX_CARDS) return;
			}
		}
	}
	/** Draw the packed blades — inside the OPAQUE pass (depth write on, cull
	* off; blades are double-sided). Returns draws issued. */
	draw(frame) {
		const gl = this.gl;
		if (!this.prog.p || this.count === 0) return 0;
		gl.useProgram(this.prog.p);
		const u = this.prog.u;
		if (u.uViewProj) gl.uniformMatrix4fv(u.uViewProj, false, frame.vp);
		if (u.uCamPos) gl.uniform4fv(u.uCamPos, frame.camPos);
		if (u.uFogColor) gl.uniform4fv(u.uFogColor, frame.fogColor);
		if (u.uParams) gl.uniform4fv(u.uParams, frame.params);
		if (u.uLightDir) gl.uniform4fv(u.uLightDir, frame.lightDir);
		if (u.uAmbSky) gl.uniform4fv(u.uAmbSky, frame.ambSky);
		if (u.uAmbGround) gl.uniform4fv(u.uAmbGround, frame.ambGround);
		if (u.uSunCol) gl.uniform4fv(u.uSunCol, frame.sunCol);
		if (u.uWind) gl.uniform4f(u.uWind, Math.cos(this.windDir), Math.sin(this.windDir), this.windStr, this.dryness);
		if (!this.vao) this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		this.inst.upload(this.data, this.count * 12);
		instanceVec4Attribs(gl, 0, 3);
		gl.disable(gl.CULL_FACE);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 10, this.count);
		gl.enable(gl.CULL_FACE);
		gl.bindVertexArray(null);
		return 1 + this.drawCards(frame);
	}
	/** Draw the far cards — cardRenderWGSL's pass (Y-billboards, alpha test,
	* depth write on, cull off), sharing the frame uniforms. */
	drawCards(frame) {
		const gl = this.gl;
		if (!this.cardProg.p || !this.cardTex || this.cardCount === 0) return 0;
		gl.useProgram(this.cardProg.p);
		const u = this.cardProg.u;
		if (u.uViewProj) gl.uniformMatrix4fv(u.uViewProj, false, frame.vp);
		if (u.uCamPos) gl.uniform4fv(u.uCamPos, frame.camPos);
		if (u.uFogColor) gl.uniform4fv(u.uFogColor, frame.fogColor);
		if (u.uParams) gl.uniform4fv(u.uParams, frame.params);
		if (u.uLightDir) gl.uniform4fv(u.uLightDir, frame.lightDir);
		if (u.uAmbSky) gl.uniform4fv(u.uAmbSky, frame.ambSky);
		if (u.uAmbGround) gl.uniform4fv(u.uAmbGround, frame.ambGround);
		if (u.uSunCol) gl.uniform4fv(u.uSunCol, frame.sunCol);
		if (u.uRight) gl.uniform4fv(u.uRight, frame.right);
		if (u.uWind) gl.uniform4f(u.uWind, Math.cos(this.windDir), Math.sin(this.windDir), this.windStr, this.dryness);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D_ARRAY, this.cardTex);
		if (!this.cardVao) this.cardVao = gl.createVertexArray();
		gl.bindVertexArray(this.cardVao);
		this.cardInst.upload(this.cardData, this.cardCount * 12);
		instanceVec4Attribs(gl, 0, 3);
		gl.disable(gl.CULL_FACE);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.cardCount);
		gl.enable(gl.CULL_FACE);
		gl.bindVertexArray(null);
		return 1;
	}
	destroy() {
		this.dead = true;
	}
};
//#endregion
//#region src/lib/webgl3d/world.ts
var MESH_FLOATS = 28;
var BB_FLOATS = 16;
var BLOB_FLOATS = 8;
var FX_FLOATS = 16;
/** A retained mesh — mutate fields freely; kill() removes it. */
var Mesh3d = class {
	x;
	y;
	z;
	w;
	h;
	d;
	yaw;
	pitch;
	roll;
	color;
	alpha;
	gloss;
	metallic;
	rough;
	texture;
	normalMap;
	tile;
	bump;
	emissive;
	grain;
	blob;
	static;
	/** @internal VS-skinning palette slice base (mat4 units). */
	paletteBase = 0;
	parent;
	inputEnabled = false;
	dead = false;
	constructor(c = {}) {
		this.x = c.x ?? 0;
		this.y = c.y ?? 0;
		this.z = c.z ?? 0;
		this.w = c.w ?? 1;
		this.h = c.h ?? 1;
		this.d = c.d ?? 1;
		this.yaw = c.yaw ?? 0;
		this.pitch = c.pitch ?? 0;
		this.roll = c.roll ?? 0;
		this.color = c.color ?? (c.texture != null && c.texture >= 0 ? "#ffffff" : "#8a93b5");
		this.alpha = c.alpha ?? 1;
		this.gloss = c.gloss ?? 0;
		this.metallic = c.metallic ?? 0;
		this.rough = c.rough ?? null;
		this.texture = c.texture ?? -1;
		this.normalMap = c.normalMap ?? -1;
		this.tile = c.tile ?? 1;
		this.bump = c.bump ?? 1;
		this.emissive = c.emissive ?? 0;
		this.grain = 0;
		this.blob = c.blob;
		this.static = c.static ?? false;
		this.parent = c.parent ?? null;
	}
	kill() {
		this.dead = true;
	}
};
/** @deprecated alias — boxes are just meshes now (World3d parity). */
var Box3d = Mesh3d;
/** A pure transform node (renders nothing) — parent meshes/models to it. */
var Group3d = class {
	x;
	y;
	z;
	yaw;
	pitch;
	roll;
	scale;
	parent;
	constructor(c = {}) {
		this.x = c.x ?? 0;
		this.y = c.y ?? 0;
		this.z = c.z ?? 0;
		this.yaw = c.yaw ?? 0;
		this.pitch = c.pitch ?? 0;
		this.roll = c.roll ?? 0;
		this.scale = c.scale ?? 1;
		this.parent = c.parent ?? null;
	}
	/** Aim this node's local +Z at a world point (sets yaw + pitch). */
	lookAt(x, y, z) {
		const e = lookAtEuler(this.x, this.y, this.z, x, y, z);
		this.yaw = e.yaw;
		this.pitch = e.pitch;
	}
};
/** A retained camera-facing sprite — mutate freely; kill() removes it. */
var Billboard3d = class {
	frame;
	x;
	y;
	z;
	w;
	h;
	tint;
	flipX;
	dead = false;
	constructor(c) {
		this.frame = c.frame;
		this.x = c.x ?? 0;
		this.y = c.y ?? 0;
		this.z = c.z ?? 0;
		this.w = c.w ?? 1;
		this.h = c.h ?? 1;
		this.tint = c.tint;
		this.flipX = c.flipX ?? false;
	}
	kill() {
		this.dead = true;
	}
};
/** A single soft contact-shadow ellipse, decoupled from any mesh. */
var BlobShadow3d = class {
	x;
	y;
	z;
	w;
	d;
	yaw;
	alpha;
	parent;
	dead = false;
	constructor(c = {}) {
		this.x = c.x ?? 0;
		this.y = c.y ?? 0;
		this.z = c.z ?? 0;
		this.w = c.w ?? 1;
		this.d = c.d ?? 1;
		this.yaw = c.yaw ?? 0;
		this.alpha = c.alpha ?? null;
		this.parent = c.parent ?? null;
	}
	kill() {
		this.dead = true;
	}
};
/** A retained wisp — world3d.ts's Wisp3d, duplicated (pure CPU handle). */
var Wisp3d = class {
	frame;
	x;
	y;
	z;
	w;
	h;
	color;
	alpha;
	twist;
	wind;
	speed;
	remap;
	yaw;
	dead = false;
	constructor(c) {
		this.frame = c.frame;
		this.x = c.x ?? 0;
		this.y = c.y ?? 0;
		this.z = c.z ?? 0;
		this.w = c.w ?? 1.5;
		this.h = c.h ?? 6;
		this.color = c.color ?? "#e8eef8";
		this.alpha = c.alpha ?? 1;
		this.twist = c.twist ?? 10;
		this.wind = c.wind ?? 1.2;
		this.speed = c.speed ?? 1;
		this.remap = c.remap ?? [.4, 1];
		this.yaw = c.yaw ?? 0;
	}
	kill() {
		this.dead = true;
	}
};
/** Pure blob-shadow parameters — world3d.ts's blobParams, duplicated (its
* home module is WebGPU-only; same maths, same dist-test coverage there). */
function blobParams(fw, fd, bottom, opts, force = false) {
	if (!force && Math.max(fw, fd) > opts.max) return null;
	if (bottom < -.5 || bottom >= opts.fade) return null;
	const lift = Math.max(0, bottom) / opts.fade;
	const k = .6 * (1 - .3 * lift);
	return {
		rx: fw * k,
		rz: fd * k,
		alpha: opts.alpha * (1 - lift)
	};
}
var pickSeq = 1;
var pickIds = /* @__PURE__ */ new WeakMap();
var GlWorld3d = class {
	renderer;
	atlas;
	opts;
	/** The perspective camera — the same mutable look-at struct as World3d. */
	camera = {
		x: 0,
		y: 8,
		z: 18,
		tx: 0,
		ty: 0,
		tz: 0,
		fov: 60,
		lookAt(x, y, z) {
			this.tx = x;
			this.ty = y;
			this.tz = z;
		},
		lookDir(dx, dy, dz) {
			this.tx = this.x + dx;
			this.ty = this.y + dy;
			this.tz = this.z + dz;
		},
		face(yaw, pitch = 0) {
			const f = forward(yaw, pitch);
			this.tx = this.x + f.x;
			this.ty = this.y + f.y;
			this.tz = this.z + f.z;
		}
	};
	/** Frustum culling at pack time (live-togglable). */
	cull = true;
	/** Blob-shadow config (live) — same fields/defaults as World3d.blobs. */
	blobs = {
		enabled: true,
		alpha: .42,
		max: 10,
		fade: 4,
		ground: 0,
		lift: 0
	};
	/** Rigid-body physics world — assigned by the game, stepped by game.ts. */
	physics = null;
	fog;
	/** The GL path never multisamples its own pass (the canvas may). */
	sampleCount = 1;
	/** The 3D CPU particle system — world.fx.emit / world.burst. */
	fx = new Particles3d();
	/** Live CPU-approximated emitters (see emitter()) — synced each tick. */
	cpuEmitters = [];
	/** The canvas the game renders to — set by game.world3d(), used by orbit(). */
	canvasEl = null;
	/** @internal Installed by game.world3d() — the engine owns the passes (they
	*  read the world depth buffer), so these verbs route back to it. */
	_fx = null;
	/**
	* SSAO — screen-space ambient occlusion over this world: creases, contact
	* points and corners darken naturally. Costs one half-res estimate + blur
	* per frame. `world.ssao(true)`, `world.ssao({ radius, strength, power })`
	* to tune, `false` to stop. WebGPU only.
	*/
	ssao(on = true) {
		this._fx?.ssao(on);
	}
	/**
	* GOD RAYS — screen-space light shafts from this world's sun (one half-res
	* radial march against the opaque depth, composited additively). With a sky
	* attached the day/night dial moves and colours the shafts for free; they
	* fade when the sun leaves the frame and dim under storm. `world.rays(true)`,
	* `{ strength, decay }` to tune, `false` to stop. WebGPU only.
	*/
	rays(on = true) {
		this._fx?.rays(on);
	}
	/** The underwater feature — null until `world.underwater()` (the CPU
	* handle is underwater3d.ts's, reused; game reads submerged/depth). */
	underwater3d = null;
	/** The steering/flocking movement system — null until `world.agents()`
	* (agents3d.ts is pure CPU and reused verbatim). */
	agents3d = null;
	/** The attached orbit rig, if any (world.orbit()). */
	rig = null;
	gl;
	geos = /* @__PURE__ */ new Map();
	bills = [];
	blobShadowsList = [];
	lightsList = [];
	animated = [];
	terrains = [];
	terrainRecs = [];
	terrainSeq = 0;
	skyHandle = null;
	skyStateNow = null;
	skyData = /* @__PURE__ */ new Float32Array(48);
	followCfg = null;
	sun;
	sunColData = [
		1,
		1,
		1,
		1
	];
	time = 0;
	curVp = null;
	curInvVp = null;
	meshProg = {
		p: null,
		u: {},
		stamp: -1
	};
	skinProg = {
		p: null,
		u: {},
		stamp: -1
	};
	bbProg = {
		p: null,
		u: {},
		stamp: -1
	};
	blobProg = {
		p: null,
		u: {},
		stamp: -1
	};
	fxProg = {
		p: null,
		u: {},
		stamp: -1
	};
	skyProg = {
		p: null,
		u: {},
		stamp: -1
	};
	frameStamp = 0;
	atlasTex = null;
	whiteTex = null;
	flatNormalTex = null;
	envTex = null;
	envMips = 1;
	envSource = null;
	envDirty = true;
	envCustom = false;
	envStrength = 1;
	envSunX = 0;
	envSunY = 0;
	envSunZ = 0;
	bbData = new Float32Array(256 * 16);
	bbCount = 0;
	bbVao = null;
	bbInst;
	blobData = new Float32Array(256 * 8);
	blobCount = 0;
	blobVao = null;
	blobInst;
	fxData = new Float32Array(4096 * 16);
	vecShapes = [];
	lineData = new Float32Array(1024 * 16);
	lineVao = null;
	lineInst;
	lineProg;
	linesLast = 0;
	ghostParts = [];
	fxVao = null;
	fxInst;
	skyVao = null;
	trails = [];
	trailNoise = -1;
	trailSeed = 0;
	trailData = /* @__PURE__ */ new Float32Array(1856);
	trailTex = null;
	trailTexRows = 0;
	trailVao = null;
	trailProgView = {
		p: null,
		u: {},
		stamp: -1
	};
	trailProgUp = {
		p: null,
		u: {},
		stamp: -1
	};
	agentGizmos = null;
	voxelLayer = null;
	wisps = [];
	wispData = /* @__PURE__ */ new Float32Array(1280);
	wispVao = null;
	wispInst;
	wispProg = {
		p: null,
		u: {},
		stamp: -1
	};
	shadowOpts = null;
	shadowTex = null;
	shadowFbo = null;
	shadowDummy = null;
	shadowProg = {
		p: null,
		u: {},
		stamp: -1
	};
	shadowSkinProg = {
		p: null,
		u: {},
		stamp: -1
	};
	idMat = (() => {
		const m = /* @__PURE__ */ new Float32Array(16);
		m[0] = m[5] = m[10] = m[15] = 1;
		return m;
	})();
	flareOn = null;
	sunScreenCache = null;
	flareProg = {
		p: null,
		u: {},
		stamp: -1
	};
	probeProg = {
		p: null,
		u: {},
		stamp: -1
	};
	flareQuery = null;
	flareQueryPending = false;
	flareOcc = 1;
	flareOccTarget = 1;
	fsVao = null;
	depthCopyTex = null;
	depthCopyFbo = null;
	depthCopyW = 0;
	depthCopyH = 0;
	ssaoEnabled = false;
	/** Live-tunable SSAO options (ssao.ts defaults). */
	ssaoOpts = {
		radius: .8,
		strength: 1,
		power: 1.5
	};
	ssaoProg = {
		p: null,
		u: {},
		stamp: -1
	};
	ssaoBlurProg = {
		p: null,
		u: {},
		stamp: -1
	};
	ssaoCompProg = {
		p: null,
		u: {},
		stamp: -1
	};
	ssaoTargets = null;
	ssaoW = 0;
	ssaoH = 0;
	raysEnabled = false;
	/** Live-tunable god-ray options (rays.ts defaults). */
	raysOpts = {
		strength: .9,
		decay: .94
	};
	raysProg = {
		p: null,
		u: {},
		stamp: -1
	};
	raysCompProg = {
		p: null,
		u: {},
		stamp: -1
	};
	raysTarget = null;
	raysW = 0;
	raysH = 0;
	curProj = null;
	curNear = .1;
	curFar = 500;
	waters = [];
	waterLayer = null;
	lastDt = 1 / 60;
	uwLayer = null;
	/** The game's own fog, saved while submerged (restored on surfacing). */
	uwSavedFog = void 0;
	/** Grass fields (CPU-spawned blade approximation — webgl3d/grass.ts). */
	grassFields = [];
	/** Deformable terrains (snow/sand carving — the GL DeformRec list). */
	deformRecs = [];
	deformProg = {
		p: null,
		u: {},
		stamp: -1
	};
	patchProg = {
		p: null,
		u: {},
		stamp: -1
	};
	beams = [];
	beamProg = {
		p: null,
		u: {},
		stamp: -1
	};
	beamVao = null;
	beamInst;
	beamData = /* @__PURE__ */ new Float32Array(768);
	weatherPools = [];
	pickProg = {
		p: null,
		u: {},
		stamp: -1
	};
	pickFbo = null;
	pickTex = null;
	pickDepth = null;
	pickW = 0;
	pickH = 0;
	pickVao = null;
	pendingPicks = [];
	palettesData = /* @__PURE__ */ new Float32Array(1024);
	palettesTop = 0;
	paletteTex = null;
	paletteTexRows = 0;
	lightData = /* @__PURE__ */ new Float32Array(128);
	lightCount = 0;
	drawsLast = 0;
	warned = /* @__PURE__ */ new Set();
	unRebuild = null;
	constructor(renderer, atlas, opts = {}) {
		this.renderer = renderer;
		this.atlas = atlas;
		this.opts = opts;
		this.camera.fov = opts.fov ?? 60;
		this.fog = opts.fog === null ? null : opts.fog ?? {
			color: "#0b0e1a",
			near: 25,
			far: 90
		};
		const l = opts.light ?? {};
		this.sun = {
			x: l.x ?? .4,
			y: l.y ?? -.8,
			z: l.z ?? -.45,
			ambient: l.ambient ?? .35,
			sky: l.sky ?? "#ffffff",
			ground: l.ground ?? l.sky ?? "#ffffff"
		};
		this.cull = opts.cull ?? true;
		if (opts.blobShadows === false) this.blobs.enabled = false;
		else if (typeof opts.blobShadows === "object") Object.assign(this.blobs, opts.blobShadows);
		this.rebuild(renderer.gl);
		this.unRebuild = renderer.onRebuild(() => this.rebuild(renderer.gl));
	}
	warnOnce(what, name) {
		if (this.warned.has(name)) return;
		this.warned.add(name);
		console.warn(`Phaser AE: ${what} is WebGPU-only — world.${name}() is inert on the WebGL fallback.`);
	}
	/** Add a box (flat-shaded). `segs` grids each face. */
	box(config = {}) {
		const { segs = 1 } = config;
		return this.mesh(`box:${segs}`, () => cubeVerts(segs), config);
	}
	/** Add a smooth UV sphere (unit diameter — w/h/d scale it). */
	sphere(config = {}) {
		const { segs = 28, rings = 18 } = config;
		return this.mesh(`sphere:${segs},${rings}`, () => sphereVerts(segs, rings), config);
	}
	/** Add a capped cylinder — or a frustum via rTop/rBottom. */
	cylinder(config = {}) {
		const { segs = 32, rTop = 1, rBottom = 1, open = false, arc = 1 } = config;
		return this.mesh(`cylinder:${segs},${rTop},${rBottom},${open ? 1 : 0},${arc}`, () => cylinderVerts(segs, rTop, rBottom, open, arc), config);
	}
	/** Add a smooth torus (outer diameter 1, XZ plane). */
	torus(config = {}) {
		const { tube = .32, segs = 36, sides = 18, arc = 1 } = config;
		const minor = Math.min(.48, Math.max(.02, tube)) * .5;
		return this.mesh(`torus:${tube},${segs},${sides},${arc}`, () => torusVerts(.5 - minor, minor, segs, sides, arc), config);
	}
	/** Add a torus knot — a (p, q) winding closed tube. */
	torusKnot(config = {}) {
		const { p = 2, q = 3, segs = 96, sides = 10, tube = .24 } = config;
		return this.mesh(`torusKnot:${p},${q},${segs},${sides},${tube}`, () => torusKnotVerts(p, q, segs, sides, tube), config);
	}
	/** Add a chamfered box — bevelled edges/corners. */
	roundedBox(config = {}) {
		const { r = .2, segs = 7 } = config;
		return this.mesh(`roundedBox:${r},${segs}`, () => roundedBoxVerts(r, segs), config);
	}
	/** Add a capped cone (apex up). */
	cone(config = {}) {
		const { segs = 32, open = false, arc = 1 } = config;
		return this.mesh(`cone:${segs},${open ? 1 : 0},${arc}`, () => coneVerts(segs, open, arc), config);
	}
	/** Add a capsule/pill (total height 1; r = cap radius). */
	capsule(config = {}) {
		const { segs = 24, rings = 8, r = .25 } = config;
		return this.mesh(`capsule:${segs},${rings},${r}`, () => capsuleVerts(segs, rings, r), config);
	}
	/** Add a wedge ramp — a unit box halved diagonally. */
	wedge(config = {}) {
		return this.mesh("wedge", wedgeVerts, config);
	}
	/** Add a flat double-sided quad in the XZ plane. */
	plane(config = {}) {
		const { segs = 1 } = config;
		return this.mesh(`plane:${segs}`, () => planeVerts(segs), config);
	}
	/** Add a flat disc or pie slice (arc 0..1), double-sided, XZ plane. */
	circle(config = {}) {
		const { segs = 32, arc = 1 } = config;
		return this.mesh(`circle:${segs},${arc}`, () => circleVerts(segs, arc), config);
	}
	/** Add a flat ring/annulus, double-sided, XZ plane. */
	ring(config = {}) {
		const { inner = .5, segs = 32, arc = 1 } = config;
		return this.mesh(`ring:${inner},${segs},${arc}`, () => ringVerts(inner, segs, arc), config);
	}
	/** Add a panel — an extruded rounded-corner rectangle. */
	panel(config = {}) {
		const { r = .35, segs = 6 } = config;
		return this.mesh(`panel:${r},${segs}`, () => panelVerts(r, segs), config);
	}
	/** Add a disc — a filleted cylinder: coin / chip / puck / wheel. */
	disc(config = {}) {
		const { fillet = .35, segs = 40, filletSegs = 6 } = config;
		return this.mesh(`disc:${fillet},${segs},${filletSegs}`, () => discVerts(fillet, segs, filletSegs), config);
	}
	/** Add a tetrahedron. `detail` subdivides toward a sphere. */
	tetrahedron(config = {}) {
		const { detail = 0 } = config;
		return this.mesh(`tetrahedron:${detail}`, () => polyhedronVerts("tetrahedron", detail), config);
	}
	/** Add an octahedron. */
	octahedron(config = {}) {
		const { detail = 0 } = config;
		return this.mesh(`octahedron:${detail}`, () => polyhedronVerts("octahedron", detail), config);
	}
	/** Add a dodecahedron. */
	dodecahedron(config = {}) {
		const { detail = 0 } = config;
		return this.mesh(`dodecahedron:${detail}`, () => polyhedronVerts("dodecahedron", detail), config);
	}
	/** Add an icosahedron — the best faceted "geo-sphere". */
	icosahedron(config = {}) {
		const { detail = 0 } = config;
		return this.mesh(`icosahedron:${detail}`, () => polyhedronVerts("icosahedron", detail), config);
	}
	/** Add a lathe — a [d, y] profile revolved around Y. */
	lathe(config) {
		const { points, segs = 32, arc = 1 } = config;
		return this.mesh(`lathe:${segs},${arc},${JSON.stringify(points)}`, () => latheVerts(points, segs, arc), config);
	}
	/** Add a tube swept along a 3D polyline. */
	tube(config) {
		const { path, r = .16, sides = 12, closed = false } = config;
		return this.mesh(`tube:${r},${sides},${closed ? 1 : 0},${JSON.stringify(path)}`, () => tubeVerts(path, r, sides, closed), config);
	}
	/** Add a flat filled shape from a simple [x, z] outline. */
	shape(config) {
		const { outline } = config;
		return this.mesh(`shape:${JSON.stringify(outline)}`, () => shapeVerts(outline), config);
	}
	/** Add an extrusion of a simple [x, z] outline through unit height. */
	extrude(config) {
		const { outline, bevel = 0, bevelSegs = 3 } = config;
		return this.mesh(`extrude:${bevel},${bevelSegs},${JSON.stringify(outline)}`, () => extrudeVerts(outline, bevel, bevelSegs), config);
	}
	/** Add a mesh with CUSTOM geometry — same name = same instanced draw. */
	custom(name, verts, config = {}) {
		return this.mesh(name, verts, config);
	}
	mesh(kind, gen, config) {
		const key = config.static ? kind + "|static" : kind;
		let geo = this.geos.get(key);
		if (!geo) {
			geo = this.makeGeo(gen());
			if (config.static) geo.isStatic = true;
			this.geos.set(key, geo);
		}
		const m = new Mesh3d(config);
		geo.list.push(m);
		return m;
	}
	makeGeo(verts, colorSrc, normalSrc, mrSrc) {
		const gl = this.gl;
		const vbuf = gl.createBuffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
		gl.bufferData(gl.ARRAY_BUFFER, verts, gl.STATIC_DRAW);
		return {
			verts,
			vertCount: verts.length / 8,
			list: [],
			drawCount: 0,
			transCount: 0,
			data: new Float32Array(256 * 28),
			vbuf,
			vao: null,
			inst: new InstanceBuffer(gl),
			colorSrc,
			normalSrc,
			mrSrc,
			colorTex: colorSrc ? this.uploadTex(colorSrc, true) : null,
			normalTex: normalSrc ? this.uploadTex(normalSrc, false) : null,
			mrTex: mrSrc ? this.uploadTex(mrSrc, false) : null
		};
	}
	modelMesh(kind, verts, colorSrc, normalSrc, config, mrSrc) {
		let geo = this.geos.get(kind);
		if (!geo) {
			geo = this.makeGeo(verts, colorSrc, normalSrc, mrSrc);
			this.geos.set(kind, geo);
		}
		const m = new Mesh3d(config);
		if (geo.colorSrc) m.texture = -2;
		if (geo.normalSrc) m.normalMap = -2;
		geo.list.push(m);
		return m;
	}
	/** Allocate a palette slice from the global pool (mat4-unit base). */
	paletteAlloc(joints) {
		const base = this.palettesTop;
		this.palettesTop += joints;
		if (this.palettesTop * 16 > this.palettesData.length) {
			let len = this.palettesData.length;
			while (len < this.palettesTop * 16) len *= 2;
			const grown = new Float32Array(len);
			grown.set(this.palettesData);
			this.palettesData = grown;
			this.paletteTex = null;
		}
		return base;
	}
	/** A VS-skinned bucket: interleaved 44-byte verts shared by every instance
	* (the twin of world3d.skinnedMesh — palettes ride an RGBA32F texture). */
	skinnedMesh(kind, build, colorSrc, normalSrc, mrSrc, joints) {
		let geo = this.geos.get(kind);
		if (!geo) {
			const gl = this.gl;
			const raw = build();
			const vbuf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, vbuf);
			gl.bufferData(gl.ARRAY_BUFFER, raw, gl.STATIC_DRAW);
			geo = {
				verts: new Float32Array(raw),
				vertCount: raw.byteLength / 44,
				list: [],
				drawCount: 0,
				transCount: 0,
				data: new Float32Array(256 * 28),
				vbuf,
				vao: null,
				inst: new InstanceBuffer(gl),
				skinned: true,
				rawVerts: raw,
				basesData: /* @__PURE__ */ new Float32Array(256),
				basesBuf: null,
				colorSrc,
				normalSrc,
				mrSrc,
				colorTex: colorSrc ? this.uploadTex(colorSrc, true) : null,
				normalTex: normalSrc ? this.uploadTex(normalSrc, false) : null,
				mrTex: mrSrc ? this.uploadTex(mrSrc, false) : null
			};
			this.geos.set(kind, geo);
		}
		const m = new Mesh3d({ blob: false });
		if (geo.colorSrc) m.texture = -2;
		if (geo.normalSrc) m.normalMap = -2;
		m.paletteBase = this.paletteAlloc(joints);
		geo.list.push(m);
		return m;
	}
	/** Load a Wavefront OBJ (+ MTL + diffuse textures) — the twin of
	* World3d.loadObj, over the shared device-free cache. */
	async loadObj(url, config = {}) {
		const md = await loadModelData(url);
		if (md.kind !== "obj") throw new Error(`loadObj: ${url} is not an OBJ`);
		const { data, mats, imgs } = md;
		const parts = [];
		for (let i = 0; i < data.groups.length; i++) {
			const g = data.groups[i];
			const mat = g.material ? mats[g.material] : void 0;
			const img = imgs[i];
			parts.push(this.modelMesh("obj:" + url + "#" + i, g.verts, img, void 0, {
				x: config.x,
				y: config.y,
				z: config.z,
				w: config.w,
				h: config.h,
				d: config.d,
				yaw: config.yaw,
				pitch: config.pitch,
				roll: config.roll,
				alpha: config.alpha,
				color: config.color ?? (img ? "#ffffff" : mat ? rgbHex(mat.color[0], mat.color[1], mat.color[2]) : void 0),
				metallic: config.metallic ?? 0,
				rough: config.rough ?? .75
			}));
		}
		return new Model3d(parts);
	}
	/** Load a GLB — static, node-animated and VS-skinned primitives, the twin
	* of World3d.loadGlb (AnimatedModel3d's CPU mixer is reused unchanged). */
	async loadGlb(url, config = {}) {
		const md = await loadModelData(url);
		if (md.kind !== "glb") throw new Error(`loadGlb: ${url} is not a GLB`);
		const { data, fit, bitmaps } = md;
		const animated = !!data.rig;
		const root = animated ? new Group3d({
			x: config.x,
			y: config.y,
			z: config.z,
			yaw: config.yaw,
			pitch: config.pitch,
			roll: config.roll
		}) : null;
		const keyBase = animated ? "glbanim:" + url + "#" : "glb:" + url + "#";
		const parts = [];
		const skinnedParts = [];
		const nodeParts = [];
		for (let i = 0; i < data.primitives.length; i++) {
			const prim = data.primitives[i];
			const mat = prim.material != null ? data.materials[prim.material] : void 0;
			const colorImg = mat?.colorImage != null ? bitmaps[mat.colorImage] : void 0;
			const normImg = mat?.normalImage != null ? bitmaps[mat.normalImage] : void 0;
			const mrImg = mat?.mrImage != null ? bitmaps[mat.mrImage] : void 0;
			const skinnedPrim = prim.skin != null && !!prim.joints && !!prim.weights && !!data.rig;
			const verts = prim.verts;
			let mesh;
			if (skinnedPrim && data.rig) {
				mesh = this.skinnedMesh(keyBase + i, () => {
					const n = verts.length / 8;
					const buf = /* @__PURE__ */ new ArrayBuffer(n * 44);
					const dv = new DataView(buf);
					const sc = fit.scale, ce = fit.center;
					const J = prim.joints, W = prim.weights;
					for (let v = 0; v < n; v++) {
						const o = v * 8, b = v * 44;
						dv.setFloat32(b, (verts[o] - ce[0]) * sc, true);
						dv.setFloat32(b + 4, (verts[o + 1] - ce[1]) * sc, true);
						dv.setFloat32(b + 8, (verts[o + 2] - ce[2]) * sc, true);
						dv.setFloat32(b + 12, verts[o + 3], true);
						dv.setFloat32(b + 16, verts[o + 4], true);
						dv.setFloat32(b + 20, verts[o + 5], true);
						dv.setFloat32(b + 24, verts[o + 6], true);
						dv.setFloat32(b + 28, verts[o + 7], true);
						for (let k = 0; k < 4; k++) dv.setUint16(b + 32 + k * 2, J[v * 4 + k], true);
						for (let k = 0; k < 4; k++) dv.setUint8(b + 40 + k, Math.max(0, Math.min(255, Math.round(W[v * 4 + k] * 255))));
					}
					return buf;
				}, colorImg, normImg, mrImg, data.rig.skins[prim.skin].joints.length);
				Object.assign(mesh, {
					alpha: config.alpha ?? mat?.color[3] ?? 1,
					color: config.color ?? (mat ? rgbHex(mat.color[0], mat.color[1], mat.color[2]) : "#ffffff"),
					metallic: config.metallic ?? mat?.metallic ?? 0,
					rough: config.rough ?? mat?.rough ?? .8,
					bump: mat?.normalScale ?? 1,
					parent: root
				});
				parts.push(mesh);
				skinnedParts.push({
					mesh,
					skin: prim.skin,
					palette: new Float32Array(data.rig.skins[prim.skin].joints.length * 16)
				});
				continue;
			}
			mesh = this.modelMesh(keyBase + i, verts, colorImg, normImg, {
				x: animated ? 0 : config.x,
				y: animated ? 0 : config.y,
				z: animated ? 0 : config.z,
				w: animated ? 1 : config.w,
				h: animated ? 1 : config.h,
				d: animated ? 1 : config.d,
				yaw: animated ? 0 : config.yaw,
				pitch: animated ? 0 : config.pitch,
				roll: animated ? 0 : config.roll,
				alpha: config.alpha ?? mat?.color[3],
				color: config.color ?? (mat ? rgbHex(mat.color[0], mat.color[1], mat.color[2]) : "#ffffff"),
				metallic: config.metallic ?? mat?.metallic ?? 0,
				rough: config.rough ?? mat?.rough ?? .8,
				bump: mat?.normalScale ?? 1,
				parent: root
			}, mrImg);
			parts.push(mesh);
			if (!prim.baked && data.rig) nodeParts.push({
				mesh,
				node: prim.node
			});
		}
		if (animated && data.rig && root) {
			const m = new AnimatedModel3d(parts, data.rig, root, skinnedParts, nodeParts, fit);
			if (config.w != null || config.h != null || config.d != null) m.size = config.w ?? config.h ?? config.d ?? 1;
			this.animated.push(m);
			return m;
		}
		return new Model3d(parts);
	}
	terrain(opts = {}) {
		const field = new Heightfield(opts);
		const surf = TERRAIN_SURFACES[opts.surface ?? "grass"] ?? TERRAIN_SURFACES.grass;
		const cRes = opts.colormapRes ?? 1024;
		const pixels = bakeColormapPixels(field, opts.bands ?? surf.bands, cRes, field.seed, opts.groundDetail ?? 0);
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = cRes;
		canvas.getContext("2d").putImageData(new ImageData(pixels, cRes, cRes), 0, 0);
		const tex = this.uploadTex(canvas, true);
		const chunks = pickChunks(field.res, opts.chunks);
		const isStatic = opts.static ?? true;
		const id = this.terrainSeq++;
		const meshes = [];
		const keys = [];
		for (let cz = 0; cz < chunks; cz++) for (let cx = 0; cx < chunks; cx++) {
			const c = chunkVerts(field, cx, cz, chunks, cRes);
			const key = `terrain:${id}:${cx},${cz}`;
			const m = this.mesh(key, () => c.verts, {
				x: c.x,
				y: c.y,
				z: c.z,
				w: c.w,
				h: c.h,
				d: c.d,
				color: "#ffffff",
				rough: surf.rough,
				static: isStatic,
				blob: false
			});
			m.texture = -2;
			const fullKey = isStatic ? key + "|static" : key;
			const geo = this.geos.get(fullKey);
			geo.colorTex = tex;
			geo.noPick = true;
			meshes.push(m);
			keys.push(fullKey);
		}
		const rec = {
			canvas,
			keys,
			tex
		};
		this.terrainRecs.push(rec);
		const handle = new Terrain3d(field, meshes, () => {
			for (const key of keys) this.geos.delete(key);
			const i = this.terrainRecs.indexOf(rec);
			if (i >= 0) this.terrainRecs.splice(i, 1);
			const ti = this.terrains.indexOf(handle);
			if (ti >= 0) this.terrains.splice(ti, 1);
			const di = this.deformRecs.findIndex((r) => r.keys === keys);
			if (di >= 0) this.deformRecs.splice(di, 1);
			for (let gi = this.grassFields.length - 1; gi >= 0; gi--) if (this.grassFields[gi].terrain === handle) {
				this.grassFields[gi].grass.destroy();
				this.grassFields.splice(gi, 1);
			}
		}, (map, dopts) => {
			const surfName = opts.surface ?? "grass";
			const underDefault = {
				snow: "#aecbe8",
				sand: "#8a6f4f",
				grass: "#5d4a33",
				rock: "#48423a"
			}[surfName] ?? "#5d4a33";
			const uc = rgba(dopts.under ?? underDefault);
			const albDefault = {
				snow: "#eef4fb",
				sand: "#d8bd88",
				grass: "#6f8a52",
				rock: "#8a8276"
			}[surfName] ?? "#eef4fb";
			const ac = rgba(dopts.albedo ?? albDefault);
			this.gl;
			const drec = {
				map,
				keys,
				field,
				under: [
					uc[0],
					uc[1],
					uc[2]
				],
				rim: dopts.rim ?? 1.6,
				sparkle: dopts.sparkle ?? (surfName === "snow" ? .6 : 0),
				albedo: [
					ac[0],
					ac[1],
					ac[2]
				],
				rough: surf.rough,
				berm: map.maxDepth * .3,
				patchWin: dopts.patch ?? 240,
				cells: Math.max(2, Math.round(dopts.cells ?? 288)),
				tex: null,
				du: /* @__PURE__ */ new Float32Array(16),
				pu: /* @__PURE__ */ new Float32Array(20)
			};
			this.ensureDeformGpu(drec);
			if (map.thickness > 0) {
				drec.patchVerts = deformPatchVerts(drec.cells);
				drec.patchVertCount = drec.patchVerts.length / 8;
			}
			this.deformRecs.push(drec);
			for (const key of keys) {
				const g = this.geos.get(key);
				if (g) g.deform = drec;
			}
		}, (gopts) => {
			const grass = new GlGrass3d(this.gl, {
				heights: field.heights,
				res: field.res,
				size: field.size
			}, {
				pixels,
				res: cRes
			}, gopts);
			this.grassFields.push({
				terrain: handle,
				grass
			});
			return grass;
		});
		this.terrains.push(handle);
		return handle;
	}
	/** (Re)create one deform rec's GL objects (carve tex, base heights, patch
	* VBO) — creation + context-restore path. */
	ensureDeformGpu(rec) {
		const gl = this.gl;
		rec.tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, rec.tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, rec.map.res, rec.map.res, 0, gl.RED, gl.FLOAT, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		rec.map.fullDirty = true;
		if (rec.map.thickness > 0) {
			const dim = rec.field.res + 1;
			rec.baseTex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, rec.baseTex);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.R32F, dim, dim, 0, gl.RED, gl.FLOAT, rec.field.heights);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			rec.baseDim = dim;
			if (rec.patchVerts) {
				rec.patchVbuf = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, rec.patchVbuf);
				gl.bufferData(gl.ARRAY_BUFFER, rec.patchVerts, gl.STATIC_DRAW);
			}
		}
	}
	/** Per-frame deform sync — world3d.prepare's deformRecs block, GL-side:
	* dirty-region R32F upload + the du/pu uniform packs. */
	syncDeforms() {
		const gl = this.gl;
		for (const rec of this.deformRecs) {
			const map = rec.map;
			gl.bindTexture(gl.TEXTURE_2D, rec.tex);
			gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
			if (map.fullDirty) gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, map.res, map.res, gl.RED, gl.FLOAT, map.data);
			else if (map.dirtyX1 > map.dirtyX0 && map.dirtyZ1 > map.dirtyZ0) {
				const w = map.dirtyX1 - map.dirtyX0, h = map.dirtyZ1 - map.dirtyZ0;
				const patch = new Float32Array(w * h);
				for (let iz = 0; iz < h; iz++) {
					const src = (map.dirtyZ0 + iz) * map.res + map.dirtyX0;
					patch.set(map.data.subarray(src, src + w), iz * w);
				}
				gl.texSubImage2D(gl.TEXTURE_2D, 0, map.dirtyX0, map.dirtyZ0, w, h, gl.RED, gl.FLOAT, patch);
			}
			map.clearDirty();
			const cutR = rec.patchVbuf ? rec.patchWin * .5 * .92 : 0;
			rec.du.set([
				map.cx,
				map.cz,
				1 / map.window,
				map.res,
				rec.under[0],
				rec.under[1],
				rec.under[2],
				rec.rim,
				rec.sparkle,
				map.maxDepth,
				map.texel,
				map.sink,
				map.patchCx,
				map.patchCz,
				cutR,
				cutR > 0 ? 1 : 0
			]);
			if (rec.patchVbuf && rec.pu) rec.pu.set([
				map.patchCx,
				map.patchCz,
				rec.patchWin,
				rec.cells,
				map.cx,
				map.cz,
				1 / map.window,
				map.res,
				rec.field.size,
				rec.field.res,
				cutR,
				map.maxDepth,
				rec.under[0],
				rec.under[1],
				rec.under[2],
				rec.sparkle,
				rec.rough,
				rec.berm,
				0,
				map.sink
			]);
		}
	}
	/** Draw the high-poly snow-layer patches — after the base terrain in the
	* opaque pass (they overdraw the near field; the base discards the disc). */
	drawDeformPatches(frame) {
		const gl = this.gl;
		if (!this.patchProg.p) return;
		for (const rec of this.deformRecs) {
			if (!rec.patchVbuf || !rec.pu) continue;
			this.useProg(this.patchProg, frame);
			const u = this.patchProg.u;
			if (u.uPU) gl.uniform4fv(u.uPU, rec.pu);
			const cmTex = this.geos.get(rec.keys[0])?.colorTex ?? this.whiteTex;
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, rec.baseTex ?? null);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, rec.tex);
			gl.activeTexture(gl.TEXTURE2);
			gl.bindTexture(gl.TEXTURE_2D, cmTex);
			gl.activeTexture(gl.TEXTURE3);
			gl.bindTexture(gl.TEXTURE_2D, this.envTex ?? this.whiteTex);
			gl.activeTexture(gl.TEXTURE4);
			gl.bindTexture(gl.TEXTURE_2D, this.shadowTex ?? this.shadowDummy);
			if (!rec.patchVao) rec.patchVao = gl.createVertexArray();
			gl.bindVertexArray(rec.patchVao);
			gl.bindBuffer(gl.ARRAY_BUFFER, rec.patchVbuf);
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
			gl.enableVertexAttribArray(1);
			gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
			gl.enableVertexAttribArray(2);
			gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
			gl.drawArrays(gl.TRIANGLES, 0, rec.patchVertCount);
			gl.bindVertexArray(null);
			this.drawsLast++;
		}
	}
	/** Add a camera-facing sprite, anchored at its BASE point. */
	billboard(config) {
		const b = new Billboard3d(config);
		this.bills.push(b);
		return b;
	}
	/** Add ONE soft contact-shadow ellipse (see BlobShadow3d). */
	blobShadow(config = {}) {
		const b = new BlobShadow3d(config);
		this.blobShadowsList.push(b);
		return b;
	}
	/** Create a transform-node GROUP (renders nothing). */
	group(config = {}) {
		return new Group3d(config);
	}
	/** Aim any posed handle's local +Z at a world point. */
	lookAt(handle, x, y, z) {
		const e = lookAtEuler(handle.x, handle.y, handle.z, x, y, z);
		handle.yaw = e.yaw;
		handle.pitch = e.pitch;
	}
	/**
	* Add a dynamic POINT or SPOT light. The fallback shades up to 8 lights as
	* uniform arrays (no clustering) — the nearest-to-camera 8 win each frame
	* when over budget. Handles are live; kill() releases.
	*/
	light(config = {}) {
		const l = new Light3d(config);
		this.lightsList.push(l);
		if (config.beam && (config.type ?? "point") === "spot") this.beams.push({
			light: l,
			opts: config.beam === true ? {} : config.beam
		});
		return l;
	}
	/** The Lights3d-manager facade — game code reads `world.lights3d.count` (and
	* can add through it) on the WebGPU backend; this mirrors the surface over
	* the fallback's flat light list. `activeCount` = the ≤8 actually shaded. */
	lights3d = ((w) => ({
		/** Live registered lights (Lights3d.count parity — dead ones drop). */
		get count() {
			return w.lightsList.filter((l) => !l.dead).length;
		},
		/** The ≤8 actually shaded this frame (the fallback's activation cap). */
		get activeCount() {
			return w.lightCount;
		},
		light: (config = {}) => w.light(config)
	}))(this);
	/** Re-aim the directional SUN (the direction light travels) + ambient. */
	setSun(x, y, z, ambient) {
		if (!this.envCustom) this.envDirty = true;
		this.sun.x = x;
		this.sun.y = y;
		this.sun.z = z;
		if (ambient != null) this.sun.ambient = ambient;
	}
	/** Hemisphere ambient: intensity + sky/ground tints. */
	setAmbient(intensity, sky, ground) {
		if (!this.envCustom) this.envDirty = true;
		this.sun.ambient = intensity;
		if (sky != null) this.sun.sky = sky;
		if (ground != null) this.sun.ground = ground;
		else if (sky != null) this.sun.ground = sky;
	}
	/** THE SKY — the full procedural dome (sky3d's day/night state machine +
	* the ported fragment shader: gradient, sun, clouds, stars, moon). */
	sky(opts = {}) {
		this.skyHandle = new Sky3d(opts);
		return this.skyHandle;
	}
	/** Attach the ORBIT RIG (orbit3d.ts reused verbatim — it only consumes
	* world.camera). */
	orbit(opts = {}) {
		if (!this.canvasEl) throw new Error("orbit(): no canvas — create the world via game.world3d()");
		this.rig?.detach();
		this.rig = new OrbitRig(this, this.canvasEl, opts);
		return this.rig;
	}
	/** FOLLOW camera — eases to target + offset, aims at target + look
	* (duplicated from World3d.follow, same defaults). */
	follow(target, opts = {}) {
		if (!target) {
			this.followCfg = null;
			return;
		}
		this.followCfg = {
			target,
			offset: {
				x: opts.offset?.x ?? 0,
				y: opts.offset?.y ?? 10,
				z: opts.offset?.z ?? 14
			},
			look: {
				x: opts.look?.x ?? 0,
				y: opts.look?.y ?? 1.5,
				z: opts.look?.z ?? 0
			},
			ease: opts.ease ?? 3
		};
		const f = this.followCfg;
		this.camera.x = target.x + f.offset.x;
		this.camera.y = target.y + f.offset.y;
		this.camera.z = target.z + f.offset.z;
		this.camera.tx = target.x + f.look.x;
		this.camera.ty = target.y + f.look.y;
		this.camera.tz = target.z + f.look.z;
	}
	/** Trigger a one-shot VfxDef.burst recipe at a point. */
	burst(vfx, x, y, z, opts = {}) {
		this.fx.burst(resolveVfx(vfx), x, y, z, opts);
	}
	/** A SurfaceSampler over a mesh's unit geometry (mesh-surface emitter). */
	surface(mesh) {
		for (const [, geo] of this.geos) {
			if (!geo.list.includes(mesh)) continue;
			if (!geo.skinned) return new SurfaceSampler(geo.verts);
			const n = Math.floor(geo.verts.length / 11);
			const plain = new Float32Array(n * 8);
			for (let v = 0; v < n; v++) for (let k = 0; k < 8; k++) plain[v * 8 + k] = geo.verts[v * 11 + k];
			return new SurfaceSampler(plain);
		}
		throw new Error("world.surface(): mesh not found in any bucket");
	}
	/** A world-space PICKING RAY under a pointer event. */
	screenRay(e) {
		if (!this.curVp || !this.canvasEl) return null;
		const r = this.canvasEl.getBoundingClientRect();
		if (!r.width || !r.height) return null;
		const nx = (e.clientX - r.left) / r.width * 2 - 1;
		const ny = 1 - (e.clientY - r.top) / r.height * 2;
		if (!this.curInvVp) this.curInvVp = mat4Inverse(this.curVp);
		const ray = rayFromNdc(this.curInvVp, nx, ny);
		return {
			...ray,
			ground: (h = 0) => rayPlaneY(ray.origin, ray.dir, h)
		};
	}
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
	async pick(e, opts = {}) {
		if (this.pickProg.p) return this.pickGpu(e, opts.occlude !== false);
		const ray = this.screenRay(e);
		if (!ray) return null;
		const occlude = opts.occlude !== false;
		let bestT = Infinity;
		let bestMesh = null;
		for (const [, geo] of this.geos) {
			if (geo.skinned || geo.noPick) continue;
			let anyOn = false;
			for (const m of geo.list) if (!m.dead && m.inputEnabled) {
				anyOn = true;
				break;
			}
			if (!anyOn && !occlude) continue;
			const b = geo.bounds ??= geoBounds(geo.verts);
			for (const m of geo.list) {
				if (m.dead) continue;
				if (!m.inputEnabled && !occlude) continue;
				let px = m.x, py = m.y, pz = m.z, pyaw = m.yaw, ppitch = m.pitch, proll = m.roll;
				let ew = m.w, eh = m.h, ed = m.d;
				if (m.parent) {
					const eff = composeChain(m.x, m.y, m.z, m.yaw, m.pitch, m.roll, m.parent);
					px = eff.x;
					py = eff.y;
					pz = eff.z;
					pyaw = eff.yaw;
					ppitch = eff.pitch;
					proll = eff.roll;
					ew = m.w * eff.scale;
					eh = m.h * eff.scale;
					ed = m.d * eff.scale;
				}
				const t = rayObbLocal(ray.origin, ray.dir, {
					x: px,
					y: py,
					z: pz
				}, {
					x: ew,
					y: eh,
					z: ed
				}, pyaw, ppitch, proll, b ?? void 0);
				if (t != null && t < bestT) {
					bestT = t;
					bestMesh = m;
				}
			}
		}
		if (!bestMesh || !bestMesh.inputEnabled) return null;
		let id = pickIds.get(bestMesh);
		if (id == null) {
			id = pickSeq++;
			pickIds.set(bestMesh, id);
		}
		return {
			mesh: bestMesh,
			id
		};
	}
	/** PROJECT a world point to CANVAS pixels (CSS units, origin top-left). */
	project(x, y, z) {
		if (!this.curVp || !this.canvasEl) return null;
		const r = this.canvasEl.getBoundingClientRect();
		const ndc = mat4Project(this.curVp, {
			x,
			y,
			z
		});
		return {
			x: (ndc.x * .5 + .5) * r.width,
			y: (.5 - ndc.y * .5) * r.height,
			depth: ndc.z,
			visible: Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > 0 && ndc.z < 1
		};
	}
	/** The GPU id-buffer pick — PICK_WGSL's architecture on GL: render every
	* eligible instance's id (base + gl_InstanceID, +1 so 0 = the clear
	* sentinel) RGBA8-encoded into a cursor-scissored canvas-sized target,
	* depth-tested, then read the one texel back ASYNC (PIXEL_PACK buffer +
	* fenceSync, polled in tick — the WebGPU mapAsync latency, ~1–2 frames).
	* Coverage parity: dynamic + static + loaded non-skinned models, opaque +
	* translucent; non-pickable geometry depth-blocks under `occlude` and
	* discards otherwise. Maps are SNAPSHOT before the async wait (the pack
	* arrays rewrite every frame). */
	pickGpu(e, occlude) {
		const gl = this.gl;
		const cv = this.canvasEl;
		if (!this.curVp || !cv || !cv.width || !cv.height) return Promise.resolve(null);
		const r = cv.getBoundingClientRect();
		if (!r.width || !r.height) return Promise.resolve(null);
		const cw = cv.width, ch = cv.height;
		const px = Math.max(0, Math.min(cw - 1, Math.round((e.clientX - r.left) / r.width * cw)));
		const pyTop = Math.max(0, Math.min(ch - 1, Math.round((e.clientY - r.top) / r.height * ch)));
		const py = ch - 1 - pyTop;
		this.ensurePickTarget(cw, ch);
		if (!this.pickFbo) return Promise.resolve(null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFbo);
		gl.viewport(0, 0, cw, ch);
		gl.enable(gl.SCISSOR_TEST);
		gl.scissor(px, py, 1, 1);
		gl.disable(gl.BLEND);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.depthMask(true);
		gl.enable(gl.CULL_FACE);
		gl.frontFace(gl.CCW);
		gl.cullFace(gl.BACK);
		gl.clearColor(0, 0, 0, 0);
		gl.clearDepth(1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		gl.useProgram(this.pickProg.p);
		const u = this.pickProg.u;
		if (u.uViewProj) gl.uniformMatrix4fv(u.uViewProj, false, this.curVp);
		if (u.uOcclude) gl.uniform1f(u.uOcclude, occlude ? 1 : 0);
		if (!this.pickVao) this.pickVao = gl.createVertexArray();
		gl.bindVertexArray(this.pickVao);
		const spans = [];
		let base = 0;
		const flags = /* @__PURE__ */ new Float32Array(256);
		const drawSpan = (geo, data, count, map) => {
			let anyOn = false;
			for (let i = 0; i < count; i++) if (map[i]?.inputEnabled) {
				anyOn = true;
				break;
			}
			if (!anyOn && !occlude) return;
			const f = flags.length >= count ? flags : new Float32Array(count);
			for (let i = 0; i < count; i++) f[i] = map[i]?.inputEnabled ? 1 : 0;
			if (u.uBase) gl.uniform1f(u.uBase, base);
			gl.bindBuffer(gl.ARRAY_BUFFER, geo.vbuf);
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
			geo.pickFlagsBuf ??= gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, geo.pickFlagsBuf);
			gl.bufferData(gl.ARRAY_BUFFER, f.subarray(0, count), gl.DYNAMIC_DRAW);
			gl.enableVertexAttribArray(5);
			gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 4, 0);
			gl.vertexAttribDivisor(5, 1);
			geo.inst.upload(data, count * 28);
			instanceVec4Attribs(gl, 8, 7);
			gl.drawArraysInstanced(gl.TRIANGLES, 0, geo.vertCount, count);
			spans.push({
				base,
				count,
				map: map.slice(0, count)
			});
			base += count;
		};
		for (const [, geo] of this.geos) {
			if (geo.skinned || geo.deform) continue;
			if (geo.drawCount && geo.packMap) drawSpan(geo, geo.data, geo.drawCount, geo.packMap);
			if (geo.transCount && geo.transData && geo.transMap) drawSpan(geo, geo.transData, geo.transCount, geo.transMap);
		}
		gl.bindVertexArray(null);
		if (!spans.length) {
			gl.disable(gl.SCISSOR_TEST);
			gl.bindFramebuffer(gl.FRAMEBUFFER, null);
			return Promise.resolve(null);
		}
		const buf = gl.createBuffer();
		gl.bindBuffer(gl.PIXEL_PACK_BUFFER, buf);
		gl.bufferData(gl.PIXEL_PACK_BUFFER, 4, gl.STREAM_READ);
		gl.readPixels(px, py, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, 0);
		gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
		gl.disable(gl.SCISSOR_TEST);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
		if (!sync) {
			gl.deleteBuffer(buf);
			return Promise.resolve(null);
		}
		gl.flush();
		return new Promise((resolve) => {
			this.pendingPicks.push({
				sync,
				buf,
				spans,
				resolve
			});
		});
	}
	/** Poll the pick fences (called from tick — the async half). */
	pollPicks() {
		const gl = this.gl;
		for (let i = this.pendingPicks.length - 1; i >= 0; i--) {
			const p = this.pendingPicks[i];
			const st = gl.clientWaitSync(p.sync, 0, 0);
			if (st === gl.TIMEOUT_EXPIRED) continue;
			this.pendingPicks.splice(i, 1);
			let hit = null;
			if (st === gl.ALREADY_SIGNALED || st === gl.CONDITION_SATISFIED) {
				const out = /* @__PURE__ */ new Uint8Array(4);
				gl.bindBuffer(gl.PIXEL_PACK_BUFFER, p.buf);
				gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, out);
				gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
				const raw = out[0] + out[1] * 256 + out[2] * 65536;
				if (raw > 0) {
					const id = raw - 1;
					for (const sp of p.spans) if (id >= sp.base && id < sp.base + sp.count) {
						const mesh = sp.map[id - sp.base];
						if (mesh) hit = {
							mesh,
							id
						};
						break;
					}
				}
			}
			gl.deleteSync(p.sync);
			gl.deleteBuffer(p.buf);
			p.resolve(hit);
		}
	}
	/** (Re)create the canvas-sized pick target (RGBA8 + depth renderbuffer). */
	ensurePickTarget(w, h) {
		const gl = this.gl;
		if (this.pickFbo && this.pickW === w && this.pickH === h) return;
		if (this.pickTex) gl.deleteTexture(this.pickTex);
		if (this.pickDepth) gl.deleteRenderbuffer(this.pickDepth);
		if (this.pickFbo) gl.deleteFramebuffer(this.pickFbo);
		this.pickTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.pickTex);
		gl.texStorage2D(gl.TEXTURE_2D, 1, gl.RGBA8, w, h);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		this.pickDepth = gl.createRenderbuffer();
		gl.bindRenderbuffer(gl.RENDERBUFFER, this.pickDepth);
		gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT24, w, h);
		this.pickFbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.pickFbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, this.pickTex, 0);
		gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, this.pickDepth);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		this.pickW = w;
		this.pickH = h;
	}
	/** Per-frame step: orbit/follow rigs, the sky clock (which drives the sun/
	* ambient/fog when attached), animated models, terrain carvers, particles. */
	tick(dt) {
		this.lastDt = dt;
		this.rig?.update(dt);
		if (this.followCfg) {
			const f = this.followCfg, c = this.camera;
			const k = Math.min(1, f.ease * dt);
			c.x += (f.target.x + f.offset.x - c.x) * k;
			c.y += (f.target.y + f.offset.y - c.y) * k;
			c.z += (f.target.z + f.offset.z - c.z) * k;
			c.tx += (f.target.x + f.look.x - c.tx) * k;
			c.ty += (f.target.y + f.look.y - c.ty) * k;
			c.tz += (f.target.z + f.look.z - c.tz) * k;
		}
		this.time += dt;
		if (this.skyHandle) {
			const sky = this.skyHandle;
			const st = sky.tick(dt);
			this.skyStateNow = st;
			if (sky.drive) {
				const storm = Math.min(1, Math.max(0, sky.storm));
				const moved = Math.abs(st.sunDir[0] - this.envSunX) + Math.abs(st.sunDir[1] - this.envSunY) + Math.abs(st.sunDir[2] - this.envSunZ);
				if (!this.envCustom && moved > .02) this.envDirty = true;
				this.sun.x = st.sunDir[0];
				this.sun.y = st.sunDir[1];
				this.sun.z = st.sunDir[2];
				this.sun.ambient = st.ambient * (1 - .25 * storm);
				this.sun.sky = rgbHex(st.ambSky[0], st.ambSky[1], st.ambSky[2]);
				this.sun.ground = rgbHex(st.ambGround[0], st.ambGround[1], st.ambGround[2]);
				const sunI = st.sunI * (1 - .65 * storm);
				this.sunColData = [
					st.sunColor[0],
					st.sunColor[1],
					st.sunColor[2],
					sunI
				];
				if (this.fog) {
					const dim = 1 - .3 * storm;
					this.fog.color = rgbHex(st.fog[0] * dim, st.fog[1] * dim, st.fog[2] * dim);
				}
			}
		}
		this.animated = this.animated.filter((m) => !m.parts[0]?.dead);
		for (const m of this.animated) m.update(dt);
		for (const t of this.terrains) t.stepCarvers(dt);
		for (let i = this.trails.length - 1; i >= 0; i--) if (!this.trails[i].update(dt)) this.trails.splice(i, 1);
		if (this.cpuEmitters.length) {
			this.cpuEmitters = this.cpuEmitters.filter((e) => !e.handle.dead);
			for (const e of this.cpuEmitters) {
				Object.assign(e.stream, e.mapOpts());
				e.stream.rate = Math.min(e.handle.rate, 400);
				e.handle.alive = this.fx.count;
			}
		}
		this.fx.update(dt);
		this.weatherPools = this.weatherPools.filter((p) => !p.handle.dead);
		for (const p of this.weatherPools) {
			const h = p.handle;
			if (h.rate > 0 && p.count < p.cap) {
				let add = Math.min(p.cap - p.count, Math.ceil(h.rate * dt));
				while (add-- > 0) this.weatherSpawn(p, p.count++);
			}
			const ax = p.accel[0] * dt, ay = p.accel[1] * dt, az = p.accel[2] * dt;
			for (let i = 0; i < p.count; i++) {
				const o = i * 3;
				p.vel[o] += ax;
				p.vel[o + 1] += ay;
				p.vel[o + 2] += az;
				p.pos[o] += p.vel[o] * dt;
				p.pos[o + 1] += p.vel[o + 1] * dt;
				p.pos[o + 2] += p.vel[o + 2] * dt;
				const rx = p.pos[o] - h.x;
				if (rx > p.hw) p.pos[o] -= 2 * p.hw;
				else if (rx < -p.hw) p.pos[o] += 2 * p.hw;
				const ry = p.pos[o + 1] - h.y;
				if (ry > p.hh) p.pos[o + 1] -= 2 * p.hh;
				else if (ry < -p.hh) p.pos[o + 1] += 2 * p.hh;
				const rz = p.pos[o + 2] - h.z;
				if (rz > p.hd) p.pos[o + 2] -= 2 * p.hd;
				else if (rz < -p.hd) p.pos[o + 2] += 2 * p.hd;
			}
			h.alive = p.count;
		}
		this.agents3d?.tick(dt);
		this.updateAgentGizmos();
		if (this.pendingPicks.length) this.pollPicks();
	}
	/** Steering GIZMOS (World3d.updateAgentGizmos, verbatim): while
	* `world.agents().debug` is on, draw each agent's velocity (green), net
	* steering force (orange), avoid feeler (cyan), live A* path (violet) and
	* every field's radius ring (magenta) as world-space lines, refilled each
	* frame. Off → the lines are emptied (nothing drawn). */
	updateAgentGizmos() {
		const ag = this.agents3d;
		if (!ag || !ag.debug) {
			if (this.agentGizmos) for (const s of Object.values(this.agentGizmos)) s.segs.length = 0;
			return;
		}
		const gz = this.agentGizmos ??= {
			vel: this.lines([], {
				color: "#66ff88",
				width: 2
			}),
			force: this.lines([], {
				color: "#ffaa33",
				width: 2
			}),
			feeler: this.lines([], {
				color: "#5cf0ff",
				width: 1.5
			}),
			field: this.lines([], {
				color: "#ff55cc",
				width: 1.5
			}),
			path: this.lines([], {
				color: "#b088ff",
				width: 2
			})
		};
		const V = gz.vel.segs, F = gz.force.segs, FE = gz.feeler.segs, FL = gz.field.segs, P = gz.path.segs;
		V.length = 0;
		F.length = 0;
		FE.length = 0;
		FL.length = 0;
		P.length = 0;
		for (const a of ag.agents) {
			const p = a.pos, sp = a.speed;
			V.push([
				p.x,
				p.y,
				p.z,
				p.x + a.vel.x * .3,
				p.y + a.vel.y * .3,
				p.z + a.vel.z * .3
			]);
			F.push([
				p.x,
				p.y,
				p.z,
				p.x + a.force.x * .04,
				p.y + a.force.y * .04,
				p.z + a.force.z * .04
			]);
			const avoid = a.behaviors.find((b) => b.kind === "avoid");
			if (avoid && sp > .1) {
				const feel = (avoid.lookAhead ?? 2) * (.5 + .5 * sp / Math.max(a.maxSpeed, .001));
				FE.push([
					p.x,
					p.y,
					p.z,
					p.x + a.vel.x / sp * feel,
					p.y + a.vel.y / sp * feel,
					p.z + a.vel.z / sp * feel
				]);
			}
			const np = a.navPath;
			if (np) for (let i = 0; i < np.length - 1; i++) P.push([
				np[i].x,
				np[i].y + .4,
				np[i].z,
				np[i + 1].x,
				np[i + 1].y + .4,
				np[i + 1].z
			]);
		}
		for (const f of ag.fields) {
			const c = f.at(), R = f.radius, seg = 24;
			for (let i = 0; i < seg; i++) {
				const a0 = i / seg * Math.PI * 2, a1 = (i + 1) / seg * Math.PI * 2;
				FL.push([
					c.x + Math.cos(a0) * R,
					c.y,
					c.z + Math.sin(a0) * R,
					c.x + Math.cos(a1) * R,
					c.y,
					c.z + Math.sin(a1) * R
				]);
			}
		}
	}
	/** Live handle counts + draw-call count — the World3d.counts shape (the
	* WebGPU-only layers report zero). */
	get counts() {
		let meshes = 0, drawn = 0, staticMeshes = 0;
		for (const g of this.geos.values()) {
			if (g.isStatic) staticMeshes += g.list.length;
			else meshes += g.list.length;
			drawn += g.drawCount + g.transCount;
		}
		return {
			meshes,
			drawn,
			culled: meshes + staticMeshes - drawn,
			staticMeshes,
			billboards: this.bills.length,
			blobs: this.blobCount,
			lines: this.linesLast,
			wisps: this.wisps.length,
			trails: this.trails.length,
			particles: this.fx.count,
			gpuParticles: 0,
			waters: this.waters.length,
			draws: this.drawsLast
		};
	}
	render(width, height, scene) {
		const gl = this.gl;
		if (!this.meshProg.p) return;
		this.frameStamp++;
		this.drawsLast = 0;
		const cam = this.camera;
		const eye = {
			x: cam.x,
			y: cam.y,
			z: cam.z
		};
		const view = mat4LookAt(eye, {
			x: cam.tx,
			y: cam.ty,
			z: cam.tz
		});
		const near = .1;
		const baseFog = this.uwSavedFog !== void 0 ? this.uwSavedFog : this.fog;
		const far = baseFog ? baseFog.far * 2 : 500;
		const aspect = width / Math.max(1, height);
		const proj = mat4Perspective(cam.fov, aspect, near, far);
		const vp = mat4Mul(proj, view);
		this.curVp = vp;
		this.curInvVp = null;
		this.curProj = proj;
		this.curNear = near;
		this.curFar = far;
		const basis = viewBasis(view);
		const ll = Math.hypot(this.sun.x, this.sun.y, this.sun.z) || 1;
		let shadowVP = null;
		if (this.shadowOpts && this.shadowTex) {
			const so = this.shadowOpts;
			const dl = {
				x: this.sun.x / ll,
				y: this.sun.y / ll,
				z: this.sun.z / ll
			};
			const center = {
				x: cam.tx,
				y: cam.ty,
				z: cam.tz
			};
			const lightView = mat4LookAt({
				x: center.x - dl.x * so.size * 2,
				y: center.y - dl.y * so.size * 2,
				z: center.z - dl.z * so.size * 2
			}, center, Math.abs(dl.y) > .99 ? {
				x: 0,
				y: 0,
				z: 1
			} : {
				x: 0,
				y: 1,
				z: 0
			});
			shadowVP = mat4Mul(mat4Ortho(-so.size, so.size, -so.size, so.size, .1, so.size * 4), lightView);
		}
		const camPlanes = this.cull ? frustumPlanes(vp) : null;
		const shadowPlanes = this.cull && shadowVP ? frustumPlanes(shadowVP) : null;
		{
			const sx = eye.x - this.sun.x / ll * 1e3;
			const sy = eye.y - this.sun.y / ll * 1e3;
			const sz = eye.z - this.sun.z / ll * 1e3;
			const cw = vp[3] * sx + vp[7] * sy + vp[11] * sz + vp[15];
			if (cw > .001) {
				const ndcX = (vp[0] * sx + vp[4] * sy + vp[8] * sz + vp[12]) / cw;
				const ndcY = (vp[1] * sx + vp[5] * sy + vp[9] * sz + vp[13]) / cw;
				const edge = (v) => Math.min(1, Math.max(0, (1.25 - Math.abs(v)) / .4));
				const vis = this.sunColData[3] * edge(ndcX) * edge(ndcY);
				this.sunScreenCache = vis > .002 ? {
					x: ndcX * .5 + .5,
					y: .5 - ndcY * .5,
					ndcX,
					ndcY,
					intensity: vis,
					color: [
						this.sunColData[0],
						this.sunColData[1],
						this.sunColData[2]
					]
				} : null;
			} else this.sunScreenCache = null;
		}
		this.lightsList = this.lightsList.filter((l) => !l.dead);
		if (this.lightsList.length > 8 && !this.warned.has("lights8")) {
			this.warned.add("lights8");
			console.warn(`Phaser AE: the WebGL fallback shades at most 8 3D lights — extra lights are ignored.`);
		}
		this.lightCount = Math.min(this.lightsList.length, 8);
		for (let i = 0; i < this.lightCount; i++) {
			const l = this.lightsList[i];
			const o = i * 16;
			const c = rgba(l.color);
			const d = this.lightData;
			d[o] = l.x;
			d[o + 1] = l.y;
			d[o + 2] = l.z;
			d[o + 3] = Math.max(l.radius, .001);
			d[o + 4] = c[0] * l.intensity;
			d[o + 5] = c[1] * l.intensity;
			d[o + 6] = c[2] * l.intensity;
			d[o + 7] = l.type === "spot" ? 1 : 0;
			const dl = Math.hypot(l.dir.x, l.dir.y, l.dir.z) || 1;
			d[o + 8] = l.dir.x / dl;
			d[o + 9] = l.dir.y / dl;
			d[o + 10] = l.dir.z / dl;
			d[o + 11] = Math.cos(l.cone.outer);
			d[o + 12] = Math.cos(l.cone.inner);
			d[o + 13] = 0;
			d[o + 14] = 0;
			d[o + 15] = 0;
		}
		if (this.palettesTop > 0) {
			for (const m of this.animated) m.writePalettes(this.palettesData);
			this.uploadPalettes();
		}
		this.blobCount = 0;
		const blobsOn = this.blobs.enabled;
		for (const [, geo] of this.geos) {
			geo.list = geo.list.filter((m) => !m.dead);
			geo.drawCount = 0;
			geo.transCount = 0;
			if (!geo.list.length) continue;
			if (geo.list.length * 28 > geo.data.length) {
				let len = geo.data.length;
				while (len < geo.list.length * 28) len *= 2;
				geo.data = new Float32Array(len);
			}
			let transCount = 0;
			for (const m of geo.list) {
				let px, py, pz, pyaw, ppitch, proll;
				let ew, eh, ed;
				if (m.parent) {
					const eff = composeChain(m.x, m.y, m.z, m.yaw, m.pitch, m.roll, m.parent);
					px = eff.x;
					py = eff.y;
					pz = eff.z;
					pyaw = eff.yaw;
					ppitch = eff.pitch;
					proll = eff.roll;
					ew = m.w * eff.scale;
					eh = m.h * eff.scale;
					ed = m.d * eff.scale;
				} else {
					px = m.x;
					py = m.y;
					pz = m.z;
					pyaw = m.yaw;
					ppitch = m.pitch;
					proll = m.roll;
					ew = m.w;
					eh = m.h;
					ed = m.d;
				}
				if (camPlanes) {
					const r = .55 * Math.hypot(ew, eh, ed);
					if (!sphereVsFrustum(camPlanes, px, py, pz, r) && !(shadowPlanes && sphereVsFrustum(shadowPlanes, px, py, pz, r))) continue;
				}
				if (blobsOn && m.blob !== false) {
					const bp = blobParams(ew, ed, py - eh * .5 - this.blobs.ground, this.blobs, m.blob === true);
					if (bp) this.pushBlob(px, pz, bp.rx, bp.rz, pyaw, bp.alpha);
				}
				if (geo.skinned && geo.basesData && geo.drawCount >= geo.basesData.length) {
					const grown = new Float32Array(geo.basesData.length * 2);
					grown.set(geo.basesData);
					geo.basesData = grown;
				}
				let d = geo.data;
				let o;
				if (m.alpha < 1 && !geo.skinned) {
					const need = geo.list.length * 28;
					if (!geo.transData || geo.transData.length < need) geo.transData = new Float32Array(need);
					d = geo.transData;
					o = transCount++ * 28;
					(geo.transMap ??= [])[transCount - 1] = m;
				} else {
					if (geo.skinned && geo.basesData) geo.basesData[geo.drawCount] = m.paletteBase;
					o = geo.drawCount++ * 28;
					(geo.packMap ??= [])[geo.drawCount - 1] = m;
				}
				const c = rgba(m.color);
				d[o] = px;
				d[o + 1] = py;
				d[o + 2] = pz;
				d[o + 3] = pyaw;
				d[o + 4] = ew;
				d[o + 5] = eh;
				d[o + 6] = ed;
				d[o + 7] = ppitch;
				d[o + 8] = c[0];
				d[o + 9] = c[1];
				d[o + 10] = c[2];
				d[o + 11] = m.alpha * c[3];
				d[o + 12] = proll;
				const tile = typeof m.tile === "number" ? {
					x: m.tile,
					y: m.tile
				} : m.tile;
				d[o + 13] = m.grain;
				d[o + 14] = tile.x ?? 1;
				d[o + 15] = tile.y ?? 1;
				if (m.texture === -2) {
					d[o + 16] = 0;
					d[o + 17] = 0;
					d[o + 18] = 1;
					d[o + 19] = 1;
				} else {
					const tf = this.atlas.frames[m.texture >= 0 ? m.texture : 0];
					if (tf) {
						d[o + 16] = tf.u0;
						d[o + 17] = tf.v0;
						d[o + 18] = tf.u1;
						d[o + 19] = tf.v1;
					} else {
						d[o + 16] = 0;
						d[o + 17] = 0;
						d[o + 18] = 0;
						d[o + 19] = 0;
					}
				}
				let hasNorm = false;
				if (m.normalMap === -2) {
					d[o + 20] = 0;
					d[o + 21] = 0;
					d[o + 22] = 1;
					d[o + 23] = 1;
					hasNorm = true;
				} else {
					const nf = m.normalMap >= 0 ? this.atlas.frames[m.normalMap] : void 0;
					if (nf) {
						d[o + 20] = nf.u0;
						d[o + 21] = nf.v0;
						d[o + 22] = nf.u1;
						d[o + 23] = nf.v1;
						hasNorm = true;
					} else {
						d[o + 20] = 0;
						d[o + 21] = 0;
						d[o + 22] = 0;
						d[o + 23] = 0;
					}
				}
				d[o + 24] = hasNorm ? m.bump : 0;
				d[o + 25] = m.metallic;
				d[o + 26] = m.rough ?? 1 - Math.min(1, Math.max(0, m.gloss)) * .85;
				d[o + 27] = m.emissive;
			}
			geo.transCount = transCount;
		}
		this.bills = this.bills.filter((b) => !b.dead);
		this.bbCount = this.bills.length;
		if (this.bbCount * 16 > this.bbData.length) {
			let len = this.bbData.length;
			while (len < this.bbCount * 16) len *= 2;
			this.bbData = new Float32Array(len);
		}
		this.bills.forEach((b, i) => {
			if (blobsOn) {
				const bp = blobParams(b.w * .7, b.w * .7, b.y - this.blobs.ground, this.blobs);
				if (bp) this.pushBlob(b.x, b.z, bp.rx, bp.rz, 0, bp.alpha);
			}
			const o = i * 16;
			const f = this.atlas.frames[b.frame];
			const c = b.tint ? rgba(b.tint) : [
				1,
				1,
				1,
				1
			];
			const d = this.bbData;
			d[o] = b.x;
			d[o + 1] = b.y;
			d[o + 2] = b.z;
			d[o + 3] = b.flipX ? 1 : 0;
			d[o + 4] = b.w;
			d[o + 5] = b.h;
			d[o + 6] = 0;
			d[o + 7] = 0;
			d[o + 8] = c[0];
			d[o + 9] = c[1];
			d[o + 10] = c[2];
			d[o + 11] = c[3];
			if (f) {
				d[o + 12] = f.u0;
				d[o + 13] = f.v0;
				d[o + 14] = f.u1;
				d[o + 15] = f.v1;
			} else {
				d[o + 12] = 0;
				d[o + 13] = 0;
				d[o + 14] = 0;
				d[o + 15] = 0;
			}
		});
		this.blobShadowsList = this.blobShadowsList.filter((b) => !b.dead);
		if (blobsOn) for (const b of this.blobShadowsList) {
			let px = b.x, pz = b.z, py = b.y, pyaw = b.yaw, ew = b.w, ed = b.d;
			if (b.parent) {
				const eff = composeChain(b.x, b.y, b.z, b.yaw, 0, 0, b.parent);
				px = eff.x;
				py = eff.y;
				pz = eff.z;
				pyaw = eff.yaw;
				ew = b.w * eff.scale;
				ed = b.d * eff.scale;
			}
			const opts = b.alpha == null ? this.blobs : {
				...this.blobs,
				alpha: b.alpha
			};
			const bp = blobParams(ew, ed, py - this.blobs.ground, opts, true);
			if (bp) this.pushBlob(px, pz, bp.rx, bp.rz, pyaw, bp.alpha);
		}
		const fogC = this.fog ? rgba(this.fog.color) : [
			0,
			0,
			0,
			0
		];
		if (this.envDirty && typeof document !== "undefined") this.uploadEnv();
		const skyC = rgba(this.sun.sky), gndC = rgba(this.sun.ground);
		const so = this.shadowOpts;
		const frame = {
			shadowVP: shadowVP ?? this.idMat,
			shadow: [
				shadowVP ? 1 : 0,
				so?.bias ?? 3e-4,
				so ? 1 / so.res : 0,
				so ? 2 * so.size / so.res * 1.5 : 0
			],
			vp,
			camPos: [
				eye.x,
				eye.y,
				eye.z,
				0
			],
			fogColor: [
				fogC[0],
				fogC[1],
				fogC[2],
				this.sun.ambient
			],
			params: [
				this.fog?.near ?? 0,
				this.fog?.far ?? 1,
				this.fog ? 1 : 0,
				this.time
			],
			lightDir: [
				this.sun.x / ll,
				this.sun.y / ll,
				this.sun.z / ll,
				0
			],
			right: [
				basis.right.x,
				basis.right.y,
				basis.right.z,
				0
			],
			up: [
				basis.up.x,
				basis.up.y,
				basis.up.z,
				0
			],
			ambSky: [
				skyC[0],
				skyC[1],
				skyC[2],
				this.envStrength
			],
			ambGround: [
				gndC[0],
				gndC[1],
				gndC[2],
				0
			],
			sunCol: this.sunColData,
			uwC: this.underwater3d?.causticActive && this.underwater3d.water ? [
				1,
				this.underwater3d.water.levelNow(),
				this.underwater3d.caustics.scale,
				this.underwater3d.causticSpeedNow
			] : [
				0,
				0,
				1,
				1
			],
			uwC2: this.underwater3d?.causticActive && this.underwater3d.water ? [
				this.underwater3d.causticStrengthNow,
				this.underwater3d.caustics.maxDepth,
				this.underwater3d.caustics.rgbSplit,
				this.underwater3d.sunSigma[1]
			] : [
				1,
				20,
				0,
				.05
			]
		};
		if (this.underwater3d && this.uwLayer && !this.underwater3d.dead) {
			const uw = this.underwater3d;
			const body = uw.water && !uw.water.dead ? uw.water : this.waters.find((w) => w.kind === "grid" && !w.dead) ?? null;
			uw.water = body;
			const storm = this.skyHandle ? Math.min(1, Math.max(0, this.skyHandle.storm)) : 0;
			const sunI = this.sunColData[3] ?? 1;
			if (body) {
				body.timeNow = this.time;
				uw.tick(eye.x, eye.y, eye.z, body.heightAt(eye.x, eye.z), storm, sunI);
			} else uw.tick(eye.x, eye.y, eye.z, -1e9, storm, sunI);
			if (uw.submerged) {
				if (this.uwSavedFog === void 0) this.uwSavedFog = this.fog;
				this.fog = uw.fogNow;
			} else if (this.uwSavedFog !== void 0) {
				this.fog = this.uwSavedFog;
				this.uwSavedFog = void 0;
			}
			this.uwLayer.pack(uw, vp, eye, this.sun, sunI, this.time, storm);
		}
		this.waters = this.waters.filter((w) => !w.dead);
		if (this.waterLayer && this.waters.length) this.waterLayer.foamPass(this.waters, eye.x, eye.z, this.lastDt, scene?.fbo ?? null, width, height);
		if (this.deformRecs.length) this.syncDeforms();
		if (shadowVP) this.drawShadowPass(shadowVP, scene ?? null, width, height);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.depthMask(true);
		gl.disable(gl.BLEND);
		gl.enable(gl.CULL_FACE);
		gl.frontFace(gl.CCW);
		gl.cullFace(gl.BACK);
		for (const [, geo] of this.geos) if (geo.drawCount) this.drawMeshBucket(geo, false, frame);
		if (this.ghostParts.length) this.drawGhosts(frame);
		if (this.deformRecs.length) this.drawDeformPatches(frame);
		if (this.voxelLayer) this.drawsLast += this.voxelLayer.render(frame);
		for (const gf of this.grassFields) {
			if (gf.grass.dead) continue;
			gf.grass.spawn(eye.x, eye.y, eye.z, camPlanes);
			this.drawsLast += gf.grass.draw(frame);
		}
		gl.disable(gl.CULL_FACE);
		if (this.bbCount) this.drawBillboards(frame);
		if (this.skyHandle) this.drawSky(width, height, aspect, basis);
		if (scene && (this.ssaoEnabled || this.raysEnabled || this.waters.length || this.beams.length)) this.blitDepthCopy(scene);
		const flareWanted = (this.flareOn ?? this.skyHandle?.flare ?? false) && !!this.sunScreenCache;
		if (flareWanted) this.probeSunOcclusion(width, height);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.depthMask(false);
		if (this.blobCount) this.drawBlobs(frame);
		if (this.waterLayer && this.waters.length) {
			const projA = this.curFar / (this.curNear - this.curFar);
			const projB = this.curNear * this.curFar / (this.curNear - this.curFar);
			this.drawsLast += this.waterLayer.draw(this.waters, frame, this.lightData, this.lightCount, this.envTex, this.depthCopyTex, this.whiteTex, this.time, projA, projB, width, height);
		}
		gl.enable(gl.CULL_FACE);
		for (const [, geo] of this.geos) if (geo.transCount) this.drawMeshBucket(geo, true, frame);
		gl.disable(gl.CULL_FACE);
		this.beams = this.beams.filter((b) => !b.light.dead);
		if (this.beams.length) this.drawBeams(frame, near, far);
		if (this.vecShapes.length) this.drawLines(frame, width, height);
		if (this.trails.length) this.drawTrails(frame);
		this.drawFx(frame);
		this.wisps = this.wisps.filter((w) => !w.dead);
		if (this.wisps.length) this.drawWisps(frame);
		if (flareWanted) this.drawFlare(width, height);
		if (scene && this.ssaoEnabled) this.runSsao(scene, proj, width, height);
		if (scene && this.uwLayer?.active) {
			this.uwLayer.renderShafts(this.depthCopyTex, width, height, scene.fbo);
			this.drawsLast += this.uwLayer.composite(this.depthCopyTex);
		}
		if (scene && this.raysEnabled) this.runRays(scene, width, height);
		gl.depthMask(true);
		gl.disable(gl.BLEND);
		gl.frontFace(gl.CCW);
		gl.bindVertexArray(null);
	}
	/** useProgram + upload the per-frame uniforms once per program per frame. */
	useProg(prog, frame) {
		const gl = this.gl;
		gl.useProgram(prog.p);
		if (prog.stamp === this.frameStamp) return;
		prog.stamp = this.frameStamp;
		const u = prog.u;
		if (u.uViewProj) gl.uniformMatrix4fv(u.uViewProj, false, frame.vp);
		if (u.uCamPos) gl.uniform4fv(u.uCamPos, frame.camPos);
		if (u.uFogColor) gl.uniform4fv(u.uFogColor, frame.fogColor);
		if (u.uParams) gl.uniform4fv(u.uParams, frame.params);
		if (u.uLightDir) gl.uniform4fv(u.uLightDir, frame.lightDir);
		if (u.uRight) gl.uniform4fv(u.uRight, frame.right);
		if (u.uUp) gl.uniform4fv(u.uUp, frame.up);
		if (u.uAmbSky) gl.uniform4fv(u.uAmbSky, frame.ambSky);
		if (u.uEnvMips) gl.uniform1f(u.uEnvMips, this.envMips);
		if (u.uAmbGround) gl.uniform4fv(u.uAmbGround, frame.ambGround);
		if (u.uSunCol) gl.uniform4fv(u.uSunCol, frame.sunCol);
		if (u.uLights) gl.uniform4fv(u.uLights, this.lightData);
		if (u.uLightCount) gl.uniform1f(u.uLightCount, this.lightCount);
		if (u.uShadowVP) gl.uniformMatrix4fv(u.uShadowVP, false, frame.shadowVP);
		if (u.uShadow) gl.uniform4fv(u.uShadow, frame.shadow);
		if (u.uUwC) gl.uniform4fv(u.uUwC, frame.uwC);
		if (u.uUwC2) gl.uniform4fv(u.uUwC2, frame.uwC2);
	}
	/** Bind a texture to a unit, defaulting the shared atlas's filter back to
	* LINEAR (the 2D batches flip it per flush on the same texture object). */
	bindTex(unit, tex) {
		const gl = this.gl;
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, tex);
		if (tex && tex === this.atlasTex) {
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		}
	}
	drawMeshBucket(geo, translucent, frame) {
		const gl = this.gl;
		const prog = geo.skinned ? this.skinProg : geo.deform ? this.deformProg : this.meshProg;
		if (!prog.p) return;
		const count = translucent ? geo.transCount : geo.drawCount;
		const data = translucent ? geo.transData : geo.data;
		this.useProg(prog, frame);
		if (!geo.vao) geo.vao = gl.createVertexArray();
		gl.bindVertexArray(geo.vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, geo.vbuf);
		const stride = geo.skinned ? 44 : 32;
		gl.enableVertexAttribArray(0);
		gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
		gl.enableVertexAttribArray(1);
		gl.vertexAttribPointer(1, 3, gl.FLOAT, false, stride, 12);
		gl.enableVertexAttribArray(2);
		gl.vertexAttribPointer(2, 2, gl.FLOAT, false, stride, 24);
		if (geo.skinned) {
			gl.enableVertexAttribArray(3);
			gl.vertexAttribIPointer(3, 4, gl.UNSIGNED_SHORT, 44, 32);
			gl.enableVertexAttribArray(4);
			gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, 44, 40);
			if (!geo.basesBuf) geo.basesBuf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, geo.basesBuf);
			gl.bufferData(gl.ARRAY_BUFFER, geo.basesData, gl.DYNAMIC_DRAW);
			gl.enableVertexAttribArray(5);
			gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 4, 0);
			gl.vertexAttribDivisor(5, 1);
		}
		(translucent ? geo.transInst ??= new InstanceBuffer(gl) : geo.inst).upload(data, count * 28);
		instanceVec4Attribs(gl, 8, 7);
		this.bindTex(0, geo.colorTex ?? this.atlasTex ?? this.whiteTex);
		this.bindTex(1, geo.normalTex ?? this.atlasTex ?? this.flatNormalTex);
		this.bindTex(2, geo.mrTex ?? this.whiteTex);
		if (geo.skinned) this.bindTex(3, this.paletteTex);
		this.bindTex(4, this.envTex ?? this.whiteTex);
		this.bindTex(5, this.shadowTex ?? this.shadowDummy);
		this.bindTex(6, this.uwLayer?.causticTex ?? this.whiteTex);
		if (geo.deform && prog.u.uDU) {
			gl.uniform4fv(prog.u.uDU, geo.deform.du);
			this.bindTex(7, geo.deform.tex);
		}
		gl.drawArraysInstanced(gl.TRIANGLES, 0, geo.vertCount, count);
		this.drawsLast++;
	}
	drawBillboards(frame) {
		const gl = this.gl;
		if (!this.bbProg.p || !this.atlasTex) return;
		this.useProg(this.bbProg, frame);
		if (!this.bbVao) this.bbVao = gl.createVertexArray();
		gl.bindVertexArray(this.bbVao);
		this.bbInst.upload(this.bbData, this.bbCount * 16);
		instanceVec4Attribs(gl, 0, 4);
		this.bindTex(0, this.atlasTex);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.bbCount);
		this.drawsLast++;
	}
	drawBlobs(frame) {
		const gl = this.gl;
		if (!this.blobProg.p) return;
		this.useProg(this.blobProg, frame);
		if (!this.blobVao) this.blobVao = gl.createVertexArray();
		gl.bindVertexArray(this.blobVao);
		this.blobInst.upload(this.blobData, this.blobCount * 8);
		instanceVec4Attribs(gl, 0, 2);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.blobCount);
		this.drawsLast++;
	}
	drawFx(frame) {
		const gl = this.gl;
		if (!this.fxProg.p) return;
		const atlas = this.atlas;
		let n = 0;
		let data = this.fxData;
		const cap = () => data.length / 16 | 0;
		const write = (x, y, z, size, rot, mode, r, g, b, a, add, frame2, p, lit) => {
			if (n >= cap()) {
				const grown = new Float32Array(data.length * 2);
				grown.set(data);
				data = this.fxData = grown;
			}
			const o = n * 16;
			data[o] = x;
			data[o + 1] = y;
			data[o + 2] = z;
			data[o + 3] = size;
			data[o + 4] = r;
			data[o + 5] = g;
			data[o + 6] = b;
			data[o + 7] = a;
			data[o + 8] = rot;
			data[o + 9] = mode;
			data[o + 10] = (add ? 1 : 0) + (lit ? 2 : 0);
			data[o + 11] = p;
			const f = atlas.frames[mode === 1 && frame2 >= 0 ? frame2 : 0];
			if (f) {
				data[o + 12] = f.u0;
				data[o + 13] = f.v0;
				data[o + 14] = f.u1;
				data[o + 15] = f.v1;
			}
			n++;
		};
		this.fx.pack(write);
		for (const wp of this.weatherPools) {
			if (wp.handle.dead) continue;
			for (let i = 0; i < wp.count; i++) {
				const o = i * 3;
				const c = wp.colors[wp.seeds[i] * wp.colors.length | 0] ?? wp.colors[0];
				const size = Math.max(.01, wp.size + (wp.seeds[i] - .5) * 2 * wp.sizeVar);
				write(wp.pos[o], wp.pos[o + 1], wp.pos[o + 2], size, 0, 0, c[0], c[1], c[2], wp.alpha * c[3], wp.add, -1, wp.soft, false);
			}
		}
		if (n === 0) return;
		this.useProg(this.fxProg, frame);
		if (!this.fxVao) this.fxVao = gl.createVertexArray();
		gl.bindVertexArray(this.fxVao);
		this.fxInst.upload(this.fxData, n * 16);
		instanceVec4Attribs(gl, 0, 4);
		this.bindTex(0, this.atlasTex ?? this.whiteTex);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
		this.drawsLast++;
	}
	/** Pack + draw the 3D vector lines — Vector3dLayer.prepare()+draw(), GL-side.
	* One instanced draw; screen-pixel width; premultiplied over, depth-tested
	* read-only (the translucent-pass recipe). */
	drawLines(frame, width, height) {
		const gl = this.gl;
		if (!this.lineProg.p) return;
		let live = 0;
		for (let i = this.vecShapes.length - 1; i >= 0; i--) if (this.vecShapes[i].dead) this.vecShapes.splice(i, 1);
		else live += this.vecShapes[i].segs.length;
		if (!live) return;
		if (live * 16 > this.lineData.length) {
			let len = this.lineData.length;
			while (len < live * 16) len *= 2;
			this.lineData = new Float32Array(len);
		}
		const d = this.lineData;
		let count = 0;
		for (const sh of this.vecShapes) {
			const q = eulerToQuat(sh.yaw, sh.pitch, sh.roll);
			const c = rgba(sh.color);
			const a = sh.alpha;
			const capped = sh.width >= 1 ? 1 : 0;
			for (const seg of sh.segs) {
				const o = count++ * 16;
				const pa = quatRotate(q, seg[0] * sh.scale, seg[1] * sh.scale, seg[2] * sh.scale);
				const pb = quatRotate(q, seg[3] * sh.scale, seg[4] * sh.scale, seg[5] * sh.scale);
				d[o] = sh.x + pa[0];
				d[o + 1] = sh.y + pa[1];
				d[o + 2] = sh.z + pa[2];
				d[o + 3] = sh.width / 2;
				d[o + 4] = sh.x + pb[0];
				d[o + 5] = sh.y + pb[1];
				d[o + 6] = sh.z + pb[2];
				d[o + 7] = capped;
				d[o + 8] = c[0];
				d[o + 9] = c[1];
				d[o + 10] = c[2];
				d[o + 11] = c[3] * a;
				d[o + 12] = c[0];
				d[o + 13] = c[1];
				d[o + 14] = c[2];
				d[o + 15] = c[3] * a;
			}
		}
		this.linesLast = count;
		this.useProg(this.lineProg, frame);
		const u = this.lineProg.u;
		if (u.uScreen) gl.uniform4f(u.uScreen, width, height, .1, 0);
		if (!this.lineVao) this.lineVao = gl.createVertexArray();
		gl.bindVertexArray(this.lineVao);
		this.lineInst.upload(this.lineData, count * 16);
		instanceVec4Attribs(gl, 0, 4);
		gl.disable(gl.CULL_FACE);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, count);
		gl.bindVertexArray(null);
		this.drawsLast++;
	}
	/** Pack + draw the spotlight beams — Beam3dLayer.update()+draw(), GL-side:
	* one instance per live beam, following its light's pose/dir/cone/colour;
	* additive, depth-tested read-only, cull off; the soft depth fade rides
	* the depth copy (no-ops gracefully when the scene isn't offscreen). */
	drawBeams(frame, near, far) {
		const gl = this.gl;
		if (!this.beamProg.p) return;
		if (this.beams.length * 12 > this.beamData.length) {
			let len = this.beamData.length;
			while (len < this.beams.length * 12) len *= 2;
			this.beamData = new Float32Array(len);
		}
		let n = 0;
		for (const b of this.beams) {
			const l = b.light;
			const len = b.opts.length ?? l.radius;
			const dl = Math.hypot(l.dir.x, l.dir.y, l.dir.z) || 1;
			const R = len * Math.tan(Math.min(1.45, Math.max(.01, l.cone.outer)));
			const c = rgba(b.opts.color ?? l.color);
			const o = n * 12;
			const d = this.beamData;
			d[o] = l.x;
			d[o + 1] = l.y;
			d[o + 2] = l.z;
			d[o + 3] = len;
			d[o + 4] = l.dir.x / dl;
			d[o + 5] = l.dir.y / dl;
			d[o + 6] = l.dir.z / dl;
			d[o + 7] = R;
			d[o + 8] = c[0];
			d[o + 9] = c[1];
			d[o + 10] = c[2];
			d[o + 11] = b.opts.intensity ?? .6;
			n++;
		}
		if (!n) return;
		this.useProg(this.beamProg, frame);
		const u = this.beamProg.u;
		if (u.uLin) gl.uniform4f(u.uLin, far / (near - far), near * far / (near - far), far * .04, 0);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.depthCopyTex ?? this.whiteTex);
		if (!this.beamVao) this.beamVao = gl.createVertexArray();
		gl.bindVertexArray(this.beamVao);
		this.beamInst.upload(this.beamData, n * 12);
		instanceVec4Attribs(gl, 0, 3);
		gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 120, n);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.bindVertexArray(null);
		this.drawsLast++;
	}
	/** Pack + draw the 3D trails — renderTranslucent's trail block, GL-side.
	* Instance data rides an RGBA32F texture (29 texels per trail row) because
	* 116 floats can't fit instance attributes; view-facing ribbons draw first
	* (cull ON — folds on tight curves double additive brightness, world3d's
	* "stack of quads" lesson), then the 'up' walls (cull OFF, double-sided)
	* via a uRowBase uniform standing in for GL's missing firstInstance. */
	drawTrails(frame) {
		const gl = this.gl;
		if (!this.trailProgView.p && !this.trailProgUp.p) return;
		for (const t of this.trails) t.feedFollow();
		const ready = this.trails.filter((t) => t.ready);
		if (!ready.length) return;
		const view = ready.filter((t) => t.facing !== "up");
		const walls = ready.filter((t) => t.facing === "up");
		const live = [...view, ...walls];
		if (live.length * 116 > this.trailData.length) {
			let len = this.trailData.length;
			while (len < live.length * 116) len *= 2;
			this.trailData = new Float32Array(len);
		}
		live.forEach((t, i) => {
			const o = i * 116;
			const f = this.atlas.frames[t.frame];
			const d = this.trailData;
			d[o] = t.width;
			d[o + 1] = t.alpha;
			d[o + 2] = t.add ? 1 : 0;
			d[o + 3] = t.taper ? 1 : 0;
			d[o + 4] = t.turbulence;
			d[o + 5] = t.erode;
			d[o + 6] = t.core;
			d[o + 7] = t.seed;
			d[o + 12] = t.crackle;
			d[o + 13] = 0;
			d[o + 14] = 0;
			d[o + 15] = 0;
			if (f) {
				d[o + 16] = f.u0;
				d[o + 17] = f.v0;
				d[o + 18] = f.u1;
				d[o + 19] = f.v1;
			} else {
				d[o + 16] = 0;
				d[o + 17] = 0;
				d[o + 18] = 0;
				d[o + 19] = 0;
			}
			for (let ci = 0; ci < 8; ci++) {
				const c = rgba(t.colors[Math.min(ci, t.colors.length - 1)] ?? "#ffffff");
				d.set(c, o + 20 + ci * 4);
			}
			const span = t.pack(d, o + 52);
			d[o + 8] = t.dist;
			d[o + 9] = span;
			d[o + 10] = t.fiber;
			d[o + 11] = t.hard;
		});
		const rows = live.length;
		if (!this.trailTex || this.trailTexRows < rows) {
			if (this.trailTex) gl.deleteTexture(this.trailTex);
			this.trailTex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.trailTex);
			this.trailTexRows = Math.max(rows, 16);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 29, this.trailTexRows, 0, gl.RGBA, gl.FLOAT, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		} else gl.bindTexture(gl.TEXTURE_2D, this.trailTex);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 29, rows, gl.RGBA, gl.FLOAT, this.trailData.subarray(0, rows * 116));
		if (!this.trailVao) this.trailVao = gl.createVertexArray();
		gl.bindVertexArray(this.trailVao);
		this.bindTex(0, this.atlasTex ?? this.whiteTex);
		this.bindTex(1, this.trailTex);
		if (view.length && this.trailProgView.p) {
			this.useProg(this.trailProgView, frame);
			if (this.trailProgView.u.uRowBase) gl.uniform1i(this.trailProgView.u.uRowBase, 0);
			gl.enable(gl.CULL_FACE);
			gl.drawArraysInstanced(gl.TRIANGLES, 0, 288, view.length);
			gl.disable(gl.CULL_FACE);
			this.drawsLast++;
		}
		if (walls.length && this.trailProgUp.p) {
			this.useProg(this.trailProgUp, frame);
			if (this.trailProgUp.u.uRowBase) gl.uniform1i(this.trailProgUp.u.uRowBase, view.length);
			gl.drawArraysInstanced(gl.TRIANGLES, 0, 288, walls.length);
			this.drawsLast++;
		}
		gl.bindVertexArray(null);
	}
	/** Pack + draw the wisps — World3d.renderTranslucent's wisp block, GL-side
	* (5 vec4 instance attributes, SEGX×SEGY×6 verts per instance, no cull,
	* premultiplied over, depth read-only — pass B has that state set). */
	drawWisps(frame) {
		const gl = this.gl;
		if (!this.wispProg.p || !this.atlasTex) return;
		if (this.wisps.length * 20 > this.wispData.length) {
			let len = this.wispData.length;
			while (len < this.wisps.length * 20) len *= 2;
			this.wispData = new Float32Array(len);
		}
		this.wisps.forEach((w, i) => {
			const o = i * 20;
			const f = this.atlas.frames[w.frame];
			const c = rgba(w.color);
			const d = this.wispData;
			d[o] = w.x;
			d[o + 1] = w.y;
			d[o + 2] = w.z;
			d[o + 3] = w.twist;
			d[o + 4] = w.w;
			d[o + 5] = w.h;
			d[o + 6] = w.speed;
			d[o + 7] = w.wind;
			d[o + 8] = c[0];
			d[o + 9] = c[1];
			d[o + 10] = c[2];
			d[o + 11] = w.alpha * c[3];
			if (f) {
				d[o + 12] = f.u0;
				d[o + 13] = f.v0;
				d[o + 14] = f.u1;
				d[o + 15] = f.v1;
			} else {
				d[o + 12] = 0;
				d[o + 13] = 0;
				d[o + 14] = 0;
				d[o + 15] = 0;
			}
			d[o + 16] = w.remap[0];
			d[o + 17] = w.remap[1];
			d[o + 18] = w.yaw;
			d[o + 19] = 0;
		});
		this.useProg(this.wispProg, frame);
		if (!this.wispVao) this.wispVao = gl.createVertexArray();
		gl.bindVertexArray(this.wispVao);
		this.wispInst.upload(this.wispData, this.wisps.length * 20);
		instanceVec4Attribs(gl, 0, 5);
		this.bindTex(0, this.atlasTex);
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 480 * 6, this.wisps.length);
		gl.bindVertexArray(null);
		this.drawsLast++;
	}
	/** The depth-only SHADOW pass — every packed bucket (dynamic + static +
	* terrain + skinned) into the sun's ortho map, cull OFF (world3d's donut
	* lesson: both faces render, nearest wins). Instance data is uploaded here
	* and re-used by the main pass. */
	drawShadowPass(shadowVP, scene, width, height) {
		const gl = this.gl;
		if (!this.shadowFbo || !this.shadowOpts) return;
		const res = this.shadowOpts.res;
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
		gl.viewport(0, 0, res, res);
		gl.disable(gl.BLEND);
		gl.disable(gl.CULL_FACE);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.depthMask(true);
		gl.clearDepth(1);
		gl.clear(gl.DEPTH_BUFFER_BIT);
		for (const [, geo] of this.geos) {
			if (!geo.drawCount) continue;
			const prog = geo.skinned ? this.shadowSkinProg : this.shadowProg;
			if (!prog.p) continue;
			gl.useProgram(prog.p);
			if (prog.u.uViewProj) gl.uniformMatrix4fv(prog.u.uViewProj, false, shadowVP);
			if (!geo.vao) geo.vao = gl.createVertexArray();
			gl.bindVertexArray(geo.vao);
			gl.bindBuffer(gl.ARRAY_BUFFER, geo.vbuf);
			const stride = geo.skinned ? 44 : 32;
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 3, gl.FLOAT, false, stride, 0);
			if (geo.skinned) {
				gl.enableVertexAttribArray(3);
				gl.vertexAttribIPointer(3, 4, gl.UNSIGNED_SHORT, 44, 32);
				gl.enableVertexAttribArray(4);
				gl.vertexAttribPointer(4, 4, gl.UNSIGNED_BYTE, true, 44, 40);
				if (!geo.basesBuf) geo.basesBuf = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, geo.basesBuf);
				gl.bufferData(gl.ARRAY_BUFFER, geo.basesData, gl.DYNAMIC_DRAW);
				gl.enableVertexAttribArray(5);
				gl.vertexAttribPointer(5, 1, gl.FLOAT, false, 4, 0);
				gl.vertexAttribDivisor(5, 1);
				this.bindTex(0, this.paletteTex);
			}
			geo.inst.upload(geo.data, geo.drawCount * 28);
			instanceVec4Attribs(gl, 8, 7);
			gl.drawArraysInstanced(gl.TRIANGLES, 0, geo.vertCount, geo.drawCount);
			this.drawsLast++;
		}
		gl.bindVertexArray(null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, scene ? scene.fbo : null);
		gl.viewport(0, 0, width, height);
	}
	/** (Re)create the shadow-map depth texture + FBO at the current res. */
	ensureShadowTarget() {
		const gl = this.gl;
		if (!this.shadowOpts) return;
		const res = this.shadowOpts.res;
		if (this.shadowTex) gl.deleteTexture(this.shadowTex);
		if (this.shadowFbo) gl.deleteFramebuffer(this.shadowFbo);
		this.shadowTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.shadowTex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, res, res, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		this.shadowFbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.shadowFbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.shadowTex, 0);
		gl.drawBuffers([gl.NONE]);
		gl.readBuffer(gl.NONE);
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	}
	/** Poll + issue the sun-occlusion query: a ~14px far-depth quad at the
	* sun's ndc position, colour writes off, inside ANY_SAMPLES_PASSED. The
	* async result (1–2 frames stale, like the WebGPU readbacks) eases
	* flareOcc toward 0/1 — binary vs the original's 9-tap fraction, smoothed
	* so the collapse still reads gradual. */
	probeSunOcclusion(width, height) {
		const gl = this.gl;
		const s = this.sunScreenCache;
		if (!this.probeProg.p || !s) return;
		const q = this.flareQuery ??= gl.createQuery();
		if (!q) return;
		if (this.flareQueryPending && gl.getQueryParameter(q, gl.QUERY_RESULT_AVAILABLE)) {
			this.flareOccTarget = gl.getQueryParameter(q, gl.QUERY_RESULT) ? 1 : 0;
			this.flareQueryPending = false;
		}
		this.flareOcc += (this.flareOccTarget - this.flareOcc) * .3;
		if (!this.flareQueryPending) {
			gl.useProgram(this.probeProg.p);
			if (this.probeProg.u.uSunPos) gl.uniform4f(this.probeProg.u.uSunPos, s.ndcX, s.ndcY, 14 / width, 14 / height);
			gl.colorMask(false, false, false, false);
			gl.depthMask(false);
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);
			if (!this.fsVao) this.fsVao = gl.createVertexArray();
			gl.bindVertexArray(this.fsVao);
			gl.beginQuery(gl.ANY_SAMPLES_PASSED, q);
			gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
			gl.endQuery(gl.ANY_SAMPLES_PASSED);
			gl.bindVertexArray(null);
			gl.colorMask(true, true, true, true);
			gl.depthMask(true);
			this.flareQueryPending = true;
		}
	}
	/** Draw the flare ghost chain — additive (ONE, ONE / alpha ZERO, ONE),
	* depth ignored, at the very end of pass B (flares live ON the lens). */
	drawFlare(width, height) {
		const gl = this.gl;
		const s = this.sunScreenCache;
		if (!this.flareProg.p || !s) return;
		const vis = Math.min(1, s.intensity) * this.flareOcc;
		if (vis <= .002) return;
		gl.useProgram(this.flareProg.p);
		const u = this.flareProg.u;
		if (u.uSun) gl.uniform4f(u.uSun, s.ndcX, s.ndcY, vis, 0);
		if (u.uScr) gl.uniform4f(u.uScr, width, height, 0, 0);
		if (u.uColor) gl.uniform4f(u.uColor, s.color[0], s.color[1], s.color[2], 0);
		gl.disable(gl.DEPTH_TEST);
		gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
		if (!this.fsVao) this.fsVao = gl.createVertexArray();
		gl.bindVertexArray(this.fsVao);
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 6, 8);
		gl.bindVertexArray(null);
		gl.enable(gl.DEPTH_TEST);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		this.drawsLast++;
	}
	/** Blit the scene FBO's depth into the scratch copy (the seam's rule: an
	* FBO's own depth attachment cannot be sampled while that FBO is bound). */
	blitDepthCopy(scene) {
		const gl = this.gl;
		if (!this.depthCopyTex || this.depthCopyW !== scene.width || this.depthCopyH !== scene.height) {
			if (this.depthCopyTex) gl.deleteTexture(this.depthCopyTex);
			if (this.depthCopyFbo) gl.deleteFramebuffer(this.depthCopyFbo);
			this.depthCopyTex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.depthCopyTex);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, scene.width, scene.height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			this.depthCopyFbo = gl.createFramebuffer();
			gl.bindFramebuffer(gl.FRAMEBUFFER, this.depthCopyFbo);
			gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depthCopyTex, 0);
			gl.drawBuffers([gl.NONE]);
			gl.readBuffer(gl.NONE);
			this.depthCopyW = scene.width;
			this.depthCopyH = scene.height;
		}
		gl.bindFramebuffer(gl.READ_FRAMEBUFFER, scene.fbo);
		gl.bindFramebuffer(gl.DRAW_FRAMEBUFFER, this.depthCopyFbo);
		gl.blitFramebuffer(0, 0, scene.width, scene.height, 0, 0, scene.width, scene.height, gl.DEPTH_BUFFER_BIT, gl.NEAREST);
		gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
	}
	/** One half-res colour target (fbo + tex) for the effect chains. */
	makeHalfTarget(w, h, internal) {
		const gl = this.gl;
		const tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texStorage2D(gl.TEXTURE_2D, 1, internal, w, h);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		const fbo = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
		return {
			fbo,
			tex
		};
	}
	/** SSAO — ssao.ts's render()+composite(), GL-side: half-res Alchemy AO
	* from the depth copy, bilateral H+V blur, multiply into the scene FBO. */
	runSsao(scene, proj, width, height) {
		const gl = this.gl;
		if (!this.ssaoProg.p || !this.ssaoBlurProg.p || !this.ssaoCompProg.p || !this.depthCopyTex) return;
		const hw = Math.max(1, width >> 1), hh = Math.max(1, height >> 1);
		if (!this.ssaoTargets || this.ssaoW !== hw || this.ssaoH !== hh) {
			if (this.ssaoTargets) for (const t of this.ssaoTargets) {
				gl.deleteTexture(t.tex);
				gl.deleteFramebuffer(t.fbo);
			}
			this.ssaoTargets = [this.makeHalfTarget(hw, hh, gl.RG8), this.makeHalfTarget(hw, hh, gl.RG8)];
			this.ssaoW = hw;
			this.ssaoH = hh;
		}
		const [A, B] = this.ssaoTargets;
		const invProj = mat4Inverse(proj);
		const projA = this.curFar / (this.curNear - this.curFar);
		const projB = this.curNear * this.curFar / (this.curNear - this.curFar);
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
		if (!this.fsVao) this.fsVao = gl.createVertexArray();
		gl.bindVertexArray(this.fsVao);
		gl.bindFramebuffer(gl.FRAMEBUFFER, A.fbo);
		gl.viewport(0, 0, hw, hh);
		gl.useProgram(this.ssaoProg.p);
		const u = this.ssaoProg.u;
		if (u.uInvProj) gl.uniformMatrix4fv(u.uInvProj, false, invProj);
		if (u.uProj) gl.uniformMatrix4fv(u.uProj, false, proj);
		if (u.uParams) gl.uniform4f(u.uParams, this.ssaoOpts.radius, this.ssaoOpts.strength, this.ssaoOpts.power, 0);
		if (u.uDepthP) gl.uniform4f(u.uDepthP, projA, projB, this.curFar, 0);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.depthCopyTex);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.useProgram(this.ssaoBlurProg.p);
		const ub = this.ssaoBlurProg.u;
		gl.bindFramebuffer(gl.FRAMEBUFFER, B.fbo);
		if (ub.uTexel) gl.uniform4f(ub.uTexel, 1 / hw, 0, 0, 0);
		gl.bindTexture(gl.TEXTURE_2D, A.tex);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindFramebuffer(gl.FRAMEBUFFER, A.fbo);
		if (ub.uTexel) gl.uniform4f(ub.uTexel, 0, 1 / hh, 0, 0);
		gl.bindTexture(gl.TEXTURE_2D, B.tex);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
		gl.viewport(0, 0, width, height);
		gl.useProgram(this.ssaoCompProg.p);
		gl.bindTexture(gl.TEXTURE_2D, A.tex);
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.ZERO, gl.SRC_COLOR, gl.ZERO, gl.ONE);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.disable(gl.BLEND);
		gl.bindVertexArray(null);
		this.drawsLast += 4;
	}
	/** GOD RAYS — rays.ts's render()+composite(), GL-side: a half-res radial
	* march over the depth copy toward the sun, added into the scene FBO. */
	runRays(scene, width, height) {
		const gl = this.gl;
		const s = this.sunScreenCache;
		if (!this.raysProg.p || !this.raysCompProg.p || !this.depthCopyTex) return;
		if (!s || s.intensity <= .001) return;
		const hw = Math.max(1, width >> 1), hh = Math.max(1, height >> 1);
		if (!this.raysTarget || this.raysW !== hw || this.raysH !== hh) {
			if (this.raysTarget) {
				gl.deleteTexture(this.raysTarget.tex);
				gl.deleteFramebuffer(this.raysTarget.fbo);
			}
			this.raysTarget = this.makeHalfTarget(hw, hh, gl.R8);
			this.raysW = hw;
			this.raysH = hh;
		}
		gl.disable(gl.DEPTH_TEST);
		gl.disable(gl.BLEND);
		if (!this.fsVao) this.fsVao = gl.createVertexArray();
		gl.bindVertexArray(this.fsVao);
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.raysTarget.fbo);
		gl.viewport(0, 0, hw, hh);
		gl.useProgram(this.raysProg.p);
		const u = this.raysProg.u;
		if (u.uSun) gl.uniform4f(u.uSun, s.ndcX * .5 + .5, s.ndcY * .5 + .5, s.intensity * this.raysOpts.strength, this.raysOpts.decay);
		if (u.uInfo) gl.uniform4f(u.uInfo, hw, hh, width, height);
		if (u.uColor) gl.uniform4f(u.uColor, s.color[0], s.color[1], s.color[2], width / Math.max(1, height));
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.depthCopyTex);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindFramebuffer(gl.FRAMEBUFFER, scene.fbo);
		gl.viewport(0, 0, width, height);
		gl.useProgram(this.raysCompProg.p);
		const uc = this.raysCompProg.u;
		if (uc.uColor) gl.uniform4f(uc.uColor, s.color[0], s.color[1], s.color[2], 0);
		gl.bindTexture(gl.TEXTURE_2D, this.raysTarget.tex);
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.ONE, gl.ONE, gl.ZERO, gl.ONE);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.disable(gl.BLEND);
		gl.bindVertexArray(null);
		this.drawsLast += 2;
	}
	/** Hidden-line ghosts — the mesh program with COLOUR WRITES OFF: the
	* model's surface fills depth invisibly so edges behind it vanish
	* (world3d.ts's ghost pipeline, one single-instance draw per part). */
	drawGhosts(frame) {
		const gl = this.gl;
		if (!this.meshProg.p) return;
		this.ghostParts = this.ghostParts.filter((gp) => !gp.shape.dead);
		if (!this.ghostParts.length) return;
		this.useProg(this.meshProg, frame);
		gl.colorMask(false, false, false, false);
		const inst = /* @__PURE__ */ new Float32Array(28);
		for (const gp of this.ghostParts) {
			if (!gp.vbuf) {
				gp.vbuf = gl.createBuffer();
				gl.bindBuffer(gl.ARRAY_BUFFER, gp.vbuf);
				gl.bufferData(gl.ARRAY_BUFFER, gp.verts, gl.STATIC_DRAW);
			}
			const sh = gp.shape;
			inst[0] = sh.x;
			inst[1] = sh.y;
			inst[2] = sh.z;
			inst[3] = sh.yaw;
			inst[4] = sh.scale;
			inst[5] = sh.scale;
			inst[6] = sh.scale;
			inst[7] = sh.pitch;
			inst[8] = 0;
			inst[9] = 0;
			inst[10] = 0;
			inst[11] = 1;
			inst[12] = sh.roll;
			inst[13] = 0;
			inst[14] = 1;
			inst[15] = 1;
			inst.fill(0, 16, 24);
			inst[24] = 0;
			inst[25] = 0;
			inst[26] = 1;
			inst[27] = 0;
			const vao = gl.createVertexArray();
			gl.bindVertexArray(vao);
			gl.bindBuffer(gl.ARRAY_BUFFER, gp.vbuf);
			gl.enableVertexAttribArray(0);
			gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 32, 0);
			gl.enableVertexAttribArray(1);
			gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 32, 12);
			gl.enableVertexAttribArray(2);
			gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 32, 24);
			const ib = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, ib);
			gl.bufferData(gl.ARRAY_BUFFER, inst, gl.STATIC_DRAW);
			instanceVec4Attribs(gl, 8, 7);
			this.bindTex(0, this.whiteTex);
			this.bindTex(1, this.flatNormalTex);
			this.bindTex(2, this.whiteTex);
			this.bindTex(4, this.envTex ?? this.whiteTex);
			gl.drawArrays(gl.TRIANGLES, 0, gp.vertCount);
			gl.bindVertexArray(null);
			gl.deleteVertexArray(vao);
			gl.deleteBuffer(ib);
			this.drawsLast++;
		}
		gl.colorMask(true, true, true, true);
	}
	/** Write + draw the sky — Sky3dLayer.write()'s packing logic verbatim,
	* uploaded as 12 vec4 uniforms (see buildGlSkyFragGLSL for the layout). */
	drawSky(width, height, aspect, basis) {
		const gl = this.gl;
		const sky = this.skyHandle;
		if (!sky || !this.skyProg.p) return;
		const s = this.skyStateNow ??= sky.tick(0);
		const cam = this.camera;
		const fw = {
			x: cam.tx - cam.x,
			y: cam.ty - cam.y,
			z: cam.tz - cam.z
		};
		const fl = Math.hypot(fw.x, fw.y, fw.z) || 1;
		const tanY = Math.tan(cam.fov * Math.PI / 360);
		const tanX = tanY * aspect;
		const storm = Math.min(1, Math.max(0, sky.storm));
		const coverage = sky.coverage + (.92 - sky.coverage) * storm;
		const density = Math.min(1, sky.density + .45 * storm);
		const cutoff = .72 - coverage * .5;
		const sunI = s.sunI * (1 - .65 * storm);
		const dayLum = .18 + sunI * .85;
		const darken = 1 - .55 * storm;
		const lit = [
			(.62 + s.sunColor[0] * .38) * dayLum * darken,
			(.62 + s.sunColor[1] * .38) * dayLum * darken,
			(.62 + s.sunColor[2] * .38) * dayLum * darken
		];
		const shade = [
			(s.zenith[0] * .5 + .1) * dayLum * darken,
			(s.zenith[1] * .5 + .11) * dayLum * darken,
			(s.zenith[2] * .5 + .13) * dayLum * darken
		];
		const d = this.skyData;
		d.set([
			fw.x / fl,
			fw.y / fl,
			fw.z / fl,
			tanX
		], 0);
		d.set([
			basis.right.x,
			basis.right.y,
			basis.right.z,
			tanY
		], 4);
		d.set([
			basis.up.x,
			basis.up.y,
			basis.up.z,
			this.time
		], 8);
		d.set([
			s.sunPos[0],
			s.sunPos[1],
			s.sunPos[2],
			sunI
		], 12);
		d.set([
			s.sunColor[0],
			s.sunColor[1],
			s.sunColor[2],
			sky.stars ? s.moon : 0
		], 16);
		d.set([
			s.zenith[0],
			s.zenith[1],
			s.zenith[2],
			sky.stars ? s.stars : 0
		], 20);
		d.set([
			s.horizon[0],
			s.horizon[1],
			s.horizon[2],
			cutoff
		], 24);
		d.set([
			s.glow[0],
			s.glow[1],
			s.glow[2],
			density
		], 28);
		d.set([
			lit[0],
			lit[1],
			lit[2],
			.85
		], 32);
		d.set([
			shade[0],
			shade[1],
			shade[2],
			.012 * sky.cloudSpeed
		], 36);
		d.set([
			sky.wind.x,
			sky.wind.z,
			sky.clouds ? 1 : 0,
			0
		], 40);
		d.set([
			s.fog[0],
			s.fog[1],
			s.fog[2],
			sky.starAngle
		], 44);
		gl.useProgram(this.skyProg.p);
		if (this.skyProg.u.uSky) gl.uniform4fv(this.skyProg.u.uSky, d);
		if (!this.skyVao) this.skyVao = gl.createVertexArray();
		gl.bindVertexArray(this.skyVao);
		gl.depthMask(false);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.depthMask(true);
		this.drawsLast++;
	}
	pushBlob(x, z, rx, rz, yaw, alpha) {
		if ((this.blobCount + 1) * 8 > this.blobData.length) {
			const grown = new Float32Array(this.blobData.length * 2);
			grown.set(this.blobData);
			this.blobData = grown;
		}
		const o = this.blobCount++ * 8;
		const d = this.blobData;
		const clearance = .02 + Math.max(rx, rz) * this.blobs.lift;
		d[o] = x;
		d[o + 1] = this.blobs.ground + clearance;
		d[o + 2] = z;
		d[o + 3] = rx;
		d[o + 4] = alpha;
		d[o + 5] = rz;
		d[o + 6] = yaw;
		d[o + 7] = 0;
	}
	/** Point the mesh/billboard/fx draws at the shared atlas texture. */
	setTexture(view) {
		this.atlasTex = view;
	}
	/** Upload a standalone image (model textures, terrain colormaps). Colour
	* sources upload as sRGB (the GL twin of uploadTexture's rgba8unorm-srgb);
	* normal/mr maps stay linear. Single level, LINEAR, clamped — matching the
	* WebGPU sampler (mips would sharpen minification but change the look). */
	uploadTex(src, srgb) {
		const gl = this.gl;
		const tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
		gl.texImage2D(gl.TEXTURE_2D, 0, srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, src);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return tex;
	}
	/** 1×1 solid-colour texture (the white + flat-normal stand-ins). */
	soloTex(r, g, b, a) {
		const gl = this.gl;
		const tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([
			r,
			g,
			b,
			a
		]));
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		return tex;
	}
	/** (Re)upload the joint-palette pool into its RGBA32F texture — 4 texels
	* per mat4, one mat4 per row (texelFetch by paletteBase + joint). */
	uploadPalettes() {
		const gl = this.gl;
		const rows = Math.max(1, this.palettesData.length / 16);
		if (!this.paletteTex || this.paletteTexRows !== rows) {
			if (this.paletteTex) gl.deleteTexture(this.paletteTex);
			this.paletteTex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, 4, rows, 0, gl.RGBA, gl.FLOAT, null);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			this.paletteTexRows = rows;
		} else gl.bindTexture(gl.TEXTURE_2D, this.paletteTex);
		gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, 4, this.palettesTop, gl.RGBA, gl.FLOAT, this.palettesData.subarray(0, this.palettesTop * 16));
	}
	makeProg(vs, fs, label, uniforms, samplers) {
		const gl = this.gl;
		const p = compileProgram(gl, vs, fs, label);
		const u = {};
		if (p) {
			for (const name of uniforms) u[name] = gl.getUniformLocation(p, name);
			gl.useProgram(p);
			for (const [name, unit] of Object.entries(samplers)) {
				const loc = gl.getUniformLocation(p, name);
				if (loc) gl.uniform1i(loc, unit);
			}
		}
		return {
			p,
			u,
			stamp: -1
		};
	}
	/** (Re)create every GL-side object — the context-restore recovery path.
	* CPU state (handles, packed arrays, texture sources) is the truth. */
	rebuild(gl) {
		this.gl = gl;
		const meshU = [
			"uViewProj",
			"uCamPos",
			"uFogColor",
			"uParams",
			"uLightDir",
			"uAmbSky",
			"uAmbGround",
			"uSunCol",
			"uLights",
			"uLightCount",
			"uEnvMips",
			"uShadowVP",
			"uShadow",
			"uUwC",
			"uUwC2"
		];
		this.meshProg = this.makeProg(buildGlMeshVertGLSL(false), buildGlMeshFragGLSL(), "GlWorld3d mesh", meshU, {
			uTex: 0,
			uNormTex: 1,
			uMrTex: 2,
			uEnv: 4,
			uShadowMap: 5,
			uCaustic: 6
		});
		this.skinProg = this.makeProg(buildGlMeshVertGLSL(true), buildGlMeshFragGLSL(), "GlWorld3d skinned mesh", meshU, {
			uTex: 0,
			uNormTex: 1,
			uMrTex: 2,
			uPalette: 3,
			uEnv: 4,
			uShadowMap: 5,
			uCaustic: 6
		});
		this.deformProg = this.makeProg(buildGlMeshVertGLSL(false, true), buildGlMeshFragGLSL(true), "GlWorld3d deform terrain", [...meshU, "uDU"], {
			uTex: 0,
			uNormTex: 1,
			uMrTex: 2,
			uEnv: 4,
			uShadowMap: 5,
			uCaustic: 6,
			uDeformTex: 7
		});
		this.beamProg = this.makeProg(buildGlBeamVertGLSL(), buildGlBeamFragGLSL(), "GlWorld3d beams", [
			"uViewProj",
			"uCamPos",
			"uLin"
		], { uDepth: 0 });
		this.pickProg = this.makeProg(buildGlPickVertGLSL(), buildGlPickFragGLSL(), "GlWorld3d pick", [
			"uViewProj",
			"uBase",
			"uOcclude"
		], {});
		for (const p of this.pendingPicks) p.resolve(null);
		this.pendingPicks.length = 0;
		this.pickFbo = null;
		this.pickTex = null;
		this.pickDepth = null;
		this.pickVao = null;
		this.pickW = 0;
		this.pickH = 0;
		for (const [, g] of this.geos) g.pickFlagsBuf = null;
		this.patchProg = this.makeProg(buildGlDeformPatchVertGLSL(), buildGlDeformPatchFragGLSL(), "GlWorld3d snow layer", [
			"uViewProj",
			"uCamPos",
			"uFogColor",
			"uParams",
			"uLightDir",
			"uAmbSky",
			"uAmbGround",
			"uSunCol",
			"uShadowVP",
			"uShadow",
			"uPU",
			"uEnvMips"
		], {
			uBase: 0,
			uDeform: 1,
			uColormap: 2,
			uEnv: 3,
			uShadowMap: 4
		});
		this.bbProg = this.makeProg(buildGlBillboardVertGLSL(), buildGlBillboardFragGLSL(), "GlWorld3d billboards", [
			"uViewProj",
			"uRight",
			"uUp",
			"uCamPos",
			"uFogColor",
			"uParams"
		], { uTex: 0 });
		this.blobProg = this.makeProg(buildGlBlobVertGLSL(), buildGlBlobFragGLSL(), "GlWorld3d blobs", ["uViewProj"], {});
		this.fxProg = this.makeProg(buildGlFxVertGLSL(), buildGlFxFragGLSL(), "GlWorld3d particles", [
			"uViewProj",
			"uRight",
			"uUp",
			"uCamPos",
			"uFogColor",
			"uParams",
			"uLights",
			"uLightCount"
		], { uTex: 0 });
		this.skyProg = this.makeProg(buildGlSkyVertGLSL(), buildGlSkyFragGLSL(), "GlWorld3d sky", ["uSky"], {});
		this.lineProg = this.makeProg(buildGlLine3dVertGLSL(), buildGlLine3dFragGLSL(), "GlWorld3d vector lines", ["uViewProj", "uScreen"], {});
		const trailU = [
			"uViewProj",
			"uCamPos",
			"uFogColor",
			"uParams",
			"uRight",
			"uUp",
			"uRowBase"
		];
		this.trailProgView = this.makeProg(buildGlTrailVertGLSL(false), buildGlTrailFragGLSL(), "GlWorld3d trails", trailU, {
			uTex: 0,
			uTrail: 1
		});
		this.trailProgUp = this.makeProg(buildGlTrailVertGLSL(true), buildGlTrailFragGLSL(), "GlWorld3d trail walls", trailU, {
			uTex: 0,
			uTrail: 1
		});
		this.wispProg = this.makeProg(buildGlWispVertGLSL(), buildGlWispFragGLSL(), "GlWorld3d wisps", [
			"uViewProj",
			"uCamPos",
			"uFogColor",
			"uParams"
		], { uTex: 0 });
		this.shadowProg = this.makeProg(buildGlShadowVertGLSL(false), buildGlShadowFragGLSL(), "GlWorld3d shadow", ["uViewProj"], {});
		this.shadowSkinProg = this.makeProg(buildGlShadowVertGLSL(true), buildGlShadowFragGLSL(), "GlWorld3d skinned shadow", ["uViewProj"], { uPalette: 0 });
		this.flareProg = this.makeProg(buildGlFlareVertGLSL(), buildGlFlareFragGLSL(), "GlWorld3d flare", [
			"uSun",
			"uScr",
			"uColor"
		], {});
		this.probeProg = this.makeProg(buildGlSunProbeVertGLSL(), buildGlSunProbeFragGLSL(), "GlWorld3d sun probe", ["uSunPos"], {});
		const fsVs = buildGlFullscreenVertGLSL();
		this.ssaoProg = this.makeProg(fsVs, buildGlSsaoFragGLSL(ssaoKernel()), "GlWorld3d ssao", [
			"uInvProj",
			"uProj",
			"uParams",
			"uDepthP"
		], { uDepth: 0 });
		this.ssaoBlurProg = this.makeProg(fsVs, buildGlSsaoBlurFragGLSL(), "GlWorld3d ssao blur", ["uTexel"], { uSrc: 0 });
		this.ssaoCompProg = this.makeProg(fsVs, buildGlSsaoCompositeFragGLSL(), "GlWorld3d ssao composite", [], { uSrc: 0 });
		this.raysProg = this.makeProg(fsVs, buildGlRaysFragGLSL(), "GlWorld3d rays", [
			"uSun",
			"uInfo",
			"uColor"
		], { uDepth: 0 });
		this.raysCompProg = this.makeProg(fsVs, buildGlRaysCompositeFragGLSL(), "GlWorld3d rays composite", ["uColor"], { uSrc: 0 });
		this.whiteTex = this.soloTex(255, 255, 255, 255);
		this.flatNormalTex = this.soloTex(128, 128, 255, 255);
		this.envTex = null;
		this.envDirty = true;
		this.atlasTex = null;
		this.paletteTex = null;
		this.paletteTexRows = 0;
		this.bbVao = null;
		this.blobVao = null;
		this.fxVao = null;
		this.skyVao = null;
		this.bbInst = new InstanceBuffer(gl);
		this.blobInst = new InstanceBuffer(gl);
		this.fxInst = new InstanceBuffer(gl);
		this.lineInst = new InstanceBuffer(gl);
		this.lineVao = null;
		this.trailTex = null;
		this.trailTexRows = 0;
		this.trailVao = null;
		this.wispInst = new InstanceBuffer(gl);
		this.wispVao = null;
		this.beamInst = new InstanceBuffer(gl);
		this.beamVao = null;
		this.shadowTex = null;
		this.shadowFbo = null;
		if (this.shadowOpts) this.ensureShadowTarget();
		this.shadowDummy = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.shadowDummy);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, 1, 1, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, new Uint32Array([4294967295]));
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_MODE, gl.COMPARE_REF_TO_TEXTURE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_COMPARE_FUNC, gl.LEQUAL);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
		this.fsVao = null;
		this.depthCopyTex = null;
		this.depthCopyFbo = null;
		this.depthCopyW = 0;
		this.depthCopyH = 0;
		this.ssaoTargets = null;
		this.raysTarget = null;
		this.flareQuery = null;
		this.flareQueryPending = false;
		for (const gp of this.ghostParts) gp.vbuf = null;
		this.voxelLayer?.rebuild(gl);
		this.waterLayer?.rebuild(gl);
		this.uwLayer?.rebuild(gl);
		for (const gf of this.grassFields) gf.grass.rebuild(gl);
		for (const rec of this.deformRecs) {
			rec.patchVao = null;
			this.ensureDeformGpu(rec);
		}
		for (const [, geo] of this.geos) {
			geo.vao = null;
			geo.inst = new InstanceBuffer(gl);
			geo.transInst = void 0;
			geo.basesBuf = null;
			geo.vbuf = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, geo.vbuf);
			if (geo.skinned && geo.rawVerts) gl.bufferData(gl.ARRAY_BUFFER, geo.rawVerts, gl.STATIC_DRAW);
			else gl.bufferData(gl.ARRAY_BUFFER, geo.verts, gl.STATIC_DRAW);
			geo.colorTex = geo.colorSrc ? this.uploadTex(geo.colorSrc, true) : null;
			geo.normalTex = geo.normalSrc ? this.uploadTex(geo.normalSrc, false) : null;
			geo.mrTex = geo.mrSrc ? this.uploadTex(geo.mrSrc, false) : null;
		}
		for (const t of this.terrainRecs) {
			t.tex = this.uploadTex(t.canvas, true);
			for (const key of t.keys) {
				const g = this.geos.get(key);
				if (g) g.colorTex = t.tex;
			}
		}
	}
	destroy() {
		this.unRebuild?.();
		this.unRebuild = null;
		this.rig?.detach();
	}
	/** Wrap a stub handle so ANY method the WebGPU surface has but the literal
	*  doesn't becomes a safe no-op — game code written against the full API
	*  must never crash on the fallback (`agents.clear()` was the first bite). */
	inertHandle(base) {
		const noop = () => void 0;
		return new Proxy(base, { get(target, prop, recv) {
			if (prop in target) return Reflect.get(target, prop, recv);
			if (typeof prop === "symbol") return void 0;
			return noop;
		} });
	}
	/**
	* WATER — real on the fallback: grid seas/lakes/pools (analytic Gerstner
	* in the VS with the exact CPU heightAt replica — the Water3d handle is
	* water3d.ts's, reused) and ribbon streams/waterfalls, with shore blend,
	* env fresnel, sun glint, foam, wells/wakes, swell/tide/tint dials. The
	* scene routes offscreen while any water lives (depth-copy shore reads).
	*/
	water(opts = {}) {
		this.waterLayer ??= new GlWaterLayer(this.gl);
		const w = new Water3d(opts);
		this.waters.push(w);
		return w;
	}
	/**
	* UNDERWATER — real on the fallback: submersion hysteresis + fog retarget
	* (CPU handle reused), the Beer–Lambert multiply + in-scatter composite,
	* the ABZU billboard shaft ring, and seabed caustic dapple in the mesh
	* shader — all over the scene depth copy (the seam). One per world.
	*/
	underwater(opts = {}) {
		this.uwLayer ??= new GlUnderwaterLayer(this.gl);
		const body = opts.water ?? this.waters.find((w) => w.kind === "grid") ?? null;
		this.underwater3d = new Underwater3d(opts, body);
		return this.underwater3d;
	}
	/**
	* VOXELS — the Minecraft-style block world, REAL on the fallback: the CPU
	* feature (grid, mesher + baked AO, DDA raycast, terrain gen, controllers)
	* is voxel3d.ts reused verbatim; the GL plumbing is webgl3d/voxels.ts
	* (2D-array tile pack + per-chunk VBOs drawn in the opaque pass). Lit and
	* fogged by THIS world's sun/sky. One per world.
	*/
	voxels(opts = {}) {
		if (!this.voxelLayer) this.voxelLayer = new GlVoxels3d(this.gl, this.camera, opts);
		return this.voxelLayer;
	}
	/** BLOCK EDITOR — voxeledit3d.ts reused verbatim (pure CPU: raycast,
	* outline + ghost via this world's lines()/box(), cadence, hardness). */
	voxelEditor(vox, opts = {}) {
		return new VoxelEditor(this, vox, opts);
	}
	/**
	* AGENTS — the steering/flocking movement system (agents3d.ts, pure CPU,
	* reused verbatim — lazy, one per world). Agents write their pose onto
	* retained render handles; debug gizmos draw through the vector-line layer.
	*/
	agents(opts = {}) {
		if (!this.agents3d) this.agents3d = new Agents3d(opts);
		return this.agents3d;
	}
	/** GPU-compute emitters run as a CAPPED CPU APPROXIMATION here: the shared
	* option vocabulary (cone/shell/box/ring spawn, life/size/ramp/fade/twinkle/
	* spin, accel+drag forces) maps onto an fx stream; the compute-only tier
	* (curl/vortex/attract/orbit forces, depth collision, wrap weather, velocity
	* stretch, flutter/tumble, 65k pools) is dropped and rates/bursts are capped
	* to a CPU budget — a campfire still burns, a blizzard becomes a flurry. */
	emitter(opts = {}) {
		this.warnOnce("GPU particle emitters (capped CPU approximation running)", "emitter");
		const collideRespawn = typeof opts.collide === "object" && !!opts.collide.respawn;
		if (opts.wrap && (collideRespawn || (opts.life ?? 0) > 60)) return this.makeWeatherEmitter(opts);
		const RATE_CAP = 400;
		const BURST_CAP = 800;
		const forces = () => {
			const accel = (opts.forces ?? []).find((f) => f.kind === "accel");
			const drag = (opts.forces ?? []).find((f) => f.kind === "drag");
			return {
				gravity: accel?.y !== void 0 ? -accel.y : void 0,
				drag: drag?.amount
			};
		};
		const handle = {
			x: opts.x ?? 0,
			y: opts.y ?? 0,
			z: opts.z ?? 0,
			rate: opts.rate ?? 0,
			opts,
			capacity: opts.capacity ?? 65536,
			alive: 0,
			dead: false,
			burst: (count) => {
				if (handle.dead) return;
				this.fx.emit({
					...mapOpts(),
					count: Math.min(count, BURST_CAP)
				});
			},
			kill: () => {
				handle.dead = true;
				stream.kill();
			}
		};
		const mapOpts = () => ({
			x: handle.x,
			y: handle.y,
			z: handle.z,
			dir: opts.radial ? void 0 : opts.dir,
			spread: opts.radial ? void 0 : opts.spread,
			speed: opts.speed,
			speedVar: opts.speedVar,
			spawnRadius: opts.spawnRadius,
			box: opts.box,
			ring: opts.ring,
			life: opts.life,
			lifeVar: opts.lifeVar,
			size: opts.size,
			sizeVar: opts.sizeVar,
			shrink: opts.shrink,
			fade: opts.fade !== false,
			ramp: opts.ramp,
			color: opts.color,
			colors: opts.colors,
			alpha: opts.alpha,
			twinkle: opts.twinkle,
			add: opts.add ?? true,
			soft: opts.soft,
			frame: opts.frame,
			spin: opts.spin,
			...forces()
		});
		const stream = this.fx.stream({
			...mapOpts(),
			rate: Math.min(handle.rate, RATE_CAP)
		});
		this.cpuEmitters.push({
			handle,
			stream,
			mapOpts
		});
		return handle;
	}
	/** Build one weather pool (see emitter()): ~4k drops spawned uniformly in
	* the wrap box around the LIVE emitter origin, integrated with the accel
	* force and torus-wrapped per axis (fallers re-enter at the top — the
	* depth-collision respawn approximation, no depth reads). */
	makeWeatherEmitter(opts) {
		const CAP = 4e3;
		const wrapDims = typeof opts.wrap === "object" ? opts.wrap : opts.box ?? {};
		const accelF = (opts.forces ?? []).find((f) => f.kind === "accel");
		const dl = Math.hypot(opts.dir?.x ?? 0, opts.dir?.y ?? -1, opts.dir?.z ?? 0) || 1;
		const palette = (opts.colors ?? [opts.color ?? "#ffffff"]).map((c) => rgba(c));
		const speed = opts.speed ?? 3;
		const handle = {
			x: opts.x ?? 0,
			y: opts.y ?? 0,
			z: opts.z ?? 0,
			rate: opts.rate ?? 0,
			opts,
			capacity: opts.capacity ?? 65536,
			alive: 0,
			dead: false,
			burst: (count) => {
				if (handle.dead) return;
				let add = Math.min(count, pool.cap - pool.count);
				while (add-- > 0) this.weatherSpawn(pool, pool.count++);
				handle.alive = pool.count;
			},
			kill: () => {
				handle.dead = true;
			}
		};
		const pool = {
			handle,
			pos: new Float32Array(CAP * 3),
			vel: new Float32Array(CAP * 3),
			seeds: new Float32Array(CAP),
			count: 0,
			cap: CAP,
			hw: (wrapDims.w ?? 60) / 2,
			hh: (wrapDims.h ?? 30) / 2,
			hd: (wrapDims.d ?? 60) / 2,
			dir: [
				(opts.dir?.x ?? 0) / dl,
				(opts.dir?.y ?? -1) / dl,
				(opts.dir?.z ?? 0) / dl
			],
			speed,
			speedVar: opts.speedVar ?? speed * .4,
			accel: [
				accelF?.x ?? 0,
				accelF?.y ?? 0,
				accelF?.z ?? 0
			],
			size: opts.size ?? .12,
			sizeVar: opts.sizeVar ?? 0,
			colors: palette,
			alpha: opts.alpha ?? 1,
			add: opts.add ?? true,
			soft: opts.soft ?? 0
		};
		this.weatherPools.push(pool);
		return handle;
	}
	/** (Re)seed one drop uniformly in the wrap box around the live origin. */
	weatherSpawn(p, i) {
		const h = p.handle;
		const o = i * 3;
		p.pos[o] = h.x + (Math.random() - .5) * 2 * p.hw;
		p.pos[o + 1] = h.y + (Math.random() - .5) * 2 * p.hh;
		p.pos[o + 2] = h.z + (Math.random() - .5) * 2 * p.hd;
		const s = p.speed + (Math.random() - .5) * 2 * p.speedVar;
		p.vel[o] = p.dir[0] * s;
		p.vel[o + 1] = p.dir[1] * s;
		p.vel[o + 2] = p.dir[2] * s;
		p.seeds[i] = Math.random();
	}
	/**
	* Add a WISP — steam/smoke as a true-3D twisting ribbon (WISP_WGSL ported;
	* Bruno Simon's coffee-smoke technique). Pass a TILEABLE grayscale noise
	* frame. Anchored at its BASE (stands on x/y/z). All fields live.
	*/
	wisp(config) {
		const w = new Wisp3d(config);
		this.wisps.push(w);
		return w;
	}
	/**
	* Add a TRAIL — a VfxDef ribbon in TRUE 3D (World3d.trail, GL-side): a
	* Catmull-Rom-smoothed, view-facing ribbon with noise flutter, a white-hot
	* core and a tail that erodes into wisps. Feed `point(x, y, z)` per frame
	* or pass `follow`; `release()` fades it out. Width defaults to the
	* followed handle's own size, else a tenth of the def's 2D width.
	*/
	trail(vfx, opts = {}) {
		let frame = opts.noiseFrame;
		if (frame == null) {
			if (this.trailNoise < 0) this.trailNoise = this.atlas.add(noiseCanvas({
				size: 256,
				cell: 24,
				octaves: 4,
				seed: 11
			}));
			frame = this.trailNoise;
		}
		let width = opts.width;
		if (width == null && opts.follow) {
			const f = opts.follow;
			const dims = [
				f.w,
				f.h,
				f.d
			].filter((v) => typeof v === "number");
			if (dims.length) width = dims.reduce((a, b) => a + b, 0) / dims.length;
		}
		const t = new Trail3d(resolveVfx(vfx), frame, {
			...opts,
			width
		}, this.trailSeed++ % 16 / 16);
		t.fx = this.fx;
		this.trails.push(t);
		return t;
	}
	/** Retained 3D line shapes — World3d.lines, over the shared VectorShape3d. */
	lines(polylines, opts = {}) {
		const shape = new VectorShape3d(polylinesToSegs(polylines, opts.closed), opts);
		this.vecShapes.push(shape);
		return shape;
	}
	/** Wireframe edge extraction — the shared pure extractor (vector3d.ts). */
	wireframeEdges(verts, angle = 20) {
		return wireframeEdges(verts, angle);
	}
	/** Wireframe model loading — World3d.loadWireframe over the shared
	* model-data cache (verts arrive unit-fitted), incl. the sparse-crease
	* fallback and hidden-line ghosts. */
	async loadWireframe(url, opts = {}) {
		const md = await loadModelData(url);
		const groups = md.kind === "glb" ? md.data.primitives.map((pr) => pr.verts) : md.data.groups.map((g) => g.verts);
		const segs = [];
		let tris = 0;
		for (const g of groups) {
			tris += g.length / 24;
			segs.push(...wireframeEdges(g, opts.angle ?? 20));
		}
		if (opts.angle == null && segs.length < tris * .3) {
			segs.length = 0;
			for (const g of groups) segs.push(...wireframeEdges(g, 0));
		}
		const shape = new VectorShape3d(segs, opts);
		this.vecShapes.push(shape);
		if (opts.hiddenLine) for (const g of groups) this.ghostParts.push({
			vbuf: null,
			vertCount: g.length / 8 | 0,
			verts: g,
			shape
		});
		return shape;
	}
	/**
	* Directional SHADOWS for the world's sun — real on the fallback: a
	* depth-only ortho pass into a compare-mode depth texture (`size` =
	* half-extent around the camera target; the map follows it), PCF-sampled
	* in the mesh fragment. Turning it on swaps the blob ellipses for the
	* real map (world3d's exclusivity); `shadows(false)` restores them.
	*/
	shadows(on = true) {
		const gl = this.gl;
		if (on === false) {
			this.shadowOpts = null;
			if (this.shadowTex) {
				gl.deleteTexture(this.shadowTex);
				this.shadowTex = null;
			}
			if (this.shadowFbo) {
				gl.deleteFramebuffer(this.shadowFbo);
				this.shadowFbo = null;
			}
			this.blobs.enabled = true;
			return;
		}
		const o = on === true ? {} : on;
		this.blobs.enabled = false;
		this.shadowOpts = {
			size: o.size ?? 30,
			res: o.res ?? 2048,
			bias: o.bias ?? 3e-4
		};
		this.ensureShadowTarget();
	}
	/**
	* LENS FLARE on the sun — the procedural ghost chain (flare3d.ts ported),
	* occluded by an async occlusion-query probe instead of the WebGPU depth
	* taps. ON automatically when a sky is attached (`sky({ flare: false })`
	* opts out); call this to force it either way.
	*/
	flare(on = true) {
		this.flareOn = on;
	}
	/** Enable/disable SSAO (world.ssao forwards here). Requires the offscreen
	* scene route — needsDepthTexture flips the renderer's seam on. */
	setSsao(on) {
		if (on === false) {
			this.ssaoEnabled = false;
			return;
		}
		this.ssaoEnabled = true;
		if (typeof on === "object") Object.assign(this.ssaoOpts, on);
	}
	/** Enable/disable god rays (world.rays forwards here). */
	setRays(on) {
		if (on === false) {
			this.raysEnabled = false;
			return;
		}
		this.raysEnabled = true;
		if (typeof on === "object") Object.assign(this.raysOpts, on);
	}
	/** True while a depth-consuming feature is live — the renderer then routes
	* the whole scene through the offscreen FBO (webgl/renderer.ts seam).
	* TODO(renderer): renderFrame currently only lands the offscreen frame on
	* the canvas via the post chain — the offscreen-without-post path needs an
	* `else if (offscreen) this.postChain.blitToCanvas()` after the post
	* branch, or SSAO/rays frames never reach the canvas. */
	get needsDepthTexture() {
		return this.ssaoEnabled || this.raysEnabled || this.waters.some((w) => !w.dead) || this.underwater3d != null && !this.underwater3d.dead || this.beams.some((b) => !b.light.dead);
	}
	/** @internal This frame's projection + linearisation terms (SSAO shape —
	* World3d.projInfo, verbatim). */
	get projInfo() {
		if (!this.curProj) return null;
		return {
			proj: this.curProj,
			projA: this.curFar / (this.curNear - this.curFar),
			projB: this.curNear * this.curFar / (this.curNear - this.curFar)
		};
	}
	/** Env/IBL reflections are WebGPU-only on the fallback. */
	/** Environment reflections — the world3d.ts verb: `false` off, a strength
	* retune, a panorama url, or a canvas. The procedural sky is the default. */
	async env(src = true) {
		if (src === false) {
			this.envStrength = 0;
			return;
		}
		if (typeof src === "object" && typeof HTMLCanvasElement !== "undefined" && !(src instanceof HTMLCanvasElement)) {
			if (src.strength != null) this.envStrength = src.strength;
			return;
		}
		if (typeof src === "string") {
			const img = await loadImage(src);
			if (img) {
				this.envSource = img;
				this.envCustom = true;
				this.envDirty = true;
			}
			return;
		}
		if (typeof HTMLCanvasElement !== "undefined" && src instanceof HTMLCanvasElement) {
			this.envSource = src;
			this.envCustom = true;
			this.envDirty = true;
		}
	}
	/** Bake the procedural equirect sky — world3d.ts's bakeProceduralEnv verbatim. */
	bakeProceduralEnv() {
		const W = 256, H = 128;
		const c = document.createElement("canvas");
		c.width = W;
		c.height = H;
		const g = c.getContext("2d");
		const sky = this.sun.sky === "#ffffff" ? "#a8bce0" : this.sun.sky;
		const gnd = this.sun.ground === "#ffffff" ? "#5a5248" : this.sun.ground;
		const c1 = rgba(sky), c2 = rgba(gnd);
		const css = (cc, k, lift = 0) => `rgb(${Math.min(255, cc[0] * 255 * k + lift)},${Math.min(255, cc[1] * 255 * k + lift)},${Math.min(255, cc[2] * 255 * k + lift)})`;
		const grad = g.createLinearGradient(0, 0, 0, H);
		grad.addColorStop(0, css(c1, .45));
		grad.addColorStop(.34, css(c1, .9));
		grad.addColorStop(.485, css(c1, 1.05, 90));
		grad.addColorStop(.5, css(c1, 1, 120));
		grad.addColorStop(.505, css(c2, .9));
		grad.addColorStop(.7, css(c2, .55));
		grad.addColorStop(1, css(c2, .3));
		g.fillStyle = grad;
		g.fillRect(0, 0, W, H);
		const l = Math.hypot(this.sun.x, this.sun.y, this.sun.z) || 1;
		const sx = -this.sun.x / l, sy = -this.sun.y / l, sz = -this.sun.z / l;
		const su = (Math.atan2(sx, sz) / (Math.PI * 2) + .5) * W;
		const sv = (.5 - Math.asin(Math.max(-1, Math.min(1, sy))) / Math.PI) * H;
		const rg = g.createRadialGradient(su, sv, 1, su, sv, 22);
		rg.addColorStop(0, "rgba(255,252,240,1)");
		rg.addColorStop(.12, "rgba(255,248,225,1)");
		rg.addColorStop(.4, "rgba(255,238,190,0.55)");
		rg.addColorStop(1, "rgba(255,238,190,0)");
		g.fillStyle = rg;
		g.fillRect(0, 0, W, H);
		return c;
	}
	/** (Re)upload the env with a FULL CPU-downsampled mip chain (world3d.ts's
	* uploadEnv recipe — rough reflections sample deep mips; the tail is the
	* sky average). SRGB storage matches the WebGPU rgba8unorm-srgb. */
	uploadEnv() {
		const gl = this.gl;
		const src = this.envCustom && this.envSource ? this.envSource : this.bakeProceduralEnv();
		if (!this.envCustom) {
			this.envSource = src;
			const l = Math.hypot(this.sun.x, this.sun.y, this.sun.z) || 1;
			this.envSunX = this.sun.x / l;
			this.envSunY = this.sun.y / l;
			this.envSunZ = this.sun.z / l;
		}
		const w = Math.max(2, src.width), h = Math.max(1, src.height);
		const mips = 1 + Math.floor(Math.log2(Math.max(w, h)));
		if (this.envTex) gl.deleteTexture(this.envTex);
		this.envTex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.envTex);
		gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		let level = document.createElement("canvas");
		level.width = w;
		level.height = h;
		level.getContext("2d").drawImage(src, 0, 0, w, h);
		for (let m = 0; m < mips; m++) {
			gl.texImage2D(gl.TEXTURE_2D, m, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, level);
			if (m + 1 < mips) {
				const next = document.createElement("canvas");
				next.width = Math.max(1, level.width >> 1);
				next.height = Math.max(1, level.height >> 1);
				next.getContext("2d").drawImage(level, 0, 0, next.width, next.height);
				level = next;
			}
		}
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAX_LEVEL, mips - 1);
		this.envMips = mips;
		this.envDirty = false;
	}
	/** The sun's screen position + faded intensity this frame (null when
	* behind the camera or fully faded) — World3d.sunScreen. */
	get sunScreen() {
		return this.sunScreenCache;
	}
	/** @internal WebGPU-only frame hook — no-op on GL (surface parity). */
	afterSubmit() {}
};
/** Local-geometry AABB of a stride-8 soup (unit space) → the obb bounds CPU
* picking feeds rayObbLocal (tight for off-centre / flat geometry). */
function geoBounds(verts) {
	const n = Math.floor(verts.length / 8);
	if (!n) return null;
	let minX = Infinity, minY = Infinity, minZ = Infinity;
	let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
	for (let v = 0; v < n; v++) {
		const o = v * 8;
		const x = verts[o], y = verts[o + 1], z = verts[o + 2];
		if (x < minX) minX = x;
		if (x > maxX) maxX = x;
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
		if (z < minZ) minZ = z;
		if (z > maxZ) maxZ = z;
	}
	return {
		cx: (minX + maxX) / 2,
		cy: (minY + maxY) / 2,
		cz: (minZ + maxZ) / 2,
		hx: (maxX - minX) / 2,
		hy: (maxY - minY) / 2,
		hz: (maxZ - minZ) / 2
	};
}
//#endregion
export { BB_FLOATS, BEAM_INST_FLOATS, BEAM_SEGS, BEAM_VERTS, BLOB_FLOATS, Billboard3d, BlobShadow3d, Box3d, FLARE_ELEMS, FX_FLOATS, GL_MAX_LIGHTS3D, GRASS_BLADE_FLOATS, GRASS_BLADE_VERTS, GRASS_SEG, GlGrass3d, GlUnderwaterLayer, GlVoxels3d, GlWaterLayer, GlWorld3d, Group3d, MESH_FLOATS, Mesh3d, TRAIL_FLOATS, TRAIL_PTS, TRAIL_SEGS, TRAIL_TEXELS, Trail3d, WISP_FLOATS, WISP_SEGX, WISP_SEGY, Wisp3d, blobParams, buildGlBeamFragGLSL, buildGlBeamVertGLSL, buildGlBillboardFragGLSL, buildGlBillboardVertGLSL, buildGlBlobFragGLSL, buildGlBlobVertGLSL, buildGlDeformPatchFragGLSL, buildGlDeformPatchVertGLSL, buildGlFlareFragGLSL, buildGlFlareVertGLSL, buildGlFoamDecayFragGLSL, buildGlFoamStampFragGLSL, buildGlFoamStampVertGLSL, buildGlFullscreenVertGLSL, buildGlFxFragGLSL, buildGlFxVertGLSL, buildGlGrassCardFragGLSL, buildGlGrassCardVertGLSL, buildGlGrassFragGLSL, buildGlGrassVertGLSL, buildGlLine3dFragGLSL, buildGlLine3dVertGLSL, buildGlMeshFragGLSL, buildGlMeshVertGLSL, buildGlPickFragGLSL, buildGlPickVertGLSL, buildGlRaysCompositeFragGLSL, buildGlRaysFragGLSL, buildGlShadowFragGLSL, buildGlShadowVertGLSL, buildGlShaftFragGLSL, buildGlShaftVertGLSL, buildGlSkyFragGLSL, buildGlSkyVertGLSL, buildGlSsaoBlurFragGLSL, buildGlSsaoCompositeFragGLSL, buildGlSsaoFragGLSL, buildGlSunProbeFragGLSL, buildGlSunProbeVertGLSL, buildGlTrailFragGLSL, buildGlTrailVertGLSL, buildGlUnderwaterAddFragGLSL, buildGlUnderwaterMulFragGLSL, buildGlVoxelFragGLSL, buildGlVoxelVertGLSL, buildGlWaterFragGLSL, buildGlWaterVertGLSL, buildGlWispFragGLSL, buildGlWispVertGLSL, loadModelData, resampleTrail };

//# sourceMappingURL=webgl3d-core.js.map
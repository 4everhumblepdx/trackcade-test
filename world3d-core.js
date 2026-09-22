import { n as rgba, r as DEPTH_FORMAT, s as BITS, u as shaderModule } from "./shared-DhV4JtEZ.js";
import { $ as loadText, A as sphereVsFrustum, C as mat4Perspective, F as forward, I as lookAtEuler, M as viewBasis, N as composeChain, O as rayPlaneY, S as mat4Ortho, T as rayFromNdc, Y as loadBinary, Z as loadImage, b as mat4LookAt, it as resolveRamp, o as noiseCanvas, ut as resolveVfx, v as frustumPlanes, w as mat4Project, x as mat4Mul, y as mat4Inverse } from "./shared-DjLuB-Ve.js";
import { _ as sphereVerts, a as cubeVerts, b as tubeVerts, d as panelVerts, f as planeVerts, g as shapeVerts, h as roundedBoxVerts, i as coneVerts, l as extrudeVerts, m as ringVerts, n as capsuleVerts, o as cylinderVerts, p as polyhedronVerts, r as circleVerts, s as discVerts, u as latheVerts, v as torusKnotVerts, x as wedgeVerts, y as torusVerts } from "./shared-BKm0BaVz.js";
import { $ as gerstnerY, A as BLOCKS, At as deformPatchVerts, B as halveRGBA, Bt as AnimatedModel3d, C as absorb, Ct as DeformMap, D as VoxelEditor, Dt as bakeColormapPixels, E as underwaterFog, Et as Terrain3d, F as VoxelBody, Ft as VectorShape3d, G as RIPPLE_TILE, Gt as parseGlb, H as raycastVoxel, Ht as cpuSkin, I as VoxelWorld, It as buildLine3dWGSL, J as Water3d, Jt as Particles3d, K as WATER_PRESETS, Kt as parseMtl, L as Voxels3d, Lt as polylinesToSegs, M as TILES, Mt as pickChunks, N as VOX_FLOATS, Nt as LINE3D_FLOATS, O as AO_LEVELS, Ot as bakeGrainField, P as VoxelAgent, Pt as Vector3dLayer, Q as gerstnerXZ, R as bakeTiles, Rt as wireframeEdges, S as Underwater3dLayer, St as zSlice, T as submersionState, Tt as TERRAIN_SURFACES, U as vertexAO, Ut as fitVerts, V as meshChunk, Vt as Model3d, W as voxelTerrain, Wt as rgbHex, X as WaterWell, Xt as OrbitRig, Y as Water3dLayer, Yt as SurfaceSampler, Z as bakeRippleField, Zt as scaleAboutPoint, _ as NavMesh3d, _t as binLightsCpu, a as ssaoKernel, at as constellationDirs, b as UNDERWATER_PRESETS, bt as froxelBounds, c as Agents3d, ct as CLUSTER_X, d as SpatialHash3, dt as LIGHT_FLOATS, et as ribbonVerts, f as dampAngle, ft as LU_FLOATS, g as Crowd3d, gt as MAX_PER_CLUSTER, h as writePose, ht as MAX_LIGHTS, i as buildSsaoWGSL, it as Sky3dLayer, j as FACES, jt as hash2, k as BLOCK, kt as chunkVerts, l as Field3d, lt as CLUSTER_Y, m as neighborsBrute, mt as Lights3d, n as buildSsaoBlurWGSL, nt as steepNorm, o as AGENT_PRESETS, ot as skyState, p as integrateAgent, pt as Light3d, q as WATER_TINTS, qt as parseObj, r as buildSsaoCompositeWGSL, rt as Sky3d, s as Agent3d, st as CLUSTER_COUNT, t as SsaoPass, tt as rippleFbm, u as Obstacle3d, ut as CLUSTER_Z, v as buildNavMesh, vt as buildClusterWGSL, w as bakeCausticField, wt as Heightfield, x as Underwater3d, xt as selectLights, y as terrainMesh, yt as clusterNear, z as faceTile, zt as loadModelData } from "./shared-D9JZoPnb.js";
//#region src/lib/particles-gpu.ts
var MAX_GPU_FORCES = 8;
var FORCE_KIND = {
	accel: 1,
	drag: 2,
	curl: 3,
	attract: 4,
	vortex: 5,
	orbit: 6
};
/** Pack a force list into the uniform's 8×2-vec4 layout (pure, dist-tested). */
function packForces(forces) {
	const out = /* @__PURE__ */ new Float32Array(64);
	forces.slice(0, 8).forEach((f, i) => {
		const o = i * 8;
		out[o] = FORCE_KIND[f.kind];
		switch (f.kind) {
			case "accel":
				out[o + 1] = f.x ?? 0;
				out[o + 2] = f.y ?? 0;
				out[o + 3] = f.z ?? 0;
				break;
			case "drag":
				out[o + 4] = f.amount ?? 1;
				break;
			case "curl":
				out[o + 4] = f.strength ?? 4;
				out[o + 5] = f.scale ?? .35;
				out[o + 6] = f.speed ?? .4;
				break;
			case "attract":
				out[o + 1] = f.x ?? 0;
				out[o + 2] = f.y ?? 0;
				out[o + 3] = f.z ?? 0;
				out[o + 4] = f.strength ?? 6;
				out[o + 5] = Math.max(.01, f.radius ?? 3);
				break;
			case "vortex": {
				out[o + 1] = f.x ?? 0;
				out[o + 2] = f.y ?? 0;
				out[o + 3] = f.z ?? 0;
				const l = Math.hypot(f.ax ?? 0, f.ay ?? 0, f.az ?? 0);
				out[o + 4] = f.strength ?? 6;
				if (l > 0) {
					out[o + 5] = (f.ax ?? 0) / l;
					out[o + 6] = (f.ay ?? 0) / l;
					out[o + 7] = (f.az ?? 0) / l;
				} else {
					out[o + 5] = 0;
					out[o + 6] = 1;
					out[o + 7] = 0;
				}
				break;
			}
			case "orbit":
				out[o + 1] = f.x ?? 0;
				out[o + 2] = f.y ?? 0;
				out[o + 3] = f.z ?? 0;
				out[o + 4] = f.strength ?? 4;
				out[o + 5] = f.radius ?? 4;
				out[o + 6] = f.spring ?? 2;
				break;
		}
	});
	return out;
}
/** PCG hash (u32 in, u32 out) — the kernel's randomness source. */
function pcg(v) {
	const state = Math.imul(v >>> 0, 747796405) + 2891336453 >>> 0;
	const word = Math.imul(state >>> ((state >>> 28) + 4 & 31) ^ state, 277803737) >>> 0;
	return (word >>> 22 ^ word) >>> 0;
}
/** u32 hash → [0, 1). */
function rand01(h) {
	return (h >>> 0) / 4294967296;
}
function latticeHash(x, y, z, seed) {
	return pcg((Math.imul(x | 0, 1597334677) ^ Math.imul(y | 0, 3812015801) ^ Math.imul(z | 0, 2798796415) ^ seed >>> 0) >>> 0);
}
/** 3D value noise on an integer lattice, trilinear smoothstep — [0, 1). */
function vnoise3(x, y, z, seed) {
	const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z);
	const fx = x - ix, fy = y - iy, fz = z - iz;
	const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
	const c = (dx, dy, dz) => rand01(latticeHash(ix + dx, iy + dy, iz + dz, seed));
	const x00 = c(0, 0, 0) + (c(1, 0, 0) - c(0, 0, 0)) * ux;
	const x10 = c(0, 1, 0) + (c(1, 1, 0) - c(0, 1, 0)) * ux;
	const x01 = c(0, 0, 1) + (c(1, 0, 1) - c(0, 0, 1)) * ux;
	const x11 = c(0, 1, 1) + (c(1, 1, 1) - c(0, 1, 1)) * ux;
	const y0 = x00 + (x10 - x00) * uy;
	return y0 + (x01 + (x11 - x01) * uy - y0) * uz;
}
var CURL_E = .25;
/** Curl of a hash-noise potential field — divergence-free by construction
* (∇·(∇×ψ) = 0), which is WHY curl flow swirls instead of clumping: the
* dist test asserts numerical divergence ≈ 0. */
function curl3(x, y, z, seed) {
	const e = CURL_E, k = 1 / (2 * e);
	const px = (xx, yy, zz) => vnoise3(xx, yy, zz, seed + 11);
	const py = (xx, yy, zz) => vnoise3(xx, yy, zz, seed + 37);
	const pz = (xx, yy, zz) => vnoise3(xx, yy, zz, seed + 71);
	return [
		(pz(x, y + e, z) - pz(x, y - e, z)) * k - (py(x, y, z + e) - py(x, y, z - e)) * k,
		(px(x, y, z + e) - px(x, y, z - e)) * k - (pz(x + e, y, z) - pz(x - e, y, z)) * k,
		(py(x + e, y, z) - py(x - e, y, z)) * k - (px(x, y + e, z) - px(x, y - e, z)) * k
	];
}
/** CPU twin of the kernel's WRAP fold: map `v` into the extent-`e` box
* centred on `c`, torus-style (e <= 0 = unwrapped). Runs per axis; the
* kernel applies it AFTER the integration step. */
function wrap1(v, c, e) {
	if (e <= 0) return v;
	const rel = v - c + e / 2;
	return c + ((rel / e - Math.floor(rel / e)) * e - e / 2);
}
/** Is pool slot `i` inside this frame's spawn ring window [s0, s0+n) mod cap? */
function inSpawnWindow(i, spawn0, n, capacity) {
	if (n <= 0) return false;
	return (i - spawn0 + capacity) % capacity < n;
}
/** CPU twin of the kernel's spawn init: particle `i` under frame-seed `seed`.
* Deterministic — same (i, seed) always births the same particle. */
function spawnGpuParticle(i, seed, s) {
	const h0 = pcg(i >>> 0 ^ pcg(seed));
	const r = (n) => rand01(pcg(h0 + n >>> 0));
	const dl = Math.hypot(s.dirX, s.dirY, s.dirZ);
	const directional = dl > 1e-6 && s.spread < Math.PI * 2 - 1e-6;
	let nx, ny, nz;
	if (directional) {
		const ax = s.dirX / dl, ay = s.dirY / dl, az = s.dirZ / dl;
		const ux = Math.abs(ax) < .9 ? 1 : 0;
		const uy = ux ? 0 : 1;
		let bx = -az * uy, by = az * ux, bz = ax * uy - ay * ux;
		const bl = Math.hypot(bx, by, bz) || 1;
		bx /= bl;
		by /= bl;
		bz /= bl;
		const cx = ay * bz - az * by, cy = az * bx - ax * bz, cz = ax * by - ay * bx;
		const cosT = 1 - r(1) * (1 - Math.cos(s.spread / 2));
		const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
		const phi = r(2) * Math.PI * 2;
		const pb = Math.cos(phi) * sinT, pc = Math.sin(phi) * sinT;
		nx = ax * cosT + bx * pb + cx * pc;
		ny = ay * cosT + by * pb + cy * pc;
		nz = az * cosT + bz * pb + cz * pc;
	} else {
		const zz = r(1) * 2 - 1;
		const phi = r(2) * Math.PI * 2;
		const sq = Math.sqrt(Math.max(0, 1 - zz * zz));
		nx = Math.cos(phi) * sq;
		ny = zz;
		nz = Math.sin(phi) * sq;
	}
	const v = Math.max(0, s.speed + (r(3) - .5) * 2 * s.speedVar);
	let x = s.x, y = s.y, z = s.z;
	if (s.ring > 0) {
		const ra = r(8) * Math.PI * 2;
		x += Math.cos(ra) * s.ring;
		z += Math.sin(ra) * s.ring;
	}
	x += (r(9) - .5) * s.boxW;
	y += (r(10) - .5) * s.boxH;
	z += (r(11) - .5) * s.boxD;
	if (s.spawnRadius > 0) {
		const zz = r(12) * 2 - 1;
		const phi = r(13) * Math.PI * 2;
		const sq = Math.sqrt(Math.max(0, 1 - zz * zz));
		const rr = Math.cbrt(r(14)) * s.spawnRadius;
		x += Math.cos(phi) * sq * rr;
		y += zz * rr;
		z += Math.sin(phi) * sq * rr;
	}
	if (s.spread < 0) {
		const rx = x - s.x, ry = y - s.y, rz = z - s.z;
		const rl = Math.hypot(rx, ry, rz);
		if (rl > 1e-5) {
			nx = rx / rl;
			ny = ry / rl;
			nz = rz / rl;
		}
	}
	return {
		x,
		y,
		z,
		age: 0,
		vx: nx * v,
		vy: ny * v,
		vz: nz * v,
		life: Math.max(.05, s.life + (r(4) - .5) * 2 * s.lifeVar),
		size: Math.max(.001, s.size + (r(5) - .5) * 2 * s.sizeVar),
		spin: (r(6) - .5) * 2 * s.spin,
		seed: r(7)
	};
}
/** CPU twin of the kernel's integration step (no collision — that needs a
* depth buffer). Mutates and returns `p`. `flutter`/`flutterFreq` mirror
* the emitter options (the falling-leaf rock). */
function stepGpuParticle(p, forces, forceCount, dt, time, flutter = 0, flutterFreq = .7) {
	p.age += dt;
	if (p.age >= p.life) return p;
	let ax = 0, ay = 0, az = 0, drag = 0;
	for (let fi = 0; fi < forceCount; fi++) {
		const o = fi * 8;
		const kind = forces[o] | 0;
		if (kind === 1) {
			ax += forces[o + 1];
			ay += forces[o + 2];
			az += forces[o + 3];
		} else if (kind === 2) drag += forces[o + 4];
		else if (kind === 3) {
			const st = forces[o + 4], sc = forces[o + 5];
			const t = time * forces[o + 6];
			const c = curl3(p.x * sc + t, p.y * sc + t * .87, p.z * sc + t * 1.13, 7);
			ax += c[0] * st;
			ay += c[1] * st;
			az += c[2] * st;
		} else if (kind === 4) {
			const dx = forces[o + 1] - p.x, dy = forces[o + 2] - p.y, dz = forces[o + 3] - p.z;
			const rr = Math.hypot(dx, dy, dz);
			const rad = forces[o + 5];
			const k = forces[o + 4] / Math.max(1e-4, rr) * (rad * rad) / (rad * rad + rr * rr);
			ax += dx * k;
			ay += dy * k;
			az += dz * k;
		} else if (kind === 5) {
			const rx = p.x - forces[o + 1], ry = p.y - forces[o + 2], rz = p.z - forces[o + 3];
			const axx = forces[o + 5], axy = forces[o + 6], axz = forces[o + 7];
			const d = rx * axx + ry * axy + rz * axz;
			const px = rx - axx * d, py = ry - axy * d, pz = rz - axz * d;
			const rr = Math.hypot(px, py, pz);
			const tx = axy * pz - axz * py, ty = axz * px - axx * pz, tz = axx * py - axy * px;
			const tl = Math.hypot(tx, ty, tz) || 1;
			const st = forces[o + 4];
			const k = st * rr / (1 + rr * rr);
			ax += tx / tl * k - px / Math.max(1e-4, rr) * st * .15;
			ay += ty / tl * k - py / Math.max(1e-4, rr) * st * .15;
			az += tz / tl * k - pz / Math.max(1e-4, rr) * st * .15;
		} else if (kind === 6) {
			const rx = p.x - forces[o + 1], rz = p.z - forces[o + 3];
			const rr = Math.hypot(rx, rz) || 1e-4;
			const st = forces[o + 4], rad = forces[o + 5], spring = forces[o + 6];
			ax += -rz / rr * st + rx / rr * (rad - rr) * spring;
			az += rx / rr * st + rz / rr * (rad - rr) * spring;
			ay += (forces[o + 2] - p.y) * spring * .5;
		}
	}
	if (flutter > 0) {
		const ph = p.seed * Math.PI * 2;
		const sway = Math.sin((time + p.seed * 3.7) * flutterFreq * Math.PI * 2 + ph);
		ax += Math.cos(ph) * sway * flutter;
		az += Math.sin(ph) * sway * flutter;
	}
	p.vx += ax * dt;
	p.vy += ay * dt;
	p.vz += az * dt;
	const damp = drag > 0 ? Math.max(0, 1 - drag * dt) : 1;
	p.vx *= damp;
	p.vy *= damp;
	p.vz *= damp;
	p.x += p.vx * dt;
	p.y += p.vy * dt;
	p.z += p.vz * dt;
	return p;
}
var P_FLOATS = 12;
var O = {
	spawn: 0,
	origin: 4,
	dir: 8,
	box: 12,
	motion: 16,
	shape: 20,
	look: 24,
	look2: 28,
	uv: 32,
	hit: 36,
	softp: 40,
	screen: 44,
	flut: 48,
	wrapv: 52,
	forces: 56,
	prevVP: 120,
	prevInv: 136,
	ramp: 152
};
var EU_TOTAL = 184;
var COMMON_WGSL = `
struct EU {
  spawn: vec4f,     // spawn0, spawnN, seed, dt
  origin: vec4f,    // x, y, z, spawnRadius
  dir: vec4f,       // dir xyz (zero = omni), spread
  box: vec4f,       // box w/h/d, ring radius
  motion: vec4f,    // speed, speedVar, life, lifeVar
  shape: vec4f,     // size, sizeVar, spin, capacity
  look: vec4f,      // endSize, fade, alpha, twinkle
  look2: vec4f,     // add, soft, stretch, rampMode (0 solid / 1 life / 2 palette)
  uv: vec4f,        // atlas frame rect
  hit: vec4f,       // collideMode (0 off / 1 bounce / 2 kill), bounce, friction, thickness
  softp: vec4f,     // softFade, time, projA, projB (viewDist = projB / (projA + depth))
  screen: vec4f,    // depthW, depthH, forceCount, frameMode
  flut: vec4f,      // flutter, flutterFreq, tumble, tumbleSpeed
  wrapv: vec4f,     // wrap extents w/h/d (0 = that axis unwrapped), on flag
  forces: array<vec4f, 16>,
  prevVP: mat4x4f,
  prevInv: mat4x4f,
  ramp: array<vec4f, 8>,
}
struct P {
  pos: vec4f,       // xyz + age
  vel: vec4f,       // xyz + life (0 = never lived)
  ext: vec4f,       // size, seed, spin, restAge (0 = live; else the age it came to rest)
}
fn pcg(v: u32) -> u32 {
  let state = v * 747796405u + 2891336453u;
  let word = ((state >> ((state >> 28u) + 4u)) ^ state) * 277803737u;
  return (word >> 22u) ^ word;
}
fn rand01(h: u32) -> f32 {
  return f32(h) * 2.3283064365386963e-10;
}
`;
var NOISE_WGSL = `
fn latticeHash(x: i32, y: i32, z: i32, seed: u32) -> u32 {
  let h = (bitcast<u32>(x) * 1597334677u) ^ (bitcast<u32>(y) * 3812015801u) ^ (bitcast<u32>(z) * 2798796415u) ^ seed;
  return pcg(h);
}
fn vnoise3(p: vec3f, seed: u32) -> f32 {
  let i = vec3i(floor(p));
  let f = p - floor(p);
  let u = f * f * (3.0 - 2.0 * f);
  let c000 = rand01(latticeHash(i.x, i.y, i.z, seed));
  let c100 = rand01(latticeHash(i.x + 1, i.y, i.z, seed));
  let c010 = rand01(latticeHash(i.x, i.y + 1, i.z, seed));
  let c110 = rand01(latticeHash(i.x + 1, i.y + 1, i.z, seed));
  let c001 = rand01(latticeHash(i.x, i.y, i.z + 1, seed));
  let c101 = rand01(latticeHash(i.x + 1, i.y, i.z + 1, seed));
  let c011 = rand01(latticeHash(i.x, i.y + 1, i.z + 1, seed));
  let c111 = rand01(latticeHash(i.x + 1, i.y + 1, i.z + 1, seed));
  let x00 = mix(c000, c100, u.x);
  let x10 = mix(c010, c110, u.x);
  let x01 = mix(c001, c101, u.x);
  let x11 = mix(c011, c111, u.x);
  return mix(mix(x00, x10, u.y), mix(x01, x11, u.y), u.z);
}
fn curl3(p: vec3f, seed: u32) -> vec3f {
  let e = 0.25;
  let k = 1.0 / (2.0 * e);
  let dzy = (vnoise3(p + vec3f(0.0, e, 0.0), seed + 71u) - vnoise3(p - vec3f(0.0, e, 0.0), seed + 71u)) * k;
  let dyz = (vnoise3(p + vec3f(0.0, 0.0, e), seed + 37u) - vnoise3(p - vec3f(0.0, 0.0, e), seed + 37u)) * k;
  let dxz = (vnoise3(p + vec3f(0.0, 0.0, e), seed + 11u) - vnoise3(p - vec3f(0.0, 0.0, e), seed + 11u)) * k;
  let dzx = (vnoise3(p + vec3f(e, 0.0, 0.0), seed + 71u) - vnoise3(p - vec3f(e, 0.0, 0.0), seed + 71u)) * k;
  let dyx = (vnoise3(p + vec3f(e, 0.0, 0.0), seed + 37u) - vnoise3(p - vec3f(e, 0.0, 0.0), seed + 37u)) * k;
  let dxy = (vnoise3(p + vec3f(0.0, e, 0.0), seed + 11u) - vnoise3(p - vec3f(0.0, e, 0.0), seed + 11u)) * k;
  return vec3f(dzy - dyz, dxz - dzx, dyx - dxy);
}
`;
/** Assemble the compute kernel (pure string work — dist-tested). `ms` picks
* the depth binding type to match the world's MSAA mode. */
function buildGpuParticleComputeWGSL(ms) {
	return `
${COMMON_WGSL}
${NOISE_WGSL}
struct DrawArgs {
  vertexCount: u32,
  instanceCount: atomic<u32>,
  firstVertex: u32,
  firstInstance: u32,
  live: atomic<u32>,        // true alive count (the readback stat) — in
  pad0: u32,                // STABLE-ORDER mode instanceCount is the whole
  pad1: u32,                // pool, so it can't double as the count
  pad2: u32,
}
@group(0) @binding(0) var<uniform> u: EU;
@group(0) @binding(1) var<storage, read_write> parts: array<P>;
@group(0) @binding(2) var<storage, read_write> alive: array<u32>;
@group(0) @binding(3) var<storage, read_write> args: DrawArgs;
@group(0) @binding(4) ${ms ? "var depthTex: texture_depth_multisampled_2d;" : "var depthTex: texture_depth_2d;"}

fn loadDepth(px: vec2i) -> f32 {
  return textureLoad(depthTex, px, 0);
}

fn unproject(px: vec2f, d: f32) -> vec3f {
  let ndc = vec3f(
    (px.x / u.screen.x) * 2.0 - 1.0,
    1.0 - (px.y / u.screen.y) * 2.0,
    d,
  );
  let w = u.prevInv * vec4f(ndc, 1.0);
  return w.xyz / w.w;
}

fn spawn(i: u32) -> P {
  let h0 = pcg(i ^ pcg(u32(u.spawn.z)));
  let r1 = rand01(pcg(h0 + 1u));
  let r2 = rand01(pcg(h0 + 2u));
  let r3 = rand01(pcg(h0 + 3u));
  let r4 = rand01(pcg(h0 + 4u));
  let r5 = rand01(pcg(h0 + 5u));
  let r6 = rand01(pcg(h0 + 6u));
  let r7 = rand01(pcg(h0 + 7u));
  let r8 = rand01(pcg(h0 + 8u));
  let r9 = rand01(pcg(h0 + 9u));
  let r10 = rand01(pcg(h0 + 10u));
  let r11 = rand01(pcg(h0 + 11u));
  let r12 = rand01(pcg(h0 + 12u));
  let r13 = rand01(pcg(h0 + 13u));
  let r14 = rand01(pcg(h0 + 14u));
  let dl = length(u.dir.xyz);
  var n: vec3f;
  if (dl > 1e-6 && u.dir.w < 6.2831843) {
    // Cone: uniform over the solid angle around the (normalised) axis.
    let a = u.dir.xyz / dl;
    var uax = vec3f(0.0, 1.0, 0.0);
    if (abs(a.x) < 0.9) { uax = vec3f(1.0, 0.0, 0.0); }
    let b = normalize(cross(a, uax));
    let c = cross(a, b);
    let cosT = 1.0 - r1 * (1.0 - cos(u.dir.w * 0.5));
    let sinT = sqrt(max(0.0, 1.0 - cosT * cosT));
    let phi = r2 * 6.2831853;
    n = a * cosT + b * (cos(phi) * sinT) + c * (sin(phi) * sinT);
  } else {
    // Uniform sphere direction (Marsaglia via z + angle).
    let zz = r1 * 2.0 - 1.0;
    let phi = r2 * 6.2831853;
    let sq = sqrt(max(0.0, 1.0 - zz * zz));
    n = vec3f(cos(phi) * sq, zz, sin(phi) * sq);
  }
  let v = max(0.0, u.motion.x + (r3 - 0.5) * 2.0 * u.motion.y);
  var pos = u.origin.xyz;
  if (u.box.w > 0.0) {
    let ra = r8 * 6.2831853;
    pos += vec3f(cos(ra) * u.box.w, 0.0, sin(ra) * u.box.w);
  }
  pos += (vec3f(r9, r10, r11) - 0.5) * u.box.xyz;
  if (u.origin.w > 0.0) {
    let zz = r12 * 2.0 - 1.0;
    let phi = r13 * 6.2831853;
    let sq = sqrt(max(0.0, 1.0 - zz * zz));
    let rr = pow(r14, 0.333333) * u.origin.w;
    pos += vec3f(cos(phi) * sq, zz, sin(phi) * sq) * rr;
  }
  // RADIAL emission (dir.w < 0 sentinel): velocity points AWAY from the
  // emitter origin — shockwaves/novas/explosion shells. Falls back to the
  // sphere direction when the spawn landed exactly on the origin.
  if (u.dir.w < 0.0) {
    let rd = pos - u.origin.xyz;
    let rl = length(rd);
    if (rl > 1e-5) { n = rd / rl; }
  }
  var out: P;
  out.pos = vec4f(pos, 0.0);
  out.vel = vec4f(n * v, max(0.05, u.motion.z + (r4 - 0.5) * 2.0 * u.motion.w));
  out.ext = vec4f(
    max(0.001, u.shape.x + (r5 - 0.5) * 2.0 * u.shape.y),
    r7,
    (r6 - 0.5) * 2.0 * u.shape.z,
    0.0,
  );
  return out;
}

@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  let cap = u32(u.shape.w);
  if (i >= cap) { return; }
  let dt = u.spawn.w;
  var p = parts[i];
  let rel = (f32(i) - u.spawn.x + u.shape.w) % u.shape.w;
  if (u.spawn.y > 0.0 && rel < u.spawn.y) {
    p = spawn(i);
  } else if (p.vel.w > 0.0 && p.pos.w < p.vel.w) {
    p.pos.w = p.pos.w + dt;
    // A RESTED particle (ext.w > 0) lies still: it ages and fades but no
    // forces, no motion, no further collision — a petal on the ground.
    if (p.pos.w < p.vel.w && p.ext.w == 0.0) {
      // Integrate forces (data-driven; twin: stepGpuParticle).
      var acc = vec3f(0.0);
      var drag = 0.0;
      let nf = u32(u.screen.z);
      for (var fi = 0u; fi < nf; fi = fi + 1u) {
        let fa = u.forces[fi * 2u];
        let fb = u.forces[fi * 2u + 1u];
        let kind = u32(fa.x);
        if (kind == 1u) {
          acc += fa.yzw;
        } else if (kind == 2u) {
          drag += fb.x;
        } else if (kind == 3u) {
          let t = u.softp.y * fb.z;
          acc += curl3(p.pos.xyz * fb.y + vec3f(t, t * 0.87, t * 1.13), 7u) * fb.x;
        } else if (kind == 4u) {
          let d = fa.yzw - p.pos.xyz;
          let rr = length(d);
          let rad = fb.y;
          let k = (fb.x / max(1e-4, rr)) * (rad * rad) / (rad * rad + rr * rr);
          acc += d * k;
        } else if (kind == 5u) {
          let rl = p.pos.xyz - fa.yzw;
          let ax = fb.yzw;
          let rad = rl - ax * dot(rl, ax);
          let rr = length(rad);
          let tang = cross(ax, rad);
          let tl = max(1e-6, length(tang));
          let k = (fb.x * rr) / (1.0 + rr * rr);
          acc += (tang / tl) * k - (rad / max(1e-4, rr)) * fb.x * 0.15;
        } else if (kind == 6u) {
          let rx = p.pos.x - fa.y;
          let rz = p.pos.z - fa.w;
          let rr = max(1e-4, length(vec2f(rx, rz)));
          acc += vec3f(
            (-rz / rr) * fb.x + (rx / rr) * (fb.y - rr) * fb.z,
            (fa.z - p.pos.y) * fb.z * 0.5,
            (rx / rr) * fb.x + (rz / rr) * (fb.y - rr) * fb.z,
          );
        }
      }
      // FLUTTER: the falling-leaf rock — a per-particle horizontal
      // oscillation (direction and phase from the seed), what makes petals
      // and leaves swing side-to-side instead of raining straight down.
      if (u.flut.x > 0.0) {
        let ph = p.ext.y * 6.2831853;
        let sway = sin((u.softp.y + p.ext.y * 3.7) * u.flut.y * 6.2831853 + ph);
        acc += vec3f(cos(ph), 0.0, sin(ph)) * (sway * u.flut.x);
      }
      var vel = p.vel.xyz + acc * dt;
      if (drag > 0.0) { vel *= max(0.0, 1.0 - drag * dt); }
      var pos = p.pos.xyz + vel * dt;
      var respawned = false;
      // DEPTH-BUFFER collision: last frame's depth under last frame's
      // matrices (one frame late — invisible). d == 0 means no data
      // (zero-initialised texture on the first frame / after resize).
      if (u.hit.x > 0.5) {
        let clip = u.prevVP * vec4f(pos, 1.0);
        if (clip.w > 0.01) {
          let ndc = clip.xyz / clip.w;
          if (abs(ndc.x) < 1.0 && abs(ndc.y) < 1.0 && ndc.z > 0.0 && ndc.z < 1.0) {
            let px = vec2i(
              i32((ndc.x * 0.5 + 0.5) * u.screen.x),
              i32((0.5 - ndc.y * 0.5) * u.screen.y),
            );
            let d = loadDepth(px);
            if (d > 0.0 && d < 1.0) {
              let sceneDist = u.softp.w / (u.softp.z + d);
              let partDist = clip.w;
              // Contact = behind the surface along the ray AND within
              // thickness of the actual surface POINT in 3D. The ray test
              // alone over-triggers at GRAZING incidence (near the horizon
              // a ray skims the ground, so a huge stretch of air sits
              // within thickness ray-units of it — Rich's "the floor rose
              // up and rain vanished below the horizon"); it survives as a
              // cheap pre-filter because |partDist - sceneDist| never
              // exceeds |pos - surface| (triangle inequality).
              let sp = unproject(vec2f(px), d);
              if (partDist > sceneDist - 0.02 && partDist - sceneDist < u.hit.w
                  && distance(pos, sp) < u.hit.w) {
                if (u.hit.x > 1.5 && u.hit.x < 2.5) {
                  p.pos.w = p.vel.w; // kill on contact
                } else if (u.hit.x > 3.5) {
                  // RESPAWN on contact: re-run the spawn init — the drop
                  // dies at the surface and is instantly reborn (infinite
                  // rain from one burst, nothing accumulates or floats).
                  p = spawn(i);
                  // FLUX-PRESERVING rebirth: re-enter at the box face
                  // OPPOSITE the emission direction (rain: the top). A
                  // uniform-volume rebirth makes each column's cycle time
                  // depend on its first-hit height — the sky's rain
                  // density then paints a ghost image of the ground's
                  // height map (Rich caught it: object shapes visible in
                  // the fresh rain). Uniform influx per face area = a
                  // uniform sky. Omni emitters keep the volume rebirth.
                  let ad = abs(u.dir.xyz);
                  if (max(ad.x, max(ad.y, ad.z)) > 1e-4) {
                    let hf = u.box.xyz * 0.5;
                    if (ad.y >= ad.x && ad.y >= ad.z) {
                      p.pos.y = u.origin.y - sign(u.dir.y) * hf.y;
                    } else if (ad.x >= ad.z) {
                      p.pos.x = u.origin.x - sign(u.dir.x) * hf.x;
                    } else {
                      p.pos.z = u.origin.z - sign(u.dir.z) * hf.z;
                    }
                  }
                  respawned = true;
                } else {
                  // Surface normal from depth neighbours, unprojected.
                  let p0 = sp;
                  let d1 = loadDepth(px + vec2i(2, 0));
                  let d2 = loadDepth(px + vec2i(0, 2));
                  var nrm = vec3f(0.0, 1.0, 0.0);
                  if (d1 > 0.0 && d1 < 1.0 && d2 > 0.0 && d2 < 1.0) {
                    let p1 = unproject(vec2f(px + vec2i(2, 0)), d1);
                    let p2 = unproject(vec2f(px + vec2i(0, 2)), d2);
                    let cr = cross(p1 - p0, p2 - p0);
                    if (length(cr) > 1e-9) { nrm = normalize(cr); }
                  }
                  if (dot(nrm, vel) > 0.0) { nrm = -nrm; }
                  let vn = dot(vel, nrm);
                  let tangential = vel - nrm * vn;
                  vel = (tangential * (1.0 - u.hit.z) - nrm * vn * u.hit.y);
                  pos = p.pos.xyz; // stay put this step: never tunnel in
                  // Rest mode: once the bounce has bled the speed off, the
                  // particle COMES TO REST — freeze it where it lies.
                  if (u.hit.x > 2.5 && length(vel) < 0.3) {
                    vel = vec3f(0.0);
                    p.ext.w = p.pos.w;
                  }
                }
              }
            }
          }
        }
      }
      // WRAP: fold the position back into a box around the emitter origin,
      // torus-style — the infinite-field illusion. Move the emitter with
      // the camera and a bounded pool covers any world size: particles
      // recycle across the trailing edge, fallers wrap back to the top.
      if (u.wrapv.w > 0.5 && !respawned) {
        let ext = u.wrapv.xyz;
        let half = ext * 0.5;
        let rel = pos - u.origin.xyz + half;
        let safe = max(ext, vec3f(1e-5));
        let folded = u.origin.xyz + (fract(rel / safe) * safe - half);
        pos = select(pos, folded, ext > vec3f(0.0));
      }
      if (!respawned) {
        p.vel = vec4f(vel, p.vel.w);
        p.pos = vec4f(pos, p.pos.w);
      }
    }
  }
  // ALPHA emitters (screen.w bit 1) draw in STABLE POOL ORDER: compaction
  // via atomicAdd is nondeterministic across workgroups, so unsorted
  // translucency re-composites in a DIFFERENT order every frame — dense
  // alpha smoke shimmers/flickers. Stable mode maps alive[i] = i and draws
  // the whole pool (dead slots emit degenerate clipped quads — no
  // fragments); additive emitters keep the tight compacted draw (additive
  // blending is order-independent). args.live carries the true count.
  if (p.vel.w > 0.0 && p.pos.w < p.vel.w) {
    atomicAdd(&args.live, 1u);
    if (u.screen.w < 1.5) {
      let slot = atomicAdd(&args.instanceCount, 1u);
      alive[slot] = i;
    }
  }
  if (u.screen.w >= 1.5) { alive[i] = i; }
  parts[i] = p;
}

@compute @workgroup_size(1)
fn reset() {
  atomicStore(&args.instanceCount, select(0u, u32(u.shape.w), u.screen.w >= 1.5));
  atomicStore(&args.live, 0u);
}
`;
}
/** Assemble the render shader (camera-facing/velocity-stretched quads with
* ramp-over-life, twinkle, soft depth fade). Pure string work. */
function buildGpuParticleRenderWGSL(ms) {
	return `
struct U {
  viewProj: mat4x4f,
  camPos: vec4f,
  fogColor: vec4f,
  params: vec4f,        // fogNear, fogFar, fogOn, TIME
  lightDir: vec4f,
  camRight: vec4f,
  camUp: vec4f,
}
${COMMON_WGSL}
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uvn: vec2f,
  @location(1) uv: vec2f,
  @location(2) color: vec4f,
  @location(3) world: vec3f,
  @location(4) viewDist: f32,
  @location(5) rest: f32,          // 1 = lying on geometry (disables soft fade)
}
@group(0) @binding(0) var<uniform> w: U;
@group(0) @binding(1) var<uniform> u: EU;
@group(0) @binding(2) var<storage, read> parts: array<P>;
@group(0) @binding(3) var<storage, read> alive: array<u32>;
@group(0) @binding(4) var samp: sampler;
@group(0) @binding(5) var tex: texture_2d<f32>;
@group(0) @binding(6) ${ms ? "var depthTex: texture_depth_multisampled_2d;" : "var depthTex: texture_depth_2d;"}

fn rampAt(t: f32) -> vec4f {
  let n = max(1.0, u.ramp[7].w);              // stop count stashed in the last slot's w
  let ci = clamp(t, 0.0, 1.0) * (n - 1.0);
  let i0 = u32(clamp(floor(ci), 0.0, 6.0));
  let i1 = min(i0 + 1u, u32(n - 1.0));
  let c0 = u.ramp[i0];
  let c1 = u.ramp[i1];
  return vec4f(mix(c0.rgb, c1.rgb, ci - floor(ci)), 1.0);
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let p = parts[alive[ii]];
  // Stable-order draws cover the WHOLE pool — dead slots become degenerate
  // clipped quads (z > w) and never reach the fragment stage.
  if (p.vel.w <= 0.0 || p.pos.w >= p.vel.w) {
    var dead: VSOut;
    dead.pos = vec4f(0.0, 0.0, 2.0, 1.0);
    return dead;
  }
  let t = clamp(p.pos.w / max(0.001, p.vel.w), 0.0, 1.0);
  // Rested particles freeze their animation clock at the rest age and
  // blend (over 0.2s) from camera-facing to LYING FLAT in the world plane.
  let rested = p.ext.w > 0.0;
  let effAge = select(p.pos.w, p.ext.w, rested);
  let restK = select(0.0, clamp((p.pos.w - p.ext.w) / 0.2, 0.0, 1.0), rested);
  var size = p.ext.x * mix(1.0, u.look.x, t);
  var a = u.look.z;
  // fade = the FRACTION of life over which alpha eases out at the end
  // (1 = the whole life, the old linear behaviour; 0.12 = only the last 12%).
  if (u.look.y > 0.0) { a *= clamp((1.0 - t) / u.look.y, 0.0, 1.0); }
  if (u.look.w > 0.0) {
    a *= 1.0 - u.look.w * (0.5 + 0.5 * sin(u.softp.y * 11.0 + p.ext.y * 271.0));
  }
  var rgb = u.ramp[0].rgb;
  if (u.look2.w > 1.5) {
    // palette: a per-particle stop picked by seed
    let n = max(1.0, u.ramp[7].w);
    rgb = u.ramp[u32(min(p.ext.y * n, n - 1.0))].rgb;
  } else if (u.look2.w > 0.5) {
    rgb = rampAt(t).rgb;
  }
  // TUMBLE: fake the quad turning over in 3D — squash its OWN across-axis
  // on a per-particle cosine (thin when edge-on) and dim it slightly. The
  // squash happens BEFORE the spin rotation, so it reads as the petal
  // flipping about its long axis however it has spun.
  var tsy = 1.0;
  if (u.flut.z > 0.0) {
    let tc = cos((effAge * u.flut.w + p.ext.y * 7.0) * 6.2831853);
    tsy = mix(1.0, max(0.12, abs(tc)), u.flut.z);
    rgb *= mix(mix(1.0, 0.72 + 0.28 * abs(tc), u.flut.z), 1.0, restK);
    tsy = mix(tsy, 1.0, restK);        // a resting petal opens fully flat
  }
  let c01 = vec2f(f32(vi & 1u), f32(vi >> 1u));
  var off = c01 - 0.5;
  off = vec2f(off.x, off.y * tsy);
  let rot = p.ext.z * effAge;
  let cr = cos(rot);
  let sr = sin(rot);
  off = vec2f(off.x * cr - off.y * sr, off.x * sr + off.y * cr);
  var world: vec3f;
  let speed = length(p.vel.xyz);
  if (u.look2.z > 0.0 && speed > 0.05) {
    // Velocity stretch: align the quad's x-axis with the velocity's
    // screen-parallel component and elongate by speed.
    let viewDir = normalize(p.pos.xyz - w.camPos.xyz);
    var axisX = p.vel.xyz - viewDir * dot(p.vel.xyz, viewDir);
    if (length(axisX) < 1e-5) { axisX = w.camRight.xyz; }
    axisX = normalize(axisX);
    let axisY = normalize(cross(viewDir, axisX));
    let raw = c01 - 0.5;
    let stretchLen = size * (1.0 + u.look2.z * speed);
    world = p.pos.xyz + (axisX * raw.x * stretchLen + axisY * raw.y * tsy * size) * 2.0;
  } else {
    let facing = p.pos.xyz + (w.camRight.xyz * off.x + w.camUp.xyz * off.y) * (size * 2.0);
    // Rested: blend to a quad lying FLAT in the world XZ plane (keeping its
    // frozen in-plane rotation) — a petal on the ground, not a billboard.
    let flat = p.pos.xyz + vec3f(off.x, 0.0, off.y) * (size * 2.0);
    world = mix(facing, flat, restK);
  }
  var out: VSOut;
  out.pos = w.viewProj * vec4f(world, 1.0);
  out.uvn = c01;
  out.uv = vec2f(mix(u.uv.x, u.uv.z, c01.x), mix(u.uv.y, u.uv.w, 1.0 - c01.y));
  out.color = vec4f(rgb, a);
  out.world = world;
  out.viewDist = out.pos.w;
  out.rest = restK;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  // in.pos is the @builtin(position) — fragment coordinates in this stage.
  let tx = textureSample(tex, samp, in.uv);   // unconditional: uniform control flow
  let dd = length(in.uvn - 0.5) * 2.0;
  var rgb = in.color.rgb;
  var a = in.color.a;
  // screen.w packs two bits: 1 = textured frame, 2 = stable draw order.
  if ((u32(u.screen.w + 0.5) & 1u) == 1u) {
    rgb *= tx.rgb;
    a *= tx.a;
  } else {
    let crisp = 1.0 - smoothstep(0.9, 1.0, dd);
    let glow = exp(-dd * dd * 5.0) * smoothstep(1.0, 0.7, dd);
    a *= mix(crisp, glow, clamp(u.look2.y, 0.0, 1.0));
  }
  // SOFT PARTICLES: fade where the quad nears scene depth (this frame's
  // opaque depth, bound read-only in the translucent pass).
  if (u.softp.x > 0.0) {
    let d = textureLoad(depthTex, vec2i(in.pos.xy), 0);
    if (d < 1.0) {
      let sceneDist = u.softp.w / (u.softp.z + d);
      // Rested particles LIE ON the geometry — soft fade would erase them.
      a *= mix(clamp((sceneDist - in.viewDist) / u.softp.x, 0.0, 1.0), 1.0, in.rest);
    }
  }
  let add = u.look2.x;
  if (w.params.z > 0.5) {
    let f = smoothstep(w.params.x, w.params.y, distance(w.camPos.xyz, in.world));
    rgb = mix(rgb, w.fogColor.rgb * (1.0 - add), f);
  }
  return vec4f(rgb * a, a * (1.0 - add));
}
`;
}
/** A persistent GPU emitter. Mutate the public fields freely — the uniform is
* repacked every frame. `kill()` releases the pool. */
var GpuEmitter = class {
	x;
	y;
	z;
	/** Particles per second (live). */
	rate;
	/** The full option surface — mutate anything (forces included). */
	opts;
	capacity;
	/** Alive count, ~2 frames stale (async readback). */
	alive = 0;
	dead = false;
	/** @internal */ cursor = 0;
	/** @internal */ acc = 0;
	/** @internal */ burstN = 0;
	/** @internal */ res = null;
	/** @internal */ seedCounter = Math.random() * 4294967295 >>> 0;
	constructor(opts) {
		this.opts = opts;
		this.x = opts.x ?? 0;
		this.y = opts.y ?? 0;
		this.z = opts.z ?? 0;
		this.rate = opts.rate ?? 0;
		this.capacity = Math.max(64, Math.min(1 << 21, Math.ceil(opts.capacity ?? 65536)));
	}
	/** Queue an immediate one-shot spawn of `count` particles this frame. */
	burst(count) {
		this.burstN += Math.max(0, count);
	}
	/** Release the emitter and its GPU pool. */
	kill() {
		this.dead = true;
	}
};
var WG$1 = 64;
var GpuParticles = class {
	format;
	sampleCount;
	filter;
	emitters = [];
	device;
	computePipeline;
	resetPipeline;
	renderPipeline;
	computeLayout;
	renderLayout;
	sampler;
	uniformScratch = new Float32Array(EU_TOTAL);
	depthTex = null;
	depthView = null;
	pendingMaps = [];
	constructor(device, format, sampleCount, filter) {
		this.format = format;
		this.sampleCount = sampleCount;
		this.filter = filter;
		this.rebuild(device);
	}
	/** Live emitters (dead ones are reaped in compute()). */
	get list() {
		return this.emitters;
	}
	/** Total alive particles across emitters (readback — ~2 frames stale). */
	get count() {
		let n = 0;
		for (const e of this.emitters) n += e.alive;
		return n;
	}
	emitter(opts) {
		const e = new GpuEmitter(opts);
		this.allocate(e);
		this.emitters.push(e);
		return e;
	}
	/** (Re)create pipelines; per-emitter buffers are re-allocated too (their
	* particle state is GPU-only and simply restarts — device loss already
	* blanks the screen for a frame). */
	rebuild(device) {
		this.device = device;
		const ms = this.sampleCount > 1;
		this.computeLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_COMPUTE,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_COMPUTE,
				buffer: { type: "storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_COMPUTE,
				buffer: { type: "storage" }
			},
			{
				binding: 3,
				visibility: BITS.STAGE_COMPUTE,
				buffer: { type: "storage" }
			},
			{
				binding: 4,
				visibility: BITS.STAGE_COMPUTE,
				texture: {
					sampleType: "depth",
					multisampled: ms
				}
			}
		] });
		this.renderLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 3,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 4,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			},
			{
				binding: 5,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 6,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {
					sampleType: "depth",
					multisampled: ms
				}
			}
		] });
		const computeModule = shaderModule(device, buildGpuParticleComputeWGSL(ms), "GpuParticles compute");
		const renderModule = shaderModule(device, buildGpuParticleRenderWGSL(ms), "GpuParticles render");
		const computePL = device.createPipelineLayout({ bindGroupLayouts: [this.computeLayout] });
		this.computePipeline = device.createComputePipeline({
			layout: computePL,
			compute: {
				module: computeModule,
				entryPoint: "cs"
			}
		});
		this.resetPipeline = device.createComputePipeline({
			layout: computePL,
			compute: {
				module: computeModule,
				entryPoint: "reset"
			}
		});
		this.renderPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.renderLayout] }),
			vertex: {
				module: renderModule,
				entryPoint: "vs"
			},
			fragment: {
				module: renderModule,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						},
						alpha: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						}
					}
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: false,
				depthCompare: "less-equal"
			},
			primitive: { topology: "triangle-strip" },
			multisample: { count: this.sampleCount }
		});
		this.sampler = device.createSampler({
			magFilter: this.filter,
			minFilter: this.filter
		});
		for (const e of this.emitters) this.allocate(e);
	}
	allocate(e) {
		const device = this.device;
		const parts = device.createBuffer({
			size: e.capacity * P_FLOATS * 4,
			usage: BITS.STORAGE
		});
		const alive = device.createBuffer({
			size: e.capacity * 4,
			usage: BITS.STORAGE
		});
		const args = device.createBuffer({
			size: 32,
			usage: BITS.STORAGE | BITS.INDIRECT | BITS.COPY_DST | BITS.COPY_SRC
		});
		device.queue.writeBuffer(args, 0, new Uint32Array([
			4,
			0,
			0,
			0,
			0,
			0,
			0,
			0
		]));
		e.res = {
			parts,
			alive,
			args,
			uniform: device.createBuffer({
				size: EU_TOTAL * 4,
				usage: BITS.UNIFORM | BITS.COPY_DST
			}),
			staging: [device.createBuffer({
				size: 32,
				usage: BITS.MAP_READ | BITS.COPY_DST
			}), device.createBuffer({
				size: 32,
				usage: BITS.MAP_READ | BITS.COPY_DST
			})],
			stagingBusy: [false, false],
			computeBind: null,
			renderBind: null,
			boundDepth: null,
			boundTex: null
		};
		e.cursor = 0;
		e.acc = 0;
	}
	release(e) {
		const r = e.res;
		if (!r) return;
		r.parts.destroy();
		r.alive.destroy();
		r.args.destroy();
		r.uniform.destroy();
		for (const s of r.staging) s.destroy();
		e.res = null;
	}
	/** Pack the per-frame uniform for one emitter (pure-ish: writes scratch). */
	packUniform(e, dt, time, spawn0, spawnN, seed, depthW, depthH, prevVP, prevInv, projA, projB, atlas) {
		const u = this.uniformScratch;
		u.fill(0);
		const o = e.opts;
		u[O.spawn] = spawn0;
		u[O.spawn + 1] = spawnN;
		u[O.spawn + 2] = seed;
		u[O.spawn + 3] = dt;
		u[O.origin] = e.x;
		u[O.origin + 1] = e.y;
		u[O.origin + 2] = e.z;
		u[O.origin + 3] = o.spawnRadius ?? 0;
		const d = o.dir;
		u[O.dir] = d?.x ?? 0;
		u[O.dir + 1] = d?.y ?? 0;
		u[O.dir + 2] = d?.z ?? 0;
		u[O.dir + 3] = o.radial ? -1 : o.spread ?? Math.PI * 2;
		u[O.box] = o.box?.w ?? 0;
		u[O.box + 1] = o.box?.h ?? 0;
		u[O.box + 2] = o.box?.d ?? 0;
		u[O.box + 3] = o.ring ?? 0;
		const speed = o.speed ?? 3;
		u[O.motion] = speed;
		u[O.motion + 1] = o.speedVar ?? speed * .4;
		u[O.motion + 2] = o.life ?? 2;
		u[O.motion + 3] = o.lifeVar ?? (o.life ?? 2) * .3;
		const size = o.size ?? .06;
		u[O.shape] = size;
		u[O.shape + 1] = o.sizeVar ?? size * .4;
		u[O.shape + 2] = o.spin ?? 0;
		u[O.shape + 3] = e.capacity;
		u[O.look] = typeof o.shrink === "number" ? Math.max(0, o.shrink) : o.shrink ?? true ? 0 : 1;
		u[O.look + 1] = typeof o.fade === "number" ? Math.min(1, Math.max(0, o.fade)) : o.fade ?? true ? 1 : 0;
		u[O.look + 2] = o.alpha ?? 1;
		u[O.look + 3] = o.twinkle ?? 0;
		u[O.look2] = o.add ?? true ? 1 : 0;
		u[O.look2 + 1] = o.soft ?? 1;
		u[O.look2 + 2] = o.stretch ?? 0;
		u[O.look2 + 3] = o.ramp ? 1 : o.colors ? 2 : 0;
		const frame = atlas.frames[o.frame != null && o.frame >= 0 ? o.frame : 0];
		if (frame) {
			u[O.uv] = frame.u0;
			u[O.uv + 1] = frame.v0;
			u[O.uv + 2] = frame.u1;
			u[O.uv + 3] = frame.v1;
		}
		const col = o.collide === true ? {} : o.collide || null;
		u[O.hit] = col && prevVP ? col.kill ? 2 : col.respawn ? 4 : col.rest ? 3 : 1 : 0;
		u[O.hit + 1] = col?.bounce ?? .5;
		u[O.hit + 2] = col?.friction ?? .1;
		u[O.hit + 3] = col?.thickness ?? .5;
		u[O.softp] = o.softFade ?? .25;
		u[O.softp + 1] = time;
		u[O.softp + 2] = projA;
		u[O.softp + 3] = projB;
		const forces = o.forces ?? [];
		u[O.screen] = depthW;
		u[O.screen + 1] = depthH;
		u[O.screen + 2] = Math.min(8, forces.length);
		u[O.screen + 3] = (o.frame != null && o.frame >= 0 ? 1 : 0) + (o.add ?? true ? 0 : 2);
		u[O.flut] = o.flutter ?? 0;
		u[O.flut + 1] = o.flutterFreq ?? .7;
		u[O.flut + 2] = Math.min(1, Math.max(0, o.tumble ?? 0));
		u[O.flut + 3] = o.tumbleSpeed ?? .6;
		if (o.wrap) {
			const wr = o.wrap === true ? o.box ?? {} : o.wrap;
			u[O.wrapv] = wr.w ?? 0;
			u[O.wrapv + 1] = wr.h ?? 0;
			u[O.wrapv + 2] = wr.d ?? 0;
			u[O.wrapv + 3] = 1;
		}
		u.set(packForces(forces), O.forces);
		if (prevVP) u.set(prevVP, O.prevVP);
		if (prevInv) u.set(prevInv, O.prevInv);
		const stops = o.ramp ? resolveRamp(o.ramp) : o.colors ? o.colors.map((c) => rgba(c)) : [rgba(o.color ?? "#ffffff")];
		const n = Math.min(8, stops.length);
		for (let i = 0; i < n; i++) {
			u[O.ramp + i * 4] = stops[i][0];
			u[O.ramp + i * 4 + 1] = stops[i][1];
			u[O.ramp + i * 4 + 2] = stops[i][2];
			u[O.ramp + i * 4 + 3] = stops[i][3];
		}
		u[O.ramp + 28 + 3] = n;
		return u;
	}
	/**
	* Encode this frame's sim: per emitter — reset the indirect args (encoder-
	* ordered, so the pre-reset count can be copied out for the readback),
	* repack + upload the uniform, dispatch the update kernel. Runs BEFORE the
	* render passes; collision reads `depth` (last frame's content).
	*/
	compute(encoder, dt, time, depth, prevVP, prevInv, projA, projB, atlas) {
		for (let i = this.emitters.length - 1; i >= 0; i--) if (this.emitters[i].dead) {
			this.release(this.emitters[i]);
			this.emitters.splice(i, 1);
		}
		if (!this.emitters.length) return;
		if (this.depthTex !== depth) {
			this.depthTex = depth;
			this.depthView = depth.createView();
			for (const em of this.emitters) if (em.res) {
				em.res.computeBind = null;
				em.res.renderBind = null;
			}
		}
		const depthView = this.depthView;
		for (const e of this.emitters) {
			const r = e.res;
			e.acc += e.rate * dt + e.burstN;
			e.burstN = 0;
			let n = Math.floor(e.acc);
			e.acc -= n;
			if (n > e.capacity) n = e.capacity;
			const spawn0 = e.cursor;
			e.cursor = (e.cursor + n) % e.capacity;
			e.seedCounter = e.seedCounter + 1 >>> 0;
			const u = this.packUniform(e, dt, time, spawn0, n, pcg(e.seedCounter), depth.width, depth.height, prevVP, prevInv, projA, projB, atlas);
			this.device.queue.writeBuffer(r.uniform, 0, u.buffer, 0, EU_TOTAL * 4);
			if (!r.computeBind || r.boundDepth !== depthView) {
				r.computeBind = this.device.createBindGroup({
					layout: this.computeLayout,
					entries: [
						{
							binding: 0,
							resource: { buffer: r.uniform }
						},
						{
							binding: 1,
							resource: { buffer: r.parts }
						},
						{
							binding: 2,
							resource: { buffer: r.alive }
						},
						{
							binding: 3,
							resource: { buffer: r.args }
						},
						{
							binding: 4,
							resource: depthView
						}
					]
				});
				r.boundDepth = depthView;
				r.renderBind = null;
			}
			const si = r.stagingBusy[0] ? r.stagingBusy[1] ? -1 : 1 : 0;
			if (si >= 0) {
				encoder.copyBufferToBuffer(r.args, 0, r.staging[si], 0, 32);
				r.stagingBusy[si] = true;
				this.pendingMaps.push({
					e,
					r,
					si
				});
			}
			const pass = encoder.beginComputePass();
			pass.setPipeline(this.resetPipeline);
			pass.setBindGroup(0, r.computeBind);
			pass.dispatchWorkgroups(1);
			pass.setPipeline(this.computePipeline);
			pass.setBindGroup(0, r.computeBind);
			pass.dispatchWorkgroups(Math.ceil(e.capacity / WG$1));
			pass.end();
		}
	}
	/** Draw every emitter into the (translucent) pass — one drawIndirect each. */
	render(pass, worldUniforms, atlasView) {
		if (!this.emitters.length || !atlasView) return;
		let set = false;
		for (const e of this.emitters) {
			const r = e.res;
			if (!r.boundDepth) continue;
			if (!r.renderBind || r.boundTex !== atlasView) {
				r.renderBind = this.device.createBindGroup({
					layout: this.renderLayout,
					entries: [
						{
							binding: 0,
							resource: { buffer: worldUniforms }
						},
						{
							binding: 1,
							resource: { buffer: r.uniform }
						},
						{
							binding: 2,
							resource: { buffer: r.parts }
						},
						{
							binding: 3,
							resource: { buffer: r.alive }
						},
						{
							binding: 4,
							resource: this.sampler
						},
						{
							binding: 5,
							resource: atlasView
						},
						{
							binding: 6,
							resource: r.boundDepth
						}
					]
				});
				r.boundTex = atlasView;
			}
			if (!set) {
				pass.setPipeline(this.renderPipeline);
				set = true;
			}
			pass.setBindGroup(0, r.renderBind);
			pass.drawIndirect(r.args, 0);
		}
	}
	/** Kick off the alive-count readbacks — call AFTER queue.submit() (a
	* pending map on a buffer inside a submit is a validation error). */
	afterSubmit() {
		for (const m of this.pendingMaps) {
			const buf = m.r.staging[m.si];
			buf.mapAsync(1).then(() => {
				m.e.alive = new Uint32Array(buf.getMappedRange())[4];
				buf.unmap();
				m.r.stagingBusy[m.si] = false;
			}).catch(() => {
				m.r.stagingBusy[m.si] = false;
			});
		}
		this.pendingMaps.length = 0;
	}
	/** Kill everything (world teardown). */
	clear() {
		for (const e of this.emitters) {
			this.release(e);
			e.dead = true;
		}
		this.emitters = [];
	}
};
var GPU_PARTICLE_LAYOUT = {
	P_FLOATS,
	EU_TOTAL,
	offsets: O
};
//#endregion
//#region src/lib/grass3d.ts
var BLADE_FLOATS = 12;
var SEG = 4;
var BLADE_VERTS = 10;
var WG = 64;
var LIGHTING_WGSL = `
struct U {
  viewProj: mat4x4f,
  camPos: vec4f,
  fogColor: vec4f,
  params: vec4f,
  lightDir: vec4f,
  right: vec4f,
  up: vec4f,
  ambSky: vec4f,
  ambGround: vec4f,
  sunCol: vec4f,
}
struct LU {
  view: mat4x4f,
  shadowVP: mat4x4f,
  params: vec4f,
  grid: vec4f,
  proj: vec4f,
  shadow: vec4f,
}
@group(1) @binding(0) var<uniform> lu: LU;
@group(1) @binding(1) var<storage, read> lights: array<vec4f>;
@group(1) @binding(2) var<storage, read> clusters: array<u32>;
@group(1) @binding(3) var shadowMap: texture_depth_2d;
@group(1) @binding(4) var shadowSamp: sampler_comparison;

fn pbrDirect(nrm: vec3f, v: vec3f, l: vec3f, albedo: vec3f, metallic: f32, rough: f32, radiance: vec3f) -> vec3f {
  let h = normalize(v + l);
  let NL = max(dot(nrm, l), 0.0);
  let NV = max(dot(nrm, v), 1e-4);
  let NH = max(dot(nrm, h), 0.0);
  let VH = max(dot(v, h), 0.0);
  let a2 = rough * rough * rough * rough;
  let dd2 = NH * NH * (a2 - 1.0) + 1.0;
  let D = a2 / (3.14159 * dd2 * dd2);
  let kk = (rough + 1.0) * (rough + 1.0) / 8.0;
  let G = (NV / (NV * (1.0 - kk) + kk)) * (NL / (NL * (1.0 - kk) + kk));
  let F0 = mix(vec3f(0.04), albedo, metallic);
  let F = F0 + (1.0 - F0) * pow(1.0 - VH, 5.0);
  let spec = D * G * F / (4.0 * NV * NL + 1e-4);
  let kd = (vec3f(1.0) - F) * (1.0 - metallic);
  return (kd * albedo / 3.14159 + spec) * NL * radiance;
}
const POISSON8 = array<vec2f, 8>(
  vec2f(-0.326, -0.406), vec2f(-0.840, -0.074), vec2f(-0.696, 0.457), vec2f(-0.203, 0.621),
  vec2f(0.962, -0.195), vec2f(0.473, -0.480), vec2f(0.519, 0.767), vec2f(0.185, -0.893),
);
fn shadowFactor(world: vec3f, nrm: vec3f) -> f32 {
  let NL = max(dot(nrm, -u.lightDir.xyz), 0.0);
  let slope = sqrt(max(1.0 - NL * NL, 0.0)) / max(NL, 0.15);
  let off = lu.shadow.w * min(1.0 + slope, 6.0);
  let sc = lu.shadowVP * vec4f(world + nrm * off, 1.0);
  let ndc = sc.xyz / sc.w;
  if (abs(ndc.x) >= 1.0 || abs(ndc.y) >= 1.0 || ndc.z <= 0.0 || ndc.z >= 1.0) { return 1.0; }
  let uv = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
  let refZ = ndc.z - lu.shadow.y;
  let hh = fract(sin(dot(world, vec3f(12.9898, 78.233, 37.719))) * 43758.547);
  let ca = cos(hh * 6.28318); let sa = sin(hh * 6.28318);
  var sum = textureSampleCompareLevel(shadowMap, shadowSamp, uv, refZ);
  for (var i = 0; i < 8; i = i + 1) {
    let p = POISSON8[i] * (lu.shadow.z * 2.5);
    let r = vec2f(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
    sum += textureSampleCompareLevel(shadowMap, shadowSamp, uv + r, refZ);
  }
  return sum / 9.0;
}
`;
var GRASS_UNIFORM = `
struct GU {
  viewProj: mat4x4f,
  camPos: vec4f,      // xyz + time
  win: vec4f,         // spacing, cells, halfSpan, baseY
  terr: vec4f,        // terrainSize, terrainRes, groundTint, unused
  wind: vec4f,        // dirX, dirZ, strength, unused
  blade: vec4f,       // baseHeight, width, cardWidth, cardHeight
  tint: vec4f,        // grass green rgb + unused
  far: vec4f,         // farSpacing, farCells, farHalfSpan, innerFade
  view: vec4f,        // fwdX, fwdZ, viewBias, fanCos  (fan window; fanCos<=-1 = disc)
  veg: vec4f,         // frameCount, flowerFrames, flowerAmount, dryness
}
`;
var COMPUTE_FNS = `
fn hash2(p: vec2f) -> vec2f {
  let k = fract(sin(vec2f(dot(p, vec2f(127.1, 311.7)), dot(p, vec2f(269.5, 183.3)))) * 43758.5453);
  return k;
}
fn rand(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(419.2, 71.9))) * 43758.5453); }
// Smooth value noise (0..1) for LOW-FREQUENCY masks — e.g. flower patches so
// blooms cluster in drifts instead of an even spray.
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = rand(i); let b = rand(i + vec2f(1.0, 0.0));
  let c = rand(i + vec2f(0.0, 1.0)); let d = rand(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// Terrain height at world XZ — manual bilinear over the baked r32float
// heightfield (dim = res+1; texel i maps to world (i/res - 0.5)·size).
fn groundAt(wx: f32, wz: f32) -> f32 {
  let res = g.terr.y;
  let fx = (wx / g.terr.x + 0.5) * res;
  let fz = (wz / g.terr.x + 0.5) * res;
  let hi = i32(res);
  let x0 = clamp(i32(floor(fx)), 0, hi); let x1 = min(x0 + 1, hi);
  let z0 = clamp(i32(floor(fz)), 0, hi); let z1 = min(z0 + 1, hi);
  let tx = fract(fx); let tz = fract(fz);
  let a = textureLoad(heightTex, vec2i(x0, z0), 0).r;
  let b = textureLoad(heightTex, vec2i(x1, z0), 0).r;
  let c = textureLoad(heightTex, vec2i(x0, z1), 0).r;
  let d = textureLoad(heightTex, vec2i(x1, z1), 0).r;
  return mix(mix(a, b, tx), mix(c, d, tx), tz);
}
`;
var COMPUTE_BINDS = `
struct Args { vtx: u32, inst: atomic<u32>, firstV: u32, firstI: u32 }
@group(0) @binding(0) var<uniform> g: GU;
@group(0) @binding(2) var<storage, read_write> args: Args;
@group(0) @binding(3) var heightTex: texture_2d<f32>;
@group(0) @binding(4) var colormap: texture_2d<f32>;
@group(0) @binding(5) var samp: sampler;
`;
function bladeComputeWGSL() {
	return `
${GRASS_UNIFORM}
struct Blade { posH: vec4f, dir: vec4f, col: vec4f }
@group(0) @binding(1) var<storage, read_write> blades: array<Blade>;
${COMPUTE_BINDS}
${COMPUTE_FNS}
@compute @workgroup_size(${WG})
fn cs(@builtin(global_invocation_id) gid: vec3u) {
  let cells = u32(g.win.y);
  let total = cells * cells;
  if (gid.x >= total) { return; }
  let spacing = g.win.x;
  let cx = f32(gid.x % cells);
  let cz = f32(gid.x / cells);
  let halfSpan = g.win.z;
  // FAN window: the lattice centre slides FORWARD along the view direction by
  // viewBias·halfSpan (0 = a disc centred on the camera, unchanged). The grid
  // still snaps to WHOLE world cells, so every blade is pinned to an absolute
  // cell and never swims — only the SET of live cells re-aims as you turn.
  let ctrX = g.camPos.x + g.view.x * (g.view.z * halfSpan);
  let ctrZ = g.camPos.z + g.view.y * (g.view.z * halfSpan);
  let ox = floor(ctrX / spacing) - g.win.y * 0.5;
  let oz = floor(ctrZ / spacing) - g.win.y * 0.5;
  let wcx = ox + cx;
  let wcz = oz + cz;
  let jit = hash2(vec2f(wcx, wcz));
  let bx = (wcx + 0.5 + (jit.x - 0.5) * 0.9) * spacing;
  let bz = (wcz + 0.5 + (jit.y - 0.5) * 0.9) * spacing;
  // Two distances: from the forward-shifted CENTRE (edgeR) and from the CAMERA
  // (dCam). With viewBias 0 the centre IS the camera and edgeR == dCam == the
  // old distance, so the default look is byte-identical.
  let er = vec2f(bx - ctrX, bz - ctrZ);
  let edgeR = sqrt(dot(er, er));
  let dx = bx - g.camPos.x; let dz = bz - g.camPos.z;
  let dCam = sqrt(dx * dx + dz * dz);
  // A small FEET DISC around the camera is always kept (in every direction), so
  // the window can be pushed FAR forward (viewBias > 1) without baring the
  // ground under you. Outside it, membership is the forward disc.
  let nearR = halfSpan * 0.28;
  if (edgeR > halfSpan && dCam > nearR) { return; }
  // Angular fan cull (skipped when fanCos ≤ -1 → disc, or inside the feet disc).
  if (g.view.w > -1.0 && dCam > nearR) {
    if (dot(vec2f(dx, dz) / max(dCam, 1e-4), vec2f(g.view.x, g.view.y)) < g.view.w) { return; }
  }
  // Fades key off whichever is closer — camera OR forward centre — so feet stay
  // full height even when the centre is pushed way ahead.
  let fadeR = min(edgeR, dCam);
  // Never spawn past the terrain edge (else grass floats over the void
  // against the sky at the world boundary — the "crazy billboards" bug).
  let ext = g.terr.x * 0.5;
  if (abs(bx) > ext || abs(bz) > ext) { return; }
  // The full-height inner zone widens with viewBias so the ground near the
  // camera (now off-centre in the shifted disc) still reads as full grass.
  let inner = min(0.3 + g.view.z, 0.82);
  // dynamic (terr.w) is the fraction of cells that become real blades — the
  // rest are left to the billboard cards. Times a distance thinning so the
  // outer blades are sparse where the cards ramp up (they CROSS-FADE).
  let keepProb = g.terr.w * mix(1.0, 0.12, smoothstep(halfSpan * inner, halfSpan, fadeR));
  if (rand(vec2f(wcx * 7.1, wcz * 3.3)) > keepProb) { return; }
  let gy = groundAt(bx, bz);
  // Frustum cull (generous top margin — blades are tall).
  let clip = g.viewProj * vec4f(bx, gy, bz, 1.0);
  if (clip.w <= 0.0) { return; }
  let ndc = clip.xyz / clip.w;
  if (abs(ndc.x) > 1.25 || ndc.y < -1.6 || ndc.y > 1.25) { return; }
  // Grow only on GRASSY ground (green in the colormap).
  let tuv = vec2f(bx / g.terr.x + 0.5, bz / g.terr.x + 0.5);
  let base = textureSampleLevel(colormap, samp, tuv, 0.0).rgb;
  let grassy = smoothstep(0.0, 0.05, base.g - max(base.r, base.b));
  if (grassy < 0.25) { return; }

  // Height ALSO tapers with distance (full only in the inner third, shrinking
  // to nothing at the edge) — so far blades are both SPARSER and SHORTER, which
  // is what reads as "thinning out" as the cards take over.
  let edgeFade = smoothstep(halfSpan, halfSpan * (inner + 0.05), fadeR);
  let hgt = g.blade.x * (0.6 + rand(vec2f(wcz, wcx)) * 0.7) * grassy * edgeFade;
  if (hgt < 0.03) { return; }
  let yaw = jit.x * 6.28318 + rand(vec2f(wcx * 1.3, wcz)) * 0.6;
  let facing = vec2f(sin(yaw), cos(yaw));
  let bend = 0.1 + jit.y * 0.22;
  // Width varies per blade — some fat, some slender (uniform width read as
  // synthetic). Taller blades run a touch thinner.
  let wdt = g.blade.y * (0.6 + rand(vec2f(wcx * 5.3, wcz)) * 0.9);
  // Tint: grass green blended toward the ground colour so blades relate to
  // the terrain, with per-blade brightness AND a little hue variation.
  let hueV = (rand(vec2f(wcx * 2.7, wcz * 1.9)) - 0.5) * 0.12;
  let tintV = mix(g.tint.rgb, base, g.terr.z) * (0.82 + rand(vec2f(wcx, wcz * 2.1)) * 0.36) + vec3f(hueV * 0.5, hueV, -hueV * 0.5);
  let phase = rand(vec2f(wcz * 3.7, wcx)) * 6.28318;

  let slot = atomicAdd(&args.inst, 1u);
  blades[slot].posH = vec4f(bx, gy, bz, hgt);
  blades[slot].dir = vec4f(facing, bend, wdt);
  blades[slot].col = vec4f(max(tintV, vec3f(0.0)), phase);
}
`;
}
function cardComputeWGSL() {
	return `
${GRASS_UNIFORM}
struct Card { posH: vec4f, sw: vec4f, col: vec4f }
@group(0) @binding(1) var<storage, read_write> cards: array<Card>;
${COMPUTE_BINDS}
${COMPUTE_FNS}
@compute @workgroup_size(${WG})
fn csCards(@builtin(global_invocation_id) gid: vec3u) {
  let cells = u32(g.far.y);
  if (gid.x >= cells * cells) { return; }
  let spacing = g.far.x;
  let cx = f32(gid.x % cells);
  let cz = f32(gid.x / cells);
  let ox = floor(g.camPos.x / spacing) - g.far.y * 0.5;
  let oz = floor(g.camPos.z / spacing) - g.far.y * 0.5;
  let wcx = ox + cx;
  let wcz = oz + cz;
  let jit = hash2(vec2f(wcx * 1.7, wcz * 2.3));
  let bx = (wcx + 0.5 + (jit.x - 0.5) * 0.9) * spacing;
  let bz = (wcz + 0.5 + (jit.y - 0.5) * 0.9) * spacing;
  let dx = bx - g.camPos.x; let dz = bz - g.camPos.z;
  let dist = sqrt(dx * dx + dz * dz);
  let halfSpan = g.far.z;
  // CARDS ARE ETERNAL and NOT fanned. The fan is for the EXPENSIVE blades (~10
  // verts each) whose radius is mostly wasted behind you; the cards are cheap
  // (4 verts) and their FULL-DISC coverage is the whole point — it's what keeps
  // the horizon seamless as you turn. Existence depends ONLY on WORLD position
  // (grassy ground, inside the terrain, within the fog window), never on the
  // camera — a camera-distance OR view-direction term makes cards flicker/mow.
  if (dist > halfSpan) { return; }
  let ext = g.terr.x * 0.5;
  if (abs(bx) > ext || abs(bz) > ext) { return; }   // never past the terrain edge
  let gy = groundAt(bx, bz);
  // Frustum cull — but NEVER for close cards: near the camera clip.w is
  // small, so NDC explodes and even an on-screen clump fails any fixed
  // margin. Close cards are few; keep them all, cull only far ones (their
  // NDC is well-behaved, a modest margin holds through rotation).
  if (dist > 30.0) {
    let clip = g.viewProj * vec4f(bx, gy + g.blade.w, bz, 1.0);
    if (clip.w <= 0.0) { return; }
    let ndc = clip.xyz / clip.w;
    if (abs(ndc.x) > 1.6 || ndc.y < -1.8 || ndc.y > 1.6) { return; }
  }
  let tuv = vec2f(bx / g.terr.x + 0.5, bz / g.terr.x + 0.5);
  let base = textureSampleLevel(colormap, samp, tuv, 0.0).rgb;
  let grassy = smoothstep(0.0, 0.05, base.g - max(base.r, base.b));
  if (grassy < 0.25) { return; }
  // World-anchored density: the grassy mask, tapering only at the FAR window
  // edge (150-180u out — deep in fog, so the taper ring is imperceptible; a
  // hard cliff there could read as a faint line). No near-field camera terms.
  let keepP = grassy * (1.0 - smoothstep(halfSpan * 0.85, halfSpan, dist));
  if (rand(vec2f(wcx * 9.3, wcz * 5.7)) > keepP) { return; }
  let fade = 1.0;
  let wdt = g.blade.z * (0.7 + rand(vec2f(wcx * 3.1, wcz)) * 0.6);
  let hgt = g.blade.w * (0.7 + rand(vec2f(wcz * 2.2, wcx)) * 0.6);
  let hueV = (rand(vec2f(wcx * 2.7, wcz * 1.9)) - 0.5) * 0.1;
  let tintV = mix(g.tint.rgb, base, max(g.terr.z, 0.35)) * (0.82 + rand(vec2f(wcx, wcz)) * 0.32) + vec3f(hueV * 0.5, hueV, -hueV * 0.5);
  let phase = rand(vec2f(wcz * 3.7, wcx)) * 6.28318;
  // Frame pick: 0 = grass clump (the default). Flowers (frames 1..flowerFrames)
  // only appear inside LOW-FREQUENCY patches (vnoise) so blooms grow in drifts,
  // and only a fraction of the clumps within a patch flower — the rest stay
  // grass so the colour reads as a sprinkle, not a solid bed.
  var frame = 0u;
  let fflowers = u32(g.veg.y);
  if (fflowers > 0u && g.veg.z > 0.001) {
    let drift = vnoise(vec2f(bx, bz) * 0.05);
    if (drift > 1.0 - g.veg.z && rand(vec2f(wcx * 5.9, wcz * 8.1)) < 0.5) {
      frame = 1u + (u32(rand(vec2f(wcz * 1.3, wcx * 4.4)) * f32(fflowers)) % fflowers);
    }
  }
  let slot = atomicAdd(&args.inst, 1u);
  cards[slot].posH = vec4f(bx, gy, bz, hgt);
  cards[slot].sw = vec4f(wdt, phase, fade, f32(frame));
  cards[slot].col = vec4f(max(tintV, vec3f(0.0)), 0.0);
}
`;
}
function renderWGSL() {
	return `
${GRASS_UNIFORM}
${LIGHTING_WGSL}
struct Blade { posH: vec4f, dir: vec4f, col: vec4f }
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<uniform> g: GU;
@group(0) @binding(2) var<storage, read> blades: array<Blade>;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) normal: vec3f,
  @location(1) world: vec3f,
  @location(2) color: vec3f,
  @location(3) t: f32,          // 0 base → 1 tip (for AO + tip lightening)
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let b = blades[ii];
  let base = b.posH.xyz;
  let height = b.posH.w;
  let facing = b.dir.xy;
  let bend = b.dir.z;
  let width = b.dir.w;
  let phase = b.col.w;

  let seg = vi / 2u;
  let side = f32(vi % 2u) * 2.0 - 1.0;      // -1 / +1 across the blade
  let t = f32(seg) / ${SEG}.0;

  // Wind: a GUST WAVE travelling across the field (coherent, so you see the
  // breeze roll through) PLUS a small per-blade flutter (so it's alive, not
  // one monolithic lean). The wave dominates; the flutter breaks uniformity.
  let travel = sin(dot(base.xz, g.wind.xy) * 0.35 - g.camPos.w * 1.3);
  let flutter = sin(g.camPos.w * 2.4 + phase);
  let sway = (travel * 0.75 + flutter * 0.25) * g.wind.z;
  let lean = bend + sway * 0.3;

  // Blade curve: rises in Y, leans along the facing dir, arcs toward the tip.
  let fwd = lean * t * t;
  let y = height * (t - 0.12 * t * t);
  let sideDir = vec3f(-facing.y, 0.0, facing.x);
  let taper = width * (1.0 - t * 0.85);
  let center = base + vec3f(facing.x * fwd, y, facing.y * fwd);
  let world = center + sideDir * taper * side;

  // Normal: perpendicular to the blade's tangent, curved across the width
  // (GoT trick) so a flat blade reads as a rounded one under the sun.
  let tangent = normalize(vec3f(facing.x * (2.0 * lean * t), height * (1.0 - 0.24 * t) + 1e-3, facing.y * (2.0 * lean * t)));
  var nrm = normalize(cross(sideDir, tangent));
  nrm = normalize(nrm + sideDir * side * 0.4);

  var out: VSOut;
  out.pos = u.viewProj * vec4f(world, 1.0);
  out.normal = nrm;
  out.world = world;
  out.color = b.col.rgb;
  out.t = t;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  var n = normalize(in.normal);
  let v = normalize(u.camPos.xyz - in.world);
  // Double-sided: face the normal toward the viewer.
  if (dot(n, v) < 0.0) { n = -n; }
  // Root→tip gradient: deep green at the base, brighter + a touch warmer at
  // the tip. A LIFTED root (0.7, not near-black) so the gaps between blades
  // don't read as stubble/soil shadow.
  let root = in.color * 0.70;
  let tip = in.color * 1.18 * vec3f(1.04, 1.06, 0.82);
  var albedo = mix(root, tip, in.t * in.t);
  // Straw dryness: warm the blade toward hay-yellow, preserving its light/dark
  // structure (luminance) so a thin dry field reads golden, not flat-recoloured.
  let dluma = dot(albedo, vec3f(0.3333));
  albedo = mix(albedo, dluma * vec3f(1.35, 1.12, 0.5), g.veg.w);
  let rough = 0.82;
  // Sky-biased ambient with a high floor: a blade is a thin thing that catches
  // skylight regardless of which way its face points, so don't let a sideways
  // normal drag the ambient down to the dark ground term (that + shadow was
  // the "blades go really dark over a hill" — cards use the same formula now).
  let ambient = mix(u.ambGround.rgb, u.ambSky.rgb, n.y * 0.35 + 0.65) * u.fogColor.a;
  // NO cascade shadow on grass: the shadow map re-centres on the camera each
  // frame, so its 40u box became a dark patch that followed you (tall blades
  // self-shadow-acne at the base inside it, while far cards outside it stayed
  // bright). Grass just takes ambient + the direct sun.
  // WRAPPED diffuse on a mostly-UP normal — NOT opaque-slab PBR. The blade
  // cross-normal is viewer-flipped (double-sided), so looking sunward turned
  // whole patches to NL=0 ambient-black (Rich's roaming black spots). A thin
  // translucent blade scatters light through itself: light it like the MEADOW
  // surface (up) with 35% of the cross-normal for shape, half-Lambert wrap so
  // it can never hit zero.
  let nLit = normalize(mix(n, vec3f(0.0, 1.0, 0.0), 0.65));
  let nl = clamp((dot(nLit, -u.lightDir.xyz) + 0.5) / 1.5, 0.0, 1.0);
  var rgb = albedo * ambient + albedo * u.sunCol.rgb * u.sunCol.w * nl;
  // Translucency glow: back-lit blades pass a little sun through.
  let trans = pow(max(dot(-v, -u.lightDir.xyz), 0.0), 2.0) * in.t;
  rgb += albedo * u.sunCol.rgb * u.sunCol.w * trans * 0.5;
  if (u.params.z > 0.5) {
    let f = smoothstep(u.params.x, u.params.y, distance(u.camPos.xyz, in.world));
    rgb = mix(rgb, u.fogColor.rgb, f);
  }
  return vec4f(rgb, 1.0);
}
`;
}
function cardRenderWGSL() {
	return `
${GRASS_UNIFORM}
${LIGHTING_WGSL}
struct Card { posH: vec4f, sw: vec4f, col: vec4f }
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<uniform> g: GU;
@group(0) @binding(2) var<storage, read> cards: array<Card>;
@group(0) @binding(3) var cardTex: texture_2d_array<f32>;
@group(0) @binding(4) var cardSamp: sampler;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) world: vec3f,
  @location(2) color: vec3f,
  @location(3) fade: f32,
  @location(4) up: f32,
  @location(5) @interpolate(flat) frame: u32,
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let c = cards[ii];
  let side = f32(vi & 1u) * 2.0 - 1.0;   // -1 / +1 across
  let up = f32(vi >> 1u);                // 0 base / 1 top
  // Y-axis billboard: right vector is the camera's right flattened to level.
  let right = normalize(vec3f(u.right.x, 0.0, u.right.z) + vec3f(1e-4, 0.0, 0.0));
  // Wind: the top of the card leans with the same travelling gust as blades.
  let travel = sin(dot(c.posH.xz, g.wind.xy) * 0.35 - g.camPos.w * 1.3);
  let windDir = normalize(g.wind.xy + vec2f(1e-4, 0.0));
  let sway = travel * g.wind.z * c.posH.w * 0.18 * up;
  let world = c.posH.xyz + right * c.sw.x * side
    + vec3f(0.0, c.posH.w * up, 0.0)
    + vec3f(windDir.x, 0.0, windDir.y) * sway;
  var out: VSOut;
  out.pos = u.viewProj * vec4f(world, 1.0);
  out.uv = vec2f(side * 0.5 + 0.5, 1.0 - up);
  out.world = world;
  out.color = c.col.rgb;
  out.fade = c.sw.z;
  out.up = up;
  out.frame = u32(c.sw.w + 0.5);
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let tex = textureSample(cardTex, cardSamp, in.uv, i32(in.frame));
  // HARD alpha test (binary in/out per pixel), NOT alpha-to-coverage: a2c
  // resolves a partial-coverage silhouette edge as a blend with whatever's
  // behind it, which lit up as a bright halo against the dusk horizon (Rich).
  // The fade dither a2c replaced is gone anyway now that cards are eternal
  // (fade is always 1), so a hard test is both correct and halo-free.
  if (tex.a < 0.5) { discard; }
  var albedo: vec3f;
  if (in.frame == 0u) {
    // GRASS clump (frame 0): texture is SHAPE only; colour is the terrain-
    // coherent tint with a root->tip gradient like the blades. dryness warms
    // it toward straw-yellow (luminance-preserving) for a dry/hay field.
    var col = in.color * mix(0.55, 1.2, in.up);
    let luma = dot(col, vec3f(0.3333));
    albedo = mix(col, luma * vec3f(1.35, 1.12, 0.5), g.veg.w);
  } else {
    // FLOWER clump (frame 1..): the procedural texture RGB IS the albedo — the
    // petal colours. It's albedo (not baked shading), so ambient+sun light it
    // like any surface and the colour pops instead of crushing to black.
    albedo = tex.rgb;
  }
  // Same ambient + sun as the blades, NO cascade shadow (grass never samples
  // the camera-following shadow box).
  // IDENTICAL wrap-lit formula to the blades (up normal, half-Lambert wrap)
  // so cards and blades are brightness twins under any sun angle.
  let n = vec3f(0.0, 1.0, 0.0);
  let ambient = mix(u.ambGround.rgb, u.ambSky.rgb, n.y * 0.35 + 0.65) * u.fogColor.a;
  let nl = clamp((dot(n, -u.lightDir.xyz) + 0.5) / 1.5, 0.0, 1.0);
  var rgb = albedo * ambient + albedo * u.sunCol.rgb * u.sunCol.w * nl;
  if (u.params.z > 0.5) {
    let f = smoothstep(u.params.x, u.params.y, distance(u.camPos.xyz, in.world));
    rgb = mix(rgb, u.fogColor.rgb, f);
  }
  return vec4f(rgb, 1.0);
}
`;
}
/** A follow-window grass field bound to one terrain. */
var Grass3d = class {
	field;
	colormapView;
	sampler;
	format;
	sampleCount;
	lightsLayout;
	device;
	computePipeline;
	renderPipeline;
	uniformBuf;
	bladeBuf;
	/** Draw the near GEOMETRY BLADES (default true). Live toggle — mostly for
	* the debug bench, where you want to see one layer in isolation. */
	showBlades = true;
	/** Draw the far BILLBOARD CARDS (default true). The cards are ETERNAL (they
	* exist independent of `dynamic`, which only sets the near blade↔card mix),
	* so this flag is the ONLY way to actually turn the card layer off. */
	showCards = true;
	argsBuf;
	heightTex;
	computeBind;
	renderBind;
	computeLayout;
	renderLayout;
	cardComputePipeline;
	cardRenderPipeline;
	cardBuf;
	cardArgs;
	cardTex;
	cardComputeBind;
	cardRenderBind;
	cardRenderLayout;
	span;
	cells;
	capacity;
	height;
	width;
	windDir;
	windStr;
	dynamic;
	groundTint;
	/** Forward window bias (0 = disc). Live-mutable — the debug bench drives it. */
	viewBias;
	/** cos(fanAngle/2); ≤ -1 means "no angular cull" (full disc). Live-mutable. */
	fanCos;
	green;
	farSpan;
	farCells;
	cardCap;
	cardW;
	cardH;
	/** Number of flower-cluster frames baked into the card array (0 = none). The
	* card texture holds 1 grass frame + this many flower frames. Baked at build,
	* so changing it needs a rebuild. */
	flowerCount;
	/** Total card-texture array frames (1 grass + flowerCount). Set by
	* makeCardTexture; carried to the shaders in veg.x. */
	cardFrames = 1;
	/** Fraction of the field that flowers (0 = none, ~0.3 = generous drifts).
	* Gated by low-frequency noise so blooms cluster. Live-mutable (veg.z). */
	flowerAmount = 0;
	/** Straw/hay recolour 0..1 — warms blades AND grass cards toward golden dry
	* grass, luminance-preserving. Live-mutable (veg.w). */
	dryness = 0;
	uni = /* @__PURE__ */ new Float32Array(52);
	constructor(field, colormapView, sampler, format, sampleCount, lightsLayout, opts = {}) {
		this.field = field;
		this.colormapView = colormapView;
		this.sampler = sampler;
		this.format = format;
		this.sampleCount = sampleCount;
		this.lightsLayout = lightsLayout;
		this.span = opts.span ?? 44;
		this.cells = opts.cells ?? 320;
		this.capacity = this.cells * this.cells;
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
		this.farCells = opts.farCells ?? 300;
		this.cardCap = this.farCells * this.farCells;
		this.cardW = opts.cardWidth ?? .7;
		this.cardH = opts.cardHeight ?? this.height;
		this.flowerCount = Math.max(0, Math.round(opts.flowers ?? 0));
		this.viewBias = opts.viewBias ?? 0;
		const fan = opts.fanAngle ?? 360;
		this.fanCos = fan >= 360 ? -2 : Math.cos(fan * .5 * Math.PI / 180);
	}
	/** Re-point at the terrain colormap (its view changes on device-loss). */
	setColormap(view) {
		this.colormapView = view;
	}
	rebuild(device, lightsLayout) {
		this.device = device;
		if (lightsLayout) this.lightsLayout = lightsLayout;
		const dim = this.field.res + 1;
		this.heightTex = device.createTexture({
			size: {
				width: dim,
				height: dim
			},
			format: "r32float",
			usage: BITS.TEXTURE_BINDING | 2
		});
		device.queue.writeTexture({ texture: this.heightTex }, this.field.heights, { bytesPerRow: dim * 4 }, {
			width: dim,
			height: dim
		});
		this.cardTex = this.makeCardTexture(device);
		this.uniformBuf = device.createBuffer({
			size: this.uni.byteLength,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.bladeBuf = device.createBuffer({
			size: this.capacity * BLADE_FLOATS * 4,
			usage: BITS.STORAGE
		});
		this.argsBuf = device.createBuffer({
			size: 16,
			usage: BITS.STORAGE | BITS.INDIRECT | BITS.COPY_DST
		});
		device.queue.writeBuffer(this.argsBuf, 0, new Uint32Array([
			BLADE_VERTS,
			0,
			0,
			0
		]));
		this.cardBuf = device.createBuffer({
			size: this.cardCap * BLADE_FLOATS * 4,
			usage: BITS.STORAGE
		});
		this.cardArgs = device.createBuffer({
			size: 16,
			usage: BITS.STORAGE | BITS.INDIRECT | BITS.COPY_DST
		});
		device.queue.writeBuffer(this.cardArgs, 0, new Uint32Array([
			4,
			0,
			0,
			0
		]));
		this.computeLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_COMPUTE,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_COMPUTE,
				buffer: { type: "storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_COMPUTE,
				buffer: { type: "storage" }
			},
			{
				binding: 3,
				visibility: BITS.STAGE_COMPUTE,
				texture: { sampleType: "unfilterable-float" }
			},
			{
				binding: 4,
				visibility: BITS.STAGE_COMPUTE,
				texture: {}
			},
			{
				binding: 5,
				visibility: BITS.STAGE_COMPUTE,
				sampler: {}
			}
		] });
		this.renderLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			}
		] });
		this.cardRenderLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 3,
				visibility: BITS.STAGE_FRAGMENT,
				texture: { viewDimension: "2d-array" }
			},
			{
				binding: 4,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			}
		] });
		this.computePipeline = device.createComputePipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.computeLayout] }),
			compute: {
				module: shaderModule(device, bladeComputeWGSL(), "Grass3d blade compute"),
				entryPoint: "cs"
			}
		});
		this.cardComputePipeline = device.createComputePipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.computeLayout] }),
			compute: {
				module: shaderModule(device, cardComputeWGSL(), "Grass3d card compute"),
				entryPoint: "csCards"
			}
		});
		const rmod = shaderModule(device, renderWGSL(), "Grass3d render");
		this.renderPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.renderLayout, this.lightsLayout] }),
			vertex: {
				module: rmod,
				entryPoint: "vs"
			},
			fragment: {
				module: rmod,
				entryPoint: "fs",
				targets: [{ format: this.format }]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-strip",
				cullMode: "none"
			},
			multisample: { count: this.sampleCount }
		});
		const cmod = shaderModule(device, cardRenderWGSL(), "Grass3d card render");
		this.cardRenderPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.cardRenderLayout, this.lightsLayout] }),
			vertex: {
				module: cmod,
				entryPoint: "vs"
			},
			fragment: {
				module: cmod,
				entryPoint: "fs",
				targets: [{ format: this.format }]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-strip",
				cullMode: "none"
			},
			multisample: { count: this.sampleCount }
		});
		this.computeBind = device.createBindGroup({
			layout: this.computeLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniformBuf }
				},
				{
					binding: 1,
					resource: { buffer: this.bladeBuf }
				},
				{
					binding: 2,
					resource: { buffer: this.argsBuf }
				},
				{
					binding: 3,
					resource: this.heightTex.createView()
				},
				{
					binding: 4,
					resource: this.colormapView
				},
				{
					binding: 5,
					resource: this.sampler
				}
			]
		});
		this.cardComputeBind = device.createBindGroup({
			layout: this.computeLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniformBuf }
				},
				{
					binding: 1,
					resource: { buffer: this.cardBuf }
				},
				{
					binding: 2,
					resource: { buffer: this.cardArgs }
				},
				{
					binding: 3,
					resource: this.heightTex.createView()
				},
				{
					binding: 4,
					resource: this.colormapView
				},
				{
					binding: 5,
					resource: this.sampler
				}
			]
		});
		if (this.worldUniforms) this.buildRenderBind();
	}
	/**
	* The grass-CLUMP billboard texture — a tuft of blades drawn once into a
	* mip-mapped RGBA texture (alpha = the clump silhouette). Cards sample this;
	* mips keep the far field from aliasing on the alpha edges.
	*/
	makeCardTexture(device) {
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
		return this.makeArrayTexture(device, layers, S);
	}
	/** The grass CLUMP — a tuft of sharp blade silhouettes (alpha = the clump
	* shape; the render tints it, so the RGB here is only a mip-safe fallback). */
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
	/** A FLOWER cluster — a few grass blades so it sits in the meadow, thin green
	* stems, and 3–6 bright bloom heads near the top. Unlike the grass clump the
	* render uses this RGB directly as albedo, so the petal colours ARE the look.
	* `variant` cycles the palette (poppy / daisy / cornflower / buttercup / …). */
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
	/**
	* Build a mip-mapped RGBA-srgb **2d-array** texture from N equal-size (S×S)
	* level-0 layers (box-filtered mips per layer — WebGPU has no auto-gen). One
	* layer → a plain clump; many → grass + flower frames the cards index into.
	*/
	makeArrayTexture(device, layers, S) {
		const mipCount = Math.floor(Math.log2(S)) + 1;
		const tex = device.createTexture({
			size: {
				width: S,
				height: S,
				depthOrArrayLayers: layers.length
			},
			format: "rgba8unorm-srgb",
			mipLevelCount: mipCount,
			usage: BITS.TEXTURE_BINDING | 2
		});
		layers.forEach((lvl0, layer) => {
			device.queue.writeTexture({
				texture: tex,
				mipLevel: 0,
				origin: {
					x: 0,
					y: 0,
					z: layer
				}
			}, lvl0, {
				bytesPerRow: S * 4,
				rowsPerImage: S
			}, {
				width: S,
				height: S
			});
			let prev = lvl0, pw = S;
			for (let m = 1; m < mipCount; m++) {
				const w = Math.max(1, pw >> 1);
				const cur = new Uint8Array(w * w * 4);
				for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
					const sx = x * 2, sy = y * 2;
					for (let ch = 0; ch < 4; ch++) {
						const s = (yy, xx) => prev[(Math.min(yy, pw - 1) * pw + Math.min(xx, pw - 1)) * 4 + ch];
						cur[(y * w + x) * 4 + ch] = s(sy, sx) + s(sy, sx + 1) + s(sy + 1, sx) + s(sy + 1, sx + 1) + 2 >> 2;
					}
				}
				device.queue.writeTexture({
					texture: tex,
					mipLevel: m,
					origin: {
						x: 0,
						y: 0,
						z: layer
					}
				}, cur, {
					bytesPerRow: w * 4,
					rowsPerImage: w
				}, {
					width: w,
					height: w
				});
				prev = cur;
				pw = w;
			}
		});
		return tex;
	}
	buildRenderBind() {
		this.renderBind = this.device.createBindGroup({
			layout: this.renderLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.worldUniforms }
				},
				{
					binding: 1,
					resource: { buffer: this.uniformBuf }
				},
				{
					binding: 2,
					resource: { buffer: this.bladeBuf }
				}
			]
		});
		this.cardRenderBind = this.device.createBindGroup({
			layout: this.cardRenderLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.worldUniforms }
				},
				{
					binding: 1,
					resource: { buffer: this.uniformBuf }
				},
				{
					binding: 2,
					resource: { buffer: this.cardBuf }
				},
				{
					binding: 3,
					resource: this.cardTex.createView({ dimension: "2d-array" })
				},
				{
					binding: 4,
					resource: this.sampler
				}
			]
		});
	}
	worldUniforms = null;
	/** world3d hands its shared mesh-uniform buffer in (the U block). */
	setWorldUniforms(buf) {
		if (this.worldUniforms === buf && this.renderBind) return;
		this.worldUniforms = buf;
		if (this.device) this.buildRenderBind();
	}
	/** Encode this frame's spawn: zero the count, then one thread per cell. */
	compute(encoder, viewProj, camX, camY, camZ, time, fwdX = 0, fwdZ = 0) {
		const u = this.uni;
		for (let i = 0; i < 16; i++) u[i] = viewProj[i];
		u[16] = camX;
		u[17] = camY;
		u[18] = camZ;
		u[19] = time;
		u[20] = this.span / this.cells;
		u[21] = this.cells;
		u[22] = this.span * .5;
		u[23] = this.field.baseY;
		u[24] = this.field.size;
		u[25] = this.field.res;
		u[26] = this.groundTint;
		u[27] = this.dynamic;
		u[28] = Math.sin(this.windDir);
		u[29] = Math.cos(this.windDir);
		u[30] = this.windStr;
		u[31] = 0;
		u[32] = this.height;
		u[33] = this.width;
		u[34] = this.cardW;
		u[35] = this.cardH;
		u[36] = this.green[0];
		u[37] = this.green[1];
		u[38] = this.green[2];
		u[39] = 0;
		u[40] = this.farSpan / this.farCells;
		u[41] = this.farCells;
		u[42] = this.farSpan * .5;
		u[43] = this.span * .5;
		const fl = Math.hypot(fwdX, fwdZ) || 1;
		u[44] = fwdX / fl;
		u[45] = fwdZ / fl;
		u[46] = this.viewBias;
		u[47] = this.fanCos;
		u[48] = this.cardFrames;
		u[49] = this.flowerCount;
		u[50] = this.flowerAmount;
		u[51] = this.dryness;
		this.device.queue.writeBuffer(this.uniformBuf, 0, u.buffer, 0, u.byteLength);
		encoder.clearBuffer(this.argsBuf, 4, 4);
		encoder.clearBuffer(this.cardArgs, 4, 4);
		const pass = encoder.beginComputePass();
		pass.setPipeline(this.computePipeline);
		pass.setBindGroup(0, this.computeBind);
		pass.dispatchWorkgroups(Math.ceil(this.capacity / WG));
		pass.setPipeline(this.cardComputePipeline);
		pass.setBindGroup(0, this.cardComputeBind);
		pass.dispatchWorkgroups(Math.ceil(this.cardCap / WG));
		pass.end();
	}
	/** Draw the field — far billboard cards first (behind), then near blades.
	* Two drawIndirect calls, both lit like the terrain. */
	render(pass, lightsBind) {
		if (!this.renderBind) return;
		if (this.showCards) {
			pass.setPipeline(this.cardRenderPipeline);
			pass.setBindGroup(0, this.cardRenderBind);
			pass.setBindGroup(1, lightsBind);
			pass.drawIndirect(this.cardArgs, 0);
		}
		if (this.showBlades) {
			pass.setPipeline(this.renderPipeline);
			pass.setBindGroup(0, this.renderBind);
			pass.setBindGroup(1, lightsBind);
			pass.drawIndirect(this.argsBuf, 0);
		}
	}
	destroy() {
		this.uniformBuf?.destroy();
		this.bladeBuf?.destroy();
		this.argsBuf?.destroy();
		this.cardBuf?.destroy();
		this.cardArgs?.destroy();
		this.cardTex?.destroy();
		this.heightTex?.destroy();
	}
};
//#endregion
//#region src/lib/flare3d.ts
var N_ELEMS = 8;
function flareWGSL(ms) {
	return `
// Per element: (t along sun->centre axis, size px, type, alpha)
const EA = array<vec4f, ${N_ELEMS}>(
  vec4f(0.0, 150.0, 2.0, 0.42),   // anamorphic streak
  vec4f(0.0, 52.0, 0.0, 0.75),    // core glow
  vec4f(0.0, 105.0, 1.0, 0.2),    // halo ring
  vec4f(0.32, 20.0, 3.0, 0.28),   // ghost chain...
  vec4f(0.52, 10.0, 3.0, 0.24),
  vec4f(0.78, 30.0, 3.0, 0.18),
  vec4f(1.22, 46.0, 0.0, 0.14),   // ...through the centre
  vec4f(1.55, 16.0, 3.0, 0.2),
);
const EC = array<vec4f, ${N_ELEMS}>(
  vec4f(1.0, 0.95, 0.85, 0.0),
  vec4f(1.0, 0.97, 0.9, 0.0),
  vec4f(1.0, 0.85, 0.65, 0.0),
  vec4f(0.65, 1.0, 0.75, 0.0),
  vec4f(0.6, 0.85, 1.0, 0.0),
  vec4f(0.85, 0.65, 1.0, 0.0),
  vec4f(1.0, 0.8, 0.6, 0.0),
  vec4f(0.6, 1.0, 0.95, 0.0),
);

struct FU {
  sun: vec4f,   // sun ndc x, y, visibility, unused
  scr: vec4f,   // screenW, screenH, sunPxX, sunPxY
  color: vec4f, // sun rgb + unused
}
@group(0) @binding(0) var<uniform> fu: FU;
@group(0) @binding(1) ${ms ? "var depthTex: texture_depth_multisampled_2d;" : "var depthTex: texture_depth_2d;"}

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) kind: f32,
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  var corners = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(1.0, -1.0), vec2f(-1.0, 1.0),
    vec2f(-1.0, 1.0), vec2f(1.0, -1.0), vec2f(1.0, 1.0),
  );
  let e = EA[ii];
  // OCCLUSION: how much of a 3x3 patch around the sun's pixel is SKY.
  var occ = 0.0;
  for (var oy = -1; oy <= 1; oy = oy + 1) {
    for (var ox = -1; ox <= 1; ox = ox + 1) {
      let px = vec2i(
        clamp(i32(fu.scr.z) + ox * 7, 0, i32(fu.scr.x) - 1),
        clamp(i32(fu.scr.w) + oy * 7, 0, i32(fu.scr.y) - 1),
      );
      occ += step(0.99995, textureLoad(depthTex, px, 0));
    }
  }
  occ /= 9.0;
  let vis = fu.sun.z * occ;
  let c = corners[vi];
  // Position: slide along the sun -> screen-centre axis by the element's t.
  let anchor = fu.sun.xy * (1.0 - e.x);
  var half = vec2f(e.y / fu.scr.x * 2.0, e.y / fu.scr.y * 2.0);
  if (e.z > 1.5 && e.z < 2.5) { half.x *= 6.0; half.y *= 0.55; }   // streak
  var out: VSOut;
  out.pos = vec4f(anchor + c * half * step(0.001, vis), 0.0, 1.0);
  out.uv = c;
  out.color = vec4f(EC[ii].rgb * fu.color.rgb, e.w * vis);
  out.kind = e.z;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let r = length(in.uv);
  var a = 0.0;
  if (in.kind < 0.5) {                                   // soft glow disc
    a = pow(smoothstep(1.0, 0.0, r), 2.2);
  } else if (in.kind < 1.5) {                            // halo ring
    a = smoothstep(0.16, 0.0, abs(r - 0.7));
  } else if (in.kind < 2.5) {                            // anamorphic streak
    a = pow(max(1.0 - abs(in.uv.x), 0.0), 1.7) * pow(max(1.0 - abs(in.uv.y), 0.0), 2.5);
  } else {                                               // ghost disc
    a = smoothstep(1.0, 0.45, r) * (0.75 + 0.25 * smoothstep(0.0, 0.4, r));
  }
  let al = a * in.color.a;
  return vec4f(in.color.rgb * al, al);
}
`;
}
/** GPU plumbing — owned by World3d, drawn at the very end of pass B
* (over the particles: flares are ON the lens). */
var Flare3dLayer = class {
	format;
	sampleCount;
	msDepth;
	device;
	pipeline;
	layout;
	buf;
	bind = null;
	depthView = null;
	data = /* @__PURE__ */ new Float32Array(12);
	visible = false;
	constructor(device, format, sampleCount, msDepth) {
		this.format = format;
		this.sampleCount = sampleCount;
		this.msDepth = msDepth;
		this.rebuild(device);
	}
	rebuild(device) {
		this.device = device;
		this.bind = null;
		this.depthView = null;
		this.buf = device.createBuffer({
			size: this.data.byteLength,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		const module = shaderModule(device, flareWGSL(this.msDepth), "flare3d");
		this.layout = device.createBindGroupLayout({ entries: [{
			binding: 0,
			visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
			buffer: { type: "uniform" }
		}, {
			binding: 1,
			visibility: GPUShaderStage.VERTEX,
			texture: {
				sampleType: "depth",
				multisampled: this.msDepth
			}
		}] });
		this.pipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
			vertex: {
				module,
				entryPoint: "vs"
			},
			fragment: {
				module,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "one",
							dstFactor: "one"
						},
						alpha: {
							srcFactor: "zero",
							dstFactor: "one"
						}
					}
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: false,
				depthCompare: "always"
			},
			primitive: { topology: "triangle-list" },
			multisample: { count: this.sampleCount }
		});
	}
	/** Per-frame uniforms. `vis` already carries night/storm/off-screen fade. */
	update(sunNdcX, sunNdcY, vis, color, screenW, screenH, depthView) {
		this.visible = vis > .002;
		if (!this.visible) return;
		if (depthView !== this.depthView || !this.bind) {
			this.depthView = depthView;
			this.bind = this.device.createBindGroup({
				layout: this.layout,
				entries: [{
					binding: 0,
					resource: { buffer: this.buf }
				}, {
					binding: 1,
					resource: depthView
				}]
			});
		}
		const px = (sunNdcX * .5 + .5) * screenW;
		const py = (.5 - sunNdcY * .5) * screenH;
		const d = this.data;
		d.set([
			sunNdcX,
			sunNdcY,
			vis,
			0
		], 0);
		d.set([
			screenW,
			screenH,
			px,
			py
		], 4);
		d.set([
			color[0],
			color[1],
			color[2],
			0
		], 8);
		this.device.queue.writeBuffer(this.buf, 0, d);
	}
	draw(pass) {
		if (!this.visible || !this.bind) return;
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		pass.draw(6, N_ELEMS);
	}
};
//#endregion
//#region src/lib/beam3d.ts
var SEGS = 40;
var VERTS = SEGS * 3;
var U_FLOATS = 24;
var INST_FLOATS = 12;
function beamWGSL(ms) {
	return `
const SEGS = ${SEGS}u;
const TAU = 6.2831853;

struct U {
  viewProj: mat4x4f,
  camPos: vec4f,
  lin: vec4f,          // projA, projB, softDist, unused  (viewDist = projB/(projA+depth))
}
struct Inst {
  apex: vec4f,         // x, y, z, length
  axis: vec4f,         // dir xyz (normalised on CPU), base radius
  color: vec4f,        // rgb, intensity (additive core strength)
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) ${ms ? "var depthTex: texture_depth_multisampled_2d;" : "var depthTex: texture_depth_2d;"}

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec3f,
  @location(1) nrm: vec3f,
  @location(2) axial: f32,        // 0 at the lamp (apex) → 1 at the base
  @location(3) viewDist: f32,     // linear eye distance of this fragment
  @location(4) color: vec4f,      // rgb + intensity
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let b = inst[ii];
  let seg = vi / 3u;
  let corner = vi % 3u;
  let apex = b.apex.xyz;
  let L = b.apex.w;
  let axis = normalize(b.axis.xyz);
  let R = b.axis.w;
  // An orthonormal basis across the axis (guard the near-parallel up vector).
  var up = vec3f(0.0, 1.0, 0.0);
  if (abs(axis.y) > 0.99) { up = vec3f(1.0, 0.0, 0.0); }
  let uu = normalize(cross(up, axis));
  let vv = cross(axis, uu);
  let baseC = apex + axis * L;
  let a0 = f32(seg) / f32(SEGS) * TAU;
  let a1 = f32(seg + 1u) / f32(SEGS) * TAU;

  var world: vec3f;
  var axial: f32;
  var nrm: vec3f;
  if (corner == 0u) {
    world = apex;
    axial = 0.0;
    let am = (a0 + a1) * 0.5;                       // mid radial for the apex vertex
    nrm = cos(am) * uu + sin(am) * vv;
  } else {
    let ang = select(a0, a1, corner == 2u);
    let radial = cos(ang) * uu + sin(ang) * vv;
    world = baseC + radial * R;
    axial = 1.0;
    // Cone side normal: radial tilted toward the apex by the slope R/L.
    nrm = normalize(radial * L - axis * R);
  }
  var out: VSOut;
  out.pos = u.viewProj * vec4f(world, 1.0);
  out.world = world;
  out.nrm = nrm;
  out.axial = axial;
  out.viewDist = out.pos.w;                          // clip w = linear eye distance
  out.color = b.color;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let V = normalize(u.camPos.xyz - in.world);
  let N = normalize(in.nrm);
  // Bright down the CORE, soft at the silhouette: |N·V| ~1 where a wall faces
  // the eye (the middle of the cone, near + far walls both adding), ~0 grazing.
  let face = abs(dot(N, V));
  var a = in.color.a * face * face;
  // Fade along the shaft (brightest at the lamp) and soften the exact apex.
  a *= mix(1.0, 0.16, in.axial);
  a *= smoothstep(0.0, 0.06, in.axial);
  // SOFT DEPTH FADE — dissolve as the shaft nears a solid (no cut-through).
  let d = textureLoad(depthTex, vec2i(in.pos.xy), 0);
  if (d < 1.0) {
    let sceneDist = u.lin.y / (u.lin.x + d);
    a *= clamp((sceneDist - in.viewDist) / max(u.lin.z, 0.001), 0.0, 1.0);
  }
  // Premultiplied additive: alpha channel 0 keeps the blend purely additive.
  return vec4f(in.color.rgb * a, 0.0);
}
`;
}
/** GPU plumbing for the spotlight beams — owned by World3d, drawn in pass B. */
var Beam3dLayer = class {
	format;
	sampleCount;
	msDepth;
	device;
	pipeline;
	layout;
	ubuf;
	ibuf;
	bind = null;
	depthView = null;
	udata = new Float32Array(U_FLOATS);
	idata = new Float32Array(64 * INST_FLOATS);
	count = 0;
	constructor(device, format, sampleCount, msDepth) {
		this.format = format;
		this.sampleCount = sampleCount;
		this.msDepth = msDepth;
		this.rebuild(device);
	}
	rebuild(device) {
		this.device = device;
		this.bind = null;
		this.depthView = null;
		this.ubuf = device.createBuffer({
			size: U_FLOATS * 4,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.ibuf = device.createBuffer({
			size: this.idata.byteLength,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		const module = shaderModule(device, beamWGSL(this.msDepth), "beam3d");
		this.layout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: "depth",
					multisampled: this.msDepth
				}
			}
		] });
		this.pipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
			vertex: {
				module,
				entryPoint: "vs"
			},
			fragment: {
				module,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "one",
							dstFactor: "one"
						},
						alpha: {
							srcFactor: "zero",
							dstFactor: "one"
						}
					}
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: false,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "none"
			},
			multisample: { count: this.sampleCount }
		});
	}
	/**
	* Pack one instance per live beam and refresh the uniform. `beams` are the
	* light + its beam config; the geometry follows the light's pose/dir/cone
	* every frame. projA/projB linearise the sampled depth (see World3d.projInfo).
	*/
	update(beams, viewProj, camX, camY, camZ, projA, projB, softDist, depthView) {
		this.count = 0;
		if (!beams.length) return;
		if (beams.length * INST_FLOATS > this.idata.length) {
			let len = this.idata.length;
			while (len < beams.length * INST_FLOATS) len *= 2;
			this.idata = new Float32Array(len);
			this.ibuf.destroy();
			this.ibuf = this.device.createBuffer({
				size: this.idata.byteLength,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
			this.bind = null;
		}
		for (const b of beams) {
			const l = b.light;
			const len = b.opts.length ?? l.radius;
			const dl = Math.hypot(l.dir.x, l.dir.y, l.dir.z) || 1;
			const R = len * Math.tan(Math.min(1.45, Math.max(.01, l.cone.outer)));
			const c = b.opts.rgb;
			const o = this.count * INST_FLOATS;
			const d = this.idata;
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
			this.count++;
		}
		const u = this.udata;
		u.set(viewProj, 0);
		u[16] = camX;
		u[17] = camY;
		u[18] = camZ;
		u[19] = 0;
		u[20] = projA;
		u[21] = projB;
		u[22] = softDist;
		u[23] = 0;
		this.device.queue.writeBuffer(this.ubuf, 0, u);
		this.device.queue.writeBuffer(this.ibuf, 0, this.idata.buffer, 0, this.count * INST_FLOATS * 4);
		if (depthView !== this.depthView || !this.bind) {
			this.depthView = depthView;
			this.bind = this.device.createBindGroup({
				layout: this.layout,
				entries: [
					{
						binding: 0,
						resource: { buffer: this.ubuf }
					},
					{
						binding: 1,
						resource: { buffer: this.ibuf }
					},
					{
						binding: 2,
						resource: depthView
					}
				]
			});
		}
	}
	draw(pass) {
		if (!this.count || !this.bind) return;
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		pass.draw(VERTS, this.count);
	}
};
//#endregion
//#region src/lib/world3d.ts
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
	/** PBR params (metallic 0..1; rough overrides the gloss mapping). */
	metallic;
	rough;
	/** Atlas frame texturing the surface (-1 = untextured flat colour). */
	texture;
	/** Normal map frame (-1 = none). */
	normalMap;
	tile;
	bump;
	/** Self-illumination (0 = none) — see Mesh3dConfig.emissive. */
	emissive;
	/** Close-range ground-grain strength (0 = off; terrain chunks set 1). */
	grain;
	/** Blob-shadow override (see Mesh3dConfig.blob). */
	blob;
	/** Static (GPU-culled) — see Mesh3dConfig.static. */
	static;
	/** @internal VS-skinning palette slice base (mat4 units). */
	paletteBase = 0;
	/** Parent (Group3d / Mesh3d) — pose becomes local to it. Live-mutable. */
	parent;
	/** OPT-IN to picking: world.pick() only ever returns meshes with this set
	* (default false — nothing is clickable by accident). A Model3d exposes the
	* same flag, fanning it out to all its parts. Live-mutable. */
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
/** @deprecated alias — boxes are just meshes now. */
var Box3d = Mesh3d;
/**
* A pure TRANSFORM NODE (renders nothing): parent meshes/models/groups to it
* and drive the whole assembly by mutating one handle — turrets, windmills,
* orbit systems, attachment points. Chains nest (group → group → mesh).
*/
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
/** A retained camera-facing sprite — mutate fields freely; kill() removes it. */
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
/**
* A single soft contact-shadow ellipse, decoupled from any mesh. Parent one to
* an ASSEMBLY group (chair, desk, bed) and it drops ONE clean blob for the
* whole thing — where the per-mesh auto blobs would otherwise stack into a
* messy cluster (set `blob:false` on the parts, or scope auto blobs off). It
* only ever draws while blob shadows are enabled, so nothing to hide. Mutate
* fields freely; kill() removes it.
*/
var BlobShadow3d = class {
	x;
	y;
	z;
	w;
	d;
	yaw;
	/** Base opacity, or null to inherit world.blobs.alpha. */
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
var CULL_WGSL = `
struct CU {
  planes: array<vec4f, 12>,   // 6 camera + 6 shadow (zeroed when off)
  flags: vec4f,               // x shadowOn
}
struct GeoInfo { counts: vec4f }   // x instanceCount (per bucket)
struct Inst {
  pos: vec4f, size: vec4f, color: vec4f, rot: vec4f,
  texRect: vec4f, normRect: vec4f, extra: vec4f,
}
struct Indirect { vertexCount: u32, instanceCount: atomic<u32>, firstVertex: u32, firstInstance: u32 }
@group(0) @binding(0) var<uniform> cu: CU;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var<storage, read_write> visIdx: array<u32>;
@group(0) @binding(3) var<storage, read_write> indirect: Indirect;
@group(0) @binding(4) var<uniform> geoInfo: GeoInfo;

fn inVolume(base: u32, p: vec3f, r: f32) -> bool {
  for (var k = 0u; k < 6u; k = k + 1u) {
    let pl = cu.planes[base + k];
    if (dot(pl.xyz, p) + pl.w < -r) { return false; }
  }
  return true;
}

@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) gid: vec3u) {
  let i = gid.x;
  if (i >= u32(geoInfo.counts.x)) { return; }
  let d = inst[i];
  let r = 0.55 * length(d.size.xyz);
  var vis = inVolume(0u, d.pos.xyz, r);
  if (!vis && cu.flags.x > 0.5) { vis = inVolume(6u, d.pos.xyz, r); }
  if (vis) {
    let slot = atomicAdd(&indirect.instanceCount, 1u);
    visIdx[slot] = i;
  }
}
`;
function staticVariant(src, visBinding) {
	return "@group(0) @binding(" + visBinding + ") var<storage, read> visIdx: array<u32>;\n" + src.replace("let d = inst[ii];", "let d = inst[visIdx[ii]];");
}
function deformVariant(src) {
	return `
struct DU {
  win: vec4f,     // window centre x, z; 1/window; res
  under: vec4f,   // exposed under-layer rgb; rim strength
  fx: vec4f,      // sparkle, max carve depth, texel world size, sink cap
  pcut: vec4f,    // patch cut disc: centre x, z; radius; on (the high-poly
                  // snow layer REPLACES the base terrain inside this disc)
}
@group(0) @binding(7) var<uniform> du: DU;
@group(0) @binding(8) var deformTex: texture_2d<f32>;

// Carve depth at a world XZ — manual bilinear over texel centres, fading
// to 0 in the outer 6% of the window so trails dissolve (never pop) as
// the window scrolls away. DeformMap.depthAt is the exact CPU replica.
fn deformAt(wx: f32, wz: f32) -> f32 {
  let uu = (wx - du.win.x) * du.win.z + 0.5;
  let vv = (wz - du.win.y) * du.win.z + 0.5;
  let edge = min(min(uu, 1.0 - uu), min(vv, 1.0 - vv));
  if (edge <= 0.0) { return 0.0; }
  let g = vec2f(uu, vv) * du.win.w - 0.5;
  let g0 = floor(g);
  let f = g - g0;
  let hi = i32(du.win.w) - 1;
  let x0 = clamp(i32(g0.x), 0, hi); let x1 = clamp(i32(g0.x) + 1, 0, hi);
  let z0 = clamp(i32(g0.y), 0, hi); let z1 = clamp(i32(g0.y) + 1, 0, hi);
  let a = textureLoad(deformTex, vec2i(x0, z0), 0).r;
  let b = textureLoad(deformTex, vec2i(x1, z0), 0).r;
  let c = textureLoad(deformTex, vec2i(x0, z1), 0).r;
  let e = textureLoad(deformTex, vec2i(x1, z1), 0).r;
  let bi = mix(mix(a, b, f.x), mix(c, e, f.x), f.y);
  return bi * smoothstep(0.0, 0.06, edge);
}
` + src.replace("@location(7) bump: f32,", "@location(7) bump: f32,\n  @location(8) carve: f32,").replace("let world = rotate(vpos * d.size.xyz, d.pos.w, d.size.w, d.rot.x) + d.pos.xyz;", "var world = rotate(vpos * d.size.xyz, d.pos.w, d.size.w, d.rot.x) + d.pos.xyz;\n  let carve = deformAt(world.x, world.z);\n  world.y -= min(carve, du.fx.w);").replace("out.bump = d.extra.x;", "out.bump = d.extra.x;\n  out.carve = carve;").replace("let duv1 = dpdx(in.uv); let duv2 = dpdy(in.uv);", "let duv1 = dpdx(in.uv); let duv2 = dpdy(in.uv);\n  if (du.pcut.w > 0.5 && distance(in.world.xz, du.pcut.xy) < du.pcut.z) { discard; }\n  let foot = (length(dp1.xz) + length(dp2.xz)) * 0.5;\n  let carveF = (deformAt(in.world.x, in.world.z)\n    + deformAt(in.world.x + dp1.x * 0.5, in.world.z + dp1.z * 0.5)\n    + deformAt(in.world.x - dp1.x * 0.5, in.world.z - dp1.z * 0.5)\n    + deformAt(in.world.x + dp2.x * 0.5, in.world.z + dp2.z * 0.5)\n    + deformAt(in.world.x - dp2.x * 0.5, in.world.z - dp2.z * 0.5)) * 0.2;\n  let te = max(max(du.fx.z, 1e-3), foot * 0.75);\n  let dcx = deformAt(in.world.x + te, in.world.z) - deformAt(in.world.x - te, in.world.z);\n  let dcz = deformAt(in.world.x, in.world.z + te) - deformAt(in.world.x, in.world.z - te);\n  n = normalize(n + vec3f(dcx, 0.0, dcz) * (du.under.w / (2.0 * te)));\n  let lodT = clamp(foot / (max(du.fx.z, 1e-3) * 3.0), 0.0, 1.0);\n  let trench = clamp(carveF / max(du.fx.y, 1e-4), 0.0, 1.0);\n  let tmix = smoothstep(mix(0.3, 0.02, lodT), mix(0.85, 0.3, lodT), trench);").replace("let albedo = in.color.rgb * t.rgb;", "let albedo = mix(in.color.rgb * t.rgb, du.under.rgb * (1.0 - 0.3 * trench), tmix * 0.95);").replace("  rgb += albedo * in.mr.z;", "  if (du.fx.x > 0.0) {\n    let sp = in.world.xz * 7.0;\n    let cell = floor(sp);\n    let hs = fract(sin(dot(cell, vec2f(127.1, 311.7))) * 43758.547);\n    let pnt = cell + vec2f(hs, fract(hs * 91.17));\n    let hv = normalize(v - u.lightDir.xyz);\n    let fac = pow(max(dot(n, hv), 0.0), 6.0);\n    let gl = smoothstep(0.16, 0.02, length(sp - pnt)) * step(0.6, fract(hs * 13.7)) * fac;\n    rgb += u.sunCol.rgb * u.sunCol.w * gl * du.fx.x * 2.2 * (1.0 - trench);\n  }\n  rgb += albedo * in.mr.z;");
}
var DEFORM_SURFACE_WGSL = `
struct U {
  viewProj: mat4x4f, camPos: vec4f, fogColor: vec4f, params: vec4f,
  lightDir: vec4f, right: vec4f, up: vec4f, ambSky: vec4f, ambGround: vec4f, sunCol: vec4f,
}
struct PU {
  region: vec4f,  // patchCx, patchCz, patchWin, cells
  win: vec4f,     // deform winCx, winCz, 1/deformWindow, deformRes
  terra: vec4f,   // terrainSize, terrainRes, cutR, maxDepth
  under: vec4f,   // exposed-under rgb, sparkle
  albedo: vec4f,  // surface roughness, berm lift, 0, sink cap
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<uniform> pu: PU;
@group(0) @binding(2) var baseTex: texture_2d<f32>;    // base heightfield (res+1)^2
@group(0) @binding(3) var deformTex: texture_2d<f32>;  // carve window
@group(0) @binding(4) var samp: sampler;
@group(0) @binding(5) var colormap: texture_2d<f32>;   // the terrain's band colormap
@group(0) @binding(6) var envTex: texture_2d<f32>;     // env equirect (IBL-lite)

// LIGHTING PARITY with the base terrain (group 1 = the shared lighting
// binds). The patch replaces the base inside its disc — ANY shading
// difference reads as a giant disc sliding over the mountain (Rich: "a
// big shadow following me"), so the sun term, shadows and env reflection
// below are copied VERBATIM from MESH_WGSL. Clustered locals are skipped
// (thin snow in the open; revisit for night scenes).
struct LU {
  view: mat4x4f,
  shadowVP: mat4x4f,
  params: vec4f,
  grid: vec4f,
  proj: vec4f,
  shadow: vec4f,
}
@group(1) @binding(0) var<uniform> lu: LU;
@group(1) @binding(1) var<storage, read> lights: array<vec4f>;
@group(1) @binding(2) var<storage, read> clusters: array<u32>;
@group(1) @binding(3) var shadowMap: texture_depth_2d;
@group(1) @binding(4) var shadowSamp: sampler_comparison;

fn pbrDirect(nrm: vec3f, v: vec3f, l: vec3f, albedo: vec3f, metallic: f32, rough: f32, radiance: vec3f) -> vec3f {
  let h = normalize(v + l);
  let NL = max(dot(nrm, l), 0.0);
  let NV = max(dot(nrm, v), 1e-4);
  let NH = max(dot(nrm, h), 0.0);
  let VH = max(dot(v, h), 0.0);
  let a2 = rough * rough * rough * rough;
  let dd2 = NH * NH * (a2 - 1.0) + 1.0;
  let D = a2 / (3.14159 * dd2 * dd2);
  let kk = (rough + 1.0) * (rough + 1.0) / 8.0;
  let G = (NV / (NV * (1.0 - kk) + kk)) * (NL / (NL * (1.0 - kk) + kk));
  let F0 = mix(vec3f(0.04), albedo, metallic);
  let F = F0 + (1.0 - F0) * pow(1.0 - VH, 5.0);
  let spec = D * G * F / (4.0 * NV * NL + 1e-4);
  let kd = (vec3f(1.0) - F) * (1.0 - metallic);
  return (kd * albedo / 3.14159 + spec) * NL * radiance;
}

const POISSON8 = array<vec2f, 8>(
  vec2f(-0.326, -0.406), vec2f(-0.840, -0.074), vec2f(-0.696, 0.457), vec2f(-0.203, 0.621),
  vec2f(0.962, -0.195), vec2f(0.473, -0.480), vec2f(0.519, 0.767), vec2f(0.185, -0.893),
);

fn shadowFactor(world: vec3f, nrm: vec3f) -> f32 {
  let NL = max(dot(nrm, -u.lightDir.xyz), 0.0);
  let slope = sqrt(max(1.0 - NL * NL, 0.0)) / max(NL, 0.15);
  let off = lu.shadow.w * min(1.0 + slope, 6.0);
  let sc = lu.shadowVP * vec4f(world + nrm * off, 1.0);
  let ndc = sc.xyz / sc.w;
  if (abs(ndc.x) >= 1.0 || abs(ndc.y) >= 1.0 || ndc.z <= 0.0 || ndc.z >= 1.0) { return 1.0; }
  let uv = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
  let refZ = ndc.z - lu.shadow.y;
  let h = fract(sin(dot(world, vec3f(12.9898, 78.233, 37.719))) * 43758.547);
  let ca = cos(h * 6.28318); let sa = sin(h * 6.28318);
  var sum = textureSampleCompareLevel(shadowMap, shadowSamp, uv, refZ);
  for (var i = 0; i < 8; i = i + 1) {
    let p = POISSON8[i] * (lu.shadow.z * 2.5);
    let r = vec2f(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
    sum += textureSampleCompareLevel(shadowMap, shadowSamp, uv + r, refZ);
  }
  return sum / 9.0;
}

// TRIANGLE-EXACT heightfield read: the same two-triangles-per-quad rule as
// Heightfield.heightAt and chunkVerts, so the patch surface lies ON the
// base mesh (not the bilinear approximation of it — mid-quad those differ,
// and that difference was part of the shimmering disc).
fn baseHeightAt(wx: f32, wz: f32) -> f32 {
  let res = pu.terra.y;
  let g = clamp(vec2f(wx / pu.terra.x + 0.5, wz / pu.terra.x + 0.5), vec2f(0.0), vec2f(1.0)) * res;
  let g0 = min(floor(g), vec2f(res - 1.0));
  let f = g - g0;
  let hi = i32(res);
  let x0 = clamp(i32(g0.x), 0, hi); let x1 = clamp(i32(g0.x) + 1, 0, hi);
  let z0 = clamp(i32(g0.y), 0, hi); let z1 = clamp(i32(g0.y) + 1, 0, hi);
  let a = textureLoad(baseTex, vec2i(x0, z0), 0).r;
  let b = textureLoad(baseTex, vec2i(x1, z0), 0).r;
  let c = textureLoad(baseTex, vec2i(x0, z1), 0).r;
  let dd = textureLoad(baseTex, vec2i(x1, z1), 0).r;
  if (f.x + f.y <= 1.0) { return a + (b - a) * f.x + (c - a) * f.y; }
  return dd + (c - dd) * (1.0 - f.x) + (b - dd) * (1.0 - f.y);
}
fn carveAt(wx: f32, wz: f32) -> f32 {
  let uu = (wx - pu.win.x) * pu.win.z + 0.5;
  let vv = (wz - pu.win.y) * pu.win.z + 0.5;
  let edge = min(min(uu, 1.0 - uu), min(vv, 1.0 - vv));
  if (edge <= 0.0) { return 0.0; }
  let g = vec2f(uu, vv) * pu.win.w - 0.5;
  let g0 = floor(g); let f = g - g0;
  let hi = i32(pu.win.w) - 1;
  let x0 = clamp(i32(g0.x), 0, hi); let x1 = clamp(i32(g0.x) + 1, 0, hi);
  let z0 = clamp(i32(g0.y), 0, hi); let z1 = clamp(i32(g0.y) + 1, 0, hi);
  let a = textureLoad(deformTex, vec2i(x0, z0), 0).r;
  let b = textureLoad(deformTex, vec2i(x1, z0), 0).r;
  let c = textureLoad(deformTex, vec2i(x0, z1), 0).r;
  let e = textureLoad(deformTex, vec2i(x1, z1), 0).r;
  return mix(mix(a, b, f.x), mix(c, e, f.x), f.y) * smoothstep(0.0, 0.06, edge);
}
// The surface: base minus the carve, plus the BERM — displaced snow piles
// into raised lips along the carve's skirt (where the stamp falls off but
// hasn't reached depth), which is the crisp SSX ridge line either side of
// the board cut. Toward the cut circle everything fades to the base
// pipeline's sink cap so a trail crossing the boundary lines up exactly.
fn surfAt(wx: f32, wz: f32) -> f32 {
  let c = carveAt(wx, wz);
  let s = c / max(pu.terra.w, 1e-4);
  let berm = pu.albedo.y * smoothstep(0.02, 0.2, s) * (1.0 - smoothstep(0.2, 0.6, s));
  let r = distance(vec2f(wx, wz), pu.region.xy) / max(pu.terra.z, 1e-3);
  let k = smoothstep(0.75, 0.98, r);
  return baseHeightAt(wx, wz) - mix(c, min(c, pu.albedo.w), k) + berm * (1.0 - k);
}

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
  @location(2) carve: f32,
}
@vertex
fn vs(@location(0) vpos: vec3f, @location(1) vnorm: vec3f, @location(2) vuv: vec2f) -> VSOut {
  let wx = vpos.x * pu.region.z + pu.region.x;
  let wz = vpos.z * pu.region.z + pu.region.y;
  // Analytic normal from 4 neighbours of the displaced height, ~1.5 cells
  // out — narrower than one cell flips normals cell-to-cell (sawtooth),
  // much wider blurs the narrow board cut away.
  let e = pu.region.z / pu.region.w * 1.5;
  let hL = surfAt(wx - e, wz); let hR = surfAt(wx + e, wz);
  let hD = surfAt(wx, wz - e); let hU = surfAt(wx, wz + e);
  var out: VSOut;
  let world = vec3f(wx, surfAt(wx, wz), wz);
  out.pos = u.viewProj * vec4f(world, 1.0);
  out.world = world;
  out.normal = normalize(vec3f(hL - hR, 2.0 * e, hD - hU));
  out.carve = carveAt(wx, wz);
  return out;
}
@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  // The patch exists ONLY inside the cut disc (+ a hair of overlap — the
  // base discards r < cutR, we draw to 1.02·cutR so float differences
  // between the two shaders' worlds can't open sky-cracks at the seam)
  // and never past the terrain edge (it would skirt off the island).
  let half = pu.terra.x * 0.5;
  if (abs(in.world.x) > half || abs(in.world.z) > half) { discard; }
  if (distance(in.world.xz, pu.region.xy) > pu.terra.z * 1.02) { discard; }
  let n = normalize(in.normal);
  let v = normalize(u.camPos.xyz - in.world);
  let amb = mix(u.ambGround.rgb, u.ambSky.rgb, n.y * 0.5 + 0.5) * u.fogColor.a;
  // Sample the SAME band colormap the base terrain uses (world XZ → uv), so
  // the patch is indistinguishable from the terrain beyond it — no visible
  // circle scrolling down the slope (Rich, esp. on sand).
  let cuv = vec2f(in.world.x / pu.terra.x + 0.5, in.world.z / pu.terra.x + 0.5);
  var albedo = textureSampleLevel(colormap, samp, cuv, 0.0).rgb;
  // Exposed under-layer in the deep trench (gated so the skirts stay snow).
  let trench = clamp(in.carve / max(pu.terra.w, 1e-4), 0.0, 1.0);
  let tmix = smoothstep(0.25, 0.8, trench);
  albedo = mix(albedo, pu.under.rgb * (1.0 - 0.3 * trench), tmix * 0.92);
  // Base-terrain-PARITY shading: same ambient, same shadowed PBR sun,
  // same env reflection — any difference is a visible sliding disc.
  let rough = clamp(pu.albedo.x, 0.045, 1.0);
  var sunVis = 1.0;
  if (lu.shadow.x > 0.5) { sunVis = shadowFactor(in.world, n); }
  var rgb = albedo * amb
    + pbrDirect(n, v, -u.lightDir.xyz, albedo, 0.0, rough, u.sunCol.rgb * (3.14159 * u.sunCol.w)) * sunVis;
  if (u.ambSky.w > 0.001) {
    let R = reflect(-v, n);
    let eu = atan2(R.x, R.z) / 6.28318530718 + 0.5;
    let ev = 0.5 - asin(clamp(R.y, -1.0, 1.0)) / 3.14159265;
    let mips = f32(textureNumLevels(envTex));
    let env = textureSampleLevel(envTex, samp, vec2f(eu, ev), rough * (mips - 1.0)).rgb;
    let NV = max(dot(n, v), 0.0);
    let F0amb = vec3f(0.04);
    let Fe = F0amb + (max(vec3f(1.0 - rough), F0amb) - F0amb) * pow(1.0 - NV, 5.0);
    rgb += env * Fe * u.ambSky.w * (1.0 - rough * 0.6);
  }
  // Snow sparkle: sub-texel point glints (not lit cells).
  if (pu.under.w > 0.0) {
    let sp = in.world.xz * 7.0;
    let cell = floor(sp);
    let hs = fract(sin(dot(cell, vec2f(127.1, 311.7))) * 43758.547);
    let pnt = cell + vec2f(hs, fract(hs * 91.17));
    let hv = normalize(v - u.lightDir.xyz);
    let fac = pow(max(dot(n, hv), 0.0), 6.0);
    let gl = smoothstep(0.16, 0.02, length(sp - pnt)) * step(0.6, fract(hs * 13.7)) * fac;
    rgb += u.sunCol.rgb * u.sunCol.w * gl * pu.under.w * 2.2 * (1.0 - trench);
  }
  if (u.params.z > 0.5) {
    let f = smoothstep(u.params.x, u.params.y, distance(u.camPos.xyz, in.world));
    rgb = mix(rgb, u.fogColor.rgb, f);
  }
  return vec4f(rgb, 1.0);
}
`;
function skinnedVariant(src, paletteBinding, group) {
	return "@group(" + group + ") @binding(" + paletteBinding + ") var<storage, read> palettes: array<mat4x4f>;\n@group(" + group + ") @binding(" + (paletteBinding + 1) + ") var<storage, read> paletteBase: array<u32>;\n" + src.replace("@location(2) vuv: vec2f, @builtin(instance_index) ii: u32)", "@location(2) vuv: vec2f, @location(3) vjoints: vec4u, @location(4) vweights: vec4f, @builtin(instance_index) ii: u32)").replace("let d = inst[ii];", "let d = inst[ii];\n  let pb = paletteBase[ii];\n  var sp3 = vec3f(0.0);\n  var sn3 = vec3f(0.0);\n  for (var k = 0u; k < 4u; k = k + 1u) {\n    let wgt = vweights[k];\n    if (wgt > 0.0) {\n      let pm = palettes[pb + vjoints[k]];\n      sp3 = sp3 + wgt * (pm * vec4f(vpos, 1.0)).xyz;\n      sn3 = sn3 + wgt * (mat3x3f(pm[0].xyz, pm[1].xyz, pm[2].xyz) * vnorm);\n    }\n  }\n  let vposS = sp3;\n  let vnormS = normalize(sn3);\n").replace("rotate(vpos * d.size.xyz", "rotate(vposS * d.size.xyz").replace("rotate(vnorm, d.pos.w", "rotate(vnormS, d.pos.w");
}
var SKINNED_VERTEX_BUFFERS = [{
	arrayStride: 44,
	attributes: [
		{
			shaderLocation: 0,
			offset: 0,
			format: "float32x3"
		},
		{
			shaderLocation: 1,
			offset: 12,
			format: "float32x3"
		},
		{
			shaderLocation: 2,
			offset: 24,
			format: "float32x2"
		},
		{
			shaderLocation: 3,
			offset: 32,
			format: "uint16x4"
		},
		{
			shaderLocation: 4,
			offset: 40,
			format: "unorm8x4"
		}
	]
}];
var MESH_FLOATS = 28;
var BB_FLOATS = 16;
var PICK_WGSL = `
struct PU { viewProj: mat4x4f }
struct Inst { pos: vec4f, size: vec4f, color: vec4f, rot: vec4f, texRect: vec4f, normRect: vec4f, extra: vec4f }
struct PB { base: u32, occlude: u32 }
@group(0) @binding(0) var<uniform> u: PU;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var<uniform> pb: PB;
@group(0) @binding(3) var<storage, read> enabled: array<u32>;   // 1 = pickable
fn rotate(v: vec3f, yaw: f32, pitch: f32, roll: f32) -> vec3f {
  var p = v;
  let cr = cos(roll); let sr = sin(roll);
  p = vec3f(p.x * cr - p.y * sr, p.x * sr + p.y * cr, p.z);
  let cp = cos(pitch); let sp = sin(pitch);
  p = vec3f(p.x, p.y * cp - p.z * sp, p.y * sp + p.z * cp);
  let cy = cos(yaw); let sy = sin(yaw);
  return vec3f(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);   // right-hand-turn yaw (increasing yaw → turn right)
}
struct VSOut { @builtin(position) pos: vec4f, @location(0) @interpolate(flat) id: u32, @location(1) @interpolate(flat) on: u32 }
@vertex fn vs(@location(0) vpos: vec3f, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  let world = rotate(vpos * d.size.xyz, d.pos.w, d.size.w, d.rot.x) + d.pos.xyz;
  var o: VSOut;
  o.pos = u.viewProj * vec4f(world, 1.0);
  o.id = pb.base + ii;
  o.on = enabled[ii];
  return o;
}
// Non-pickable geometry: in OCCLUDE mode it still writes depth (so it blocks
// clicks on enabled things behind it) but reports the "no hit" sentinel; in
// SEE-THROUGH mode it discards entirely (no depth, no id) so the ray passes
// through to the nearest enabled mesh.
@fragment fn fs(@location(0) @interpolate(flat) id: u32, @location(1) @interpolate(flat) on: u32) -> @location(0) u32 {
  if (on == 0u) {
    if (pb.occlude == 0u) { discard; }
    return 0xffffffffu;
  }
  return id;
}
`;
var PICK_STATIC_WGSL = ("@group(0) @binding(4) var<storage, read> visIdx: array<u32>;\n" + PICK_WGSL).replace("let d = inst[ii];", "let k = visIdx[ii];\n  let d = inst[k];").replace("o.id = pb.base + ii;", "o.id = pb.base + k;").replace("o.on = enabled[ii];", "o.on = enabled[k];");
var MESH_WGSL = `
struct U {
  viewProj: mat4x4f,
  camPos: vec4f,
  fogColor: vec4f,      // rgb + ambient in .a
  params: vec4f,        // fogNear, fogFar, fogOn, unused
  lightDir: vec4f,
  right: vec4f,         // camera basis (shared layout with the quad shaders)
  up: vec4f,
  ambSky: vec4f,        // hemisphere ambient: colour from ABOVE (rgb); w = env strength
  ambGround: vec4f,     // ...and from BELOW — blended by the normal's y
  sunCol: vec4f,        // direct-sun colour (rgb) x intensity (w) — day/night dims + warms it
  uwC: vec4f,           // UNDERWATER caustics: on(0/1), surfaceY(level), worldScale, speedNow
  uwC2: vec4f,          // caustic strengthNow, maxDepth, rgbSplit, downwelling sigma (green)
}
struct Inst {
  pos: vec4f,           // xyz + yaw
  size: vec4f,          // whd + pitch
  color: vec4f,
  rot: vec4f,           // roll, ground-grain strength, tileX, tileY
  texRect: vec4f,       // diffuse frame's atlas rect (white frame = untextured)
  normRect: vec4f,      // normal-map frame's atlas rect
  extra: vec4f,         // bump strength (0 = no normal map), metallic, rough, emissive
}
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) normal: vec3f,
  @location(1) world: vec3f,
  @location(2) color: vec4f,
  @location(3) mr: vec3f,           // metallic, roughness, emissive
  @location(4) uv: vec2f,           // tiled unwrap coords (fract in fs)
  @location(5) texRect: vec4f,
  @location(6) normRect: vec4f,
  @location(7) bump: f32,
  @location(9) grain: f32,          // (8 is the deform variant's carve)
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var tex: texture_2d<f32>;
@group(0) @binding(4) var ntex: texture_2d<f32>;   // normal map (atlas view, a standalone image, or the 1x1 flat normal)
@group(0) @binding(5) var envTex: texture_2d<f32>; // ENV equirect, mipped (IBL-lite)
@group(0) @binding(6) var mrTex: texture_2d<f32>;  // metallicRoughness (g=rough, b=metal)

// LIGHTING 2.0 (group 1, shared with the cluster kernel — lights3d.ts):
// clustered point/spot lights in VIEW space + the directional shadow map.
struct LU {
  view: mat4x4f,
  shadowVP: mat4x4f,
  params: vec4f,      // lightCount, slices, near, far
  grid: vec4f,        // tilesX, tilesY, screenW, screenH
  proj: vec4f,        // tanHalfX, tanHalfY, 0, 0
  shadow: vec4f,      // on, biasNdc, texelUv, normalOffWorld
}
@group(1) @binding(0) var<uniform> lu: LU;
@group(1) @binding(1) var<storage, read> lights: array<vec4f>;
@group(1) @binding(2) var<storage, read> clusters: array<u32>;
@group(1) @binding(3) var shadowMap: texture_depth_2d;
@group(1) @binding(4) var shadowSamp: sampler_comparison;
@group(1) @binding(5) var causticTex: texture_2d<f32>;  // baked tileable caustic (underwater3d)
@group(1) @binding(6) var causticSamp: sampler;         // repeat + mipped
@group(1) @binding(7) var grainTex: texture_2d<f32>;    // baked ground grain (terrain3d)

// One PBR-lite direct-light evaluation (GGX + Schlick fresnel +
// Smith-Schlick geometry) — the sun and every clustered light share it.
fn pbrDirect(nrm: vec3f, v: vec3f, l: vec3f, albedo: vec3f, metallic: f32, rough: f32, radiance: vec3f) -> vec3f {
  let h = normalize(v + l);
  let NL = max(dot(nrm, l), 0.0);
  let NV = max(dot(nrm, v), 1e-4);
  let NH = max(dot(nrm, h), 0.0);
  let VH = max(dot(v, h), 0.0);
  let a2 = rough * rough * rough * rough;
  let dd2 = NH * NH * (a2 - 1.0) + 1.0;
  let D = a2 / (3.14159 * dd2 * dd2);
  let kk = (rough + 1.0) * (rough + 1.0) / 8.0;
  let G = (NV / (NV * (1.0 - kk) + kk)) * (NL / (NL * (1.0 - kk) + kk));
  let F0 = mix(vec3f(0.04), albedo, metallic);
  let F = F0 + (1.0 - F0) * pow(1.0 - VH, 5.0);
  let spec = D * G * F / (4.0 * NV * NL + 1e-4);
  let kd = (vec3f(1.0) - F) * (1.0 - metallic);
  return (kd * albedo / 3.14159 + spec) * NL * radiance;
}

const POISSON8 = array<vec2f, 8>(
  vec2f(-0.326, -0.406), vec2f(-0.840, -0.074), vec2f(-0.696, 0.457), vec2f(-0.203, 0.621),
  vec2f(0.962, -0.195), vec2f(0.473, -0.480), vec2f(0.519, 0.767), vec2f(0.185, -0.893),
);

// Dithered poisson PCF against the directional shadow map. World-space input; the
// normal offset (shadow.w = 1.5 shadow texels in world units) does the
// anti-acne work so the depth bias (shadow.y) can stay tiny enough that
// shadows stay glued to their casters at low sun. The offset is SLOPE-
// SCALED (Holbert normal-offset shadows): when the light grazes a
// surface, one shadow texel spans a long stretch of receiver depth and a
// fixed offset leaves sawtooth acne bands — the offset must grow with
// tan(angle to the light), clamped so steep walls don't push the lookup
// visibly off the surface.
fn shadowFactor(world: vec3f, nrm: vec3f) -> f32 {
  let NL = max(dot(nrm, -u.lightDir.xyz), 0.0);
  let slope = sqrt(max(1.0 - NL * NL, 0.0)) / max(NL, 0.15);
  let off = lu.shadow.w * min(1.0 + slope, 6.0);
  let sc = lu.shadowVP * vec4f(world + nrm * off, 1.0);
  let ndc = sc.xyz / sc.w;
  if (abs(ndc.x) >= 1.0 || abs(ndc.y) >= 1.0 || ndc.z <= 0.0 || ndc.z >= 1.0) { return 1.0; }
  let uv = vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5);
  let refZ = ndc.z - lu.shadow.y;
  // DITHERED rotated-poisson PCF (9 taps, ~2.5 texel radius). A grid PCF
  // averages the texel STAIRCASE of a shadow edge into visible bands —
  // worst under eaves, where the edge runs near-parallel to the light and
  // one texel of quantisation moves it a long way down the wall. Rotating
  // the disk by a WORLD-anchored hash turns the bands into fine static
  // grain (no swimming when the camera moves).
  let h = fract(sin(dot(world, vec3f(12.9898, 78.233, 37.719))) * 43758.547);
  let ca = cos(h * 6.28318); let sa = sin(h * 6.28318);
  var sum = textureSampleCompareLevel(shadowMap, shadowSamp, uv, refZ);
  for (var i = 0; i < 8; i = i + 1) {
    let p = POISSON8[i] * (lu.shadow.z * 2.5);
    let r = vec2f(p.x * ca - p.y * sa, p.x * sa + p.y * ca);
    sum += textureSampleCompareLevel(shadowMap, shadowSamp, uv + r, refZ);
  }
  return sum / 9.0;
}

fn rotate(v: vec3f, yaw: f32, pitch: f32, roll: f32) -> vec3f {
  var p = v;
  let cr = cos(roll); let sr = sin(roll);
  p = vec3f(p.x * cr - p.y * sr, p.x * sr + p.y * cr, p.z);
  let cp = cos(pitch); let sp = sin(pitch);
  p = vec3f(p.x, p.y * cp - p.z * sp, p.y * sp + p.z * cp);
  let cy = cos(yaw); let sy = sin(yaw);
  return vec3f(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);   // right-hand-turn yaw (increasing yaw → turn right)
}

@vertex
fn vs(@location(0) vpos: vec3f, @location(1) vnorm: vec3f, @location(2) vuv: vec2f, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  let world = rotate(vpos * d.size.xyz, d.pos.w, d.size.w, d.rot.x) + d.pos.xyz;
  var out: VSOut;
  out.pos = u.viewProj * vec4f(world, 1.0);
  // NB: non-uniform scale skews normals slightly; fine for our shading model.
  out.normal = rotate(vnorm, d.pos.w, d.size.w, d.rot.x);
  out.world = world;
  out.color = d.color;
  out.mr = d.extra.yzw;
  out.uv = vuv * d.rot.zw;
  out.texRect = d.texRect;
  out.normRect = d.normRect;
  out.bump = d.extra.x;
  out.grain = d.rot.y;
  return out;
}

// Tangent basis WITHOUT tangent attributes (Schüler's cotangent frame),
// built from the world-position and uv derivatives. The derivatives are
// taken in fs's top level (dpdx demands uniform control flow) and passed in.
fn perturbNormal(n: vec3f, dp1: vec3f, dp2: vec3f, duv1: vec2f, duv2: vec2f, uv: vec2f, rect: vec4f, bump: f32) -> vec3f {
  // fract() maps the tiled unwrap into the frame's atlas rect (the atlas has
  // no mips, so the seam's derivative jump can't ring).
  let nuv = rect.xy + fract(uv) * (rect.zw - rect.xy);
  let mn = textureSampleLevel(ntex, samp, nuv, 0.0).rgb * 2.0 - 1.0;
  let dp2perp = cross(dp2, n);
  let dp1perp = cross(n, dp1);
  let T = dp2perp * duv1.x + dp1perp * duv2.x;
  let B = dp2perp * duv1.y + dp1perp * duv2.y;
  let det = max(dot(T, T), dot(B, B));
  // NO epsilon threshold here: det is built from SCREEN-SPACE derivatives,
  // so close-ups (magnified texture → tiny per-pixel uv deltas) push it to
  // ~1e-14 and below — a cutoff paints albedo-only bands across the surface
  // that move with zoom (shipped once; Rich circled it in red). The max()
  // floor instead lets a flushed-to-zero det collapse T/B to zero, which
  // normalizes back to the geometric normal — the same fallback, per-texel
  // smooth instead of banded.
  let scale = inverseSqrt(max(det, 1e-30));
  return normalize(mat3x3f(T * scale, B * scale, n) * vec3f(mn.xy * bump, mn.z));
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  var n = normalize(in.normal);
  let dp1 = dpdx(in.world); let dp2 = dpdy(in.world);
  let duv1 = dpdx(in.uv); let duv2 = dpdy(in.uv);
  if (in.bump > 0.001) {
    n = perturbNormal(n, dp1, dp2, duv1, duv2, in.uv, in.normRect, in.bump);
  }
  let tuv = in.texRect.xy + fract(in.uv) * (in.texRect.zw - in.texRect.xy);
  let t = textureSampleLevel(tex, samp, tuv, 0.0);
  // PBR-LITE (the Phase-3 GLB decision, taken with Rich): GGX specular +
  // Schlick fresnel + Smith-Schlick geometry under ONE directional light +
  // a flat ambient. No IBL/env yet (Phase 7) — metals therefore read dark
  // away from the light; the ambient keeps them legible. The direct term
  // carries a pi gain so legacy scenes keep their brightness (the old
  // lambert term had no 1/pi).
  var albedo = in.color.rgb * t.rgb;
  // CLOSE-RANGE GROUND GRAIN (terrain chunks only — inst grain flag): the
  // colormap's texels span >1 world unit, so up close its magnified bilinear
  // texels read as lego bricks on the beach. A tiny tileable world-space
  // speckle carries the detail the colormap can't; the manual LOD rides the
  // pixel footprint, and the deep mips average to 0.5 so the grain fades
  // itself out with distance (far terrain is byte-identical). Gated to
  // SANDY albedo by the same warm/bright/low-green heuristic the colormap
  // speckle bake uses — grass and rock are untouched.
  // ONE tap. A second tap at another scale (tried, to hide the tile
  // period) produced MOIRÉ SEAMS: the two scales' octaves land at
  // near-coincident world frequencies (scale ratio ~2.44 vs the bake's
  // ~2.65 octave spacing) and beat into evenly-spaced stripes that read
  // as texture joins — each tap alone is clean, only the SUM stripes
  // (Rich's red-line shot). The bake's three decorrelated octaves hide
  // the 5.3-unit repeat on their own.
  let guv = in.world.xz * (1.0 / 5.3);
  let glod = clamp(log2(max(length(fwidth(guv)) * 256.0, 1e-5)), 0.0, 8.0);
  if (in.grain > 0.001) {
    let sandy = clamp(((albedo.r + albedo.g) * 0.5 - albedo.b - 0.04) / 0.12, 0.0, 1.0)
      * (1.0 - clamp((albedo.g - max(albedo.r, albedo.b)) / 0.08, 0.0, 1.0));
    if (sandy > 0.001) {
      let gr = textureSampleLevel(grainTex, causticSamp, guv, glod).r;
      albedo *= 1.0 + (gr - 0.5) * 0.34 * sandy * in.grain;
    }
  }
  // metallicRoughness texture MULTIPLIES the factors (glTF semantics;
  // the 1x1 white default multiplies by 1). DamagedHelmet-class models
  // keep ALL their material variation here.
  let mrT = textureSampleLevel(mrTex, samp, tuv, 0.0);
  let metallic = clamp(in.mr.x * mrT.b, 0.0, 1.0);
  let rough = clamp(in.mr.y * mrT.g, 0.045, 1.0);
  let v = normalize(u.camPos.xyz - in.world);
  let F0amb = mix(vec3f(0.04), albedo, metallic);
  // HEMISPHERE ambient: sky colour from above, ground colour from below,
  // blended by the surface normal (both default white = the old flat term).
  let ambient = mix(u.ambGround.rgb, u.ambSky.rgb, n.y * 0.5 + 0.5) * u.fogColor.a;
  // The directional sun (shadowed when the map is on) + hemisphere ambient.
  var sunVis = 1.0;
  if (lu.shadow.x > 0.5) { sunVis = shadowFactor(in.world, n); }
  var rgb = albedo * ambient * mix(1.0, 0.4, metallic) + F0amb * ambient * 0.6 * metallic
    + pbrDirect(n, v, -u.lightDir.xyz, albedo, metallic, rough, u.sunCol.rgb * (3.14159 * u.sunCol.w)) * sunVis;
  // UNDERWATER caustics — dappled sunlight on the seabed and any upward-facing
  // geometry below the still-water level. Uniform-gated by u.uwC.x (whole draw
  // pays nothing when off). The pattern is BAKED once into a small tileable
  // mipped texture at underwater-layer init (underwater3d.ts) — per fragment
  // this costs two filtered taps, min-blended at different scales/speeds (the
  // Zucconi recipe: min breaks the tiling repeat, the dual scroll IS the
  // animation). The old per-fragment procedural loops here covered the whole
  // visible seabed from a beach and ate the frame. The fade kills the term
  // above the surface, on downward faces, in shadow, past maxDepth and past a
  // camera-distance LOD (far seabed is subpixel dapple — fading it stops the
  // shimmer the mip chain doesn't already catch).
  if (u.uwC.x > 0.5) {
    let pd = u.uwC.y - in.world.y;                       // depth below the level
    let cf = clamp(n.y, 0.0, 1.0)
      * smoothstep(0.05, 0.6, pd)
      * smoothstep(u.uwC2.y, u.uwC2.y * 0.5, pd)
      * exp(-u.uwC2.w * max(pd, 0.0))
      * (1.0 - smoothstep(70.0, 170.0, distance(u.camPos.xyz, in.world)))
      * sunVis * u.uwC2.x;
    let sc = max(u.uwC.z, 0.1);
    let uv1 = in.world.xz / sc + u.uwC.w * u.params.w * vec2f(0.05, 0.03);
    // The second tap is AXIS-SWAPPED and at an unrelated scale: two taps of
    // the same pattern at 1.0x and 0.7x kept the motif aligned and the tile
    // repeated visibly every scale-width step (Rich could point at the bands).
    let uv2 = vec2f(in.world.z, -in.world.x) / (sc * 0.41) - u.uwC.w * u.params.w * vec2f(0.035, 0.05);
    // ×2 undoes the value/2 the bake stores so >1 sparkle peaks survive u8.
    // (textureSample needs uniform control flow — the u.uwC.x branch is
    // uniform, same as the shadowFactor gate above.)
    let c = min(textureSample(causticTex, causticSamp, uv1).r,
                textureSample(causticTex, causticSamp, uv2).g) * 2.0;
    // A cheap per-channel skew off the single scalar reads as the chromatic
    // refraction split (u.uwC2.z) without paying for 3 taps per scale.
    let cc = clamp(vec3f(c) + vec3f(0.6, 0.0, -0.5) * (c * u.uwC2.z * 22.0), vec3f(0.0), vec3f(2.0));
    rgb += u.sunCol.rgb * cc * cf;
  }
  // CLUSTERED local lights: find this fragment's froxel, shade its list.
  if (lu.params.x > 0.5) {
    let vpos = (lu.view * vec4f(in.world, 1.0)).xyz;
    let vz = -vpos.z;
    if (vz > 0.0) {
      let nView = normalize((lu.view * vec4f(n, 0.0)).xyz);
      let vView = normalize(-vpos);
      let tx = min(u32(in.pos.x / lu.grid.z * lu.grid.x), u32(lu.grid.x) - 1u);
      let ty = min(u32(in.pos.y / lu.grid.w * lu.grid.y), u32(lu.grid.y) - 1u);
      // params.z is the CLUSTER near (clamped away from the camera near) —
      // fragments inside it log to a negative slice; max() clamps to slice
      // 0, whose froxel extends to the camera in the binning kernel.
      let slice = min(u32(max(log(vz / lu.params.z) / log(lu.params.w / lu.params.z) * lu.params.y, 0.0)), u32(lu.params.y) - 1u);
      let cidx = ((slice * u32(lu.grid.y) + ty) * u32(lu.grid.x) + tx) * 128u;
      let nLights = clusters[cidx];
      for (var i = 0u; i < nLights; i = i + 1u) {
        let li = clusters[cidx + 1u + i];
        let l0 = lights[li * 4u];              // viewPos + radius
        let l1 = lights[li * 4u + 1u];         // colour·intensity + type
        let toL = l0.xyz - vpos;
        let dist = length(toL);
        if (dist >= l0.w) { continue; }
        let ldir = toL / max(dist, 1e-4);
        // UE-style smooth falloff: zero exactly at the radius (the binning
        // radius must be honest or lights pop at cluster edges).
        let dr = dist / l0.w;
        var atten = (1.0 - dr * dr * dr * dr);
        atten = atten * atten / (dist * dist + 1.0);
        if (l1.w > 0.5) {                      // spot cone
          let l2 = lights[li * 4u + 2u];       // viewDir + cosOuter
          let l3 = lights[li * 4u + 3u];       // cosInner
          atten *= smoothstep(l2.w, l3.x, dot(-ldir, l2.xyz));
        }
        rgb += pbrDirect(nView, vView, ldir, albedo, metallic, rough, l1.rgb * atten * 3.14159);
      }
    }
  }
  // ENVIRONMENT reflections (IBL-lite): the reflected view samples the
  // equirect sky, roughness picks the mip (mirror -> sharp sky, matte ->
  // the blurred average), Fresnel weights it — metals reflect the world
  // instead of going black away from lights.
  if (u.ambSky.w > 0.001) {
    let R = reflect(-v, n);
    let eu = atan2(R.x, R.z) / 6.28318530718 + 0.5;
    let ev = 0.5 - asin(clamp(R.y, -1.0, 1.0)) / 3.14159265;
    let mips = f32(textureNumLevels(envTex));
    let env = textureSampleLevel(envTex, samp, vec2f(eu, ev), rough * (mips - 1.0)).rgb;
    let NV = max(dot(n, v), 0.0);
    let Fe = F0amb + (max(vec3f(1.0 - rough), F0amb) - F0amb) * pow(1.0 - NV, 5.0);
    rgb += env * Fe * u.ambSky.w * (1.0 - rough * 0.6);
  }
  // Self-illumination: unlit colour on top (bulbs/lava) — still fogged.
  rgb += albedo * in.mr.z;
  if (u.params.z > 0.5) {
    let f = smoothstep(u.params.x, u.params.y, distance(u.camPos.xyz, in.world));
    rgb = mix(rgb, u.fogColor.rgb, f);
  }
  let a = in.color.a * t.a;
  return vec4f(rgb * a, a);
}
`;
var SHADOW_WGSL = `
struct SU { vp: mat4x4f }
struct Inst {
  pos: vec4f, size: vec4f, color: vec4f, rot: vec4f,
  texRect: vec4f, normRect: vec4f, extra: vec4f,
}
@group(0) @binding(0) var<uniform> su: SU;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;

fn rotate(v: vec3f, yaw: f32, pitch: f32, roll: f32) -> vec3f {
  var p = v;
  let cr = cos(roll); let sr = sin(roll);
  p = vec3f(p.x * cr - p.y * sr, p.x * sr + p.y * cr, p.z);
  let cp = cos(pitch); let sp = sin(pitch);
  p = vec3f(p.x, p.y * cp - p.z * sp, p.y * sp + p.z * cp);
  let cy = cos(yaw); let sy = sin(yaw);
  return vec3f(p.x * cy - p.z * sy, p.y, p.x * sy + p.z * cy);   // right-hand-turn yaw (increasing yaw → turn right)
}

@vertex
fn vs(@location(0) vpos: vec3f, @location(1) vnorm: vec3f, @location(2) vuv: vec2f, @builtin(instance_index) ii: u32) -> @builtin(position) vec4f {
  let d = inst[ii];
  let world = rotate(vpos * d.size.xyz, d.pos.w, d.size.w, d.rot.x) + d.pos.xyz;
  return su.vp * vec4f(world, 1.0);
}
`;
var BLOB_FLOATS = 8;
var BLOB_WGSL = `
struct U {
  viewProj: mat4x4f,
  camPos: vec4f,
  fogColor: vec4f,
  params: vec4f,
  lightDir: vec4f,
}
struct Blob {
  pos: vec4f,    // x, groundY, z, radiusX
  misc: vec4f,   // alpha, radiusZ, yaw
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> blobs: array<Blob>;
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) alpha: f32,
}
@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let b = blobs[ii];
  let corner = vec2f(f32(vi & 1u) * 2.0 - 1.0, f32(vi >> 1u) * 2.0 - 1.0);
  // Elliptical footprint, rotated with the caster (a thin wall gets a thin
  // shadow hugging it — a circle from its long side pokes out sideways).
  let e = vec2f(corner.x * b.pos.w, corner.y * b.misc.y);
  let cy = cos(b.misc.z); let sy = sin(b.misc.z);
  // b.pos.y already carries the ground clearance (a hair above the ground to
  // beat z-fighting, plus any footprint-scaled blobs.lift a sand/undulating
  // world dials in) -- the quad sits flat at that height.
  let world = vec3f(b.pos.x + e.x * cy - e.y * sy, b.pos.y, b.pos.z + e.x * sy + e.y * cy);   // right-hand-turn yaw (matches caster)
  var out: VSOut;
  out.pos = u.viewProj * vec4f(world, 1.0);
  out.uv = corner;
  out.alpha = b.misc.x;
  return out;
}
@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let d = length(in.uv);
  // Solid core out to ~60% of the radius, then a soft edge: the VISIBLE
  // part of a blob is the band OUTSIDE its caster's footprint — an early
  // fade leaves nothing to see.
  let a = in.alpha * smoothstep(1.0, 0.6, d);
  return vec4f(0.0, 0.0, 0.0, a);   // premultiplied: rgb 0 darkens
}
`;
/** Pure blob-shadow parameters for one object (dist-tested): fw/fd = the
* horizontal extents, bottom = height of the object's base above the ground
* plane. Returns per-axis ELLIPSE radii, or null when the object casts no
* blob (too big — floors/plazas; underground; higher than `fade` — blobs
* are CONTACT shadows: stacked or flying objects must not project offset
* ghosts onto the ground plane). `force` bypasses the footprint gate. */
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
var BB_WGSL = `
struct U {
  viewProj: mat4x4f,
  camPos: vec4f,
  fogColor: vec4f,
  params: vec4f,
  lightDir: vec4f,      // unused here; layout shared
  camRight: vec4f,
  camUp: vec4f,
}
struct Inst { pos: vec4f, size: vec4f, color: vec4f, uv: vec4f }
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) color: vec4f,
  @location(2) world: vec3f,
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var tex: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  let c01 = vec2f(f32(vi & 1u), f32(vi >> 1u));
  let off = c01 - 0.5;
  // Anchor at the BASE (y offset 0..1): trees/characters stand on their point.
  let world = d.pos.xyz + u.camRight.xyz * (off.x * d.size.x) + u.camUp.xyz * (c01.y * d.size.y);
  var ux = c01.x;
  if (d.pos.w > 0.5) { ux = 1.0 - ux; }   // flipX
  var out: VSOut;
  out.pos = u.viewProj * vec4f(world, 1.0);
  out.uv = vec2f(mix(d.uv.x, d.uv.z, ux), mix(d.uv.y, d.uv.w, 1.0 - c01.y));
  out.color = d.color;
  out.world = world;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let t = textureSample(tex, samp, in.uv);
  let a = t.a * in.color.a;
  if (a < 0.5) { discard; }               // cutout: no sorting, depth just works
  var rgb = t.rgb * in.color.rgb;
  if (u.params.z > 0.5) {
    let f = smoothstep(u.params.x, u.params.y, distance(u.camPos.xyz, in.world));
    rgb = mix(rgb, u.fogColor.rgb, f);
  }
  return vec4f(rgb, 1.0);
}
`;
var WISP_SEGX = 12;
var WISP_SEGY = 40;
var WISP_FLOATS = 20;
var WISP_WGSL = `
const SEGX = ${WISP_SEGX}u;
const SEGY = ${WISP_SEGY}u;
struct U {
  viewProj: mat4x4f,
  camPos: vec4f,
  fogColor: vec4f,
  params: vec4f,        // fogNear, fogFar, fogOn, TIME
  lightDir: vec4f,
  camRight: vec4f,
  camUp: vec4f,
}
struct Inst {
  pos: vec4f,           // x, y, z, twist (radians of full-noise rotation)
  size: vec4f,          // w, h, speed, wind (world units)
  color: vec4f,
  uv: vec4f,            // the noise frame's atlas rect
  misc: vec4f,          // remap lo, remap hi, yaw, unused
}
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uvn: vec2f,          // x across, fy UP the ribbon (0 base)
  @location(1) color: vec4f,
  @location(2) world: vec3f,
  @location(3) uvRect: vec4f,
  @location(4) wp: vec3f,           // lo, hi, t
  @location(5) face: f32,           // 1 face-on … 0 edge-on (after twist)
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var tex: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  let corner = vi % 6u;
  let cell = vi / 6u;
  let cx = f32(cell % SEGX);
  let cy = f32(cell / SEGX);
  let o = vec2f(f32((0x1Au >> corner) & 1u), f32((0x34u >> corner) & 1u));
  let ux = (cx + o.x) / f32(SEGX);
  let fy = 1.0 - (cy + o.y) / f32(SEGY);                   // 0 base → 1 top
  let t = u.params.w * d.size.z;
  let span = d.uv.zw - d.uv.xy;

  // TRUE Y-axis twist, angle sampled from a drifting noise column.
  let twn = textureSampleLevel(tex, samp, d.uv.xy + vec2f(0.5, fract(fy * 0.2 - t * 0.03)) * span, 0.0).r;
  let ang = twn * d.pos.w;
  var lp = vec3f((ux - 0.5) * d.size.x, fy * d.size.y, 0.0);
  let ca = cos(ang); let sa = sin(ang);
  lp = vec3f(lp.x * ca - lp.z * sa, lp.y, lp.x * sa + lp.z * ca);

  // Wind: two independent noise channels drive x/z, pinned at the base.
  let wx = textureSampleLevel(tex, samp, d.uv.xy + vec2f(0.25, fract(t * 0.02)) * span, 0.0).r - 0.5;
  let wz = textureSampleLevel(tex, samp, d.uv.xy + vec2f(0.75, fract(t * 0.02)) * span, 0.0).r - 0.5;
  lp += vec3f(wx, 0.0, wz) * fy * fy * d.size.w;

  // Y-BILLBOARD: the plane auto-faces the camera (upright), so it is never
  // seen edge-on — a single plane viewed down its own face collapses into a
  // column of twist crossings. misc.z is an extra yaw offset on top.
  let toCam = u.camPos.xz - d.pos.xz;
  // Right-hand-turn yaw: atan2(−x,z) auto-face + new rotate below cancel to the
  // same facing, and misc.z (author yaw) now matches a mesh's yaw.
  let yaw = atan2(-toCam.x, toCam.y) + d.misc.z;
  let cy2 = cos(yaw); let sy2 = sin(yaw);
  let world = d.pos.xyz + vec3f(lp.x * cy2 - lp.z * sy2, lp.y, lp.x * sy2 + lp.z * cy2);

  // How face-on this vertex's TWISTED surface is to the viewer (1 = flat
  // on, 0 = edge-on) — the fragment fades edge-on slices out instead of
  // letting front+back overlap into a hard bright crossing line.
  let nl = vec3f(sa, 0.0, ca);                             // plane normal after twist
  let nw = vec3f(nl.x * cy2 - nl.z * sy2, 0.0, nl.x * sy2 + nl.z * cy2);
  let vd = normalize(u.camPos.xyz - world);
  let face = abs(dot(nw, vd));

  var out: VSOut;
  out.pos = u.viewProj * vec4f(world, 1.0);
  out.uvn = vec2f(ux, fy);
  out.color = d.color;
  out.world = world;
  out.uvRect = d.uv;
  out.wp = vec3f(d.misc.x, d.misc.y, t);
  out.face = face;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let span = in.uvRect.zw - in.uvRect.xy;
  let su = vec2f(fract(in.uvn.x * 0.5), fract(in.uvn.y * 0.3 - in.wp.z * 0.09));
  var s = textureSampleLevel(tex, samp, in.uvRect.xy + su * span, 0.0).r;
  s = smoothstep(in.wp.x, in.wp.y, s);
  s *= smoothstep(0.0, 0.1, in.uvn.x) * smoothstep(1.0, 0.9, in.uvn.x);
  s *= smoothstep(0.0, 0.1, in.uvn.y) * smoothstep(1.0, 0.4, in.uvn.y);
  s *= mix(0.15, 1.0, smoothstep(0.0, 0.35, in.face));     // edge-on slices dissolve
  var rgb = in.color.rgb;
  if (u.params.z > 0.5) {
    let f = smoothstep(u.params.x, u.params.y, distance(u.camPos.xyz, in.world));
    rgb = mix(rgb, u.fogColor.rgb, f);
  }
  let a = s * in.color.a;
  return vec4f(rgb * a, a);
}
`;
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
var FX_FLOATS = 16;
var FX_WGSL = `
struct U {
  viewProj: mat4x4f,
  camPos: vec4f,
  fogColor: vec4f,
  params: vec4f,        // fogNear, fogFar, fogOn, TIME
  lightDir: vec4f,
  camRight: vec4f,
  camUp: vec4f,
}
struct Inst {
  pos: vec4f,           // xyz + size (half extent, world units)
  color: vec4f,         // straight rgba
  misc: vec4f,          // rot, mode (0 disc / 1 frame / 2 ring / 3 FLAT ring), add, p
  uv: vec4f,            // atlas rect (frame mode; white frame otherwise)
}
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uvn: vec2f,          // 0..1 across the quad (SDF space)
  @location(1) uv: vec2f,           // atlas coords (frame mode)
  @location(2) color: vec4f,
  @location(3) world: vec3f,
  @location(4) misc: vec4f,
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var tex: texture_2d<f32>;

// LIT PARTICLES: group(1) is the shared clustered-light structure (the
// mesh pipeline's LU) — smoke picks up lantern colour as it drifts.
struct LU {
  view: mat4x4f,
  shadowVP: mat4x4f,
  params: vec4f,      // lightCount, slices, near, far
  grid: vec4f,        // tilesX, tilesY, screenW, screenH
  proj: vec4f,
  shadow: vec4f,
}
@group(1) @binding(0) var<uniform> lu: LU;
@group(1) @binding(1) var<storage, read> lights: array<vec4f>;
@group(1) @binding(2) var<storage, read> clusters: array<u32>;
@group(1) @binding(3) var shadowMap: texture_depth_2d;
@group(1) @binding(4) var shadowSamp: sampler_comparison;

// Isotropic in-scattering from this fragment's froxel: no normal — a
// particle is a puff, it just SUMS what reaches it.
fn clusterGlow(world: vec3f, fragXY: vec2f) -> vec3f {
  var sum = vec3f(0.0);
  if (lu.params.x < 0.5) { return sum; }
  let vpos = (lu.view * vec4f(world, 1.0)).xyz;
  let vz = -vpos.z;
  if (vz <= 0.0) { return sum; }
  let tx = min(u32(fragXY.x / lu.grid.z * lu.grid.x), u32(lu.grid.x) - 1u);
  let ty = min(u32(fragXY.y / lu.grid.w * lu.grid.y), u32(lu.grid.y) - 1u);
  let slice = min(u32(max(log(vz / lu.params.z) / log(lu.params.w / lu.params.z) * lu.params.y, 0.0)), u32(lu.params.y) - 1u);
  let cidx = ((slice * u32(lu.grid.y) + ty) * u32(lu.grid.x) + tx) * 128u;
  let nLights = clusters[cidx];
  for (var i = 0u; i < nLights; i = i + 1u) {
    let li = clusters[cidx + 1u + i];
    let l0 = lights[li * 4u];
    let l1 = lights[li * 4u + 1u];
    let toL = l0.xyz - vpos;
    let dist = length(toL);
    if (dist >= l0.w) { continue; }
    let dr = dist / l0.w;
    var atten = (1.0 - dr * dr * dr * dr);
    atten = atten * atten / (dist * dist + 1.0);
    if (l1.w > 0.5) {
      let l2 = lights[li * 4u + 2u];
      let l3 = lights[li * 4u + 3u];
      atten *= smoothstep(l2.w, l3.x, dot(-normalize(toL), l2.xyz));
    }
    sum += l1.rgb * atten;
  }
  return sum;
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  let c01 = vec2f(f32(vi & 1u), f32(vi >> 1u));
  var off = c01 - 0.5;
  let cr = cos(d.misc.x); let sr = sin(d.misc.x);
  off = vec2f(off.x * cr - off.y * sr, off.x * sr + off.y * cr);
  // CENTRED camera-facing expansion (billboards are base-anchored; a
  // particle's position is its middle). Mode 3 lies FLAT in the world XZ
  // plane instead (ground shockwaves — a ring that faces the camera reads
  // as a 2D effect pasted on the screen; one lying in the world reads 3D).
  var world = d.pos.xyz + (u.camRight.xyz * off.x + u.camUp.xyz * off.y) * (d.pos.w * 2.0);
  if (d.misc.y > 2.5) {
    world = d.pos.xyz + vec3f(off.x, 0.0, off.y) * (d.pos.w * 2.0);
  }
  var out: VSOut;
  out.pos = u.viewProj * vec4f(world, 1.0);
  out.uvn = c01;
  out.uv = vec2f(mix(d.uv.x, d.uv.z, c01.x), mix(d.uv.y, d.uv.w, 1.0 - c01.y));
  out.color = d.color;
  out.world = world;
  out.misc = d.misc;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  // Sample unconditionally (uniform control flow), then select by mode.
  let t = textureSample(tex, samp, in.uv);
  let dd = length(in.uvn - 0.5) * 2.0;                     // 0 centre → 1 edge
  let mode = in.misc.y;
  var rgb = in.color.rgb;
  var a = in.color.a;
  if (mode < 0.5) {
    // Disc with a SOFT dial (misc.w): 0 = crisp AA disc, 1 = a gaussian
    // glow puff (the classic radial particle texture, analytically — no
    // asset needed). Both forced to true zero at the geometric edge.
    let crisp = 1.0 - smoothstep(0.9, 1.0, dd);
    let glow = exp(-dd * dd * 5.0) * smoothstep(1.0, 0.7, dd);
    a *= mix(crisp, glow, clamp(in.misc.w, 0.0, 1.0));
  } else if (mode < 1.5) {
    // Atlas frame (debris/petals/chunks) — tinted, its own alpha.
    rgb *= t.rgb;
    a *= t.a;
  } else {
    // SDF ring (modes 2 + 3): a band of thickness p (fraction of the
    // radius) at the rim.
    let inner = 1.0 - max(in.misc.w, 0.02);
    a *= smoothstep(inner - 0.08, inner + 0.02, dd) * (1.0 - smoothstep(0.94, 1.0, dd));
  }
  // misc.z packs add (bit 0) + lit (bit 1).
  let lit = select(0.0, 1.0, in.misc.z > 1.5);
  let add = in.misc.z - 2.0 * lit;
  if (lit > 0.5) {
    // Ambient + a flat sun term + the froxel's lights, straight multiply.
    rgb *= u.fogColor.a + 0.5 + clusterGlow(in.world, in.pos.xy) * 3.14159;
  }
  if (u.params.z > 0.5) {
    let f = smoothstep(u.params.x, u.params.y, distance(u.camPos.xyz, in.world));
    // Additive content fades to BLACK in fog (adding fog colour would glow).
    rgb = mix(rgb, u.fogColor.rgb * (1.0 - add), f);
  }
  return vec4f(rgb * a, a * (1.0 - add));                  // add: alpha 0 = pure additive
}
`;
var TRAIL_PTS = 16;
var TRAIL_SEGS = 48;
var TRAIL_FLOATS = 116;
var TRAIL_WGSL = `
// UP = 1: a vertical base-anchored WALL (Tron light-cycle); 0 = view-facing.
override UP: f32 = 0.0;
const SEGS = ${TRAIL_SEGS}u;
const PTS = ${TRAIL_PTS}u;
struct U {
  viewProj: mat4x4f,
  camPos: vec4f,
  fogColor: vec4f,
  params: vec4f,        // fogNear, fogFar, fogOn, TIME
  lightDir: vec4f,
  camRight: vec4f,
  camUp: vec4f,
}
struct Inst {
  p0: vec4f,            // width, alpha, add, taper
  p1: vec4f,            // turbulence, erode, core, seed
  p2: vec4f,            // distHead, span (arc length), fiber, hard
  p3: vec4f,            // crackle, unused ×3
  uv: vec4f,            // the noise frame's atlas rect
  c: array<vec4f, 8>,   // head→tail colour stops
  pts: array<vec4f, PTS>, // xyz + fade k (1 head → 0 tail), ARC-UNIFORM
}
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) sk: vec4f,           // s along (0 head), k fade, across, DIST
  @location(1) color: vec4f,
  @location(2) world: vec3f,
  @location(3) uvRect: vec4f,
  @location(4) misc: vec4f,         // erode, core, add, seed
  @location(5) fh: vec4f,           // fiber depth, edge hardness, crackle, 0
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var tex: texture_2d<f32>;

// Catmull-Rom through the control points at s in [0,1] (0 = head).
// Interpolates xyz AND the fade channel, so k is smooth along the curve.
fn cr(ii: u32, s: f32) -> vec4f {
  let f = clamp(s, 0.0, 1.0) * f32(PTS - 1u);
  let i1 = min(u32(floor(f)), PTS - 1u);
  let tt = f - floor(f);
  let i0 = max(i1, 1u) - 1u;
  let i2 = min(i1 + 1u, PTS - 1u);
  let i3 = min(i1 + 2u, PTS - 1u);
  let a = inst[ii].pts[i0];
  let b = inst[ii].pts[i1];
  let c = inst[ii].pts[i2];
  let d = inst[ii].pts[i3];
  let t2 = tt * tt;
  let t3 = t2 * tt;
  // EXACT twin of the exported crTrail() (dist-tested) — change both
  // together. The t³ coefficient is (-a + 3b - 3c + d): for collinear evenly
  // spaced points it must vanish exactly — a sign slip here makes the curve
  // OSCILLATE between control points and the ribbon bowtie per cell.
  return 0.5 * (2.0 * b + (c - a) * tt
    + (2.0 * a - 5.0 * b + 4.0 * c - d) * t2
    + (3.0 * b - 3.0 * c + d - a) * t3);
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  let corner = vi % 6u;
  let cell = vi / 6u;
  let o = vec2f(f32((0x1Au >> corner) & 1u), f32((0x34u >> corner) & 1u));
  let s = (f32(cell) + o.y) / f32(SEGS);                   // 0 head → 1 tail
  let across = o.x;
  let p = cr(ii, s);
  let k = clamp(p.w, 0.0, 1.0);

  // Tangent by central difference on the SMOOTHED curve.
  let e = 1.0 / f32(SEGS);
  let tan3 = cr(ii, s + e).xyz - cr(ii, s - e).xyz;

  // THE AFTERIMAGE ANCHOR: absolute distance travelled at this vertex —
  // constant for a fixed point on the path as the ribbon slides forward
  // (control points are arc-uniform, so it is linear in s). Keying noise on
  // s instead glues the pattern to the object like a painted appendage.
  let t = u.params.w;
  let dist = d.p2.x - s * d.p2.y;

  // Noise flutter: two channels shake the centreline, LAID DOWN IN PLACE
  // along the path (dist-keyed) and growing with age like dispersing smoke.
  let span = d.uv.zw - d.uv.xy;
  let seed = d.p1.w;
  let n1 = textureSampleLevel(tex, samp, d.uv.xy + fract(vec2f(dist * 0.09 - t * 0.05, seed)) * span, 0.0).r - 0.5;
  let n2 = textureSampleLevel(tex, samp, d.uv.xy + fract(vec2f(dist * 0.09 - t * 0.04, seed + 0.37)) * span, 0.0).r - 0.5;
  let center = p.xyz + (u.camRight.xyz * n1 + u.camUp.xyz * n2) * (d.p1.x * (1.0 - k) * 2.0);

  // Head swell: the ribbon emerges from INSIDE the object (35% width at the
  // very head, full by 15% along) — a trail must never outsize its emitter.
  var halfW = 0.5 * d.p0.x * mix(1.0, k, d.p0.w);
  halfW *= 0.35 + 0.65 * smoothstep(0.0, 0.15, s);
  var world: vec3f;
  if (UP > 0.5) {
    // Vertical WALL: base-anchored on the fed path, width tall, both sides
    // visible (this variant renders with culling OFF — a wall cannot
    // self-fold, its expansion axis is constant).
    world = center + vec3f(0.0, across * 2.0 * halfW, 0.0);
  } else {
    // Expand perpendicular to the VIEW — a motion ribbon, never edge-on.
    let viewDir = normalize(u.camPos.xyz - center);
    var side = cross(tan3, viewDir);
    let sl = length(side);
    if (sl < 1e-5) { side = u.camRight.xyz; } else { side = side / sl; }
    world = center + side * ((across - 0.5) * 2.0 * halfW);
  }

  // Head→tail 4-stop gradient, evaluated per vertex (k varies smoothly).
  let ci = (1.0 - k) * 7.0;
  let i0c = u32(clamp(floor(ci), 0.0, 7.0));
  let col = mix(d.c[i0c], d.c[min(i0c + 1u, 7u)], fract(ci));

  var out: VSOut;
  out.pos = u.viewProj * vec4f(world, 1.0);
  out.sk = vec4f(s, k, across, dist);
  // NB no fade factor here — HOW the trail dies (dim vs shred) is the
  // fragment's 'erode' blend; a second fade stacked on top masks the dial.
  out.color = vec4f(col.rgb, col.a * d.p0.y);
  out.world = world;
  out.uvRect = d.uv;
  out.misc = vec4f(d.p1.y, d.p1.z, d.p0.z, seed);
  out.fh = vec4f(d.p2.z, d.p2.w, d.p3.x, 0.0);
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let s = in.sk.x;
  let k = in.sk.y;
  let dd = abs(in.sk.z - 0.5) * 2.0;                       // 0 centre → 1 edge
  // Soft two-gaussian width profile — a wide dim halo under a narrow bright
  // body, forced to true zero at the geometric edge (no visible rim, ever).
  // Edge hardness blends the width profile: soft gaussian falloff (gas)
  // to a crisp flat-topped band of light (neon under bloom — the Tron wall).
  let soft = exp(-dd * dd * 4.0) * smoothstep(1.0, 0.6, dd);
  let body = mix(soft, smoothstep(1.0, 0.85, dd), in.fh.y);
  var a = in.color.a * body;
  // ONE anisotropic noise sample: slow along the length, a few features
  // across the width — long fibres PARALLEL to the motion, keyed on the
  // ABSOLUTE travelled distance (sk.w) so the pattern stays pinned to the
  // world path and the ribbon slides through it (the afterimage read).
  // Anything that varies fast along s while staying constant across the
  // width paints straight TRANSVERSE BARS (the "stack of quads") — never.
  let span = in.uvRect.zw - in.uvRect.xy;
  let t = u.params.w;
  let fib = textureSampleLevel(tex, samp, in.uvRect.xy + fract(vec2f(in.sk.w * 0.12 - t * 0.04, in.sk.z * 0.4 + in.misc.w)) * span, 0.0).r;
  a *= mix(1.0, mix(0.6, 1.4, smoothstep(0.2, 0.8, fib)), in.fh.x); // fibre depth (0 = clean light)
  // HOW THE TRAIL DIES — the 'erode' dial blends two fade mechanisms
  // (blend, never stack: stacked they overlap and the dial goes invisible):
  //   0 = DIMMING: a smooth silky fade to nothing;
  //   1 = SHREDDING: pieces keep full brightness until the rising noise
  //       threshold eats them, dim fibre gaps first — ragged fire.
  let fade = pow(k, 1.4);
  let th = (1.0 - k) * 1.4 + dd * 0.2;
  let gate = smoothstep(th - 0.25, th + 0.25, fib + 0.25);
  a *= mix(fade, gate, in.misc.x);
  // White-hot centre line — a tight gaussian core, strongest at the head.
  var rgb = mix(in.color.rgb, vec3f(1.0), in.misc.y * exp(-dd * dd * 18.0) * k);
  // CRACKLE — a SPARKLER inside the ribbon. LESSON (two invisible versions
  // shipped): never gate this on the TAIL of the noise distribution — the
  // fbm has almost no mass above ~0.7, so tail thresholds light nothing and
  // tuning them is guesswork. Instead the noise value is only a per-cell
  // PHASE, and every cell flashes on a staggered time sawtooth:
  // fract(noise·9.7 + t·speed) thresholded near 1 → a guaranteed ~13% of
  // cells lit at any instant, each flaring for ~a quarter second then
  // cutting out, scattered along the ribbon (path-pinned cells, ~8px at
  // follow-cam distance). Glints OVERSHOOT the framebuffer (bloom flares
  // them on the white-hot head) and write a full alpha floor (they stay
  // lit through the eroded dim tail).
  let ck = textureSampleLevel(tex, samp, in.uvRect.xy + fract(vec2f(in.sk.w * 0.45, in.sk.z * 0.9 + in.misc.w)) * span, 0.0).r;
  let pulse = smoothstep(0.87, 0.99, fract(ck * 9.7 + t * 0.5));
  let glint = pulse * in.fh.z * body * mix(0.5, 1.0, k);
  rgb += vec3f(glint * 2.0);
  a = max(a, min(1.0, glint * 1.6) * in.color.a);
  let add = in.misc.z;
  if (u.params.z > 0.5) {
    let f = smoothstep(u.params.x, u.params.y, distance(u.camPos.xyz, in.world));
    // Additive content fades to BLACK in fog (adding fog colour would glow).
    rgb = mix(rgb, u.fogColor.rgb * (1.0 - add), f);
  }
  return vec4f(rgb * a, a * (1.0 - add));                  // add: alpha 0 = pure additive
}
`;
/**
* Resample a trail's raw point history (oldest first) into `n` control
* points HEAD (newest) → TAIL, each xyz + fade k (1 head → 0 at end of
* `life`), spaced UNIFORMLY IN ARC LENGTH — so the ribbon's parameter is
* proportional to distance along the path (stable curves at any speed, and
* the shader can reconstruct absolute travelled distance linearly).
* Pure — exported for headless tests.
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
/**
* The Catmull-Rom the trail VERTEX STAGE runs — kept in EXACT sync with
* TRAIL_WGSL's cr() (change both together). Pure, exported for headless
* tests: for collinear evenly spaced control points the t³ term must vanish
* and the curve be exactly linear — a sign slip here once shipped as the
* "stack of quads" bowtie ribbon (the curve oscillated between points).
* `pts` is resampleTrail's layout (n × vec4: xyz + fade), s in [0,1].
*/
function crTrail(pts, n, s) {
	const f = Math.min(1, Math.max(0, s)) * (n - 1);
	const i1 = Math.min(Math.floor(f), n - 1);
	const tt = f - Math.floor(f);
	const i0 = Math.max(i1, 1) - 1, i2 = Math.min(i1 + 1, n - 1), i3 = Math.min(i1 + 2, n - 1);
	const out = [
		0,
		0,
		0,
		0
	];
	for (let c = 0; c < 4; c++) {
		const a = pts[i0 * 4 + c], b = pts[i1 * 4 + c], cc = pts[i2 * 4 + c], d = pts[i3 * 4 + c];
		out[c] = .5 * (2 * b + (cc - a) * tt + (2 * a - 5 * b + 4 * cc - d) * tt * tt + (3 * b - 3 * cc + d - a) * tt ** 3);
	}
	return out;
}
/** A live 3D trail — feed `point(x, y, z)` per frame (or pass `follow`).
* All style fields live-mutable, like every other 3D handle. */
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
	/** @internal */ dist = 0;
	/** @internal */ fx = null;
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
	/** Record the head position for this frame. Lands EXACTLY on the live
	* head; a new history point is committed once it moves `spacing` away. */
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
	/** @internal Age/expire points. Returns true while anything remains.
	* (Follow-feeding happens at render time — AFTER the game has moved the
	* followed handle this frame — via feedFollow(), never here.) */
	update(dt) {
		if (this.follow?.dead) this.release();
		for (const p of this.points) p.age += dt;
		while (this.points.length && this.points[0].age >= this.life) this.points.shift();
		return this.points.length > 0 || !this.dead;
	}
	/** @internal Feed from the followed handle's CURRENT position. */
	feedFollow() {
		if (this.follow && !this.dead) this.point(this.follow.x + this.offset.x, this.follow.y + this.offset.y, this.follow.z + this.offset.z);
	}
	/** @internal True once there is enough to draw a ribbon. */
	get ready() {
		return this.points.length >= 2 || this.points.length === 1 && this.hasHead;
	}
	/** @internal Resample history + the live head into `out` at `offset`.
	* Returns the resampled path's arc LENGTH (the shader reconstructs the
	* absolute travelled distance per vertex as dist - s * length). */
	pack(out, offset) {
		let pts = this.points;
		const last = pts[pts.length - 1];
		if (this.hasHead && last && (last.x !== this.hx || last.y !== this.hy || last.z !== this.hz)) pts = [...pts, {
			x: this.hx,
			y: this.hy,
			z: this.hz,
			age: 0
		}];
		resampleTrail(pts, TRAIL_PTS, this.life, out, offset);
		let span = 0;
		for (let i = 1; i < pts.length; i++) {
			const a = pts[i - 1], b = pts[i];
			span += Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
		}
		return span;
	}
};
var World3d = class {
	format;
	atlas;
	/** The perspective camera — mutate freely (world units, Y-UP). It's a
	*  look-at camera: eye `(x,y,z)` + target `(tx,ty,tz)`. The helpers set the
	*  target for you; `face()` is the first-person aim (+Z forward, same
	*  convention as a mesh's `yaw`). */
	camera = {
		x: 0,
		y: 8,
		z: 18,
		tx: 0,
		ty: 0,
		tz: 0,
		fov: 60,
		/** Aim the camera at an absolute world point. */
		lookAt(x, y, z) {
			this.tx = x;
			this.ty = y;
			this.tz = z;
		},
		/** Aim the camera along a direction from its current position (e.g. a
		*  forward vector) — the target is placed one unit down that ray. */
		lookDir(dx, dy, dz) {
			this.tx = this.x + dx;
			this.ty = this.y + dy;
			this.tz = this.z + dz;
		},
		/** Aim the camera by yaw/pitch using the engine's `+Z`-forward convention —
		*  the same `yaw` a mesh uses. This is the first-person / look-around helper
		*  (set eye `x,y,z` first). */
		face(yaw, pitch = 0) {
			const f = forward(yaw, pitch);
			this.tx = this.x + f.x;
			this.ty = this.y + f.y;
			this.tz = this.z + f.z;
		}
	};
	/** Frustum culling at pack time (live-togglable; see World3dOptions). */
	cull = true;
	/** Blob-shadow config (live): enabled/alpha/max/fade/ground/lift. `lift`
	* (default 0 = hug the ground) raises the ellipse by `lift × footprint` —
	* dial it up ONLY on undulating ground (sand ripples, dunes) where a
	* ground-hugging quad would bury its middle in the first bump and render as
	* a hollow ring. Flat worlds want 0 so the blob doesn't poke up through
	* ramps/sloped tops. */
	blobs = {
		enabled: true,
		alpha: .42,
		max: 10,
		fade: 4,
		ground: 0,
		lift: 0
	};
	/**
	* Optional rigid-body physics world (`Physics3d`). Assign it once after
	* `await Physics3d.create(...)` and the Game steps + syncs every bound mesh
	* each frame — no per-frame physics code in the game. `null` = no physics
	* (the default — nothing is loaded). Type-only import: the ~1 MB core chunk
	* still loads lazily behind `Physics3d.create()`.
	*/
	physics = null;
	fog;
	/** Samples per pixel for the 3D pass (4 = smooth, 1 = raw). */
	sampleCount;
	/**
	* The 3D particle system — `world.fx.emit({ x, y, z, ... })` for bursts
	* and streams (fire, fountains, debris), `world.burst()` for VfxDef
	* recipes. Pooled CPU sim, one instanced draw for everything live.
	*/
	fx = new Particles3d();
	gpu = null;
	/** Grass fields (E6 vegetation Phase 2) — compute-spawned instanced blades,
	* one follow-window per terrain that called terrain.grass(). colorKey is
	* the terrain's first chunk bucket, for re-reading its colormap on rebuild. */
	grassFields = [];
	animated = [];
	/** @internal The lighting system (always on; zero lights = zero cost). */
	lights3d;
	shadowOpts = null;
	shadowTex = null;
	shadowPipeline;
	shadowLayout;
	shadowUni;
	curVp = null;
	curView = null;
	curProj = null;
	curBasis = null;
	curNear = .1;
	curFar = 500;
	lastVp = null;
	lastInv = null;
	lastProjA = 0;
	lastProjB = 0;
	geos = /* @__PURE__ */ new Map();
	bills = [];
	blobShadowsList = [];
	vecLayer = null;
	skyLayer = null;
	skyHandle = null;
	waterLayer = null;
	waters = [];
	/** The voxel/Minecraft layer — null until `world.voxels()`. */
	voxelLayer = null;
	/** The underwater feature — null until `world.underwater()`. Public so the
	* game reads `submerged`/`depth` and tunes it live. */
	underwater3d = null;
	underwaterLayer = null;
	/** The game's own fog, saved on the falling edge so it restores on surface. */
	uwSavedFog = void 0;
	depthViewFor = null;
	depthViewCache = null;
	flareLayer = null;
	/** null = automatic (on when a sky is attached with flare enabled). */
	flareOn = null;
	sunScreenCache = null;
	ghostPipeline;
	skinPipeline;
	skinShadowPipeline;
	skinLayout;
	skinShadowLayout;
	cullPipeline;
	cullLayout;
	cullUni;
	staticPipeline;
	staticShadowPipeline;
	staticRescan = 0;
	warnedDynamicScale = false;
	staticMeshLayout;
	staticShadowLayout;
	deformStaticLayout;
	deformStaticPipeline;
	deformSurfaceLayout;
	deformSurfacePipeline;
	deformRecs = [];
	palettesData = /* @__PURE__ */ new Float32Array(1024);
	palettesTop = 0;
	palettesBuf;
	ghostShapes = [];
	/** The steering/flocking movement system — null until `world.agents()`. */
	agents3d = null;
	agentGizmos = null;
	beams = [];
	beamInput = [];
	beamLayer = null;
	blobData = new Float32Array(256 * BLOB_FLOATS);
	blobCount = 0;
	blobBuf;
	blobBind;
	blobLayout;
	blobPipeline;
	wisps = [];
	trails = [];
	trailNoise = -1;
	trailSeed = 0;
	animSeq = 0;
	time = 0;
	sun;
	filter;
	uniformData = /* @__PURE__ */ new Float32Array(60);
	sunColData = [
		1,
		1,
		1,
		1
	];
	bbData = new Float32Array(256 * BB_FLOATS);
	wispData = new Float32Array(64 * WISP_FLOATS);
	trailData = new Float32Array(16 * TRAIL_FLOATS);
	fxData = new Float32Array(4096 * FX_FLOATS);
	device;
	meshPipeline;
	meshBlendPipeline;
	bbPipeline;
	wispPipeline;
	trailPipeline;
	trailUpPipeline;
	fxPipeline;
	meshLayout;
	bbLayout;
	wispLayout;
	pickPipeline;
	pickLayout;
	pickStaticPipeline;
	pickStaticLayout;
	pickBaseBuf;
	pickTex;
	pickDepth;
	pickW = 0;
	pickH = 0;
	uniforms;
	bbBuf;
	wispBuf;
	trailBuf;
	fxBuf;
	sampler;
	bbBind = null;
	wispBind = null;
	trailBind = null;
	fxBind = null;
	textureView = null;
	whiteView;
	envView = null;
	envTex = null;
	envSource = null;
	envDirty = true;
	envCustom = false;
	envStrength = 1;
	flatNormalView;
	constructor(device, format, atlas, opts = {}) {
		this.format = format;
		this.atlas = atlas;
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
		this.sampleCount = opts.msaa === false ? 1 : 4;
		this.cull = opts.cull ?? true;
		if (opts.blobShadows === false) this.blobs.enabled = false;
		else if (typeof opts.blobShadows === "object") Object.assign(this.blobs, opts.blobShadows);
		this.filter = opts.filter ?? "linear";
		this.lights3d = new Lights3d(device);
		this.rebuild(device);
	}
	/** Add a box (flat-shaded). `segs` grids each face (for deformers/vertex fx). */
	box(config = {}) {
		const { segs = 1 } = config;
		return this.mesh(`box:${segs}`, () => cubeVerts(segs), config);
	}
	/** Add a smooth UV sphere (unit diameter — w/h/d scale it). Drop `segs`/`rings` right down for a faceted low-poly look. */
	sphere(config = {}) {
		const { segs = 28, rings = 18 } = config;
		return this.mesh(`sphere:${segs},${rings}`, () => sphereVerts(segs, rings), config);
	}
	/** Add a capped cylinder — or a frustum via `rTop`/`rBottom` (fractions of
	* the unit radius; rTop 0 = spun cone), `open` uncaps it, `arc` sweeps a portion. */
	cylinder(config = {}) {
		const { segs = 32, rTop = 1, rBottom = 1, open = false, arc = 1 } = config;
		return this.mesh(`cylinder:${segs},${rTop},${rBottom},${open ? 1 : 0},${arc}`, () => cylinderVerts(segs, rTop, rBottom, open, arc), config);
	}
	/** Add a smooth torus (outer diameter 1, XZ plane). `tube` = tube thickness
	* (0..1 of the half-extent), `arc` sweeps a portion of the ring. */
	torus(config = {}) {
		const { tube = .32, segs = 36, sides = 18, arc = 1 } = config;
		const minor = Math.min(.48, Math.max(.02, tube)) * .5;
		return this.mesh(`torus:${tube},${segs},${sides},${arc}`, () => torusVerts(.5 - minor, minor, segs, sides, arc), config);
	}
	/** Add a torus knot — a (p, q) winding closed tube (the classic pretzel). */
	torusKnot(config = {}) {
		const { p = 2, q = 3, segs = 96, sides = 10, tube = .24 } = config;
		return this.mesh(`torusKnot:${p},${q},${segs},${sides},${tube}`, () => torusKnotVerts(p, q, segs, sides, tube), config);
	}
	/** Add a chamfered box — bevelled edges/corners (`r` = bevel radius fraction, `segs` = bevel smoothness). */
	roundedBox(config = {}) {
		const { r = .2, segs = 7 } = config;
		return this.mesh(`roundedBox:${r},${segs}`, () => roundedBoxVerts(r, segs), config);
	}
	/** Add a capped cone (apex up). `open` skips the base, `arc` sweeps a portion. */
	cone(config = {}) {
		const { segs = 32, open = false, arc = 1 } = config;
		return this.mesh(`cone:${segs},${open ? 1 : 0},${arc}`, () => coneVerts(segs, open, arc), config);
	}
	/** Add a capsule/pill (total height 1; `r` = cap radius, default 0.25). */
	capsule(config = {}) {
		const { segs = 24, rings = 8, r = .25 } = config;
		return this.mesh(`capsule:${segs},${rings},${r}`, () => capsuleVerts(segs, rings, r), config);
	}
	/** Add a wedge ramp — a unit box halved diagonally (slope rises toward -x). */
	wedge(config = {}) {
		return this.mesh("wedge", wedgeVerts, config);
	}
	/** Add a flat double-sided quad in the XZ plane. `segs` grids it — use
	* plenty under deformers/vertex effects (2 tris = one giant interpolation). */
	plane(config = {}) {
		const { segs = 1 } = config;
		return this.mesh(`plane:${segs}`, () => planeVerts(segs), config);
	}
	/** Add a flat disc or pie slice (`arc` 0..1), double-sided, XZ plane. */
	circle(config = {}) {
		const { segs = 32, arc = 1 } = config;
		return this.mesh(`circle:${segs},${arc}`, () => circleVerts(segs, arc), config);
	}
	/** Add a flat ring/annulus (`inner` = inner radius fraction, `arc` = portion), double-sided, XZ plane. */
	ring(config = {}) {
		const { inner = .5, segs = 32, arc = 1 } = config;
		return this.mesh(`ring:${inner},${segs},${arc}`, () => ringVerts(inner, segs, arc), config);
	}
	/** Add a panel — an extruded ROUNDED-CORNER rectangle (cards, plaques; scale h thin). */
	panel(config = {}) {
		const { r = .35, segs = 6 } = config;
		return this.mesh(`panel:${r},${segs}`, () => panelVerts(r, segs), config);
	}
	/** Add a disc — a filleted cylinder: coin / chip / puck / wheel (scale h thin; roll ±90° upright). */
	disc(config = {}) {
		const { fillet = .35, segs = 40, filletSegs = 6 } = config;
		return this.mesh(`disc:${fillet},${segs},${filletSegs}`, () => discVerts(fillet, segs, filletSegs), config);
	}
	/** Add a tetrahedron (4-face solid). `detail` subdivides toward a sphere. */
	tetrahedron(config = {}) {
		const { detail = 0 } = config;
		return this.mesh(`tetrahedron:${detail}`, () => polyhedronVerts("tetrahedron", detail), config);
	}
	/** Add an octahedron (8-face solid). `detail` subdivides toward a sphere. */
	octahedron(config = {}) {
		const { detail = 0 } = config;
		return this.mesh(`octahedron:${detail}`, () => polyhedronVerts("octahedron", detail), config);
	}
	/** Add a dodecahedron (12-face solid). `detail` subdivides toward a sphere. */
	dodecahedron(config = {}) {
		const { detail = 0 } = config;
		return this.mesh(`dodecahedron:${detail}`, () => polyhedronVerts("dodecahedron", detail), config);
	}
	/** Add an icosahedron (20-face solid) — evenly-sized triangles; the best faceted "geo-sphere". */
	icosahedron(config = {}) {
		const { detail = 0 } = config;
		return this.mesh(`icosahedron:${detail}`, () => polyhedronVerts("icosahedron", detail), config);
	}
	/** Add a lathe — a [d, y] profile (bottom→top) revolved around Y (vases,
	* pawns, goblets). Auto-fit to the unit box; `arc` revolves a portion. */
	lathe(config) {
		const { points, segs = 32, arc = 1 } = config;
		return this.mesh(`lathe:${segs},${arc},${JSON.stringify(points)}`, () => latheVerts(points, segs, arc), config);
	}
	/** Add a tube swept along a 3D polyline (pipes, rails, worms). Auto-fit;
	* `r` = tube radius fraction, `closed` joins the ends into a loop. */
	tube(config) {
		const { path, r = .16, sides = 12, closed = false } = config;
		return this.mesh(`tube:${r},${sides},${closed ? 1 : 0},${JSON.stringify(path)}`, () => tubeVerts(path, r, sides, closed), config);
	}
	/** Add a flat filled shape from a simple [x, z] outline (no holes),
	* double-sided, auto-fit (hearts, stars, arrows laid flat). */
	shape(config) {
		const { outline } = config;
		return this.mesh(`shape:${JSON.stringify(outline)}`, () => shapeVerts(outline), config);
	}
	/** Add an extrusion of a simple [x, z] outline through unit height, with an
	* optional rounded `bevel` (fraction of the half-height) at both caps. */
	extrude(config) {
		const { outline, bevel = 0, bevelSegs = 3 } = config;
		return this.mesh(`extrude:${bevel},${bevelSegs},${JSON.stringify(outline)}`, () => extrudeVerts(outline, bevel, bevelSegs), config);
	}
	/**
	* Add a mesh with CUSTOM geometry — the procgen-pack door. `verts` is a
	* unit-sized triangle soup (interleaved pos+normal+uv, 8 floats per vertex
	* — build with the geometry3d `Builder`, which self-corrects winding and
	* box-projects UVs for any point that doesn't supply its own).
	* Same `name` = same instanced draw; the generator runs once per name.
	*/
	custom(name, verts, config = {}) {
		return this.mesh(name, verts, config);
	}
	terrainRecs = [];
	terrainSeq = 0;
	/**
	* TERRAIN — a seeded-noise (or custom-shaped) heightfield, chunked into
	* `static: true` meshes (GPU-culled) and coloured by height/slope BANDS
	* baked into one shared colormap: `world.terrain()` alone is a full
	* island. Gameplay drives off the returned handle: `heightAt(x, z)` is
	* TRIANGLE-EXACT against the render (karts/characters sit ON the ground),
	* plus `normalAt`/`slopeAt`. Presets: shape 'island' | 'hills' |
	* 'mountains' | 'dunes' | fn, surface 'grass' | 'sand' | 'snow' | 'rock'.
	*/
	terrain(opts = {}) {
		const field = new Heightfield(opts);
		const surf = TERRAIN_SURFACES[opts.surface ?? "grass"] ?? TERRAIN_SURFACES.grass;
		const cRes = opts.colormapRes ?? 1024;
		const pixels = bakeColormapPixels(field, opts.bands ?? surf.bands, cRes, field.seed, opts.groundDetail ?? 0);
		const canvas = document.createElement("canvas");
		canvas.width = canvas.height = cRes;
		canvas.getContext("2d").putImageData(new ImageData(pixels, cRes, cRes), 0, 0);
		const view = this.uploadTexture(canvas, true);
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
			m.grain = 1;
			const fullKey = isStatic ? key + "|static" : key;
			const geo = this.geos.get(fullKey);
			geo.colorView = view;
			geo.bind = this.meshBindFor(geo.buf, view, geo.normalView, geo.mrView);
			meshes.push(m);
			keys.push(fullKey);
		}
		const rec = {
			canvas,
			keys
		};
		this.terrainRecs.push(rec);
		const handle = new Terrain3d(field, meshes, () => {
			for (const key of keys) {
				const g = this.geos.get(key);
				if (!g) continue;
				g.vbuf.destroy();
				g.buf.destroy();
				g.visBuf?.destroy();
				g.indirectBuf?.destroy();
				g.cullMetaBuf?.destroy();
				this.geos.delete(key);
			}
			const i = this.terrainRecs.indexOf(rec);
			if (i >= 0) this.terrainRecs.splice(i, 1);
			const di = this.deformRecs.findIndex((r) => r.terrain === handle);
			if (di >= 0) {
				const r = this.deformRecs[di];
				r.tex.destroy();
				r.uni.destroy();
				r.patchVbuf?.destroy();
				r.baseTex?.destroy();
				r.patchUni?.destroy();
				this.deformRecs.splice(di, 1);
			}
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
			const drec = {
				map,
				terrain: handle,
				keys,
				under: [
					uc[0],
					uc[1],
					uc[2]
				],
				rim: dopts.rim ?? 1.6,
				sparkle: dopts.sparkle ?? (surfName === "snow" ? .6 : 0),
				tex: this.makeDeformTex(map.res),
				uni: this.device.createBuffer({
					size: 64,
					usage: BITS.UNIFORM | BITS.COPY_DST
				}),
				albedo: [
					ac[0],
					ac[1],
					ac[2]
				],
				rough: surf.rough,
				berm: map.maxDepth * .3,
				patchWin: dopts.patch ?? 240,
				cells: Math.max(2, Math.round(dopts.cells ?? 288))
			};
			if (map.thickness > 0) {
				drec.patchVerts = deformPatchVerts(drec.cells);
				drec.patchVertCount = drec.patchVerts.length / 8;
				drec.patchVbuf = this.device.createBuffer({
					size: drec.patchVerts.byteLength,
					usage: BITS.VERTEX | BITS.COPY_DST
				});
				this.device.queue.writeBuffer(drec.patchVbuf, 0, drec.patchVerts.buffer, drec.patchVerts.byteOffset, drec.patchVerts.byteLength);
				drec.baseTex = this.makeBaseHeightTex(handle.field);
				drec.patchUni = this.device.createBuffer({
					size: 80,
					usage: BITS.UNIFORM | BITS.COPY_DST
				});
				this.deformSurfaceBind(drec);
			}
			this.deformRecs.push(drec);
			for (const key of keys) {
				const g = this.geos.get(key);
				if (g) {
					g.deform = drec;
					g.staticDirty = true;
				}
			}
		}, (gopts) => {
			const cmView = this.geos.get(keys[0])?.colorView ?? this.whiteView;
			const grass = new Grass3d({
				heights: field.heights,
				res: field.res,
				size: field.size,
				baseY: field.baseY
			}, cmView, this.sampler, this.format, this.sampleCount, this.lights3d.layout, gopts);
			grass.rebuild(this.device);
			grass.setWorldUniforms(this.uniforms);
			this.grassFields.push({
				terrain: handle,
				grass,
				colorKey: keys[0]
			});
			return grass;
		});
		return handle;
	}
	makeDeformTex(res) {
		return this.device.createTexture({
			size: {
				width: res,
				height: res
			},
			format: "r32float",
			usage: BITS.TEXTURE_BINDING | 2
		});
	}
	/** Bake a heightfield's (res+1)² world-Y samples into an r32float texture
	* — the snow-layer VS reads the base height off this (manual bilinear).
	* Uploaded once; static (the base terrain never changes). */
	makeBaseHeightTex(field) {
		const dim = field.res + 1;
		const tex = this.device.createTexture({
			size: {
				width: dim,
				height: dim
			},
			format: "r32float",
			usage: BITS.TEXTURE_BINDING | 2
		});
		this.device.queue.writeTexture({ texture: tex }, field.heights, { bytesPerRow: dim * 4 }, {
			width: dim,
			height: dim
		});
		return tex;
	}
	deformSurfaceBind(rec) {
		const cmView = this.geos.get(rec.keys[0])?.colorView ?? this.whiteView;
		rec.patchBind = this.device.createBindGroup({
			layout: this.deformSurfaceLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniforms }
				},
				{
					binding: 1,
					resource: { buffer: rec.patchUni }
				},
				{
					binding: 2,
					resource: rec.baseTex.createView()
				},
				{
					binding: 3,
					resource: rec.tex.createView()
				},
				{
					binding: 4,
					resource: this.sampler
				},
				{
					binding: 5,
					resource: cmView
				},
				{
					binding: 6,
					resource: this.envView ?? this.whiteView
				}
			]
		});
	}
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
	curInvVp = null;
	followCfg = null;
	/** The attached orbit rig, if any (world.orbit()) — rig.enabled pauses it. */
	rig = null;
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
	/** RETRO VECTOR LINES in the 3D world: polylines of [x, y, z] points →
	* one retained shape (live x/y/z, yaw/pitch/roll, scale, color, width in
	* SCREEN PIXELS — hairlines stay hairlines at any distance). Depth-tested
	* against the solid world; one instanced draw for every shape. */
	lines(polylines, opts = {}) {
		if (!this.vecLayer) this.vecLayer = new Vector3dLayer(this.device, this.format, this.sampleCount);
		const shape = new VectorShape3d(polylinesToSegs(polylines, opts.closed), opts);
		this.vecLayer.shapes.push(shape);
		return shape;
	}
	/** Steering GIZMOS (agents plan §5.8 — non-negotiable for tuning): when
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
	/** Crease/boundary edge extraction for a CUSTOM vert soup — the same
	* extractor `loadWireframe` uses, exposed on the world (the standalone
	* function lives in the lazy 3D chunk, not the main bundle). Feed the
	* result to `world.lines()`-style segs via `new VectorShape3d`, or just
	* use `loadWireframe` for files. */
	wireframeEdges(verts, angle = 20) {
		return wireframeEdges(verts, angle);
	}
	/** A model as RETRO WIREFRAME: load OBJ or GLB, weld the triangle soup
	* and keep only boundary + crease edges (`angle` degrees, default 20 —
	* a cube is 12 edges, not 36 triangle sides), unit-fit like every model
	* (size with `scale`). Returns a live VectorShape3d. */
	async loadWireframe(url, opts = {}) {
		if (!this.vecLayer) this.vecLayer = new Vector3dLayer(this.device, this.format, this.sampleCount);
		const groups = [];
		if (/\.glb$/i.test(url)) {
			const data = parseGlb(await loadBinary(url));
			for (const pr of data.primitives) groups.push(pr.verts);
			fitVerts(groups, data.bounds);
		} else {
			const data = parseObj(await loadText(url));
			for (const g of data.groups) groups.push(g.verts);
			fitVerts(groups, data.bounds);
		}
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
		this.vecLayer.shapes.push(shape);
		if (opts.hiddenLine) {
			const parts = [];
			for (let i = 0; i < groups.length; i++) {
				const key = "ghost:" + url + "#" + i + "#" + this.ghostShapes.length;
				let geo = this.geos.get(key);
				if (!geo) {
					geo = this.makeGeo(groups[i]);
					geo.depthOnly = true;
					this.geos.set(key, geo);
				}
				const m = new Mesh3d({ blob: false });
				geo.list.push(m);
				parts.push(m);
			}
			this.ghostShapes.push({
				shape,
				parts
			});
		}
		return shape;
	}
	/** A world-space PICKING RAY under a pointer event (the input.toWorld
	* input shape). `ground(h)` intersects it with the plane y = h — "where
	* on the floor did I click". null before the first rendered frame. */
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
	async pick(e, opts = {}) {
		if (!this.curVp || !this.canvasEl) return null;
		const cv = this.canvasEl, cw = cv.width, ch = cv.height;
		if (!cw || !ch) return null;
		const r = cv.getBoundingClientRect();
		if (!r.width || !r.height) return null;
		const px = Math.max(0, Math.min(cw - 1, Math.round((e.clientX - r.left) / r.width * cw)));
		const py = Math.max(0, Math.min(ch - 1, Math.round((e.clientY - r.top) / r.height * ch)));
		const occlude = opts.occlude !== false;
		this.ensurePickPipeline();
		this.ensurePickTargets(cw, ch);
		const spans = [];
		let base = 0, slot = 0;
		const addSpan = (geo, count, buf, map, indirect, vis) => {
			const flags = new Uint32Array(count);
			let anyOn = false;
			for (let i = 0; i < count; i++) {
				const on = map[i]?.inputEnabled ? 1 : 0;
				flags[i] = on;
				anyOn ||= on === 1;
			}
			if (!anyOn && !occlude) return;
			if (!geo.pickFlagsBuf || (geo.pickFlagsCap ?? 0) < count) {
				geo.pickFlagsBuf?.destroy();
				geo.pickFlagsBuf = this.device.createBuffer({
					size: Math.max(count * 4, 64),
					usage: BITS.STORAGE | BITS.COPY_DST
				});
				geo.pickFlagsCap = Math.max(count, 16);
			}
			this.device.queue.writeBuffer(geo.pickFlagsBuf, 0, flags);
			spans.push({
				base,
				count,
				buf,
				vbuf: geo.vbuf,
				vertCount: geo.vertCount,
				map,
				flags: geo.pickFlagsBuf,
				slot: slot++,
				indirect,
				vis
			});
			base += count;
		};
		for (const [, geo] of this.geos) {
			if (geo.skinned || geo.deform || geo.depthOnly) continue;
			if (geo.isStatic) {
				if (geo.list.length && geo.visBuf && geo.indirectBuf) addSpan(geo, geo.list.length, geo.buf, geo.list.slice(), geo.indirectBuf, geo.visBuf);
				continue;
			}
			if (geo.drawCount && geo.packMap) addSpan(geo, geo.drawCount, geo.buf, geo.packMap.slice(0, geo.drawCount));
			if (geo.transCount && geo.transBuf && geo.transMap) addSpan(geo, geo.transCount, geo.transBuf, geo.transMap.slice(0, geo.transCount));
		}
		if (!spans.length) return null;
		const need = spans.length * 256;
		if (!this.pickBaseBuf || this.pickBaseBuf.size < need) {
			this.pickBaseBuf?.destroy();
			this.pickBaseBuf = this.device.createBuffer({
				size: Math.max(need, 256 * 16),
				usage: BITS.UNIFORM | BITS.COPY_DST
			});
		}
		const baseBuf = this.pickBaseBuf, pb = /* @__PURE__ */ new Uint32Array(2);
		pb[1] = occlude ? 1 : 0;
		for (const s of spans) {
			pb[0] = s.base;
			this.device.queue.writeBuffer(baseBuf, s.slot * 256, pb);
		}
		const enc = this.device.createCommandEncoder();
		const pass = enc.beginRenderPass({
			colorAttachments: [{
				view: this.pickTex.createView(),
				clearValue: {
					r: 4294967295,
					g: 0,
					b: 0,
					a: 0
				},
				loadOp: "clear",
				storeOp: "store"
			}],
			depthStencilAttachment: {
				view: this.pickDepth.createView(),
				depthClearValue: 1,
				depthLoadOp: "clear",
				depthStoreOp: "store"
			}
		});
		pass.setScissorRect(px, py, 1, 1);
		for (const s of spans) {
			const entries = [
				{
					binding: 0,
					resource: { buffer: this.uniforms }
				},
				{
					binding: 1,
					resource: { buffer: s.buf }
				},
				{
					binding: 2,
					resource: {
						buffer: baseBuf,
						offset: 0,
						size: 256
					}
				},
				{
					binding: 3,
					resource: { buffer: s.flags }
				}
			];
			if (s.indirect) {
				pass.setPipeline(this.pickStaticPipeline);
				pass.setBindGroup(0, this.device.createBindGroup({
					layout: this.pickStaticLayout,
					entries: [...entries, {
						binding: 4,
						resource: { buffer: s.vis }
					}]
				}), [s.slot * 256]);
				pass.setVertexBuffer(0, s.vbuf);
				pass.drawIndirect(s.indirect, 0);
			} else {
				pass.setPipeline(this.pickPipeline);
				pass.setBindGroup(0, this.device.createBindGroup({
					layout: this.pickLayout,
					entries
				}), [s.slot * 256]);
				pass.setVertexBuffer(0, s.vbuf);
				pass.draw(s.vertCount, s.count);
			}
		}
		pass.end();
		const staging = this.device.createBuffer({
			size: 256,
			usage: BITS.MAP_READ | BITS.COPY_DST
		});
		enc.copyTextureToBuffer({
			texture: this.pickTex,
			origin: {
				x: px,
				y: py,
				z: 0
			}
		}, {
			buffer: staging,
			bytesPerRow: 256
		}, {
			width: 1,
			height: 1
		});
		this.device.queue.submit([enc.finish()]);
		await staging.mapAsync(1);
		const id = new Uint32Array(staging.getMappedRange())[0];
		staging.unmap();
		staging.destroy();
		if (id === 4294967295) return null;
		for (const s of spans) if (id >= s.base && id < s.base + s.count) {
			const mesh = s.map[id - s.base];
			return mesh ? {
				mesh,
				id
			} : null;
		}
		return null;
	}
	ensurePickPipeline() {
		if (this.pickPipeline) return;
		this.pickLayout = this.device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: {
					type: "uniform",
					hasDynamicOffset: true
				}
			},
			{
				binding: 3,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			}
		] });
		const vbuffers = [{
			arrayStride: 32,
			attributes: [{
				shaderLocation: 0,
				offset: 0,
				format: "float32x3"
			}]
		}];
		const common = {
			primitive: {
				topology: "triangle-list",
				cullMode: "back"
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			multisample: { count: 1 }
		};
		const mod = shaderModule(this.device, PICK_WGSL, "pick");
		this.pickPipeline = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.pickLayout] }),
			vertex: {
				module: mod,
				entryPoint: "vs",
				buffers: vbuffers
			},
			fragment: {
				module: mod,
				entryPoint: "fs",
				targets: [{ format: "r32uint" }]
			},
			...common
		});
		this.pickStaticLayout = this.device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: {
					type: "uniform",
					hasDynamicOffset: true
				}
			},
			{
				binding: 3,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 4,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			}
		] });
		const smod = shaderModule(this.device, PICK_STATIC_WGSL, "pick-static");
		this.pickStaticPipeline = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.pickStaticLayout] }),
			vertex: {
				module: smod,
				entryPoint: "vs",
				buffers: vbuffers
			},
			fragment: {
				module: smod,
				entryPoint: "fs",
				targets: [{ format: "r32uint" }]
			},
			...common
		});
	}
	ensurePickTargets(w, h) {
		if (this.pickTex && this.pickW === w && this.pickH === h) return;
		this.pickTex?.destroy();
		this.pickDepth?.destroy();
		this.pickTex = this.device.createTexture({
			size: [w, h],
			format: "r32uint",
			usage: BITS.RENDER_ATTACHMENT | 1
		});
		this.pickDepth = this.device.createTexture({
			size: [w, h],
			format: DEPTH_FORMAT,
			usage: BITS.RENDER_ATTACHMENT
		});
		this.pickW = w;
		this.pickH = h;
	}
	/** PROJECT a world point to CANVAS pixels (CSS units, origin top-left):
	* label pins, health bars, off-screen arrows. `visible` = inside the
	* frustum; `depth` 0..1 for near/far sorting. game.project3d() converts
	* onward into the 2D layer's coordinates. */
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
	/** FOLLOW camera: eases the camera to target + offset and aims at
	* target + look, every frame — the chase cam without the boilerplate.
	* Any live handle with x/y/z works (mesh, model, group). follow(null)
	* stops; using world.orbit() instead is the inspect-camera choice. */
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
	orbit(opts = {}) {
		if (!this.canvasEl) throw new Error("orbit(): no canvas — create the world via game.world3d()");
		this.rig?.detach();
		this.rig = new OrbitRig(this, this.canvasEl, opts);
		return this.rig;
	}
	/** Per-frame step: orbit rig, the wisp/trail clock, trail ageing, the
	* particle sim (the game calls this). */
	tick(dt) {
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
		this.animated = this.animated.filter((m) => !m.parts[0]?.dead);
		for (const m of this.animated) m.update(dt);
		for (let i = this.trails.length - 1; i >= 0; i--) if (!this.trails[i].update(dt)) this.trails.splice(i, 1);
		this.fx.update(dt);
		this.agents3d?.tick(dt);
		this.updateAgentGizmos();
	}
	/**
	* Trigger a one-shot VfxDef.burst recipe at a point — the same def names
	* as 2D ('impact', 'shockwave', …): particle layers ride `world.fx`,
	* expanding rings + flash discs render as camera-facing quads. The def's
	* 2D-tuned numbers scale by `opts.scale` (default 0.1 — the trail-width
	* convention); `opts.dir` aims directional emits.
	*/
	burst(vfx, x, y, z, opts = {}) {
		this.fx.burst(resolveVfx(vfx), x, y, z, opts);
	}
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
	emitter(opts = {}) {
		if (!this.gpu) this.gpu = new GpuParticles(this.device, this.format, this.sampleCount, this.filter);
		return this.gpu.emitter(opts);
	}
	/**
	* Add a dynamic POINT or SPOT light (Lighting 2.0 — clustered forward+:
	* the fragment shader only shades the lights that reach its screen
	* cluster, so dozens-to-hundreds are fine). Handles are live
	* (x/y/z/color/intensity/radius/dir/cone); kill() releases. `radius` is
	* honest — it drives both the falloff AND the cluster binning.
	*/
	light(config = {}) {
		const l = this.lights3d.light(config);
		if (config.beam && (config.type ?? "point") === "spot") this.beams.push({
			light: l,
			opts: config.beam === true ? {} : config.beam
		});
		return l;
	}
	/**
	* Directional SHADOWS for the world's sun light: a depth-only pass into a
	* shadow map, PCF-filtered in the mesh shader. `size` = the half-extent
	* of the shadowed area around the camera target (world units — the map
	* follows the camera). Pass false to turn off.
	*/
	shadows(on = true) {
		if (on === false) {
			this.shadowOpts = null;
			this.shadowTex?.destroy();
			this.shadowTex = null;
			this.lights3d.setShadowMap(null);
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
		this.shadowTex?.destroy();
		this.shadowTex = this.device.createTexture({
			size: {
				width: this.shadowOpts.res,
				height: this.shadowOpts.res
			},
			format: DEPTH_FORMAT,
			usage: BITS.RENDER_ATTACHMENT | BITS.TEXTURE_BINDING
		});
		this.lights3d.setShadowMap(this.shadowTex.createView());
	}
	/**
	* THE SKY — a procedural dome drawn behind everything: gradient + sun
	* disc + two drifting FBM cloud layers + stars and a moon at night. ONE
	* `sky.time` dial (0..24 h) drives the whole day: sky colours, sun
	* direction/colour/intensity, hemisphere ambient, fog colour and the env
	* bake move together (`drive: false` keeps manual lighting control).
	* `sky.cycle(120)` = a full day every two minutes. `sky.storm` 0→1 packs
	* and darkens the clouds and dims the sun. All fields live.
	*/
	sky(opts = {}) {
		if (!this.skyLayer) this.skyLayer = new Sky3dLayer(this.device, this.format, this.sampleCount);
		this.skyHandle = new Sky3d(opts);
		return this.skyHandle;
	}
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
	agents(opts = {}) {
		if (!this.agents3d) this.agents3d = new Agents3d(opts);
		return this.agents3d;
	}
	water(opts = {}) {
		if (!this.waterLayer) this.waterLayer = new Water3dLayer(this.device, this.format, this.sampleCount, this.lights3d.layout);
		const w = new Water3d(opts);
		this.waters.push(w);
		return w;
	}
	/**
	* VOXELS — a Minecraft-style block world: a chunked, editable volume with a
	* procedural block "texture pack", exposed-face meshing + baked AO, and a
	* `raycast` for hitting/placing blocks. Lit and fogged by THIS world's sun
	* and sky, so it matches the day/night dial for free. Author it with
	* `vox.generate((x,y,z) => id)`, edit with `vox.set(x,y,z,id)`. One per world.
	*/
	voxels(opts = {}) {
		if (!this.voxelLayer) this.voxelLayer = new Voxels3d(this.device, this.format, this.sampleCount, this.uniforms, this.camera, opts);
		return this.voxelLayer;
	}
	/** BLOCK EDITOR — the reusable "aim at a block and change it" logic: a
	*  debounced raycast, the target OUTLINE + placement GHOST, held-button
	*  cadence, optional per-block hardness, and an anti-embed guard. It carries
	*  no effects — it EMITS `onHit`/`onBreak`/`onPlace` (also returned from
	*  `update`) so the game spawns its own debris/drops/sounds. Drive it with a
	*  camera ray each frame (e.g. from `mcControls`). See minecraft-controls.md. */
	voxelEditor(vox, opts = {}) {
		return new VoxelEditor(this, vox, opts);
	}
	/**
	* UNDERWATER — makes being BELOW the water FEEL underwater: per-channel
	* light absorption (murk closes in, red dies first), a soft vignette, the
	* half-in/half-out waterline split, caustics on the seabed (M2) and the
	* Snell's-window surface from below (M3). Depth-gated by `minDepth` so a
	* puddle never triggers it, and byte-free until this call. Defaults to the
	* first grid water body; pass `water:` to pick another.
	*/
	underwater(opts = {}) {
		if (!this.underwaterLayer) {
			this.underwaterLayer = new Underwater3dLayer(this.device, this.format);
			this.lights3d.setCaustic(this.underwaterLayer.causticView);
		}
		const body = opts.water ?? this.waters.find((w) => w.kind === "grid") ?? null;
		this.underwater3d = new Underwater3d(opts, body);
		return this.underwater3d;
	}
	/** Add the underwater absorption/murk over the resolved 3D image, inside the
	* open scene pass (called by the Game, next to the SSAO/rays composites). */
	compositeUnderwater(pass, worldDepth) {
		this.underwaterLayer?.composite(pass, worldDepth);
	}
	/** Encode the HALF-RES underwater shaft march — encoder-level, must run
	* BEFORE the scene pass whose composite samples it (game.ts calls this
	* next to the SSAO/god-ray passes). */
	renderUnderwaterShafts(encoder, worldDepth, canvasW, canvasH) {
		this.underwaterLayer?.renderShafts(encoder, worldDepth, canvasW, canvasH);
	}
	/**
	* LENS FLARE on the sun — a procedural ghost chain, depth-occluded (a
	* hill covering the sun collapses it) and faded by night/storm/
	* off-screen. ON automatically when a sky is attached (`world.sky({
	* flare: false })` opts out); call this to force it either way in
	* manual-lighting scenes. Pair with `world.rays(true)` for light shafts.
	*/
	flare(on = true) {
		this.flareOn = on;
	}
	/** The sun's screen position + faded intensity this frame (null when
	* behind the camera or fully faded) — god rays consume this. */
	get sunScreen() {
		return this.sunScreenCache;
	}
	/** Re-aim the directional SUN light (the direction light travels), and
	* optionally retune the ambient floor — time-of-day systems drive this
	* per frame. */
	setSun(x, y, z, ambient) {
		this.sun.x = x;
		this.sun.y = y;
		this.sun.z = z;
		if (ambient != null) this.sun.ambient = ambient;
		if (!this.envCustom) this.envDirty = true;
	}
	/** HEMISPHERE ambient: `intensity` scales it; `sky` tints light arriving
	* from above, `ground` from below (bounce), blended by each surface
	* normal — moonlight blue over lamplit amber transforms a night scene
	* for free. One colour = flat tinted ambient; default white = classic. */
	setAmbient(intensity, sky, ground) {
		this.sun.ambient = intensity;
		if (sky != null) this.sun.sky = sky;
		if (ground != null) this.sun.ground = ground;
		else if (sky != null) this.sun.ground = sky;
		if (!this.envCustom) this.envDirty = true;
	}
	/** Create a transform-node GROUP (renders nothing): parent meshes/models
	* to it and pose the whole assembly through one handle. */
	group(config = {}) {
		return new Group3d(config);
	}
	/** Aim any posed handle's local +Z at a world point (meshes, groups,
	* models — anything with x/y/z + yaw/pitch). NOTE: uses the handle's OWN
	* coordinates, so for parented handles aim at a target in the SAME local
	* space as the handle. */
	lookAt(handle, x, y, z) {
		const e = lookAtEuler(handle.x, handle.y, handle.z, x, y, z);
		handle.yaw = e.yaw;
		handle.pitch = e.pitch;
	}
	/** @internal Post-submit hook (Game calls after queue.submit) — starts the
	* async alive-count readbacks, which may not overlap a submit. */
	afterSubmit() {
		this.gpu?.afterSubmit();
	}
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
	/** Add a camera-facing sprite, anchored at its BASE point (it stands on x/y/z). */
	billboard(config) {
		const b = new Billboard3d(config);
		this.bills.push(b);
		return b;
	}
	/**
	* Add ONE soft contact-shadow ellipse (see `BlobShadow3d`). Parent it to an
	* assembly group so the whole object grounds with a single clean blob instead
	* of a per-mesh cluster. Only draws while blob shadows are enabled.
	*/
	blobShadow(config = {}) {
		const b = new BlobShadow3d(config);
		this.blobShadowsList.push(b);
		return b;
	}
	/**
	* Add a WISP — steam/smoke as a true-3D twisting ribbon (Bruno Simon's
	* coffee-smoke technique): a subdivided plane, vertex-twisted around its
	* own axis and wind-blown, both driven BY the noise texture; the fragment
	* scrolls the noise upward with a density remap and edge fades. Pass a
	* TILEABLE grayscale noise frame. Anchored at its BASE (stands on x/y/z).
	*/
	wisp(config) {
		const w = new Wisp3d(config);
		this.wisps.push(w);
		return w;
	}
	/** Live handle counts + draw-call count (HUD/debug). `gpuParticles` is the
	* GPU emitters' alive total — an async readback, ~2 frames stale. */
	get counts() {
		let meshes = 0, drawn = 0, staticMeshes = 0, draws = (this.bills.length ? 1 : 0) + (this.wisps.length ? 1 : 0) + (this.trails.length ? 1 : 0) + (this.fx.count ? 1 : 0) + (this.blobCount ? 1 : 0) + this.waters.length;
		for (const g of this.geos.values()) {
			if (g.isStatic) {
				staticMeshes += g.list.length;
				if (g.list.length) draws++;
				continue;
			}
			meshes += g.list.length;
			drawn += g.drawCount;
			if (g.drawCount) draws++;
		}
		const gpuParticles = this.gpu?.count ?? 0;
		draws += this.gpu?.list.length ?? 0;
		draws += this.grassFields.length * 2;
		if (this.vecLayer?.count) draws++;
		return {
			meshes,
			drawn,
			culled: meshes - drawn,
			staticMeshes,
			billboards: this.bills.length,
			blobs: this.blobCount,
			lines: this.vecLayer?.count ?? 0,
			wisps: this.wisps.length,
			trails: this.trails.length,
			particles: this.fx.count,
			gpuParticles,
			waters: this.waters.length,
			draws
		};
	}
	mesh(kind, gen, config) {
		const key = config.static ? kind + "|static" : kind;
		let geo = this.geos.get(key);
		if (!geo) {
			geo = this.makeGeo(gen());
			if (config.static) {
				geo.isStatic = true;
				geo.visBuf = this.device.createBuffer({
					size: 256 * 4,
					usage: BITS.STORAGE | BITS.COPY_DST
				});
				geo.indirectBuf = this.device.createBuffer({
					size: 16,
					usage: BITS.STORAGE | BITS.COPY_DST | BITS.INDIRECT
				});
				geo.cullMetaBuf = this.device.createBuffer({
					size: 16,
					usage: BITS.UNIFORM | BITS.COPY_DST
				});
			}
			this.geos.set(key, geo);
		}
		const m = new Mesh3d(config);
		geo.list.push(m);
		if (geo.isStatic) geo.staticDirty = true;
		return m;
	}
	makeGeo(verts, colorSrc, normalSrc, mrSrc) {
		const buf = this.device.createBuffer({
			size: 256 * MESH_FLOATS * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		const vbuf = this.device.createBuffer({
			size: verts.byteLength,
			usage: BITS.VERTEX | BITS.COPY_DST
		});
		this.device.queue.writeBuffer(vbuf, 0, verts);
		const colorView = colorSrc ? this.uploadTexture(colorSrc, true) : void 0;
		const mrView = mrSrc ? this.uploadTexture(mrSrc, false) : void 0;
		const normalView = normalSrc ? this.uploadTexture(normalSrc, false) : void 0;
		return {
			verts,
			vertCount: verts.length / 8,
			list: [],
			drawCount: 0,
			data: new Float32Array(256 * MESH_FLOATS),
			vbuf,
			buf,
			bind: this.meshBindFor(buf, colorView, normalView, mrView),
			colorSrc,
			normalSrc,
			mrSrc,
			colorView,
			normalView,
			mrView
		};
	}
	/** @internal One loaded-model part = one bucket keyed by url#index, with
	* optional standalone textures. Re-loading the same url reuses the bucket
	* (two ducks = two instances in the same draws). */
	/** Allocate a palette slice (jointCount mat4s) from the global pool;
	* returns the MAT4-unit base the shader indexes with. */
	paletteAlloc(joints) {
		const base = this.palettesTop;
		this.palettesTop += joints;
		if (this.palettesTop * 16 > this.palettesData.length) {
			let len = this.palettesData.length;
			while (len < this.palettesTop * 16) len *= 2;
			const grown = new Float32Array(len);
			grown.set(this.palettesData);
			this.palettesData = grown;
			this.palettesBuf.destroy();
			this.palettesBuf = this.device.createBuffer({
				size: len * 4,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
			for (const [, g] of this.geos) if (g.skinned) {
				g.bind = this.skinBindFor(g);
				g.shadowBind = void 0;
			}
		}
		return base;
	}
	/** @internal A VS-SKINNED bucket: interleaved 44-byte verts (built once —
	* the ArrayBuffer factory only runs when the bucket is new), shared by
	* every instance; each instance gets a palette slice + base. */
	skinnedMesh(kind, build, colorSrc, normalSrc, mrSrc, joints) {
		let geo = this.geos.get(kind);
		if (!geo) {
			const raw = build();
			const vbuf = this.device.createBuffer({
				size: raw.byteLength,
				usage: BITS.VERTEX | BITS.COPY_DST
			});
			this.device.queue.writeBuffer(vbuf, 0, raw);
			const buf = this.device.createBuffer({
				size: 256 * MESH_FLOATS * 4,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
			geo = {
				verts: new Float32Array(raw),
				vertCount: raw.byteLength / 44,
				list: [],
				drawCount: 0,
				data: new Float32Array(256 * MESH_FLOATS),
				vbuf,
				buf,
				bind: null,
				skinned: true,
				basesData: /* @__PURE__ */ new Uint32Array(256),
				colorSrc,
				normalSrc,
				mrSrc,
				colorView: colorSrc ? this.uploadTexture(colorSrc, true) : void 0,
				normalView: normalSrc ? this.uploadTexture(normalSrc, false) : void 0,
				mrView: mrSrc ? this.uploadTexture(mrSrc, false) : void 0
			};
			geo.basesBuf = this.device.createBuffer({
				size: 256 * 4,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
			geo.bind = this.skinBindFor(geo);
			this.geos.set(kind, geo);
		}
		const m = new Mesh3d({ blob: false });
		if (geo.colorSrc) m.texture = -2;
		if (geo.normalSrc) m.normalMap = -2;
		m.paletteBase = this.paletteAlloc(joints);
		geo.list.push(m);
		return m;
	}
	/** The skinned bucket's bind group (mesh layout + palette pool + bases). */
	skinBindFor(geo) {
		return this.device.createBindGroup({
			layout: this.skinLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniforms }
				},
				{
					binding: 1,
					resource: { buffer: geo.buf }
				},
				{
					binding: 2,
					resource: this.sampler
				},
				{
					binding: 3,
					resource: geo.colorView ?? this.textureView ?? this.whiteView
				},
				{
					binding: 4,
					resource: geo.normalView ?? this.textureView ?? this.flatNormalView
				},
				{
					binding: 5,
					resource: this.envView ?? this.whiteView
				},
				{
					binding: 6,
					resource: geo.mrView ?? this.whiteView
				},
				{
					binding: 7,
					resource: { buffer: this.palettesBuf }
				},
				{
					binding: 8,
					resource: { buffer: geo.basesBuf }
				}
			]
		});
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
	/**
	* Load a Wavefront OBJ (+ its MTL and diffuse textures where they exist)
	* as a live model: one bucket per material, all under one Model3d handle.
	* Real-world OBJs lie constantly — the declared mtllib name is tried
	* first, then <basename>.mtl beside the file; map_Kd paths resolve by
	* BASENAME beside the obj and silently fall back to the Kd colour.
	* Vertices unit-fit like every primitive (size with w/h/d).
	*/
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
	/**
	* Load a GLB (glTF 2.0 Binary) as a live model: one bucket per primitive,
	* PBR materials mapped straight onto the mesh shader (baseColor factor +
	* texture as sRGB, metallic/roughness factors, normal map + scale;
	* embedded images decode from the BIN chunk — no external files). Node
	* transforms are baked (static pose; skinning/animation is stage 3).
	* Vertices unit-fit like every primitive (size with w/h/d).
	*/
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
	/**
	* ENVIRONMENT reflections (IBL-lite): glossy and metallic surfaces
	* reflect an equirect sky — the fix for "metals go dark away from
	* lights". ON by default with a PROCEDURAL sky baked from the
	* hemisphere ambient + the sun (re-baked when setSun/setAmbient move
	* them); pass a URL or canvas for a real panorama, `false` to disable,
	* or { strength } to tune. Roughness picks the mip: mirrors get the
	* sharp sky, matte surfaces a blurred average.
	*/
	async env(src = true) {
		if (src === false) {
			this.envStrength = 0;
			return;
		}
		if (typeof src === "object" && !(src instanceof HTMLCanvasElement)) {
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
		if (src instanceof HTMLCanvasElement) {
			this.envSource = src;
			this.envCustom = true;
			this.envDirty = true;
		}
	}
	/** Bake the procedural equirect sky: hemisphere gradient + sun disc. */
	bakeProceduralEnv() {
		const W = 256, H = 128;
		const c = document.createElement("canvas");
		c.width = W;
		c.height = H;
		const g = c.getContext("2d");
		const sky = this.sun.sky === "#ffffff" ? "#a8bce0" : this.sun.sky;
		const gnd = this.sun.ground === "#ffffff" ? "#5a5248" : this.sun.ground;
		const c1 = rgba(sky), c2 = rgba(gnd);
		const css = (c, k, lift = 0) => `rgb(${Math.min(255, c[0] * 255 * k + lift)},${Math.min(255, c[1] * 255 * k + lift)},${Math.min(255, c[2] * 255 * k + lift)})`;
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
	/** (Re)upload the env with a FULL MIP CHAIN — CPU-downsampled via canvas
	* (rough reflections sample deep mips; the 1×1 tail is the sky average). */
	uploadEnv() {
		const src = this.envCustom && this.envSource ? this.envSource : this.bakeProceduralEnv();
		if (!this.envCustom) this.envSource = src;
		let w = Math.max(2, src.width), h = Math.max(1, src.height);
		const mips = 1 + Math.floor(Math.log2(Math.max(w, h)));
		this.envTex?.destroy();
		this.envTex = this.device.createTexture({
			size: {
				width: w,
				height: h
			},
			format: "rgba8unorm-srgb",
			mipLevelCount: mips,
			usage: BITS.TEXTURE_BINDING | 2 | BITS.RENDER_ATTACHMENT
		});
		let level = document.createElement("canvas");
		level.width = w;
		level.height = h;
		level.getContext("2d").drawImage(src, 0, 0, w, h);
		for (let m = 0; m < mips; m++) {
			this.device.queue.copyExternalImageToTexture({ source: level }, {
				texture: this.envTex,
				mipLevel: m
			}, {
				width: level.width,
				height: level.height
			});
			if (m + 1 < mips) {
				const next = document.createElement("canvas");
				next.width = Math.max(1, level.width >> 1);
				next.height = Math.max(1, level.height >> 1);
				next.getContext("2d").drawImage(level, 0, 0, next.width, next.height);
				level = next;
			}
		}
		this.envView = this.envTex.createView();
		for (const [, geo] of this.geos) {
			geo.bind = geo.skinned ? this.skinBindFor(geo) : this.meshBindFor(geo.buf, geo.colorView, geo.normalView, geo.mrView);
			if (geo.transBuf) geo.transBind = this.meshBindFor(geo.transBuf, geo.colorView, geo.normalView, geo.mrView);
			if (geo.isStatic && geo.visBuf) this.staticBinds(geo);
		}
		for (const rec of this.deformRecs) if (rec.patchUni) this.deformSurfaceBind(rec);
		this.envDirty = false;
	}
	meshBindFor(buf, colorView, normalView, mrView) {
		return this.device.createBindGroup({
			layout: this.meshLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniforms }
				},
				{
					binding: 1,
					resource: { buffer: buf }
				},
				{
					binding: 2,
					resource: this.sampler
				},
				{
					binding: 3,
					resource: colorView ?? this.textureView ?? this.whiteView
				},
				{
					binding: 4,
					resource: normalView ?? this.textureView ?? this.flatNormalView
				},
				{
					binding: 5,
					resource: this.envView ?? this.whiteView
				},
				{
					binding: 6,
					resource: mrView ?? this.whiteView
				}
			]
		});
	}
	/** Upload an image as a STANDALONE mesh texture (model loaders — bypasses
	* the shelf atlas). Colour textures upload as sRGB (authored images decode
	* correctly); normal maps stay linear. Sources are kept on the Geo for
	* device-loss re-upload. */
	uploadTexture(src, srgb) {
		const tex = this.device.createTexture({
			size: {
				width: src.width,
				height: src.height
			},
			format: srgb ? "rgba8unorm-srgb" : "rgba8unorm",
			usage: BITS.TEXTURE_BINDING | 2 | BITS.RENDER_ATTACHMENT
		});
		this.device.queue.copyExternalImageToTexture({ source: src }, { texture: tex }, {
			width: src.width,
			height: src.height
		});
		return tex.createView();
	}
	/** (Re)create every GPU-side object — the device-loss recovery path. */
	rebuild(device) {
		this.device = device;
		this.uniforms = device.createBuffer({
			size: this.uniformData.byteLength,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.bbBuf = device.createBuffer({
			size: this.bbData.byteLength,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.wispBuf = device.createBuffer({
			size: this.wispData.byteLength,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.trailBuf = device.createBuffer({
			size: this.trailData.byteLength,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.fxBuf = device.createBuffer({
			size: this.fxData.byteLength,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.sampler = device.createSampler({
			magFilter: this.filter,
			minFilter: this.filter,
			mipmapFilter: "linear"
		});
		const white = device.createTexture({
			size: {
				width: 1,
				height: 1
			},
			format: "rgba8unorm",
			usage: BITS.TEXTURE_BINDING | 2
		});
		device.queue.writeTexture({ texture: white }, new Uint8Array([
			255,
			255,
			255,
			255
		]), { bytesPerRow: 256 }, {
			width: 1,
			height: 1
		});
		this.whiteView = white.createView();
		const flatN = device.createTexture({
			size: {
				width: 1,
				height: 1
			},
			format: "rgba8unorm",
			usage: BITS.TEXTURE_BINDING | 2
		});
		device.queue.writeTexture({ texture: flatN }, new Uint8Array([
			128,
			128,
			255,
			255
		]), { bytesPerRow: 256 }, {
			width: 1,
			height: 1
		});
		this.flatNormalView = flatN.createView();
		this.meshLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			},
			{
				binding: 3,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 4,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 5,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 6,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			}
		] });
		this.bbLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			},
			{
				binding: 3,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			}
		] });
		this.wispLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				sampler: {}
			},
			{
				binding: 3,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				texture: {}
			}
		] });
		this.shadowLayout = device.createBindGroupLayout({ entries: [{
			binding: 0,
			visibility: BITS.STAGE_VERTEX,
			buffer: { type: "uniform" }
		}, {
			binding: 1,
			visibility: BITS.STAGE_VERTEX,
			buffer: { type: "read-only-storage" }
		}] });
		const shadowModule = device.createShaderModule({ code: SHADOW_WGSL });
		this.shadowPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.shadowLayout] }),
			vertex: {
				module: shadowModule,
				entryPoint: "vs",
				buffers: [{
					arrayStride: 32,
					attributes: [
						{
							shaderLocation: 0,
							offset: 0,
							format: "float32x3"
						},
						{
							shaderLocation: 1,
							offset: 12,
							format: "float32x3"
						},
						{
							shaderLocation: 2,
							offset: 24,
							format: "float32x2"
						}
					]
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "none"
			}
		});
		this.shadowUni = device.createBuffer({
			size: 64,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.shadowTex = null;
		this.lights3d.rebuild(device);
		const meshModule = device.createShaderModule({ code: MESH_WGSL });
		this.vecLayer?.rebuild(device);
		this.envTex = null;
		this.envView = null;
		this.envDirty = true;
		this.blobLayout = device.createBindGroupLayout({ entries: [{
			binding: 0,
			visibility: BITS.STAGE_VERTEX,
			buffer: { type: "uniform" }
		}, {
			binding: 1,
			visibility: BITS.STAGE_VERTEX,
			buffer: { type: "read-only-storage" }
		}] });
		this.blobBuf = device.createBuffer({
			size: this.blobData.byteLength,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		const blobModule = shaderModule(device, BLOB_WGSL, "World3d blobs");
		this.blobPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.blobLayout] }),
			vertex: {
				module: blobModule,
				entryPoint: "vs"
			},
			fragment: {
				module: blobModule,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						},
						alpha: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						}
					}
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: false,
				depthCompare: "less-equal"
			},
			primitive: { topology: "triangle-strip" },
			multisample: { count: this.sampleCount }
		});
		this.blobBind = device.createBindGroup({
			layout: this.blobLayout,
			entries: [{
				binding: 0,
				resource: { buffer: this.uniforms }
			}, {
				binding: 1,
				resource: { buffer: this.blobBuf }
			}]
		});
		const bbModule = device.createShaderModule({ code: BB_WGSL });
		const wispModule = device.createShaderModule({ code: WISP_WGSL });
		const trailModule = device.createShaderModule({ code: TRAIL_WGSL });
		const fxModule = device.createShaderModule({ code: FX_WGSL });
		for (const mod of [
			meshModule,
			bbModule,
			wispModule,
			trailModule,
			fxModule
		]) mod.getCompilationInfo().then((info) => {
			for (const m of info.messages) if (m.type === "error") console.error(`World3d WGSL ${m.lineNum}:${m.linePos} ${m.message}`);
		});
		this.meshPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.meshLayout, this.lights3d.layout] }),
			vertex: {
				module: meshModule,
				entryPoint: "vs",
				buffers: [{
					arrayStride: 32,
					attributes: [
						{
							shaderLocation: 0,
							offset: 0,
							format: "float32x3"
						},
						{
							shaderLocation: 1,
							offset: 12,
							format: "float32x3"
						},
						{
							shaderLocation: 2,
							offset: 24,
							format: "float32x2"
						}
					]
				}]
			},
			fragment: {
				module: meshModule,
				entryPoint: "fs",
				targets: [{ format: this.format }]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "back"
			},
			multisample: { count: this.sampleCount }
		});
		this.meshBlendPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.meshLayout, this.lights3d.layout] }),
			vertex: {
				module: meshModule,
				entryPoint: "vs",
				buffers: [{
					arrayStride: 32,
					attributes: [
						{
							shaderLocation: 0,
							offset: 0,
							format: "float32x3"
						},
						{
							shaderLocation: 1,
							offset: 12,
							format: "float32x3"
						},
						{
							shaderLocation: 2,
							offset: 24,
							format: "float32x2"
						}
					]
				}]
			},
			fragment: {
				module: meshModule,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						},
						alpha: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						}
					}
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: false,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "back"
			},
			multisample: { count: this.sampleCount }
		});
		this.skinLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			},
			{
				binding: 3,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 4,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 5,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 6,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 7,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 8,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			}
		] });
		const skinModule = shaderModule(device, skinnedVariant(MESH_WGSL, 7, 0), "World3d skinned mesh");
		this.skinPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.skinLayout, this.lights3d.layout] }),
			vertex: {
				module: skinModule,
				entryPoint: "vs",
				buffers: SKINNED_VERTEX_BUFFERS
			},
			fragment: {
				module: skinModule,
				entryPoint: "fs",
				targets: [{ format: this.format }]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "back"
			},
			multisample: { count: this.sampleCount }
		});
		this.skinShadowLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 3,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			}
		] });
		const skinShadowModule = shaderModule(device, skinnedVariant(SHADOW_WGSL, 2, 0), "World3d skinned shadow");
		this.skinShadowPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.skinShadowLayout] }),
			vertex: {
				module: skinShadowModule,
				entryPoint: "vs",
				buffers: SKINNED_VERTEX_BUFFERS
			},
			depthStencil: {
				format: "depth24plus",
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "none"
			}
		});
		this.palettesBuf = device.createBuffer({
			size: this.palettesData.byteLength,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.cullLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_COMPUTE,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_COMPUTE,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_COMPUTE,
				buffer: { type: "storage" }
			},
			{
				binding: 3,
				visibility: BITS.STAGE_COMPUTE,
				buffer: { type: "storage" }
			},
			{
				binding: 4,
				visibility: BITS.STAGE_COMPUTE,
				buffer: { type: "uniform" }
			}
		] });
		this.cullPipeline = device.createComputePipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.cullLayout] }),
			compute: {
				module: shaderModule(device, CULL_WGSL, "World3d GPU cull"),
				entryPoint: "cs"
			}
		});
		this.cullUni = device.createBuffer({
			size: 208,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		const staticMeshLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			},
			{
				binding: 3,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 4,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 5,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 6,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 9,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			}
		] });
		this.staticMeshLayout = staticMeshLayout;
		const staticModule = shaderModule(device, staticVariant(MESH_WGSL, 9), "World3d static mesh");
		this.staticPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [staticMeshLayout, this.lights3d.layout] }),
			vertex: {
				module: staticModule,
				entryPoint: "vs",
				buffers: [{
					arrayStride: 32,
					attributes: [
						{
							shaderLocation: 0,
							offset: 0,
							format: "float32x3"
						},
						{
							shaderLocation: 1,
							offset: 12,
							format: "float32x3"
						},
						{
							shaderLocation: 2,
							offset: 24,
							format: "float32x2"
						}
					]
				}]
			},
			fragment: {
				module: staticModule,
				entryPoint: "fs",
				targets: [{ format: this.format }]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "back"
			},
			multisample: { count: this.sampleCount }
		});
		this.deformStaticLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			},
			{
				binding: 3,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 4,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 5,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 6,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 7,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 8,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				texture: { sampleType: "unfilterable-float" }
			},
			{
				binding: 9,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			}
		] });
		this.deformSurfaceLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_VERTEX,
				texture: { sampleType: "unfilterable-float" }
			},
			{
				binding: 3,
				visibility: BITS.STAGE_VERTEX,
				texture: { sampleType: "unfilterable-float" }
			},
			{
				binding: 4,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			},
			{
				binding: 5,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 6,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			}
		] });
		const surfaceModule = shaderModule(device, DEFORM_SURFACE_WGSL, "World3d snow layer");
		this.deformSurfacePipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.deformSurfaceLayout, this.lights3d.layout] }),
			vertex: {
				module: surfaceModule,
				entryPoint: "vs",
				buffers: [{
					arrayStride: 32,
					attributes: [
						{
							shaderLocation: 0,
							offset: 0,
							format: "float32x3"
						},
						{
							shaderLocation: 1,
							offset: 12,
							format: "float32x3"
						},
						{
							shaderLocation: 2,
							offset: 24,
							format: "float32x2"
						}
					]
				}]
			},
			fragment: {
				module: surfaceModule,
				entryPoint: "fs",
				targets: [{ format: this.format }]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "back"
			},
			multisample: { count: this.sampleCount }
		});
		const deformModule = shaderModule(device, staticVariant(deformVariant(MESH_WGSL), 9), "World3d deform terrain");
		this.deformStaticPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.deformStaticLayout, this.lights3d.layout] }),
			vertex: {
				module: deformModule,
				entryPoint: "vs",
				buffers: [{
					arrayStride: 32,
					attributes: [
						{
							shaderLocation: 0,
							offset: 0,
							format: "float32x3"
						},
						{
							shaderLocation: 1,
							offset: 12,
							format: "float32x3"
						},
						{
							shaderLocation: 2,
							offset: 24,
							format: "float32x2"
						}
					]
				}]
			},
			fragment: {
				module: deformModule,
				entryPoint: "fs",
				targets: [{ format: this.format }]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "back"
			},
			multisample: { count: this.sampleCount }
		});
		this.staticShadowLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			}
		] });
		const staticShadowModule = shaderModule(device, staticVariant(SHADOW_WGSL, 2), "World3d static shadow");
		this.staticShadowPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.staticShadowLayout] }),
			vertex: {
				module: staticShadowModule,
				entryPoint: "vs",
				buffers: [{
					arrayStride: 32,
					attributes: [
						{
							shaderLocation: 0,
							offset: 0,
							format: "float32x3"
						},
						{
							shaderLocation: 1,
							offset: 12,
							format: "float32x3"
						},
						{
							shaderLocation: 2,
							offset: 24,
							format: "float32x2"
						}
					]
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "none"
			}
		});
		this.ghostPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.meshLayout, this.lights3d.layout] }),
			vertex: {
				module: meshModule,
				entryPoint: "vs",
				buffers: [{
					arrayStride: 32,
					attributes: [
						{
							shaderLocation: 0,
							offset: 0,
							format: "float32x3"
						},
						{
							shaderLocation: 1,
							offset: 12,
							format: "float32x3"
						},
						{
							shaderLocation: 2,
							offset: 24,
							format: "float32x2"
						}
					]
				}]
			},
			fragment: {
				module: meshModule,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					writeMask: 0
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "back"
			},
			multisample: { count: this.sampleCount }
		});
		this.bbPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.bbLayout] }),
			vertex: {
				module: bbModule,
				entryPoint: "vs"
			},
			fragment: {
				module: bbModule,
				entryPoint: "fs",
				targets: [{ format: this.format }]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: { topology: "triangle-strip" },
			multisample: { count: this.sampleCount }
		});
		this.wispPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.wispLayout] }),
			vertex: {
				module: wispModule,
				entryPoint: "vs"
			},
			fragment: {
				module: wispModule,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						},
						alpha: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						}
					}
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: false,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "none"
			},
			multisample: { count: this.sampleCount }
		});
		this.trailPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.wispLayout] }),
			vertex: {
				module: trailModule,
				entryPoint: "vs"
			},
			fragment: {
				module: trailModule,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						},
						alpha: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						}
					}
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: false,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "back"
			},
			multisample: { count: this.sampleCount }
		});
		this.trailUpPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.wispLayout] }),
			vertex: {
				module: trailModule,
				entryPoint: "vs",
				constants: { UP: 1 }
			},
			fragment: {
				module: trailModule,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						},
						alpha: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						}
					}
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: false,
				depthCompare: "less-equal"
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "none"
			},
			multisample: { count: this.sampleCount }
		});
		this.fxPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.bbLayout, this.lights3d.layout] }),
			vertex: {
				module: fxModule,
				entryPoint: "vs"
			},
			fragment: {
				module: fxModule,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						},
						alpha: {
							srcFactor: "one",
							dstFactor: "one-minus-src-alpha"
						}
					}
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: false,
				depthCompare: "less-equal"
			},
			primitive: { topology: "triangle-strip" },
			multisample: { count: this.sampleCount }
		});
		for (const [, g] of this.geos) {
			g.vbuf = device.createBuffer({
				size: g.verts.byteLength,
				usage: BITS.VERTEX | BITS.COPY_DST
			});
			device.queue.writeBuffer(g.vbuf, 0, g.verts);
			g.buf = device.createBuffer({
				size: Math.max(g.data.byteLength, 256 * MESH_FLOATS * 4),
				usage: BITS.STORAGE | BITS.COPY_DST
			});
			g.colorView = g.colorSrc ? this.uploadTexture(g.colorSrc, true) : void 0;
			g.mrView = g.mrSrc ? this.uploadTexture(g.mrSrc, false) : void 0;
			g.normalView = g.normalSrc ? this.uploadTexture(g.normalSrc, false) : void 0;
			if (g.skinned) {
				g.basesBuf = device.createBuffer({
					size: Math.max(4, g.basesData.length) * 4,
					usage: BITS.STORAGE | BITS.COPY_DST
				});
				g.bind = this.skinBindFor(g);
			} else if (g.isStatic) {
				g.visBuf = device.createBuffer({
					size: Math.max(256, g.list.length) * 4,
					usage: BITS.STORAGE | BITS.COPY_DST
				});
				g.indirectBuf = device.createBuffer({
					size: 16,
					usage: BITS.STORAGE | BITS.COPY_DST | BITS.INDIRECT
				});
				g.cullMetaBuf = device.createBuffer({
					size: 16,
					usage: BITS.UNIFORM | BITS.COPY_DST
				});
				g.staticDirty = true;
				g.bind = this.meshBindFor(g.buf, g.colorView, g.normalView, g.mrView);
			} else g.bind = this.meshBindFor(g.buf, g.colorView, g.normalView, g.mrView);
			g.shadowBind = void 0;
			g.transBuf = void 0;
			g.transBind = void 0;
			g.transCount = 0;
		}
		for (const t of this.terrainRecs) {
			const view = this.uploadTexture(t.canvas, true);
			for (const key of t.keys) {
				const g = this.geos.get(key);
				if (!g) continue;
				g.colorView = view;
				g.bind = this.meshBindFor(g.buf, view, g.normalView, g.mrView);
			}
			for (const gf of this.grassFields) if (t.keys.includes(gf.colorKey)) gf.grass.setColormap(view);
		}
		for (const gf of this.grassFields) {
			gf.grass.rebuild(device, this.lights3d.layout);
			gf.grass.setWorldUniforms(this.uniforms);
		}
		for (const r of this.deformRecs) {
			r.tex = this.makeDeformTex(r.map.res);
			r.uni = device.createBuffer({
				size: 64,
				usage: BITS.UNIFORM | BITS.COPY_DST
			});
			r.map.fullDirty = true;
			if (r.patchVerts) {
				r.patchVbuf = device.createBuffer({
					size: r.patchVerts.byteLength,
					usage: BITS.VERTEX | BITS.COPY_DST
				});
				device.queue.writeBuffer(r.patchVbuf, 0, r.patchVerts.buffer, r.patchVerts.byteOffset, r.patchVerts.byteLength);
				r.baseTex = this.makeBaseHeightTex(r.terrain.field);
				r.patchUni = device.createBuffer({
					size: 80,
					usage: BITS.UNIFORM | BITS.COPY_DST
				});
				this.deformSurfaceBind(r);
			}
		}
		this.bbBind = null;
		this.wispBind = null;
		this.trailBind = null;
		this.fxBind = null;
		this.textureView = null;
		this.gpu?.rebuild(device);
		this.skyLayer?.rebuild(device);
		this.waterLayer?.rebuild(device);
		this.underwaterLayer?.rebuild(device);
		if (this.underwaterLayer) this.lights3d.setCaustic(this.underwaterLayer.causticView);
		this.voxelLayer?.rebuild(device, this.uniforms);
		this.flareLayer?.rebuild(device);
		this.depthViewFor = null;
		this.depthViewCache = null;
		this.lastVp = null;
		this.lastInv = null;
	}
	/** Point the mesh + billboard + wisp pipelines at the shared atlas texture. */
	setTexture(view) {
		this.textureView = view;
		for (const [, g] of this.geos) {
			g.bind = this.meshBindFor(g.buf, g.colorView, g.normalView);
			if (g.isStatic) g.staticDirty = true;
		}
		this.bbBind = this.device.createBindGroup({
			layout: this.bbLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniforms }
				},
				{
					binding: 1,
					resource: { buffer: this.bbBuf }
				},
				{
					binding: 2,
					resource: this.sampler
				},
				{
					binding: 3,
					resource: this.textureView
				}
			]
		});
		this.wispBind = this.device.createBindGroup({
			layout: this.wispLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniforms }
				},
				{
					binding: 1,
					resource: { buffer: this.wispBuf }
				},
				{
					binding: 2,
					resource: this.sampler
				},
				{
					binding: 3,
					resource: this.textureView
				}
			]
		});
		this.trailBind = this.device.createBindGroup({
			layout: this.wispLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniforms }
				},
				{
					binding: 1,
					resource: { buffer: this.trailBuf }
				},
				{
					binding: 2,
					resource: this.sampler
				},
				{
					binding: 3,
					resource: this.textureView
				}
			]
		});
		this.fxBind = this.device.createBindGroup({
			layout: this.bbLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniforms }
				},
				{
					binding: 1,
					resource: { buffer: this.fxBuf }
				},
				{
					binding: 2,
					resource: this.sampler
				},
				{
					binding: 3,
					resource: this.textureView
				}
			]
		});
	}
	/**
	* PER-FRAME PREP, encoded before any render pass: camera matrices, mesh/
	* billboard instance packing + uploads (buffer growth must happen before
	* the shadow pass references the buffers), the cluster-light kernel, the
	* GPU-particle sim (against LAST frame's depth + matrices), and the
	* directional shadow-map pass.
	*/
	prepare(encoder, aspect, dt, depth, screenW, screenH) {
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
		const proj = mat4Perspective(cam.fov, aspect, near, far);
		const vp = mat4Mul(proj, view);
		this.curVp = vp;
		this.curInvVp = null;
		this.curView = view;
		this.curProj = proj;
		this.curNear = near;
		this.curFar = far;
		const basis = viewBasis(view);
		this.curBasis = basis;
		if (this.skyHandle && this.skyLayer) {
			const sky = this.skyHandle;
			const st = sky.tick(dt);
			if (sky.drive) {
				const storm = Math.min(1, Math.max(0, sky.storm));
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
				if (!this.envCustom && Math.abs(st.sunPos[1] - sky.lastBakeY) > .04) {
					this.envDirty = true;
					sky.lastBakeY = st.sunPos[1];
				}
			}
			const fw = {
				x: cam.tx - eye.x,
				y: cam.ty - eye.y,
				z: cam.tz - eye.z
			};
			const fl = Math.hypot(fw.x, fw.y, fw.z) || 1;
			const tanY = Math.tan(cam.fov * Math.PI / 360);
			this.skyLayer.write(st, sky, this.time, [
				fw.x / fl,
				fw.y / fl,
				fw.z / fl
			], [
				basis.right.x,
				basis.right.y,
				basis.right.z
			], [
				basis.up.x,
				basis.up.y,
				basis.up.z
			], tanY * aspect, tanY);
		}
		if (this.underwater3d && this.underwaterLayer && !this.underwater3d.dead) {
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
			this.underwaterLayer.pack(uw, vp, eye, this.sun, sunI, this.time, storm);
		}
		const fogC = this.fog ? rgba(this.fog.color) : [
			0,
			0,
			0,
			0
		];
		const u = this.uniformData;
		u.set(vp, 0);
		u.set([
			eye.x,
			eye.y,
			eye.z,
			0
		], 16);
		u.set([
			fogC[0],
			fogC[1],
			fogC[2],
			this.sun.ambient
		], 20);
		u.set([
			this.fog?.near ?? 0,
			this.fog?.far ?? 1,
			this.fog ? 1 : 0,
			this.time
		], 24);
		const ll = Math.hypot(this.sun.x, this.sun.y, this.sun.z) || 1;
		u.set([
			this.sun.x / ll,
			this.sun.y / ll,
			this.sun.z / ll,
			0
		], 28);
		u.set([
			basis.right.x,
			basis.right.y,
			basis.right.z,
			0
		], 32);
		u.set([
			basis.up.x,
			basis.up.y,
			basis.up.z,
			0
		], 36);
		const skyC = rgba(this.sun.sky), gndC = rgba(this.sun.ground);
		u.set([
			skyC[0],
			skyC[1],
			skyC[2],
			this.envView ? this.envStrength : 0
		], 40);
		u.set([
			gndC[0],
			gndC[1],
			gndC[2],
			0
		], 44);
		u.set(this.sunColData, 48);
		const uwh = this.underwater3d;
		if (uwh && uwh.causticActive && uwh.water) {
			u.set([
				1,
				uwh.water.levelNow(),
				uwh.caustics.scale,
				uwh.causticSpeedNow
			], 52);
			u.set([
				uwh.causticStrengthNow,
				uwh.caustics.maxDepth,
				uwh.caustics.rgbSplit,
				uwh.sunSigma[1]
			], 56);
		} else {
			u.set([
				0,
				0,
				1,
				1
			], 52);
			u.set([
				1,
				20,
				0,
				.05
			], 56);
		}
		this.device.queue.writeBuffer(this.uniforms, 0, u);
		this.voxelLayer?.remeshDirty();
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
		if ((this.flareOn ?? this.skyHandle?.flare ?? false) && this.sunScreenCache) {
			if (!this.flareLayer) this.flareLayer = new Flare3dLayer(this.device, this.format, this.sampleCount, this.sampleCount > 1);
			if (this.depthViewFor !== depth) {
				this.depthViewFor = depth;
				this.depthViewCache = depth.createView();
			}
			const s = this.sunScreenCache;
			this.flareLayer.update(s.ndcX, s.ndcY, Math.min(1, s.intensity), s.color, screenW, screenH, this.depthViewCache);
		} else if (this.flareLayer) this.flareLayer.visible = false;
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
		if (this.palettesTop > 0) {
			for (const m of this.animated) m.writePalettes(this.palettesData);
			this.device.queue.writeBuffer(this.palettesBuf, 0, this.palettesData.buffer, 0, this.palettesTop * 16 * 4);
		}
		this.ghostShapes = this.ghostShapes.filter((g) => {
			if (g.shape.dead) {
				for (const m of g.parts) m.kill();
				return false;
			}
			for (const m of g.parts) {
				m.x = g.shape.x;
				m.y = g.shape.y;
				m.z = g.shape.z;
				m.yaw = g.shape.yaw;
				m.pitch = g.shape.pitch;
				m.roll = g.shape.roll;
				m.w = m.h = m.d = g.shape.scale;
			}
			return true;
		});
		this.blobCount = 0;
		const blobsOn = this.blobs.enabled;
		for (const [, geo] of this.geos) {
			if (geo.isStatic) continue;
			geo.list = geo.list.filter((m) => !m.dead);
			geo.drawCount = 0;
			if (!geo.list.length) continue;
			if (geo.list.length * MESH_FLOATS > geo.data.length) {
				let len = geo.data.length;
				while (len < geo.list.length * MESH_FLOATS) len *= 2;
				geo.data = new Float32Array(len);
				geo.buf.destroy();
				geo.buf = this.device.createBuffer({
					size: len * 4,
					usage: BITS.STORAGE | BITS.COPY_DST
				});
				geo.bind = this.meshBindFor(geo.buf, geo.colorView, geo.normalView, geo.mrView);
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
				if (geo.skinned) {
					if (geo.drawCount >= geo.basesData.length) {
						const grown = new Uint32Array(geo.basesData.length * 2);
						grown.set(geo.basesData);
						geo.basesData = grown;
						geo.basesBuf.destroy();
						geo.basesBuf = this.device.createBuffer({
							size: grown.length * 4,
							usage: BITS.STORAGE | BITS.COPY_DST
						});
						geo.bind = this.skinBindFor(geo);
						geo.shadowBind = void 0;
					}
					geo.basesData[geo.drawCount] = m.paletteBase;
				}
				let d = geo.data;
				let o;
				if (m.alpha < 1 && !geo.skinned) {
					const need = geo.list.length * MESH_FLOATS;
					if (!geo.transData || geo.transData.length < need) geo.transData = new Float32Array(need);
					d = geo.transData;
					o = transCount++ * MESH_FLOATS;
					(geo.transMap ??= [])[transCount - 1] = m;
				} else {
					o = geo.drawCount++ * MESH_FLOATS;
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
				d[o + 12] = proll;
				d[o + 8] = c[0];
				d[o + 9] = c[1];
				d[o + 10] = c[2];
				d[o + 11] = m.alpha * c[3];
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
			if (geo.drawCount) {
				this.device.queue.writeBuffer(geo.buf, 0, geo.data.buffer, 0, geo.drawCount * MESH_FLOATS * 4);
				if (geo.skinned) this.device.queue.writeBuffer(geo.basesBuf, 0, geo.basesData.buffer, 0, geo.drawCount * 4);
			}
			geo.transCount = transCount;
			if (transCount) {
				const bytes = transCount * MESH_FLOATS * 4;
				if (!geo.transBuf || geo.transBuf.size < bytes) {
					geo.transBuf?.destroy();
					geo.transBuf = this.device.createBuffer({
						size: Math.max(bytes, MESH_FLOATS * 4 * 8),
						usage: BITS.STORAGE | BITS.COPY_DST
					});
					geo.transBind = this.meshBindFor(geo.transBuf, geo.colorView, geo.normalView, geo.mrView);
				}
				this.device.queue.writeBuffer(geo.transBuf, 0, geo.transData.buffer, 0, bytes);
			}
		}
		this.bills = this.bills.filter((b) => !b.dead);
		if (this.bills.length && this.bbBind) {
			if (this.bills.length * BB_FLOATS > this.bbData.length) {
				let len = this.bbData.length;
				while (len < this.bills.length * BB_FLOATS) len *= 2;
				this.bbData = new Float32Array(len);
				this.bbBuf.destroy();
				this.bbBuf = this.device.createBuffer({
					size: len * 4,
					usage: BITS.STORAGE | BITS.COPY_DST
				});
				if (this.textureView) this.setTexture(this.textureView);
			}
			this.bills.forEach((b, i) => {
				if (blobsOn) {
					const bp = blobParams(b.w * .7, b.w * .7, b.y - this.blobs.ground, this.blobs);
					if (bp) this.pushBlob(b.x, b.z, bp.rx, bp.rz, 0, bp.alpha);
				}
				const o = i * BB_FLOATS;
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
				}
			});
			this.device.queue.writeBuffer(this.bbBuf, 0, this.bbData.buffer, 0, this.bills.length * BB_FLOATS * 4);
		}
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
		if (!this.warnedDynamicScale) {
			let dyn = 0;
			for (const [, g] of this.geos) if (!g.isStatic) dyn += g.list.length;
			if (dyn > 2e4) {
				this.warnedDynamicScale = true;
				console.warn(`World3d: ${dyn} DYNAMIC meshes are CPU-packed every frame. Mark world geometry that never moves with static: true — it packs once and is frustum-culled on the GPU (buildings/terrain/props static; characters/pickups dynamic). See skills/world3d.md.`);
			}
		}
		this.staticRescan = this.staticRescan + 1 & 31;
		let anyStatic = false;
		for (const [, geo] of this.geos) {
			if (!geo.isStatic) continue;
			if (this.staticRescan === 0 && !geo.staticDirty && geo.list.some((m) => m.dead)) geo.staticDirty = true;
			if (geo.staticDirty) this.packStatic(geo);
			if (geo.list.length) anyStatic = true;
		}
		if (anyStatic) {
			const cu = /* @__PURE__ */ new Float32Array(52);
			cu.set(camPlanes ?? frustumPlanes(vp), 0);
			if (shadowPlanes) cu.set(shadowPlanes, 24);
			cu[48] = shadowPlanes ? 1 : 0;
			this.device.queue.writeBuffer(this.cullUni, 0, cu);
			const cp = encoder.beginComputePass();
			cp.setPipeline(this.cullPipeline);
			for (const [, geo] of this.geos) {
				if (!geo.isStatic || !geo.list.length) continue;
				this.device.queue.writeBuffer(geo.indirectBuf, 0, new Uint32Array([
					geo.vertCount,
					0,
					0,
					0
				]));
				cp.setBindGroup(0, geo.cullBind);
				cp.dispatchWorkgroups(Math.ceil(geo.list.length / 64));
			}
			cp.end();
		}
		if (this.blobCount) this.device.queue.writeBuffer(this.blobBuf, 0, this.blobData.buffer, 0, this.blobCount * BLOB_FLOATS * 4);
		if (this.envDirty && typeof document !== "undefined") this.uploadEnv();
		if (this.waterLayer && this.waters.length) {
			this.waters = this.waters.filter((w) => !w.dead);
			if (this.depthViewFor !== depth) {
				this.depthViewFor = depth;
				this.depthViewCache = depth.createView();
			}
			this.waterLayer.update(this.waters, this.uniforms, this.sampler, this.envView ?? this.whiteView, this.depthViewCache, far / (near - far), near * far / (near - far), screenW, screenH, this.time, encoder, cam.x, cam.z, dt);
		}
		this.beams = this.beams.filter((b) => !b.light.dead);
		if (this.beams.length) {
			if (this.depthViewFor !== depth) {
				this.depthViewFor = depth;
				this.depthViewCache = depth.createView();
			}
			this.beamInput.length = 0;
			for (const b of this.beams) {
				const c = rgba(b.opts.color ?? b.light.color);
				this.beamInput.push({
					light: b.light,
					opts: {
						length: b.opts.length,
						intensity: b.opts.intensity,
						rgb: [
							c[0],
							c[1],
							c[2]
						]
					}
				});
			}
			if (!this.beamLayer) this.beamLayer = new Beam3dLayer(this.device, this.format, this.sampleCount, this.sampleCount > 1);
			this.beamLayer.update(this.beamInput, vp, cam.x, cam.y, cam.z, far / (near - far), near * far / (near - far), far * .04, this.depthViewCache);
		}
		for (const rec of this.deformRecs) {
			rec.terrain.stepCarvers(dt);
			const map = rec.map;
			if (map.fullDirty) this.device.queue.writeTexture({ texture: rec.tex }, map.data, { bytesPerRow: map.res * 4 }, {
				width: map.res,
				height: map.res
			});
			else if (map.dirtyX1 > map.dirtyX0 && map.dirtyZ1 > map.dirtyZ0) {
				const w = map.dirtyX1 - map.dirtyX0, h = map.dirtyZ1 - map.dirtyZ0;
				const patch = new Float32Array(w * h);
				for (let iz = 0; iz < h; iz++) {
					const src = (map.dirtyZ0 + iz) * map.res + map.dirtyX0;
					patch.set(map.data.subarray(src, src + w), iz * w);
				}
				this.device.queue.writeTexture({
					texture: rec.tex,
					origin: {
						x: map.dirtyX0,
						y: map.dirtyZ0
					}
				}, patch, { bytesPerRow: w * 4 }, {
					width: w,
					height: h
				});
			}
			map.clearDirty();
			const cutR = rec.patchUni ? rec.patchWin * .5 * .92 : 0;
			this.device.queue.writeBuffer(rec.uni, 0, new Float32Array([
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
			]));
			if (rec.patchUni) this.device.queue.writeBuffer(rec.patchUni, 0, new Float32Array([
				map.patchCx,
				map.patchCz,
				rec.patchWin,
				rec.cells,
				map.cx,
				map.cz,
				1 / map.window,
				map.res,
				rec.terrain.size,
				rec.terrain.field.res,
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
			]));
		}
		this.vecLayer?.prepare(vp, screenW, screenH, near);
		this.lights3d.update(encoder, view, near, far, Math.tan(cam.fov * Math.PI / 360) * aspect, Math.tan(cam.fov * Math.PI / 360), screenW, screenH, shadowVP, this.shadowOpts?.bias ?? 3e-4, this.shadowOpts ? 1 / this.shadowOpts.res : 0, this.shadowOpts ? 2 * this.shadowOpts.size / this.shadowOpts.res * 1.5 : 0);
		this.gpu?.compute(encoder, dt, this.time, depth, this.lastVp, this.lastInv, this.lastProjA, this.lastProjB, this.atlas);
		for (const gf of this.grassFields) gf.grass.compute(encoder, vp, cam.x, cam.y, cam.z, this.time, cam.tx - cam.x, cam.tz - cam.z);
		this.lastVp = vp;
		this.lastInv = this.gpu ? mat4Inverse(vp) : null;
		this.lastProjA = far / (near - far);
		this.lastProjB = near * far / (near - far);
		if (shadowVP && this.shadowTex) {
			this.device.queue.writeBuffer(this.shadowUni, 0, shadowVP);
			const sp = encoder.beginRenderPass({
				colorAttachments: [],
				depthStencilAttachment: {
					view: this.shadowTex.createView(),
					depthClearValue: 1,
					depthLoadOp: "clear",
					depthStoreOp: "store"
				}
			});
			let shadowCurrent = null;
			for (const [, geo] of this.geos) {
				if (!geo.drawCount) continue;
				const want = geo.skinned ? this.skinShadowPipeline : this.shadowPipeline;
				if (want !== shadowCurrent) {
					sp.setPipeline(want);
					shadowCurrent = want;
				}
				if (!geo.shadowBind || geo.shadowBindBuf !== geo.buf) {
					geo.shadowBind = this.device.createBindGroup({
						layout: geo.skinned ? this.skinShadowLayout : this.shadowLayout,
						entries: geo.skinned ? [
							{
								binding: 0,
								resource: { buffer: this.shadowUni }
							},
							{
								binding: 1,
								resource: { buffer: geo.buf }
							},
							{
								binding: 2,
								resource: { buffer: this.palettesBuf }
							},
							{
								binding: 3,
								resource: { buffer: geo.basesBuf }
							}
						] : [{
							binding: 0,
							resource: { buffer: this.shadowUni }
						}, {
							binding: 1,
							resource: { buffer: geo.buf }
						}]
					});
					geo.shadowBindBuf = geo.buf;
				}
				sp.setBindGroup(0, geo.shadowBind);
				sp.setVertexBuffer(0, geo.vbuf);
				sp.draw(geo.vertCount, geo.drawCount);
			}
			for (const [, geo] of this.geos) {
				if (!geo.isStatic || !geo.list.length || !geo.staticShadowBind) continue;
				if (shadowCurrent !== this.staticShadowPipeline) {
					sp.setPipeline(this.staticShadowPipeline);
					shadowCurrent = this.staticShadowPipeline;
				}
				sp.setBindGroup(0, geo.staticShadowBind);
				sp.setVertexBuffer(0, geo.vbuf);
				sp.drawIndirect(geo.indirectBuf, 0);
			}
			sp.end();
		}
	}
	/** @internal This frame's projection + linearisation terms (SSAO). */
	get projInfo() {
		if (!this.curProj) return null;
		return {
			proj: this.curProj,
			projA: this.curFar / (this.curNear - this.curFar),
			projB: this.curNear * this.curFar / (this.curNear - this.curFar)
		};
	}
	/** Render the OPAQUE half (meshes + billboards) into the depth-writing 3D
	* pass — prepare() has already packed and uploaded everything. */
	renderOpaque(pass) {
		let current = null;
		for (const [, geo] of this.geos) {
			if (!geo.drawCount) continue;
			const want = geo.skinned ? this.skinPipeline : geo.depthOnly ? this.ghostPipeline : this.meshPipeline;
			if (want !== current) {
				pass.setPipeline(want);
				if (!current) pass.setBindGroup(1, this.lights3d.bind);
				current = want;
			}
			pass.setBindGroup(0, geo.bind);
			pass.setVertexBuffer(0, geo.vbuf);
			pass.draw(geo.vertCount, geo.drawCount);
		}
		let staticCur = null;
		for (const [, geo] of this.geos) {
			if (!geo.isStatic || !geo.list.length || !geo.staticBind) continue;
			const want = geo.deform ? this.deformStaticPipeline : this.staticPipeline;
			if (want !== staticCur) {
				pass.setPipeline(want);
				if (!staticCur) pass.setBindGroup(1, this.lights3d.bind);
				staticCur = want;
			}
			pass.setBindGroup(0, geo.staticBind);
			pass.setVertexBuffer(0, geo.vbuf);
			pass.drawIndirect(geo.indirectBuf, 0);
		}
		let surfSet = false;
		for (const rec of this.deformRecs) {
			if (!rec.patchBind || !rec.patchVbuf) continue;
			if (!surfSet) {
				pass.setPipeline(this.deformSurfacePipeline);
				pass.setBindGroup(1, this.lights3d.bind);
				surfSet = true;
			}
			pass.setBindGroup(0, rec.patchBind);
			pass.setVertexBuffer(0, rec.patchVbuf);
			pass.draw(rec.patchVertCount);
		}
		for (const gf of this.grassFields) {
			gf.grass.setWorldUniforms(this.uniforms);
			gf.grass.render(pass, this.lights3d.bind);
		}
		this.voxelLayer?.render(pass);
		if (this.bills.length && this.bbBind) {
			pass.setPipeline(this.bbPipeline);
			pass.setBindGroup(0, this.bbBind);
			pass.draw(4, this.bills.length);
		}
		if (this.skyHandle && this.skyLayer) this.skyLayer.draw(pass);
	}
	/** Render the TRANSLUCENT half (trails, particles, GPU emitters, wisps)
	* into pass B — depth read-only, so the pass can also SAMPLE that depth
	* (soft particles). Uses the uniforms renderOpaque() wrote this frame. */
	/** Pack a STATIC bucket (once — on creation, kill-rescan or device
	* loss): the full instance array uploads and stays; the GPU culls it
	* every frame after this. */
	packStatic(geo) {
		geo.list = geo.list.filter((m) => !m.dead);
		const n = geo.list.length;
		if (n * MESH_FLOATS > geo.data.length) {
			let len = geo.data.length;
			while (len < n * MESH_FLOATS) len *= 2;
			geo.data = new Float32Array(len);
			geo.buf.destroy();
			geo.buf = this.device.createBuffer({
				size: len * 4,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
		}
		if (n * 4 > geo.visBuf.size) {
			geo.visBuf.destroy();
			geo.visBuf = this.device.createBuffer({
				size: Math.max(256, n) * 4,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
		}
		const d = geo.data;
		for (let i = 0; i < n; i++) {
			const m = geo.list[i];
			const o = i * MESH_FLOATS;
			const c = rgba(m.color);
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
		if (n) this.device.queue.writeBuffer(geo.buf, 0, geo.data.buffer, 0, n * MESH_FLOATS * 4);
		this.device.queue.writeBuffer(geo.cullMetaBuf, 0, new Float32Array([
			n,
			0,
			0,
			0
		]));
		this.staticBinds(geo);
		geo.staticDirty = false;
	}
	staticBinds(geo) {
		const entries = [
			{
				binding: 0,
				resource: { buffer: this.uniforms }
			},
			{
				binding: 1,
				resource: { buffer: geo.buf }
			},
			{
				binding: 2,
				resource: this.sampler
			},
			{
				binding: 3,
				resource: geo.colorView ?? this.textureView ?? this.whiteView
			},
			{
				binding: 4,
				resource: geo.normalView ?? this.textureView ?? this.flatNormalView
			},
			{
				binding: 5,
				resource: this.envView ?? this.whiteView
			},
			{
				binding: 6,
				resource: geo.mrView ?? this.whiteView
			},
			{
				binding: 9,
				resource: { buffer: geo.visBuf }
			}
		];
		if (geo.deform) entries.push({
			binding: 7,
			resource: { buffer: geo.deform.uni }
		}, {
			binding: 8,
			resource: geo.deform.tex.createView()
		});
		geo.staticBind = this.device.createBindGroup({
			layout: geo.deform ? this.deformStaticLayout : this.staticMeshLayout,
			entries
		});
		geo.staticShadowBind = this.device.createBindGroup({
			layout: this.staticShadowLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.shadowUni }
				},
				{
					binding: 1,
					resource: { buffer: geo.buf }
				},
				{
					binding: 2,
					resource: { buffer: geo.visBuf }
				}
			]
		});
		geo.cullBind = this.device.createBindGroup({
			layout: this.cullLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.cullUni }
				},
				{
					binding: 1,
					resource: { buffer: geo.buf }
				},
				{
					binding: 2,
					resource: { buffer: geo.visBuf }
				},
				{
					binding: 3,
					resource: { buffer: geo.indirectBuf }
				},
				{
					binding: 4,
					resource: { buffer: geo.cullMetaBuf }
				}
			]
		});
	}
	pushBlob(x, z, rx, rz, yaw, alpha) {
		if ((this.blobCount + 1) * BLOB_FLOATS > this.blobData.length) {
			const grown = new Float32Array(this.blobData.length * 2);
			grown.set(this.blobData);
			this.blobData = grown;
			this.blobBuf.destroy();
			this.blobBuf = this.device.createBuffer({
				size: grown.byteLength,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
			this.blobBind = this.device.createBindGroup({
				layout: this.blobLayout,
				entries: [{
					binding: 0,
					resource: { buffer: this.uniforms }
				}, {
					binding: 1,
					resource: { buffer: this.blobBuf }
				}]
			});
		}
		const o = this.blobCount++ * BLOB_FLOATS;
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
	renderTranslucent(pass) {
		if (this.blobCount) {
			pass.setPipeline(this.blobPipeline);
			pass.setBindGroup(0, this.blobBind);
			pass.draw(4, this.blobCount);
		}
		if (this.waterLayer && this.waters.length) this.waterLayer.draw(pass, this.lights3d.bind);
		let transSet = false;
		for (const [, geo] of this.geos) {
			if (!geo.transCount || !geo.transBind) continue;
			if (!transSet) {
				pass.setPipeline(this.meshBlendPipeline);
				pass.setBindGroup(1, this.lights3d.bind);
				transSet = true;
			}
			pass.setBindGroup(0, geo.transBind);
			pass.setVertexBuffer(0, geo.vbuf);
			pass.draw(geo.vertCount, geo.transCount);
		}
		this.beamLayer?.draw(pass);
		this.vecLayer?.draw(pass);
		for (const t of this.trails) t.feedFollow();
		const ready = this.trails.filter((t) => t.ready);
		const liveTrails = [...ready.filter((t) => t.facing !== "up"), ...ready.filter((t) => t.facing === "up")];
		const viewCount = liveTrails.length - ready.filter((t) => t.facing === "up").length;
		if (liveTrails.length && this.trailBind) {
			if (liveTrails.length * TRAIL_FLOATS > this.trailData.length) {
				let len = this.trailData.length;
				while (len < liveTrails.length * TRAIL_FLOATS) len *= 2;
				this.trailData = new Float32Array(len);
				this.trailBuf.destroy();
				this.trailBuf = this.device.createBuffer({
					size: len * 4,
					usage: BITS.STORAGE | BITS.COPY_DST
				});
				if (this.textureView) this.setTexture(this.textureView);
			}
			liveTrails.forEach((t, i) => {
				const o = i * TRAIL_FLOATS;
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
			this.device.queue.writeBuffer(this.trailBuf, 0, this.trailData.buffer, 0, liveTrails.length * TRAIL_FLOATS * 4);
			if (viewCount > 0) {
				pass.setPipeline(this.trailPipeline);
				pass.setBindGroup(0, this.trailBind);
				pass.draw(TRAIL_SEGS * 6, viewCount);
			}
			if (liveTrails.length > viewCount) {
				pass.setPipeline(this.trailUpPipeline);
				pass.setBindGroup(0, this.trailBind);
				pass.draw(TRAIL_SEGS * 6, liveTrails.length - viewCount, 0, viewCount);
			}
		}
		if (this.fxBind) {
			const atlas = this.atlas;
			let n = 0;
			let data = this.fxData;
			const fxCap = () => data.length / FX_FLOATS | 0;
			this.fx.pack((x, y, z, size, rot, mode, r, g, b, a, add, frame, p, lit) => {
				if (n >= fxCap()) {
					const grown = new Float32Array(data.length * 2);
					grown.set(data);
					data = this.fxData = grown;
				}
				const o = n * FX_FLOATS;
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
				const f = atlas.frames[mode === 1 && frame >= 0 ? frame : 0];
				if (f) {
					data[o + 12] = f.u0;
					data[o + 13] = f.v0;
					data[o + 14] = f.u1;
					data[o + 15] = f.v1;
				}
				n++;
			});
			if (n > 0) {
				if (n * FX_FLOATS * 4 > this.fxBuf.size) {
					this.fxBuf.destroy();
					this.fxBuf = this.device.createBuffer({
						size: this.fxData.byteLength,
						usage: BITS.STORAGE | BITS.COPY_DST
					});
					if (this.textureView) this.setTexture(this.textureView);
				}
				this.device.queue.writeBuffer(this.fxBuf, 0, this.fxData.buffer, 0, n * FX_FLOATS * 4);
				pass.setPipeline(this.fxPipeline);
				pass.setBindGroup(0, this.fxBind);
				pass.setBindGroup(1, this.lights3d.bind);
				pass.draw(4, n);
			}
		}
		this.gpu?.render(pass, this.uniforms, this.textureView);
		this.wisps = this.wisps.filter((w) => !w.dead);
		if (this.wisps.length && this.wispBind) {
			if (this.wisps.length * WISP_FLOATS > this.wispData.length) {
				let len = this.wispData.length;
				while (len < this.wisps.length * WISP_FLOATS) len *= 2;
				this.wispData = new Float32Array(len);
				this.wispBuf.destroy();
				this.wispBuf = this.device.createBuffer({
					size: len * 4,
					usage: BITS.STORAGE | BITS.COPY_DST
				});
				if (this.textureView) this.setTexture(this.textureView);
			}
			this.wisps.forEach((w, i) => {
				const o = i * WISP_FLOATS;
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
				}
				d[o + 16] = w.remap[0];
				d[o + 17] = w.remap[1];
				d[o + 18] = w.yaw;
				d[o + 19] = 0;
			});
			this.device.queue.writeBuffer(this.wispBuf, 0, this.wispData.buffer, 0, this.wisps.length * WISP_FLOATS * 4);
			pass.setPipeline(this.wispPipeline);
			pass.setBindGroup(0, this.wispBind);
			pass.draw(WISP_SEGX * WISP_SEGY * 6, this.wisps.length);
		}
		this.flareLayer?.draw(pass);
	}
};
//#endregion
//#region src/lib/rays.ts
var UNIFORM_FLOATS = 12;
function raysWGSL(ms) {
	return `
struct RU {
  sun: vec4f,     // sun uv (0..1), intensity, decay
  info: vec4f,    // halfW, halfH, fullW, fullH
  color: vec4f,   // sun rgb + aspect
}
@group(0) @binding(0) var<uniform> ru: RU;
@group(0) @binding(1) ${ms ? "var depthTex: texture_depth_multisampled_2d;" : "var depthTex: texture_depth_2d;"}

struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: VSOut;
  out.pos = vec4f(p[vi], 0.0, 1.0);
  out.uv = vec2f(p[vi].x * 0.5 + 0.5, 0.5 - p[vi].y * 0.5);
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let sunUV = ru.sun.xy;
  // March from THIS pixel toward the sun. THE MASK IS THE SUN REGION, not
  // "any sky": a sample only pours in light if it is sky AND near the sun
  // — that is what turns a diffuse wash into defined BEAMS radiating
  // through the gaps in a silhouette (the first cut accumulated all sky
  // along the path and vanished into the already-bright horizon).
  let STEPS = 28.0;
  let delta = (sunUV - in.uv) / STEPS;
  var p = in.uv;
  var acc = 0.0;
  var w = 1.0;
  var norm = 0.0;
  for (var i = 0; i < 28; i = i + 1) {
    p += delta;
    let px = vec2i(clamp(p, vec2f(0.0), vec2f(0.9999)) * ru.info.zw);
    let d = textureLoad(depthTex, px, 0);
    let sd = length((p - sunUV) * vec2f(ru.color.w, 1.0));
    acc += step(0.99995, d) * smoothstep(0.42, 0.05, sd) * w;
    norm += w;
    w *= ru.sun.w;
  }
  // Radial falloff: shafts live NEAR the sun, not across the whole frame.
  let dist = length((in.uv - sunUV) * vec2f(ru.color.w, 1.0));
  let fall = smoothstep(1.05, 0.12, dist);
  return vec4f(acc / max(norm, 1e-4) * ru.sun.z * fall, 0.0, 0.0, 1.0);
}
`;
}
var COMPOSITE_WGSL = `
struct CU { color: vec4f }   // sun rgb + unused
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var rays: texture_2d<f32>;
@group(0) @binding(2) var<uniform> cu: CU;

struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: VSOut;
  out.pos = vec4f(p[vi], 0.0, 1.0);
  out.uv = vec2f(p[vi].x * 0.5 + 0.5, 0.5 - p[vi].y * 0.5);
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let r = textureSample(rays, samp, in.uv).r;
  return vec4f(cu.color.rgb * r, 0.0);   // additive: dst + src
}
`;
var RaysPass = class {
	format;
	/** Live-tunable, read every render. */
	opts = {
		strength: .9,
		decay: .94
	};
	/** Off by default — render()/composite() no-op until switched on. */
	enabled = false;
	device;
	marchPipeline;
	marchPipelineMS;
	marchLayout;
	marchLayoutMS;
	compPipeline;
	compLayout;
	sampler;
	uniforms;
	compUniforms;
	target = null;
	compBind = null;
	rendered = false;
	data = new Float32Array(UNIFORM_FLOATS);
	constructor(device, format) {
		this.format = format;
		this.rebuild(device);
	}
	/** Encode the shaft march (half res). `sun` is the world's projected sun:
	* uv in [0,1], intensity already faded for off-screen / night / storm. */
	render(encoder, depth, sun, canvasW, canvasH) {
		this.rendered = false;
		if (!this.enabled || sun.intensity <= .001) return;
		const w = Math.max(1, canvasW >> 1), h = Math.max(1, canvasH >> 1);
		if (!this.target || this.target.width !== w || this.target.height !== h) {
			this.target?.destroy();
			this.target = this.device.createTexture({
				size: {
					width: w,
					height: h
				},
				format: "r8unorm",
				usage: BITS.RENDER_ATTACHMENT | BITS.TEXTURE_BINDING
			});
			this.compBind = null;
		}
		const d = this.data;
		d.set([
			sun.x,
			sun.y,
			sun.intensity * this.opts.strength,
			this.opts.decay
		], 0);
		d.set([
			w,
			h,
			canvasW,
			canvasH
		], 4);
		d.set([
			sun.color[0],
			sun.color[1],
			sun.color[2],
			canvasW / canvasH
		], 8);
		this.device.queue.writeBuffer(this.uniforms, 0, d);
		this.device.queue.writeBuffer(this.compUniforms, 0, new Float32Array([
			sun.color[0],
			sun.color[1],
			sun.color[2],
			0
		]));
		const ms = depth.sampleCount > 1;
		const bind = this.device.createBindGroup({
			layout: ms ? this.marchLayoutMS : this.marchLayout,
			entries: [{
				binding: 0,
				resource: { buffer: this.uniforms }
			}, {
				binding: 1,
				resource: depth.createView()
			}]
		});
		const pass = encoder.beginRenderPass({ colorAttachments: [{
			view: this.target.createView(),
			loadOp: "clear",
			clearValue: {
				r: 0,
				g: 0,
				b: 0,
				a: 1
			},
			storeOp: "store"
		}] });
		pass.setPipeline(ms ? this.marchPipelineMS : this.marchPipeline);
		pass.setBindGroup(0, bind);
		pass.draw(3);
		pass.end();
		this.rendered = true;
	}
	/** Add the shafts into the open scene pass (depth attached, write off). */
	composite(pass) {
		if (!this.enabled || !this.rendered || !this.target) return;
		if (!this.compBind) this.compBind = this.device.createBindGroup({
			layout: this.compLayout,
			entries: [
				{
					binding: 0,
					resource: this.sampler
				},
				{
					binding: 1,
					resource: this.target.createView()
				},
				{
					binding: 2,
					resource: { buffer: this.compUniforms }
				}
			]
		});
		pass.setPipeline(this.compPipeline);
		pass.setBindGroup(0, this.compBind);
		pass.draw(3);
	}
	rebuild(device) {
		this.device = device;
		this.target = null;
		this.compBind = null;
		this.rendered = false;
		this.sampler = device.createSampler({
			magFilter: "linear",
			minFilter: "linear"
		});
		this.uniforms = device.createBuffer({
			size: UNIFORM_FLOATS * 4,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.compUniforms = device.createBuffer({
			size: 16,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		const layoutFor = (multisampled) => device.createBindGroupLayout({ entries: [{
			binding: 0,
			visibility: GPUShaderStage.FRAGMENT,
			buffer: { type: "uniform" }
		}, {
			binding: 1,
			visibility: GPUShaderStage.FRAGMENT,
			texture: {
				sampleType: "depth",
				multisampled
			}
		}] });
		this.marchLayout = layoutFor(false);
		this.marchLayoutMS = layoutFor(true);
		const make = (ms, layout) => {
			const module = shaderModule(device, raysWGSL(ms), ms ? "rays-ms" : "rays");
			return device.createRenderPipeline({
				layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
				vertex: {
					module,
					entryPoint: "vs"
				},
				fragment: {
					module,
					entryPoint: "fs",
					targets: [{ format: "r8unorm" }]
				},
				primitive: { topology: "triangle-list" }
			});
		};
		this.marchPipeline = make(false, this.marchLayout);
		this.marchPipelineMS = make(true, this.marchLayoutMS);
		this.compLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {}
			},
			{
				binding: 1,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {}
			},
			{
				binding: 2,
				visibility: GPUShaderStage.FRAGMENT,
				buffer: { type: "uniform" }
			}
		] });
		const cm = shaderModule(device, COMPOSITE_WGSL, "rays-composite");
		this.compPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.compLayout] }),
			vertex: {
				module: cm,
				entryPoint: "vs"
			},
			fragment: {
				module: cm,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "one",
							dstFactor: "one"
						},
						alpha: {
							srcFactor: "zero",
							dstFactor: "one"
						}
					}
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: false,
				depthCompare: "always"
			},
			primitive: { topology: "triangle-list" }
		});
	}
};
//#endregion
//#region src/lib/navgrid3d.ts
var SQRT2 = Math.SQRT2;
var NavGrid = class {
	res;
	cell;
	ox;
	oz;
	height;
	walk;
	maxStep;
	slopePenalty;
	constructor(o) {
		const res = this.res = Math.max(2, Math.floor(o.res ?? 64));
		const cx = o.center?.x ?? 0, cz = o.center?.z ?? 0;
		this.cell = o.size / res;
		this.ox = cx - o.size / 2 + this.cell / 2;
		this.oz = cz - o.size / 2 + this.cell / 2;
		this.maxStep = o.maxStep ?? this.cell * 1.2;
		this.slopePenalty = o.slopePenalty ?? 3;
		const n = res * res;
		this.height = new Float32Array(n);
		this.walk = new Uint8Array(n);
		for (let iz = 0; iz < res; iz++) for (let ix = 0; ix < res; ix++) {
			const wx = this.ox + ix * this.cell, wz = this.oz + iz * this.cell;
			const h = o.heightAt(wx, wz);
			const i = iz * res + ix;
			this.height[i] = h;
			let ok = true;
			if (o.minY !== void 0 && h < o.minY) ok = false;
			if (ok && o.blocked && o.blocked(wx, wz)) ok = false;
			this.walk[i] = ok ? 1 : 0;
		}
	}
	idx(ix, iz) {
		return iz * this.res + ix;
	}
	inBounds(ix, iz) {
		return ix >= 0 && iz >= 0 && ix < this.res && iz < this.res;
	}
	cellCenter(ix, iz) {
		const i = this.idx(ix, iz);
		return {
			x: this.ox + ix * this.cell,
			y: this.height[i],
			z: this.oz + iz * this.cell
		};
	}
	worldToCell(x, z) {
		return {
			ix: Math.min(this.res - 1, Math.max(0, Math.round((x - this.ox) / this.cell))),
			iz: Math.min(this.res - 1, Math.max(0, Math.round((z - this.oz) / this.cell)))
		};
	}
	walkableCell(ix, iz) {
		return this.inBounds(ix, iz) && this.walk[this.idx(ix, iz)] === 1;
	}
	/** The nearest walkable cell to (ix,iz) by ring search (start/goal snap). */
	nearestWalkable(ix, iz) {
		if (this.walkableCell(ix, iz)) return {
			ix,
			iz
		};
		for (let r = 1; r < this.res; r++) for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
			if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
			if (this.walkableCell(ix + dx, iz + dz)) return {
				ix: ix + dx,
				iz: iz + dz
			};
		}
		return null;
	}
	/** True if the height STEP between adjacent walkable cells is passable. */
	edgeOk(a, b) {
		if (this.walk[a] !== 1 || this.walk[b] !== 1) return false;
		return Math.abs(this.height[a] - this.height[b]) <= this.maxStep;
	}
	/** A* over 8-connected cells. Returns a list of cell indices start→goal, or
	* null if unreachable (a cliff-ringed peak refuses a path). */
	astar(startX, startZ, goalX, goalZ) {
		const s0 = this.worldToCell(startX, startZ), g0 = this.worldToCell(goalX, goalZ);
		const s = this.nearestWalkable(s0.ix, s0.iz), g = this.nearestWalkable(g0.ix, g0.iz);
		if (!s || !g) return null;
		const res = this.res, n = res * res;
		const start = this.idx(s.ix, s.iz), goal = this.idx(g.ix, g.iz);
		const gScore = new Float32Array(n).fill(Infinity);
		const fScore = new Float32Array(n).fill(Infinity);
		const came = new Int32Array(n).fill(-1);
		const open = new MinHeap(n);
		const inOpen = new Uint8Array(n);
		const cell = this.cell, slopeK = this.slopePenalty;
		const hx0 = goal % res, hz0 = goal / res | 0;
		const heur = (i) => {
			const dx = Math.abs(i % res - hx0), dz = Math.abs((i / res | 0) - hz0);
			const lo = Math.min(dx, dz), hi = Math.max(dx, dz);
			return (SQRT2 * lo + (hi - lo)) * cell;
		};
		gScore[start] = 0;
		fScore[start] = heur(start);
		open.push(start, fScore[start]);
		inOpen[start] = 1;
		while (open.size > 0) {
			const cur = open.pop();
			inOpen[cur] = 0;
			if (cur === goal) return this.reconstruct(came, cur);
			const cx = cur % res, cz = cur / res | 0;
			for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dz === 0) continue;
				const nx = cx + dx, nz = cz + dz;
				if (nx < 0 || nz < 0 || nx >= res || nz >= res) continue;
				const nb = nz * res + nx;
				if (!this.edgeOk(cur, nb)) continue;
				if (dx !== 0 && dz !== 0) {
					if (!this.edgeOk(cur, cz * res + nx) || !this.edgeOk(cur, nz * res + cx)) continue;
				}
				const dist = (dx !== 0 && dz !== 0 ? SQRT2 : 1) * cell;
				const rise = Math.abs(this.height[nb] - this.height[cur]);
				const step = gScore[cur] + dist * (1 + slopeK * rise / cell);
				if (step < gScore[nb]) {
					came[nb] = cur;
					gScore[nb] = step;
					fScore[nb] = step + heur(nb);
					if (!inOpen[nb]) {
						open.push(nb, fScore[nb]);
						inOpen[nb] = 1;
					} else open.decrease(nb, fScore[nb]);
				}
			}
		}
		return null;
	}
	reconstruct(came, cur) {
		const out = [cur];
		while (came[cur] !== -1) {
			cur = came[cur];
			out.push(cur);
		}
		out.reverse();
		return out;
	}
	/** Walkable line-of-sight between two cells (supercover grid march). */
	lineOfSight(a, b) {
		const res = this.res;
		let x0 = a % res, z0 = a / res | 0;
		const x1 = b % res, z1 = b / res | 0;
		const dx = Math.abs(x1 - x0), dz = Math.abs(z1 - z0);
		const sx = x0 < x1 ? 1 : -1, sz = z0 < z1 ? 1 : -1;
		let err = dx - dz;
		let prev = this.idx(x0, z0);
		for (;;) {
			const cur = this.idx(x0, z0);
			if (!this.edgeOk(prev, cur)) return false;
			prev = cur;
			if (x0 === x1 && z0 === z1) break;
			const e2 = 2 * err;
			if (e2 > -dz) {
				err -= dz;
				x0 += sx;
			}
			if (e2 < dx) {
				err += dx;
				z0 += sz;
			}
		}
		return true;
	}
	/** String-pull: drop interior cells the previous kept cell can see directly. */
	stringPull(cells) {
		if (cells.length <= 2) return cells;
		const out = [cells[0]];
		let anchor = 0;
		for (let i = 2; i < cells.length; i++) if (!this.lineOfSight(cells[anchor], cells[i])) {
			out.push(cells[i - 1]);
			anchor = i - 1;
		}
		out.push(cells[cells.length - 1]);
		return out;
	}
	/** Full plan start→goal as WORLD waypoints (cell centres at surface height).
	* Empty array when no path exists. */
	path(start, goal) {
		const cells = this.astar(start.x, start.z, goal.x, goal.z);
		if (!cells) return [];
		const pulled = this.stringPull(cells);
		const res = this.res;
		return pulled.map((c) => this.cellCenter(c % res, c / res | 0));
	}
	/** Build a flow field: cost-to-goal by Dijkstra, then a per-cell direction
	* toward the cheapest neighbour. Every agent samples it O(1). */
	flowField(goal) {
		const res = this.res, n = res * res;
		const g0 = this.worldToCell(goal.x, goal.z);
		const g = this.nearestWalkable(g0.ix, g0.iz);
		const cost = new Float32Array(n).fill(Infinity);
		const dirx = new Float32Array(n);
		const dirz = new Float32Array(n);
		if (!g) return new FlowField(this, cost, dirx, dirz);
		const goalI = this.idx(g.ix, g.iz);
		const cell = this.cell, slopeK = this.slopePenalty;
		const open = new MinHeap(n);
		cost[goalI] = 0;
		open.push(goalI, 0);
		while (open.size > 0) {
			const cur = open.pop();
			const cx = cur % res, cz = cur / res | 0;
			for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dz === 0) continue;
				const nx = cx + dx, nz = cz + dz;
				if (nx < 0 || nz < 0 || nx >= res || nz >= res) continue;
				const nb = nz * res + nx;
				if (!this.edgeOk(cur, nb)) continue;
				if (dx !== 0 && dz !== 0 && (!this.edgeOk(cur, cz * res + nx) || !this.edgeOk(cur, nz * res + cx))) continue;
				const dist = (dx !== 0 && dz !== 0 ? SQRT2 : 1) * cell;
				const rise = Math.abs(this.height[nb] - this.height[cur]);
				const step = cost[cur] + dist * (1 + slopeK * rise / cell);
				if (step < cost[nb]) {
					cost[nb] = step;
					open.push(nb, step);
				}
			}
		}
		for (let iz = 0; iz < res; iz++) for (let ix = 0; ix < res; ix++) {
			const i = iz * res + ix;
			if (this.walk[i] !== 1 || cost[i] === Infinity) continue;
			let best = cost[i], bx = 0, bz = 0;
			for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dz === 0) continue;
				const nx = ix + dx, nz = iz + dz;
				if (nx < 0 || nz < 0 || nx >= res || nz >= res) continue;
				const nb = nz * res + nx;
				if (!this.edgeOk(i, nb)) continue;
				if (cost[nb] < best) {
					best = cost[nb];
					bx = dx;
					bz = dz;
				}
			}
			const l = Math.hypot(bx, bz) || 1;
			dirx[i] = bx / l;
			dirz[i] = bz / l;
		}
		return new FlowField(this, cost, dirx, dirz);
	}
};
/** A per-cell direction field toward a goal (Tier 2). */
var FlowField = class {
	grid;
	cost;
	dirx;
	dirz;
	constructor(grid, cost, dirx, dirz) {
		this.grid = grid;
		this.cost = cost;
		this.dirx = dirx;
		this.dirz = dirz;
	}
	/** Steering direction at a world XZ (zero where unreachable/at goal). */
	dirAt(x, z) {
		const { ix, iz } = this.grid.worldToCell(x, z);
		const i = this.grid.idx(ix, iz);
		return {
			x: this.dirx[i],
			z: this.dirz[i]
		};
	}
	/** Whether a world XZ can reach the goal at all (finite cost). */
	reachable(x, z) {
		const { ix, iz } = this.grid.worldToCell(x, z);
		return this.cost[this.grid.idx(ix, iz)] < Infinity;
	}
};
var MinHeap = class {
	items;
	prio;
	pos;
	size = 0;
	constructor(capacity) {
		this.items = new Int32Array(capacity);
		this.prio = new Float32Array(capacity);
		this.pos = new Int32Array(capacity).fill(-1);
	}
	push(item, p) {
		let i = this.size++;
		this.items[i] = item;
		this.prio[i] = p;
		this.pos[item] = i;
		this.up(i);
	}
	decrease(item, p) {
		const i = this.pos[item];
		if (i < 0 || p >= this.prio[i]) return;
		this.prio[i] = p;
		this.up(i);
	}
	pop() {
		const top = this.items[0];
		this.pos[top] = -1;
		const last = --this.size;
		if (last > 0) {
			this.items[0] = this.items[last];
			this.prio[0] = this.prio[last];
			this.pos[this.items[0]] = 0;
			this.down(0);
		}
		return top;
	}
	up(i) {
		while (i > 0) {
			const parent = i - 1 >> 1;
			if (this.prio[i] >= this.prio[parent]) break;
			this.swap(i, parent);
			i = parent;
		}
	}
	down(i) {
		for (;;) {
			const l = i * 2 + 1, r = l + 1;
			let m = i;
			if (l < this.size && this.prio[l] < this.prio[m]) m = l;
			if (r < this.size && this.prio[r] < this.prio[m]) m = r;
			if (m === i) break;
			this.swap(i, m);
			i = m;
		}
	}
	swap(a, b) {
		const it = this.items[a];
		this.items[a] = this.items[b];
		this.items[b] = it;
		const pr = this.prio[a];
		this.prio[a] = this.prio[b];
		this.prio[b] = pr;
		this.pos[this.items[a]] = a;
		this.pos[this.items[b]] = b;
	}
};
//#endregion
export { AGENT_PRESETS, AO_LEVELS, Agent3d, Agents3d, AnimatedModel3d, BLOCK, BLOCKS, Billboard3d, BlobShadow3d, Box3d, CLUSTER_COUNT, CLUSTER_X, CLUSTER_Y, CLUSTER_Z, Crowd3d, DeformMap, FACES, Field3d, Flare3dLayer, FlowField, GPU_PARTICLE_LAYOUT, GpuEmitter, GpuParticles, Grass3d, Group3d, Heightfield, LIGHT_FLOATS, LINE3D_FLOATS, LU_FLOATS, Light3d, Lights3d, MAX_GPU_FORCES, MAX_LIGHTS, MAX_PER_CLUSTER, Mesh3d, Model3d, NavGrid, NavMesh3d, Obstacle3d, OrbitRig, Particles3d, RIPPLE_TILE, RaysPass, Sky3d, Sky3dLayer, SpatialHash3, SsaoPass, SurfaceSampler, TERRAIN_SURFACES, TILES, Terrain3d, Trail3d, UNDERWATER_PRESETS, Underwater3d, Underwater3dLayer, VOX_FLOATS, Vector3dLayer, VectorShape3d, VoxelAgent, VoxelBody, VoxelEditor, VoxelWorld, Voxels3d, WATER_PRESETS, WATER_TINTS, Water3d, Water3dLayer, WaterWell, Wisp3d, World3d, absorb, bakeCausticField, bakeColormapPixels, bakeGrainField, bakeRippleField, bakeTiles, binLightsCpu, blobParams, buildClusterWGSL, buildGpuParticleComputeWGSL, buildGpuParticleRenderWGSL, buildLine3dWGSL, buildNavMesh, buildSsaoBlurWGSL, buildSsaoCompositeWGSL, buildSsaoWGSL, chunkVerts, clusterNear, constellationDirs, cpuSkin, crTrail, curl3, dampAngle, deformPatchVerts, faceTile, fitVerts, froxelBounds, gerstnerXZ, gerstnerY, halveRGBA, hash2, inSpawnWindow, integrateAgent, loadModelData, meshChunk, neighborsBrute, packForces, parseGlb, parseMtl, parseObj, pcg, pickChunks, polylinesToSegs, rand01, raycastVoxel, resampleTrail, rgbHex, ribbonVerts, rippleFbm, scaleAboutPoint, selectLights, skyState, spawnGpuParticle, ssaoKernel, steepNorm, stepGpuParticle, submersionState, terrainMesh, underwaterFog, vertexAO, vnoise3, voxelTerrain, wireframeEdges, wrap1, writePose, zSlice };

//# sourceMappingURL=world3d-core.js.map
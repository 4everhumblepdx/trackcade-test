import { $ as arcSteps, A as LINE_FLOATS, B as clipToScissor, C as EFFECT_PACK, Ct as Atlas, D as effectParamIndex, Dt as __exportAll, E as effectDefaults, Et as textureFromCanvas, F as XFORM_FLOATS, G as segJoins, I as buildFill, J as spawnFragment, K as segmentStyles, L as buildFillWGSL, M as VecTrail, N as VectorLayer, O as Visibility2d, P as VectorShape, Q as arcPoints, R as buildLineWGSL, S as EFFECTS, St as textWidth, T as buildEffectWGSL, Tt as rasterText, U as polySegs, V as fragmentAlpha, Y as stepFragment, Z as arcHit, _ as BackdropLayer, _t as colorkit_exports, a as packDashParams, at as hullFor, b as PostHandle, bt as glyphOutline, c as STRIDE, ct as placeModelOnGround, d as packUiColor, dt as ringSections, et as convexHull, f as sameClip, ft as simplifyHull, g as BackdropHandle, gt as wireGrid, h as BackdropChain, ht as wireBox, i as packColor, it as horizon, j as VecStarfield, k as FILL_FLOATS, l as UiRenderer, lt as project, m as BACKDROP_PACK, mt as wireBounds, n as MsdfRenderer, nt as focalLength, o as packParams, ot as isConvex, p as BACKDROPS, pt as triangulate$1, q as shapeOrigin, r as SOLID_PARAMS, rt as generateTube, s as packSolidParams, st as placeModel, t as BITMAP_PARAMS, tt as convexPieces, u as clipToPixels, ut as projectPoint, v as buildBackdropWGSL, vt as lerp, w as MAX_EFFECT_PARAMS, wt as packShelves, x as PostLayer, xt as textOutline, y as PostChain, yt as VECTOR_CHARSET, z as chainJoins } from "./shared-kkws-wjJ.js";
import { a as QuadBatch, c as Gpu, i as DrawOrder, l as installErrorOverlay, n as rgba, o as Z_RANGE, r as DEPTH_FORMAT, s as BITS, t as WHITE, u as shaderModule } from "./shared-DhV4JtEZ.js";
import { $ as loadText, A as sphereVsFrustum, B as clearAssetCaches, C as mat4Perspective, D as rayObbLocal, E as rayObb, F as forward, G as isFontUsable, H as getImage, I as lookAtEuler, J as isTextCached, K as isImageCached, L as quatMul, M as viewBasis, N as composeChain, O as rayPlaneY, P as eulerToQuat, Q as loadJson, R as quatRotate, S as mat4Ortho, T as rayFromNdc, U as isBinaryCached, V as fontsSettled, W as isFontCached, X as loadFont, Y as loadBinary, Z as loadImage, _ as trsToMat4, a as mulberry32, at as TrailEmitter, b as mat4LookAt, c as noisePerm, ct as VfxSystem, d as composeWorlds, f as decomposeTRS, g as sampleChannel, h as quatSlerp, i as fbm2, it as resolveRamp, j as vec3, k as raySphere, l as perlin2, lt as registerVfx, m as mat4MulTo, n as Path3d, nt as Particles, o as noiseCanvas, ot as VFX, p as jointPalette, q as isModelCached, r as catmullRom3, rt as RAMPS, s as noiseData, st as VFX_PACK, t as DynamicPath3d, u as AnimMixer, ut as resolveVfx, v as frustumPlanes, w as mat4Project, x as mat4Mul, y as mat4Inverse, z as quatToEuler } from "./shared-DjLuB-Ve.js";
import { _ as sphereVerts, a as cubeVerts, b as tubeVerts, c as earClip, d as panelVerts, f as planeVerts, g as shapeVerts, h as roundedBoxVerts, i as coneVerts, l as extrudeVerts, m as ringVerts, n as capsuleVerts, o as cylinderVerts, p as polyhedronVerts, r as circleVerts, s as discVerts, t as Builder, u as latheVerts, v as torusKnotVerts, x as wedgeVerts, y as torusVerts } from "./shared-BKm0BaVz.js";
//#region src/lib/fxbatch.ts
var FLOATS$4 = 48;
/** True when the bag needs the fx shader (glow is the GlowPass's job; shake/squash are CPU transforms). */
function fxNeedsShader(fx) {
	return !!(fx.outline || fx.blur || fx.flash || fx.tint || fx.pixelate || fx.wobble || fx.glitch || fx.dissolve || fx.reveal);
}
var F_OUTLINE = 2;
var F_BLUR = 4;
var F_PIXELATE = 8;
var F_WOBBLE = 16;
var F_GLITCH = 32;
var F_DISSOLVE = 64;
var F_REVEAL = 128;
var WGSL = `
struct U { view: vec4f }
struct Inst {
  posSize: vec4f,
  misc: vec4f,        // rot, flags, z, time
  base: vec4f,        // sprite tint * alpha
  uv: vec4f,          // expanded rect (flip pre-applied)
  clampR: vec4f,      // the frame's true rect (normalized)
  halo: vec4f,        // glow/outline colour
  p1: vec4f,          // spreadU, spreadV, dissolveT, revealT (sign = invert)
  p2: vec4f,          // pixelCells, wobble(uv), glitch, seed
  // flash/tint corner colours (a = amount) — equal for a flat colour,
  // distinct for a bilinear GRADIENT tint across the sprite.
  cmodTL: vec4f,
  cmodTR: vec4f,
  cmodBL: vec4f,
  cmodBR: vec4f,
}
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) base: vec4f,
  @location(2) halo: vec4f,
  @location(3) cmod: vec4f,
  @location(4) clampR: vec4f,
  @location(5) p1: vec4f,
  @location(6) p2: vec4f,
  @location(7) ft: vec2f,     // flags, time
}

@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var tex: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  let c01 = vec2f(f32(vi & 1u), f32(vi >> 1u));
  let centre = d.posSize.xy + d.posSize.zw * 0.5;
  let off = (c01 - 0.5) * d.posSize.zw;
  let sn = sin(d.misc.x);
  let cn = cos(d.misc.x);
  let world = centre + vec2f(off.x * cn - off.y * sn, off.x * sn + off.y * cn);
  let ndc = (world - u.view.xy) / u.view.zw * 2.0 - 1.0;
  var out: VSOut;
  out.pos = vec4f(ndc.x, -ndc.y, 1.0 - d.misc.z, 1.0);
  out.uv = vec2f(mix(d.uv.x, d.uv.z, c01.x), mix(d.uv.y, d.uv.w, c01.y));
  out.base = d.base;
  out.halo = d.halo;
  // Corner colour at this vertex → bilinear gradient across the quad.
  out.cmod = mix(mix(d.cmodTL, d.cmodTR, c01.x), mix(d.cmodBL, d.cmodBR, c01.x), c01.y);
  out.clampR = d.clampR;
  out.p1 = d.p1;
  out.p2 = d.p2;
  out.ft = vec2f(d.misc.y, d.misc.w);
  return out;
}

fn inRect(p: vec2f, r: vec4f) -> f32 {
  return step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w);
}
fn smpl(p: vec2f, r: vec4f) -> vec4f {
  return textureSample(tex, samp, clamp(p, r.xy, r.zw)) * inRect(p, r);
}
fn hash(p: vec2f) -> f32 {
  return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453);
}
// Smooth 2-octave value noise — organic dissolve boundaries, no square cells.
fn vnoise(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let w = f * f * (3.0 - 2.0 * f);
  let n = mix(
    mix(hash(i), hash(i + vec2f(1.0, 0.0)), w.x),
    mix(hash(i + vec2f(0.0, 1.0)), hash(i + vec2f(1.0, 1.0)), w.x), w.y);
  return n;
}

// 32 halo taps: 4 gaussian-weighted rings — and the whole pattern rotates by
// a per-PIXEL random angle, which turns sparse-ring ghosting into fine noise.
// That is what makes glow read as a true blurred silhouette (Photoshop-style
// outer glow) instead of overlapping circle copies.
const RING_R = array<f32, 4>(0.25, 0.5, 0.75, 1.0);
const RING_W = array<f32, 4>(1.0, 0.78, 0.5, 0.26);

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let flags = u32(in.ft.x + 0.5);
  let time = in.ft.y;
  let r = in.clampR;
  let rs = max(r.zw - r.xy, vec2f(0.0001));
  var uv = in.uv;
  var local = (uv - r.xy) / rs;

  // ── ONE uv distortion (pixelate > glitch > wobble) ─────────────────────────
  if ((flags & 8u) != 0u) {              // pixelate: snap to a cell grid
    let cells = max(2.0, in.p2.x);
    local = (floor(local * cells) + 0.5) / cells;
    uv = r.xy + local * rs;
  } else if ((flags & 32u) != 0u) {      // glitch: band jumps
    let band = floor(local.y * 12.0);
    let tick = floor(time * 14.0);
    let go = step(0.55, hash(vec2f(band * 3.1, tick + in.p2.w)));
    let jump = (hash(vec2f(band, tick)) - 0.5) * in.p2.z * go;
    uv = vec2f(uv.x + jump * rs.x, uv.y);
  } else if ((flags & 16u) != 0u) {      // wobble: sine band ripple
    uv = vec2f(uv.x + sin(local.y * 14.0 + time * 6.2831 * 1.4) * in.p2.y, uv.y);
  }

  // ── Sample (glitch splits RGB; split = 0 otherwise) ────────────────────────
  let split = select(0.0, in.p2.z * rs.x * 0.35, (flags & 32u) != 0u);
  let cR = smpl(uv + vec2f(split, 0.0), r);
  let cC = smpl(uv, r);
  let cB = smpl(uv - vec2f(split, 0.0), r);
  var body = vec4f(cR.r, cC.g, cB.b, max(cC.a, max(cR.a, cB.a) * step(0.001, split)));

  // ── Halo taps (outline / blur share one jittered ring set) ─────────────────
  var near = 0.0;
  var blurAcc = body * 1.6;
  var wSum = 1.6;
  let jit = hash(floor(in.pos.xy)) * 0.7854;    // per-pixel ring rotation
  for (var ring = 0u; ring < 4u; ring++) {
    let rr = RING_R[ring];
    let rw = RING_W[ring];
    for (var k = 0u; k < 8u; k++) {
      let ang = (f32(k) + f32(ring) * 0.4) * 0.7854 + jit;
      let o = vec2f(cos(ang), sin(ang)) * rr * in.p1.xy;
      let s = smpl(uv + o, r);
      near = max(near, s.a * step(0.7, rr));    // outline reads the outer ring
      blurAcc += s * rw;
      wSum += rw;
    }
  }

  if ((flags & 4u) != 0u) { body = blurAcc / wSum; }  // blur

  var a = body.a * in.base.a;
  var rgb = body.rgb * in.base.rgb;

  // ── ONE alpha gate (reveal > dissolve) ─────────────────────────────────────
  var edge = 0.0;
  if ((flags & 128u) != 0u) {            // reveal: circular clip
    let t = abs(in.p1.w);
    let dist = length((local - 0.5) * vec2f(rs.x / rs.y, 1.0) * vec2f(1.0, 1.0)) * 1.15;
    var vis = 1.0 - smoothstep(t - 0.03, t, dist / 0.85);
    if (in.p1.w < 0.0) { vis = 1.0 - vis; }
    a = a * vis;
  } else if ((flags & 64u) != 0u) {      // dissolve: smooth organic noise
    let t = in.p1.z * 1.12;              // overshoot so t=1 is fully gone
    let seed = vec2f(in.p2.w * 13.7, in.p2.w * 7.3);
    let n = 0.65 * vnoise(local * 5.0 + seed) + 0.35 * vnoise(local * 11.0 + seed * 1.7);
    let keep = smoothstep(t - 0.04, t + 0.04, n);
    edge = keep * (1.0 - smoothstep(t, t + 0.16, n));
    a = a * keep;
  }

  // ── Colour-over (flash / tint) ─────────────────────────────────────────────
  rgb = mix(rgb, in.cmod.rgb, in.cmod.a);

  // ── Compose: body over halo (glow lives in the GlowPass, not here) ─────────
  var outC = vec4f(rgb * a, a);
  if ((flags & 2u) != 0u) {              // outline: rim fills smoothly under the AA edge
    let rim = step(0.3, near) * (1.0 - body.a) * in.halo.a;
    outC = vec4f(outC.rgb + in.halo.rgb * rim, outC.a + rim);
  }
  // dissolve's burning edge rides the halo slot's colour
  outC = vec4f(outC.rgb + in.halo.rgb * edge * body.a, outC.a);
  return outC;
}
`;
var OUTLINE_DEFAULT = "#ffffff";
var DISSOLVE_DEFAULT = "#ff9a3d";
/** The dedicated per-object-fx batch (see file header). API mirrors QuadBatch. */
var FxBatch = class {
	format;
	/** The surface's submission-order log — see batch.ts's DrawOrder. */
	order = null;
	layer = 0;
	uploaded = false;
	/** @internal Take part in a surface's submission order. */
	joinOrder(order) {
		this.order = order;
	}
	/** @see QuadBatch.setLayer */
	setLayer(n) {
		this.layer = n;
	}
	data;
	count = 0;
	capacity;
	uniformData = /* @__PURE__ */ new Float32Array(4);
	filter;
	device;
	pipeline;
	layout;
	sampler;
	uniforms;
	instances;
	textureView = null;
	bind = null;
	constructor(device, format, opts = {}) {
		this.format = format;
		this.capacity = opts.capacity ?? 2048;
		this.filter = opts.filter ?? "linear";
		this.data = new Float32Array(this.capacity * FLOATS$4);
		this.rebuild(device);
	}
	rebuild(device) {
		this.device = device;
		this.layout = device.createBindGroupLayout({ entries: [
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
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			},
			{
				binding: 3,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			}
		] });
		const module = device.createShaderModule({ code: WGSL });
		module.getCompilationInfo().then((info) => {
			for (const m of info.messages) if (m.type === "error") console.error(`FxBatch WGSL ${m.lineNum}:${m.linePos} ${m.message}`);
		});
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
			primitive: { topology: "triangle-strip" }
		});
		this.sampler = device.createSampler({
			magFilter: this.filter,
			minFilter: this.filter
		});
		this.uniforms = device.createBuffer({
			size: 16,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.instances = device.createBuffer({
			size: this.capacity * FLOATS$4 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.bind = null;
		this.textureView = null;
	}
	setTexture(view) {
		this.textureView = view;
		this.makeBind();
	}
	makeBind() {
		if (!this.textureView) return;
		this.bind = this.device.createBindGroup({
			layout: this.layout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniforms }
				},
				{
					binding: 1,
					resource: { buffer: this.instances }
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
	begin(x, y, w, h) {
		this.count = 0;
		this.layer = 0;
		this.uploaded = false;
		this.uniformData.set([
			x,
			y,
			w,
			h
		]);
	}
	/** Queue one fx sprite (margin expansion + uv extrapolation done here). */
	push(x, y, w, h, f, rot, flipX, z, fx, time, tr, tg, tb, ta) {
		this.order?.put(8, this.count, this.layer);
		if (this.count === this.capacity) this.grow();
		let flags = 0;
		let margin = 0;
		let halo = [
			0,
			0,
			0,
			0
		];
		if (fx.outline) {
			flags |= F_OUTLINE;
			margin = Math.max(margin, fx.outline.size ?? 2);
			halo = rgba(fx.outline.color ?? OUTLINE_DEFAULT);
		}
		if (fx.blur) {
			flags |= F_BLUR;
			margin = Math.max(margin, fx.blur.size ?? 4);
		}
		if (fx.pixelate) flags |= F_PIXELATE;
		else if (fx.glitch) flags |= F_GLITCH;
		else if (fx.wobble) flags |= F_WOBBLE;
		let dissolveT = 0, revealT = 0, seed = 0;
		if (fx.reveal) {
			flags |= F_REVEAL;
			revealT = Math.max(1e-4, Math.min(1, fx.reveal.t)) * (fx.reveal.invert ? -1 : 1);
		} else if (fx.dissolve) {
			flags |= F_DISSOLVE;
			dissolveT = Math.max(0, Math.min(1, fx.dissolve.t));
			seed = fx.dissolve.seed ?? 0;
			if (!fx.outline) halo = rgba(fx.dissolve.color ?? DISSOLVE_DEFAULT);
		}
		const corners = /* @__PURE__ */ new Float32Array(16);
		if (fx.flash || fx.tint) {
			let amount = fx.flash ? fx.flash.amount ?? 1 : fx.tint.amount ?? .4;
			const fl = fx.flash;
			if (fl?.duration && fl._left !== void 0) amount *= Math.max(0, fl._left / fl.duration);
			amount = Math.min(1, Math.max(0, amount));
			const cs = fx.flash ? void 0 : fx.tint.colors;
			const single = rgba(fx.flash?.color ?? fx.tint?.color ?? "#ffffff");
			for (let i = 0; i < 4; i++) {
				const c = cs ? rgba(cs[i]) : single;
				corners[i * 4] = c[0];
				corners[i * 4 + 1] = c[1];
				corners[i * 4 + 2] = c[2];
				corners[i * 4 + 3] = amount * c[3];
			}
		}
		const spreadU = (f.u1 - f.u0) * (margin / Math.max(1, w));
		const spreadV = (f.v1 - f.v0) * (margin / Math.max(1, h));
		let u0 = f.u0 - spreadU, u1 = f.u1 + spreadU;
		if (flipX) {
			const t = u0;
			u0 = u1;
			u1 = t;
		}
		const o = this.count * FLOATS$4;
		const d = this.data;
		d[o] = x - margin;
		d[o + 1] = y - margin;
		d[o + 2] = w + margin * 2;
		d[o + 3] = h + margin * 2;
		d[o + 4] = rot;
		d[o + 5] = flags;
		d[o + 6] = z / Z_RANGE;
		d[o + 7] = time;
		d[o + 8] = tr;
		d[o + 9] = tg;
		d[o + 10] = tb;
		d[o + 11] = ta;
		d[o + 12] = u0;
		d[o + 13] = f.v0 - spreadV;
		d[o + 14] = u1;
		d[o + 15] = f.v1 + spreadV;
		d[o + 16] = f.u0;
		d[o + 17] = f.v0;
		d[o + 18] = f.u1;
		d[o + 19] = f.v1;
		d[o + 20] = halo[0];
		d[o + 21] = halo[1];
		d[o + 22] = halo[2];
		d[o + 23] = halo[3];
		d[o + 24] = spreadU || (f.u1 - f.u0) * .05;
		d[o + 25] = spreadV || (f.v1 - f.v0) * .05;
		d[o + 26] = dissolveT;
		d[o + 27] = revealT;
		d[o + 28] = fx.pixelate ? Math.max(2, w / Math.max(1, fx.pixelate.size ?? 4)) : 0;
		d[o + 29] = fx.wobble ? (f.u1 - f.u0) * ((fx.wobble.size ?? 3) / Math.max(1, w)) : 0;
		d[o + 30] = fx.glitch ? (fx.glitch.amount ?? 6) / Math.max(1, w) : 0;
		d[o + 31] = seed;
		d.set(corners, o + 32);
		this.count++;
	}
	grow() {
		this.capacity *= 2;
		const next = new Float32Array(this.capacity * FLOATS$4);
		next.set(this.data);
		this.data = next;
		this.instances.destroy();
		this.instances = this.device.createBuffer({
			size: this.capacity * FLOATS$4 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.makeBind();
	}
	upload() {
		if (this.count === 0 || !this.bind) return false;
		if (!this.uploaded) {
			this.device.queue.writeBuffer(this.uniforms, 0, this.uniformData);
			this.device.queue.writeBuffer(this.instances, 0, this.data.buffer, 0, this.count * FLOATS$4 * 4);
			this.uploaded = true;
		}
		return true;
	}
	/** @internal Draw ONE contiguous span — the submission-order walk's unit. */
	drawRange(pass, first, n) {
		if (n <= 0 || !this.upload()) return;
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		pass.draw(4, n, 0, first);
	}
	flush(pass) {
		if (!this.upload()) return 0;
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		pass.draw(4, this.count);
		return this.count;
	}
};
//#endregion
//#region src/lib/tribatch.ts
var FLOATS$3 = 12;
/** Ear-clip a simple polygon into triangles (flat index triples: `[a,b,c, …]`).
*  Self-contained so the 2D draw path never imports the 3D geometry module. */
function triangulate(pts) {
	const n = pts.length;
	if (n < 3) return [];
	const idx = pts.map((_, i) => i);
	const cross = (a, b, c) => (pts[b].x - pts[a].x) * (pts[c].y - pts[a].y) - (pts[b].y - pts[a].y) * (pts[c].x - pts[a].x);
	let area = 0;
	for (let i = 0; i < n; i++) {
		const j = (i + 1) % n;
		area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
	}
	if (area < 0) idx.reverse();
	const inTri = (a, b, c, p) => {
		const d1 = cross2(pts[p], pts[a], pts[b]), d2 = cross2(pts[p], pts[b], pts[c]), d3 = cross2(pts[p], pts[c], pts[a]);
		return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
	};
	const out = [];
	let guard = n * n;
	while (idx.length > 3 && guard-- > 0) {
		let clipped = false;
		for (let i = 0; i < idx.length; i++) {
			const a = idx[(i - 1 + idx.length) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
			if (cross(a, b, c) <= 0) continue;
			let ear = true;
			for (const p of idx) if (p !== a && p !== b && p !== c && inTri(a, b, c, p)) {
				ear = false;
				break;
			}
			if (!ear) continue;
			out.push(a, b, c);
			idx.splice(i, 1);
			clipped = true;
			break;
		}
		if (!clipped) break;
	}
	if (idx.length === 3) out.push(idx[0], idx[1], idx[2]);
	return out;
}
function cross2(p, a, b) {
	return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
}
var wgsl$1 = `
struct U { view: vec4f }
struct Inst { tri: vec4f, c: vec4f, color: vec4f }
struct VSOut { @builtin(position) pos: vec4f, @location(0) color: vec4f }
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  var p = d.c.xy;
  if (vi == 0u) { p = d.tri.xy; } else if (vi == 1u) { p = d.tri.zw; }
  let ndc = (p - u.view.xy) / u.view.zw * 2.0 - 1.0;
  var o: VSOut;
  o.pos = vec4f(ndc.x, -ndc.y, 0.0, 1.0);
  o.color = d.color;
  return o;
}
@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  return vec4f(in.color.rgb * in.color.a, in.color.a);   // premultiplied
}
`;
/** An instanced flat-triangle batch (alpha blend). One per Draw surface. */
var TriBatch = class {
	format;
	/** The surface's submission-order log — see batch.ts's DrawOrder. */
	order = null;
	uploaded = false;
	/** Layer cursor — moved with the surface's other passes by Draw.setUiLayer. */
	layer = 0;
	data;
	count = 0;
	capacity = 2048;
	uniformData = /* @__PURE__ */ new Float32Array(4);
	device;
	pipeline;
	layout;
	uniforms;
	instances;
	bind;
	constructor(device, format) {
		this.format = format;
		this.data = new Float32Array(this.capacity * FLOATS$3);
		this.rebuild(device);
	}
	rebuild(device) {
		this.device = device;
		this.layout = device.createBindGroupLayout({ entries: [{
			binding: 0,
			visibility: BITS.STAGE_VERTEX,
			buffer: { type: "uniform" }
		}, {
			binding: 1,
			visibility: BITS.STAGE_VERTEX,
			buffer: { type: "read-only-storage" }
		}] });
		const module = device.createShaderModule({ code: wgsl$1 });
		module.getCompilationInfo().then((info) => {
			for (const m of info.messages) if (m.type === "error") console.error(`TriBatch WGSL ${m.lineNum}:${m.linePos} ${m.message}`);
		});
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
				depthCompare: "always"
			},
			primitive: { topology: "triangle-list" }
		});
		this.uniforms = device.createBuffer({
			size: 16,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.instances = device.createBuffer({
			size: this.capacity * FLOATS$3 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.makeBind();
	}
	makeBind() {
		this.bind = this.device.createBindGroup({
			layout: this.layout,
			entries: [{
				binding: 0,
				resource: { buffer: this.uniforms }
			}, {
				binding: 1,
				resource: { buffer: this.instances }
			}]
		});
	}
	begin(viewX, viewY, viewW, viewH) {
		this.uniformData[0] = viewX;
		this.uniformData[1] = viewY;
		this.uniformData[2] = viewW;
		this.uniformData[3] = viewH;
		this.count = 0;
		this.layer = 0;
		this.uploaded = false;
	}
	/** @see QuadBatch.setLayer */
	setLayer(n) {
		this.layer = n;
	}
	/** Push one triangle `(ax,ay)-(bx,by)-(cx,cy)` in colour `(r,g,b,a)` (0..1). */
	push(ax, ay, bx, by, cx, cy, r, g, b, a) {
		this.order?.put(6, this.count, this.layer);
		if (this.count >= this.capacity) this.grow();
		const o = this.count * FLOATS$3, d = this.data;
		d[o] = ax;
		d[o + 1] = ay;
		d[o + 2] = bx;
		d[o + 3] = by;
		d[o + 4] = cx;
		d[o + 5] = cy;
		d[o + 6] = 0;
		d[o + 7] = 0;
		d[o + 8] = r;
		d[o + 9] = g;
		d[o + 10] = b;
		d[o + 11] = a;
		this.count++;
	}
	grow() {
		this.capacity *= 2;
		const next = new Float32Array(this.capacity * FLOATS$3);
		next.set(this.data);
		this.data = next;
		this.instances.destroy();
		this.instances = this.device.createBuffer({
			size: this.capacity * FLOATS$3 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.makeBind();
	}
	flush(pass) {
		if (!this.upload()) return;
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		pass.draw(3, this.count);
	}
	/** @internal Take part in a surface's submission order (see batch.ts). */
	joinOrder(order) {
		this.order = order;
	}
	upload() {
		if (this.count === 0) return false;
		if (!this.uploaded) {
			this.device.queue.writeBuffer(this.uniforms, 0, this.uniformData);
			this.device.queue.writeBuffer(this.instances, 0, this.data.buffer, 0, this.count * FLOATS$3 * 4);
			this.uploaded = true;
		}
		return true;
	}
	/** @internal Draw ONE contiguous span — the submission-order walk's unit. */
	drawRange(pass, first, n) {
		if (n <= 0 || !this.upload()) return;
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		pass.draw(3, n, 0, first);
	}
};
//#endregion
//#region src/lib/ui-style.ts
/** The radius sentinel meaning "round the short axis fully" — the shader clamps
*  every radius to half the shortest side, so any huge number is a pill. */
var PILL = 1e5;
var DEG = Math.PI / 180;
/** Fall back to `d` when `v` is undefined (0 and '' are real values). */
var or = (v, d) => v === void 0 ? d : v;
function radii(r, fallback) {
	const v = r === void 0 ? fallback : r;
	if (v === "pill") return [
		PILL,
		PILL,
		PILL,
		PILL
	];
	if (typeof v === "number") return [
		v,
		v,
		v,
		v
	];
	return [
		v[0],
		v[1],
		v[2],
		v[3]
	];
}
/** The built-in named styles. Extend with `defineUiStyle()`. */
var UI_STYLES = {
	/** A flat rounded rect — the neutral starting point. */
	flat: {
		radius: 10,
		fill: "#5a6bb8"
	},
	/** The candy/casual button: fat rim, vertical gradient, bevel and a gloss cap. */
	glossy: {
		radius: 16,
		fill: "#8f5bd8",
		fillTo: "#5f2fa8",
		fillAngle: 0,
		border: 5,
		borderColor: "#ffb340",
		borderColorTo: "#e07a1c",
		bevel: .45,
		bevelWidth: 10,
		gloss: .5,
		glossHeight: .42,
		glossInset: 9,
		innerShadow: .35,
		innerShadowWidth: 14,
		shadow: .35,
		shadowY: 5,
		shadowBlur: 12
	},
	/** A container/frame: soft body, clear rim, sits under other UI. */
	panel: {
		radius: 18,
		fill: "#2b2f4a",
		fillTo: "#1d2036",
		border: 3,
		borderColor: "#5b628f",
		bevel: .2,
		bevelWidth: 6,
		innerShadow: .25,
		innerShadowWidth: 20,
		shadow: .45,
		shadowY: 8,
		shadowBlur: 22
	},
	/** Translucent frosted card with a bright top rim. */
	glass: {
		radius: 14,
		fill: "#ffffff",
		fillTo: "#ffffff",
		alpha: .16,
		border: 1.5,
		borderColor: "#ffffff",
		bevel: .3,
		bevelWidth: 4,
		gloss: .25,
		glossHeight: .5,
		glossInset: 2
	},
	/** Brushed-metal chip: cool gradient, tight bevel, thin bright rim. */
	metal: {
		radius: 8,
		fill: "#9aa3b2",
		fillTo: "#59616f",
		border: 2,
		borderColor: "#cfd6e2",
		borderColorTo: "#3c424e",
		bevel: .6,
		bevelWidth: 5,
		gloss: .22,
		glossHeight: .5,
		glossInset: 3,
		shadow: .3,
		shadowY: 3,
		shadowBlur: 8
	},
	/** A SUNKEN well — slider tracks, progress-bar backgrounds, empty slots.
	*  Same material with the light flipped to BELOW, so the relief carves in. */
	inset: {
		radius: "pill",
		fill: "#1a1c2e",
		fillTo: "#2a2d47",
		border: 2,
		borderColor: "#11131f",
		bevel: .5,
		bevelWidth: 7,
		light: 180,
		innerShadow: .6,
		innerShadowWidth: 10
	},
	/** The FILL that rides inside an `inset` track — bars, meters, XP. */
	bar: {
		radius: "pill",
		fill: "#5ce1a0",
		fillTo: "#2ea56c",
		bevel: .3,
		bevelWidth: 5,
		gloss: .4,
		glossHeight: .5,
		glossInset: 2
	}
};
/**
* Register a named style (or replace one). Styles are plain data, so a content
* pack — or the game-building agent — can ship a whole UI theme without any
* engine change: `defineUiStyle('rune', { base: 'panel', fill: '#26324a', … })`.
*/
function defineUiStyle(name, def) {
	UI_STYLES[name] = def;
}
var DEFAULTS = {
	radius: 12,
	fill: "#5a6bb8",
	fillAngle: 0,
	border: 0,
	borderColor: "#ffffff",
	bevel: 0,
	light: 0,
	gloss: 0,
	glossHeight: .45,
	glossInset: 6,
	glossColor: "#ffffff",
	innerShadow: 0,
	innerShadowWidth: 10,
	innerShadowColor: "#000000",
	shadow: 0,
	shadowX: 0,
	shadowY: 4,
	shadowBlur: 10,
	shadowSpread: 0,
	shadowColor: "#000000",
	tint: "#ffffff",
	alpha: 1,
	brightness: 0,
	offsetX: 0,
	offsetY: 0
};
var DEFAULT_HOVER = { brightness: .15 };
var DEFAULT_PRESSED = {
	brightness: -.12,
	offsetY: 2
};
/** Mix a colour toward white (b > 0) or black (b < 0); alpha untouched. */
function brighten(c, b) {
	if (!b) return c;
	const k = b < 0 ? -b : b;
	const to = b > 0 ? 1 : 0;
	return [
		c[0] + (to - c[0]) * k,
		c[1] + (to - c[1]) * k,
		c[2] + (to - c[2]) * k,
		c[3]
	];
}
var stateStyle = (v, dflt) => v === true ? dflt : v === false || v == null ? null : v;
/**
* Flatten a style (name, object, or object with `base`) into decided numbers,
* optionally overlaid with its `hover` / `pressed` look.
*
* Pure — a shallow merge plus cached colour parses, cheap enough to call per
* panel per frame, so animating a style field just works. Nothing is memoised
* on the style object precisely so that a MUTATED style takes effect at once.
*/
function resolveUiStyle(style, state = "base") {
	const own = typeof style === "string" ? UI_STYLES[style] ?? {} : style ?? {};
	const base = own.base ? UI_STYLES[own.base] ?? {} : {};
	const hover = stateStyle(own.hover ?? base.hover, DEFAULT_HOVER);
	const pressed = stateStyle(own.pressed ?? base.pressed, DEFAULT_PRESSED);
	const overlay = (state === "hover" ? hover : state === "pressed" ? pressed : null) ?? {};
	const s = {
		...DEFAULTS,
		...base,
		...own,
		...overlay
	};
	const rawRadius = overlay.radius ?? own.radius ?? base.radius;
	const rawBevelW = overlay.bevelWidth ?? own.bevelWidth ?? base.bevelWidth;
	const b = s.brightness;
	const fill = brighten(rgba(s.fill), b);
	const borderColor = brighten(rgba(s.borderColor), b);
	return {
		radius: radii(rawRadius, DEFAULTS.radius),
		fill,
		fillTo: s.fillTo ? brighten(rgba(s.fillTo), b) : fill,
		fillAngle: s.fillAngle * DEG,
		border: s.border,
		borderColor,
		borderColorTo: s.borderColorTo ? brighten(rgba(s.borderColorTo), b) : borderColor,
		bevel: s.bevel,
		bevelWidth: or(rawBevelW, s.border > 0 ? s.border * 2 : 6),
		light: s.light * DEG,
		gloss: s.gloss,
		glossHeight: s.glossHeight,
		glossInset: s.glossInset,
		glossColor: rgba(s.glossColor),
		innerShadow: s.innerShadow,
		innerShadowWidth: s.innerShadowWidth,
		innerShadowColor: rgba(s.innerShadowColor),
		shadow: s.shadow,
		shadowX: s.shadowX,
		shadowY: s.shadowY,
		shadowBlur: s.shadowBlur,
		shadowSpread: s.shadowSpread,
		shadowColor: rgba(s.shadowColor),
		tint: rgba(s.tint),
		alpha: s.alpha,
		offsetX: s.offsetX,
		offsetY: s.offsetY,
		interactive: !!(own.interactive ?? base.interactive) || !!hover || !!pressed,
		cursor: own.cursor ?? base.cursor ?? true,
		hasHover: !!hover,
		hasPressed: !!pressed
	};
}
//#endregion
//#region src/lib/ui-widgets.ts
/**
* Is every character in `str` one the LATIN text paths can actually render?
*
* The MSDF atlas and the bitmap font both bake a fixed Latin charset and lay
* glyphs out left-to-right with no shaping or bidi — CJK comes out blank and
* Arabic comes out reversed and unjoined (see msdf.md). Anything past Latin
* Extended-B has to go through UnicodeText instead, and a WIDGET label is
* exactly the place a game will hand us '开始' or 'ابدأ' without thinking about
* it. So the widget layer decides per string rather than making the game pick.
*/
function isLatinText(str) {
	for (const ch of str) if (ch.codePointAt(0) >= 592) return false;
	return true;
}
/** Characters no atlas needs a glyph for — they advance the pen, never draw. */
var INVISIBLE = /* @__PURE__ */ new Set([
	32,
	10,
	13,
	9,
	160
]);
/** Merge overrides onto a style that may be a NAME or an object — the one
*  operation every widget needs to tweak a themed look without losing it. */
function withStyle(style, extra) {
	return typeof style === "string" ? {
		base: style,
		...extra
	} : {
		...style,
		...extra
	};
}
var dark = (c, t) => lerp(c, "#000000", t);
var light = (c, t) => lerp(c, "#ffffff", t);
/** A parsed colour back to '#rrggbb' — how a widget re-tints itself from
*  another style's ALREADY RESOLVED colours. */
function hexOf(c) {
	const b = (v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
	return `#${b(c[0])}${b(c[1])}${b(c[2])}`;
}
/**
* The built-in themes, each generated from ONE base colour.
*
* - **`casual`** (the default) — the bright, chunky, high-contrast look: fat
*   rims, gradients, gloss, rounded everything. Arcade, puzzle, match-3, hyper-
*   casual, kids' games.
* - **`compact`** — small, flat and quiet: 1px rims, tight radii, no gloss, the
*   base colour used only as an accent. Strategy, sim, editors, tools, anything
*   with a lot of controls on screen at once.
* - **`sharp`** — the 90s desktop: square corners, hard 2px rims, flat grey
*   faces, no curve or gloss anywhere. The only LIGHT theme of the three.
*   Retro, hacker/terminal, tycoon and management games, in-fiction computers.
*/
var UI_THEMES = {
	casual: (o) => {
		const c = o.color ?? "#8f5bd8";
		const rim = light(c, .5);
		return {
			button: {
				radius: 16,
				fill: c,
				fillTo: dark(c, .4),
				border: 5,
				borderColor: rim,
				borderColorTo: dark(rim, .3),
				bevel: .45,
				bevelWidth: 10,
				gloss: .5,
				glossHeight: .42,
				glossInset: 9,
				innerShadow: .35,
				innerShadowWidth: 14,
				shadow: .35,
				shadowY: 5,
				shadowBlur: 12,
				hover: true,
				pressed: true
			},
			window: {
				radius: 18,
				fill: dark(c, .72),
				fillTo: dark(c, .85),
				border: 3,
				borderColor: dark(c, .45),
				bevel: .2,
				bevelWidth: 6,
				innerShadow: .25,
				innerShadowWidth: 20,
				shadow: .45,
				shadowY: 8,
				shadowBlur: 22
			},
			header: {
				radius: [
					10,
					10,
					2,
					2
				],
				fill: dark(c, .62),
				fillTo: dark(c, .74),
				border: 0,
				bevel: .12,
				bevelWidth: 3,
				gloss: 0,
				innerShadow: .3,
				innerShadowWidth: 8,
				light: 180
			},
			headerRule: {
				radius: 1,
				fill: rim,
				fillTo: dark(rim, .35),
				bevel: 0
			},
			scrollbar: {
				radius: "pill",
				fill: light(c, .3),
				fillTo: c,
				bevel: .2,
				bevelWidth: 2
			},
			track: {
				radius: "pill",
				fill: dark(c, .88),
				fillTo: dark(c, .78),
				border: 2,
				borderColor: dark(c, .92),
				bevel: .5,
				bevelWidth: 7,
				light: 180,
				innerShadow: .6,
				innerShadowWidth: 10
			},
			fill: {
				radius: "pill",
				fill: light(c, .25),
				fillTo: c,
				bevel: .3,
				bevelWidth: 5,
				gloss: .4,
				glossHeight: .5,
				glossInset: 2
			},
			knob: {
				radius: "pill",
				fill: light(rim, .35),
				fillTo: rim,
				border: 2,
				borderColor: light(rim, .7),
				bevel: .4,
				bevelWidth: 5,
				gloss: .4
			},
			tick: {
				radius: "pill",
				fill: "#ffffff",
				bevel: 0
			},
			text: o.text ?? "#ffffff",
			textMuted: "#ffffff80",
			headerText: o.text ?? "#ffffff",
			headerInherit: true,
			fontSize: o.fontSize ?? 18,
			size: 24,
			gap: 10,
			pad: 10,
			scrollbarSize: 12
		};
	},
	compact: (o) => {
		const c = o.color ?? "#4d9cb5";
		const surface = lerp("#181b20", c, .06);
		return {
			button: {
				radius: 3,
				fill: lerp("#262c35", c, .07),
				fillTo: lerp("#1f242b", c, .07),
				border: 1,
				borderColor: "#39414d",
				bevel: .18,
				bevelWidth: 2,
				hover: { brightness: .09 },
				pressed: {
					brightness: -.07,
					offsetY: 1
				}
			},
			window: {
				radius: 4,
				fill: surface,
				fillTo: dark(surface, .12),
				border: 1,
				borderColor: "#2b313a",
				bevel: .12,
				bevelWidth: 2,
				shadow: .4,
				shadowY: 3,
				shadowBlur: 10
			},
			header: {
				radius: [
					3,
					3,
					0,
					0
				],
				fill: lerp("#12161b", c, .04),
				fillTo: lerp("#151a20", c, .04),
				border: 0,
				bevel: .1,
				bevelWidth: 2,
				gloss: 0
			},
			headerRule: {
				radius: 0,
				fill: lerp("#39414d", c, .3),
				bevel: 0
			},
			scrollbar: {
				radius: "pill",
				fill: "#5b6672",
				fillTo: "#414a55"
			},
			track: {
				radius: 3,
				fill: "#101317",
				fillTo: "#14181d",
				border: 1,
				borderColor: "#0b0d10",
				bevel: .3,
				bevelWidth: 2,
				light: 180,
				innerShadow: .35,
				innerShadowWidth: 4
			},
			fill: {
				radius: 2,
				fill: c,
				fillTo: dark(c, .25),
				bevel: .15,
				bevelWidth: 2
			},
			knob: {
				radius: 2,
				fill: "#8a949f",
				fillTo: "#69737e",
				border: 1,
				borderColor: "#aab3bd",
				bevel: .25,
				bevelWidth: 2
			},
			tick: {
				radius: 1,
				fill: c,
				bevel: 0
			},
			text: o.text ?? "#c3cad3",
			textMuted: "#6c7681",
			headerText: o.text ?? "#c3cad3",
			headerInherit: true,
			fontSize: o.fontSize ?? 13,
			size: 15,
			gap: 7,
			pad: 8,
			scrollbarSize: 9
		};
	},
	sharp: (o) => {
		const c = o.color ?? "#000080";
		const face = "#c6c6c6";
		const lit = "#ffffff";
		const shade = "#5a5a5a";
		const raised = {
			border: 2,
			borderColor: lit,
			borderColorTo: shade
		};
		const sunken = {
			border: 2,
			borderColor: shade,
			borderColorTo: lit
		};
		const square = {
			radius: 0,
			bevel: 0,
			gloss: 0,
			innerShadow: 0
		};
		return {
			button: {
				...square,
				...raised,
				fill: face,
				hover: { brightness: .07 },
				pressed: {
					borderColor: shade,
					borderColorTo: lit,
					offsetX: 1,
					offsetY: 1
				}
			},
			window: {
				...square,
				...raised,
				fill: face,
				shadow: .4,
				shadowX: 4,
				shadowY: 4,
				shadowBlur: 0
			},
			header: {
				...square,
				border: 0,
				fill: c,
				fillTo: light(c, .22),
				fillAngle: 90
			},
			headerRule: {
				...square,
				fill: face,
				alpha: 0
			},
			scrollbar: {
				...square,
				...raised,
				fill: face
			},
			track: {
				...square,
				...sunken,
				fill: "#ffffff"
			},
			fill: {
				...square,
				fill: c
			},
			knob: {
				...square,
				...raised,
				fill: face
			},
			tick: {
				...square,
				fill: "#000000"
			},
			text: o.text ?? "#000000",
			textMuted: "#6d6d6d",
			headerText: "#ffffff",
			headerInherit: false,
			fontSize: o.fontSize ?? 14,
			size: 16,
			gap: 8,
			pad: 8,
			scrollbarSize: 14
		};
	}
};
/** Generate a built-in theme. An unknown name falls back to `casual`. */
function buildUiTheme(name, opts = {}) {
	return (UI_THEMES[name] ?? UI_THEMES.casual)(opts);
}
var DEFAULT_THEME = buildUiTheme("casual");
/**
* The widget layer bound to ONE draw surface. Reach it as `d.ui` — world space
* on `game.draw`, screen pixels on `game.hud`; never construct one.
*/
var Ui = class {
	d;
	deps;
	/**
	* Raise everything `body` draws onto the next LAYER — panels, their labels and
	* their MSDF text together — so it stacks wholly above what is already on
	* screen. This is what makes a modal a modal:
	*
	* ```ts
	* d.panel(20, 20, 400, 300, 'panel');          // a page, with text on it
	* d.ui.label(40, 40, 'lots of body copy…');
	*
	* if (confirming) d.ui.modal(() => {           // …and a dialog OVER it
	*   d.panel(140, 120, 300, 140, 'glossy');
	*   d.ui.label(290, 150, 'Delete the save?', { align: 'center' });
	*   if (d.ui.button(170, 200, 110, 34, 'Delete')) doIt();
	*   if (d.ui.button(300, 200, 110, 34, 'Cancel')) confirming = false;
	* });
	* ```
	*
	* No stencils, no second surface, no ordering rules for the game to learn —
	* the dialog is simply on a layer above the page. Layers nest: a modal opened
	* inside a modal claims the one above its parent.
	*
	* {@link window} does this for you when you give it a `body`, so reach for
	* `modal` only when you are building the frame yourself. Whatever `body`
	* returns comes straight back, so a dialog can report what the user chose.
	*/
	modal(body) {
		const parent = this.d.currentUiLayer;
		this.d.setUiLayer(parent + 1);
		try {
			return body();
		} finally {
			this.d.setUiLayer(parent);
		}
	}
	/** The look of every widget. Mutate a field, or replace it via `setTheme`. */
	theme = { ...DEFAULT_THEME };
	/** Was the widget drawn by the LAST call hovered? (For tooltips and cursors.) */
	hovered = false;
	font = null;
	blocks = /* @__PURE__ */ new Map();
	/** Non-Latin labels, cached the same way — see {@link isLatinText}. */
	uniBlocks = /* @__PURE__ */ new Map();
	memory = /* @__PURE__ */ new Map();
	seq = 0;
	frameNo = 0;
	lastTime = 0;
	dt = 0;
	/** The focused text field's id, or null. */
	focus = null;
	/** The open dropdown's id, or null — only ever one at a time. */
	open = null;
	/** Deferred draws (an open dropdown's popup) flushed at END of frame, so the
	*  list paints OVER whatever was drawn after the select itself. */
	overlays = [];
	/** Characters typed since the last frame, waiting for the focused field. */
	typed = [];
	unsubscribe = null;
	/** Key-repeat clock for Backspace / arrows (the browser's repeat doesn't
	*  reach `keyPressed`, which deliberately ignores auto-repeat). */
	repeatKey = "";
	repeatLeft = 0;
	/** Last pointer Y per drag-scrolling region, so a drag moves by the delta. */
	dragY = /* @__PURE__ */ new Map();
	/** @internal Built by Draw. */
	constructor(d, deps) {
		this.d = d;
		this.deps = deps;
	}
	/**
	* Use a crisp MSDF font for every label (recommended — labels then stay sharp
	* at any scale). Without one the widgets bake a plain system font on first
	* use, so they work with zero setup.
	*/
	setFont(font) {
		this.font = font;
		this.blocks.clear();
		return this;
	}
	/**
	* Can the CURRENT font draw every character of `str`?
	*
	* This asks the font, not a codepoint range, and the difference is the whole
	* reason the hosted atlases carry typographic punctuation: an em dash is far
	* outside Latin, but if the atlas HAS it the string should stay on the crisp
	* distance-field path. A range test would have sent it to the bitmap path
	* forever, however good the font was. Falls back to {@link isLatinText} when
	* there is no MSDF font, since the bitmap fallback really is Latin-only.
	*/
	canRender(str) {
		const font = this.font;
		if (!font) return isLatinText(str);
		for (const ch of str) {
			const code = ch.codePointAt(0);
			if (INVISIBLE.has(code)) continue;
			if (!font.glyph(code)) return false;
		}
		return true;
	}
	/** The retained UNICODE block for a non-Latin label (cached like the MSDF
	*  ones — an immediate-mode label must not re-rasterize every frame). */
	uniBlock(str, size, color, wrap = 0, align = "left", bold = false) {
		if (!this.deps) return null;
		const key = `${size}|${color}|${wrap}|${align}|${bold ? "b" : "r"}|${str}`;
		let b = this.uniBlocks.get(key);
		if (!b) {
			if (this.uniBlocks.size > 200) this.uniBlocks.clear();
			this.uniBlocks.set(key, b = this.deps.unicodeText(str, size, color, wrap, align, bold));
		}
		return b;
	}
	/** The laid-out size of a string, honouring wrap — what a bounded text
	*  container needs in order to know how far it scrolls. */
	textSize(str, opts) {
		const size = opts?.size ?? this.theme.fontSize;
		const wrap = opts?.wrap ?? 0;
		const align = opts?.align ?? "left";
		if (!this.canRender(str)) {
			const b = this.uniBlock(str, size, this.theme.text, wrap, align);
			return b ? {
				w: b.width,
				h: b.height
			} : {
				w: 0,
				h: 0
			};
		}
		if (this.font) {
			const b = this.block(str, size, this.theme.text, wrap, align);
			return {
				w: b.width,
				h: b.height
			};
		}
		const bmp = this.deps?.bitmapFont() ?? null;
		return bmp ? {
			w: bmp.measure(str, size / bmp.lineHeight),
			h: bmp.lineHeight * (size / bmp.lineHeight)
		} : {
			w: str.length * size * .5,
			h: size
		};
	}
	/**
	* Set the look of every widget. Two forms:
	*
	* - **A built-in theme by NAME, generated from one base colour** — the first
	*   thing to reach for, and usually the only styling a game needs:
	*   `ui.setTheme('casual', { color: '#7ac74f' })`,
	*   `ui.setTheme('compact', { color: '#4d9cb5' })`,
	*   `ui.setTheme('sharp', { color: '#000080' })`.
	*   This REPLACES the theme wholesale.
	* - **A partial object**, which MERGES into the current theme:
	*   `ui.setTheme({ fontSize: 20 })`.
	*
	* Either way the theme is PERSISTENT surface state, not per-frame: it stays
	* until changed again.
	*/
	setTheme(theme, opts) {
		this.theme = typeof theme === "string" ? buildUiTheme(theme, opts) : {
			...this.theme,
			...theme
		};
		return this;
	}
	/** Back to the default look (`casual`). Because `setTheme` persists, a screen
	*  that themes part of itself should reset first rather than inherit whatever
	*  the last screen (or the last frame) left behind. */
	resetTheme() {
		this.theme = { ...DEFAULT_THEME };
		return this;
	}
	/**
	* @internal Flush deferred overlay draws (open dropdowns). Called by Draw at
	* the very end of the frame — an immediate-mode popup has to paint after
	* everything else or the widgets below it would cover it.
	*/
	flushOverlays() {
		if (!this.overlays.length) return;
		const pending = this.overlays;
		this.overlays = [];
		for (const fn of pending) fn();
	}
	/** @internal Start a frame (called by Draw.begin). */
	begin(time) {
		this.overlays.length = 0;
		this.seq = 0;
		this.frameNo++;
		this.dt = this.lastTime === 0 ? 0 : Math.max(0, Math.min(.05, time - this.lastTime));
		this.lastTime = time;
		if (!this.unsubscribe && this.deps) {
			const input = this.deps.input();
			if (input) this.unsubscribe = input.onText((ch) => {
				if (this.focus) this.typed.push(ch);
			});
		}
		if (this.memory.size > 256) {
			for (const [k, m] of this.memory) if (this.frameNo - m.seen > 120) this.memory.delete(k);
		}
		if (this.typed.length && !this.focus) this.typed.length = 0;
	}
	id(explicit) {
		return explicit === void 0 ? `w${this.seq++}` : `k${explicit}`;
	}
	mem(id) {
		let m = this.memory.get(id);
		if (!m) this.memory.set(id, m = {
			caret: 0,
			scroll: 0,
			offset: 0,
			pick: -1,
			anim: 0,
			seen: this.frameNo
		});
		m.seen = this.frameNo;
		return m;
	}
	/** Width of `str` at `size`, in surface units — for laying widgets out. */
	measure(str, size = this.theme.fontSize) {
		if (!isLatinText(str)) return this.uniBlock(str, size, this.theme.text)?.width ?? 0;
		if (this.font) return this.block(str, size, this.theme.text).width;
		const bmp = this.deps?.bitmapFont() ?? null;
		return bmp ? bmp.measure(str, size / bmp.lineHeight) : str.length * size * .5;
	}
	block(str, size, color, wrap = 0, align = "left", bold = false) {
		const key = `${size}|${color}|${wrap}|${align}|${bold ? "b" : "r"}|${str}`;
		let b = this.blocks.get(key);
		if (!b) {
			if (this.blocks.size > 400) this.blocks.clear();
			this.blocks.set(key, b = this.deps.msdfText(this.font, str, size, color, wrap, align, bold));
		}
		return b;
	}
	/** A line of text with its LEFT edge at `x` and its baseline box top at `y`. */
	label(x, y, str, opts) {
		const size = opts?.size ?? this.theme.fontSize;
		const color = opts?.color ?? this.theme.text;
		const align = opts?.align ?? "left";
		const wrap = opts?.wrap ?? 0;
		const bold = opts?.bold ?? false;
		const ox = wrap > 0 ? 0 : align === "center" ? .5 : align === "right" ? 1 : 0;
		if (!this.canRender(str)) {
			const b = this.uniBlock(str, size, color, wrap, align, bold);
			if (b) this.d.unicodeText(b, x, y, { origin: { x: ox } });
			return;
		}
		if (this.font && this.deps) {
			this.d.msdfText(this.block(str, size, color, wrap, align, bold), x, y, { origin: { x: ox } });
			return;
		}
		const bmp = this.deps?.bitmapFont() ?? null;
		if (!bmp) return;
		this.d.uiLabel(bmp, str, x, y, {
			scale: size / bmp.lineHeight,
			color,
			align: wrap > 0 ? "left" : align
		});
	}
	/** Centre a label in a rect — the layout every widget wants. */
	labelIn(x, y, w, h, str, size, color, bold = false) {
		if (!this.canRender(str)) {
			const b = this.uniBlock(str, size, color, 0, "left", bold);
			if (b) this.d.unicodeText(b, x + w / 2, y + h / 2, { origin: {
				x: .5,
				y: .5
			} });
			return;
		}
		if (this.font && this.deps) {
			this.d.msdfText(this.block(str, size, color, 0, "left", bold), x + w / 2, y + h / 2, { origin: {
				x: .5,
				y: .5
			} });
			return;
		}
		const bmp = this.deps?.bitmapFont() ?? null;
		if (!bmp) return;
		const scale = size / bmp.lineHeight;
		this.d.uiLabel(bmp, str, x + w / 2, y + h / 2 - bmp.lineHeight * scale / 2, {
			scale,
			color,
			align: "center"
		});
	}
	/**
	* A push button. Returns TRUE on the frame it is clicked (press and release
	* both on the button), so the whole thing is one `if`:
	* ```ts
	* if (d.ui.button(x, y, 180, 52, 'Start')) startGame();
	* ```
	*/
	button(x, y, w, h, label, opts) {
		const id = this.id(opts?.id);
		const t = this.theme;
		let style = opts?.style ?? t.button;
		if (opts?.disabled) style = withStyle(style, {
			tint: "#6b6b6b",
			hover: false,
			pressed: false,
			interactive: false
		});
		const s = this.d.panel(x, y, w, h, style, { id });
		this.hovered = s.hovered;
		this.labelIn(x + s.offsetX, y + s.offsetY, w, h, label, opts?.size ?? t.fontSize, opts?.disabled ? t.textMuted : opts?.color ?? t.text);
		return !opts?.disabled && s.clicked;
	}
	/**
	* A labelled checkbox. The game owns the value — pass it in, store what comes
	* back: `sound = d.ui.checkbox(x, y, 'Sound', sound);`
	* The whole row (box + label) is clickable.
	*/
	checkbox(x, y, label, checked, opts) {
		const id = this.id(opts?.id);
		const t = this.theme;
		const box = opts?.size ?? t.size;
		const fs = opts?.fontSize ?? t.fontSize;
		const rowW = box + (label ? t.gap + this.measure(label, fs) : 0);
		const hit = this.d.panel(x, y, rowW, box, {
			alpha: 0,
			interactive: true,
			cursor: true
		}, { id });
		this.hovered = hit.hovered;
		const now = hit.clicked ? !checked : checked;
		const boxR = Math.min(Math.min(...resolveUiStyle(t.track).radius), box * .22);
		this.d.panel(x, y, box, box, withStyle(t.track, { radius: boxR }), { id: `${id}:box` });
		if (now) {
			const th = Math.max(2, box * .15);
			this.stroke(x + box * .24, y + box * .52, x + box * .43, y + box * .7, th, t.tick);
			this.stroke(x + box * .43, y + box * .7, x + box * .77, y + box * .3, th, t.tick);
		}
		if (label) this.label(x + box + t.gap, y + box / 2 - fs * .5, label, { size: fs });
		return now;
	}
	/**
	* An on/off switch — the same value contract as {@link checkbox}, with the
	* knob sliding between the ends.
	*/
	toggle(x, y, on, opts) {
		const id = this.id(opts?.id);
		const t = this.theme;
		const h = opts?.h ?? t.size;
		const w = opts?.w ?? h * 1.9;
		const m = this.mem(id);
		const hit = this.d.panel(x, y, w, h, {
			alpha: 0,
			interactive: true,
			cursor: true
		}, { id });
		this.hovered = hit.hovered;
		const now = hit.clicked ? !on : on;
		const target = now ? 1 : 0;
		m.anim += (target - m.anim) * Math.min(1, this.dt * 14);
		if (Math.abs(target - m.anim) < .002) m.anim = target;
		this.d.panel(x, y, w, h, now ? t.fill : t.track, { id: `${id}:track` });
		const kh = h * .82;
		const travel = w - kh - (h - kh);
		this.d.panel(x + (h - kh) / 2 + travel * m.anim, y + (h - kh) / 2, kh, kh, t.knob);
		return now;
	}
	/**
	* A horizontal slider. Returns the value, so it reads as an assignment:
	* `volume = d.ui.slider(x, y, 240, volume);`
	* Dragging keeps tracking after the pointer leaves the track.
	*/
	slider(x, y, w, value, opts) {
		const id = this.id(opts?.id);
		const t = this.theme;
		const min = opts?.min ?? 0;
		const max = opts?.max ?? 1;
		const h = opts?.h ?? t.size * .8;
		const knob = h * 1.6;
		const span = Math.max(1e-6, max - min);
		const hit = this.d.panel(x - knob / 2, y - (knob - h) / 2, w + knob, knob, {
			alpha: 0,
			interactive: true,
			cursor: true
		}, { id });
		this.hovered = hit.hovered;
		let v = value;
		if (hit.active) {
			const p = this.d.uiPointer();
			if (p) {
				v = min + (p.x - x) / Math.max(1e-6, w) * span;
				if (opts?.step) v = Math.round(v / opts.step) * opts.step;
			}
		}
		v = v < min ? min : v > max ? max : v;
		const frac = (v - min) / span;
		this.d.panel(x, y, w, h, t.track, { id: `${id}:track` });
		if (frac > .001) this.d.panel(x + 2, y + 2, Math.max(0, (w - 4) * frac), h - 4, t.fill);
		this.d.panel(x + w * frac - knob / 2, y - (knob - h) / 2, knob, knob, t.knob);
		return v;
	}
	/** A read-only bar: `frac` is 0..1. Health, XP, loading, cooldowns. */
	progress(x, y, w, h, frac, opts) {
		const t = this.theme;
		const f = frac < 0 ? 0 : frac > 1 ? 1 : frac;
		this.d.panel(x, y, w, h, opts?.track ?? t.track);
		if (f > .001) this.d.panel(x + 2, y + 2, Math.max(0, (w - 4) * f), h - 4, opts?.fill ?? t.fill);
		if (opts?.label) this.labelIn(x, y, w, h, opts.label, Math.min(t.fontSize, h * .7), t.text);
		this.hovered = false;
	}
	/**
	* A frame to sit other widgets on, with an optional title bar. Returns the
	* INNER rect, so the contents lay out against it rather than magic numbers.
	*/
	window(x, y, w, h, title, opts) {
		const t = this.theme;
		const pad = opts?.pad ?? t.pad;
		const style = opts?.style ?? t.window;
		const auto = h === "auto" || !!opts?.body;
		const parentLayer = this.d.currentUiLayer;
		if (opts?.body) this.d.setUiLayer(parentLayer + 1);
		const guess = typeof h === "number" ? h : 0;
		const slot = auto ? this.d.reservePanel(x, y, w, guess, style) : -1;
		if (!auto) this.d.panel(x, y, w, guess, style);
		let top = y + pad;
		if (title) {
			const barH = t.fontSize + pad * 1.4;
			this.header(x + pad, y + pad, w - pad * 2, barH, title, { inside: style });
			top = y + pad + barH + pad;
		}
		const inner = {
			x: x + pad,
			y: top,
			w: w - pad * 2,
			h: typeof h === "number" ? y + h - pad - top : 0
		};
		if (opts?.body) {
			this.d.beginMeasure();
			opts.body(inner);
			const bottom = this.d.endMeasure();
			const height = typeof h === "number" ? h : Math.max((bottom === -Infinity ? top : bottom) + pad - y, top + pad - y);
			this.d.patchPanel(slot, x, y, w, height);
			inner.h = y + height - pad - top;
		} else if (slot >= 0) this.d.patchPanel(slot, x, y, w, guess);
		this.d.setUiLayer(parentLayer);
		this.hovered = false;
		return inner;
	}
	/**
	* A SINGLE-LINE text field — HTML's `<input type="text">`. The game owns the
	* string: `name = d.ui.input(x, y, 240, 40, name);`
	*
	* It never wraps: overflow scrolls horizontally to keep the caret in view.
	* For a paragraph that wraps inside its box, use {@link textarea}.
	*
	* Click to focus (click away, or Enter/Escape, to blur). Typing, Backspace,
	* Delete, arrows and Home/End all work; there is no selection or clipboard.
	*/
	input(x, y, w, h, value, opts) {
		const id = this.id(opts?.id);
		const t = this.theme;
		const fs = opts?.size ?? t.fontSize;
		const pad = t.pad;
		const m = this.mem(id);
		const focused = this.focusField(id, x, y, w, h, value);
		let out = value;
		if (focused) out = this.editText(m, out, opts?.max, false);
		this.d.panel(x, y, w, h, this.focus === id ? withStyle(t.track, {
			border: 2,
			borderColor: "#7fd4c1"
		}) : t.track, { id: `${id}:box` });
		const inner = Math.max(1, w - pad * 2);
		const caretX = this.measure(out.slice(0, m.caret), fs);
		if (this.focus !== id) m.offset = 0;
		else m.offset = Math.max(0, caretX - inner);
		const shown = out.length ? out : opts?.placeholder ?? "";
		const color = out.length ? t.text : t.textMuted;
		this.d.pushClip(x + pad, y, inner, h);
		this.label(x + pad - m.offset, y + h / 2 - fs * .5, shown, {
			size: fs,
			color,
			align: opts?.align
		});
		if (this.focus === id && Math.floor(this.lastTime * 2) % 2 === 0) this.d.panel(x + pad + caretX - m.offset, y + h * .2, Math.max(1.5, fs * .08), h * .6, {
			fill: t.text,
			radius: 1
		});
		this.d.popClip();
		return out;
	}
	/**
	* A MULTI-LINE text box — HTML's `<textarea>`. Word-wraps to its own width,
	* aligns, scrolls when the content outgrows the box, and is clipped to its
	* bounds so nothing spills:
	* `notes = d.ui.textarea(x, y, 320, 160, notes);`
	*
	* Enter inserts a newline here (it does NOT blur — Escape does, or a click
	* away). Wheel or drag to scroll when it overflows.
	*/
	textarea(x, y, w, h, value, opts) {
		const id = this.id(opts?.id);
		const t = this.theme;
		const fs = opts?.size ?? t.fontSize;
		const pad = t.pad;
		const m = this.mem(id);
		const focused = this.focusField(id, x, y, w, h, value);
		let out = value;
		if (focused && !opts?.readOnly) out = this.editText(m, out, opts?.max, true);
		this.d.panel(x, y, w, h, this.focus === id ? withStyle(t.track, {
			border: 2,
			borderColor: "#7fd4c1"
		}) : t.track, { id: `${id}:box` });
		const innerW = Math.max(1, w - pad * 2);
		const innerH = Math.max(1, h - pad * 2);
		const shown = out.length ? out : opts?.placeholder ?? "";
		const color = out.length ? t.text : t.textMuted;
		const of = opts?.overflow ?? "auto";
		const bar = of === "scroll" || of === "auto";
		const wrapW = innerW - (bar ? t.scrollbarSize + 6 : 0);
		const size = this.textSize(shown, {
			size: fs,
			wrap: wrapW,
			align: opts?.align
		});
		const max = Math.max(0, size.h - innerH);
		const barX = x + w - pad - t.scrollbarSize;
		const showBar = of === "scroll" || of === "auto" && max > 0;
		const barRect = showBar ? {
			x: barX,
			y: y + pad,
			h: innerH
		} : null;
		m.offset = bar ? this.scrollBy(id, x, y, w, h, m.offset, max, barRect) : 0;
		const clipped = of !== "visible";
		if (clipped) this.d.pushClip(x + pad, y + pad, innerW, innerH);
		this.label(x + pad, y + pad - m.offset, shown, {
			size: fs,
			color,
			wrap: wrapW,
			align: opts?.align
		});
		if (clipped) this.d.popClip();
		if (showBar) this.scrollbar(barX, y + pad, innerH, m.offset, Math.max(size.h, innerH));
		return out;
	}
	/**
	* One option of a radio GROUP — HTML's `<input type="radio">`. Pass the
	* group's current value and this option's own value; the call returns the
	* value the group should now hold, so a group is one line per option:
	* ```ts
	* for (const o of OPTIONS) mode = d.ui.radio(x, y += 28, o, mode, o);
	* ```
	*/
	radio(x, y, label, group, value, opts) {
		const id = this.id(opts?.id);
		const t = this.theme;
		const box = opts?.size ?? t.size;
		const fs = opts?.fontSize ?? t.fontSize;
		const rowW = box + (label ? t.gap + this.measure(label, fs) : 0);
		const hit = this.d.panel(x, y, rowW, box, {
			alpha: 0,
			interactive: true,
			cursor: true
		}, { id });
		this.hovered = hit.hovered;
		const on = group === value;
		this.d.panel(x, y, box, box, withStyle(t.track, { radius: "pill" }), { id: `${id}:box` });
		if (on) {
			const inset = box * .28;
			this.d.panel(x + inset, y + inset, box - inset * 2, box - inset * 2, withStyle(t.tick, { radius: "pill" }));
		}
		if (label) this.label(x + box + t.gap, y + box / 2 - fs * .5, label, { size: fs });
		return hit.clicked ? value : group;
	}
	/**
	* A heading bar — a container's title, or a section divider in a form. Inert
	* by design: it does not hover, press or report clicks, because it is a
	* LABEL on a surface, not a control. {@link window} draws its title with
	* this, so retheming `header` retitles every container at once.
	*/
	header(x, y, w, h, text, opts) {
		const t = this.theme;
		const size = opts?.size ?? t.fontSize;
		let style = t.header;
		let rule = t.headerRule;
		if (opts?.inside !== void 0 && t.headerInherit !== false) {
			const host = resolveUiStyle(opts.inside);
			const base = hexOf(host.fill);
			const rTop = Math.max(0, Math.min(host.radius[0], host.radius[1]) - t.pad * .5);
			style = withStyle(style, {
				fill: dark(base, .42),
				fillTo: dark(base, .56),
				radius: [
					rTop,
					rTop,
					2,
					2
				]
			});
			rule = withStyle(rule, { fill: hexOf(host.borderColor) });
		}
		this.d.panel(x, y, w, h, style);
		this.d.panel(x, y + h - 2, w, 2, rule);
		const align = opts?.align ?? "center";
		const bold = opts?.bold ?? true;
		const color = opts?.color ?? t.headerText ?? t.text;
		if (align === "center") this.labelIn(x, y, w, h, text, size, color, bold);
		else {
			const lx = align === "right" ? x + w - t.pad : x + t.pad;
			this.label(lx, y + h / 2 - size * .5, text, {
				size,
				color,
				align,
				bold
			});
		}
		this.hovered = false;
	}
	/**
	* A scrolling region. Everything the callback draws is clipped to the box and
	* shifted by the scroll offset; rows scrolled out of view are neither drawn
	* nor clickable. `contentHeight` is how tall the content is in total.
	*
	* ```ts
	* d.ui.list(x, y, 260, 200, items.length * 32, (lx, ly, lw) => {
	*   items.forEach((it, i) => { if (d.ui.button(lx, ly + i * 32, lw, 28, it)) pick(it); });
	* });
	* ```
	*/
	list(x, y, w, h, contentHeight, body, opts) {
		const id = this.id(opts?.id);
		const t = this.theme;
		const pad = opts?.pad ?? t.pad;
		const m = this.mem(id);
		const innerW = Math.max(1, w - pad * 2);
		const innerH = Math.max(1, h - pad * 2);
		const of = opts?.overflow ?? "auto";
		const bar = of === "scroll" || of === "auto";
		const max = Math.max(0, contentHeight - innerH);
		this.d.panel(x, y, w, h, opts?.style ?? t.track, { id: `${id}:box` });
		const barX = x + w - pad - t.scrollbarSize;
		const showBar = of === "scroll" || of === "auto" && max > 0;
		const barRect = showBar ? {
			x: barX,
			y: y + pad,
			h: innerH
		} : null;
		m.offset = bar ? this.scrollBy(id, x, y, w, h, m.offset, max, barRect) : 0;
		const clipped = of !== "visible";
		if (clipped) this.d.pushClip(x + pad, y + pad, innerW, innerH);
		body(x + pad, y + pad - m.offset, innerW - (showBar ? t.scrollbarSize + 6 : 0));
		if (clipped) this.d.popClip();
		if (showBar) this.scrollbar(barX, y + pad, innerH, m.offset, Math.max(contentHeight, innerH));
		this.hovered = false;
	}
	/**
	* A dropdown — HTML's `<select>`. Shows the current value; click to drop a
	* scrolling list of options over everything else, click one to choose it.
	* Same value contract as the rest: pass the value, store what comes back.
	*
	* ```ts
	* quality = d.ui.select(x, y, 200, 32, quality, ['Low', 'Medium', 'High']);
	* ```
	*
	* The popup is deferred to the end of the frame, so it paints over widgets
	* drawn after this one, and it is clipped and scrolled like any other list.
	*/
	select(x, y, w, h, value, options, opts) {
		const id = this.id(opts?.id);
		const t = this.theme;
		const fs = opts?.size ?? t.fontSize;
		const text = opts?.label ?? ((o) => String(o));
		const isOpen = this.open === id;
		const m = this.mem(id);
		let out = value;
		if (m.pick >= 0) {
			if (m.pick < options.length) out = options[m.pick];
			m.pick = -1;
		}
		const box = this.d.panel(x, y, w, h, t.button, { id });
		this.hovered = box.hovered;
		this.label(x + t.pad + box.offsetX, y + box.offsetY + h / 2 - fs * .5, text(out), { size: fs });
		const arm = Math.max(3, fs * .32);
		const drop = arm * .62;
		const cx = x + w - t.pad - arm + box.offsetX;
		const cy = y + box.offsetY + h / 2;
		const th = Math.max(1.6, fs * .12);
		const chevron = withStyle(t.tick, { radius: "pill" });
		const tipY = isOpen ? cy - drop / 2 : cy + drop / 2;
		const endY = isOpen ? cy + drop / 2 : cy - drop / 2;
		this.stroke(cx - arm, endY, cx, tipY, th, chevron);
		this.stroke(cx, tipY, cx + arm, endY, th, chevron);
		if (box.clicked) this.open = isOpen ? null : id;
		if (isOpen) {
			const rowH = fs + t.pad * 1.4;
			const listH = Math.min(opts?.maxHeight ?? 220, options.length * rowH + t.pad * 2);
			const ly = y + h + 4;
			this.overlays.push(() => {
				this.list(x, ly, w, listH, options.length * rowH, (bx, by, bw) => {
					options.forEach((o, i) => {
						const ry = by + i * rowH;
						if (!this.d.visible(bx, ry, bw, rowH - 2)) return;
						const on = o === value;
						if (this.button(bx, ry, bw, rowH - 2, text(o), {
							id: `${id}:opt${i}`,
							style: on ? withStyle(t.button, { brightness: .12 }) : t.button,
							size: fs
						})) {
							m.pick = i;
							this.open = null;
						}
					});
				}, {
					id: `${id}:list`,
					style: t.window
				});
			});
			const p = this.d.uiPointer();
			if (p?.down && !box.hovered && !this.pointerInRect(p, x, ly, w, listH)) this.open = null;
		}
		return out;
	}
	pointerInRect(p, x, y, w, h) {
		return p.x >= x && p.x <= x + w && p.y >= y && p.y <= y + h;
	}
	/**
	* A line stroke from (ax, ay) to (bx, by) as a capsule panel.
	*
	* Icon strokes have to be built from their ENDPOINTS, not by laying panels
	* side by side and rotating them: a panel rotates about its own centre, which
	* shortens its horizontal reach, so two 'adjacent' arms end up separated by
	* the projection they each lost. Everything drawn as line art here — the
	* checkbox tick, the select chevron — goes through this.
	*/
	stroke(ax, ay, bx, by, thickness, style) {
		const dx = bx - ax, dy = by - ay;
		const len = Math.hypot(dx, dy) + thickness;
		this.d.panel((ax + bx) / 2 - len / 2, (ay + by) / 2 - thickness / 2, len, thickness, style, { rot: Math.atan2(dy, dx) });
	}
	/** Focus/blur bookkeeping shared by `input` and `textarea`. Returns whether
	*  THIS field holds focus after the click is accounted for. */
	focusField(id, x, y, w, h, value) {
		const hit = this.d.panel(x, y, w, h, {
			alpha: 0,
			interactive: true,
			cursor: false
		}, { id });
		this.hovered = hit.hovered;
		const pointer = this.d.uiPointer();
		const m = this.mem(id);
		if (hit.clicked) {
			this.focus = id;
			m.caret = value.length;
			this.typed.length = 0;
		} else if (this.focus === id && pointer?.down && !hit.hovered) this.focus = null;
		return this.focus === id;
	}
	/** Apply this frame's typing and edit keys to `text`, returning the new value.
	*  `multiline` decides whether Enter inserts a newline or blurs. */
	editText(m, text, max, multiline) {
		let out = text;
		m.caret = Math.max(0, Math.min(m.caret, out.length));
		for (const ch of this.typed) {
			if (max !== void 0 && out.length >= max) break;
			out = out.slice(0, m.caret) + ch + out.slice(m.caret);
			m.caret++;
		}
		this.typed.length = 0;
		const input = this.deps?.input() ?? null;
		if (!input) return out;
		const edit = (code) => {
			if (input.keyPressed(code)) {
				this.repeatKey = code;
				this.repeatLeft = .4;
				return true;
			}
			if (this.repeatKey === code && input.key(code)) {
				this.repeatLeft -= this.dt;
				if (this.repeatLeft <= 0) {
					this.repeatLeft = .045;
					return true;
				}
			}
			return false;
		};
		if (this.repeatKey && !input.key(this.repeatKey)) this.repeatKey = "";
		if (edit("Backspace") && m.caret > 0) {
			out = out.slice(0, m.caret - 1) + out.slice(m.caret);
			m.caret--;
		}
		if (edit("Delete") && m.caret < out.length) out = out.slice(0, m.caret) + out.slice(m.caret + 1);
		if (edit("ArrowLeft")) m.caret = Math.max(0, m.caret - 1);
		if (edit("ArrowRight")) m.caret = Math.min(out.length, m.caret + 1);
		if (input.keyPressed("Home")) m.caret = 0;
		if (input.keyPressed("End")) m.caret = out.length;
		if (multiline) {
			if (input.keyPressed("Enter") && (max === void 0 || out.length < max)) {
				out = out.slice(0, m.caret) + "\n" + out.slice(m.caret);
				m.caret++;
			}
			if (input.keyPressed("Escape")) this.focus = null;
		} else if (input.keyPressed("Enter", "Escape")) this.focus = null;
		return out;
	}
	/**
	* Advance a scroll offset from the wheel, from dragging the CONTENT, and from
	* dragging the SCROLLBAR — which move in opposite directions, and both feel
	* right that way:
	*
	* - dragging the content is touch-style, the content follows the finger, so
	*   pulling DOWN reveals what is ABOVE;
	* - dragging the bar is absolute, the thumb follows the pointer, so pulling
	*   DOWN reveals what is BELOW.
	*
	* They are separate hit regions (the content's stops short of the bar's
	* gutter), so one drag never drives both.
	*/
	scrollBy(id, x, y, w, h, offset, maxOffset, bar) {
		let next = offset;
		const p = this.d.uiPointer();
		const bw = this.theme.scrollbarSize;
		const grab = bw + 8;
		const gutter = bar ? grab : 0;
		let overBar = false;
		if (bar && maxOffset > 0) {
			const hit = this.d.panel(bar.x - (grab - bw) / 2, bar.y, grab, bar.h, {
				alpha: 0,
				interactive: true,
				cursor: false
			}, { id: `${id}:bar` });
			overBar = hit.hovered;
			if (hit.active && p) {
				const frac = Math.max(.08, bar.h / (maxOffset + bar.h));
				const thumbH = bar.h * frac;
				const travel = Math.max(1e-6, bar.h - thumbH);
				next = (p.y - bar.y - thumbH / 2) / travel * maxOffset;
			}
		}
		const drag = this.d.panel(x, y, Math.max(1, w - gutter), h, {
			alpha: 0,
			interactive: true,
			cursor: false
		}, { id: `${id}:scroll` });
		if (drag.active && p) {
			const last = this.dragY.get(id);
			if (last !== void 0) next -= p.y - last;
			this.dragY.set(id, p.y);
		} else this.dragY.delete(id);
		const input = this.deps?.input() ?? null;
		if ((drag.hovered || overBar) && input) next += input.wheelDelta;
		return Math.max(0, Math.min(maxOffset, next));
	}
	/** The thin position indicator down the right edge of a scrolling box. */
	scrollbar(x, y, h, offset, content) {
		const bw = this.theme.scrollbarSize;
		const frac = Math.max(.08, h / Math.max(1, content));
		const travel = h * (1 - frac);
		const at = content > h ? offset / (content - h) : 0;
		this.d.panel(x, y, bw, h, withStyle(this.theme.track, {
			border: 0,
			shadow: 0
		}));
		this.d.panel(x, y + travel * Math.max(0, Math.min(1, at)), bw, h * frac, this.theme.scrollbar);
	}
};
//#endregion
//#region src/lib/draw.ts
var INERT = Object.freeze({
	hovered: false,
	pressed: false,
	active: false,
	clicked: false,
	offsetX: 0,
	offsetY: 0
});
var Draw = class {
	cutout;
	blend;
	atlas;
	add;
	fxb;
	glow;
	grid;
	tri;
	textPass;
	pointerIn;
	uiPass;
	textq;
	zCursor = 0;
	time = 0;
	/**
	* @internal Built by `Game` — reach a surface as `game.draw` / `game.hud` (or
	* the `d` handed to `run()` / `draw()` / `drawHud()`), never construct one.
	* (Also keeps the internal `TextPointer` out of the shipped `.d.ts`.)
	*/
	constructor(cutout, blend, atlas, add = blend, fxb = null, glow = null, grid = null, tri = null, textPass = null, pointerIn = null, uiPass = null, textq = null) {
		this.cutout = cutout;
		this.blend = blend;
		this.atlas = atlas;
		this.add = add;
		this.fxb = fxb;
		this.glow = glow;
		this.grid = grid;
		this.tri = tri;
		this.textPass = textPass;
		this.pointerIn = pointerIn;
		this.uiPass = uiPass;
		this.textq = textq;
	}
	/**
	* @internal Boxes of every text block drawn on this surface this frame —
	* collected only while the debug overlay's `textBounds` is on, so a shipped
	* game pays nothing. The overlay draws them and reddens the ones that clash.
	*/
	textBoxes = [];
	/** @internal Set by Game from `game.debug`. */
	traceText = false;
	viewX = 0;
	viewY = 0;
	viewW = 0;
	viewH = 0;
	/**
	* The clip stack. Each entry is NORMALISED to the surface (0..1), already
	* intersected with its parent, so a nested clip can only ever shrink — the
	* same rule CSS overflow follows.
	*/
	clipStack = [];
	/** 0 = the normal UI, 1 = overlays (open dropdowns, tooltips). See ui.ts. */
	/**
	* The current LAYER. 0 is the frame's ordinary content — sprites, shapes,
	* text and panels alike, ordered purely by the order the game drew them. A
	* window or modal claims 1, 2, … and everything it draws goes wholly above
	* everything below, which is the only thing call order cannot express.
	*/
	uiLayer = 0;
	/** Deepest layer any window reached this frame — overlays go one above it. */
	maxUiLayer = 0;
	/** How far down anything has been drawn while measuring is on (see
	*  {@link beginMeasure}); -Infinity when nothing has been drawn yet. */
	measureBottom = -Infinity;
	measuring = 0;
	/** This surface's width in its own units this frame (`game.view.w` for
	*  `game.draw`, the HUD reference for `game.hud`). */
	get w() {
		return this.viewW;
	}
	/** This surface's height in its own units this frame — see {@link w}. */
	get h() {
		return this.viewH;
	}
	_ui = null;
	uiDeps = null;
	/**
	* The WIDGET layer for this surface — `button`, `checkbox`, `toggle`,
	* `slider`, `progress`, `window`, `input`, `textarea`, `list` (see ui.md),
	* named after HTML's. Built on `panel()`,
	* so widgets inherit its size-independence and restyle from one theme.
	*
	* ```ts
	* if (d.ui.button(x, y, 180, 52, 'Start')) startGame();
	* ```
	*/
	get ui() {
		return this._ui ?? (this._ui = new Ui(this, this.uiDeps));
	}
	/**
	* @internal Flush this surface's deferred UI overlays (open dropdowns).
	* Called by Game after the frame's own drawing, never by games.
	*
	* They draw on LAYER 1, which the renderers flush after the normal text pass.
	* Submission order alone is not enough: panels and text are separate passes,
	* so a popup drawn last still ends up under text drawn earlier.
	*/
	flushUiOverlays() {
		if (!this._ui) return;
		const was = this.uiLayer;
		this.setUiLayer(this.maxUiLayer + 1);
		this._ui.flushOverlays();
		this.setUiLayer(was);
	}
	/**
	* @internal Point every UI pass at layer `n` — panels, their bitmap labels
	* and their MSDF text together. They are separate batches but ONE stack:
	* moving them in lockstep is what makes a window a single object.
	*
	* Driven by `d.ui.window()`; games do not call it.
	*/
	setUiLayer(n) {
		this.uiLayer = n;
		if (n > this.maxUiLayer) this.maxUiLayer = n;
		this.blend.setLayer(n);
		if (this.add !== this.blend) this.add.setLayer(n);
		this.textq?.setLayer(n);
		if (this.textPass) this.textPass.layer = n;
	}
	/** @internal The layer a window opened here would claim. */
	get currentUiLayer() {
		return this.uiLayer;
	}
	/** @internal Wired by Game after construction — input and the fallback font
	*  are both built later than the Draw surfaces themselves. */
	attachUi(deps) {
		this.uiDeps = deps;
		if (this._ui) this._ui = new Ui(this, deps);
	}
	/**
	* @internal Start measuring how far down subsequent drawing reaches. Nests.
	* A container uses this to size itself to its content: it pushes its frame
	* first (the frame must paint UNDER the content), draws the content, then
	* corrects the frame's height from what came back.
	*/
	beginMeasure() {
		if (this.measuring++ === 0) this.measureBottom = -Infinity;
	}
	/** @internal Stop measuring; returns the lowest Y drawn, or -Infinity. */
	endMeasure() {
		this.measuring = Math.max(0, this.measuring - 1);
		return this.measureBottom;
	}
	/**
	* @internal Note that something reached down to `bottom`.
	*
	* CLAMPED TO THE CLIP, which is the whole subtlety: a scroll region's rows are
	* laid out at their scrolled positions and most of them hang far below the box
	* they show through. Measuring where they were DRAWN rather than where they
	* are VISIBLE made an auto-sized window grow and shrink as you scrolled it —
	* tall while the rows hung out of the bottom, correct once you reached the
	* end. Nothing clipped away can make its container taller.
	*/
	mark(bottom) {
		if (this.measuring <= 0) return;
		const c = this.clip;
		if (c) bottom = Math.min(bottom, this.viewY + c.y1 * this.viewH);
		if (bottom > this.measureBottom) this.measureBottom = bottom;
	}
	/** Centre `opts.label` on a panel that has just been pushed, on its layer. */
	panelLabel(opts, x, y, w, h) {
		const str = opts?.label;
		if (!str) return;
		const bmp = this.uiDeps?.bitmapFont() ?? null;
		if (!bmp) return;
		const scale = (opts.labelSize ?? this._ui?.theme.fontSize ?? 16) / bmp.lineHeight;
		this.uiLabel(bmp, str, x + w / 2, y + h / 2 - bmp.lineHeight * scale / 2, {
			scale,
			color: opts.labelColor ?? this._ui?.theme.text ?? "#ffffff",
			align: "center"
		});
	}
	/** @internal Reserve a panel now and correct its rect later — the container
	*  auto-size path. Returns the instance index, or -1. */
	reservePanel(x, y, w, h, style) {
		if (!this.uiPass) return -1;
		return this.uiPass.push(x, y, w, h, resolveUiStyle(style), 0, this.clip, this.uiLayer);
	}
	/** @internal Rewrite a reserved panel's rectangle (see {@link reservePanel}). */
	patchPanel(index, x, y, w, h) {
		this.uiPass?.patchRect(index, x, y, w, h);
	}
	/** @internal This surface's pointer, in its own units — widgets that DRAG
	*  (the slider) need the position, not just the panel's hit flags. */
	uiPointer() {
		return this.pointerIn?.() ?? null;
	}
	/** Press state per interactive panel, keyed by its id (explicit or implicit). */
	panelMemory = /* @__PURE__ */ new Map();
	/** The implicit-id cursor: which interactive panel this is, in call order. */
	panelSeq = 0;
	frameNo = 0;
	/**
	* Clip everything drawn until the matching {@link popClip} to this rectangle,
	* in the SURFACE's own units. Nested clips intersect, so a child can never
	* paint outside its parent.
	*
	* This is how a scrolling region, a masked panel, or a text field that must
	* not spill over its neighbours are built:
	* ```ts
	* d.pushClip(x, y, w, h);
	* for (const item of items) d.ui.button(x, y + item.top - scroll, w, 40, item.name);
	* d.popClip();
	* ```
	*
	* **Panels and text obey it; sprites, lines and shapes do not yet** — it is a
	* hardware scissor on the UI and text passes (see ui.md).
	*/
	pushClip(x, y, w, h) {
		const c = {
			x0: (x - this.viewX) / Math.max(1e-6, this.viewW),
			y0: (y - this.viewY) / Math.max(1e-6, this.viewH),
			x1: (x + w - this.viewX) / Math.max(1e-6, this.viewW),
			y1: (y + h - this.viewY) / Math.max(1e-6, this.viewH)
		};
		const parent = this.clipStack[this.clipStack.length - 1];
		if (parent) {
			c.x0 = Math.max(c.x0, parent.x0);
			c.y0 = Math.max(c.y0, parent.y0);
			c.x1 = Math.min(Math.max(c.x1, c.x0), parent.x1);
			c.y1 = Math.min(Math.max(c.y1, c.y0), parent.y1);
		}
		this.clipStack.push(c);
		this.syncClip();
	}
	/** Pop the innermost clip pushed by {@link pushClip}. */
	popClip() {
		this.clipStack.pop();
		this.syncClip();
	}
	/** The clip in force right now, or null. */
	get clip() {
		return this.clipStack.length ? this.clipStack[this.clipStack.length - 1] : null;
	}
	/** Text submitters don't take a clip argument, so the text pass carries the
	*  current one and reads it inside alloc(). */
	syncClip() {
		if (this.textPass) this.textPass.clip = this.clip;
	}
	/**
	* Is any of this rect visible through the current clip? Widgets use it to
	* skip work for rows scrolled out of view — clipping stops them DRAWING, this
	* stops them being built at all.
	*/
	visible(x, y, w, h) {
		const c = this.clip;
		if (!c) return true;
		const x0 = (x - this.viewX) / Math.max(1e-6, this.viewW);
		const y0 = (y - this.viewY) / Math.max(1e-6, this.viewH);
		const x1 = (x + w - this.viewX) / Math.max(1e-6, this.viewW);
		const y1 = (y + h - this.viewY) / Math.max(1e-6, this.viewH);
		return x1 > c.x0 && x0 < c.x1 && y1 > c.y0 && y0 < c.y1;
	}
	/** @internal Start a frame (called by Game). */
	begin(x, y, w, h, time = 0) {
		this.zCursor = 0;
		this.clipStack.length = 0;
		this.uiLayer = 0;
		this.maxUiLayer = 0;
		this.viewX = x;
		this.viewY = y;
		this.panelSeq = 0;
		this.frameNo++;
		this._ui?.begin(time);
		if (this.panelMemory.size > 256) {
			for (const [k, m] of this.panelMemory) if (this.frameNo - m.seen > 120) this.panelMemory.delete(k);
		}
		if (this.textBoxes.length) this.textBoxes.length = 0;
		this.time = time;
		this.viewW = w;
		this.viewH = h;
		this.cutout.begin(x, y, w, h);
		this.blend.begin(x, y, w, h);
		if (this.add !== this.blend) this.add.begin(x, y, w, h);
		if (this.textq && this.textq !== this.blend) this.textq.begin(x, y, w, h);
		this.fxb?.begin(x, y, w, h);
		this.glow?.begin(x, y, w, h);
		this.grid?.begin(x, y, w, h, time);
	}
	/** @internal Particle push: centred disc (frame -1) or sprite frame, float colour, premul-routed. */
	part(cx, cy, size, rot, frame, r, g, b, a, add) {
		const batch = add ? this.add : this.blend;
		const z = this.nextZ();
		if (frame >= 0) {
			const f = this.atlas.frames[frame];
			if (!f) return;
			batch.push(cx - size, cy - size, size * 2, size * 2, f, 0, rot, 0, z, r, g, b, a);
		} else batch.push(cx - size, cy - size, size * 2, size * 2, this.atlas.frames[0], 1, 0, 0, z, r, g, b, a);
	}
	/** @internal The next auto-depth value (call order). */
	nextZ() {
		return ++this.zCursor;
	}
	/** A textured sprite: `frame` is an index from game.assets.frames()/game.assets.text(). */
	sprite(frame, x, y, opts) {
		const f = this.atlas.frames[frame];
		if (!f) return;
		const c = opts?.tint ? rgba(opts.tint) : WHITE;
		const a = (opts?.alpha ?? 1) * c[3];
		let w = opts?.w ?? f.w;
		let h = opts?.h ?? f.h;
		if (opts?.deform && this.grid) {
			this.grid.push(x, y, w, h, f, opts.rot ?? 0, opts.flipX ?? false, opts.z ?? this.nextZ(), opts.deform, c[0], c[1], c[2], a);
			return;
		}
		const fx = opts?.fx;
		if (fx) {
			if (fx.shake) {
				const k = fx.shake.duration && fx.shake._left !== void 0 ? Math.max(0, fx.shake._left / fx.shake.duration) : 1;
				x += (Math.random() * 2 - 1) * fx.shake.amount * k;
				y += (Math.random() * 2 - 1) * fx.shake.amount * k;
			}
			if (fx.squash) {
				const ph = Math.sin((fx.squash._t ?? this.time) * (fx.squash.speed ?? 2) * Math.PI * 2);
				const am = fx.squash.amount ?? .15;
				const cx = x + w / 2, bottom = y + h;
				w *= 1 + ph * am;
				h *= 1 - ph * am;
				x = cx - w / 2;
				y = bottom - h;
			}
			if (fx.glow && this.glow) {
				const gc = rgba(fx.glow.color ?? "#ffe08a");
				this.glow.stamp(x, y, w, h, f, opts?.rot ?? 0, opts?.flipX ?? false, gc[0], gc[1], gc[2], gc[3], fx.glow.size ?? 16);
			}
			if (fxNeedsShader(fx) && this.fxb) {
				this.fxb.push(x, y, w, h, f, opts?.rot ?? 0, opts?.flipX ?? false, opts?.z ?? this.nextZ(), fx, this.time, c[0], c[1], c[2], a);
				return;
			}
		}
		(opts?.blend || a < 1 ? this.blend : this.cutout).push(x, y, w, h, f, 0, opts?.rot ?? 0, opts?.flipX ? 1 : 0, opts?.z ?? this.nextZ(), c[0], c[1], c[2], a, opts?.uvScroll?.x ?? 0, opts?.uvScroll?.y ?? 0, opts?.uvRepeat?.x ?? 1, opts?.uvRepeat?.y ?? 1);
	}
	/** A solid rectangle (optionally rotated about its centre). */
	rect(x, y, w, h, color = "#ffffff", alpha = 1, rot = 0) {
		const c = rgba(color);
		this.blend.push(x, y, w, h, this.atlas.frames[0], 3, rot, 0, this.nextZ(), c[0], c[1], c[2], alpha * c[3]);
	}
	/** A line segment with width — a rotated solid quad centred on the segment. */
	line(x0, y0, x1, y1, width, color = "#ffffff", alpha = 1) {
		const dx = x1 - x0, dy = y1 - y0;
		const len = Math.hypot(dx, dy);
		if (len < 1e-4) return;
		const c = rgba(color);
		this.blend.push((x0 + x1 - len) / 2, (y0 + y1 - width) / 2, len, width, this.atlas.frames[0], 3, Math.atan2(dy, dx), 0, this.nextZ(), c[0], c[1], c[2], alpha * c[3]);
	}
	/** @internal VFX ribbon segment — a width'd line routed to blend or ADDITIVE. */
	trailSegment(x0, y0, x1, y1, width, color, alpha, add) {
		const dx = x1 - x0, dy = y1 - y0;
		const len = Math.hypot(dx, dy);
		if (len < 1e-4) return;
		const c = rgba(color);
		(add ? this.add : this.blend).push((x0 + x1 - len) / 2, (y0 + y1 - width) / 2, len, width, this.atlas.frames[0], 3, Math.atan2(dy, dx), 0, this.nextZ(), c[0], c[1], c[2], alpha * c[3]);
	}
	/** A polyline: segments + round joints — smooth corners without miter maths. */
	poly(points, width, color = "#ffffff", alpha = 1) {
		for (let i = 1; i < points.length; i++) this.line(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, width, color, alpha);
		if (width > 2.5) for (let i = 1; i < points.length - 1; i++) this.circle(points[i].x, points[i].y, width / 2, color, alpha);
	}
	/**
	* The stroked VECTOR FACE as ordinary polylines — the same glyphs
	* `game.vector.text()` draws, but through the draw verbs, so it works on the
	* **HUD surface** where the vector layer cannot reach.
	*
	* ```ts
	* override drawHud(d: Draw): void {
	*   d.vectorText('SCORE 004200', 22, 18, { size: 22, color: '#cdd8ff' });
	* }
	* ```
	*
	* Why this exists: the vector layer is one world-space pass drawn BEFORE the
	* HUD, so a scrolling game's readouts would slide away with the camera. This
	* puts the letterforms on the HUD in screen space, correctly ordered with
	* every other HUD element.
	*
	* The trade is the BEAM: these are plain quads, so there is no phosphor halo
	* and no `dwell`. For glowing text inside the world, use `game.vector.text()`.
	*/
	vectorText(str, x, y, opts = {}) {
		const w = opts.width ?? 2;
		const color = opts.color ?? "#ffffff";
		const alpha = opts.alpha ?? 1;
		for (const pts of textOutline(str, x, y, opts)) this.poly(pts, w, color, alpha);
	}
	/**
	* A FILLED polygon of arbitrary shape (ear-clipped into triangles). Points in
	* world units, any simple polygon (convex or concave). Flat colour, alpha
	* blended — the fill counterpart to `poly()`'s stroke.
	*/
	fill(points, color = "#ffffff", alpha = 1) {
		if (!this.tri || points.length < 3) return;
		const c = rgba(color);
		const a = alpha * c[3];
		const idx = triangulate(points);
		for (let i = 0; i < idx.length; i += 3) {
			const p0 = points[idx[i]], p1 = points[idx[i + 1]], p2 = points[idx[i + 2]];
			this.tri.push(p0.x, p0.y, p1.x, p1.y, p2.x, p2.y, c[0], c[1], c[2], a);
		}
	}
	/** An anti-aliased filled circle (analytic SDF — crisp at any radius). */
	circle(cx, cy, radius, color = "#ffffff", alpha = 1) {
		const c = rgba(color);
		this.blend.push(cx - radius, cy - radius, radius * 2, radius * 2, this.atlas.frames[0], 1, 0, 0, this.nextZ(), c[0], c[1], c[2], alpha * c[3]);
	}
	/** An anti-aliased ring / circle outline with a stroke thickness in world units. */
	ring(cx, cy, radius, thickness, color = "#ffffff", alpha = 1) {
		const frac = Math.min(1, Math.max(.02, thickness / Math.max(1, radius)));
		const c = rgba(color);
		this.blend.push(cx - radius, cy - radius, radius * 2, radius * 2, this.atlas.frames[0], 2, 0, frac, this.nextZ(), c[0], c[1], c[2], alpha * c[3]);
	}
	/**
	* A UI PANEL — the procedural interface primitive: a rounded box whose rim,
	* bevel, gloss, inner shadow and drop shadow are all computed from the shape
	* itself (see ui.md). Buttons, frames, slots, bars, tooltips, dialogs.
	*
	* There is NO source art and nothing stretches: the same call gives a 40-unit
	* chip and a 900-unit dialog the same crisp 5-unit rim, at any zoom.
	*
	* ```ts
	* d.panel(x, y, 200, 64, 'glossy');                        // a named style
	* d.panel(x, y, 200, 64, { base: 'glossy', fill: '#e6408f', fillTo: '#a01f5e' });
	* ```
	*
	* Panels paint over the 2D scene and UNDER this surface's text, so a label
	* drawn after the panel lands on top of it whatever the call order.
	*/
	panel(x, y, w, h, style, opts) {
		if (!this.uiPass) return INERT;
		const base = resolveUiStyle(style);
		if (!base.interactive) {
			this.uiPass.push(x + base.offsetX, y + base.offsetY, w, h, base, opts?.rot ?? 0, this.clip, this.uiLayer);
			this.panelLabel(opts, x + base.offsetX, y + base.offsetY, w, h);
			this.mark(y + base.offsetY + h);
			return INERT;
		}
		const pointer = this.visible(x, y, w, h) ? this.pointerIn?.() ?? null : null;
		const key = opts?.id ?? this.panelSeq++;
		let mem = this.panelMemory.get(key);
		if (!mem) this.panelMemory.set(key, mem = {
			armed: false,
			lastPress: 0,
			seen: this.frameNo
		});
		mem.seen = this.frameNo;
		let hovered = false, held = false, clicked = false, active = false;
		if (!pointer) mem.armed = false;
		else {
			const px = x + base.offsetX, py = y + base.offsetY;
			const inside = (hx, hy) => hx >= px && hx <= px + w && hy >= py && hy <= py + h;
			hovered = inside(pointer.x, pointer.y);
			const pressedAt = pointer.pressedAt ?? 0;
			if (pressedAt !== mem.lastPress) {
				mem.lastPress = pressedAt;
				mem.armed = inside(pointer.pressX ?? pointer.x, pointer.pressY ?? pointer.y);
			}
			if (!pointer.down && mem.armed) {
				if (hovered) clicked = true;
				mem.armed = false;
			}
			active = mem.armed && pointer.down;
			held = hovered && active;
			if (hovered && base.cursor) pointer.wantCursor?.();
		}
		const state = held && base.hasPressed ? "pressed" : hovered && base.hasHover ? "hover" : "base";
		const look = state === "base" ? base : resolveUiStyle(style, state);
		this.uiPass.push(x + look.offsetX, y + look.offsetY, w, h, look, opts?.rot ?? 0, this.clip, this.uiLayer);
		this.panelLabel(opts, x + look.offsetX, y + look.offsetY, w, h);
		this.mark(y + look.offsetY + h);
		return {
			hovered,
			pressed: held,
			active,
			clicked,
			offsetX: look.offsetX,
			offsetY: look.offsetY
		};
	}
	/**
	* A single line of bitmap-font text. Glyphs are pre-baked white quads —
	* per-frame changing strings cost nothing but pushes, and `color` tints
	* them per instance. x is the anchor per `align` (left edge by default).
	*/
	text(font, str, x, y, opts) {
		const scale = opts?.scale ?? 1;
		const c = opts?.color ? rgba(opts.color) : WHITE;
		const a = (opts?.alpha ?? 1) * c[3];
		const align = opts?.align ?? "left";
		let pen = x;
		if (align !== "left") {
			const w = font.measure(str, scale);
			pen = align === "center" ? x - w / 2 : x - w;
		}
		this.glyphs(this.blend, font, str, pen, y, scale, c, a, opts?.z ?? this.nextZ());
	}
	/**
	* @internal The label path for UI FURNITURE — the widget layer and `panel`'s
	* own `label`. Identical glyph work to `text()`, but into the UI-label batch
	* at the current UI layer, so the label belongs to the panel it names: drawn
	* with it, above it, and carried with it when a window claims a layer.
	*
	* Game code never needs this. A label on a control comes from the control.
	*/
	uiLabel(font, str, x, y, opts) {
		if (!this.textq) {
			this.text(font, str, x, y, opts);
			return;
		}
		const scale = opts?.scale ?? 1;
		const c = opts?.color ? rgba(opts.color) : WHITE;
		const a = (opts?.alpha ?? 1) * c[3];
		const align = opts?.align ?? "left";
		let pen = x;
		if (align !== "left") {
			const w = font.measure(str, scale);
			pen = align === "center" ? x - w / 2 : x - w;
		}
		this.glyphs(this.textq, font, str, pen, y, scale, c, a, this.nextZ());
	}
	/** Lay a string out as quads into `batch`, pen already positioned for align. */
	glyphs(batch, font, str, startPen, y, scale, c, a, z) {
		let pen = startPen;
		for (const ch of str) {
			const g = font.glyphs.get(ch);
			if (!g) {
				pen += font.spaceAdvance * scale;
				continue;
			}
			const f = this.atlas.frames[g.frame];
			if (f) batch.push(pen, y, g.w * scale, g.h * scale, f, 0, 0, 0, z, c[0], c[1], c[2], a);
			pen += g.advance * scale;
		}
	}
	/**
	* Submit a retained MSDF text block (from `game.assets.msdfText(...)`) at (x, y) —
	* crisp at any scale, with per-object/run weight, outline, shadow, gradients
	* and decorations. Lay it out once (set text/style on the object), then draw
	* it each frame here; changing strings only re-lays-out that object.
	*/
	msdfText(text, x, y, opts) {
		if (!this.textPass) return;
		text.submit(this.textPass, x, y, opts);
		if (this.measuring > 0) this.mark(y + text.height * (1 - (opts?.origin?.y ?? 0)));
		if (this.traceText) this.textBoxes.push(text.bounds(x, y, opts));
	}
	/**
	* Draw a retained UNICODE text block (from `game.assets.unicodeText(...)`) at
	* (x, y) — **the path for Chinese, Japanese, Korean, Arabic, Hebrew, Thai,
	* Devanagari, Cyrillic and emoji**, with correct shaping, right-to-left bidi
	* and system font fallback. Styles (gradient / stroke / shadow / glow /
	* background plate) are baked into the block, so a frame is one quad.
	*
	* Works on BOTH surfaces: `game.draw` (world space, scrolls with the camera)
	* and `game.hud` (screen space, CSS pixels). See unicode-text.md.
	*
	* Drawing is also what drives INTERACTION: a block with a `hover`/`pressed`
	* style (or `interactive: true`) hit-tests this surface's pointer here, so
	* `text.hovered` / `text.clicked` are current straight after this call.
	*/
	unicodeText(text, x, y, opts) {
		if (!this.textPass) return;
		text.submit(this.textPass, x, y, opts, this.pointerIn);
		if (this.measuring > 0) this.mark(y + text.height * (1 - (opts?.origin?.y ?? 0)));
		if (this.traceText) this.textBoxes.push(text.bounds(x, y, opts));
	}
};
//#endregion
//#region src/lib/clock.ts
var FixedClock = class {
	step;
	maxSteps;
	/** Fraction [0..1) of a step elapsed since the last consumed step — lerp render poses with this. */
	alpha = 0;
	acc = 0;
	constructor(step = 1 / 60, maxSteps = 5) {
		this.step = step;
		this.maxSteps = maxSteps;
	}
	/** Feed a frame's dt; returns how many fixed steps to run right now. */
	advance(dt) {
		this.acc += Math.max(0, dt);
		let steps = Math.floor(this.acc / this.step);
		if (steps > this.maxSteps) {
			this.acc -= (steps - this.maxSteps) * this.step;
			steps = this.maxSteps;
		}
		this.acc -= steps * this.step;
		this.alpha = this.acc / this.step;
		return steps;
	}
};
//#endregion
//#region src/lib/sprite.ts
var Sprite = class {
	frames;
	frame;
	x;
	y;
	w;
	h;
	body;
	vel;
	/** Per-frame velocity delta in world units per second squared. Physics adds this to `vel` every update. Useful for thrust, wind, or homing. */
	acceleration;
	/** Deceleration in world units/s² that drags `vel` toward 0 on each axis (ground drag / air resistance). Applied only when that axis has no `acceleration`. */
	friction;
	/** Speed cap in world units per second per axis. Physics clamps `vel` to this after integration. */
	maxVelocity;
	gravity;
	bounce;
	/** Minimum impact speed (world units per second) required for a bounce to occur. Prevents endless micro-bouncing at rest. */
	minBounceVelocity;
	/** Keep this body inside the physics world bounds (hard clamp — no tunnelling at any speed). */
	collideWorldBounds;
	/** Per-edge world-bounds bounce. Set the edges that should reflect velocity; leave others unset to let the sprite pass through. */
	bounceEdges;
	/** Position at the start of this frame's physics step — set by `Physics.updateBody`, read by the swept (CCD) checks and platform carry. */
	last;
	/** @internal Per-frame reflect() guard — set/cleared by Physics (updateBody + reflect). */
	_reflected = false;
	tint;
	alpha;
	rot;
	flipX;
	blend;
	uvRepeat;
	uvScroll;
	z;
	/** Set/clear at any time: sprite.fx = { glow: { color: '#ffd147' } } — effects stack. */
	fx;
	/** Set/clear at any time — mutate .phase for manual control (card flips). */
	deform;
	/** Set/clear at any time: 'flameTrail' streams a ribbon from the centre; clearing fades it out. */
	vfx;
	anims;
	/** Solid contacts this frame (set by the scene's solid() solver). */
	touching = {
		up: false,
		down: false,
		left: false,
		right: false
	};
	/** Set by kill(); the scene sweeps dead sprites at the end of the update. */
	dead = false;
	/** @internal View-percentage placements, resolved once by scene.add(). */
	pct;
	animName = null;
	animT = 0;
	constructor(config = {}) {
		const dim = (v, key) => {
			if (typeof v !== "string") return v ?? 0;
			(this.pct ??= {})[key] = parseFloat(v) / 100;
			return 0;
		};
		this.frames = config.frames ?? 0;
		this.frame = config.frame ?? 0;
		this.x = dim(config.x, "x");
		this.y = dim(config.y, "y");
		this.w = dim(config.w, "w");
		this.h = dim(config.h, "h");
		this.body = config.body ?? "dynamic";
		this.vel = {
			x: config.vx ?? 0,
			y: config.vy ?? 0
		};
		this.acceleration = {
			x: config.acceleration?.x ?? 0,
			y: config.acceleration?.y ?? 0
		};
		this.friction = {
			x: config.friction?.x ?? 0,
			y: config.friction?.y ?? 0
		};
		this.maxVelocity = {
			x: config.maxVelocity?.x ?? 2e3,
			y: config.maxVelocity?.y ?? 2e3
		};
		this.gravity = config.gravity ?? 1;
		this.bounce = config.bounce ?? 0;
		this.minBounceVelocity = config.minBounceVelocity ?? 40;
		this.collideWorldBounds = config.collideWorldBounds ?? false;
		this.bounceEdges = config.bounceEdges ? { ...config.bounceEdges } : null;
		this.last = {
			x: this.x,
			y: this.y
		};
		this.tint = config.tint;
		this.alpha = config.alpha ?? 1;
		this.rot = config.rot ?? 0;
		this.flipX = config.flipX ?? false;
		this.blend = config.blend ?? false;
		this.uvRepeat = config.uvRepeat;
		this.uvScroll = config.uvScroll;
		this.z = config.z;
		this.fx = config.fx;
		this.deform = config.deform;
		this.vfx = config.vfx;
		this.anims = config.anims ?? {};
		const start = config.play ?? (this.anims["idle"] ? "idle" : null);
		if (start) this.play(start);
	}
	/** Per-frame behaviour — override in subclasses. dt is display-frame seconds. */
	update(dt) {}
	/** Switch to a named animation (no-op if already playing it; `restart` to force). */
	play(name, restart = false) {
		if (this.animName === name && !restart) return;
		this.animName = name;
		this.animT = 0;
	}
	/** The animation currently playing (null = static `frame`). */
	get playing() {
		return this.animName;
	}
	/** True once a `once` animation has held its final frame. */
	get animDone() {
		const a = this.animName ? this.anims[this.animName] : void 0;
		if (!a || !a.once) return false;
		return this.animT / a.time >= a.seq.length;
	}
	/** Advance animation time (the scene calls this). */
	stepAnim(dt) {
		this.animT += dt;
	}
	/** The atlas frame to draw right now. */
	get drawFrame() {
		const a = this.animName ? this.anims[this.animName] : void 0;
		if (!a || a.seq.length === 0) return this.frames + this.frame;
		const idx = Math.floor(this.animT / a.time);
		const off = a.once ? a.seq[Math.min(idx, a.seq.length - 1)] : a.seq[idx % a.seq.length];
		return this.frames + off;
	}
	get centerX() {
		return this.x + this.w / 2;
	}
	get centerY() {
		return this.y + this.h / 2;
	}
	/** Remove this sprite at the end of the scene update. */
	kill() {
		this.dead = true;
	}
};
/** AABB overlap test (exported for game logic + tests). */
function overlaps(a, b) {
	return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}
//#endregion
//#region src/lib/camera.ts
var Camera = class {
	/** Top-left of the visible world rect, world units. */
	x = 0;
	y = 0;
	/** Clamp the view inside this world rect (null = unclamped). */
	bounds = null;
	/**
	* @internal EXPERIMENTAL — not a public feature yet, deliberately absent from
	* the docs and the shipped `.d.ts`. Magnifies the 2D world around the camera
	* centre (`view = worldHeight/zoom`); the HUD stays at the unzoomed reference.
	* Kept in the engine for later; do not surface it to the game-building agent.
	*/
	zoom = 1;
	target = null;
	lerp = 8;
	snapPending = false;
	shakeT = 0;
	shakeDur = 0;
	shakePower = 0;
	/** This frame's shake jitter (Game adds it to the view origin; x/y stay clean). */
	shakeX = 0;
	shakeY = 0;
	flashColor = null;
	flashT = 0;
	flashDur = 0;
	/** Kick a decaying screen shake (impacts, explosions). */
	shake(power = 6, duration = .3) {
		this.shakePower = power;
		this.shakeDur = this.shakeT = Math.max(.01, duration);
	}
	/**
	* A full-screen colour flash fading out over `duration` seconds — hits,
	* pickups, lightning. The view's other impact verb, alongside `shake()`;
	* both live on the camera, so a scene transition starts clean.
	*/
	flash(color = "#ffffff", duration = .25) {
		this.flashColor = rgba(color);
		this.flashDur = this.flashT = Math.max(.01, duration);
	}
	/**
	* @internal This frame's flash overlay — rgb plus the faded alpha — or null
	* when nothing is flashing. Game draws it over the HUD.
	*/
	get flashRGBA() {
		if (this.flashT <= 0 || !this.flashColor) return null;
		const [r, g, b, a] = this.flashColor;
		return [
			r,
			g,
			b,
			a * (this.flashT / this.flashDur)
		];
	}
	/** Keep a sprite centred (exponential smoothing; higher lerp = snappier, 0 = locked-on). */
	follow(sprite, opts) {
		this.target = sprite;
		this.lerp = opts?.lerp ?? 8;
		this.snapPending = !!sprite && (opts?.snap ?? true);
	}
	/** Advance smoothing + clamping. Called by Game each frame with the view size. */
	update(dt, viewW, viewH) {
		if (this.target) {
			const dx = this.target.centerX - viewW / 2;
			const dy = this.target.centerY - viewH / 2;
			if (this.snapPending) {
				this.x = dx;
				this.y = dy;
				this.snapPending = false;
			} else {
				const k = this.lerp <= 0 ? 1 : Math.min(1, this.lerp * dt);
				this.x += (dx - this.x) * k;
				this.y += (dy - this.y) * k;
			}
		}
		if (this.bounds) {
			this.x = clampAxis(this.x, this.bounds.x, this.bounds.w, viewW);
			this.y = clampAxis(this.y, this.bounds.y, this.bounds.h, viewH);
		}
		if (this.shakeT > 0) {
			this.shakeT = Math.max(0, this.shakeT - dt);
			const k = this.shakePower * (this.shakeT / this.shakeDur);
			this.shakeX = (Math.random() * 2 - 1) * k || 0;
			this.shakeY = (Math.random() * 2 - 1) * k || 0;
		} else this.shakeX = this.shakeY = 0;
		if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
	}
};
function clampAxis(v, lo, worldSize, viewSize) {
	const hi = lo + worldSize - viewSize;
	if (hi < lo) return lo + (worldSize - viewSize) / 2;
	return Math.min(hi, Math.max(lo, v));
}
//#endregion
//#region src/lib/tile-grid.ts
/** Base 2-D grid of tile indices shared by CollisionGrid and Tilemap. */
var TileGrid = class {
	/** Width of each tile in pixels. */
	tilesize;
	/** Grid width in tiles. */
	width;
	/** Grid height in tiles. */
	height;
	/** Grid width in pixels (`width * tilesize`). */
	pxWidth;
	/** Grid height in pixels (`height * tilesize`). */
	pxHeight;
	/** Raw tile index data — `data[row][col]`, 0 = empty. */
	data;
	/** Optional identifier for this grid, set by the level loader. */
	name = null;
	constructor(tilesize, data) {
		this.tilesize = tilesize;
		this.data = data;
		this.height = data.length;
		this.width = data[0].length;
		this.pxWidth = this.width * this.tilesize;
		this.pxHeight = this.height * this.tilesize;
	}
	/**
	* Returns the tile index at world pixel position `(x, y)`, or `0` when the position is outside the grid.
	* Use to query what tile a sprite is standing on or overlapping.
	*/
	getTile(x, y) {
		const tx = Math.floor(x / this.tilesize);
		const ty = Math.floor(y / this.tilesize);
		if (tx >= 0 && tx < this.width && ty >= 0 && ty < this.height) return this.data[ty][tx];
		return 0;
	}
	/**
	* Writes a tile index at world pixel position `(x, y)`. Silently ignores positions outside the grid.
	* Use to break or place tiles at runtime (destructible terrain, pickups).
	*/
	setTile(x, y, tile) {
		const tx = Math.floor(x / this.tilesize);
		const ty = Math.floor(y / this.tilesize);
		if (tx >= 0 && tx < this.width && ty >= 0 && ty < this.height) this.data[ty][tx] = tile;
	}
};
//#endregion
//#region src/lib/collision-grid.ts
/** Static sprite-vs-world tile collision: swept AABB + slope trace used by Physics each frame. */
/**
* Tile-based static collision map used as a scene's `collisionMap`.
* Tile index `1` = fully solid; indices `2..lastSlope` = slope tiles defined in `tiledef`; indices above `lastSlope` = fully solid.
* The swept trace is sub-stepped so fast-moving sprites never tunnel through walls.
* Synonym: world collision, tile collision, static geometry, tilemap collision.
*/
var CollisionGrid = class CollisionGrid extends TileGrid {
	/** Highest tile index that maps to a slope definition; tiles above this value are treated as fully solid. @internal */
	lastSlope = 1;
	/** Slope line definitions keyed by tile index. Defaults to `CollisionGrid.defaultTileDef`. */
	tiledef;
	constructor(tilesize, data, tiledef) {
		super(tilesize, data);
		this.tiledef = tiledef || CollisionGrid.defaultTileDef;
		for (const t in this.tiledef) {
			const key = parseInt(t, 10);
			if (key > this.lastSlope) this.lastSlope = key;
		}
	}
	/**
	* Swept AABB trace from world position `(x, y)` by velocity `(vx, vy)` for a box of `objectWidth × objectHeight` pixels.
	* Sub-steps the movement so no tile is ever skipped at high speed. Returns a `TraceResult` with the resolved position and collision flags.
	* Called automatically by `Physics.updateBody`; call manually only for custom movement.
	*/
	trace(x, y, vx, vy, objectWidth, objectHeight) {
		const res = {
			collision: {
				x: false,
				y: false,
				slope: false
			},
			position: {
				x,
				y
			},
			tile: {
				x: 0,
				y: 0
			}
		};
		const steps = Math.ceil((Math.max(Math.abs(vx), Math.abs(vy)) + .1) / this.tilesize);
		if (steps > 1) {
			let sx = vx / steps;
			let sy = vy / steps;
			for (let i = 0; i < steps && (sx || sy); i++) {
				this._traceStep(res, x, y, sx, sy, objectWidth, objectHeight, vx, vy, i);
				x = res.position.x;
				y = res.position.y;
				if (res.collision.x) {
					sx = 0;
					vx = 0;
				}
				if (res.collision.y) {
					sy = 0;
					vy = 0;
				}
				if (res.collision.slope) break;
			}
		} else this._traceStep(res, x, y, vx, vy, objectWidth, objectHeight, vx, vy, 0);
		return res;
	}
	/** @internal Performs one sub-step of the swept trace, testing horizontal then vertical tile collisions. */
	_traceStep(res, x, y, vx, vy, width, height, rvx, rvy, step) {
		res.position.x += vx;
		res.position.y += vy;
		let t = 0;
		if (vx) {
			const pxOffsetX = vx > 0 ? width : 0;
			const tileOffsetX = vx < 0 ? this.tilesize : 0;
			const firstTileY = Math.max(Math.floor(y / this.tilesize), 0);
			const lastTileY = Math.min(Math.ceil((y + height) / this.tilesize), this.height);
			const tileX = Math.floor((res.position.x + pxOffsetX) / this.tilesize);
			let prevTileX = Math.floor((x + pxOffsetX) / this.tilesize);
			if (step > 0 || tileX === prevTileX || prevTileX < 0 || prevTileX >= this.width) prevTileX = -1;
			if (tileX >= 0 && tileX < this.width) for (let tileY = firstTileY; tileY < lastTileY; tileY++) {
				if (prevTileX !== -1) {
					t = this.data[tileY][prevTileX];
					if (t > 1 && t <= this.lastSlope && this._checkTileDef(res, t, x, y, rvx, rvy, width, height, prevTileX, tileY)) break;
				}
				t = this.data[tileY][tileX];
				if (t === 1 || t > this.lastSlope || t > 1 && this._checkTileDef(res, t, x, y, rvx, rvy, width, height, tileX, tileY)) {
					if (t > 1 && t <= this.lastSlope && res.collision.slope) break;
					res.collision.x = true;
					res.tile.x = t;
					x = res.position.x = tileX * this.tilesize - pxOffsetX + tileOffsetX;
					rvx = 0;
					break;
				}
			}
		}
		if (vy) {
			const pxOffsetY = vy > 0 ? height : 0;
			const tileOffsetY = vy < 0 ? this.tilesize : 0;
			const firstTileX = Math.max(Math.floor(res.position.x / this.tilesize), 0);
			const lastTileX = Math.min(Math.ceil((res.position.x + width) / this.tilesize), this.width);
			const tileY = Math.floor((res.position.y + pxOffsetY) / this.tilesize);
			let prevTileY = Math.floor((y + pxOffsetY) / this.tilesize);
			if (step > 0 || tileY === prevTileY || prevTileY < 0 || prevTileY >= this.height) prevTileY = -1;
			if (tileY >= 0 && tileY < this.height) for (let tileX = firstTileX; tileX < lastTileX; tileX++) {
				if (prevTileY !== -1) {
					t = this.data[prevTileY][tileX];
					if (t > 1 && t <= this.lastSlope && this._checkTileDef(res, t, x, y, rvx, rvy, width, height, tileX, prevTileY)) break;
				}
				t = this.data[tileY][tileX];
				if (t === 1 || t > this.lastSlope || t > 1 && this._checkTileDef(res, t, x, y, rvx, rvy, width, height, tileX, tileY)) {
					if (t > 1 && t <= this.lastSlope && res.collision.slope) break;
					res.collision.y = true;
					res.tile.y = t;
					res.position.y = tileY * this.tilesize - pxOffsetY + tileOffsetY;
					break;
				}
			}
		}
	}
	/** @internal Tests one slope tile definition against the moving box; writes `res.collision.slope` and snaps `res.position` on a hit. */
	_checkTileDef(res, t, x, y, vx, vy, width, height, tileX, tileY) {
		const def = this.tiledef[t];
		if (!def) return false;
		const lx = (tileX + def[0]) * this.tilesize;
		const ly = (tileY + def[1]) * this.tilesize;
		const lvx = (def[2] - def[0]) * this.tilesize;
		const lvy = (def[3] - def[1]) * this.tilesize;
		const solid = def[4];
		const tx = x + vx + (lvy < 0 ? width : 0) - lx;
		const ty = y + vy + (lvx > 0 ? height : 0) - ly;
		if (lvx * ty - lvy * tx > 0) {
			if (vx * -lvy + vy * lvx < 0) return solid;
			const length = Math.sqrt(lvx * lvx + lvy * lvy);
			const nx = lvy / length;
			const ny = -lvx / length;
			const proj = tx * nx + ty * ny;
			const px = nx * proj;
			const py = ny * proj;
			if (px * px + py * py >= vx * vx + vy * vy) return solid || lvx * (ty - vy) - lvy * (tx - vx) < .5;
			res.position.x = x + vx - px;
			res.position.y = y + vy - py;
			res.collision.slope = {
				x: lvx,
				y: lvy,
				nx,
				ny
			};
			return true;
		}
		return false;
	}
	/**
	* Built-in slope tile definitions covering 15°, 22°, 45°, 67°, and 75° ramps in all four diagonal directions, plus cardinal one-way edges.
	* Assigned automatically when no `tiledef` is passed to the constructor.
	* Synonym: default slopes, ramp tiles, angled tiles.
	*/
	static defaultTileDef = (() => {
		const H = 1 / 2;
		const N = 1 / 3;
		const M = 2 / 3;
		const S = true;
		const X = false;
		return {
			5: [
				0,
				1,
				1,
				M,
				S
			],
			6: [
				0,
				M,
				1,
				N,
				S
			],
			7: [
				0,
				N,
				1,
				0,
				S
			],
			3: [
				0,
				1,
				1,
				H,
				S
			],
			4: [
				0,
				H,
				1,
				0,
				S
			],
			2: [
				0,
				1,
				1,
				0,
				S
			],
			10: [
				H,
				1,
				1,
				0,
				S
			],
			21: [
				0,
				1,
				H,
				0,
				S
			],
			32: [
				M,
				1,
				1,
				0,
				S
			],
			43: [
				N,
				1,
				M,
				0,
				S
			],
			54: [
				0,
				1,
				N,
				0,
				S
			],
			27: [
				0,
				0,
				1,
				N,
				S
			],
			28: [
				0,
				N,
				1,
				M,
				S
			],
			29: [
				0,
				M,
				1,
				1,
				S
			],
			25: [
				0,
				0,
				1,
				H,
				S
			],
			26: [
				0,
				H,
				1,
				1,
				S
			],
			24: [
				0,
				0,
				1,
				1,
				S
			],
			11: [
				0,
				0,
				H,
				1,
				S
			],
			22: [
				H,
				0,
				1,
				1,
				S
			],
			33: [
				0,
				0,
				N,
				1,
				S
			],
			44: [
				N,
				0,
				M,
				1,
				S
			],
			55: [
				M,
				0,
				1,
				1,
				S
			],
			16: [
				1,
				N,
				0,
				0,
				S
			],
			17: [
				1,
				M,
				0,
				N,
				S
			],
			18: [
				1,
				1,
				0,
				M,
				S
			],
			14: [
				1,
				H,
				0,
				0,
				S
			],
			15: [
				1,
				1,
				0,
				H,
				S
			],
			13: [
				1,
				1,
				0,
				0,
				S
			],
			8: [
				H,
				1,
				0,
				0,
				S
			],
			19: [
				1,
				1,
				H,
				0,
				S
			],
			30: [
				N,
				1,
				0,
				0,
				S
			],
			41: [
				M,
				1,
				N,
				0,
				S
			],
			52: [
				1,
				1,
				M,
				0,
				S
			],
			38: [
				1,
				M,
				0,
				1,
				S
			],
			39: [
				1,
				N,
				0,
				M,
				S
			],
			40: [
				1,
				0,
				0,
				N,
				S
			],
			36: [
				1,
				H,
				0,
				1,
				S
			],
			37: [
				1,
				0,
				0,
				H,
				S
			],
			35: [
				1,
				0,
				0,
				1,
				S
			],
			9: [
				1,
				0,
				H,
				1,
				S
			],
			20: [
				H,
				0,
				0,
				1,
				S
			],
			31: [
				1,
				0,
				M,
				1,
				S
			],
			42: [
				M,
				0,
				N,
				1,
				S
			],
			53: [
				N,
				0,
				0,
				1,
				S
			],
			12: [
				0,
				0,
				1,
				0,
				X
			],
			23: [
				1,
				1,
				0,
				1,
				X
			],
			34: [
				1,
				0,
				1,
				1,
				X
			],
			45: [
				0,
				1,
				0,
				0,
				X
			]
		};
	})();
	/**
	* A no-op `CollisionGridLike` that never blocks movement — use as a scene's `collisionMap` when you have no tile collision.
	* Synonym: passthrough collision, no collision map, open world.
	*/
	static staticNoCollision = { trace(x, y, vx, vy) {
		return {
			collision: {
				x: false,
				y: false,
				slope: false
			},
			position: {
				x: x + vx,
				y: y + vy
			},
			tile: {
				x: 0,
				y: 0
			}
		};
	} };
};
//#endregion
//#region src/lib/pointer.ts
var DEFAULT_OPTIONS = {
	tapMaxDuration: 250,
	tapTolerance: 8,
	doubleTapDelay: 300,
	doubleTapDistance: 16,
	longPressDelay: 600,
	longPressTolerance: 8,
	swipeMinDistance: 20,
	swipeMinVelocity: 300,
	panThreshold: 4
};
/**
* Tracks mouse and multi-touch pointers and runs gesture recognition on top.
* Attached lazily to the canvas by `Input.initMouse()`; accessed via `game.input.pointerTracker`
* or the convenience shims on `Input` / `SceneInput`.
*/
var PointerTracker = class {
	/** The canvas that gesture listeners are attached to. */
	canvas;
	/**
	* Maps client (CSS-pixel) coordinates to world coordinates. Injected by the Game
	* (Game injects the one screen→world mapping; `input.toWorld()` reads the same one).
	* Defaults to a rect-relative fallback so the tracker still works standalone.
	*/
	mapToWorld;
	constructor(canvas = null, mapToWorld) {
		this.canvas = canvas;
		this.mapToWorld = mapToWorld ?? ((clientX, clientY) => {
			const rect = this.canvas?.getBoundingClientRect();
			return {
				x: clientX - (rect?.left ?? 0),
				y: clientY - (rect?.top ?? 0)
			};
		});
	}
	/** Gesture recognition thresholds. Mutate at runtime to change sensitivity. */
	options = { ...DEFAULT_OPTIONS };
	/** @internal All active pointers keyed by id. */
	byId = /* @__PURE__ */ new Map();
	/** The primary pointer — mouse if tracked, else the first active touch. `null` when nothing is active. */
	primary = null;
	/**
	* Forget every in-flight pointer (scene transitions): cancels pending
	* long-press timers and drops tracked pointers, so a press that started in
	* the OLD scene can't complete a tap/swipe in the new one. The next real
	* pointer event starts fresh.
	*/
	reset() {
		for (const p of this.byId.values()) if (p.longPressTimer !== null && typeof window !== "undefined") window.clearTimeout(p.longPressTimer);
		this.byId.clear();
		this.primary = null;
	}
	/** @internal Previous tap record for double-tap detection. */
	_lastTap = null;
	tapHandlers = [];
	doubleTapHandlers = [];
	longPressHandlers = [];
	panHandlers = [];
	swipeHandlers = [];
	downHandlers = [];
	upHandlers = [];
	moveHandlers = [];
	/** @internal `true` once DOM listeners have been attached via `attach()`. */
	attached = false;
	/** @internal `true` once `touch-action: none` has been set on the canvas. */
	touchActionSet = false;
	/**
	* Subscribe to tap events (quick down+up, no drag). Works for mouse clicks and touch taps.
	* @returns An unsubscribe function.
	*/
	onTap(handler) {
		this.tapHandlers.push(handler);
		return () => removeFrom(this.tapHandlers, handler);
	}
	/**
	* Subscribe to double-tap events (two taps within `doubleTapDelay` in the same area).
	* @returns An unsubscribe function.
	*/
	onDoubleTap(handler) {
		this.doubleTapHandlers.push(handler);
		return () => removeFrom(this.doubleTapHandlers, handler);
	}
	/**
	* Subscribe to long-press events (pointer held stationary for `longPressDelay` ms without moving).
	* @returns An unsubscribe function.
	*/
	onLongPress(handler) {
		this.longPressHandlers.push(handler);
		return () => removeFrom(this.longPressHandlers, handler);
	}
	/**
	* Subscribe to pan events — fired continuously while a pressed pointer moves beyond `panThreshold`. Use for drag/scroll interactions.
	* @returns An unsubscribe function.
	*/
	onPan(handler) {
		this.panHandlers.push(handler);
		return () => removeFrom(this.panHandlers, handler);
	}
	/**
	* Subscribe to swipe events (fast directional release: left/right/up/down). Use for swipe-to-dismiss or flick gestures.
	* @returns An unsubscribe function.
	*/
	onSwipe(handler) {
		this.swipeHandlers.push(handler);
		return () => removeFrom(this.swipeHandlers, handler);
	}
	/**
	* Subscribe to raw pointer-down events (mouse button pressed or finger touched the canvas).
	* @returns An unsubscribe function.
	*/
	onPointerDown(handler) {
		this.downHandlers.push(handler);
		return () => removeFrom(this.downHandlers, handler);
	}
	/**
	* Subscribe to raw pointer-up events (mouse button released or finger lifted).
	* @returns An unsubscribe function.
	*/
	onPointerUp(handler) {
		this.upHandlers.push(handler);
		return () => removeFrom(this.upHandlers, handler);
	}
	/**
	* Subscribe to raw pointer-move events (mouse moved or touch dragged). Fires each frame the pointer position changes, including hover (mouse only).
	* @returns An unsubscribe function.
	*/
	onPointerMove(handler) {
		this.moveHandlers.push(handler);
		return () => removeFrom(this.moveHandlers, handler);
	}
	/** All currently active pointers (mouse + every touch finger on screen). */
	get pointers() {
		const out = [];
		for (const p of this.byId.values()) out.push(p);
		return out;
	}
	/** `true` if any pointer currently has a button/finger pressed. */
	get isAnyDown() {
		for (const p of this.byId.values()) if (p.isDown) return true;
		return false;
	}
	/** Attach canvas and window DOM listeners. Idempotent — safe to call multiple times. Called automatically by `Input.initMouse()`. */
	attach() {
		if (this.attached) return;
		this.attached = true;
		if (typeof document === "undefined" || !this.canvas) return;
		const canvas = this.canvas;
		canvas.addEventListener("mousedown", this.onMouseDown, { passive: false });
		if (typeof window !== "undefined") {
			window.addEventListener("mousemove", this.onMouseMove, { passive: false });
			window.addEventListener("mouseup", this.onMouseUp, { passive: false });
		}
		canvas.addEventListener("touchstart", this.onTouchStart, { passive: false });
		canvas.addEventListener("touchmove", this.onTouchMove, { passive: false });
		canvas.addEventListener("touchend", this.onTouchEnd, { passive: false });
		canvas.addEventListener("touchcancel", this.onTouchEnd, { passive: false });
		if (!this.touchActionSet) {
			canvas.style.touchAction = "none";
			this.touchActionSet = true;
		}
	}
	/**
	* Remove all canvas and window listeners attached by `attach()`, clear tracked pointers,
	* and restore the canvas `touch-action`. Safe to call when never attached.
	*/
	detach() {
		if (!this.attached) return;
		this.attached = false;
		this.byId.clear();
		if (typeof document === "undefined" || !this.canvas) return;
		const canvas = this.canvas;
		canvas.removeEventListener("mousedown", this.onMouseDown);
		if (typeof window !== "undefined") {
			window.removeEventListener("mousemove", this.onMouseMove);
			window.removeEventListener("mouseup", this.onMouseUp);
		}
		canvas.removeEventListener("touchstart", this.onTouchStart);
		canvas.removeEventListener("touchmove", this.onTouchMove);
		canvas.removeEventListener("touchend", this.onTouchEnd);
		canvas.removeEventListener("touchcancel", this.onTouchEnd);
		if (this.touchActionSet) {
			canvas.style.touchAction = "";
			this.touchActionSet = false;
		}
	}
	/** Zero the per-frame `dx`/`dy` on every tracked pointer. Called by `Input.clearPressed()` at end of each game tick. */
	flushFrame() {
		for (const p of this.byId.values()) {
			p.dx = 0;
			p.dy = 0;
		}
	}
	onMouseDown = (event) => {
		if (event.button !== 0) return;
		const { x, y } = this.toWorld(event.clientX, event.clientY);
		this.pointerDown("mouse", x, y, false);
	};
	onMouseUp = (event) => {
		if (event.button !== 0) return;
		const { x, y } = this.toWorld(event.clientX, event.clientY);
		this.pointerUp("mouse", x, y);
	};
	onMouseMove = (event) => {
		const { x, y } = this.toWorld(event.clientX, event.clientY);
		const mouse = this.byId.get("mouse");
		if (mouse?.isDown) this.pointerMove("mouse", x, y, false);
		else if (this.isInsideCanvas(event.clientX, event.clientY)) this.pointerMove("mouse", x, y, false);
		else if (mouse) {
			const oldX = mouse.x, oldY = mouse.y;
			mouse.x = x;
			mouse.y = y;
			mouse.dx = x - oldX;
			mouse.dy = y - oldY;
			this.fire(this.moveHandlers, mouse);
		}
	};
	isInsideCanvas(clientX, clientY) {
		const rect = this.canvas.getBoundingClientRect();
		return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
	}
	onTouchStart = (event) => {
		event.preventDefault();
		for (const t of Array.from(event.changedTouches)) {
			const { x, y } = this.toWorld(t.clientX, t.clientY);
			this.pointerDown(String(t.identifier), x, y, true);
		}
	};
	onTouchMove = (event) => {
		event.preventDefault();
		for (const t of Array.from(event.changedTouches)) {
			const { x, y } = this.toWorld(t.clientX, t.clientY);
			this.pointerMove(String(t.identifier), x, y, true);
		}
	};
	onTouchEnd = (event) => {
		event.preventDefault();
		for (const t of Array.from(event.changedTouches)) {
			const { x, y } = this.toWorld(t.clientX, t.clientY);
			this.pointerUp(String(t.identifier), x, y);
		}
	};
	toWorld(clientX, clientY) {
		return this.mapToWorld(clientX, clientY);
	}
	/**
	* Inject a synthetic pointer-down event. Used internally by DOM handlers and externally for
	* headless tests or programmatic gesture replay.
	* @param id Pointer id (`'mouse'` or a touch identifier string).
	* @param x World x-coordinate.
	* @param y World y-coordinate.
	* @param isTouch `true` for touch events, `false` for mouse.
	*/
	pointerDown(id, x, y, isTouch = false) {
		const now = performance.now();
		let p = this.byId.get(id);
		if (!p) {
			p = {
				id,
				x,
				y,
				startX: x,
				startY: y,
				dx: 0,
				dy: 0,
				vx: 0,
				vy: 0,
				isDown: true,
				downTime: now,
				isTouch,
				longPressTimer: null,
				recentSamples: [],
				panStarted: false
			};
			this.byId.set(id, p);
		} else {
			p.x = x;
			p.y = y;
			p.startX = x;
			p.startY = y;
			p.dx = 0;
			p.dy = 0;
			p.vx = 0;
			p.vy = 0;
			p.isDown = true;
			p.downTime = now;
			p.isTouch = isTouch;
			p.recentSamples.length = 0;
			p.panStarted = false;
		}
		p.recentSamples.push({
			x,
			y,
			t: now
		});
		if (typeof window !== "undefined") p.longPressTimer = window.setTimeout(() => {
			if (!p) return;
			p.longPressTimer = null;
			if (!p.isDown) return;
			if ((p.x - p.startX) ** 2 + (p.y - p.startY) ** 2 > this.options.longPressTolerance ** 2) return;
			this.fire(this.longPressHandlers, {
				pointer: p,
				x: p.x,
				y: p.y,
				duration: performance.now() - p.downTime
			});
		}, this.options.longPressDelay);
		this.recomputePrimary();
		this.fire(this.downHandlers, p);
	}
	/**
	* Inject a synthetic pointer-move event. Hover-only moves for `'mouse'` (no button pressed)
	* create a hovering pointer so `onPointerMove` fires even before a click. Touch ids without
	* a prior `pointerDown` are ignored.
	* @param id Pointer id.
	* @param x World x-coordinate.
	* @param y World y-coordinate.
	* @param isTouch `true` for touch events.
	*/
	pointerMove(id, x, y, isTouch = false) {
		let p = this.byId.get(id);
		if (!p) {
			if (isTouch) return;
			p = {
				id,
				x,
				y,
				startX: x,
				startY: y,
				dx: 0,
				dy: 0,
				vx: 0,
				vy: 0,
				isDown: false,
				downTime: 0,
				isTouch: false,
				longPressTimer: null,
				recentSamples: [],
				panStarted: false
			};
			this.byId.set(id, p);
		}
		const oldX = p.x, oldY = p.y;
		p.x = x;
		p.y = y;
		p.dx = x - oldX;
		p.dy = y - oldY;
		if (p.isDown) {
			const now = performance.now();
			p.recentSamples.push({
				x,
				y,
				t: now
			});
			while (p.recentSamples.length > 1 && now - p.recentSamples[0].t > 80) p.recentSamples.shift();
			if (p.recentSamples.length >= 2) {
				const first = p.recentSamples[0];
				const last = p.recentSamples[p.recentSamples.length - 1];
				const dt = (last.t - first.t) / 1e3;
				if (dt > 0) {
					p.vx = (last.x - first.x) / dt;
					p.vy = (last.y - first.y) / dt;
				}
			}
			const totalDx = x - p.startX;
			const totalDy = y - p.startY;
			if (!p.panStarted && totalDx * totalDx + totalDy * totalDy >= this.options.panThreshold ** 2) p.panStarted = true;
			if (p.panStarted) {
				if (p.longPressTimer !== null) {
					if (typeof window !== "undefined") window.clearTimeout(p.longPressTimer);
					p.longPressTimer = null;
				}
				this.fire(this.panHandlers, {
					pointer: p,
					x,
					y,
					totalDx,
					totalDy,
					dx: p.dx,
					dy: p.dy
				});
			}
		}
		this.recomputePrimary();
		this.fire(this.moveHandlers, p);
	}
	/**
	* Inject a synthetic pointer-up event. Triggers tap / double-tap / swipe detection,
	* then fires the raw pointer-up handlers. Used internally by DOM handlers and for
	* headless tests.
	* @param id Pointer id.
	* @param x World x-coordinate at release.
	* @param y World y-coordinate at release.
	*/
	pointerUp(id, x, y) {
		const p = this.byId.get(id);
		if (!p) return;
		if (!p.isDown) return;
		const now = performance.now();
		p.x = x;
		p.y = y;
		p.isDown = false;
		if (p.longPressTimer !== null) {
			if (typeof window !== "undefined") window.clearTimeout(p.longPressTimer);
			p.longPressTimer = null;
		}
		const duration = now - p.downTime;
		const dx = x - p.startX;
		const dy = y - p.startY;
		const distance = Math.sqrt(dx * dx + dy * dy);
		const samples = p.recentSamples;
		while (samples.length > 0 && now - samples[0].t > 80) samples.shift();
		if (samples.length >= 2) {
			const first = samples[0];
			const last = samples[samples.length - 1];
			const dt = (last.t - first.t) / 1e3;
			if (dt > 0) {
				p.vx = (last.x - first.x) / dt;
				p.vy = (last.y - first.y) / dt;
			} else {
				p.vx = 0;
				p.vy = 0;
			}
		} else {
			p.vx = 0;
			p.vy = 0;
		}
		if (duration <= this.options.tapMaxDuration && distance <= this.options.tapTolerance) {
			if (this._lastTap && now - this._lastTap.t <= this.options.doubleTapDelay) {
				const ddx = x - this._lastTap.x;
				const ddy = y - this._lastTap.y;
				if (ddx * ddx + ddy * ddy <= this.options.doubleTapDistance * this.options.doubleTapDistance) {
					this.fire(this.doubleTapHandlers, {
						pointer: p,
						x,
						y,
						interval: now - this._lastTap.t
					});
					this._lastTap = null;
				}
			}
			this.fire(this.tapHandlers, {
				pointer: p,
				x,
				y,
				duration
			});
			this._lastTap = {
				x,
				y,
				t: now,
				id
			};
		} else {
			const velocity = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
			if (distance >= this.options.swipeMinDistance && velocity >= this.options.swipeMinVelocity) {
				const direction = Math.abs(dx) > Math.abs(dy) ? dx > 0 ? "right" : "left" : dy > 0 ? "down" : "up";
				this.fire(this.swipeHandlers, {
					pointer: p,
					x,
					y,
					direction,
					velocity,
					distance,
					angle: Math.atan2(dy, dx)
				});
			}
		}
		this.fire(this.upHandlers, p);
		if (p.isTouch) this.byId.delete(id);
		this.recomputePrimary();
	}
	recomputePrimary() {
		const mouse = this.byId.get("mouse");
		if (mouse) {
			this.primary = mouse;
			return;
		}
		for (const p of this.byId.values()) if (p.isDown) {
			this.primary = p;
			return;
		}
		this.primary = null;
	}
	fire(handlers, event) {
		const snapshot = handlers.slice();
		for (const h of snapshot) if (h(event) === false) return;
	}
};
function removeFrom(arr, item) {
	const i = arr.indexOf(item);
	if (i >= 0) arr.splice(i, 1);
}
/**
* Returns `true` if world point `(px, py)` is inside the visible rectangle of a sprite.
* Used by the gesture dispatch in `SceneInput` to determine which sprite captured a pointer.
* v2: raster's scale/angle/pivot/`shape: 'circle'`/animation-sheet sizing not ported yet —
* v2 sprites are plain AABBs (top-left `x`/`y` + `w`/`h` in world units).
*/
function spriteContainsPoint(sprite, px, py) {
	return px >= sprite.x && px < sprite.x + sprite.w && py >= sprite.y && py < sprite.y + sprite.h;
}
//#endregion
//#region src/lib/scene-input.ts
/**
* Scene-level input facade. Wraps the game's `Input` service with typed key-state objects
* and sprite-targeted gesture dispatch. Accessed as `this.input` inside a scene's `setup()` and `update()`.
*/
var SceneInput = class {
	scene;
	/** @internal */
	constructor(scene) {
		this.scene = scene;
	}
	/**
	* Unsubscribe functions for every tracker subscription made through this facade —
	* the public `on*` handlers plus the internal sprite-dispatch hooks from `attach()`.
	* Drained by `detach()` when the scene is torn down on a transition.
	* @internal
	*/
	_unsubs = [];
	/** @internal Record a subscription so `detach()` can remove it; returns a wrapped unsubscribe that also drops the record. */
	track(unsub) {
		this._unsubs.push(unsub);
		return () => {
			unsub();
			const i = this._unsubs.indexOf(unsub);
			if (i >= 0) this._unsubs.splice(i, 1);
		};
	}
	/**
	* True while any of the given KEY CODES is held: `this.input.key('Space')`.
	* The no-setup path — for remappable or many-key controls use `bind()` and
	* read the returned states instead. Both respect the transition grace.
	*/
	key(...codes) {
		return this.scene.game.input.key(...codes);
	}
	/** True only on the frame any of the given key codes went DOWN (edge, not held). */
	keyPressed(...codes) {
		return this.scene.game.input.keyPressed(...codes);
	}
	/**
	* Map a RAW DOM pointer event to world coordinates — the escape hatch for
	* your own `canvas.addEventListener`. Gestures and `pointer` already carry
	* world coordinates, so you rarely need this.
	*/
	toWorld(e) {
		return this.scene.game.input.toWorld(e);
	}
	/**
	* Named key states, populated by `bind()`. Entities can read
	* `this.scene.input.keys.<name>.held` / `.pressed` / `.released` directly.
	*/
	keys = {};
	/**
	* Bind a map of action names to key-code arrays and return typed key-state accessors.
	* Calls `game.input.bind()` for each entry; subsequent calls for the same names add more keys.
	* @example
	* const keys = this.input.bind({ left: ['ArrowLeft', 'KeyA'], jump: ['Space'] });
	* if (keys.jump.pressed) player.jump();
	* if (keys.left.held) player.x -= speed * dt;
	*/
	bind(map) {
		const self = this;
		for (const name in map) {
			self.scene.game.input.bind([...map[name]], name);
			this.keys[name] = {
				get held() {
					return self.scene.game.input.state(name);
				},
				get pressed() {
					return self.scene.game.input.pressed(name);
				},
				get released() {
					return self.scene.game.input.released(name);
				}
			};
		}
		return this.keys;
	}
	/** The primary pointer (mouse, or the first active touch finger). `null` when nothing is active. */
	get pointer() {
		return this.scene.game.input.pointer;
	}
	/** Every currently active pointer — multi-touch returns one entry per finger. */
	get pointers() {
		return this.scene.game.input.pointers;
	}
	/**
	* Subscribe to scene-wide tap events (quick click or touch-tap anywhere on the canvas).
	* For per-sprite taps set `sprite.onTap = fn` instead.
	* Automatically removed when the scene is replaced by a transition.
	* @returns An unsubscribe function.
	*/
	onTap(fn) {
		return this.track(this.scene.game.input.onTap(fn));
	}
	/**
	* Subscribe to scene-wide double-tap events.
	* Automatically removed when the scene is replaced by a transition.
	* @returns An unsubscribe function.
	*/
	onDoubleTap(fn) {
		return this.track(this.scene.game.input.onDoubleTap(fn));
	}
	/**
	* Subscribe to scene-wide long-press events (pointer held stationary for `longPressDelay` ms).
	* Automatically removed when the scene is replaced by a transition.
	* @returns An unsubscribe function.
	*/
	onLongPress(fn) {
		return this.track(this.scene.game.input.onLongPress(fn));
	}
	/**
	* Subscribe to scene-wide pan events (continuous drag). Fires every frame the pointer moves while pressed.
	* Automatically removed when the scene is replaced by a transition.
	* @returns An unsubscribe function.
	*/
	onPan(fn) {
		return this.track(this.scene.game.input.onPan(fn));
	}
	/**
	* Subscribe to scene-wide swipe events (fast directional flick: left/right/up/down).
	* Automatically removed when the scene is replaced by a transition.
	* @returns An unsubscribe function.
	*/
	onSwipe(fn) {
		return this.track(this.scene.game.input.onSwipe(fn));
	}
	/**
	* Subscribe to text input — typed characters (Shift/layout-resolved), one per keypress,
	* repeating while held. Control keys (Backspace, Enter, …) are not delivered; handle those
	* with `bind()`. Use for an in-canvas text field such as a high-score name. See `Input.onText`.
	* Automatically removed when the scene is replaced by a transition.
	* @returns An unsubscribe function.
	*/
	onText(fn) {
		return this.track(this.scene.game.input.onText(fn));
	}
	/**
	* Subscribe to scene-wide raw pointer-down events (mouse button press or touch start).
	* Automatically removed when the scene is replaced by a transition.
	* @returns An unsubscribe function.
	*/
	onPointerDown(fn) {
		return this.track(this.scene.game.input.onPointerDown(fn));
	}
	/**
	* Subscribe to scene-wide raw pointer-up events (mouse button release or touch end).
	* Automatically removed when the scene is replaced by a transition.
	* @returns An unsubscribe function.
	*/
	onPointerUp(fn) {
		return this.track(this.scene.game.input.onPointerUp(fn));
	}
	/**
	* Subscribe to scene-wide raw pointer-move events (mouse move or touch drag, including hover).
	* Automatically removed when the scene is replaced by a transition.
	* @returns An unsubscribe function.
	*/
	onPointerMove(fn) {
		return this.track(this.scene.game.input.onPointerMove(fn));
	}
	/** @internal Per-pointer sprite capture map: pointer id → captured sprite. */
	pointerCapture = /* @__PURE__ */ new Map();
	/**
	* Wire the game's pointer events to per-sprite gesture handlers.
	* Called once by `Scene._activate()` after `setup()` completes.
	* @internal
	*/
	attach() {
		const input = this.scene.game.input;
		if (!input) return;
		this._unsubs.push(input.onPointerDown((p) => {
			const top = this.findTopSpriteAt(p.x, p.y);
			if (top) {
				this.pointerCapture.set(p.id, top);
				if (top.onPointerDown) top.onPointerDown(p);
			}
		}));
		this._unsubs.push(input.onPointerUp((p) => {
			const captured = this.pointerCapture.get(p.id);
			if (captured && !captured.dead && captured.onPointerUp) captured.onPointerUp(p);
			this.pointerCapture.delete(p.id);
			this.dispatchHover(p);
		}));
		this._unsubs.push(input.onTap((e) => this.dispatchCaptured(e, "onTap")));
		this._unsubs.push(input.onDoubleTap((e) => this.dispatchCaptured(e, "onDoubleTap")));
		this._unsubs.push(input.onLongPress((e) => this.dispatchCaptured(e, "onLongPress")));
		this._unsubs.push(input.onSwipe((e) => this.dispatchCapturedSwipe(e)));
		this._unsubs.push(input.onPan((e) => this.dispatchCaptured(e, "onPan")));
		this._unsubs.push(input.onPointerMove((p) => this.dispatchHover(p)));
	}
	/**
	* Remove every tracker subscription this scene made — the public `on*` handlers and the
	* internal sprite-dispatch hooks from `attach()` — and release any pointer captures.
	* Called by `Scene._deactivate()` when the scene is torn down on a transition. Idempotent.
	* @internal
	*/
	detach() {
		for (let i = 0; i < this._unsubs.length; i++) this._unsubs[i]();
		this._unsubs.length = 0;
		this.pointerCapture.clear();
	}
	/**
	* Swipe suppression for pan-bound sprites: a sprite with `onPan` is being dragged,
	* so its release counts as end-of-drag, not a swipe. Returns `false` to stop all
	* `onSwipe` handlers from firing. Sprites wanting flick-to-throw should omit `onPan`
	* and read `pointer.vx`/`vy` on pointer-up instead.
	* @internal
	*/
	dispatchCapturedSwipe(e) {
		const captured = this.pointerCapture.get(e.pointer.id);
		if (captured && captured.onPan) return false;
		if (captured && !captured.dead && captured.onSwipe) captured.onSwipe(e);
	}
	/**
	* @internal Returns the topmost alive sprite at `(x, y)` that has at least one gesture handler.
	* v2: paint order = array order (no per-sprite `depth` field), so scan from LAST to FIRST —
	* the first hit is the topmost.
	*/
	findTopSpriteAt(x, y) {
		const sprites = this.scene.sprites;
		for (let i = sprites.length - 1; i >= 0; i--) {
			const s = sprites[i];
			if (s.dead) continue;
			if (!s.onTap && !s.onDoubleTap && !s.onLongPress && !s.onPan && !s.onSwipe) continue;
			if (!spriteContainsPoint(s, x, y)) continue;
			return s;
		}
		return null;
	}
	/**
	* Route a gesture event to the sprite that captured this pointer.
	* Captured sprites receive exclusive gesture delivery — lower-depth sprites under the same point do not fire.
	* @internal
	*/
	dispatchCaptured(event, handlerName) {
		const target = this.pointerCapture.get(event.pointer.id);
		if (!target || target.dead) return;
		const handler = target[handlerName];
		if (handler) handler(event);
	}
	/**
	* Fire `onPointerOver` / `onPointerOut` on sprites as the pointer moves across them.
	* Called on every pointer-move (hover) and on pointer-up (so touch-released sprites exit hover).
	* Each callback fires exactly once per entry and exit — `isPointerOver` tracks the current state.
	* @internal
	*/
	dispatchHover(p) {
		const sprites = this.scene.sprites;
		for (let i = 0; i < sprites.length; i++) {
			const s = sprites[i];
			if (s.dead) continue;
			if (!s.onPointerOver && !s.onPointerOut) continue;
			const hit = (!p.isTouch || p.isDown) && spriteContainsPoint(s, p.x, p.y);
			if (hit && !s.isPointerOver) {
				s.isPointerOver = true;
				if (s.onPointerOver) s.onPointerOver(p);
			} else if (!hit && s.isPointerOver) {
				s.isPointerOver = false;
				if (s.onPointerOut) s.onPointerOut(p);
			}
		}
	}
};
//#endregion
//#region src/lib/sprite-pool.ts
/** Object pool that recycles sprite instances (bullets, coins, sparks) to avoid GC pressure. */
var SpritePool = class {
	scene;
	/** @internal Per-class stacks of dead (recycled) sprite instances waiting for reuse. */
	pools = /* @__PURE__ */ new Map();
	/** @internal Classes that have been spawned from this pool and have recycling enabled. */
	enabled = /* @__PURE__ */ new Set();
	/**
	* @param scene The scene this pool belongs to. Spawned sprites are added to this scene.
	*/
	constructor(scene) {
		this.scene = scene;
	}
	/**
	* Spawn a sprite of `cls` at `(x, y)`, reusing a recycled instance when one is available.
	* Spawning via the pool opts the class in so its killed instances return here for reuse.
	* Configure per-spawn properties (speed, colour, etc.) on the returned sprite after calling this.
	* @param cls The sprite class to spawn. Must be constructible with no arguments.
	* @param x World x position (optional — omit to keep the sprite's config/current position).
	* @param y World y position.
	* @returns The spawned (or recycled) sprite instance, live in the scene.
	*/
	spawn(cls, x, y) {
		this.enabled.add(cls);
		const dead = this.pools.get(cls);
		const s = dead && dead.length ? dead.pop() : new cls();
		if (x !== void 0) s.x = x;
		if (y !== void 0) s.y = y;
		s.dead = false;
		s.reset?.(x, y);
		if (!this.scene.sprites.includes(s)) this.scene.add(s);
		return s;
	}
	/**
	* Returns `true` if `cls` has been spawned from this pool and recycling is active for it.
	* Used internally to decide whether a killed sprite should be returned to the pool.
	*/
	isEnabled(cls) {
		return this.enabled.has(cls);
	}
	/**
	* Return a killed sprite to the pool if its class has been spawned from here.
	* Called automatically by the scene when a dead sprite is swept. Returns `true` if recycled,
	* `false` if the class is not pooled (the caller should dispose it normally).
	*/
	tryReturn(instance) {
		const cls = instance.constructor;
		if (!this.enabled.has(cls)) return false;
		const pool = this.pools.get(cls);
		if (pool) pool.push(instance);
		else this.pools.set(cls, [instance]);
		return true;
	}
	/**
	* Discard all recycled instances of `cls`, freeing their memory.
	* Fresh instances will be constructed on the next `spawn` call.
	*/
	drain(cls) {
		this.pools.delete(cls);
	}
	/**
	* Discard all recycled instances of every class in this pool, freeing their memory.
	* Use when resetting a level or scene — any live sprites are unaffected.
	*/
	drainAll() {
		this.pools.clear();
	}
};
//#endregion
//#region src/lib/util.ts
/**
* Remap / scale `value` from input range `[istart, istop]` to output range
* `[ostart, ostop]`. Equivalent to `map` / `lerp-range` in other libs.
* @param value The value to remap.
* @param istart Input range start.
* @param istop Input range end.
* @param ostart Output range start.
* @param ostop Output range end.
*/
function mapRange(value, istart, istop, ostart, ostop) {
	return ostart + (ostop - ostart) * ((value - istart) / (istop - istart));
}
/**
* Clamp / limit `value` to `[min, max]` (inclusive).
* Equivalent to `clamp` in other math libraries.
*/
function limit(value, min, max) {
	return Math.min(max, Math.max(min, value));
}
/**
* Round `value` to `precision` decimal places (default 0 = nearest integer).
*/
function roundTo(value, precision = 0) {
	const p = Math.pow(10, precision);
	return Math.round(value * p) / p;
}
/**
* Truncate `value` toward zero — fast integer conversion via bitwise OR 0.
* Use instead of `Math.floor` when the value is always positive.
*/
function toInt(value) {
	return value | 0;
}
/**
* Convert degrees to radians. Inverse of `toDeg`.
* @param degrees Angle in degrees.
*/
function toRad(degrees) {
	return degrees / 180 * Math.PI;
}
/**
* Convert radians to degrees. Inverse of `toRad`.
* @param radians Angle in radians.
*/
function toDeg(radians) {
	return radians * 180 / Math.PI;
}
/**
* Remove every occurrence of `item` from `array` in place.
* Mutates the array and returns it. Equivalent to `Array.erase` / `remove-all`.
*/
function eraseFrom(array, item) {
	for (let i = array.length; i--;) if (array[i] === item) array.splice(i, 1);
	return array;
}
/**
* Return a random element from `array` (uniform distribution).
* Equivalent to `random pick` / `choose` / `sample`.
*/
function randomItem(array) {
	return array[Math.floor(Math.random() * array.length)];
}
/**
* Deep-merge `source` into `target` in place and return `target`.
* Nested plain objects are merged recursively; arrays, DOM nodes, and
* primitives are assigned directly. Used to apply partial sprite settings.
*/
function merge(target, source) {
	const t = target;
	for (const key in source) {
		const v = source[key];
		const isNode = typeof HTMLElement !== "undefined" && v instanceof HTMLElement;
		if (v && typeof v === "object" && !Array.isArray(v) && !isNode) {
			if (!t[key] || typeof t[key] !== "object") t[key] = {};
			merge(t[key], v);
		} else t[key] = v;
	}
	return target;
}
/**
* Create a seeded uniform-`[0, 1)` pseudo-random generator (mulberry32).
*
* The same `seed` always yields the same sequence — the determinism backbone
* for reproducible procedural content (formations, level layouts, particle
* jitter). Pure integer math with `>>> 0` at every step keeps the stream
* byte-identical across platforms, so headless verification never drifts.
*
* Pair with {@link hashCode} to turn a human-readable level code into a seed.
* Use one ordered stream consumed in a fixed order; never branch the draw order
* on anything non-deterministic (frame time, live input) or the stream desyncs.
*
* @param seed Any 32-bit-coercible number; the same seed reproduces the sequence.
* @returns A function returning the next float in `[0, 1)` on each call.
* @example
* const rng = makeRng(hashCode('GLX.3'));
* const x = rng(); // deterministic for that level code
*/
function makeRng(seed) {
	let a = seed >>> 0;
	return () => {
		a += 1831565813;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
/**
* Hash a string to a uint32 via FNV-1a — a stable, fast string→seed mapping.
*
* The same string always hashes to the same number, forever, so a level code
* like `"GLX.3"` becomes a reproducible seed for {@link makeRng}.
*
* @param s The string to hash (e.g. a level code).
* @returns An unsigned 32-bit integer hash.
*/
function hashCode(s) {
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return h >>> 0;
}
//#endregion
//#region src/lib/physics.ts
/** Per-Scene motion and collision system; owns gravity, worldBounds, the tile-collision trace, AABB overlap, and pure geometry helpers. Ported from the raster engine's proven Physics. */
/**
* Slope angle range (radians) that counts as ground for the slope-slide `touching.down`.
* Raster kept this per-sprite (`sprite.slopeStanding`, default min 44° / max 136°);
* v2 sprites are pure config-data, so the default lives here as one shared constant
* until a game needs to tune it per sprite.
*/
var SLOPE_STANDING = {
	min: toRad(44),
	max: toRad(136)
};
/** @internal Scratch AABB reused by the broad-phase (avoids per-sprite allocation). */
var _box = {
	l: 0,
	t: 0,
	r: 0,
	b: 0
};
/**
* @internal Below this many candidate pairs the brute-force all-pairs scan beats the
* spatial hash (whose per-frame Map building has fixed overhead); above it the hash wins.
*/
var HASH_MIN_PAIRS = 1024;
var Physics = class Physics {
	scene;
	/** Downward acceleration (world units/s²) applied to every body scaled by its `gravity` factor. Default `0` (no gravity). */
	gravity = 0;
	/** World rectangle that bodies with `collideWorldBounds = true` are clamped inside. `null` = use the screen dimensions. */
	worldBounds = null;
	/**
	* Continuous collision detection for the `on(A, B)` overlap checks. When `true`
	* (default), a pair whose discrete boxes miss is also swept along its relative
	* motion this frame, so a fast bullet can't tunnel through a thin sprite between
	* frames. The sweep only runs for pairs where a sprite moved more than half its
	* hitbox, so slow sprites cost nothing extra. Set `false` to force pure discrete
	* (per-frame) overlap — the cheapest path if you never have fast movers.
	*/
	continuous = true;
	/**
	* Solid-solver relaxation passes per frame. Each pass re-checks every `solid(A, B)` pair,
	* so a push that drives one body into a third is handed down the chain within the same
	* frame (crate rows, small stacks). Passes stop early once nothing moves, and a finishing
	* pass always resolves contacts against static/kinematic bodies LAST, so residual overlap
	* only ever remains between dynamic bodies — never against a wall or floor. Raise for
	* taller stacks / longer push chains; `1` is the cheapest single pass. Default `4`.
	*/
	solverIterations = 4;
	/** @internal Set by nudge() whenever a solver pass changes any position — drives the relaxation early-out. */
	_solverMoved = false;
	/**
	* Spatial-hash grid cell size (world units) for the broad-phase overlap pass.
	* `null` (default) auto-sizes the grid from the average sprite size each frame.
	* The hash only engages on large scenes (many candidate pairs); small scenes
	* stay on the brute-force all-pairs scan, which is faster there. Set explicitly
	* to tune the grid for a known world (≈ the typical colliding-sprite size).
	*/
	hashCellSize = null;
	/**
	* Force-field effectors active this scene — wind, conveyors, gravity wells, water. Each is applied
	* to every **dynamic** body during `updateBody` (static/kinematic/sensor bodies ignore them), after
	* the body's own velocity integration and before it moves.
	* Add one with {@link addEffector} (or push directly); remove with {@link removeEffector}. Empty by default.
	*/
	effectors = [];
	/**
	* Arcade joints active this scene — ropes, rods, grapples pinning a sprite to a point or
	* another sprite. Solved each frame after sprite updates and before collision (so the
	* solid pass sees constrained positions). Add with {@link addJoint}; remove with
	* {@link removeJoint}. A joint whose sprite (or anchor sprite) is killed removes itself.
	*/
	joints = [];
	/**
	* @internal Snapshot of the last frame's spatial-hash broad-phase — kept for the debug
	* overlay (not yet ported to v2). `null` when the brute-force path was used (small scene)
	* or no `on(A, B)` pairs are registered. `narrow` is how many pairs the hash actually
	* tested; `brute` is how many the all-pairs scan would have.
	*/
	_debugHash = null;
	constructor(scene) {
		this.scene = scene;
	}
	/** Returns the screen rectangle `{x:0,y:0,w,h}` — the default world bounds when `worldBounds` is null. */
	screenBounds() {
		const v = this.scene.viewRect?.();
		return {
			x: 0,
			y: 0,
			w: v?.w ?? 0,
			h: v?.h ?? 0
		};
	}
	/**
	* Add a force-field effector (wind / conveyor / gravity well / water) to the scene and return it,
	* so you can keep a reference to move or toggle it later. `this.physics.addEffector(new AreaEffector({…}))`.
	*/
	addEffector(effector) {
		this.effectors.push(effector);
		return effector;
	}
	/** Remove a previously-added effector. Returns `true` if it was present. */
	removeEffector(effector) {
		const i = this.effectors.indexOf(effector);
		if (i < 0) return false;
		this.effectors.splice(i, 1);
		return true;
	}
	/**
	* Add an arcade joint (rope / rod / grapple) to the scene and return it, so you can keep a
	* reference to reel (`joint.length`), re-hook (`joint.anchor`), or release it later.
	* `this.physics.addJoint(new Joint({ sprite, anchor, mode: 'rope' }))`.
	*/
	addJoint(joint) {
		this.joints.push(joint);
		return joint;
	}
	/** Remove (release) a previously-added joint. Returns `true` if it was present. */
	removeJoint(joint) {
		const i = this.joints.indexOf(joint);
		if (i < 0) return false;
		this.joints.splice(i, 1);
		return true;
	}
	/**
	* Solve every active joint for this frame. Driven by `Scene.update()` between the sprite
	* updates and the collision pass; call manually only if you manage the update loop
	* yourself. Joints whose sprite (or anchor sprite) has been killed remove themselves.
	* @internal
	*/
	updateJoints(dt) {
		for (let i = this.joints.length - 1; i >= 0; i--) {
			const j = this.joints[i];
			const anchorSprite = j.anchor;
			if (j.sprite.dead || anchorSprite.dead === true) {
				this.joints.splice(i, 1);
				continue;
			}
			if (j.enabled) j.update(dt);
		}
	}
	/**
	* Integrates one velocity axis for `dt` seconds under acceleration and friction, clamped to `±max`.
	* Use when you need raw velocity math outside a full body update.
	* @param vel Current velocity.
	* @param accel Acceleration to apply (0 = none).
	* @param friction Deceleration to apply when accel is 0 (0 = none).
	* @param max Maximum absolute velocity.
	* @param dt Delta-time in seconds.
	* @returns The new velocity after integration.
	*/
	getNewVelocity(vel, accel, friction, max, dt) {
		if (accel) return limit(vel + accel * dt, -max, max);
		else if (friction) {
			const delta = friction * dt;
			if (vel - delta > 0) return vel - delta;
			else if (vel + delta < 0) return vel + delta;
			return 0;
		}
		return limit(vel, -max, max);
	}
	/**
	* Advances one sprite body by `dt` seconds — the per-frame motion entry point called by `Scene.update()`.
	* Resets the reflect guard, records `last` position, integrates gravity and per-axis velocity,
	* runs the swept tilemap collision trace, then applies world-bounds clamping or edge bounce.
	* @internal
	*/
	updateBody(sprite, dt) {
		sprite._reflected = false;
		sprite.last.x = sprite.x;
		sprite.last.y = sprite.y;
		if (sprite._body2d) return;
		sprite.touching.up = sprite.touching.down = sprite.touching.left = sprite.touching.right = false;
		if (sprite.body === "none") return;
		if (sprite.body === "static") return;
		const dynamic = sprite.body === "dynamic";
		if (dynamic) sprite.vel.y += this.gravity * dt * sprite.gravity;
		sprite.vel.x = this.getNewVelocity(sprite.vel.x, sprite.acceleration.x, sprite.friction.x, sprite.maxVelocity.x, dt);
		sprite.vel.y = this.getNewVelocity(sprite.vel.y, sprite.acceleration.y, sprite.friction.y, sprite.maxVelocity.y, dt);
		if (dynamic) {
			for (let i = 0; i < this.effectors.length; i++) this.effectors[i].apply(sprite, dt, this);
			const mx = sprite.vel.x * dt;
			const my = sprite.vel.y * dt;
			const res = this.scene.collisionMap.trace(sprite.x, sprite.y, mx, my, sprite.w, sprite.h);
			this.handleMovementTrace(sprite, res);
		} else {
			sprite.x += sprite.vel.x * dt;
			sprite.y += sprite.vel.y * dt;
		}
		if (sprite.collideWorldBounds) this.collideBounds(sprite);
		if (sprite.bounceEdges) this.bounceWorldEdges(sprite);
	}
	/**
	* Applies a swept-collision `TraceResult` to a body: sets the `touching` flags, resolves
	* velocity (zero, bounce, or slope-slide), and snaps position to the trace endpoint.
	* (Raster set a dedicated `sprite.standing` here; v2 folds it into `touching.down`/`up`,
	* the flags the rest of the engine already reads.)
	* @internal
	*/
	handleMovementTrace(sprite, res) {
		if (res.collision.y) if (sprite.bounce > 0 && Math.abs(sprite.vel.y) > sprite.minBounceVelocity) sprite.vel.y *= -sprite.bounce;
		else {
			if (sprite.vel.y > 0) sprite.touching.down = true;
			else if (sprite.vel.y < 0) sprite.touching.up = true;
			sprite.vel.y = 0;
		}
		if (res.collision.x) if (sprite.bounce > 0 && Math.abs(sprite.vel.x) > sprite.minBounceVelocity) sprite.vel.x *= -sprite.bounce;
		else {
			if (sprite.vel.x > 0) sprite.touching.right = true;
			else if (sprite.vel.x < 0) sprite.touching.left = true;
			sprite.vel.x = 0;
		}
		if (res.collision.slope) {
			const s = res.collision.slope;
			if (sprite.bounce > 0) {
				const proj = sprite.vel.x * s.nx + sprite.vel.y * s.ny;
				sprite.vel.x = (sprite.vel.x - s.nx * proj * 2) * sprite.bounce;
				sprite.vel.y = (sprite.vel.y - s.ny * proj * 2) * sprite.bounce;
			} else {
				const lengthSquared = s.x * s.x + s.y * s.y;
				const dot = (sprite.vel.x * s.x + sprite.vel.y * s.y) / lengthSquared;
				sprite.vel.x = s.x * dot;
				sprite.vel.y = s.y * dot;
				const angle = Math.atan2(s.x, s.y);
				if (angle > SLOPE_STANDING.min && angle < SLOPE_STANDING.max) sprite.touching.down = true;
			}
		}
		sprite.x = res.position.x;
		sprite.y = res.position.y;
	}
	/**
	* Hard-clamps a body's position inside the world bounds (`worldBounds` or the screen).
	* Prevents tunnelling at any speed: position is always corrected before the frame ends.
	* Velocity is reversed by `bounce` (or zeroed) only when it points into a bound.
	* Sets the matching `touching` flag on each clamped edge.
	* @internal
	*/
	collideBounds(sprite) {
		const b = this.worldBounds ?? this.screenBounds();
		const minX = b.x;
		const minY = b.y;
		const maxX = b.x + b.w - sprite.w;
		const maxY = b.y + b.h - sprite.h;
		if (sprite.x < minX) {
			sprite.x = minX;
			sprite.touching.left = true;
			if (sprite.vel.x < 0) sprite.vel.x = this.bounceOffBound(sprite, sprite.vel.x);
		} else if (sprite.x > maxX) {
			sprite.x = maxX;
			sprite.touching.right = true;
			if (sprite.vel.x > 0) sprite.vel.x = this.bounceOffBound(sprite, sprite.vel.x);
		}
		if (sprite.y < minY) {
			sprite.y = minY;
			sprite.touching.up = true;
			if (sprite.vel.y < 0) sprite.vel.y = this.bounceOffBound(sprite, sprite.vel.y);
		} else if (sprite.y > maxY) {
			sprite.y = maxY;
			sprite.touching.down = true;
			if (sprite.vel.y > 0) sprite.vel.y = this.bounceOffBound(sprite, sprite.vel.y);
		}
	}
	/** @internal Reflects a velocity component off a world bound by `bounce`; stops (returns 0) when speed is below `minBounceVelocity`. */
	bounceOffBound(sprite, vel) {
		if (sprite.bounce > 0 && Math.abs(vel) > sprite.minBounceVelocity) return -vel * sprite.bounce;
		return 0;
	}
	/**
	* Reflects a body off whichever world edges are enabled in `bounceEdges`.
	* Edges not included in `bounceEdges` are open — the body passes through them freely.
	* @internal
	*/
	bounceWorldEdges(sprite) {
		const e = sprite.bounceEdges;
		const bounds = this.worldBounds ?? this.screenBounds();
		const minX = bounds.x;
		const minY = bounds.y;
		const maxX = bounds.x + bounds.w - sprite.w;
		const maxY = bounds.y + bounds.h - sprite.h;
		if (e.left && sprite.x < minX) {
			sprite.x = minX;
			if (sprite.vel.x < 0) sprite.vel.x = -sprite.vel.x;
		} else if (e.right && sprite.x > maxX) {
			sprite.x = maxX;
			if (sprite.vel.x > 0) sprite.vel.x = -sprite.vel.x;
		}
		if (e.top && sprite.y < minY) {
			sprite.y = minY;
			if (sprite.vel.y < 0) sprite.vel.y = -sprite.vel.y;
		} else if (e.bottom && sprite.y > maxY) {
			sprite.y = maxY;
			if (sprite.vel.y > 0) sprite.vel.y = -sprite.vel.y;
		}
	}
	/**
	* Reflects a body's velocity off a collision contact — flips `vy` for top/bottom hits, `vx` for left/right hits.
	* Idempotent within a frame via the `_reflected` guard, so hitting multiple bricks at once reflects only once.
	* Use in an `on(A, B)` handler: `this.physics.reflect(ball, contact)`.
	*/
	reflect(sprite, contact) {
		if (sprite._reflected) return;
		sprite._reflected = true;
		const push = contact.overlap ?? 0;
		if (contact.side === "top" || contact.side === "bottom") {
			sprite.vel.y = -sprite.vel.y;
			sprite.y += contact.side === "top" ? -push : push;
		} else {
			sprite.vel.x = -sprite.vel.x;
			sprite.x += contact.side === "left" ? -push : push;
		}
	}
	/**
	* Repositions a body and zeroes its per-life motion — the pool-reset core.
	* (raster restores the sprite's captured `_defaults` here; v2's defaults capture
	* lands with the pool-defaults port, so this resets position + motion only.)
	* @internal
	*/
	resetBody(sprite, x, y) {
		sprite.x = x;
		sprite.y = y;
		sprite.last.x = x;
		sprite.last.y = y;
		sprite.vel.x = 0;
		sprite.vel.y = 0;
		sprite.acceleration.x = 0;
		sprite.acceleration.y = 0;
	}
	/**
	* Returns `true` when two sprites' AABB hitboxes overlap (position + size).
	* Use for manual overlap checks; the `on(A, B)` system calls this automatically each frame.
	* Synonyms: collision, overlap, intersect, hitbox test.
	*/
	static touches(a, b) {
		return !(a.x >= b.x + b.w || a.x + a.w <= b.x || a.y >= b.y + b.h || a.y + a.h <= b.y);
	}
	/**
	* Returns the distance (world units) between the centres of two sprites' bounding boxes.
	* Use for proximity checks, aggro ranges, or audio attenuation.
	*/
	static distanceTo(a, b) {
		const xd = a.centerX - b.centerX;
		const yd = a.centerY - b.centerY;
		return Math.sqrt(xd * xd + yd * yd);
	}
	/**
	* Returns the heading angle (radians, `atan2` convention) from `a`'s centre to `b`'s centre.
	* Use to aim a projectile or steer an enemy toward the player.
	*/
	static angleTo(a, b) {
		return Math.atan2(b.centerY - a.centerY, b.centerX - a.centerX);
	}
	/**
	* Returns the minimal-penetration `Contact` for two overlapping sprites.
	* Provides the `side` (`'top'|'bottom'|'left'|'right'`) needed to call `reflect()` correctly.
	* Automatically provided as the third argument in `on(A, B, contact)` handlers.
	*/
	static contactBetween(a, b) {
		const dx = a.centerX - b.centerX;
		const dy = a.centerY - b.centerY;
		const ox = (a.w + b.w) / 2 - Math.abs(dx);
		const oy = (a.h + b.h) / 2 - Math.abs(dy);
		if (ox < oy) return {
			side: dx < 0 ? "left" : "right",
			overlap: ox
		};
		return {
			side: dy < 0 ? "top" : "bottom",
			overlap: oy
		};
	}
	/**
	* Returns `true` when a body moved more than half its hitbox this frame — the
	* cheap test that decides whether a pair needs the swept (continuous) check.
	* A body that moves no further than its own half-extent always overlaps the
	* next frame's box, so nothing its own size or smaller can slip between samples.
	*/
	static movedFast(s) {
		return Math.abs(s.x - s.last.x) > s.w / 2 || Math.abs(s.y - s.last.y) > s.h / 2;
	}
	/**
	* Continuous (swept) contact test for a fast pair the discrete overlap missed.
	* Sweeps `a`'s box along the pair's *relative* motion this frame (`last`→position)
	* against `b`, via a segment-vs-Minkowski-box slab test. Returns the time-of-impact
	* `toi` in `[0, 1]` and the entry-side `contact`, or `null` if `a` never crossed `b`.
	* @internal
	*/
	static sweptContact(a, b) {
		const aHx = a.w / 2, aHy = a.h / 2;
		const bHx = b.w / 2, bHy = b.h / 2;
		const p0x = a.last.x + aHx - (b.last.x + bHx);
		const p0y = a.last.y + aHy - (b.last.y + bHy);
		const dx = a.x - a.last.x - (b.x - b.last.x);
		const dy = a.y - a.last.y - (b.y - b.last.y);
		const hx = (a.w + b.w) / 2;
		const hy = (a.h + b.h) / 2;
		let tEnter = -Infinity, tExit = Infinity;
		let enterAxis = "x";
		if (dx === 0) {
			if (p0x < -hx || p0x > hx) return null;
		} else {
			let t1 = (-hx - p0x) / dx, t2 = (hx - p0x) / dx;
			if (t1 > t2) {
				const t = t1;
				t1 = t2;
				t2 = t;
			}
			if (t1 > tEnter) {
				tEnter = t1;
				enterAxis = "x";
			}
			if (t2 < tExit) tExit = t2;
		}
		if (dy === 0) {
			if (p0y < -hy || p0y > hy) return null;
		} else {
			let t1 = (-hy - p0y) / dy, t2 = (hy - p0y) / dy;
			if (t1 > t2) {
				const t = t1;
				t1 = t2;
				t2 = t;
			}
			if (t1 > tEnter) {
				tEnter = t1;
				enterAxis = "y";
			}
			if (t2 < tExit) tExit = t2;
		}
		if (tEnter > tExit) return null;
		if (tEnter < 0 || tEnter > 1) return null;
		return {
			contact: {
				side: enterAxis === "x" ? dx > 0 ? "left" : "right" : dy > 0 ? "top" : "bottom",
				overlap: 0
			},
			toi: tEnter
		};
	}
	/**
	* Resolves every registered `solid(A, B)` pair, then fires each registered `on(A, B)`
	* callback for every overlapping live sprite pair this frame. Solids run first so the
	* detection-only handlers see settled positions.
	*
	* The solid solve is a relaxation: up to `solverIterations` passes, so a push that drives
	* one body into a third resolves down the chain within the frame, with an early-out once a
	* pass moves nothing. Pair callbacks fire on the first pass only (one report per frame).
	* A finishing pass then re-resolves contacts against immovable bodies, so a dynamic body
	* never ends the frame inside a static/kinematic sprite — any unavoidable residue is left
	* between dynamics, where the next frames relax it.
	* Driven by `Scene.update()`; call manually only if you manage the update loop yourself.
	* @internal
	*/
	checkOverlaps() {
		this._debugHash = null;
		const solids = this.scene._solids;
		if (solids.length) {
			const iters = Math.max(1, this.solverIterations | 0);
			for (let it = 0; it < iters; it++) {
				this._solverMoved = false;
				const first = it === 0;
				for (const reg of solids) {
					const fn = first ? reg.cb : void 0;
					this.checkPairs(reg.a, reg.b, (a, b, c) => {
						this.solveContact(a, b, c, first);
						if (fn) fn(a, b, this.scene);
					}, first);
				}
				if (!this._solverMoved) break;
			}
			for (const reg of solids) this.checkPairs(reg.a, reg.b, (a, b, c) => {
				if (a.body === "dynamic" && b.body === "dynamic") return;
				this.solveContact(a, b, c, false, true);
			}, false);
		}
		for (const reg of this.scene._hits) {
			const fn = reg.cb;
			this.checkPairs(reg.a, reg.b, (a, b, c) => fn(a, b, c));
		}
	}
	/**
	* Resolves one solid contact between two sprites, honouring their `body` types:
	* separates the pair along the minimal-penetration axis (dynamic↔dynamic split the push
	* 50/50; a dynamic takes the full push off a static/kinematic), resolves the velocity
	* along that axis (inelastic stop, or a rebound scaled by `bounce`), sets the `touching`
	* flags for both sides of the contact, and carries a rider standing on a kinematic body
	* by the platform's frame delta. Separation is propagated through solid-paired bodies in
	* the way, so the solver can never bury bodies in each other — a push the receiving side
	* can't absorb is handed back, and a kinematic whose push is refused (a chain jammed
	* against a wall) YIELDS by the remainder instead of crushing. Pairs containing a
	* `sensor` — and immovable-vs-immovable pairs — get no response. Called by
	* `checkOverlaps` for each touching `solid(A, B)` pair; call directly only for a
	* hand-rolled contact.
	*/
	solveContact(a, b, contact, carry = true, force = false) {
		if (a.body === "sensor" || b.body === "sensor") return;
		const aMoves = a.body === "dynamic";
		const bMoves = b.body === "dynamic";
		if (!aMoves && !bMoves) return;
		const overlap = contact.overlap ?? 0;
		const vertical = contact.side === "top" || contact.side === "bottom";
		const n = contact.side === "left" || contact.side === "top" ? -1 : 1;
		if (aMoves && bMoves) {
			const gotA = this.nudge(a, vertical, n * overlap / 2);
			const gotB = this.nudge(b, vertical, gotA - n * overlap);
			const leftover = gotA - n * overlap - gotB;
			if (leftover !== 0) this.nudge(a, vertical, -leftover);
		} else if (aMoves) {
			const gotA = this.nudge(a, vertical, n * overlap, 0, force);
			const leftover = n * overlap - gotA;
			if (leftover !== 0 && b.body === "kinematic") this.nudge(b, vertical, -leftover);
		} else {
			const gotB = this.nudge(b, vertical, -n * overlap, 0, force);
			const leftover = -n * overlap - gotB;
			if (leftover !== 0 && a.body === "kinematic") this.nudge(a, vertical, -leftover);
		}
		if (contact.side === "top") {
			a.touching.down = true;
			b.touching.up = true;
		} else if (contact.side === "bottom") {
			a.touching.up = true;
			b.touching.down = true;
		} else if (contact.side === "left") {
			a.touching.right = true;
			b.touching.left = true;
		} else {
			a.touching.left = true;
			b.touching.right = true;
		}
		const va = vertical ? a.vel.y : a.vel.x;
		const vb = vertical ? b.vel.y : b.vel.x;
		const rel = va - vb;
		const closing = rel * n < 0;
		if (closing) if (aMoves && bMoves) {
			const slow = Math.abs(rel) < Math.max(a.minBounceVelocity, b.minBounceVelocity);
			const vm = (va + vb) / 2;
			const nva = slow ? vm : vm + (vm - va) * a.bounce;
			const nvb = slow ? vm : vm + (vm - vb) * b.bounce;
			if (vertical) {
				a.vel.y = nva;
				b.vel.y = nvb;
			} else {
				a.vel.x = nva;
				b.vel.x = nvb;
			}
		} else {
			const d = aMoves ? a : b;
			const vd = aMoves ? va : vb;
			const vo = aMoves ? vb : va;
			const nv = d.bounce > 0 && Math.abs(rel) > d.minBounceVelocity ? vo - (vd - vo) * d.bounce : vo;
			if (vertical) d.vel.y = nv;
			else d.vel.x = nv;
		}
		if (vertical && closing) {
			if (contact.side === "top" && aMoves && a.vel.y >= b.vel.y) {
				if (carry && b.body === "kinematic") this.nudge(a, false, b.x - b.last.x);
			} else if (contact.side === "bottom" && bMoves && b.vel.y <= a.vel.y) {
				if (carry && a.body === "kinematic") this.nudge(b, false, a.x - a.last.x);
			}
		}
	}
	/**
	* @internal Move one body by a separation delta along one axis, clipped by the world and
	* propagated through whatever stands in the way: solid tiles stop it dead; a static or
	* kinematic sprite in the path is a hard wall; a dynamic sprite in the path is pushed
	* ahead (recursively, itself clipped), and `s` only advances as far as that body actually
	* made room — so a push into a chain that ends at a wall is absorbed by the chain, never
	* painted over it. Only sprites that share a registered `solid()` pair with `s` take part.
	*
	* `force` is the escape-from-an-immovable mode (the finishing pass): tiles and static
	* sprites still clamp, but dynamics in the path are pushed best-effort and NEVER block
	* the move, and a kinematic in the path is shoved aside like a dynamic (walls outrank
	* platforms) — so a body stuck inside a wall always gets out, at worst overlapping
	* something movable. Returns the movement actually achieved (0 = fully blocked) and
	* flags the relaxation loop when anything moved.
	*/
	nudge(s, vertical, delta, depth = 0, force = false) {
		if (delta === 0 || depth > 8) return 0;
		const res = this.scene.collisionMap.trace(s.x, s.y, vertical ? 0 : delta, vertical ? delta : 0, s.w, s.h);
		const tileAllowed = vertical ? res.position.y - s.y : res.position.x - s.x;
		const dir = delta > 0 ? 1 : -1;
		let allowed = Math.abs(tileAllowed);
		if (allowed > 0) {
			const blockers = this.blockersInPath(s, vertical, dir, allowed);
			for (let i = 0; i < blockers.length && allowed > 0; i++) {
				const { o, d } = blockers[i];
				if (d >= allowed) break;
				if (o.body === "static" || o.body === "kinematic" && !force) allowed = d;
				else {
					const pushed = Math.abs(this.nudge(o, vertical, dir * (allowed - d), depth + 1));
					if (!force) allowed = Math.min(allowed, d + pushed);
				}
			}
		}
		const got = dir * allowed;
		if (got !== 0) {
			if (vertical) s.y += got;
			else s.x += got;
			this._solverMoved = true;
		}
		return got;
	}
	/**
	* @internal The solid-paired bodies lying in `s`'s one-axis path, nearest first.
	* `d` is the free distance (world units, ≥ 0) before `s` touches that body — `0` when
	* already flush or overlapping on the far side. Bodies behind `s`, sensors, `'none'`
	* bodies, and sprites with no registered `solid()` pair against `s` are ignored.
	*/
	blockersInPath(s, vertical, dir, dist) {
		const out = [];
		const sl = s.x, st = s.y, sr = sl + s.w, sb = st + s.h;
		const sprites = this.scene.sprites;
		for (let i = 0; i < sprites.length; i++) {
			const o = sprites[i];
			if (o === s || o.dead || o.body === "sensor" || o.body === "none") continue;
			if (!this.sharesSolidPair(s, o)) continue;
			const ol = o.x, ot = o.y, or = ol + o.w, ob = ot + o.h;
			let d;
			if (vertical) {
				if (or <= sl || ol >= sr) continue;
				if (dir > 0) if (ot >= sb) d = ot - sb;
				else if (ob > st && ot + ob > st + sb) d = 0;
				else continue;
				else if (ob <= st) d = st - ob;
				else if (ot < sb && ot + ob < st + sb) d = 0;
				else continue;
			} else {
				if (ob <= st || ot >= sb) continue;
				if (dir > 0) if (ol >= sr) d = ol - sr;
				else if (or > sl && ol + or > sl + sr) d = 0;
				else continue;
				else if (or <= sl) d = sl - or;
				else if (ol < sr && ol + or < sl + sr) d = 0;
				else continue;
			}
			if (d < dist) out.push({
				o,
				d
			});
		}
		out.sort((p, q) => p.d - q.d);
		return out;
	}
	/** @internal True when some registered `solid(A, B)` pair covers these two sprites (either order). */
	sharesSolidPair(x, y) {
		const solids = this.scene._solids;
		for (let i = 0; i < solids.length; i++) {
			const reg = solids[i];
			if (x instanceof reg.a && y instanceof reg.b || x instanceof reg.b && y instanceof reg.a) return true;
		}
		return false;
	}
	/**
	* One registered pair's scan: collects the live instances of each class, picks the
	* broad-phase (brute force or spatial hash, with the CCD sweep for fast movers), and
	* calls `onHit(a, b, contact)` for every contacting pair. `allowCcd: false` skips the
	* swept path (used by the solver's relaxation passes — the frame's motion was already
	* swept on the first pass).
	* @internal
	*/
	checkPairs(A, B, onHit, allowCcd = true) {
		const sprites = this.scene.sprites;
		const self = A === B;
		const a = [];
		const b = [];
		for (let i = 0; i < sprites.length; i++) {
			const s = sprites[i];
			if (s.dead) continue;
			if (s instanceof A) a.push(s);
			if (!self && s instanceof B) b.push(s);
		}
		const ccd = allowCcd && this.continuous && (anyFast(a) || !self && anyFast(b));
		const pairs = self ? a.length * (a.length - 1) / 2 : a.length * b.length;
		if (pairs > HASH_MIN_PAIRS) this.checkOverlapsHashed(a, self ? a : b, self, ccd, onHit, pairs);
		else if (self) for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) {
			if (a[i].dead || a[j].dead) continue;
			if (Physics.touches(a[i], a[j])) onHit(a[i], a[j], Physics.contactBetween(a[i], a[j]));
			else if (ccd) this.sweepPair(a[i], a[j], onHit);
		}
		else for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) {
			if (a[i].dead || b[j].dead) continue;
			if (Physics.touches(a[i], b[j])) onHit(a[i], b[j], Physics.contactBetween(a[i], b[j]));
			else if (ccd) this.sweepPair(a[i], b[j], onHit);
		}
	}
	/**
	* Broad-phase overlap pass via a {@link SpatialHash}. Buckets the target list `b`
	* into a grid, then for each `a` only narrow-phase-tests the sprites sharing its
	* (swept) cells — the same result as the brute-force scan, but skipping the
	* far-apart pairs. Boxes are swept (union of last→current) so a fast mover's path
	* is bucketed too, keeping CCD correct. `self` handles the `on(A, A)` case (one
	* list, each unordered pair tested once).
	* @internal
	*/
	checkOverlapsHashed(a, b, self, ccd, onHit, brutePairs) {
		const cell = this.hashCellSize ?? autoCellSize(a, self ? null : b);
		const hash = new SpatialHash(cell);
		for (let i = 0; i < b.length; i++) {
			sweptBox(b[i]);
			hash.insert(b[i], _box.l, _box.t, _box.r, _box.b);
		}
		const index = self ? indexMap(a) : null;
		const seen = /* @__PURE__ */ new Set();
		let narrow = 0;
		for (let i = 0; i < a.length; i++) {
			const ai = a[i];
			if (ai.dead) continue;
			seen.clear();
			if (self) seen.add(ai);
			const ti = self ? i : 0;
			sweptBox(ai);
			hash.query(_box.l, _box.t, _box.r, _box.b, seen, (bj) => {
				if (ai.dead || bj.dead) return;
				if (self && index.get(bj) < ti) return;
				narrow++;
				if (Physics.touches(ai, bj)) onHit(ai, bj, Physics.contactBetween(ai, bj));
				else if (ccd) this.sweepPair(ai, bj, onHit);
			});
		}
		this._debugHash = {
			cellSize: cell,
			cells: hash.cells,
			narrow,
			brute: brutePairs
		};
	}
	/**
	* Swept fallback for one discrete-miss pair: if either body moved fast and the
	* sweep finds a crossing this frame, snap `a` to the moment of impact (so a
	* `reflect()`/`kill()` handler acts at the contact point, not past it) and fire
	* the handler. Note: with several targets in one frame's path, `a` snaps to the
	* first one tested rather than the nearest — fine for the usual one-wall case.
	* @internal
	*/
	sweepPair(a, b, onHit) {
		if (!Physics.movedFast(a) && !Physics.movedFast(b)) return;
		const hit = Physics.sweptContact(a, b);
		if (!hit) return;
		a.x = a.last.x + hit.toi * (a.x - a.last.x);
		a.y = a.last.y + hit.toi * (a.y - a.last.y);
		onHit(a, b, hit.contact);
	}
};
/** @internal True when any sprite in the list moved more than half its hitbox this frame. */
function anyFast(list) {
	for (let i = 0; i < list.length; i++) if (Physics.movedFast(list[i])) return true;
	return false;
}
/** @internal Writes `s`'s swept broad-phase AABB (current box unioned with last-frame's) into `_box`. */
function sweptBox(s) {
	const l = s.x, t = s.y, w = s.w, h = s.h;
	const ddx = s.last.x - s.x;
	const ddy = s.last.y - s.y;
	_box.l = ddx < 0 ? l + ddx : l;
	_box.r = ddx > 0 ? l + w + ddx : l + w;
	_box.t = ddy < 0 ? t + ddy : t;
	_box.b = ddy > 0 ? t + h + ddy : t + h;
}
/** @internal Auto grid cell size: the average sprite box dimension, clamped to a sane range. */
function autoCellSize(a, b) {
	let sum = 0, n = 0;
	for (let i = 0; i < a.length; i++) {
		sum += (a[i].w + a[i].h) * .5;
		n++;
	}
	if (b) for (let i = 0; i < b.length; i++) {
		sum += (b[i].w + b[i].h) * .5;
		n++;
	}
	const avg = n ? sum / n : 32;
	return Math.min(2048, Math.max(16, Math.round(avg)));
}
/** @internal Maps each sprite to its list index (for the self-pair `i < j` ordering check). */
function indexMap(list) {
	const m = /* @__PURE__ */ new Map();
	for (let i = 0; i < list.length; i++) m.set(list[i], i);
	return m;
}
/**
* @internal Uniform-grid spatial hash for broad-phase sprite-overlap queries.
* (Lives inside physics.ts until it earns its own module in the v2 port.)
*
* Each sprite is bucketed into every grid cell its (swept) AABB covers. A query
* then only tests sprites sharing a cell with the query box, instead of scanning
* the whole world — turning `Physics.checkOverlaps`'s O(n²) all-pairs scan into
* roughly O(n) for evenly-spread scenes, which is the whole win on big worlds.
*
* Built fresh each frame by `Physics.checkOverlaps` (only on large scenes) and
* thrown away after that frame's queries; it holds no cross-frame state.
*/
var SpatialHash = class SpatialHash {
	/** Grid cell edge length in world units. */
	cellSize;
	inv;
	buckets = /* @__PURE__ */ new Map();
	/**
	* Occupied cells recorded by `insert()` — for the debug overlay. Keyed by the
	* packed cell key; each value carries the cell's grid coords and how many
	* sprite-boxes landed in it (its density).
	*/
	cells = /* @__PURE__ */ new Map();
	constructor(cellSize) {
		this.cellSize = cellSize > 0 ? cellSize : 1;
		this.inv = 1 / this.cellSize;
	}
	/** Pack signed cell coords into one integer key (wraps past ±32768 cells — far beyond any real world). */
	static key(cx, cy) {
		return (cx & 65535) << 16 | cy & 65535;
	}
	/** Insert `s` into every cell its world-space AABB `[l, t, r, b]` overlaps. */
	insert(s, l, t, r, b) {
		const x0 = Math.floor(l * this.inv), x1 = Math.floor(r * this.inv);
		const y0 = Math.floor(t * this.inv), y1 = Math.floor(b * this.inv);
		for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
			const k = SpatialHash.key(cx, cy);
			const bucket = this.buckets.get(k);
			if (bucket) bucket.push(s);
			else this.buckets.set(k, [s]);
			const cell = this.cells.get(k);
			if (cell) cell.count++;
			else this.cells.set(k, {
				cx,
				cy,
				count: 1
			});
		}
	}
	/**
	* Invoke `cb` once per DISTINCT inserted sprite whose cell overlaps `[l, t, r, b]`.
	* `seen` is a scratch set the caller clears before each query (reused across queries
	* so no per-query allocation), guaranteeing a sprite spanning several queried cells
	* is delivered only once.
	*/
	query(l, t, r, b, seen, cb) {
		const x0 = Math.floor(l * this.inv), x1 = Math.floor(r * this.inv);
		const y0 = Math.floor(t * this.inv), y1 = Math.floor(b * this.inv);
		for (let cy = y0; cy <= y1; cy++) for (let cx = x0; cx <= x1; cx++) {
			const bucket = this.buckets.get(SpatialHash.key(cx, cy));
			if (!bucket) continue;
			for (let i = 0; i < bucket.length; i++) {
				const s = bucket[i];
				if (!seen.has(s)) {
					seen.add(s);
					cb(s);
				}
			}
		}
	}
};
//#endregion
//#region src/lib/scene.ts
var Scene = class {
	/** The owning Game — set before setup(). Global services + game.go() live here. */
	game;
	/** This scene's camera: follow a sprite, set bounds, shake(), or write x/y. */
	camera = new Camera();
	/**
	* Typed keyboard + pointer input for this scene. Bind actions with `this.input.bind({...})`,
	* then read `this.input.keys.<name>.held` / `.pressed` in `update()`.
	*/
	input = new SceneInput(this);
	/**
	* The motion + collision system: gravity, worldBounds, effectors, joints, the
	* `solid(A, B)` solve and the `on(A, B)` overlap detection. Configure with
	* `this.physics.gravity = 360` and `this.physics.worldBounds = { x, y, w, h }`.
	*/
	physics = new Physics(this);
	/**
	* Optional full-body physics world (Box2D v3). Assign one from
	* `await Physics2d.create(...)` in `setup()` and the scene steps and syncs it
	* for you each frame. Bound sprites are driven by the simulation; unbound
	* sprites keep using the arcade `physics`. `null` = no full-body physics (the
	* default — nothing is loaded).
	*/
	physics2d = null;
	/** Downward acceleration in world units/s² applied to dynamic bodies (× sprite.gravity). Alias of `physics.gravity`. */
	get gravity() {
		return this.physics.gravity;
	}
	set gravity(v) {
		this.physics.gravity = v;
	}
	sprites = [];
	/** The tile-based static collision map traced by physics. Defaults to the no-op grid (nothing blocks). */
	collisionMap = CollisionGrid.staticNoCollision;
	/** Tilemap layers drawn as the scrolling background (and optional foreground layers). */
	backgroundMaps = [];
	/** Object pool for recycling frequently-spawned sprites — `this.pool.spawn(Bullet, x, y)`. */
	pool = new SpritePool(this);
	/**
	* Object VFX — trails and one-shot bursts, all data: `sprite.vfx =
	* 'flameTrail'`, `this.vfx.burst('shockwave', x, y)`, or a manual
	* `this.vfx.trail(def)` you feed with point(). See vfx.md.
	*/
	vfx = new VfxSystem();
	/** Declarative collision pairs and event listeners, set by the subclass from its `events/` folder. */
	events = [];
	solids = [];
	ons = [];
	/** @internal Solid pairs from `solid(A, B)`, resolved by `Physics.checkOverlaps` before the detection pass. */
	get _solids() {
		return this.solids;
	}
	/** @internal Collision pairs from `on(A, B)`, consumed by `Physics.checkOverlaps`. */
	get _hits() {
		return this.ons;
	}
	_listeners = /* @__PURE__ */ new Map();
	/** Resolves a sprite's default size from its first frame (wired by Game). */
	frameSizer = null;
	/** Wired by Game: the current view rect, for '%' config placement. */
	viewRect = null;
	/** Add a sprite (returns it). Default w/h resolve from its first frame. */
	add(sprite) {
		if (sprite.pct && this.viewRect) {
			const v = this.viewRect();
			if (sprite.pct.x !== void 0) sprite.x = v.x + sprite.pct.x * v.w;
			if (sprite.pct.y !== void 0) sprite.y = v.y + sprite.pct.y * v.h;
			if (sprite.pct.w !== void 0) sprite.w = sprite.pct.w * v.w;
			if (sprite.pct.h !== void 0) sprite.h = sprite.pct.h * v.h;
			sprite.pct = void 0;
		}
		sprite.last.x = sprite.x;
		sprite.last.y = sprite.y;
		if ((sprite.w === 0 || sprite.h === 0) && this.frameSizer) {
			const s = this.frameSizer(sprite.frames + sprite.frame);
			if (sprite.w === 0) sprite.w = s.w;
			if (sprite.h === 0) sprite.h = s.h;
		}
		this.sprites.push(sprite);
		return sprite;
	}
	/** Declare that instances of A and B can never overlap (walls, floors, crates).
	*  Pass `cb` to also react to each resolved contact (damage, sound, …). */
	solid(a, b, cb) {
		this.solids.push({
			a,
			b,
			cb
		});
	}
	on(aOrName, bOrFn, cb) {
		if (typeof aOrName === "string") {
			const fn = bOrFn;
			const ls = this._listeners.get(aOrName);
			if (ls) ls.push(fn);
			else this._listeners.set(aOrName, [fn]);
			return;
		}
		this.ons.push({
			a: aOrName,
			b: bOrFn,
			cb
		});
	}
	/** Fire a named game event — every listener registered for `name` runs synchronously with the scene and optional payload. */
	emit(name, payload) {
		const ls = this._listeners.get(name);
		if (ls) for (let i = 0; i < ls.length; i++) ls[i](this, payload);
	}
	/**
	* Declare assets to load BEFORE the scene runs — queue them on `load`
	* (`load.image(url)`, `load.json(url)`, `load.audio(url)`…); the engine
	* shows a progress bar while anything genuinely loads, then calls
	* `setup()`. Return a Promise to await custom async work. Skip entirely
	* for procedural (asset-free) scenes. Base is a no-op.
	*/
	preload(_load) {}
	/**
	* Build the scene — called once on transition, with any go() payload.
	* May be async: return a Promise (e.g. `await game.assets.msdfFont(...)`,
	* `await game.world3d(...)`, `await Physics2d.create(...)`) and the engine
	* keeps the loading screen up and awaits it before the scene first renders.
	*/
	setup(_data) {}
	/**
	* Wire the declarative `events` list and pointer→sprite gesture dispatch for this scene
	* (raster calls this after `setup()`, so `this.game` is set).
	* TODO(wire): call from game.go() on the incoming scene, after setup() completes.
	* @internal
	*/
	_activate() {
		this.input.attach();
		for (const reg of this.events) if (reg.kind === "hit") this.on(reg.a, reg.b, (a, b) => reg.fn(a, b, this));
		else if (reg.kind === "solid") this.solid(reg.a, reg.b, reg.fn);
		else this.on(reg.name, reg.fn);
	}
	/**
	* Tear down the scene when a transition replaces it: removes every pointer/gesture/text
	* subscription this scene registered on the game's input (scene-wide `on*` handlers and the
	* internal sprite-dispatch hooks), so handlers from dead scenes never fire again.
	* TODO(wire): call from game.go() on the outgoing scene, before the new one is built. Idempotent.
	* @internal
	*/
	_deactivate() {
		this.input.detach();
	}
	/** Screen-space UI — called every frame with the HUD draw surface. */
	drawHud(_d) {}
	/** Audio service — play synth SFX with `this.sound.play('hit')` or music with `this.sound.music(url)`. */
	get sound() {
		return this.game.sound;
	}
	/** Tween service — animate any object property, e.g. `this.tween.to(sprite, { x: 200 }, { duration: 0.4 })`. */
	get tween() {
		return this.game.tween;
	}
	/** All live sprites that are instances of `type`. */
	getSpritesByType(type) {
		const out = [];
		for (const s of this.sprites) if (s instanceof type && !s.dead) out.push(s);
		return out;
	}
	/** A world X at fraction f across this frame's view (0 = left, 1 = right). */
	vw(f) {
		const v = this.viewRect?.();
		return v ? v.x + f * v.w : 0;
	}
	/** A world Y at fraction f down this frame's view (0 = top, 1 = bottom). */
	vh(f) {
		const v = this.viewRect?.();
		return v ? v.y + f * v.h : 0;
	}
	/** This frame's view width in world units. */
	get width() {
		return this.viewRect?.().w ?? 0;
	}
	/** This frame's view height in world units. */
	get height() {
		return this.viewRect?.().h ?? 0;
	}
	/** Horizontal centre of the view (world X). */
	get centerX() {
		return this.vw(.5);
	}
	/** Vertical centre of the view (world Y). */
	get centerY() {
		return this.vh(.5);
	}
	/** Transition to the scene registered as 'intro'. */
	gotoIntro(data) {
		this.game.go("intro", data);
	}
	/** Transition to the scene registered as 'title' (built-in fallback exists). */
	gotoTitle(data) {
		this.game.go("title", data);
	}
	/** Transition to the scene registered as 'play'. */
	gotoPlay(data) {
		this.game.go("play", data);
	}
	/** Transition to 'gameOver' — pass a result, e.g. { win: true, score } (built-in fallback exists). */
	gotoGameOver(result) {
		this.game.go("gameOver", result);
	}
	/** One update: behaviour → motion (physics) → joints → solids → overlaps → sweep dead. */
	update(dt) {
		for (const m of this.backgroundMaps) m.update(dt);
		for (const s of this.sprites) {
			if (s.body === "none") s.touching.up = s.touching.down = s.touching.left = s.touching.right = false;
			s.update(dt);
			s.stepAnim(dt);
			const fx = s.fx;
			if (fx) {
				if (fx.flash?.duration !== void 0) {
					fx.flash._left = (fx.flash._left ?? fx.flash.duration) - dt;
					if (fx.flash._left <= 0) delete fx.flash;
				}
				if (fx.shake?.duration !== void 0) {
					fx.shake._left = (fx.shake._left ?? fx.shake.duration) - dt;
					if (fx.shake._left <= 0) delete fx.shake;
				}
				if (fx.squash) {
					fx.squash._t = (fx.squash._t ?? 0) + dt;
					if (fx.squash.cycles && fx.squash._t * (fx.squash.speed ?? 2) >= fx.squash.cycles) delete fx.squash;
				}
				if (Object.keys(fx).length === 0) s.fx = void 0;
			}
		}
		for (const s of this.sprites) {
			if (s.body === "none") {
				s.last.x = s.x;
				s.last.y = s.y;
				continue;
			}
			this.physics.updateBody(s, dt);
		}
		this.physics2d?.update(dt);
		this.physics.updateJoints(dt);
		this.physics.checkOverlaps();
		this.vfx.particles = this.game?.fx ?? null;
		for (const s of this.sprites) if (s.vfx && !s.dead) this.vfx.feed(s, s.vfx);
		this.vfx.update(dt);
		for (let i = this.sprites.length - 1; i >= 0; i--) if (this.sprites[i].dead) {
			const [s] = this.sprites.splice(i, 1);
			this.pool.tryReturn(s);
		}
	}
	/**
	* Push the frame: background tilemaps → every sprite (scene order = paint order
	* unless z set) → foreground tilemaps. Raster's layer order preserved: maps draw
	* in `backgroundMaps` order, breaking to the sprite pass at the first
	* `foreground` map, which draws (with the rest) after the sprites.
	*/
	draw(d) {
		const view = this.viewRect?.() ?? {
			x: 0,
			y: 0,
			w: 0,
			h: 0
		};
		let mapIndex = 0;
		for (; mapIndex < this.backgroundMaps.length; mapIndex++) {
			const map = this.backgroundMaps[mapIndex];
			if (map.foreground) break;
			map.draw(d, view);
		}
		this.vfx.drawUnder(d);
		for (const s of this.sprites) d.sprite(s.drawFrame, s.x, s.y, {
			w: s.w,
			h: s.h,
			rot: s.rot,
			flipX: s.flipX,
			tint: s.tint,
			alpha: s.alpha,
			z: s.z,
			blend: s.blend,
			fx: s.fx,
			uvRepeat: s.uvRepeat,
			uvScroll: s.uvScroll,
			deform: s.deform
		});
		for (; mapIndex < this.backgroundMaps.length; mapIndex++) this.backgroundMaps[mapIndex].draw(d, view);
		this.vfx.drawOver(d);
	}
};
/**
* Separate two overlapping AABBs along the axis of least penetration.
* static/none bodies never move; two dynamics split the correction.
* Exported for tests.
*/
function separate(a, b) {
	const px = Math.min(a.x + a.w - b.x, b.x + b.w - a.x);
	const py = Math.min(a.y + a.h - b.y, b.y + b.h - a.y);
	if (px <= 0 || py <= 0) return;
	const aMoves = a.body === "dynamic";
	const bMoves = b.body === "dynamic";
	if (!aMoves && !bMoves) return;
	const share = aMoves && bMoves ? .5 : 1;
	if (px < py) {
		const dir = a.centerX < b.centerX ? -1 : 1;
		if (aMoves) {
			a.x += dir * px * share;
			if (dir < 0) a.touching.right = true;
			else a.touching.left = true;
			if (a.vel.x * dir < 0) a.vel.x = -a.vel.x * a.bounce || 0;
		}
		if (bMoves) {
			b.x -= dir * px * share;
			if (dir < 0) b.touching.left = true;
			else b.touching.right = true;
			if (b.vel.x * dir > 0) b.vel.x = -b.vel.x * b.bounce || 0;
		}
	} else {
		const dir = a.centerY < b.centerY ? -1 : 1;
		if (aMoves) {
			a.y += dir * py * share;
			if (dir < 0) a.touching.down = true;
			else a.touching.up = true;
			if (a.vel.y * dir < 0) a.vel.y = -a.vel.y * a.bounce || 0;
		}
		if (bMoves) {
			b.y -= dir * py * share;
			if (dir < 0) b.touching.up = true;
			else b.touching.down = true;
			if (b.vel.y * dir > 0) b.vel.y = -b.vel.y * b.bounce || 0;
		}
	}
}
//#endregion
//#region src/lib/defaults.ts
/** Fallback title: "PRESS SPACE TO START" → 'play'. Register your own `title` to replace. */
var DefaultTitle = class extends Scene {
	font;
	setup() {
		this.font = this.game.assets.font({ font: "bold 26px monospace" });
	}
	update(dt) {
		super.update(dt);
		if (this.game.input.keyPressed("Space", "Enter")) this.gotoPlay();
	}
	drawHud(d) {
		d.text(this.font, "PRESS SPACE TO START", this.game.view.w / 2, this.game.view.h / 2 - 13, {
			align: "center",
			color: "#e6e9f5"
		});
	}
};
/** Fallback game-over: "YOU WIN!" / "GAME OVER" (from `{ win }` in the payload) → 'title'. */
var DefaultGameOver = class extends Scene {
	font;
	won = false;
	setup(data) {
		this.won = !!data?.win;
		this.font = this.game.assets.font({ font: "bold 26px monospace" });
	}
	update(dt) {
		super.update(dt);
		if (this.game.input.keyPressed("Space", "Enter")) this.gotoTitle();
	}
	drawHud(d) {
		const cx = this.game.view.w / 2, cy = this.game.view.h / 2;
		d.text(this.font, this.won ? "YOU WIN!" : "GAME OVER", cx, cy - 30, {
			align: "center",
			color: "#e6e9f5"
		});
		d.text(this.font, "PRESS SPACE", cx, cy + 8, {
			align: "center",
			scale: .6,
			color: "#8a93b5"
		});
	}
};
//#endregion
//#region src/lib/font.ts
var ASCII = (() => {
	let s = "";
	for (let c = 33; c <= 126; c++) s += String.fromCharCode(c);
	return s;
})();
/** A baked glyph set. Pure data after baking — measure() is headless math. */
var BitmapFont = class {
	glyphs;
	lineHeight;
	spaceAdvance;
	constructor(glyphs, lineHeight, spaceAdvance) {
		this.glyphs = glyphs;
		this.lineHeight = lineHeight;
		this.spaceAdvance = spaceAdvance;
	}
	/** Rendered width of a single line, in world units. */
	measure(text, scale = 1) {
		let w = 0;
		for (const ch of text) w += (this.glyphs.get(ch)?.advance ?? this.spaceAdvance) * scale;
		return w;
	}
};
/** Rasterize a charset into white glyphs on the atlas (called by game.assets.font()). */
function bakeFont(atlas, opts = {}) {
	const font = opts.font ?? "bold 16px monospace";
	const charset = opts.charset ?? ASCII;
	const probe = document.createElement("canvas").getContext("2d");
	probe.font = font;
	const pm = probe.measureText(charset);
	const ascent = Math.ceil(Math.max(pm.actualBoundingBoxAscent || 0, pm.fontBoundingBoxAscent || 0, 8)) + 1;
	const lineHeight = ascent + (Math.ceil(Math.max(pm.actualBoundingBoxDescent || 0, pm.fontBoundingBoxDescent || 0, 2)) + 1) + 2;
	const glyphs = /* @__PURE__ */ new Map();
	for (const ch of charset) {
		const m = probe.measureText(ch);
		const adv = Math.ceil(m.width);
		if (adv <= 0) continue;
		const left = Math.ceil(Math.max(0, m.actualBoundingBoxLeft || 0));
		const right = Math.ceil(Math.max(adv, m.actualBoundingBoxRight || 0));
		const c = document.createElement("canvas");
		c.width = left + right + 2;
		c.height = lineHeight;
		const ctx = c.getContext("2d");
		ctx.font = font;
		ctx.fillStyle = "#ffffff";
		ctx.textBaseline = "alphabetic";
		ctx.fillText(ch, 1 + left, ascent);
		const frame = atlas.add(c);
		glyphs.set(ch, {
			frame,
			w: c.width,
			h: c.height,
			advance: adv + 1
		});
	}
	return new BitmapFont(glyphs, lineHeight, Math.max(2, Math.ceil(probe.measureText(" ").width)));
}
//#endregion
//#region src/lib/lights2d.ts
var FLOATS$2 = 16;
var SOFT_DISK = (() => {
	const N = 12, out = [];
	const golden = Math.PI * (3 - Math.sqrt(5));
	for (let k = 0; k < N; k++) {
		const r = Math.sqrt((k + .5) / N);
		const a = k * golden;
		out.push([Math.cos(a) * r, Math.sin(a) * r]);
	}
	return out;
})();
var HARD_SAMPLE = [[0, 0]];
var wgsl = `
struct U { view: vec4f }                 // world rect mapped to the canvas: x, y, w, h
struct Inst { tri: vec4f, triC: vec4f, params: vec4f, color: vec4f }
// tri   = ax, ay, bx, by            triC = cx, cy, lightX, lightY
// params = radius, intensity, coneCos, coneDir       color = r, g, b, falloffPow
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec2f,
  @location(1) light: vec2f,
  @location(2) params: vec4f,
  @location(3) color: vec4f,
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  var p = d.triC.xy;                      // vertex 2 = the light centre
  if (vi == 0u) { p = d.tri.xy; }         // vertex 0 = A
  else if (vi == 1u) { p = d.tri.zw; }    // vertex 1 = B
  let ndc = (p - u.view.xy) / u.view.zw * 2.0 - 1.0;
  var o: VSOut;
  o.pos = vec4f(ndc.x, -ndc.y, 0.0, 1.0);
  o.world = p;
  o.light = d.triC.zw;
  o.params = d.params;
  o.color = d.color;
  return o;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let dist = distance(in.world, in.light);
  let radius = in.params.x;
  var atten = clamp(1.0 - dist / radius, 0.0, 1.0);
  atten = pow(atten, max(in.color.w, 0.25));
  let coneCos = in.params.z;
  if (coneCos > -1.5) {                   // spot: fade outside the cone
    let da = atan2(in.world.y - in.light.y, in.world.x - in.light.x) - in.params.w;
    let cd = cos(da);
    atten = atten * smoothstep(coneCos, mix(coneCos, 1.0, 0.15), cd);
  }
  let b = atten * in.params.y;
  return vec4f(in.color.rgb * b, b);      // premultiplied — additive one/one
}
`;
var ambientWgsl = `
struct A { color: vec4f }
@group(0) @binding(0) var<uniform> a: A;
@vertex
fn vs(@builtin(vertex_index) vi: u32) -> @builtin(position) vec4f {
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  return vec4f(p[vi], 0.0, 1.0);
}
@fragment
fn fs() -> @location(0) vec4f { return a.color; }
`;
/**
* The 2D light layer. Add occluders (scenery) + lights, update them each frame,
* and the layer draws additive, shadowed, colour-mixing lights over the scene.
* Reach it from a `Game` as `game.lights2d` (created on first use).
*
* ```ts
* const lights = game.lights2d;
* lights.occluders.addRect(x, y, w, h);            // scenery casts shadow
* const torch = lights.point(300, 200, { radius: 260, color: [1, 0.7, 0.35], flicker: 0.4 });
* const lamp  = lights.spot(500, 120, { radius: 400, dir: Math.PI / 2, cone: 0.8, color: [0.6, 0.8, 1] });
* // each frame just mutate torch.x / torch.y / … ; draw a dark overlay first for atmosphere.
* ```
*/
var Lights2d = class {
	format;
	/** Scenery that casts shadows — add rects / segments / polys to it. */
	occluders = new Visibility2d();
	/** The active lights (mutate freely; `point()`/`spot()` append here). */
	lights = [];
	/** Ambient (base) light colour, `[r,g,b]` 0..1 — the scene is multiplied down
	*  to this before the lights add, so unlit surfaces show DIMLY instead of pure
	*  black. `[1,1,1]` (default) = no ambient darkening; `[0,0,0]` = black unlit;
	*  `[0.12,0.12,0.16]` = a dim blue night. Tint it warm/cool for mood. */
	ambient = [
		1,
		1,
		1
	];
	data;
	count = 0;
	capacity = 4096;
	time = 0;
	uniformData = /* @__PURE__ */ new Float32Array(4);
	vx = 0;
	vy = 0;
	vw = 0;
	vh = 0;
	underTris = 0;
	/** Lights drawn last frame after culling — for HUD/debug. */
	visible = 0;
	/** Of those, how many cast shadows (the expensive ones) — for HUD/debug. */
	visibleShadow = 0;
	device;
	pipeline;
	layout;
	uniforms;
	instances;
	bind;
	ambientPipeline;
	ambientUniform;
	ambientBind;
	ambientData = /* @__PURE__ */ new Float32Array(4);
	constructor(device, format) {
		this.format = format;
		this.data = new Float32Array(this.capacity * FLOATS$2);
		this.rebuild(device);
	}
	/** (Re)create every GPU object — the device-loss recovery path. */
	rebuild(device) {
		this.device = device;
		this.layout = device.createBindGroupLayout({ entries: [{
			binding: 0,
			visibility: BITS.STAGE_VERTEX,
			buffer: { type: "uniform" }
		}, {
			binding: 1,
			visibility: BITS.STAGE_VERTEX,
			buffer: { type: "read-only-storage" }
		}] });
		const module = device.createShaderModule({ code: wgsl });
		module.getCompilationInfo().then((info) => {
			for (const m of info.messages) if (m.type === "error") console.error(`Lights2d WGSL ${m.lineNum}:${m.linePos} ${m.message}`);
		});
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
							srcFactor: "one",
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
		this.uniforms = device.createBuffer({
			size: 16,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.instances = device.createBuffer({
			size: this.capacity * FLOATS$2 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.makeBind();
		const aLayout = device.createBindGroupLayout({ entries: [{
			binding: 0,
			visibility: BITS.STAGE_FRAGMENT,
			buffer: { type: "uniform" }
		}] });
		const aMod = device.createShaderModule({ code: ambientWgsl });
		aMod.getCompilationInfo().then((info) => {
			for (const m of info.messages) if (m.type === "error") console.error(`Lights2d ambient WGSL ${m.lineNum}:${m.linePos} ${m.message}`);
		});
		this.ambientPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [aLayout] }),
			vertex: {
				module: aMod,
				entryPoint: "vs"
			},
			fragment: {
				module: aMod,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "dst",
							dstFactor: "zero"
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
		this.ambientUniform = device.createBuffer({
			size: 16,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.ambientBind = device.createBindGroup({
			layout: aLayout,
			entries: [{
				binding: 0,
				resource: { buffer: this.ambientUniform }
			}]
		});
	}
	makeBind() {
		this.bind = this.device.createBindGroup({
			layout: this.layout,
			entries: [{
				binding: 0,
				resource: { buffer: this.uniforms }
			}, {
				binding: 1,
				resource: { buffer: this.instances }
			}]
		});
	}
	/** Add a point light; returns its handle (mutate to move / recolour it). */
	point(x, y, opts = {}) {
		const l = {
			type: "point",
			x,
			y,
			radius: opts.radius ?? 240,
			intensity: opts.intensity ?? 1,
			color: opts.color ?? [
				1,
				1,
				1
			],
			falloff: opts.falloff ?? 2,
			dir: 0,
			cone: 0,
			flicker: opts.flicker ?? 0,
			flickerSpeed: opts.flickerSpeed ?? 1,
			phase: opts.phase ?? 0,
			shadows: opts.shadows ?? false,
			softness: opts.softness ?? 6,
			layer: opts.layer ?? "over",
			on: true
		};
		this.lights.push(l);
		return l;
	}
	/** Add a spot light (a cone). `dir` faces in radians, `cone` is the full angle. */
	spot(x, y, opts = {}) {
		const l = {
			type: "spot",
			x,
			y,
			radius: opts.radius ?? 360,
			intensity: opts.intensity ?? 1,
			color: opts.color ?? [
				1,
				1,
				1
			],
			falloff: opts.falloff ?? 2,
			dir: opts.dir ?? 0,
			cone: opts.cone ?? .9,
			flicker: opts.flicker ?? 0,
			flickerSpeed: opts.flickerSpeed ?? 1,
			phase: opts.phase ?? 0,
			shadows: opts.shadows ?? false,
			softness: opts.softness ?? 6,
			layer: opts.layer ?? "over",
			on: true
		};
		this.lights.push(l);
		return l;
	}
	/** Remove a light. */
	remove(light) {
		const i = this.lights.indexOf(light);
		if (i >= 0) this.lights.splice(i, 1);
	}
	/** Remove all lights. */
	clear() {
		this.lights.length = 0;
	}
	/** Start a frame: map the world rect onto the canvas (same as the batches). */
	begin(viewX, viewY, viewW, viewH, time) {
		this.uniformData[0] = viewX;
		this.uniformData[1] = viewY;
		this.uniformData[2] = viewW;
		this.uniformData[3] = viewH;
		this.vx = viewX;
		this.vy = viewY;
		this.vw = viewW;
		this.vh = viewH;
		this.time = time;
		this.occluders.setBounds(viewX, viewY, viewW, viewH);
		this.count = 0;
	}
	flicker(l) {
		if (l.flicker <= 0) return 1;
		const t = this.time * l.flickerSpeed;
		const n = .5 + .5 * (Math.sin(t * 11.3 + l.phase) * .6 + Math.sin(t * 23.7 + l.phase * 1.7) * .4);
		return 1 - l.flicker * (1 - n);
	}
	pushTri(ax, ay, bx, by, cx, cy, lx, ly, radius, intensity, coneCos, coneDir, col, pow) {
		if (this.count >= this.capacity) this.grow();
		const o = this.count * FLOATS$2, d = this.data;
		d[o] = ax;
		d[o + 1] = ay;
		d[o + 2] = bx;
		d[o + 3] = by;
		d[o + 4] = cx;
		d[o + 5] = cy;
		d[o + 6] = lx;
		d[o + 7] = ly;
		d[o + 8] = radius;
		d[o + 9] = intensity;
		d[o + 10] = coneCos;
		d[o + 11] = coneDir;
		d[o + 12] = col[0];
		d[o + 13] = col[1];
		d[o + 14] = col[2];
		d[o + 15] = pow;
		this.count++;
	}
	grow() {
		this.capacity *= 2;
		const next = new Float32Array(this.capacity * FLOATS$2);
		next.set(this.data);
		this.data = next;
		this.instances.destroy();
		this.instances = this.device.createBuffer({
			size: this.capacity * FLOATS$2 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.makeBind();
	}
	/** @internal Cull + tessellate one light — a plain radial QUAD (2 triangles)
	*  by default, or the shadowed visibility FAN when it opts in. */
	emitLight(l) {
		if (!l.on || l.radius <= 0) return;
		if (l.x + l.radius < this.vx || l.x - l.radius > this.vx + this.vw || l.y + l.radius < this.vy || l.y - l.radius > this.vy + this.vh) return;
		const intensity = l.intensity * this.flicker(l);
		if (intensity <= .001) return;
		const coneCos = l.type === "spot" ? Math.cos(l.cone * .5) : -2;
		this.visible++;
		if (l.shadows) {
			this.visibleShadow++;
			const samples = l.softness > 0 ? SOFT_DISK : HARD_SAMPLE;
			const sub = intensity / samples.length;
			for (const [ox, oy] of samples) {
				const lx = l.x + ox * l.softness, ly = l.y + oy * l.softness;
				const poly = this.occluders.visibility(lx, ly, l.radius);
				if (poly.length < 2) continue;
				for (let i = 0; i < poly.length; i++) {
					const a = poly[i], b = poly[(i + 1) % poly.length];
					this.pushTri(a.x, a.y, b.x, b.y, lx, ly, lx, ly, l.radius, sub, coneCos, l.dir, l.color, l.falloff);
				}
			}
		} else {
			const r = l.radius;
			const x0 = l.x - r, y0 = l.y - r, x1 = l.x + r, y1 = l.y + r;
			this.pushTri(x0, y0, x1, y0, x0, y1, l.x, l.y, r, intensity, coneCos, l.dir, l.color, l.falloff);
			this.pushTri(x1, y0, x1, y1, x0, y1, l.x, l.y, r, intensity, coneCos, l.dir, l.color, l.falloff);
		}
	}
	/** @internal Emit UNDER-layer lights first (`[0, underTris)`) then OVER-layer
	*  (`[underTris, count)`), so the two draw phases can pick their sub-range. */
	buildAll() {
		this.count = 0;
		this.visible = 0;
		this.visibleShadow = 0;
		for (const l of this.lights) if (l.layer === "under") this.emitLight(l);
		this.underTris = this.count;
		for (const l of this.lights) if (l.layer !== "under") this.emitLight(l);
	}
	/**
	* Draw one compositing PHASE. `'under'` (called before the sprite batches)
	* builds + uploads the whole frame and draws the floor lights; `'over'`
	* (called after the scene) draws the lights that cover the sprites. Between
	* them the game draws its sprites, so `'under'` lights never touch them.
	*/
	draw(pass, phase) {
		if (phase === "under") {
			this.buildAll();
			if (this.count > 0) {
				this.device.queue.writeBuffer(this.uniforms, 0, this.uniformData);
				this.device.queue.writeBuffer(this.instances, 0, this.data.buffer, 0, this.count * FLOATS$2 * 4);
			}
		} else this.drawAmbient(pass);
		const first = phase === "under" ? 0 : this.underTris;
		const num = phase === "under" ? this.underTris : this.count - this.underTris;
		if (num <= 0) return;
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		pass.draw(3, num, 0, first);
	}
	/** @internal Multiply the scene down to the ambient colour (skipped when the
	*  ambient is white — no darkening). */
	drawAmbient(pass) {
		const [r, g, b] = this.ambient;
		if (r >= .999 && g >= .999 && b >= .999) return;
		this.ambientData[0] = r;
		this.ambientData[1] = g;
		this.ambientData[2] = b;
		this.ambientData[3] = 1;
		this.device.queue.writeBuffer(this.ambientUniform, 0, this.ambientData);
		pass.setPipeline(this.ambientPipeline);
		pass.setBindGroup(0, this.ambientBind);
		pass.draw(3);
	}
};
//#endregion
//#region src/lib/gridbatch.ts
var BUILTIN_ID = {
	wave: 1,
	sway: 2,
	flip: 3,
	jelly: 4
};
var CUSTOM_BASE = 16;
/** The flip deformer's facing for frame-swapping: > 0 front, < 0 back (mirrored). */
function facing(d, time) {
	return Math.cos((d.phase ?? 0) + (d.speed ?? 0) * time * Math.PI * 2);
}
var SEGS = 24;
var VERTS = SEGS * SEGS * 6;
var FLOATS$1 = 20;
/** Pure WGSL assembly (headless-testable): built-in kinds + spliced customs. */
function buildGridWGSL(blocky, customs = []) {
	return `
const BLOCKY = ${blocky};
const SEGS = ${SEGS}.0;
const TAU = 6.28318530718;
struct U { view: vec4f, time: vec4f }
struct Inst { posSize: vec4f, misc: vec4f, color: vec4f, uv: vec4f, deform: vec4f }
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) t01: vec2f,
  @location(1) color: vec4f,
  @location(2) uvRect: vec4f,
  @location(3) shade: f32,
  @location(4) dmeta: vec3f,  // t (anim clock), amount, kind — for fragment snippets
}

@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var tex: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  // cell + corner from the flat index; offsets packed as bit tables.
  let corner = vi % 6u;
  let cell = vi / 6u;
  let cx = f32(cell % ${SEGS}u);
  let cy = f32(cell / ${SEGS}u);
  let o = vec2f(f32((0x1Au >> corner) & 1u), f32((0x34u >> corner) & 1u));
  let uvn = vec2f((cx + o.x) / SEGS, (cy + o.y) / SEGS);   // 0..1 across the sprite

  let size = d.posSize.zw;
  let kind = u32(d.misc.y);
  let amount = d.deform.x;
  let t = d.deform.z + d.deform.y * u.time.x * TAU;        // phase + speed·time
  var p = (uvn - 0.5) * size;                              // centred, world units
  var shade = 1.0;

  if (kind == 1u) {                                        // wave — cloth ripple
    let k = uvn.x;                                         // anchored left edge
    let ph = uvn.x * 2.5 * TAU * 0.5 - t;
    p.y += sin(ph) * amount * k;
    shade = 1.0 - cos(ph) * 0.22 * k;                      // slope-lit folds
  } else if (kind == 2u) {                                 // sway — pendulum bend
    let k = 1.0 - uvn.y;                                   // anchored bottom
    p.x += sin(t) * amount * k * k;
  } else if (kind == 3u) {                                 // flip — fake-3D card
    let c = cos(t);
    let s = sin(t);
    p.x = p.x * c;
    p.y = p.y * (1.0 + (uvn.x - 0.5) * s * 0.55);          // perspective taper
    shade = 0.72 + 0.28 * abs(c);                          // edge-on darkening
  } else if (kind == 4u) {                                 // jelly — squash wobble
    let sq = sin(t) * amount;
    p.x *= 1.0 + sq * (1.0 - uvn.y);                       // top wobbles most
    let bottom = 0.5 * size.y;
    p.y = (p.y - bottom) * (1.0 - sq * 0.8) + bottom;      // volume-ish preserve
    p.x += sin(t * 2.0 + uvn.y * TAU * 0.5) * amount * size.x * 0.06 * (1.0 - uvn.y);
  }${customs.map(({ id, def }) => ` else if (kind == ${id}u) {\n${def.code}\n  }`).join("")}

  let sn = sin(d.misc.x);
  let cn = cos(d.misc.x);
  let centre = d.posSize.xy + size * 0.5;
  let world = centre + vec2f(p.x * cn - p.y * sn, p.x * sn + p.y * cn);
  let ndc = (world - u.view.xy) / u.view.zw * 2.0 - 1.0;

  var ux = uvn.x;
  if (d.misc.z > 0.5) { ux = 1.0 - ux; }                   // flipX
  var out: VSOut;
  out.pos = vec4f(ndc.x, -ndc.y, 1.0 - d.misc.w, 1.0);
  out.t01 = vec2f(ux, uvn.y);
  out.uvRect = d.uv;
  out.color = d.color;
  out.shade = shade;
  out.dmeta = vec3f(t, amount, f32(kind));
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  // Same atlas mapping as QuadBatch: un-inset extent, clamped back in.
  let texRes = vec2f(textureDimensions(tex));
  let ht = 0.5 / texRes;
  let lo = in.uvRect.xy - ht;
  let hi = in.uvRect.zw + ht;
  var uv = clamp(vec2f(mix(lo.x, hi.x, in.t01.x), mix(lo.y, hi.y, in.t01.y)), in.uvRect.xy, in.uvRect.zw);
  if (BLOCKY) {
    let cont = in.t01 * (hi - lo) * texRes;
    let dd = max(vec2f(
      length(vec2f(dpdx(cont.x), dpdy(cont.x))),
      length(vec2f(dpdx(cont.y), dpdy(cont.y)))), vec2f(1e-6));
    let tc = uv * texRes;
    let seam = floor(tc + 0.5);
    let snapped = clamp((tc - seam) / dd + seam, seam - 0.5, seam + 0.5);
    uv = clamp(snapped / texRes, in.uvRect.xy, in.uvRect.zw);
  }
  let base = textureSample(tex, samp, uv);
  // Straight-alpha working color — fragment snippets mutate this.
  var color = vec4f(base.rgb * in.color.rgb * in.shade, base.a * in.color.a);
  let tint = in.color;
  let uvn = in.t01;
  let uvRect = in.uvRect;
  let t = in.dmeta.x;
  let amount = in.dmeta.y;
  let shade = in.shade;
  let kind = u32(in.dmeta.z + 0.5);
${customs.filter(({ def }) => def.fragment).map(({ id, def }) => `  if (kind == ${id}u) {\n${def.fragment}\n  }`).join("\n")}
  return vec4f(color.rgb * color.a, color.a);              // premultiplied
}
`;
}
/**
* One pipeline + instance buffer for every deformed sprite this frame.
* Flushed inside the scene pass after the blend batch (alpha, depth-tested,
* push order). All deformation is vertex-stage — no CPU vertex writes.
*/
var GridBatch = class {
	format;
	/** The surface's submission-order log — see batch.ts's DrawOrder. */
	order = null;
	layer = 0;
	uploaded = false;
	/** @internal Take part in a surface's submission order. */
	joinOrder(order) {
		this.order = order;
	}
	/** @see QuadBatch.setLayer */
	setLayer(n) {
		this.layer = n;
	}
	data;
	count = 0;
	capacity;
	blocky;
	filter;
	uniformData = /* @__PURE__ */ new Float32Array(8);
	customs = [];
	kinds = { ...BUILTIN_ID };
	device;
	pipeline;
	layout;
	sampler;
	uniforms;
	instances;
	textureView = null;
	bind = null;
	constructor(device, format, opts = {}) {
		this.format = format;
		this.capacity = opts.capacity ?? 256;
		this.blocky = opts.blocky ?? false;
		this.filter = this.blocky ? "linear" : opts.filter ?? "linear";
		this.data = new Float32Array(this.capacity * FLOATS$1);
		this.rebuild(device);
	}
	/**
	* Register a custom deformer (idempotent by name; re-registering replaces
	* the snippet). Recompiles the one pipeline — do it at load, not per frame.
	*/
	register(def) {
		const existing = this.customs.find((c) => c.def.name === def.name);
		if (existing) existing.def = def;
		else {
			const id = CUSTOM_BASE + this.customs.length;
			this.customs.push({
				id,
				def
			});
			this.kinds[def.name] = id;
		}
		this.makePipeline();
	}
	rebuild(device) {
		this.device = device;
		this.layout = device.createBindGroupLayout({ entries: [
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
				sampler: {}
			},
			{
				binding: 3,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				texture: {}
			}
		] });
		this.makePipeline();
		this.sampler = device.createSampler({
			magFilter: this.filter,
			minFilter: this.filter
		});
		this.uniforms = device.createBuffer({
			size: 32,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.instances = device.createBuffer({
			size: this.capacity * FLOATS$1 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.bind = null;
		this.textureView = null;
	}
	makePipeline() {
		const module = this.device.createShaderModule({ code: buildGridWGSL(this.blocky, this.customs) });
		module.getCompilationInfo().then((info) => {
			for (const m of info.messages) if (m.type === "error") console.error(`GridBatch WGSL ${m.lineNum}:${m.linePos} ${m.message}`);
		});
		this.pipeline = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
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
			primitive: { topology: "triangle-list" }
		});
	}
	setTexture(view) {
		this.textureView = view;
		this.makeBind();
	}
	makeBind() {
		if (!this.textureView) return;
		this.bind = this.device.createBindGroup({
			layout: this.layout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniforms }
				},
				{
					binding: 1,
					resource: { buffer: this.instances }
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
	begin(viewX, viewY, viewW, viewH, time) {
		this.count = 0;
		this.layer = 0;
		this.uploaded = false;
		this.uniformData.set([
			viewX,
			viewY,
			viewW,
			viewH,
			time,
			0,
			0,
			0
		]);
	}
	push(x, y, w, h, frame, rot, flipX, z, deform, r, g, b, a) {
		this.order?.put(7, this.count, this.layer);
		if (this.count === this.capacity) this.grow();
		const o = this.count * FLOATS$1;
		const d = this.data;
		d[o] = x;
		d[o + 1] = y;
		d[o + 2] = w;
		d[o + 3] = h;
		d[o + 4] = rot;
		d[o + 5] = this.kinds[deform.kind] ?? 0;
		d[o + 6] = flipX ? 1 : 0;
		d[o + 7] = z / Z_RANGE;
		d[o + 8] = r;
		d[o + 9] = g;
		d[o + 10] = b;
		d[o + 11] = a;
		d[o + 12] = frame.u0;
		d[o + 13] = frame.v0;
		d[o + 14] = frame.u1;
		d[o + 15] = frame.v1;
		d[o + 16] = deform.amount ?? 8;
		d[o + 17] = deform.speed ?? 1;
		d[o + 18] = deform.phase ?? 0;
		d[o + 19] = 0;
		this.count++;
	}
	grow() {
		this.capacity *= 2;
		const next = new Float32Array(this.capacity * FLOATS$1);
		next.set(this.data);
		this.data = next;
		this.instances.destroy();
		this.instances = this.device.createBuffer({
			size: this.capacity * FLOATS$1 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.makeBind();
	}
	upload() {
		if (this.count === 0 || !this.bind) return false;
		if (!this.uploaded) {
			this.device.queue.writeBuffer(this.uniforms, 0, this.uniformData);
			this.device.queue.writeBuffer(this.instances, 0, this.data.buffer, 0, this.count * FLOATS$1 * 4);
			this.uploaded = true;
		}
		return true;
	}
	/** @internal Draw ONE contiguous span — the submission-order walk's unit. */
	drawRange(pass, first, n) {
		if (n <= 0 || !this.upload()) return;
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		pass.draw(VERTS, n, 0, first);
	}
	flush(pass) {
		if (!this.upload()) return 0;
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		pass.draw(VERTS, this.count);
		return this.count;
	}
};
//#endregion
//#region src/lib/glowpass.ts
var FLOATS = 16;
var STAMP_WGSL = `
struct U { view: vec4f }
struct Inst { posSize: vec4f, misc: vec4f, color: vec4f, uv: vec4f }
struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f, @location(1) color: vec4f }
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var tex: texture_2d<f32>;

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  let c01 = vec2f(f32(vi & 1u), f32(vi >> 1u));
  let centre = d.posSize.xy + d.posSize.zw * 0.5;
  let off = (c01 - 0.5) * d.posSize.zw;
  let sn = sin(d.misc.x);
  let cn = cos(d.misc.x);
  let world = centre + vec2f(off.x * cn - off.y * sn, off.x * sn + off.y * cn);
  let ndc = (world - u.view.xy) / u.view.zw * 2.0 - 1.0;
  var out: VSOut;
  out.pos = vec4f(ndc.x, -ndc.y, 0.0, 1.0);
  var ux = c01.x;
  if (d.misc.y > 0.5) { ux = 1.0 - ux; }
  out.uv = vec2f(mix(d.uv.x, d.uv.z, ux), mix(d.uv.y, d.uv.w, c01.y));
  out.color = d.color;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let a = textureSample(tex, samp, in.uv).a * in.color.a;
  return vec4f(in.color.rgb * a, a);   // tinted silhouette, additive-summed
}
`;
var BLUR_WGSL = `
struct U { dir: vec4f }   // xy = step (texel * spread * axis), zw unused
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var src: texture_2d<f32>;
struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  var out: VSOut;
  let x = f32((vi << 1u) & 2u);
  let y = f32(vi & 2u);
  out.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  out.uv = vec2f(x, y);
  return out;
}

const W = array<f32, 7>(0.199, 0.176, 0.121, 0.065, 0.0275, 0.009, 0.0022);

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  var acc = textureSample(src, samp, in.uv) * W[0];
  for (var i = 1u; i < 7u; i++) {
    let o = u.dir.xy * f32(i);
    acc += textureSample(src, samp, clamp(in.uv + o, vec2f(0.0), vec2f(1.0))) * W[i];
    acc += textureSample(src, samp, clamp(in.uv - o, vec2f(0.0), vec2f(1.0))) * W[i];
  }
  return acc;
}
`;
var COMPOSITE_WGSL = `
struct U { strength: vec4f }
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var src: texture_2d<f32>;
struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  var out: VSOut;
  let x = f32((vi << 1u) & 2u);
  let y = f32(vi & 2u);
  out.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  out.uv = vec2f(x, y);
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let g = textureSample(src, samp, in.uv);
  return vec4f(g.rgb * u.strength.x, 0.0);   // additive: pure light
}
`;
var GlowPass = class {
	format;
	data = new Float32Array(256 * FLOATS);
	count = 0;
	maxSize = 0;
	extraActive = false;
	view = /* @__PURE__ */ new Float32Array(4);
	device;
	stampPipeline;
	blurPipeline;
	compositePipeline;
	stampLayout;
	fsLayout;
	sampler;
	stampUniforms;
	blurUniformsH;
	blurUniformsV;
	compUniforms;
	instances;
	capacity = 256;
	targets = null;
	atlasView = null;
	compBind = null;
	constructor(device, format) {
		this.format = format;
		this.rebuild(device);
	}
	get active() {
		return this.count > 0 || this.extraActive;
	}
	/** @internal Another system (the vector layer) wants the blur this frame
	* even if no sprite stamps: mark active and feed its glow size into the
	* blur-spread measure. */
	wake(size) {
		this.extraActive = true;
		this.maxSize = Math.max(this.maxSize, size);
	}
	/** @internal Start a frame with the world view rect. */
	begin(x, y, w, h) {
		this.count = 0;
		this.maxSize = 0;
		this.extraActive = false;
		this.view.set([
			x,
			y,
			w,
			h
		]);
	}
	/** @internal Queue one glowing sprite's tinted silhouette (world coords). */
	stamp(x, y, w, h, f, rot, flipX, r, g, b, a, size) {
		if (this.count === this.capacity) {
			this.capacity *= 2;
			const next = new Float32Array(this.capacity * FLOATS);
			next.set(this.data);
			this.data = next;
			this.instances.destroy();
			this.instances = this.device.createBuffer({
				size: this.capacity * FLOATS * 4,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
		}
		const o = this.count * FLOATS;
		const d = this.data;
		d[o] = x;
		d[o + 1] = y;
		d[o + 2] = w;
		d[o + 3] = h;
		d[o + 4] = rot;
		d[o + 5] = flipX ? 1 : 0;
		d[o + 6] = 0;
		d[o + 7] = 0;
		d[o + 8] = r;
		d[o + 9] = g;
		d[o + 10] = b;
		d[o + 11] = a;
		d[o + 12] = f.u0;
		d[o + 13] = f.v0;
		d[o + 14] = f.u1;
		d[o + 15] = f.v1;
		this.count++;
		this.maxSize = Math.max(this.maxSize, size);
	}
	/** @internal Render silhouette + blur chain (before the main 2D pass).
	* `extra` draws additional stamps into the same half-res pass (the vector
	* layer's soft line cores) — one blur serves every glowing thing. */
	render(encoder, canvasW, canvasH, extra) {
		const spriteStamps = this.count > 0 && !!this.atlasView;
		if (!spriteStamps && !this.extraActive) return;
		const w = Math.max(1, canvasW >> 1), h = Math.max(1, canvasH >> 1);
		if (!this.targets || this.targets[0].width !== w || this.targets[0].height !== h) {
			this.targets?.forEach((t) => t.destroy());
			const make = () => this.device.createTexture({
				size: {
					width: w,
					height: h
				},
				format: this.format,
				usage: BITS.RENDER_ATTACHMENT | BITS.TEXTURE_BINDING
			});
			this.targets = [make(), make()];
			this.compBind = null;
		}
		const [A, B] = this.targets;
		this.device.queue.writeBuffer(this.stampUniforms, 0, this.view);
		if (spriteStamps) this.device.queue.writeBuffer(this.instances, 0, this.data.buffer, 0, this.count * FLOATS * 4);
		const p1 = encoder.beginRenderPass({ colorAttachments: [{
			view: A.createView(),
			loadOp: "clear",
			clearValue: {
				r: 0,
				g: 0,
				b: 0,
				a: 0
			},
			storeOp: "store"
		}] });
		if (spriteStamps) {
			const stampBind = this.device.createBindGroup({
				layout: this.stampLayout,
				entries: [
					{
						binding: 0,
						resource: { buffer: this.stampUniforms }
					},
					{
						binding: 1,
						resource: { buffer: this.instances }
					},
					{
						binding: 2,
						resource: this.sampler
					},
					{
						binding: 3,
						resource: this.atlasView
					}
				]
			});
			p1.setPipeline(this.stampPipeline);
			p1.setBindGroup(0, stampBind);
			p1.draw(4, this.count);
		}
		extra?.(p1);
		p1.end();
		const spread = Math.min(3, Math.max(.6, this.maxSize / 10));
		this.device.queue.writeBuffer(this.blurUniformsH, 0, new Float32Array([
			spread / w,
			0,
			0,
			0
		]));
		this.device.queue.writeBuffer(this.blurUniformsV, 0, new Float32Array([
			0,
			spread / h,
			0,
			0
		]));
		for (let i = 0; i < 2; i++) {
			this.blurTo(encoder, A, B, this.blurUniformsH);
			this.blurTo(encoder, B, A, this.blurUniformsV);
		}
	}
	blurTo(encoder, from, to, uniforms) {
		const bind = this.device.createBindGroup({
			layout: this.fsLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: uniforms }
				},
				{
					binding: 1,
					resource: this.sampler
				},
				{
					binding: 2,
					resource: from.createView()
				}
			]
		});
		const pass = encoder.beginRenderPass({ colorAttachments: [{
			view: to.createView(),
			loadOp: "clear",
			clearValue: {
				r: 0,
				g: 0,
				b: 0,
				a: 0
			},
			storeOp: "store"
		}] });
		pass.setPipeline(this.blurPipeline);
		pass.setBindGroup(0, bind);
		pass.draw(3);
		pass.end();
	}
	/** @internal Additively composite the blurred glow into the open scene pass. */
	composite(pass) {
		if (!this.active || !this.targets) return;
		if (!this.compBind) {
			this.device.queue.writeBuffer(this.compUniforms, 0, new Float32Array([
				1.15,
				0,
				0,
				0
			]));
			this.compBind = this.device.createBindGroup({
				layout: this.fsLayout,
				entries: [
					{
						binding: 0,
						resource: { buffer: this.compUniforms }
					},
					{
						binding: 1,
						resource: this.sampler
					},
					{
						binding: 2,
						resource: this.targets[0].createView()
					}
				]
			});
		}
		pass.setPipeline(this.compositePipeline);
		pass.setBindGroup(0, this.compBind);
		pass.draw(3);
	}
	setTexture(view) {
		this.atlasView = view;
	}
	rebuild(device) {
		this.device = device;
		this.targets = null;
		this.compBind = null;
		this.atlasView = null;
		this.sampler = device.createSampler({
			magFilter: "linear",
			minFilter: "linear"
		});
		this.stampLayout = device.createBindGroupLayout({ entries: [
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
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			},
			{
				binding: 3,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			}
		] });
		this.fsLayout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			},
			{
				binding: 2,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			}
		] });
		const mk = (code) => {
			const m = device.createShaderModule({ code });
			m.getCompilationInfo().then((info) => {
				for (const msg of info.messages) if (msg.type === "error") console.error(`GlowPass WGSL ${msg.lineNum}:${msg.linePos} ${msg.message}`);
			});
			return m;
		};
		const stampMod = mk(STAMP_WGSL);
		this.stampPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.stampLayout] }),
			vertex: {
				module: stampMod,
				entryPoint: "vs"
			},
			fragment: {
				module: stampMod,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "one",
							dstFactor: "one"
						},
						alpha: {
							srcFactor: "one",
							dstFactor: "one"
						}
					}
				}]
			},
			primitive: { topology: "triangle-strip" }
		});
		const blurMod = mk(BLUR_WGSL);
		this.blurPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.fsLayout] }),
			vertex: {
				module: blurMod,
				entryPoint: "vs"
			},
			fragment: {
				module: blurMod,
				entryPoint: "fs",
				targets: [{ format: this.format }]
			},
			primitive: { topology: "triangle-list" }
		});
		const compMod = mk(COMPOSITE_WGSL);
		this.compositePipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.fsLayout] }),
			vertex: {
				module: compMod,
				entryPoint: "vs"
			},
			fragment: {
				module: compMod,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							srcFactor: "one",
							dstFactor: "one"
						},
						alpha: {
							srcFactor: "one",
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
		this.stampUniforms = device.createBuffer({
			size: 16,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.blurUniformsH = device.createBuffer({
			size: 16,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.blurUniformsV = device.createBuffer({
			size: 16,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.compUniforms = device.createBuffer({
			size: 16,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.instances = device.createBuffer({
			size: this.capacity * FLOATS * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
	}
};
//#endregion
//#region src/lib/input.ts
/** Maps physical keys, mouse buttons, and wheel ticks to named actions; exposes polled held/pressed/released state per action. */
/**
* Physical-key code constants. Values are `KeyboardEvent.code` strings (layout-independent)
* plus virtual `'Mouse1'`/`'Mouse2'`/`'Mouse3'` and `'MWheelUp'`/`'MWheelDown'`.
* Use `KEY.LEFT_ARROW` instead of `'ArrowLeft'` for readability; raw strings are equally valid.
*/
var KEY = {
	/** Left mouse button. */
	MOUSE1: "Mouse1",
	/** Right mouse button. */
	MOUSE2: "Mouse2",
	/** Middle mouse button. */
	MOUSE3: "Mouse3",
	/** Mouse wheel scrolled up (one-frame tap). */
	MWHEEL_UP: "MWheelUp",
	/** Mouse wheel scrolled down (one-frame tap). */
	MWHEEL_DOWN: "MWheelDown",
	/** Left arrow key. */
	LEFT_ARROW: "ArrowLeft",
	/** Right arrow key. */
	RIGHT_ARROW: "ArrowRight",
	/** Up arrow key. */
	UP_ARROW: "ArrowUp",
	/** Down arrow key. */
	DOWN_ARROW: "ArrowDown",
	/** Space bar. */
	SPACE: "Space",
	/** Enter / Return key. */
	ENTER: "Enter",
	/** Tab key. */
	TAB: "Tab",
	/** Escape key. */
	ESC: "Escape",
	/** Backspace key. */
	BACKSPACE: "Backspace",
	/** Delete key. */
	DELETE: "Delete",
	/** Insert key. */
	INSERT: "Insert",
	/** Left Shift key. */
	SHIFT: "ShiftLeft",
	/** Right Shift key. */
	SHIFT_RIGHT: "ShiftRight",
	/** Left Control key. */
	CTRL: "ControlLeft",
	/** Right Control key. */
	CTRL_RIGHT: "ControlRight",
	/** Left Alt key. */
	ALT: "AltLeft",
	/** Right Alt key. */
	ALT_RIGHT: "AltRight",
	/** Left Meta (Cmd / Windows) key. */
	META: "MetaLeft",
	/** Right Meta key. */
	META_RIGHT: "MetaRight",
	/** Caps Lock key. */
	CAPS: "CapsLock",
	/** Page Up key. */
	PAGE_UP: "PageUp",
	/** Page Down key. */
	PAGE_DOWN: "PageDown",
	/** Home key. */
	HOME: "Home",
	/** End key. */
	END: "End",
	/** Pause / Break key. */
	PAUSE: "Pause",
	/** Top-row digit 0. */
	_0: "Digit0",
	/** Top-row digit 1. */
	_1: "Digit1",
	/** Top-row digit 2. */
	_2: "Digit2",
	/** Top-row digit 3. */
	_3: "Digit3",
	/** Top-row digit 4. */
	_4: "Digit4",
	/** Top-row digit 5. */
	_5: "Digit5",
	/** Top-row digit 6. */
	_6: "Digit6",
	/** Top-row digit 7. */
	_7: "Digit7",
	/** Top-row digit 8. */
	_8: "Digit8",
	/** Top-row digit 9. */
	_9: "Digit9",
	/** Physical A key (layout-independent). */
	A: "KeyA",
	/** Physical B key. */
	B: "KeyB",
	/** Physical C key. */
	C: "KeyC",
	/** Physical D key. */
	D: "KeyD",
	/** Physical E key. */
	E: "KeyE",
	/** Physical F key. */
	F: "KeyF",
	/** Physical G key. */
	G: "KeyG",
	/** Physical H key. */
	H: "KeyH",
	/** Physical I key. */
	I: "KeyI",
	/** Physical J key. */
	J: "KeyJ",
	/** Physical K key. */
	K: "KeyK",
	/** Physical L key. */
	L: "KeyL",
	/** Physical M key. */
	M: "KeyM",
	/** Physical N key. */
	N: "KeyN",
	/** Physical O key. */
	O: "KeyO",
	/** Physical P key. */
	P: "KeyP",
	/** Physical Q key. */
	Q: "KeyQ",
	/** Physical R key. */
	R: "KeyR",
	/** Physical S key. */
	S: "KeyS",
	/** Physical T key. */
	T: "KeyT",
	/** Physical U key. */
	U: "KeyU",
	/** Physical V key. */
	V: "KeyV",
	/** Physical W key. */
	W: "KeyW",
	/** Physical X key. */
	X: "KeyX",
	/** Physical Y key. */
	Y: "KeyY",
	/** Physical Z key. */
	Z: "KeyZ",
	/** Numpad 0. */
	NUMPAD_0: "Numpad0",
	/** Numpad 1. */
	NUMPAD_1: "Numpad1",
	/** Numpad 2. */
	NUMPAD_2: "Numpad2",
	/** Numpad 3. */
	NUMPAD_3: "Numpad3",
	/** Numpad 4. */
	NUMPAD_4: "Numpad4",
	/** Numpad 5. */
	NUMPAD_5: "Numpad5",
	/** Numpad 6. */
	NUMPAD_6: "Numpad6",
	/** Numpad 7. */
	NUMPAD_7: "Numpad7",
	/** Numpad 8. */
	NUMPAD_8: "Numpad8",
	/** Numpad 9. */
	NUMPAD_9: "Numpad9",
	/** Numpad multiply (*). */
	MULTIPLY: "NumpadMultiply",
	/** Numpad add (+). */
	ADD: "NumpadAdd",
	/** Numpad subtract (−). */
	SUBTRACT: "NumpadSubtract",
	/** Numpad decimal point. */
	DECIMAL: "NumpadDecimal",
	/** Numpad divide (/). */
	DIVIDE: "NumpadDivide",
	/** F1 function key. */
	F1: "F1",
	/** F2 function key. */
	F2: "F2",
	/** F3 function key. */
	F3: "F3",
	/** F4 function key. */
	F4: "F4",
	/** F5 function key. */
	F5: "F5",
	/** F6 function key. */
	F6: "F6",
	/** F7 function key. */
	F7: "F7",
	/** F8 function key. */
	F8: "F8",
	/** F9 function key. */
	F9: "F9",
	/** F10 function key. */
	F10: "F10",
	/** F11 function key. */
	F11: "F11",
	/** F12 function key. */
	F12: "F12",
	/** Equal / plus key (=). */
	PLUS: "Equal",
	/** Minus key (−). */
	MINUS: "Minus",
	/** Comma key. */
	COMMA: "Comma",
	/** Period / full-stop key. */
	PERIOD: "Period",
	/** Forward slash key (/). */
	SLASH: "Slash",
	/** Backslash key (\\). */
	BACKSLASH: "Backslash",
	/** Semicolon key (;). */
	SEMICOLON: "Semicolon",
	/** Single-quote / apostrophe key ('). */
	QUOTE: "Quote",
	/** Backtick / grave-accent key (`). */
	BACKQUOTE: "Backquote",
	/** Left square bracket ([). */
	BRACKET_LEFT: "BracketLeft",
	/** Right square bracket (]). */
	BRACKET_RIGHT: "BracketRight"
};
var DEFAULT_PREVENT = /* @__PURE__ */ new Set([
	"ArrowUp",
	"ArrowDown",
	"ArrowLeft",
	"ArrowRight",
	"Space",
	"PageUp",
	"PageDown",
	"Home",
	"End"
]);
function isModifierKey(code) {
	return code === "ShiftLeft" || code === "ShiftRight" || code === "ControlLeft" || code === "ControlRight" || code === "AltLeft" || code === "AltRight" || code === "MetaLeft" || code === "MetaRight";
}
function isEditingFocus(event) {
	const t = event.target;
	if (!t) return false;
	const tag = t.tagName;
	if (tag === "INPUT" || tag === "TEXTAREA") return true;
	return !!t.isContentEditable;
}
/** Low-level input service: keyboard key bindings, mouse button bindings, and pointer (mouse + touch) access. Accessed via `game.input`. */
var Input = class {
	canvas;
	touchDevice;
	mobile;
	constructor(canvas = null, touchDevice = false, mobile = false) {
		this.canvas = canvas;
		this.touchDevice = touchDevice;
		this.mobile = mobile;
		this.pointerTracker = new PointerTracker(canvas);
	}
	/**
	* Physical-key → action-name bindings map. Populated by `bind()`.
	* Each physical code maps to one or more action names (a code may drive several actions).
	*/
	bindings = /* @__PURE__ */ new Map();
	pressCount = {};
	presses = {};
	releases = {};
	keyDown = /* @__PURE__ */ new Set();
	/** Raw codes that went DOWN this frame — the code-level twin of `presses`
	*  (which is action-keyed). Cleared by clearPressed() each frame. */
	codePresses = /* @__PURE__ */ new Set();
	wheelTaps = [];
	_wheelDelta = 0;
	/** Seconds left of the scene-entry input grace (see ignoreFor). */
	graceLeft = 0;
	textHandlers = [];
	/** True once a keyboard binding has been created and DOM listeners are attached. */
	isUsingMouse = false;
	/** True once a mouse or wheel binding has been created and DOM listeners are attached. */
	isUsingKeyboard = false;
	/**
	* Unified pointer tracker — mouse and touch (multi-touch) share this.
	* Exposes `game.input.pointer` (primary), `game.input.pointers` (all active),
	* and gesture subscriptions: `onTap`, `onDoubleTap`, `onLongPress`, `onPan`, `onSwipe`,
	* `onPointerDown`, `onPointerUp`, `onPointerMove`.
	*/
	pointerTracker;
	onKeyDownBound = this.onKeyDown.bind(this);
	onKeyUpBound = this.onKeyUp.bind(this);
	onBlurBound = this.onBlur.bind(this);
	onMouseDownBound = this.onMouseDown.bind(this);
	onMouseUpBound = this.onMouseUp.bind(this);
	onWheelBound = this.onWheel.bind(this);
	onContextMenuBound = this.onContextMenu.bind(this);
	onTouchStartBound = this.onTouchStart.bind(this);
	onTouchEndBound = this.onTouchEnd.bind(this);
	/** @internal Lazily attach keyboard listeners; called by `bind()` on first keyboard binding. */
	initKeyboard() {
		if (this.isUsingKeyboard) return;
		this.isUsingKeyboard = true;
		if (typeof window === "undefined") return;
		window.addEventListener("keydown", this.onKeyDownBound, false);
		window.addEventListener("keyup", this.onKeyUpBound, false);
		window.addEventListener("blur", this.onBlurBound, false);
	}
	/** @internal Lazily attach mouse/touch/pointer listeners; called by `bind()` on first mouse binding. */
	initMouse() {
		if (this.isUsingMouse) return;
		this.isUsingMouse = true;
		if (typeof document === "undefined" || !this.canvas) return;
		const canvas = this.canvas;
		if (!canvas) return;
		canvas.addEventListener("wheel", this.onWheelBound, false);
		canvas.addEventListener("contextmenu", this.onContextMenuBound, false);
		canvas.addEventListener("mousedown", this.onMouseDownBound, false);
		canvas.addEventListener("mouseup", this.onMouseUpBound, false);
		if (this.touchDevice) {
			canvas.addEventListener("touchstart", this.onTouchStartBound, false);
			canvas.addEventListener("touchend", this.onTouchEndBound, false);
			canvas.addEventListener("touchcancel", this.onTouchEndBound, false);
		}
		this.pointerTracker.attach();
	}
	/**
	* Remove every DOM listener attached by this Input and tear down the pointer tracker.
	* Called by `Game.destroy()`; after this the Input is inert.
	*/
	destroy() {
		if (typeof window !== "undefined") {
			window.removeEventListener("keydown", this.onKeyDownBound, false);
			window.removeEventListener("keyup", this.onKeyUpBound, false);
			window.removeEventListener("blur", this.onBlurBound, false);
		}
		if (this.canvas) {
			this.canvas.removeEventListener("wheel", this.onWheelBound, false);
			this.canvas.removeEventListener("contextmenu", this.onContextMenuBound, false);
			this.canvas.removeEventListener("mousedown", this.onMouseDownBound, false);
			this.canvas.removeEventListener("mouseup", this.onMouseUpBound, false);
			this.canvas.removeEventListener("touchstart", this.onTouchStartBound, false);
			this.canvas.removeEventListener("touchend", this.onTouchEndBound, false);
			this.canvas.removeEventListener("touchcancel", this.onTouchEndBound, false);
		}
		this.pointerTracker.detach();
		this.unbindAll();
		this.textHandlers.length = 0;
		this.isUsingKeyboard = false;
		this.isUsingMouse = false;
	}
	/**
	* Bind one or more physical key codes (keyboard keys, mouse buttons, or wheel ticks) to a named action.
	* Multiple codes for the same action are ref-counted — the action stays held until every bound key is released.
	* DOM listeners are attached lazily on the first `bind()` call.
	* @example
	* input.bind(KEY.LEFT_ARROW, 'left');
	* input.bind([KEY.LEFT_ARROW, KEY.A], 'left'); // WASD + arrows both move
	* input.bind(KEY.MOUSE1, 'fire');
	*/
	bind(codes, action) {
		const list = typeof codes === "string" ? [codes] : codes;
		for (const code of list) {
			if (code === "Mouse1" || code === "Mouse2" || code === "Mouse3" || code === "MWheelUp" || code === "MWheelDown") this.initMouse();
			else this.initKeyboard();
			let actions = this.bindings.get(code);
			if (!actions) {
				actions = /* @__PURE__ */ new Set();
				this.bindings.set(code, actions);
			}
			actions.add(action);
			DEFAULT_PREVENT.add(code);
			if (this.pressCount[action] === void 0) this.pressCount[action] = 0;
		}
	}
	/** Remove every binding for a physical code; any action it was driving is released immediately. */
	unbind(code) {
		if (!this.bindings.get(code)) return;
		if (this.keyDown.has(code)) this.releaseCode(code);
		this.bindings.delete(code);
	}
	/** Drop every binding and clear all pressed/held/released state. */
	unbindAll() {
		this.bindings.clear();
		this.pressCount = {};
		this.presses = {};
		this.releases = {};
		this.keyDown.clear();
	}
	/** Returns `true` while one or more keys bound to this action are currently held (key down). */
	/**
	* True while any of the given KEY CODES is held — the no-setup path:
	* `input.key('ArrowLeft', 'KeyA')`. Codes are `KeyboardEvent.code` values
	* (see `KEY`), plus 'Mouse1'…'Mouse3'.
	*
	* The other granularity of the same job is ACTIONS — `bind()` a set of codes
	* to a name, then `state(name)`. Prefer actions once a game has remappable
	* controls or more than a couple of keys; both read the same key state and
	* both respect the scene-transition grace.
	*/
	key(...codes) {
		this.ensureCodeListeners(codes);
		if (this.ignoring) return false;
		for (const c of codes) if (this.keyDown.has(c)) return true;
		return false;
	}
	/** True only on the frame any of the given key codes went DOWN (edge, not
	*  held) — menu confirms, jumps, one-shot fire. Auto-repeat is not an edge. */
	keyPressed(...codes) {
		this.ensureCodeListeners(codes);
		if (this.ignoring) return false;
		for (const c of codes) if (this.codePresses.has(c)) return true;
		return false;
	}
	/**
	* @internal Raw `key()`/`keyPressed()` polling reads the same state the
	* listeners populate — but unlike `bind()` it never called `initKeyboard()`,
	* so a game that only polls raw codes had NO listeners attached and read dead
	* (the bug when Game's own keyboard listeners were folded into Input). Attach
	* keyboard on any poll; attach mouse only if a mouse/wheel code is queried
	* (initMouse also suppresses the context menu — don't trigger it needlessly).
	*/
	ensureCodeListeners(codes) {
		if (!this.isUsingKeyboard) this.initKeyboard();
		if (!this.isUsingMouse) {
			for (const c of codes) if (c.startsWith("Mouse") || c.startsWith("MWheel")) {
				this.initMouse();
				break;
			}
		}
	}
	/**
	* Map a RAW DOM pointer event to world coordinates through this frame's view
	* — the escape hatch for your own `canvas.addEventListener('pointerdown')`.
	* Gestures routed through this Input (`onTap`, `onPan`, `pointer`) already
	* carry world coordinates, so you rarely need this.
	*/
	toWorld(e) {
		return this.pointerTracker.mapToWorld(e.clientX, e.clientY);
	}
	state(action) {
		if (this.graceLeft > 0) return false;
		return (this.pressCount[action] ?? 0) > 0;
	}
	/** Returns `true` on the single frame the action transitioned from not-held to held (key pressed). Use for one-shot triggers like jump or shoot. */
	pressed(action) {
		if (this.graceLeft > 0) return false;
		return !!this.presses[action];
	}
	/** Returns `true` on the single frame the action transitioned from held to not-held (key released). */
	released(action) {
		if (this.graceLeft > 0) return false;
		return !!this.releases[action];
	}
	/**
	* Ignore ALL input — key state/edges and pointer gestures — for `seconds`.
	* Called automatically on every scene transition (game.inputGrace, default
	* 0.5 s): a player frantically tapping fire when they die shouldn't
	* instantly dismiss the game-over screen.
	*/
	ignoreFor(seconds) {
		this.graceLeft = Math.max(this.graceLeft, seconds);
	}
	/** True while the scene-entry grace period is running (all reads report inactive). */
	get ignoring() {
		return this.graceLeft > 0;
	}
	/** @internal Advance the grace clock — called by the Game's frame loop. */
	tickGrace(dt) {
		if (this.graceLeft > 0) this.graceLeft = Math.max(0, this.graceLeft - dt);
	}
	/**
	* Forget everything currently held, pressed or released, and every
	* in-flight pointer — called on scene transitions so a key RELEASED just
	* after the switch can't fire an action in the new scene (the classic
	* "release quits the game-over screen" bug). Bindings survive; a held key
	* re-registers on its next real keydown.
	*/
	reset() {
		this.pressCount = {};
		this.presses = {};
		this.releases = {};
		this.keyDown.clear();
		this.wheelTaps.length = 0;
		this.pointerTracker.reset();
	}
	/** @internal Wrap a gesture handler so it's muted during the grace period. */
	guard(handler) {
		return (...args) => {
			if (this.graceLeft <= 0) handler(...args);
		};
	}
	/**
	* Subscribe to text input — fires once per typed character, layout- and Shift-resolved
	* (so you get `'A'`, `'@'`, `' '`, etc., not physical key codes). Control keys
	* (Backspace, Enter, arrows, …) are NOT delivered here — handle those with `bind()` +
	* `pressed()`. Fires on browser key-repeat too, so holding a key types repeatedly.
	* Typing is suppressed during Ctrl/Cmd/Alt shortcuts and while a DOM `<input>` is focused.
	* Use for an in-canvas text field — a high-score name, a seed, a chat line.
	* @returns An unsubscribe function.
	* @example
	* let name = '';
	* this.input.onText(ch => { if (name.length < 8) name += ch; });
	* const keys = this.input.bind({ del: ['Backspace'], ok: ['Enter'] });
	* // in update(): if (keys.del.pressed) name = name.slice(0, -1);
	*/
	onText(handler) {
		this.initKeyboard();
		this.textHandlers.push(handler);
		return () => {
			const i = this.textHandlers.indexOf(handler);
			if (i >= 0) this.textHandlers.splice(i, 1);
		};
	}
	/**
	* Mouse-wheel movement THIS FRAME, in pixels — positive scrolls down/away.
	* Unlike the `'MWheelUp'`/`'MWheelDown'` codes (one-frame edges, so a fast
	* flick collapses to a single tick) this carries the magnitude, which is what
	* scrolling a list or zooming a map actually needs.
	*/
	get wheelDelta() {
		if (!this.isUsingMouse) this.initMouse();
		return this.ignoring ? 0 : this._wheelDelta;
	}
	/** The primary pointer — mouse if active, else the first touch. `null` when no pointer is tracked. */
	get pointer() {
		return this.pointerTracker.primary;
	}
	/** Every currently active pointer: the mouse plus each touch finger currently on screen. */
	get pointers() {
		return this.pointerTracker.pointers;
	}
	/**
	* Subscribe to tap events (quick down + up, no drag) from mouse or touch.
	* @returns An unsubscribe function.
	*/
	onTap(handler) {
		this.initMouse();
		return this.pointerTracker.onTap(this.guard(handler));
	}
	/**
	* Subscribe to double-tap events (two taps within `doubleTapDelay` in the same area) from mouse or touch.
	* @returns An unsubscribe function.
	*/
	onDoubleTap(handler) {
		this.initMouse();
		return this.pointerTracker.onDoubleTap(this.guard(handler));
	}
	/**
	* Subscribe to long-press events (pointer held stationary for `longPressDelay` ms) from mouse or touch.
	* @returns An unsubscribe function.
	*/
	onLongPress(handler) {
		this.initMouse();
		return this.pointerTracker.onLongPress(this.guard(handler));
	}
	/**
	* Subscribe to pan events (continuous pointer movement while pressed/held) from mouse or touch. Fires every frame the pointer moves beyond `panThreshold`.
	* @returns An unsubscribe function.
	*/
	onPan(handler) {
		this.initMouse();
		return this.pointerTracker.onPan(this.guard(handler));
	}
	/**
	* Subscribe to swipe events (fast directional release: left/right/up/down) from mouse or touch.
	* @returns An unsubscribe function.
	*/
	onSwipe(handler) {
		this.initMouse();
		return this.pointerTracker.onSwipe(this.guard(handler));
	}
	/**
	* Subscribe to raw pointer-down events (mouse button pressed or finger touched).
	* @returns An unsubscribe function.
	*/
	onPointerDown(handler) {
		this.initMouse();
		return this.pointerTracker.onPointerDown(this.guard(handler));
	}
	/**
	* Subscribe to raw pointer-up events (mouse button released or finger lifted).
	* @returns An unsubscribe function.
	*/
	onPointerUp(handler) {
		this.initMouse();
		return this.pointerTracker.onPointerUp(this.guard(handler));
	}
	/**
	* Subscribe to raw pointer-move events (mouse moved or touch dragged). Fires every frame the pointer position changes.
	* @returns An unsubscribe function.
	*/
	onPointerMove(handler) {
		this.initMouse();
		return this.pointerTracker.onPointerMove(this.guard(handler));
	}
	/**
	* End-of-tick housekeeping called by the Game's frame loop: clears the one-frame pressed/released edge flags
	* and drains wheel-tick increments (wheel ticks are held for one frame only).
	*/
	clearPressed() {
		for (const action of this.wheelTaps) {
			const prev = this.pressCount[action] ?? 0;
			if (prev > 0) this.pressCount[action] = prev - 1;
		}
		this.wheelTaps.length = 0;
		this._wheelDelta = 0;
		this.presses = {};
		this.releases = {};
		this.codePresses.clear();
		this.pointerTracker.flushFrame();
	}
	/**
	* Bind a touch on a DOM element (selected by CSS selector) to a named action.
	* Useful for on-screen d-pad buttons or HUD controls laid out outside the canvas.
	* @param selector A CSS selector for the touch target element.
	* @param action The action name to press/release with this touch.
	*/
	bindTouch(selector, action) {
		const element = document.querySelector(selector);
		if (!element) return;
		element.addEventListener("touchstart", (ev) => {
			this.pressAction(action);
			ev.stopPropagation();
			ev.preventDefault();
		}, false);
		element.addEventListener("touchend", (ev) => {
			this.releaseAction(action);
			ev.stopPropagation();
			ev.preventDefault();
		}, false);
	}
	pressCode(code) {
		if (this.keyDown.has(code)) return;
		this.keyDown.add(code);
		this.codePresses.add(code);
		const actions = this.bindings.get(code);
		if (!actions) return;
		for (const action of actions) {
			const prev = this.pressCount[action] ?? 0;
			this.pressCount[action] = prev + 1;
			if (prev === 0) this.presses[action] = true;
		}
	}
	releaseCode(code) {
		if (!this.keyDown.has(code)) return;
		this.keyDown.delete(code);
		const actions = this.bindings.get(code);
		if (!actions) return;
		for (const action of actions) {
			const prev = this.pressCount[action] ?? 0;
			if (prev <= 0) continue;
			this.pressCount[action] = prev - 1;
			if (prev === 1) this.releases[action] = true;
		}
	}
	pressAction(action) {
		const prev = this.pressCount[action] ?? 0;
		this.pressCount[action] = prev + 1;
		if (prev === 0) this.presses[action] = true;
	}
	releaseAction(action) {
		const prev = this.pressCount[action] ?? 0;
		if (prev <= 0) return;
		this.pressCount[action] = prev - 1;
		if (prev === 1) this.releases[action] = true;
	}
	/** @internal Raw keydown handler — exposed for test injection. Modifier guard prevents firing during Ctrl/Cmd/Alt shortcuts. */
	onKeyDown(event) {
		if (isEditingFocus(event)) return;
		const code = event.code;
		if ((event.ctrlKey || event.metaKey || event.altKey) && !isModifierKey(code)) return;
		if (DEFAULT_PREVENT.has(code)) event.preventDefault();
		if (this.textHandlers.length && event.key && event.key.length === 1) for (let i = 0; i < this.textHandlers.length; i++) this.textHandlers[i](event.key);
		this.pressCode(code);
	}
	/** @internal Raw keyup handler — exposed for test injection. */
	onKeyUp(event) {
		if (isEditingFocus(event)) return;
		const code = event.code;
		if (DEFAULT_PREVENT.has(code)) event.preventDefault();
		this.releaseCode(code);
	}
	/** @internal Window blur handler — synthesises key-up for every held key so actions don't get stuck after alt-tab. */
	onBlur() {
		const held = Array.from(this.keyDown);
		for (const code of held) this.releaseCode(code);
	}
	onMouseDown(event) {
		const code = event.button === 2 ? "Mouse2" : event.button === 1 ? "Mouse3" : "Mouse1";
		if (!this.mobile) window.focus();
		if (this.bindings.has(code)) event.preventDefault();
		this.pressCode(code);
	}
	onMouseUp(event) {
		const code = event.button === 2 ? "Mouse2" : event.button === 1 ? "Mouse3" : "Mouse1";
		if (this.bindings.has(code)) event.preventDefault();
		this.releaseCode(code);
	}
	onWheel(event) {
		const code = event.deltaY < 0 ? "MWheelUp" : "MWheelDown";
		this.codePresses.add(code);
		const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 100 : 1;
		this._wheelDelta += event.deltaY * unit;
		const actions = this.bindings.get(code);
		if (actions) for (const action of actions) {
			const prev = this.pressCount[action] ?? 0;
			this.pressCount[action] = prev + 1;
			if (prev === 0) this.presses[action] = true;
			this.wheelTaps.push(action);
		}
		event.stopPropagation();
		event.preventDefault();
	}
	onContextMenu(event) {
		if (this.bindings.has("Mouse2")) {
			event.stopPropagation();
			event.preventDefault();
		}
	}
	onTouchStart(event) {
		event.preventDefault();
		this.pressCode("Mouse1");
	}
	onTouchEnd(event) {
		event.preventDefault();
		this.releaseCode("Mouse1");
	}
};
//#endregion
//#region src/lib/preload.ts
/**
* Asset queue passed to `Scene.preload(load)`. Each method queues one asset;
* the cache is warmed so later calls to `game.assets.framesOf(url)`, `loadJson`, or
* `this.sound.play(url)` resolve instantly.
*/
var Preload = class {
	_audio;
	_loadModel;
	items = [];
	_done = 0;
	_pending = 0;
	/**
	* @internal The Game passes its audio service (so `audio()` warms the SFX
	* cache) and a lazy model-data loader (so `glb()`/`obj()` can load into the
	* 3D chunk's cache without the main bundle importing it).
	*/
	constructor(_audio, _loadModel) {
		this._audio = _audio;
		this._loadModel = _loadModel;
	}
	track(p) {
		this.items.push(p.then(() => {
			this._done++;
		}, () => {
			this._done++;
		}));
	}
	/** Queue an image — register its frames with `game.assets.framesOf(url, frameW?, frameH?)` in setup(). */
	image(url) {
		if (!isImageCached(url)) this._pending++;
		this.track(loadImage(url));
	}
	/** Queue a GLB model — its geometry + textures load + cache now; `world.loadGlb(url)` in setup() builds it instantly. */
	glb(url) {
		this.model(url);
	}
	/** Queue an OBJ model (+ its MTL / textures) — caches now; `world.loadObj(url)` in setup() builds it instantly. */
	obj(url) {
		this.model(url);
	}
	model(url) {
		if (!isModelCached(url)) this._pending++;
		this.track(this._loadModel ? this._loadModel(url) : Promise.resolve());
	}
	/** Queue a text / CSV file — available via `loadText(url)` once `preload` resolves. */
	text(url) {
		if (!isTextCached(url)) this._pending++;
		this.track(loadText(url));
	}
	/** Queue and parse a JSON file — available via `loadJson(url)` once `preload` resolves. */
	json(url) {
		if (!isTextCached(url)) this._pending++;
		this.track(loadJson(url));
	}
	/** Queue an MSDF font pair (atlas .png + msdf-atlas-gen .json) — build it with `game.assets.msdfFont(png, json)` in setup(). */
	msdfFont(pngUrl, jsonUrl) {
		this.image(pngUrl);
		this.json(jsonUrl);
	}
	/**
	* Queue a WEB FONT file (woff2 / woff / ttf / otf) under `family`, then bake
	* it in setup() with `game.assets.font({ font: '32px ' + family })`.
	*
	* REQUIRED for any non-system face. Baking rasterizes whatever the browser
	* has for that family AT THAT MOMENT: bake before the file lands and you
	* silently get the fallback (Arial-ish), permanently — glyphs go onto the
	* atlas once. Queuing here makes the font an awaited asset like any other,
	* so setup() can't run early.
	*/
	font(family, url) {
		if (!isFontCached(family)) this._pending++;
		this.track(loadFont(family, url));
	}
	/** Queue a binary file — available via `loadBinary(url)` once `preload` resolves. */
	binary(url) {
		if (!isBinaryCached(url)) this._pending++;
		this.track(loadBinary(url));
	}
	/** Queue an audio / SFX file — available via `this.sound.play(url)` once `preload` resolves. */
	audio(url) {
		if (!this._audio) return;
		if (!this._audio.isLoaded(url)) this._pending++;
		this.track(this._audio.load(url));
	}
	/** Number of assets queued. */
	get count() {
		return this.items.length;
	}
	/**
	* How many queued assets actually need loading — i.e. weren't already in a
	* cache when queued. The boot shows the loading screen only when this is
	* > 0, so re-declaring assets loaded once up-front (the "load everything at
	* the start, scenes reuse" pattern) costs nothing.
	*/
	get pending() {
		return this._pending;
	}
	/** Load progress 0..1 across all queued assets (1 when nothing is queued). */
	get progress() {
		return this.items.length ? this._done / this.items.length : 1;
	}
	/** Promise that resolves once every queued asset has settled (success or failure). */
	all() {
		return Promise.all(this.items).then(() => void 0);
	}
};
/**
* Built-in minimum time (ms) the loading bar takes to ease to full. A local/
* cached load can complete inside a single frame; without this the bar would
* snap straight to 100%. The displayed value never exceeds REAL progress.
*/
var LOADING_MIN_MS = 300;
/**
* The value the loading bar should display: the lesser of real load progress
* and a linear ramp over `minMs` — eases an instant local load into a smooth
* fill while never showing more than is actually loaded.
*/
function loadingBarProgress(real, elapsedMs, minMs = 300) {
	const r = Math.max(0, Math.min(1, real));
	if (minMs <= 0) return r;
	return Math.min(r, elapsedMs / minMs);
}
/**
* One frame of the loading fill CHASING its target. Real progress is a step
* function — one jump per file that finishes — so a bar drawn straight from it
* stands dead still through the whole of a big download and then snaps. Easing
* keeps it gliding, which is what makes the bar read as alive.
*
* Framerate-independent exponential approach, plus a small floor so it creeps
* even when the gap is tiny. Never overshoots the target and never goes
* backwards. Exported for tests.
*/
function easeLoadingFill(shown, target, dt) {
	if (target <= shown) return shown;
	const k = 1 - Math.exp(-6 * dt);
	return Math.min(target, shown + Math.max((target - shown) * k, dt * .02));
}
/**
* Built-in loading screen shown while a scene's assets load — a rounded
* capsule bar filled with a flowing multi-colour gradient, a soft glow, and a
* fountain of sparks trailing the leading edge, easing to full over at least
* {@link LOADING_MIN_MS}, with a percentage readout. Sits on the game's
* background colour. Replace with `GameOptions.drawLoading(d, progress)` for a
* custom look.
*
* Everything animates on TIME, not on progress, and the fill eases toward its
* target rather than snapping — so the bar keeps moving through a long
* single-file download, when real progress reports nothing at all.
*/
var LoadingScene = class extends Scene {
	progressFn = () => 0;
	custom;
	elapsedMs = 0;
	/** The DISPLAYED fill, chasing the real value (see update). */
	shown = 0;
	font = null;
	update(dt) {
		super.update(dt);
		this.elapsedMs += dt * 1e3;
		this.shown = easeLoadingFill(this.shown, loadingBarProgress(this.progressFn(), this.elapsedMs), dt);
	}
	drawHud(d) {
		const p = this.shown;
		if (this.custom) {
			this.custom(d, p);
			return;
		}
		const t = this.elapsedMs;
		const W = d.w;
		const cy = d.h / 2;
		const barH = 10;
		const r = barH / 2;
		const barW = Math.min(W * .6, 360);
		const bx = (W - barW) / 2;
		const top = cy - barH / 2;
		const fillW = barW * p;
		const phase = t % 2600 / 2600 * GRAD_LUT.length;
		const colorAt = (fx) => GRAD_LUT[(Math.floor(fx * GRAD_LUT.length * 1.3 + phase) % GRAD_LUT.length + GRAD_LUT.length) % GRAD_LUT.length];
		if (fillW > 0) capsule(d, bx - 3, top - 3, fillW + 6, 16, colorAt(.5), .22);
		capsule(d, bx, top, barW, barH, "#171d2b");
		{
			const sweep = t % 1500 / 1500 * (barW + 120) - 60;
			for (let x = Math.max(bx + r, bx + sweep - 30); x < Math.min(bx + barW - r, bx + sweep + 30); x += 3) {
				const fade = 1 - Math.abs(x - (bx + sweep)) / 30;
				if (x >= bx + fillW) d.rect(x, top, 3, barH, "#2b3550", fade * .85);
			}
		}
		if (fillW > barH) {
			d.circle(bx + r, cy, r, colorAt(r / barW));
			d.circle(bx + fillW - r, cy, r, colorAt((fillW - r) / barW));
			for (let x = bx + r; x < bx + fillW - r; x += 3) {
				const w = Math.min(3, bx + fillW - r - x);
				d.rect(x, top, w, barH, colorAt((x + w / 2 - bx) / barW));
			}
		} else if (fillW > 0) d.circle(bx + fillW / 2, cy, fillW / 2, colorAt(0));
		if (fillW > 2) {
			const edgeX = bx + Math.max(r, fillW - r);
			d.circle(edgeX, cy, barH * .9, "#ffffff", .12);
			for (let i = 0; i < 14; i++) {
				let lp = (t / 650 + hash(i, 1)) % 1;
				if (lp < 0) lp += 1;
				const ang = -Math.PI / 2 + (hash(i, 2) - .5) * 2.2;
				const dist = (18 + hash(i, 3) * 46) * lp;
				const px = edgeX + Math.cos(ang) * dist * .6;
				const py = cy + Math.sin(ang) * dist + 26 * lp * lp;
				d.circle(px, py, (1 - lp) * 2.3 + .3, "#d6fbff", (1 - lp) * .85);
			}
		}
		this.font ??= this.game.assets.font({ font: "bold 15px monospace" });
		d.text(this.font, Math.round(p * 100) + "%", W / 2, top + barH + 12, {
			align: "center",
			color: "#8b93b5"
		});
	}
};
/**
* Draw a rounded capsule (a rect with semicircular end caps) from the
* primitives `Draw` exposes. Degrades to a single dot while the width is
* smaller than the height, so a just-started fill grows smoothly from a point.
*/
function capsule(d, x, y, w, h, color, alpha = 1) {
	if (w <= 0) return;
	const r = h / 2;
	const midY = y + r;
	if (w <= h) {
		d.circle(x + w / 2, midY, w / 2, color, alpha);
		return;
	}
	d.rect(x + r, y, w - h, h, color, alpha);
	d.circle(x + r, midY, r, color, alpha);
	d.circle(x + w - r, midY, r, color, alpha);
}
var GRAD_STOPS = [
	[
		95,
		209,
		255
	],
	[
		43,
		217,
		198
	],
	[
		61,
		139,
		255
	],
	[
		151,
		66,
		245
	]
];
var GRAD_LUT = Array.from({ length: 120 }, (_, k) => {
	const f = k / 120 * GRAD_STOPS.length;
	const i = Math.floor(f), fr = f - i;
	const a = GRAD_STOPS[i % GRAD_STOPS.length], b = GRAD_STOPS[(i + 1) % GRAD_STOPS.length];
	const ch = (j) => Math.round(a[j] + (b[j] - a[j]) * fr);
	return "#" + (1 << 24 | ch(0) << 16 | ch(1) << 8 | ch(2)).toString(16).slice(1);
});
/** Stable per-spark pseudo-random in [0,1) — deterministic so sparks don't jitter frame-to-frame. */
function hash(i, salt) {
	const n = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
	return n - Math.floor(n);
}
//#endregion
//#region src/lib/debug.ts
var BODY_COLORS = {
	dynamic: "#46e08a",
	static: "#59a1ff",
	kinematic: "#ffb347",
	sensor: "#c58bff",
	none: "#8a93b5"
};
/**
* Normalise the public `game.debug` value. Exported from the barrel (and so
* from the shipped `.d.ts`) because the dist tests exercise it directly — set
* `game.debug` rather than calling this.
*/
function normalizeDebug(v) {
	if (v === false) return null;
	const o = v === true ? {} : v;
	return {
		hitboxes: o.hitboxes ?? true,
		velocity: o.velocity ?? true,
		touching: o.touching ?? true,
		tiles: o.tiles ?? true,
		stats: o.stats ?? true,
		textBounds: o.textBounds ?? true
	};
}
/** Renders the overlay each frame — constructed once by Game; drive it with `game.debug`. */
var DebugOverlay = class {
	font = null;
	fps = 60;
	draw(d, hud, scene, opts, ctx) {
		if (ctx.dt > 0) this.fps += (1 / ctx.dt - this.fps) * .05;
		if (opts.tiles) this.drawTiles(d, scene, ctx.view);
		if (opts.textBounds) {
			this.drawTextBounds(d);
			this.drawTextBounds(hud);
		}
		for (const s of scene.sprites) {
			if (s.dead) continue;
			if (opts.hitboxes) this.outline(d, s);
			if (opts.velocity && (s.vel.x !== 0 || s.vel.y !== 0)) {
				d.line(s.centerX, s.centerY, s.centerX + s.vel.x * .15, s.centerY + s.vel.y * .15, 1, "#ffd147", .9);
				d.circle(s.centerX + s.vel.x * .15, s.centerY + s.vel.y * .15, 1.6, "#ffd147", .9);
			}
			if (opts.touching) this.contacts(d, s);
		}
		if (opts.stats) {
			this.font ??= ctx.font();
			const parts = [
				`FPS ${Math.round(this.fps)}`,
				`SPRITES ${scene.sprites.length}`,
				`PARTICLES ${ctx.particles}`
			];
			if (ctx.counts3d) parts.push(`3D ${ctx.counts3d.meshes}m/${ctx.counts3d.billboards}b/${ctx.counts3d.draws}dc`);
			hud.rect(0, hud.h - 20, hud.w, 20, "#000000", .55);
			hud.text(this.font, parts.join("  "), 6, hud.h - 16, { color: "#5cd9b3" });
		}
	}
	/**
	* Outline every text block drawn on this surface, reddening any that collide.
	* The boxes are the PAINTED extents (stroke/glow/shadow/plate + the hover
	* state), which is why a HUD that looks fine by text size can still clash.
	*/
	drawTextBounds(d) {
		const boxes = d.textBoxes;
		if (!boxes.length) return;
		for (let i = 0; i < boxes.length; i++) {
			const a = boxes[i];
			let clash = false;
			for (let j = 0; j < boxes.length && !clash; j++) {
				if (j === i) continue;
				const b = boxes[j];
				clash = a.x < b.right && b.x < a.right && a.y < b.bottom && b.y < a.bottom;
			}
			const c = clash ? "#ff4d6d" : "#46e08a";
			const t = clash ? 2 : 1;
			d.line(a.x, a.y, a.right, a.y, t, c, .95);
			d.line(a.right, a.y, a.right, a.bottom, t, c, .95);
			d.line(a.right, a.bottom, a.x, a.bottom, t, c, .95);
			d.line(a.x, a.bottom, a.x, a.y, t, c, .95);
			if (clash) d.rect(a.x, a.y, a.w, a.h, "#ff4d6d", .12);
		}
	}
	outline(d, s) {
		const c = BODY_COLORS[s.body] ?? "#ffffff";
		d.line(s.x, s.y, s.x + s.w, s.y, 1, c, .9);
		d.line(s.x + s.w, s.y, s.x + s.w, s.y + s.h, 1, c, .9);
		d.line(s.x + s.w, s.y + s.h, s.x, s.y + s.h, 1, c, .9);
		d.line(s.x, s.y + s.h, s.x, s.y, 1, c, .9);
	}
	contacts(d, s) {
		const t = s.touching;
		const T = 2.5;
		if (t.down) d.rect(s.x + 1, s.y + s.h - T, s.w - 2, T, "#ff5c5c", .85);
		if (t.up) d.rect(s.x + 1, s.y, s.w - 2, T, "#ff5c5c", .85);
		if (t.left) d.rect(s.x, s.y + 1, T, s.h - 2, "#ff5c5c", .85);
		if (t.right) d.rect(s.x + s.w - T, s.y + 1, T, s.h - 2, "#ff5c5c", .85);
	}
	drawTiles(d, scene, view) {
		const map = scene.collisionMap;
		if (!(map instanceof CollisionGrid)) return;
		const ts = map.tilesize;
		const x0 = Math.max(0, Math.floor(view.x / ts));
		const y0 = Math.max(0, Math.floor(view.y / ts));
		const x1 = Math.min((map.data[0]?.length ?? 0) - 1, Math.ceil((view.x + view.w) / ts));
		const y1 = Math.min(map.data.length - 1, Math.ceil((view.y + view.h) / ts));
		for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
			const t = map.data[ty]?.[tx] ?? 0;
			if (t === 0) continue;
			const wx = tx * ts, wy = ty * ts;
			const def = map.tiledef[t];
			if (def) d.line(wx + def[0] * ts, wy + def[1] * ts, wx + def[2] * ts, wy + def[3] * ts, 1.2, "#ff9de2", .9);
			else {
				d.rect(wx, wy, ts, ts, "#59a1ff", .1);
				d.line(wx, wy, wx + ts, wy, .8, "#59a1ff", .45);
				d.line(wx, wy + ts, wx + ts, wy + ts, .8, "#59a1ff", .45);
				d.line(wx, wy, wx, wy + ts, .8, "#59a1ff", .45);
				d.line(wx + ts, wy, wx + ts, wy + ts, .8, "#59a1ff", .45);
			}
		}
	}
};
//#endregion
//#region src/lib/msdf-font.ts
function parseVariant(atlas, v, name) {
	const yUp = atlas.yOrigin === "bottom";
	const W = atlas.width, Hh = atlas.height;
	const glyphs = /* @__PURE__ */ new Map();
	for (const g of v.glyphs) {
		const pb = g.planeBounds, ab = g.atlasBounds;
		if (!pb || !ab) {
			glyphs.set(g.unicode, {
				code: g.unicode,
				advance: g.advance,
				xOffset: 0,
				yOffset: 0,
				w: 0,
				h: 0,
				uMin: 0,
				uMax: 0,
				vTop: 0,
				vBottom: 0,
				kerning: /* @__PURE__ */ new Map()
			});
			continue;
		}
		const w = pb.right - pb.left;
		const h = yUp ? pb.top - pb.bottom : pb.bottom - pb.top;
		const yOffset = yUp ? -pb.top : pb.top;
		const uMin = Math.min(ab.left, ab.right) / W;
		const uMax = Math.max(ab.left, ab.right) / W;
		let vTop, vBottom;
		if (yUp) {
			vTop = (Hh - Math.max(ab.top, ab.bottom)) / Hh;
			vBottom = (Hh - Math.min(ab.top, ab.bottom)) / Hh;
		} else {
			vTop = Math.min(ab.top, ab.bottom) / Hh;
			vBottom = Math.max(ab.top, ab.bottom) / Hh;
		}
		glyphs.set(g.unicode, {
			code: g.unicode,
			advance: g.advance,
			xOffset: pb.left,
			yOffset,
			w,
			h,
			uMin,
			uMax,
			vTop,
			vBottom,
			kerning: /* @__PURE__ */ new Map()
		});
	}
	for (const k of v.kerning ?? []) glyphs.get(k.unicode1)?.kerning.set(k.unicode2, k.advance);
	const m = v.metrics;
	return {
		name,
		fieldType: atlas.type,
		distanceRange: atlas.distanceRange,
		atlasWidth: W,
		atlasHeight: Hh,
		ascent: Math.abs(m.ascender),
		descent: Math.abs(m.descender),
		lineHeight: m.lineHeight,
		underlineOffset: yUp ? -m.underlineY : m.underlineY,
		underlineThickness: m.underlineThickness,
		glyphs
	};
}
/**
* Parse an msdf-atlas-gen JSON into one entry per font face. A single-font JSON
* yields one entry; a merged (`-and`) atlas yields one per variant, all sharing
* the same texture. Pure — no DOM/GPU.
*/
function parseMsdfFont(json, baseName = "MSDF") {
	if (json.variants) return json.variants.map((v, i) => parseVariant(json.atlas, v, v.name || `${baseName}#${i}`));
	return [parseVariant(json.atlas, {
		metrics: json.metrics,
		glyphs: json.glyphs,
		kerning: json.kerning
	}, baseName)];
}
/**
* A loaded MSDF font: parsed metrics/glyphs + a GPU atlas texture. Faces sharing
* a merged atlas share one `texture`. Get a glyph with `glyph(code)`; measure a
* line with `measure(text, size)`. Draw with `game.assets.msdfText(...)` / `d.msdfText`.
*/
var MsdfFont = class {
	data;
	view;
	faces;
	constructor(data, view, faces = /* @__PURE__ */ new Map()) {
		this.data = data;
		this.view = view;
		this.faces = faces;
	}
	get name() {
		return this.data.name;
	}
	get isMtsdf() {
		return this.data.fieldType === "mtsdf";
	}
	/** distanceRange / atlasSize — the shader's per-texture AA unit (x, y). */
	get unitRange() {
		return [this.data.distanceRange / this.data.atlasWidth, this.data.distanceRange / this.data.atlasHeight];
	}
	/** 1 / distanceRange — normalises weight/outline/shadow into field fractions. */
	get invRange() {
		return 1 / this.data.distanceRange;
	}
	glyph(code) {
		return this.data.glyphs.get(code);
	}
	/** Another face packed in the same merged atlas, or `undefined`. */
	face(name) {
		return this.faces.get(name);
	}
	/** Rendered width of a single line (no newlines), in pixels at `fontSize`. */
	measure(text, fontSize = 48, letterSpacing = 0) {
		let w = 0, prev = 0, count = 0;
		for (let i = 0; i < text.length; i++) {
			const code = text.charCodeAt(i);
			const g = this.data.glyphs.get(code);
			if (!g) {
				prev = 0;
				continue;
			}
			if (prev !== 0) w += (this.data.glyphs.get(prev)?.kerning.get(code) ?? 0) * fontSize;
			w += g.advance * fontSize;
			prev = code;
			count++;
		}
		if (letterSpacing !== 0 && count > 0) w += letterSpacing * count;
		return w;
	}
};
/**
* Upload an MSDF atlas image to a sampleable texture. MSDF/MTSDF values are raw
* distances, so the copy must NOT premultiply alpha (the MTSDF alpha channel is
* a true SDF, not opacity) — `copyExternalImageToTexture` leaves it unpremult
* by default, which is exactly what we want. Linear filtering (set on the
* renderer's sampler) is mandatory for MSDF.
*/
function msdfTextureFrom(device, img, w, h) {
	const texture = device.createTexture({
		size: {
			width: w,
			height: h
		},
		format: "rgba8unorm",
		usage: 22
	});
	device.queue.copyExternalImageToTexture({ source: img }, {
		texture,
		premultipliedAlpha: false
	}, {
		width: w,
		height: h
	});
	return texture;
}
//#endregion
//#region src/lib/audio.ts
/** Audio system — SFX (synthesised or sampled) and streamed music through a single WebAudio graph. Accessed as `this.game.sound` on every scene. */
/**
* Frequency in Hz of a named note — `'C5'`, `'F#4'`, `'Bb3'` (letter, optional `#`/`b`, octave).
* Equal temperament, A4 = 440. Returns 0 for an unrecognised name.
*/
function noteFreq(name) {
	const m = /^([a-g])([#b]?)(\d)$/i.exec(name.trim());
	if (!m) return 0;
	let semi = {
		c: -9,
		d: -7,
		e: -5,
		f: -4,
		g: -2,
		a: 0,
		b: 2
	}[m[1].toLowerCase()];
	if (m[2] === "#") semi += 1;
	else if (m[2] === "b") semi -= 1;
	semi += (parseInt(m[3], 10) - 4) * 12;
	return 440 * Math.pow(2, semi / 12);
}
/**
* Parse jingle notation: whitespace-separated tokens, each a note (`C5`), a chord
* (`C4+E4+G4`), or a rest (`-`); any token takes a length multiplier (`C5:3`, `-:2`).
* Unrecognised tokens advance time like a rest, so rhythm survives a typo.
*/
function parseJingle(notation) {
	const events = [];
	let pos = 0;
	for (const token of notation.trim().split(/\s+/)) {
		if (!token) continue;
		const sep = token.indexOf(":");
		const head = sep >= 0 ? token.slice(0, sep) : token;
		const lenStr = sep >= 0 ? token.slice(sep + 1) : "";
		const parsed = parseFloat(lenStr);
		const len = lenStr && isFinite(parsed) && parsed > 0 ? parsed : 1;
		if (head !== "-" && head !== ".") {
			const freqs = head.split("+").map(noteFreq).filter((f) => f > 0);
			if (freqs.length > 0) events.push({
				freqs,
				start: pos,
				len
			});
		}
		pos += len;
	}
	return {
		events,
		total: pos
	};
}
/** Audio service (SFX / music / master volume). The Game owns one as `this.sound`. The AudioContext is created lazily on the first user gesture (browser autoplay policy). All methods are no-ops where WebAudio is unavailable. */
var Audio = class {
	ctx = null;
	volumeNode = null;
	muteNode = null;
	recordDest = null;
	destroyed = false;
	defs = /* @__PURE__ */ new Map();
	buffers = /* @__PURE__ */ new Map();
	musicEl = null;
	musicGain = null;
	musicViaWebAudio = false;
	masterVolume;
	wake = null;
	_muted = false;
	constructor(masterVolume = .25) {
		this.masterVolume = masterVolume;
		if (typeof window !== "undefined") {
			this.wake = () => {
				this.ensure();
			};
			window.addEventListener("pointerdown", this.wake, { once: true });
			window.addEventListener("keydown", this.wake, { once: true });
		}
	}
	ensure() {
		if (this.destroyed) return null;
		try {
			if (!this.ctx) {
				this.ctx = new AudioContext();
				this.volumeNode = this.ctx.createGain();
				this.volumeNode.gain.value = this.masterVolume;
				this.muteNode = this.ctx.createGain();
				this.muteNode.gain.value = this._muted ? 0 : 1;
				this.volumeNode.connect(this.muteNode);
				this.muteNode.connect(this.ctx.destination);
			}
			if (this.ctx.state === "suspended") this.ctx.resume();
			return this.ctx;
		} catch {
			return null;
		}
	}
	/** Pulse-shaped PeriodicWave per duty cycle (quantised), built lazily per AudioContext. */
	pulseWaves = /* @__PURE__ */ new Map();
	/** WaveShaper curves per distortion drive (quantised). */
	shaperCurves = /* @__PURE__ */ new Map();
	/** Build (and cache) a pulse wave of width `duty` from its Fourier series. */
	pulseWave(c, duty) {
		const d = Math.min(.48, Math.max(.02, duty));
		const key = Math.round(d * 100);
		let wave = this.pulseWaves.get(key);
		if (!wave) {
			const harmonics = 32;
			const real = /* @__PURE__ */ new Float32Array(33);
			const imag = /* @__PURE__ */ new Float32Array(33);
			for (let n = 1; n <= harmonics; n++) real[n] = 2 / (n * Math.PI) * Math.sin(n * Math.PI * d);
			wave = c.createPeriodicWave(real, imag);
			this.pulseWaves.set(key, wave);
		}
		return wave;
	}
	/** Build (and cache) a soft-clip waveshaper curve for a 0→1 drive. */
	distortionCurve(amount) {
		const key = Math.round(Math.min(1, Math.max(0, amount)) * 50);
		let curve = this.shaperCurves.get(key);
		if (!curve) {
			const k = key / 50 * 60;
			const n = 256;
			curve = new Float32Array(n);
			for (let i = 0; i < n; i++) {
				const x = i * 2 / (n - 1) - 1;
				curve[i] = (1 + k) * x / (1 + k * Math.abs(x));
			}
			this.shaperCurves.set(key, curve);
		}
		return curve;
	}
	playSpec(spec) {
		const c = this.ensure();
		if (!c || !this.volumeNode) return;
		if (typeof spec.notes === "string") {
			this.playJingle(c, spec, spec.notes);
			return;
		}
		const { type = "square", freq = 440, freqEnd, sweep = "linear", notes, duration = .15, volume = 1, attack = .005, release = .06, curve = "linear", jitter = 0, vibrato, duty, filter, distortion = 0, pan = 0, delay = 0 } = spec;
		if (volume <= 0 || duration <= 0) return;
		const t0 = c.currentTime + Math.max(0, delay);
		const end = t0 + duration;
		const jit = Math.min(1, Math.max(0, jitter));
		const pitchMul = jit > 0 ? 1 + (Math.random() * 2 - 1) * jit : 1;
		const gain = c.createGain();
		gain.connect(this.volumeNode);
		gain.gain.setValueAtTime(0, t0);
		gain.gain.linearRampToValueAtTime(volume, t0 + attack);
		gain.gain.setValueAtTime(volume, t0 + Math.max(attack, duration - release));
		if (curve === "exponential") {
			gain.gain.exponentialRampToValueAtTime(Math.max(1e-4, volume * .001), end);
			gain.gain.setValueAtTime(0, end);
		} else gain.gain.linearRampToValueAtTime(0, end);
		let src;
		if (type === "noise") {
			const frames = Math.max(1, Math.floor(c.sampleRate * duration * Math.max(1, pitchMul)));
			const buffer = c.createBuffer(1, frames, c.sampleRate);
			const data = buffer.getChannelData(0);
			for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;
			const node = c.createBufferSource();
			node.buffer = buffer;
			if (pitchMul !== 1) node.playbackRate.setValueAtTime(pitchMul, t0);
			src = node;
		} else {
			const osc = c.createOscillator();
			if (type === "square" && duty !== void 0 && duty > 0 && duty < .5) osc.setPeriodicWave(this.pulseWave(c, duty));
			else osc.type = type;
			if (Array.isArray(notes) && notes.length > 0) {
				const step = duration / notes.length;
				for (let i = 0; i < notes.length; i++) osc.frequency.setValueAtTime(Math.max(1, notes[i] * pitchMul), t0 + i * step);
			} else {
				osc.frequency.setValueAtTime(Math.max(1, freq * pitchMul), t0);
				if (freqEnd !== void 0) if (sweep === "exponential") osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd * pitchMul), end);
				else osc.frequency.linearRampToValueAtTime(Math.max(1, freqEnd * pitchMul), end);
			}
			if (vibrato) {
				const lfo = c.createOscillator();
				lfo.frequency.setValueAtTime(vibrato.freq ?? 8, t0);
				const lfoGain = c.createGain();
				const base = (Array.isArray(notes) && notes.length > 0 ? notes[0] : freq) * pitchMul;
				lfoGain.gain.setValueAtTime((vibrato.depth ?? .06) * base, t0);
				lfo.connect(lfoGain);
				lfoGain.connect(osc.frequency);
				lfo.start(t0);
				lfo.stop(end);
			}
			src = osc;
		}
		let node = src;
		if (filter) {
			const f = c.createBiquadFilter();
			f.type = filter.type ?? "lowpass";
			f.Q.setValueAtTime(filter.q ?? 1, t0);
			f.frequency.setValueAtTime(Math.max(10, filter.freq ?? 1e3), t0);
			if (filter.freqEnd !== void 0) f.frequency.exponentialRampToValueAtTime(Math.max(10, filter.freqEnd), end);
			node.connect(f);
			node = f;
		}
		if (distortion > 0) {
			const shaper = c.createWaveShaper();
			shaper.curve = this.distortionCurve(distortion);
			node.connect(shaper);
			node = shaper;
		}
		if (pan !== 0 && typeof c.createStereoPanner === "function") {
			const p = c.createStereoPanner();
			p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t0);
			node.connect(p);
			node = p;
		}
		node.connect(gain);
		src.start(t0);
		src.stop(end);
	}
	/**
	* Play a jingle (`notes` as notation string): every note/chord is its own enveloped
	* voice — real articulation between notes — all feeding one shared
	* filter → distortion → pan → volume chain into the master.
	*/
	playJingle(c, spec, notation) {
		if (!this.volumeNode) return;
		const { type = "square", volume = 1, attack = .005, release, curve = "linear", jitter = 0, vibrato, duty, filter, distortion = 0, pan = 0, delay = 0, step = .12 } = spec;
		if (volume <= 0 || step <= 0) return;
		const { events, total } = parseJingle(notation);
		if (events.length === 0) return;
		const t0 = c.currentTime + Math.max(0, delay);
		const end = t0 + total * step;
		const jit = Math.min(1, Math.max(0, jitter));
		const volGain = c.createGain();
		volGain.gain.setValueAtTime(volume, t0);
		volGain.connect(this.volumeNode);
		let chainIn = volGain;
		if (pan !== 0 && typeof c.createStereoPanner === "function") {
			const p = c.createStereoPanner();
			p.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), t0);
			p.connect(chainIn);
			chainIn = p;
		}
		if (distortion > 0) {
			const shaper = c.createWaveShaper();
			shaper.curve = this.distortionCurve(distortion);
			shaper.connect(chainIn);
			chainIn = shaper;
		}
		if (filter) {
			const f = c.createBiquadFilter();
			f.type = filter.type ?? "lowpass";
			f.Q.setValueAtTime(filter.q ?? 1, t0);
			f.frequency.setValueAtTime(Math.max(10, filter.freq ?? 1e3), t0);
			if (filter.freqEnd !== void 0) f.frequency.exponentialRampToValueAtTime(Math.max(10, filter.freqEnd), end);
			f.connect(chainIn);
			chainIn = f;
		}
		for (const ev of events) {
			const nStart = t0 + ev.start * step;
			const nDur = ev.len * step * .92;
			const nEnd = nStart + nDur;
			const att = Math.min(attack, nDur * .3);
			const rel = Math.min(release ?? Math.max(.02, nDur * .35), nDur * .8);
			const peak = 1 / Math.sqrt(ev.freqs.length);
			const env = c.createGain();
			env.connect(chainIn);
			env.gain.setValueAtTime(0, nStart);
			env.gain.linearRampToValueAtTime(peak, nStart + att);
			env.gain.setValueAtTime(peak, nStart + Math.max(att, nDur - rel));
			if (curve === "exponential") {
				env.gain.exponentialRampToValueAtTime(1e-4, nEnd);
				env.gain.setValueAtTime(0, nEnd);
			} else env.gain.linearRampToValueAtTime(0, nEnd);
			const pitchMul = jit > 0 ? 1 + (Math.random() * 2 - 1) * jit : 1;
			for (const f of ev.freqs) {
				const osc = c.createOscillator();
				if (type === "square" && duty !== void 0 && duty > 0 && duty < .5) osc.setPeriodicWave(this.pulseWave(c, duty));
				else if (type !== "noise") osc.type = type;
				osc.frequency.setValueAtTime(Math.max(1, f * pitchMul), nStart);
				if (vibrato) {
					const lfo = c.createOscillator();
					lfo.frequency.setValueAtTime(vibrato.freq ?? 8, nStart);
					const lfoGain = c.createGain();
					lfoGain.gain.setValueAtTime((vibrato.depth ?? .06) * f * pitchMul, nStart);
					lfo.connect(lfoGain);
					lfoGain.connect(osc.frequency);
					lfo.start(nStart);
					lfo.stop(nEnd);
				}
				osc.connect(env);
				osc.start(nStart);
				osc.stop(nEnd);
			}
		}
	}
	loadSample(url) {
		if (this.buffers.has(url)) return Promise.resolve();
		const c = this.ensure();
		if (!c || typeof fetch === "undefined") return Promise.resolve();
		return (async () => {
			try {
				const data = await (await fetch(url)).arrayBuffer();
				this.buffers.set(url, await c.decodeAudioData(data));
			} catch {}
		})();
	}
	playSample(url) {
		const c = this.ensure();
		if (!c || !this.volumeNode) return;
		const buf = this.buffers.get(url);
		if (!buf) {
			this.loadSample(url);
			return;
		}
		const gain = c.createGain();
		gain.connect(this.volumeNode);
		const node = c.createBufferSource();
		node.buffer = buf;
		node.connect(gain);
		node.start();
	}
	playSound(sound) {
		if (typeof sound === "string") this.playSample(sound);
		else if (Array.isArray(sound)) for (const layer of sound) this.playSpec(layer);
		else this.playSpec(sound);
	}
	/** Play a named sound (registered with `define`), an inline `SoundSpec`, or an array of specs fired together (layer a compound sound — stagger layers with `delay`). Use for one-shot SFX / audio cues. */
	play(sound) {
		if (typeof sound === "string") {
			const def = this.defs.get(sound);
			if (def !== void 0) this.playSound(def);
		} else this.playSound(sound);
	}
	/** Register a reusable sound under a name — a `SoundSpec`, an array of specs (a layered sound), or a URL to an audio file (mp3/ogg/wav). Audio files are preloaded immediately. Call during scene `preload` or `setup`. */
	define(name, sound) {
		this.defs.set(name, sound);
		if (typeof sound === "string") this.loadSample(sound);
	}
	/** Preload an audio file by URL so the first `play` is gapless. Resolves when the file is decoded and cached. */
	load(url) {
		return this.loadSample(url);
	}
	/** `true` if `url`'s sample has already been decoded and cached — so re-queuing it needs no load. */
	isLoaded(url) {
		return this.buffers.has(url);
	}
	/** `true` when all audio is silenced (master gain forced to 0). */
	get muted() {
		return this._muted;
	}
	/** Silence (`on = true`, the default) or restore all audio by forcing/relaxing the master gain. Music keeps playing (muted), so unmuting never restarts the track. Persists if set before the first sound plays. */
	mute(on = true) {
		this._muted = on;
		if (this.muteNode) this.muteNode.gain.value = on ? 0 : 1;
		if (this.musicEl && !this.musicViaWebAudio) this.musicEl.muted = on;
	}
	/** Flip the mute state and return it — handy for a mute button. */
	toggleMute() {
		this.mute(!this._muted);
		return this._muted;
	}
	/**
	* @internal Begin tapping the master mix (post-volume, pre-mute) as a live
	* MediaStream for {@link Game.record}, returning the audio track to add to the
	* recorder's stream — or null if no audio graph exists yet (a game that has made
	* no sound records video only). The tap is independent of mute, so a clip has
	* sound even when the game is muted locally.
	*/
	captureStreamTrack() {
		if (!this.ctx || !this.volumeNode) return null;
		if (this.ctx.state === "suspended") this.ctx.resume();
		if (!this.recordDest) {
			this.recordDest = this.ctx.createMediaStreamDestination();
			this.volumeNode.connect(this.recordDest);
		}
		return this.recordDest.stream.getAudioTracks()[0] ?? null;
	}
	/** @internal Stop the record tap started by {@link captureStreamTrack} and release it. */
	stopCapture() {
		if (this.recordDest && this.volumeNode) try {
			this.volumeNode.disconnect(this.recordDest);
		} catch {}
		this.recordDest = null;
	}
	/** Stream and loop a music track from a URL (BGM / background music / chiptune). Replaces any currently playing track. */
	music(url, opts = {}) {
		const c = this.ensure();
		if (!c || !this.volumeNode || typeof globalThis.Audio === "undefined") return;
		const { loop = true, volume = 1, fadeIn = 0 } = opts;
		if (this.musicEl) {
			this.musicEl.pause();
			this.musicEl = null;
		}
		const el = new globalThis.Audio(url);
		el.crossOrigin = "anonymous";
		el.loop = loop;
		const gain = c.createGain();
		gain.connect(this.volumeNode);
		try {
			c.createMediaElementSource(el).connect(gain);
			this.musicViaWebAudio = true;
		} catch {
			this.musicViaWebAudio = false;
			el.volume = volume * this.masterVolume;
			el.muted = this._muted;
		}
		const now = c.currentTime;
		gain.gain.setValueAtTime(fadeIn > 0 ? 0 : volume, now);
		if (fadeIn > 0) gain.gain.linearRampToValueAtTime(volume, now + fadeIn);
		this.musicEl = el;
		this.musicGain = gain;
		el.play().catch(() => {});
	}
	/** Stop the currently playing music track. Pass `{ fadeOut: seconds }` for a smooth fade. */
	stopMusic(opts = {}) {
		const el = this.musicEl;
		const gain = this.musicGain;
		if (!el) return;
		const fade = opts.fadeOut ?? 0;
		if (fade > 0 && gain && this.ctx) {
			const now = this.ctx.currentTime;
			gain.gain.linearRampToValueAtTime(0, now + fade);
			setTimeout(() => el.pause(), fade * 1e3);
		} else el.pause();
		this.musicEl = null;
		this.musicGain = null;
	}
	/** Master volume 0→1. Affects all SFX and music simultaneously. Default 0.25. */
	get volume() {
		return this.masterVolume;
	}
	set volume(v) {
		this.masterVolume = Math.max(0, Math.min(1, v));
		if (this.volumeNode) this.volumeNode.gain.value = this.masterVolume;
	}
	/** Suspend all audio output (SFX + music) — use when showing a pause overlay. */
	pause() {
		if (this.musicEl) this.musicEl.pause();
		if (this.ctx && this.ctx.state !== "suspended") this.ctx.suspend();
	}
	/** Resume audio after `pause()` or after the browser's autoplay-suspended boot. */
	resume() {
		this.ensure();
		if (this.musicEl) this.musicEl.play().catch(() => {});
	}
	/** Tear down the audio system: stop music, close the AudioContext, remove event listeners. After this every method is a no-op. Called automatically by `Game.destroy()`. */
	destroy() {
		this.destroyed = true;
		if (this.wake && typeof window !== "undefined") {
			window.removeEventListener("pointerdown", this.wake);
			window.removeEventListener("keydown", this.wake);
		}
		this.wake = null;
		if (this.musicEl) this.musicEl.pause();
		this.musicEl = null;
		this.musicGain = null;
		if (this.ctx) this.ctx.close().catch(() => {});
		this.ctx = null;
		this.volumeNode = null;
		this.muteNode = null;
		this.recordDest = null;
		this.defs.clear();
		this.buffers.clear();
		this.pulseWaves.clear();
		this.shaperCurves.clear();
	}
};
//#endregion
//#region src/lib/tween/shifty/standard-easing-functions.ts
/* istanbul ignore file */
/*!
* All equations are adapted from Thomas Fuchs'
* [Scripty2](https://github.com/madrobby/scripty2/blob/master/src/effects/transitions/penner.js).
*
* Based on Easing Equations (c) 2003 [Robert
* Penner](http://www.robertpenner.com/), all rights reserved. This work is
* [subject to terms](http://www.robertpenner.com/easing_terms_of_use.html).
*/
/*!
*  TERMS OF USE - EASING EQUATIONS
*  Open source under the BSD License.
*  Easing Equations (c) 2003 Robert Penner, all rights reserved.
*/
/**
* The standard set of easing functions availble for use with Shifty tweens.
*
* This is distinct from `Tweenable`'s {@link Tweenable.easing}. {@link
* Tweenable.easing} contains everything within `easingFunctions` but also any
* custom easing functions that you have defined.
*/
var standardEasingFunctions = Object.freeze({
	linear: (pos) => pos,
	easeInQuad: (pos) => Math.pow(pos, 2),
	easeOutQuad: (pos) => -(Math.pow(pos - 1, 2) - 1),
	easeInOutQuad: (pos) => (pos /= .5) < 1 ? .5 * Math.pow(pos, 2) : -.5 * ((pos -= 2) * pos - 2),
	easeInCubic: (pos) => Math.pow(pos, 3),
	easeOutCubic: (pos) => Math.pow(pos - 1, 3) + 1,
	easeInOutCubic: (pos) => (pos /= .5) < 1 ? .5 * Math.pow(pos, 3) : .5 * (Math.pow(pos - 2, 3) + 2),
	easeInQuart: (pos) => Math.pow(pos, 4),
	easeOutQuart: (pos) => -(Math.pow(pos - 1, 4) - 1),
	easeInOutQuart: (pos) => (pos /= .5) < 1 ? .5 * Math.pow(pos, 4) : -.5 * ((pos -= 2) * Math.pow(pos, 3) - 2),
	easeInQuint: (pos) => Math.pow(pos, 5),
	easeOutQuint: (pos) => Math.pow(pos - 1, 5) + 1,
	easeInOutQuint: (pos) => (pos /= .5) < 1 ? .5 * Math.pow(pos, 5) : .5 * (Math.pow(pos - 2, 5) + 2),
	easeInSine: (pos) => -Math.cos(pos * (Math.PI / 2)) + 1,
	easeOutSine: (pos) => Math.sin(pos * (Math.PI / 2)),
	easeInOutSine: (pos) => -.5 * (Math.cos(Math.PI * pos) - 1),
	easeInExpo: (pos) => pos === 0 ? 0 : Math.pow(2, 10 * (pos - 1)),
	easeOutExpo: (pos) => pos === 1 ? 1 : -Math.pow(2, -10 * pos) + 1,
	easeInOutExpo: (pos) => {
		if (pos === 0) return 0;
		if (pos === 1) return 1;
		if ((pos /= .5) < 1) return .5 * Math.pow(2, 10 * (pos - 1));
		return .5 * (-Math.pow(2, -10 * --pos) + 2);
	},
	easeInCirc: (pos) => -(Math.sqrt(1 - pos * pos) - 1),
	easeOutCirc: (pos) => Math.sqrt(1 - Math.pow(pos - 1, 2)),
	easeInOutCirc: (pos) => (pos /= .5) < 1 ? -.5 * (Math.sqrt(1 - pos * pos) - 1) : .5 * (Math.sqrt(1 - (pos -= 2) * pos) + 1),
	easeOutBounce: (pos) => {
		if (pos < 1 / 2.75) return 7.5625 * pos * pos;
		else if (pos < 2 / 2.75) return 7.5625 * (pos -= 1.5 / 2.75) * pos + .75;
		else if (pos < 2.5 / 2.75) return 7.5625 * (pos -= 2.25 / 2.75) * pos + .9375;
		else return 7.5625 * (pos -= 2.625 / 2.75) * pos + .984375;
	},
	easeInBack: (pos) => {
		return pos * pos * (2.70158 * pos - 1.70158);
	},
	easeOutBack: (pos) => {
		return (pos = pos - 1) * pos * (2.70158 * pos + 1.70158) + 1;
	},
	easeInOutBack: (pos) => {
		let s = 1.70158;
		if ((pos /= .5) < 1) return .5 * (pos * pos * (((s *= 1.525) + 1) * pos - s));
		return .5 * ((pos -= 2) * pos * (((s *= 1.525) + 1) * pos + s) + 2);
	},
	elastic: (pos) => -1 * Math.pow(4, -8 * pos) * Math.sin((pos * 6 - 1) * (2 * Math.PI) / 2) + 1,
	swingFromTo: (pos) => {
		let s = 1.70158;
		return (pos /= .5) < 1 ? .5 * (pos * pos * (((s *= 1.525) + 1) * pos - s)) : .5 * ((pos -= 2) * pos * (((s *= 1.525) + 1) * pos + s) + 2);
	},
	swingFrom: (pos) => {
		return pos * pos * (2.70158 * pos - 1.70158);
	},
	swingTo: (pos) => {
		return (pos -= 1) * pos * (2.70158 * pos + 1.70158) + 1;
	},
	bounce: (pos) => {
		if (pos < 1 / 2.75) return 7.5625 * pos * pos;
		else if (pos < 2 / 2.75) return 7.5625 * (pos -= 1.5 / 2.75) * pos + .75;
		else if (pos < 2.5 / 2.75) return 7.5625 * (pos -= 2.25 / 2.75) * pos + .9375;
		else return 7.5625 * (pos -= 2.625 / 2.75) * pos + .984375;
	},
	bouncePast: (pos) => {
		if (pos < 1 / 2.75) return 7.5625 * pos * pos;
		else if (pos < 2 / 2.75) return 2 - (7.5625 * (pos -= 1.5 / 2.75) * pos + .75);
		else if (pos < 2.5 / 2.75) return 2 - (7.5625 * (pos -= 2.25 / 2.75) * pos + .9375);
		else return 2 - (7.5625 * (pos -= 2.625 / 2.75) * pos + .984375);
	},
	easeFromTo: (pos) => (pos /= .5) < 1 ? .5 * Math.pow(pos, 4) : -.5 * ((pos -= 2) * Math.pow(pos, 3) - 2),
	easeFrom: (pos) => Math.pow(pos, 4),
	easeTo: (pos) => Math.pow(pos, .25)
});
//#endregion
//#region src/lib/tween/shifty/bezier.ts
/**
* The Bezier magic in this file is adapted/copied almost wholesale from
* [Scripty2](https://github.com/madrobby/scripty2/blob/master/src/effects/transitions/cubic-bezier.js),
* which was adapted from Apple code (which probably came from
* [here](http://opensource.apple.com/source/WebCore/WebCore-955.66/platform/graphics/UnitBezier.h)).
* Special thanks to Apple and Thomas Fuchs for much of this code.
*/
/**
*  Copyright (c) 2006 Apple Computer, Inc. All rights reserved.
*
*  Redistribution and use in source and binary forms, with or without
*  modification, are permitted provided that the following conditions are met:
*
*  1. Redistributions of source code must retain the above copyright notice,
*  this list of conditions and the following disclaimer.
*
*  2. Redistributions in binary form must reproduce the above copyright notice,
*  this list of conditions and the following disclaimer in the documentation
*  and/or other materials provided with the distribution.
*
*  3. Neither the name of the copyright holder(s) nor the names of any
*  contributors may be used to endorse or promote products derived from
*  this software without specific prior written permission.
*
*  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
*  AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
*  IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
*  ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE
*  LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
*  CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
*  SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
*  INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
*  CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
*  ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
*  POSSIBILITY OF SUCH DAMAGE.
*/
/* istanbul ignore next */
function cubicBezierAtTime(t, p1x, p1y, p2x, p2y, duration) {
	let ax = 0, bx = 0, cx = 0, ay = 0, by = 0, cy = 0;
	const sampleCurveX = (t) => ((ax * t + bx) * t + cx) * t;
	const sampleCurveY = (t) => ((ay * t + by) * t + cy) * t;
	const sampleCurveDerivativeX = (t) => (3 * ax * t + 2 * bx) * t + cx;
	const solveEpsilon = (duration) => 1 / (200 * duration);
	const fabs = (n) => n >= 0 ? n : 0 - n;
	const solveCurveX = (x, epsilon) => {
		let t0, t1, t2, x2, d2, i;
		for (t2 = x, i = 0; i < 8; i++) {
			x2 = sampleCurveX(t2) - x;
			if (fabs(x2) < epsilon) return t2;
			d2 = sampleCurveDerivativeX(t2);
			if (fabs(d2) < 1e-6) break;
			t2 = t2 - x2 / d2;
		}
		t0 = 0;
		t1 = 1;
		t2 = x;
		if (t2 < t0) return t0;
		if (t2 > t1) return t1;
		while (t0 < t1) {
			x2 = sampleCurveX(t2);
			if (fabs(x2 - x) < epsilon) return t2;
			if (x > x2) t0 = t2;
			else t1 = t2;
			t2 = (t1 - t0) * .5 + t0;
		}
		return t2;
	};
	const solve = (x, epsilon) => sampleCurveY(solveCurveX(x, epsilon));
	cx = 3 * p1x;
	bx = 3 * (p2x - p1x) - cx;
	ax = 1 - cx - bx;
	cy = 3 * p1y;
	by = 3 * (p2y - p1y) - cy;
	ay = 1 - cy - by;
	return solve(t, solveEpsilon(duration));
}
/**
* Generates a transition easing function that is compatible with WebKit's CSS
* transitions `-webkit-transition-timing-function` CSS property.
*
* The W3C has more information about CSS3 transition timing functions:
* http://www.w3.org/TR/css3-transitions/#transition-timing-function_tag
*/
var getCubicBezierTransition = (x1 = .25, y1 = .25, x2 = .75, y2 = .75) => (pos) => cubicBezierAtTime(pos, x1, y1, x2, y2, 1);
//#endregion
//#region src/lib/tween/shifty/types.ts
/**
* Determines whether or not a given string represents a defined easing curve
* on {@link Tweenable.easing}. This also supports custom easing functions.
*/
var isEasingKey = (key) => {
	return key in Tweenable.easing;
};
//#endregion
//#region src/lib/tween/shifty/token.ts
var token_exports = /* @__PURE__ */ __exportAll({
	afterTween: () => afterTween,
	beforeTween: () => beforeTween,
	doesApply: () => doesApply,
	tweenCreated: () => tweenCreated
});
var R_NUMBER_COMPONENT = /(\d|-|\.)/;
var R_FORMAT_CHUNKS = /([^\-0-9.]+)/g;
var R_UNFORMATTED_VALUES = /[0-9.-]+/g;
var R_RGBA = (() => {
	const number = R_UNFORMATTED_VALUES.source;
	const comma = /,\s*/.source;
	return new RegExp(`rgba?\\(${number}${comma}${number}${comma}${number}(${comma}${number})?\\)`, "g");
})();
var R_RGBA_PREFIX = /^.*\(/;
var R_HEX = /#([0-9]|[a-f]){3,6}/gi;
var VALUE_PLACEHOLDER = "VAL";
var getFormatChunksFrom = (rawValues, prefix) => rawValues.map((_val, i) => `_${prefix}_${i}`);
var getFormatStringFrom = (formattedString) => {
	let chunks = formattedString.match(R_FORMAT_CHUNKS);
	if (!chunks) chunks = ["", ""];
	else if (chunks.length === 1 || formattedString.charAt(0).match(R_NUMBER_COMPONENT)) chunks.unshift("");
	return chunks.join(VALUE_PLACEHOLDER);
};
/**
* Convert a base-16 number to base-10.
*/
function hexToDec(hex) {
	return parseInt(hex, 16);
}
/**
* Convert a hexadecimal string to an array with three items, one each for
* the red, blue, and green decimal values.
*/
var hexToRGBArray = (hex) => {
	hex = hex.replace(/#/, "");
	if (hex.length === 3) {
		const [r, g, b] = hex.split("");
		hex = r + r + g + g + b + b;
	}
	return [
		hexToDec(hex.substring(0, 2)),
		hexToDec(hex.substring(2, 4)),
		hexToDec(hex.substring(4, 6))
	];
};
var convertHexToRGB = (hexString) => `rgb(${hexToRGBArray(hexString).join(",")})`;
/**
* TODO: Can this be rewritten to leverage String#replace more efficiently?
* Runs a filter operation on all chunks of a string that match a RegExp.
*/
var filterStringChunks = (pattern, unfilteredString, filter) => {
	const patternMatches = unfilteredString.match(pattern);
	let filteredString = unfilteredString.replace(pattern, VALUE_PLACEHOLDER);
	if (patternMatches) patternMatches.forEach((match) => filteredString = filteredString.replace(VALUE_PLACEHOLDER, filter(match)));
	return filteredString;
};
var sanitizeHexChunksToRGB = (str) => filterStringChunks(R_HEX, str, convertHexToRGB);
/**
* Convert all hex color values within a string to an rgb string.
*/
var sanitizeObjectForHexProps = (stateObject) => {
	for (const prop in stateObject) {
		const currentProp = stateObject[prop];
		if (typeof currentProp === "string" && currentProp.match(R_HEX)) stateObject[prop] = sanitizeHexChunksToRGB(currentProp);
	}
};
var sanitizeRGBAChunk = (rgbChunk) => {
	const rgbaRawValues = rgbChunk.match(R_UNFORMATTED_VALUES) ?? [];
	const rgbNumbers = rgbaRawValues.slice(0, 3).map((rgbChunk) => Math.floor(Number(rgbChunk)));
	const prefix = rgbChunk.match(R_RGBA_PREFIX)?.[0];
	if (rgbaRawValues.length === 3) return `${prefix}${rgbNumbers.join(",")})`;
	else if (rgbaRawValues.length === 4) return `${prefix}${rgbNumbers.join(",")},${rgbaRawValues[3]})`;
	throw new Error(`Invalid rgbChunk: ${rgbChunk}`);
};
/**
* Check for floating point values within rgb strings and round them.
*/
var sanitizeRGBChunks = (formattedString) => filterStringChunks(R_RGBA, formattedString, sanitizeRGBAChunk);
/**
* NOTE: It's the duty of the caller to convert the Array elements of the
* return value into numbers.  This is a performance optimization.
*/
var getValuesFrom = (formattedString) => formattedString.match(R_UNFORMATTED_VALUES) ?? [];
var getFormatSignatures = (stateObject) => {
	const signatures = {};
	for (const propertyName in stateObject) {
		const property = stateObject[propertyName];
		if (typeof property === "string") signatures[propertyName] = {
			formatString: getFormatStringFrom(property),
			chunkNames: getFormatChunksFrom(getValuesFrom(property)?.map(Number), propertyName)
		};
	}
	return signatures;
};
var expandFormattedProperties = (stateObject, formatSignatures) => {
	for (const propertyName in formatSignatures) {
		getValuesFrom(String(stateObject[propertyName])).forEach((number, i) => stateObject[formatSignatures[propertyName].chunkNames[i]] = +number);
		delete stateObject[propertyName];
	}
};
var extractPropertyChunks = (stateObject, chunkNames) => {
	const extractedValues = {};
	chunkNames.forEach((chunkName) => {
		extractedValues[chunkName] = stateObject[chunkName];
		delete stateObject[chunkName];
	});
	return extractedValues;
};
var getValuesList = (stateObject, chunkNames) => chunkNames.map((chunkName) => Number(stateObject[chunkName]));
var getFormattedValues = (formatString, rawValues) => {
	rawValues.forEach((rawValue) => formatString = formatString.replace(VALUE_PLACEHOLDER, String(+rawValue.toFixed(4))));
	return formatString;
};
var collapseFormattedProperties = (stateObject, formatSignature) => {
	for (const prop in formatSignature) {
		const { chunkNames, formatString } = formatSignature[prop];
		stateObject[prop] = sanitizeRGBChunks(getFormattedValues(formatString, getValuesList(extractPropertyChunks(stateObject, chunkNames), chunkNames)));
	}
};
var expandEasingObject = (easingObject, formatSignature) => {
	for (const prop in formatSignature) {
		const { chunkNames } = formatSignature[prop];
		const easing = easingObject[prop];
		if (typeof easing === "string") {
			const easingNames = easing.split(" ");
			const defaultEasing = easingNames[easingNames.length - 1];
			for (let i = 0; i < chunkNames.length; i++) {
				const chunkName = chunkNames[i];
				const easingName = easingNames[i] ?? defaultEasing;
				if (isEasingKey(easingName)) easingObject[chunkName] = easingName;
			}
		} else chunkNames.forEach((chunkName) => easingObject[chunkName] = easing);
		delete easingObject[prop];
	}
};
var collapseEasingObject = (easingObject, formatSignature) => {
	for (const prop in formatSignature) {
		const { chunkNames } = formatSignature[prop];
		const firstEasing = easingObject[chunkNames[0]];
		if (typeof firstEasing === "string") easingObject[prop] = chunkNames.map((chunkName) => {
			const easingName = easingObject[chunkName];
			delete easingObject[chunkName];
			return easingName;
		}).join(" ");
		else easingObject[prop] = firstEasing;
	}
};
var doesApply = (tweenable) => {
	for (const key in tweenable._currentState) if (typeof tweenable._currentState[key] === "string") return true;
	return false;
};
function tweenCreated(tweenable) {
	const { _currentState, _originalState, _targetState } = tweenable;
	[
		_currentState,
		_originalState,
		_targetState
	].forEach(sanitizeObjectForHexProps);
	tweenable._tokenData = getFormatSignatures(_currentState);
}
function beforeTween(tweenable) {
	const { _currentState, _originalState, _targetState, _easing, _tokenData } = tweenable;
	if (typeof _easing !== "function" && _tokenData) expandEasingObject(_easing, _tokenData);
	[
		_currentState,
		_originalState,
		_targetState
	].forEach((state) => expandFormattedProperties(state, _tokenData ?? {}));
}
function afterTween(tweenable) {
	const { _currentState, _originalState, _targetState, _easing, _tokenData } = tweenable;
	[
		_currentState,
		_originalState,
		_targetState
	].forEach((state) => collapseFormattedProperties(state, _tokenData ?? {}));
	if (typeof _easing !== "function" && _tokenData) collapseEasingObject(_easing, _tokenData);
}
//#endregion
//#region src/lib/tween/shifty/tweenable.ts
var DEFAULT_EASING = "linear";
var DEFAULT_DURATION = 500;
var UPDATE_TIME = 1e3 / 60;
var root = typeof window !== "undefined" ? window : globalThis;
var AFTER_TWEEN = "afterTween";
var AFTER_TWEEN_END = "afterTweenEnd";
var BEFORE_TWEEN = "beforeTween";
var TWEEN_CREATED = "tweenCreated";
var TYPE_STRING = "string";
var TYPE_FUNCTION = "function";
var TYPE_OBJECT = "object";
var scheduleFunction = root.requestAnimationFrame;
if (!scheduleFunction) if (typeof window === "undefined") scheduleFunction = setTimeout;
else {
	const w = window;
	scheduleFunction = w.webkitRequestAnimationFrame || w.oRequestAnimationFrame || w.msRequestAnimationFrame || w.mozCancelRequestAnimationFrame && w.mozRequestAnimationFrame || setTimeout;
}
var noop = () => {};
var listHead = null;
var listTail = null;
/**
* Calculates the interpolated tween values of an object for a given timestamp.
* @ignore
*/
var tweenProps = (forPosition, currentState, originalState, targetState, duration, timestamp, easing) => {
	let easedPosition = 0;
	let start;
	const normalizedPosition = forPosition < timestamp ? 0 : (forPosition - timestamp) / duration;
	let easingFn;
	for (const key in currentState) {
		if (typeof easing === TYPE_FUNCTION) {
			easing = easing;
			easingFn = easing;
		} else {
			easing = easing;
			const easingObjectProp = easing[key];
			if (typeof easingObjectProp === TYPE_FUNCTION) easingFn = easingObjectProp;
			else easingFn = Tweenable.easing[easingObjectProp] ?? standardEasingFunctions.linear;
		}
		easedPosition = easingFn(normalizedPosition);
		start = originalState[key];
		currentState[key] = start + (targetState[key] - start) * easedPosition;
	}
	return currentState;
};
var processTween = (tween, currentTime) => {
	let timestamp = tween._timestamp ?? 0;
	const currentState = tween._currentState;
	const delay = tween._delay;
	if (currentTime < timestamp + delay) return;
	let duration = tween._duration;
	const targetState = tween._targetState;
	const endTime = timestamp + delay + duration;
	let timeToCompute = currentTime > endTime ? endTime : currentTime;
	tween._hasEnded = timeToCompute >= endTime;
	const offset = duration - (endTime - timeToCompute);
	if (tween._hasEnded) {
		tween._render(targetState, offset, tween._data);
		return tween.stop(true);
	}
	tween._applyFilter(BEFORE_TWEEN);
	if (timeToCompute < timestamp + delay) timestamp = duration = timeToCompute = 1;
	else timestamp += delay;
	tweenProps(timeToCompute, currentState, tween._originalState, targetState, duration, timestamp, tween._easing);
	tween._applyFilter(AFTER_TWEEN);
	tween._render(currentState, offset, tween._data);
};
/**
* Process all tweens currently managed by Shifty for the current tick. This
* does not perform any timing or update scheduling; it is the logic that is
* run *by* the scheduling functionality. Specifically, it computes the state
* and calls all of the relevant {@link TweenableConfig} functions supplied to
* each of the tweens for the current point in time (as determined by {@link
* Tweenable.now}).
*
* This is a low-level API that won't be needed in the majority of situations.
* It is primarily useful as a hook for higher-level animation systems that are
* built on top of Shifty. If you need this function, it is likely you need to
* pass something like `() => {}` to {@link Tweenable.setScheduleFunction},
* override {@link Tweenable.now} and manage the scheduling logic yourself.
*
* @see https://github.com/jeremyckahn/shifty/issues/109
*/
var processTweens = () => {
	let nextTweenToProcess;
	const currentTime = Tweenable.now();
	let currentTween = listHead;
	while (currentTween) {
		nextTweenToProcess = currentTween._next;
		processTween(currentTween, currentTime);
		currentTween = nextTweenToProcess;
	}
};
var { now } = Date;
var currentTime;
var isHeartbeatRunning = false;
/**
* Handles the update logic for one tick of a tween.
*/
var scheduleUpdate = () => {
	currentTime = now();
	if (isHeartbeatRunning) scheduleFunction.call(root, scheduleUpdate, UPDATE_TIME);
	processTweens();
};
/**
* Creates an EasingObject or EasingFunction from a string, a function or
* another easing Object. If `easing` is an Object, then this function clones
* it and fills in the missing properties with `"linear"`.
*
* If the tween has only one easing across all properties, that function is
* returned directly.
*/
var composeEasingObject = (fromTweenParams, easing = DEFAULT_EASING, composedEasing = {}) => {
	if (typeof easing === TYPE_STRING) {
		if (isEasingKey(easing)) return Tweenable.easing[easing];
	}
	if (Array.isArray(easing)) return getCubicBezierTransition(...easing);
	if (typeof composedEasing === TYPE_OBJECT) {
		composedEasing = composedEasing;
		if (typeof easing === TYPE_STRING || typeof easing === TYPE_FUNCTION) for (const prop in fromTweenParams) composedEasing[prop] = easing;
		else for (const prop in fromTweenParams) {
			easing = easing;
			composedEasing[prop] = easing[prop] || DEFAULT_EASING;
		}
	}
	return composedEasing;
};
var remove = (() => {
	let previousTween;
	let nextTween;
	return (tween) => {
		previousTween = null;
		nextTween = null;
		if (tween === listHead) {
			listHead = tween._next;
			if (listHead) listHead._previous = null;
			else listTail = null;
		} else if (tween === listTail) {
			listTail = tween._previous;
			if (listTail) listTail._next = null;
			else listHead = null;
		} else {
			previousTween = tween._previous;
			nextTween = tween._next;
			if (previousTween) previousTween._next = nextTween;
			if (nextTween) nextTween._previous = previousTween;
		}
		tween._previous = tween._next = null;
	};
})();
var defaultPromiseCtor = typeof Promise === TYPE_FUNCTION ? Promise : null;
var Tweenable = class Tweenable {
	/**
	* Required for Promise implementation
	* @ignore
	*/
	[Symbol.toStringTag] = "Promise";
	/**
	* Returns the current timestamp.
	*/
	static now = () => {
		if (!isHeartbeatRunning) currentTime = now();
		return currentTime;
	};
	/**
	* Sets a custom schedule function.
	*
	* By default, Shifty uses
	* [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/window.requestAnimationFrame)
	* is used if available, otherwise {@link !setTimeout} is used.
	*/
	static setScheduleFunction = (fn) => scheduleFunction = fn;
	/**
	* The {@link Filter}s available for use.  These filters are automatically
	* applied. You can define your own {@link Filter}s and attach them to this
	* object.
	*
	* ```ts
	* Tweenable.filters['customFilter'] = {
	*   doesApply: () => true
	*   tweenCreated: () => console.log('tween created!')
	* }
	* ```
	*/
	static filters = { token: token_exports };
	/**
	* You can define custom easing curves by attaching {@link EasingFunction}s
	* to this static object.
	*
	* ```ts
	* Tweenable.easing['customEasing'] = (pos: number) => Math.pow(pos, 2)
	* ```
	*/
	static easing = Object.create(standardEasingFunctions);
	/**
	* @ignore
	*/
	_next = null;
	/**
	* @ignore
	*/
	_previous = null;
	/**
	* @ignore
	*/
	_config = {};
	/**
	* @ignore
	*/
	_data = {};
	/**
	* @ignore
	*/
	_delay = 0;
	/**
	* @ignore
	*/
	_duration = DEFAULT_DURATION;
	/**
	* @ignore
	*/
	_filters = [];
	/**
	* @ignore
	*/
	_timestamp = null;
	/**
	* @ignore
	*/
	_hasEnded = false;
	/**
	* @ignore
	*/
	_resolve = null;
	/**
	* @ignore
	*/
	_reject = null;
	/**
	* @ignore
	*/
	_currentState;
	/**
	* @ignore
	*/
	_originalState = {};
	/**
	* @ignore
	*/
	_targetState = {};
	/**
	* @ignore
	*/
	_start = noop;
	/**
	* @ignore
	*/
	_render = noop;
	/**
	* @ignore
	*/
	_promiseCtor = defaultPromiseCtor;
	/**
	* @ignore
	*/
	_promise = null;
	/**
	* @ignore
	*/
	_isPlaying = false;
	/**
	* @ignore
	*/
	_pausedAtTime = null;
	/**
	* @ignore
	*/
	_easing = {};
	constructor(initialState = {}, config) {
		this._currentState = initialState || {};
		if (config) this.setConfig(config);
	}
	/**
	* Applies a filter to Tweenable instance.
	* @ignore
	*/
	_applyFilter(filterType) {
		for (let i = this._filters.length; i > 0; i--) this._filters[i - i][filterType]?.(this);
	}
	/**
	* {@link Tweenable#setConfig Configure} and start a tween. If this {@link
	* Tweenable}'s instance is already running, then it will stop playing the
	* old tween and immediately play the new one.
	*/
	tween(config) {
		if (this._isPlaying) this.stop();
		if (config || !this._config) this.setConfig(config);
		this._pausedAtTime = null;
		this._timestamp = Tweenable.now();
		this._start(this.state, this._data);
		if (this._delay) this._render(this._currentState, 0, this._data);
		return this._resume(this._timestamp);
	}
	/**
	* Configures a tween without starting it. Aside from {@link
	* TweenableConfig.delay}, {@link TweenableConfig.from}, and {@link
	* TweenableConfig.to}, each configuration option will automatically default
	* to the same option used in the preceding tween of the {@link Tweenable}
	* instance.
	*/
	setConfig(config = {}) {
		const { _config } = this;
		let key;
		for (key in config) _config[key] = config[key];
		const { promise = this._promiseCtor, start = noop, finish, render = noop } = _config;
		this._data = _config.data || this._data;
		this._isPlaying = false;
		this._pausedAtTime = null;
		this._delay = config.delay || 0;
		this._start = start;
		this._render = render;
		this._duration = _config.duration || DEFAULT_DURATION;
		this._promiseCtor = promise;
		if (finish) this._resolve = finish;
		const { from, to = {} } = config;
		const { _currentState, _originalState, _targetState } = this;
		for (const key in from) _currentState[key] = from[key];
		let anyPropsAreStrings = false;
		for (const key in _currentState) {
			const currentProp = _currentState[key];
			if (!anyPropsAreStrings && typeof currentProp === TYPE_STRING) anyPropsAreStrings = true;
			_originalState[key] = currentProp;
			_targetState[key] = to[key] ?? currentProp;
		}
		this._easing = composeEasingObject(this._currentState, _config.easing, this._easing);
		this._filters.length = 0;
		if (anyPropsAreStrings) {
			for (const key in Tweenable.filters) if (Tweenable.filters[key].doesApply(this)) this._filters.push(Tweenable.filters[key]);
			this._applyFilter(TWEEN_CREATED);
		}
		return this;
	}
	/**
	* Overrides any `finish` function passed via a {@link TweenableConfig}.
	* @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then
	*/
	then(onFulfilled, onRejected) {
		if (!this._promiseCtor) throw new Error("Promise implementation is unavailable");
		this._promise = new this._promiseCtor((resolve, reject) => {
			this._resolve = resolve;
			this._reject = reject;
		});
		return this._promise.then(onFulfilled, onRejected);
	}
	/**
	* @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch
	*/
	catch(onRejected) {
		return this.then().catch(onRejected);
	}
	/**
	* @see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/finally
	*/
	finally(onFinally) {
		return this.then().finally(onFinally);
	}
	/**
	* Returns the current state of the tween.
	*/
	get state() {
		return { ...this._currentState };
	}
	/**
	* Set the current tween state.
	*/
	setState(state) {
		this._currentState = state;
	}
	/**
	* Pauses a tween. Paused tweens can be {@link resume}d from the point at
	* which they were paused. If a tween is not running, this is a no-op.
	*/
	pause() {
		if (!this._isPlaying) return this;
		this._pausedAtTime = Tweenable.now();
		this._isPlaying = false;
		remove(this);
		return this;
	}
	/**
	* Resumes a {@link pause}d tween.
	*/
	resume() {
		return this._resume();
	}
	/**
	* @ignore
	*/
	_resume(currentTime = Tweenable.now()) {
		if (this._timestamp === null) return this.tween();
		if (this._isPlaying && this._promise) return this;
		if (this._pausedAtTime) {
			this._timestamp += currentTime - this._pausedAtTime;
			this._pausedAtTime = null;
		}
		this._isPlaying = true;
		const wasRunning = Boolean(listHead);
		if (listHead === null) {
			listHead = this;
			listTail = this;
		} else {
			this._previous = listTail;
			if (listTail) listTail._next = this;
			listTail = this;
		}
		if (!wasRunning) shouldScheduleUpdate(true);
		return this;
	}
	/**
	* Move the state of the animation to a specific point in the tween's
	* timeline. If the animation is not running, this will cause the tween's
	* {@link TweenableConfig.render | render} handler to be called.
	*/
	seek(millisecond) {
		millisecond = Math.max(millisecond, 0);
		const currentTime = Tweenable.now();
		if ((this._timestamp ?? 0) + millisecond === 0) return this;
		this._timestamp = currentTime - millisecond;
		processTween(this, currentTime);
		return this;
	}
	/**
	* Stops a tween. If a tween is not running, this is a no-op. This method
	* does **not** reject the tween {@link !Promise}. For that, use {@link
	* Tweenable#cancel}.
	*/
	stop(gotoEnd = false) {
		if (!this._isPlaying) return this;
		this._isPlaying = false;
		remove(this);
		if (gotoEnd) {
			this._applyFilter(BEFORE_TWEEN);
			tweenProps(1, this._currentState, this._originalState, this._targetState, 1, 0, this._easing);
			this._applyFilter(AFTER_TWEEN);
			this._applyFilter(AFTER_TWEEN_END);
		}
		const resolve = this._resolve;
		this._resolve = null;
		this._reject = null;
		resolve?.({
			data: this._data,
			state: this._currentState,
			tweenable: this
		});
		return this;
	}
	/**
	* {@link Tweenable#stop}s a tween and also rejects its {@link !Promise}. If
	* a tween is not running, this is a no-op. Prevents calling any provided
	* {@link TweenableConfig.finish} function.
	* @see https://github.com/jeremyckahn/shifty/issues/122
	*/
	cancel(gotoEnd = false) {
		const { _currentState, _data, _isPlaying } = this;
		if (!_isPlaying) return this;
		this._reject?.({
			data: _data,
			state: _currentState,
			tweenable: this
		});
		this._resolve = null;
		this._reject = null;
		return this.stop(gotoEnd);
	}
	/**
	* Whether or not a tween is running (not paused or completed).
	*/
	get isPlaying() {
		return this._isPlaying;
	}
	/**
	* Whether or not a tween has completed.
	*/
	get hasEnded() {
		return this._hasEnded;
	}
	/**
	* Get and optionally set the data that gets passed as `data` to {@link
	* StartFunction}, {@link FinishFunction} and {@link RenderFunction}.
	*/
	data(data = null) {
		if (data) this._data = { ...data };
		return this._data;
	}
	/**
	* `delete` all {@link
	* https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Object/hasOwn
	* | own} properties.  Call this when the {@link Tweenable} instance is no
	* longer needed to free memory.
	*/
	dispose() {
		for (const prop in this) delete this[prop];
	}
};
/**
* Determines whether or not a heartbeat tick should be scheduled. This is
* generally only useful for testing environments where Shifty's continuous
* heartbeat mechanism causes test runner issues.
*
* If you are using Jest, it is recommended to put this in a global `afterAll`
* hook. If you don't already have a Jest setup file, follow the setup in [this
* StackOverflow post](https://stackoverflow.com/a/57647146), and then add this
* to it:
*
* ```
* import { shouldScheduleUpdate } from 'shifty'
*
* afterAll(() => {
*   shouldScheduleUpdate(false)
* })
* ```
* @see https://github.com/jeremyckahn/shifty/issues/156
*/
var shouldScheduleUpdate = (doScheduleUpdate) => {
	if (doScheduleUpdate && isHeartbeatRunning) return;
	isHeartbeatRunning = doScheduleUpdate;
	if (doScheduleUpdate) scheduleUpdate();
};
//#endregion
//#region src/lib/tween/shifty/interpolate.ts
var tweenable = new Tweenable();
var { filters } = Tweenable;
/**
* Compute the midpoint of two Objects.  This method effectively calculates a
* specific frame of animation that {@link Tweenable#tween} does many times
* over the course of a full tween.
*
* ```
* import { interpolate } from 'shifty';
*
* const interpolatedValues = interpolate({
*     width: '100px',
*     opacity: 0,
*     color: '#fff'
*   }, {
*     width: '200px',
*     opacity: 1,
*     color: '#000'
*   },
*   0.5
* );
*
* console.log(interpolatedValues); // Logs: {opacity: 0.5, width: "150px", color: "rgb(127,127,127)"}
* ```
*/
var interpolate = (from, to, position, easing = Tweenable.easing.linear, delay = 0) => {
	const current = { ...from };
	const easingObject = composeEasingObject(from, easing);
	tweenable._filters.length = 0;
	tweenable.setState({});
	tweenable._currentState = current;
	tweenable._originalState = from;
	tweenable._targetState = to;
	tweenable._easing = easingObject;
	for (const name in filters) if (filters[name].doesApply(tweenable)) tweenable._filters.push(filters[name]);
	tweenable._applyFilter("tweenCreated");
	tweenable._applyFilter("beforeTween");
	const interpolatedValues = tweenProps(position, current, from, to, 1, delay, easingObject);
	tweenable._applyFilter("afterTween");
	return interpolatedValues;
};
//#endregion
//#region src/lib/tween/index.ts
/** Tween / motion / animation system. The Game owns one as `this.tween`. Animate / ease / interpolate any numeric or colour-string property with `this.tween.to(sprite, { x: 200 })`. Driven by the game clock — tweens freeze automatically when the game pauses. */
var EASE_ALIASES = {
	linear: "linear",
	quad: "easeInOutQuad",
	cubic: "easeInOutCubic",
	quart: "easeInOutQuart",
	quint: "easeInOutQuint",
	sine: "easeInOutSine",
	expo: "easeInOutExpo",
	circ: "easeInOutCirc",
	back: "easeOutBack",
	bounce: "easeOutBounce"
};
var resolveEase$1 = (ease) => {
	if (ease == null) return "easeInOutQuad";
	if (typeof ease === "string") return EASE_ALIASES[ease] ?? ease;
	return ease;
};
/** All easing curve names accepted by `TweenOptions.ease` — standard shifty curves plus the short aliases. */
var EASING = [...Object.keys(standardEasingFunctions), ...Object.keys(EASE_ALIASES)];
/**
* A running tween handle. Returned by `tween.to` / `tween.from` / `tween.fromTo`. Supports `pause`, `resume`, `stop`, `seek`, and `await` (resolves when the tween finishes; never resolves for infinite loops).
*/
var TweenHandle = class {
	_owner;
	_tw;
	_target;
	_from;
	_to;
	_opts;
	_loopsLeft;
	_yoyo;
	_done = false;
	_started = false;
	_progress = 0;
	_resolve = null;
	_promise = null;
	/** @ignore — construct via `tween.to / from / fromTo`, not directly. */
	constructor(owner, target, from, to, opts) {
		this._owner = owner;
		this._target = target;
		this._from = from;
		this._to = to;
		this._opts = opts;
		this._yoyo = !!opts.yoyo;
		this._loopsLeft = opts.loop === true ? Infinity : typeof opts.loop === "number" ? opts.loop : 0;
		this._tw = new Tweenable();
		owner._active.add(this);
		this._run();
	}
	_run() {
		const durationMs = (this._opts.duration ?? .5) * 1e3;
		const render = (state, elapsedMs) => {
			Object.assign(this._target, state);
			this._progress = durationMs > 0 ? Math.min(1, Math.max(0, elapsedMs / durationMs)) : 1;
			this._opts.onUpdate?.(this._target, this._progress);
		};
		this._tw.tween({
			from: { ...this._from },
			to: { ...this._to },
			duration: durationMs,
			delay: (this._opts.delay ?? 0) * 1e3,
			easing: resolveEase$1(this._opts.ease),
			start: () => {
				if (this._started) return;
				this._started = true;
				this._opts.onStart?.(this._target);
			},
			render,
			finish: () => this._onFinish()
		});
	}
	_onFinish() {
		if (this._loopsLeft > 0) {
			this._loopsLeft--;
			if (this._yoyo) {
				const t = this._from;
				this._from = this._to;
				this._to = t;
			}
			this._run();
			return;
		}
		if (this._done) return;
		this._done = true;
		this._owner._active.delete(this);
		this._opts.onComplete?.(this._target);
		this._resolve?.();
	}
	/** Pause this tween. Resume with `resume()`. */
	pause() {
		this._tw.pause();
		return this;
	}
	/** Resume this tween from where `pause()` left it. */
	resume() {
		this._tw.resume();
		return this;
	}
	/** Stop this tween immediately. Pass `jumpToEnd = true` to snap the target to its end values first. Cancels any remaining loop repeats. */
	stop(jumpToEnd = false) {
		if (this._done) return this;
		this._loopsLeft = 0;
		if (jumpToEnd) {
			Object.assign(this._target, this._to);
			this._progress = 1;
		}
		this._tw.stop();
		if (!this._done) this._onFinish();
		return this;
	}
	/** Jump the tween's playhead to `seconds` from its start (scrub / seek). */
	seek(seconds) {
		this._tw.seek(seconds * 1e3);
		return this;
	}
	/** `true` while the tween is advancing (not paused, not finished). */
	get isPlaying() {
		return this._tw.isPlaying;
	}
	/** `true` once the tween (and all loop repeats) have finished. */
	get isDone() {
		return this._done;
	}
	/** Normalised progress through the current run, 0→1. Poll this instead of tracking elapsed time yourself. */
	get progress() {
		return this._progress;
	}
	/** Makes the handle thenable — `await handle` resolves when the tween finishes. Never resolves for infinite loops. */
	then(onFulfilled, onRejected) {
		if (!this._promise) this._promise = this._done ? Promise.resolve() : new Promise((res) => {
			this._resolve = res;
		});
		return this._promise.then(onFulfilled ?? void 0, onRejected ?? void 0);
	}
};
var pick = (target, props) => {
	const out = {};
	for (const k in props) out[k] = target[k];
	return out;
};
/** @internal Keys already warned about, so a misused tween in a loop warns once, not every frame. */
var _warnedTweenKeys = /* @__PURE__ */ new Set();
/**
* @internal Dev guard: a tween only interpolates numbers and colour strings. If a
* target property is a `Vec2` (`scale`/`position`/`velocity`/`size`/…), tweening the
* field itself overwrites the `{x,y}` object with a number and the sprite renders at
* `NaN` — silently. Point the caller at the working pattern instead of failing quietly.
*/
var warnIfObjectProps = (target, keys) => {
	if (typeof console === "undefined") return;
	const t = target;
	for (const k in keys) {
		const v = t[k];
		if (typeof v === "object" && v !== null && !_warnedTweenKeys.has(k)) {
			_warnedTweenKeys.add(k);
			console.warn(`[tween] "${k}" is an object (a Vec2 like scale/position?), not a number — tween its axes instead: tween.to(obj.${k}, { x, y }). Tweening the object itself overwrites it and renders at NaN.`);
		}
	}
};
/**
* The motion / animation / tween system. The Game owns one as `this.tween` (accessed on any scene as `this.tween`). The Game advances it every frame — call `this.tween.to(sprite, { x: 200 })` and the rest is automatic.
*/
var Tween = class {
	clockMs = 0;
	_paused = false;
	/** @internal Active tween handles. Used for `count` / `stopAll`. */
	_active = /* @__PURE__ */ new Set();
	constructor() {
		Tweenable.setScheduleFunction(() => {});
		Tweenable.now = () => this.clockMs;
	}
	/** Animate `target`'s properties FROM their current values TO `props`. The most common tween call — e.g. `tween.to(sprite, { x: 200, alpha: 0 }, { duration: 0.4 })`. */
	to(target, props, opts = {}) {
		const t = target;
		const to = props;
		warnIfObjectProps(target, to);
		return new TweenHandle(this, target, pick(t, to), { ...to }, opts);
	}
	/** Animate `target`'s properties FROM `props` TO their current values — use to animate / slide / fade something in from a starting position. */
	from(target, props, opts = {}) {
		const t = target;
		const from = props;
		warnIfObjectProps(target, from);
		return new TweenHandle(this, target, { ...from }, pick(t, from), opts);
	}
	/** Animate `target`'s properties from `fromProps` to `toProps` with full explicit control over both endpoints. */
	fromTo(target, fromProps, toProps, opts = {}) {
		warnIfObjectProps(target, toProps);
		return new TweenHandle(this, target, { ...fromProps }, { ...toProps }, opts);
	}
	/**
	* Run tween steps one after another in a chain — each step starts when the previous one finishes. Each element is a function that returns a `TweenHandle` or any `Promise`. Returns a promise that resolves when the whole sequence is done.
	*/
	sequence(steps) {
		let p = Promise.resolve();
		for (const step of steps) p = p.then(() => step() ?? void 0);
		return p.then(() => void 0);
	}
	/** Group several `TweenHandle` instances for unified pause/resume/stop/await. */
	group(...handles) {
		return {
			pause: () => handles.forEach((h) => h.pause()),
			resume: () => handles.forEach((h) => h.resume()),
			stop: (jumpToEnd = false) => handles.forEach((h) => h.stop(jumpToEnd)),
			then: (onFulfilled) => Promise.all(handles.map((h) => h.then())).then(() => onFulfilled ? onFulfilled() : void 0)
		};
	}
	/**
	* Compute a one-off interpolated / lerped snapshot (no animation, no handle). Works on numbers and colour strings: `tween.interpolate({ v: 0 }, { v: 10 }, 0.5).v === 5`.
	*/
	interpolate = interpolate;
	/** All easing curve names accepted by `TweenOptions.ease`. */
	get EASING() {
		return EASING;
	}
	/** Advance the clock by `deltaSeconds` and step all active tweens. Called automatically by the Game loop — do not call this yourself. */
	update(deltaSeconds) {
		if (this._paused) return;
		this.clockMs += deltaSeconds * 1e3;
		processTweens();
	}
	/** Freeze every active tween WITHOUT stopping the game loop — use when displaying a pause overlay. */
	pauseAll() {
		this._paused = true;
	}
	/** Unfreeze every tween after `pauseAll()`. */
	resumeAll() {
		this._paused = false;
	}
	/** Alias of `pauseAll()` — the hook a state machine's suspend calls. */
	pause() {
		this._paused = true;
	}
	/** Alias of `resumeAll()`. */
	resume() {
		this._paused = false;
	}
	/** Stop every active tween (e.g. on a level reset). Pass `true` to snap each tween to its end values. */
	stopAll(jumpToEnd = false) {
		for (const h of [...this._active]) h.stop(jumpToEnd);
	}
	/** Number of currently active (running or paused) tweens. */
	get count() {
		return this._active.size;
	}
	/** `true` when the whole system is frozen by `pauseAll()`. */
	get isPaused() {
		return this._paused;
	}
	/** Stop all tweens and tear down the system. Called automatically by `Game.destroy()`. */
	destroy() {
		this.stopAll();
	}
};
//#endregion
//#region src/lib/screen.ts
/**
* THE PRESENTATION SURFACE — the canvas as a display, and what you can capture
* off it: `game.screen.fullscreen()`, `.screenshot(cb)`, `.record(60, 10, cb)`.
*
* This is host-shell API (the page's fullscreen button, a share/capture
* control), not game API — nothing here affects the simulation. To freeze the
* game itself use `game.pause()` / `game.resume()`.
*/
var Screen = class {
	host;
	/** @internal CSS-fullscreen fallback state (iOS, where the Fullscreen API is absent). */
	cssFs = false;
	cssFsSaved = null;
	_pendingShot = null;
	_pendingScale = 1;
	_recorder = null;
	_recTimer = 0;
	_recChunks = [];
	_recDone = null;
	/**
	* @internal Built by `Game` — reach it as `game.screen`, never construct one.
	* Internal so the shipped `.d.ts` carries no reference to the stripped
	* `ScreenHost` (a dangling type would break the game project's typecheck).
	*/
	constructor(host) {
		this.host = host;
	}
	/** `true` while the game is fullscreen — native Fullscreen API, or the iOS CSS fallback. */
	get isFullscreen() {
		const canvas = this.host.canvas;
		if (typeof document !== "undefined" && document.fullscreenElement) return document.fullscreenElement === canvas;
		return this.cssFs;
	}
	/**
	* Enter / exit / toggle fullscreen — the one call to make. Uses the browser
	* Fullscreen API where it exists; on iOS (no `Element.requestFullscreen`) it
	* falls back to promoting the canvas to a fixed, full-viewport layer over the
	* page. The backing store re-fits automatically either way. `on` omitted →
	* toggle. Must be called from a user gesture (click/tap) for the native path.
	* Resolves once applied.
	*/
	async fullscreen(on = !this.isFullscreen) {
		if (this.host.isDestroyed() || typeof document === "undefined") return;
		const el = this.host.canvas;
		if (typeof el.requestFullscreen === "function" && (document.fullscreenEnabled ?? true)) {
			try {
				if (on && document.fullscreenElement !== el) await el.requestFullscreen();
				else if (!on && document.fullscreenElement) await document.exitFullscreen();
			} catch {}
			this.host.markDirty();
			return;
		}
		this.cssFullscreen(on);
	}
	/** @internal iOS fallback: promote the canvas to a fixed full-viewport layer (or restore it). */
	cssFullscreen(on) {
		if (on === this.cssFs) return;
		const el = this.host.canvas;
		if (on) {
			this.cssFsSaved = el.style.cssText;
			el.style.cssText = "position:fixed;inset:0;margin:0;display:block;z-index:2147483647;width:100vw;height:100vh;width:100dvw;height:100dvh";
		} else {
			el.style.cssText = this.cssFsSaved ?? "";
			this.cssFsSaved = null;
		}
		this.cssFs = on;
		this.host.markDirty();
	}
	/**
	* Capture the canvas as a PNG image and hand it to `callback`. The shot is taken at the END
	* of the next rendered frame, so you never get a half-drawn frame; if the loop is paused, the
	* current (already-complete) frame is captured immediately.
	* @param callback Receives a PNG `Blob`, or `null` if the browser can't encode the canvas.
	* @param scale Upscale factor for the saved image (default 1) — pixel-art games upscale
	*   nearest-neighbour (crisp), smooth games interpolate.
	*/
	screenshot(callback, scale = 1) {
		const canvas = this.host.canvas;
		if (!canvas || typeof canvas.toBlob !== "function") {
			callback(null);
			return;
		}
		if (!this.host.isRunning()) {
			this.encodeShot(callback, scale);
			return;
		}
		this._pendingShot = callback;
		this._pendingScale = scale;
	}
	/** @internal Drain a pending screenshot at end-of-frame (called from the loop after submit). */
	_drainShot() {
		const cb = this._pendingShot;
		const scale = this._pendingScale;
		this._pendingShot = null;
		this._pendingScale = 1;
		if (cb) this.encodeShot(cb, scale);
	}
	/** @internal `true` when a screenshot is waiting for end-of-frame. */
	get _shotPending() {
		return this._pendingShot !== null;
	}
	/** @internal Encode the canvas to a PNG `Blob`, optionally upscaled `scale`× (nearest-neighbour for pixel art) via a temp canvas. */
	encodeShot(callback, scale) {
		const canvas = this.host.canvas;
		if (scale === 1 || typeof document === "undefined") {
			canvas.toBlob(callback, "image/png");
			return;
		}
		const w = Math.max(1, Math.round(canvas.width * scale));
		const h = Math.max(1, Math.round(canvas.height * scale));
		const tmp = document.createElement("canvas");
		tmp.width = w;
		tmp.height = h;
		const tctx = tmp.getContext("2d");
		if (!tctx) {
			canvas.toBlob(callback, "image/png");
			return;
		}
		tctx.imageSmoothingEnabled = !this.host.isPixelArt();
		tctx.drawImage(canvas, 0, 0, w, h);
		tmp.toBlob(callback, "image/png");
	}
	/** `true` while a `record()` is in progress. */
	get recording() {
		return this._recorder !== null;
	}
	/**
	* Record the canvas to a video using the browser's `captureStream` + `MediaRecorder`. Recording
	* ends after `duration` seconds (if given) or when you call {@link stopRecord} — whichever comes
	* first — and the finished video `Blob` (WebM) is handed to `callback`. The game's audio (SFX +
	* music) is muxed in too whenever a WebAudio graph exists, captured at the master mix level and
	* independent of the local mute. No-op while already recording or where the APIs are unavailable.
	* @param fps Frames per second to capture. Default 60.
	* @param duration Optional auto-stop time in seconds. Omit to record until `stopRecord()`.
	* @param callback Receives the recorded video `Blob` when recording ends.
	* @param videoBitsPerSecond Target video bitrate. Defaults to a generous, resolution-scaled value
	*   (≥ 8 Mbps) — the browser's own default (~2.5 Mbps) badly compresses sharp art.
	*/
	record(fps = 60, duration, callback, videoBitsPerSecond) {
		if (this._recorder) return;
		const canvas = this.host.canvas;
		if (!canvas || typeof canvas.captureStream !== "function" || typeof MediaRecorder === "undefined") return;
		const mime = [
			"video/webm;codecs=vp9",
			"video/webm;codecs=vp8",
			"video/webm"
		].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
		const opts = { videoBitsPerSecond: videoBitsPerSecond ?? Math.min(4e7, Math.max(8e6, Math.round(canvas.width * canvas.height * fps * .25))) };
		if (mime) opts.mimeType = mime;
		const stream = canvas.captureStream(fps);
		const audioTrack = this.host.sound.captureStreamTrack();
		if (audioTrack) {
			stream.addTrack(audioTrack);
			opts.audioBitsPerSecond = 128e3;
		}
		const rec = new MediaRecorder(stream, opts);
		this._recChunks = [];
		this._recDone = callback ?? null;
		rec.ondataavailable = (e) => {
			if (e.data && e.data.size) this._recChunks.push(e.data);
		};
		rec.onstop = () => {
			this.host.sound.stopCapture();
			const blob = new Blob(this._recChunks, { type: rec.mimeType || "video/webm" });
			this._recorder = null;
			if (this._recTimer) {
				clearTimeout(this._recTimer);
				this._recTimer = 0;
			}
			const done = this._recDone;
			this._recChunks = [];
			this._recDone = null;
			done?.(blob);
		};
		this._recorder = rec;
		rec.start();
		if (duration && duration > 0) this._recTimer = setTimeout(() => this.stopRecord(), duration * 1e3);
	}
	/** Stop an in-progress `record()` early; the video is delivered to that call's `callback`. No-op if not recording. */
	stopRecord() {
		if (this._recorder && this._recorder.state !== "inactive") this._recorder.stop();
	}
	/** @internal Release everything this surface holds — called by `game.destroy()`. */
	_destroy() {
		this.stopRecord();
		this._pendingShot = null;
		if (this.cssFs) this.cssFullscreen(false);
	}
};
//#endregion
//#region src/lib/text-bounds.ts
/** Build a {@link TextBounds} from a corner + size. */
function makeBounds(x, y, w, h) {
	return {
		x,
		y,
		w,
		h,
		right: x + w,
		bottom: y + h,
		cx: x + w / 2,
		cy: y + h / 2
	};
}
/**
* The axis-aligned box of a `w`×`h` local rect drawn at (x, y) under `t`.
* `inkX`/`inkY` shift the local rect so the ORIGIN stays anchored to the text
* box even when the ink spills outside it.
*/
function transformedBounds(w, h, x, y, t, inkX = 0, inkY = 0, boxW = w, boxH = h) {
	const scale = t?.scale ?? 1;
	const rot = t?.rotation ?? 0;
	const ox = (t?.origin?.x ?? 0) * boxW + inkX;
	const oy = (t?.origin?.y ?? 0) * boxH + inkY;
	const cos = Math.cos(rot), sin = Math.sin(rot);
	let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
	for (let i = 0; i < 4; i++) {
		const lx = i & 1 ? w : 0;
		const ly = i >> 1 ? h : 0;
		const sx = (lx - ox) * scale, sy = (ly - oy) * scale;
		const px = x + (sx * cos - sy * sin);
		const py = y + (sx * sin + sy * cos);
		if (px < minX) minX = px;
		if (px > maxX) maxX = px;
		if (py < minY) minY = py;
		if (py > maxY) maxY = py;
	}
	return makeBounds(minX, minY, maxX - minX, maxY - minY);
}
/** Do two boxes overlap? `gap` treats blocks closer than that as colliding. */
function boundsOverlap(a, b, gap = 0) {
	return a.x - gap < b.right && b.x - gap < a.right && a.y - gap < b.bottom && b.y - gap < a.bottom;
}
/** The overlapping region of two boxes (zero-sized when they merely touch). */
function boundsIntersection(a, b) {
	const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
	return makeBounds(x, y, Math.max(0, Math.min(a.right, b.right) - x), Math.max(0, Math.min(a.bottom, b.bottom) - y));
}
/** The smallest box containing both — useful for reserving space for a group. */
function boundsUnion(a, b) {
	const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
	return makeBounds(x, y, Math.max(a.right, b.right) - x, Math.max(a.bottom, b.bottom) - y);
}
function itemBounds(item) {
	return "text" in item ? item.text.bounds(item.x, item.y, item.opts) : makeBounds(item.x, item.y, item.w, item.h);
}
/**
* Report every pair of text blocks (and plain rects) whose PAINTED boxes
* collide. An empty array means the layout is clean — `if (textOverlaps(hud).length)`
* is the whole check.
*
* Bounds include stroke / glow / shadow / plate ink and the largest hover or
* pressed state, so a menu spaced by this can't collide when an item lights up.
*
* ```ts
* const clashes = textOverlaps([
*   { text: score,  x: 16, y: 12, id: 'score' },
*   { text: timer,  x: 16, y: 44, id: 'timer' },
*   { text: combo,  x: hud.w - 16, y: 12, opts: { origin: { x: 1 } }, id: 'combo' },
* ], { gap: 6 });
* for (const c of clashes) console.warn(`${c.idA} overlaps ${c.idB}`, c.push);
* ```
*/
function textOverlaps(items, opts = {}) {
	const gap = opts.gap ?? 0;
	const boxes = items.map(itemBounds);
	const out = [];
	for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
		const a = boxes[i], b = boxes[j];
		if (!boundsOverlap(a, b, gap)) continue;
		const right = a.right + gap - b.x;
		const left = b.right + gap - a.x;
		const down = a.bottom + gap - b.y;
		const up = b.bottom + gap - a.y;
		const dx = right < left ? right : -left;
		const dy = down < up ? down : -up;
		const push = Math.abs(dx) < Math.abs(dy) ? {
			x: dx,
			y: 0
		} : {
			x: 0,
			y: dy
		};
		out.push({
			a: i,
			b: j,
			idA: items[i].id ?? `#${i}`,
			idB: items[j].id ?? `#${j}`,
			rect: boundsIntersection(a, b),
			push
		});
	}
	return out;
}
//#endregion
//#region src/lib/msdf-text.ts
function toRGB(c) {
	if (typeof c === "number") return c & 16777215;
	const s = c.trim();
	if (s[0] === "#") {
		let h = s.slice(1);
		if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
		return parseInt(h.slice(0, 6), 16) & 16777215;
	}
	const m = s.match(/rgba?\(([^)]+)\)/i);
	if (m) {
		const p = m[1].split(",").map((v) => parseFloat(v));
		return (Math.round(p[0]) & 255) << 16 | (Math.round(p[1]) & 255) << 8 | Math.round(p[2]) & 255;
	}
	return 16777215;
}
var roundedNorm = (v) => v === true ? 1 : v === false || v == null ? 0 : v;
/**
* A styled, laid-out block of MSDF text. Create with `game.assets.msdfText(font, str,
* opts)`; mutate with the chainable setters; draw with `d.msdfText(text, x, y)`.
*/
var MsdfText = class {
	font;
	_text = "";
	_segments = null;
	_overlays = [];
	fontSize;
	align = "left";
	lineSpacing = 0;
	letterSpacing = 0;
	maxWidth = 0;
	base;
	laid = [];
	rects = [];
	lineTops = [];
	_width = 0;
	_height = 0;
	dirty = true;
	constructor(font, text = "", opts = {}) {
		this.font = font;
		this.fontSize = opts.fontSize ?? 48;
		this.align = opts.align ?? "left";
		this.lineSpacing = opts.lineSpacing ?? 0;
		this.letterSpacing = opts.letterSpacing ?? 0;
		this.maxWidth = opts.maxWidth ?? 0;
		this.base = {
			color: opts.color ?? 16777215,
			alpha: opts.alpha ?? 1,
			weight: opts.weight ?? 0,
			outline: opts.outline,
			shadow: opts.shadow,
			skew: opts.skew ?? 0,
			underline: opts.underline,
			strikethrough: opts.strikethrough,
			highlight: opts.highlight
		};
		this._text = Array.isArray(text) ? text.join("\n") : text;
	}
	get width() {
		this.ensure();
		return this._width;
	}
	get height() {
		this.ensure();
		return this._height;
	}
	get text() {
		return this._text;
	}
	/**
	* The box this block PAINTS when drawn at (x, y) with `opts` — the text box
	* grown by outline / shadow ink, through origin / scale / rotation. Use it to
	* space HUD furniture, and `textOverlaps()` to check a whole layout;
	* `width`/`height` are the tighter text box you align to. See text-layout.md.
	*
	* The ink margin is an ESTIMATE that errs generous: outline width and shadow
	* spread are distance-FIELD fractions, whose pixel size depends on the atlas's
	* distanceRange as well as the font size.
	*/
	bounds(x, y, opts) {
		this.ensure();
		let m = 0;
		let sx = 0, sy = 0;
		const grow = (s) => {
			if (!s) return;
			const o = s.outline;
			if (o) m = Math.max(m, ((o.width ?? 0) + (o.softness ?? 0)) * this.fontSize);
			const sh = s.shadow;
			if (sh) {
				m = Math.max(m, ((sh.spread ?? 0) + (sh.softness ?? 0)) * this.fontSize);
				sx = Math.max(sx, Math.abs(sh.x ?? 0));
				sy = Math.max(sy, Math.abs(sh.y ?? 0));
			}
		};
		grow(this.base);
		for (const seg of this._segments ?? []) if (typeof seg !== "string") grow(seg);
		for (const ov of this._overlays) grow(ov.style);
		const l = m + sx, t = m + sy;
		return transformedBounds(this._width + (m + sx) * 2, this._height + (m + sy) * 2, x, y, opts, l, t, this._width, this._height);
	}
	setText(text) {
		this._text = Array.isArray(text) ? text.join("\n") : text;
		this._segments = null;
		return this.mark();
	}
	setFont(font) {
		this.font = font;
		return this.mark();
	}
	setFontSize(size) {
		this.fontSize = size;
		return this.mark();
	}
	setAlign(a) {
		this.align = a;
		return this.mark();
	}
	setLineSpacing(v) {
		this.lineSpacing = v;
		return this.mark();
	}
	setLetterSpacing(v) {
		this.letterSpacing = v;
		return this.mark();
	}
	setMaxWidth(v) {
		this.maxWidth = v;
		return this.mark();
	}
	setColor(c, alpha) {
		this.base.color = c;
		if (alpha != null) this.base.alpha = alpha;
		return this.mark();
	}
	setAlpha(a) {
		this.base.alpha = a;
		return this.mark();
	}
	setWeight(w) {
		this.base.weight = w;
		return this.mark();
	}
	setOutline(o) {
		this.base.outline = o ?? void 0;
		return this.mark();
	}
	setShadow(s) {
		this.base.shadow = s ?? void 0;
		return this.mark();
	}
	setSkew(k) {
		this.base.skew = k;
		return this.mark();
	}
	setUnderline(u) {
		this.base.underline = u;
		return this.mark();
	}
	setStrikethrough(s) {
		this.base.strikethrough = s;
		return this.mark();
	}
	setHighlight(h) {
		this.base.highlight = h;
		return this.mark();
	}
	/** Set styled text from segments (their text is concatenated into `text`). */
	setRichText(segments) {
		this._segments = segments;
		this._text = segments.map((s) => typeof s === "string" ? s : s.text).join("");
		return this.mark();
	}
	/** Overlay a style onto matching spans: a substring, a RegExp, or `{ start, length }`. */
	addStyle(target, style) {
		if (typeof target === "object" && "start" in target) this._overlays.push({
			start: target.start,
			length: target.length,
			style
		});
		else if (typeof target === "string") {
			let i = 0;
			while ((i = this._text.indexOf(target, i)) !== -1) {
				this._overlays.push({
					start: i,
					length: target.length,
					style
				});
				i += target.length || 1;
			}
		} else {
			const re = new RegExp(target.source, target.flags.includes("g") ? target.flags : target.flags + "g");
			for (const m of this._text.matchAll(re)) if (m[0].length) this._overlays.push({
				start: m.index,
				length: m[0].length,
				style
			});
		}
		return this.mark();
	}
	/** Remove every `addStyle` overlay. */
	clearStyles() {
		this._overlays.length = 0;
		return this.mark();
	}
	mark() {
		this.dirty = true;
		return this;
	}
	/**
	* Shrink `fontSize` (binary search) so the word-wrapped text fits `w`×`h`.
	* Permanently sets `fontSize` and `maxWidth`. Shrink-only unless `maxSize` given.
	*/
	fitInside(w, h, opts = {}) {
		let lo = opts.minSize ?? 1, hi = opts.maxSize ?? this.fontSize;
		const prec = opts.precision ?? .25;
		this.maxWidth = w;
		while (hi - lo > prec) {
			const mid = (lo + hi) / 2;
			this.fontSize = mid;
			this.dirty = true;
			this.ensure();
			if (this._width <= w && this._height <= h) lo = mid;
			else hi = mid;
		}
		this.fontSize = lo;
		this.dirty = true;
		return this;
	}
	resolveFace(f) {
		if (!f) return this.font;
		if (typeof f === "string") return this.font.face(f) ?? this.font;
		return f;
	}
	/** Merge a layer's style keys onto a resolved char state. */
	apply(r, s) {
		if (s.color != null) if (typeof s.color === "object") {
			r.colTop = toRGB(s.color.top);
			r.colBottom = toRGB(s.color.bottom);
		} else r.colTop = r.colBottom = toRGB(s.color);
		if (s.alpha != null) r.alpha = s.alpha;
		if (s.weight != null) r.weight = s.weight;
		if (s.skew != null) r.skew = s.skew;
		if (s.fontScale != null && s.fontScale > 0) r.sizeMul = s.fontScale;
		if (s.font != null) r.face = this.resolveFace(s.font);
		if (s.outline) {
			const o = s.outline;
			if (o.width != null) r.oWidth = o.width;
			if (o.color != null) r.oColor = toRGB(o.color);
			if (o.alpha != null) r.oAlpha = o.alpha;
			if (o.softness != null) r.oSoft = o.softness;
			if (o.rounded != null) r.oRound = roundedNorm(o.rounded);
			if (o.innerColor != null) r.oInner = toRGB(o.innerColor);
			if (o.layered != null) r.oLayered = o.layered;
		}
		if (s.shadow) {
			const sh = s.shadow;
			if (sh.x != null) r.sX = sh.x;
			if (sh.y != null) r.sY = sh.y;
			if (sh.color != null) r.sColor = toRGB(sh.color);
			if (sh.alpha != null) r.sAlpha = sh.alpha;
			if (sh.softness != null) r.sSoft = sh.softness;
			if (sh.spread != null) r.sSpread = sh.spread;
			if (sh.rounded != null) r.sRound = roundedNorm(sh.rounded);
			if (sh.innerColor != null) r.sInner = toRGB(sh.innerColor);
		}
		if (s.underline != null) r.underline = s.underline === false ? null : s.underline === true ? {} : s.underline;
		if (s.strikethrough != null) r.strike = s.strikethrough === false ? null : s.strikethrough === true ? {} : s.strikethrough;
		if (s.highlight != null) r.highlight = s.highlight === false ? null : s.highlight === true ? {} : s.highlight;
	}
	/** Build the per-source-character resolved-style array. */
	resolveChars() {
		const n = this._text.length;
		const out = new Array(n);
		const base = this.base;
		const baseCol = base.color ?? 16777215;
		const baseTop = typeof baseCol === "object" ? toRGB(baseCol.top) : toRGB(baseCol);
		const baseBottom = typeof baseCol === "object" ? toRGB(baseCol.bottom) : baseTop;
		const runStyle = new Array(n).fill(null);
		if (this._segments) {
			let i = 0;
			for (const seg of this._segments) {
				const t = typeof seg === "string" ? seg : seg.text;
				if (typeof seg !== "string") for (let k = 0; k < t.length; k++) runStyle[i + k] = seg;
				i += t.length;
			}
		}
		for (let i = 0; i < n; i++) {
			const r = {
				face: this.font,
				sizeMul: 1,
				colTop: baseTop,
				colBottom: baseBottom,
				alpha: base.alpha ?? 1,
				weight: base.weight ?? 0,
				oWidth: 0,
				oColor: 0,
				oAlpha: 1,
				oSoft: 0,
				oRound: 0,
				oInner: -1,
				oLayered: false,
				sX: 0,
				sY: 0,
				sColor: 0,
				sAlpha: 0,
				sSoft: 0,
				sSpread: 0,
				sRound: 1,
				sInner: -1,
				skew: base.skew ?? 0,
				underline: null,
				strike: null,
				highlight: null
			};
			if (base.outline) this.apply(r, { outline: base.outline });
			if (base.shadow) {
				r.sAlpha = base.shadow.alpha ?? 1;
				this.apply(r, { shadow: base.shadow });
			}
			if (base.underline != null) this.apply(r, { underline: base.underline });
			if (base.strikethrough != null) this.apply(r, { strikethrough: base.strikethrough });
			if (base.highlight != null) this.apply(r, { highlight: base.highlight });
			if (runStyle[i]) {
				const s = runStyle[i];
				if (s.shadow && s.shadow.alpha == null && !base.shadow) r.sAlpha = 1;
				this.apply(r, s);
			}
			out[i] = r;
		}
		for (const ov of this._overlays) {
			const end = Math.min(n, ov.start + ov.length);
			for (let i = Math.max(0, ov.start); i < end; i++) {
				if (ov.style.shadow && ov.style.shadow.alpha == null && out[i].sAlpha === 0) out[i].sAlpha = 1;
				this.apply(out[i], ov.style);
			}
		}
		return out;
	}
	ensure() {
		if (this.dirty) this.rebuild();
	}
	charAdvance(r, code) {
		const g = r.face.glyph(code);
		return g ? g.advance * this.fontSize * r.sizeMul : 0;
	}
	rebuild() {
		this.dirty = false;
		this.laid = [];
		this.rects = [];
		this.lineTops = [];
		const chars = this.resolveChars();
		const src = this._text;
		const fs = this.fontSize;
		const ls = this.letterSpacing;
		const wrapped = this.wrap(src, chars);
		const codes = wrapped.codes;
		const srcIdx = wrapped.srcIdx;
		const lineStart = [0];
		for (let i = 0; i < codes.length; i++) if (codes[i] === 10) lineStart.push(i + 1);
		const lineWidth = [];
		const lineAscent = [];
		const lineHeight = [];
		for (let li = 0; li < lineStart.length; li++) {
			const from = lineStart[li];
			const to = li + 1 < lineStart.length ? lineStart[li + 1] - 1 : codes.length;
			let w = 0, prev = 0, count = 0, ascent = 0, height = 0;
			let prevR = null;
			for (let i = from; i < to; i++) {
				const si = srcIdx[i];
				const r = si >= 0 ? chars[si] : chars[chars.length - 1] ?? this.baseResolved();
				const code = codes[i];
				const g = r.face.glyph(code);
				const size = fs * r.sizeMul;
				const a = r.face.data.ascent * size;
				const lh = r.face.data.lineHeight * size;
				if (a > ascent) ascent = a;
				if (lh > height) height = lh;
				if (!g) {
					prev = 0;
					continue;
				}
				if (prev !== 0 && prevR === r) w += (r.face.glyph(prev)?.kerning.get(code) ?? 0) * size;
				w += g.advance * size;
				prev = code;
				prevR = r;
				count++;
			}
			if (to <= from) {
				ascent = this.font.data.ascent * fs;
				height = this.font.data.lineHeight * fs;
			}
			if (ls !== 0 && count > 0) w += ls * count;
			lineWidth.push(w);
			lineAscent.push(ascent);
			lineHeight.push(height);
		}
		const blockW = Math.max(0, ...lineWidth);
		let top = 0;
		for (let li = 0; li < lineStart.length; li++) {
			const from = lineStart[li];
			const to = li + 1 < lineStart.length ? lineStart[li + 1] - 1 : codes.length;
			const baseline = top + lineAscent[li];
			this.lineTops.push(top);
			let pen = this.align === "center" ? (blockW - lineWidth[li]) / 2 : this.align === "right" ? blockW - lineWidth[li] : 0, prev = 0;
			let prevR = null;
			const lineGlyphStart = this.laid.length;
			for (let i = from; i < to; i++) {
				const si = srcIdx[i];
				const r = si >= 0 ? chars[si] : this.baseResolved();
				const code = codes[i];
				const g = r.face.glyph(code);
				const size = fs * r.sizeMul;
				if (!g) {
					prev = 0;
					continue;
				}
				if (prev !== 0 && prevR === r) pen += (r.face.glyph(prev)?.kerning.get(code) ?? 0) * size;
				this.laid.push({
					g,
					face: r.face,
					size,
					penX: pen,
					baselineY: baseline,
					st: r
				});
				pen += g.advance * size + (ls !== 0 ? ls : 0);
				prev = code;
				prevR = r;
			}
			this.buildLineRects(lineGlyphStart, this.laid.length, top, lineHeight[li], baseline);
			top += lineHeight[li] + this.lineSpacing;
		}
		this._width = blockW;
		this._height = Math.max(0, top - this.lineSpacing);
	}
	baseResolved() {
		return {
			face: this.font,
			sizeMul: 1,
			colTop: 16777215,
			colBottom: 16777215,
			alpha: 1,
			weight: 0,
			oWidth: 0,
			oColor: 0,
			oAlpha: 1,
			oSoft: 0,
			oRound: 0,
			oInner: -1,
			oLayered: false,
			sX: 0,
			sY: 0,
			sColor: 0,
			sAlpha: 0,
			sSoft: 0,
			sSpread: 0,
			sRound: 1,
			sInner: -1,
			skew: 0,
			underline: null,
			strike: null,
			highlight: null
		};
	}
	/** Merge contiguous same-decoration glyph spans on one line into rects. */
	buildLineRects(from, to, lineTop, lineH, baseline) {
		for (const [key, pass] of [
			["highlight", 0],
			["underline", 1],
			["strike", 2]
		]) {
			let i = from;
			while (i < to) {
				const spec = this.laid[i].st[key];
				if (!spec) {
					i++;
					continue;
				}
				let j = i + 1;
				while (j < to && this.laid[j].st[key] === spec) j++;
				this.emitRect(key, spec, this.laid[i], this.laid[j - 1], lineTop, lineH, baseline, pass);
				i = j;
			}
		}
	}
	emitRect(key, spec, first, last, lineTop, lineH, baseline, pass) {
		const st = first.st;
		const x0 = first.penX;
		const x1 = last.penX + last.g.advance * last.size;
		const size = first.size;
		if (key === "highlight") {
			const h = spec;
			const pad = (h.padding ?? 0) * size;
			this.rects.push({
				x: x0 - pad,
				y: lineTop - pad,
				w: x1 - x0 + pad * 2,
				h: lineH + pad * 2,
				face: first.face,
				color: toRGB(h.color ?? 16769357),
				alpha: h.alpha ?? 1,
				radius: h.radius ?? 0,
				border: h.borderWidth ?? 0,
				soft: h.softness ?? 0,
				borderColor: toRGB(h.borderColor ?? 0),
				borderAlpha: 1,
				dashCount: 0,
				dashDuty: 0,
				pass
			});
			return;
		}
		const rule = spec;
		const face = first.face.data;
		const thick = face.underlineThickness * size * (rule.thickness ?? 1);
		const y = key === "strike" ? baseline - .25 * size + (rule.offset ?? 0) * size - thick / 2 : baseline + face.underlineOffset * size + (rule.offset ?? 0) * size - thick / 2;
		let dashCount = 0, dashDuty = 0, radius = 0, soft = 0;
		if (rule.dash) {
			const d = rule.dash === true ? {} : rule.dash;
			const len = (d.length ?? .14) * size;
			const period = len + (d.gap ?? .09) * size;
			const w = x1 - x0;
			dashCount = Math.max(1, Math.round(w / period));
			dashDuty = Math.min(.98, Math.max(.02, len / period));
			radius = d.radius ?? 0;
			soft = d.softness ?? 0;
		}
		this.rects.push({
			x: x0,
			y,
			w: x1 - x0,
			h: thick,
			face: first.face,
			color: toRGB(rule.color ?? st.colTop),
			alpha: rule.alpha ?? st.alpha,
			radius,
			border: 0,
			soft,
			borderColor: 0,
			borderAlpha: 0,
			dashCount,
			dashDuty,
			pass
		});
	}
	wrap(src, chars) {
		const codes = [];
		const srcIdx = [];
		const max = this.maxWidth;
		const fs = this.fontSize, ls = this.letterSpacing;
		if (max <= 0) {
			for (let i = 0; i < src.length; i++) {
				codes.push(src.charCodeAt(i));
				srcIdx.push(i);
			}
			return {
				codes,
				srcIdx
			};
		}
		let lineC = [], lineS = [], wordC = [], wordS = [];
		const measure = (extraCode, extraSrc) => {
			let w = 0, prev = 0, count = 0;
			let prevR = null;
			const add = (code, s) => {
				const r = chars[s];
				const g = r.face.glyph(code);
				if (!g) {
					prev = 0;
					return;
				}
				const size = fs * r.sizeMul;
				if (prev !== 0 && prevR === r) w += (r.face.glyph(prev)?.kerning.get(code) ?? 0) * size;
				w += g.advance * size;
				prev = code;
				prevR = r;
				count++;
			};
			for (let k = 0; k < lineC.length; k++) add(lineC[k], lineS[k]);
			for (let k = 0; k < wordC.length; k++) add(wordC[k], wordS[k]);
			if (extraCode >= 0) add(extraCode, extraSrc);
			if (ls !== 0 && count > 0) w += ls * count;
			return w;
		};
		const commit = (breakSrc) => {
			let end = lineC.length;
			if (breakSrc === -1) while (end > 0 && lineC[end - 1] === 32) end--;
			for (let k = 0; k < end; k++) {
				codes.push(lineC[k]);
				srcIdx.push(lineS[k]);
			}
			if (breakSrc !== null) {
				codes.push(10);
				srcIdx.push(breakSrc);
			}
			lineC = [];
			lineS = [];
		};
		const finishWord = () => {
			if (!wordC.length) return;
			if (measure(-1, 0) > max && lineC.length > 0) {
				commit(-1);
				lineC = wordC;
				lineS = wordS;
			} else for (let k = 0; k < wordC.length; k++) {
				lineC.push(wordC[k]);
				lineS.push(wordS[k]);
			}
			wordC = [];
			wordS = [];
		};
		for (let i = 0; i < src.length; i++) {
			const code = src.charCodeAt(i);
			if (code === 10) {
				finishWord();
				commit(i);
				continue;
			}
			if (code === 32) {
				if (measure(code, i) > max && lineC.length > 0) {
					commit(-1);
					lineC = wordC;
					lineS = wordS;
					lineC.push(code);
					lineS.push(i);
				} else {
					for (let k = 0; k < wordC.length; k++) {
						lineC.push(wordC[k]);
						lineS.push(wordS[k]);
					}
					lineC.push(code);
					lineS.push(i);
				}
				wordC = [];
				wordS = [];
			} else {
				wordC.push(code);
				wordS.push(i);
			}
		}
		finishWord();
		commit(null);
		return {
			codes,
			srcIdx
		};
	}
	/**
	* @internal Push this text's quads into `r` at (x, y). The DRAW SURFACE
	* passes its own renderer, so one block can be drawn in world space and on
	* the HUD.
	*/
	submit(r, x, y, opts = {}) {
		this.ensure();
		const scale = opts.scale ?? 1;
		const rot = opts.rotation ?? 0;
		const objA = opts.alpha ?? 1;
		const ox = (opts.origin?.x ?? 0) * this._width;
		const oy = (opts.origin?.y ?? 0) * this._height;
		const depth = opts.z ?? 0;
		const cos = Math.cos(rot), sin = Math.sin(rot);
		const wx = (lx, ly) => {
			const sx = (lx - ox) * scale, sy = (ly - oy) * scale;
			return x + (sx * cos - sy * sin);
		};
		const wy = (lx, ly) => {
			const sx = (lx - ox) * scale, sy = (ly - oy) * scale;
			return y + (sx * sin + sy * cos);
		};
		for (const rc of this.rects) if (rc.pass === 0) this.pushRect(r, rc, wx, wy, objA, depth);
		for (const lg of this.laid) {
			const st = lg.st;
			if (st.sAlpha <= 0 && st.sColor === 0 && st.sX === 0 && st.sY === 0) continue;
			if (st.sAlpha <= 0) continue;
			const mt = lg.face.isMtsdf;
			const inv = lg.face.invRange;
			const par = packParams(st.weight * inv, mt ? st.sRound : 0, st.sSpread * inv, mt ? st.sSoft : 0);
			const inner = packColor(st.sInner >= 0 ? st.sInner : st.sColor, 0);
			const outl = packColor(st.sColor, st.sAlpha * objA);
			this.pushGlyph(r, lg, st.sX, st.sY, wx, wy, inner, inner, outl, par, depth);
		}
		for (const lg of this.laid) {
			const st = lg.st;
			if (!((st.oLayered || st.oInner >= 0) && (st.oWidth > 0 || st.oSoft > 0))) continue;
			const mt = lg.face.isMtsdf;
			const inv = lg.face.invRange;
			const par = packParams(st.weight * inv, mt ? st.oRound : 0, st.oWidth * inv, mt ? st.oSoft : 0);
			const inner = packColor(st.oInner >= 0 ? st.oInner : st.oColor, 0);
			const outl = packColor(st.oColor, st.oAlpha * objA);
			this.pushGlyph(r, lg, 0, 0, wx, wy, inner, inner, outl, par, depth);
		}
		for (const rc of this.rects) if (rc.pass === 1) this.pushRect(r, rc, wx, wy, objA, depth);
		for (const lg of this.laid) {
			const st = lg.st;
			const mt = lg.face.isMtsdf;
			const inv = lg.face.invRange;
			const hasOutline = !((st.oLayered || st.oInner >= 0) && (st.oWidth > 0 || st.oSoft > 0)) && (st.oWidth > 0 || st.oSoft > 0);
			const par = packParams(st.weight * inv, mt ? st.oRound : 0, hasOutline ? st.oWidth * inv : 0, mt && hasOutline ? st.oSoft : 0);
			const colTop = packColor(st.alpha * objA > 0 ? st.colTop : st.oColor, st.alpha * objA);
			const colBottom = packColor(st.alpha * objA > 0 ? st.colBottom : st.oColor, st.alpha * objA);
			const outl = hasOutline ? packColor(st.oColor, st.oAlpha * objA) : 0;
			this.pushGlyph(r, lg, 0, 0, wx, wy, colTop, colBottom, outl, par, depth);
		}
		for (const rc of this.rects) if (rc.pass === 2) this.pushRect(r, rc, wx, wy, objA, depth);
	}
	pushGlyph(r, lg, offX, offY, wx, wy, colTop, colBottom, outl, par, depth) {
		const g = lg.g;
		if (g.w === 0 || g.h === 0) return;
		const size = lg.size;
		const qx = lg.penX + g.xOffset * size + offX;
		const qy = lg.baselineY + g.yOffset * size + offY;
		const qw = g.w * size, qh = g.h * size;
		const k = lg.st.skew;
		const shear = (ly) => -k * (ly - lg.baselineY);
		const tlx = qx + shear(qy), trx = qx + qw + shear(qy);
		const blx = qx + shear(qy + qh), brx = qx + qw + shear(qy + qh);
		const view = lg.face.view;
		const [ux, uy] = lg.face.unitRange;
		const o = r.alloc(view);
		const f = r.f32, u = r.u32;
		f[o] = wx(tlx, qy);
		f[o + 1] = wy(tlx, qy);
		f[o + 2] = wx(trx, qy);
		f[o + 3] = wy(trx, qy);
		f[o + 4] = wx(blx, qy + qh);
		f[o + 5] = wy(blx, qy + qh);
		f[o + 6] = wx(brx, qy + qh);
		f[o + 7] = wy(brx, qy + qh);
		f[o + 8] = g.uMin;
		f[o + 9] = g.vTop;
		f[o + 10] = g.uMax;
		f[o + 11] = g.vBottom;
		u[o + 12] = colTop;
		u[o + 13] = colTop;
		u[o + 14] = colBottom;
		u[o + 15] = colBottom;
		u[o + 16] = outl;
		u[o + 17] = outl;
		u[o + 18] = outl;
		u[o + 19] = outl;
		u[o + 20] = par;
		u[o + 21] = par;
		u[o + 22] = par;
		u[o + 23] = par;
		f[o + 24] = ux;
		f[o + 25] = uy;
		f[o + 26] = depth;
		f[o + 27] = 0;
	}
	pushRect(r, rc, wx, wy, objA, depth) {
		if (rc.w <= 0 || rc.h <= 0) return;
		const x0 = rc.x, y0 = rc.y, x1 = rc.x + rc.w, y1 = rc.y + rc.h;
		const view = rc.face.view;
		const [ux, uy] = rc.face.unitRange;
		const col = packColor(rc.color, rc.alpha * objA);
		const border = rc.border > 0 ? packColor(rc.borderColor, rc.borderAlpha * objA) : 0;
		const par = rc.dashCount > 0 ? packDashParams(rc.radius, rc.dashDuty, rc.soft) : rc.radius > 0 || rc.border > 0 || rc.soft > 0 ? packSolidParams(rc.radius, rc.border, rc.soft) : 255;
		const uMax = rc.dashCount > 0 ? rc.dashCount : 1;
		const o = r.alloc(view);
		const f = r.f32, u = r.u32;
		f[o] = wx(x0, y0);
		f[o + 1] = wy(x0, y0);
		f[o + 2] = wx(x1, y0);
		f[o + 3] = wy(x1, y0);
		f[o + 4] = wx(x0, y1);
		f[o + 5] = wy(x0, y1);
		f[o + 6] = wx(x1, y1);
		f[o + 7] = wy(x1, y1);
		f[o + 8] = 0;
		f[o + 9] = 0;
		f[o + 10] = uMax;
		f[o + 11] = 1;
		u[o + 12] = col;
		u[o + 13] = col;
		u[o + 14] = col;
		u[o + 15] = col;
		u[o + 16] = border;
		u[o + 17] = border;
		u[o + 18] = border;
		u[o + 19] = border;
		u[o + 20] = par;
		u[o + 21] = par;
		u[o + 22] = par;
		u[o + 23] = par;
		f[o + 24] = ux;
		f[o + 25] = uy;
		f[o + 26] = depth;
		f[o + 27] = 0;
	}
};
//#endregion
//#region src/lib/unicode-text.ts
var RTL_RANGES = [
	[1424, 1535],
	[1536, 1983],
	[1984, 2303],
	[64285, 65023],
	[65136, 65279],
	[67584, 68863],
	[68928, 69311],
	[124928, 126975]
];
/** True when this codepoint is a strong right-to-left character. */
function isRtlCodePoint(cp) {
	for (const [lo, hi] of RTL_RANGES) if (cp >= lo && cp <= hi) return true;
	return false;
}
/**
* The base paragraph direction of a string, by the Unicode "first strong
* character" rule: leading digits, spaces and punctuation are skipped, then the
* first letter decides. `'مرحبا 42'` → rtl, `'42 مرحبا'` → rtl, `'Hi مرحبا'` → ltr.
*/
function detectDirection(text) {
	for (const ch of text) {
		const cp = ch.codePointAt(0);
		if (isRtlCodePoint(cp)) return "rtl";
		if (cp >= 65 && cp <= 90 || cp >= 97 && cp <= 122 || cp >= 192) return "ltr";
	}
	return "ltr";
}
function isCjk(cp) {
	return cp >= 11904 && cp <= 40959 || cp >= 43360 && cp <= 43391 || cp >= 44032 && cp <= 55295 || cp >= 63744 && cp <= 64255 || cp >= 65072 && cp <= 65103 || cp >= 65280 && cp <= 65376 || cp >= 131072 && cp <= 262143;
}
/** Kinsoku: characters that may never START a line (closers, small kana, marks). */
var NO_LINE_START = "）］｝〕〉》」』】〙〗〟’”｠»、。，．：；！？!?,.:;ー々〜〜ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ・ゝゞヽヾ";
/** Kinsoku: characters that may never END a line (openers). */
var NO_LINE_END = "（［｛〔〈《「『【〘〖〝‘“｟«";
/**
* Indices at which a line may be broken (a break happens BEFORE the index).
* Uses `Intl.Segmenter` word segmentation where available — that is what gets
* Thai and Khmer (which have no spaces) right — plus per-character breaking for
* CJK. Kinsoku rules then veto the ugly breaks.
*/
function breakOpportunities(text, locale) {
	const at = /* @__PURE__ */ new Set();
	const seg = segmenter("word", locale);
	if (seg) {
		for (const s of seg.segment(text)) if (s.index > 0) at.add(s.index);
	} else for (let i = 1; i < text.length; i++) if (text.charCodeAt(i - 1) === 32 || text.charCodeAt(i - 1) === 9) at.add(i);
	for (let i = 1; i < text.length; i++) if (isCjk(text.codePointAt(i - 1)) || isCjk(text.codePointAt(i))) at.add(i);
	return [...at].sort((a, b) => a - b).filter((i) => !NO_LINE_START.includes(text[i]) && !NO_LINE_END.includes(text[i - 1]));
}
var segCache = /* @__PURE__ */ new Map();
function segmenter(granularity, locale) {
	const key = `${granularity}|${locale ?? ""}`;
	let seg = segCache.get(key);
	if (seg === void 0) {
		seg = null;
		try {
			const I = Intl;
			if (I.Segmenter) seg = new I.Segmenter(locale, { granularity });
		} catch {
			seg = null;
		}
		segCache.set(key, seg);
	}
	return seg;
}
/** Split into user-perceived characters (grapheme clusters) — emoji and marks stay whole. */
function graphemes(text, locale) {
	const seg = segmenter("grapheme", locale);
	if (!seg) return [...text];
	const out = [];
	for (const s of seg.segment(text)) out.push(s.segment);
	return out;
}
/** Characters rotated a quarter turn when set vertically (tategaki). */
var VERTICAL_ROTATE = "ー〜～－—–‐−(){}[]（）｛｝〔〕〈〉《》「」『』【】〘〙〖〗:;=~<>≪≫";
/** Characters nudged to the cell's top-right when set vertically. */
var VERTICAL_NUDGE = "、。，．";
var NO_BLEED = {
	l: 0,
	t: 0,
	r: 0,
	b: 0
};
function unionBleed(a, b) {
	return {
		l: Math.max(a.l, b.l),
		t: Math.max(a.t, b.t),
		r: Math.max(a.r, b.r),
		b: Math.max(a.b, b.b)
	};
}
var measureCtx = null;
function measurer() {
	if (!measureCtx) measureCtx = document.createElement("canvas").getContext("2d");
	return measureCtx;
}
/** Whether this browser honours `ctx.letterSpacing` (Chrome 99+, Safari 17+, FF 126+). */
var letterSpacingOk = null;
function hasLetterSpacing() {
	if (letterSpacingOk === null) letterSpacingOk = "letterSpacing" in measurer();
	return letterSpacingOk;
}
var MAX_TEX = 4096;
/**
* A retained, styled block of text in ANY writing system. Create it with
* `game.assets.unicodeText(str, opts)`, mutate it with the chainable setters,
* and draw it with `d.unicodeText(text, x, y)` — on the world surface or the
* HUD.
*
* The block lays out and rasterizes lazily: change nothing and a frame costs
* one quad push.
*/
var UnicodeText = class {
	host;
	_text;
	o;
	_lines = [];
	_width = 0;
	_height = 0;
	dirty = true;
	variants = /* @__PURE__ */ new Map();
	_hovered = false;
	_down = false;
	_clicked = false;
	/** The press started ON this block — a drag that began elsewhere can't click it. */
	armed = false;
	prevDown = false;
	clickFns = [];
	/** @internal Built by `game.assets.unicodeText()` — never construct one directly. */
	constructor(host, text = "", opts = {}) {
		this.host = host;
		this._text = Array.isArray(text) ? text.join("\n") : text;
		this.o = {
			...opts,
			fontFamily: opts.fontFamily ?? "sans-serif",
			fontSize: opts.fontSize ?? 48,
			fontWeight: opts.fontWeight ?? 400,
			fontStyle: opts.fontStyle ?? "normal",
			lineHeight: opts.lineHeight ?? 1.3,
			letterSpacing: opts.letterSpacing ?? 0,
			maxWidth: opts.maxWidth ?? 0,
			padding: opts.padding ?? 0,
			vertical: opts.vertical ?? false,
			direction: opts.direction ?? "auto"
		};
	}
	get text() {
		return this._text;
	}
	/** TEXT-box width in px (== draw units at scale 1) — what you ALIGN to. For the
	*  box it actually paints (stroke/glow/shadow/plate) use {@link bounds}. */
	get width() {
		this.ensureLayout();
		return this._width;
	}
	/** TEXT-box height in px — see {@link width}. */
	get height() {
		this.ensureLayout();
		return this._height;
	}
	/** The wrapped lines (or columns, when vertical). */
	get lines() {
		this.ensureLayout();
		return this._lines.map((l) => l.text);
	}
	/** The resolved base direction — useful when `direction: 'auto'`. */
	get resolvedDirection() {
		return this.o.direction === "auto" ? detectDirection(this._text) : this.o.direction;
	}
	/** `true` while the pointer is over this block. */
	get hovered() {
		return this._hovered;
	}
	/** `true` while the pointer is held down on this block. */
	get held() {
		return this._hovered && this._down && this.armed;
	}
	/** `true` for the ONE frame a click completed on this block (press AND release on it). */
	get clicked() {
		return this._clicked;
	}
	/** `true` when this block hit-tests the pointer at all. */
	get isInteractive() {
		return this.o.interactive === true || !!this.o.hover || !!this.o.pressed || this.clickFns.length > 0;
	}
	/** Run `fn` when the block is clicked. Returns an unsubscribe function. */
	onClick(fn) {
		this.clickFns.push(fn);
		return () => {
			const i = this.clickFns.indexOf(fn);
			if (i >= 0) this.clickFns.splice(i, 1);
		};
	}
	setText(text) {
		const next = Array.isArray(text) ? text.join("\n") : text;
		if (next === this._text) return this;
		this._text = next;
		return this.mark();
	}
	setFont(css) {
		this.o.font = css;
		return this.mark();
	}
	setFontFamily(family) {
		this.o.fontFamily = family;
		this.o.font = void 0;
		return this.mark();
	}
	setFontSize(px) {
		this.o.fontSize = px;
		this.o.font = void 0;
		return this.mark();
	}
	setFontWeight(w) {
		this.o.fontWeight = w;
		this.o.font = void 0;
		return this.mark();
	}
	setColor(c) {
		this.o.color = c;
		return this.mark();
	}
	setStroke(s) {
		this.o.stroke = s;
		return this.mark();
	}
	setShadow(s) {
		this.o.shadow = s;
		return this.mark();
	}
	setGlow(g) {
		this.o.glow = g;
		return this.mark();
	}
	setBackground(b) {
		this.o.background = b;
		return this.mark();
	}
	setUnderline(u) {
		this.o.underline = u;
		return this.mark();
	}
	setStrikethrough(s) {
		this.o.strikethrough = s;
		return this.mark();
	}
	setAlign(a) {
		this.o.align = a;
		return this.mark();
	}
	setDirection(d) {
		this.o.direction = d;
		return this.mark();
	}
	setLineHeight(m) {
		this.o.lineHeight = m;
		return this.mark();
	}
	setLetterSpacing(px) {
		this.o.letterSpacing = px;
		return this.mark();
	}
	setMaxWidth(px) {
		this.o.maxWidth = px;
		return this.mark();
	}
	setVertical(on) {
		this.o.vertical = on;
		return this.mark();
	}
	setPadding(px) {
		this.o.padding = px;
		return this.mark();
	}
	/** The look while hovered (`null` removes it). Appearance keys only — see {@link TextStateStyle}. */
	setHoverStyle(s) {
		this.o.hover = s ?? void 0;
		return this.mark();
	}
	/** The look while held down (`null` removes it). */
	setPressedStyle(s) {
		this.o.pressed = s ?? void 0;
		return this.mark();
	}
	mark() {
		this.dirty = true;
		for (const v of this.variants.values()) v.tex?.destroy();
		this.variants.clear();
		return this;
	}
	/** Shrink `fontSize` (binary search) until the wrapped block fits `w`×`h` px. */
	fitInside(w, h, opts = {}) {
		let lo = opts.minSize ?? 4, hi = opts.maxSize ?? this.o.fontSize;
		const prec = opts.precision ?? .5;
		this.o.maxWidth = w;
		this.o.font = void 0;
		while (hi - lo > prec) {
			const mid = (lo + hi) / 2;
			this.o.fontSize = mid;
			this.dirty = true;
			this.ensureLayout();
			if (this._width <= w && this._height <= h) lo = mid;
			else hi = mid;
		}
		this.o.fontSize = lo;
		return this.mark();
	}
	/** Free every GPU texture. The block re-rasterizes if drawn again. */
	destroy() {
		for (const v of this.variants.values()) v.tex?.destroy();
		this.variants.clear();
		this.dirty = true;
	}
	/**
	* The box this block actually PAINTS when drawn at (x, y) with `opts` — the
	* text box grown by stroke, glow, shadow and background-plate ink, then put
	* through origin / scale / rotation. **This is what you space layout against**;
	* `width`/`height` are the tighter text box you ALIGN to.
	*
	* Reserved worst case: the bounds cover the largest of the base, hover and
	* pressed states, so a menu spaced by this cannot collide when an item lights
	* up or grows on hover.
	*
	* ```ts
	* const b = score.bounds(16, 12);
	* timer.setMaxWidth(...); d.unicodeText(timer, 16, b.bottom + 8);   // never overlaps
	* ```
	*/
	bounds(x, y, opts) {
		this.ensureLayout();
		const b = this.maxBleed();
		const scale = (opts?.scale ?? 1) * this.maxStateScale();
		return transformedBounds(this._width + b.l + b.r, this._height + b.t + b.b, x, y, {
			...opts,
			scale
		}, b.l, b.t, this._width, this._height);
	}
	/**
	* The CLICKABLE box — the text box plus the background plate's padding and
	* `hitPadding`. Deliberately NOT the painted box: a soft glow should not
	* swallow the pointer twenty pixels away from any letter.
	*/
	hitBounds(x, y, opts) {
		this.ensureLayout();
		const p = this.hitPad();
		return transformedBounds(this._width + p * 2, this._height + p * 2, x, y, opts, p, p, this._width, this._height);
	}
	hitPad() {
		let plate = 0;
		for (const s of this.states()) {
			const bg = this.styleFor(s).background;
			if (bg) plate = Math.max(plate, bg.padding ?? 12);
		}
		return (this.o.hitPadding ?? 0) + plate;
	}
	/** Which states this block can be in — only those actually styled. */
	states() {
		const out = ["base"];
		if (this.o.hover) out.push("hover");
		if (this.o.pressed) out.push("pressed");
		return out;
	}
	maxBleed() {
		let b = NO_BLEED;
		for (const s of this.states()) b = unionBleed(b, this.inkBleed(s));
		return b;
	}
	maxStateScale() {
		return Math.max(1, this.o.hover?.scale ?? 1, this.o.pressed?.scale ?? 1);
	}
	/** The appearance of one state: its own keys over the base ones. */
	styleFor(state) {
		if (state === "base") return this.o;
		const s = state === "hover" ? this.o.hover : this.o.pressed;
		if (!s) return this.o;
		return {
			color: s.color ?? this.o.color,
			stroke: s.stroke !== void 0 ? s.stroke : this.o.stroke,
			shadow: s.shadow !== void 0 ? s.shadow : this.o.shadow,
			glow: s.glow !== void 0 ? s.glow : this.o.glow,
			background: s.background !== void 0 ? s.background : this.o.background,
			underline: s.underline !== void 0 ? s.underline : this.o.underline,
			strikethrough: s.strikethrough !== void 0 ? s.strikethrough : this.o.strikethrough
		};
	}
	cssFont() {
		if (this.o.font) return this.o.font;
		return `${this.o.fontStyle === "normal" ? "" : `${this.o.fontStyle} `}${this.o.fontWeight} ${this.o.fontSize}px ${this.o.fontFamily}`;
	}
	/** The em size the layout uses — parsed out of a `font` shorthand when given. */
	emSize() {
		if (!this.o.font) return this.o.fontSize;
		const m = /(\d*\.?\d+)px/.exec(this.o.font);
		return m ? parseFloat(m[1]) : this.o.fontSize;
	}
	applyFont(ctx) {
		ctx.font = this.cssFont();
		if (hasLetterSpacing()) ctx.letterSpacing = `${this.o.letterSpacing}px`;
		ctx.direction = this.resolvedDirection;
	}
	ensureLayout() {
		if (this.dirty) this.layout();
	}
	layout() {
		const ctx = measurer();
		ctx.save();
		this.applyFont(ctx);
		const em = this.emSize();
		const lh = em * this.o.lineHeight;
		const pad = this.o.padding;
		if (this.o.vertical) {
			const cols = this.layoutVertical(em);
			this._lines = cols;
			this._width = cols.length * lh + pad * 2;
			this._height = (cols.length ? Math.max(...cols.map((c) => c.width)) : 0) + pad * 2;
		} else {
			const lines = [];
			for (const para of this._text.split("\n")) {
				if (!this.o.maxWidth) {
					lines.push({
						text: para,
						width: ctx.measureText(para).width
					});
					continue;
				}
				for (const l of this.wrap(ctx, para, this.o.maxWidth)) lines.push(l);
			}
			this._lines = lines;
			this._width = (lines.length ? Math.max(...lines.map((l) => l.width)) : 0) + pad * 2;
			this._height = lines.length * lh + pad * 2;
		}
		ctx.restore();
		this.dirty = false;
	}
	/**
	* Greedy wrap at the script-correct break opportunities: take the LAST
	* opportunity that still fits, and hard-break by grapheme when even the first
	* one overflows (a long URL, or CJK with no opportunities at all).
	*/
	wrap(ctx, para, max) {
		if (!para) return [{
			text: "",
			width: 0
		}];
		const ends = breakOpportunities(para, this.o.locale).filter((i) => i > 0 && i < para.length);
		ends.push(para.length);
		const out = [];
		const trimEnd = (s) => s.replace(/\s+$/, "");
		let start = 0;
		let i = 0;
		while (start < para.length) {
			while (i < ends.length && ends[i] <= start) i++;
			let fit = -1, j = i;
			while (j < ends.length) {
				const t = trimEnd(para.slice(start, ends[j]));
				if (ctx.measureText(t).width > max) break;
				fit = ends[j];
				j++;
			}
			if (fit < 0) {
				const chunk = para.slice(start, ends[i] ?? para.length);
				let buf = "";
				for (const g of graphemes(chunk, this.o.locale)) {
					if (buf && ctx.measureText(buf + g).width > max) break;
					buf += g;
				}
				if (!buf) buf = chunk.slice(0, 1) || para.slice(start, start + 1);
				out.push({
					text: buf,
					width: ctx.measureText(buf).width
				});
				start += buf.length;
				continue;
			}
			const line = trimEnd(para.slice(start, fit));
			out.push({
				text: line,
				width: ctx.measureText(line).width
			});
			start = fit;
			while (para[start] === " ") start++;
			i = j;
		}
		return out.length ? out : [{
			text: "",
			width: 0
		}];
	}
	/** Vertical columns: graphemes stack downward, `maxWidth` caps the run length. */
	layoutVertical(em) {
		const step = em * this.o.lineHeight;
		const capacity = this.o.maxWidth > 0 ? Math.max(1, Math.floor(this.o.maxWidth / step)) : Infinity;
		const cols = [];
		for (const para of this._text.split("\n")) {
			const gs = graphemes(para, this.o.locale);
			let buf = [];
			for (const g of gs) {
				if (buf.length >= capacity && !NO_LINE_START.includes(g)) {
					cols.push({
						text: buf.join(""),
						width: buf.length * step
					});
					buf = [];
				}
				buf.push(g);
			}
			cols.push({
				text: buf.join(""),
				width: buf.length * step
			});
		}
		return cols;
	}
	/** Per-side px of canvas the stroke/shadow/glow/plate ink needs beyond the text box. */
	inkBleed(state) {
		const s = this.styleFor(state);
		let l = 2, t = 2, r = 2, b = 2;
		const grow = (n) => {
			l = Math.max(l, n);
			t = Math.max(t, n);
			r = Math.max(r, n);
			b = Math.max(b, n);
		};
		if (s.stroke) grow((s.stroke.width ?? 4) * (s.stroke.align === "center" ? .5 : 1) + 1);
		if (s.glow) grow((s.glow.blur ?? 12) + 2);
		if (s.background) grow((s.background.padding ?? 12) + (s.background.borderWidth ?? 0) + 2);
		for (const sh of shadowList(s.shadow)) {
			const x = sh.x ?? 0, y = sh.y ?? 0, blur = (sh.blur ?? 0) + 2;
			l = Math.max(l, blur - x);
			r = Math.max(r, blur + x);
			t = Math.max(t, blur - y);
			b = Math.max(b, blur + y);
		}
		if (s.underline) b = Math.max(b, this.emSize() * .25);
		return {
			l: Math.ceil(l),
			t: Math.ceil(t),
			r: Math.ceil(r),
			b: Math.ceil(b)
		};
	}
	/** Paint one state's block into a fresh canvas at `res`× supersampling. */
	raster(state, res) {
		this.ensureLayout();
		const s = this.styleFor(state);
		const em = this.emSize();
		const lh = em * this.o.lineHeight;
		const pad = this.o.padding;
		const bleed = this.inkBleed(state);
		const boxW = this._width - pad * 2;
		const boxH = this._height - pad * 2;
		const spanW = this._width + bleed.l + bleed.r;
		const spanH = this._height + bleed.t + bleed.b;
		let r = res;
		let capRes = Infinity;
		if (spanW * r > MAX_TEX || spanH * r > MAX_TEX) {
			r = Math.max(.05, Math.min(MAX_TEX / Math.max(1, spanW), MAX_TEX / Math.max(1, spanH)));
			capRes = r;
		}
		const cw = Math.min(MAX_TEX, Math.max(1, Math.ceil(spanW * r)));
		const ch = Math.min(MAX_TEX, Math.max(1, Math.ceil(spanH * r)));
		const c = document.createElement("canvas");
		c.width = cw;
		c.height = ch;
		const ctx = c.getContext("2d");
		ctx.scale(r, r);
		this.applyFont(ctx);
		ctx.textBaseline = "alphabetic";
		const ox = bleed.l + pad;
		const oy = bleed.t + pad;
		this.paintBackground(ctx, s, ox, oy, boxW, boxH);
		const fill = this.makeFill(ctx, s, ox, oy, boxW, boxH);
		if (this.o.vertical) this.paintVertical(ctx, s, ox, oy, lh, em, fill);
		else this.paintHorizontal(ctx, s, ox, oy, boxW, lh, em, fill);
		return {
			canvas: c,
			tex: null,
			res: r,
			capRes,
			bleed,
			epoch: -1
		};
	}
	paintBackground(ctx, s, ox, oy, w, h) {
		const bg = s.background;
		if (!bg) return;
		const p = bg.padding ?? 12;
		const rad = bg.radius ?? 0;
		const x = ox - p, y = oy - p, bw = w + p * 2, bh = h + p * 2;
		ctx.beginPath();
		if (rad > 0 && typeof ctx.roundRect === "function") ctx.roundRect(x, y, bw, bh, rad);
		else ctx.rect(x, y, bw, bh);
		if (bg.color) {
			ctx.fillStyle = bg.color;
			ctx.fill();
		}
		if (bg.borderWidth) {
			ctx.lineWidth = bg.borderWidth;
			ctx.strokeStyle = bg.borderColor ?? "#ffffff";
			ctx.stroke();
		}
	}
	/** The fill style: a colour string, or a gradient built across the block. */
	makeFill(ctx, s, ox, oy, boxW, boxH) {
		const col = s.color ?? "#ffffff";
		if (typeof col === "string") return col;
		const stops = "stops" in col ? col.stops.map((v, i, a) => typeof v === "string" ? [a.length === 1 ? 0 : i / (a.length - 1), v] : v) : [[0, col.top], [1, col.bottom]];
		const rad = (("stops" in col ? col.angle : void 0) ?? 90) * Math.PI / 180;
		const cx = ox + boxW / 2, cy = oy + boxH / 2;
		const len = Math.abs(Math.cos(rad)) * boxW + Math.abs(Math.sin(rad)) * boxH;
		const g = ctx.createLinearGradient(cx - Math.cos(rad) * len / 2, cy - Math.sin(rad) * len / 2, cx + Math.cos(rad) * len / 2, cy + Math.sin(rad) * len / 2);
		for (const [at, c] of stops) g.addColorStop(Math.max(0, Math.min(1, at)), c);
		return g;
	}
	/** Where a line's anchor x sits, and which canvas textAlign to use for it. */
	anchor(ox, boxW) {
		const rtl = this.resolvedDirection === "rtl";
		const a = this.o.align ?? (rtl ? "right" : "left");
		if (a === "center") return {
			x: ox + boxW / 2,
			align: "center"
		};
		if (a === "right") return {
			x: ox + boxW,
			align: "right"
		};
		return {
			x: ox,
			align: "left"
		};
	}
	paintHorizontal(ctx, s, ox, oy, boxW, lh, em, fill) {
		const { x, align } = this.anchor(ox, boxW);
		ctx.textAlign = align;
		const baseline = oy + em * .82 + (lh - em) / 2;
		for (let i = 0; i < this._lines.length; i++) {
			const line = this._lines[i];
			const y = baseline + i * lh;
			this.paintOne(ctx, s, line.text, x, y, fill);
			this.paintRules(ctx, s, line, x, y, em, fill);
		}
	}
	/** Underline / strikethrough for one laid-out line. */
	paintRules(ctx, s, line, anchorX, baseline, em, fill) {
		if (!s.underline && !s.strikethrough) return;
		if (!line.width) return;
		const a = ctx.textAlign;
		const x0 = a === "center" ? anchorX - line.width / 2 : a === "right" ? anchorX - line.width : anchorX;
		const rule = (spec, dy) => {
			const r = spec === true ? {} : spec;
			const th = r.thickness ?? Math.max(1, em * .06);
			ctx.fillStyle = r.color ?? fill;
			ctx.fillRect(x0, baseline + dy + (r.offset ?? 0) - th / 2, line.width, th);
		};
		if (s.underline) rule(s.underline, em * .14);
		if (s.strikethrough) rule(s.strikethrough, -em * .28);
	}
	paintVertical(ctx, s, ox, oy, lh, em, fill) {
		ctx.textAlign = "center";
		const cols = this._lines;
		for (let ci = 0; ci < cols.length; ci++) {
			const cx = ox + (cols.length - 1 - ci) * lh + lh / 2;
			const gs = graphemes(cols[ci].text, this.o.locale);
			for (let gi = 0; gi < gs.length; gi++) {
				const g = gs[gi];
				const cy = oy + gi * lh + em * .82 + (lh - em) / 2;
				if (VERTICAL_ROTATE.includes(g)) {
					ctx.save();
					ctx.translate(cx, cy - em * .32);
					ctx.rotate(Math.PI / 2);
					this.paintOne(ctx, s, g, 0, em * .32, fill);
					ctx.restore();
				} else if (VERTICAL_NUDGE.includes(g)) this.paintOne(ctx, s, g, cx + em * .4, cy - em * .55, fill);
				else this.paintOne(ctx, s, g, cx, cy, fill);
			}
		}
	}
	/** One run of text: shadows → glow → stroke → fill, in that order. */
	paintOne(ctx, s, str, x, y, fill) {
		if (!str) return;
		const st = s.stroke;
		const strokeW = st ? (st.width ?? 4) * (st.align === "center" ? 1 : 2) : 0;
		for (const sh of shadowList(s.shadow)) {
			ctx.save();
			ctx.shadowOffsetX = sh.x ?? 0;
			ctx.shadowOffsetY = sh.y ?? 0;
			ctx.shadowBlur = sh.blur ?? 0;
			ctx.shadowColor = sh.color ?? "rgba(0,0,0,0.6)";
			ctx.fillStyle = "#000";
			if (strokeW > 0) {
				ctx.lineWidth = strokeW;
				ctx.lineJoin = st.join ?? "round";
				ctx.strokeStyle = "#000";
				ctx.strokeText(str, x, y);
			}
			ctx.fillText(str, x, y);
			ctx.restore();
		}
		const gl = s.glow;
		if (gl) {
			ctx.save();
			ctx.shadowOffsetX = 0;
			ctx.shadowOffsetY = 0;
			ctx.shadowBlur = gl.blur ?? 12;
			ctx.shadowColor = gl.color ?? "#ffffff";
			ctx.fillStyle = gl.color ?? "#ffffff";
			const n = Math.max(1, Math.min(6, Math.round(gl.strength ?? 3)));
			for (let i = 0; i < n; i++) ctx.fillText(str, x, y);
			ctx.restore();
		}
		if (strokeW > 0) {
			ctx.lineWidth = strokeW;
			ctx.lineJoin = st.join ?? "round";
			ctx.miterLimit = 2;
			ctx.strokeStyle = st.color ?? "#000000";
			ctx.strokeText(str, x, y);
		}
		ctx.fillStyle = fill;
		ctx.fillText(str, x, y);
	}
	/**
	* @internal Push this block's quad into `r` at (x, y). Called by
	* `d.unicodeText()`; the surface passes its own renderer (which is why the
	* SAME object can be drawn in world space and on the HUD) and its pointer.
	*/
	submit(r, x, y, opts = {}, pointer) {
		const state = this.updateInput(x, y, opts, pointer);
		const stateStyle = state === "hover" ? this.o.hover : state === "pressed" ? this.o.pressed : void 0;
		const scale = (opts.scale ?? 1) * (stateStyle?.scale ?? 1);
		const v = this.ensureRaster(state, r.pxPerUnit * Math.abs(scale));
		const view = v.tex?.view;
		if (!view) return;
		const rot = opts.rotation ?? 0;
		const a = (opts.alpha ?? 1) * (stateStyle?.alpha ?? 1);
		const col = packColor(tintRGB(opts.tint), a);
		const depth = opts.z ?? 0;
		const qw = v.canvas.width / v.res;
		const qh = v.canvas.height / v.res;
		const ox = (opts.origin?.x ?? 0) * this._width + v.bleed.l;
		const oy = (opts.origin?.y ?? 0) * this._height + v.bleed.t;
		const cos = Math.cos(rot), sin = Math.sin(rot);
		const wx = (lx, ly) => {
			const sx = (lx - ox) * scale, sy = (ly - oy) * scale;
			return x + (sx * cos - sy * sin);
		};
		const wy = (lx, ly) => {
			const sx = (lx - ox) * scale, sy = (ly - oy) * scale;
			return y + (sx * sin + sy * cos);
		};
		const o = r.alloc(view);
		const f = r.f32, u = r.u32;
		f[o] = wx(0, 0);
		f[o + 1] = wy(0, 0);
		f[o + 2] = wx(qw, 0);
		f[o + 3] = wy(qw, 0);
		f[o + 4] = wx(0, qh);
		f[o + 5] = wy(0, qh);
		f[o + 6] = wx(qw, qh);
		f[o + 7] = wy(qw, qh);
		f[o + 8] = 0;
		f[o + 9] = 0;
		f[o + 10] = 1;
		f[o + 11] = 1;
		u[o + 12] = col;
		u[o + 13] = col;
		u[o + 14] = col;
		u[o + 15] = col;
		u[o + 16] = 0;
		u[o + 17] = 0;
		u[o + 18] = 0;
		u[o + 19] = 0;
		u[o + 20] = 253;
		u[o + 21] = 253;
		u[o + 22] = 253;
		u[o + 23] = 253;
		f[o + 24] = 0;
		f[o + 25] = 0;
		f[o + 26] = depth;
		f[o + 27] = 0;
	}
	/**
	* Hit-test the pointer and advance the press/click edge machine. Returns the
	* state to draw. A click needs the press AND the release on this block, so a
	* drag that began elsewhere can't trigger it.
	*/
	updateInput(x, y, opts, read) {
		this._clicked = false;
		if (!this.isInteractive) return "base";
		const pointer = read?.() ?? null;
		if (!pointer) {
			this._hovered = false;
			this._down = false;
			this.armed = false;
			this.prevDown = false;
			return "base";
		}
		const box = this.hitBounds(x, y, opts);
		const over = pointer.x >= box.x && pointer.x <= box.right && pointer.y >= box.y && pointer.y <= box.bottom;
		this._hovered = over;
		this._down = pointer.down;
		if (pointer.down && !this.prevDown) this.armed = over;
		if (!pointer.down && this.prevDown && this.armed && over) {
			this._clicked = true;
			for (const fn of this.clickFns) fn(this);
		}
		if (!pointer.down) this.armed = false;
		this.prevDown = pointer.down;
		if (over && (this.o.cursor ?? true)) pointer.wantCursor?.();
		if (over && pointer.down && this.armed && this.o.pressed) return "pressed";
		if (over && this.o.hover) return "hover";
		return "base";
	}
	/**
	* Rasterize + upload this state if needed. `wanted` is how many device pixels
	* one draw unit covers this frame: the block re-rasterizes when it would
	* otherwise be drawn blurry. Quantised to half-steps and RAISE-ONLY (below
	* the cap), so a zooming camera can't churn a fresh texture every frame.
	*/
	ensureRaster(state, wanted) {
		this.ensureLayout();
		const pinned = this.o.resolution;
		const auto = Math.max(1, Math.min(4, Math.ceil(wanted / 1.1 * 2) / 2));
		const have = this.variants.get(state);
		const target = Math.min(pinned ?? auto, have?.capRes ?? Infinity);
		const epoch = this.host.epoch();
		if (have && have.epoch === epoch && have.res >= target) return have;
		const v = this.raster(state, Math.max(target, have && have.epoch !== epoch ? have.res : 0));
		have?.tex?.destroy();
		v.tex = this.host.textTexture(v.canvas);
		v.epoch = epoch;
		this.variants.set(state, v);
		return v;
	}
};
function shadowList(s) {
	return !s ? [] : Array.isArray(s) ? s : [s];
}
/** A hex tint → 0xRRGGBB (white when absent). */
function tintRGB(hex) {
	if (!hex) return 16777215;
	const [r, g, b] = rgba(hex);
	return r * 255 << 16 | g * 255 << 8 | b * 255 | 0;
}
//#endregion
//#region src/lib/game-assets.ts
/**
* THE ASSET REGISTRY — bake or load something once, get back the handle the
* draw verbs take: `game.assets.loadFrames(url)`, `game.assets.font()`,
* `game.assets.msdfFont(png, json)`.
*
* Everything here is IDEMPOTENT in its inputs, so calling it in every scene's
* setup() is free — a repeat request returns the same frame/font and adds
* nothing to the atlas.
*/
var Assets = class {
	host;
	/** Registered frames per url|frameW|frameH — loadFrames/framesOf are idempotent. */
	frameCache = /* @__PURE__ */ new Map();
	/** Baked bitmap fonts per font|charset — font() is idempotent. */
	fontCache = /* @__PURE__ */ new Map();
	/** @internal Built by `Game` — reach it as `game.assets`, never construct one. */
	constructor(host) {
		this.host = host;
	}
	/** Register sprite frames from a canvas (a horizontal strip slices at `frameW`). Returns the first frame index. */
	frames(src, frameW) {
		return this.host.atlas().add(src, frameW);
	}
	/**
	* Load an image file (PNG…) and register its frames — the real-art path.
	* No frameW: one frame. frameW: a horizontal strip. frameW + frameH: a
	* GRID sheet, sliced row-major (left→right, top→bottom). Await this
	* BEFORE run() so the frame indices exist when you draw.
	* Returns the first frame index.
	*/
	async loadFrames(url, frameW, frameH) {
		const key = `${url}|${frameW ?? 0}|${frameH ?? 0}`;
		const hit = this.frameCache.get(key);
		if (hit !== void 0) return hit;
		const img = await loadImage(url);
		return this.registerImage(key, img, frameW, frameH);
	}
	/**
	* SYNCHRONOUS frames for a preloaded image (queue `load.image(url)` in the
	* scene's preload() first) — the setup()-friendly counterpart of
	* loadFrames. Same slicing rules; idempotent. Throws if the image hasn't
	* loaded yet.
	*/
	framesOf(url, frameW, frameH) {
		const key = `${url}|${frameW ?? 0}|${frameH ?? 0}`;
		const hit = this.frameCache.get(key);
		if (hit !== void 0) return hit;
		const img = getImage(url);
		if (!img) throw new Error(`framesOf('${url}'): image not loaded — queue load.image(url) in preload(), or use await game.assets.loadFrames()`);
		return this.registerImage(key, img, frameW, frameH);
	}
	registerImage(key, img, frameW, frameH) {
		const rowH = frameH && frameH < img.height ? frameH : img.height;
		let first = -1;
		for (let y = 0; y + rowH <= img.height; y += rowH) {
			const strip = document.createElement("canvas");
			strip.width = img.width;
			strip.height = rowH;
			strip.getContext("2d").drawImage(img, 0, -y);
			const idx = this.host.atlas().add(strip, frameW);
			if (first < 0) first = idx;
		}
		this.frameCache.set(key, first);
		return first;
	}
	/** A frame's natural size in pixels (== world units at scale 1). */
	frameSize(frame) {
		const atlas = this.host.atlas();
		if (atlas.dirty) atlas.build();
		const f = atlas.frames[frame];
		return f ? {
			w: f.w,
			h: f.h
		} : {
			w: 0,
			h: 0
		};
	}
	/**
	* Rasterize text once and register it as a frame (for FIXED strings; for
	* anything dynamic use font()). IDEMPOTENT in (str, font, color): a repeat
	* request returns the same frame and adds nothing to the atlas, so calling
	* it in every scene's setup() can't bloat or churn-repack the atlas.
	*/
	text(str, opts) {
		const key = `text|${str}|${opts?.font ?? ""}|${opts?.color ?? ""}`;
		const hit = this.frameCache.get(key);
		if (hit !== void 0) return hit;
		warnIfFontMissing(opts?.font);
		const idx = this.host.atlas().add(rasterText(str, opts));
		this.frameCache.set(key, idx);
		return idx;
	}
	/**
	* Bake a bitmap font (white glyphs on the shared atlas). Draw with
	* `d.text(font, …)`. IDEMPOTENT: a bake is fully determined by (font,
	* charset), so an identical request returns the SAME BitmapFont and adds
	* NOTHING new to the atlas. Calling `game.assets.font('bold 26px monospace')`
	* in every scene's setup() is therefore free — it can't grow the atlas
	* without bound or churn-repack it (which used to smear glyphs onto static
	* 3D geometry). Bake as many DISTINCT fonts as you like; just don't expect a
	* repeat of the same one to cost anything.
	*/
	font(opts) {
		const key = `${opts?.font ?? ""}|${opts?.charset ?? ""}`;
		let font = this.fontCache.get(key);
		if (!font) {
			warnIfFontMissing(opts?.font);
			font = bakeFont(this.host.atlas(), opts);
			this.fontCache.set(key, font);
		}
		return font;
	}
	/**
	* Load an MSDF font — an atlas `.png` + an msdf-atlas-gen `.json` layout —
	* for crisp, scalable, styleable text (weight, outline, shadow, gradients).
	* Await in setup() (queue `load.msdfFont(png, json)` in preload() for the bar).
	* Returns the primary face; a merged (`-and`) atlas exposes the rest via
	* `font.face(name)`. Build text with `game.assets.msdfText(font, str)`; draw
	* it with `d.msdfText(text, x, y)`.
	*/
	async msdfFont(pngUrl, jsonUrl, name) {
		const [img, json] = await Promise.all([loadImage(pngUrl), loadJson(jsonUrl)]);
		if (!json?.atlas) throw new Error(`msdfFont: '${jsonUrl}' is not an msdf-atlas-gen JSON`);
		const datas = parseMsdfFont(json, name ?? jsonUrl.split("/").pop().replace(/\.[^.]+$/, ""));
		const src = typeof createImageBitmap !== "undefined" ? await createImageBitmap(img, {
			premultiplyAlpha: "none",
			colorSpaceConversion: "none"
		}) : img;
		const view = this.host.msdfTexture(src, json.atlas.width, json.atlas.height);
		const faces = /* @__PURE__ */ new Map();
		let primary = null;
		for (const d of datas) {
			const f = new MsdfFont(d, view, faces);
			faces.set(f.name, f);
			primary ??= f;
		}
		return primary;
	}
	/** Create a styled, retained MSDF text block. Draw it with `d.msdfText(text, x, y)`. */
	msdfText(font, text, opts) {
		return new MsdfText(font, text, opts);
	}
	/**
	* THE TEXT PATH FOR EVERY WRITING SYSTEM — Chinese, Japanese, Korean, Arabic,
	* Hebrew, Thai, Devanagari, Cyrillic, Greek, emoji (and Latin). The browser's
	* own text engine shapes the string (Arabic joining forms, Indic reordering),
	* applies right-to-left bidi, and falls back per character to a system font
	* that has the glyph; the finished block is rasterized ONCE into its own
	* texture and drawn as a single quad.
	*
	* `d.text` (bitmap) and `d.msdfText` (MSDF) bake a FIXED charset and advance a
	* pen left-to-right — they cannot render any of the above. **Any string that
	* is not plain Latin/digits belongs here.**
	*
	* Returns a retained, mutable block: build it in `setup()`, mutate it with the
	* chainable setters, draw it with `d.unicodeText(t, x, y)` on the world
	* surface or the HUD. See unicode-text.md.
	*/
	unicodeText(text, opts) {
		return new UnicodeText({
			textTexture: (c) => this.host.textTexture(c),
			epoch: () => this.host.textureEpoch()
		}, text, opts);
	}
	/**
	* Register a CUSTOM vertex deformer (a DeformDef — pure data, the same
	* block-delivery shape as post EffectDefs). Use it by name afterwards:
	* `d.sprite(f, x, y, { deform: { kind: def.name, amount, speed } })`.
	* Call at load time (it recompiles the grid pipeline once).
	*/
	deformer(def) {
		this.host.registerDeform(def);
	}
	/**
	* Register a CUSTOM vfx recipe (a VfxDef — pure data, the block path). Use it
	* by name afterwards: `this.vfx.burst(def.name, x, y)` for a one-shot, or
	* `this.vfx.trail(def.name)` for a mover's trail.
	*/
	vfx(def) {
		registerVfx(def);
	}
};
/**
* Baking rasterizes whatever face the browser has for this CSS font RIGHT NOW,
* and the result is permanent (glyphs land on the atlas once). If the family
* isn't available yet the browser substitutes a fallback silently — the classic
* "my title baked in Arial" bug. There is nothing we can do about it
* synchronously, so make it LOUD and name the fix. Warned once per font string.
*/
var fontWarned = /* @__PURE__ */ new Set();
function warnIfFontMissing(cssFont) {
	if (!cssFont || fontWarned.has(cssFont) || isFontUsable(cssFont)) return;
	fontWarned.add(cssFont);
	console.warn(`Phaser AE: baking '${cssFont}' before that face is available — the browser will substitute a fallback, permanently. Queue the file in the scene's preload() first: load.font('<family>', '<url>').`);
}
//#endregion
//#region src/lib/game.ts
var Game = class Game {
	/** Engine version string, stamped at build time. */
	version = "Phaser AE v2.5.0 (WebGPU)";
	/** The draw verbs — valid inside the run() callback. WORLD space (scrolls with the camera). */
	draw;
	/** The same verbs in SCREEN space: origin (0,0) top-left of the window, camera-proof,
	* always on top of the world. Score, health bars, prompts go here. */
	hud;
	/** The ACTIVE scene (an implicit one when no roster was given). */
	current;
	/** Alias for the active scene — `game.scene.add(...)` etc. */
	get scene() {
		return this.current;
	}
	/** The active scene's camera (each scene owns its own). */
	get camera() {
		return this.current.camera;
	}
	/** The particle system — emit() bursts/streams; updated + drawn automatically (over the scene). */
	fx = new Particles();
	/** This frame's visible world rect (camera origin + worldHeight fit). */
	view = {
		x: 0,
		y: 0,
		w: 0,
		h: 0
	};
	/** Keyboard and pointer input. Read key/mouse state from scenes via `this.input`. */
	input;
	/** Audio / SFX / music system. Play sounds with `this.game.sound.play('hit')` or stream music with `.music(url)`. */
	sound;
	/** Motion / animation system (tween / ease / interpolate). Animate sprite properties with `this.tween.to(sprite, { x: 200 })`. Advanced by the run loop — tweens freeze when the game pauses. */
	tween;
	/**
	* The PRESENTATION SURFACE — the canvas as a display, and what you capture off
	* it: `game.screen.fullscreen()`, `.screenshot(cb)`, `.record(60, 10, cb)`.
	* Host-shell API (a page's fullscreen / share button), not game API — nothing
	* here touches the simulation. To freeze the game use `game.pause()`.
	*/
	screen;
	/**
	* THE ASSET REGISTRY — bake or load something once, get the handle the draw
	* verbs take: `game.assets.loadFrames(url)`, `.font()`, `.msdfFont(png, json)`,
	* `.deformer(def)`. Every call is idempotent, so setup() can re-run for free.
	*/
	assets;
	/**
	* THE POST CHAIN — full-screen effects OVER the finished frame:
	* `game.post.add('bloom')`, `game.post.clear()`. For fire/smoke/sparks IN the
	* world you want `game.fx` (particles), not this.
	*/
	post;
	/**
	* THE BACKDROP STACK — full-screen layers BEHIND the world, camera-aware:
	* `game.backdrop.add('stars')`, `.clear()`, `.background(img)`.
	*/
	backdrop;
	/** HUD stays crisp above post effects (default). false = effects apply to the HUD too. */
	hudAboveFx = true;
	/**
	* Seconds of input GRACE after every scene transition (default 0.5 =
	* 500 ms): all keys and gestures read as inactive, so a player frantically
	* tapping fire when they die can't instantly dismiss the game-over screen.
	* Set 0 to disable.
	*/
	inputGrace = .5;
	/**
	* The DEBUG OVERLAY — ships in every game, off by default. Set `true` for
	* everything (hitboxes, velocity vectors, contacts, tile collision,
	* stats) or pick: `game.debug = { hitboxes: true }`. For players AND
	* agents: when a hitbox looks wrong, turn this on so they can SEE it.
	*/
	get debug() {
		return this.debugOpts ?? false;
	}
	set debug(v) {
		this.debugOpts = normalizeDebug(v);
	}
	/** Seconds since run() started. */
	time = 0;
	canvas;
	/** Which backend this game runs on: 'webgpu', or 'webgl' (the fallback). */
	renderer;
	gpu;
	/** The WebGL fallback backend (null on the WebGPU path). */
	glr;
	/** The GL 3D world when the fallback carries one (this.world stays the
	*  public-typed handle; this is the concretely-typed twin reference). */
	glWorld = null;
	atlas = new Atlas();
	cutoutBatch;
	blendBatch;
	/** Bitmap labels for the WORLD surface's UI — flushed in the UI band, over panels. */
	textBatch;
	/**
	* Submission order for each surface's SCENE content: its quads and its text
	* pass, interleaved. A sign drawn before a wall goes behind it — the frame
	* breaks the quad batch, draws the text, and resumes. See DrawOrder.
	*/
	sceneOrder;
	hudOrder;
	/** The WORLD text pass (MSDF + Unicode blocks) — over the lit scene, under the HUD. */
	msdf;
	ui;
	/** The SCREEN-SPACE twin: the same text verbs on `game.hud`, in CSS pixels, over the HUD sprites. */
	msdfHud;
	uiHud;
	/** Bumped on every device/context rebuild — UnicodeText re-uploads when it changes. */
	texEpoch = 0;
	/** Set by a hovered interactive text block each frame; drives the hand cursor. */
	cursorWanted = false;
	/** The cursor currently applied to the canvas, so we only touch style on change. */
	cursorNow = "";
	addBatch;
	fxBatch;
	gridBatch;
	triBatch;
	/**
	* THE VECTOR LAYER — first-class line art (retained VectorShapes with
	* per-shape transforms, shatter(), deformable polylines, immediate
	* seg()/poly()): `game.vector.shape(points, { glow: 0.8 })`. Drawn in the
	* scene pass between the blend and grid batches; pair with bloom for the
	* full vector-monitor look. See skills/vector.md.
	*/
	vector;
	glowPass;
	_lights2d = null;
	/**
	* The 2D LIGHT layer — additive point/spot lights with hard shadows off
	* scenery (`lights2d.occluders`), colour mixing and flicker. Created on first
	* access (games that don't light pay nothing). Draw your scene, drop a dark
	* ambient overlay, then this adds the lights back. See skills/lights2d.md.
	*/
	get lights2d() {
		if (!this._lights2d) if (this.gpu) {
			this._lights2d = new Lights2d(this.gpu.device, this.gpu.format);
			this.gpu.onRebuild((device) => this._lights2d?.rebuild(device));
		} else this._lights2d = this.glr.createLights2d();
		return this._lights2d;
	}
	core3d = null;
	worldP = null;
	ssaoPass = null;
	raysPass = null;
	pendingSsao = null;
	pendingRays = null;
	hudBatch;
	/** `d.text()` glyphs for the HUD surface — flushed in the text slot, over panels. */
	hudTextBatch;
	world = null;
	postChain;
	backdrops;
	atlasView = null;
	msaaColor = null;
	worldDepth = null;
	worldDepthView = null;
	clock;
	stepFns = [];
	bg;
	worldHeight;
	debugOpts = null;
	debugOverlay = new DebugOverlay();
	roster;
	booted = false;
	drawLoading;
	/** Registered frames per url|frameW|frameH — loadFrames/framesOf are idempotent. */
	frameCache = /* @__PURE__ */ new Map();
	/** Baked bitmap fonts per font|charset — font() is idempotent (see below). */
	fontCache = /* @__PURE__ */ new Map();
	raf = 0;
	last = -1;
	textureReady = false;
	/** atlas.generation last uploaded to the GPU — re-upload when it falls behind. */
	uploadedGen = -1;
	depth = null;
	pixelArt = false;
	filter;
	/** The boot banner logs once per page, however many Games are constructed. */
	static bannerShown = false;
	running = false;
	destroyed = false;
	/** @internal Window listeners added at create() — held so destroy() removes them. */
	winListeners = [];
	/** @internal The rAF closure built by run(), re-scheduled by resume(). */
	tickFn = null;
	/** @internal Mute state of `sound` before pause() silenced it, so resume() restores the user's choice. */
	soundMutedBeforePause = false;
	/**
	* @internal Guards the one-shot `window.PhaserGameReady()` callback so it fires
	* exactly once — after the first real scene is built — and never again.
	*/
	_readyFired = false;
	/**
	* @internal Guards the one-shot `window.PhaserGamePlaying()` callback so it
	* fires exactly once — the first time the `'play'` scene is built.
	*/
	_playingFired = false;
	constructor(gpu, glr, opts) {
		this.gpu = gpu;
		this.glr = glr;
		this.renderer = gpu ? "webgpu" : "webgl";
		this.banner();
		this.canvas = gpu ? gpu.canvas : glr.ctx.canvas;
		this.worldHeight = opts.worldHeight ?? 768;
		this.bg = rgba(opts.background ?? "#0b0e1a");
		this.clock = new FixedClock(opts.fixedStep ?? 1 / 60);
		const blocky = opts.pixelArt === true;
		this.pixelArt = blocky;
		this.filter = "linear";
		const filter = this.filter;
		if (gpu) {
			this.cutoutBatch = new QuadBatch(gpu.device, gpu.format, {
				cutout: true,
				filter,
				blocky
			});
			this.blendBatch = new QuadBatch(gpu.device, gpu.format, {
				cutout: false,
				filter,
				blocky
			});
			this.msdf = new MsdfRenderer(gpu.device, gpu.format);
			this.msdfHud = new MsdfRenderer(gpu.device, gpu.format, 1024);
			this.ui = new UiRenderer(gpu.device, gpu.format);
			this.uiHud = new UiRenderer(gpu.device, gpu.format);
			this.addBatch = new QuadBatch(gpu.device, gpu.format, {
				cutout: false,
				blend: "add",
				filter,
				blocky
			});
			this.fxBatch = new FxBatch(gpu.device, gpu.format, { filter: opts.pixelArt ? "nearest" : "linear" });
			this.glowPass = new GlowPass(gpu.device, gpu.format);
			this.gridBatch = new GridBatch(gpu.device, gpu.format, {
				filter,
				blocky
			});
			this.vector = new VectorLayer(gpu.device, gpu.format);
			this.triBatch = new TriBatch(gpu.device, gpu.format);
			this.hudBatch = new QuadBatch(gpu.device, gpu.format, {
				cutout: false,
				depthTest: false,
				capacity: 4096,
				filter,
				blocky
			});
			this.textBatch = new QuadBatch(gpu.device, gpu.format, {
				cutout: false,
				depthTest: false,
				filter,
				blocky
			});
			this.hudTextBatch = new QuadBatch(gpu.device, gpu.format, {
				cutout: false,
				depthTest: false,
				capacity: 4096,
				filter,
				blocky
			});
			this.postChain = new PostChain(gpu.device, gpu.format);
			this.backdrops = new BackdropChain(gpu.device, gpu.format);
			this.sceneOrder = new DrawOrder();
			this.hudOrder = new DrawOrder();
		} else {
			const r = glr;
			this.cutoutBatch = r.cutoutBatch;
			this.blendBatch = r.blendBatch;
			this.msdf = r.msdf;
			this.msdfHud = r.msdfHud;
			this.ui = r.ui;
			this.uiHud = r.uiHud;
			this.addBatch = r.addBatch;
			this.fxBatch = r.fxBatch;
			this.glowPass = r.glowPass;
			this.gridBatch = r.gridBatch;
			this.vector = r.vector;
			this.triBatch = r.triBatch;
			this.hudBatch = r.hudBatch;
			this.textBatch = r.textBatch;
			this.hudTextBatch = r.hudTextBatch;
			this.postChain = r.postChain;
			this.backdrops = r.backdrops;
			this.sceneOrder = r.sceneOrder;
			this.hudOrder = r.hudOrder;
		}
		const wantCursor = () => {
			this.cursorWanted = true;
		};
		const pointer = () => {
			this.input.pointerTracker.attach();
			return this.input.ignoring ? null : this.input.pointer;
		};
		const worldPointer = () => {
			const p = pointer();
			return p ? {
				x: p.x,
				y: p.y,
				down: p.isDown,
				wantCursor,
				pressedAt: p.downTime,
				pressX: p.startX,
				pressY: p.startY
			} : null;
		};
		const hudPointer = () => {
			const p = pointer();
			if (!p) return null;
			const v = this.view;
			const toHudX = (wx) => (wx - v.x) / Math.max(1e-6, v.w) * this.hud.w;
			const toHudY = (wy) => (wy - v.y) / Math.max(1e-6, v.h) * this.hud.h;
			return {
				x: toHudX(p.x),
				y: toHudY(p.y),
				down: p.isDown,
				wantCursor,
				pressedAt: p.downTime,
				pressX: toHudX(p.startX),
				pressY: toHudY(p.startY)
			};
		};
		this.blendBatch.joinOrder(this.sceneOrder, 0);
		this.msdf.joinOrder(this.sceneOrder);
		this.ui.joinOrder(this.sceneOrder);
		this.textBatch.joinOrder(this.sceneOrder, 3);
		this.cutoutBatch.joinOrder(this.sceneOrder, 4);
		this.addBatch.joinOrder(this.sceneOrder, 5);
		this.triBatch.joinOrder(this.sceneOrder);
		this.gridBatch.joinOrder(this.sceneOrder);
		this.fxBatch.joinOrder(this.sceneOrder);
		this.hudBatch.joinOrder(this.hudOrder, 0);
		this.msdfHud.joinOrder(this.hudOrder);
		this.uiHud.joinOrder(this.hudOrder);
		this.hudTextBatch.joinOrder(this.hudOrder, 3);
		this.draw = new Draw(this.cutoutBatch, this.blendBatch, this.atlas, this.addBatch, this.fxBatch, this.glowPass, this.gridBatch, this.triBatch, this.msdf, worldPointer, this.ui, this.textBatch);
		this.hud = new Draw(this.hudBatch, this.hudBatch, this.atlas, this.hudBatch, null, null, null, null, this.msdfHud, hudPointer, this.uiHud, this.hudTextBatch);
		const mobile = typeof navigator !== "undefined" && /mobile|android|iphone|ipad|ipod/i.test(navigator.userAgent);
		const touchDevice = typeof window !== "undefined" && "ontouchstart" in window;
		this.input = new Input(this.canvas, touchDevice, mobile);
		this.sound = new Audio();
		this.tween = new Tween();
		let uiFont = null;
		const uiDeps = {
			input: () => this.input,
			bitmapFont: () => uiFont ?? (uiFont = this.assets.font({ font: "bold 20px system-ui, sans-serif" })),
			msdfText: (font, str, size, color, wrap, align, bold) => this.assets.msdfText(font, str, {
				fontSize: size,
				color,
				maxWidth: wrap,
				align,
				weight: bold ? .09 : 0
			}),
			unicodeText: (str, size, color, wrap, align, bold) => this.assets.unicodeText(str, {
				fontSize: size,
				color,
				maxWidth: wrap,
				align,
				fontWeight: bold ? 700 : 400
			})
		};
		this.draw.attachUi(uiDeps);
		this.hud.attachUi(uiDeps);
		this.screen = new Screen({
			canvas: this.canvas,
			sound: this.sound,
			isPixelArt: () => this.pixelArt,
			isRunning: () => this.running,
			isDestroyed: () => this.destroyed,
			markDirty: () => (this.gpu ?? this.glr).markDirty()
		});
		this.assets = new Assets({
			atlas: () => this.atlas,
			msdfTexture: (src, w, h) => this.gpu ? msdfTextureFrom(this.gpu.device, src, w, h).createView() : this.glr.msdfTexture(src),
			textTexture: (canvas) => {
				const forget = (v) => {
					this.msdf.release(v);
					this.msdfHud.release(v);
				};
				if (this.gpu) {
					const tex = textureFromCanvas(this.gpu.device, canvas, true);
					const view = tex.createView();
					return {
						view,
						destroy: () => {
							forget(view);
							tex.destroy();
						}
					};
				}
				const gl = this.glr;
				const tex = gl.textTexture(canvas);
				const view = tex;
				return {
					view,
					destroy: () => {
						forget(view);
						gl.deleteTexture(tex);
					}
				};
			},
			textureEpoch: () => this.texEpoch,
			registerDeform: (def) => this.gridBatch.register(def)
		});
		this.post = new PostLayer(() => this.postChain);
		this.backdrop = new BackdropLayer(() => this.backdrops);
		this.input.pointerTracker.mapToWorld = (clientX, clientY) => {
			const r = this.canvas.getBoundingClientRect();
			return {
				x: this.view.x + (clientX - r.left) / Math.max(1, r.width) * this.view.w,
				y: this.view.y + (clientY - r.top) / Math.max(1, r.height) * this.view.h
			};
		};
		this.roster = opts.scenes ?? null;
		this.drawLoading = opts.drawLoading;
		this.current = this.attach(new Scene());
		const view = this.view;
		view.h = this.worldHeight;
		view.w = this.worldHeight * ((this.canvas.width || window.innerWidth) / Math.max(1, this.canvas.height || window.innerHeight));
		if (gpu) gpu.onRebuild((device) => {
			this.cutoutBatch.rebuild(device);
			this.blendBatch.rebuild(device);
			this.msdf.rebuild(device);
			this.msdfHud.rebuild(device);
			this.ui.rebuild(device);
			this.uiHud.rebuild(device);
			this.texEpoch++;
			this.addBatch.rebuild(device);
			this.fxBatch.rebuild(device);
			this.gridBatch.rebuild(device);
			this.triBatch.rebuild(device);
			this.vector.rebuild(device);
			this.glowPass.rebuild(device);
			this.ssaoPass?.rebuild(device);
			this.raysPass?.rebuild(device);
			this.hudBatch.rebuild(device);
			this.textBatch.rebuild(device);
			this.hudTextBatch.rebuild(device);
			this.world?.rebuild(device);
			this.postChain.rebuild(device);
			this.backdrops.rebuild(device);
			this.depth = null;
			this.msaaColor = null;
			this.worldDepth = null;
			this.worldDepthView = null;
			this.textureReady = false;
		});
		if (glr) glr.onRebuild(() => {
			this.textureReady = false;
			this.texEpoch++;
		});
		if (typeof window !== "undefined") window.game = this;
	}
	/**
	* The boot banner — one console line with colour blocks, the engine name +
	* version, and a clickable homepage link (devtools auto-link bare URLs).
	* Logged once per page, no matter how many Games are constructed.
	*/
	banner() {
		if (Game.bannerShown || typeof console === "undefined") return;
		Game.bannerShown = true;
		console.log(`%c %c %c %c %c ${this.version} %c https://phaser.io`, "background: #ff47b6; padding: 2px 3px", "background: #9742f5; padding: 2px 3px", "background: #3d8bff; padding: 2px 3px", "background: #2bd9c6; padding: 2px 3px", "color: #ffffff; background: #0f1320; padding: 2px 8px", "color: #3d8bff");
	}
	/**
	* Boot the engine. WebGPU is tried first; where it's absent (or where
	* `window.PHASER_WEBGPU === false` / a `?webgl` URL param forces it, for
	* testing) the engine falls back to the WebGL2 backend — a separate, lazily
	* loaded render path with core feature parity (high-end effects are
	* WebGPU-only; see docs/webgl2-fallback-plan.md). Only when BOTH are absent
	* does this show an on-page message and reject.
	*/
	static async create(opts = {}) {
		const canvas = makeCanvas(opts.container);
		const onError = opts.overlay === false ? (m) => console.error(m) : installErrorOverlay();
		const forceGl = typeof window !== "undefined" && (window.PHASER_WEBGPU === false || typeof location !== "undefined" && /[?&]webgl(=|&|$)/.test(location.search));
		const gpu = forceGl ? null : await Gpu.init(canvas, { onError });
		let glr = null;
		if (!gpu) {
			glr = await (await import("./webgl-core.js")).GlRenderer.init(canvas, {
				onError,
				pixelArt: opts.pixelArt === true
			});
			if (glr) console.info(forceGl ? "Phaser AE: WebGL2 fallback forced (PHASER_WEBGPU=false / ?webgl)." : "Phaser AE: WebGPU unavailable — using the WebGL2 fallback renderer.");
		}
		if (!gpu && !glr) {
			const div = document.createElement("div");
			div.style.cssText = "position:fixed;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;font:16px monospace;text-align:center;padding:24px";
			div.textContent = "This game needs WebGPU or WebGL2 (any modern browser).";
			canvas.replaceWith(div);
			throw new Error("WebGPU and WebGL2 unavailable");
		}
		canvas.style.touchAction = "none";
		return new Game(gpu, glr, opts);
	}
	/**
	* Transition to the scene registered under `role` ('title', 'play',
	* 'gameOver', 'intro' or a custom key). The old scene — sprites, camera,
	* rules — is dropped whole; the new one is built via setup(data).
	* Built-in fallbacks cover 'title' and 'gameOver'.
	*/
	go(role, data) {
		this.transition(role, data).catch((err) => {
			console.error(`Scene transition to '${role}' failed:`, err);
			if (typeof document !== 'undefined') {
				let box = document.getElementById('trackcade-runtime-error');
				if (!box) {
					box = document.createElement('div');
					box.id = 'trackcade-runtime-error';
					box.style.cssText = 'position:fixed;inset:0;z-index:99999;background:#070a1ef2;color:#ff9aa9;padding:24px;font:14px/1.5 monospace;white-space:pre-wrap;overflow:auto';
					document.body.appendChild(box);
				}
				box.textContent = `Trackcade scene failed: ${role}\n\n${err && err.stack ? err.stack : String(err)}`;
			}
		});
	}
	/** @internal The actual goto flow — async so scene preload() can load assets. */
	async transition(role, data) {
		const DEFAULTS = {
			title: DefaultTitle,
			gameOver: DefaultGameOver
		};
		const Cls = this.roster?.[role] ?? DEFAULTS[role];
		if (!Cls) throw new Error(`No scene registered for role '${role}'`);
		this.current?._deactivate();
		this.input.reset();
		const scene = this.attach(new Cls());
		const load = new Preload(this.sound, (url) => this.loadModelDataVia(url));
		const custom = scene.preload(load);
		if (load.pending > 0) {
			const loader = this.attach(new LoadingScene());
			loader.progressFn = () => load.progress;
			loader.custom = this.drawLoading;
			this.current = loader;
			await Promise.all([
				load.all(),
				Promise.resolve(custom),
				new Promise((r) => setTimeout(r, 300))
			]);
		} else await Promise.all([load.all(), Promise.resolve(custom)]);
		await fontsSettled();
		this.fx.clear();
		await Promise.resolve(scene.setup(data));
		this.current?._deactivate();
		this.current = scene;
		scene._activate();
		this.input.ignoreFor(this.inputGrace);
		this.signalReady();
		this.signalPlaying(role);
	}
	/** Wire a scene to this game's services (size/view hooks + back-reference). */
	attach(scene) {
		scene.game = this;
		scene.frameSizer = (f) => this.assets.frameSize(f);
		scene.viewRect = () => this.view;
		return scene;
	}
	/**
	* Opt into the 3D layer: a perspective world (Y-UP) of boxes + billboard
	* sprites rendered UNDER the 2D layer and HUD. The 3D core ships as a
	* separate lazy chunk (world3d-core.js) — the first call loads it, so:
	* `const world = await game.world3d({ ... })` (one await in setup, the
	* physics pattern). Idempotent: later calls resolve to the same world.
	*/
	/**
	* SSAO (Lighting 2.0 tier 3) — screen-space ambient occlusion over the 3D
	* world: creases, contact points and corners darken naturally. Costs one
	* half-res estimate + blur per frame. `world.ssao(true)`,
	* `world.ssao({ radius, strength, power })` to tune, `false` to stop.
	* Requires a 3D world (it reads the world depth buffer).
	*/
	/** Project a 3D world point into the 2D LAYER's coordinates — draw a
	* label/health bar at the returned x/y with the normal 2D verbs and it
	* pins to the 3D object. null before the first frame or without a world;
	* check `.visible` before drawing (behind-the-camera points project). */
	project3d(x, y, z) {
		const p = this.world?.project(x, y, z);
		if (!p) return null;
		const r = this.canvas.getBoundingClientRect();
		const w = this.input.toWorld({
			clientX: r.left + p.x,
			clientY: r.top + p.y
		});
		return {
			x: w.x,
			y: w.y,
			depth: p.depth,
			visible: p.visible
		};
	}
	/**
	* @internal The engine side of `world.ssao()` — the passes are composited by
	* Game (they read the world depth buffer), so the world routes here through
	* the `_fx` hook installed in world3d().
	*/
	applySsao(on = true) {
		if (this.glr) {
			if (this.glWorld) this.glWorldFx()?.setSsao?.(on);
			else this.pendingSsao = on;
			return;
		}
		if (!this.ssaoPass) {
			this.pendingSsao = on;
			this.load3d();
			return;
		}
		if (on === false) {
			this.ssaoPass.enabled = false;
			return;
		}
		this.ssaoPass.enabled = true;
		if (typeof on === "object") Object.assign(this.ssaoPass.opts, on);
	}
	/** @internal The engine side of `world.rays()` — see {@link applySsao}. */
	applyRays(on = true) {
		if (this.glr) {
			if (this.glWorld) this.glWorldFx()?.setRays?.(on);
			else this.pendingRays = on;
			return;
		}
		if (!this.raysPass) {
			this.pendingRays = on;
			this.load3d();
			return;
		}
		if (on === false) {
			this.raysPass.enabled = false;
			return;
		}
		this.raysPass.enabled = true;
		if (typeof on === "object") Object.assign(this.raysPass.opts, on);
	}
	/**
	* @internal Give a freshly built world its `ssao()` / `rays()` — the passes
	* are owned and composited here (they read the world depth buffer), so the
	* world's public verbs route back through these appliers.
	*/
	attachWorldFx(world) {
		world._fx = {
			ssao: (on) => this.applySsao(on),
			rays: (on) => this.applyRays(on)
		};
	}
	/** @internal The GL world's optional depth-effect surface (ssao/rays). */
	glWorldFx() {
		return this.glWorld;
	}
	/** @internal One-shot warnings for WebGPU-only features hit on the fallback. */
	glWarned = /* @__PURE__ */ new Set();
	warnGlOnly(feature) {
		if (this.glWarned.has(feature)) return;
		this.glWarned.add(feature);
		console.warn(`Phaser AE: '${feature}' is WebGPU-only — ignored on the WebGL fallback renderer.`);
	}
	/** Load the 3D chunk once (idempotent) and stand up the ssao/rays passes. */
	load3d() {
		return this.core3d ??= import("./world3d-core.js").then((core) => {
			if (this.gpu) {
				this.ssaoPass = new core.SsaoPass(this.gpu.device, this.gpu.format);
				this.raysPass = new core.RaysPass(this.gpu.device, this.gpu.format);
				if (this.pendingSsao !== null) {
					this.applySsao(this.pendingSsao);
					this.pendingSsao = null;
				}
				if (this.pendingRays !== null) {
					this.applyRays(this.pendingRays);
					this.pendingRays = null;
				}
			}
			return core;
		});
	}
	/** @internal Model DATA loading for preload — rides the backend's own 3D
	*  chunk so the fallback never downloads the WebGPU 3D core. */
	loadModelDataVia(url) {
		if (this.glr) return import("./webgl3d-core.js").then((m) => m.loadModelData(url));
		return this.load3d().then((m) => m.loadModelData(url));
	}
	world3d(opts) {
		if (this.glr) return this.worldP ??= import("./webgl3d-core.js").then((m) => {
			this.glWorld = new m.GlWorld3d(this.glr, this.atlas, { ...opts });
			this.glWorld.canvasEl = this.canvas;
			this.glr.attachWorld(this.glWorld);
			if (this.pendingSsao !== null) {
				this.glWorldFx()?.setSsao?.(this.pendingSsao);
				this.pendingSsao = null;
			}
			if (this.pendingRays !== null) {
				this.glWorldFx()?.setRays?.(this.pendingRays);
				this.pendingRays = null;
			}
			this.world = this.glWorld;
			this.attachWorldFx(this.world);
			return this.world;
		});
		return this.worldP ??= this.load3d().then((core) => {
			const filter = this.pixelArt ? "nearest" : this.filter;
			this.world = new core.World3d(this.gpu.device, this.gpu.format, this.atlas, {
				filter,
				...opts
			});
			this.world.canvasEl = this.canvas;
			if (this.atlasView) this.world.setTexture(this.atlasView);
			this.attachWorldFx(this.world);
			return this.world;
		});
	}
	/** A world X at fraction f across this frame's view (0 = left edge, 1 = right). Camera-aware. */
	vw(f) {
		return this.view.x + f * this.view.w;
	}
	/** A world Y at fraction f down this frame's view (0 = top edge, 1 = bottom). Camera-aware. */
	vh(f) {
		return this.view.y + f * this.view.h;
	}
	/** Run `fn` at the fixed simulation step (see FixedClock) — physics/sims go here, not in the frame callback. */
	onStep(fn) {
		this.stepFns.push(fn);
	}
	/**
	* Start the frame loop. Each frame: fixed-step callbacks → scene update →
	* scene draw → your `frame` callback (drawn ON TOP of the scene) → render.
	*/
	run(frame) {
		this.stop();
		if (this.destroyed) return;
		this.last = -1;
		if (this.roster && !this.booted) {
			this.booted = true;
			this.go(this.roster["intro"] ? "intro" : this.roster["title"] ? "title" : "play");
		} else if (!this.roster && !this.booted) {
			this.booted = true;
			this.current._activate();
			this.signalReady();
			this.signalPlaying("play");
		}
		const tick = (now) => {
			if (!this.running || this.destroyed) return;
			this.raf = requestAnimationFrame(tick);
			const dt = this.last < 0 ? 0 : Math.min(.05, (now - this.last) / 1e3);
			this.last = now;
			this.time += dt;
			const surface = this.gpu ?? this.glr;
			surface.fit();
			if (surface.dead) return;
			if (this.atlas.dirty || this.atlas.generation !== this.uploadedGen || !this.textureReady) this.uploadAtlas();
			const view = this.view;
			view.h = this.worldHeight;
			view.w = this.worldHeight * (this.canvas.width / Math.max(1, this.canvas.height));
			const steps = this.clock.advance(dt);
			for (let s = 0; s < steps; s++) for (const fn of this.stepFns) fn(this.clock.step);
			this.tween.update(dt);
			this.input.tickGrace(dt);
			const scene = this.current;
			scene.update(dt);
			this.world?.physics?.update(dt);
			this.fx.update(dt);
			this.vector.update(dt);
			const camera = scene.camera;
			const z = camera.zoom > 0 ? camera.zoom : 1;
			view.w /= z;
			view.h /= z;
			camera.update(dt, view.w, view.h);
			view.x = camera.x + camera.shakeX;
			view.y = camera.y + camera.shakeY;
			const hudW = this.canvas.clientWidth || (typeof window !== "undefined" ? window.innerWidth : 0) || this.canvas.width;
			const hudH = this.canvas.clientHeight || (typeof window !== "undefined" ? window.innerHeight : 0) || this.canvas.height;
			this.draw.traceText = this.hud.traceText = !!this.debugOpts?.textBounds;
			this.cursorWanted = false;
			this.draw.begin(view.x, view.y, view.w, view.h, this.time);
			const fbW = this.canvas.width, fbH = this.canvas.height;
			this.sceneOrder.begin();
			this.hudOrder.begin();
			this.msdf.begin(view.x, view.y, view.w, view.h, fbW / Math.max(1, view.w), fbW, fbH);
			this.msdfHud.begin(0, 0, hudW, hudH, fbW / Math.max(1, hudW), fbW, fbH);
			this.ui.begin(view.x, view.y, view.w, view.h, fbW, fbH);
			this.uiHud.begin(0, 0, hudW, hudH, fbW, fbH);
			this.triBatch.begin(view.x, view.y, view.w, view.h);
			this.vector.begin(view.x, view.y, view.w, view.h);
			this._lights2d?.begin(view.x, view.y, view.w, view.h, this.time);
			this.hud.begin(0, 0, hudW, hudH, this.time);
			scene.draw(this.draw);
			this.fx.draw(this.draw);
			frame?.(this.draw, dt, this.time);
			this.world?.tick(dt);
			scene.drawHud(this.hud);
			this.draw.flushUiOverlays();
			this.hud.flushUiOverlays();
			if (this.debugOpts) this.debugOverlay.draw(this.draw, this.hud, scene, this.debugOpts, {
				dt,
				view,
				particles: this.fx.count,
				counts3d: this.world?.counts ?? null,
				font: () => this.assets.font({ font: "13px monospace" })
			});
			const cursor = this.cursorWanted ? "pointer" : "";
			if (cursor !== this.cursorNow) {
				this.cursorNow = cursor;
				this.canvas.style.cursor = cursor;
			}
			const flash = scene.camera.flashRGBA;
			if (flash) this.hudBatch.push(0, 0, hudW, hudH, this.atlas.frames[0], 3, 0, 0, 0, flash[0], flash[1], flash[2], flash[3]);
			if (this.backdrops.active) this.backdrops.frame(this.canvas.width, this.canvas.height, this.time, view);
			if (this.glr) this.glr.renderFrame({
				width: this.canvas.width,
				height: this.canvas.height,
				bg: this.bg,
				time: this.time,
				world: this.glWorld,
				hudAboveFx: this.hudAboveFx
			});
			else this.renderFrameWebGpu(view, dt);
			if (this.screen._shotPending) this.screen._drainShot();
			this.input.clearPressed();
		};
		this.tickFn = tick;
		this.running = true;
		this.raf = requestAnimationFrame(tick);
	}
	/** @internal The WebGPU render tail — every encoder/pass of one frame.
	*  Extracted verbatim from the run loop so the WebGL branch stays a single
	*  call; only ever invoked on the WebGPU backend. */
	renderFrameWebGpu(view, dt) {
		const gpu = this.gpu;
		const device = gpu.device;
		const encoder = device.createCommandEncoder();
		const [r, g, b, a] = this.bg;
		const target = gpu.context.getCurrentTexture().createView();
		const depthView = this.ensureDepth().createView();
		const post = this.postChain.active;
		const sceneView = post ? this.postChain.sceneView(this.canvas.width, this.canvas.height) : target;
		const hudInScene = !post || !this.hudAboveFx;
		if (this.world) {
			const msaa = this.world.sampleCount > 1;
			const clear = {
				r: r * a,
				g: g * a,
				b: b * a,
				a
			};
			const worldDepth = this.ensureWorldDepth();
			const worldDepthView = this.worldDepthView;
			const aspect = this.canvas.width / Math.max(1, this.canvas.height);
			this.world.prepare(encoder, aspect, dt, worldDepth, this.canvas.width, this.canvas.height);
			const passA = encoder.beginRenderPass({
				colorAttachments: [msaa ? {
					view: this.ensureMsaa().color.createView(),
					clearValue: clear,
					loadOp: "clear",
					storeOp: "store"
				} : {
					view: sceneView,
					clearValue: clear,
					loadOp: "clear",
					storeOp: "store"
				}],
				depthStencilAttachment: {
					view: worldDepthView,
					depthClearValue: 1,
					depthLoadOp: "clear",
					depthStoreOp: "store"
				}
			});
			this.backdrops.draw(passA, msaa ? this.world.sampleCount : 1);
			this.world.renderOpaque(passA);
			passA.end();
			const passB = encoder.beginRenderPass({
				colorAttachments: [msaa ? {
					view: this.ensureMsaa().color.createView(),
					resolveTarget: sceneView,
					loadOp: "load",
					storeOp: "discard"
				} : {
					view: sceneView,
					loadOp: "load",
					storeOp: "store"
				}],
				depthStencilAttachment: {
					view: worldDepthView,
					depthReadOnly: true
				}
			});
			this.world.renderTranslucent(passB);
			passB.end();
			const pi = this.world.projInfo;
			if (this.ssaoPass?.enabled && pi) this.ssaoPass.render(encoder, worldDepth, pi.proj, pi.projA, pi.projB, this.canvas.width, this.canvas.height);
			this.world.renderUnderwaterShafts(encoder, worldDepth, this.canvas.width, this.canvas.height);
			if (this.raysPass?.enabled) {
				let sun = this.world.sunScreen;
				const uw = this.world.underwater3d;
				const under = uw && uw.active && !uw.dead ? uw.fullUnder : 0;
				if (sun && under > 0) sun = {
					...sun,
					intensity: sun.intensity * (1 - under)
				};
				if (sun && under < 1) this.raysPass.render(encoder, worldDepth, sun, this.canvas.width, this.canvas.height);
			}
		}
		this.vector.prepare();
		if (this.vector.glowSize > 0) this.glowPass.wake(this.vector.glowSize);
		if (this.glowPass.active) this.glowPass.render(encoder, this.canvas.width, this.canvas.height, (p) => this.vector.stampGlow(p, Math.max(1, this.canvas.width >> 1), Math.max(1, this.canvas.height >> 1)));
		const pass = encoder.beginRenderPass({
			colorAttachments: [{
				view: sceneView,
				clearValue: {
					r: r * a,
					g: g * a,
					b: b * a,
					a
				},
				loadOp: this.world ? "load" : "clear",
				storeOp: "store"
			}],
			depthStencilAttachment: {
				view: depthView,
				depthClearValue: 1,
				depthLoadOp: "clear",
				depthStoreOp: "discard"
			}
		});
		if (!this.world) this.backdrops.draw(pass, 1);
		if (this.world) this.ssaoPass?.composite(pass);
		if (this.world && this.worldDepth) this.world.compositeUnderwater(pass, this.worldDepth);
		if (this.world) this.raysPass?.composite(pass);
		this.glowPass.composite(pass);
		this._lights2d?.draw(pass, "under");
		this.walkSurface(pass, this.sceneOrder, this.sceneSrcs());
		this.vector.draw(pass, this.canvas.width, this.canvas.height);
		this._lights2d?.draw(pass, "over");
		if (hudInScene) this.walkSurface(pass, this.hudOrder, this.hudSrcs());
		pass.end();
		if (post) {
			this.postChain.run(encoder, target, this.time);
			if (!hudInScene) {
				const hudPass = encoder.beginRenderPass({
					colorAttachments: [{
						view: target,
						loadOp: "load",
						storeOp: "store"
					}],
					depthStencilAttachment: {
						view: depthView,
						depthClearValue: 1,
						depthLoadOp: "clear",
						depthStoreOp: "discard"
					}
				});
				this.walkSurface(hudPass, this.hudOrder, this.hudSrcs());
				hudPass.end();
			}
		}
		device.queue.submit([encoder.finish()]);
		this.world?.afterSubmit();
	}
	/** Stop the frame loop (run() restarts it). */
	/**
	* Draw one surface's UI stack, layer by layer.
	*
	* Panels, bitmap labels and MSDF text are three batches because they are three
	* shaders — but they are ONE stack, so they advance together. Walking layers
	* in step is what lets a window (see `Ui.window`) sit wholly above the window
	* below it: its panels cover the other's panels AND its text, with no stencil
	* and no separate surface.
	*
	* Layer 0 is the frame's ordinary UI, so the common case is one pass of the
	* loop and exactly the three draws it always was.
	*/
	/**
	* Replay one surface's 2D content in the order the game drew it.
	*
	* Quads, text and panels are three shaders and can never share a batch, so the
	* frame breaks the batch and swaps pipeline wherever the game alternated. That
	* costs draw calls, deliberately: `d.panel(...)` then `d.text(...)` means the
	* text is ON the panel, and no ordering rule beats writing what you meant.
	*
	* LAYERS are the one thing call order cannot express — "this dialog is above
	* everything already on screen". Each layer is walked in full before the next,
	* so a modal covers the screen below it, text and furniture together.
	*/
	walkSurface(pass, order, srcs) {
		for (let n = 0; n <= order.maxLayer; n++) for (const seg of order.segs) {
			if (seg.layer !== n) continue;
			srcs[seg.src]?.drawRange(pass, seg.first, seg.n);
		}
	}
	/** The surface's passes, indexed by SRC id — the walk's dispatch table. */
	sceneSrcs() {
		return [
			this.blendBatch,
			this.msdf,
			this.ui,
			this.textBatch,
			this.cutoutBatch,
			this.addBatch,
			this.triBatch,
			this.gridBatch,
			this.fxBatch
		];
	}
	hudSrcs() {
		return [
			this.hudBatch,
			this.msdfHud,
			this.uiHud,
			this.hudTextBatch,
			this.hudBatch,
			this.hudBatch,
			null,
			null,
			null
		];
	}
	stop() {
		this.running = false;
		if (this.raf) cancelAnimationFrame(this.raf);
		this.raf = 0;
	}
	/** `true` while the loop is frozen by `pause()` (booted, not yet destroyed). */
	get paused() {
		return this.booted && !this.running && !this.destroyed;
	}
	/** `true` once `destroy()` has run — the instance is permanently inert. */
	get isDestroyed() {
		return this.destroyed;
	}
	/**
	* Freeze the run loop — updates and rendering stop, the last frame stays on
	* screen — and silence all sound (muted, not stopped: music holds its place).
	* Idempotent; no-op after `destroy()`. Called by the host page's pause control.
	*/
	pause() {
		if (!this.running || this.destroyed) return;
		this.running = false;
		if (this.raf) {
			cancelAnimationFrame(this.raf);
			this.raf = 0;
		}
		this.soundMutedBeforePause = this.sound.muted;
		this.sound.mute(true);
	}
	/**
	* Restart the run loop after `pause()` and restore sound to its pre-pause mute
	* state. The first delta is clamped (last = -1) so time never jumps across the
	* gap. Idempotent; no-op after `destroy()` or before the first `run()`.
	*/
	resume() {
		if (this.running || this.destroyed || !this.tickFn) return;
		this.running = true;
		this.last = -1;
		this.sound.mute(this.soundMutedBeforePause);
		this.raf = requestAnimationFrame(this.tickFn);
	}
	/**
	* Permanently stop the game: cancel the loop, tear down input / audio / tween,
	* and release resources. After this every method is a no-op. Idempotent.
	*/
	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.running = false;
		this.stop();
		this.screen._destroy();
		for (const [type, fn] of this.winListeners) window.removeEventListener(type, fn);
		this.winListeners = [];
		this.current?._deactivate();
		this.input.destroy();
		this.sound.destroy();
		this.tween.destroy();
		this.msaaColor?.destroy();
		this.msaaColor = null;
		this.worldDepth?.destroy();
		this.worldDepth = null;
		this.worldDepthView = null;
		this.depth?.destroy();
		this.depth = null;
		this.gpu?.destroy();
		this.glr?.destroy();
		clearAssetCaches();
	}
	/**
	* @internal Fire the global `window.PhaserGameReady()` callback once, the first
	* time a real scene finishes building. The engine drives this automatically —
	* the host page hooks it to learn the game has booted and put something on
	* screen. The `_readyFired` guard makes it strictly one-shot.
	*/
	signalReady() {
		if (this._readyFired) return;
		this._readyFired = true;
		if (typeof window === "undefined") return;
		const cb = window.PhaserGameReady;
		if (typeof cb === "function") try {
			cb();
		} catch (err) {
			console.error("window.PhaserGameReady() threw:", err);
		}
	}
	/**
	* @internal Fire the global `window.PhaserGamePlaying()` callback once, the
	* first time the `'play'` scene — the main gameplay screen, past any
	* title/menu — finishes building. The host page hooks it to screenshot the
	* game in motion rather than its title. The `_playingFired` guard makes it
	* strictly one-shot (replaying the level never re-fires it).
	*/
	signalPlaying(role) {
		if (this._playingFired || role !== "play") return;
		this._playingFired = true;
		if (typeof window === "undefined") return;
		const cb = window.PhaserGamePlaying;
		if (typeof cb === "function") try {
			cb();
		} catch (err) {
			console.error("window.PhaserGamePlaying() threw:", err);
		}
	}
	ensureMsaa() {
		const { width, height } = this.canvas;
		const count = this.world?.sampleCount ?? 4;
		if (!this.msaaColor || this.msaaColor.width !== width || this.msaaColor.height !== height) {
			this.msaaColor?.destroy();
			this.msaaColor = this.gpu.device.createTexture({
				size: {
					width,
					height
				},
				format: this.gpu.format,
				sampleCount: count,
				usage: 16
			});
		}
		return { color: this.msaaColor };
	}
	/** The 3D passes' dedicated depth — SAMPLEABLE (soft particles, compute
	* collision) and persistent across frames (stored, never discarded), at
	* the world's sample count. Separate from the 2D layer's depth, which is
	* cleared by the scene pass every frame. */
	ensureWorldDepth() {
		const { width, height } = this.canvas;
		const count = this.world?.sampleCount ?? 4;
		if (!this.worldDepth || this.worldDepth.width !== width || this.worldDepth.height !== height) {
			this.worldDepth?.destroy();
			this.worldDepth = this.gpu.device.createTexture({
				size: {
					width,
					height
				},
				format: DEPTH_FORMAT,
				sampleCount: count,
				usage: 20
			});
			this.worldDepthView = this.worldDepth.createView();
		}
		return this.worldDepth;
	}
	ensureDepth() {
		const { width, height } = this.canvas;
		if (!this.depth || this.depth.width !== width || this.depth.height !== height) {
			this.depth?.destroy();
			this.depth = this.gpu.device.createTexture({
				size: {
					width,
					height
				},
				format: DEPTH_FORMAT,
				usage: 16
			});
		}
		return this.depth;
	}
	uploadAtlas() {
		if (this.atlas.dirty || !this.atlas.canvas) this.atlas.build();
		if (this.glr) {
			this.glr.uploadAtlas(this.atlas.canvas);
			this.uploadedGen = this.atlas.generation;
			this.textureReady = true;
			return;
		}
		const view = textureFromCanvas(this.gpu.device, this.atlas.canvas).createView();
		this.atlasView = view;
		this.cutoutBatch.setTexture(view);
		this.blendBatch.setTexture(view);
		this.addBatch.setTexture(view);
		this.fxBatch.setTexture(view);
		this.gridBatch.setTexture(view);
		this.glowPass.setTexture(view);
		this.hudBatch.setTexture(view);
		this.textBatch.setTexture(view);
		this.hudTextBatch.setTexture(view);
		this.world?.setTexture(view);
		this.uploadedGen = this.atlas.generation;
		this.textureReady = true;
	}
};
function makeCanvas(container) {
	const canvas = document.createElement("canvas");
	const host = typeof container === "string" ? document.querySelector(container) : container ?? null;
	if (host) {
		canvas.style.cssText = "display:block;width:100%;height:100%";
		host.appendChild(canvas);
	} else {
		canvas.style.cssText = "position:fixed;inset:0;width:100vw;height:100vh;display:block";
		document.body.appendChild(canvas);
	}
	return canvas;
}
//#endregion
//#region src/lib/tilemap.ts
/**
* A rendered tile layer attached to a scene. Tile index `1` maps to the first tile in the tileset strip; `0` = empty (not drawn).
* Supports parallax scrolling (`distance`), seamless wrapping (`repeat`), and per-tile frame animations.
* Synonym: tile layer, tilemap layer, background layer, parallax layer.
*/
var Tilemap = class extends TileGrid {
	/**
	* Atlas frame index of tile 1 — register the tileset strip with
	* `game.assets.frames(canvas, tileSize)` / `game.assets.loadFrames(url, tileSize)` and pass
	* the returned index. Tile index N draws atlas frame `firstFrame + N - 1`.
	*/
	firstFrame;
	/**
	* Parallax distance factor. `1` = scrolls 1:1 with the camera (default, foreground).
	* Values `> 1` scroll slower (distant background); values `< 1` scroll faster (close foreground).
	* Synonym: parallax, depth, scroll speed.
	*/
	distance = 1;
	/**
	* When `true` the layer tiles seamlessly in both axes. Use for looping backgrounds and infinite ground layers.
	* Default `false`.
	*/
	repeat = false;
	/**
	* When `true` this layer is drawn after all sprites (in front). Default `false` (drawn behind sprites).
	* Use for foreground detail tiles that overlap the player (cave ceilings, archways).
	*/
	foreground = false;
	/** When `false` the layer is skipped entirely during draw. Default `true`. */
	enabled = true;
	/**
	* Per-tile animation map — key is tile index − 1 (0-based, matching raster),
	* value is the `TileAnim` played in place of that tile.
	*/
	animations = {};
	/** @internal The shared animation clock, advanced by `update(dt)` (Scene calls it). */
	animT = 0;
	constructor(tilesize, data, firstFrame = 0) {
		super(tilesize, data);
		this.firstFrame = firstFrame;
	}
	/** Advance the per-tile animations. Called by `Scene.update()` each frame. */
	update(dt) {
		this.animT += dt;
	}
	/**
	* Pushes every visible non-zero tile as one batch instance for the given view rect
	* (world units — the scene passes `viewRect()`), applying `distance` parallax and
	* `repeat` wrapping. Called automatically by `Scene.draw`; call manually only if
	* compositing layers yourself.
	*/
	draw(d, view) {
		if (!this.enabled) return;
		const scrollX = view.x / this.distance;
		const scrollY = view.y / this.distance;
		let tile = 0;
		let anim;
		const tileOffsetX = toInt(scrollX / this.tilesize);
		const tileOffsetY = toInt(scrollY / this.tilesize);
		const pxOffsetX = scrollX % this.tilesize;
		const pxOffsetY = scrollY % this.tilesize;
		const pxMinX = -pxOffsetX - this.tilesize;
		const pxMinY = -pxOffsetY - this.tilesize;
		const pxMaxX = view.w + this.tilesize - pxOffsetX;
		const pxMaxY = view.h + this.tilesize - pxOffsetY;
		for (let mapY = -1, pxY = pxMinY; pxY < pxMaxY; mapY++, pxY += this.tilesize) {
			let tileY = mapY + tileOffsetY;
			if (tileY >= this.height || tileY < 0) {
				if (!this.repeat) continue;
				tileY = (tileY % this.height + this.height) % this.height;
			}
			for (let mapX = -1, pxX = pxMinX; pxX < pxMaxX; mapX++, pxX += this.tilesize) {
				let tileX = mapX + tileOffsetX;
				if (tileX >= this.width || tileX < 0) {
					if (!this.repeat) continue;
					tileX = (tileX % this.width + this.width) % this.width;
				}
				if (tile = this.data[tileY][tileX]) {
					let frame = this.firstFrame + tile - 1;
					if (anim = this.animations[tile - 1]) {
						const idx = Math.floor(this.animT / anim.time) % anim.seq.length;
						frame = this.firstFrame + anim.seq[idx];
					}
					d.sprite(frame, view.x + pxX, view.y + pxY, {
						w: this.tilesize,
						h: this.tilesize
					});
				}
			}
		}
	}
};
//#endregion
//#region src/lib/maze.ts
/**
* Standalone 2D maze generator + game-query toolkit — pure CPU math, zero
* engine dependency. Import it directly (`import { Maze } from '../engine/webgpu.js'`);
* it is NOT wired into `Game` or any scene.
*
* A maze is a `cols × rows` grid of cells; every cell tracks which of its four
* sides (N/E/S/W) still carry a wall as a 4-bit mask. Ten classic algorithms
* carve that grid — each with its own visual "texture" (winding vs. bushy vs.
* roomy) — then optional post-passes braid in loops (multiple routes), stamp
* open rooms, and punch border exits.
*
* The result feeds either engine dimension:
*   • `maze.tiles()` → a `(2·cols+1) × (2·rows+1)` 0/1 grid for THICK walls
*     (Rogue/dungeon style: one tile per wall cell) — drop into a `Tilemap`,
*     `CollisionGrid`, or a wall-per-solid-cell 3D build.
*   • `maze.walls()` → thin edge segments (puzzle-book style) for line drawing.
*
* Plus the queries a game actually needs: `canMove()`, `cellAt()`,
* `directionToExit()`, `path()`, `distanceField()`, `deadEnds()`.
*/
var N = 0;
var E = 1;
var S = 2;
var W = 3;
/** Column delta for each `Dir`, indexed `[N, E, S, W]`. */
var DX = [
	0,
	1,
	0,
	-1
];
/** Row delta for each `Dir`, indexed `[N, E, S, W]`. */
var DY = [
	-1,
	0,
	1,
	0
];
/** Wall-mask bit for each `Dir` (N=1, E=2, S=4, W=8). */
var BIT = [
	1,
	2,
	4,
	8
];
/** The opposite `Dir` of each `Dir` (N↔S, E↔W). */
var OPP = [
	S,
	W,
	N,
	E
];
/** Human-readable name → `Dir`, for the `exits` side spec. */
var SIDE = {
	N,
	E,
	S,
	W
};
/**
* A generated 2D maze: the wall grid plus the geometry exporters and gameplay
* queries a game needs. Construct once (generation runs in the constructor);
* the instance is then immutable data you read from every frame.
*
* ```ts
* const maze = new Maze({ cols: 20, rows: 15, algorithm: 'prim', seed: 'level-1', braid: 0.3 });
* const grid = maze.tiles();                 // thick walls → CollisionGrid / Tilemap
* if (maze.canMove(c, r, E)) c++;            // gameplay movement test
* const dir = maze.directionToExit(c, r);    // hint arrow toward nearest exit
* ```
*/
var Maze = class {
	/** North direction index (row − 1). */ static N = N;
	/** East direction index (col + 1). */ static E = E;
	/** South direction index (row + 1). */ static S = S;
	/** West direction index (col − 1). */ static W = W;
	/** Grid width in cells. */
	cols;
	/** Grid height in cells. */
	rows;
	/** Algorithm used to carve this maze. */
	algorithm;
	/** The numeric seed actually used (after hashing a string seed). */
	seed;
	/** Per-cell wall bitmask, row-major (`cells[row * cols + col]`). A set bit
	*  means the wall is PRESENT: N=1, E=2, S=4, W=8. `@internal`-ish — prefer
	*  {@link wall} / {@link canMove}, but exposed for custom exporters. */
	cells;
	/** The resolved border exits (entrances and exits are interchangeable). */
	exits = [];
	/** The open rooms that were stamped (empty when `rooms` was not requested). */
	rooms = [];
	/** Cached BFS distance-to-nearest-exit field; built lazily by {@link exitField}. */
	_exitField = null;
	constructor(opts) {
		this.cols = Math.max(1, Math.floor(opts.cols));
		this.rows = Math.max(1, Math.floor(opts.rows));
		this.algorithm = opts.algorithm ?? "backtracker";
		this.seed = typeof opts.seed === "string" ? hashCode(opts.seed) : opts.seed ?? Math.random() * 4294967295 >>> 0;
		const rng = makeRng(this.seed);
		const n = this.cols * this.rows;
		this.cells = new Uint8Array(n).fill(this.algorithm === "recursive-division" ? 0 : 15);
		this._generate(rng);
		this._sealBorder();
		if (opts.rooms != null) this._carveRooms(typeof opts.rooms === "number" ? { count: opts.rooms } : opts.rooms, rng);
		if (opts.braid) this._braid(opts.braid, rng);
		this._punchExits(opts.exits ?? 2, rng);
	}
	/** Row-major cell index for `(col, row)`. No bounds check. */
	index(col, row) {
		return row * this.cols + col;
	}
	/** Is `(col, row)` inside the grid? */
	inBounds(col, row) {
		return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
	}
	/** Is there a wall on the `dir` side of cell `(col, row)`? Out-of-bounds cells
	*  read as fully walled. */
	wall(col, row, dir) {
		if (!this.inBounds(col, row)) return true;
		return (this.cells[this.index(col, row)] & BIT[dir]) !== 0;
	}
	/**
	* Can an actor in cell `(col, row)` step in `dir`? True when no wall blocks
	* that side. Stepping through a border opening (an {@link Exit}) counts as a
	* move that LEAVES the maze, so this returns true there too — check
	* {@link inBounds} on the target if you need to distinguish "exited".
	*/
	canMove(col, row, dir) {
		return !this.wall(col, row, dir);
	}
	/** The cell reached by stepping `dir` from `(col, row)` (may be out of bounds). */
	step(col, row, dir) {
		return {
			col: col + DX[dir],
			row: row + DY[dir]
		};
	}
	/** Open (wall-free) in-bounds neighbours of `(col, row)`, each with the `dir`
	*  taken to reach it. */
	neighbours(col, row) {
		const out = [];
		for (let d = 0; d < 4; d++) {
			const c = col + DX[d], r = row + DY[d];
			if (this.inBounds(c, r) && !this.wall(col, row, d)) out.push({
				col: c,
				row: r,
				dir: d
			});
		}
		return out;
	}
	/**
	* Which cell contains pixel/world position `(x, y)`? Maps by the thin-wall
	* layout where one cell spans `cellSize` units from `(originX, originY)`.
	* Returns `null` when the point is outside the grid. (For a THICK
	* {@link tiles} render, cell `(c, r)` is tile `(2c+1, 2r+1)`.)
	*/
	cellAt(x, y, cellSize = 1, originX = 0, originY = 0) {
		const col = Math.floor((x - originX) / cellSize);
		const row = Math.floor((y - originY) / cellSize);
		return this.inBounds(col, row) ? {
			col,
			row
		} : null;
	}
	/**
	* Expand to a THICK 0/1 wall grid of size `(2·cols+1) × (2·rows+1)`,
	* row-major (`grid[y][x]`). Cell centres and open passages become floor;
	* walls and the pillars between them stay solid. Feed straight into a
	* `Tilemap` / `CollisionGrid`, or place one wall box per solid tile for a
	* Rogue-style 3D dungeon. Exits appear as gaps punched in the outer ring.
	*/
	tiles(opts = {}) {
		const wall = opts.wall ?? 1;
		const open = opts.open ?? 0;
		const w = this.cols * 2 + 1;
		const h = this.rows * 2 + 1;
		const grid = Array.from({ length: h }, () => new Array(w).fill(wall));
		for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
			const tx = c * 2 + 1, ty = r * 2 + 1;
			grid[ty][tx] = open;
			if (!this.wall(c, r, E)) grid[ty][tx + 1] = open;
			if (!this.wall(c, r, S)) grid[ty + 1][tx] = open;
			if (!this.wall(c, r, N)) grid[ty - 1][tx] = open;
			if (!this.wall(c, r, W)) grid[ty][tx - 1] = open;
		}
		return grid;
	}
	/**
	* The maze as THIN wall segments in cell units (`0…cols` × `0…rows`) — the
	* puzzle-book look. Each internal edge appears once; border edges are
	* included except where an exit opens. Draw each as a line
	* (`d.line(x1*scale, y1*scale, x2*scale, y2*scale, ...)`).
	*/
	walls() {
		const segs = [];
		for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
			if (this.wall(c, r, N)) segs.push({
				x1: c,
				y1: r,
				x2: c + 1,
				y2: r
			});
			if (this.wall(c, r, W)) segs.push({
				x1: c,
				y1: r,
				x2: c,
				y2: r + 1
			});
			if (r === this.rows - 1 && this.wall(c, r, S)) segs.push({
				x1: c,
				y1: r + 1,
				x2: c + 1,
				y2: r + 1
			});
			if (c === this.cols - 1 && this.wall(c, r, E)) segs.push({
				x1: c + 1,
				y1: r,
				x2: c + 1,
				y2: r + 1
			});
		}
		return segs;
	}
	/**
	* BFS distance (in cells, through open passages) from every cell to the
	* NEAREST of `targets`, as a row-major `Int32Array`. Unreachable cells are
	* `-1`. Cheap to reuse: compute one field toward a goal, then read a
	* direction from any cell in O(1) with {@link directionTo}.
	*/
	distanceField(targets) {
		const n = this.cols * this.rows;
		const dist = new Int32Array(n).fill(-1);
		let frontier = [];
		for (const t of targets) if (this.inBounds(t.col, t.row)) {
			const i = this.index(t.col, t.row);
			if (dist[i] === -1) {
				dist[i] = 0;
				frontier.push(i);
			}
		}
		while (frontier.length) {
			const next = [];
			for (const i of frontier) {
				const col = i % this.cols, row = i / this.cols | 0;
				for (let d = 0; d < 4; d++) {
					if (this.wall(col, row, d)) continue;
					const c = col + DX[d], r = row + DY[d];
					if (!this.inBounds(c, r)) continue;
					const j = this.index(c, r);
					if (dist[j] === -1) {
						dist[j] = dist[i] + 1;
						next.push(j);
					}
				}
			}
			frontier = next;
		}
		return dist;
	}
	/**
	* Shortest path from `from` to `to` as an inclusive list of cells (`[from …
	* to]`), or `[]` when unreachable. For repeated queries toward one goal,
	* build a {@link distanceField} once and step it with {@link directionTo}.
	*/
	path(from, to) {
		if (!this.inBounds(from.col, from.row) || !this.inBounds(to.col, to.row)) return [];
		const dist = this.distanceField([to]);
		if (dist[this.index(from.col, from.row)] === -1) return [];
		const out = [];
		let col = from.col, row = from.row;
		out.push({
			col,
			row
		});
		while (!(col === to.col && row === to.row)) {
			const here = dist[this.index(col, row)];
			let moved = false;
			for (let d = 0; d < 4; d++) {
				if (this.wall(col, row, d)) continue;
				const c = col + DX[d], r = row + DY[d];
				if (this.inBounds(c, r) && dist[this.index(c, r)] === here - 1) {
					col = c;
					row = r;
					out.push({
						col,
						row
					});
					moved = true;
					break;
				}
			}
			if (!moved) return [];
		}
		return out;
	}
	/**
	* The first `Dir` to step from `(col, row)` to get closer to a goal, or `-1`
	* if there's nowhere better to go. Pass a precomputed {@link distanceField}
	* to reuse it across cells/frames; pass a single `Cell` for a one-off.
	*/
	directionTo(col, row, goal) {
		const dist = goal instanceof Int32Array ? goal : this.distanceField([goal]);
		const here = dist[this.index(col, row)];
		if (here <= 0) return -1;
		for (let d = 0; d < 4; d++) {
			if (this.wall(col, row, d)) continue;
			const c = col + DX[d], r = row + DY[d];
			if (this.inBounds(c, r) && dist[this.index(c, r)] === here - 1) return d;
		}
		return -1;
	}
	/** The distance-to-nearest-exit field (built once, then cached). `-1` where
	*  no exit is reachable, or everywhere when the maze has no exits. */
	exitField() {
		if (!this._exitField) this._exitField = this.exits.length ? this.distanceField(this.exits.map((e) => ({
			col: e.col,
			row: e.row
		}))) : new Int32Array(this.cols * this.rows).fill(-1);
		return this._exitField;
	}
	/** The `Dir` to step from `(col, row)` toward the nearest {@link Exit}, or
	*  `-1` if already at an exit / none is reachable. */
	directionToExit(col, row) {
		return this.directionTo(col, row, this.exitField());
	}
	/** Every dead-end cell (exactly one open side). Handy for placing treasure,
	*  keys, or spawn points. */
	deadEnds() {
		const out = [];
		for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this._openCount(c, r) === 1) out.push({
			col: c,
			row: r
		});
		return out;
	}
	/** A compact ASCII rendering (`#` walls, space floor) — for tests and
	*  console debugging. */
	toString() {
		return this.tiles().map((row) => row.map((t) => t ? "#" : " ").join("")).join("\n");
	}
	/** Remove the wall between adjacent cells `(col,row)` and its `dir` neighbour
	*  (clears the bit on BOTH cells). */
	_carve(col, row, dir) {
		this.cells[this.index(col, row)] &= ~BIT[dir];
		const c = col + DX[dir], r = row + DY[dir];
		if (this.inBounds(c, r)) this.cells[this.index(c, r)] &= ~BIT[OPP[dir]];
	}
	/** Add the wall between `(col,row)` and its `dir` neighbour (sets both bits). */
	_addWall(col, row, dir) {
		this.cells[this.index(col, row)] |= BIT[dir];
		const c = col + DX[dir], r = row + DY[dir];
		if (this.inBounds(c, r)) this.cells[this.index(c, r)] |= BIT[OPP[dir]];
	}
	/** Count of open (wall-free) sides of a cell. */
	_openCount(col, row) {
		const m = this.cells[this.index(col, row)];
		return (m & 1 ? 0 : 1) + (m & 2 ? 0 : 1) + (m & 4 ? 0 : 1) + (m & 8 ? 0 : 1);
	}
	/** Fisher–Yates shuffle in place using the maze rng. */
	_shuffle(arr, rng) {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = Math.floor(rng() * (i + 1));
			[arr[i], arr[j]] = [arr[j], arr[i]];
		}
		return arr;
	}
	_generate(rng) {
		switch (this.algorithm) {
			case "prim": return this._prim(rng);
			case "kruskal": return this._kruskal(rng);
			case "wilson": return this._wilson(rng);
			case "aldous-broder": return this._aldousBroder(rng);
			case "hunt-and-kill": return this._huntAndKill(rng);
			case "eller": return this._eller(rng);
			case "recursive-division": return this._division(rng);
			case "binary-tree": return this._binaryTree(rng);
			case "sidewinder": return this._sidewinder(rng);
			default: return this._backtracker(rng);
		}
	}
	/** Recursive backtracker (randomised DFS) — long winding corridors. */
	_backtracker(rng) {
		const visited = new Uint8Array(this.cols * this.rows);
		const stack = [{
			col: rng() * this.cols | 0,
			row: rng() * this.rows | 0
		}];
		visited[this.index(stack[0].col, stack[0].row)] = 1;
		while (stack.length) {
			const { col, row } = stack[stack.length - 1];
			const dirs = this._shuffle([
				N,
				E,
				S,
				W
			], rng).filter((d) => {
				const c = col + DX[d], r = row + DY[d];
				return this.inBounds(c, r) && !visited[this.index(c, r)];
			});
			if (!dirs.length) {
				stack.pop();
				continue;
			}
			const d = dirs[0];
			this._carve(col, row, d);
			const c = col + DX[d], r = row + DY[d];
			visited[this.index(c, r)] = 1;
			stack.push({
				col: c,
				row: r
			});
		}
	}
	/** Randomised Prim's — bushy, many short branches. */
	_prim(rng) {
		const visited = new Uint8Array(this.cols * this.rows);
		const frontier = [];
		const seed = {
			col: rng() * this.cols | 0,
			row: rng() * this.rows | 0
		};
		visited[this.index(seed.col, seed.row)] = 1;
		const addEdges = (col, row) => {
			for (let d = 0; d < 4; d++) {
				const c = col + DX[d], r = row + DY[d];
				if (this.inBounds(c, r) && !visited[this.index(c, r)]) frontier.push([
					col,
					row,
					d
				]);
			}
		};
		addEdges(seed.col, seed.row);
		while (frontier.length) {
			const k = rng() * frontier.length | 0;
			const [col, row, d] = frontier[k];
			frontier[k] = frontier[frontier.length - 1];
			frontier.pop();
			const c = col + DX[d], r = row + DY[d];
			if (visited[this.index(c, r)]) continue;
			this._carve(col, row, d);
			visited[this.index(c, r)] = 1;
			addEdges(c, r);
		}
	}
	/** Randomised Kruskal's — uniform texture, many junctions (union-find). */
	_kruskal(rng) {
		const parent = new Int32Array(this.cols * this.rows).map((_, i) => i);
		const find = (x) => {
			while (parent[x] !== x) {
				parent[x] = parent[parent[x]];
				x = parent[x];
			}
			return x;
		};
		const edges = [];
		for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
			if (c + 1 < this.cols) edges.push([
				c,
				r,
				E
			]);
			if (r + 1 < this.rows) edges.push([
				c,
				r,
				S
			]);
		}
		this._shuffle(edges, rng);
		for (const [c, r, d] of edges) {
			const a = find(this.index(c, r));
			const b = find(this.index(c + DX[d], r + DY[d]));
			if (a !== b) {
				parent[a] = b;
				this._carve(c, r, d);
			}
		}
	}
	/** Wilson's — loop-erased random walks → an unbiased uniform spanning tree. */
	_wilson(rng) {
		const n = this.cols * this.rows;
		const inMaze = new Uint8Array(n);
		const order = [];
		for (let i = 0; i < n; i++) order.push(i);
		this._shuffle(order, rng);
		inMaze[order[0]] = 1;
		for (const startIdx of order) {
			if (inMaze[startIdx]) continue;
			const dirOut = new Int32Array(n).fill(-1);
			let col = startIdx % this.cols, row = startIdx / this.cols | 0;
			while (!inMaze[this.index(col, row)]) {
				const dirs = [
					N,
					E,
					S,
					W
				].filter((d) => this.inBounds(col + DX[d], row + DY[d]));
				const d = dirs[rng() * dirs.length | 0];
				dirOut[this.index(col, row)] = d;
				col += DX[d];
				row += DY[d];
			}
			col = startIdx % this.cols;
			row = startIdx / this.cols | 0;
			while (!inMaze[this.index(col, row)]) {
				const d = dirOut[this.index(col, row)];
				inMaze[this.index(col, row)] = 1;
				this._carve(col, row, d);
				col += DX[d];
				row += DY[d];
			}
		}
	}
	/** Aldous–Broder — random walk, carve on first visit. Uniform but slow. */
	_aldousBroder(rng) {
		const n = this.cols * this.rows;
		const visited = new Uint8Array(n);
		let col = rng() * this.cols | 0, row = rng() * this.rows | 0;
		visited[this.index(col, row)] = 1;
		let remaining = n - 1;
		while (remaining > 0) {
			const dirs = [
				N,
				E,
				S,
				W
			].filter((d) => this.inBounds(col + DX[d], row + DY[d]));
			const d = dirs[rng() * dirs.length | 0];
			const c = col + DX[d], r = row + DY[d];
			if (!visited[this.index(c, r)]) {
				this._carve(col, row, d);
				visited[this.index(c, r)] = 1;
				remaining--;
			}
			col = c;
			row = r;
		}
	}
	/** Hunt-and-kill — walk-carve then scan for the next unvisited neighbour. */
	_huntAndKill(rng) {
		const visited = new Uint8Array(this.cols * this.rows);
		let col = rng() * this.cols | 0, row = rng() * this.rows | 0;
		visited[this.index(col, row)] = 1;
		for (;;) {
			const dirs = this._shuffle([
				N,
				E,
				S,
				W
			], rng).filter((d) => {
				const c = col + DX[d], r = row + DY[d];
				return this.inBounds(c, r) && !visited[this.index(c, r)];
			});
			if (dirs.length) {
				const d = dirs[0];
				this._carve(col, row, d);
				col += DX[d];
				row += DY[d];
				visited[this.index(col, row)] = 1;
				continue;
			}
			let found = false;
			for (let r = 0; r < this.rows && !found; r++) for (let c = 0; c < this.cols && !found; c++) {
				if (visited[this.index(c, r)]) continue;
				const vis = [
					N,
					E,
					S,
					W
				].filter((d) => {
					const nc = c + DX[d], nr = r + DY[d];
					return this.inBounds(nc, nr) && visited[this.index(nc, nr)];
				});
				if (vis.length) {
					const d = vis[rng() * vis.length | 0];
					this._carve(c, r, d);
					visited[this.index(c, r)] = 1;
					col = c;
					row = r;
					found = true;
				}
			}
			if (!found) break;
		}
	}
	/** Eller's — row-at-a-time set merging, constant memory. */
	_eller(rng) {
		let setOf = new Int32Array(this.cols);
		let nextSet = 1;
		for (let c = 0; c < this.cols; c++) setOf[c] = nextSet++;
		for (let r = 0; r < this.rows; r++) {
			for (let c = 0; c < this.cols - 1; c++) {
				const last = r === this.rows - 1;
				if (setOf[c] !== setOf[c + 1] && (last || rng() < .5)) {
					this._carve(c, r, E);
					const merge = setOf[c + 1], keep = setOf[c];
					for (let k = 0; k < this.cols; k++) if (setOf[k] === merge) setOf[k] = keep;
				}
			}
			if (r === this.rows - 1) break;
			const nextRow = new Int32Array(this.cols).fill(0);
			const bySet = /* @__PURE__ */ new Map();
			for (let c = 0; c < this.cols; c++) (bySet.get(setOf[c]) ?? bySet.set(setOf[c], []).get(setOf[c])).push(c);
			for (const cols of bySet.values()) {
				this._shuffle(cols, rng);
				const drops = 1 + (rng() * cols.length | 0);
				for (let i = 0; i < cols.length; i++) if (i < drops) {
					this._carve(cols[i], r, S);
					nextRow[cols[i]] = setOf[cols[i]];
				}
			}
			const carried = setOf;
			setOf = new Int32Array(this.cols);
			for (let c = 0; c < this.cols; c++) setOf[c] = nextRow[c] ? carried[c] : nextSet++;
		}
	}
	/** Recursive division — add walls with one gap, recurse each side (roomy). */
	_division(rng) {
		const divide = (x0, y0, w, h) => {
			if (w < 2 && h < 2) return;
			if (w < h ? true : h < w ? false : rng() < .5) {
				const wy = y0 + (rng() * (h - 1) | 0);
				const gap = x0 + (rng() * w | 0);
				for (let c = x0; c < x0 + w; c++) if (c !== gap) this._addWall(c, wy, S);
				divide(x0, y0, w, wy - y0 + 1);
				divide(x0, wy + 1, w, h - (wy - y0 + 1));
			} else {
				const wx = x0 + (rng() * (w - 1) | 0);
				const gap = y0 + (rng() * h | 0);
				for (let r = y0; r < y0 + h; r++) if (r !== gap) this._addWall(wx, r, E);
				divide(x0, y0, wx - x0 + 1, h);
				divide(wx + 1, y0, w - (wx - x0 + 1), h);
			}
		};
		divide(0, 0, this.cols, this.rows);
	}
	/** Binary tree — each cell carves N or E. Trivial, strong diagonal bias. */
	_binaryTree(rng) {
		for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
			const canN = r > 0, canE = c < this.cols - 1;
			if (canN && canE) this._carve(c, r, rng() < .5 ? N : E);
			else if (canN) this._carve(c, r, N);
			else if (canE) this._carve(c, r, E);
		}
	}
	/** Sidewinder — horizontal runs closed off with one upward carve each. */
	_sidewinder(rng) {
		for (let r = 0; r < this.rows; r++) {
			let runStart = 0;
			for (let c = 0; c < this.cols; c++) {
				const atEast = c === this.cols - 1;
				if (r > 0 && (atEast || rng() < .5)) {
					const pick = runStart + (rng() * (c - runStart + 1) | 0);
					this._carve(pick, r, N);
					runStart = c + 1;
				} else if (!atEast) this._carve(c, r, E);
			}
		}
	}
	/** Force the outer border walls closed (division + trivial algos leave gaps). */
	_sealBorder() {
		for (let c = 0; c < this.cols; c++) {
			this.cells[this.index(c, 0)] |= BIT[N];
			this.cells[this.index(c, this.rows - 1)] |= BIT[S];
		}
		for (let r = 0; r < this.rows; r++) {
			this.cells[this.index(0, r)] |= BIT[W];
			this.cells[this.index(this.cols - 1, r)] |= BIT[E];
		}
	}
	/** Stamp open rectangular rooms — removing internal walls only, so the maze
	*  stays fully connected (rooms just add openness). */
	_carveRooms(opts, rng) {
		const count = Math.max(0, opts.count ?? 3);
		const min = Math.max(2, opts.minSize ?? 2);
		const max = Math.max(min, opts.maxSize ?? 4);
		for (let i = 0; i < count; i++) {
			const rw = Math.min(this.cols - 2, min + (rng() * (max - min + 1) | 0));
			const rh = Math.min(this.rows - 2, min + (rng() * (max - min + 1) | 0));
			if (rw < 1 || rh < 1) continue;
			const col = 1 + (rng() * (this.cols - rw - 1) | 0);
			const row = 1 + (rng() * (this.rows - rh - 1) | 0);
			for (let r = row; r < row + rh; r++) for (let c = col; c < col + rw; c++) {
				if (c + 1 < col + rw) this._carve(c, r, E);
				if (r + 1 < row + rh) this._carve(c, r, S);
			}
			this.rooms.push({
				col,
				row,
				w: rw,
				h: rh
			});
		}
	}
	/** Braid: open a fraction of dead-ends into loops (multiple routes). */
	_braid(amount, rng) {
		const ends = this.deadEnds();
		this._shuffle(ends, rng);
		const target = Math.round(ends.length * Math.min(1, Math.max(0, amount)));
		for (let i = 0; i < target; i++) {
			const { col, row } = ends[i];
			if (this._openCount(col, row) !== 1) continue;
			const walled = [
				N,
				E,
				S,
				W
			].filter((d) => {
				const c = col + DX[d], r = row + DY[d];
				return this.inBounds(c, r) && this.wall(col, row, d);
			});
			if (!walled.length) continue;
			const best = walled.filter((d) => this._openCount(col + DX[d], row + DY[d]) === 1);
			const d = (best.length ? best : walled)[rng() * (best.length ? best.length : walled.length) | 0];
			this._carve(col, row, d);
		}
		this._exitField = null;
	}
	/** Punch the requested border exits, filling {@link exits}. */
	_punchExits(spec, rng) {
		const specs = [];
		if (Array.isArray(spec)) specs.push(...spec);
		else {
			const n = Math.max(0, Math.floor(spec));
			const sides = n === 2 ? ["N", "S"] : [
				"N",
				"S",
				"E",
				"W"
			];
			for (let i = 0; i < n; i++) specs.push({ side: sides[i % sides.length] });
		}
		for (const es of specs) {
			const dir = SIDE[es.side];
			let col, row;
			if (dir === N || dir === S) {
				col = es.at ?? rng() * this.cols | 0;
				row = dir === N ? 0 : this.rows - 1;
			} else {
				row = es.at ?? rng() * this.rows | 0;
				col = dir === W ? 0 : this.cols - 1;
			}
			col = Math.max(0, Math.min(this.cols - 1, col));
			row = Math.max(0, Math.min(this.rows - 1, row));
			this.cells[this.index(col, row)] &= ~BIT[dir];
			this.exits.push({
				col,
				row,
				dir
			});
		}
		this._exitField = null;
	}
};
//#endregion
//#region src/lib/flowgrid.ts
var DX8 = [
	1,
	1,
	0,
	-1,
	-1,
	-1,
	0,
	1
];
var DY8 = [
	0,
	1,
	1,
	1,
	0,
	-1,
	-1,
	-1
];
var SQRT2 = Math.SQRT2;
var DCOST = DX8.map((_, d) => d & 1 ? SQRT2 : 1);
var UVX = DX8.map((x, d) => x / (d & 1 ? SQRT2 : 1));
var UVY = DY8.map((y, d) => y / (d & 1 ? SQRT2 : 1));
/**
* A mutable grid carrying a flow field toward one or more goals. Build it, set
* goals + obstacles, then read `steer()` / `flowVec()` / `distance()` every
* frame. Edits (block, weight, goals) mark the field dirty; it rebuilds itself
* on the next query — call {@link update} up front if you want the cost paid at
* a known time.
*
* ```ts
* const grid = new FlowGrid({ cols: 40, rows: 30, goals: [{ col: 39, row: 15 }], spawns: [{ col: 0, row: 15 }] });
* if (grid.canBuild(c, r)) grid.build(c, r);          // place a tower
* enemy.vel = scale(grid.steer(enemy.x, enemy.y, TILE), speed);  // follow the flow
* ```
*/
var FlowGrid = class {
	/** Grid width in cells. */
	cols;
	/** Grid height in cells. */
	rows;
	/** Whether diagonal movement is allowed. */
	diagonal;
	/** Whether diagonal moves may cut blocked corners. */
	cutCorners;
	/** The current goal cells (flow points toward the nearest). */
	goals;
	/** The current spawn cells (used by {@link canBuild}). */
	spawns;
	/** `1` where a cell is blocked (tower/wall), else `0`. Row-major. */
	blocked;
	/** Per-cell entry cost (terrain weight); `1` is normal, higher is slower. */
	weight;
	/** Integration field: distance to the nearest goal per cell, `Infinity` when
	*  unreachable. Row-major. Rebuilt by {@link update}. `@internal`-ish —
	*  prefer {@link distance}. */
	dist;
	/** Flow field: the {@link FlowDir} each cell steps toward its goal. */
	flow;
	_dirty = true;
	constructor(opts) {
		this.cols = Math.max(1, Math.floor(opts.cols));
		this.rows = Math.max(1, Math.floor(opts.rows));
		this.diagonal = opts.diagonal ?? true;
		this.cutCorners = opts.cutCorners ?? false;
		this.goals = (opts.goals ?? []).map((g) => ({
			col: g.col,
			row: g.row
		}));
		this.spawns = (opts.spawns ?? []).map((s) => ({
			col: s.col,
			row: s.row
		}));
		const n = this.cols * this.rows;
		this.blocked = new Uint8Array(n);
		this.weight = new Float32Array(n).fill(1);
		this.dist = new Float32Array(n).fill(Infinity);
		this.flow = new Int8Array(n).fill(-1);
	}
	/** Row-major cell index for `(col, row)`. No bounds check. */
	index(col, row) {
		return row * this.cols + col;
	}
	/** Is `(col, row)` inside the grid? */
	inBounds(col, row) {
		return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
	}
	/** Which cell contains world/pixel position `(x, y)`, at `cellSize` units per
	*  cell from `(originX, originY)`. `null` when outside the grid. */
	cellAt(x, y, cellSize = 1, originX = 0, originY = 0) {
		const col = Math.floor((x - originX) / cellSize);
		const row = Math.floor((y - originY) / cellSize);
		return this.inBounds(col, row) ? {
			col,
			row
		} : null;
	}
	/** Is the cell an obstacle (tower/wall)? Out-of-bounds reads as blocked. */
	isBlocked(col, row) {
		return !this.inBounds(col, row) || this.blocked[this.index(col, row)] === 1;
	}
	/** Block or unblock a cell (place/remove a tower or wall). */
	setBlocked(col, row, on) {
		if (!this.inBounds(col, row)) return;
		const v = on ? 1 : 0;
		if (this.blocked[this.index(col, row)] !== v) {
			this.blocked[this.index(col, row)] = v;
			this._dirty = true;
		}
	}
	/** Place a tower/wall at `(col, row)` (alias for `setBlocked(…, true)`). */
	build(col, row) {
		this.setBlocked(col, row, true);
	}
	/** Remove a tower/wall at `(col, row)` (alias for `setBlocked(…, false)`). */
	unbuild(col, row) {
		this.setBlocked(col, row, false);
	}
	/** Clear every obstacle. */
	clearBlocked() {
		this.blocked.fill(0);
		this._dirty = true;
	}
	/** Set a cell's terrain entry cost (`1` normal; `>1` slow mud; `<1` fast
	*  road). Cells stay passable; block with {@link setBlocked} instead. */
	setWeight(col, row, w) {
		if (!this.inBounds(col, row)) return;
		this.weight[this.index(col, row)] = Math.max(1e-4, w);
		this._dirty = true;
	}
	/** Replace the goal cells and mark the field dirty. */
	setGoals(goals) {
		this.goals = goals.map((g) => ({
			col: g.col,
			row: g.row
		}));
		this._dirty = true;
	}
	/** Replace the spawn cells (used only by {@link canBuild}). */
	setSpawns(spawns) {
		this.spawns = spawns.map((s) => ({
			col: s.col,
			row: s.row
		}));
	}
	/**
	* Rebuild the integration + flow fields (Dijkstra from all goals). Called
	* automatically by the queries when the grid is dirty; call it yourself to
	* pay the cost at a controlled time. Orthogonal steps cost `weight`,
	* diagonal steps `weight · √2`.
	*/
	update() {
		this.cols * this.rows;
		this.dist.fill(Infinity);
		this.flow.fill(-1);
		const heapId = [];
		const heapKey = [];
		const push = (id, k) => {
			heapId.push(id);
			heapKey.push(k);
			let i = heapId.length - 1;
			while (i > 0) {
				const p = i - 1 >> 1;
				if (heapKey[p] <= heapKey[i]) break;
				[heapKey[p], heapKey[i]] = [heapKey[i], heapKey[p]];
				[heapId[p], heapId[i]] = [heapId[i], heapId[p]];
				i = p;
			}
		};
		const pop = () => {
			const top = heapId[0], last = heapId.length - 1;
			heapId[0] = heapId[last];
			heapKey[0] = heapKey[last];
			heapId.pop();
			heapKey.pop();
			let i = 0;
			const len = heapId.length;
			for (;;) {
				const l = i * 2 + 1, r = l + 1;
				let m = i;
				if (l < len && heapKey[l] < heapKey[m]) m = l;
				if (r < len && heapKey[r] < heapKey[m]) m = r;
				if (m === i) break;
				[heapKey[m], heapKey[i]] = [heapKey[i], heapKey[m]];
				[heapId[m], heapId[i]] = [heapId[i], heapId[m]];
				i = m;
			}
			return top;
		};
		const dirCount = this.diagonal ? 8 : 4;
		const dstep = this.diagonal ? 1 : 2;
		for (const g of this.goals) if (this.inBounds(g.col, g.row) && this.blocked[this.index(g.col, g.row)] === 0) {
			const i = this.index(g.col, g.row);
			if (this.dist[i] !== 0) {
				this.dist[i] = 0;
				push(i, 0);
			}
		}
		while (heapId.length) {
			const i = pop();
			const col = i % this.cols, row = i / this.cols | 0;
			const base = this.dist[i];
			for (let s = 0; s < dirCount; s++) {
				const d = this.diagonal ? s : s * dstep;
				if (!this._canStep(col, row, d)) continue;
				const c = col + DX8[d], r = row + DY8[d], j = this.index(c, r);
				const nd = base + DCOST[d] * this.weight[j];
				if (nd < this.dist[j]) {
					this.dist[j] = nd;
					push(j, nd);
				}
			}
		}
		for (let row = 0; row < this.rows; row++) for (let col = 0; col < this.cols; col++) {
			const i = this.index(col, row);
			if (this.dist[i] === Infinity || this.dist[i] === 0) continue;
			let best = -1, bestDist = this.dist[i];
			for (let s = 0; s < dirCount; s++) {
				const d = this.diagonal ? s : s * dstep;
				if (!this._canStep(col, row, d)) continue;
				const nd = this.dist[this.index(col + DX8[d], row + DY8[d])];
				if (nd < bestDist) {
					bestDist = nd;
					best = d;
				}
			}
			this.flow[i] = best;
		}
		this._dirty = false;
	}
	/** @internal Can we step direction `d` from `(col,row)` — target in-bounds &
	*  passable, and (for diagonals, unless cutCorners) both orthogonal sides open. */
	_canStep(col, row, d) {
		const c = col + DX8[d], r = row + DY8[d];
		if (!this.inBounds(c, r) || this.blocked[this.index(c, r)] === 1) return false;
		if (d & 1 && !this.cutCorners) {
			if (this.isBlocked(col + DX8[d], row) || this.isBlocked(col, row + DY8[d])) return false;
		}
		return true;
	}
	_ensure() {
		if (this._dirty) this.update();
	}
	/** Distance (field cost) from `(col, row)` to the nearest goal, or
	*  `Infinity` if blocked/unreachable. */
	distance(col, row) {
		this._ensure();
		return this.inBounds(col, row) ? this.dist[this.index(col, row)] : Infinity;
	}
	/** Can an enemy at `(col, row)` reach a goal? */
	reachable(col, row) {
		return this.distance(col, row) !== Infinity;
	}
	/** The {@link FlowDir} `(col, row)` flows toward its goal (`-1` at a goal /
	*  blocked / unreachable cell). */
	flowDir(col, row) {
		this._ensure();
		return this.inBounds(col, row) ? this.flow[this.index(col, row)] : -1;
	}
	/** The unit flow VECTOR at cell `(col, row)` — the direction to move, as a
	*  `{x, y}` (zero when there's no flow). */
	flowVec(col, row) {
		const d = this.flowDir(col, row);
		return d === -1 ? {
			x: 0,
			y: 0
		} : {
			x: UVX[d],
			y: UVY[d]
		};
	}
	/**
	* The smooth steering direction for an enemy at world position `(x, y)` —
	* bilinearly interpolates the flow arrows of the four surrounding cells so
	* units off the cell centre don't jerk between headings. Returns a
	* unit-length `{x, y}` (zero at the goal / in a dead pocket). `cellSize` +
	* `origin` map world units to the grid (same convention as {@link cellAt}).
	*/
	steer(x, y, cellSize = 1, originX = 0, originY = 0) {
		this._ensure();
		const fx = (x - originX) / cellSize - .5;
		const fy = (y - originY) / cellSize - .5;
		const c0 = Math.floor(fx), r0 = Math.floor(fy);
		const tx = fx - c0, ty = fy - r0;
		let vx = 0, vy = 0;
		const add = (c, r, wgt) => {
			if (wgt <= 0 || !this.inBounds(c, r)) return;
			const d = this.flow[this.index(c, r)];
			if (d === -1) return;
			vx += UVX[d] * wgt;
			vy += UVY[d] * wgt;
		};
		add(c0, r0, (1 - tx) * (1 - ty));
		add(c0 + 1, r0, tx * (1 - ty));
		add(c0, r0 + 1, (1 - tx) * ty);
		add(c0 + 1, r0 + 1, tx * ty);
		const len = Math.hypot(vx, vy);
		if (len > 1e-4) return {
			x: vx / len,
			y: vy / len
		};
		return this.flowVec(Math.round(fx), Math.round(fy));
	}
	/**
	* Would blocking `(col, row)` still leave EVERY spawn able to reach a goal?
	* The tower-placement guard: returns `false` for a build that would fully
	* wall a spawn off (or that isn't a legal, currently-open cell). Runs a
	* connectivity check with the same movement rules — it does not mutate the
	* grid.
	*/
	canBuild(col, row) {
		if (!this.inBounds(col, row) || this.blocked[this.index(col, row)] === 1) return false;
		const at = (list) => list.some((p) => p.col === col && p.row === row);
		if (at(this.goals) || at(this.spawns)) return false;
		if (this.spawns.length === 0) return true;
		const bi = this.index(col, row);
		this.blocked[bi] = 1;
		const seen = new Uint8Array(this.cols * this.rows);
		let frontier = [];
		for (const g of this.goals) if (this.inBounds(g.col, g.row) && this.blocked[this.index(g.col, g.row)] === 0) {
			const gi = this.index(g.col, g.row);
			if (!seen[gi]) {
				seen[gi] = 1;
				frontier.push(gi);
			}
		}
		const dirCount = this.diagonal ? 8 : 4;
		const dstep = this.diagonal ? 1 : 2;
		while (frontier.length) {
			const next = [];
			for (const i of frontier) {
				const c = i % this.cols, r = i / this.cols | 0;
				for (let s = 0; s < dirCount; s++) {
					const d = this.diagonal ? s : s * dstep;
					if (!this._canStep(c, r, d)) continue;
					const j = this.index(c + DX8[d], r + DY8[d]);
					if (!seen[j]) {
						seen[j] = 1;
						next.push(j);
					}
				}
			}
			frontier = next;
		}
		this.blocked[bi] = 0;
		return this.spawns.every((s) => this.inBounds(s.col, s.row) && seen[this.index(s.col, s.row)] === 1);
	}
	/**
	* Trace the route from `(col, row)` by following the flow field to a goal —
	* an inclusive list of cells, for drawing a preview path or a debug overlay.
	* Empty when unreachable; capped so a broken field can't loop forever.
	*/
	path(from, maxSteps = this.cols * this.rows) {
		this._ensure();
		if (!this.reachable(from.col, from.row)) return [];
		const out = [{
			col: from.col,
			row: from.row
		}];
		let col = from.col, row = from.row;
		for (let i = 0; i < maxSteps; i++) {
			const d = this.flow[this.index(col, row)];
			if (d === -1) break;
			col += DX8[d];
			row += DY8[d];
			out.push({
				col,
				row
			});
		}
		return out;
	}
};
//#endregion
//#region src/lib/path.ts
var TWO_PI = Math.PI * 2;
function resolveEase(ease) {
	if (ease === void 0) return null;
	if (typeof ease === "function") return ease;
	const fn = standardEasingFunctions[ease];
	if (!fn) throw new Error(`Unknown path ease "${ease}" — use one of ${Object.keys(standardEasingFunctions).join(", ")}, or pass a function.`);
	return fn;
}
/**
* A 2D path: curve segments chained into one constant-speed route, baked once.
*
* ```ts
* const swoop = new Path({
*   start: [400, 40],
*   segments: [
*     { cubic: [[300, 40], [220, 200], [120, 200]], ease: 'easeOutQuad' },
*     { wave: { to: [-20, 120], amplitude: 18, cycles: 2 } },
*   ],
* });
* const p = swoop.getPoint(0.5);          // halfway ALONG the route (by distance)
* sprite.x = p.x; sprite.y = p.y;
* sprite.rot = swoop.getAngle(0.5);       // facing its direction of travel
* ```
*
* `getPoint(t)` is O(log samples) — a binary search over the baked table — so
* hundreds of followers per frame are cheap.
*/
var Path = class Path {
	/** Total geometric length of the path, in pixels. */
	length;
	segments;
	pathEase;
	constructor(data, options = {}) {
		if (!data || !Array.isArray(data.start) || !Array.isArray(data.segments) || data.segments.length === 0) throw new Error("Path data needs a `start: [x, y]` and at least one entry in `segments`.");
		const samples = Math.max(8, Math.floor(options.samplesPerSegment ?? 48));
		const fx = options.flipX;
		const fy = options.flipY;
		const ox = options.offset?.[0] ?? 0;
		const oy = options.offset?.[1] ?? 0;
		const tx = (x) => (fx !== void 0 ? fx * 2 - x : x) + ox;
		const ty = (y) => (fy !== void 0 ? fy * 2 - y : y) + oy;
		const flipSweep = (fx !== void 0 ? -1 : 1) * (fy !== void 0 ? -1 : 1);
		this.pathEase = resolveEase(data.ease);
		this.segments = [];
		let cx = tx(data.start[0]);
		let cy = ty(data.start[1]);
		for (const seg of data.segments) {
			const startX = cx;
			const startY = cy;
			let curve;
			if (seg.line) {
				const ex = tx(seg.line[0]);
				const ey = ty(seg.line[1]);
				curve = (t) => ({
					x: startX + (ex - startX) * t,
					y: startY + (ey - startY) * t
				});
			} else if (seg.quad) {
				const c1x = tx(seg.quad[0][0]), c1y = ty(seg.quad[0][1]);
				const ex = tx(seg.quad[1][0]), ey = ty(seg.quad[1][1]);
				curve = (t) => {
					const u = 1 - t;
					return {
						x: u * u * startX + 2 * u * t * c1x + t * t * ex,
						y: u * u * startY + 2 * u * t * c1y + t * t * ey
					};
				};
			} else if (seg.cubic) {
				const c1x = tx(seg.cubic[0][0]), c1y = ty(seg.cubic[0][1]);
				const c2x = tx(seg.cubic[1][0]), c2y = ty(seg.cubic[1][1]);
				const ex = tx(seg.cubic[2][0]), ey = ty(seg.cubic[2][1]);
				curve = (t) => {
					const u = 1 - t;
					return {
						x: u * u * u * startX + 3 * u * u * t * c1x + 3 * u * t * t * c2x + t * t * t * ex,
						y: u * u * u * startY + 3 * u * u * t * c1y + 3 * u * t * t * c2y + t * t * t * ey
					};
				};
			} else if (seg.arc) {
				const ax = tx(seg.arc.center[0]);
				const ay = ty(seg.arc.center[1]);
				const rx = Math.hypot(startX - ax, startY - ay) || 1e-4;
				const ry = seg.arc.ry ?? rx;
				const a0 = Math.atan2((startY - ay) * (rx / ry), startX - ax);
				const sweep = (seg.arc.to * Math.PI / 180 - a0) * flipSweep;
				curve = (t) => ({
					x: ax + Math.cos(a0 + sweep * t) * rx,
					y: ay + Math.sin(a0 + sweep * t) * ry
				});
			} else if (seg.spiral) {
				const ax = tx(seg.spiral.center[0]);
				const ay = ty(seg.spiral.center[1]);
				const r0 = Math.hypot(startX - ax, startY - ay) || 1e-4;
				const r1 = Math.max(1e-4, seg.spiral.endRadius);
				const a0 = Math.atan2(startY - ay, startX - ax);
				const sweep = seg.spiral.turns * TWO_PI * flipSweep;
				curve = (t) => {
					const r = r0 + (r1 - r0) * t;
					return {
						x: ax + Math.cos(a0 + sweep * t) * r,
						y: ay + Math.sin(a0 + sweep * t) * r
					};
				};
			} else if (seg.wave) {
				const ex = tx(seg.wave.to[0]);
				const ey = ty(seg.wave.to[1]);
				const amp = seg.wave.amplitude * flipSweep;
				const cycles = seg.wave.cycles;
				const triangle = seg.wave.shape === "triangle";
				const dx = ex - startX;
				const dy = ey - startY;
				const len = Math.hypot(dx, dy) || 1e-4;
				const px = -dy / len;
				const py = dx / len;
				curve = (t) => {
					const phase = t * cycles;
					const osc = triangle ? 1 - 4 * Math.abs((phase + .25) % 1 - .5) : Math.sin(phase * TWO_PI);
					return {
						x: startX + dx * t + px * amp * osc,
						y: startY + dy * t + py * amp * osc
					};
				};
			} else throw new Error("Path segment needs one of: line, quad, cubic, arc, spiral, wave.");
			const xs = new Float64Array(samples + 1);
			const ys = new Float64Array(samples + 1);
			const cum = new Float64Array(samples + 1);
			let prevX = 0;
			let prevY = 0;
			for (let i = 0; i <= samples; i++) {
				const p = curve(i / samples);
				xs[i] = p.x;
				ys[i] = p.y;
				cum[i] = i === 0 ? 0 : cum[i - 1] + Math.hypot(p.x - prevX, p.y - prevY);
				prevX = p.x;
				prevY = p.y;
			}
			const baked = {
				xs,
				ys,
				cum,
				length: cum[samples],
				ease: resolveEase(seg.ease)
			};
			this.segments.push(baked);
			cx = xs[samples];
			cy = ys[samples];
		}
		this.length = this.segments.reduce((sum, s) => sum + s.length, 0);
	}
	/** Build a Path from a JSON string or an already-parsed data object. */
	static fromJSON(json, options = {}) {
		return new Path(typeof json === "string" ? JSON.parse(json) : json, options);
	}
	/** The point at `t` (0 = start, 1 = end) measured BY DISTANCE along the path
	*  (constant speed unless eased). Pass `out` to avoid allocating. */
	getPoint(t, out = {
		x: 0,
		y: 0
	}) {
		let d = (this.pathEase ? this.pathEase(clamp01(t)) : clamp01(t)) * this.length;
		let seg = this.segments[this.segments.length - 1];
		for (let i = 0; i < this.segments.length; i++) {
			if (d <= this.segments[i].length || i === this.segments.length - 1) {
				seg = this.segments[i];
				break;
			}
			d -= this.segments[i].length;
		}
		let u = seg.length > 0 ? d / seg.length : 0;
		if (seg.ease) u = seg.ease(clamp01(u));
		return sampleSegment(seg, u * seg.length, out);
	}
	/** The direction of travel at `t`, in radians (atan2 convention — feed it
	*  straight to `sprite.rot` so art faces along the path). */
	getAngle(t) {
		const step = 1 / Math.max(200, this.segments.length * 50);
		const a = this.getPoint(Math.min(1 - step, Math.max(0, t)));
		const b = this.getPoint(Math.min(1, Math.max(step, t) + step));
		return Math.atan2(b.y - a.y, b.x - a.x);
	}
};
function clamp01(t) {
	return t < 0 ? 0 : t > 1 ? 1 : t;
}
/** Sample a baked segment at a distance along it (binary search + lerp). */
function sampleSegment(seg, dist, out) {
	const { xs, ys, cum } = seg;
	const last = cum.length - 1;
	if (dist <= 0) {
		out.x = xs[0];
		out.y = ys[0];
		return out;
	}
	if (dist >= cum[last]) {
		out.x = xs[last];
		out.y = ys[last];
		return out;
	}
	let lo = 0;
	let hi = last;
	while (lo + 1 < hi) {
		const mid = lo + hi >> 1;
		if (cum[mid] <= dist) lo = mid;
		else hi = mid;
	}
	const span = cum[hi] - cum[lo] || 1;
	const f = (dist - cum[lo]) / span;
	out.x = xs[lo] + (xs[hi] - xs[lo]) * f;
	out.y = ys[lo] + (ys[hi] - ys[lo]) * f;
	return out;
}
/**
* Walks a {@link Path} at a speed in px/s — the per-frame driver for a follower.
* Construct once, call `advance(dt)` each frame, read `t` / `done`:
*
* ```ts
* const walker = new PathWalker(swoop, 120);          // 120 px/s, once through
* // in update(dt):
* walker.advance(dt);
* const p = path.getPoint(walker.t);
* this.x = p.x; this.y = p.y;
* if (walker.done) this.kill();
* ```
*/
var PathWalker = class {
	path;
	mode;
	/** Current progress 0..1 (by distance). */
	t = 0;
	/** `true` once a `'once'` walk reaches the end (never for loop/yoyo). */
	done = false;
	/** Travel speed in px/s — change it live (boosts, slow-motion). */
	speed;
	dir = 1;
	constructor(path, speed, mode = "once", startT = 0) {
		this.path = path;
		this.mode = mode;
		this.speed = speed;
		this.t = clamp01(startT);
	}
	/** Advance by `dt` seconds. Returns `this.done` for convenience. */
	advance(dt) {
		if (this.done) return true;
		const step = this.speed * dt / Math.max(1e-4, this.path.length);
		this.t += step * this.dir;
		if (this.mode === "once") {
			if (this.t >= 1) {
				this.t = 1;
				this.done = true;
			} else if (this.t < 0) this.t = 0;
		} else if (this.mode === "loop") this.t -= Math.floor(this.t);
		else if (this.t > 1) {
			this.t = 2 - this.t;
			this.dir = -1;
		} else if (this.t < 0) {
			this.t = -this.t;
			this.dir = 1;
		}
		return this.done;
	}
	/** Reset to the start (or `startT`), forward, not done. */
	reset(startT = 0) {
		this.t = clamp01(startT);
		this.dir = 1;
		this.done = false;
	}
};
//#endregion
//#region src/lib/track.ts
/**
* Track networks — the "Bloons" tower-defense model: enemies follow a FIXED,
* authored path (which may fork and merge); guns are placed BESIDE it and just
* shoot. Pure CPU math, zero engine dependency; import it directly
* (`import { Track } from '../engine/webgpu.js'`). NOT wired into `Game`.
*
* This is the counterpart to `FlowGrid` (open-field, towers reshape routes):
* here the route is authored and immutable. A `Track` is a directed graph of
* named nodes connected by {@link Path} edges (straight or curved). A
* {@link TrackWalker} walks from a spawn node to a goal node, choosing a branch
* at each junction — all the arc-length curve maths is reused from `Path`, so
* hundreds of followers are cheap.
*
* Feeds either engine dimension: read `walker.x` / `walker.y` (world position)
* and `walker.angle` each frame to place a sprite or a 3D mesh (use x/y as x/z
* on the ground plane). For the towers: `track.distanceToTrack(x, y)` validates
* "not on the path" placement, and `walker.distanceToGoal` ranks targets by how
* far along the track they are (the classic "first"/"last" targeting).
*/
/**
* A network of authored path segments that enemies follow. Build it once, then
* `spawn()` walkers and advance them each frame.
*
* ```ts
* const track = new Track({
*   nodes: { in: [0, 300], fork: [400, 300], top: [800, 120], bot: [800, 480], out: [1200, 300] },
*   edges: [
*     { from: 'in', to: 'fork' },
*     { from: 'fork', to: 'top', via: [{ quad: [[600, 120], [800, 120]] }] },   // branch A
*     { from: 'fork', to: 'bot', via: [{ quad: [[600, 480], [800, 480]] }] },   // branch B
*     { from: 'top', to: 'out' }, { from: 'bot', to: 'out' },                    // merge
*   ],
* });
* const w = track.spawn(140);                    // 140 units/s
* // per frame: w.advance(dt); sprite.x = w.x; sprite.y = w.y;  if (w.done) leak();
* ```
*/
var Track = class {
	/** All baked edges. */
	edges = [];
	/** Spawn node names. */
	spawns = [];
	/** Goal node names. */
	goals = [];
	nodes = /* @__PURE__ */ new Map();
	constructor(data, options = {}) {
		const fx = options.flipX, fy = options.flipY;
		const ox = options.offset?.[0] ?? 0, oy = options.offset?.[1] ?? 0;
		const tx = (x) => (fx !== void 0 ? fx * 2 - x : x) + ox;
		const ty = (y) => (fy !== void 0 ? fy * 2 - y : y) + oy;
		for (const [name, p] of Object.entries(data.nodes)) this.nodes.set(name, {
			x: tx(p[0]),
			y: ty(p[1]),
			out: [],
			incoming: 0,
			isSpawn: false,
			isGoal: false,
			toGoal: Infinity
		});
		for (const e of data.edges) {
			const a = this.nodes.get(e.from), b = this.nodes.get(e.to);
			if (!a || !b) throw new Error(`Track edge references unknown node: ${e.from} → ${e.to}`);
			const segs = e.via ?? [{ line: data.nodes[e.to] }];
			const path = new Path({
				start: data.nodes[e.from],
				segments: segs
			}, options);
			const points = this._sample(path);
			const edge = {
				from: e.from,
				to: e.to,
				path,
				length: path.length,
				weight: e.weight ?? 1,
				points
			};
			a.out.push(edge);
			b.incoming++;
			this.edges.push(edge);
		}
		const spawnSet = new Set(data.spawns ?? [...this.nodes].filter(([, n]) => n.incoming === 0).map(([k]) => k));
		const goalSet = new Set(data.goals ?? [...this.nodes].filter(([, n]) => n.out.length === 0).map(([k]) => k));
		for (const [name, n] of this.nodes) {
			n.isSpawn = spawnSet.has(name);
			n.isGoal = goalSet.has(name);
			if (n.isSpawn) this.spawns.push(name);
			if (n.isGoal) this.goals.push(name);
		}
		this._computeToGoal();
	}
	/** Sample a Path into a polyline (≈ one point per 8 units, min 2). */
	_sample(path) {
		const n = Math.max(2, Math.ceil(path.length / 8) + 1);
		const pts = [];
		for (let i = 0; i < n; i++) pts.push(path.getPoint(i / (n - 1)));
		return pts;
	}
	/** Dijkstra on the REVERSED graph from every goal → shortest along-track
	*  distance from each node to a goal (used for target ranking). */
	_computeToGoal() {
		const names = [...this.nodes.keys()];
		const preds = /* @__PURE__ */ new Map();
		for (const name of names) preds.set(name, []);
		for (const e of this.edges) preds.get(e.to).push([e.from, e.length]);
		const dist = this.nodes;
		const heap = [];
		const push = (k, name) => {
			heap.push([k, name]);
			heap.sort((a, b) => a[0] - b[0]);
		};
		for (const g of this.goals) {
			const n = dist.get(g);
			n.toGoal = 0;
			push(0, g);
		}
		while (heap.length) {
			const [d, name] = heap.shift();
			if (d > dist.get(name).toGoal) continue;
			for (const [prev, len] of preds.get(name)) {
				const pn = dist.get(prev);
				if (d + len < pn.toGoal) {
					pn.toGoal = d + len;
					push(pn.toGoal, prev);
				}
			}
		}
	}
	/** The world position of a named node, or `null` if unknown. */
	nodeAt(name) {
		const n = this.nodes.get(name);
		return n ? {
			x: n.x,
			y: n.y
		} : null;
	}
	/** The total length of the track (sum of all edges). */
	get length() {
		return this.edges.reduce((s, e) => s + e.length, 0);
	}
	/**
	* Create a follower. It enters at `from` (or a random spawn node) and picks a
	* branch at each junction using the edge weights and `rng` (default
	* `Math.random`). `speed` is world units per second; `startDist` staggers a
	* stream by starting it that far along.
	*/
	spawn(speed, opts = {}) {
		const rng = opts.rng ?? Math.random;
		let name = opts.from;
		if (!name || !this.nodes.get(name)?.isSpawn) name = this.spawns[rng() * this.spawns.length | 0] ?? this.spawns[0];
		const node = this.nodes.get(name);
		if (!node) throw new Error("Track has no spawn node to start from.");
		const edge = this._pickEdge(node, rng);
		const w = new TrackWalker(this, edge, speed, rng);
		if (opts.startDist) w.advance(opts.startDist / speed);
		return w;
	}
	/** @internal Weighted branch choice among a node's out edges (`null` = a goal). */
	_pickEdge(node, rng) {
		if (node.out.length === 0) return null;
		if (node.out.length === 1) return node.out[0];
		let total = 0;
		for (const e of node.out) total += e.weight;
		let r = rng() * total;
		for (const e of node.out) {
			r -= e.weight;
			if (r <= 0) return e;
		}
		return node.out[node.out.length - 1];
	}
	/** @internal The remaining along-track distance from a node to the nearest goal. */
	_toGoal(name) {
		return this.nodes.get(name)?.toGoal ?? Infinity;
	}
	/** @internal Look up a node by name. */
	_node(name) {
		return this.nodes.get(name);
	}
	/**
	* Shortest distance from world point `(x, y)` to the track centre-line — for
	* validating tower placement ("must be off the path by `margin`") and for
	* range-of-track checks. Returns `Infinity` for an empty track.
	*/
	distanceToTrack(x, y) {
		let best = Infinity;
		for (const e of this.edges) {
			const p = e.points;
			for (let i = 0; i < p.length - 1; i++) {
				const d = distToSeg(x, y, p[i].x, p[i].y, p[i + 1].x, p[i + 1].y);
				if (d < best) best = d;
			}
		}
		return best;
	}
};
/**
* A single follower walking a {@link Track}. Construct via `track.spawn()`;
* call `advance(dt)` each frame and read `x` / `y` / `angle` / `done`.
*/
var TrackWalker = class {
	track;
	rng;
	/** Current world X. */
	x = 0;
	/** Current world Y. */
	y = 0;
	/** Heading in radians (direction of travel). */
	angle = 0;
	/** `true` once a goal node is reached (the enemy "leaked"). */
	done = false;
	/** Total distance travelled along the track so far. */
	travelled = 0;
	/** Travel speed in world units per second — mutate live (slows, boosts). */
	speed;
	edge;
	edgeDist = 0;
	constructor(track, edge, speed, rng) {
		this.track = track;
		this.rng = rng;
		this.edge = edge;
		this.speed = speed;
		if (!edge) this.done = true;
		else this._writePose();
	}
	/** Remaining along-track distance to the nearest goal — SMALLER means FURTHER
	*  along (use it to target the "first" enemy: the one closest to leaking). */
	get distanceToGoal() {
		if (this.done || !this.edge) return 0;
		return this.track._toGoal(this.edge.to) + (this.edge.length - this.edgeDist);
	}
	/** Advance by `dt` seconds, carrying across junctions and choosing branches.
	*  Returns `this.done`. */
	advance(dt) {
		if (this.done || !this.edge) return true;
		let remain = this.speed * dt;
		while (remain > 0 && this.edge) {
			const left = this.edge.length - this.edgeDist;
			if (remain < left) {
				this.edgeDist += remain;
				this.travelled += remain;
				remain = 0;
			} else {
				remain -= left;
				this.travelled += left;
				const node = this.track._node(this.edge.to);
				if (node.isGoal) {
					this.edge = null;
					this.done = true;
					break;
				}
				const next = this.track._pickEdge(node, this.rng);
				if (!next) {
					this.edge = null;
					this.done = true;
					break;
				}
				this.edge = next;
				this.edgeDist = 0;
			}
		}
		if (this.edge) this._writePose();
		return this.done;
	}
	_writePose() {
		if (!this.edge) return;
		const t = this.edgeDist / Math.max(1e-4, this.edge.length);
		const p = this.edge.path.getPoint(t);
		this.x = p.x;
		this.y = p.y;
		this.angle = this.edge.path.getAngle(t);
	}
};
/** Distance from point `(px,py)` to segment `a–b`. */
function distToSeg(px, py, ax, ay, bx, by) {
	const dx = bx - ax, dy = by - ay;
	const len2 = dx * dx + dy * dy;
	let t = len2 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
	t = t < 0 ? 0 : t > 1 ? 1 : t;
	return Math.hypot(px - (ax + dx * t), py - (ay + dy * t));
}
//#endregion
//#region src/lib/dungeon.ts
/**
* Roguelike DUNGEON generator — rooms joined by corridors, with doors and
* tagged rooms. Pure CPU math, zero engine dependency; import it directly
* (`import { Dungeon } from '../engine/webgpu.js'`). NOT wired into `Game`.
*
* The sibling to `Maze`: where a maze is wall-per-edge corridors, a dungeon is
* open ROOMS connected by tunnels — the Rogue/Nethack/Zelda layout. It works
* straight in tile space (one cell = one floor tile you walk on), so the output
* is a thick 0/1 grid ready for a `Tilemap` / `CollisionGrid` / wall-box build,
* or to seed a `FlowGrid`'s obstacles. Rooms are placed, connected into one
* network (plus optional extra loops), doorways are detected, and rooms are
* TAGGED (start / boss / treasure / junction) so a game can place the player,
* the objective, and loot without post-analysis.
*/
var WALL$1 = 1;
var FLOOR$1 = 0;
var DOOR = 2;
/**
* A generated dungeon: the tile grid plus room/door metadata and the queries a
* game needs. Construct once (generation runs in the constructor); read from it
* every frame.
*
* ```ts
* const dungeon = new Dungeon({ cols: 60, rows: 40, seed: 'level-1', extraConnections: 3 });
* const grid = dungeon.tiles();                        // 0 floor / 1 wall → CollisionGrid
* const start = dungeon.roomsByTag('start')[0];        // where to drop the player
* const boss = dungeon.roomsByTag('boss')[0];          // the objective room
* ```
*/
var Dungeon = class {
	/** Grid width in tiles. */
	cols;
	/** Grid height in tiles. */
	rows;
	/** The numeric seed actually used. */
	seed;
	/** Per-tile data, row-major: `1` wall, `0` floor, `2` door. Prefer
	*  {@link isWall} / {@link tiles}, but exposed for custom exporters. */
	grid;
	/** Every placed room. */
	rooms = [];
	/** Detected doorway tiles (1-wide thresholds into rooms). */
	doors = [];
	/** Room-graph edges as `[roomId, roomId]` pairs (which rooms are joined). */
	connections = [];
	constructor(opts) {
		this.cols = Math.max(5, Math.floor(opts.cols));
		this.rows = Math.max(5, Math.floor(opts.rows));
		this.seed = typeof opts.seed === "string" ? hashCode(opts.seed) : opts.seed ?? Math.random() * 4294967295 >>> 0;
		const rng = makeRng(this.seed);
		this.grid = new Uint8Array(this.cols * this.rows).fill(WALL$1);
		const minR = Math.max(3, opts.minRoom ?? 4);
		const maxR = Math.max(minR, opts.maxRoom ?? 9);
		const margin = Math.max(0, opts.roomMargin ?? 1);
		const attempts = opts.roomAttempts ?? Math.floor(this.cols * this.rows / 45) + 4;
		const width = Math.max(1, Math.floor(opts.corridorWidth ?? 1));
		this._placeRooms(rng, attempts, minR, maxR, margin);
		this._connectRooms(rng, opts.extraConnections ?? 2, width);
		if (width === 1) this._detectDoors();
		this._tagRooms();
	}
	/** Row-major tile index for `(col, row)`. No bounds check. */
	index(col, row) {
		return row * this.cols + col;
	}
	/** Is `(col, row)` inside the grid? */
	inBounds(col, row) {
		return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
	}
	/** Is the tile solid wall? Out-of-bounds reads as wall. */
	isWall(col, row) {
		return !this.inBounds(col, row) || this.grid[this.index(col, row)] === WALL$1;
	}
	/** Is the tile walkable (floor or door)? */
	isFloor(col, row) {
		return this.inBounds(col, row) && this.grid[this.index(col, row)] !== WALL$1;
	}
	/** Which cell contains world/pixel position `(x, y)` at `cellSize` units per
	*  tile from `(originX, originY)`. `null` when outside the grid. */
	cellAt(x, y, cellSize = 1, originX = 0, originY = 0) {
		const col = Math.floor((x - originX) / cellSize);
		const row = Math.floor((y - originY) / cellSize);
		return this.inBounds(col, row) ? {
			col,
			row
		} : null;
	}
	/** The room whose rectangle contains `(col, row)`, or `null` (a corridor / wall). */
	roomAt(col, row) {
		for (const r of this.rooms) if (col >= r.col && col < r.col + r.w && row >= r.row && row < r.row + r.h) return r;
		return null;
	}
	/** All rooms carrying a given {@link RoomTag}. */
	roomsByTag(tag) {
		return this.rooms.filter((r) => r.tag === tag);
	}
	/** Every walkable (floor or door) cell — for scattering pickups / spawns. */
	floors() {
		const out = [];
		for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid[this.index(c, r)] !== WALL$1) out.push({
			col: c,
			row: r
		});
		return out;
	}
	/** Shortest walkable path from `from` to `to` (4-dir BFS through floor +
	*  doors), inclusive; `[]` if unreachable. */
	path(from, to) {
		if (!this.isFloor(from.col, from.row) || !this.isFloor(to.col, to.row)) return [];
		const n = this.cols * this.rows;
		const prev = new Int32Array(n).fill(-2);
		const start = this.index(from.col, from.row);
		prev[start] = -1;
		let frontier = [start];
		const goal = this.index(to.col, to.row);
		const DX = [
			0,
			1,
			0,
			-1
		], DY = [
			-1,
			0,
			1,
			0
		];
		while (frontier.length) {
			const next = [];
			for (const i of frontier) {
				if (i === goal) {
					frontier = [];
					break;
				}
				const c = i % this.cols, r = i / this.cols | 0;
				for (let d = 0; d < 4; d++) {
					const nc = c + DX[d], nr = r + DY[d];
					if (!this.inBounds(nc, nr) || this.grid[this.index(nc, nr)] === WALL$1) continue;
					const j = this.index(nc, nr);
					if (prev[j] === -2) {
						prev[j] = i;
						next.push(j);
					}
				}
			}
			if (frontier.length) frontier = next;
		}
		if (prev[goal] === -2) return [];
		const out = [];
		for (let i = goal; i !== -1; i = prev[i]) out.push({
			col: i % this.cols,
			row: i / this.cols | 0
		});
		return out.reverse();
	}
	/** The dungeon as a THICK 0/1 tile grid (`grid[y][x]`), ready for a `Tilemap`
	*  / `CollisionGrid` / wall-box build. Doors default to the floor value. */
	tiles(opts = {}) {
		const wall = opts.wall ?? 1;
		const floor = opts.floor ?? 0;
		const door = opts.door ?? floor;
		const out = [];
		for (let r = 0; r < this.rows; r++) {
			const row = new Array(this.cols);
			for (let c = 0; c < this.cols; c++) {
				const t = this.grid[this.index(c, r)];
				row[c] = t === WALL$1 ? wall : t === DOOR ? door : floor;
			}
			out.push(row);
		}
		return out;
	}
	/** ASCII rendering (`#` wall, `+` door, `.` floor) — tests + console. */
	toString() {
		let s = "";
		for (let r = 0; r < this.rows; r++) {
			for (let c = 0; c < this.cols; c++) {
				const t = this.grid[this.index(c, r)];
				s += t === WALL$1 ? "#" : t === DOOR ? "+" : ".";
			}
			s += "\n";
		}
		return s;
	}
	_setFloor(col, row) {
		if (this.inBounds(col, row) && this.grid[this.index(col, row)] === WALL$1) this.grid[this.index(col, row)] = FLOOR$1;
	}
	_placeRooms(rng, attempts, minR, maxR, margin) {
		const fits = (col, row, w, h) => {
			for (const r of this.rooms) if (col - margin < r.col + r.w && col + w + margin > r.col && row - margin < r.row + r.h && row + h + margin > r.row) return false;
			return true;
		};
		for (let i = 0; i < attempts; i++) {
			const w = minR + (rng() * (maxR - minR + 1) | 0);
			const h = minR + (rng() * (maxR - minR + 1) | 0);
			if (w >= this.cols - 2 || h >= this.rows - 2) continue;
			const col = 1 + (rng() * (this.cols - w - 2) | 0);
			const row = 1 + (rng() * (this.rows - h - 2) | 0);
			if (!fits(col, row, w, h)) continue;
			const room = {
				id: this.rooms.length,
				col,
				row,
				w,
				h,
				cx: col + (w >> 1),
				cy: row + (h >> 1),
				tag: "normal"
			};
			for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) this.grid[this.index(c, r)] = FLOOR$1;
			this.rooms.push(room);
		}
		if (this.rooms.length === 0) {
			const w = Math.min(maxR, this.cols - 2), h = Math.min(maxR, this.rows - 2);
			const col = (this.cols - w) / 2 | 0, row = (this.rows - h) / 2 | 0;
			for (let r = row; r < row + h; r++) for (let c = col; c < col + w; c++) this.grid[this.index(c, r)] = FLOOR$1;
			this.rooms.push({
				id: 0,
				col,
				row,
				w,
				h,
				cx: col + (w >> 1),
				cy: row + (h >> 1),
				tag: "normal"
			});
		}
	}
	_carveH(x0, x1, y, width) {
		const lo = Math.min(x0, x1), hi = Math.max(x0, x1);
		for (let x = lo; x <= hi; x++) for (let w = 0; w < width; w++) this._setFloor(x, y + w);
	}
	_carveV(y0, y1, x, width) {
		const lo = Math.min(y0, y1), hi = Math.max(y0, y1);
		for (let y = lo; y <= hi; y++) for (let w = 0; w < width; w++) this._setFloor(x + w, y);
	}
	_corridor(a, b, rng, width) {
		if (rng() < .5) {
			this._carveH(a.cx, b.cx, a.cy, width);
			this._carveV(a.cy, b.cy, b.cx, width);
		} else {
			this._carveV(a.cy, b.cy, a.cx, width);
			this._carveH(a.cx, b.cx, b.cy, width);
		}
	}
	_connectRooms(rng, extra, width) {
		for (let i = 1; i < this.rooms.length; i++) {
			let best = 0, bd = Infinity;
			for (let j = 0; j < i; j++) {
				const dx = this.rooms[i].cx - this.rooms[j].cx, dy = this.rooms[i].cy - this.rooms[j].cy;
				const d = dx * dx + dy * dy;
				if (d < bd) {
					bd = d;
					best = j;
				}
			}
			this._corridor(this.rooms[i], this.rooms[best], rng, width);
			this.connections.push([i, best]);
		}
		for (let k = 0; k < extra && this.rooms.length > 2; k++) {
			const a = rng() * this.rooms.length | 0;
			let b = rng() * this.rooms.length | 0;
			if (a === b) b = (b + 1) % this.rooms.length;
			this._corridor(this.rooms[a], this.rooms[b], rng, width);
			this.connections.push([a, b]);
		}
	}
	/** Mark 1-wide corridor tiles that thread into a room as doors. */
	_detectDoors() {
		for (let r = 1; r < this.rows - 1; r++) for (let c = 1; c < this.cols - 1; c++) {
			const i = this.index(c, r);
			if (this.grid[i] !== FLOOR$1 || this.roomAt(c, r)) continue;
			const wallV = this.grid[this.index(c, r - 1)] === WALL$1 && this.grid[this.index(c, r + 1)] === WALL$1;
			const wallH = this.grid[this.index(c - 1, r)] === WALL$1 && this.grid[this.index(c + 1, r)] === WALL$1;
			if (wallV && (this.roomAt(c - 1, r) || this.roomAt(c + 1, r))) {
				this.grid[i] = DOOR;
				this.doors.push({
					col: c,
					row: r
				});
			} else if (wallH && (this.roomAt(c, r - 1) || this.roomAt(c, r + 1))) {
				this.grid[i] = DOOR;
				this.doors.push({
					col: c,
					row: r
				});
			}
		}
	}
	_tagRooms() {
		if (this.rooms.length === 1) {
			this.rooms[0].tag = "start";
			return;
		}
		const adj = /* @__PURE__ */ new Map();
		const deg = new Int32Array(this.rooms.length);
		for (const r of this.rooms) adj.set(r.id, []);
		for (const [a, b] of this.connections) {
			if (a === b) continue;
			adj.get(a).push(b);
			adj.get(b).push(a);
			deg[a]++;
			deg[b]++;
		}
		let start = 0;
		for (let i = 1; i < this.rooms.length; i++) if (this.rooms[i].cx + this.rooms[i].cy < this.rooms[start].cx + this.rooms[start].cy) start = i;
		const dist = new Int32Array(this.rooms.length).fill(-1);
		dist[start] = 0;
		let frontier = [start], boss = start;
		while (frontier.length) {
			const next = [];
			for (const i of frontier) {
				if (dist[i] > dist[boss]) boss = i;
				for (const j of adj.get(i)) if (dist[j] === -1) {
					dist[j] = dist[i] + 1;
					next.push(j);
				}
			}
			frontier = next;
		}
		for (const r of this.rooms) if (r.id === start) r.tag = "start";
		else if (r.id === boss) r.tag = "boss";
		else if (deg[r.id] >= 3) r.tag = "junction";
		else if (deg[r.id] <= 1) r.tag = "treasure";
		else r.tag = "normal";
	}
};
//#endregion
//#region src/lib/cave.ts
/**
* Organic CAVE generator — cellular-automata caverns. Pure CPU math, zero
* engine dependency; import it directly (`import { Cave } from
* '../engine/webgpu.js'`). NOT wired into `Game`.
*
* The organic counterpart to `Maze` (rectilinear corridors) and `Dungeon`
* (rooms + tunnels): random-fill the grid, then smooth it a few times with a
* majority rule so blobs coalesce into rounded caverns (the Terraria/Spelunky
* look). Output is a thick 0/1 tile grid ready for a `Tilemap` /
* `CollisionGrid` / wall-box build, or to seed a `FlowGrid`'s obstacles. By
* default disconnected pockets are filled in, so the whole floor is one
* reachable cave.
*/
var WALL = 1;
var FLOOR = 0;
/**
* A generated cave: the tile grid plus the queries a game needs. Construct once
* (generation runs in the constructor); read from it every frame.
*
* ```ts
* const cave = new Cave({ cols: 80, rows: 50, seed: 'cavern-1', fillProb: 0.46 });
* const grid = cave.tiles();                    // 0 floor / 1 wall → CollisionGrid
* const [entrance, exit] = cave.farthestPair(); // two far-apart floor cells
* ```
*/
var Cave = class {
	/** Grid width in tiles. */
	cols;
	/** Grid height in tiles. */
	rows;
	/** The numeric seed actually used. */
	seed;
	/** Per-tile data, row-major: `1` wall, `0` floor. Prefer {@link isWall} /
	*  {@link tiles}, but exposed for custom exporters. */
	grid;
	constructor(opts) {
		this.cols = Math.max(3, Math.floor(opts.cols));
		this.rows = Math.max(3, Math.floor(opts.rows));
		this.seed = typeof opts.seed === "string" ? hashCode(opts.seed) : opts.seed ?? Math.random() * 4294967295 >>> 0;
		const rng = makeRng(this.seed);
		const fill = opts.fillProb ?? .45;
		const iterations = Math.max(0, opts.iterations ?? 4);
		const threshold = opts.wallThreshold ?? 5;
		const n = this.cols * this.rows;
		this.grid = new Uint8Array(n);
		for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) this.grid[this.index(c, r)] = c === 0 || r === 0 || c === this.cols - 1 || r === this.rows - 1 || rng() < fill ? WALL : FLOOR;
		for (let i = 0; i < iterations; i++) this._smooth(threshold);
		if (opts.keepLargest ?? true) this._keepLargest();
	}
	/** Row-major tile index for `(col, row)`. No bounds check. */
	index(col, row) {
		return row * this.cols + col;
	}
	/** Is `(col, row)` inside the grid? */
	inBounds(col, row) {
		return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
	}
	/** Is the tile solid rock? Out-of-bounds reads as wall. */
	isWall(col, row) {
		return !this.inBounds(col, row) || this.grid[this.index(col, row)] === WALL;
	}
	/** Is the tile open (walkable) cavern floor? */
	isFloor(col, row) {
		return this.inBounds(col, row) && this.grid[this.index(col, row)] === FLOOR;
	}
	/** Which cell contains world/pixel position `(x, y)` at `cellSize` units per
	*  tile from `(originX, originY)`. `null` when outside the grid. */
	cellAt(x, y, cellSize = 1, originX = 0, originY = 0) {
		const col = Math.floor((x - originX) / cellSize);
		const row = Math.floor((y - originY) / cellSize);
		return this.inBounds(col, row) ? {
			col,
			row
		} : null;
	}
	/** Count of open floor tiles. */
	get openCount() {
		let n = 0;
		for (let i = 0; i < this.grid.length; i++) if (this.grid[i] === FLOOR) n++;
		return n;
	}
	/** Every open floor cell — for scattering spawns / ore / pickups. */
	floors() {
		const out = [];
		for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) if (this.grid[this.index(c, r)] === FLOOR) out.push({
			col: c,
			row: r
		});
		return out;
	}
	/** Two far-apart floor cells (an approximate cave "diameter"), good for an
	*  entrance/exit pair. Returns `[]` if there's no floor. */
	farthestPair() {
		const first = this.floors()[0];
		if (!first) return [];
		const a = this._bfsFarthest(first);
		return [a, this._bfsFarthest(a)];
	}
	/** Shortest walkable path from `from` to `to` (4-dir BFS through floor),
	*  inclusive; `[]` if unreachable. */
	path(from, to) {
		if (!this.isFloor(from.col, from.row) || !this.isFloor(to.col, to.row)) return [];
		const n = this.cols * this.rows;
		const prev = new Int32Array(n).fill(-2);
		const start = this.index(from.col, from.row);
		const goal = this.index(to.col, to.row);
		prev[start] = -1;
		let frontier = [start];
		const DX = [
			0,
			1,
			0,
			-1
		], DY = [
			-1,
			0,
			1,
			0
		];
		let reached = start === goal;
		while (frontier.length && !reached) {
			const next = [];
			for (const i of frontier) {
				const c = i % this.cols, r = i / this.cols | 0;
				for (let d = 0; d < 4; d++) {
					const nc = c + DX[d], nr = r + DY[d];
					if (!this.isFloor(nc, nr)) continue;
					const j = this.index(nc, nr);
					if (prev[j] === -2) {
						prev[j] = i;
						if (j === goal) reached = true;
						next.push(j);
					}
				}
			}
			frontier = next;
		}
		if (prev[goal] === -2) return [];
		const out = [];
		for (let i = goal; i !== -1; i = prev[i]) out.push({
			col: i % this.cols,
			row: i / this.cols | 0
		});
		return out.reverse();
	}
	/** The cave as a THICK 0/1 tile grid (`grid[y][x]`), ready for a `Tilemap` /
	*  `CollisionGrid` / wall-box build. */
	tiles(opts = {}) {
		const wall = opts.wall ?? 1;
		const floor = opts.floor ?? 0;
		const out = [];
		for (let r = 0; r < this.rows; r++) {
			const row = new Array(this.cols);
			for (let c = 0; c < this.cols; c++) row[c] = this.grid[this.index(c, r)] === WALL ? wall : floor;
			out.push(row);
		}
		return out;
	}
	/** ASCII rendering (`#` wall, space floor) — tests + console. */
	toString() {
		let s = "";
		for (let r = 0; r < this.rows; r++) {
			for (let c = 0; c < this.cols; c++) s += this.grid[this.index(c, r)] === WALL ? "#" : " ";
			s += "\n";
		}
		return s;
	}
	/** One cellular-automata pass: a cell becomes wall when ≥ `threshold` of its
	*  8 neighbours are wall (out-of-bounds counts as wall). */
	_smooth(threshold) {
		const next = new Uint8Array(this.grid.length);
		for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) {
			if (c === 0 || r === 0 || c === this.cols - 1 || r === this.rows - 1) {
				next[this.index(c, r)] = WALL;
				continue;
			}
			let walls = 0;
			for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
				if (dx === 0 && dy === 0) continue;
				if (this.isWall(c + dx, r + dy)) walls++;
			}
			next[this.index(c, r)] = walls >= threshold ? WALL : FLOOR;
		}
		this.grid.set(next);
	}
	/** Flood-fill floor regions; keep the largest, turn the rest to wall. */
	_keepLargest() {
		const n = this.cols * this.rows;
		const region = new Int32Array(n).fill(-1);
		const DX = [
			0,
			1,
			0,
			-1
		], DY = [
			-1,
			0,
			1,
			0
		];
		let bestId = -1, bestSize = 0;
		const sizes = [];
		let id = 0;
		for (let s = 0; s < n; s++) {
			if (this.grid[s] === WALL || region[s] !== -1) continue;
			let size = 0;
			let stack = [s];
			region[s] = id;
			while (stack.length) {
				const i = stack.pop();
				size++;
				const c = i % this.cols, r = i / this.cols | 0;
				for (let d = 0; d < 4; d++) {
					const nc = c + DX[d], nr = r + DY[d];
					if (!this.inBounds(nc, nr)) continue;
					const j = this.index(nc, nr);
					if (this.grid[j] === FLOOR && region[j] === -1) {
						region[j] = id;
						stack.push(j);
					}
				}
			}
			sizes[id] = size;
			if (size > bestSize) {
				bestSize = size;
				bestId = id;
			}
			id++;
		}
		if (bestId === -1) return;
		for (let i = 0; i < n; i++) if (this.grid[i] === FLOOR && region[i] !== bestId) this.grid[i] = WALL;
	}
	/** BFS from a floor cell; return the farthest reachable floor cell. */
	_bfsFarthest(from) {
		const n = this.cols * this.rows;
		const seen = new Uint8Array(n);
		const start = this.index(from.col, from.row);
		seen[start] = 1;
		let frontier = [start], last = start;
		const DX = [
			0,
			1,
			0,
			-1
		], DY = [
			-1,
			0,
			1,
			0
		];
		while (frontier.length) {
			const next = [];
			for (const i of frontier) {
				last = i;
				const c = i % this.cols, r = i / this.cols | 0;
				for (let d = 0; d < 4; d++) {
					const nc = c + DX[d], nr = r + DY[d];
					if (!this.isFloor(nc, nr)) continue;
					const j = this.index(nc, nr);
					if (!seen[j]) {
						seen[j] = 1;
						next.push(j);
					}
				}
			}
			frontier = next;
		}
		return {
			col: last % this.cols,
			row: last / this.cols | 0
		};
	}
};
//#endregion
//#region src/lib/fog.ts
var MX = [
	1,
	0,
	0,
	-1,
	-1,
	0,
	0,
	1
];
var MXY = [
	0,
	1,
	-1,
	0,
	0,
	-1,
	1,
	0
];
var MYX = [
	0,
	1,
	1,
	0,
	0,
	-1,
	-1,
	0
];
var MY = [
	1,
	0,
	0,
	1,
	-1,
	0,
	0,
	-1
];
function falloffFn(kind) {
	switch (kind) {
		case "none": return () => 1;
		case "linear": return (t) => Math.max(0, 1 - t);
		case "quadratic": return (t) => Math.max(0, 1 - t * t);
		default: return (t) => {
			const s = Math.max(0, 1 - t);
			return s * s * (3 - 2 * s);
		};
	}
}
/**
* A grid tracking what's lit, what's remembered, and what's dark. Set the
* opaque cells (blockers), place lights, call `compute()` each frame, then read
* `lightAt` / `state` per cell.
*
* ```ts
* const fog = new FogGrid({ cols: dungeon.cols, rows: dungeon.rows });
* fog.blockFrom(dungeon.tiles());                 // walls block light
* const eye = fog.addLight(px, py, 7);            // the player's vision
* fog.addLight(torchX, torchY, 5, { intensity: 0.8 });   // a torch that reveals a far room
* // each frame: eye.col = px; eye.row = py; fog.compute();
* // then draw: fog.state(c, r) → 'visible' | 'explored' | 'unseen'; fog.lightAt(c, r) → 0..1
* ```
*/
var FogGrid = class {
	/** Grid width in cells. */
	cols;
	/** Grid height in cells. */
	rows;
	/** Default falloff for lights. */
	falloff;
	/** Whether fog-of-war memory is tracked. */
	memory;
	/** `1` where a cell blocks light/sight (walls, objects). Row-major. */
	opaque;
	/** Current-frame brightness per cell, `0`…`1`. Row-major. Prefer
	*  {@link lightAt} / {@link isVisible}. */
	light;
	/** `1` where a cell has ever been lit (fog-of-war memory). Row-major. */
	explored;
	/** The active light / vision sources — mutate freely, then `compute()`. */
	lights = [];
	constructor(opts) {
		this.cols = Math.max(1, Math.floor(opts.cols));
		this.rows = Math.max(1, Math.floor(opts.rows));
		this.falloff = opts.falloff ?? "smooth";
		this.memory = opts.memory ?? true;
		const n = this.cols * this.rows;
		this.opaque = new Uint8Array(n);
		this.light = new Float32Array(n);
		this.explored = new Uint8Array(n);
	}
	/** Row-major cell index for `(col, row)`. No bounds check. */
	index(col, row) {
		return row * this.cols + col;
	}
	/** Is `(col, row)` inside the grid? */
	inBounds(col, row) {
		return col >= 0 && col < this.cols && row >= 0 && row < this.rows;
	}
	/** Which cell contains world/pixel position `(x, y)` at `cellSize` units per
	*  cell from `(originX, originY)`. `null` when outside the grid. */
	cellAt(x, y, cellSize = 1, originX = 0, originY = 0) {
		const col = Math.floor((x - originX) / cellSize);
		const row = Math.floor((y - originY) / cellSize);
		return this.inBounds(col, row) ? {
			col,
			row
		} : null;
	}
	/** Does the cell block light/sight? Out-of-bounds reads as opaque. */
	isOpaque(col, row) {
		return !this.inBounds(col, row) || this.opaque[this.index(col, row)] === 1;
	}
	/** Set/clear a blocker (a wall or a light-blocking object). */
	setOpaque(col, row, on) {
		if (this.inBounds(col, row)) this.opaque[this.index(col, row)] = on ? 1 : 0;
	}
	/** Clear every blocker. */
	clearOpaque() {
		this.opaque.fill(0);
	}
	/**
	* Load blockers from a tile grid (`grid[row][col]`) — e.g. `maze.tiles()`,
	* `dungeon.tiles()`, `cave.tiles()`. Cells equal to `wallValue` (default `1`)
	* become opaque; everything else is clear. The grid must match this size.
	*/
	blockFrom(grid, wallValue = 1) {
		for (let r = 0; r < this.rows; r++) {
			const row = grid[r];
			if (!row) continue;
			for (let c = 0; c < this.cols; c++) this.opaque[this.index(c, r)] = row[c] === wallValue ? 1 : 0;
		}
	}
	/** Add a light / vision source and return its handle (mutate `col`/`row` to
	*  move it). `radius` is in cells; `intensity` 0…1 (default 1). */
	addLight(col, row, radius, opts = {}) {
		const src = {
			col,
			row,
			radius,
			intensity: opts.intensity ?? 1,
			falloff: opts.falloff
		};
		this.lights.push(src);
		return src;
	}
	/** Remove a light previously returned by {@link addLight}. */
	removeLight(src) {
		const i = this.lights.indexOf(src);
		if (i >= 0) this.lights.splice(i, 1);
	}
	/** Remove all lights. */
	clearLights() {
		this.lights.length = 0;
	}
	/**
	* Recompute the light field from all sources (recursive shadowcasting through
	* the opaque cells) and fold currently-lit cells into the explored memory.
	* Each cell keeps the BRIGHTEST light reaching it. Call once per frame after
	* moving lights / blockers.
	*/
	compute() {
		this.light.fill(0);
		for (const s of this.lights) {
			if (!this.inBounds(s.col, s.row) || s.radius <= 0) continue;
			const fall = falloffFn(s.falloff ?? this.falloff);
			const i0 = this.index(s.col, s.row);
			if (s.intensity > this.light[i0]) this.light[i0] = s.intensity;
			for (let oct = 0; oct < 8; oct++) this._cast(s.col, s.row, 1, 1, 0, s.radius, MX[oct], MXY[oct], MYX[oct], MY[oct], s.intensity, fall);
		}
		if (this.memory) {
			for (let i = 0; i < this.light.length; i++) if (this.light[i] > .001) this.explored[i] = 1;
		}
	}
	/** @internal One octant of recursive shadowcasting; marks `light` with MAX. */
	_cast(cx, cy, row, startSlope, endSlope, radius, xx, xy, yx, yy, intensity, fall) {
		if (startSlope < endSlope) return;
		const r2 = radius * radius;
		let nextStart = startSlope;
		for (let i = row; i <= radius; i++) {
			let dx = -i - 1, dy = -i;
			let blocked = false;
			while (dx <= 0) {
				dx++;
				const X = cx + dx * xx + dy * xy;
				const Y = cy + dx * yx + dy * yy;
				const lSlope = (dx - .5) / (dy + .5);
				const rSlope = (dx + .5) / (dy - .5);
				if (startSlope < rSlope) continue;
				if (endSlope > lSlope) break;
				const dist2 = dx * dx + dy * dy;
				if (dist2 <= r2 && this.inBounds(X, Y)) {
					const b = intensity * fall(Math.sqrt(dist2) / radius);
					const idx = this.index(X, Y);
					if (b > this.light[idx]) this.light[idx] = b;
				}
				const opaqueHere = this.isOpaque(X, Y);
				if (blocked) {
					if (opaqueHere) {
						nextStart = rSlope;
						continue;
					}
					blocked = false;
					startSlope = nextStart;
				} else if (opaqueHere && i < radius) {
					blocked = true;
					this._cast(cx, cy, i + 1, startSlope, lSlope, radius, xx, xy, yx, yy, intensity, fall);
					nextStart = rSlope;
				}
			}
			if (blocked) break;
		}
	}
	/** Brightness at `(col, row)` this frame, `0`…`1` (`0` = dark). */
	lightAt(col, row) {
		return this.inBounds(col, row) ? this.light[this.index(col, row)] : 0;
	}
	/** Is the cell lit right now? */
	isVisible(col, row) {
		return this.lightAt(col, row) > 0;
	}
	/** Has the cell ever been lit (fog-of-war memory)? */
	isExplored(col, row) {
		return this.inBounds(col, row) && this.explored[this.index(col, row)] === 1;
	}
	/** The cell's fog state: `visible` (lit now), `explored` (remembered), or
	*  `unseen`. With `memory: false`, only `visible` / `unseen`. */
	state(col, row) {
		if (this.isVisible(col, row)) return "visible";
		if (this.memory && this.isExplored(col, row)) return "explored";
		return "unseen";
	}
	/**
	* Direct line-of-sight between two cells — `true` if no opaque cell blocks the
	* line (endpoints excluded). The AI "can the guard see the player?" test,
	* independent of the light field. Pass `range` to also cap the distance.
	*/
	canSee(fromCol, fromRow, toCol, toRow, range = Infinity) {
		const dcol = toCol - fromCol, drow = toRow - fromRow;
		if (dcol * dcol + drow * drow > range * range) return false;
		let x = fromCol, y = fromRow;
		const sx = Math.sign(dcol), sy = Math.sign(drow);
		let adx = Math.abs(dcol), ady = Math.abs(drow);
		let err = adx - ady;
		for (;;) {
			const e2 = 2 * err;
			if (e2 > -ady) {
				err -= ady;
				x += sx;
			}
			if (e2 < adx) {
				err += adx;
				y += sy;
			}
			if (x === toCol && y === toRow) return true;
			if (this.isOpaque(x, y)) return false;
		}
	}
	/** Manually mark a shadowcast FOV around `(col, row)` as explored (reveal a
	*  map region without a persistent light). */
	reveal(col, row, radius) {
		const fall = falloffFn("none");
		const saved = this.light.slice();
		this.light.fill(0);
		if (this.inBounds(col, row)) this.light[this.index(col, row)] = 1;
		for (let oct = 0; oct < 8; oct++) this._cast(col, row, 1, 1, 0, radius, MX[oct], MXY[oct], MYX[oct], MY[oct], 1, fall);
		for (let i = 0; i < this.light.length; i++) if (this.light[i] > 0) this.explored[i] = 1;
		this.light.set(saved);
	}
	/** Mark the whole map explored (reveal the level). */
	revealAll() {
		this.explored.fill(1);
	}
	/** Forget all fog-of-war memory. */
	resetMemory() {
		this.explored.fill(0);
	}
};
//#endregion
//#region src/lib/level.ts
/**
* Populate `scene` from declarative `LevelData`: spawns sprites, builds a `CollisionGrid` from
* the layer named `'collision'`, and creates a `Tilemap` for every other layer.
* Replaces the scene's current sprites and maps — call from `setup()`.
*/
function loadLevel(scene, data) {
	scene.pool.drainAll();
	scene.camera.x = 0;
	scene.camera.y = 0;
	scene.sprites.length = 0;
	for (let i = 0; i < data.sprites.length; i++) {
		const ent = data.sprites[i];
		const s = new ent.type();
		s.x = ent.x;
		s.y = ent.y;
		if (ent.settings) merge(s, ent.settings);
		scene.add(s);
	}
	scene.collisionMap = CollisionGrid.staticNoCollision;
	scene.backgroundMaps = [];
	for (let i = 0; i < data.layer.length; i++) {
		const ld = data.layer[i];
		if (ld.name === "collision") scene.collisionMap = new CollisionGrid(ld.tilesize, ld.data);
		else {
			const newMap = new Tilemap(ld.tilesize, ld.data, ld.firstFrame ?? 0);
			newMap.repeat = !!ld.repeat;
			newMap.distance = ld.distance ?? 1;
			newMap.foreground = !!ld.foreground;
			newMap.name = ld.name;
			scene.backgroundMaps.push(newMap);
		}
	}
}
/**
* Look up a loaded map by its layer `name`. Pass `'collision'` to get the collision grid.
* Returns `null` if no layer with that name exists.
*/
function getMapByName(scene, name) {
	if (name === "collision") return scene.collisionMap;
	for (let i = 0; i < scene.backgroundMaps.length; i++) if (scene.backgroundMaps[i].name === name) return scene.backgroundMaps[i];
	return null;
}
//#endregion
//#region src/lib/effectors.ts
/** @internal Point-in-rectangle test (inclusive). */
function inRect(px, py, x, y, w, h) {
	return px >= x && px <= x + w && py >= y && py <= y + h;
}
/** @internal Move `value` toward `target` by at most `maxStep`. */
function approach(value, target, maxStep) {
	if (value < target) return Math.min(value + maxStep, target);
	if (value > target) return Math.max(value - maxStep, target);
	return value;
}
/** @internal Shed a fraction of both velocity axes (linear drag) for `dt` seconds. */
function applyDrag(sprite, drag, dt) {
	if (drag <= 0) return;
	const k = Math.max(0, 1 - drag * dt);
	sprite.vel.x *= k;
	sprite.vel.y *= k;
}
/**
* Base class for the force-field effectors ({@link AreaEffector}, {@link SurfaceEffector},
* {@link PointEffector}, {@link BuoyancyEffector}). Add one to a scene's physics with
* `this.physics.addEffector(effector)`; each frame it applies a force to the **dynamic**
* bodies inside its region (other body types ignore effectors). Toggle it with `enabled`,
* or restrict which bodies it touches with `filter`.
*/
var Effector = class {
	/** When `false`, the effector is skipped entirely (cheap on/off switch). Default `true`. */
	enabled = true;
	/** Optional predicate — only sprites it returns `true` for are affected. Default: every body in the region. */
	filter;
	/** @internal True when the effector is enabled and its filter (if any) admits this sprite. */
	admits(sprite) {
		return this.enabled && (this.filter === void 0 || this.filter(sprite));
	}
};
/**
* A rectangular zone that pushes the bodies inside it in a constant direction — wind, an updraft,
* a mid-air conveyor, a river current. `force` is an acceleration (like gravity), so every body is
* pushed equally regardless of size. Add an optional `drag` to make it behave like a flowing medium
* (bodies ease toward the flow speed instead of accelerating forever).
*/
var AreaEffector = class extends Effector {
	x;
	y;
	w;
	h;
	/** Acceleration (world units/s²) applied to bodies in the region. Mutate at runtime to change the wind. */
	force;
	/** Linear drag inside the region (fraction of velocity shed per second). */
	drag;
	constructor(opts) {
		super();
		this.x = opts.x;
		this.y = opts.y;
		this.w = opts.w;
		this.h = opts.h;
		this.force = {
			x: opts.force.x,
			y: opts.force.y
		};
		this.drag = opts.drag ?? 0;
		this.filter = opts.filter;
	}
	apply(sprite, dt) {
		if (!this.admits(sprite) || !inRect(sprite.centerX, sprite.centerY, this.x, this.y, this.w, this.h)) return;
		sprite.vel.x += this.force.x * dt;
		sprite.vel.y += this.force.y * dt;
		applyDrag(sprite, this.drag, dt);
	}
};
/**
* A conveyor belt: a zone that carries the bodies in it toward a target horizontal `speed`. Unlike
* {@link AreaEffector} (which keeps accelerating), the surface eases a body's X velocity *to* the
* belt speed and holds it there, so a crate riding the belt travels at belt speed and stops being
* pushed once it matches. Place the region as a thin band over the belt's surface (where the riding
* bodies' centres sit).
*/
var SurfaceEffector = class extends Effector {
	x;
	y;
	w;
	h;
	/** Belt speed along X (world units/s); positive = right. Mutate to reverse or speed up the belt. */
	speed;
	/** Max change to a body's horizontal speed per second (world units/s²). */
	grip;
	constructor(opts) {
		super();
		this.x = opts.x;
		this.y = opts.y;
		this.w = opts.w;
		this.h = opts.h;
		this.speed = opts.speed;
		this.grip = opts.grip ?? 1200;
		this.filter = opts.filter;
	}
	apply(sprite, dt) {
		if (!this.admits(sprite) || !inRect(sprite.centerX, sprite.centerY, this.x, this.y, this.w, this.h)) return;
		sprite.vel.x = approach(sprite.vel.x, this.speed, this.grip * dt);
	}
};
/**
* A point that attracts or repels every body within `radius` — a gravity well, a magnet, a tractor
* beam, or (with a positive `force`) an explosion shockwave. The force points along the line between
* the body and the point; `falloff` controls how it weakens with distance. Move `x`/`y` at runtime
* to drag the well around, or flip `force`'s sign to switch between pulling and pushing.
*/
var PointEffector = class extends Effector {
	x;
	y;
	radius;
	/** Acceleration magnitude (world units/s²); positive repels, negative attracts. */
	force;
	falloff;
	/** Linear drag inside the radius (fraction of velocity shed per second). */
	drag;
	constructor(opts) {
		super();
		this.x = opts.x;
		this.y = opts.y;
		this.radius = opts.radius;
		this.force = opts.force;
		this.falloff = opts.falloff ?? "linear";
		this.drag = opts.drag ?? 0;
		this.filter = opts.filter;
	}
	apply(sprite, dt) {
		if (!this.admits(sprite)) return;
		const dx = sprite.centerX - this.x;
		const dy = sprite.centerY - this.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist === 0 || dist > this.radius) return;
		let scale = 1;
		if (this.falloff === "linear") scale = 1 - dist / this.radius;
		else if (this.falloff === "quadratic") {
			const t = 1 - dist / this.radius;
			scale = t * t;
		}
		const a = this.force * scale * dt / dist;
		sprite.vel.x += dx * a;
		sprite.vel.y += dy * a;
		applyDrag(sprite, this.drag, dt);
	}
};
/**
* A body of fluid (water, lava, slime) that makes the bodies dipping into it float. A submerged body
* gets an upward lift proportional to how deep it is and to `density`, so it decelerates as it sinks,
* rises back, and settles at the surface — `drag` damps the bob into a gentle float. Buoyancy works
* *against gravity*, so the scene needs `physics.gravity > 0`. Add a `flow` for a current that carries
* floating bodies along.
*/
var BuoyancyEffector = class extends Effector {
	x;
	y;
	w;
	h;
	/** Y of the fluid surface. */
	surfaceLevel;
	density;
	/** Fluid resistance (fraction of velocity shed per second while submerged). */
	drag;
	/** Optional current (acceleration, world units/s²) applied while submerged, or `null`. */
	flow;
	constructor(opts) {
		super();
		this.x = opts.x;
		this.y = opts.y;
		this.w = opts.w;
		this.h = opts.h;
		this.surfaceLevel = opts.surfaceLevel ?? opts.y;
		this.density = opts.density ?? 1;
		this.drag = opts.drag ?? 4;
		this.flow = opts.flow ? {
			x: opts.flow.x,
			y: opts.flow.y
		} : null;
		this.filter = opts.filter;
	}
	apply(sprite, dt, physics) {
		if (!this.admits(sprite)) return;
		if (sprite.x + sprite.w <= this.x || sprite.x >= this.x + this.w) return;
		const submerged = sprite.y + sprite.h - this.surfaceLevel;
		if (submerged <= 0) return;
		const frac = Math.min(1, submerged / Math.max(1, sprite.h));
		const g = physics.gravity;
		sprite.vel.y -= this.density * frac * g * dt;
		applyDrag(sprite, this.drag, dt);
		if (this.flow) {
			sprite.vel.x += this.flow.x * dt;
			sprite.vel.y += this.flow.y * dt;
		}
	}
};
//#endregion
//#region src/lib/joints.ts
/** @internal Anchor type guard without a runtime Sprite import (avoids a module cycle) — a v2 sprite always carries `vel`; a plain point never does. */
function isSprite(a) {
	return a.vel !== void 0;
}
/**
* A distance joint from a sprite's centre to an anchor — the arcade rope/rod. `'rope'` mode
* hangs slack and only pulls when taut (grappling hooks, wrecking balls, hanging lamps on
* chains); `'rod'` mode is rigid (stick pendulums). The anchor may be a moving sprite, which
* drags the body along; `length` is live, so shrinking it reels the body in.
*/
var Joint = class {
	/** The body pinned on the end. */
	sprite;
	/** The other end: a world point or a sprite (live — reassign to re-hook). */
	anchor;
	/** Current rope/rod length (world units). Set it to reel in or pay out. */
	length;
	/** `'rope'` (pull-only, slack allowed) or `'rod'` (rigid). */
	mode;
	/** Pin offset from an anchor sprite's centre. */
	offset;
	/** Fraction of speed shed per second while engaged. */
	damping;
	/** When `false`, the joint is skipped entirely (cheap on/off — release and re-grab a grapple). Default `true`. */
	enabled = true;
	/** `true` when the joint pulled this frame (rope at full stretch / rod always). Read for effects — rope tension sounds, sparks. */
	taut = false;
	/** @internal Scratch for anchorPoint() (avoids per-frame allocation). */
	_a = {
		x: 0,
		y: 0
	};
	constructor(opts) {
		this.sprite = opts.sprite;
		this.anchor = opts.anchor;
		this.mode = opts.mode ?? "rope";
		this.offset = opts.offset ? {
			x: opts.offset.x,
			y: opts.offset.y
		} : {
			x: 0,
			y: 0
		};
		this.damping = opts.damping ?? 0;
		if (opts.length !== void 0) this.length = opts.length;
		else {
			const a = this.anchorPoint();
			this.length = Math.hypot(this.sprite.centerX - a.x, this.sprite.centerY - a.y);
		}
	}
	/** World position of the anchored end this frame (an anchor sprite's centre plus `offset`, or the fixed point). The returned object is reused — copy it if you keep it. */
	anchorPoint() {
		if (isSprite(this.anchor)) {
			this._a.x = this.anchor.centerX + this.offset.x;
			this._a.y = this.anchor.centerY + this.offset.y;
		} else {
			this._a.x = this.anchor.x;
			this._a.y = this.anchor.y;
		}
		return this._a;
	}
	/** Current anchor→sprite-centre distance (world units). Compare with `length` to read the slack. */
	distance() {
		const a = this.anchorPoint();
		return Math.hypot(this.sprite.centerX - a.x, this.sprite.centerY - a.y);
	}
	/**
	* Solve one frame: project the sprite back onto the constraint and remove the radial
	* velocity component, relative to the anchor's own velocity, so tangential (swing)
	* motion is preserved. Called by `Physics.updateJoints` each frame between sprite
	* updates and the collision pass; call directly only if you drive the update loop
	* yourself.
	*/
	update(dt) {
		const s = this.sprite;
		const a = this.anchorPoint();
		const dx = s.centerX - a.x;
		const dy = s.centerY - a.y;
		const dist = Math.hypot(dx, dy);
		if (dist < 1e-6) {
			this.taut = false;
			return;
		}
		const over = dist - this.length;
		this.taut = over >= -1e-9;
		const engaged = this.mode === "rod" ? Math.abs(over) > 1e-9 : over > 0;
		const nx = dx / dist;
		const ny = dy / dist;
		if (engaged) {
			s.x -= over * nx;
			s.y -= over * ny;
			const av = isSprite(this.anchor) ? this.anchor.vel : null;
			const rvx = s.vel.x - (av ? av.x : 0);
			const rvy = s.vel.y - (av ? av.y : 0);
			const rad = rvx * nx + rvy * ny;
			if (this.mode === "rod" || rad > 0) {
				s.vel.x -= nx * rad;
				s.vel.y -= ny * rad;
			}
		}
		if (this.damping > 0 && (this.mode === "rod" || this.taut)) {
			const k = Math.max(0, 1 - this.damping * dt);
			s.vel.x *= k;
			s.vel.y *= k;
		}
	}
};
//#endregion
//#region src/lib/glue.ts
function on(aOrName, bOrFn, fn) {
	if (typeof aOrName === "string") return {
		kind: "event",
		name: aOrName,
		fn: bOrFn
	};
	return {
		kind: "hit",
		a: aOrName,
		b: bOrFn,
		fn
	};
}
/**
* Register a SOLID collision pair between sprite classes `a` and `b`: overlapping instances are
* physically resolved each frame — separated along the minimal-penetration axis according to their
* `body` types (dynamic pushed, static immovable, `'none'` skipped), with velocity
* response and `touching` flags handled by the physics. Where `on(A, B)` only *detects*,
* `solid(A, B)` *responds*. Pass `fn` to also react to each resolved contact (damage, sound, …).
* Self pairs (`solid(Crate, Crate)`) make instances push each other apart.
*/
function solid(a, b, fn) {
	return {
		kind: "solid",
		a,
		b,
		fn
	};
}
//#endregion
//#region src/lib/particle-tex.ts
/** Paint a classic particle texture onto a fresh canvas (all white +
* alpha — tint at emit time). */
function particleCanvas(opts = {}) {
	const size = opts.size ?? 64;
	const kind = opts.kind ?? "soft";
	const core = Math.min(1, Math.max(0, opts.core ?? .5));
	const canvas = document.createElement("canvas");
	canvas.width = canvas.height = size;
	const ctx = canvas.getContext("2d");
	const c = size / 2;
	const glow = (coreFrac, alpha = 1) => {
		const g = ctx.createRadialGradient(c, c, 0, c, c, c);
		g.addColorStop(0, `rgba(255,255,255,${alpha})`);
		g.addColorStop(Math.max(.01, coreFrac * .35), `rgba(255,255,255,${alpha * .9})`);
		g.addColorStop(.55, `rgba(255,255,255,${alpha * .25})`);
		g.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = g;
		ctx.fillRect(0, 0, size, size);
	};
	const streak = (angle, len, width, alpha) => {
		ctx.save();
		ctx.translate(c, c);
		ctx.rotate(angle);
		const g = ctx.createLinearGradient(-len, 0, len, 0);
		g.addColorStop(0, "rgba(255,255,255,0)");
		g.addColorStop(.5, `rgba(255,255,255,${alpha})`);
		g.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = g;
		ctx.beginPath();
		ctx.ellipse(0, 0, len, width, 0, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	};
	switch (kind) {
		case "soft":
			glow(core);
			break;
		case "flare":
			glow(core * .8, .9);
			streak(0, c * .98, c * .06, .9);
			streak(Math.PI / 2, c * .98, c * .06, .9);
			glow(.1, .5);
			break;
		case "ring": {
			const g = ctx.createRadialGradient(c, c, 0, c, c, c);
			const mid = .55 + core * .15;
			g.addColorStop(Math.max(0, mid - .28), "rgba(255,255,255,0)");
			g.addColorStop(mid, "rgba(255,255,255,1)");
			g.addColorStop(Math.min(1, mid + .28), "rgba(255,255,255,0)");
			ctx.fillStyle = g;
			ctx.fillRect(0, 0, size, size);
			break;
		}
		case "star": {
			glow(.15, .55);
			const points = opts.points ?? 5;
			const rOut = c * (.5 + core * .3);
			const rIn = rOut * .45;
			ctx.beginPath();
			for (let i = 0; i < points * 2; i++) {
				const r = i % 2 === 0 ? rOut : rIn;
				const a = i / (points * 2) * Math.PI * 2 - Math.PI / 2;
				ctx[i === 0 ? "moveTo" : "lineTo"](c + Math.cos(a) * r, c + Math.sin(a) * r);
			}
			ctx.closePath();
			ctx.fillStyle = "rgba(255,255,255,0.85)";
			ctx.filter = `blur(${Math.max(1, size / 32)}px)`;
			ctx.fill();
			ctx.filter = "none";
			ctx.fill();
			break;
		}
		case "spark":
			streak(0, c * .95, c * .14, 1);
			glow(.1, .35);
			break;
		case "petal": {
			const w = c * .62;
			const tip = c * .86;
			const base = c * .9;
			const notch = c * .22;
			ctx.save();
			ctx.translate(c, c);
			ctx.beginPath();
			ctx.moveTo(0, base);
			ctx.bezierCurveTo(-w * .55, base * .55, -w, -tip * .15, -w * .72, -tip * .72);
			ctx.bezierCurveTo(-w * .55, -tip * .95, -w * .2, -tip, -w * .16, -tip * .98);
			ctx.quadraticCurveTo(0, -tip + notch, w * .16, -tip * .98);
			ctx.bezierCurveTo(w * .2, -tip, w * .55, -tip * .95, w * .72, -tip * .72);
			ctx.bezierCurveTo(w, -tip * .15, w * .55, base * .55, 0, base);
			ctx.closePath();
			const g = ctx.createRadialGradient(0, -tip * .15, 0, 0, 0, c);
			g.addColorStop(0, "rgba(255,255,255,1)");
			g.addColorStop(.55, "rgba(255,255,255,0.92)");
			g.addColorStop(1, "rgba(255,255,255,0.55)");
			ctx.fillStyle = g;
			ctx.filter = `blur(${Math.max(1, size / 64)}px)`;
			ctx.fill();
			ctx.filter = "none";
			ctx.fill();
			ctx.restore();
			break;
		}
	}
	return canvas;
}
//#endregion
//#region src/lib/mccontrols.ts
var HALF_PI = Math.PI / 2 - .02;
/** Is this a touch-first device? (coarse pointer OR a touch API present) */
function coarsePointer() {
	return typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches || typeof navigator !== "undefined" && navigator.maxTouchPoints > 0 || typeof window !== "undefined" && "ontouchstart" in window;
}
/** The 12 edges of a unit cube centred on the origin (±`h`) as polylines —
*  feed to `world.lines()` for a Minecraft-style block outline, then set the
*  shape's x/y/z to the target cell centre. */
function cubeEdges(h = .5) {
	const c = [
		[
			-h,
			-h,
			-h
		],
		[
			h,
			-h,
			-h
		],
		[
			h,
			-h,
			h
		],
		[
			-h,
			-h,
			h
		],
		[
			-h,
			h,
			-h
		],
		[
			h,
			h,
			-h
		],
		[
			h,
			h,
			h
		],
		[
			-h,
			h,
			h
		]
	];
	const e = (a, b) => [c[a], c[b]];
	return [
		e(0, 1),
		e(1, 2),
		e(2, 3),
		e(3, 0),
		e(4, 5),
		e(5, 6),
		e(6, 7),
		e(7, 4),
		e(0, 4),
		e(1, 5),
		e(2, 6),
		e(3, 7)
	];
}
var McControls = class {
	/** Look angles — engine `+Z`-forward convention (see forward()). Read these. */
	yaw;
	pitch;
	/** Move intent in look space, each −1..1: forward (W/joystick up) and strafe
	*  (D/joystick right). Refreshed by poll() each frame. */
	mf = 0;
	ms = 0;
	/** Vertical intent while flying, −1..1 (Space − Shift, or the touch buttons). */
	up = 0;
	/** Space held (walk-mode jump). */
	jumpHeld = false;
	/** Sprinting (Ctrl held, double-tap W, or nothing on touch). */
	sprint = false;
	/** Sneaking (Shift held on foot). */
	sneak = false;
	/** Creative flight — flips with double-tap Space / jump when `canFly`. */
	fly;
	/** Selected hotbar slot (0-based). */
	sel = 0;
	/** Break held this frame (LEFT mouse or a stationary touch-hold). */
	mining = false;
	/** Place active this frame (RIGHT mouse held, or a one-frame touch tap). */
	placing = false;
	/** Mouse/touch look sensitivity, radians per pixel. Live-mutable (a demo
	*  slider binds straight to this). */
	sensitivity;
	/** True once any touch has happened — switches the HUD to the mobile layout. */
	touch = coarsePointer();
	/** True while the desktop pointer is locked (mouse-look live). */
	locked = false;
	game;
	canvas;
	o;
	hotbar;
	moveId = null;
	moveBase = {
		x: 0,
		y: 0
	};
	moveKnob = {
		x: 0,
		y: 0
	};
	lookId = null;
	lookLast = {
		x: 0,
		y: 0
	};
	lookStart = {
		x: 0,
		y: 0
	};
	lookDown = 0;
	lookMoved = false;
	lookBreaking = false;
	placePulse = false;
	breakPulse = false;
	jumpTouch = false;
	downTouch = false;
	lastJumpTap = 0;
	lastWTap = 0;
	sprintLatch = false;
	un = [];
	constructor(game, opts = {}) {
		this.game = game;
		this.canvas = game.canvas;
		this.yaw = opts.yaw ?? 0;
		this.pitch = opts.pitch ?? .1;
		this.hotbar = opts.hotbar ?? null;
		this.fly = (opts.vertical ?? "fly") === "fly";
		this.sensitivity = opts.sensitivity ?? .0022;
		this.o = {
			vertical: opts.vertical ?? "fly",
			canFly: opts.canFly ?? false,
			canBreak: opts.canBreak ?? true,
			canPlace: opts.canPlace ?? false
		};
		this.wire();
	}
	/** A unit forward vector for the current look (for raycasts + camera.face). */
	forward() {
		return forward(this.yaw, this.pitch);
	}
	/** Horizontal wish-velocity for a move speed, from mf/ms about the yaw.
	*  Diagonals are normalised so strafing isn't faster. */
	wish(speed) {
		let f = this.mf, s = this.ms;
		const l = Math.hypot(f, s);
		if (l < 1e-4) return {
			x: 0,
			z: 0
		};
		if (l > 1) {
			f /= l;
			s /= l;
		}
		const sy = Math.sin(this.yaw), cy = Math.cos(this.yaw);
		return {
			x: (-sy * f - cy * s) * speed,
			z: (cy * f - sy * s) * speed
		};
	}
	/** CREATIVE FLIGHT: advance a free `{x,y,z}` eye by the move intent (WASD /
	*  joystick) + vertical (Space/Shift, fly buttons). `speed` is base blocks/s;
	*  sprint doubles it. Pair with `firstPerson(cam, eye)`. */
	flyStep(eye, dt, speed = 20) {
		const s = speed * (this.sprint ? 2 : 1) * dt;
		const w = this.wish(s);
		eye.x += w.x;
		eye.z += w.z;
		eye.y += this.up * s;
	}
	/** SURVIVAL WALK: step a `VoxelBody` with the move intent + jump (gravity,
	*  collision and step-up live in the body). Speeds default to Minecraft-ish
	*  sneak 2 / walk 4.5 / run 7 blocks/s. */
	walkStep(body, dt, speeds = {}) {
		const spd = this.sneak ? speeds.sneak ?? 2 : this.sprint ? speeds.run ?? 7 : speeds.walk ?? 4.5;
		const w = this.wish(spd);
		body.step(dt, w.x, w.z, this.jumpHeld);
	}
	/** FIRST-PERSON camera: eye = `eye`, looking along the current yaw/pitch. */
	firstPerson(cam, eye) {
		cam.x = eye.x;
		cam.y = eye.y;
		cam.z = eye.z;
		cam.face(this.yaw, this.pitch);
	}
	/** THIRD-PERSON camera: pull the eye `dist` back along the look ray from
	*  `target` (the player's head) and aim at it; `lift` raises the eye. */
	thirdPerson(cam, target, dist, lift = .6) {
		const f = this.forward();
		cam.x = target.x - f.x * dist;
		cam.y = target.y - f.y * dist + lift;
		cam.z = target.z - f.z * dist;
		cam.lookAt(target.x, target.y, target.z);
	}
	/** Read keyboard + touch into the continuous intent fields. Call once at the
	*  top of the frame BEFORE using wish()/jumpHeld/up. */
	poll() {
		const g = this.game;
		if (this.moveId !== null) {
			const R = this.joyRadius();
			let dx = (this.moveKnob.x - this.moveBase.x) / R;
			let dy = (this.moveKnob.y - this.moveBase.y) / R;
			const l = Math.hypot(dx, dy);
			if (l > 1) {
				dx /= l;
				dy /= l;
			}
			this.ms = dx;
			this.mf = -dy;
		} else {
			let f = 0, s = 0;
			if (g.input.key("KeyW", "ArrowUp")) f += 1;
			if (g.input.key("KeyS", "ArrowDown")) f -= 1;
			if (g.input.key("KeyD", "ArrowRight")) s += 1;
			if (g.input.key("KeyA", "ArrowLeft")) s -= 1;
			this.mf = f;
			this.ms = s;
		}
		this.sneak = g.input.key("ShiftLeft", "ShiftRight") || !this.fly && this.downTouch;
		if (!g.input.key("KeyW", "ArrowUp")) this.sprintLatch = false;
		this.sprint = g.input.key("ControlLeft", "ControlRight") || this.sprintLatch;
		if (this.fly) {
			this.up = Math.max(-1, Math.min(1, (g.input.key("Space") ? 1 : 0) - (g.input.key("ShiftLeft", "ShiftRight") ? 1 : 0) + (this.jumpTouch ? 1 : 0) - (this.downTouch ? 1 : 0)));
			this.jumpHeld = false;
		} else {
			this.up = 0;
			this.jumpHeld = g.input.key("Space") || this.jumpTouch;
		}
		if (this.lookId !== null && !this.lookMoved && this.o.canBreak && performance.now() - this.lookDown > 220) this.lookBreaking = true;
		this.mining = this.locked && this.mouseLeft || this.lookBreaking || this.breakPulse;
		this.placing = this.locked && this.mouseRight || this.placePulse;
		this.breakPulse = false;
		this.placePulse = false;
	}
	mouseLeft = false;
	mouseRight = false;
	wire() {
		const cv = this.canvas;
		const on = (el, ev, fn, o) => {
			el.addEventListener(ev, fn, o);
			this.un.push(() => el.removeEventListener(ev, fn));
		};
		on(cv, "mousedown", (e) => {
			if (this.touch) return;
			if (!this.locked) {
				cv.requestPointerLock?.();
				return;
			}
			if (e.button === 0) this.mouseLeft = true;
			if (e.button === 2) this.mouseRight = true;
		});
		on(window, "mouseup", (e) => {
			if (e.button === 0) this.mouseLeft = false;
			if (e.button === 2) this.mouseRight = false;
		});
		on(cv, "contextmenu", (e) => e.preventDefault());
		on(document, "pointerlockchange", () => {
			this.locked = document.pointerLockElement === cv;
			if (!this.locked) this.mouseLeft = this.mouseRight = false;
		});
		on(document, "mousemove", (e) => {
			if (!this.locked) return;
			this.yaw += e.movementX * this.sensitivity;
			this.pitch = Math.max(-HALF_PI, Math.min(HALF_PI, this.pitch + e.movementY * this.sensitivity));
		});
		on(cv, "wheel", (e) => {
			if (!this.hotbar) return;
			e.preventDefault();
			const n = this.hotbar.names.length;
			this.sel = (this.sel + (e.deltaY > 0 ? 1 : -1) + n) % n;
		}, { passive: false });
		on(window, "keydown", (e) => {
			const t = e.target;
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
			if (this.hotbar) {
				const n = parseInt(e.key, 10);
				if (n >= 1 && n <= this.hotbar.names.length) this.sel = n - 1;
			}
			if (e.code === "KeyW" && !e.repeat) {
				const now = performance.now();
				if (now - this.lastWTap < 300) this.sprintLatch = true;
				this.lastWTap = now;
			}
			if (e.code === "Space" && !e.repeat && this.o.canFly) {
				const now = performance.now();
				if (now - this.lastSpaceTap < 300) this.fly = !this.fly;
				this.lastSpaceTap = now;
			}
		});
		on(cv, "touchstart", (e) => this.onTouchStart(e), { passive: false });
		on(cv, "touchmove", (e) => this.onTouchMove(e), { passive: false });
		on(cv, "touchend", (e) => this.onTouchEnd(e), { passive: false });
		on(cv, "touchcancel", (e) => this.onTouchEnd(e), { passive: false });
	}
	lastSpaceTap = 0;
	/** Convert a Touch's page point into engine view coords (matches the HUD). */
	toView(t) {
		return this.game.input.toWorld({
			clientX: t.clientX,
			clientY: t.clientY
		});
	}
	joyRadius() {
		return Math.min(this.game.view.w, this.game.view.h) * .13;
	}
	onTouchStart(e) {
		e.preventDefault();
		this.touch = true;
		const g = this.game;
		for (const t of Array.from(e.changedTouches)) {
			const p = this.toView(t);
			const btn = this.hitButton(p);
			if (btn === "jump") {
				this.jumpTouch = true;
				const now = performance.now();
				if (this.o.canFly && now - this.lastJumpTap < 300) this.fly = !this.fly;
				this.lastJumpTap = now;
				continue;
			}
			if (btn === "down") {
				this.downTouch = true;
				continue;
			}
			const slot = this.hitHotbar(p);
			if (slot >= 0) {
				this.sel = slot;
				continue;
			}
			if (this.moveId === null && p.x < g.view.w * .5) {
				this.moveId = t.identifier;
				this.moveBase = {
					x: p.x,
					y: p.y
				};
				this.moveKnob = {
					x: p.x,
					y: p.y
				};
				continue;
			}
			if (this.lookId === null) {
				this.lookId = t.identifier;
				this.lookLast = {
					x: p.x,
					y: p.y
				};
				this.lookStart = {
					x: p.x,
					y: p.y
				};
				this.lookDown = performance.now();
				this.lookMoved = false;
				this.lookBreaking = false;
			}
		}
	}
	onTouchMove(e) {
		e.preventDefault();
		for (const t of Array.from(e.changedTouches)) {
			const p = this.toView(t);
			if (t.identifier === this.moveId) {
				this.moveKnob = {
					x: p.x,
					y: p.y
				};
				continue;
			}
			if (t.identifier === this.lookId) {
				const scale = this.canvas.clientHeight / Math.max(1, this.game.view.h);
				this.yaw += (p.x - this.lookLast.x) * scale * this.sensitivity;
				this.pitch = Math.max(-HALF_PI, Math.min(HALF_PI, this.pitch + (p.y - this.lookLast.y) * scale * this.sensitivity));
				this.lookLast = {
					x: p.x,
					y: p.y
				};
				if (Math.hypot(p.x - this.lookStart.x, p.y - this.lookStart.y) > this.game.view.h * .02) {
					this.lookMoved = true;
					this.lookBreaking = false;
				}
			}
		}
	}
	onTouchEnd(e) {
		e.preventDefault();
		for (const t of Array.from(e.changedTouches)) if (t.identifier === this.moveId) {
			this.moveId = null;
			this.mf = this.ms = 0;
		} else if (t.identifier === this.lookId) {
			if (!this.lookMoved && !this.lookBreaking) {
				if (this.o.canPlace) this.placePulse = true;
				else if (this.o.canBreak) this.breakPulse = true;
			}
			this.lookId = null;
			this.lookBreaking = false;
		}
		if (e.touches.length === 0) {
			this.jumpTouch = false;
			this.downTouch = false;
		}
	}
	/** Draw the crosshair, hotbar, and (on touch) the on-screen controls. Call
	*  inside the run() draw callback. `t` is the game clock for the crosshair pulse. */
	drawHud(d, t, font) {
		const g = this.game, W = g.view.w, H = g.view.h;
		const cx = W * .5, cy = H * .5;
		const s = H * .016, w = H * .0035;
		const a = .65 + Math.sin(t * 4) * .1;
		d.rect(cx - s, cy - w, s * 2, w * 2, `rgba(255,255,255,${a})`);
		d.rect(cx - w, cy - s, w * 2, s * 2, `rgba(255,255,255,${a})`);
		if (this.hotbar) this.drawHotbar(d, font);
		if (this.touch) this.drawTouch(d);
		else if (!this.locked && font) d.text(font, "CLICK TO LOOK", cx, H * .6, {
			align: "center",
			scale: H * .05 / font.lineHeight,
			color: "#dfe6ff",
			alpha: .9
		});
	}
	drawHotbar(d, font) {
		const hb = this.hotbar;
		const g = this.game, W = g.view.w, H = g.view.h;
		const n = hb.names.length;
		const cell = Math.min(H * .11, W / (n + 1));
		const pad = cell * .14, gap = cell * .06;
		const total = n * cell;
		const x0 = (W - total) / 2, y = H - cell - H * .03;
		d.rect(x0 - pad, y - pad, total + pad * 2, cell + pad * 2, "rgba(12,15,29,0.72)");
		for (let i = 0; i < n; i++) {
			const x = x0 + i * cell;
			const on = i === this.sel;
			d.rect(x + gap, y + gap, cell - gap * 2, cell - gap * 2, "rgba(0,0,0,0.35)");
			d.rect(x + pad, y + pad, cell - pad * 2, cell - pad * 2, hb.colors[i]);
			if (on) {
				const b = cell * .08;
				for (const [rx, ry, rw, rh] of [
					[
						x,
						y,
						cell,
						b
					],
					[
						x,
						y + cell - b,
						cell,
						b
					],
					[
						x,
						y,
						b,
						cell
					],
					[
						x + cell - b,
						y,
						b,
						cell
					]
				]) d.rect(rx, ry, rw, rh, "#ffffff", .95);
			}
			if (font) d.text(font, String(i + 1), x + cell * .1, y + cell * .08, {
				scale: cell * .3 / font.lineHeight,
				color: "#e6ebff",
				alpha: .9
			});
		}
		if (font) d.text(font, hb.names[this.sel], W / 2, y - H * .07, {
			align: "center",
			scale: H * .045 / font.lineHeight,
			color: "#eef2ff"
		});
	}
	/** Positions for the on-screen buttons (also used for hit-testing). */
	buttons() {
		const W = this.game.view.w, H = this.game.view.h;
		const r = H * .09;
		return {
			jump: {
				x: W - r * 2.2,
				y: H - r * 2.4,
				r
			},
			down: {
				x: W - r * 4.6,
				y: H - r * 1.6,
				r: r * .82
			}
		};
	}
	hitButton(p) {
		const { jump, down } = this.buttons();
		if (Math.hypot(p.x - jump.x, p.y - jump.y) <= jump.r) return "jump";
		if (down && Math.hypot(p.x - down.x, p.y - down.y) <= down.r) return "down";
		return null;
	}
	hitHotbar(p) {
		if (!this.hotbar) return -1;
		const W = this.game.view.w, H = this.game.view.h;
		const n = this.hotbar.names.length;
		const cell = Math.min(H * .11, W / (n + 1));
		const x0 = (W - n * cell) / 2, y = H - cell - H * .03;
		if (p.y < y - cell * .3 || p.y > y + cell * 1.3) return -1;
		const i = Math.floor((p.x - x0) / cell);
		return i >= 0 && i < n ? i : -1;
	}
	drawTouch(d) {
		if (this.moveId !== null) {
			const R = this.joyRadius();
			d.ring(this.moveBase.x, this.moveBase.y, R, R * .06, "#ffffff", .35);
			let dx = this.moveKnob.x - this.moveBase.x, dy = this.moveKnob.y - this.moveBase.y;
			const l = Math.hypot(dx, dy) || 1;
			const k = Math.min(1, l / R);
			d.circle(this.moveBase.x + dx / l * k * R, this.moveBase.y + dy / l * k * R, R * .42, "#ffffff", .5);
		} else {
			const R = this.joyRadius();
			d.ring(this.game.view.w * .18, this.game.view.h - R * 1.6, R, R * .05, "#ffffff", .12);
		}
		const { jump, down } = this.buttons();
		this.drawBtn(d, jump, this.jumpTouch, true);
		if (down) this.drawBtn(d, down, this.downTouch, false);
	}
	drawBtn(d, b, pressed, up) {
		d.circle(b.x, b.y, b.r, "#0c0f1d", pressed ? .7 : .42);
		d.ring(b.x, b.y, b.r, b.r * .08, "#ffffff", pressed ? .85 : .45);
		const s = b.r * .4, lw = b.r * .13;
		const yTip = up ? b.y - s * .5 : b.y + s * .5;
		const yBase = up ? b.y + s * .5 : b.y - s * .5;
		d.line(b.x - s, yBase, b.x, yTip, lw, "#ffffff", .9);
		d.line(b.x + s, yBase, b.x, yTip, lw, "#ffffff", .9);
	}
	/** Unwire every listener + release the pointer. */
	detach() {
		for (const fn of this.un) fn();
		this.un.length = 0;
		if (this.locked) document.exitPointerLock?.();
	}
};
/** Convenience factory mirroring the engine's `world.orbit()` call style. */
function mcControls(game, opts = {}) {
	return new McControls(game, opts);
}
//#endregion
//#region src/lib/physics2d.ts
var idKey$1 = (id) => id.index1 + ":" + id.generation;
/** @internal Bodies that drive nothing visible (chains, loose capsules) still
*  need a target object; this stands in so the sync loop stays branch-free. */
var CHAIN_TARGET = {
	x: 0,
	y: 0,
	rot: 0,
	scale: 1
};
async function loadCore$1(explicit) {
	const candidates = (explicit ? [explicit] : [
		"./physics2d-core.mjs",
		"../physics2d-core.mjs",
		"../../vendor/physics2d-core.mjs"
	]).map((p) => new URL(p, import.meta.url).href);
	let lastErr = null;
	for (const url of candidates) try {
		return await (await import(
			/* @vite-ignore */
			url
)).default();
	} catch (e) {
		lastErr = e;
	}
	throw new Error("Physics2d: physics core module not found (physics2d-core.mjs). " + String(lastErr));
}
/**
* A physics body driving (dynamic) or moved-by (kinematic/static) a sprite. Get
* one from `world.bind(sprite, ...)`. Steer dynamic bodies with
* `impulse`/`force`/`velocity`; read `velocity`/`mass`; break with `destroy()`.
*/
var Body2d = class {
	/**
	* The sprite this body drives (dynamic) or follows (kinematic/static).
	*
	* `undefined` on a body bound to a VECTOR SHAPE — check `shape` instead, or
	* `target` for whichever it is.
	*/
	sprite;
	/** The vector shape this body drives, if it was bound with `bindShape`. */
	shape;
	/** Whichever of the two this body drives — `sprite` or `shape`. */
	target;
	/** `'sprite'` (top-left anchored, needs the half-size offset) or `'shape'`
	*  (origin-centred, the body pose maps straight on). */
	kind;
	/** `'dynamic' | 'static' | 'kinematic'`. */
	type;
	/** Contact started (approach speed in units/s). Assign any time. */
	onHit = null;
	/** Contact began / ended (any speed). */
	onTouch = null;
	onRelease = null;
	/** Trigger callbacks (trigger bodies). */
	onEnter = null;
	onExit = null;
	/** @internal */ _body;
	/** @internal */ _world;
	/** @internal Half the sprite hitbox at bind time — offsets centre↔top-left on sync. */
	_halfW;
	/** @internal */ _halfH;
	/** @internal Set once destroyed — every later call is a safe no-op. */
	_dead = false;
	/** @internal Pose history for render interpolation: [cx, cy, angle] at the previous and latest fixed step (screen units / screen radians). */
	_pose0 = /* @__PURE__ */ new Float32Array(3);
	_pose1 = /* @__PURE__ */ new Float32Array(3);
	/** @internal */
	constructor(w, body, target, type, kind = "sprite") {
		this._world = w;
		this._body = body;
		this.target = target;
		this.kind = kind;
		this.type = type;
		if (kind === "sprite") {
			const sp = target;
			this.sprite = sp;
			this._halfW = sp.w / 2;
			this._halfH = sp.h / 2;
		} else {
			this.shape = target;
			this._halfW = 0;
			this._halfH = 0;
		}
	}
	/** @internal Write a world pose onto whichever target this body drives. */
	_writePose(cx, cy, angle) {
		if (this.kind === "sprite") {
			this.sprite.x = cx - this._halfW;
			this.sprite.y = cy - this._halfH;
			this.sprite.rot = angle;
		} else {
			const sh = this.shape;
			sh.x = cx;
			sh.y = cy;
			sh.rot = angle;
		}
	}
	/** Current velocity in units/s (screen space). */
	get velocity() {
		const v = this._world._b2.b2Body_GetLinearVelocity(this._body);
		const out = {
			x: this._world._fromBox(v.x),
			y: -this._world._fromBox(v.y)
		};
		v.delete();
		return out;
	}
	set velocity(v) {
		const w = this._world, b2 = w._b2;
		w._scratch.Set(w._toBox(v.x), -w._toBox(v.y));
		b2.b2Body_SetLinearVelocity(this._body, w._scratch);
		b2.b2Body_SetAwake(this._body, true);
	}
	/** Angular velocity in rad/s (screen-clockwise positive). */
	get spin() {
		return -this._world._b2.b2Body_GetAngularVelocity(this._body);
	}
	set spin(v) {
		const b2 = this._world._b2;
		b2.b2Body_SetAngularVelocity(this._body, -v);
		b2.b2Body_SetAwake(this._body, true);
	}
	/** The body's mass. */
	get mass() {
		return this._world._b2.b2Body_GetMass(this._body);
	}
	/**
	* Instant kick in units/s (screen space): `impulse({y: -400})` pops the body
	* upward, scaled by mass so the same call gives the same launch speed whatever
	* the body weighs. Pass `at` (world point) to also spin it — off-centre hits
	* tumble.
	*/
	impulse(v, at) {
		const w = this._world, b2 = w._b2;
		const m = this.mass || 1;
		w._scratch.Set(w._toBox((v.x ?? 0) * m), -w._toBox((v.y ?? 0) * m));
		if (at) {
			w._scratch2.Set(w._toBox(at.x), -w._toBox(at.y));
			b2.b2Body_ApplyLinearImpulse(this._body, w._scratch, w._scratch2, true);
		} else b2.b2Body_ApplyLinearImpulseToCenter(this._body, w._scratch, true);
	}
	/** Continuous push in units/s² (accumulates until the next step) — thrusters, wind. Mass-scaled like `impulse`. */
	force(v) {
		const w = this._world, b2 = w._b2;
		const m = this.mass || 1;
		w._scratch.Set(w._toBox((v.x ?? 0) * m), -w._toBox((v.y ?? 0) * m));
		b2.b2Body_ApplyForceToCenter(this._body, w._scratch, true);
	}
	/**
	* Spin the body: **angular acceleration in rad/s²**, screen-clockwise
	* positive, accumulating until the next step. Wakes the body.
	*
	* Scaled by the body's own rotational inertia, exactly as `force` is scaled
	* by its mass — so the number means the same thing on a pebble and on a
	* chassis, and `torque(4)` reaches 4 rad/s in a second (less whatever
	* `angularDamping` takes back). Raw Box2D torque is in kg·m² and a small
	* sprite's inertia is a fraction of one, so an unscaled value that looks
	* modest spins a light body into a blur.
	*/
	torque(t) {
		const b2 = this._world._b2;
		const i = b2.b2Body_GetRotationalInertia(this._body) || 1;
		b2.b2Body_ApplyTorque(this._body, -t * i, true);
	}
	/** The body's rotational inertia — what `torque` scales by, as `mass` is what
	*  `force` scales by. */
	get inertia() {
		return this._world._b2.b2Body_GetRotationalInertia(this._body);
	}
	/** Instantly move the body (and its sprite) to a world position (its CENTRE) — respawns. Clears velocity. Optional `angle` in screen-clockwise radians. */
	teleport(position, angle = 0) {
		const w = this._world, b2 = w._b2;
		w._scratch.Set(w._toBox(position.x), -w._toBox(position.y));
		const rot = b2.b2MakeRot(-angle);
		b2.b2Body_SetTransform(this._body, w._scratch, rot);
		rot.delete();
		b2.b2Body_SetLinearVelocity(this._body, w._zeroVec);
		b2.b2Body_SetAngularVelocity(this._body, 0);
		b2.b2Body_SetAwake(this._body, true);
		this._writePose(position.x, position.y, angle);
		this._seedPose(position.x, position.y, angle);
	}
	/** @internal Seed both history slots (spawn/teleport — never smear across a jump). */
	_seedPose(cx, cy, angle) {
		this._pose0[0] = this._pose1[0] = cx;
		this._pose0[1] = this._pose1[1] = cy;
		this._pose0[2] = this._pose1[2] = angle;
	}
	/**
	* Remove this body from the world (the sprite stays where it was — kill it
	* separately if you want it gone). Safe to call twice.
	*/
	destroy() {
		if (this._dead) return;
		this._dead = true;
		this._world._removeBody(this);
	}
};
/**
* The physics world. `await Physics2d.create()` once in an async `setup()`, bind
* sprites, attach to the scene (`scene.physics2d = world`) and everything
* else is hands-free — the scene steps and syncs it each frame. All shapes are
* built from each sprite's CURRENT `x/y/w/h` at bind time — place the sprite
* first, bind second.
*/
var Physics2d = class Physics2d {
	/** @internal The core module. */ _b2;
	/** @internal */ world;
	/** @internal world units per simulated metre. */ ppm;
	/** @internal solver sub-steps per frame. */ substeps;
	/** @internal All live bodies by id key (event lookups). */
	bodies = /* @__PURE__ */ new Map();
	/** @internal Sprite → body (rebind guards). */
	bySprite = /* @__PURE__ */ new Map();
	/** @internal Vector shape → body (rebind guards). */
	byShape = /* @__PURE__ */ new Map();
	/** @internal Kinematic bodies (sprite drives body each step). */
	kinematics = [];
	/** @internal Collision group name → category bit. */
	groups = /* @__PURE__ */ new Map();
	/** @internal Family name → negative filter-group index (self-collision off). */
	families = /* @__PURE__ */ new Map();
	/** @internal Active grabs (mouse joints). `lx`/`ly` = the clicked point in the body's local frame (box units). A force-capped velocity servo drives that point to `tx`/`ty`: `gain` sets responsiveness, `vmax` caps the follow speed, `maxAcc` caps the force so a jointed body can't be torn apart. */
	grabs = [];
	/** @internal Fixed-step accumulator. */ acc = 0;
	/** @internal Reusable Box2D vectors (avoid per-call handle allocation). */
	_scratch;
	_scratch2;
	_zeroVec;
	/** Diagnostic: bodies found stale during sync (should stay 0). */
	invalidBodies = 0;
	constructor(b2, world, ppm, substeps) {
		this._b2 = b2;
		this.world = world;
		this.ppm = ppm;
		this.substeps = substeps;
		this._scratch = new b2.b2Vec2(0, 0);
		this._scratch2 = new b2.b2Vec2(0, 0);
		this._zeroVec = new b2.b2Vec2(0, 0);
	}
	/** @internal units → metres (lengths). */ _toBox(px) {
		return px / this.ppm;
	}
	/** @internal metres → units (lengths). */ _fromBox(m) {
		return m * this.ppm;
	}
	/**
	* Load the physics core (first call fetches the ~640 KB chunk; later calls are
	* instant) and create a world. One world per scene is the pattern.
	*/
	static async create(opts = {}) {
		const b2 = await loadCore$1(opts.module);
		const ppm = opts.pixelsPerMeter ?? 32;
		const def = b2.b2DefaultWorldDef();
		const g = opts.gravity ?? 900;
		const gx = typeof g === "number" ? 0 : g.x / ppm;
		const gy = typeof g === "number" ? -g / ppm : -g.y / ppm;
		const gv = new b2.b2Vec2(gx, gy);
		def.gravity = gv;
		const world = b2.b2CreateWorld(def);
		gv.delete();
		def.delete();
		return new Physics2d(b2, world, ppm, Math.max(1, Math.round(opts.substeps ?? 4)));
	}
	/** @internal Category bit for a group name (created on first use, up to 32 groups). */
	groupBit(name) {
		let bit = this.groups.get(name);
		if (bit === void 0) {
			if (this.groups.size >= 31) throw new Error("Physics2d: too many collision groups (max 32).");
			bit = 1 << this.groups.size;
			this.groups.set(name, bit);
		}
		return bit;
	}
	/** @internal Negative filter-group index for a family (same index → never collide). */
	familyIndex(family) {
		let idx = this.families.get(family);
		if (idx === void 0) {
			idx = -(this.families.size + 1);
			this.families.set(family, idx);
		}
		return idx;
	}
	/**
	* Give a sprite a physics body. The shape is built from `sprite.w/h` and
	* `sprite.x/y` as they are RIGHT NOW — place the sprite first. Returns the
	* `Body2d`; dynamic bodies then own the sprite's `x/y` and `rot`.
	*/
	bind(sprite, opts = {}) {
		const existing = this.bySprite.get(sprite);
		if (existing) return existing;
		const b2 = this._b2;
		const type = opts.type ?? "dynamic";
		const def = b2.b2DefaultBodyDef();
		const cx = sprite.x + sprite.w / 2;
		const cy = sprite.y + sprite.h / 2;
		const pos = new b2.b2Vec2(this._toBox(cx), -this._toBox(cy));
		def.position = pos;
		const rot = b2.b2MakeRot(-sprite.rot);
		def.rotation = rot;
		def.type = type === "dynamic" ? b2.b2BodyType.b2_dynamicBody : type === "kinematic" ? b2.b2BodyType.b2_kinematicBody : b2.b2BodyType.b2_staticBody;
		if (opts.bullet) def.isBullet = true;
		if (opts.damping !== void 0) def.linearDamping = opts.damping;
		def.angularDamping = opts.angularDamping ?? .05;
		if (opts.gravityScale !== void 0) def.gravityScale = opts.gravityScale;
		if (opts.fixedRotation) {
			const locks = def.motionLocks;
			locks.angularZ = true;
			def.motionLocks = locks;
		}
		const body = b2.b2CreateBody(this.world, def);
		pos.delete();
		rot.delete();
		def.delete();
		const sd = this._shapeDef(opts);
		let shape = opts.shape ?? "auto";
		if (shape === "auto") shape = "box";
		if (shape === "circle") {
			const r = this._toBox(opts.radius ?? Math.min(sprite.w, sprite.h) / 2);
			const circle = new b2.b2Circle();
			circle.center = this._zeroVec;
			circle.radius = r;
			b2.b2CreateCircleShape(body, sd, circle);
			circle.delete();
		} else {
			const poly = b2.b2MakeBox(this._toBox(sprite.w / 2), this._toBox(sprite.h / 2));
			b2.b2CreatePolygonShape(body, sd, poly);
			poly.delete();
		}
		sd.delete();
		if (opts.balance) {
			const md = b2.b2Body_GetMassData(body);
			const c = new b2.b2Vec2(this._toBox(opts.balance.x), -this._toBox(opts.balance.y));
			md.center = c;
			b2.b2Body_SetMassData(body, md);
			c.delete();
			md.delete?.();
		}
		const b = new Body2d(this, body, sprite, type);
		b.onHit = opts.onHit ?? null;
		b.onTouch = opts.onTouch ?? null;
		b.onRelease = opts.onRelease ?? null;
		b.onEnter = opts.onEnter ?? null;
		b.onExit = opts.onExit ?? null;
		b._seedPose(cx, cy, sprite.rot);
		this.bodies.set(idKey$1(body), b);
		this.bySprite.set(sprite, b);
		if (type === "kinematic") this.kinematics.push(b);
		sprite._body2d = b;
		return b;
	}
	/** The `Body2d` bound to a sprite, or `undefined`. */
	bodyFor(sprite) {
		return this.bySprite.get(sprite);
	}
	/** The `Body2d` bound to a vector shape, or `undefined`. */
	bodyForShape(shape) {
		return this.byShape.get(shape);
	}
	/**
	* Give a VECTOR SHAPE a physics body — line art with real rigid-body
	* physics, which is the pairing the two were always going to make.
	*
	* ```ts
	* const rock = game.vector.shape(vectorKit.generatePolygon(40, 11), { x: 300, y: 120, glow: 0.9 });
	* world.bindShape(rock, { bounce: 0.4, friction: 0.3 });
	* ```
	*
	* A vector shape fits Box2D BETTER than a sprite does: it is already
	* origin-centred with live `x`/`y`/`rot`, so the body pose maps onto it with
	* no offset, where a sprite needs a half-size correction every sync.
	*
	* The outline is taken as it is RIGHT NOW, in the shape's own local frame,
	* with `scale` baked in — place and scale the shape first, bind second.
	* Changing `scale` afterwards moves the drawing and NOT the collision shape;
	* rebind if you need it to follow.
	*
	* Shapes are convex: `'hull'` (the default) takes the convex hull of the
	* outline and reduces it to Box2D's eight-vertex limit, so a jagged
	* eleven-point asteroid still collides as its own silhouette rather than
	* silently becoming a null shape.
	*/
	bindShape(shape, opts = {}) {
		const existing = this.byShape.get(shape);
		if (existing) return existing;
		const b2 = this._b2;
		const type = opts.type ?? "dynamic";
		const scale = shape.scale ?? 1;
		const local = [];
		for (const [a, b] of shape.segs) {
			local.push({
				x: a.x * scale,
				y: a.y * scale
			});
			local.push({
				x: b.x * scale,
				y: b.y * scale
			});
		}
		const def = b2.b2DefaultBodyDef();
		const pos = new b2.b2Vec2(this._toBox(shape.x), -this._toBox(shape.y));
		def.position = pos;
		const rot = b2.b2MakeRot(-shape.rot);
		def.rotation = rot;
		def.type = type === "dynamic" ? b2.b2BodyType.b2_dynamicBody : type === "kinematic" ? b2.b2BodyType.b2_kinematicBody : b2.b2BodyType.b2_staticBody;
		if (opts.bullet) def.isBullet = true;
		if (opts.damping !== void 0) def.linearDamping = opts.damping;
		def.angularDamping = opts.angularDamping ?? .05;
		if (opts.gravityScale !== void 0) def.gravityScale = opts.gravityScale;
		if (opts.fixedRotation) {
			const locks = def.motionLocks;
			locks.angularZ = true;
			def.motionLocks = locks;
		}
		const body = b2.b2CreateBody(this.world, def);
		pos.delete();
		rot.delete();
		def.delete();
		const sd = this._shapeDef(opts);
		const kind = opts.shape ?? "hull";
		if (kind === "circle") {
			let r = opts.radius;
			if (r === void 0) {
				let m = 0;
				for (const p of local) m = Math.max(m, Math.hypot(p.x, p.y));
				r = m || 1;
			}
			const circle = new b2.b2Circle();
			circle.center = this._zeroVec;
			circle.radius = this._toBox(r);
			b2.b2CreateCircleShape(body, sd, circle);
			circle.delete();
		} else if (kind === "box") {
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const p of local) {
				minX = Math.min(minX, p.x);
				maxX = Math.max(maxX, p.x);
				minY = Math.min(minY, p.y);
				maxY = Math.max(maxY, p.y);
			}
			const poly = b2.b2MakeOffsetBox(this._toBox((maxX - minX) / 2 || 1), this._toBox((maxY - minY) / 2 || 1), new b2.b2Vec2(this._toBox((minX + maxX) / 2), -this._toBox((minY + maxY) / 2)), b2.b2MakeRot(0));
			b2.b2CreatePolygonShape(body, sd, poly);
			poly.delete();
		} else if (kind === "decompose") for (const piece of convexPieces(this._ringOf(shape, scale), opts.maxVertices)) this._polygonShape(body, sd, piece);
		else this._polygonShape(body, sd, hullFor(local, opts.maxVertices));
		sd.delete();
		if (opts.balance) {
			const md = b2.b2Body_GetMassData(body);
			const c = new b2.b2Vec2(this._toBox(opts.balance.x), -this._toBox(opts.balance.y));
			md.center = c;
			b2.b2Body_SetMassData(body, md);
			c.delete();
			md.delete?.();
		}
		const b = new Body2d(this, body, shape, type, "shape");
		b.onHit = opts.onHit ?? null;
		b.onTouch = opts.onTouch ?? null;
		b.onRelease = opts.onRelease ?? null;
		b.onEnter = opts.onEnter ?? null;
		b.onExit = opts.onExit ?? null;
		b._seedPose(shape.x, shape.y, shape.rot);
		this.bodies.set(idKey$1(body), b);
		this.byShape.set(shape, b);
		if (type === "kinematic") this.kinematics.push(b);
		return b;
	}
	/**
	* A STATIC CHAIN body from a polyline — terrain, cave walls, a tube rim, a
	* ring of arcs. This is the shape Box2D wants for one-sided world geometry:
	* no thickness, no mass, and no internal edges for a fast body to catch on.
	*
	* ```ts
	* const ground = vectorKit.generateTerrain({ width: 1400, baseY: 600 });
	* game.vector.shape(ground, { closed: false, color: '#39f0a0' });
	* world.chain(ground, { friction: 0.9 });
	* ```
	*
	* `loop: true` closes it — which is exactly what `web.closed` and a closed
	* `ringSections` ring mean. Returns the body so you can `destroy()` it and
	* rebuild after deforming the line (a crater re-chains that stretch).
	*
	* A chain is ONE-SIDED. Points left-to-right along the top of your terrain
	* gives solid ground below, which is what a heightfield from
	* `generateTerrain` already is. Reverse the order (or the loop's winding) to
	* put the solid side on the other face — a ceiling, or a cave you are inside.
	*/
	chain(points, opts = {}) {
		const b2 = this._b2;
		if (points.length < 2) throw new Error("Physics2d.chain: needs at least two points");
		if (!(opts.loop ?? false) && points.length < 2) throw new Error("Physics2d.chain: an open chain needs at least two points");
		const def = b2.b2DefaultBodyDef();
		def.type = b2.b2BodyType.b2_staticBody;
		const body = b2.b2CreateBody(this.world, def);
		def.delete();
		const loop = opts.loop ?? false;
		const box = (loop ? points.slice() : [
			{
				x: points[0].x * 2 - points[1].x,
				y: points[0].y * 2 - points[1].y
			},
			...points,
			{
				x: points[points.length - 1].x * 2 - points[points.length - 2].x,
				y: points[points.length - 1].y * 2 - points[points.length - 2].y
			}
		]).map((p) => ({
			x: this._toBox(p.x),
			y: -this._toBox(p.y)
		})).reverse();
		const cd = b2.b2DefaultChainDef();
		cd.SetPoints(box);
		cd.count = box.length;
		cd.isLoop = loop;
		const mats = b2.b2DefaultSurfaceMaterial ? [b2.b2DefaultSurfaceMaterial()] : null;
		if (mats) {
			mats[0].friction = opts.friction ?? .6;
			mats[0].restitution = opts.bounce ?? 0;
			cd.SetMaterials(mats);
			cd.materialCount = 1;
		}
		const filter = cd.filter;
		filter.categoryBits = this.groupBit(opts.group ?? "default");
		if (opts.hits) {
			let mask = 0;
			for (const h of opts.hits) mask |= this.groupBit(h);
			filter.maskBits = mask;
		}
		cd.filter = filter;
		b2.b2CreateChain(body, cd);
		cd.delete?.();
		const b = new Body2d(this, body, CHAIN_TARGET, "static", "shape");
		b.onHit = opts.onHit ?? null;
		b.onTouch = opts.onTouch ?? null;
		b.onRelease = opts.onRelease ?? null;
		this.bodies.set(idKey$1(body), b);
		return b;
	}
	/**
	* A CAPSULE body for one thick stroke — a rod, a beam, a girder. The right
	* primitive for a line with width: a two-point polygon is degenerate, and a
	* box has corners a capsule does not.
	*/
	capsule(x0, y0, x1, y1, radius, opts = {}) {
		const b2 = this._b2;
		const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
		const def = b2.b2DefaultBodyDef();
		const type = opts.type ?? "dynamic";
		const pos = new b2.b2Vec2(this._toBox(cx), -this._toBox(cy));
		def.position = pos;
		def.type = type === "dynamic" ? b2.b2BodyType.b2_dynamicBody : type === "kinematic" ? b2.b2BodyType.b2_kinematicBody : b2.b2BodyType.b2_staticBody;
		def.angularDamping = opts.angularDamping ?? .05;
		const body = b2.b2CreateBody(this.world, def);
		pos.delete();
		def.delete();
		const sd = this._shapeDef(opts);
		const cap = new b2.b2Capsule();
		cap.center1 = new b2.b2Vec2(this._toBox(x0 - cx), -this._toBox(y0 - cy));
		cap.center2 = new b2.b2Vec2(this._toBox(x1 - cx), -this._toBox(y1 - cy));
		cap.radius = this._toBox(radius);
		b2.b2CreateCapsuleShape(body, sd, cap);
		cap.delete?.();
		sd.delete();
		const b = new Body2d(this, body, CHAIN_TARGET, type, "shape");
		b.onHit = opts.onHit ?? null;
		b._seedPose(cx, cy, 0);
		this.bodies.set(idKey$1(body), b);
		if (type === "kinematic") this.kinematics.push(b);
		return b;
	}
	/**
	* Draw the whole physics world as LINE ART, through the vector layer.
	*
	* ```ts
	* override draw(d: Draw): void {
	*   super.draw(d);
	*   this.world.debugDraw(this.game.vector);
	* }
	* ```
	*
	* Every shape Box2D is actually simulating, in its actual pose — the fastest
	* way to see that a hull came out the shape you meant, that a chain is on the
	* side you meant, or that a sensor is where you meant. It works for SPRITE
	* bodies too, so an ordinary sprite game gets a glowing collision overlay for
	* one line.
	*
	* Built on the typed shape API (`b2Body_GetShapes` + `b2Shape_GetPolygon` and
	* friends) rather than Box2D's own debug-draw command buffer: that buffer is
	* an undocumented 140-byte packed struct, and reading it means hard-coding
	* offsets that a Box2D bump would silently move.
	*/
	debugDraw(layer, opts = {}) {
		const b2 = this._b2;
		const width = opts.width ?? 1.6;
		const glow = opts.glow ?? .55;
		const awake = opts.color ?? "#39f0a0";
		const asleep = opts.sleepColor ?? "#2b5da0";
		const staticColor = opts.staticColor ?? "#4a6fa5";
		const sides = opts.circleSteps ?? 16;
		for (const body of this.bodies.values()) {
			if (body._dead || !b2.b2Body_IsValid(body._body)) continue;
			const xf = b2.b2Body_GetTransform(body._body);
			const px = this._fromBox(xf.p.x), py = -this._fromBox(xf.p.y);
			const c = xf.q.c, sn = -xf.q.s;
			const style = {
				width,
				glow,
				color: body.type === "static" ? staticColor : b2.b2Body_IsAwake(body._body) ? awake : asleep
			};
			const at = (lx, ly) => {
				const x = this._fromBox(lx), y = -this._fromBox(ly);
				return {
					x: px + x * c - y * sn,
					y: py + x * sn + y * c
				};
			};
			const n = b2.b2Body_GetShapeCount(body._body);
			if (!n) continue;
			for (const sh of b2.b2Body_GetShapes(body._body, n)) {
				const t = String(b2.b2Shape_GetType(sh)?.value ?? b2.b2Shape_GetType(sh));
				const T = b2.b2ShapeType;
				if (t === String(T.b2_polygonShape.value ?? 3)) {
					const poly = b2.b2Shape_GetPolygon(sh);
					const pts = [];
					for (let i = 0; i < poly.count; i++) {
						const v = poly.GetVertex(i);
						pts.push(at(v.x, v.y));
					}
					if (pts.length > 1) layer.poly(pts, style, true);
				} else if (t === String(T.b2_circleShape.value ?? 0)) {
					const ci = b2.b2Shape_GetCircle(sh);
					const o = at(ci.center.x, ci.center.y);
					const r = this._fromBox(ci.radius);
					layer.arc(o.x, o.y, r, 0, Math.PI * 2, style, sides);
					const a = Math.atan2(sn, c);
					layer.seg(o.x, o.y, o.x + Math.cos(a) * r, o.y + Math.sin(a) * r, style);
				} else if (t === String(T.b2_capsuleShape.value ?? 1)) {
					const cap = b2.b2Shape_GetCapsule(sh);
					const a = at(cap.center1.x, cap.center1.y);
					const b = at(cap.center2.x, cap.center2.y);
					const r = this._fromBox(cap.radius);
					const ang = Math.atan2(b.y - a.y, b.x - a.x);
					const nx = -Math.sin(ang) * r, ny = Math.cos(ang) * r;
					layer.seg(a.x + nx, a.y + ny, b.x + nx, b.y + ny, style);
					layer.seg(a.x - nx, a.y - ny, b.x - nx, b.y - ny, style);
					layer.arc(a.x, a.y, r, ang + Math.PI / 2, ang + Math.PI * 1.5, style, sides / 2);
					layer.arc(b.x, b.y, r, ang - Math.PI / 2, ang + Math.PI / 2, style, sides / 2);
				} else {
					const seg = t === String(T.b2_chainSegmentShape.value ?? 4) ? b2.b2Shape_GetChainSegment(sh)?.segment : b2.b2Shape_GetSegment(sh);
					if (seg) {
						const a = at(seg.point1.x, seg.point1.y);
						const b = at(seg.point2.x, seg.point2.y);
						layer.seg(a.x, a.y, b.x, b.y, style);
					}
				}
			}
		}
	}
	/** @internal One convex polygon from LOCAL points (y flipped into Box2D's
	*  y-up frame). Silently does nothing if the hull degenerates. */
	_polygonShape(body, sd, pts) {
		const b2 = this._b2;
		if (pts.length < 3) return;
		const hull = b2.b2ComputeHull(pts.map((p) => ({
			x: this._toBox(p.x),
			y: -this._toBox(p.y)
		})));
		if (!hull || hull.count < 3) {
			hull?.delete?.();
			return;
		}
		const poly = b2.b2MakePolygon(hull, 0);
		b2.b2CreatePolygonShape(body, sd, poly);
		poly.delete?.();
		hull.delete?.();
	}
	/** @internal The shared shape definition — material, filters, events. */
	_shapeDef(opts) {
		const sd = this._b2.b2DefaultShapeDef();
		sd.density = opts.density ?? 1;
		const mat = sd.material;
		mat.friction = opts.friction ?? .6;
		mat.restitution = opts.bounce ?? 0;
		sd.material = mat;
		sd.enableContactEvents = true;
		sd.enableHitEvents = true;
		sd.enableSensorEvents = true;
		if (opts.trigger) sd.isSensor = true;
		const filter = sd.filter;
		filter.categoryBits = this.groupBit(opts.group ?? "default");
		if (opts.hits) {
			let mask = 0;
			for (const h of opts.hits) mask |= this.groupBit(h);
			filter.maskBits = mask;
		}
		if (opts.family) filter.groupIndex = this.familyIndex(opts.family);
		sd.filter = filter;
		return sd;
	}
	/**
	* Cast a ray from `from` to `to` (both world space); returns the nearest body
	* hit, or `null`. Line-of-sight, laser sights, ground probes.
	*/
	raycast(from, to) {
		const b2 = this._b2;
		const origin = new b2.b2Vec2(this._toBox(from.x), -this._toBox(from.y));
		const translation = new b2.b2Vec2(this._toBox(to.x - from.x), -this._toBox(to.y - from.y));
		const filter = b2.b2DefaultQueryFilter();
		const res = b2.b2World_CastRayClosest(this.world, origin, translation, filter);
		let out = null;
		if (res.hit) {
			const body = this.bodies.get(idKey$1(b2.b2Shape_GetBody(res.shapeId)));
			if (body) {
				const p = res.point, n = res.normal;
				const px = this._fromBox(p.x), py = -this._fromBox(p.y);
				out = {
					body,
					point: {
						x: px,
						y: py
					},
					normal: {
						x: n.x,
						y: -n.y
					},
					distance: Math.hypot(px - from.x, py - from.y)
				};
			}
		}
		origin.delete();
		translation.delete();
		filter.delete?.();
		res.delete?.();
		return out;
	}
	/**
	* A radial explosion at `at` (world space) within `radius` units, kicking every
	* dynamic body outward with `strength` (impulse per unit of overlap). Barrels,
	* bombs, shockwaves.
	*/
	explosion(at, radius, strength) {
		const b2 = this._b2;
		const def = b2.b2DefaultExplosionDef();
		const p = new b2.b2Vec2(this._toBox(at.x), -this._toBox(at.y));
		def.position = p;
		def.radius = this._toBox(radius);
		def.falloff = this._toBox(radius) * .5;
		def.impulsePerLength = strength;
		b2.b2World_Explode(this.world, def);
		p.delete();
		def.delete();
	}
	/** A revolute joint (hinge / pivot) between two bodies — see-saws, ragdoll joints, powered wheels, doors. */
	pin(a, b, opts = {}) {
		const b2 = this._b2;
		const def = b2.b2DefaultRevoluteJointDef();
		const base = def.base;
		base.bodyIdA = a._body;
		base.bodyIdB = b._body;
		const at = opts.at ?? this._midpoint(a, b);
		this._setLocalAnchors(base, a, b, at, at);
		def.base = base;
		if (opts.limits) {
			def.enableLimit = true;
			def.lowerAngle = -opts.limits[1];
			def.upperAngle = -opts.limits[0];
		}
		if (opts.motorSpeed !== void 0 && opts.maxTorque !== void 0) {
			def.enableMotor = true;
			def.motorSpeed = -opts.motorSpeed;
			def.maxMotorTorque = opts.maxTorque;
		}
		const id = b2.b2CreateRevoluteJoint(this.world, def);
		def.delete();
		return this._joint(id, "revolute", a, b);
	}
	/** A distance joint (rigid rod by default, or a slack rope / bouncy spring) between two bodies. */
	rope(a, b, opts = {}) {
		const b2 = this._b2;
		const def = b2.b2DefaultDistanceJointDef();
		const base = def.base;
		base.bodyIdA = a._body;
		base.bodyIdB = b._body;
		const atA = opts.atA ?? this._center(a);
		const atB = opts.atB ?? this._center(b);
		this._setLocalAnchors(base, a, b, atA, atB);
		def.base = base;
		const len = opts.length !== void 0 ? this._toBox(opts.length) : this._toBox(Math.hypot(atB.x - atA.x, atB.y - atA.y));
		def.length = Math.max(len, .005);
		if (opts.range) {
			def.enableLimit = true;
			def.minLength = Math.max(this._toBox(opts.range[0]), .005);
			def.maxLength = Math.max(this._toBox(opts.range[1]), def.minLength);
		}
		if (opts.hertz) {
			def.enableSpring = true;
			def.hertz = opts.hertz;
			def.dampingRatio = opts.damping ?? .5;
		}
		const id = b2.b2CreateDistanceJoint(this.world, def);
		def.delete();
		return this._joint(id);
	}
	/** A prismatic joint (slider): body B may only move along one axis relative to body A — pistons, elevators, sliding doors. */
	slider(a, b, opts = {}) {
		const b2 = this._b2;
		const def = b2.b2DefaultPrismaticJointDef();
		const base = def.base;
		base.bodyIdA = a._body;
		base.bodyIdB = b._body;
		const at = this._center(b);
		const ax = opts.axis ?? {
			x: 1,
			y: 0
		};
		const len = Math.hypot(ax.x, ax.y) || 1;
		const worldAngle = Math.atan2(-ax.y / len, ax.x / len);
		this._setLocalAnchors(base, a, b, at, at, worldAngle);
		def.base = base;
		if (opts.limits) {
			def.enableLimit = true;
			def.lowerTranslation = this._toBox(opts.limits[0]);
			def.upperTranslation = this._toBox(opts.limits[1]);
		}
		if (opts.motorSpeed !== void 0 && opts.maxForce !== void 0) {
			def.enableMotor = true;
			def.motorSpeed = this._toBox(opts.motorSpeed);
			def.maxMotorForce = opts.maxForce;
		}
		const id = b2.b2CreatePrismaticJoint(this.world, def);
		def.delete();
		return this._joint(id, "prismatic", a, b);
	}
	/** A weld joint: locks two bodies rigidly together (breakable structures, compound bodies). */
	weld(a, b, at) {
		const b2 = this._b2;
		const def = b2.b2DefaultWeldJointDef();
		const base = def.base;
		base.bodyIdA = a._body;
		base.bodyIdB = b._body;
		const p = at ?? this._midpoint(a, b);
		this._setLocalAnchors(base, a, b, p, p);
		def.base = base;
		const id = b2.b2CreateWeldJoint(this.world, def);
		def.delete();
		return this._joint(id);
	}
	/**
	* A wheel joint — a spring-suspension axle for a vehicle. The wheel body
	* travels along `axis` (the suspension, default vertical) against a spring and
	* spins freely, with an optional drive motor. THE way to build a car: the
	* chassis floats on the springs above the wheels, so bumps are absorbed and the
	* body stays level — unlike a rigid `pin` axle, which fights every torque and
	* judders. Drive it live via the returned joint's `motor(speed, torque)`.
	*/
	wheel(a, b, opts) {
		const b2 = this._b2;
		const def = b2.b2DefaultWheelJointDef();
		const base = def.base;
		base.bodyIdA = a._body;
		base.bodyIdB = b._body;
		const ax = opts.axis ?? {
			x: 0,
			y: 1
		};
		const len = Math.hypot(ax.x, ax.y) || 1;
		const worldAngle = Math.atan2(-ax.y / len, ax.x / len);
		this._setLocalAnchors(base, a, b, opts.at, opts.at, worldAngle);
		def.base = base;
		def.enableSpring = true;
		def.hertz = opts.hertz ?? 4;
		def.dampingRatio = opts.damping ?? .7;
		if (opts.travel) {
			def.enableLimit = true;
			def.lowerTranslation = this._toBox(opts.travel[0]);
			def.upperTranslation = this._toBox(opts.travel[1]);
		}
		if (opts.motorSpeed !== void 0 && opts.maxTorque !== void 0) {
			def.enableMotor = true;
			def.motorSpeed = -opts.motorSpeed;
			def.maxMotorTorque = opts.maxTorque;
		}
		const id = b2.b2CreateWheelJoint(this.world, def);
		def.delete();
		return this._joint(id, "wheel", a, b);
	}
	/**
	* Grab a body and drag it toward a moving target point — a mouse / touch joint.
	* Returns a handle: call `moveTo(point)` each frame with the pointer, and
	* `release()` to let go (the body keeps its velocity, so a moving release throws
	* it). Grab a ragdoll limb and the joints drag the rest along.
	*/
	grab(body, at, opts = {}) {
		const b2 = this._b2;
		const wa = new b2.b2Vec2(this._toBox(at.x), -this._toBox(at.y));
		const la = b2.b2Body_GetLocalPoint(body._body, wa);
		const s = opts.strength ?? 1;
		const stiff = opts.stiff !== false;
		const g = {
			body,
			tx: at.x,
			ty: at.y,
			lx: la.x,
			ly: la.y,
			gain: stiff ? 18 : 9,
			vmax: stiff ? 3200 : 1500 * s,
			maxAcc: stiff ? 13e3 : 5e3 * s
		};
		wa.delete();
		la.delete?.();
		this.grabs.push(g);
		const self = this;
		return {
			moveTo(point) {
				g.tx = point.x;
				g.ty = point.y;
			},
			release() {
				const i = self.grabs.indexOf(g);
				if (i >= 0) self.grabs.splice(i, 1);
			}
		};
	}
	/**
	* @internal Drive each active grab (once per step). A mouse joint as a
	* force-capped VELOCITY SERVO: aim the clicked point's velocity straight at the
	* target (so it tracks with little lag and settles cleanly, no spring
	* oscillation), and apply the force AT THAT POINT (so the body rotates to
	* follow) with the acceleration capped so a jointed body is never torn apart.
	*/
	_applyGrabs() {
		const b2 = this._b2, ppm = this.ppm;
		for (const g of this.grabs) {
			const b = g.body;
			if (b._dead) continue;
			this._scratch.Set(g.lx, g.ly);
			const wp = b2.b2Body_GetWorldPoint(b._body, this._scratch);
			const pv = b2.b2Body_GetWorldPointVelocity(b._body, wp);
			const ax = wp.x * ppm, ay = -wp.y * ppm;
			const pvx = pv.x * ppm, pvy = -pv.y * ppm;
			pv.delete();
			let vdx = g.gain * (g.tx - ax), vdy = g.gain * (g.ty - ay);
			const vd = Math.hypot(vdx, vdy);
			if (vd > g.vmax) {
				vdx = vdx / vd * g.vmax;
				vdy = vdy / vd * g.vmax;
			}
			let accx = (vdx - pvx) * 60, accy = (vdy - pvy) * 60;
			const am = Math.hypot(accx, accy);
			if (am > g.maxAcc) {
				accx = accx / am * g.maxAcc;
				accy = accy / am * g.maxAcc;
			}
			const m = b.mass || 1;
			this._scratch2.Set(m * accx / ppm, -(m * accy) / ppm);
			b2.b2Body_ApplyForce(b._body, this._scratch2, wp, true);
			wp.delete();
		}
	}
	/**
	* Step the world and sync every dynamic sprite. The scene calls this for you
	* once you set `scene.physics2d = world`; call it yourself only if you drive
	* the world outside a scene.
	*/
	update(dt) {
		const b2 = this._b2;
		for (const k of this.kinematics) {
			if (k._dead) continue;
			const kp = this._readPose(k);
			this._scratch.Set(this._toBox(kp.x), -this._toBox(kp.y));
			const rot = b2.b2MakeRot(-kp.rot);
			const xf = new b2.b2Transform();
			xf.p = this._scratch;
			xf.q = rot;
			b2.b2Body_SetTargetTransform(k._body, xf, 1 / 60);
			xf.delete();
			rot.delete();
		}
		this.acc = Math.min(this.acc + dt, 3 / 60);
		while (this.acc >= 1 / 60 - 1e-9) {
			this.acc -= 1 / 60;
			if (this.grabs.length) this._applyGrabs();
			b2.b2World_Step(this.world, 1 / 60, this.substeps);
			this.pumpEvents();
			for (const body of this.bodies.values()) {
				if (body.type !== "dynamic" || body._dead) continue;
				if (!b2.b2Body_IsValid(body._body)) {
					this.invalidBodies++;
					body._dead = true;
					this.bodies.delete(idKey$1(body._body));
					this.bySprite.delete(body.sprite);
					continue;
				}
				body._pose0.set(body._pose1);
				const p = b2.b2Body_GetPosition(body._body);
				const r = b2.b2Body_GetRotation(body._body);
				body._pose1[0] = this._fromBox(p.x);
				body._pose1[1] = -this._fromBox(p.y);
				body._pose1[2] = -Math.atan2(r.s, r.c);
				p.delete();
				r.delete();
			}
		}
		const alpha = Math.max(0, Math.min(1, this.acc * 60));
		for (const body of this.bodies.values()) {
			if (body.type !== "dynamic" || body._dead) continue;
			const a = body._pose0, b = body._pose1;
			const cx = a[0] + (b[0] - a[0]) * alpha;
			const cy = a[1] + (b[1] - a[1]) * alpha;
			let da = b[2] - a[2];
			while (da > Math.PI) da -= 2 * Math.PI;
			while (da < -Math.PI) da += 2 * Math.PI;
			body._writePose(cx, cy, a[2] + da * alpha);
		}
	}
	/** @internal Drain contact + sensor events into wrapper callbacks. */
	pumpEvents() {
		const b2 = this._b2;
		const contacts = b2.b2World_GetContactEvents(this.world);
		const nHit = contacts.hitCount;
		for (let i = 0; i < nHit; i++) {
			const ev = contacts.GetHitEvent(i);
			const a = this.bodyOfShape(ev.shapeIdA);
			const bb = this.bodyOfShape(ev.shapeIdB);
			if (a && bb) {
				const speed = this._fromBox(ev.approachSpeed);
				a.onHit?.(bb, speed);
				bb.onHit?.(a, speed);
			}
			ev.delete?.();
		}
		const nBegin = contacts.beginCount;
		for (let i = 0; i < nBegin; i++) {
			const ev = contacts.GetBeginEvent(i);
			const a = this.bodyOfShape(ev.shapeIdA);
			const bb = this.bodyOfShape(ev.shapeIdB);
			if (a && bb) {
				a.onTouch?.(bb);
				bb.onTouch?.(a);
			}
			ev.delete?.();
		}
		const nEnd = contacts.endCount;
		for (let i = 0; i < nEnd; i++) {
			const ev = contacts.GetEndEvent(i);
			const a = this.bodyOfShape(ev.shapeIdA);
			const bb = this.bodyOfShape(ev.shapeIdB);
			if (a && bb) {
				a.onRelease?.(bb);
				bb.onRelease?.(a);
			}
			ev.delete?.();
		}
		contacts.delete?.();
		const sensors = b2.b2World_GetSensorEvents(this.world);
		const sBegin = sensors.beginCount;
		for (let i = 0; i < sBegin; i++) {
			const ev = sensors.GetBeginEvent(i);
			const sensor = this.bodyOfShape(ev.sensorShapeId);
			const visitor = this.bodyOfShape(ev.visitorShapeId);
			if (sensor && visitor) sensor.onEnter?.(visitor);
			ev.delete?.();
		}
		const sEnd = sensors.endCount;
		for (let i = 0; i < sEnd; i++) {
			const ev = sensors.GetEndEvent(i);
			const sensor = this.bodyOfShape(ev.sensorShapeId);
			const visitor = this.bodyOfShape(ev.visitorShapeId);
			if (sensor && visitor) sensor.onExit?.(visitor);
			ev.delete?.();
		}
		sensors.delete?.();
	}
	/** @internal Resolve an event shape id to a live Body2d (validate — shapes can belong to bodies destroyed this frame). */
	bodyOfShape(shapeId) {
		if (!this._b2.b2Shape_IsValid(shapeId)) return void 0;
		return this.bodies.get(idKey$1(this._b2.b2Shape_GetBody(shapeId)));
	}
	/** @internal Wrap a joint id in the public handle. `kind` enables `motor()`; `a`/`b` are woken when the motor is driven (a settled body sleeps and would otherwise ignore the command). */
	_joint(id, kind = "none", a, b) {
		const b2 = this._b2, self = this;
		return {
			destroy() {
				if (b2.b2Joint_IsValid(id)) b2.b2DestroyJoint(id);
			},
			motor(speed, effort) {
				if (kind === "revolute") {
					b2.b2RevoluteJoint_EnableMotor(id, true);
					b2.b2RevoluteJoint_SetMotorSpeed(id, -speed);
					if (effort !== void 0) b2.b2RevoluteJoint_SetMaxMotorTorque(id, effort);
				} else if (kind === "prismatic") {
					b2.b2PrismaticJoint_EnableMotor(id, true);
					b2.b2PrismaticJoint_SetMotorSpeed(id, self._toBox(speed));
					if (effort !== void 0) b2.b2PrismaticJoint_SetMaxMotorForce(id, effort);
				} else if (kind === "wheel") {
					b2.b2WheelJoint_EnableMotor(id, true);
					b2.b2WheelJoint_SetMotorSpeed(id, -speed);
					if (effort !== void 0) b2.b2WheelJoint_SetMaxMotorTorque(id, effort);
				}
				if (a && !a._dead) b2.b2Body_SetAwake(a._body, true);
				if (b && !b._dead) b2.b2Body_SetAwake(b._body, true);
			}
		};
	}
	/** @internal A shape's vertex RING (each segment's first point), scaled —
	*  what a decomposition needs, as opposed to the doubled-up endpoint list. */
	_ringOf(shape, scale) {
		return shape.segs.map(([a]) => ({
			x: a.x * scale,
			y: a.y * scale
		}));
	}
	/** @internal The target's CENTRE and angle in world space — a sprite is
	*  top-left anchored, a vector shape is already centred. */
	_readPose(b) {
		if (b.kind === "sprite") return {
			x: b.sprite.x + b._halfW,
			y: b.sprite.y + b._halfH,
			rot: b.sprite.rot
		};
		const sh = b.shape;
		return {
			x: sh.x,
			y: sh.y,
			rot: sh.rot
		};
	}
	/** @internal Body centre in world space. */
	_center(b) {
		const p = this._readPose(b);
		return {
			x: p.x,
			y: p.y
		};
	}
	/** @internal Midpoint between two bodies in world space. */
	_midpoint(a, b) {
		const ca = this._center(a), cb = this._center(b);
		return {
			x: (ca.x + cb.x) / 2,
			y: (ca.y + cb.y) / 2
		};
	}
	/**
	* @internal Set a joint's local anchor frames from world points. `worldAngle`
	* (Box2D-space radians) orients each frame's x-axis — identity for pin/rope/weld,
	* the slide direction for a slider.
	*/
	_setLocalAnchors(base, a, b, atA, atB, worldAngle = 0) {
		const b2 = this._b2;
		const wa = new b2.b2Vec2(this._toBox(atA.x), -this._toBox(atA.y));
		const wb = new b2.b2Vec2(this._toBox(atB.x), -this._toBox(atB.y));
		const la = b2.b2Body_GetLocalPoint(a._body, wa);
		const lb = b2.b2Body_GetLocalPoint(b._body, wb);
		const frameA = this._frameAt(la, worldAngle - this._bodyAngle(a));
		const frameB = this._frameAt(lb, worldAngle - this._bodyAngle(b));
		base.localFrameA = frameA;
		base.localFrameB = frameB;
		frameA.delete();
		frameB.delete();
		wa.delete();
		wb.delete();
		la.delete?.();
		lb.delete?.();
	}
	/** @internal A body's current world angle in Box2D-space radians. */
	_bodyAngle(b) {
		const r = this._b2.b2Body_GetRotation(b._body);
		const a = this._b2.b2Rot_GetAngle(r);
		r.delete();
		return a;
	}
	/** @internal A b2Transform at a body-local point with the given local rotation. */
	_frameAt(localPoint, angle) {
		const b2 = this._b2;
		const t = new b2.b2Transform();
		t.p = localPoint;
		const r = b2.b2MakeRot(angle);
		t.q = r;
		r.delete();
		return t;
	}
	/** @internal */
	_removeBody(body) {
		this.bodies.delete(idKey$1(body._body));
		if (body.kind === "sprite") {
			this.bySprite.delete(body.sprite);
			body.sprite._body2d = null;
		} else this.byShape.delete(body.shape);
		const ki = this.kinematics.indexOf(body);
		if (ki >= 0) this.kinematics.splice(ki, 1);
		if (this._b2.b2Body_IsValid(body._body)) this._b2.b2DestroyBody(body._body);
	}
	/** Tear the world down (frees the WASM side). Sprites stay where they were. */
	destroy() {
		const b2 = this._b2;
		for (const body of this.bodies.values()) {
			if (body.kind === "sprite") body.sprite._body2d = null;
			body._dead = true;
		}
		this._scratch.delete();
		this._scratch2.delete();
		this._zeroVec.delete();
		b2.b2DestroyWorld(this.world);
		this.bodies.clear();
		this.bySprite.clear();
		this.kinematics.length = 0;
	}
};
//#endregion
//#region src/lib/physics3d.ts
/**
* Physics3d — OPTIONAL rigid-body physics for the World3d layer. A thin,
* engine-vocabulary wrapper over a vendored WASM physics core that ships as a
* SEPARATE chunk (`physics3d-core.mjs`, ~1 MB): games that never call
* `Physics3d.create()` never load a byte of it.
*
*   // setup() — one await, then attach to the world and it's hands-free:
*   this.sim = await Physics3d.create({ gravity: -20 });
*   world.physics = this.sim;                    // the game steps + syncs it
*   this.sim.bind(ground, { type: 'static' });   // level geometry
*   const crate = this.sim.bind(crateMesh, { bounce: 0.2 });
*   crate.impulse({ x: 0, y: 6, z: -3 });
*
* What the wrapper hides ON PURPOSE (never reach past it): the WASM module
* and its manual memory rules, body/shape handle plumbing, quaternion
* conventions (bodies write the mesh's yaw/pitch/roll pose — steer dynamics
* with forces, never by setting the rotation), density units (a 1×1×1 box has
* mass 1), bigint collision bits (use string `group`/`hits` names), and the
* fixed-timestep accumulator.
*
* V2 NOTE: World3d meshes are retained INSTANCED handles (x/y/z, w/h/d,
* yaw/pitch/roll) with no vertex data on the handle, so the collision shapes
* derivable from w/h/d alone are the primitives: `box`, `sphere`, `capsule`.
* For loaded models there is also `'hull'` — the caller PASSES the convex
* points (`hullOfVerts` over the model's unit-fit geometry) since the handle
* carries no vertex data; the wrapper scales them by w/h/d exactly like box
* half-extents. (Raster's `ring`/`mesh` shapes did not survive the port.)
*/
var idKey = (id) => id.index1 + ":" + id.generation;
async function loadCore(explicit) {
	const candidates = (explicit ? [explicit] : [
		"./physics3d-core.mjs",
		"../physics3d-core.mjs",
		"../../vendor/physics3d-core.mjs"
	]).map((p) => new URL(p, import.meta.url).href);
	let lastErr = null;
	for (const url of candidates) try {
		return await (await import(
			/* @vite-ignore */
			url
)).default();
	} catch (e) {
		lastErr = e;
	}
	throw new Error("Physics3d: physics core module not found (physics3d-core.mjs). " + String(lastErr));
}
/**
* A physics body bound to a mesh. Dynamic bodies OWN the mesh transform —
* steer them with `impulse`/`force`/`velocity`, never by writing x/y/z
* (except `teleport`). Kinematic bodies are the reverse: move the MESH.
*/
var Body3d = class {
	/** The mesh this body drives (dynamic) or follows (kinematic). */
	mesh;
	/** `'dynamic' | 'static' | 'kinematic'`. */
	type;
	/** Contact callback (assign any time). */
	onHit = null;
	/** Contact began / ended (any speed). */
	onTouch = null;
	onRelease = null;
	/** Trigger callbacks (trigger bodies). */
	onEnter = null;
	onExit = null;
	/** @internal */
	_body;
	/** @internal */
	_world;
	/** @internal */
	constructor(w, body, mesh, type) {
		this._world = w;
		this._body = body;
		this.mesh = mesh;
		this.type = type;
	}
	/** Current linear velocity. */
	get velocity() {
		return this._world._b3.b3Body_GetLinearVelocity(this._body);
	}
	set velocity(v) {
		this._world._b3.b3Body_SetLinearVelocity(this._body, v);
		this._world._b3.b3Body_SetAwake(this._body, true);
	}
	/** Current angular velocity (rad/s per axis). */
	get spin() {
		return this._world._b3.b3Body_GetAngularVelocity(this._body);
	}
	set spin(v) {
		this._world._b3.b3Body_SetAngularVelocity(this._body, v);
		this._world._b3.b3Body_SetAwake(this._body, true);
	}
	/** The body's mass (dynamic bodies). */
	get mass() {
		return this._world._b3.b3Body_GetMass(this._body);
	}
	/**
	* Instant kick, scaled so `impulse({y: 6})` pops a 1-mass crate ~as high as
	* you'd guess regardless of its actual mass. Pass `at` (world point) to
	* also spin it — hits off-center tumble.
	*/
	impulse(v, at) {
		const m = this.mass || 1;
		const j = {
			x: (v.x ?? 0) * m,
			y: (v.y ?? 0) * m,
			z: (v.z ?? 0) * m
		};
		if (at) this._world._b3.b3Body_ApplyLinearImpulse(this._body, j, at, true);
		else this._world._b3.b3Body_ApplyLinearImpulseToCenter(this._body, j, true);
	}
	/** Continuous push (accumulates until the next step) — thrusters, wind. Mass-scaled like `impulse`. */
	force(v) {
		const m = this.mass || 1;
		this._world._b3.b3Body_ApplyForceToCenter(this._body, {
			x: (v.x ?? 0) * m,
			y: (v.y ?? 0) * m,
			z: (v.z ?? 0) * m
		}, true);
	}
	/** Instantly move the body (and its mesh) — respawns. Clears velocity. Optional `rotation` is Euler radians (the mesh's yaw/pitch/roll convention); omitted = upright. */
	teleport(position, rotation) {
		const b3 = this._world._b3;
		const bq = rotation ? eulerQuat(rotation.yaw ?? 0, rotation.pitch ?? 0, rotation.roll ?? 0) : {
			v: {
				x: 0,
				y: 0,
				z: 0
			},
			s: 1
		};
		b3.b3Body_SetTransform(this._body, position, bq);
		b3.b3Body_SetLinearVelocity(this._body, {
			x: 0,
			y: 0,
			z: 0
		});
		b3.b3Body_SetAngularVelocity(this._body, {
			x: 0,
			y: 0,
			z: 0
		});
		b3.b3Body_SetAwake(this._body, true);
		this.mesh.x = position.x;
		this.mesh.y = position.y;
		this.mesh.z = position.z;
		this._seedPose(position, {
			x: bq.v.x,
			y: bq.v.y,
			z: bq.v.z,
			w: bq.s
		});
	}
	/** @internal Set once destroyed — every later call is a safe no-op. */
	_dead = false;
	/** @internal Pose history for render interpolation: [x,y,z, qx,qy,qz,qw] at
	* the previous (`_pose0`) and latest (`_pose1`) fixed physics step. */
	_pose0 = new Float32Array([
		0,
		0,
		0,
		0,
		0,
		0,
		1
	]);
	_pose1 = new Float32Array([
		0,
		0,
		0,
		0,
		0,
		0,
		1
	]);
	/** @internal Seed both history slots (spawn/teleport — never smear across a jump). */
	_seedPose(p, q) {
		this._pose0[0] = this._pose1[0] = p.x;
		this._pose0[1] = this._pose1[1] = p.y;
		this._pose0[2] = this._pose1[2] = p.z;
		this._pose0[3] = this._pose1[3] = q.x;
		this._pose0[4] = this._pose1[4] = q.y;
		this._pose0[5] = this._pose1[5] = q.z;
		this._pose0[6] = this._pose1[6] = q.w;
	}
	/**
	* Remove this body from the world (the mesh stays where it was). Safe to
	* call twice — the second call is a no-op. (Body slots are recycled by the
	* solver; an unguarded double-destroy could kill an unrelated NEW body.)
	*/
	destroy() {
		if (this._dead) return;
		this._dead = true;
		this._world._removeBody(this);
	}
};
/**
* A capsule character controller: a rotation-locked dynamic body with
* velocity-driven movement — pushes crates, rides platforms, climbs shallow
* steps by capsule shape, and reports `grounded` for jump gating.
*
*   this.hero = this.sim.character(heroMesh, { radius: 0.4, height: 1.6 });
*   // in update(): this.hero.move({ x, z }, 6); if (jump && this.hero.grounded) this.hero.jump(9);
*/
var Character3d = class extends Body3d {
	/** @internal */
	half;
	/** @internal */
	constructor(w, body, mesh, height) {
		super(w, body, mesh, "dynamic");
		this.half = height / 2;
	}
	/** Steer: set horizontal velocity toward `dir` (any length) at `speed`, keeping vertical motion. */
	move(dir, speed) {
		const len = Math.hypot(dir.x, dir.z);
		const v = this.velocity;
		if (len < .001) {
			this.velocity = {
				x: v.x * .8,
				y: v.y,
				z: v.z * .8
			};
			return;
		}
		this.velocity = {
			x: dir.x / len * speed,
			y: v.y,
			z: dir.z / len * speed
		};
	}
	/** Standing on something (within a small tolerance below the feet)? */
	get grounded() {
		const m = this.mesh;
		return this._world.raycast({
			x: m.x,
			y: m.y,
			z: m.z
		}, {
			x: 0,
			y: -1,
			z: 0
		}, this.half + .25, this) !== null;
	}
	/** Jump with takeoff speed `v` (only fires while `grounded`). Returns whether it fired. */
	jump(v) {
		if (!this.grounded) return false;
		const vel = this.velocity;
		this.velocity = {
			x: vel.x,
			y: v,
			z: vel.z
		};
		return true;
	}
};
/**
* The physics world. `await Physics3d.create()` once in an async setup, bind
* meshes, attach to the world (`world.physics = sim`) and everything else is
* hands-free. All shapes are built from each mesh's CURRENT pose + w/h/d at
* bind time — place meshes first, bind second.
*/
var Physics3d = class Physics3d {
	/** @internal The core module. */
	_b3;
	/** @internal */
	world;
	/** @internal All live bodies by id key (event lookups). */
	bodies = /* @__PURE__ */ new Map();
	/** @internal Mesh → body (rebind guards, mesh-based queries). */
	byMesh = /* @__PURE__ */ new Map();
	/** @internal Kinematic bodies (mesh drives body each step). */
	kinematics = [];
	/** @internal Collision group name → category bit. */
	groups = /* @__PURE__ */ new Map();
	/** @internal Family name → negative filter-group index (self-collision off). */
	families = /* @__PURE__ */ new Map();
	/** @internal Event buffers (allocated once). */
	evBuf;
	evTouch;
	evHit;
	evSensor;
	/** @internal Fixed-step accumulator. */
	acc = 0;
	/** Diagnostic: count of body handles found stale during sync (should stay 0). */
	invalidBodies = 0;
	constructor(b3, world) {
		this._b3 = b3;
		this.world = world;
		this.evBuf = b3.createEventsBuffer();
		this.evTouch = b3.createContactTouchEvent();
		this.evHit = b3.createContactHitEvent();
		this.evSensor = b3.createSensorTouchEvent();
	}
	/**
	* Load the physics core (first call fetches the ~1 MB chunk; later calls
	* are instant) and create a world. One world per scene is the pattern.
	*/
	static async create(opts = {}) {
		const b3 = await loadCore(opts.module);
		const def = b3.b3DefaultWorldDef();
		const g = opts.gravity ?? -20;
		def.gravity = typeof g === "number" ? {
			x: 0,
			y: g,
			z: 0
		} : { ...g };
		const world = b3.b3CreateWorld(def);
		return new Physics3d(b3, world);
	}
	/** @internal Category bit for a group name (created on first use). */
	groupBit(name) {
		let bit = this.groups.get(name);
		if (bit === void 0) {
			bit = 1n << BigInt(this.groups.size);
			this.groups.set(name, bit);
		}
		return bit;
	}
	/** @internal Build the b3 filter for group/hits/family options. */
	filterFor(group, hits, family) {
		const cat = this.groupBit(group);
		let mask = -1n & (1n << 62n) - 1n;
		if (hits) {
			mask = 0n;
			for (const h of hits) mask |= this.groupBit(h);
		}
		let groupIndex = 0;
		if (family) {
			let idx = this.families.get(family);
			if (idx === void 0) {
				idx = -(this.families.size + 1);
				this.families.set(family, idx);
			}
			groupIndex = idx;
		}
		return {
			categoryBits: cat,
			maskBits: mask,
			groupIndex
		};
	}
	/**
	* Give a mesh a physics body. The shape is built from the mesh's w/h/d;
	* position/rotation come from where the mesh IS right now. Returns the
	* `Body3d` (dynamic bodies then own the mesh's transform).
	*/
	bind(mesh, opts = {}) {
		const existing = this.byMesh.get(mesh);
		if (existing) return existing;
		const b3 = this._b3;
		const type = opts.type ?? "dynamic";
		let shape = opts.shape ?? "auto";
		if (shape === "auto") shape = "box";
		const def = b3.b3DefaultBodyDef();
		def.position = {
			x: mesh.x,
			y: mesh.y,
			z: mesh.z
		};
		const startQuat = eulerQuat(mesh.yaw, mesh.pitch, mesh.roll);
		def.rotation = startQuat;
		def.type = type === "dynamic" ? b3.b3BodyType.b3_dynamicBody : type === "kinematic" ? b3.b3BodyType.b3_kinematicBody : b3.b3BodyType.b3_staticBody;
		if (opts.fast && shape !== "hull") def.isBullet = true;
		if (opts.damping !== void 0) def.linearDamping = opts.damping;
		def.angularDamping = opts.angularDamping ?? .05;
		if (opts.gravityScale !== void 0) def.gravityScale = opts.gravityScale;
		if (opts.lockRotation) def.motionLocks = {
			linearX: false,
			linearY: false,
			linearZ: false,
			angularX: true,
			angularY: true,
			angularZ: true
		};
		if (opts.fastSpin) def.allowFastRotation = true;
		const body = b3.b3CreateBody(this.world, def);
		const sd = b3.b3DefaultShapeDef();
		sd.baseMaterial.friction = opts.friction ?? .5;
		sd.baseMaterial.restitution = opts.bounce ?? 0;
		if (opts.rollingResistance) sd.baseMaterial.rollingResistance = opts.rollingResistance;
		sd.enableContactEvents = true;
		sd.enableHitEvents = true;
		sd.enableSensorEvents = true;
		sd.filter = this.filterFor(opts.group ?? "default", opts.hits, opts.family);
		if (opts.trigger) sd.isSensor = true;
		if (opts.conveyor) sd.baseMaterial.tangentVelocity = { ...opts.conveyor };
		const vol = Math.max(.001, mesh.w * mesh.h * mesh.d);
		sd.density = opts.mass !== void 0 ? opts.mass / vol : 1;
		if (shape === "sphere") {
			const r = Math.max(mesh.w, mesh.h, mesh.d) / 2 || .5;
			b3.b3CreateSphereShape(body, sd, {
				center: {
					x: 0,
					y: 0,
					z: 0
				},
				radius: r
			});
		} else if (shape === "capsule") {
			const r = Math.max(mesh.w, mesh.d) / 2 || .3;
			const half = Math.max(.01, mesh.h / 2 - r);
			b3.b3CreateCapsuleShape(body, sd, {
				center1: {
					x: 0,
					y: -half,
					z: 0
				},
				center2: {
					x: 0,
					y: half,
					z: 0
				},
				radius: r
			});
		} else if (shape === "hull") {
			let made = false;
			const src = opts.points;
			if (src && src.length >= 12) {
				const count = Math.floor(src.length / 3);
				const step = Math.max(1, Math.ceil(count / 180));
				const pts = [];
				for (let i = 0; i < count; i += step) pts.push(src[i * 3] * mesh.w, src[i * 3 + 1] * mesh.h, src[i * 3 + 2] * mesh.d);
				const hull = b3.b3CreateHull(pts);
				if (hull) {
					b3.b3CreateHullShape(body, sd, hull);
					hull.delete();
					made = true;
				}
			}
			if (!made) b3.b3CreateBoxShape(body, sd, mesh.w / 2, mesh.h / 2, mesh.d / 2);
		} else b3.b3CreateBoxShape(body, sd, mesh.w / 2, mesh.h / 2, mesh.d / 2);
		if (opts.balance && type === "dynamic") {
			const md = b3.b3Body_GetMassData(body);
			md.center = {
				x: md.center.x + opts.balance.x,
				y: md.center.y + opts.balance.y,
				z: md.center.z + opts.balance.z
			};
			b3.b3Body_SetMassData(body, md);
		}
		const wrapped = new Body3d(this, body, mesh, type);
		wrapped._seedPose({
			x: mesh.x,
			y: mesh.y,
			z: mesh.z
		}, {
			x: startQuat.v.x,
			y: startQuat.v.y,
			z: startQuat.v.z,
			w: startQuat.s
		});
		wrapped.onHit = opts.onHit ?? null;
		wrapped.onTouch = opts.onTouch ?? null;
		wrapped.onRelease = opts.onRelease ?? null;
		wrapped.onEnter = opts.onEnter ?? null;
		wrapped.onExit = opts.onExit ?? null;
		this.bodies.set(idKey(body), wrapped);
		this.byMesh.set(mesh, wrapped);
		if (type === "kinematic") this.kinematics.push(wrapped);
		return wrapped;
	}
	/** The capsule character controller (see `Character3d`). The mesh should be roughly `height` tall with its origin at the center. */
	character(mesh, opts = {}) {
		const b3 = this._b3;
		const radius = opts.radius ?? .4;
		const height = opts.height ?? 1.7;
		const def = b3.b3DefaultBodyDef();
		def.position = {
			x: mesh.x,
			y: mesh.y,
			z: mesh.z
		};
		def.type = b3.b3BodyType.b3_dynamicBody;
		def.motionLocks = {
			linearX: false,
			linearY: false,
			linearZ: false,
			angularX: true,
			angularY: true,
			angularZ: true
		};
		def.sleepThreshold = 0;
		const body = b3.b3CreateBody(this.world, def);
		const sd = b3.b3DefaultShapeDef();
		sd.baseMaterial.friction = opts.friction ?? .1;
		sd.enableContactEvents = true;
		sd.enableSensorEvents = true;
		sd.filter = this.filterFor(opts.group ?? "characters");
		sd.density = 1 / Math.max(.01, Math.PI * radius * radius * height);
		const half = Math.max(.01, height / 2 - radius);
		b3.b3CreateCapsuleShape(body, sd, {
			center1: {
				x: 0,
				y: -half,
				z: 0
			},
			center2: {
				x: 0,
				y: half,
				z: 0
			},
			radius
		});
		const c = new Character3d(this, body, mesh, height);
		c._seedPose({
			x: mesh.x,
			y: mesh.y,
			z: mesh.z
		}, {
			x: 0,
			y: 0,
			z: 0,
			w: 1
		});
		this.bodies.set(idKey(body), c);
		this.byMesh.set(mesh, c);
		return c;
	}
	/** Look up the body bound to a mesh (or `null`). */
	bodyOf(mesh) {
		return this.byMesh.get(mesh) ?? null;
	}
	/**
	* Nearest physics hit along a ray — the PHYSICS-world query (line of sight
	* to bodies, ground checks). Pass `ignore` to skip one body (the shooter).
	*/
	raycast(origin, dir, maxDistance = 100, ignore, opts) {
		const b3 = this._b3;
		const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
		const t = {
			x: dir.x / len * maxDistance,
			y: dir.y / len * maxDistance,
			z: dir.z / len * maxDistance
		};
		const res = b3.b3World_CastRayClosest(this.world, origin, t, this.queryFilterFor(opts?.hits));
		if (!res.hit) return null;
		const body = this.bodyOfShape(res.shapeId) ?? null;
		if (!body) return null;
		if (ignore && body === ignore) {
			const d = res.fraction * maxDistance + .01;
			const o2 = {
				x: origin.x + dir.x / len * d,
				y: origin.y + dir.y / len * d,
				z: origin.z + dir.z / len * d
			};
			return this.raycast(o2, dir, maxDistance - d, void 0, opts);
		}
		return {
			body,
			point: { ...res.point },
			normal: { ...res.normal },
			distance: res.fraction * maxDistance
		};
	}
	/**
	* EVERY hit along a ray, sorted nearest-first — pierce-through weapons,
	* "what's between me and the target" lists. Pass `hits` to only see those
	* collision groups.
	*/
	raycastAll(origin, dir, maxDistance = 100, opts) {
		const b3 = this._b3;
		const len = Math.hypot(dir.x, dir.y, dir.z) || 1;
		const t = {
			x: dir.x / len * maxDistance,
			y: dir.y / len * maxDistance,
			z: dir.z / len * maxDistance
		};
		const results = [];
		b3.b3World_CastRay(this.world, origin, t, this.queryFilterFor(opts?.hits), (shapeId, point, normal, fraction) => {
			const body = this.bodyOfShape(shapeId);
			if (body) results.push({
				body,
				point: { ...point },
				normal: { ...normal },
				distance: fraction * maxDistance
			});
			return 1;
		});
		results.sort((a, b) => a.distance - b.distance);
		return results;
	}
	/**
	* Every body overlapping a SPHERE (exact narrowphase) — blast radii, aura
	* effects, "who is standing near the shrine". Pass `hits` to restrict to
	* collision groups.
	*/
	overlap(center, radius, opts) {
		return this.overlapProxy(center, [
			0,
			0,
			0
		], radius, opts);
	}
	/** Every body overlapping an axis-aligned BOX of `size` at `center` — room zones, platform occupancy. */
	overlapBox(center, size, opts) {
		const pts = [];
		for (let c = 0; c < 8; c++) pts.push((c & 1 ? .5 : -.5) * size.x, (c & 2 ? .5 : -.5) * size.y, (c & 4 ? .5 : -.5) * size.z);
		return this.overlapProxy(center, pts, 0, opts);
	}
	/** @internal Shared overlap plumbing: convex point proxy + radius at origin. */
	overlapProxy(origin, points, radius, opts) {
		const found = [];
		const seen = /* @__PURE__ */ new Set();
		this._b3.b3World_OverlapShape(this.world, origin, points, radius, this.queryFilterFor(opts?.hits), (shapeId) => {
			const body = this.bodyOfShape(shapeId);
			if (body && !seen.has(body)) {
				seen.add(body);
				found.push(body);
			}
			return true;
		});
		return found;
	}
	/** @internal Query filter honoring the string collision groups. */
	queryFilterFor(hits) {
		const filter = this._b3.b3DefaultQueryFilter();
		if (hits) {
			let mask = 0n;
			for (const h of hits) mask |= this.groupBit(h);
			filter.maskBits = mask;
		}
		return filter;
	}
	/** Radial blast: every dynamic body within `radius` gets a mass-scaled outward kick (with a little lift). */
	explosion(at, radius, strength) {
		for (const body of this.bodies.values()) {
			if (body.type !== "dynamic") continue;
			const p = body.mesh;
			const dx = p.x - at.x, dy = p.y - at.y, dz = p.z - at.z;
			const d = Math.hypot(dx, dy, dz);
			if (d > radius || d < 1e-4) continue;
			const k = strength * (1 - d / radius);
			body.impulse({
				x: dx / d * k,
				y: dy / d * k + k * .35,
				z: dz / d * k
			});
		}
	}
	/** @internal Fill base joint fields (bodies + local frames from a world anchor + axis→local-Z quats). */
	jointBase(def, a, b, at, axis) {
		def.base.bodyIdA = a._body;
		def.base.bodyIdB = b._body;
		const qAxis = quatFromZTo(axis);
		def.base.localFrameA = this.toLocalFrame(a, at, qAxis);
		def.base.localFrameB = this.toLocalFrame(b, at, qAxis);
	}
	/** @internal World point+rotation → a body's local joint frame. */
	toLocalFrame(body, at, q) {
		const b3 = this._b3;
		const bp = b3.b3Body_GetPosition(body._body);
		const inv = quatConj(b3.b3Body_GetRotation(body._body));
		return {
			p: quatRotate$1(inv, {
				x: at.x - bp.x,
				y: at.y - bp.y,
				z: at.z - bp.z
			}),
			q: quatMul$1(inv, q)
		};
	}
	/**
	* A hinge (revolute joint): doors, windmill hubs, seesaws, drawbridges,
	* wheels. Anchor at the world point, spinning about `axis`. Add `motor` to
	* drive it; `limits` to stop the swing.
	*/
	hinge(a, b, opts) {
		const b3 = this._b3;
		const def = b3.b3DefaultRevoluteJointDef();
		this.jointBase(def, a, b, opts.at, opts.axis ?? vec3(0, 1, 0));
		if (opts.limits) {
			def.enableLimit = true;
			def.lowerAngle = opts.limits[0];
			def.upperAngle = opts.limits[1];
		}
		if (opts.motor) {
			def.enableMotor = true;
			def.motorSpeed = opts.motor.speed;
			def.maxMotorTorque = opts.motor.torque ?? 1e3;
		}
		const id = b3.b3CreateRevoluteJoint(this.world, def);
		const self = this;
		return {
			_id: id,
			motor(speed, strength) {
				self._b3.b3RevoluteJoint_EnableMotor(id, true);
				self._b3.b3RevoluteJoint_SetMotorSpeed(id, speed);
				self._b3.b3Joint_WakeBodies(id);
				if (strength !== void 0) self._b3.b3RevoluteJoint_SetMaxMotorTorque(id, strength);
			},
			destroy() {
				self._b3.b3DestroyJoint(id, true);
			}
		};
	}
	/**
	* A ball-and-socket (spherical joint): shoulders, hips, necks, chain links,
	* hanging signs. Free rotation about the anchor, optionally fenced by a
	* `swing` cone around `axis` and `twist` limits about it — the ragdoll
	* joint (pair with `family` on the limb bodies so they overlap in peace).
	*/
	socket(a, b, opts) {
		const b3 = this._b3;
		const def = b3.b3DefaultSphericalJointDef();
		this.jointBase(def, a, b, opts.at, opts.axis ?? vec3(0, -1, 0));
		if (opts.swing !== void 0) {
			def.enableConeLimit = true;
			def.coneAngle = opts.swing;
		}
		if (opts.twist) {
			def.enableTwistLimit = true;
			def.lowerTwistAngle = opts.twist[0];
			def.upperTwistAngle = opts.twist[1];
		}
		if (opts.stiffness !== void 0) {
			def.enableSpring = true;
			def.hertz = opts.stiffness;
			def.dampingRatio = .7;
		}
		const id = b3.b3CreateSphericalJoint(this.world, def);
		const self = this;
		return {
			_id: id,
			motor() {},
			destroy() {
				self._b3.b3DestroyJoint(id, true);
			}
		};
	}
	/** A slider (prismatic joint): elevators, pistons, sliding doors, plungers. */
	slider(a, b, opts) {
		const b3 = this._b3;
		const def = b3.b3DefaultPrismaticJointDef();
		const axis = opts.axis ?? vec3(0, 1, 0);
		const def2 = def;
		def2.base.bodyIdA = a._body;
		def2.base.bodyIdB = b._body;
		const qAxis = quatFromXTo(axis);
		def2.base.localFrameA = this.toLocalFrame(a, opts.at, qAxis);
		def2.base.localFrameB = this.toLocalFrame(b, opts.at, qAxis);
		if (opts.limits) {
			def.enableLimit = true;
			def.lowerTranslation = opts.limits[0];
			def.upperTranslation = opts.limits[1];
		}
		if (opts.motor) {
			def.enableMotor = true;
			def.motorSpeed = opts.motor.speed;
			def.maxMotorForce = opts.motor.force ?? 1e3;
		}
		const id = b3.b3CreatePrismaticJoint(this.world, def);
		const self = this;
		return {
			_id: id,
			motor(speed, strength) {
				self._b3.b3PrismaticJoint_EnableMotor(id, true);
				self._b3.b3PrismaticJoint_SetMotorSpeed(id, speed);
				self._b3.b3Joint_WakeBodies(id);
				if (strength !== void 0) self._b3.b3PrismaticJoint_SetMaxMotorForce(id, strength);
			},
			destroy() {
				self._b3.b3DestroyJoint(id, true);
			}
		};
	}
	/**
	* A vehicle wheel: suspension spring + spin motor + steering in ONE joint —
	* the entire car recipe is a chassis, four wheel bodies, four of these.
	* Drive with `joint.motor(radPerSec)`, aim with `joint.steer(angle)`.
	* Convention: suspension travels world-vertical at the rest pose; the wheel
	* spins about `axle` (default +X — a car built facing ±Z).
	*/
	wheel(chassis, wheelBody, opts) {
		const b3 = this._b3;
		const def = b3.b3DefaultWheelJointDef();
		const al = Math.hypot(opts.axle?.x ?? 1, opts.axle?.y ?? 0, opts.axle?.z ?? 0) || 1;
		const fz = {
			x: (opts.axle?.x ?? 1) / al,
			y: (opts.axle?.y ?? 0) / al,
			z: (opts.axle?.z ?? 0) / al
		};
		const fx = vec3(0, 1, 0);
		const q = quatFromCols(fx, {
			x: fz.y * fx.z - fz.z * fx.y,
			y: fz.z * fx.x - fz.x * fx.z,
			z: fz.x * fx.y - fz.y * fx.x
		}, fz);
		def.base.bodyIdA = chassis._body;
		def.base.bodyIdB = wheelBody._body;
		def.base.localFrameA = this.toLocalFrame(chassis, opts.at, q);
		def.base.localFrameB = this.toLocalFrame(wheelBody, opts.at, q);
		def.enableSuspensionSpring = true;
		def.suspensionHertz = opts.hertz ?? 3.5;
		def.suspensionDampingRatio = opts.damping ?? .7;
		const [travelLo, travelHi] = opts.travel ?? [-.25, .15];
		def.enableSuspensionLimit = true;
		def.lowerSuspensionLimit = travelLo;
		def.upperSuspensionLimit = travelHi;
		if (opts.drive) {
			def.enableSpinMotor = true;
			def.spinSpeed = 0;
			def.maxSpinTorque = (typeof opts.drive === "object" ? opts.drive.torque : void 0) ?? 80;
		}
		if (opts.steer) {
			const lock = (typeof opts.steer === "object" ? opts.steer.limit : void 0) ?? .65;
			def.enableSteering = true;
			def.steeringHertz = 6;
			def.steeringDampingRatio = 1;
			def.maxSteeringTorque = (typeof opts.steer === "object" ? opts.steer.torque : void 0) ?? 400;
			def.enableSteeringLimit = true;
			def.lowerSteeringLimit = -lock;
			def.upperSteeringLimit = lock;
			def.targetSteeringAngle = 0;
		}
		const id = b3.b3CreateWheelJoint(this.world, def);
		const self = this;
		return {
			_id: id,
			motor(speed, strength) {
				self._b3.b3WheelJoint_EnableSpinMotor(id, true);
				self._b3.b3WheelJoint_SetSpinMotorSpeed(id, speed);
				self._b3.b3Joint_WakeBodies(id);
				if (strength !== void 0) self._b3.b3WheelJoint_SetMaxSpinTorque(id, strength);
			},
			steer(angle) {
				self._b3.b3WheelJoint_SetTargetSteeringAngle(id, angle);
				self._b3.b3Joint_WakeBodies(id);
			},
			destroy() {
				self._b3.b3DestroyJoint(id, true);
			}
		};
	}
	/** A springy rope (distance joint with a soft spring): pendulums, cranes, bungees, suspension. */
	spring(a, b, opts = {}) {
		const b3 = this._b3;
		const def = b3.b3DefaultDistanceJointDef();
		const pa = opts.atA ?? this._b3.b3Body_GetPosition(a._body);
		const pb = opts.atB ?? this._b3.b3Body_GetPosition(b._body);
		def.base.bodyIdA = a._body;
		def.base.bodyIdB = b._body;
		const idq = {
			v: {
				x: 0,
				y: 0,
				z: 0
			},
			s: 1
		};
		def.base.localFrameA = this.toLocalFrame(a, pa, idq);
		def.base.localFrameB = this.toLocalFrame(b, pb, idq);
		def.length = opts.length ?? Math.max(.01, Math.hypot(pb.x - pa.x, pb.y - pa.y, pb.z - pa.z));
		if (opts.hertz !== void 0 || opts.damping !== void 0) {
			def.enableSpring = true;
			def.hertz = opts.hertz ?? 3;
			def.dampingRatio = opts.damping ?? .35;
		}
		const id = b3.b3CreateDistanceJoint(this.world, def);
		const self = this;
		return {
			_id: id,
			motor() {},
			destroy() {
				self._b3.b3DestroyJoint(id, true);
			}
		};
	}
	/**
	* A motorized grip (motor joint): softly HOLDS body `b` at its current pose
	* relative to `a`, with force/torque budgets — tractor beams, grabber claws,
	* magnets, telekinesis, "carry the crate in front of the player". Unlike
	* `weld` it's springy and breakable-feeling; unlike `spring` it holds
	* orientation too. `joint.drive(v)` slides the held pose around.
	*/
	grab(a, b, opts = {}) {
		const b3 = this._b3;
		const def = b3.b3DefaultMotorJointDef();
		const bp = b3.b3Body_GetPosition(b._body);
		const bq = b3.b3Body_GetRotation(b._body);
		def.base.bodyIdA = a._body;
		def.base.bodyIdB = b._body;
		def.base.localFrameA = this.toLocalFrame(a, bp, bq);
		def.base.localFrameB = {
			p: {
				x: 0,
				y: 0,
				z: 0
			},
			q: {
				v: {
					x: 0,
					y: 0,
					z: 0
				},
				s: 1
			}
		};
		def.linearHertz = opts.stiffness ?? 5;
		def.linearDampingRatio = opts.damping ?? .8;
		def.maxSpringForce = opts.force ?? 200;
		def.angularHertz = opts.stiffness ?? 5;
		def.angularDampingRatio = opts.damping ?? .8;
		def.maxSpringTorque = opts.torque ?? 100;
		def.maxVelocityForce = opts.force ?? 200;
		def.maxVelocityTorque = opts.torque ?? 100;
		const id = b3.b3CreateMotorJoint(this.world, def);
		b3.b3Joint_WakeBodies(id);
		const self = this;
		return {
			_id: id,
			motor() {},
			drive(linear, angular) {
				self._b3.b3MotorJoint_SetLinearVelocity(id, { ...linear });
				if (angular) self._b3.b3MotorJoint_SetAngularVelocity(id, { ...angular });
				self._b3.b3Joint_WakeBodies(id);
			},
			destroy() {
				self._b3.b3DestroyJoint(id, true);
			}
		};
	}
	/** Lock two bodies rigidly together (build a compound after the fact, glue a rider to a platform). */
	weld(a, b, at) {
		const b3 = this._b3;
		const def = b3.b3DefaultWeldJointDef();
		const anchor = at ?? this._b3.b3Body_GetPosition(b._body);
		this.jointBase(def, a, b, anchor, vec3(0, 0, 1));
		const id = b3.b3CreateWeldJoint(this.world, def);
		const self = this;
		return {
			_id: id,
			motor() {},
			destroy() {
				self._b3.b3DestroyJoint(id, true);
			}
		};
	}
	/**
	* Advance the simulation and sync every bound mesh. Attach the world to the
	* 3D layer (`world.physics = sim`) and this is called for you every frame —
	* call it yourself only when running physics without a World3d.
	*/
	update(dt) {
		const b3 = this._b3;
		for (const k of this.kinematics) b3.b3Body_SetTargetTransform(k._body, {
			p: {
				x: k.mesh.x,
				y: k.mesh.y,
				z: k.mesh.z
			},
			q: eulerQuat(k.mesh.yaw, k.mesh.pitch, k.mesh.roll)
		}, 1 / 60, true);
		this.acc = Math.min(this.acc + dt, 3 / 60);
		while (this.acc >= 1 / 60 - 1e-9) {
			this.acc -= 1 / 60;
			b3.b3World_Step(this.world, 1 / 60, 4);
			this.pumpEvents();
			for (const body of this.bodies.values()) {
				if (body.type !== "dynamic" || body._dead) continue;
				if (!b3.b3Body_IsValid(body._body)) {
					this.invalidBodies++;
					body._dead = true;
					this.bodies.delete(idKey(body._body));
					this.byMesh.delete(body.mesh);
					continue;
				}
				const prev = body._pose0, curr = body._pose1;
				prev.set(curr);
				const p = b3.b3Body_GetPosition(body._body);
				const q = b3.b3Body_GetRotation(body._body);
				curr[0] = p.x;
				curr[1] = p.y;
				curr[2] = p.z;
				curr[3] = q.v.x;
				curr[4] = q.v.y;
				curr[5] = q.v.z;
				curr[6] = q.s;
			}
		}
		const alpha = Math.max(0, Math.min(1, this.acc * 60));
		for (const body of this.bodies.values()) {
			if (body.type !== "dynamic" || body._dead) continue;
			const a = body._pose0, b = body._pose1;
			const mesh = body.mesh;
			mesh.x = a[0] + (b[0] - a[0]) * alpha;
			mesh.y = a[1] + (b[1] - a[1]) * alpha;
			mesh.z = a[2] + (b[2] - a[2]) * alpha;
			let qx = b[3], qy = b[4], qz = b[5], qw = b[6];
			const s = a[3] * qx + a[4] * qy + a[5] * qz + a[6] * qw < 0 ? -1 : 1;
			qx = a[3] + (qx * s - a[3]) * alpha;
			qy = a[4] + (qy * s - a[4]) * alpha;
			qz = a[5] + (qz * s - a[5]) * alpha;
			qw = a[6] + (qw * s - a[6]) * alpha;
			const inv = 1 / (Math.hypot(qx, qy, qz, qw) || 1);
			quatToEuler$1(qx * inv, qy * inv, qz * inv, qw * inv, mesh);
		}
	}
	/** @internal Resolve an event shape id to a live Body3d — events can carry
	* shapes of bodies destroyed this frame, so validate before dereferencing. */
	bodyOfShape(shapeId) {
		if (!this._b3.b3Shape_IsValid(shapeId)) return void 0;
		return this.bodies.get(idKey(this._b3.b3Shape_GetBody(shapeId)));
	}
	/** @internal Drain contact + sensor events into wrapper callbacks. */
	pumpEvents() {
		const b3 = this._b3;
		b3.getEvents(this.evBuf, this.world);
		const nHit = b3.getNumContactHitEvents(this.evBuf);
		for (let i = 0; i < nHit; i++) {
			b3.getContactHitEventAt(this.evHit, this.evBuf, i);
			const ev = this.evHit;
			const a = this.bodyOfShape(ev.shapeIdA);
			const bb = this.bodyOfShape(ev.shapeIdB);
			if (a && bb) {
				a.onHit?.(bb, ev.approachSpeed);
				bb.onHit?.(a, ev.approachSpeed);
			}
		}
		const nCBegin = b3.getNumContactBeginEvents(this.evBuf);
		for (let i = 0; i < nCBegin; i++) {
			b3.getContactBeginEventAt(this.evTouch, this.evBuf, i);
			const ev = this.evTouch;
			const a = this.bodyOfShape(ev.shapeIdA);
			const bb = this.bodyOfShape(ev.shapeIdB);
			if (a && bb) {
				a.onTouch?.(bb);
				bb.onTouch?.(a);
			}
		}
		const nCEnd = b3.getNumContactEndEvents(this.evBuf);
		for (let i = 0; i < nCEnd; i++) {
			b3.getContactEndEventAt(this.evTouch, this.evBuf, i);
			const ev = this.evTouch;
			const a = this.bodyOfShape(ev.shapeIdA);
			const bb = this.bodyOfShape(ev.shapeIdB);
			if (a && bb) {
				a.onRelease?.(bb);
				bb.onRelease?.(a);
			}
		}
		const nBegin = b3.getNumSensorBeginEvents(this.evBuf);
		for (let i = 0; i < nBegin; i++) {
			b3.getSensorBeginEventAt(this.evSensor, this.evBuf, i);
			const ev = this.evSensor;
			const sensor = this.bodyOfShape(ev.sensorShapeId);
			const visitor = this.bodyOfShape(ev.visitorShapeId);
			if (sensor && visitor) sensor.onEnter?.(visitor);
		}
		const nEnd = b3.getNumSensorEndEvents(this.evBuf);
		for (let i = 0; i < nEnd; i++) {
			b3.getSensorEndEventAt(this.evSensor, this.evBuf, i);
			const ev = this.evSensor;
			const sensor = this.bodyOfShape(ev.sensorShapeId);
			const visitor = this.bodyOfShape(ev.visitorShapeId);
			if (sensor && visitor) sensor.onExit?.(visitor);
		}
	}
	/** @internal */
	_removeBody(body) {
		this.bodies.delete(idKey(body._body));
		this.byMesh.delete(body.mesh);
		const ki = this.kinematics.indexOf(body);
		if (ki >= 0) this.kinematics.splice(ki, 1);
		if (this._b3.b3Body_IsValid(body._body)) this._b3.b3DestroyBody(body._body);
	}
	/** Tear the world down (frees the WASM side). The meshes stay. */
	destroy() {
		const b3 = this._b3;
		b3.destroyEventsBuffer?.(this.evBuf);
		b3.b3DestroyWorld(this.world);
		this.bodies.clear();
		this.byMesh.clear();
		this.kinematics.length = 0;
	}
};
/**
* Euler (v2 mesh yaw/pitch/roll) → quat, in the RENDERER'S composition order.
* The World3d WGSL `rotate()` applies roll (about Z), then pitch (about X),
* then yaw (about Y): world = Ry(yaw)·Rx(pitch)·Rz(roll)·v. So the quat is
* qy·qx·qz — identical to raster's mesh-matrix Y→X→Z order.
*/
function eulerQuat(yaw, pitch, roll) {
	const cy = Math.cos(yaw / 2), sy = -Math.sin(yaw / 2);
	const cx = Math.cos(pitch / 2), sx = Math.sin(pitch / 2);
	const cz = Math.cos(roll / 2), sz = Math.sin(roll / 2);
	const qy = {
		v: {
			x: 0,
			y: sy,
			z: 0
		},
		s: cy
	};
	const qx = {
		v: {
			x: sx,
			y: 0,
			z: 0
		},
		s: cx
	};
	const qz = {
		v: {
			x: 0,
			y: 0,
			z: sz
		},
		s: cz
	};
	return quatMul$1(quatMul$1(qy, qx), qz);
}
/**
* Quat → the mesh's yaw/pitch/roll, decomposed in the SAME Ry(yaw)·Rx(pitch)·
* Rz(roll) order the shader applies — writing these onto the mesh reproduces
* the body's exact orientation on screen. From the rotation matrix of that
* product: m12 = −sin(pitch), m02/m22 = yaw, m10/m11 = roll.
*
* GIMBAL CAVEAT: at pitch = ±90° yaw and roll collapse onto the same axis, so
* the split between them is arbitrary there (we put it all in yaw). A single
* FRAME'S pose is still exact — every decomposition renders the right
* orientation — but a body tumbling THROUGH the pole can see yaw/roll swap
* values discontinuously between frames. That's invisible on screen (the
* composed rotation stays continuous); only code that reads and reasons about
* the raw yaw/pitch/roll numbers of a tumbling body would notice.
*/
function quatToEuler$1(x, y, z, w, out) {
	const sinPitch = 2 * (w * x - y * z);
	if (Math.abs(sinPitch) > .99999) {
		out.pitch = sinPitch > 0 ? Math.PI / 2 : -Math.PI / 2;
		out.roll = 0;
		out.yaw = -Math.atan2(Math.sign(sinPitch) * 2 * (x * y - w * z), 1 - 2 * (y * y + z * z));
		return;
	}
	out.pitch = Math.asin(sinPitch);
	out.yaw = -Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y));
	out.roll = Math.atan2(2 * (x * y + w * z), 1 - 2 * (x * x + z * z));
}
function quatMul$1(a, b) {
	return {
		v: {
			x: a.s * b.v.x + a.v.x * b.s + a.v.y * b.v.z - a.v.z * b.v.y,
			y: a.s * b.v.y - a.v.x * b.v.z + a.v.y * b.s + a.v.z * b.v.x,
			z: a.s * b.v.z + a.v.x * b.v.y - a.v.y * b.v.x + a.v.z * b.s
		},
		s: a.s * b.s - a.v.x * b.v.x - a.v.y * b.v.y - a.v.z * b.v.z
	};
}
function quatConj(q) {
	return {
		v: {
			x: -q.v.x,
			y: -q.v.y,
			z: -q.v.z
		},
		s: q.s
	};
}
function quatRotate$1(q, p) {
	const r = quatMul$1(quatMul$1(q, {
		v: p,
		s: 0
	}), quatConj(q));
	return {
		x: r.v.x,
		y: r.v.y,
		z: r.v.z
	};
}
function quatFromTo(from, to) {
	const l = Math.hypot(to.x, to.y, to.z) || 1;
	const t = {
		x: to.x / l,
		y: to.y / l,
		z: to.z / l
	};
	const d = from.x * t.x + from.y * t.y + from.z * t.z;
	if (d > .99999) return {
		v: {
			x: 0,
			y: 0,
			z: 0
		},
		s: 1
	};
	if (d < -.99999) {
		const axis = Math.abs(from.x) < .9 ? {
			x: 1,
			y: 0,
			z: 0
		} : {
			x: 0,
			y: 1,
			z: 0
		};
		const cx = from.y * axis.z - from.z * axis.y;
		const cy = from.z * axis.x - from.x * axis.z;
		const cz = from.x * axis.y - from.y * axis.x;
		const cl = Math.hypot(cx, cy, cz) || 1;
		return {
			v: {
				x: cx / cl,
				y: cy / cl,
				z: cz / cl
			},
			s: 0
		};
	}
	const cx = from.y * t.z - from.z * t.y;
	const cy = from.z * t.x - from.x * t.z;
	const cz = from.x * t.y - from.y * t.x;
	const s = Math.sqrt((1 + d) * 2);
	return {
		v: {
			x: cx / s,
			y: cy / s,
			z: cz / s
		},
		s: s / 2
	};
}
function quatFromZTo(axis) {
	return quatFromTo({
		x: 0,
		y: 0,
		z: 1
	}, axis);
}
function quatFromXTo(axis) {
	return quatFromTo({
		x: 1,
		y: 0,
		z: 0
	}, axis);
}
function quatFromCols(cx, cy, cz) {
	const m00 = cx.x, m10 = cx.y, m20 = cx.z;
	const m01 = cy.x, m11 = cy.y, m21 = cy.z;
	const m02 = cz.x, m12 = cz.y, m22 = cz.z;
	const trace = m00 + m11 + m22;
	if (trace > 0) {
		const s = Math.sqrt(trace + 1) * 2;
		return {
			v: {
				x: (m21 - m12) / s,
				y: (m02 - m20) / s,
				z: (m10 - m01) / s
			},
			s: s / 4
		};
	} else if (m00 > m11 && m00 > m22) {
		const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
		return {
			v: {
				x: s / 4,
				y: (m01 + m10) / s,
				z: (m02 + m20) / s
			},
			s: (m21 - m12) / s
		};
	} else if (m11 > m22) {
		const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
		return {
			v: {
				x: (m01 + m10) / s,
				y: s / 4,
				z: (m12 + m21) / s
			},
			s: (m02 - m20) / s
		};
	}
	const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
	return {
		v: {
			x: (m02 + m20) / s,
			y: (m12 + m21) / s,
			z: s / 4
		},
		s: (m10 - m01) / s
	};
}
//#endregion
//#region src/lib/csg3d.ts
var EPS = 1e-5;
function cloneVert(v) {
	return [
		v[0],
		v[1],
		v[2],
		v[3],
		v[4],
		v[5],
		v[6],
		v[7]
	];
}
/** Linear blend of two verts at t — position + uv lerp, normal lerp+renormalise. */
function lerpVert(a, b, t) {
	const x = a[0] + (b[0] - a[0]) * t;
	const y = a[1] + (b[1] - a[1]) * t;
	const z = a[2] + (b[2] - a[2]) * t;
	let nx = a[3] + (b[3] - a[3]) * t;
	let ny = a[4] + (b[4] - a[4]) * t;
	let nz = a[5] + (b[5] - a[5]) * t;
	const l = Math.hypot(nx, ny, nz) || 1;
	nx /= l;
	ny /= l;
	nz /= l;
	const u = a[6] + (b[6] - a[6]) * t;
	const v = a[7] + (b[7] - a[7]) * t;
	return [
		x,
		y,
		z,
		nx,
		ny,
		nz,
		u,
		v
	];
}
function planeFromVerts(a, b, c) {
	const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
	const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
	let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
	const l = Math.hypot(nx, ny, nz) || 1;
	nx /= l;
	ny /= l;
	nz /= l;
	return {
		x: nx,
		y: ny,
		z: nz,
		w: nx * a[0] + ny * a[1] + nz * a[2]
	};
}
function makePoly(verts) {
	return {
		verts,
		plane: planeFromVerts(verts[0], verts[1], verts[2])
	};
}
function flipPoly(p) {
	p.verts.reverse();
	for (const v of p.verts) {
		v[3] = -v[3];
		v[4] = -v[4];
		v[5] = -v[5];
	}
	p.plane = {
		x: -p.plane.x,
		y: -p.plane.y,
		z: -p.plane.z,
		w: -p.plane.w
	};
}
var COPLANAR = 0;
var FRONT = 1;
var BACK = 2;
var SPANNING = 3;
/** Split `poly` by `plane`, routing whole/fragment polys to the four buckets. */
function splitPoly(plane, poly, cf, cb, front, back) {
	let polyType = 0;
	const types = [];
	for (const v of poly.verts) {
		const t = plane.x * v[0] + plane.y * v[1] + plane.z * v[2] - plane.w;
		const type = t < -1e-5 ? BACK : t > EPS ? FRONT : COPLANAR;
		polyType |= type;
		types.push(type);
	}
	switch (polyType) {
		case COPLANAR:
			(plane.x * poly.plane.x + plane.y * poly.plane.y + plane.z * poly.plane.z > 0 ? cf : cb).push(poly);
			break;
		case FRONT:
			front.push(poly);
			break;
		case BACK:
			back.push(poly);
			break;
		default: {
			const f = [], b = [];
			const n = poly.verts.length;
			for (let i = 0; i < n; i++) {
				const j = (i + 1) % n;
				const ti = types[i], tj = types[j];
				const vi = poly.verts[i], vj = poly.verts[j];
				if (ti !== BACK) f.push(vi);
				if (ti !== FRONT) b.push(ti !== BACK ? cloneVert(vi) : vi);
				if ((ti | tj) === SPANNING) {
					const denom = plane.x * (vj[0] - vi[0]) + plane.y * (vj[1] - vi[1]) + plane.z * (vj[2] - vi[2]);
					const mid = lerpVert(vi, vj, (plane.w - (plane.x * vi[0] + plane.y * vi[1] + plane.z * vi[2])) / denom);
					f.push(mid);
					b.push(cloneVert(mid));
				}
			}
			if (f.length >= 3) front.push(makePoly(f));
			if (b.length >= 3) back.push(makePoly(b));
		}
	}
}
var Node = class Node {
	plane = null;
	front = null;
	back = null;
	polygons = [];
	constructor(polygons) {
		if (polygons) this.build(polygons);
	}
	invert() {
		const stack = [this];
		while (stack.length) {
			const node = stack.pop();
			for (const p of node.polygons) flipPoly(p);
			if (node.plane) node.plane = {
				x: -node.plane.x,
				y: -node.plane.y,
				z: -node.plane.z,
				w: -node.plane.w
			};
			const t = node.front;
			node.front = node.back;
			node.back = t;
			if (node.front) stack.push(node.front);
			if (node.back) stack.push(node.back);
		}
	}
	clipPolygons(polygons) {
		const result = [];
		const stack = [{
			node: this,
			polys: polygons
		}];
		while (stack.length) {
			const { node, polys } = stack.pop();
			if (!node.plane) {
				for (const p of polys) result.push(p);
				continue;
			}
			const front = [], back = [];
			for (const p of polys) splitPoly(node.plane, p, front, back, front, back);
			if (node.front) stack.push({
				node: node.front,
				polys: front
			});
			else for (const p of front) result.push(p);
			if (node.back) stack.push({
				node: node.back,
				polys: back
			});
		}
		return result;
	}
	clipTo(bsp) {
		const stack = [this];
		while (stack.length) {
			const node = stack.pop();
			node.polygons = bsp.clipPolygons(node.polygons);
			if (node.front) stack.push(node.front);
			if (node.back) stack.push(node.back);
		}
	}
	allPolygons() {
		const out = [];
		const stack = [this];
		while (stack.length) {
			const node = stack.pop();
			for (const p of node.polygons) out.push(p);
			if (node.front) stack.push(node.front);
			if (node.back) stack.push(node.back);
		}
		return out;
	}
	build(polygons) {
		const stack = [{
			node: this,
			polys: polygons
		}];
		while (stack.length) {
			const { node, polys } = stack.pop();
			if (!polys.length) continue;
			if (!node.plane) node.plane = { ...polys[0].plane };
			const front = [], back = [];
			for (const p of polys) splitPoly(node.plane, p, node.polygons, node.polygons, front, back);
			if (front.length) stack.push({
				node: node.front ??= new Node(),
				polys: front
			});
			if (back.length) stack.push({
				node: node.back ??= new Node(),
				polys: back
			});
		}
	}
};
function op(a, b, kind) {
	const A = new Node(a), B = new Node(b);
	if (kind === "union") {
		A.clipTo(B);
		B.clipTo(A);
		B.invert();
		B.clipTo(A);
		B.invert();
		A.build(B.allPolygons());
		return A.allPolygons();
	}
	if (kind === "subtract") {
		A.invert();
		A.clipTo(B);
		B.clipTo(A);
		B.invert();
		B.clipTo(A);
		B.invert();
		A.build(B.allPolygons());
		A.invert();
		return A.allPolygons();
	}
	A.invert();
	B.clipTo(A);
	B.invert();
	A.clipTo(B);
	B.clipTo(A);
	A.build(B.allPolygons());
	A.invert();
	return A.allPolygons();
}
function vertsToPolys(v) {
	const polys = [];
	for (let i = 0; i + 24 <= v.length; i += 24) {
		const tri = [
			[
				v[i],
				v[i + 1],
				v[i + 2],
				v[i + 3],
				v[i + 4],
				v[i + 5],
				v[i + 6],
				v[i + 7]
			],
			[
				v[i + 8],
				v[i + 9],
				v[i + 10],
				v[i + 11],
				v[i + 12],
				v[i + 13],
				v[i + 14],
				v[i + 15]
			],
			[
				v[i + 16],
				v[i + 17],
				v[i + 18],
				v[i + 19],
				v[i + 20],
				v[i + 21],
				v[i + 22],
				v[i + 23]
			]
		];
		polys.push(makePoly(tri));
	}
	return polys;
}
function clonePolys(polys) {
	return polys.map((p) => ({
		verts: p.verts.map(cloneVert),
		plane: { ...p.plane }
	}));
}
/** Triangulate the (convex) BSP fragments back to interleaved soup — RAW, so
* CSG's deliberate winding/normals survive (never re-corrected outward). */
function polysToVerts(polys) {
	const out = [];
	for (const p of polys) for (let i = 2; i < p.verts.length; i++) for (const v of [
		p.verts[0],
		p.verts[i - 1],
		p.verts[i]
	]) out.push(v[0], v[1], v[2], v[3], v[4], v[5], v[6], v[7]);
	return new Float32Array(out);
}
function rot3(x, y, z, yaw, pitch, roll) {
	const cr = Math.cos(roll), sr = Math.sin(roll);
	const x1 = x * cr - y * sr, y1 = x * sr + y * cr, z1 = z;
	const cp = Math.cos(pitch), sp = Math.sin(pitch);
	const x2 = x1, y2 = y1 * cp - z1 * sp, z2 = y1 * sp + z1 * cp;
	const cy = Math.cos(yaw), sy = Math.sin(yaw);
	return [
		x2 * cy - z2 * sy,
		y2,
		x2 * sy + z2 * cy
	];
}
/** Return a copy of `verts` with a placement baked in: scale → rotate → move.
* Normals rotate too (divided by scale first for non-uniform, then renormalised). */
function transformVerts(verts, xf) {
	const [sx, sy, sz] = typeof xf.scale === "number" ? [
		xf.scale,
		xf.scale,
		xf.scale
	] : xf.scale ?? [
		1,
		1,
		1
	];
	const [px, py, pz] = xf.pos ?? [
		0,
		0,
		0
	];
	const yaw = xf.yaw ?? 0, pitch = xf.pitch ?? 0, roll = xf.roll ?? 0;
	const out = new Float32Array(verts.length);
	for (let i = 0; i < verts.length; i += 8) {
		const p = rot3(verts[i] * sx, verts[i + 1] * sy, verts[i + 2] * sz, yaw, pitch, roll);
		out[i] = p[0] + px;
		out[i + 1] = p[1] + py;
		out[i + 2] = p[2] + pz;
		let n = rot3(verts[i + 3] / sx, verts[i + 4] / sy, verts[i + 5] / sz, yaw, pitch, roll);
		const l = Math.hypot(n[0], n[1], n[2]) || 1;
		out[i + 3] = n[0] / l;
		out[i + 4] = n[1] / l;
		out[i + 5] = n[2] / l;
		out[i + 6] = verts[i + 6];
		out[i + 7] = verts[i + 7];
	}
	return out;
}
/**
* A solid you can boolean against another. Build from any triangle-soup
* (a geometry3d generator's output), optionally with a placement, then chain
* `.subtract()` / `.union()` / `.intersect()` and hand `.toVerts()` to
* `world.custom(name, () => solid.toVerts(), cfg)` — one baked, instanced mesh.
*
* ```ts
* const die = Solid.fromVerts(roundedBoxVerts(0.22, 3))
*   .subtract(Solid.fromVerts(sphereVerts(16, 12), { pos: [0, 0.5, 0], scale: 0.2 }));
* world.custom('die', () => die.toVerts(), { w: S, h: S, d: S, color });
* ```
* Bake-time only; keep tools clean/closed (see the robustness note up top).
*/
var Solid = class Solid {
	polys;
	constructor(polys) {
		this.polys = polys;
	}
	/** Wrap a triangle-soup, optionally baking a placement into it. */
	static fromVerts(verts, xf) {
		return new Solid(vertsToPolys(xf ? transformVerts(verts, xf) : verts));
	}
	/** Merge many solids into one. USE THIS to combine cutting tools before a
	* single subtract — "union the tools, subtract once" keeps the polygon count
	* (and the bake time) an order of magnitude below N sequential subtracts. */
	static union(solids) {
		if (!solids.length) return new Solid([]);
		let acc = solids[0];
		for (let i = 1; i < solids.length; i++) acc = acc.union(solids[i]);
		return acc;
	}
	union(other) {
		return new Solid(op(clonePolys(this.polys), clonePolys(other.polys), "union"));
	}
	subtract(other) {
		return new Solid(op(clonePolys(this.polys), clonePolys(other.polys), "subtract"));
	}
	intersect(other) {
		return new Solid(op(clonePolys(this.polys), clonePolys(other.polys), "intersect"));
	}
	/** The result as interleaved (pos, normal, uv) soup for world.custom(). */
	toVerts() {
		return polysToVerts(this.polys);
	}
};
function unionVerts(a, b) {
	return polysToVerts(op(vertsToPolys(a), vertsToPolys(b), "union"));
}
function subtractVerts(a, b) {
	return polysToVerts(op(vertsToPolys(a), vertsToPolys(b), "subtract"));
}
function intersectVerts(a, b) {
	return polysToVerts(op(vertsToPolys(a), vertsToPolys(b), "intersect"));
}
//#endregion
//#region src/lib/hull3d.ts
/**
* hull3d — pure convex-hull math for 3D model colliders (no DOM, no GPU, no
* deps). Loaded OBJ/GLB models are arbitrary triangle soups; physics wants a
* small CONVEX wrap of them. `quickhull` computes the hull of a point cloud,
* `hullOfVerts` runs it over the engine's stride-8 vertex format and samples
* the result down to a physics-friendly point count. Both run once per model
* at load time — clarity over speed (meshes are ≤ ~30k verts).
*/
/** Relative epsilon: scaled by the cloud's largest axis extent. */
var EPS_REL = 1e-7;
/**
* 3D quickhull over a point cloud. Input: flat xyz triples. Output: the
* hull's unique vertices as flat xyz triples (order unspecified). Handles
* degenerate inputs by returning what it can (≤3 points / coplanar sets
* return the input's unique extreme points — Box3D accepts them).
*/
function quickhull(points) {
	const P = points;
	const n = Math.floor(P.length / 3);
	const idx = [];
	const seen = /* @__PURE__ */ new Set();
	for (let i = 0; i < n; i++) {
		const key = P[i * 3] + "," + P[i * 3 + 1] + "," + P[i * 3 + 2];
		if (!seen.has(key)) {
			seen.add(key);
			idx.push(i);
		}
	}
	if (idx.length <= 3) return gather(P, idx);
	const X = (i) => P[i * 3];
	const Y = (i) => P[i * 3 + 1];
	const Z = (i) => P[i * 3 + 2];
	let iMinX = idx[0], iMaxX = idx[0], iMinY = idx[0], iMaxY = idx[0], iMinZ = idx[0], iMaxZ = idx[0];
	for (const i of idx) {
		if (X(i) < X(iMinX)) iMinX = i;
		if (X(i) > X(iMaxX)) iMaxX = i;
		if (Y(i) < Y(iMinY)) iMinY = i;
		if (Y(i) > Y(iMaxY)) iMaxY = i;
		if (Z(i) < Z(iMinZ)) iMinZ = i;
		if (Z(i) > Z(iMaxZ)) iMaxZ = i;
	}
	const extent = Math.max(X(iMaxX) - X(iMinX), Y(iMaxY) - Y(iMinY), Z(iMaxZ) - Z(iMinZ));
	const eps = Math.max(extent * EPS_REL, 1e-12);
	const ext = [
		iMinX,
		iMaxX,
		iMinY,
		iMaxY,
		iMinZ,
		iMaxZ
	];
	let s0 = ext[0], s1 = ext[1], bestD2 = -1;
	for (let a = 0; a < 6; a++) for (let b = a + 1; b < 6; b++) {
		const dx = X(ext[a]) - X(ext[b]), dy = Y(ext[a]) - Y(ext[b]), dz = Z(ext[a]) - Z(ext[b]);
		const d2 = dx * dx + dy * dy + dz * dz;
		if (d2 > bestD2) {
			bestD2 = d2;
			s0 = ext[a];
			s1 = ext[b];
		}
	}
	if (bestD2 <= eps * eps) return gather(P, [idx[0]]);
	const lx = X(s1) - X(s0), ly = Y(s1) - Y(s0), lz = Z(s1) - Z(s0);
	const lLen = Math.hypot(lx, ly, lz);
	let s2 = -1, d2best = eps;
	for (const i of idx) {
		const px = X(i) - X(s0), py = Y(i) - Y(s0), pz = Z(i) - Z(s0);
		const cx = ly * pz - lz * py, cy = lz * px - lx * pz, cz = lx * py - ly * px;
		const d = Math.hypot(cx, cy, cz) / lLen;
		if (d > d2best) {
			d2best = d;
			s2 = i;
		}
	}
	if (s2 < 0) {
		let lo = idx[0], hi = idx[0];
		for (const i of idx) {
			const t = (X(i) - X(s0)) * lx + (Y(i) - Y(s0)) * ly + (Z(i) - Z(s0)) * lz;
			if (t < (X(lo) - X(s0)) * lx + (Y(lo) - Y(s0)) * ly + (Z(lo) - Z(s0)) * lz) lo = i;
			if (t > (X(hi) - X(s0)) * lx + (Y(hi) - Y(s0)) * ly + (Z(hi) - Z(s0)) * lz) hi = i;
		}
		return gather(P, lo === hi ? [lo] : [lo, hi]);
	}
	const p2x = X(s2) - X(s0), p2y = Y(s2) - Y(s0), p2z = Z(s2) - Z(s0);
	let nx = ly * p2z - lz * p2y, ny = lz * p2x - lx * p2z, nz = lx * p2y - ly * p2x;
	const nLen = Math.hypot(nx, ny, nz) || 1;
	nx /= nLen;
	ny /= nLen;
	nz /= nLen;
	const off = nx * X(s0) + ny * Y(s0) + nz * Z(s0);
	let s3 = -1, d3best = eps;
	for (const i of idx) {
		const d = Math.abs(nx * X(i) + ny * Y(i) + nz * Z(i) - off);
		if (d > d3best) {
			d3best = d;
			s3 = i;
		}
	}
	if (s3 < 0) return hull2d(P, idx, s0, lx / lLen, ly / lLen, lz / lLen, nx, ny, nz, eps, extent);
	const faces = [];
	const edges = /* @__PURE__ */ new Map();
	const EK = 4194304;
	const ekey = (a, b) => a * EK + b;
	const makeFace = (a, b, c) => {
		const abx = X(b) - X(a), aby = Y(b) - Y(a), abz = Z(b) - Z(a);
		const acx = X(c) - X(a), acy = Y(c) - Y(a), acz = Z(c) - Z(a);
		let fnx = aby * acz - abz * acy, fny = abz * acx - abx * acz, fnz = abx * acy - aby * acx;
		const len = Math.hypot(fnx, fny, fnz) || 1e-30;
		fnx /= len;
		fny /= len;
		fnz /= len;
		return {
			a,
			b,
			c,
			nx: fnx,
			ny: fny,
			nz: fnz,
			off: fnx * X(a) + fny * Y(a) + fnz * Z(a),
			pts: [],
			far: -1,
			farD: eps,
			dead: false,
			mark: 0
		};
	};
	const dist = (f, i) => f.nx * X(i) + f.ny * Y(i) + f.nz * Z(i) - f.off;
	const addFace = (f) => {
		faces.push(f);
		edges.set(ekey(f.a, f.b), f);
		edges.set(ekey(f.b, f.c), f);
		edges.set(ekey(f.c, f.a), f);
	};
	const cx = (X(s0) + X(s1) + X(s2) + X(s3)) / 4;
	const cy = (Y(s0) + Y(s1) + Y(s2) + Y(s3)) / 4;
	const cz = (Z(s0) + Z(s1) + Z(s2) + Z(s3)) / 4;
	const outward = (f) => f.nx * cx + f.ny * cy + f.nz * cz - f.off > 0 ? makeFace(f.a, f.c, f.b) : f;
	addFace(outward(makeFace(s0, s1, s2)));
	addFace(outward(makeFace(s0, s1, s3)));
	addFace(outward(makeFace(s0, s2, s3)));
	addFace(outward(makeFace(s1, s2, s3)));
	const claim = (i, candidates) => {
		let best = null, bestDist = eps;
		for (const f of candidates) {
			if (f.dead) continue;
			const d = dist(f, i);
			if (d > bestDist) {
				bestDist = d;
				best = f;
			}
		}
		if (best) {
			best.pts.push(i);
			if (bestDist > best.farD) {
				best.farD = bestDist;
				best.far = i;
			}
		}
	};
	for (const i of idx) {
		if (i === s0 || i === s1 || i === s2 || i === s3) continue;
		claim(i, faces);
	}
	const queue = faces.filter((f) => f.pts.length > 0);
	let markGen = 0;
	let guard = idx.length * 12 + 64;
	while (queue.length > 0 && guard-- > 0) {
		const f = queue.pop();
		if (f.dead || f.pts.length === 0) continue;
		const apex = f.far;
		markGen++;
		f.mark = markGen;
		const visible = [f];
		const stack = [f];
		const horizon = [];
		while (stack.length > 0) {
			const g = stack.pop();
			const va = [
				g.a,
				g.b,
				g.c
			];
			for (let k = 0; k < 3; k++) {
				const a = va[k], b = va[(k + 1) % 3];
				const nb = edges.get(ekey(b, a));
				if (!nb || nb.dead || nb.mark === markGen) continue;
				if (dist(nb, apex) > eps) {
					nb.mark = markGen;
					visible.push(nb);
					stack.push(nb);
				} else horizon.push(a, b);
			}
		}
		const orphans = [];
		for (const g of visible) {
			g.dead = true;
			edges.delete(ekey(g.a, g.b));
			edges.delete(ekey(g.b, g.c));
			edges.delete(ekey(g.c, g.a));
			for (const i of g.pts) if (i !== apex) orphans.push(i);
		}
		const fresh = [];
		for (let k = 0; k < horizon.length; k += 2) {
			const nf = outward(makeFace(horizon[k], horizon[k + 1], apex));
			addFace(nf);
			fresh.push(nf);
		}
		for (const i of orphans) claim(i, fresh);
		for (const nf of fresh) if (nf.pts.length > 0) queue.push(nf);
	}
	const out = /* @__PURE__ */ new Set();
	for (const f of faces) {
		if (f.dead) continue;
		out.add(f.a);
		out.add(f.b);
		out.add(f.c);
	}
	return gather(P, [...out]);
}
/** @internal Coplanar fallback: Andrew monotone chain in the plane's (u,v) basis. */
function hull2d(P, idx, origin, ux, uy, uz, vxn, vyn, vzn, eps, extent) {
	const vx = vyn * uz - vzn * uy, vy = vzn * ux - vxn * uz, vz = vxn * uy - vyn * ux;
	const ox = P[origin * 3], oy = P[origin * 3 + 1], oz = P[origin * 3 + 2];
	const pts = idx.map((i) => {
		const px = P[i * 3] - ox, py = P[i * 3 + 1] - oy, pz = P[i * 3 + 2] - oz;
		return {
			x: px * ux + py * uy + pz * uz,
			y: px * vx + py * vy + pz * vz,
			i
		};
	});
	pts.sort((a, b) => a.x - b.x || a.y - b.y);
	const eps2 = eps * Math.max(extent, 1);
	const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
	const half = (list) => {
		const h = [];
		for (const p of list) {
			while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= eps2) h.pop();
			h.push(p);
		}
		return h;
	};
	const lower = half(pts);
	const upper = half([...pts].reverse());
	return gather(P, [...lower.slice(0, -1), ...upper.slice(0, -1)].map((p) => p.i));
}
/** @internal Flat xyz triples for a list of point indices. */
function gather(P, ids) {
	const out = new Float32Array(ids.length * 3);
	for (let k = 0; k < ids.length; k++) {
		out[k * 3] = P[ids[k] * 3];
		out[k * 3 + 1] = P[ids[k] * 3 + 1];
		out[k * 3 + 2] = P[ids[k] * 3 + 2];
	}
	return out;
}
/**
* Convex hull of a stride-8 vertex soup (pos+normal+uv — the engine's
* geometry format): dedupes positions (1e-5 grid), runs quickhull, and if
* the hull has more than `maxPoints` vertices, SIMPLIFIES by greedy
* farthest-point sampling down to `maxPoints` (physics cores want small
* hulls; 32–64 is plenty).
*/
function hullOfVerts(verts, maxPoints = 48) {
	const pts = [];
	const seen = /* @__PURE__ */ new Set();
	for (let i = 0; i + 2 < verts.length; i += 8) {
		const x = verts[i], y = verts[i + 1], z = verts[i + 2];
		const key = Math.round(x * 1e5) + ":" + Math.round(y * 1e5) + ":" + Math.round(z * 1e5);
		if (!seen.has(key)) {
			seen.add(key);
			pts.push(x, y, z);
		}
	}
	const hull = quickhull(pts);
	if (hull.length / 3 <= maxPoints) return hull;
	return farthestPoints(hull, maxPoints);
}
/** @internal Greedy farthest-point sampling: keep the `k` most spread-out points. */
function farthestPoints(P, k) {
	const n = P.length / 3;
	let cx = 0, cy = 0, cz = 0;
	for (let i = 0; i < n; i++) {
		cx += P[i * 3];
		cy += P[i * 3 + 1];
		cz += P[i * 3 + 2];
	}
	cx /= n;
	cy /= n;
	cz /= n;
	let seed = 0, seedD = -1;
	for (let i = 0; i < n; i++) {
		const d = (P[i * 3] - cx) ** 2 + (P[i * 3 + 1] - cy) ** 2 + (P[i * 3 + 2] - cz) ** 2;
		if (d > seedD) {
			seedD = d;
			seed = i;
		}
	}
	const chosen = [seed];
	const minD = new Float64Array(n);
	const relax = (j) => {
		const jx = P[j * 3], jy = P[j * 3 + 1], jz = P[j * 3 + 2];
		for (let i = 0; i < n; i++) {
			const d = (P[i * 3] - jx) ** 2 + (P[i * 3 + 1] - jy) ** 2 + (P[i * 3 + 2] - jz) ** 2;
			if (d < minD[i]) minD[i] = d;
		}
	};
	minD.fill(Infinity);
	relax(seed);
	while (chosen.length < k) {
		let next = -1, nextD = -1;
		for (let i = 0; i < n; i++) if (minD[i] > nextD) {
			nextD = minD[i];
			next = i;
		}
		if (next < 0 || nextD <= 0) break;
		chosen.push(next);
		relax(next);
	}
	const out = new Float32Array(chosen.length * 3);
	for (let m = 0; m < chosen.length; m++) {
		out[m * 3] = P[chosen[m] * 3];
		out[m * 3 + 1] = P[chosen[m] * 3 + 1];
		out[m * 3 + 2] = P[chosen[m] * 3 + 2];
	}
	return out;
}
//#endregion
//#region src/lib/rider3d.ts
/** Fore-aft sample offsets across a footprint of length L (a symmetric
* 5-tap line, or a single centre tap when L = 0). Exported for the tests. */
function footprintTaps(L) {
	if (L <= 0) return [0];
	const h = L / 2;
	return [
		-h,
		-h / 2,
		0,
		h / 2,
		h
	];
}
/** Build the contact footprint for a shape (exported for the tests). A
* PLANK/point is a symmetric plus of fore×side taps; a SPHERE is the
* centre + two rings sampling the ball's contact disc (averaged). */
function buildFootprint(contact, length, width, radius, ringTaps) {
	if (contact === "sphere") {
		const out = [{
			f: 0,
			s: 0
		}];
		const K = Math.max(3, Math.round(ringTaps));
		for (const rr of [radius * .55, radius * .9]) for (let k = 0; k < K; k++) {
			const a = 2 * Math.PI * k / K;
			out.push({
				f: Math.cos(a) * rr,
				s: Math.sin(a) * rr
			});
		}
		return out;
	}
	const out = [];
	for (const f of footprintTaps(length)) out.push({
		f,
		s: 0
	});
	for (const s of footprintTaps(width)) if (s !== 0) out.push({
		f: 0,
		s
	});
	return out;
}
var TerrainRider = class {
	/** Horizontal position (the game writes these via step). */
	x = 0;
	z = 0;
	/** Heading the footprint is sampled along (radians). */
	yaw = 0;
	/** The smoothed ride height — set this on your mesh. */
	y = 0;
	/** Vertical velocity (managed in the air; 0 while grounded). */
	vy = 0;
	grounded = true;
	/** Seconds since takeoff (frozen at flight length after landing — read it
	* on the `landed` frame to scale a stomp/impact). */
	airTime = 0;
	/** True ONLY on the frame the rider touched down. */
	landed = false;
	/** Surface-following orientation for the body (radians). Add your own
	* lean (carve, steer) on top. */
	pitch = 0;
	roll = 0;
	/** The fitted along-heading slope (dY/dForward), smoothed. */
	slope = 0;
	/** This frame's raw support height and last frame's — the delta is the
	* height traded for speed if you run an energy model (v² += 2g·Δh). */
	groundY = 0;
	lastGroundY = 0;
	o;
	prevY = 0;
	smoothSlope = 0;
	smoothRoll = 0;
	started = false;
	constructor(opts) {
		const contact = opts.contact ?? (opts.radius ? "sphere" : opts.length ? "plank" : "point");
		this.o = {
			groundAt: opts.groundAt,
			foot: buildFootprint(contact, opts.length ?? 0, opts.width ?? 0, opts.radius ?? 0, opts.ringTaps ?? 12),
			mode: contact === "sphere" ? "mean" : "max",
			radius: opts.radius ?? 0,
			tilt: opts.tilt ?? contact === "plank",
			settle: opts.settle ?? 0,
			gravity: opts.gravity ?? 30,
			detach: opts.detach ?? .9,
			followK: opts.followK ?? 25,
			followKGain: opts.followKGain ?? .5,
			followKMax: opts.followKMax ?? 55,
			slopeK: opts.slopeK ?? 14,
			orientK: opts.orientK ?? 10,
			pitchGain: opts.pitchGain ?? .9,
			rollGain: opts.rollGain ?? .9,
			maxFall: opts.maxFall ?? 200
		};
	}
	/**
	* Where the body rests on the terrain, and the surface slope under it.
	* SPHERE: the smooth upper envelope of spherical caps — `max(ground +
	* √(R²−d²))` — which meets the terrain tangentially, so a ball rolls
	* over quad kinks and bridges notches without the hard support-switching
	* a footprint max() gives (Rich: the ball's residual incline jitter).
	* PLANK: a plane at the fitted slope, laid on the highest contact —
	* bridges dips, pivots crests, banks to the slope. Pure (tests drive it).
	*/
	sample(x, z, yaw) {
		const o = this.o, g = o.groundAt;
		const fx = -Math.sin(yaw), fz = Math.cos(yaw);
		const sx = fz, sz = -fx;
		let fNum = 0, fDen = 0, sNum = 0, sDen = 0, sum = 0;
		const hs = [];
		for (const p of o.foot) {
			const h = g(x + fx * p.f + sx * p.s, z + fz * p.f + sz * p.s);
			hs.push(h);
			sum += h;
			if (o.tilt) {
				fNum += p.f * h;
				fDen += p.f * p.f;
				sNum += p.s * h;
				sDen += p.s * p.s;
			}
		}
		const slopeFore = o.tilt && fDen > 1e-9 ? fNum / fDen : 0;
		const slopeSide = o.tilt && sDen > 1e-9 ? sNum / sDen : 0;
		let support;
		if (o.mode === "mean") support = sum / o.foot.length + o.radius;
		else {
			support = -Infinity;
			for (let i = 0; i < o.foot.length; i++) {
				const p = o.foot[i];
				support = Math.max(support, hs[i] - slopeFore * p.f - slopeSide * p.s);
			}
		}
		return {
			support,
			slopeFore,
			slopeSide
		};
	}
	/** Place the rider on the ground at (x, z), at rest — call before the
	* first step (and on respawn). */
	reset(x, z, yaw = 0) {
		this.x = x;
		this.z = z;
		this.yaw = yaw;
		const { support } = this.sample(x, z, yaw);
		this.groundY = support;
		this.lastGroundY = support;
		this.y = support - this.o.settle;
		this.prevY = this.y;
		this.vy = 0;
		this.grounded = true;
		this.airTime = 0;
		this.landed = false;
		this.smoothSlope = 0;
		this.smoothRoll = 0;
		this.slope = 0;
		this.pitch = 0;
		this.roll = 0;
		this.started = true;
	}
	/** Pop into the air with an initial upward velocity (a jump). */
	launch(vy) {
		this.grounded = false;
		this.vy = vy;
		this.airTime = 0;
	}
	/**
	* Advance one frame. The GAME has already moved the rider horizontally —
	* pass the new (x, z, yaw). `speed` (horizontal, world u/s) tunes the
	* suspension stiffness; omit it and it's derived from the move. Sets y,
	* pitch, roll, grounded, landed, airTime, groundY/lastGroundY.
	*/
	step(dt, x, z, yaw, speed) {
		if (!this.started) {
			this.reset(x, z, yaw);
			return;
		}
		const o = this.o;
		const spd = speed ?? Math.hypot(x - this.x, z - this.z) / Math.max(dt, 1e-4);
		this.x = x;
		this.z = z;
		this.yaw = yaw;
		this.landed = false;
		const { support, slopeFore, slopeSide } = this.sample(x, z, yaw);
		this.lastGroundY = this.groundY;
		this.groundY = support;
		const target = support - o.settle;
		if (this.grounded) if (target < this.y - o.detach) {
			this.grounded = false;
			this.vy = Math.min(0, (this.y - this.prevY) / Math.max(dt, 1e-4));
			this.airTime = 0;
		} else {
			const k = Math.min(o.followKMax, o.followK + spd * o.followKGain);
			this.y += (target - this.y) * (k === Infinity ? 1 : 1 - Math.exp(-dt * k));
			if (o.tilt) {
				this.smoothSlope += (slopeFore - this.smoothSlope) * (1 - Math.exp(-dt * o.slopeK));
				this.smoothRoll += (slopeSide - this.smoothRoll) * (1 - Math.exp(-dt * o.slopeK));
				this.slope = this.smoothSlope;
				this.pitch += (Math.atan(-this.smoothSlope) * o.pitchGain - this.pitch) * (1 - Math.exp(-dt * o.orientK));
				this.roll += (Math.atan(this.smoothRoll) * o.rollGain - this.roll) * (1 - Math.exp(-dt * o.orientK));
			}
		}
		else {
			this.vy = Math.max(-o.maxFall, this.vy - o.gravity * dt);
			this.airTime += dt;
			this.y += this.vy * dt;
			if (this.y <= target) {
				this.y = target;
				this.grounded = true;
				this.landed = true;
				this.vy = 0;
			} else if (o.tilt) this.pitch += (Math.min(.5, this.vy * -.04) - this.pitch) * (1 - Math.exp(-dt * o.orientK));
		}
		this.prevY = this.y;
	}
};
//#endregion
//#region src/lib/state.ts
/**
* Create a state machine. Use for game screen flow (title / playing / game-over) and pause overlays.
* @param onEnterState Optional callback fired on every state entry — use it to clear held-key state so input doesn't bleed across screens.
* @param motion Optional motion system (`this.tween`) automatically frozen/thawed on suspend/resume.
*/
function createStateMachine(onEnterState, motion) {
	const states = /* @__PURE__ */ new Map();
	let current = null;
	let suspended = null;
	let pending = null;
	const enter = (name, prev) => {
		onEnterState?.();
		states.get(name)?.onEnter?.(prev);
	};
	return {
		registerState(name, hooks) {
			states.set(name, hooks);
		},
		requestTransition(next, reason) {
			pending = {
				kind: "transition",
				next,
				reason
			};
		},
		requestSuspend(overlay, reason) {
			pending = {
				kind: "suspend",
				overlay,
				reason
			};
		},
		requestResume(reason) {
			pending = {
				kind: "resume",
				reason
			};
		},
		processPending() {
			if (!pending) return;
			const action = pending;
			pending = null;
			if (action.kind === "transition") {
				const prev = current;
				if (prev) states.get(prev)?.onExit?.(action.next);
				current = action.next;
				enter(current, prev);
			} else if (action.kind === "suspend") {
				if (current) states.get(current)?.onSuspend?.(action.reason);
				suspended = current;
				current = action.overlay;
				enter(current, suspended);
				motion?.pause();
			} else if (action.kind === "resume") {
				if (current) states.get(current)?.onExit?.(suspended);
				current = suspended;
				suspended = null;
				onEnterState?.();
				if (current) states.get(current)?.onResume?.(action.reason);
				motion?.resume();
			}
		},
		update(delta) {
			if (current) states.get(current)?.onUpdate?.(delta);
		},
		get current() {
			return current;
		}
	};
}
//#endregion
//#region src/lib/persistence.ts
/** Thin localStorage persistence layer — high scores, settings, unlocks. Keys should be namespaced per game (e.g. `'highscore.pacman'`). Safe where localStorage is unavailable: `read` returns the fallback, `write` silently no-ops. */
/** Read/write helpers for persistent game data (save data / high scores / settings). */
var persist = {
	/** Read a value from localStorage by `key`. Returns `fallback` if the key is absent or storage is unavailable. */
	read(key, fallback) {
		try {
			const raw = localStorage.getItem(key);
			return raw === null ? fallback : JSON.parse(raw);
		} catch {
			return fallback;
		}
	},
	/** Write a JSON-serialisable `value` to localStorage under `key`. Silently no-ops if storage is unavailable or full. */
	write(key, value) {
		try {
			localStorage.setItem(key, JSON.stringify(value));
		} catch {}
	}
};
//#endregion
//#region src/lib/vectorkit.ts
var vectorkit_exports = /* @__PURE__ */ __exportAll({
	MAX_HULL_POINTS: () => 8,
	VECTOR_CHARSET: () => VECTOR_CHARSET,
	arcHit: () => arcHit,
	arcPoints: () => arcPoints,
	arcSteps: () => arcSteps,
	circleHit: () => circleHit,
	climbableX: () => climbableX,
	convexHull: () => convexHull,
	convexPieces: () => convexPieces,
	craterHeightfield: () => craterHeightfield,
	drawFragments: () => drawFragments,
	focalLength: () => focalLength,
	generatePolygon: () => generatePolygon,
	generateTerrain: () => generateTerrain,
	generateTube: () => generateTube,
	glyphOutline: () => glyphOutline,
	gravityAccel: () => gravityAccel,
	heightAtX: () => heightAtX,
	horizon: () => horizon,
	hullFor: () => hullFor,
	integrateMotion: () => integrateMotion,
	isConvex: () => isConvex,
	placeModel: () => placeModel,
	placeModelOnGround: () => placeModelOnGround,
	pointInPolygon: () => pointInPolygon,
	polylineSegments: () => polylineSegments,
	predictPath: () => predictPath,
	project: () => project,
	projectPoint: () => projectPoint,
	resolveSurface: () => resolveSurface,
	ringSections: () => ringSections,
	segmentIntersection: () => segmentIntersection,
	shatterPolygon: () => shatterPolygon,
	signedAngle: () => signedAngle,
	simplifyHull: () => simplifyHull,
	surfaceFriction: () => surfaceFriction,
	sweepVsSegments: () => sweepVsSegments,
	textOutline: () => textOutline,
	textWidth: () => textWidth,
	transformVerts: () => transformVerts$1,
	triangulate: () => triangulate$1,
	updateFragments: () => updateFragments,
	vec: () => vec,
	wireBounds: () => wireBounds,
	wireBox: () => wireBox,
	wireGrid: () => wireGrid,
	wrapPosition: () => wrapPosition,
	wrapPositions: () => wrapPositions
});
/**
* 2D vector math over plain `{x, y}` data, as a single namespace so the generic
* names (`add`, `scale`, `dot`…) don't collide with anything in a game's scope.
*/
var vec = {
	add(a, b) {
		return {
			x: a.x + b.x,
			y: a.y + b.y
		};
	},
	sub(a, b) {
		return {
			x: a.x - b.x,
			y: a.y - b.y
		};
	},
	scale(a, s) {
		return {
			x: a.x * s,
			y: a.y * s
		};
	},
	dot(a, b) {
		return a.x * b.x + a.y * b.y;
	},
	len2(a) {
		return a.x * a.x + a.y * a.y;
	},
	len(a) {
		return Math.sqrt(a.x * a.x + a.y * a.y);
	},
	dist2(a, b) {
		const dx = a.x - b.x, dy = a.y - b.y;
		return dx * dx + dy * dy;
	},
	dist(a, b) {
		return Math.sqrt(vec.dist2(a, b));
	},
	/** Zero-safe normalize: a zero vector returns `{0,0}` rather than NaN. */
	normalize(a) {
		const l = Math.sqrt(a.x * a.x + a.y * a.y);
		return l > 0 ? {
			x: a.x / l,
			y: a.y / l
		} : {
			x: 0,
			y: 0
		};
	},
	/** Clamp a vector's magnitude to at most `max` (terminal-velocity caps). */
	clampLen(a, max) {
		const l2 = a.x * a.x + a.y * a.y;
		if (l2 <= max * max) return {
			x: a.x,
			y: a.y
		};
		const s = max / Math.sqrt(l2);
		return {
			x: a.x * s,
			y: a.y * s
		};
	},
	/** A unit (or `mag`-length) vector at the given angle in radians. */
	fromAngle(rad, mag = 1) {
		return {
			x: Math.cos(rad) * mag,
			y: Math.sin(rad) * mag
		};
	},
	/** The angle of a vector in radians (-PI..PI). */
	angleOf(a) {
		return Math.atan2(a.y, a.x);
	},
	/** Rotate a vector by `rad` radians. */
	rotate(a, rad) {
		const c = Math.cos(rad), s = Math.sin(rad);
		return {
			x: a.x * c - a.y * s,
			y: a.x * s + a.y * c
		};
	},
	/** Linear interpolation between two points. */
	lerp(a, b, t) {
		return {
			x: a.x + (b.x - a.x) * t,
			y: a.y + (b.y - a.y) * t
		};
	},
	/**
	* Move `from` toward `to` by at most `maxStep`, never overshooting (it clamps
	* exactly at `to`).
	*/
	stepToward(from, to, maxStep) {
		const dx = to.x - from.x, dy = to.y - from.y;
		const d = Math.sqrt(dx * dx + dy * dy);
		if (d <= maxStep || d === 0) return {
			x: to.x,
			y: to.y
		};
		const s = maxStep / d;
		return {
			x: from.x + dx * s,
			y: from.y + dy * s
		};
	},
	/** Turn one heading toward another by at most `maxStep` radians (capped steering). */
	turnToward(fromRad, toRad, maxStep) {
		let d = (toRad - fromRad) % (Math.PI * 2);
		if (d > Math.PI) d -= Math.PI * 2;
		if (d < -Math.PI) d += Math.PI * 2;
		if (d > maxStep) d = maxStep;
		if (d < -maxStep) d = -maxStep;
		return fromRad + d;
	}
};
/** Transform local-space vertices to world space by position and rotation. */
function transformVerts$1(localVerts, pos, rot = 0) {
	const c = Math.cos(rot), s = Math.sin(rot);
	return localVerts.map((v) => ({
		x: pos.x + v.x * c - v.y * s,
		y: pos.y + v.x * s + v.y * c
	}));
}
/**
* Ray-casting (even-odd) point-in-polygon test. `worldPoly` MUST be in world
* space — call `transformVerts` first. Handles convex AND concave simple
* polygons of either winding.
*/
function pointInPolygon(point, worldPoly) {
	let inside = false;
	for (let i = 0, j = worldPoly.length - 1; i < worldPoly.length; j = i++) {
		const vi = worldPoly[i], vj = worldPoly[j];
		if (vi.y > point.y !== vj.y > point.y && point.x < (vj.x - vi.x) * (point.y - vi.y) / (vj.y - vi.y) + vi.x) inside = !inside;
	}
	return inside;
}
/** Cheap bounding-circle overlap — the pragmatic default hit test for vector games. */
function circleHit(aPos, aRadius, bPos, bRadius) {
	const dx = aPos.x - bPos.x, dy = aPos.y - bPos.y;
	const r = aRadius + bRadius;
	return dx * dx + dy * dy < r * r;
}
/**
* Generate an irregular asteroid-style silhouette as local-space vertices.
* Generate ONCE at spawn, store on the entity, never per frame (it would shimmer).
*/
function generatePolygon(baseRadius, vertexCount = 10, jaggedness = .4, rng = Math.random) {
	const verts = [];
	for (let i = 0; i < vertexCount; i++) {
		const angle = i / vertexCount * Math.PI * 2;
		const r = baseRadius * (1 + (rng() * 2 - 1) * jaggedness);
		verts.push({
			x: Math.cos(angle) * r,
			y: Math.sin(angle) * r
		});
	}
	return verts;
}
/** Signed angle from one heading to another, in radians (-PI..PI) — capped-turn steering. */
function signedAngle(fromRad, toRad) {
	let d = (toRad - fromRad) % (Math.PI * 2);
	if (d > Math.PI) d -= Math.PI * 2;
	if (d < -Math.PI) d += Math.PI * 2;
	return d;
}
/** Intersection point of segment p1→p2 with segment p3→p4, or null if they don't cross within both spans. */
function segmentIntersection(p1, p2, p3, p4) {
	const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
	const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
	const denom = d1x * d2y - d1y * d2x;
	if (denom === 0) return null;
	const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
	const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / denom;
	if (t < 0 || t > 1 || u < 0 || u > 1) return null;
	return {
		x: p1.x + t * d1x,
		y: p1.y + t * d1y
	};
}
/**
* Sweep a moving point's path (prev → cur) against static wall segments and return
* the EARLIEST contact, or null. The core anti-tunnel test for bodies vs line
* geometry (terrain, cave walls).
*/
function sweepVsSegments(prev, cur, segments) {
	const dx = cur.x - prev.x, dy = cur.y - prev.y;
	const lenPath = Math.sqrt(dx * dx + dy * dy);
	let best = null;
	for (let i = 0; i < segments.length; i++) {
		const hit = segmentIntersection(prev, cur, segments[i].a, segments[i].b);
		if (!hit) continue;
		const t = lenPath > 0 ? Math.sqrt((hit.x - prev.x) ** 2 + (hit.y - prev.y) ** 2) / lenPath : 0;
		if (!best || t < best.t) best = {
			point: hit,
			index: i,
			t
		};
	}
	return best;
}
/** Turn a terrain polyline (or any open path) into wall segments for `sweepVsSegments`. */
function polylineSegments(points) {
	const segs = [];
	for (let i = 0; i < points.length - 1; i++) segs.push({
		a: points[i],
		b: points[i + 1]
	});
	return segs;
}
/**
* The general surface-collision response. Splits the velocity into normal and
* tangential parts against the outward unit `normal`: the normal part bounces
* back scaled by `restitution`; the tangential part is scaled by (1 - `friction`).
* `bounceThreshold` suppresses the bounce below a minimum approach speed so a
* resting body settles instead of jittering.
*/
function resolveSurface(vel, normal, opts = {}) {
	const vn = vel.x * normal.x + vel.y * normal.y;
	if (vn >= 0) return {
		x: vel.x,
		y: vel.y
	};
	const approach = -vn;
	const e = approach > (opts.bounceThreshold ?? 0) ? opts.restitution ?? 0 : 0;
	const k = 1 - (opts.friction ?? 0);
	const tx = vel.x - vn * normal.x;
	const ty = vel.y - vn * normal.y;
	const nn = e * approach;
	return {
		x: tx * k + nn * normal.x,
		y: ty * k + nn * normal.y
	};
}
/**
* Continuous ground friction for a grounded body — damps the velocity ALONG the
* surface, scaled by how flat it is (≈ cos of the slope): full on flat ground,
* less on a steep slope, none on a wall. Call each frame while grounded.
*/
function surfaceFriction(vel, normal, coefficient, dt, gravityDir = {
	x: 0,
	y: 1
}) {
	const glen = Math.hypot(gravityDir.x, gravityDir.y) || 1;
	const upx = -gravityDir.x / glen, upy = -gravityDir.y / glen;
	const grip = Math.max(0, normal.x * upx + normal.y * upy);
	const damp = Math.max(0, 1 - coefficient * grip * dt);
	const vn = vel.x * normal.x + vel.y * normal.y;
	const tx = vel.x - vn * normal.x, ty = vel.y - vn * normal.y;
	return {
		x: vn * normal.x + tx * damp,
		y: vn * normal.y + ty * damp
	};
}
/**
* The summed inverse-square gravitational acceleration on a body at `pos` from
* all `sources` (softened — no singularity at the centre). Add it to the body's
* accel before `integrateMotion`; apply to ships AND bullets so shots curve too.
*/
function gravityAccel(pos, sources, opts = {}) {
	const G = opts.G ?? 1;
	const minR2 = opts.minR2 ?? 1;
	let ax = 0, ay = 0;
	for (let i = 0; i < sources.length; i++) {
		const s = sources[i];
		const dx = s.x - pos.x, dy = s.y - pos.y;
		const r2 = Math.max(dx * dx + dy * dy, minR2);
		const r = Math.sqrt(r2);
		const a = G * s.mass / r2;
		ax += dx / r * a;
		ay += dy / r * a;
	}
	return {
		x: ax,
		y: ay
	};
}
/**
* Advance a bare body one frame, in place — semi-implicit Euler (velocity before
* position; stable under gravity and frame-rate independent) with a
* terminal-speed clamp.
*/
function integrateMotion(body, opts) {
	const dt = opts.delta;
	const ax = (opts.accel?.x ?? 0) + (opts.gravity?.x ?? 0);
	const ay = (opts.accel?.y ?? 0) + (opts.gravity?.y ?? 0);
	body.vx += ax * dt;
	body.vy += ay * dt;
	if (opts.drag) {
		const f = 1 - opts.drag * dt;
		body.vx *= f;
		body.vy *= f;
	}
	if (opts.maxSpeed !== void 0) {
		const sp2 = body.vx * body.vx + body.vy * body.vy;
		const max = opts.maxSpeed;
		if (sp2 > max * max) {
			const s = max / Math.sqrt(sp2);
			body.vx *= s;
			body.vy *= s;
		}
	}
	body.x += body.vx * dt;
	body.y += body.vy * dt;
}
/**
* Forward-simulate a body under an acceleration function, returning sampled
* positions (steps + 1, starting at the current position) — aim arcs, shot
* previews. Pass the SAME acceleration the physics uses so the prediction matches.
*/
function predictPath(body, accelFn, steps, dt, opts = {}) {
	const sim = {
		x: body.x,
		y: body.y,
		vx: body.vx,
		vy: body.vy
	};
	const points = [{
		x: sim.x,
		y: sim.y
	}];
	for (let i = 0; i < steps; i++) {
		integrateMotion(sim, {
			accel: accelFn(sim),
			maxSpeed: opts.maxSpeed,
			drag: opts.drag,
			delta: dt
		});
		points.push({
			x: sim.x,
			y: sim.y
		});
	}
	return points;
}
/**
* Midpoint-displacement terrain as a polyline, sorted left-to-right and
* single-valued in x — ready for `heightAtX` and `polylineSegments`. Generate
* once per level; never per frame.
*/
function generateTerrain(opts) {
	const { width, baseY } = opts;
	const amplitude = opts.amplitude ?? baseY * .4;
	const roughness = opts.roughness ?? .5;
	const iterations = opts.iterations ?? 6;
	const minY = opts.minY ?? 0;
	const maxY = opts.maxY ?? baseY * 2;
	const rng = opts.rng ?? Math.random;
	let points = [{
		x: 0,
		y: baseY
	}, {
		x: width,
		y: baseY
	}];
	let amp = amplitude;
	for (let it = 0; it < iterations; it++) {
		const next = [];
		for (let i = 0; i < points.length - 1; i++) {
			const a = points[i], b = points[i + 1];
			next.push(a);
			const my = (a.y + b.y) / 2 + (rng() * 2 - 1) * amp;
			next.push({
				x: (a.x + b.x) / 2,
				y: Math.max(minY, Math.min(maxY, my))
			});
		}
		next.push(points[points.length - 1]);
		points = next;
		amp *= roughness;
	}
	return points;
}
/**
* Sample the y of a terrain polyline at world x, linearly interpolating between
* the two vertices spanning x. Points must be sorted by x ascending. Returns
* Infinity if x is outside the polyline (treat as: no ground here).
*/
function heightAtX(polyline, x) {
	for (let i = 0; i < polyline.length - 1; i++) {
		const a = polyline[i], b = polyline[i + 1];
		if (x >= a.x && x <= b.x) {
			const t = (x - a.x) / (b.x - a.x);
			return a.y + t * (b.y - a.y);
		}
	}
	return Infinity;
}
/**
* Slope-limited horizontal step along a heightfield. Returns the ALLOWED x: `toX`
* if the step's uphill slope is within `maxClimbSlope` (rise/run — ~1 is 45°),
* otherwise `fromX` (refused). Downhill is always allowed.
*/
function climbableX(terrain, fromX, toX, maxClimbSlope) {
	const yHere = heightAtX(terrain, fromX);
	const yNext = heightAtX(terrain, toX);
	if (!Number.isFinite(yHere) || !Number.isFinite(yNext)) return toX;
	const run = Math.abs(toX - fromX);
	if (run === 0) return toX;
	return (yHere - yNext) / run > maxClimbSlope ? fromX : toX;
}
/**
* Blow a crater into a heightfield polyline, in place — destructible terrain.
* Lowers the surface within `radius` of (cx, cy) following a circular bowl, ONLY
* ever pushing the ground down and clamping to `floorY`, so the surface stays
* single-valued and `heightAtX` stays valid.
*/
function craterHeightfield(polyline, cx, cy, radius, floorY) {
	for (let i = 0; i < polyline.length; i++) {
		const p = polyline[i];
		const dx = p.x - cx;
		if (Math.abs(dx) > radius) continue;
		const bowl = cy + Math.sqrt(Math.max(0, radius * radius - dx * dx));
		if (bowl > p.y) p.y = Math.min(bowl, floorY);
	}
}
/**
* Break a WORLD-space polygon into line fragments that drift and spin apart.
* Pass `transformVerts(entity.verts, pos, rot)` — never local vertices. Append
* the result to a `Fragment[]` you own; advance with `updateFragments`, draw
* with `drawFragments`.
*/
function shatterPolygon(worldVerts, opts = {}) {
	const { speed = 60, life = .8, spin = 2 } = opts;
	const frags = [];
	for (let i = 0; i < worldVerts.length; i++) {
		const a = worldVerts[i], b = worldVerts[(i + 1) % worldVerts.length];
		const mid = {
			x: (a.x + b.x) / 2,
			y: (a.y + b.y) / 2
		};
		const ang = Math.random() * Math.PI * 2;
		frags.push({
			a: {
				x: a.x - mid.x,
				y: a.y - mid.y
			},
			b: {
				x: b.x - mid.x,
				y: b.y - mid.y
			},
			x: mid.x,
			y: mid.y,
			vx: Math.cos(ang) * speed,
			vy: Math.sin(ang) * speed,
			rot: 0,
			vrot: (Math.random() - .5) * spin,
			life,
			maxLife: life
		});
	}
	return frags;
}
/** Advance line fragments and return the survivors — reassign: `this.frags = updateFragments(this.frags, dt)`. */
function updateFragments(frags, dt) {
	for (let i = 0; i < frags.length; i++) {
		const f = frags[i];
		f.x += f.vx * dt;
		f.y += f.vy * dt;
		f.rot += f.vrot * dt;
		f.life -= dt;
	}
	return frags.filter((f) => f.life > 0);
}
/**
* Draw line fragments through the v2 Draw verbs (world space — they scroll with
* the camera). REWRITTEN from the raster original: each fragment is one `d.line`
* whose alpha fades with remaining life (was `ctx.globalAlpha` + `r.drawLine`).
*/
function drawFragments(d, frags, color = "#cdd", width = 1) {
	for (let i = 0; i < frags.length; i++) {
		const f = frags[i];
		const c = Math.cos(f.rot), s = Math.sin(f.rot);
		const ax = f.x + f.a.x * c - f.a.y * s, ay = f.y + f.a.x * s + f.a.y * c;
		const bx = f.x + f.b.x * c - f.b.y * s, by = f.y + f.b.x * s + f.b.y * c;
		d.line(ax, ay, bx, by, width, color, Math.max(0, f.life / f.maxLife));
	}
}
/**
* Wrap a position back into `[0, width) × [0, height)` after integrating
* movement. Mutates `position` in place. Call once per frame.
*/
function wrapPosition(position, width, height) {
	if (position.x < 0) position.x += width;
	else if (position.x >= width) position.x -= width;
	if (position.y < 0) position.y += height;
	else if (position.y >= height) position.y -= height;
}
/**
* Return every screen position at which a wrapping sprite should be drawn this
* frame — the real position plus mirrors for each edge the sprite straddles
* (corners yield the diagonal mirror too, so up to 4 positions).
*/
function wrapPositions(position, radius, width, height) {
	const xs = [position.x];
	if (position.x - radius < 0) xs.push(position.x + width);
	if (position.x + radius > width) xs.push(position.x - width);
	const ys = [position.y];
	if (position.y - radius < 0) ys.push(position.y + height);
	if (position.y + radius > height) ys.push(position.y - height);
	const out = [];
	for (const x of xs) for (const y of ys) out.push({
		x,
		y
	});
	return out;
}
//#endregion
export { AnimMixer, AreaEffector, Assets, Atlas, Audio, BACKDROPS, BACKDROP_PACK, BITMAP_PARAMS, BITS, BackdropChain, BackdropHandle, BackdropLayer, BitmapFont, Body2d, Body3d, Builder, BuoyancyEffector, Camera, Cave, Character3d, CollisionGrid, DEPTH_FORMAT, DebugOverlay, DefaultGameOver, DefaultTitle, Draw, Dungeon, DynamicPath3d, EASING, EFFECTS, EFFECT_PACK, Effector, FILL_FLOATS, FixedClock, FlowGrid, FogGrid, FxBatch, Game, GlowPass, Gpu, GridBatch, Input, Joint, KEY, LINE_FLOATS, LOADING_MIN_MS, Lights2d, LoadingScene, MAX_EFFECT_PARAMS, Maze, McControls, MsdfFont, MsdfRenderer, MsdfText, Particles, Path, Path3d, PathWalker, Physics, Physics2d, Physics3d, PointEffector, PointerTracker, PostChain, PostHandle, PostLayer, Preload, QuadBatch, RAMPS, SOLID_PARAMS, Scene, SceneInput, Screen, Solid, Sprite, SpritePool, SurfaceEffector, TerrainRider, TileGrid, Tilemap, Track, TrackWalker, TrailEmitter, Tween, TweenHandle, STRIDE as UI_STRIDE, UI_STYLES, UI_THEMES, Ui, UiRenderer, UnicodeText, VFX, VFX_PACK, VecStarfield, VecTrail, VectorLayer, VectorShape, VfxSystem, Visibility2d, WHITE, XFORM_FLOATS, Z_RANGE, bakeFont, boundsIntersection, boundsOverlap, boundsUnion, breakOpportunities, buildBackdropWGSL, buildEffectWGSL, buildFill, buildFillWGSL, buildFootprint, buildGridWGSL, buildLineWGSL, buildUiTheme, capsuleVerts, catmullRom3, chainJoins, circleVerts, clipToPixels, clipToScissor, colorkit_exports as colorKit, composeChain, composeWorlds, coneVerts, createStateMachine, cubeEdges, cubeVerts, cylinderVerts, decomposeTRS, defineUiStyle, detectDirection, discVerts, earClip, easeLoadingFill, effectDefaults, effectParamIndex, eraseFrom, eulerToQuat, extrudeVerts, facing, fbm2, fontsSettled, footprintTaps, forward, fragmentAlpha, frustumPlanes, fxNeedsShader, getImage, getMapByName, graphemes, hashCode, hullOfVerts, installErrorOverlay, intersectVerts, isBinaryCached, isFontCached, isFontUsable, isImageCached, isLatinText, isModelCached, isRtlCodePoint, isTextCached, jointPalette, latheVerts, limit, loadBinary, loadFont, loadImage, loadJson, loadLevel, loadText, loadingBarProgress, lookAtEuler, makeBounds, makeRng, mapRange, mat4Inverse, mat4LookAt, mat4Mul, mat4MulTo, mat4Ortho, mat4Perspective, mat4Project, mcControls, merge, msdfTextureFrom, mulberry32, noiseCanvas, noiseData, noisePerm, normalizeDebug, noteFreq, on, overlaps, packColor, packDashParams, packParams, packShelves, packSolidParams, packUiColor, panelVerts, parseMsdfFont, particleCanvas, perlin2, persist, planeVerts, polySegs, polyhedronVerts, quatMul, quatRotate, quatSlerp, quatToEuler, quickhull, randomItem, rasterText, rayFromNdc, rayObb, rayObbLocal, rayPlaneY, raySphere, registerVfx, resolveRamp, resolveUiStyle, resolveVfx, rgba, ringVerts, roundTo, roundedBoxVerts, sameClip, sampleChannel, segJoins, segmentStyles, separate, shaderModule, shapeOrigin, shapeVerts, solid, spawnFragment, sphereVerts, sphereVsFrustum, spriteContainsPoint, stepFragment, subtractVerts, textOverlaps, textureFromCanvas, toDeg, toInt, toRad, torusKnotVerts, torusVerts, transformVerts, transformedBounds, trsToMat4, tubeVerts, unionVerts, vec3, vectorkit_exports as vectorKit, viewBasis, wedgeVerts };

//# sourceMappingURL=webgpu.js.map
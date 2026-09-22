//#region src/lib/gpu.ts
/** GPUBufferUsage / GPUTextureUsage / GPUShaderStage bit constants, spelled out
* so the module never touches the runtime globals (absent in Node). */
var BITS = {
	MAP_READ: 1,
	COPY_SRC: 4,
	COPY_DST: 8,
	INDIRECT: 256,
	VERTEX: 32,
	UNIFORM: 64,
	STORAGE: 128,
	TEXTURE_BINDING: 4,
	RENDER_ATTACHMENT: 16,
	STAGE_VERTEX: 1,
	STAGE_FRAGMENT: 2,
	STAGE_COMPUTE: 4
};
/**
* Create a shader module and log any WGSL compile errors to the console —
* WGSL failures are otherwise SILENT (a pipeline just draws nothing). Every
* module in the engine goes through this (or replicates it); compute kernels
* especially, since a broken kernel has no visual symptom at all.
*/
function shaderModule(device, code, label) {
	const mod = device.createShaderModule({
		code,
		label
	});
	mod.getCompilationInfo().then((info) => {
		for (const m of info.messages) if (m.type === "error") console.error(`${label} WGSL ${m.lineNum}:${m.linePos} ${m.message}`);
	});
	return mod;
}
/** The live GPU handles for one canvas, with device-loss recovery built in. */
var Gpu = class Gpu {
	device;
	context;
	format;
	canvas;
	opts;
	rebuildFns = /* @__PURE__ */ new Set();
	lostForever = false;
	destroyed = false;
	dirty = true;
	ro = null;
	dprMql = null;
	onDprChange = null;
	constructor(device, context, format, canvas, opts) {
		this.device = device;
		this.context = context;
		this.format = format;
		this.canvas = canvas;
		this.opts = opts;
	}
	/**
	* Request adapter + device and configure the canvas for premultiplied-alpha
	* presentation. Returns null where WebGPU is absent or the adapter request
	* fails (possible even when navigator.gpu exists — blocklisted GPUs).
	*/
	static async init(canvas, opts = {}) {
		const gpu = navigator.gpu;
		if (!gpu) return null;
		const adapter = await gpu.requestAdapter({ powerPreference: "high-performance" });
		if (!adapter) return null;
		const device = await adapter.requestDevice();
		const context = canvas.getContext("webgpu");
		if (!context) return null;
		const format = gpu.getPreferredCanvasFormat();
		const self = new Gpu(device, context, format, canvas, opts);
		self.adopt(device);
		context.configure({
			device,
			format,
			alphaMode: "premultiplied"
		});
		self.fit();
		self.watchSize();
		return self;
	}
	/** Watch the canvas for size / dpr changes (see the `dirty` flag) — the fit
	*  is applied lazily on the next `fit()`, so nothing polls the DOM per frame. */
	watchSize() {
		if (typeof window === "undefined") return;
		if (typeof ResizeObserver !== "undefined") {
			this.ro = new ResizeObserver(() => {
				this.dirty = true;
			});
			this.ro.observe(this.canvas);
		}
		const armDpr = () => {
			const dpr = window.devicePixelRatio || 1;
			this.dprMql = window.matchMedia(`(resolution: ${dpr}dppx)`);
			this.onDprChange = () => {
				this.dirty = true;
				armDpr();
			};
			this.dprMql.addEventListener("change", this.onDprChange, { once: true });
		};
		armDpr();
	}
	/** Force the next `fit()` to re-measure (e.g. after a manual layout change). */
	markDirty() {
		this.dirty = true;
	}
	/**
	* Register a callback that recreates an owner's GPU resources from CPU-side
	* state. Fired (in registration order) after a lost device is replaced.
	* Returns an unsubscribe function.
	*/
	onRebuild(fn) {
		this.rebuildFns.add(fn);
		return () => this.rebuildFns.delete(fn);
	}
	/**
	* Size the backing store to the canvas's CSS size × dpr (capped). Called per
	* frame but does NOTHING (not even a DOM read) unless a resize/dpr change has
	* flagged it dirty — so the steady state is a single boolean check.
	*/
	fit() {
		if (!this.dirty) return false;
		this.dirty = false;
		const dpr = Math.min(this.opts.dprCap ?? 1, typeof window !== "undefined" && window.devicePixelRatio || 1);
		const w = Math.max(1, Math.floor((this.canvas.clientWidth || window.innerWidth) * dpr));
		const h = Math.max(1, Math.floor((this.canvas.clientHeight || window.innerHeight) * dpr));
		if (w === this.canvas.width && h === this.canvas.height) return false;
		this.canvas.width = w;
		this.canvas.height = h;
		return true;
	}
	/** True once the device is gone and could not be replaced. */
	get dead() {
		return this.lostForever;
	}
	/** Tear down: stop watching size, drop rebuild hooks, and destroy the device
	*  (frees every GPU texture/buffer the engine created). Idempotent. */
	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.ro?.disconnect();
		this.ro = null;
		if (this.dprMql && this.onDprChange) this.dprMql.removeEventListener("change", this.onDprChange);
		this.dprMql = null;
		this.onDprChange = null;
		this.rebuildFns.clear();
		try {
			this.device.destroy();
		} catch {}
	}
	adopt(device) {
		this.device = device;
		device.addEventListener("uncapturederror", (e) => {
			this.opts.onError?.(`WebGPU: ${e.error?.message ?? "unknown error"}`);
		});
		device.lost.then((info) => {
			if (info.reason === "destroyed") return;
			this.opts.onError?.(`WebGPU device lost (${info.reason || "unknown"}) — rebuilding…`);
			this.recover();
		});
	}
	async recover() {
		if (this.destroyed) return;
		try {
			const gpu = navigator.gpu;
			const adapter = gpu && await gpu.requestAdapter({ powerPreference: "high-performance" });
			if (!adapter) throw new Error("no adapter");
			const device = await adapter.requestDevice();
			this.adopt(device);
			this.context.configure({
				device,
				format: this.format,
				alphaMode: "premultiplied"
			});
			for (const fn of this.rebuildFns) fn(device);
			this.opts.onError?.("WebGPU device rebuilt.");
		} catch (err) {
			this.lostForever = true;
			this.opts.onError?.(`WebGPU device could not be rebuilt: ${String(err)}`);
		}
	}
};
/**
* A dev-visible error trap: page errors, unhandled rejections and engine
* messages append to a fixed overlay. WGSL failures are otherwise SILENT in
* embedded previews — install this in anything you need to debug visually.
*/
function installErrorOverlay() {
	if (typeof document === "undefined") return () => {};
	let box = null;
	const show = (msg) => {
		if (!box) {
			box = document.createElement("div");
			box.style.cssText = "position:fixed;bottom:10px;left:10px;right:10px;max-height:45vh;overflow:auto;color:#ff8080;font:12px/1.4 monospace;background:rgba(20,0,0,.85);padding:8px 12px;border-radius:6px;white-space:pre-wrap;z-index:20";
			document.body.appendChild(box);
		}
		box.textContent += msg + "\n";
	};
	window.addEventListener("error", (e) => show(String(e.message)));
	window.addEventListener("unhandledrejection", (e) => show(String(e.reason)));
	return show;
}
//#endregion
//#region src/lib/batch.ts
var FLOATS = 20;
/** Max distinct z values per frame — z is normalized by this in the shader. */
var Z_RANGE = 1 << 20;
/** The depth buffer format every pipeline in the frame's pass must match. */
var DEPTH_FORMAT = "depth24plus";
var wgsl = (blocky) => `
const BLOCKY = ${blocky};
struct U { view: vec4f }                    // world rect mapped to the canvas: x, y, w, h
// misc: x = rotation (rad), y = mode, z = flipX (sprites) or thickness fraction
// (rings), w = depth (z / Z_RANGE, 0..1, bigger = in front).
// Modes: 0 textured sprite, 1 SDF circle, 2 SDF ring, 3 solid rect.
// tile: xy = uv scroll (frame-fractions), zw = uv repeat counts (1 = normal).
// Tiling wraps with fract() INSIDE the frame's atlas rect in the fragment
// stage (atlas sub-regions can't use hardware sampler repeat) — any sprite
// can scroll/repeat its texture; no TileSprite object exists.
struct Inst { posSize: vec4f, misc: vec4f, color: vec4f, uv: vec4f, tile: vec4f }
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) t01: vec2f,
  @location(1) color: vec4f,
  @location(2) local: vec2f,
  @location(3) modeThick: vec2f,
  @location(4) uvRect: vec4f,
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
  var ux = c01.x;
  if (d.misc.y < 0.5 && d.misc.z > 0.5) { ux = 1.0 - ux; } // flipX: sprites only
  var out: VSOut;
  out.pos = vec4f(ndc.x, -ndc.y, 1.0 - d.misc.w, 1.0);    // bigger z = closer
  out.t01 = vec2f(ux, c01.y) * d.tile.zw + d.tile.xy;     // frame fractions
  out.uvRect = d.uv;
  out.color = d.color;
  out.local = c01;
  out.modeThick = vec2f(d.misc.y, d.misc.z);
  return out;
}

// Shared shape/alpha evaluation. Sample unconditionally (textureSample
// requires uniform control flow), then select by mode.
fn shade(in: VSOut) -> vec4f {
  // Wrap in frame fractions (identity when repeat 1 / scroll 0 — fragment
  // centres interpolate strictly inside [0,1)), then map over the frame's
  // FULL texel extent. Stored uvRect is half-texel INSET (bleed guard) —
  // mapping over the inset rect would squeeze each repeat by one texel and
  // distort the wrap seam, so un-inset for the mapping and clamp the result
  // back into the inset rect (edge texels clamp; neighbours never bleed).
  let texRes = vec2f(textureDimensions(tex));
  let ht = 0.5 / texRes;                       // the baked half-texel inset
  let lo = in.uvRect.xy - ht;
  let hi = in.uvRect.zw + ht;
  let f = fract(in.t01);
  var uv = clamp(vec2f(mix(lo.x, hi.x, f.x), mix(lo.y, hi.y, f.y)), in.uvRect.xy, in.uvRect.zw);
  if (BLOCKY) {
    // Texel-snap with a derivative-wide AA seam (the Phaser 4 Blocky trick).
    // Derivatives come from the UNWRAPPED coords — fract() breaks them at
    // wrap columns; the wrapped/unwrapped coords differ only by constants.
    let cont = in.t01 * (hi - lo) * texRes;
    let dd = max(vec2f(
      length(vec2f(dpdx(cont.x), dpdy(cont.x))),
      length(vec2f(dpdx(cont.y), dpdy(cont.y)))), vec2f(1e-6));
    let tc = uv * texRes;
    let seam = floor(tc + 0.5);
    let snapped = clamp((tc - seam) / dd + seam, seam - 0.5, seam + 0.5);
    uv = clamp(snapped / texRes, in.uvRect.xy, in.uvRect.zw);
  }
  let t = textureSample(tex, samp, uv);
  let dist = length(in.local - vec2f(0.5)) * 2.0;   // 0 centre -> 1 quad edge
  let aa = max(fwidth(dist), 0.0001);
  let circleA = 1.0 - smoothstep(1.0 - aa, 1.0, dist);
  let inner = 1.0 - max(in.modeThick.y, 0.02);
  let ringA = min(circleA, smoothstep(inner - aa, inner, dist));
  let mode = in.modeThick.x;
  var rgb = t.rgb;
  var a = t.a;
  if (mode > 0.5) { rgb = vec3f(1.0); a = 1.0; }
  if (mode > 0.5 && mode < 1.5) { a = circleA; }
  if (mode > 1.5 && mode < 2.5) { a = ringA; }
  return vec4f(rgb * in.color.rgb, a * in.color.a);
}

@fragment
fn fs_blend(in: VSOut) -> @location(0) vec4f {
  let s = shade(in);
  return vec4f(s.rgb * s.a, s.a);                   // premultiplied out
}

@fragment
fn fs_cutout(in: VSOut) -> @location(0) vec4f {
  let s = shade(in);
  if (s.a < 0.5) { discard; }                       // alpha test — opaque write
  return vec4f(s.rgb, 1.0);
}
`;
/**
* SUBMISSION ORDER ACROSS PASSES.
*
* A sprite and a line of MSDF text are different shaders, so they can never
* share one batch — but a game that draws a sign, then a wall in front of it,
* means exactly what it wrote. This records which batch each push went to, in
* order, so the frame can walk the surface back in submission order and swap
* pipelines where it has to: sprites … break … text … resume sprites.
*
* That costs draw calls, deliberately. A frame that never interleaves records a
* single segment per batch and is exactly as cheap as it was; only a frame that
* actually alternates pays, and only in proportion to how often it alternates.
*
* `src` identifies the batch. Segments are contiguous instance spans, so each
* one is a single instanced draw at an offset.
*/
var DrawOrder = class {
	/** Contiguous spans in submission order. */
	segs = [];
	/** Highest layer recorded this frame. */
	maxLayer = 0;
	/** Start a frame. */
	begin() {
		this.segs.length = 0;
		this.maxLayer = 0;
	}
	/** Record that `src` pushed the instance at `index`, on `layer`. */
	put(src, index, layer) {
		if (layer > this.maxLayer) this.maxLayer = layer;
		const s = this.segs[this.segs.length - 1];
		if (s && s.src === src && s.layer === layer && s.first + s.n === index) s.n++;
		else this.segs.push({
			src,
			layer,
			first: index,
			n: 1
		});
	}
};
/**
* One batch = one pipeline + one atlas texture + one instance buffer. Grows
* (×2) when a frame pushes past capacity — never shrinks, never drops quads.
*/
var QuadBatch = class {
	format;
	data;
	count = 0;
	capacity;
	cutout;
	depthTest;
	additive;
	blocky;
	filter;
	uniformData = /* @__PURE__ */ new Float32Array(4);
	device;
	pipeline;
	layout;
	sampler;
	uniforms;
	instances;
	textureView = null;
	bind = null;
	/**
	* LAYERS. A batch normally has exactly one (0) and `flush(pass)` draws the
	* lot — that is every sprite batch in the engine. The UI-label batch uses
	* more: a window claims the next layer up, so everything belonging to it
	* draws above everything on the layer below, and `flush(pass, n)` is called
	* once per layer in step with the panel and MSDF passes. Contiguous spans
	* rather than a per-instance field: layers are claimed in blocks, so the run
	* list stays one or two entries long in practice.
	*/
	runs = [];
	layer = 0;
	/** The highest layer pushed this frame — how many times the frame must flush. */
	maxLayer = 0;
	/** One upload serves every layer's draw. */
	uploaded = false;
	/**
	* The surface's submission-order log, when this batch takes part in one.
	* Set on the SCENE blend batch, whose content must interleave with the text
	* pass; null on every batch whose slot in the frame is fixed.
	*/
	order = null;
	src = 0;
	constructor(device, format, opts = {}) {
		this.format = format;
		this.capacity = opts.capacity ?? 16384;
		this.cutout = opts.cutout ?? false;
		this.depthTest = opts.depthTest ?? true;
		this.additive = opts.blend === "add";
		this.blocky = opts.blocky ?? false;
		this.filter = this.blocky ? "linear" : opts.filter ?? "linear";
		this.data = new Float32Array(this.capacity * FLOATS);
		this.rebuild(device);
	}
	/** (Re)create every GPU-side object — the device-loss recovery path. */
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
		const module = device.createShaderModule({ code: wgsl(this.blocky) });
		module.getCompilationInfo().then((info) => {
			for (const m of info.messages) if (m.type === "error") console.error(`QuadBatch WGSL ${m.lineNum}:${m.linePos} ${m.message}`);
		});
		this.pipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
			vertex: {
				module,
				entryPoint: "vs"
			},
			fragment: {
				module,
				entryPoint: this.cutout ? "fs_cutout" : "fs_blend",
				targets: [{
					format: this.format,
					blend: this.cutout ? void 0 : this.additive ? {
						color: {
							srcFactor: "one",
							dstFactor: "one"
						},
						alpha: {
							srcFactor: "one",
							dstFactor: "one"
						}
					} : {
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
				depthWriteEnabled: this.cutout && this.depthTest,
				depthCompare: this.depthTest ? "less-equal" : "always"
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
			size: this.capacity * FLOATS * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.bind = null;
		this.textureView = null;
	}
	/** Point the batch at its atlas texture (initially and after rebuild/repack). */
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
	/** Start a frame: map the world rect [x, y, w, h] onto the full canvas. */
	begin(viewX, viewY, viewW, viewH) {
		this.count = 0;
		this.runs.length = 0;
		this.layer = 0;
		this.maxLayer = 0;
		this.uploaded = false;
		this.uniformData[0] = viewX;
		this.uniformData[1] = viewY;
		this.uniformData[2] = viewW;
		this.uniformData[3] = viewH;
	}
	/**
	* Queue one instance. `z`: raw depth (0..Z_RANGE, bigger = in front).
	* `sx/sy` scroll and `rx/ry` repeat the frame's texture across the quad
	* (frame-fraction units; 0,0,1,1 = the plain sprite).
	*/
	push(x, y, w, h, frame, mode, rot, flipOrThick, z, r, g, b, a, sx = 0, sy = 0, rx = 1, ry = 1) {
		if (this.count === this.capacity) this.grow();
		this.order?.put(this.src, this.count, this.layer);
		const run = this.runs[this.runs.length - 1];
		if (run && run.layer === this.layer) run.n++;
		else this.runs.push({
			layer: this.layer,
			first: this.count,
			n: 1
		});
		const o = this.count * FLOATS;
		const d = this.data;
		d[o] = x;
		d[o + 1] = y;
		d[o + 2] = w;
		d[o + 3] = h;
		d[o + 4] = rot;
		d[o + 5] = mode;
		d[o + 6] = flipOrThick;
		d[o + 7] = z / Z_RANGE;
		d[o + 8] = r;
		d[o + 9] = g;
		d[o + 10] = b;
		d[o + 11] = a;
		d[o + 12] = frame.u0;
		d[o + 13] = frame.v0;
		d[o + 14] = frame.u1;
		d[o + 15] = frame.v1;
		d[o + 16] = sx;
		d[o + 17] = sy;
		d[o + 18] = rx;
		d[o + 19] = ry;
		this.count++;
	}
	grow() {
		this.capacity *= 2;
		const next = new Float32Array(this.capacity * FLOATS);
		next.set(this.data);
		this.data = next;
		this.instances.destroy();
		this.instances = this.device.createBuffer({
			size: this.capacity * FLOATS * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.makeBind();
	}
	/**
	* Every instance pushed from here until the next `setLayer`/`begin` belongs to
	* `n`. Only the UI-label batch uses this; a sprite batch stays on layer 0 and
	* the run list stays a single span.
	*/
	setLayer(n) {
		this.layer = n;
		if (n > this.maxLayer) this.maxLayer = n;
	}
	/** @internal Take part in a surface's submission order under id `src`. */
	joinOrder(order, src) {
		this.order = order;
		this.src = src;
	}
	/** Upload once, whichever walk asks first. */
	upload() {
		if (this.count === 0 || !this.bind) return false;
		if (!this.uploaded) {
			this.device.queue.writeBuffer(this.uniforms, 0, this.uniformData);
			this.device.queue.writeBuffer(this.instances, 0, this.data.buffer, 0, this.count * FLOATS * 4);
			this.uploaded = true;
		}
		return true;
	}
	/**
	* @internal Draw ONE contiguous span — the submission-order walk's unit of
	* work. Splitting the batch here is the whole point: a frame that alternates
	* sprites and text gets a draw call per alternation and keeps the order the
	* game wrote.
	*/
	drawRange(pass, first, n) {
		if (n <= 0 || !this.upload()) return;
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		pass.draw(4, n, 0, first);
	}
	/**
	* Upload + draw ONE layer of everything pushed since begin(). The default (0)
	* is the whole batch for every single-layer caller, so this stays one
	* writeBuffer and one draw for sprites.
	*/
	flush(pass, layer = 0) {
		if (!this.upload()) return 0;
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		if (this.runs.length === 1 && this.runs[0].layer === layer) {
			pass.draw(4, this.count);
			return this.count;
		}
		let drawn = 0;
		for (const run of this.runs) {
			if (run.layer !== layer) continue;
			pass.draw(4, run.n, 0, run.first);
			drawn += run.n;
		}
		return drawn;
	}
};
//#endregion
//#region src/lib/color.ts
var cache = /* @__PURE__ */ new Map();
var WHITE = [
	1,
	1,
	1,
	1
];
/** Parse '#rgb' | '#rrggbb' | '#rrggbbaa' to [r,g,b,a] floats 0..1 (cached). */
function rgba(hex) {
	let c = cache.get(hex);
	if (c) return c;
	let h = hex.startsWith("#") ? hex.slice(1) : hex;
	if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
	const n = parseInt(h.length === 6 ? h + "ff" : h, 16);
	if (Number.isNaN(n) || h.length !== 6 && h.length !== 8) c = WHITE;
	else c = [
		(n >>> 24 & 255) / 255,
		(n >>> 16 & 255) / 255,
		(n >>> 8 & 255) / 255,
		(n & 255) / 255
	];
	cache.set(hex, c);
	return c;
}
//#endregion
export { QuadBatch as a, Gpu as c, DrawOrder as i, installErrorOverlay as l, rgba as n, Z_RANGE as o, DEPTH_FORMAT as r, BITS as s, WHITE as t, shaderModule as u };

//# sourceMappingURL=shared-DhV4JtEZ.js.map
import { B as clipToScissor, C as EFFECT_PACK, E as effectDefaults, G as segJoins, H as particleOutline, J as spawnFragment, K as segmentStyles, M as VecTrail, O as Visibility2d, P as VectorShape, Q as arcPoints, S as EFFECTS, U as polySegs, V as fragmentAlpha, W as resolveVecColor, X as tintStyle, Y as stepFragment, b as PostHandle, d as packUiColor, f as sameClip, g as BackdropHandle, j as VecStarfield, m as BACKDROP_PACK, p as BACKDROPS, q as shapeOrigin, u as clipToPixels, xt as textOutline, z as chainJoins } from "./shared-kkws-wjJ.js";
import { i as DrawOrder, n as rgba, o as Z_RANGE } from "./shared-DhV4JtEZ.js";
import { a as instanceVec4Attribs, i as compileProgram, n as GLSL_HEADER, o as textureFromSource, r as InstanceBuffer, t as GLSL_FRAG_HEADER } from "./shared-DByetpIq.js";
//#region src/lib/webgl/context.ts
/** The live WebGL2 handles for one canvas, with context-loss recovery built in. */
var GlContext = class GlContext {
	gl;
	canvas;
	opts;
	rebuildFns = /* @__PURE__ */ new Set();
	lostForever = false;
	destroyed = false;
	dirty = true;
	ro = null;
	dprMql = null;
	onDprChange = null;
	constructor(gl, canvas, opts) {
		this.gl = gl;
		this.canvas = canvas;
		this.opts = opts;
	}
	/**
	* Acquire a WebGL2 context configured for premultiplied-alpha presentation
	* (matching the WebGPU surface) with an antialiased, depth'd default
	* framebuffer. Returns null where WebGL2 is absent.
	*/
	static init(canvas, opts = {}) {
		if (typeof canvas.getContext !== "function") return null;
		const gl = canvas.getContext("webgl2", {
			alpha: true,
			premultipliedAlpha: true,
			antialias: true,
			depth: true,
			stencil: false,
			powerPreference: "high-performance"
		});
		if (!gl) return null;
		const self = new GlContext(gl, canvas, opts);
		canvas.addEventListener("webglcontextlost", (e) => {
			e.preventDefault();
			self.opts.onError?.("WebGL context lost — waiting for restore…");
		});
		canvas.addEventListener("webglcontextrestored", () => {
			if (self.destroyed) return;
			for (const fn of self.rebuildFns) fn(self.gl);
			self.opts.onError?.("WebGL context restored.");
		});
		self.fit();
		self.watchSize();
		return self;
	}
	/** Watch the canvas for size / dpr changes — same event-driven scheme as Gpu. */
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
	/** Register a rebuild callback fired after a lost context is restored. */
	onRebuild(fn) {
		this.rebuildFns.add(fn);
		return () => this.rebuildFns.delete(fn);
	}
	/** Size the backing store to CSS size × dpr (capped) — the Gpu.fit twin. */
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
	/** True once the context is gone for good (only after destroy()). */
	get dead() {
		return this.lostForever || this.gl.isContextLost() && this.destroyed;
	}
	/** Tear down: stop watching size and drop rebuild hooks. Idempotent. */
	destroy() {
		if (this.destroyed) return;
		this.destroyed = true;
		this.ro?.disconnect();
		this.ro = null;
		if (this.dprMql && this.onDprChange) this.dprMql.removeEventListener("change", this.onDprChange);
		this.dprMql = null;
		this.onDprChange = null;
		this.rebuildFns.clear();
		this.gl.getExtension("WEBGL_lose_context")?.loseContext();
		this.lostForever = true;
	}
};
//#endregion
//#region src/lib/webgl/quadbatch.ts
var FLOATS$5 = 20;
/** Vertex shader — the GLSL port of batch.ts's `vs`. Corner from gl_VertexID. */
var buildQuadVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iPosSize;
layout(location=1) in vec4 iMisc;   // rot, mode, flipOrThick, z01
layout(location=2) in vec4 iColor;
layout(location=3) in vec4 iUv;     // atlas rect (half-texel inset)
layout(location=4) in vec4 iTile;   // uv scroll xy, repeat zw
uniform vec4 uView;                 // world rect: x, y, w, h
out vec2 vT01;
out vec4 vColor;
out vec2 vLocal;
out vec2 vModeThick;
out vec4 vUvRect;
void main() {
  vec2 c01 = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 centre = iPosSize.xy + iPosSize.zw * 0.5;
  vec2 off = (c01 - 0.5) * iPosSize.zw;
  float sn = sin(iMisc.x);
  float cn = cos(iMisc.x);
  vec2 world = centre + vec2(off.x * cn - off.y * sn, off.x * sn + off.y * cn);
  vec2 ndc = (world - uView.xy) / uView.zw * 2.0 - 1.0;
  float ux = c01.x;
  if (iMisc.y < 0.5 && iMisc.z > 0.5) { ux = 1.0 - ux; } // flipX: sprites only
  float z01 = 1.0 - iMisc.w;                             // bigger engine z = closer
  gl_Position = vec4(ndc.x, -ndc.y, z01 * 2.0 - 1.0, 1.0);
  vT01 = vec2(ux, c01.y) * iTile.zw + iTile.xy;
  vUvRect = iUv;
  vColor = iColor;
  vLocal = c01;
  vModeThick = vec2(iMisc.y, iMisc.z);
}
`;
/** Fragment shader — the GLSL port of batch.ts's shade()/fs_blend/fs_cutout. */
var buildQuadFragGLSL = (blocky, cutout) => GLSL_FRAG_HEADER + `
#define BLOCKY ${blocky ? 1 : 0}
in vec2 vT01;
in vec4 vColor;
in vec2 vLocal;
in vec2 vModeThick;
in vec4 vUvRect;
uniform sampler2D uTex;
out vec4 outColor;
vec4 shade() {
  vec2 texRes = vec2(textureSize(uTex, 0));
  vec2 ht = 0.5 / texRes;                      // the baked half-texel inset
  vec2 lo = vUvRect.xy - ht;
  vec2 hi = vUvRect.zw + ht;
  vec2 f = fract(vT01);
  vec2 uv = clamp(mix(lo, hi, f), vUvRect.xy, vUvRect.zw);
#if BLOCKY
  // Texel-snap with a derivative-wide AA seam (see batch.ts).
  vec2 cont = vT01 * (hi - lo) * texRes;
  vec2 dd = max(vec2(
    length(vec2(dFdx(cont.x), dFdy(cont.x))),
    length(vec2(dFdx(cont.y), dFdy(cont.y)))), vec2(1e-6));
  vec2 tc = uv * texRes;
  vec2 seam = floor(tc + 0.5);
  vec2 snapped = clamp((tc - seam) / dd + seam, seam - 0.5, seam + 0.5);
  uv = clamp(snapped / texRes, vUvRect.xy, vUvRect.zw);
#endif
  vec4 t = texture(uTex, uv);
  float dist = length(vLocal - vec2(0.5)) * 2.0;
  float aa = max(fwidth(dist), 0.0001);
  float circleA = 1.0 - smoothstep(1.0 - aa, 1.0, dist);
  float inner = 1.0 - max(vModeThick.y, 0.02);
  float ringA = min(circleA, smoothstep(inner - aa, inner, dist));
  float mode = vModeThick.x;
  vec3 rgb = t.rgb;
  float a = t.a;
  if (mode > 0.5) { rgb = vec3(1.0); a = 1.0; }
  if (mode > 0.5 && mode < 1.5) { a = circleA; }
  if (mode > 1.5 && mode < 2.5) { a = ringA; }
  return vec4(rgb * vColor.rgb, a * vColor.a);
}
void main() {
  vec4 s = shade();
${cutout ? "  if (s.a < 0.5) { discard; }\n  outColor = vec4(s.rgb, 1.0);" : "  outColor = vec4(s.rgb * s.a, s.a);"}
}
`;
/**
* One batch = one program + the shared atlas texture + one instance VBO. The
* CPU half (data array, begin/push/grow) is a verbatim twin of QuadBatch.
*/
var GlQuadBatch = class {
	data;
	count = 0;
	capacity;
	cutout;
	depthTest;
	additive;
	blocky;
	filter;
	uniformData = /* @__PURE__ */ new Float32Array(4);
	/** Layer spans — the verbatim twin of QuadBatch's; see batch.ts. */
	runs = [];
	/** The surface's submission-order log, when this batch takes part in one. */
	order = null;
	src = 0;
	layer = 0;
	maxLayer = 0;
	gl;
	program = null;
	vao = null;
	instances;
	uViewLoc = null;
	texture = null;
	constructor(gl, opts = {}) {
		this.capacity = opts.capacity ?? 16384;
		this.cutout = opts.cutout ?? false;
		this.depthTest = opts.depthTest ?? true;
		this.additive = opts.blend === "add";
		this.blocky = opts.blocky ?? false;
		this.filter = this.blocky ? "linear" : opts.filter === "nearest" ? "nearest" : "linear";
		this.data = new Float32Array(this.capacity * FLOATS$5);
		this.rebuild(gl);
	}
	/** (Re)create every GL-side object — the context-loss recovery path. */
	rebuild(gl) {
		this.gl = gl;
		this.program = compileProgram(gl, buildQuadVertGLSL(), buildQuadFragGLSL(this.blocky, this.cutout), "GlQuadBatch");
		this.uViewLoc = this.program ? gl.getUniformLocation(this.program, "uView") : null;
		this.instances = new InstanceBuffer(gl);
		this.vao = null;
		this.texture = null;
	}
	/** Point the batch at its atlas texture (a WebGLTexture on this backend). */
	setTexture(view) {
		this.texture = view;
	}
	/** Start a frame: map the world rect [x, y, w, h] onto the full canvas. */
	begin(viewX, viewY, viewW, viewH) {
		this.count = 0;
		this.runs.length = 0;
		this.layer = 0;
		this.maxLayer = 0;
		this.uniformData[0] = viewX;
		this.uniformData[1] = viewY;
		this.uniformData[2] = viewW;
		this.uniformData[3] = viewH;
	}
	/** Queue one instance — identical signature + packing to QuadBatch.push. */
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
		const o = this.count * FLOATS$5;
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
		const next = new Float32Array(this.capacity * FLOATS$5);
		next.set(this.data);
		this.data = next;
	}
	/** @internal @see QuadBatch.joinOrder */
	joinOrder(order, src) {
		this.order = order;
		this.src = src;
	}
	/** @internal @see QuadBatch.drawRange */
	drawRange(_pass, first, n) {
		if (n <= 0) return;
		const gl = this.gl;
		if (this.count === 0 || !this.program || !this.texture) return;
		this.bindForDraw();
		instanceVec4Attribs(gl, 0, 5, first * FLOATS$5 * 4);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
		gl.bindVertexArray(null);
	}
	/** @see QuadBatch.setLayer — the verbatim twin. */
	setLayer(n) {
		this.layer = n;
		if (n > this.maxLayer) this.maxLayer = n;
	}
	/** Upload + draw ONE layer of everything pushed since begin() — one
	*  bufferSubData, one instanced draw per span. `pass` is unused on this
	*  backend (WebGPU twin parity). */
	/** Program, VAO, upload, texture and pipeline state — shared by both draws. */
	bindForDraw() {
		const gl = this.gl;
		gl.useProgram(this.program);
		gl.uniform4fv(this.uViewLoc, this.uniformData);
		if (!this.vao) this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		this.instances.upload(this.data, this.count * FLOATS$5);
		instanceVec4Attribs(gl, 0, 5);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		const f = this.filter === "nearest" ? gl.NEAREST : gl.LINEAR;
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
		if (this.cutout) gl.disable(gl.BLEND);
		else {
			gl.enable(gl.BLEND);
			if (this.additive) gl.blendFunc(gl.ONE, gl.ONE);
			else gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		}
		if (this.depthTest) {
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);
			gl.depthMask(this.cutout);
		} else {
			gl.disable(gl.DEPTH_TEST);
			gl.depthMask(false);
		}
	}
	flush(_pass, layer = 0) {
		const gl = this.gl;
		if (this.count === 0 || !this.program || !this.texture) return 0;
		this.bindForDraw();
		if (this.runs.length === 1 && this.runs[0].layer === layer) {
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
			gl.bindVertexArray(null);
			return this.count;
		}
		let drawn = 0;
		for (const run of this.runs) {
			if (run.layer !== layer) continue;
			instanceVec4Attribs(gl, 0, 5, run.first * FLOATS$5 * 4);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, run.n);
			drawn += run.n;
		}
		gl.bindVertexArray(null);
		return drawn;
	}
};
//#endregion
//#region src/lib/webgl/tribatch.ts
var FLOATS$4 = 12;
var buildTriVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iTri;   // ax, ay, bx, by
layout(location=1) in vec4 iC;     // cx, cy, _, _
layout(location=2) in vec4 iColor;
uniform vec4 uView;
out vec4 vColor;
void main() {
  vec2 p = iC.xy;
  if (gl_VertexID == 0) { p = iTri.xy; } else if (gl_VertexID == 1) { p = iTri.zw; }
  vec2 ndc = (p - uView.xy) / uView.zw * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  vColor = iColor;
}
`;
var buildTriFragGLSL = () => GLSL_FRAG_HEADER + `
in vec4 vColor;
out vec4 outColor;
void main() {
  outColor = vec4(vColor.rgb * vColor.a, vColor.a);   // premultiplied
}
`;
/** An instanced flat-triangle batch (alpha blend, no depth). */
var GlTriBatch = class {
	/** The surface's submission-order log — see batch.ts's DrawOrder. */
	order = null;
	layer = 0;
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
	capacity = 2048;
	uniformData = /* @__PURE__ */ new Float32Array(4);
	gl;
	program = null;
	vao = null;
	instances;
	uViewLoc = null;
	constructor(gl) {
		this.data = new Float32Array(this.capacity * FLOATS$4);
		this.rebuild(gl);
	}
	rebuild(gl) {
		this.gl = gl;
		this.program = compileProgram(gl, buildTriVertGLSL(), buildTriFragGLSL(), "GlTriBatch");
		this.uViewLoc = this.program ? gl.getUniformLocation(this.program, "uView") : null;
		this.instances = new InstanceBuffer(gl);
		this.vao = null;
	}
	begin(viewX, viewY, viewW, viewH) {
		this.uniformData[0] = viewX;
		this.uniformData[1] = viewY;
		this.uniformData[2] = viewW;
		this.uniformData[3] = viewH;
		this.count = 0;
		this.layer = 0;
	}
	push(ax, ay, bx, by, cx, cy, r, g, b, a) {
		this.order?.put(6, this.count, this.layer);
		if (this.count >= this.capacity) this.grow();
		const o = this.count * FLOATS$4, d = this.data;
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
		const next = new Float32Array(this.capacity * FLOATS$4);
		next.set(this.data);
		this.data = next;
	}
	/** Program, VAO, upload and pipeline state — shared by both draw paths. */
	bindForDraw() {
		const gl = this.gl;
		gl.useProgram(this.program);
		gl.uniform4fv(this.uViewLoc, this.uniformData);
		if (!this.vao) this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		this.instances.upload(this.data, this.count * FLOATS$4);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(false);
	}
	/** @internal @see TriBatch.drawRange */
	drawRange(_pass, first, n) {
		if (n <= 0 || this.count === 0 || !this.program) return;
		const gl = this.gl;
		this.bindForDraw();
		instanceVec4Attribs(gl, 0, 3, first * FLOATS$4 * 4);
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, n);
		gl.bindVertexArray(null);
	}
	flush(_pass) {
		const gl = this.gl;
		if (this.count === 0 || !this.program) return;
		this.bindForDraw();
		instanceVec4Attribs(gl, 0, 3);
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, this.count);
		gl.bindVertexArray(null);
	}
};
//#endregion
//#region src/lib/webgl/msdf.ts
var STRIDE_BYTES$2 = 112;
/** Vertex shader — the GLSL port of msdf.ts's `vs`. The pos array<vec2f, 4>
*  arrives as two vec4 slots (TL.xy TR.xy | BL.xy BR.xy). */
var buildMsdfVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iPosA;   // corner TL.xy, TR.xy
layout(location=1) in vec4 iPosB;   // corner BL.xy, BR.xy
layout(location=2) in vec4 iUv;     // uMin, vTop, uMax, vBottom
layout(location=3) in uvec4 iCol;   // packed ABGR fill / corner
layout(location=4) in uvec4 iOutl;  // packed ABGR outline (or shadow) / corner
layout(location=5) in uvec4 iPar;   // packed weight,rounded,width,softness / corner
layout(location=6) in vec4 iMv;     // unitRangeX, unitRangeY, depth, pad
uniform vec4 uView;                 // world rect: x, y, w, h
out vec2 vUv;
out vec4 vCol;
out vec4 vOutl;
out vec4 vPar;
out vec2 vUnit;
vec4 unpackRGBA(uint v) {
  return vec4(float(v & 0xffu), float((v >> 8u) & 0xffu), float((v >> 16u) & 0xffu), float((v >> 24u) & 0xffu)) / 255.0;
}
void main() {
  int vi = gl_VertexID;
  vec2 world = vi == 0 ? iPosA.xy : vi == 1 ? iPosA.zw : vi == 2 ? iPosB.xy : iPosB.zw;
  vec2 ndc = (world - uView.xy) / uView.zw * 2.0 - 1.0;
  vec2 c01 = vec2(float(vi & 1), float(vi >> 1));
  gl_Position = vec4(ndc.x, -ndc.y, (1.0 - iMv.z) * 2.0 - 1.0, 1.0);
  vUv = vec2(mix(iUv.x, iUv.z, c01.x), mix(iUv.y, iUv.w, c01.y));
  vCol = unpackRGBA(iCol[vi]);
  vOutl = unpackRGBA(iOutl[vi]);
  vPar = unpackRGBA(iPar[vi]);
  vUnit = iMv.xy;
}
`;
/** Fragment shader — the GLSL port of msdf.ts's `fs` (both lanes, verbatim
*  field math; dpdx/dpdy become dFdx/dFdy). */
var buildMsdfFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vUv;
in vec4 vCol;
in vec4 vOutl;
in vec4 vPar;
in vec2 vUnit;
uniform sampler2D uTex;
out vec4 outColor;

float median3(float r, float g, float b) { return max(min(r, g), min(max(r, g), b)); }

// Exact signed distance to a rounded box centred on the origin, negative inside.
float roundedBox(vec2 p, vec2 extent, float r) {
  vec2 q = abs(p) - (extent - r);
  return length(max(q, vec2(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

void main() {
  vec4 texel = texture(uTex, vUv);
  float msdf = median3(texel.r, texel.g, texel.b);
  float tsdf = texel.a;                          // true SDF — meaningful on MTSDF only

  // Screen size (px) of this quad's UV box, from the true gradient magnitude of
  // each coord (not fwidth, which overestimates under rotation). Serves both
  // lanes: a glyph's AA width, and a rect's own width/height for the box SDF.
  vec2 duvdx = dFdx(vUv);
  vec2 duvdy = dFdy(vUv);
  vec2 texGrad = vec2(length(vec2(duvdx.x, duvdy.x)), length(vec2(duvdx.y, duvdy.y)));
  vec2 screenTexSize = vec2(1.0) / max(texGrad, vec2(1e-8));

  // ── Bitmap lane (sentinel 253): a finished PREMULTIPLIED raster (a
  // UnicodeText block), tinted by col. Below the dFdx/dFdy above for the same
  // reason as the WGSL original — derivatives need uniform control flow.
  if (vPar.r >= 252.5 / 255.0 && vPar.r < 253.5 / 255.0) {
    outColor = texel * vec4(vCol.rgb * vCol.a, vCol.a);
    return;
  }

  float softNorm = vPar.a;
  float softStep = step(0.5 / 255.0, softNorm);

  float fillCoverage = 0.0;
  float outlineCoverage = 0.0;
  float tone = 0.0;
  float fade = 1.0;

  // par.r >= 254/255 is the solid-rect sentinel (glyphs clip to 252/255, 253 is
  // the bitmap lane handled above). A rect writes it to all four corners, so
  // the branch is uniform per primitive.
  if (vPar.r >= 253.5 / 255.0) {
    // ── Solid lane: rounded box ──
    vec2 halfSize = 0.5 * screenTexSize;
    vec2 boxCoord = (vUv - vec2(0.5)) * screenTexSize;
    float borderNorm = vPar.b;

    if (vPar.r < 254.5 / 255.0) {                // 254 = dashed: fold U into one cell
      boxCoord.x = (fract(vUv.x) - 0.5) * screenTexSize.x;
      halfSize.x = halfSize.x * borderNorm;      // borderNorm is the duty cycle here
      borderNorm = 0.0;
    }

    float unit = min(halfSize.x, halfSize.y);
    float boxDist = roundedBox(boxCoord, halfSize, vPar.g * unit);
    float borderPx = borderNorm * unit;
    float softPx = vPar.a * unit;
    float sDepth = -boxDist;                     // positive inside the pill
    float sHalfSoft = 0.5 * softPx;
    float sSoft = max(softPx, 1.0);
    fillCoverage = clamp((sDepth - borderPx - sHalfSoft) / sSoft + 0.5, 0.0, 1.0);
    outlineCoverage = clamp((sDepth - sHalfSoft) / sSoft + 0.5, 0.0, 1.0);
    tone = clamp(sDepth / max(max(borderPx, softPx), 1.0), 0.0, 1.0);
    fade = 1.0;
  } else {
    // ── Glyph lane: distance field ──
    float px = max(0.5 * dot(vUnit, screenTexSize), 1.0);
    float weight = vPar.r - (128.0 / 255.0);     // signed; 128 neutral
    float rounded = vPar.g;
    float widthNorm = vPar.b * 0.5;              // byte spans [0, 0.5]
    float halfSoft = 0.5 * softNorm;

    float fillEdge = 0.5 - weight;               // fill keeps median(rgb): sharp corners
    float outlineEdge = fillEdge - widthNorm;
    float outlineDist = mix(msdf, tsdf, rounded); // outline/shadow may round off the true SDF
    float gDepth = outlineDist - outlineEdge;
    float gAA = 1.0 / px;

    fillCoverage = clamp((msdf - fillEdge) * px + 0.5, 0.0, 1.0);
    outlineCoverage = clamp(gDepth / max(softNorm, gAA) + 0.5, 0.0, 1.0);
    tone = clamp((gDepth + halfSoft) / max(widthNorm + halfSoft, gAA), 0.0, 1.0);
    // Suppress background haze at extreme minification; soft glows survive it.
    fade = max(smoothstep(0.0, 0.2, outlineDist), softStep);
  }

  // ── One composite (shared) ──
  tone = mix(tone, tone * tone, softStep);       // hold outer hue through a soft halo
  float twoTone = 1.0 - step(0.5 / 255.0, vCol.a); // fill alpha 0 => col.rgb is the inner colour
  vec3 outlineRgb = mix(vOutl.rgb, vCol.rgb, tone * twoTone);

  float af = fillCoverage * vCol.a;
  float ao = outlineCoverage * vOutl.a * fade;
  float a = af + ao * (1.0 - af);
  vec3 rgb = vCol.rgb * af + outlineRgb * (ao * (1.0 - af));
  outColor = vec4(rgb, a);                       // premultiplied
}
`;
/**
* The MSDF glyph batch — the GL twin of MsdfRenderer. The CPU half (alloc /
* runs / grow) is a verbatim twin; flush uploads the mixed stream once and
* draws one attribute-offset sub-range per atlas texture.
*/
var GlMsdfRenderer = class {
	/** The packed instance stream MsdfText writes into (see msdf.ts). */
	f32;
	u32;
	count = 0;
	capacity = 2048;
	runs = [];
	uniformData = /* @__PURE__ */ new Float32Array(4);
	targetW = 1;
	targetH = 1;
	/** The clip every subsequent alloc() inherits (see msdf.ts). */
	clip = null;
	/** Draw layer every subsequent alloc() inherits — see ui.ts's UiRenderer.flush. */
	layer = 0;
	/** Highest layer used this frame — how many times the frame must flush. */
	maxLayer = 0;
	/** The surface's submission-order log — see batch.ts's DrawOrder. */
	order = null;
	/** @internal Take part in a surface's submission order. */
	joinOrder(order) {
		this.order = order;
	}
	/** Device pixels per draw unit this frame — UnicodeText's raster budget. */
	pxPerUnit = 1;
	gl;
	program = null;
	vao = null;
	instances;
	uViewLoc = null;
	constructor(gl) {
		this.f32 = new Float32Array(this.capacity * 28);
		this.u32 = new Uint32Array(this.f32.buffer);
		this.rebuild(gl);
	}
	/** (Re)create every GL-side object — the context-loss recovery path. */
	rebuild(gl) {
		this.gl = gl;
		this.program = compileProgram(gl, buildMsdfVertGLSL(), buildMsdfFragGLSL(), "GlMsdfRenderer");
		this.uViewLoc = this.program ? gl.getUniformLocation(this.program, "uView") : null;
		this.instances = new InstanceBuffer(gl);
		this.vao = null;
	}
	/** Start a frame: map the world rect [x, y, w, h] onto the full canvas. */
	begin(viewX, viewY, viewW, viewH, pxPerUnit = 1, targetW = 1, targetH = 1) {
		this.uniformData[0] = viewX;
		this.uniformData[1] = viewY;
		this.uniformData[2] = viewW;
		this.uniformData[3] = viewH;
		this.count = 0;
		this.runs.length = 0;
		this.pxPerUnit = pxPerUnit;
		this.targetW = targetW;
		this.targetH = targetH;
		this.clip = null;
		this.layer = 0;
		this.maxLayer = 0;
	}
	/** Twin of MsdfRenderer.release — this backend binds textures directly, so
	*  there is no per-view cache to evict. */
	release(_view) {}
	/** Reserve one instance for `view`'s texture; returns its float offset. */
	alloc(view) {
		if (this.count === this.capacity) this.grow();
		if (this.layer > this.maxLayer) this.maxLayer = this.layer;
		this.order?.put(1, this.count, this.layer);
		const run = this.runs[this.runs.length - 1];
		if (run && run.view === view && run.layer === this.layer && sameClip(run.clip, this.clip)) run.n++;
		else this.runs.push({
			view,
			clip: this.clip,
			layer: this.layer,
			first: this.count,
			n: 1
		});
		return this.count++ * 28;
	}
	grow() {
		this.capacity *= 2;
		const next = new Float32Array(this.capacity * 28);
		next.set(this.f32);
		this.f32 = next;
		this.u32 = new Uint32Array(next.buffer);
	}
	/** Point every attribute at the interleaved stream, `byteOffset` in — the
	*  firstInstance emulation (offset = run.first × 112 bytes). The u32 slots
	*  bind through vertexAttribIPointer so the shader sees true uints. */
	bindAttribs(byteOffset) {
		const gl = this.gl;
		const floatSlots = [
			0,
			1,
			2,
			6
		];
		const uintSlots = [
			3,
			4,
			5
		];
		for (const loc of floatSlots) {
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, STRIDE_BYTES$2, byteOffset + loc * 16);
			gl.vertexAttribDivisor(loc, 1);
		}
		for (const loc of uintSlots) {
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribIPointer(loc, 4, gl.UNSIGNED_INT, STRIDE_BYTES$2, byteOffset + loc * 16);
			gl.vertexAttribDivisor(loc, 1);
		}
	}
	/** Upload everything pushed since begin() and draw one range per texture. */
	/** Program, VAO, upload and pipeline state — shared by both draw paths. */
	bindForDraw() {
		const gl = this.gl;
		gl.useProgram(this.program);
		gl.uniform4fv(this.uViewLoc, this.uniformData);
		if (!this.vao) this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		this.instances.upload(this.f32, this.count * 28);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(false);
		gl.activeTexture(gl.TEXTURE0);
	}
	/** @internal @see MsdfRenderer.drawRange */
	drawRange(_pass, first, n) {
		if (n <= 0 || this.count === 0 || !this.program) return;
		const gl = this.gl;
		const end = first + n;
		this.bindForDraw();
		for (const run of this.runs) {
			const lo = Math.max(run.first, first);
			const hi = Math.min(run.first + run.n, end);
			if (hi <= lo) continue;
			const tex = run.view;
			if (!tex) continue;
			if (run.clip) {
				const r = clipToPixels(run.clip, this.targetW, this.targetH);
				if (r.w === 0 || r.h === 0) continue;
				gl.enable(gl.SCISSOR_TEST);
				gl.scissor(r.x, this.targetH - (r.y + r.h), r.w, r.h);
			} else gl.disable(gl.SCISSOR_TEST);
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			this.bindAttribs(lo * STRIDE_BYTES$2);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, hi - lo);
		}
		gl.disable(gl.SCISSOR_TEST);
		gl.bindVertexArray(null);
	}
	flush(_pass, layer = 0) {
		const gl = this.gl;
		if (this.count === 0 || !this.program) return 0;
		this.bindForDraw();
		let drawn = 0;
		for (const run of this.runs) {
			if (run.layer !== layer) continue;
			const tex = run.view;
			if (!tex) continue;
			if (run.clip) {
				const r = clipToPixels(run.clip, this.targetW, this.targetH);
				if (r.w === 0 || r.h === 0) continue;
				gl.enable(gl.SCISSOR_TEST);
				gl.scissor(r.x, this.targetH - (r.y + r.h), r.w, r.h);
			} else gl.disable(gl.SCISSOR_TEST);
			gl.bindTexture(gl.TEXTURE_2D, tex);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			this.bindAttribs(run.first * STRIDE_BYTES$2);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, run.n);
			drawn += run.n;
		}
		gl.disable(gl.SCISSOR_TEST);
		gl.bindVertexArray(null);
		return drawn;
	}
};
//#endregion
//#region src/lib/webgl/ui.ts
var STRIDE_BYTES$1 = 160;
/** Vertex shader — the GLSL port of ui.ts's `vs`. */
var buildUiVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iBox;      // cx, cy, halfW, halfH
layout(location=1) in vec4 iRadii;    // tl, tr, br, bl
layout(location=2) in uvec4 iColA;    // fill0, fill1, border0, border1
layout(location=3) in uvec4 iColB;    // gloss, shadow, innerShadow, tint
layout(location=4) in vec4 iP0;       // borderWidth, bevelWidth, bevelStrength, lightAngle
layout(location=5) in vec4 iP1;       // fillAngle, gloss, glossHeight, glossInset
layout(location=6) in vec4 iP2;       // innerShadow, innerShadowWidth, shadowBlur, shadowSpread
layout(location=7) in vec4 iP3;       // shadowX, shadowY, alpha, texAmount
layout(location=8) in vec4 iP4;       // rot, mode, reserved, reserved
layout(location=9) in vec4 iUv;       // uMin, vMin, uMax, vMax
uniform vec4 uView;                   // surface rect: x, y, w, h
out vec4 vLocal;
out vec4 vRadii;
flat out uvec4 vColA;
flat out uvec4 vColB;
out vec4 vP0;
out vec4 vP1;
out vec4 vP2;
out vec4 vP3;
out vec4 vUv;
void main() {
  int vi = gl_VertexID;
  vec2 c01 = vec2(float(vi & 1), float(vi >> 1));
  vec2 half_ = max(iBox.zw, vec2(0.01));
  // Grow the quad so the drop shadow and the AA feather have room (see ui.ts).
  float shadowAlpha = float((iColB.y >> 24u) & 0xffu);
  float shadowPad = (abs(iP3.x) + abs(iP3.y) + iP2.z + iP2.w) * step(0.5, shadowAlpha);
  vec2 ext = half_ + shadowPad + 2.0;
  vec2 local = (c01 - 0.5) * 2.0 * ext;
  float s = sin(iP4.x);
  float c = cos(iP4.x);
  vec2 world = iBox.xy + vec2(local.x * c - local.y * s, local.x * s + local.y * c);
  vec2 ndc = (world - uView.xy) / uView.zw * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  vLocal = vec4(local, half_);
  vRadii = iRadii;
  vColA = iColA;
  vColB = iColB;
  vP0 = iP0;
  vP1 = iP1;
  vP2 = iP2;
  vP3 = iP3;
  vUv = iUv;
}
`;
/** Fragment shader — the GLSL port of ui.ts's `fs`, field maths verbatim. */
var buildUiFragGLSL = () => GLSL_FRAG_HEADER + `
in vec4 vLocal;
in vec4 vRadii;
flat in uvec4 vColA;
flat in uvec4 vColB;
in vec4 vP0;
in vec4 vP1;
in vec4 vP2;
in vec4 vP3;
in vec4 vUv;
uniform sampler2D uTex;
out vec4 outColor;

vec4 unpackRGBA(uint v) {
  return vec4(float(v & 0xffu), float((v >> 8u) & 0xffu), float((v >> 16u) & 0xffu), float((v >> 24u) & 0xffu)) / 255.0;
}

// The corner radius governing p's quadrant. Y is DOWN, so p.y > 0 is the BOTTOM.
float pickR(vec2 p, vec4 r) {
  bool bottom = p.y > 0.0;
  return p.x > 0.0 ? (bottom ? r.z : r.y) : (bottom ? r.w : r.x);
}

// Exact signed distance to a rounded box centred on the origin, negative inside.
float sdBox(vec2 p, vec2 b, float rr) {
  float r = min(rr, min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2(0.0))) - r;
}

// The SDF's gradient — the outward surface normal the bevel lights.
vec2 sdNormal(vec2 p, vec2 b, float rr) {
  float r = min(rr, min(b.x, b.y));
  vec2 q = abs(p) - b + r;
  vec2 g;
  if (max(q.x, q.y) > 0.0) {
    vec2 m = max(q, vec2(0.0));
    float l = length(m);
    g = l > 1e-6 ? m / l : vec2(0.0, 1.0);
  } else {
    g = q.x > q.y ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  }
  // sign() is 0 on the axes, which would kill the normal there — bias to +1.
  return g * vec2(p.x >= 0.0 ? 1.0 : -1.0, p.y >= 0.0 ? 1.0 : -1.0);
}

void main() {
  vec2 P = vLocal.xy;
  vec2 half_ = vLocal.zw;
  float rr = pickR(P, vRadii);
  float d = sdBox(P, half_, rr);
  float aa = max(fwidth(d), 1e-4);
  float bodyCoverage = clamp(0.5 - d / aa, 0.0, 1.0);
  float inside = -d;

  vec4 fill0 = unpackRGBA(vColA.x);
  vec4 fill1 = unpackRGBA(vColA.y);
  vec4 rim0 = unpackRGBA(vColA.z);
  vec4 rim1 = unpackRGBA(vColA.w);
  vec4 glossCol = unpackRGBA(vColB.x);
  vec4 shadowCol = unpackRGBA(vColB.y);
  vec4 innerCol = unpackRGBA(vColB.z);
  vec4 tint = unpackRGBA(vColB.w);

  // ── Body gradient (0 deg = top→bottom) ──
  vec2 gdir = vec2(sin(vP1.x), cos(vP1.x));
  float t = clamp(0.5 + 0.5 * dot(P / half_, gdir), 0.0, 1.0);
  vec3 rgb = mix(fill0.rgb, fill1.rgb, t);
  float bodyAlpha = mix(fill0.a, fill1.a, t);

  // ── Texture hook — inert at texAmount 0 ──
  vec2 t01 = clamp(P / half_ * 0.5 + vec2(0.5), vec2(0.0), vec2(1.0));
  vec4 texel = texture(uTex, mix(vUv.xy, vUv.zw, t01));
  rgb = mix(rgb, texel.rgb, vP3.w);

  vec2 n = sdNormal(P, half_, rr);
  vec2 toLight = vec2(sin(vP0.w), -cos(vP0.w));   // 0 deg = from above (y down)

  // ── Inner shadow: contact darkening away from the light ──
  float isBand = 1.0 - clamp(inside / max(vP2.y, 1e-4), 0.0, 1.0);
  rgb = mix(rgb, innerCol.rgb,
            isBand * isBand * clamp(dot(n, toLight), 0.0, 1.0) * vP2.x * innerCol.a);

  // ── Gloss cap: an inset rounded box across the top, faded out downwards ──
  if (vP1.y > 0.0) {
    float gh = max(vP1.z * half_.y * 2.0, 1e-3);
    vec2 gHalf = max(vec2(half_.x - vP1.w, gh * 0.5), vec2(0.5));
    vec2 gCentre = vec2(0.0, -half_.y + vP1.w + gHalf.y);
    float dg = sdBox(P - gCentre, gHalf, min(rr, gHalf.y));
    float gCover = clamp(0.5 - dg / aa, 0.0, 1.0);
    float fade = 1.0 - clamp((P.y - gCentre.y + gHalf.y) / (gHalf.y * 2.0), 0.0, 1.0);
    rgb = mix(rgb, glossCol.rgb, gCover * fade * fade * vP1.y * glossCol.a);
  }

  // ── Rim: overwrite the band between the edge and the border width ──
  if (vP0.x > 0.0) {
    float ring = clamp((d + vP0.x) / aa + 0.5, 0.0, 1.0);
    vec4 rim = mix(rim0, rim1, t);
    rgb = mix(rgb, rim.rgb, ring * rim.a);
    bodyAlpha = mix(bodyAlpha, rim.a, ring);
  }

  // ── Bevel LAST, so it shades the rim as well as the body ──
  float bev = 1.0 - clamp(inside / max(vP0.y, 1e-4), 0.0, 1.0);
  float lit = clamp(dot(n, -toLight) * bev * bev * vP0.z, -1.0, 1.0);
  rgb = mix(rgb, lit > 0.0 ? vec3(1.0) : vec3(0.0), abs(lit));

  rgb = rgb * tint.rgb;
  float a = bodyCoverage * bodyAlpha * vP3.z * tint.a;

  // ── Drop shadow, composited UNDER the body (premultiplied) ──
  vec3 outRgb = rgb * a;
  float outA = a;
  if (shadowCol.a > 0.0) {
    float spread = vP2.w;
    float dsh = sdBox(P - vP3.xy, half_ + spread, rr + spread);
    float sCover = clamp(0.5 - dsh / max(vP2.z, aa), 0.0, 1.0);
    float sh = sCover * sCover * shadowCol.a * vP3.z;
    outRgb = rgb * a + shadowCol.rgb * sh * (1.0 - a);
    outA = a + sh * (1.0 - a);
  }
  outColor = vec4(outRgb, outA);
}
`;
/**
* The UI panel batch — the GL twin of UiRenderer. The CPU half (push / grow)
* is a verbatim twin; flush uploads the mixed stream once and draws it.
*/
var GlUiRenderer = class {
	f32;
	u32;
	count = 0;
	capacity = 512;
	uniformData = /* @__PURE__ */ new Float32Array(4);
	/** Clip runs — the GL twin of UiRenderer's, drawn with gl.scissor. */
	runs = [];
	targetW = 1;
	targetH = 1;
	gl;
	program = null;
	vao = null;
	instances;
	blank = null;
	uViewLoc = null;
	constructor(gl) {
		this.f32 = new Float32Array(this.capacity * 40);
		this.u32 = new Uint32Array(this.f32.buffer);
		this.rebuild(gl);
	}
	/** (Re)create every GL-side object — the context-loss recovery path. */
	rebuild(gl) {
		this.gl = gl;
		this.program = compileProgram(gl, buildUiVertGLSL(), buildUiFragGLSL(), "GlUiRenderer");
		this.uViewLoc = this.program ? gl.getUniformLocation(this.program, "uView") : null;
		this.instances = new InstanceBuffer(gl);
		this.vao = null;
		this.blank = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, this.blank);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([
			255,
			255,
			255,
			255
		]));
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.bindTexture(gl.TEXTURE_2D, null);
	}
	/** Twin of UiRenderer.release — this backend binds textures directly. */
	release(_view) {}
	/** Start a frame: map the surface rect [x, y, w, h] onto the full canvas. */
	begin(x, y, w, h, targetW = 1, targetH = 1) {
		this.uniformData[0] = x;
		this.uniformData[1] = y;
		this.uniformData[2] = w;
		this.uniformData[3] = h;
		this.count = 0;
		this.runs.length = 0;
		this.maxLayer = 0;
		this.targetW = targetW;
		this.targetH = targetH;
	}
	/** Highest layer pushed this frame — how many times the frame must flush. */
	maxLayer = 0;
	/** The surface's submission-order log — see batch.ts's DrawOrder. */
	order = null;
	/** @internal Take part in a surface's submission order. */
	joinOrder(order) {
		this.order = order;
	}
	/** Push one panel — the exact twin of UiRenderer.push. */
	push(x, y, w, h, s, rot = 0, clip = null, layer = 0) {
		if (this.count === this.capacity) this.grow();
		if (layer > this.maxLayer) this.maxLayer = layer;
		this.order?.put(2, this.count, layer);
		const run = this.runs[this.runs.length - 1];
		if (run && run.layer === layer && sameClip(run.clip, clip)) run.n++;
		else this.runs.push({
			clip,
			layer,
			first: this.count,
			n: 1
		});
		const o = this.count++ * 40;
		const f = this.f32, u = this.u32;
		f[o] = x + w / 2;
		f[o + 1] = y + h / 2;
		f[o + 2] = w / 2;
		f[o + 3] = h / 2;
		f[o + 4] = s.radius[0];
		f[o + 5] = s.radius[1];
		f[o + 6] = s.radius[2];
		f[o + 7] = s.radius[3];
		u[o + 8] = packUiColor(s.fill);
		u[o + 9] = packUiColor(s.fillTo);
		u[o + 10] = packUiColor(s.borderColor);
		u[o + 11] = packUiColor(s.borderColorTo);
		u[o + 12] = packUiColor(s.glossColor);
		u[o + 13] = packUiColor(s.shadowColor, s.shadow);
		u[o + 14] = packUiColor(s.innerShadowColor);
		u[o + 15] = packUiColor(s.tint);
		f[o + 16] = s.border;
		f[o + 17] = s.bevelWidth;
		f[o + 18] = s.bevel;
		f[o + 19] = s.light;
		f[o + 20] = s.fillAngle;
		f[o + 21] = s.gloss;
		f[o + 22] = s.glossHeight;
		f[o + 23] = s.glossInset;
		f[o + 24] = s.innerShadow;
		f[o + 25] = s.innerShadowWidth;
		f[o + 26] = s.shadowBlur;
		f[o + 27] = s.shadowSpread;
		f[o + 28] = s.shadowX;
		f[o + 29] = s.shadowY;
		f[o + 30] = s.alpha;
		f[o + 31] = 0;
		f[o + 32] = rot;
		f[o + 33] = 0;
		f[o + 34] = 0;
		f[o + 35] = 0;
		f[o + 36] = 0;
		f[o + 37] = 0;
		f[o + 38] = 1;
		f[o + 39] = 1;
		return o / 40;
	}
	/** Twin of UiRenderer.patchRect — see there for why containers need it. */
	patchRect(index, x, y, w, h) {
		if (index < 0 || index >= this.count) return;
		const o = index * 40;
		this.f32[o] = x + w / 2;
		this.f32[o + 1] = y + h / 2;
		this.f32[o + 2] = w / 2;
		this.f32[o + 3] = h / 2;
	}
	grow() {
		this.capacity *= 2;
		const next = new Float32Array(this.capacity * 40);
		next.set(this.f32);
		this.f32 = next;
		this.u32 = new Uint32Array(next.buffer);
	}
	/** Point every attribute at the interleaved stream. The two packed colour
	*  slots bind through vertexAttribIPointer so the shader sees true uints. */
	bindAttribs(byteOffset) {
		const gl = this.gl;
		const floatSlots = [
			0,
			1,
			4,
			5,
			6,
			7,
			8,
			9
		];
		const uintSlots = [2, 3];
		for (const loc of floatSlots) {
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, STRIDE_BYTES$1, byteOffset + loc * 16);
			gl.vertexAttribDivisor(loc, 1);
		}
		for (const loc of uintSlots) {
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribIPointer(loc, 4, gl.UNSIGNED_INT, STRIDE_BYTES$1, byteOffset + loc * 16);
			gl.vertexAttribDivisor(loc, 1);
		}
	}
	/** Apply a normalised clip as a GL scissor. GL's origin is BOTTOM-left, so
	*  the top-left rect from clipToPixels is flipped in Y here. */
	applyClip(clip) {
		const gl = this.gl;
		if (!clip) {
			gl.disable(gl.SCISSOR_TEST);
			return true;
		}
		const r = clipToPixels(clip, this.targetW, this.targetH);
		if (r.w === 0 || r.h === 0) return false;
		gl.enable(gl.SCISSOR_TEST);
		gl.scissor(r.x, this.targetH - (r.y + r.h), r.w, r.h);
		return true;
	}
	/** Upload everything pushed since begin() and draw it. */
	/** Program, VAO, upload and pipeline state — shared by both draw paths. */
	bindForDraw() {
		const gl = this.gl;
		gl.useProgram(this.program);
		gl.uniform4fv(this.uViewLoc, this.uniformData);
		if (!this.vao) this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		this.instances.upload(this.f32, this.count * 40);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(false);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.blank);
	}
	/** @internal @see UiRenderer.drawRange */
	drawRange(_pass, first, n) {
		if (n <= 0 || this.count === 0 || !this.program) return;
		const gl = this.gl;
		const end = first + n;
		this.bindForDraw();
		for (const run of this.runs) {
			const lo = Math.max(run.first, first);
			const hi = Math.min(run.first + run.n, end);
			if (hi <= lo) continue;
			if (!this.applyClip(run.clip)) continue;
			this.bindAttribs(lo * STRIDE_BYTES$1);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, hi - lo);
		}
		gl.disable(gl.SCISSOR_TEST);
		gl.bindVertexArray(null);
	}
	flush(_pass, layer = 0) {
		const gl = this.gl;
		if (this.count === 0 || !this.program) return 0;
		this.bindForDraw();
		let drawn = 0;
		for (const run of this.runs) {
			if (run.layer !== layer) continue;
			if (!this.applyClip(run.clip)) continue;
			this.bindAttribs(run.first * STRIDE_BYTES$1);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, run.n);
			drawn += run.n;
		}
		gl.disable(gl.SCISSOR_TEST);
		gl.bindVertexArray(null);
		return drawn;
	}
};
//#endregion
//#region src/lib/webgl/fxbatch.ts
var FLOATS$3 = 48;
var F_OUTLINE = 2;
var F_BLUR = 4;
var F_PIXELATE = 8;
var F_WOBBLE = 16;
var F_GLITCH = 32;
var F_DISSOLVE = 64;
var F_REVEAL = 128;
var OUTLINE_DEFAULT = "#ffffff";
var DISSOLVE_DEFAULT = "#ff9a3d";
/** Vertex shader — the GLSL port of fxbatch.ts's `vs`. */
var buildFxVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iPosSize;
layout(location=1) in vec4 iMisc;    // rot, flags, z, time
layout(location=2) in vec4 iBase;    // sprite tint * alpha
layout(location=3) in vec4 iUv;      // expanded rect (flip pre-applied)
layout(location=4) in vec4 iClampR;  // the frame's true rect (normalized)
layout(location=5) in vec4 iHalo;    // glow/outline colour
layout(location=6) in vec4 iP1;      // spreadU, spreadV, dissolveT, revealT (sign = invert)
layout(location=7) in vec4 iP2;      // pixelCells, wobble(uv), glitch, seed
// flash/tint corner colours (a = amount) — equal for a flat colour,
// distinct for a bilinear GRADIENT tint across the sprite.
layout(location=8) in vec4 iCmodTL;
layout(location=9) in vec4 iCmodTR;
layout(location=10) in vec4 iCmodBL;
layout(location=11) in vec4 iCmodBR;
uniform vec4 uView;
out vec2 vUv;
out vec4 vBase;
out vec4 vHalo;
out vec4 vCmod;
out vec4 vClampR;
out vec4 vP1;
out vec4 vP2;
out vec2 vFt;                        // flags, time
void main() {
  vec2 c01 = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 centre = iPosSize.xy + iPosSize.zw * 0.5;
  vec2 off = (c01 - 0.5) * iPosSize.zw;
  float sn = sin(iMisc.x);
  float cn = cos(iMisc.x);
  vec2 world = centre + vec2(off.x * cn - off.y * sn, off.x * sn + off.y * cn);
  vec2 ndc = (world - uView.xy) / uView.zw * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, (1.0 - iMisc.z) * 2.0 - 1.0, 1.0);
  vUv = vec2(mix(iUv.x, iUv.z, c01.x), mix(iUv.y, iUv.w, c01.y));
  vBase = iBase;
  vHalo = iHalo;
  // Corner colour at this vertex → bilinear gradient across the quad.
  vCmod = mix(mix(iCmodTL, iCmodTR, c01.x), mix(iCmodBL, iCmodBR, c01.x), c01.y);
  vClampR = iClampR;
  vP1 = iP1;
  vP2 = iP2;
  vFt = vec2(iMisc.y, iMisc.w);
}
`;
/** Fragment shader — the GLSL port of fxbatch.ts's `fs` (the whole
*  über-shader: uv distortions, RGB split, 32-tap halo rings, alpha gates,
*  colour-over, outline compose). */
var buildFxFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vUv;
in vec4 vBase;
in vec4 vHalo;
in vec4 vCmod;
in vec4 vClampR;
in vec4 vP1;
in vec4 vP2;
in vec2 vFt;
uniform sampler2D uTex;
out vec4 outColor;

float inRect(vec2 p, vec4 r) {
  return step(r.x, p.x) * step(p.x, r.z) * step(r.y, p.y) * step(p.y, r.w);
}
vec4 smpl(vec2 p, vec4 r) {
  return texture(uTex, clamp(p, r.xy, r.zw)) * inRect(p, r);
}
float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
// Smooth 2-octave value noise — organic dissolve boundaries, no square cells.
float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 w = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), w.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), w.x), w.y);
}

// 32 halo taps: 4 gaussian-weighted rings — and the whole pattern rotates by
// a per-PIXEL random angle, which turns sparse-ring ghosting into fine noise.
const float RING_R[4] = float[4](0.25, 0.5, 0.75, 1.0);
const float RING_W[4] = float[4](1.0, 0.78, 0.5, 0.26);

void main() {
  uint flags = uint(vFt.x + 0.5);
  float time = vFt.y;
  vec4 r = vClampR;
  vec2 rs = max(r.zw - r.xy, vec2(0.0001));
  vec2 uv = vUv;
  vec2 local = (uv - r.xy) / rs;

  // ── ONE uv distortion (pixelate > glitch > wobble) ─────────────────────────
  if ((flags & 8u) != 0u) {              // pixelate: snap to a cell grid
    float cells = max(2.0, vP2.x);
    local = (floor(local * cells) + 0.5) / cells;
    uv = r.xy + local * rs;
  } else if ((flags & 32u) != 0u) {      // glitch: band jumps
    float band = floor(local.y * 12.0);
    float tick = floor(time * 14.0);
    float go = step(0.55, hash(vec2(band * 3.1, tick + vP2.w)));
    float jump = (hash(vec2(band, tick)) - 0.5) * vP2.z * go;
    uv = vec2(uv.x + jump * rs.x, uv.y);
  } else if ((flags & 16u) != 0u) {      // wobble: sine band ripple
    uv = vec2(uv.x + sin(local.y * 14.0 + time * 6.2831 * 1.4) * vP2.y, uv.y);
  }

  // ── Sample (glitch splits RGB; split = 0 otherwise) ────────────────────────
  float split = ((flags & 32u) != 0u) ? vP2.z * rs.x * 0.35 : 0.0;
  vec4 cR = smpl(uv + vec2(split, 0.0), r);
  vec4 cC = smpl(uv, r);
  vec4 cB = smpl(uv - vec2(split, 0.0), r);
  vec4 body = vec4(cR.r, cC.g, cB.b, max(cC.a, max(cR.a, cB.a) * step(0.001, split)));

  // ── Halo taps (outline / blur share one jittered ring set) ─────────────────
  float near = 0.0;
  vec4 blurAcc = body * 1.6;
  float wSum = 1.6;
  float jit = hash(floor(gl_FragCoord.xy)) * 0.7854;   // per-pixel ring rotation
  for (int ring = 0; ring < 4; ring++) {
    float rr = RING_R[ring];
    float rw = RING_W[ring];
    for (int k = 0; k < 8; k++) {
      float ang = (float(k) + float(ring) * 0.4) * 0.7854 + jit;
      vec2 o = vec2(cos(ang), sin(ang)) * rr * vP1.xy;
      vec4 s = smpl(uv + o, r);
      near = max(near, s.a * step(0.7, rr));           // outline reads the outer ring
      blurAcc += s * rw;
      wSum += rw;
    }
  }

  if ((flags & 4u) != 0u) { body = blurAcc / wSum; }   // blur

  float a = body.a * vBase.a;
  vec3 rgb = body.rgb * vBase.rgb;

  // ── ONE alpha gate (reveal > dissolve) ─────────────────────────────────────
  float edge = 0.0;
  if ((flags & 128u) != 0u) {            // reveal: circular clip
    float t = abs(vP1.w);
    float dist = length((local - 0.5) * vec2(rs.x / rs.y, 1.0)) * 1.15;
    float vis = 1.0 - smoothstep(t - 0.03, t, dist / 0.85);
    if (vP1.w < 0.0) { vis = 1.0 - vis; }
    a = a * vis;
  } else if ((flags & 64u) != 0u) {      // dissolve: smooth organic noise
    float t = vP1.z * 1.12;              // overshoot so t=1 is fully gone
    vec2 seed = vec2(vP2.w * 13.7, vP2.w * 7.3);
    float n = 0.65 * vnoise(local * 5.0 + seed) + 0.35 * vnoise(local * 11.0 + seed * 1.7);
    float keep = smoothstep(t - 0.04, t + 0.04, n);
    edge = keep * (1.0 - smoothstep(t, t + 0.16, n));
    a = a * keep;
  }

  // ── Colour-over (flash / tint) ─────────────────────────────────────────────
  rgb = mix(rgb, vCmod.rgb, vCmod.a);

  // ── Compose: body over halo (glow lives in the GlowPass, not here) ─────────
  vec4 outC = vec4(rgb * a, a);
  if ((flags & 2u) != 0u) {              // outline: rim fills smoothly under the AA edge
    float rim = step(0.3, near) * (1.0 - body.a) * vHalo.a;
    outC = vec4(outC.rgb + vHalo.rgb * rim, outC.a + rim);
  }
  // dissolve's burning edge rides the halo slot's colour
  outColor = vec4(outC.rgb + vHalo.rgb * edge * body.a, outC.a);
}
`;
/** The dedicated per-object-fx batch — the GL twin of FxBatch. */
var GlFxBatch = class {
	/** The surface's submission-order log — see batch.ts's DrawOrder. */
	order = null;
	layer = 0;
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
	filter;
	uniformData = /* @__PURE__ */ new Float32Array(4);
	gl;
	program = null;
	vao = null;
	instances;
	uViewLoc = null;
	texture = null;
	constructor(gl, opts = {}) {
		this.capacity = opts.capacity ?? 2048;
		this.filter = opts.filter === "nearest" ? "nearest" : "linear";
		this.data = new Float32Array(this.capacity * FLOATS$3);
		this.rebuild(gl);
	}
	/** (Re)create every GL-side object — the context-loss recovery path. */
	rebuild(gl) {
		this.gl = gl;
		this.program = compileProgram(gl, buildFxVertGLSL(), buildFxFragGLSL(), "GlFxBatch");
		this.uViewLoc = this.program ? gl.getUniformLocation(this.program, "uView") : null;
		this.instances = new InstanceBuffer(gl);
		this.vao = null;
		this.texture = null;
	}
	/** Point the batch at the shared atlas (a WebGLTexture on this backend). */
	setTexture(view) {
		this.texture = view;
	}
	begin(x, y, w, h) {
		this.count = 0;
		this.layer = 0;
		this.uniformData[0] = x;
		this.uniformData[1] = y;
		this.uniformData[2] = w;
		this.uniformData[3] = h;
	}
	/** Queue one fx sprite (margin expansion + uv extrapolation done here) —
	*  a verbatim twin of FxBatch.push's packing. */
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
		const o = this.count * FLOATS$3;
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
		const next = new Float32Array(this.capacity * FLOATS$3);
		next.set(this.data);
		this.data = next;
	}
	/** Program, VAO, upload, texture and pipeline state — both draw paths. */
	bindForDraw() {
		const gl = this.gl;
		gl.useProgram(this.program);
		gl.uniform4fv(this.uViewLoc, this.uniformData);
		if (!this.vao) this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		this.instances.upload(this.data, this.count * FLOATS$3);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		const f = this.filter === "nearest" ? gl.NEAREST : gl.LINEAR;
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.depthMask(false);
	}
	/** @internal @see FxBatch.drawRange */
	drawRange(_pass, first, n) {
		if (n <= 0 || this.count === 0 || !this.program || !this.texture) return;
		const gl = this.gl;
		this.bindForDraw();
		instanceVec4Attribs(gl, 0, 12, first * FLOATS$3 * 4);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, n);
		gl.bindVertexArray(null);
	}
	flush(_pass) {
		const gl = this.gl;
		if (this.count === 0 || !this.program || !this.texture) return 0;
		this.bindForDraw();
		instanceVec4Attribs(gl, 0, 12);
		gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
		gl.bindVertexArray(null);
		return this.count;
	}
};
//#endregion
//#region src/lib/webgl/gridbatch.ts
var BUILTIN_ID = {
	wave: 1,
	sway: 2,
	flip: 3,
	jelly: 4
};
var CUSTOM_BASE = 16;
var SEGS = 24;
var VERTS = SEGS * SEGS * 6;
var FLOATS$2 = 20;
/** Vertex shader — the GLSL port of buildGridWGSL's vertex template (the four
*  built-in kinds; the cell/corner decode from the flat vertex index). */
/** Custom-def splice: each registered def with a `glsl` snippet becomes an
*  else-if branch, in the SAME variable scope as the built-ins (`p`, `shade`,
*  `uvn`, `size`, `amount`, `t`, `TAU`) — mirroring buildGridWGSL's splice. */
var buildGridVertGLSL = (customs = []) => GLSL_HEADER + `
const float SEGS = ${SEGS}.0;
const float TAU = 6.28318530718;
layout(location=0) in vec4 iPosSize;
layout(location=1) in vec4 iMisc;    // rot, kind, flipX, z01
layout(location=2) in vec4 iColor;
layout(location=3) in vec4 iUv;      // atlas rect
layout(location=4) in vec4 iDeform;  // amount, speed, phase, 0
uniform vec4 uView;                  // world rect: x, y, w, h
uniform float uTime;
out vec2 vT01;
out vec4 vColor;
out vec4 vUvRect;
out float vShade;
void main() {
  // cell + corner from the flat index; offsets packed as bit tables.
  uint vi = uint(gl_VertexID);
  uint corner = vi % 6u;
  uint cell = vi / 6u;
  float cx = float(cell % ${SEGS}u);
  float cy = float(cell / ${SEGS}u);
  vec2 o = vec2(float((0x1Au >> corner) & 1u), float((0x34u >> corner) & 1u));
  vec2 uvn = vec2((cx + o.x) / SEGS, (cy + o.y) / SEGS);    // 0..1 across the sprite

  vec2 size = iPosSize.zw;
  uint kind = uint(iMisc.y);
  float amount = iDeform.x;
  float t = iDeform.z + iDeform.y * uTime * TAU;            // phase + speed·time
  vec2 p = (uvn - 0.5) * size;                              // centred, world units
  float shade = 1.0;

  if (kind == 1u) {                                         // wave — cloth ripple
    float k = uvn.x;                                        // anchored left edge
    float ph = uvn.x * 2.5 * TAU * 0.5 - t;
    p.y += sin(ph) * amount * k;
    shade = 1.0 - cos(ph) * 0.22 * k;                       // slope-lit folds
  } else if (kind == 2u) {                                  // sway — pendulum bend
    float k = 1.0 - uvn.y;                                  // anchored bottom
    p.x += sin(t) * amount * k * k;
  } else if (kind == 3u) {                                  // flip — fake-3D card
    float c = cos(t);
    float s = sin(t);
    p.x = p.x * c;
    p.y = p.y * (1.0 + (uvn.x - 0.5) * s * 0.55);           // perspective taper
    shade = 0.72 + 0.28 * abs(c);                           // edge-on darkening
  } else if (kind == 4u) {                                  // jelly — squash wobble
    float sq = sin(t) * amount;
    p.x *= 1.0 + sq * (1.0 - uvn.y);                        // top wobbles most
    float bottom = 0.5 * size.y;
    p.y = (p.y - bottom) * (1.0 - sq * 0.8) + bottom;       // volume-ish preserve
    p.x += sin(t * 2.0 + uvn.y * TAU * 0.5) * amount * size.x * 0.06 * (1.0 - uvn.y);
  }${customs.map((c) => `
  else if (kind == ${c.id}u) {
${c.glsl}
  }`).join("")}

  float sn = sin(iMisc.x);
  float cn = cos(iMisc.x);
  vec2 centre = iPosSize.xy + size * 0.5;
  vec2 world = centre + vec2(p.x * cn - p.y * sn, p.x * sn + p.y * cn);
  vec2 ndc = (world - uView.xy) / uView.zw * 2.0 - 1.0;

  float ux = uvn.x;
  if (iMisc.z > 0.5) { ux = 1.0 - ux; }                     // flipX
  gl_Position = vec4(ndc.x, -ndc.y, (1.0 - iMisc.w) * 2.0 - 1.0, 1.0);
  vT01 = vec2(ux, uvn.y);
  vUvRect = iUv;
  vColor = iColor;
  vShade = shade;
}
`;
/** Fragment shader — the same atlas mapping as GlQuadBatch (un-inset extent,
*  clamped back in, optional blocky texel snap), × tint × the deform shade. */
var buildGridFragGLSL = (blocky) => GLSL_FRAG_HEADER + `
#define BLOCKY ${blocky ? 1 : 0}
in vec2 vT01;
in vec4 vColor;
in vec4 vUvRect;
in float vShade;
uniform sampler2D uTex;
out vec4 outColor;
void main() {
  vec2 texRes = vec2(textureSize(uTex, 0));
  vec2 ht = 0.5 / texRes;
  vec2 lo = vUvRect.xy - ht;
  vec2 hi = vUvRect.zw + ht;
  vec2 uv = clamp(vec2(mix(lo.x, hi.x, vT01.x), mix(lo.y, hi.y, vT01.y)), vUvRect.xy, vUvRect.zw);
#if BLOCKY
  vec2 cont = vT01 * (hi - lo) * texRes;
  vec2 dd = max(vec2(
    length(vec2(dFdx(cont.x), dFdy(cont.x))),
    length(vec2(dFdx(cont.y), dFdy(cont.y)))), vec2(1e-6));
  vec2 tc = uv * texRes;
  vec2 seam = floor(tc + 0.5);
  vec2 snapped = clamp((tc - seam) / dd + seam, seam - 0.5, seam + 0.5);
  uv = clamp(snapped / texRes, vUvRect.xy, vUvRect.zw);
#endif
  vec4 base = texture(uTex, uv);
  vec4 color = vec4(base.rgb * vColor.rgb * vShade, base.a * vColor.a);
  outColor = vec4(color.rgb * color.a, color.a);            // premultiplied
}
`;
/**
* One program + instance VBO for every deformed sprite this frame — the GL
* twin of GridBatch. All deformation is vertex-stage; the instanced draw
* issues SEGS²×6 verts per sprite from gl_VertexID.
*/
var GlGridBatch = class {
	/** The surface's submission-order log — see batch.ts's DrawOrder. */
	order = null;
	layer = 0;
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
	capacity = 256;
	blocky;
	filter;
	uniformData = /* @__PURE__ */ new Float32Array(4);
	time = 0;
	kinds = { ...BUILTIN_ID };
	customs = [];
	warnedDefs = /* @__PURE__ */ new Set();
	gl;
	program = null;
	vao = null;
	instances;
	uViewLoc = null;
	uTimeLoc = null;
	texture = null;
	constructor(gl, opts = {}) {
		this.blocky = opts.blocky ?? false;
		this.filter = this.blocky ? "linear" : opts.filter === "nearest" ? "nearest" : "linear";
		this.data = new Float32Array(this.capacity * FLOATS$2);
		this.rebuild(gl);
	}
	/** (Re)create every GL-side object — the context-loss recovery path. */
	rebuild(gl) {
		this.gl = gl;
		this.instances = new InstanceBuffer(gl);
		this.vao = null;
		this.texture = null;
		this.makeProgram();
	}
	/** (Re)compile the grid program with the registered GLSL custom branches. */
	makeProgram() {
		const gl = this.gl;
		const glslCustoms = this.customs.filter((c) => c.def.glsl).map((c) => ({
			id: c.id,
			glsl: c.def.glsl
		}));
		this.program = compileProgram(gl, buildGridVertGLSL(glslCustoms), buildGridFragGLSL(this.blocky), "GlGridBatch");
		this.uViewLoc = this.program ? gl.getUniformLocation(this.program, "uView") : null;
		this.uTimeLoc = this.program ? gl.getUniformLocation(this.program, "uTime") : null;
	}
	/** Register a custom deformer. A def carrying a `glsl` twin snippet is
	*  spliced into the grid program exactly like the WGSL is on WebGPU (same
	*  id scheme, so `deform: { kind }` routing matches); a WGSL-only def
	*  renders UNDEFORMED here with a one-shot warn naming it. */
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
		if (!def.glsl && !this.warnedDefs.has(def.name)) {
			this.warnedDefs.add(def.name);
			console.warn(`Phaser AE: deformer '${def.name}' has no GLSL twin (DeformDef.glsl) — rendered undeformed on the WebGL fallback.`);
		}
		this.makeProgram();
	}
	/** Point the batch at the shared atlas (a WebGLTexture on this backend). */
	setTexture(view) {
		this.texture = view;
	}
	begin(viewX, viewY, viewW, viewH, time) {
		this.count = 0;
		this.layer = 0;
		this.uniformData[0] = viewX;
		this.uniformData[1] = viewY;
		this.uniformData[2] = viewW;
		this.uniformData[3] = viewH;
		this.time = time;
	}
	/** Queue one deformed sprite — identical packing to GridBatch.push. */
	push(x, y, w, h, frame, rot, flipX, z, deform, r, g, b, a) {
		this.order?.put(7, this.count, this.layer);
		if (this.count === this.capacity) this.grow();
		const o = this.count * FLOATS$2;
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
		const next = new Float32Array(this.capacity * FLOATS$2);
		next.set(this.data);
		this.data = next;
	}
	/** Program, VAO, upload, texture and pipeline state — both draw paths. */
	bindForDraw() {
		const gl = this.gl;
		gl.useProgram(this.program);
		gl.uniform4fv(this.uViewLoc, this.uniformData);
		gl.uniform1f(this.uTimeLoc, this.time);
		if (!this.vao) this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		this.instances.upload(this.data, this.count * FLOATS$2);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.texture);
		const f = this.filter === "nearest" ? gl.NEAREST : gl.LINEAR;
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		gl.depthMask(false);
	}
	/** @internal @see GridBatch.drawRange */
	drawRange(_pass, first, n) {
		if (n <= 0 || this.count === 0 || !this.program || !this.texture) return;
		const gl = this.gl;
		this.bindForDraw();
		instanceVec4Attribs(gl, 0, 5, first * FLOATS$2 * 4);
		gl.drawArraysInstanced(gl.TRIANGLES, 0, VERTS, n);
		gl.bindVertexArray(null);
	}
	flush(_pass) {
		const gl = this.gl;
		if (this.count === 0 || !this.program || !this.texture) return 0;
		this.bindForDraw();
		instanceVec4Attribs(gl, 0, 5);
		gl.drawArraysInstanced(gl.TRIANGLES, 0, VERTS, this.count);
		gl.bindVertexArray(null);
		return this.count;
	}
};
//#endregion
//#region src/lib/webgl/vector.ts
function packStyle(o) {
	const width = o.width ?? 2;
	const glow = o.glow ?? .5;
	const c0 = rgba(o.color ?? "#ffffff");
	const c1 = o.color2 ? rgba(o.color2) : c0;
	const alpha = o.alpha ?? 1;
	return {
		coreHalf: width / 2,
		stampHalf: glow > 0 ? width / 2 + 1 + glow * 2 : 0,
		z: (o.z ?? 1048576 * .5) / Z_RANGE,
		dash: o.dash ?? 0,
		glow,
		capped: width >= 1 ? 1 : 0,
		dwell: Math.max(0, o.dwell ?? 0),
		c0: [
			c0[0],
			c0[1],
			c0[2],
			c0[3] * alpha
		],
		c1: [
			c1[0],
			c1[1],
			c1[2],
			c1[3] * alpha
		]
	};
}
/** Vertex shader — the GLSL port of buildLineWGSL's `vs`; the xf table reads
*  from an RGBA32F data texture (2 texels per slot). */
var buildLineVertGLSL = (stamp = false) => GLSL_HEADER + `
#define STAMP ${stamp ? 1 : 0}
// seg:   ax, ay, bx, by                  (shape-local endpoints)
// style: coreHalf, stampHalf, z, shapeIdx (world units; z 0..1)
// extra: dash period, glow intensity, capped (width >= 1), dwell
// c0/c1: rgba at endpoint a / endpoint b (gradient along the line)
// join:  inward cut-plane normals at a / at b — see the JOINTS note in
//        vector.ts. All zero = no cut.
layout(location=0) in vec4 iSeg;
layout(location=1) in vec4 iStyle;
layout(location=2) in vec4 iExtra;
layout(location=3) in vec4 iC0;
layout(location=4) in vec4 iC1;
layout(location=5) in vec4 iJoin;
uniform vec4 uView;
// Transform slot: texel 2i = x, y, rot, scale; texel 2i+1 = alphaMul,
// glowMul, 0, 0. Slot 0 is the identity — immediate segments live there.
uniform highp sampler2D uXf;
out vec2 vLocal;        // capsule space: along (world u), across
out float vLen;
out vec2 vWidth;        // coreHalf, stampHalf
out vec4 vC0;
out vec4 vC1;
out vec3 vExtra;        // dash, glow (already × glowMul), dwell
out float vCapped;      // 1 = round caps; 0 = hairline flat cut
out vec4 vJoin;         // cut planes at a / at b, in capsule space
void main() {
  int slot = int(iStyle.w + 0.5);
  vec4 tp = texelFetch(uXf, ivec2(slot * 2, 0), 0);
  vec4 tm = texelFetch(uXf, ivec2(slot * 2 + 1, 0), 0);
  // Shape transform: scale, rotate, translate the endpoints.
  float cr = cos(tp.z);
  float sr = sin(tp.z);
  float s = tp.w;
  vec2 a = tp.xy + vec2((iSeg.x * cr - iSeg.y * sr) * s, (iSeg.x * sr + iSeg.y * cr) * s);
  vec2 b = tp.xy + vec2((iSeg.z * cr - iSeg.w * sr) * s, (iSeg.z * sr + iSeg.w * cr) * s);
  vec2 ab = b - a;
  float raw = length(ab);
  float len = max(1e-5, raw);
  // A ZERO-LENGTH segment is a DOT — see the note in vector.ts.
  vec2 dir = raw > 1e-5 ? ab / len : vec2(1.0, 0.0);
  vec2 n = vec2(-dir.y, dir.x);
  // The quad covers the core (or the stamp width) + AA margin + round caps.
  // Dwell fattens the ends, so the quad has to reach far enough to contain it.
  float dwellGain = 1.0 + iExtra.w * 0.85;
#if STAMP
  float reach = iStyle.y * dwellGain + 2.0;
#else
  float reach = iStyle.x * dwellGain + 2.0;
#endif
  vec2 c01 = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  float along = mix(-reach, len + reach, c01.x);
  float across = (c01.y - 0.5) * 2.0 * reach;
  vec2 world = a + dir * along + n * across;
  vec2 ndc = (world - uView.xy) / uView.zw * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, (1.0 - iStyle.z) * 2.0 - 1.0, 1.0);
  vLocal = vec2(along, across);
  vLen = len;
  vWidth = vec2(iStyle.x, iStyle.y);
  vC0 = vec4(iC0.rgb, iC0.a * tm.x);
  vC1 = vec4(iC1.rgb, iC1.a * tm.x);
  vExtra = vec3(iExtra.x, iExtra.y * tm.y, iExtra.w);
  vCapped = iExtra.z;
  // The cut planes turn with the shape, then drop into capsule space so the
  // fragment can test them with a dot product and nothing else.
  vec2 ja = vec2(iJoin.x * cr - iJoin.y * sr, iJoin.x * sr + iJoin.y * cr);
  vec2 jb = vec2(iJoin.z * cr - iJoin.w * sr, iJoin.z * sr + iJoin.w * cr);
  vJoin = vec4(dot(ja, dir), dot(ja, n), dot(jb, dir), dot(jb, n));
}
`;
/** Vertex shader for SOLID FACES — the GLSL twin of buildFillWGSL. Reads the
*  same xf transform texture as the lines, and carries a colour PER VERTEX so
*  a gradient costs no uniform and no second pass. */
var buildFillVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iV;      // x, y (shape-local), z (0..1), shapeIdx
layout(location=1) in vec4 iColor;
uniform vec4 uView;
uniform highp sampler2D uXf;
out vec4 vColor;
void main() {
  int slot = int(iV.w + 0.5);
  vec4 tp = texelFetch(uXf, ivec2(slot * 2, 0), 0);
  vec4 tm = texelFetch(uXf, ivec2(slot * 2 + 1, 0), 0);
  float cr = cos(tp.z), sr = sin(tp.z), s = tp.w;
  vec2 world = tp.xy + vec2((iV.x * cr - iV.y * sr) * s, (iV.x * sr + iV.y * cr) * s);
  vec2 ndc = (world - uView.xy) / uView.zw * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, (1.0 - iV.z) * 2.0 - 1.0, 1.0);
  vColor = vec4(iColor.rgb, iColor.a * tm.x);
}
`;
var buildFillFragGLSL = () => GLSL_FRAG_HEADER + `
in vec4 vColor;
out vec4 outColor;
void main() {
  outColor = vec4(vColor.rgb * vColor.a, vColor.a);   // premultiplied
}
`;
/** Fragment shader — the GLSL port of buildLineWGSL's `fs` (capsule SDF,
*  dash gate, hairline flat cut; STAMP = soft glow core for the GlowPass). */
var buildLineFragGLSL = (stamp = false) => GLSL_FRAG_HEADER + `
#define STAMP ${stamp ? 1 : 0}
in vec2 vLocal;
in float vLen;
in vec2 vWidth;
in vec4 vC0;
in vec4 vC1;
in vec3 vExtra;
in float vCapped;
in vec4 vJoin;
out vec4 outColor;
void main() {
  // Capsule SDF in local space: distance to the segment [0, len] on the axis.
  vec2 q = vec2(vLocal.x - clamp(vLocal.x, 0.0, vLen), vLocal.y);
  float d = length(q);
  float aa = max(fwidth(d), 1e-4);
  float jcut = 1.0;
#if !STAMP
  // Hairline mode (scene only): cut flat at the endpoints — see the JOINTS
  // note in vector.ts. The glow stamp keeps its soft caps (MAX blend absorbs
  // them).
  if (vCapped < 0.5 && vLen > 1e-4 && (vLocal.x < 0.0 || vLocal.x > vLen)) { discard; }
  // Cut on the joins — see the JOINTS note in vector.ts. A zero normal dots to
  // 0 and so never discards, which is how a free end keeps its round cap.
  // Cut on the joins, FADED not discarded — see the note in vector.ts. The
  // derivatives are taken unconditionally: fwidth reads neighbouring fragments
  // and is only defined in uniform control flow.
  vec2 ja = vJoin.xy;
  vec2 jb = vJoin.zw;
  float da = vLocal.x * ja.x + vLocal.y * ja.y;
  float db = (vLocal.x - vLen) * jb.x + vLocal.y * jb.y;
  float wa = max(fwidth(da), 1e-4);
  float wb = max(fwidth(db), 1e-4);
  if (vCapped >= 0.5) {
    if (dot(ja, ja) > 0.0) { jcut *= smoothstep(-0.5, 0.5, da / wa); }
    if (dot(jb, jb) > 0.0) { jcut *= smoothstep(-0.5, 0.5, db / wb); }
    if (jcut <= 0.0) { discard; }
  }
#endif
  float tt = clamp(vLocal.x / vLen, 0.0, 1.0);
  vec4 col = mix(vC0, vC1, tt);
  // Dash: a smooth on/off gate along the axis (period in world units, half
  // duty).
  float gate = 1.0;
  if (vExtra.x > 0.0) {
    float ph = fract(vLocal.x / vExtra.x);
    float waa = aa / vExtra.x;
    gate = 1.0 - smoothstep(0.5 - waa, 0.5 + waa, abs(ph - 0.5) * 2.0);
  }
  // BEAM DWELL — see the note in vector.ts. Scaled per end by how sharply the
  // beam turns there, which the join bisector already carries.
  float dwellW = vWidth.x * 2.0 + 4.0;
  float kA = 1.0 - smoothstep(0.0, dwellW, max(vLocal.x, 0.0));
  float kB = 1.0 - smoothstep(0.0, dwellW, max(vLen - vLocal.x, 0.0));
  float sA = dot(vJoin.xy, vJoin.xy) > 0.0 ? sqrt(max(0.0, 1.0 - vJoin.x * vJoin.x)) : 1.0;
  float sB = dot(vJoin.zw, vJoin.zw) > 0.0 ? sqrt(max(0.0, 1.0 - vJoin.z * vJoin.z)) : 1.0;
  float k = max(kA * sA, kB * sB);
  float boost = 1.0 + vExtra.z * 0.85 * k;
#if STAMP
  // The glow-pass stamp: a SOFT tinted core (triangle falloff to the stamp
  // width), brightness = glow × the shape's live glowMul; the shared
  // half-res gaussian blur turns this into the phosphor halo.
  float soft = (1.0 - smoothstep(0.0, max(vWidth.y * boost, 1e-4), d)) * gate;
  float g = soft * col.a * vExtra.y * (1.0 + vExtra.z * 1.2 * k);
  outColor = vec4(col.rgb * g, g);             // MAX-blended in the target
#else
  // The scene line: a crisp AA core, nothing else — glow 0 IS this look.
  float cw = vWidth.x * boost;
  float core = (1.0 - smoothstep(cw - aa, cw + aa, d)) * gate * jcut;
  float aCore = core * col.a;
  outColor = vec4(col.rgb * aCore, aCore);     // premultiplied out
#endif
}
`;
/**
* The layer: retained shapes + fragments + immediate pushes — the GL twin of
* VectorLayer. Two programs, two instance VBOs (static repacks only when
* dirty; dynamic re-uploads each frame), one xform data texture.
*/
var GlVectorLayer = class {
	/** @internal Static (retained) data needs re-packing. */
	dirty = false;
	/** @see VectorLayer.clip — clip the whole layer to a world rect (the glow
	*  stamp is scissored with it, so halos are cut at the same edge). */
	clip = null;
	/** @see VectorLayer.fills — null (default) auto-detects, true/false force. */
	fills = null;
	/** How wide the widest live glow stamp is (0 = nothing glows) — the
	* renderer wakes the shared GlowPass with it. Valid after prepare(). */
	glowSize = 0;
	shapes = [];
	fragments = [];
	trails = [];
	/** @internal Registered starfields, stepped and drawn with the trails. */
	fields = [];
	/** @internal How many immediate instances are BACKDROP — see the note on
	*  VectorLayer.backdropCount. */
	backdropCount = 0;
	/** The view rect this layer is drawing — what an unbounded starfield uses. */
	get viewRect() {
		const u = this.uniformData;
		return {
			x: u[0],
			y: u[1],
			w: u[2],
			h: u[3]
		};
	}
	/**
	* A STARFIELD behind the game — parallax drift, or a warp tunnel into the
	* screen. Everything about it is a live property; see `VecStarfield`.
	*
	* ```ts
	* const sky = game.vector.starfield({ count: 300, speed: 60, angle: Math.PI });
	* sky.speed = 60 + throttle * 900;                    // live
	* const tunnel = game.vector.starfield({ mode: 'warp', speed: 320, streak: 0.05 });
	* ```
	*
	* The layer steps and draws it — there is nothing to call per frame.
	* `kill()` removes it.
	*/
	starfield(opts = {}) {
		const f = new VecStarfield(this, opts);
		this.fields.push(f);
		return f;
	}
	/** Runs across frames so a stream cycles a colour source smoothly. */
	colorSeq = 0;
	rng = Math.random;
	fillData = new Float32Array(1024 * 8);
	fillOpaque = 0;
	fillBlend = 0;
	fillVbo = null;
	fillVboBytes = 0;
	fillProgram = null;
	uViewLocFill = null;
	slotOf = /* @__PURE__ */ new Map();
	staticData = new Float32Array(1024 * 24);
	staticCount = 0;
	dynData = new Float32Array(1024 * 24);
	dynCount = 0;
	dynGlow = 0;
	xformData = new Float32Array(256 * 8);
	uniformData = /* @__PURE__ */ new Float32Array(4);
	gl;
	program = null;
	stampProgram = null;
	uViewLoc = null;
	uViewLocStamp = null;
	vao = null;
	staticVbo = null;
	staticVboBytes = 0;
	dynBuf;
	dynVbo = null;
	xfTex = null;
	xfTexWidth = 0;
	constructor(gl) {
		this.rebuild(gl);
	}
	/** Live counts (debug/HUD). */
	get counts() {
		let segments = this.dynCount;
		for (const s of this.shapes) if (!s.dead) segments += s.segs.length * (s.wrap ? 4 : 1);
		for (const f of this.fragments) segments += f.segs.length;
		return {
			shapes: this.shapes.filter((s) => !s.dead).length,
			fragments: this.fragments.length,
			segments
		};
	}
	/** Add a retained shape from an outline (see VectorShapeOptions). */
	shape(points, opts = {}) {
		const s = new VectorShape(this, points, opts);
		this.shapes.push(s);
		this.dirty = true;
		return s;
	}
	/** @see VectorLayer.trail — a ribbon that follows a moving point. */
	trail(opts = {}) {
		const t = new VecTrail(this, opts);
		this.trails.push(t);
		return t;
	}
	/** Immediate one-frame segment (aim lines, scanner sweeps, lightning). */
	seg(x0, y0, x1, y1, style = {}) {
		const p = packStyle(style);
		if (p.glow > 0) this.dynGlow = Math.max(this.dynGlow, p.stampHalf);
		this.pushDyn(x0, y0, x1, y1, p, 0);
	}
	/** Immediate one-frame polyline. */
	poly(points, style = {}, closed = false) {
		const p = packStyle(style);
		if (p.glow > 0) this.dynGlow = Math.max(this.dynGlow, p.stampHalf);
		const segs = polySegs(points, closed);
		const per = segmentStyles(style, segs);
		const joins = chainJoins(points, closed);
		let k = 0;
		for (const [a, b] of segs) {
			this.pushDyn(a.x, a.y, b.x, b.y, per?.[k] ?? p, 0, joins, k * 4);
			k++;
		}
	}
	/**
	* Immediate arc — `from` and `to` in radians, clockwise (y is down, so
	* -PI/2 is straight up). A full circle is `arc(x, y, r, 0, Math.PI * 2)`.
	*
	* ```ts
	* game.vector.arc(cx, cy, 90, -0.5, 0.5, { color: '#41d6ff', glow: 0.9 });
	* ```
	*
	* `steps` overrides the tessellation (default: one segment per ~11°). For a
	* ring that ROTATES or breaks apart, build it retained instead — see
	* `vectorKit.ringSections()`.
	*/
	arc(cx, cy, r, from, to, style = {}, steps) {
		this.poly(arcPoints(cx, cy, r, from, to, steps), style, false);
	}
	/**
	* Draw a line of text AS LINE ART — the same beam that draws everything else.
	*
	* ```ts
	* game.vector.text('SCORE 004200', 20, 20, { size: 26, style: { color: '#39f0a0', glow: 0.8 } });
	* game.vector.text('GAME OVER', cx, cy, { size: 70, align: 'center', colors: 'rainbow' });
	* ```
	*
	* Caps-only (lowercase folds up), straight strokes only, `\n` starts a new
	* line. It takes everything a line takes — `width`, `glow`, `dash`, and a
	* `colors` SOURCE stepped per stroke.
	*
	* This is the immediate path. To make text a real object that can fly,
	* rotate and `shatter()`, build it with `vectorKit.textOutline()` and hand
	* the polylines to `shape()`.
	*/
	text(str, x, y, opts = {}) {
		const style = opts.style ?? {};
		for (const pts of textOutline(str, x, y, opts)) this.poly(pts, style, false);
	}
	/** @internal Deterministic tests inject a seeded rng. */
	setRng(rng) {
		this.rng = rng;
	}
	/** @internal The shatter kinematics — a verbatim twin of
	* VectorLayer.shatterShape (see the midpoint re-parenting note there). */
	shatterShape(shape, opts) {
		if (shape.dead) return;
		const cr = Math.cos(shape.rot), sr = Math.sin(shape.rot);
		const s = shape.scale;
		const org = shapeOrigin(shape);
		const toWorld = (p) => ({
			x: org.x + (p.x * cr - p.y * sr) * s,
			y: org.y + (p.x * sr + p.y * cr) * s
		});
		const hub = shape.pivot ? {
			x: shape.x + shape.pivot.x,
			y: shape.y + shape.pivot.y
		} : {
			x: shape.x,
			y: shape.y
		};
		let k = 0;
		for (const seg of shape.segs) {
			const a = toWorld(seg[0]);
			const b = toWorld(seg[1]);
			const mid = {
				x: (a.x + b.x) / 2,
				y: (a.y + b.y) / 2
			};
			const dx = mid.x - hub.x, dy = mid.y - hub.y;
			const dl = Math.hypot(dx, dy) || 1;
			const f = spawnFragment(mid.x, mid.y, dx / dl, dy / dl, opts, this.rng);
			f.segs = [[{
				x: a.x - mid.x,
				y: a.y - mid.y
			}, {
				x: b.x - mid.x,
				y: b.y - mid.y
			}]];
			f.joins = null;
			f.style = shape.segStyles?.[k++] ?? shape.style;
			f.drag = opts.drag ?? .4;
			f.glowMul = shape.glowMul;
			f.scaleFrom = 1;
			f.scaleTo = 1;
			f.gravity = 0;
			this.fragments.push(f);
		}
		shape.kill();
	}
	/** Advance fragments (Game ticks this). */
	/**
	* Spawn a burst of VECTOR particles — little outlines that fly, spin, fade
	* and glow with the rest of the layer.
	*
	* ```ts
	* game.vector.emit({ x, y, count: 24, shape: ['triangle', 'square'],
	*                    size: 7, speed: 160, spin: 6,
	*                    style: { color: '#41d6ff', width: 2, glow: 0.9 } });
	* ```
	*
	* They cost what any other segments cost: same buffers, same transform slot,
	* same glow stamp. Mixing `shape` kinds picks one per particle.
	*/
	emit(opts) {
		const rand = this.rng;
		const count = opts.count ?? 12;
		const kinds = Array.isArray(opts.shape) ? opts.shape.length ? opts.shape : ["square"] : [opts.shape ?? "square"];
		const baseStyle = packStyle(opts.style ?? {});
		const src = opts.colors;
		const size = opts.size ?? 6;
		const sizeVar = opts.sizeVar ?? 2;
		const speed = opts.speed ?? 90;
		const speedVar = opts.speedVar ?? 40;
		const angle = opts.angle ?? 0;
		const spread = opts.spread ?? Math.PI * 2;
		const spawnR = opts.spawnRadius ?? 0;
		const life = opts.life ?? 1.2;
		const lifeVar = opts.lifeVar ?? .4;
		const shrink = opts.shrink ?? 1;
		const outlines = /* @__PURE__ */ new Map();
		const joins = /* @__PURE__ */ new Map();
		for (const k of kinds) {
			if (outlines.has(k)) continue;
			const o = particleOutline(k, opts.circleSides ?? 10);
			outlines.set(k, o);
			joins.set(k, segJoins(o));
		}
		for (let i = 0; i < count; i++) {
			const a = opts.even ? angle - spread / 2 + spread * ((i + .5) / count) : angle + (rand() - .5) * spread;
			const v = Math.max(0, speed + (rand() - .5) * 2 * speedVar);
			const r = Math.max(.1, size + (rand() - .5) * 2 * sizeVar);
			const sx = spawnR > 0 ? opts.x + (rand() - .5) * 2 * spawnR : opts.x;
			const sy = spawnR > 0 ? opts.y + (rand() - .5) * 2 * spawnR : opts.y;
			const kind = kinds.length === 1 ? kinds[0] : kinds[rand() * kinds.length | 0];
			const style = src === void 0 ? baseStyle : tintStyle(baseStyle, resolveVecColor(src, this.colorSeq++));
			const f = {
				x: sx,
				y: sy,
				rot: rand() * Math.PI * 2,
				scale: r,
				vx: Math.cos(a) * v,
				vy: Math.sin(a) * v,
				spin: (rand() - .5) * 2 * (opts.spin ?? 3),
				age: 0,
				life: Math.max(.05, life + (rand() - .5) * 2 * lifeVar),
				segs: outlines.get(kind),
				joins: joins.get(kind),
				style,
				drag: opts.drag ?? .4,
				glowMul: 1,
				scaleFrom: r,
				scaleTo: r * shrink,
				gravity: opts.gravity ?? 0
			};
			this.fragments.push(f);
		}
		this.dirty = true;
	}
	update(dt) {
		if (this.trails.length) {
			this.trails = this.trails.filter((t) => !t.dead);
			for (const t of this.trails) t.step(dt);
		}
		if (this.fields.length) {
			this.fields = this.fields.filter((f) => !f.dead);
			for (const f of this.fields) f.step(dt);
		}
		let removed = false;
		for (let i = this.fragments.length - 1; i >= 0; i--) {
			const f = this.fragments[i];
			f.vy += f.gravity * dt;
			if (!stepFragment(f, dt, f.drag)) {
				this.fragments.splice(i, 1);
				removed = true;
				continue;
			}
			if (f.scaleTo !== f.scaleFrom) {
				const t = Math.min(1, f.age / Math.max(1e-5, f.life));
				f.scale = f.scaleFrom + (f.scaleTo - f.scaleFrom) * t;
			}
		}
		if (removed) this.dirty = true;
	}
	/** Start a frame (same world rect as the sprite batches). */
	begin(viewX, viewY, viewW, viewH) {
		this.dynCount = 0;
		this.dynGlow = 0;
		this.uniformData[0] = viewX;
		this.uniformData[1] = viewY;
		this.uniformData[2] = viewW;
		this.uniformData[3] = viewH;
	}
	/**
	* Upload everything for this frame: repack static data if dirty, pack the
	* live transform table into the xf data texture, upload the dynamic
	* pushes, and measure the glow. The renderer calls this BEFORE the
	* GlowPass renders (the stamps draw there).
	*/
	prepare() {
		for (const f of this.fields) if (!f.dead) f.emit();
		this.backdropCount = this.dynCount;
		for (const t of this.trails) if (!t.dead) t.emit();
		const gl = this.gl;
		if (this.dirty) {
			this.shapes = this.shapes.filter((s) => !s.dead);
			this.repackStatic();
			this.dirty = false;
		}
		let slots = 1 + this.fragments.length;
		for (const s of this.shapes) slots += s.wrap ? 4 : 1;
		if (slots * 8 > this.xformData.length) this.xformData = new Float32Array(ceilPow2(slots) * 8);
		const x = this.xformData;
		x[0] = 0;
		x[1] = 0;
		x[2] = 0;
		x[3] = 1;
		x[4] = 1;
		x[5] = 1;
		x[6] = 0;
		x[7] = 0;
		let slot = 1;
		for (const s of this.shapes) {
			const org = shapeOrigin(s);
			const write = (dx, dy) => {
				const o = slot * 8;
				x[o] = org.x + dx;
				x[o + 1] = org.y + dy;
				x[o + 2] = s.rot;
				x[o + 3] = s.scale;
				x[o + 4] = s.alpha;
				x[o + 5] = s.glowMul;
				x[o + 6] = 0;
				x[o + 7] = 0;
				slot++;
			};
			write(0, 0);
			if (s.wrap) {
				const dx = s.x < s.wrap.w / 2 ? s.wrap.w : -s.wrap.w;
				const dy = s.y < s.wrap.h / 2 ? s.wrap.h : -s.wrap.h;
				write(dx, 0);
				write(0, dy);
				write(dx, dy);
			}
		}
		for (const f of this.fragments) {
			const o = slot * 8;
			x[o] = f.x;
			x[o + 1] = f.y;
			x[o + 2] = f.rot;
			x[o + 3] = f.scale;
			x[o + 4] = fragmentAlpha(f.age, f.life);
			x[o + 5] = f.glowMul;
			x[o + 6] = 0;
			x[o + 7] = 0;
			slot++;
		}
		const texels = this.xformData.length / 4;
		if (!this.xfTex) {
			this.xfTex = gl.createTexture();
			this.xfTexWidth = 0;
		}
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.xfTex);
		if (this.xfTexWidth !== texels) {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, texels, 1, 0, gl.RGBA, gl.FLOAT, this.xformData);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			this.xfTexWidth = texels;
		} else gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, slots * 2, 1, gl.RGBA, gl.FLOAT, this.xformData, 0);
		if (this.dynCount > 0) this.dynVbo = this.dynBuf.upload(this.dynData, this.dynCount * 24);
		let g = 0;
		for (const s of this.shapes) if (s.style.glow > 0 && s.glowMul > 0) g = Math.max(g, s.style.stampHalf * Math.min(2, s.glowMul));
		for (const f of this.fragments) if (f.style.glow > 0 && f.glowMul > 0) g = Math.max(g, f.style.stampHalf * Math.min(2, f.glowMul));
		if (this.dynGlow > 0) g = Math.max(g, this.dynGlow);
		this.glowSize = g;
	}
	/**
	* Draw the crisp scene lines (static + dynamic, two draws max) into the
	* current framebuffer. `pxW`/`pxH` are the framebuffer's pixel size, needed
	* only to turn `clip` into a scissor.
	*/
	draw(pxW = 0, pxH = 0) {
		this.drawFills(pxW, pxH);
		this.drawWith(this.program, this.uViewLoc, false, pxW, pxH);
	}
	/**
	* @internal Solid faces, before any line. Opaque ones write depth (the
	* occluders), translucent ones only test it. The scissor is applied here too
	* so `clip` cuts faces exactly as it cuts lines.
	*/
	drawFills(pxW, pxH) {
		if (!this.fillsOn || !this.fillProgram || !this.fillVbo) return;
		if (this.fillOpaque + this.fillBlend === 0) return;
		const gl = this.gl;
		const u = this.uniformData;
		const sc = this.clip && pxW > 0 && pxH > 0 ? clipToScissor(this.clip, u[0], u[1], u[2], u[3], pxW, pxH) : null;
		if (this.clip && pxW > 0 && pxH > 0) {
			if (!sc) return;
			gl.enable(gl.SCISSOR_TEST);
			gl.scissor(sc.x, pxH - (sc.y + sc.h), sc.w, sc.h);
		}
		gl.useProgram(this.fillProgram);
		gl.uniform4fv(this.uViewLocFill, this.uniformData);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.xfTex);
		if (!this.vao) this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.fillVbo);
		for (const loc of [0, 1]) {
			gl.enableVertexAttribArray(loc);
			gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, 32, loc * 16);
			gl.vertexAttribDivisor(loc, 0);
		}
		gl.enable(gl.BLEND);
		gl.blendEquation(gl.FUNC_ADD);
		gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
		gl.enable(gl.DEPTH_TEST);
		gl.depthFunc(gl.LEQUAL);
		if (this.fillOpaque > 0) {
			gl.depthMask(true);
			gl.drawArrays(gl.TRIANGLES, 0, this.fillOpaque);
		}
		if (this.fillBlend > 0) {
			gl.depthMask(false);
			gl.drawArrays(gl.TRIANGLES, this.fillOpaque, this.fillBlend);
		}
		gl.depthMask(false);
		gl.bindVertexArray(null);
		if (sc) gl.disable(gl.SCISSOR_TEST);
	}
	/** Draw the soft glow stamps into the GlowPass's half-res target (the
	*  renderer hands this as the extra-stamps callback — the stamp FBO is
	*  bound). MAX blend so overlapping caps saturate; FUNC_ADD restored. */
	stampGlow(pxW = 0, pxH = 0) {
		this.drawWith(this.stampProgram, this.uViewLocStamp, true, pxW, pxH);
	}
	drawWith(program, uViewLoc, stamp, pxW = 0, pxH = 0) {
		const gl = this.gl;
		if (!program || this.staticCount === 0 && this.dynCount === 0) return;
		const u = this.uniformData;
		const sc = this.clip && pxW > 0 && pxH > 0 ? clipToScissor(this.clip, u[0], u[1], u[2], u[3], pxW, pxH) : null;
		if (this.clip && pxW > 0 && pxH > 0) {
			if (!sc) return;
			gl.enable(gl.SCISSOR_TEST);
			gl.scissor(sc.x, pxH - (sc.y + sc.h), sc.w, sc.h);
		}
		gl.useProgram(program);
		gl.uniform4fv(uViewLoc, this.uniformData);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.xfTex);
		if (!this.vao) this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		gl.enable(gl.BLEND);
		if (stamp) {
			gl.blendEquation(gl.MAX);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.disable(gl.DEPTH_TEST);
			gl.depthMask(false);
		} else {
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.enable(gl.DEPTH_TEST);
			gl.depthFunc(gl.LEQUAL);
			gl.depthMask(false);
		}
		const backdrop = stamp ? 0 : this.backdropCount;
		if (backdrop > 0 && this.dynVbo) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.dynVbo);
			instanceVec4Attribs(gl, 0, 6);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, backdrop);
		}
		if (this.staticCount > 0 && this.staticVbo) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.staticVbo);
			instanceVec4Attribs(gl, 0, 6);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.staticCount);
		}
		if (this.dynCount > backdrop && this.dynVbo) {
			gl.bindBuffer(gl.ARRAY_BUFFER, this.dynVbo);
			instanceVec4Attribs(gl, 0, 6, backdrop * 6 * 16);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.dynCount - backdrop);
		}
		if (stamp) gl.blendEquation(gl.FUNC_ADD);
		if (sc) gl.disable(gl.SCISSOR_TEST);
		gl.bindVertexArray(null);
	}
	/** Kill everything (scene teardown). */
	clear() {
		this.shapes = [];
		this.fragments = [];
		this.trails = [];
		this.fields = [];
		this.dirty = true;
	}
	/** (Re)create every GL-side object — the context-loss recovery path. */
	rebuild(gl) {
		this.gl = gl;
		this.program = compileProgram(gl, buildLineVertGLSL(false), buildLineFragGLSL(false), "GlVectorLayer");
		this.stampProgram = compileProgram(gl, buildLineVertGLSL(true), buildLineFragGLSL(true), "GlVectorLayer stamp");
		this.fillProgram = compileProgram(gl, buildFillVertGLSL(), buildFillFragGLSL(), "GlVectorLayer fill");
		this.uViewLocFill = this.fillProgram ? gl.getUniformLocation(this.fillProgram, "uView") : null;
		this.fillVbo = null;
		this.fillVboBytes = 0;
		this.uViewLoc = this.program ? gl.getUniformLocation(this.program, "uView") : null;
		this.uViewLocStamp = this.stampProgram ? gl.getUniformLocation(this.stampProgram, "uView") : null;
		this.dynBuf = new InstanceBuffer(gl);
		this.dynVbo = null;
		this.vao = null;
		this.staticVbo = null;
		this.staticVboBytes = 0;
		this.xfTex = null;
		this.xfTexWidth = 0;
		this.dirty = true;
	}
	pushDyn(x0, y0, x1, y1, p, slot, j, ji = 0) {
		if ((this.dynCount + 1) * 24 > this.dynData.length) {
			const next = new Float32Array(this.dynData.length * 2);
			next.set(this.dynData);
			this.dynData = next;
		}
		writeSeg(this.dynData, this.dynCount * 24, x0, y0, x1, y1, p, slot, j, ji);
		this.dynCount++;
	}
	/** @internal @see VectorLayer.fillsOn */
	get fillsOn() {
		if (this.fills !== null) return this.fills;
		for (const s of this.shapes) if (!s.dead && s.filled) return true;
		return false;
	}
	/** @internal Twin of VectorLayer.repackFills — opaque faces first (they
	*  write depth), translucent after (they must not). */
	repackFills() {
		const live = this.shapes.filter((s) => !s.dead && s.filled);
		let n = 0;
		for (const s of live) n += s.fillVerts.length / 6 * (s.wrap ? 4 : 1);
		if (n * 8 > this.fillData.length) this.fillData = new Float32Array(ceilPow2(n) * 8);
		const d = this.fillData;
		let i = 0;
		for (const wantOpaque of [true, false]) {
			for (const s of live) {
				if ((s.fillVerts[5] >= .999 && s.alpha >= .999) !== wantOpaque) continue;
				const slot = this.slotOf.get(s) ?? 0;
				const copies = s.wrap ? 4 : 1;
				for (let c = 0; c < copies; c++) for (let v = 0; v < s.fillVerts.length; v += 6) {
					const o = i * 8;
					d[o] = s.fillVerts[v];
					d[o + 1] = s.fillVerts[v + 1];
					d[o + 2] = s.style.z;
					d[o + 3] = slot + c;
					d[o + 4] = s.fillVerts[v + 2];
					d[o + 5] = s.fillVerts[v + 3];
					d[o + 6] = s.fillVerts[v + 4];
					d[o + 7] = s.fillVerts[v + 5];
					i++;
				}
			}
			if (wantOpaque) this.fillOpaque = i;
		}
		this.fillBlend = i - this.fillOpaque;
		if (i > 0) {
			const gl = this.gl;
			if (!this.fillVbo) this.fillVbo = gl.createBuffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, this.fillVbo);
			if (i * 8 * 4 > this.fillVboBytes) {
				gl.bufferData(gl.ARRAY_BUFFER, this.fillData, gl.DYNAMIC_DRAW);
				this.fillVboBytes = this.fillData.byteLength;
			} else gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.fillData, 0, i * 8);
		}
	}
	repackStatic() {
		const gl = this.gl;
		let n = 0;
		for (const s of this.shapes) n += s.segs.length * (s.wrap ? 4 : 1);
		for (const f of this.fragments) n += f.segs.length;
		if (n * 24 > this.staticData.length) this.staticData = new Float32Array(ceilPow2(n) * 24);
		let i = 0;
		let slot = 1;
		this.slotOf.clear();
		for (const s of this.shapes) {
			this.slotOf.set(s, slot);
			const copies = s.wrap ? 4 : 1;
			for (let c = 0; c < copies; c++) {
				let k = 0;
				for (const [a, b] of s.segs) {
					writeSeg(this.staticData, i * 24, a.x, a.y, b.x, b.y, s.segStyles?.[k] ?? s.style, slot, s.joins, k * 4);
					i++;
					k++;
				}
				slot++;
			}
		}
		for (const f of this.fragments) {
			let k = 0;
			for (const [a, b] of f.segs) {
				writeSeg(this.staticData, i * 24, a.x, a.y, b.x, b.y, f.style, slot, f.joins, k * 4);
				i++;
				k++;
			}
			slot++;
		}
		this.staticCount = i;
		this.repackFills();
		if (i > 0) {
			if (!this.staticVbo) {
				this.staticVbo = gl.createBuffer();
				this.staticVboBytes = 0;
			}
			gl.bindBuffer(gl.ARRAY_BUFFER, this.staticVbo);
			if (this.staticData.byteLength > this.staticVboBytes) {
				gl.bufferData(gl.ARRAY_BUFFER, this.staticData.byteLength, gl.DYNAMIC_DRAW);
				this.staticVboBytes = this.staticData.byteLength;
			}
			gl.bufferSubData(gl.ARRAY_BUFFER, 0, this.staticData, 0, i * 24);
		}
	}
};
function writeSeg(d, o, x0, y0, x1, y1, p, slot, j, ji = 0) {
	d[o] = x0;
	d[o + 1] = y0;
	d[o + 2] = x1;
	d[o + 3] = y1;
	d[o + 4] = p.coreHalf;
	d[o + 5] = p.stampHalf;
	d[o + 6] = p.z;
	d[o + 7] = slot;
	d[o + 8] = p.dash;
	d[o + 9] = p.glow;
	d[o + 10] = p.capped;
	d[o + 11] = p.dwell;
	d[o + 12] = p.c0[0];
	d[o + 13] = p.c0[1];
	d[o + 14] = p.c0[2];
	d[o + 15] = p.c0[3];
	d[o + 16] = p.c1[0];
	d[o + 17] = p.c1[1];
	d[o + 18] = p.c1[2];
	d[o + 19] = p.c1[3];
	d[o + 20] = j ? j[ji] : 0;
	d[o + 21] = j ? j[ji + 1] : 0;
	d[o + 22] = j ? j[ji + 2] : 0;
	d[o + 23] = j ? j[ji + 3] : 0;
}
function ceilPow2(n) {
	let v = 1024;
	while (v < n) v *= 2;
	return v;
}
//#endregion
//#region src/lib/webgl/glowpass.ts
var FLOATS$1 = 16;
/** Stamp vertex shader — the GLSL port of STAMP_WGSL's `vs`. */
var buildGlowStampVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iPosSize;
layout(location=1) in vec4 iMisc;   // rot, flipX, _, _
layout(location=2) in vec4 iColor;
layout(location=3) in vec4 iUv;
uniform vec4 uView;
out vec2 vUv;
out vec4 vColor;
void main() {
  vec2 c01 = vec2(float(gl_VertexID & 1), float(gl_VertexID >> 1));
  vec2 centre = iPosSize.xy + iPosSize.zw * 0.5;
  vec2 off = (c01 - 0.5) * iPosSize.zw;
  float sn = sin(iMisc.x);
  float cn = cos(iMisc.x);
  vec2 world = centre + vec2(off.x * cn - off.y * sn, off.x * sn + off.y * cn);
  vec2 ndc = (world - uView.xy) / uView.zw * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  float ux = c01.x;
  if (iMisc.y > 0.5) { ux = 1.0 - ux; }
  vUv = vec2(mix(iUv.x, iUv.z, ux), mix(iUv.y, iUv.w, c01.y));
  vColor = iColor;
}
`;
/** Stamp fragment shader — tinted silhouette, additive-summed. */
var buildGlowStampFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vUv;
in vec4 vColor;
uniform sampler2D uTex;
out vec4 outColor;
void main() {
  float a = texture(uTex, vUv).a * vColor.a;
  outColor = vec4(vColor.rgb * a, a);   // tinted silhouette, additive-summed
}
`;
/** Shared fullscreen-triangle vertex shader (identity mapping — see header). */
var buildFullscreenVertGLSL = () => GLSL_HEADER + `
out vec2 vUv;
void main() {
  float x = float((gl_VertexID << 1) & 2);
  float y = float(gl_VertexID & 2);
  gl_Position = vec4(x * 2.0 - 1.0, y * 2.0 - 1.0, 0.0, 1.0);
  vUv = vec2(x, y);
}
`;
/** Separable 13-tap gaussian blur fragment — the GLSL port of BLUR_WGSL. */
var buildGlowBlurFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vUv;
uniform vec2 uDir;    // step (texel * spread * axis)
uniform sampler2D uSrc;
out vec4 outColor;
const float W[7] = float[7](0.199, 0.176, 0.121, 0.065, 0.0275, 0.009, 0.0022);
void main() {
  vec4 acc = texture(uSrc, vUv) * W[0];
  for (int i = 1; i < 7; i++) {
    vec2 o = uDir * float(i);
    acc += texture(uSrc, clamp(vUv + o, vec2(0.0), vec2(1.0))) * W[i];
    acc += texture(uSrc, clamp(vUv - o, vec2(0.0), vec2(1.0))) * W[i];
  }
  outColor = acc;
}
`;
/** Additive composite fragment — the GLSL port of COMPOSITE_WGSL. */
var buildGlowCompositeFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vUv;
uniform float uStrength;
uniform sampler2D uSrc;
out vec4 outColor;
void main() {
  vec4 g = texture(uSrc, vUv);
  outColor = vec4(g.rgb * uStrength, 0.0);   // additive: pure light
}
`;
var GlGlowPass = class {
	data = new Float32Array(256 * FLOATS$1);
	count = 0;
	capacity = 256;
	maxSize = 0;
	extraActive = false;
	view = /* @__PURE__ */ new Float32Array(4);
	gl;
	stampProgram = null;
	blurProgram = null;
	compProgram = null;
	uViewLoc = null;
	uDirLoc = null;
	uStrengthLoc = null;
	vao = null;
	instances;
	targets = null;
	targetW = 0;
	targetH = 0;
	atlasTexture = null;
	constructor(gl) {
		this.rebuild(gl);
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
		this.view[0] = x;
		this.view[1] = y;
		this.view[2] = w;
		this.view[3] = h;
	}
	/** @internal Queue one glowing sprite's tinted silhouette (world coords) —
	*  identical packing to GlowPass.stamp. */
	stamp(x, y, w, h, f, rot, flipX, r, g, b, a, size) {
		if (this.count === this.capacity) {
			this.capacity *= 2;
			const next = new Float32Array(this.capacity * FLOATS$1);
			next.set(this.data);
			this.data = next;
		}
		const o = this.count * FLOATS$1;
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
	makeTarget(w, h) {
		const gl = this.gl;
		const tex = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
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
	/** @internal Render silhouette + blur chain (before the scene target is
	* bound). `extra` draws additional stamps into the same half-res pass (the
	* vector layer's soft line cores — it runs with our stamp FBO bound and the
	* viewport set); one blur serves every glowing thing. Restores the
	* framebuffer binding to null + full viewport before returning. */
	render(canvasW, canvasH, extra) {
		const gl = this.gl;
		const spriteStamps = this.count > 0 && !!this.atlasTexture && !!this.stampProgram;
		if (!spriteStamps && !this.extraActive) return;
		const w = Math.max(1, canvasW >> 1), h = Math.max(1, canvasH >> 1);
		if (!this.targets || this.targetW !== w || this.targetH !== h) {
			if (this.targets) for (const t of this.targets) {
				gl.deleteFramebuffer(t.fbo);
				gl.deleteTexture(t.tex);
			}
			this.targets = [this.makeTarget(w, h), this.makeTarget(w, h)];
			this.targetW = w;
			this.targetH = h;
		}
		const [A, B] = this.targets;
		gl.bindFramebuffer(gl.FRAMEBUFFER, A.fbo);
		gl.viewport(0, 0, w, h);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(false);
		if (!this.vao) this.vao = gl.createVertexArray();
		if (spriteStamps) {
			gl.useProgram(this.stampProgram);
			gl.uniform4fv(this.uViewLoc, this.view);
			gl.bindVertexArray(this.vao);
			this.instances.upload(this.data, this.count * FLOATS$1);
			instanceVec4Attribs(gl, 0, 4);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, this.atlasTexture);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE);
			gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, 4, this.count);
			gl.bindVertexArray(null);
		}
		extra?.();
		gl.blendEquation(gl.FUNC_ADD);
		if (this.blurProgram) {
			const spread = Math.min(3, Math.max(.6, this.maxSize / 10));
			gl.useProgram(this.blurProgram);
			gl.disable(gl.BLEND);
			gl.bindVertexArray(this.vao);
			gl.activeTexture(gl.TEXTURE0);
			for (let i = 0; i < 2; i++) {
				this.blurTo(A, B, spread / w, 0);
				this.blurTo(B, A, 0, spread / h);
			}
			gl.bindVertexArray(null);
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvasW, canvasH);
	}
	blurTo(from, to, dx, dy) {
		const gl = this.gl;
		gl.bindFramebuffer(gl.FRAMEBUFFER, to.fbo);
		gl.viewport(0, 0, this.targetW, this.targetH);
		gl.uniform2f(this.uDirLoc, dx, dy);
		gl.bindTexture(gl.TEXTURE_2D, from.tex);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}
	/** @internal Additively composite the blurred glow into whatever
	* framebuffer is CURRENT (the renderer binds its scene target first). */
	composite(_pass) {
		const gl = this.gl;
		if (!this.active || !this.targets || !this.compProgram) return;
		gl.useProgram(this.compProgram);
		gl.uniform1f(this.uStrengthLoc, 1.15);
		if (!this.vao) this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.targets[0].tex);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE);
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(false);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindVertexArray(null);
	}
	/** Point the stamp pass at the shared atlas (a WebGLTexture here). */
	setTexture(view) {
		this.atlasTexture = view;
	}
	/** (Re)create every GL-side object — the context-loss recovery path. */
	rebuild(gl) {
		this.gl = gl;
		this.stampProgram = compileProgram(gl, buildGlowStampVertGLSL(), buildGlowStampFragGLSL(), "GlGlowPass stamp");
		this.blurProgram = compileProgram(gl, buildFullscreenVertGLSL(), buildGlowBlurFragGLSL(), "GlGlowPass blur");
		this.compProgram = compileProgram(gl, buildFullscreenVertGLSL(), buildGlowCompositeFragGLSL(), "GlGlowPass composite");
		this.uViewLoc = this.stampProgram ? gl.getUniformLocation(this.stampProgram, "uView") : null;
		this.uDirLoc = this.blurProgram ? gl.getUniformLocation(this.blurProgram, "uDir") : null;
		this.uStrengthLoc = this.compProgram ? gl.getUniformLocation(this.compProgram, "uStrength") : null;
		this.instances = new InstanceBuffer(gl);
		this.vao = null;
		this.targets = null;
		this.targetW = 0;
		this.targetH = 0;
		this.atlasTexture = null;
	}
};
//#endregion
//#region src/lib/webgl/post.ts
var GLSL_EFFECT_SNIPPETS = {
	/** Internal passthrough — blitToCanvas presents the offscreen scene with it
	*  (the canvas backbuffer is multisampled, so a real blit is illegal). */
	__present: `
    color = tex(uv);`,
	/** Chunky pixels: 5-tap weighted cell average (see effects.ts pixelate). */
	pixelate: `
    float px = max(1.0, size);
    vec2 centre = px * floor(uv * u.res.xy / px) + px * 0.5;
    color = tex(centre / u.res.xy) * 0.4
      + tex((centre + px * vec2(-0.5, -0.5)) / u.res.xy) * 0.15
      + tex((centre + px * vec2( 0.5, -0.5)) / u.res.xy) * 0.15
      + tex((centre + px * vec2( 0.5,  0.5)) / u.res.xy) * 0.15
      + tex((centre + px * vec2(-0.5,  0.5)) / u.res.xy) * 0.15;`,
	/** Darkened corners. */
	vignette: `
    vec2 c = uv * 2.0 - 1.0;
    color = vec4(color.rgb * (1.0 - strength * dot(c, c) * 0.7), color.a);`,
	/** One-pass bloom: two Gaussian-weighted 8-tap rings (see effects.ts bloom). */
	bloom: `
    vec3 glow = vec3(0.0);
    float wsum = 0.0;
    for (int ring = 1; ring <= 2; ring++) {
      vec2 rad = float(ring) * radius * texel;
      float w = exp(-float(ring * ring) * 0.28);
      for (int k = 0; k < 8; k++) {
        float ang = (float(k) + float(ring) * 0.5) * 0.7853982;   // 2pi/8, ring-staggered
        vec3 s = tex(uv + vec2(cos(ang), sin(ang)) * rad).rgb;
        glow += max(vec3(0.0), s - vec3(threshold)) * w;
        wsum += w;
      }
    }
    color = vec4(color.rgb + glow / wsum * strength * 2.0, color.a);`,
	/** CRT: barrel curvature + scanlines + vignette, black outside the tube. */
	crt: `
    vec2 c = uv * 2.0 - 1.0;
    float r2 = dot(c, c);
    vec2 cuv = (c * (1.0 + curve * r2) + 1.0) * 0.5;
    color = tex(cuv);
    float sl = 1.0 - scan * (0.5 + 0.5 * sin(cuv.y * u.res.y * 3.14159));
    vec3 rgb = color.rgb * sl * (1.0 - vig * r2);
    float inside = step(0.0, cuv.x) * step(cuv.x, 1.0) * step(0.0, cuv.y) * step(cuv.y, 1.0);
    color = vec4(rgb * inside, color.a);`,
	/** Plain scanlines (no distortion). */
	scanlines: `
    float row = floor(uv.y * u.res.y / max(1.0, size));
    float k = 1.0 - strength * mod(row, 2.0);
    color = vec4(color.rgb * k, color.a);`,
	/** Quantize colours to N levels — poster / cel look. */
	posterize: `
    float n = max(2.0, levels);
    color = vec4(floor(color.rgb * n + vec3(0.5)) / n, color.a);`,
	/** Desaturate (amount 0..1). */
	grayscale: `
    float g = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color = vec4(mix(color.rgb, vec3(g), clamp(amount, 0.0, 1.0)), color.a);`,
	/** Underwater wobble. */
	wave: `
    vec2 w = vec2(sin(uv.y * freq + time * speed), cos(uv.x * freq * 0.8 + time * speed)) * amp;
    color = tex(uv + w);`,
	/** Chromatic aberration — RGB fringing that grows toward the edges. */
	chroma: `
    vec2 off = uv - vec2(0.5);
    vec2 d = off * (0.5 + dot(off, off) * 3.0) * shift * texel;
    color = vec4(tex(uv + d).r, color.g, tex(uv - d).b, color.a);`
};
/** Fullscreen-triangle vertex shader shared by every pass (uv.y = 0 at TOP —
*  the same corner math as buildEffectWGSL's vs). */
var POST_VS_GLSL = GLSL_HEADER + `
out vec2 vUv;
void main() {
  float x = float((gl_VertexID << 1) & 2);
  float y = float(gl_VertexID & 2);
  gl_Position = vec4(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  vUv = vec2(x, y);
}
`;
/** Splice a GLSL snippet into the full-screen post template — the GLSL mirror
*  of buildEffectWGSL (headless-testable string assembly). */
function buildEffectGLSL(def, snippet) {
	const names = Object.keys(def.params ?? {});
	if (names.length > 8) throw new Error(`effect '${def.name}': max 8 params`);
	return GLSL_FRAG_HEADER + `
struct U { vec4 res; vec4 p0; vec4 p1; };   // res: xy = size, z = time
uniform vec4 uRes;
uniform vec4 uP0;
uniform vec4 uP1;
uniform sampler2D uSrc;
in vec2 vUv;
out vec4 outColor;
U u;

// Sample the source frame at a top-down uv (flip to the FBO's bottom-up rows).
vec4 tex(vec2 p) {
  vec2 q = clamp(p, vec2(0.0), vec2(1.0));
  return texture(uSrc, vec2(q.x, 1.0 - q.y));
}

void main() {
  u = U(uRes, uP0, uP1);
  vec2 uv = vUv;
  float time = u.res.z;
  vec2 texel = vec2(1.0) / u.res.xy;
${names.map((n, i) => `  float ${n} = u.${i < 4 ? "p0" : "p1"}.${"xyzw"[i % 4]};`).join("\n")}
  vec4 color = tex(uv);
  {
${snippet}
  }
  outColor = color;
}
`;
}
var GlPostChain = class {
	gl;
	handles = [];
	programs = /* @__PURE__ */ new Map();
	warned = /* @__PURE__ */ new Set();
	targets = null;
	depth = null;
	width = 0;
	height = 0;
	constructor(gl) {
		this.gl = gl;
	}
	/** A pass runs only when its name has a GLSL port. */
	/** A def's GLSL: the built-in registry, or its own `glsl` twin field. */
	snippetFor(def) {
		return GLSL_EFFECT_SNIPPETS[def.name] ?? def.glsl;
	}
	runnable(def) {
		return this.snippetFor(def) !== void 0;
	}
	/** Any runnable effects? (The renderer skips the offscreen path when not.) */
	get active() {
		return this.handles.some((h) => this.runnable(h.def));
	}
	/** Append an effect (built-in name or a custom EffectDef — the block path). */
	add(effect, params) {
		const def = typeof effect === "string" ? EFFECTS[effect] ?? EFFECT_PACK[effect] : effect;
		if (!def) throw new Error(`Unknown post effect '${String(effect)}'`);
		if (!this.runnable(def) && !this.warned.has(def.name)) {
			this.warned.add(def.name);
			console.warn(`Phaser AE: post effect '${def.name}' has no GLSL port — skipped on the WebGL fallback.`);
		}
		const data = /* @__PURE__ */ new Float32Array(12);
		const defaults = effectDefaults(def);
		Object.keys(def.params ?? {}).forEach((k, i) => {
			data[4 + i] = params?.[k] ?? defaults[i];
		});
		const handle = new PostHandle(def, data, this);
		this.handles.push(handle);
		return handle;
	}
	drop(handle) {
		this.handles = this.handles.filter((h) => h !== handle);
	}
	clear() {
		this.handles.length = 0;
	}
	/** Bind + size the offscreen scene FBO the world should render into this
	*  frame (colour + DEPTH_COMPONENT24; sizes track the canvas). The renderer
	*  sets viewport/clear itself, exactly as it does on the default framebuffer. */
	sceneTarget(w, h) {
		const gl = this.gl;
		if (!this.targets || this.width !== w || this.height !== h) {
			this.destroyTargets();
			this.width = w;
			this.height = h;
			const make = (withDepth) => {
				const tex = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, tex);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
				const fbo = gl.createFramebuffer();
				gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
				gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
				if (withDepth) {
					this.depth = gl.createTexture();
					gl.bindTexture(gl.TEXTURE_2D, this.depth);
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT24, w, h, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
					gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
					gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, this.depth, 0);
				}
				return {
					fbo,
					tex
				};
			};
			this.targets = [make(true), make(false)];
		}
		gl.bindFramebuffer(gl.FRAMEBUFFER, this.targets[0].fbo);
	}
	/** The scene FBO + its sampleable depth texture (valid after sceneTarget).
	*  Depth CANNOT be sampled while this FBO is bound — consumers blit a copy
	*  first (the world's depth-effect passes own that dance). */
	get scene() {
		return this.targets && this.depth ? {
			fbo: this.targets[0].fbo,
			depthTex: this.depth,
			width: this.width,
			height: this.height
		} : null;
	}
	/** The no-post path when the scene still rendered offscreen (a world using
	*  the depth-texture seam): present the scene colour onto the canvas. NOT a
	*  blitFramebuffer — the canvas backbuffer is MULTISAMPLED (antialias: true)
	*  and single→multisample blits are INVALID_OPERATION; a fullscreen copy
	*  draw through the effect template keeps orientation identical to a real
	*  post pass landing on the canvas. */
	blitToCanvas() {
		const gl = this.gl;
		if (!this.targets) return;
		const ep = this.programFor({
			name: "__present",
			code: "",
			params: {}
		});
		if (!ep.program) return;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, this.width, this.height);
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(false);
		gl.disable(gl.BLEND);
		gl.bindVertexArray(null);
		gl.useProgram(ep.program);
		gl.uniform4f(ep.uRes, this.width, this.height, 0, 0);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, this.targets[0].tex);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	}
	/** Run every runnable pass, ping-ponging between the two colour targets; the
	*  last one lands on the default framebuffer (the canvas). */
	run(time) {
		const gl = this.gl;
		if (!this.targets) return;
		const passes = this.handles.filter((h) => this.runnable(h.def));
		if (passes.length === 0) return;
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(false);
		gl.disable(gl.BLEND);
		gl.bindVertexArray(null);
		gl.activeTexture(gl.TEXTURE0);
		gl.viewport(0, 0, this.width, this.height);
		let src = 0;
		passes.forEach((handle, i) => {
			const ep = this.programFor(handle.def);
			if (!ep.program) return;
			const last = i === passes.length - 1;
			gl.bindFramebuffer(gl.FRAMEBUFFER, last ? null : this.targets[1 - src].fbo);
			gl.useProgram(ep.program);
			const d = handle.data;
			gl.uniform4f(ep.uRes, this.width, this.height, time, 0);
			gl.uniform4f(ep.uP0, d[4], d[5], d[6], d[7]);
			gl.uniform4f(ep.uP1, d[8], d[9], d[10], d[11]);
			gl.bindTexture(gl.TEXTURE_2D, this.targets[src].tex);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			src = 1 - src;
		});
	}
	/** (Re)create GL objects — the context-restore recovery path. */
	rebuild(gl) {
		this.gl = gl;
		this.programs.clear();
		this.targets = null;
		this.depth = null;
		this.width = 0;
		this.height = 0;
	}
	programFor(def) {
		let ep = this.programs.get(def.name);
		if (ep) return ep;
		const gl = this.gl;
		const program = compileProgram(gl, POST_VS_GLSL, buildEffectGLSL(def, this.snippetFor(def)), `post '${def.name}'`);
		ep = {
			program,
			uRes: program && gl.getUniformLocation(program, "uRes"),
			uP0: program && gl.getUniformLocation(program, "uP0"),
			uP1: program && gl.getUniformLocation(program, "uP1")
		};
		if (program) {
			gl.useProgram(program);
			gl.uniform1i(gl.getUniformLocation(program, "uSrc"), 0);
		}
		this.programs.set(def.name, ep);
		return ep;
	}
	destroyTargets() {
		const gl = this.gl;
		if (this.targets) {
			for (const t of this.targets) {
				gl.deleteFramebuffer(t.fbo);
				gl.deleteTexture(t.tex);
			}
			this.targets = null;
		}
		if (this.depth) {
			gl.deleteTexture(this.depth);
			this.depth = null;
		}
	}
};
//#endregion
//#region src/lib/webgl/backdrop.ts
var GLSL_BACKDROP_SNIPPETS = {
	/** Vertical two-colour gradient sky with a tunable curve. */
	sky: `
    color = vec4(mix(c0.rgb, c1.rgb, pow(clamp(uv.y, 0.0, 1.0), max(curve, 0.01))), 1.0);`,
	/** Three-layer parallax starfield with twinkle — camera-aware (view.xy). */
	stars: `
    float acc = 0.0;
    for (int l = 0; l < 3; l++) {
      float fl = float(l);
      float cell = 26.0 - fl * 7.0;                       // nearer layers: sparser, bigger
      float par = 0.15 + fl * 0.25;                       // nearer layers drift more
      vec2 p = (px + view.xy * par + vec2(time * drift * (fl + 1.0) * 8.0, 0.0)) / cell;
      vec2 id = floor(p);
      float rnd = hash21(id + fl * 91.7);
      float keep = step(1.0 - 0.12 * density, rnd);       // a fraction of cells hold a star
      vec2 centre = vec2(hash21(id + 3.1), hash21(id + 7.7));
      float d = length(fract(p) - centre);
      float core = smoothstep(0.14 + 0.08 * fl, 0.0, d);
      // Twinkle's OWN hash — rnd spans too little post-threshold (see backdrop.ts).
      float twr = hash21(id + 13.7 + fl * 5.3);
      float tw = 0.9 + 0.1 * sin(time * (0.4 + twr * 1.2) * twinkle + twr * TAU * 7.0);
      float glint = step(0.72, twr) * pow(max(sin(time * (0.5 + twr * 1.3) * twinkle + twr * 47.0), 0.0), 24.0) * 0.7;
      acc += keep * core * (tw + glint) * (0.45 + 0.55 * rnd);
    }
    color = vec4(c0.rgb * acc, acc);`,
	/** Curtains of polar light waving across the upper sky. */
	aurora: `
    vec3 acc = vec3(0.0);
    for (int i = 0; i < 3; i++) {
      float fi = float(i);
      float wave = sin(uv.x * (4.0 + fi * 2.3) + time * speed * (0.35 + fi * 0.2) + fi * 2.1)
                 * (0.08 + 0.04 * fi);
      float band = 0.22 + fi * 0.15 + wave;
      float d = abs(uv.y - band);
      float glow = exp(-d * (26.0 - fi * 6.0)) * (0.8 - fi * 0.2);
      float sway = 0.5 + 0.5 * sin(uv.x * 3.0 - time * speed * 0.5 + fi);
      acc += mix(c0.rgb, c1.rgb, sway) * glow;
    }
    float a = clamp(acc.g * 1.4, 0.0, 1.0) * amount;
    color = vec4(acc * amount, a);`,
	/** Slow fbm nebula clouds between two tints — stack 'stars' over it. */
	nebula: `
    vec2 p = uv * scale + view.xy * 0.0004 + vec2(time * speed, 0.0);
    float n = fbm2(p);
    float m = fbm2(p * 1.8 + n * 2.2);
    float cloud = smoothstep(0.25, 0.85, n * 0.6 + m * 0.5);
    color = vec4(mix(c0.rgb, c1.rgb, m) * cloud + c0.rgb * 0.25, 1.0);`,
	/** Low sun over haze bands — a classic synth sunset. */
	sunset: `
    vec3 grad = mix(c0.rgb, c1.rgb * 0.55, pow(clamp(uv.y, 0.0, 1.0), 1.6));
    float ar = u.res.x / max(u.res.y, 1.0);
    float d = length(vec2((uv.x - 0.5) * ar, uv.y - sunY));
    float sun = smoothstep(sunSize, sunSize * 0.92, d);
    // haze bands slice the lower half of the disc
    float band = step(0.5, fract(uv.y * 70.0 + time * 0.4)) * step(sunY, uv.y);
    sun *= 1.0 - band * 0.85;
    float halo = exp(-d * 5.0) * 0.35;
    color = vec4(grad + c1.rgb * (sun + halo), 1.0);`
};
/** Splice a GLSL snippet into the fullscreen backdrop template — the GLSL
*  mirror of buildBackdropWGSL (headless-testable string assembly). */
function buildBackdropGLSL(def, snippet) {
	const names = Object.keys(def.params ?? {});
	if (names.length > 8) throw new Error(`backdrop '${def.name}': max 8 params`);
	return GLSL_FRAG_HEADER + `
#define TAU 6.28318530718
struct U { vec4 res; vec4 view; vec4 p0; vec4 p1; vec4 c0; vec4 c1; };
uniform vec4 uRes;   // xy = size, z = time, w = has-background flag
uniform vec4 uView;  // world rect: x, y, w, h (parallax)
uniform vec4 uP0;
uniform vec4 uP1;
uniform vec4 uC0;
uniform vec4 uC1;
uniform sampler2D uBg;
in vec2 vUv;
out vec4 outColor;
U u;

float hash21(vec2 p) {
  vec2 q = fract(p * vec2(123.34, 456.21));
  q += dot(q, q + 45.32);
  return fract(q.x * q.y);
}

float noise2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 s = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

float fbm2(vec2 p) {
  float v = 0.0;
  float amp = 0.5;
  vec2 q = p;
  for (int i = 0; i < 4; i++) {
    v += noise2(q) * amp;
    q = q * 2.03 + vec2(17.0, 9.0);
    amp *= 0.5;
  }
  return v;
}

// Sample the background image at a 0..1 coordinate (y DOWN, matching uv — the
// upload keeps row 0 = image top, so no flip). Transparent black when unset.
vec4 bgAt(vec2 p) {
  if (u.res.w < 0.5) { return vec4(0.0, 0.0, 0.0, 0.0); }
  return textureLod(uBg, p, 0.0);
}

void main() {
  u = U(uRes, uView, uP0, uP1, uC0, uC1);
  vec2 uv = vUv;
  vec2 px = uv * u.res.xy;
  float time = u.res.z;
  vec4 view = u.view;
  vec4 c0 = u.c0;
  vec4 c1 = u.c1;
  vec4 bg = bgAt(uv);
${names.map((n, i) => `  float ${n} = u.${i < 4 ? "p0" : "p1"}.${"xyzw"[i % 4]};`).join("\n")}
  vec4 color = vec4(0.0, 0.0, 0.0, 1.0);
  {
${snippet}
  }
  outColor = vec4(color.rgb * color.a, color.a);   // premultiplied out
}
`;
}
/** Fullscreen blit that draws the background image (opaque) beneath the
*  layers — the GLSL twin of BG_BLIT_WGSL. */
var BG_BLIT_FS_GLSL = GLSL_FRAG_HEADER + `
uniform sampler2D uBg;
in vec2 vUv;
out vec4 outColor;
void main() {
  outColor = vec4(textureLod(uBg, vUv, 0.0).rgb, 1.0);
}
`;
var GlBackdropChain = class {
	gl;
	handles = [];
	programs = /* @__PURE__ */ new Map();
	warned = /* @__PURE__ */ new Set();
	warnedGpuTex = false;
	bgProgram;
	bgTex = null;
	defaultTex = null;
	hasBg = false;
	bgSource = null;
	constructor(gl) {
		this.gl = gl;
	}
	/** A layer draws only when its name has a GLSL port. */
	runnable(def) {
		return (GLSL_BACKDROP_SNIPPETS[def.name] ?? def.glsl) !== void 0;
	}
	/** Anything to draw? True when a drawable layer or a background exists. */
	get active() {
		return this.hasBg || this.handles.some((h) => this.runnable(h.def));
	}
	/**
	* Set (or clear, with null) the background image the backdrops render OVER.
	* Canvas / image / bitmap sources upload to a texture (straight alpha — the
	* same recipe as the original's textureFromCanvas); GPUTexture sources are
	* WebGPU-only and are ignored with one warn.
	*/
	setBackground(source) {
		if (source && typeof GPUTexture !== "undefined" && source instanceof GPUTexture) {
			if (!this.warnedGpuTex) {
				this.warnedGpuTex = true;
				console.warn("Phaser AE: GPUTexture backdrop backgrounds are WebGPU-only — ignored on the WebGL fallback.");
			}
			return;
		}
		const gl = this.gl;
		if (this.bgTex) gl.deleteTexture(this.bgTex);
		this.bgTex = null;
		this.bgSource = source ?? null;
		this.hasBg = !!this.bgSource;
		if (this.bgSource) this.bgTex = textureFromSource(gl, this.bgSource);
	}
	/** Append a layer (built-in name or a custom BackdropDef — the block path). */
	add(backdrop, params) {
		const def = typeof backdrop === "string" ? BACKDROPS[backdrop] ?? BACKDROP_PACK[backdrop] : backdrop;
		if (!def) throw new Error(`Unknown backdrop '${String(backdrop)}'`);
		if (!this.runnable(def) && !this.warned.has(def.name)) {
			this.warned.add(def.name);
			console.warn(`Phaser AE: backdrop '${def.name}' has no GLSL twin (BackdropDef.glsl) — skipped on the WebGL fallback.`);
		}
		const data = /* @__PURE__ */ new Float32Array(24);
		const defaults = effectDefaults(def);
		Object.keys(def.params ?? {}).forEach((k, i) => {
			data[8 + i] = params?.[k] ?? defaults[i];
		});
		const colors = Object.values(def.colors ?? {});
		data.set(rgba(colors[0] ?? "#ffffff"), 16);
		data.set(rgba(colors[1] ?? "#ffffff"), 20);
		const handle = new BackdropHandle(def, data, this);
		this.handles.push(handle);
		return handle;
	}
	drop(handle) {
		this.handles = this.handles.filter((h) => h !== handle);
	}
	clear() {
		this.handles.length = 0;
	}
	/** @internal Per-frame uniform data (same packing as the original's frame()). */
	frame(w, h, time, view) {
		for (const handle of this.handles) {
			const d = handle.data;
			d[0] = w;
			d[1] = h;
			d[2] = time;
			d[3] = this.hasBg ? 1 : 0;
			d[4] = view.x;
			d[5] = view.y;
			d[6] = view.w;
			d[7] = view.h;
		}
	}
	/** @internal Draw the background image (if any) then every layer, first
	*  thing after the clear, into the CURRENT framebuffer (scene FBO or canvas). */
	draw() {
		const gl = this.gl;
		if (!this.active) return;
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(false);
		gl.bindVertexArray(null);
		gl.activeTexture(gl.TEXTURE0);
		if (this.hasBg && this.bgTex) {
			if (this.bgProgram === void 0) {
				this.bgProgram = compileProgram(gl, POST_VS_GLSL, BG_BLIT_FS_GLSL, "backdrop bg-blit");
				if (this.bgProgram) {
					gl.useProgram(this.bgProgram);
					gl.uniform1i(gl.getUniformLocation(this.bgProgram, "uBg"), 0);
				}
			}
			if (this.bgProgram) {
				gl.disable(gl.BLEND);
				gl.useProgram(this.bgProgram);
				gl.bindTexture(gl.TEXTURE_2D, this.bgTex);
				gl.drawArrays(gl.TRIANGLES, 0, 3);
			}
		}
		for (const handle of this.handles) {
			if (!this.runnable(handle.def)) continue;
			const lp = this.programFor(handle.def);
			if (!lp.program) continue;
			gl.enable(gl.BLEND);
			gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
			gl.useProgram(lp.program);
			const d = handle.data;
			gl.uniform4f(lp.uRes, d[0], d[1], d[2], d[3]);
			gl.uniform4f(lp.uView, d[4], d[5], d[6], d[7]);
			gl.uniform4f(lp.uP0, d[8], d[9], d[10], d[11]);
			gl.uniform4f(lp.uP1, d[12], d[13], d[14], d[15]);
			gl.uniform4f(lp.uC0, d[16], d[17], d[18], d[19]);
			gl.uniform4f(lp.uC1, d[20], d[21], d[22], d[23]);
			gl.bindTexture(gl.TEXTURE_2D, this.bgTex ?? this.ensureDefaultTex());
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		}
	}
	/** (Re)create GL objects — the context-restore recovery path. */
	rebuild(gl) {
		this.gl = gl;
		this.programs.clear();
		this.bgProgram = void 0;
		this.defaultTex = null;
		this.bgTex = null;
		if (this.bgSource) this.bgTex = textureFromSource(gl, this.bgSource);
		this.hasBg = !!this.bgSource;
	}
	programFor(def) {
		let lp = this.programs.get(def.name);
		if (lp) return lp;
		const gl = this.gl;
		const program = compileProgram(gl, POST_VS_GLSL, buildBackdropGLSL(def, GLSL_BACKDROP_SNIPPETS[def.name] ?? def.glsl), `backdrop '${def.name}'`);
		lp = {
			program,
			uRes: program && gl.getUniformLocation(program, "uRes"),
			uView: program && gl.getUniformLocation(program, "uView"),
			uP0: program && gl.getUniformLocation(program, "uP0"),
			uP1: program && gl.getUniformLocation(program, "uP1"),
			uC0: program && gl.getUniformLocation(program, "uC0"),
			uC1: program && gl.getUniformLocation(program, "uC1")
		};
		if (program) {
			gl.useProgram(program);
			gl.uniform1i(gl.getUniformLocation(program, "uBg"), 0);
		}
		this.programs.set(def.name, lp);
		return lp;
	}
	/** 1x1 transparent texture so the uBg sampler is always complete. */
	ensureDefaultTex() {
		if (!this.defaultTex) {
			const gl = this.gl;
			this.defaultTex = gl.createTexture();
			gl.bindTexture(gl.TEXTURE_2D, this.defaultTex);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([
				0,
				0,
				0,
				0
			]));
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
			gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		}
		return this.defaultTex;
	}
};
//#endregion
//#region src/lib/webgl/lights2d.ts
var FLOATS = 16;
var STRIDE_BYTES = FLOATS * 4;
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
/** Light-triangle vertex shader — the GLSL port of lights2d.ts's `vs`. */
var buildLightVertGLSL = () => GLSL_HEADER + `
layout(location=0) in vec4 iTri;     // ax, ay, bx, by
layout(location=1) in vec4 iTriC;    // cx, cy, lightX, lightY
layout(location=2) in vec4 iParams;  // radius, intensity, coneCos, coneDir
layout(location=3) in vec4 iColor;   // r, g, b, falloffPow
uniform vec4 uView;                  // world rect mapped to the canvas: x, y, w, h
out vec2 vWorld;
out vec2 vLight;
out vec4 vParams;
out vec4 vColor;
void main() {
  vec2 p = iTriC.xy;                      // vertex 2 = the light centre
  if (gl_VertexID == 0) { p = iTri.xy; }  // vertex 0 = A
  else if (gl_VertexID == 1) { p = iTri.zw; } // vertex 1 = B
  vec2 ndc = (p - uView.xy) / uView.zw * 2.0 - 1.0;
  gl_Position = vec4(ndc.x, -ndc.y, 0.0, 1.0);
  vWorld = p;
  vLight = iTriC.zw;
  vParams = iParams;
  vColor = iColor;
}
`;
/** Light-triangle fragment shader — per-pixel falloff + spot cone. */
var buildLightFragGLSL = () => GLSL_FRAG_HEADER + `
in vec2 vWorld;
in vec2 vLight;
in vec4 vParams;
in vec4 vColor;
out vec4 outColor;
void main() {
  float dist = distance(vWorld, vLight);
  float radius = vParams.x;
  float atten = clamp(1.0 - dist / radius, 0.0, 1.0);
  atten = pow(atten, max(vColor.w, 0.25));
  float coneCos = vParams.z;
  if (coneCos > -1.5) {                   // spot: fade outside the cone
    float da = atan(vWorld.y - vLight.y, vWorld.x - vLight.x) - vParams.w;
    float cd = cos(da);
    atten = atten * smoothstep(coneCos, mix(coneCos, 1.0, 0.15), cd);
  }
  float b = atten * vParams.y;
  outColor = vec4(vColor.rgb * b, b);     // premultiplied — additive one/one
}
`;
/** Ambient fullscreen-triangle vertex shader. */
var buildAmbientVertGLSL = () => GLSL_HEADER + `
void main() {
  vec2 p = vec2(-1.0, -1.0);
  if (gl_VertexID == 1) { p = vec2(3.0, -1.0); }
  else if (gl_VertexID == 2) { p = vec2(-1.0, 3.0); }
  gl_Position = vec4(p, 0.0, 1.0);
}
`;
/** Ambient fragment — the colour the scene multiplies down to. */
var buildAmbientFragGLSL = () => GLSL_FRAG_HEADER + `
uniform vec4 uColor;
out vec4 outColor;
void main() { outColor = uColor; }
`;
/**
* The 2D light layer — the GL twin of Lights2d. Add occluders + lights,
* mutate them each frame; draw('under'/'over') renders each phase into the
* current framebuffer.
*/
var GlLights2d = class {
	/** Scenery that casts shadows — add rects / segments / polys to it. */
	occluders = new Visibility2d();
	/** The active lights (mutate freely; `point()`/`spot()` append here). */
	lights = [];
	/** Ambient (base) light colour — the scene is multiplied down to this
	*  before the over-lights add (white = no darkening). */
	ambient = [
		1,
		1,
		1
	];
	/** Lights drawn last frame after culling — for HUD/debug. */
	visible = 0;
	/** Of those, how many cast shadows (the expensive ones) — for HUD/debug. */
	visibleShadow = 0;
	data;
	count = 0;
	capacity = 4096;
	time = 0;
	uniformData = /* @__PURE__ */ new Float32Array(4);
	ambientData = /* @__PURE__ */ new Float32Array(4);
	vx = 0;
	vy = 0;
	vw = 0;
	vh = 0;
	underTris = 0;
	gl;
	program = null;
	ambientProgram = null;
	uViewLoc = null;
	uColorLoc = null;
	vao = null;
	instances;
	vbo = null;
	constructor(gl) {
		this.data = new Float32Array(this.capacity * FLOATS);
		this.rebuild(gl);
	}
	/** (Re)create every GL-side object — the context-loss recovery path. */
	rebuild(gl) {
		this.gl = gl;
		this.program = compileProgram(gl, buildLightVertGLSL(), buildLightFragGLSL(), "GlLights2d");
		this.ambientProgram = compileProgram(gl, buildAmbientVertGLSL(), buildAmbientFragGLSL(), "GlLights2d ambient");
		this.uViewLoc = this.program ? gl.getUniformLocation(this.program, "uView") : null;
		this.uColorLoc = this.ambientProgram ? gl.getUniformLocation(this.ambientProgram, "uColor") : null;
		this.instances = new InstanceBuffer(gl);
		this.vao = null;
		this.vbo = null;
	}
	makeLight(type, x, y, opts, radius) {
		const light = {
			type,
			x,
			y,
			radius: opts.radius ?? radius,
			intensity: opts.intensity ?? 1,
			color: opts.color ?? [
				1,
				1,
				1
			],
			falloff: opts.falloff ?? 2,
			dir: opts.dir ?? 0,
			cone: opts.cone ?? (type === "spot" ? .9 : 0),
			flicker: opts.flicker ?? 0,
			flickerSpeed: opts.flickerSpeed ?? 1,
			phase: opts.phase ?? 0,
			layer: opts.layer ?? "over",
			shadows: opts.shadows ?? false,
			softness: opts.softness ?? 6,
			on: true
		};
		this.lights.push(light);
		return light;
	}
	/** Add a point light; returns its handle (mutate to move / recolour it). */
	point(x, y, opts = {}) {
		return this.makeLight("point", x, y, opts, 240);
	}
	/** Add a spot light (a cone). `dir` faces in radians, `cone` is the full angle. */
	spot(x, y, opts = {}) {
		return this.makeLight("spot", x, y, opts, 360);
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
		const o = this.count * FLOATS, d = this.data;
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
		const next = new Float32Array(this.capacity * FLOATS);
		next.set(this.data);
		this.data = next;
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
	/** Bind the 4 instance vec4s at `byteOffset` — the firstInstance emulation
	*  for the 'over' sub-range. Needs the instance VBO bound. */
	bindAttribs(byteOffset) {
		const gl = this.gl;
		for (let i = 0; i < 4; i++) {
			gl.enableVertexAttribArray(i);
			gl.vertexAttribPointer(i, 4, gl.FLOAT, false, STRIDE_BYTES, byteOffset + i * 16);
			gl.vertexAttribDivisor(i, 1);
		}
	}
	/**
	* Draw one compositing PHASE into the current framebuffer. `'under'`
	* (called before the sprite batches) builds + uploads the whole frame and
	* draws the floor lights; `'over'` (called after the scene) multiplies the
	* scene to the ambient colour then draws the lights that cover the sprites.
	*/
	draw(_pass, phase = "under") {
		const gl = this.gl;
		if (!this.program) return;
		if (phase === "under") {
			this.buildAll();
			if (this.count > 0) this.vbo = this.instances.upload(this.data, this.count * FLOATS);
		} else this.drawAmbient();
		const first = phase === "under" ? 0 : this.underTris;
		const num = phase === "under" ? this.underTris : this.count - this.underTris;
		if (num <= 0 || !this.vbo) return;
		gl.useProgram(this.program);
		gl.uniform4fv(this.uViewLoc, this.uniformData);
		if (!this.vao) this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
		this.bindAttribs(first * STRIDE_BYTES);
		gl.enable(gl.BLEND);
		gl.blendFunc(gl.ONE, gl.ONE);
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(false);
		gl.drawArraysInstanced(gl.TRIANGLES, 0, 3, num);
		gl.bindVertexArray(null);
	}
	/** @internal Multiply the scene down to the ambient colour (skipped when the
	*  ambient is white — no darkening). */
	drawAmbient() {
		const gl = this.gl;
		if (!this.ambientProgram) return;
		const [r, g, b] = this.ambient;
		if (r >= .999 && g >= .999 && b >= .999) return;
		this.ambientData[0] = r;
		this.ambientData[1] = g;
		this.ambientData[2] = b;
		this.ambientData[3] = 1;
		gl.useProgram(this.ambientProgram);
		gl.uniform4fv(this.uColorLoc, this.ambientData);
		if (!this.vao) this.vao = gl.createVertexArray();
		gl.bindVertexArray(this.vao);
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.DST_COLOR, gl.ZERO, gl.ZERO, gl.ONE);
		gl.disable(gl.DEPTH_TEST);
		gl.depthMask(false);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.bindVertexArray(null);
	}
};
//#endregion
//#region src/lib/webgl/renderer.ts
var GlRenderer = class GlRenderer {
	ctx;
	cutoutBatch;
	blendBatch;
	addBatch;
	hudBatch;
	/** `d.text()` glyphs — world and screen. Flushed in the TEXT slot, over panels. */
	textBatch;
	hudTextBatch;
	triBatch;
	msdf;
	/** The screen-space text pass (`game.hud`'s msdfText / unicodeText). */
	msdfHud;
	/** The UI panel passes — world space and screen space (see ui.ts). */
	ui;
	uiHud;
	fxBatch;
	gridBatch;
	vector;
	glowPass;
	postChain;
	backdrops;
	/** Submission order per surface — quads and scene text interleaved. Owned by
	*  Game (it drives begin()); the renderer only reads them at draw time. */
	sceneOrder = new DrawOrder();
	hudOrder = new DrawOrder();
	lights = null;
	atlasTexture = null;
	world = null;
	/** The verbatim twin of Game.walkSurface — replay one surface's 2D content in
	*  the order the game drew it, one layer at a time. See there for why. */
	walkSurface(order, srcs) {
		for (let n = 0; n <= order.maxLayer; n++) for (const seg of order.segs) {
			if (seg.layer !== n) continue;
			srcs[seg.src]?.drawRange(void 0, seg.first, seg.n);
		}
	}
	constructor(ctx, opts) {
		this.ctx = ctx;
		const gl = ctx.gl;
		const blocky = opts.pixelArt === true;
		this.cutoutBatch = new GlQuadBatch(gl, {
			cutout: true,
			blocky
		});
		this.blendBatch = new GlQuadBatch(gl, {
			cutout: false,
			blocky
		});
		this.addBatch = new GlQuadBatch(gl, {
			cutout: false,
			blend: "add",
			blocky
		});
		this.hudBatch = new GlQuadBatch(gl, {
			cutout: false,
			depthTest: false,
			capacity: 4096,
			blocky
		});
		this.textBatch = new GlQuadBatch(gl, {
			cutout: false,
			depthTest: false,
			blocky
		});
		this.hudTextBatch = new GlQuadBatch(gl, {
			cutout: false,
			depthTest: false,
			capacity: 4096,
			blocky
		});
		this.triBatch = new GlTriBatch(gl);
		this.msdf = new GlMsdfRenderer(gl);
		this.msdfHud = new GlMsdfRenderer(gl);
		this.ui = new GlUiRenderer(gl);
		this.uiHud = new GlUiRenderer(gl);
		this.fxBatch = new GlFxBatch(gl, { filter: blocky ? "nearest" : "linear" });
		this.gridBatch = new GlGridBatch(gl, { blocky });
		this.vector = new GlVectorLayer(gl);
		this.glowPass = new GlGlowPass(gl);
		this.postChain = new GlPostChain(gl);
		this.backdrops = new GlBackdropChain(gl);
		this.blendBatch.joinOrder(this.sceneOrder, 0);
		this.cutoutBatch.joinOrder(this.sceneOrder, 4);
		this.addBatch.joinOrder(this.sceneOrder, 5);
		this.triBatch.joinOrder(this.sceneOrder);
		this.gridBatch.joinOrder(this.sceneOrder);
		this.fxBatch.joinOrder(this.sceneOrder);
		ctx.onRebuild((newGl) => {
			this.cutoutBatch.rebuild(newGl);
			this.blendBatch.rebuild(newGl);
			this.addBatch.rebuild(newGl);
			this.hudBatch.rebuild(newGl);
			this.textBatch.rebuild(newGl);
			this.hudTextBatch.rebuild(newGl);
			this.triBatch.rebuild(newGl);
			this.msdf.rebuild(newGl);
			this.msdfHud.rebuild(newGl);
			this.ui.rebuild(newGl);
			this.uiHud.rebuild(newGl);
			this.fxBatch.rebuild(newGl);
			this.gridBatch.rebuild(newGl);
			this.vector.rebuild(newGl);
			this.glowPass.rebuild(newGl);
			this.postChain.rebuild(newGl);
			this.backdrops.rebuild(newGl);
			this.lights?.rebuild(newGl);
			this.atlasTexture = null;
		});
	}
	/** Acquire a WebGL2 context and stand the backend up. Null where absent. */
	static async init(canvas, opts = {}) {
		const ctx = GlContext.init(canvas, {
			dprCap: opts.dprCap,
			onError: opts.onError
		});
		if (!ctx) return null;
		return new GlRenderer(ctx, opts);
	}
	get gl() {
		return this.ctx.gl;
	}
	fit() {
		return this.ctx.fit();
	}
	get dead() {
		return this.ctx.dead;
	}
	markDirty() {
		this.ctx.markDirty();
	}
	onRebuild(fn) {
		return this.ctx.onRebuild(fn);
	}
	/** The 2D lights layer, created on first access (mirrors Game.lights2d). */
	createLights2d() {
		this.lights ??= new GlLights2d(this.gl);
		return this.lights;
	}
	/** The GL 3D world, once game.world3d() has built one — lets the frame and
	*  atlas uploads reach it. */
	attachWorld(world) {
		this.world = world;
		if (world && this.atlasTexture) world.setTexture(this.atlasTexture);
	}
	/** Upload the packed atlas canvas and point every twin at it. */
	uploadAtlas(canvas) {
		const gl = this.gl;
		if (this.atlasTexture) gl.deleteTexture(this.atlasTexture);
		this.atlasTexture = textureFromSource(gl, canvas);
		this.cutoutBatch.setTexture(this.atlasTexture);
		this.blendBatch.setTexture(this.atlasTexture);
		this.addBatch.setTexture(this.atlasTexture);
		this.hudBatch.setTexture(this.atlasTexture);
		this.textBatch.setTexture(this.atlasTexture);
		this.hudTextBatch.setTexture(this.atlasTexture);
		this.fxBatch.setTexture(this.atlasTexture);
		this.gridBatch.setTexture(this.atlasTexture);
		this.glowPass.setTexture(this.atlasTexture);
		this.world?.setTexture(this.atlasTexture);
	}
	/** Upload an MSDF font atlas (no premultiply, linear — see msdf-font.ts). */
	msdfTexture(source) {
		return textureFromSource(this.gl, source, {
			premultiply: false,
			filter: "linear"
		});
	}
	/** Upload a rasterized UnicodeText block (PREMULTIPLIED — the text pass blends premultiplied). */
	textTexture(source) {
		return textureFromSource(this.gl, source, {
			premultiply: true,
			filter: "linear"
		});
	}
	/** Release a texture handed out by `textTexture` (a re-rasterized block). */
	deleteTexture(tex) {
		this.gl.deleteTexture(tex);
	}
	/** Render one complete frame — the GL twin of the WebGPU encoder tail. */
	renderFrame(opts) {
		const gl = this.gl;
		const { width, height } = opts;
		const [r, g, b, a] = opts.bg;
		if (this.vector.glowSize > 0) this.glowPass.wake(this.vector.glowSize);
		this.vector.prepare();
		if (this.glowPass.active) this.glowPass.render(width, height, () => this.vector.stampGlow(Math.max(1, width >> 1), Math.max(1, height >> 1)));
		const post = this.postChain.active;
		const hudInScene = !post || !opts.hudAboveFx;
		const offscreen = post || (opts.world?.needsDepthTexture ?? false);
		if (offscreen) this.postChain.sceneTarget(width, height);
		else gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, width, height);
		gl.disable(gl.SCISSOR_TEST);
		gl.disable(gl.CULL_FACE);
		gl.depthMask(true);
		gl.clearColor(r * a, g * a, b * a, a);
		gl.clearDepth(1);
		gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
		if (this.backdrops.active) this.backdrops.draw();
		if (opts.world) {
			opts.world.render(width, height, offscreen ? this.postChain.scene : null);
			gl.disable(gl.CULL_FACE);
			gl.depthMask(true);
			gl.clear(gl.DEPTH_BUFFER_BIT);
		}
		this.glowPass.composite();
		this.lights?.draw(void 0, "under");
		this.walkSurface(this.sceneOrder, [
			this.blendBatch,
			this.msdf,
			this.ui,
			this.textBatch,
			this.cutoutBatch,
			this.addBatch,
			this.triBatch,
			this.gridBatch,
			this.fxBatch
		]);
		this.vector.draw(width, height);
		this.lights?.draw(void 0, "over");
		if (hudInScene) this.walkSurface(this.hudOrder, [
			this.hudBatch,
			this.msdfHud,
			this.uiHud,
			this.hudTextBatch,
			this.hudBatch,
			this.hudBatch,
			null,
			null,
			null
		]);
		if (post) {
			this.postChain.run(opts.time);
			if (!hudInScene) this.walkSurface(this.hudOrder, [
				this.hudBatch,
				this.msdfHud,
				this.uiHud,
				this.hudTextBatch,
				this.hudBatch,
				this.hudBatch,
				null,
				null,
				null
			]);
		} else if (offscreen) this.postChain.blitToCanvas();
	}
	destroy() {
		this.ctx.destroy();
	}
};
//#endregion
export { BG_BLIT_FS_GLSL, GLSL_BACKDROP_SNIPPETS, GLSL_EFFECT_SNIPPETS, GLSL_FRAG_HEADER, GLSL_HEADER, GlBackdropChain, GlContext, GlFxBatch, GlGlowPass, GlGridBatch, GlLights2d, GlMsdfRenderer, GlPostChain, GlQuadBatch, GlRenderer, GlTriBatch, GlVectorLayer, InstanceBuffer, POST_VS_GLSL, buildAmbientFragGLSL, buildAmbientVertGLSL, buildBackdropGLSL, buildEffectGLSL, buildFillFragGLSL, buildFillVertGLSL, buildFullscreenVertGLSL, buildFxFragGLSL, buildFxVertGLSL, buildGlowBlurFragGLSL, buildGlowCompositeFragGLSL, buildGlowStampFragGLSL, buildGlowStampVertGLSL, buildGridFragGLSL, buildGridVertGLSL, buildLightFragGLSL, buildLightVertGLSL, buildLineFragGLSL, buildLineVertGLSL, buildMsdfFragGLSL, buildMsdfVertGLSL, buildQuadFragGLSL, buildQuadVertGLSL, buildTriFragGLSL, buildTriVertGLSL, compileProgram, instanceVec4Attribs, textureFromSource };

//# sourceMappingURL=webgl-core.js.map
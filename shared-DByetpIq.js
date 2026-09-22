//#region src/lib/webgl/shaders.ts
/** Prefix for every shader in the backend (version + float precision). */
var GLSL_HEADER = "#version 300 es\n";
var GLSL_FRAG_HEADER = "#version 300 es\nprecision highp float;\nprecision highp int;\n";
/**
* Compile + link a program, logging info logs on failure (with numbered source
* for shader errors — GLSL error lines are useless without it). Returns null on
* failure so callers can no-op draw instead of throwing mid-frame.
*/
function compileProgram(gl, vsSource, fsSource, label) {
	const compile = (type, src, kind) => {
		const sh = gl.createShader(type);
		if (!sh) return null;
		gl.shaderSource(sh, src);
		gl.compileShader(sh);
		if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS) && !gl.isContextLost()) {
			const log = gl.getShaderInfoLog(sh) ?? "unknown error";
			const numbered = src.split("\n").map((l, i) => `${i + 1}: ${l}`).join("\n");
			console.error(`${label} ${kind} GLSL error:\n${log}\n${numbered}`);
			gl.deleteShader(sh);
			return null;
		}
		return sh;
	};
	const vs = compile(gl.VERTEX_SHADER, vsSource, "vertex");
	const fs = compile(gl.FRAGMENT_SHADER, fsSource, "fragment");
	if (!vs || !fs) return null;
	const prog = gl.createProgram();
	if (!prog) return null;
	gl.attachShader(prog, vs);
	gl.attachShader(prog, fs);
	gl.linkProgram(prog);
	gl.deleteShader(vs);
	gl.deleteShader(fs);
	if (!gl.getProgramParameter(prog, gl.LINK_STATUS) && !gl.isContextLost()) {
		console.error(`${label} GLSL link error: ${gl.getProgramInfoLog(prog) ?? "unknown"}`);
		gl.deleteProgram(prog);
		return null;
	}
	return prog;
}
/**
* Declare `count` consecutive vec4 instance attributes starting at `firstLoc`,
* all reading from the currently bound interleaved instance VBO (stride =
* count*16 bytes). The universal storage-buffer → instanced-attribute mapping.
*/
function instanceVec4Attribs(gl, firstLoc, count, byteOffset = 0) {
	const stride = count * 16;
	for (let i = 0; i < count; i++) {
		const loc = firstLoc + i;
		gl.enableVertexAttribArray(loc);
		gl.vertexAttribPointer(loc, 4, gl.FLOAT, false, stride, byteOffset + i * 16);
		gl.vertexAttribDivisor(loc, 1);
	}
}
/** Upload an image/canvas source to a straight-alpha RGBA texture (the twin of
*  atlas.ts textureFromCanvas — same no-premultiply recipe). */
function textureFromSource(gl, source, opts = {}) {
	const tex = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D, tex);
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, opts.premultiply ?? false);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.pixelStorei(gl.UNPACK_COLORSPACE_CONVERSION_WEBGL, gl.NONE);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
	const f = opts.filter === "nearest" ? gl.NEAREST : gl.LINEAR;
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, f);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, f);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
	return tex;
}
/** A grow-on-demand instance VBO: upload `count*floatsPer` floats per frame. */
var InstanceBuffer = class {
	gl;
	vbo = null;
	byteCapacity = 0;
	constructor(gl) {
		this.gl = gl;
	}
	/** Bind + (re)upload the live prefix of `data`. Returns the bound VBO. */
	upload(data, floatCount) {
		const gl = this.gl;
		if (!this.vbo) {
			this.vbo = gl.createBuffer();
			this.byteCapacity = 0;
		}
		gl.bindBuffer(gl.ARRAY_BUFFER, this.vbo);
		const bytes = data.byteLength;
		if (bytes > this.byteCapacity) {
			gl.bufferData(gl.ARRAY_BUFFER, data.byteLength, gl.DYNAMIC_DRAW);
			this.byteCapacity = bytes;
		}
		gl.bufferSubData(gl.ARRAY_BUFFER, 0, data, 0, floatCount);
		return this.vbo;
	}
	/** Drop the VBO handle (context restore recreates lazily). */
	reset(gl) {
		this.gl = gl;
		this.vbo = null;
		this.byteCapacity = 0;
	}
};
//#endregion
export { instanceVec4Attribs as a, compileProgram as i, GLSL_HEADER as n, textureFromSource as o, InstanceBuffer as r, GLSL_FRAG_HEADER as t };

//# sourceMappingURL=shared-DByetpIq.js.map
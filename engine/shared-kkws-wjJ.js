import { n as rgba, o as Z_RANGE, r as DEPTH_FORMAT, s as BITS, u as shaderModule } from "./shared-DhV4JtEZ.js";
//#region \0rolldown/runtime.js
var __defProp = Object.defineProperty;
var __exportAll = (all, no_symbols) => {
	let target = {};
	for (var name in all) __defProp(target, name, {
		get: all[name],
		enumerable: true
	});
	if (!no_symbols) __defProp(target, Symbol.toStringTag, { value: "Module" });
	return target;
};
//#endregion
//#region src/lib/atlas.ts
/**
* Pure shelf-packing: place `cells` (in order) into rows that wrap at `maxW`.
* Returns each cell's position plus the finished sheet size. Exported for
* headless tests; Atlas.build() drives it.
*/
function packShelves(cells, maxW = 1024, pad = 2) {
	const boxes = [];
	let x = pad, y = pad, rowH = 0, width = 0;
	for (const c of cells) {
		if (x + c.w + pad > maxW && x > pad) {
			x = pad;
			y += rowH + pad;
			rowH = 0;
		}
		boxes.push({
			x,
			y
		});
		x += c.w + pad;
		rowH = Math.max(rowH, c.h);
		width = Math.max(width, x);
	}
	return {
		boxes,
		width: Math.max(width, pad * 2 + 1),
		height: y + rowH + pad
	};
}
/**
* The engine's frame store. `add()` canvases (a horizontal strip slices into
* frames via `frameW`) and get back the first frame's index; `build()` packs
* everything into one canvas + UV table. Frame 0 is always a built-in white
* square — the tintable solid, and the texture the shape verbs ride on.
*/
var Atlas = class {
	maxW;
	pad;
	cells = [];
	/** True when frames were added since the last build() — build() repacks. */
	dirty = true;
	/**
	* Monotonic build counter — bumped on every build(). The GPU owner uploads
	* whenever this differs from what it last uploaded, so a repack that clears
	* `dirty` WITHOUT going through the owner (e.g. frameSize() calling build()
	* to measure) can't leave the uploaded texture stale against the new UVs.
	*/
	generation = 0;
	frames = [];
	canvas = null;
	constructor(maxW = 1024, pad = 2) {
		this.maxW = maxW;
		this.pad = pad;
	}
	/** Register a canvas (or strip of square-ish frames). Returns the first frame index. */
	add(src, frameW) {
		const first = this.cells.length + 1;
		const fw = frameW ?? src.width;
		for (let sx = 0; sx + 1 <= src.width; sx += fw) this.cells.push({
			src,
			sx,
			w: Math.min(fw, src.width - sx),
			h: src.height
		});
		this.dirty = true;
		return first;
	}
	/** Number of frames a strip of width `srcW` sliced at `frameW` yields. */
	static count(srcW, frameW) {
		return Math.max(1, Math.ceil(srcW / frameW));
	}
	/** Pack all cells (plus the white frame 0) into one canvas + UV table. */
	build() {
		const WHITE = 4;
		const packed = packShelves([{
			w: WHITE,
			h: WHITE
		}, ...this.cells.map((c) => ({
			w: c.w,
			h: c.h
		}))], this.maxW, this.pad);
		const canvas = document.createElement("canvas");
		canvas.width = packed.width;
		canvas.height = packed.height;
		const ctx = canvas.getContext("2d");
		ctx.imageSmoothingEnabled = false;
		const hu = .5 / canvas.width, hv = .5 / canvas.height;
		const frames = [];
		const place = (x, y, w, h) => {
			frames.push({
				u0: x / canvas.width + hu,
				v0: y / canvas.height + hv,
				u1: (x + w) / canvas.width - hu,
				v1: (y + h) / canvas.height - hv,
				w,
				h
			});
		};
		ctx.fillStyle = "#fff";
		ctx.fillRect(packed.boxes[0].x, packed.boxes[0].y, WHITE, WHITE);
		place(packed.boxes[0].x, packed.boxes[0].y, WHITE, WHITE);
		this.cells.forEach((c, i) => {
			const b = packed.boxes[i + 1];
			ctx.drawImage(c.src, c.sx, 0, c.w, c.h, b.x, b.y, c.w, c.h);
			place(b.x, b.y, c.w, c.h);
		});
		this.canvas = canvas;
		this.frames = frames;
		this.dirty = false;
		this.generation++;
		return {
			canvas,
			frames
		};
	}
};
/**
* Upload an image source (canvas, image, or bitmap) to a sampleable rgba8unorm
* texture. `premultiply` asks the copy to premultiply RGB by alpha — set it for
* anything a PREMULTIPLIED-blend shader samples directly (rasterized text
* blocks); leave it off for the atlas, whose batches do the multiply themselves.
*/
function textureFromCanvas(device, source, premultiply = false) {
	const texture = device.createTexture({
		size: {
			width: source.width,
			height: source.height
		},
		format: "rgba8unorm",
		usage: 22
	});
	device.queue.copyExternalImageToTexture({ source }, {
		texture,
		premultipliedAlpha: premultiply
	}, {
		width: source.width,
		height: source.height
	});
	return texture;
}
/**
* Rasterize a text string to a canvas once — register it as a frame and it
* batches like any sprite. (Interim text path: the bitmap-font atlas + HUD
* pass land in a later milestone.)
*/
function rasterText(text, opts) {
	const font = opts?.font ?? "bold 28px monospace";
	const color = opts?.color ?? "#ffffff";
	const pad = opts?.pad ?? 2;
	const c = document.createElement("canvas");
	const ctx = c.getContext("2d");
	ctx.font = font;
	const m = ctx.measureText(text);
	c.width = Math.ceil(m.width) + pad * 2;
	c.height = Math.ceil((m.actualBoundingBoxAscent || 20) + (m.actualBoundingBoxDescent || 8)) + pad * 2;
	ctx.font = font;
	ctx.fillStyle = color;
	ctx.textBaseline = "top";
	ctx.fillText(text, pad, pad);
	return c;
}
//#endregion
//#region src/lib/vecfont.ts
var G = {
	" ": [],
	A: [[
		0,
		1,
		.5,
		0,
		1,
		1
	], [
		.2,
		.6,
		.8,
		.6
	]],
	B: [
		[
			0,
			0,
			0,
			1
		],
		[
			0,
			0,
			.75,
			0,
			1,
			.2,
			.75,
			.45,
			0,
			.45
		],
		[
			0,
			.45,
			.8,
			.45,
			1,
			.72,
			.75,
			1,
			0,
			1
		]
	],
	C: [[
		1,
		.2,
		.75,
		0,
		.25,
		0,
		0,
		.2,
		0,
		.8,
		.25,
		1,
		.75,
		1,
		1,
		.8
	]],
	D: [[
		0,
		0,
		.7,
		0,
		1,
		.25,
		1,
		.75,
		.7,
		1,
		0,
		1,
		0,
		0
	]],
	E: [[
		1,
		0,
		0,
		0,
		0,
		1,
		1,
		1
	], [
		0,
		.5,
		.7,
		.5
	]],
	F: [[
		1,
		0,
		0,
		0,
		0,
		1
	], [
		0,
		.5,
		.7,
		.5
	]],
	G: [[
		1,
		.2,
		.75,
		0,
		.25,
		0,
		0,
		.2,
		0,
		.8,
		.25,
		1,
		.75,
		1,
		1,
		.8,
		1,
		.55,
		.6,
		.55
	]],
	H: [
		[
			0,
			0,
			0,
			1
		],
		[
			1,
			0,
			1,
			1
		],
		[
			0,
			.5,
			1,
			.5
		]
	],
	I: [
		[
			.5,
			0,
			.5,
			1
		],
		[
			.2,
			0,
			.8,
			0
		],
		[
			.2,
			1,
			.8,
			1
		]
	],
	J: [[
		.8,
		0,
		.8,
		.78,
		.6,
		1,
		.2,
		1,
		0,
		.78
	]],
	K: [
		[
			0,
			0,
			0,
			1
		],
		[
			1,
			0,
			0,
			.55
		],
		[
			.35,
			.38,
			1,
			1
		]
	],
	L: [[
		0,
		0,
		0,
		1,
		1,
		1
	]],
	M: [[
		0,
		1,
		0,
		0,
		.5,
		.5,
		1,
		0,
		1,
		1
	]],
	N: [[
		0,
		1,
		0,
		0,
		1,
		1,
		1,
		0
	]],
	O: [[
		.25,
		0,
		.75,
		0,
		1,
		.2,
		1,
		.8,
		.75,
		1,
		.25,
		1,
		0,
		.8,
		0,
		.2,
		.25,
		0
	]],
	P: [[
		0,
		1,
		0,
		0,
		.8,
		0,
		1,
		.2,
		.8,
		.5,
		0,
		.5
	]],
	Q: [[
		.25,
		0,
		.75,
		0,
		1,
		.2,
		1,
		.8,
		.75,
		1,
		.25,
		1,
		0,
		.8,
		0,
		.2,
		.25,
		0
	], [
		.6,
		.7,
		1,
		1
	]],
	R: [[
		0,
		1,
		0,
		0,
		.8,
		0,
		1,
		.2,
		.8,
		.5,
		0,
		.5
	], [
		.45,
		.5,
		1,
		1
	]],
	S: [[
		1,
		.15,
		.75,
		0,
		.25,
		0,
		0,
		.2,
		.25,
		.48,
		.75,
		.52,
		1,
		.75,
		.75,
		1,
		.25,
		1,
		0,
		.85
	]],
	T: [[
		0,
		0,
		1,
		0
	], [
		.5,
		0,
		.5,
		1
	]],
	U: [[
		0,
		0,
		0,
		.8,
		.25,
		1,
		.75,
		1,
		1,
		.8,
		1,
		0
	]],
	V: [[
		0,
		0,
		.5,
		1,
		1,
		0
	]],
	W: [[
		0,
		0,
		.2,
		1,
		.5,
		.4,
		.8,
		1,
		1,
		0
	]],
	X: [[
		0,
		0,
		1,
		1
	], [
		1,
		0,
		0,
		1
	]],
	Y: [[
		0,
		0,
		.5,
		.5,
		1,
		0
	], [
		.5,
		.5,
		.5,
		1
	]],
	Z: [[
		0,
		0,
		1,
		0,
		0,
		1,
		1,
		1
	]],
	0: [[
		.25,
		0,
		.75,
		0,
		1,
		.2,
		1,
		.8,
		.75,
		1,
		.25,
		1,
		0,
		.8,
		0,
		.2,
		.25,
		0
	], [
		.15,
		.82,
		.85,
		.18
	]],
	1: [[
		.2,
		.22,
		.5,
		0,
		.5,
		1
	], [
		.2,
		1,
		.8,
		1
	]],
	2: [[
		0,
		.22,
		.25,
		0,
		.75,
		0,
		1,
		.25,
		0,
		1,
		1,
		1
	]],
	3: [[
		0,
		0,
		1,
		0,
		.55,
		.45,
		1,
		.62,
		.85,
		1,
		.15,
		1,
		0,
		.85
	]],
	4: [[
		.72,
		1,
		.72,
		0,
		0,
		.7,
		1,
		.7
	]],
	5: [[
		1,
		0,
		0,
		0,
		0,
		.45,
		.7,
		.45,
		1,
		.65,
		.85,
		1,
		.2,
		1,
		0,
		.9
	]],
	6: [[
		.85,
		.1,
		.5,
		0,
		.2,
		.15,
		0,
		.55,
		0,
		.85,
		.25,
		1,
		.75,
		1,
		1,
		.8,
		.85,
		.52,
		.35,
		.45,
		.05,
		.6
	]],
	7: [[
		0,
		0,
		1,
		0,
		.35,
		1
	]],
	8: [[
		.25,
		0,
		.75,
		0,
		1,
		.2,
		.75,
		.45,
		.25,
		.45,
		0,
		.2,
		.25,
		0
	], [
		.25,
		.45,
		.75,
		.45,
		1,
		.72,
		.75,
		1,
		.25,
		1,
		0,
		.72,
		.25,
		.45
	]],
	9: [[
		.15,
		.9,
		.5,
		1,
		.8,
		.85,
		1,
		.45,
		1,
		.15,
		.75,
		0,
		.25,
		0,
		0,
		.2,
		.15,
		.48,
		.65,
		.55,
		.95,
		.4
	]],
	".": [[
		.42,
		.88,
		.58,
		.88,
		.58,
		1,
		.42,
		1,
		.42,
		.88
	]],
	",": [[
		.58,
		.82,
		.38,
		1
	]],
	":": [[
		.45,
		.3,
		.58,
		.3
	], [
		.45,
		.78,
		.58,
		.78
	]],
	";": [[
		.45,
		.3,
		.58,
		.3
	], [
		.58,
		.78,
		.38,
		1
	]],
	"!": [[
		.5,
		0,
		.5,
		.66
	], [
		.5,
		.88,
		.5,
		1
	]],
	"?": [[
		0,
		.22,
		.25,
		0,
		.75,
		0,
		1,
		.25,
		.5,
		.55,
		.5,
		.68
	], [
		.5,
		.88,
		.5,
		1
	]],
	"'": [[
		.5,
		0,
		.5,
		.26
	]],
	"\"": [[
		.34,
		0,
		.34,
		.26
	], [
		.66,
		0,
		.66,
		.26
	]],
	"-": [[
		.15,
		.5,
		.85,
		.5
	]],
	"_": [[
		0,
		1,
		1,
		1
	]],
	"+": [[
		.15,
		.5,
		.85,
		.5
	], [
		.5,
		.15,
		.5,
		.85
	]],
	"=": [[
		.15,
		.35,
		.85,
		.35
	], [
		.15,
		.65,
		.85,
		.65
	]],
	"*": [
		[
			.5,
			.12,
			.5,
			.88
		],
		[
			.17,
			.3,
			.83,
			.7
		],
		[
			.83,
			.3,
			.17,
			.7
		]
	],
	"/": [[
		0,
		1,
		1,
		0
	]],
	"\\": [[
		0,
		0,
		1,
		1
	]],
	"(": [[
		.7,
		0,
		.3,
		.25,
		.3,
		.75,
		.7,
		1
	]],
	")": [[
		.3,
		0,
		.7,
		.25,
		.7,
		.75,
		.3,
		1
	]],
	"[": [[
		.7,
		0,
		.32,
		0,
		.32,
		1,
		.7,
		1
	]],
	"]": [[
		.3,
		0,
		.68,
		0,
		.68,
		1,
		.3,
		1
	]],
	"<": [[
		.8,
		.12,
		.2,
		.5,
		.8,
		.88
	]],
	">": [[
		.2,
		.12,
		.8,
		.5,
		.2,
		.88
	]],
	"#": [
		[
			.32,
			.08,
			.22,
			.92
		],
		[
			.72,
			.08,
			.62,
			.92
		],
		[
			.1,
			.36,
			.86,
			.36
		],
		[
			.07,
			.64,
			.83,
			.64
		]
	],
	"%": [
		[
			1,
			0,
			0,
			1
		],
		[
			.08,
			.08,
			.32,
			.08,
			.32,
			.32,
			.08,
			.32,
			.08,
			.08
		],
		[
			.68,
			.68,
			.92,
			.68,
			.92,
			.92,
			.68,
			.92,
			.68,
			.68
		]
	]
};
/** Every character the face can draw (space included). */
var VECTOR_CHARSET = Object.keys(G).join("");
/**
* The strokes for one character, in the 0..1 em box. Lowercase folds to
* uppercase — the faces of the era were caps-only and it halves the table.
* An unknown character draws nothing (but still advances the pen).
*/
function glyphOutline(ch) {
	return G[ch] ?? G[ch.toUpperCase()] ?? [];
}
/** Width of one line in world units, for manual layout. */
function textWidth(str, opts = {}) {
	const size = opts.size ?? 24;
	const spacing = opts.spacing ?? .28;
	const n = str.length;
	return n === 0 ? 0 : n * size + (n - 1) * size * spacing;
}
/**
* Lay a string out as POLYLINES in world space — the retained path.
*
* Feed the result to `layer.shape()` and the text becomes a real shape that can
* fly, rotate, restyle and `shatter()`; `layer.text()` is the immediate
* shortcut over the top of it. `\n` starts a new line.
*/
function textOutline(str, x, y, opts = {}) {
	const size = opts.size ?? 24;
	const spacing = opts.spacing ?? .28;
	const lineGap = opts.lineGap ?? 1.6;
	const align = opts.align ?? "left";
	const out = [];
	str.split("\n").forEach((line, row) => {
		const w = textWidth(line, opts);
		const originX = align === "center" ? x - w / 2 : align === "right" ? x - w : x;
		const originY = y + row * size * lineGap;
		let pen = originX;
		for (const ch of line) {
			for (const stroke of glyphOutline(ch)) {
				const pts = [];
				for (let i = 0; i < stroke.length; i += 2) pts.push({
					x: pen + stroke[i] * size,
					y: originY + stroke[i + 1] * size
				});
				if (pts.length > 1) out.push(pts);
			}
			pen += size * (1 + spacing);
		}
	});
	return out;
}
//#endregion
//#region src/lib/colorkit.ts
var colorkit_exports = /* @__PURE__ */ __exportAll({
	gradient: () => gradient,
	hsv: () => hsv,
	lerp: () => lerp,
	rainbow: () => rainbow,
	ramp: () => ramp,
	shift: () => shift,
	wheel: () => wheel
});
var clamp01 = (n) => n < 0 ? 0 : n > 1 ? 1 : n;
var wrap360 = (h) => (h % 360 + 360) % 360;
var byte = (n) => Math.round(clamp01(n) * 255).toString(16).padStart(2, "0");
/**
* Convert an HSV colour to a `'#rrggbb'` hex string. `h` is a hue angle in
* degrees (0/360 = red, 120 = green, 240 = blue; wraps). `s` and `v` are 0→1
* and default to 1. The foundation of every other generator here.
*/
function hsv(h, s = 1, v = 1) {
	h = wrap360(h);
	s = clamp01(s);
	v = clamp01(v);
	const c = v * s;
	const x = c * (1 - Math.abs(h / 60 % 2 - 1));
	const m = v - c;
	let r = 0, g = 0, b = 0;
	if (h < 60) {
		r = c;
		g = x;
	} else if (h < 120) {
		r = x;
		g = c;
	} else if (h < 180) {
		g = c;
		b = x;
	} else if (h < 240) {
		g = x;
		b = c;
	} else if (h < 300) {
		r = x;
		b = c;
	} else {
		r = c;
		b = x;
	}
	return `#${byte(r + m)}${byte(g + m)}${byte(b + m)}`;
}
function parseHex(hex) {
	let s = hex.charAt(0) === "#" ? hex.slice(1) : hex;
	if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
	return [
		parseInt(s.slice(0, 2), 16) / 255,
		parseInt(s.slice(2, 4), 16) / 255,
		parseInt(s.slice(4, 6), 16) / 255
	];
}
function rgbToHsv(r, g, b) {
	const max = Math.max(r, g, b), d = max - Math.min(r, g, b);
	let h = 0;
	if (d !== 0) {
		if (max === r) h = (g - b) / d % 6;
		else if (max === g) h = (b - r) / d + 2;
		else h = (r - g) / d + 4;
		h = wrap360(h * 60);
	}
	return [
		h,
		max === 0 ? 0 : d / max,
		max
	];
}
/**
* Interpolate / blend two hex colours in RGB space. `t` = 0 returns `a`,
* `t` = 1 returns `b`.
*/
function lerp(a, b, t) {
	t = clamp01(t);
	const [ar, ag, ab] = parseHex(a);
	const [br, bg, bb] = parseHex(b);
	return `#${byte(ar + (br - ar) * t)}${byte(ag + (bg - ag) * t)}${byte(ab + (bb - ab) * t)}`;
}
/**
* Rotate a colour's hue by `degrees` around the HSV wheel, preserving its
* saturation and brightness. `shift('#ff0000', 120)` turns red into green.
*/
function shift(hex, degrees) {
	const [r, g, b] = parseHex(hex);
	const [h, s, v] = rgbToHsv(r, g, b);
	return hsv(h + degrees, s, v);
}
/**
* Build a reusable colour wheel at a fixed saturation and value. Sample it
* with `w.hue(210)`, `w.at(0.5)`, `w.colors(8)`.
*/
function wheel(opts = {}) {
	const s = opts.saturation ?? 1;
	const v = opts.value ?? 1;
	return {
		saturation: s,
		value: v,
		hue: (deg) => hsv(deg, s, v),
		at: (t) => hsv(t * 360, s, v),
		colors(count, t0 = 0, t1 = 1) {
			const out = [];
			for (let i = 0; i < count; i++) {
				const t = count <= 1 ? t0 : t0 + (t1 - t0) * (i / (count - 1));
				out.push(hsv(t * 360, s, v));
			}
			return out;
		}
	};
}
/**
* `count` colours evenly spaced around the full HSV wheel. Loops seamlessly
* (first and last are not duplicated).
*/
function rainbow(count, opts = {}) {
	const s = opts.saturation ?? 1;
	const v = opts.value ?? 1;
	const out = [];
	for (let i = 0; i < count; i++) out.push(hsv(i / count * 360, s, v));
	return out;
}
/**
* A hue ramp — `count` colours stepping from `fromHue` to `toHue` (degrees),
* both endpoints inclusive. A slice of the rainbow, close together.
*/
function ramp(fromHue, toHue, count, opts = {}) {
	const s = opts.saturation ?? 1;
	const v = opts.value ?? 1;
	const out = [];
	for (let i = 0; i < count; i++) {
		const t = count <= 1 ? 0 : i / (count - 1);
		out.push(hsv(fromHue + (toHue - fromHue) * t, s, v));
	}
	return out;
}
/**
* A gradient — `count` colours blending smoothly between two arbitrary hex
* colours in RGB space, both endpoints inclusive.
*/
function gradient(from, to, count) {
	const out = [];
	for (let i = 0; i < count; i++) out.push(lerp(from, to, count <= 1 ? 0 : i / (count - 1)));
	return out;
}
//#endregion
//#region src/lib/vecshapes.ts
var TAU = Math.PI * 2;
/**
* How many segments an arc of this sweep needs to read as a curve — one per
* ~11°, minimum 1. Every arc here uses it when `steps` is omitted.
*
* It is purely ANGULAR, so it takes no view of radius: a huge circle gets the
* same 32 segments as a tiny one and reads as faceted, while a narrow ring
* section gets only two. Pass an explicit `steps` in both cases — up for a
* smooth curve at a large radius, down for deliberate chunky chords.
*/
function arcSteps(sweep) {
	return Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 16)));
}
/**
* Points along a circular arc from `from` to `to` radians — the retained path.
*
* ```ts
* const shield = game.vector.shape(
*   vectorKit.arcPoints(0, 0, 120, -0.4, 0.4),
*   { x: cx, y: cy, closed: false, color: '#41d6ff' },
* );
* ```
*
* Returns `steps + 1` points. Build the arc about the ORIGIN and put the centre
* in the shape's `x`/`y` if you want it to rotate — a shape spins about its own
* origin, so an arc built at `(cx, cy)` would orbit instead of turning in place.
*
* `layer.arc()` is the immediate shortcut over the top of this.
*/
function arcPoints(cx, cy, r, from, to, steps) {
	const sweep = to - from;
	const n = Math.max(1, Math.round(steps ?? arcSteps(sweep)));
	const out = [];
	for (let i = 0; i <= n; i++) {
		const a = from + sweep * (i / n);
		out.push({
			x: cx + Math.cos(a) * r,
			y: cy + Math.sin(a) * r
		});
	}
	return out;
}
/**
* Cut a ring into `count` separately drawable sections — Star Castle's shields.
*
* ```ts
* const shields = vectorKit.ringSections(0, 0, 140, 12, { gap: 0.16 })
*   .map((s) => ({ ...s, shape: game.vector.shape(s.points, { x: cx, y: cy, closed: false }) }));
* ```
*
* Each section is its OWN point array, so each becomes its own `VectorShape`
* and can `shatter()` while its neighbours keep turning. Build at the origin
* and carry the centre on the shapes, so the whole ring rotates as one.
*/
function ringSections(cx, cy, r, count, opts = {}) {
	const gap = opts.gap ?? .14;
	const from = opts.from ?? -Math.PI / 2;
	const span = opts.span ?? TAU;
	const n = Math.max(1, Math.round(count));
	const pitch = span / n;
	const arc = Math.max(0, pitch - gap);
	const out = [];
	for (let i = 0; i < n; i++) {
		const a0 = from + i * pitch + gap / 2;
		const a1 = a0 + arc;
		out.push({
			points: arcPoints(cx, cy, r, a0, a1, opts.steps),
			from: a0,
			to: a1,
			index: i
		});
	}
	return out;
}
/**
* Is `(px, py)` ON an arc — within `tol` of the radius AND inside the sweep?
*
* The hit test segmented rings need: a shot only kills the shield section it
* actually crossed. Test in the ring's LOCAL space — subtract the centre and
* rotate the point by `-ring.rot` first, so a spinning ring needs no
* per-section bookkeeping.
*/
function arcHit(cx, cy, r, from, to, px, py, tol = 6) {
	const dx = px - cx, dy = py - cy;
	if (Math.abs(Math.hypot(dx, dy) - r) > tol) return false;
	const sweep = Math.abs(to - from);
	if (sweep >= TAU) return true;
	let a = (Math.atan2(dy, dx) - Math.min(from, to)) % TAU;
	if (a < 0) a += TAU;
	return a <= sweep;
}
/** Unit-space outlines, fitted to roughly -1..1. `circle` is generated
*  analytically instead (an exact ring beats a resampled polygon). */
var PROFILES = {
	square: {
		pts: [
			{
				x: -1,
				y: -1
			},
			{
				x: 1,
				y: -1
			},
			{
				x: 1,
				y: 1
			},
			{
				x: -1,
				y: 1
			}
		],
		closed: true
	},
	plus: {
		pts: [
			{
				x: -.38,
				y: -1
			},
			{
				x: .38,
				y: -1
			},
			{
				x: .38,
				y: -.38
			},
			{
				x: 1,
				y: -.38
			},
			{
				x: 1,
				y: .38
			},
			{
				x: .38,
				y: .38
			},
			{
				x: .38,
				y: 1
			},
			{
				x: -.38,
				y: 1
			},
			{
				x: -.38,
				y: .38
			},
			{
				x: -1,
				y: .38
			},
			{
				x: -1,
				y: -.38
			},
			{
				x: -.38,
				y: -.38
			}
		],
		closed: true
	},
	vee: {
		pts: [
			{
				x: -1,
				y: -.85
			},
			{
				x: 0,
				y: .9
			},
			{
				x: 1,
				y: -.85
			}
		],
		closed: false
	},
	star: {
		pts: Array.from({ length: 10 }, (_, i) => {
			const a = -Math.PI / 2 + i / 10 * TAU;
			const r = i % 2 === 0 ? 1 : .45;
			return {
				x: Math.cos(a) * r,
				y: Math.sin(a) * r
			};
		}),
		closed: true
	}
};
/** Edge lengths of a path (plus the closing edge), and their total. */
function edgeLengths(pts) {
	const len = [];
	let total = 0;
	for (let i = 1; i < pts.length; i++) {
		const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
		len.push(l);
		total += l;
	}
	return {
		len,
		total
	};
}
/**
* Turn a silhouette into `n` lane boundaries, KEEPING EVERY CORNER.
*
* Equal-arc-length sampling is the obvious approach and it is wrong here: with
* 12 lanes on a 12-corner cross, not one sample lands on a corner and the web
* comes out as a rounded blob instead of a plus. Tempest's shapes are crisp,
* and their lane widths vary — that is the authentic trade, and the right one,
* because the silhouette is the whole point of choosing a profile.
*
* So: each edge gets at least one lane, the rest are apportioned by edge length
* (largest remainder), and each edge subdivides evenly within itself. Corners
* therefore always fall on a lane boundary. Below one lane per edge the shape
* cannot survive at all, so that case falls back to equal-arc sampling.
*
* A closed path yields `n` points, an open one `n + 1`.
*/
function sampleProfile(path, closed, n) {
	const pts = closed ? [...path, path[0]] : [...path];
	const { len } = edgeLengths(pts);
	const edges = len.length;
	if (n < edges) return resamplePath(path, closed, n);
	const total = len.reduce((a, b) => a + b, 0);
	const ideal = len.map((l) => total > 0 ? l / total * n : n / edges);
	const count = ideal.map((v) => Math.max(1, Math.floor(v)));
	let used = count.reduce((a, b) => a + b, 0);
	const byFrac = ideal.map((v, i) => ({
		i,
		frac: v - Math.floor(v)
	})).sort((a, b) => b.frac - a.frac);
	for (let k = 0; used < n; k++, used++) count[byFrac[k % edges].i]++;
	while (used > n) {
		let big = 0;
		for (let i = 1; i < edges; i++) if (count[i] > count[big]) big = i;
		if (count[big] <= 1) break;
		count[big]--;
		used--;
	}
	const out = [];
	for (let e = 0; e < edges; e++) {
		const a = pts[e], b = pts[e + 1];
		for (let j = 0; j < count[e]; j++) {
			const f = j / count[e];
			out.push({
				x: a.x + (b.x - a.x) * f,
				y: a.y + (b.y - a.y) * f
			});
		}
	}
	if (!closed) out.push({
		x: pts[pts.length - 1].x,
		y: pts[pts.length - 1].y
	});
	return out;
}
/**
* Walk a path and drop `n` points at EQUAL arc length, corners be damned — the
* fallback for when there are fewer lanes than the profile has edges. An open
* path gets `n + 1` points (both ends included); a closed one gets `n`.
*/
function resamplePath(path, closed, n) {
	const pts = closed ? [...path, path[0]] : [...path];
	const { len: segLen, total } = edgeLengths(pts);
	const wanted = closed ? n : n + 1;
	const out = [];
	for (let k = 0; k < wanted; k++) {
		let d = total * (k / n);
		if (d >= total) {
			out.push({
				x: pts[pts.length - 1].x,
				y: pts[pts.length - 1].y
			});
			continue;
		}
		let i = 0;
		while (i < segLen.length && d > segLen[i]) {
			d -= segLen[i];
			i++;
		}
		const a = pts[i], b = pts[i + 1] ?? pts[i];
		const f = segLen[i] > 0 ? d / segLen[i] : 0;
		out.push({
			x: a.x + (b.x - a.x) * f,
			y: a.y + (b.y - a.y) * f
		});
	}
	return out;
}
/**
* Build a tube playfield.
*
* ```ts
* const web = vectorKit.generateTube({ x: cx, y: cy, near: 300, far: 80, lanes: 16, profile: 'star' });
* game.vector.poly(web.nearRim, { color: '#41d6ff' }, web.closed);
* game.vector.poly(web.farRim,  { color: '#2a4a7a' }, web.closed);
* for (const [a, b] of web.spokes) game.vector.seg(a.x, a.y, b.x, b.y, { color: '#2a4a7a' });
*
* const p = web.laneAt(playerLane, 0);        // the claw, on the near rim
* const e = web.laneAt(enemyLane, enemyT);    // a flipper, climbing out
* ```
*
* The geometry is STATIC — generate once per level, not per frame. Only
* `laneAt` runs in the loop, and it is a lerp and an atan2.
*/
function generateTube(opts = {}) {
	const lanes = Math.max(2, Math.round(opts.lanes ?? 16));
	const profile = opts.profile ?? "circle";
	const closed = opts.closed ?? profile !== "vee";
	const x = opts.x ?? 0;
	const y = opts.y ?? 0;
	const near = opts.near ?? 300;
	const far = opts.far ?? near * .3;
	const vx = opts.vanishX ?? x;
	const vy = opts.vanishY ?? y;
	const rot = opts.rot ?? 0;
	let unit;
	if (profile === "circle") {
		const span = closed ? TAU : Math.PI;
		unit = Array.from({ length: closed ? lanes : lanes + 1 }, (_, i) => {
			const a = -Math.PI / 2 + span * (i / lanes);
			return {
				x: Math.cos(a),
				y: Math.sin(a)
			};
		});
	} else unit = sampleProfile(PROFILES[profile].pts, closed, lanes);
	const cr = Math.cos(rot), sr = Math.sin(rot);
	const place = (p, cx, cy, r) => ({
		x: cx + (p.x * cr - p.y * sr) * r,
		y: cy + (p.x * sr + p.y * cr) * r
	});
	const nearRim = unit.map((p) => place(p, x, y, near));
	const farRim = unit.map((p) => place(p, vx, vy, far));
	const spokes = nearRim.map((p, i) => [p, farRim[i]]);
	const n = nearRim.length;
	const rimAt = (i, t) => {
		const k = closed ? (i % n + n) % n : Math.max(0, Math.min(n - 1, i));
		const a = nearRim[k], b = farRim[k];
		return {
			x: a.x + (b.x - a.x) * t,
			y: a.y + (b.y - a.y) * t
		};
	};
	const rimPointAt = (u, t) => {
		const w = closed ? (u % lanes + lanes) % lanes : Math.max(0, Math.min(lanes, u));
		const i = Math.floor(w);
		const f = w - i;
		const a = rimAt(i, t), b = rimAt(i + 1, t);
		return {
			x: a.x + (b.x - a.x) * f,
			y: a.y + (b.y - a.y) * f
		};
	};
	const wrapLane = (v) => closed ? (v % lanes + lanes) % lanes : Math.max(0, Math.min(lanes - 1, v));
	const laneDelta = (from, to) => {
		const d = to - from;
		if (!closed) return d;
		let m = d % lanes;
		if (m > lanes / 2) m -= lanes;
		if (m < -lanes / 2) m += lanes;
		return m;
	};
	const laneLen = [];
	const cum = [0];
	for (let i = 0; i < lanes; i++) {
		const a = rimPointAt(i, 0), b = rimPointAt(i + 1, 0);
		const l = Math.hypot(b.x - a.x, b.y - a.y);
		laneLen.push(l);
		cum.push(cum[i] + l);
	}
	const perimeter = cum[lanes];
	/** Lane number → distance along the rim. */
	const arcOf = (lane) => {
		const w = wrapLane(lane);
		const i = Math.min(lanes - 1, Math.floor(w));
		return cum[i] + (w - i) * laneLen[i];
	};
	/** Distance along the rim → lane number. */
	const laneOfArc = (s) => {
		const d = closed ? (s % perimeter + perimeter) % perimeter : Math.max(0, Math.min(perimeter, s));
		let i = 0;
		while (i < lanes - 1 && d >= cum[i + 1]) i++;
		return laneLen[i] > 0 ? i + (d - cum[i]) / laneLen[i] : i;
	};
	const advance = (lane, dist) => wrapLane(laneOfArc(arcOf(lane) + dist));
	const arcDelta = (from, to) => {
		let d = arcOf(to) - arcOf(from);
		if (!closed) return d;
		if (d > perimeter / 2) d -= perimeter;
		if (d < -perimeter / 2) d += perimeter;
		return d;
	};
	const ang = [];
	for (let k = 0; k <= lanes; k++) {
		const p = rimPointAt(k, 0);
		const raw = Math.atan2(p.y - y, p.x - x);
		if (k === 0) {
			ang.push(raw);
			continue;
		}
		let d = raw - ang[k - 1];
		while (d > Math.PI) d -= TAU;
		while (d < -Math.PI) d += TAU;
		ang.push(ang[k - 1] + d);
	}
	const wind = ang[lanes] >= ang[0] ? 1 : -1;
	/** Where a lane sits on the circle, unwrapped to match the table. */
	const angleOf = (lane) => {
		const u = wrapLane(lane) + .5;
		const p = rimPointAt(u, 0);
		let a = Math.atan2(p.y - y, p.x - x);
		const k = Math.min(lanes - 1, Math.floor(u));
		while (a - ang[k] > Math.PI) a -= TAU;
		while (ang[k] - a > Math.PI) a += TAU;
		return a;
	};
	/** The lane sitting at a given angle on the circle — the inverse. */
	const laneAtAngle = (a) => {
		const lo = ang[0] * wind, hi = ang[lanes] * wind;
		let t = a * wind;
		if (closed) t = lo + ((t - lo) % TAU + TAU) % TAU;
		else {
			t += Math.round(((lo + hi) / 2 - t) / TAU) * TAU;
			t = Math.max(lo, Math.min(hi, t));
		}
		let k = 0;
		while (k < lanes - 1 && t > ang[k + 1] * wind) k++;
		const A = rimPointAt(k, 0), B = rimPointAt(k + 1, 0);
		const ax = A.x - x, ay = A.y - y;
		const dx = Math.cos(t * wind), dy = Math.sin(t * wind);
		const den = (ax - (B.x - x)) * dy - (ay - (B.y - y)) * dx;
		const f = Math.abs(den) > 1e-12 ? (ax * dy - ay * dx) / den : 0;
		return wrapLane(k + Math.max(0, Math.min(1, f)) - .5);
	};
	return {
		lanes,
		closed,
		nearRim,
		farRim,
		spokes,
		rimAt,
		rimPointAt,
		wrapLane,
		laneDelta,
		perimeter,
		advance,
		arcDelta,
		angleOf,
		laneAtAngle,
		angleSpan: {
			from: ang[0],
			to: ang[lanes]
		},
		bottom: laneAtAngle(Math.PI / 2),
		turn(lane, dAngle) {
			let a = angleOf(lane) + dAngle;
			if (!closed) {
				const lo = Math.min(ang[0], ang[lanes]), hi = Math.max(ang[0], ang[lanes]);
				a = Math.max(lo, Math.min(hi, a));
			}
			return laneAtAngle(a);
		},
		steer(lane, dist) {
			return advance(lane, -wind * dist);
		},
		laneLength(i) {
			return laneLen[Math.min(lanes - 1, Math.max(0, closed ? (i % lanes + lanes) % lanes : i))];
		},
		glide(from, to, maxDist) {
			const d = arcDelta(from, to);
			return Math.abs(d) <= maxDist ? wrapLane(to) : advance(from, Math.sign(d) * maxDist);
		},
		laneAt(lane, t) {
			const u = wrapLane(lane) + .5;
			const here = rimPointAt(u, t);
			const n0 = rimPointAt(u, 0), f0 = rimPointAt(u, 1);
			const wa = rimPointAt(u - .5, t), wb = rimPointAt(u + .5, t);
			const na = rimPointAt(u - .5, 0), nb = rimPointAt(u + .5, 0);
			const nw = Math.hypot(nb.x - na.x, nb.y - na.y);
			return {
				x: here.x,
				y: here.y,
				angle: Math.atan2(n0.y - f0.y, n0.x - f0.x),
				scale: nw > 0 ? Math.hypot(wb.x - wa.x, wb.y - wa.y) / nw : 1
			};
		},
		stepLane(from, to, maxStep) {
			const d = laneDelta(from, to);
			return Math.abs(d) <= maxStep ? wrapLane(to) : wrapLane(from + Math.sign(d) * maxStep);
		},
		laneOf(x0, y0) {
			let bestU = 0, bestD = Infinity;
			for (let i = 0; i < lanes; i++) {
				const a = rimAt(i, 0), b = rimAt(i + 1, 0);
				const dx = b.x - a.x, dy = b.y - a.y;
				const l2 = dx * dx + dy * dy;
				const f = l2 > 0 ? Math.max(0, Math.min(1, ((x0 - a.x) * dx + (y0 - a.y) * dy) / l2)) : 0;
				const px = a.x + dx * f, py = a.y + dy * f;
				const d = (x0 - px) ** 2 + (y0 - py) ** 2;
				if (d < bestD) {
					bestD = d;
					bestU = i + f;
				}
			}
			return wrapLane(bestU - .5);
		}
	};
}
/**
* Pixels per world unit at one unit of depth. Divide by an edge's `za`/`zb` for
* the scale at that end — the whole of perspective in one number.
*
* ```ts
* const f = vectorKit.focalLength(view);
* layer.seg(e.a.x, e.a.y, e.b.x, e.b.y, { width: Math.max(0.4, 3 * f / e.za / 40) });
* ```
*/
function focalLength(view, fov = 1.05) {
	return view.h / 2 / Math.tan(fov / 2);
}
/** @internal World point → camera space (x right, y up, z forward-of-camera). */
function toView(p, cam) {
	const dx = p.x - cam.x, dy = p.y - cam.y, dz = p.z - cam.z;
	const cy = Math.cos(cam.yaw ?? 0), sy = Math.sin(cam.yaw ?? 0);
	const vx = dx * cy - dz * sy;
	const vz = dx * sy + dz * cy;
	const cp = Math.cos(cam.pitch ?? 0), sp = Math.sin(cam.pitch ?? 0);
	return {
		x: vx,
		y: dy * cp - vz * sp,
		z: dy * sp + vz * cp
	};
}
/**
* Project ONE world point to the screen, or `null` if it is behind the near
* plane. Handy for placing 2D things (labels, a targeting box, a sprite) on a
* 3D position without projecting a whole model.
*/
function projectPoint(p, cam, view) {
	const v = toView(p, cam);
	const near = view.near ?? 1;
	if (v.z <= near) return null;
	const f = focalLength(view, cam.fov ?? 1.05);
	return {
		x: view.w / 2 + v.x * f / v.z,
		y: view.h / 2 - v.y * f / v.z,
		z: v.z
	};
}
/**
* Project a wireframe model to 2D segments, near-plane clipped.
*
* ```ts
* for (const e of vectorKit.project(tank, cam, view)) {
*   game.vector.seg(e.a.x, e.a.y, e.b.x, e.b.y, { color: '#41d6ff', width: 3 * f / e.za });
* }
* ```
*
* An edge straddling the near plane is CUT at it rather than dropped, so
* geometry doesn't pop out of existence as you walk into it — the one thing a
* naive projector always gets wrong (divide by a negative z and the edge
* whips across the screen backwards).
*/
function project(model, cam, view) {
	const near = view.near ?? 1;
	const f = focalLength(view, cam.fov ?? 1.05);
	const hw = view.w / 2, hh = view.h / 2;
	const vs = model.points.map((p) => toView(p, cam));
	const out = [];
	for (const [i, j] of model.edges) {
		let a = vs[i], b = vs[j];
		if (!a || !b) continue;
		if (a.z <= near && b.z <= near) continue;
		if (a.z <= near || b.z <= near) {
			const t = (near - a.z) / (b.z - a.z);
			const cut = {
				x: a.x + (b.x - a.x) * t,
				y: a.y + (b.y - a.y) * t,
				z: near
			};
			if (a.z <= near) a = cut;
			else b = cut;
		}
		out.push({
			a: {
				x: hw + a.x * f / a.z,
				y: hh - a.y * f / a.z
			},
			b: {
				x: hw + b.x * f / b.z,
				y: hh - b.y * f / b.z
			},
			za: a.z,
			zb: b.z
		});
	}
	return out;
}
/**
* The ground line — where a flat plane at infinite distance lands on screen.
*
* It depends only on `pitch` (yaw slides along it, and there is no roll), so it
* is a horizontal line at `h/2 + f·tan(pitch)`. Draw it first and everything
* else sits in a world.
*/
function horizon(cam, view) {
	const f = focalLength(view, cam.fov ?? 1.05);
	const y = view.h / 2 + f * Math.tan(cam.pitch ?? 0);
	return [{
		x: 0,
		y
	}, {
		x: view.w,
		y
	}];
}
/**
* A wireframe box centred on `(cx, cy, cz)` — eight points and twelve edges of
* pure boilerplate, and the staple obstacle of every first-person vector game.
*/
function wireBox(w, h, d, cx = 0, cy = 0, cz = 0) {
	const x = w / 2, y = h / 2, z = d / 2;
	return {
		points: [
			{
				x: cx - x,
				y: cy - y,
				z: cz - z
			},
			{
				x: cx + x,
				y: cy - y,
				z: cz - z
			},
			{
				x: cx + x,
				y: cy + y,
				z: cz - z
			},
			{
				x: cx - x,
				y: cy + y,
				z: cz - z
			},
			{
				x: cx - x,
				y: cy - y,
				z: cz + z
			},
			{
				x: cx + x,
				y: cy - y,
				z: cz + z
			},
			{
				x: cx + x,
				y: cy + y,
				z: cz + z
			},
			{
				x: cx - x,
				y: cy + y,
				z: cz + z
			}
		],
		edges: [
			[0, 1],
			[1, 2],
			[2, 3],
			[3, 0],
			[4, 5],
			[5, 6],
			[6, 7],
			[7, 4],
			[0, 4],
			[1, 5],
			[2, 6],
			[3, 7]
		]
	};
}
/**
* Measure a model: the corners of its axis-aligned box, and the size and centre
* they imply. For a cheap distance cull, or for scaling something to fit.
*
* To stand a model on the ground use `placeModelOnGround`, which does the sum
* for you.
*/
function wireBounds(model) {
	const zero = {
		x: 0,
		y: 0,
		z: 0
	};
	if (model.points.length === 0) return {
		min: { ...zero },
		max: { ...zero },
		size: { ...zero },
		center: { ...zero }
	};
	const min = {
		x: Infinity,
		y: Infinity,
		z: Infinity
	};
	const max = {
		x: -Infinity,
		y: -Infinity,
		z: -Infinity
	};
	for (const p of model.points) {
		if (p.x < min.x) min.x = p.x;
		if (p.y < min.y) min.y = p.y;
		if (p.z < min.z) min.z = p.z;
		if (p.x > max.x) max.x = p.x;
		if (p.y > max.y) max.y = p.y;
		if (p.z > max.z) max.z = p.z;
	}
	return {
		min,
		max,
		size: {
			x: max.x - min.x,
			y: max.y - min.y,
			z: max.z - min.z
		},
		center: {
			x: (min.x + max.x) / 2,
			y: (min.y + max.y) / 2,
			z: (min.z + max.z) / 2
		}
	};
}
/**
* Move and turn a model without touching the original — the way you place many
* copies of one shape, or drive a tank around. `yaw` turns it about its own
* vertical axis first, then it is offset to `(x, y, z)`.
*
* `y` positions the model's OWN ORIGIN, wherever the model happens to keep it.
* If what you want is for the thing to stand on the floor, reach for
* `placeModelOnGround` and give it no `y` at all.
*/
function placeModel(model, x, y, z, yaw = 0) {
	const c = Math.cos(yaw), s = Math.sin(yaw);
	return {
		points: model.points.map((p) => ({
			x: x + p.x * c + p.z * s,
			y: y + p.y,
			z: z - p.x * s + p.z * c
		})),
		edges: model.edges
	};
}
/**
* Stand a model on the ground at `(x, z)` — the placement a first-person
* wireframe scene actually wants.
*
* ```ts
* const block = vectorKit.placeModelOnGround(vectorKit.wireBox(120, 280, 90), 900, -1400);
* const tank  = vectorKit.placeModelOnGround(TANK, tx, tz, heading);
* ```
*
* No height to work out and none to get wrong. Models keep their origin
* wherever suits them — `wireBox` about its centre, a hand-built pyramid at its
* base — so "put it at y = 0" means different things for different models and
* silently buries the ones built about their middle. This asks each model where
* its own floor is and drops it exactly there, so a box, a pyramid and a
* multi-part tank all land flush without the caller knowing how any of them
* were built.
*
* `groundY` moves the floor; `yaw` turns the model about its vertical axis,
* which cannot change how tall it is, so it stays flush at any heading.
*/
function placeModelOnGround(model, x, z, yaw = 0, groundY = 0) {
	return placeModel(model, x, groundY - wireBounds(model).min.y, z, yaw);
}
/**
* A ground grid as a wireframe model — `n` lines each way at `step` apart,
* centred on `(cx, cz)` at height `y`. The cheapest way to make a first-person
* scene feel like it has a floor.
*/
function wireGrid(n, step, y = 0, cx = 0, cz = 0) {
	const points = [];
	const edges = [];
	const half = n * step / 2;
	for (let i = 0; i <= n; i++) {
		const o = -half + i * step;
		const base = points.length;
		points.push({
			x: cx + o,
			y,
			z: cz - half
		}, {
			x: cx + o,
			y,
			z: cz + half
		});
		points.push({
			x: cx - half,
			y,
			z: cz + o
		}, {
			x: cx + half,
			y,
			z: cz + o
		});
		edges.push([base, base + 1], [base + 2, base + 3]);
	}
	return {
		points,
		edges
	};
}
/**
* The convex hull of a point set (monotone chain), counter-clockwise in
* standard axes — which is CLOCKWISE on screen, y being down.
*
* Fewer than three distinct points comes back as-is; collinear points are
* dropped.
*/
function convexHull(points) {
	const pts = points.map((p) => ({
		x: p.x,
		y: p.y
	})).sort((a, b) => a.x - b.x || a.y - b.y);
	const uniq = [];
	for (const p of pts) {
		const last = uniq[uniq.length - 1];
		if (!last || last.x !== p.x || last.y !== p.y) uniq.push(p);
	}
	if (uniq.length < 3) return uniq;
	const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
	const half = (src) => {
		const out = [];
		for (const p of src) {
			while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], p) <= 0) out.pop();
			out.push(p);
		}
		out.pop();
		return out;
	};
	return [...half(uniq), ...half([...uniq].reverse())];
}
/**
* Reduce a CONVEX outline to at most `max` vertices, dropping the ones that
* cost the least area — so the silhouette survives as well as it can.
*
* This is the step that stops an 11-point asteroid becoming a null Box2D
* shape. Run `convexHull` first; on a concave input the areas are meaningless.
*/
function simplifyHull(points, max = 8) {
	const pts = points.map((p) => ({
		x: p.x,
		y: p.y
	}));
	if (max < 3) return pts.slice(0, Math.max(0, max));
	while (pts.length > max) {
		let worst = 0, worstArea = Infinity;
		for (let i = 0; i < pts.length; i++) {
			const a = pts[(i - 1 + pts.length) % pts.length], b = pts[i], c = pts[(i + 1) % pts.length];
			const area = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2;
			if (area < worstArea) {
				worstArea = area;
				worst = i;
			}
		}
		pts.splice(worst, 1);
	}
	return pts;
}
/**
* Outline → a point list Box2D will actually accept: convex, at most
* `MAX_HULL_POINTS` vertices, in the shape's own local frame.
*
* **Do not re-centre the result on its centroid.** Box2D computes centroid,
* mass and inertia from the polygon in body-local space, so passing the raw
* local points keeps the drawn outline and the collision shape registered.
* Re-centring looks tidier and is the bug — a shape that spins about a point
* it isn't drawn around.
*/
function hullFor(points, max = 8) {
	return simplifyHull(convexHull(points), max);
}
/**
* Split a simple polygon into CONVEX pieces (ear clipping, then merging ears
* back together while the join stays convex and within `max` vertices).
*
* The honest way to give a concave silhouette — a ship, a plus, a letter — real
* collision instead of the hull's approximation: each piece becomes its own
* Box2D polygon on ONE body, so the notch is a notch.
*
* Returns `[points]` unchanged when the outline is already convex and short
* enough, so the cheap case stays cheap.
*/
function convexPieces(points, max = 8) {
	const poly = points.map((p) => ({
		x: p.x,
		y: p.y
	}));
	if (poly.length < 3) return [];
	if (poly.length <= max && isConvex(poly)) return [poly];
	if (signedArea(poly) < 0) poly.reverse();
	const ears = [];
	const work = poly.slice();
	let guard = work.length * work.length + 16;
	while (work.length > 3 && guard-- > 0) {
		let clipped = false;
		for (let i = 0; i < work.length; i++) {
			const a = work[(i - 1 + work.length) % work.length];
			const b = work[i];
			const c = work[(i + 1) % work.length];
			if (cross3(a, b, c) <= 0) continue;
			let contains = false;
			for (let j = 0; j < work.length; j++) {
				const p = work[j];
				if (p === a || p === b || p === c) continue;
				if (inTriangle(p, a, b, c)) {
					contains = true;
					break;
				}
			}
			if (contains) continue;
			ears.push([
				a,
				b,
				c
			]);
			work.splice(i, 1);
			clipped = true;
			break;
		}
		if (!clipped) break;
	}
	if (work.length === 3) ears.push(work);
	const out = [];
	for (const ear of ears) {
		const last = out[out.length - 1];
		if (last) {
			const merged = mergeIfConvex(last, ear, max);
			if (merged) {
				out[out.length - 1] = merged;
				continue;
			}
		}
		out.push(ear);
	}
	return out;
}
function signedArea(p) {
	let a = 0;
	for (let i = 0; i < p.length; i++) {
		const q = p[i], r = p[(i + 1) % p.length];
		a += q.x * r.y - r.x * q.y;
	}
	return a / 2;
}
function cross3(a, b, c) {
	return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}
function inTriangle(p, a, b, c) {
	const d1 = cross3(a, b, p), d2 = cross3(b, c, p), d3 = cross3(c, a, p);
	return d1 >= 0 && d2 >= 0 && d3 >= 0 || d1 <= 0 && d2 <= 0 && d3 <= 0;
}
/** True if every turn goes the same way (a convex simple polygon). */
function isConvex(p) {
	if (p.length < 3) return false;
	let sign = 0;
	for (let i = 0; i < p.length; i++) {
		const c = cross3(p[i], p[(i + 1) % p.length], p[(i + 2) % p.length]);
		if (Math.abs(c) < 1e-9) continue;
		const s = c > 0 ? 1 : -1;
		if (sign === 0) sign = s;
		else if (s !== sign) return false;
	}
	return true;
}
/** @internal Two pieces sharing an edge, joined — if the join stays convex. */
function mergeIfConvex(a, b, max) {
	if (a.length + b.length - 2 > max) return null;
	const same = (p, q) => p.x === q.x && p.y === q.y;
	for (let i = 0; i < a.length; i++) {
		const a0 = a[i], a1 = a[(i + 1) % a.length];
		for (let j = 0; j < b.length; j++) {
			const b0 = b[j], b1 = b[(j + 1) % b.length];
			if (!(same(a0, b1) && same(a1, b0))) continue;
			const merged = [];
			for (let k = 0; k < a.length; k++) merged.push(a[(i + 1 + k) % a.length]);
			for (let k = 1; k < b.length - 1; k++) merged.push(b[(j + 1 + k) % b.length]);
			return isConvex(merged) ? merged : null;
		}
	}
	return null;
}
/**
* Ear-clipping triangulation of a simple polygon — index triples into
* `points`. Handles concave outlines and either winding; no holes, no
* self-intersection. Degenerate input fans the remainder rather than looping.
*
* This is what turns a vector OUTLINE into a filled face. It lives here rather
* than being borrowed from the 3D geometry module because the vector layer
* must never pull in the 3D chunk.
*/
function triangulate(points) {
	const n = points.length;
	if (n < 3) return [];
	const idx = points.map((_, i) => i);
	let area = 0;
	for (let i = 0; i < n; i++) {
		const a = points[i], b = points[(i + 1) % n];
		area += a.x * b.y - b.x * a.y;
	}
	if (area < 0) idx.reverse();
	const cross = (a, b, c) => (points[b].x - points[a].x) * (points[c].y - points[a].y) - (points[b].y - points[a].y) * (points[c].x - points[a].x);
	const inside = (a, b, c, p) => cross(a, b, p) >= -1e-12 && cross(b, c, p) >= -1e-12 && cross(c, a, p) >= -1e-12;
	const out = [];
	let guard = n * n + 8;
	while (idx.length > 3 && guard-- > 0) {
		let clipped = false;
		for (let i = 0; i < idx.length; i++) {
			const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
			if (cross(a, b, c) <= 1e-12) continue;
			let blocked = false;
			for (const p of idx) {
				if (p === a || p === b || p === c) continue;
				if (inside(a, b, c, p)) {
					blocked = true;
					break;
				}
			}
			if (blocked) continue;
			out.push([
				a,
				b,
				c
			]);
			idx.splice(i, 1);
			clipped = true;
			break;
		}
		if (!clipped) break;
	}
	for (let i = 1; i < idx.length - 1; i++) out.push([
		idx[0],
		idx[i],
		idx[i + 1]
	]);
	return out;
}
//#endregion
//#region src/lib/vector.ts
var LINE_FLOATS = 24;
var FILL_FLOATS = 8;
var XFORM_FLOATS = 8;
/** Assemble the line shader (pure string work — dist-tested). Two variants:
* the SCENE shader draws crisp AA cores only, and the STAMP shader feeds the
* shared GlowPass (soft tinted cores into the half-res blur target — glow as
* a POST pass: in-shader halos couldn't join at polyline corners, a blurred
* image of the finished lines joins perfectly, and the quads shrink to core
* size). */
function buildLineWGSL(stamp = false) {
	return `
const STAMP = ${stamp};
struct U { view: vec4f }
// seg:   ax, ay, bx, by                  (shape-local endpoints)
// style: coreHalf, stampHalf, z, shapeIdx (world units; z 0..1) — stampHalf
//        is the glow-stamp half-width (the blurred halo's source thickness)
// extra: dash period, glow intensity, capped (width >= 1), dwell
// c0/c1: rgba at endpoint a / endpoint b (gradient along the line)
//
// JOINTS: adjacent segments in a chain are cut on the ANGLE BISECTOR
// they share, taking opposite sides of one plane, so they abut instead
// of overlapping. Each still contributes half of the round cap, so the
// join looks exactly as it did — but every pixel is painted ONCE, which
// is what lets a chain take an alpha. Overlapping caps blend twice and
// bead every corner (0.35 becomes 0.58); at alpha 1 that was invisible,
// because drawing a colour over itself changes nothing.
// Cutting each segment square across its OWN end is the obvious version
// and is wrong: two perpendicular cuts leave an uncovered wedge and
// notch every corner. One shared plane has no space between its sides.
// join.xy / join.zw are the inward normals; all zero = no cut (a lone
// segment, or the free end of an open chain).
// TWO EXCEPTIONS, both cut square instead. HAIRLINES: a width < 1 core
// is AA-limited (peak alpha below 1) so it beads anyway, and at that
// scale a square cut's notch is sub-pixel. And the GLOW STAMP, which is
// additive and saturates cleanly — corners burning brighter is the look,
// and what dwell exists to exaggerate.
struct Inst { seg: vec4f, style: vec4f, extra: vec4f, c0: vec4f, c1: vec4f, join: vec4f }
// Transform slot: x, y, rot, scale | alphaMul, glowMul, 0, 0. Slot 0 is
// the identity — immediate segments live there.
struct XF { pos: vec4f, mods: vec4f }
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) local: vec2f,        // capsule space: along (world u), across
  @location(1) len: f32,
  @location(2) width: vec2f,        // coreHalf, haloW
  @location(3) c0: vec4f,
  @location(4) c1: vec4f,
  @location(5) extra: vec3f,        // dash, glow (already × glowMul), dwell
  @location(6) capped: f32,         // 1 = round caps; 0 = hairline flat cut
  @location(7) join: vec4f,         // cut planes at a / at b, in capsule space
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var<storage, read> xf: array<XF>;

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  let t = xf[u32(d.style.w)];
  // Shape transform: scale, rotate, translate the endpoints.
  let cr = cos(t.pos.z);
  let sr = sin(t.pos.z);
  let s = t.pos.w;
  let a = t.pos.xy + vec2f(
    (d.seg.x * cr - d.seg.y * sr) * s,
    (d.seg.x * sr + d.seg.y * cr) * s,
  );
  let b = t.pos.xy + vec2f(
    (d.seg.z * cr - d.seg.w * sr) * s,
    (d.seg.z * sr + d.seg.w * cr) * s,
  );
  let ab = b - a;
  let raw = length(ab);
  let len = max(1e-5, raw);
  // A ZERO-LENGTH segment is a DOT — seg(x, y, x, y). Without a fallback axis
  // its direction is 0/0, the quad collapses to a point and nothing rasterises
  // at all. Any axis will do: the capsule SDF around a zero-length segment is
  // a disc whichever way it faces.
  let dir = select(vec2f(1.0, 0.0), ab / len, raw > 1e-5);
  let n = vec2f(-dir.y, dir.x);
  // The quad covers the core (or the stamp width) + AA margin + round caps.
  // Dwell fattens the ends, so the quad has to reach far enough to contain it.
  let dwellGain = 1.0 + d.extra.w * 0.85;
  var reach = d.style.x * dwellGain + 2.0;
  if (STAMP) { reach = d.style.y * dwellGain + 2.0; }
  let c01 = vec2f(f32(vi & 1u), f32(vi >> 1u));
  let along = mix(-reach, len + reach, c01.x);
  let across = (c01.y - 0.5) * 2.0 * reach;
  let world = a + dir * along + n * across;
  let ndc = (world - u.view.xy) / u.view.zw * 2.0 - 1.0;
  var out: VSOut;
  out.pos = vec4f(ndc.x, -ndc.y, 1.0 - d.style.z, 1.0);
  out.local = vec2f(along, across);
  out.len = len;
  out.width = vec2f(d.style.x, d.style.y);
  out.c0 = vec4f(d.c0.rgb, d.c0.a * t.mods.x);
  out.c1 = vec4f(d.c1.rgb, d.c1.a * t.mods.x);
  out.extra = vec3f(d.extra.x, d.extra.y * t.mods.y, d.extra.w);
  out.capped = d.extra.z;
  // The cut planes turn with the shape, then drop into capsule space so the
  // fragment can test them with a dot product and nothing else.
  let ja = vec2f(d.join.x * cr - d.join.y * sr, d.join.x * sr + d.join.y * cr);
  let jb = vec2f(d.join.z * cr - d.join.w * sr, d.join.z * sr + d.join.w * cr);
  out.join = vec4f(dot(ja, dir), dot(ja, n), dot(jb, dir), dot(jb, n));
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  // Capsule SDF in local space: distance to the segment [0, len] on the axis.
  let q = vec2f(in.local.x - clamp(in.local.x, 0.0, in.len), in.local.y);
  let d = length(q);
  let aa = max(fwidth(d), 1e-4);
  // Hairline mode (scene only): cut flat at the endpoints — see the JOINTS
  // note above. The glow stamp keeps its soft caps (MAX blend absorbs them).
  // A dot has no ends to cut square, so the hairline rule must not erase it.
  if (!STAMP && in.capped < 0.5 && in.len > 1e-4 && (in.local.x < 0.0 || in.local.x > in.len)) {
    discard;
  }
  // Cut on the joins — see the JOINTS note above. A zero normal dots to 0 and
  // so never discards, which is how a free end keeps its round cap.
  // Cut on the joins — see the JOINTS note above. FADED, not discarded: the
  // two sides of a joint compute their distance to the same plane through
  // different bases, so near it they disagree in the last bits. A hard test
  // then either keeps a fragment twice (a bright hairline along the diagonal
  // of an axis-aligned corner, where a whole row of pixel centres lands
  // exactly on zero) or drops it twice (a dark notch). Both were seen, one per
  // backend, from the same code. Fading over a pixel makes the two sides sum
  // to one across the seam whichever way the bits fall, and antialiases the
  // cut into the bargain. The residual is second order — at alpha a the worst
  // error is a²/4, invisible in a one-pixel band.
  // The distances and their screen derivatives are computed UNCONDITIONALLY:
  // fwidth reads neighbouring fragments, so WGSL requires uniform control flow
  // and rejects the shader outright if it sits inside an if.
  let ja = in.join.xy;
  let jb = in.join.zw;
  let da = in.local.x * ja.x + in.local.y * ja.y;
  let db = (in.local.x - in.len) * jb.x + in.local.y * jb.y;
  let wa = max(fwidth(da), 1e-4);
  let wb = max(fwidth(db), 1e-4);
  var jcut = 1.0;
  if (!STAMP && in.capped >= 0.5) {
    if (dot(ja, ja) > 0.0) { jcut *= smoothstep(-0.5, 0.5, da / wa); }
    if (dot(jb, jb) > 0.0) { jcut *= smoothstep(-0.5, 0.5, db / wb); }
    if (jcut <= 0.0) { discard; }
  }
  let tt = clamp(in.local.x / in.len, 0.0, 1.0);
  var col = mix(in.c0, in.c1, tt);
  // Dash: a smooth on/off gate along the axis (period in world units, half
  // duty).
  var gate = 1.0;
  if (in.extra.x > 0.0) {
    let ph = fract(in.local.x / in.extra.x);
    let waa = aa / in.extra.x;
    gate = 1.0 - smoothstep(0.5 - waa, 0.5 + waa, abs(ph - 0.5) * 2.0);
  }
  // BEAM DWELL. A real display's beam decelerates at the end of a stroke, so
  // more electrons land there and the spot burns brighter and fatter. How much
  // it decelerates depends on HOW SHARPLY IT TURNS: a shallow bend in a
  // polyline barely slows the beam, a hairpin nearly stops it, and the end of
  // a stroke stops it dead. So the boost is scaled per end by sin(half the
  // turn) — 0 straight through, 1 doubled back — which the join bisector
  // already carries: it is a unit vector in capsule space, so its component
  // along the axis IS cos(half the turn). A FREE end has no bisector (a zero
  // normal) and is a real terminus, so it keeps the full boost.
  // With both gains at 1 this is exactly the old single-k behaviour.
  let dwellW = in.width.x * 2.0 + 4.0;
  let kA = 1.0 - smoothstep(0.0, dwellW, max(in.local.x, 0.0));
  let kB = 1.0 - smoothstep(0.0, dwellW, max(in.len - in.local.x, 0.0));
  let sA = select(1.0, sqrt(max(0.0, 1.0 - in.join.x * in.join.x)), dot(in.join.xy, in.join.xy) > 0.0);
  let sB = select(1.0, sqrt(max(0.0, 1.0 - in.join.z * in.join.z)), dot(in.join.zw, in.join.zw) > 0.0);
  let k = max(kA * sA, kB * sB);
  let boost = 1.0 + in.extra.z * 0.85 * k;
  if (STAMP) {
    // The glow-pass stamp: a SOFT tinted core (triangle falloff to the
    // stamp width), brightness = glow × the shape's live glowMul. The
    // shared half-res gaussian blur turns this into the phosphor halo —
    // and because it blurs the FINISHED line image, joints join perfectly
    // (the in-shader halo could not: hard joint cuts left notched wedges
    // at every corner — Rich's screenshot).
    let soft = (1.0 - smoothstep(0.0, max(in.width.y * boost, 1e-4), d)) * gate;
    let g = soft * col.a * in.extra.y * (1.0 + in.extra.z * 1.2 * k);
    return vec4f(col.rgb * g, g);              // additive-summed in the target
  }
  // The scene line: a crisp AA core, nothing else — glow 0 IS this look.
  let cw = in.width.x * boost;
  let core = (1.0 - smoothstep(cw - aa, cw + aa, d)) * gate * jcut;
  let aCore = core * col.a;
  return vec4f(col.rgb * aCore, aCore);        // premultiplied out
}
`;
}
/**
* The FILL shader — solid faces under the line art.
*
* A triangulated outline, one vertex at a time: local position, the shape's
* transform slot, a depth, and a colour PER VERTEX (which is what gives the
* gradient — no extra uniform, no second pass). It shares the same `xf`
* transform table as the lines, so a filled shape moves for the same 8 floats.
*
* Depth is the point of it. The fill pass WRITES depth where the line pass
* only tests it, so a nearer filled shape hides both the fills and the lines
* behind it — corridors, Elite hulls, a Tempest web with solid lanes.
*/
function buildFillWGSL() {
	return `
struct U { view: vec4f }
// v: x, y (shape-local), z (0..1 depth), shapeIdx
struct Vtx { v: vec4f, color: vec4f }
struct XF { pos: vec4f, mods: vec4f }
struct VSOut { @builtin(position) pos: vec4f, @location(0) color: vec4f }
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> verts: array<Vtx>;
@group(0) @binding(2) var<storage, read> xf: array<XF>;

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  let d = verts[vi];
  let t = xf[u32(d.v.w)];
  let cr = cos(t.pos.z);
  let sr = sin(t.pos.z);
  let s = t.pos.w;
  let world = t.pos.xy + vec2f(
    (d.v.x * cr - d.v.y * sr) * s,
    (d.v.x * sr + d.v.y * cr) * s,
  );
  let ndc = (world - u.view.xy) / u.view.zw * 2.0 - 1.0;
  var out: VSOut;
  out.pos = vec4f(ndc.x, -ndc.y, 1.0 - d.v.z, 1.0);
  // The shape's live alpha multiplies the fill, so fading a shape fades both
  // its face and its outline together.
  out.color = vec4f(d.color.rgb, d.color.a * t.mods.x);
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  return vec4f(in.color.rgb * in.color.a, in.color.a);   // premultiplied
}
`;
}
/**
* World clip rect → an integer pixel scissor on a `pxW × pxH` target, given the
* view rect the layer was begun with. `null` = nothing of the rect is on the
* target, so the whole draw can be skipped.
*
* Pure so both backends share it AND so the half-res glow target gets the same
* arithmetic — a halo clipped to a different rectangle than its line is the
* bug this exists to prevent.
*/
function clipToScissor(clip, viewX, viewY, viewW, viewH, pxW, pxH) {
	if (viewW <= 0 || viewH <= 0 || pxW <= 0 || pxH <= 0) return null;
	const sx = pxW / viewW, sy = pxH / viewH;
	const clampX = (v) => Math.max(0, Math.min(pxW, Math.round(v)));
	const clampY = (v) => Math.max(0, Math.min(pxH, Math.round(v)));
	const x0 = clampX((clip.x - viewX) * sx);
	const x1 = clampX((clip.x + clip.w - viewX) * sx);
	const y0 = clampY((clip.y - viewY) * sy);
	const y1 = clampY((clip.y + clip.h - viewY) * sy);
	if (x1 <= x0 || y1 <= y0) return null;
	return {
		x: x0,
		y: y0,
		w: x1 - x0,
		h: y1 - y0
	};
}
/** Expand a polyline into segment endpoint pairs (closed joins last→first). */
function polySegs(points, closed = false) {
	const out = [];
	for (let i = 1; i < points.length; i++) out.push([points[i - 1], points[i]]);
	if (closed && points.length > 2) out.push([points[points.length - 1], points[0]]);
	return out;
}
/**
* Where each segment of a chain should stop, so neighbours ABUT instead of
* overlapping — four floats per segment, matching `polySegs` order.
*
* Each segment end carries the inward normal of the plane it is cut on: the
* two segments meeting at a joint share one plane, the ANGLE BISECTOR, and
* take opposite sides of it. Between them they still tile the whole join —
* each contributes half of the round cap — so the picture is unchanged while
* every pixel is painted exactly once.
*
* That is the difference between this and cutting each segment square across
* its own end, which is the obvious thing to try and notches every corner: two
* perpendicular cuts leave an uncovered wedge between them, whereas one shared
* plane has no space between its two sides.
*
* Painting once is what makes ALPHA work on an outline. Overlapping caps blend
* twice, so at `alpha` 0.35 a joint reaches 1 − 0.65² = 0.58 while the rest of
* the line sits at 0.35, and every corner beads. Fully opaque lines never
* showed it, because drawing the same colour over itself changes nothing.
*
* A free end — either end of an open chain — gets a zero normal, which the
* shader reads as "no cut" and leaves as a round cap.
*/
function chainJoins(points, closed = false) {
	return segJoins(polySegs(points, closed));
}
/**
* `chainJoins` for a list of segments rather than a path — the emitter's
* particle outlines arrive already cut into pairs.
*
* Two segments are joined when one ends where the next begins, which is the
* only thing that actually matters and needs no separate `closed` flag: a loop
* is simply a list whose last segment lands back on the first.
*/
function segJoins(segs) {
	const n = segs.length;
	const out = new Float32Array(n * 4);
	if (n < 2) return out;
	const dirs = segs.map(([a, b]) => {
		const dx = b.x - a.x, dy = b.y - a.y;
		const l = Math.hypot(dx, dy);
		return l > 1e-9 ? {
			x: dx / l,
			y: dy / l
		} : {
			x: 0,
			y: 0
		};
	});
	const meets = (i, j) => Math.abs(segs[i][1].x - segs[j][0].x) < 1e-6 && Math.abs(segs[i][1].y - segs[j][0].y) < 1e-6;
	for (let i = 0; i < n; i++) {
		const prev = (i - 1 + n) % n;
		if (!meets(prev, i)) continue;
		const a = dirs[prev], b = dirs[i];
		let mx = a.x + b.x, my = a.y + b.y;
		const l = Math.hypot(mx, my);
		if (l < 1e-6) {
			mx = b.x;
			my = b.y;
		} else {
			mx /= l;
			my /= l;
		}
		out[prev * 4 + 2] = -mx;
		out[prev * 4 + 3] = -my;
		out[i * 4] = mx;
		out[i * 4 + 1] = my;
	}
	return out;
}
/** @internal A packed style recoloured — everything else (width, glow, dash,
*  z) is preserved, so a per-particle colour costs one object, not a re-pack. */
function tintStyle(base, color) {
	const c = rgba(color);
	return {
		...base,
		c0: c,
		c1: c
	};
}
/**
* One packed style per segment, or null when the chain is uniform.
*
* This is what makes colour work on CHAINS, and it covers both ways of asking:
*
* - `colors` — a SOURCE stepped once per segment (rainbow polygons, hue-graded
*   terrain). Per index, because that is what a source means.
* - `color2` — a GRADIENT from `color`, run once along the WHOLE run by ARC
*   LENGTH. A single instanced segment can only ramp end to end, so without
*   this the whole from→to repeats inside every segment and a polyline comes
*   out banded, one full ramp per edge. Measuring by length rather than by
*   segment index matters as soon as the edges differ: a long edge would
*   otherwise sweep the same amount of colour as a short one and the ramp
*   would visibly stall and rush.
*
* On a CLOSED outline the ramp runs the whole way round and meets itself at the
* first point, so `color` and `color2` sit next to each other there — the seam
* any linear gradient on a loop has. Pick close colours, or leave it open.
*/
function segmentStyles(raw, segs) {
	const n = segs.length;
	if (n <= 0) return null;
	const base = packStyle(raw);
	if (raw.colors !== void 0) {
		const out = new Array(n);
		const at = rampSource(raw.colors) ? arcIndex(segs) : null;
		for (let i = 0; i < n; i++) out[i] = tintStyle(base, resolveVecColor(raw.colors, at ? at[i] : i));
		return out;
	}
	if (raw.color2 === void 0 || n < 2) return null;
	const cum = new Array(n + 1);
	cum[0] = 0;
	for (let i = 0; i < n; i++) {
		const [a, b] = segs[i];
		cum[i + 1] = cum[i] + Math.hypot(b.x - a.x, b.y - a.y);
	}
	const total = cum[n];
	const at = (i) => total > 1e-9 ? cum[i] / total : i / n;
	const from = raw.color ?? "#ffffff";
	const to = raw.color2;
	const alpha = raw.alpha ?? 1;
	const ramp = (t) => {
		const c = rgba(lerp(from, to, t));
		return [
			c[0],
			c[1],
			c[2],
			c[3] * alpha
		];
	};
	const out = new Array(n);
	for (let i = 0; i < n; i++) out[i] = {
		...base,
		c0: ramp(at(i)),
		c1: ramp(at(i + 1))
	};
	return out;
}
/** Is this source a continuous RAMP (safe to index fractionally), rather than a
*  discrete per-segment list or callback? */
function rampSource(src) {
	if (typeof src === "function" || Array.isArray(src)) return false;
	if (typeof src === "string") return src === "rainbow";
	return true;
}
/** Each segment's position along the chain, expressed on the same 0..n scale
*  the index uses — so `step` keeps meaning what it meant, and a chain of equal
*  segments resolves to exactly 0, 1, 2 … as it always did. */
function arcIndex(segs) {
	const n = segs.length;
	const out = new Array(n);
	let total = 0;
	for (let i = 0; i < n; i++) {
		out[i] = total;
		total += Math.hypot(segs[i][1].x - segs[i][0].x, segs[i][1].y - segs[i][0].y);
	}
	if (total < 1e-9) return out.map((_, i) => i);
	for (let i = 0; i < n; i++) out[i] = out[i] / total * n;
	return out;
}
/**
* The translation that realises a shape's `pivot` — where the shape is actually
* drawn, which is what you want for framing a camera on it or hanging something
* off it.
*
* The shader only knows `world = rotate(scale(local)) + T`, with no pivot in
* it. Turning about an arbitrary point is the same transform with a different
* T, so the whole feature lives here and costs nothing per vertex:
*
*   world(p) = R·S·(p − pivot) + pivot + xy  =  R·S·p + (xy + pivot − R·S·pivot)
*
* The pivot itself therefore lands at exactly `(x + pivot.x, y + pivot.y)`,
* which is the point a shatter should burst from.
*/
function shapeOrigin(s) {
	const p = s.pivot;
	if (!p) return {
		x: s.x,
		y: s.y
	};
	const c = Math.cos(s.rot) * s.scale, n = Math.sin(s.rot) * s.scale;
	return {
		x: s.x + p.x - (p.x * c - p.y * n),
		y: s.y + p.y - (p.x * n + p.y * c)
	};
}
/** Resolve a colour source for particle `i`. Pure — shared by both backends. */
function resolveVecColor(src, i) {
	if (typeof src === "function") return src(i);
	if (typeof src === "string") return src === "rainbow" ? hsv(i % 360) : src;
	if (Array.isArray(src)) {
		const a = src;
		return a.length ? a[i % a.length] : "#ffffff";
	}
	const o = src;
	const step = o.step ?? 1;
	if (o.hue) {
		const [lo, hi] = o.hue;
		const span = hi - lo;
		return hsv(lo + span * (span === 0 ? 0 : i * step % Math.abs(span) / Math.abs(span)), o.sat ?? 1, o.val ?? 1);
	}
	const period = Math.max(1, Math.round(360 / Math.max(1e-6, step)));
	const p = i % period / period;
	return lerp(o.from ?? "#ffffff", o.to ?? "#ffffff", p < .5 ? p * 2 : (1 - p) * 2);
}
/** Outline for one particle kind, centred on the origin at RADIUS 1. */
function particleOutline(kind, circleSides = 10) {
	const ring = (n, turn = 0, r = 1) => Array.from({ length: n }, (_, i) => {
		const a = turn + i / n * Math.PI * 2;
		return {
			x: Math.cos(a) * r,
			y: Math.sin(a) * r
		};
	});
	switch (kind) {
		case "line": return [[{
			x: -1,
			y: 0
		}, {
			x: 1,
			y: 0
		}]];
		case "triangle": return polySegs(ring(3, -Math.PI / 2), true);
		case "square": return polySegs(ring(4, Math.PI / 4), true);
		case "diamond": return polySegs(ring(4), true);
		case "cross": return [[{
			x: -1,
			y: 0
		}, {
			x: 1,
			y: 0
		}], [{
			x: 0,
			y: -1
		}, {
			x: 0,
			y: 1
		}]];
		case "star": {
			const out = [];
			const outer = ring(5, -Math.PI / 2);
			const inner = ring(5, -Math.PI / 2 + Math.PI / 5, .42);
			for (let i = 0; i < 5; i++) {
				out.push([outer[i], inner[i]]);
				out.push([inner[i], outer[(i + 1) % 5]]);
			}
			return out;
		}
		default: return polySegs(ring(Math.max(3, circleSides)), true);
	}
}
/** Spawn kinematics for one shattered segment. The fragment transform sits
* ON the segment's world MIDPOINT (x, y) — so its spin turns the piece
* about its own centre, never orbiting the shape origin — and flies along
* the outward unit direction (dirX, dirY) with jitter + spin from `rand`. */
function spawnFragment(x, y, dirX, dirY, opts, rand) {
	const speed = opts.speed ?? 60;
	const jitter = .6 + rand() * .8;
	return {
		x,
		y,
		rot: 0,
		scale: 1,
		vx: dirX * speed * jitter + (rand() - .5) * speed * .3,
		vy: dirY * speed * jitter + (rand() - .5) * speed * .3,
		spin: (rand() - .5) * 2 * (opts.spin ?? 3),
		age: 0,
		life: Math.max(.05, (opts.life ?? 1.2) * (.7 + rand() * .6))
	};
}
/** Advance one fragment; returns false once expired. Pure — dist-tested. */
function stepFragment(f, dt, drag = .4) {
	f.age += dt;
	if (f.age >= f.life) return false;
	const damp = Math.max(0, 1 - drag * dt);
	f.vx *= damp;
	f.vy *= damp;
	f.x += f.vx * dt;
	f.y += f.vy * dt;
	f.rot += f.spin * dt;
	return true;
}
/** Fragment alpha over age: hold, then fade the last 40%. */
function fragmentAlpha(age, life) {
	const t = Math.min(1, age / Math.max(1e-5, life));
	return t < .6 ? 1 : 1 - (t - .6) / .4;
}
/**
* A STARFIELD — the backdrop every game in this canon has, and the one thing
* all of ours were hand-rolling.
*
* Two modes off one object. `'drift'` scrolls a flat parallax field in any
* direction; `'warp'` flies into the screen down a projected tunnel. Both are
* fully live: `speed`, `angle`, `origin`, `bend`, `spin`, `streak`, `size`,
* `glow` and `color` are plain properties, so a ship that accelerates, banks
* or jumps to lightspeed is a few assignments and no rebuild.
*
* ```ts
* const sky = game.vector.starfield({ count: 300, speed: 60, angle: Math.PI });
* sky.speed = 60 + throttle * 900;              // accelerate
* sky.angle += turn * dt;                       // bank
*
* const tunnel = game.vector.starfield({ mode: 'warp', speed: 320, streak: 0.05 });
* tunnel.bend = (t, time) => ({ x: Math.sin(time * 1.2 + t * 4) * 300 * t, y: 0 });
* ```
*
* `stars` is the raw array, so anything the built-ins do not cover you can do
* by hand — and `each` runs a callback over every star each step if you would
* rather not write the loop.
*/
var VecStarfield = class {
	host;
	mode;
	bounds;
	speed;
	angle;
	origin;
	focal;
	near;
	far;
	bend;
	spin;
	size;
	streak;
	color;
	colors;
	glow;
	z;
	dead = false;
	/** Every star, live. Move them, cull them, sort them — it is just an array. */
	stars = [];
	/** Run over every star each step, after the built-in motion and before the
	*  draw. The escape hatch for anything the options do not express. */
	each = null;
	/** @internal Per-star colour, resolved at (re)spawn rather than per frame. */
	tints = [];
	/** @internal A RING of past SCREEN positions per star, `STREAK_CAP` deep —
	*  what makes a streak a trail rather than an extrapolation. Screen space, so
	*  a point stays where it was painted even when the projection moves under
	*  it, which is the whole point: turn, and the tails curve. */
	hist = /* @__PURE__ */ new Float32Array(0);
	/** @internal Newest slot in the ring, shared by every star. */
	head = 0;
	/** @internal How old each ring slot is, in seconds. Shared too — samples are
	*  taken for the whole field at once. This is what keeps a tail the same
	*  LENGTH at any frame rate: below the sample rate the clock cannot keep up
	*  and records one position per frame instead, spaced further apart, so the
	*  ribbon has to stop at `streak` seconds' worth rather than at a fixed
	*  count of samples. */
	ages = new Float32Array(STREAK_CAP);
	/** @internal Stars whose history is stale (just spawned or just wrapped) and
	*  must be refilled from their current position, or the ribbon draws a streak
	*  across the whole screen from wherever they used to be. */
	fresh = /* @__PURE__ */ new Uint8Array(0);
	/** @internal Time since the last sample, and whether one is due this frame. */
	tick = 0;
	sampling = false;
	/** @internal Ring slot holding the OLDEST still-live sample — the far end of
	*  every tail. Shared, because the ages are. */
	tailIdx = 0;
	/** @internal How many recorded positions this tail is worth. Derived from
	*  its length rather than exposed: one sample per ~1/60 s of tail keeps a
	*  long trail smooth and a short one cheap, and there is no sensible reason
	*  a game would want to choose a different number. */
	get steps() {
		return Math.max(2, Math.min(STREAK_CAP, Math.round(this.streak * 60)));
	}
	/** @internal */ _layers;
	/**
	* DRIFT parallax layers — see the option. Assign any time; the field
	* re-layers on the spot.
	*/
	get layers() {
		return this._layers;
	}
	set layers(n) {
		const v = Math.max(0, Math.round(n));
		if (v === this._layers) return;
		this._layers = v;
		for (let i = 0; i < this.stars.length; i++) this.stars[i].z = this.layerOf(i);
	}
	/** @internal The normalised depth of the layer star `i` belongs to. Stars are
	*  dealt round the layers by index, so the split is even and a star keeps its
	*  layer when it recycles. */
	layerOf(i) {
		return this._layers > 1 ? i % this._layers / (this._layers - 1) : 0;
	}
	/** @internal Stars are placed LAZILY. A field is almost always built during
	*  setup, before the first frame, when the layer has no view rect yet — and
	*  laying out against a zero-sized rect puts every star at the origin and
	*  makes the drift wrap divide by zero. */
	filled = false;
	/** @internal Accumulated roll, seconds, and a reused style object. */
	roll = 0;
	time = 0;
	scratch = {};
	rng;
	/** @internal */
	constructor(host, o = {}) {
		this.host = host;
		this.mode = o.mode ?? "drift";
		this.bounds = o.bounds ?? null;
		this.speed = o.speed ?? 60;
		this.angle = o.angle ?? 0;
		this._layers = Math.max(0, Math.round(o.layers ?? 4));
		this.origin = o.origin ?? null;
		this.focal = o.focal ?? 260;
		this.near = Math.max(.001, o.near ?? 12);
		this.far = Math.max(this.near + 1, o.far ?? 900);
		this.bend = o.bend ?? null;
		this.spin = o.spin ?? 0;
		this.size = o.size ?? 2.2;
		this.streak = o.streak ?? 0;
		this.color = o.color ?? "#ffffff";
		this.colors = o.colors ?? null;
		this.glow = o.glow ?? .5;
		this.z = o.z;
		this.rng = o.rng ?? Math.random;
		this.resize(Math.max(0, Math.round(o.count ?? 240)));
	}
	/** @internal Is there a rectangle worth laying out against yet? */
	get ready() {
		const r = this.rect;
		return r.w > 0 && r.h > 0;
	}
	/** The rectangle in play — the explicit `bounds`, else the live view. */
	get rect() {
		return this.bounds ?? this.host.viewRect;
	}
	/** Grow or shrink the field, keeping the stars already placed. */
	resize(count) {
		while (this.stars.length > count) {
			this.stars.pop();
			this.tints.pop();
		}
		while (this.stars.length < count) {
			const s = {
				x: 0,
				y: 0,
				z: 0
			};
			this.stars.push(s);
			this.tints.push(this.color);
			if (this.filled) this.place(s, this.stars.length - 1, true);
			else this.filled = false;
		}
		if (this.hist.length !== this.stars.length * STREAK_CAP * 2) {
			this.hist = new Float32Array(this.stars.length * STREAK_CAP * 2);
			this.fresh = new Uint8Array(this.stars.length).fill(1);
		}
		if (!this.filled) this.reset();
	}
	/** Re-scatter every star — a new level, a jump, a different sky. */
	reset() {
		if (!this.ready) {
			this.filled = false;
			return;
		}
		for (let i = 0; i < this.stars.length; i++) this.place(this.stars[i], i, true);
		this.filled = true;
	}
	/** @internal Is star `i`'s whole ribbon — head AND the far end of its tail —
	*  outside the rect? Culling on the head alone makes a long tail vanish the
	*  instant the star itself leaves, which is very visible at the edges. */
	gone(i, px, py, r, m) {
		const out = (x, y) => x < r.x - m || x > r.x + r.w + m || y < r.y - m || y > r.y + r.h + m;
		if (!out(px, py)) return false;
		if (this.streak <= 0 || this.fresh[i]) return true;
		const base = i * STREAK_CAP * 2;
		return out(this.hist[base + this.tailIdx * 2], this.hist[base + this.tailIdx * 2 + 1]);
	}
	/** @internal Record the newest screen position for star `i`, and refill the
	*  whole ring when its history is stale so the ribbon starts as a point. */
	track(i, px, py) {
		const base = i * STREAK_CAP * 2;
		if (this.fresh[i]) {
			for (let k = 0; k < STREAK_CAP; k++) {
				this.hist[base + k * 2] = px;
				this.hist[base + k * 2 + 1] = py;
			}
			this.fresh[i] = 0;
		} else if (this.sampling) {
			this.hist[base + this.head * 2] = px;
			this.hist[base + this.head * 2 + 1] = py;
		}
	}
	/** @internal Put one star somewhere valid. `anywhere` spreads it through the
	*  whole volume (initial fill); otherwise it enters at the far edge. */
	place(s, i, anywhere) {
		const r = this.rect;
		if (this.mode === "warp") {
			s.z = anywhere ? this.near + this.rng() * (this.far - this.near) : this.speed >= 0 ? this.far : this.near;
			const k = s.z / this.focal;
			s.x = (this.rng() * 2 - 1) * (r.w * .5) * k;
			s.y = (this.rng() * 2 - 1) * (r.h * .5) * k;
		} else {
			s.x = r.x + this.rng() * r.w;
			s.y = r.y + this.rng() * r.h;
			s.z = this.layerOf(i);
		}
		this.tints[i] = this.colors ? resolveVecColor(this.colors, i) : this.color;
		if (this.fresh.length > i) this.fresh[i] = 1;
	}
	step(dt) {
		if (this.dead || dt <= 0) return;
		if (!this.filled) {
			this.reset();
			if (!this.filled) return;
		}
		this.time += dt;
		this.sampling = false;
		if (this.streak > 0) {
			for (let k = 0; k < STREAK_CAP; k++) this.ages[k] += dt;
			const interval = this.streak / this.steps;
			this.tick += dt;
			if (this.tick >= interval) {
				this.tick = interval > 0 ? this.tick % interval : 0;
				this.head = (this.head + 1) % STREAK_CAP;
				this.ages[this.head] = 0;
				this.sampling = true;
			}
			this.tailIdx = this.head;
			for (let q = 1; q < this.steps; q++) {
				const idx = (this.head - q + STREAK_CAP) % STREAK_CAP;
				if (this.ages[idx] > this.streak) break;
				this.tailIdx = idx;
			}
		}
		if (this.streak <= 0) this.tailIdx = this.head;
		this.roll += this.spin * dt;
		const stars = this.stars;
		if (this.mode === "warp") {
			const span = this.far - this.near;
			for (let i = 0; i < stars.length; i++) {
				const s = stars[i];
				s.z -= this.speed * dt;
				if (s.z < this.near) {
					this.place(s, i, false);
					s.z = this.far - (this.near - s.z) % span;
				} else if (s.z > this.far) {
					this.place(s, i, false);
					s.z = this.near + (s.z - this.far) % span;
				}
			}
		} else {
			const r = this.rect;
			if (r.w <= 0 || r.h <= 0) return;
			const dx = Math.cos(this.angle), dy = Math.sin(this.angle);
			const sgn = Math.sign(this.speed) || 1;
			const ex = dx * sgn, ey = dy * sgn;
			const ax = Math.abs(ex), ay = Math.abs(ey);
			for (let i = 0; i < stars.length; i++) {
				const s = stars[i];
				const v = this.speed * (1 - LAYER_FALLOFF * s.z);
				s.x += dx * v * dt;
				s.y += dy * v * dt;
				if (this.gone(i, s.x, s.y, r, 2)) {
					if (this.rng() * (ax + ay) < ax) {
						s.x = ex > 0 ? r.x - 1 : r.x + r.w + 1;
						s.y = r.y + this.rng() * r.h;
					} else {
						s.y = ey > 0 ? r.y - 1 : r.y + r.h + 1;
						s.x = r.x + this.rng() * r.w;
					}
					this.fresh[i] = 1;
				}
			}
		}
		if (this.each) for (const s of stars) this.each(s, dt, this);
	}
	/** @internal Draw one star's tail through its RECORDED positions, tapering
	*  and fading toward the oldest. Because these are where the star actually
	*  WAS, a turn leaves a curve painted into the screen — extrapolating from
	*  the current heading instead swings the whole tail round with the ship,
	*  which is the thing that does not look like a trail. */
	ribbon(i, px, py, st) {
		const w0 = st.width, a0 = st.alpha;
		const n = this.steps;
		const base = i * STREAK_CAP * 2;
		let hx = px, hy = py, age = 0;
		for (let q = 1; q <= n; q++) {
			const idx = (this.head - (q - 1) + STREAK_CAP) % STREAK_CAP;
			const next = this.ages[idx];
			if (next > this.streak) break;
			const tx = this.hist[base + idx * 2], ty = this.hist[base + idx * 2 + 1];
			this.taper(w0, a0, (age + next) * .5 / this.streak, st);
			this.host.seg(tx, ty, hx, hy, st);
			hx = tx;
			hy = ty;
			age = next;
		}
	}
	/** @internal Width and alpha part-way down a tail — `t` is 0 at the head and
	*  1 at the far end, where both reach nothing. Written into the shared style
	*  object, so a whole field's tails cost no allocation. */
	taper(w, a, t, st) {
		st.width = Math.max(.25, w * (1 - t));
		st.alpha = Math.max(0, a * (1 - t));
	}
	/** @internal The bend offset at depth fraction `t`. */
	bendAt(t) {
		const b = this.bend;
		if (!b) return ZERO_BEND;
		return typeof b === "function" ? b(t, this.time) : {
			x: b.x * t * t,
			y: b.y * t * t
		};
	}
	/** @internal */
	emit() {
		if (this.dead || !this.filled || this.stars.length === 0) return;
		const st = this.scratch;
		st.glow = this.glow;
		st.z = this.z;
		st.alpha = 1;
		const r = this.rect;
		const m = 8;
		if (this.mode === "warp") {
			const ox = this.origin ? this.origin.x : r.x + r.w / 2;
			const oy = this.origin ? this.origin.y : r.y + r.h / 2;
			const span = this.far - this.near;
			const cr = Math.cos(this.roll), sr = Math.sin(this.roll);
			for (let i = 0; i < this.stars.length; i++) {
				const s = this.stars[i];
				const rx = s.x * cr - s.y * sr, ry = s.x * sr + s.y * cr;
				const t = (s.z - this.near) / span;
				const k = this.focal / s.z;
				const bend = this.bendAt(t);
				const px = ox + rx * k + bend.x, py = oy + ry * k + bend.y;
				if (this.gone(i, px, py, r, m)) {
					this.place(s, i, false);
					continue;
				}
				const near = 1 - t;
				st.width = Math.max(.6, this.size * (.3 + near * .7));
				st.color = this.tints[i];
				st.alpha = .35 + near * .65;
				if (this.streak > 0) {
					this.track(i, px, py);
					this.ribbon(i, px, py, st);
				} else this.host.seg(px, py, px, py, st);
			}
			return;
		}
		for (let i = 0; i < this.stars.length; i++) {
			const s = this.stars[i];
			const near = 1 - s.z;
			const px = s.x, py = s.y;
			st.width = Math.max(.35, this.size * (.3 + near * .7));
			st.color = this.tints[i];
			st.alpha = .3 + near * .7;
			if (this.streak > 0) {
				this.track(i, px, py);
				this.ribbon(i, px, py, st);
			} else this.host.seg(px, py, px, py, st);
		}
	}
	/** Remove the field from the layer. */
	kill() {
		this.dead = true;
	}
};
var ZERO_BEND = {
	x: 0,
	y: 0
};
/** How many past positions a streak can remember. */
var STREAK_CAP = 16;
/** How much slower the FARTHEST drift layer runs than the nearest. Derived
*  from the layer count rather than exposed: what a game wants to say is "four
*  layers", not "four layers spread over 0.8 of a speed range". At 0.8 the back
*  layer crawls at a fifth of the front, which separates them clearly without
*  the far sky looking frozen. */
var LAYER_FALLOFF = .8;
/**
* A ribbon that follows a moving point, tapering and fading toward its tail.
*
* ```ts
* const wake = game.vector.trail({ length: 40, width: 4, color: '#41d6ff', tailColor: '#ff2d95' });
* wake.push(ship.x, ship.y);        // once a frame; the layer draws it
* wake.kill();                      // when the ship dies
* ```
*
* The layer draws every live trail for you, so there is no per-frame draw call
* to forget. Samples are dropped by `length`, by `life`, or both.
*/
var VecTrail = class {
	host;
	/** Live-tunable — change any of these between frames. */
	length;
	minDist;
	maxDist;
	life;
	width;
	tailWidth;
	alpha;
	tailAlpha;
	color;
	tailColor;
	colors;
	glow;
	dwell;
	z;
	dead = false;
	/** @internal Newest LAST. Ages run in step with it. */
	pts = [];
	ages = [];
	/** @internal One style object, rewritten per segment — packStyle copies out
	*  of it, so there is no garbage per segment per frame. */
	scratch = {};
	/** @internal */
	constructor(host, o = {}) {
		this.host = host;
		this.length = Math.max(2, o.length ?? 32);
		this.minDist = o.minDist ?? 4;
		this.maxDist = o.maxDist ?? 0;
		this.life = o.life ?? 0;
		this.width = o.width ?? 3;
		this.tailWidth = o.tailWidth ?? 0;
		this.alpha = o.alpha ?? 1;
		this.tailAlpha = o.tailAlpha ?? 0;
		this.color = o.color ?? "#ffffff";
		this.tailColor = o.tailColor ?? null;
		this.colors = o.colors ?? null;
		this.glow = o.glow ?? .7;
		this.dwell = o.dwell ?? 0;
		this.z = o.z;
	}
	/** How many samples the trail is currently holding. */
	get count() {
		return this.pts.length;
	}
	/** The samples, oldest first — read-only. */
	get points() {
		return this.pts;
	}
	/**
	* Add a sample. Call once a frame with the thing's position; a move shorter
	* than `minDist` is folded into the head rather than added, so standing
	* still does not eat the buffer.
	*/
	push(x, y) {
		const head = this.pts[this.pts.length - 1];
		if (head) {
			const d = Math.hypot(x - head.x, y - head.y);
			if (d < this.minDist) {
				head.x = x;
				head.y = y;
				this.ages[this.ages.length - 1] = 0;
				return;
			}
			if (this.maxDist > 0 && d > this.maxDist) {
				const steps = Math.min(64, Math.ceil(d / this.maxDist));
				for (let k = 1; k <= steps; k++) {
					const f = k / steps;
					this.add(head.x + (x - head.x) * f, head.y + (y - head.y) * f);
				}
				return;
			}
		}
		this.add(x, y);
	}
	/** @internal One sample, with the length cap applied. */
	add(x, y) {
		this.pts.push({
			x,
			y
		});
		this.ages.push(0);
		while (this.pts.length > this.length) {
			this.pts.shift();
			this.ages.shift();
		}
	}
	/** Drop every sample — a teleport, so the ribbon doesn't smear across it. */
	clear() {
		this.pts.length = 0;
		this.ages.length = 0;
	}
	/** Stop drawing this trail and let the layer forget it. */
	kill() {
		this.dead = true;
	}
	/** @internal Age samples out when `life` is set. */
	step(dt) {
		if (this.life <= 0) return;
		for (let i = 0; i < this.ages.length; i++) this.ages[i] += dt;
		let drop = 0;
		while (drop < this.ages.length && this.ages[drop] > this.life) drop++;
		if (drop > 0) {
			this.pts.splice(0, drop);
			this.ages.splice(0, drop);
		}
	}
	/** @internal Push the ribbon into the layer as per-segment lines. */
	emit() {
		const n = this.pts.length;
		if (n < 2) return;
		const cum = new Array(n);
		cum[0] = 0;
		for (let i = 1; i < n; i++) {
			const a = this.pts[i - 1], b = this.pts[i];
			cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y);
		}
		const total = cum[n - 1];
		const at = (i) => total > 1e-9 ? cum[i] / total : i / (n - 1);
		const st = this.scratch;
		st.z = this.z;
		st.dwell = this.dwell;
		for (let i = 0; i < n - 1; i++) {
			const t0 = at(i), t1 = at(i + 1);
			const tm = (t0 + t1) / 2;
			st.width = this.tailWidth + (this.width - this.tailWidth) * tm;
			st.alpha = this.tailAlpha + (this.alpha - this.tailAlpha) * tm;
			st.glow = this.glow * tm;
			if (this.colors) {
				st.color = resolveVecColor(this.colors, i);
				st.color2 = void 0;
			} else if (this.tailColor) {
				st.color = lerp(this.tailColor, this.color, t0);
				st.color2 = lerp(this.tailColor, this.color, t1);
			} else {
				st.color = this.color;
				st.color2 = void 0;
			}
			const a = this.pts[i], b = this.pts[i + 1];
			this.host.seg(a.x, a.y, b.x, b.y, st);
		}
	}
};
/**
* Triangulate an outline into fill vertices — `[x, y, r, g, b, a]` per vertex,
* three per triangle — with the gradient resolved PER VERTEX at pack time.
*
* `VectorShape` calls this for you; it is exported because it is pure and
* testable, and because it is the honest description of what a fill costs:
* one ear-clip when the outline changes, then nothing at runtime.
*
* An unparseable, `'transparent'`, `'none'` or zero-alpha colour yields no
* vertices at all — that is how "no fill" is spelled.
*/
function buildFill(points, fill) {
	if (!fill || points.length < 3) return [];
	const spec = typeof fill === "string" ? { color: fill } : Array.isArray(fill) ? {
		color: fill[0] ?? "",
		stops: fill
	} : fill;
	const raw = spec.stops?.length ? spec.stops : spec.color && spec.to ? [spec.color, spec.to] : [spec.color ?? ""];
	if (!raw[0] || raw[0] === "transparent" || raw[0] === "none") return [];
	const stops = raw.map((c) => rgba(c));
	if (stops.every((c) => c[3] <= 0)) return [];
	let at;
	let fan = null;
	if (spec.radial) {
		let cx = 0, cy = 0;
		for (const p of points) {
			cx += p.x;
			cy += p.y;
		}
		cx /= points.length;
		cy /= points.length;
		let max = 0;
		for (const p of points) max = Math.max(max, Math.hypot(p.x - cx, p.y - cy));
		at = (p) => max > 1e-9 ? Math.hypot(p.x - cx, p.y - cy) / max : 0;
		if (isConvex(points)) fan = {
			x: cx,
			y: cy
		};
	} else {
		const a = spec.angle ?? 0;
		const ax = Math.cos(a), ay = Math.sin(a);
		let lo = Infinity, hi = -Infinity;
		for (const p of points) {
			const t = p.x * ax + p.y * ay;
			if (t < lo) lo = t;
			if (t > hi) hi = t;
		}
		const span = hi - lo;
		at = (p) => span > 1e-9 ? (p.x * ax + p.y * ay - lo) / span : 0;
	}
	const last = stops.length - 1;
	const sample = (t, ch) => {
		if (last === 0) return stops[0][ch];
		const f = Math.max(0, Math.min(1, t)) * last;
		const i = Math.min(last - 1, Math.floor(f));
		const k = f - i;
		return stops[i][ch] + (stops[i + 1][ch] - stops[i][ch]) * k;
	};
	const out = [];
	const push = (p) => {
		const t = at(p);
		out.push(p.x, p.y, sample(t, 0), sample(t, 1), sample(t, 2), sample(t, 3));
	};
	if (fan) {
		const K = Math.max(2, stops.length);
		const ring = (k, i) => {
			const f = k / (K - 1);
			return {
				x: fan.x + (points[i].x - fan.x) * f,
				y: fan.y + (points[i].y - fan.y) * f
			};
		};
		const n = points.length;
		for (let k = 0; k < K - 1; k++) for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;
			if (k === 0) {
				push(fan);
				push(ring(1, i));
				push(ring(1, j));
			} else {
				push(ring(k, i));
				push(ring(k + 1, i));
				push(ring(k + 1, j));
				push(ring(k, i));
				push(ring(k + 1, j));
				push(ring(k, j));
			}
		}
	} else for (const [i, j, k] of triangulate(points)) {
		push(points[i]);
		push(points[j]);
		push(points[k]);
	}
	return out;
}
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
/** A retained line shape: segments under one live transform. Mutate
* x/y/rot/scale/alpha/glowMul freely — the per-frame cost is 8 floats. */
var VectorShape = class {
	x;
	y;
	rot;
	scale;
	/** Whole-shape alpha multiplier (fade without touching colours). */
	alpha = 1;
	/** Whole-shape halo multiplier (pump the glow on hits). */
	glowMul = 1;
	/** @see VectorShapeOptions.wrap — set or clear it at any time. */
	wrap;
	/** @see VectorShapeOptions.pivot — set or clear it at any time; it is read
	*  per frame, so nothing re-packs. */
	pivot;
	dead = false;
	/** @see VectorShapeOptions.fill — assign at any time; re-packs next frame. */
	get fill() {
		return this.rawFill;
	}
	set fill(f) {
		this.rawFill = f;
		this.retriangulate();
		this.layer.dirty = true;
	}
	/** @internal */ rawFill = null;
	/** @internal The outline's own points — the fill needs them, the segment
	*  pairs alone cannot be triangulated. */
	points = [];
	/** @internal Triangulated fill vertices: [x, y, r, g, b, a] per vertex. */
	fillVerts = [];
	/** @internal */ segs;
	/** @internal Bisector cut planes, 4 floats per segment — see chainJoins. */
	joins;
	/** @internal */ style;
	/** @internal Per-segment styles when `colors` is set — see segmentStyles. */
	segStyles = null;
	/** @internal */ raw;
	/** @internal */ layer;
	constructor(layer, points, opts) {
		this.layer = layer;
		this.x = opts.x ?? 0;
		this.y = opts.y ?? 0;
		this.rot = opts.rot ?? 0;
		this.scale = opts.scale ?? 1;
		this.segs = polySegs(points, opts.closed ?? true);
		this.joins = chainJoins(points, opts.closed ?? true);
		this.points = points.map((p) => ({
			x: p.x,
			y: p.y
		}));
		this.wrap = opts.wrap ?? null;
		this.pivot = opts.pivot ?? null;
		this.raw = { ...opts };
		this.style = packStyle(this.raw);
		this.segStyles = segmentStyles(this.raw, this.segs);
		this.rawFill = opts.fill ?? null;
		this.retriangulate();
	}
	/** @internal Rebuild the filled face. Runs on construction, on setPoints and
	*  when `fill` is assigned — never per frame. */
	retriangulate() {
		this.fillVerts = buildFill(this.points, this.rawFill);
	}
	/** True when this shape contributes a solid face. */
	get filled() {
		return this.fillVerts.length > 0;
	}
	/** Merge new style fields (width/color/glow/dash/…) — hit flashes, retro
	* width toggles. Re-packs on the next frame. */
	restyle(style) {
		Object.assign(this.raw, style);
		this.style = packStyle(this.raw);
		this.segStyles = segmentStyles(this.raw, this.segs);
		this.layer.dirty = true;
	}
	/** Replace the outline (deformable terrain: splice + set). Re-packs only
	* on the next flush. */
	setPoints(points, closed = true) {
		this.segs = polySegs(points, closed);
		this.joins = chainJoins(points, closed);
		this.points = points.map((p) => ({
			x: p.x,
			y: p.y
		}));
		this.segStyles = segmentStyles(this.raw, this.segs);
		this.retriangulate();
		this.layer.dirty = true;
	}
	/** Explode the outline: every segment flies off on its own transform with
	* outward velocity + spin, fading over `life`. The shape itself dies. */
	shatter(opts = {}) {
		this.layer.shatterShape(this, opts);
	}
	kill() {
		if (this.dead) return;
		this.dead = true;
		this.layer.dirty = true;
	}
};
var VectorLayer = class {
	format;
	/** @internal Static (retained) data needs re-packing. */
	dirty = false;
	/**
	* Clip the WHOLE layer to a world-space rectangle — a radar scope, a
	* Battlezone viewport, a split screen, Tempest's tube mouth. `null` (the
	* default) draws everywhere.
	*
	* ```ts
	* game.vector.clip = { x: 40, y: 40, w: 320, h: 320 };
	* ```
	*
	* It is a scissor on the whole layer draw, not per shape — the layer is one
	* pass, and that is the level at which clipping is free. The GLOW STAMP is
	* scissored with it, so halos are cut at the same edge instead of leaking
	* out of the window (which is what makes it look like a window at all).
	*
	* `d.pushClip` does NOT reach the vector layer; this is its clip.
	*/
	clip = null;
	shapes = [];
	fragments = [];
	trails = [];
	/** @internal Registered starfields, stepped and drawn with the trails. */
	fields = [];
	/**
	* @internal How many of this frame's immediate instances are BACKDROP —
	* starfields, which emit before anything else.
	*
	* Immediate pushes normally draw after the retained shapes, and lines test
	* depth without writing it, so line-over-line is pure submission order: a
	* starfield would paint straight over every ship and rock in the scene. A
	* backdrop is the one thing in the layer that is defined by being behind, so
	* its span of the dynamic buffer is drawn first, before the static pass.
	*/
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
	/**
	* SOLID FACES on or off. `null` (the default) is AUTO — the pass runs only
	* when at least one live shape actually has a fill, so a pure line-art game
	* never pays for it. `true`/`false` force it.
	*/
	fills = null;
	staticData = new Float32Array(1024 * 24);
	staticCount = 0;
	/** Fill vertices: opaque ones first (they write depth), then translucent. */
	fillData = new Float32Array(1024 * 8);
	fillOpaque = 0;
	fillBlend = 0;
	dynData = new Float32Array(1024 * 24);
	dynCount = 0;
	dynGlow = 0;
	xformData = new Float32Array(256 * 8);
	uniformData = /* @__PURE__ */ new Float32Array(4);
	device;
	pipeline;
	stampPipeline;
	layout;
	uniforms;
	staticBuf;
	dynBuf;
	fillBuf;
	fillBind;
	fillPipeline;
	fillBlendPipeline;
	xformBuf;
	staticBind;
	dynBind;
	constructor(device, format) {
		this.format = format;
		this.rebuild(device);
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
	/**
	* A TRAIL — the ribbon a moving thing leaves behind.
	*
	* ```ts
	* const wake = game.vector.trail({ length: 40, width: 4, color: '#41d6ff', tailColor: '#ff2d95' });
	* wake.push(ship.x, ship.y);          // once a frame, and that is all
	* ```
	*
	* The layer ages and draws every live trail itself, so there is no per-frame
	* draw call to forget. `kill()` when the thing making it dies.
	*
	* This is what replaced full-screen phosphor feedback. Feedback smeared the
	* whole image and blew out anything that stood still; a trail is geometry
	* owned by one object, so it tapers, grades, and leaves nothing behind
	* something that is not moving.
	*/
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
	/** @internal */
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
	/** Advance fragments and trails (Game ticks this). */
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
	/** How wide the widest live glow stamp is (0 = nothing glows) — Game
	* wakes the shared GlowPass with it. Valid after prepare(). */
	glowSize = 0;
	/**
	* Upload everything for this frame: repack static data if dirty, pack the
	* live transform table, upload the dynamic pushes, and measure the glow.
	* Game calls this BEFORE the GlowPass renders (the stamps draw there).
	*/
	prepare() {
		for (const f of this.fields) if (!f.dead) f.emit();
		this.backdropCount = this.dynCount;
		for (const t of this.trails) if (!t.dead) t.emit();
		if (this.dirty) {
			this.shapes = this.shapes.filter((s) => !s.dead);
			this.repackStatic();
			this.dirty = false;
		}
		let slots = 1 + this.fragments.length;
		for (const s of this.shapes) slots += s.wrap ? 4 : 1;
		if (slots * 8 > this.xformData.length) {
			this.xformData = new Float32Array(ceilPow2(slots) * 8);
			this.xformBuf.destroy();
			this.xformBuf = this.device.createBuffer({
				size: this.xformData.byteLength,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
			this.makeBinds();
		}
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
		this.device.queue.writeBuffer(this.xformBuf, 0, x.buffer, 0, slots * 8 * 4);
		this.device.queue.writeBuffer(this.uniforms, 0, this.uniformData);
		if (this.dynCount > 0) this.device.queue.writeBuffer(this.dynBuf, 0, this.dynData.buffer, 0, this.dynCount * 24 * 4);
		let g = 0;
		for (const s of this.shapes) if (s.style.glow > 0 && s.glowMul > 0) g = Math.max(g, s.style.stampHalf * Math.min(2, s.glowMul));
		for (const f of this.fragments) if (f.style.glow > 0 && f.glowMul > 0) g = Math.max(g, f.style.stampHalf * Math.min(2, f.glowMul));
		if (this.dynGlow > 0) g = Math.max(g, this.dynGlow);
		this.glowSize = g;
	}
	/**
	* Draw the crisp scene lines (static + dynamic, two draws max).
	*
	* `pxW`/`pxH` are the target's pixel size — needed only to turn `clip` into
	* a scissor; omit them and clipping is skipped.
	*/
	draw(pass, pxW = 0, pxH = 0) {
		const sc = this.scissorFor(pxW, pxH);
		if (sc === "empty") return;
		if (sc) pass.setScissorRect(sc.x, sc.y, sc.w, sc.h);
		if (this.fillsOn) {
			if (this.fillOpaque > 0) {
				pass.setPipeline(this.fillPipeline);
				pass.setBindGroup(0, this.fillBind);
				pass.draw(this.fillOpaque);
			}
			if (this.fillBlend > 0) {
				pass.setPipeline(this.fillBlendPipeline);
				pass.setBindGroup(0, this.fillBind);
				pass.draw(this.fillBlend, 1, this.fillOpaque);
			}
		}
		if (this.backdropCount > 0) {
			pass.setPipeline(this.pipeline);
			pass.setBindGroup(0, this.dynBind);
			pass.draw(4, this.backdropCount);
		}
		if (this.staticCount > 0) {
			pass.setPipeline(this.pipeline);
			pass.setBindGroup(0, this.staticBind);
			pass.draw(4, this.staticCount);
		}
		if (this.dynCount > this.backdropCount) {
			pass.setPipeline(this.pipeline);
			pass.setBindGroup(0, this.dynBind);
			pass.draw(4, this.dynCount - this.backdropCount, 0, this.backdropCount);
		}
		if (sc) pass.setScissorRect(0, 0, pxW, pxH);
	}
	/** @internal The pixel scissor for `clip`, or null when there is nothing to
	*  clip, or 'empty' when the rect is entirely off-target. */
	scissorFor(pxW, pxH) {
		if (!this.clip || pxW <= 0 || pxH <= 0) return null;
		const u = this.uniformData;
		return clipToScissor(this.clip, u[0], u[1], u[2], u[3], pxW, pxH) ?? "empty";
	}
	/** Draw the soft glow stamps into the GlowPass's half-res target pass
	* (Game hands this as the extra-stamps callback). Zero-glow segments
	* contribute nothing (brightness multiplies to 0). */
	stampGlow(pass, pxW = 0, pxH = 0) {
		const sc = this.scissorFor(pxW, pxH);
		if (sc === "empty") return;
		if (sc) pass.setScissorRect(sc.x, sc.y, sc.w, sc.h);
		if (this.staticCount > 0) {
			pass.setPipeline(this.stampPipeline);
			pass.setBindGroup(0, this.staticBind);
			pass.draw(4, this.staticCount);
		}
		if (this.dynCount > 0) {
			pass.setPipeline(this.stampPipeline);
			pass.setBindGroup(0, this.dynBind);
			pass.draw(4, this.dynCount);
		}
		if (sc) pass.setScissorRect(0, 0, pxW, pxH);
	}
	/** Kill everything (scene teardown). */
	clear() {
		this.shapes = [];
		this.fragments = [];
		this.trails = [];
		this.fields = [];
		this.dirty = true;
	}
	/** (Re)create GPU objects — device-loss recovery. */
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
				visibility: BITS.STAGE_VERTEX,
				buffer: { type: "read-only-storage" }
			}
		] });
		const module = shaderModule(device, buildLineWGSL(false), "VectorLayer");
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
		const stampModule = shaderModule(device, buildLineWGSL(true), "VectorLayer stamp");
		this.stampPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
			vertex: {
				module: stampModule,
				entryPoint: "vs"
			},
			fragment: {
				module: stampModule,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend: {
						color: {
							operation: "max",
							srcFactor: "one",
							dstFactor: "one"
						},
						alpha: {
							operation: "max",
							srcFactor: "one",
							dstFactor: "one"
						}
					}
				}]
			},
			primitive: { topology: "triangle-strip" }
		});
		const fillModule = shaderModule(device, buildFillWGSL(), "VectorLayer fill");
		const fillTargets = [{
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
		}];
		const fillLayout = device.createPipelineLayout({ bindGroupLayouts: [this.layout] });
		this.fillPipeline = device.createRenderPipeline({
			layout: fillLayout,
			vertex: {
				module: fillModule,
				entryPoint: "vs"
			},
			fragment: {
				module: fillModule,
				entryPoint: "fs",
				targets: fillTargets
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			primitive: { topology: "triangle-list" }
		});
		this.fillBlendPipeline = device.createRenderPipeline({
			layout: fillLayout,
			vertex: {
				module: fillModule,
				entryPoint: "vs"
			},
			fragment: {
				module: fillModule,
				entryPoint: "fs",
				targets: fillTargets
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: false,
				depthCompare: "less-equal"
			},
			primitive: { topology: "triangle-list" }
		});
		this.uniforms = device.createBuffer({
			size: 16,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.fillBuf = device.createBuffer({
			size: this.fillData.byteLength,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.staticBuf = device.createBuffer({
			size: this.staticData.byteLength,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.dynBuf = device.createBuffer({
			size: this.dynData.byteLength,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.xformBuf = device.createBuffer({
			size: this.xformData.byteLength,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.makeBinds();
		this.dirty = true;
	}
	makeBinds() {
		const mk = (buf) => this.device.createBindGroup({
			layout: this.layout,
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
					resource: { buffer: this.xformBuf }
				}
			]
		});
		this.staticBind = mk(this.staticBuf);
		this.dynBind = mk(this.dynBuf);
		this.fillBind = mk(this.fillBuf);
	}
	pushDyn(x0, y0, x1, y1, p, slot, j, ji = 0) {
		if ((this.dynCount + 1) * 24 > this.dynData.length) {
			const next = new Float32Array(this.dynData.length * 2);
			next.set(this.dynData);
			this.dynData = next;
			this.dynBuf.destroy();
			this.dynBuf = this.device.createBuffer({
				size: this.dynData.byteLength,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
			this.makeBinds();
		}
		writeSeg(this.dynData, this.dynCount * 24, x0, y0, x1, y1, p, slot, j, ji);
		this.dynCount++;
	}
	/** @internal Are solid faces on this frame? `fills` overrides the auto-check. */
	get fillsOn() {
		if (this.fills !== null) return this.fills;
		for (const s of this.shapes) if (!s.dead && s.filled) return true;
		return false;
	}
	/**
	* @internal Pack every filled shape's triangles. OPAQUE faces go first and
	* write depth (they are the occluders); translucent ones follow and do not,
	* because a see-through face that still stamped depth would punch a hole in
	* everything behind it.
	*/
	repackFills() {
		const live = this.shapes.filter((s) => !s.dead && s.filled);
		let n = 0;
		for (const s of live) n += s.fillVerts.length / 6 * (s.wrap ? 4 : 1);
		if (n * 8 > this.fillData.length) {
			this.fillData = new Float32Array(ceilPow2(n) * 8);
			this.fillBuf.destroy();
			this.fillBuf = this.device.createBuffer({
				size: this.fillData.byteLength,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
			this.makeBinds();
		}
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
		if (i > 0) this.device.queue.writeBuffer(this.fillBuf, 0, d.buffer, 0, i * 8 * 4);
	}
	/** @internal Shape → its first transform slot, so fills and lines agree. */
	slotOf = /* @__PURE__ */ new Map();
	repackStatic() {
		let n = 0;
		for (const s of this.shapes) n += s.segs.length * (s.wrap ? 4 : 1);
		for (const f of this.fragments) n += f.segs.length;
		if (n * 24 > this.staticData.length) {
			this.staticData = new Float32Array(ceilPow2(n) * 24);
			this.staticBuf.destroy();
			this.staticBuf = this.device.createBuffer({
				size: this.staticData.byteLength,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
			this.makeBinds();
		}
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
		if (i > 0) this.device.queue.writeBuffer(this.staticBuf, 0, this.staticData.buffer, 0, i * 24 * 4);
		this.repackFills();
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
//#region src/lib/visibility2d.ts
var EPS = 1e-9;
/**
* A set of 2D occluders you query for visibility and line-of-sight. Add
* scenery as segments / rects / polygons (and a world `bounds`), then call
* `visibility(x, y)` for the lit polygon or `canSee` / `raycast` for detection.
* Add/remove occluders freely between frames — there's no bake.
*
* ```ts
* const vis = new Visibility2d();
* vis.setBounds(0, 0, worldW, worldH);          // rays terminate at the edges
* for (const c of crates) vis.addRect(c.x, c.y, c.w, c.h);
* const poly = vis.visibility(light.x, light.y, light.radius);   // lit-area polygon → render it
* if (vis.canSee(guard.x, guard.y, player.x, player.y)) alert();  // line-of-sight
* ```
*/
var Visibility2d = class {
	/** The occluder segments (excludes the world bounds — those live separately). */
	segments = [];
	bx = 0;
	by = 0;
	bw = 0;
	bh = 0;
	hasBounds = false;
	constructor(bounds) {
		if (bounds) this.setBounds(bounds.x, bounds.y, bounds.w, bounds.h);
	}
	/** Set the world rectangle — rays that hit no occluder stop at these edges
	*  (so `visibility` always closes into a polygon). */
	setBounds(x, y, w, h) {
		this.bx = x;
		this.by = y;
		this.bw = w;
		this.bh = h;
		this.hasBounds = true;
	}
	/** Add one occluder segment; returns it (mutate or keep a reference). */
	addSegment(x1, y1, x2, y2) {
		const s = {
			x1,
			y1,
			x2,
			y2
		};
		this.segments.push(s);
		return s;
	}
	/** Add a box occluder (its four edges). */
	addRect(x, y, w, h) {
		this.addSegment(x, y, x + w, y);
		this.addSegment(x + w, y, x + w, y + h);
		this.addSegment(x + w, y + h, x, y + h);
		this.addSegment(x, y + h, x, y);
	}
	/** Add a polygon occluder from points (`[{x,y}…]` or flat `[x,y,…]`). Closed
	*  by default (the last point links back to the first). */
	addPoly(points, closed = true) {
		const pts = typeof points[0] === "number" ? Array.from({ length: points.length / 2 }, (_, i) => ({
			x: points[i * 2],
			y: points[i * 2 + 1]
		})) : points;
		for (let i = 0; i < pts.length - 1; i++) this.addSegment(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
		if (closed && pts.length > 2) this.addSegment(pts[pts.length - 1].x, pts[pts.length - 1].y, pts[0].x, pts[0].y);
	}
	/** Remove all occluders (bounds are kept). */
	clear() {
		this.segments.length = 0;
	}
	/** @internal Visit every occluder segment plus the four bounds edges. */
	_forEach(cb) {
		for (const s of this.segments) cb(s.x1, s.y1, s.x2, s.y2);
		if (this.hasBounds) {
			const { bx, by, bw, bh } = this;
			cb(bx, by, bx + bw, by);
			cb(bx + bw, by, bx + bw, by + bh);
			cb(bx + bw, by + bh, bx, by + bh);
			cb(bx, by + bh, bx, by);
		}
	}
	/**
	* The visibility polygon from `(lx, ly)` — the ordered fan of points bounding
	* the lit area, with hard shadows behind occluders. Clamped to `maxDist` (the
	* light radius) when given. Render it as a triangle fan from the light, or
	* read it for custom shading. Empty only if there's no geometry to hit.
	*/
	visibility(lx, ly, maxDist = Infinity) {
		const segs = [];
		const far = maxDist;
		for (const s of this.segments) {
			if (far < Infinity && (Math.max(s.x1, s.x2) < lx - far || Math.min(s.x1, s.x2) > lx + far || Math.max(s.y1, s.y2) < ly - far || Math.min(s.y1, s.y2) > ly + far)) continue;
			segs.push(s.x1, s.y1, s.x2, s.y2);
		}
		if (this.hasBounds) {
			const { bx, by, bw, bh } = this;
			segs.push(bx, by, bx + bw, by, bx + bw, by, bx + bw, by + bh, bx + bw, by + bh, bx, by + bh, bx, by + bh, bx, by);
		}
		const angles = [];
		for (let i = 0; i < segs.length; i += 4) {
			const a1 = Math.atan2(segs[i + 1] - ly, segs[i] - lx);
			const a2 = Math.atan2(segs[i + 3] - ly, segs[i + 2] - lx);
			angles.push(a1 - 5e-5, a1, a1 + 5e-5, a2 - 5e-5, a2, a2 + 5e-5);
		}
		const hits = [];
		for (const a of angles) {
			const dx = Math.cos(a), dy = Math.sin(a);
			let best = maxDist;
			let found = maxDist < Infinity;
			for (let i = 0; i < segs.length; i += 4) {
				const t = raySegT(lx, ly, dx, dy, segs[i], segs[i + 1], segs[i + 2], segs[i + 3]);
				if (t !== null && t < best) {
					best = t;
					found = true;
				}
			}
			if (found) hits.push({
				a,
				x: lx + dx * best,
				y: ly + dy * best
			});
		}
		hits.sort((p, q) => p.a - q.a);
		return hits.map((h) => ({
			x: h.x,
			y: h.y
		}));
	}
	/**
	* Direct line-of-sight — `true` if no occluder segment crosses the line from
	* `(ax,ay)` to `(bx,by)`. The AI "can the guard see the player?" test; pass
	* `maxDist` to cap the range. Ignores the world bounds (they enclose, not block).
	*/
	canSee(ax, ay, bx, by, maxDist = Infinity) {
		const dx = bx - ax, dy = by - ay;
		if (dx * dx + dy * dy > maxDist * maxDist) return false;
		for (const s of this.segments) if (segCross(ax, ay, bx, by, s.x1, s.y1, s.x2, s.y2)) return false;
		return true;
	}
	/**
	* The first occluder (or bounds) a ray hits from `(ox,oy)` heading
	* `(dirX,dirY)`. Returns `{x, y, dist}` or `null` if nothing is hit within
	* `maxDist`. Direction need not be normalised.
	*/
	raycast(ox, oy, dirX, dirY, maxDist = Infinity) {
		const len = Math.hypot(dirX, dirY) || 1;
		const dx = dirX / len, dy = dirY / len;
		let best = maxDist;
		let hit = false;
		this._forEach((x1, y1, x2, y2) => {
			const t = raySegT(ox, oy, dx, dy, x1, y1, x2, y2);
			if (t !== null && t < best) {
				best = t;
				hit = true;
			}
		});
		return hit ? {
			x: ox + dx * best,
			y: oy + dy * best,
			dist: best
		} : null;
	}
};
/** Distance along a normalised ray `(ox,oy)+t·(dx,dy)` to segment `(x1,y1)-(x2,y2)`,
*  or `null` if it misses. */
function raySegT(ox, oy, dx, dy, x1, y1, x2, y2) {
	const sx = x2 - x1, sy = y2 - y1;
	const denom = dx * sy - dy * sx;
	if (Math.abs(denom) < EPS) return null;
	const t2 = ((x1 - ox) * dy - (y1 - oy) * dx) / denom;
	if (t2 < 0 || t2 > 1) return null;
	const t1 = ((x1 - ox) * sy - (y1 - oy) * sx) / denom;
	return t1 >= 0 ? t1 : null;
}
/** Do segments `a-b` and `c-d` cross? */
function segCross(ax, ay, bx, by, cx, cy, dx, dy) {
	const r_px = bx - ax, r_py = by - ay;
	const s_px = dx - cx, s_py = dy - cy;
	const denom = r_px * s_py - r_py * s_px;
	if (Math.abs(denom) < EPS) return false;
	const t = ((cx - ax) * s_py - (cy - ay) * s_px) / denom;
	const u = ((cx - ax) * r_py - (cy - ay) * r_px) / denom;
	return t > EPS && t < 1 - EPS && u > EPS && u < 1 - EPS;
}
//#endregion
//#region src/lib/effects.ts
var MAX_EFFECT_PARAMS = 8;
/** Splice an EffectDef into the full-screen post template → complete WGSL. */
function buildEffectWGSL(def) {
	const names = Object.keys(def.params ?? {});
	if (names.length > 8) throw new Error(`effect '${def.name}': max 8 params`);
	return `
struct U { res: vec4f, p0: vec4f, p1: vec4f }   // res: xy = size, z = time
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

fn tex(p: vec2f) -> vec4f {
  return textureSample(src, samp, clamp(p, vec2f(0.0), vec2f(1.0)));
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let uv = in.uv;
  let time = u.res.z;
  let texel = vec2f(1.0) / u.res.xy;
${names.map((n, i) => `  let ${n} = u.${i < 4 ? "p0" : "p1"}.${"xyzw"[i % 4]};`).join("\n")}
  var color = tex(uv);
  {
${def.code}
  }
  return color;
}
`;
}
/** Ordered default values for an effect's uniform slots (p0.x … p1.w). */
function effectDefaults(def) {
	const out = new Array(8).fill(0);
	Object.values(def.params ?? {}).forEach((v, i) => {
		out[i] = v;
	});
	return out;
}
/** Slot index of a named param (for PostHandle.set). -1 if unknown. */
function effectParamIndex(def, name) {
	return Object.keys(def.params ?? {}).indexOf(name);
}
var EFFECTS = {
	/** Chunky pixels: snap sampling to a screen-space grid. 5-tap weighted
	* (centre + 4 corners — the Phaser 4 recipe): blocks average their cell
	* instead of hard-picking one point, so edges inside a block soften. */
	pixelate: {
		name: "pixelate",
		params: { size: 4 },
		code: `
    let px = max(1.0, size);
    let centre = px * floor(uv * u.res.xy / px) + px * 0.5;
    color = tex(centre / u.res.xy) * 0.4
      + tex((centre + px * vec2f(-0.5, -0.5)) / u.res.xy) * 0.15
      + tex((centre + px * vec2f( 0.5, -0.5)) / u.res.xy) * 0.15
      + tex((centre + px * vec2f( 0.5,  0.5)) / u.res.xy) * 0.15
      + tex((centre + px * vec2f(-0.5,  0.5)) / u.res.xy) * 0.15;`
	},
	/** Darkened corners. */
	vignette: {
		name: "vignette",
		params: { strength: .45 },
		code: `
    let c = uv * 2.0 - 1.0;
    color = vec4f(color.rgb * (1.0 - strength * dot(c, c) * 0.7), color.a);`
	},
	/** One-pass bloom: bright areas leak light (glows, neon, magic). */
	bloom: {
		name: "bloom",
		params: {
			threshold: .55,
			strength: .9,
			radius: 2.5
		},
		code: `
    // Soft additive bloom: pixels above threshold bleed into a halo. Two
    // concentric rings of 8 taps (16 total), staggered per ring and GAUSSIAN-
    // weighted so the outer taps fade out. Dense + weighted means a small
    // bright orb spreads into a smooth glow instead of dropping a discrete
    // ghost copy at each tap (the old sparse 12-tap kernel did exactly that --
    // visible plus/box ghosts around tiny bright sources). The /wsum*2.0
    // normalisation preserves the old brightness on a uniform bright region
    // for any tap count, so ring count is a pure cost/spread knob.
    var glow = vec3f(0.0);
    var wsum = 0.0;
    for (var ring = 1u; ring <= 2u; ring++) {
      let rad = f32(ring) * radius * texel;
      let w = exp(-f32(ring * ring) * 0.28);
      for (var k = 0u; k < 8u; k++) {
        let ang = (f32(k) + f32(ring) * 0.5) * 0.7853982;   // 2pi/8, ring-staggered
        let s = tex(uv + vec2f(cos(ang), sin(ang)) * rad).rgb;
        glow += max(vec3f(0.0), s - vec3f(threshold)) * w;
        wsum += w;
      }
    }
    color = vec4f(color.rgb + glow / wsum * strength * 2.0, color.a);`
	}
};
var EFFECT_PACK = {
	/** CRT: barrel curvature + scanlines + vignette, black outside the tube. */
	crt: {
		name: "crt",
		params: {
			curve: .12,
			scan: .25,
			vig: .35
		},
		code: `
    let c = uv * 2.0 - 1.0;
    let r2 = dot(c, c);
    let cuv = (c * (1.0 + curve * r2) + 1.0) * 0.5;
    color = tex(cuv);
    let sl = 1.0 - scan * (0.5 + 0.5 * sin(cuv.y * u.res.y * 3.14159));
    var rgb = color.rgb * sl * (1.0 - vig * r2);
    let inside = step(0.0, cuv.x) * step(cuv.x, 1.0) * step(0.0, cuv.y) * step(cuv.y, 1.0);
    color = vec4f(rgb * inside, color.a);`
	},
	/** Plain scanlines (no distortion). */
	scanlines: {
		name: "scanlines",
		params: {
			strength: .3,
			size: 2
		},
		code: `
    let row = floor(uv.y * u.res.y / max(1.0, size));
    let k = 1.0 - strength * f32(u32(row) % 2u);
    color = vec4f(color.rgb * k, color.a);`
	},
	/** Quantize colours to N levels — poster / cel look. */
	posterize: {
		name: "posterize",
		params: { levels: 5 },
		code: `
    let n = max(2.0, levels);
    color = vec4f(floor(color.rgb * n + vec3f(0.5)) / n, color.a);`
	},
	/** Desaturate (amount 0..1). */
	grayscale: {
		name: "grayscale",
		params: { amount: 1 },
		code: `
    let g = dot(color.rgb, vec3f(0.299, 0.587, 0.114));
    color = vec4f(mix(color.rgb, vec3f(g), clamp(amount, 0.0, 1.0)), color.a);`
	},
	/** Underwater wobble. */
	wave: {
		name: "wave",
		params: {
			amp: .004,
			freq: 18,
			speed: 2
		},
		code: `
    let w = vec2f(sin(uv.y * freq + time * speed), cos(uv.x * freq * 0.8 + time * speed)) * amp;
    color = tex(uv + w);`
	},
	/** Chromatic aberration — RGB fringing that grows toward the edges. */
	chroma: {
		name: "chroma",
		params: { shift: 8 },
		code: `
    let off = uv - vec2f(0.5);
    let d = off * (0.5 + dot(off, off) * 3.0) * shift * texel;
    color = vec4f(tex(uv + d).r, color.g, tex(uv - d).b, color.a);`
	}
};
//#endregion
//#region src/lib/post.ts
/** A live effect in the chain — retune or remove it at any time. */
var PostHandle = class {
	def;
	data;
	chain;
	/** @internal */
	constructor(def, data, chain) {
		this.def = def;
		this.data = data;
		this.chain = chain;
	}
	/** Update a parameter (by the name declared in the effect). */
	set(param, value) {
		const i = effectParamIndex(this.def, param);
		if (i >= 0) this.data[4 + i] = value;
		return this;
	}
	/** Remove this effect from the chain. */
	remove() {
		this.chain.drop(this);
	}
};
var PostChain = class {
	format;
	passes = [];
	pipelines = /* @__PURE__ */ new Map();
	layout;
	sampler;
	device;
	targets = null;
	constructor(device, format) {
		this.format = format;
		this.rebuild(device);
	}
	/** Any effects active? (Game skips the offscreen path entirely when not.) */
	get active() {
		return this.passes.length > 0;
	}
	/** Append an effect (built-in name or a custom EffectDef — the MCP-block path). */
	add(effect, params) {
		const def = typeof effect === "string" ? EFFECTS[effect] : effect;
		if (!def) throw new Error(`unknown post effect '${String(effect)}' — built-ins: ${Object.keys(EFFECTS).join(", ")}`);
		const data = /* @__PURE__ */ new Float32Array(12);
		data.set(effectDefaults(def), 4);
		const handle = new PostHandle(def, data, this);
		for (const [k, v] of Object.entries(params ?? {})) handle.set(k, v);
		this.passes.push({
			handle,
			pipeline: this.pipelineFor(def),
			uniforms: this.device.createBuffer({
				size: data.byteLength,
				usage: BITS.UNIFORM | BITS.COPY_DST
			})
		});
		return handle;
	}
	/** @internal */
	drop(handle) {
		const i = this.passes.findIndex((p) => p.handle === handle);
		if (i >= 0) {
			this.passes[i].uniforms.destroy();
			this.passes.splice(i, 1);
		}
	}
	/** Remove every effect. */
	clear() {
		for (const p of this.passes) p.uniforms.destroy();
		this.passes = [];
	}
	/** The offscreen view the world should render into this frame. */
	sceneView(width, height) {
		if (!this.targets || this.targets[0].width !== width || this.targets[0].height !== height) {
			this.targets?.forEach((t) => t.destroy());
			const make = () => this.device.createTexture({
				size: {
					width,
					height
				},
				format: this.format,
				usage: BITS.RENDER_ATTACHMENT | BITS.TEXTURE_BINDING
			});
			this.targets = [make(), make()];
		}
		return this.targets[0].createView();
	}
	/** Run every pass; the last one lands on `dst` (the swapchain). */
	run(encoder, dst, time) {
		if (!this.targets) return;
		let src = 0;
		this.passes.forEach((p, i) => {
			const last = i === this.passes.length - 1;
			p.handle.data[0] = this.targets[src].width;
			p.handle.data[1] = this.targets[src].height;
			p.handle.data[2] = time;
			this.device.queue.writeBuffer(p.uniforms, 0, p.handle.data);
			const bind = this.device.createBindGroup({
				layout: this.layout,
				entries: [
					{
						binding: 0,
						resource: { buffer: p.uniforms }
					},
					{
						binding: 1,
						resource: this.sampler
					},
					{
						binding: 2,
						resource: this.targets[src].createView()
					}
				]
			});
			const pass = encoder.beginRenderPass({ colorAttachments: [{
				view: last ? dst : this.targets[1 - src].createView(),
				loadOp: "clear",
				clearValue: {
					r: 0,
					g: 0,
					b: 0,
					a: 1
				},
				storeOp: "store"
			}] });
			pass.setPipeline(p.pipeline);
			pass.setBindGroup(0, bind);
			pass.draw(3);
			pass.end();
			src = 1 - src;
		});
	}
	/** (Re)create GPU objects — the device-loss recovery path. */
	rebuild(device) {
		this.device = device;
		this.pipelines.clear();
		this.targets = null;
		this.sampler = device.createSampler({
			magFilter: "linear",
			minFilter: "linear"
		});
		this.layout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
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
		this.passes = this.passes.map((p) => ({
			handle: p.handle,
			pipeline: this.pipelineFor(p.handle.def),
			uniforms: device.createBuffer({
				size: p.handle.data.byteLength,
				usage: BITS.UNIFORM | BITS.COPY_DST
			})
		}));
	}
	pipelineFor(def) {
		let pipeline = this.pipelines.get(def.name);
		if (pipeline) return pipeline;
		const module = this.device.createShaderModule({ code: buildEffectWGSL(def) });
		module.getCompilationInfo().then((info) => {
			for (const m of info.messages) if (m.type === "error") console.error(`post '${def.name}' WGSL ${m.lineNum}:${m.linePos} ${m.message}`);
		});
		pipeline = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
			vertex: {
				module,
				entryPoint: "vs"
			},
			fragment: {
				module,
				entryPoint: "fs",
				targets: [{ format: this.format }]
			},
			primitive: { topology: "triangle-list" }
		});
		this.pipelines.set(def.name, pipeline);
		return pipeline;
	}
};
/**
* THE POST CHAIN — full-screen effects applied OVER the finished frame:
* `game.post.add('bloom')`, `game.post.clear()`. Built-ins by name
* ('pixelate', 'vignette', 'bloom', 'crt', 'scanlines', 'posterize',
* 'grayscale', 'wave', 'chroma') or a custom EffectDef (the block path).
*
* NOT particles — a fire/smoke/spark EFFECT IN the world is `game.fx`.
*/
var PostLayer = class {
	chain;
	/** @internal Built by `Game` — reach it as `game.post`, never construct one. */
	constructor(chain) {
		this.chain = chain;
	}
	/**
	* Add an effect to the chain (applied in add order). Returns a handle:
	* `.set(param, value)` to retune live, `.remove()` to drop just this one.
	*/
	add(effect, params) {
		return this.chain().add(effect, params);
	}
	/** Remove every post effect. */
	clear() {
		this.chain().clear();
	}
};
//#endregion
//#region src/lib/backdrop.ts
/** Pure WGSL assembly (headless-testable). */
function buildBackdropWGSL(def) {
	const names = Object.keys(def.params ?? {});
	if (names.length > 8) throw new Error(`backdrop '${def.name}': max 8 params`);
	return `
const TAU = 6.28318530718;
struct U { res: vec4f, view: vec4f, p0: vec4f, p1: vec4f, c0: vec4f, c1: vec4f }
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var bgTex: texture_2d<f32>;
@group(0) @binding(2) var bgSamp: sampler;
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

fn hash21(p: vec2f) -> f32 {
  var q = fract(p * vec2f(123.34, 456.21));
  q += dot(q, q + 45.32);
  return fract(q.x * q.y);
}

fn noise2(p: vec2f) -> f32 {
  let i = floor(p);
  let f = fract(p);
  let s = f * f * (3.0 - 2.0 * f);
  let a = hash21(i);
  let b = hash21(i + vec2f(1.0, 0.0));
  let c = hash21(i + vec2f(0.0, 1.0));
  let d = hash21(i + vec2f(1.0, 1.0));
  return mix(mix(a, b, s.x), mix(c, d, s.x), s.y);
}

fn fbm2(p: vec2f) -> f32 {
  var v = 0.0;
  var amp = 0.5;
  var q = p;
  for (var i = 0u; i < 4u; i++) {
    v += noise2(q) * amp;
    q = q * 2.03 + vec2f(17.0, 9.0);
    amp *= 0.5;
  }
  return v;
}

// Sample the background image at a 0..1 coordinate (y DOWN, matching uv). Returns
// transparent black when no background is set (u.res.w is the has-background flag).
fn bgAt(p: vec2f) -> vec4f {
  if (u.res.w < 0.5) { return vec4f(0.0, 0.0, 0.0, 0.0); }
  return textureSampleLevel(bgTex, bgSamp, p, 0.0);
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let uv = in.uv;
  let px = uv * u.res.xy;
  let time = u.res.z;
  let view = u.view;
  let c0 = u.c0;
  let c1 = u.c1;
  let bg = bgAt(uv);
${names.map((n, i) => `  let ${n} = u.${i < 4 ? "p0" : "p1"}.${"xyzw"[i % 4]};`).join("\n")}
  var color = vec4f(0.0, 0.0, 0.0, 1.0);
  {
${def.code}
  }
  return vec4f(color.rgb * color.a, color.a);   // premultiplied out
}
`;
}
var BACKDROPS = {
	/** Vertical two-colour gradient sky with a tunable curve. */
	sky: {
		name: "sky",
		params: { curve: 1 },
		colors: {
			top: "#0b0e1a",
			bottom: "#2a3f6e"
		},
		code: `
    color = vec4f(mix(c0.rgb, c1.rgb, pow(clamp(uv.y, 0.0, 1.0), max(curve, 0.01))), 1.0);`
	},
	/** Three-layer parallax starfield with twinkle — camera-aware (view.xy). */
	stars: {
		name: "stars",
		params: {
			density: 1,
			twinkle: 1,
			drift: 0
		},
		colors: { tint: "#ffffff" },
		code: `
    var acc = 0.0;
    for (var l = 0u; l < 3u; l++) {
      let fl = f32(l);
      let cell = 26.0 - fl * 7.0;                       // nearer layers: sparser, bigger
      let par = 0.15 + fl * 0.25;                       // nearer layers drift more
      let p = (px + view.xy * par + vec2f(time * drift * (fl + 1.0) * 8.0, 0.0)) / cell;
      let id = floor(p);
      let rnd = hash21(id + fl * 91.7);
      let keep = step(1.0 - 0.12 * density, rnd);       // a fraction of cells hold a star
      let centre = vec2f(hash21(id + 3.1), hash21(id + 7.7));
      let d = length(fract(p) - centre);
      let core = smoothstep(0.14 + 0.08 * fl, 0.0, d);
      // Twinkle needs its OWN hash: rnd survives the keep threshold, so it
      // only spans [1-0.12*density, 1] — phase and frequency derived from
      // it are nearly identical and EVERY star fades in unison (Rich:
      // "looks nuts"). Real stars mostly hold steady; a subset glints.
      let twr = hash21(id + 13.7 + fl * 5.3);
      let tw = 0.9 + 0.1 * sin(time * (0.4 + twr * 1.2) * twinkle + twr * TAU * 7.0);
      let glint = step(0.72, twr) * pow(max(sin(time * (0.5 + twr * 1.3) * twinkle + twr * 47.0), 0.0), 24.0) * 0.7;
      acc += keep * core * (tw + glint) * (0.45 + 0.55 * rnd);
    }
    color = vec4f(c0.rgb * acc, acc);`
	}
};
var BACKDROP_PACK = {
	/** Curtains of polar light waving across the upper sky. */
	aurora: {
		name: "aurora",
		params: {
			amount: 1,
			speed: 1
		},
		colors: {
			a: "#37ff9e",
			b: "#7a5cff"
		},
		code: `
    var acc = vec3f(0.0);
    for (var i = 0u; i < 3u; i++) {
      let fi = f32(i);
      let wave = sin(uv.x * (4.0 + fi * 2.3) + time * speed * (0.35 + fi * 0.2) + fi * 2.1)
               * (0.08 + 0.04 * fi);
      let band = 0.22 + fi * 0.15 + wave;
      let d = abs(uv.y - band);
      let glow = exp(-d * (26.0 - fi * 6.0)) * (0.8 - fi * 0.2);
      let sway = 0.5 + 0.5 * sin(uv.x * 3.0 - time * speed * 0.5 + fi);
      acc += mix(c0.rgb, c1.rgb, sway) * glow;
    }
    let a = clamp(acc.g * 1.4, 0.0, 1.0) * amount;
    color = vec4f(acc * amount, a);`
	},
	/** Slow fbm nebula clouds between two tints — stack 'stars' over it. */
	nebula: {
		name: "nebula",
		params: {
			scale: 3,
			speed: .02
		},
		colors: {
			a: "#1a1440",
			b: "#8a3a6e"
		},
		code: `
    let p = uv * scale + view.xy * 0.0004 + vec2f(time * speed, 0.0);
    let n = fbm2(p);
    let m = fbm2(p * 1.8 + n * 2.2);
    let cloud = smoothstep(0.25, 0.85, n * 0.6 + m * 0.5);
    color = vec4f(mix(c0.rgb, c1.rgb, m) * cloud + c0.rgb * 0.25, 1.0);`
	},
	/** Low sun over haze bands — a classic synth sunset. */
	sunset: {
		name: "sunset",
		params: {
			sunY: .62,
			sunSize: .16
		},
		colors: {
			sky: "#2a1445",
			sun: "#ff9a3d"
		},
		code: `
    let grad = mix(c0.rgb, c1.rgb * 0.55, pow(clamp(uv.y, 0.0, 1.0), 1.6));
    let ar = u.res.x / max(u.res.y, 1.0);
    let d = length(vec2f((uv.x - 0.5) * ar, uv.y - sunY));
    var sun = smoothstep(sunSize, sunSize * 0.92, d);
    // haze bands slice the lower half of the disc
    let band = step(0.5, fract(uv.y * 70.0 + time * 0.4)) * step(sunY, uv.y);
    sun *= 1.0 - band * 0.85;
    let halo = exp(-d * 5.0) * 0.35;
    color = vec4f(grad + c1.rgb * (sun + halo), 1.0);`
	}
};
/**
* Fullscreen blit that draws the background image (opaque) beneath the backdrop
* layers, so overlay backdrops composite over the real pixels and read-effects can
* also sample them via `bg` / `bgAt(uv)`.
*/
var BG_BLIT_WGSL = `
struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }
@group(0) @binding(0) var t: texture_2d<f32>;
@group(0) @binding(1) var s: sampler;
@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  var o: VSOut;
  let x = f32((vi << 1u) & 2u);
  let y = f32(vi & 2u);
  o.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  o.uv = vec2f(x, y);
  return o;
}
@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  return vec4f(textureSampleLevel(t, s, in.uv, 0.0).rgb, 1.0);
}
`;
/** A live backdrop layer — retune (`set`/`setColor`) or `remove()` it. */
var BackdropHandle = class {
	def;
	data;
	chain;
	/** @internal */
	constructor(def, data, chain) {
		this.def = def;
		this.data = data;
		this.chain = chain;
	}
	/** Update a scalar parameter (by the name declared in the def). */
	set(param, value) {
		const i = effectParamIndex(this.def, param);
		if (i >= 0) this.data[8 + i] = value;
		return this;
	}
	/** Update a colour slot (by the name declared in the def). */
	setColor(name, hex) {
		const i = Object.keys(this.def.colors ?? {}).indexOf(name);
		if (i >= 0) this.data.set(rgba(hex), 16 + i * 4);
		return this;
	}
	/** Remove this backdrop layer. */
	remove() {
		this.chain.drop(this);
	}
};
/**
* All active backdrop layers. Drawn first in the frame — into the 3D pass
* when a world exists (behind the meshes), else into the scene pass —
* with pipelines cached per (def, sampleCount). Device-loss rebuildable.
*/
var BackdropChain = class {
	format;
	layers = [];
	pipelines = /* @__PURE__ */ new Map();
	layout;
	device;
	sampler;
	defaultTex;
	bgTex = null;
	hasBg = false;
	bgLayout;
	bgPipelines = /* @__PURE__ */ new Map();
	bgBind = null;
	bgBindTex = null;
	constructor(device, format) {
		this.format = format;
		this.rebuild(device);
	}
	/**
	* Set (or clear, with null) the background image the backdrops render OVER. It is
	* drawn beneath the layers (so overlays composite over the real pixels) and is
	* sampleable inside a snippet via `bg` / `bgAt(uv)`. Accepts a GPUTexture or any
	* canvas / image / bitmap (uploaded to a texture).
	*/
	setBackground(source) {
		if (!source) {
			this.bgTex = null;
			this.hasBg = false;
		} else if (source instanceof GPUTexture) {
			this.bgTex = source;
			this.hasBg = true;
		} else {
			this.bgTex = textureFromCanvas(this.device, source);
			this.hasBg = true;
		}
		this.bgBind = null;
		for (const l of this.layers) l.binds.clear();
	}
	/** Anything to draw? (Game skips the frame + draw entirely when not.) True when
	*  there are layers, or a background image is set (drawn even with no layer over it). */
	get active() {
		return this.layers.length > 0 || this.hasBg;
	}
	/** Append a layer (built-in name or a custom BackdropDef — the block path). */
	add(backdrop, params) {
		const def = typeof backdrop === "string" ? BACKDROPS[backdrop] : backdrop;
		if (!def) throw new Error(`unknown backdrop '${String(backdrop)}' — built-ins: ${Object.keys(BACKDROPS).join(", ")}`);
		const data = /* @__PURE__ */ new Float32Array(24);
		data.set(effectDefaults(def), 8);
		const colors = Object.values(def.colors ?? {});
		data.set(rgba(colors[0] ?? "#ffffff"), 16);
		data.set(rgba(colors[1] ?? "#ffffff"), 20);
		const handle = new BackdropHandle(def, data, this);
		for (const [k, v] of Object.entries(params ?? {})) handle.set(k, v);
		this.layers.push({
			handle,
			uniforms: this.device.createBuffer({
				size: data.byteLength,
				usage: BITS.UNIFORM | BITS.COPY_DST
			}),
			binds: /* @__PURE__ */ new Map()
		});
		return handle;
	}
	/** @internal */
	drop(handle) {
		const i = this.layers.findIndex((l) => l.handle === handle);
		if (i >= 0) {
			this.layers[i].uniforms.destroy();
			this.layers.splice(i, 1);
		}
	}
	/** Remove every layer. */
	clear() {
		for (const l of this.layers) l.uniforms.destroy();
		this.layers = [];
	}
	/** @internal Per-frame uniform upload (before any pass begins). */
	frame(w, h, time, view) {
		for (const l of this.layers) {
			const d = l.handle.data;
			d[0] = w;
			d[1] = h;
			d[2] = time;
			d[3] = this.hasBg ? 1 : 0;
			d[4] = view.x;
			d[5] = view.y;
			d[6] = view.w;
			d[7] = view.h;
			this.device.queue.writeBuffer(l.uniforms, 0, d);
		}
	}
	/** @internal The current background view (a 1x1 transparent default when unset). */
	bgView() {
		return (this.bgTex ?? this.defaultTex).createView();
	}
	/** @internal Draw the background image (if any) then every layer, first thing in an open pass. */
	draw(pass, sampleCount) {
		if (this.hasBg) {
			pass.setPipeline(this.bgPipelineFor(sampleCount));
			if (!this.bgBind || this.bgBindTex !== this.bgTex) {
				this.bgBind = this.device.createBindGroup({
					layout: this.bgLayout,
					entries: [{
						binding: 0,
						resource: this.bgView()
					}, {
						binding: 1,
						resource: this.sampler
					}]
				});
				this.bgBindTex = this.bgTex;
			}
			pass.setBindGroup(0, this.bgBind);
			pass.draw(3);
		}
		for (const l of this.layers) {
			pass.setPipeline(this.pipelineFor(l.handle.def, sampleCount));
			let bind = l.binds.get(sampleCount);
			if (!bind) {
				bind = this.device.createBindGroup({
					layout: this.layout,
					entries: [
						{
							binding: 0,
							resource: { buffer: l.uniforms }
						},
						{
							binding: 1,
							resource: this.bgView()
						},
						{
							binding: 2,
							resource: this.sampler
						}
					]
				});
				l.binds.set(sampleCount, bind);
			}
			pass.setBindGroup(0, bind);
			pass.draw(3);
		}
	}
	/** (Re)create GPU objects — the device-loss recovery path. */
	rebuild(device) {
		this.device = device;
		this.pipelines.clear();
		this.bgPipelines.clear();
		this.bgBind = null;
		this.bgBindTex = null;
		this.layout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_FRAGMENT,
				texture: { sampleType: "float" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: { type: "filtering" }
			}
		] });
		this.bgLayout = device.createBindGroupLayout({ entries: [{
			binding: 0,
			visibility: BITS.STAGE_FRAGMENT,
			texture: { sampleType: "float" }
		}, {
			binding: 1,
			visibility: BITS.STAGE_FRAGMENT,
			sampler: { type: "filtering" }
		}] });
		this.sampler = device.createSampler({
			magFilter: "linear",
			minFilter: "linear",
			addressModeU: "clamp-to-edge",
			addressModeV: "clamp-to-edge"
		});
		this.defaultTex = device.createTexture({
			size: {
				width: 1,
				height: 1
			},
			format: "rgba8unorm",
			usage: 6
		});
		device.queue.writeTexture({ texture: this.defaultTex }, new Uint8Array([
			0,
			0,
			0,
			0
		]), {
			bytesPerRow: 4,
			rowsPerImage: 1
		}, {
			width: 1,
			height: 1
		});
		this.bgTex = null;
		this.hasBg = false;
		this.layers = this.layers.map((l) => ({
			handle: l.handle,
			uniforms: device.createBuffer({
				size: l.handle.data.byteLength,
				usage: BITS.UNIFORM | BITS.COPY_DST
			}),
			binds: /* @__PURE__ */ new Map()
		}));
	}
	bgPipelineFor(sampleCount) {
		let pipeline = this.bgPipelines.get(sampleCount);
		if (pipeline) return pipeline;
		const module = this.device.createShaderModule({ code: BG_BLIT_WGSL });
		pipeline = this.device.createRenderPipeline({
			layout: this.device.createPipelineLayout({ bindGroupLayouts: [this.bgLayout] }),
			vertex: {
				module,
				entryPoint: "vs"
			},
			fragment: {
				module,
				entryPoint: "fs",
				targets: [{ format: this.format }]
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: false,
				depthCompare: "always"
			},
			multisample: sampleCount > 1 ? { count: sampleCount } : void 0,
			primitive: { topology: "triangle-list" }
		});
		this.bgPipelines.set(sampleCount, pipeline);
		return pipeline;
	}
	pipelineFor(def, sampleCount) {
		const key = `${def.name}@${sampleCount}`;
		let pipeline = this.pipelines.get(key);
		if (pipeline) return pipeline;
		const module = this.device.createShaderModule({ code: buildBackdropWGSL(def) });
		module.getCompilationInfo().then((info) => {
			for (const m of info.messages) if (m.type === "error") console.error(`backdrop '${def.name}' WGSL ${m.lineNum}:${m.linePos} ${m.message}`);
		});
		pipeline = this.device.createRenderPipeline({
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
				depthCompare: "always"
			},
			multisample: sampleCount > 1 ? { count: sampleCount } : void 0,
			primitive: { topology: "triangle-list" }
		});
		this.pipelines.set(key, pipeline);
		return pipeline;
	}
};
/**
* THE BACKDROP STACK — full-screen layers drawn BEHIND the world and
* camera-aware (a starfield parallaxes with the view): `game.backdrop.add('stars')`,
* `game.backdrop.clear()`, `game.backdrop.background(img)`. Built-ins by name
* ('sky', 'stars', 'aurora', 'nebula', 'sunset') or a custom BackdropDef.
*
* Behind the world; `game.post` is the twin that draws OVER the finished frame.
*/
var BackdropLayer = class {
	chain;
	/** @internal Built by `Game` — reach it as `game.backdrop`, never construct one. */
	constructor(chain) {
		this.chain = chain;
	}
	/**
	* Add a backdrop layer (layers stack in add order). Returns a handle:
	* `.set(param, v)` / `.setColor(name, hex)` to retune live, `.remove()` to drop.
	*/
	add(backdrop, params) {
		return this.chain().add(backdrop, params);
	}
	/** Remove every backdrop layer. */
	clear() {
		this.chain().clear();
	}
	/**
	* Set (or clear, with null) the BACKGROUND IMAGE the layers render OVER — a
	* game's title art, a level's photo, or (in the Foundry) a checkerboard. It is
	* drawn beneath the backdrop layers and is sampleable inside a snippet via the
	* pre-sampled `bg` (vec4f at the current pixel) or `bgAt(uv)` (sample elsewhere,
	* e.g. for displacement / warp). Accepts a GPUTexture or any canvas / image / bitmap.
	*/
	background(source) {
		this.chain().setBackground(source);
	}
};
//#endregion
//#region src/lib/ui.ts
var STRIDE$1 = 40;
var wgsl$1 = `
struct Inst {
  box: vec4f,
  radii: vec4f,
  colA: vec4u,
  colB: vec4u,
  p0: vec4f,
  p1: vec4f,
  p2: vec4f,
  p3: vec4f,
  p4: vec4f,
  uv: vec4f,
}
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) local: vec4f,                        // xy = position in box-local units, zw = half size
  @location(1) radii: vec4f,
  @location(2) @interpolate(flat) colA: vec4u,
  @location(3) @interpolate(flat) colB: vec4u,
  @location(4) p0: vec4f,
  @location(5) p1: vec4f,
  @location(6) p2: vec4f,
  @location(7) p3: vec4f,
  @location(8) uv: vec4f,
}

@group(0) @binding(0) var<uniform> view: vec4f;      // surface rect: x, y, w, h
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var tex: texture_2d<f32>;

fn unpackRGBA(v: u32) -> vec4f {
  return vec4f(f32(v & 0xffu), f32((v >> 8u) & 0xffu), f32((v >> 16u) & 0xffu), f32((v >> 24u) & 0xffu)) / 255.0;
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  let c01 = vec2f(f32(vi & 1u), f32(vi >> 1u));
  let halfSize = max(d.box.zw, vec2f(0.01));
  // Grow the quad so the drop shadow and the AA feather have somewhere to land
  // (the shadow is drawn by THIS quad, not a second one). Zero-alpha shadows
  // contribute nothing, so an unshadowed panel stays tight.
  let shadowAlpha = f32((d.colB.y >> 24u) & 0xffu);
  let shadowPad = (abs(d.p3.x) + abs(d.p3.y) + d.p2.z + d.p2.w) * step(0.5, shadowAlpha);
  let ext = halfSize + shadowPad + 2.0;
  let local = (c01 - 0.5) * 2.0 * ext;
  let s = sin(d.p4.x);
  let c = cos(d.p4.x);
  let world = d.box.xy + vec2f(local.x * c - local.y * s, local.x * s + local.y * c);
  let ndc = (world - view.xy) / view.zw * 2.0 - 1.0;

  var o: VSOut;
  o.pos = vec4f(ndc.x, -ndc.y, 0.5, 1.0);
  o.local = vec4f(local, halfSize);
  o.radii = d.radii;
  o.colA = d.colA;
  o.colB = d.colB;
  o.p0 = d.p0;
  o.p1 = d.p1;
  o.p2 = d.p2;
  o.p3 = d.p3;
  o.uv = d.uv;
  return o;
}

/** The corner radius governing the quadrant \`p\` falls in. Y is DOWN, so
 *  p.y > 0 is the BOTTOM half. r = (topLeft, topRight, bottomRight, bottomLeft). */
fn pickR(p: vec2f, r: vec4f) -> f32 {
  let bottom = p.y > 0.0;
  return select(select(r.x, r.w, bottom), select(r.y, r.z, bottom), p.x > 0.0);
}

/** Exact signed distance to a rounded box centred on the origin, negative inside. */
fn sdBox(p: vec2f, b: vec2f, rr: f32) -> f32 {
  let r = min(rr, min(b.x, b.y));
  let q = abs(p) - b + r;
  return min(max(q.x, q.y), 0.0) + length(max(q, vec2f(0.0))) - r;
}

/** The SDF's gradient — the OUTWARD surface normal. This is what the bevel
 *  lights: it points straight out through the flat sides and fans smoothly
 *  round the corners, which is exactly the shading a real moulded edge has. */
fn sdNormal(p: vec2f, b: vec2f, rr: f32) -> vec2f {
  let r = min(rr, min(b.x, b.y));
  let q = abs(p) - b + r;
  var g: vec2f;
  if (max(q.x, q.y) > 0.0) {
    let m = max(q, vec2f(0.0));
    let l = length(m);
    g = select(vec2f(0.0, 1.0), m / l, l > 1e-6);   // corner arc
  } else {
    g = select(vec2f(0.0, 1.0), vec2f(1.0, 0.0), q.x > q.y);  // nearest flat side
  }
  // sign() is 0 on the axes, which would kill the normal there — bias to +1.
  let sx = select(-1.0, 1.0, p.x >= 0.0);
  let sy = select(-1.0, 1.0, p.y >= 0.0);
  return g * vec2f(sx, sy);
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let P = in.local.xy;
  let halfSize = in.local.zw;
  let rr = pickR(P, in.radii);
  let d = sdBox(P, halfSize, rr);
  // One screen pixel expressed in box-local units, from the true gradient of
  // the distance itself — correct under rotation, zoom and non-uniform scale.
  let aa = max(fwidth(d), 1e-4);
  let bodyCoverage = clamp(0.5 - d / aa, 0.0, 1.0);
  let inside = -d;                                   // units INSIDE the edge

  let fill0 = unpackRGBA(in.colA.x);
  let fill1 = unpackRGBA(in.colA.y);
  let rim0 = unpackRGBA(in.colA.z);
  let rim1 = unpackRGBA(in.colA.w);
  let glossCol = unpackRGBA(in.colB.x);
  let shadowCol = unpackRGBA(in.colB.y);
  let innerCol = unpackRGBA(in.colB.z);
  let tint = unpackRGBA(in.colB.w);

  // ── Body gradient (0 deg = top→bottom) ──
  let gdir = vec2f(sin(in.p1.x), cos(in.p1.x));
  let t = clamp(0.5 + 0.5 * dot(P / halfSize, gdir), 0.0, 1.0);
  var rgb = mix(fill0.rgb, fill1.rgb, t);
  var bodyAlpha = mix(fill0.a, fill1.a, t);

  // ── Texture hook — inert at texAmount 0 (see the header note) ──
  let t01 = clamp(P / halfSize * 0.5 + vec2f(0.5), vec2f(0.0), vec2f(1.0));
  let texel = textureSample(tex, samp, mix(in.uv.xy, in.uv.zw, t01));
  rgb = mix(rgb, texel.rgb, in.p3.w);

  let n = sdNormal(P, halfSize, rr);
  let toLight = vec2f(sin(in.p0.w), -cos(in.p0.w));  // 0 deg = from above (y down)

  // ── Inner shadow: contact darkening on the side facing AWAY from the light ──
  let isBand = 1.0 - clamp(inside / max(in.p2.y, 1e-4), 0.0, 1.0);
  rgb = mix(rgb, innerCol.rgb,
            isBand * isBand * clamp(dot(n, toLight), 0.0, 1.0) * in.p2.x * innerCol.a);

  // ── Gloss cap: an inset rounded box across the top, faded out downwards ──
  if (in.p1.y > 0.0) {
    let gh = max(in.p1.z * halfSize.y * 2.0, 1e-3);
    let gHalf = max(vec2f(halfSize.x - in.p1.w, gh * 0.5), vec2f(0.5));
    let gCentre = vec2f(0.0, -halfSize.y + in.p1.w + gHalf.y);
    let dg = sdBox(P - gCentre, gHalf, min(rr, gHalf.y));
    let gCover = clamp(0.5 - dg / aa, 0.0, 1.0);
    let fade = 1.0 - clamp((P.y - gCentre.y + gHalf.y) / (gHalf.y * 2.0), 0.0, 1.0);
    rgb = mix(rgb, glossCol.rgb, gCover * fade * fade * in.p1.y * glossCol.a);
  }

  // ── Rim: overwrite the band between the edge and the border width ──
  if (in.p0.x > 0.0) {
    let ring = clamp((d + in.p0.x) / aa + 0.5, 0.0, 1.0);
    let rim = mix(rim0, rim1, t);
    rgb = mix(rgb, rim.rgb, ring * rim.a);
    bodyAlpha = mix(bodyAlpha, rim.a, ring);
  }

  // ── Bevel LAST, so it shades the rim as well as the body — that single
  // choice is what gives the rim its lit top and shaded underside for free. ──
  let bev = 1.0 - clamp(inside / max(in.p0.y, 1e-4), 0.0, 1.0);
  let lit = clamp(dot(n, -toLight) * bev * bev * in.p0.z, -1.0, 1.0);
  rgb = mix(rgb, select(vec3f(0.0), vec3f(1.0), lit > 0.0), abs(lit));

  rgb = rgb * tint.rgb;
  let a = bodyCoverage * bodyAlpha * in.p3.z * tint.a;

  // ── Drop shadow, composited UNDER the body (premultiplied) ──
  var outRgb = rgb * a;
  var outA = a;
  if (shadowCol.a > 0.0) {
    let spread = in.p2.w;
    let dsh = sdBox(P - in.p3.xy, halfSize + spread, rr + spread);
    let sCover = clamp(0.5 - dsh / max(in.p2.z, aa), 0.0, 1.0);
    let s = sCover * sCover * shadowCol.a * in.p3.z;  // squared = a softer knee
    outRgb = rgb * a + shadowCol.rgb * s * (1.0 - a);
    outA = a + s * (1.0 - a);
  }
  return vec4f(outRgb, outA);
}
`;
/**
* The UI panel batch: accumulates every panel pushed this frame into one
* instance buffer and draws them in submission order. Mirrors MsdfRenderer's
* shape (begin / push / flush, one run per texture) so both text and UI behave
* identically under device loss and growth.
*/
var UiRenderer = class {
	format;
	capacity;
	buffer;
	f32;
	u32;
	count = 0;
	/**
	* Contiguous spans sharing a texture AND a clip rect, drawn one at a time.
	* The clip is the whole clipping mechanism: there is no per-instance clip
	* cost, just a scissor set per run — and runs only split where the game
	* actually pushed a clip.
	*/
	runs = [];
	/** The instance buffer uploads once a frame however many layers are flushed. */
	uploaded = false;
	/** Highest layer pushed this frame — how many times the frame must flush. */
	maxLayer = 0;
	/** The surface's submission-order log — see batch.ts's DrawOrder. */
	order = null;
	/** @internal Take part in a surface's submission order. */
	joinOrder(order) {
		this.order = order;
	}
	viewData = /* @__PURE__ */ new Float32Array(4);
	/** Framebuffer size in device pixels — what a normalised clip scales into. */
	targetW = 1;
	targetH = 1;
	device;
	pipeline;
	layout;
	sampler;
	uniforms;
	instances;
	/** The default bound texture: 1×1 white, so an untextured panel samples 1.0. */
	blank;
	binds = /* @__PURE__ */ new Map();
	constructor(device, format, capacity = 512) {
		this.format = format;
		this.capacity = capacity;
		this.buffer = /* @__PURE__ */ new ArrayBuffer(capacity * 40 * 4);
		this.f32 = new Float32Array(this.buffer);
		this.u32 = new Uint32Array(this.buffer);
		this.rebuild(device);
	}
	/** (Re)create every GPU object — the device-loss recovery path. */
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
		const module = device.createShaderModule({ code: wgsl$1 });
		module.getCompilationInfo().then((info) => {
			for (const m of info.messages) if (m.type === "error") console.error(`UI WGSL ${m.lineNum}:${m.linePos} ${m.message}`);
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
			primitive: { topology: "triangle-strip" }
		});
		this.sampler = device.createSampler({
			magFilter: "linear",
			minFilter: "linear"
		});
		this.uniforms = device.createBuffer({
			size: 16,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.instances = device.createBuffer({
			size: this.capacity * 40 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		const blank = device.createTexture({
			size: [1, 1],
			format: "rgba8unorm",
			usage: BITS.TEXTURE_BINDING | 2
		});
		device.queue.writeTexture({ texture: blank }, new Uint8Array([
			255,
			255,
			255,
			255
		]), { bytesPerRow: 4 }, [1, 1]);
		this.blank = blank.createView();
		this.binds.clear();
	}
	/** Forget a texture's cached bind group (device-loss / texture churn). */
	release(view) {
		this.binds.delete(view);
	}
	bindFor(view) {
		let b = this.binds.get(view);
		if (!b) {
			b = this.device.createBindGroup({
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
						resource: view
					}
				]
			});
			this.binds.set(view, b);
		}
		return b;
	}
	/** Start a frame: map the surface rect [x, y, w, h] onto the full canvas.
	*  `targetW/H` are the render target's device-pixel size — clip rects arrive
	*  normalised to the surface and are scaled into it. */
	begin(x, y, w, h, targetW = 1, targetH = 1) {
		this.count = 0;
		this.runs.length = 0;
		this.maxLayer = 0;
		this.uploaded = false;
		this.viewData[0] = x;
		this.viewData[1] = y;
		this.viewData[2] = w;
		this.viewData[3] = h;
		this.targetW = targetW;
		this.targetH = targetH;
	}
	/**
	* Push one panel. `x, y` is the TOP-LEFT corner and `w, h` the size, both in
	* the surface's units — the same convention as `d.rect`. `rot` turns the
	* panel about its own centre.
	*/
	push(x, y, w, h, s, rot = 0, clip = null, layer = 0) {
		if (this.count === this.capacity) this.grow();
		if (layer > this.maxLayer) this.maxLayer = layer;
		this.order?.put(2, this.count, layer);
		const view = this.blank;
		const run = this.runs[this.runs.length - 1];
		if (run && run.view === view && run.layer === layer && sameClip(run.clip, clip)) run.n++;
		else this.runs.push({
			view,
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
	/**
	* Rewrite an already-pushed panel's rectangle. This is what lets a container
	* SIZE ITSELF TO ITS CONTENT in immediate mode: the frame is pushed first
	* (it has to paint under the content), the content is drawn and measured, and
	* the frame's rect is corrected before anything is uploaded.
	*/
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
		const next = /* @__PURE__ */ new ArrayBuffer(this.capacity * 40 * 4);
		new Float32Array(next).set(this.f32);
		this.buffer = next;
		this.f32 = new Float32Array(next);
		this.u32 = new Uint32Array(next);
		this.instances.destroy();
		this.instances = this.device.createBuffer({
			size: this.capacity * 40 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.binds.clear();
	}
	/**
	* Upload everything pushed since begin() and draw ONE layer of it.
	*
	* Layers exist because panels and text are separate passes: everything in
	* the panel pass paints before anything in the text pass, so a popup drawn
	* last in submission order still ends up UNDER text submitted earlier. The
	* frame therefore draws panels(0) → text(0) → panels(1) → text(1), and an
	* overlay (an open dropdown, a tooltip, a drag ghost) goes on layer 1 where
	* it is genuinely above everything.
	*/
	/**
	* @internal Draw ONE contiguous span of panels — the submission-order walk's
	* unit of work, intersected with this pass's own texture/clip runs.
	*/
	drawRange(pass, first, n) {
		if (n <= 0 || this.count === 0) return;
		if (!this.uploaded) {
			this.device.queue.writeBuffer(this.uniforms, 0, this.viewData);
			this.device.queue.writeBuffer(this.instances, 0, this.buffer, 0, this.count * 40 * 4);
			this.uploaded = true;
		}
		const end = first + n;
		pass.setPipeline(this.pipeline);
		let scissored = false;
		for (const run of this.runs) {
			const lo = Math.max(run.first, first);
			const hi = Math.min(run.first + run.n, end);
			if (hi <= lo) continue;
			if (run.clip) {
				const r = clipToPixels(run.clip, this.targetW, this.targetH);
				if (r.w === 0 || r.h === 0) continue;
				pass.setScissorRect(r.x, r.y, r.w, r.h);
				scissored = true;
			} else if (scissored) {
				pass.setScissorRect(0, 0, this.targetW, this.targetH);
				scissored = false;
			}
			pass.setBindGroup(0, this.bindFor(run.view));
			pass.draw(4, hi - lo, 0, lo);
		}
		if (scissored) pass.setScissorRect(0, 0, this.targetW, this.targetH);
	}
	flush(pass, layer = 0) {
		if (this.count === 0) return 0;
		if (!this.uploaded) {
			this.device.queue.writeBuffer(this.uniforms, 0, this.viewData);
			this.device.queue.writeBuffer(this.instances, 0, this.buffer, 0, this.count * 40 * 4);
			this.uploaded = true;
		}
		let drawn = 0;
		pass.setPipeline(this.pipeline);
		let scissored = false;
		for (const run of this.runs) {
			if (run.layer !== layer) continue;
			if (run.clip) {
				const r = clipToPixels(run.clip, this.targetW, this.targetH);
				if (r.w === 0 || r.h === 0) continue;
				pass.setScissorRect(r.x, r.y, r.w, r.h);
				scissored = true;
			} else if (scissored) {
				pass.setScissorRect(0, 0, this.targetW, this.targetH);
				scissored = false;
			}
			pass.setBindGroup(0, this.bindFor(run.view));
			pass.draw(4, run.n, 0, run.first);
			drawn += run.n;
		}
		if (scissored) pass.setScissorRect(0, 0, this.targetW, this.targetH);
		return drawn;
	}
};
/** Do two clips (either possibly null) describe the same region? */
function sameClip(a, b) {
	if (a === b) return true;
	if (!a || !b) return false;
	return a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1;
}
/** Normalised clip → integer device pixels, TOP-LEFT origin (WebGPU's scissor
*  convention; the GL twin flips Y). Clamped to the target and never negative. */
function clipToPixels(c, targetW, targetH) {
	const x0 = Math.max(0, Math.min(targetW, Math.round(c.x0 * targetW)));
	const y0 = Math.max(0, Math.min(targetH, Math.round(c.y0 * targetH)));
	const x1 = Math.max(x0, Math.min(targetW, Math.round(c.x1 * targetW)));
	const y1 = Math.max(y0, Math.min(targetH, Math.round(c.y1 * targetH)));
	return {
		x: x0,
		y: y0,
		w: x1 - x0,
		h: y1 - y0
	};
}
/** Pack an `Rgba` (0..1 floats) + an optional extra alpha into the ABGR u32
*  the shader unpacks. */
function packUiColor(c, alpha = 1) {
	const b = (v) => v <= 0 ? 0 : v >= 1 ? 255 : v * 255 + .5 | 0;
	return (b(c[3] * alpha) << 24 | b(c[2]) << 16 | b(c[1]) << 8 | b(c[0])) >>> 0;
}
var wgsl = `
struct Inst {
  pos: array<vec2f, 4>,
  uv: vec4f,
  col: array<u32, 4>,
  outl: array<u32, 4>,
  par: array<u32, 4>,
  mv: vec4f,
}
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) col: vec4f,
  @location(2) outl: vec4f,
  @location(3) par: vec4f,
  @location(4) unit: vec2f,
}

@group(0) @binding(0) var<uniform> view: vec4f;      // world rect: x, y, w, h
@group(0) @binding(1) var<storage, read> inst: array<Inst>;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var tex: texture_2d<f32>;

fn unpackRGBA(v: u32) -> vec4f {
  return vec4f(f32(v & 0xffu), f32((v >> 8u) & 0xffu), f32((v >> 16u) & 0xffu), f32((v >> 24u) & 0xffu)) / 255.0;
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  let world = d.pos[vi];
  let ndc = (world - view.xy) / view.zw * 2.0 - 1.0;
  let c01 = vec2f(f32(vi & 1u), f32(vi >> 1u));
  var o: VSOut;
  o.pos = vec4f(ndc.x, -ndc.y, 1.0 - d.mv.z, 1.0);
  o.uv = vec2f(mix(d.uv.x, d.uv.z, c01.x), mix(d.uv.y, d.uv.w, c01.y));
  o.col = unpackRGBA(d.col[vi]);
  o.outl = unpackRGBA(d.outl[vi]);
  o.par = unpackRGBA(d.par[vi]);
  o.unit = d.mv.xy;
  return o;
}

fn median3(r: f32, g: f32, b: f32) -> f32 { return max(min(r, g), min(max(r, g), b)); }

// Exact signed distance to a rounded box centred on the origin, negative inside.
fn roundedBox(p: vec2f, extent: vec2f, r: f32) -> f32 {
  let q = abs(p) - (extent - r);
  return length(max(q, vec2f(0.0))) + min(max(q.x, q.y), 0.0) - r;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let texel = textureSample(tex, samp, in.uv);
  let msdf = median3(texel.r, texel.g, texel.b);
  let tsdf = texel.a;                            // true SDF — meaningful on MTSDF only

  // Screen size (px) of this quad's UV box, from the true gradient magnitude of
  // each coord (not fwidth, which overestimates under rotation). Serves both
  // lanes: a glyph's AA width, and a rect's own width/height for the box SDF.
  let duvdx = dpdx(in.uv);
  let duvdy = dpdy(in.uv);
  let texGrad = vec2f(length(vec2f(duvdx.x, duvdy.x)), length(vec2f(duvdx.y, duvdy.y)));
  let screenTexSize = vec2f(1.0) / max(texGrad, vec2f(1e-8));

  // ── Bitmap lane (sentinel 253): the texture is a finished PREMULTIPLIED
  // raster (a UnicodeText block), not a distance field. Tint by col (per-corner,
  // so a gradient tint is free) and out. This return sits BELOW the dpdx/dpdy
  // above deliberately — WGSL only allows derivatives in uniform control flow,
  // so an early return above them fails to compile.
  if (in.par.r >= 252.5 / 255.0 && in.par.r < 253.5 / 255.0) {
    return texel * vec4f(in.col.rgb * in.col.a, in.col.a);
  }

  let softNorm = in.par.a;
  let softStep = step(0.5 / 255.0, softNorm);

  var fillCoverage = 0.0;
  var outlineCoverage = 0.0;
  var tone = 0.0;
  var fade = 1.0;

  // par.r >= 254/255 is the solid-rect sentinel (glyphs clip to 252/255, 253 is
  // the bitmap lane handled above). A rect writes it to all four corners, so
  // the branch is uniform per primitive.
  if (in.par.r >= 253.5 / 255.0) {
    // ── Solid lane: rounded box ──
    var halfSize = 0.5 * screenTexSize;
    var boxCoord = (in.uv - vec2f(0.5)) * screenTexSize;
    var borderNorm = in.par.b;

    if (in.par.r < 254.5 / 255.0) {              // 254 = dashed: fold U into one cell
      boxCoord.x = (fract(in.uv.x) - 0.5) * screenTexSize.x;
      halfSize.x = halfSize.x * borderNorm;      // borderNorm is the duty cycle here
      borderNorm = 0.0;
    }

    let unit = min(halfSize.x, halfSize.y);
    let boxDist = roundedBox(boxCoord, halfSize, in.par.g * unit);
    let borderPx = borderNorm * unit;
    let softPx = in.par.a * unit;
    let sDepth = -boxDist;                        // positive inside the pill
    let sHalfSoft = 0.5 * softPx;
    let sSoft = max(softPx, 1.0);
    fillCoverage = clamp((sDepth - borderPx - sHalfSoft) / sSoft + 0.5, 0.0, 1.0);
    outlineCoverage = clamp((sDepth - sHalfSoft) / sSoft + 0.5, 0.0, 1.0);
    tone = clamp(sDepth / max(max(borderPx, softPx), 1.0), 0.0, 1.0);
    fade = 1.0;
  } else {
    // ── Glyph lane: distance field ──
    let px = max(0.5 * dot(in.unit, screenTexSize), 1.0);
    let weight = in.par.r - (128.0 / 255.0);      // signed; 128 neutral
    let rounded = in.par.g;
    let widthNorm = in.par.b * 0.5;               // byte spans [0, 0.5]
    let halfSoft = 0.5 * softNorm;

    let fillEdge = 0.5 - weight;                   // fill keeps median(rgb): sharp corners
    let outlineEdge = fillEdge - widthNorm;
    let outlineDist = mix(msdf, tsdf, rounded);    // outline/shadow may round off the true SDF
    let gDepth = outlineDist - outlineEdge;
    let gAA = 1.0 / px;

    fillCoverage = clamp((msdf - fillEdge) * px + 0.5, 0.0, 1.0);
    outlineCoverage = clamp(gDepth / max(softNorm, gAA) + 0.5, 0.0, 1.0);
    tone = clamp((gDepth + halfSoft) / max(widthNorm + halfSoft, gAA), 0.0, 1.0);
    // Suppress background haze at extreme minification; soft glows survive it.
    fade = max(smoothstep(0.0, 0.2, outlineDist), softStep);
  }

  // ── One composite (shared) ──
  tone = mix(tone, tone * tone, softStep);         // hold outer hue through a soft halo
  let twoTone = 1.0 - step(0.5 / 255.0, in.col.a); // fill alpha 0 => col.rgb is the inner colour
  let outlineRgb = mix(in.outl.rgb, in.col.rgb, tone * twoTone);

  let af = fillCoverage * in.col.a;
  let ao = outlineCoverage * in.outl.a * fade;
  let a = af + ao * (1.0 - af);
  let rgb = in.col.rgb * af + outlineRgb * (ao * (1.0 - af));
  return vec4f(rgb, a);                            // premultiplied
}
`;
/**
* The MSDF glyph batch: accumulates quads across many texts and fonts into one
* instance buffer, then draws one sub-range per atlas texture. `begin()` sets the
* world view each frame; texts push quads via `alloc()`+direct writes; `flush()`
* uploads once and issues one `draw` per texture run.
*/
var MsdfRenderer = class {
	format;
	capacity;
	buffer;
	f32;
	u32;
	count = 0;
	/** Contiguous spans sharing a texture AND a clip rect (see ui.ts) — a clipped
	*  label costs one extra run and one scissor, nothing per glyph. */
	runs = [];
	uploaded = false;
	viewData = /* @__PURE__ */ new Float32Array(4);
	targetW = 1;
	targetH = 1;
	/** The clip every subsequent alloc() inherits — set by Draw around a clipped
	*  region, so text submitters need no clip argument threaded through them. */
	clip = null;
	/** Draw layer every subsequent alloc() inherits — see UiRenderer.flush. */
	layer = 0;
	/** Highest layer used this frame — how many times the frame must flush. */
	maxLayer = 0;
	/** The surface's submission-order log — set when this pass interleaves with
	*  the scene's quads rather than owning a fixed slot in the frame. */
	order = null;
	/** @internal Take part in a surface's submission order. */
	joinOrder(order) {
		this.order = order;
	}
	/**
	* Device pixels per draw unit on this surface THIS frame. UnicodeText reads it
	* to decide how finely to rasterize itself (see unicode-text.ts).
	*/
	pxPerUnit = 1;
	device;
	pipeline;
	layout;
	sampler;
	uniforms;
	instances;
	binds = /* @__PURE__ */ new Map();
	constructor(device, format, capacity = 4096) {
		this.format = format;
		this.capacity = capacity;
		this.buffer = /* @__PURE__ */ new ArrayBuffer(capacity * 28 * 4);
		this.f32 = new Float32Array(this.buffer);
		this.u32 = new Uint32Array(this.buffer);
		this.rebuild(device);
	}
	/** (Re)create every GPU object — the device-loss recovery path. */
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
		const module = device.createShaderModule({ code: wgsl });
		module.getCompilationInfo().then((info) => {
			for (const m of info.messages) if (m.type === "error") console.error(`MSDF WGSL ${m.lineNum}:${m.linePos} ${m.message}`);
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
			primitive: { topology: "triangle-strip" }
		});
		this.sampler = device.createSampler({
			magFilter: "linear",
			minFilter: "linear"
		});
		this.uniforms = device.createBuffer({
			size: 16,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.instances = device.createBuffer({
			size: this.capacity * 28 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.binds.clear();
	}
	/**
	* Forget a texture's cached bind group. Called when a UnicodeText block
	* re-rasterizes and throws its old texture away — without this the cache
	* would keep one bind group per dead view for the life of the game.
	*/
	release(view) {
		this.binds.delete(view);
	}
	bindFor(view) {
		let b = this.binds.get(view);
		if (!b) {
			b = this.device.createBindGroup({
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
						resource: view
					}
				]
			});
			this.binds.set(view, b);
		}
		return b;
	}
	/** Start a frame: map the world rect [x, y, w, h] onto the full canvas.
	*  `pxPerUnit` is the canvas's device-pixel width divided by `w`. */
	begin(x, y, w, h, pxPerUnit = 1, targetW = 1, targetH = 1) {
		this.count = 0;
		this.runs.length = 0;
		this.viewData[0] = x;
		this.viewData[1] = y;
		this.viewData[2] = w;
		this.viewData[3] = h;
		this.pxPerUnit = pxPerUnit;
		this.targetW = targetW;
		this.targetH = targetH;
		this.clip = null;
		this.layer = 0;
		this.maxLayer = 0;
		this.uploaded = false;
	}
	/**
	* Reserve one glyph/rect instance for `view` and return its base float offset
	* into `this.f32`/`this.u32` (write the 28 slots yourself). Read `f32`/`u32`
	* AFTER calling — a growth reallocates them.
	*/
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
		const next = /* @__PURE__ */ new ArrayBuffer(this.capacity * 28 * 4);
		new Float32Array(next).set(this.f32);
		this.buffer = next;
		this.f32 = new Float32Array(next);
		this.u32 = new Uint32Array(next);
		this.instances.destroy();
		this.instances = this.device.createBuffer({
			size: this.capacity * 28 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.binds.clear();
	}
	/**
	* @internal Draw ONE contiguous span of layer-0 text — the submission-order
	* walk's unit of work. The span is intersected with this pass's own runs,
	* because a run boundary (a different atlas, or a clip rect) still has to be
	* honoured inside it.
	*/
	drawRange(pass, first, n) {
		if (n <= 0 || this.count === 0) return;
		if (!this.uploaded) {
			this.device.queue.writeBuffer(this.uniforms, 0, this.viewData);
			this.device.queue.writeBuffer(this.instances, 0, this.buffer, 0, this.count * 28 * 4);
			this.uploaded = true;
		}
		const end = first + n;
		pass.setPipeline(this.pipeline);
		let scissored = false;
		for (const run of this.runs) {
			const lo = Math.max(run.first, first);
			const hi = Math.min(run.first + run.n, end);
			if (hi <= lo) continue;
			if (run.clip) {
				const r = clipToPixels(run.clip, this.targetW, this.targetH);
				if (r.w === 0 || r.h === 0) continue;
				pass.setScissorRect(r.x, r.y, r.w, r.h);
				scissored = true;
			} else if (scissored) {
				pass.setScissorRect(0, 0, this.targetW, this.targetH);
				scissored = false;
			}
			pass.setBindGroup(0, this.bindFor(run.view));
			pass.draw(4, hi - lo, 0, lo);
		}
		if (scissored) pass.setScissorRect(0, 0, this.targetW, this.targetH);
	}
	/** Upload everything pushed since begin() and draw one range per texture. */
	flush(pass, layer = 0) {
		if (this.count === 0) return 0;
		if (!this.uploaded) {
			this.device.queue.writeBuffer(this.uniforms, 0, this.viewData);
			this.device.queue.writeBuffer(this.instances, 0, this.buffer, 0, this.count * 28 * 4);
			this.uploaded = true;
		}
		let drawn = 0;
		pass.setPipeline(this.pipeline);
		let scissored = false;
		for (const run of this.runs) {
			if (run.layer !== layer) continue;
			if (run.clip) {
				const r = clipToPixels(run.clip, this.targetW, this.targetH);
				if (r.w === 0 || r.h === 0) continue;
				pass.setScissorRect(r.x, r.y, r.w, r.h);
				scissored = true;
			} else if (scissored) {
				pass.setScissorRect(0, 0, this.targetW, this.targetH);
				scissored = false;
			}
			pass.setBindGroup(0, this.bindFor(run.view));
			pass.draw(4, run.n, 0, run.first);
			drawn += run.n;
		}
		if (scissored) pass.setScissorRect(0, 0, this.targetW, this.targetH);
		return drawn;
	}
};
/** Round to a 0-255 byte, saturating both ends. */
function toByte(v) {
	return v <= 0 ? 0 : v >= 255 ? 255 : v + .5 | 0;
}
/** Pack `0xRRGGBB` + `0..1` alpha into the ABGR u32 the shader unpacks. */
function packColor(rgb, alpha) {
	const r = rgb >> 16 & 255, g = rgb >> 8 & 255, b = rgb & 255;
	return ((alpha <= 0 ? 0 : alpha >= 1 ? 255 : alpha * 255 | 0) << 24 | b << 16 | g << 8 | r) >>> 0;
}
/** Largest weight byte a real glyph may carry (252); 255/254 are rect sentinels. */
var WEIGHT_MAX_BYTE = 252;
/**
* Pack the glyph `params`: weight (signed field fraction, 128 neutral), rounded
* (0..1), width (outline width / shadow spread, field fraction over [0,0.5]),
* softness (field fraction). All continuous, so all per-corner for free.
*/
function packParams(weightNorm, roundedNorm, widthNorm, softNorm) {
	const raw = toByte(weightNorm * 255 + 128);
	const w = raw > WEIGHT_MAX_BYTE ? WEIGHT_MAX_BYTE : raw;
	const g = toByte(roundedNorm * 255);
	const b = toByte(widthNorm * 510);
	return (toByte(softNorm * 255) << 24 | b << 16 | g << 8 | w) >>> 0;
}
/** A plain hard-edged solid rect (underline/strikethrough): sentinel 255, no radius/border/blur. */
var SOLID_PARAMS = 255;
/** A finished premultiplied raster (a UnicodeText block): sentinel 253, tinted by `col`. */
var BITMAP_PARAMS = 253;
/** Pack a solid rect's params (radius/border/softness, fractions of half-thickness). */
function packSolidParams(radiusNorm, borderNorm, softNorm) {
	return (toByte(softNorm * 255) << 24 | toByte(borderNorm * 255) << 16 | toByte(radiusNorm * 255) << 8 | 255) >>> 0;
}
/** Pack a dashed rect's params (radius/duty/softness); U spans one cell per dash. */
function packDashParams(radiusNorm, dutyNorm, softNorm) {
	return (toByte(softNorm * 255) << 24 | toByte(dutyNorm * 255) << 16 | toByte(radiusNorm * 255) << 8 | 254) >>> 0;
}
//#endregion
export { arcSteps as $, LINE_FLOATS as A, clipToScissor as B, EFFECT_PACK as C, Atlas as Ct, effectParamIndex as D, __exportAll as Dt, effectDefaults as E, textureFromCanvas as Et, XFORM_FLOATS as F, segJoins as G, particleOutline as H, buildFill as I, spawnFragment as J, segmentStyles as K, buildFillWGSL as L, VecTrail as M, VectorLayer as N, Visibility2d as O, VectorShape as P, arcPoints as Q, buildLineWGSL as R, EFFECTS as S, textWidth as St, buildEffectWGSL as T, rasterText as Tt, polySegs as U, fragmentAlpha as V, resolveVecColor as W, tintStyle as X, stepFragment as Y, arcHit as Z, BackdropLayer as _, colorkit_exports as _t, packDashParams as a, hullFor as at, PostHandle as b, glyphOutline as bt, STRIDE$1 as c, placeModelOnGround as ct, packUiColor as d, ringSections as dt, convexHull as et, sameClip as f, simplifyHull as ft, BackdropHandle as g, wireGrid as gt, BackdropChain as h, wireBox as ht, packColor as i, horizon as it, VecStarfield as j, FILL_FLOATS as k, UiRenderer as l, project as lt, BACKDROP_PACK as m, wireBounds as mt, MsdfRenderer as n, focalLength as nt, packParams as o, isConvex as ot, BACKDROPS as p, triangulate as pt, shapeOrigin as q, SOLID_PARAMS as r, generateTube as rt, packSolidParams as s, placeModel as st, BITMAP_PARAMS as t, convexPieces as tt, clipToPixels as u, projectPoint as ut, buildBackdropWGSL as v, lerp as vt, MAX_EFFECT_PARAMS as w, packShelves as wt, PostLayer as x, textOutline as xt, PostChain as y, VECTOR_CHARSET as yt, chainJoins as z };

//# sourceMappingURL=shared-kkws-wjJ.js.map
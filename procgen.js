//#region src/packs/procgen.ts
/**
* Maximum safe canvas dimension in pixels. Every canvas this module creates is
* clamped to `[1, MAX_CANVAS_DIM]` to avoid a 0/NaN throw on some browsers and
* an OOM on iOS Safari (which caps at ~4096²).
*/
var MAX_CANVAS_DIM = 4096;
/**
* Clamp `n` to a safe canvas dimension: a finite integer in `[1, MAX_CANVAS_DIM]`.
* Non-finite input (NaN / Infinity) collapses to 1.
*/
function clampCanvasDim(n) {
	if (!Number.isFinite(n)) return 1;
	return Math.min(MAX_CANVAS_DIM, Math.max(1, Math.floor(n)));
}
/**
* Create and return a new `HTMLCanvasElement` sized to clamped `[1, MAX_CANVAS_DIM]`
* dimensions. Touches the DOM at call time.
*/
function createCanvas(width, height) {
	const canvas = document.createElement("canvas");
	canvas.width = clampCanvasDim(width);
	canvas.height = clampCanvasDim(height);
	return canvas;
}
function makeCanvas(w, h) {
	const canvas = createCanvas(w, h);
	const ctx = canvas.getContext("2d");
	ctx.imageSmoothingEnabled = false;
	return {
		canvas,
		ctx
	};
}
/**
* A spherical environment map — "the world reflected in a chrome ball" — for
* fake-reflection sphere mapping on 3D materials (use the canvas as a texture,
* e.g. register it with `game.assets.frames(...)`). Sky above,
* ground below, a bright sun hotspot and horizontal streaks: the streaks are
* what sells the fake chrome when it sweeps across a surface. Colour the world
* to match your scene (night: dark sky, fire-orange sun).
*/
function envMap(opts = {}) {
	const s = opts.size ?? 64;
	const sky = opts.sky ?? "#7ec8ff";
	const horizon = opts.horizon ?? "#f5e9d0";
	const ground = opts.ground ?? "#4a3b2a";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.imageSmoothingEnabled = true;
	const g = ctx.createLinearGradient(0, 0, 0, s);
	g.addColorStop(0, sky);
	g.addColorStop(.42, sky);
	g.addColorStop(.5, horizon);
	g.addColorStop(.58, horizon);
	g.addColorStop(.7, ground);
	g.addColorStop(1, ground);
	ctx.fillStyle = g;
	ctx.fillRect(0, 0, s, s);
	const rand = rng(opts.seed ?? 7);
	for (let i = 0; i < 6; i++) {
		const above = i % 2 === 0;
		const y = above ? s * (.12 + rand() * .28) : s * (.62 + rand() * .3);
		const h = s * (.015 + rand() * .035);
		ctx.fillStyle = above ? "rgba(255,255,255,0.35)" : "rgba(0,0,0,0.25)";
		ctx.fillRect(0, y, s, Math.max(1, h));
	}
	if (opts.sun !== null) {
		const sg = ctx.createRadialGradient(s * .68, s * .22, 0, s * .68, s * .22, s * .2);
		sg.addColorStop(0, opts.sun ?? "#ffffff");
		sg.addColorStop(.35, "rgba(255,255,255,0.55)");
		sg.addColorStop(1, "rgba(255,255,255,0)");
		ctx.fillStyle = sg;
		ctx.fillRect(0, 0, s, s);
	}
	return canvas;
}
function rng(seed) {
	let s = seed | 0 || 1;
	return () => {
		s = s * 1103515245 + 12345 & 2147483647;
		return s / 2147483647;
	};
}
function heightFieldToNormalMap(h, size, amp) {
	const { canvas, ctx } = makeCanvas(size, size);
	const img = ctx.createImageData(size, size);
	const d = img.data;
	for (let y = 0; y < size; y++) {
		const ym = (y - 1 + size) % size * size;
		const yp = (y + 1) % size * size;
		const yr = y * size;
		for (let x = 0; x < size; x++) {
			const xm = (x - 1 + size) % size;
			const dx = (h[yr + (x + 1) % size] - h[yr + xm]) * .5 * amp;
			const dy = (h[yp + x] - h[ym + x]) * .5 * amp;
			const inv = 1 / Math.hypot(dx, dy, 1);
			const i = (yr + x) * 4;
			d[i] = Math.round((-dx * inv * .5 + .5) * 255);
			d[i + 1] = Math.round((-dy * inv * .5 + .5) * 255);
			d[i + 2] = Math.round((inv * .5 + .5) * 255);
			d[i + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	return canvas;
}
function noiseField(size, cells, rand) {
	const g = new Float32Array(cells * cells);
	for (let i = 0; i < g.length; i++) g[i] = rand();
	const out = new Float32Array(size * size);
	for (let y = 0; y < size; y++) {
		const fy = y / size * cells;
		const cy = Math.floor(fy);
		const ty = fy - cy;
		const sy = ty * ty * (3 - 2 * ty);
		const y0 = cy % cells * cells;
		const y1 = (cy + 1) % cells * cells;
		for (let x = 0; x < size; x++) {
			const fx = x / size * cells;
			const cx = Math.floor(fx);
			const tx = fx - cx;
			const sx = tx * tx * (3 - 2 * tx);
			const x0 = cx % cells;
			const x1 = (cx + 1) % cells;
			const top = g[y0 + x0] + (g[y0 + x1] - g[y0 + x0]) * sx;
			const bot = g[y1 + x0] + (g[y1 + x1] - g[y1 + x0]) * sx;
			out[y * size + x] = top + (bot - top) * sy;
		}
	}
	return out;
}
/**
* A tileable NOISE normal map — bumpy stone, hammered metal, rough plaster —
* for use as a tangent-space normal-map texture on lit 3D materials.
* Two octaves of wrapped value noise turned into surface slopes: the lighting
* picks out per-pixel bumps that flat geometry can't show. `scale` sets bump
* frequency, `strength` how deep the relief reads.
*/
function noiseNormalMap(opts = {}) {
	const s = opts.size ?? 64;
	const scale = Math.max(1, Math.floor(opts.scale ?? 5));
	const rand = rng(opts.seed ?? 7);
	const h = noiseField(s, scale, rand);
	const h2 = noiseField(s, Math.min(s, scale * 2), rand);
	for (let i = 0; i < h.length; i++) h[i] = h[i] * .7 + h2[i] * .3;
	return heightFieldToNormalMap(h, s, (opts.strength ?? 1) * s * .15);
}
/**
* A brick-relief normal map matching `brickTile`'s layout (two offset courses
* per tile) — the mortar joints read as real grooves under a moving light.
* Use it WITH the color tile on the same material so relief and paint line up:
* `{ texture: brickTile(), normalMap: brickNormalMap() }` (any sizes — both
* stretch over the same UVs).
*/
function brickNormalMap(opts = {}) {
	const s = opts.size ?? 64;
	const rough = noiseField(s, 12, rng(opts.seed ?? 7));
	const groove = .03;
	const bevel = .05;
	const distToJoint = (t) => {
		const d = t % .5;
		return Math.min(d, .5 - d);
	};
	const h = new Float32Array(s * s);
	for (let y = 0; y < s; y++) {
		const v = y / s;
		const dv = distToJoint(v);
		const row = Math.floor(v * 2) % 2;
		for (let x = 0; x < s; x++) {
			const u = x / s;
			const du = row === 0 ? Math.min(u % 1, 1 - u % 1) : Math.abs(u - .5);
			let t = Math.min(1, Math.max(0, (Math.min(du, dv) - groove) / bevel));
			t = t * t * (3 - 2 * t);
			h[y * s + x] = t + rough[y * s + x] * .08;
		}
	}
	return heightFieldToNormalMap(h, s, (opts.strength ?? 1) * s * .15);
}
/**
* 4-frame walking character sprite sheet — round-headed figure with swinging legs.
* The figure **faces right** (a snout pokes past the head's leading edge and the eyes
* sit on the front of the face), so mirroring it with `flip.x` visibly turns it to face left.
* Returns a `(4 × size) × size` horizontal strip; use as a `SpriteSheet` with frame width = `size`.
*/
function characterSheet(opts = {}) {
	const s = opts.size ?? 16;
	const body = opts.body ?? "#ffd166";
	const outline = opts.outline ?? "#26233a";
	const leg = opts.leg ?? "#c98aab";
	const { canvas, ctx } = makeCanvas(s * 4, s);
	const swings = [
		0,
		1,
		0,
		-1
	];
	for (let f = 0; f < 4; f++) {
		const cx = f * s + s / 2;
		const headR = s * .32;
		const headY = s * .42;
		ctx.fillStyle = body;
		ctx.beginPath();
		ctx.arc(cx, headY, headR, 0, Math.PI * 2);
		ctx.fill();
		ctx.beginPath();
		ctx.moveTo(cx + headR * .35, headY - headR * .4);
		ctx.lineTo(cx + headR + s * .12, headY);
		ctx.lineTo(cx + headR * .35, headY + headR * .4);
		ctx.closePath();
		ctx.fill();
		ctx.fillStyle = outline;
		const eo = s * .11;
		ctx.fillRect(Math.round(cx), Math.round(headY - 1), 1, 2);
		ctx.fillRect(Math.round(cx + eo + 1), Math.round(headY - 1), 1, 2);
		const sw = swings[f] * (s * .14);
		ctx.strokeStyle = leg;
		ctx.lineWidth = Math.max(1, s * .09);
		ctx.beginPath();
		const hipY = s * .66;
		const footY = s - 1;
		ctx.moveTo(cx - eo, hipY);
		ctx.lineTo(cx - eo - sw, footY);
		ctx.moveTo(cx + eo, hipY);
		ctx.lineTo(cx + eo + sw, footY);
		ctx.stroke();
	}
	return canvas;
}
/** Tileable two-tone checkerboard — THE classic retro-3D scrolling floor (and a fine 2D tile). `base`/`detail` set the two squares. */
function checkerTile(opts = {}) {
	const s = opts.size ?? 16;
	const a = opts.base ?? "#3a4252";
	const b = opts.detail ?? "#2a3040";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = a;
	ctx.fillRect(0, 0, s, s);
	ctx.fillStyle = b;
	const h = s / 2;
	ctx.fillRect(0, 0, h, h);
	ctx.fillRect(h, h, h, h);
	return canvas;
}
/** Tileable brick wall — offset courses with mortar joints. Use for walls, platforms, dungeon floors. */
function brickTile(opts = {}) {
	const s = opts.size ?? 16;
	const brick = opts.base ?? "#a23e2c";
	const mortar = opts.detail ?? "#3a2420";
	const top = opts.accent ?? "#bb5240";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = mortar;
	ctx.fillRect(0, 0, s, s);
	const rowH = s / 2;
	const brickW = s;
	for (let row = 0; row < 2; row++) {
		const y = row * rowH;
		const offset = row % 2 === 0 ? 0 : -brickW / 2;
		for (let x = offset; x < s; x += brickW) {
			ctx.fillStyle = brick;
			ctx.fillRect(x + 1, y + 1, brickW - 2, rowH - 2);
			ctx.fillStyle = top;
			ctx.fillRect(x + 1, y + 1, brickW - 2, 1);
		}
	}
	return canvas;
}
/** Tileable grass — green base with scattered darker flecks and bright blade accents. Use for outdoor ground layers. */
function grassTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#3a7d34";
	const detail = opts.detail ?? "#2c5f28";
	const accent = opts.accent ?? "#5bbf4f";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	const rand = rng(opts.seed ?? 7);
	ctx.fillStyle = detail;
	for (let i = 0; i < s; i++) ctx.fillRect(rand() * s | 0, rand() * s | 0, 1, 1);
	ctx.fillStyle = accent;
	for (let i = 0; i < s / 3; i++) {
		const x = rand() * s | 0;
		const y = rand() * s | 0;
		ctx.fillRect(x, y, 1, 2);
	}
	return canvas;
}
/** Tileable stone block — grey base with bevel edges and dark speckle cracks. Use for dungeon floors, cave walls. */
function stoneTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#6b7079";
	const detail = opts.detail ?? "#3f444b";
	const accent = opts.accent ?? "#8a909a";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	ctx.fillStyle = accent;
	ctx.fillRect(0, 0, s, 1);
	ctx.fillRect(0, 0, 1, s);
	ctx.fillStyle = detail;
	ctx.fillRect(0, s - 1, s, 1);
	ctx.fillRect(s - 1, 0, 1, s);
	const rand = rng(opts.seed ?? 3);
	ctx.fillStyle = detail;
	for (let i = 0; i < s / 2; i++) ctx.fillRect(rand() * s | 0, rand() * s | 0, 1, 1);
	return canvas;
}
/** Tileable dirt / earth — brown base with randomised darker and lighter clods. Use for underground or farmland layers. */
function dirtTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#7a5230";
	const detail = opts.detail ?? "#5b3b21";
	const accent = opts.accent ?? "#9a6b40";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	const rand = rng(opts.seed ?? 11);
	for (let i = 0; i < s; i++) {
		ctx.fillStyle = rand() > .5 ? detail : accent;
		ctx.fillRect(rand() * s | 0, rand() * s | 0, 1, 1);
	}
	return canvas;
}
/** Tileable water — blue base with sine-wave ripple rows that tile seamlessly. Use for lakes, rivers, ocean backgrounds. */
function waterTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#2a6fb0";
	const accent = opts.accent ?? "#7cc0ef";
	const dark = opts.detail ?? "#1f5790";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	const amp = Math.max(1, s * .06);
	const k = 4 * Math.PI / s;
	for (let row = 0; row < 3; row++) {
		const baseY = s * (.22 + row * .28);
		const phase = row * 1.9;
		for (let x = 0; x < s; x++) {
			const y = Math.round(baseY + Math.sin(x * k + phase) * amp);
			ctx.fillStyle = accent;
			ctx.fillRect(x, y, 1, 1);
			ctx.fillStyle = dark;
			ctx.fillRect(x, y + 1, 1, 1);
		}
	}
	return canvas;
}
/** Tileable sand / desert floor — warm beige with random grain speckles and faint dune ripple lines. */
function sandTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#e3c98f";
	const detail = opts.detail ?? "#c9a86a";
	const accent = opts.accent ?? "#f4e6bf";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	const rand = rng(opts.seed ?? 5);
	for (let i = 0; i < s * 1.5; i++) {
		ctx.fillStyle = rand() > .5 ? detail : accent;
		ctx.fillRect(rand() * s | 0, rand() * s | 0, 1, 1);
	}
	ctx.fillStyle = detail;
	for (let row = 0; row < 2; row++) {
		const baseY = s * (.35 + row * .4);
		for (let x = 0; x < s; x++) {
			const y = Math.round(baseY + Math.sin(x / s * Math.PI * 2 + row) * s * .05);
			ctx.fillRect(x, y, 1, 1);
		}
	}
	return canvas;
}
/** Tileable sci-fi metal panel — bevelled edges, inset panel recess, and corner bolts. Use for space stations, mechs, industrial levels. */
function metalTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#5a6b7a";
	const light = opts.accent ?? "#90a4b4";
	const dark = opts.detail ?? "#33414d";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	ctx.fillStyle = light;
	ctx.fillRect(0, 0, s, 1);
	ctx.fillRect(0, 0, 1, s);
	ctx.fillStyle = dark;
	ctx.fillRect(0, s - 1, s, 1);
	ctx.fillRect(s - 1, 0, 1, s);
	ctx.strokeStyle = dark;
	ctx.lineWidth = 1;
	ctx.strokeRect(2.5, 2.5, s - 5, s - 5);
	const bolts = [
		[3, 3],
		[s - 3, 3],
		[3, s - 3],
		[s - 3, s - 3]
	];
	for (const [bx, by] of bolts) {
		ctx.fillStyle = light;
		ctx.beginPath();
		ctx.arc(bx, by, Math.max(1, s * .07), 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = dark;
		ctx.fillRect(Math.round(bx) - .5, Math.round(by) - .5, 1, 1);
	}
	return canvas;
}
/**
* Thin wooden plank for one-way platforms — visible surface occupies the top ~30 % of the cell, transparent below.
* The drawn surface aligns with a northward one-way collision line so the player stands exactly on the plank.
* 2D platforms ONLY: the transparent 70 % makes 3D faces see-through — texture 3D wood with `woodTile` instead.
*/
function plankTile(opts = {}) {
	const s = opts.size ?? 16;
	const wood = opts.base ?? "#b9854c";
	const edge = opts.detail ?? "#6e4a25";
	const top = opts.accent ?? "#d8a868";
	const { canvas, ctx } = makeCanvas(s, s);
	const ph = Math.max(3, Math.round(s * .3));
	ctx.fillStyle = wood;
	ctx.fillRect(0, 0, s, ph);
	ctx.fillStyle = top;
	ctx.fillRect(0, 0, s, 1);
	ctx.fillStyle = edge;
	ctx.fillRect(0, ph - 1, s, 1);
	for (let x = 0; x < s; x += Math.max(4, s / 2 | 0)) ctx.fillRect(x, 0, 1, ph);
	return canvas;
}
/** Tileable wooden crate — plank border with a diagonal brace and highlight. Use for breakable blocks, storage areas. */
function crateTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#9a6b3a";
	const detail = opts.detail ?? "#5e3f20";
	const accent = opts.accent ?? "#b9854c";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	ctx.fillStyle = detail;
	ctx.strokeStyle = detail;
	ctx.fillRect(0, 0, s, 1);
	ctx.fillRect(0, s - 1, s, 1);
	ctx.fillRect(0, 0, 1, s);
	ctx.fillRect(s - 1, 0, 1, s);
	ctx.fillRect(0, s / 2 | 0, s, 1);
	ctx.beginPath();
	ctx.moveTo(1, 1);
	ctx.lineTo(s - 1, s - 1);
	ctx.stroke();
	ctx.fillStyle = accent;
	ctx.fillRect(1, 1, s - 2, 1);
	return canvas;
}
/** Tileable lava — dark crust with glowing diagonal crack veins and bright ember speckles. Use for hazard / damage zones. */
function lavaTile(opts = {}) {
	const s = opts.size ?? 16;
	const crust = opts.base ?? "#3a140d";
	const glow = opts.accent ?? "#ff7a18";
	const hot = opts.detail ?? "#ffd23f";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = crust;
	ctx.fillRect(0, 0, s, s);
	const rand = rng(opts.seed ?? 9);
	ctx.fillStyle = glow;
	for (let x = 0; x < s; x++) {
		const y1 = Math.round(x * 1.7 % s);
		const y2 = Math.round((x * .9 + s * .5) % s);
		ctx.fillRect(x, y1, 1, 1);
		ctx.fillRect(x, y2, 1, 1);
	}
	ctx.fillStyle = hot;
	for (let i = 0; i < s / 3; i++) ctx.fillRect(rand() * s | 0, rand() * s | 0, 1, 1);
	return canvas;
}
/** Tileable ice — pale blue with a corner sheen and seeded hairline cracks. Use for frozen / slippery surfaces. */
function iceTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#9fd8f0";
	const light = opts.accent ?? "#e8fbff";
	const dark = opts.detail ?? "#5fa6c9";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	ctx.fillStyle = light;
	ctx.fillRect(0, 0, s, 1);
	ctx.fillRect(0, 0, 1, s);
	ctx.fillStyle = dark;
	ctx.fillRect(0, s - 1, s, 1);
	ctx.fillRect(s - 1, 0, 1, s);
	const rand = rng(opts.seed ?? 4);
	for (let i = 0; i < 3; i++) {
		let x = rand() * s | 0;
		let y = rand() * s | 0;
		for (let k = 0; k < 4; k++) {
			ctx.fillRect(x % s, y % s, 1, 1);
			x += 1;
			y += rand() * 3 - 1 | 0;
		}
	}
	return canvas;
}
/** Tileable snow — near-white with faint blue-grey flecks and a soft bottom shadow. Use for winter / arctic ground. */
function snowTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#eef4fb";
	const detail = opts.detail ?? "#cdd8e6";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	ctx.fillStyle = detail;
	ctx.fillRect(0, s - 1, s, 1);
	const rand = rng(opts.seed ?? 13);
	for (let i = 0; i < s / 2; i++) ctx.fillRect(rand() * s | 0, rand() * s | 0, 1, 1);
	return canvas;
}
/** Tileable wood — horizontal plank seams with grain marks. Use for floors, bridges, cabin interiors. */
function woodTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#b9854c";
	const dark = opts.detail ?? "#7a5226";
	const light = opts.accent ?? "#d8a868";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	const plankH = s / 2;
	for (let p = 0; p < 2; p++) {
		const y = p * plankH;
		ctx.fillStyle = dark;
		ctx.fillRect(0, y, s, 1);
		ctx.fillStyle = light;
		ctx.fillRect(0, y + 1, s, 1);
		ctx.fillStyle = dark;
		const rand = rng((opts.seed ?? 2) + p);
		for (let x = 0; x < s; x += 3) ctx.fillRect(x, y + 2 + (rand() * (plankH - 3) | 0), 2, 1);
	}
	return canvas;
}
/** Tileable cobblestone — four rounded stones with highlighted tops over dark mortar. Use for medieval roads, town squares. */
function cobbleTile(opts = {}) {
	const s = opts.size ?? 16;
	const stone = opts.base ?? "#7d8590";
	const mortar = opts.detail ?? "#33383f";
	const light = opts.accent ?? "#9aa3ad";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = mortar;
	ctx.fillRect(0, 0, s, s);
	const r = s * .26;
	const centres = [
		[s * .27, s * .27],
		[s * .75, s * .3],
		[s * .3, s * .76],
		[s * .78, s * .78]
	];
	for (const [cx, cy] of centres) {
		ctx.fillStyle = stone;
		ctx.beginPath();
		ctx.arc(cx, cy, r, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = light;
		ctx.beginPath();
		ctx.arc(cx - r * .3, cy - r * .3, r * .35, 0, Math.PI * 2);
		ctx.fill();
	}
	return canvas;
}
/** Tileable gravel — grey base with randomised light and dark grain speckles. Use for paths, riverbanks. */
function gravelTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#6c7077";
	const dark = opts.detail ?? "#494d53";
	const light = opts.accent ?? "#9398a0";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	const rand = rng(opts.seed ?? 17);
	for (let i = 0; i < s * 2.5; i++) {
		const r = rand();
		ctx.fillStyle = r > .6 ? light : r > .3 ? dark : base;
		ctx.fillRect(rand() * s | 0, rand() * s | 0, 1, 1);
	}
	return canvas;
}
/** Tileable hedge / dense foliage — dark-green base with randomised light and dark leafy clumps. Use for maze walls, garden borders. */
function hedgeTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#2f6b2f";
	const dark = opts.detail ?? "#1e4a1e";
	const light = opts.accent ?? "#4f9c43";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	const rand = rng(opts.seed ?? 19);
	for (let i = 0; i < s * 3; i++) {
		ctx.fillStyle = rand() > .5 ? light : dark;
		const x = rand() * s | 0;
		const y = rand() * s | 0;
		ctx.fillRect(x, y, 2, 2);
	}
	return canvas;
}
/** Tileable asphalt road / tarmac — dark grey with randomised grit speckles. Use for city streets, racing tracks. */
function roadTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#3a3d42";
	const dark = opts.detail ?? "#2a2c30";
	const light = opts.accent ?? "#54585e";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	const rand = rng(opts.seed ?? 23);
	for (let i = 0; i < s * 2; i++) {
		ctx.fillStyle = rand() > .5 ? light : dark;
		ctx.fillRect(rand() * s | 0, rand() * s | 0, 1, 1);
	}
	return canvas;
}
/** Tileable circuit board — dark PCB substrate with crossing green traces and a solder pad. Use for sci-fi / cyber levels. */
function circuitTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#0e2a1e";
	const trace = opts.accent ?? "#3fe07a";
	const dim = opts.detail ?? "#1f5a3a";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	ctx.fillStyle = dim;
	ctx.fillRect(s / 2, 0, 1, s);
	ctx.fillRect(0, s / 2, s, 1);
	ctx.fillStyle = trace;
	ctx.fillRect(s / 2, 0, 1, s / 2);
	ctx.fillRect(0, s / 2, s / 2, 1);
	ctx.beginPath();
	ctx.arc(s / 2, s / 2, s * .12, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Tileable mud — dark wet earth with elliptical puddle blobs and light grain speckles. Use for swamp, rain-soaked terrain. */
function mudTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#4e3620";
	const dark = opts.detail ?? "#352314";
	const light = opts.accent ?? "#6a4d30";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	const rand = rng(opts.seed ?? 29);
	ctx.fillStyle = dark;
	for (let i = 0; i < 3; i++) {
		ctx.beginPath();
		ctx.ellipse(rand() * s | 0, rand() * s | 0, s * .16, s * .1, rand() * 3, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.fillStyle = light;
	for (let i = 0; i < s; i++) ctx.fillRect(rand() * s | 0, rand() * s | 0, 1, 1);
	return canvas;
}
/** Tileable marble — pale stone with two sine-wave grey vein lines that wrap seamlessly. Use for palace, temple, luxury interiors. */
function marbleTile(opts = {}) {
	const s = opts.size ?? 16;
	const base = opts.base ?? "#e8e6ef";
	const vein = opts.detail ?? "#a9a6bc";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = base;
	ctx.fillRect(0, 0, s, s);
	ctx.fillStyle = vein;
	const k = 2 * Math.PI / s;
	for (let x = 0; x < s; x++) {
		ctx.fillRect(x, Math.round(s * .35 + Math.sin(x * k) * s * .18), 1, 1);
		ctx.fillRect(x, Math.round(s * .7 + Math.sin(x * k * 2 + 1) * s * .1), 1, 1);
	}
	return canvas;
}
/**
* Pack equal-size tile canvases into a single horizontal strip image for use with `Tilemap`.
* Tiles are indexed left-to-right starting at 0; pass the result as the tileset argument to `Tilemap`.
* @param tiles Array of same-size tile canvases (e.g. from `grassTile`, `stoneTile`, etc.).
* @returns A `(tileWidth × count) × tileHeight` canvas.
*/
function tileset(tiles) {
	if (!tiles.length) return makeCanvas(1, 1).canvas;
	const tw = tiles[0].width;
	const th = tiles[0].height;
	const { canvas, ctx } = makeCanvas(tw * tiles.length, th);
	for (let i = 0; i < tiles.length; i++) ctx.drawImage(tiles[i], i * tw, 0);
	return canvas;
}
function poly(ctx, pts) {
	ctx.beginPath();
	pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y));
	ctx.closePath();
}
function starPoints(cx, cy, outer, inner, n = 5, rot = -Math.PI / 2) {
	const pts = [];
	for (let i = 0; i < n * 2; i++) {
		const r = i % 2 ? inner : outer;
		const a = rot + i * Math.PI / n;
		pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
	}
	return pts;
}
/**
* Spinning gold coin — 4-frame animation strip (face → edge-on → face).
* Use as a `SpriteSheet` for collectible coins, currency pickups.
*/
function coinSheet(opts = {}) {
	const s = opts.size ?? 16;
	const gold = opts.color ?? "#ffcf3f";
	const light = opts.accent ?? "#fff1a8";
	const edge = opts.detail ?? "#c98a1a";
	const { canvas, ctx } = makeCanvas(s * 4, s);
	const widths = [
		1,
		.55,
		.16,
		.55
	];
	for (let f = 0; f < 4; f++) {
		const cx = f * s + s / 2;
		const cy = s / 2;
		const r = s * .42;
		const rw = Math.max(1, r * widths[f]);
		ctx.fillStyle = f === 2 ? edge : gold;
		ctx.beginPath();
		ctx.ellipse(cx, cy, rw, r, 0, 0, Math.PI * 2);
		ctx.fill();
		if (f !== 2) {
			ctx.strokeStyle = edge;
			ctx.lineWidth = 1;
			ctx.stroke();
			ctx.fillStyle = light;
			ctx.beginPath();
			ctx.ellipse(cx - rw * .3, cy - r * .25, Math.max(.6, rw * .35), r * .45, 0, 0, Math.PI * 2);
			ctx.fill();
		}
	}
	return canvas;
}
/** Faceted green gem — a single-frame collectible jewel with facet lines. Use for score pickups, RPG loot. */
function gem(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#48d05a";
	const light = opts.accent ?? "#b6f3bf";
	const dark = opts.detail ?? "#1f7a2e";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const w = s * .74;
	const top = s * .2;
	const mid = s * .44;
	const bot = s * .9;
	const L = cx - w / 2;
	const R = cx + w / 2;
	const il = cx - w * .26;
	const ir = cx + w * .26;
	poly(ctx, [
		[il, top],
		[ir, top],
		[R, mid],
		[L, mid]
	]);
	ctx.fillStyle = light;
	ctx.fill();
	poly(ctx, [
		[L, mid],
		[R, mid],
		[cx, bot]
	]);
	ctx.fillStyle = col;
	ctx.fill();
	ctx.strokeStyle = dark;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(il, top);
	ctx.lineTo(L, mid);
	ctx.moveTo(ir, top);
	ctx.lineTo(R, mid);
	ctx.moveTo(cx, mid);
	ctx.lineTo(cx, bot);
	ctx.moveTo(il, top);
	ctx.lineTo(cx, mid);
	ctx.lineTo(ir, top);
	ctx.stroke();
	poly(ctx, [
		[il, top],
		[ir, top],
		[R, mid],
		[cx, bot],
		[L, mid]
	]);
	ctx.stroke();
	return canvas;
}
/** Brilliant-cut diamond — blue-white faceted gem. Use for rare collectibles, shop currency, puzzle gems. */
function diamond(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#7fe0ff";
	const light = opts.accent ?? "#e6fbff";
	const dark = opts.detail ?? "#39a6c9";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const w = s * .66;
	const top = s * .16;
	const crown = s * .42;
	const bot = s * .9;
	const L = cx - w / 2;
	const R = cx + w / 2;
	const tl = cx - w * .28;
	const tr = cx + w * .28;
	poly(ctx, [
		[tl, top],
		[tr, top],
		[R, crown],
		[L, crown]
	]);
	ctx.fillStyle = light;
	ctx.fill();
	poly(ctx, [
		[L, crown],
		[R, crown],
		[cx, bot]
	]);
	ctx.fillStyle = col;
	ctx.fill();
	ctx.strokeStyle = dark;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(tl, top);
	ctx.lineTo(L, crown);
	ctx.moveTo(tr, top);
	ctx.lineTo(R, crown);
	ctx.moveTo(cx, top);
	ctx.lineTo(cx, crown);
	ctx.lineTo(cx, bot);
	ctx.moveTo(L, crown);
	ctx.lineTo(cx, bot);
	ctx.lineTo(R, crown);
	ctx.stroke();
	poly(ctx, [
		[tl, top],
		[tr, top],
		[R, crown],
		[cx, bot],
		[L, crown]
	]);
	ctx.stroke();
	return canvas;
}
/** Five-point gold star — use for score pickups, ratings, achievement icons. */
function star(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#ffd23f";
	const edge = opts.detail ?? "#e08a00";
	const { canvas, ctx } = makeCanvas(s, s);
	poly(ctx, starPoints(s / 2, s / 2 + s * .02, s * .46, s * .19));
	ctx.fillStyle = col;
	ctx.fill();
	ctx.strokeStyle = edge;
	ctx.lineWidth = Math.max(1, s * .05);
	ctx.lineJoin = "round";
	ctx.stroke();
	return canvas;
}
/** Red heart — use for lives / health pickups, health HUD icons. */
function heart(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#ff4d6d";
	const light = opts.accent ?? "#ff90a6";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const r = s * .23;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.arc(cx - r, s * .36, r, Math.PI, 0);
	ctx.arc(cx + r, s * .36, r, Math.PI, 0);
	ctx.lineTo(cx, s * .86);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = light;
	ctx.beginPath();
	ctx.arc(cx - r, s * .34, r * .4, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Gold key — bow + shaft + teeth. Use for door / chest unlock collectibles. */
function key(opts = {}) {
	const s = opts.size ?? 16;
	const gold = opts.color ?? "#ffcf3f";
	const dark = opts.detail ?? "#c98a1a";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.strokeStyle = gold;
	ctx.fillStyle = gold;
	ctx.lineWidth = Math.max(1.5, s * .1);
	ctx.beginPath();
	ctx.arc(s * .32, s * .32, s * .16, 0, Math.PI * 2);
	ctx.stroke();
	ctx.beginPath();
	ctx.moveTo(s * .42, s * .42);
	ctx.lineTo(s * .78, s * .78);
	ctx.stroke();
	ctx.fillRect(s * .66, s * .74, s * .1, s * .14);
	ctx.fillRect(s * .74, s * .66, s * .14, s * .1);
	ctx.fillStyle = dark;
	ctx.beginPath();
	ctx.arc(s * .32, s * .32, s * .05, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Red apple with a brown stem and green leaf. Use for food pickups, health items, orchard collectibles. */
function apple(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#e23d4c";
	const light = opts.accent ?? "#ff7a86";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.arc(cx - s * .14, s * .58, s * .28, 0, Math.PI * 2);
	ctx.arc(cx + s * .14, s * .58, s * .28, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = light;
	ctx.beginPath();
	ctx.ellipse(cx - s * .14, s * .46, s * .07, s * .11, -.4, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = "#6b3a1e";
	ctx.lineWidth = Math.max(1, s * .06);
	ctx.beginPath();
	ctx.moveTo(cx, s * .36);
	ctx.lineTo(cx, s * .2);
	ctx.stroke();
	ctx.fillStyle = "#3fae4a";
	ctx.beginPath();
	ctx.ellipse(cx + s * .12, s * .22, s * .12, s * .06, -.6, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Pair of red cherries on a forked green stem. Use for bonus pickups, fruit collectibles. */
function cherry(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#e02046";
	const light = opts.accent ?? "#ff6a86";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.strokeStyle = "#3fae4a";
	ctx.lineWidth = Math.max(1, s * .06);
	ctx.beginPath();
	ctx.moveTo(s * .5, s * .18);
	ctx.quadraticCurveTo(s * .3, s * .4, s * .32, s * .62);
	ctx.moveTo(s * .5, s * .18);
	ctx.quadraticCurveTo(s * .7, s * .4, s * .68, s * .62);
	ctx.stroke();
	for (const dx of [-.18, .18]) {
		ctx.fillStyle = col;
		ctx.beginPath();
		ctx.arc(s * (.5 + dx), s * .72, s * .2, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = light;
		ctx.beginPath();
		ctx.arc(s * (.5 + dx) - s * .06, s * .66, s * .06, 0, Math.PI * 2);
		ctx.fill();
	}
	return canvas;
}
/** Vertical sword pointing up — tapered blade, cross-guard, leather grip, round pommel. Use for melee weapon pickups. */
function sword(opts = {}) {
	const s = opts.size ?? 16;
	const blade = opts.color ?? "#dbe2ea";
	const edge = opts.accent ?? "#9aa7b4";
	const gold = opts.detail ?? "#e0b53a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = blade;
	poly(ctx, [
		[cx, s * .06],
		[cx + s * .09, s * .2],
		[cx + s * .06, s * .62],
		[cx - s * .06, s * .62],
		[cx - s * .09, s * .2]
	]);
	ctx.fill();
	ctx.fillStyle = edge;
	ctx.fillRect(cx - .5, s * .14, 1, s * .46);
	ctx.fillStyle = gold;
	ctx.fillRect(cx - s * .22, s * .6, s * .44, s * .07);
	ctx.fillStyle = "#7a4a24";
	ctx.fillRect(cx - s * .05, s * .66, s * .1, s * .22);
	ctx.fillStyle = gold;
	ctx.beginPath();
	ctx.arc(cx, s * .9, s * .07, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Heater shield with a gold rim and cross emblem — use for defensive item pickups, knight / warrior characters. */
function shield(opts = {}) {
	const s = opts.size ?? 16;
	const face = opts.color ?? "#c0492f";
	const rim = opts.detail ?? "#d8b24a";
	const boss = opts.accent ?? "#ece4d4";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = rim;
	poly(ctx, [
		[s * .16, s * .14],
		[s * .84, s * .14],
		[s * .84, s * .5],
		[cx, s * .92],
		[s * .16, s * .5]
	]);
	ctx.fill();
	ctx.fillStyle = face;
	poly(ctx, [
		[s * .25, s * .21],
		[s * .75, s * .21],
		[s * .75, s * .49],
		[cx, s * .82],
		[s * .25, s * .49]
	]);
	ctx.fill();
	ctx.fillStyle = boss;
	ctx.fillRect(cx - s * .04, s * .27, s * .08, s * .36);
	ctx.fillRect(s * .33, s * .37, s * .34, s * .08);
	return canvas;
}
function drawPerson(ctx, ox, s, legSwing, armSwing, bob, jump, p) {
	const cx = ox + s * .5;
	const headR = s * .13;
	const headY = s * .2 - bob;
	const shoulderY = s * .37 - bob;
	const hipY = s * .62 - bob;
	const footY = s * .88;
	const shoe = "#3a2a1a";
	let frontX;
	let backX;
	let frontY;
	let backY;
	if (jump) {
		frontX = cx + s * .16;
		frontY = hipY + s * .14;
		backX = cx - s * .05;
		backY = hipY + s * .2;
	} else {
		frontX = cx + legSwing * s * .16;
		frontY = footY;
		backX = cx - legSwing * s * .16;
		backY = footY;
	}
	ctx.strokeStyle = p.pants;
	ctx.lineWidth = Math.max(1.6, s * .12);
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(cx, hipY);
	ctx.lineTo(frontX, frontY);
	ctx.moveTo(cx, hipY);
	ctx.lineTo(backX, backY);
	ctx.stroke();
	ctx.strokeStyle = shoe;
	ctx.lineWidth = Math.max(1.6, s * .13);
	ctx.beginPath();
	ctx.moveTo(backX - s * .02, backY);
	ctx.lineTo(backX + s * .1, backY);
	ctx.moveTo(frontX - s * .02, frontY);
	ctx.lineTo(frontX + s * .1, frontY);
	ctx.stroke();
	ctx.fillStyle = p.shirt;
	ctx.fillRect(cx - s * .11, shoulderY, s * .22, hipY - shoulderY + s * .02);
	ctx.strokeStyle = p.skin;
	ctx.lineWidth = Math.max(1.3, s * .09);
	ctx.beginPath();
	if (jump) {
		ctx.moveTo(cx + s * .02, shoulderY + s * .02);
		ctx.lineTo(cx + s * .16, shoulderY - s * .05);
		ctx.moveTo(cx - s * .02, shoulderY + s * .02);
		ctx.lineTo(cx - s * .11, shoulderY - s * .02);
	} else {
		ctx.moveTo(cx, shoulderY + s * .02);
		ctx.lineTo(cx + armSwing * s * .13, shoulderY + s * .18);
		ctx.moveTo(cx, shoulderY + s * .02);
		ctx.lineTo(cx - armSwing * s * .13, shoulderY + s * .18);
	}
	ctx.stroke();
	ctx.fillStyle = p.skin;
	ctx.beginPath();
	ctx.arc(cx + s * .02, headY, headR, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = p.cap;
	ctx.beginPath();
	ctx.arc(cx + s * .02, headY, headR, Math.PI, 0);
	ctx.fill();
	ctx.fillRect(cx + s * .02, headY - headR * .55, headR * 1.5, Math.max(1, s * .06));
	ctx.fillStyle = "#222";
	ctx.fillRect(Math.round(cx + headR * .6), Math.round(headY - 1), 1, 2);
}
/**
* Side-view running person (player character) — 6-frame strip: frame 0 idle, frames 1–4 run cycle, frame 5 jump.
* Use with `addAnim('run', t, [1,2,3,4])`. Default palette: red cap, blue trousers.
*/
function personSheet(opts = {}) {
	const s = opts.size ?? 16;
	const shirt = opts.color ?? "#d8413a";
	const p = {
		skin: opts.accent ?? "#f1c27d",
		shirt,
		cap: shirt,
		pants: opts.detail ?? "#2b53c0"
	};
	const { canvas, ctx } = makeCanvas(s * 6, s);
	drawPerson(ctx, 0, s, 0, 0, 0, false, p);
	const legs = [
		1,
		0,
		-1,
		0
	];
	const bobs = [
		0,
		s * .03,
		0,
		s * .03
	];
	for (let i = 0; i < 4; i++) drawPerson(ctx, (i + 1) * s, s, legs[i], -legs[i], bobs[i], false, p);
	drawPerson(ctx, 5 * s, s, 0, 0, s * .04, true, p);
	return canvas;
}
/** The Anthropic Claude mascot — clay-orange sunburst disc with a friendly face. */
function claude(opts = {}) {
	const s = opts.size ?? 16;
	const clay = opts.color ?? "#d97757";
	const ink = opts.detail ?? "#2b2118";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const cy = s * .52;
	const r = s * .28;
	ctx.strokeStyle = clay;
	ctx.lineWidth = Math.max(1.4, s * .09);
	ctx.lineCap = "round";
	for (let i = 0; i < 12; i++) {
		const a = i * Math.PI / 6;
		ctx.beginPath();
		ctx.moveTo(cx + Math.cos(a) * r * .95, cy + Math.sin(a) * r * .95);
		ctx.lineTo(cx + Math.cos(a) * r * 1.5, cy + Math.sin(a) * r * 1.5);
		ctx.stroke();
	}
	ctx.fillStyle = clay;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = ink;
	ctx.beginPath();
	ctx.arc(cx - r * .38, cy - r * .05, r * .15, 0, Math.PI * 2);
	ctx.arc(cx + r * .38, cy - r * .05, r * .15, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = ink;
	ctx.lineWidth = Math.max(1, s * .05);
	ctx.beginPath();
	ctx.arc(cx, cy + r * .1, r * .42, .15 * Math.PI, .85 * Math.PI);
	ctx.stroke();
	return canvas;
}
/** Pac-Man-style ghost — rounded top with a scalloped skirt and dot eyes. Use for enemy characters in maze or horror games. */
function ghost(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#ff6ad5";
	const ink = opts.detail ?? "#1b2a4a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const r = s * .34;
	const topY = s * .2;
	const by = topY + r + r * .95;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.arc(cx, topY + r, r, Math.PI, 0);
	ctx.lineTo(cx + r, by);
	const n = 3;
	const step = 2 * r / n;
	for (let i = 0; i < n; i++) {
		const x = cx + r - step * i;
		ctx.lineTo(x - step / 2, by - r * .28);
		ctx.lineTo(x - step, by);
	}
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = "#fff";
	ctx.beginPath();
	ctx.arc(cx - r * .4, topY + r * .95, r * .3, 0, Math.PI * 2);
	ctx.arc(cx + r * .4, topY + r * .95, r * .3, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = ink;
	ctx.beginPath();
	ctx.arc(cx - r * .28, topY + r * 1.05, r * .14, 0, Math.PI * 2);
	ctx.arc(cx + r * .52, topY + r * 1.05, r * .14, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Green alien — rounded head with large almond eyes, antennae with bulb tips. Use for space / sci-fi enemy characters. */
function alien(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#5bff7a";
	const ink = opts.detail ?? "#15402a";
	const glint = opts.accent ?? "#ffffff";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.strokeStyle = col;
	ctx.lineWidth = Math.max(1, s * .06);
	ctx.beginPath();
	ctx.moveTo(cx - s * .14, s * .34);
	ctx.lineTo(cx - s * .24, s * .1);
	ctx.moveTo(cx + s * .14, s * .34);
	ctx.lineTo(cx + s * .24, s * .1);
	ctx.stroke();
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.arc(cx - s * .24, s * .1, s * .06, 0, Math.PI * 2);
	ctx.arc(cx + s * .24, s * .1, s * .06, 0, Math.PI * 2);
	ctx.fill();
	ctx.beginPath();
	ctx.ellipse(cx, s * .56, s * .35, s * .33, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = ink;
	ctx.beginPath();
	ctx.ellipse(cx - s * .14, s * .56, s * .1, s * .15, .3, 0, Math.PI * 2);
	ctx.ellipse(cx + s * .14, s * .56, s * .1, s * .15, -.3, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = glint;
	ctx.beginPath();
	ctx.arc(cx - s * .17, s * .49, s * .035, 0, Math.PI * 2);
	ctx.arc(cx + s * .11, s * .49, s * .035, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Slime blob enemy — rounded teardrop body with dot eyes. Use for basic enemy sprites in platformers or RPGs. */
function slime(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#52c7e6";
	const light = opts.accent ?? "#a6ecf7";
	const ink = opts.detail ?? "#16384a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.moveTo(s * .12, s * .85);
	ctx.quadraticCurveTo(s * .05, s * .3, cx, s * .22);
	ctx.quadraticCurveTo(s * .95, s * .3, s * .88, s * .85);
	ctx.quadraticCurveTo(cx, s * .74, s * .12, s * .85);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = light;
	ctx.beginPath();
	ctx.ellipse(cx - s * .16, s * .4, s * .08, s * .12, -.3, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = ink;
	ctx.beginPath();
	ctx.arc(cx - s * .14, s * .55, s * .06, 0, Math.PI * 2);
	ctx.arc(cx + s * .14, s * .55, s * .06, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Blocky robot — rectangular head and body with glowing blue eyes and a centre antenna. Use for sci-fi enemies or NPCs. */
function robot(opts = {}) {
	const s = opts.size ?? 16;
	const body = opts.color ?? "#9aa7b4";
	const dark = opts.detail ?? "#5a6672";
	const eye = opts.accent ?? "#6ad5ff";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.strokeStyle = dark;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(s / 2, s * .06);
	ctx.lineTo(s / 2, s * .18);
	ctx.stroke();
	ctx.fillStyle = eye;
	ctx.beginPath();
	ctx.arc(s / 2, s * .05, s * .05, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = body;
	ctx.fillRect(s * .24, s * .2, s * .52, s * .42);
	ctx.fillRect(s * .3, s * .6, s * .4, s * .3);
	ctx.fillStyle = dark;
	ctx.fillRect(s * .12, s * .64, s * .18, s * .1);
	ctx.fillRect(s * .7, s * .64, s * .18, s * .1);
	ctx.fillStyle = eye;
	ctx.fillRect(s * .32, s * .32, s * .14, s * .12);
	ctx.fillRect(s * .54, s * .32, s * .14, s * .12);
	ctx.fillStyle = dark;
	ctx.fillRect(s * .36, s * .5, s * .28, s * .04);
	return canvas;
}
/** Top-down arcade spaceship pointing up — swept hull, swept wings, cockpit dome, engine exhaust. Use for shoot-em-up player ships. */
function spaceship(opts = {}) {
	const s = opts.size ?? 16;
	const body = opts.color ?? "#cfd8e3";
	const wing = opts.detail ?? "#7d8a9c";
	const glass = opts.accent ?? "#5bd6ff";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = wing;
	poly(ctx, [
		[s * .08, s * .86],
		[s * .3, s * .5],
		[s * .3, s * .86]
	]);
	ctx.fill();
	poly(ctx, [
		[s * .92, s * .86],
		[s * .7, s * .5],
		[s * .7, s * .86]
	]);
	ctx.fill();
	ctx.fillStyle = body;
	poly(ctx, [
		[cx, s * .08],
		[s * .72, s * .82],
		[cx, s * .7],
		[s * .28, s * .82]
	]);
	ctx.fill();
	ctx.fillStyle = glass;
	ctx.beginPath();
	ctx.arc(cx, s * .42, s * .1, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = "#ff8a1e";
	ctx.fillRect(cx - s * .06, s * .82, s * .12, s * .12);
	return canvas;
}
/** Side-view rocket pointing up — tapered body, delta fins, porthole, flame plume. Use for launch sequences, missile sprites. */
function rocket(opts = {}) {
	const s = opts.size ?? 16;
	const body = opts.color ?? "#eef2f6";
	const fin = opts.detail ?? "#e23d4c";
	const glass = opts.accent ?? "#5bd6ff";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = fin;
	poly(ctx, [
		[s * .3, s * .62],
		[s * .16, s * .86],
		[s * .3, s * .82]
	]);
	ctx.fill();
	poly(ctx, [
		[s * .7, s * .62],
		[s * .84, s * .86],
		[s * .7, s * .82]
	]);
	ctx.fill();
	ctx.fillStyle = body;
	ctx.beginPath();
	ctx.moveTo(cx, s * .06);
	ctx.quadraticCurveTo(s * .72, s * .4, s * .68, s * .82);
	ctx.lineTo(s * .32, s * .82);
	ctx.quadraticCurveTo(s * .28, s * .4, cx, s * .06);
	ctx.fill();
	ctx.fillStyle = glass;
	ctx.beginPath();
	ctx.arc(cx, s * .4, s * .1, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = "#ff8a1e";
	poly(ctx, [
		[s * .4, s * .82],
		[cx, s * .98],
		[s * .6, s * .82]
	]);
	ctx.fill();
	return canvas;
}
/** Side-view car — body, windscreen, headlight, two wheels with hub caps. Use for racing or driving games. */
function car(opts = {}) {
	const s = opts.size ?? 16;
	const body = opts.color ?? "#e23d4c";
	const glass = opts.accent ?? "#bfe6ff";
	const tyre = opts.detail ?? "#23262e";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = body;
	ctx.fillRect(s * .06, s * .5, s * .88, s * .22);
	poly(ctx, [
		[s * .26, s * .5],
		[s * .36, s * .3],
		[s * .66, s * .3],
		[s * .76, s * .5]
	]);
	ctx.fill();
	ctx.fillStyle = glass;
	poly(ctx, [
		[s * .32, s * .48],
		[s * .39, s * .34],
		[s * .62, s * .34],
		[s * .68, s * .48]
	]);
	ctx.fill();
	ctx.fillStyle = "#ffd23f";
	ctx.fillRect(s * .9, s * .54, s * .06, s * .08);
	ctx.fillStyle = tyre;
	for (const wx of [.3, .72]) {
		ctx.beginPath();
		ctx.arc(s * wx, s * .74, s * .12, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = "#8a929c";
		ctx.beginPath();
		ctx.arc(s * wx, s * .74, s * .05, 0, Math.PI * 2);
		ctx.fill();
		ctx.fillStyle = tyre;
	}
	return canvas;
}
/** Side-view lorry / truck — trailer box, cab with window, three wheels. Use for delivery or road obstacle sprites. */
function truck(opts = {}) {
	const s = opts.size ?? 16;
	const cab = opts.color ?? "#2f80d9";
	const box = opts.accent ?? "#e8ecf0";
	const tyre = opts.detail ?? "#23262e";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = box;
	ctx.fillRect(s * .06, s * .24, s * .56, s * .42);
	ctx.strokeStyle = "#b6bcc4";
	ctx.lineWidth = 1;
	ctx.strokeRect(s * .06, s * .24, s * .56, s * .42);
	ctx.fillStyle = cab;
	ctx.fillRect(s * .64, s * .4, s * .3, s * .26);
	poly(ctx, [
		[s * .64, s * .4],
		[s * .7, s * .26],
		[s * .84, s * .26],
		[s * .84, s * .4]
	]);
	ctx.fill();
	ctx.fillStyle = "#bfe6ff";
	ctx.fillRect(s * .72, s * .3, s * .1, s * .1);
	ctx.fillStyle = tyre;
	for (const wx of [
		.24,
		.5,
		.78
	]) {
		ctx.beginPath();
		ctx.arc(s * wx, s * .72, s * .11, 0, Math.PI * 2);
		ctx.fill();
	}
	return canvas;
}
/** Sun with 8 radiating rays and a smiling face. Use for sky decoration, weather indicators. */
function sun(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#ffd23f";
	const ray = opts.accent ?? "#ffb01e";
	const ink = opts.detail ?? "#b06a00";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const cy = s / 2;
	const r = s * .26;
	ctx.strokeStyle = ray;
	ctx.lineWidth = Math.max(1.2, s * .07);
	ctx.lineCap = "round";
	for (let i = 0; i < 8; i++) {
		const a = i * Math.PI / 4;
		ctx.beginPath();
		ctx.moveTo(cx + Math.cos(a) * r * 1.2, cy + Math.sin(a) * r * 1.2);
		ctx.lineTo(cx + Math.cos(a) * r * 1.7, cy + Math.sin(a) * r * 1.7);
		ctx.stroke();
	}
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = ink;
	ctx.beginPath();
	ctx.arc(cx - r * .4, cy - r * .1, r * .12, 0, Math.PI * 2);
	ctx.arc(cx + r * .4, cy - r * .1, r * .12, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = ink;
	ctx.lineWidth = Math.max(1, s * .05);
	ctx.beginPath();
	ctx.arc(cx, cy + r * .05, r * .45, .15 * Math.PI, .85 * Math.PI);
	ctx.stroke();
	return canvas;
}
function drawFlame(ctx, bx, by, w, h, col) {
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.moveTo(bx, by);
	ctx.quadraticCurveTo(bx - w, by - h * .5, bx, by - h);
	ctx.quadraticCurveTo(bx + w, by - h * .5, bx, by);
	ctx.fill();
}
/**
* Animated wall torch — 3-frame flicker strip (flame sways left / centre / right).
* Use as a `SpriteSheet` for dungeon, cave, or castle wall light sources.
*/
function torchSheet(opts = {}) {
	const s = opts.size ?? 16;
	const wood = opts.detail ?? "#7a4a24";
	const outer = "#ff5a1e";
	const mid = "#ff9a1e";
	const inner = opts.color ?? "#ffe06a";
	const { canvas, ctx } = makeCanvas(s * 3, s);
	for (let f = 0; f < 3; f++) {
		const cx = f * s + s / 2;
		ctx.fillStyle = wood;
		ctx.fillRect(cx - s * .08, s * .55, s * .16, s * .4);
		ctx.fillStyle = "#caa11e";
		ctx.fillRect(cx - s * .12, s * .5, s * .24, s * .08);
		const sway = (f - 1) * s * .07;
		const hh = s * (.46 + .04 * (f % 2));
		drawFlame(ctx, cx + sway, s * .52, s * .3, hh, outer);
		drawFlame(ctx, cx + sway * .5, s * .52, s * .2, hh * .78, mid);
		drawFlame(ctx, cx, s * .52, s * .1, hh * .5, inner);
	}
	return canvas;
}
/** Round bomb with a curved lit fuse and glinting body. Use for throwable weapons, hazards, countdown objects. */
function bomb(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#2b2f38";
	const shine = opts.accent ?? "#6b7280";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.arc(cx, s * .62, s * .3, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = shine;
	ctx.beginPath();
	ctx.arc(cx - s * .1, s * .52, s * .07, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = "#8a929c";
	ctx.fillRect(cx - s * .08, s * .28, s * .16, s * .08);
	ctx.strokeStyle = "#caa11e";
	ctx.lineWidth = Math.max(1, s * .05);
	ctx.beginPath();
	ctx.moveTo(cx, s * .28);
	ctx.quadraticCurveTo(s * .75, s * .18, s * .72, s * .06);
	ctx.stroke();
	ctx.fillStyle = "#ff8a1e";
	ctx.beginPath();
	ctx.arc(s * .72, s * .06, s * .06, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Round deciduous tree — brown trunk, dark green foliage cluster. Use for forest / outdoor scenery. */
function tree(opts = {}) {
	const s = opts.size ?? 16;
	const leaf = opts.color ?? "#3fae4a";
	const dark = opts.accent ?? "#2c7d36";
	const trunk = opts.detail ?? "#7a4a24";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = trunk;
	ctx.fillRect(cx - s * .07, s * .6, s * .14, s * .34);
	ctx.fillStyle = dark;
	ctx.beginPath();
	ctx.arc(cx, s * .4, s * .34, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = leaf;
	ctx.beginPath();
	ctx.arc(cx - s * .12, s * .36, s * .2, 0, Math.PI * 2);
	ctx.arc(cx + s * .14, s * .42, s * .18, 0, Math.PI * 2);
	ctx.arc(cx, s * .26, s * .18, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Fluffy white cloud — three overlapping circular puffs. Use for sky backgrounds, parallax layers, weather sprites. */
function cloud(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#eef3f8";
	const shade = opts.detail ?? "#cdd8e2";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = shade;
	ctx.beginPath();
	ctx.arc(s * .34, s * .62, s * .2, 0, Math.PI * 2);
	ctx.arc(s * .54, s * .66, s * .22, 0, Math.PI * 2);
	ctx.arc(s * .72, s * .6, s * .18, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.arc(s * .36, s * .5, s * .18, 0, Math.PI * 2);
	ctx.arc(s * .56, s * .46, s * .22, 0, Math.PI * 2);
	ctx.arc(s * .74, s * .52, s * .16, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
function disc(ctx, x, y, r, fill) {
	ctx.fillStyle = fill;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
}
/** Orange citrus fruit with a highlight and green leaf. Use for food pickups, collectible items. */
function orange(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#ff8c1a";
	const light = opts.accent ?? "#ffc070";
	const leaf = opts.detail ?? "#3fae4a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	disc(ctx, cx, s * .58, s * .34, col);
	disc(ctx, cx - s * .12, s * .46, s * .1, light);
	ctx.fillStyle = leaf;
	ctx.beginPath();
	ctx.ellipse(cx + s * .1, s * .24, s * .1, s * .05, -.6, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Yellow lemon with pointed nubs and a highlight. Use for food pickups, sour-themed collectibles. */
function lemon(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#f2d11e";
	const light = opts.accent ?? "#fbef9a";
	const tip = opts.detail ?? "#d9b414";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.ellipse(cx, s * .55, s * .36, s * .24, 0, 0, Math.PI * 2);
	ctx.fill();
	disc(ctx, s * .16, s * .55, s * .05, tip);
	disc(ctx, s * .84, s * .55, s * .05, tip);
	ctx.fillStyle = light;
	ctx.beginPath();
	ctx.ellipse(cx - s * .08, s * .46, s * .12, s * .06, -.3, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Purple bunch of grapes — three rows of berries narrowing to a point, stem and leaf. Use for fruit pickups, vineyard-themed games. */
function grapes(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#7d4fc7";
	const light = opts.accent ?? "#a884e0";
	const leaf = opts.detail ?? "#3fae4a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.strokeStyle = "#6b3a1e";
	ctx.lineWidth = Math.max(1, s * .06);
	ctx.beginPath();
	ctx.moveTo(cx, s * .28);
	ctx.lineTo(cx, s * .12);
	ctx.stroke();
	ctx.fillStyle = leaf;
	ctx.beginPath();
	ctx.ellipse(cx + s * .12, s * .14, s * .1, s * .05, -.5, 0, Math.PI * 2);
	ctx.fill();
	const r = s * .11;
	const rows = [
		[
			cx - r * 1.6,
			cx,
			cx + r * 1.6
		],
		[cx - r * .9, cx + r * .9],
		[cx]
	];
	for (let ri = 0; ri < rows.length; ri++) {
		const y = s * .36 + ri * r * 1.5;
		for (const x of rows[ri]) disc(ctx, x, y, r, col);
	}
	disc(ctx, cx - r * 1.6 - r * .3, s * .36 - r * .3, r * .35, light);
	disc(ctx, cx - r * .3, s * .36 + r * 1.5 - r * .3, r * .35, light);
	return canvas;
}
/** Yellow banana — thick crescent arc with brown tip dots. Use for food pickups, jungle-themed collectibles. */
function banana(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#f4d03f";
	const tip = opts.detail ?? "#6e4a25";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.strokeStyle = col;
	ctx.lineWidth = s * .2;
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.arc(s / 2, s * .18, s * .44, Math.PI * .18, Math.PI * .82);
	ctx.stroke();
	disc(ctx, s / 2 + Math.cos(Math.PI * .18) * s * .44, s * .18 + Math.sin(Math.PI * .18) * s * .44, s * .05, tip);
	disc(ctx, s / 2 + Math.cos(Math.PI * .82) * s * .44, s * .18 + Math.sin(Math.PI * .82) * s * .44, s * .05, tip);
	return canvas;
}
/** Red strawberry with a star-shaped calyx and seed dots. Use for food pickups, garden or farming game collectibles. */
function strawberry(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#e23048";
	const seed = opts.accent ?? "#ffe08a";
	const leaf = opts.detail ?? "#3fae4a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.moveTo(s * .2, s * .42);
	ctx.quadraticCurveTo(cx, s * .26, s * .8, s * .42);
	ctx.quadraticCurveTo(cx, s * 1.02, s * .2, s * .42);
	ctx.closePath();
	ctx.fill();
	ctx.fillStyle = leaf;
	poly(ctx, starPoints(cx, s * .36, s * .18, s * .07, 5, -Math.PI / 2));
	ctx.fill();
	ctx.fillStyle = seed;
	for (const [fx, fy] of [
		[.42, .55],
		[.58, .55],
		[.5, .66],
		[.38, .66],
		[.62, .66],
		[.5, .78]
	]) ctx.fillRect(Math.round(s * fx), Math.round(s * fy), 1, 1);
	return canvas;
}
/** Green pear — bulb body with narrow neck, brown stem, highlight. Use for food pickups, orchard collectibles. */
function pear(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#a6c44a";
	const light = opts.accent ?? "#cfe07a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	disc(ctx, cx, s * .64, s * .27, col);
	disc(ctx, cx, s * .4, s * .16, col);
	ctx.fillStyle = col;
	ctx.fillRect(cx - s * .16, s * .4, s * .32, s * .24);
	ctx.strokeStyle = "#6b3a1e";
	ctx.lineWidth = Math.max(1, s * .05);
	ctx.beginPath();
	ctx.moveTo(cx, s * .26);
	ctx.lineTo(cx + s * .03, s * .14);
	ctx.stroke();
	disc(ctx, cx - s * .1, s * .56, s * .08, light);
	return canvas;
}
/** Green watermelon with dark stripe arcs and a flesh-coloured sheen. Use for summer / tropical food pickups. */
function watermelon(opts = {}) {
	const s = opts.size ?? 16;
	const rind = opts.color ?? "#3a8f3a";
	const stripe = opts.detail ?? "#256025";
	opts.accent;
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	disc(ctx, cx, s / 2, s * .4, rind);
	ctx.strokeStyle = stripe;
	ctx.lineWidth = Math.max(1, s * .06);
	for (const off of [
		-.2,
		0,
		.2
	]) {
		ctx.beginPath();
		ctx.moveTo(cx + off * s, s * .14);
		ctx.quadraticCurveTo(cx + off * s * 1.6, s / 2, cx + off * s, s * .86);
		ctx.stroke();
	}
	disc(ctx, cx - s * .14, s * .36, s * .06, "#bfe6a0");
	return canvas;
}
/** Peach / apricot with a vertical crease arc, highlight, and green leaf. Use for food pickups in orchard or farm games. */
function peach(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#ffae7a";
	const light = opts.accent ?? "#ffd2b0";
	const crease = opts.detail ?? "#e8895c";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	disc(ctx, cx, s * .56, s * .34, col);
	ctx.strokeStyle = crease;
	ctx.lineWidth = Math.max(1, s * .05);
	ctx.beginPath();
	ctx.arc(cx + s * .06, s * .56, s * .32, -Math.PI * .42, Math.PI * .42);
	ctx.stroke();
	disc(ctx, cx - s * .12, s * .44, s * .09, light);
	ctx.fillStyle = "#3fae4a";
	ctx.beginPath();
	ctx.ellipse(cx + s * .08, s * .24, s * .09, s * .045, -.6, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Purple plum — oval body with a crease arc and highlight. Use for food pickups, orchard collectibles. */
function plum(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#7a3f9e";
	const light = opts.accent ?? "#a86cc7";
	const crease = opts.detail ?? "#5a2d77";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.ellipse(cx, s * .56, s * .3, s * .34, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.strokeStyle = crease;
	ctx.lineWidth = Math.max(1, s * .05);
	ctx.beginPath();
	ctx.arc(cx + s * .05, s * .56, s * .3, -Math.PI * .45, Math.PI * .45);
	ctx.stroke();
	disc(ctx, cx - s * .1, s * .42, s * .08, light);
	return canvas;
}
/** Glossy oval ruby cabochon — red with a soft highlight. Use for rare gem pickups, RPG loot, score bonuses. */
function ruby(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#e02046";
	const light = opts.accent ?? "#ff7a93";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.ellipse(cx, s / 2, s * .34, s * .26, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = light;
	ctx.beginPath();
	ctx.ellipse(cx - s * .1, s * .4, s * .12, s * .07, -.4, 0, Math.PI * 2);
	ctx.fill();
	return canvas;
}
/** Rectangular step-cut emerald with chamfered corners and inner facet lines. Use for green gem pickups, RPG loot. */
function emerald(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#1eb877";
	const light = opts.accent ?? "#7af0c0";
	const dark = opts.detail ?? "#0e7a4c";
	const { canvas, ctx } = makeCanvas(s, s);
	const c = s * .12;
	poly(ctx, [
		[s * .22 + c, s * .28],
		[s * .78 - c, s * .28],
		[s * .78, s * .28 + c],
		[s * .78, s * .72 - c],
		[s * .78 - c, s * .72],
		[s * .22 + c, s * .72],
		[s * .22, s * .72 - c],
		[s * .22, s * .28 + c]
	]);
	ctx.fillStyle = col;
	ctx.fill();
	ctx.strokeStyle = dark;
	ctx.lineWidth = 1;
	ctx.strokeRect(s * .3, s * .36, s * .4, s * .28);
	ctx.fillStyle = light;
	ctx.fillRect(s * .3, s * .36, s * .4, 1);
	return canvas;
}
/** Round brilliant-cut sapphire — blue disc with 8 radiating facet spokes and a light table. Use for blue gem pickups, RPG loot. */
function sapphire(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#2f6bff";
	const light = opts.accent ?? "#9fc0ff";
	const dark = opts.detail ?? "#1c3fa8";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const cy = s / 2;
	const r = s * .34;
	disc(ctx, cx, cy, r, col);
	ctx.strokeStyle = dark;
	ctx.lineWidth = 1;
	for (let i = 0; i < 8; i++) {
		const a = i / 8 * Math.PI * 2;
		ctx.beginPath();
		ctx.moveTo(cx, cy);
		ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
		ctx.stroke();
	}
	disc(ctx, cx, cy, s * .1, light);
	return canvas;
}
/** Pointed-cut amethyst — purple pentagon shape with a bright crown facet. Use for purple gem pickups, magic items. */
function amethyst(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#9b5cff";
	const light = opts.accent ?? "#c9a6ff";
	const dark = opts.detail ?? "#6a32c0";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	poly(ctx, [
		[s * .3, s * .3],
		[s * .7, s * .3],
		[s * .82, s * .46],
		[cx, s * .82],
		[s * .18, s * .46]
	]);
	ctx.fillStyle = col;
	ctx.fill();
	ctx.strokeStyle = dark;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(s * .18, s * .46);
	ctx.lineTo(s * .82, s * .46);
	ctx.moveTo(s * .3, s * .3);
	ctx.lineTo(cx, s * .82);
	ctx.moveTo(s * .7, s * .3);
	ctx.lineTo(cx, s * .82);
	ctx.stroke();
	ctx.fillStyle = light;
	poly(ctx, [
		[s * .3, s * .3],
		[s * .7, s * .3],
		[s * .62, s * .46],
		[s * .38, s * .46]
	]);
	ctx.fill();
	return canvas;
}
/** Gold ingot / gold bar — isometric parallelogram top face and trapezoid front. Use for treasure, currency, reward items. */
function goldBar(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#f4c023";
	const light = opts.accent ?? "#ffe07a";
	const dark = opts.detail ?? "#c8930f";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = light;
	poly(ctx, [
		[s * .24, s * .42],
		[s * .84, s * .42],
		[s * .72, s * .5],
		[s * .12, s * .5]
	]);
	ctx.fill();
	ctx.fillStyle = col;
	poly(ctx, [
		[s * .12, s * .5],
		[s * .72, s * .5],
		[s * .66, s * .74],
		[s * .18, s * .74]
	]);
	ctx.fill();
	ctx.fillStyle = dark;
	ctx.fillRect(s * .18, s * .72, s * .48, 1);
	return canvas;
}
/** Gold ring with a set diamond-shaped gem — use for RPG equippable accessories, loot, engagement / magic ring items. */
function ring(opts = {}) {
	const s = opts.size ?? 16;
	const gold = opts.color ?? "#f4c023";
	const gemCol = opts.accent ?? "#2f6bff";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.strokeStyle = gold;
	ctx.lineWidth = s * .12;
	ctx.beginPath();
	ctx.arc(cx, s * .62, s * .26, 0, Math.PI * 2);
	ctx.stroke();
	poly(ctx, [
		[cx, s * .12],
		[cx + s * .12, s * .28],
		[cx, s * .42],
		[cx - s * .12, s * .28]
	]);
	ctx.fillStyle = gemCol;
	ctx.fill();
	disc(ctx, cx - s * .03, s * .24, s * .03, "#fff");
	return canvas;
}
/** Gold crown with three points and gem jewels — use for royalty, boss loot, leaderboard trophies. */
function crown(opts = {}) {
	const s = opts.size ?? 16;
	const gold = opts.color ?? "#f4c023";
	const dark = opts.detail ?? "#c8930f";
	const jewel = opts.accent ?? "#e02046";
	const { canvas, ctx } = makeCanvas(s, s);
	poly(ctx, [
		[s * .16, s * .72],
		[s * .16, s * .38],
		[s * .32, s * .56],
		[s * .5, s * .3],
		[s * .68, s * .56],
		[s * .84, s * .38],
		[s * .84, s * .72]
	]);
	ctx.fillStyle = gold;
	ctx.fill();
	ctx.fillStyle = dark;
	ctx.fillRect(s * .16, s * .68, s * .68, s * .04);
	disc(ctx, s * .16, s * .38, s * .05, jewel);
	disc(ctx, s * .5, s * .3, s * .06, jewel);
	disc(ctx, s * .84, s * .38, s * .05, jewel);
	return canvas;
}
/** Lustrous pearl — iridescent white sphere with a soft highlight. Use for rare collectibles, jewellery, ocean-themed loot. */
function pearl(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#eef0f8";
	const shade = opts.detail ?? "#c2c6da";
	const light = opts.accent ?? "#ffffff";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	disc(ctx, cx, s / 2, s * .32, shade);
	disc(ctx, cx + s * .03, s * .53, s * .28, col);
	disc(ctx, cx - s * .1, s * .4, s * .08, light);
	return canvas;
}
/** Flying saucer / UFO — metallic disc body with a glass dome and three under-lights. Use for alien invader, escort, or backdrop sprites. */
function ufo(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#9aa7b4";
	const dome = opts.accent ?? "#7fd0ff";
	const light = opts.detail ?? "#ffd23f";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.ellipse(cx, s * .6, s * .42, s * .15, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = dome;
	ctx.beginPath();
	ctx.ellipse(cx, s * .52, s * .2, s * .18, 0, Math.PI, 0);
	ctx.fill();
	ctx.fillStyle = light;
	for (const o of [
		-.22,
		0,
		.22
	]) disc(ctx, cx + o * s, s * .68, s * .04, light);
	return canvas;
}
/** Planet with two equatorial band stripes and a polar highlight. Use for space backgrounds, level-select screens. */
function planet(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#c86b4a";
	const band = opts.detail ?? "#9c4e34";
	const light = opts.accent ?? "#e89a78";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const cy = s / 2;
	const r = s * .36;
	disc(ctx, cx, cy, r, col);
	ctx.save();
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.clip();
	ctx.fillStyle = band;
	for (const by of [.42, .62]) {
		ctx.beginPath();
		ctx.ellipse(cx, s * by, r * 1.1, r * .16, 0, 0, Math.PI * 2);
		ctx.fill();
	}
	ctx.restore();
	disc(ctx, cx - r * .4, cy - r * .4, r * .22, light);
	return canvas;
}
/** Saturn-style ringed planet — planet disc with a tilted elliptical ring drawn front and back. Use for space scenery, level-select worlds. */
function ringedPlanet(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#e0c060";
	const ringCol = opts.accent ?? "#bfa9d6";
	const light = opts.detail ?? "#fff0b0";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const cy = s / 2;
	ctx.strokeStyle = ringCol;
	ctx.lineWidth = Math.max(1, s * .05);
	ctx.beginPath();
	ctx.ellipse(cx, cy, s * .46, s * .17, -.25, 0, Math.PI * 2);
	ctx.stroke();
	disc(ctx, cx, cy, s * .26, col);
	disc(ctx, cx - s * .09, cy - s * .09, s * .08, light);
	ctx.beginPath();
	ctx.ellipse(cx, cy, s * .46, s * .17, -.25, 0, Math.PI);
	ctx.stroke();
	return canvas;
}
/** Grey moon disc with four seeded craters. Use for space backgrounds, night-scene decoration. */
function moon(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#cfd3da";
	const crater = opts.detail ?? "#a3a8b2";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	disc(ctx, cx, s / 2, s * .36, col);
	for (const [ox, oy, cr] of [
		[
			-.1,
			-.1,
			.08
		],
		[
			.14,
			.06,
			.06
		],
		[
			-.04,
			.16,
			.05
		],
		[
			.08,
			-.16,
			.04
		]
	]) disc(ctx, cx + ox * s, s / 2 + oy * s, cr * s, crater);
	return canvas;
}
/** Seeded irregular asteroid with two craters — shape varies per `seed`. Use for space obstacle sprites. */
function asteroid(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#8a8f98";
	const crater = opts.detail ?? "#5f636b";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const cy = s / 2;
	const rand = rng(opts.seed ?? 7);
	const n = 9;
	const pts = [];
	for (let i = 0; i < n; i++) {
		const a = i / n * Math.PI * 2;
		const r = s * (.28 + rand() * .12);
		pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
	}
	poly(ctx, pts);
	ctx.fillStyle = col;
	ctx.fill();
	disc(ctx, cx - s * .08, cy - s * .04, s * .06, crater);
	disc(ctx, cx + s * .1, cy + s * .08, s * .05, crater);
	return canvas;
}
/** Space satellite — rectangular body flanked by two solar panels with grid lines and a dish antenna. Use for sci-fi / space scenery. */
function satellite(opts = {}) {
	const s = opts.size ?? 16;
	const body = opts.color ?? "#c7ccd4";
	const panel = opts.accent ?? "#2f6bff";
	const dark = opts.detail ?? "#3a3f47";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const cy = s / 2;
	ctx.fillStyle = panel;
	ctx.fillRect(s * .06, cy - s * .1, s * .26, s * .2);
	ctx.fillRect(s * .68, cy - s * .1, s * .26, s * .2);
	ctx.fillStyle = dark;
	for (const px of [
		.14,
		.22,
		.74,
		.82
	]) ctx.fillRect(s * px, cy - s * .1, 1, s * .2);
	ctx.fillStyle = body;
	ctx.fillRect(cx - s * .12, cy - s * .13, s * .24, s * .26);
	ctx.strokeStyle = dark;
	ctx.lineWidth = 1;
	ctx.beginPath();
	ctx.moveTo(cx, cy - s * .13);
	ctx.lineTo(cx, cy - s * .28);
	ctx.stroke();
	disc(ctx, cx, cy - s * .3, s * .06, body);
	return canvas;
}
/** Round potion flask with a corked neck and shine dot. Use for health / mana / buff pickups in RPG or adventure games. */
function potion(opts = {}) {
	const s = opts.size ?? 16;
	const liquid = opts.color ?? "#d63ad6";
	const glass = opts.accent ?? "#bfe3ef";
	const cork = opts.detail ?? "#8a5a2a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	disc(ctx, cx, s * .62, s * .28, liquid);
	ctx.fillStyle = glass;
	ctx.fillRect(cx - s * .08, s * .28, s * .16, s * .16);
	ctx.fillStyle = cork;
	ctx.fillRect(cx - s * .1, s * .2, s * .2, s * .09);
	disc(ctx, cx - s * .1, s * .56, s * .05, "#ffffff");
	return canvas;
}
/** Parchment scroll with rolled ends and ink text lines. Use for quest items, spell tomes, note pickups. */
function scroll(opts = {}) {
	const s = opts.size ?? 16;
	const parch = opts.color ?? "#e8d9a8";
	const roll = opts.detail ?? "#c2a85f";
	const ink = opts.accent ?? "#7a6a3a";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = parch;
	ctx.fillRect(s * .26, s * .18, s * .48, s * .64);
	ctx.fillStyle = ink;
	for (const ty of [
		.34,
		.46,
		.58
	]) ctx.fillRect(s * .34, s * ty, s * .32, 1);
	ctx.fillStyle = roll;
	ctx.fillRect(s * .2, s * .14, s * .6, s * .1);
	ctx.fillRect(s * .2, s * .76, s * .6, s * .1);
	return canvas;
}
/** Battle axe — wooden handle with a wedge blade head and edge highlight. Use for melee weapon pickups in RPG or action games. */
function axe(opts = {}) {
	const s = opts.size ?? 16;
	const blade = opts.color ?? "#c7ccd4";
	const handle = opts.detail ?? "#8a5a2a";
	const edge = opts.accent ?? "#eef2f7";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.strokeStyle = handle;
	ctx.lineWidth = Math.max(2, s * .1);
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(s * .4, s * .86);
	ctx.lineTo(s * .58, s * .24);
	ctx.stroke();
	poly(ctx, [
		[s * .5, s * .2],
		[s * .84, s * .3],
		[s * .78, s * .5],
		[s * .46, s * .4]
	]);
	ctx.fillStyle = blade;
	ctx.fill();
	ctx.fillStyle = edge;
	poly(ctx, [
		[s * .78, s * .5],
		[s * .84, s * .3],
		[s * .8, s * .34],
		[s * .74, s * .48]
	]);
	ctx.fill();
	return canvas;
}
/** Mage staff — wooden rod topped with a glowing orb. Use for magic weapon pickups, wizard character equipment. */
function staff(opts = {}) {
	const s = opts.size ?? 16;
	const rod = opts.detail ?? "#8a5a2a";
	const orb = opts.color ?? "#3ad6e0";
	const glow = opts.accent ?? "#bff6fb";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.strokeStyle = rod;
	ctx.lineWidth = Math.max(2, s * .09);
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(cx, s * .92);
	ctx.lineTo(cx, s * .4);
	ctx.stroke();
	disc(ctx, cx, s * .3, s * .16, orb);
	disc(ctx, cx - s * .05, s * .25, s * .05, glow);
	return canvas;
}
/** Treasure chest — wooden body with gold bands and a lock. Use for loot containers, level-end rewards. */
function chest(opts = {}) {
	const s = opts.size ?? 16;
	const wood = opts.color ?? "#9a6b3a";
	const dark = opts.detail ?? "#5e3f20";
	const gold = opts.accent ?? "#f4c023";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = dark;
	ctx.fillRect(s * .16, s * .34, s * .68, s * .16);
	ctx.fillStyle = wood;
	ctx.fillRect(s * .16, s * .5, s * .68, s * .3);
	ctx.fillStyle = gold;
	ctx.fillRect(s * .16, s * .48, s * .68, s * .04);
	ctx.fillRect(s * .22, s * .34, s * .05, s * .46);
	ctx.fillRect(s * .73, s * .34, s * .05, s * .46);
	ctx.fillRect(s * .46, s * .54, s * .08, s * .1);
	return canvas;
}
/** Skull and teeth — cranium, jaw, eye sockets, nose triangle, and tooth marks. Use for death / game-over icons, enemy indicators, horror themes. */
function skull(opts = {}) {
	const s = opts.size ?? 16;
	const bone = opts.color ?? "#eef0e8";
	const ink = opts.detail ?? "#2a2a2a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	disc(ctx, cx, s * .44, s * .3, bone);
	ctx.fillStyle = bone;
	ctx.fillRect(cx - s * .18, s * .56, s * .36, s * .2);
	ctx.fillStyle = ink;
	disc(ctx, cx - s * .12, s * .44, s * .08, ink);
	disc(ctx, cx + s * .12, s * .44, s * .08, ink);
	poly(ctx, [
		[cx, s * .5],
		[cx - s * .04, s * .58],
		[cx + s * .04, s * .58]
	]);
	ctx.fill();
	for (const tx of [
		-.08,
		0,
		.08
	]) ctx.fillRect(Math.round(cx + tx * s), s * .66, 1, s * .1);
	return canvas;
}
/** Simple house — rectangular wall, triangular roof, door, and window. Use for town scenery, village-building games. */
function house(opts = {}) {
	const s = opts.size ?? 16;
	const wall = opts.color ?? "#e8c98f";
	const roof = opts.detail ?? "#b8472f";
	const trim = opts.accent ?? "#6b4a8a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = wall;
	ctx.fillRect(s * .22, s * .46, s * .56, s * .4);
	ctx.fillStyle = roof;
	poly(ctx, [
		[s * .14, s * .48],
		[cx, s * .18],
		[s * .86, s * .48]
	]);
	ctx.fill();
	ctx.fillStyle = trim;
	ctx.fillRect(cx - s * .07, s * .62, s * .14, s * .24);
	ctx.fillStyle = "#7fd0ff";
	ctx.fillRect(s * .28, s * .54, s * .12, s * .12);
	return canvas;
}
/** City skyscraper / office building — tall block with a seeded random lit/unlit window grid. Use for urban backgrounds. */
function building(opts = {}) {
	const s = opts.size ?? 16;
	const wall = opts.color ?? "#5a6b8a";
	const dark = opts.detail ?? "#3c4a63";
	const lit = opts.accent ?? "#ffe27a";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = wall;
	ctx.fillRect(s * .24, s * .12, s * .52, s * .78);
	const rand = rng(opts.seed ?? 5);
	for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) {
		ctx.fillStyle = rand() > .45 ? lit : dark;
		ctx.fillRect(s * (.3 + c * .15), s * (.2 + r * .13), s * .08, s * .08);
	}
	return canvas;
}
/** Traffic light — dark box on a pole with red, amber, and green signal lenses. Use for city / road-crossing games. */
function trafficLight(opts = {}) {
	const s = opts.size ?? 16;
	const box = opts.color ?? "#2c2f36";
	const pole = opts.detail ?? "#6b7079";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = pole;
	ctx.fillRect(cx - s * .03, s * .7, s * .06, s * .28);
	ctx.fillStyle = box;
	ctx.fillRect(cx - s * .16, s * .08, s * .32, s * .62);
	disc(ctx, cx, s * .2, s * .08, "#ff4040");
	disc(ctx, cx, s * .39, s * .08, "#ffc83a");
	disc(ctx, cx, s * .58, s * .08, "#3ad65a");
	return canvas;
}
/** Arrow signpost on a pole pointing right. Use for navigation markers, level direction hints, town decorations. */
function signpost(opts = {}) {
	const s = opts.size ?? 16;
	const sign = opts.color ?? "#2f8f4f";
	const post = opts.detail ?? "#8a8f98";
	const text = opts.accent ?? "#ffffff";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = post;
	ctx.fillRect(cx - s * .03, s * .18, s * .06, s * .78);
	poly(ctx, [
		[s * .2, s * .24],
		[s * .66, s * .24],
		[s * .82, s * .36],
		[s * .66, s * .48],
		[s * .2, s * .48]
	]);
	ctx.fillStyle = sign;
	ctx.fill();
	ctx.fillStyle = text;
	ctx.fillRect(s * .3, s * .35, s * .28, s * .03);
	return canvas;
}
/** Street lamppost — curved arm with a glowing lamp head and hood. Use for city / street scenery in side-scrollers. */
function lamppost(opts = {}) {
	const s = opts.size ?? 16;
	const pole = opts.color ?? "#3a3f47";
	const lamp = opts.accent ?? "#ffe27a";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.strokeStyle = pole;
	ctx.lineWidth = Math.max(1, s * .06);
	ctx.beginPath();
	ctx.moveTo(s * .4, s * .96);
	ctx.lineTo(s * .4, s * .3);
	ctx.quadraticCurveTo(s * .4, s * .18, s * .6, s * .2);
	ctx.stroke();
	disc(ctx, s * .62, s * .28, s * .12, lamp);
	ctx.fillStyle = pole;
	poly(ctx, [
		[s * .5, s * .2],
		[s * .74, s * .2],
		[s * .66, s * .28],
		[s * .58, s * .28]
	]);
	ctx.fill();
	return canvas;
}
/** Red fire hydrant — dome top, side nozzles, base plate. Use for city / street scenery, obstacle sprites. */
function hydrant(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#e23d2c";
	const dark = opts.detail ?? "#a8281b";
	const cap = opts.accent ?? "#f0a030";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.fillRect(cx - s * .12, s * .34, s * .24, s * .46);
	ctx.beginPath();
	ctx.arc(cx, s * .34, s * .12, Math.PI, 0);
	ctx.fill();
	ctx.fillStyle = dark;
	ctx.fillRect(cx - s * .2, s * .44, s * .08, s * .1);
	ctx.fillRect(cx + s * .12, s * .44, s * .08, s * .1);
	ctx.fillStyle = cap;
	disc(ctx, cx, s * .28, s * .05, cap);
	ctx.fillStyle = dark;
	ctx.fillRect(cx - s * .18, s * .8, s * .36, s * .08);
	return canvas;
}
/** Crab-style space invader — oval body with side claws, three bottom legs, and dot eyes. Use for shoot-em-up enemy sprites. */
function crabAlien(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#ff5bd0";
	const ink = opts.detail ?? "#3a1030";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.ellipse(cx, s * .5, s * .34, s * .24, 0, 0, Math.PI * 2);
	ctx.fill();
	disc(ctx, s * .14, s * .46, s * .1, col);
	disc(ctx, s * .86, s * .46, s * .1, col);
	ctx.fillStyle = ink;
	disc(ctx, cx - s * .12, s * .48, s * .06, ink);
	disc(ctx, cx + s * .12, s * .48, s * .06, ink);
	ctx.strokeStyle = col;
	ctx.lineWidth = Math.max(1, s * .05);
	for (const ox of [
		-.16,
		0,
		.16
	]) {
		ctx.beginPath();
		ctx.moveTo(cx + ox * s, s * .7);
		ctx.lineTo(cx + ox * s, s * .84);
		ctx.stroke();
	}
	return canvas;
}
/** Squid / octopus alien — domed head, four tentacle pairs, round eyes. Use for shoot-em-up invader enemies. */
function squidAlien(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#b06bff";
	const ink = opts.detail ?? "#2a1448";
	const eye = opts.accent ?? "#ffffff";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.arc(cx, s * .46, s * .3, Math.PI, 0);
	ctx.fill();
	ctx.fillRect(cx - s * .3, s * .46, s * .6, s * .1);
	ctx.fillStyle = col;
	for (const ox of [
		-.22,
		-.07,
		.07,
		.22
	]) {
		disc(ctx, cx + ox * s, s * .62, s * .07, col);
		disc(ctx, cx + ox * s, s * .72, s * .05, col);
	}
	disc(ctx, cx - s * .1, s * .42, s * .07, eye);
	disc(ctx, cx + s * .1, s * .42, s * .07, eye);
	disc(ctx, cx - s * .1, s * .42, s * .035, ink);
	disc(ctx, cx + s * .1, s * .42, s * .035, ink);
	return canvas;
}
/** Enemy interceptor fighter pointing down — swept wings, narrow fuselage, red cockpit. Use for shoot-em-up diving enemy ships. */
function interceptor(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#aeb6c2";
	const dark = opts.detail ?? "#5a6470";
	const cockpit = opts.accent ?? "#ff4040";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	poly(ctx, [
		[cx, s * .4],
		[s * .1, s * .28],
		[s * .32, s * .5],
		[s * .68, s * .5],
		[s * .9, s * .28]
	]);
	ctx.fill();
	ctx.fillStyle = dark;
	poly(ctx, [
		[cx - s * .12, s * .22],
		[cx + s * .12, s * .22],
		[cx, s * .86]
	]);
	ctx.fill();
	disc(ctx, cx, s * .34, s * .06, cockpit);
	return canvas;
}
/** Bulky enemy bomber — wide oval hull with engine pods and glowing exhausts. Use for heavy shoot-em-up enemies. */
function bomber(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#6a7a6a";
	const dark = opts.detail ?? "#3f4a3f";
	const light = opts.accent ?? "#ff6a3a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.ellipse(cx, s * .5, s * .42, s * .2, 0, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = dark;
	ctx.fillRect(s * .1, s * .5, s * .14, s * .22);
	ctx.fillRect(s * .76, s * .5, s * .14, s * .22);
	disc(ctx, cx, s * .5, s * .1, dark);
	disc(ctx, s * .17, s * .72, s * .04, light);
	disc(ctx, s * .83, s * .72, s * .04, light);
	return canvas;
}
/** Spiky space mine — eight spike protrusions around a dark body with a red blink light. Use for hazard / obstacle sprites in space games. */
function mine(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#4a4f57";
	const spike = opts.detail ?? "#2c3036";
	const light = opts.accent ?? "#ff3030";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const cy = s / 2;
	ctx.strokeStyle = spike;
	ctx.lineWidth = Math.max(1, s * .06);
	for (let i = 0; i < 8; i++) {
		const a = i / 8 * Math.PI * 2;
		ctx.beginPath();
		ctx.moveTo(cx + Math.cos(a) * s * .2, cy + Math.sin(a) * s * .2);
		ctx.lineTo(cx + Math.cos(a) * s * .42, cy + Math.sin(a) * s * .42);
		ctx.stroke();
	}
	disc(ctx, cx, cy, s * .24, col);
	disc(ctx, cx - s * .06, cy - s * .06, s * .05, light);
	return canvas;
}
/** Six-petal flower on a stem with a leaf. Use for garden, meadow, or pickup-collectible decoration. */
function flower(opts = {}) {
	const s = opts.size ?? 16;
	const petal = opts.color ?? "#ff6ad5";
	const centre = opts.accent ?? "#ffd23f";
	const leaf = opts.detail ?? "#3fae4a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.strokeStyle = leaf;
	ctx.lineWidth = Math.max(1, s * .06);
	ctx.beginPath();
	ctx.moveTo(cx, s * .96);
	ctx.lineTo(cx, s * .46);
	ctx.stroke();
	ctx.fillStyle = leaf;
	ctx.beginPath();
	ctx.ellipse(cx - s * .14, s * .66, s * .1, s * .05, .5, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = petal;
	for (let i = 0; i < 6; i++) {
		const a = i / 6 * Math.PI * 2;
		disc(ctx, cx + Math.cos(a) * s * .15, s * .34 + Math.sin(a) * s * .15, s * .09, petal);
	}
	disc(ctx, cx, s * .34, s * .09, centre);
	return canvas;
}
/** Tulip flower on a stem with a side leaf — cup of three petals. Use for spring / garden scenery. */
function tulip(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#e23d4c";
	const leaf = opts.detail ?? "#3fae4a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.strokeStyle = leaf;
	ctx.lineWidth = Math.max(1, s * .06);
	ctx.beginPath();
	ctx.moveTo(cx, s * .96);
	ctx.lineTo(cx, s * .46);
	ctx.stroke();
	ctx.fillStyle = leaf;
	ctx.beginPath();
	ctx.ellipse(cx + s * .12, s * .7, s * .1, s * .05, -.5, 0, Math.PI * 2);
	ctx.fill();
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.moveTo(s * .3, s * .46);
	ctx.quadraticCurveTo(s * .3, s * .2, cx, s * .24);
	ctx.quadraticCurveTo(s * .7, s * .2, s * .7, s * .46);
	ctx.quadraticCurveTo(cx, s * .36, s * .3, s * .46);
	ctx.fill();
	ctx.fillRect(cx - s * .06, s * .22, s * .12, s * .18);
	return canvas;
}
/** Sunflower — 10 yellow petals around a dark brown seed head, on a stem. Use for field / garden scenery or collectibles. */
function sunflower(opts = {}) {
	const s = opts.size ?? 16;
	const petal = opts.color ?? "#ffc83a";
	const centre = opts.detail ?? "#7a4a22";
	const leaf = opts.accent ?? "#3fae4a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.strokeStyle = leaf;
	ctx.lineWidth = Math.max(1, s * .06);
	ctx.beginPath();
	ctx.moveTo(cx, s * .98);
	ctx.lineTo(cx, s * .5);
	ctx.stroke();
	ctx.fillStyle = petal;
	for (let i = 0; i < 10; i++) {
		const a = i / 10 * Math.PI * 2;
		disc(ctx, cx + Math.cos(a) * s * .22, s * .38 + Math.sin(a) * s * .22, s * .07, petal);
	}
	disc(ctx, cx, s * .38, s * .16, centre);
	return canvas;
}
/** Red mushroom with white spots and a pale stem. Use for forest scenery, Mario-style powerup or hazard sprites. */
function mushroom(opts = {}) {
	const s = opts.size ?? 16;
	const cap = opts.color ?? "#e23d2c";
	const spot = opts.accent ?? "#ffffff";
	const stem = opts.detail ?? "#efe6cf";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = stem;
	ctx.fillRect(cx - s * .12, s * .5, s * .24, s * .34);
	ctx.fillStyle = cap;
	ctx.beginPath();
	ctx.arc(cx, s * .5, s * .32, Math.PI, 0);
	ctx.fill();
	ctx.fillStyle = spot;
	disc(ctx, cx - s * .12, s * .38, s * .05, spot);
	disc(ctx, cx + s * .14, s * .42, s * .04, spot);
	disc(ctx, cx + s * .02, s * .3, s * .04, spot);
	return canvas;
}
/** Green cactus — round-capped body with two upward arms and spine flecks. Use for desert / western scenery or obstacles. */
function cactus(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#3fae5a";
	const dark = opts.detail ?? "#2a7a3e";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.strokeStyle = col;
	ctx.lineWidth = s * .22;
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(cx, s * .92);
	ctx.lineTo(cx, s * .28);
	ctx.stroke();
	ctx.lineWidth = s * .14;
	ctx.beginPath();
	ctx.moveTo(cx - s * .02, s * .62);
	ctx.lineTo(s * .22, s * .62);
	ctx.lineTo(s * .22, s * .46);
	ctx.moveTo(cx + s * .02, s * .54);
	ctx.lineTo(s * .78, s * .54);
	ctx.lineTo(s * .78, s * .4);
	ctx.stroke();
	ctx.strokeStyle = dark;
	ctx.lineWidth = 1;
	for (let y = .34; y < .88; y += .12) ctx.strokeRect(cx, s * y, .5, 1);
	return canvas;
}
/** Rounded bush — four overlapping green circles with a sheen highlight and shadow base. Use for outdoor scenery, platformer decoration. */
function bush(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#3a8f3a";
	const dark = opts.detail ?? "#256025";
	const light = opts.accent ?? "#5bbf4f";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	for (const [ox, oy, r] of [
		[
			-.22,
			.06,
			.2
		],
		[
			.22,
			.06,
			.2
		],
		[
			0,
			-.06,
			.24
		],
		[
			0,
			.14,
			.22
		]
	]) disc(ctx, cx + ox * s, s * .58 + oy * s, r * s, col);
	disc(ctx, cx - s * .1, s * .42, s * .08, light);
	ctx.fillStyle = dark;
	ctx.fillRect(s * .2, s * .78, s * .6, s * .06);
	return canvas;
}
/** Pine / fir tree — three stacked triangular tiers over a brown trunk. Use for forest, mountain, or Christmas scenery. */
function pineTree(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#2f7d3a";
	const trunk = opts.detail ?? "#7a4a22";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = trunk;
	ctx.fillRect(cx - s * .05, s * .78, s * .1, s * .16);
	ctx.fillStyle = col;
	for (const [ty, w] of [
		[.16, .18],
		[.4, .26],
		[.6, .34]
	]) {
		poly(ctx, [
			[cx, s * ty],
			[cx - w * s, s * (ty + .26)],
			[cx + w * s, s * (ty + .26)]
		]);
		ctx.fill();
	}
	return canvas;
}
/** Grey rock / boulder — irregular polygon with a light top facet. Use for outdoor obstacles, cave scenery, breakable blocks. */
function rock(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#8a8f98";
	const light = opts.accent ?? "#abb0b8";
	const dark = opts.detail ?? "#5f636b";
	const { canvas, ctx } = makeCanvas(s, s);
	s / 2;
	poly(ctx, [
		[s * .14, s * .78],
		[s * .24, s * .46],
		[s * .46, s * .36],
		[s * .72, s * .42],
		[s * .86, s * .66],
		[s * .8, s * .8]
	]);
	ctx.fillStyle = col;
	ctx.fill();
	ctx.fillStyle = light;
	poly(ctx, [
		[s * .24, s * .46],
		[s * .46, s * .36],
		[s * .6, s * .46],
		[s * .4, s * .52]
	]);
	ctx.fill();
	ctx.fillStyle = dark;
	ctx.fillRect(s * .18, s * .78, s * .62, s * .04);
	return canvas;
}
/** Wizard — pointed hat with a star, long beard, and eyes. Use for mage NPC, player class sprite. */
function wizard(opts = {}) {
	const s = opts.size ?? 16;
	const hat = opts.color ?? "#5b3fb0";
	const skin = opts.detail ?? "#f0c8a0";
	const beard = opts.accent ?? "#e8eef5";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	disc(ctx, cx, s * .5, s * .18, skin);
	ctx.fillStyle = beard;
	poly(ctx, [
		[cx - s * .16, s * .5],
		[cx + s * .16, s * .5],
		[cx, s * .92]
	]);
	ctx.fill();
	ctx.fillStyle = hat;
	poly(ctx, [
		[cx, s * .06],
		[cx - s * .22, s * .44],
		[cx + s * .22, s * .44]
	]);
	ctx.fill();
	ctx.fillRect(cx - s * .28, s * .42, s * .56, s * .06);
	ctx.fillStyle = "#ffd23f";
	poly(ctx, starPoints(cx, s * .28, s * .07, s * .03, 5));
	ctx.fill();
	ctx.fillStyle = "#222";
	ctx.fillRect(Math.round(cx - s * .08), Math.round(s * .5), 1, 2);
	ctx.fillRect(Math.round(cx + s * .06), Math.round(s * .5), 1, 2);
	return canvas;
}
/** Bat — dark body with pointed ears, scalloped wings, and glowing eyes. Use for cave enemies, Halloween-themed sprites. */
function bat(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#4a3f6b";
	const eye = opts.accent ?? "#ffd23f";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	disc(ctx, cx, s * .52, s * .18, col);
	poly(ctx, [
		[cx - s * .12, s * .4],
		[cx - s * .04, s * .26],
		[cx - s * .02, s * .42]
	]);
	poly(ctx, [
		[cx + s * .12, s * .4],
		[cx + s * .04, s * .26],
		[cx + s * .02, s * .42]
	]);
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(cx - s * .12, s * .48);
	ctx.quadraticCurveTo(cx - s * .34, s * .36, cx - s * .46, s * .5);
	ctx.quadraticCurveTo(cx - s * .34, s * .5, cx - s * .3, s * .6);
	ctx.quadraticCurveTo(cx - s * .22, s * .54, cx - s * .12, s * .6);
	ctx.fill();
	ctx.beginPath();
	ctx.moveTo(cx + s * .12, s * .48);
	ctx.quadraticCurveTo(cx + s * .34, s * .36, cx + s * .46, s * .5);
	ctx.quadraticCurveTo(cx + s * .34, s * .5, cx + s * .3, s * .6);
	ctx.quadraticCurveTo(cx + s * .22, s * .54, cx + s * .12, s * .6);
	ctx.fill();
	disc(ctx, cx - s * .07, s * .5, s * .035, eye);
	disc(ctx, cx + s * .07, s * .5, s * .035, eye);
	return canvas;
}
/** Floating eyeball — sclera with vein lines, iris, pupil, and glint. Use for horror enemy, floating eye monster. */
function eyeball(opts = {}) {
	const s = opts.size ?? 16;
	const iris = opts.color ?? "#3a8fe0";
	const white = opts.detail ?? "#f4f6fb";
	const vein = opts.accent ?? "#e06a6a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	const cy = s / 2;
	disc(ctx, cx, cy, s * .38, white);
	ctx.strokeStyle = vein;
	ctx.lineWidth = 1;
	for (const a of [
		2.4,
		3.4,
		4.3
	]) {
		ctx.beginPath();
		ctx.moveTo(cx + Math.cos(a) * s * .36, cy + Math.sin(a) * s * .36);
		ctx.lineTo(cx + Math.cos(a) * s * .16, cy + Math.sin(a) * s * .16);
		ctx.stroke();
	}
	disc(ctx, cx, cy, s * .18, iris);
	disc(ctx, cx, cy, s * .09, "#1a1a1a");
	disc(ctx, cx - s * .06, cy - s * .06, s * .04, "#ffffff");
	return canvas;
}
/** Human nose with nostrils and a tip shade. Use for face-builder UIs, character customisation. */
function nose(opts = {}) {
	const s = opts.size ?? 16;
	const skin = opts.color ?? "#f0b890";
	const shade = opts.detail ?? "#d49770";
	const dark = opts.accent ?? "#7a4a30";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = skin;
	ctx.beginPath();
	ctx.moveTo(cx, s * .18);
	ctx.quadraticCurveTo(cx - s * .1, s * .5, cx - s * .26, s * .7);
	ctx.quadraticCurveTo(cx - s * .18, s * .84, cx, s * .78);
	ctx.quadraticCurveTo(cx + s * .18, s * .84, cx + s * .26, s * .7);
	ctx.quadraticCurveTo(cx + s * .1, s * .5, cx, s * .18);
	ctx.fill();
	ctx.fillStyle = shade;
	disc(ctx, cx, s * .66, s * .12, shade);
	ctx.fillStyle = dark;
	disc(ctx, cx - s * .1, s * .72, s * .04, dark);
	disc(ctx, cx + s * .1, s * .72, s * .04, dark);
	return canvas;
}
/** Green frog — oval body, bulging eye bumps, wide grin. Use for swamp / pond enemy or animal sprites. */
function frog(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#5fb83a";
	const dark = opts.detail ?? "#3a7a24";
	const eye = opts.accent ?? "#ffffff";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	ctx.fillStyle = col;
	ctx.beginPath();
	ctx.ellipse(cx, s * .6, s * .34, s * .26, 0, 0, Math.PI * 2);
	ctx.fill();
	disc(ctx, cx - s * .16, s * .36, s * .12, col);
	disc(ctx, cx + s * .16, s * .36, s * .12, col);
	disc(ctx, cx - s * .16, s * .34, s * .07, eye);
	disc(ctx, cx + s * .16, s * .34, s * .07, eye);
	disc(ctx, cx - s * .16, s * .35, s * .035, "#1a1a1a");
	disc(ctx, cx + s * .16, s * .35, s * .035, "#1a1a1a");
	ctx.strokeStyle = dark;
	ctx.lineWidth = Math.max(1, s * .05);
	ctx.beginPath();
	ctx.arc(cx, s * .58, s * .2, .2, Math.PI - .2);
	ctx.stroke();
	return canvas;
}
/** Carved Halloween pumpkin — orange body with rib arcs, green stem, and triangle eyes + jagged mouth. Use for Halloween themes, seasonal decoration. */
function pumpkin(opts = {}) {
	const s = opts.size ?? 16;
	const col = opts.color ?? "#ff8c1a";
	const rib = opts.detail ?? "#d96e0e";
	const stem = opts.accent ?? "#3fae4a";
	const { canvas, ctx } = makeCanvas(s, s);
	const cx = s / 2;
	disc(ctx, cx, s * .56, s * .36, col);
	ctx.strokeStyle = rib;
	ctx.lineWidth = Math.max(1, s * .05);
	for (const ox of [
		-.18,
		0,
		.18
	]) {
		ctx.beginPath();
		ctx.moveTo(cx + ox * s, s * .24);
		ctx.quadraticCurveTo(cx + ox * s * 1.5, s * .56, cx + ox * s, s * .88);
		ctx.stroke();
	}
	ctx.fillStyle = stem;
	ctx.fillRect(cx - s * .04, s * .18, s * .08, s * .1);
	ctx.fillStyle = "#2a1a08";
	poly(ctx, [
		[cx - s * .2, s * .48],
		[cx - s * .08, s * .48],
		[cx - s * .14, s * .58]
	]);
	ctx.fill();
	poly(ctx, [
		[cx + s * .2, s * .48],
		[cx + s * .08, s * .48],
		[cx + s * .14, s * .58]
	]);
	ctx.fill();
	poly(ctx, [
		[cx - s * .2, s * .66],
		[cx - s * .1, s * .72],
		[cx, s * .66],
		[cx + s * .1, s * .72],
		[cx + s * .2, s * .66],
		[cx, s * .78]
	]);
	ctx.fill();
	return canvas;
}
/** Snail — coiled shell with swirl arcs, green body / foot, eye stalks. Use for garden / slow enemy sprites. */
function snail(opts = {}) {
	const s = opts.size ?? 16;
	const shell = opts.color ?? "#e0a85a";
	const body = opts.detail ?? "#b6e08a";
	const swirl = opts.accent ?? "#a8742e";
	const { canvas, ctx } = makeCanvas(s, s);
	ctx.fillStyle = body;
	ctx.beginPath();
	ctx.moveTo(s * .1, s * .8);
	ctx.quadraticCurveTo(s * .1, s * .64, s * .4, s * .64);
	ctx.lineTo(s * .86, s * .64);
	ctx.quadraticCurveTo(s * .94, s * .7, s * .86, s * .8);
	ctx.closePath();
	ctx.fill();
	disc(ctx, s * .82, s * .56, s * .1, body);
	ctx.strokeStyle = body;
	ctx.lineWidth = Math.max(1, s * .04);
	ctx.beginPath();
	ctx.moveTo(s * .84, s * .5);
	ctx.lineTo(s * .9, s * .38);
	ctx.moveTo(s * .78, s * .5);
	ctx.lineTo(s * .74, s * .38);
	ctx.stroke();
	disc(ctx, s * .9, s * .36, s * .03, "#1a1a1a");
	disc(ctx, s * .74, s * .36, s * .03, "#1a1a1a");
	disc(ctx, s * .42, s * .46, s * .26, shell);
	ctx.strokeStyle = swirl;
	ctx.lineWidth = Math.max(1, s * .05);
	ctx.beginPath();
	ctx.arc(s * .42, s * .46, s * .16, 0, Math.PI * 1.8);
	ctx.stroke();
	ctx.beginPath();
	ctx.arc(s * .42, s * .46, s * .08, 0, Math.PI * 1.6);
	ctx.stroke();
	return canvas;
}
//#endregion
export { alien, amethyst, apple, asteroid, axe, banana, bat, bomb, bomber, brickNormalMap, brickTile, building, bush, cactus, car, characterSheet, checkerTile, cherry, chest, circuitTile, claude, cloud, cobbleTile, coinSheet, crabAlien, crateTile, crown, diamond, dirtTile, emerald, envMap, eyeball, flower, frog, gem, ghost, goldBar, grapes, grassTile, gravelTile, heart, hedgeTile, house, hydrant, iceTile, interceptor, key, lamppost, lavaTile, lemon, marbleTile, metalTile, mine, moon, mudTile, mushroom, noiseNormalMap, nose, orange, peach, pear, pearl, personSheet, pineTree, planet, plankTile, plum, potion, pumpkin, ring, ringedPlanet, roadTile, robot, rock, rocket, ruby, sandTile, sapphire, satellite, scroll, shield, signpost, skull, slime, snail, snowTile, spaceship, squidAlien, staff, star, stoneTile, strawberry, sun, sunflower, sword, tileset, torchSheet, trafficLight, tree, truck, tulip, ufo, waterTile, watermelon, wizard, woodTile };

//# sourceMappingURL=procgen.js.map
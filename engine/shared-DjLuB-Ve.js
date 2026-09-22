import { n as rgba } from "./shared-DhV4JtEZ.js";
//#region src/lib/vfx.ts
/** The engine-core VFX (deliberately minimal — variety ships as data). */
var VFX = {
	/** A plain fading ribbon — the canonical trail. */
	trail: {
		name: "trail",
		trail: {
			width: 8,
			life: .45,
			colors: ["#ffffff"],
			taper: true,
			alpha: .6
		}
	},
	/** A generic impact: flash + ring + sparks. */
	impact: {
		name: "impact",
		burst: [
			{ flash: {
				radius: 26,
				time: .12,
				color: "#ffffff"
			} },
			{ ring: {
				to: 54,
				time: .3,
				width: 3,
				color: "#ffffff"
			} },
			{ emit: {
				count: 14,
				speed: 170,
				speedVar: 80,
				life: .4,
				size: 2.5,
				colors: ["#ffd147", "#ff9a3d"],
				add: true,
				drag: 2
			} }
		]
	}
};
/** On-demand pack — passed (or registered) as DATA, like EFFECT_PACK. */
var VFX_PACK = {
	/** A hot additive fire ribbon + ember spits. */
	flameTrail: {
		name: "flameTrail",
		trail: {
			width: 14,
			life: .5,
			colors: [
				"#fff3c4",
				"#ffd147",
				"#ff7a2d",
				"#b3223a"
			],
			add: true,
			alpha: .9,
			turbulence: .5,
			erode: .7,
			core: .8
		}
	},
	/** A thin electric ribbon — snappy and short. */
	sparkTrail: {
		name: "sparkTrail",
		trail: {
			width: 4,
			life: .22,
			colors: [
				"#eaf6ff",
				"#7fd4ff",
				"#3a6ea5"
			],
			add: true,
			alpha: 1,
			turbulence: .2,
			erode: .35,
			core: 1
		}
	},
	/** A soft smoke ribbon — alpha blend, long life. */
	smokeTrail: {
		name: "smokeTrail",
		trail: {
			width: 16,
			life: 1.1,
			colors: [
				"#c9d1ee",
				"#6a7194",
				"#2a2f4a"
			],
			alpha: .35,
			turbulence: .8,
			erode: .85,
			core: 0
		}
	},
	/** A full-spectrum celebration ribbon (red → violet across the length). */
	rainbowTrail: {
		name: "rainbowTrail",
		trail: {
			width: 10,
			life: .7,
			colors: [
				"#ff4040",
				"#ff9d2e",
				"#ffe14d",
				"#5ee85e",
				"#3ec8ff",
				"#4f6dff",
				"#9b5bff",
				"#e05bff"
			],
			add: true,
			alpha: .8,
			turbulence: .3,
			erode: .25,
			core: .5
		}
	},
	/** A Tron light-wall: a clean, hard-edged band of neon — zero turbulence,
	* no fibre texture, constant width, hot core. Wants bloom. */
	lightTrail: {
		name: "lightTrail",
		trail: {
			width: 8,
			life: 1.4,
			colors: [
				"#eafffe",
				"#7df9ff",
				"#18c9db"
			],
			add: true,
			alpha: 1,
			taper: false,
			turbulence: 0,
			erode: 0,
			core: .9,
			fiber: 0,
			hard: .85
		}
	},
	/** A fire ribbon that SHEDS embers along the flown path — the sparks are
	* laid arc-spaced where the object travelled and drift up as they die. */
	emberTrail: {
		name: "emberTrail",
		trail: {
			width: 12,
			life: .45,
			colors: [
				"#fff3c4",
				"#ffd147",
				"#ff7a2d",
				"#b3223a"
			],
			add: true,
			alpha: .85,
			turbulence: .45,
			erode: .7,
			core: .7,
			sparks: {
				per: .3,
				speed: 22,
				life: .7,
				size: 1.8,
				ramp: "ember",
				gravity: -30,
				drag: 1.2,
				twinkle: .7
			}
		}
	},
	/** A living lightning ribbon: crackle glints crawl the surface while hot
	* sparks skitter off the path. Wants bloom. */
	stormTrail: {
		name: "stormTrail",
		trail: {
			width: 9,
			life: .55,
			colors: [
				"#ffffff",
				"#bfe9ff",
				"#5aa7ff",
				"#1c3a8a"
			],
			add: true,
			alpha: 1,
			turbulence: .35,
			erode: .5,
			core: 1,
			crackle: .9,
			sparks: {
				per: .5,
				speed: 45,
				life: .3,
				size: 1.6,
				ramp: "spark",
				drag: 2.5,
				twinkle: .8
			}
		}
	},
	/** A big radial shockwave — double ring + dust. */
	shockwave: {
		name: "shockwave",
		burst: [
			{ ring: {
				to: 120,
				time: .45,
				width: 6,
				color: "#ffffff",
				add: true
			} },
			{
				delay: .06,
				ring: {
					to: 90,
					time: .4,
					width: 3,
					color: "#8ecae6",
					add: true
				}
			},
			{ emit: {
				count: 22,
				speed: 110,
				speedVar: 60,
				life: .6,
				size: 2,
				colors: ["#aab4d4", "#5a6ea6"]
			} }
		]
	},
	/** Directional hit sparks + a quick flash (feed `angle` at trigger). */
	hitSpark: {
		name: "hitSpark",
		burst: [{ flash: {
			radius: 16,
			time: .08,
			color: "#fff3c4"
		} }, { emit: {
			count: 12,
			speed: 260,
			speedVar: 90,
			spread: .9,
			life: .25,
			size: 2.5,
			colors: ["#ffd147", "#ffffff"],
			add: true,
			drag: 3
		} }]
	}
};
var registry = new Map(Object.entries({
	...VFX,
	...VFX_PACK
}).map(([, d]) => [d.name, d]));
/** Register a custom VfxDef (or override) by name — the block path. */
function registerVfx(def) {
	registry.set(def.name, def);
}
/** Resolve a name (or pass a def through) against the registry — shared by
* the 2D VfxSystem and the 3D world.trail() path. */
function resolveVfx(v) {
	const def = typeof v === "string" ? registry.get(v) : v;
	if (!def) throw new Error(`unknown vfx '${String(v)}' — registered: ${[...registry.keys()].join(", ")}`);
	return def;
}
var resolve = resolveVfx;
/** A live trail — feed `point(x, y)` every frame (or bind a sprite via sprite.vfx). */
var TrailEmitter = class {
	/** @internal */ points = [];
	/** @internal */ dead = false;
	/** @internal Wired by VfxSystem — the shed target for `sparks`. */
	fx = null;
	t;
	sparks;
	hx = 0;
	hy = 0;
	hasHead = false;
	shedAcc = 0;
	/** @internal */
	constructor(def) {
		const t = def.trail ?? {};
		this.t = {
			width: t.width ?? 8,
			life: t.life ?? .5,
			colors: t.colors ?? ["#ffffff"],
			add: t.add ?? false,
			taper: t.taper ?? true,
			alpha: t.alpha ?? .8,
			spacing: t.spacing ?? 3,
			turbulence: t.turbulence ?? .35,
			erode: t.erode ?? .55,
			core: t.core ?? .5,
			fiber: t.fiber ?? 1,
			hard: t.hard ?? 0,
			crackle: t.crackle ?? 0,
			facing: t.facing ?? "view"
		};
		this.sparks = t.sparks ?? null;
	}
	/** Record the head position for this frame. */
	point(x, y) {
		if (this.sparks && this.fx && this.hasHead) {
			const s = this.sparks;
			const step = 1 / (s.per ?? .25);
			let dx = x - this.hx, dy = y - this.hy;
			const seg = Math.hypot(dx, dy);
			if (seg > 0) {
				dx /= seg;
				dy /= seg;
				let travelled = this.shedAcc + seg;
				let along = 0;
				while (travelled >= step) {
					travelled -= step;
					along = seg - travelled;
					this.fx.emit({
						x: this.hx + dx * along,
						y: this.hy + dy * along,
						count: 1,
						speed: s.speed ?? 30,
						speedVar: (s.speed ?? 30) * .5,
						life: s.life ?? .45,
						lifeVar: (s.life ?? .45) * .3,
						size: s.size ?? 2,
						sizeVar: (s.size ?? 2) * .4,
						colors: s.ramp ? void 0 : s.colors ?? this.t.colors,
						ramp: s.ramp,
						add: s.add ?? this.t.add,
						gravity: s.gravity ?? 0,
						drag: s.drag ?? 1.5,
						twinkle: s.twinkle ?? .6
					});
				}
				this.shedAcc = travelled;
			}
		}
		this.hx = x;
		this.hy = y;
		this.hasHead = true;
		const head = this.points[this.points.length - 1];
		if (head && Math.hypot(x - head.x, y - head.y) < this.t.spacing) return;
		this.points.push({
			x,
			y,
			age: 0
		});
	}
	/** Stop feeding and let the ribbon fade out, then auto-remove. */
	release() {
		this.dead = true;
	}
	/** @internal Age + expire points. Returns true while anything remains. */
	update(dt) {
		const life = this.t.life;
		for (const p of this.points) p.age += dt;
		while (this.points.length && this.points[0].age >= life) this.points.shift();
		return this.points.length > 0 || !this.dead;
	}
	/** @internal Push the ribbon as fading segments (head→tail gradient). */
	draw(d) {
		const pts = this.points;
		const { width, life, colors, add, taper, alpha } = this.t;
		for (let i = 1; i < pts.length; i++) {
			const a = pts[i - 1], b = pts[i];
			const k = 1 - b.age / life;
			if (k <= 0) continue;
			const w = width * (taper ? k : 1);
			const ci = (1 - k) * (colors.length - 1);
			const color = colors[Math.min(colors.length - 1, Math.round(ci))];
			d.trailSegment(a.x, a.y, b.x, b.y, Math.max(.5, w), color, alpha * k, add);
		}
	}
};
/**
* The scene's VFX system: continuous trails + one-shot bursts, all data.
* Trails draw UNDER the sprites (streams behind the body); burst rings and
* flashes draw OVER them; burst particle layers ride the particle system.
*/
var VfxSystem = class {
	trails = /* @__PURE__ */ new Set();
	bound = /* @__PURE__ */ new Map();
	bursts = [];
	/** @internal Wired by the Scene: the game's particle system. */
	particles = null;
	/** Start a trail you feed yourself: `const t = scene.vfx.trail('flameTrail'); t.point(x, y)`. */
	trail(vfx) {
		const t = new TrailEmitter(resolve(vfx));
		t.fx = this.particles;
		this.trails.add(t);
		return t;
	}
	/** Trigger a one-shot burst recipe at a point. `angle` rotates directional emits (radians). */
	burst(vfx, x, y, opts) {
		const def = resolve(vfx);
		if (!def.burst?.length) return;
		this.bursts.push({
			def,
			x,
			y,
			angle: opts?.angle ?? 0,
			age: 0,
			fired: def.burst.map(() => false)
		});
	}
	/** @internal Feed a sprite's auto-trail (creates it on first sight). */
	feed(sprite, vfx) {
		let t = this.bound.get(sprite);
		if (!t) {
			t = this.trail(vfx);
			this.bound.set(sprite, t);
		}
		t.point(sprite.centerX, sprite.centerY);
	}
	/** @internal Per-frame tick (scene.update). */
	update(dt) {
		for (const t of this.trails) if (!t.update(dt)) this.trails.delete(t);
		for (const [s, t] of this.bound) if (s.dead || !s.vfx) {
			t.release();
			this.bound.delete(s);
		}
		for (let i = this.bursts.length - 1; i >= 0; i--) {
			const b = this.bursts[i];
			b.age += dt;
			let done = true;
			b.def.burst.forEach((layer, li) => {
				const delay = layer.delay ?? 0;
				if (!b.fired[li] && b.age >= delay) {
					b.fired[li] = true;
					if (layer.emit && this.particles) this.particles.emit({
						...layer.emit,
						x: b.x,
						y: b.y,
						angle: (layer.emit.angle ?? 0) + b.angle
					});
				}
				const t = layer.ring?.time ?? layer.flash?.time ?? 0;
				if (b.age < delay + t) done = false;
				if (!b.fired[li]) done = false;
			});
			if (done) this.bursts.splice(i, 1);
		}
	}
	/** @internal Trails, drawn BEFORE the sprites (the ribbon streams behind). */
	drawUnder(d) {
		for (const t of this.trails) t.draw(d);
	}
	/** @internal Rings + flashes, drawn OVER the sprites. */
	drawOver(d) {
		for (const b of this.bursts) b.def.burst.forEach((layer, li) => {
			const delay = layer.delay ?? 0;
			const local = b.age - delay;
			if (local < 0 || !b.fired[li]) return;
			if (layer.ring) {
				const r = layer.ring;
				const k = Math.min(1, local / r.time);
				if (k < 1) {
					const radius = (r.from ?? 6) + (r.to - (r.from ?? 6)) * k;
					d.ring(b.x, b.y, radius, (r.width ?? 3) * (1 - k * .6), r.color ?? "#ffffff", (1 - k) * (r.add ? 1 : .8));
				}
			}
			if (layer.flash) {
				const f = layer.flash;
				const k = Math.min(1, local / f.time);
				if (k < 1) d.circle(b.x, b.y, f.radius * (.6 + .4 * k), f.color ?? "#ffffff", (1 - k) * .9);
			}
		});
	}
	/** @internal Everything stops with the scene (transitions drop the system). */
	clear() {
		this.trails.clear();
		this.bound.clear();
		this.bursts = [];
	}
};
//#endregion
//#region src/lib/particles.ts
/** The named life-ramps (head = birth, last stop = death). */
var RAMPS = {
	fire: [
		"#fff7e0",
		"#ffd23f",
		"#ff8c00",
		"#ff2d00",
		"#5c0a00"
	],
	spark: [
		"#ffffff",
		"#fff0a8",
		"#ffae00",
		"#ff6a00"
	],
	ember: [
		"#ffd166",
		"#ff7b00",
		"#c81e00",
		"#360a00"
	],
	smoke: [
		"#d7dde0",
		"#9aa4aa",
		"#5a6066",
		"#2b2f33"
	],
	ice: [
		"#ffffff",
		"#b3ecff",
		"#33a1ff",
		"#0a2a66"
	],
	magic: [
		"#ffffff",
		"#ff9bf2",
		"#b14dff",
		"#3d0a66"
	],
	toxic: [
		"#f0ffd0",
		"#b6f000",
		"#5aa800",
		"#143d00"
	],
	rainbow: [
		"#ff2d55",
		"#ff9500",
		"#ffea00",
		"#34c759",
		"#00c7ff",
		"#af52de"
	]
};
/** Resolve a ramp (named or custom hex stops) to parsed colours. */
function resolveRamp(ramp) {
	return ((Array.isArray(ramp) ? ramp : RAMPS[ramp]) ?? ["#ffffff"]).map((c) => rgba(c));
}
var Particles = class {
	rng;
	pool = [];
	alive = 0;
	clock = 0;
	/** Groups already placed by the scene this frame — see draw(). */
	placed = /* @__PURE__ */ new Set();
	/** Pass a seeded rng (e.g. mulberry32) for deterministic headless tests. */
	constructor(rng = Math.random) {
		this.rng = rng;
	}
	/** Live particle count (for HUD/stress readouts). */
	get count() {
		return this.alive;
	}
	/** Spawn a burst. Call once for an explosion, every frame for a stream. */
	emit(opts) {
		const rng = this.rng;
		const count = opts.count ?? 12;
		const speed = opts.speed ?? 90;
		const speedVar = opts.speedVar ?? 40;
		const angle = opts.angle ?? 0;
		const spread = opts.spread ?? Math.PI * 2;
		const even = opts.even ?? false;
		const spawnR = opts.spawnRadius ?? 0;
		const life = opts.life ?? .7;
		const lifeVar = opts.lifeVar ?? .3;
		const size = opts.size ?? 4;
		const sizeVar = opts.sizeVar ?? 2;
		const alpha = opts.alpha ?? 1;
		const ramp = opts.ramp ? resolveRamp(opts.ramp) : null;
		const palette = opts.colors ?? [opts.color ?? "#ffffff"];
		const endSize = typeof opts.shrink === "number" ? Math.max(0, opts.shrink) : opts.shrink ?? true ? 0 : 1;
		for (let i = 0; i < count; i++) {
			const p = this.alive < this.pool.length ? this.pool[this.alive] : (this.pool.push(blank()), this.pool[this.alive]);
			this.alive++;
			p.group = opts.group ?? null;
			const a = even ? angle - spread / 2 + spread * ((i + .5) / count) : angle + (rng() - .5) * spread;
			const v = Math.max(0, speed + (rng() - .5) * 2 * speedVar);
			p.x = opts.x;
			p.y = opts.y;
			if (spawnR > 0) {
				const sa = rng() * Math.PI * 2;
				const sr = Math.sqrt(rng()) * spawnR;
				p.x += Math.cos(sa) * sr;
				p.y += Math.sin(sa) * sr;
			}
			p.vx = Math.cos(a) * v;
			p.vy = Math.sin(a) * v;
			p.age = 0;
			p.life = Math.max(.05, life + (rng() - .5) * 2 * lifeVar);
			p.size = Math.max(.5, size + (rng() - .5) * 2 * sizeVar);
			p.rot = 0;
			p.spin = (rng() - .5) * 2 * (opts.spin ?? 0);
			const first = ramp ? ramp[0] : rgba(palette[rng() * palette.length | 0]);
			p.r = first[0];
			p.g = first[1];
			p.b = first[2];
			p.a = first[3] * alpha;
			p.ramp = ramp;
			p.gravity = opts.gravity ?? 0;
			p.drag = opts.drag ?? 0;
			p.sway = opts.sway ?? 0;
			p.swayFreq = opts.swayFreq ?? 1.5;
			p.seed = rng() * Math.PI * 2;
			p.twinkle = opts.twinkle ?? 0;
			p.fade = opts.fade ?? true;
			p.endSize = endSize;
			p.add = opts.add ?? false;
			p.frame = opts.frame ?? -1;
		}
	}
	/** A CONTINUOUS emitter — the only correct way to run a steady effect.
	* `rate` = particles per SECOND, wall clock: the engine owns the
	* accumulator, so alive = rate × life at ANY refresh rate (per-frame
	* emit() loops double on a 120 Hz display — emit() is for BURSTS).
	* Options are live; kill() stops the stream. */
	stream(opts) {
		const h = Object.assign({}, opts, {
			dead: false,
			kill() {
				this.dead = true;
			}
		});
		this.streams.push({
			h,
			acc: 0
		});
		return h;
	}
	streams = [];
	/** Age + integrate; recycles the dead (swap-remove — order is irrelevant). */
	update(dt) {
		this.placed.clear();
		for (let i = this.streams.length - 1; i >= 0; i--) {
			const st = this.streams[i];
			if (st.h.dead) {
				this.streams.splice(i, 1);
				continue;
			}
			st.acc += st.h.rate * dt;
			const n = Math.floor(st.acc);
			st.acc -= n;
			if (n > 0) this.emit({
				...st.h,
				count: n
			});
		}
		this.clock += dt;
		for (let i = this.alive - 1; i >= 0; i--) {
			const p = this.pool[i];
			p.age += dt;
			if (p.age >= p.life) {
				this.alive--;
				this.pool[i] = this.pool[this.alive];
				this.pool[this.alive] = p;
				continue;
			}
			const damp = p.drag > 0 ? Math.max(0, 1 - p.drag * dt) : 1;
			p.vx *= damp;
			p.vy = p.vy * damp + p.gravity * dt;
			if (p.sway) {
				const w = this.clock * p.swayFreq + p.seed;
				p.vx += Math.cos(w) * p.sway * dt;
				p.vy += Math.sin(w * 1.3) * p.sway * .35 * dt;
			}
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.rot += p.spin * dt;
		}
	}
	/**
	* Push live particles into the frame AT THIS POINT in the draw order.
	*
	* Particles are ordinary display-list content: they land where you draw them,
	* so an exhaust plume goes BEHIND its ship simply by being drawn first.
	*
	* ```ts
	* override draw(d: Draw): void {
	*   super.draw(d);
	*   this.game.fx.draw(d, 'exhaust');   // …behind the ship
	*   d.sprite(shipFrame, x, y);
	*   this.game.fx.draw(d, 'sparks');    // …and in front of it
	* }
	* ```
	*
	* With a `group`, only that group draws, and it is remembered for the rest of
	* the frame. Without one, everything NOT already placed draws — which is what
	* the engine calls after the scene, so a game that never places anything
	* behaves exactly as before.
	*/
	draw(d, group) {
		if (group !== void 0) this.placed.add(group);
		for (let i = 0; i < this.alive; i++) {
			const p = this.pool[i];
			if (group !== void 0 ? p.group !== group : p.group !== null && this.placed.has(p.group)) continue;
			const t = p.age / p.life;
			let alpha = p.fade ? p.a * (1 - t) : p.a;
			if (p.twinkle > 0) alpha *= 1 - p.twinkle * (.5 + .5 * Math.sin(this.clock * 11 + p.seed * 7));
			const size = p.size * (1 - (1 - p.endSize) * t);
			if (alpha <= .004 || size <= .05) continue;
			let r = p.r, g = p.g, b = p.b;
			if (p.ramp) {
				const ci = t * (p.ramp.length - 1);
				const i0 = Math.min(p.ramp.length - 1, ci | 0);
				const i1 = Math.min(p.ramp.length - 1, i0 + 1);
				const f = ci - i0;
				const c0 = p.ramp[i0], c1 = p.ramp[i1];
				r = c0[0] + (c1[0] - c0[0]) * f;
				g = c0[1] + (c1[1] - c0[1]) * f;
				b = c0[2] + (c1[2] - c0[2]) * f;
			}
			d.part(p.x, p.y, size, p.rot, p.frame, r, g, b, alpha, p.add);
		}
	}
	/** Kill everything (scene change). */
	clear() {
		this.alive = 0;
	}
};
function blank() {
	return {
		x: 0,
		y: 0,
		vx: 0,
		vy: 0,
		age: 0,
		life: 1,
		size: 1,
		rot: 0,
		spin: 0,
		r: 1,
		g: 1,
		b: 1,
		a: 1,
		gravity: 0,
		drag: 0,
		sway: 0,
		swayFreq: 1.5,
		seed: 0,
		twinkle: 0,
		ramp: null,
		fade: true,
		endSize: 0,
		add: false,
		frame: -1,
		group: null
	};
}
//#endregion
//#region src/lib/assets.ts
var imageCache = /* @__PURE__ */ new Map();
/** `true` once `url` has finished loading (or failing) via `loadImage`. */
function isImageCached(url) {
	return imageCache.get(url)?.settled ?? false;
}
var loadedModels = /* @__PURE__ */ new Set();
/** `true` once model DATA for `url` has been loaded + cached (via the 3D chunk's `loadModelData`). */
function isModelCached(url) {
	return loadedModels.has(url);
}
/** @internal Mark model DATA for `url` as cached — called by `loadModelData` in the 3D chunk. */
function markModelLoaded(url) {
	loadedModels.add(url);
}
/** The decoded image for `url`, or `null` if it hasn't loaded (or failed). Sync — preload first. */
function getImage(url) {
	const e = imageCache.get(url);
	return e && e.settled && e.ok ? e.img : null;
}
/**
* Load an image and resolve when it is decoded (or has failed — the promise
* never rejects, so a missing file can't wedge a loading bar). Cached by URL.
*/
function loadImage(url) {
	const hit = imageCache.get(url);
	if (hit) return hit.promise;
	if (typeof Image === "undefined") {
		const entry = {
			img: null,
			ok: false,
			settled: true,
			promise: Promise.resolve(null)
		};
		imageCache.set(url, entry);
		return entry.promise;
	}
	const img = new Image();
	img.crossOrigin = "anonymous";
	img.src = url;
	const entry = {
		img,
		ok: false,
		settled: false,
		promise: img.decode().then(() => {
			entry.ok = true;
			entry.settled = true;
			return img;
		}, () => {
			entry.settled = true;
			return img;
		})
	};
	imageCache.set(url, entry);
	return entry.promise;
}
var textCache = /* @__PURE__ */ new Map();
/** `true` if `url` has already been fetched by `loadText`/`loadJson` (cached) — so re-queuing it needs no load. */
function isTextCached(url) {
	return textCache.has(url);
}
/**
* Load a plain-text file (CSV, TSV, level data, etc.) from `url` and return
* its content as a string. Results are cached by URL.
* Returns `''` on network error or in headless (non-browser) environments.
*/
async function loadText(url) {
	const hit = textCache.get(url);
	if (hit !== void 0) return hit;
	if (typeof fetch === "undefined") return "";
	try {
		const t = await (await fetch(url)).text();
		textCache.set(url, t);
		return t;
	} catch {
		return "";
	}
}
/**
* Load and parse a JSON file from `url` (level data, config).
* Delegates to `loadText` for caching and error handling.
* Returns `null` on error or empty response.
*/
async function loadJson(url) {
	const t = await loadText(url);
	return t ? JSON.parse(t) : null;
}
var binaryCache = /* @__PURE__ */ new Map();
/** `true` if `url` has already been fetched by `loadBinary` (cached) — so re-queuing it needs no load. */
function isBinaryCached(url) {
	return binaryCache.has(url);
}
/**
* Load a binary file (packed level data, a model) from `url` as an
* `ArrayBuffer`. Cached by URL — queue with `load.binary(url)` in `preload`,
* read back instantly here in `setup`. Retries once, then THROWS with the
* URL in the message — a swallowed failure used to surface downstream as
* "GLB: truncated header — 0 bytes", which named neither cause nor file.
* Headless (non-browser) environments still get an empty buffer.
*/
async function loadBinary(url) {
	const hit = binaryCache.get(url);
	if (hit !== void 0) return hit;
	if (typeof fetch === "undefined") return /* @__PURE__ */ new ArrayBuffer(0);
	let lastErr = "empty response";
	for (let attempt = 0; attempt < 2; attempt++) try {
		const resp = await fetch(url);
		if (!resp.ok) {
			lastErr = `HTTP ${resp.status}`;
			continue;
		}
		const b = await resp.arrayBuffer();
		if (b.byteLength > 0) {
			binaryCache.set(url, b);
			return b;
		}
	} catch (e) {
		lastErr = e;
	}
	throw new Error(`loadBinary: '${url}' failed after retry (${String(lastErr)})`);
}
var fontCache = /* @__PURE__ */ new Map();
var fontsReady = /* @__PURE__ */ new Set();
/** `true` once the family loaded via `loadFont` is registered and usable. */
function isFontCached(family) {
	return fontsReady.has(family);
}
/** `true` if the browser can render `cssFont` (e.g. '32px Orbitron') right now. */
function isFontUsable(cssFont) {
	const fonts = typeof document !== "undefined" ? document.fonts : void 0;
	if (!fonts?.check) return true;
	try {
		return fonts.check(cssFont);
	} catch {
		return true;
	}
}
/**
* Load a web font file (woff2 / woff / ttf / otf) and register it on the
* document under `family`, so `game.assets.font({ font: '32px ' + family })`
* bakes the REAL face. Cached by family|url; never rejects (a failed font
* resolves `false` and the browser's fallback is used) so a bad URL can't
* wedge the loading bar.
*/
function loadFont(family, url, descriptors) {
	const key = `${family}|${url}`;
	const hit = fontCache.get(key);
	if (hit) return hit;
	const p = typeof FontFace === "undefined" || typeof document === "undefined" || !document.fonts ? Promise.resolve(false) : new FontFace(family, `url(${url})`, descriptors).load().then((face) => {
		document.fonts.add(face);
		fontsReady.add(family);
		return true;
	}, (err) => {
		console.warn(`Phaser AE: web font '${family}' failed to load from ${url} —`, err);
		return false;
	});
	fontCache.set(key, p);
	return p;
}
/**
* Resolve once every font the document has STARTED loading has settled. Catches
* faces declared with CSS `@font-face` in the host page (which `load.font()`
* knows nothing about). Cheap and always safe — resolves immediately when
* nothing is pending.
*/
function fontsSettled() {
	const fonts = typeof document !== "undefined" ? document.fonts : void 0;
	return fonts?.ready ? fonts.ready.then(() => void 0, () => void 0) : Promise.resolve();
}
var cacheClearers = /* @__PURE__ */ new Set();
/** @internal Register a cache-flush callback, run by `clearAssetCaches()`. */
function registerCacheClearer(fn) {
	cacheClearers.add(fn);
}
/**
* Drop every cached asset (images, text/JSON, binaries, model data) so the
* memory can be reclaimed — called by `Game.destroy()`. NOTE: these caches are
* module-global (shared across Game instances on a page), so this frees assets
* for ALL games; only relevant if you run more than one at once.
*/
function clearAssetCaches() {
	imageCache.clear();
	textCache.clear();
	binaryCache.clear();
	loadedModels.clear();
	for (const fn of cacheClearers) fn();
}
//#endregion
//#region src/lib/transform3d.ts
/** Quaternion for the engine euler order: q = qY(yaw) · qX(pitch) · qZ(roll).
* YAW HANDEDNESS: yaw is CLOCKWISE-from-above — increasing yaw turns to the
* RIGHT (the mainstream / three.js / FPS sense). That is baked in here by
* building qY from −yaw (sy is negated); the WGSL rotate(), forward(),
* lookAtEuler(), physics and picking all share this one sign. */
function eulerToQuat(yaw, pitch, roll) {
	const cy = Math.cos(yaw / 2), sy = -Math.sin(yaw / 2);
	const cp = Math.cos(pitch / 2), sp = Math.sin(pitch / 2);
	const cr = Math.cos(roll / 2), sr = Math.sin(roll / 2);
	return [
		sp * cy * cr + cp * sy * sr,
		sy * cp * cr - cy * sp * sr,
		cy * cp * sr - sy * sp * cr,
		cy * cp * cr + sy * sp * sr
	];
}
function quatMul(a, b) {
	return [
		a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
		a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
		a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
		a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]
	];
}
/** Rotate a point by a quaternion (q v q*). */
function quatRotate(q, x, y, z) {
	const [qx, qy, qz, qw] = q;
	const tx = 2 * (qy * z - qz * y);
	const ty = 2 * (qz * x - qx * z);
	const tz = 2 * (qx * y - qy * x);
	return [
		x + qw * tx + qy * tz - qz * ty,
		y + qw * ty + qz * tx - qx * tz,
		z + qw * tz + qx * ty - qy * tx
	];
}
/** Quaternion → the engine's yaw/pitch/roll (Ry·Rx·Rz). physics3d's maths. */
function quatToEuler(q) {
	const [x, y, z, w] = q;
	const sinPitch = 2 * (w * x - y * z);
	if (Math.abs(sinPitch) > .99999) return [
		-Math.atan2(Math.sign(sinPitch) * 2 * (x * y - w * z), 1 - 2 * (y * y + z * z)),
		sinPitch > 0 ? Math.PI / 2 : -Math.PI / 2,
		0
	];
	return [
		-Math.atan2(2 * (x * z + w * y), 1 - 2 * (x * x + y * y)),
		Math.asin(sinPitch),
		Math.atan2(2 * (x * y + w * z), 1 - 2 * (x * x + z * z))
	];
}
/**
* Compose a child's LOCAL pose through its parent chain into world space.
* Returns world position, world euler (engine order) and the accumulated
* uniform scale. Guards against cycles (depth cap). Mesh parents contribute
* position + rotation only — a crate's SIZE never inflates its rider;
* `Group3d.scale` is the deliberate scaling knob.
*/
function composeChain(localX, localY, localZ, localYaw, localPitch, localRoll, parent) {
	let x = localX, y = localY, z = localZ;
	let q = eulerToQuat(localYaw, localPitch, localRoll);
	let scale = 1;
	let p = parent ?? null;
	let depth = 0;
	while (p && depth++ < 32) {
		const ps = p.scale ?? 1;
		const pq = eulerToQuat(p.yaw, p.pitch, p.roll);
		const [rx, ry, rz] = quatRotate(pq, x * ps, y * ps, z * ps);
		x = p.x + rx;
		y = p.y + ry;
		z = p.z + rz;
		q = quatMul(pq, q);
		scale *= ps;
		p = p.parent ?? null;
	}
	const [yaw, pitch, roll] = quatToEuler(q);
	return {
		x,
		y,
		z,
		yaw,
		pitch,
		roll,
		scale
	};
}
/** Yaw/pitch that aim local +Z at a target (engine rotate order, roll 0):
* forward(yaw, pitch) = (−cos p · sin y, −sin p, cos p · cos y). */
function lookAtEuler(fromX, fromY, fromZ, toX, toY, toZ) {
	const dx = toX - fromX, dy = toY - fromY, dz = toZ - fromZ;
	const len = Math.hypot(dx, dy, dz) || 1;
	return {
		yaw: Math.atan2(-dx, dz),
		pitch: -Math.asin(dy / len)
	};
}
/** Unit forward direction for a yaw/pitch (engine rotate order, roll 0) — the
*  inverse of {@link lookAtEuler}: `forward(yaw, pitch) = (−cos p·sin y, −sin p,
*  cos p·cos y)`. `+Z` is forward at yaw 0; INCREASING yaw turns to the RIGHT
*  (mainstream / three.js / FPS). Use it for first-person movement and camera
*  aim (`world.camera.face`). */
function forward(yaw, pitch = 0) {
	const cp = Math.cos(pitch);
	return {
		x: -cp * Math.sin(yaw),
		y: -Math.sin(pitch),
		z: cp * Math.cos(yaw)
	};
}
//#endregion
//#region src/lib/math3d.ts
function vec3(x = 0, y = 0, z = 0) {
	return {
		x,
		y,
		z
	};
}
/** Perspective projection (fovY degrees, WebGPU depth range 0..1). */
function mat4Perspective(fovYDeg, aspect, near, far) {
	const f = 1 / Math.tan(fovYDeg * Math.PI / 360);
	const m = /* @__PURE__ */ new Float32Array(16);
	m[0] = f / Math.max(1e-4, aspect);
	m[5] = f;
	m[10] = far / (near - far);
	m[11] = -1;
	m[14] = near * far / (near - far);
	return m;
}
/** Orthographic projection (WebGPU depth 0..1) — shadow-map cameras. */
function mat4Ortho(l, r, b, t, near, far) {
	const m = /* @__PURE__ */ new Float32Array(16);
	m[0] = 2 / (r - l);
	m[5] = 2 / (t - b);
	m[10] = 1 / (near - far);
	m[12] = (l + r) / (l - r);
	m[13] = (b + t) / (b - t);
	m[14] = near / (near - far);
	m[15] = 1;
	return m;
}
/** A view matrix looking from `eye` at `target` (y-up world). */
function mat4LookAt(eye, target, up = vec3(0, 1, 0)) {
	const fz = norm(sub(eye, target));
	const fx = norm(cross(up, fz));
	const fy = cross(fz, fx);
	const m = /* @__PURE__ */ new Float32Array(16);
	m[0] = fx.x;
	m[1] = fy.x;
	m[2] = fz.x;
	m[4] = fx.y;
	m[5] = fy.y;
	m[6] = fz.y;
	m[8] = fx.z;
	m[9] = fy.z;
	m[10] = fz.z;
	m[12] = -dot(fx, eye);
	m[13] = -dot(fy, eye);
	m[14] = -dot(fz, eye);
	m[15] = 1;
	return m;
}
/** m = a × b (column-major). */
function mat4Mul(a, b) {
	const m = /* @__PURE__ */ new Float32Array(16);
	for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) m[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
	return m;
}
/** Transform a point (w=1) and perspective-divide — for tests + picking. */
function mat4Project(m, p) {
	const x = m[0] * p.x + m[4] * p.y + m[8] * p.z + m[12];
	const y = m[1] * p.x + m[5] * p.y + m[9] * p.z + m[13];
	const z = m[2] * p.x + m[6] * p.y + m[10] * p.z + m[14];
	const w = m[3] * p.x + m[7] * p.y + m[11] * p.z + m[15] || 1;
	return {
		x: x / w,
		y: y / w,
		z: z / w
	};
}
/** General 4×4 inverse (column-major, cofactor expansion). Returns identity
* for a singular input rather than NaNs — callers unproject with it and a
* degenerate frame should read as "no transform", never as poison. */
function mat4Inverse(m) {
	const inv = /* @__PURE__ */ new Float32Array(16);
	inv[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
	inv[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
	inv[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
	inv[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
	inv[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
	inv[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
	inv[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
	inv[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] + m[12] * m[1] * m[10] - m[12] * m[2] * m[9];
	inv[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
	inv[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
	inv[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
	inv[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
	inv[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
	inv[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
	inv[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
	inv[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
	const det = m[0] * inv[0] + m[1] * inv[4] + m[2] * inv[8] + m[3] * inv[12];
	if (!det || !Number.isFinite(det)) {
		const id = /* @__PURE__ */ new Float32Array(16);
		id[0] = id[5] = id[10] = id[15] = 1;
		return id;
	}
	const k = 1 / det;
	for (let i = 0; i < 16; i++) inv[i] *= k;
	return inv;
}
/** The camera's right/up basis from a view matrix (billboards face with these). */
function viewBasis(view) {
	return {
		right: {
			x: view[0],
			y: view[4],
			z: view[8]
		},
		up: {
			x: view[1],
			y: view[5],
			z: view[9]
		}
	};
}
function sub(a, b) {
	return {
		x: a.x - b.x,
		y: a.y - b.y,
		z: a.z - b.z
	};
}
function cross(a, b) {
	return {
		x: a.y * b.z - a.z * b.y,
		y: a.z * b.x - a.x * b.z,
		z: a.x * b.y - a.y * b.x
	};
}
function dot(a, b) {
	return a.x * b.x + a.y * b.y + a.z * b.z;
}
function norm(v) {
	const l = Math.hypot(v.x, v.y, v.z) || 1;
	return {
		x: v.x / l,
		y: v.y / l,
		z: v.z / l
	};
}
/**
* Extract the six frustum planes of a column-major viewProj (WebGPU depth
* 0..1; works for PERSPECTIVE and ORTHO alike): 24 floats, [a, b, c, d] ×
* (left, right, bottom, top, near, far), xyz normalised. A point is inside
* a plane when a·x + b·y + c·z + d ≥ 0. Gribb–Hartmann, near plane from
* the z ≥ 0 clip (not GL's z ≥ -w).
*/
function frustumPlanes(m) {
	const out = /* @__PURE__ */ new Float32Array(24);
	const set = (p, a, b, c, d) => {
		const l = Math.hypot(a, b, c) || 1;
		out[p] = a / l;
		out[p + 1] = b / l;
		out[p + 2] = c / l;
		out[p + 3] = d / l;
	};
	const r = (i) => [
		m[i],
		m[4 + i],
		m[8 + i],
		m[12 + i]
	];
	const [x0, y0, z0, w0] = r(0);
	const [x1, y1, z1, w1] = r(1);
	const [x2, y2, z2, w2] = r(2);
	const [x3, y3, z3, w3] = r(3);
	set(0, x3 + x0, y3 + y0, z3 + z0, w3 + w0);
	set(4, x3 - x0, y3 - y0, z3 - z0, w3 - w0);
	set(8, x3 + x1, y3 + y1, z3 + z1, w3 + w1);
	set(12, x3 - x1, y3 - y1, z3 - z1, w3 - w1);
	set(16, x2, y2, z2, w2);
	set(20, x3 - x2, y3 - y2, z3 - z2, w3 - w2);
	return out;
}
/** Sphere-vs-frustum: true when the sphere touches the volume (conservative
* — corner cases may pass a sphere that is just outside; never culls a
* visible one). `planes` from frustumPlanes(). */
function sphereVsFrustum(planes, x, y, z, r) {
	for (let p = 0; p < 24; p += 4) if (planes[p] * x + planes[p + 1] * y + planes[p + 2] * z + planes[p + 3] < -r) return false;
	return true;
}
/**
* A world-space picking ray from an NDC point (nx, ny in -1..1, y UP) —
* unproject near and far and take the difference. `invVp` is the inverse
* of the camera's viewProj (mat4Inverse). Returns unit dir.
*/
function rayFromNdc(invVp, nx, ny) {
	const un = (z) => {
		const x = invVp[0] * nx + invVp[4] * ny + invVp[8] * z + invVp[12];
		const y = invVp[1] * nx + invVp[5] * ny + invVp[9] * z + invVp[13];
		const zz = invVp[2] * nx + invVp[6] * ny + invVp[10] * z + invVp[14];
		const w = invVp[3] * nx + invVp[7] * ny + invVp[11] * z + invVp[15] || 1;
		return {
			x: x / w,
			y: y / w,
			z: zz / w
		};
	};
	const a = un(0);
	return {
		origin: a,
		dir: norm(sub(un(.999), a))
	};
}
/** Ray vs sphere: nearest positive hit distance, or null. */
function raySphere(origin, dir, c, r) {
	const oc = sub(origin, c);
	const b = dot(oc, dir);
	const disc = b * b - (dot(oc, oc) - r * r);
	if (disc < 0) return null;
	const s = Math.sqrt(disc);
	const t0 = -b - s, t1 = -b + s;
	if (t0 > 1e-6) return t0;
	if (t1 > 1e-6) return t1;
	return null;
}
/** Ray vs the horizontal plane y = h: hit point, or null (parallel/behind). */
function rayPlaneY(origin, dir, h) {
	if (Math.abs(dir.y) < 1e-9) return null;
	const t = (h - origin.y) / dir.y;
	if (t <= 1e-6) return null;
	return {
		x: origin.x + dir.x * t,
		y: h,
		z: origin.z + dir.z * t
	};
}
/**
* Ray vs an ORIENTED box (the engine euler order: roll about z, pitch
* about x, yaw about y — the mesh shader's rotate()): nearest positive hit
* distance or null. Exact for boxes and a tight proxy for everything else —
* bounding SPHERES are useless for flat meshes (a ground disc's sphere
* swallows every click in the scene).
*/
function rayObb(origin, dir, center, half, yaw, pitch, roll) {
	const rot = (v) => {
		let { x, y, z } = v;
		const cy = Math.cos(yaw), sy = Math.sin(yaw);
		[x, z] = [x * cy + z * sy, -x * sy + z * cy];
		const cp = Math.cos(-pitch), sp = Math.sin(-pitch);
		[y, z] = [y * cp - z * sp, y * sp + z * cp];
		const cr = Math.cos(-roll), sr = Math.sin(-roll);
		[x, y] = [x * cr - y * sr, x * sr + y * cr];
		return {
			x,
			y,
			z
		};
	};
	const o = rot(sub(origin, center));
	const d = rot(dir);
	let tMin = -Infinity, tMax = Infinity;
	for (const [oc, dc, hc] of [
		[
			o.x,
			d.x,
			half.x
		],
		[
			o.y,
			d.y,
			half.y
		],
		[
			o.z,
			d.z,
			half.z
		]
	]) {
		if (Math.abs(dc) < 1e-12) {
			if (Math.abs(oc) > hc) return null;
			continue;
		}
		const t1 = (-hc - oc) / dc, t2 = (hc - oc) / dc;
		tMin = Math.max(tMin, Math.min(t1, t2));
		tMax = Math.min(tMax, Math.max(t1, t2));
		if (tMin > tMax) return null;
	}
	if (tMax <= 1e-6) return null;
	return tMin > 1e-6 ? tMin : tMax;
}
/**
* Ray vs an oriented box derived from a mesh's LOCAL geometry AABB. `pos` +
* `size` (w,h,d) + euler place a UNIT-fit geometry; `bounds` is that
* geometry's local AABB (centre + half-extents, unit space). The box is the
* AABB scaled by `size`, its centre offset rotated into world (mesh euler
* order: roll·z → pitch·x → yaw·y). With no `bounds`, falls back to the
* symmetric size/2 cube (only exact for `box`). Nearest positive t or null.
*
* This is what makes picking tight for off-centre / thin / multi-part model
* geometry, whose symmetric w/h/d cube overshoots and swallows clicks behind
* it.
*/
function rayObbLocal(origin, dir, pos, size, yaw, pitch, roll, bounds) {
	if (!bounds) return rayObb(origin, dir, pos, {
		x: size.x / 2,
		y: size.y / 2,
		z: size.z / 2
	}, yaw, pitch, roll);
	let ox = bounds.cx * size.x, oy = bounds.cy * size.y, oz = bounds.cz * size.z;
	const cr = Math.cos(roll), sr = Math.sin(roll);
	[ox, oy] = [ox * cr - oy * sr, ox * sr + oy * cr];
	const cp = Math.cos(pitch), sp = Math.sin(pitch);
	[oy, oz] = [oy * cp - oz * sp, oy * sp + oz * cp];
	const cy = Math.cos(yaw), sy = Math.sin(yaw);
	[ox, oz] = [ox * cy - oz * sy, ox * sy + oz * cy];
	return rayObb(origin, dir, {
		x: pos.x + ox,
		y: pos.y + oy,
		z: pos.z + oz
	}, {
		x: bounds.hx * size.x,
		y: bounds.hy * size.y,
		z: bounds.hz * size.z
	}, yaw, pitch, roll);
}
//#endregion
//#region src/lib/anim3d.ts
/**
* Shortest-path spherical lerp between quats a and b (components, not
* objects — the hot path never allocates inputs). When the quats are
* near-parallel the sin() denominator degenerates, so we fall back to
* normalized lerp, which is indistinguishable there.
*/
function quatSlerp(ax, ay, az, aw, bx, by, bz, bw, t) {
	let dot = ax * bx + ay * by + az * bz + aw * bw;
	if (dot < 0) {
		bx = -bx;
		by = -by;
		bz = -bz;
		bw = -bw;
		dot = -dot;
	}
	let ka;
	let kb;
	if (dot > .9995) {
		ka = 1 - t;
		kb = t;
	} else {
		const theta = Math.acos(Math.min(1, dot));
		const sinTheta = Math.sin(theta);
		ka = Math.sin((1 - t) * theta) / sinTheta;
		kb = Math.sin(t * theta) / sinTheta;
	}
	let x = ka * ax + kb * bx;
	let y = ka * ay + kb * by;
	let z = ka * az + kb * bz;
	let w = ka * aw + kb * bw;
	const len = Math.hypot(x, y, z, w) || 1;
	x /= len;
	y /= len;
	z /= len;
	w /= len;
	return [
		x,
		y,
		z,
		w
	];
}
/**
* Bake translation + quaternion + scale into a column-major mat4 (T·R·S —
* scale first, then rotate, then translate; same convention as math3d).
*/
function trsToMat4(t, r, s, out) {
	const m = out ?? /* @__PURE__ */ new Float32Array(16);
	const x = r[0], y = r[1], z = r[2], w = r[3];
	const x2 = x + x, y2 = y + y, z2 = z + z;
	const xx = x * x2, xy = x * y2, xz = x * z2;
	const yy = y * y2, yz = y * z2, zz = z * z2;
	const wx = w * x2, wy = w * y2, wz = w * z2;
	const sx = s[0], sy = s[1], sz = s[2];
	m[0] = (1 - (yy + zz)) * sx;
	m[1] = (xy + wz) * sx;
	m[2] = (xz - wy) * sx;
	m[3] = 0;
	m[4] = (xy - wz) * sy;
	m[5] = (1 - (xx + zz)) * sy;
	m[6] = (yz + wx) * sy;
	m[7] = 0;
	m[8] = (xz + wy) * sz;
	m[9] = (yz - wx) * sz;
	m[10] = (1 - (xx + yy)) * sz;
	m[11] = 0;
	m[12] = t[0];
	m[13] = t[1];
	m[14] = t[2];
	m[15] = 1;
	return m;
}
/** out[oo..oo+16] = a[ao..] × b[bo..] — offset multiply, zero allocation. */
function mulAt(a, ao, b, bo, out, oo) {
	for (let c = 0; c < 4; c++) {
		const b0 = b[bo + c * 4], b1 = b[bo + c * 4 + 1], b2 = b[bo + c * 4 + 2], b3 = b[bo + c * 4 + 3];
		for (let r = 0; r < 4; r++) out[oo + c * 4 + r] = a[ao + r] * b0 + a[ao + 4 + r] * b1 + a[ao + 8 + r] * b2 + a[ao + 12 + r] * b3;
	}
}
/** out = a × b, allocation-free (out must not alias a or b). Column-major. */
function mat4MulTo(a, b, out) {
	mulAt(a, 0, b, 0, out, 0);
}
/**
* Sample one animation channel at time `tt` (caller pre-wraps for looping)
* into `out` (3 floats for translation/scale, 4 for rotation). Binary-searches
* the keyframe span; STEP holds the left key, LINEAR lerps (slerp for
* rotation), CUBICSPLINE reads the middle element of each in/value/out triplet
* and lerps linearly between keys. Clamps outside the keyframe range.
*/
function sampleChannel(ch, tt, out) {
	const comps = ch.path === "rotation" ? 4 : 3;
	const cubic = ch.interpolation === "CUBICSPLINE";
	const stride = cubic ? comps * 3 : comps;
	const valueOfs = cubic ? comps : 0;
	const times = ch.times;
	const values = ch.values;
	const n = times.length;
	const read = (key, into, at) => {
		const base = key * stride + valueOfs;
		for (let i = 0; i < comps; i++) into[at + i] = values[base + i];
	};
	if (n === 0) return;
	if (tt <= times[0] || n === 1) {
		read(0, out, 0);
		return;
	}
	if (tt >= times[n - 1]) {
		read(n - 1, out, 0);
		return;
	}
	let lo = 0;
	let hi = n - 1;
	while (hi - lo > 1) {
		const mid = lo + hi >> 1;
		if (times[mid] <= tt) lo = mid;
		else hi = mid;
	}
	if (ch.interpolation === "STEP") {
		read(lo, out, 0);
		return;
	}
	const t0 = times[lo];
	const t1 = times[hi];
	const f = t1 > t0 ? (tt - t0) / (t1 - t0) : 0;
	const a = lo * stride + valueOfs;
	const b = hi * stride + valueOfs;
	if (ch.path === "rotation") {
		const q = quatSlerp(values[a], values[a + 1], values[a + 2], values[a + 3], values[b], values[b + 1], values[b + 2], values[b + 3], f);
		out[0] = q[0];
		out[1] = q[1];
		out[2] = q[2];
		out[3] = q[3];
	} else for (let i = 0; i < comps; i++) out[i] = values[a + i] + (values[b + i] - values[a + i]) * f;
}
var resolvedScratch = /* @__PURE__ */ new Uint8Array(0);
/**
* Compose world matrices for every node from local matrices. `parents[i]` is
* the parent node index or -1 for roots — parents may appear ANYWHERE in the
* array (glTF imposes no parent-before-child order), so nodes are resolved
* iteratively until every one has a resolved parent. locals and worlds are
* 16-floats-per-node arrays; worlds must not alias locals.
*/
function composeWorlds(parents, locals, worlds) {
	const n = parents.length;
	if (resolvedScratch.length < n) resolvedScratch = new Uint8Array(n);
	else resolvedScratch.fill(0, 0, n);
	let remaining = n;
	while (remaining > 0) {
		const before = remaining;
		for (let i = 0; i < n; i++) {
			if (resolvedScratch[i]) continue;
			const p = parents[i];
			if (p < 0) worlds.set(locals.subarray(i * 16, i * 16 + 16), i * 16);
			else if (resolvedScratch[p]) mulAt(worlds, p * 16, locals, i * 16, worlds, i * 16);
			else continue;
			resolvedScratch[i] = 1;
			remaining--;
		}
		if (remaining === before) break;
	}
}
/**
* palette[j] = worlds[skin.joints[j]] × inverseBind[j] — 16 floats per joint
* into `out`. Allocation-free hot path, called per frame per skinned model.
*/
function jointPalette(skin, worlds, out) {
	const joints = skin.joints;
	const ib = skin.inverseBind;
	for (let j = 0; j < joints.length; j++) mulAt(worlds, joints[j] * 16, ib, j * 16, out, j * 16);
}
/**
* Decompose an affine TRS matrix (glTF forbids skew) into translation, scale
* and Euler angles in the ENGINE's rotation order: the mesh shader applies
* roll (Z), then pitch (X), then yaw (Y) — R = Ry(yaw)·Rx(pitch)·Rz(roll) —
* so writing these onto a mesh's yaw/pitch/roll reproduces the matrix's
* orientation exactly. Same convention (gimbal branch included) as
* physics3d's quatToEuler: at pitch = ±90° roll is folded into yaw. Scale is
* per-column length; a negative determinant folds into the sign of s.z.
*/
function decomposeTRS(m) {
	const t = [
		m[12],
		m[13],
		m[14]
	];
	let sx = Math.hypot(m[0], m[1], m[2]);
	let sy = Math.hypot(m[4], m[5], m[6]);
	let sz = Math.hypot(m[8], m[9], m[10]);
	if (m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]) < 0) sz = -sz;
	const isx = sx ? 1 / sx : 0;
	const isy = sy ? 1 / sy : 0;
	const isz = sz ? 1 / sz : 0;
	const sinPitch = Math.max(-1, Math.min(1, -m[9] * isz));
	let yaw;
	let pitch;
	let roll;
	if (Math.abs(sinPitch) > .99999) {
		pitch = sinPitch > 0 ? Math.PI / 2 : -Math.PI / 2;
		roll = 0;
		yaw = -Math.atan2(Math.sign(sinPitch) * m[4] * isy, m[0] * isx);
	} else {
		pitch = Math.asin(sinPitch);
		yaw = -Math.atan2(m[8] * isz, m[10] * isz);
		roll = Math.atan2(m[1] * isx, m[5] * isy);
	}
	return {
		t,
		e: [
			yaw,
			pitch,
			roll
		],
		s: [
			sx,
			sy,
			sz
		]
	};
}
var POSE = 10;
/**
* The pure clip mixer: tracks the active clip plus an optional crossfade from
* the previous one. Every update(dt) advances time, samples each animated
* channel, blends poses during a fade (lerp t/s, slerp r), bakes local
* matrices and composes world matrices. Nodes no clip ever animates keep
* their rest matrices, computed once. All per-frame work is allocation-free.
*/
var AnimMixer = class {
	/** Clip names, in rig order — play() accepts a name or this index. */
	anims;
	/** Local (16/node) and world (16/node) matrices, rebuilt by update(). */
	locals;
	worlds;
	/** Seconds into the current clip. */
	time = 0;
	/** True while a clip is active (one-shots flip to false when they finish). */
	playing = false;
	/** One-shot finished — sticky until the next play(). */
	done = false;
	rig;
	parents;
	restPose;
	poseA;
	poseB;
	animated;
	sampleScratch = /* @__PURE__ */ new Float32Array(4);
	current = null;
	previous = null;
	fadeTime = 0;
	fadeDuration = 0;
	constructor(rig) {
		this.rig = rig;
		const n = rig.nodes.length;
		this.anims = rig.anims.map((a) => a.name);
		this.parents = new Int32Array(n);
		this.locals = new Float32Array(n * 16);
		this.worlds = new Float32Array(n * 16);
		this.restPose = new Float32Array(n * POSE);
		this.poseA = new Float32Array(n * POSE);
		this.poseB = new Float32Array(n * POSE);
		this.animated = new Uint8Array(n);
		for (const anim of rig.anims) for (const ch of anim.channels) this.animated[ch.node] = 1;
		for (let i = 0; i < n; i++) {
			const node = rig.nodes[i];
			this.parents[i] = node.parent;
			const p = i * POSE;
			this.restPose[p] = node.t[0];
			this.restPose[p + 1] = node.t[1];
			this.restPose[p + 2] = node.t[2];
			this.restPose[p + 3] = node.r[0];
			this.restPose[p + 4] = node.r[1];
			this.restPose[p + 5] = node.r[2];
			this.restPose[p + 6] = node.r[3];
			this.restPose[p + 7] = node.s[0];
			this.restPose[p + 8] = node.s[1];
			this.restPose[p + 9] = node.s[2];
			this.bakeLocal(this.restPose, i);
		}
		composeWorlds(this.parents, this.locals, this.worlds);
	}
	/** Start a clip by name or index. Crossfades from the current clip over
	* `fade` seconds (0 = hard cut). Unknown names are ignored. */
	play(clip, opts = {}) {
		const index = typeof clip === "number" ? clip : this.anims.indexOf(clip);
		if (index < 0 || index >= this.rig.anims.length) return;
		const fade = opts.fade ?? .25;
		if (this.current && fade > 0) {
			this.previous = this.current;
			this.fadeTime = 0;
			this.fadeDuration = fade;
		} else {
			this.previous = null;
			this.fadeDuration = 0;
		}
		this.current = {
			index,
			time: 0,
			loop: opts.loop ?? true
		};
		this.time = 0;
		this.playing = true;
		this.done = false;
	}
	/** Advance by dt seconds and rebuild locals + worlds. Honours `playing`:
	* set it false to FREEZE the pose (walk → idle), true to resume. */
	update(dt) {
		const cur = this.current;
		if (!cur || !this.playing) return;
		this.advance(cur, dt);
		this.time = cur.time;
		if (!cur.loop && this.time >= this.rig.anims[cur.index].duration) {
			this.done = true;
			this.playing = false;
		}
		this.evaluate(cur, this.poseA);
		let blend = 1;
		if (this.previous) {
			this.advance(this.previous, dt);
			this.fadeTime += dt;
			blend = this.fadeDuration > 0 ? Math.min(1, this.fadeTime / this.fadeDuration) : 1;
			if (blend >= 1) this.previous = null;
			else {
				this.evaluate(this.previous, this.poseB);
				this.blendPoses(this.poseB, this.poseA, blend, this.poseA);
			}
		}
		const n = this.rig.nodes.length;
		for (let i = 0; i < n; i++) if (this.animated[i]) this.bakeLocal(this.poseA, i);
		composeWorlds(this.parents, this.locals, this.worlds);
	}
	advance(state, dt) {
		const duration = this.rig.anims[state.index].duration;
		state.time += dt;
		if (state.loop && duration > 0 && state.time >= duration) state.time %= duration;
		else if (!state.loop && state.time > duration) state.time = duration;
	}
	/** Write the clip's pose at its current time into `pose` (rest + channels). */
	evaluate(state, pose) {
		pose.set(this.restPose);
		const anim = this.rig.anims[state.index];
		const s4 = this.sampleScratch;
		for (const ch of anim.channels) {
			sampleChannel(ch, state.time, s4);
			const p = ch.node * POSE;
			if (ch.path === "translation") {
				pose[p] = s4[0];
				pose[p + 1] = s4[1];
				pose[p + 2] = s4[2];
			} else if (ch.path === "rotation") {
				pose[p + 3] = s4[0];
				pose[p + 4] = s4[1];
				pose[p + 5] = s4[2];
				pose[p + 6] = s4[3];
			} else {
				pose[p + 7] = s4[0];
				pose[p + 8] = s4[1];
				pose[p + 9] = s4[2];
			}
		}
	}
	/** out = mix(a, b, t) per node: lerp t/s, slerp r. out may alias b. */
	blendPoses(a, b, t, out) {
		const n = this.rig.nodes.length;
		for (let i = 0; i < n; i++) {
			const p = i * POSE;
			out[p] = a[p] + (b[p] - a[p]) * t;
			out[p + 1] = a[p + 1] + (b[p + 1] - a[p + 1]) * t;
			out[p + 2] = a[p + 2] + (b[p + 2] - a[p + 2]) * t;
			const q = quatSlerp(a[p + 3], a[p + 4], a[p + 5], a[p + 6], b[p + 3], b[p + 4], b[p + 5], b[p + 6], t);
			out[p + 3] = q[0];
			out[p + 4] = q[1];
			out[p + 5] = q[2];
			out[p + 6] = q[3];
			out[p + 7] = a[p + 7] + (b[p + 7] - a[p + 7]) * t;
			out[p + 8] = a[p + 8] + (b[p + 8] - a[p + 8]) * t;
			out[p + 9] = a[p + 9] + (b[p + 9] - a[p + 9]) * t;
		}
	}
	/** Bake pose[node] (TRS) into this.locals[node]. */
	bakeLocal(pose, node) {
		const p = node * POSE;
		const m = this.locals;
		const o = node * 16;
		const x = pose[p + 3], y = pose[p + 4], z = pose[p + 5], w = pose[p + 6];
		const x2 = x + x, y2 = y + y, z2 = z + z;
		const xx = x * x2, xy = x * y2, xz = x * z2;
		const yy = y * y2, yz = y * z2, zz = z * z2;
		const wx = w * x2, wy = w * y2, wz = w * z2;
		const sx = pose[p + 7], sy = pose[p + 8], sz = pose[p + 9];
		m[o] = (1 - (yy + zz)) * sx;
		m[o + 1] = (xy + wz) * sx;
		m[o + 2] = (xz - wy) * sx;
		m[o + 3] = 0;
		m[o + 4] = (xy - wz) * sy;
		m[o + 5] = (1 - (xx + zz)) * sy;
		m[o + 6] = (yz + wx) * sy;
		m[o + 7] = 0;
		m[o + 8] = (xz + wy) * sz;
		m[o + 9] = (yz - wx) * sz;
		m[o + 10] = (1 - (xx + yy)) * sz;
		m[o + 11] = 0;
		m[o + 12] = pose[p];
		m[o + 13] = pose[p + 1];
		m[o + 14] = pose[p + 2];
		m[o + 15] = 1;
	}
};
//#endregion
//#region src/lib/noise.ts
/** Tiny fast seeded PRNG (mulberry32) — good enough for permutation shuffles. */
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a = a + 1831565813 >>> 0;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
/** Seeded permutation table (512 entries, doubled) for the lattice hash. */
function noisePerm(seed = 1) {
	const rnd = mulberry32(seed);
	const p = /* @__PURE__ */ new Uint8Array(512);
	for (let i = 0; i < 256; i++) p[i] = i;
	for (let i = 255; i > 0; i--) {
		const j = Math.floor(rnd() * (i + 1));
		const t = p[i];
		p[i] = p[j];
		p[j] = t;
	}
	for (let i = 0; i < 256; i++) p[256 + i] = p[i];
	return p;
}
var GRAD = [
	[1, 1],
	[-1, 1],
	[1, -1],
	[-1, -1],
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1]
];
var fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
var lerp = (a, b, t) => a + (b - a) * t;
/**
* 2D Perlin gradient noise in ~[-1, 1]. `period` > 0 wraps the lattice so
* the pattern TILES every `period` units (keep period ≤ 256).
*/
function perlin2(x, y, perm, period = 0) {
	let xi = Math.floor(x), yi = Math.floor(y);
	const xf = x - xi, yf = y - yi;
	const wrap = (v) => (period > 0 ? (v % period + period) % period : v) & 255;
	const g = (ix, iy, dx, dy) => {
		const [gx, gy] = GRAD[perm[perm[wrap(ix)] + wrap(iy) & 255] & 7];
		return gx * dx + gy * dy;
	};
	const u = fade(xf), v = fade(yf);
	return lerp(lerp(g(xi, yi, xf, yf), g(xi + 1, yi, xf - 1, yf), u), lerp(g(xi, yi + 1, xf, yf - 1), g(xi + 1, yi + 1, xf - 1, yf - 1), u), v) * 1.4142;
}
/** Fractal Brownian motion over perlin2 — layered detail, still ~[-1, 1]. */
function fbm2(x, y, perm, opts = {}) {
	const { octaves = 4, lacunarity = 2, gain = .5, period = 0 } = opts;
	let amp = 1, freq = 1, sum = 0, norm = 0;
	for (let o = 0; o < octaves; o++) {
		sum += amp * perlin2(x * freq, y * freq, perm, period > 0 ? Math.round(period * freq) : 0);
		norm += amp;
		amp *= gain;
		freq *= lacunarity;
	}
	return sum / norm;
}
/** Noise field as Float32Array in [0, 1], row-major size×size. DOM-free. */
function noiseData(opts = {}) {
	const size = Math.max(8, Math.round(opts.size ?? 256));
	const cell = Math.max(2, Math.round(opts.cell ?? size / 4));
	const octaves = opts.octaves ?? 4;
	const tile = opts.tile ?? true;
	const perm = noisePerm(opts.seed ?? 1);
	const period = tile ? Math.max(1, Math.round(size / cell)) : 0;
	const inv = (tile ? period : size / cell) / size;
	const data = new Float32Array(size * size);
	const fopts = {
		octaves,
		lacunarity: opts.lacunarity ?? 2,
		gain: opts.gain ?? .5,
		period
	};
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) data[y * size + x] = Math.min(1, Math.max(0, fbm2(x * inv, y * inv, perm, fopts) * .5 + .5));
	return {
		data,
		size
	};
}
/**
* Noise as a canvas, ready for `game.assets.frames()`. Two shapes:
* - default: opaque grayscale (a lookup/pattern texture);
* - `alpha: true`: WHITE with noise in the ALPHA channel — the smoke/steam
*   shape (tint it with the sprite verb, stack layers, scroll it).
* `mask: 'radial'` multiplies in a soft circular falloff — the PUFF shape
* (a single billow of smoke/steam/cloud with no visible quad edge). Masked
* textures no longer tile; draw them whole and vary with `rot`/seeds.
*/
function noiseCanvas(opts = {}) {
	const { data, size } = noiseData(opts);
	const canvas = document.createElement("canvas");
	canvas.width = size;
	canvas.height = size;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("noiseCanvas: no 2d context");
	const img = ctx.createImageData(size, size);
	const half = size / 2;
	for (let i = 0; i < data.length; i++) {
		let f = data[i];
		if (opts.mask === "radial") {
			const dx = (i % size + .5 - half) / half, dy = (Math.floor(i / size) + .5 - half) / half;
			const m = Math.max(0, 1 - Math.hypot(dx, dy));
			f *= m * m * (3 - 2 * m);
		}
		const v = Math.round(f * 255);
		if (opts.alpha) {
			img.data[i * 4] = 255;
			img.data[i * 4 + 1] = 255;
			img.data[i * 4 + 2] = 255;
			img.data[i * 4 + 3] = v;
		} else {
			img.data[i * 4] = v;
			img.data[i * 4 + 1] = v;
			img.data[i * 4 + 2] = v;
			img.data[i * 4 + 3] = 255;
		}
	}
	ctx.putImageData(img, 0, 0);
	return canvas;
}
//#endregion
//#region src/lib/path3d.ts
/** CENTRIPETAL Catmull-Rom on one segment (p0..p3 window, u 0..1 across
* p1→p2) — Barry–Goldman with sqrt-chord knots. Centripetal is the game
* choice: uniform CR OVERSHOOTS wildly when control points are unevenly
* spaced (a 1-unit hop next to a 99-unit run loops back on itself);
* centripetal never self-intersects within a segment. */
function catmullRom3(p0, p1, p2, p3, u) {
	const knot = (a, b, t) => t + Math.max(1e-6, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])));
	const t0 = 0;
	const t1 = knot(p0, p1, t0);
	const t2 = knot(p1, p2, t1);
	const t3 = knot(p2, p3, t2);
	const t = t1 + (t2 - t1) * u;
	const mix = (a, b, ta, tb) => {
		const k = (t - ta) / (tb - ta);
		return [
			a[0] + (b[0] - a[0]) * k,
			a[1] + (b[1] - a[1]) * k,
			a[2] + (b[2] - a[2]) * k
		];
	};
	const A1 = mix(p0, p1, t0, t1);
	const A2 = mix(p1, p2, t1, t2);
	const A3 = mix(p2, p3, t2, t3);
	const C = mix(mix(A1, A2, t0, t2), mix(A2, A3, t1, t3), t1, t2);
	return [
		C[0],
		C[1],
		C[2]
	];
}
var Path3d = class {
	/** Total arc length (world units). */
	length;
	closed;
	px;
	py;
	pz;
	tx;
	ty;
	tz;
	nx;
	ny;
	nz;
	cum;
	n;
	constructor(points, opts = {}) {
		const pts = points.map((p) => Array.isArray(p) ? [
			p[0],
			p[1],
			p[2]
		] : [
			p.x,
			p.y,
			p.z
		]);
		if (pts.length < 2) throw new Error("Path3d: need at least 2 points");
		this.closed = opts.closed ?? false;
		const per = Math.max(4, Math.floor(opts.samplesPerSegment ?? 24));
		const segs = this.closed ? pts.length : pts.length - 1;
		const n = this.n = segs * per + 1;
		this.px = new Float64Array(n);
		this.py = new Float64Array(n);
		this.pz = new Float64Array(n);
		this.tx = new Float64Array(n);
		this.ty = new Float64Array(n);
		this.tz = new Float64Array(n);
		this.nx = new Float64Array(n);
		this.ny = new Float64Array(n);
		this.nz = new Float64Array(n);
		this.cum = new Float64Array(n);
		const at = (i) => {
			const m = pts.length;
			if (this.closed) return pts[(i % m + m) % m];
			return pts[Math.min(m - 1, Math.max(0, i))];
		};
		for (let s = 0; s < segs; s++) for (let k = 0; k < per; k++) {
			const i = s * per + k;
			const [x, y, z] = catmullRom3(at(s - 1), at(s), at(s + 1), at(s + 2), k / per);
			this.px[i] = x;
			this.py[i] = y;
			this.pz[i] = z;
		}
		{
			const last = this.closed ? at(0) : at(segs);
			const end = this.closed ? [
				this.px[0],
				this.py[0],
				this.pz[0]
			] : catmullRom3(at(segs - 1), at(segs), at(segs + 1), at(segs + 2), 1);
			this.px[n - 1] = this.closed ? last[0] : end[0];
			this.py[n - 1] = this.closed ? last[1] : end[1];
			this.pz[n - 1] = this.closed ? last[2] : end[2];
		}
		for (let i = 1; i < n; i++) this.cum[i] = this.cum[i - 1] + Math.hypot(this.px[i] - this.px[i - 1], this.py[i] - this.py[i - 1], this.pz[i] - this.pz[i - 1]);
		this.length = this.cum[n - 1];
		for (let i = 0; i < n; i++) {
			const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
			let vx = this.px[b] - this.px[a], vy = this.py[b] - this.py[a], vz = this.pz[b] - this.pz[a];
			const l = Math.hypot(vx, vy, vz) || 1;
			this.tx[i] = vx / l;
			this.ty[i] = vy / l;
			this.tz[i] = vz / l;
		}
		{
			const t0 = [
				this.tx[0],
				this.ty[0],
				this.tz[0]
			];
			let ax = -t0[0] * t0[1], ay = 1 - t0[1] * t0[1], az = -t0[2] * t0[1];
			let l = Math.hypot(ax, ay, az);
			if (l < 1e-4) {
				ax = 1 - t0[0] * t0[0];
				ay = -t0[1] * t0[0];
				az = -t0[2] * t0[0];
				l = Math.hypot(ax, ay, az) || 1;
			}
			this.nx[0] = ax / l;
			this.ny[0] = ay / l;
			this.nz[0] = az / l;
		}
		for (let i = 1; i < n; i++) {
			const a = [
				this.tx[i - 1],
				this.ty[i - 1],
				this.tz[i - 1]
			];
			const c = [
				this.tx[i],
				this.ty[i],
				this.tz[i]
			];
			let ax = a[1] * c[2] - a[2] * c[1], ay = a[2] * c[0] - a[0] * c[2], az = a[0] * c[1] - a[1] * c[0];
			const l = Math.hypot(ax, ay, az);
			if (l < 1e-9) {
				this.nx[i] = this.nx[i - 1];
				this.ny[i] = this.ny[i - 1];
				this.nz[i] = this.nz[i - 1];
				continue;
			}
			ax /= l;
			ay /= l;
			az /= l;
			const dot = Math.min(1, Math.max(-1, a[0] * c[0] + a[1] * c[1] + a[2] * c[2]));
			const ang = Math.acos(dot), cs = Math.cos(ang), sn = Math.sin(ang);
			const v = [
				this.nx[i - 1],
				this.ny[i - 1],
				this.nz[i - 1]
			];
			const d = (1 - cs) * (ax * v[0] + ay * v[1] + az * v[2]);
			this.nx[i] = v[0] * cs + (ay * v[2] - az * v[1]) * sn + ax * d;
			this.ny[i] = v[1] * cs + (az * v[0] - ax * v[2]) * sn + ay * d;
			this.nz[i] = v[2] * cs + (ax * v[1] - ay * v[0]) * sn + az * d;
		}
		if (this.closed) {
			const nEnd = [
				this.nx[n - 1],
				this.ny[n - 1],
				this.nz[n - 1]
			];
			const n0 = [
				this.nx[0],
				this.ny[0],
				this.nz[0]
			];
			const t0 = [
				this.tx[0],
				this.ty[0],
				this.tz[0]
			];
			const b0 = [
				t0[1] * n0[2] - t0[2] * n0[1],
				t0[2] * n0[0] - t0[0] * n0[2],
				t0[0] * n0[1] - t0[1] * n0[0]
			];
			const twist = Math.atan2(nEnd[0] * b0[0] + nEnd[1] * b0[1] + nEnd[2] * b0[2], nEnd[0] * n0[0] + nEnd[1] * n0[1] + nEnd[2] * n0[2]);
			for (let i = 1; i < n; i++) {
				const ang = -twist * (i / (n - 1)), cs = Math.cos(ang), sn = Math.sin(ang);
				const t = [
					this.tx[i],
					this.ty[i],
					this.tz[i]
				];
				const v = [
					this.nx[i],
					this.ny[i],
					this.nz[i]
				];
				const d = (1 - cs) * (t[0] * v[0] + t[1] * v[1] + t[2] * v[2]);
				this.nx[i] = v[0] * cs + (t[1] * v[2] - t[2] * v[1]) * sn + t[0] * d;
				this.ny[i] = v[1] * cs + (t[2] * v[0] - t[0] * v[2]) * sn + t[1] * d;
				this.nz[i] = v[2] * cs + (t[0] * v[1] - t[1] * v[0]) * sn + t[2] * d;
			}
		}
	}
	/** Sample index + blend for an arc-length fraction (binary search). */
	locate(t) {
		const d = (this.closed ? (t % 1 + 1) % 1 : Math.min(1, Math.max(0, t))) * this.length;
		let lo = 0, hi = this.n - 1;
		while (lo + 1 < hi) {
			const mid = lo + hi >> 1;
			if (this.cum[mid] <= d) lo = mid;
			else hi = mid;
		}
		const span = this.cum[hi] - this.cum[lo];
		return [lo, span > 1e-12 ? (d - this.cum[lo]) / span : 0];
	}
	/** Position at arc-length fraction t (0..1; closed paths wrap). */
	at(t) {
		const [i, u] = this.locate(t);
		return {
			x: this.px[i] + (this.px[i + 1] - this.px[i]) * u,
			y: this.py[i] + (this.py[i + 1] - this.py[i]) * u,
			z: this.pz[i] + (this.pz[i + 1] - this.pz[i]) * u
		};
	}
	/** Position at a distance in world units along the path. */
	atDist(d) {
		return this.at(this.length > 0 ? d / this.length : 0);
	}
	/** Full frame at t: position + tangent + parallel-transported normal +
	* binormal (all unit) — orient a cart, bank a camera, place a rail tie. */
	frame(t) {
		const [i, u] = this.locate(t);
		const lerp = (a) => a[i] + (a[i + 1] - a[i]) * u;
		let tx = lerp(this.tx), ty = lerp(this.ty), tz = lerp(this.tz);
		let l = Math.hypot(tx, ty, tz) || 1;
		tx /= l;
		ty /= l;
		tz /= l;
		let nx = lerp(this.nx), ny = lerp(this.ny), nz = lerp(this.nz);
		const dot = nx * tx + ny * ty + nz * tz;
		nx -= tx * dot;
		ny -= ty * dot;
		nz -= tz * dot;
		l = Math.hypot(nx, ny, nz) || 1;
		nx /= l;
		ny /= l;
		nz /= l;
		return {
			x: lerp(this.px),
			y: lerp(this.py),
			z: lerp(this.pz),
			tx,
			ty,
			tz,
			nx,
			ny,
			nz,
			bx: ty * nz - tz * ny,
			by: tz * nx - tx * nz,
			bz: tx * ny - ty * nx
		};
	}
	/** n points evenly spaced by ARC LENGTH — feed world.tube({ path }) or a
	* vector polyline directly. Closed paths omit the duplicate end point. */
	points(count) {
		const out = [];
		const m = Math.max(2, Math.floor(count));
		for (let i = 0; i < m; i++) {
			const t = this.closed ? i / m : i / (m - 1);
			const p = this.at(t);
			out.push([
				p.x,
				p.y,
				p.z
			]);
		}
		return out;
	}
};
var DynamicPath3d = class {
	/** Samples per baked segment (fixed at construction). */
	per;
	pts = [];
	ptsBase = 0;
	bakedSegs = 0;
	sx = [];
	sy = [];
	sz = [];
	stx = [];
	sty = [];
	stz = [];
	snx = [];
	sny = [];
	snz = [];
	cum = [];
	constructor(opts = {}) {
		this.per = Math.max(4, Math.floor(opts.samplesPerSegment ?? 16));
	}
	/** Distance at the START of the ridable window (advances with trim()). */
	get start() {
		return this.cum.length ? this.cum[0] : 0;
	}
	/** Distance at the END of the ridable window (grows with add()). Keep
	* adding while `head - riderDist` shrinks — the rider must never catch
	* the head. 0 until three waypoints exist. */
	get head() {
		return this.cum.length ? this.cum[this.cum.length - 1] : 0;
	}
	/** Ridable yet? (needs 3 waypoints for the first baked segment). */
	get ready() {
		return this.cum.length > 1;
	}
	/** Append a waypoint AHEAD. Bakes every segment that just became stable
	* and drops control points the baker no longer needs. */
	add(x, y = 0, z = 0) {
		const p = typeof x === "number" ? [
			x,
			y,
			z
		] : [
			x.x,
			x.y,
			x.z
		];
		this.pts.push(p);
		const total = this.ptsBase + this.pts.length;
		while (this.bakedSegs <= total - 3) this.bakeSeg(this.bakedSegs++);
		while (this.ptsBase < this.bakedSegs - 1) {
			this.pts.shift();
			this.ptsBase++;
		}
	}
	bakeSeg(s) {
		const at = (i) => this.pts[Math.max(0, i - this.ptsBase)];
		const p0 = at(s - 1), p1 = at(s), p2 = at(s + 1), p3 = at(s + 2);
		const first = this.cum.length === 0;
		for (let k = first ? 0 : 1; k <= this.per; k++) {
			const [x, yy, zz] = catmullRom3(p0, p1, p2, p3, k / this.per);
			const n = this.cum.length;
			const d = n ? this.cum[n - 1] + Math.hypot(x - this.sx[n - 1], yy - this.sy[n - 1], zz - this.sz[n - 1]) : 0;
			this.sx.push(x);
			this.sy.push(yy);
			this.sz.push(zz);
			this.cum.push(d);
			this.stx.push(0);
			this.sty.push(0);
			this.stz.push(0);
			this.snx.push(0);
			this.sny.push(0);
			this.snz.push(0);
		}
		const n = this.cum.length;
		const from = Math.max(0, n - this.per - 2);
		for (let i = from; i < n; i++) {
			const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
			const vx = this.sx[b] - this.sx[a], vy = this.sy[b] - this.sy[a], vz = this.sz[b] - this.sz[a];
			const l = Math.hypot(vx, vy, vz) || 1;
			this.stx[i] = vx / l;
			this.sty[i] = vy / l;
			this.stz[i] = vz / l;
		}
		let i0 = from;
		if (i0 === 0) {
			const tx = this.stx[0], ty = this.sty[0], tz = this.stz[0];
			let ax = -tx * ty, ay = 1 - ty * ty, az = -tz * ty;
			let l = Math.hypot(ax, ay, az);
			if (l < 1e-4) {
				ax = 1 - tx * tx;
				ay = -ty * tx;
				az = -tz * tx;
				l = Math.hypot(ax, ay, az) || 1;
			}
			this.snx[0] = ax / l;
			this.sny[0] = ay / l;
			this.snz[0] = az / l;
			i0 = 1;
		}
		for (let i = i0; i < n; i++) {
			const a = [
				this.stx[i - 1],
				this.sty[i - 1],
				this.stz[i - 1]
			];
			const c = [
				this.stx[i],
				this.sty[i],
				this.stz[i]
			];
			let ax = a[1] * c[2] - a[2] * c[1], ay = a[2] * c[0] - a[0] * c[2], az = a[0] * c[1] - a[1] * c[0];
			const l = Math.hypot(ax, ay, az);
			if (l < 1e-9) {
				this.snx[i] = this.snx[i - 1];
				this.sny[i] = this.sny[i - 1];
				this.snz[i] = this.snz[i - 1];
				continue;
			}
			ax /= l;
			ay /= l;
			az /= l;
			const dt = Math.min(1, Math.max(-1, a[0] * c[0] + a[1] * c[1] + a[2] * c[2]));
			const ang = Math.acos(dt), cs = Math.cos(ang), sn = Math.sin(ang);
			const v = [
				this.snx[i - 1],
				this.sny[i - 1],
				this.snz[i - 1]
			];
			const dd = (1 - cs) * (ax * v[0] + ay * v[1] + az * v[2]);
			this.snx[i] = v[0] * cs + (ay * v[2] - az * v[1]) * sn + ax * dd;
			this.sny[i] = v[1] * cs + (az * v[0] - ax * v[2]) * sn + ay * dd;
			this.snz[i] = v[2] * cs + (ax * v[1] - ay * v[0]) * sn + az * dd;
		}
	}
	/** Drop everything WHOLLY behind distance d (keeps the bracketing sample
	* so frameAt(d) still interpolates). Distances stay absolute. */
	trim(d) {
		let drop = 0;
		while (drop + 1 < this.cum.length && this.cum[drop + 1] <= d) drop++;
		if (!drop) return;
		for (const a of [
			this.sx,
			this.sy,
			this.sz,
			this.stx,
			this.sty,
			this.stz,
			this.snx,
			this.sny,
			this.snz,
			this.cum
		]) a.splice(0, drop);
	}
	locate(d) {
		const n = this.cum.length;
		const dd = Math.min(this.cum[n - 1], Math.max(this.cum[0], d));
		let lo = 0, hi = n - 1;
		while (lo + 1 < hi) {
			const mid = lo + hi >> 1;
			if (this.cum[mid] <= dd) lo = mid;
			else hi = mid;
		}
		const span = this.cum[hi] - this.cum[lo];
		return [lo, span > 1e-12 ? (dd - this.cum[lo]) / span : 0];
	}
	/** Position at ABSOLUTE distance d (clamped to [start, head]). */
	at(d) {
		if (!this.ready) throw new Error("DynamicPath3d: add at least 3 waypoints first");
		const [i, u] = this.locate(d);
		return {
			x: this.sx[i] + (this.sx[i + 1] - this.sx[i]) * u,
			y: this.sy[i] + (this.sy[i + 1] - this.sy[i]) * u,
			z: this.sz[i] + (this.sz[i + 1] - this.sz[i]) * u
		};
	}
	/** Full frame at ABSOLUTE distance d — same contract as Path3d.frame. */
	frameAt(d) {
		if (!this.ready) throw new Error("DynamicPath3d: add at least 3 waypoints first");
		const [i, u] = this.locate(d);
		const lerp = (a) => a[i] + (a[i + 1] - a[i]) * u;
		let tx = lerp(this.stx), ty = lerp(this.sty), tz = lerp(this.stz);
		let l = Math.hypot(tx, ty, tz) || 1;
		tx /= l;
		ty /= l;
		tz /= l;
		let nx = lerp(this.snx), ny = lerp(this.sny), nz = lerp(this.snz);
		const dot = nx * tx + ny * ty + nz * tz;
		nx -= tx * dot;
		ny -= ty * dot;
		nz -= tz * dot;
		l = Math.hypot(nx, ny, nz) || 1;
		nx /= l;
		ny /= l;
		nz /= l;
		return {
			x: lerp(this.sx),
			y: lerp(this.sy),
			z: lerp(this.sz),
			tx,
			ty,
			tz,
			nx,
			ny,
			nz,
			bx: ty * nz - tz * ny,
			by: tz * nx - tx * nz,
			bz: tx * ny - ty * nx
		};
	}
	/** n points between two absolute distances — draw the plotted route. */
	pointsBetween(d0, d1, n) {
		const out = [];
		const m = Math.max(2, Math.floor(n));
		for (let i = 0; i < m; i++) {
			const p = this.at(d0 + (d1 - d0) * i / (m - 1));
			out.push([
				p.x,
				p.y,
				p.z
			]);
		}
		return out;
	}
};
//#endregion
export { loadText as $, sphereVsFrustum as A, clearAssetCaches as B, mat4Perspective as C, rayObbLocal as D, rayObb as E, forward as F, isFontUsable as G, getImage as H, lookAtEuler as I, isTextCached as J, isImageCached as K, quatMul as L, viewBasis as M, composeChain as N, rayPlaneY as O, eulerToQuat as P, loadJson as Q, quatRotate as R, mat4Ortho as S, rayFromNdc as T, isBinaryCached as U, fontsSettled as V, isFontCached as W, loadFont as X, loadBinary as Y, loadImage as Z, trsToMat4 as _, mulberry32 as a, TrailEmitter as at, mat4LookAt as b, noisePerm as c, VfxSystem as ct, composeWorlds as d, markModelLoaded as et, decomposeTRS as f, sampleChannel as g, quatSlerp as h, fbm2 as i, resolveRamp as it, vec3 as j, raySphere as k, perlin2 as l, registerVfx as lt, mat4MulTo as m, Path3d as n, Particles as nt, noiseCanvas as o, VFX as ot, jointPalette as p, isModelCached as q, catmullRom3 as r, RAMPS as rt, noiseData as s, VFX_PACK as st, DynamicPath3d as t, registerCacheClearer as tt, AnimMixer as u, resolveVfx as ut, frustumPlanes as v, mat4Project as w, mat4Mul as x, mat4Inverse as y, quatToEuler as z };

//# sourceMappingURL=shared-DjLuB-Ve.js.map
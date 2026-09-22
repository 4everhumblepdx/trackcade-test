import { n as rgba, r as DEPTH_FORMAT$1, s as BITS, u as shaderModule } from "./shared-DhV4JtEZ.js";
import { $ as loadText, P as eulerToQuat, R as quatRotate, Y as loadBinary, Z as loadImage, a as mulberry32$1, c as noisePerm, et as markModelLoaded, f as decomposeTRS, i as fbm2, it as resolveRamp, l as perlin2, m as mat4MulTo, n as Path3d, p as jointPalette, tt as registerCacheClearer, u as AnimMixer, y as mat4Inverse } from "./shared-DjLuB-Ve.js";
//#region src/lib/orbit3d.ts
/** Scale camera + target about a fixed world point (the zoom-to-cursor core:
* pure, testable). Returns the new target; the camera derives from it. */
function scaleAboutPoint(target, c, k) {
	return {
		x: c.x + (target.x - c.x) * k,
		y: c.y + (target.y - c.y) * k,
		z: c.z + (target.z - c.z) * k
	};
}
var OrbitRig = class {
	yaw;
	pitch;
	dist;
	target;
	enabled = true;
	/** Idle spin in radians/sec — pauses while dragging or flying. Live-mutable. */
	autoRotate;
	/** Ground clamp (see OrbitOptions.floor). Live-mutable; null = off. */
	floor;
	floorMargin;
	/** WASD/arrow + Q/E flying. Live-mutable so a demo can flip a follow
	* camera into a free-fly probe cam without rebuilding the rig. */
	fly;
	/** The live object being followed (see follow()), or null. */
	followObj = null;
	followOffset = {
		x: 0,
		y: 0,
		z: 0
	};
	followEase = 0;
	world;
	canvas;
	o;
	/** Sticky explore flag: set by the first fly movement. While set, a
	* rotate-drag turns the view about the CAMERA (look-around) instead of
	* swinging the camera about the pivot. */
	look = false;
	mode = "none";
	lastX = 0;
	lastY = 0;
	keys = /* @__PURE__ */ new Set();
	un = [];
	constructor(world, canvas, opts = {}) {
		this.world = world;
		this.canvas = canvas;
		this.yaw = opts.yaw ?? .5;
		this.pitch = opts.pitch ?? .4;
		this.dist = opts.dist ?? 25;
		this.target = opts.target ? { ...opts.target } : {
			x: 0,
			y: 0,
			z: 0
		};
		this.autoRotate = opts.autoRotate ?? 0;
		this.floor = opts.floor ?? null;
		this.floorMargin = opts.floorMargin ?? 1.5;
		this.fly = opts.fly ?? false;
		this.o = {
			minDist: opts.minDist ?? 1,
			maxDist: opts.maxDist ?? 500,
			minPitch: opts.minPitch ?? -1.45,
			maxPitch: opts.maxPitch ?? 1.45,
			zoomToCursor: opts.zoomToCursor ?? true,
			pan: opts.pan ?? true,
			rotateSpeed: opts.rotateSpeed ?? 1,
			zoomSpeed: opts.zoomSpeed ?? 1,
			flySpeed: opts.flySpeed
		};
		this.wire();
		this.apply();
	}
	/** Camera-frame basis from the current angles (right, up, forward). */
	basis() {
		const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
		const cy = Math.cos(this.yaw), sy = Math.sin(this.yaw);
		const F = [
			sy * cp,
			-sp,
			-cy * cp
		];
		const R = [
			cy,
			0,
			sy
		];
		return {
			R,
			U: [
				R[1] * F[2] - R[2] * F[1],
				R[2] * F[0] - R[0] * F[2],
				R[0] * F[1] - R[1] * F[0]
			],
			F
		};
	}
	wire() {
		const cv = this.canvas;
		const on = (el, ev, fn, o) => {
			el.addEventListener(ev, fn, o);
			this.un.push(() => el.removeEventListener(ev, fn));
		};
		on(cv, "pointerdown", (e) => {
			if (!this.enabled) return;
			this.mode = (e.button === 2 || e.shiftKey) && this.o.pan ? "pan" : e.button === 0 || e.button === 2 ? "rotate" : "none";
			this.lastX = e.clientX;
			this.lastY = e.clientY;
			cv.setPointerCapture(e.pointerId);
		});
		on(cv, "pointermove", (e) => {
			if (!this.enabled || this.mode === "none") return;
			const dx = e.clientX - this.lastX, dy = e.clientY - this.lastY;
			this.lastX = e.clientX;
			this.lastY = e.clientY;
			if (this.mode === "rotate") if (this.look) {
				const P = this.cameraPos();
				this.yaw += dx * .005 * this.o.rotateSpeed;
				this.pitch = this.clampPitch(this.pitch + dy * .004 * this.o.rotateSpeed);
				const cp = Math.cos(this.pitch);
				this.target.x = P.x + Math.sin(this.yaw) * cp * this.dist;
				this.target.y = P.y - Math.sin(this.pitch) * this.dist;
				this.target.z = P.z - Math.cos(this.yaw) * cp * this.dist;
			} else {
				this.yaw += dx * .005 * this.o.rotateSpeed;
				this.pitch = this.clampPitch(this.pitch + dy * .004 * this.o.rotateSpeed);
			}
			else {
				const { R, U } = this.basis();
				const per = 2 * this.dist * Math.tan((this.world.camera.fov ?? 60) * Math.PI / 360) / Math.max(1, cv.clientHeight);
				this.target.x -= (R[0] * dx - U[0] * dy) * per;
				this.target.y -= (R[1] * dx - U[1] * dy) * per;
				this.target.z -= (R[2] * dx - U[2] * dy) * per;
			}
		});
		const end = (e) => {
			this.mode = "none";
			if (cv.hasPointerCapture?.(e.pointerId)) cv.releasePointerCapture(e.pointerId);
		};
		on(cv, "pointerup", end);
		on(cv, "pointercancel", end);
		on(cv, "contextmenu", (e) => {
			if (this.o.pan) e.preventDefault();
		});
		on(cv, "wheel", (e) => {
			if (!this.enabled) return;
			e.preventDefault();
			const k = Math.exp(e.deltaY * .0012 * this.o.zoomSpeed);
			const next = Math.min(this.o.maxDist, Math.max(this.o.minDist, this.dist * k));
			const real = next / this.dist;
			if (this.o.zoomToCursor && Math.abs(1 - real) > 1e-6) {
				const c = this.cursorPivot(e);
				if (c) this.target = scaleAboutPoint(this.target, c, real);
			}
			this.dist = next;
		}, { passive: false });
		on(window, "keydown", (e) => {
			if (!this.fly || !this.enabled) return;
			const t = e.target;
			if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT")) return;
			this.keys.add(e.code);
		});
		on(window, "keyup", (e) => this.keys.delete(e.code));
		on(window, "blur", () => this.keys.clear());
	}
	/** World point under the cursor on the plane through the target ⊥ view —
	* the fixed point wheel zoom scales about. Null when the ray grazes. */
	cursorPivot(e) {
		const { R, U, F } = this.basis();
		const rect = this.canvas.getBoundingClientRect();
		const ndcX = (e.clientX - rect.left) / Math.max(1, rect.width) * 2 - 1;
		const ndcY = 1 - (e.clientY - rect.top) / Math.max(1, rect.height) * 2;
		const tf = Math.tan((this.world.camera.fov ?? 60) * Math.PI / 360);
		const aspect = rect.width / Math.max(1, rect.height);
		const D = [
			F[0] + (R[0] * ndcX * aspect + U[0] * ndcY) * tf,
			F[1] + (R[1] * ndcX * aspect + U[1] * ndcY) * tf,
			F[2] + (R[2] * ndcX * aspect + U[2] * ndcY) * tf
		];
		const dDotF = D[0] * F[0] + D[1] * F[1] + D[2] * F[2];
		if (dDotF < .05) return null;
		const P = this.cameraPos();
		const s = this.dist / dDotF;
		return {
			x: P.x + D[0] * s,
			y: P.y + D[1] * s,
			z: P.z + D[2] * s
		};
	}
	cameraPos() {
		const cp = Math.cos(this.pitch);
		return {
			x: this.target.x - Math.sin(this.yaw) * cp * this.dist,
			y: this.target.y + Math.sin(this.pitch) * this.dist,
			z: this.target.z + Math.cos(this.yaw) * cp * this.dist
		};
	}
	clampPitch(p) {
		return Math.max(this.o.minPitch, Math.min(this.o.maxPitch, p));
	}
	/**
	* FOLLOW a live moving object — pass the handle itself (a mesh, group,
	* or any `{x, y, z}`), NOT a snapshot of its position. The rig re-reads
	* it every frame at TICK time, which the engine runs AFTER your game
	* callback — so whatever your callback did last (a TerrainRider settling
	* the object's `y`, a physics step, a parent transform) is already
	* applied, and the camera can NEVER lag a frame behind it.
	*
	* This is the whole point: `rig.target.y = thing.y` copied INSIDE the
	* callback captures a stale value if anything updates `thing` afterwards
	* — a footgun that reads as the followed object "jittering" under any
	* acceleration. `follow()` removes the ordering from your hands.
	*
	*   rig.follow(player, { offset: { y: 2 } });   // chase the player
	*   rig.follow(null);                            // release (free look)
	*
	* `offset` is added to the object; `ease` (per-second) lags the pivot
	* for a soft chase (default 0 = locked to the object). Yaw/pitch/dist
	* stay yours to set (a chase demo eases `rig.yaw` toward the heading).
	*/
	follow(obj, opts) {
		this.followObj = obj;
		this.followOffset = {
			x: opts?.offset?.x ?? 0,
			y: opts?.offset?.y ?? 0,
			z: opts?.offset?.z ?? 0
		};
		this.followEase = opts?.ease ?? 0;
		if (obj && this.followEase <= 0) {
			this.target.x = obj.x + this.followOffset.x;
			this.target.y = obj.y + this.followOffset.y;
			this.target.z = obj.z + this.followOffset.z;
		}
	}
	/** Per-frame: fly keys, then write the world camera. The game calls this. */
	update(dt) {
		if (!this.enabled) return;
		if (this.followObj) {
			const o = this.followObj, off = this.followOffset;
			const tx = o.x + off.x, ty = o.y + off.y, tz = o.z + off.z;
			if (this.followEase > 0) {
				const k = 1 - Math.exp(-dt * this.followEase);
				this.target.x += (tx - this.target.x) * k;
				this.target.y += (ty - this.target.y) * k;
				this.target.z += (tz - this.target.z) * k;
			} else {
				this.target.x = tx;
				this.target.y = ty;
				this.target.z = tz;
			}
		}
		if (this.autoRotate && this.mode === "none" && !this.keys.size && !this.look) this.yaw += this.autoRotate * dt;
		if (this.fly && this.keys.size) {
			const k = this.keys;
			const ax = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0);
			const az = (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) - (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0);
			const ay = (k.has("KeyE") ? 1 : 0) - (k.has("KeyQ") ? 1 : 0);
			if (ax || ay || az) {
				this.look = true;
				const { R, F } = this.basis();
				const gl = Math.hypot(F[0], F[2]) || 1;
				const fx = F[0] / gl, fz = F[2] / gl;
				const speed = (this.o.flySpeed ?? this.dist * .6) * (k.has("ShiftLeft") || k.has("ShiftRight") ? 3 : 1) * dt;
				this.target.x += (fx * az + R[0] * ax) * speed;
				this.target.z += (fz * az + R[2] * ax) * speed;
				this.target.y += ay * speed;
			}
		}
		this.apply();
	}
	apply() {
		const cam = this.world.camera;
		const p = this.cameraPos();
		if (this.floor) {
			const fy = this.floor(p.x, p.z) + this.floorMargin;
			if (p.y < fy) p.y = fy;
		}
		cam.x = p.x;
		cam.y = p.y;
		cam.z = p.z;
		cam.tx = this.target.x;
		cam.ty = this.target.y;
		cam.tz = this.target.z;
	}
	/** Unwire every listener (the rig keeps its last camera pose). */
	detach() {
		for (const fn of this.un) fn();
		this.un.length = 0;
		this.keys.clear();
	}
};
//#endregion
//#region src/lib/particles3d.ts
/** The per-instance quad the renderer packs. mode: 0 soft disc, 1 atlas
* frame, 2 ring (p = stroke thickness as a fraction of the radius). */
/**
* Area-weighted sampling over a stride-8 triangle soup — the MESH-SURFACE
* emitter shape. Build once per geometry (the CDF is baked); sample() picks
* a triangle proportionally to its area and a uniform barycentric point on
* it, returning position AND face normal (particles can launch along it).
* Pure — dist-tested.
*/
var SurfaceSampler = class {
	cdf;
	verts;
	constructor(verts) {
		this.verts = verts;
		const tris = Math.floor(verts.length / 24);
		this.cdf = new Float64Array(tris);
		let acc = 0;
		for (let t = 0; t < tris; t++) {
			const o = t * 24;
			const ux = verts[o + 8] - verts[o], uy = verts[o + 9] - verts[o + 1], uz = verts[o + 10] - verts[o + 2];
			const vx = verts[o + 16] - verts[o], vy = verts[o + 17] - verts[o + 1], vz = verts[o + 18] - verts[o + 2];
			const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
			acc += Math.hypot(cx, cy, cz) * .5;
			this.cdf[t] = acc;
		}
	}
	/** r1..r3 are uniform randoms 0..1 (pass your seeded rng's outputs). */
	sample(r1, r2, r3) {
		const target = r1 * (this.cdf[this.cdf.length - 1] || 1);
		let lo = 0, hi = this.cdf.length - 1;
		while (lo < hi) {
			const mid = lo + hi >> 1;
			if (this.cdf[mid] < target) lo = mid + 1;
			else hi = mid;
		}
		const o = lo * 24, v = this.verts;
		const su = Math.sqrt(r2);
		const b0 = 1 - su, b1 = su * (1 - r3), b2 = su * r3;
		const px = v[o] * b0 + v[o + 8] * b1 + v[o + 16] * b2;
		const py = v[o + 1] * b0 + v[o + 9] * b1 + v[o + 17] * b2;
		const pz = v[o + 2] * b0 + v[o + 10] * b1 + v[o + 18] * b2;
		const ux = v[o + 8] - v[o], uy = v[o + 9] - v[o + 1], uz = v[o + 10] - v[o + 2];
		const wx = v[o + 16] - v[o], wy = v[o + 17] - v[o + 1], wz = v[o + 18] - v[o + 2];
		let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
		const l = Math.hypot(nx, ny, nz) || 1;
		return {
			x: px,
			y: py,
			z: pz,
			nx: nx / l,
			ny: ny / l,
			nz: nz / l
		};
	}
};
var Particles3d = class {
	rng;
	pool = [];
	alive = 0;
	clock = 0;
	bursts = [];
	/** Pass a seeded rng (e.g. mulberry32) for deterministic headless tests. */
	constructor(rng = Math.random) {
		this.rng = rng;
	}
	/** Live particle count (bursts' rings/flashes not included). */
	get count() {
		return this.alive;
	}
	/** Spawn a burst of particles. Call once for an explosion, every frame for a stream. */
	emit(opts) {
		const rng = this.rng;
		const count = opts.count ?? 12;
		const speed = opts.speed ?? 3;
		const speedVar = opts.speedVar ?? speed * .4;
		const spread = opts.spread ?? Math.PI * 2;
		const spawnR = opts.spawnRadius ?? 0;
		const life = opts.life ?? .7;
		const lifeVar = opts.lifeVar ?? .3;
		const size = opts.size ?? .12;
		const sizeVar = opts.sizeVar ?? .05;
		const alpha = opts.alpha ?? 1;
		const ramp = opts.ramp ? resolveRamp(opts.ramp) : null;
		const palette = opts.colors ?? [opts.color ?? "#ffffff"];
		const endSize = typeof opts.shrink === "number" ? Math.max(0, opts.shrink) : opts.shrink ?? true ? 0 : 1;
		const d = opts.dir;
		let ax = 0, ay = 1, az = 0;
		let bx = 1, by = 0, bz = 0, cx = 0, cy = 0, cz = 1;
		const directional = !!d && spread < Math.PI * 2 - 1e-6;
		if (directional) {
			const dl = Math.hypot(d.x ?? 0, d.y ?? 0, d.z ?? 0) || 1;
			ax = (d.x ?? 0) / dl;
			ay = (d.y ?? 0) / dl;
			az = (d.z ?? 0) / dl;
			const ux = Math.abs(ax) < .9 ? 1 : 0;
			const uy = ux ? 0 : 1;
			bx = ay * 0 - az * uy;
			by = az * ux - ax * 0;
			bz = ax * uy - ay * ux;
			const bl = Math.hypot(bx, by, bz) || 1;
			bx /= bl;
			by /= bl;
			bz /= bl;
			cx = ay * bz - az * by;
			cy = az * bx - ax * bz;
			cz = ax * by - ay * bx;
		}
		for (let i = 0; i < count; i++) {
			const p = this.alive < this.pool.length ? this.pool[this.alive] : (this.pool.push(blank3()), this.pool[this.alive]);
			this.alive++;
			let nx, ny, nz;
			if (directional) {
				const cosT = 1 - rng() * (1 - Math.cos(spread / 2));
				const sinT = Math.sqrt(Math.max(0, 1 - cosT * cosT));
				const phi = rng() * Math.PI * 2;
				const pb = Math.cos(phi) * sinT, pc = Math.sin(phi) * sinT;
				nx = ax * cosT + bx * pb + cx * pc;
				ny = ay * cosT + by * pb + cy * pc;
				nz = az * cosT + bz * pb + cz * pc;
			} else {
				const zz = rng() * 2 - 1;
				const phi = rng() * Math.PI * 2;
				const s = Math.sqrt(Math.max(0, 1 - zz * zz));
				nx = Math.cos(phi) * s;
				ny = zz;
				nz = Math.sin(phi) * s;
			}
			const v = Math.max(0, speed + (rng() - .5) * 2 * speedVar);
			p.x = opts.x;
			p.y = opts.y;
			p.z = opts.z;
			if (opts.path) {
				const pp = opts.path.at(rng());
				p.x += pp.x;
				p.y += pp.y;
				p.z += pp.z;
			}
			if (opts.surface) {
				const sp = opts.surface.sample(rng(), rng(), rng());
				const on = opts.on;
				if (on) {
					const q = eulerToQuat(on.yaw, on.pitch, on.roll);
					const rp = quatRotate(q, sp.x * on.w, sp.y * on.h, sp.z * on.d);
					p.x += on.x + rp[0];
					p.y += on.y + rp[1];
					p.z += on.z + rp[2];
					if (!d) {
						const rn = quatRotate(q, sp.nx / on.w, sp.ny / on.h, sp.nz / on.d);
						const nl = Math.hypot(rn[0], rn[1], rn[2]) || 1;
						nx = rn[0] / nl;
						ny = rn[1] / nl;
						nz = rn[2] / nl;
					}
				} else {
					p.x += sp.x;
					p.y += sp.y;
					p.z += sp.z;
					if (!d) {
						nx = sp.nx;
						ny = sp.ny;
						nz = sp.nz;
					}
				}
			}
			if (opts.ring) {
				const ra = rng() * Math.PI * 2;
				p.x += Math.cos(ra) * opts.ring;
				p.z += Math.sin(ra) * opts.ring;
			}
			if (opts.box) {
				p.x += (rng() - .5) * (opts.box.w ?? 0);
				p.y += (rng() - .5) * (opts.box.h ?? 0);
				p.z += (rng() - .5) * (opts.box.d ?? 0);
			}
			if (spawnR > 0) {
				const zz = rng() * 2 - 1;
				const phi = rng() * Math.PI * 2;
				const s = Math.sqrt(Math.max(0, 1 - zz * zz));
				const rr = Math.cbrt(rng()) * spawnR;
				p.x += Math.cos(phi) * s * rr;
				p.y += zz * rr;
				p.z += Math.sin(phi) * s * rr;
			}
			p.vx = nx * v;
			p.vy = ny * v;
			p.vz = nz * v;
			p.age = 0;
			p.life = Math.max(.05, life + (rng() - .5) * 2 * lifeVar);
			p.size = Math.max(.005, size + (rng() - .5) * 2 * sizeVar);
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
			p.soft = opts.soft ?? 1;
			p.lit = opts.lit ?? false;
		}
	}
	/**
	* Trigger a one-shot VfxDef.burst recipe at a point — the same defs as the
	* 2D `scene.vfx.burst()` ('impact', 'shockwave', …): particle layers ride
	* this pool, rings + flashes render as camera-facing quads. The def's
	* 2D-tuned sizes/speeds are scaled by `opts.scale` (default 0.1).
	*/
	burst(def, x, y, z, opts = {}) {
		if (!def.burst?.length) return;
		const d = opts.dir;
		this.bursts.push({
			def,
			x,
			y,
			z,
			dir: d ? {
				x: d.x ?? 0,
				y: d.y ?? 0,
				z: d.z ?? 0
			} : null,
			scale: opts.scale ?? .1,
			flat: opts.flat ?? true,
			age: 0,
			fired: def.burst.map(() => false)
		});
	}
	/** Age + integrate particles, run burst recipes (world.tick calls this). */
	/**
	* A CONTINUOUS emitter — the ONLY correct way to run a steady effect
	* (fire, smoke, drips, auras). `rate` is particles per SECOND, wall
	* clock: the engine owns the accumulator, so the alive count is
	* rate × life at ANY refresh rate — per-frame emit() loops double on a
	* 120 Hz display (never do that; emit() is for one-shot BURSTS).
	* Every option is live: mutate handle.rate, handle.x/y/z, handle.on…
	* kill() stops it (existing particles age out naturally).
	*/
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
	update(dt) {
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
		this.updateSim(dt);
	}
	updateSim(dt) {
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
			p.vz *= damp;
			p.vy = p.vy * damp - p.gravity * dt;
			if (p.sway) {
				const w = this.clock * p.swayFreq + p.seed;
				p.vx += Math.cos(w) * p.sway * dt;
				p.vz += Math.sin(w * 1.3) * p.sway * dt;
			}
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.z += p.vz * dt;
			p.rot += p.spin * dt;
		}
		for (let i = this.bursts.length - 1; i >= 0; i--) {
			const b = this.bursts[i];
			b.age += dt;
			let done = true;
			b.def.burst.forEach((layer, li) => {
				const delay = layer.delay ?? 0;
				if (!b.fired[li] && b.age >= delay) {
					b.fired[li] = true;
					if (layer.emit) {
						const e = layer.emit;
						const s = b.scale;
						this.emit({
							x: b.x,
							y: b.y,
							z: b.z,
							count: e.count,
							speed: (e.speed ?? 90) * s,
							speedVar: (e.speedVar ?? 40) * s,
							dir: b.dir ?? void 0,
							spread: e.spread,
							spawnRadius: e.spawnRadius != null ? e.spawnRadius * s : void 0,
							life: e.life,
							lifeVar: e.lifeVar,
							size: (e.size ?? 4) * s,
							sizeVar: (e.sizeVar ?? 2) * s,
							shrink: e.shrink,
							fade: e.fade,
							gravity: e.gravity != null ? e.gravity * s : void 0,
							drag: e.drag,
							sway: e.sway != null ? e.sway * s : void 0,
							swayFreq: e.swayFreq,
							color: e.color,
							colors: e.colors,
							ramp: e.ramp,
							alpha: e.alpha,
							twinkle: e.twinkle,
							add: e.add,
							frame: e.frame,
							spin: e.spin,
							soft: e.soft
						});
					}
				}
				const t = layer.ring?.time ?? layer.flash?.time ?? 0;
				if (b.age < delay + t) done = false;
				if (!b.fired[li]) done = false;
			});
			if (done) this.bursts.splice(i, 1);
		}
	}
	/** Push every live particle + burst ring/flash quad to the writer.
	* Returns the instance count. (The renderer owns the buffer format.) */
	pack(write) {
		let n = 0;
		for (let i = 0; i < this.alive; i++) {
			const p = this.pool[i];
			const t = p.age / p.life;
			let alpha = p.fade ? p.a * (1 - t) : p.a;
			if (p.twinkle > 0) alpha *= 1 - p.twinkle * (.5 + .5 * Math.sin(this.clock * 11 + p.seed * 7));
			const size = p.size * (1 - (1 - p.endSize) * t);
			if (alpha <= .004 || size <= .002) continue;
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
			write(p.x, p.y, p.z, size, p.rot, p.frame >= 0 ? 1 : 0, r, g, b, alpha, p.add, p.frame, p.soft, p.lit);
			n++;
		}
		for (const b of this.bursts) b.def.burst.forEach((layer, li) => {
			const delay = layer.delay ?? 0;
			const local = b.age - delay;
			if (local < 0 || !b.fired[li]) return;
			if (layer.ring) {
				const rr = layer.ring;
				const k = Math.min(1, local / rr.time);
				if (k < 1) {
					const from = (rr.from ?? 6) * b.scale;
					const radius = from + (rr.to * b.scale - from) * k;
					const c = rgba(rr.color ?? "#ffffff");
					const thick = Math.min(1, Math.max(.02, (rr.width ?? 3) * b.scale * (1 - k * .6) / Math.max(.001, radius)));
					write(b.x, b.y, b.z, radius, 0, b.flat ? 3 : 2, c[0], c[1], c[2], (1 - k) * (rr.add ? 1 : .8) * c[3], !!rr.add, -1, thick);
					n++;
				}
			}
			if (layer.flash) {
				const f = layer.flash;
				const k = Math.min(1, local / f.time);
				if (k < 1) {
					const c = rgba(f.color ?? "#ffffff");
					write(b.x, b.y, b.z, f.radius * b.scale * (.6 + .4 * k), 0, 0, c[0], c[1], c[2], (1 - k) * .9 * c[3], true, -1, 1);
					n++;
				}
			}
		});
		return n;
	}
	/** Kill everything (world teardown / scene change). */
	clear() {
		this.alive = 0;
		this.bursts = [];
	}
};
function blank3() {
	return {
		x: 0,
		y: 0,
		z: 0,
		vx: 0,
		vy: 0,
		vz: 0,
		age: 0,
		life: 1,
		size: .1,
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
		soft: 1,
		lit: false
	};
}
//#endregion
//#region src/lib/obj.ts
/** Parse a .mtl file into materials by name. */
function parseMtl(text) {
	const materials = {};
	let current = null;
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (line === "" || line.startsWith("#")) continue;
		const parts = line.split(/\s+/);
		const key = parts[0];
		if (key === "newmtl") {
			current = {
				name: parts.slice(1).join(" "),
				color: [
					.7,
					.7,
					.7
				],
				opacity: 1
			};
			materials[current.name] = current;
			continue;
		}
		if (!current) continue;
		switch (key) {
			case "Kd":
				current.color = [
					Number(parts[1]),
					Number(parts[2]),
					Number(parts[3])
				];
				break;
			case "map_Kd":
				current.map = parts.slice(1).join(" ");
				break;
			case "Ns":
				current.ns = Number(parts[1]);
				break;
			case "d":
				current.opacity = Number(parts[1]);
				break;
			case "Tr":
				current.opacity = 1 - Number(parts[1]);
				break;
			case "Ke":
				current.emissive = [
					Number(parts[1]),
					Number(parts[2]),
					Number(parts[3])
				];
				break;
		}
	}
	return materials;
}
/** Parse a .obj file into per-material triangle soups. */
function parseObj(text) {
	const positions = [];
	const uvs = [];
	const normals = [];
	const groupOrder = [];
	const groupVerts = /* @__PURE__ */ new Map();
	let currentVerts = null;
	let currentMaterial = null;
	let mtllib = null;
	const min = [
		Infinity,
		Infinity,
		Infinity
	];
	const max = [
		-Infinity,
		-Infinity,
		-Infinity
	];
	const fp = [];
	const ft = [];
	const fn = [];
	for (const raw of text.split("\n")) {
		const line = raw.trim();
		if (line === "" || line.startsWith("#")) continue;
		const parts = line.split(/\s+/);
		const key = parts[0];
		if (key === "v") {
			const x = Number(parts[1]);
			const y = Number(parts[2]);
			const z = Number(parts[3]);
			positions.push(x, y, z);
			if (x < min[0]) min[0] = x;
			if (x > max[0]) max[0] = x;
			if (y < min[1]) min[1] = y;
			if (y > max[1]) max[1] = y;
			if (z < min[2]) min[2] = z;
			if (z > max[2]) max[2] = z;
			continue;
		}
		if (key === "vt") {
			uvs.push(Number(parts[1]), 1 - Number(parts[2]));
			continue;
		}
		if (key === "vn") {
			normals.push(Number(parts[1]), Number(parts[2]), Number(parts[3]));
			continue;
		}
		if (key === "usemtl") {
			currentMaterial = parts.slice(1).join(" ");
			currentVerts = null;
			continue;
		}
		if (key === "mtllib") {
			mtllib = parts.slice(1).join(" ");
			continue;
		}
		if (key !== "f") continue;
		const n = parts.length - 1;
		fp.length = 0;
		ft.length = 0;
		fn.length = 0;
		for (let i = 1; i <= n; i++) {
			const ref = parts[i].split("/");
			const vi = Number(ref[0]);
			fp.push(vi < 0 ? positions.length / 3 + vi : vi - 1);
			const ti = ref.length > 1 && ref[1] !== "" ? Number(ref[1]) : 0;
			ft.push(ti === 0 ? -1 : ti < 0 ? uvs.length / 2 + ti : ti - 1);
			const ni = ref.length > 2 && ref[2] !== "" ? Number(ref[2]) : 0;
			fn.push(ni === 0 ? -1 : ni < 0 ? normals.length / 3 + ni : ni - 1);
		}
		if (n < 3) continue;
		if (!currentVerts) {
			currentVerts = groupVerts.get(currentMaterial) ?? null;
			if (!currentVerts) {
				currentVerts = [];
				groupVerts.set(currentMaterial, currentVerts);
				groupOrder.push(currentMaterial);
			}
		}
		const out = currentVerts;
		for (let i = 1; i < n - 1; i++) {
			const tri = [
				0,
				i,
				i + 1
			];
			let fx = 0, fy = 1, fz = 0;
			if (fn[tri[0]] < 0 || fn[tri[1]] < 0 || fn[tri[2]] < 0) {
				const a = fp[tri[0]] * 3, b = fp[tri[1]] * 3, c = fp[tri[2]] * 3;
				const e1x = positions[b] - positions[a];
				const e1y = positions[b + 1] - positions[a + 1];
				const e1z = positions[b + 2] - positions[a + 2];
				const e2x = positions[c] - positions[a];
				const e2y = positions[c + 1] - positions[a + 1];
				const e2z = positions[c + 2] - positions[a + 2];
				const cx = e1y * e2z - e1z * e2y;
				const cy = e1z * e2x - e1x * e2z;
				const cz = e1x * e2y - e1y * e2x;
				const len = Math.hypot(cx, cy, cz);
				if (len > 1e-12) {
					fx = cx / len;
					fy = cy / len;
					fz = cz / len;
				}
			}
			for (const k of tri) {
				const p = fp[k] * 3;
				out.push(positions[p], positions[p + 1], positions[p + 2]);
				const nn = fn[k];
				if (nn < 0) out.push(fx, fy, fz);
				else {
					const o = nn * 3;
					out.push(normals[o], normals[o + 1], normals[o + 2]);
				}
				const t = ft[k];
				if (t < 0) out.push(0, 0);
				else out.push(uvs[t * 2], uvs[t * 2 + 1]);
			}
		}
	}
	const groups = [];
	for (const name of groupOrder) {
		const verts = groupVerts.get(name);
		if (verts && verts.length > 0) groups.push({
			material: name,
			verts: Float32Array.from(verts)
		});
	}
	if (positions.length === 0) {
		min[0] = min[1] = min[2] = 0;
		max[0] = max[1] = max[2] = 0;
	}
	return {
		groups,
		mtllib,
		bounds: {
			min,
			max
		}
	};
}
//#endregion
//#region src/lib/glb.ts
var GLB_MAGIC = 1179937895;
var CHUNK_JSON = 1313821514;
var CHUNK_BIN = 5130562;
function readChunks(buffer) {
	if (buffer.byteLength < 12) throw new Error(`GLB: truncated header — ${buffer.byteLength} bytes, need at least 12`);
	const head = new DataView(buffer);
	const magic = head.getUint32(0, true);
	if (magic !== GLB_MAGIC) throw new Error(`GLB: bad magic 0x${magic.toString(16)} — expected 0x46546c67 ('glTF')`);
	const version = head.getUint32(4, true);
	if (version !== 2) throw new Error(`GLB: unsupported version ${version} — only glTF 2.0 binary is supported`);
	const total = Math.min(head.getUint32(8, true), buffer.byteLength);
	let json = null;
	let bin = null;
	let binView = null;
	let offset = 12;
	while (offset + 8 <= total) {
		const chunkLen = head.getUint32(offset, true);
		const chunkType = head.getUint32(offset + 4, true);
		const dataStart = offset + 8;
		if (dataStart + chunkLen > buffer.byteLength) throw new Error("GLB: chunk overruns file — declared length exceeds buffer");
		if (chunkType === CHUNK_JSON && json === null) {
			const text = new TextDecoder().decode(new Uint8Array(buffer, dataStart, chunkLen));
			json = JSON.parse(text);
		} else if (chunkType === CHUNK_BIN && bin === null) {
			bin = new Uint8Array(buffer, dataStart, chunkLen);
			binView = new DataView(buffer, dataStart, chunkLen);
		}
		offset = dataStart + chunkLen;
	}
	if (json === null) throw new Error("GLB: missing JSON chunk (0x4E4F534A)");
	if (bin === null) {
		bin = /* @__PURE__ */ new Uint8Array(0);
		binView = /* @__PURE__ */ new DataView(/* @__PURE__ */ new ArrayBuffer(0));
	}
	return {
		json,
		bin,
		binView
	};
}
var F32 = 5126;
var U32 = 5125;
var U16 = 5123;
var COMPONENT_BYTES = {
	[5121]: 1,
	[U16]: 2,
	[U32]: 4,
	[F32]: 4
};
var TYPE_COMPONENTS = {
	SCALAR: 1,
	VEC2: 2,
	VEC3: 3,
	VEC4: 4,
	MAT4: 16
};
/** Read accessor `index` as flat floats (count × components). */
function readAccessorF32(doc, binView, index) {
	const acc = doc.accessors?.[index];
	if (!acc) throw new Error(`GLB: accessor ${index} missing`);
	const comps = TYPE_COMPONENTS[acc.type];
	if (!comps) throw new Error(`GLB: accessor ${index} has unsupported type '${acc.type}'`);
	const compBytes = COMPONENT_BYTES[acc.componentType];
	if (!compBytes) throw new Error(`GLB: accessor ${index} has unsupported componentType ${acc.componentType}`);
	const out = new Float32Array(acc.count * comps);
	if (acc.bufferView === void 0) return out;
	const bv = doc.bufferViews?.[acc.bufferView];
	if (!bv) throw new Error(`GLB: bufferView ${acc.bufferView} missing`);
	if (binView.byteLength === 0) throw new Error("GLB: accessor references the BIN chunk but the file has none");
	const stride = bv.byteStride ?? comps * compBytes;
	const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
	const type = acc.componentType;
	const normalized = acc.normalized === true;
	for (let i = 0; i < acc.count; i++) {
		const row = base + i * stride;
		for (let c = 0; c < comps; c++) {
			const at = row + c * compBytes;
			let v;
			if (type === F32) v = binView.getFloat32(at, true);
			else if (type === U32) v = binView.getUint32(at, true);
			else if (type === U16) v = normalized ? binView.getUint16(at, true) / 65535 : binView.getUint16(at, true);
			else v = normalized ? binView.getUint8(at) / 255 : binView.getUint8(at);
			out[i * comps + c] = v;
		}
	}
	return out;
}
/** Read a SCALAR index accessor as u32s. */
function readIndices(doc, binView, index) {
	const acc = doc.accessors?.[index];
	if (!acc) throw new Error(`GLB: index accessor ${index} missing`);
	const compBytes = COMPONENT_BYTES[acc.componentType];
	if (!compBytes || acc.componentType === F32) throw new Error(`GLB: index accessor ${index} has unsupported componentType ${acc.componentType}`);
	const out = new Uint32Array(acc.count);
	if (acc.bufferView === void 0) return out;
	const bv = doc.bufferViews?.[acc.bufferView];
	if (!bv) throw new Error(`GLB: bufferView ${acc.bufferView} missing`);
	const stride = bv.byteStride ?? compBytes;
	const base = (bv.byteOffset ?? 0) + (acc.byteOffset ?? 0);
	const type = acc.componentType;
	for (let i = 0; i < acc.count; i++) {
		const at = base + i * stride;
		out[i] = type === U32 ? binView.getUint32(at, true) : type === U16 ? binView.getUint16(at, true) : binView.getUint8(at);
	}
	return out;
}
function mat4Identity() {
	const m = /* @__PURE__ */ new Float32Array(16);
	m[0] = m[5] = m[10] = m[15] = 1;
	return m;
}
/** out = a · b (column-major). */
function mat4Multiply(a, b) {
	const out = /* @__PURE__ */ new Float32Array(16);
	for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
	return out;
}
/** Compose T·R·S from glTF node fields (quaternion is [x,y,z,w]). */
function mat4FromTrs(t, r, s) {
	const [tx, ty, tz] = t ?? [
		0,
		0,
		0
	];
	const [qx, qy, qz, qw] = r ?? [
		0,
		0,
		0,
		1
	];
	const [sx, sy, sz] = s ?? [
		1,
		1,
		1
	];
	const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
	const xx = qx * x2, xy = qx * y2, xz = qx * z2;
	const yy = qy * y2, yz = qy * z2, zz = qz * z2;
	const wx = qw * x2, wy = qw * y2, wz = qw * z2;
	const m = /* @__PURE__ */ new Float32Array(16);
	m[0] = (1 - (yy + zz)) * sx;
	m[1] = (xy + wz) * sx;
	m[2] = (xz - wy) * sx;
	m[4] = (xy - wz) * sy;
	m[5] = (1 - (xx + zz)) * sy;
	m[6] = (yz + wx) * sy;
	m[8] = (xz + wy) * sz;
	m[9] = (yz - wx) * sz;
	m[10] = (1 - (xx + yy)) * sz;
	m[12] = tx;
	m[13] = ty;
	m[14] = tz;
	m[15] = 1;
	return m;
}
/** Inverse-transpose of the upper 3×3, returned ROW-major (9 floats) so that
* n'ᵣ = Σ N[r*3+c]·n_c. Falls back to the raw upper 3×3 if degenerate. */
function normalMatrix(m) {
	const a00 = m[0], a10 = m[1], a20 = m[2];
	const a01 = m[4], a11 = m[5], a21 = m[6];
	const a02 = m[8], a12 = m[9], a22 = m[10];
	const c00 = a11 * a22 - a12 * a21;
	const c01 = -(a10 * a22 - a12 * a20);
	const c02 = a10 * a21 - a11 * a20;
	const c10 = -(a01 * a22 - a02 * a21);
	const c11 = a00 * a22 - a02 * a20;
	const c12 = -(a00 * a21 - a01 * a20);
	const c20 = a01 * a12 - a02 * a11;
	const c21 = -(a00 * a12 - a02 * a10);
	const c22 = a00 * a11 - a01 * a10;
	const det = a00 * c00 + a01 * c01 + a02 * c02;
	const out = /* @__PURE__ */ new Float32Array(9);
	if (Math.abs(det) < 1e-12) {
		out[0] = a00;
		out[1] = a01;
		out[2] = a02;
		out[3] = a10;
		out[4] = a11;
		out[5] = a12;
		out[6] = a20;
		out[7] = a21;
		out[8] = a22;
		return out;
	}
	const inv = 1 / det;
	out[0] = c00 * inv;
	out[1] = c01 * inv;
	out[2] = c02 * inv;
	out[3] = c10 * inv;
	out[4] = c11 * inv;
	out[5] = c12 * inv;
	out[6] = c20 * inv;
	out[7] = c21 * inv;
	out[8] = c22 * inv;
	return out;
}
/** Decompose a column-major TRS matrix into t / quaternion / s. glTF forbids
* skew in node matrices, so this is exact for any legal file. A mirrored
* matrix (negative determinant) folds the flip into sx. */
function decomposeTrs(m) {
	const t = [
		m[12],
		m[13],
		m[14]
	];
	let sx = Math.hypot(m[0], m[1], m[2]);
	const sy = Math.hypot(m[4], m[5], m[6]);
	const sz = Math.hypot(m[8], m[9], m[10]);
	if (m[0] * (m[5] * m[10] - m[6] * m[9]) - m[4] * (m[1] * m[10] - m[2] * m[9]) + m[8] * (m[1] * m[6] - m[2] * m[5]) < 0) sx = -sx;
	const ix = sx !== 0 ? 1 / sx : 0;
	const iy = sy !== 0 ? 1 / sy : 0;
	const iz = sz !== 0 ? 1 / sz : 0;
	const r00 = m[0] * ix, r10 = m[1] * ix, r20 = m[2] * ix;
	const r01 = m[4] * iy, r11 = m[5] * iy, r21 = m[6] * iy;
	const r02 = m[8] * iz, r12 = m[9] * iz, r22 = m[10] * iz;
	let qx, qy, qz, qw;
	const trace = r00 + r11 + r22;
	if (trace > 0) {
		const s = Math.sqrt(trace + 1) * 2;
		qw = .25 * s;
		qx = (r21 - r12) / s;
		qy = (r02 - r20) / s;
		qz = (r10 - r01) / s;
	} else if (r00 > r11 && r00 > r22) {
		const s = Math.sqrt(1 + r00 - r11 - r22) * 2;
		qw = (r21 - r12) / s;
		qx = .25 * s;
		qy = (r01 + r10) / s;
		qz = (r02 + r20) / s;
	} else if (r11 > r22) {
		const s = Math.sqrt(1 + r11 - r00 - r22) * 2;
		qw = (r02 - r20) / s;
		qx = (r01 + r10) / s;
		qy = .25 * s;
		qz = (r12 + r21) / s;
	} else {
		const s = Math.sqrt(1 + r22 - r00 - r11) * 2;
		qw = (r10 - r01) / s;
		qx = (r02 + r20) / s;
		qy = (r12 + r21) / s;
		qz = .25 * s;
	}
	return {
		t,
		r: [
			qx,
			qy,
			qz,
			qw
		],
		s: [
			sx,
			sy,
			sz
		]
	};
}
function parseNodes(nodes) {
	const parents = new Int32Array(nodes.length).fill(-1);
	for (let i = 0; i < nodes.length; i++) {
		const children = nodes[i].children;
		if (children) for (let c = 0; c < children.length; c++) parents[children[c]] = i;
	}
	const out = [];
	for (let i = 0; i < nodes.length; i++) {
		const node = nodes[i];
		if (node.matrix && node.matrix.length === 16) {
			const { t, r, s } = decomposeTrs(Float32Array.from(node.matrix));
			out.push({
				name: node.name ?? `node${i}`,
				parent: parents[i],
				t,
				r,
				s
			});
			continue;
		}
		const [tx, ty, tz] = node.translation ?? [
			0,
			0,
			0
		];
		const [qx, qy, qz, qw] = node.rotation ?? [
			0,
			0,
			0,
			1
		];
		const [sx, sy, sz] = node.scale ?? [
			1,
			1,
			1
		];
		out.push({
			name: node.name ?? `node${i}`,
			parent: parents[i],
			t: [
				tx,
				ty,
				tz
			],
			r: [
				qx,
				qy,
				qz,
				qw
			],
			s: [
				sx,
				sy,
				sz
			]
		});
	}
	return out;
}
function parseAnimations(doc, binView) {
	const out = [];
	const src = doc.animations ?? [];
	for (let i = 0; i < src.length; i++) {
		const anim = src[i];
		const channels = [];
		let duration = 0;
		for (let c = 0; c < anim.channels.length; c++) {
			const ch = anim.channels[c];
			const path = ch.target.path;
			if (path !== "translation" && path !== "rotation" && path !== "scale") continue;
			if (ch.target.node === void 0) continue;
			const sampler = anim.samplers[ch.sampler];
			if (!sampler) continue;
			if (path === "rotation") {
				const outAcc = doc.accessors?.[sampler.output];
				if (outAcc && outAcc.componentType !== F32) throw new Error(`GLB: animation rotation output accessor ${sampler.output} has componentType ${outAcc.componentType} — only f32 rotations are supported (normalized integer quaternions are not)`);
			}
			const times = readAccessorF32(doc, binView, sampler.input);
			const values = readAccessorF32(doc, binView, sampler.output);
			const raw = sampler.interpolation;
			const interpolation = raw === "STEP" ? "STEP" : raw === "CUBICSPLINE" ? "CUBICSPLINE" : "LINEAR";
			if (times.length > 0 && times[times.length - 1] > duration) duration = times[times.length - 1];
			channels.push({
				node: ch.target.node,
				path,
				interpolation,
				times,
				values
			});
		}
		out.push({
			name: anim.name ?? `anim${i}`,
			duration,
			channels
		});
	}
	return out;
}
function parseSkins(doc, binView) {
	const out = [];
	const src = doc.skins ?? [];
	for (let i = 0; i < src.length; i++) {
		const skin = src[i];
		const joints = skin.joints ?? [];
		let inverseBind;
		if (skin.inverseBindMatrices !== void 0) inverseBind = readAccessorF32(doc, binView, skin.inverseBindMatrices);
		else {
			inverseBind = new Float32Array(joints.length * 16);
			for (let j = 0; j < joints.length; j++) {
				const o = j * 16;
				inverseBind[o] = inverseBind[o + 5] = inverseBind[o + 10] = inverseBind[o + 15] = 1;
			}
		}
		out.push({
			joints: joints.slice(),
			inverseBind
		});
	}
	return out;
}
function textureToImage(doc, textureIndex) {
	const source = doc.textures?.[textureIndex]?.source;
	if (source === void 0 || !doc.images?.[source]) return void 0;
	return source;
}
function parseMaterials(doc) {
	const out = [];
	const src = doc.materials ?? [];
	for (let i = 0; i < src.length; i++) {
		const m = src[i];
		const mat = {
			name: m.name ?? `material${i}`,
			color: [
				1,
				1,
				1,
				1
			],
			metallic: 1,
			rough: 1
		};
		const pbr = m.pbrMetallicRoughness;
		if (pbr) {
			const c = pbr.baseColorFactor;
			if (c && c.length >= 4) mat.color = [
				c[0],
				c[1],
				c[2],
				c[3]
			];
			if (pbr.metallicFactor !== void 0) mat.metallic = pbr.metallicFactor;
			if (pbr.roughnessFactor !== void 0) mat.rough = pbr.roughnessFactor;
			if (pbr.baseColorTexture) {
				const img = textureToImage(doc, pbr.baseColorTexture.index);
				if (img !== void 0) mat.colorImage = img;
			}
			if (pbr.metallicRoughnessTexture) {
				const img = textureToImage(doc, pbr.metallicRoughnessTexture.index);
				if (img !== void 0) mat.mrImage = img;
			}
		} else if (m.extensions && "KHR_materials_pbrSpecularGlossiness" in m.extensions) mat.metallic = 0;
		if (m.normalTexture) {
			const img = textureToImage(doc, m.normalTexture.index);
			if (img !== void 0) {
				mat.normalImage = img;
				mat.normalScale = m.normalTexture.scale ?? 1;
			}
		}
		const e = m.emissiveFactor;
		if (e && e.length >= 3 && (e[0] !== 0 || e[1] !== 0 || e[2] !== 0)) mat.emissive = [
			e[0],
			e[1],
			e[2]
		];
		out.push(mat);
	}
	return out;
}
function parseImages(doc, bin) {
	const out = [];
	const src = doc.images ?? [];
	for (let i = 0; i < src.length; i++) {
		const img = src[i];
		const bv = img.bufferView !== void 0 ? doc.bufferViews?.[img.bufferView] : void 0;
		if (!bv || img.uri !== void 0) {
			out.push({
				mimeType: "unsupported/uri",
				bytes: /* @__PURE__ */ new Uint8Array(0)
			});
			continue;
		}
		out.push({
			mimeType: img.mimeType ?? "image/png",
			bytes: bin.subarray(bv.byteOffset ?? 0, (bv.byteOffset ?? 0) + bv.byteLength)
		});
	}
	return out;
}
var TRIANGLES = 4;
function expandPrimitive(doc, binView, prim, world, bounds, nodeIndex, skinIndex, baked) {
	if ((prim.mode ?? TRIANGLES) !== TRIANGLES) return null;
	const posIndex = prim.attributes["POSITION"];
	if (posIndex === void 0) return null;
	const pos = readAccessorF32(doc, binView, posIndex);
	const posCount = pos.length / 3 | 0;
	const normalIndex = prim.attributes["NORMAL"];
	const nrm = normalIndex !== void 0 ? readAccessorF32(doc, binView, normalIndex) : null;
	const uvIndex = prim.attributes["TEXCOORD_0"];
	const uv = uvIndex !== void 0 ? readAccessorF32(doc, binView, uvIndex) : null;
	const idx = prim.indices !== void 0 ? readIndices(doc, binView, prim.indices) : null;
	const jointsIndex = prim.attributes["JOINTS_0"];
	const weightsIndex = prim.attributes["WEIGHTS_0"];
	const skinned = skinIndex !== null && jointsIndex !== void 0 && weightsIndex !== void 0;
	const srcJoints = skinned ? readAccessorF32(doc, binView, jointsIndex) : null;
	const srcWeights = skinned ? readAccessorF32(doc, binView, weightsIndex) : null;
	const count = idx ? idx.length : posCount;
	const verts = new Float32Array(count * 8);
	const nm = normalMatrix(world);
	const m0 = world[0], m1 = world[1], m2 = world[2];
	const m4 = world[4], m5 = world[5], m6 = world[6];
	const m8 = world[8], m9 = world[9], m10 = world[10];
	const m12 = world[12], m13 = world[13], m14 = world[14];
	const { min, max } = bounds;
	const joints = srcJoints ? new Uint16Array(count * 4) : null;
	const weights = srcWeights ? new Float32Array(count * 4) : null;
	for (let k = 0; k < count; k++) {
		const s = idx ? idx[k] : k;
		const px = pos[s * 3], py = pos[s * 3 + 1], pz = pos[s * 3 + 2];
		const wx = m0 * px + m4 * py + m8 * pz + m12;
		const wy = m1 * px + m5 * py + m9 * pz + m13;
		const wz = m2 * px + m6 * py + m10 * pz + m14;
		const o = k * 8;
		if (baked) {
			verts[o] = wx;
			verts[o + 1] = wy;
			verts[o + 2] = wz;
		} else {
			verts[o] = px;
			verts[o + 1] = py;
			verts[o + 2] = pz;
		}
		if (wx < min[0]) min[0] = wx;
		if (wy < min[1]) min[1] = wy;
		if (wz < min[2]) min[2] = wz;
		if (wx > max[0]) max[0] = wx;
		if (wy > max[1]) max[1] = wy;
		if (wz > max[2]) max[2] = wz;
		if (nrm) {
			const nx = nrm[s * 3], ny = nrm[s * 3 + 1], nz = nrm[s * 3 + 2];
			let tx, ty, tz;
			if (baked) {
				tx = nm[0] * nx + nm[1] * ny + nm[2] * nz;
				ty = nm[3] * nx + nm[4] * ny + nm[5] * nz;
				tz = nm[6] * nx + nm[7] * ny + nm[8] * nz;
			} else {
				tx = nx;
				ty = ny;
				tz = nz;
			}
			const len = Math.sqrt(tx * tx + ty * ty + tz * tz);
			if (len > 1e-12) {
				const inv = 1 / len;
				tx *= inv;
				ty *= inv;
				tz *= inv;
			}
			verts[o + 3] = tx;
			verts[o + 4] = ty;
			verts[o + 5] = tz;
		}
		if (uv) {
			verts[o + 6] = uv[s * 2];
			verts[o + 7] = uv[s * 2 + 1];
		}
		if (joints && weights && srcJoints && srcWeights) {
			const j = k * 4;
			joints[j] = srcJoints[s * 4];
			joints[j + 1] = srcJoints[s * 4 + 1];
			joints[j + 2] = srcJoints[s * 4 + 2];
			joints[j + 3] = srcJoints[s * 4 + 3];
			const w0 = srcWeights[s * 4], w1 = srcWeights[s * 4 + 1];
			const w2 = srcWeights[s * 4 + 2], w3 = srcWeights[s * 4 + 3];
			const sum = w0 + w1 + w2 + w3;
			if (sum > 1e-6) {
				const inv = 1 / sum;
				weights[j] = w0 * inv;
				weights[j + 1] = w1 * inv;
				weights[j + 2] = w2 * inv;
				weights[j + 3] = w3 * inv;
			} else {
				weights[j] = 1;
				weights[j + 1] = 0;
				weights[j + 2] = 0;
				weights[j + 3] = 0;
			}
		}
	}
	if (!nrm) {
		const tris = count / 3 | 0;
		for (let t = 0; t < tris; t++) {
			const a = t * 24, b = a + 8, c = a + 16;
			const e1x = verts[b] - verts[a], e1y = verts[b + 1] - verts[a + 1], e1z = verts[b + 2] - verts[a + 2];
			const e2x = verts[c] - verts[a], e2y = verts[c + 1] - verts[a + 1], e2z = verts[c + 2] - verts[a + 2];
			let nx = e1y * e2z - e1z * e2y;
			let ny = e1z * e2x - e1x * e2z;
			let nz = e1x * e2y - e1y * e2x;
			const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
			if (len > 1e-12) {
				const inv = 1 / len;
				nx *= inv;
				ny *= inv;
				nz *= inv;
			} else {
				nx = 0;
				ny = 0;
				nz = 1;
			}
			verts[a + 3] = nx;
			verts[a + 4] = ny;
			verts[a + 5] = nz;
			verts[b + 3] = nx;
			verts[b + 4] = ny;
			verts[b + 5] = nz;
			verts[c + 3] = nx;
			verts[c + 4] = ny;
			verts[c + 5] = nz;
		}
	}
	const out = {
		verts,
		material: prim.material ?? null,
		node: nodeIndex,
		skin: skinned ? skinIndex : null,
		baked
	};
	if (joints && weights) {
		out.joints = joints;
		out.weights = weights;
	}
	return out;
}
function parseGlb(buffer) {
	const { json: doc, bin, binView } = readChunks(buffer);
	const nodes = doc.nodes ?? [];
	const anims = parseAnimations(doc, binView);
	const skins = parseSkins(doc, binView);
	const animated = /* @__PURE__ */ new Set();
	for (let a = 0; a < anims.length; a++) {
		const channels = anims[a].channels;
		for (let c = 0; c < channels.length; c++) animated.add(channels[c].node);
	}
	const primitives = [];
	const bounds = {
		min: [
			Infinity,
			Infinity,
			Infinity
		],
		max: [
			-Infinity,
			-Infinity,
			-Infinity
		]
	};
	const walk = (index, parent, ancestorAnimated) => {
		const node = nodes[index];
		if (!node) return;
		const world = mat4Multiply(parent, node.matrix && node.matrix.length === 16 ? Float32Array.from(node.matrix) : mat4FromTrs(node.translation, node.rotation, node.scale));
		const nodeAnimated = ancestorAnimated || animated.has(index);
		if (node.mesh !== void 0) {
			const mesh = doc.meshes?.[node.mesh];
			if (mesh) {
				const skinIndex = node.skin !== void 0 && skins[node.skin] ? node.skin : null;
				const baked = skinIndex === null && !nodeAnimated;
				for (let p = 0; p < mesh.primitives.length; p++) {
					const out = expandPrimitive(doc, binView, mesh.primitives[p], world, bounds, index, skinIndex, baked);
					if (out) primitives.push(out);
				}
			}
		}
		if (node.children) for (let c = 0; c < node.children.length; c++) walk(node.children[c], world, nodeAnimated);
	};
	const roots = (doc.scenes?.[doc.scene ?? 0])?.nodes ?? [];
	const identity = mat4Identity();
	for (let i = 0; i < roots.length; i++) walk(roots[i], identity, false);
	if (!Number.isFinite(bounds.min[0])) {
		bounds.min = [
			0,
			0,
			0
		];
		bounds.max = [
			0,
			0,
			0
		];
	}
	const rig = anims.length > 0 || skins.length > 0 ? {
		nodes: parseNodes(nodes),
		anims,
		skins
	} : null;
	return {
		primitives,
		materials: parseMaterials(doc),
		images: parseImages(doc, bin),
		bounds,
		rig
	};
}
//#endregion
//#region src/lib/model3d.ts
/** Uniformly scale + centre stride-8 vertex groups so the largest extent
* spans 1 (positions only — normals are direction vectors). Mutates the
* arrays; returns the applied transform. Pure — dist-tested. */
function fitVerts(groups, bounds) {
	const ex = bounds.max[0] - bounds.min[0];
	const ey = bounds.max[1] - bounds.min[1];
	const ez = bounds.max[2] - bounds.min[2];
	const scale = 1 / (Math.max(ex, ey, ez) || 1);
	const center = [
		(bounds.min[0] + bounds.max[0]) / 2,
		(bounds.min[1] + bounds.max[1]) / 2,
		(bounds.min[2] + bounds.max[2]) / 2
	];
	for (const g of groups) for (let i = 0; i < g.length; i += 8) {
		g[i] = (g[i] - center[0]) * scale;
		g[i + 1] = (g[i + 1] - center[1]) * scale;
		g[i + 2] = (g[i + 2] - center[2]) * scale;
	}
	return {
		scale,
		center
	};
}
/** 0..1 rgb (+optional alpha) → the '#rrggbb' hex the engine speaks. */
function rgbHex(r, g, b) {
	const c = (v) => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, "0");
	return `#${c(r)}${c(g)}${c(b)}`;
}
/**
* A loaded model: one live handle over every material part. Mutate
* x/y/z/yaw/pitch/roll/w/h/d/alpha exactly like a Mesh3d — every part
* follows. Per-part access stays open through `parts` (tint one material,
* hide another).
*/
var Model3d = class {
	parts;
	constructor(parts) {
		this.parts = parts;
	}
	get x() {
		return this.parts[0]?.x ?? 0;
	}
	set x(v) {
		for (const p of this.parts) p.x = v;
	}
	get y() {
		return this.parts[0]?.y ?? 0;
	}
	set y(v) {
		for (const p of this.parts) p.y = v;
	}
	get z() {
		return this.parts[0]?.z ?? 0;
	}
	set z(v) {
		for (const p of this.parts) p.z = v;
	}
	get yaw() {
		return this.parts[0]?.yaw ?? 0;
	}
	set yaw(v) {
		for (const p of this.parts) p.yaw = v;
	}
	get pitch() {
		return this.parts[0]?.pitch ?? 0;
	}
	set pitch(v) {
		for (const p of this.parts) p.pitch = v;
	}
	get roll() {
		return this.parts[0]?.roll ?? 0;
	}
	set roll(v) {
		for (const p of this.parts) p.roll = v;
	}
	get w() {
		return this.parts[0]?.w ?? 1;
	}
	set w(v) {
		for (const p of this.parts) p.w = v;
	}
	get h() {
		return this.parts[0]?.h ?? 1;
	}
	set h(v) {
		for (const p of this.parts) p.h = v;
	}
	get d() {
		return this.parts[0]?.d ?? 1;
	}
	set d(v) {
		for (const p of this.parts) p.d = v;
	}
	get alpha() {
		return this.parts[0]?.alpha ?? 1;
	}
	set alpha(v) {
		for (const p of this.parts) p.alpha = v;
	}
	/** Uniform scale sugar: w = h = d = v. */
	set size(v) {
		for (const p of this.parts) {
			p.w = v;
			p.h = v;
			p.d = v;
		}
	}
	/** Opt this whole model in/out of picking (see Mesh3d.inputEnabled) — fans
	* out to every part, so world.pick() returns any part of an enabled model. */
	get inputEnabled() {
		return this.parts[0]?.inputEnabled ?? false;
	}
	set inputEnabled(v) {
		for (const p of this.parts) p.inputEnabled = v;
	}
	/** Parent every part to a Group3d/Mesh3d (the whole model rides the
	* node; x/y/z become local to it). */
	get parent() {
		return this.parts[0]?.parent ?? null;
	}
	set parent(v) {
		for (const p of this.parts) p.parent = v;
	}
	kill() {
		for (const p of this.parts) p.kill();
	}
};
var AnimatedModel3d = class extends Model3d {
	/** Clip names (play() takes a name or index). */
	anims;
	mixer;
	/** The transform every part hangs off — drive the model through the
	* Model3d accessors as usual. */
	root;
	skinned;
	nodeParts;
	fitM;
	fitInv;
	scratchA = /* @__PURE__ */ new Float32Array(16);
	scratchB = /* @__PURE__ */ new Float32Array(16);
	rig;
	/**
	* @internal Built by the loader — reach a model as `await world.model(url)`,
	* never construct one. Internal so the shipped `.d.ts` carries no reference
	* to the stripped `SkinnedPart`/`NodePart` (a dangling type would break the
	* game project's typecheck).
	*/
	constructor(parts, rig, root, skinned, nodeParts, fit) {
		super(parts);
		this.rig = rig;
		this.root = root;
		this.mixer = new AnimMixer(rig);
		this.anims = rig.anims.map((a) => a.name);
		this.skinned = skinned;
		this.nodeParts = nodeParts;
		const s = fit.scale, c = fit.center;
		this.fitM = Float32Array.from([
			s,
			0,
			0,
			0,
			0,
			s,
			0,
			0,
			0,
			0,
			s,
			0,
			-c[0] * s,
			-c[1] * s,
			-c[2] * s,
			1
		]);
		this.fitInv = Float32Array.from([
			1 / s,
			0,
			0,
			0,
			0,
			1 / s,
			0,
			0,
			0,
			0,
			1 / s,
			0,
			c[0],
			c[1],
			c[2],
			1
		]);
		if (this.anims.length) this.mixer.play(0);
		this.update(0);
	}
	get x() {
		return this.root.x;
	}
	set x(v) {
		this.root.x = v;
	}
	get y() {
		return this.root.y;
	}
	set y(v) {
		this.root.y = v;
	}
	get z() {
		return this.root.z;
	}
	set z(v) {
		this.root.z = v;
	}
	get yaw() {
		return this.root.yaw;
	}
	set yaw(v) {
		this.root.yaw = v;
	}
	get pitch() {
		return this.root.pitch;
	}
	set pitch(v) {
		this.root.pitch = v;
	}
	get roll() {
		return this.root.roll;
	}
	set roll(v) {
		this.root.roll = v;
	}
	/** Animated models scale UNIFORMLY through the root (per-axis w/h/d
	* belongs to the mixer's node scales). */
	set size(v) {
		this.root.scale = v;
	}
	get w() {
		return this.root.scale;
	}
	set w(v) {
		this.root.scale = v;
	}
	get h() {
		return this.root.scale;
	}
	set h(v) {
		this.root.scale = v;
	}
	get d() {
		return this.root.scale;
	}
	set d(v) {
		this.root.scale = v;
	}
	get parent() {
		return this.root.parent;
	}
	set parent(v) {
		this.root.parent = v;
	}
	/** Play a clip by name or index; crossfades from the current one. */
	play(clip, opts) {
		this.mixer.play(clip, opts);
	}
	/** @internal Copy every skinned part's palette into the world's pool at
	* its mesh's allocated base (world3d calls this each prepare). */
	writePalettes(pool) {
		for (const sp of this.skinned) pool.set(sp.palette, sp.mesh.paletteBase * 16);
	}
	/** Advance the rig (the world ticks this every frame). */
	update(dt) {
		this.mixer.update(dt);
		const worlds = this.mixer.worlds;
		for (const np of this.nodeParts) {
			mat4MulTo(this.fitM, worlds.subarray(np.node * 16, np.node * 16 + 16), this.scratchA);
			mat4MulTo(this.scratchA, this.fitInv, this.scratchB);
			const d = decomposeTRS(this.scratchB);
			np.mesh.x = d.t[0];
			np.mesh.y = d.t[1];
			np.mesh.z = d.t[2];
			np.mesh.yaw = d.e[0];
			np.mesh.pitch = d.e[1];
			np.mesh.roll = d.e[2];
			np.mesh.w = d.s[0];
			np.mesh.h = d.s[1];
			np.mesh.d = d.s[2];
		}
		for (const sp of this.skinned) {
			const skin = this.rig.skins[sp.skin];
			jointPalette(skin, worlds, sp.palette);
			const nj = skin.joints.length;
			for (let j = 0; j < nj; j++) {
				const off = j * 16;
				mat4MulTo(this.fitM, sp.palette.subarray(off, off + 16), this.scratchA);
				mat4MulTo(this.scratchA, this.fitInv, this.scratchB);
				sp.palette.set(this.scratchB, off);
			}
		}
	}
};
/** CPU-skin a stride-8 soup: pos by the weighted palette matrices, normals
* by their rotation parts (renormalised). Pure — dist-tested. */
function cpuSkin(base, joints, weights, palette, out) {
	const n = base.length / 8;
	for (let v = 0; v < n; v++) {
		const o = v * 8;
		const jo = v * 4;
		const px = base[o], py = base[o + 1], pz = base[o + 2];
		const nx = base[o + 3], ny = base[o + 4], nz = base[o + 5];
		let sx = 0, sy = 0, sz = 0, snx = 0, sny = 0, snz = 0;
		for (let k = 0; k < 4; k++) {
			const w = weights[jo + k];
			if (w === 0) continue;
			const m = joints[jo + k] * 16;
			sx += w * (palette[m] * px + palette[m + 4] * py + palette[m + 8] * pz + palette[m + 12]);
			sy += w * (palette[m + 1] * px + palette[m + 5] * py + palette[m + 9] * pz + palette[m + 13]);
			sz += w * (palette[m + 2] * px + palette[m + 6] * py + palette[m + 10] * pz + palette[m + 14]);
			snx += w * (palette[m] * nx + palette[m + 4] * ny + palette[m + 8] * nz);
			sny += w * (palette[m + 1] * nx + palette[m + 5] * ny + palette[m + 9] * nz);
			snz += w * (palette[m + 2] * nx + palette[m + 6] * ny + palette[m + 10] * nz);
		}
		const nl = Math.hypot(snx, sny, snz) || 1;
		out[o] = sx;
		out[o + 1] = sy;
		out[o + 2] = sz;
		out[o + 3] = snx / nl;
		out[o + 4] = sny / nl;
		out[o + 5] = snz / nl;
		out[o + 6] = base[o + 6];
		out[o + 7] = base[o + 7];
	}
}
//#endregion
//#region src/lib/model-data.ts
var cache = /* @__PURE__ */ new Map();
registerCacheClearer(() => {
	for (const p of cache.values()) p.then((md) => {
		const bmps = md.kind === "glb" ? md.bitmaps : md.imgs;
		for (const b of bmps) b?.close();
	}, () => {});
	cache.clear();
});
/**
* Load + parse a model and decode its textures — all device-free — caching the
* result by `url`. Safe from `preload()` (no World3d needed). GLB vs OBJ is
* chosen by extension. Re-requesting a loaded url is free.
*/
function loadModelData(url) {
	const hit = cache.get(url);
	if (hit) return hit;
	const p = (/\.obj$/i.test(url) ? loadObjData(url) : loadGlbData(url)).then((md) => {
		markModelLoaded(url);
		return md;
	});
	cache.set(url, p);
	return p;
}
async function loadGlbData(url) {
	const data = parseGlb(await loadBinary(url));
	return {
		kind: "glb",
		data,
		fit: fitVerts(data.primitives.filter((pr) => pr.baked).map((pr) => pr.verts), data.bounds),
		bitmaps: await Promise.all(data.images.map(async (im) => {
			if (!im.bytes.length || !im.mimeType.startsWith("image/")) return void 0;
			try {
				return await createImageBitmap(new Blob([im.bytes.slice()], { type: im.mimeType }));
			} catch {
				return;
			}
		}))
	};
}
async function loadObjData(url) {
	const data = parseObj(await loadText(url));
	const dir = url.slice(0, url.lastIndexOf("/") + 1);
	const base = url.slice(dir.length).replace(/\.obj$/i, "");
	let mats = {};
	for (const cand of [data.mtllib, base + ".mtl"]) {
		if (!cand) continue;
		try {
			mats = parseMtl(await loadText(dir + cand));
			break;
		} catch {}
	}
	fitVerts(data.groups.map((g) => g.verts), data.bounds);
	const imgs = await Promise.all(data.groups.map(async (g) => {
		const mat = g.material ? mats[g.material] : void 0;
		if (!mat?.map) return void 0;
		const file = mat.map.split(/[\\/]/).pop();
		try {
			return await createImageBitmap(await loadImage(dir + file));
		} catch {
			return;
		}
	}));
	return {
		kind: "obj",
		data,
		mats,
		imgs
	};
}
//#endregion
//#region src/lib/vector3d.ts
var LINE3D_FLOATS = 16;
/** A retained 3D line shape — mutate the transform/style freely. */
var VectorShape3d = class {
	x;
	y;
	z;
	yaw;
	pitch;
	roll;
	scale;
	color;
	width;
	alpha;
	dead = false;
	/** Shape-local segments [ax, ay, az, bx, by, bz]. */
	segs;
	constructor(segs, o = {}) {
		this.segs = segs;
		this.x = o.x ?? 0;
		this.y = o.y ?? 0;
		this.z = o.z ?? 0;
		this.yaw = o.yaw ?? 0;
		this.pitch = o.pitch ?? 0;
		this.roll = o.roll ?? 0;
		this.scale = o.scale ?? 1;
		this.color = o.color ?? "#7df9ff";
		this.width = o.width ?? 1.5;
		this.alpha = o.alpha ?? 1;
	}
	kill() {
		this.dead = true;
	}
};
/** Polylines → shape-local segments (shared by lines() and wireframes). */
function polylinesToSegs(polylines, closed = false) {
	const segs = [];
	for (const line of polylines) {
		for (let i = 0; i < line.length - 1; i++) segs.push([...line[i], ...line[i + 1]]);
		if (closed && line.length > 2) segs.push([...line[line.length - 1], ...line[0]]);
	}
	return segs;
}
/**
* Extract WIREFRAME edges from a stride-8 triangle soup. Verts are welded
* by position (1e-4 grid); an edge is kept when it borders one face only
* (boundary/open geometry) or its faces crease by more than `angle`
* degrees. Returns segments in the soup's own coordinate space.
*/
function wireframeEdges(verts, angle = 20) {
	const all = angle <= 0;
	const cosT = Math.cos(angle * Math.PI / 180);
	const weld = /* @__PURE__ */ new Map();
	const pos = [];
	const idOf = (o) => {
		const x = verts[o], y = verts[o + 1], z = verts[o + 2];
		const key = `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
		let id = weld.get(key);
		if (id === void 0) {
			id = pos.length;
			weld.set(key, id);
			pos.push([
				x,
				y,
				z
			]);
		}
		return id;
	};
	const edges = /* @__PURE__ */ new Map();
	const triCount = Math.floor(verts.length / 24);
	for (let t = 0; t < triCount; t++) {
		const o = t * 24;
		const i0 = idOf(o), i1 = idOf(o + 8), i2 = idOf(o + 16);
		if (i0 === i1 || i1 === i2 || i2 === i0) continue;
		const p0 = pos[i0], p1 = pos[i1], p2 = pos[i2];
		const ux = p1[0] - p0[0], uy = p1[1] - p0[1], uz = p1[2] - p0[2];
		const vx = p2[0] - p0[0], vy = p2[1] - p0[1], vz = p2[2] - p0[2];
		let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
		const l = Math.hypot(nx, ny, nz);
		if (l < 1e-12) continue;
		nx /= l;
		ny /= l;
		nz /= l;
		for (const [a, b] of [
			[i0, i1],
			[i1, i2],
			[i2, i0]
		]) {
			const key = a < b ? `${a}:${b}` : `${b}:${a}`;
			let e = edges.get(key);
			if (!e) {
				e = {
					a: Math.min(a, b),
					b: Math.max(a, b),
					normals: []
				};
				edges.set(key, e);
			}
			e.normals.push([
				nx,
				ny,
				nz
			]);
		}
	}
	const out = [];
	for (const e of edges.values()) {
		let keep = all || e.normals.length === 1;
		if (!keep) outer: for (let i = 0; i < e.normals.length; i++) for (let j = i + 1; j < e.normals.length; j++) {
			const [ax, ay, az] = e.normals[i];
			const [bx, by, bz] = e.normals[j];
			if (Math.abs(ax * bx + ay * by + az * bz) < cosT) {
				keep = true;
				break outer;
			}
		}
		if (keep) {
			const p = pos[e.a], q = pos[e.b];
			out.push([
				p[0],
				p[1],
				p[2],
				q[0],
				q[1],
				q[2]
			]);
		}
	}
	return out;
}
/** The 3D line shader (pure string — dist-tested). Screen-space width in
* pixels, depth from the real endpoints. */
function buildLine3dWGSL() {
	return `
struct U {
  viewProj: mat4x4f,
  screen: vec4f,       // w, h, cameraNear, 0
}
// posA: endpoint a (xyz) + core half-width in PIXELS
// posB: endpoint b (xyz) + capped (1 = round caps, 0 = hairline flat cut)
// c0/c1: rgba at a / b
struct Inst { posA: vec4f, posB: vec4f, c0: vec4f, c1: vec4f }
struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) local: vec2f,       // pixel space: along, across
  @location(1) len: f32,
  @location(2) coreHalf: f32,
  @location(3) c0: vec4f,
  @location(4) c1: vec4f,
  @location(5) capped: f32,
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<storage, read> inst: array<Inst>;

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let d = inst[ii];
  var out: VSOut;
  var ca = u.viewProj * vec4f(d.posA.xyz, 1.0);
  var cb = u.viewProj * vec4f(d.posB.xyz, 1.0);
  // Near-plane clip in CLIP space (the near plane is z=0; a point nearer than
  // near — or behind the camera — has z<0). Both ends beyond it: nothing to
  // show, collapse. Otherwise slide the offending end DOWN the segment to the
  // z=0 crossing, so a long line (a floor grid straddling the camera) is
  // CLIPPED, not dropped whole. Clipping to z=0 keeps w>0, so the projection
  // below stays finite (a raw w<near test would explode the pixel coords).
  if (ca.z < 0.0 && cb.z < 0.0) {
    out.pos = vec4f(0.0, 0.0, -2.0, 1.0);
    return out;
  }
  if (ca.z < 0.0) { ca = mix(ca, cb, ca.z / (ca.z - cb.z)); }
  else if (cb.z < 0.0) { cb = mix(cb, ca, cb.z / (cb.z - ca.z)); }
  let half = vec2f(u.screen.x, u.screen.y) * 0.5;
  let pa = (ca.xy / ca.w) * half;          // pixel space, y up — SDF only
  let pb = (cb.xy / cb.w) * half;
  let ab = pb - pa;
  let len = max(1e-4, length(ab));
  let dir = ab / len;
  let n = vec2f(-dir.y, dir.x);
  let reach = d.posA.w + 2.0;
  let c01 = vec2f(f32(vi & 1u), f32(vi >> 1u));
  let along = mix(-reach, len + reach, c01.x);
  let across = (c01.y - 0.5) * 2.0 * reach;
  let px = pa + dir * along + n * across;
  // Back to clip: depth/w interpolate between the endpoints by the cap-
  // clamped fraction, so the line sits at its true 3D depth.
  let tz = clamp(c01.x, 0.0, 1.0);
  let cw = mix(ca.w, cb.w, tz);
  // Depth bias toward the camera, in WORLD units (~0.05): wireframe edges
  // lie EXACTLY on the surface that occludes them in hidden-line mode and
  // z-fight it without a bias. It must be world-PROPORTIONAL: perspective
  // depth compresses with distance (d(ndc)/d(world) ~ near / w^2), so a
  // constant NDC bias — the first attempt — outweighed entire model
  // thicknesses at range and let every back edge through. depth' =
  // depth - bias*near/w^2, i.e. clip z' = clip z - bias*near/w.
  let cz = mix(ca.z, cb.z, tz) - (0.05 * u.screen.z) / cw;
  out.pos = vec4f(px / half * cw, cz, cw);
  out.local = vec2f(along, across);
  out.len = len;
  out.coreHalf = d.posA.w;
  out.c0 = d.c0;
  out.c1 = d.c1;
  out.capped = d.posB.w;
  return out;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  // Capsule SDF in pixel space (the 2D vector recipe): round caps overlap
  // invisibly at alpha 1; hairlines (width < 1) cut flat instead — their
  // AA-limited caps double-blend into dots at every joint otherwise.
  var ax = in.local.x;
  if (in.capped < 0.5) { ax = clamp(ax, 0.0, in.len); }
  let q = vec2f(ax - clamp(ax, 0.0, in.len), in.local.y);
  let dist = length(q);
  var a = 1.0 - smoothstep(in.coreHalf - 0.5, in.coreHalf + 0.5, dist);
  if (in.capped < 0.5 && (in.local.x < 0.0 || in.local.x > in.len)) { a = 0.0; }
  let t = clamp(in.local.x / max(in.len, 1e-4), 0.0, 1.0);
  let c = mix(in.c0, in.c1, t);
  let alpha = c.a * a;
  return vec4f(c.rgb * alpha, alpha);
}
`;
}
/** The retained 3D vector layer — world3d owns one; shapes pack every
* frame (transforms are live) into one instanced draw. */
var Vector3dLayer = class {
	format;
	sampleCount;
	device;
	pipeline;
	layout;
	bind;
	uniforms;
	buf;
	data = new Float32Array(1024 * 16);
	uniformData = /* @__PURE__ */ new Float32Array(20);
	shapes = [];
	/** Segments packed this frame (the draw count). */
	count = 0;
	constructor(device, format, sampleCount) {
		this.format = format;
		this.sampleCount = sampleCount;
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
		this.uniforms = device.createBuffer({
			size: this.uniformData.byteLength,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.buf = device.createBuffer({
			size: this.data.byteLength,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		const mod = shaderModule(device, buildLine3dWGSL(), "World3d vector lines");
		this.pipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
			vertex: {
				module: mod,
				entryPoint: "vs"
			},
			fragment: {
				module: mod,
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
				format: "depth24plus",
				depthWriteEnabled: false,
				depthCompare: "less-equal"
			},
			primitive: { topology: "triangle-strip" },
			multisample: { count: this.sampleCount }
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
				resource: { buffer: this.buf }
			}]
		});
	}
	/** Pack + upload every live shape's segments (world.prepare calls this). */
	prepare(vp, screenW, screenH, near = .1) {
		let live = 0;
		for (let i = this.shapes.length - 1; i >= 0; i--) if (this.shapes[i].dead) this.shapes.splice(i, 1);
		else live += this.shapes[i].segs.length;
		this.count = 0;
		if (!live) return;
		if (live * 16 > this.data.length) {
			let len = this.data.length;
			while (len < live * 16) len *= 2;
			this.data = new Float32Array(len);
			this.buf.destroy();
			this.buf = this.device.createBuffer({
				size: len * 4,
				usage: BITS.STORAGE | BITS.COPY_DST
			});
			this.makeBind();
		}
		const d = this.data;
		for (const s of this.shapes) {
			const q = eulerToQuat(s.yaw, s.pitch, s.roll);
			const c = rgba(s.color);
			const a = s.alpha;
			const capped = s.width >= 1 ? 1 : 0;
			for (const seg of s.segs) {
				const o = this.count++ * 16;
				const pa = quatRotate(q, seg[0] * s.scale, seg[1] * s.scale, seg[2] * s.scale);
				const pb = quatRotate(q, seg[3] * s.scale, seg[4] * s.scale, seg[5] * s.scale);
				d[o] = s.x + pa[0];
				d[o + 1] = s.y + pa[1];
				d[o + 2] = s.z + pa[2];
				d[o + 3] = s.width / 2;
				d[o + 4] = s.x + pb[0];
				d[o + 5] = s.y + pb[1];
				d[o + 6] = s.z + pb[2];
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
		const u = this.uniformData;
		u.set(vp, 0);
		u[16] = screenW;
		u[17] = screenH;
		u[18] = near;
		u[19] = 0;
		this.device.queue.writeBuffer(this.uniforms, 0, u);
		this.device.queue.writeBuffer(this.buf, 0, this.data.buffer, 0, this.count * 16 * 4);
	}
	draw(pass) {
		if (!this.count) return;
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		pass.draw(4, this.count);
	}
};
//#endregion
//#region src/lib/terrain3d.ts
/** Deterministic integer-lattice hash → [0, 1). Same (ix, iz, seed) is the
* same value on every machine — terrain is reproducible by seed. */
function hash2(ix, iz, seed) {
	let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed | 0, 1274126177);
	h = Math.imul(h ^ h >>> 13, 1103515245);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}
var smoothstep = (e0, e1, x) => {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
	return t * t * (3 - 2 * t);
};
function shapeFn(shape, seed, size, featureSize) {
	if (typeof shape === "function") return shape;
	const perm = noisePerm(seed);
	const fs = featureSize ?? size / 3;
	const f = 1 / fs;
	switch (shape) {
		case "flat": return () => 0;
		case "hills": return (x, z) => {
			const h = .5 + .5 * fbm2(x * f, z * f, perm, { octaves: 5 });
			return Math.min(1, Math.max(0, h)) ** 1.3;
		};
		case "mountains": return (x, z) => {
			let sum = 0, amp = 1, norm = 0, fx = x * f, fz = z * f;
			for (let o = 0; o < 5; o++) {
				sum += (1 - Math.abs(perlin2(fx, fz, perm))) * amp;
				norm += amp;
				amp *= .5;
				fx *= 2.1;
				fz *= 2.1;
			}
			return Math.min(1, Math.max(0, sum / norm)) ** 1.9;
		};
		case "dunes": return (x, z) => {
			const warp = fbm2(x * f * 2.5, z * f * 2.5, perm, { octaves: 3 }) * fs * .15;
			const d = (x * .9 + z * .35 + warp) * 2.33 / fs;
			const fr = d - Math.floor(d);
			return .08 + .3 * (fr < .72 ? fr / .72 : (1 - fr) / .28) + .12 * (.5 + .5 * fbm2(x * f, z * f, perm, { octaves: 3 }));
		};
		default: return (x, z) => {
			const base = .5 + .5 * fbm2(x * f, z * f, perm, { octaves: 5 });
			const fall = 1 - smoothstep(.45, .95, Math.hypot(x, z) / (size * .5));
			return Math.min(1, Math.max(0, base * fall)) ** 1.15;
		};
	}
}
var Heightfield = class {
	size;
	res;
	height;
	baseY;
	seed;
	/** (res+1)² world-Y samples, row-major, z-major rows. */
	heights;
	constructor(opts = {}) {
		this.size = opts.size ?? 400;
		this.res = Math.max(1, Math.round(opts.res ?? 128));
		this.height = opts.height ?? 30;
		this.baseY = opts.y ?? 0;
		this.seed = opts.seed ?? 1;
		const fn = shapeFn(opts.shape ?? "island", this.seed, this.size, opts.featureSize);
		const v = this.res + 1;
		this.heights = new Float32Array(v * v);
		for (let iz = 0; iz < v; iz++) {
			const wz = (iz / this.res - .5) * this.size;
			for (let ix = 0; ix < v; ix++) {
				const wx = (ix / this.res - .5) * this.size;
				this.heights[iz * v + ix] = this.baseY + fn(wx, wz) * this.height;
			}
		}
	}
	/** Grid sample, clamped at the edges. */
	gridY(ix, iz) {
		const v = this.res + 1;
		const cx = Math.min(v - 1, Math.max(0, ix));
		const cz = Math.min(v - 1, Math.max(0, iz));
		return this.heights[cz * v + cx];
	}
	/**
	* Ground height at a world position — TRIANGLE-EXACT: interpolates over
	* the same two triangles per quad the mesh rasterises (diagonal from
	* (ix+1, iz) to (ix, iz+1)), so objects placed here sit ON the render.
	* Clamps outside the terrain.
	*/
	heightAt(x, z) {
		const gx = Math.min(this.res - 1e-6, Math.max(0, (x / this.size + .5) * this.res));
		const gz = Math.min(this.res - 1e-6, Math.max(0, (z / this.size + .5) * this.res));
		const ix = Math.floor(gx), iz = Math.floor(gz);
		const fx = gx - ix, fz = gz - iz;
		const a = this.gridY(ix, iz), b = this.gridY(ix + 1, iz);
		const c = this.gridY(ix, iz + 1), d = this.gridY(ix + 1, iz + 1);
		if (fx + fz <= 1) return a + (b - a) * fx + (c - a) * fz;
		return d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
	}
	/** SMOOTH vertex normal at a grid point (central differences) — the same
	* normals the mesh verts carry, so shading and queries agree. */
	vertexNormal(ix, iz) {
		const cell = this.size / this.res;
		const dx = (this.gridY(ix + 1, iz) - this.gridY(ix - 1, iz)) / (2 * cell);
		const dz = (this.gridY(ix, iz + 1) - this.gridY(ix, iz - 1)) / (2 * cell);
		const il = 1 / Math.hypot(dx, 1, dz);
		return [
			-dx * il,
			il,
			-dz * il
		];
	}
	/** Smooth surface normal at a world position (bilinear vertex normals). */
	normalAt(x, z) {
		const gx = Math.min(this.res - 1e-6, Math.max(0, (x / this.size + .5) * this.res));
		const gz = Math.min(this.res - 1e-6, Math.max(0, (z / this.size + .5) * this.res));
		const ix = Math.floor(gx), iz = Math.floor(gz);
		const fx = gx - ix, fz = gz - iz;
		const a = this.vertexNormal(ix, iz), b = this.vertexNormal(ix + 1, iz);
		const c = this.vertexNormal(ix, iz + 1), d = this.vertexNormal(ix + 1, iz + 1);
		const nx = (a[0] + (b[0] - a[0]) * fx) * (1 - fz) + (c[0] + (d[0] - c[0]) * fx) * fz;
		const ny = (a[1] + (b[1] - a[1]) * fx) * (1 - fz) + (c[1] + (d[1] - c[1]) * fx) * fz;
		const nz = (a[2] + (b[2] - a[2]) * fx) * (1 - fz) + (c[2] + (d[2] - c[2]) * fx) * fz;
		const il = 1 / Math.hypot(nx, ny, nz);
		return {
			x: nx * il,
			y: ny * il,
			z: nz * il
		};
	}
	/** 0 = flat, 1 = vertical (it's just 1 - normalAt().y). */
	slopeAt(x, z) {
		return 1 - this.normalAt(x, z).y;
	}
};
/** Build one chunk's mesh. Edge verts sample the SHARED heightfield grid, so
* adjacent chunks are seamless by construction. */
function chunkVerts(hf, cx, cz, chunksPerSide, colormapRes = 1024) {
	const q = hf.res / chunksPerSide;
	if (q !== Math.floor(q)) throw new Error("terrain: chunks must divide res");
	const chunkW = hf.size / chunksPerSide;
	const xc = (cx + .5) * chunkW - hf.size / 2;
	const zc = (cz + .5) * chunkW - hf.size / 2;
	const x0 = cx * q, z0 = cz * q;
	let minY = Infinity, maxY = -Infinity;
	for (let iz = 0; iz <= q; iz++) for (let ix = 0; ix <= q; ix++) {
		const y = hf.gridY(x0 + ix, z0 + iz);
		if (y < minY) minY = y;
		if (y > maxY) maxY = y;
	}
	const midY = (minY + maxY) / 2;
	const rangeY = Math.max(maxY - minY, .001);
	const inset = .5 / colormapRes, span = 1 - 1 / colormapRes;
	const verts = new Float32Array(q * q * 6 * 8);
	let o = 0;
	const emit = (ix, iz) => {
		const wx = ((x0 + ix) / hf.res - .5) * hf.size;
		const wz = ((z0 + iz) / hf.res - .5) * hf.size;
		const wy = hf.gridY(x0 + ix, z0 + iz);
		const n = hf.vertexNormal(x0 + ix, z0 + iz);
		verts[o++] = (wx - xc) / chunkW;
		verts[o++] = (wy - midY) / rangeY;
		verts[o++] = (wz - zc) / chunkW;
		verts[o++] = n[0];
		verts[o++] = n[1];
		verts[o++] = n[2];
		verts[o++] = inset + (wx / hf.size + .5) * span;
		verts[o++] = inset + (wz / hf.size + .5) * span;
	};
	for (let iz = 0; iz < q; iz++) for (let ix = 0; ix < q; ix++) {
		emit(ix, iz);
		emit(ix, iz + 1);
		emit(ix + 1, iz);
		emit(ix + 1, iz);
		emit(ix, iz + 1);
		emit(ix + 1, iz + 1);
	}
	return {
		verts,
		x: xc,
		y: midY,
		z: zc,
		w: chunkW,
		h: rangeY,
		d: chunkW
	};
}
var TERRAIN_SURFACES = {
	grass: {
		rough: .92,
		bands: [
			{
				h: 0,
				color: "#b8a97e",
				steep: "#8f8266"
			},
			{
				h: .06,
				color: "#8fae62",
				steep: "#7d7460"
			},
			{
				h: .3,
				color: "#5f8f4e",
				steep: "#6f6a58"
			},
			{
				h: .55,
				color: "#4f7245",
				steep: "#66604f"
			},
			{
				h: .72,
				color: "#7d7566",
				steep: "#6b6459"
			},
			{
				h: .88,
				color: "#e8ecf0",
				steep: "#9aa0a8"
			}
		]
	},
	sand: {
		rough: .85,
		bands: [
			{
				h: 0,
				color: "#c9b183",
				steep: "#a8905f"
			},
			{
				h: .3,
				color: "#d9c294",
				steep: "#b39a67"
			},
			{
				h: .7,
				color: "#e4d1a5",
				steep: "#bfa671"
			}
		]
	},
	snow: {
		rough: .55,
		bands: [
			{
				h: 0,
				color: "#dfe6ee",
				steep: "#7a8290"
			},
			{
				h: .4,
				color: "#edf2f7",
				steep: "#8b93a0"
			},
			{
				h: .8,
				color: "#fafcff",
				steep: "#a2aab6"
			}
		]
	},
	rock: {
		rough: .95,
		bands: [
			{
				h: 0,
				color: "#5a5248",
				steep: "#4a443c"
			},
			{
				h: .35,
				color: "#6e655a",
				steep: "#57504a"
			},
			{
				h: .7,
				color: "#847a6e",
				steep: "#645c52"
			},
			{
				h: .9,
				color: "#a0998c",
				steep: "#78705f"
			}
		]
	}
};
/**
* Bake the band colormap: one RGBA pixel field over the whole terrain
* (world XZ → uv), colour from the height-band gradient, blended toward the
* band's `steep` colour on slopes, with two scales of noise jitter so flats
* aren't airbrushed. Pure — world3d puts it on a canvas.
*/
function bakeColormapPixels(hf, bands, res, seed = 1, detail = 0) {
	const px = new Uint8ClampedArray(res * res * 4);
	const sorted = [...bands].sort((a, b) => a.h - b.h);
	const cols = sorted.map((b) => rgba(b.color));
	const steeps = sorted.map((b) => rgba(b.steep ?? b.color));
	const jperm = noisePerm(seed ^ 20907);
	const jitterF = 24 / res;
	const dperm = noisePerm(seed ^ 11422);
	const dF1 = 240 / res, dF2 = 680 / res;
	let o = 0;
	for (let py = 0; py < res; py++) {
		const wz = ((py + .5) / res - .5) * hf.size;
		for (let pxi = 0; pxi < res; pxi++) {
			const wx = ((pxi + .5) / res - .5) * hf.size;
			const h01 = Math.min(1, Math.max(0, (hf.heightAt(wx, wz) - hf.baseY) / Math.max(hf.height, 1e-6)));
			const slope = 1 - hf.normalAt(wx, wz).y;
			let i = 0;
			while (i < sorted.length - 1 && h01 >= sorted[i + 1].h) i++;
			const j = Math.min(i + 1, sorted.length - 1);
			const gap = Math.max(sorted[j].h - sorted[i].h, 1e-6);
			const t = i === j ? 0 : smoothstep(.15, .85, (h01 - sorted[i].h) / gap);
			const sMix = smoothstep(.22, .5, slope);
			let r = 0, g = 0, b = 0;
			for (let k = 0; k < 3; k++) {
				const flat = cols[i][k] + (cols[j][k] - cols[i][k]) * t;
				const v = flat + (steeps[i][k] + (steeps[j][k] - steeps[i][k]) * t - flat) * sMix;
				if (k === 0) r = v;
				else if (k === 1) g = v;
				else b = v;
			}
			1 + perlin2(pxi * jitterF, py * jitterF, jperm) * .06 + (hash2(pxi, py, seed) - .5) * .05;
			let dr = r, dg = g, db = b;
			if (detail > 0) {
				const grassy = Math.max(0, Math.min(1, (g - Math.max(r, b)) / .12));
				if (grassy > 0) {
					const k = (perlin2(pxi * dF1, py * dF1, dperm) * .62 + perlin2(pxi * dF2, py * dF2, dperm) * .38) * detail * grassy;
					const lum = 1 + k * .26;
					dr = r * lum * (1 + k * .1);
					dg = g * lum;
					db = b * lum * (1 - k * .12);
				}
			}
			{
				const sandy = Math.max(0, Math.min(1, ((r + g) * .5 - b - .04) / .12)) * (1 - Math.max(0, Math.min(1, (g - Math.max(r, b)) / .08)));
				if (sandy > 0) {
					const kk = 1 + perlin2(pxi * dF1 * .55, py * dF1 * .55, dperm) * .035 * sandy;
					dr *= kk;
					dg *= kk;
					db *= kk * .99;
				}
			}
			px[o++] = dr * 255;
			px[o++] = dg * 255;
			px[o++] = db * 255;
			px[o++] = 255;
		}
	}
	return px;
}
/** One tileable grain field, size×size, values ~[0, 1] around a 0.5 mean:
* three DECORRELATED octaves of wrapped-lattice value noise (the second
* axis-swapped, the third diagonal-offset — same-orientation lattices gave
* the sand a visible uniform grid with long stripes; Rich's image) + a
* per-texel hash sparkle. */
function bakeGrainField(size = 256) {
	const out = new Float32Array(size * size);
	const sm = (v) => v * v * (3 - 2 * v);
	const val = (x, y, period, seed) => {
		const xi = Math.floor(x), yi = Math.floor(y);
		const h = (ix, iy) => hash2((ix % period + period) % period, (iy % period + period) % period, seed);
		const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
		const ux = sm(x - xi), uy = sm(y - yi);
		return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
	};
	for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
		const u = (x + .5) / size, v = (y + .5) / size;
		const g = .42 * val(u * 23, v * 23, 23, 23063) + .33 * val(v * 61, u * 61, 61, 37587) + .25 * val(u * 97 + v * 41, v * 97 - u * 41, 97, 7349);
		const sparkle = (hash2(x, y, 12791) - .5) * .5;
		out[y * size + x] = Math.min(1, Math.max(0, .5 + (g - .5) * .95 + sparkle));
	}
	return out;
}
/** Bake the grain into an r8unorm texture with a full box-filter mip chain
* (the deep mips are the distance fade — they converge on the 0.5 mean). */
function createGrainTexture(device, size = 256) {
	const mips = 1 + Math.floor(Math.log2(size));
	const tex = device.createTexture({
		size: {
			width: size,
			height: size
		},
		format: "r8unorm",
		mipLevelCount: mips,
		usage: BITS.TEXTURE_BINDING | 2
	});
	let field = bakeGrainField(size);
	let w = size;
	for (let m = 0; m < mips; m++) {
		const bytes = new Uint8Array(w * w);
		for (let i = 0; i < w * w; i++) {
			const v = Math.round(field[i] * 255);
			bytes[i] = v < 0 ? 0 : v > 255 ? 255 : v;
		}
		device.queue.writeTexture({
			texture: tex,
			mipLevel: m
		}, bytes, { bytesPerRow: w }, {
			width: w,
			height: w
		});
		if (m + 1 < mips) {
			const hw = w >> 1;
			const next = new Float32Array(hw * hw);
			for (let y = 0; y < hw; y++) for (let x = 0; x < hw; x++) {
				const i0 = y * 2 * w + x * 2, i1 = i0 + w;
				next[y * hw + x] = (field[i0] + field[i0 + 1] + field[i1] + field[i1 + 1]) * .25;
			}
			field = next;
			w = hw;
		}
	}
	return tex;
}
/** Pick a chunks-per-side that divides res — near res/16, capped at 8 per
* side (64 buckets: past that, per-bucket cull dispatches + indirect draws
* cost more than the culling saves). */
function pickChunks(res, requested) {
	if (requested && res % requested === 0) return requested;
	let c = Math.max(1, Math.min(8, Math.round(res / 16)));
	while (c > 1 && res % c !== 0) c--;
	return c;
}
var DeformMap = class {
	res;
	window;
	maxDepth;
	sink;
	/** Depth of the deformable snow/sand layer above the base (see
	* DeformOptions.thickness). heightAt lifts the surface by this. */
	thickness;
	/** High-poly patch size in world units (0 = no layer) — the feather
	* radius the RENDERED surface uses; snowSurfaceAt matches it. */
	patchWin;
	/** Patch grid cells per side (the follow-grid resolution). */
	patchCells;
	heal;
	/** The rider's live position, set by Terrain3d.stepCarvers (the deform
	* WINDOW rides ~30% behind this; the patch sits under the action). */
	focusX = 0;
	focusZ = 0;
	/** The patch centre SNAPPED to the cell grid. The follow-grid must land
	* on a fixed world lattice every frame — if it slid continuously with
	* the rider, each vertex would sample a moving world point and the
	* triangulation would SWIM (Rich: the trenches "ripple like water").
	* Snapping to whole cells makes the mesh world-stable (it re-indexes as
	* it shifts, but the surface is identical). */
	patchCx = 0;
	patchCz = 0;
	/** res² carve depths (≥ 0), row-major, z-major rows, texel centres. */
	data;
	/** Window centre in world units — moves via follow(), quantised to texels. */
	cx = 0;
	cz = 0;
	/** Dirty texel rect [x0, z0) .. [x1, z1) for partial uploads. */
	dirtyX0 = 0;
	dirtyZ0 = 0;
	dirtyX1 = 0;
	dirtyZ1 = 0;
	/** The whole window changed (shift/heal) — upload everything. */
	fullDirty = false;
	any = false;
	constructor(opts = {}) {
		this.res = Math.max(16, Math.round(opts.res ?? 1024));
		this.window = opts.window ?? 480;
		this.thickness = opts.layer === false ? 0 : opts.thickness ?? .6;
		this.maxDepth = this.thickness > 0 ? Math.min(opts.depth ?? .6, this.thickness) : opts.depth ?? .6;
		this.sink = Math.min(opts.sink ?? .18, this.maxDepth);
		this.patchWin = this.thickness > 0 ? opts.patch ?? 240 : 0;
		this.patchCells = Math.max(2, Math.round(opts.cells ?? 288));
		this.heal = opts.heal ?? 0;
		this.data = new Float32Array(this.res * this.res);
	}
	/** World units per texel. */
	get texel() {
		return this.window / this.res;
	}
	markDirty(x0, z0, x1, z1) {
		if (this.dirtyX1 <= this.dirtyX0) {
			this.dirtyX0 = x0;
			this.dirtyZ0 = z0;
			this.dirtyX1 = x1;
			this.dirtyZ1 = z1;
		} else {
			this.dirtyX0 = Math.min(this.dirtyX0, x0);
			this.dirtyZ0 = Math.min(this.dirtyZ0, z0);
			this.dirtyX1 = Math.max(this.dirtyX1, x1);
			this.dirtyZ1 = Math.max(this.dirtyZ1, z1);
		}
	}
	/** Stamp one bowl-profiled dent: depth d at the centre easing to 0 at
	* radius r. MAX-blends with what's there (carving is compaction, not
	* excavation — the same pass twice is one trench, not two deep). */
	stamp(x, z, r, d) {
		const t = this.texel, res = this.res;
		const gx = (x - this.cx) / t + res / 2 - .5;
		const gz = (z - this.cz) / t + res / 2 - .5;
		const gr = r / t;
		const x0 = Math.max(0, Math.floor(gx - gr)), x1 = Math.min(res - 1, Math.ceil(gx + gr));
		const z0 = Math.max(0, Math.floor(gz - gr)), z1 = Math.min(res - 1, Math.ceil(gz + gr));
		if (x1 < x0 || z1 < z0) return;
		const depth = Math.min(d, this.maxDepth);
		for (let iz = z0; iz <= z1; iz++) for (let ix = x0; ix <= x1; ix++) {
			const dist = Math.hypot(ix - gx, iz - gz) / gr;
			if (dist >= 1) continue;
			const v = depth * (1 - smoothstep(.55, 1, dist));
			const i = iz * res + ix;
			if (v > this.data[i]) {
				this.data[i] = v;
				this.any = true;
			}
		}
		this.markDirty(x0, z0, x1 + 1, z1 + 1);
	}
	/** Stamp a capsule: discs along the segment every half-texel — the
	* board's frame-to-frame trail with no dashed gaps at speed. */
	line(x0, z0, x1, z1, r, d) {
		const len = Math.hypot(x1 - x0, z1 - z0);
		const step = Math.max(this.texel * .5, r * .25);
		const n = Math.max(1, Math.ceil(len / step));
		for (let i = 0; i <= n; i++) {
			const f = i / n;
			this.stamp(x0 + (x1 - x0) * f, z0 + (z1 - z0) * f, r, d);
		}
	}
	/** Carve depth at a world position — the SAME manual bilinear over texel
	* centres the shader runs, including its window-edge fade, so a board at
	* heightAt() sits exactly on the rendered snow. 0 outside the window. */
	depthAt(x, z) {
		const u = (x - this.cx) / this.window + .5;
		const v = (z - this.cz) / this.window + .5;
		const edge = Math.min(Math.min(u, 1 - u), Math.min(v, 1 - v));
		if (edge <= 0) return 0;
		const res = this.res;
		const gx = u * res - .5, gz = v * res - .5;
		const ix = Math.floor(gx), iz = Math.floor(gz);
		const fx = gx - ix, fz = gz - iz;
		const cl = (i) => Math.min(res - 1, Math.max(0, i));
		const x0 = cl(ix), x1 = cl(ix + 1), z0 = cl(iz), z1 = cl(iz + 1);
		const a = this.data[z0 * res + x0], b = this.data[z0 * res + x1];
		const c = this.data[z1 * res + x0], dd = this.data[z1 * res + x1];
		const bi = (a + (b - a) * fx) * (1 - fz) + (c + (dd - c) * fx) * fz;
		const et = Math.min(1, Math.max(0, edge / .06));
		return bi * et * et * (3 - 2 * et);
	}
	/** Re-centre the window on (x, z) when it has drifted more than an eighth
	* of the window — COPY-ON-SHIFT: content moves by whole texels so every
	* carve keeps its world position; texels scrolling in are fresh snow.
	* Returns true when a shift happened (the texture needs a full upload). */
	follow(x, z) {
		const t = this.texel;
		const sx = Math.round((x - this.cx) / t), sz = Math.round((z - this.cz) / t);
		const thresh = this.res / 8;
		if (Math.abs(sx) < thresh && Math.abs(sz) < thresh) return false;
		const res = this.res, data = this.data;
		const zs = sz > 0 ? 0 : res - 1, ze = sz > 0 ? res : -1, zd = sz > 0 ? 1 : -1;
		for (let iz = zs; iz !== ze; iz += zd) {
			const src = iz + sz;
			if (src < 0 || src >= res) {
				data.fill(0, iz * res, iz * res + res);
				continue;
			}
			if (sx >= 0) {
				data.copyWithin(iz * res, src * res + sx, src * res + res);
				data.fill(0, iz * res + res - sx, iz * res + res);
			} else {
				data.copyWithin(iz * res - sx, src * res, src * res + res + sx);
				data.fill(0, iz * res, iz * res - sx);
			}
		}
		this.cx += sx * t;
		this.cz += sz * t;
		this.fullDirty = true;
		return true;
	}
	healAcc = 0;
	/** Uniform refill (sand): every carve shallows by heal·dt. Applied in
	* 0.1 s quanta — every heal tick re-uploads the whole map, and 10 Hz
	* is invisible on a slow drift-shut. */
	healStep(dt) {
		if (this.heal <= 0 || !this.any) return;
		this.healAcc += dt;
		if (this.healAcc < .1) return;
		const dec = this.heal * this.healAcc;
		this.healAcc = 0;
		let left = false;
		for (let i = 0; i < this.data.length; i++) {
			const v = this.data[i];
			if (v <= 0) continue;
			const nv = v - dec;
			this.data[i] = nv > 0 ? nv : 0;
			if (nv > 0) left = true;
		}
		this.any = left;
		this.fullDirty = true;
	}
	clearDirty() {
		this.fullDirty = false;
		this.dirtyX0 = this.dirtyZ0 = this.dirtyX1 = this.dirtyZ1 = 0;
	}
};
/** The high-poly snow-layer PATCH: a unit grid in XZ ([-0.5, 0.5], y = 0),
* `cells`² quads as a plain pos+normal+uv soup (the VS displaces it by the
* baked base height + thickness − carve, so the trench is REAL geometry).
* uv is 0..1 across the patch. Pure — world3d uploads it once. */
function deformPatchVerts(cells) {
	const c = Math.max(2, Math.round(cells));
	const v = new Float32Array(c * c * 6 * 8);
	let o = 0;
	const emit = (ix, iz) => {
		v[o] = ix / c - .5;
		v[o + 1] = 0;
		v[o + 2] = iz / c - .5;
		v[o + 3] = 0;
		v[o + 4] = 1;
		v[o + 5] = 0;
		v[o + 6] = ix / c;
		v[o + 7] = iz / c;
		o += 8;
	};
	for (let iz = 0; iz < c; iz++) for (let ix = 0; ix < c; ix++) if (ix + iz & 1) {
		emit(ix, iz);
		emit(ix, iz + 1);
		emit(ix + 1, iz);
		emit(ix + 1, iz);
		emit(ix, iz + 1);
		emit(ix + 1, iz + 1);
	} else {
		emit(ix, iz);
		emit(ix, iz + 1);
		emit(ix + 1, iz + 1);
		emit(ix, iz);
		emit(ix + 1, iz + 1);
		emit(ix + 1, iz);
	}
	return v;
}
/** Returned by world.terrain(): the heightfield queries games drive off,
* plus the chunk meshes. Kill removes the chunks AND their buckets. */
var Terrain3d = class {
	field;
	meshes;
	onKill;
	deformHook;
	grassHook;
	/** The deform window, once deformable() has been called. */
	deform = null;
	carvers = [];
	constructor(field, meshes, onKill, deformHook, grassHook) {
		this.field = field;
		this.meshes = meshes;
		this.onKill = onKill;
		this.deformHook = deformHook;
		this.grassHook = grassHook;
	}
	/**
	* Plant GRASS (E6 vegetation, Phase 2): a compute-driven follow-window of
	* instanced blades that ride this terrain's heightfield, tinted off its
	* colormap and lit like the ground. v1 is LUSH near the camera. Returns
	* the field handle (tune `span`, `cells`, `height`, `wind`, `color`).
	*/
	grass(opts = {}) {
		return this.grassHook?.(opts) ?? null;
	}
	/**
	* Make the surface DEFORMABLE (E5 — the SSX feature): boards, wheels and
	* feet carve persistent dents the terrain renders as displaced, tinted,
	* rim-lit trenches. Snow trails persist; pass `heal` for sand that drifts
	* shut. The window follows the first carver. Idempotent.
	*/
	deformable(opts = {}) {
		if (this.deform) return this.deform;
		this.deform = new DeformMap(opts);
		this.deformHook?.(this.deform, opts);
		return this.deform;
	}
	/** Auto-trail: carve a capsule along `target`'s ground track every frame
	* (any live {x, y, z} — a mesh, a group). Only carves ON CONTACT: catch
	* air and the trail breaks exactly where you left the snow. */
	carver(target, opts = {}) {
		const map = this.deformable();
		const c = {
			target,
			radius: opts.radius ?? .8,
			depth: opts.depth ?? map.maxDepth * .75,
			lx: target.x,
			lz: target.z,
			hx: 0,
			hz: 0,
			wasAir: true,
			dead: false
		};
		this.carvers.push(c);
		return { kill: () => {
			c.dead = true;
		} };
	}
	/** Manual one-off stamp (a landing crater, a shovel). */
	carve(x, z, r, d) {
		this.deformable().stamp(x, z, r, d);
	}
	/** Carve depth at (x, z) — 0 where untouched. */
	carveDepthAt(x, z) {
		return this.deform ? this.deform.depthAt(x, z) : 0;
	}
	/** Advance the carvers + heal — world3d calls this once per frame with
	* wall-clock dt. Pure (no GPU): dist-testable. */
	stepCarvers(dt) {
		const map = this.deform;
		if (!map) return;
		let followed = false;
		for (const c of this.carvers) {
			if (c.dead) continue;
			const t = c.target;
			if (!followed) {
				map.focusX = t.x;
				map.focusZ = t.z;
				if (map.patchWin > 0) {
					const cell2 = map.patchWin / map.patchCells * 2;
					map.patchCx = Math.round(t.x / cell2) * cell2;
					map.patchCz = Math.round(t.z / cell2) * cell2;
				}
				const dx = t.x - c.lx, dz = t.z - c.lz;
				const dl = Math.hypot(dx, dz);
				if (dl > 1e-4) {
					c.hx += (dx / dl - c.hx) * Math.min(1, dt * 3);
					c.hz += (dz / dl - c.hz) * Math.min(1, dt * 3);
				}
				const bias = map.window * .3;
				map.follow(t.x - c.hx * bias, t.z - c.hz * bias);
				followed = true;
			}
			const touching = t.y - this.heightAt(t.x, t.z) < c.radius * 1.6 + .25;
			const dl2 = Math.hypot(t.x - c.lx, t.z - c.lz);
			if (touching && dl2 > .02) {
				if (c.wasAir) {
					c.lx = t.x;
					c.lz = t.z;
				}
				map.line(c.lx, c.lz, t.x, t.z, c.radius, c.depth);
				c.lx = t.x;
				c.lz = t.z;
			} else if (!touching) {
				c.lx = t.x;
				c.lz = t.z;
			}
			c.wasAir = !touching;
		}
		map.healStep(dt);
	}
	/** Ground height at (x, z) — the SNOW SURFACE a rider rides on. With a
	* deformable layer, the heightfield itself IS the snow top (the ground
	* sits `thickness` below — see groundAt) and the carve digs a REAL
	* trench straight into it: `field − carve` (carves are clamped to the
	* layer depth, so never below bedrock). This is exactly what the
	* high-poly patch renders around the rider — rider, probe and pixels
	* agree. Without a layer: field minus the small fragment-shaded sink. */
	heightAt(x, z) {
		const base = this.field.heightAt(x, z);
		if (!this.deform) return base;
		if (this.deform.thickness <= 0) return base - Math.min(this.deform.depthAt(x, z), this.deform.sink);
		return base - this.deform.depthAt(x, z);
	}
	/** Depth of the carvable snow/sand layer (0 if not deformable or layer
	* disabled). The BEDROCK under the snow is `field.heightAt − thickness`
	* — see groundAt. */
	get snowThickness() {
		return this.deform?.thickness ?? 0;
	}
	/** The bedrock under the snow at (x, z): what a probe's base puck should
	* mark. Fresh snow sits `thickness` above it; a full-depth carve reaches
	* it exactly. Without a layer this is just the heightfield. */
	groundAt(x, z) {
		return this.field.heightAt(x, z) - this.snowThickness;
	}
	/** @deprecated The patch now renders heightAt exactly (it replaces the
	* base terrain rather than floating above it) — use heightAt. */
	snowSurfaceAt(x, z) {
		return this.heightAt(x, z);
	}
	/** Smooth surface normal at (x, z). */
	normalAt(x, z) {
		return this.field.normalAt(x, z);
	}
	/** 0 flat → 1 vertical. */
	slopeAt(x, z) {
		return this.field.slopeAt(x, z);
	}
	get size() {
		return this.field.size;
	}
	kill() {
		for (const m of this.meshes) m.kill();
		this.onKill?.();
	}
};
//#endregion
//#region src/lib/lights3d.ts
var LIGHT_FLOATS = 16;
var MAX_LIGHTS = 256;
var CLUSTER_X = 16;
var CLUSTER_Y = 8;
var CLUSTER_Z = 24;
var CLUSTER_COUNT = 3072;
var MAX_PER_CLUSTER = 127;
var LU_FLOATS = 48;
/** A live light — mutate everything per frame; kill() releases it. */
var Light3d = class {
	type;
	x;
	y;
	z;
	color;
	intensity;
	radius;
	dir;
	cone;
	dead = false;
	constructor(c) {
		this.type = c.type ?? "point";
		this.x = c.x ?? 0;
		this.y = c.y ?? 0;
		this.z = c.z ?? 0;
		this.color = c.color ?? "#ffffff";
		this.intensity = c.intensity ?? 1;
		this.radius = c.radius ?? 8;
		this.dir = {
			x: c.dir?.x ?? 0,
			y: c.dir?.y ?? -1,
			z: c.dir?.z ?? 0
		};
		this.cone = {
			inner: c.cone?.inner ?? .35,
			outer: c.cone?.outer ?? .55
		};
	}
	kill() {
		this.dead = true;
	}
};
/** Clustering uses its OWN near plane, clamped away from the camera near:
* log slices from near 0.1 waste half the depth resolution inside 4.5
* units of the camera, leaving the actual scene in a handful of HUGE
* froxels that overflow any per-cluster cap. far/128 spreads the slices
* over the visible range; slice 0 extends to the camera so fragments
* closer than the clamp still shade (they read slice 0's list). */
function clusterNear(near, far) {
	return Math.max(near, far / 128);
}
/** View-space AABB of froxel (tx, ty, slice). View space: x right, y up,
* camera looks down -z; tile (0,0) is the TOP-LEFT of the screen (fragment
* coordinate convention — the FS derives its tile the same way). */
function froxelBounds(tx, ty, slice, cfg) {
	const zn = slice === 0 ? 0 : cfg.near * Math.pow(cfg.far / cfg.near, slice / 24);
	const zf = cfg.near * Math.pow(cfg.far / cfg.near, (slice + 1) / 24);
	const x0 = (2 * tx / 16 - 1) * cfg.tanHalfX;
	const x1 = (2 * (tx + 1) / 16 - 1) * cfg.tanHalfX;
	const y0 = (1 - 2 * ty / 8) * cfg.tanHalfY;
	const y1 = (1 - 2 * (ty + 1) / 8) * cfg.tanHalfY;
	const xs = [
		x0 * zn,
		x0 * zf,
		x1 * zn,
		x1 * zf
	];
	const ys = [
		y0 * zn,
		y0 * zf,
		y1 * zn,
		y1 * zf
	];
	return {
		min: [
			Math.min(...xs),
			Math.min(...ys),
			-zf
		],
		max: [
			Math.max(...xs),
			Math.max(...ys),
			-zn
		]
	};
}
/** The kernel's slice mapping: view distance → logarithmic z slice. */
function zSlice(viewDist, cfg) {
	const s = Math.floor(Math.log(viewDist / cfg.near) / Math.log(cfg.far / cfg.near) * 24);
	return Math.min(23, Math.max(0, s));
}
/** CPU twin of the binning kernel: lights are (viewX, viewY, viewZ, radius)
* quads. Returns per-cluster light-index lists (tests compare against the
* same maths the kernel runs). */
function binLightsCpu(lights, cfg) {
	const out = [];
	for (let c = 0; c < CLUSTER_COUNT; c++) {
		const b = froxelBounds(c % 16, Math.floor(c / 16) % 8, Math.floor(c / 128), cfg);
		const list = [];
		for (let i = 0; i < lights.length && list.length < 127; i++) {
			const [lx, ly, lz, r] = lights[i];
			const cx = Math.max(b.min[0], Math.min(b.max[0], lx));
			const cy = Math.max(b.min[1], Math.min(b.max[1], ly));
			const cz = Math.max(b.min[2], Math.min(b.max[2], lz));
			if ((lx - cx) ** 2 + (ly - cy) ** 2 + (lz - cz) ** 2 <= r * r) list.push(i);
		}
		out.push(list);
	}
	return out;
}
/** Assemble the cluster-binning kernel (pure string work — dist-tested). */
function buildClusterWGSL() {
	return `
struct LU {
  view: mat4x4f,
  shadowVP: mat4x4f,
  params: vec4f,      // lightCount, slices, near, far
  grid: vec4f,        // tilesX, tilesY, screenW, screenH
  proj: vec4f,        // tanHalfX, tanHalfY, 0, 0
  shadow: vec4f,      // on, biasNdc, texelUv, normalOffWorld
}
@group(0) @binding(0) var<uniform> lu: LU;
@group(0) @binding(1) var<storage, read> lights: array<vec4f>;   // 4 vec4 per light, VIEW space
@group(0) @binding(2) var<storage, read_write> clusters: array<u32>;

const TX = 16u;
const TY = 8u;
const TZ = 24u;
const STRIDE = 128u;

@compute @workgroup_size(64)
fn cs(@builtin(global_invocation_id) gid: vec3u) {
  let c = gid.x;
  if (c >= TX * TY * TZ) { return; }
  let tx = f32(c % TX);
  let ty = f32((c / TX) % TY);
  let slice = f32(c / (TX * TY));
  let near = lu.params.z;
  let far = lu.params.w;
  var zn = near * pow(far / near, slice / f32(TZ));
  if (slice < 0.5) { zn = 0.0; }   // slice 0 reaches the camera
  let zf = near * pow(far / near, (slice + 1.0) / f32(TZ));
  let x0 = (2.0 * tx / f32(TX) - 1.0) * lu.proj.x;
  let x1 = (2.0 * (tx + 1.0) / f32(TX) - 1.0) * lu.proj.x;
  let y0 = (1.0 - 2.0 * ty / f32(TY)) * lu.proj.y;
  let y1 = (1.0 - 2.0 * (ty + 1.0) / f32(TY)) * lu.proj.y;
  let bmin = vec3f(
    min(min(x0 * zn, x0 * zf), min(x1 * zn, x1 * zf)),
    min(min(y0 * zn, y0 * zf), min(y1 * zn, y1 * zf)),
    -zf,
  );
  let bmax = vec3f(
    max(max(x0 * zn, x0 * zf), max(x1 * zn, x1 * zf)),
    max(max(y0 * zn, y0 * zf), max(y1 * zn, y1 * zf)),
    -zn,
  );
  var n = 0u;
  let count = u32(lu.params.x);
  for (var i = 0u; i < count; i = i + 1u) {
    if (n >= STRIDE - 1u) { break; }
    let l = lights[i * 4u];                    // viewPos.xyz + radius
    let p = clamp(l.xyz, bmin, bmax);
    let d = l.xyz - p;
    if (dot(d, d) <= l.w * l.w) {
      clusters[c * STRIDE + 1u + n] = i;
      n = n + 1u;
    }
  }
  clusters[c * STRIDE] = n;
}
`;
}
/** The ACTIVATION pool: when more lights are registered than `max`, keep
* the ones whose light SPHERES come closest to the camera — view-space
* distance minus radius, so a big streetlamp beats a nearby candle it
* would out-reach. Pure (dist-tested); order is preserved under the cap. */
function selectLights(list, view, max) {
	if (list.length <= max) return list;
	const scored = list.map((l) => {
		const vx = view[0] * l.x + view[4] * l.y + view[8] * l.z + view[12];
		const vy = view[1] * l.x + view[5] * l.y + view[9] * l.z + view[13];
		const vz = view[2] * l.x + view[6] * l.y + view[10] * l.z + view[14];
		return {
			l,
			k: Math.hypot(vx, vy, vz) - l.radius
		};
	});
	scored.sort((a, b) => a.k - b.k);
	scored.length = max;
	return scored.map((s) => s.l);
}
var Lights3d = class {
	list = [];
	lightData = new Float32Array(256 * 16);
	luData = /* @__PURE__ */ new Float32Array(48);
	device;
	pipeline;
	/** The group(1) layout the MESH pipeline shares (world3d builds its
	* pipeline layout with this). */
	layout;
	bind;
	lu;
	lightsBuf;
	clustersBuf;
	computeBind;
	sampler;
	dummyShadow;
	shadowView = null;
	causticSampler;
	dummyCaustic;
	causticView = null;
	grainView;
	constructor(device) {
		this.rebuild(device);
	}
	get count() {
		return this.list.filter((l) => !l.dead).length;
	}
	/** Lights actually uploaded + binned LAST frame (≤ MAX_LIGHTS — the
	* activation pool picks the nearest when more are registered). */
	activeCount = 0;
	light(config = {}) {
		const l = new Light3d(config);
		this.list.push(l);
		return l;
	}
	/** Point the group(1) bind at the shadow map (world3d owns the texture;
	* null reverts to the 1×1 dummy). */
	setShadowMap(view) {
		this.shadowView = view;
		this.makeBind();
	}
	/** Point the group(1) bind at the baked caustic pattern (underwater3d owns
	* the texture; null reverts to the 1×1 black dummy = no dapple). */
	setCaustic(view) {
		this.causticView = view;
		this.makeBind();
	}
	/**
	* Per-frame: pack live lights into VIEW space, fill the shared LU uniform
	* (view/shadow matrices + cluster params), and encode the binning kernel.
	* Runs before the render passes (same encoder).
	*/
	update(encoder, view, near, far, tanHalfX, tanHalfY, screenW, screenH, shadowVP, shadowBias, shadowTexel, shadowNormalOff = 0) {
		this.list = this.list.filter((l) => !l.dead);
		near = clusterNear(near, far);
		const active = selectLights(this.list, view, 256);
		const n = active.length;
		this.activeCount = n;
		const d = this.lightData;
		for (let i = 0; i < n; i++) {
			const l = active[i];
			const o = i * 16;
			const vx = view[0] * l.x + view[4] * l.y + view[8] * l.z + view[12];
			const vy = view[1] * l.x + view[5] * l.y + view[9] * l.z + view[13];
			const vz = view[2] * l.x + view[6] * l.y + view[10] * l.z + view[14];
			const c = rgba(l.color);
			d[o] = vx;
			d[o + 1] = vy;
			d[o + 2] = vz;
			d[o + 3] = l.radius;
			d[o + 4] = c[0] * l.intensity;
			d[o + 5] = c[1] * l.intensity;
			d[o + 6] = c[2] * l.intensity;
			d[o + 7] = l.type === "spot" ? 1 : 0;
			const dl = Math.hypot(l.dir.x, l.dir.y, l.dir.z) || 1;
			const wx = l.dir.x / dl, wy = l.dir.y / dl, wz = l.dir.z / dl;
			d[o + 8] = view[0] * wx + view[4] * wy + view[8] * wz;
			d[o + 9] = view[1] * wx + view[5] * wy + view[9] * wz;
			d[o + 10] = view[2] * wx + view[6] * wy + view[10] * wz;
			d[o + 11] = Math.cos(l.cone.outer);
			d[o + 12] = Math.cos(l.cone.inner);
			d[o + 13] = 0;
			d[o + 14] = 0;
			d[o + 15] = 0;
		}
		const u = this.luData;
		u.set(view, 0);
		if (shadowVP) u.set(shadowVP, 16);
		u[32] = n;
		u[33] = 24;
		u[34] = near;
		u[35] = far;
		u[36] = 16;
		u[37] = 8;
		u[38] = screenW;
		u[39] = screenH;
		u[40] = tanHalfX;
		u[41] = tanHalfY;
		u[42] = 0;
		u[43] = 0;
		u[44] = shadowVP ? 1 : 0;
		u[45] = shadowBias;
		u[46] = shadowTexel;
		u[47] = shadowNormalOff;
		this.device.queue.writeBuffer(this.lu, 0, u);
		if (n > 0) {
			this.device.queue.writeBuffer(this.lightsBuf, 0, d.buffer, 0, n * 16 * 4);
			const pass = encoder.beginComputePass();
			pass.setPipeline(this.pipeline);
			pass.setBindGroup(0, this.computeBind);
			pass.dispatchWorkgroups(Math.ceil(CLUSTER_COUNT / 64));
			pass.end();
		}
	}
	rebuild(device) {
		this.device = device;
		this.layout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_FRAGMENT | BITS.STAGE_COMPUTE,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_FRAGMENT | BITS.STAGE_COMPUTE,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 2,
				visibility: BITS.STAGE_FRAGMENT,
				buffer: { type: "read-only-storage" }
			},
			{
				binding: 3,
				visibility: BITS.STAGE_FRAGMENT,
				texture: { sampleType: "depth" }
			},
			{
				binding: 4,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: { type: "comparison" }
			},
			{
				binding: 5,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 6,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			},
			{
				binding: 7,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			}
		] });
		const computeLayout = device.createBindGroupLayout({ entries: [
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
			}
		] });
		const module = shaderModule(device, buildClusterWGSL(), "Lights3d cluster");
		this.pipeline = device.createComputePipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [computeLayout] }),
			compute: {
				module,
				entryPoint: "cs"
			}
		});
		this.lu = device.createBuffer({
			size: 192,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.lightsBuf = device.createBuffer({
			size: 256 * 16 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.clustersBuf = device.createBuffer({
			size: CLUSTER_COUNT * 128 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		this.sampler = device.createSampler({
			compare: "less-equal",
			magFilter: "linear",
			minFilter: "linear"
		});
		const dummy = device.createTexture({
			size: {
				width: 1,
				height: 1
			},
			format: "depth24plus",
			usage: BITS.TEXTURE_BINDING | BITS.RENDER_ATTACHMENT
		});
		this.dummyShadow = dummy.createView();
		this.shadowView = null;
		this.causticSampler = device.createSampler({
			addressModeU: "repeat",
			addressModeV: "repeat",
			magFilter: "linear",
			minFilter: "linear",
			mipmapFilter: "linear"
		});
		const dummyC = device.createTexture({
			size: {
				width: 1,
				height: 1
			},
			format: "r8unorm",
			usage: BITS.TEXTURE_BINDING | 2
		});
		device.queue.writeTexture({ texture: dummyC }, new Uint8Array([0]), {}, {
			width: 1,
			height: 1
		});
		this.dummyCaustic = dummyC.createView();
		this.causticView = null;
		this.grainView = createGrainTexture(device).createView();
		this.computeBind = device.createBindGroup({
			layout: computeLayout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.lu }
				},
				{
					binding: 1,
					resource: { buffer: this.lightsBuf }
				},
				{
					binding: 2,
					resource: { buffer: this.clustersBuf }
				}
			]
		});
		this.makeBind();
	}
	makeBind() {
		this.bind = this.device.createBindGroup({
			layout: this.layout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.lu }
				},
				{
					binding: 1,
					resource: { buffer: this.lightsBuf }
				},
				{
					binding: 2,
					resource: { buffer: this.clustersBuf }
				},
				{
					binding: 3,
					resource: this.shadowView ?? this.dummyShadow
				},
				{
					binding: 4,
					resource: this.sampler
				},
				{
					binding: 5,
					resource: this.causticView ?? this.dummyCaustic
				},
				{
					binding: 6,
					resource: this.causticSampler
				},
				{
					binding: 7,
					resource: this.grainView
				}
			]
		});
	}
};
//#endregion
//#region src/lib/sky3d.ts
var KEYS = [
	{
		t: 0,
		zenith: "#05070f",
		horizon: "#0c1220",
		glow: "#101a2e",
		sun: "#a8c0e8",
		sunI: .14,
		ambient: .17,
		ambSky: "#28344e",
		ambGround: "#12151d",
		fog: "#0a0f1a",
		stars: 1,
		moon: 1
	},
	{
		t: 4.6,
		zenith: "#070b18",
		horizon: "#181a30",
		glow: "#2a2440",
		sun: "#c0a8d8",
		sunI: .13,
		ambient: .17,
		ambSky: "#2a3450",
		ambGround: "#141720",
		fog: "#121422",
		stars: .85,
		moon: .85
	},
	{
		t: 6,
		zenith: "#20365e",
		horizon: "#b06a4a",
		glow: "#ff9a58",
		sun: "#ff9660",
		sunI: .45,
		ambient: .24,
		ambSky: "#6a6a88",
		ambGround: "#3a3230",
		fog: "#7a6a68",
		stars: .15,
		moon: .2
	},
	{
		t: 7.5,
		zenith: "#38659e",
		horizon: "#d8b088",
		glow: "#ffd9a0",
		sun: "#ffd9b0",
		sunI: .85,
		ambient: .34,
		ambSky: "#a8b8d8",
		ambGround: "#7a705e",
		fog: "#b0b4c0",
		stars: 0,
		moon: 0
	},
	{
		t: 11,
		zenith: "#2f66b8",
		horizon: "#a9c9e8",
		glow: "#e8f2f8",
		sun: "#fff8ec",
		sunI: 1.05,
		ambient: .44,
		ambSky: "#cfe0f5",
		ambGround: "#8c8672",
		fog: "#9ab4cc",
		stars: 0,
		moon: 0
	},
	{
		t: 15,
		zenith: "#3468b4",
		horizon: "#aac6e0",
		glow: "#e8eef2",
		sun: "#fff4dc",
		sunI: 1,
		ambient: .42,
		ambSky: "#c8dcf0",
		ambGround: "#8a8470",
		fog: "#9cb2c8",
		stars: 0,
		moon: 0
	},
	{
		t: 17,
		zenith: "#3a5a94",
		horizon: "#dda86e",
		glow: "#ffc678",
		sun: "#ffd090",
		sunI: .8,
		ambient: .36,
		ambSky: "#b0a8b8",
		ambGround: "#6e6252",
		fog: "#af9c94",
		stars: 0,
		moon: 0
	},
	{
		t: 18,
		zenith: "#22315e",
		horizon: "#d06a3e",
		glow: "#ff8a4a",
		sun: "#ff7e42",
		sunI: .4,
		ambient: .27,
		ambSky: "#726a8c",
		ambGround: "#3c3230",
		fog: "#6e5a5c",
		stars: .05,
		moon: .1
	},
	{
		t: 19.3,
		zenith: "#0e1636",
		horizon: "#4a3050",
		glow: "#8a4a5a",
		sun: "#d090b0",
		sunI: .12,
		ambient: .2,
		ambSky: "#3a4260",
		ambGround: "#1a1a26",
		fog: "#242038",
		stars: .55,
		moon: .55
	},
	{
		t: 21,
		zenith: "#060912",
		horizon: "#0e1424",
		glow: "#142036",
		sun: "#aac2e8",
		sunI: .14,
		ambient: .17,
		ambSky: "#28344e",
		ambGround: "#12151d",
		fog: "#0c1120",
		stars: 1,
		moon: 1
	}
];
var tri = (hex) => {
	const c = rgba(hex);
	return [
		c[0],
		c[1],
		c[2]
	];
};
var lerp3 = (a, b, t) => [
	a[0] + (b[0] - a[0]) * t,
	a[1] + (b[1] - a[1]) * t,
	a[2] + (b[2] - a[2]) * t
];
/** The pure day/night core: 0..24 h → palette + sun geometry. Wraps. */
function skyState(time) {
	const t = (time % 24 + 24) % 24;
	let i = KEYS.length - 1;
	for (let k = 0; k < KEYS.length; k++) if (KEYS[k].t <= t) i = k;
	const a = KEYS[i];
	const b = KEYS[(i + 1) % KEYS.length];
	const span = (b.t - a.t + 24) % 24 || 24;
	const f = (t - a.t + 24) % 24 / span;
	const dayT = (t - 6) / 12;
	const el = Math.sin(dayT * Math.PI) * (65 * Math.PI / 180);
	const az = dayT * Math.PI;
	const ce = Math.cos(el);
	let sx = Math.cos(az) * ce, sy = Math.sin(el), sz = -.45 * ce;
	const sl = Math.hypot(sx, sy, sz) || 1;
	sx /= sl;
	sy /= sl;
	sz /= sl;
	return {
		sunPos: [
			sx,
			sy,
			sz
		],
		sunDir: sy < -.12 ? [
			sx,
			sy,
			sz
		] : [
			-sx,
			-sy,
			-sz
		],
		sunColor: lerp3(tri(a.sun), tri(b.sun), f),
		sunI: a.sunI + (b.sunI - a.sunI) * f,
		zenith: lerp3(tri(a.zenith), tri(b.zenith), f),
		horizon: lerp3(tri(a.horizon), tri(b.horizon), f),
		glow: lerp3(tri(a.glow), tri(b.glow), f),
		ambient: a.ambient + (b.ambient - a.ambient) * f,
		ambSky: lerp3(tri(a.ambSky), tri(b.ambSky), f),
		ambGround: lerp3(tri(a.ambGround), tri(b.ambGround), f),
		fog: lerp3(tri(a.fog), tri(b.fog), f),
		stars: a.stars + (b.stars - a.stars) * f,
		moon: a.moon + (b.moon - a.moon) * f
	};
}
/** Returned by world.sky(): every field is live. */
var Sky3d = class {
	time;
	cycleSecondsPerDay;
	clouds;
	coverage;
	density;
	wind;
	cloudSpeed;
	storm;
	stars;
	drive;
	flare;
	/** @internal env re-bake throttle: sun elevation at the last bake. */
	lastBakeY = 99;
	constructor(o = {}) {
		this.time = o.time ?? 11;
		this.cycleSecondsPerDay = o.cycle ?? 0;
		this.clouds = o.clouds ?? true;
		this.coverage = o.coverage ?? .45;
		this.density = o.density ?? .65;
		this.wind = o.wind ?? {
			x: 1,
			z: .35
		};
		this.cloudSpeed = o.cloudSpeed ?? 1;
		this.storm = o.storm ?? 0;
		this.stars = o.stars ?? true;
		this.drive = o.drive ?? true;
		this.flare = o.flare ?? true;
	}
	/** Auto-advance the clock: one full day per `seconds` (0 stops). */
	cycle(seconds) {
		this.cycleSecondsPerDay = seconds;
	}
	/** @internal Star-frame angle (radians): accumulated from time DELTAS so
	* it never jumps at the midnight wrap, and geared down — a 1:1 sidereal
	* rate reads frantic under a 90-second day (Rich: "the stars move SO
	* fast"). 0.12 of a revolution per day keeps the wheel visible but calm. */
	starAngle = 0;
	lastTime = null;
	/** Advance + resolve the current state (the world calls this). */
	tick(dt) {
		if (this.cycleSecondsPerDay > 0) this.time = (this.time + 24 / this.cycleSecondsPerDay * dt) % 24;
		if (this.lastTime == null) this.lastTime = this.time;
		const dh = (this.time - this.lastTime + 36) % 24 - 12;
		this.starAngle += dh / 24 * Math.PI * 2 * .12;
		this.lastTime = this.time;
		return skyState(this.time);
	}
};
var CONSTELLATIONS = [
	{
		az: 40,
		el: 48,
		stars: [
			[0, 0],
			[4, 1.5],
			[8, 2],
			[12, 1],
			[16, 3],
			[15.5, 7],
			[11, 6.2]
		]
	},
	{
		az: 185,
		el: 38,
		stars: [
			[
				2.4,
				5.6,
				1.3
			],
			[-2.6, 5.2],
			[-1, .7],
			[0, 0],
			[1, -.7],
			[
				-2.2,
				-5.4,
				1.3
			],
			[2, -5]
		]
	},
	{
		az: 300,
		el: 55,
		stars: [
			[-6, 0],
			[-3, 2.6],
			[0, .4],
			[3, 3],
			[6, 1]
		]
	},
	{
		az: 120,
		el: 28,
		stars: [
			[
				0,
				3,
				1.15
			],
			[0, -3],
			[-2.4, 0],
			[2.6, .6]
		]
	}
];
/** Constellation stars as unit directions + brightness (pure; tested). */
function constellationDirs() {
	const D = Math.PI / 180;
	const out = [];
	for (const c of CONSTELLATIONS) {
		const az = c.az * D, el = c.el * D;
		const C = [
			Math.cos(el) * Math.sin(az),
			Math.sin(el),
			Math.cos(el) * Math.cos(az)
		];
		let e1 = [
			C[2],
			0,
			-C[0]
		];
		const l1 = Math.hypot(e1[0], e1[1], e1[2]) || 1;
		e1 = [
			e1[0] / l1,
			e1[1] / l1,
			e1[2] / l1
		];
		const e2 = [
			C[1] * e1[2] - C[2] * e1[1],
			C[2] * e1[0] - C[0] * e1[2],
			C[0] * e1[1] - C[1] * e1[0]
		];
		for (const [dx, dy, b = 1] of c.stars) {
			const x = dx * D, y = dy * D;
			const v = [
				C[0] + e1[0] * x + e2[0] * y,
				C[1] + e1[1] * x + e2[1] * y,
				C[2] + e1[2] * x + e2[2] * y
			];
			const vl = Math.hypot(v[0], v[1], v[2]) || 1;
			out.push({
				x: v[0] / vl,
				y: v[1] / vl,
				z: v[2] / vl,
				b
			});
		}
	}
	return out;
}
var CSTARS = constellationDirs();
var SKY_WGSL = `
${`const CSTARS = array<vec4f, ${CSTARS.length}>(${CSTARS.map((s) => `vec4f(${s.x.toFixed(6)}, ${s.y.toFixed(6)}, ${s.z.toFixed(6)}, ${s.b})`).join(", ")});`}
struct SU {
  fwd: vec4f,        // camera forward + tanHalfX
  right: vec4f,      // camera right + tanHalfY
  up: vec4f,         // camera up + time (seconds)
  sunPos: vec4f,     // toward the sun + direct intensity
  sunCol: vec4f,     // sun rgb + moon alpha
  zenith: vec4f,     // rgb + star alpha
  horizon: vec4f,    // rgb + coverage cutoff
  glow: vec4f,       // rgb + cloud density
  cloudLit: vec4f,   // rgb + cloud uv scale
  cloudShade: vec4f, // rgb + wind speed
  wind: vec4f,       // dir x, z, cloudsOn, unused
  fog: vec4f,        // rgb + star-frame hour angle
}
@group(0) @binding(0) var<uniform> su: SU;

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) ndc: vec2f,
}

@vertex
fn vs(@builtin(vertex_index) vi: u32) -> VSOut {
  // One triangle covering the screen, at MAXIMUM depth: with less-equal it
  // shades exactly the pixels no solid wrote.
  var p = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
  var out: VSOut;
  out.pos = vec4f(p[vi], 1.0, 1.0);
  out.ndc = p[vi];
  return out;
}

fn h21(p: vec2f) -> f32 { return fract(sin(dot(p, vec2f(127.1, 311.7))) * 43758.5453); }
fn h31(p: vec3f) -> f32 { return fract(sin(dot(p, vec3f(127.1, 311.7, 74.7))) * 43758.5453); }

fn vnoise(p: vec2f) -> f32 {
  let i = floor(p); let f = fract(p);
  let u = f * f * (3.0 - 2.0 * f);
  let a = h21(i); let b = h21(i + vec2f(1.0, 0.0));
  let c = h21(i + vec2f(0.0, 1.0)); let d = h21(i + vec2f(1.0, 1.0));
  return a + (b - a) * u.x + (c - a) * u.y + (a - b - c + d) * u.x * u.y;
}

// Rotated-octave fbm: the rotation between octaves kills the axis-aligned
// streaking plain lacunarity produces — billows, not plaid.
fn fbm(p0: vec2f) -> f32 {
  var p = p0;
  var s = 0.0; var amp = 0.5; var norm = 0.0;
  let rot = mat2x2f(0.8, 0.6, -0.6, 0.8);
  for (var o = 0; o < 5; o = o + 1) {
    s += vnoise(p) * amp;
    norm += amp;
    amp *= 0.55;
    p = rot * p * 2.05 + vec2f(17.3, 9.1);
  }
  return s / norm;
}

// One cloud plane: returns (opacity, litness). uv from the ray-plane hit.
// The BILLOW recipe: warped base mass, ERODED by high-frequency detail at
// the edges (edges thin -> detail eats them first = puffy silhouettes),
// litness from the sun-displaced resample (silver lining).
fn cloudLayer(ray: vec3f, scale: f32, windT: vec2f, cutoff: f32, sunXZ: vec2f) -> vec3f {
  let uv = ray.xz / (ray.y + 0.10) * scale + windT;
  let warp = fbm(uv * 1.9 + vec2f(31.7, 11.3)) - 0.5;
  let wuv = uv + vec2f(warp * 0.9);
  // CONTRAST: normalised fbm has a tight sigma around 0.5 — stretch it so
  // the field actually crosses the coverage cutoff into solid masses.
  let n = (fbm(wuv) - 0.5) * 1.9 + 0.5;
  let detail = fbm(wuv * 3.3 + windT * 0.4) - 0.5;
  let dens = n + detail * 0.3;
  let c = smoothstep(cutoff, cutoff + 0.24, dens);
  // Interior body: alpha keeps rising past the edge so cores read solid.
  let body = smoothstep(cutoff, cutoff + 0.55, dens);
  let n2 = fbm(wuv + sunXZ * 0.16);
  let lit = clamp(0.55 + (n - n2) * 4.0, 0.0, 1.3);
  return vec3f(c, lit, body);
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let ray = normalize(su.fwd.xyz + su.right.xyz * (in.ndc.x * su.fwd.w) + su.up.xyz * (in.ndc.y * su.right.w));
  let h = ray.y;
  let time = su.up.w;

  // ── Gradient: horizon → zenith, with a sun-weighted glow band ───────────
  var col = mix(su.horizon.rgb, su.zenith.rgb, pow(clamp(h, 0.0, 1.0), 0.55));
  let flatSun = normalize(vec3f(su.sunPos.x, 0.0, su.sunPos.z) + vec3f(1e-5));
  let flatRay = normalize(vec3f(ray.x, 0.0, ray.z) + vec3f(1e-5));
  let sunSide = dot(flatSun, flatRay) * 0.5 + 0.5;
  col += su.glow.rgb * exp(-abs(h) * 8.0) * (0.3 + 0.7 * sunSide);
  // Below the horizon: settle to the fog/haze floor.
  col = mix(col, su.fog.rgb * 0.75, smoothstep(0.0, -0.22, h));

  // ── Clouds are computed FIRST (composited last): everything celestial —
  // stars, sun disc, moon — attenuates by the cloud opacity in front of it,
  // so nothing ever reads as floating in front of the deck.
  var alpha0 = 0.0; var alpha1 = 0.0;
  var cc0 = vec3f(0.0); var cc1 = vec3f(0.0);
  if (su.wind.z > 0.5 && h > 0.006) {
    let cutoff = su.horizon.w;
    let density = su.glow.w;
    let scale = su.cloudLit.w;
    let wt = su.wind.xy * (time * su.cloudShade.w);
    let sunXZ = su.sunPos.xz;
    // Fade only at the very last sliver of horizon (uv blows up there) —
    // clouds are SUPPOSED to stack low against the horizon.
    let fade = smoothstep(0.006, 0.045, h);
    // High layer: thin, fast, fine — a veil, never solid.
    let c1 = cloudLayer(ray, scale * 2.6, wt * 1.6 + vec2f(53.0), cutoff + 0.16, sunXZ);
    cc1 = mix(su.cloudShade.rgb, su.cloudLit.rgb, c1.y);
    alpha1 = min(c1.x * density * 0.4, 0.55) * fade;
    // Main layer: chunky billows with solid bright cores.
    let c0 = cloudLayer(ray, scale, wt, cutoff, sunXZ);
    let litCore = clamp(c0.y + c0.z * 0.35, 0.0, 1.35);
    cc0 = mix(su.cloudShade.rgb, su.cloudLit.rgb, litCore);
    alpha0 = min(c0.x * (0.55 + 0.45 * c0.z) * density, 0.96) * fade;
  }
  let clear = 1.0 - min(alpha0 + alpha1, 1.0);

  // ── Stars (night only, above the horizon, BEHIND the clouds) ────────────
  // Stars are DIM POINT sources: even thin cloud kills them completely —
  // a linear fade left them glowing through the veil layer and reading as
  // in-front. The steep curve snuffs them the moment any deck arrives.
  let starVis = smoothstep(0.55, 0.95, clear);
  if (su.zenith.w > 0.001 && h > 0.0 && starVis > 0.01) {
    // The whole star frame WHEELS slowly about a tilted pole (fog.w — the
    // geared angle from Sky3d.tick) — constellations rise and set.
    let ax = normalize(vec3f(0.16, 1.0, 0.09));
    let ca = cos(su.fog.w); let sa = sin(su.fog.w);
    let sray = ray * ca + cross(ax, ray) * sa + ax * dot(ax, ray) * (1.0 - ca);
    let horizFade = smoothstep(0.0, 0.12, h) * su.zenith.w * starVis;
    let sp = sray * 340.0;
    let cell = floor(sp);
    let rz = h31(cell + vec3f(0.5));
    if (rz > 0.93) {
      let jitter = vec3f(h31(cell + vec3f(11.0)), h31(cell + vec3f(23.0)), h31(cell + vec3f(37.0)));
      let d = length(fract(sp) - 0.5 - (jitter - 0.5) * 0.5);
      // Twinkle gets its OWN hash (rz spans only 0.93..1 — phases derived
      // from it fade every star in unison). And it's SUBTLE: stars mostly
      // hold steady; roughly a fifth GLINT sharply now and then.
      let twr = h31(cell + vec3f(71.3));
      let tw = 0.92 + 0.08 * sin(time * (0.4 + twr * 1.4) + twr * 44.0);
      let glint = step(0.8, twr) * pow(max(sin(time * (0.5 + twr * 0.9) + twr * 91.0), 0.0), 28.0) * 0.9;
      col += vec3f(smoothstep(0.28, 0.0, d)) * (rz - 0.93) * 12.0 * (tw + glint) * horizFade;
    }
    // Constellations: a touch brighter and steadier than the field — NAMED
    // stars, not moons (the first cut drew 1°-wide discs; Rich's screenshot).
    for (var i = 0; i < ${CSTARS.length}; i = i + 1) {
      let cs = CSTARS[i];
      let dd = dot(sray, cs.xyz);
      col += vec3f(0.92, 0.95, 1.0) * (smoothstep(0.9999985, 0.9999995, dd) * 1.25 + pow(max(dd, 0.0), 300000.0) * 0.22) * cs.w * horizFade;
    }
  }

  // ── The sun: hard disc + tight glow + wide haze (disc dims behind cloud) ─
  let sd = dot(ray, su.sunPos.xyz);
  let sunI = su.sunPos.w;
  let sunClear = 0.12 + 0.88 * clear;
  col += su.sunCol.rgb * smoothstep(0.99955, 0.99985, sd) * (1.6 + sunI * 2.2) * sunClear;
  col += su.sunCol.rgb * pow(max(sd, 0.0), 220.0) * 0.55 * sunI * sunClear;
  col += su.sunCol.rgb * pow(max(sd, 0.0), 7.0) * 0.14 * (0.25 + sunI);

  // ── The moon: the antipode, cool, mostly night ──────────────────────────
  let moonA = su.sunCol.w;
  if (moonA > 0.001) {
    let md = dot(ray, -su.sunPos.xyz);
    let moonCol = vec3f(0.86, 0.9, 0.98);
    col += moonCol * smoothstep(0.99975, 0.99991, md) * 1.4 * moonA * sunClear;
    col += moonCol * pow(max(md, 0.0), 300.0) * 0.3 * moonA;
  }

  // ── Composite the decks over everything ──────────────────────────────────
  col = mix(col, cc1, alpha1);
  col = mix(col, cc0, alpha0);

  return vec4f(col, 1.0);
}
`;
/** GPU plumbing for the sky pass — owned by World3d, drawn at the end of
* the opaque pass. */
var Sky3dLayer = class {
	format;
	sampleCount;
	device;
	pipeline;
	buf;
	bind;
	data = /* @__PURE__ */ new Float32Array(48);
	constructor(device, format, sampleCount) {
		this.format = format;
		this.sampleCount = sampleCount;
		this.rebuild(device);
	}
	rebuild(device) {
		this.device = device;
		this.buf = device.createBuffer({
			size: this.data.byteLength,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		const module = shaderModule(device, SKY_WGSL, "sky3d");
		const layout = device.createBindGroupLayout({ entries: [{
			binding: 0,
			visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
			buffer: { type: "uniform" }
		}] });
		this.pipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
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
				format: DEPTH_FORMAT$1,
				depthWriteEnabled: false,
				depthCompare: "less-equal"
			},
			primitive: { topology: "triangle-list" },
			multisample: { count: this.sampleCount }
		});
		this.bind = device.createBindGroup({
			layout,
			entries: [{
				binding: 0,
				resource: { buffer: this.buf }
			}]
		});
	}
	/** Pack + upload this frame's uniforms. */
	write(s, sky, time, fwd, right, up, tanX, tanY) {
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
		const d = this.data;
		d.set([
			fwd[0],
			fwd[1],
			fwd[2],
			tanX
		], 0);
		d.set([
			right[0],
			right[1],
			right[2],
			tanY
		], 4);
		d.set([
			up[0],
			up[1],
			up[2],
			time
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
		this.device.queue.writeBuffer(this.buf, 0, this.data);
	}
	draw(pass) {
		pass.setPipeline(this.pipeline);
		pass.setBindGroup(0, this.bind);
		pass.draw(3);
	}
};
//#endregion
//#region src/lib/water3d.ts
/** Height offset of summed Gerstner waves at (x, z, t) — the CPU replica of
* the vertex shader (sampled at the undisplaced position; the horizontal
* swirl is < steep·amp and irrelevant for floating gameplay). */
function gerstnerY(waves, x, z, t) {
	let y = 0;
	for (const w of waves) {
		const dl = Math.hypot(w.dir.x, w.dir.z) || 1;
		const k = Math.PI * 2 / Math.max(w.len, .001);
		const phase = k * (w.dir.x / dl * x + w.dir.z / dl * z) - k * w.speed * t;
		y += w.amp * Math.sin(phase);
	}
	return y;
}
/** The HORIZONTAL Gerstner displacement at a material point — the GPU VS
* moves each grid vertex sideways by q·amp·cos (crests gather, troughs
* spread; `q = steep/(k·amp·6)`, so amp cancels). heightAt inverts this so
* boats sit on the surface that is VISIBLY at (x, z), not on the height of
* water that has advected somewhere else — at high swell the difference is
* a hull's worth of air (Rich's flying boat). Mirrors the VS exactly except
* the camera-distance fade (gameplay queries are near the camera, fade = 1). */
function gerstnerXZ(waves, x, z, t, ampScale, steepScale, shoal) {
	let dx = 0, dz = 0;
	const norm = steepNorm(waves, steepScale);
	for (const w of waves) {
		if (w.amp * ampScale < 1e-5) continue;
		const dl = Math.hypot(w.dir.x, w.dir.z) || 1;
		const k = Math.PI * 2 / Math.max(w.len, .001);
		const phase = k * (w.dir.x / dl * x + w.dir.z / dl * z) - k * w.speed * t;
		const m = Math.min(1.4, w.steep * steepScale) * norm * shoal / (6 * k) * Math.cos(phase);
		dx += m * (w.dir.x / dl);
		dz += m * (w.dir.z / dl);
	}
	return [dx, dz];
}
/** GERSTNER SELF-INTERSECTION GUARD. When the SUMMED crest steepness climbs
* too high, the horizontal advection makes crest vertices cross past each
* other and the surface folds — inverted, flat, jagged shards riding the
* crests (Rich's teeth: onset at sea-preset swell ≈ 0.68 where Σ ≈ 3.8,
* severe by 0.9 — later traced to water-over-water compositing, fixed by
* the painter's-order grid; this guard stays for TRUE self-intersection).
* Both the GPU packing and the CPU replica scale every wave's steepness by
* this factor, so crests SATURATE instead of folding. Folding needs the sum
* ≈ 6; 4.8 guards pathological custom wave tables while never touching the
* shipped presets (the sea maxes at ≈ 4.5 at swell 1). */
function steepNorm(waves, steepScale) {
	let sum = 0;
	for (const w of waves) {
		if (w.amp < 1e-5) continue;
		sum += Math.min(1.4, w.steep * steepScale);
	}
	return sum > 4.8 ? 4.8 / sum : 1;
}
var W = (dx, dz, amp, len, speed, steep) => ({
	dir: {
		x: dx,
		z: dz
	},
	amp,
	len,
	speed,
	steep
});
var WATER_PRESETS = {
	sea: {
		waves: [
			W(1, .25, .55, 58, 8, .75),
			W(.85, -.45, .36, 37, 6.4, .7),
			W(.4, .9, .26, 24, 5, .65),
			W(-.35, .85, .17, 15, 3.8, .55),
			W(.95, .6, .11, 9, 2.9, .45),
			W(.6, -.9, .06, 5.2, 2.2, .35)
		],
		shallow: "#3fa8c4",
		deep: "#0d4d70",
		foam: "#eaf6f8",
		alpha: .92,
		ripple: .6,
		absorb: .14,
		foamWidth: 2.6
	},
	ocean: {
		waves: [
			W(1, .2, 1.05, 110, 12, .65),
			W(.7, -.55, .6, 64, 9, .6),
			W(.3, 1, .4, 39, 6.8, .5),
			W(-.4, .9, .22, 22, 5, .45),
			W(1, .75, .12, 12, 3.6, .35),
			W(.55, -1, .07, 6.5, 2.6, .3)
		],
		shallow: "#2f88a8",
		deep: "#082f4c",
		foam: "#e8f4f6",
		alpha: .96,
		ripple: .7,
		absorb: .1,
		foamWidth: 3.4
	},
	lake: {
		waves: [
			W(1, .4, .07, 11, 1.6, .3),
			W(-.5, 1, .045, 6.5, 1.1, .25),
			W(.8, -.7, .025, 3.4, .8, .2),
			W(.2, 1, .012, 1.8, .55, .15)
		],
		shallow: "#4c9c8c",
		deep: "#0f3d46",
		foam: "#dfeee8",
		alpha: .9,
		ripple: .35,
		absorb: .22,
		foamWidth: 1.1
	},
	pool: {
		waves: [
			W(1, .2, .02, 3.2, .7, .15),
			W(-.4, 1, .012, 1.7, .5, .1),
			W(.7, -.8, .008, .9, .35, .1),
			W(.1, 1, .004, .5, .25, .1)
		],
		shallow: "#5cc4dc",
		deep: "#1a7898",
		foam: "#f0fafc",
		alpha: .85,
		ripple: .25,
		absorb: .5,
		foamWidth: .5
	},
	stream: {
		waves: [],
		shallow: "#68b8c8",
		deep: "#1e6478",
		foam: "#eef8f8",
		alpha: .82,
		ripple: .5,
		absorb: .6,
		foamWidth: .6
	}
};
var WATER_TINTS = {
	caribbean: {
		shallow: "#46e5cc",
		deep: "#0a6a9e",
		absorb: .06,
		alpha: .86
	},
	azure: {
		shallow: "#3fc0e0",
		deep: "#0b5088",
		absorb: .1,
		alpha: .9
	},
	temperate: {
		shallow: "#3fa8c4",
		deep: "#0d4d70",
		absorb: .14,
		alpha: .92
	},
	emerald: {
		shallow: "#4fc9a0",
		deep: "#0c4a44",
		absorb: .2,
		alpha: .92
	},
	northsea: {
		shallow: "#7c8e84",
		deep: "#39464b",
		absorb: .4,
		alpha: .97
	}
};
/**
* A water STRIP along a path: verts are pos(3) + uv(2: u = arc distance,
* v = 0..1 across) + slope(1: 0 flat → 1 vertical, from the path tangent).
* The right vector is horizontal (cross(tangent, up)) so the strip lies
* FLAT on the land; on near-vertical drops it falls back to the path
* frame's binormal so a waterfall face keeps its width.
*/
function ribbonVerts(pts, width, step = 2) {
	const path = new Path3d(pts);
	const len = path.length;
	const n = Math.max(2, Math.ceil(len / step) + 1);
	const rows = [];
	for (let i = 0; i < n; i++) {
		const f = path.frame(i / (n - 1));
		const slope = Math.min(1, Math.abs(f.ty) / Math.max(Math.hypot(f.tx, f.ty, f.tz), 1e-6));
		let rx = f.tz, ry = 0, rz = -f.tx;
		const rl = Math.hypot(rx, ry, rz);
		if (rl < .15) {
			rx = f.bx;
			ry = f.by;
			rz = f.bz;
		} else {
			rx /= rl;
			rz /= rl;
		}
		const hw = width / 2;
		rows.push([
			f.x,
			f.y,
			f.z,
			rx,
			ry,
			rz,
			i / (n - 1) * len,
			slope,
			hw
		]);
	}
	const verts = new Float32Array((n - 1) * 6 * 6);
	let o = 0;
	const emit = (r, side) => {
		verts[o++] = r[0] + r[3] * r[8] * side;
		verts[o++] = r[1] + r[4] * r[8] * side;
		verts[o++] = r[2] + r[5] * r[8] * side;
		verts[o++] = r[6];
		verts[o++] = side * .5 + .5;
		verts[o++] = r[7];
	};
	for (let i = 0; i < n - 1; i++) {
		const a = rows[i], b = rows[i + 1];
		emit(a, -1);
		emit(b, -1);
		emit(a, 1);
		emit(a, 1);
		emit(b, -1);
		emit(b, 1);
	}
	return verts;
}
/** Noise units per texture tile (lattice sizes wrap at TILE·2^octave). */
var RIPPLE_TILE = 16;
var RIP_SEEDS = [
	11,
	73,
	199
];
function ripHash(x, y, per, seed) {
	let xi = x % per;
	if (xi < 0) xi += per;
	let yi = y % per;
	if (yi < 0) yi += per;
	let h = Math.imul(xi, 374761393) + Math.imul(yi, 668265263) + Math.imul(seed, 1442695041) >>> 0;
	h = Math.imul(h ^ h >>> 13, 1274126177) >>> 0;
	return ((h ^ h >>> 16) >>> 0) / 4294967296;
}
function ripNoise(px, py, per, seed) {
	const ix = Math.floor(px), iy = Math.floor(py);
	const fx = px - ix, fy = py - iy;
	const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy);
	const a = ripHash(ix, iy, per, seed), b = ripHash(ix + 1, iy, per, seed);
	const c = ripHash(ix, iy + 1, per, seed), d = ripHash(ix + 1, iy + 1, per, seed);
	return a + (b - a) * ux + (c - a) * uy + (a - b - c + d) * ux * uy;
}
/** The tileable fbm the texture bakes — periodic in both axes with period
* RIPPLE_TILE (pure + deterministic; pinned by the dist tests). */
function rippleFbm(px, py) {
	let s = 0, amp = .5, freq = 1;
	for (let o = 0; o < 3; o++) {
		s += ripNoise(px * freq, py * freq, 16 * freq, RIP_SEEDS[o]) * amp;
		amp *= .5;
		freq *= 2;
	}
	return s;
}
/** Bake the ripple field: size×size rgba8 texels over one tile, row-major.
* RG = gradient (see the header note), B = field value, A = 255. */
function bakeRippleField(size = 512) {
	const E = .12;
	const out = new Uint8Array(size * size * 4);
	const q = (v) => {
		const n = Math.round(v * 255);
		return n < 0 ? 0 : n > 255 ? 255 : n;
	};
	for (let y = 0; y < size; y++) {
		const py = (y + .5) / size * 16;
		for (let x = 0; x < size; x++) {
			const px = (x + .5) / size * 16;
			const f = rippleFbm(px, py);
			const o = (y * size + x) * 4;
			out[o] = q((rippleFbm(px + E, py) - f) / .8 + .5);
			out[o + 1] = q((rippleFbm(px, py + E) - f) / .8 + .5);
			out[o + 2] = q(f);
			out[o + 3] = 255;
		}
	}
	return out;
}
/** A DRY BOX on a grid water — "oi water, stay down": inside the (oriented)
* box the surface is pressed to `floor`, so waves never rise through a
* watertight hull; the dip around it reads as displacement. All fields are
* live — reposition it every frame as the boat moves. Max 4 per water.
* `heightAt` ignores wells (hulls ride the undisturbed wave). */
var WaterWell = class {
	x;
	z;
	yaw;
	w;
	d;
	floor;
	feather;
	wake;
	dead = false;
	constructor(o = {}) {
		this.x = o.x ?? 0;
		this.z = o.z ?? 0;
		this.yaw = o.yaw ?? 0;
		this.w = o.w ?? 4;
		this.d = o.d ?? 8;
		this.floor = o.floor ?? -1e3;
		this.feather = o.feather ?? 1.5;
		this.wake = Math.min(1, Math.max(0, o.wake ?? .7));
	}
	kill() {
		this.dead = true;
	}
};
/** Returned by world.water() — fields are live where noted. */
var Water3d = class {
	kind;
	preset;
	level;
	x;
	z;
	w;
	d;
	waves;
	shallow;
	deep;
	foam;
	alpha;
	ripple;
	absorb;
	foamWidth;
	flow;
	swell;
	tide;
	tidePeriod;
	width;
	path;
	/** Ground height fn (baked once — see WaterOptions.ground). */
	ground;
	dead = false;
	/** @internal engine time at the last prepare — heightAt uses it. */
	timeNow = 0;
	/** Debug views (live): 0 off · 1 shoal factor (red = damped, green = full)
	* · 2 flat after the underside branch · 3 base optical colour · 4 after
	* env/glint lighting · 5 after foam. Staged returns isolate which stage
	* paints an artifact. */
	debug = 0;
	/** Active dry boxes (see WaterWell) — packed each frame, max 4. */
	wells = [];
	/** Add a DRY BOX (boat hull) to this water: inside it the surface is
	* pressed below the hull so waves never rise through the deck. Returns the
	* live handle — move it with the boat every frame. */
	well(opts = {}) {
		const wl = new WaterWell(opts);
		this.wells = this.wells.filter((x) => !x.dead);
		if (this.wells.length >= 4) this.wells.shift();
		this.wells.push(wl);
		return wl;
	}
	/** @internal ribbon vertex data (built once). */
	ribbon;
	constructor(o = {}) {
		const preset = WATER_PRESETS[o.preset ?? (o.path ? "stream" : "sea")] ?? WATER_PRESETS.sea;
		this.preset = preset;
		this.kind = o.path ? "ribbon" : "grid";
		this.level = o.level ?? 0;
		this.x = o.x ?? 0;
		this.z = o.z ?? 0;
		this.w = o.w ?? 2400;
		this.d = o.d ?? 2400;
		this.waves = o.waves ?? preset.waves.map((w) => ({
			...w,
			dir: { ...w.dir }
		}));
		this.shallow = o.shallow ?? preset.shallow;
		this.deep = o.deep ?? preset.deep;
		this.foam = o.foam ?? preset.foam;
		this.alpha = o.alpha ?? preset.alpha;
		this.ripple = o.ripple ?? preset.ripple;
		this.absorb = o.absorb ?? preset.absorb;
		this.foamWidth = o.foamWidth ?? preset.foamWidth;
		this.flow = o.flow ?? 4;
		this.swell = o.swell ?? .5;
		this.tide = o.tide ?? 0;
		this.tidePeriod = o.tidePeriod ?? 45;
		this.width = o.width ?? 3;
		this.path = o.path;
		this.ground = o.ground;
		if (o.path) this.ribbon = ribbonVerts(o.path, this.width);
		if (o.tint) this.setTint(o.tint);
	}
	/** Swap the sea colour live: 'caribbean' | 'azure' | 'temperate' |
	* 'emerald' | 'northsea' (palette + optical depth together). */
	setTint(name) {
		const t = WATER_TINTS[name];
		if (!t) return;
		this.shallow = t.shallow;
		this.deep = t.deep;
		this.absorb = t.absorb;
		this.alpha = t.alpha;
	}
	/** @internal Sea-state multipliers: swell 0.5 = the preset as authored,
	* 1 = a real STORM (triple height, faster, sharper — s + 2s² is 1 at
	* 0.5 and 3 at 1; the linear 2s ceiling could never read ferocious). */
	waveScale() {
		const s = Math.min(1, Math.max(0, this.swell));
		return {
			amp: s + 2 * s * s,
			steep: .7 + s * .6,
			speed: .82 + s * .36
		};
	}
	/** @internal The tide-shifted waterline right now. */
	levelNow() {
		if (this.tide <= 0) return this.level;
		return this.level + Math.sin(this.timeNow * Math.PI * 2 / Math.max(this.tidePeriod, 1)) * this.tide * .5;
	}
	/** Surface height at (x, z) RIGHT NOW — the exact wave the GPU draws:
	* swell, tide AND (when `ground` is set) the same SHOALING damp the
	* shader applies, so a hull sampled here never clips the rendered
	* surface anywhere, beach shallows included. Boats: sample it at bow/
	* stern/port/starboard for height + pitch + roll. Ribbons return the
	* still level (streams are shallow decoration, not swim volumes). */
	heightAt(x, z) {
		if (this.kind === "ribbon") return this.level;
		const s = this.waveScale();
		const t = this.timeNow * s.speed;
		const shoalAt = (mx, mz) => {
			if (!this.ground) return 1;
			let ampSum = 0;
			for (const wv of this.waves) ampSum += wv.amp * s.amp;
			const depth = this.levelNow() - this.ground(mx, mz);
			const ramp = Math.max(ampSum * 1.2, 1.8);
			const k = Math.min(1, Math.max(0, (depth - .22) / (ramp - .22)));
			return k * k * (3 - 2 * k);
		};
		let sx = x, sz = z;
		for (let i = 0; i < 2; i++) {
			const [dx, dz] = gerstnerXZ(this.waves, sx, sz, t, s.amp, s.steep, shoalAt(sx, sz));
			sx = x - dx;
			sz = z - dz;
		}
		return this.levelNow() + gerstnerY(this.waves, sx, sz, t) * s.amp * shoalAt(sx, sz);
	}
	kill() {
		this.dead = true;
	}
};
var WP_FLOATS = 128;
var GRID_FINE = 288;
var GRID_COARSE = 96;
var GRID_SPLIT = 900;
function waterWGSL(ms) {
	return `
struct U {
  viewProj: mat4x4f,
  camPos: vec4f,
  fogColor: vec4f,
  params: vec4f,        // fogNear, fogFar, fogOn, time
  lightDir: vec4f,
  right: vec4f,
  up: vec4f,
  ambSky: vec4f,        // rgb + env strength
  ambGround: vec4f,
  sunCol: vec4f,        // rgb + intensity
}
struct WP {
  info: vec4f,     // centerX, centerZ, sizeW, sizeD
  info2: vec4f,    // level, alpha, ripple, absorb
  shallowC: vec4f, // rgb + foamWidth
  deepC: vec4f,    // rgb + crest threshold
  foamC: vec4f,    // rgb + mode (0 grid, 1 ribbon)
  proj: vec4f,     // projA, projB, screenW, screenH
  flowP: vec4f,    // flow, ampSum, crestGate, groundTexSize (0 = no ground)
  dbg: vec4f,      // x: debug view (0 off, 1 shoal, 2-5 staged), y: grid RES
  wells: array<vec4f, 8>,  // 4 wells x2: (x, z, yaw, floorY), (halfW, halfD, feather, on)
  waves: array<vec4f, 16>, // per wave: (dirx, dirz, amp, len), (speed, steep, 0, 0)
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var<uniform> wp: WP;
@group(0) @binding(2) var samp: sampler;
@group(0) @binding(3) var envTex: texture_2d<f32>;
@group(0) @binding(4) ${ms ? "var depthTex: texture_depth_multisampled_2d;" : "var depthTex: texture_depth_2d;"}
@group(0) @binding(5) var groundTex: texture_2d<f32>;   // r32float baked terrain heights
@group(0) @binding(6) var rippleTex: texture_2d<f32>;   // baked tileable ripple field (see ripTap)
@group(0) @binding(7) var rippleSamp: sampler;          // repeat + mipped
@group(0) @binding(8) var foamTex: texture_2d<f32>;     // camera-following foam stamp buffer
@group(0) @binding(9) var foamSamp: sampler;            // clamp + linear

// CLUSTERED LIGHTS (group 1, shared with the mesh pipeline) — so point and
// SPOT lights (a lighthouse beam, a boat's lamp) actually land on the water,
// not just the sun. Same froxel lookup + spot-cone attenuation the mesh FS
// uses; lights are in VIEW space, so the surface normal is taken there too.
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

fn clusterWater(world: vec3f, fragXY: vec2f, n: vec3f, v: vec3f, base: vec3f) -> vec3f {
  var sum = vec3f(0.0);
  if (lu.params.x < 0.5) { return sum; }
  let vpos = (lu.view * vec4f(world, 1.0)).xyz;
  let vz = -vpos.z;
  if (vz <= 0.0) { return sum; }
  let nv = normalize((lu.view * vec4f(n, 0.0)).xyz);   // world normal → view space
  let vv = normalize((lu.view * vec4f(v, 0.0)).xyz);   // view dir → view space (glint)
  let tx = min(u32(fragXY.x / lu.grid.z * lu.grid.x), u32(lu.grid.x) - 1u);
  let ty = min(u32(fragXY.y / lu.grid.w * lu.grid.y), u32(lu.grid.y) - 1u);
  let slice = min(u32(max(log(vz / lu.params.z) / log(lu.params.w / lu.params.z) * lu.params.y, 0.0)), u32(lu.params.y) - 1u);
  let cidx = ((slice * u32(lu.grid.y) + ty) * u32(lu.grid.x) + tx) * 128u;
  let nLights = clusters[cidx];
  for (var i = 0u; i < nLights; i = i + 1u) {
    let li = clusters[cidx + 1u + i];
    let l0 = lights[li * 4u];             // viewPos.xyz + radius
    let l1 = lights[li * 4u + 1u];        // rgb·intensity + isSpot
    let toL = l0.xyz - vpos;
    let dist = length(toL);
    if (dist >= l0.w) { continue; }
    let ld = toL / max(dist, 1e-4);
    let dr = dist / l0.w;
    var atten = (1.0 - dr * dr * dr * dr);
    atten = atten * atten / (dist * dist + 1.0);
    if (l1.w > 0.5) {                     // spot cone
      let l2 = lights[li * 4u + 2u];
      let l3 = lights[li * 4u + 3u];
      atten *= smoothstep(l2.w, l3.x, dot(-ld, l2.xyz));
    }
    let ndl = max(dot(nv, ld), 0.0);
    let hv = normalize(ld + vv);
    let spec = pow(max(dot(nv, hv), 0.0), 260.0) * 3.0;   // a bright searchlight streak
    sum += l1.rgb * atten * (base * ndl + vec3f(spec));
  }
  return sum;
}

// Bilinear ground-height read (r32float is unfilterable — lerp by hand).
fn groundAt(wx: f32, wz: f32) -> f32 {
  let gs = wp.flowP.w;
  let u = clamp((wx - wp.info.x) / wp.info.z + 0.5, 0.0, 1.0) * (gs - 1.0);
  let v = clamp((wz - wp.info.y) / wp.info.w + 0.5, 0.0, 1.0) * (gs - 1.0);
  let fu = floor(u); let fv = floor(v);
  let fx = u - fu; let fy = v - fv;
  let mxi = i32(gs) - 1;
  let ix = i32(fu); let iy = i32(fv);
  let a = textureLoad(groundTex, vec2i(min(ix, mxi), min(iy, mxi)), 0).r;
  let b = textureLoad(groundTex, vec2i(min(ix + 1, mxi), min(iy, mxi)), 0).r;
  let c = textureLoad(groundTex, vec2i(min(ix, mxi), min(iy + 1, mxi)), 0).r;
  let d = textureLoad(groundTex, vec2i(min(ix + 1, mxi), min(iy + 1, mxi)), 0).r;
  return mix(mix(a, b, fx), mix(c, d, fx), fy);
}

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec3f,
  @location(1) normal: vec3f,
  @location(2) uv: vec2f,       // grid: world-scaled ripple uv; ribbon: (arc u, across v)
  @location(3) crest: f32,      // grid: normalised wave lift
  @location(4) slope: f32,      // ribbon: 0 flat -> 1 vertical
  @location(5) fade: f32,       // 1 near the camera -> 0 at the horizon (LOD)
  @location(6) shoalV: f32,     // grid: the wave-damping shoal factor (debug view)
  @location(7) depthV: f32,     // grid: still-water depth from the ground bake (<0 = no bake)
}

// GRID: unit xz -> world, displaced by up to 8 GERSTNER waves.
@vertex
fn vsGrid(@location(0) gIn: vec2f) -> VSOut {
  let t = u.params.w;
  // CAMERA-FOLLOWING TESSELLATION. The radial warp u(0.3 + 2.8u²) packs ~3x
  // more triangles into the grid's middle — and the middle now FOLLOWS THE
  // CAMERA (clamped into the body rect, snapped to the finest cell so verts
  // don't swim), so density lives wherever the viewer actually is. When it
  // was pinned to the body's centre, a big sea left the play area on ~30-unit
  // cells: coarser than half the preset wavelengths, and the aliased false
  // crests read as jagged teeth at grazing views (Rich's around-the-island
  // report). Every world-anchored input (waves, shoal ground, uv, foam) is
  // evaluated at the vertex's world position, so WHERE the vertices sit is
  // pure sampling density — the surface itself doesn't move.
  let span = vec2f(wp.info.z, wp.info.w);
  let lo = vec2f(wp.info.x, wp.info.y) - span * 0.5;
  let hi = vec2f(wp.info.x, wp.info.y) + span * 0.5;
  let resG = max(wp.dbg.y, 32.0);                   // this body's grid resolution
  let cell0 = span * (0.3 / resG);                  // finest (centre) cell
  let ctr = floor(clamp(u.camPos.xz, lo, hi) / cell0) * cell0;
  let g = gIn * (vec2f(0.3) + 2.8 * gIn * gIn);
  let pxz = clamp(ctr + g * span, lo, hi);
  var p = vec3f(pxz.x, wp.info2.x, pxz.y);
  // Local cell size (the warp's derivative): each wave fades out BEFORE its
  // wavelength falls under what these cells can represent — an unrepresentable
  // wave is pure aliasing spikes, never shape.
  let cellV = (vec2f(0.3) + 8.4 * gIn * gIn) * (span / resG);
  let cellW = max(cellV.x, cellV.y);
  // SHOALING: waves flatten as the water gets shallow (and a trough can
  // never dive under a flat beach and depth-cull whole quads).
  //
  // WITH BAKED GROUND (flowP.w > 0 — pass terrain.heightAt as 'ground'):
  // exact vertical depth, CAMERA-INDEPENDENT. The swash zone is
  // deterministic: waves damp to EXACTLY zero just before the waterline
  // (a still, tide-driven contour — no animated surface fighting a
  // near-coplanar beach for the depth test), and dry sand parks the
  // sheet firmly below ground. The surf bands + foam + tide sell the
  // run-up. This replaced the depth-buffer estimate on the shore, which
  // flickered with every camera move AND every wave (Rich, twice).
  var shoal = 1.0;
  var dry = -1000.0;
  var bakedDepth = -1.0;
  if (wp.flowP.w > 0.5) {
    let g = groundAt(p.x, p.z);
    bakedDepth = wp.info2.x - g;
    // SHOAL AT THE CELL'S SCALE: distant cells are wide (camera-following
    // warp) — a point-sampled seabed lets adjacent vertices straddle a shelf
    // contour with full-vs-zero amplitude and the sheet TEARS into
    // world-anchored, swell-scaled teeth along the shelf (Rich's circled
    // patch). Average the seabed over the cell footprint (a manual mip) so
    // damping varies at a rate the mesh can express; near the camera the
    // cells are fine, the blend is ~0 and the exact swash behaviour holds.
    let rampW = max(wp.flowP.y * 1.2, 1.8);
    let smoothK = smoothstep(6.0, 24.0, cellW);
    var gd = g;
    // Only pay the 4 extra seabed taps where they can matter: coarse cells
    // NEAR the shallow ramp. Deep open water (the vast majority of a big
    // sea's vertices) skips straight through — this was most of the RES-288
    // vertex bill.
    if (smoothK > 0.001 && (wp.info2.x - g) < rampW * 2.0) {
      gd = mix(g, (g
        + groundAt(p.x + cellW, p.z) + groundAt(p.x - cellW, p.z)
        + groundAt(p.x, p.z + cellW) + groundAt(p.x, p.z - cellW)) * 0.2, smoothK);
    }
    let depth = wp.info2.x - gd;                      // still-water depth (signed; tide included)
    shoal = smoothstep(0.22, rampW, depth);
    dry = g;                                          // shoreline parking stays EXACT
  } else {
    // Fallback (open water / no ground fn): estimate from the frame's
    // depth buffer. OCCLUSION IS NOT SHALLOWNESS: geometry well in front
    // (> 6 units) means the vertex is merely hidden — keep its waves.
    let clip0 = u.viewProj * vec4f(p, 1.0);
    if (clip0.w > 0.01) {
      let ndc = clip0.xyz / clip0.w;
      if (abs(ndc.x) < 1.0 && abs(ndc.y) < 1.0 && ndc.z > 0.0 && ndc.z < 1.0) {
        let px = vec2i(vec2f(ndc.x * 0.5 + 0.5, 0.5 - ndc.y * 0.5) * wp.proj.zw);
        let sceneD = textureLoad(depthTex, px, 0);
        let sceneZ = wp.proj.y / (wp.proj.x + sceneD);
        let waterZ = wp.proj.y / (wp.proj.x + ndc.z);
        let diff = sceneZ - waterZ;
        if (diff > -6.0) {
          let along = max(diff, 0.0);
          let toCam = u.camPos.xyz - p;
          let vd = along * clamp(abs(toCam.y) / max(length(toCam), 1e-3), 0.06, 1.0);
          shoal = smoothstep(0.05, max(wp.flowP.y * 1.2, 1.6), vd + 0.25);
        }
      }
    }
  }
  // HORIZON LOD: waves fade OUT with camera distance — a far swell is
  // subpixel, perspective says the horizon line is FLAT, and every unit of
  // amplitude out there is wasted silhouette wobble + shading cost.
  let camD = distance(u.camPos.xyz, p);
  let fade = 1.0 - smoothstep(700.0, 2400.0, camD);
  var nrm = vec3f(0.0, 1.0, 0.0);
  var lift = 0.0;
  for (var i = 0; i < 8; i = i + 1) {
    let wa = wp.waves[i * 2];
    let wb = wp.waves[i * 2 + 1];
    if (wa.z < 1e-5) { continue; }
    let d = normalize(vec2f(wa.x, wa.y) + vec2f(1e-6));
    let k = 6.2831853 / max(wa.w, 1e-3);
    let ph = k * dot(d, vec2f(p.x, p.z)) - k * wb.x * t;
    let s = sin(ph); let c = cos(ph);
    // Nyquist guards. Amplitude: full while a wavelength spans 3+ cells,
    // gone by 2 (below that, sampling turns the wave into spikes, not shape).
    // SHARPNESS dies much earlier: the trochoidal term displaces vertices
    // SIDEWAYS by up to half a cell at coarse sampling, shearing quads into
    // the pale jagged shards that ride the crests at high swell (Rich's
    // teeth). A big ROUNDED swell reads fine on 3 samples; a sharpened one
    // needs 8+. Near the camera cells are fine and crests stay razor.
    let cl = cellW / max(wa.w, 1e-3);
    let rep = 1.0 - smoothstep(0.3, 0.55, cl);
    let srep = 1.0 - smoothstep(0.12, 0.3, cl);
    let amp = wa.z * shoal * fade * rep;
    let sharp = wb.y * srep;
    let q = sharp / (k * wa.z * 6.0);
    p.x += q * amp * d.x * c;
    p.z += q * amp * d.y * c;
    p.y += amp * s;
    lift += amp * s;
    // Analytic normal accumulation (standard Gerstner derivatives).
    nrm.x -= d.x * amp * k * c;
    nrm.z -= d.y * amp * k * c;
    nrm.y -= sharp * amp * k * s / 6.0;
  }
  // DRY SAND: where the ground rises above the (tide-shifted) waterline
  // the sheet SINKS CONTINUOUSLY below it — from at-level at the line to
  // 0.6 under by +0.6 of ground rise. A binary park (the first cut)
  // snapped whole triangles in and out as the tide crossed each VERTEX's
  // ground height — Rich's 'waves filling in chunk by chunk'. This field
  // is continuous in world space, so the waterline glides.
  if (dry > -999.0) {
    let above = dry - wp.info2.x;
    if (above > 0.0) {
      p.y = min(p.y, mix(wp.info2.x, dry - 0.6, smoothstep(0.0, 0.6, above)));
    }
  }
  // WATER WELLS: dry oriented boxes (boat hulls) — the surface is pressed
  // down to the well's floor inside, feathered outside, so waves can never
  // rise through a watertight hull; the resulting dip around the hull reads
  // as displacement. Gameplay heightAt intentionally IGNORES wells: hulls
  // ride the undisturbed wave.
  for (var wi = 0; wi < 4; wi = wi + 1) {
    let wA = wp.wells[wi * 2];
    let wB = wp.wells[wi * 2 + 1];
    if (wB.w < 0.5) { continue; }
    let cy = cos(wA.z); let sy = sin(wA.z);
    let dw = vec2f(p.x - wA.x, p.z - wA.y);
    let lx = abs(cy * dw.x - sy * dw.y);
    let lz = abs(sy * dw.x + cy * dw.y);
    let fe = max(wB.z, 1e-3);
    let k = (1.0 - smoothstep(wB.x, wB.x + fe, lx)) * (1.0 - smoothstep(wB.y, wB.y + fe, lz));
    p.y = mix(p.y, min(p.y, wA.w), k);
  }
  var out: VSOut;
  out.world = p;
  out.pos = u.viewProj * vec4f(p, 1.0);
  out.normal = normalize(nrm);
  out.uv = p.xz * 0.22;
  out.crest = lift / max(wp.flowP.y, 1e-4);
  out.slope = 0.0;
  out.fade = fade;
  out.shoalV = shoal;
  out.depthV = bakedDepth;
  return out;
}

// RIBBON: baked strip; uv.x is arc distance, slope is a vertex fact.
@vertex
fn vsRibbon(@location(0) pos: vec3f, @location(1) uv: vec2f, @location(2) slope: f32) -> VSOut {
  let t = u.params.w;
  var p = pos;
  // A whisper of bob so still sections aren't glass.
  p.y += sin(uv.x * 1.7 - t * wp.flowP.x * 0.8) * 0.03;
  var out: VSOut;
  out.world = p;
  out.pos = u.viewProj * vec4f(p, 1.0);
  out.normal = vec3f(0.0, 1.0, 0.0);
  out.uv = uv;
  out.crest = 0.0;
  out.slope = slope;
  out.fade = 1.0;
  out.shoalV = 1.0;
  out.depthV = -1.0;
  return out;
}

// The ripple/foam noise is a BAKED tileable texture (bakeRippleField below —
// the same once-only recipe as the underwater caustics). The fbm loops that
// used to run here 7-8x per fragment (ripple gradient x6, foam, streaks) were
// most of the water's frame cost. RG = the field's forward-difference gradient
// at the original e = 0.12 step (decode: (rg - 0.5) * 0.8), B = the field
// itself. The tile spans RIPPLE_TILE noise units; implicit-LOD sampling means
// far water flattens through the mip chain automatically instead of fizzing.
fn ripTap(p: vec2f, bias: f32) -> vec4f {
  return textureSampleBias(rippleTex, rippleSamp, p * 0.0625, bias);  // p / RIPPLE_TILE
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let t = u.params.w;
  let ribbon = wp.foamC.w > 0.5;
  // DEBUG VIEW (water.debug = true): paint the wave-damping shoal factor,
  // red = damped/shallow -> green = full waves. Artifacts that trace the
  // red/green contour are shoal-boundary problems, not wave problems.
  // (Uniform branch — the implicit-LOD taps below stay in uniform flow.)
  if (wp.dbg.x > 0.5 && wp.dbg.x < 1.5) {
    return vec4f(mix(vec3f(0.9, 0.1, 0.1), vec3f(0.1, 0.8, 0.2), in.shoalV), 1.0);
  }

  // ── Detail ripple normals: two counter-scrolled noise fields ────────────
  var ruv = in.uv;
  var flowT = vec2f(t * 0.06, t * 0.045);
  if (ribbon) {
    // Streams: uv space is (along, across) — scroll DOWNSTREAM, stretched.
    // The scroll speed must be CONSTANT along the strip: a slope-varying
    // speed inside the phase shears the pattern by t x d(speed)/du without
    // bound, and patches of the stream visibly ran BACKWARDS (Rich's
    // screenshot). Slope shows through foam amount instead.
    ruv = vec2f(in.uv.x * 0.55 - t * wp.flowP.x * 0.6, in.uv.y * 2.6);
    flowT = vec2f(0.0);
  }
  // FRAGMENT LOD: the detail fades with the same horizon factor as the waves
  // — far water is a flat reflector. Two taps of the baked gradient replace
  // the old 6 fbm loops (which were most of the water's frame cost); the mip
  // chain handles the far-field flattening the hard branches used to.
  let rip = wp.info2.z * (0.25 + 0.75 * in.fade);
  // Gradient taps ride one mip SHARPER (bias -1): the box-filtered mips kill
  // ripple detail a band too early, and mid-range water without ripple shows
  // the raw interpolated Gerstner normals as flat panels.
  let rT0 = ripTap(ruv + flowT, -1.0);
  let rT1 = ripTap(ruv * 1.7 - flowT * 1.3 + vec2f(51.0), -1.0);
  // The second, finer field only close-in (it is subpixel past mid-range).
  var dn = (rT0.rg - 0.5) * 0.8
         + (rT1.rg - 0.5) * 0.8 * smoothstep(0.3, 0.45, in.fade);
  dn *= smoothstep(0.0, 0.06, in.fade);
  // Foam + streak fields (B channel), sampled HERE: implicit-LOD taps must
  // stay in uniform control flow, and the underside branch below returns
  // non-uniformly.
  let foamN = ripTap(in.uv * 5.0 + vec2f(t * 0.14, -t * 0.1), 0.0).b;
  let streakN = ripTap(vec2f(in.uv.x * 0.8 - t * wp.flowP.x * 0.85, in.uv.y * 5.0), 0.0).b;
  // Specular sanity at distance: where a pixel covers a wide patch of water
  // (big ruv footprint) the ripple detail is sub-pixel, and a 340-power sun
  // lobe on the smooth interpolated normal paints whole far triangles solid
  // white. Fade the glint with the footprint — far water keeps the broad
  // env sheen, loses the razor sparkle. (fwidth needs uniform control flow —
  // compute here, before the underside branch's early return.)
  let glintK = 1.0 / (1.0 + dot(fwidth(ruv), vec2f(1.0)) * 3.0);
  // GERSTNER NORMAL GUARD: at storm swell the analytic normal on steep crest
  // backs collapses toward (or past) horizontal; interpolated across the big
  // warped far triangles, that slams the fresnel term to its ceiling and
  // paints whole triangles flat sky-grey (Rich's screenshot). Water the
  // camera can see keeps a decidedly upward normal.
  var gN = in.normal;
  gN.y = max(gN.y, 0.35);
  var n = normalize(gN + vec3f(dn.x * rip * 2.2, 0.0, dn.y * rip * 2.2));

  // ── SURFACE FROM BELOW — Snell's window ─────────────────────────────────
  // Seen from underneath, the whole sky compresses into a ~97° cone overhead
  // (critical angle 48.6°, n=1.333); outside it, total internal reflection
  // shows a dim mirror of the murk, Fresnel-brightening toward the rim. Same
  // rippled normal + vertex displacement as the top face (drawn double-sided,
  // cullMode:'none'), so the crossing has no crack, and the window edge
  // dances with the ripples. GATE ON CAMERA BELOW THE STILL-WATER LEVEL — a
  // per-water constant. NOT the rippled normal (facets tilting away from an
  // above-water camera painted grey TIR patches), and NOT the displaced
  // fragment height (at high swell, distant CRESTS rise above a low camera's
  // eye and their fragments flipped underside: jagged bright teeth mid-sea
  // and a broken horizon line — Rich's screenshots, both).
  if (!ribbon && u.camPos.y < wp.info2.x) {
    let vb = normalize(u.camPos.xyz - in.world);
    let nvb = dot(n, vb);
    {
      // Surface foam (wakes, shore froth) reads from BELOW as white patches
      // on the ceiling — sample the stamp buffer here too.
      let fuvU = (in.world.xz - vec2f(wp.dbg.z, wp.dbg.w)) / 360.0 + 0.5;
      let inbU = step(0.0, fuvU.x) * step(fuvU.x, 1.0) * step(0.0, fuvU.y) * step(fuvU.y, 1.0);
      let foamU = smoothstep(0.05, 0.8, textureSampleLevel(foamTex, foamSamp, fuvU, 0.0).r * inbU);
      let ci = clamp(-nvb, 0.0, 1.0);         // 1 = straight up → 0 = grazing
      let r = refract(-vb, -n, 1.333);        // water → air; vec3(0) marks TIR
      // The TIR mirror must be ALIVE and LUMINOUS. Two dead-ceiling traps:
      // (1) tinting by the fog colour rendered it as dark murk-slab — the
      // ceiling is lit by TRANSMITTED SKYLIGHT, so lift the fog tint toward
      // white (sqrt is a cheap hue-preserving brighten); (2) the implicit-LOD
      // ripple tap mips to a flat average at distance — a fixed-level tap
      // keeps the wave pattern rolling all the way out.
      let ripC = textureSampleLevel(rippleTex, rippleSamp, (ruv + flowT) * 0.0625, 1.5).b;
      let bright = sqrt(u.fogColor.rgb);
      let mirror = bright * (0.68 + 0.75 * ripC);
      // ONE COLOUR FAMILY for the whole ceiling. Three generations of
      // "holes in the waves" (crisp clouds through translucency, horizon-
      // white env patches, dark-window blobs at night/temperate — Rich's
      // screenshots) all came from the same root: the window region wore an
      // ENV-derived colour while TIR wore a FOG-derived one, split along
      // the hard ripple-modulated refract() cutoff. Any tint or time of day
      // where the two families differ paints crisp wave-shaped patches.
      // Now the ceiling is ALWAYS the water's own luminous hue; the Snell
      // window ADDS the sky's refracted LUMINANCE (light, not a colour
      // swap), and the rim dissolves over a soft band of the true Snell
      // criterion (sinT crosses 1) instead of the refract() hard edge.
      let sinT = 1.333 * sqrt(max(1.0 - ci * ci, 0.0));
      let windowK = smoothstep(1.12, 0.8, sinT);   // 1 in the window → 0 in TIR
      var skyLum = 0.35;                           // TIR fallback: no refracted ray
      if (dot(r, r) >= 1e-5) {
        var rr = normalize(r);
        // Elevation floor: refraction expands angles, so an unfloored sample
        // lands in the env's horizon band. Mip 3: light, not cloud shapes.
        rr.y = max(rr.y, 0.3);
        let eu = atan2(rr.x, rr.z) / 6.28318530718 + 0.5;
        let ev = 0.5 - asin(clamp(rr.y, -1.0, 1.0)) / 3.14159265;
        let sky = textureSampleLevel(envTex, samp, vec2f(eu, ev), 3.0).rgb;
        skyLum = dot(sky, vec3f(0.3, 0.55, 0.15));
      }
      var col = mirror * (1.0 + windowK * (0.25 + 0.9 * skyLum));
      let hv2 = normalize(vb - u.lightDir.xyz);
      col += u.sunCol.rgb * u.sunCol.w * pow(max(dot(-n, hv2), 0.0), 48.0) * 0.5;
      col = mix(col, u.fogColor.rgb, 0.18);   // green-blue transmitted tint
      // The WHOLE ceiling shimmers with the rolling ripple field — window
      // included. The env-sampled window is a smooth average: without this
      // the region inside the Snell cone rendered as flat glass (raw-sky
      // lookalike), and only the TIR rim carried any wave texture.
      col *= 0.82 + 0.38 * ripC;
      // The WINDOW is genuinely see-through (the real sky/island/ball-top
      // belong there); TIR stays a near-opaque living mirror. The original
      // sun-through-the-surface bug was translucency in the TIR REGIONS —
      // fully opaque everywhere was the overcorrection (Rich: "can't see
      // through the waves").
      // WHAT'S BEHIND this pixel decides the window's transparency. The
      // Snell window used to blend 60% of whatever the framebuffer held —
      // for most of the ceiling that is the RAW SKY DOME, whose crisp
      // unrefracted clouds and full sun disc punched through as cloud-shaped
      // HOLES in the water (Rich circled them). The sky's light belongs on
      // the ceiling only via the env-window colour; but GEOMETRY above the
      // surface (a hull, the ball, the island) should still ghost through.
      // Sky pixels are exactly the ones no solid wrote: scene depth = 1.
      let udims = vec2i(textureDimensions(depthTex));
      let upx = clamp(vec2i(in.pos.xy), vec2i(0), udims - 1);
      let behind = textureLoad(depthTex, upx, 0);
      var ab = 0.95;
      if (behind < 0.99999) {
        ab = mix(0.95, 0.4, windowK);
        // The ripple varies the alpha so the ghost is broken up by the
        // rolling wave pattern instead of showing crisp edges.
        ab = clamp(ab + (ripC - 0.5) * 0.3, 0.35, 0.98);
      }
      col = mix(col, vec3f(0.92, 0.96, 0.97), foamU * 0.75);
      ab = max(ab, foamU * 0.95);             // foam patches are solid
      if (u.params.z > 0.5) {
        let fb = smoothstep(u.params.x, u.params.y, distance(u.camPos.xyz, in.world));
        col = mix(col, u.fogColor.rgb, fb);
      }
      return vec4f(col * ab, ab);
    }
  }
  // dbg 2: flat green AFTER the underside branch — if artifacts survive
  // here they come from that branch (its return above still runs).
  if (wp.dbg.x > 1.5 && wp.dbg.x < 2.5) { return vec4f(0.1, 0.8, 0.2, 1.0); }

  // ── Scene thickness from the opaque depth (soft shoreline) ──────────────
  let px = vec2i(in.pos.xy);
  let sceneD = textureLoad(depthTex, px, 0);
  let sceneZ = wp.proj.y / (wp.proj.x + sceneD);
  let waterZ = wp.proj.y / (wp.proj.x + in.pos.z);
  let thickView = max(sceneZ - waterZ, 0.0);
  // At DISTANCE the depth-buffer thickness is polygon-modulated: the water
  // surface Z interpolates across coarse cells, and over a shallow plain
  // that pumps the optical depth through the shallow ramp in polygon-shaped
  // patches — pale sand-through-water wedges riding the crests, growing with
  // swell, view-dependent (the TRUE root of Rich's teeth; every earlier
  // suspect only dressed them). So the far field blends to the BAKED ground
  // thickness under the displaced surface — smooth and view-independent —
  // while the depth-buffer version stays authoritative near the camera
  // (rock/pier foam collars, exact shoreline dissolve).
  var thick = thickView;
  if (in.depthV >= 0.0) {
    let thickBaked = max(in.world.y - (wp.info2.x - in.depthV), 0.0);
    thick = mix(thickBaked, thickView, glintK);
  }

  // ── Base colour + opacity by optical depth ───────────────────────────────
  let absorb = wp.info2.w;
  let depthK = 1.0 - exp(-thick * absorb);
  var base = mix(wp.shallowC.rgb, wp.deepC.rgb, depthK);
  var alpha = mix(0.3, wp.info2.y, 1.0 - exp(-thick * absorb * 1.7));
  // THE SEAM DISSOLVE factor: at zero thickness the water must vanish,
  // not cut. Applied at the very END — the first cut multiplied it in
  // here, and the foam max() below hoisted alpha right back up to 0.9 at
  // the geometric waterline (Rich's screenshot: a hard line with lovely
  // surf strictly below it).
  let edge = smoothstep(0.0, 0.45, thick);
  if (ribbon) {
    base = mix(wp.shallowC.rgb, wp.deepC.rgb, 0.45);
    alpha = wp.info2.y * (0.55 + 0.45 * in.slope);
    // Feathered strip edges.
    alpha *= smoothstep(0.0, 0.16, in.uv.y) * smoothstep(1.0, 0.84, in.uv.y);
  }

  // dbg 3: the raw optical-depth colour, no lighting.
  if (wp.dbg.x > 2.5 && wp.dbg.x < 3.5) { return vec4f(base, 1.0); }

  // ── Lighting: hemisphere-ish ambient + sun + env fresnel + glint ─────────
  let v = normalize(u.camPos.xyz - in.world);
  // FAR-FIELD SHADING NORMAL for the view-razor terms (fresnel + glint).
  // The vertex normal is polygon-quantised at coarse cells, and pow(1-NV, 5)
  // is a razor: its knee traced the triangle edges as hard pale sky-mirror
  // shards riding the far crests, growing with swell — Rich's teeth, the
  // FINAL form (staged-debug stage 4 lit them up). So the far field takes
  // its normal from the baked ripple field sampled PER-PIXEL at swell scale
  // — smooth wave-like variation with no polygons in it — and blends toward
  // the true geometric normal as cells refine near the camera.
  let farT = ripTap(in.world.xz * 0.021 + flowT * 2.0, 0.0);
  let farN = normalize(vec3f((farT.r - 0.5) * 1.1, 1.0, (farT.g - 0.5) * 1.1));
  // glintK² — the handoff must collapse FAST: at the mid band the vertex
  // normal still carried ~40% at plain glintK and its polygon pattern bled
  // through the fresnel knee as faint shards.
  let nS = normalize(mix(farN, n, glintK * glintK));
  let NV = max(dot(nS, v), 1e-3);
  let ambient = mix(u.ambGround.rgb, u.ambSky.rgb, 0.85) * u.fogColor.a;
  // Diffuse rides nS too — vertex-normal diffuse re-drew the polygon edges
  // as a sawtooth light/dark boundary on the far wave slopes.
  var rgb = base * (ambient + u.sunCol.rgb * u.sunCol.w * max(dot(nS, -u.lightDir.xyz), 0.0) * 0.55);
  // Fresnel env reflection: the water reflects the SKY the world lights by.
  if (u.ambSky.w > 0.001) {
    var R = reflect(-v, nS);
    // Rippled normals push grazing reflections BELOW the horizon — that
    // samples the env's dark ground half and paints black patches on the
    // surface (Rich's screenshot). Water reflects sky: clamp to it.
    R.y = max(R.y, 0.035);
    let eu = atan2(R.x, R.z) / 6.28318530718 + 0.5;
    let ev = 0.5 - asin(clamp(R.y, -1.0, 1.0)) / 3.14159265;
    let env = textureSampleLevel(envTex, samp, vec2f(eu, ev), 1.0).rgb;
    let F = 0.02 + 0.98 * pow(1.0 - NV, 5.0);
    rgb = mix(rgb, env * u.ambSky.w, clamp(F * 2.4, 0.0, 0.75));
    alpha = min(alpha + F * 0.5, 1.0);
  }
  // Sun glint: tight blinn lobe off the rippled normal, footprint-faded
  // (glintK) so it never paints flat far triangles solid.
  let hv = normalize(v - u.lightDir.xyz);
  rgb += u.sunCol.rgb * u.sunCol.w * pow(max(dot(nS, hv), 0.0), 340.0) * 2.4 * glintK;
  // Dynamic point/spot lights (lighthouse beam, lamps) land on the surface.
  rgb += clusterWater(in.world, in.pos.xy, n, v, base);
  // dbg 4: lit colour before foam.
  if (wp.dbg.x > 3.5 && wp.dbg.x < 4.5) { return vec4f(rgb, 1.0); }

  // ── Foam (foamN/streakN were sampled up top, before the underside gate) ──
  var foam = 0.0;
  if (!ribbon && in.fade > 0.04) {
    // Shore band: thin water + an animated waterline wobble.
    let fw = wp.shallowC.w;
    // The waterline is wobbled by the NOISE FIELD only — a sine plane-wave
    // here (however small) is coherent across the whole bay and reads as
    // diagonal corduroy through every wide foam band.
    let shore = 1.0 - smoothstep(0.0, fw, thick + (foamN - 0.5) * fw * 0.9);
    // Crest whitecaps: high lift + noise gate — GATED by absolute wave
    // height (flowP.z): a pond's 5 cm ripples must never foam like surf.
    // FOOTPRINT-FADED (glintK, same as the sun glint): in.crest interpolates
    // across whole coarse mid-distance triangles and the steep threshold
    // then paints them as hard-edged white shards riding the crests — THE
    // teeth. Whitecaps are near-field detail; the far sea reads through the
    // env sheen instead.
    let crest = smoothstep(wp.deepC.w, wp.deepC.w + 0.35, in.crest) * smoothstep(0.45, 0.72, foamN) * wp.flowP.z * glintK;
    // SURF: breaker fronts MARCHING up the shallows. Phase rides the still-
    // water DEPTH — contours are shore-parallel by definition, so the fronts
    // follow any coastline shape, and advancing the phase with time walks
    // each band toward thinner water: successive breakers running in. Ride
    // the BAKED ground depth (smooth, camera-independent) when the water has
    // one: the first cut rode the depth-buffer thickness, which at grazing
    // distance is aliased and wave-modulated — fract() of that noise sprayed
    // jagged white shards over the shallows, riding the crests and growing
    // with swell (Rich's teeth, the whole saga). The view thickness remains
    // the fallback for bakeless waters (and still drives shore/collar foam).
    let surfLen = fw * 2.8;
    // Phase rides the BAKED still depth: contours are shore-parallel by
    // definition, camera-independent, wave-independent. (The diagonal
    // stripes once blamed on this were the waterline wobble above.)
    let sd = select(thick, max(in.depthV, 0.0), in.depthV >= 0.0);
    var surf = 0.0;
    if (sd < surfLen * 2.4) {
      let ph = fract(sd / surfLen + t * 0.2 + (foamN - 0.5) * 0.35);
      // NARROW leading edge with CLEAR water between bands — breaker
      // lines, not froth (the first cut foamed the whole shallows over).
      let band = smoothstep(0.8, 0.94, ph) * smoothstep(1.0, 0.97, ph);
      surf = band * smoothstep(0.42, 0.68, foamN)
        * (1.0 - sd / (surfLen * 2.4))
        * (0.3 + 0.7 * wp.flowP.z) * 0.85;
    }
    foam = max(max(shore * 0.9, crest * 0.8), surf);
    // HULL FOAM (wake + collar): read the camera-following FOAM STAMP buffer
    // — wells stamp it every frame and it decays + diffuses over time, so
    // wakes CURVE with the boat's real path and fade like froth, and the
    // waterline ring hugs the hull per-pixel (the first cut evaluated the
    // ring per-VERTEX and it smeared across whole cells, and drew the wake
    // as a heading-locked streak that rotated with the boat — both wrong).
    let fuvL = (in.world.xz - vec2f(wp.dbg.z, wp.dbg.w)) / 360.0 + 0.5;
    let inb = step(0.0, fuvL.x) * step(fuvL.x, 1.0) * step(0.0, fuvL.y) * step(fuvL.y, 1.0);
    let stampF = textureSampleLevel(foamTex, foamSamp, fuvL, 0.0).r * inb;
    foam = max(foam, smoothstep(0.05, 0.85, stampF) * (0.35 + 0.65 * smoothstep(0.28, 0.6, foamN + stampF * 0.25)));
  } else if (ribbon) {
    // Streams: white water grows with SLOPE (the waterfall look), plus
    // lacy edges and flow streaks.
    let streak = streakN;
    let edges = 1.0 - smoothstep(0.05, 0.3, min(in.uv.y, 1.0 - in.uv.y));
    foam = clamp(in.slope * 1.6 * smoothstep(0.3, 0.75, streak) + edges * 0.4 * smoothstep(0.4, 0.7, streak), 0.0, 1.0);
  }
  rgb = mix(rgb, wp.foamC.rgb * (0.35 + ambient * 0.9 + u.sunCol.w * 0.5), foam);
  alpha = max(alpha, foam * 0.9);
  // dbg 5: after foam.
  if (wp.dbg.x > 4.5 && wp.dbg.x < 5.5) { return vec4f(rgb, 1.0); }
  // ...and only NOW the seam dissolve, so the foam sheet itself feathers
  // into the sand instead of ending on the depth-test cut.
  if (!ribbon) { alpha *= edge; }

  // ── Fog (the same law as everything else) ────────────────────────────────
  if (u.params.z > 0.5) {
    let f = smoothstep(u.params.x, u.params.y, distance(u.camPos.xyz, in.world));
    rgb = mix(rgb, u.fogColor.rgb, f);
  }
  return vec4f(rgb * alpha, alpha);
}
`;
}
var FOAM_RES = 512;
var FOAM_SPAN = 360;
var FOAM_WGSL = `
struct FU {
  shift: vec4f,                 // uv shift.xy, decay factor, texel size (uv)
  stamps: array<vec4f, 8>,      // 4 stamps x2: (u, v, yaw, intensity), (halfU, halfV, 0, 0)
}
@group(0) @binding(0) var<uniform> fu: FU;
@group(0) @binding(1) var src: texture_2d<f32>;
@group(0) @binding(2) var samp: sampler;

struct VSOut { @builtin(position) pos: vec4f, @location(0) uv: vec2f }

@vertex
fn vsFull(@builtin(vertex_index) vi: u32) -> VSOut {
  var out: VSOut;
  let x = f32((vi << 1u) & 2u);
  let y = f32(vi & 2u);
  out.pos = vec4f(x * 2.0 - 1.0, 1.0 - y * 2.0, 0.0, 1.0);
  out.uv = vec2f(x, y);
  return out;
}

@fragment
fn fsDecay(in: VSOut) -> @location(0) vec4f {
  let uv = in.uv + fu.shift.xy;
  let o = fu.shift.w * 2.6;
  // Centre + cross taps: the froth SPREADS a little as it fades.
  var v = textureSampleLevel(src, samp, uv, 0.0).r * 0.44
    + (textureSampleLevel(src, samp, uv + vec2f(o, 0.0), 0.0).r
     + textureSampleLevel(src, samp, uv - vec2f(o, 0.0), 0.0).r
     + textureSampleLevel(src, samp, uv + vec2f(0.0, o), 0.0).r
     + textureSampleLevel(src, samp, uv - vec2f(0.0, o), 0.0).r) * 0.14;
  let inb = step(0.0, uv.x) * step(uv.x, 1.0) * step(0.0, uv.y) * step(uv.y, 1.0);
  return vec4f(v * fu.shift.z * inb, 0.0, 0.0, 1.0);
}

struct SOut { @builtin(position) pos: vec4f, @location(0) local: vec2f, @location(1) inten: f32 }

@vertex
fn vsStamp(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> SOut {
  let a = fu.stamps[ii * 2u];
  let b = fu.stamps[ii * 2u + 1u];
  // Two triangles over the unit quad.
  var corner = array<vec2f, 6>(
    vec2f(-1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, -1.0),
    vec2f(1.0, -1.0), vec2f(-1.0, 1.0), vec2f(1.0, 1.0),
  )[vi];
  let cy = cos(a.z); let sy = sin(a.z);
  let ext = corner * vec2f(b.x, b.y);
  let uv = vec2f(a.x + cy * ext.x + sy * ext.y, a.y - sy * ext.x + cy * ext.y);
  var out: SOut;
  out.pos = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, 0.0, 1.0);
  out.local = corner;
  out.inten = a.w;
  return out;
}

@fragment
fn fsStamp(in: SOut) -> @location(0) vec4f {
  let d = length(in.local);
  return vec4f(smoothstep(1.0, 0.5, d) * in.inten, 0.0, 0.0, 1.0);
}
`;
/** GPU plumbing for every water in the world — owned by World3d, drawn at
* the head of the translucent pass (after blob shadows, under particles). */
var Water3dLayer = class {
	format;
	sampleCount;
	lightsLayout;
	device;
	gridPipeline;
	ribbonPipeline;
	layout;
	gridVbuf;
	gridVerts = 0;
	gridVbufCoarse;
	gridVertsCoarse = 0;
	gpu = /* @__PURE__ */ new Map();
	depthView = null;
	envView = null;
	dummyGround;
	rippleView;
	rippleSamp;
	foamTex;
	foamView;
	foamTmp;
	foamTmpView;
	foamSamp;
	foamDecayPipe;
	foamStampPipe;
	foamUBO;
	foamBind;
	foamData = /* @__PURE__ */ new Float32Array(36);
	foamOrigin = [1e9, 1e9];
	wellPrev = /* @__PURE__ */ new WeakMap();
	data = new Float32Array(WP_FLOATS);
	constructor(device, format, sampleCount, lightsLayout) {
		this.format = format;
		this.sampleCount = sampleCount;
		this.lightsLayout = lightsLayout;
		this.rebuild(device);
	}
	rebuild(device) {
		this.device = device;
		this.depthView = null;
		this.envView = null;
		this.gpu.clear();
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
			const buf = device.createBuffer({
				size: g.byteLength,
				usage: BITS.VERTEX | BITS.COPY_DST
			});
			device.queue.writeBuffer(buf, 0, g);
			return buf;
		};
		this.gridVbuf = buildGrid(GRID_FINE);
		this.gridVerts = GRID_FINE * GRID_FINE * 6;
		this.gridVbufCoarse = buildGrid(GRID_COARSE);
		this.gridVertsCoarse = GRID_COARSE * GRID_COARSE * 6;
		const module = shaderModule(device, waterWGSL(this.sampleCount > 1), "water3d");
		this.layout = device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 2,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {}
			},
			{
				binding: 3,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {}
			},
			{
				binding: 4,
				visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
				texture: {
					sampleType: "depth",
					multisampled: this.sampleCount > 1
				}
			},
			{
				binding: 5,
				visibility: GPUShaderStage.VERTEX,
				texture: { sampleType: "unfilterable-float" }
			},
			{
				binding: 6,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {}
			},
			{
				binding: 7,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {}
			},
			{
				binding: 8,
				visibility: GPUShaderStage.FRAGMENT,
				texture: {}
			},
			{
				binding: 9,
				visibility: GPUShaderStage.FRAGMENT,
				sampler: {}
			}
		] });
		const dg = device.createTexture({
			size: {
				width: 1,
				height: 1
			},
			format: "r32float",
			usage: BITS.TEXTURE_BINDING | 2
		});
		device.queue.writeTexture({ texture: dg }, new Float32Array([-1e3]), {}, {
			width: 1,
			height: 1
		});
		this.dummyGround = dg.createView();
		{
			const RS = 512;
			const mips = 1 + Math.log2(RS);
			const rt = device.createTexture({
				size: {
					width: RS,
					height: RS
				},
				format: "rgba8unorm",
				mipLevelCount: mips,
				usage: BITS.TEXTURE_BINDING | 2
			});
			let level = bakeRippleField(RS);
			let w = RS;
			for (let m = 0; m < mips; m++) {
				device.queue.writeTexture({
					texture: rt,
					mipLevel: m
				}, level, { bytesPerRow: w * 4 }, {
					width: w,
					height: w
				});
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
			this.rippleView = rt.createView();
			this.rippleSamp = device.createSampler({
				addressModeU: "repeat",
				addressModeV: "repeat",
				magFilter: "linear",
				minFilter: "linear",
				mipmapFilter: "linear"
			});
		}
		{
			const mk = () => device.createTexture({
				size: {
					width: FOAM_RES,
					height: FOAM_RES
				},
				format: "r8unorm",
				usage: BITS.TEXTURE_BINDING | BITS.RENDER_ATTACHMENT | 3
			});
			this.foamTex = mk();
			this.foamView = this.foamTex.createView();
			this.foamTmp = mk();
			this.foamTmpView = this.foamTmp.createView();
			this.foamSamp = device.createSampler({
				magFilter: "linear",
				minFilter: "linear"
			});
			this.foamUBO = device.createBuffer({
				size: this.foamData.byteLength,
				usage: BITS.UNIFORM | BITS.COPY_DST
			});
			this.foamOrigin = [1e9, 1e9];
			const fmod = shaderModule(device, FOAM_WGSL, "water3d foam");
			const flayout = device.createBindGroupLayout({ entries: [
				{
					binding: 0,
					visibility: GPUShaderStage.VERTEX | GPUShaderStage.FRAGMENT,
					buffer: { type: "uniform" }
				},
				{
					binding: 1,
					visibility: GPUShaderStage.FRAGMENT,
					texture: {}
				},
				{
					binding: 2,
					visibility: GPUShaderStage.FRAGMENT,
					sampler: {}
				}
			] });
			const fpl = device.createPipelineLayout({ bindGroupLayouts: [flayout] });
			this.foamDecayPipe = device.createRenderPipeline({
				layout: fpl,
				vertex: {
					module: fmod,
					entryPoint: "vsFull"
				},
				fragment: {
					module: fmod,
					entryPoint: "fsDecay",
					targets: [{ format: "r8unorm" }]
				},
				primitive: { topology: "triangle-list" }
			});
			this.foamStampPipe = device.createRenderPipeline({
				layout: fpl,
				vertex: {
					module: fmod,
					entryPoint: "vsStamp"
				},
				fragment: {
					module: fmod,
					entryPoint: "fsStamp",
					targets: [{
						format: "r8unorm",
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
				primitive: { topology: "triangle-list" }
			});
			this.foamBind = device.createBindGroup({
				layout: flayout,
				entries: [
					{
						binding: 0,
						resource: { buffer: this.foamUBO }
					},
					{
						binding: 1,
						resource: this.foamView
					},
					{
						binding: 2,
						resource: this.foamSamp
					}
				]
			});
		}
		const pl = device.createPipelineLayout({ bindGroupLayouts: [this.layout, this.lightsLayout] });
		const blend = {
			color: {
				srcFactor: "one",
				dstFactor: "one-minus-src-alpha"
			},
			alpha: {
				srcFactor: "one",
				dstFactor: "one-minus-src-alpha"
			}
		};
		this.gridPipeline = device.createRenderPipeline({
			layout: pl,
			vertex: {
				module,
				entryPoint: "vsGrid",
				buffers: [{
					arrayStride: 8,
					attributes: [{
						shaderLocation: 0,
						offset: 0,
						format: "float32x2"
					}]
				}]
			},
			fragment: {
				module,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT$1,
				depthWriteEnabled: false,
				depthCompare: "less-equal"
			},
			primitive: { topology: "triangle-list" },
			multisample: { count: this.sampleCount }
		});
		this.ribbonPipeline = device.createRenderPipeline({
			layout: pl,
			vertex: {
				module,
				entryPoint: "vsRibbon",
				buffers: [{
					arrayStride: 24,
					attributes: [
						{
							shaderLocation: 0,
							offset: 0,
							format: "float32x3"
						},
						{
							shaderLocation: 1,
							offset: 12,
							format: "float32x2"
						},
						{
							shaderLocation: 2,
							offset: 20,
							format: "float32"
						}
					]
				}]
			},
			fragment: {
				module,
				entryPoint: "fs",
				targets: [{
					format: this.format,
					blend
				}]
			},
			depthStencil: {
				format: DEPTH_FORMAT$1,
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
	/** Per-frame: sync every water's uniforms; (re)build binds when the depth
	* or env texture changed (resize / env re-bake). */
	update(waters, uniforms, sampler, envView, depthView, projA, projB, screenW, screenH, time, encoder, eyeX = 0, eyeZ = 0, dt = 1 / 60) {
		if (encoder) {
			const texel = FOAM_SPAN / FOAM_RES;
			const ox = Math.round(eyeX / texel) * texel;
			const oz = Math.round(eyeZ / texel) * texel;
			const first = this.foamOrigin[0] > 1e8;
			const fd = this.foamData;
			fd[0] = first ? 0 : (ox - this.foamOrigin[0]) / FOAM_SPAN;
			fd[1] = first ? 0 : (oz - this.foamOrigin[1]) / FOAM_SPAN;
			fd[2] = first ? 0 : Math.exp(-dt / 2.4);
			fd[3] = 1 / FOAM_RES;
			this.foamOrigin = [ox, oz];
			let nStamps = 0;
			for (const w of waters) {
				if (w.dead || w.kind !== "grid") continue;
				for (const wl of w.wells) {
					if (wl.dead || nStamps >= 4) continue;
					const prev = this.wellPrev.get(wl);
					const spd = prev ? Math.hypot(wl.x - prev[0], wl.z - prev[1]) / Math.max(dt, .001) : 0;
					this.wellPrev.set(wl, [wl.x, wl.z]);
					const inten = Math.min(.55, wl.wake * (.15 + .28 * spd) * dt);
					const o = 4 + nStamps * 8;
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
			this.device.queue.writeBuffer(this.foamUBO, 0, fd);
			const fp = encoder.beginRenderPass({ colorAttachments: [{
				view: this.foamTmpView,
				loadOp: "clear",
				clearValue: {
					r: 0,
					g: 0,
					b: 0,
					a: 1
				},
				storeOp: "store"
			}] });
			fp.setBindGroup(0, this.foamBind);
			fp.setPipeline(this.foamDecayPipe);
			fp.draw(3);
			if (nStamps > 0) {
				fp.setPipeline(this.foamStampPipe);
				fp.draw(6, nStamps);
			}
			fp.end();
			encoder.copyTextureToTexture({ texture: this.foamTmp }, { texture: this.foamTex }, {
				width: FOAM_RES,
				height: FOAM_RES
			});
		}
		const bindsStale = depthView !== this.depthView || envView !== this.envView;
		this.depthView = depthView;
		this.envView = envView;
		for (const [w, g] of this.gpu) if (w.dead || !waters.includes(w)) {
			g.buf.destroy();
			g.vbuf?.destroy();
			this.gpu.delete(w);
		}
		for (const w of waters) {
			if (w.dead) continue;
			let g = this.gpu.get(w);
			if (!g) {
				g = {
					buf: this.device.createBuffer({
						size: WP_FLOATS * 4,
						usage: BITS.UNIFORM | BITS.COPY_DST
					}),
					bind: null,
					vertCount: this.gridVerts,
					groundSize: 0
				};
				if (w.ribbon) {
					g.vbuf = this.device.createBuffer({
						size: w.ribbon.byteLength,
						usage: BITS.VERTEX | BITS.COPY_DST
					});
					this.device.queue.writeBuffer(g.vbuf, 0, w.ribbon);
					g.vertCount = w.ribbon.length / 6;
				}
				if (w.ground && w.kind === "grid") {
					const GS = Math.min(1024, Math.max(128, 1 << Math.ceil(Math.log2(Math.max(w.w, w.d) / 4))));
					const heights = new Float32Array(GS * GS);
					for (let iy = 0; iy < GS; iy++) {
						const wz = w.z + (iy / (GS - 1) - .5) * w.d;
						for (let ix = 0; ix < GS; ix++) heights[iy * GS + ix] = w.ground(w.x + (ix / (GS - 1) - .5) * w.w, wz);
					}
					const tex = this.device.createTexture({
						size: {
							width: GS,
							height: GS
						},
						format: "r32float",
						usage: BITS.TEXTURE_BINDING | 2
					});
					this.device.queue.writeTexture({ texture: tex }, heights, { bytesPerRow: GS * 4 }, {
						width: GS,
						height: GS
					});
					g.groundView = tex.createView();
					g.groundSize = GS;
				}
				this.gpu.set(w, g);
			}
			if (!g.bind || bindsStale) g.bind = this.device.createBindGroup({
				layout: this.layout,
				entries: [
					{
						binding: 0,
						resource: { buffer: uniforms }
					},
					{
						binding: 1,
						resource: { buffer: g.buf }
					},
					{
						binding: 2,
						resource: sampler
					},
					{
						binding: 3,
						resource: envView
					},
					{
						binding: 4,
						resource: depthView
					},
					{
						binding: 5,
						resource: g.groundView ?? this.dummyGround
					},
					{
						binding: 6,
						resource: this.rippleView
					},
					{
						binding: 7,
						resource: this.rippleSamp
					},
					{
						binding: 8,
						resource: this.foamView
					},
					{
						binding: 9,
						resource: this.foamSamp
					}
				]
			});
			w.timeNow = time;
			const d = this.data;
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
				screenW,
				screenH
			], 20);
			const crestGate = Math.min(1, Math.max(0, (ampSum - .25) / .35));
			d.set([
				w.flow,
				Math.max(ampSum, 1e-4),
				crestGate,
				g.groundSize
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
			const sNorm = steepNorm(w.waves, scale.steep);
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
			this.device.queue.writeBuffer(g.buf, 0, d);
		}
	}
	draw(pass, lightsBind) {
		let lightsSet = false;
		for (const [w, g] of this.gpu) {
			if (w.dead || !g.bind) continue;
			if (!lightsSet) {
				pass.setBindGroup(1, lightsBind);
				lightsSet = true;
			}
			if (w.kind === "grid") {
				const fine = Math.max(w.w, w.d) > GRID_SPLIT;
				pass.setPipeline(this.gridPipeline);
				pass.setBindGroup(0, g.bind);
				pass.setVertexBuffer(0, fine ? this.gridVbuf : this.gridVbufCoarse);
				pass.draw(fine ? this.gridVerts : this.gridVertsCoarse);
			} else {
				pass.setPipeline(this.ribbonPipeline);
				pass.setBindGroup(0, g.bind);
				pass.setVertexBuffer(0, g.vbuf);
				pass.draw(g.vertCount);
			}
		}
	}
	get count() {
		return this.gpu.size;
	}
};
//#endregion
//#region src/lib/voxel3d.ts
var TILES = [
	"grassTop",
	"grassSide",
	"dirt",
	"stone",
	"cobble",
	"sand",
	"logTop",
	"logSide",
	"planks",
	"leaves",
	"water",
	"snowTop",
	"snowSide",
	"glass",
	"brick",
	"coalOre",
	"goldOre",
	"gravel",
	"bedrock"
];
var T = (name) => TILES.indexOf(name);
/** The block table. `BLOCKS[id]` — id 0 (air) is intentionally a hole. */
var BLOCKS = [
	null,
	{
		name: "grass",
		top: T("grassTop"),
		bottom: T("dirt"),
		side: T("grassSide")
	},
	{
		name: "dirt",
		top: T("dirt"),
		bottom: T("dirt"),
		side: T("dirt")
	},
	{
		name: "stone",
		top: T("stone"),
		bottom: T("stone"),
		side: T("stone")
	},
	{
		name: "cobble",
		top: T("cobble"),
		bottom: T("cobble"),
		side: T("cobble")
	},
	{
		name: "sand",
		top: T("sand"),
		bottom: T("sand"),
		side: T("sand")
	},
	{
		name: "log",
		top: T("logTop"),
		bottom: T("logTop"),
		side: T("logSide")
	},
	{
		name: "planks",
		top: T("planks"),
		bottom: T("planks"),
		side: T("planks")
	},
	{
		name: "leaves",
		top: T("leaves"),
		bottom: T("leaves"),
		side: T("leaves"),
		opaque: false,
		cutout: true
	},
	{
		name: "water",
		top: T("water"),
		bottom: T("water"),
		side: T("water"),
		opaque: false,
		solid: false
	},
	{
		name: "snow",
		top: T("snowTop"),
		bottom: T("dirt"),
		side: T("snowSide")
	},
	{
		name: "glass",
		top: T("glass"),
		bottom: T("glass"),
		side: T("glass"),
		opaque: false,
		cutout: true
	},
	{
		name: "brick",
		top: T("brick"),
		bottom: T("brick"),
		side: T("brick")
	},
	{
		name: "coalOre",
		top: T("coalOre"),
		bottom: T("coalOre"),
		side: T("coalOre")
	},
	{
		name: "goldOre",
		top: T("goldOre"),
		bottom: T("goldOre"),
		side: T("goldOre")
	},
	{
		name: "gravel",
		top: T("gravel"),
		bottom: T("gravel"),
		side: T("gravel")
	},
	{
		name: "bedrock",
		top: T("bedrock"),
		bottom: T("bedrock"),
		side: T("bedrock")
	}
];
/** Named ids so callers read `BLOCK.grass` not a magic number. */
var BLOCK = {
	air: 0,
	grass: 1,
	dirt: 2,
	stone: 3,
	cobble: 4,
	sand: 5,
	log: 6,
	planks: 7,
	leaves: 8,
	water: 9,
	snow: 10,
	glass: 11,
	brick: 12,
	coalOre: 13,
	goldOre: 14,
	gravel: 15,
	bedrock: 16
};
var isOpaque = (id) => id > 0 && BLOCKS[id]?.opaque !== false;
var isSolid = (id) => id > 0 && BLOCKS[id]?.solid !== false;
/** Deterministic integer hash → [0, 1). */
function h2(x, y, seed) {
	let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(seed | 0, 1274126177);
	h = Math.imul(h ^ h >>> 13, 1103515245);
	h ^= h >>> 16;
	return (h >>> 0) / 4294967296;
}
var clamp255 = (v) => v < 0 ? 0 : v > 255 ? 255 : v | 0;
/** Small painter over an RGBA byte buffer. */
var Tile = class {
	res;
	px;
	constructor(res) {
		this.res = res;
		this.px = new Uint8Array(res * res * 4);
	}
	set(x, y, r, g, b, a = 255) {
		if (x < 0 || y < 0 || x >= this.res || y >= this.res) return;
		const i = (y * this.res + x) * 4;
		this.px[i] = clamp255(r);
		this.px[i + 1] = clamp255(g);
		this.px[i + 2] = clamp255(b);
		this.px[i + 3] = clamp255(a);
	}
	fill(r, g, b, a = 255) {
		for (let y = 0; y < this.res; y++) for (let x = 0; x < this.res; x++) this.set(x, y, r, g, b, a);
	}
	/** Per-texel brightness jitter around a base colour (the flecked stone/dirt look). */
	grain(r, g, b, amp, seed) {
		for (let y = 0; y < this.res; y++) for (let x = 0; x < this.res; x++) {
			const j = (h2(x, y, seed) - .5) * 2 * amp;
			this.set(x, y, r + j, g + j, b + j);
		}
	}
};
var GENERATORS = {
	grassTop: (res, seed) => {
		const t = new Tile(res);
		t.grain(84, 140, 58, 22, seed);
		for (let i = 0; i < res * res * .18; i++) t.set(h2(i, 1, seed) * res | 0, h2(i, 2, seed) * res | 0, 106, 168, 74);
		for (let i = 0; i < res * res * .08; i++) t.set(h2(i, 3, seed) * res | 0, h2(i, 4, seed) * res | 0, 62, 108, 44);
		return t.px;
	},
	grassSide: (res, seed) => {
		const t = new Tile(res);
		t.grain(122, 92, 60, 16, seed);
		const lip = Math.max(2, res * .28 | 0);
		for (let y = 0; y < lip; y++) for (let x = 0; x < res; x++) {
			const j = (h2(x, y, seed + 9) - .5) * 30;
			t.set(x, y, 84 + j, 140 + j, 58 + j);
		}
		for (let x = 0; x < res; x++) {
			const drip = lip + (h2(x, 0, seed + 3) * 3 | 0);
			t.set(x, drip, 90, 148, 62);
		}
		return t.px;
	},
	dirt: (res, seed) => {
		const t = new Tile(res);
		t.grain(124, 90, 58, 20, seed);
		for (let i = 0; i < res * res * .06; i++) t.set(h2(i, 5, seed) * res | 0, h2(i, 6, seed) * res | 0, 92, 66, 42);
		return t.px;
	},
	stone: (res, seed) => {
		const t = new Tile(res);
		t.grain(128, 128, 132, 14, seed);
		for (let i = 0; i < res * res * .05; i++) t.set(h2(i, 7, seed) * res | 0, h2(i, 8, seed) * res | 0, 100, 100, 104);
		return t.px;
	},
	cobble: (res, seed) => {
		const t = new Tile(res);
		t.grain(120, 120, 124, 10, seed);
		const c = 4, cs = res / c;
		for (let cy = 0; cy < c; cy++) for (let cx = 0; cx < c; cx++) {
			const ox = (cx + (h2(cx, cy, seed) - .5) * .3) * cs, oy = (cy + (h2(cy, cx, seed + 1) - .5) * .3) * cs;
			const shade = 96 + h2(cx, cy, seed + 2) * 44;
			for (let y = 1; y < cs - 1; y++) for (let x = 1; x < cs - 1; x++) t.set(ox + x | 0, oy + y | 0, shade, shade, shade + 4);
		}
		return t.px;
	},
	sand: (res, seed) => {
		const t = new Tile(res);
		t.grain(214, 198, 148, 10, seed);
		for (let i = 0; i < res * res * .05; i++) t.set(h2(i, 9, seed) * res | 0, h2(i, 10, seed) * res | 0, 198, 178, 128);
		return t.px;
	},
	logTop: (res, seed) => {
		const t = new Tile(res);
		t.fill(150, 112, 66);
		const c = res / 2 - .5;
		for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
			const r = Math.hypot(x - c, y - c);
			const v = 120 + (Math.sin(r * 2.1) * .5 + .5) * 44 + (h2(x, y, seed) - .5) * 12;
			t.set(x, y, v, v * .76, v * .46);
		}
		return t.px;
	},
	logSide: (res, seed) => {
		const t = new Tile(res);
		for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
			const v = 96 + (Math.sin(x * 1.7 + h2(x, 0, seed) * 2) * .5 + .5) * 40 + (h2(x, y, seed + 1) - .5) * 16;
			t.set(x, y, v, v * .72, v * .42);
		}
		return t.px;
	},
	planks: (res, seed) => {
		const t = new Tile(res);
		t.grain(168, 130, 78, 12, seed);
		const rows = 4, rh = res / rows;
		for (let r = 0; r <= rows; r++) for (let x = 0; x < res; x++) t.set(x, Math.min(res - 1, r * rh | 0), 96, 70, 40);
		for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) if (h2(x, y, seed + 2) > .86) t.set(x, y, 140, 104, 60);
		return t.px;
	},
	leaves: (res, seed) => {
		const t = new Tile(res);
		for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
			const n = h2(x, y, seed);
			if (n > .82) {
				t.set(x, y, 0, 0, 0, 0);
				continue;
			}
			const v = n * 60;
			t.set(x, y, 46 + v, 96 + v, 40 + v);
		}
		return t.px;
	},
	water: (res, seed) => {
		const t = new Tile(res);
		for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
			const n = (h2(x, y, seed) + h2(x, y, seed + 41)) * .5 - .5;
			t.set(x, y, 48 + n * 8, 104 + n * 8, 176 + n * 10, 235);
		}
		return t.px;
	},
	snowTop: (res, seed) => {
		const t = new Tile(res);
		t.grain(238, 244, 252, 8, seed);
		for (let i = 0; i < res * res * .04; i++) t.set(h2(i, 11, seed) * res | 0, h2(i, 12, seed) * res | 0, 214, 226, 244);
		return t.px;
	},
	snowSide: (res, seed) => {
		const t = new Tile(res);
		t.grain(122, 92, 60, 16, seed);
		const lip = Math.max(3, res * .36 | 0);
		for (let y = 0; y < lip; y++) for (let x = 0; x < res; x++) {
			const j = (h2(x, y, seed + 7) - .5) * 16;
			t.set(x, y, 236 + j, 242 + j, 250 + j);
		}
		return t.px;
	},
	glass: (res, seed) => {
		const t = new Tile(res);
		t.fill(180, 210, 226, 26);
		for (let x = 0; x < res; x++) {
			t.set(x, 0, 206, 228, 240, 210);
			t.set(x, res - 1, 206, 228, 240, 210);
			t.set(0, x, 206, 228, 240, 210);
			t.set(res - 1, x, 206, 228, 240, 210);
		}
		for (let i = 0; i < res * .5; i++) t.set(h2(i, 13, seed) * res | 0, h2(i, 14, seed) * res | 0, 240, 250, 255, 150);
		return t.px;
	},
	brick: (res, seed) => {
		const t = new Tile(res);
		t.grain(162, 74, 58, 10, seed);
		const rows = 4, rh = res / rows;
		for (let ry = 0; ry < rows; ry++) {
			const off = ry % 2 * (res / 2);
			for (let x = 0; x < res; x++) t.set(x, ry * rh | 0, 196, 190, 178);
			for (let y = ry * rh | 0; y < (ry + 1) * rh; y++) {
				t.set(off % res, y, 196, 190, 178);
				t.set((off + res / 2) % res, y, 196, 190, 178);
			}
		}
		return t.px;
	},
	coalOre: (res, seed) => {
		const t = new Tile(res);
		t.grain(128, 128, 132, 14, seed);
		for (let i = 0; i < 5; i++) {
			const bx = h2(i, 20, seed) * res | 0, by = h2(i, 21, seed) * res | 0;
			for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (Math.abs(x) + Math.abs(y) < 2) t.set(bx + x, by + y, 30, 30, 34);
		}
		return t.px;
	},
	goldOre: (res, seed) => {
		const t = new Tile(res);
		t.grain(128, 128, 132, 14, seed);
		for (let i = 0; i < 5; i++) {
			const bx = h2(i, 22, seed) * res | 0, by = h2(i, 23, seed) * res | 0;
			for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) if (Math.abs(x) + Math.abs(y) < 2) t.set(bx + x, by + y, 234, 190, 74);
		}
		return t.px;
	},
	gravel: (res, seed) => {
		const t = new Tile(res);
		for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
			const v = 96 + h2(x, y, seed) * 64;
			t.set(x, y, v, v * .94, v * .86);
		}
		return t.px;
	},
	bedrock: (res, seed) => {
		const t = new Tile(res);
		for (let y = 0; y < res; y++) for (let x = 0; x < res; x++) {
			const n = h2(x, y, seed);
			const v = n > .5 ? 40 + n * 40 : 24 + n * 20;
			t.set(x, y, v, v, v + 2);
		}
		return t.px;
	}
};
/** Bake the whole pack: `count` layers of `res*res` RGBA, contiguous. Pure. */
function bakeTiles(res = 16, seed = 1) {
	const layers = TILES.length;
	const out = new Uint8Array(res * res * 4 * layers);
	for (let l = 0; l < layers; l++) out.set(GENERATORS[TILES[l]](res, seed + l * 131), l * res * res * 4);
	return {
		data: out,
		layers,
		res
	};
}
/** Box-filter downsample one RGBA layer by 2× (for mip generation). Pure. */
function halveRGBA(px, w, h) {
	const nw = Math.max(1, w >> 1), nh = Math.max(1, h >> 1), out = new Uint8Array(nw * nh * 4);
	for (let y = 0; y < nh; y++) for (let x = 0; x < nw; x++) for (let c = 0; c < 4; c++) {
		const x0 = x * 2, y0 = y * 2, x1 = Math.min(w - 1, x0 + 1), y1 = Math.min(h - 1, y0 + 1);
		out[(y * nw + x) * 4 + c] = px[(y0 * w + x0) * 4 + c] + px[(y0 * w + x1) * 4 + c] + px[(y1 * w + x0) * 4 + c] + px[(y1 * w + x1) * 4 + c] >> 2;
	}
	return {
		px: out,
		w: nw,
		h: nh
	};
}
/** A bounded grid of block ids, split into fixed-size chunks. Pure/testable. */
var VoxelWorld = class {
	sx;
	sy;
	sz;
	ch;
	cx;
	cy;
	cz;
	chunks;
	/** Chunk indices needing a remesh. */
	dirty = /* @__PURE__ */ new Set();
	constructor(opts = {}) {
		this.sx = opts.sizeX ?? 128;
		this.sy = opts.sizeY ?? 48;
		this.sz = opts.sizeZ ?? 128;
		this.ch = opts.chunk ?? 16;
		this.cx = Math.ceil(this.sx / this.ch);
		this.cy = Math.ceil(this.sy / this.ch);
		this.cz = Math.ceil(this.sz / this.ch);
		this.chunks = new Array(this.cx * this.cy * this.cz).fill(null);
	}
	inBounds(x, y, z) {
		return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
	}
	chunkIndex(cx, cy, cz) {
		return (cy * this.cz + cz) * this.cx + cx;
	}
	/** Block id at a cell, or 0 (air) outside the world. */
	get(x, y, z) {
		if (!this.inBounds(x, y, z)) return 0;
		const ch = this.ch;
		const c = this.chunks[this.chunkIndex(x / ch | 0, y / ch | 0, z / ch | 0)];
		if (!c) return 0;
		const lx = x % ch, ly = y % ch, lz = z % ch;
		return c[(ly * ch + lz) * ch + lx];
	}
	/** Set a cell. Marks the owning chunk (and a bordering neighbour) dirty. */
	set(x, y, z, id) {
		if (!this.inBounds(x, y, z)) return;
		const ch = this.ch, cxi = x / ch | 0, cyi = y / ch | 0, czi = z / ch | 0;
		const idx = this.chunkIndex(cxi, cyi, czi);
		let c = this.chunks[idx];
		if (!c) {
			if (id === 0) return;
			c = this.chunks[idx] = new Uint16Array(ch * ch * ch);
		}
		const lx = x % ch, ly = y % ch, lz = z % ch;
		if (c[(ly * ch + lz) * ch + lx] === id) return;
		c[(ly * ch + lz) * ch + lx] = id;
		this.dirty.add(idx);
		if (lx === 0 && cxi > 0) this.dirty.add(this.chunkIndex(cxi - 1, cyi, czi));
		if (lx === ch - 1 && cxi < this.cx - 1) this.dirty.add(this.chunkIndex(cxi + 1, cyi, czi));
		if (ly === 0 && cyi > 0) this.dirty.add(this.chunkIndex(cxi, cyi - 1, czi));
		if (ly === ch - 1 && cyi < this.cy - 1) this.dirty.add(this.chunkIndex(cxi, cyi + 1, czi));
		if (lz === 0 && czi > 0) this.dirty.add(this.chunkIndex(cxi, cyi, czi - 1));
		if (lz === ch - 1 && czi < this.cz - 1) this.dirty.add(this.chunkIndex(cxi, cyi, czi + 1));
	}
	/** Highest solid block at column (x, z), or -1 if the column is empty. */
	columnTop(x, z) {
		for (let y = this.sy - 1; y >= 0; y--) if (this.get(x, y, z) !== 0) return y;
		return -1;
	}
	/** Mark every non-empty chunk dirty (after a bulk generate, or device loss). */
	markAllDirty() {
		for (let i = 0; i < this.chunks.length; i++) if (this.chunks[i]) this.dirty.add(i);
	}
	/** Empty the world back to all-air. Marks every previously-filled chunk dirty
	* so its geometry clears on the next remesh (used by reseed). */
	clear() {
		for (let i = 0; i < this.chunks.length; i++) if (this.chunks[i]) {
			this.dirty.add(i);
			this.chunks[i] = null;
		}
	}
	/** Chunk grid coords from a linear chunk index (for the mesher). */
	chunkCoords(idx) {
		const cx = idx % this.cx, r = idx / this.cx | 0;
		return [
			cx,
			r / this.cz | 0,
			r % this.cz
		];
	}
	get chunkCount() {
		return this.chunks.length;
	}
	hasChunk(idx) {
		return !!this.chunks[idx];
	}
};
var VOX_FLOATS = 8;
/** Ambient-occlusion brightness by occluder count (0 = darkest corner).
* Deliberately gentle — the block look wants a hint of crease, not deep
* shadow (Minecraft absorbs very little light per face). */
var AO_LEVELS = [
	.62,
	.75,
	.88,
	1
];
var FACES = [
	{
		n: [
			1,
			0,
			0
		],
		u: [
			0,
			1,
			0
		],
		v: [
			0,
			0,
			1
		],
		off: [
			1,
			0,
			0
		],
		uv: [
			[0, 1],
			[0, 0],
			[1, 0],
			[1, 1]
		]
	},
	{
		n: [
			-1,
			0,
			0
		],
		u: [
			0,
			0,
			1
		],
		v: [
			0,
			1,
			0
		],
		off: [
			0,
			0,
			0
		],
		uv: [
			[0, 1],
			[1, 1],
			[1, 0],
			[0, 0]
		]
	},
	{
		n: [
			0,
			1,
			0
		],
		u: [
			0,
			0,
			1
		],
		v: [
			1,
			0,
			0
		],
		off: [
			0,
			1,
			0
		],
		uv: [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1]
		]
	},
	{
		n: [
			0,
			-1,
			0
		],
		u: [
			1,
			0,
			0
		],
		v: [
			0,
			0,
			1
		],
		off: [
			0,
			0,
			0
		],
		uv: [
			[0, 0],
			[1, 0],
			[1, 1],
			[0, 1]
		]
	},
	{
		n: [
			0,
			0,
			1
		],
		u: [
			1,
			0,
			0
		],
		v: [
			0,
			1,
			0
		],
		off: [
			0,
			0,
			1
		],
		uv: [
			[0, 1],
			[1, 1],
			[1, 0],
			[0, 0]
		]
	},
	{
		n: [
			0,
			0,
			-1
		],
		u: [
			0,
			1,
			0
		],
		v: [
			1,
			0,
			0
		],
		off: [
			0,
			0,
			0
		],
		uv: [
			[0, 1],
			[0, 0],
			[1, 0],
			[1, 1]
		]
	}
];
/** Standard 3-sample corner AO: 0 (both sides closed) … 3 (all open). */
function vertexAO(side1, side2, corner) {
	if (side1 && side2) return 0;
	return 3 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0));
}
/** Pick the per-face tile layer for a block + face index (0..5, order = FACES). */
function faceTile(def, face) {
	return face === 2 ? def.top : face === 3 ? def.bottom : def.side;
}
/**
* Mesh one chunk into an interleaved Float32Array (VOX_FLOATS per vertex).
* Only faces exposed to air / a non-opaque different block are emitted.
* `get` is the WORLD accessor (crosses chunk borders for correct culling+AO).
*/
function meshChunk(get, x0, y0, z0, ch) {
	const out = [];
	for (let ly = 0; ly < ch; ly++) for (let lz = 0; lz < ch; lz++) for (let lx = 0; lx < ch; lx++) {
		const wx = x0 + lx, wy = y0 + ly, wz = z0 + lz;
		const id = get(wx, wy, wz);
		if (id === 0) continue;
		const def = BLOCKS[id];
		for (let f = 0; f < 6; f++) {
			const F = FACES[f], n = F.n;
			const nb = get(wx + n[0], wy + n[1], wz + n[2]);
			if (isOpaque(nb) || nb === id && !def.opaque) continue;
			const layer = faceTile(def, f);
			const px = wx + n[0], py = wy + n[1], pz = wz + n[2];
			const u = F.u, v = F.v;
			const corner = (i, j) => {
				const pos = [
					wx + F.off[0] + i * u[0] + j * v[0],
					wy + F.off[1] + i * u[1] + j * v[1],
					wz + F.off[2] + i * u[2] + j * v[2]
				];
				const du = i === 1 ? 1 : -1, dv = j === 1 ? 1 : -1;
				return {
					pos,
					ao: vertexAO(isOpaque(get(px + du * u[0], py + du * u[1], pz + du * u[2])), isOpaque(get(px + dv * v[0], py + dv * v[1], pz + dv * v[2])), isOpaque(get(px + du * u[0] + dv * v[0], py + du * u[1] + dv * v[1], pz + du * u[2] + dv * v[2])))
				};
			};
			const c00 = corner(0, 0), c10 = corner(1, 0), c11 = corner(1, 1), c01 = corner(0, 1);
			const uv = F.uv;
			const quad = [
				c00,
				c10,
				c11,
				c01
			];
			const order = c00.ao + c11.ao > c10.ao + c01.ao ? [
				1,
				2,
				3,
				1,
				3,
				0
			] : [
				0,
				1,
				2,
				0,
				2,
				3
			];
			for (const k of order) {
				const c = quad[k];
				out.push(c.pos[0], c.pos[1], c.pos[2], uv[k][0], uv[k][1], layer, f, AO_LEVELS[c.ao]);
			}
		}
	}
	return new Float32Array(out);
}
/**
* March a ray through the grid; return the first SOLID block hit (or null).
* `place` = hit cell + face normal is the empty cell to build into.
*/
function raycastVoxel(get, ox, oy, oz, dx, dy, dz, maxDist = 64) {
	const len = Math.hypot(dx, dy, dz) || 1;
	dx /= len;
	dy /= len;
	dz /= len;
	let x = Math.floor(ox), y = Math.floor(oy), z = Math.floor(oz);
	const stepX = Math.sign(dx), stepY = Math.sign(dy), stepZ = Math.sign(dz);
	const tDX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
	const tDY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
	const tDZ = dz !== 0 ? Math.abs(1 / dz) : Infinity;
	const boundary = (i, step) => step > 0 ? Math.floor(i) + 1 - i : i - Math.floor(i);
	let tMX = dx !== 0 ? boundary(ox, stepX) * tDX : Infinity;
	let tMY = dy !== 0 ? boundary(oy, stepY) * tDY : Infinity;
	let tMZ = dz !== 0 ? boundary(oz, stepZ) * tDZ : Infinity;
	let nx = 0, ny = 0, nz = 0, t = 0;
	if (isSolid(get(x, y, z))) return {
		x,
		y,
		z,
		nx: 0,
		ny: 0,
		nz: 0,
		dist: 0
	};
	while (t <= maxDist) {
		if (tMX < tMY && tMX < tMZ) {
			x += stepX;
			t = tMX;
			tMX += tDX;
			nx = -stepX;
			ny = 0;
			nz = 0;
		} else if (tMY < tMZ) {
			y += stepY;
			t = tMY;
			tMY += tDY;
			nx = 0;
			ny = -stepY;
			nz = 0;
		} else {
			z += stepZ;
			t = tMZ;
			tMZ += tDZ;
			nx = 0;
			ny = 0;
			nz = -stepZ;
		}
		if (isSolid(get(x, y, z))) return {
			x,
			y,
			z,
			nx,
			ny,
			nz,
			dist: t
		};
	}
	return null;
}
var smooth01 = (e0, e1, x) => {
	const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
	return t * t * (3 - 2 * t);
};
/**
* Fill a VoxelWorld with a landscape. Pure + deterministic by seed — the same
* (type, seed) is the same world on every machine. Every type is SOLID from the
* surface down to bedrock (dig-through), coloured grass/sand/snow by height,
* with an ore-flecked stone core. Reseed by calling `clear()` then this again.
*/
function voxelTerrain(world, opts = {}) {
	const type = opts.type ?? "island";
	const seed = opts.seed ?? 1;
	const perm = noisePerm(seed);
	const sx = world.sx, sy = world.sy, sz = world.sz;
	const sea = opts.seaLevel ?? (type === "island" ? Math.floor(sy * .36) : type === "plains" ? Math.floor(sy * .3) : -1);
	const base = Math.floor(sy * (type === "flat" ? .5 : type === "mountains" ? .28 : .4));
	const cx = sx / 2, cz = sz / 2, maxR = Math.min(sx, sz) * .5;
	const heightAt = (x, z) => {
		if (type === "flat") return base;
		let h;
		if (type === "mountains") {
			let sum = 0, amp = 1, norm = 0, fx = x * .02, fz = z * .02;
			for (let o = 0; o < 5; o++) {
				sum += (1 - Math.abs(fbm2(fx, fz, perm, { octaves: 1 }))) * amp;
				norm += amp;
				amp *= .5;
				fx *= 2.1;
				fz *= 2.1;
			}
			h = base + sum / norm * (sy * .55);
		} else if (type === "hills") h = base + fbm2(x * .03, z * .03, perm, { octaves: 5 }) * (sy * .3);
		else {
			const amp = type === "plains" ? sy * .12 : sy * .3;
			h = base + fbm2(x * .02, z * .02, perm, { octaves: 5 }) * amp;
			if (type === "island") {
				const fall = 1 - smooth01(.55, .98, Math.hypot(x - cx, z - cz) / maxR);
				h = sea - 4 + (h - (sea - 4)) * fall;
			}
		}
		return Math.max(1, Math.min(sy - 1, Math.floor(h)));
	};
	for (let z = 0; z < sz; z++) for (let x = 0; x < sx; x++) {
		const h = heightAt(x, z);
		const top = Math.max(h, sea);
		for (let y = 0; y <= top; y++) {
			let id = 0;
			if (y > h) id = sea >= 0 && y <= sea ? BLOCK.water : 0;
			else if (y === 0) id = BLOCK.bedrock;
			else if (y === h) if (sea >= 0 && h <= sea + 1) id = BLOCK.sand;
			else if (h > sy * .62) id = BLOCK.snow;
			else id = BLOCK.grass;
			else if (y > h - 4) id = sea >= 0 && h <= sea + 1 ? BLOCK.sand : BLOCK.dirt;
			else {
				const n = mulberry32$1(x * 92821 + y * 689 + z * 7 + seed * 13 >>> 0)();
				id = n > .985 ? BLOCK.goldOre : n > .95 ? BLOCK.coalOre : BLOCK.stone;
			}
			if (id) world.set(x, y, z, id);
		}
	}
	if (opts.trees ?? true) scatterTrees(world, seed, opts.treeDensity ?? 1);
}
function scatterTrees(world, seed, density) {
	const rnd = mulberry32$1(seed * 7 + 101 >>> 0);
	const sx = world.sx, sz = world.sz;
	const count = Math.floor(sx * sz * .006 * density);
	for (let i = 0; i < count; i++) {
		const x = 2 + (rnd() * (sx - 4) | 0), z = 2 + (rnd() * (sz - 4) | 0);
		const top = world.columnTop(x, z);
		if (top < 0 || world.get(x, top, z) !== BLOCK.grass) continue;
		const trunk = 4 + (rnd() * 3 | 0);
		for (let t = 1; t <= trunk; t++) world.set(x, top + t, z, BLOCK.log);
		const cy = top + trunk;
		for (let dy = -1; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
			if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 3 || dx === 0 && dz === 0 && dy < 2) continue;
			if (rnd() < .82 && world.get(x + dx, cy + dy, z + dz) === 0) world.set(x + dx, cy + dy, z + dz, BLOCK.leaves);
		}
	}
}
var EPS = 1e-4;
/**
* An axis-aligned body that walks the voxel world: gravity, jumping, per-axis
* swept collision resolve against solid blocks, and auto step-up over 1-block
* ledges. Feed it a wished horizontal velocity + a jump flag each `step`; it
* resolves the move and reports `onGround` / `blocked`.
*/
var VoxelBody = class {
	world;
	x;
	y;
	z;
	vy = 0;
	onGround = false;
	/** True when a wall stopped horizontal motion last step (AI: turn/jump). */
	blocked = false;
	hw;
	height;
	stepH;
	grav;
	jump;
	maxFall;
	constructor(world, spawn, opts = {}) {
		this.world = world;
		this.x = spawn.x;
		this.y = spawn.y;
		this.z = spawn.z;
		this.hw = (opts.width ?? .6) / 2;
		this.height = opts.height ?? 1.8;
		this.stepH = opts.stepHeight ?? 1.05;
		this.grav = opts.gravity ?? 28;
		this.jump = opts.jumpSpeed ?? 8.4;
		this.maxFall = opts.maxFall ?? 40;
	}
	/** Any solid block overlapping the AABB at the current position? */
	collides() {
		const x0 = Math.floor(this.x - this.hw), x1 = Math.floor(this.x + this.hw - EPS);
		const y0 = Math.floor(this.y + EPS), y1 = Math.floor(this.y + this.height - EPS);
		const z0 = Math.floor(this.z - this.hw), z1 = Math.floor(this.z + this.hw - EPS);
		for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) if (isSolid(this.world.get(x, y, z))) return true;
		return false;
	}
	/**
	* Advance one tick. `wishX`/`wishZ` are desired horizontal velocity
	* (blocks/s); `jump` launches if standing. Substepped so fast motion can't
	* tunnel through a 1-block wall.
	*/
	step(dt, wishX, wishZ, jump) {
		this.vy = Math.max(-this.maxFall, this.vy - this.grav * dt);
		if (jump && this.onGround) {
			this.vy = this.jump;
			this.onGround = false;
		}
		this.blocked = false;
		let dx = wishX * dt, dz = wishZ * dt, dy = this.vy * dt;
		const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / .4));
		dx /= n;
		dy /= n;
		dz /= n;
		const groundedBefore = this.onGround;
		this.onGround = false;
		for (let s = 0; s < n; s++) {
			this.moveY(dy);
			this.moveHoriz("x", dx, groundedBefore || this.onGround);
			this.moveHoriz("z", dz, groundedBefore || this.onGround);
		}
	}
	moveY(dy) {
		if (dy === 0) return;
		this.y += dy;
		if (!this.collides()) return;
		if (dy > 0) this.y = Math.floor(this.y + this.height) - this.height - EPS;
		else {
			this.y = Math.floor(this.y) + 1 + EPS;
			this.onGround = true;
		}
		this.vy = 0;
	}
	moveHoriz(axis, d, grounded) {
		if (d === 0) return;
		this[axis] += d;
		if (!this.collides()) return;
		if (grounded && this.stepH > 0) {
			const savedY = this.y;
			this.y += this.stepH;
			if (!this.collides()) return;
			this.y = savedY;
		}
		if (d > 0) this[axis] = Math.floor(this[axis] + this.hw) - this.hw - EPS;
		else this[axis] = Math.floor(this[axis] - this.hw) + 1 + this.hw + EPS;
		this.blocked = true;
	}
};
/**
* A mob: a VoxelBody plus a tiny brain. `wander` roams and randomly re-heads;
* `seek`/`flee` chase or avoid a target; all of them AUTO-JUMP when a wall
* blocks them (so they climb terraces like a Minecraft mob). Drive it with
* `update(dt, target?)`.
*/
var VoxelAgent = class {
	body;
	mode;
	speed;
	/** Current heading in radians (wander) — also where a mesh should face. */
	heading;
	rnd;
	reHead = 0;
	constructor(world, spawn, opts = {}) {
		this.body = new VoxelBody(world, spawn, opts);
		this.mode = opts.mode ?? "wander";
		this.speed = opts.speed ?? 3;
		this.rnd = mulberry32$1((opts.seed ?? Math.floor(spawn.x * 131 + spawn.z * 977 + 7)) >>> 0);
		this.heading = this.rnd() * Math.PI * 2;
	}
	/** One AI tick. `target` is required for seek/flee (a point to chase/avoid). */
	update(dt, target) {
		let wx = 0, wz = 0;
		if (this.mode === "seek" && target) this.heading = Math.atan2(this.body.x - target.x, target.z - this.body.z);
		else if (this.mode === "flee" && target) this.heading = Math.atan2(target.x - this.body.x, this.body.z - target.z);
		else if (this.mode === "wander") {
			this.reHead -= dt;
			if (this.reHead <= 0) {
				this.heading += (this.rnd() - .5) * 2.2;
				this.reHead = 1.4 + this.rnd() * 2.4;
			}
		}
		if (this.mode !== "idle") {
			wx = -Math.sin(this.heading) * this.speed;
			wz = Math.cos(this.heading) * this.speed;
		}
		const jump = this.body.blocked && this.body.onGround;
		if (this.mode === "wander" && this.body.blocked) this.heading += (this.rnd() - .5) * 1.5;
		this.body.step(dt, wx, wz, jump);
	}
};
var DEPTH_FORMAT = "depth24plus";
var VOXEL_WGSL = `
struct U {
  viewProj: mat4x4f, camPos: vec4f, fogColor: vec4f, params: vec4f,
  lightDir: vec4f, right: vec4f, up: vec4f, ambSky: vec4f, ambGround: vec4f,
  sunCol: vec4f, uwC: vec4f, uwC2: vec4f,
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var atlas: texture_2d_array<f32>;
@group(0) @binding(2) var samp: sampler;

// Fixed per-face brightness — the Minecraft trick. Every face reads at a
// consistent, readable level set by its AXIS (top brightest, bottom darkest,
// sides between), NOT by dot(normal, sun) which plunges shadowed sides to
// black. The world's sun colour + day/night still tint everything.
//                         +X    -X    +Y    -Y    +Z    -Z
const FACE = array<f32, 6>(0.82, 0.82, 1.0, 0.58, 0.92, 0.92);

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) world: vec3f,
  @location(1) uv: vec2f,
  @location(2) @interpolate(flat) layer: u32,
  @location(3) @interpolate(flat) face: u32,
  @location(4) ao: f32,
}

@vertex
fn vs(@location(0) p: vec3f, @location(1) uv: vec2f,
      @location(2) layer: f32, @location(3) face: f32, @location(4) ao: f32) -> VSOut {
  var o: VSOut;
  o.pos = u.viewProj * vec4f(p, 1.0);
  o.world = p; o.uv = uv; o.layer = u32(layer + 0.5); o.face = u32(face + 0.5); o.ao = ao;
  return o;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let tex = textureSample(atlas, samp, in.uv, in.layer);
  if (tex.a < 0.5) { discard; }                       // alpha cutout (leaves/glass)
  // ONE flat daylight tone (warm sun by day, cool sky by night; dims with the
  // sun's intensity) applied to EVERY face — the per-face factor + AO do the
  // shaping. No dot(normal, sun), so no face ever goes dark.
  let day = clamp(u.sunCol.w, 0.0, 1.0);
  let tone = mix(u.ambSky.rgb * 0.55, u.sunCol.rgb, day) + u.ambGround.rgb * (u.fogColor.a * 0.22);
  var rgb = tex.rgb * tone * FACE[in.face] * in.ao;
  if (u.params.z > 0.5) {
    let f = smoothstep(u.params.x, u.params.y, distance(u.camPos.xyz, in.world));
    rgb = mix(rgb, u.fogColor.rgb, f);
  }
  return vec4f(rgb, 1.0);
}
`;
/** The renderable voxel world. `world.voxels()` builds it; edit via set/get,
* pick blocks with `raycast`, and it draws itself inside the world's pass. */
var Voxels3d = class {
	device;
	format;
	sampleCount;
	uniforms;
	camera;
	world;
	blockSize;
	bufs;
	atlasTex;
	sampler;
	pipeline;
	bind;
	layout;
	tileRes;
	seed;
	mip;
	cullDist;
	constructor(device, format, sampleCount, uniforms, camera, opts = {}) {
		this.device = device;
		this.format = format;
		this.sampleCount = sampleCount;
		this.uniforms = uniforms;
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
		this.buildGpu();
	}
	/** Device-loss recovery: adopt the fresh device + world uniforms, drop the
	* dead vertex buffers, and rebuild every GPU object from the CPU model. */
	rebuild(device, uniforms) {
		this.device = device;
		this.uniforms = uniforms;
		this.bufs = Array.from({ length: this.world.chunkCount }, () => ({
			vbuf: null,
			count: 0
		}));
		this.buildGpu();
	}
	/** (Re)build all GPU resources — also the device-loss recovery entry point. */
	buildGpu() {
		const d = this.device;
		this.uploadAtlas();
		this.sampler = d.createSampler({
			magFilter: "nearest",
			minFilter: this.mip ? "linear" : "nearest",
			mipmapFilter: "linear",
			addressModeU: "repeat",
			addressModeV: "repeat"
		});
		this.layout = d.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_VERTEX | BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {
					sampleType: "float",
					viewDimension: "2d-array"
				}
			},
			{
				binding: 2,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: { type: "filtering" }
			}
		] });
		const mod = shaderModule(d, VOXEL_WGSL, "Voxels3d");
		this.pipeline = d.createRenderPipeline({
			layout: d.createPipelineLayout({ bindGroupLayouts: [this.layout] }),
			vertex: {
				module: mod,
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
							format: "float32x2"
						},
						{
							shaderLocation: 2,
							offset: 20,
							format: "float32"
						},
						{
							shaderLocation: 3,
							offset: 24,
							format: "float32"
						},
						{
							shaderLocation: 4,
							offset: 28,
							format: "float32"
						}
					]
				}]
			},
			fragment: {
				module: mod,
				entryPoint: "fs",
				targets: [{ format: this.format }]
			},
			primitive: {
				topology: "triangle-list",
				cullMode: "back",
				frontFace: "ccw"
			},
			depthStencil: {
				format: DEPTH_FORMAT,
				depthWriteEnabled: true,
				depthCompare: "less-equal"
			},
			multisample: { count: this.sampleCount }
		});
		this.bind = d.createBindGroup({
			layout: this.layout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniforms }
				},
				{
					binding: 1,
					resource: this.atlasTex.createView({ dimension: "2d-array" })
				},
				{
					binding: 2,
					resource: this.sampler
				}
			]
		});
		this.world.markAllDirty();
	}
	uploadAtlas() {
		const d = this.device, res = this.tileRes;
		const { data, layers } = bakeTiles(res, this.seed);
		const mipCount = this.mip ? 1 + Math.floor(Math.log2(res)) : 1;
		this.atlasTex = d.createTexture({
			size: {
				width: res,
				height: res,
				depthOrArrayLayers: layers
			},
			format: "rgba8unorm-srgb",
			mipLevelCount: mipCount,
			usage: BITS.TEXTURE_BINDING | 2
		});
		for (let l = 0; l < layers; l++) {
			let px = data.subarray(l * res * res * 4, (l + 1) * res * res * 4);
			let w = res, h = res;
			for (let m = 0; m < mipCount; m++) {
				d.queue.writeTexture({
					texture: this.atlasTex,
					mipLevel: m,
					origin: {
						x: 0,
						y: 0,
						z: l
					}
				}, px, {
					bytesPerRow: w * 4,
					rowsPerImage: h
				}, {
					width: w,
					height: h,
					depthOrArrayLayers: 1
				});
				if (m + 1 < mipCount) {
					const n = halveRGBA(px, w, h);
					px = n.px;
					w = n.w;
					h = n.h;
				}
			}
		}
	}
	get(x, y, z) {
		return this.world.get(x, y, z);
	}
	set(x, y, z, id) {
		this.world.set(x, y, z, id);
	}
	/** Author the world in bulk: `(x,y,z) => blockId`. Marks everything dirty. */
	generate(fn) {
		const w = this.world;
		for (let y = 0; y < w.sy; y++) for (let z = 0; z < w.sz; z++) for (let x = 0; x < w.sx; x++) {
			const id = fn(x, y, z);
			if (id) w.set(x, y, z, id);
		}
	}
	/** Build (or REBUILD) a landscape: clears the world then fills it with the
	* chosen land type. Call again with a new `seed` for a reseed button. */
	landscape(opts = {}) {
		this.world.clear();
		voxelTerrain(this.world, opts);
	}
	/** World-space Y (feet) to drop a body/mob at column (x, z) — just above the
	* highest solid block. Returns `blockSize`-scaled units. */
	spawnY(x, z) {
		return (this.world.columnTop(x / this.blockSize | 0, z / this.blockSize | 0) + 1) * this.blockSize;
	}
	/**
	* Raycast from a world-space origin/direction, returning the block hit (in
	* BLOCK coordinates) and the entry face normal — for breaking (`hit`) and
	* placing (`hit + normal`). Coordinates are divided by blockSize internally.
	*/
	raycast(ox, oy, oz, dx, dy, dz, maxDist = 64) {
		const b = this.blockSize;
		return raycastVoxel((x, y, z) => this.world.get(x, y, z), ox / b, oy / b, oz / b, dx, dy, dz, maxDist / b);
	}
	/** Re-mesh dirty chunks + upload their vertex buffers. Call once per frame
	* (world.prepare does this). Budget-capped so a big edit burst can't stall. */
	remeshDirty(budget = 8) {
		if (!this.world.dirty.size) return;
		const b = this.blockSize, ch = this.world.ch;
		let done = 0;
		for (const idx of this.world.dirty) {
			const [cx, cy, cz] = this.world.chunkCoords(idx);
			const verts = meshChunk((x, y, z) => this.world.get(x, y, z), cx * ch, cy * ch, cz * ch, ch);
			const buf = this.bufs[idx];
			if (verts.length === 0) {
				buf.vbuf?.destroy();
				buf.vbuf = null;
				buf.count = 0;
			} else {
				if (b !== 1) for (let i = 0; i < verts.length; i += 8) {
					verts[i] *= b;
					verts[i + 1] *= b;
					verts[i + 2] *= b;
				}
				if (!buf.vbuf || buf.vbuf.size < verts.byteLength) {
					buf.vbuf?.destroy();
					buf.vbuf = this.device.createBuffer({
						size: verts.byteLength,
						usage: BITS.VERTEX | BITS.COPY_DST
					});
				}
				this.device.queue.writeBuffer(buf.vbuf, 0, verts);
				buf.count = verts.length / 8;
			}
			this.world.dirty.delete(idx);
			if (++done >= budget) break;
		}
	}
	/** Draw every non-empty, in-range chunk. Called from world.renderOpaque. */
	render(pass) {
		let set = false;
		const b = this.blockSize, ch = this.world.ch, half = ch * b * .5, cull2 = this.cullDist * this.cullDist;
		for (let idx = 0; idx < this.bufs.length; idx++) {
			const buf = this.bufs[idx];
			if (!buf.vbuf || !buf.count) continue;
			const [cx, cy, cz] = this.world.chunkCoords(idx);
			const dx = cx * ch * b + half - this.camera.x, dy = cy * ch * b + half - this.camera.y, dz = cz * ch * b + half - this.camera.z;
			if (dx * dx + dy * dy + dz * dz > cull2) continue;
			if (!set) {
				pass.setPipeline(this.pipeline);
				pass.setBindGroup(0, this.bind);
				set = true;
			}
			pass.setVertexBuffer(0, buf.vbuf);
			pass.draw(buf.count);
		}
	}
	/** Live stats for a HUD/debug panel: chunks currently drawn (non-empty) and
	* the total uploaded vertex count. */
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
		for (const b of this.bufs) b.vbuf?.destroy();
		this.bufs = [];
		this.atlasTex?.destroy();
	}
};
//#endregion
//#region src/lib/voxeledit3d.ts
function cubeOutline() {
	const c = [
		[
			-.5,
			-.5,
			-.5
		],
		[
			.5,
			-.5,
			-.5
		],
		[
			.5,
			-.5,
			.5
		],
		[
			-.5,
			-.5,
			.5
		],
		[
			-.5,
			.5,
			-.5
		],
		[
			.5,
			.5,
			-.5
		],
		[
			.5,
			.5,
			.5
		],
		[
			-.5,
			.5,
			.5
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
var BLOCKED_TINT = "#c0392b";
/**
* Targets and edits a voxel world for the player. Construct with
* `world.voxelEditor(vox, opts)`; call `update(dt, input)` each frame with the
* camera ray + button state. It positions the outline/ghost, applies breaks
* (respecting hardness) and places (respecting the anti-embed guard), and fires
* `onHit`/`onBreak`/`onPlace` — the game turns those into effects.
*/
var VoxelEditor = class {
	/** Block id a place drops. Set from the hotbar each frame if you like. */
	block;
	/** Ghost tint (the selected block's colour, usually). */
	ghostColor;
	/** Ray reach in blocks — live-mutable. */
	reach;
	vox;
	o;
	hardness;
	blockedFn;
	cbHit;
	cbBreak;
	cbPlace;
	outline = null;
	ghost = null;
	committed = null;
	pendKey = "none";
	pendN = 0;
	breakCd = 0;
	placeCd = 0;
	mineKey = "none";
	mineHits = 0;
	constructor(world, vox, opts = {}) {
		this.vox = vox;
		this.block = opts.block ?? BLOCK.stone;
		this.ghostColor = opts.ghostColor ?? "#ffffff";
		this.reach = opts.reach ?? 8;
		this.hardness = opts.hardness ?? (() => 1);
		this.blockedFn = opts.blocked ?? (() => false);
		this.cbHit = opts.onHit;
		this.cbBreak = opts.onBreak;
		this.cbPlace = opts.onPlace;
		this.o = {
			breakRate: opts.breakRate ?? .15,
			placeRate: opts.placeRate ?? .2,
			outline: opts.outline ?? true,
			ghost: opts.ghost ?? true,
			debounce: opts.debounce ?? 3
		};
		if (this.o.outline) {
			this.outline = world.lines(cubeOutline(), {
				color: "#0a0a0a",
				width: 2.5,
				alpha: 0
			});
			this.outline.scale = 1.01;
		}
		if (this.o.ghost) this.ghost = world.box({
			x: 0,
			y: -1e4,
			z: 0,
			w: .92,
			h: .92,
			d: .92,
			color: "#ffffff",
			alpha: 0,
			blob: false
		});
	}
	key(h) {
		return h ? `${h.x},${h.y},${h.z}|${h.nx},${h.ny},${h.nz}` : "none";
	}
	/** Raycast + de-twitch: commit a new target only after it holds `debounce`
	*  frames, so the outline doesn't flip-flop on block seams. */
	acquire(input) {
		const o = input.origin, d = input.dir;
		const raw = this.vox.raycast(o.x, o.y, o.z, d.x, d.y, d.z, this.reach);
		if (this.o.debounce <= 0) {
			this.committed = raw;
			return raw;
		}
		if (this.key(raw) === this.key(this.committed)) {
			this.pendN = 0;
			return this.committed;
		}
		if (this.key(raw) === this.pendKey) this.pendN++;
		else {
			this.pendKey = this.key(raw);
			this.pendN = 1;
		}
		if (this.pendN >= this.o.debounce) {
			this.committed = raw;
			this.pendN = 0;
		}
		return this.committed;
	}
	/** One frame: aim, draw outline/ghost, apply held break/place, emit events. */
	update(dt, input) {
		const hit = this.acquire(input);
		const res = {
			target: hit,
			placeCell: null,
			blocked: false,
			hit: null,
			broke: null,
			placed: null
		};
		let px = 0, py = 0, pz = 0;
		if (hit) {
			px = hit.x + hit.nx;
			py = hit.y + hit.ny;
			pz = hit.z + hit.nz;
			res.placeCell = {
				x: px,
				y: py,
				z: pz
			};
			res.blocked = this.blockedFn(px, py, pz);
		}
		if (this.outline) if (hit) {
			this.outline.x = hit.x + .5;
			this.outline.y = hit.y + .5;
			this.outline.z = hit.z + .5;
			this.outline.alpha = 1;
		} else this.outline.alpha = 0;
		if (this.ghost) if (hit) {
			this.ghost.x = px + .5;
			this.ghost.y = py + .5;
			this.ghost.z = pz + .5;
			this.ghost.color = res.blocked ? BLOCKED_TINT : this.ghostColor;
			this.ghost.alpha = res.blocked ? .3 : .4;
		} else this.ghost.alpha = 0;
		this.breakCd -= dt;
		if (hit && input.mining) {
			if (this.mineKey !== this.key(hit)) {
				this.mineKey = this.key(hit);
				this.mineHits = 0;
			}
			if (this.breakCd <= 0) {
				const id = this.vox.get(hit.x, hit.y, hit.z);
				const need = Math.max(1, this.hardness(id));
				this.mineHits++;
				this.breakCd = this.o.breakRate;
				const hEv = {
					x: hit.x,
					y: hit.y,
					z: hit.z,
					id,
					progress: Math.min(1, this.mineHits / need)
				};
				res.hit = hEv;
				this.cbHit?.(hEv);
				if (this.mineHits >= need) {
					this.vox.set(hit.x, hit.y, hit.z, BLOCK.air);
					const bEv = {
						x: hit.x,
						y: hit.y,
						z: hit.z,
						id
					};
					res.broke = bEv;
					this.cbBreak?.(bEv);
					this.mineKey = "none";
					this.mineHits = 0;
				}
			}
		} else {
			this.mineKey = "none";
			this.mineHits = 0;
		}
		this.placeCd -= dt;
		if (hit && input.placing && !res.blocked && this.placeCd <= 0) {
			this.vox.set(px, py, pz, this.block);
			this.placeCd = this.o.placeRate;
			const pEv = {
				x: px,
				y: py,
				z: pz,
				id: this.block
			};
			res.placed = pEv;
			this.cbPlace?.(pEv);
		}
		return res;
	}
};
//#endregion
//#region src/lib/underwater3d.ts
var CAUS = (strength) => ({
	strength,
	scale: 18,
	speed: 1,
	rgbSplit: .0016,
	maxDepth: 20
});
/** Start values — Rich retunes by eye. BRIGHT-BY-DEFAULT: the original
* triplets came from physical Jerlov tables (red dead in ~5 m) and read as
* instant murk in a GAME — the references (stylised reef shots) have almost
* no view extinction at all. `murk` keeps the heavy physical feel. */
var UNDERWATER_PRESETS = {
	reef: {
		sigma: [
			.055,
			.028,
			.014
		],
		sunSigma: [
			.045,
			.02,
			.011
		],
		waterColor: "#2f9fc4",
		maxView: 170,
		caustics: CAUS(1),
		snell: true,
		vignette: .12,
		grade: .2
	},
	ocean: {
		sigma: [
			.11,
			.055,
			.032
		],
		sunSigma: [
			.08,
			.035,
			.02
		],
		waterColor: "#1f7ba0",
		maxView: 110,
		caustics: CAUS(.8),
		snell: true,
		vignette: .2,
		grade: .4
	},
	pool: {
		sigma: [
			.03,
			.016,
			.01
		],
		sunSigma: [
			.03,
			.014,
			.008
		],
		waterColor: "#4cc4e4",
		maxView: 220,
		caustics: CAUS(1.2),
		snell: true,
		vignette: .1,
		grade: .15
	},
	murk: {
		sigma: [
			.6,
			.25,
			.15
		],
		sunSigma: [
			.3,
			.16,
			.1
		],
		waterColor: "#3d5544",
		maxView: 18,
		caustics: CAUS(.3),
		snell: true,
		vignette: .4,
		grade: .85
	}
};
/** The submersion decision. Hysteresis: the camera must cross `hysteresis`
* BEYOND the surface line to flip state, so a hull bobbing exactly at the
* waterline never strobes the whole effect on and off. `depth` is how far the
* camera sits below the surface (0 when above). */
function submersionState(prev, camY, surfY, hysteresis) {
	let submerged = prev;
	if (prev) {
		if (camY > surfY + hysteresis) submerged = false;
	} else if (camY < surfY - hysteresis) submerged = true;
	const depth = Math.max(0, surfY - camY);
	return {
		submerged,
		depth
	};
}
/** Per-channel Beer–Lambert transmittance exp(-σ·dist) — the CPU replica of
* the shader's extinction law (used for the fog-colour darkening). */
function absorb(sigma, dist) {
	const d = Math.max(0, dist);
	return [
		Math.exp(-sigma[0] * d),
		Math.exp(-sigma[1] * d),
		Math.exp(-sigma[2] * d)
	];
}
var clamp01 = (v) => v < 0 ? 0 : v > 1 ? 1 : v;
var hex2 = (v) => {
	const n = Math.round(clamp01(v) * 255);
	return (n < 16 ? "0" : "") + n.toString(16);
};
var toHex = (r, g, b) => `#${hex2(r)}${hex2(g)}${hex2(b)}`;
/** The GENTLE base tint every existing 3D shader gets for free: the water
* colour, darkened with depth by the downwelling law and desaturated toward
* grey-green by storm, over a fog band that closes in with σ and storm. The
* composite owns the per-channel extinction; this only has to make the murk,
* translucents, beams and particles agree with the underwater look. */
function underwaterFog(opts, depth, storm) {
	const wc = rgba(opts.waterColor);
	const t = absorb(opts.sunSigma, depth);
	const s = clamp01(storm);
	const grey = (wc[0] + wc[1] + wc[2]) / 3;
	const desat = (c) => c + (grey - c) * s * .5;
	const dim = 1 - .2 * s;
	const dk = (v) => .06 + .94 * Math.pow(Math.max(v, 0), 1.8);
	const r = desat(wc[0]) * dk(t[0]) * dim;
	const g = desat(wc[1]) * dk(t[1]) * dim;
	const b = desat(wc[2]) * dk(t[2]) * dim;
	const sigMax = Math.max(opts.sigma[0], opts.sigma[1], opts.sigma[2]) * (1 + s) || .001;
	const ck = clamp01(depth / 3);
	const surfaceOpen = 4 - 3 * (ck * ck * (3 - 2 * ck));
	const tAvg = (t[0] + t[1] + t[2]) / 3;
	const darkClose = .25 + .75 * Math.pow(tAvg, 1.2);
	const far = Math.min(opts.maxView * surfaceOpen / (1 + s * .8), 25 / sigMax) * darkClose;
	return {
		color: toHex(r, g, b),
		near: far * .02,
		far
	};
}
/** One Hoskins caustic field, size×size texels over one tile, row-major.
* Values are the raw pattern (mostly 0..1 with sparkle peaks above 1). Pure +
* deterministic for the dist tests; `t` picks the phase slice to bake. */
function bakeCausticField(size = 256, t = 1) {
	const TAU = Math.PI * 2;
	const inten = .005;
	const out = new Float32Array(size * size);
	for (let y = 0; y < size; y++) {
		const py = (y + .5) / size * TAU - 250;
		for (let x = 0; x < size; x++) {
			const px = (x + .5) / size * TAU - 250;
			let ix = px, iy = py, c = 1;
			for (let k = 0; k < 5; k++) {
				const nx = px + Math.cos(t - ix) + Math.sin(t + iy);
				const ny = py + Math.sin(t - iy) + Math.cos(t + ix);
				ix = nx;
				iy = ny;
				c += 1 / Math.hypot(px / (Math.sin(ix + t) / inten), py / (Math.cos(iy + t) / inten));
			}
			c /= 5;
			c = 1.17 - Math.pow(c, 1.4);
			out[y * size + x] = Math.pow(Math.abs(c), 8);
		}
	}
	return out;
}
/** Bake the field into an r8unorm texture with a full 2×2-box mip chain (the
* seabed recedes to the fog line — unmipped taps shimmer). The u8 texel stores
* value/2 so the >1 sparkle peaks survive quantisation; the mesh FS multiplies
* the tap by 2 to undo it. */
function createCausticTexture(device, size = 256) {
	const mips = 1 + Math.floor(Math.log2(size));
	const tex = device.createTexture({
		size: {
			width: size,
			height: size
		},
		format: "rg8unorm",
		mipLevelCount: mips,
		usage: BITS.TEXTURE_BINDING | 2
	});
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
		device.queue.writeTexture({
			texture: tex,
			mipLevel: m
		}, bytes, { bytesPerRow: w * 2 }, {
			width: w,
			height: w
		});
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
	return tex;
}
/** Returned by `world.underwater()`. Read `submerged`/`depth`; every option
* below is a live-mutable field (no rebuild). */
var Underwater3d = class {
	water;
	enable;
	minDepth;
	sigma;
	sunSigma;
	waterColor;
	clarity;
	maxView;
	caustics;
	causticsOn;
	snell;
	rays;
	/** Underwater shaft brightness multiplier (rays: { intensity }). */
	rayStrength = .8;
	/** 0..1 — how much of the surface web sheds visible columns (rays:
	* { quantity }). 0 = a few hot cells only, 1 = most of the web. */
	rayQuantity = .45;
	/** World units below the flat water level at which the beam tops start.
	* 0 = right up in the waves (Rich's preference for the ABZU wall); raise
	* to pull the tops down away from the surface. */
	rayBand = 0;
	/** Shaft arc PACKING in world units — smaller = MANY more, tighter beams
	* in the ring (the ABZU wall is a dense field, not a few streaks). */
	rayGap = 12;
	/** Shaft FLICKER 0..2 — the beams do NOT move; they FADE in and out on
	* their own phase+speed, like a long streak of piano keys constantly
	* playing (Rich/ABZU). 0 = all steady on; 1 = gentle; 2 = frantic. */
	rayFlicker = .7;
	/** WALL DISTANCE (world units): the ring of beams sits this far from the
	* camera and follows it — "just out of reach". Raise to push the wall of
	* light further back. */
	rayNear = 40;
	vignette;
	grade;
	wobble;
	/** Read-only, updated each tick. */
	submerged = false;
	/** Camera depth below the surface (0 when above). */
	depth = 0;
	/** Whether the composite pass should run this frame (submerged, or within a
	* small band above the surface so the crossing splits cleanly). */
	active = false;
	/** 0 near the surface → 1 fully under (drives whole-frame vs split mask). */
	fullUnder = 0;
	/** The surface height used for the mask this tick. */
	surfaceY = 0;
	/** Caustics run whenever the body exists and the sun is up — NOT tied to the
	* camera being submerged (the seabed dapples when seen from ABOVE too). */
	causticActive = false;
	/** Storm- and sun-coupled caustic values, refreshed each tick. */
	causticStrengthNow = 0;
	causticSpeedNow = 1;
	/** The fog to apply while submerged (recomputed each tick). */
	fogNow = {
		color: "#0b0e1a",
		near: 0,
		far: 1
	};
	dead = false;
	/** True when no explicit waterColor was given: the palette then FOLLOWS
	* the water body's tint (seaColor dial and all) every tick. */
	autoColor;
	constructor(opts = {}, water = null) {
		const p = UNDERWATER_PRESETS[opts.preset ?? "reef"];
		this.water = opts.water ?? water;
		this.enable = opts.enable ?? "auto";
		this.minDepth = opts.minDepth ?? .75;
		this.sigma = opts.sigma ? [...opts.sigma] : [...p.sigma];
		this.sunSigma = opts.sunSigma ? [...opts.sunSigma] : [...p.sunSigma];
		this.autoColor = opts.waterColor === void 0;
		this.waterColor = opts.waterColor ?? p.waterColor;
		this.clarity = opts.clarity ?? 1;
		this.maxView = opts.maxView ?? p.maxView;
		const c = opts.caustics;
		this.causticsOn = c !== false;
		this.caustics = {
			...p.caustics,
			...typeof c === "object" ? c : {}
		};
		this.snell = opts.snell ?? p.snell;
		this.rays = opts.rays !== false;
		this.rayStrength = typeof opts.rays === "object" && opts.rays.intensity !== void 0 ? opts.rays.intensity : .8;
		if (typeof opts.rays === "object" && opts.rays.quantity !== void 0) this.rayQuantity = opts.rays.quantity;
		this.vignette = opts.vignette ?? p.vignette;
		this.grade = opts.grade ?? p.grade;
		this.wobble = Math.min(.003, Math.max(0, opts.wobble ?? 0));
	}
	/** Apply a named preset over the live fields (keeps `water`/`enable`). */
	setPreset(name) {
		const p = UNDERWATER_PRESETS[name];
		if (!p) return;
		this.sigma = [...p.sigma];
		this.sunSigma = [...p.sunSigma];
		this.waterColor = p.waterColor;
		this.maxView = p.maxView;
		this.caustics = { ...p.caustics };
		this.vignette = p.vignette;
		this.grade = p.grade;
	}
	/** 0 near the surface → 1 at snorkel-to-dive depth: the preset optics are
	* tuned for BEING DOWN there — applied at full strength the moment the
	* camera dips under, ankle-deep water at a beach slammed to instant murk.
	* Updated each tick from camera depth; scales the view extinction. */
	shallowK = 1;
	/** σ scaled by the clarity dial (0 = crystal, 1 = as authored) and the
	* shallow-water ramp (ankle-deep = near-clear, diving = full preset). */
	viewSigma() {
		const k = clamp01(this.clarity) * (.22 + .78 * this.shallowK);
		return [
			this.sigma[0] * k,
			this.sigma[1] * k,
			this.sigma[2] * k
		];
	}
	/** Downwelling sigma scaled by clarity and the shallow ramp — the dial and
	* snorkel depth brighten the sun-fade the same way they thin the murk. */
	sunSigmaNow() {
		const k = (.3 + .7 * clamp01(this.clarity)) * (.35 + .65 * this.shallowK);
		return [
			this.sunSigma[0] * k,
			this.sunSigma[1] * k,
			this.sunSigma[2] * k
		];
	}
	/** Update submersion state + the fog for this frame. Pure w.r.t. the world:
	* the caller reads `submerged`/`fogNow`/`active` and applies them. `surfY`
	* is the exact wave height at the camera column (water.heightAt); `sunI` is
	* the world sun intensity (0 at night → no caustics). */
	tick(camX, camY, camZ, surfY, storm, sunI = 1) {
		const s = clamp01(storm);
		const sK = clamp01(sunI);
		this.causticActive = this.enable !== false && this.causticsOn && !!this.water && sK > .01;
		this.causticStrengthNow = this.caustics.strength * (1 - .7 * s) * sK;
		this.causticSpeedNow = this.caustics.speed * (1 + s * .6);
		const w = this.water;
		const bodyDeepEnough = !w || w.kind !== "grid" || !w.ground ? true : w.levelNow() - w.ground(camX, camZ) >= this.minDepth;
		if (this.enable === false || !bodyDeepEnough) {
			this.submerged = false;
			this.active = false;
			this.depth = 0;
			this.fullUnder = 0;
			return;
		}
		this.surfaceY = surfY;
		if (this.enable === true) {
			this.submerged = true;
			this.depth = Math.max(0, surfY - camY);
		} else {
			const st = submersionState(this.submerged, camY, surfY, .1);
			this.submerged = st.submerged;
			this.depth = st.depth;
		}
		const below = surfY - camY;
		this.active = this.enable === true || below > -.6;
		this.fullUnder = clamp01(below / .5);
		const dk = clamp01(this.depth / 3);
		this.shallowK = dk * dk * (3 - 2 * dk);
		const wb = this.water;
		if (this.autoColor && wb?.shallow && wb?.deep) {
			const sh = rgba(wb.shallow), dp = rgba(wb.deep);
			const lift = (a, b) => clamp01((a * .7 + b * .3) * 1.35);
			this.waterColor = toHex(lift(sh[0], dp[0]), lift(sh[1], dp[1]), lift(sh[2], dp[2]));
		}
		this.fogNow = underwaterFog({
			waterColor: this.waterColor,
			sunSigma: this.sunSigmaNow(),
			sigma: this.viewSigma(),
			maxView: this.maxView
		}, this.depth, storm);
	}
	/** God-ray shaft modulation while submerged (M4): reuse the surface god-ray
	* pass but ATTENUATE it by the downwelling law (shafts die with depth) and
	* TINT it toward the water hue. Null when not submerged or rays disabled —
	* the caller leaves the surface shafts untouched. */
	shaftMod() {
		if (!this.submerged || !this.rays) return null;
		const t = absorb(this.sunSigma, this.depth);
		const wc = rgba(this.waterColor);
		return {
			atten: (t[0] + t[1] + t[2]) / 3,
			tint: [
				wc[0],
				wc[1],
				wc[2]
			]
		};
	}
	kill() {
		this.dead = true;
	}
};
var UU_FLOATS = 36;
function underwaterWGSL(ms) {
	return `
struct UU {
  invVP: mat4x4f,
  cam: vec4f,        // xyz camera, w = on (0/1)
  sigma: vec4f,      // rgb view extinction, w = surfaceY
  sunSigma: vec4f,   // rgb downwelling, w = fullUnder (0..1)
  water: vec4f,      // rgb murk colour, w = grade
  screen: vec4f,     // feather, meniscus, vignette, wobble
}
@group(0) @binding(0) var<uniform> uu: UU;
@group(0) @binding(1) var depthTex: ${ms ? "texture_depth_multisampled_2d" : "texture_depth_2d"};
@group(0) @binding(4) var shaftTex: texture_2d<f32>;    // half-res billboard shaft target
@group(0) @binding(5) var shaftSamp: sampler;           // clamp + linear

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

fn worldAt(uv: vec2f, d: f32) -> vec3f {
  let ndc = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, d, 1.0);
  let w = uu.invVP * ndc;
  return w.xyz / w.w;
}

// Everything both draws share: the per-pixel reconstruction, the waterline
// mask, the transmittances. Returns (below, transmit.rgb, viewTransAvg) via
// out params packed into two vec4s to keep it branch-light.
struct Terms {
  below: f32,
  transmit: vec3f,   // per-channel scene multiplier before the mask
  inscat: vec3f,     // per-channel in-scatter (before the mask)
  meniscus: f32,
}

fn terms(in: VSOut) -> Terms {
  var t: Terms;
  // The depth texel for this fullscreen fragment, from its uv.
  let dims = vec2i(textureDimensions(depthTex));
  let px = clamp(vec2i(in.uv * vec2f(dims)), vec2i(0), dims - 1);
  let d = textureLoad(depthTex, px, 0);
  let world = worldAt(in.uv, d);
  let viewDist = max(distance(uu.cam.xyz, world), 1e-4);
  let rayDir = (world - uu.cam.xyz) / viewDist;
  // ABSORB ONLY THE UNDERWATER PART OF THE RAY. The opaque depth knows
  // nothing about the (translucent) water surface: for every ceiling pixel
  // it reports the terrain or sky FAR BEHIND it, so exp(-sigma*~900) slammed
  // the whole from-below view to murk at ANY clarity (Rich: waves visible
  // only at exactly clarity 0). Rays that exit the surface are clamped at
  // the analytic waterline plane — light from above is only attenuated
  // below it.
  var wDist = viewDist;
  if (rayDir.y > 1e-4) {
    wDist = min(wDist, max(uu.sigma.w - uu.cam.y, 0.0) / rayDir.y);
  }
  let hit = uu.cam.xyz + rayDir * wDist;
  let pd = max(0.0, uu.sigma.w - hit.y);              // receiver depth below surface
  let sunTint = exp(-uu.sunSigma.rgb * pd);
  let viewTrans = exp(-uu.sigma.rgb * wDist);

  // Soft vignette, slightly bottom-weighted (murk gathers at the edges).
  let r = length((in.uv - vec2f(0.5, 0.44)) * vec2f(1.15, 1.0));
  let vig = 1.0 - uu.screen.z * smoothstep(0.28, 0.85, r);

  t.transmit = sunTint * viewTrans * vig;
  t.inscat = uu.water.rgb * (1.0 - viewTrans);

  // Waterline mask — RAY-BASED: a pixel is "underwater view" when the view
  // ray is below the surface right AT THE CAMERA, not when its geometry is.
  // The first cut masked on scene height, which is true for the whole seabed
  // seen through the water from above — the entire shallows slammed to murk
  // the moment the camera came near the line, double-fogging what the water
  // surface shader already renders (Rich: "instant murk with the ball still
  // half above water"). Sampling the ray a short step from the camera gives
  // the crossing split for free and leaves above-water views untouched.
  let rayY = uu.cam.y + rayDir.y * 0.35;
  var below = smoothstep(-0.08, 0.08, uu.sigma.w - rayY);
  below = max(below, uu.sunSigma.w);                  // fullUnder
  t.below = below * uu.cam.w;                         // × on
  // A thin bright meniscus band right at the crossing (only near the line).
  let men = smoothstep(0.16, 0.0, abs(uu.sigma.w - rayY));
  t.meniscus = men * uu.screen.y * (1.0 - uu.sunSigma.w) * uu.cam.w;
  return t;
}

// MULTIPLY draw: out = dst * mix(1, transmit, below). Blend zero/src.
@fragment
fn fsMul(in: VSOut) -> @location(0) vec4f {
  let t = terms(in);
  let m = mix(vec3f(1.0), t.transmit, t.below);
  return vec4f(m, 1.0);
}

// ADD draw: out = dst + below*inscatter + shafts + meniscus. Blend one/one.
@fragment
fn fsAdd(in: VSOut) -> @location(0) vec4f {
  let t = terms(in);
  var add = t.inscat * t.below + uu.water.rgb * (t.meniscus * 0.6) + vec3f(t.meniscus * 0.25);
  // Shafts: a 9-tap bilinear blur of the half-res billboard shaft target —
  // each tap already averages 4 texels, so this is ~a 7x7 full-res kernel.
  // Smooth by construction; beams are soft light, blur only helps them.
  let ts = 1.0 / vec2f(textureDimensions(shaftTex));
  var sh = textureSampleLevel(shaftTex, shaftSamp, in.uv, 0.0).r * 0.2;
  sh += textureSampleLevel(shaftTex, shaftSamp, in.uv + vec2f(1.5 * ts.x, 0.5 * ts.y), 0.0).r * 0.1;
  sh += textureSampleLevel(shaftTex, shaftSamp, in.uv + vec2f(-1.5 * ts.x, -0.5 * ts.y), 0.0).r * 0.1;
  sh += textureSampleLevel(shaftTex, shaftSamp, in.uv + vec2f(-0.5 * ts.x, 1.5 * ts.y), 0.0).r * 0.1;
  sh += textureSampleLevel(shaftTex, shaftSamp, in.uv + vec2f(0.5 * ts.x, -1.5 * ts.y), 0.0).r * 0.1;
  sh += textureSampleLevel(shaftTex, shaftSamp, in.uv + vec2f(2.5 * ts.x, -1.5 * ts.y), 0.0).r * 0.1;
  sh += textureSampleLevel(shaftTex, shaftSamp, in.uv + vec2f(-2.5 * ts.x, 1.5 * ts.y), 0.0).r * 0.1;
  sh += textureSampleLevel(shaftTex, shaftSamp, in.uv + vec2f(1.5 * ts.x, 2.5 * ts.y), 0.0).r * 0.1;
  sh += textureSampleLevel(shaftTex, shaftSamp, in.uv + vec2f(-1.5 * ts.x, -2.5 * ts.y), 0.0).r * 0.1;
  let shaftCol = mix(vec3f(1.0), uu.water.rgb, 0.45);
  add += shaftCol * sh;
  return vec4f(add, 0.0);
}
`;
}
var MAX_SHAFTS = 640;
var SB_FLOATS = 52;
/** Stable per-cell hash → [0,1). Keeps each WORLD cell's shaft identical as
* the follow-grid recenters, so shafts never twinkle or swim. */
function cellHash(ix, iz, seed) {
	let h = ix * 374761393 + iz * 668265263 + seed * 1274126177 | 0;
	h = Math.imul(h ^ h >>> 13, 1274126177);
	h = (h ^ h >>> 16) >>> 0;
	return h / 4294967296;
}
function shaftBillWGSL(ms) {
	return `
struct SB {
  viewProj: mat4x4f,
  invVP: mat4x4f,
  cam: vec4f,          // xyz camera
  sun: vec4f,          // xyz refracted sun-DOWN dir (normalised), w = intensity
  sunCol: vec4f,       // rgb sun colour, w = time
  parm: vec4f,         // level, band, sunSigma, depthCap
  fade: vec4f,         // nearStart, softK, farFade, unused
}
@group(0) @binding(0) var<uniform> sb: SB;
@group(0) @binding(1) var<storage, read> insts: array<vec4f>;   // 2 vec4/instance
@group(0) @binding(2) var depthTex: ${ms ? "texture_depth_multisampled_2d" : "texture_depth_2d"};

struct VSOut {
  @builtin(position) pos: vec4f,
  @location(0) uv: vec2f,
  @location(1) world: vec3f,
  @location(2) bright: f32,
}

fn worldAt(uv: vec2f, d: f32) -> vec3f {
  let ndc = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, d, 1.0);
  let w = sb.invVP * ndc;
  return w.xyz / w.w;
}

@vertex
fn vs(@builtin(vertex_index) vi: u32, @builtin(instance_index) ii: u32) -> VSOut {
  let p0 = insts[ii * 2u];        // baseX, baseZ, length, width
  let p1 = insts[ii * 2u + 1u];   // phase, brightness, -, -
  var corners = array<vec2f, 6>(
    vec2f(0.0, 0.0), vec2f(1.0, 0.0), vec2f(0.0, 1.0),
    vec2f(0.0, 1.0), vec2f(1.0, 0.0), vec2f(1.0, 1.0));
  let uv = corners[vi];
  let level = sb.parm.x;
  let band = sb.parm.y;
  // Shaft top starts a wave-band below the flat level (clears the ripples).
  let base = vec3f(p0.x, level - band, p0.y);
  let axis = normalize(sb.sun.xyz + vec3f(0.0, -1e-3, 0.0));   // down the sun
  let toCam = sb.cam.xyz - base;
  var right = cross(axis, toCam);
  let rl = length(right);
  right = select(vec3f(1.0, 0.0, 0.0), right / rl, rl > 1e-4);  // cylindrical billboard
  let along = uv.y * p0.z;
  let widen = 1.0 - uv.y * 0.35;                                // taper to a point (streak)
  // The shaft does NOT MOVE (Rich/ABZU: beams fade, they do not sway). Fixed
  // world geometry — so nothing can scroll.
  let world = base + axis * along + right * (uv.x - 0.5) * p0.w * widen;
  // PIANO-KEYS FLICKER: each beam fades in and out on its OWN phase+speed,
  // irregular (two incommensurate sines), spending time near zero so the
  // field constantly "plays". rayFlicker (fade.w) scales how deep it dips.
  let time = sb.sunCol.w;
  let flick = clamp(sb.fade.w, 0.0, 2.0);
  let spd = max(p1.z, 0.3) * (0.7 + 0.3 * flick);
  let t2 = time * spd;
  let raw = smoothstep(-0.35, 0.65, sin(t2 + p1.x) + 0.55 * sin(t2 * 0.63 + p1.x * 2.1));
  let pulse = mix(1.0, raw, min(flick, 1.0));                   // flick 0 = steady on
  var o: VSOut;
  o.pos = sb.viewProj * vec4f(world, 1.0);
  o.uv = uv;
  o.world = world;
  o.bright = p1.y * pulse;
  return o;
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let level = sb.parm.x;
  let sunSig = sb.parm.z;
  let cap = sb.parm.w;
  // Across-width soft edge, and a length fade: in just below the top, out
  // toward the bottom (shafts brightest near the surface, dissolving down).
  let edge = smoothstep(0.5, 0.1, abs(in.uv.x - 0.5));
  // Each beam dissolves at its OWN tip (its length is capped above the seabed
  // in pack()), so this bottom taper is the seabed fade — smooth, per-beam.
  let lenF = smoothstep(0.0, 0.1, in.uv.y) * (1.0 - smoothstep(0.5, 1.0, in.uv.y));
  let depthBelow = max(level - in.world.y, 0.0);
  let beer = exp(-sunSig * depthBelow);                        // dim with depth
  let capF = 1.0 - smoothstep(cap * 0.55, cap, depthBelow);    // dead by torch depth
  // SEABED FADE: the beam fades to TRANSPARENT as it APPROACHES the seabed,
  // dissolving cleanly ABOVE the floor rather than punching into it (ABZU;
  // subtle but matters in shallow water). fade.y is the fade distance: fully
  // gone AT the seabed, ramping to full over the last fade.y units above it
  // (and hidden entirely when behind, gap < 0).
  // The half-res target is quarter-area of the depth texture: full-res px =
  // half-res fragcoord x2.
  let dims = vec2i(textureDimensions(depthTex));
  let px = clamp(vec2i(in.pos.xy * 2.0), vec2i(0), dims - 1);
  let sceneD = textureLoad(depthTex, px, 0);
  let sceneW = worldAt(in.pos.xy * 2.0 / vec2f(dims), sceneD);
  let fragDist = distance(sb.cam.xyz, in.world);
  let sceneDist = distance(sb.cam.xyz, sceneW);
  let softZ = smoothstep(0.0, sb.fade.y, sceneDist - fragDist);
  // SAFE-DISTANCE near fade: beams FADE OUT as they approach the camera and
  // only appear beyond fade.x, so a cluster never fills the viewport — the
  // field stays a nice distance away as ONE clean layer (Rich/ABZU). Far
  // fade dissolves the grid-edge beams.
  let nearF = smoothstep(sb.fade.x, sb.fade.x + 24.0, fragDist);
  let farF = 1.0 - smoothstep(sb.fade.z * 0.75, sb.fade.z, distance(sb.cam.xz, in.world.xz));
  // PALE: the field is many faint beams that SUM softly, not a few bright
  // streaks — 0.5 keeps a single beam subtle so overlaps read as glow.
  let a = 0.5 * edge * lenF * beer * capF * softZ * nearF * farF * in.bright * sb.sun.w;
  return vec4f(a, 0.0, 0.0, 1.0);                              // additive scalar light
}
`;
}
var Underwater3dLayer = class {
	format;
	/** Set by pack() each frame from the handle; composite() no-ops when off. */
	active = false;
	/** The baked tileable caustic pattern — world3d hands this to Lights3d so
	* the mesh FS (group(1) bindings 5/6) can tap it. Recreated on device loss;
	* the owner must re-call lights3d.setCaustic after rebuild(). */
	causticView;
	device;
	mulPipeline;
	mulPipelineMS;
	addPipeline;
	addPipelineMS;
	layout;
	layoutMS;
	uniforms;
	linearSamp;
	shaftTarget = null;
	shaftView = null;
	dummyShaft;
	shaftDrawn = false;
	data = new Float32Array(UU_FLOATS);
	bilPipeline;
	bilPipelineMS;
	bilLayout;
	bilLayoutMS;
	sbUniform;
	instBuffer;
	sbData = new Float32Array(SB_FLOATS);
	instData = new Float32Array(MAX_SHAFTS * 8);
	shaftCount = 0;
	constructor(device, format) {
		this.format = format;
		this.rebuild(device);
	}
	/** Pack the composite uniforms for this frame from the live handle. `vp` is
	* this frame's view-projection (inverted here for world reconstruction).
	* `sun` is the world light DIRECTION (pointing down-scene), `sunI` its
	* intensity (0 at night), `time` the wall clock for the shaft drift. */
	pack(uw, vp, eye, sun = {
		x: 0,
		y: -1,
		z: 0
	}, sunI = 1, time = 0, storm = 0) {
		this.active = uw.active;
		if (!uw.active) return;
		const inv = mat4Inverse(vp);
		const sig = uw.viewSigma();
		const wc = rgba(uw.fogNow.color);
		const d = this.data;
		d.set(inv, 0);
		d.set([
			eye.x,
			eye.y,
			eye.z,
			1
		], 16);
		d.set([
			sig[0],
			sig[1],
			sig[2],
			uw.surfaceY
		], 20);
		const ss = uw.sunSigmaNow();
		d.set([
			ss[0],
			ss[1],
			ss[2],
			uw.fullUnder
		], 24);
		d.set([
			wc[0],
			wc[1],
			wc[2],
			uw.grade
		], 28);
		const feather = .12 + uw.fullUnder * .4;
		const meniscus = .5 * (1 - uw.fullUnder);
		d.set([
			feather,
			meniscus,
			uw.vignette,
			uw.wobble
		], 32);
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
		this.device.queue.writeBuffer(this.uniforms, 0, d);
		const reach = 30 + 14 * Math.min(1, Math.max(0, uw.clarity));
		const radius = Math.max(uw.rayNear, 6);
		const beamSpacing = Math.max(uw.rayGap * .12, 1.2);
		const N = Math.min(MAX_SHAFTS, Math.max(24, Math.round(2 * Math.PI * radius / beamSpacing)));
		const TAU = 2 * Math.PI;
		const sb = this.sbData;
		sb.set(vp, 0);
		sb.set(inv, 16);
		sb.set([
			eye.x,
			eye.y,
			eye.z,
			0
		], 32);
		const rr = 1 / 1.333;
		let ddx = sun.x / sl * rr, ddy = sun.y / sl, ddz = sun.z / sl * rr;
		const ddl = Math.hypot(ddx, ddy, ddz) || 1;
		sb.set([
			ddx / ddl,
			ddy / ddl,
			ddz / ddl,
			shaftI
		], 36);
		sb.set([
			1,
			1,
			1,
			time
		], 40);
		sb.set([
			flatLevel,
			uw.rayBand,
			uw.sunSigma[1] * .6,
			reach
		], 44);
		sb.set([
			radius * .15,
			6,
			radius * 1.9,
			uw.rayFlicker
		], 48);
		this.device.queue.writeBuffer(this.sbUniform, 0, sb);
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
			this.device.queue.writeBuffer(this.instBuffer, 0, this.instData, 0, n * 8);
		}
		this.shaftCount = n;
	}
	/** Draw the BILLBOARD shafts into the half-res r8 target (additive),
	* encoder-level, BEFORE the scene pass that composites+blurs them. */
	renderShafts(encoder, worldDepth, canvasW, canvasH) {
		this.shaftDrawn = false;
		if (!this.active) return;
		const w = Math.max(1, canvasW >> 1), h = Math.max(1, canvasH >> 1);
		if (!this.shaftTarget || this.shaftTarget.width !== w || this.shaftTarget.height !== h) {
			this.shaftTarget?.destroy();
			this.shaftTarget = this.device.createTexture({
				size: {
					width: w,
					height: h
				},
				format: "r8unorm",
				usage: BITS.RENDER_ATTACHMENT | BITS.TEXTURE_BINDING
			});
			this.shaftView = this.shaftTarget.createView();
		}
		const pass = encoder.beginRenderPass({ colorAttachments: [{
			view: this.shaftView,
			loadOp: "clear",
			clearValue: {
				r: 0,
				g: 0,
				b: 0,
				a: 1
			},
			storeOp: "store"
		}] });
		if (this.shaftCount > 0) {
			const ms = worldDepth.sampleCount > 1;
			const bind = this.device.createBindGroup({
				layout: ms ? this.bilLayoutMS : this.bilLayout,
				entries: [
					{
						binding: 0,
						resource: { buffer: this.sbUniform }
					},
					{
						binding: 1,
						resource: { buffer: this.instBuffer }
					},
					{
						binding: 2,
						resource: worldDepth.createView()
					}
				]
			});
			pass.setPipeline(ms ? this.bilPipelineMS : this.bilPipeline);
			pass.setBindGroup(0, bind);
			pass.draw(6, this.shaftCount);
		}
		pass.end();
		this.shaftDrawn = true;
	}
	/** The two blended draws, inside the open scene pass (depth attached
	* read-only; we sample the persistent worldDepth instead). */
	composite(pass, worldDepth) {
		if (!this.active) return;
		const ms = worldDepth.sampleCount > 1;
		const bind = this.device.createBindGroup({
			layout: ms ? this.layoutMS : this.layout,
			entries: [
				{
					binding: 0,
					resource: { buffer: this.uniforms }
				},
				{
					binding: 1,
					resource: worldDepth.createView()
				},
				{
					binding: 4,
					resource: this.shaftDrawn && this.shaftView ? this.shaftView : this.dummyShaft
				},
				{
					binding: 5,
					resource: this.linearSamp
				}
			]
		});
		pass.setBindGroup(0, bind);
		pass.setPipeline(ms ? this.mulPipelineMS : this.mulPipeline);
		pass.draw(3);
		pass.setPipeline(ms ? this.addPipelineMS : this.addPipeline);
		pass.draw(3);
	}
	rebuild(device) {
		this.device = device;
		this.uniforms = device.createBuffer({
			size: UU_FLOATS * 4,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.causticView = createCausticTexture(device, 512).createView();
		this.linearSamp = device.createSampler({
			magFilter: "linear",
			minFilter: "linear"
		});
		this.shaftTarget = null;
		this.shaftView = null;
		this.shaftDrawn = false;
		const dummy = device.createTexture({
			size: {
				width: 1,
				height: 1
			},
			format: "r8unorm",
			usage: BITS.TEXTURE_BINDING | 2
		});
		device.queue.writeTexture({ texture: dummy }, new Uint8Array([0]), {}, {
			width: 1,
			height: 1
		});
		this.dummyShaft = dummy.createView();
		const layoutFor = (multisampled) => device.createBindGroupLayout({ entries: [
			{
				binding: 0,
				visibility: BITS.STAGE_FRAGMENT,
				buffer: { type: "uniform" }
			},
			{
				binding: 1,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {
					sampleType: "depth",
					multisampled
				}
			},
			{
				binding: 4,
				visibility: BITS.STAGE_FRAGMENT,
				texture: {}
			},
			{
				binding: 5,
				visibility: BITS.STAGE_FRAGMENT,
				sampler: {}
			}
		] });
		this.layout = layoutFor(false);
		this.layoutMS = layoutFor(true);
		const make = (ms, entry) => {
			const module = shaderModule(device, underwaterWGSL(ms), `Underwater ${entry}${ms ? "(ms)" : ""}`);
			const blend = entry === "fsMul" ? {
				color: {
					srcFactor: "zero",
					dstFactor: "src"
				},
				alpha: {
					srcFactor: "zero",
					dstFactor: "one"
				}
			} : {
				color: {
					srcFactor: "one",
					dstFactor: "one"
				},
				alpha: {
					srcFactor: "zero",
					dstFactor: "one"
				}
			};
			return device.createRenderPipeline({
				layout: device.createPipelineLayout({ bindGroupLayouts: [ms ? this.layoutMS : this.layout] }),
				vertex: {
					module,
					entryPoint: "vs"
				},
				fragment: {
					module,
					entryPoint: entry,
					targets: [{
						format: this.format,
						blend
					}]
				},
				depthStencil: {
					format: DEPTH_FORMAT$1,
					depthWriteEnabled: false,
					depthCompare: "always"
				},
				primitive: { topology: "triangle-list" }
			});
		};
		this.mulPipeline = make(false, "fsMul");
		this.mulPipelineMS = make(true, "fsMul");
		this.addPipeline = make(false, "fsAdd");
		this.addPipelineMS = make(true, "fsAdd");
		this.sbUniform = device.createBuffer({
			size: SB_FLOATS * 4,
			usage: BITS.UNIFORM | BITS.COPY_DST
		});
		this.instBuffer = device.createBuffer({
			size: MAX_SHAFTS * 8 * 4,
			usage: BITS.STORAGE | BITS.COPY_DST
		});
		const bilLayoutFor = (multisampled) => device.createBindGroupLayout({ entries: [
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
				texture: {
					sampleType: "depth",
					multisampled
				}
			}
		] });
		this.bilLayout = bilLayoutFor(false);
		this.bilLayoutMS = bilLayoutFor(true);
		const makeBil = (ms) => {
			const module = shaderModule(device, shaftBillWGSL(ms), `Underwater shaft billboard${ms ? "(ms)" : ""}`);
			return device.createRenderPipeline({
				layout: device.createPipelineLayout({ bindGroupLayouts: [ms ? this.bilLayoutMS : this.bilLayout] }),
				vertex: {
					module,
					entryPoint: "vs"
				},
				fragment: {
					module,
					entryPoint: "fs",
					targets: [{
						format: "r8unorm",
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
				primitive: {
					topology: "triangle-list",
					cullMode: "none"
				}
			});
		};
		this.bilPipeline = makeBil(false);
		this.bilPipelineMS = makeBil(true);
	}
};
//#endregion
//#region src/lib/agentnav3d.ts
// @vite-ignore variable-URL trap: a literal URL lets vite statically inline the
var corePromise = null;
async function loadNavCore(explicit) {
	if (corePromise) return corePromise;
	corePromise = (async () => {
		const candidates = (explicit ? [explicit] : [
			"./agents-nav-core.mjs",
			"../agents-nav-core.mjs",
			"../../vendor/agents-nav-core.mjs"
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
		throw new Error("agents.navmesh: nav core module not found (agents-nav-core.mjs). " + String(lastErr));
	})();
	return corePromise;
}
/** Triangulate a heightfield region into a navmesh source mesh (CCW-up). */
function terrainMesh(heightAt, size, res, cx = 0, cz = 0) {
	const n = Math.max(2, Math.floor(res));
	const step = size / (n - 1), x0 = cx - size / 2, z0 = cz - size / 2;
	const positions = new Float32Array(n * n * 3);
	for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
		const x = x0 + i * step, z = z0 + j * step, o = (j * n + i) * 3;
		positions[o] = x;
		positions[o + 1] = heightAt(x, z);
		positions[o + 2] = z;
	}
	const indices = new Uint32Array((n - 1) * (n - 1) * 6);
	let k = 0;
	for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
		const a = j * n + i, b = a + 1, c = a + n, d = c + 1;
		indices[k++] = a;
		indices[k++] = c;
		indices[k++] = b;
		indices[k++] = b;
		indices[k++] = c;
		indices[k++] = d;
	}
	return {
		positions,
		indices
	};
}
/** A baked Detour navmesh + query. Implements the `path()` planner contract so
* it drops straight into the `navigate` behaviour (`{ kind:'navigate', grid }`)
* exactly like the built-in NavGrid. */
var NavMesh3d = class {
	/** @internal recast NavMesh */
	raw;
	core;
	query;
	crowds = [];
	ext = {
		x: 4,
		y: 400,
		z: 4
	};
	dead = false;
	constructor(core, navMesh) {
		this.core = core;
		this.raw = navMesh;
		this.query = new core.NavMeshQuery(navMesh);
	}
	/** A uniformly-random point ON the navmesh — for wander/patrol goals that are
	* guaranteed reachable (never inside a wall). Null if the mesh is empty. */
	randomPoint() {
		const r = this.query.findRandomPoint();
		const p = r && r.randomPoint;
		return r && r.success && p ? {
			x: p.x,
			y: p.y,
			z: p.z
		} : null;
	}
	/** Snap a point to the nearest navmesh surface (null if off-mesh). */
	nearest(p) {
		const r = this.query.findClosestPoint({
			x: p.x,
			y: p.y,
			z: p.z
		}, { halfExtents: this.ext });
		return r && r.success ? {
			x: r.point.x,
			y: r.point.y,
			z: r.point.z
		} : null;
	}
	/** Plan a path start→goal as world waypoints (empty when unreachable). The
	* `navigate` behaviour calls this — same contract as NavGrid.path(). */
	path(start, goal) {
		const r = this.query.computePath({
			x: start.x,
			y: start.y,
			z: start.z
		}, {
			x: goal.x,
			y: goal.y,
			z: goal.z
		}, { halfExtents: this.ext });
		const pts = r && (r.path ?? r) || [];
		if (!Array.isArray(pts) || r && r.success === false) return [];
		return pts.map((v) => ({
			x: v.x,
			y: v.y,
			z: v.z
		}));
	}
	/** Create a recast Crowd for dense local avoidance among navmesh agents.
	* (Optional tier — most games use the built-in steering avoidance.) */
	crowd(opts = {}) {
		const c = new Crowd3d(this.core, this.raw, opts);
		this.crowds.push(c);
		return c;
	}
	/** @internal advance any crowds this navmesh owns. */
	tick(dt) {
		for (const c of this.crowds) c.update(dt);
	}
	kill() {
		this.dead = true;
	}
};
/** A thin wrapper over recast's Crowd: add agents bound to a target, step it,
* read back positions. For dense groups that must not interpenetrate. */
var Crowd3d = class {
	raw;
	core;
	agents = [];
	constructor(core, navMesh, opts) {
		this.core = core;
		this.raw = new core.Crowd(navMesh, {
			maxAgents: opts.maxAgents ?? 256,
			maxAgentRadius: opts.maxAgentRadius ?? .6
		});
	}
	/** Add a crowd agent at a world position; returns its index. */
	add(pos, params = {}) {
		const idx = this.raw.addAgent({
			x: pos.x,
			y: pos.y,
			z: pos.z
		}, {
			radius: .6,
			height: 2,
			maxSpeed: 6,
			maxAcceleration: 20,
			...params
		});
		this.agents.push(idx);
		return idx;
	}
	/** Point an agent at a world goal. */
	goto(idx, goal) {
		this.raw.goto?.(idx, {
			x: goal.x,
			y: goal.y,
			z: goal.z
		});
	}
	/** Current world position of a crowd agent. */
	position(idx) {
		const p = this.raw.getAgentPosition(idx);
		return {
			x: p.x,
			y: p.y,
			z: p.z
		};
	}
	update(dt) {
		this.raw.update(dt);
	}
};
/** Bake a NavMesh3d from geometry (loads the vendored core on first use). */
async function buildNavMesh(opts) {
	const core = await loadNavCore(opts.module);
	let positions = opts.positions, indices = opts.indices;
	if ((!positions || !indices) && opts.from === "terrain") {
		if (!opts.heightAt || !opts.size) throw new Error("agents.navmesh({from:\"terrain\"}) needs heightAt + size");
		const m = terrainMesh(opts.heightAt, opts.size, opts.res ?? 64, opts.center?.x ?? 0, opts.center?.z ?? 0);
		positions = m.positions;
		indices = m.indices;
	}
	if (!positions || !indices) throw new Error("agents.navmesh needs { positions, indices } or { from:\"terrain\", heightAt, size }");
	const cs = opts.cellSize ?? .3, ch = opts.cellHeight ?? .2;
	const cfg = {
		cs,
		ch,
		walkableSlopeAngle: opts.agentMaxSlope ?? 50,
		walkableHeight: Math.ceil((opts.agentHeight ?? 2) / ch),
		walkableClimb: Math.floor((opts.agentMaxClimb ?? .9) / ch),
		walkableRadius: Math.ceil((opts.agentRadius ?? .6) / cs)
	};
	const res = core.generateSoloNavMesh(positions, indices, cfg);
	if (!res.success) throw new Error("agents.navmesh: recast bake failed — " + (res.error ?? "no walkable polygons (check mesh winding is CCW-up and slope/agent params)"));
	return new NavMesh3d(core, res.navMesh);
}
//#endregion
//#region src/lib/agents3d.ts
var PRIORITY = {
	avoid: 4,
	terrain: 4,
	ceiling: 4,
	contain: 4,
	edge: 4,
	flock: 2,
	leader: 2,
	seek: 1,
	flee: 1,
	arrive: 1,
	pursue: 1,
	evade: 1,
	wander: 1,
	follow: 1,
	navigate: 1,
	flow: 1,
	custom: 1
};
var vlen = (x, y, z) => Math.hypot(x, y, z);
var clamp = (v, a, b) => v < a ? a : v > b ? b : v;
/** Deterministic per-agent PRNG (mulberry32) — reproducible wander. */
function mulberry32(seed) {
	let a = seed >>> 0;
	return () => {
		a |= 0;
		a = a + 1831565813 | 0;
		let t = Math.imul(a ^ a >>> 15, 1 | a);
		t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
function targetPos(t) {
	if (typeof t === "function") return t();
	if (t instanceof Agent3d) return t.pos;
	return t;
}
var HASH_P1 = 73856093;
var HASH_P2 = 19349663;
var HASH_P3 = 83492791;
var SpatialHash3 = class {
	cellSize;
	tableSize;
	mask;
	counts;
	starts;
	items;
	cellOf;
	seenBuckets = /* @__PURE__ */ new Int32Array(27);
	/** drop the Y dimension for surface-bound swarms (ground crowds). */
	flat = false;
	constructor(cellSize, capacity, tablePow = 12) {
		this.cellSize = Math.max(.001, cellSize);
		this.tableSize = 1 << tablePow;
		this.mask = this.tableSize - 1;
		this.counts = new Int32Array(this.tableSize + 1);
		this.starts = new Int32Array(this.tableSize + 1);
		this.items = new Int32Array(Math.max(1, capacity));
		this.cellOf = new Int32Array(Math.max(1, capacity));
	}
	key(x, y, z) {
		const inv = 1 / this.cellSize;
		const ix = Math.floor(x * inv) | 0;
		const iy = this.flat ? 0 : Math.floor(y * inv) | 0;
		const iz = Math.floor(z * inv) | 0;
		return (Math.imul(ix, HASH_P1) ^ Math.imul(iy, HASH_P2) ^ Math.imul(iz, HASH_P3)) >>> 0 & this.mask;
	}
	/** Rebuild from the live agent positions (indices 0..n-1). */
	build(agents) {
		const n = agents.length;
		if (this.items.length < n) {
			this.items = new Int32Array(n);
			this.cellOf = new Int32Array(n);
		}
		this.counts.fill(0);
		for (let i = 0; i < n; i++) {
			const p = agents[i].pos;
			const c = this.key(p.x, p.y, p.z);
			this.cellOf[i] = c;
			this.counts[c]++;
		}
		let acc = 0;
		for (let c = 0; c <= this.tableSize; c++) {
			this.starts[c] = acc;
			acc += this.counts[c];
		}
		const cursor = this.counts;
		for (let c = 0; c < this.tableSize; c++) cursor[c] = this.starts[c];
		for (let i = 0; i < n; i++) {
			const c = this.cellOf[i];
			this.items[cursor[c]++] = i;
		}
	}
	/** Nearest up-to-k neighbours of agent `self` within `radius`, written into
	* `outIdx` (indices) / `outD2` (squared distances); returns the count. */
	query(agents, self, radius, k, outIdx, outD2) {
		const p = agents[self].pos;
		const r2 = radius * radius;
		const inv = 1 / this.cellSize;
		const cx = Math.floor(p.x * inv) | 0;
		const cy = this.flat ? 0 : Math.floor(p.y * inv) | 0;
		const cz = Math.floor(p.z * inv) | 0;
		let count = 0;
		const ylo = this.flat ? 0 : -1, yhi = this.flat ? 0 : 1;
		const seen = this.seenBuckets;
		let seenN = 0;
		for (let dz = -1; dz <= 1; dz++) for (let dy = ylo; dy <= yhi; dy++) for (let dx = -1; dx <= 1; dx++) {
			const c = (Math.imul(cx + dx, HASH_P1) ^ Math.imul(cy + dy, HASH_P2) ^ Math.imul(cz + dz, HASH_P3)) >>> 0 & this.mask;
			let dup = false;
			for (let q = 0; q < seenN; q++) if (seen[q] === c) {
				dup = true;
				break;
			}
			if (dup) continue;
			seen[seenN++] = c;
			const s = this.starts[c], e = this.starts[c + 1];
			for (let ii = s; ii < e; ii++) {
				const j = this.items[ii];
				if (j === self) continue;
				const q = agents[j].pos;
				const d2 = (q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2;
				if (d2 > r2) continue;
				count = insertNearest(outIdx, outD2, count, k, j, d2);
			}
		}
		return Math.min(count, k);
	}
};
/** Brute-force nearest-k (small flocks skip the hash — the physics.ts lesson). */
function neighborsBrute(agents, self, radius, k, outIdx, outD2) {
	const p = agents[self].pos;
	const r2 = radius * radius;
	let count = 0;
	for (let j = 0; j < agents.length; j++) {
		if (j === self) continue;
		const q = agents[j].pos;
		const d2 = (q.x - p.x) ** 2 + (q.y - p.y) ** 2 + (q.z - p.z) ** 2;
		if (d2 > r2) continue;
		count = insertNearest(outIdx, outD2, count, k, j, d2);
	}
	return Math.min(count, k);
}
/** Partial insertion sort keeping the k smallest d2 — no allocation. */
function insertNearest(outIdx, outD2, count, k, j, d2) {
	if (count < k) {
		let i = count;
		while (i > 0 && outD2[i - 1] > d2) {
			outD2[i] = outD2[i - 1];
			outIdx[i] = outIdx[i - 1];
			i--;
		}
		outD2[i] = d2;
		outIdx[i] = j;
		return count + 1;
	}
	if (d2 >= outD2[k - 1]) return count;
	let i = k - 1;
	while (i > 0 && outD2[i - 1] > d2) {
		outD2[i] = outD2[i - 1];
		outIdx[i] = outIdx[i - 1];
		i--;
	}
	outD2[i] = d2;
	outIdx[i] = j;
	return count;
}
var Field3d = class {
	pos;
	follow;
	radius;
	strength;
	falloff;
	mode;
	dead = false;
	constructor(o) {
		this.pos = o.pos ? { ...o.pos } : {
			x: 0,
			y: 0,
			z: 0
		};
		this.follow = o.follow ?? null;
		this.radius = o.radius;
		this.strength = o.strength;
		this.falloff = o.falloff ?? "invsq";
		this.mode = o.mode ?? "attract";
	}
	at() {
		return this.follow ?? this.pos;
	}
	kill() {
		this.dead = true;
	}
};
var Obstacle3d = class {
	sphere;
	box;
	dead = false;
	constructor(o) {
		this.sphere = o.sphere ?? null;
		this.box = o.box ?? null;
	}
	kill() {
		this.dead = true;
	}
};
var AGENT_ID = 1;
var Agent3d = class {
	id;
	pos;
	prev;
	vel;
	maxSpeed;
	maxForce;
	mass;
	behaviors;
	handle;
	tickEvery;
	turnRate;
	maxPitch;
	bank;
	ground;
	yaw = 0;
	pitch = 0;
	roll = 0;
	/** panic timer (s) — a repulsor spike scatters a shoal (speed x panicMult). */
	panic = 0;
	/** wander target on the projected sphere (persisted for a smooth walk). */
	wx = 1;
	wy = 0;
	wz = 0;
	/** follow-behaviour progress along its path (world distance). */
	followD = 0;
	/** avoid-behaviour hysteresis: the committed dodge side (±1) + its hold timer,
	* so the agent arcs around an obstacle on ONE side instead of jittering. */
	avoidSide = 0;
	avoidHold = 0;
	/** navigate-behaviour state: the current A* waypoint list + cursor + timers. */
	navPath = null;
	navIdx = 0;
	navTimer = 0;
	navGoalX = 0;
	navGoalZ = 0;
	/** per-instance wiggle phase (fish tail / wing flap) — rides a spare slot. */
	phase = 0;
	rng;
	dead = false;
	/** last accumulated steering force (for gizmos). */
	force = {
		x: 0,
		y: 0,
		z: 0
	};
	constructor(c = {}) {
		this.id = AGENT_ID++;
		this.pos = c.pos ? { ...c.pos } : {
			x: 0,
			y: 0,
			z: 0
		};
		this.prev = { ...this.pos };
		this.vel = c.vel ? { ...c.vel } : {
			x: 0,
			y: 0,
			z: 0
		};
		this.maxSpeed = c.maxSpeed ?? 6;
		this.maxForce = c.maxForce ?? 20;
		this.mass = Math.max(.001, c.mass ?? 1);
		this.behaviors = (c.behaviors ?? []).slice().sort((a, b) => (b.priority ?? PRIORITY[b.kind] ?? 1) - (a.priority ?? PRIORITY[a.kind] ?? 1));
		this.handle = c.handle ?? null;
		this.tickEvery = Math.max(1, Math.floor(c.tickEvery ?? 1));
		this.turnRate = c.turnRate ?? 6;
		this.maxPitch = c.maxPitch ?? Math.PI / 2;
		this.bank = c.bank ?? 0;
		this.ground = c.ground ? {
			at: c.ground.at,
			offset: c.ground.offset ?? 0,
			slope: c.ground.slope ?? false
		} : null;
		this.rng = mulberry32((c.seed ?? this.id) >>> 0);
		this.phase = this.rng() * Math.PI * 2;
		const d = this.wander0();
		this.wx = d.x;
		this.wy = d.y;
		this.wz = d.z;
	}
	wander0() {
		const a = this.rng() * Math.PI * 2;
		return {
			x: Math.cos(a),
			y: 0,
			z: Math.sin(a)
		};
	}
	get speed() {
		return vlen(this.vel.x, this.vel.y, this.vel.z);
	}
	kill() {
		this.dead = true;
	}
};
var S = {
	x: 0,
	y: 0,
	z: 0
};
var ACC = {
	x: 0,
	y: 0,
	z: 0
};
/** Compute ONE behaviour's desired steering force into `out` (unweighted). */
function behaviorForce(a, b, ctx, dt, out) {
	out.x = 0;
	out.y = 0;
	out.z = 0;
	switch (b.kind) {
		case "seek":
			seekInto(a, targetPos(b.target), out);
			break;
		case "flee":
			fleeInto(a, targetPos(b.target), b.radius ?? Infinity, out);
			break;
		case "arrive":
			arriveInto(a, targetPos(b.target), b.slowRadius ?? 6, b.tolerance ?? .3, out);
			break;
		case "pursue": {
			const t = b.target;
			const tp = t.pos;
			const tv = t.vel;
			const dist = vlen(tp.x - a.pos.x, tp.y - a.pos.y, tp.z - a.pos.z);
			const pred = Math.min(dist / Math.max(a.maxSpeed, .001), b.maxPredict ?? 1);
			seekInto(a, {
				x: tp.x + tv.x * pred,
				y: tp.y + tv.y * pred,
				z: tp.z + tv.z * pred
			}, out);
			break;
		}
		case "evade": {
			const t = b.target;
			const tp = t.pos;
			const tv = t.vel;
			const dist = vlen(tp.x - a.pos.x, tp.y - a.pos.y, tp.z - a.pos.z);
			if (dist > (b.radius ?? Infinity)) break;
			const pred = Math.min(dist / Math.max(a.maxSpeed, .001), b.maxPredict ?? 1);
			fleeInto(a, {
				x: tp.x + tv.x * pred,
				y: tp.y + tv.y * pred,
				z: tp.z + tv.z * pred
			}, Infinity, out);
			break;
		}
		case "wander":
			wanderInto(a, b, out);
			break;
		case "flock":
			flockInto(a, b, ctx, out);
			break;
		case "avoid":
			avoidInto(a, b, ctx, dt, out);
			break;
		case "terrain": {
			const la = b.lookAhead ?? 1;
			const px = a.pos.x + a.vel.x * la, pz = a.pos.z + a.vel.z * la;
			const floor = b.groundAt(px, pz) + b.clearance;
			if (a.pos.y < floor) out.y += (floor - a.pos.y) * a.maxForce;
			break;
		}
		case "ceiling": {
			const cap = typeof b.below === "number" ? b.below : b.below(a.pos.x, a.pos.z);
			const m = b.margin ?? 0;
			if (a.pos.y > cap - m) out.y -= (a.pos.y - (cap - m)) * a.maxForce;
			break;
		}
		case "contain":
			containInto(a, b, out);
			break;
		case "leader": {
			const l = b.leader;
			const behind = b.behind ?? 2;
			const s = l.speed || 1;
			const bx = l.vel.x / s, bz = l.vel.z / s;
			arriveInto(a, {
				x: l.pos.x - bx * behind,
				y: l.pos.y,
				z: l.pos.z - bz * behind
			}, 3, .2, out);
			break;
		}
		case "follow":
			followInto(a, b, dt, out);
			break;
		case "edge":
			edgeInto(a, b, out);
			break;
		case "navigate":
			navigateInto(a, b, dt, out);
			break;
		case "flow": {
			const d = b.field.dirAt(a.pos.x, a.pos.z);
			const l = Math.hypot(d.x, d.z);
			if (l > 1e-4) {
				out.x += d.x / l * a.maxSpeed - a.vel.x;
				out.z += d.z / l * a.maxSpeed - a.vel.z;
			}
			break;
		}
		case "custom":
			b.fn(a, out, dt);
			break;
	}
}
function seekInto(a, t, out) {
	let dx = t.x - a.pos.x, dy = t.y - a.pos.y, dz = t.z - a.pos.z;
	const l = vlen(dx, dy, dz) || 1;
	dx = dx / l * a.maxSpeed;
	dy = dy / l * a.maxSpeed;
	dz = dz / l * a.maxSpeed;
	out.x += dx - a.vel.x;
	out.y += dy - a.vel.y;
	out.z += dz - a.vel.z;
}
function fleeInto(a, t, radius, out) {
	let dx = a.pos.x - t.x, dy = a.pos.y - t.y, dz = a.pos.z - t.z;
	const l = vlen(dx, dy, dz);
	if (l > radius || l < 1e-5) return;
	dx = dx / l * a.maxSpeed;
	dy = dy / l * a.maxSpeed;
	dz = dz / l * a.maxSpeed;
	out.x += dx - a.vel.x;
	out.y += dy - a.vel.y;
	out.z += dz - a.vel.z;
}
function arriveInto(a, t, slow, tol, out) {
	const dx = t.x - a.pos.x, dy = t.y - a.pos.y, dz = t.z - a.pos.z;
	const dist = vlen(dx, dy, dz);
	if (dist < tol) {
		out.x -= a.vel.x;
		out.y -= a.vel.y;
		out.z -= a.vel.z;
		return;
	}
	const k = a.maxSpeed * (dist < slow ? dist / slow : 1) / dist;
	out.x += dx * k - a.vel.x;
	out.y += dy * k - a.vel.y;
	out.z += dz * k - a.vel.z;
}
function wanderInto(a, b, out) {
	const jitter = b.jitter ?? .6, radius = b.radius ?? 1.2, distance = b.distance ?? 2, vertical = b.vertical ?? 0;
	a.wx += (a.rng() * 2 - 1) * jitter;
	a.wy += (a.rng() * 2 - 1) * jitter * vertical;
	a.wz += (a.rng() * 2 - 1) * jitter;
	const l = vlen(a.wx, a.wy, a.wz) || 1;
	a.wx /= l;
	a.wy /= l;
	a.wz /= l;
	let hx = a.vel.x, hy = a.vel.y, hz = a.vel.z;
	const hl = vlen(hx, hy, hz);
	if (hl < 1e-4) {
		hx = 1;
		hy = 0;
		hz = 0;
	} else {
		hx /= hl;
		hy /= hl;
		hz /= hl;
	}
	seekInto(a, {
		x: a.pos.x + hx * distance + a.wx * radius,
		y: a.pos.y + hy * distance + a.wy * radius,
		z: a.pos.z + hz * distance + a.wz * radius
	}, out);
}
function flockInto(a, b, ctx, out) {
	const n = ctx.nCount;
	if (n === 0) return;
	const sepW = b.separation ?? 1.5, aliW = b.alignment ?? 1, cohW = b.cohesion ?? 1;
	const sepDist = (b.radius ?? 6) * .5;
	let sx = 0, sy = 0, sz = 0, ax = 0, ay = 0, az = 0, cx = 0, cy = 0, cz = 0;
	for (let i = 0; i < n; i++) {
		const o = ctx.agents[ctx.nIdx[i]];
		const d = Math.sqrt(ctx.nD2[i]) || 1e-4;
		if (d < sepDist) {
			const w = (sepDist - d) / sepDist;
			sx += (a.pos.x - o.pos.x) / d * w;
			sy += (a.pos.y - o.pos.y) / d * w;
			sz += (a.pos.z - o.pos.z) / d * w;
		}
		ax += o.vel.x;
		ay += o.vel.y;
		az += o.vel.z;
		cx += o.pos.x;
		cy += o.pos.y;
		cz += o.pos.z;
	}
	const sl = vlen(sx, sy, sz);
	if (sl > 1e-5) {
		out.x += (sx / sl * a.maxSpeed - a.vel.x) * sepW;
		out.y += (sy / sl * a.maxSpeed - a.vel.y) * sepW;
		out.z += (sz / sl * a.maxSpeed - a.vel.z) * sepW;
	}
	const al = vlen(ax, ay, az);
	if (al > 1e-5) {
		out.x += (ax / al * a.maxSpeed - a.vel.x) * aliW;
		out.y += (ay / al * a.maxSpeed - a.vel.y) * aliW;
		out.z += (az / al * a.maxSpeed - a.vel.z) * aliW;
	}
	cx /= n;
	cy /= n;
	cz /= n;
	const tmp = {
		x: 0,
		y: 0,
		z: 0
	};
	arriveInto(a, {
		x: cx,
		y: cy,
		z: cz
	}, 5, .1, tmp);
	out.x += tmp.x * cohW;
	out.y += tmp.y * cohW;
	out.z += tmp.z * cohW;
}
function avoidInto(a, b, ctx, dt, out) {
	const sp = a.speed;
	const feel = (b.lookAhead ?? 2) * (.5 + .5 * sp / Math.max(a.maxSpeed, .001));
	const margin = b.radius ?? .8;
	let hx = a.vel.x, hz = a.vel.z;
	const hl = Math.hypot(hx, hz);
	if (hl < 1e-4) {
		avoidCooldown(a, dt);
		return;
	}
	hx /= hl;
	hz /= hl;
	let bestT = feel + 1e9, hasThreat = false, cx = 0, cz = 0;
	for (const ob of ctx.obstacles) {
		if (ob.dead || !ob.sphere) continue;
		const c = ob.sphere.center, R = ob.sphere.radius + margin;
		const tox = c.x - a.pos.x, toz = c.z - a.pos.z;
		const along = tox * hx + toz * hz;
		if (along < -R || along > feel + R) continue;
		const perp = Math.abs(tox * hz - toz * hx);
		if (perp >= R) continue;
		const t = along - Math.sqrt(Math.max(R * R - perp * perp, 0));
		if (t < bestT) {
			bestT = t;
			hasThreat = true;
			cx = c.x;
			cz = c.z;
		}
	}
	if (!hasThreat) {
		avoidCooldown(a, dt);
		return;
	}
	const rx = hz, rz = -hx;
	if (a.avoidHold <= 0 || a.avoidSide === 0) a.avoidSide = (a.pos.x - cx) * rx + (a.pos.z - cz) * rz >= 0 ? 1 : -1;
	a.avoidHold = .5;
	const urgency = clamp(1 - bestT / Math.max(feel, .001), .35, 1);
	const s = a.avoidSide;
	out.x += rx * s * a.maxForce * urgency;
	out.z += rz * s * a.maxForce * urgency;
	let ax = a.pos.x - cx, az = a.pos.z - cz;
	const al = Math.hypot(ax, az) || 1;
	out.x += ax / al * a.maxForce * urgency * .5;
	out.z += az / al * a.maxForce * urgency * .5;
}
/** Decay the committed dodge side once the threat is gone (no jitter re-arm). */
function avoidCooldown(a, dt) {
	a.avoidHold -= dt;
	if (a.avoidHold <= 0) a.avoidSide = 0;
}
function edgeInto(a, b, out) {
	const la = b.lookAhead ?? 2.5;
	let hx = a.vel.x, hz = a.vel.z;
	const hl = Math.hypot(hx, hz);
	if (hl < 1e-4) {
		hx = 1;
		hz = 0;
	} else {
		hx /= hl;
		hz /= hl;
	}
	const rx = hz, rz = -hx;
	if (!b.walkable(a.pos.x + hx * la, a.pos.z + hz * la)) {
		const rOk = b.walkable(a.pos.x + rx * la, a.pos.z + rz * la);
		const lOk = b.walkable(a.pos.x - rx * la, a.pos.z - rz * la);
		const side = rOk && !lOk ? 1 : lOk && !rOk ? -1 : rOk ? 1 : -1;
		out.x += (rx * side - hx) * a.maxForce;
		out.z += (rz * side - hz) * a.maxForce;
	} else {
		if (!b.walkable(a.pos.x + rx * la, a.pos.z + rz * la)) {
			out.x -= rx * a.maxForce * .7;
			out.z -= rz * a.maxForce * .7;
		}
		if (!b.walkable(a.pos.x - rx * la, a.pos.z - rz * la)) {
			out.x += rx * a.maxForce * .7;
			out.z += rz * a.maxForce * .7;
		}
	}
}
function containInto(a, b, out) {
	const soft = b.soft ?? 2;
	if (b.box) {
		const { min, max } = b.box;
		if (a.pos.x < min.x + soft) out.x += a.maxForce * (1 - (a.pos.x - min.x) / soft);
		if (a.pos.x > max.x - soft) out.x -= a.maxForce * (1 - (max.x - a.pos.x) / soft);
		if (a.pos.y < min.y + soft) out.y += a.maxForce * (1 - (a.pos.y - min.y) / soft);
		if (a.pos.y > max.y - soft) out.y -= a.maxForce * (1 - (max.y - a.pos.y) / soft);
		if (a.pos.z < min.z + soft) out.z += a.maxForce * (1 - (a.pos.z - min.z) / soft);
		if (a.pos.z > max.z - soft) out.z -= a.maxForce * (1 - (max.z - a.pos.z) / soft);
	}
	if (b.sphere) {
		const c = b.sphere.center;
		const dx = a.pos.x - c.x, dy = a.pos.y - c.y, dz = a.pos.z - c.z;
		const d = vlen(dx, dy, dz);
		if (d > b.sphere.radius - soft) {
			const k = -a.maxForce * clamp((d - (b.sphere.radius - soft)) / soft, 0, 1) / (d || 1);
			out.x += dx * k;
			out.y += dy * k;
			out.z += dz * k;
		}
	}
}
function navigateInto(a, b, dt, out) {
	const goal = targetPos(b.target);
	a.navTimer -= dt;
	const drifted = Math.hypot(goal.x - a.navGoalX, goal.z - a.navGoalZ) > (b.tolerance ?? 3);
	if (!a.navPath || a.navPath.length === 0 || a.navTimer <= 0 || drifted) {
		a.navPath = b.grid.path(a.pos, goal);
		a.navIdx = 0;
		a.navTimer = b.repathEvery ?? .6;
		a.navGoalX = goal.x;
		a.navGoalZ = goal.z;
	}
	const path = a.navPath;
	if (!path || path.length === 0) {
		seekInto(a, goal, out);
		return;
	}
	const reach = Math.max(a.maxSpeed * .2, 1);
	while (a.navIdx < path.length - 1) {
		const w = path[a.navIdx];
		if (Math.hypot(a.pos.x - w.x, a.pos.z - w.z) < reach) a.navIdx++;
		else break;
	}
	const w = path[Math.min(a.navIdx, path.length - 1)];
	if (a.navIdx >= path.length - 1 && b.arrive) arriveInto(a, w, b.arrive, 1, out);
	else arriveInto(a, w, Math.max(a.maxSpeed * .5, 3), .1, out);
}
function followInto(a, b, dt, out) {
	const path = b.path;
	const speed = b.speed ?? a.maxSpeed;
	a.followD += speed * dt;
	if (a.followD > path.length) a.followD = b.loop ? a.followD % path.length : path.length;
	const ahead = Math.min(a.followD + (b.lookAhead ?? 2), b.loop ? Infinity : path.length);
	const t = path.atDist(b.loop ? ahead % path.length : ahead);
	seekInto(a, {
		x: t.x,
		y: t.y,
		z: t.z
	}, out);
}
/** Fields: attractors pull, repulsors push; a repulsor spike arms panic. */
function applyFields(a, ctx, out) {
	out.x = 0;
	out.y = 0;
	out.z = 0;
	for (const f of ctx.fields) {
		if (f.dead) continue;
		const c = f.at();
		const dx = a.pos.x - c.x, dy = a.pos.y - c.y, dz = a.pos.z - c.z;
		const d = vlen(dx, dy, dz);
		if (d > f.radius || d < 1e-4) continue;
		const t = 1 - d / f.radius;
		const g = f.falloff === "invsq" ? t * t : t;
		const mag = f.strength * g;
		const sign = f.mode === "repel" ? 1 : -1;
		out.x += dx / d * mag * sign;
		out.y += dy / d * mag * sign;
		out.z += dz / d * mag * sign;
		if (f.mode === "repel" && mag > f.strength * .5) a.panic = Math.max(a.panic, 2);
	}
}
/** Integrate one agent for a fixed step, then damp its body language. */
function integrateAgent(a, ctx, dt, solveSteering) {
	a.prev.x = a.pos.x;
	a.prev.y = a.pos.y;
	a.prev.z = a.pos.z;
	if (a.panic > 0) a.panic = Math.max(0, a.panic - dt);
	const panicK = a.panic > 0 ? 2.5 : 1;
	if (solveSteering) {
		ACC.x = 0;
		ACC.y = 0;
		ACC.z = 0;
		let remaining = a.maxForce;
		applyFields(a, ctx, S);
		remaining = accumulate(ACC, S, remaining);
		for (const b of a.behaviors) {
			if (remaining <= 1e-4) break;
			const w = b.weight ?? 1;
			behaviorForce(a, b, ctx, dt, S);
			S.x *= w;
			S.y *= w;
			S.z *= w;
			remaining = accumulate(ACC, S, remaining);
		}
		a.force.x = ACC.x;
		a.force.y = ACC.y;
		a.force.z = ACC.z;
		a.vel.x += ACC.x / a.mass * dt;
		a.vel.y += ACC.y / a.mass * dt;
		a.vel.z += ACC.z / a.mass * dt;
	}
	const sp = vlen(a.vel.x, a.vel.y, a.vel.z);
	const maxS = a.maxSpeed * panicK;
	if (sp > maxS && sp > 1e-6) {
		const k = maxS / sp;
		a.vel.x *= k;
		a.vel.y *= k;
		a.vel.z *= k;
	}
	a.pos.x += a.vel.x * dt;
	a.pos.y += a.vel.y * dt;
	a.pos.z += a.vel.z * dt;
	if (a.ground) {
		a.pos.y = a.ground.at(a.pos.x, a.pos.z) + a.ground.offset;
		a.vel.y = 0;
	}
	a.phase += sp * dt * 3;
}
/** Add `f` to `acc`, truncated so |added| ≤ remaining budget. Returns the new
* remaining budget (Buckland's truncated running sum). */
function accumulate(acc, f, remaining) {
	const mag = vlen(f.x, f.y, f.z);
	if (mag < 1e-6) return remaining;
	const use = Math.min(mag, remaining);
	const k = use / mag;
	acc.x += f.x * k;
	acc.y += f.y * k;
	acc.z += f.z * k;
	return remaining - use;
}
/** Damp the heading toward the velocity (never snap) and write the pose onto
* the render handle, interpolated between the last two sim steps by `alpha`. */
function writePose(a, alpha) {
	const px = a.prev.x + (a.pos.x - a.prev.x) * alpha;
	const py = a.prev.y + (a.pos.y - a.prev.y) * alpha;
	const pz = a.prev.z + (a.pos.z - a.prev.z) * alpha;
	const sp = a.speed;
	const hsp = Math.hypot(a.vel.x, a.vel.z);
	if (sp > .05) {
		const tYaw = Math.atan2(-a.vel.x, a.vel.z);
		let tPitch;
		if (a.ground) if (a.ground.slope && hsp > .001) {
			const hx = a.vel.x / hsp, hz = a.vel.z / hsp, s = 1.2;
			const dh = a.ground.at(a.pos.x + hx * s, a.pos.z + hz * s) - a.ground.at(a.pos.x - hx * s, a.pos.z - hz * s);
			tPitch = clamp(Math.atan2(dh, 2 * s), -a.maxPitch, a.maxPitch);
		} else tPitch = 0;
		else tPitch = clamp(Math.asin(clamp(a.vel.y / sp, -1, 1)), -a.maxPitch, a.maxPitch);
		a.yaw = dampAngle(a.yaw, tYaw, a.turnRate * .05);
		a.pitch += (tPitch - a.pitch) * clamp(a.turnRate * .05, 0, 1);
		if (a.bank > 0) {
			const lat = a.force.x * Math.cos(a.yaw) + a.force.z * Math.sin(a.yaw);
			a.roll += (clamp(-lat * .02 * a.bank, -1, 1) - a.roll) * clamp(a.turnRate * .05, 0, 1);
		}
	}
	const h = a.handle;
	if (h) {
		h.x = px;
		h.y = py;
		h.z = pz;
		if (h.yaw !== void 0) h.yaw = a.yaw;
		if (h.pitch !== void 0) h.pitch = a.pitch;
		if (h.roll !== void 0) h.roll = a.roll;
	}
}
/** Shortest-arc angle damp (handles the ±π wrap). */
function dampAngle(cur, target, k) {
	let d = target - cur;
	while (d > Math.PI) d -= Math.PI * 2;
	while (d < -Math.PI) d += Math.PI * 2;
	return cur + d * clamp(k, 0, 1);
}
var AGENT_PRESETS = {
	firefly: () => ({
		maxSpeed: 3,
		maxForce: 12,
		turnRate: 5,
		maxPitch: 1.2,
		behaviors: [{
			kind: "wander",
			jitter: .9,
			vertical: 1
		}]
	}),
	fish: () => ({
		maxSpeed: 6,
		maxForce: 24,
		turnRate: 6,
		bank: .6,
		maxPitch: .8,
		behaviors: [{
			kind: "wander",
			jitter: .4,
			vertical: .4
		}]
	}),
	shoal: () => ({
		maxSpeed: 7,
		maxForce: 30,
		turnRate: 7,
		bank: .7,
		maxPitch: .7,
		behaviors: [{
			kind: "flock",
			separation: 1.6,
			alignment: 1,
			cohesion: .9,
			radius: 6,
			neighbors: 7
		}, {
			kind: "wander",
			jitter: .3,
			weight: .4
		}]
	}),
	hunter: () => ({
		maxSpeed: 9,
		maxForce: 40,
		turnRate: 8,
		bank: .4,
		behaviors: [{ kind: "avoid" }]
	}),
	bird: () => ({
		maxSpeed: 11,
		maxForce: 30,
		turnRate: 5,
		bank: 1,
		maxPitch: .5,
		behaviors: [{
			kind: "flock",
			separation: 1.4,
			alignment: 1.1,
			cohesion: .8,
			radius: 8,
			neighbors: 7
		}, {
			kind: "wander",
			jitter: .25,
			weight: .3
		}]
	}),
	patrol: () => ({
		maxSpeed: 4,
		maxForce: 16,
		turnRate: 4,
		behaviors: []
	})
};
var Agents3d = class {
	agents = [];
	fields = [];
	obstacles = [];
	/** gizmos through game.debug (velocity/force/neighbours) when true. */
	debug = false;
	fixedDt;
	acc = 0;
	hash;
	hashCell;
	nIdx = /* @__PURE__ */ new Int32Array(64);
	nD2 = /* @__PURE__ */ new Float32Array(64);
	alpha = 1;
	constructor(opts = {}) {
		this.fixedDt = opts.fixedStep ?? 1 / 60;
		this.hashCell = opts.hashCell ?? 8;
		this.hash = new SpatialHash3(this.hashCell, 256);
	}
	spawn(config) {
		const a = new Agent3d(config);
		this.agents.push(a);
		return a;
	}
	/** A flock of `n` agents sharing a config (or bind to existing handles). */
	flock(config, nOrHandles) {
		const base = config.preset ? AGENT_PRESETS[config.preset]() : {};
		const merged = {
			...base,
			...config,
			behaviors: config.behaviors ?? base.behaviors
		};
		const out = [];
		if (typeof nOrHandles === "number") for (let i = 0; i < nOrHandles; i++) out.push(this.spawn({
			...merged,
			seed: (config.seed ?? 1) + i
		}));
		else nOrHandles.forEach((h, i) => out.push(this.spawn({
			...merged,
			handle: h,
			seed: (config.seed ?? 1) + i
		})));
		return out;
	}
	/** Bake a recast NAVMESH (Tier-3) from geometry — real level meshes or a
	* terrain heightfield. Async: lazily loads the vendored WASM core on first
	* call. The result drops into a `navigate` behaviour like a NavGrid:
	*   const nav = await world.agents().navmesh({ from: 'terrain', heightAt, size: 400 });
	*   agents.spawn({ behaviors: [{ kind: 'navigate', grid: nav, target }] }); */
	async navmesh(opts) {
		const nm = await buildNavMesh(opts);
		this.navmeshes.push(nm);
		return nm;
	}
	navmeshes = [];
	attractor(o) {
		const f = new Field3d({
			...o,
			mode: "attract"
		});
		this.fields.push(f);
		return f;
	}
	repulsor(o) {
		const f = new Field3d({
			...o,
			mode: "repel"
		});
		this.fields.push(f);
		return f;
	}
	obstacle(o) {
		const ob = new Obstacle3d(o);
		this.obstacles.push(ob);
		return ob;
	}
	/** Called each display frame by World3d; runs ≤3 fixed steps + interpolates. */
	tick(dt) {
		this.reap();
		for (const nm of this.navmeshes) if (!nm.dead) nm.tick(dt);
		if (!this.agents.length) return;
		this.acc += Math.min(dt, .1);
		let steps = 0;
		let stepIdx = this._stepIdx ?? 0;
		while (this.acc >= this.fixedDt && steps < 3) {
			this.step(this.fixedDt, stepIdx);
			this.acc -= this.fixedDt;
			steps++;
			stepIdx++;
		}
		this._stepIdx = stepIdx;
		this.alpha = clamp(this.acc / this.fixedDt, 0, 1);
		for (const a of this.agents) writePose(a, this.alpha);
	}
	_stepIdx = 0;
	/** One fixed simulation step (public for dist tests). */
	step(dt, stepIdx = 0) {
		const n = this.agents.length;
		const useHash = n > 40;
		if (this.nIdx.length < 32) {
			this.nIdx = /* @__PURE__ */ new Int32Array(32);
			this.nD2 = /* @__PURE__ */ new Float32Array(32);
		}
		if (useHash) this.hash.build(this.agents);
		const ctx = {
			agents: this.agents,
			fields: this.fields,
			obstacles: this.obstacles,
			nIdx: this.nIdx,
			nD2: this.nD2,
			nCount: 0
		};
		for (let i = 0; i < n; i++) {
			const a = this.agents[i];
			const solve = stepIdx % a.tickEvery === 0;
			if (solve) {
				const fb = a.behaviors.find((b) => b.kind === "flock");
				if (fb) {
					const k = Math.min(fb.neighbors ?? 7, this.nIdx.length);
					const r = fb.radius ?? 6;
					ctx.nCount = useHash ? this.hash.query(this.agents, i, r, k, this.nIdx, this.nD2) : neighborsBrute(this.agents, i, r, k, this.nIdx, this.nD2);
				} else ctx.nCount = 0;
			}
			integrateAgent(a, ctx, dt, solve);
		}
	}
	reap() {
		for (let i = this.agents.length - 1; i >= 0; i--) if (this.agents[i].dead) this.agents.splice(i, 1);
		for (let i = this.fields.length - 1; i >= 0; i--) if (this.fields[i].dead) this.fields.splice(i, 1);
		for (let i = this.obstacles.length - 1; i >= 0; i--) if (this.obstacles[i].dead) this.obstacles.splice(i, 1);
		for (let i = this.navmeshes.length - 1; i >= 0; i--) if (this.navmeshes[i].dead) this.navmeshes.splice(i, 1);
	}
	/** Drop every agent/field/obstacle/navmesh (render handles are yours to kill).
	* Lets a demo tear a scene down and rebuild another. */
	clear() {
		this.agents.length = 0;
		this.fields.length = 0;
		this.obstacles.length = 0;
		this.navmeshes.length = 0;
		this.acc = 0;
		this._stepIdx = 0;
	}
	get count() {
		return this.agents.length;
	}
};
//#endregion
//#region src/lib/ssao.ts
var SAMPLES = 16;
var GOLDEN_ANGLE = 2.399963229728653;
/** The spiral sample offsets baked into the AO shader — deterministic
* (golden-angle spiral, radii √(i/n)), all inside the unit disc. Exported
* for tests. */
function ssaoKernel(n = SAMPLES) {
	const out = [];
	for (let i = 0; i < n; i++) {
		const r = Math.sqrt(i / n);
		const a = i * GOLDEN_ANGLE;
		out.push([r * Math.cos(a), r * Math.sin(a)]);
	}
	return out;
}
var FULLSCREEN_VS = `
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
`;
/** The AO estimate pass. `ms` picks texture_depth_multisampled_2d (loading
* sample 0) vs texture_depth_2d (loading mip 0) — the engine's opaque depth
* target is MSAA by default but sampleCount 1 must work too. */
function buildSsaoWGSL(ms) {
	const taps = ssaoKernel(SAMPLES).map(([x, y]) => `vec2f(${x.toFixed(8)}, ${y.toFixed(8)})`).join(",\n  ");
	return `
struct U {
  invProj: mat4x4f,   // camera inverse projection (view space, NOT inv view-proj)
  proj: mat4x4f,      // camera projection (to re-project sample points to uv)
  params: vec4f,      // x radius (view units), y strength, z power
  depthP: vec4f,      // x projA = far/(near-far), y projB = near*far/(near-far), z far
}
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var depthTex: ${ms ? "texture_depth_multisampled_2d" : "texture_depth_2d"};
${FULLSCREEN_VS}
const KERNEL = array<vec2f, ${SAMPLES}>(
  ${taps}
);

fn viewPos(uv: vec2f, d: f32) -> vec3f {
  let ndc = vec4f(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0, d, 1.0);
  let p = u.invProj * ndc;
  return p.xyz / p.w;
}

// Load depth at a DETERMINISTIC full-res texel and reconstruct the view
// position from that texel's CENTRE uv — depth and uv must describe the
// SAME point. Deriving the texel as vec2i(in.uv * fdims) lands exactly on
// a texel boundary (half-res centre x2 = odd integer): FP rounding then
// picks a different texel per row/column, P jumps a full texel of depth,
// and the dpdx/dpdy normals stripe the whole screen (Rich's banding).
fn surfAt(c: vec2i, dims: vec2i, fdims: vec2f) -> vec4f {
  let cc = clamp(c, vec2i(0), dims - 1);
  // ms: third arg is the sample index; non-ms: the mip level — both 0.
  let d = textureLoad(depthTex, cc, 0);
  let tuv = (vec2f(cc) + 0.5) / fdims;
  return vec4f(viewPos(tuv, d), d);
}

@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let dims = vec2i(textureDimensions(depthTex));
  let fdims = vec2f(dims);
  // Half-res pixel (i, j) reads full-res texel (2i, 2j) — integer maths,
  // no boundary ambiguity.
  let base = vec2i(in.pos.xy) * 2;
  let s0 = surfAt(base, dims, fdims);
  let d = s0.w;
  let P = s0.xyz;

  // View normal from the CLOSER neighbour on each axis (smaller |Δz|), so a
  // silhouette edge — or the thin torus tube — on one side can't drag the
  // normal across the depth gap. The naive cross(dpdy(P), dpdx(P)) reconstructs
  // a wild normal wherever the 2×2 derivative quad straddles an edge, and that
  // garbage normal is what SMEARS AO off objects and streaks curved tubes.
  // Neighbours come from textureLoad (no derivatives), so no uniform-control-
  // flow constraint. Signed to face the camera (view -z ⇒ camera-facing +z).
  let Pr = surfAt(base + vec2i(2, 0), dims, fdims).xyz;
  let Pl = surfAt(base - vec2i(2, 0), dims, fdims).xyz;
  let Pu = surfAt(base + vec2i(0, 2), dims, fdims).xyz;
  let Pd = surfAt(base - vec2i(0, 2), dims, fdims).xyz;
  let ddx = select(P - Pl, Pr - P, abs(Pr.z - P.z) < abs(Pl.z - P.z));
  let ddy = select(P - Pd, Pu - P, abs(Pu.z - P.z) < abs(Pd.z - P.z));
  var N = normalize(cross(ddy, ddx));
  if (N.z < 0.0) { N = -N; }

  if (d <= 0.0 || d >= 1.0) { return vec4f(1.0); }   // sky / cleared: no AO

  // Interleaved-gradient-noise rotation — load-bearing: without the per-pixel
  // spin the shared spiral bands visibly.
  let ign = fract(52.9829189 * fract(0.06711056 * in.pos.x + 0.00583715 * in.pos.y));
  let ang = ign * 6.28318530718;
  let ca = cos(ang);
  let sa = sin(ang);

  // Tangent frame in the surface plane, rotated by the noise angle.
  var up = vec3f(0.0, 1.0, 0.0);
  if (abs(N.y) > 0.9) { up = vec3f(1.0, 0.0, 0.0); }
  let T0 = normalize(cross(up, N));
  let B0 = cross(N, T0);
  let T = T0 * ca + B0 * sa;
  let B = B0 * ca - T0 * sa;

  // ALCHEMY-style estimator: reconstruct the scene point Q at each tap and
  // measure occlusion ALONG THE NORMAL — max(0, dot(Q-P, N) - bias)/|Q-P|².
  // In-plane neighbours give dot(v, N) = 0 exactly, so a surface can never
  // occlude itself, no matter how grazing the view. (The previous test —
  // "is the scene closer than my sample along VIEW-Z" — banded the whole
  // scene at grazing angles: per-pixel depth slope outruns any bias there,
  // striping floors in rows and walls in columns.)
  let radius = u.params.x;
  let bias = 0.02 + 0.002 * abs(P.z);
  var occ = 0.0;
  for (var i = 0u; i < ${SAMPLES}u; i++) {
    let k = KERNEL[i];
    let S = P + (T * k.x + B * k.y) * radius;
    let sc = u.proj * vec4f(S, 1.0);
    if (sc.w <= 0.0) { continue; }
    let sndc = sc.xy / sc.w;
    let suv = vec2f(sndc.x * 0.5 + 0.5, 0.5 - sndc.y * 0.5);
    if (suv.x < 0.0 || suv.x > 1.0 || suv.y < 0.0 || suv.y > 1.0) { continue; }
    let sq = surfAt(vec2i(suv * fdims), dims, fdims);
    if (sq.w <= 0.0 || sq.w >= 1.0) { continue; }
    let Q = sq.xyz;
    let v = Q - P;
    let vv = dot(v, v);
    let vn = dot(v, N);
    // radius/(vv + 0.04r²) keeps the term dimensionless and bounded; taps
    // beyond ~2r contribute ~nothing (natural range falloff, no branch).
    occ += max(0.0, vn - bias) * radius / (vv + 0.04 * radius * radius);
  }
  let ao = clamp(1.0 - u.params.y * 2.0 * occ / ${SAMPLES}.0, 0.0, 1.0);
  // g carries linearised depth (fraction of far) so the BILATERAL blur can
  // refuse to average across silhouettes — a plain blur HALOES objects.
  let zn = clamp(-P.z / u.depthP.z, 0.0, 1.0);
  return vec4f(pow(ao, u.params.z), zn, 0.0, 1.0);
}
`;
}
/** BILATERAL 5-tap cross blur (one H+V ping-pong at half res): taps are
* weighted by depth similarity (the g channel carries linear depth), so AO
* never bleeds across a silhouette — a plain blur draws HALOS around every
* object. Depth passes through for the second axis. */
function buildSsaoBlurWGSL() {
	return `
struct U { texel: vec4f }   // xy = one-texel step along the blur axis
@group(0) @binding(0) var<uniform> u: U;
@group(0) @binding(1) var samp: sampler;
@group(0) @binding(2) var src: texture_2d<f32>;
${FULLSCREEN_VS}
@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let s = u.texel.xy;
  let c0 = textureSample(src, samp, in.uv);
  var acc = c0.r;
  var wsum = 1.0;
  for (var i = -2; i <= 2; i = i + 1) {
    if (i == 0) { continue; }
    let t = textureSample(src, samp, in.uv + s * f32(i));
    // Reject taps more than ~4% of far away in depth — that is another
    // surface, not this one.
    let w = max(0.0, 1.0 - abs(t.g - c0.g) * 24.0);
    acc += t.r * w;
    wsum += w;
  }
  return vec4f(acc / wsum, c0.g, 0.0, 1.0);
}
`;
}
/** Fullscreen multiply-darken: the fragment outputs vec4(ao, ao, ao, 1) and
* the pipeline blends color { srcFactor: 'zero', dstFactor: 'src' } so
* out.rgb = dst.rgb * ao (alpha left untouched). The linear sampler does the
* half→full upscale for free. */
function buildSsaoCompositeWGSL() {
	return `
@group(0) @binding(0) var samp: sampler;
@group(0) @binding(1) var src: texture_2d<f32>;
${FULLSCREEN_VS}
@fragment
fn fs(in: VSOut) -> @location(0) vec4f {
  let ao = textureSample(src, samp, in.uv).r;
  return vec4f(ao, ao, ao, 1.0);
}
`;
}
function mat4Invert(m, out) {
	out[0] = m[5] * m[10] * m[15] - m[5] * m[11] * m[14] - m[9] * m[6] * m[15] + m[9] * m[7] * m[14] + m[13] * m[6] * m[11] - m[13] * m[7] * m[10];
	out[4] = -m[4] * m[10] * m[15] + m[4] * m[11] * m[14] + m[8] * m[6] * m[15] - m[8] * m[7] * m[14] - m[12] * m[6] * m[11] + m[12] * m[7] * m[10];
	out[8] = m[4] * m[9] * m[15] - m[4] * m[11] * m[13] - m[8] * m[5] * m[15] + m[8] * m[7] * m[13] + m[12] * m[5] * m[11] - m[12] * m[7] * m[9];
	out[12] = -m[4] * m[9] * m[14] + m[4] * m[10] * m[13] + m[8] * m[5] * m[14] - m[8] * m[6] * m[13] - m[12] * m[5] * m[10] + m[12] * m[6] * m[9];
	out[1] = -m[1] * m[10] * m[15] + m[1] * m[11] * m[14] + m[9] * m[2] * m[15] - m[9] * m[3] * m[14] - m[13] * m[2] * m[11] + m[13] * m[3] * m[10];
	out[5] = m[0] * m[10] * m[15] - m[0] * m[11] * m[14] - m[8] * m[2] * m[15] + m[8] * m[3] * m[14] + m[12] * m[2] * m[11] - m[12] * m[3] * m[10];
	out[9] = -m[0] * m[9] * m[15] + m[0] * m[11] * m[13] + m[8] * m[1] * m[15] - m[8] * m[3] * m[13] - m[12] * m[1] * m[11] + m[12] * m[3] * m[9];
	out[13] = m[0] * m[9] * m[14] - m[0] * m[10] * m[13] - m[8] * m[1] * m[14] + m[8] * m[2] * m[13] - m[12] * m[2] * m[9] + m[12] * m[1] * m[10];
	out[2] = m[1] * m[6] * m[15] - m[1] * m[7] * m[14] - m[5] * m[2] * m[15] + m[5] * m[3] * m[14] + m[13] * m[2] * m[7] - m[13] * m[3] * m[6];
	out[6] = -m[0] * m[6] * m[15] + m[0] * m[7] * m[14] + m[4] * m[2] * m[15] - m[4] * m[3] * m[14] - m[12] * m[2] * m[7] + m[12] * m[3] * m[6];
	out[10] = m[0] * m[5] * m[15] - m[0] * m[7] * m[13] - m[4] * m[1] * m[15] + m[4] * m[3] * m[13] + m[12] * m[1] * m[7] - m[12] * m[3] * m[5];
	out[14] = -m[0] * m[5] * m[14] + m[0] * m[6] * m[13] + m[4] * m[1] * m[14] - m[4] * m[2] * m[13] - m[12] * m[1] * m[6] + m[12] * m[2] * m[5];
	out[3] = -m[1] * m[6] * m[11] + m[1] * m[7] * m[10] + m[5] * m[2] * m[11] - m[5] * m[3] * m[10] - m[9] * m[2] * m[7] + m[9] * m[3] * m[6];
	out[7] = m[0] * m[6] * m[11] - m[0] * m[7] * m[10] - m[4] * m[2] * m[11] + m[4] * m[3] * m[10] + m[8] * m[2] * m[7] - m[8] * m[3] * m[6];
	out[11] = -m[0] * m[5] * m[11] + m[0] * m[7] * m[9] + m[4] * m[1] * m[11] - m[4] * m[3] * m[9] - m[8] * m[1] * m[7] + m[8] * m[3] * m[5];
	out[15] = m[0] * m[5] * m[10] - m[0] * m[6] * m[9] - m[4] * m[1] * m[10] + m[4] * m[2] * m[9] + m[8] * m[1] * m[6] - m[8] * m[2] * m[5];
	const det = m[0] * out[0] + m[1] * out[4] + m[2] * out[8] + m[3] * out[12];
	if (!det || !Number.isFinite(det)) {
		out.fill(0);
		out[0] = out[5] = out[10] = out[15] = 1;
		return;
	}
	const k = 1 / det;
	for (let i = 0; i < 16; i++) out[i] = out[i] * k;
}
var UNIFORM_FLOATS = 40;
var SsaoPass = class {
	format;
	/** Live-tunable options, read every render. */
	opts = {
		radius: .8,
		strength: 1,
		power: 1.5
	};
	/** Off by default — render()/composite() no-op until switched on. */
	enabled = false;
	device;
	aoPipeline;
	aoPipelineMS;
	aoLayout;
	aoLayoutMS;
	blurPipeline;
	compositePipeline;
	blurLayout;
	compLayout;
	sampler;
	aoUniforms;
	blurUniformsH;
	blurUniformsV;
	targets = null;
	compBind = null;
	rendered = false;
	uniformData = new Float32Array(UNIFORM_FLOATS);
	invProj = /* @__PURE__ */ new Float32Array(16);
	constructor(device, format) {
		this.format = format;
		this.rebuild(device);
	}
	/** Encode the AO estimate (half res, pipeline variant picked by the depth
	* texture's sampleCount) then one H+V blur ping-pong. `proj` is the
	* camera's projection matrix (column-major 16); projA/projB the standard
	* linearisation terms far/(near-far) and near*far/(near-far). */
	render(encoder, depth, proj, projA, projB, canvasW, canvasH) {
		this.rendered = false;
		if (!this.enabled) return;
		const w = Math.max(1, canvasW >> 1), h = Math.max(1, canvasH >> 1);
		if (!this.targets || this.targets[0].width !== w || this.targets[0].height !== h) {
			this.targets?.forEach((t) => t.destroy());
			const make = () => this.device.createTexture({
				size: {
					width: w,
					height: h
				},
				format: "rg8unorm",
				usage: BITS.RENDER_ATTACHMENT | BITS.TEXTURE_BINDING
			});
			this.targets = [make(), make()];
			this.compBind = null;
		}
		const [A, B] = this.targets;
		mat4Invert(proj, this.invProj);
		const u = this.uniformData;
		u.set(this.invProj, 0);
		u.set(proj, 16);
		u[32] = this.opts.radius;
		u[33] = this.opts.strength;
		u[34] = this.opts.power;
		u[35] = 0;
		u[36] = projA;
		u[37] = projB;
		u[38] = projB / (1 + projA);
		u[39] = 0;
		this.device.queue.writeBuffer(this.aoUniforms, 0, u);
		const ms = depth.sampleCount > 1;
		const aoBind = this.device.createBindGroup({
			layout: ms ? this.aoLayoutMS : this.aoLayout,
			entries: [{
				binding: 0,
				resource: { buffer: this.aoUniforms }
			}, {
				binding: 1,
				resource: depth.createView()
			}]
		});
		const p1 = encoder.beginRenderPass({ colorAttachments: [{
			view: A.createView(),
			loadOp: "clear",
			clearValue: {
				r: 1,
				g: 1,
				b: 1,
				a: 1
			},
			storeOp: "store"
		}] });
		p1.setPipeline(ms ? this.aoPipelineMS : this.aoPipeline);
		p1.setBindGroup(0, aoBind);
		p1.draw(3);
		p1.end();
		this.device.queue.writeBuffer(this.blurUniformsH, 0, new Float32Array([
			1 / w,
			0,
			0,
			0
		]));
		this.device.queue.writeBuffer(this.blurUniformsV, 0, new Float32Array([
			0,
			1 / h,
			0,
			0
		]));
		this.blurTo(encoder, A, B, this.blurUniformsH);
		this.blurTo(encoder, B, A, this.blurUniformsV);
		this.rendered = true;
	}
	blurTo(encoder, from, to, uniforms) {
		const bind = this.device.createBindGroup({
			layout: this.blurLayout,
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
				r: 1,
				g: 1,
				b: 1,
				a: 1
			},
			storeOp: "store"
		}] });
		pass.setPipeline(this.blurPipeline);
		pass.setBindGroup(0, bind);
		pass.draw(3);
		pass.end();
	}
	/** Multiply the blurred AO into the open scene pass (which has a depth
	* attachment — the pipeline declares depth24plus, write off, compare
	* always). Skips when disabled or nothing rendered this frame. */
	composite(pass) {
		if (!this.enabled || !this.rendered || !this.targets) return;
		if (!this.compBind) this.compBind = this.device.createBindGroup({
			layout: this.compLayout,
			entries: [{
				binding: 0,
				resource: this.sampler
			}, {
				binding: 1,
				resource: this.targets[0].createView()
			}]
		});
		pass.setPipeline(this.compositePipeline);
		pass.setBindGroup(0, this.compBind);
		pass.draw(3);
	}
	rebuild(device) {
		this.device = device;
		this.targets = null;
		this.compBind = null;
		this.rendered = false;
		this.sampler = device.createSampler({
			magFilter: "linear",
			minFilter: "linear"
		});
		const depthLayout = (multisampled) => device.createBindGroupLayout({ entries: [{
			binding: 0,
			visibility: BITS.STAGE_FRAGMENT,
			buffer: { type: "uniform" }
		}, {
			binding: 1,
			visibility: BITS.STAGE_FRAGMENT,
			texture: {
				sampleType: "depth",
				multisampled
			}
		}] });
		this.aoLayout = depthLayout(false);
		this.aoLayoutMS = depthLayout(true);
		this.blurLayout = device.createBindGroupLayout({ entries: [
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
		this.compLayout = device.createBindGroupLayout({ entries: [{
			binding: 0,
			visibility: BITS.STAGE_FRAGMENT,
			sampler: {}
		}, {
			binding: 1,
			visibility: BITS.STAGE_FRAGMENT,
			texture: {}
		}] });
		const aoPipe = (layout, ms) => {
			const mod = shaderModule(device, buildSsaoWGSL(ms), ms ? "SsaoAO(ms)" : "SsaoAO");
			return device.createRenderPipeline({
				layout: device.createPipelineLayout({ bindGroupLayouts: [layout] }),
				vertex: {
					module: mod,
					entryPoint: "vs"
				},
				fragment: {
					module: mod,
					entryPoint: "fs",
					targets: [{ format: "rg8unorm" }]
				},
				primitive: { topology: "triangle-list" }
			});
		};
		this.aoPipeline = aoPipe(this.aoLayout, false);
		this.aoPipelineMS = aoPipe(this.aoLayoutMS, true);
		const blurMod = shaderModule(device, buildSsaoBlurWGSL(), "SsaoBlur");
		this.blurPipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.blurLayout] }),
			vertex: {
				module: blurMod,
				entryPoint: "vs"
			},
			fragment: {
				module: blurMod,
				entryPoint: "fs",
				targets: [{ format: "rg8unorm" }]
			},
			primitive: { topology: "triangle-list" }
		});
		const compMod = shaderModule(device, buildSsaoCompositeWGSL(), "SsaoComposite");
		this.compositePipeline = device.createRenderPipeline({
			layout: device.createPipelineLayout({ bindGroupLayouts: [this.compLayout] }),
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
							srcFactor: "zero",
							dstFactor: "src"
						},
						alpha: {
							srcFactor: "zero",
							dstFactor: "one"
						}
					}
				}]
			},
			depthStencil: {
				format: "depth24plus",
				depthWriteEnabled: false,
				depthCompare: "always"
			},
			primitive: { topology: "triangle-list" }
		});
		this.aoUniforms = device.createBuffer({
			size: UNIFORM_FLOATS * 4,
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
	}
};
//#endregion
export { gerstnerY as $, BLOCKS as A, deformPatchVerts as At, halveRGBA as B, AnimatedModel3d as Bt, absorb as C, DeformMap as Ct, VoxelEditor as D, bakeColormapPixels as Dt, underwaterFog as E, Terrain3d as Et, VoxelBody as F, VectorShape3d as Ft, RIPPLE_TILE as G, parseGlb as Gt, raycastVoxel as H, cpuSkin as Ht, VoxelWorld as I, buildLine3dWGSL as It, Water3d as J, Particles3d as Jt, WATER_PRESETS as K, parseMtl as Kt, Voxels3d as L, polylinesToSegs as Lt, TILES as M, pickChunks as Mt, VOX_FLOATS as N, LINE3D_FLOATS as Nt, AO_LEVELS as O, bakeGrainField as Ot, VoxelAgent as P, Vector3dLayer as Pt, gerstnerXZ as Q, bakeTiles as R, wireframeEdges as Rt, Underwater3dLayer as S, zSlice as St, submersionState as T, TERRAIN_SURFACES as Tt, vertexAO as U, fitVerts as Ut, meshChunk as V, Model3d as Vt, voxelTerrain as W, rgbHex as Wt, WaterWell as X, OrbitRig as Xt, Water3dLayer as Y, SurfaceSampler as Yt, bakeRippleField as Z, scaleAboutPoint as Zt, NavMesh3d as _, binLightsCpu as _t, ssaoKernel as a, constellationDirs as at, UNDERWATER_PRESETS as b, froxelBounds as bt, Agents3d as c, CLUSTER_X as ct, SpatialHash3 as d, LIGHT_FLOATS as dt, ribbonVerts as et, dampAngle as f, LU_FLOATS as ft, Crowd3d as g, MAX_PER_CLUSTER as gt, writePose as h, MAX_LIGHTS as ht, buildSsaoWGSL as i, Sky3dLayer as it, FACES as j, hash2 as jt, BLOCK as k, chunkVerts as kt, Field3d as l, CLUSTER_Y as lt, neighborsBrute as m, Lights3d as mt, buildSsaoBlurWGSL as n, steepNorm as nt, AGENT_PRESETS as o, skyState as ot, integrateAgent as p, Light3d as pt, WATER_TINTS as q, parseObj as qt, buildSsaoCompositeWGSL as r, Sky3d as rt, Agent3d as s, CLUSTER_COUNT as st, SsaoPass as t, rippleFbm as tt, Obstacle3d as u, CLUSTER_Z as ut, buildNavMesh as v, buildClusterWGSL as vt, bakeCausticField as w, Heightfield as wt, Underwater3d as x, selectLights as xt, terrainMesh as y, clusterNear as yt, faceTile as z, loadModelData as zt };

//# sourceMappingURL=shared-D9JZoPnb.js.map
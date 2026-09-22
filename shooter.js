//#region src/packs/shooter.ts
var Rng = class {
	s;
	constructor(seed) {
		this.s = seed >>> 0 || 2654435769;
	}
	next() {
		let x = this.s;
		x ^= x << 13;
		x ^= x >>> 17;
		x ^= x << 5;
		this.s = x >>> 0;
		return this.s;
	}
	int(n) {
		return n <= 0 ? 0 : this.next() % n;
	}
};
function createBubbleField(cfg) {
	return new BubbleField(cfg);
}
var BubbleField = class {
	cols;
	rows;
	colors;
	radius;
	score = 0;
	shots = 0;
	topOut = false;
	grid;
	rng;
	ceilingEvery;
	ceilingRow = 0;
	constructor(cfg) {
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		this.colors = cfg.colors ?? 6;
		this.radius = cfg.radius ?? 16;
		this.ceilingEvery = cfg.ceilingEveryShots ?? 0;
		this.rng = new Rng(cfg.seed ?? 1);
		this.grid = new Array(cfg.cols * cfg.rows).fill(null);
		const fill = cfg.fillRows ?? 5;
		for (let y = 0; y < fill; y++) for (let x = 0; x < this.rowWidth(y); x++) this.grid[this.idx(x, y)] = this.rng.int(this.colors);
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	/** Odd rows are offset and hold one fewer bubble. */
	rowWidth(y) {
		return y % 2 === 0 ? this.cols : this.cols - 1;
	}
	inBounds(x, y) {
		return y >= 0 && y < this.rows && x >= 0 && x < this.rowWidth(y);
	}
	bubble(x, y) {
		return this.inBounds(x, y) ? this.grid[this.idx(x, y)] : null;
	}
	/** World-space centre of a grid cell. Odd rows shift right by half a bubble. */
	centre(x, y) {
		const d = this.radius * 2;
		const offset = y % 2 === 0 ? 0 : this.radius;
		return {
			x: this.radius + offset + x * d,
			y: this.radius + y * d * .866
		};
	}
	/** Field width/height in world units. */
	get width() {
		return this.cols * this.radius * 2 + this.radius;
	}
	get height() {
		return this.rows * this.radius * 2 * .866;
	}
	/** Hex neighbours of (x,y) — 6-way, offset-aware. */
	neighbours(x, y) {
		const deltas = y % 2 === 0 ? [
			[-1, 0],
			[1, 0],
			[-1, -1],
			[0, -1],
			[-1, 1],
			[0, 1]
		] : [
			[-1, 0],
			[1, 0],
			[0, -1],
			[1, -1],
			[0, 1],
			[1, 1]
		];
		const out = [];
		for (const [dx, dy] of deltas) {
			const nx = x + dx;
			const ny = y + dy;
			if (this.inBounds(nx, ny)) out.push({
				x: nx,
				y: ny
			});
		}
		return out;
	}
	/** Colours still present on the field (shots draw only from these). */
	liveColors() {
		const set = /* @__PURE__ */ new Set();
		for (const c of this.grid) if (c !== null) set.add(c);
		return [...set];
	}
	/** Nearest empty cell to a world point that is adjacent to an existing bubble
	* or the ceiling — the snap target. */
	snapCell(p) {
		let best = null;
		let bestD = Infinity;
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.rowWidth(y); x++) {
			if (this.grid[this.idx(x, y)] !== null) continue;
			if (!(y === 0 || this.neighbours(x, y).some((nb) => this.grid[this.idx(nb.x, nb.y)] !== null))) continue;
			const c = this.centre(x, y);
			const dd = (c.x - p.x) ** 2 + (c.y - p.y) ** 2;
			if (dd < bestD - 1e-6) {
				bestD = dd;
				best = {
					x,
					y
				};
			} else if (Math.abs(dd - bestD) < 1e-6 && best) {
				if (y < best.y || y === best.y && x < best.x) best = {
					x,
					y
				};
			}
		}
		return best;
	}
	/** Trace the shot from the launcher (bottom centre) at `angle` (radians, 0 = up,
	* +ve = clockwise), reflecting off side walls, until it hits a bubble or the ceiling. */
	aim(angle, launcher) {
		let pos = { ...launcher ?? {
			x: this.width / 2,
			y: this.height + this.radius
		} };
		let dir = {
			x: Math.sin(angle),
			y: -Math.cos(angle)
		};
		const path = [{ ...pos }];
		const step = this.radius * .5;
		for (let i = 0; i < 2e3; i++) {
			pos = {
				x: pos.x + dir.x * step,
				y: pos.y + dir.y * step
			};
			if (pos.x < this.radius) {
				pos.x = this.radius;
				dir.x = Math.abs(dir.x);
				path.push({ ...pos });
			} else if (pos.x > this.width - this.radius) {
				pos.x = this.width - this.radius;
				dir.x = -Math.abs(dir.x);
				path.push({ ...pos });
			}
			if (pos.y <= this.radius) {
				path.push({ ...pos });
				return {
					path,
					hit: this.snapCell(pos)
				};
			}
			for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.rowWidth(y); x++) {
				if (this.grid[this.idx(x, y)] === null) continue;
				const c = this.centre(x, y);
				if ((c.x - pos.x) ** 2 + (c.y - pos.y) ** 2 <= (this.radius * 1.8) ** 2) {
					path.push({ ...pos });
					return {
						path,
						hit: this.snapCell(pos)
					};
				}
			}
		}
		path.push({ ...pos });
		return {
			path,
			hit: null
		};
	}
	/** Fire a bubble of `color` (or a live colour) at `angle`. Full resolution. */
	shoot(angle, color) {
		const live = this.liveColors();
		const c = color ?? (live.length ? live[this.rng.int(live.length)] : this.rng.int(this.colors));
		const { path, hit } = this.aim(angle);
		if (!hit) return {
			path,
			snap: null,
			pops: [],
			drops: [],
			ceilingStepped: false,
			topOut: this.topOut,
			won: this.won,
			gained: 0
		};
		this.shots++;
		this.grid[this.idx(hit.x, hit.y)] = c;
		const group = this.floodColor(hit.x, hit.y, c);
		let pops = [];
		let drops = [];
		let gained = 0;
		if (group.length >= 3) {
			pops = group;
			for (const p of group) this.grid[this.idx(p.x, p.y)] = null;
			gained += group.length * 10;
			drops = this.dropOrphans();
			gained += drops.reduce((a, _, i) => a + 20 * 2 ** Math.min(i, 16), 0);
		}
		this.score += gained;
		let stepped = false;
		if (this.ceilingEvery > 0 && this.shots % this.ceilingEvery === 0) stepped = this.stepCeiling();
		if (this.bottomReached()) this.topOut = true;
		return {
			path,
			snap: hit,
			pops,
			drops,
			ceilingStepped: stepped,
			topOut: this.topOut,
			won: this.won,
			gained
		};
	}
	floodColor(x, y, color) {
		const out = [];
		const seen = /* @__PURE__ */ new Set([this.idx(x, y)]);
		const stack = [{
			x,
			y
		}];
		while (stack.length) {
			const p = stack.pop();
			out.push(p);
			for (const nb of this.neighbours(p.x, p.y)) {
				const i = this.idx(nb.x, nb.y);
				if (seen.has(i)) continue;
				if (this.grid[i] === color) {
					seen.add(i);
					stack.push(nb);
				}
			}
		}
		return out;
	}
	/** Drop every bubble not connected to the top row (ceiling). Returns dropped cells. */
	dropOrphans() {
		const attached = /* @__PURE__ */ new Set();
		const stack = [];
		for (let x = 0; x < this.rowWidth(0); x++) if (this.grid[this.idx(x, 0)] !== null) {
			attached.add(this.idx(x, 0));
			stack.push({
				x,
				y: 0
			});
		}
		while (stack.length) {
			const p = stack.pop();
			for (const nb of this.neighbours(p.x, p.y)) {
				const i = this.idx(nb.x, nb.y);
				if (attached.has(i) || this.grid[i] === null) continue;
				attached.add(i);
				stack.push(nb);
			}
		}
		const drops = [];
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.rowWidth(y); x++) {
			const i = this.idx(x, y);
			if (this.grid[i] !== null && !attached.has(i)) {
				drops.push({
					x,
					y
				});
				this.grid[i] = null;
			}
		}
		return drops;
	}
	stepCeiling() {
		for (let y = this.rows - 1; y >= 1; y--) for (let x = 0; x < this.cols; x++) this.grid[this.idx(x, y)] = this.grid[this.idx(x, y - 1)] ?? null;
		for (let x = 0; x < this.rowWidth(0); x++) this.grid[this.idx(x, 0)] = this.rng.int(this.colors);
		return true;
	}
	bottomReached() {
		for (let x = 0; x < this.rowWidth(this.rows - 1); x++) if (this.grid[this.idx(x, this.rows - 1)] !== null) return true;
		return false;
	}
	get won() {
		return this.grid.every((c) => c === null);
	}
	/** Candidate shots scored by pops + drops (drops dominate — the AI surface). */
	findShots(samples = 60) {
		const out = [];
		const live = this.liveColors();
		if (!live.length) return out;
		for (let s = 0; s < samples; s++) {
			const angle = -1.3 + 2.6 * s / samples;
			const { hit } = this.aim(angle);
			if (!hit) continue;
			for (const c of live) {
				const sim = this.simulateShot(hit, c);
				const score = sim.drops * 100 + sim.pops * 10;
				if (score > 0) out.push({
					angle,
					pops: sim.pops,
					drops: sim.drops,
					score
				});
			}
		}
		return out.sort((a, b) => b.score - a.score);
	}
	simulateShot(hit, color) {
		const snapshot = this.grid.slice();
		this.grid[this.idx(hit.x, hit.y)] = color;
		const group = this.floodColor(hit.x, hit.y, color);
		let pops = 0;
		let drops = 0;
		if (group.length >= 3) {
			pops = group.length;
			for (const p of group) this.grid[this.idx(p.x, p.y)] = null;
			drops = this.dropOrphans().length;
		}
		this.grid = snapshot;
		return {
			pops,
			drops
		};
	}
	/** Auto-play best-shot until cleared or stuck. */
	autoplay(maxShots = 300) {
		const out = [];
		for (let n = 0; n < maxShots && !this.won && !this.topOut; n++) {
			const best = this.findShots()[0];
			const angle = best ? best.angle : 0;
			const color = best ? void 0 : void 0;
			out.push(this.shoot(angle, color));
			if (!best) break;
		}
		return out;
	}
	debugGrid() {
		const rows = [];
		for (let y = 0; y < this.rows; y++) {
			let r = y % 2 === 0 ? "" : " ";
			for (let x = 0; x < this.rowWidth(y); x++) {
				const c = this.grid[this.idx(x, y)];
				r += c === null ? "." : String(c);
			}
			rows.push(r);
		}
		return rows.join("\n");
	}
};
//#endregion
export { BubbleField, createBubbleField };

//# sourceMappingURL=shooter.js.map
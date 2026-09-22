//#region src/packs/rail.ts
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
function createRail(cfg) {
	return new Rail(cfg);
}
var Rail = class {
	path;
	colors;
	spacing;
	score = 0;
	/** Ordered marbles, front (largest s, nearest the skull) first. */
	chain = [];
	rng;
	nextId = 1;
	feedLeft;
	speed;
	constructor(cfg) {
		this.path = cfg.path;
		this.colors = cfg.colors ?? 4;
		this.spacing = cfg.spacing ?? 22;
		this.speed = cfg.speed ?? 1;
		this.rng = new Rng(cfg.seed ?? 1);
		this.feedLeft = cfg.feedCount ?? 60;
		const initial = Math.min(12, Math.floor(this.path.length / this.spacing / 2));
		for (let i = 0; i < initial; i++) this.chain.push({
			id: this.nextId++,
			color: this.rng.int(this.colors),
			s: -i * this.spacing
		});
	}
	/** World position of a marble. */
	posOf(m) {
		return this.path.point(Math.max(0, Math.min(this.path.length, m.s)));
	}
	get frontS() {
		return this.chain.length ? this.chain[0].s : 0;
	}
	/** Colours still present in the chain (shooter draws from these). */
	liveColors() {
		const set = /* @__PURE__ */ new Set();
		for (const m of this.chain) set.add(m.color);
		return [...set];
	}
	/** Push the whole chain forward; feed new marbles at the back while feed remains. */
	advance(dist = 1) {
		const d = dist * this.speed;
		for (const m of this.chain) m.s += d;
		const back = this.chain.length ? this.chain[this.chain.length - 1].s : 0;
		if (this.feedLeft > 0 && back > this.spacing) {
			this.chain.push({
				id: this.nextId++,
				color: this.rng.int(this.colors),
				s: back - this.spacing
			});
			this.feedLeft--;
		}
		return {
			reachedEnd: this.frontS >= this.path.length,
			frontS: this.frontS
		};
	}
	/** Find the insertion index nearest arc-length `s` (where a shot wedges in). */
	insertionIndexAt(s) {
		let best = this.chain.length;
		let bestD = Infinity;
		for (let i = 0; i <= this.chain.length; i++) {
			const sHere = i < this.chain.length ? this.chain[i].s : this.chain.length ? this.chain[this.chain.length - 1].s - this.spacing : 0;
			const dd = Math.abs(sHere - s);
			if (dd < bestD) {
				bestD = dd;
				best = i;
			}
		}
		return best;
	}
	/** Insert a marble of `color` at arc-length `s`; resolve matches + rejoin combos. */
	insert(s, color) {
		const i = this.insertionIndexAt(s);
		const insS = i < this.chain.length ? this.chain[i].s : this.chain.length ? this.chain[this.chain.length - 1].s - this.spacing / 2 : s;
		const marble = {
			id: this.nextId++,
			color,
			s: insS
		};
		for (let k = i; k < this.chain.length; k++) this.chain[k].s -= this.spacing;
		this.chain.splice(i, 0, marble);
		this.resort();
		let gained = 0;
		const pops = this.popAround(marble.id);
		let all = [];
		const rejoinPops = [];
		if (pops.length) {
			all = pops;
			gained += pops.length * 10;
			let guard = 0;
			while (guard++ < 32) {
				const rp = this.closeGapAndCheck();
				if (rp.length === 0) break;
				rejoinPops.push(rp);
				gained += rp.length * 20;
			}
		}
		this.score += gained;
		return {
			insertedId: marble.id,
			pops: all,
			rejoinPops,
			gained
		};
	}
	resort() {
		this.chain.sort((a, b) => b.s - a.s);
	}
	/** Pop the contiguous same-colour run around a marble id if length ≥3. */
	popAround(id) {
		const idx = this.chain.findIndex((m) => m.id === id);
		if (idx < 0) return [];
		const color = this.chain[idx].color;
		let lo = idx;
		let hi = idx;
		while (lo - 1 >= 0 && this.chain[lo - 1].color === color) lo--;
		while (hi + 1 < this.chain.length && this.chain[hi + 1].color === color) hi++;
		if (hi - lo + 1 < 3) return [];
		const popped = this.chain.slice(lo, hi + 1).map((m) => ({
			id: m.id,
			color: m.color,
			s: m.s
		}));
		this.chain.splice(lo, hi - lo + 1);
		return popped;
	}
	/** After a pop, the rear segment rolls forward to close the gap; if the joining
	* ends form 3+ of a colour, they auto-pop (the combo). Returns popped, or []. */
	closeGapAndCheck() {
		for (let i = 0; i < this.chain.length - 1; i++) {
			const gap = this.chain[i].s - this.chain[i + 1].s;
			if (gap > this.spacing * 1.5) {
				const shift = gap - this.spacing;
				for (let k = i + 1; k < this.chain.length; k++) this.chain[k].s += shift;
				const joinColor = this.chain[i].color;
				if (this.chain[i + 1].color === joinColor) {
					const pop = this.popAround(this.chain[i].id);
					if (pop.length) return pop;
				}
				return [];
			}
		}
		return [];
	}
	get won() {
		return this.feedLeft === 0 && this.chain.length === 0;
	}
	/** For a target colour, the arc-length that would pop the most (autoplay/AI). */
	findShots() {
		const out = [];
		const live = this.liveColors();
		for (const color of live) for (let i = 0; i < this.chain.length; i++) {
			if (this.chain[i].color !== color) continue;
			let run = 1;
			let j = i;
			while (j + 1 < this.chain.length && this.chain[j + 1].color === color) {
				run++;
				j++;
			}
			if (run >= 2) out.push({
				s: this.chain[i].s + this.spacing / 2,
				color,
				pops: run + 1
			});
			i = j;
		}
		return out.sort((a, b) => b.pops - a.pops);
	}
	/** Auto-play: fire best shots while advancing; returns inserts made. */
	autoplay(maxShots = 300) {
		const out = [];
		for (let n = 0; n < maxShots && !this.won; n++) {
			const best = this.findShots()[0];
			if (best) out.push(this.insert(best.s, best.color));
			else this.advance(this.spacing);
			if (this.frontS >= this.path.length) break;
		}
		return out;
	}
	debugChain() {
		return this.chain.map((m) => m.color).join("");
	}
};
/** A simple straight-line path sampler (handy for tests/examples without Track). */
function linePath(from, to) {
	const dx = to.x - from.x;
	const dy = to.y - from.y;
	const length = Math.hypot(dx, dy);
	return {
		length,
		point: (s) => {
			const t = length ? s / length : 0;
			return {
				x: from.x + dx * t,
				y: from.y + dy * t
			};
		}
	};
}
/** A sampled polyline path (approximate arc-length). */
function polyPath(points) {
	const segLen = [];
	let total = 0;
	for (let i = 1; i < points.length; i++) {
		const l = Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
		segLen.push(l);
		total += l;
	}
	return {
		length: total,
		point(s) {
			let rem = Math.max(0, Math.min(total, s));
			for (let i = 0; i < segLen.length; i++) {
				if (rem <= segLen[i]) {
					const t = segLen[i] ? rem / segLen[i] : 0;
					return {
						x: points[i].x + (points[i + 1].x - points[i].x) * t,
						y: points[i].y + (points[i + 1].y - points[i].y) * t
					};
				}
				rem -= segLen[i];
			}
			return points[points.length - 1];
		}
	};
}
//#endregion
export { Rail, createRail, linePath, polyPath };

//# sourceMappingURL=rail.js.map
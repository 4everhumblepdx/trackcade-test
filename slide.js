//#region src/packs/slide.ts
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
	float() {
		return this.next() / 4294967296;
	}
	weighted(w) {
		let t = 0;
		for (const v of w) t += Math.max(0, v);
		if (t <= 0) return this.int(w.length);
		let r = this.float() * t;
		for (let i = 0; i < w.length; i++) {
			r -= Math.max(0, w[i]);
			if (r < 0) return i;
		}
		return w.length - 1;
	}
	shuffle(a) {
		for (let i = a.length - 1; i > 0; i--) {
			const j = this.int(i + 1);
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}
};
/** 2048: slide all the way, equal tiles sum, spawn 2 (90%) / 4 (10%) anywhere. */
function config2048(over = {}) {
	return {
		cols: 4,
		rows: 4,
		step: "full",
		canMerge: (a, b) => a === b ? a + b : null,
		spawn: {
			where: "anyEmpty",
			table: "weighted",
			values: [[2, 9], [4, 1]]
		},
		winValue: 2048,
		...over
	};
}
/** Threes: one-step slide, 1+2=3 then equal-doubles, spawn on the swiped-from edge. */
function configThrees(over = {}) {
	return {
		cols: 4,
		rows: 4,
		step: "one",
		canMerge: (a, b) => {
			if (a === 1 && b === 2 || a === 2 && b === 1) return 3;
			if (a >= 3 && a === b) return a + b;
			return null;
		},
		spawn: {
			where: "oppositeEdge",
			table: "bag",
			values: [
				1,
				1,
				1,
				1,
				2,
				2,
				2,
				2,
				3,
				3,
				3,
				3
			],
			preview: true
		},
		winValue: 0,
		...over
	};
}
function createSlide(cfg) {
	return new Slide(cfg);
}
var Slide = class {
	cols;
	rows;
	score = 0;
	moveCount = 0;
	won = false;
	cfg;
	grid;
	rng;
	nextId = 1;
	bag = [];
	nextValue = null;
	constructor(cfg) {
		this.cfg = cfg;
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		this.rng = new Rng(cfg.seed ?? 1);
		this.grid = new Array(cfg.cols * cfg.rows).fill(null);
		for (let n = 0; n < (cfg.startTiles ?? 2); n++) this.spawnTile(null);
		if (cfg.spawn.preview) this.nextValue = this.drawValue();
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	tile(x, y) {
		return this.grid[this.idx(x, y)];
	}
	/** All live tiles. */
	tiles() {
		return this.grid.filter((t) => t !== null);
	}
	/** The previewed next value (Threes), or null. */
	peek() {
		return this.nextValue;
	}
	merge(a, b) {
		return (this.cfg.canMerge ?? ((x, y) => x === y ? x + y : null))(a, b);
	}
	drawValue() {
		const s = this.cfg.spawn;
		if (s.table === "bag") {
			if (this.bag.length === 0) this.bag = this.rng.shuffle(s.values.slice());
			return this.bag.pop();
		}
		const pairs = s.values;
		return pairs[this.rng.weighted(pairs.map((p) => p[1]))][0];
	}
	spawnTile(fromDir, movedLanes) {
		const empties = [];
		if (this.cfg.spawn.where === "oppositeEdge" && fromDir) {
			const edge = this.oppositeEdgeCells(fromDir).filter((c) => !this.grid[this.idx(c.x, c.y)]);
			for (const c of edge) {
				const lane = fromDir === "left" || fromDir === "right" ? c.y : c.x;
				if (!movedLanes || movedLanes.has(lane)) empties.push(c);
			}
		} else for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (!this.grid[this.idx(x, y)]) empties.push({
			x,
			y
		});
		if (empties.length === 0) return null;
		const at = empties[this.rng.int(empties.length)];
		const value = this.nextValue ?? this.drawValue();
		this.nextValue = this.cfg.spawn.preview ? this.drawValue() : null;
		const t = {
			id: this.nextId++,
			value,
			x: at.x,
			y: at.y
		};
		this.grid[this.idx(at.x, at.y)] = t;
		return {
			id: t.id,
			value,
			at
		};
	}
	oppositeEdgeCells(from) {
		const out = [];
		if (from === "left") for (let y = 0; y < this.rows; y++) out.push({
			x: this.cols - 1,
			y
		});
		if (from === "right") for (let y = 0; y < this.rows; y++) out.push({
			x: 0,
			y
		});
		if (from === "up") for (let x = 0; x < this.cols; x++) out.push({
			x,
			y: this.rows - 1
		});
		if (from === "down") for (let x = 0; x < this.cols; x++) out.push({
			x,
			y: 0
		});
		return out;
	}
	/** Lane cells ordered from the destination wall inward (for the given move dir). */
	laneCells(dir, lane) {
		const out = [];
		if (dir === "left") for (let x = 0; x < this.cols; x++) out.push({
			x,
			y: lane
		});
		if (dir === "right") for (let x = this.cols - 1; x >= 0; x--) out.push({
			x,
			y: lane
		});
		if (dir === "up") for (let y = 0; y < this.rows; y++) out.push({
			x: lane,
			y
		});
		if (dir === "down") for (let y = this.rows - 1; y >= 0; y--) out.push({
			x: lane,
			y
		});
		return out;
	}
	laneCount(dir) {
		return dir === "left" || dir === "right" ? this.rows : this.cols;
	}
	move(dir) {
		const moves = [];
		const merges = [];
		const mergedThisMove = /* @__PURE__ */ new Set();
		const movedLanes = /* @__PURE__ */ new Set();
		let gained = 0;
		for (let lane = 0; lane < this.laneCount(dir); lane++) {
			const cells = this.laneCells(dir, lane);
			const line = [];
			for (const c of cells) {
				const t = this.grid[this.idx(c.x, c.y)];
				if (t) line.push(t);
			}
			const out = [];
			for (const t of line) {
				const prev = out[out.length - 1];
				if (prev && !mergedThisMove.has(prev.id)) {
					const m = this.merge(prev.value, t.value);
					if (this.cfg.step === "full" && m != null) {
						prev.value = m;
						mergedThisMove.add(prev.id);
						merges.push({
							intoId: prev.id,
							goneId: t.id,
							at: {
								x: -1,
								y: -1
							},
							value: m
						});
						gained += m;
						continue;
					}
				}
				out.push(t);
			}
			if (this.cfg.step === "one") {
				this.resolveOneStep(dir, lane, cells, moves, merges, mergedThisMove, movedLanes, (g) => {
					gained += g;
				});
				continue;
			}
			for (let i = 0; i < cells.length; i++) {
				const dest = cells[i];
				const t = out[i] ?? null;
				this.grid[this.idx(dest.x, dest.y)] = t;
				if (t) {
					if (t.x !== dest.x || t.y !== dest.y) {
						moves.push({
							id: t.id,
							from: {
								x: t.x,
								y: t.y
							},
							to: dest
						});
						movedLanes.add(lane);
					}
					t.x = dest.x;
					t.y = dest.y;
				}
			}
			for (const m of merges) if (m.at.x < 0) {
				const it = out.find((t) => t.id === m.intoId);
				if (it) m.at = {
					x: it.x,
					y: it.y
				};
			}
		}
		if (!(moves.length > 0 || merges.length > 0)) return {
			valid: false,
			moves,
			merges,
			spawn: null,
			gained: 0,
			gameOver: this.isGameOver(),
			won: this.won
		};
		this.score += gained;
		if (this.cfg.winValue && !this.won && this.tiles().some((t) => t.value >= this.cfg.winValue)) this.won = true;
		this.moveCount++;
		return {
			valid: true,
			moves,
			merges,
			spawn: this.spawnTile(dir, movedLanes.size ? movedLanes : void 0),
			gained,
			gameOver: this.isGameOver(),
			won: this.won
		};
	}
	resolveOneStep(dir, lane, cells, moves, merges, mergedIds, movedLanes, addScore) {
		for (let i = 1; i < cells.length; i++) {
			const src = cells[i];
			const dst = cells[i - 1];
			const t = this.grid[this.idx(src.x, src.y)];
			if (!t) continue;
			const ahead = this.grid[this.idx(dst.x, dst.y)];
			if (!ahead) {
				this.grid[this.idx(dst.x, dst.y)] = t;
				this.grid[this.idx(src.x, src.y)] = null;
				moves.push({
					id: t.id,
					from: {
						x: t.x,
						y: t.y
					},
					to: { ...dst }
				});
				t.x = dst.x;
				t.y = dst.y;
				movedLanes.add(lane);
			} else if (!mergedIds.has(ahead.id) && !mergedIds.has(t.id)) {
				const m = this.merge(ahead.value, t.value);
				if (m != null) {
					ahead.value = m;
					mergedIds.add(ahead.id);
					this.grid[this.idx(src.x, src.y)] = null;
					moves.push({
						id: t.id,
						from: {
							x: t.x,
							y: t.y
						},
						to: { ...dst }
					});
					merges.push({
						intoId: ahead.id,
						goneId: t.id,
						at: { ...dst },
						value: m
					});
					addScore(m);
					movedLanes.add(lane);
				}
			}
		}
	}
	isGameOver() {
		if (this.tiles().length < this.grid.length) return false;
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
			const t = this.grid[this.idx(x, y)];
			if (x + 1 < this.cols && this.merge(t.value, this.grid[this.idx(x + 1, y)].value) != null) return false;
			if (y + 1 < this.rows && this.merge(t.value, this.grid[this.idx(x, y + 1)].value) != null) return false;
		}
		return true;
	}
	/** Directions that would change the board. */
	legalMoves() {
		const out = [];
		const snapshot = this.serialize();
		for (const dir of [
			"left",
			"right",
			"up",
			"down"
		]) {
			if (this.wouldChange(dir)) out.push(dir);
			this.restore(snapshot);
		}
		return out;
	}
	wouldChange(dir) {
		for (let lane = 0; lane < this.laneCount(dir); lane++) {
			const cells = this.laneCells(dir, lane);
			for (let i = 1; i < cells.length; i++) {
				const t = this.grid[this.idx(cells[i].x, cells[i].y)];
				if (!t) continue;
				const ahead = this.grid[this.idx(cells[i - 1].x, cells[i - 1].y)];
				if (!ahead) return true;
				if (this.merge(ahead.value, t.value) != null) return true;
				if (this.cfg.step === "full") {}
			}
			if (this.cfg.step === "full") {
				const vals = [];
				for (const c of cells) {
					const t = this.grid[this.idx(c.x, c.y)];
					if (t) vals.push(t.value);
				}
				let seenGap = false;
				for (const c of cells) if (!this.grid[this.idx(c.x, c.y)]) seenGap = true;
				else if (seenGap) return true;
				for (let i = 1; i < vals.length; i++) if (this.merge(vals[i - 1], vals[i]) != null) return true;
			}
		}
		return false;
	}
	serialize() {
		return this.grid.map((t) => t ? { ...t } : null);
	}
	restore(s) {
		this.grid = s.map((t) => t ? { ...t } : null);
	}
	/** Auto-play by a simple corner-stacking policy. */
	autoplay(maxMoves = 2e3) {
		const results = [];
		const pref = [
			"left",
			"down",
			"right",
			"up"
		];
		for (let n = 0; n < maxMoves; n++) {
			const legal = this.legalMoves();
			if (legal.length === 0) break;
			const dir = pref.find((d) => legal.includes(d)) ?? legal[0];
			results.push(this.move(dir));
		}
		return results;
	}
	debugGrid() {
		const rows = [];
		for (let y = 0; y < this.rows; y++) {
			const r = [];
			for (let x = 0; x < this.cols; x++) {
				const t = this.grid[this.idx(x, y)];
				r.push(t ? String(t.value) : ".");
			}
			rows.push(r.join("	"));
		}
		return rows.join("\n");
	}
};
//#endregion
export { Slide, config2048, configThrees, createSlide };

//# sourceMappingURL=slide.js.map
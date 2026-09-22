//#region src/packs/placer.ts
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
	weighted(w) {
		let t = 0;
		for (const v of w) t += Math.max(0, v);
		if (t <= 0) return this.int(w.length);
		let r = this.next() / 4294967296 * t;
		for (let i = 0; i < w.length; i++) {
			r -= Math.max(0, w[i]);
			if (r < 0) return i;
		}
		return w.length - 1;
	}
};
var rect = (w, h) => {
	const c = [];
	for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) c.push({
		x,
		y
	});
	return c;
};
/** The canonical 1010! piece set: lines 1–5, squares, L/T/S shapes. */
var PIECES_1010 = [
	{ cells: rect(1, 1) },
	{ cells: rect(2, 1) },
	{ cells: rect(3, 1) },
	{ cells: rect(4, 1) },
	{ cells: rect(5, 1) },
	{ cells: rect(1, 2) },
	{ cells: rect(1, 3) },
	{ cells: rect(1, 4) },
	{ cells: rect(1, 5) },
	{ cells: rect(2, 2) },
	{ cells: rect(3, 3) },
	{ cells: [
		{
			x: 0,
			y: 0
		},
		{
			x: 0,
			y: 1
		},
		{
			x: 1,
			y: 1
		}
	] },
	{ cells: [
		{
			x: 0,
			y: 0
		},
		{
			x: 1,
			y: 0
		},
		{
			x: 0,
			y: 1
		}
	] },
	{ cells: [
		{
			x: 0,
			y: 0
		},
		{
			x: 1,
			y: 0
		},
		{
			x: 1,
			y: 1
		}
	] },
	{ cells: [
		{
			x: 1,
			y: 0
		},
		{
			x: 0,
			y: 1
		},
		{
			x: 1,
			y: 1
		}
	] },
	{ cells: [
		{
			x: 0,
			y: 0
		},
		{
			x: 0,
			y: 1
		},
		{
			x: 0,
			y: 2
		},
		{
			x: 1,
			y: 2
		},
		{
			x: 2,
			y: 2
		}
	] },
	{ cells: [
		{
			x: 2,
			y: 0
		},
		{
			x: 2,
			y: 1
		},
		{
			x: 0,
			y: 2
		},
		{
			x: 1,
			y: 2
		},
		{
			x: 2,
			y: 2
		}
	] }
];
/** Tetromino set (Block Blast leans on these), no rotation in tray games. */
var PIECES_BLOCKS = [
	...PIECES_1010,
	{ cells: [
		{
			x: 0,
			y: 0
		},
		{
			x: 1,
			y: 0
		},
		{
			x: 2,
			y: 0
		},
		{
			x: 1,
			y: 1
		}
	] },
	{ cells: [
		{
			x: 1,
			y: 0
		},
		{
			x: 0,
			y: 1
		},
		{
			x: 1,
			y: 1
		},
		{
			x: 2,
			y: 1
		}
	] },
	{ cells: [
		{
			x: 0,
			y: 0
		},
		{
			x: 1,
			y: 0
		},
		{
			x: 1,
			y: 1
		},
		{
			x: 2,
			y: 1
		}
	] },
	{ cells: [
		{
			x: 1,
			y: 0
		},
		{
			x: 2,
			y: 0
		},
		{
			x: 0,
			y: 1
		},
		{
			x: 1,
			y: 1
		}
	] }
];
/** Build the nine 3×3 sudoku-box regions for a 9×9 board (Woodoku/Blockudoku). */
function sudokuBoxes() {
	const out = [];
	for (let by = 0; by < 3; by++) for (let bx = 0; bx < 3; bx++) {
		const cells = [];
		for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) cells.push({
			x: bx * 3 + x,
			y: by * 3 + y
		});
		out.push({
			id: `box${bx}${by}`,
			cells
		});
	}
	return out;
}
function createPlacer(cfg) {
	return new Placer(cfg);
}
var Placer = class {
	cols;
	rows;
	tray = [];
	score = 0;
	placements = 0;
	gameOver = false;
	/** Current clearing streak (consecutive placements that cleared ≥1 region). */
	streak = 0;
	cfg;
	grid;
	regions;
	pool;
	rng;
	nextId = 1;
	trayCells = /* @__PURE__ */ new Map();
	constructor(cfg) {
		if (!Number.isInteger(cfg.cols) || !Number.isInteger(cfg.rows) || cfg.cols < 2 || cfg.rows < 2) throw new Error("placer: cols/rows must be integers >= 2");
		this.cfg = cfg;
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		this.rng = new Rng(cfg.seed ?? 1);
		this.grid = new Array(cfg.cols * cfg.rows).fill(null);
		this.pool = cfg.pieces ?? PIECES_1010;
		this.regions = [];
		for (let y = 0; y < cfg.rows; y++) this.regions.push({
			id: `r${y}`,
			cells: rect(cfg.cols, 1).map((c) => ({
				x: c.x,
				y
			}))
		});
		for (let x = 0; x < cfg.cols; x++) this.regions.push({
			id: `c${x}`,
			cells: rect(1, cfg.rows).map((c) => ({
				x,
				y: c.y
			}))
		});
		for (const r of cfg.regions ?? []) this.regions.push(r);
		this.refillTray();
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	inBounds(x, y) {
		return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
	}
	/** The placed cell at (x,y), or null. */
	cell(x, y) {
		return this.inBounds(x, y) ? this.grid[this.idx(x, y)] : null;
	}
	fillRatio() {
		let n = 0;
		for (const c of this.grid) if (c) n++;
		return n / this.grid.length;
	}
	refillTray() {
		const size = this.cfg.traySize ?? 3;
		const pool = this.cfg.pieceFilter ? this.cfg.pieceFilter(this.fillRatio(), this.pool) : this.pool;
		this.tray = [];
		this.trayCells.clear();
		for (let n = 0; n < size; n++) {
			const def = pool[this.rng.weighted(pool.map((p) => p.weight ?? 1))];
			const piece = {
				id: this.nextId++,
				cells: def.cells.map((c) => ({ ...c })),
				tag: def.tag
			};
			this.tray.push(piece);
			this.trayCells.set(piece.id, piece.cells);
		}
	}
	/** Can `pieceId` be placed with its origin at `at`? */
	canPlace(pieceId, at) {
		const cells = this.trayCells.get(pieceId);
		if (!cells) return false;
		for (const c of cells) {
			const x = at.x + c.x;
			const y = at.y + c.y;
			if (!this.inBounds(x, y) || this.grid[this.idx(x, y)]) return false;
		}
		return true;
	}
	/** Rotate a tray piece 90° in place (`dir` 1 = CW, -1 = CCW). No-op unless
	* `rotate` is configured. Cells are re-normalised to a (0,0) origin. */
	rotatePiece(pieceId, dir = 1) {
		if (!this.cfg.rotate) return;
		const piece = this.tray.find((p) => p.id === pieceId);
		if (!piece) return;
		const maxX = Math.max(...piece.cells.map((c) => c.x));
		const maxY = Math.max(...piece.cells.map((c) => c.y));
		const rotated = piece.cells.map((c) => dir === 1 ? {
			x: maxY - c.y,
			y: c.x
		} : {
			x: c.y,
			y: maxX - c.x
		});
		piece.cells = rotated;
		this.trayCells.set(pieceId, rotated);
	}
	/** Does ANY tray piece fit ANYWHERE? (the mid-tray game-over test). */
	anyMoveExists() {
		for (const p of this.tray) for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (this.canPlace(p.id, {
			x,
			y
		})) return true;
		return false;
	}
	/** Place a tray piece; commit, clear completed regions, refill when empty. */
	place(pieceId, at) {
		const steps = [];
		if (this.gameOver || !this.canPlace(pieceId, at)) return {
			valid: false,
			steps,
			combo: 0,
			streak: this.streak,
			gained: 0,
			gameOver: this.gameOver
		};
		const cells = this.trayCells.get(pieceId);
		const piece = this.tray.find((p) => p.id === pieceId);
		const abs = cells.map((c) => ({
			x: at.x + c.x,
			y: at.y + c.y
		}));
		for (const c of abs) this.grid[this.idx(c.x, c.y)] = {
			fill: pieceId,
			tag: piece.tag
		};
		steps.push({
			type: "place",
			pieceId,
			cells: abs,
			fill: pieceId
		});
		this.placements++;
		this.tray = this.tray.filter((p) => p.id !== pieceId);
		this.trayCells.delete(pieceId);
		const complete = this.regions.filter((r) => r.cells.every((c) => this.grid[this.idx(c.x, c.y)]));
		const combo = complete.length;
		let gained = this.cfg.scorer ? this.cfg.scorer({
			cellsPlaced: abs.length,
			regions: combo,
			streak: this.streak
		}) : this.defaultScore(abs.length, combo, this.streak);
		if (combo > 0) {
			const clearedCells = /* @__PURE__ */ new Set();
			for (const r of complete) for (const c of r.cells) clearedCells.add(this.idx(c.x, c.y));
			for (const i of clearedCells) this.grid[i] = null;
			steps.push({
				type: "regionClear",
				regions: complete.map((r) => r.id),
				cells: [...clearedCells].map((i) => ({
					x: i % this.cols,
					y: i / this.cols | 0
				}))
			});
			this.streak++;
		} else this.streak = 0;
		this.score += gained;
		if (this.tray.length === 0) {
			this.refillTray();
			steps.push({
				type: "trayRefill",
				pieces: this.tray.map((p) => ({
					id: p.id,
					cells: p.cells
				}))
			});
		}
		if (!this.anyMoveExists()) {
			this.gameOver = true;
			steps.push({ type: "gameOver" });
		}
		return {
			valid: true,
			steps,
			combo,
			streak: this.streak,
			gained,
			gameOver: this.gameOver
		};
	}
	defaultScore(cellsPlaced, regions, streakBefore) {
		let s = cellsPlaced;
		if (regions > 0) {
			const streakMult = 1 + streakBefore * .5;
			s += Math.round(10 * regions * regions * streakMult);
		}
		return s;
	}
	/** Every legal placement of every tray piece (or one piece), scored, best first. */
	findPlacements(pieceId) {
		const out = [];
		const pieces = pieceId != null ? this.tray.filter((p) => p.id === pieceId) : this.tray;
		for (const p of pieces) for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
			if (!this.canPlace(p.id, {
				x,
				y
			})) continue;
			const clears = this.wouldClear(p.id, {
				x,
				y
			});
			const value = clears * 100 + (this.rows + this.cols - x - y);
			out.push({
				pieceId: p.id,
				at: {
					x,
					y
				},
				clears,
				value
			});
		}
		return out.sort((a, b) => b.value - a.value);
	}
	wouldClear(pieceId, at) {
		const cells = this.trayCells.get(pieceId);
		const filled = /* @__PURE__ */ new Set();
		for (const c of cells) filled.add(this.idx(at.x + c.x, at.y + c.y));
		let n = 0;
		for (const r of this.regions) if (r.cells.every((c) => {
			const i = this.idx(c.x, c.y);
			return this.grid[i] || filled.has(i);
		})) n++;
		return n;
	}
	/** Auto-play by a policy until game over; returns each result. */
	autoplay(maxPlacements = 500) {
		const results = [];
		for (let n = 0; n < maxPlacements && !this.gameOver; n++) {
			const best = this.findPlacements()[0];
			if (!best) break;
			results.push(this.place(best.pieceId, best.at));
		}
		return results;
	}
	/** Rows of `#`/`.` — handy in tests. */
	debugGrid() {
		const rows = [];
		for (let y = 0; y < this.rows; y++) {
			let r = "";
			for (let x = 0; x < this.cols; x++) r += this.grid[this.idx(x, y)] ? "#" : ".";
			rows.push(r);
		}
		return rows.join("\n");
	}
};
//#endregion
export { PIECES_1010, PIECES_BLOCKS, Placer, createPlacer, sudokuBoxes };

//# sourceMappingURL=placer.js.map
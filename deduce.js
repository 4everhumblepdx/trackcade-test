//#region src/packs/deduce.ts
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
};
function createNonogram(cfg) {
	return new Nonogram(cfg);
}
var Nonogram = class {
	cols;
	rows;
	rowClues = [];
	colClues = [];
	solution;
	marks;
	constructor(cfg) {
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		const rng = new Rng(cfg.seed ?? 1);
		this.solution = cfg.solution ?? this.generateSolvable(rng, cfg.density ?? .55);
		this.rowClues = this.solution.map((r) => runs(r));
		this.colClues = [];
		for (let x = 0; x < this.cols; x++) this.colClues.push(runs(this.solution.map((r) => r[x])));
		this.marks = Array.from({ length: this.rows }, () => new Array(this.cols).fill("unknown"));
	}
	/** Generate a solution whose clues are solvable by the line-solver alone. */
	generateSolvable(rng, density) {
		for (let attempt = 0; attempt < 40; attempt++) {
			const sol = Array.from({ length: this.rows }, () => Array.from({ length: this.cols }, () => rng.float() < density));
			const rc = sol.map(runs);
			const cc = [];
			for (let x = 0; x < this.cols; x++) cc.push(runs(sol.map((r) => r[x])));
			if (this.lineSolvable(rc, cc, sol)) return sol;
		}
		return Array.from({ length: this.rows }, () => Array.from({ length: this.cols }, () => rng.float() < density));
	}
	/** Iterated line-solver: does constraint propagation alone reach the solution? */
	lineSolvable(rc, cc, sol) {
		const g = Array.from({ length: this.rows }, () => new Array(this.cols).fill(null));
		for (let pass = 0; pass < this.rows * this.cols; pass++) {
			let changed = false;
			for (let y = 0; y < this.rows; y++) changed = this.solveLine(g[y], rc[y]) || changed;
			for (let x = 0; x < this.cols; x++) {
				const col = g.map((r) => r[x]);
				if (this.solveLine(col, cc[x])) {
					for (let y = 0; y < this.rows; y++) g[y][x] = col[y];
					changed = true;
				}
			}
			if (!changed) break;
		}
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (g[y][x] !== sol[y][x]) return false;
		return true;
	}
	/** Constrain one line by intersecting all clue placements; returns true if it changed. */
	solveLine(line, clue) {
		const n = line.length;
		const placements = [];
		const gen = (pos, ci, acc) => {
			if (placements.length > 2e4) return;
			if (ci === clue.length) {
				const full = acc.concat(new Array(n - acc.length).fill(false));
				if (matches(full, line)) placements.push(full);
				return;
			}
			const remaining = clue.slice(ci).reduce((a, b) => a + b, 0) + (clue.length - ci - 1);
			for (let start = pos; start <= n - remaining; start++) {
				const next = acc.concat(new Array(start - acc.length).fill(false), new Array(clue[ci]).fill(true));
				if (matchesPrefix(next, line)) gen(start + clue[ci] + 1, ci + 1, next.concat(ci < clue.length - 1 ? [false] : []));
			}
		};
		if (clue.length === 0 || clue.length === 1 && clue[0] === 0) gen(0, 0, []);
		else gen(0, 0, []);
		if (placements.length === 0) return false;
		let changed = false;
		for (let i = 0; i < n; i++) {
			if (line[i] !== null) continue;
			const all1 = placements.every((p) => p[i]);
			const all0 = placements.every((p) => !p[i]);
			if (all1) {
				line[i] = true;
				changed = true;
			} else if (all0) {
				line[i] = false;
				changed = true;
			}
		}
		return changed;
	}
	/** Player marks a cell. */
	set(x, y, mark) {
		this.marks[y][x] = mark;
	}
	mark(x, y) {
		return this.marks[y][x];
	}
	/** Is a row/column's clue currently satisfied by the fills (drives clue dimming)? */
	lineSatisfied(axis, i) {
		const line = axis === "row" ? this.marks[i].map((m) => m === "fill") : this.marks.map((r) => r[i] === "fill");
		const clue = axis === "row" ? this.rowClues[i] : this.colClues[i];
		return sameClue(runs(line), clue);
	}
	/** Solved = every clue satisfied (allows alternate solutions). */
	get solved() {
		for (let y = 0; y < this.rows; y++) if (!this.lineSatisfied("row", y)) return false;
		for (let x = 0; x < this.cols; x++) if (!this.lineSatisfied("col", x)) return false;
		return true;
	}
	/** The reference solution (for auto-solve demos / checking). */
	solutionAt(x, y) {
		return this.solution[y][x];
	}
	/** Auto-solve one forced deduction; returns cells it filled/crossed, or []. */
	solveStep() {
		const out = [];
		const g = this.marks.map((r) => r.map((m) => m === "fill" ? true : m === "cross" ? false : null));
		for (let y = 0; y < this.rows; y++) {
			const line = g[y].slice();
			if (this.solveLine(line, this.rowClues[y])) {
				for (let x = 0; x < this.cols; x++) if (g[y][x] === null && line[x] !== null) {
					const mk = line[x] ? "fill" : "cross";
					this.marks[y][x] = mk;
					out.push({
						at: {
							x,
							y
						},
						mark: mk
					});
				}
				if (out.length) return out;
			}
		}
		for (let x = 0; x < this.cols; x++) {
			const col = g.map((r) => r[x]);
			if (this.solveLine(col, this.colClues[x])) {
				for (let y = 0; y < this.rows; y++) if (g[y][x] === null && col[y] !== null) {
					const mk = col[y] ? "fill" : "cross";
					this.marks[y][x] = mk;
					out.push({
						at: {
							x,
							y
						},
						mark: mk
					});
				}
				if (out.length) return out;
			}
		}
		return out;
	}
};
function runs(line) {
	const out = [];
	let n = 0;
	for (const v of line) if (v) n++;
	else if (n) {
		out.push(n);
		n = 0;
	}
	if (n) out.push(n);
	return out.length ? out : [0];
}
function sameClue(a, b) {
	const aa = a.length === 1 && a[0] === 0 ? [] : a;
	const bb = b.length === 1 && b[0] === 0 ? [] : b;
	return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
}
function matches(full, line) {
	for (let i = 0; i < line.length; i++) if (line[i] !== null && line[i] !== full[i]) return false;
	return true;
}
function matchesPrefix(prefix, line) {
	for (let i = 0; i < prefix.length; i++) if (line[i] !== null && line[i] !== prefix[i]) return false;
	return true;
}
function createLightsOut(cfg) {
	return new LightsOut(cfg);
}
var LightsOut = class {
	cols;
	rows;
	on;
	stampCells;
	wrap;
	moves = 0;
	constructor(cfg) {
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		this.wrap = cfg.wrap ?? false;
		this.stampCells = cfg.stamp === "3x3" ? [
			{
				x: -1,
				y: -1
			},
			{
				x: 0,
				y: -1
			},
			{
				x: 1,
				y: -1
			},
			{
				x: -1,
				y: 0
			},
			{
				x: 0,
				y: 0
			},
			{
				x: 1,
				y: 0
			},
			{
				x: -1,
				y: 1
			},
			{
				x: 0,
				y: 1
			},
			{
				x: 1,
				y: 1
			}
		] : Array.isArray(cfg.stamp) ? cfg.stamp : [
			{
				x: 0,
				y: 0
			},
			{
				x: 1,
				y: 0
			},
			{
				x: -1,
				y: 0
			},
			{
				x: 0,
				y: 1
			},
			{
				x: 0,
				y: -1
			}
		];
		this.on = new Array(cfg.cols * cfg.rows).fill(false);
		const rng = new Rng(cfg.seed ?? 1);
		const scrambles = cfg.scrambles ?? cfg.cols * cfg.rows;
		for (let n = 0; n < scrambles; n++) this.applyStamp(rng.int(cfg.cols), rng.int(cfg.rows));
		this.moves = 0;
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	light(x, y) {
		return this.on[this.idx(x, y)];
	}
	applyStamp(x, y) {
		const toggled = [];
		for (const s of this.stampCells) {
			let tx = x + s.x;
			let ty = y + s.y;
			if (this.wrap) {
				tx = (tx % this.cols + this.cols) % this.cols;
				ty = (ty % this.rows + this.rows) % this.rows;
			}
			if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) continue;
			const i = this.idx(tx, ty);
			this.on[i] = !this.on[i];
			toggled.push({
				x: tx,
				y: ty
			});
		}
		return toggled;
	}
	/** Press a cell; returns the toggled cells for the presenter. */
	press(x, y) {
		this.moves++;
		return this.applyStamp(x, y);
	}
	get solved() {
		return this.on.every((v) => !v);
	}
	get litCount() {
		return this.on.reduce((a, v) => a + (v ? 1 : 0), 0);
	}
	/** Minimal press-set that solves the current board, via GF(2) elimination. */
	solution() {
		const n = this.cols * this.rows;
		const A = [];
		for (let py = 0; py < this.rows; py++) for (let px = 0; px < this.cols; px++) {
			const row = new Array(n + 1).fill(0);
			for (const s of this.stampCells) {
				let tx = px + s.x;
				let ty = py + s.y;
				if (this.wrap) {
					tx = (tx % this.cols + this.cols) % this.cols;
					ty = (ty % this.rows + this.rows) % this.rows;
				}
				if (tx < 0 || ty < 0 || tx >= this.cols || ty >= this.rows) continue;
				row[this.idx(tx, ty)] ^= 1;
			}
			A.push(row);
		}
		for (let i = 0; i < n; i++) A[i][n] = this.on[i] ? 1 : 0;
		const where = new Array(n).fill(-1);
		let row = 0;
		for (let col = 0; col < n && row < n; col++) {
			let sel = -1;
			for (let r = row; r < n; r++) if (A[r][col]) {
				sel = r;
				break;
			}
			if (sel < 0) continue;
			[A[sel], A[row]] = [A[row], A[sel]];
			where[col] = row;
			for (let r = 0; r < n; r++) if (r !== row && A[r][col]) for (let c = col; c <= n; c++) A[r][c] ^= A[row][c];
			row++;
		}
		const press = new Array(n).fill(0);
		for (let col = 0; col < n; col++) if (where[col] !== -1) press[col] = A[where[col]][n];
		const out = [];
		for (let i = 0; i < n; i++) if (press[i]) out.push({
			x: i % this.cols,
			y: i / this.cols | 0
		});
		return out;
	}
};
function createFlood(cfg) {
	return new Flood(cfg);
}
var Flood = class Flood {
	cols;
	rows;
	colors;
	origin;
	moveLimit;
	moves = 0;
	grid;
	region;
	rng;
	constructor(cfg) {
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		this.colors = cfg.colors ?? 6;
		this.origin = cfg.origin ?? {
			x: 0,
			y: 0
		};
		this.rng = new Rng(cfg.seed ?? 1);
		this.grid = Array.from({ length: cfg.cols * cfg.rows }, () => this.rng.int(this.colors));
		this.region = /* @__PURE__ */ new Set();
		this.recomputeRegion();
		this.moveLimit = cfg.moveLimit ?? this.calibrateLimit();
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	colorAt(x, y) {
		return this.grid[this.idx(x, y)];
	}
	inRegion(x, y) {
		return this.region.has(this.idx(x, y));
	}
	get currentColor() {
		return this.grid[this.idx(this.origin.x, this.origin.y)];
	}
	recomputeRegion() {
		const c = this.grid[this.idx(this.origin.x, this.origin.y)];
		this.region = /* @__PURE__ */ new Set([this.idx(this.origin.x, this.origin.y)]);
		const stack = [this.origin];
		while (stack.length) {
			const p = stack.pop();
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const nx = p.x + dx;
				const ny = p.y + dy;
				if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
				const i = this.idx(nx, ny);
				if (this.region.has(i) || this.grid[i] !== c) continue;
				this.region.add(i);
				stack.push({
					x: nx,
					y: ny
				});
			}
		}
	}
	/** How many new cells picking `color` would absorb (the strategy assist). */
	preview(color) {
		if (color === this.currentColor) return 0;
		let gained = 0;
		const seen = new Set(this.region);
		for (const i of this.region) {
			const p = {
				x: i % this.cols,
				y: i / this.cols | 0
			};
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const nx = p.x + dx;
				const ny = p.y + dy;
				if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
				const j = this.idx(nx, ny);
				if (!seen.has(j) && this.grid[j] === color) gained += this.countConnectedOfColor(j, color, seen);
			}
		}
		return gained;
	}
	countConnectedOfColor(start, color, exclude) {
		const local = /* @__PURE__ */ new Set();
		const stack = [start];
		let n = 0;
		while (stack.length) {
			const i = stack.pop();
			if (local.has(i) || exclude.has(i)) continue;
			if (this.grid[i] !== color) continue;
			local.add(i);
			n++;
			const p = {
				x: i % this.cols,
				y: i / this.cols | 0
			};
			for (const [dx, dy] of [
				[1, 0],
				[-1, 0],
				[0, 1],
				[0, -1]
			]) {
				const nx = p.x + dx;
				const ny = p.y + dy;
				if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
				stack.push(this.idx(nx, ny));
			}
		}
		for (const i of local) exclude.add(i);
		return n;
	}
	/** Recolour the region to `color` and absorb newly-adjacent same-colour cells. */
	pick(color) {
		if (color === this.currentColor) return {
			color,
			absorbed: [],
			won: this.won,
			movesLeft: this.moveLimit - this.moves
		};
		this.moves++;
		for (const i of this.region) this.grid[i] = color;
		const before = new Set(this.region);
		this.recomputeRegion();
		const absorbed = [];
		for (const i of this.region) if (!before.has(i)) absorbed.push({
			x: i % this.cols,
			y: i / this.cols | 0
		});
		return {
			color,
			absorbed,
			won: this.won,
			movesLeft: this.moveLimit - this.moves
		};
	}
	get won() {
		return this.region.size === this.cols * this.rows;
	}
	get lost() {
		return !this.won && this.moves >= this.moveLimit;
	}
	/** Every colour choice sorted by cells gained (greedy autoplay/hints). */
	findMoves() {
		const out = [];
		for (let c = 0; c < this.colors; c++) if (c !== this.currentColor) out.push({
			color: c,
			gain: this.preview(c)
		});
		return out.sort((a, b) => b.gain - a.gain);
	}
	/** Greedy solve (a copy) to calibrate a fair move limit. */
	calibrateLimit() {
		const copy = new Flood({
			cols: this.cols,
			rows: this.rows,
			colors: this.colors,
			origin: this.origin,
			moveLimit: 9999
		});
		copy.grid = this.grid.slice();
		copy.recomputeRegion();
		let n = 0;
		while (!copy.won && n < this.cols * this.rows * 2) {
			const best = copy.findMoves()[0];
			if (!best || best.gain === 0) break;
			copy.pick(best.color);
			n++;
		}
		return Math.ceil(n * 1.3) + 2;
	}
};
//#endregion
export { Flood, LightsOut, Nonogram, createFlood, createLightsOut, createNonogram };

//# sourceMappingURL=deduce.js.map
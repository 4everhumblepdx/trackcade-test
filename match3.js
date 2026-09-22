//#region src/packs/match3/rng.ts
var Rng$2 = class {
	s;
	constructor(seed) {
		this.s = seed >>> 0 || 2654435769;
	}
	/** Next uint32. */
	next() {
		let x = this.s;
		x ^= x << 13;
		x ^= x >>> 17;
		x ^= x << 5;
		this.s = x >>> 0;
		return this.s;
	}
	/** Float in [0, 1). */
	float() {
		return this.next() / 4294967296;
	}
	/** Integer in [0, n). */
	int(n) {
		return n <= 0 ? 0 : this.next() % n;
	}
	/** Index into a weight table (uniform over indices when total weight is 0). */
	weighted(weights) {
		let total = 0;
		for (const w of weights) total += Math.max(0, w);
		if (total <= 0) return this.int(weights.length);
		let r = this.float() * total;
		for (let i = 0; i < weights.length; i++) {
			r -= Math.max(0, weights[i]);
			if (r < 0) return i;
		}
		return weights.length - 1;
	}
	/** Fisher–Yates shuffle in place. */
	shuffle(arr) {
		for (let i = arr.length - 1; i > 0; i--) {
			const j = this.int(i + 1);
			const t = arr[i];
			arr[i] = arr[j];
			arr[j] = t;
		}
		return arr;
	}
};
//#endregion
//#region src/packs/match3/match.ts
var key = (x, y) => y * 4096 + x;
/** Scan the whole grid: all horizontal + vertical runs of 3+, merged into groups.
* Optionally also standalone 2×2 squares (cells not already in any run). */
function findMatchGroups(grid, squareMatch = false) {
	const runs = [];
	const { cols, rows } = grid;
	for (let y = 0; y < rows; y++) {
		let x = 0;
		while (x < cols) {
			const c = grid.matchColorAt(x, y);
			if (c < 0) {
				x++;
				continue;
			}
			let end = x + 1;
			while (end < cols && grid.matchColorAt(end, y) === c) end++;
			if (end - x >= 3) {
				const cells = [];
				for (let i = x; i < end; i++) cells.push({
					x: i,
					y
				});
				runs.push({
					cells,
					orientation: "h"
				});
			}
			x = end;
		}
	}
	for (let x = 0; x < cols; x++) {
		let y = 0;
		while (y < rows) {
			const c = grid.matchColorAt(x, y);
			if (c < 0) {
				y++;
				continue;
			}
			let end = y + 1;
			while (end < rows && grid.matchColorAt(x, end) === c) end++;
			if (end - y >= 3) {
				const cells = [];
				for (let i = y; i < end; i++) cells.push({
					x,
					y: i
				});
				runs.push({
					cells,
					orientation: "v"
				});
			}
			y = end;
		}
	}
	const parent = runs.map((_, i) => i);
	const find = (i) => parent[i] === i ? i : parent[i] = find(parent[i]);
	const cellRun = /* @__PURE__ */ new Map();
	runs.forEach((run, i) => {
		for (const c of run.cells) {
			const k = key(c.x, c.y);
			const prev = cellRun.get(k);
			if (prev !== void 0) parent[find(i)] = find(prev);
			else cellRun.set(k, i);
		}
	});
	const byRoot = /* @__PURE__ */ new Map();
	runs.forEach((run, i) => {
		const root = find(i);
		let g = byRoot.get(root);
		if (!g) {
			g = {
				color: grid.matchColorAt(run.cells[0].x, run.cells[0].y),
				cells: [],
				runs: [],
				square: false
			};
			byRoot.set(root, g);
		}
		g.runs.push(run);
	});
	for (const g of byRoot.values()) {
		const seen = /* @__PURE__ */ new Set();
		for (const run of g.runs) for (const c of run.cells) {
			const k = key(c.x, c.y);
			if (!seen.has(k)) {
				seen.add(k);
				g.cells.push(c);
			}
		}
	}
	const groups = [...byRoot.values()];
	if (squareMatch) {
		const inRun = new Set(cellRun.keys());
		for (let y = 0; y + 1 < rows; y++) for (let x = 0; x + 1 < cols; x++) {
			const c = grid.matchColorAt(x, y);
			if (c < 0) continue;
			if (grid.matchColorAt(x + 1, y) !== c || grid.matchColorAt(x, y + 1) !== c || grid.matchColorAt(x + 1, y + 1) !== c) continue;
			const cells = [
				{
					x,
					y
				},
				{
					x: x + 1,
					y
				},
				{
					x,
					y: y + 1
				},
				{
					x: x + 1,
					y: y + 1
				}
			];
			if (cells.some((p) => inRun.has(key(p.x, p.y)))) continue;
			for (const p of cells) inRun.add(key(p.x, p.y));
			groups.push({
				color: c,
				cells,
				runs: [],
				square: true
			});
		}
	}
	return groups;
}
/** Classify a group's shape by the standard priority: 5-line > L/T/cross > square > 4 > 3. */
function classifyGroup(group, pivotHint) {
	const inGroup = (p) => !!p && group.cells.some((c) => c.x === p.x && c.y === p.y);
	const mid = group.cells[Math.floor(group.cells.length / 2)];
	if (group.square) return {
		shape: "square",
		orientation: "none",
		pivot: inGroup(pivotHint) ? pivotHint : group.cells[0]
	};
	const maxRun = group.runs.reduce((m, r) => Math.max(m, r.cells.length), 0);
	const longest = group.runs.find((r) => r.cells.length === maxRun);
	if (group.runs.length === 1) {
		const shape = maxRun >= 6 ? "longer" : maxRun === 5 ? "five" : maxRun === 4 ? "four" : "three";
		const pivot = inGroup(pivotHint) ? pivotHint : longest.cells[Math.floor(longest.cells.length / 2)];
		return {
			shape,
			orientation: longest.orientation,
			pivot
		};
	}
	if (maxRun >= 5) {
		const pivot = inGroup(pivotHint) ? pivotHint : longest.cells[Math.floor(longest.cells.length / 2)];
		return {
			shape: maxRun >= 6 ? "longer" : "five",
			orientation: longest.orientation,
			pivot
		};
	}
	let cross = null;
	let atEndA = false;
	let atEndB = false;
	outer: for (const a of group.runs) for (const b of group.runs) {
		if (a === b || a.orientation === b.orientation) continue;
		for (const c of a.cells) if (b.cells.some((p) => p.x === c.x && p.y === c.y)) {
			cross = c;
			const endOf = (r, p) => {
				const f = r.cells[0];
				const l = r.cells[r.cells.length - 1];
				return f.x === p.x && f.y === p.y || l.x === p.x && l.y === p.y;
			};
			atEndA = endOf(a, c);
			atEndB = endOf(b, c);
			break outer;
		}
	}
	if (cross) return {
		shape: atEndA && atEndB ? "L" : !atEndA && !atEndB ? "cross" : "T",
		orientation: "both",
		pivot: cross
	};
	return {
		shape: maxRun === 4 ? "four" : "three",
		orientation: longest.orientation,
		pivot: inGroup(pivotHint) ? pivotHint : mid
	};
}
/** Flood-fill the connected same-colour group containing (x, y).
* Orthogonal by default; `adj8` includes diagonal neighbours (8-way chains). */
function floodGroup(grid, x, y, adj8 = false) {
	const c = grid.matchColorAt(x, y);
	if (c < 0) return [];
	const out = [];
	const seen = /* @__PURE__ */ new Set([key(x, y)]);
	const stack = [{
		x,
		y
	}];
	const dirs = adj8 ? [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1],
		[1, 1],
		[1, -1],
		[-1, 1],
		[-1, -1]
	] : [
		[1, 0],
		[-1, 0],
		[0, 1],
		[0, -1]
	];
	while (stack.length) {
		const p = stack.pop();
		out.push(p);
		for (const [dx, dy] of dirs) {
			const nx = p.x + dx;
			const ny = p.y + dy;
			if (nx < 0 || ny < 0 || nx >= grid.cols || ny >= grid.rows) continue;
			const k = key(nx, ny);
			if (seen.has(k)) continue;
			if (grid.matchColorAt(nx, ny) !== c) continue;
			seen.add(k);
			stack.push({
				x: nx,
				y: ny
			});
		}
	}
	return out;
}
//#endregion
//#region src/packs/match3/board.ts
var DIR_DELTA = {
	up: [0, -1],
	down: [0, 1],
	left: [-1, 0],
	right: [1, 0],
	downLeft: [-1, 1],
	downRight: [1, 1]
};
var ORTHO = [
	[1, 0],
	[-1, 0],
	[0, 1],
	[0, -1]
];
/** Create a board. See {@link BoardConfig} for every option. */
function createBoard(cfg) {
	return new Board(cfg);
}
var Board = class Board {
	cols;
	rows;
	preset;
	colors;
	/** Cumulative score. */
	score = 0;
	/** Valid moves made so far. */
	moveCount = 0;
	/** Remaining move budget when `moveLimit` was configured, else `Infinity`. */
	movesLeft = Infinity;
	/** Live goal counters (empty when no goals configured). */
	goals = [];
	cfg;
	cells;
	grid;
	overlays;
	rng;
	nextId = 1;
	presenting = /* @__PURE__ */ new Map();
	constructor(cfg) {
		if (!Number.isInteger(cfg.cols) || !Number.isInteger(cfg.rows) || cfg.cols < 3 || cfg.rows < 3) throw new Error("match3: cols/rows must be integers >= 3");
		this.cfg = cfg;
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		this.preset = cfg.preset ?? "match3";
		this.colors = cfg.colors ?? 6;
		this.rng = new Rng$2(cfg.seed ?? 1);
		this.cells = this.parseLayout(cfg.layout);
		this.grid = new Array(this.cols * this.rows).fill(null);
		this.overlays = new Array(this.cols * this.rows).fill(null);
		if (cfg.moveLimit != null) this.movesLeft = cfg.moveLimit;
		for (const def of cfg.goals ?? []) {
			const extra = "color" in def ? `:${def.color}` : "kind" in def ? `:${def.kind}` : "tag" in def ? `:${def.tag}` : "";
			this.goals.push({
				id: def.id ?? `${def.type}${extra}`,
				def,
				target: def.count,
				remaining: def.count,
				done: false
			});
		}
		this.deal();
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	pos(i) {
		return {
			x: i % this.cols,
			y: i / this.cols | 0
		};
	}
	inBounds(x, y) {
		return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
	}
	/** The cell at (x, y). Mutating it mutates the board's substrate. */
	cell(x, y) {
		return this.cells[this.idx(x, y)];
	}
	/** The block at (x, y), or null. */
	block(x, y) {
		return this.inBounds(x, y) ? this.grid[this.idx(x, y)] : null;
	}
	/** The overlay at (x, y), or null. */
	overlay(x, y) {
		return this.overlays[this.idx(x, y)];
	}
	/** Place (or clear, with null) a block during level setup. */
	setBlock(x, y, init) {
		const i = this.idx(x, y);
		if (init === null) {
			this.grid[i] = null;
			return null;
		}
		const b = this.makeBlock(init);
		this.grid[i] = b;
		return b;
	}
	/** Attach an overlay (chain/vine/cage…) during level setup. */
	setOverlay(x, y, entry) {
		this.overlays[this.idx(x, y)] = entry ? { ...entry } : null;
	}
	/** Add a damageable cell layer (jelly…) during level setup. */
	addLayer(x, y, layer) {
		const c = this.cells[this.idx(x, y)];
		(c.layers ??= []).push({ ...layer });
	}
	/** Visit every cell. */
	forEach(fn) {
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
			const i = this.idx(x, y);
			fn(x, y, this.cells[i], this.grid[i], this.overlays[i]);
		}
	}
	/** Rows of colour digits (`.` empty, `#` blocked, `~` conduit, `*` colourless) — handy in tests. */
	debugGrid() {
		const rows = [];
		for (let y = 0; y < this.rows; y++) {
			let row = "";
			for (let x = 0; x < this.cols; x++) {
				const c = this.cells[this.idx(x, y)];
				const b = this.grid[this.idx(x, y)];
				row += c.kind === "blocked" ? "#" : b ? b.color >= 0 ? String(b.color % 10) : "*" : c.kind === "conduit" ? "~" : ".";
			}
			rows.push(row);
		}
		return rows.join("\n");
	}
	parseLayout(layout) {
		const cells = [];
		for (let y = 0; y < this.rows; y++) {
			const row = layout?.[y] ?? "";
			for (let x = 0; x < this.cols; x++) {
				const ch = row[x] ?? ".";
				let cell;
				switch (ch) {
					case "#":
						cell = { kind: "blocked" };
						break;
					case "~":
						cell = { kind: "conduit" };
						break;
					case "<":
						cell = {
							kind: "conveyor",
							conveyor: "left"
						};
						break;
					case ">":
						cell = {
							kind: "conveyor",
							conveyor: "right"
						};
						break;
					case "^":
						cell = {
							kind: "conveyor",
							conveyor: "up"
						};
						break;
					case "v":
						cell = {
							kind: "conveyor",
							conveyor: "down"
						};
						break;
					case "E":
						cell = {
							kind: "normal",
							exit: true
						};
						break;
					default: cell = { kind: "normal" };
				}
				cells.push(cell);
			}
		}
		return cells;
	}
	makeBlock(init) {
		const kind = init.kind ?? (init.special ? "special" : "normal");
		return {
			id: this.nextId++,
			color: init.color ?? -1,
			kind,
			special: init.special ? { ...init.special } : void 0,
			hp: init.hp ?? 1,
			matchable: init.matchable ?? (kind === "normal" || kind === "special"),
			static: init.static ?? false,
			hitFilter: init.hitFilter,
			bombTimer: init.bombTimer,
			tags: init.tags?.slice(),
			tier: init.tier ?? 0
		};
	}
	/** Match keys encode colour + tier so merge-mode blocks only match equals. */
	static decode(c) {
		return c < 0 ? c : c % 256;
	}
	mergeStyle() {
		return this.cfg.merge ? this.cfg.merge.style ?? "fuse" : null;
	}
	snapshot(b) {
		return {
			...b,
			special: b.special ? { ...b.special } : void 0,
			tags: b.tags?.slice(),
			hitFilter: b.hitFilter?.slice()
		};
	}
	refillMode() {
		return this.cfg.refill ?? (this.preset === "collapse" ? "none" : "top");
	}
	/** One deal/refill block init: from the weighted `spawnTable` when present,
	* else a plain colour from `spawnWeights`. */
	spawnInit() {
		const table = this.cfg.spawnTable;
		if (table?.length) {
			const pick = table[this.rng.weighted(table.map((e) => Math.max(0, e.weight)))];
			const init = typeof pick.block === "function" ? pick.block() : pick.block;
			return {
				...init,
				tags: init.tags?.slice(),
				special: init.special ? { ...init.special } : void 0
			};
		}
		return { color: this.rng.weighted((this.cfg.spawnWeights ?? new Array(this.colors).fill(1)).slice(0, this.colors)) };
	}
	restable(cell) {
		return cell.kind === "normal" || cell.kind === "conveyor";
	}
	deal() {
		for (let attempt = 0; attempt < 60; attempt++) {
			for (let i = 0; i < this.grid.length; i++) this.grid[i] = null;
			for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
				const i = this.idx(x, y);
				if (!this.restable(this.cells[i])) continue;
				this.grid[i] = this.makeBlock(this.dealInit(x, y));
			}
			if (this.preset !== "match3") {
				if (this.findMoves().length > 0) return;
			} else if (this.findGroups().length === 0 && this.findMoves().length > 0) return;
		}
		throw new Error("match3: could not deal a valid board (too few colors/cells?)");
	}
	/** A dealt block that (match3 preset) avoids completing a run with placed neighbours. */
	dealInit(x, y) {
		const at = (px, py) => this.block(px, py)?.color ?? -2;
		const completesRun = (c) => c != null && c >= 0 && this.preset === "match3" && (at(x - 1, y) === c && at(x - 2, y) === c || at(x, y - 1) === c && at(x, y - 2) === c);
		if (this.cfg.spawnTable?.length) {
			let init = this.spawnInit();
			for (let n = 0; n < 24 && completesRun(init.color); n++) init = this.spawnInit();
			return init;
		}
		const weights = (this.cfg.spawnWeights ?? new Array(this.colors).fill(1)).slice(0, this.colors);
		for (let c = 0; c < this.colors; c++) if (completesRun(c)) weights[c] = 0;
		return { color: this.rng.weighted(weights) };
	}
	scanView(colorOverride) {
		return {
			cols: this.cols,
			rows: this.rows,
			matchColorAt: (x, y) => {
				const i = this.idx(x, y);
				const b = this.grid[i];
				if (!b || !b.matchable || b.color < 0) return -2;
				if (this.overlays[i]?.locksMatch) return -2;
				const tierKey = this.mergeStyle() === "levelAll" ? 0 : b.tier * 256;
				return colorOverride?.get(i) ?? b.color + tierKey;
			}
		};
	}
	findGroups() {
		return findMatchGroups(this.scanView(), this.cfg.squareMatch ?? false);
	}
	/** Swap two adjacent blocks. Instant full resolution; play back `result.steps`. */
	swap(a, b) {
		const ctx = this.newCtx();
		const invalid = () => this.finish(ctx, false);
		if (this.preset !== "match3") return invalid();
		if (!this.inBounds(a.x, a.y) || !this.inBounds(b.x, b.y)) return invalid();
		if (!(this.cfg.swapAnywhere ?? false) && Math.abs(a.x - b.x) + Math.abs(a.y - b.y) !== 1) return invalid();
		const ia = this.idx(a.x, a.y);
		const ib = this.idx(b.x, b.y);
		const A = this.grid[ia];
		const B = this.grid[ib];
		if (!A || !B || !this.swappable(ia) || !this.swappable(ib)) return invalid();
		ctx.steps.push({
			type: "swap",
			a,
			b,
			aBlock: A.id,
			bBlock: B.id
		});
		this.mark(ctx, a);
		this.mark(ctx, b);
		this.grid[ia] = B;
		this.grid[ib] = A;
		if (A.special && B.special) {
			const actions = this.comboActions(A, B, b);
			ctx.detonatedIds.add(A.id).add(B.id);
			ctx.totals.specialsFired += 2;
			this.goal(ctx, "fireSpecials", void 0, 2);
			this.clearBlocksNow(ctx, [{
				at: b,
				block: A,
				cause: "blast"
			}, {
				at: a,
				block: B,
				cause: "blast"
			}], 0);
			this.resolveCascades(ctx, { initialActions: actions.map((action) => ({
				sourceId: null,
				at: b,
				special: {
					kind: "custom",
					action
				}
			})) });
			return this.endMove(ctx);
		}
		const cc = A.special?.kind === "colorClear" ? {
			sp: A,
			other: B,
			at: b
		} : B.special?.kind === "colorClear" ? {
			sp: B,
			other: A,
			at: a
		} : null;
		if (cc && cc.other.color >= 0 && !cc.other.special) {
			this.resolveCascades(ctx, { initialActions: [{
				sourceId: cc.sp.id,
				at: cc.at,
				special: cc.sp.special,
				colorHint: cc.other.color
			}] });
			return this.endMove(ctx);
		}
		let groups = this.findGroups();
		if (this.mergeStyle() === "levelAll") groups = groups.filter((g) => g.cells.some((c) => c.x === a.x && c.y === a.y || c.x === b.x && c.y === b.y));
		if (groups.length === 0) {
			this.grid[ia] = A;
			this.grid[ib] = B;
			ctx.steps.push({
				type: "swapBack",
				a,
				b,
				aBlock: A.id,
				bBlock: B.id
			});
			return this.finish(ctx, false);
		}
		this.resolveCascades(ctx, {
			pivotA: a,
			pivotB: b,
			initialGroups: this.mergeStyle() === "levelAll" ? groups : void 0
		});
		return this.endMove(ctx);
	}
	/** Rotate the 2×2 block whose top-left is `at`, 'cw' or 'ccw' (Bejeweled Twist).
	* Reverts if it makes no match, unless `operatorFreeMove`. */
	rotate(at, dir = "cw") {
		const ctx = this.newCtx();
		if (this.preset !== "match3") return this.finish(ctx, false);
		const quad = [
			{
				x: at.x,
				y: at.y
			},
			{
				x: at.x + 1,
				y: at.y
			},
			{
				x: at.x + 1,
				y: at.y + 1
			},
			{
				x: at.x,
				y: at.y + 1
			}
		];
		if (quad.some((c) => !this.inBounds(c.x, c.y))) return this.finish(ctx, false);
		const is = quad.map((c) => this.idx(c.x, c.y));
		if (is.some((i) => !this.swappable(i))) return this.finish(ctx, false);
		const blocks = is.map((i) => this.grid[i]);
		if (blocks.some((b) => !b)) return this.finish(ctx, false);
		const rot = dir === "cw" ? [
			blocks[3],
			blocks[0],
			blocks[1],
			blocks[2]
		] : [
			blocks[1],
			blocks[2],
			blocks[3],
			blocks[0]
		];
		is.forEach((i, n) => {
			this.grid[i] = rot[n];
		});
		for (const c of quad) this.mark(ctx, c);
		ctx.steps.push({
			type: "rotate",
			at,
			dir,
			blocks: is.map((i) => this.grid[i].id)
		});
		if (!(this.cfg.operatorFreeMove ?? false) && this.findGroups().length === 0) {
			is.forEach((i, n) => {
				this.grid[i] = blocks[n];
			});
			ctx.steps.push({
				type: "rotate",
				at,
				dir: dir === "cw" ? "ccw" : "cw",
				blocks: is.map((i) => this.grid[i].id)
			});
			return this.finish(ctx, false);
		}
		this.resolveCascades(ctx, {});
		return this.endMove(ctx);
	}
	/** Slide a whole row by `by` cells with wraparound (Chuzzle / 10000000). */
	shiftRow(row, by) {
		return this.shiftLine("row", row, by);
	}
	/** Slide a whole column by `by` cells with wraparound. */
	shiftColumn(col, by) {
		return this.shiftLine("col", col, by);
	}
	shiftLine(axis, index, by) {
		const ctx = this.newCtx();
		if (this.preset !== "match3") return this.finish(ctx, false);
		const len = axis === "row" ? this.cols : this.rows;
		if (index < 0 || index >= (axis === "row" ? this.rows : this.cols)) return this.finish(ctx, false);
		const cellAt = (k) => axis === "row" ? {
			x: k,
			y: index
		} : {
			x: index,
			y: k
		};
		const is = Array.from({ length: len }, (_, k) => this.idx(cellAt(k).x, cellAt(k).y));
		if (is.some((i) => !this.grid[i] || this.cells[i].kind === "blocked")) return this.finish(ctx, false);
		const before = is.map((i) => this.grid[i]);
		const shift = (by % len + len) % len;
		if (shift === 0) return this.finish(ctx, false);
		const moves = [];
		is.forEach((i, k) => {
			const src = ((k - shift) % len + len) % len;
			this.grid[i] = before[src];
			moves.push({
				blockId: before[src].id,
				from: cellAt(src),
				to: cellAt(k),
				path: [cellAt(src), cellAt(k)]
			});
			this.mark(ctx, cellAt(k));
		});
		ctx.steps.push({
			type: "shift",
			axis,
			index,
			by: shift,
			moves
		});
		if (!(this.cfg.operatorFreeMove ?? false) && this.findGroups().length === 0) {
			is.forEach((i, k) => {
				this.grid[i] = before[k];
			});
			ctx.steps.push({
				type: "shift",
				axis,
				index,
				by: len - shift,
				moves: []
			});
			return this.finish(ctx, false);
		}
		this.resolveCascades(ctx, {});
		return this.endMove(ctx);
	}
	/** Tap a cell: collapse preset clears the flood group; a tapped special fires. */
	tap(at) {
		const ctx = this.newCtx();
		if (!this.inBounds(at.x, at.y)) return this.finish(ctx, false);
		const b = this.grid[this.idx(at.x, at.y)];
		if (!b) return this.finish(ctx, false);
		if (b.special && (this.cfg.tapActivatesSpecials ?? true)) {
			ctx.detonatedIds.add(b.id);
			this.resolveCascades(ctx, { initialActions: [{
				sourceId: b.id,
				at,
				special: b.special
			}] });
			return this.endMove(ctx);
		}
		if (this.preset === "collapse") {
			const group = floodGroup(this.scanView(), at.x, at.y);
			if (group.length < (this.cfg.minGroup ?? 2)) return this.finish(ctx, false);
			ctx.steps.push({
				type: "tap",
				at,
				group
			});
			this.resolveCascades(ctx, { tapGroup: {
				cells: group,
				at
			} });
			return this.endMove(ctx);
		}
		return this.finish(ctx, false);
	}
	/**
	* Chain preset: validate a drawn path without playing it. A path is valid when
	* every cell holds a matchable block of ONE colour(+tier), consecutive cells
	* are adjacent (see `chain.adjacency`), no cell repeats — except that the
	* FINAL cell may revisit an earlier one, closing a `loop` — and the unique
	* length reaches `chain.minLength`. Use per-step while the player drags.
	*/
	pathAt(cells) {
		const bad = {
			valid: false,
			loop: false,
			color: -1,
			cells: []
		};
		if (this.preset !== "chain" || cells.length === 0) return bad;
		const adj8 = (this.cfg.chain?.adjacency ?? 4) === 8;
		const minLen = this.cfg.chain?.minLength ?? 3;
		const view = this.scanView();
		const key = view.matchColorAt(cells[0].x, cells[0].y);
		if (key < 0) return bad;
		const seen = /* @__PURE__ */ new Set();
		const unique = [];
		let loop = false;
		for (let n = 0; n < cells.length; n++) {
			const c = cells[n];
			if (!this.inBounds(c.x, c.y) || view.matchColorAt(c.x, c.y) !== key) return bad;
			if (n > 0) {
				const dx = Math.abs(c.x - cells[n - 1].x);
				const dy = Math.abs(c.y - cells[n - 1].y);
				if (!(adj8 ? dx <= 1 && dy <= 1 && dx + dy > 0 : dx + dy === 1)) return bad;
			}
			const i = this.idx(c.x, c.y);
			if (seen.has(i)) {
				if (n !== cells.length - 1) return bad;
				loop = true;
			} else {
				seen.add(i);
				unique.push(c);
			}
		}
		return {
			valid: unique.length >= minLen,
			loop,
			color: Board.decode(key),
			cells: unique
		};
	}
	/** Chain preset: commit a drawn path. A closed loop clears EVERY block of the
	* path's colour (when `chain.loopClearsColor` isn't false). */
	playPath(cells) {
		const ctx = this.newCtx();
		const v = this.pathAt(cells);
		if (!v.valid) return this.finish(ctx, false);
		ctx.steps.push({
			type: "path",
			cells: v.cells,
			loop: v.loop
		});
		let group = v.cells;
		if (v.loop && (this.cfg.chain?.loopClearsColor ?? true)) {
			const view = this.scanView();
			const key = view.matchColorAt(v.cells[0].x, v.cells[0].y);
			group = [];
			for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (view.matchColorAt(x, y) === key) group.push({
				x,
				y
			});
		}
		this.resolveCascades(ctx, { tapGroup: {
			cells: group,
			at: v.cells[0]
		} });
		return this.endMove(ctx);
	}
	/** Apply an inventory power-up / tool action. Cascades follow; does not consume a move. */
	applyAction(action) {
		const ctx = this.newCtx();
		switch (action.type) {
			case "shuffle":
				this.doShuffle(ctx);
				return this.endMove(ctx, false);
			case "freeSwap": {
				const { a, b } = action;
				if (!this.inBounds(a.x, a.y) || !this.inBounds(b.x, b.y)) return this.finish(ctx, false);
				const ia = this.idx(a.x, a.y);
				const ib = this.idx(b.x, b.y);
				const A = this.grid[ia];
				const B = this.grid[ib];
				if (!A || !B) return this.finish(ctx, false);
				ctx.steps.push({
					type: "swap",
					a,
					b,
					aBlock: A.id,
					bBlock: B.id
				});
				this.grid[ia] = B;
				this.grid[ib] = A;
				this.mark(ctx, a);
				this.mark(ctx, b);
				this.resolveCascades(ctx, {
					pivotA: a,
					pivotB: b
				});
				return this.endMove(ctx, false);
			}
			case "paint": {
				const b = this.block(action.at.x, action.at.y);
				if (!b || b.color < 0) return this.finish(ctx, false);
				b.color = action.color;
				ctx.steps.push({
					type: "paint",
					blockId: b.id,
					at: action.at,
					color: action.color
				});
				this.mark(ctx, action.at);
				this.resolveCascades(ctx, {});
				return this.endMove(ctx, false);
			}
			default:
				this.resolveCascades(ctx, { initialActions: [{
					sourceId: null,
					at: this.actionAnchor(action),
					special: {
						kind: "custom",
						action
					}
				}] });
				return this.endMove(ctx, false);
		}
	}
	/** Run the turn systems (conveyors, spreaders, bomb fuses) manually when `autoTick: false`. */
	endTurn() {
		const ctx = this.newCtx();
		this.tick(ctx);
		return this.finish(ctx, true);
	}
	actionAnchor(action) {
		if ("at" in action) return action.at;
		if (action.type === "clearRow") return {
			x: this.cols / 2 | 0,
			y: action.row
		};
		if (action.type === "clearColumn") return {
			x: action.col,
			y: this.rows / 2 | 0
		};
		return {
			x: this.cols / 2 | 0,
			y: this.rows / 2 | 0
		};
	}
	swappable(i) {
		const b = this.grid[i];
		if (!b || b.static || b.kind === "blocker") return false;
		if (this.overlays[i]?.locksMove) return false;
		return true;
	}
	newCtx() {
		return {
			steps: [],
			region: /* @__PURE__ */ new Set(),
			totals: {
				matches: 0,
				blocksCleared: 0,
				chainDepth: 0,
				specialsMade: 0,
				specialsFired: 0,
				score: 0,
				clearedByColor: {},
				clearedByTag: {}
			},
			scoreStart: this.score,
			goalAmounts: /* @__PURE__ */ new Map(),
			damagedOverlayKinds: /* @__PURE__ */ new Set(),
			detonatedIds: /* @__PURE__ */ new Set()
		};
	}
	mark(ctx, p) {
		if (this.inBounds(p.x, p.y)) ctx.region.add(this.idx(p.x, p.y));
	}
	resolveCascades(ctx, opts) {
		const autoMatch = this.preset === "match3" && this.mergeStyle() !== "levelAll";
		let depth = 0;
		let pending = opts.initialActions ?? [];
		let tapGroup = opts.tapGroup ?? null;
		let initialGroups = opts.initialGroups ?? null;
		for (let guard = 0; guard < 256; guard++) {
			let groups = [];
			if (tapGroup) groups = [{
				color: this.grid[this.idx(tapGroup.at.x, tapGroup.at.y)]?.color ?? -1,
				cells: tapGroup.cells,
				runs: [],
				square: false
			}];
			else if (initialGroups) {
				groups = initialGroups;
				initialGroups = null;
			} else if (autoMatch) groups = this.findGroups();
			if (groups.length === 0 && pending.length === 0) break;
			ctx.steps.push({
				type: "cascadeStart",
				depth
			});
			ctx.totals.chainDepth = Math.max(ctx.totals.chainDepth, depth);
			const spawnAt = /* @__PURE__ */ new Map();
			const mergeAt = /* @__PURE__ */ new Map();
			const explodeSeeds = [];
			const levelBumps = [];
			if (groups.length) {
				const events = [];
				const matchHits = [];
				for (const g of groups) {
					const isTap = tapGroup !== null;
					const hint = depth > 0 ? void 0 : opts.pivotA && g.cells.some((c) => c.x === opts.pivotA.x && c.y === opts.pivotA.y) ? opts.pivotA : opts.pivotB && g.cells.some((c) => c.x === opts.pivotB.x && c.y === opts.pivotB.y) ? opts.pivotB : void 0;
					const cls = isTap ? {
						shape: "group",
						orientation: "none",
						pivot: tapGroup.at
					} : classifyGroup(g, hint);
					const cause = depth > 0 ? "cascade" : opts.pivotA || isTap ? "move" : "action";
					const ev = this.buildMatchEvent(g, cls, depth, cause);
					events.push(ev);
					ctx.totals.matches++;
					this.score += this.scoreFor({
						kind: "match",
						blocks: ev.length,
						shape: ev.shape,
						depth
					});
					if (this.mergeStyle() === "levelAll") {
						for (const c of g.cells) {
							const blk = this.grid[this.idx(c.x, c.y)];
							if (!blk || blk.kind !== "normal" || blk.color < 0) continue;
							blk.tier++;
							levelBumps.push({
								blockId: blk.id,
								at: c,
								tier: blk.tier
							});
							this.mark(ctx, c);
							if (blk.tier >= this.cfg.merge.maxTier) explodeSeeds.push(this.idx(c.x, c.y));
						}
						continue;
					}
					for (const c of ev.cells) {
						matchHits.push({
							at: c,
							type: "match"
						});
						this.mark(ctx, c);
					}
					for (const c of this.groupNeighbours(g.cells)) {
						matchHits.push({
							at: c,
							type: "adjacent"
						});
						this.mark(ctx, c);
					}
					for (const c of g.cells) {
						const blk = this.grid[this.idx(c.x, c.y)];
						if (blk?.special && !ctx.detonatedIds.has(blk.id)) {
							ctx.detonatedIds.add(blk.id);
							pending.push({
								sourceId: blk.id,
								at: c,
								special: blk.special
							});
						}
					}
					if (this.cfg.merge && !mergeAt.has(this.idx(cls.pivot.x, cls.pivot.y))) {
						const pi = this.idx(cls.pivot.x, cls.pivot.y);
						mergeAt.set(pi, {
							tier: (this.grid[pi]?.tier ?? 0) + 1,
							color: Board.decode(g.color),
							from: g.cells.map((c) => ({
								blockId: this.grid[this.idx(c.x, c.y)]?.id ?? -1,
								at: c
							})).filter((f) => f.blockId >= 0)
						});
					}
					const def = this.specialFor(ev, isTap ? g.cells.length : 0);
					if (def) {
						const pi = this.idx(cls.pivot.x, cls.pivot.y);
						if (!spawnAt.has(pi)) spawnAt.set(pi, {
							def,
							shape: ev.shape,
							color: ev.color
						});
					}
				}
				ctx.steps.push({
					type: "match",
					matches: events
				});
				if (levelBumps.length) ctx.steps.push({
					type: "tierUp",
					hits: levelBumps
				});
				this.applyHits(ctx, matchHits, pending, depth);
			}
			tapGroup = null;
			let waveGuard = 0;
			while (pending.length && waveGuard++ < 64) {
				const wave = pending;
				pending = [];
				for (const det of wave) this.detonate(ctx, det, pending, depth);
			}
			pending = [];
			for (const [pi, spawn] of spawnAt) {
				if (this.grid[pi]) continue;
				const p = this.pos(pi);
				const blk = this.makeBlock({
					color: spawn.color,
					kind: "special",
					special: spawn.def
				});
				this.grid[pi] = blk;
				ctx.steps.push({
					type: "specialSpawn",
					block: this.snapshot(blk),
					at: p,
					fromShape: spawn.shape
				});
				ctx.totals.specialsMade++;
				this.mark(ctx, p);
			}
			if (mergeAt.size) {
				const maxTier = this.cfg.merge.maxTier;
				for (const [pi, m] of mergeAt) {
					if (this.grid[pi]) continue;
					const p = this.pos(pi);
					const blk = this.makeBlock({
						color: m.color,
						tier: m.tier
					});
					this.grid[pi] = blk;
					ctx.steps.push({
						type: "merge",
						at: p,
						blockId: blk.id,
						block: this.snapshot(blk),
						tier: m.tier,
						color: m.color,
						from: m.from
					});
					this.mark(ctx, p);
					if (m.tier >= maxTier) explodeSeeds.push(pi);
				}
			}
			if (explodeSeeds.length && (this.cfg.merge?.explode ?? true)) {
				const maxTier = this.cfg.merge.maxTier;
				let queue = explodeSeeds;
				let waveGuard = 0;
				while (queue.length && waveGuard++ < 64) {
					const wave = queue;
					queue = [];
					const queued = /* @__PURE__ */ new Set();
					const tierUps = [];
					for (const i of wave) {
						const b = this.grid[i];
						if (!b) continue;
						const at = this.pos(i);
						ctx.steps.push({
							type: "explode",
							at,
							blockId: b.id
						});
						this.clearBlocksNow(ctx, [{
							at,
							block: b,
							cause: "blast"
						}], depth);
						for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
							if (!dx && !dy) continue;
							const nx = at.x + dx;
							const ny = at.y + dy;
							if (!this.inBounds(nx, ny)) continue;
							const ni = this.idx(nx, ny);
							const nb = this.grid[ni];
							if (!nb || nb.kind !== "normal" || !nb.matchable || nb.color < 0) continue;
							nb.tier++;
							tierUps.push({
								blockId: nb.id,
								at: {
									x: nx,
									y: ny
								},
								tier: nb.tier
							});
							this.mark(ctx, {
								x: nx,
								y: ny
							});
							if (nb.tier >= maxTier && !queued.has(ni)) {
								queued.add(ni);
								queue.push(ni);
							}
						}
					}
					if (tierUps.length) ctx.steps.push({
						type: "tierUp",
						hits: tierUps
					});
				}
			}
			this.gravity(ctx);
			depth++;
			if (!autoMatch) break;
		}
	}
	buildMatchEvent(g, cls, depth, cause) {
		const blocks = [];
		const overlays = [];
		const layers = [];
		for (const c of g.cells) {
			const i = this.idx(c.x, c.y);
			const b = this.grid[i];
			if (b) blocks.push(this.snapshot(b));
			const ov = this.overlays[i];
			if (ov) overlays.push({
				at: c,
				kind: ov.kind,
				hp: ov.hp
			});
			for (const l of this.cells[i].layers ?? []) layers.push({
				at: c,
				kind: l.kind,
				hp: l.hp
			});
		}
		return {
			shape: cls.shape,
			length: g.cells.length,
			orientation: cls.orientation,
			color: Board.decode(g.color),
			cells: g.cells.slice(),
			blocks,
			pivot: cls.pivot,
			overlays,
			layers,
			chainDepth: depth,
			cause
		};
	}
	groupNeighbours(cells) {
		const inGroup = new Set(cells.map((c) => this.idx(c.x, c.y)));
		const seen = /* @__PURE__ */ new Set();
		const out = [];
		for (const c of cells) for (const [dx, dy] of ORTHO) {
			const nx = c.x + dx;
			const ny = c.y + dy;
			if (!this.inBounds(nx, ny)) continue;
			const i = this.idx(nx, ny);
			if (inGroup.has(i) || seen.has(i)) continue;
			seen.add(i);
			out.push({
				x: nx,
				y: ny
			});
		}
		return out;
	}
	/** The shape → special table (match3), or the group-size thresholds (collapse/chain). */
	specialFor(ev, tapSize) {
		if (this.cfg.merge) return null;
		if (this.preset === "collapse" || this.preset === "chain") {
			const table = this.cfg.collapseSpecials ?? (this.preset === "chain" ? {} : {
				5: { kind: "rowClear" },
				7: {
					kind: "blast",
					radius: 1
				},
				9: { kind: "colorClear" }
			});
			let best = null;
			let bestN = -1;
			for (const [n, def] of Object.entries(table)) {
				const num = Number(n);
				if (tapSize >= num && num > bestN) {
					bestN = num;
					best = def;
				}
			}
			return best ? { ...best } : null;
		}
		const table = this.cfg.specialSpawns ?? {};
		if (ev.shape in table) {
			const def = table[ev.shape];
			return def ? { ...def } : null;
		}
		switch (ev.shape) {
			case "four": return { kind: ev.orientation === "h" ? "colClear" : "rowClear" };
			case "five":
			case "longer": return { kind: "colorClear" };
			case "L":
			case "T":
			case "cross": return {
				kind: "blast",
				radius: 1
			};
			case "square": return { kind: "seeker" };
			default: return null;
		}
	}
	applyHits(ctx, hits, pending, depth) {
		const seen = /* @__PURE__ */ new Set();
		const overlayDmg = [];
		const layerDmg = [];
		const blockDmg = [];
		const clears = [];
		for (const h of hits) {
			const k = `${h.at.x},${h.at.y},${h.type}`;
			if (seen.has(k)) continue;
			seen.add(k);
			const i = this.idx(h.at.x, h.at.y);
			const cell = this.cells[i];
			const direct = h.type !== "adjacent";
			const layer = cell.layers?.[cell.layers.length - 1];
			if (layer && direct && (layer.hitFilter ?? [
				"match",
				"blast",
				"beam",
				"tool"
			]).includes(h.type)) {
				layer.hp--;
				layerDmg.push({
					at: h.at,
					kind: layer.kind,
					remainingHp: layer.hp
				});
				this.mark(ctx, h.at);
				if (layer.hp <= 0) {
					cell.layers.pop();
					this.goal(ctx, "clearLayer", layer.kind, 1);
				}
			}
			const ov = this.overlays[i];
			let blockProtected = false;
			if (ov && (ov.hitFilter ?? [
				"match",
				"adjacent",
				"blast",
				"beam",
				"tool"
			]).includes(h.type)) {
				ov.hp--;
				ctx.damagedOverlayKinds.add(ov.kind);
				overlayDmg.push({
					at: h.at,
					kind: ov.kind,
					remainingHp: ov.hp
				});
				this.mark(ctx, h.at);
				if (ov.hp <= 0) {
					this.overlays[i] = null;
					this.goal(ctx, "clearOverlay", ov.kind, 1);
				}
				if (ov.absorbsClear && direct) blockProtected = true;
			}
			const b = this.grid[i];
			if (!b) continue;
			if (b.kind === "ingredient") continue;
			if (b.kind === "blocker") {
				if ((b.hitFilter ?? [
					"adjacent",
					"blast",
					"beam",
					"tool"
				]).includes(h.type)) {
					b.hp--;
					this.mark(ctx, h.at);
					if (b.hp <= 0) clears.push({
						at: h.at,
						block: b,
						cause: h.type
					});
					else blockDmg.push({
						blockId: b.id,
						at: h.at,
						remainingHp: b.hp
					});
				}
				continue;
			}
			if (!direct) continue;
			if (b.special) {
				if (h.type !== "match" && !ctx.detonatedIds.has(b.id)) {
					ctx.detonatedIds.add(b.id);
					pending.push({
						sourceId: b.id,
						at: h.at,
						special: b.special
					});
				}
				continue;
			}
			if (blockProtected) continue;
			if (b.hp > 1) {
				b.hp--;
				blockDmg.push({
					blockId: b.id,
					at: h.at,
					remainingHp: b.hp
				});
				this.mark(ctx, h.at);
				continue;
			}
			clears.push({
				at: h.at,
				block: b,
				cause: h.type
			});
		}
		if (overlayDmg.length) ctx.steps.push({
			type: "overlayDamage",
			hits: overlayDmg
		});
		if (layerDmg.length) ctx.steps.push({
			type: "cellLayerDamage",
			hits: layerDmg
		});
		if (blockDmg.length) ctx.steps.push({
			type: "blockDamage",
			hits: blockDmg
		});
		this.clearBlocksNow(ctx, clears, depth);
	}
	clearBlocksNow(ctx, clears, depth) {
		if (!clears.length) return;
		const entries = [];
		for (const c of clears) {
			const i = this.idx(c.at.x, c.at.y);
			if (this.grid[i] !== c.block) continue;
			this.grid[i] = null;
			entries.push({
				id: c.block.id,
				at: c.at,
				block: this.snapshot(c.block),
				cause: c.cause
			});
			ctx.totals.blocksCleared++;
			this.score += this.scoreFor({
				kind: "clear",
				blocks: 1,
				depth
			});
			this.mark(ctx, c.at);
			if (c.block.color >= 0) {
				this.goal(ctx, "clearColor", c.block.color, 1);
				ctx.totals.clearedByColor[c.block.color] = (ctx.totals.clearedByColor[c.block.color] ?? 0) + 1;
			}
			for (const tag of c.block.tags ?? []) {
				this.goal(ctx, "clearTagged", tag, 1);
				ctx.totals.clearedByTag[tag] = (ctx.totals.clearedByTag[tag] ?? 0) + 1;
			}
		}
		if (entries.length) ctx.steps.push({
			type: "clear",
			blocks: entries
		});
	}
	detonate(ctx, det, nextWave, depth) {
		const sp = det.special;
		if (det.sourceId != null) {
			const i = this.idx(det.at.x, det.at.y);
			const b = this.grid[i];
			if (b && b.id === det.sourceId) this.clearBlocksNow(ctx, [{
				at: det.at,
				block: b,
				cause: "blast"
			}], depth);
			ctx.totals.specialsFired++;
			this.goal(ctx, "fireSpecials", void 0, 1);
		}
		const action = this.actionForSpecial(sp, det);
		if (action.type === "convertAndFire") {
			const targets = [];
			for (let i = 0; i < this.grid.length; i++) {
				const b = this.grid[i];
				if (b && b.kind === "normal" && b.matchable && b.color === action.color) targets.push({
					at: this.pos(i),
					block: b
				});
			}
			ctx.steps.push({
				type: "detonate",
				sourceId: det.sourceId,
				at: det.at,
				kind: sp.kind === "custom" ? "combo" : sp.kind,
				cells: targets.map((t) => t.at)
			});
			for (const t of targets) {
				t.block.kind = "special";
				t.block.special = { ...action.special };
				ctx.steps.push({
					type: "specialSpawn",
					block: this.snapshot(t.block),
					at: t.at,
					fromShape: "convert"
				});
				this.mark(ctx, t.at);
				if (!ctx.detonatedIds.has(t.block.id)) {
					ctx.detonatedIds.add(t.block.id);
					nextWave.push({
						sourceId: t.block.id,
						at: t.at,
						special: t.block.special
					});
				}
			}
			return;
		}
		const { cells, hitType } = this.actionCells(action);
		ctx.steps.push({
			type: "detonate",
			sourceId: det.sourceId,
			at: det.at,
			kind: sp.kind === "custom" ? "combo" : sp.kind,
			cells
		});
		for (const c of cells) this.mark(ctx, c);
		this.applyHits(ctx, cells.map((at) => ({
			at,
			type: hitType
		})), nextWave, depth);
	}
	actionForSpecial(sp, det) {
		switch (sp.kind) {
			case "rowClear": return {
				type: "clearRow",
				row: det.at.y
			};
			case "colClear": return {
				type: "clearColumn",
				col: det.at.x
			};
			case "blast": return {
				type: "blast",
				at: det.at,
				radius: sp.radius ?? 1
			};
			case "colorClear": return {
				type: "clearColor",
				color: det.colorHint ?? this.commonestColor()
			};
			case "seeker": return {
				type: "blast",
				at: this.seekTarget() ?? det.at,
				radius: sp.radius ?? 0
			};
			case "custom": return sp.action ?? {
				type: "blast",
				at: det.at,
				radius: 1
			};
		}
	}
	/** Seeker priority: a layered cell, else a blocker block, else a random block. */
	seekTarget() {
		const layered = [];
		const blockers = [];
		const any = [];
		for (let i = 0; i < this.grid.length; i++) {
			if (this.cells[i].layers?.length) layered.push(i);
			const b = this.grid[i];
			if (!b) continue;
			if (b.kind === "blocker") blockers.push(i);
			any.push(i);
		}
		const pool = layered.length ? layered : blockers.length ? blockers : any;
		return pool.length ? this.pos(pool[this.rng.int(pool.length)]) : null;
	}
	commonestColor() {
		const counts = new Array(this.colors).fill(0);
		for (const b of this.grid) if (b && b.kind === "normal" && b.color >= 0) counts[b.color]++;
		let best = 0;
		for (let c = 1; c < this.colors; c++) if (counts[c] > counts[best]) best = c;
		return best;
	}
	actionCells(action) {
		const cells = [];
		switch (action.type) {
			case "clearRow":
				if (action.row >= 0 && action.row < this.rows) {
					for (let x = 0; x < this.cols; x++) if (this.cells[this.idx(x, action.row)].kind !== "blocked") cells.push({
						x,
						y: action.row
					});
				}
				return {
					cells,
					hitType: "beam"
				};
			case "clearColumn":
				if (action.col >= 0 && action.col < this.cols) {
					for (let y = 0; y < this.rows; y++) if (this.cells[this.idx(action.col, y)].kind !== "blocked") cells.push({
						x: action.col,
						y
					});
				}
				return {
					cells,
					hitType: "beam"
				};
			case "blast": {
				const r = action.radius;
				for (let y = action.at.y - r; y <= action.at.y + r; y++) for (let x = action.at.x - r; x <= action.at.x + r; x++) if (this.inBounds(x, y) && this.cells[this.idx(x, y)].kind !== "blocked") cells.push({
					x,
					y
				});
				return {
					cells,
					hitType: "blast"
				};
			}
			case "clearColor":
				for (let i = 0; i < this.grid.length; i++) {
					const b = this.grid[i];
					if (b && b.matchable && b.color === action.color) cells.push(this.pos(i));
				}
				return {
					cells,
					hitType: "blast"
				};
			case "hammer": return {
				cells: [action.at],
				hitType: "tool"
			};
			case "splat": {
				const pool = [];
				for (let y = action.at.y - action.radius; y <= action.at.y + action.radius; y++) for (let x = action.at.x - action.radius; x <= action.at.x + action.radius; x++) if (this.inBounds(x, y) && this.grid[this.idx(x, y)]) pool.push({
					x,
					y
				});
				this.rng.shuffle(pool);
				return {
					cells: pool.slice(0, action.count),
					hitType: "tool"
				};
			}
			case "randomClear": {
				const pool = [];
				for (let i = 0; i < this.grid.length; i++) if (this.grid[i]) pool.push(this.pos(i));
				this.rng.shuffle(pool);
				return {
					cells: pool.slice(0, action.count),
					hitType: "tool"
				};
			}
			case "custom": return {
				cells: action.cells({
					cols: this.cols,
					rows: this.rows
				}),
				hitType: "blast"
			};
			default: return {
				cells,
				hitType: "blast"
			};
		}
	}
	comboActions(A, B, at) {
		const ka = A.special.kind;
		const kb = B.special.kind;
		const key = [ka, kb].sort().join("+");
		const user = this.cfg.comboMatrix?.[key];
		if (user) return user(at, {
			colorA: A.color,
			colorB: B.color
		});
		const isLine = (k) => k === "rowClear" || k === "colClear";
		if (isLine(ka) && isLine(kb)) return [{
			type: "clearRow",
			row: at.y
		}, {
			type: "clearColumn",
			col: at.x
		}];
		if (isLine(ka) && kb === "blast" || isLine(kb) && ka === "blast") {
			const acts = [];
			for (let d = -1; d <= 1; d++) {
				if (at.y + d >= 0 && at.y + d < this.rows) acts.push({
					type: "clearRow",
					row: at.y + d
				});
				if (at.x + d >= 0 && at.x + d < this.cols) acts.push({
					type: "clearColumn",
					col: at.x + d
				});
			}
			return acts;
		}
		if (ka === "blast" && kb === "blast") return [{
			type: "blast",
			at,
			radius: (A.special.radius ?? 1) + (B.special.radius ?? 1)
		}];
		if (ka === "colorClear" && kb === "colorClear") return [{
			type: "custom",
			cells: ({ cols, rows }) => {
				const all = [];
				for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) all.push({
					x,
					y
				});
				return all;
			}
		}];
		if (ka === "colorClear" || kb === "colorClear") {
			const other = ka === "colorClear" ? B : A;
			const color = other.color >= 0 ? other.color : this.commonestColor();
			const os = other.special;
			return [{
				type: "convertAndFire",
				color,
				special: os.kind === "blast" ? {
					kind: "blast",
					radius: 1
				} : os.kind === "seeker" ? {
					kind: "blast",
					radius: 0
				} : { kind: os.kind === "rowClear" ? "rowClear" : "colClear" }
			}];
		}
		return [{
			type: "blast",
			at,
			radius: 1
		}];
	}
	canFall(i, b) {
		if (b.static) return false;
		if (this.overlays[i]?.locksMove) return false;
		return true;
	}
	canEnterFalling(x, y) {
		if (!this.inBounds(x, y)) return false;
		const i = this.idx(x, y);
		const c = this.cells[i];
		if (c.kind === "blocked") return false;
		if (this.grid[i]) return false;
		if (c.kind === "conduit") return this.conduitDrains(x, y);
		return true;
	}
	/** Can a block entering this conduit keep going and eventually rest?
	* Portal-aware: a conduit carrying a portal drains into the portal target —
	* that's how a split board teleports its overflow into another section. */
	conduitDrains(x, y, depth = 0) {
		if (depth > 4) return false;
		let cy = y;
		for (let guard = 0; guard < this.rows + 2; guard++) {
			const cell = this.cells[this.idx(x, cy)];
			if (cell.portal) return this.acceptsFalling(cell.portal.to, depth + 1);
			cy++;
			if (cy >= this.rows) return false;
			const i = this.idx(x, cy);
			const c = this.cells[i];
			if (c.kind === "blocked") return false;
			if (this.grid[i]) return false;
			if (c.kind === "conduit") continue;
			return true;
		}
		return false;
	}
	/** Can a falling block land in (or pass through) this cell right now? */
	acceptsFalling(p, depth) {
		if (!this.inBounds(p.x, p.y)) return false;
		const i = this.idx(p.x, p.y);
		if (this.cells[i].kind === "blocked" || this.grid[i]) return false;
		if (this.cells[i].kind === "conduit") return this.conduitDrains(p.x, p.y, depth);
		return true;
	}
	/** Does the straight-up column feed cell (x, y)? Vertical fill beats diagonal
	* slide. When explicit spawner cells exist, only their columns count as fed
	* from the top (split boards refill sections through portals, not the sky). */
	columnFeeds(x, y) {
		for (let cy = y - 1; cy >= 0; cy--) {
			const i = this.idx(x, cy);
			if (this.cells[i].kind === "blocked") return false;
			const b = this.grid[i];
			if (b) return this.canFall(i, b);
		}
		if (this.refillMode() !== "top") return false;
		let explicit = false;
		let inColumn = false;
		for (let i = 0; i < this.cells.length; i++) if (this.cells[i].spawner) {
			explicit = true;
			if (i % this.cols === x) inColumn = true;
		}
		return !explicit || inColumn;
	}
	fallStep(x, y) {
		const dirs = this.cells[this.idx(x, y)].flow ?? ["down"];
		for (const dir of dirs) {
			const [dx, dy] = DIR_DELTA[dir];
			if (this.canEnterFalling(x + dx, y + dy)) return {
				x: x + dx,
				y: y + dy
			};
		}
		if ((this.cfg.diagonalSlide ?? this.preset === "match3") && dirs.includes("down")) for (const tx of [x - 1, x + 1]) {
			if (!this.canEnterFalling(tx, y + 1)) continue;
			if (this.columnFeeds(tx, y + 1)) continue;
			return {
				x: tx,
				y: y + 1
			};
		}
		return null;
	}
	/** One full settle pass, accumulating per-block travel paths. Returns true if anything moved. */
	settleInto(paths) {
		let movedAny = false;
		let moved = true;
		let guard = 0;
		while (moved && guard++ < this.rows * this.cols * 4) {
			moved = false;
			for (let y = this.rows - 1; y >= 0; y--) for (let x = 0; x < this.cols; x++) {
				const i = this.idx(x, y);
				const b = this.grid[i];
				if (!b || !this.canFall(i, b)) continue;
				const t = this.fallStep(x, y);
				if (!t) continue;
				const ti = this.idx(t.x, t.y);
				this.grid[ti] = b;
				this.grid[i] = null;
				let path = paths.get(b.id);
				if (!path) {
					path = [{
						x,
						y
					}];
					paths.set(b.id, path);
				}
				path.push({
					x: t.x,
					y: t.y
				});
				const portal = this.cells[ti].portal;
				if (portal && this.inBounds(portal.to.x, portal.to.y)) {
					const pi = this.idx(portal.to.x, portal.to.y);
					if (!this.grid[pi] && this.cells[pi].kind !== "blocked") {
						this.grid[pi] = b;
						this.grid[ti] = null;
						path.push({
							x: portal.to.x,
							y: portal.to.y
						});
					}
				}
				moved = true;
				movedAny = true;
			}
		}
		return movedAny;
	}
	spawnerCells() {
		const out = [];
		let explicit = false;
		for (let i = 0; i < this.cells.length; i++) if (this.cells[i].spawner) {
			explicit = true;
			out.push(i);
		}
		if (explicit) return out;
		for (let x = 0; x < this.cols; x++) {
			const i = this.idx(x, 0);
			if (this.cells[i].kind !== "blocked") out.push(i);
		}
		return out;
	}
	/** Settle + refill + ingredient exits until stable; emits one `fall` step
	* (plus `ingredientExit` steps); then the collapse-preset column close-up. */
	gravity(ctx) {
		const paths = /* @__PURE__ */ new Map();
		const spawned = /* @__PURE__ */ new Map();
		const stackCount = new Array(this.cols).fill(0);
		const refill = this.refillMode() === "top";
		const exits = [];
		for (let guard = 0; guard < this.rows * this.cols * 8; guard++) {
			this.settleInto(paths);
			let changed = false;
			for (let i = 0; i < this.grid.length; i++) {
				const b = this.grid[i];
				if (b && b.kind === "ingredient" && this.cells[i].exit) {
					const at = this.pos(i);
					this.grid[i] = null;
					exits.push({
						blockId: b.id,
						at,
						block: this.snapshot(b)
					});
					this.goal(ctx, "ingredients", void 0, 1);
					this.mark(ctx, at);
					changed = true;
				}
			}
			if (changed) continue;
			if (!refill) break;
			const empties = this.spawnerCells().filter((i) => {
				if (this.grid[i]) return false;
				const p = this.pos(i);
				return this.cells[i].kind !== "conduit" || this.conduitDrains(p.x, p.y);
			});
			if (!empties.length) break;
			for (const i of empties) {
				const p = this.pos(i);
				const b = this.makeBlock(this.spawnInit());
				this.grid[i] = b;
				paths.set(b.id, [p]);
				spawned.set(b.id, {
					entry: p,
					stack: stackCount[p.x]++
				});
			}
		}
		if (this.preset === "collapse" && (this.cfg.horizontalCollapse ?? true)) this.collapseColumns(paths);
		const moves = [];
		const spawns = [];
		for (const [id, path] of paths) {
			const to = path[path.length - 1];
			for (const p of path) this.mark(ctx, p);
			const sp = spawned.get(id);
			if (sp) {
				const b = this.grid[this.idx(to.x, to.y)];
				if (b && b.id === id) {
					const full = [];
					for (let y = sp.entry.y - sp.stack - 1; y < sp.entry.y; y++) full.push({
						x: sp.entry.x,
						y
					});
					full.push(...path);
					spawns.push({
						block: this.snapshot(b),
						column: sp.entry.x,
						entry: sp.entry,
						to,
						drop: to.y - sp.entry.y + 1,
						stack: sp.stack,
						path: full
					});
				}
			} else if (path.length > 1) moves.push({
				blockId: id,
				from: path[0],
				to,
				path
			});
		}
		if (moves.length || spawns.length) ctx.steps.push({
			type: "fall",
			moves,
			spawns
		});
		for (const e of exits) ctx.steps.push({
			type: "ingredientExit",
			...e
		});
	}
	/** Collapse preset: close fully-empty columns toward the left. */
	collapseColumns(paths) {
		let target = 0;
		for (let x = 0; x < this.cols; x++) {
			let hasBlock = false;
			for (let y = 0; y < this.rows; y++) if (this.grid[this.idx(x, y)]) {
				hasBlock = true;
				break;
			}
			if (!hasBlock) continue;
			if (target !== x) for (let y = 0; y < this.rows; y++) {
				const from = this.idx(x, y);
				const b = this.grid[from];
				if (!b) continue;
				this.grid[this.idx(target, y)] = b;
				this.grid[from] = null;
				let path = paths.get(b.id);
				if (!path) {
					path = [{
						x,
						y
					}];
					paths.set(b.id, path);
				}
				path.push({
					x: target,
					y
				});
			}
			target++;
		}
	}
	tick(ctx) {
		this.tickConveyors(ctx);
		this.tickSpread(ctx);
		this.tickBombs(ctx);
		this.gravity(ctx);
		if (this.preset === "match3" && this.findGroups().length) this.resolveCascades(ctx, {});
	}
	tickConveyors(ctx) {
		const back = /* @__PURE__ */ new Map();
		for (let j = 0; j < this.cells.length; j++) {
			const c = this.cells[j];
			if (c.kind !== "conveyor" || !c.conveyor) continue;
			const [dx, dy] = DIR_DELTA[c.conveyor];
			const p = this.pos(j);
			if (this.inBounds(p.x + dx, p.y + dy)) {
				const t = this.idx(p.x + dx, p.y + dy);
				if (this.cells[t].kind === "conveyor") back.set(t, j);
			}
		}
		const visited = /* @__PURE__ */ new Set();
		const shifts = [];
		for (let i = 0; i < this.cells.length; i++) {
			if (this.cells[i].kind !== "conveyor" || visited.has(i)) continue;
			let start = i;
			const backSeen = /* @__PURE__ */ new Set([i]);
			let isLoop = false;
			while (back.has(start)) {
				const prev = back.get(start);
				if (backSeen.has(prev)) {
					isLoop = true;
					break;
				}
				backSeen.add(prev);
				start = prev;
			}
			const chain = [];
			const chainSeen = /* @__PURE__ */ new Set();
			let cur = start;
			let exit = null;
			for (let guard = 0; guard < this.cells.length + 2; guard++) {
				chain.push(cur);
				chainSeen.add(cur);
				const c = this.cells[cur];
				if (!c.conveyor) break;
				const [dx, dy] = DIR_DELTA[c.conveyor];
				const p = this.pos(cur);
				if (!this.inBounds(p.x + dx, p.y + dy)) break;
				const next = this.idx(p.x + dx, p.y + dy);
				if (this.cells[next].kind === "conveyor") {
					if (chainSeen.has(next)) {
						isLoop = true;
						break;
					}
					cur = next;
				} else {
					exit = next;
					break;
				}
			}
			for (const c of chain) visited.add(c);
			if (!chain.length) continue;
			if (isLoop) {
				const blocks = chain.map((c) => this.grid[c]);
				for (let n = 0; n < chain.length; n++) {
					const from = chain[n];
					const to = chain[(n + 1) % chain.length];
					const b = blocks[n];
					this.grid[to] = b;
					if (b) shifts.push({
						blockId: b.id,
						from: this.pos(from),
						to: this.pos(to),
						path: [this.pos(from), this.pos(to)]
					});
				}
			} else {
				let free = exit !== null && this.cells[exit].kind !== "blocked" && !this.grid[exit] ? exit : null;
				for (let n = chain.length - 1; n >= 0; n--) {
					const from = chain[n];
					const b = this.grid[from];
					if (!b) {
						free = from;
						continue;
					}
					if (free === null) continue;
					this.grid[free] = b;
					this.grid[from] = null;
					shifts.push({
						blockId: b.id,
						from: this.pos(from),
						to: this.pos(free),
						path: [this.pos(from), this.pos(free)]
					});
					free = from;
				}
			}
		}
		if (shifts.length) {
			for (const s of shifts) {
				this.mark(ctx, s.from);
				this.mark(ctx, s.to);
			}
			ctx.steps.push({
				type: "conveyor",
				shifts
			});
		}
	}
	tickSpread(ctx) {
		const byKind = /* @__PURE__ */ new Map();
		for (let i = 0; i < this.overlays.length; i++) {
			const ov = this.overlays[i];
			if (!ov?.spreads || ctx.damagedOverlayKinds.has(ov.kind)) continue;
			let list = byKind.get(ov.kind);
			if (!list) {
				list = [];
				byKind.set(ov.kind, list);
			}
			list.push(i);
		}
		const growth = [];
		for (const [kind, sources] of byKind) {
			const candidates = [];
			for (const i of sources) {
				const p = this.pos(i);
				for (const [dx, dy] of ORTHO) {
					const nx = p.x + dx;
					const ny = p.y + dy;
					if (!this.inBounds(nx, ny)) continue;
					const ni = this.idx(nx, ny);
					const nb = this.grid[ni];
					if (!nb || nb.kind !== "normal" || this.overlays[ni]) continue;
					candidates.push(ni);
				}
			}
			if (!candidates.length) continue;
			const pick = candidates[this.rng.int(candidates.length)];
			this.overlays[pick] = { ...this.overlays[sources[0]] };
			const at = this.pos(pick);
			growth.push({
				kind,
				at
			});
			this.mark(ctx, at);
		}
		if (growth.length) ctx.steps.push({
			type: "spread",
			growth
		});
	}
	tickBombs(ctx) {
		const ticks = [];
		for (let i = 0; i < this.grid.length; i++) {
			const b = this.grid[i];
			if (!b || b.bombTimer == null) continue;
			b.bombTimer = Math.max(0, b.bombTimer - 1);
			ticks.push({
				blockId: b.id,
				at: this.pos(i),
				remaining: b.bombTimer
			});
			if (b.bombTimer === 0) ctx.gameOver = "bomb";
		}
		if (ticks.length) ctx.steps.push({
			type: "bombTick",
			ticks
		});
		if (ctx.gameOver === "bomb") ctx.steps.push({
			type: "gameOver",
			reason: "bomb"
		});
	}
	doShuffle(ctx) {
		const cells = [];
		for (let i = 0; i < this.grid.length; i++) {
			const b = this.grid[i];
			if (b && b.kind === "normal" && !b.static && !this.overlays[i]?.locksMove) cells.push(i);
		}
		if (cells.length < 4) return false;
		const before = /* @__PURE__ */ new Map();
		for (const i of cells) before.set(this.grid[i].id, this.pos(i));
		const blocks = cells.map((i) => this.grid[i]);
		let ok = false;
		for (let attempt = 0; attempt < 60; attempt++) {
			this.rng.shuffle(blocks);
			cells.forEach((i, n) => {
				this.grid[i] = blocks[n];
			});
			if (this.findGroups().length === 0 && this.findMoves().length > 0) {
				ok = true;
				break;
			}
		}
		if (!ok) return false;
		const moves = [];
		for (const i of cells) {
			const b = this.grid[i];
			const from = before.get(b.id);
			const to = this.pos(i);
			if (from.x !== to.x || from.y !== to.y) moves.push({
				blockId: b.id,
				from,
				to
			});
			this.mark(ctx, to);
		}
		ctx.steps.push({
			type: "shuffle",
			moves
		});
		return true;
	}
	/** Every legal move, with its predicted primary outcome, best first. */
	findMoves() {
		const out = [];
		if (this.preset === "chain") {
			const minLen = this.cfg.chain?.minLength ?? 3;
			const adj8 = (this.cfg.chain?.adjacency ?? 4) === 8;
			const seen = /* @__PURE__ */ new Set();
			for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
				const i = this.idx(x, y);
				if (seen.has(i)) continue;
				const region = floodGroup(this.scanView(), x, y, adj8);
				for (const c of region) seen.add(this.idx(c.x, c.y));
				if (region.length < minLen) continue;
				const path = this.longestPathIn(region);
				if (path.length >= minLen) out.push({
					kind: "path",
					a: path[0],
					path,
					shape: "group",
					length: path.length,
					value: path.length * path.length
				});
			}
			return out.sort((p, q) => q.value - p.value);
		}
		if (this.preset === "collapse") {
			const seen = /* @__PURE__ */ new Set();
			for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
				const i = this.idx(x, y);
				if (seen.has(i)) continue;
				const g = floodGroup(this.scanView(), x, y);
				for (const c of g) seen.add(this.idx(c.x, c.y));
				if (g.length >= (this.cfg.minGroup ?? 2)) out.push({
					kind: "tap",
					a: {
						x,
						y
					},
					shape: "group",
					length: g.length,
					value: g.length * g.length
				});
			}
			return out.sort((p, q) => q.value - p.value);
		}
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) for (const [dx, dy] of [[1, 0], [0, 1]]) {
			const a = {
				x,
				y
			};
			const b = {
				x: x + dx,
				y: y + dy
			};
			if (!this.inBounds(b.x, b.y)) continue;
			const ia = this.idx(a.x, a.y);
			const ib = this.idx(b.x, b.y);
			if (!this.swappable(ia) || !this.swappable(ib)) continue;
			const A = this.grid[ia];
			const B = this.grid[ib];
			if (A.special && B.special) {
				out.push({
					kind: "swap",
					a,
					b,
					shape: "group",
					length: 2,
					value: 500
				});
				continue;
			}
			const cc = A.special?.kind === "colorClear" ? B : B.special?.kind === "colorClear" ? A : null;
			if (cc && cc.color >= 0 && !cc.special) {
				let n = 0;
				for (const blk of this.grid) if (blk && blk.matchable && blk.color === cc.color) n++;
				out.push({
					kind: "swap",
					a,
					b,
					shape: "group",
					length: n,
					value: 100 + n * 10
				});
				continue;
			}
			const pred = this.predictSwap(ia, ib);
			if (pred) out.push({
				kind: "swap",
				a,
				b,
				shape: pred.shape,
				length: pred.length,
				value: pred.value
			});
		}
		return out.sort((p, q) => q.value - p.value);
	}
	/** Greedy longest simple path through a same-colour region (chain autoplay/hints). */
	longestPathIn(region) {
		const inRegion = new Set(region.map((c) => this.idx(c.x, c.y)));
		const dirs = (this.cfg.chain?.adjacency ?? 4) === 8 ? [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1],
			[1, 1],
			[1, -1],
			[-1, 1],
			[-1, -1]
		] : [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1]
		];
		const neighbours = (c, used) => {
			const out = [];
			for (const [dx, dy] of dirs) {
				const nx = c.x + dx;
				const ny = c.y + dy;
				if (!this.inBounds(nx, ny)) continue;
				const ni = this.idx(nx, ny);
				if (inRegion.has(ni) && !used.has(ni)) out.push({
					x: nx,
					y: ny
				});
			}
			return out;
		};
		let best = [];
		const starts = region.slice(0, 8);
		for (const start of starts) {
			const used = /* @__PURE__ */ new Set([this.idx(start.x, start.y)]);
			const path = [start];
			let cur = start;
			for (let n = 0; n < region.length; n++) {
				const next = neighbours(cur, used).sort((a, b) => neighbours(a, used).length - neighbours(b, used).length)[0];
				if (!next) break;
				used.add(this.idx(next.x, next.y));
				path.push(next);
				cur = next;
			}
			if (path.length > best.length) best = path;
			if (best.length === region.length) break;
		}
		return best;
	}
	/** The single best move, or null. */
	hint() {
		return this.findMoves()[0] ?? null;
	}
	predictSwap(ia, ib) {
		const A = this.grid[ia];
		const B = this.grid[ib];
		const tk = this.mergeStyle() === "levelAll" ? 0 : 256;
		const override = /* @__PURE__ */ new Map([[ia, B.color + B.tier * tk], [ib, A.color + A.tier * tk]]);
		const view = this.scanView(override);
		let best = null;
		for (const i of [ia, ib]) {
			const p = this.pos(i);
			const c = view.matchColorAt(p.x, p.y);
			if (c < 0) continue;
			let h = 1;
			for (let x = p.x - 1; x >= 0 && view.matchColorAt(x, p.y) === c; x--) h++;
			for (let x = p.x + 1; x < this.cols && view.matchColorAt(x, p.y) === c; x++) h++;
			let v = 1;
			for (let y = p.y - 1; y >= 0 && view.matchColorAt(p.x, y) === c; y--) v++;
			for (let y = p.y + 1; y < this.rows && view.matchColorAt(p.x, y) === c; y++) v++;
			if (h < 3 && v < 3) continue;
			const len = (h >= 3 ? h : 0) + (v >= 3 ? v : 0) - (h >= 3 && v >= 3 ? 1 : 0);
			const shape = h >= 3 && v >= 3 ? Math.max(h, v) >= 5 ? "five" : "L" : Math.max(h, v) >= 6 ? "longer" : Math.max(h, v) === 5 ? "five" : Math.max(h, v) === 4 ? "four" : "three";
			const value = len * 10 + (shape === "five" || shape === "longer" ? 100 : shape === "L" ? 50 : shape === "four" ? 30 : 0);
			if (!best || value > best.value) best = {
				shape,
				length: len,
				value
			};
		}
		return best;
	}
	/**
	* Play the board by itself: pick a move per `policy`, apply it, repeat.
	* Stops on `maxMoves`, no moves left, all goals done, or a lose trigger.
	*/
	autoplay(opts = {}) {
		const results = [];
		const max = opts.maxMoves ?? 100;
		for (let n = 0; n < max; n++) {
			const moves = this.findMoves();
			if (!moves.length) break;
			const policy = opts.policy ?? "best";
			const move = typeof policy === "function" ? policy(moves, this) : policy === "best" ? moves[0] : policy === "worst" ? moves[moves.length - 1] : moves[this.rng.int(moves.length)];
			const result = move.kind === "path" ? this.playPath(move.path) : move.kind === "tap" ? this.tap(move.a) : this.swap(move.a, move.b);
			results.push(result);
			opts.onMove?.(result, move);
			if (result.gameOver) break;
			if (this.goals.length && this.goals.every((g) => g.done)) break;
			if (this.movesLeft <= 0) break;
		}
		return results;
	}
	/** Mark a result's region as visually busy while the game plays it back. */
	beginPresent(result) {
		this.presenting.set(result, new Set(result.region));
	}
	/** Release a region when its playback finishes. */
	endPresent(result) {
		this.presenting.delete(result);
	}
	/** Cell indices currently visually busy. */
	busy() {
		const out = /* @__PURE__ */ new Set();
		for (const s of this.presenting.values()) for (const i of s) out.add(i);
		return [...out];
	}
	/**
	* Conservative admission for parallel play: false when the COLUMNS of the
	* candidate cells intersect any busy region (cascades pull whole columns).
	*/
	canMove(a, b) {
		if (this.presenting.size === 0) return true;
		const cols = /* @__PURE__ */ new Set([a.x]);
		if (b) cols.add(b.x);
		for (const s of this.presenting.values()) for (const i of s) if (cols.has(i % this.cols)) return false;
		return true;
	}
	scoreFor(ev) {
		if (this.cfg.scorer) return this.cfg.scorer(ev);
		const mult = ev.depth + 1;
		if (ev.kind === "clear") return 10 * mult;
		if (this.preset !== "match3") return Math.max(0, ev.blocks - 2) ** 2 * 5;
		return (ev.shape === "longer" ? 150 : ev.shape === "five" ? 100 : ev.shape === "cross" ? 60 : ev.shape === "L" || ev.shape === "T" ? 50 : ev.shape === "square" ? 40 : ev.shape === "four" ? 30 : 0) * mult;
	}
	goal(ctx, type, match, amount) {
		this.goals.forEach((g, n) => {
			if (g.def.type !== type || g.done) return;
			if (type === "clearColor" && g.def.color !== match) return;
			if (type === "clearTagged" && g.def.tag !== match) return;
			if ((type === "clearLayer" || type === "clearOverlay") && g.def.kind !== match) return;
			ctx.goalAmounts.set(n, (ctx.goalAmounts.get(n) ?? 0) + amount);
		});
	}
	endMove(ctx, countsAsMove = true) {
		if (countsAsMove) {
			this.moveCount++;
			if (this.movesLeft !== Infinity) this.movesLeft--;
		}
		if (this.cfg.autoTick ?? true) this.tick(ctx);
		if (this.preset === "match3" && (this.cfg.autoShuffle ?? true) && !ctx.gameOver) {
			let guard = 0;
			while (this.findMoves().length === 0 && guard++ < 10) if (!this.doShuffle(ctx)) {
				ctx.gameOver = "noMoves";
				ctx.steps.push({
					type: "gameOver",
					reason: "noMoves"
				});
				break;
			}
		}
		return this.finish(ctx, true);
	}
	finish(ctx, valid) {
		const goalsDelta = [];
		for (const [n, amount] of ctx.goalAmounts) {
			const g = this.goals[n];
			g.remaining = Math.max(0, g.remaining - amount);
			g.done = g.remaining === 0;
			goalsDelta.push({
				id: g.id,
				amount,
				remaining: g.remaining,
				done: g.done
			});
		}
		const gained = this.score - ctx.scoreStart;
		this.goals.forEach((g) => {
			if (g.def.type !== "score" || g.done || gained <= 0) return;
			g.remaining = Math.max(0, g.remaining - gained);
			g.done = g.remaining === 0;
			goalsDelta.push({
				id: g.id,
				amount: gained,
				remaining: g.remaining,
				done: g.done
			});
		});
		ctx.totals.score = gained;
		return {
			valid,
			steps: ctx.steps,
			region: [...ctx.region].sort((a, b) => a - b),
			totals: ctx.totals,
			goalsDelta,
			...ctx.gameOver ? { gameOver: ctx.gameOver } : {}
		};
	}
};
//#endregion
//#region src/packs/match3/versus.ts
/** Create a 1-v-1 (or N-way) versus channel. Opponent = every other registered id. */
function createVersus(cfg) {
	const boards = /* @__PURE__ */ new Map();
	const incoming = /* @__PURE__ */ new Map();
	const cap = cfg.maxPerDelivery ?? Infinity;
	return {
		addPlayer(id, board) {
			boards.set(id, board);
			incoming.set(id, 0);
		},
		send(id, result) {
			let units = Math.max(0, Math.floor(cfg.attack(result)));
			const mine = incoming.get(id) ?? 0;
			if (mine > 0 && units > 0) {
				const cancel = Math.min(mine, units);
				incoming.set(id, mine - cancel);
				units -= cancel;
			}
			if (units <= 0) return 0;
			for (const other of boards.keys()) {
				if (other === id) continue;
				incoming.set(other, (incoming.get(other) ?? 0) + units);
			}
			return units;
		},
		pending(id) {
			return incoming.get(id) ?? 0;
		},
		deliver(id) {
			const units = Math.min(incoming.get(id) ?? 0, cap);
			if (units <= 0) return null;
			incoming.set(id, (incoming.get(id) ?? 0) - units);
			return cfg.receive(boards.get(id), units);
		}
	};
}
//#endregion
//#region src/packs/match3/placemerge.ts
var Rng$1 = class {
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
};
function createPlaceMerge(cfg) {
	return new PlaceMerge(cfg);
}
var PlaceMerge = class {
	cols;
	rows;
	maxTier;
	gameOver = false;
	score = 0;
	turns = 0;
	grid;
	rng;
	nextId = 1;
	cfg;
	dealItem;
	stored = null;
	constructor(cfg) {
		this.cfg = cfg;
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		this.maxTier = cfg.maxTier ?? 6;
		this.rng = new Rng$1(cfg.seed ?? 1);
		this.grid = new Array(cfg.cols * cfg.rows).fill(null);
		this.dealItem = this.roll();
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	inBounds(x, y) {
		return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
	}
	item(x, y) {
		return this.inBounds(x, y) ? this.grid[this.idx(x, y)] : null;
	}
	/** The item about to be placed. */
	get deal() {
		return this.dealItem;
	}
	get storage() {
		return this.stored;
	}
	roll() {
		if (this.rng.float() < (this.cfg.walkerChance ?? .08)) return {
			id: this.nextId++,
			type: -1,
			tier: 0,
			kind: "walker"
		};
		const table = this.cfg.deal ?? [
			[
				0,
				0,
				70
			],
			[
				1,
				0,
				20
			],
			[
				2,
				0,
				8
			],
			[
				0,
				0,
				2
			]
		];
		const pick = table[this.rng.weighted(table.map((t) => t[2]))];
		return {
			id: this.nextId++,
			type: pick[0],
			tier: pick[1],
			kind: "block"
		};
	}
	neighbours(x, y) {
		const out = [];
		for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1]
		]) if (this.inBounds(x + dx, y + dy)) out.push({
			x: x + dx,
			y: y + dy
		});
		return out;
	}
	group(x, y, type, tier) {
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
				const it = this.grid[this.idx(nb.x, nb.y)];
				const i = this.idx(nb.x, nb.y);
				if (seen.has(i) || !it || it.kind !== "block" || it.type !== type || it.tier !== tier) continue;
				seen.add(i);
				stack.push(nb);
			}
		}
		return out;
	}
	/** Place the current deal at an empty cell. Resolves merges, runs the turn. */
	place(at) {
		const steps = [];
		if (this.gameOver || !this.inBounds(at.x, at.y) || this.grid[this.idx(at.x, at.y)]) return {
			valid: false,
			steps,
			merges: 0,
			topTier: this.topTier(),
			gameOver: this.gameOver
		};
		const placed = this.dealItem;
		this.grid[this.idx(at.x, at.y)] = placed;
		steps.push({
			type: "place",
			at,
			item: placed
		});
		this.turns++;
		let merges = 0;
		if (placed.kind === "block") merges = this.resolveMerges(at, steps);
		this.moveWalkers(steps);
		this.dealItem = this.stored ? this.takeStored() : this.roll();
		if (!this.anyEmpty()) {
			this.gameOver = true;
			steps.push({ type: "gameOver" });
		}
		return {
			valid: true,
			steps,
			merges,
			topTier: this.topTier(),
			gameOver: this.gameOver
		};
	}
	/** Stow the deal in the one storage slot (swaps with a stored item). */
	store() {
		if (this.gameOver) return;
		const tmp = this.stored;
		this.stored = this.dealItem;
		this.dealItem = tmp ?? this.roll();
	}
	takeStored() {
		const s = this.stored;
		this.stored = null;
		return s;
	}
	resolveMerges(at, steps) {
		let pivot = at;
		let count = 0;
		for (let guard = 0; guard < 64; guard++) {
			const it = this.grid[this.idx(pivot.x, pivot.y)];
			if (!it || it.kind !== "block" || it.tier >= this.maxTier) break;
			const grp = this.group(pivot.x, pivot.y, it.type, it.tier);
			if (grp.length < 3) break;
			for (const c of grp) this.grid[this.idx(c.x, c.y)] = null;
			const bonus = grp.length >= 4 ? 1 : 0;
			const result = {
				id: this.nextId++,
				type: it.type,
				tier: it.tier + 1,
				kind: "block"
			};
			this.grid[this.idx(pivot.x, pivot.y)] = result;
			steps.push({
				type: "merge",
				at: pivot,
				from: grp.filter((c) => !(c.x === pivot.x && c.y === pivot.y)),
				result
			});
			this.score += (result.tier + 1) * 10 * (1 + bonus);
			count++;
		}
		return count;
	}
	moveWalkers(steps) {
		const walkers = [];
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (this.grid[this.idx(x, y)]?.kind === "walker") walkers.push({
			x,
			y
		});
		const moves = [];
		const tombstones = [];
		for (const w of walkers) {
			const it = this.grid[this.idx(w.x, w.y)];
			if (!it) continue;
			const empties = this.neighbours(w.x, w.y).filter((nb) => !this.grid[this.idx(nb.x, nb.y)]);
			if (empties.length === 0) {
				this.grid[this.idx(w.x, w.y)] = {
					id: it.id,
					type: 100,
					tier: 0,
					kind: "block"
				};
				tombstones.push(w);
			} else {
				const to = empties[this.rng.int(empties.length)];
				this.grid[this.idx(to.x, to.y)] = it;
				this.grid[this.idx(w.x, w.y)] = null;
				moves.push({
					id: it.id,
					from: w,
					to
				});
			}
		}
		if (moves.length) steps.push({
			type: "walk",
			moves
		});
		if (tombstones.length) steps.push({
			type: "tombstone",
			cells: tombstones
		});
	}
	anyEmpty() {
		return this.grid.some((c) => c === null);
	}
	topTier() {
		let t = 0;
		for (const c of this.grid) if (c && c.tier > t) t = c.tier;
		return t;
	}
	/** Legal placements (every empty cell), best first by predicted merge size. */
	findPlaces() {
		const out = [];
		const it = this.dealItem;
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
			if (this.grid[this.idx(x, y)]) continue;
			let m = 0;
			if (it.kind === "block") {
				this.grid[this.idx(x, y)] = it;
				m = this.group(x, y, it.type, it.tier).length;
				this.grid[this.idx(x, y)] = null;
			}
			out.push({
				at: {
					x,
					y
				},
				merges: m
			});
		}
		return out.sort((a, b) => b.merges - a.merges);
	}
	/** Auto-play: always place where it merges most (else an open cell). */
	autoplay(maxTurns = 500) {
		const out = [];
		for (let n = 0; n < maxTurns && !this.gameOver; n++) {
			const best = this.findPlaces()[0];
			if (!best) break;
			out.push(this.place(best.at));
		}
		return out;
	}
	debugGrid() {
		const rows = [];
		for (let y = 0; y < this.rows; y++) {
			let r = "";
			for (let x = 0; x < this.cols; x++) {
				const it = this.grid[this.idx(x, y)];
				r += !it ? "." : it.kind === "walker" ? "B" : String(it.tier);
			}
			rows.push(r);
		}
		return rows.join("\n");
	}
};
//#endregion
//#region src/packs/match3/rise.ts
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
function createRiseBoard(cfg) {
	return new RiseBoard(cfg);
}
var RiseBoard = class {
	cols;
	rows;
	colors;
	topOut = false;
	score = 0;
	grid;
	rng;
	nextId = 1;
	nextGarbageId = 1;
	constructor(cfg) {
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		this.colors = cfg.colors ?? 5;
		this.rng = new Rng(cfg.seed ?? 1);
		this.grid = new Array(cfg.cols * cfg.rows).fill(null);
		const fill = cfg.fillRows ?? 4;
		for (let y = this.rows - fill; y < this.rows; y++) for (let x = 0; x < this.cols; x++) this.grid[this.idx(x, y)] = this.freshPanel(x, y);
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	inBounds(x, y) {
		return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
	}
	panel(x, y) {
		return this.inBounds(x, y) ? this.grid[this.idx(x, y)] : null;
	}
	/** A panel that doesn't complete a run with its placed neighbours (clean deal). */
	freshPanel(x, y) {
		const bad = /* @__PURE__ */ new Set();
		const at = (px, py) => this.grid[this.idx(px, py)]?.color ?? -2;
		for (let c = 0; c < this.colors; c++) {
			if (at(x - 1, y) === c && at(x - 2, y) === c) bad.add(c);
			if (at(x, y - 1) === c && at(x, y - 2) === c) bad.add(c);
		}
		let c = this.rng.int(this.colors);
		let guard = 0;
		while (bad.has(c) && guard++ < 20) c = this.rng.int(this.colors);
		return {
			id: this.nextId++,
			color: c
		};
	}
	/** Push a new row up from the bottom (the game calls this on its clock). */
	rise() {
		const steps = [];
		for (let y = 0; y < this.rows - 1; y++) for (let x = 0; x < this.cols; x++) this.grid[this.idx(x, y)] = this.grid[this.idx(x, y + 1)];
		const row = [];
		for (let x = 0; x < this.cols; x++) {
			const p = this.freshPanel(x, this.rows - 1);
			this.grid[this.idx(x, this.rows - 1)] = p;
			row.push({ color: p.color });
		}
		steps.push({
			type: "rise",
			row
		});
		for (let x = 0; x < this.cols; x++) if (this.grid[this.idx(x, 0)]) {
			this.topOut = true;
			steps.push({ type: "topOut" });
			break;
		}
		return {
			steps,
			cleared: 0,
			chain: 0,
			combo: 0,
			stopTime: 0,
			topOut: this.topOut
		};
	}
	/** Swap two horizontally-adjacent cells (panel↔panel or panel↔empty). Legal
	* anytime — no match required. Then resolve matches + provenance chains. */
	swap(a, b) {
		const steps = [];
		if (!this.inBounds(a.x, a.y) || !this.inBounds(b.x, b.y) || a.y !== b.y || Math.abs(a.x - b.x) !== 1) return {
			steps,
			cleared: 0,
			chain: 0,
			combo: 0,
			stopTime: 0,
			topOut: this.topOut
		};
		const ia = this.idx(a.x, a.y);
		const ib = this.idx(b.x, b.y);
		const A = this.grid[ia];
		const B = this.grid[ib];
		if (A?.garbage || B?.garbage) return {
			steps,
			cleared: 0,
			chain: 0,
			combo: 0,
			stopTime: 0,
			topOut: this.topOut
		};
		this.grid[ia] = B;
		this.grid[ib] = A;
		steps.push({
			type: "swap",
			a,
			b
		});
		return this.resolve(steps);
	}
	/** Add a multi-cell garbage block at the top (from a versus attack). */
	addGarbage(x, y, w, h, color = -1) {
		const bid = this.nextGarbageId++;
		for (let dy = 0; dy < h; dy++) for (let dx = 0; dx < w; dx++) if (this.inBounds(x + dx, y + dy)) this.grid[this.idx(x + dx, y + dy)] = {
			id: this.nextId++,
			color,
			garbage: { blockId: bid }
		};
	}
	resolve(steps) {
		let chain = 0;
		let totalCleared = 0;
		let combo = 0;
		for (let guard = 0; guard < 64; guard++) {
			this.settle(steps, chain > 0);
			const matches = this.findMatches();
			if (matches.length === 0) break;
			const flagged = matches.some((c) => this.grid[this.idx(c.x, c.y)]?.chainFlag);
			chain += flagged || chain === 0 ? chain === 0 ? 0 : 1 : 0;
			if (flagged) chain++;
			combo = Math.max(combo, matches.length);
			steps.push({
				type: "match",
				cells: matches.slice(),
				chain,
				combo: matches.length
			});
			this.breakGarbage(matches, steps);
			for (const c of matches) this.grid[this.idx(c.x, c.y)] = null;
			steps.push({
				type: "clear",
				cells: matches.slice()
			});
			totalCleared += matches.length;
			this.score += matches.length * 10 * (chain + 1);
		}
		const stopTime = totalCleared > 0 ? (combo + chain * 2) * .15 : 0;
		return {
			steps,
			cleared: totalCleared,
			chain,
			combo,
			stopTime,
			topOut: this.topOut
		};
	}
	/** Gravity with provenance: a panel that falls because of a clear gets chainFlag. */
	settle(steps, markChain) {
		const moves = [];
		let moved = true;
		while (moved) {
			moved = false;
			for (let y = this.rows - 2; y >= 0; y--) for (let x = 0; x < this.cols; x++) {
				const p = this.grid[this.idx(x, y)];
				if (!p || p.garbage) continue;
				if (!this.grid[this.idx(x, y + 1)]) {
					this.grid[this.idx(x, y + 1)] = p;
					this.grid[this.idx(x, y)] = null;
					p.chainFlag = markChain;
					moves.push({
						id: p.id,
						from: {
							x,
							y
						},
						to: {
							x,
							y: y + 1
						}
					});
					moved = true;
				}
			}
		}
		if (moves.length) steps.push({
			type: "fall",
			moves
		});
		else for (const p of this.grid) if (p && !p.garbage) {}
	}
	findMatches() {
		const marked = /* @__PURE__ */ new Set();
		for (let y = 0; y < this.rows; y++) {
			let x = 0;
			while (x < this.cols) {
				const c = this.colorAt(x, y);
				if (c < 0) {
					x++;
					continue;
				}
				let end = x + 1;
				while (end < this.cols && this.colorAt(end, y) === c) end++;
				if (end - x >= 3) for (let i = x; i < end; i++) marked.add(this.idx(i, y));
				x = end;
			}
		}
		for (let x = 0; x < this.cols; x++) {
			let y = 0;
			while (y < this.rows) {
				const c = this.colorAt(x, y);
				if (c < 0) {
					y++;
					continue;
				}
				let end = y + 1;
				while (end < this.rows && this.colorAt(x, end) === c) end++;
				if (end - y >= 3) for (let i = y; i < end; i++) marked.add(this.idx(x, i));
				y = end;
			}
		}
		return [...marked].map((i) => ({
			x: i % this.cols,
			y: i / this.cols | 0
		}));
	}
	colorAt(x, y) {
		const p = this.grid[this.idx(x, y)];
		return p && !p.garbage ? p.color : -1;
	}
	breakGarbage(matched, steps) {
		new Set(matched.map((c) => this.idx(c.x, c.y)));
		const touched = /* @__PURE__ */ new Set();
		for (const c of matched) for (const [dx, dy] of [
			[1, 0],
			[-1, 0],
			[0, 1],
			[0, -1]
		]) {
			const nx = c.x + dx;
			const ny = c.y + dy;
			if (!this.inBounds(nx, ny)) continue;
			const p = this.grid[this.idx(nx, ny)];
			if (p?.garbage) touched.add(p.garbage.blockId);
		}
		for (const bid of touched) {
			let maxY = -1;
			const cellsOfBlock = [];
			for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (this.grid[this.idx(x, y)]?.garbage?.blockId === bid) {
				cellsOfBlock.push({
					x,
					y
				});
				if (y > maxY) maxY = y;
			}
			const bottomRow = cellsOfBlock.filter((c) => c.y === maxY);
			const spawned = [];
			for (const c of bottomRow) {
				const col = this.rng.int(this.colors);
				this.grid[this.idx(c.x, c.y)] = {
					id: this.nextId++,
					color: col,
					chainFlag: false
				};
				spawned.push({
					at: c,
					color: col
				});
			}
			steps.push({
				type: "garbageBreak",
				blockId: bid,
				row: bottomRow,
				spawned
			});
		}
	}
	/** Legal swaps that would make a match (autoplay/hints). */
	findMoves() {
		const out = [];
		for (let y = 0; y < this.rows; y++) for (let x = 0; x + 1 < this.cols; x++) {
			const a = {
				x,
				y
			};
			const b = {
				x: x + 1,
				y
			};
			const ia = this.idx(a.x, a.y);
			const ib = this.idx(b.x, b.y);
			if (this.grid[ia]?.garbage || this.grid[ib]?.garbage) continue;
			const A = this.grid[ia];
			const B = this.grid[ib];
			this.grid[ia] = B;
			this.grid[ib] = A;
			const makes = this.findMatches().length > 0;
			this.grid[ia] = A;
			this.grid[ib] = B;
			if (makes) out.push({
				a,
				b
			});
		}
		return out;
	}
	debugGrid() {
		const rows = [];
		for (let y = 0; y < this.rows; y++) {
			let r = "";
			for (let x = 0; x < this.cols; x++) {
				const p = this.grid[this.idx(x, y)];
				r += !p ? "." : p.garbage ? "G" : String(p.color);
			}
			rows.push(r);
		}
		return rows.join("\n");
	}
};
//#endregion
export { Board, PlaceMerge, RiseBoard, classifyGroup, createBoard, createPlaceMerge, createRiseBoard, createVersus, findMatchGroups, floodGroup };

//# sourceMappingURL=match3.js.map
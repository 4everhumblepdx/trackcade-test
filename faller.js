//#region src/packs/faller.ts
var TETRO = {
	I: [
		[
			[0, 1],
			[1, 1],
			[2, 1],
			[3, 1]
		],
		[
			[2, 0],
			[2, 1],
			[2, 2],
			[2, 3]
		],
		[
			[0, 2],
			[1, 2],
			[2, 2],
			[3, 2]
		],
		[
			[1, 0],
			[1, 1],
			[1, 2],
			[1, 3]
		]
	].map((s) => s.map(([x, y]) => ({
		x,
		y
	}))),
	O: [
		[
			[1, 0],
			[2, 0],
			[1, 1],
			[2, 1]
		],
		[
			[1, 0],
			[2, 0],
			[1, 1],
			[2, 1]
		],
		[
			[1, 0],
			[2, 0],
			[1, 1],
			[2, 1]
		],
		[
			[1, 0],
			[2, 0],
			[1, 1],
			[2, 1]
		]
	].map((s) => s.map(([x, y]) => ({
		x,
		y
	}))),
	T: [
		[
			[1, 0],
			[0, 1],
			[1, 1],
			[2, 1]
		],
		[
			[1, 0],
			[1, 1],
			[2, 1],
			[1, 2]
		],
		[
			[0, 1],
			[1, 1],
			[2, 1],
			[1, 2]
		],
		[
			[1, 0],
			[0, 1],
			[1, 1],
			[1, 2]
		]
	].map((s) => s.map(([x, y]) => ({
		x,
		y
	}))),
	S: [
		[
			[1, 0],
			[2, 0],
			[0, 1],
			[1, 1]
		],
		[
			[1, 0],
			[1, 1],
			[2, 1],
			[2, 2]
		],
		[
			[1, 1],
			[2, 1],
			[0, 2],
			[1, 2]
		],
		[
			[0, 0],
			[0, 1],
			[1, 1],
			[1, 2]
		]
	].map((s) => s.map(([x, y]) => ({
		x,
		y
	}))),
	Z: [
		[
			[0, 0],
			[1, 0],
			[1, 1],
			[2, 1]
		],
		[
			[2, 0],
			[1, 1],
			[2, 1],
			[1, 2]
		],
		[
			[0, 1],
			[1, 1],
			[1, 2],
			[2, 2]
		],
		[
			[1, 0],
			[0, 1],
			[1, 1],
			[0, 2]
		]
	].map((s) => s.map(([x, y]) => ({
		x,
		y
	}))),
	J: [
		[
			[0, 0],
			[0, 1],
			[1, 1],
			[2, 1]
		],
		[
			[1, 0],
			[2, 0],
			[1, 1],
			[1, 2]
		],
		[
			[0, 1],
			[1, 1],
			[2, 1],
			[2, 2]
		],
		[
			[1, 0],
			[1, 1],
			[0, 2],
			[1, 2]
		]
	].map((s) => s.map(([x, y]) => ({
		x,
		y
	}))),
	L: [
		[
			[2, 0],
			[0, 1],
			[1, 1],
			[2, 1]
		],
		[
			[1, 0],
			[1, 1],
			[1, 2],
			[2, 2]
		],
		[
			[0, 1],
			[1, 1],
			[2, 1],
			[0, 2]
		],
		[
			[0, 0],
			[1, 0],
			[1, 1],
			[1, 2]
		]
	].map((s) => s.map(([x, y]) => ({
		x,
		y
	})))
};
var TETRO_COLOR = {
	I: 0,
	O: 1,
	T: 2,
	S: 3,
	Z: 4,
	J: 5,
	L: 6
};
var TETRO_ORDER = [
	"I",
	"O",
	"T",
	"S",
	"Z",
	"J",
	"L"
];
var KICK_JLSTZ = {
	"0>1": [
		[0, 0],
		[-1, 0],
		[-1, 1],
		[0, -2],
		[-1, -2]
	],
	"1>0": [
		[0, 0],
		[1, 0],
		[1, -1],
		[0, 2],
		[1, 2]
	],
	"1>2": [
		[0, 0],
		[1, 0],
		[1, -1],
		[0, 2],
		[1, 2]
	],
	"2>1": [
		[0, 0],
		[-1, 0],
		[-1, 1],
		[0, -2],
		[-1, -2]
	],
	"2>3": [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, -2],
		[1, -2]
	],
	"3>2": [
		[0, 0],
		[-1, 0],
		[-1, -1],
		[0, 2],
		[-1, 2]
	],
	"3>0": [
		[0, 0],
		[-1, 0],
		[-1, -1],
		[0, 2],
		[-1, 2]
	],
	"0>3": [
		[0, 0],
		[1, 0],
		[1, 1],
		[0, -2],
		[1, -2]
	]
};
var KICK_I = {
	"0>1": [
		[0, 0],
		[-2, 0],
		[1, 0],
		[-2, -1],
		[1, 2]
	],
	"1>0": [
		[0, 0],
		[2, 0],
		[-1, 0],
		[2, 1],
		[-1, -2]
	],
	"1>2": [
		[0, 0],
		[-1, 0],
		[2, 0],
		[-1, 2],
		[2, -1]
	],
	"2>1": [
		[0, 0],
		[1, 0],
		[-2, 0],
		[1, -2],
		[-2, 1]
	],
	"2>3": [
		[0, 0],
		[2, 0],
		[-1, 0],
		[2, 1],
		[-1, -2]
	],
	"3>2": [
		[0, 0],
		[-2, 0],
		[1, 0],
		[-2, -1],
		[1, 2]
	],
	"3>0": [
		[0, 0],
		[1, 0],
		[-2, 0],
		[1, -2],
		[-2, 1]
	],
	"0>3": [
		[0, 0],
		[-1, 0],
		[2, 0],
		[-1, 2],
		[2, -1]
	]
};
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
	shuffle(a) {
		for (let i = a.length - 1; i > 0; i--) {
			const j = this.int(i + 1);
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}
};
function createWell(cfg) {
	return new Well(cfg);
}
var Well = class {
	cols;
	rows;
	hiddenRows;
	score = 0;
	level = 0;
	lines = 0;
	active = null;
	hold = null;
	gameOver = false;
	cfg;
	grid;
	rng;
	pieces;
	order;
	bag = [];
	nextQueue = [];
	rotation;
	match;
	lockTimer = 0;
	lockResets = 0;
	resting = false;
	lastWasRotate = false;
	lastKick = [0, 0];
	holdUsed = false;
	constructor(cfg) {
		this.cfg = cfg;
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		this.hiddenRows = cfg.hiddenRows ?? 2;
		this.rng = new Rng(cfg.seed ?? 1);
		this.rotation = cfg.rotation ?? "srs";
		this.match = cfg.match ?? "rows";
		this.grid = new Array(cfg.cols * (cfg.rows + this.hiddenRows)).fill(null);
		const built = this.buildPieces(cfg.pieces ?? "tetromino");
		this.pieces = built.defs;
		this.order = built.order;
		if (cfg.viruses) this.placeViruses(cfg.viruses);
		for (let n = 0; n < 5; n++) this.nextQueue.push(this.drawKind());
		this.spawn();
	}
	totalRows() {
		return this.rows + this.hiddenRows;
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	inBounds(x, y) {
		return x >= 0 && y >= 0 && x < this.cols && y < this.totalRows();
	}
	/** Cell at play coordinates (y=0 is the top visible row). */
	cell(x, y) {
		return this.inBounds(x, y + this.hiddenRows) ? this.grid[this.idx(x, y + this.hiddenRows)] : null;
	}
	gcell(x, y) {
		return this.inBounds(x, y) ? this.grid[this.idx(x, y)] : null;
	}
	buildPieces(spec) {
		if (Array.isArray(spec)) return {
			defs: spec,
			order: spec.map((_, i) => String(i))
		};
		if (spec === "columns") {
			const s = [[
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
				}
			]];
			return {
				defs: [{
					states: [
						s[0],
						s[0],
						s[0],
						s[0]
					],
					colors: [
						0,
						1,
						2
					]
				}],
				order: ["col"]
			};
		}
		if (spec === "puyo" || spec === "capsule") return {
			defs: [{
				states: [
					[{
						x: 0,
						y: 0
					}, {
						x: 0,
						y: 1
					}],
					[{
						x: 0,
						y: 0
					}, {
						x: 1,
						y: 0
					}],
					[{
						x: 0,
						y: 1
					}, {
						x: 0,
						y: 0
					}],
					[{
						x: 1,
						y: 0
					}, {
						x: 0,
						y: 0
					}]
				],
				colors: [0, 1]
			}],
			order: ["pair"]
		};
		return {
			defs: TETRO_ORDER.map((k) => ({
				states: TETRO[k],
				colors: [
					TETRO_COLOR[k],
					TETRO_COLOR[k],
					TETRO_COLOR[k],
					TETRO_COLOR[k]
				]
			})),
			order: TETRO_ORDER
		};
	}
	drawKind() {
		if (this.order.length === 1) return this.order[0];
		if (this.bag.length === 0) this.bag = this.rng.shuffle(this.order.slice());
		return this.bag.pop();
	}
	placeViruses(count) {
		const capped = Math.min(count, 84);
		const nColors = this.cfg.colors ?? 3;
		let placed = 0;
		let guard = 0;
		const top = this.hiddenRows + Math.floor(this.totalRows() * .35);
		while (placed < capped && guard++ < capped * 50) {
			const x = this.rng.int(this.cols);
			const y = top + this.rng.int(this.totalRows() - top);
			const i = this.idx(x, y);
			if (this.grid[i]) continue;
			this.grid[i] = {
				color: this.rng.int(nColors),
				virus: true
			};
			placed++;
		}
	}
	pieceColors(kind) {
		const idx = this.order.indexOf(kind);
		const def = this.pieces[Math.max(0, idx)];
		if (def.colors) {
			if (this.order.length === 1) return def.colors.map(() => this.rng.int(this.cfg.colors ?? 3));
			return def.colors;
		}
		return def.states[0].map(() => this.rng.int(this.cfg.colors ?? 6));
	}
	spawn() {
		const kind = this.nextQueue.shift();
		this.nextQueue.push(this.drawKind());
		const idx = Math.max(0, this.order.indexOf(kind));
		const def = this.pieces[idx];
		const colors = this.pieceColors(kind);
		const spawnX = Math.floor((this.cols - 4) / 2) + (this.order.length === 1 ? Math.floor(this.cols / 2) : 0);
		const piece = {
			kind,
			state: 0,
			x: this.order.length === 1 ? Math.floor(this.cols / 2) : spawnX,
			y: 0,
			cells: [],
			colors
		};
		piece.cells = this.absCells(piece, def);
		this.active = piece;
		this.resting = false;
		this.lockTimer = 0;
		this.lockResets = 0;
		this.holdUsed = false;
		if (this.collides(piece.cells)) {
			this.gameOver = true;
			this.active = null;
		}
		piece._def = def;
	}
	absCells(p, def) {
		return def.states[p.state % def.states.length].map((c) => ({
			x: p.x + c.x,
			y: p.y + c.y
		}));
	}
	collides(cells) {
		for (const c of cells) {
			if (c.x < 0 || c.x >= this.cols || c.y >= this.totalRows()) return true;
			if (c.y >= 0 && this.grid[this.idx(c.x, c.y)]) return true;
		}
		return false;
	}
	/** Shift the active piece; returns whether it moved (resets lock delay). */
	shift(dir) {
		if (!this.active) return false;
		const def = this.active._def;
		const moved = {
			...this.active,
			x: this.active.x + dir
		};
		const cells = this.absCells(moved, def);
		if (this.collides(cells)) return false;
		this.active.x += dir;
		this.active.cells = cells;
		this.lastWasRotate = false;
		this.onSuccessfulManeuver();
		return true;
	}
	/** Rotate the active piece with kicks; returns whether it rotated. */
	rotate(dir) {
		if (!this.active) return false;
		if (this.rotation === "none") return false;
		const def = this.active._def;
		if (this.rotation === "cycle") {
			this.active.colors = dir > 0 ? [this.active.colors[this.active.colors.length - 1], ...this.active.colors.slice(0, -1)] : [...this.active.colors.slice(1), this.active.colors[0]];
			this.lastWasRotate = true;
			this.onSuccessfulManeuver();
			return true;
		}
		const from = this.active.state;
		const to = (from + (dir > 0 ? 1 : 3)) % 4;
		const kicks = this.kicksFor(this.active.kind, from, to);
		for (const [kx, ky] of kicks) {
			const cand = {
				...this.active,
				state: to,
				x: this.active.x + kx,
				y: this.active.y - ky
			};
			const cells = this.absCells(cand, def);
			if (!this.collides(cells)) {
				this.active.state = to;
				this.active.x += kx;
				this.active.y -= ky;
				this.active.cells = cells;
				this.lastWasRotate = true;
				this.lastKick = [kx, ky];
				this.onSuccessfulManeuver();
				return true;
			}
		}
		return false;
	}
	kicksFor(kind, from, to) {
		if (this.rotation !== "srs") return [[0, 0]];
		if (kind === "O") return [[0, 0]];
		const key = `${from}>${to}`;
		return (kind === "I" ? KICK_I : KICK_JLSTZ)[key] ?? [[0, 0]];
	}
	onSuccessfulManeuver() {
		if (this.resting && this.lockResets < (this.cfg.lockResetCap ?? 15)) {
			this.lockTimer = 0;
			this.lockResets++;
		}
	}
	/** Soft-drop one row (or hard drop). Returns cells fallen. */
	softDrop() {
		if (!this.active) return false;
		const def = this.active._def;
		const moved = {
			...this.active,
			y: this.active.y + 1
		};
		const cells = this.absCells(moved, def);
		if (this.collides(cells)) return false;
		this.active.y += 1;
		this.active.cells = cells;
		this.lastWasRotate = false;
		this.score += 1;
		return true;
	}
	hardDrop() {
		if (!this.active) return this.emptyTick();
		let n = 0;
		while (this.softDrop()) n++;
		this.score += n;
		return this.lockAndResolve();
	}
	/** Hold the active piece (one swap until next lock). */
	holdPiece() {
		if (!this.active || this.holdUsed) return false;
		const cur = this.active.kind;
		if (this.hold) this.nextQueue.unshift(this.hold);
		this.hold = cur;
		this.spawn();
		this.holdUsed = true;
		return true;
	}
	/** The ghost-piece landing cells (hard-drop projection). */
	ghost() {
		if (!this.active) return [];
		const def = this.active._def;
		let dy = 0;
		while (!this.collides(this.absCells({
			...this.active,
			y: this.active.y + dy + 1
		}, def))) dy++;
		return this.absCells({
			...this.active,
			y: this.active.y + dy
		}, def).map((c) => ({
			x: c.x,
			y: c.y - this.hiddenRows
		}));
	}
	/** One gravity tick: advance the piece, handle lock delay, then resolve on lock. */
	tick() {
		if (this.gameOver || !this.active) return this.emptyTick();
		if (this.softDrop()) {
			this.resting = false;
			return {
				...this.emptyTick(),
				steps: [{
					type: "move",
					dx: 0,
					dy: 1
				}]
			};
		}
		this.resting = true;
		this.lockTimer++;
		if (this.lockTimer < (this.cfg.lockDelayTicks ?? 2)) return this.emptyTick();
		return this.lockAndResolve();
	}
	lockAndResolve() {
		const steps = [];
		const p = this.active;
		const tspin = this.detectTspin();
		const lockCells = [];
		p.cells.forEach((c, i) => {
			if (c.y < 0) return;
			this.grid[this.idx(c.x, c.y)] = { color: p.colors[i] ?? p.colors[0] };
			lockCells.push({
				at: {
					x: c.x,
					y: c.y
				},
				color: p.colors[i] ?? p.colors[0]
			});
		});
		steps.push({
			type: "lock",
			cells: lockCells.map((c) => ({
				at: {
					x: c.at.x,
					y: c.at.y - this.hiddenRows
				},
				color: c.color
			})),
			tspin
		});
		this.active = null;
		let chain = 0;
		let clearedTotal = 0;
		let gained = 0;
		for (let guard = 0; guard < 64; guard++) {
			if (this.cfg.gravity !== "perObject") this.settleCells(steps);
			const groups = this.findMatches();
			if (groups.length === 0) break;
			chain++;
			const cells = [];
			for (const g of groups) for (const c of g.cells) cells.push(c);
			steps.push({
				type: "match",
				groups: groups.map((g) => ({
					cells: g.cells.map((c) => ({
						x: c.x,
						y: c.y - this.hiddenRows
					})),
					color: g.color
				})),
				chain
			});
			const isRows = this.match === "rows";
			for (const c of cells) this.grid[this.idx(c.x, c.y)] = null;
			steps.push({
				type: "clear",
				cells: cells.map((c) => ({
					x: c.x,
					y: c.y - this.hiddenRows
				})),
				lines: isRows ? groups.length : void 0
			});
			clearedTotal += isRows ? groups.length : cells.length;
			gained += this.scoreClear(isRows ? groups.length : cells.length, chain, tspin);
			this.settleCells(steps);
		}
		this.score += gained;
		this.lines += this.match === "rows" ? clearedTotal : 0;
		this.level = Math.floor(this.lines / 10);
		if (!this.gameOver) {
			this.spawn();
			if (this.active) steps.push({
				type: "spawn",
				piece: this.viewPiece(this.active)
			});
		}
		if (this.gameOver) steps.push({ type: "gameOver" });
		return {
			steps,
			cleared: clearedTotal,
			chain,
			gained,
			gameOver: this.gameOver,
			locked: true
		};
	}
	viewPiece(p) {
		return {
			...p,
			y: p.y,
			cells: p.cells.map((c) => ({
				x: c.x,
				y: c.y - this.hiddenRows
			}))
		};
	}
	/** Per-cell gravity: every unsupported cell falls (Columns/Puyo). Returns moves. */
	settleCells(steps) {
		if (this.cfg.gravity === "perObject") return;
		let moved = true;
		const moves = [];
		while (moved) {
			moved = false;
			for (let y = this.totalRows() - 2; y >= 0; y--) for (let x = 0; x < this.cols; x++) {
				const c = this.grid[this.idx(x, y)];
				if (!c || c.virus) continue;
				if (!this.grid[this.idx(x, y + 1)]) {
					this.grid[this.idx(x, y + 1)] = c;
					this.grid[this.idx(x, y)] = null;
					moves.push({
						from: {
							x,
							y: y - this.hiddenRows
						},
						to: {
							x,
							y: y + 1 - this.hiddenRows
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
	}
	findMatches() {
		if (this.match === "rows") {
			const out = [];
			for (let y = 0; y < this.totalRows(); y++) {
				let full = true;
				for (let x = 0; x < this.cols; x++) if (!this.grid[this.idx(x, y)]) {
					full = false;
					break;
				}
				if (full) {
					const cells = [];
					for (let x = 0; x < this.cols; x++) cells.push({
						x,
						y
					});
					out.push({
						cells,
						color: -1
					});
				}
			}
			return out;
		}
		if (typeof this.match === "object" && "flood" in this.match) return this.floodMatches(this.match.flood);
		const need = this.match.lines;
		const dirs = !!this.match.diagonals ? [
			[1, 0],
			[0, 1],
			[1, 1],
			[1, -1]
		] : [[1, 0], [0, 1]];
		const marked = /* @__PURE__ */ new Set();
		const out = [];
		for (let y = 0; y < this.totalRows(); y++) for (let x = 0; x < this.cols; x++) {
			const c = this.grid[this.idx(x, y)];
			if (!c) continue;
			for (const [dx, dy] of dirs) {
				const run = [{
					x,
					y
				}];
				let nx = x + dx;
				let ny = y + dy;
				while (this.inBounds(nx, ny) && this.grid[this.idx(nx, ny)]?.color === c.color) {
					run.push({
						x: nx,
						y: ny
					});
					nx += dx;
					ny += dy;
				}
				if (run.length >= need) for (const p of run) marked.add(this.idx(p.x, p.y));
			}
		}
		if (marked.size) {
			const cells = [...marked].map((i) => ({
				x: i % this.cols,
				y: i / this.cols | 0
			}));
			out.push({
				cells,
				color: -1
			});
		}
		return out;
	}
	floodMatches(need) {
		const seen = /* @__PURE__ */ new Set();
		const out = [];
		for (let y = 0; y < this.totalRows(); y++) for (let x = 0; x < this.cols; x++) {
			const i = this.idx(x, y);
			const c = this.grid[i];
			if (!c || c.virus || seen.has(i)) continue;
			const group = [];
			const stack = [{
				x,
				y
			}];
			const local = /* @__PURE__ */ new Set([i]);
			while (stack.length) {
				const p = stack.pop();
				group.push(p);
				for (const [dx, dy] of [
					[1, 0],
					[-1, 0],
					[0, 1],
					[0, -1]
				]) {
					const nx = p.x + dx;
					const ny = p.y + dy;
					if (!this.inBounds(nx, ny)) continue;
					const j = this.idx(nx, ny);
					if (local.has(j)) continue;
					const nc = this.grid[j];
					if (nc && !nc.virus && nc.color === c.color) {
						local.add(j);
						stack.push({
							x: nx,
							y: ny
						});
					}
				}
			}
			for (const j of local) seen.add(j);
			if (group.length >= need) out.push({
				cells: group,
				color: c.color
			});
		}
		return out;
	}
	detectTspin() {
		const p = this.active;
		if (!p || p.kind !== "T" || !this.lastWasRotate) return "none";
		const cx = p.x + 1;
		const cy = p.y + 1;
		const occ = [
			[cx - 1, cy - 1],
			[cx + 1, cy - 1],
			[cx - 1, cy + 1],
			[cx + 1, cy + 1]
		].map(([x, y]) => x < 0 || x >= this.cols || y >= this.totalRows() || y >= 0 && !!this.grid[this.idx(x, y)]);
		if (occ.filter(Boolean).length < 3) return "none";
		if (Math.abs(this.lastKick[0]) === 1 && Math.abs(this.lastKick[1]) === 2) return "full";
		return ({
			0: [0, 1],
			1: [1, 3],
			2: [2, 3],
			3: [0, 2]
		}[p.state] ?? [0, 1]).filter((i) => occ[i]).length === 2 ? "full" : "mini";
	}
	scoreClear(n, chain, tspin) {
		const lvl = this.level + 1;
		if (this.match === "rows") return (tspin === "full" ? [
			0,
			800,
			1200,
			1600
		][n] ?? 1600 : tspin === "mini" ? [0, 200][n] ?? 200 : [
			0,
			100,
			300,
			500,
			800
		][n] ?? 800) * lvl;
		const chainPower = [
			0,
			8,
			16,
			32,
			64,
			96,
			128,
			160,
			192,
			224
		][Math.min(chain, 9)] || chain * 32;
		return n * 10 * Math.max(1, chainPower) / 4;
	}
	emptyTick() {
		return {
			steps: [],
			cleared: 0,
			chain: 0,
			gained: 0,
			gameOver: this.gameOver,
			locked: false
		};
	}
	/** Remaining viruses (Dr. Mario win = 0). */
	get virusCount() {
		let n = 0;
		for (const c of this.grid) if (c?.virus) n++;
		return n;
	}
	/** The upcoming pieces. */
	next() {
		return this.nextQueue.slice();
	}
	/** Every reachable final placement (x, rotation), scored — the AI/autoplay surface. */
	findPlacements() {
		if (!this.active) return [];
		const def = this.active._def;
		const out = [];
		const states = this.rotation === "srs" ? 4 : 1;
		for (let s = 0; s < states; s++) for (let x = -2; x < this.cols; x++) {
			const test = {
				...this.active,
				state: s,
				x,
				y: this.active.y
			};
			let cells = this.absCells(test, def);
			if (this.collides(cells)) continue;
			let dy = 0;
			while (!this.collides(this.absCells({
				...test,
				y: test.y + dy + 1
			}, def))) dy++;
			cells = this.absCells({
				...test,
				y: test.y + dy
			}, def);
			const landingY = Math.max(...cells.map((c) => c.y));
			out.push({
				x,
				state: s,
				score: landingY
			});
		}
		return out.sort((a, b) => b.score - a.score);
	}
	/** Drive the active piece to a chosen placement and hard-drop it. */
	place(x, state) {
		if (!this.active) return this.emptyTick();
		if (this.rotation === "srs") while (this.active.state !== state && this.rotate(1));
		while (this.active.x < x && this.shift(1));
		while (this.active.x > x && this.shift(-1));
		return this.hardDrop();
	}
	/** Auto-play by a simple flat-stacking policy until game over. */
	autoplay(maxPieces = 500) {
		const results = [];
		for (let n = 0; n < maxPieces && !this.gameOver; n++) {
			const best = this.findPlacements()[0];
			if (!best) break;
			results.push(this.place(best.x, best.state));
		}
		return results;
	}
	debugGrid() {
		const rows = [];
		for (let y = this.hiddenRows; y < this.totalRows(); y++) {
			let r = "";
			for (let x = 0; x < this.cols; x++) {
				const c = this.grid[this.idx(x, y)];
				r += c ? c.virus ? "v" : String(c.color % 10) : ".";
			}
			rows.push(r);
		}
		return rows.join("\n");
	}
};
//#endregion
export { Well, createWell };

//# sourceMappingURL=faller.js.map
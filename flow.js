//#region src/packs/flow.ts
var UP = 1;
var RIGHT = 2;
var DOWN = 4;
var LEFT = 8;
var OPP = {
	[1]: 4,
	[2]: 8,
	[4]: 1,
	[8]: 2
};
var DIRS = [
	[
		1,
		0,
		-1
	],
	[
		2,
		1,
		0
	],
	[
		4,
		0,
		1
	],
	[
		8,
		-1,
		0
	]
];
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
function rotateMask(mask, steps) {
	let m = mask & 15;
	const s = (steps % 4 + 4) % 4;
	for (let n = 0; n < s; n++) m = (m << 1 | m >> 3) & 15;
	return m;
}
function createFlowGrid(cfg) {
	return new FlowGrid(cfg);
}
var FlowGrid = class {
	cols;
	rows;
	wrap;
	tiles;
	server = null;
	rng;
	queue = [];
	flowHead = null;
	filled;
	filledDist = 0;
	solvedMask = null;
	constructor(cfg) {
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		this.wrap = cfg.wrap ?? false;
		this.rng = new Rng(cfg.seed ?? 1);
		this.tiles = new Array(cfg.cols * cfg.rows).fill(null).map(() => ({
			mask: 0,
			kind: "normal"
		}));
		this.filled = new Array(cfg.cols * cfg.rows).fill(false);
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	inBounds(x, y) {
		return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
	}
	neighbour(x, y, dx, dy) {
		let nx = x + dx;
		let ny = y + dy;
		if (this.wrap) {
			nx = (nx % this.cols + this.cols) % this.cols;
			ny = (ny % this.rows + this.rows) % this.rows;
		}
		return this.inBounds(nx, ny) ? {
			x: nx,
			y: ny
		} : null;
	}
	tile(x, y) {
		return this.tiles[this.idx(x, y)];
	}
	setTile(x, y, t) {
		this.tiles[this.idx(x, y)] = { ...t };
	}
	get serverPos() {
		return this.server;
	}
	/** Rotate a tile (Netwalk). +1 = clockwise. Ignored if locked. */
	rotate(x, y, steps = 1) {
		const t = this.tiles[this.idx(x, y)];
		if (t.locked) return;
		t.mask = rotateMask(t.mask, steps);
	}
	/** Toggle a tile's lock (misclick guard). */
	lock(x, y, on) {
		this.tiles[this.idx(x, y)].locked = on;
	}
	/** Cells connected to the server via mutually-matching stubs (the lit network). */
	connectivity() {
		const lit = new Array(this.cols * this.rows).fill(false);
		if (!this.server) return {
			lit,
			litCount: 0
		};
		const start = this.idx(this.server.x, this.server.y);
		lit[start] = true;
		const stack = [this.server];
		let count = 1;
		while (stack.length) {
			const p = stack.pop();
			const t = this.tiles[this.idx(p.x, p.y)];
			for (const [bit, dx, dy] of DIRS) {
				if (!(t.mask & bit)) continue;
				const nb = this.neighbour(p.x, p.y, dx, dy);
				if (!nb) continue;
				if (!(this.tiles[this.idx(nb.x, nb.y)].mask & OPP[bit])) continue;
				const ni = this.idx(nb.x, nb.y);
				if (!lit[ni]) {
					lit[ni] = true;
					count++;
					stack.push(nb);
				}
			}
		}
		return {
			lit,
			litCount: count
		};
	}
	/** Solved (Netwalk) when every tile with any stub is lit and no dangling stubs
	* point at walls or unmatched neighbours. */
	get solved() {
		const { lit } = this.connectivity();
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
			const t = this.tiles[this.idx(x, y)];
			if (t.mask === 0) continue;
			if (!lit[this.idx(x, y)]) return false;
			for (const [bit, dx, dy] of DIRS) {
				if (!(t.mask & bit)) continue;
				const nb = this.neighbour(x, y, dx, dy);
				if (!nb) return false;
				if (!(this.tiles[this.idx(nb.x, nb.y)].mask & OPP[bit])) return false;
			}
		}
		return true;
	}
	/** Generate a solvable Netwalk: carve a random spanning tree from the server,
	* set edge masks, then scramble rotations. Always solvable. */
	generateNet() {
		const n = this.cols * this.rows;
		this.tiles = new Array(n).fill(null).map(() => ({
			mask: 0,
			kind: "normal"
		}));
		this.server = {
			x: this.rng.int(this.cols),
			y: this.rng.int(this.rows)
		};
		this.tiles[this.idx(this.server.x, this.server.y)].kind = "source";
		const visited = new Array(n).fill(false);
		const startI = this.idx(this.server.x, this.server.y);
		visited[startI] = true;
		const stack = [this.server];
		while (stack.length) {
			const p = stack[stack.length - 1];
			const options = [];
			for (const [bit, dx, dy] of DIRS) {
				const nb = this.neighbour(p.x, p.y, dx, dy);
				if (nb && !visited[this.idx(nb.x, nb.y)]) options.push([
					bit,
					dx,
					dy,
					nb
				]);
			}
			if (options.length === 0) {
				stack.pop();
				continue;
			}
			const [bit, , , nb] = options[this.rng.int(options.length)];
			this.tiles[this.idx(p.x, p.y)].mask |= bit;
			this.tiles[this.idx(nb.x, nb.y)].mask |= OPP[bit];
			visited[this.idx(nb.x, nb.y)] = true;
			stack.push(nb);
		}
		this.solvedMask = this.tiles.map((t) => t.mask);
		for (let i = 0; i < n; i++) this.tiles[i].mask = rotateMask(this.tiles[i].mask, this.rng.int(4));
	}
	/** Rotation steps per cell that solve the generated Netwalk (autoplay/hints).
	* Uses the solved orientation recorded at generation time. Null if not generated. */
	solveNet() {
		if (!this.solvedMask) return null;
		const out = [];
		for (let y = 0; y < this.rows; y++) {
			out.push([]);
			for (let x = 0; x < this.cols; x++) {
				const i = this.idx(x, y);
				const cur = this.tiles[i].mask;
				const target = this.solvedMask[i];
				let steps = 0;
				while (steps < 4 && rotateMask(cur, steps) !== target) steps++;
				out[y].push(steps % 4);
			}
		}
		return out;
	}
	/** Seed a Pipe Mania game: a forced queue of pipe masks and a start tile. */
	startPipes(queue, start, fromDir) {
		this.queue = queue.slice();
		this.tiles = new Array(this.cols * this.rows).fill(null).map(() => ({
			mask: 0,
			kind: "normal"
		}));
		this.filled = new Array(this.cols * this.rows).fill(false);
		this.tiles[this.idx(start.x, start.y)] = {
			mask: fromDir,
			kind: "source"
		};
		this.flowHead = {
			at: start,
			from: OPP[fromDir]
		};
		this.filledDist = 0;
	}
	/** Place the next queued pipe at an empty cell. Returns false if occupied/filled. */
	placePipe(x, y) {
		const i = this.idx(x, y);
		if (this.filled[i] || this.tiles[i].mask !== 0 || this.tiles[i].kind === "source") return false;
		const mask = this.queue.shift();
		if (mask === void 0) return false;
		this.tiles[i] = {
			mask,
			kind: "normal"
		};
		this.queue.push(0);
		return true;
	}
	/** Advance the fluid one pipe segment. Returns the outcome. */
	advanceFlow() {
		if (!this.flowHead) return {
			entered: null,
			spilled: false,
			dist: this.filledDist
		};
		const { at, from } = this.flowHead;
		const t = this.tiles[this.idx(at.x, at.y)];
		this.filled[this.idx(at.x, at.y)] = true;
		this.filledDist++;
		if (!(t.mask & from) && t.kind !== "source") return {
			entered: at,
			spilled: true,
			dist: this.filledDist
		};
		let exitBit = 0;
		for (const [bit] of DIRS) if (t.mask & bit && bit !== from) {
			exitBit = bit;
			break;
		}
		if (exitBit === 0) return {
			entered: at,
			spilled: true,
			dist: this.filledDist
		};
		const dir = DIRS.find(([b]) => b === exitBit);
		const nb = this.neighbour(at.x, at.y, dir[1], dir[2]);
		if (!nb) return {
			entered: at,
			spilled: true,
			dist: this.filledDist
		};
		const nt = this.tiles[this.idx(nb.x, nb.y)];
		if (nt.mask === 0 || !(nt.mask & OPP[exitBit])) return {
			entered: nb,
			spilled: true,
			dist: this.filledDist
		};
		this.flowHead = {
			at: nb,
			from: OPP[exitBit]
		};
		return {
			entered: nb,
			spilled: false,
			dist: this.filledDist
		};
	}
	isFilled(x, y) {
		return this.filled[this.idx(x, y)];
	}
	debugMasks() {
		const rows = [];
		for (let y = 0; y < this.rows; y++) {
			let r = "";
			for (let x = 0; x < this.cols; x++) r += this.tiles[this.idx(x, y)].mask.toString(16);
			rows.push(r);
		}
		return rows.join("\n");
	}
};
//#endregion
export { DOWN, FlowGrid, LEFT, RIGHT, UP, createFlowGrid };

//# sourceMappingURL=flow.js.map
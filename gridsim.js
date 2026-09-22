//#region src/packs/gridsim.ts
var DELTA = {
	up: {
		x: 0,
		y: -1
	},
	down: {
		x: 0,
		y: 1
	},
	left: {
		x: -1,
		y: 0
	},
	right: {
		x: 1,
		y: 0
	}
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
	float() {
		return this.next() / 4294967296;
	}
};
/** The Boulder Dash legend. */
var BOULDERDASH_LEGEND = {
	"#": {
		id: "wall",
		solid: true
	},
	":": {
		id: "dirt",
		consumable: true
	},
	" ": { id: "empty" },
	"r": {
		id: "boulder",
		rounded: true,
		falls: true
	},
	"d": {
		id: "diamond",
		rounded: true,
		falls: true,
		consumable: true,
		collectible: true
	},
	"f": {
		id: "firefly",
		enemy: "left"
	},
	"b": {
		id: "butterfly",
		enemy: "right",
		explodesToDiamonds: true
	},
	"X": {
		id: "exit",
		solid: true
	},
	"@": {
		id: "player",
		player: true
	}
};
function createGridSim(cfg) {
	return new GridSim(cfg);
}
var GridSim = class {
	cols;
	rows;
	quota;
	collected = 0;
	dead = false;
	exited = false;
	tickCount = 0;
	player = {
		x: 0,
		y: 0
	};
	legend;
	terrain;
	ents;
	rng;
	pendingInput = null;
	exitOpen = false;
	exitPos = null;
	constructor(cfg) {
		this.legend = cfg.legend ?? BOULDERDASH_LEGEND;
		const rows = cfg.level;
		this.rows = rows.length;
		this.cols = Math.max(...rows.map((r) => r.length));
		this.rng = new Rng(cfg.seed ?? 1);
		const n = this.cols * this.rows;
		this.terrain = new Array(n).fill("empty");
		this.ents = new Array(n).fill(null);
		let diamonds = 0;
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
			const ch = rows[y][x] ?? " ";
			const k = this.legend[ch];
			if (!k) continue;
			const i = this.idx(x, y);
			if (k.player) {
				this.player = {
					x,
					y
				};
				this.terrain[i] = "empty";
			} else if (k.solid && k.id === "exit") {
				this.terrain[i] = "exit";
				this.exitPos = {
					x,
					y
				};
			} else if (k.solid || k.consumable && !k.falls) this.terrain[i] = k.id;
			else if (k.id === "empty") this.terrain[i] = "empty";
			else {
				this.ents[i] = {
					kind: k.id,
					dir: "up"
				};
				if (k.collectible) diamonds++;
			}
		}
		this.quota = cfg.quota ?? diamonds;
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	inBounds(x, y) {
		return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
	}
	terrainAt(x, y) {
		return this.inBounds(x, y) ? this.terrain[this.idx(x, y)] : "wall";
	}
	entityAt(x, y) {
		return this.inBounds(x, y) ? this.ents[this.idx(x, y)] : null;
	}
	kindOf(id) {
		return Object.values(this.legend).find((k) => k.id === id) ?? { id };
	}
	get exitReady() {
		return this.exitOpen;
	}
	/** Queue a player move for the next tick. */
	input(dir) {
		this.pendingInput = dir;
	}
	isEmptyFor(x, y, kind) {
		if (!this.inBounds(x, y)) return false;
		const t = this.terrain[this.idx(x, y)];
		if (t === "wall") return false;
		if (t === "exit") return kind?.player === true && this.exitOpen;
		if (t !== "empty" && !kind?.consumable) {
			if (t === "dirt" && kind?.player) {} else if (t !== "empty") return false;
		}
		return this.ents[this.idx(x, y)] === null;
	}
	/** One deterministic scan (top-left → bottom-right). One tick = one beat. */
	tick() {
		this.tickCount++;
		const moves = [];
		const explosions = [];
		if (this.pendingInput && !this.dead && !this.exited) {
			this.movePlayer(this.pendingInput, moves, explosions);
			this.pendingInput = null;
		}
		for (let y = this.rows - 1; y >= 0; y--) for (let x = 0; x < this.cols; x++) {
			const i = this.idx(x, y);
			const e = this.ents[i];
			if (!e || e.scanned === this.tickCount) continue;
			const kind = this.kindOf(e.kind);
			if (kind.falls) this.updateFaller(x, y, e, kind, moves, explosions);
			else if (kind.enemy) this.updateEnemy(x, y, e, kind, moves, explosions);
		}
		if (this.collected >= this.quota) this.exitOpen = true;
		return {
			moves,
			explosions,
			collected: this.collected,
			dead: this.dead,
			exited: this.exited,
			tick: this.tickCount
		};
	}
	movePlayer(dir, moves, explosions) {
		const d = DELTA[dir];
		const nx = this.player.x + d.x;
		const ny = this.player.y + d.y;
		if (!this.inBounds(nx, ny)) return;
		const ni = this.idx(nx, ny);
		const t = this.terrain[ni];
		const e = this.ents[ni];
		if (t === "wall") return;
		if (t === "exit") {
			if (this.exitOpen) {
				this.exited = true;
				this.player = {
					x: nx,
					y: ny
				};
			}
			return;
		}
		if (e) {
			const ek = this.kindOf(e.kind);
			if (ek.collectible) {
				this.ents[ni] = null;
				this.collected++;
			} else if (ek.id === "boulder" && (dir === "left" || dir === "right")) {
				const bx = nx + d.x;
				const by = ny + d.y;
				if (this.isEmptyFor(bx, by) && this.rng.float() < .3) {
					this.ents[this.idx(bx, by)] = e;
					this.ents[ni] = null;
				} else return;
			} else if (ek.enemy) {
				this.dead = true;
				explosions.push({
					x: this.player.x,
					y: this.player.y
				});
				return;
			} else return;
		}
		if (t === "dirt") this.terrain[ni] = "empty";
		moves.push({
			from: { ...this.player },
			to: {
				x: nx,
				y: ny
			},
			kind: "player"
		});
		this.player = {
			x: nx,
			y: ny
		};
	}
	updateFaller(x, y, e, kind, moves, explosions) {
		const below = {
			x,
			y: y + 1
		};
		if (this.canFallInto(below.x, below.y)) {
			this.moveEnt(x, y, below.x, below.y, e, moves);
			e.falling = true;
			if (this.player.x === below.x && this.player.y === below.y + 1 && e.falling) {}
			this.checkCrush(below.x, below.y, e, explosions);
			return;
		}
		const restKind = this.terrainKindAt(x, y + 1);
		const restEnt = this.ents[this.idx(x, y + 1)];
		if (restEnt && this.kindOf(restEnt.kind).rounded || restKind?.rounded) {
			for (const dx of [-1, 1]) if (this.canFallInto(x + dx, y) && this.canFallInto(x + dx, y + 1)) {
				this.moveEnt(x, y, x + dx, y, e, moves);
				e.falling = true;
				return;
			}
		}
		e.falling = false;
	}
	checkCrush(x, y, e, explosions) {
		if (this.player.x === x && this.player.y === y + 1) {
			this.dead = true;
			explosions.push({ ...this.player });
		}
	}
	terrainKindAt(x, y) {
		if (!this.inBounds(x, y)) return {
			id: "wall",
			solid: true
		};
		const t = this.terrain[this.idx(x, y)];
		return t === "empty" ? null : this.kindOf(t);
	}
	canFallInto(x, y) {
		if (!this.inBounds(x, y)) return false;
		return this.terrain[this.idx(x, y)] === "empty" && this.ents[this.idx(x, y)] === null;
	}
	moveEnt(fx, fy, tx, ty, e, moves) {
		this.ents[this.idx(tx, ty)] = e;
		this.ents[this.idx(fx, fy)] = null;
		e.scanned = this.tickCount;
		moves.push({
			from: {
				x: fx,
				y: fy
			},
			to: {
				x: tx,
				y: ty
			},
			kind: e.kind
		});
	}
	updateEnemy(x, y, e, kind, moves, explosions) {
		const order = kind.enemy === "left" ? [
			turn(e.dir, "left"),
			e.dir,
			turn(e.dir, "right"),
			turn(e.dir, "back")
		] : [
			turn(e.dir, "right"),
			e.dir,
			turn(e.dir, "left"),
			turn(e.dir, "back")
		];
		for (const dir of [
			"up",
			"down",
			"left",
			"right"
		]) {
			const d = DELTA[dir];
			if (this.player.x === x + d.x && this.player.y === y + d.y) {
				this.explode(x, y, kind, explosions);
				return;
			}
		}
		for (const dir of order) {
			const d = DELTA[dir];
			const nx = x + d.x;
			const ny = y + d.y;
			if (this.canFallInto(nx, ny)) {
				e.dir = dir;
				this.moveEnt(x, y, nx, ny, e, moves);
				return;
			}
		}
	}
	explode(x, y, kind, explosions) {
		const toDiamonds = !!kind.explodesToDiamonds;
		for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
			const nx = x + dx;
			const ny = y + dy;
			if (!this.inBounds(nx, ny)) continue;
			const i = this.idx(nx, ny);
			if (this.terrain[i] === "wall" || this.terrain[i] === "exit") continue;
			this.terrain[i] = "empty";
			if (this.player.x === nx && this.player.y === ny) this.dead = true;
			this.ents[i] = toDiamonds ? { kind: "diamond" } : null;
			explosions.push({
				x: nx,
				y: ny
			});
		}
	}
	/** A greedy demo pilot: walk toward the nearest diamond, dig through dirt. */
	autoInput() {
		if (this.dead || this.exited) return null;
		const target = this.exitOpen && this.exitPos ? this.exitPos : this.nearestDiamond();
		if (!target) return null;
		const path = this.bfsTo(target);
		return path && path.length ? path[0] : null;
	}
	nearestDiamond() {
		let best = null;
		let bestD = Infinity;
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
			const e = this.ents[this.idx(x, y)];
			if (e && this.kindOf(e.kind).collectible) {
				const dd = Math.abs(x - this.player.x) + Math.abs(y - this.player.y);
				if (dd < bestD) {
					bestD = dd;
					best = {
						x,
						y
					};
				}
			}
		}
		return best;
	}
	bfsTo(target) {
		const start = this.player;
		const prev = /* @__PURE__ */ new Map();
		const seen = /* @__PURE__ */ new Set([this.idx(start.x, start.y)]);
		const queue = [start];
		while (queue.length) {
			const p = queue.shift();
			if (p.x === target.x && p.y === target.y) {
				const path = [];
				let cur = this.idx(p.x, p.y);
				while (prev.has(cur)) {
					const { p: pp, dir } = prev.get(cur);
					path.unshift(dir);
					cur = pp;
				}
				return path;
			}
			for (const dir of [
				"up",
				"down",
				"left",
				"right"
			]) {
				const d = DELTA[dir];
				const nx = p.x + d.x;
				const ny = p.y + d.y;
				if (!this.inBounds(nx, ny)) continue;
				const i = this.idx(nx, ny);
				if (seen.has(i)) continue;
				if (this.terrain[i] === "wall") continue;
				const e = this.ents[i];
				if (e && !this.kindOf(e.kind).collectible) continue;
				seen.add(i);
				prev.set(i, {
					p: this.idx(p.x, p.y),
					dir
				});
				queue.push({
					x: nx,
					y: ny
				});
			}
		}
		return null;
	}
	debugGrid() {
		const rows = [];
		for (let y = 0; y < this.rows; y++) {
			let r = "";
			for (let x = 0; x < this.cols; x++) {
				const i = this.idx(x, y);
				if (this.player.x === x && this.player.y === y) {
					r += "@";
					continue;
				}
				const e = this.ents[i];
				if (e) {
					r += e.kind[0];
					continue;
				}
				const t = this.terrain[i];
				r += t === "wall" ? "#" : t === "dirt" ? ":" : t === "exit" ? "X" : " ";
			}
			rows.push(r);
		}
		return rows.join("\n");
	}
};
function createSnake(cfg) {
	return new Snake(cfg);
}
var Snake = class {
	cols;
	rows;
	body;
	food;
	dead = false;
	score = 0;
	dir = "right";
	queued = [];
	grow = 0;
	wrap;
	rng;
	constructor(cfg) {
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		this.wrap = cfg.wrap ?? false;
		this.rng = new Rng(cfg.seed ?? 1);
		const s = cfg.start ?? {
			x: cfg.cols / 2 | 0,
			y: cfg.rows / 2 | 0
		};
		this.body = [
			s,
			{
				x: s.x - 1,
				y: s.y
			},
			{
				x: s.x - 2,
				y: s.y
			}
		];
		this.food = this.spawnFood();
	}
	spawnFood() {
		const occ = new Set(this.body.map((b) => b.y * this.cols + b.x));
		const free = [];
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) if (!occ.has(y * this.cols + x)) free.push({
			x,
			y
		});
		return free.length ? free[this.rng.int(free.length)] : {
			x: 0,
			y: 0
		};
	}
	/** Queue a direction (buffer up to 2; reject 180° reversals of the LAST-USED dir). */
	input(dir) {
		if (this.queued.length >= 2) return;
		if (opposite(this.queued.length ? this.queued[this.queued.length - 1] : this.dir) === dir) return;
		this.queued.push(dir);
	}
	/** One movement tick. */
	step() {
		if (this.dead) return {
			moved: false,
			ate: false,
			dead: true
		};
		if (this.queued.length) this.dir = this.queued.shift();
		const d = DELTA[this.dir];
		let hx = this.body[0].x + d.x;
		let hy = this.body[0].y + d.y;
		if (this.wrap) {
			hx = (hx % this.cols + this.cols) % this.cols;
			hy = (hy % this.rows + this.rows) % this.rows;
		}
		if (hx < 0 || hy < 0 || hx >= this.cols || hy >= this.rows) {
			this.dead = true;
			return {
				moved: false,
				ate: false,
				dead: true
			};
		}
		if ((this.grow > 0 ? this.body : this.body.slice(0, this.body.length - 1)).some((b) => b.x === hx && b.y === hy)) {
			this.dead = true;
			return {
				moved: false,
				ate: false,
				dead: true
			};
		}
		this.body.unshift({
			x: hx,
			y: hy
		});
		let ate = false;
		if (hx === this.food.x && hy === this.food.y) {
			this.grow += 1;
			this.score += 10;
			ate = true;
			this.food = this.spawnFood();
		}
		if (this.grow > 0) this.grow--;
		else this.body.pop();
		return {
			moved: true,
			ate,
			dead: false
		};
	}
	/** A greedy demo pilot: head toward the food, avoiding immediate self-collision. */
	autoInput() {
		const head = this.body[0];
		const wantX = Math.sign(this.food.x - head.x);
		const wantY = Math.sign(this.food.y - head.y);
		const prefer = [];
		if (wantX > 0) prefer.push("right");
		if (wantX < 0) prefer.push("left");
		if (wantY > 0) prefer.push("down");
		if (wantY < 0) prefer.push("up");
		const all = [
			...prefer,
			"up",
			"down",
			"left",
			"right"
		];
		for (const dir of all) {
			if (opposite(this.dir) === dir) continue;
			const d = DELTA[dir];
			let nx = head.x + d.x;
			let ny = head.y + d.y;
			if (this.wrap) {
				nx = (nx % this.cols + this.cols) % this.cols;
				ny = (ny % this.rows + this.rows) % this.rows;
			}
			if (nx < 0 || ny < 0 || nx >= this.cols || ny >= this.rows) continue;
			if (this.body.slice(0, -1).some((b) => b.x === nx && b.y === ny)) continue;
			this.input(dir);
			return;
		}
	}
};
function turn(dir, t) {
	const cw = [
		"up",
		"right",
		"down",
		"left"
	];
	const i = cw.indexOf(dir);
	if (t === "left") return cw[(i + 3) % 4];
	if (t === "right") return cw[(i + 1) % 4];
	return cw[(i + 2) % 4];
}
function opposite(dir) {
	return turn(dir, "back");
}
//#endregion
export { BOULDERDASH_LEGEND, GridSim, Snake, createGridSim, createSnake };

//# sourceMappingURL=gridsim.js.map
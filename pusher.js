//#region src/packs/pusher.ts
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
function createPusher(cfg) {
	return new Pusher(cfg);
}
var Pusher = class {
	cols;
	rows;
	moves = 0;
	pushes = 0;
	wall;
	goal;
	box;
	player;
	dead;
	history = [];
	future = [];
	constructor(cfg) {
		const rows = cfg.level;
		this.rows = rows.length;
		this.cols = Math.max(...rows.map((r) => r.length));
		const n = this.cols * this.rows;
		this.wall = new Array(n).fill(false);
		this.goal = new Array(n).fill(false);
		this.box = new Array(n).fill(false);
		this.player = {
			x: 0,
			y: 0
		};
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
			const ch = rows[y][x] ?? " ";
			const i = this.idx(x, y);
			if (ch === "#") this.wall[i] = true;
			if (ch === "." || ch === "*" || ch === "+") this.goal[i] = true;
			if (ch === "$" || ch === "*") this.box[i] = true;
			if (ch === "@" || ch === "+") this.player = {
				x,
				y
			};
		}
		this.dead = this.computeDeadSquares();
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	inBounds(x, y) {
		return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
	}
	isWall(x, y) {
		return this.inBounds(x, y) ? this.wall[this.idx(x, y)] : true;
	}
	isGoal(x, y) {
		return this.inBounds(x, y) && this.goal[this.idx(x, y)];
	}
	isBox(x, y) {
		return this.inBounds(x, y) && this.box[this.idx(x, y)];
	}
	isDead(x, y) {
		return this.inBounds(x, y) && this.dead[this.idx(x, y)];
	}
	get playerPos() {
		return { ...this.player };
	}
	get metrics() {
		return {
			moves: this.moves,
			pushes: this.pushes
		};
	}
	/** Solved when every box sits on a goal. */
	get solved() {
		for (let i = 0; i < this.box.length; i++) if (this.box[i] && !this.goal[i]) return false;
		for (let i = 0; i < this.goal.length; i++) if (this.goal[i] && !this.box[i]) return false;
		return true;
	}
	/** Move the player in `dir`, pushing a single box if one is ahead. */
	move(dir) {
		const d = DELTA[dir];
		const nx = this.player.x + d.x;
		const ny = this.player.y + d.y;
		if (this.isWall(nx, ny)) return {
			moved: false,
			pushed: null,
			ontoDeadSquare: false,
			solved: this.solved
		};
		let pushed = null;
		let ontoDead = false;
		if (this.isBox(nx, ny)) {
			const bx = nx + d.x;
			const by = ny + d.y;
			if (this.isWall(bx, by) || this.isBox(bx, by)) return {
				moved: false,
				pushed: null,
				ontoDeadSquare: false,
				solved: this.solved
			};
			this.box[this.idx(nx, ny)] = false;
			this.box[this.idx(bx, by)] = true;
			pushed = {
				from: {
					x: nx,
					y: ny
				},
				to: {
					x: bx,
					y: by
				}
			};
			ontoDead = this.dead[this.idx(bx, by)] && !this.goal[this.idx(bx, by)];
			this.pushes++;
		}
		const from = { ...this.player };
		this.player = {
			x: nx,
			y: ny
		};
		this.moves++;
		const delta = {
			dir,
			from,
			pushed
		};
		this.history.push({ move: delta });
		this.future = [];
		return {
			moved: true,
			pushed,
			ontoDeadSquare: ontoDead,
			solved: this.solved
		};
	}
	/** Undo the last move (pulling a pushed box back). */
	undo() {
		const last = this.history.pop();
		if (!last) return false;
		const { dir, from, pushed } = last.move;
		DELTA[dir];
		if (pushed) {
			this.box[this.idx(pushed.to.x, pushed.to.y)] = false;
			this.box[this.idx(pushed.from.x, pushed.from.y)] = true;
			this.pushes--;
		}
		this.player = { ...from };
		this.moves--;
		this.future.push(last);
		return true;
	}
	/** Redo an undone move. */
	redo() {
		const next = this.future.pop();
		if (!next) return false;
		this.history.push(next);
		const { dir, pushed } = next.move;
		const d = DELTA[dir];
		if (pushed) {
			this.box[this.idx(pushed.from.x, pushed.from.y)] = false;
			this.box[this.idx(pushed.to.x, pushed.to.y)] = true;
			this.pushes++;
		}
		this.player = {
			x: this.player.x + d.x,
			y: this.player.y + d.y
		};
		this.moves++;
		return true;
	}
	/** Dead squares: cells from which no box can ever reach a goal. Precomputed by
	* reverse-pulling boxes from every goal; anything unreached is dead. */
	computeDeadSquares() {
		const n = this.cols * this.rows;
		const live = new Array(n).fill(false);
		const queue = [];
		for (let i = 0; i < n; i++) if (this.goal[i]) {
			live[i] = true;
			queue.push({
				x: i % this.cols,
				y: i / this.cols | 0
			});
		}
		while (queue.length) {
			const c = queue.shift();
			for (const dir of [
				"up",
				"down",
				"left",
				"right"
			]) {
				const d = DELTA[dir];
				const bx = c.x - d.x;
				const by = c.y - d.y;
				const px = c.x - 2 * d.x;
				const py = c.y - 2 * d.y;
				if (!this.inBounds(bx, by) || this.wall[this.idx(bx, by)]) continue;
				if (!this.inBounds(px, py) || this.wall[this.idx(px, py)]) continue;
				const bi = this.idx(bx, by);
				if (!live[bi]) {
					live[bi] = true;
					queue.push({
						x: bx,
						y: by
					});
				}
			}
		}
		const dead = new Array(n).fill(false);
		for (let i = 0; i < n; i++) if (!this.wall[i] && !live[i]) dead[i] = true;
		return dead;
	}
	/** Is the box at (x,y) frozen (immovable on both axes and not on a goal)? */
	isFrozen(x, y) {
		if (!this.isBox(x, y)) return false;
		return this.frozenAxis(x, y, "h", /* @__PURE__ */ new Set()) && this.frozenAxis(x, y, "v", /* @__PURE__ */ new Set());
	}
	frozenAxis(x, y, axis, visiting) {
		const i = this.idx(x, y);
		if (visiting.has(i)) return true;
		visiting.add(i);
		const [a, b] = axis === "h" ? [DELTA.left, DELTA.right] : [DELTA.up, DELTA.down];
		const blocked = (d) => {
			const nx = x + d.x;
			const ny = y + d.y;
			if (this.isWall(nx, ny)) return true;
			if (this.dead[this.idx(nx, ny)] && !this.goal[this.idx(nx, ny)]) {}
			if (this.isBox(nx, ny)) return this.frozenAxis(nx, ny, axis === "h" ? "v" : "h", visiting);
			return false;
		};
		return blocked(a) || blocked(b);
	}
	/** Optional BFS solver for small levels (hints). Returns a move sequence or null. */
	solve(maxNodes = 2e5) {
		const start = this.snapshot();
		const startKey = this.key(start);
		if (this.solvedFrom(start)) return [];
		const seen = /* @__PURE__ */ new Set([startKey]);
		const queue = [{
			snap: start,
			path: []
		}];
		let nodes = 0;
		while (queue.length && nodes++ < maxNodes) {
			const { snap, path } = queue.shift();
			for (const dir of [
				"up",
				"down",
				"left",
				"right"
			]) {
				const next = this.applyTo(snap, dir);
				if (!next) continue;
				const k = this.key(next.snap);
				if (seen.has(k)) continue;
				if (next.pushedToDead) continue;
				if (this.solvedFrom(next.snap)) return [...path, dir];
				seen.add(k);
				queue.push({
					snap: next.snap,
					path: [...path, dir]
				});
			}
		}
		return null;
	}
	snapshot() {
		let boxes = "";
		for (let i = 0; i < this.box.length; i++) boxes += this.box[i] ? "1" : "0";
		return {
			player: { ...this.player },
			boxes
		};
	}
	key(s) {
		return `${s.player.x},${s.player.y}|${s.boxes}`;
	}
	solvedFrom(s) {
		for (let i = 0; i < this.goal.length; i++) if (this.goal[i] && s.boxes[i] !== "1") return false;
		return true;
	}
	applyTo(s, dir) {
		const d = DELTA[dir];
		const nx = s.player.x + d.x;
		const ny = s.player.y + d.y;
		if (this.isWall(nx, ny)) return null;
		const boxes = s.boxes.split("");
		let pushedToDead = false;
		if (boxes[this.idx(nx, ny)] === "1") {
			const bx = nx + d.x;
			const by = ny + d.y;
			if (this.isWall(bx, by) || boxes[this.idx(bx, by)] === "1") return null;
			boxes[this.idx(nx, ny)] = "0";
			boxes[this.idx(bx, by)] = "1";
			pushedToDead = this.dead[this.idx(bx, by)] && !this.goal[this.idx(bx, by)];
		}
		return {
			snap: {
				player: {
					x: nx,
					y: ny
				},
				boxes: boxes.join("")
			},
			pushedToDead
		};
	}
	debugGrid() {
		const rows = [];
		for (let y = 0; y < this.rows; y++) {
			let r = "";
			for (let x = 0; x < this.cols; x++) {
				const i = this.idx(x, y);
				const isPlayer = this.player.x === x && this.player.y === y;
				r += this.wall[i] ? "#" : isPlayer ? this.goal[i] ? "+" : "@" : this.box[i] ? this.goal[i] ? "*" : "$" : this.goal[i] ? "." : " ";
			}
			rows.push(r);
		}
		return rows.join("\n");
	}
};
/** Unbounded undo/redo over caller-supplied apply/revert. */
function createHistory(hooks) {
	const past = [];
	const future = [];
	return {
		do(action) {
			hooks.apply(action);
			past.push(action);
			future.length = 0;
		},
		undo() {
			const a = past.pop();
			if (a === void 0) return null;
			hooks.revert(a);
			future.push(a);
			return a;
		},
		redo() {
			const a = future.pop();
			if (a === void 0) return null;
			hooks.apply(a);
			past.push(a);
			return a;
		},
		canUndo() {
			return past.length > 0;
		},
		canRedo() {
			return future.length > 0;
		},
		clear() {
			past.length = 0;
			future.length = 0;
		},
		get length() {
			return past.length;
		}
	};
}
//#endregion
export { Pusher, createHistory, createPusher };

//# sourceMappingURL=pusher.js.map
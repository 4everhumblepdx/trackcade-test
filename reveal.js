//#region src/packs/reveal.ts
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
function createMinefield(cfg) {
	return new Minefield(cfg);
}
var Minefield = class {
	cols;
	rows;
	mines;
	state = "playing";
	cfg;
	mine;
	number;
	cellState;
	placed = false;
	rng;
	revealedCount = 0;
	constructor(cfg) {
		if (cfg.mines >= cfg.cols * cfg.rows) throw new Error("reveal: too many mines for the board");
		this.cfg = cfg;
		this.cols = cfg.cols;
		this.rows = cfg.rows;
		this.mines = cfg.mines;
		this.rng = new Rng(cfg.seed ?? 1);
		const n = cfg.cols * cfg.rows;
		this.mine = new Array(n).fill(false);
		this.number = new Array(n).fill(0);
		this.cellState = new Array(n).fill("hidden");
	}
	idx(x, y) {
		return y * this.cols + x;
	}
	inBounds(x, y) {
		return x >= 0 && y >= 0 && x < this.cols && y < this.rows;
	}
	neighbours(x, y) {
		const out = [];
		for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
			if (!dx && !dy) continue;
			if (this.inBounds(x + dx, y + dy)) out.push({
				x: x + dx,
				y: y + dy
			});
		}
		return out;
	}
	/** The player-visible view of a cell. */
	cell(x, y) {
		const i = this.idx(x, y);
		return {
			state: this.cellState[i],
			number: this.number[i],
			mine: this.state !== "playing" ? this.mine[i] : void 0
		};
	}
	/** Mines minus flags placed (may go negative). */
	get minesLeft() {
		let flags = 0;
		for (const s of this.cellState) if (s === "flagged") flags++;
		return this.mines - flags;
	}
	placeMines(safeX, safeY) {
		const safe = /* @__PURE__ */ new Set([this.idx(safeX, safeY)]);
		if ((this.cfg.firstClickSafe ?? "area") === "area") for (const nb of this.neighbours(safeX, safeY)) safe.add(this.idx(nb.x, nb.y));
		const pool = [];
		for (let i = 0; i < this.mine.length; i++) if (!safe.has(i)) pool.push(i);
		this.rng.shuffle(pool);
		let want = Math.min(this.mines, pool.length);
		for (let k = 0; k < want; k++) this.mine[pool[k]] = true;
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
			if (this.mine[this.idx(x, y)]) continue;
			let n = 0;
			for (const nb of this.neighbours(x, y)) if (this.mine[this.idx(nb.x, nb.y)]) n++;
			this.number[this.idx(x, y)] = n;
		}
		this.placed = true;
	}
	/** Reveal a cell. First reveal places mines (excluding the safe zone). */
	reveal(x, y) {
		if (this.state !== "playing") return {
			waves: [],
			detonated: null,
			state: this.state
		};
		if (!this.placed) this.placeMines(x, y);
		const i = this.idx(x, y);
		if (this.cellState[i] !== "hidden") return {
			waves: [],
			detonated: null,
			state: this.state
		};
		if (this.mine[i]) return this.lose({
			x,
			y
		});
		return this.floodReveal([{
			x,
			y
		}]);
	}
	/** Distance-ordered BFS flood from the given seeds; zero-cells open neighbours. */
	floodReveal(seeds) {
		const waves = [];
		let frontier = [];
		const enqueue = (p) => {
			const i = this.idx(p.x, p.y);
			if (this.cellState[i] !== "hidden") return;
			this.cellState[i] = "revealed";
			this.revealedCount++;
			frontier.push(p);
		};
		for (const s of seeds) enqueue(s);
		while (frontier.length) {
			const wave = frontier.map((p) => ({
				at: p,
				number: this.number[this.idx(p.x, p.y)]
			}));
			waves.push({ cells: wave });
			const next = [];
			const saved = frontier;
			frontier = next;
			for (const p of saved) {
				if (this.number[this.idx(p.x, p.y)] !== 0) continue;
				for (const nb of this.neighbours(p.x, p.y)) enqueue(nb);
			}
		}
		if (this.revealedCount === this.cols * this.rows - this.mines) return this.win(waves);
		return {
			waves,
			detonated: null,
			state: "playing"
		};
	}
	/** Flag → question → hidden cycle. Flags block reveal. */
	flag(x, y) {
		if (this.state !== "playing") return;
		const i = this.idx(x, y);
		if (this.cellState[i] === "revealed") return;
		this.cellState[i] = this.cellState[i] === "hidden" ? "flagged" : this.cellState[i] === "flagged" ? "question" : "hidden";
	}
	/** Chord: on a revealed number whose adjacent flags equal it, reveal the rest.
	* A wrong flag here detonates. */
	chord(x, y) {
		if (this.state !== "playing") return {
			waves: [],
			detonated: null,
			state: this.state
		};
		const i = this.idx(x, y);
		if (this.cellState[i] !== "revealed" || this.number[i] === 0) return {
			waves: [],
			detonated: null,
			state: this.state
		};
		const nbs = this.neighbours(x, y);
		const flags = nbs.filter((nb) => this.cellState[this.idx(nb.x, nb.y)] === "flagged");
		if (flags.length !== this.number[i]) return {
			waves: [],
			detonated: null,
			state: this.state
		};
		const toReveal = nbs.filter((nb) => this.cellState[this.idx(nb.x, nb.y)] === "hidden");
		const badFlag = flags.find((nb) => !this.mine[this.idx(nb.x, nb.y)]);
		const badReveal = toReveal.find((nb) => this.mine[this.idx(nb.x, nb.y)]);
		if (badReveal) return this.lose(badReveal);
		if (badFlag && toReveal.some((nb) => this.mine[this.idx(nb.x, nb.y)])) return this.lose(badFlag);
		return this.floodReveal(toReveal);
	}
	win(waves) {
		this.state = "won";
		for (let i = 0; i < this.mine.length; i++) if (this.mine[i] && this.cellState[i] !== "flagged") this.cellState[i] = "flagged";
		return {
			waves,
			detonated: null,
			state: "won"
		};
	}
	lose(at) {
		this.state = "lost";
		const mines = [];
		const wrongFlags = [];
		for (let i = 0; i < this.mine.length; i++) {
			const p = {
				x: i % this.cols,
				y: i / this.cols | 0
			};
			if (this.mine[i]) mines.push(p);
			if (this.cellState[i] === "flagged" && !this.mine[i]) wrongFlags.push(p);
		}
		return {
			waves: [],
			detonated: at,
			state: "lost",
			reveal: {
				mines,
				wrongFlags
			}
		};
	}
	/** A provably-safe hidden cell derived from revealed numbers, or null.
	* Two rules: a satisfied number's other neighbours are safe; a number whose
	* hidden-neighbour count equals its value means all those hidden are mines. */
	hint() {
		const safe = [];
		const mineCells = [];
		if (!this.placed) return {
			safe,
			mines: mineCells
		};
		for (let y = 0; y < this.rows; y++) for (let x = 0; x < this.cols; x++) {
			const i = this.idx(x, y);
			if (this.cellState[i] !== "revealed" || this.number[i] === 0) continue;
			const nbs = this.neighbours(x, y);
			const hidden = nbs.filter((nb) => {
				const s = this.cellState[this.idx(nb.x, nb.y)];
				return s === "hidden" || s === "question";
			});
			const flags = nbs.filter((nb) => this.cellState[this.idx(nb.x, nb.y)] === "flagged");
			if (hidden.length === 0) continue;
			if (flags.length === this.number[i]) for (const h of hidden) safe.push(h);
			else if (flags.length + hidden.length === this.number[i]) for (const h of hidden) mineCells.push(h);
		}
		return {
			safe: dedupe(safe),
			mines: dedupe(mineCells)
		};
	}
	/** Auto-solve as far as pure deduction allows (for tests / no-guess play).
	* Returns false when stuck (needs a guess) or finished. */
	step() {
		if (this.state !== "playing") return false;
		if (!this.placed) {
			this.reveal(this.cols / 2 | 0, this.rows / 2 | 0);
			return true;
		}
		const { safe, mines } = this.hint();
		let acted = false;
		for (const m of mines) {
			const i = this.idx(m.x, m.y);
			if (this.cellState[i] === "hidden") {
				this.cellState[i] = "flagged";
				acted = true;
			}
		}
		for (const s of safe) if (this.cellState[this.idx(s.x, s.y)] !== "revealed") {
			this.reveal(s.x, s.y);
			acted = true;
			if (this.state !== "playing") return acted;
		}
		return acted;
	}
	debugGrid() {
		const rows = [];
		for (let y = 0; y < this.rows; y++) {
			let r = "";
			for (let x = 0; x < this.cols; x++) {
				const i = this.idx(x, y);
				r += this.cellState[i] === "flagged" ? "F" : this.cellState[i] === "hidden" || this.cellState[i] === "question" ? "." : this.mine[i] ? "*" : String(this.number[i]);
			}
			rows.push(r);
		}
		return rows.join("\n");
	}
};
function dedupe(xs) {
	const seen = /* @__PURE__ */ new Set();
	const out = [];
	for (const p of xs) {
		const k = `${p.x},${p.y}`;
		if (!seen.has(k)) {
			seen.add(k);
			out.push(p);
		}
	}
	return out;
}
//#endregion
export { Minefield, createMinefield };

//# sourceMappingURL=reveal.js.map
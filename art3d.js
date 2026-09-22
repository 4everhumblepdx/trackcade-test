import { t as Builder } from "../shared-BKm0BaVz.js";
//#region src/packs/art3d.ts
var rnd = (a, b = 0) => {
	const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
	return s - Math.floor(s);
};
/**
* Flat-shaded triangle with GUARANTEED outward facing. The trap this fixes:
* deriving the normal from the winding makes the Builder's winding check
* self-satisfying (a clockwise face gets an inward normal that "agrees"
* with itself) — so outwardness must come from GEOMETRY: the face normal is
* flipped to point away from `inside` (a point inside the shape), and the
* Builder then corrects the winding to match. Every face renders from
* every camera angle.
*/
function face(b, inside, p1, p2, p3) {
	const ux = p2[0] - p1[0], uy = p2[1] - p1[1], uz = p2[2] - p1[2];
	const vx = p3[0] - p1[0], vy = p3[1] - p1[1], vz = p3[2] - p1[2];
	let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
	const l = Math.hypot(nx, ny, nz);
	if (l < 1e-6) return;
	nx /= l;
	ny /= l;
	nz /= l;
	const cx = (p1[0] + p2[0] + p3[0]) / 3 - inside[0];
	const cy = (p1[1] + p2[1] + p3[1]) / 3 - inside[1];
	const cz = (p1[2] + p2[2] + p3[2]) / 3 - inside[2];
	if (nx * cx + ny * cy + nz * cz < 0) {
		nx = -nx;
		ny = -ny;
		nz = -nz;
	}
	b.triP([
		p1[0],
		p1[1],
		p1[2],
		nx,
		ny,
		nz
	], [
		p2[0],
		p2[1],
		p2[2],
		nx,
		ny,
		nz
	], [
		p3[0],
		p3[1],
		p3[2],
		nx,
		ny,
		nz
	]);
}
var ORIGIN = [
	0,
	0,
	0
];
/** Hexagonal bipyramid — the classic game crystal (flat facets). */
function crystalVerts() {
	const b = new Builder();
	const N = 6;
	const belt = .06;
	const ring = (i) => {
		const a = i / N * Math.PI * 2;
		return [
			Math.cos(a) * .32,
			belt,
			Math.sin(a) * .32
		];
	};
	for (let i = 0; i < N; i++) {
		const p0 = ring(i), p1 = ring(i + 1);
		face(b, ORIGIN, [
			0,
			.5,
			0
		], p0, p1);
		face(b, ORIGIN, [
			0,
			-.5,
			0
		], p1, p0);
	}
	return b.build();
}
/** A low-poly boulder: jittered sphere with flat facets (deterministic). */
function rockVerts() {
	const b = new Builder();
	const SEG = 7, ROW = 4;
	const pt = (s, r) => {
		if (r <= 0) return [
			0,
			.4,
			0
		];
		if (r >= ROW) return [
			0,
			-.36,
			0
		];
		const si = (s % SEG + SEG) % SEG;
		const theta = si / SEG * Math.PI * 2;
		const phi = r / ROW * Math.PI;
		const jitter = .34 + rnd(si, r) * .16;
		return [
			Math.sin(phi) * Math.cos(theta) * jitter,
			Math.cos(phi) * (.32 + rnd(r, si) * .1),
			Math.sin(phi) * Math.sin(theta) * jitter
		];
	};
	for (let r = 0; r < ROW; r++) for (let s = 0; s < SEG; s++) {
		const a = pt(s, r), c = pt(s + 1, r), d = pt(s + 1, r + 1), e = pt(s, r + 1);
		face(b, ORIGIN, a, c, d);
		face(b, ORIGIN, a, d, e);
	}
	return b.build();
}
/** A ruined column: square plinth, octagonal fluted shaft, square cap. */
function pillarVerts() {
	const b = new Builder();
	const box = (x0, y0, z0, x1, y1, z1) => {
		const mid = [
			(x0 + x1) / 2,
			(y0 + y1) / 2,
			(z0 + z1) / 2
		];
		const p = (x, y, z) => [
			x,
			y,
			z
		];
		face(b, mid, p(x0, y1, z0), p(x1, y1, z0), p(x1, y1, z1));
		face(b, mid, p(x0, y1, z0), p(x1, y1, z1), p(x0, y1, z1));
		face(b, mid, p(x0, y0, z0), p(x1, y0, z1), p(x1, y0, z0));
		face(b, mid, p(x0, y0, z0), p(x0, y0, z1), p(x1, y0, z1));
		face(b, mid, p(x0, y0, z0), p(x1, y0, z0), p(x1, y1, z0));
		face(b, mid, p(x0, y0, z0), p(x1, y1, z0), p(x0, y1, z0));
		face(b, mid, p(x1, y0, z1), p(x0, y0, z1), p(x0, y1, z1));
		face(b, mid, p(x1, y0, z1), p(x0, y1, z1), p(x1, y1, z1));
		face(b, mid, p(x0, y0, z1), p(x0, y0, z0), p(x0, y1, z0));
		face(b, mid, p(x0, y0, z1), p(x0, y1, z0), p(x0, y1, z1));
		face(b, mid, p(x1, y0, z0), p(x1, y0, z1), p(x1, y1, z1));
		face(b, mid, p(x1, y0, z0), p(x1, y1, z1), p(x1, y1, z0));
	};
	box(-.5, -.5, -.5, .5, -.38, .5);
	box(-.42, .38, -.42, .42, .5, .42);
	const N = 8;
	const ring = (i, y) => {
		const a = i % N / N * Math.PI * 2 + Math.PI / N;
		const r = .3 + (i % 2 === 0 ? 0 : -.03);
		return [
			Math.cos(a) * r,
			y,
			Math.sin(a) * r
		];
	};
	for (let i = 0; i < N; i++) {
		face(b, ORIGIN, ring(i, -.38), ring(i + 1, -.38), ring(i + 1, .38));
		face(b, ORIGIN, ring(i, -.38), ring(i + 1, .38), ring(i, .38));
	}
	return b.build();
}
/** A tapering four-sided obelisk with a pyramidal tip. */
function spireVerts() {
	const b = new Builder();
	const base = .26, mid = .16, tipY = .5, midY = .3;
	const sq = (r, y, i) => {
		const a = i % 4 * Math.PI / 2 + Math.PI / 4;
		return [
			Math.cos(a) * r * Math.SQRT2,
			y,
			Math.sin(a) * r * Math.SQRT2
		];
	};
	for (let i = 0; i < 4; i++) {
		face(b, ORIGIN, sq(base, -.5, i), sq(base, -.5, i + 1), sq(mid, midY, i + 1));
		face(b, ORIGIN, sq(base, -.5, i), sq(mid, midY, i + 1), sq(mid, midY, i));
		face(b, ORIGIN, sq(mid, midY, i), sq(mid, midY, i + 1), [
			0,
			tipY,
			0
		]);
		face(b, ORIGIN, sq(base, -.5, i + 1), sq(base, -.5, i), [
			0,
			-.5,
			0
		]);
	}
	return b.build();
}
/**
* Register the pack's geometries with a world. Every factory shares one
* instanced draw per shape name, however many meshes you place.
*/
function registerArt3d(world) {
	return {
		crystal: (config = {}) => world.custom("art3d:crystal", crystalVerts, {
			gloss: .85,
			color: "#7fd4ff",
			...config
		}),
		rock: (config = {}) => world.custom("art3d:rock", rockVerts, {
			gloss: .1,
			color: "#8a8fa3",
			...config
		}),
		pillar: (config = {}) => world.custom("art3d:pillar", pillarVerts, {
			gloss: .25,
			color: "#c9c4b8",
			...config
		}),
		spire: (config = {}) => world.custom("art3d:spire", spireVerts, {
			gloss: .5,
			color: "#5a5f78",
			...config
		}),
		tree(opts = {}) {
			const { x = 0, z = 0, scale = 1, leaf = "#2e7d4f", trunk = "#6b4420" } = opts;
			return [
				world.cylinder({
					x,
					y: .9 * scale,
					z,
					w: .5 * scale,
					h: 1.8 * scale,
					d: .5 * scale,
					color: trunk,
					gloss: .05
				}),
				world.cone({
					x,
					y: 2.4 * scale,
					z,
					w: 2.6 * scale,
					h: 2.2 * scale,
					d: 2.6 * scale,
					color: leaf,
					gloss: .1
				}),
				world.cone({
					x,
					y: 3.6 * scale,
					z,
					w: 1.8 * scale,
					h: 1.8 * scale,
					d: 1.8 * scale,
					color: leaf,
					gloss: .1
				})
			];
		},
		crystalCluster(opts = {}) {
			const { x = 0, z = 0, count = 5, color = "#7fd4ff", seed = 1 } = opts;
			const out = [];
			for (let i = 0; i < count; i++) {
				const a = rnd(i, seed) * Math.PI * 2;
				const dist = .4 + rnd(i, seed + 9) * 1.6;
				const h = 1.2 + rnd(i, seed + 3) * 2.2;
				out.push(this.crystal({
					x: x + Math.cos(a) * dist,
					y: h * .32,
					z: z + Math.sin(a) * dist,
					w: .45 * h,
					h,
					d: .45 * h,
					color,
					pitch: (rnd(i, seed + 5) - .5) * .5,
					roll: (rnd(i, seed + 7) - .5) * .5,
					yaw: rnd(i, seed + 11) * Math.PI
				}));
			}
			return out;
		}
	};
}
//#endregion
export { crystalVerts, pillarVerts, registerArt3d, rockVerts, spireVerts };

//# sourceMappingURL=art3d.js.map
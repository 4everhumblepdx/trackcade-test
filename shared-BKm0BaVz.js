//#region src/lib/geometry3d.ts
/** Triangle-soup builder for custom geometry (procgen packs use this via
* world.custom). quad()/triP() self-correct winding — nothing ships inside-out. */
var Builder = class {
	data = [];
	/**
	* One triangle from three (pos+normal, optionally +uv) points — 6 or 8
	* components each. WINDING IS SELF-CORRECTING: the pipeline culls back
	* faces expecting CCW-from-outside, so if the triangle's geometric normal
	* disagrees with its vertex normals (wound clockwise), it is flipped here
	* — no generator can ship inside-out. Points without a uv are BOX-PROJECTED
	* from the face's dominant axis (unit-box coords → 0..1).
	*/
	triP(a, b, c) {
		const gx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
		const gy = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
		const gz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
		const nx = a[3] + b[3] + c[3], ny = a[4] + b[4] + c[4], nz = a[5] + b[5] + c[5];
		if (gx * nx + gy * ny + gz * nz < 0) {
			const t = b;
			b = c;
			c = t;
		}
		const ax = Math.abs(gx), ay = Math.abs(gy), az = Math.abs(gz);
		for (const p of [
			a,
			b,
			c
		]) {
			let u, v;
			if (p.length >= 8) {
				u = p[6];
				v = p[7];
			} else if (ay >= ax && ay >= az) {
				u = p[0] + .5;
				v = p[2] + .5;
			} else if (ax >= az) {
				u = p[2] + .5;
				v = .5 - p[1];
			} else {
				u = p[0] + .5;
				v = .5 - p[1];
			}
			this.data.push(p[0], p[1], p[2], p[3], p[4], p[5], u, v);
		}
	}
	/** Two triangles for the quad a-b-c-d (counter-clockwise seen from outside). */
	quad(a, b, c, d) {
		this.triP(a, b, c);
		this.triP(a, c, d);
	}
	build() {
		return new Float32Array(this.data);
	}
};
/** Unit cube (flat normals) — the workhorse box. `segs` grids each face
* (visually identical when undeformed; matters under vertex fog/deformers). */
function cubeVerts(segs = 1) {
	const b = new Builder();
	const n_ = Math.max(1, Math.round(segs));
	for (const [n, u, v] of [
		[
			[
				0,
				0,
				1
			],
			[
				1,
				0,
				0
			],
			[
				0,
				1,
				0
			]
		],
		[
			[
				0,
				0,
				-1
			],
			[
				-1,
				0,
				0
			],
			[
				0,
				1,
				0
			]
		],
		[
			[
				1,
				0,
				0
			],
			[
				0,
				0,
				-1
			],
			[
				0,
				1,
				0
			]
		],
		[
			[
				-1,
				0,
				0
			],
			[
				0,
				0,
				1
			],
			[
				0,
				1,
				0
			]
		],
		[
			[
				0,
				1,
				0
			],
			[
				1,
				0,
				0
			],
			[
				0,
				0,
				-1
			]
		],
		[
			[
				0,
				-1,
				0
			],
			[
				1,
				0,
				0
			],
			[
				0,
				0,
				1
			]
		]
	]) {
		const p = (su, sv) => [
			n[0] / 2 + (u[0] * su + v[0] * sv) / 2,
			n[1] / 2 + (u[1] * su + v[1] * sv) / 2,
			n[2] / 2 + (u[2] * su + v[2] * sv) / 2,
			n[0],
			n[1],
			n[2]
		];
		for (let i = 0; i < n_; i++) for (let j = 0; j < n_; j++) {
			const s0 = i / n_ * 2 - 1, s1 = (i + 1) / n_ * 2 - 1;
			const t0 = j / n_ * 2 - 1, t1 = (j + 1) / n_ * 2 - 1;
			b.quad(p(s0, t0), p(s1, t0), p(s1, t1), p(s0, t1));
		}
	}
	return b.build();
}
/** UV sphere, diameter 1, smooth normals, equirect UVs (planet maps wrap). */
function sphereVerts(segs = 28, rings = 18) {
	const b = new Builder();
	const pt = (s, r) => {
		const phi = r / rings * Math.PI;
		const theta = s / segs * Math.PI * 2;
		const nx = Math.sin(phi) * Math.cos(theta);
		const ny = Math.cos(phi);
		const nz = Math.sin(phi) * Math.sin(theta);
		return [
			nx / 2,
			ny / 2,
			nz / 2,
			nx,
			ny,
			nz,
			s / segs,
			r / rings
		];
	};
	for (let r = 0; r < rings; r++) for (let s = 0; s < segs; s++) b.quad(pt(s, r), pt(s, r + 1), pt(s + 1, r + 1), pt(s + 1, r));
	return b.build();
}
/**
* Capped cylinder, diameter 1, height 1: smooth side, flat caps. Generalised
* to a frustum: `rTop`/`rBottom` are each end's radius as a fraction of the
* unit radius (1 = full 0.5; rTop 0 = a cone). `open` skips the caps and
* makes the shell DOUBLE-SIDED (an open pipe has a visible inside); a capped
* `arc` (0..1) portion is SEALED with flat cut walls (a solid wedge).
*/
function cylinderVerts(segs = 32, rTop = 1, rBottom = 1, open = false, arc = 1) {
	const b = new Builder();
	const rt = Math.max(0, rTop) * .5, rb = Math.max(0, rBottom) * .5;
	const sweep = Math.min(1, Math.max(.01, arc)) * Math.PI * 2;
	const nl = Math.hypot(1, rb - rt);
	const side = (s, y, flip = 1) => {
		const t = s / segs * sweep;
		const r = y < 0 ? rb : rt;
		return [
			Math.cos(t) * r,
			y,
			Math.sin(t) * r,
			Math.cos(t) / nl * flip,
			(rb - rt) / nl * flip,
			Math.sin(t) / nl * flip,
			s / segs,
			.5 - y
		];
	};
	const cap = (s, y, r, ny) => {
		const t = s / segs * sweep;
		return [
			Math.cos(t) * r,
			y,
			Math.sin(t) * r,
			0,
			ny,
			0
		];
	};
	for (let s = 0; s < segs; s++) {
		b.quad(side(s, -.5), side(s, .5), side(s + 1, .5), side(s + 1, -.5));
		if (open) b.quad(side(s, -.5, -1), side(s + 1, -.5, -1), side(s + 1, .5, -1), side(s, .5, -1));
		else {
			if (rt > 0) b.triP([
				0,
				.5,
				0,
				0,
				1,
				0
			], cap(s + 1, .5, rt, 1), cap(s, .5, rt, 1));
			if (rb > 0) b.triP([
				0,
				-.5,
				0,
				0,
				-1,
				0
			], cap(s, -.5, rb, -1), cap(s + 1, -.5, rb, -1));
		}
	}
	if (arc < 1 && !open) {
		const wall = (t, nx, nz) => {
			const n = [
				nx,
				0,
				nz
			];
			b.quad([
				0,
				-.5,
				0,
				...n
			], [
				0,
				.5,
				0,
				...n
			], [
				Math.cos(t) * rt,
				.5,
				Math.sin(t) * rt,
				...n
			], [
				Math.cos(t) * rb,
				-.5,
				Math.sin(t) * rb,
				...n
			]);
		};
		wall(0, Math.sin(0), -Math.cos(0));
		wall(sweep, -Math.sin(sweep), Math.cos(sweep));
	}
	return b.build();
}
/** Torus in the XZ plane, outer diameter 1, smooth normals. `arc` (0..1)
* sweeps a portion of the ring; partial sweeps are SEALED with flat caps at
* both cut ends (a cut sausage, not a hollow shell). */
function torusVerts(major = .34, minor = .16, segs = 36, sides = 18, arc = 1) {
	const b = new Builder();
	const sweep = Math.min(1, Math.max(.01, arc)) * Math.PI * 2;
	const pt = (s, t) => {
		const u = s / segs * sweep;
		const v = t / sides * Math.PI * 2;
		const cx = Math.cos(u) * major, cz = Math.sin(u) * major;
		const nx = Math.cos(u) * Math.cos(v), ny = Math.sin(v), nz = Math.sin(u) * Math.cos(v);
		return [
			cx + nx * minor,
			ny * minor,
			cz + nz * minor,
			nx,
			ny,
			nz,
			s / segs,
			t / sides
		];
	};
	for (let s = 0; s < segs; s++) for (let t = 0; t < sides; t++) b.quad(pt(s, t), pt(s + 1, t), pt(s + 1, t + 1), pt(s, t + 1));
	if (arc < 1) {
		const seal = (s, dir) => {
			const u = s / segs * sweep;
			const n = [
				Math.sin(u) * -dir,
				0,
				Math.cos(u) * dir
			];
			const c = [
				Math.cos(u) * major,
				0,
				Math.sin(u) * major
			];
			for (let t = 0; t < sides; t++) {
				const a = pt(s, t), d = pt(s, t + 1);
				b.triP([
					c[0],
					c[1],
					c[2],
					...n
				], [
					a[0],
					a[1],
					a[2],
					...n
				], [
					d[0],
					d[1],
					d[2],
					...n
				]);
			}
		};
		seal(0, -1);
		seal(segs, 1);
	}
	return b.build();
}
/**
* Rounded ("chamfered") unit box: edges and corners bevel smoothly with
* radius `r` (fraction of the half-extent, 0..0.5). The classic trick: build
* each face as a grid, clamp each point to the shrunken core box, and push it
* out along the (smooth) normal from the core — flat mid-faces, curved edges.
*/
function roundedBoxVerts(r = .2, seg = 7) {
	const b = new Builder();
	const H = .5;
	const core = H - Math.min(.5, Math.max(.01, r)) * H * 2 * .5;
	const rad = H - core;
	const round = (x, y, z) => {
		const cx = Math.min(core, Math.max(-core, x));
		const cy = Math.min(core, Math.max(-core, y));
		const cz = Math.min(core, Math.max(-core, z));
		let nx = x - cx, ny = y - cy, nz = z - cz;
		const l = Math.hypot(nx, ny, nz) || 1;
		nx /= l;
		ny /= l;
		nz /= l;
		return [
			cx + nx * rad,
			cy + ny * rad,
			cz + nz * rad,
			nx,
			ny,
			nz
		];
	};
	for (const [n, u, v] of [
		[
			[
				0,
				0,
				1
			],
			[
				1,
				0,
				0
			],
			[
				0,
				1,
				0
			]
		],
		[
			[
				0,
				0,
				-1
			],
			[
				-1,
				0,
				0
			],
			[
				0,
				1,
				0
			]
		],
		[
			[
				1,
				0,
				0
			],
			[
				0,
				0,
				-1
			],
			[
				0,
				1,
				0
			]
		],
		[
			[
				-1,
				0,
				0
			],
			[
				0,
				0,
				1
			],
			[
				0,
				1,
				0
			]
		],
		[
			[
				0,
				1,
				0
			],
			[
				1,
				0,
				0
			],
			[
				0,
				0,
				-1
			]
		],
		[
			[
				0,
				-1,
				0
			],
			[
				1,
				0,
				0
			],
			[
				0,
				0,
				1
			]
		]
	]) {
		const p = (su, sv) => round(n[0] * H + (u[0] * su + v[0] * sv) * H, n[1] * H + (u[1] * su + v[1] * sv) * H, n[2] * H + (u[2] * su + v[2] * sv) * H);
		for (let i = 0; i < seg; i++) for (let j = 0; j < seg; j++) {
			const s0 = i / seg * 2 - 1, s1 = (i + 1) / seg * 2 - 1;
			const t0 = j / seg * 2 - 1, t1 = (j + 1) / seg * 2 - 1;
			b.quad(p(s0, t0), p(s1, t0), p(s1, t1), p(s0, t1));
		}
	}
	return b.build();
}
/** Capped cone: unit base diameter, unit height, apex up. Smooth sides.
* `open` skips the base and double-sides the shell (a visible inside);
* a based `arc` (0..1) portion is sealed with flat cut walls. */
function coneVerts(segs = 32, open = false, arc = 1) {
	const b = new Builder();
	const sweep = Math.min(1, Math.max(.01, arc)) * Math.PI * 2;
	const nl = Math.hypot(1, .5);
	const side = (s, flip = 1) => {
		const t = s / segs * sweep;
		return [
			Math.cos(t) / 2,
			-.5,
			Math.sin(t) / 2,
			Math.cos(t) / nl * flip,
			.5 / nl * flip,
			Math.sin(t) / nl * flip,
			s / segs,
			1
		];
	};
	const apex = (s, flip = 1) => {
		const t = (s + .5) / segs * sweep;
		return [
			0,
			.5,
			0,
			Math.cos(t) / nl * flip,
			.5 / nl * flip,
			Math.sin(t) / nl * flip,
			(s + .5) / segs,
			0
		];
	};
	for (let s = 0; s < segs; s++) {
		b.triP(side(s), apex(s), side(s + 1));
		if (open) b.triP(side(s, -1), side(s + 1, -1), apex(s, -1));
		else b.triP([
			0,
			-.5,
			0,
			0,
			-1,
			0
		], [
			Math.cos(s / segs * sweep) / 2,
			-.5,
			Math.sin(s / segs * sweep) / 2,
			0,
			-1,
			0
		], [
			Math.cos((s + 1) / segs * sweep) / 2,
			-.5,
			Math.sin((s + 1) / segs * sweep) / 2,
			0,
			-1,
			0
		]);
	}
	if (arc < 1 && !open) {
		const wall = (t, nx, nz) => {
			const n = [
				nx,
				0,
				nz
			];
			b.triP([
				0,
				.5,
				0,
				...n
			], [
				0,
				-.5,
				0,
				...n
			], [
				Math.cos(t) / 2,
				-.5,
				Math.sin(t) / 2,
				...n
			]);
		};
		wall(0, Math.sin(0), -Math.cos(0));
		wall(sweep, -Math.sin(sweep), Math.cos(sweep));
	}
	return b.build();
}
/** Capsule (pill): total height 1, radius `r` (default 0.25) — scale h for longer pills. */
function capsuleVerts(segs = 24, rings = 8, r = .25) {
	const b = new Builder();
	const R = Math.min(.5, Math.max(.02, r)), half = .5 - R;
	const hemi = (s, r, top) => {
		const phi = r / rings * (Math.PI / 2);
		const theta = s / segs * Math.PI * 2;
		const ny = Math.cos(phi) * (top ? 1 : -1);
		const nx = Math.sin(phi) * Math.cos(theta);
		const nz = Math.sin(phi) * Math.sin(theta);
		const y = ny * R + (top ? half : -half);
		return [
			nx * R,
			y,
			nz * R,
			nx,
			ny,
			nz,
			s / segs,
			.5 - y
		];
	};
	const tube = (s, y) => {
		const t = s / segs * Math.PI * 2;
		return [
			Math.cos(t) * R,
			y,
			Math.sin(t) * R,
			Math.cos(t),
			0,
			Math.sin(t),
			s / segs,
			.5 - y
		];
	};
	for (let s = 0; s < segs; s++) {
		for (let r = 0; r < rings; r++) {
			b.quad(hemi(s, r, true), hemi(s, r + 1, true), hemi(s + 1, r + 1, true), hemi(s + 1, r, true));
			b.quad(hemi(s, r, false), hemi(s + 1, r, false), hemi(s + 1, r + 1, false), hemi(s, r + 1, false));
		}
		b.quad(tube(s, -half), tube(s, half), tube(s + 1, half), tube(s + 1, -half));
	}
	return b.build();
}
/** Wedge (ramp): a unit box halved diagonally — flat floor, vertical back at -x, slope up toward -x. */
function wedgeVerts() {
	const b = new Builder();
	const sn = Math.SQRT1_2;
	const tri2 = (z) => [
		[
			-.5,
			-.5,
			z,
			0,
			0,
			Math.sign(z)
		],
		[
			.5,
			-.5,
			z,
			0,
			0,
			Math.sign(z)
		],
		[
			-.5,
			.5,
			z,
			0,
			0,
			Math.sign(z)
		]
	];
	b.triP(tri2(.5)[0], tri2(.5)[1], tri2(.5)[2]);
	b.triP(tri2(-.5)[0], tri2(-.5)[2], tri2(-.5)[1]);
	b.quad([
		-.5,
		-.5,
		-.5,
		0,
		-1,
		0
	], [
		.5,
		-.5,
		-.5,
		0,
		-1,
		0
	], [
		.5,
		-.5,
		.5,
		0,
		-1,
		0
	], [
		-.5,
		-.5,
		.5,
		0,
		-1,
		0
	]);
	b.quad([
		-.5,
		-.5,
		-.5,
		-1,
		0,
		0
	], [
		-.5,
		.5,
		-.5,
		-1,
		0,
		0
	], [
		-.5,
		.5,
		.5,
		-1,
		0,
		0
	], [
		-.5,
		-.5,
		.5,
		-1,
		0,
		0
	]);
	b.quad([
		.5,
		-.5,
		-.5,
		sn,
		sn,
		0
	], [
		-.5,
		.5,
		-.5,
		sn,
		sn,
		0
	], [
		-.5,
		.5,
		.5,
		sn,
		sn,
		0
	], [
		.5,
		-.5,
		.5,
		sn,
		sn,
		0
	]);
	return b.build();
}
/** A double-sided unit quad in the XZ plane (ground sheets, water, cards laid
* flat). `segs` grids it — essential under deformers/vertex effects, where a
* 2-triangle plane interpolates everything across one huge diagonal. */
function planeVerts(segs = 1) {
	const b = new Builder();
	const n = Math.max(1, Math.round(segs));
	const p = (x, z, ny) => [
		x,
		0,
		z,
		0,
		ny,
		0
	];
	for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
		const x0 = i / n - .5, x1 = (i + 1) / n - .5;
		const z0 = j / n - .5, z1 = (j + 1) / n - .5;
		b.quad(p(x0, z0, 1), p(x1, z0, 1), p(x1, z1, 1), p(x0, z1, 1));
		b.quad(p(x0, z0, -1), p(x0, z1, -1), p(x1, z1, -1), p(x1, z0, -1));
	}
	return b.build();
}
/**
* Panel: an extruded ROUNDED-CORNER rectangle (unit footprint in XZ, unit
* thickness in y — scale h thin for cards/plaques). `r` = corner radius as a
* fraction of the half-extent. Smooth wall normals around the corner arcs
* via the same clamp-to-core trick as the rounded box.
*/
function panelVerts(r = .35, seg = 6) {
	const b = new Builder();
	const rad = Math.min(.49, Math.max(.02, r * .5));
	const core = .5 - rad;
	const ring = [];
	const corners = [
		{
			cx: core,
			cz: core,
			a0: 0
		},
		{
			cx: -core,
			cz: core,
			a0: Math.PI / 2
		},
		{
			cx: -core,
			cz: -core,
			a0: Math.PI
		},
		{
			cx: core,
			cz: -core,
			a0: Math.PI * 1.5
		}
	];
	for (const { cx, cz, a0 } of corners) for (let i = 0; i <= seg; i++) {
		const a = a0 + i / seg * (Math.PI / 2);
		ring.push({
			x: cx + Math.cos(a) * rad,
			z: cz + Math.sin(a) * rad,
			nx: Math.cos(a),
			nz: Math.sin(a)
		});
	}
	const N = ring.length;
	for (let i = 0; i < N; i++) {
		const a = ring[i], c = ring[(i + 1) % N];
		b.triP([
			0,
			.5,
			0,
			0,
			1,
			0
		], [
			a.x,
			.5,
			a.z,
			0,
			1,
			0
		], [
			c.x,
			.5,
			c.z,
			0,
			1,
			0
		]);
		b.triP([
			0,
			-.5,
			0,
			0,
			-1,
			0
		], [
			c.x,
			-.5,
			c.z,
			0,
			-1,
			0
		], [
			a.x,
			-.5,
			a.z,
			0,
			-1,
			0
		]);
		b.quad([
			a.x,
			-.5,
			a.z,
			a.nx,
			0,
			a.nz
		], [
			a.x,
			.5,
			a.z,
			a.nx,
			0,
			a.nz
		], [
			c.x,
			.5,
			c.z,
			c.nx,
			0,
			c.nz
		], [
			c.x,
			-.5,
			c.z,
			c.nx,
			0,
			c.nz
		]);
	}
	return b.build();
}
/**
* Disc: a coin / casino chip / wheel — a cylinder whose rim edges are
* FILLETED (rounded where the flat faces meet the flat side). Built as a
* lathe: the 2D profile (face → quarter-round fillet → straight rim →
* fillet → face) revolved around Y, with exact normals from the profile.
* Unit diameter × unit height: scale h thin for a chip, roll it upright
* (pitch/roll ±90°) for a wheel. `fillet` = fraction of the smaller
* half-extent (0..1).
*/
function discVerts(fillet = .35, segs = 40, filletSegs = 6) {
	const b = new Builder();
	const R = .5, H = .5;
	const f = Math.min(.49, Math.max(.02, fillet)) * Math.min(R, H);
	const profile = [];
	profile.push([
		0,
		H,
		0,
		1
	], [
		R - f,
		H,
		0,
		1
	]);
	for (let i = 0; i <= filletSegs; i++) {
		const a = i / filletSegs * (Math.PI / 2);
		profile.push([
			R - f + Math.sin(a) * f,
			H - f + Math.cos(a) * f,
			Math.sin(a),
			Math.cos(a)
		]);
	}
	profile.push([
		R,
		-(H - f),
		1,
		0
	]);
	for (let i = 0; i <= filletSegs; i++) {
		const a = i / filletSegs * (Math.PI / 2);
		profile.push([
			R - f + Math.cos(a) * f,
			-(H - f) - Math.sin(a) * f,
			Math.cos(a),
			-Math.sin(a)
		]);
	}
	profile.push([
		R - f,
		-.5,
		0,
		-1
	], [
		0,
		-.5,
		0,
		-1
	]);
	const pt = (p, s) => {
		const t = s / segs * Math.PI * 2;
		return [
			Math.cos(t) * p[0],
			p[1],
			Math.sin(t) * p[0],
			Math.cos(t) * p[2],
			p[3],
			Math.sin(t) * p[2]
		];
	};
	for (let s = 0; s < segs; s++) for (let i = 0; i < profile.length - 1; i++) b.quad(pt(profile[i], s), pt(profile[i], s + 1), pt(profile[i + 1], s + 1), pt(profile[i + 1], s));
	return b.build();
}
/** Flat-shaded triangle oriented away from a reference inside point (the
* art3d trick — outwardness from geometry, never from winding). */
function flatTri(b, inside, p1, p2, p3) {
	const ux = p2[0] - p1[0], uy = p2[1] - p1[1], uz = p2[2] - p1[2];
	const vx = p3[0] - p1[0], vy = p3[1] - p1[1], vz = p3[2] - p1[2];
	let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
	const l = Math.hypot(nx, ny, nz);
	if (l < 1e-9) return;
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
/** Uniform-fit 2D points into the centred unit square (preserves aspect). */
function fit2d(pts) {
	let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
	for (const [x, y] of pts) {
		x0 = Math.min(x0, x);
		x1 = Math.max(x1, x);
		y0 = Math.min(y0, y);
		y1 = Math.max(y1, y);
	}
	const s = 1 / Math.max(x1 - x0, y1 - y0, 1e-9);
	const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
	return pts.map(([x, y]) => [(x - cx) * s, (y - cy) * s]);
}
/** Signed area of a 2D polygon (positive = counter-clockwise). */
function signedArea(pts) {
	let a = 0;
	for (let i = 0; i < pts.length; i++) {
		const [x0, y0] = pts[i], [x1, y1] = pts[(i + 1) % pts.length];
		a += x0 * y1 - x1 * y0;
	}
	return a / 2;
}
/**
* Ear-clipping triangulation of a simple polygon (no holes, no
* self-intersections). Returns index triples into `pts`. O(n²) — geometry
* builds once per bucket, so simplicity beats asymptotics here.
*/
function earClip(pts) {
	const idx = pts.map((_, i) => i);
	if (signedArea(pts) < 0) idx.reverse();
	const out = [];
	const cross = (a, b, c) => (pts[b][0] - pts[a][0]) * (pts[c][1] - pts[a][1]) - (pts[b][1] - pts[a][1]) * (pts[c][0] - pts[a][0]);
	const inside = (a, b, c, p) => cross(a, b, p) >= -1e-12 && cross(b, c, p) >= -1e-12 && cross(c, a, p) >= -1e-12;
	let guard = idx.length * idx.length + 8;
	while (idx.length > 3 && guard-- > 0) {
		let clipped = false;
		for (let i = 0; i < idx.length; i++) {
			const a = idx[(i + idx.length - 1) % idx.length], b = idx[i], c = idx[(i + 1) % idx.length];
			if (cross(a, b, c) <= 1e-12) continue;
			let blocked = false;
			for (const p of idx) {
				if (p === a || p === b || p === c) continue;
				if (inside(a, b, c, p)) {
					blocked = true;
					break;
				}
			}
			if (blocked) continue;
			out.push([
				a,
				b,
				c
			]);
			idx.splice(i, 1);
			clipped = true;
			break;
		}
		if (!clipped) break;
	}
	for (let i = 1; i < idx.length - 1; i++) out.push([
		idx[0],
		idx[i],
		idx[i + 1]
	]);
	return out;
}
/** Flat disc (or pie slice via `arc` 0..1) in the XZ plane, double-sided, unit diameter. */
function circleVerts(segs = 32, arc = 1) {
	const b = new Builder();
	const sweep = Math.min(1, Math.max(.01, arc)) * Math.PI * 2;
	const pt = (s, ny) => {
		const t = s / segs * sweep;
		return [
			Math.cos(t) / 2,
			0,
			Math.sin(t) / 2,
			0,
			ny,
			0
		];
	};
	for (let s = 0; s < segs; s++) {
		b.triP([
			0,
			0,
			0,
			0,
			1,
			0
		], pt(s + 1, 1), pt(s, 1));
		b.triP([
			0,
			0,
			0,
			0,
			-1,
			0
		], pt(s, -1), pt(s + 1, -1));
	}
	return b.build();
}
/** Flat ring/annulus (or portion via `arc`) in the XZ plane, double-sided.
* `inner` = inner radius as a fraction of the outer (0..1). */
function ringVerts(inner = .5, segs = 32, arc = 1) {
	const b = new Builder();
	const ri = Math.min(.98, Math.max(.02, inner)) * .5;
	const sweep = Math.min(1, Math.max(.01, arc)) * Math.PI * 2;
	const pt = (s, r, ny) => {
		const t = s / segs * sweep;
		return [
			Math.cos(t) * r,
			0,
			Math.sin(t) * r,
			0,
			ny,
			0
		];
	};
	for (let s = 0; s < segs; s++) {
		b.quad(pt(s, ri, 1), pt(s + 1, ri, 1), pt(s + 1, .5, 1), pt(s, .5, 1));
		b.quad(pt(s, ri, -1), pt(s, .5, -1), pt(s + 1, .5, -1), pt(s + 1, ri, -1));
	}
	return b.build();
}
function tubeAlong(b, path, r, sides, closed) {
	const n = path.length;
	const T = [];
	for (let i = 0; i < n; i++) {
		const a = path[closed ? (i + n - 1) % n : Math.max(0, i - 1)];
		const c = path[closed ? (i + 1) % n : Math.min(n - 1, i + 1)];
		const t = [
			c[0] - a[0],
			c[1] - a[1],
			c[2] - a[2]
		];
		const l = Math.hypot(t[0], t[1], t[2]) || 1;
		T.push([
			t[0] / l,
			t[1] / l,
			t[2] / l
		]);
	}
	const N = [];
	{
		const t0 = T[0];
		const pick = Math.abs(t0[0]) < .9 ? [
			1,
			0,
			0
		] : [
			0,
			1,
			0
		];
		let nx = pick[1] * t0[2] - pick[2] * t0[1], ny = pick[2] * t0[0] - pick[0] * t0[2], nz = pick[0] * t0[1] - pick[1] * t0[0];
		const l = Math.hypot(nx, ny, nz) || 1;
		N.push([
			nx / l,
			ny / l,
			nz / l
		]);
	}
	const rotate = (v, axis, ang) => {
		const [x, y, z] = v, [ax, ay, az] = axis;
		const c = Math.cos(ang), s = Math.sin(ang), d = (1 - c) * (ax * x + ay * y + az * z);
		return [
			x * c + (ay * z - az * y) * s + ax * d,
			y * c + (az * x - ax * z) * s + ay * d,
			z * c + (ax * y - ay * x) * s + az * d
		];
	};
	for (let i = 1; i < n; i++) {
		const a = T[i - 1], c = T[i];
		let ax = a[1] * c[2] - a[2] * c[1], ay = a[2] * c[0] - a[0] * c[2], az = a[0] * c[1] - a[1] * c[0];
		const l = Math.hypot(ax, ay, az);
		if (l < 1e-9) {
			N.push(N[i - 1].slice());
			continue;
		}
		ax /= l;
		ay /= l;
		az /= l;
		const dot = Math.min(1, Math.max(-1, a[0] * c[0] + a[1] * c[1] + a[2] * c[2]));
		N.push(rotate(N[i - 1], [
			ax,
			ay,
			az
		], Math.acos(dot)));
	}
	let twist = 0;
	if (closed) {
		const a = T[n - 1], c = T[0];
		let last = N[n - 1].slice();
		let ax = a[1] * c[2] - a[2] * c[1], ay = a[2] * c[0] - a[0] * c[2], az = a[0] * c[1] - a[1] * c[0];
		const l = Math.hypot(ax, ay, az);
		if (l >= 1e-9) {
			const dot = Math.min(1, Math.max(-1, a[0] * c[0] + a[1] * c[1] + a[2] * c[2]));
			last = rotate(last, [
				ax / l,
				ay / l,
				az / l
			], Math.acos(dot));
		}
		const N0 = N[0], t0 = T[0];
		const B0 = [
			t0[1] * N0[2] - t0[2] * N0[1],
			t0[2] * N0[0] - t0[0] * N0[2],
			t0[0] * N0[1] - t0[1] * N0[0]
		];
		twist = Math.atan2(last[0] * B0[0] + last[1] * B0[1] + last[2] * B0[2], last[0] * N0[0] + last[1] * N0[1] + last[2] * N0[2]);
	}
	const last = closed ? n : n - 1;
	const ring = (i, k, iu = i) => {
		const t = T[i], nv = twist ? rotate(N[i], t, -twist * (i / n)) : N[i];
		const bv = [
			t[1] * nv[2] - t[2] * nv[1],
			t[2] * nv[0] - t[0] * nv[2],
			t[0] * nv[1] - t[1] * nv[0]
		];
		const a = k / sides * Math.PI * 2;
		const nx = Math.cos(a) * nv[0] + Math.sin(a) * bv[0];
		const ny = Math.cos(a) * nv[1] + Math.sin(a) * bv[1];
		const nz = Math.cos(a) * nv[2] + Math.sin(a) * bv[2];
		return [
			path[i][0] + nx * r,
			path[i][1] + ny * r,
			path[i][2] + nz * r,
			nx,
			ny,
			nz,
			iu / last,
			k / sides
		];
	};
	for (let i = 0; i < last; i++) {
		const j = (i + 1) % n;
		for (let k = 0; k < sides; k++) b.quad(ring(i, k), ring(j, k, i + 1), ring(j, k + 1, i + 1), ring(i, k + 1));
	}
	if (!closed) for (let k = 0; k < sides; k++) {
		const t0 = T[0], t1 = T[n - 1];
		b.triP([
			path[0][0],
			path[0][1],
			path[0][2],
			-t0[0],
			-t0[1],
			-t0[2]
		], [
			...ring(0, k).slice(0, 3),
			-t0[0],
			-t0[1],
			-t0[2]
		], [
			...ring(0, k + 1).slice(0, 3),
			-t0[0],
			-t0[1],
			-t0[2]
		]);
		b.triP([
			path[n - 1][0],
			path[n - 1][1],
			path[n - 1][2],
			t1[0],
			t1[1],
			t1[2]
		], [
			...ring(n - 1, k + 1).slice(0, 3),
			t1[0],
			t1[1],
			t1[2]
		], [
			...ring(n - 1, k).slice(0, 3),
			t1[0],
			t1[1],
			t1[2]
		]);
	}
}
/** Fit a 3D path into the unit box minus a margin (uniform, centred). */
function fitPath(path, margin) {
	let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, z0 = Infinity, z1 = -Infinity;
	for (const [x, y, z] of path) {
		x0 = Math.min(x0, x);
		x1 = Math.max(x1, x);
		y0 = Math.min(y0, y);
		y1 = Math.max(y1, y);
		z0 = Math.min(z0, z);
		z1 = Math.max(z1, z);
	}
	const s = (1 - 2 * margin) / Math.max(x1 - x0, y1 - y0, z1 - z0, 1e-9);
	const c = [
		(x0 + x1) / 2,
		(y0 + y1) / 2,
		(z0 + z1) / 2
	];
	return path.map(([x, y, z]) => [
		(x - c[0]) * s,
		(y - c[1]) * s,
		(z - c[2]) * s
	]);
}
/** Tube swept along a 3D polyline (auto-fit to the unit box). `r` = tube
* radius as a fraction of the unit half-extent; `closed` joins the ends. */
function tubeVerts(path, r = .16, sides = 12, closed = false) {
	const b = new Builder();
	const rad = Math.min(.45, Math.max(.01, r)) * .5;
	tubeAlong(b, fitPath(path, rad), rad, Math.max(3, Math.round(sides)), closed);
	return b.build();
}
/** Torus knot (p, q winding) as a closed tube, fit to the unit box. */
function torusKnotVerts(p = 2, q = 3, segs = 96, sides = 10, tube = .24) {
	const path = [];
	for (let i = 0; i < segs; i++) {
		const t = i / segs * Math.PI * 2;
		const rr = 2 + Math.cos(q * t);
		path.push([
			rr * Math.cos(p * t),
			Math.sin(q * t),
			rr * Math.sin(p * t)
		]);
	}
	const b = new Builder();
	const rad = Math.min(.45, Math.max(.01, tube)) * .5;
	tubeAlong(b, fitPath(path, rad), rad, Math.max(3, Math.round(sides)), true);
	return b.build();
}
var PHI = (1 + Math.sqrt(5)) / 2;
var POLY_DATA = {
	tetrahedron: {
		v: [
			[
				1,
				1,
				1
			],
			[
				-1,
				-1,
				1
			],
			[
				-1,
				1,
				-1
			],
			[
				1,
				-1,
				-1
			]
		],
		f: [
			[
				2,
				1,
				0
			],
			[
				0,
				3,
				2
			],
			[
				1,
				3,
				0
			],
			[
				2,
				3,
				1
			]
		]
	},
	octahedron: {
		v: [
			[
				1,
				0,
				0
			],
			[
				-1,
				0,
				0
			],
			[
				0,
				1,
				0
			],
			[
				0,
				-1,
				0
			],
			[
				0,
				0,
				1
			],
			[
				0,
				0,
				-1
			]
		],
		f: [
			[
				0,
				2,
				4
			],
			[
				0,
				4,
				3
			],
			[
				0,
				3,
				5
			],
			[
				0,
				5,
				2
			],
			[
				1,
				2,
				5
			],
			[
				1,
				5,
				3
			],
			[
				1,
				3,
				4
			],
			[
				1,
				4,
				2
			]
		]
	},
	icosahedron: {
		v: [
			[
				-1,
				PHI,
				0
			],
			[
				1,
				PHI,
				0
			],
			[
				-1,
				-PHI,
				0
			],
			[
				1,
				-PHI,
				0
			],
			[
				0,
				-1,
				PHI
			],
			[
				0,
				1,
				PHI
			],
			[
				0,
				-1,
				-PHI
			],
			[
				0,
				1,
				-PHI
			],
			[
				PHI,
				0,
				-1
			],
			[
				PHI,
				0,
				1
			],
			[
				-PHI,
				0,
				-1
			],
			[
				-PHI,
				0,
				1
			]
		],
		f: [
			[
				0,
				11,
				5
			],
			[
				0,
				5,
				1
			],
			[
				0,
				1,
				7
			],
			[
				0,
				7,
				10
			],
			[
				0,
				10,
				11
			],
			[
				1,
				5,
				9
			],
			[
				5,
				11,
				4
			],
			[
				11,
				10,
				2
			],
			[
				10,
				7,
				6
			],
			[
				7,
				1,
				8
			],
			[
				3,
				9,
				4
			],
			[
				3,
				4,
				2
			],
			[
				3,
				2,
				6
			],
			[
				3,
				6,
				8
			],
			[
				3,
				8,
				9
			],
			[
				4,
				9,
				5
			],
			[
				2,
				4,
				11
			],
			[
				6,
				2,
				10
			],
			[
				8,
				6,
				7
			],
			[
				9,
				8,
				1
			]
		]
	},
	dodecahedron: {
		v: [
			[
				-1,
				-1,
				-1
			],
			[
				-1,
				-1,
				1
			],
			[
				-1,
				1,
				-1
			],
			[
				-1,
				1,
				1
			],
			[
				1,
				-1,
				-1
			],
			[
				1,
				-1,
				1
			],
			[
				1,
				1,
				-1
			],
			[
				1,
				1,
				1
			],
			[
				0,
				-1 / PHI,
				-PHI
			],
			[
				0,
				-1 / PHI,
				PHI
			],
			[
				0,
				1 / PHI,
				-PHI
			],
			[
				0,
				1 / PHI,
				PHI
			],
			[
				-1 / PHI,
				-PHI,
				0
			],
			[
				-1 / PHI,
				PHI,
				0
			],
			[
				1 / PHI,
				-PHI,
				0
			],
			[
				1 / PHI,
				PHI,
				0
			],
			[
				-PHI,
				0,
				-1 / PHI
			],
			[
				PHI,
				0,
				-1 / PHI
			],
			[
				-PHI,
				0,
				1 / PHI
			],
			[
				PHI,
				0,
				1 / PHI
			]
		],
		f: [
			[
				3,
				11,
				7
			],
			[
				3,
				7,
				15
			],
			[
				3,
				15,
				13
			],
			[
				7,
				19,
				17
			],
			[
				7,
				17,
				6
			],
			[
				7,
				6,
				15
			],
			[
				17,
				4,
				8
			],
			[
				17,
				8,
				10
			],
			[
				17,
				10,
				6
			],
			[
				8,
				0,
				16
			],
			[
				8,
				16,
				2
			],
			[
				8,
				2,
				10
			],
			[
				0,
				12,
				1
			],
			[
				0,
				1,
				18
			],
			[
				0,
				18,
				16
			],
			[
				6,
				10,
				2
			],
			[
				6,
				2,
				13
			],
			[
				6,
				13,
				15
			],
			[
				2,
				16,
				18
			],
			[
				2,
				18,
				3
			],
			[
				2,
				3,
				13
			],
			[
				18,
				1,
				9
			],
			[
				18,
				9,
				11
			],
			[
				18,
				11,
				3
			],
			[
				4,
				14,
				12
			],
			[
				4,
				12,
				0
			],
			[
				4,
				0,
				8
			],
			[
				11,
				9,
				5
			],
			[
				11,
				5,
				19
			],
			[
				11,
				19,
				7
			],
			[
				19,
				5,
				14
			],
			[
				19,
				14,
				4
			],
			[
				19,
				4,
				17
			],
			[
				1,
				12,
				14
			],
			[
				1,
				14,
				5
			],
			[
				1,
				5,
				9
			]
		]
	}
};
function polyhedronVerts(kind, detail = 0) {
	const { v, f } = POLY_DATA[kind];
	const b = new Builder();
	const R = .5;
	const norm = (p) => {
		const l = Math.hypot(p[0], p[1], p[2]) || 1;
		return [
			p[0] / l * R,
			p[1] / l * R,
			p[2] / l * R
		];
	};
	const split = (a, c, d, depth) => {
		if (depth <= 0) {
			flatTri(b, [
				0,
				0,
				0
			], a, c, d);
			return;
		}
		const m = (p, q) => norm([
			(p[0] + q[0]) / 2,
			(p[1] + q[1]) / 2,
			(p[2] + q[2]) / 2
		]);
		const ac = m(a, c), cd = m(c, d), da = m(d, a);
		split(a, ac, da, depth - 1);
		split(ac, c, cd, depth - 1);
		split(da, cd, d, depth - 1);
		split(ac, cd, da, depth - 1);
	};
	for (const face of f) split(norm(v[face[0]]), norm(v[face[1]]), norm(v[face[2]]), Math.max(0, Math.min(4, Math.round(detail))));
	return b.build();
}
/**
* Lathe: a 2D profile of [d, y] points (d = distance from the axis,
* authored BOTTOM → TOP) revolved around Y. Auto-fit to the unit box;
* smooth normals from the profile tangents. `arc` sweeps a portion.
* A profile that doesn't reach the axis (end d > 0) is AUTO-SEALED with a
* flat cap to the axis at both ends — no pinholes at the poles.
*/
function latheVerts(points, segs = 32, arc = 1) {
	const b = new Builder();
	let dMax = 1e-9, y0 = Infinity, y1 = -Infinity;
	for (const [d, y] of points) {
		dMax = Math.max(dMax, d);
		y0 = Math.min(y0, y);
		y1 = Math.max(y1, y);
	}
	const s = Math.min(.5 / dMax, 1 / Math.max(y1 - y0, 1e-9));
	const yc = (y0 + y1) / 2;
	const prof = points.map(([d, y]) => [d * s, (y - yc) * s]);
	if (prof[0][0] > 1e-5) prof.unshift([0, prof[0][1]]);
	if (prof[prof.length - 1][0] > 1e-5) prof.push([0, prof[prof.length - 1][1]]);
	const segN = [];
	for (let i = 0; i < prof.length - 1; i++) {
		const dd = prof[i + 1][0] - prof[i][0], dy = prof[i + 1][1] - prof[i][1];
		const l = Math.hypot(dd, dy) || 1;
		segN.push([dy / l, -dd / l]);
	}
	const ptN = prof.map((_, i) => {
		const a = segN[Math.max(0, i - 1)], c = segN[Math.min(segN.length - 1, i)];
		const nx = a[0] + c[0], ny = a[1] + c[1];
		const l = Math.hypot(nx, ny) || 1;
		return [nx / l, ny / l];
	});
	const sweep = Math.min(1, Math.max(.01, arc)) * Math.PI * 2;
	const pt = (i, sg) => {
		const t = sg / segs * sweep;
		const [d, y] = prof[i], [nd, ny] = ptN[i];
		return [
			Math.cos(t) * d,
			y,
			Math.sin(t) * d,
			Math.cos(t) * nd,
			ny,
			Math.sin(t) * nd,
			sg / segs,
			1 - i / (prof.length - 1)
		];
	};
	for (let sg = 0; sg < segs; sg++) for (let i = 0; i < prof.length - 1; i++) b.quad(pt(i, sg), pt(i, sg + 1), pt(i + 1, sg + 1), pt(i + 1, sg));
	return b.build();
}
/** Flat filled shape: a simple 2D outline of [x, z] points triangulated
* (ear clipping — no holes), double-sided in the XZ plane, auto-fit. */
function shapeVerts(outline) {
	const b = new Builder();
	const pts = fit2d(outline);
	for (const [i, j, k] of earClip(pts)) {
		b.triP([
			pts[i][0],
			0,
			pts[i][1],
			0,
			1,
			0
		], [
			pts[j][0],
			0,
			pts[j][1],
			0,
			1,
			0
		], [
			pts[k][0],
			0,
			pts[k][1],
			0,
			1,
			0
		]);
		b.triP([
			pts[i][0],
			0,
			pts[i][1],
			0,
			-1,
			0
		], [
			pts[k][0],
			0,
			pts[k][1],
			0,
			-1,
			0
		], [
			pts[j][0],
			0,
			pts[j][1],
			0,
			-1,
			0
		]);
	}
	return b.build();
}
/**
* Extrusion of a simple 2D outline ([x, z] points, auto-fit) through unit
* height, with an optional rounded bevel where the walls meet the caps.
* `bevel` = bevel size as a fraction of the half-height (0..0.9); the caps
* inset by the bevel (spiky concave outlines want a SMALL bevel — the inset
* is a plain miter offset, not a full polygon offset).
*/
function extrudeVerts(outline, bevel = 0, bevelSegs = 3) {
	const b = new Builder();
	let pts = fit2d(outline);
	if (signedArea(pts) < 0) pts = pts.slice().reverse();
	const n = pts.length;
	const bev = Math.min(.45, Math.max(0, bevel * .5));
	const bs = bev > 0 ? Math.max(1, Math.round(bevelSegs)) : 0;
	const vN = [];
	for (let i = 0; i < n; i++) {
		const p = pts[(i + n - 1) % n], c = pts[i], q = pts[(i + 1) % n];
		const n1 = [c[1] - p[1], -(c[0] - p[0])], n2 = [q[1] - c[1], -(q[0] - c[0])];
		const l1 = Math.hypot(n1[0], n1[1]) || 1, l2 = Math.hypot(n2[0], n2[1]) || 1;
		let nx = n1[0] / l1 + n2[0] / l2, ny = n1[1] / l1 + n2[1] / l2;
		const l = Math.hypot(nx, ny) || 1;
		vN.push([nx / l, ny / l]);
	}
	const ring = (d, y, a, up) => pts.map(([x, z], i) => {
		const [nx, nz] = vN[i];
		const c = Math.cos(a), s = Math.sin(a) * up;
		return [
			x - nx * d,
			y,
			z - nz * d,
			nx * c,
			s,
			nz * c
		];
	});
	const strip = (r0, r1) => {
		for (let i = 0; i < n; i++) {
			const j = (i + 1) % n;
			b.quad(r0[i], r0[j], r1[j], r1[i]);
		}
	};
	const yW = .5 - bev;
	strip(ring(0, -yW, 0, 0), ring(0, yW, 0, 0));
	for (let k = 0; k < bs; k++) {
		const a0 = k / bs * (Math.PI / 2), a1 = (k + 1) / bs * (Math.PI / 2);
		const d = (a) => bev * (1 - Math.cos(a));
		const yT = (a) => yW + bev * Math.sin(a);
		strip(ring(d(a0), yT(a0), a0, 1), ring(d(a1), yT(a1), a1, 1));
		strip(ring(d(a1), -yT(a1), a1, -1), ring(d(a0), -yT(a0), a0, -1));
	}
	const capPts = pts.map(([x, z], i) => [x - vN[i][0] * bev, z - vN[i][1] * bev]);
	for (const [i, j, k] of earClip(capPts)) {
		b.triP([
			capPts[i][0],
			.5,
			capPts[i][1],
			0,
			1,
			0
		], [
			capPts[j][0],
			.5,
			capPts[j][1],
			0,
			1,
			0
		], [
			capPts[k][0],
			.5,
			capPts[k][1],
			0,
			1,
			0
		]);
		b.triP([
			capPts[i][0],
			-.5,
			capPts[i][1],
			0,
			-1,
			0
		], [
			capPts[k][0],
			-.5,
			capPts[k][1],
			0,
			-1,
			0
		], [
			capPts[j][0],
			-.5,
			capPts[j][1],
			0,
			-1,
			0
		]);
	}
	return b.build();
}
//#endregion
export { sphereVerts as _, cubeVerts as a, tubeVerts as b, earClip as c, panelVerts as d, planeVerts as f, shapeVerts as g, roundedBoxVerts as h, coneVerts as i, extrudeVerts as l, ringVerts as m, capsuleVerts as n, cylinderVerts as o, polyhedronVerts as p, circleVerts as r, discVerts as s, Builder as t, latheVerts as u, torusKnotVerts as v, wedgeVerts as x, torusVerts as y };

//# sourceMappingURL=shared-BKm0BaVz.js.map
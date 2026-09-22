// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Triangle-soup builder for custom geometry (procgen packs use this via
 * world.custom). quad()/triP() self-correct winding — nothing ships inside-out. */
export declare class Builder {
    private data;
    /**
     * One triangle from three (pos+normal, optionally +uv) points — 6 or 8
     * components each. WINDING IS SELF-CORRECTING: the pipeline culls back
     * faces expecting CCW-from-outside, so if the triangle's geometric normal
     * disagrees with its vertex normals (wound clockwise), it is flipped here
     * — no generator can ship inside-out. Points without a uv are BOX-PROJECTED
     * from the face's dominant axis (unit-box coords → 0..1).
     */
    triP(a: number[], b: number[], c: number[]): void;
    /** Two triangles for the quad a-b-c-d (counter-clockwise seen from outside). */
    quad(a: number[], b: number[], c: number[], d: number[]): void;
    build(): Float32Array<ArrayBuffer>;
}
/** Unit cube (flat normals) — the workhorse box. `segs` grids each face
 * (visually identical when undeformed; matters under vertex fog/deformers). */
export declare function cubeVerts(segs?: number): Float32Array<ArrayBuffer>;
/** UV sphere, diameter 1, smooth normals, equirect UVs (planet maps wrap). */
export declare function sphereVerts(segs?: number, rings?: number): Float32Array<ArrayBuffer>;
/**
 * Capped cylinder, diameter 1, height 1: smooth side, flat caps. Generalised
 * to a frustum: `rTop`/`rBottom` are each end's radius as a fraction of the
 * unit radius (1 = full 0.5; rTop 0 = a cone). `open` skips the caps and
 * makes the shell DOUBLE-SIDED (an open pipe has a visible inside); a capped
 * `arc` (0..1) portion is SEALED with flat cut walls (a solid wedge).
 */
export declare function cylinderVerts(segs?: number, rTop?: number, rBottom?: number, open?: boolean, arc?: number): Float32Array<ArrayBuffer>;
/** Torus in the XZ plane, outer diameter 1, smooth normals. `arc` (0..1)
 * sweeps a portion of the ring; partial sweeps are SEALED with flat caps at
 * both cut ends (a cut sausage, not a hollow shell). */
export declare function torusVerts(major?: number, minor?: number, segs?: number, sides?: number, arc?: number): Float32Array<ArrayBuffer>;
/**
 * Rounded ("chamfered") unit box: edges and corners bevel smoothly with
 * radius `r` (fraction of the half-extent, 0..0.5). The classic trick: build
 * each face as a grid, clamp each point to the shrunken core box, and push it
 * out along the (smooth) normal from the core — flat mid-faces, curved edges.
 */
export declare function roundedBoxVerts(r?: number, seg?: number): Float32Array<ArrayBuffer>;
/** Capped cone: unit base diameter, unit height, apex up. Smooth sides.
 * `open` skips the base and double-sides the shell (a visible inside);
 * a based `arc` (0..1) portion is sealed with flat cut walls. */
export declare function coneVerts(segs?: number, open?: boolean, arc?: number): Float32Array<ArrayBuffer>;
/** Capsule (pill): total height 1, radius `r` (default 0.25) — scale h for longer pills. */
export declare function capsuleVerts(segs?: number, rings?: number, r?: number): Float32Array<ArrayBuffer>;
/** Wedge (ramp): a unit box halved diagonally — flat floor, vertical back at -x, slope up toward -x. */
export declare function wedgeVerts(): Float32Array<ArrayBuffer>;
/** A double-sided unit quad in the XZ plane (ground sheets, water, cards laid
 * flat). `segs` grids it — essential under deformers/vertex effects, where a
 * 2-triangle plane interpolates everything across one huge diagonal. */
export declare function planeVerts(segs?: number): Float32Array<ArrayBuffer>;
/**
 * Panel: an extruded ROUNDED-CORNER rectangle (unit footprint in XZ, unit
 * thickness in y — scale h thin for cards/plaques). `r` = corner radius as a
 * fraction of the half-extent. Smooth wall normals around the corner arcs
 * via the same clamp-to-core trick as the rounded box.
 */
export declare function panelVerts(r?: number, seg?: number): Float32Array<ArrayBuffer>;
/**
 * Disc: a coin / casino chip / wheel — a cylinder whose rim edges are
 * FILLETED (rounded where the flat faces meet the flat side). Built as a
 * lathe: the 2D profile (face → quarter-round fillet → straight rim →
 * fillet → face) revolved around Y, with exact normals from the profile.
 * Unit diameter × unit height: scale h thin for a chip, roll it upright
 * (pitch/roll ±90°) for a wheel. `fillet` = fraction of the smaller
 * half-extent (0..1).
 */
export declare function discVerts(fillet?: number, segs?: number, filletSegs?: number): Float32Array<ArrayBuffer>;
/**
 * Ear-clipping triangulation of a simple polygon (no holes, no
 * self-intersections). Returns index triples into `pts`. O(n²) — geometry
 * builds once per bucket, so simplicity beats asymptotics here.
 */
export declare function earClip(pts: Array<[number, number]>): Array<[number, number, number]>;
/** Flat disc (or pie slice via `arc` 0..1) in the XZ plane, double-sided, unit diameter. */
export declare function circleVerts(segs?: number, arc?: number): Float32Array<ArrayBuffer>;
/** Flat ring/annulus (or portion via `arc`) in the XZ plane, double-sided.
 * `inner` = inner radius as a fraction of the outer (0..1). */
export declare function ringVerts(inner?: number, segs?: number, arc?: number): Float32Array<ArrayBuffer>;
/** Tube swept along a 3D polyline (auto-fit to the unit box). `r` = tube
 * radius as a fraction of the unit half-extent; `closed` joins the ends. */
export declare function tubeVerts(path: number[][], r?: number, sides?: number, closed?: boolean): Float32Array<ArrayBuffer>;
/** Torus knot (p, q winding) as a closed tube, fit to the unit box. */
export declare function torusKnotVerts(p?: number, q?: number, segs?: number, sides?: number, tube?: number): Float32Array<ArrayBuffer>;
export declare function polyhedronVerts(kind: 'tetrahedron' | 'octahedron' | 'icosahedron' | 'dodecahedron', detail?: number): Float32Array<ArrayBuffer>;
/**
 * Lathe: a 2D profile of [d, y] points (d = distance from the axis,
 * authored BOTTOM → TOP) revolved around Y. Auto-fit to the unit box;
 * smooth normals from the profile tangents. `arc` sweeps a portion.
 * A profile that doesn't reach the axis (end d > 0) is AUTO-SEALED with a
 * flat cap to the axis at both ends — no pinholes at the poles.
 */
export declare function latheVerts(points: Array<[number, number]>, segs?: number, arc?: number): Float32Array<ArrayBuffer>;
/** Flat filled shape: a simple 2D outline of [x, z] points triangulated
 * (ear clipping — no holes), double-sided in the XZ plane, auto-fit. */
export declare function shapeVerts(outline: Array<[number, number]>): Float32Array<ArrayBuffer>;
/**
 * Extrusion of a simple 2D outline ([x, z] points, auto-fit) through unit
 * height, with an optional rounded bevel where the walls meet the caps.
 * `bevel` = bevel size as a fraction of the half-height (0..0.9); the caps
 * inset by the bevel (spiky concave outlines want a SMALL bevel — the inset
 * is a plain miter offset, not a full polygon offset).
 */
export declare function extrudeVerts(outline: Array<[number, number]>, bevel?: number, bevelSegs?: number): Float32Array<ArrayBuffer>;
export declare const GEOMETRY_STRIDE = 8;

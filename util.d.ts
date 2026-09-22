// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** A 2D vector / point — `{ x, y }`. Shared shape for position, velocity,
 *  size, offset, pivot, and any other paired coordinate (x,y) in the engine. */
export interface Vec2 {
    /** Horizontal component. */
    x: number;
    /** Vertical component. */
    y: number;
}
/** A grid cell coordinate — `{ col, row }`. Shared vocabulary for the 2D grid
 *  components (`Maze`, `FlowGrid`): column (x) and row (y) integer indices. */
export interface Cell {
    /** Column index (x, 0-based). */
    col: number;
    /** Row index (y, 0-based). */
    row: number;
}
/**
 * Remap / scale `value` from input range `[istart, istop]` to output range
 * `[ostart, ostop]`. Equivalent to `map` / `lerp-range` in other libs.
 * @param value The value to remap.
 * @param istart Input range start.
 * @param istop Input range end.
 * @param ostart Output range start.
 * @param ostop Output range end.
 */
export declare function mapRange(value: number, istart: number, istop: number, ostart: number, ostop: number): number;
/**
 * Clamp / limit `value` to `[min, max]` (inclusive).
 * Equivalent to `clamp` in other math libraries.
 */
export declare function limit(value: number, min: number, max: number): number;
/**
 * Round `value` to `precision` decimal places (default 0 = nearest integer).
 */
export declare function roundTo(value: number, precision?: number): number;
/**
 * Truncate `value` toward zero — fast integer conversion via bitwise OR 0.
 * Use instead of `Math.floor` when the value is always positive.
 */
export declare function toInt(value: number): number;
/**
 * Convert degrees to radians. Inverse of `toDeg`.
 * @param degrees Angle in degrees.
 */
export declare function toRad(degrees: number): number;
/**
 * Convert radians to degrees. Inverse of `toRad`.
 * @param radians Angle in radians.
 */
export declare function toDeg(radians: number): number;
/**
 * Remove every occurrence of `item` from `array` in place.
 * Mutates the array and returns it. Equivalent to `Array.erase` / `remove-all`.
 */
export declare function eraseFrom<T>(array: T[], item: T): T[];
/**
 * Return a random element from `array` (uniform distribution).
 * Equivalent to `random pick` / `choose` / `sample`.
 */
export declare function randomItem<T>(array: T[]): T;
/**
 * Deep-merge `source` into `target` in place and return `target`.
 * Nested plain objects are merged recursively; arrays, DOM nodes, and
 * primitives are assigned directly. Used to apply partial sprite settings.
 */
export declare function merge<T extends object>(target: T, source: Partial<T> | object): T;
/**
 * Create a seeded uniform-`[0, 1)` pseudo-random generator (mulberry32).
 *
 * The same `seed` always yields the same sequence — the determinism backbone
 * for reproducible procedural content (formations, level layouts, particle
 * jitter). Pure integer math with `>>> 0` at every step keeps the stream
 * byte-identical across platforms, so headless verification never drifts.
 *
 * Pair with {@link hashCode} to turn a human-readable level code into a seed.
 * Use one ordered stream consumed in a fixed order; never branch the draw order
 * on anything non-deterministic (frame time, live input) or the stream desyncs.
 *
 * @param seed Any 32-bit-coercible number; the same seed reproduces the sequence.
 * @returns A function returning the next float in `[0, 1)` on each call.
 * @example
 * const rng = makeRng(hashCode('GLX.3'));
 * const x = rng(); // deterministic for that level code
 */
export declare function makeRng(seed: number): () => number;
/**
 * Hash a string to a uint32 via FNV-1a — a stable, fast string→seed mapping.
 *
 * The same string always hashes to the same number, forever, so a level code
 * like `"GLX.3"` becomes a reproducible seed for {@link makeRng}.
 *
 * @param s The string to hash (e.g. a level code).
 * @returns An unsigned 32-bit integer hash.
 */
export declare function hashCode(s: string): number;

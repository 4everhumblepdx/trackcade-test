// Docs: engine/webgpu/vector.md — usage, recipes & traps (this file = exact type signatures)
/** A `'#rrggbb'` hex colour string — the format every v2 draw verb accepts. */
export type Hex = string;
/** Saturation/value tuning shared by the wheel-based generators. */
export interface ColorOptions {
    /** Colour saturation 0 (grey) → 1 (vivid). Default 1. */
    saturation?: number;
    /** Colour brightness 0 (black) → 1 (bright). Default 1. */
    value?: number;
}
/**
 * Convert an HSV colour to a `'#rrggbb'` hex string. `h` is a hue angle in
 * degrees (0/360 = red, 120 = green, 240 = blue; wraps). `s` and `v` are 0→1
 * and default to 1. The foundation of every other generator here.
 */
export declare function hsv(h: number, s?: number, v?: number): Hex;
/**
 * Interpolate / blend two hex colours in RGB space. `t` = 0 returns `a`,
 * `t` = 1 returns `b`.
 */
export declare function lerp(a: Hex, b: Hex, t: number): Hex;
/**
 * Rotate a colour's hue by `degrees` around the HSV wheel, preserving its
 * saturation and brightness. `shift('#ff0000', 120)` turns red into green.
 */
export declare function shift(hex: Hex, degrees: number): Hex;
/** A reusable HSV colour wheel sampled by hue angle or normalised position. */
export interface Wheel {
    readonly saturation: number;
    readonly value: number;
    /** Colour at a hue angle in degrees (wraps). */
    hue(degrees: number): Hex;
    /** Colour at normalised position `t` (0→1) around the full 360° wheel. */
    at(t: number): Hex;
    /** `count` evenly-spaced colours spanning `t0`→`t1` (0→1). Defaults to the full wheel. */
    colors(count: number, t0?: number, t1?: number): Hex[];
}
/**
 * Build a reusable colour wheel at a fixed saturation and value. Sample it
 * with `w.hue(210)`, `w.at(0.5)`, `w.colors(8)`.
 */
export declare function wheel(opts?: ColorOptions): Wheel;
/**
 * `count` colours evenly spaced around the full HSV wheel. Loops seamlessly
 * (first and last are not duplicated).
 */
export declare function rainbow(count: number, opts?: ColorOptions): Hex[];
/**
 * A hue ramp — `count` colours stepping from `fromHue` to `toHue` (degrees),
 * both endpoints inclusive. A slice of the rainbow, close together.
 */
export declare function ramp(fromHue: number, toHue: number, count: number, opts?: ColorOptions): Hex[];
/**
 * A gradient — `count` colours blending smoothly between two arbitrary hex
 * colours in RGB space, both endpoints inclusive.
 */
export declare function gradient(from: Hex, to: Hex, count: number): Hex[];

// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import type { TweenState, Easing } from './types.js';
/**
 * Compute the midpoint of two Objects.  This method effectively calculates a
 * specific frame of animation that {@link Tweenable#tween} does many times
 * over the course of a full tween.
 *
 * ```
 * import { interpolate } from 'shifty';
 *
 * const interpolatedValues = interpolate({
 *     width: '100px',
 *     opacity: 0,
 *     color: '#fff'
 *   }, {
 *     width: '200px',
 *     opacity: 1,
 *     color: '#000'
 *   },
 *   0.5
 * );
 *
 * console.log(interpolatedValues); // Logs: {opacity: 0.5, width: "150px", color: "rgb(127,127,127)"}
 * ```
 */
export declare const interpolate: <T extends TweenState>(
/**
 * The starting values to tween from.
 */
from: T, 
/**
 * The ending values to tween to.
 */
to: T, 
/**
 * The normalized position value (between `0.0` and `1.0`) to interpolate the
 * values between `from` and `to` for.  `from` represents `0` and `to`
 * represents `1`.
 */
position: number, 
/**
 * The easing curve(s) to calculate the midpoint against.  You can reference
 * any easing function attached to {@link Tweenable.easing}, or provide the
 * {@link EasingFunction}(s) directly.
 */
easing?: Easing, 
/**
 * Optional delay to pad the beginning of the interpolated tween with.  This
 * increases the range of `position` from (`0` through `1`) to (`0` through
 * `1 + delay`).  So, a delay of `0.5` would increase all valid values of
 * `position` to numbers between `0` and `1.5`.
 */
delay?: number) => T;

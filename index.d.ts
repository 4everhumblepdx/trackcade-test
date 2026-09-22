// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Tween / motion / animation system. The Game owns one as `this.tween`. Animate / ease / interpolate any numeric or colour-string property with `this.tween.to(sprite, { x: 200 })`. Driven by the game clock — tweens freeze automatically when the game pauses. */
import { interpolate as shiftyInterpolate } from './shifty/index.js';
import type { TweenState } from './shifty/index.js';
/** An easing curve: a named standard curve (e.g. `'easeOutBounce'`), a short alias (`'bounce'`/`'quad'`/`'linear'`), a custom `(pos) => value` function, or a CSS cubic-bezier `[x1,y1,x2,y2]` array. See `EASING` for all accepted names. */
export type Ease = string | ((pos: number) => number) | number[];
/** All easing curve names accepted by `TweenOptions.ease` — standard shifty curves plus the short aliases. */
export declare const EASING: string[];
/** Options for `tween.to / from / fromTo`. All fields are optional. */
export interface TweenOptions<T = object> {
    /** Duration in seconds. Default 0.5. */
    duration?: number;
    /** Easing curve name, function, or cubic-bezier array. Default `'easeInOutQuad'`. See `Ease` / `EASING`. */
    ease?: Ease;
    /** Delay in seconds before the animation starts. Default 0. */
    delay?: number;
    /** Called once when the tween begins (after any delay). */
    onStart?: (target: T) => void;
    /** Called every frame with the mutated target and progress 0→1 through the current run. */
    onUpdate?: (target: T, progress: number) => void;
    /** Called once when the tween (and all loops) finish. */
    onComplete?: (target: T) => void;
    /** Repeat the tween: `true` = loop forever, a number = that many additional repeats. Default none. */
    loop?: boolean | number;
    /** With `loop` — reverse direction on each repeat (ping-pong / yo-yo). */
    yoyo?: boolean;
}
/**
 * A running tween handle. Returned by `tween.to` / `tween.from` / `tween.fromTo`. Supports `pause`, `resume`, `stop`, `seek`, and `await` (resolves when the tween finishes; never resolves for infinite loops).
 */
export declare class TweenHandle {
    private readonly _owner;
    private _tw;
    private _target;
    private _from;
    private _to;
    private _opts;
    private _loopsLeft;
    private _yoyo;
    private _done;
    private _started;
    private _progress;
    private _resolve;
    private _promise;
    /** @ignore — construct via `tween.to / from / fromTo`, not directly. */
    constructor(owner: Tween, target: object, from: TweenState, to: TweenState, opts: TweenOptions);
    private _run;
    private _onFinish;
    /** Pause this tween. Resume with `resume()`. */
    pause(): this;
    /** Resume this tween from where `pause()` left it. */
    resume(): this;
    /** Stop this tween immediately. Pass `jumpToEnd = true` to snap the target to its end values first. Cancels any remaining loop repeats. */
    stop(jumpToEnd?: boolean): this;
    /** Jump the tween's playhead to `seconds` from its start (scrub / seek). */
    seek(seconds: number): this;
    /** `true` while the tween is advancing (not paused, not finished). */
    get isPlaying(): boolean;
    /** `true` once the tween (and all loop repeats) have finished. */
    get isDone(): boolean;
    /** Normalised progress through the current run, 0→1. Poll this instead of tracking elapsed time yourself. */
    get progress(): number;
    /** Makes the handle thenable — `await handle` resolves when the tween finishes. Never resolves for infinite loops. */
    then<R = void>(onFulfilled?: (() => R | PromiseLike<R>) | null, onRejected?: ((reason: unknown) => R | PromiseLike<R>) | null): Promise<R>;
}
/** A batch handle over several `TweenHandle` instances — pause, resume, stop, or await all of them together. Returned by `tween.group(...)`. */
export interface TweenGroup {
    /** Pause all handles in the group. */
    pause(): void;
    /** Resume all handles in the group. */
    resume(): void;
    /** Stop all handles in the group. Pass `true` to jump each to its end values. */
    stop(jumpToEnd?: boolean): void;
    /** Resolves when every handle in the group has finished. */
    then<R = void>(onFulfilled?: () => R | PromiseLike<R>): Promise<R>;
}
/**
 * The motion / animation / tween system. The Game owns one as `this.tween` (accessed on any scene as `this.tween`). The Game advances it every frame — call `this.tween.to(sprite, { x: 200 })` and the rest is automatic.
 */
export declare class Tween {
    private clockMs;
    private _paused;
    constructor();
    /** Animate `target`'s properties FROM their current values TO `props`. The most common tween call — e.g. `tween.to(sprite, { x: 200, alpha: 0 }, { duration: 0.4 })`. */
    to<T extends object>(target: T, props: Partial<Record<keyof T & string, number | string>>, opts?: TweenOptions<T>): TweenHandle;
    /** Animate `target`'s properties FROM `props` TO their current values — use to animate / slide / fade something in from a starting position. */
    from<T extends object>(target: T, props: Partial<Record<keyof T & string, number | string>>, opts?: TweenOptions<T>): TweenHandle;
    /** Animate `target`'s properties from `fromProps` to `toProps` with full explicit control over both endpoints. */
    fromTo<T extends object>(target: T, fromProps: Partial<Record<keyof T & string, number | string>>, toProps: Partial<Record<keyof T & string, number | string>>, opts?: TweenOptions<T>): TweenHandle;
    /**
     * Run tween steps one after another in a chain — each step starts when the previous one finishes. Each element is a function that returns a `TweenHandle` or any `Promise`. Returns a promise that resolves when the whole sequence is done.
     */
    sequence(steps: Array<() => TweenHandle | Promise<unknown> | void>): Promise<void>;
    /** Group several `TweenHandle` instances for unified pause/resume/stop/await. */
    group(...handles: TweenHandle[]): TweenGroup;
    /**
     * Compute a one-off interpolated / lerped snapshot (no animation, no handle). Works on numbers and colour strings: `tween.interpolate({ v: 0 }, { v: 10 }, 0.5).v === 5`.
     */
    interpolate: typeof shiftyInterpolate;
    /** All easing curve names accepted by `TweenOptions.ease`. */
    get EASING(): string[];
    /** Advance the clock by `deltaSeconds` and step all active tweens. Called automatically by the Game loop — do not call this yourself. */
    update(deltaSeconds: number): void;
    /** Freeze every active tween WITHOUT stopping the game loop — use when displaying a pause overlay. */
    pauseAll(): void;
    /** Unfreeze every tween after `pauseAll()`. */
    resumeAll(): void;
    /** Alias of `pauseAll()` — the hook a state machine's suspend calls. */
    pause(): void;
    /** Alias of `resumeAll()`. */
    resume(): void;
    /** Stop every active tween (e.g. on a level reset). Pass `true` to snap each tween to its end values. */
    stopAll(jumpToEnd?: boolean): void;
    /** Number of currently active (running or paused) tweens. */
    get count(): number;
    /** `true` when the whole system is frozen by `pauseAll()`. */
    get isPaused(): boolean;
    /** Stop all tweens and tear down the system. Called automatically by `Game.destroy()`. */
    destroy(): void;
}

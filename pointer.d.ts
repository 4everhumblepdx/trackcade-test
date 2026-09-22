// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Unified mouse + touch (multi-touch) pointer model with gesture recognition: tap, doubleTap, longPress, pan, swipe, pointerDown/Up/Move. All coordinates are in world space. */
/** A single tracked input point — one mouse cursor or one touch finger. */
export interface Pointer {
    /** Stable id — `'mouse'` for the mouse, the touch's DOM `identifier` (as string) for touches. */
    id: string;
    /** Current position in world coordinates (the W,H you pass to `main`). */
    x: number;
    /** Current position in world coordinates. */
    y: number;
    /** Position when the pointer last went down (world coords). */
    startX: number;
    /** Position when the pointer last went down (world coords). */
    startY: number;
    /** Movement since the previous frame in world px (zero between frames). */
    dx: number;
    /** Movement since the previous frame in world px (zero between frames). */
    dy: number;
    /** Instantaneous velocity in world-px / second, computed over the last ~80 ms of motion. Zero between presses and reset to zero on each pointer-down. Read this at release to throw a sprite at the speed the player let go (no need to hit any swipe threshold). */
    vx: number;
    /** See `vx`. */
    vy: number;
    /** `true` while the pointer is pressed (mouse button held / finger on screen). */
    isDown: boolean;
    /** `performance.now()` at the last false→true transition of `isDown`. */
    downTime: number;
    /** `true` if this pointer comes from a TouchEvent, `false` if from a MouseEvent. Both behave the same in game code. */
    isTouch: boolean;
}
/** Base payload for every gesture event callback. */
export interface PointerEventBase {
    /** The pointer that triggered this gesture. */
    pointer: Pointer;
    /** World x-coordinate of the gesture. */
    x: number;
    /** World y-coordinate of the gesture. */
    y: number;
}
/** Payload for `onTap` — a quick down+up with no drag. */
export interface TapEvent extends PointerEventBase {
    /** Milliseconds between pointer-down and pointer-up. */
    duration: number;
}
/** Payload for `onDoubleTap` — two taps within `doubleTapDelay` in the same area. */
export interface DoubleTapEvent extends PointerEventBase {
    /** Milliseconds between the two taps. */
    interval: number;
}
/** Payload for `onLongPress` — pointer held stationary for `longPressDelay` ms. */
export interface LongPressEvent extends PointerEventBase {
    /** Milliseconds the pointer was held before the long-press fired. */
    duration: number;
}
/** Payload for `onPan` — fired continuously while a pressed pointer moves beyond `panThreshold`. */
export interface PanEvent extends PointerEventBase {
    /** Total movement since pointer-down (world px). */
    totalDx: number;
    /** Total movement since pointer-down (world px). */
    totalDy: number;
    /** Movement since the last pan frame (world px). */
    dx: number;
    /** Movement since the last pan frame (world px). */
    dy: number;
}
/** The dominant direction axis of a swipe gesture. */
export type SwipeDirection = 'up' | 'down' | 'left' | 'right';
/** Payload for `onSwipe` — a fast directional release exceeding `swipeMinDistance` and `swipeMinVelocity`. */
export interface SwipeEvent extends PointerEventBase {
    /** Dominant axis of the release (`'left'`, `'right'`, `'up'`, or `'down'`). */
    direction: SwipeDirection;
    /** Release velocity in world px / second. */
    velocity: number;
    /** Total distance from pointer-down to pointer-up (world px). */
    distance: number;
    /** Swipe angle in radians — `atan2(dy, dx)`. 0 = right, π/2 = down. */
    angle: number;
}
/** Handler for tap (click / single-touch) events. Return `false` to stop propagation to lower handlers. */
export type TapHandler = (e: TapEvent) => boolean | void;
/** Handler for double-tap events. Return `false` to stop propagation to lower handlers. */
export type DoubleTapHandler = (e: DoubleTapEvent) => boolean | void;
/** Handler for long-press (press-and-hold) events. Return `false` to stop propagation. */
export type LongPressHandler = (e: LongPressEvent) => boolean | void;
/** Handler for pan (drag) events. Return `false` to stop propagation. */
export type PanHandler = (e: PanEvent) => boolean | void;
/** Handler for swipe (fast directional flick) events. Return `false` to stop propagation. */
export type SwipeHandler = (e: SwipeEvent) => boolean | void;
/** Handler for raw pointer-down, pointer-up, or pointer-move events. Return `false` to stop propagation. */
export type PointerHandler = (p: Pointer) => boolean | void;
/** Gesture recognition thresholds. Mutate `PointerTracker.options` at runtime to adjust. */
export interface GestureOptions {
    /** Max ms between pointer-down and pointer-up to count as a tap. Default `250`. */
    tapMaxDuration: number;
    /** Max world-px movement during a tap; more than this is treated as a drag. Default `8`. */
    tapTolerance: number;
    /** Max ms between two taps to count as a double-tap. Default `300`. */
    doubleTapDelay: number;
    /** Max world-px between the two tap positions for a double-tap. Default `16`. */
    doubleTapDistance: number;
    /** Ms a stationary pointer must be held before a long-press fires. Default `600`. */
    longPressDelay: number;
    /** Max world-px movement during a long-press hold before it is cancelled. Default `8`. */
    longPressTolerance: number;
    /** Min world-px traveled between pointer-down and pointer-up for a swipe to register. Default `20`. */
    swipeMinDistance: number;
    /** Min velocity in world-px / s at release for a swipe to register. Default `300`. */
    swipeMinVelocity: number;
    /** Min world-px movement during a hold before pan events start firing. Default `4`. */
    panThreshold: number;
}
/**
 * Tracks mouse and multi-touch pointers and runs gesture recognition on top.
 * Attached lazily to the canvas by `Input.initMouse()`; accessed via `game.input.pointerTracker`
 * or the convenience shims on `Input` / `SceneInput`.
 */
export declare class PointerTracker {
    /** The canvas that gesture listeners are attached to. */
    private readonly canvas;
    /**
     * Maps client (CSS-pixel) coordinates to world coordinates. Injected by the Game
     * (Game injects the one screen→world mapping; `input.toWorld()` reads the same one).
     * Defaults to a rect-relative fallback so the tracker still works standalone.
     */
    mapToWorld: (clientX: number, clientY: number) => {
        x: number;
        y: number;
    };
    constructor(canvas?: HTMLCanvasElement | null, mapToWorld?: (clientX: number, clientY: number) => {
        x: number;
        y: number;
    });
    /** Gesture recognition thresholds. Mutate at runtime to change sensitivity. */
    options: GestureOptions;
    /** The primary pointer — mouse if tracked, else the first active touch. `null` when nothing is active. */
    primary: Pointer | null;
    /**
     * Forget every in-flight pointer (scene transitions): cancels pending
     * long-press timers and drops tracked pointers, so a press that started in
     * the OLD scene can't complete a tap/swipe in the new one. The next real
     * pointer event starts fresh.
     */
    reset(): void;
    private tapHandlers;
    private doubleTapHandlers;
    private longPressHandlers;
    private panHandlers;
    private swipeHandlers;
    private downHandlers;
    private upHandlers;
    private moveHandlers;
    /**
     * Subscribe to tap events (quick down+up, no drag). Works for mouse clicks and touch taps.
     * @returns An unsubscribe function.
     */
    onTap(handler: TapHandler): () => void;
    /**
     * Subscribe to double-tap events (two taps within `doubleTapDelay` in the same area).
     * @returns An unsubscribe function.
     */
    onDoubleTap(handler: DoubleTapHandler): () => void;
    /**
     * Subscribe to long-press events (pointer held stationary for `longPressDelay` ms without moving).
     * @returns An unsubscribe function.
     */
    onLongPress(handler: LongPressHandler): () => void;
    /**
     * Subscribe to pan events — fired continuously while a pressed pointer moves beyond `panThreshold`. Use for drag/scroll interactions.
     * @returns An unsubscribe function.
     */
    onPan(handler: PanHandler): () => void;
    /**
     * Subscribe to swipe events (fast directional release: left/right/up/down). Use for swipe-to-dismiss or flick gestures.
     * @returns An unsubscribe function.
     */
    onSwipe(handler: SwipeHandler): () => void;
    /**
     * Subscribe to raw pointer-down events (mouse button pressed or finger touched the canvas).
     * @returns An unsubscribe function.
     */
    onPointerDown(handler: PointerHandler): () => void;
    /**
     * Subscribe to raw pointer-up events (mouse button released or finger lifted).
     * @returns An unsubscribe function.
     */
    onPointerUp(handler: PointerHandler): () => void;
    /**
     * Subscribe to raw pointer-move events (mouse moved or touch dragged). Fires each frame the pointer position changes, including hover (mouse only).
     * @returns An unsubscribe function.
     */
    onPointerMove(handler: PointerHandler): () => void;
    /** All currently active pointers (mouse + every touch finger on screen). */
    get pointers(): Pointer[];
    /** `true` if any pointer currently has a button/finger pressed. */
    get isAnyDown(): boolean;
    /** Attach canvas and window DOM listeners. Idempotent — safe to call multiple times. Called automatically by `Input.initMouse()`. */
    attach(): void;
    /**
     * Remove all canvas and window listeners attached by `attach()`, clear tracked pointers,
     * and restore the canvas `touch-action`. Safe to call when never attached.
     */
    detach(): void;
    /** Zero the per-frame `dx`/`dy` on every tracked pointer. Called by `Input.clearPressed()` at end of each game tick. */
    flushFrame(): void;
    private onMouseDown;
    private onMouseUp;
    private onMouseMove;
    private isInsideCanvas;
    private onTouchStart;
    private onTouchMove;
    private onTouchEnd;
    private toWorld;
    /**
     * Inject a synthetic pointer-down event. Used internally by DOM handlers and externally for
     * headless tests or programmatic gesture replay.
     * @param id Pointer id (`'mouse'` or a touch identifier string).
     * @param x World x-coordinate.
     * @param y World y-coordinate.
     * @param isTouch `true` for touch events, `false` for mouse.
     */
    pointerDown(id: string, x: number, y: number, isTouch?: boolean): void;
    /**
     * Inject a synthetic pointer-move event. Hover-only moves for `'mouse'` (no button pressed)
     * create a hovering pointer so `onPointerMove` fires even before a click. Touch ids without
     * a prior `pointerDown` are ignored.
     * @param id Pointer id.
     * @param x World x-coordinate.
     * @param y World y-coordinate.
     * @param isTouch `true` for touch events.
     */
    pointerMove(id: string, x: number, y: number, isTouch?: boolean): void;
    /**
     * Inject a synthetic pointer-up event. Triggers tap / double-tap / swipe detection,
     * then fires the raw pointer-up handlers. Used internally by DOM handlers and for
     * headless tests.
     * @param id Pointer id.
     * @param x World x-coordinate at release.
     * @param y World y-coordinate at release.
     */
    pointerUp(id: string, x: number, y: number): void;
    private recomputePrimary;
    private fire;
}
/**
 * Returns `true` if world point `(px, py)` is inside the visible rectangle of a sprite.
 * Used by the gesture dispatch in `SceneInput` to determine which sprite captured a pointer.
 * v2: raster's scale/angle/pivot/`shape: 'circle'`/animation-sheet sizing not ported yet —
 * v2 sprites are plain AABBs (top-left `x`/`y` + `w`/`h` in world units).
 */
export declare function spriteContainsPoint(sprite: {
    x: number;
    y: number;
    w: number;
    h: number;
}, px: number, py: number): boolean;

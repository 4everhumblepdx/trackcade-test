// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Scene-level typed input facade: keyboard bindings with typed key-state accessors, and pointer/gesture dispatch routed to sprites. Accessed as `this.input` inside a Scene. */
import type { Sprite } from './sprite.js';
import type { Pointer, TapEvent, DoubleTapEvent, LongPressEvent, PanEvent, SwipeEvent, TapHandler, DoubleTapHandler, LongPressHandler, PanHandler, SwipeHandler, PointerHandler } from './pointer.js';
/**
 * Per-action keyboard state. All three fields are live getters — read them every frame without caching.
 * Obtained from `this.input.bind({ ... })` or `this.scene.input.keys.<name>`.
 */
export interface KeyState {
    /** `true` while one or more keys bound to this action are currently held (key down). */
    readonly held: boolean;
    /** `true` on the single frame this action was first pressed (down edge). */
    readonly pressed: boolean;
    /** `true` on the single frame this action was released (up edge). */
    readonly released: boolean;
}
/**
 * A Sprite viewed through the gesture dispatcher. v2: the Sprite class has no built-in
 * gesture-handler fields (raster's live on Sprite itself) — game code assigns them ad hoc,
 * so this type describes the optional handlers the dispatcher reads off a sprite.
 * Set any of the `on*` fields on a sprite and `SceneInput.attach()` routes gestures to it.
 */
export interface InteractiveSprite extends Sprite {
    /** Per-sprite tap handler (quick down + up on this sprite). */
    onTap?: (e: TapEvent) => void;
    /** Per-sprite double-tap handler. */
    onDoubleTap?: (e: DoubleTapEvent) => void;
    /** Per-sprite long-press handler. */
    onLongPress?: (e: LongPressEvent) => void;
    /** Per-sprite pan (drag) handler — its presence also suppresses onSwipe at release. */
    onPan?: (e: PanEvent) => void;
    /** Per-sprite swipe handler. */
    onSwipe?: (e: SwipeEvent) => void;
    /** Per-sprite raw pointer-down handler (fires when this sprite captures the pointer). */
    onPointerDown?: (p: Pointer) => void;
    /** Per-sprite raw pointer-up handler (fires on the sprite that captured the pointer). */
    onPointerUp?: (p: Pointer) => void;
    /** Fires once when a pointer enters this sprite's rect. */
    onPointerOver?: (p: Pointer) => void;
    /** Fires once when a pointer leaves this sprite's rect. */
    onPointerOut?: (p: Pointer) => void;
    /** Current hover state, maintained by the dispatcher. */
    isPointerOver?: boolean;
}
/**
 * Scene-level input facade. Wraps the game's `Input` service with typed key-state objects
 * and sprite-targeted gesture dispatch. Accessed as `this.input` inside a scene's `setup()` and `update()`.
 */
export declare class SceneInput {
    private readonly scene;
    /**
     * True while any of the given KEY CODES is held: `this.input.key('Space')`.
     * The no-setup path — for remappable or many-key controls use `bind()` and
     * read the returned states instead. Both respect the transition grace.
     */
    key(...codes: string[]): boolean;
    /** True only on the frame any of the given key codes went DOWN (edge, not held). */
    keyPressed(...codes: string[]): boolean;
    /**
     * Map a RAW DOM pointer event to world coordinates — the escape hatch for
     * your own `canvas.addEventListener`. Gestures and `pointer` already carry
     * world coordinates, so you rarely need this.
     */
    toWorld(e: {
        clientX: number;
        clientY: number;
    }): {
        x: number;
        y: number;
    };
    /**
     * Named key states, populated by `bind()`. Entities can read
     * `this.scene.input.keys.<name>.held` / `.pressed` / `.released` directly.
     */
    readonly keys: Record<string, KeyState>;
    /**
     * Bind a map of action names to key-code arrays and return typed key-state accessors.
     * Calls `game.input.bind()` for each entry; subsequent calls for the same names add more keys.
     * @example
     * const keys = this.input.bind({ left: ['ArrowLeft', 'KeyA'], jump: ['Space'] });
     * if (keys.jump.pressed) player.jump();
     * if (keys.left.held) player.x -= speed * dt;
     */
    bind<T extends Record<string, readonly string[]>>(map: T): {
        [K in keyof T]: KeyState;
    };
    /** The primary pointer (mouse, or the first active touch finger). `null` when nothing is active. */
    get pointer(): Pointer | null;
    /** Every currently active pointer — multi-touch returns one entry per finger. */
    get pointers(): Pointer[];
    /**
     * Subscribe to scene-wide tap events (quick click or touch-tap anywhere on the canvas).
     * For per-sprite taps set `sprite.onTap = fn` instead.
     * Automatically removed when the scene is replaced by a transition.
     * @returns An unsubscribe function.
     */
    onTap(fn: TapHandler): () => void;
    /**
     * Subscribe to scene-wide double-tap events.
     * Automatically removed when the scene is replaced by a transition.
     * @returns An unsubscribe function.
     */
    onDoubleTap(fn: DoubleTapHandler): () => void;
    /**
     * Subscribe to scene-wide long-press events (pointer held stationary for `longPressDelay` ms).
     * Automatically removed when the scene is replaced by a transition.
     * @returns An unsubscribe function.
     */
    onLongPress(fn: LongPressHandler): () => void;
    /**
     * Subscribe to scene-wide pan events (continuous drag). Fires every frame the pointer moves while pressed.
     * Automatically removed when the scene is replaced by a transition.
     * @returns An unsubscribe function.
     */
    onPan(fn: PanHandler): () => void;
    /**
     * Subscribe to scene-wide swipe events (fast directional flick: left/right/up/down).
     * Automatically removed when the scene is replaced by a transition.
     * @returns An unsubscribe function.
     */
    onSwipe(fn: SwipeHandler): () => void;
    /**
     * Subscribe to text input — typed characters (Shift/layout-resolved), one per keypress,
     * repeating while held. Control keys (Backspace, Enter, …) are not delivered; handle those
     * with `bind()`. Use for an in-canvas text field such as a high-score name. See `Input.onText`.
     * Automatically removed when the scene is replaced by a transition.
     * @returns An unsubscribe function.
     */
    onText(fn: (char: string) => void): () => void;
    /**
     * Subscribe to scene-wide raw pointer-down events (mouse button press or touch start).
     * Automatically removed when the scene is replaced by a transition.
     * @returns An unsubscribe function.
     */
    onPointerDown(fn: PointerHandler): () => void;
    /**
     * Subscribe to scene-wide raw pointer-up events (mouse button release or touch end).
     * Automatically removed when the scene is replaced by a transition.
     * @returns An unsubscribe function.
     */
    onPointerUp(fn: PointerHandler): () => void;
    /**
     * Subscribe to scene-wide raw pointer-move events (mouse move or touch drag, including hover).
     * Automatically removed when the scene is replaced by a transition.
     * @returns An unsubscribe function.
     */
    onPointerMove(fn: PointerHandler): () => void;
}

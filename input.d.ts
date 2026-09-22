// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Maps physical keys, mouse buttons, and wheel ticks to named actions; exposes polled held/pressed/released state per action. */
import { PointerTracker, type Pointer } from './pointer.js';
/**
 * Physical-key code constants. Values are `KeyboardEvent.code` strings (layout-independent)
 * plus virtual `'Mouse1'`/`'Mouse2'`/`'Mouse3'` and `'MWheelUp'`/`'MWheelDown'`.
 * Use `KEY.LEFT_ARROW` instead of `'ArrowLeft'` for readability; raw strings are equally valid.
 */
export declare const KEY: {
    /** Left mouse button. */
    readonly MOUSE1: 'Mouse1';
    /** Right mouse button. */
    readonly MOUSE2: 'Mouse2';
    /** Middle mouse button. */
    readonly MOUSE3: 'Mouse3';
    /** Mouse wheel scrolled up (one-frame tap). */
    readonly MWHEEL_UP: 'MWheelUp';
    /** Mouse wheel scrolled down (one-frame tap). */
    readonly MWHEEL_DOWN: 'MWheelDown';
    /** Left arrow key. */
    readonly LEFT_ARROW: 'ArrowLeft';
    /** Right arrow key. */
    readonly RIGHT_ARROW: 'ArrowRight';
    /** Up arrow key. */
    readonly UP_ARROW: 'ArrowUp';
    /** Down arrow key. */
    readonly DOWN_ARROW: 'ArrowDown';
    /** Space bar. */
    readonly SPACE: 'Space';
    /** Enter / Return key. */
    readonly ENTER: 'Enter';
    /** Tab key. */
    readonly TAB: 'Tab';
    /** Escape key. */
    readonly ESC: 'Escape';
    /** Backspace key. */
    readonly BACKSPACE: 'Backspace';
    /** Delete key. */
    readonly DELETE: 'Delete';
    /** Insert key. */
    readonly INSERT: 'Insert';
    /** Left Shift key. */
    readonly SHIFT: 'ShiftLeft';
    /** Right Shift key. */
    readonly SHIFT_RIGHT: 'ShiftRight';
    /** Left Control key. */
    readonly CTRL: 'ControlLeft';
    /** Right Control key. */
    readonly CTRL_RIGHT: 'ControlRight';
    /** Left Alt key. */
    readonly ALT: 'AltLeft';
    /** Right Alt key. */
    readonly ALT_RIGHT: 'AltRight';
    /** Left Meta (Cmd / Windows) key. */
    readonly META: 'MetaLeft';
    /** Right Meta key. */
    readonly META_RIGHT: 'MetaRight';
    /** Caps Lock key. */
    readonly CAPS: 'CapsLock';
    /** Page Up key. */
    readonly PAGE_UP: 'PageUp';
    /** Page Down key. */
    readonly PAGE_DOWN: 'PageDown';
    /** Home key. */
    readonly HOME: 'Home';
    /** End key. */
    readonly END: 'End';
    /** Pause / Break key. */
    readonly PAUSE: 'Pause';
    /** Top-row digit 0. */
    readonly _0: 'Digit0';
    /** Top-row digit 1. */
    readonly _1: 'Digit1';
    /** Top-row digit 2. */
    readonly _2: 'Digit2';
    /** Top-row digit 3. */
    readonly _3: 'Digit3';
    /** Top-row digit 4. */
    readonly _4: 'Digit4';
    /** Top-row digit 5. */
    readonly _5: 'Digit5';
    /** Top-row digit 6. */
    readonly _6: 'Digit6';
    /** Top-row digit 7. */
    readonly _7: 'Digit7';
    /** Top-row digit 8. */
    readonly _8: 'Digit8';
    /** Top-row digit 9. */
    readonly _9: 'Digit9';
    /** Physical A key (layout-independent). */
    readonly A: 'KeyA';
    /** Physical B key. */
    readonly B: 'KeyB';
    /** Physical C key. */
    readonly C: 'KeyC';
    /** Physical D key. */
    readonly D: 'KeyD';
    /** Physical E key. */
    readonly E: 'KeyE';
    /** Physical F key. */
    readonly F: 'KeyF';
    /** Physical G key. */
    readonly G: 'KeyG';
    /** Physical H key. */
    readonly H: 'KeyH';
    /** Physical I key. */
    readonly I: 'KeyI';
    /** Physical J key. */
    readonly J: 'KeyJ';
    /** Physical K key. */
    readonly K: 'KeyK';
    /** Physical L key. */
    readonly L: 'KeyL';
    /** Physical M key. */
    readonly M: 'KeyM';
    /** Physical N key. */
    readonly N: 'KeyN';
    /** Physical O key. */
    readonly O: 'KeyO';
    /** Physical P key. */
    readonly P: 'KeyP';
    /** Physical Q key. */
    readonly Q: 'KeyQ';
    /** Physical R key. */
    readonly R: 'KeyR';
    /** Physical S key. */
    readonly S: 'KeyS';
    /** Physical T key. */
    readonly T: 'KeyT';
    /** Physical U key. */
    readonly U: 'KeyU';
    /** Physical V key. */
    readonly V: 'KeyV';
    /** Physical W key. */
    readonly W: 'KeyW';
    /** Physical X key. */
    readonly X: 'KeyX';
    /** Physical Y key. */
    readonly Y: 'KeyY';
    /** Physical Z key. */
    readonly Z: 'KeyZ';
    /** Numpad 0. */
    readonly NUMPAD_0: 'Numpad0';
    /** Numpad 1. */
    readonly NUMPAD_1: 'Numpad1';
    /** Numpad 2. */
    readonly NUMPAD_2: 'Numpad2';
    /** Numpad 3. */
    readonly NUMPAD_3: 'Numpad3';
    /** Numpad 4. */
    readonly NUMPAD_4: 'Numpad4';
    /** Numpad 5. */
    readonly NUMPAD_5: 'Numpad5';
    /** Numpad 6. */
    readonly NUMPAD_6: 'Numpad6';
    /** Numpad 7. */
    readonly NUMPAD_7: 'Numpad7';
    /** Numpad 8. */
    readonly NUMPAD_8: 'Numpad8';
    /** Numpad 9. */
    readonly NUMPAD_9: 'Numpad9';
    /** Numpad multiply (*). */
    readonly MULTIPLY: 'NumpadMultiply';
    /** Numpad add (+). */
    readonly ADD: 'NumpadAdd';
    /** Numpad subtract (−). */
    readonly SUBTRACT: 'NumpadSubtract';
    /** Numpad decimal point. */
    readonly DECIMAL: 'NumpadDecimal';
    /** Numpad divide (/). */
    readonly DIVIDE: 'NumpadDivide';
    /** F1 function key. */
    readonly F1: 'F1';
    /** F2 function key. */
    readonly F2: 'F2';
    /** F3 function key. */
    readonly F3: 'F3';
    /** F4 function key. */
    readonly F4: 'F4';
    /** F5 function key. */
    readonly F5: 'F5';
    /** F6 function key. */
    readonly F6: 'F6';
    /** F7 function key. */
    readonly F7: 'F7';
    /** F8 function key. */
    readonly F8: 'F8';
    /** F9 function key. */
    readonly F9: 'F9';
    /** F10 function key. */
    readonly F10: 'F10';
    /** F11 function key. */
    readonly F11: 'F11';
    /** F12 function key. */
    readonly F12: 'F12';
    /** Equal / plus key (=). */
    readonly PLUS: 'Equal';
    /** Minus key (−). */
    readonly MINUS: 'Minus';
    /** Comma key. */
    readonly COMMA: 'Comma';
    /** Period / full-stop key. */
    readonly PERIOD: 'Period';
    /** Forward slash key (/). */
    readonly SLASH: 'Slash';
    /** Backslash key (\\). */
    readonly BACKSLASH: 'Backslash';
    /** Semicolon key (;). */
    readonly SEMICOLON: 'Semicolon';
    /** Single-quote / apostrophe key ('). */
    readonly QUOTE: 'Quote';
    /** Backtick / grave-accent key (`). */
    readonly BACKQUOTE: 'Backquote';
    /** Left square bracket ([). */
    readonly BRACKET_LEFT: 'BracketLeft';
    /** Right square bracket (]). */
    readonly BRACKET_RIGHT: 'BracketRight';
};
/** A `KeyboardEvent.code` string or virtual mouse/wheel code (`'Mouse1'`, `'MWheelUp'`, etc.). */
export type KeyCode = string;
/** Low-level input service: keyboard key bindings, mouse button bindings, and pointer (mouse + touch) access. Accessed via `game.input`. */
export declare class Input {
    private readonly canvas;
    private readonly touchDevice;
    private readonly mobile;
    constructor(canvas?: HTMLCanvasElement | null, touchDevice?: boolean, mobile?: boolean);
    /**
     * Physical-key → action-name bindings map. Populated by `bind()`.
     * Each physical code maps to one or more action names (a code may drive several actions).
     */
    bindings: Map<string, Set<string>>;
    private pressCount;
    private presses;
    private releases;
    private keyDown;
    /** Raw codes that went DOWN this frame — the code-level twin of `presses`
     *  (which is action-keyed). Cleared by clearPressed() each frame. */
    private codePresses;
    private wheelTaps;
    private _wheelDelta;
    /** Seconds left of the scene-entry input grace (see ignoreFor). */
    private graceLeft;
    private textHandlers;
    /** True once a keyboard binding has been created and DOM listeners are attached. */
    isUsingMouse: boolean;
    /** True once a mouse or wheel binding has been created and DOM listeners are attached. */
    isUsingKeyboard: boolean;
    /**
     * Unified pointer tracker — mouse and touch (multi-touch) share this.
     * Exposes `game.input.pointer` (primary), `game.input.pointers` (all active),
     * and gesture subscriptions: `onTap`, `onDoubleTap`, `onLongPress`, `onPan`, `onSwipe`,
     * `onPointerDown`, `onPointerUp`, `onPointerMove`.
     */
    pointerTracker: PointerTracker;
    private onKeyDownBound;
    private onKeyUpBound;
    private onBlurBound;
    private onMouseDownBound;
    private onMouseUpBound;
    private onWheelBound;
    private onContextMenuBound;
    private onTouchStartBound;
    private onTouchEndBound;
    /**
     * Remove every DOM listener attached by this Input and tear down the pointer tracker.
     * Called by `Game.destroy()`; after this the Input is inert.
     */
    destroy(): void;
    /**
     * Bind one or more physical key codes (keyboard keys, mouse buttons, or wheel ticks) to a named action.
     * Multiple codes for the same action are ref-counted — the action stays held until every bound key is released.
     * DOM listeners are attached lazily on the first `bind()` call.
     * @example
     * input.bind(KEY.LEFT_ARROW, 'left');
     * input.bind([KEY.LEFT_ARROW, KEY.A], 'left'); // WASD + arrows both move
     * input.bind(KEY.MOUSE1, 'fire');
     */
    bind(codes: string | string[], action: string): void;
    /** Remove every binding for a physical code; any action it was driving is released immediately. */
    unbind(code: string): void;
    /** Drop every binding and clear all pressed/held/released state. */
    unbindAll(): void;
    /** Returns `true` while one or more keys bound to this action are currently held (key down). */
    /**
     * True while any of the given KEY CODES is held — the no-setup path:
     * `input.key('ArrowLeft', 'KeyA')`. Codes are `KeyboardEvent.code` values
     * (see `KEY`), plus 'Mouse1'…'Mouse3'.
     *
     * The other granularity of the same job is ACTIONS — `bind()` a set of codes
     * to a name, then `state(name)`. Prefer actions once a game has remappable
     * controls or more than a couple of keys; both read the same key state and
     * both respect the scene-transition grace.
     */
    key(...codes: string[]): boolean;
    /** True only on the frame any of the given key codes went DOWN (edge, not
     *  held) — menu confirms, jumps, one-shot fire. Auto-repeat is not an edge. */
    keyPressed(...codes: string[]): boolean;
    /**
     * Map a RAW DOM pointer event to world coordinates through this frame's view
     * — the escape hatch for your own `canvas.addEventListener('pointerdown')`.
     * Gestures routed through this Input (`onTap`, `onPan`, `pointer`) already
     * carry world coordinates, so you rarely need this.
     */
    toWorld(e: {
        clientX: number;
        clientY: number;
    }): {
        x: number;
        y: number;
    };
    state(action: string): boolean;
    /** Returns `true` on the single frame the action transitioned from not-held to held (key pressed). Use for one-shot triggers like jump or shoot. */
    pressed(action: string): boolean;
    /** Returns `true` on the single frame the action transitioned from held to not-held (key released). */
    released(action: string): boolean;
    /**
     * Ignore ALL input — key state/edges and pointer gestures — for `seconds`.
     * Called automatically on every scene transition (game.inputGrace, default
     * 0.5 s): a player frantically tapping fire when they die shouldn't
     * instantly dismiss the game-over screen.
     */
    ignoreFor(seconds: number): void;
    /** True while the scene-entry grace period is running (all reads report inactive). */
    get ignoring(): boolean;
    /**
     * Forget everything currently held, pressed or released, and every
     * in-flight pointer — called on scene transitions so a key RELEASED just
     * after the switch can't fire an action in the new scene (the classic
     * "release quits the game-over screen" bug). Bindings survive; a held key
     * re-registers on its next real keydown.
     */
    reset(): void;
    /**
     * Subscribe to text input — fires once per typed character, layout- and Shift-resolved
     * (so you get `'A'`, `'@'`, `' '`, etc., not physical key codes). Control keys
     * (Backspace, Enter, arrows, …) are NOT delivered here — handle those with `bind()` +
     * `pressed()`. Fires on browser key-repeat too, so holding a key types repeatedly.
     * Typing is suppressed during Ctrl/Cmd/Alt shortcuts and while a DOM `<input>` is focused.
     * Use for an in-canvas text field — a high-score name, a seed, a chat line.
     * @returns An unsubscribe function.
     * @example
     * let name = '';
     * this.input.onText(ch => { if (name.length < 8) name += ch; });
     * const keys = this.input.bind({ del: ['Backspace'], ok: ['Enter'] });
     * // in update(): if (keys.del.pressed) name = name.slice(0, -1);
     */
    onText(handler: (char: string) => void): () => void;
    /**
     * Mouse-wheel movement THIS FRAME, in pixels — positive scrolls down/away.
     * Unlike the `'MWheelUp'`/`'MWheelDown'` codes (one-frame edges, so a fast
     * flick collapses to a single tick) this carries the magnitude, which is what
     * scrolling a list or zooming a map actually needs.
     */
    get wheelDelta(): number;
    /** The primary pointer — mouse if active, else the first touch. `null` when no pointer is tracked. */
    get pointer(): Pointer | null;
    /** Every currently active pointer: the mouse plus each touch finger currently on screen. */
    get pointers(): Pointer[];
    /**
     * Subscribe to tap events (quick down + up, no drag) from mouse or touch.
     * @returns An unsubscribe function.
     */
    onTap(handler: Parameters<PointerTracker['onTap']>[0]): () => void;
    /**
     * Subscribe to double-tap events (two taps within `doubleTapDelay` in the same area) from mouse or touch.
     * @returns An unsubscribe function.
     */
    onDoubleTap(handler: Parameters<PointerTracker['onDoubleTap']>[0]): () => void;
    /**
     * Subscribe to long-press events (pointer held stationary for `longPressDelay` ms) from mouse or touch.
     * @returns An unsubscribe function.
     */
    onLongPress(handler: Parameters<PointerTracker['onLongPress']>[0]): () => void;
    /**
     * Subscribe to pan events (continuous pointer movement while pressed/held) from mouse or touch. Fires every frame the pointer moves beyond `panThreshold`.
     * @returns An unsubscribe function.
     */
    onPan(handler: Parameters<PointerTracker['onPan']>[0]): () => void;
    /**
     * Subscribe to swipe events (fast directional release: left/right/up/down) from mouse or touch.
     * @returns An unsubscribe function.
     */
    onSwipe(handler: Parameters<PointerTracker['onSwipe']>[0]): () => void;
    /**
     * Subscribe to raw pointer-down events (mouse button pressed or finger touched).
     * @returns An unsubscribe function.
     */
    onPointerDown(handler: Parameters<PointerTracker['onPointerDown']>[0]): () => void;
    /**
     * Subscribe to raw pointer-up events (mouse button released or finger lifted).
     * @returns An unsubscribe function.
     */
    onPointerUp(handler: Parameters<PointerTracker['onPointerUp']>[0]): () => void;
    /**
     * Subscribe to raw pointer-move events (mouse moved or touch dragged). Fires every frame the pointer position changes.
     * @returns An unsubscribe function.
     */
    onPointerMove(handler: Parameters<PointerTracker['onPointerMove']>[0]): () => void;
    /**
     * End-of-tick housekeeping called by the Game's frame loop: clears the one-frame pressed/released edge flags
     * and drains wheel-tick increments (wheel ticks are held for one frame only).
     */
    clearPressed(): void;
    /**
     * Bind a touch on a DOM element (selected by CSS selector) to a named action.
     * Useful for on-screen d-pad buttons or HUD controls laid out outside the canvas.
     * @param selector A CSS selector for the touch target element.
     * @param action The action name to press/release with this touch.
     */
    bindTouch(selector: string, action: string): void;
    private pressCode;
    private releaseCode;
    private pressAction;
    private releaseAction;
    private onMouseDown;
    private onMouseUp;
    private onWheel;
    private onContextMenu;
    private onTouchStart;
    private onTouchEnd;
}

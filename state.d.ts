// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Finite state machine for game screens and overlays — e.g. title → playing → game-over → pause. Safe: transitions are queued and applied only when `processPending()` runs, never mid-update. */
/** A motion system (e.g. `this.tween`) that the state machine freezes and thaws when suspending/resuming under an overlay. */
export interface SuspendMotion {
    /** Freeze all motion (called when an overlay is pushed). */
    pause(): void;
    /** Unfreeze all motion (called when the overlay is dismissed). */
    resume(): void;
}
/** Lifecycle hooks for a single state. All are optional. */
export interface StateHooks {
    /** Called when this state becomes active. `prev` is the previous state name, or `null` on first entry. */
    onEnter?(prev: string | null): void;
    /** Called when leaving this state. `next` is the next state name, or `null` when suspended. */
    onExit?(next: string | null): void;
    /** Called when this state is pushed under a suspend overlay. Receive an optional reason string. */
    onSuspend?(reason?: string): void;
    /** Called when this state is restored after a suspend overlay is dismissed. */
    onResume?(reason?: string): void;
    /** Called every frame while this state is active. `delta` is the frame time in seconds. */
    onUpdate?(delta: number): void;
}
/** The state machine interface returned by `createStateMachine`. */
export interface StateMachine {
    /** Register a state by name with its lifecycle hooks. Call once per state before using the machine. */
    registerState(name: string, hooks: StateHooks): void;
    /** Queue a full transition to state `next`. Applied on the next `processPending()` call. */
    requestTransition(next: string, reason?: string): void;
    /** Queue pushing an overlay state on top of the current one (suspending it). Applied on the next `processPending()`. */
    requestSuspend(overlay: string, reason?: string): void;
    /** Queue dismissing the current overlay and restoring the suspended state. Applied on the next `processPending()`. */
    requestResume(reason?: string): void;
    /** Apply any queued transition, suspend, or resume. Call once per frame, before `update()`. */
    processPending(): void;
    /** Run the active state's `onUpdate` hook with `delta` seconds. Call once per frame after `processPending()`. */
    update(delta: number): void;
    /** The name of the currently active state, or `null` before the first transition. */
    readonly current: string | null;
}
/**
 * Create a state machine. Use for game screen flow (title / playing / game-over) and pause overlays.
 * @param onEnterState Optional callback fired on every state entry — use it to clear held-key state so input doesn't bleed across screens.
 * @param motion Optional motion system (`this.tween`) automatically frozen/thawed on suspend/resume.
 */
export declare function createStateMachine(onEnterState?: () => void, motion?: SuspendMotion): StateMachine;

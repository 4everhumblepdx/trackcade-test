// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Glue — the `on(A, B, fn)` / `on('event', fn)` / `solid(A, B, fn?)` verbs that wire collision handlers, named event listeners, and solid-body pairs into a scene's `events` list. `on` is detection only; `solid` adds the physical response (separation + velocity resolution by body type). */
import type { Sprite } from './sprite.js';
import type { Scene } from './scene.js';
import type { SpriteClass } from './scene.js';
/** Callback for a collision / overlap / hit between two sprite instances. Called each frame they overlap. */
export type HitFn = (a: Sprite, b: Sprite, scene: Scene) => void;
/** Callback for a named game event. `payload` is whatever was passed to `scene.emit(name, payload)`. */
export type EventFn = (scene: Scene, payload?: unknown) => void;
/** A collision descriptor — returned by `on(A, B, fn)`. Consumed by the scene's `events` list to register an overlap check. */
export interface HitReg {
    /** Discriminant — always `'hit'`. */
    kind: 'hit';
    /** First sprite class in the collision pair. */
    a: SpriteClass;
    /** Second sprite class in the collision pair. */
    b: SpriteClass;
    /** Handler called each frame `a` and `b` instances overlap. */
    fn: HitFn;
}
/** An event listener descriptor — returned by `on('name', fn)`. Consumed by the scene's `events` list to register a named listener. */
export interface EventReg {
    /** Discriminant — always `'event'`. */
    kind: 'event';
    /** Event name to listen for (e.g. `'lifeLost'`, `'levelComplete'`). */
    name: string;
    /** Handler called when the event is emitted. */
    fn: EventFn;
}
/** A solid-pair descriptor — returned by `solid(A, B, fn?)`. Consumed by the scene's `events` list to register a physically-resolved collision pair. */
export interface SolidReg {
    /** Discriminant — always `'solid'`. */
    kind: 'solid';
    /** First sprite class in the solid pair. */
    a: SpriteClass;
    /** Second sprite class in the solid pair (may equal `a` for self pairs, e.g. crates vs crates). */
    b: SpriteClass;
    /** Optional handler called after the pair is resolved, each frame they contact. */
    fn?: HitFn;
}
/** A collision, solid-pair, or event descriptor — the union returned by `on(...)` / `solid(...)`. Add to a scene's `events` array. */
export type EventDescriptor = HitReg | EventReg | SolidReg;
/** Register a per-frame collision / overlap handler between all instances of sprite classes `a` and `b`. */
export declare function on(a: SpriteClass, b: SpriteClass, fn: HitFn): HitReg;
/** Register a named game-event listener on the scene (reaction / callback). */
export declare function on(name: string, fn: EventFn): EventReg;
/**
 * Register a SOLID collision pair between sprite classes `a` and `b`: overlapping instances are
 * physically resolved each frame — separated along the minimal-penetration axis according to their
 * `body` types (dynamic pushed, static immovable, `'none'` skipped), with velocity
 * response and `touching` flags handled by the physics. Where `on(A, B)` only *detects*,
 * `solid(A, B)` *responds*. Pass `fn` to also react to each resolved contact (damage, sound, …).
 * Self pairs (`solid(Crate, Crate)`) make instances push each other apart.
 */
export declare function solid(a: SpriteClass, b: SpriteClass, fn?: HitFn): SolidReg;

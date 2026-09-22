// Docs: engine/webgpu/particles.md — usage, recipes & traps (this file = exact type signatures)
import type { Draw } from './draw.js';
import { type Rgba } from './color.js';
/** Built-in colour ramp for `EmitOptions.ramp`. The particle walks the stops
 * from birth to death. Explosions (fire/ember/spark), atmosphere (smoke,
 * toxic), magic effects (magic, ice), or a full-spectrum rainbow. */
export type RampName = 'fire' | 'spark' | 'ember' | 'smoke' | 'ice' | 'magic' | 'toxic' | 'rainbow';
/** The named life-ramps (head = birth, last stop = death). */
export declare const RAMPS: Record<RampName, string[]>;
/** Resolve a ramp (named or custom hex stops) to parsed colours. */
export declare function resolveRamp(ramp: RampName | string[]): Rgba[];
export interface EmitOptions {
    x: number;
    y: number;
    /** Particles in this burst (default 12). */
    count?: number;
    /** Initial speed ± speedVar, world units/s (default 90 ± 40). speedVar: 0 = a clean ring. */
    speed?: number;
    speedVar?: number;
    /** Emission direction (radians, clockwise; default 0) ± spread/2 (default: full circle). */
    angle?: number;
    spread?: number;
    /** Distribute angles EVENLY across the spread instead of randomly — a clean ring or fan. */
    even?: boolean;
    /** Jitter the spawn point within this radius (spread origin). Default 0 = point. */
    spawnRadius?: number;
    /** Lifetime seconds ± lifeVar (default 0.7 ± 0.3). */
    life?: number;
    lifeVar?: number;
    /** Disc radius / frame half-size ± sizeVar (default 4 ± 2). */
    size?: number;
    sizeVar?: number;
    /** Size over life: true = shrink to nothing, false = constant, or the
     * FINAL size as a fraction of `size` — 0.5 = half, and >1 GROWS
     * (billowing smoke: 2.5 = swells to 2.5×). Default true. */
    shrink?: boolean | number;
    /** Fade alpha over life (default true). */
    fade?: boolean;
    /** Downward acceleration (default 0). Negative = embers rising. */
    gravity?: number;
    /** Velocity damping per second, 0..1 (default 0). */
    drag?: number;
    /** Smooth side-to-side wander acceleration, units/s² — snow, petals,
     * floating embers (default 0). */
    sway?: number;
    /** Sway oscillation frequency, cycles/s (default 1.5). */
    swayFreq?: number;
    /** One colour… */
    color?: string;
    /** …or a palette picked per particle. */
    colors?: string[];
    /** A colour ramp walked over the particle's life — a RAMPS name ('fire',
     * 'smoke', …) or custom hex stops. Overrides color/colors. */
    ramp?: RampName | string[];
    /** Alpha multiplier for the whole emit (default 1). */
    alpha?: number;
    /** Per-particle brightness flicker 0..1 (fireflies, embers, magic dust). */
    twinkle?: number;
    /** Additive blend — glows/fire/sparks (default false = normal alpha). */
    add?: boolean;
    /** Draw an atlas frame instead of a disc (debris, petals, chunks). */
    frame?: number;
    /** Random spin up to ±spin rad/s (only visible with `frame`). */
    spin?: number;
    /**
     * A name for this emitter, so the scene can DRAW it where it belongs:
     * `game.fx.draw(d, 'exhaust')` before the ship, `'sparks'` after it. Ungrouped
     * particles draw with the engine's own call, after the scene.
     */
    group?: string | number;
}
export declare class Particles {
    private rng;
    private pool;
    private alive;
    private clock;
    /** Groups already placed by the scene this frame — see draw(). */
    private placed;
    /** Pass a seeded rng (e.g. mulberry32) for deterministic headless tests. */
    constructor(rng?: () => number);
    /** Live particle count (for HUD/stress readouts). */
    get count(): number;
    /** Spawn a burst. Call once for an explosion, every frame for a stream. */
    emit(opts: EmitOptions): void;
    /** A CONTINUOUS emitter — the only correct way to run a steady effect.
     * `rate` = particles per SECOND, wall clock: the engine owns the
     * accumulator, so alive = rate × life at ANY refresh rate (per-frame
     * emit() loops double on a 120 Hz display — emit() is for BURSTS).
     * Options are live; kill() stops the stream. */
    stream(opts: EmitOptions & {
        rate: number;
    }): EmitOptions & {
        rate: number;
        dead: boolean;
        kill(): void;
    };
    private streams;
    /** Age + integrate; recycles the dead (swap-remove — order is irrelevant). */
    update(dt: number): void;
    /**
     * Push live particles into the frame AT THIS POINT in the draw order.
     *
     * Particles are ordinary display-list content: they land where you draw them,
     * so an exhaust plume goes BEHIND its ship simply by being drawn first.
     *
     * ```ts
     * override draw(d: Draw): void {
     *   super.draw(d);
     *   this.game.fx.draw(d, 'exhaust');   // …behind the ship
     *   d.sprite(shipFrame, x, y);
     *   this.game.fx.draw(d, 'sparks');    // …and in front of it
     * }
     * ```
     *
     * With a `group`, only that group draws, and it is remembered for the rest of
     * the frame. Without one, everything NOT already placed draws — which is what
     * the engine calls after the scene, so a game that never places anything
     * behaves exactly as before.
     */
    draw(d: Draw, group?: string | number): void;
    /** Kill everything (scene change). */
    clear(): void;
}

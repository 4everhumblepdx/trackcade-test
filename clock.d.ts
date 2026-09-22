// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
export declare class FixedClock {
    /** Simulation step in seconds (default 60 Hz). */
    readonly step: number;
    /** Max steps consumed per advance — excess time is DROPPED (no spiral of death). */
    readonly maxSteps: number;
    /** Fraction [0..1) of a step elapsed since the last consumed step — lerp render poses with this. */
    alpha: number;
    private acc;
    constructor(
    /** Simulation step in seconds (default 60 Hz). */
    step?: number, 
    /** Max steps consumed per advance — excess time is DROPPED (no spiral of death). */
    maxSteps?: number);
    /** Feed a frame's dt; returns how many fixed steps to run right now. */
    advance(dt: number): number;
}

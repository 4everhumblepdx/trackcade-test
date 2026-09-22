// Docs: engine/webgpu/effects.md — usage, recipes & traps (this file = exact type signatures)
export interface EffectDef {
    name: string;
    /** WGSL statements (see contract above). */
    code: string;
    /** Ordered params → uniform slots (max 8), with defaults. */
    params?: Record<string, number>;
    /** Optional GLSL ES 3.0 twin of `code` — same variable scope (`uv`, `time`,
     * `texel`, `u.res`, named params, `tex(p)`, result in `color`), spliced by
     * the WebGL fallback. A def without one is SKIPPED there (one console
     * warn), so ship both dialects for effects that must degrade gracefully. */
    glsl?: string;
}
export declare const MAX_EFFECT_PARAMS = 8;
/** Splice an EffectDef into the full-screen post template → complete WGSL. */
export declare function buildEffectWGSL(def: EffectDef): string;
/** Ordered default values for an effect's uniform slots (p0.x … p1.w). */
export declare function effectDefaults(def: EffectDef): number[];
/** Slot index of a named param (for PostHandle.set). -1 if unknown. */
export declare function effectParamIndex(def: EffectDef, name: string): number;
export declare const EFFECTS: Record<string, EffectDef>;
export declare const EFFECT_PACK: Record<string, EffectDef>;

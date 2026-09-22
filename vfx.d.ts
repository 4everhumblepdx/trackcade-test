// Docs: engine/webgpu/vfx.md — usage, recipes & traps (this file = exact type signatures)
import type { EmitOptions, RampName } from './particles.js';
/** One layer of a burst recipe. All fields optional — compose freely. */
export interface BurstLayer {
    /** Seconds after the trigger this layer fires. Default 0. */
    delay?: number;
    /** A particle emit at the burst point (angle is rotated by the trigger's
     * `angle`). `soft` rides along for the 3D renderer (world.burst). */
    emit?: Omit<EmitOptions, 'x' | 'y'> & {
        soft?: number;
    };
    /** An expanding ring: radius grows `from`→`to` over `time`, stroke `width`, fading out. */
    ring?: {
        from?: number;
        to: number;
        time: number;
        width?: number;
        color?: string;
        add?: boolean;
    };
    /** A filled flash disc that pops and fades over `time`. */
    flash?: {
        radius: number;
        time: number;
        color?: string;
    };
}
/**
 * Particles shed along a trail's LAID-DOWN path — arc-spaced (per world unit
 * of head travel, not per frame), so sparks land where the object flew and
 * stay there: the afterimage principle applied to particles. All numbers are
 * 2D-tuned; the 3D trail scales them by 0.1 (the trail-width convention).
 */
export interface TrailSparks {
    /** Particles shed per world unit of head travel (default 0.25). */
    per?: number;
    /** Outward jitter speed, world units/s (default 30 ± half). */
    speed?: number;
    /** Spark lifetime seconds (default 0.45). */
    life?: number;
    /** Spark size (default 2). */
    size?: number;
    /** Palette picked per spark (default the trail's own colours). */
    colors?: string[];
    /** A life-ramp name ('spark', 'fire', …) or hex stops — overrides colors. */
    ramp?: string[] | RampName;
    /** Additive blend (default: the trail's own `add`). */
    add?: boolean;
    /** Downward acceleration (2D y-down / 3D pulls toward the floor). Default 0. */
    gravity?: number;
    /** Velocity damping per second (default 1.5 — sparks skitter to rest). */
    drag?: number;
    /** Brightness flicker 0..1 (default 0.6 — electric crackle reads). */
    twinkle?: number;
}
/** An object-driven effect as pure DATA — the MCP-block delivery shape. */
export interface VfxDef {
    name: string;
    /** Continuous ribbon options (feed points; segments fade out over `life`). */
    trail?: {
        /** Ribbon width at the head, world units. Default 8. */
        width?: number;
        /** Seconds a point survives. Default 0.5. */
        life?: number;
        /** Head→tail colour gradient (1–8 hex stops; the 2D ribbon and the 3D
         * trail both spread them evenly). Default white. */
        colors?: string[];
        /** Additive blend (fire, magic, light). Default false. */
        add?: boolean;
        /** Width tapers to 0 at the tail. Default true. */
        taper?: boolean;
        /** Head alpha. Default 0.8. */
        alpha?: number;
        /** Minimum distance between recorded points (smooths dense feeds). Default 3. */
        spacing?: number;
        /** Shed particles along the laid path, arc-spaced per world unit of
         * travel (comet dust, ember spray, electric sparks). Works in 2D and 3D;
         * composes with `crackle` (they are independent). */
        sparks?: TrailSparks;
        /** 3D: noise-driven sideways flutter at the tail, world units. Default 0.35. */
        turbulence?: number;
        /** 3D: noise erosion toward the tail, 0..1 — the ribbon shreds into wisps
         * instead of fading as a solid strip. Default 0.55. */
        erode?: number;
        /** 3D: white-hot centre-line intensity 0..1 (best with `add`). Default 0.5. */
        core?: number;
        /** 3D: fibre-texture depth 0..1 — 0 = a perfectly clean ribbon of light
         * (Tron), 1 = fully streaked (fire/smoke). Default 1. */
        fiber?: number;
        /** 3D: edge hardness 0..1 — 0 = soft gaussian falloff (gas), 1 = a crisp
         * flat-topped band of light (neon; pair with bloom). Default 0. */
        hard?: number;
        /** 3D: electric glint INSIDE the ribbon 0..1 — flickering white-hot
         * shimmer crawling the surface (lightning, plasma; pair with bloom).
         * Independent of `sparks` — they compose. Default 0. */
        crackle?: number;
        /** 3D: ribbon orientation. 'view' (default) always faces the camera —
         * comets, magic. 'up' is a VERTICAL WALL standing on the fed path,
         * base-anchored, `width` tall, visible from both sides — the Tron
         * light-cycle wall. */
        facing?: 'view' | 'up';
    };
    /** One-shot recipe layers, all triggered by `scene.vfx.burst(name, x, y)`. */
    burst?: BurstLayer[];
}
/** The engine-core VFX (deliberately minimal — variety ships as data). */
export declare const VFX: Record<string, VfxDef>;
/** On-demand pack — passed (or registered) as DATA, like EFFECT_PACK. */
export declare const VFX_PACK: Record<string, VfxDef>;
/** Register a custom VfxDef (or override) by name — the block path. */
export declare function registerVfx(def: VfxDef): void;
/** Resolve a name (or pass a def through) against the registry — shared by
 * the 2D VfxSystem and the 3D world.trail() path. */
export declare function resolveVfx(v: string | VfxDef): VfxDef;
/** A live trail — feed `point(x, y)` every frame (or bind a sprite via sprite.vfx). */
export declare class TrailEmitter {
    private readonly t;
    private readonly sparks;
    private hx;
    private hy;
    private hasHead;
    private shedAcc;
    /** Record the head position for this frame. */
    point(x: number, y: number): void;
    /** Stop feeding and let the ribbon fade out, then auto-remove. */
    release(): void;
}
/**
 * The scene's VFX system: continuous trails + one-shot bursts, all data.
 * Trails draw UNDER the sprites (streams behind the body); burst rings and
 * flashes draw OVER them; burst particle layers ride the particle system.
 */
export declare class VfxSystem {
    private trails;
    private bound;
    private bursts;
    /** Start a trail you feed yourself: `const t = scene.vfx.trail('flameTrail'); t.point(x, y)`. */
    trail(vfx: string | VfxDef): TrailEmitter;
    /** Trigger a one-shot burst recipe at a point. `angle` rotates directional emits (radians). */
    burst(vfx: string | VfxDef, x: number, y: number, opts?: {
        angle?: number;
    }): void;
}

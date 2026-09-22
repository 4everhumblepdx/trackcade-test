// Docs: engine/webgpu/terrain3d.md — usage, recipes & traps (this file = exact type signatures)
/** How the body meets the ground. `point` = a single sample (a marker, a
 * foot). `sphere` = a ball: the smooth upper envelope of spherical caps
 * over the terrain (rolls over quad kinks and small notches without the
 * hard support-switching a footprint max() gives — the right model for a
 * round thing). `plank` = a flat footprint (board/kart/box/GLB) that rests
 * on its highest contact and, if `tilt`, banks to the slope. Auto-picked:
 * `radius` → sphere, `length` → plank, else point. */
export type ContactShape = 'point' | 'plank' | 'sphere';
export interface TerrainRiderOptions {
    /** Surface height at world (x, z) — the ONE required input. Ride terrain
     * with `(x, z) => terrain.heightAt(x, z)` (or the fresh field, or a
     * seabed…). The rider adds the body's own thickness (`radius` / the
     * plank plane), so groundAt returns the bare surface. Keep it smooth
     * (the fresh field, not the carved surface, if the rider carves — else
     * it rides its own cut). */
    groundAt: (x: number, z: number) => number;
    /** Contact shape (default auto from radius/length — see ContactShape). */
    contact?: ContactShape;
    /** SPHERE radius — a ball/wheel. The centre rides the spherical envelope,
     * so it bridges notches narrower than R and never jitters on inclines. */
    radius?: number;
    /** Sphere envelope resolution — samples on a ring (default 12). More =
     * smoother over rough ground, costs more groundAt calls. */
    ringTaps?: number;
    /** Fore-aft footprint length (PLANK; default 0 = point). A board/kart/box
     * BRIDGES dips and PIVOTS crests over this length — the biggest
     * anti-jitter win for a flat-bottomed body. */
    length?: number;
    /** Lateral footprint width (PLANK; default 0). Set it to bank to the
     * cross-slope (a wide vehicle). */
    width?: number;
    /** Bank/pitch the body to the surface slope (default: true for a plank,
     * false for sphere/point). Set false for a box that stays level, resting
     * on its highest corner. */
    tilt?: boolean;
    /** How far the contact settles INTO the surface (default 0). A board
     * compacts the snow it rides; the trench opens up behind it. */
    settle?: number;
    /** Air gravity, world units/s² (default 30). Ignored while glued. */
    gravity?: number;
    /** Detach into the air when the surface drops more than this below the
     * rider — a lip throws you (default 0.9). `Infinity` = GLUED (never
     * airborne; e.g. a ball stuck to a seabed). */
    detach?: number;
    /** Suspension stiffness = `followK + speed·followKGain`, capped at
     * `followKMax`. Soft enough to filter terrain-quad steps, stiff enough
     * not to float off a fast descent — but the cap matters: uncapped it
     * goes near-rigid at speed and transmits every support switch raw.
     * Defaults 25 / 0.5 / 55. Set followK = Infinity for a hard follow. */
    followK?: number;
    followKGain?: number;
    followKMax?: number;
    /** Orientation smoothing: the fitted slope eases at `slopeK`, then the
     * pitch/roll ease toward it at `orientK` (defaults 14 / 10). */
    slopeK?: number;
    orientK?: number;
    /** Surface pitch/roll = atan(slope) × gain (defaults 0.9). */
    pitchGain?: number;
    rollGain?: number;
    /** Terminal fall speed (default 200). */
    maxFall?: number;
}
/** One contact sample: a local footprint offset (fore, side) from the
 * centre. */
interface FootTap {
    f: number;
    s: number;
}
/** Fore-aft sample offsets across a footprint of length L (a symmetric
 * 5-tap line, or a single centre tap when L = 0). Exported for the tests. */
export declare function footprintTaps(L: number): number[];
/** Build the contact footprint for a shape (exported for the tests). A
 * PLANK/point is a symmetric plus of fore×side taps; a SPHERE is the
 * centre + two rings sampling the ball's contact disc (averaged). */
export declare function buildFootprint(contact: ContactShape, length: number, width: number, radius: number, ringTaps: number): FootTap[];
export declare class TerrainRider {
    /** Horizontal position (the game writes these via step). */
    x: number;
    z: number;
    /** Heading the footprint is sampled along (radians). */
    yaw: number;
    /** The smoothed ride height — set this on your mesh. */
    y: number;
    /** Vertical velocity (managed in the air; 0 while grounded). */
    vy: number;
    grounded: boolean;
    /** Seconds since takeoff (frozen at flight length after landing — read it
     * on the `landed` frame to scale a stomp/impact). */
    airTime: number;
    /** True ONLY on the frame the rider touched down. */
    landed: boolean;
    /** Surface-following orientation for the body (radians). Add your own
     * lean (carve, steer) on top. */
    pitch: number;
    roll: number;
    /** The fitted along-heading slope (dY/dForward), smoothed. */
    slope: number;
    /** This frame's raw support height and last frame's — the delta is the
     * height traded for speed if you run an energy model (v² += 2g·Δh). */
    groundY: number;
    lastGroundY: number;
    private o;
    private prevY;
    private smoothSlope;
    private smoothRoll;
    private started;
    constructor(opts: TerrainRiderOptions);
    /**
     * Where the body rests on the terrain, and the surface slope under it.
     * SPHERE: the smooth upper envelope of spherical caps — `max(ground +
     * √(R²−d²))` — which meets the terrain tangentially, so a ball rolls
     * over quad kinks and bridges notches without the hard support-switching
     * a footprint max() gives (Rich: the ball's residual incline jitter).
     * PLANK: a plane at the fitted slope, laid on the highest contact —
     * bridges dips, pivots crests, banks to the slope. Pure (tests drive it).
     */
    sample(x: number, z: number, yaw: number): {
        support: number;
        slopeFore: number;
        slopeSide: number;
    };
    /** Place the rider on the ground at (x, z), at rest — call before the
     * first step (and on respawn). */
    reset(x: number, z: number, yaw?: number): void;
    /** Pop into the air with an initial upward velocity (a jump). */
    launch(vy: number): void;
    /**
     * Advance one frame. The GAME has already moved the rider horizontally —
     * pass the new (x, z, yaw). `speed` (horizontal, world u/s) tunes the
     * suspension stiffness; omit it and it's derived from the move. Sets y,
     * pitch, roll, grounded, landed, airTime, groundY/lastGroundY.
     */
    step(dt: number, x: number, z: number, yaw: number, speed?: number): void;
}
export {};

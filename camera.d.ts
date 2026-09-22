// Docs: engine/webgpu/particles.md, engine/webgpu/sprites.md — usage, recipes & traps (this file = exact type signatures)
import type { Sprite } from './sprite.js';
export declare class Camera {
    /** Top-left of the visible world rect, world units. */
    x: number;
    y: number;
    /** Clamp the view inside this world rect (null = unclamped). */
    bounds: {
        x: number;
        y: number;
        w: number;
        h: number;
    } | null;
    private target;
    private lerp;
    private snapPending;
    private shakeT;
    private shakeDur;
    private shakePower;
    /** This frame's shake jitter (Game adds it to the view origin; x/y stay clean). */
    shakeX: number;
    shakeY: number;
    private flashColor;
    private flashT;
    private flashDur;
    /** Kick a decaying screen shake (impacts, explosions). */
    shake(power?: number, duration?: number): void;
    /**
     * A full-screen colour flash fading out over `duration` seconds — hits,
     * pickups, lightning. The view's other impact verb, alongside `shake()`;
     * both live on the camera, so a scene transition starts clean.
     */
    flash(color?: string, duration?: number): void;
    /** Keep a sprite centred (exponential smoothing; higher lerp = snappier, 0 = locked-on). */
    follow(sprite: Sprite | null, opts?: {
        lerp?: number;
        snap?: boolean;
    }): void;
    /** Advance smoothing + clamping. Called by Game each frame with the view size. */
    update(dt: number, viewW: number, viewH: number): void;
}

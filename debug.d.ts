// Docs: engine/webgpu/debug.md — usage, recipes & traps (this file = exact type signatures)
import type { Draw } from './draw.js';
import type { Scene } from './scene.js';
import type { BitmapFont } from './font.js';
export interface DebugOptions {
    /** Sprite hitboxes, colour-coded by body type (dynamic green, static blue,
     * kinematic orange, sensor purple, none grey). Default true. */
    hitboxes?: boolean;
    /** Velocity vectors from each moving sprite's centre. Default true. */
    velocity?: boolean;
    /** Red markers on edges with active `touching` contacts. Default true. */
    touching?: boolean;
    /** Collision-grid cells in view: solid outlines + slope surface lines. Default true. */
    tiles?: boolean;
    /** The HUD stats line: fps, sprites, particles, 3D counts. Default true. */
    stats?: boolean;
    /**
     * The box every text block PAINTS (ink and all) — green normally, **RED where
     * two of them collide**. Turn this on the moment a HUD or menu looks crowded:
     * it shows the real extents, which include stroke/glow/shadow/plate and the
     * hover state, not the tighter text box. Default true.
     */
    textBounds?: boolean;
}
/**
 * Normalise the public `game.debug` value. Exported from the barrel (and so
 * from the shipped `.d.ts`) because the dist tests exercise it directly — set
 * `game.debug` rather than calling this.
 */
export declare function normalizeDebug(v: boolean | DebugOptions): Required<DebugOptions> | null;
/** Renders the overlay each frame — constructed once by Game; drive it with `game.debug`. */
export declare class DebugOverlay {
    private font;
    private fps;
    draw(d: Draw, hud: Draw, scene: Scene, opts: Required<DebugOptions>, ctx: {
        dt: number;
        view: {
            x: number;
            y: number;
            w: number;
            h: number;
        };
        particles: number;
        counts3d: {
            meshes: number;
            billboards: number;
            draws: number;
        } | null;
        font: () => BitmapFont;
    }): void;
    /**
     * Outline every text block drawn on this surface, reddening any that collide.
     * The boxes are the PAINTED extents (stroke/glow/shadow/plate + the hover
     * state), which is why a HUD that looks fine by text size can still clash.
     */
    private drawTextBounds;
    private outline;
    private contacts;
    private drawTiles;
}

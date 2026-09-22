// Docs: engine/webgpu/world3d.md — usage, recipes & traps (this file = exact type signatures)
import type { World3d } from './world3d.js';
export interface OrbitOptions {
    /** Start angles/distance (radians; pitch >0 looks down from above). */
    yaw?: number;
    pitch?: number;
    dist?: number;
    /** Orbit pivot (default the origin). */
    target?: {
        x: number;
        y: number;
        z: number;
    };
    minDist?: number;
    maxDist?: number;
    minPitch?: number;
    maxPitch?: number;
    /** Wheel dollies toward the cursor point (default true; false = centre zoom). */
    zoomToCursor?: boolean;
    /** Right-drag / shift+drag pans the pivot (default true). */
    pan?: boolean;
    /** WASD/arrow + Q/E flying (default false — turn on for debugging). */
    fly?: boolean;
    /** Fly speed in world units/sec (default scales with dist). Shift = 3×. */
    flySpeed?: number;
    rotateSpeed?: number;
    zoomSpeed?: number;
    /** Idle spin in radians/sec — pauses while dragging or flying (default 0). */
    autoRotate?: number;
    /** GROUND CLAMP: world height at (x, z) — the camera never sinks below
     * it (+ `floorMargin`, default 1.5). Wire a terrain:
     * `floor: (x, z) => terrain.heightAt(x, z)`. Live-mutable on the rig. */
    floor?: (x: number, z: number) => number;
    floorMargin?: number;
}
/** Scale camera + target about a fixed world point (the zoom-to-cursor core:
 * pure, testable). Returns the new target; the camera derives from it. */
export declare function scaleAboutPoint(target: {
    x: number;
    y: number;
    z: number;
}, c: {
    x: number;
    y: number;
    z: number;
}, k: number): {
    x: number;
    y: number;
    z: number;
};
export declare class OrbitRig {
    yaw: number;
    pitch: number;
    dist: number;
    target: {
        x: number;
        y: number;
        z: number;
    };
    enabled: boolean;
    /** Idle spin in radians/sec — pauses while dragging or flying. Live-mutable. */
    autoRotate: number;
    /** Ground clamp (see OrbitOptions.floor). Live-mutable; null = off. */
    floor: ((x: number, z: number) => number) | null;
    floorMargin: number;
    /** WASD/arrow + Q/E flying. Live-mutable so a demo can flip a follow
     * camera into a free-fly probe cam without rebuilding the rig. */
    fly: boolean;
    /** The live object being followed (see follow()), or null. */
    private followObj;
    private followOffset;
    private followEase;
    private world;
    private canvas;
    private o;
    /** Sticky explore flag: set by the first fly movement. While set, a
     * rotate-drag turns the view about the CAMERA (look-around) instead of
     * swinging the camera about the pivot. */
    private look;
    private mode;
    private lastX;
    private lastY;
    private keys;
    private un;
    constructor(world: World3d, canvas: HTMLCanvasElement, opts?: OrbitOptions);
    /** Camera-frame basis from the current angles (right, up, forward). */
    private basis;
    private wire;
    /** World point under the cursor on the plane through the target ⊥ view —
     * the fixed point wheel zoom scales about. Null when the ray grazes. */
    private cursorPivot;
    private cameraPos;
    private clampPitch;
    /**
     * FOLLOW a live moving object — pass the handle itself (a mesh, group,
     * or any `{x, y, z}`), NOT a snapshot of its position. The rig re-reads
     * it every frame at TICK time, which the engine runs AFTER your game
     * callback — so whatever your callback did last (a TerrainRider settling
     * the object's `y`, a physics step, a parent transform) is already
     * applied, and the camera can NEVER lag a frame behind it.
     *
     * This is the whole point: `rig.target.y = thing.y` copied INSIDE the
     * callback captures a stale value if anything updates `thing` afterwards
     * — a footgun that reads as the followed object "jittering" under any
     * acceleration. `follow()` removes the ordering from your hands.
     *
     *   rig.follow(player, { offset: { y: 2 } });   // chase the player
     *   rig.follow(null);                            // release (free look)
     *
     * `offset` is added to the object; `ease` (per-second) lags the pivot
     * for a soft chase (default 0 = locked to the object). Yaw/pitch/dist
     * stay yours to set (a chase demo eases `rig.yaw` toward the heading).
     */
    follow(obj: {
        x: number;
        y: number;
        z: number;
    } | null, opts?: {
        offset?: {
            x?: number;
            y?: number;
            z?: number;
        };
        ease?: number;
    }): void;
    /** Per-frame: fly keys, then write the world camera. The game calls this. */
    update(dt: number): void;
    private apply;
    /** Unwire every listener (the rig keeps its last camera pose). */
    detach(): void;
}

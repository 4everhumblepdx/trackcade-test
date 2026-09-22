// Docs: engine/webgpu/minecraft-controls.md — usage, recipes & traps (this file = exact type signatures)
import type { Game } from './game.js';
import type { Draw } from './draw.js';
import type { BitmapFont } from './font.js';
export interface McHotbar {
    /** Block display names, left→right (also the count of slots). */
    names: string[];
    /** A swatch colour per slot for the on-screen hotbar. */
    colors: string[];
}
export interface McOptions {
    yaw?: number;
    pitch?: number;
    /** Space/Shift meaning: 'jump' (walk — Space jumps) or 'fly' (creative —
     *  Space rises, Shift sinks). Live-mutable via `mc.fly`. Default 'fly'. */
    vertical?: 'jump' | 'fly';
    /** Allow double-tap Space / double-tap the jump button to toggle fly. When
     *  set, the rig flips `vertical` between 'jump' and 'fly'. Default false. */
    canFly?: boolean;
    /** Enable break interaction (LEFT mouse / touch hold). Default true. */
    canBreak?: boolean;
    /** Enable place interaction (RIGHT mouse / touch tap). Default false. */
    canPlace?: boolean;
    /** Hotbar to show + drive (number keys, wheel, tap). Omit for none. */
    hotbar?: McHotbar;
    /** Mouse look sensitivity, radians per pixel of movement. Default 0.0022. */
    sensitivity?: number;
}
/** Walk speeds (blocks/s) for `walkStep` — sneak/walk/run. */
export interface McWalkSpeeds {
    walk?: number;
    run?: number;
    sneak?: number;
}
/** A body the walk helper steps — `VoxelBody` satisfies this structurally. */
interface Steppable {
    step(dt: number, wishX: number, wishZ: number, jump: boolean): void;
}
/** The look-at camera the aim helpers write — `world.camera` satisfies it. */
interface AimCamera {
    x: number;
    y: number;
    z: number;
    face(yaw: number, pitch: number): void;
    lookAt(x: number, y: number, z: number): void;
}
type Vec3 = {
    x: number;
    y: number;
    z: number;
};
/** The 12 edges of a unit cube centred on the origin (±`h`) as polylines —
 *  feed to `world.lines()` for a Minecraft-style block outline, then set the
 *  shape's x/y/z to the target cell centre. */
export declare function cubeEdges(h?: number): Array<Array<[number, number, number]>>;
export declare class McControls {
    /** Look angles — engine `+Z`-forward convention (see forward()). Read these. */
    yaw: number;
    pitch: number;
    /** Move intent in look space, each −1..1: forward (W/joystick up) and strafe
     *  (D/joystick right). Refreshed by poll() each frame. */
    mf: number;
    ms: number;
    /** Vertical intent while flying, −1..1 (Space − Shift, or the touch buttons). */
    up: number;
    /** Space held (walk-mode jump). */
    jumpHeld: boolean;
    /** Sprinting (Ctrl held, double-tap W, or nothing on touch). */
    sprint: boolean;
    /** Sneaking (Shift held on foot). */
    sneak: boolean;
    /** Creative flight — flips with double-tap Space / jump when `canFly`. */
    fly: boolean;
    /** Selected hotbar slot (0-based). */
    sel: number;
    /** Break held this frame (LEFT mouse or a stationary touch-hold). */
    mining: boolean;
    /** Place active this frame (RIGHT mouse held, or a one-frame touch tap). */
    placing: boolean;
    /** Mouse/touch look sensitivity, radians per pixel. Live-mutable (a demo
     *  slider binds straight to this). */
    sensitivity: number;
    /** True once any touch has happened — switches the HUD to the mobile layout. */
    touch: boolean;
    /** True while the desktop pointer is locked (mouse-look live). */
    locked: boolean;
    private game;
    private canvas;
    private o;
    private hotbar;
    private moveId;
    private moveBase;
    private moveKnob;
    private lookId;
    private lookLast;
    private lookStart;
    private lookDown;
    private lookMoved;
    private lookBreaking;
    private placePulse;
    private breakPulse;
    private jumpTouch;
    private downTouch;
    private lastJumpTap;
    private lastWTap;
    private sprintLatch;
    private un;
    constructor(game: Game, opts?: McOptions);
    /** A unit forward vector for the current look (for raycasts + camera.face). */
    forward(): {
        x: number;
        y: number;
        z: number;
    };
    /** Horizontal wish-velocity for a move speed, from mf/ms about the yaw.
     *  Diagonals are normalised so strafing isn't faster. */
    wish(speed: number): {
        x: number;
        z: number;
    };
    /** CREATIVE FLIGHT: advance a free `{x,y,z}` eye by the move intent (WASD /
     *  joystick) + vertical (Space/Shift, fly buttons). `speed` is base blocks/s;
     *  sprint doubles it. Pair with `firstPerson(cam, eye)`. */
    flyStep(eye: Vec3, dt: number, speed?: number): void;
    /** SURVIVAL WALK: step a `VoxelBody` with the move intent + jump (gravity,
     *  collision and step-up live in the body). Speeds default to Minecraft-ish
     *  sneak 2 / walk 4.5 / run 7 blocks/s. */
    walkStep(body: Steppable, dt: number, speeds?: McWalkSpeeds): void;
    /** FIRST-PERSON camera: eye = `eye`, looking along the current yaw/pitch. */
    firstPerson(cam: AimCamera, eye: Vec3): void;
    /** THIRD-PERSON camera: pull the eye `dist` back along the look ray from
     *  `target` (the player's head) and aim at it; `lift` raises the eye. */
    thirdPerson(cam: AimCamera, target: Vec3, dist: number, lift?: number): void;
    /** Read keyboard + touch into the continuous intent fields. Call once at the
     *  top of the frame BEFORE using wish()/jumpHeld/up. */
    poll(): void;
    private mouseLeft;
    private mouseRight;
    private wire;
    private lastSpaceTap;
    /** Convert a Touch's page point into engine view coords (matches the HUD). */
    private toView;
    private joyRadius;
    private onTouchStart;
    private onTouchMove;
    private onTouchEnd;
    /** Draw the crosshair, hotbar, and (on touch) the on-screen controls. Call
     *  inside the run() draw callback. `t` is the game clock for the crosshair pulse. */
    drawHud(d: Draw, t: number, font?: BitmapFont): void;
    private drawHotbar;
    /** Positions for the on-screen buttons (also used for hit-testing). */
    private buttons;
    private hitButton;
    private hitHotbar;
    private drawTouch;
    private drawBtn;
    /** Unwire every listener + release the pointer. */
    detach(): void;
}
/** Convenience factory mirroring the engine's `world.orbit()` call style. */
export declare function mcControls(game: Game, opts?: McOptions): McControls;
export {};

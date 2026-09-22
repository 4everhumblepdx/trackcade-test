// Docs: engine/webgpu/voxels.md — usage, recipes & traps (this file = exact type signatures)
import type { VoxelHit } from './voxel3d.js';
/** A placed/broken block. `id` is the block placed, or the one that was there. */
export interface VoxelEditEvent {
    x: number;
    y: number;
    z: number;
    id: number;
}
/** A single mining hit — `progress` is 0..1 toward the block breaking. */
export interface VoxelHitEvent extends VoxelEditEvent {
    progress: number;
}
/** What the editor changed this frame (also delivered to the callbacks). */
export interface VoxelEditResult {
    /** The committed (debounced) target block, or null when nothing's in reach. */
    target: VoxelHit | null;
    /** The empty cell a place would fill (target + face normal), or null. */
    placeCell: {
        x: number;
        y: number;
        z: number;
    } | null;
    /** True when placing here is refused by the `blocked` guard. */
    blocked: boolean;
    hit: VoxelHitEvent | null;
    broke: VoxelEditEvent | null;
    placed: VoxelEditEvent | null;
}
export interface VoxelEditorOptions {
    /** How far the ray reaches, in blocks (default 8 ≈ Minecraft creative). */
    reach?: number;
    /** Block id a place drops (also settable live as `editor.block`). Default stone. */
    block?: number;
    /** Hits needed to break a block, by id — return 1 for instant/creative
     *  (the default). Higher = survival mining that takes several hits. */
    hardness?: (id: number) => number;
    /** Seconds between mining hits while LEFT is held (default 0.15). */
    breakRate?: number;
    /** Seconds between placements while RIGHT is held (default 0.2). */
    placeRate?: number;
    /** Draw the black wireframe outline on the aimed block (default true). */
    outline?: boolean;
    /** Draw the translucent placement ghost (default true). Tint via `ghostColor`. */
    ghost?: boolean;
    /** Ghost tint (also settable live as `editor.ghostColor`). Default white. */
    ghostColor?: string;
    /** Refuse to place into these cells (e.g. the player's body) — the ghost
     *  turns red and no block is placed. Default: nothing blocked. */
    blocked?: (x: number, y: number, z: number) => boolean;
    /** Frames a new target must hold before it commits — de-twitches the outline
     *  at block seams (default 3; 0 = off, instant). */
    debounce?: number;
    onHit?: (e: VoxelHitEvent) => void;
    onBreak?: (e: VoxelEditEvent) => void;
    onPlace?: (e: VoxelEditEvent) => void;
}
/** Per-frame ray + button state fed to `update`. */
export interface VoxelEditInput {
    origin: {
        x: number;
        y: number;
        z: number;
    };
    dir: {
        x: number;
        y: number;
        z: number;
    };
    /** LEFT held — mine/break the aimed block. */
    mining?: boolean;
    /** RIGHT held — place `editor.block` on the aimed face. */
    placing?: boolean;
}
interface EditVox {
    get(x: number, y: number, z: number): number;
    set(x: number, y: number, z: number, id: number): void;
    raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist?: number): VoxelHit | null;
}
interface OutlineHandle {
    x: number;
    y: number;
    z: number;
    alpha: number;
    scale: number;
}
interface GhostHandle {
    x: number;
    y: number;
    z: number;
    color: string;
    alpha: number;
}
interface EditWorld {
    lines(polylines: Array<Array<[number, number, number]>>, opts: {
        color?: string;
        width?: number;
        alpha?: number;
    }): OutlineHandle;
    box(cfg: {
        x: number;
        y: number;
        z: number;
        w: number;
        h: number;
        d: number;
        color: string;
        alpha: number;
        blob?: boolean;
    }): GhostHandle;
}
/**
 * Targets and edits a voxel world for the player. Construct with
 * `world.voxelEditor(vox, opts)`; call `update(dt, input)` each frame with the
 * camera ray + button state. It positions the outline/ghost, applies breaks
 * (respecting hardness) and places (respecting the anti-embed guard), and fires
 * `onHit`/`onBreak`/`onPlace` — the game turns those into effects.
 */
export declare class VoxelEditor {
    /** Block id a place drops. Set from the hotbar each frame if you like. */
    block: number;
    /** Ghost tint (the selected block's colour, usually). */
    ghostColor: string;
    /** Ray reach in blocks — live-mutable. */
    reach: number;
    private vox;
    private o;
    private hardness;
    private blockedFn;
    private cbHit?;
    private cbBreak?;
    private cbPlace?;
    private outline;
    private ghost;
    private committed;
    private pendKey;
    private pendN;
    private breakCd;
    private placeCd;
    private mineKey;
    private mineHits;
    constructor(world: EditWorld, vox: EditVox, opts?: VoxelEditorOptions);
    private key;
    /** Raycast + de-twitch: commit a new target only after it holds `debounce`
     *  frames, so the outline doesn't flip-flop on block seams. */
    private acquire;
    /** One frame: aim, draw outline/ghost, apply held break/place, emit events. */
    update(dt: number, input: VoxelEditInput): VoxelEditResult;
}
export {};

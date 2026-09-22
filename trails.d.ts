// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/**
 * Resample a trail's raw point history (oldest first) into `n` control
 * points HEAD (newest) → TAIL, each xyz + fade k, spaced uniformly in ARC
 * LENGTH — world3d.ts's resampleTrail, verbatim (pure, dist-testable).
 */
export declare function resampleTrail(points: ReadonlyArray<{
    x: number;
    y: number;
    z: number;
    age: number;
}>, n: number, life: number, out?: Float32Array, offset?: number): Float32Array;
export interface Trail3dOptions {
    /** Ribbon width in world units (default: the def's 2D width × 0.1). */
    width?: number;
    /** Seconds a point survives (default: the def's life). */
    life?: number;
    /** Auto-feed from this handle each tick; releases when the target dies. */
    follow?: {
        x: number;
        y: number;
        z: number;
        dead?: boolean;
    } | null;
    /** Feed offset from the followed handle. */
    offset?: {
        x?: number;
        y?: number;
        z?: number;
    };
    /** Min distance between recorded points (default width × 0.5). */
    spacing?: number;
    /** Override the auto-generated tileable noise frame. */
    noiseFrame?: number;
    /** 'view' (camera-facing ribbon) or 'up' (the Tron wall). */
    facing?: 'view' | 'up';
}
/** A live 3D trail — feed `point(x, y, z)` per frame (or pass `follow`).
 * All style fields live-mutable. world3d.ts's Trail3d, duplicated. */
export declare class Trail3d {
    width: number;
    life: number;
    colors: string[];
    add: boolean;
    taper: boolean;
    alpha: number;
    turbulence: number;
    erode: number;
    core: number;
    fiber: number;
    hard: number;
    /** Electric glint inside the ribbon 0..1 — live-mutable like the rest. */
    crackle: number;
    facing: 'view' | 'up';
    spacing: number;
    follow: {
        x: number;
        y: number;
        z: number;
        dead?: boolean;
    } | null;
    offset: {
        x: number;
        y: number;
        z: number;
    };
    /** The tileable noise frame driving flutter + erosion. */
    frame: number;
    hy: number; /** @internal */
    hz: number;
    private readonly sparks;
    private shedAcc;
    /** Record the head position for this frame. */
    point(x: number, y: number, z: number): void;
    /** Stop feeding; the ribbon fades out, then auto-removes. */
    release(): void;
}

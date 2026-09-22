import type { World3d, Mesh3d, Mesh3dConfig } from '../lib/world3d.js';
/** Hexagonal bipyramid — the classic game crystal (flat facets). */
export declare function crystalVerts(): Float32Array<ArrayBuffer>;
/** A low-poly boulder: jittered sphere with flat facets (deterministic). */
export declare function rockVerts(): Float32Array<ArrayBuffer>;
/** A ruined column: square plinth, octagonal fluted shaft, square cap. */
export declare function pillarVerts(): Float32Array<ArrayBuffer>;
/** A tapering four-sided obelisk with a pyramidal tip. */
export declare function spireVerts(): Float32Array<ArrayBuffer>;
/** What registerArt3d hands back: geometry factories + composite spawners. */
export interface Art3d {
    crystal(config?: Mesh3dConfig): Mesh3d;
    rock(config?: Mesh3dConfig): Mesh3d;
    pillar(config?: Mesh3dConfig): Mesh3d;
    spire(config?: Mesh3dConfig): Mesh3d;
    /** Composite: trunk + two canopy cones. Returns the handles (move them together). */
    tree(opts?: {
        x?: number;
        z?: number;
        scale?: number;
        leaf?: string;
        trunk?: string;
    }): Mesh3d[];
    /** A deterministic scatter of tilted crystals around a point. */
    crystalCluster(opts?: {
        x?: number;
        z?: number;
        count?: number;
        color?: string;
        seed?: number;
    }): Mesh3d[];
}
/**
 * Register the pack's geometries with a world. Every factory shares one
 * instanced draw per shape name, however many meshes you place.
 */
export declare function registerArt3d(world: World3d): Art3d;

// Docs: engine/webgpu/agents.md — usage, recipes & traps (this file = exact type signatures)
export interface NavVec3 {
    x: number;
    y: number;
    z: number;
}
type NavCore = any;
export interface NavMeshOptions {
    /** Explicit geometry: flat vertex xyz triples + triangle indices (CCW so the
     * walkable faces point UP). Pass your level's collision meshes here. */
    positions?: ArrayLike<number>;
    indices?: ArrayLike<number>;
    /** …OR auto-triangulate a heightfield into a grid mesh. */
    from?: 'terrain';
    heightAt?: (x: number, z: number) => number;
    size?: number;
    center?: {
        x: number;
        z: number;
    };
    res?: number;
    /** Voxel cell size — the navmesh resolution (default 0.3). */
    cellSize?: number;
    /** Voxel cell height (default 0.2). */
    cellHeight?: number;
    /** Agent radius: the navmesh is eroded by this so paths keep clearance (default 0.6). */
    agentRadius?: number;
    /** Agent height — minimum head-room (default 2). */
    agentHeight?: number;
    /** Max step/ledge the agent can climb (default 0.9). */
    agentMaxClimb?: number;
    /** Max walkable slope in degrees (default 50). */
    agentMaxSlope?: number;
    /** Override the core module URL (rarely needed). */
    module?: string;
}
/** Triangulate a heightfield region into a navmesh source mesh (CCW-up). */
export declare function terrainMesh(heightAt: (x: number, z: number) => number, size: number, res: number, cx?: number, cz?: number): {
    positions: Float32Array;
    indices: Uint32Array;
};
/** A baked Detour navmesh + query. Implements the `path()` planner contract so
 * it drops straight into the `navigate` behaviour (`{ kind:'navigate', grid }`)
 * exactly like the built-in NavGrid. */
export declare class NavMesh3d {
    private core;
    private query;
    private crowds;
    private ext;
    dead: boolean;
    constructor(core: NavCore, navMesh: unknown);
    /** A uniformly-random point ON the navmesh — for wander/patrol goals that are
     * guaranteed reachable (never inside a wall). Null if the mesh is empty. */
    randomPoint(): NavVec3 | null;
    /** Snap a point to the nearest navmesh surface (null if off-mesh). */
    nearest(p: NavVec3): NavVec3 | null;
    /** Plan a path start→goal as world waypoints (empty when unreachable). The
     * `navigate` behaviour calls this — same contract as NavGrid.path(). */
    path(start: NavVec3, goal: NavVec3): NavVec3[];
    /** Create a recast Crowd for dense local avoidance among navmesh agents.
     * (Optional tier — most games use the built-in steering avoidance.) */
    crowd(opts?: {
        maxAgents?: number;
        maxAgentRadius?: number;
    }): Crowd3d;
    kill(): void;
}
/** A thin wrapper over recast's Crowd: add agents bound to a target, step it,
 * read back positions. For dense groups that must not interpenetrate. */
export declare class Crowd3d {
    private raw;
    private core;
    private agents;
    constructor(core: NavCore, navMesh: unknown, opts: {
        maxAgents?: number;
        maxAgentRadius?: number;
    });
    /** Add a crowd agent at a world position; returns its index. */
    add(pos: NavVec3, params?: Record<string, number>): number;
    /** Point an agent at a world goal. */
    goto(idx: number, goal: NavVec3): void;
    /** Current world position of a crowd agent. */
    position(idx: number): NavVec3;
    update(dt: number): void;
}
/** Bake a NavMesh3d from geometry (loads the vendored core on first use). */
export declare function buildNavMesh(opts: NavMeshOptions): Promise<NavMesh3d>;
/** The planner contract both NavGrid and NavMesh3d satisfy (for `navigate`). */
export interface PathPlanner {
    path(start: NavVec3, goal: NavVec3): NavVec3[];
}
export {};

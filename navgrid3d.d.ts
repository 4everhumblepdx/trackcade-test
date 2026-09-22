// Docs: engine/webgpu/agents.md — usage, recipes & traps (this file = exact type signatures)
export interface NavVec3 {
    x: number;
    y: number;
    z: number;
}
export interface NavGridOptions {
    /** Surface height at a world XZ (usually `terrain.heightAt`). */
    heightAt: (x: number, z: number) => number;
    /** World span of the (square) grid. */
    size: number;
    /** Grid centre in world XZ (default origin). */
    center?: {
        x: number;
        z: number;
    };
    /** Cells per side (default 64). Coarser than the render mesh is fine. */
    res?: number;
    /** Steeper than this height-step BETWEEN adjacent cells is a cliff — cut. */
    maxStep?: number;
    /** Cost multiplier for climbing (0 = ignore slope, 3 = strongly prefer flat). */
    slopePenalty?: number;
    /** Cells whose surface is below this Y are unwalkable (water/void). */
    minY?: number;
    /** Extra per-cell mask — return false to block (obstacles, no-go zones). */
    blocked?: (x: number, z: number) => boolean;
}
export declare class NavGrid {
    readonly res: number;
    readonly cell: number;
    readonly ox: number;
    readonly oz: number;
    readonly height: Float32Array;
    readonly walk: Uint8Array;
    private maxStep;
    private slopePenalty;
    constructor(o: NavGridOptions);
    idx(ix: number, iz: number): number;
    inBounds(ix: number, iz: number): boolean;
    cellCenter(ix: number, iz: number): NavVec3;
    worldToCell(x: number, z: number): {
        ix: number;
        iz: number;
    };
    walkableCell(ix: number, iz: number): boolean;
    /** The nearest walkable cell to (ix,iz) by ring search (start/goal snap). */
    nearestWalkable(ix: number, iz: number): {
        ix: number;
        iz: number;
    } | null;
    /** True if the height STEP between adjacent walkable cells is passable. */
    private edgeOk;
    /** A* over 8-connected cells. Returns a list of cell indices start→goal, or
     * null if unreachable (a cliff-ringed peak refuses a path). */
    astar(startX: number, startZ: number, goalX: number, goalZ: number): number[] | null;
    private reconstruct;
    /** Walkable line-of-sight between two cells (supercover grid march). */
    lineOfSight(a: number, b: number): boolean;
    /** String-pull: drop interior cells the previous kept cell can see directly. */
    stringPull(cells: number[]): number[];
    /** Full plan start→goal as WORLD waypoints (cell centres at surface height).
     * Empty array when no path exists. */
    path(start: NavVec3, goal: NavVec3): NavVec3[];
    /** Build a flow field: cost-to-goal by Dijkstra, then a per-cell direction
     * toward the cheapest neighbour. Every agent samples it O(1). */
    flowField(goal: NavVec3): FlowField;
}
/** A per-cell direction field toward a goal (Tier 2). */
export declare class FlowField {
    readonly grid: NavGrid;
    readonly cost: Float32Array;
    readonly dirx: Float32Array;
    readonly dirz: Float32Array;
    constructor(grid: NavGrid, cost: Float32Array, dirx: Float32Array, dirz: Float32Array);
    /** Steering direction at a world XZ (zero where unreachable/at goal). */
    dirAt(x: number, z: number): {
        x: number;
        z: number;
    };
    /** Whether a world XZ can reach the goal at all (finite cost). */
    reachable(x: number, z: number): boolean;
}

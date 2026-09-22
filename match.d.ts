import type { MatchShape, XY } from './types.js';
/** Minimal grid view the scanner needs. Return -2 for empty/unmatchable cells. */
export interface MatchScanGrid {
    cols: number;
    rows: number;
    matchColorAt(x: number, y: number): number;
}
export interface Run {
    cells: XY[];
    orientation: 'h' | 'v';
}
/** A merged match group (runs sharing a cell fuse into one match). */
export interface MatchGroup {
    color: number;
    cells: XY[];
    runs: Run[];
    /** True when this group is a standalone 2×2 square (no runs). */
    square: boolean;
}
/** Scan the whole grid: all horizontal + vertical runs of 3+, merged into groups.
 * Optionally also standalone 2×2 squares (cells not already in any run). */
export declare function findMatchGroups(grid: MatchScanGrid, squareMatch?: boolean): MatchGroup[];
/** Classify a group's shape by the standard priority: 5-line > L/T/cross > square > 4 > 3. */
export declare function classifyGroup(group: MatchGroup, pivotHint?: XY): {
    shape: MatchShape;
    orientation: 'h' | 'v' | 'both' | 'none';
    pivot: XY;
};
/** Flood-fill the connected same-colour group containing (x, y).
 * Orthogonal by default; `adj8` includes diagonal neighbours (8-way chains). */
export declare function floodGroup(grid: MatchScanGrid, x: number, y: number, adj8?: boolean): XY[];

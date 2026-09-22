export { createBoard, Board, type AutoplayOptions } from './match3/board.js';
export { findMatchGroups, classifyGroup, floodGroup, type MatchGroup, type MatchScanGrid, type Run } from './match3/match.js';
export { createVersus, type Duel, type VersusConfig } from './match3/versus.js';
export { createPlaceMerge, PlaceMerge, type PlaceMergeConfig, type PlaceResult as PlaceMergeResult, type Item as MergeItem, type PlaceStep } from './match3/placemerge.js';
export { createRiseBoard, RiseBoard, type RiseConfig, type RiseResult, type RiseStep, type Panel } from './match3/rise.js';
export type { Action, Block, BlockInit, BlockKind, BlockSnapshot, BoardConfig, Cell, CellKind, CellLayer, Dir, FallMove, GoalDef, GoalDelta, GoalState, HitType, MatchEvent, MatchShape, MoveResult, OverlayEntry, PredictedMove, RefillSpawn, SpawnWeights, SpecialDef, SpecialKind, Step, XY, } from './match3/types.js';

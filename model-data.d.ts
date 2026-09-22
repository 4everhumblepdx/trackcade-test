// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
import { type ObjData, type ObjMaterial } from './obj.js';
import { type GlbData } from './glb.js';
/** Parsed, unit-fit, texture-decoded model data — everything needed to build a
 *  GPU model, with no device involved. Tagged by source format. */
export type ModelData = {
    kind: 'obj';
    data: ObjData;
    mats: Record<string, ObjMaterial>;
    imgs: Array<ImageBitmap | undefined>;
} | {
    kind: 'glb';
    data: GlbData;
    fit: {
        scale: number;
        center: [number, number, number];
    };
    bitmaps: Array<ImageBitmap | undefined>;
};
/**
 * Load + parse a model and decode its textures — all device-free — caching the
 * result by `url`. Safe from `preload()` (no World3d needed). GLB vs OBJ is
 * chosen by extension. Re-requesting a loaded url is free.
 */
export declare function loadModelData(url: string): Promise<ModelData>;

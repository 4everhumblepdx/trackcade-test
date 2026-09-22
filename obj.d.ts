// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
export interface ObjMaterial {
    name: string;
    /** Kd diffuse 0..1 (default [0.7, 0.7, 0.7]). */
    color: [number, number, number];
    /** map_Kd path EXACTLY as written (may be broken/absolute — the loader
     * layer decides what to do with it). */
    map?: string;
    /** Ns shininess if present. */
    ns?: number;
    /** d / (1 - Tr) opacity if present (default 1). */
    opacity?: number;
    /** Ke emissive if present. */
    emissive?: [number, number, number];
}
export interface ObjGroup {
    /** usemtl name, or null before any usemtl. */
    material: string | null;
    /** Triangulated soup, stride 8: pos(3) normal(3) uv(2), CCW as authored. */
    verts: Float32Array;
}
export interface ObjData {
    groups: ObjGroup[];
    /** The mtllib filename as written (may not match reality), or null. */
    mtllib: string | null;
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
    };
}
/** Parse a .mtl file into materials by name. */
export declare function parseMtl(text: string): Record<string, ObjMaterial>;
/** Parse a .obj file into per-material triangle soups. */
export declare function parseObj(text: string): ObjData;

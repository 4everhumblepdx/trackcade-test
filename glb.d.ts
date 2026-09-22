// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
export interface GlbMaterial {
    name: string;
    /** baseColorFactor rgba (default [1,1,1,1]). */
    color: [number, number, number, number];
    /** metallicFactor (default 1 per spec). */
    metallic: number;
    /** roughnessFactor (default 1). */
    rough: number;
    /** images[] index for baseColorTexture, if any. */
    colorImage?: number;
    /** metallicRoughness texture image index (glTF: g = rough, b = metallic
     * — MULTIPLIES the factors). DamagedHelmet-class models keep all their
     * material variation here. */
    mrImage?: number;
    /** images[] index for normalTexture, if any. */
    normalImage?: number;
    /** normalTexture.scale (default 1), only when normalImage present. */
    normalScale?: number;
    /** emissiveFactor if non-zero. */
    emissive?: [number, number, number];
}
export interface GlbImage {
    mimeType: string;
    bytes: Uint8Array;
}
export interface GlbPrimitiveOut {
    /** NON-INDEXED triangle soup, stride 8: pos(3) normal(3) uv(2). When
     * `baked`, the owning node's WORLD transform is applied to positions and
     * (inverse-transpose-rotated, renormalised) normals; otherwise verts are
     * as authored — node-local, or skin-space for skinned primitives. */
    verts: Float32Array;
    /** materials[] index or null. */
    material: number | null;
    /** Owning node index into rig.nodes (always set, even when rig is null). */
    node: number;
    /** skins[] index, or null when the primitive is not skinned. */
    skin: number | null;
    /** true = verts carry the world transform (the static fast path). */
    baked: boolean;
    /** 4 joint indices per vertex (into skins[skin].joints), expanded
     * non-indexed like verts. Only present when skinned. */
    joints?: Uint16Array;
    /** 4 weights per vertex, normalized to sum 1 (degenerate all-zero quads
     * become [1,0,0,0]). Only present when skinned. */
    weights?: Float32Array;
}
export interface GlbNodeOut {
    name: string;
    /** Parent node index, -1 for roots. */
    parent: number;
    /** Local TRS (matrix nodes are decomposed — glTF forbids skew so the
     * decomposition is exact). */
    t: [number, number, number];
    r: [number, number, number, number];
    s: [number, number, number];
}
export interface GlbChannel {
    node: number;
    path: 'translation' | 'rotation' | 'scale';
    interpolation: 'LINEAR' | 'STEP' | 'CUBICSPLINE';
    times: Float32Array;
    /** Packed values: 3 floats per key (t/s) or 4 (rotation). For CUBICSPLINE
     * the raw inTangent/value/outTangent triplets are packed as authored (3×
     * the element count per key) — the runtime samples the middle element. */
    values: Float32Array;
}
export interface GlbAnimOut {
    name: string;
    duration: number;
    channels: GlbChannel[];
}
export interface GlbSkinOut {
    joints: number[];
    inverseBind: Float32Array;
}
export interface GlbRig {
    nodes: GlbNodeOut[];
    anims: GlbAnimOut[];
    skins: GlbSkinOut[];
}
export interface GlbData {
    primitives: GlbPrimitiveOut[];
    materials: GlbMaterial[];
    images: GlbImage[];
    bounds: {
        min: [number, number, number];
        max: [number, number, number];
    };
    /** Node hierarchy + animations + skins — null when the file has neither
     * animations nor skins (everything baked, nothing to drive). */
    rig: GlbRig | null;
}
export declare function parseGlb(buffer: ArrayBuffer): GlbData;

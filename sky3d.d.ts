// Docs: engine/webgpu/sky-water3d.md — usage, recipes & traps (this file = exact type signatures)
export interface SkyState {
    /** Unit vector TOWARD the sun (below the horizon at night). */
    sunPos: [number, number, number];
    /** The direction light TRAVELS (what world.setSun wants): -sunPos. */
    sunDir: [number, number, number];
    sunColor: [number, number, number];
    /** Direct-sun intensity multiplier (1 = full noon, ~0 at night). */
    sunI: number;
    zenith: [number, number, number];
    horizon: [number, number, number];
    glow: [number, number, number];
    ambient: number;
    ambSky: [number, number, number];
    ambGround: [number, number, number];
    fog: [number, number, number];
    /** Star-field opacity (0 by day). */
    stars: number;
    /** Moon-disc opacity. */
    moon: number;
}
/** The pure day/night core: 0..24 h → palette + sun geometry. Wraps. */
export declare function skyState(time: number): SkyState;
export interface SkyOptions {
    /** Hour of day 0..24 (default 11 — late morning). */
    time?: number;
    /** Auto-advance: seconds of real time per full day (0 = paused). */
    cycle?: number;
    clouds?: boolean;
    /** Cloud sky-fraction 0..1 (default 0.45). */
    coverage?: number;
    /** Cloud opacity 0..1 (default 0.65). */
    density?: number;
    /** Cloud drift direction + rate (world-ish units; default gentle west). */
    wind?: {
        x: number;
        z: number;
    };
    /** Cloud drift speed multiplier (default 1). Clouds always drift on their
     * own wall-clock — this dial scales how fast, independent of `cycle`. */
    cloudSpeed?: number;
    /** Storm dial 0..1: coverage + density up, clouds and sun darken. */
    storm?: number;
    stars?: boolean;
    /** Sky drives sun/ambient/fog/env from `time` (default true — set false
     * to keep manual setSun/setAmbient control and use the dome visuals only). */
    drive?: boolean;
    /** LENS FLARE on the sun (default true — it is depth-occluded and fades
     * with night/storm/off-screen, so it never misbehaves). */
    flare?: boolean;
}
/** Returned by world.sky(): every field is live. */
export declare class Sky3d {
    time: number;
    cycleSecondsPerDay: number;
    clouds: boolean;
    coverage: number;
    density: number;
    wind: {
        x: number;
        z: number;
    };
    cloudSpeed: number;
    storm: number;
    stars: boolean;
    drive: boolean;
    flare: boolean;
    constructor(o?: SkyOptions);
    /** Auto-advance the clock: one full day per `seconds` (0 stops). */
    cycle(seconds: number): void;
    private lastTime;
    /** Advance + resolve the current state (the world calls this). */
    tick(dt: number): SkyState;
}
/** Constellation stars as unit directions + brightness (pure; tested). */
export declare function constellationDirs(): Array<{
    x: number;
    y: number;
    z: number;
    b: number;
}>;
/** GPU plumbing for the sky pass — owned by World3d, drawn at the end of
 * the opaque pass. */
export declare class Sky3dLayer {
    private format;
    private sampleCount;
    private device;
    private pipeline;
    private buf;
    private bind;
    readonly data: Float32Array<ArrayBuffer>;
    constructor(device: GPUDevice, format: GPUTextureFormat, sampleCount: number);
    rebuild(device: GPUDevice): void;
    /** Pack + upload this frame's uniforms. */
    write(s: SkyState, sky: Sky3d, time: number, fwd: [number, number, number], right: [number, number, number], up: [number, number, number], tanX: number, tanY: number): void;
    draw(pass: GPURenderPassEncoder): void;
}

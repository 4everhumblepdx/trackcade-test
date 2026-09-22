// Docs: engine/webgpu/screen.md — usage, recipes & traps (this file = exact type signatures)
/**
 * THE PRESENTATION SURFACE — the canvas as a display, and what you can capture
 * off it: `game.screen.fullscreen()`, `.screenshot(cb)`, `.record(60, 10, cb)`.
 *
 * This is host-shell API (the page's fullscreen button, a share/capture
 * control), not game API — nothing here affects the simulation. To freeze the
 * game itself use `game.pause()` / `game.resume()`.
 */
export declare class Screen {
    private readonly host;
    private cssFsSaved;
    private _pendingShot;
    private _pendingScale;
    private _recorder;
    private _recTimer;
    private _recChunks;
    private _recDone;
    /** `true` while the game is fullscreen — native Fullscreen API, or the iOS CSS fallback. */
    get isFullscreen(): boolean;
    /**
     * Enter / exit / toggle fullscreen — the one call to make. Uses the browser
     * Fullscreen API where it exists; on iOS (no `Element.requestFullscreen`) it
     * falls back to promoting the canvas to a fixed, full-viewport layer over the
     * page. The backing store re-fits automatically either way. `on` omitted →
     * toggle. Must be called from a user gesture (click/tap) for the native path.
     * Resolves once applied.
     */
    fullscreen(on?: boolean): Promise<void>;
    /**
     * Capture the canvas as a PNG image and hand it to `callback`. The shot is taken at the END
     * of the next rendered frame, so you never get a half-drawn frame; if the loop is paused, the
     * current (already-complete) frame is captured immediately.
     * @param callback Receives a PNG `Blob`, or `null` if the browser can't encode the canvas.
     * @param scale Upscale factor for the saved image (default 1) — pixel-art games upscale
     *   nearest-neighbour (crisp), smooth games interpolate.
     */
    screenshot(callback: (image: Blob | null) => void, scale?: number): void;
    /** `true` while a `record()` is in progress. */
    get recording(): boolean;
    /**
     * Record the canvas to a video using the browser's `captureStream` + `MediaRecorder`. Recording
     * ends after `duration` seconds (if given) or when you call {@link stopRecord} — whichever comes
     * first — and the finished video `Blob` (WebM) is handed to `callback`. The game's audio (SFX +
     * music) is muxed in too whenever a WebAudio graph exists, captured at the master mix level and
     * independent of the local mute. No-op while already recording or where the APIs are unavailable.
     * @param fps Frames per second to capture. Default 60.
     * @param duration Optional auto-stop time in seconds. Omit to record until `stopRecord()`.
     * @param callback Receives the recorded video `Blob` when recording ends.
     * @param videoBitsPerSecond Target video bitrate. Defaults to a generous, resolution-scaled value
     *   (≥ 8 Mbps) — the browser's own default (~2.5 Mbps) badly compresses sharp art.
     */
    record(fps?: number, duration?: number, callback?: (video: Blob) => void, videoBitsPerSecond?: number): void;
    /** Stop an in-progress `record()` early; the video is delivered to that call's `callback`. No-op if not recording. */
    stopRecord(): void;
}

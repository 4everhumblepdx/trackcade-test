// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** `true` once `url` has finished loading (or failing) via `loadImage`. */
export declare function isImageCached(url: string): boolean;
/** `true` once model DATA for `url` has been loaded + cached (via the 3D chunk's `loadModelData`). */
export declare function isModelCached(url: string): boolean;
/** The decoded image for `url`, or `null` if it hasn't loaded (or failed). Sync — preload first. */
export declare function getImage(url: string): HTMLImageElement | null;
/**
 * Load an image and resolve when it is decoded (or has failed — the promise
 * never rejects, so a missing file can't wedge a loading bar). Cached by URL.
 */
export declare function loadImage(url: string): Promise<HTMLImageElement>;
/** `true` if `url` has already been fetched by `loadText`/`loadJson` (cached) — so re-queuing it needs no load. */
export declare function isTextCached(url: string): boolean;
/**
 * Load a plain-text file (CSV, TSV, level data, etc.) from `url` and return
 * its content as a string. Results are cached by URL.
 * Returns `''` on network error or in headless (non-browser) environments.
 */
export declare function loadText(url: string): Promise<string>;
/**
 * Load and parse a JSON file from `url` (level data, config).
 * Delegates to `loadText` for caching and error handling.
 * Returns `null` on error or empty response.
 */
export declare function loadJson<T = unknown>(url: string): Promise<T>;
/** `true` if `url` has already been fetched by `loadBinary` (cached) — so re-queuing it needs no load. */
export declare function isBinaryCached(url: string): boolean;
/**
 * Load a binary file (packed level data, a model) from `url` as an
 * `ArrayBuffer`. Cached by URL — queue with `load.binary(url)` in `preload`,
 * read back instantly here in `setup`. Retries once, then THROWS with the
 * URL in the message — a swallowed failure used to surface downstream as
 * "GLB: truncated header — 0 bytes", which named neither cause nor file.
 * Headless (non-browser) environments still get an empty buffer.
 */
export declare function loadBinary(url: string): Promise<ArrayBuffer>;
/** `true` once the family loaded via `loadFont` is registered and usable. */
export declare function isFontCached(family: string): boolean;
/** `true` if the browser can render `cssFont` (e.g. '32px Orbitron') right now. */
export declare function isFontUsable(cssFont: string): boolean;
/**
 * Load a web font file (woff2 / woff / ttf / otf) and register it on the
 * document under `family`, so `game.assets.font({ font: '32px ' + family })`
 * bakes the REAL face. Cached by family|url; never rejects (a failed font
 * resolves `false` and the browser's fallback is used) so a bad URL can't
 * wedge the loading bar.
 */
export declare function loadFont(family: string, url: string, descriptors?: FontFaceDescriptors): Promise<boolean>;
/**
 * Resolve once every font the document has STARTED loading has settled. Catches
 * faces declared with CSS `@font-face` in the host page (which `load.font()`
 * knows nothing about). Cheap and always safe — resolves immediately when
 * nothing is pending.
 */
export declare function fontsSettled(): Promise<void>;
/**
 * Drop every cached asset (images, text/JSON, binaries, model data) so the
 * memory can be reclaimed — called by `Game.destroy()`. NOTE: these caches are
 * module-global (shared across Game instances on a page), so this frees assets
 * for ALL games; only relevant if you run more than one at once.
 */
export declare function clearAssetCaches(): void;

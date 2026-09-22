// Docs: engine/webgpu/index.md — usage, recipes & traps (this file = exact type signatures)
/** Thin localStorage persistence layer — high scores, settings, unlocks. Keys should be namespaced per game (e.g. `'highscore.pacman'`). Safe where localStorage is unavailable: `read` returns the fallback, `write` silently no-ops. */
/** Read/write helpers for persistent game data (save data / high scores / settings). */
export declare const persist: {
    /** Read a value from localStorage by `key`. Returns `fallback` if the key is absent or storage is unavailable. */
    read<T>(key: string, fallback: T): T;
    /** Write a JSON-serialisable `value` to localStorage under `key`. Silently no-ops if storage is unavailable or full. */
    write<T>(key: string, value: T): void;
};

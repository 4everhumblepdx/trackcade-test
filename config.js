// ── THE CANVAS ───────────────────────────────────────────────────────────────
// The engine creates its own canvas inside CONTAINER and sizes it to that box
// (× devicePixelRatio, capped) every frame.
//
// The world's logical height is `worldHeight` (engine default: 768) and you
// draw in those units. Each frame the visible world is that many units tall and
// as wide as the window's aspect makes it. Derive width-dependent layout from
// the view inside a scene: `this.width` / `this.centerX` / `this.vw(f)`.
//
// To use a different worldHeight (e.g. 240 with `PIXEL_ART` for a chunky retro
// look): add it to GAME_OPTIONS below AND to src/game.json — `npm run verify`
// asserts the two agree.
//
// worldHeight sizes the WORLD only. The HUD (`drawHud`) is CSS pixels: a 24px
// HUD font is 24 real pixels at any worldHeight.
//
// src/game.json is the machine-readable twin of these constants: external
// tooling (art sizing, the publish record) reads it without booting the engine.
export const BACKGROUND = '#0b0e2a'; // clear colour behind the world — deep indigo night
export const PIXEL_ART = true; // true = blocky (native-res) sprite sampling; false = smooth
export const CONTAINER = '#game'; // the element in index.html the engine mounts its canvas into
export const WORLD_HEIGHT = 360; // chunky pixel-art world scale (portrait mobile first)
/** The boot options game.ts spreads into `Game.create(...)`. */
export const GAME_OPTIONS = {
    container: CONTAINER,
    background: BACKGROUND,
    pixelArt: PIXEL_ART,
    worldHeight: WORLD_HEIGHT,
};
// ── YOUR TUNING ──────────────────────────────────────────────────────────────
// ALL gameplay tuning lives in track.config.ts — the reusable Trackcade track
// configuration (audio URL, palette, art, difficulty, music-event map). This
// file stays the engine-level boot record only.

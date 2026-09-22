# The screen — fullscreen, screenshots, video capture

`game.screen` is the canvas AS A DISPLAY: going fullscreen, and capturing what
is on it. It is **host-shell API** — the buttons a page wraps around the game —
and touches nothing in the simulation.

**The split to keep straight:** `game.screen.*` presents and captures;
`game.pause()` / `game.resume()` freeze and restart the game itself. There is
no `game.screen.pause()`.

```ts
await game.screen.fullscreen();          // toggle
await game.screen.fullscreen(true);      // explicitly enter
game.screen.isFullscreen;                // true either way (native or iOS fallback)
```

## How do I…

**…add a fullscreen button?**
Wire it to a real click/tap — browsers reject the native request from anywhere
else, and the call silently no-ops:

```ts
import { Game } from '../engine/webgpu.js';
const game = await Game.create({ scenes: { play: PlayScene } });

document.querySelector('#fs').addEventListener('click', () => {
  game.screen.fullscreen();   // toggles; resolves once applied
});
game.run();
```

The backing store re-fits itself. On iOS (no `Element.requestFullscreen`) the
canvas is promoted to a fixed full-viewport layer instead — same call, same
`isFullscreen`, nothing to branch on.

**…grab a screenshot of the game?**
`screenshot()` hands you a PNG `Blob`. The shot is taken at the END of the next
rendered frame, so you can never catch a half-drawn one:

```ts
game.screen.screenshot((png) => {
  if (!png) return;                       // browser couldn't encode
  const url = URL.createObjectURL(png);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'shot.png' });
  a.click();
  URL.revokeObjectURL(url);
});
```

Pass a scale to upscale: `game.screen.screenshot(cb, 4)`. Pixel-art games
(`pixelArt: true`) upscale nearest-neighbour so the pixels stay crisp; smooth
games interpolate. **Trap:** the callback is asynchronous while the loop runs —
the blob arrives in the callback, a frame later.

**…record a video clip of play?**
`record()` captures the canvas to WebM and muxes the game's audio in whenever a
sound has been played:

```ts
game.screen.record(60, 10, (video) => {         // 60 fps, auto-stop after 10s
  const url = URL.createObjectURL(video);
  const a = Object.assign(document.createElement('a'), { href: url, download: 'clip.webm' });
  a.click();
  URL.revokeObjectURL(url);
});

// …or stop it early; the same callback receives the video either way:
if (game.screen.recording) game.screen.stopRecord();
```

Audio is tapped at the master mix **pre-mute**, so a locally muted game still
records sound. The bitrate defaults high (≥ 8 Mbps, scaled to resolution) —
the browser's own ~2.5 Mbps default smears sharp art — override it with the
fourth argument if you need smaller files.

**…drive these from the page hosting the game?**
The running game is on `window.game`, so a host shell needs no import:

```ts
window.game.screen.fullscreen();
window.game.screen.screenshot((png) => { /* … */ });
window.game.pause();                      // lifecycle stays on the game itself
```

## Traps worth knowing

- **Fullscreen needs a user gesture** on the native path. Called from a timer
  or on boot it is denied and no-ops — no error, nothing happens.
- **`record()` no-ops** when already recording, or where `captureStream` /
  `MediaRecorder` are missing. Check `game.screen.recording` rather than
  assuming it started.
- **Capture never pauses the game.** To grab a still of a frozen moment, call
  `game.pause()` first — a screenshot taken while paused encodes the current
  (already complete) frame immediately.

## Relates to

- [index.md](index.md) — the game shape and the run loop (`pause`/`resume`).
- [debug.md](debug.md) — the overlay you may want OFF before capturing.

Signatures: engine/webgpu/screen.d.ts, engine/webgpu/game.d.ts.

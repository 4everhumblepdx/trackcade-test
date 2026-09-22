# Fonts — the hosted MSDF library

24 ready-baked MSDF fonts, served from the CDN. Nothing to
bundle, nothing to generate.

```ts
const font = await game.assets.msdfFont(
  'https://gameblocks.nyc3.cdn.digitaloceanspaces.com/gameblocks/fonts/inter.png',
  'https://gameblocks.nyc3.cdn.digitaloceanspaces.com/gameblocks/fonts/inter.json',
);
const title = game.assets.msdfText(font, 'Ready?', { fontSize: 64 });
game.run((d) => d.msdfText(title, 40, 40));
```

Give one to the widget layer and every UI label uses it:

```ts
game.draw.ui.setFont(font);   // and/or game.hud.ui.setFont(font)
```

Every atlas covers Latin-1 plus the typographic punctuation UI copy contains:
`— – ' ' " " … • € ™ ← ↑ → ↓ ✓ ✗ ▶ ★`. `d.msdfText` and `d.ui.*` only stay
on the crisp distance-field path if the atlas has EVERY character in the string,
so one em dash in a font that lacks it drops the whole block onto the softer
bitmap path.

Coverage still varies with the typeface — an atlas carries only what the TTF
draws, and Bangers has no `✓` or `★`. The glyph counts below are exact.
`d.ui.*` asks the font whether it can draw a string and routes anything it
cannot to `d.unicodeText`.

**Latin only.** CJK, Arabic, Hebrew, Thai and Devanagari go through
`d.unicodeText` — see [unicode-text.md](unicode-text.md). The widget layer
routes per string automatically.

## UI / text

Neutral faces for menus, HUDs and body copy.

| slug | family | glyphs | |
|---|---|---|---|
| `arimo` | Arimo | 217 | Metric-compatible with Arial, so it drops into Arial layouts exactly. |
| `dm-sans` | DM Sans | 209 | Geometric and friendly. Good for casual menus. |
| `inter` | Inter | 221 | The UI default — designed for screens, tight and neutral. |
| `nunito` | Nunito | 209 | Rounded terminals. The friendliest of the UI set. |
| `roboto` | Roboto | 209 | Android’s workhorse. Neutral, slightly narrow. |
| `work-sans` | Work Sans | 218 | Optimised for on-screen text at mid sizes. |

## Condensed

More characters per unit of width — dense HUDs, scoreboards.

| slug | family | glyphs | |
|---|---|---|---|
| `barlow-condensed` | Barlow Condensed | 207 | Lighter condensed alternative to Oswald. |
| `oswald` | Oswald | 206 | Condensed and tall. Scoreboards, sports, headlines. |
| `roboto-condensed` | Roboto Condensed | 209 | Fits more text in the same width. Good for dense HUDs. |

## Monospace

Fixed advance: stats, timers, seeds, debug readouts.

| slug | family | glyphs | |
|---|---|---|---|
| `ibm-plex-mono` | IBM Plex Mono | 211 | The other monospace — narrower than JetBrains. |
| `jetbrains-mono` | JetBrains Mono | 215 | Monospace for stats, seeds, timers and debug HUDs. |

## Serif

Story text, letters, lore.

| slug | family | glyphs | |
|---|---|---|---|
| `lora` | Lora | 206 | Serif with contrast — story text, letters, lore. |
| `tinos` | Tinos | 217 | Metric-compatible with Times New Roman. |

## Display / fun

Titles, level numbers, big friendly buttons.

| slug | family | glyphs | |
|---|---|---|---|
| `anton` | Anton | 217 | Very heavy condensed. Impact-style headlines. |
| `baloo` | Baloo 2 | 217 | Heavy rounded display. Big friendly buttons. |
| `bangers` | Bangers | 205 | Comic exclamations. POW. |
| `bungee` | Bungee | 216 | Signage face, works vertically. Bold and loud. |
| `chewy` | Chewy | 206 | Soft rounded comic face. |
| `grandstander` | Grandstander | 206 | Playful and bouncy. Kids’ games. |
| `lilita-one` | Lilita One | 204 | Condensed cartoon display — lots of punch per pixel. |
| `luckiest-guy` | Luckiest Guy | 206 | Classic comic-book poster face. |
| `passion-one` | Passion One | 205 | Bold condensed display with a soft edge. |
| `righteous` | Righteous | 206 | Retro geometric display, art-deco leaning. |
| `titan-one` | Titan One | 205 | Fat cartoon display. Titles and level numbers. |

## The URLs

```
https://gameblocks.nyc3.cdn.digitaloceanspaces.com/gameblocks/fonts/<slug>.png
https://gameblocks.nyc3.cdn.digitaloceanspaces.com/gameblocks/fonts/<slug>.json
```

Both are needed — the PNG is the atlas, the JSON is the layout. Atlases are
cached for a day and the manifest for a minute, so a game can load them straight
from the CDN on every boot. `manifest.json` at the same path lists everything
above as data.

## Traps

- **Load the PAIR.** `msdfFont(png, json)` takes both; a mismatched pair from
  two different bakes will lay out wrong.
- **Await it in `setup()`, or queue it in `preload()`** so the loading bar
  covers it — see [msdf.md](msdf.md).
- **Sizes are field fractions**, so `outline.width: 0.15` looks the same on
  every font here whatever its atlas size.
- **Baked at size 42, pxrange 16.** MSDF is perfect under magnification and softens under heavy minification, so a UI that is mostly 14–21px text may read crisper from a smaller bake — `fontgen/` can produce one.

## Regenerating

The library lives in `fontgen/` in the engine repo: `fonts.json` is the
catalogue, `charset.txt` the glyph set. `yarn fonts:bake` rebuilds and
`yarn fonts:publish` uploads and rewrites THIS FILE from the manifest, so the
list above cannot drift from what is hosted.

Every font is OFL or Apache-2.0 and redistributable. Total library 8.0MB.

Signatures: engine/webgpu/msdf-font.d.ts, engine/webgpu/msdf-text.d.ts.

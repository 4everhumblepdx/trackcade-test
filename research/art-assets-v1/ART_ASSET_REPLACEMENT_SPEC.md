# Trackcade Art Asset Generation v1 — Replacement Contract

Status: **preregistered before any replacement image is generated**

## Purpose

Define a fail-closed contract for replacing Trackcade's six proven production art URLs without changing music, gameplay, scene geometry, collision semantics, or the closed Visual/World v1 palette foundation.

The first generated-image proof in this lane is intentionally **skyline only** because skyline art has no collision meaning. Player, obstacle, orb, and cell generation remains blocked until the skyline path proves generation → normalization → QC → manifest publication safely.

## Frozen upstream chain

- Analyzer production: `release/analyzer-v0.19`
- Analyzer commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- Structure artifact digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`
- Gameplay/Difficulty v1 closure: `141bf6127d7af763ea04e497bfe5fcf6e5ff364c`
- Gameplay variant artifact digest: `sha256:cd52c03393f3aa5cd9f45ed45e0e3833b145220232ff719dc5353b4e3d12b5c8`
- Visual/World v1 closure: `8c3bc6dc07067c3cea016ff76b2023a29fde7933`
- Visual artifact digest: `sha256:054e34dbb20a10184138167066476d64e9a5ede42c1c6bbbd19ae156ba29ada0`
- Art baseline run: `36291898561`
- Art baseline artifact ID: `10921669972`
- Art baseline artifact digest: `sha256:7e8f509e30d24e928c0ded97126af08d904e01a0bd4fe50ac3faa757dc1ae31e`
- Art baseline report SHA-256: `ce4b26a5ad629e4f3a7fb7b2be5e40a467098a002b26dad52ae55a77a6468949`

## Proven engine/file model

Every art role is one complete raster frame. `framesOf(url)` receives no frame dimensions; the engine therefore registers the full source width and height as one frame.

Final production replacement files must be:

- PNG;
- 8-bit RGBA (PNG color type 6);
- non-interlaced;
- exactly one image/frame;
- exact role dimensions below.

No runtime resizing contract is introduced in v1.

## Exact role dimensions

These are both the measured current production source dimensions and the current renderer presentation bases:

| Role | Width | Height |
| --- | ---: | ---: |
| `player` | 49 | 64 |
| `obstacleLow` | 64 | 33 |
| `obstacleWall` | 59 | 64 |
| `orb` | 63 | 64 |
| `cell` | 36 | 64 |
| `skyline` | 384 | 240 |

A final replacement with any other dimensions is refused.

## Final alpha / silhouette gates

The gates below are fixed before generation. Coverage is measured using `alpha >= 128` unless stated otherwise.

### `player`

- coverage: `0.35 .. 0.80`
- opaque-ish bbox width fraction: `>= 0.75`
- bbox height fraction: `>= 0.90`
- bottom transparent margin: `<= 1 px`
- must contain at least one fully transparent pixel and at least one fully opaque pixel

### `obstacleLow`

- coverage: `0.55 .. 0.95`
- bbox width fraction: `>= 0.90`
- bbox height fraction: `>= 0.80`
- bottom transparent margin: `<= 1 px`
- must contain transparent and opaque pixels

The exact `64 × 33` canvas is part of the semantic contract: this is the visually low/jumpable hazard.

### `obstacleWall`

- coverage: `0.70 .. 0.99`
- bbox width fraction: `>= 0.85`
- bbox height fraction: `>= 0.90`
- bottom transparent margin: `<= 1 px`
- must contain transparent and opaque pixels

The exact `59 × 64` canvas is part of the semantic contract: this is the visually tall/non-jumpable wall.

### `orb`

- coverage: `0.45 .. 0.90`
- bbox width fraction: `>= 0.85`
- bbox height fraction: `>= 0.85`
- must contain transparent and opaque pixels

### `cell`

- coverage: `0.60 .. 0.98`
- bbox width fraction: `>= 0.80`
- bbox height fraction: `>= 0.90`
- must contain transparent and opaque pixels

### `skyline`

- final dimensions exactly `384 × 240`
- fully nontransparent: `alpha > 0` coverage must equal `1.0`
- `alpha >= 128` coverage must equal `1.0`
- no fully transparent pixels
- full-image bbox

The current renderer places the skyline behind all gameplay entities and tints it by musical section. An opaque skyline is therefore allowed and matches the proven production baseline.

## Pixel-content validity

For every generated final asset:

- at least 2 distinct RGB colors among pixels with alpha >= 128;
- no nonfinite/invalid decode state;
- PNG must round-trip through the deterministic v1 decoder;
- final byte SHA-256 is recorded.

For gameplay sprites (`player`, both obstacles, `orb`, `cell`) a future stage must additionally pass rendered readability against all four closed Visual-v1 skins before publication.

## Gameplay-semantic preservation

Art is presentation only. Generated files must not cause source/runtime changes to:

- player collision width or lane position;
- low-obstacle jump rule;
- wall-obstacle non-jumpable rule;
- pickup collision radius/lane rule;
- score values;
- movement/jump physics;
- scene projection constants.

The low/wall distinction is preserved by both separate art roles and their exact fixed canvas geometries. v1 must not swap the URLs between those roles.

## Generation provenance

A generated candidate is not considered deterministic merely because its prompt is deterministic.

For every candidate record:

- role;
- song identity / analysis SHA used to request it;
- selected Visual-v1 skin ID;
- exact generation instruction text or immutable instruction ID;
- generation provider/model identifier when available;
- original generated candidate byte SHA-256 when file bytes are available;
- deterministic normalization source SHA-256;
- final normalized PNG SHA-256.

Once a candidate is accepted, its byte hash is the immutable identity used downstream.

## No threshold hunting

For each song/role proof stage:

- generate at most one primary candidate under the frozen instruction;
- normalize it once using the frozen normalization procedure;
- run frozen QC;
- if it fails, do not modify thresholds or silently choose a different candidate in the same proof;
- keep the existing proven production art URL as the fail-closed fallback.

A later separately preregistered experiment may test a revised prompt/model.

## Deterministic normalization

Generated source images may be larger than final Trackcade dimensions.

Normalization must be deterministic and role-specific:

### Skyline

1. decode source to RGBA;
2. require source width/height >= final dimensions;
3. center-crop source to the exact target aspect `384:240` without stretching;
4. resize to `384 × 240` using one frozen high-quality downsampling algorithm;
5. composite any source transparency over a deterministic background derived from the selected Visual-v1 `skyTop` / `skyBottom` vertical gradient so final alpha is 255 everywhere;
6. write deterministic non-interlaced 8-bit RGBA PNG.

### Gameplay sprites — later stage

A separate implementation must define deterministic subject fitting/background removal rules before sprite generation is unblocked. This spec intentionally does not allow ad-hoc crop/background cleanup after seeing a generated sprite.

## Initial skyline-generation instructions

The first proof uses the closed product songs and their already-selected Visual-v1 skins.

### ALLDAT / `violet-circuit`

Generate one wide 2D game-background image of a futuristic night-city skyline for a fast neon rhythm runner. Visual language: deep violet and indigo architecture, cool cyan window accents, sparse magenta/violet light, rain-dark atmosphere, bold readable building silhouettes, no road, no foreground character, no vehicles, no text, no logos, no UI. The image must tile tolerably when drawn twice side-by-side; keep the far left and far right edge density visually compatible. Composition should remain a distant skyline band suitable for tinting by the runtime.

### CVB — G.E.M.F. / `neon-night`

Generate one wide 2D game-background image of a rainy cyberpunk night-city skyline for a fast neon rhythm runner. Visual language: very dark navy/blue architecture, cyan lights, restrained hot-pink accents, bold readable building silhouettes, no road, no foreground character, no vehicles, no text, no logos, no UI. The image must tile tolerably when drawn twice side-by-side; keep the far left and far right edge density visually compatible. Composition should remain a distant skyline band suitable for tinting by the runtime.

These instructions are frozen before the first generated candidates exist.

## Skyline proof gate

For each of ALLDAT and CVB:

1. generate exactly one primary skyline candidate using the frozen instruction above;
2. normalize deterministically to `384 × 240`;
3. run structural PNG/alpha/content QC;
4. construct a copy of all three closed Visual-v1 manifests for that song with **only `art.skyline` plus `generation.artAssetsV1` changed**;
5. require raw manifest equality outside those allowed fields;
6. require real Trackcade loader validation;
7. keep player/obstacle/orb/cell URLs unchanged;
8. retain the same generated skyline URL across relaxed/standard/rush;
9. preserve Visual-v1 palette and all music/gameplay fields exactly.

Until a stable hosting path for final generated bytes is proven, generated skyline files may remain evidence artifacts and the production manifest URL must stay on the existing skyline. The lane must not invent a fake public URL.

## Safe fallback

The existing six production URLs are the authoritative fallback. A failed generated candidate does not degrade an otherwise playable Trackcade release.

## Later sprite stage

Only after skyline generation/normalization/QC is proven may Art Assets v1 preregister sprite-specific generated-image instructions and rendered readability gates for:

- player;
- low obstacle;
- wall obstacle;
- orb;
- cell.

No sprite image should be generated before that later contract is frozen.
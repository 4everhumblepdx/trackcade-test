# Trackcade Art Asset Generation v1 — Baseline Asset Audit

Status: **preregistered read-only discovery; no generated art and no acceptance thresholds yet**

## Purpose

Before defining replacement-image requirements, measure the six art assets that the closed Visual/World v1 foundation already uses successfully in the real Trackcade runtime.

This audit is descriptive. It must not alter manifests, runtime code, gameplay, visual palettes, or any existing asset. It must not turn observed values into acceptance thresholds in the same run.

## Frozen upstream identity

- Analyzer production branch: `release/analyzer-v0.19`
- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- Structure v1 safe-manifest artifact digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`
- Gameplay/Difficulty v1 closure commit: `141bf6127d7af763ea04e497bfe5fcf6e5ff364c`
- Gameplay-v1 variant artifact digest: `sha256:cd52c03393f3aa5cd9f45ed45e0e3833b145220232ff719dc5353b4e3d12b5c8`
- Visual/World v1 closure commit: `8c3bc6dc07067c3cea016ff76b2023a29fde7933`
- Visual-v1 terminal artifact digest: `sha256:054e34dbb20a10184138167066476d64e9a5ede42c1c6bbbd19ae156ba29ada0`

## Proven engine-side frame behavior

Trackcade preloads each art URL with `load.image(url)` and later calls `game.assets.framesOf(url)` without `frameW` or `frameH`.

The engine implementation therefore:

1. uses the full image height as one row when `frameH` is absent;
2. passes no frame width to the atlas;
3. `Atlas.add()` defaults `frameW` to `src.width`;
4. returns one full-image frame for the role.

Art Asset v1 therefore treats each current URL as one complete raster image, not a sprite sheet.

## Roles to audit

Read the exact URLs from `FALLBACK_TRACK.art` in `src/track.config.js` for:

- `player`
- `obstacleLow`
- `obstacleWall`
- `orb`
- `cell`
- `skyline`

Do not substitute mirrors or alternate files.

## Download evidence

For every role, record:

- exact URL;
- HTTP success or refusal;
- byte length;
- SHA-256 of the downloaded bytes;
- PNG signature validity.

The workflow must fail if a current production asset cannot be downloaded or is not a valid PNG, because an incomplete baseline must not be presented as complete.

## PNG structural facts

Parse PNG chunks with standard-library code only and record:

- width;
- height;
- bit depth;
- PNG color type;
- interlace method;
- presence/length of `PLTE` when applicable;
- presence/length of `tRNS` when applicable;
- total compressed IDAT bytes.

For pixel-level alpha analysis, v1 audit supports non-interlaced 8-bit PNGs with color types 0, 2, 3, 4, and 6. If any current asset is outside that set, record the unsupported encoding and fail the pixel-analysis phase rather than guessing.

## Deterministic PNG decode

Concatenate IDAT payloads, zlib-decompress them, and reverse PNG scanline filters exactly:

- filter 0: None;
- filter 1: Sub;
- filter 2: Up;
- filter 3: Average;
- filter 4: Paeth.

For color type 3, use `tRNS` alpha values when present; palette entries without a corresponding `tRNS` byte are alpha 255.

For color types without a direct alpha channel, honor a supported `tRNS` transparent sample if present; otherwise alpha is 255.

## Alpha / silhouette facts

For each decoded image record both `alpha > 0` and `alpha >= 128` statistics:

- nontransparent pixel count;
- coverage fraction of the full image;
- smallest x/y and largest x/y containing such pixels;
- bounding-box width/height;
- bounding-box fractions of source width/height;
- transparent margins: left, right, top, bottom;
- whether nontransparent pixels touch each image edge.

Also record:

- count/fraction of fully transparent pixels (`alpha == 0`);
- count/fraction of fully opaque pixels (`alpha == 255`);
- count/fraction of partially transparent pixels (`0 < alpha < 255`);
- minimum and maximum alpha present.

## Runtime presentation constants

Record, separately from measured source dimensions, the current renderer’s hard-coded presentation geometry:

- player: `49 × 64` natural draw basis before the common player scale;
- obstacleLow: `64 × 33`;
- obstacleWall: `59 × 64`;
- orb: `63 × 64`;
- cell: `36 × 64`;
- skyline presentation aspect: `384 × 240` (`240/384`).

These values are runtime presentation facts, not assumed source-image dimensions. The audit must explicitly compare measured source dimensions/aspect ratios with these renderer constants.

## Output

Produce one deterministic JSON report containing:

- frozen provenance;
- engine frame-behavior facts;
- six role records;
- runtime presentation constants;
- source-vs-runtime dimension/aspect comparison;
- no recommendations and no acceptance thresholds.

Run the audit twice in the same workflow and byte-compare reports.

Freeze SHA-256 for:

- both downloaded asset byte sets;
- the final report;
- audit spec and audit source;
- relevant engine/runtime source files.

## Non-goals

This baseline audit does not:

- generate images;
- choose prompts or styles;
- approve any replacement image;
- define final dimension tolerances;
- define final alpha/silhouette thresholds;
- modify the six production URLs;
- perform subjective aesthetic ranking.

The next Art Asset v1 step may use this immutable baseline plus runtime semantics to preregister replacement-image requirements **before** any generated replacement is created.
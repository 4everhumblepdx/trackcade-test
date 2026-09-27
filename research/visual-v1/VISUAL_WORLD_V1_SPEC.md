# Trackcade Visual / World Generation v1 — Preregistered Contract

Status: **preregistered before generator implementation or visual-v1 workflow results**

## Purpose

Visual / World v1 adds deterministic per-song world identity to the already validated automatic Trackcade pipeline without reopening Analyzer, Structure, Gameplay/Difficulty, collision logic, or music timing.

This v1 is deliberately narrower than free-form AI art generation. The current renderer has six fixed sprite roles with role-specific sizing/behavior assumptions. Until new art assets have their own asset-format and readability proof, Visual v1 will keep those six proven sprite URLs unchanged and vary the runtime world through the manifest palette only.

## Frozen upstream chain

Visual v1 starts from the closed Gameplay/Difficulty v1 foundation.

- Analyzer production branch: `release/analyzer-v0.19`
- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Exact reproducible Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- Structure v1 safe-manifest source run: `36281637484`
- Structure v1 safe-manifest artifact ID: `10918568524`
- Structure v1 safe-manifest artifact digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`
- Gameplay/Difficulty v1 closure commit: `141bf6127d7af763ea04e497bfe5fcf6e5ff364c`
- Gameplay v1 difficulty-variant validation run: `36288512590`
- Gameplay v1 difficulty-variant artifact ID: `10921566934`
- Gameplay v1 difficulty-variant artifact digest: `sha256:cd52c03393f3aa5cd9f45ed45e0e3833b145220232ff719dc5353b4e3d12b5c8`

The experimental `analyzer-v020-phase-context` branch is research-only and is not substituted for v0.19.

## Runtime visual surface

The current manifest exposes exactly 13 palette fields:

- `skyTop`
- `skyBottom`
- `road`
- `roadAlt`
- `laneGlow`
- `edgeLeft`
- `edgeRight`
- `primary`
- `secondary`
- `collectible`
- `hazard`
- `overdriveA`
- `overdriveB`

It also exposes exactly six art roles:

- `player`
- `obstacleLow`
- `obstacleWall`
- `orb`
- `cell`
- `skyline`

Visual v1 may modify only the 13 palette values plus its own generation metadata. All six art URLs remain byte-for-byte unchanged from the input gameplay manifest.

## Input

The generator consumes one validated Gameplay v1 difficulty-variant pack for a song. A valid pack contains the publishable manifests produced by Gameplay v1, currently:

- `relaxed.json`
- `standard.json`
- `rush.json`

The generator must refuse a pack if:

- `standard.json` is absent;
- manifests disagree on song identity/timeline;
- manifests disagree on the song analysis identity when `analysisJsonSha256` is present;
- any expected art role is missing after real loader validation;
- any input manifest fails real Trackcade loader validation.

## Per-song skin identity

All difficulty modes for one song must receive the same skin.

Selection seed:

1. use `generation.analysisJsonSha256` when it is a 64-character hexadecimal SHA-256;
2. otherwise use the SHA-256 of the UTF-8 string:
   `artist + "\0" + title + "\0" + audioUrl + "\0" + bpm + "\0" + songLength`.

Take the first 8 hexadecimal characters of the resulting seed as an unsigned 32-bit integer and select:

`skinIndex = value mod 4`.

No result-dependent search, retry, nearest-safe skin substitution, or per-difficulty-mode skin selection is allowed.

## Frozen curated skins

The skin set is fixed before seeing Visual v1 workflow outcomes.

### 0 — `neon-night`

```json
{
  "skyTop": "#070a1e",
  "skyBottom": "#1b1440",
  "road": "#1a2142",
  "roadAlt": "#121831",
  "laneGlow": "#19e3ff",
  "edgeLeft": "#ff2fb0",
  "edgeRight": "#19e3ff",
  "primary": "#19e3ff",
  "secondary": "#ff2fb0",
  "collectible": "#ffd147",
  "hazard": "#ff4d6d",
  "overdriveA": "#ff9a3d",
  "overdriveB": "#ff2fb0"
}
```

### 1 — `violet-circuit`

```json
{
  "skyTop": "#08061a",
  "skyBottom": "#24134a",
  "road": "#17152f",
  "roadAlt": "#0f1024",
  "laneGlow": "#7cf7ff",
  "edgeLeft": "#b85cff",
  "edgeRight": "#36e7ff",
  "primary": "#7cf7ff",
  "secondary": "#c46cff",
  "collectible": "#ffe36e",
  "hazard": "#ff5577",
  "overdriveA": "#ff9b4a",
  "overdriveB": "#c95cff"
}
```

### 2 — `solar-flare`

```json
{
  "skyTop": "#12080b",
  "skyBottom": "#3c1720",
  "road": "#241a22",
  "roadAlt": "#171118",
  "laneGlow": "#6ee7ff",
  "edgeLeft": "#ff8a3d",
  "edgeRight": "#ffd166",
  "primary": "#75e6ff",
  "secondary": "#ff8a3d",
  "collectible": "#ffe27a",
  "hazard": "#ff4b5c",
  "overdriveA": "#ffd166",
  "overdriveB": "#ff5f7a"
}
```

### 3 — `acid-rain`

```json
{
  "skyTop": "#06120f",
  "skyBottom": "#0d2a26",
  "road": "#111d26",
  "roadAlt": "#0a141c",
  "laneGlow": "#7dff8a",
  "edgeLeft": "#c4ff4d",
  "edgeRight": "#55e8ff",
  "primary": "#55e8ff",
  "secondary": "#c4ff4d",
  "collectible": "#ffe66d",
  "hazard": "#ff5364",
  "overdriveA": "#d7ff4d",
  "overdriveB": "#55e8ff"
}
```

## Objective palette QC

Visual v1 uses deterministic numeric QC rather than subjective approval as its publish gate.

Use WCAG relative luminance / contrast-ratio math on sRGB colors.

For each selected skin, each of these foreground colors must have contrast ratio **>= 4.5:1 against both `road` and `roadAlt`**:

- `laneGlow`
- `edgeLeft`
- `edgeRight`
- `primary`
- `secondary`
- `collectible`
- `hazard`
- `overdriveA`
- `overdriveB`

Additional separation gate:

- Euclidean distance between normalized sRGB `hazard` and `collectible` must be >= `0.45`;
- circular HSV hue separation between `hazard` and `collectible` must be >= `45` degrees.

Every palette value must remain exact six-digit `#rrggbb`.

A QC failure refuses the selected skin and therefore refuses the pack. The generator must not choose another skin after failure.

## Immutable-content gate

For every output difficulty manifest, all input fields other than `palette` and `generation.visualWorldV1` must remain deeply equal to the input.

Explicitly immutable:

- artist/title/audio identity;
- BPM, beat offset, song length;
- complete event list;
- complete energy curve;
- all gameplay tuning values;
- scoring values;
- all six art URLs;
- existing `generation` metadata, including Structure and Gameplay provenance.

Visual v1 must not modify source code under `src/` to make a skin pass.

## Output metadata

Each output manifest adds:

```json
{
  "generation": {
    "visualWorldV1": {
      "schema": "trackcade-visual-world-v1",
      "specCommit": "<the commit that preregistered this file>",
      "skinIndex": 0,
      "skinId": "neon-night",
      "selectionSeedSha256": "<64 hex>",
      "paletteQcPass": true,
      "artUrlsPreserved": true,
      "immutableContentPass": true
    }
  }
}
```

The exact preregistration commit is filled into the implementation only after this spec is committed.

## Determinism proof

For each product song:

1. generate the visualized pack twice from the exact same Gameplay-v1 artifact input;
2. byte-compare the two output trees;
3. require identical selected skin IDs across `relaxed`, `standard`, and `rush`;
4. require real Trackcade loader validation for every output manifest;
5. require immutable-content and palette-QC gates for every output;
6. freeze SHA-256 values for reports, publishable manifests, generator/spec source, and the uploaded workflow artifact.

## Product-fixture scope

Initial validation uses the two current real product songs already carried through Structure and Gameplay v1:

- ALLDAT
- CVB — G.E.M.F.

These are product proof fixtures, not a claim of broad aesthetic quality across all future music.

## Non-goals for v1

Not included in this first visual foundation:

- free-form image-model-generated sprite sheets;
- changing player/obstacle/pickup silhouettes;
- changing sprite dimensions or collision semantics;
- generating a new skyline image;
- changing scene geometry, camera projection, lane layout, rain count, building count, or bloom tuning;
- semantic-event generation;
- Analyzer, Structure, or Gameplay/Difficulty changes.

Those can become later visual/world experiments only after this deterministic skin layer is validated.
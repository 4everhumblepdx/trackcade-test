# Trackcade Visual / World Generation v1 — Conclusion

Status: **closed as a validated deterministic visual-identity foundation**

## Decision

Visual / World v1 is complete at the palette/world-skin layer.

Do not reopen Analyzer, Structure, Gameplay/Difficulty, collision logic, or scene geometry to create visual variety.

Do not introduce free-form generated sprite sheets or skyline images into this lane without a separate asset-format/readability/runtime contract and evidence gate.

The validated automatic architecture is now:

**Analyzer v0.19 → Structure v1 → Gameplay/Difficulty v1 → Visual/World v1 deterministic skin → Trackcade runtime**

## Frozen upstream foundation

- Analyzer production source: `release/analyzer-v0.19`
- Analyzer commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- Structure v1 safe-manifest artifact digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`
- Gameplay/Difficulty v1 closure commit: `141bf6127d7af763ea04e497bfe5fcf6e5ff364c`
- Gameplay-v1 variant artifact digest: `sha256:cd52c03393f3aa5cd9f45ed45e0e3833b145220232ff719dc5353b4e3d12b5c8`

The closed v0.20 phase-research branch remains non-production.

## What v1 established

### Deterministic per-song visual identity

One immutable song identity deterministically selects one frozen world skin.

The selection is independent of difficulty mode, so `relaxed`, `standard`, and `rush` remain visually coherent versions of the same song world.

Verified product results:

- ALLDAT → `violet-circuit`
- CVB — G.E.M.F. → `neon-night`

### Fail-closed visual QC

The four preregistered skins are subject to objective numeric gates before publication:

- exact six-digit hex palette values;
- >= `4.5:1` key visual contrast against both road surfaces;
- hazard/collectible normalized-sRGB separation >= `0.45`;
- hazard/collectible hue separation >= `45°`.

All four frozen skins passed the catalog gate.

There is no alternate-skin search when a selected skin fails.

### Gameplay and music remain immutable

For every product output mode, terminal CI proved:

- raw manifest equality outside `palette` and `generation.visualWorldV1`;
- real loader validation;
- loader-resolved equality outside palette;
- unchanged music timeline and energy curve;
- unchanged gameplay/scoring tuning;
- unchanged six resolved art URLs;
- preserved Structure and Gameplay provenance.

### Determinism

Both real product skin packs were generated twice and byte-compared.

Duplicate output trees matched exactly.

## Terminal evidence

Preregistered contract commit:

`29bc1a4a0f7b38172857aca6f7658b0520be0dcc`

Implementation commit:

`6111138d2c7fafc2573485f39545a71c20d0e334`

Terminal validation workflow/head:

`d64382d08096f1f302e58507674e624562699bab`

Workflow run:

`36291338021`

Artifact:

- name: `trackcade-visual-world-v1-skins`
- artifact ID: `10921384592`
- digest: `sha256:054e34dbb20a10184138167066476d64e9a5ede42c1c6bbbd19ae156ba29ada0`

Verified-result record commit:

`b6f68a08f6d2a1ad33f1b841275835e6c9bfa51f`

## What is finished

- runtime visual-surface inventory;
- deterministic song-to-world-skin selection;
- four frozen validated palette skins;
- objective palette readability/separation QC;
- same visual identity across difficulty modes;
- strict music/gameplay/art immutability gate;
- deterministic duplicate-run proof;
- exact upstream provenance and terminal evidence artifact.

## What is not finished

- song-specific generated player art;
- song-specific generated low-obstacle art;
- song-specific generated wall-obstacle art;
- song-specific generated orb/cell art;
- song-specific generated skyline art;
- asset dimension/transparency/sprite-frame validation for generated images;
- automated perceptual/readability testing of generated sprites against every world skin;
- broad subjective aesthetic testing;
- broad multi-song visual coverage beyond the two current product fixtures.

Those are not defects in this closed foundation. They require a different trust boundary because the current renderer makes role-specific assumptions about sprite dimensions, silhouettes, transparency, and visibility.

## Next project lane

Proceed to **art asset generation v1** only as a separate lane.

Start from the closed Visual/World-v1 manifests and keep the palette/gameplay/music foundations invariant.

Before generating any new image asset, first specify and test:

1. exact required file format / dimensions / transparency for each of the six art roles;
2. whether the runtime expects one frame or multiple frames from each URL;
3. role-specific silhouette/readability constraints;
4. background/transparency behavior;
5. collision-meaning preservation for `obstacleLow` vs `obstacleWall`;
6. deterministic asset identity/provenance;
7. fail-closed loader/render preflight;
8. safe fallback to the existing proven asset set.

Do not generate art first and invent the QC contract afterward.

## Non-claim

Visual / World v1 establishes a validated deterministic world-skin layer. It does not claim that arbitrary generated images are safe, that the current four palettes are aesthetically optimal for every song, or that the visual pipeline is finished beyond the palette/world-skin foundation.
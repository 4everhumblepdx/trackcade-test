# Trackcade Visual / World v1 — Verified Result

Status: **verified deterministic world-skin foundation**

## Frozen upstream identity

Visual v1 consumed the exact closed Gameplay/Difficulty v1 artifact and did not rebuild or substitute upstream analysis.

- Analyzer production branch: `release/analyzer-v0.19`
- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- Structure safe-manifest run: `36281637484`
- Structure artifact ID: `10918568524`
- Structure artifact digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`
- Gameplay/Difficulty v1 closure commit: `141bf6127d7af763ea04e497bfe5fcf6e5ff364c`
- Gameplay variant run: `36288512590`
- Gameplay variant artifact ID: `10921566934`
- Gameplay variant artifact digest: `sha256:cd52c03393f3aa5cd9f45ed45e0e3833b145220232ff719dc5353b4e3d12b5c8`

The `analyzer-v020-phase-context` branch remained closed research and was not promoted into this pipeline.

## Preregistration

Visual contract commit:

`29bc1a4a0f7b38172857aca6f7658b0520be0dcc`

The contract froze before implementation/results:

- the exact four-skin catalog;
- deterministic song-to-skin selection;
- no result-dependent retry/substitution;
- 4.5:1 accent-vs-road contrast gate;
- hazard/collectible RGB and hue-separation gates;
- palette-only manifest mutation;
- exact preservation of all six resolved sprite URLs;
- exact preservation of music and gameplay outside palette plus Visual-v1 metadata.

## Implementation / validation identity

- Generator commit: `6111138d2c7fafc2573485f39545a71c20d0e334`
- Workflow/head commit: `d64382d08096f1f302e58507674e624562699bab`
- Workflow: `Trackcade Visual World v1 — Deterministic Skins`
- Run ID: `36291338021`
- Conclusion: `success`
- Artifact: `trackcade-visual-world-v1-skins`
- Artifact ID: `10921384592`
- Artifact size: `59229` bytes
- Artifact digest: `sha256:054e34dbb20a10184138167066476d64e9a5ede42c1c6bbbd19ae156ba29ada0`

The workflow downloaded the Gameplay-v1 artifact by exact run ID and observed the expected digest before generation.

## Product-fixture selections

### ALLDAT

Selection seed / analysis JSON SHA-256:

`a95621998fcd296bd382c553f43853cc71aa98f019914cb2b9f90cdcb7c0d405`

Deterministic result:

- skin index: `1`
- skin ID: `violet-circuit`
- modes: `relaxed`, `standard`, `rush`
- same skin across all modes: yes
- selected palette QC: pass
- full four-skin catalog QC: pass

Visual report SHA-256:

`8dd3037a8b3f06b49d190f7322cf50d949bdc522bface4225ca5df0dcba10e9f`

### CVB — G.E.M.F.

Selection seed / analysis JSON SHA-256:

`35947abc72e8efdeb238db06b2159073af6d5878c899ddcf26759a9d2fa6b00c`

Deterministic result:

- skin index: `0`
- skin ID: `neon-night`
- modes: `relaxed`, `standard`, `rush`
- same skin across all modes: yes
- selected palette QC: pass
- full four-skin catalog QC: pass

Visual report SHA-256:

`77c3fb7cddec26556d89453c9b7c9b15544221e49b5d56636b23c7231a9b1a6a`

## Determinism and immutability proof

The workflow generated both song packs twice and byte-compared each complete output tree. Both comparisons passed.

Independent validation then recomputed the song-selection formula from the Gameplay-v1 source manifests and reproduced the selected skin index/ID exactly.

For every published mode on both songs, validation proved:

- raw input and output are deeply equal after removing only `palette` and `generation.visualWorldV1`;
- real Trackcade loader validation succeeds;
- loader-resolved config is identical outside `palette`;
- all six resolved art URLs are unchanged;
- existing Structure and Gameplay generation metadata is preserved;
- no Analyzer, Structure, or Gameplay/Difficulty tuning is modified.

## Palette QC

All four preregistered skins passed the frozen numeric catalog gate.

For every skin:

- `laneGlow`, `edgeLeft`, `edgeRight`, `primary`, `secondary`, `collectible`, `hazard`, `overdriveA`, and `overdriveB` each meet at least `4.5:1` contrast against both `road` and `roadAlt`;
- normalized-sRGB hazard/collectible distance is at least `0.45`;
- hazard/collectible circular HSV hue separation is at least `45` degrees;
- all 13 palette values are exact six-digit hex colors.

The generator has no fallback-to-another-skin behavior. A selected-skin QC failure would refuse the pack.

## Frozen source hashes

From terminal run `36291338021`:

- `research/visual-v1/VISUAL_WORLD_V1_SPEC.md` SHA-256: `3a0959ca4a5a4c27f0edb6470c7fc5de8b6fcc358d4a9834ae9b4a85888c2100`
- `research/visual-v1/generate_world_skin_v1.mjs` SHA-256: `996769de987e9f427831153c775e03d24a55ca8f8f784156a7b7ec308245c7c1`
- `src/track/loader.js` SHA-256: `f184f9f628a88895eab0d955429c19a52055f79ce1390a08205bfc1b47129b85`
- `src/track.config.js` SHA-256: `6a1ec54d83b404d07b26c252091a6486a58b0619799583aaec7adc137aa94bdf`
- `src/scenes/play.js` SHA-256: `d067ffbe1e28cf620bb932f94f34a02003f0aabd5e9642cefe1b72e3c68fc398`

## What this establishes

Visual / World v1 now has a deterministic, fail-closed, per-song visual identity layer that can be applied after validated Gameplay-v1 difficulty generation without changing music timing, gameplay, scoring, collision behavior, or sprite assets.

This is materially more than a cosmetic hardcoded fallback: different song identities deterministically select from a frozen validated world-skin catalog while all difficulty modes for the same song retain one coherent visual identity.

## Evidence boundary / non-claims

This result does **not** establish:

- that four curated palettes cover every desired artistic genre;
- broad subjective aesthetic preference across users;
- safe arbitrary AI-generated palettes outside the frozen catalog;
- safe generated sprite sheets or skyline images;
- safe changes to sprite silhouettes, dimensions, scene geometry, lane layout, camera, bloom, rain density, or collision behavior.

Only two product songs selected skins in this run. All four catalog skins passed objective palette QC, but the two skins not selected by these fixtures were not exercised as product-song output manifests in this terminal run.

Those are future visual/world expansion problems, not hidden claims of this v1 foundation.
# Trackcade Gameplay / Difficulty v1 — Difficulty Variant Generation Result

Status: **validated — deterministic per-song variant generation is working for both current real product fixtures**

This result records the separately preregistered difficulty-generation experiment. It does not alter the Analyzer, Structure v1, gameplay runtime, pool sizes, or the historical tuning-stress classifications.

## Frozen provenance

Difficulty-variant preregistration:

- spec commit: `c6027dbe3a0f6e5f535a8bd5645ee06e46150f50`

Generator implementation:

- implementation commit: `d30a93d8bd8636eb8c7c1a08e83b837c9ff4c64e`

Validation workflow:

- workflow: `Trackcade Gameplay v1 — Difficulty Variants`
- run: `36288512590`
- workflow head: `d82a7022d61baefb2a57e6dbcaf55d6fee43a1b6`
- conclusion: `success`

Exact Structure v1 input:

- run: `36281637484`
- artifact ID: `10918568524`
- artifact digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`

Production Analyzer remained unchanged:

- release branch: `release/analyzer-v0.19`
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

## Evidence artifact

- artifact: `trackcade-gameplay-v1-difficulty-variants`
- artifact ID: `10921566934`
- size: `60825` bytes
- artifact digest: `sha256:cd52c03393f3aa5cd9f45ed45e0e3833b145220232ff719dc5353b4e3d12b5c8`

Report hashes:

- ALLDAT report: `b47d3cd0a68880cf685eaf935a385fab81fd07fe9ed7ab5441e79c190079213d`
- CVB G.E.M.F. report: `a7ec7361cc6bf609d2fa711b6758d1e4a1227620eb7e7521e15016219b80ec43`

Frozen source hashes captured by the workflow:

- `GAMEPLAY_DIFFICULTY_VARIANTS_SPEC.md`: `9f8635f8604ec47b98833bca6d1b7d57a9321caf5eb05e35abc79538c85896e1`
- `generate_difficulty_variants_v1.mjs`: `149512612807b141d88b5551acea39a058814af703841b3eab0d837cf59a2378`
- `preflight_gameplay_v1.mjs`: `ac591ac4e14042819e38866e6c595a8b59e2a8f85dc5c85cb859abb959d846fd`
- `audit_gameplay_v1.mjs`: `4bfdf8d1055fbc59012871b9dbecb2bd264d6af0d236ad88aa473fc379e24763`

## Determinism and integrity

Both product packs were generated twice into independent output trees.

- ALLDAT duplicate trees: byte-identical
- CVB G.E.M.F. duplicate trees: byte-identical

Every candidate passed the generator's immutable-source check. Pre-existing non-tuning content and pre-existing Structure/Analyzer generation metadata remained unchanged; the generator added only deterministic `generation.gameplayDifficultyV1` provenance.

No mode search occurred after seeing QC outcomes. The three preregistered mode definitions remained fixed.

## Published modes

Both real product fixtures published all three preregistered modes:

- `relaxed`
- `standard`
- `rush`

Every published manifest has its own deterministic whole-song `qc_pass` evidence from the existing Gameplay v1 preflight.

### ALLDAT

| Mode | Rows | Obstacle peak | Pickup peak | Lane-only proof | Bottleneck slack |
| --- | ---: | ---: | ---: | --- | ---: |
| `relaxed` | 295 | 14 / 28 | 6 / 24 | pass | `0.4014958027 s` |
| `standard` | 590 | 27 / 28 | 11 / 24 | pass | `0.0800146295 s` |
| `rush` | 590 | 20 / 28 | 10 / 24 | pass | `0.0800292506 s` |

### CVB — G.E.M.F.

| Mode | Rows | Obstacle peak | Pickup peak | Lane-only proof | Bottleneck slack |
| --- | ---: | ---: | ---: | --- | ---: |
| `relaxed` | 406 | 12 / 28 | 6 / 24 | pass | `0.4849954159 s` |
| `standard` | 812 | 24 / 28 | 10 / 24 | pass | `0.1215793406 s` |
| `rush` | 812 | 18 / 28 | 9 / 24 | pass | `0.1216359948 s` |

These reproduce the corresponding points from the preregistered tuning-stress evidence.

## Mode definitions validated

### `relaxed`

- `spawnRowEveryBeats = 2`
- all other gameplay tuning falls through to the existing loader defaults

### `standard`

- no gameplay override
- existing loader-default safe baseline

### `rush`

- `baseSpeed = 160`
- `maxSpeed = 500`
- `speedRampPerSec = 2.0`
- `spawnRowEveryBeats = 1`
- lane switching and jump physics remain loader defaults

## Product behavior

The generator is fail-closed per song:

- `standard` is mandatory; if standard does not return `qc_pass`, no variant pack is published;
- `relaxed` and `rush` are optional; a refused candidate remains documented in QC but is not copied into `publishable/`;
- no replacement tuning is searched under a failed mode name;
- no candidate can bypass the existing whole-song gameplay preflight.

This gives Trackcade a deterministic bridge from the closed Structure v1 safe manifest to song-specific gameplay variants while keeping the safe baseline as the invariant fallback.

## Relationship to earlier evidence

The earlier tuning-stress experiment established which fixed tuning points were safe or unsafe on the two current product grids. This generator operationalizes three already-preregistered safe points rather than inventing new thresholds after the fact.

The separate jump-aware experiment remains useful evidence for lane-pressure profiles that the conservative lane-only auditor could not resolve, but this first variant generator intentionally publishes only modes that pass the stricter lane-only `qc_pass` gate.

## Known boundaries

This result does not change these established facts:

- fixed-pool overflow remains a real refusal condition;
- unsafe legacy/template tuning must not be preserved by enlarging pools;
- `spawnMinGapZ` is still not enforced on the current beat-driven runtime path and must not be represented as a safety guarantee;
- automatic `drop`, `peak`, and discrete `energy` semantic events are not introduced by these variants;
- only two real product songs are available in the repository, so this is not a universal music-corpus claim.

## Conclusion

Gameplay/Difficulty v1 now has a validated deterministic generation mechanism, not only diagnostics:

**safe Structure v1 manifest → fixed candidate gameplay modes → exact whole-song fail-closed QC → publish only song-safe variants**

For both current real product songs, all three current candidate modes are publishable and reproduce previously measured safety behavior.

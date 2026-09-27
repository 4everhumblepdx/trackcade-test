# Trackcade Gameplay v1 — Verified Product Findings

Status: **evidence checkpoint; default path accepted for current product fixtures, broader tuning envelope not yet established**

This document records the verified gameplay/difficulty evidence available after the first whole-song QC and fail-closed preflight work. It is intentionally narrower than a production-wide safety claim.

## Frozen upstream identity

Gameplay v1 consumes the closed Structure v1 output and does not modify Analyzer or Structure behavior.

- Analyzer source branch: `release/analyzer-v0.19`
- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Exact reproducible v0.19 runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- Structure v1 safe-manifest source run: `36281637484`
- Structure v1 safe-manifest artifact ID: `10918568524`
- Structure v1 safe-manifest artifact digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`

## Terminal verified gameplay QC / preflight evidence

- Gameplay QC/preflight run: `36283334780`
- Head commit: `38c4b41b9e2fddc7b58fe47cbb3e85fe8106c737`
- Artifact: `trackcade-gameplay-v1-whole-song-qc`
- Artifact ID: `10920135382`
- Artifact digest: `sha256:d7d3283936f52f57eb8f240c3ecd88c9ec33d57b5629b63563cfb1f1b4164859`

The workflow runs deterministic whole-song audits twice and byte-compares the results before accepting them.

## Product-fixture results

| Fixture | Tuning source | Status | Max obstacle demand | Capacity | Max pickup demand | Lane-only proof |
| --- | --- | --- | ---: | ---: | ---: | --- |
| ALLDAT-MINIMAL | loader `FALLBACK_TRACK` defaults | `qc_pass` | 27 | 28 | 11 | pass |
| CVB-GEMF-MINIMAL | loader `FALLBACK_TRACK` defaults | `qc_pass` | 24 | 28 | 11 | pass |
| BUILTIN-FALLBACK | built-in track | `qc_pass` | 19 | 28 | 9 | pass |
| ALLDAT-TEMPLATE | inherited legacy/custom tuning | `pool_overflow_risk` | 36 | 28 | 14 | pass |
| CVB-GEMF-TEMPLATE | inherited legacy/custom tuning | `pool_overflow_risk` | 33 | 28 | 14 | pass |

The two real product songs therefore support a specific conclusion: the precise Analyzer/Structure beat grids are compatible with the current default gameplay profile, while the inherited custom/template tuning used by the old hand-authored manifests can exceed the fixed obstacle pool.

This is evidence against increasing pool size merely to preserve unsafe template tuning. The observed failure is correctly classified and can be rejected before play.

## Fail-closed preflight

`research/gameplay-v1/preflight_gameplay_v1.mjs` is a thin wrapper around the deterministic whole-song auditor. It does not duplicate gameplay simulation logic.

Verified behavior in run `36283334780`:

- ALLDAT-MINIMAL: accepted, exit `0`
- CVB-GEMF-MINIMAL: accepted, exit `0`
- ALLDAT-TEMPLATE: refused, exit `2`
- CVB-GEMF-TEMPLATE: refused, exit `2`

The preflight also fails closed on auditor execution, result-read, or schema errors.

## `spawnMinGapZ` finding

The current beat-driven runtime does **not** enforce `spawnMinGapZ` on its active spawn path. The auditor reports `spawnMinGapZEnforcedByCurrentBeatSpawnPath=false` for the audited manifests.

Observed minimum spatial gaps under the successful default profile are already below the configured default value of 80 world units:

- ALLDAT-MINIMAL: approximately `39.98`
- CVB-GEMF-MINIMAL: approximately `28.65`

Therefore `spawnMinGapZ` must not be represented as a current runtime safety guarantee. Blindly enforcing it now would materially change successful beat-driven gameplay and would skip many current beat spawns. That is a separate design/runtime-contract decision, not a corrective patch justified by this evidence.

## Evidence boundary

The repository contains only two real product MP3 fixtures:

- `ALLDAT_ruffmix.mp3`
- `cvb-gemf-sample.mp3`

Both corresponding minimal/default gameplay paths pass whole-song QC, but two songs are not a broad music corpus. This checkpoint therefore does **not** claim that every possible song or every custom gameplay profile is safe.

## Current decision

1. Keep Analyzer v0.19 and Structure v1 frozen.
2. Keep the current loader-default gameplay profile unchanged; it passes both available real product songs and the built-in fallback.
3. Keep fixed pool capacities unchanged; do not enlarge them to mask unsafe tuning.
4. Treat custom gameplay tuning as publishable only after deterministic gameplay preflight returns `qc_pass`.
5. Do not enforce `spawnMinGapZ` in the runtime without a separately specified experiment and product decision.
6. Next evidence step: preregister and run a deterministic tuning-envelope stress matrix against the frozen ALLDAT and CVB beat grids. This should map which gameplay-profile changes remain safe without modifying Analyzer or Structure.

## Non-claim

Gameplay v1 has established a safe current default for the available product fixtures and a fail-closed custom-tuning gate. It has **not yet established a universal safe tuning envelope**.
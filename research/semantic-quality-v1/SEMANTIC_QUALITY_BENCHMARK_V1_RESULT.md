# Trackcade Semantic Quality Benchmark v1 — Result

Status: **valid frozen two-product baseline; semantic labels are materially weaker than landmark timing**

## Frozen run

- branch: `trackcade-semantic-quality-v1`
- tested commit: `f21e434e2454928a4df7b0661c56a4b238ccb1c8`
- workflow: `Trackcade Semantic Quality Benchmark v1`
- run ID: `36342720212`
- job ID: `108685831246`
- conclusion: `success`
- artifact: `trackcade-semantic-quality-v1-baseline`
- artifact ID: `10939642086`
- artifact digest: `sha256:5d08033b38f0bc479da225b8a4c7aff9ac630131a53ab69a10c476634029ce7a`
- benchmark JSON SHA-256: `264f18ebbff76adae1614958476a50f5b49e7339c0b69bfbd3c7635129cec890`

The first workflow attempt failed before scoring because checkout history was shallow and the frozen closure commit could not be resolved. Commit `f21e434e...` changed only checkout depth to make that integrity comparison possible. The benchmark spec, evaluator, proposals, authored references, fixed timing windows, and matching rules were unchanged.

## Frozen identities

Musical Interpretation v1 closure:

- `76c247a5df79a8dc169c4cd933e4499a0ced1fa5`

Production Analyzer:

- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

Frozen integration artifact:

- run ID: `36323696425`
- artifact ID: `10933550802`
- digest: `sha256:6a6b05b6da7c5f59d4473cbb497edce7de2ad2a3ecc7a4d795a6d6f63bc784ab`

Input / evaluator evidence hashes from the successful run:

- benchmark spec: `0d045e60a5c3c17a5eb500d25d47e59308f834f90a7f495a1de9b88c3dee8665`
- evaluator: `7ea69b20af7203a79d282b5a77f8c7702128236f143d5d0e413e29eb85578ff2`
- ALLDAT authored reference: `9cf98b7ab89de5c2cc2d7be0a2c74a255d7e6e5e9d948c243f841d8a6a738e74`
- CVB authored reference: `d4c4b16c0a40715e36b37631622798120a25a4b5e545d7c409dd711775da8f04`
- ALLDAT proposal artifact file: `a0f42514fa98f52f32392c541834646738cc7b61a614c72e591fbd8ff8e05387`
- CVB proposal artifact file: `6d91efb94df2ff4d78c1ca5962f82864f8849a7d6f5454f36c526747940765ec`
- ALLDAT compiler report: `61f5308064747c83a1c2fa1c9ec006713eb7c191273608074398fbeaf0ac0516`
- CVB compiler report: `98108dd3773d21e3a2f606fbb377333aba3f51cdd045073d61a3ca1b50773af2`

Duplicate benchmark executions produced byte-identical JSON.

## Aggregate baseline

There are `29` authored semantic reference events across the two product songs.

### 1-second window

| View | Exact-kind matched | Exact P / R / F1 | Landmark-only matched | Landmark F1 |
| --- | ---: | --- | ---: | ---: |
| proposal intent | 2 / 15 candidates | 0.1333 / 0.0690 / **0.0909** | 5 | **0.2273** |
| accepted compiled | 1 / 14 candidates | 0.0714 / 0.0345 / **0.0465** | 5 | **0.2326** |

### 2-second window

| View | Exact-kind matched | Exact P / R / F1 | Landmark-only matched | Landmark F1 |
| --- | ---: | --- | ---: | ---: |
| proposal intent | 3 / 15 candidates | 0.2000 / 0.1034 / **0.1364** | 7 | **0.3182** |
| accepted compiled | 2 / 14 candidates | 0.1429 / 0.0690 / **0.0930** | 7 | **0.3256** |

### 4-second window

| View | Exact-kind matched | Exact P / R / F1 | Landmark-only matched | Landmark F1 |
| --- | ---: | --- | ---: | ---: |
| proposal intent | 4 / 15 candidates | 0.2667 / 0.1379 / **0.1818** | 9 | **0.4091** |
| accepted compiled | 3 / 14 candidates | 0.2143 / 0.1034 / **0.1395** | 9 | **0.4186** |

The central baseline finding is therefore stable across all fixed windows: **the v1 evidence-only interpreter is substantially better at selecting musically salient moments than at assigning the same gameplay-semantic kind as the hand-authored reference.**

## Product-level findings at 4 seconds

### ALLDAT

Accepted-compiled exact-kind F1: `0.0`.

Accepted landmarks still match four authored moments, but with different semantic kinds:

- `15.498 s` `section` → authored `15.5 s` `drop` (`0.002 s` error);
- `116.789 s` `drop` → authored `117.0 s` `section` (`0.211 s` error);
- `158.634 s` `energy` → authored `155.0 s` `peak` (`3.634 s` error);
- `178.892 s` `peak` → authored `177.0 s` `drop` (`1.892 s` error).

The pre-gate proposal view contains one exact-kind ALLDAT match that the compiler intentionally rejects:

- proposed `drop` at deterministic anchor `15.498 s` vs authored `drop` at `15.5 s`, `0.002 s` timing error;
- compiler rejection reason: anchor inside low-demand window.

This is not evidence that the compiler should be weakened. It demonstrates the distinction between matching a human-authored semantic label and satisfying Trackcade's independently frozen gameplay-safety policy.

### CVB — G.E.M.F.

At 4 seconds, accepted compiled semantics contain three exact-kind matches:

- `section` `149.561 s` → authored section `150.4 s` (`0.839 s` error);
- `peak` `214.032 s` → authored peak `211.0 s` (`3.032 s` error);
- `energy` `261.635 s` → authored energy `260.0 s` (`1.635 s` error).

The landmark-only view also exposes meaningful semantic confusions:

- `section` `15.29 s` → authored `energy` `15.5 s`;
- `peak` `61.794 s` → authored `drop` `61.8 s` (`0.006 s` timing error);
- the three exact-kind matches above.

That `61.794 s` case is the clearest example of why the next interpreter should improve **meaning assignment**, not timing authority: Structure Evidence found the musical moment essentially exactly, while the semantic layer chose a different high-impact command.

## Compiler effect

The deterministic compiler reduces proposal count from `15` to `14` across the two fixtures by rejecting the ALLDAT opening drop. It does not shift accepted timing away from deterministic anchors.

On this tiny benchmark, compiler gating slightly improves landmark-only aggregate F1 at all three windows because it removes one competing command, while exact-kind aggregate F1 decreases because that rejected command happened to match the authored ALLDAT label.

Do not interpret this as a reason to optimize compiler thresholds against the two authored timelines. The compiler is a safety/release gate, not the semantic classifier.

## Decision

Freeze this result as the baseline for future automated/learned interpreters.

Do not retune Musical Interpretation v1 proposals, compiler thresholds, Structure Evidence, or Analyzer v0.19 against these scores.

The next interpreter should be judged first on whether it improves semantic-kind agreement while preserving the closed trust boundary:

- timing remains deterministic Structure Evidence;
- the model/provider chooses meaning, not independent timestamps;
- authored reference labels/times are never model inputs;
- the closed v1 compiler remains the release gate;
- downstream Gameplay/Visual safety checks remain independent.

## Claim boundary

This is a **two-visible-product-fixture diagnostic baseline**, not an independent holdout and not broad-song accuracy.

The scores show a useful engineering direction, not a generalization claim. A production learned interpreter will still require larger independently labeled evaluation data before promotion.

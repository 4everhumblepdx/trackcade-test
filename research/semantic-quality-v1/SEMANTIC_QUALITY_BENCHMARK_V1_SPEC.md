# Trackcade Semantic Quality Benchmark v1 — Preregistered Spec

Status: **frozen descriptive product-fixture benchmark before evaluator/results**

## Question

How closely do the already-frozen Musical Interpretation v1 semantic proposals — and the subset accepted by the deterministic semantic compiler — agree with Trackcade's two existing hand-authored product timelines?

This benchmark is a quality yardstick for future learned/audio-capable interpreters. It does **not** grant semantic labels timing authority, and it does not modify Analyzer, Structure Evidence, the v1 proposal fixtures, compiler gates, Gameplay, or any product manifest.

## Frozen upstream identity

Benchmark branch base / Musical Interpretation v1 closure:

- `76c247a5df79a8dc169c4cd933e4499a0ced1fa5`

Production Analyzer remains:

- branch: `release/analyzer-v0.19`
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

Frozen Musical Interpretation v1 integration proof:

- run ID: `36323696425`
- artifact ID: `10933550802`
- artifact name: `trackcade-musical-interpretation-v1-evidence-only`
- artifact digest: `sha256:6a6b05b6da7c5f59d4473cbb497edce7de2ad2a3ecc7a4d795a6d6f63bc784ab`

Frozen proposal blobs at closure:

- ALLDAT: `research/interpretation-v1/proposals/alldat-evidence-only-v1.json`, blob `bd260f6f43bbca70e1dfb2e4a79c60eb7ea8e046`
- CVB — G.E.M.F.: `research/interpretation-v1/proposals/cvb-gemf-evidence-only-v1.json`, blob `901c2c66bd94cd556ae021f62caa178a603d0890`

## Evaluation references

Existing hand-authored product timelines are used **only as evaluation references**:

- `alldat-trackcade.json` at closure commit `76c247a5df79a8dc169c4cd933e4499a0ced1fa5`
- `cvb-gemf-trackcade.json` at closure commit `76c247a5df79a8dc169c4cd933e4499a0ced1fa5`

Reference semantic kinds are the manifest events already present there: `section`, `drop`, `energy`, and `peak`.

No reference event, time, name, duration, or label may be supplied to proposal generation or compiler decisions in this benchmark.

## Leakage / claim boundary

The v1 evidence-only proposals and integration artifact were frozen before this benchmark branch and must not be regenerated or edited after reference inspection.

However, these two product songs are **not an independent scientific holdout**. Their authored timelines are project-visible product fixtures and have been used previously for product validation. Therefore this benchmark is a deterministic regression/baseline yardstick, not evidence of broad generalization.

No quality score from these two songs may be advertised as broad-song accuracy.

## Two candidate views

Score both views separately.

### 1. `proposal_intent`

Every frozen v1 proposal is scored, including proposals later rejected by the compiler.

Because proposal JSON intentionally contains evidence-anchor references rather than independent timestamps, resolve each proposal time from the frozen integration compiler report by `proposalIndex`:

- accepted proposal → `accepted[].anchor.time`;
- rejected proposal → `rejected[].anchor.time`.

The candidate semantic kind is the original proposal `kind`. This view measures interpreter intent before deterministic safety gating.

### 2. `accepted_compiled`

Only frozen compiler-accepted events are scored.

Use:

- kind → `accepted[].kind`;
- time → `accepted[].compiledTime`.

This view measures the semantic commands actually permitted to reach the manifest/runtime.

The evaluator must verify that accepted `compiledTime` equals the referenced accepted `anchor.time` within machine precision; the compiler is not allowed to invent or shift semantic timing.

## Reference set

For each product fixture, score every authored reference event of kinds:

- `section`
- `drop`
- `energy`
- `peak`

Do not score beat events, palette/art fields, tuning, energy-curve samples, or free-text section names as event-class labels.

Section `name` strings remain descriptive metadata and are not part of v1 exact-kind accuracy because the evidence-only interpreter intentionally uses abstract section names rather than a standardized verse/chorus taxonomy.

## Fixed timing windows

Report all metrics independently at these fixed tolerances:

- `1.0 s`
- `2.0 s`
- `4.0 s`

These windows are frozen before benchmark execution. Do not select one after seeing results and do not change them inside v1.

## Deterministic one-to-one matching

For each candidate view and timing window, compute two separate matchings.

### Exact-kind matching

A candidate/reference edge is eligible iff:

- `candidate.kind == reference.kind`, and
- `abs(candidate.time - reference.time) <= window`.

### Landmark-only matching

A candidate/reference edge is eligible iff:

- `abs(candidate.time - reference.time) <= window`, regardless of kind.

For either mode, events are sorted by `(time, originalIndex)`. Use deterministic ordered sequence-alignment dynamic programming with this objective, in priority order:

1. maximize matched-pair count;
2. minimize total absolute timing error among maximum-cardinality solutions;
3. break any remaining tie deterministically by preferring the lexicographically earlier sequence of `(referenceIndex, candidateIndex)` pairs.

Every candidate and reference event can appear in at most one pair.

Do not use a nearest-neighbor greedy matcher.

## Metrics

For each fixture, candidate view, and timing window report:

### Exact-kind

- candidate count;
- reference count;
- matched count;
- precision;
- recall;
- F1;
- matched timing MAE;
- matched timing median absolute error;
- matched timing maximum absolute error.

Also report the same count/precision/recall/F1 metrics per kind: `section`, `drop`, `energy`, `peak`.

For exact-kind matched `drop` pairs where both sides provide a duration, report descriptive duration absolute-error values separately. Duration does not affect event matching.

### Landmark-only

- matched count;
- precision;
- recall;
- F1;
- matched timing MAE / median / maximum absolute error;
- confusion counts of `candidate.kind -> reference.kind` for the matched pairs.

This deliberately separates **finding the right musical moment** from **assigning the right gameplay meaning**.

## Aggregate reporting

Report two aggregate forms without hiding fixture differences:

1. **micro** — sum matched/candidate/reference counts across both songs, then calculate precision/recall/F1;
2. **macro** — arithmetic mean of the two fixture F1 values where defined.

Per-fixture tables remain controlling evidence; aggregate scores must not replace them.

## Benchmark integrity gate

This v1 benchmark has **no semantic-quality pass/fail threshold**. It is a frozen baseline, not a tuning exercise.

The workflow itself passes only if:

- exact closure/reference/proposal identities are present;
- the downloaded integration artifact matches the frozen artifact identity used by the workflow;
- proposal counts and compiler report counts are internally consistent;
- every proposal resolves to exactly one frozen anchor time;
- accepted `compiledTime` and accepted `anchor.time` agree;
- all scored times/metrics are finite when defined;
- duplicate benchmark runs produce byte-identical JSON output.

A poor semantic score is still a valid benchmark result and must not be 'fixed' inside this run.

## Future model comparison rule

Any future learned/audio-capable interpreter compared against this benchmark must:

- produce the same `trackcade-musical-interpretation-v1` proposal schema or an explicitly versioned compatible schema;
- receive no authored reference labels/times as input;
- resolve final gameplay timing only through deterministic Structure Evidence anchors;
- be scored by this exact frozen evaluator/windows before benchmark changes are considered;
- retain the closed v1 semantic compiler as the release gate unless a separate preregistered compiler change is validated.

## What this benchmark cannot prove

Even a very high score here would not prove:

- broad-song or genre generalization;
- human-level musical interpretation;
- independent holdout performance;
- provider/model reproducibility;
- gameplay fun or accessibility;
- correctness of free-text section naming.

Those require larger independently labeled corpora and separate product tests.

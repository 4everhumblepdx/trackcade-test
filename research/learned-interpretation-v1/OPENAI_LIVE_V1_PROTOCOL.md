# Trackcade Learned Interpretation v1 — First Live OpenAI Experiment Protocol

Status: **preregistered before any live provider response**

Purpose: run the first real learned semantic interpreter against the two already-frozen, label-blind Trackcade interpretation packets while preserving the deterministic timing/structure trust boundary and the already-frozen Semantic Quality v1 benchmark.

This is a semantic-quality experiment, not an Analyzer experiment. It must not rerun or retune the Analyzer, structure extractor, semantic compiler, or benchmark.

## Frozen branch state at preregistration

- branch: `trackcade-learned-interpretation-v1`
- parent/result commit before this protocol: `5a1f0b5a358178a4b806ffa651b04aa8f1bbff53`
- provider-neutral learned harness: green
- OpenAI Responses adapter offline conformance: green
- no live OpenAI provider response has been generated for this experiment before this protocol

## Frozen production timing authority

- Analyzer release: `v0.19`
- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

The learned interpreter is not allowed to change BPM, beat offset, beat timestamps, section/evidence anchor timestamps, song length, or timing tier.

## Frozen semantic-generation inputs

Exactly two product fixtures are in scope:

1. `alldat`
2. `cvb-gemf`

The model receives only each fixture's already-frozen label-blind interpretation packet through the already-frozen provider-neutral request builder.

Packet SHA-256 values:

- ALLDAT: `579cbdb6a0ec06e46f93230929949077079d8272b4fb86c2cb274edeb5dabdfa`
- CVB — G.E.M.F.: `69df2dba4ae905a96d51149feed5a57394412c5dba1972085f33e5633a88516f`

Provider-neutral request SHA-256 values from OpenAI adapter conformance:

- ALLDAT: `409ce78afcd4c6062827a0ba60aeb94f6ec311aaa1ccf6e292fd137686c2e03a`
- CVB — G.E.M.F.: `2d6650e1ceb72ddff9f40f13e8f04dbaacc84f7b7935b8843e1ba25088e85e93`

Frozen instruction SHA-256:

- `8bf1231fc4bfeee4897367a72cd77bd569fc9df53c93532052ca43f7446d88e9`

## Frozen upstream artifacts

### Structure evidence

- workflow run: `36281298997`
- artifact: `trackcade-structure-v1-evidence-export`
- artifact ID: `10919375182`
- artifact digest: `sha256:3d4364ab01ee51b4b244f0033aeb5ca598393164e805c6149d4f25c37d9805fc`

### Safe automatic manifests used by the closed Musical Interpretation v1 integration

- workflow run: `36281637484`
- artifact: `trackcade-structure-v1-safe-generated-manifests`
- artifact ID: `10918568524`
- artifact digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`

### Closed Musical Interpretation v1 integration

- workflow run: `36323696425`
- artifact: `trackcade-musical-interpretation-v1-evidence-only`
- artifact ID: `10933550802`
- artifact digest: `sha256:6a6b05b6da7c5f59d4473cbb497edce7de2ad2a3ecc7a4d795a6d6f63bc784ab`

### Frozen semantic-quality baseline

- workflow run: `36342720212`
- artifact: `trackcade-semantic-quality-v1-baseline`
- artifact ID: `10939642086`
- artifact digest: `sha256:5d08033b38f0bc479da225b8a4c7aff9ac630131a53ab69a10c476634029ce7a`
- benchmark result SHA-256: `264f18ebbff76adae1614958476a50f5b49e7339c0b69bfbd3c7635129cec890`
- quality threshold: none; descriptive comparison only

## Frozen OpenAI execution configuration

Provider: OpenAI Responses API.

Requested model alias:

- `gpt-6-astra`

Provider caveat: this protocol freezes the requested alias and the date/run provenance. The exact model identifier returned by the API must be recorded. A distinct dated public snapshot identifier was not available in the provider documentation consulted at preregistration, so this experiment must not claim snapshot-level reproducibility beyond the recorded request/response identities.

Generation configuration:

- reasoning effort: `high`
- maximum output tokens: `4096`
- `store=false`
- provider tools: none
- temperature/top-p: not set by Trackcade; provider defaults apply if supported
- responses per fixture: exactly `1`

No generation parameter is selected after seeing a provider response or benchmark score.

## Generation isolation / leakage prohibition

Before the provider response for each fixture is complete, the generation job must not read, download, parse, or expose to the model:

- `alldat-trackcade.json` or `cvb-gemf-trackcade.json` authored semantic reference events;
- Semantic Quality v1 result JSON or per-kind/confusion metrics;
- the prior evidence-only semantic proposal for that same fixture;
- the prior compiler report or prior compiled semantic manifest for that same fixture;
- any post-generation benchmark result.

The model may receive only:

- the frozen label-blind interpretation packet;
- the frozen response contract/integrity metadata;
- the frozen provider instruction.

## Exactly-once semantic response rule

Each fixture gets one semantic provider response.

A completed response, refusal, incomplete response, structurally invalid response, or proposal rejected by the Trackcade validator is the semantic outcome for that fixture. Do not issue a second semantic request to obtain a more favorable answer.

Infrastructure retries are permitted only when there is no evidence that OpenAI accepted/completed the semantic request and no provider response was obtained. Any such retry must preserve the exact model/config/request bytes and be documented. When it is ambiguous whether a provider request may have completed, fail closed rather than issue another semantic request.

Do not rerun either fixture because its semantic-quality score is poor.

## Required live evidence preservation

For each fixture preserve at minimum:

- exact provider-neutral request bytes and SHA-256;
- exact OpenAI API payload bytes and SHA-256;
- client request ID;
- server `x-request-id` when returned;
- OpenAI response ID;
- requested model alias;
- model string returned by OpenAI;
- exact raw provider-response bytes and SHA-256;
- exact extracted proposal-candidate bytes and SHA-256;
- provider usage metadata if returned;
- provider-neutral validation report;
- normalized proposal only when validation passes;
- auditable provider-run manifest only when validation passes;
- harness source commit;
- execution timestamp with timezone.

The API key must never be logged, uploaded, committed, embedded in parameter JSON, or copied into provider evidence.

## Frozen post-generation processing

Only after both live provider responses are frozen may the workflow expose authored reference timelines for scoring.

For each fixture, if a proposal passes provider-neutral validation:

1. compile it with the existing frozen `research/structure-v1/compile_semantic_events_v1.py`;
2. use the exact safe manifest and structure-evidence artifacts listed above;
3. preserve the compiler report and compiled manifest;
4. verify the compiler does not shift semantic events away from deterministic evidence anchors;
5. verify the beat grid and protected timing fields remain unchanged.

Then score the live proposal/compiler report with the existing frozen `research/semantic-quality-v1/evaluate_semantic_quality_v1.py` against the two hand-authored product timelines.

The benchmark remains descriptive. No live-score pass/fail threshold may be invented after seeing the result.

## Comparison to the frozen evidence-only v1 baseline

Report, without retuning, the live model's aggregate micro F1 alongside the previously frozen evidence-only baseline at each timing window.

Frozen evidence-only baseline:

| window | view | exact-kind micro F1 | landmark-only micro F1 |
|---|---|---:|---:|
| 1s | proposal intent | 0.09090909090909091 | 0.22727272727272724 |
| 1s | accepted compiled | 0.046511627906976744 | 0.23255813953488377 |
| 2s | proposal intent | 0.13636363636363635 | 0.3181818181818182 |
| 2s | accepted compiled | 0.09302325581395349 | 0.32558139534883723 |
| 4s | proposal intent | 0.18181818181818182 | 0.4090909090909091 |
| 4s | accepted compiled | 0.1395348837209302 | 0.4186046511627907 |

These two visible product fixtures are already benchmark fixtures, not an independent holdout. Any apparent improvement is descriptive product-fixture evidence only and must not be described as generalized accuracy.

## Terminal interpretation of this experiment

Possible conclusions:

- **valid live baseline**: both provider responses are frozen and the full validator/compiler/benchmark path completes;
- **partial valid baseline**: exactly one fixture yields a valid proposal while the other yields a refusal/incomplete/invalid/rejected semantic outcome; preserve both and do not retry the failed semantic fixture;
- **infrastructure inconclusive**: the experiment cannot obtain a provider response and the evidence supports that the provider never accepted/completed the semantic request; no semantic claim;
- **transport/format failure**: provider response exists but cannot cross the frozen adapter/validator boundary; preserve it as the outcome and do not semantic-retry;
- **scientifically weak semantics**: valid provider output compiles/scores but does not materially improve the frozen descriptive baseline; record it without prompt/model/threshold retuning on these same two fixtures.

No result from this experiment changes Analyzer v0.19 production timing authority.

# Trackcade Learned Interpretation v1 — GPT-6 Sol Comparison Protocol

Status: **preregistered before any live GPT-6 Sol semantic response**

Purpose: compare GPT-6 Sol against the already-frozen GPT-6 Astra semantic result using the same two label-blind Trackcade interpretation packets, the same provider-neutral request contract, the same deterministic compiler, and the same descriptive Semantic Quality v1 benchmark.

This is a model-comparison experiment, not an Analyzer experiment. It must not rerun or retune Analyzer v0.19, Structure v1, the semantic compiler, or the benchmark.

## Frozen parent state

- parent branch: `trackcade-learned-interpretation-v1`
- parent/result commit: `b041e81542fd883c2fb17776393efa681f4782c8`
- Astra frozen run: `36348764554`, successful semantic attempt `3`
- Astra immutable execution SHA: `39b3bb7fa08b890897f97c254619143e5d8f0dea`
- Astra complete result artifact: `10941901727`
- Astra result artifact digest: `sha256:66c92e45d2e6a7d0f05a82baaa9a534fc76bfb55f274a3928ac9a7fe4bfbb909`
- Astra live semantic-quality SHA-256: `8ed09f3847a632603581da1bab118de2ebcf0be28e7d53f4f3e96786bf24eb14`

## Frozen production timing authority

- Analyzer release: `v0.19`
- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

GPT-6 Sol is not allowed to change BPM, beat offset, beat timestamps, evidence-anchor timestamps, song length, timing tier, or the deterministic beat grid.

## Frozen semantic-generation inputs

Exactly two already-visible product fixtures remain in scope:

1. `alldat`
2. `cvb-gemf`

Packet SHA-256:

- ALLDAT: `579cbdb6a0ec06e46f93230929949077079d8272b4fb86c2cb274edeb5dabdfa`
- CVB — G.E.M.F.: `69df2dba4ae905a96d51149feed5a57394412c5dba1972085f33e5633a88516f`

Provider-neutral request SHA-256:

- ALLDAT: `409ce78afcd4c6062827a0ba60aeb94f6ec311aaa1ccf6e292fd137686c2e03a`
- CVB — G.E.M.F.: `2d6650e1ceb72ddff9f40f13e8f04dbaacc84f7b7935b8843e1ba25088e85e93`

Frozen instruction SHA-256:

- `8bf1231fc4bfeee4897367a72cd77bd569fc9df53c93532052ca43f7446d88e9`

No Astra proposal, authored reference timeline, prior compiler output, or benchmark result may be exposed to GPT-6 Sol during generation.

## Frozen upstream evidence

Structure Evidence:

- run `36281298997`
- artifact `10919375182`
- digest `sha256:3d4364ab01ee51b4b244f0033aeb5ca598393164e805c6149d4f25c37d9805fc`

Safe automatic manifests:

- run `36281637484`
- artifact `10918568524`
- digest `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`

Frozen evidence-only Semantic Quality v1 baseline:

- run `36342720212`
- artifact `10939642086`
- digest `sha256:5d08033b38f0bc479da225b8a4c7aff9ac630131a53ab69a10c476634029ce7a`
- benchmark result SHA-256 `264f18ebbff76adae1614958476a50f5b49e7339c0b69bfbd3c7635129cec890`

## Frozen GPT-6 Sol execution configuration

Provider: OpenAI Responses API.

Requested model alias: `gpt-6-sol`

Generation configuration:

- reasoning effort: `high`
- maximum output tokens: `4096`
- `store=false`
- provider tools: none
- temperature/top-p: not set by Trackcade
- responses per fixture: exactly `1`
- semantic retries: `0`

The exact model string returned by OpenAI must be recorded.

## Exactly-once rule

Each fixture gets one GPT-6 Sol semantic response. A completed response, refusal, incomplete response, structurally invalid response, or provider proposal rejected by Trackcade is the semantic outcome for that fixture.

No semantic retry is allowed because the score is weak or because Astra scored better.

Infrastructure retry is allowed only when there is affirmative evidence that no provider semantic response was obtained. Any infrastructure retry must preserve the exact frozen request/model/configuration.

## Frozen post-generation path

Only after both Sol provider outcomes are frozen may scoring inputs become available.

For every valid Sol proposal:

1. run the existing frozen `research/structure-v1/compile_semantic_events_v1.py`;
2. use the exact frozen safe manifests and Structure Evidence listed above;
3. verify beat events and protected timing fields remain identical to the safe deterministic baseline;
4. verify every accepted semantic event time comes directly from the selected objective evidence anchor;
5. score using the existing frozen `research/semantic-quality-v1/evaluate_semantic_quality_v1.py`.

No compiler thresholds or benchmark rules may be changed.

## Frozen comparison yardsticks

### Evidence-only baseline — aggregate micro F1

| window | view | exact-kind | landmark-only |
|---|---|---:|---:|
| 1s | proposal intent | 0.09090909090909091 | 0.22727272727272724 |
| 1s | accepted compiled | 0.046511627906976744 | 0.23255813953488377 |
| 2s | proposal intent | 0.13636363636363635 | 0.3181818181818182 |
| 2s | accepted compiled | 0.09302325581395349 | 0.32558139534883723 |
| 4s | proposal intent | 0.18181818181818182 | 0.4090909090909091 |
| 4s | accepted compiled | 0.1395348837209302 | 0.4186046511627907 |

### Frozen Astra result — aggregate micro F1

| window | view | exact-kind | landmark-only |
|---|---|---:|---:|
| 1s | proposal intent | 0.07692307692307693 | 0.15384615384615385 |
| 1s | accepted compiled | 0.0975609756097561 | 0.1951219512195122 |
| 2s | proposal intent | 0.11538461538461538 | 0.23076923076923075 |
| 2s | accepted compiled | 0.14634146341463414 | 0.2926829268292683 |
| 4s | proposal intent | 0.19230769230769232 | 0.4230769230769231 |
| 4s | accepted compiled | 0.1951219512195122 | 0.3902439024390244 |

The Sol result must report its delta versus both frozen yardsticks. No post-hoc weighting or winner score is authorized.

## Cost comparison

Record exact provider usage metadata for both Sol calls. Using the standard API rates documented at preregistration on 2026-09-27, report a descriptive estimated token charge for Sol and compare it with Astra's observed provider usage.

Frozen Astra observed usage:

- input tokens: `16862`
- output tokens: `3577`

Pricing is descriptive operational context only; it is not a scientific semantic-quality threshold.

## Claim boundary

These are the same two visible product fixtures used by the existing Semantic Quality benchmark. They are not an independent holdout. Sol may be described only as better/worse/different **on these two fixtures and these frozen metrics**. No generalized model superiority or production promotion may be inferred from this comparison alone.

No result from this experiment changes Analyzer v0.19 production timing authority.

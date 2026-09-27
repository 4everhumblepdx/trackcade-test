# Trackcade Learned Interpretation v1 — First Live OpenAI Result

Status: **completed descriptive regression experiment; both provider proposals valid; timing authority preserved; no production promotion authorized by this result**

## Frozen experiment identity

- workflow: `Trackcade Learned Interpretation v1 — First Live OpenAI Experiment`
- workflow run: `36348764554`
- successful rerun attempt: `3`
- immutable execution branch: `trackcade-openai-live-v1-freeze`
- immutable source SHA: `39b3bb7fa08b890897f97c254619143e5d8f0dea`
- requested model: `gpt-6-astra`
- returned model: `gpt-6-astra` for both fixtures
- reasoning effort: `high`
- max output tokens: `4096`
- store: `false`
- semantic retries: `0`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- quality threshold: none; this was preregistered as descriptive regression evidence, not a pass/fail promotion gate

Attempts 1 and 2 were infrastructure-only and produced zero semantic provider responses. Attempt 3 is the first and only semantic result for these frozen requests.

## Frozen provider outputs

### ALLDAT

- OpenAI response ID: `resp_0daace25994c41dd016ab984c98af087d0923388ed96137062`
- proposal candidate SHA-256: `24a0a4873a07188aff5cc3f7bdc560a0d63d7638f05649c3dfa2261218a548f6`
- normalized proposal SHA-256: `2b16f0ea5f5a259d1f8c57a961a7455017ebc8964303749369f69ceb47cd5ac6`
- raw response SHA-256: `c7b2d0047f906c3a5e97a91e9d584d2a272ec77cd2fc782861009638418a66bf`
- proposed semantic events: `9`
- compiler accepted: `5`
- compiler rejected: `4`
- input tokens: `8794`
- output tokens: `1523`
- reasoning tokens: `728`

### CVB — G.E.M.F.

- OpenAI response ID: `resp_07f4d967abb34757016ab984e7538887d0a56f76665a02dbdd`
- proposal candidate SHA-256: `8c3d04426137c284d04e85426f8feea46ef2b17544a0cd9633c359c4f50de622`
- normalized proposal SHA-256: `26a879d1db1d1d45f82f839ee7a7331670553769e24497de3df46ce564f8da37`
- raw response SHA-256: `f07e1eaa7955271a0ce6124f0307a2ed470c222bebad3e9777f3de6303f0dbff`
- proposed semantic events: `14`
- compiler accepted: `7`
- compiler rejected: `7`
- input tokens: `8068`
- output tokens: `2054`
- reasoning tokens: `938`

Combined provider usage: `16862` input tokens and `3577` output tokens.

## Frozen evidence artifacts

Generation artifact:

- name: `trackcade-openai-live-v1-generation`
- artifact ID: `10942176510`
- digest: `sha256:3bcb80ab493a48fa07cdec9efe304f38ebe02986fdb5ec2cec55c2933cd58103`

Complete result artifact:

- name: `trackcade-openai-live-v1-result`
- artifact ID: `10941901727`
- digest: `sha256:66c92e45d2e6a7d0f05a82baaa9a534fc76bfb55f274a3928ac9a7fe4bfbb909`

Live semantic-quality report SHA-256:

- `8ed09f3847a632603581da1bab118de2ebcf0be28e7d53f4f3e96786bf24eb14`

Generation classification:

- `both_valid_provider_proposals_frozen`

## Timing/safety boundary

Both proposals passed the learned-proposal validator and auditable provider-ingestion path. The frozen semantic compiler then applied its existing confidence, low-demand, objective-evidence, cooldown, and high-impact rules.

The postprocess timing-authority audit passed for both songs:

- beat events remained exactly equal to the safe deterministic baseline;
- BPM, beat offset, song length, artist, title, audio URL, and energy curve remained unchanged;
- every accepted semantic event time came directly from the frozen objective evidence anchor selected by the model;
- the model never supplied an independent timestamp or beat grid;
- fallback-safe baseline preservation remained true.

Therefore the learned semantic layer did **not** acquire deterministic timing authority.

## Semantic-quality comparison to frozen evidence-only baseline

The benchmark uses the two visible product fixtures only. It is descriptive regression evidence, not an independent holdout.

### Accepted/compiled events

| Window | Metric | Evidence-only baseline F1 | Astra live F1 | Delta |
| --- | --- | ---: | ---: | ---: |
| 1s | exact kind | 0.0465 | 0.0976 | +0.0510 |
| 1s | landmark only | 0.2326 | 0.1951 | -0.0374 |
| 2s | exact kind | 0.0930 | 0.1463 | +0.0533 |
| 2s | landmark only | 0.3256 | 0.2927 | -0.0329 |
| 4s | exact kind | 0.1395 | 0.1951 | +0.0556 |
| 4s | landmark only | 0.4186 | 0.3902 | -0.0284 |

### Raw proposal intent

| Window | Metric | Evidence-only baseline F1 | Astra live F1 | Delta |
| --- | --- | ---: | ---: | ---: |
| 1s | exact kind | 0.0909 | 0.0769 | -0.0140 |
| 1s | landmark only | 0.2273 | 0.1538 | -0.0734 |
| 2s | exact kind | 0.1364 | 0.1154 | -0.0210 |
| 2s | landmark only | 0.3182 | 0.2308 | -0.0874 |
| 4s | exact kind | 0.1818 | 0.1923 | +0.0105 |
| 4s | landmark only | 0.4091 | 0.4231 | +0.0140 |

## Interpretation

This result is **mixed but useful**.

The strongest positive result is after the frozen compiler: Astra improved exact semantic-kind F1 at every measured window. The gain is roughly +0.05 absolute F1 at 1s, 2s, and 4s. That is evidence that a learned/LLM layer can add semantic-label value while remaining downstream of deterministic timing.

However, Astra did not dominate the evidence-only baseline. Accepted landmark-only F1 declined modestly at all three windows. At the raw proposal level, Astra was worse at the tighter 1s/2s windows and only slightly better at 4s. The model also proposed substantially more semantic events than the compiler accepted: 9 -> 5 on ALLDAT and 14 -> 7 on CVB.

Therefore this experiment does **not** justify replacing the frozen evidence-only path, weakening compiler safety gates, or promoting Astra semantics directly into production. It does validate the architecture and gives a concrete learned-semantic benchmark to improve against.

## Scientific boundary / no-retune rule

Do not rerun these same frozen Astra requests to seek a prettier answer. Their semantic outputs are consumed and frozen.

Do not tune compiler thresholds using these two visible-fixture results and then claim improvement on the same benchmark.

Any next model comparison or prompt/contract revision must be a separately preregistered experiment. A broader or independent corpus is required before making generalized semantic-quality claims or production decisions.

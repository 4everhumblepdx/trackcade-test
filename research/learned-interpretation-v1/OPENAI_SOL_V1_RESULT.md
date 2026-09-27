# Trackcade Learned Interpretation v1 — GPT-6 Sol Comparison Result

Status: **completed descriptive model comparison; both Sol proposals valid; timing authority preserved; no generalized production promotion authorized by these two fixtures**

## Frozen experiment identity

- workflow: `Trackcade Learned Interpretation v1 — GPT-6 Sol Comparison`
- workflow run: `36351147037`
- run attempt: `1`
- immutable execution branch: `trackcade-openai-sol-v1-freeze`
- immutable source SHA: `54bf32441807c18fa8c0d1fd8d34cb92522a0ce2`
- requested model: `gpt-6-sol`
- returned model: `gpt-6-sol` for both fixtures
- reasoning effort: `high`
- max output tokens: `4096`
- store: `false`
- semantic retries: `0`
- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- comparison parent: Astra result commit `b041e81542fd883c2fb17776393efa681f4782c8`

## Provider outputs

### ALLDAT

- response ID: `resp_009906d2541b92ce016ab987db60b887d296752601b81286f9`
- proposal candidate SHA-256: `08f8c3745997c999439e9c78fb30079cb4a3864a80bfe2e83b5ea2c49da3ff0f`
- normalized proposal SHA-256: `895cddf578b5931b44c370107ab2866398b9e6478a16630fe8b2535d0510f025`
- raw response SHA-256: `e8b7acc5da2205be55bc7041d107916c258db9a7526750a592d1309ea700442f`
- proposed semantic events: `13`
- compiler accepted: `4`
- compiler rejected: `9`
- input tokens: `8794`
- output tokens: `1746`
- reasoning tokens: `1034`
- cache-write tokens: `8791`
- cached input tokens: `0`

### CVB — G.E.M.F.

- response ID: `resp_0326221726f3aa35016ab987f39c0087d298dca1e91fb26d72`
- proposal candidate SHA-256: `e2ada87136a25bd35260b07adee25efda1f67c0e8cc9825f3e31fbd0fae53f41`
- normalized proposal SHA-256: `cac9f83042d0c097b17a9f31dc7ade9f6521fa20d824857cffe150a14a167ab1`
- raw response SHA-256: `2f438bbc0a2cedbb8f539e84e463794a310bff23d13ac16d3631df674a78676c`
- proposed semantic events: `17`
- compiler accepted: `9`
- compiler rejected: `8`
- input tokens: `8068`
- output tokens: `1851`
- reasoning tokens: `953`
- cache-write tokens: `8065`
- cached input tokens: `0`

Combined Sol usage:

- input tokens: `16862`
- output tokens: `3597`
- reasoning tokens: `1987`
- cache-write tokens: `16856`
- cached input tokens: `0`

Frozen Astra observed usage for comparison:

- input tokens: `16862`
- output tokens: `3577`

## Frozen evidence artifacts

Generation artifact:

- ID: `10942107974`
- name: `trackcade-openai-sol-v1-generation`
- digest: `sha256:f835eac284b5a409b3c341f3a70108b42bf02d5d6ea69e02643513ce4e8f4232`

Complete result artifact:

- ID: `10941824368`
- name: `trackcade-openai-sol-v1-result`
- digest: `sha256:f4720bf768b2d758118a78caabd22a9e3c53b74f1aace0cf14f732fab71075fe`

Sol semantic-quality report SHA-256:

- `bd312f2ba6731542d58267627814a50565ed41659f6e60bd2d81a9ea90f062a0`

Generation classification:

- `both_valid_provider_proposals_frozen`

## Timing/safety boundary

Both Sol proposals passed the learned-proposal validator and auditable provider-ingestion path. The same frozen semantic compiler used for the Astra experiment then applied the existing confidence, low-demand, objective-evidence, cooldown, and high-impact rules.

The deterministic timing-authority audit passed for both songs:

- beat events remained exactly equal to the safe deterministic baseline;
- BPM, beat offset, song length, artist, title, audio URL, and energy curve remained unchanged;
- every accepted semantic event time came directly from the frozen objective evidence anchor selected by Sol;
- Sol supplied no independent timestamp or beat grid;
- fallback-safe baseline preservation remained true.

Therefore Sol did **not** acquire deterministic timing authority.

## Aggregate semantic-quality comparison

These metrics use the same two visible product fixtures and the same frozen evaluator. They are descriptive regression evidence, not an independent holdout.

### Accepted/compiled events

| Window | Metric | Evidence-only baseline | Astra | Sol | Sol vs Astra |
| --- | --- | ---: | ---: | ---: | ---: |
| 1s | exact kind F1 | 0.0465 | 0.0976 | 0.1429 | +0.0453 |
| 1s | landmark-only F1 | 0.2326 | 0.1951 | 0.1905 | -0.0046 |
| 2s | exact kind F1 | 0.0930 | 0.1463 | 0.1905 | +0.0441 |
| 2s | landmark-only F1 | 0.3256 | 0.2927 | 0.2857 | -0.0070 |
| 4s | exact kind F1 | 0.1395 | 0.1951 | 0.2381 | +0.0430 |
| 4s | landmark-only F1 | 0.4186 | 0.3902 | 0.3810 | -0.0093 |

### Raw proposal intent

| Window | Metric | Evidence-only baseline | Astra | Sol | Sol vs Astra |
| --- | --- | ---: | ---: | ---: | ---: |
| 1s | exact kind F1 | 0.0909 | 0.0769 | 0.1695 | +0.0926 |
| 1s | landmark-only F1 | 0.2273 | 0.1538 | 0.1695 | +0.0156 |
| 2s | exact kind F1 | 0.1364 | 0.1154 | 0.2034 | +0.0880 |
| 2s | landmark-only F1 | 0.3182 | 0.2308 | 0.2373 | +0.0065 |
| 4s | exact kind F1 | 0.1818 | 0.1923 | 0.3051 | +0.1128 |
| 4s | landmark-only F1 | 0.4091 | 0.4231 | 0.4068 | -0.0163 |

## Interpretation

On these two frozen product fixtures, Sol produced stronger **exact semantic-kind** agreement than Astra at every evaluated window, both before and after the frozen safety compiler. The accepted/compiled exact-kind improvement over Astra is approximately +0.043 to +0.045 absolute F1; proposal-level exact-kind improvement is approximately +0.088 to +0.113.

Sol did not improve accepted landmark-only agreement. Its accepted landmark-only F1 is very close to but slightly below Astra at each window, by approximately 0.005 to 0.009 absolute F1. This reinforces the existing architectural separation: objective landmark timing remains a deterministic/evidence problem, while the learned layer is showing its strongest value in semantic labeling.

Sol proposed more semantic events than Astra (`30` total versus Astra's `23`), and the safety compiler rejected `17` of Sol's `30` proposals. This is further evidence that the compiler remains necessary; model output is not safe to route directly into gameplay.

## Cost context

At the standard short-context rates documented on 2026-09-27, GPT-6 Sol is priced at one-fifth of GPT-6 Astra for uncached input, cached input, cache writes, and output tokens.

Using Sol's reported usage and the standard rates (`$2/M` uncached input, `$2.50/M` cache writes, `$10/M` output), the approximate provider token charge for these two Sol calls is about **$0.078**. This estimate treats reported cache-write tokens at the cache-write rate and the remaining six input tokens at the uncached-input rate.

Because Astra's corresponding standard token rates are exactly 5× Sol's and the observed request token counts were essentially identical, a comparable Astra run is roughly 5× the provider token cost. Pricing is operational context, not a semantic-quality criterion.

## Claim boundary / no-retune rule

This result does **not** establish generalized model superiority and does not by itself authorize production promotion. The benchmark contains only the same two visible product fixtures used during prior interpretation work.

Do not rerun these exact Sol requests for a prettier answer. Their semantic outcomes are consumed and frozen.

Do not change compiler thresholds based on these two songs and then claim improvement on the same benchmark.

The next scientifically meaningful step is a broader or independent semantic-evaluation corpus using the same frozen timing trust boundary. Any production decision between evidence-only, Astra, Sol, or another model should be based on evidence beyond these two visible fixtures.

No result from this comparison changes Analyzer v0.19 production timing authority.

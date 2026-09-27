# Trackcade Art Assets v1 — Current Verified State

Status: **skyline generation structurally proven; production URL publication still intentionally blocked**

This checkpoint exists so future work resumes from verified evidence rather than rebuilding or repeating completed steps.

## Production chain remains unchanged

- Analyzer production: `release/analyzer-v0.19`
- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- Structure artifact digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`
- Gameplay/Difficulty v1 closure: `141bf6127d7af763ea04e497bfe5fcf6e5ff364c`
- Visual/World v1 closure: `8c3bc6dc07067c3cea016ff76b2023a29fde7933`

No production manifest art URL has been changed in Art Assets v1.

## Completed Art Assets v1 evidence

### Production baseline audit

- run: `36291898561`
- artifact ID: `10921669972`
- digest: `sha256:7e8f509e30d24e928c0ded97126af08d904e01a0bd4fe50ac3faa757dc1ae31e`
- result record: `ART_ASSET_BASELINE_RESULT.md`

Established exact current production source dimensions:

- player `49 × 64`
- obstacleLow `64 × 33`
- obstacleWall `59 × 64`
- orb `63 × 64`
- cell `36 × 64`
- skyline `384 × 240`

All six are 8-bit RGBA PNGs and each URL is one full image/frame in the current engine path.

### Replacement contract

`ART_ASSET_REPLACEMENT_SPEC.md`

Preregistered commit:

`9053a0b9045450460558607876da68ccfc03f9b7`

Skyline is the first generated role. Gameplay sprites remain blocked until skyline publication is proven.

### Exact-size normalizer proof

- spec commit: `0154bf24d3ab7128f01055cb1efac78b76336843`
- terminal run: `36292179242`
- artifact ID: `10922687091`
- digest: `sha256:208f98d1f35cdcff02b49983179f3e096d8b6ba200150b3f55a4677acaec1196`

### Attempt 1

Recorded in `SKYLINE_GENERATION_ATTEMPT_1_RESULT.md`.

Both exact-prompt primary candidates were refused because the generator returned dimensions other than the preregistered `1536 × 1024`. No thresholds were changed and no manifest was modified.

### Variable-source normalization v1.1

Preregistered separately after Attempt 1 refusal:

`14ec1c1ef541145dd4895c031291c2b6646add78`

The first workflow run exposed an implementation-only JS row-allocation bug. The contract was unchanged; implementation was fixed at:

`1518a84d617b2f3b2075ea6a83e01412b6fff490`

Terminal proof:

- run: `36292880983`
- artifact ID: `10923196092`
- artifact digest: `sha256:6e2f3fa88da158e63e38ac18ec410f4236a84c02f3c6f348856902a6af21006b`
- result record: `SKYLINE_NORMALIZATION_V1_1_RESULT.md`

This proved deterministic centered integer-scale crop + box reduction for variable-size RGB/RGBA PNG sources.

## Structurally accepted v1.1 generated candidates

Recorded in `SKYLINE_GENERATION_V1_1_RESULT.md`.

### ALLDAT / violet-circuit

- generation ID: `4bbaf656-04d2-4ede-8a09-0cd1cd9e19dc`
- source: `2048 × 768`, 8-bit RGB PNG
- source SHA-256: `e7642268ae3fe86bfbe9d2dc8196093d0a71b8c82445b606476b33b35925f139`
- normalized crop: x `448`, y `24`, `1152 × 720`, `k=3`
- final: `384 × 240`, 8-bit RGBA, fully opaque
- final SHA-256: `40a5528c9548c2d0c09f3db59804efb1609cd5199c6f900728aa96cc77062110`

### CVB — G.E.M.F. / neon-night

- generation ID: `5aeabffb-afba-45e1-be88-1eddb0a60059`
- source: `2048 × 768`, 8-bit RGB PNG
- source SHA-256: `f01d7c0980298dbdfb7990a01b798d016230d098f5fa149bffcfe04eb123d552`
- normalized crop: x `448`, y `24`, `1152 × 720`, `k=3`
- final: `384 × 240`, 8-bit RGBA, fully opaque
- final SHA-256: `32133839842b3bf8855e2164e6489b0e0956b2de7246887602b355d24f9d7f54`

Both normalized outputs were produced twice from identical candidate bytes and matched byte-for-byte in the active evidence session. Independent final PNG parsing confirmed full opacity and substantial RGB diversity.

## Existing candidate-intake workflow

`.github/workflows/trackcade-art-assets-v1-skyline-candidate.yml`

This manual workflow already implements fail-closed intake for candidate URLs plus mandatory expected source SHA-256 values. It consumes the exact closed Visual-v1 artifact and refuses byte mismatch.

It intentionally does **not** invent a production URL.

## Current blocker / next action

The exact normalized skyline bytes are structurally accepted but do not yet have a stable public HTTP(S) location pinned to their SHA-256 identities.

Therefore the next action is **not** another image generation run.

Next action:

1. establish durable public hosting or an immutable repository binary asset path for the exact normalized PNG bytes;
2. verify hosted bytes reproduce the recorded final SHA-256 values;
3. run the candidate-intake / manifest immutability proof against that hosted content;
4. only then create manifests whose `art.skyline` changes;
5. retain the current production skyline as fallback until the full hosted-byte + loader proof is green.

Do not regenerate, re-prompt, change normalization thresholds, or begin sprite generation merely to bypass this publication boundary.
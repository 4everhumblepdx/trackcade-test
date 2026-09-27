# Trackcade Musical Interpretation v1 — Cross-Layer Gameplay Attempt 1 Result

Status: **failed as a product-path test because it used known-unsafe inherited template tuning; not evidence of a semantic regression**

## Frozen run

- branch: `trackcade-musical-interpretation-v1`
- tested commit: `e3e617c28d005fcbc7708b2d326e400d92f6e29e`
- workflow: `Trackcade Musical Interpretation v1 — Gameplay Safety`
- run ID: `36323884952`
- job ID: `108632812430`
- conclusion: `failure`

## Input identity passed

The workflow successfully downloaded and verified the exact green interpretation artifact:

- interpretation run: `36323696425`
- artifact ID: `10933550802`
- artifact digest: `sha256:6a6b05b6da7c5f59d4473cbb497edce7de2ad2a3ecc7a4d795a6d6f63bc784ab`
- ALLDAT compiled semantic manifest SHA-256: `893194f4f647011296b2a9c2b26f1367cdbed1773e91cea6ba134222abe1d30c`
- CVB compiled semantic manifest SHA-256: `8654ea474c3f92fcec70d76d6ceef1e3549f62f8d0e0e5995e373f9029c9f5ba`

Therefore the failure occurred after exact interpretation input verification, not during artifact transport or source binding.

## ALLDAT observed gameplay result

The existing Gameplay/Difficulty v1 generator ran on the ALLDAT compiled interpretation manifest. That manifest inherited optional template/game-tuning fields from `alldat-auto-safe-v1.json` because the first interpretation proof intentionally compiled against the full Structure-v1 fixture manifest.

Observed fixed modes:

### relaxed

- QC: `qc_pass`
- publishable: `true`
- obstacle pool peak: `18 / 28`
- pickup pool peak: `9`
- lane-only route proof: `true`
- bottleneck slack: `0.2762793000989501 s`

### standard

- QC: `pool_overflow_risk`
- publishable: `false`
- obstacle pool peak: `36 / 28`
- pickup pool peak: `14`
- lane-only route proof: `true`
- bottleneck slack: `0.04149443243884332 s`

### rush

- QC: `qc_pass`
- publishable: `true`
- obstacle pool peak: `20 / 28`
- pickup pool peak: `10`
- lane-only route proof: `true`
- bottleneck slack: `0.04002925062462315 s`

Because `standard` is mandatory, the existing generator correctly refused the pack with exit code `2`.

## Why this does not isolate semantic-event safety

Gameplay/Difficulty v1 had already established before this interpretation experiment that the same inherited ALLDAT template tuning produces an obstacle-pool peak of `36 / 28` and must be rejected, while the true loader-default/minimal new-upload path produces `27 / 28` and passes.

The observed `36 / 28` therefore exactly reproduces the already-known template-tuning failure signature.

The attempt cannot distinguish a semantic-event effect from that pre-existing tuning failure and must not be described as proof that `drop`, `peak`, or `energy` semantics made gameplay unsafe.

CVB was never executed because the generator failed closed on ALLDAT first.

## Decision

Do not:

- retune semantic proposals;
- move semantic-QC thresholds;
- enlarge pools;
- change Gameplay-v1 mode definitions;
- reclassify the known template pool overflow as a semantic failure.

Run a separately preregistered v1.1 cross-layer proof against the **actual loader-default/minimal new-upload path**:

- ALLDAT: `alldat-minimal-auto-safe-v1.json`;
- CVB: deterministically strip optional art/game tuning from `cvb-gemf-auto-safe-v1.json` using the exact existing Gameplay-v1 minimal-fixture keep list;
- compile the same frozen interpretation proposal files against those minimal manifests and the same Structure Evidence;
- then run the existing Gameplay-v1 generator/preflight unchanged.

Attempt 1 remains historical evidence and must not be overwritten or rerun merely to obtain a green badge.

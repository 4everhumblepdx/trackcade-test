# Trackcade Art Assets v1 — Skyline Generation Attempt 1

Status: **refused by preregistered candidate-format gate; production fallback remains active**

## Applicable frozen contract

- Replacement contract commit: `9053a0b9045450460558607876da68ccfc03f9b7`
- Skyline normalization spec commit: `0154bf24d3ab7128f01055cb1efac78b76336843`
- Verified normalizer result commit: `c14137628ca102e7d843d8b5f866d5135976b077`

The first proof requires each primary generated skyline candidate to be exactly `1536 × 1024`, non-interlaced 8-bit PNG color type 2 or 6 before normalization. A format failure is refused without alternate crop/resize logic or threshold changes.

## ALLDAT / violet-circuit primary candidate

The exact frozen ALLDAT skyline instruction from `ART_ASSET_REPLACEMENT_SPEC.md` was used for the primary candidate.

Generation identity:

- image generation ID: `cb4812f0-586d-41ad-8f13-6b7facee6ebd`
- requested tool size: `1536 × 1024`
- returned file SHA-256: `73ea0742d955ad9f4878b4300bec70b62d30ba8c7c7bb0d06ac285f1e1c34ec3`
- returned byte length: `2161419`
- PNG bit depth: `8`
- PNG color type: `2` (RGB)
- interlace: `0`
- **returned dimensions: `2076 × 758`**

Decision:

`REFUSED`

Reason:

The returned dimensions do not equal the preregistered `1536 × 1024` candidate dimensions. The candidate was not normalized or substituted into any manifest.

## CVB — G.E.M.F. / neon-night primary candidate

The exact frozen CVB skyline instruction from `ART_ASSET_REPLACEMENT_SPEC.md` was used for the primary candidate.

Generation identity:

- image generation ID: `7786558d-25d5-4c2d-af4a-2222b9e16629`
- requested tool size: `1536 × 1024`
- returned file SHA-256: `872663dc85ec40e3714911405aab704dc2beb11acf3e815e2ed2f93bda44f337`
- returned byte length: `2214118`
- PNG bit depth: `8`
- PNG color type: `2` (RGB)
- interlace: `0`
- **returned dimensions: `1947 × 808`**

Decision:

`REFUSED`

Reason:

The returned dimensions do not equal the preregistered `1536 × 1024` candidate dimensions. The candidate was not normalized or substituted into any manifest.

## Fail-closed behavior

No acceptance threshold changed.

No alternate source size was silently accepted.

No content-aware crop or secondary resampling path was added.

No second candidate was selected in place of either failed primary candidate inside this proof.

No Trackcade manifest was modified.

The existing proven production skyline URL therefore remains active for ALLDAT and CVB across relaxed, standard, and rush.

## Non-authoritative exploratory images

Two earlier exploratory images had happened to return `1536 × 1024`, but their generation wording was not the exact frozen primary-candidate instruction. They are therefore not used as substitutes for this preregistered attempt and do not count as Art Assets v1 proof evidence.

## What this result establishes

The fail-closed contract is working as intended: the image generator may return dimensions different from the requested tool size, and Art Assets v1 does not silently reshape that mismatch under a contract that required exact source dimensions.

A revised source-size experiment is allowed only as a separately preregistered step. It must define a general deterministic crop/resample rule before generating new primary candidates.
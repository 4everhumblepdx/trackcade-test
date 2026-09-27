# Trackcade Musical Interpretation v1 — Cross-Layer Gameplay Safety Spec

Status: **preregistered cross-layer proof**

## Question

Do the exact semantic manifests accepted by Musical Interpretation v1 remain safe when passed through the already-closed Gameplay/Difficulty v1 generator and whole-song preflight?

This test does not change interpretation proposals, semantic QC thresholds, gameplay tuning candidates, pool capacities, or Analyzer/Structure behavior.

## Frozen interpretation input

- interpretation workflow run: `36323696425`
- artifact: `trackcade-musical-interpretation-v1-evidence-only`
- artifact ID: `10933550802`
- artifact digest: `sha256:6a6b05b6da7c5f59d4473cbb497edce7de2ad2a3ecc7a4d795a6d6f63bc784ab`
- ALLDAT compiled manifest SHA-256: `893194f4f647011296b2a9c2b26f1367cdbed1773e91cea6ba134222abe1d30c`
- CVB compiled manifest SHA-256: `8654ea474c3f92fcec70d76d6ceef1e3549f62f8d0e0e5995e373f9029c9f5ba`

## Frozen gameplay machinery

Use the existing closed Gameplay/Difficulty v1 code unchanged:

- `research/gameplay-v1/generate_difficulty_variants_v1.mjs`
- `research/gameplay-v1/preflight_gameplay_v1.mjs`
- its fixed `relaxed`, `standard`, and `rush` candidate definitions;
- the existing whole-song auditor invoked by preflight.

No candidate search is allowed after observing results.

## Procedure

For each compiled semantic fixture:

1. verify the input manifest SHA-256 matches the frozen interpretation result;
2. run the existing difficulty generator twice into independent output trees;
3. require byte-identical reports, candidate manifests, QC outputs, and publishable manifests across duplicate runs;
4. require mandatory `standard` to pass or treat the cross-layer proof as failed;
5. record optional `relaxed`/`rush` pass or refusal exactly as observed;
6. require every candidate to preserve all source semantic events and interpretation provenance;
7. require the original beat grid and energy curve to remain unchanged;
8. validate every published mode using Trackcade's real loader;
9. preserve complete per-mode QC evidence.

## Interpretation of results

A green workflow means the fixed Gameplay-v1 safety machinery can consume these exact semantics without invalidating the mandatory baseline.

It does not prove the semantic meaning itself is musically correct, nor does it generalize beyond the two current product fixtures.

If a mode fails, do not alter semantic proposals or gameplay thresholds in this experiment. Record the failure and its QC reason.

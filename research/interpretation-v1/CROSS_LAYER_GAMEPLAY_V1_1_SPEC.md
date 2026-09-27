# Trackcade Musical Interpretation v1 — Cross-Layer Gameplay Safety v1.1

Status: **preregistered loader-default product-path proof**

## Why v1.1 exists

Cross-layer Attempt 1 used compiled semantic manifests that inherited old optional template gameplay tuning. ALLDAT reproduced the already-known template failure signature (`36 / 28` obstacle pool peak), so that run could not isolate semantic-event safety.

v1.1 changes **only the input tuning context** to the loader-default/minimal new-upload path already validated by Gameplay/Difficulty v1. It does not change interpretation proposals, semantic compiler thresholds, gameplay mode definitions, pool capacities, Analyzer bits, Structure Evidence, or runtime physics.

## Frozen upstream

- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- Structure Evidence run: `36281298997`
- Structure Evidence artifact ID: `10919375182`
- Structure Evidence artifact digest: `sha256:3d4364ab01ee51b4b244f0033aeb5ca598393164e805c6149d4f25c37d9805fc`
- Structure safe-manifest run: `36281637484`
- Structure safe-manifest artifact ID: `10918568524`
- Structure safe-manifest artifact digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`
- interpretation proposal files remain exactly:
  - `research/interpretation-v1/proposals/alldat-evidence-only-v1.json`
  - `research/interpretation-v1/proposals/cvb-gemf-evidence-only-v1.json`
- semantic compiler remains `research/structure-v1/compile_semantic_events_v1.py` unchanged.
- Gameplay/Difficulty v1 generator and preflight remain unchanged.

## Product-path input manifests

### ALLDAT

Use the already-generated Structure-v1 minimal manifest:

`safe/alldat-minimal-auto-safe-v1.json`

### CVB — G.E.M.F.

Materialize a minimal manifest from `safe/cvb-gemf-auto-safe-v1.json` using the exact keep list already validated in the closed Gameplay-v1 QC workflow:

```text
artist
title
audioUrl
bpm
beatOffset
songLength
events
energyCurve
generation
```

No optional palette, art, or gameplay-tuning fields may survive this strip.

## Procedure

For each song:

1. verify exact Analyzer runner and analysis-JSON identity against Structure Evidence;
2. compile the existing frozen interpretation proposal against the minimal manifest and matching Structure Evidence;
3. require semantic compilation to reproduce the same accepted/rejected proposal counts as the original interpretation proof, because tuning/art fields are outside the semantic compiler's evidence gates:
   - ALLDAT: `5 accepted / 1 rejected`;
   - CVB: `9 accepted / 0 rejected`;
4. require every accepted semantic event time to remain anchored to the same deterministic evidence;
5. run the existing `generate_difficulty_variants_v1.mjs` twice per song;
6. byte-compare duplicate output trees;
7. require mandatory `standard` to return `qc_pass` for both songs;
8. record `relaxed` and `rush` exactly as observed; do not substitute or retune a failed optional mode;
9. require every difficulty candidate to preserve the compiled semantic event list, interpretation provenance, beat grid, energy curve, BPM, beat offset, duration, and song identity;
10. validate every publishable output with Trackcade's real loader;
11. preserve all QC JSON and SHA-256 evidence.

## Interpretation

If both mandatory `standard` modes pass, then the evidence-only semantic events are compatible with the current loader-default new-upload gameplay path for these two product fixtures under existing Gameplay-v1 QC.

If either `standard` fails, that is a real cross-layer product-path incompatibility to investigate. Do not retune semantics or gameplay in this experiment.

Optional-mode refusal is not a failure of the mandatory product baseline; it is recorded as song-specific mode availability under existing Gameplay-v1 rules.

## Claim boundary

Even a green result remains a two-fixture integration proof. It does not establish generalized semantic quality, broad-song gameplay safety, human fun/accessibility, or a production learned/audio-capable interpreter.

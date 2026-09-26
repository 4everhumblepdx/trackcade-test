# Trackcade Structure v1 — Safe Automatic Gameplay Baseline

Status: **validated fallback contract**

This is the first automatically generated Trackcade gameplay manifest path built from the frozen Analyzer without requiring semantic music understanding.

## Frozen timing dependency

- Analyzer release: `v0.19`
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

The generator does not alter Analyzer timing.

## Generator

`research/structure-v1/generate_safe_manifest_v1.py`

The generator consumes:

1. exact v0.19 Analyzer JSON;
2. an existing Trackcade manifest only as the identity/art/game-tuning template.

It replaces hand-authored musical timing with deterministic Analyzer output.

## Generated gameplay inputs

### Beat grid

Every validated v0.19 `beatTimes` entry becomes an authored Trackcade `{ "kind": "beat" }` event.

This is important because `MusicDirector` uses authored beat events as the actual metrical grid when at least two are present, instead of reconstructing a uniform grid from one global BPM/offset.

### Energy

The v0.19 240-sample `energyCurve` is transferred into the Trackcade manifest.

Trackcade's existing `Difficulty.spawnIntensity()` blends that curve with the normal elapsed-time difficulty ramp, so the automatically generated baseline already responds continuously to musical energy without requiring discrete semantic `energy` events.

### Generic section changes

Every v0.19 section start becomes a generic Trackcade `section` event with no musical name.

These events are permitted to change the visual/world state only. Analyzer section labels such as `drop`, `body`, `break`, or `build` are deliberately not copied into gameplay semantics.

## Explicitly not generated

The safe baseline generates **zero**:

- `drop` events;
- `peak` events;
- discrete `energy` events;
- verse/chorus/hook/break semantic names.

Those commands have strong gameplay effects and require the separate interpretation layer.

## Timing-tier policy

- `standard`: safe baseline generation allowed.
- `loose`: safe baseline generation allowed, retaining Trackcade's forgiving/supportive timing semantics.
- `visual-only`: generator refuses beat-driven gameplay output and exits nonzero.

The generator must never convert `visual-only` timing into apparently precise rhythm gameplay.

## Validation evidence

Workflow:

`Trackcade Structure v1 — Safe Manifest Generation`

Run:

`36281039225`

Head commit:

`f18b95570440ec5f1ede37473fd93ed5491a3a38`

Conclusion: **success**

Artifact:

- name: `trackcade-structure-v1-safe-generated-manifests`
- artifact ID: `10918329894`
- artifact digest: `sha256:4a1ab80859fdc9b02df7e18254bb0420bdbbd3d3540911963870a1d940994851`

Validated fixtures:

### ALLDAT

- timing tier: `loose`
- 590 Analyzer-authored beat events
- 14 generic section events
- 240 energy samples
- no `drop`, `peak`, or `energy` commands

### CVB — G.E.M.F.

- timing tier: `loose`
- 812 Analyzer-authored beat events
- 8 generic section events
- 240 energy samples
- no `drop`, `peak`, or `energy` commands

The CI job also synthesizes a `visual-only` timing result and requires the generator to refuse it.

## Runtime compatibility

Both generated manifests were validated with Trackcade's real `src/track/loader.js`, not a duplicate research validator.

Unknown `generation` provenance metadata is safely ignored by the runtime loader while preserving exact Analyzer identity and generation policy in the source artifact.

## Product meaning

Trackcade can now automatically produce a conservative playable baseline from music whenever v0.19 timing is at least `loose`.

That baseline is the permanent fallback for all later musical-understanding work:

> If semantic interpretation is unavailable, low-confidence, invalid, or fails QC, use the safe baseline unchanged.

A later AI or learned interpretation layer may enrich the manifest, but it may never be required for basic safe gameplay generation and may never mutate the underlying Analyzer beat grid.

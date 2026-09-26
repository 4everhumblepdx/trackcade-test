# Trackcade Musical Structure v1 — Product Fixture Findings

Status: **diagnostic conclusion — reuse v0.19 objective structure evidence; do not trust its semantic event names as gameplay commands**

## Frozen dependency

All measurements below use the exact released Trackcade Analyzer v0.19 bits:

- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

No Analyzer modification was made.

Corrected audit workflow:

- workflow: `Trackcade Structure v1 — Product Fixture Audit`
- run ID: `36280612767`
- head commit: `c1e0b77e0c261a10abb67e242d062aaa5c06421a`
- artifact ID: `10918484114`
- artifact digest: `sha256:6d494c7c3ac9e7d0096833c67f13c102a67b104b8e8eb7c99fd1b5f5906e0682`
- audit JSON SHA-256: `1c2fb8a8b0543c4410348b4e219b397f9f4362487a70e2419d68fe4d5a90a35c`

The two fixtures are existing Trackcade product tracks with manually authored timelines. They are useful product evidence, **not** an independent scientific benchmark.

## Key discovery

v0.19 already exposes larger-scale structure fields:

- `energy`
- `energyCurve`
- `events`
- `sections`
- `structureConfidence`
- `structureDiagnostics`
- `lowDemandWindows`

Therefore Structure v1 should not start by rebuilding energy or boundary DSP from scratch. The first job is to determine which of these existing outputs are trustworthy enough to reuse and which require a later interpretation layer.

## Corrected schema handling

The first audit adapter incorrectly assumed Analyzer events used the Trackcade manifest event schema.

They do not:

- authored Trackcade events use `{ kind, t, ... }`
- v0.19 Analyzer structure events use `{ type, time, intensity }`

Run `36280612767` corrected that adapter. The semantic results below are from the corrected audit.

## ALLDAT

Analyzer structure confidence: `0.6664`

### Energy

- Pearson correlation with authored `energyCurve`: **0.9376664141**
- mean absolute error: **0.1195597185**

This is strong product-level agreement. The v0.19 energy curve is useful as objective structure evidence.

### Major section/drop boundaries

Authored major boundaries: `7`

Analyzer section boundaries: `13`

- within 1 s: F1 **0.3000**
- within 2 s: F1 **0.5000**
  - recall **71.43%**
  - precision **38.46%**
  - mean absolute timing error among matches **0.960 s**
- within 4 s: F1 **0.7000**

Section starts contain useful timing evidence but are noisier/more granular than the authored gameplay structure.

### All structural landmarks

Authored non-beat landmarks: `11`

Analyzer landmarks (event times + section starts): `30`

- within 1 s: F1 **0.2927**
- within 2 s: F1 **0.3902**
  - recall **72.73%**
  - precision **26.67%**
  - mean absolute timing error among matches **0.700 s**
- within 4 s: F1 **0.5366**
  - recall **100%**

The Analyzer is often near the right musical moments, but emits more candidate landmarks than the hand-authored game timeline needs.

### Semantic event kinds

Within 2 s:

- authored events matched in time: `8 / 11` (**72.73%**)
- exact event-kind agreement: `1 / 8` (**12.5%**)

Example: the authored break near `117.0 s` is close to Analyzer evidence at `116.789 s`, but the Analyzer labels that event `drop`.

## CVB — G.E.M.F.

Analyzer structure confidence: `0.8323`

### Energy

- Pearson correlation with authored `energyCurve`: **0.8879806896**
- mean absolute error: **0.1131456072**

Again, the objective energy contour is strong enough to reuse as evidence.

### Major section/drop boundaries

Authored major boundaries: `10`

Analyzer section boundaries: `7`

- within 1 s: F1 **0.1176**
- within 2 s: F1 **0.1176**
  - recall **10%**
  - precision **14.29%**
  - mean absolute timing error among matches **0.839 s**
- within 4 s: F1 **0.2353**

This fixture demonstrates that Analyzer `sections` alone are too coarse to stand in for a complete Trackcade gameplay structure timeline.

### All structural landmarks

Authored non-beat landmarks: `16`

Analyzer landmarks (event times + section starts): `27`

- within 1 s: F1 **0.2791**
- within 2 s: F1 **0.3721**
  - recall **50%**
  - precision **29.63%**
  - mean absolute timing error among matches **0.7875 s**
- within 4 s: F1 **0.5581**
  - recall **75%**

A particularly clear example is the manually authored first drop at `61.8 s`: v0.19 emits a structural event at `61.794 s`, only **6 ms** away. The timing evidence is excellent, but the Analyzer calls it a `peak`, not a `drop`.

### Semantic event kinds

Within 2 s:

- authored events matched in time: `8 / 16` (**50%**)
- exact event-kind agreement: `1 / 8` (**12.5%**)

Again, useful structural timing does not imply trustworthy gameplay semantics.

## Product conclusion

### Reuse directly as objective evidence

- v0.19 timing map and timing confidence/tier
- `energyCurve`
- global `energy`
- section boundary times and section confidence as candidates
- event times and event intensity as candidate landmarks
- `structureConfidence`
- `structureDiagnostics`
- low-demand windows

### Do not wire directly into gameplay semantics

Do **not** directly convert Analyzer labels to Trackcade game commands:

- Analyzer `drop` must not automatically become Trackcade `drop`
- Analyzer `peak` must not automatically become Trackcade `peak`
- Analyzer `build` must not automatically become Trackcade `energy`
- Analyzer section labels must not be treated as authoritative verse/chorus/break semantics

This matters because the game gives those event kinds concrete effects:

- `drop` starts Overdrive
- `peak` spawns the golden-orb spiral
- `energy` raises the gameplay energy/ramp
- `section` changes environment state

The observed semantic precision is nowhere near sufficient to authorize those effects directly.

## Next architecture

The next layer should be a deterministic **Structure Evidence v1** export that preserves the useful objective signals and explicitly marks Analyzer semantic labels as diagnostic hints only.

That evidence becomes input to a separate musical-understanding / interpretation layer, which can later assign gameplay semantics with its own confidence and QC policy.

The architecture remains:

**v0.19 DSP/timing → deterministic structure evidence → optional AI musical interpretation → gameplay event generation**

No new low-level structure DSP should be added until evidence demonstrates a gap that cannot be covered by the existing v0.19 outputs.

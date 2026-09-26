# Trackcade Musical Structure v1 — Research Specification

Status: **research / diagnostic only**. This layer does not modify Trackcade Analyzer v0.19 timing output.

## Architectural position

Trackcade keeps the existing separation:

**Audio DSP → trustworthy v0.19 timing map → musical-structure evidence → optional AI musical interpretation → gameplay generation**

The released Analyzer remains responsible for objective timing facts. Structure v1 consumes those facts and the same source audio to describe larger-scale musical organization.

## Frozen timing dependency

- production timing baseline: Trackcade Analyzer v0.19
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- timing confidence/tier semantics remain unchanged

Structure v1 may consume v0.19 BPM, tempo segments, beat grid, interaction timing, meter/downbeat evidence, confidence, and timing tier where available. It may not rewrite them.

## Product problem

Existing Trackcade content already has manually authored larger-scale events such as:

- `section`
- `drop`
- `energy`
- `peak`

and an `energyCurve`.

The goal of Structure v1 is to automate the objective evidence underneath those concepts so future gameplay generation does not require hand-authored song timelines.

## What deterministic Structure v1 should output

### 1. Energy timeline

A normalized time-varying energy estimate aligned to stable timing units where possible.

Evidence can include:

- short-window RMS / loudness proxy
- transient density
- spectral-band energy distribution
- beat-synchronous aggregation
- smoothed local slope and contrast

The output should be descriptive, not genre-specific.

### 2. Boundary candidates

Times where the music appears to change section or state.

Useful deterministic evidence can include:

- abrupt energy change
- sustained energy-level transition
- novelty in spectral profile
- novelty in onset/transient profile
- changes in beat-synchronous accent behavior
- changes in texture/density
- agreement across independent windows

Boundary times should prefer snapping to trustworthy bar/downbeat positions when v0.19 timing confidence supports that. If meter/downbeat evidence is weak, stay beat-aligned or time-based rather than inventing bar precision.

### 3. Peak / valley / rise / fall candidates

Expose local structural dynamics such as:

- sustained rise
- sustained fall
- local peak
- local valley/break
- high-energy plateau

These are evidence categories, not semantic claims like `chorus` or `drop`.

### 4. Repetition / section-similarity evidence

Where practical, estimate whether separated time ranges have similar beat-synchronous energy/spectral profiles. This can support later recognition of recurring hooks/choruses without hard-coding semantic labels.

### 5. Confidence

Every structural event must carry confidence and the evidence used to produce it.

Safe uncertainty is preferred over excessive segmentation.

## Explicit non-goals for deterministic v1

Structure v1 does **not** initially claim to identify:

- verse
- chorus
- bridge
- intro/outro semantics
- emotional meaning
- lyrical meaning
- genre
- instrumentation identity
- whether a section is a commercially meaningful `drop`

Those labels require a later interpretation layer and may use AI/audio-language models if useful.

## Initial output contract

Research output should be JSON shaped approximately as:

```json
{
  "schema": "trackcade-structure-v1-diagnostic",
  "timingSource": {
    "release": "v0.19",
    "runnerSha256": "..."
  },
  "energyCurve": [
    {"t": 0.0, "energy": 0.0, "confidence": 0.0}
  ],
  "boundaries": [
    {
      "t": 0.0,
      "confidence": 0.0,
      "snap": "bar|beat|time",
      "evidence": {
        "energyNovelty": 0.0,
        "spectralNovelty": 0.0,
        "transientNovelty": 0.0
      }
    }
  ],
  "dynamics": [
    {"t": 0.0, "kind": "rise|fall|peak|valley|plateau", "confidence": 0.0}
  ],
  "similarity": [
    {"aStart": 0.0, "aEnd": 0.0, "bStart": 0.0, "bEnd": 0.0, "score": 0.0}
  ]
}
```

The exact schema may evolve during diagnostic work, but the distinction between objective evidence and semantic interpretation is permanent.

## First fixture: ALLDAT

`ALLDAT_ruffmix.mp3` and `alldat-trackcade.json` are the first product fixture because the repository already contains a manually authored Trackcade timeline.

The manual events are useful for qualitative comparison, but they are **not a scientific ground-truth corpus** and must not become hard-coded thresholds. A useful first diagnostic should independently recover at least several obvious larger-scale changes while remaining sparse enough for gameplay use.

## Research sequence

1. Capture the exact v0.19 Analyzer output for ALLDAT.
2. Build beat-synchronous energy and novelty descriptors without changing v0.19.
3. Emit diagnostic boundary/dynamic candidates only.
4. Compare visually/numerically with the existing manually authored timeline.
5. Add multiple real tracks before freezing thresholds or claiming generality.
6. Only after the deterministic evidence is stable, design the optional semantic/AI interpretation layer.

## Guardrails

- Do not modify `release/analyzer-v0.19`.
- Do not make structure logic alter canonical BPM, beat phase, timing confidence, timing tier, or interaction beats.
- Do not use ALLDAT event names as inputs to the structure detector.
- Do not tune a rule to one song and present it as general.
- Do not invent bar precision when v0.19 does not support it confidently.
- Do not require AI for low-level timing or basic energy/novelty detection.
- Do not emit confident semantic labels from deterministic DSP evidence alone.
- Prefer a small number of useful, confidence-aware structural events to noisy over-segmentation.

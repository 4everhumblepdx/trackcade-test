# Trackcade Musical Interpretation v1 — Proposal and QC Contract

Status: **research / integration contract**

This layer sits above the deterministic Analyzer and Structure Evidence v1.

Architecture:

**v0.19 timing/DSP → Structure Evidence v1 → optional musical interpretation → deterministic semantic QC/compiler → Trackcade manifest**

The safe automatic baseline remains the permanent fallback.

## Why this layer exists

Product-fixture evidence showed that v0.19 often detects useful musical moments and energy contours, but its structure labels are not reliable enough to use directly as gameplay commands.

Trackcade semantic events have strong effects:

- `drop` starts Overdrive;
- `peak` creates the golden-orb spiral;
- `energy` permanently raises the gameplay energy ramp;
- `section` changes environment state.

Therefore a higher-level interpreter may propose semantics, but **timing authority and release authority remain deterministic**.

## Inputs

The semantic compiler consumes exactly three inputs:

1. a validated `trackcade-safe-gameplay-baseline-v1` manifest;
2. its matching `trackcade-structure-evidence-v1` JSON;
3. a `trackcade-musical-interpretation-v1` proposal.

The proposal is not allowed to supply or alter:

- beat times;
- BPM;
- beat offset;
- timing tier;
- energy curve;
- song duration;
- game tuning;
- art/palette;
- Analyzer source identity.

## Proposal schema

```json
{
  "schema": "trackcade-musical-interpretation-v1",
  "source": {
    "analyzerRunnerSha256": "...",
    "analysisJsonSha256": "..."
  },
  "events": [
    {
      "kind": "section|energy|drop|peak",
      "semanticConfidence": 0.0,
      "name": "optional-human-readable-name",
      "duration": 12,
      "anchor": {
        "type": "boundary|landmark",
        "index": 0
      },
      "rationale": "optional explanation"
    }
  ]
}
```

The interpreter chooses **what** an objective evidence anchor means. It does not choose the final event time. The compiler takes final timing from the referenced deterministic evidence anchor.

## Source integrity

Compilation fails closed unless all three inputs agree on:

- Analyzer runner SHA-256;
- SHA-256 of the exact v0.19 analysis JSON used to create both the safe manifest and Structure Evidence;
- song duration within floating-point tolerance;
- timing tier.

The exact analysis JSON hash is the primary per-song source identity for this layer.

During fixture work, v0.19 `sourceFingerprint` was observed as 64 zeroes on multiple distinct raw-run tracks. Therefore `sourceFingerprint` is preserved only as diagnostic metadata and is **not** accepted as a uniqueness/security key.

A proposal for one analysis/song may never be applied to another song even if its diagnostic `sourceFingerprint` value happens to match.

## Evidence anchors

Every proposed semantic event must reference exactly one existing Structure Evidence v1 anchor.

- `boundary` references `evidence.boundaries[index]`.
- `landmark` references `evidence.landmarks[index]`.

Final event time is the anchor's deterministic `time`.

The proposal may not invent an independent timestamp.

Recommended anchor families:

- `section`: boundary preferred; landmark allowed only if no useful boundary exists.
- `energy`: landmark preferred.
- `drop`: landmark or boundary.
- `peak`: landmark preferred.

These are recommendations; deterministic QC still decides whether the evidence is strong enough for the requested gameplay effect.

## Semantic-confidence gates

These are conservative **product safety thresholds**, not MIR benchmark claims:

- `section`: >= 0.80
- `energy`: >= 0.85
- `peak`: >= 0.90
- `drop`: >= 0.92

Model-reported confidence is never sufficient by itself. The objective gates below must also pass.

## Objective gates

### All semantic events

- source integrity must pass;
- timing tier must be `standard` or `loose`;
- anchor must exist and be finite/in-range;
- anchor may not fall inside a v0.19 low-demand window unless the event kind is `section`;
- event must respect cooldown rules;
- duplicate events at the same anchor/kind are rejected.

### `section`

A section proposal is accepted when its semantic-confidence gate passes and it references a valid boundary or landmark.

If a generic baseline `section` event is already within 0.75 seconds of the anchor, the compiler names that event rather than adding another section event.

### `energy`

Requires at least one of:

- local `riseInto >= +0.08`;
- local `netChange >= +0.10`;
- energy at anchor `>= 0.70` and landmark intensity `>= 0.55` when landmark intensity is available.

This command is intentionally conservative because each accepted `energy` event permanently increments Trackcade's gameplay energy level.

### `peak`

Requires:

- energy at anchor `>= 0.68`; and
- landmark intensity `>= 0.60` when a landmark anchor supplies intensity.

A boundary anchor without landmark intensity requires energy at anchor `>= 0.78`.

### `drop`

Requires at least one of:

- `riseInto >= +0.12`;
- `netChange >= +0.15`;
- energy at anchor `>= 0.78` plus landmark intensity `>= 0.70` when available.

The anchor must not be inside a low-demand window.

`drop` duration defaults to 12 seconds and must be between 6 and 20 seconds.

## Cooldowns

After sorting accepted proposals by deterministic anchor time:

- `section`: minimum 3 seconds from the previous accepted section command;
- `energy`: minimum 10 seconds from the previous accepted energy command;
- `peak`: minimum 8 seconds from the previous accepted peak command;
- `drop`: minimum 12 seconds from the previous accepted drop command;
- any two high-impact commands in `{energy, peak, drop}`: minimum 4 seconds apart.

The purpose is gameplay readability and protection against noisy interpretation, not a claim about musical form.

## Output behavior

The compiler begins from the safe baseline and may only:

- name/annotate an existing generic section event; or
- append accepted `section`, `energy`, `peak`, or `drop` events.

It must preserve bit-for-value equality of:

- all authored beat events;
- `energyCurve`;
- BPM;
- beat offset;
- song length;
- track identity/art/tuning fields.

Rejected proposals are recorded in a compilation report with explicit reasons.

If zero proposals survive QC, the output remains the safe baseline for gameplay purposes.

## Fail-closed policy

Malformed proposal JSON, source mismatch, evidence/source mismatch, or an invalid safe-baseline contract causes compilation to fail rather than guess.

Individual low-confidence or weakly supported semantic events are rejected without invalidating the safe baseline.

## AI policy

The interpreter may eventually be an audio-capable model, a learned classifier, deterministic+learned hybrid, or a human authoring tool.

Its job is to propose musical/gameplay meaning.

It is **not** allowed to become the timing engine.

The deterministic compiler is the trust boundary between interpretation and gameplay.

# Trackcade Learned Interpretation v1 — Provider-Agnostic Contract

Status: **preregistered harness contract before any learned/provider output is generated**

## Purpose

Build a provider-agnostic bridge from Trackcade's closed, label-blind interpretation packet to the already-frozen `trackcade-musical-interpretation-v1` proposal schema.

The learned/provider layer may improve **semantic meaning assignment**. It does not receive timing authority.

This lane starts from the frozen Semantic Quality v1 baseline and must not modify Analyzer v0.19, Structure Evidence, Musical Interpretation v1 compiler thresholds, Gameplay, Visual, or the authored benchmark references.

## Frozen upstream

### Production Analyzer

- branch: `release/analyzer-v0.19`
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

### Musical Interpretation v1 closure

- commit: `76c247a5df79a8dc169c4cd933e4499a0ced1fa5`
- integration run: `36323696425`
- integration artifact: `10933550802`
- artifact digest: `sha256:6a6b05b6da7c5f59d4473cbb497edce7de2ad2a3ecc7a4d795a6d6f63bc784ab`

### Semantic Quality v1 baseline

- result commit: `51c33d4393d42e479504490f85f0259ec088780c`
- run: `36342720212`
- artifact: `10939642086`
- artifact digest: `sha256:5d08033b38f0bc479da225b8a4c7aff9ac630131a53ab69a10c476634029ce7a`
- benchmark JSON SHA-256: `264f18ebbff76adae1614958476a50f5b49e7339c0b69bfbd3c7635129cec890`

The two-product semantic baseline is a development/regression yardstick only, not an independent holdout and not a production promotion threshold.

## Input contract

A provider/model receives exactly one `trackcade-interpretation-packet-v1` document plus deterministic output instructions.

The packet is built by the closed `research/interpretation-v1/build_interpretation_packet_v1.py` path and contains:

- exact source provenance;
- timing-trust metadata;
- structure-trust metadata;
- objective energy evidence;
- deterministic sections;
- deterministic boundaries;
- deterministic landmarks;
- low-demand windows;
- an embedded interpretation contract.

The packet builder strips diagnostic semantic hints.

A provider/model must **not** receive:

- hand-authored product timeline labels or times;
- Semantic Quality benchmark pairs/confusions/scores;
- Analyzer diagnostic semantic labels/hints;
- compiler accept/reject outcomes for the song being generated;
- prior hand-written proposal JSON for the song being generated;
- any instruction to reproduce a reference timeline.

## Timing authority

Permanent rule:

**The provider chooses meaning. Deterministic Structure Evidence chooses time.**

Provider/model output may reference only an existing anchor:

```json
{"type":"boundary","index":0}
```

or

```json
{"type":"landmark","index":0}
```

The provider/model must never emit or control:

- `t`;
- `time`;
- `timestamp`;
- BPM;
- beat offset;
- beat grid edits;
- song duration edits;
- Analyzer tier/confidence edits;
- Structure Evidence edits.

The closed semantic compiler resolves the selected anchor to the final event time.

## Provider proposal schema

The normalized provider output must be the existing schema:

```json
{
  "schema": "trackcade-musical-interpretation-v1",
  "source": {
    "analyzerRunnerSha256": "<exact packet source value>",
    "analysisJsonSha256": "<exact packet source value>"
  },
  "events": [
    {
      "kind": "section|energy|peak|drop",
      "semanticConfidence": 0.0,
      "anchor": {"type":"boundary|landmark","index":0},
      "name": "optional except required for section",
      "duration": 12,
      "rationale": "optional short rationale"
    }
  ]
}
```

### Top-level restrictions

Allowed top-level keys are exactly:

- `schema`
- `source`
- `events`

`schema` must equal `trackcade-musical-interpretation-v1`.

`source` must contain exactly:

- `analyzerRunnerSha256`
- `analysisJsonSha256`

Both values must exactly match the supplied packet.

`events` must be a list with at most 64 entries, matching the closed compiler's maximum proposal count.

### Event restrictions

Allowed event keys are:

- `kind`
- `semanticConfidence`
- `anchor`
- `name`
- `duration`
- `rationale`

No other event key is accepted by the learned-provider harness.

`kind` must be one of the packet's `allowedProposalKinds`.

`semanticConfidence` must be a finite numeric value in `[0,1]`.

`anchor` must contain exactly `type` and `index`:

- type must be one of the packet's `anchorTypes`;
- index must be a non-boolean integer;
- index must resolve inside the corresponding packet boundary/landmark array.

`section` requires a non-empty normalized `name` no longer than 80 characters.

`name` on other kinds is optional and, when present, must be a non-empty normalized string no longer than 80 characters.

`rationale` is optional and, when present, must be a non-empty normalized string no longer than 500 characters.

`duration` is allowed only for `drop`; when present it must be finite numeric data. The closed compiler remains authoritative for its accepted duration range/default.

The harness does not copy semantic-confidence thresholds, low-demand rules, objective-energy gates, cooldowns, or cross-kind conflict policy. Those remain exclusively in the closed semantic compiler.

## Forbidden-key defense

The provider proposal is recursively rejected if it contains a key, case-insensitively, that attempts to carry independent timing or timing edits, including:

- `t`
- `time`
- `timestamp`
- `bpm`
- `beatOffset`
- `beat_offset`
- `beatGrid`
- `beat_grid`
- `beats`
- `songLength`
- `durationSeconds`
- `timingTier`
- `timingConfidence`

The permitted `drop.duration` field is the only event-duration exception and does not control event timing.

## Request / response separation

Provider-specific API transport is outside the semantic proposal schema.

Every future provider execution must preserve a separate run manifest containing at least:

- provider name;
- model identifier/version string returned or configured;
- provider request ID if available;
- exact packet SHA-256;
- exact deterministic instruction/prompt SHA-256;
- raw provider response SHA-256;
- normalized proposal SHA-256;
- generation parameters that are actually configurable/observable;
- UTC execution timestamp;
- harness source commit.

Secrets/API keys must never be committed to the repository or embedded in artifacts.

## Deterministic provider instruction

The harness instruction must tell the provider/model to:

1. reason only from the supplied label-blind packet;
2. identify a sparse set of musically meaningful gameplay semantics;
3. choose only `section`, `energy`, `peak`, or `drop`;
4. reference only existing boundary/landmark indexes;
5. emit no timestamps or beat/BPM changes;
6. return only the proposal JSON schema;
7. use calibrated `semanticConfidence` rather than forcing an event at every evidence anchor;
8. prefer omission over unsupported certainty.

Provider-specific wrappers may add API syntax, but may not add reference labels/times, expected benchmark answers, or song-specific semantic hints.

## Fail-closed pipeline

A future provider run follows this order:

1. verify exact packet/provenance;
2. generate raw provider response in a generation job with no authored-reference access;
3. parse JSON without repairing semantic content;
4. validate with the learned-provider harness;
5. reject malformed/leaky/timing-authority output before compilation;
6. pass valid proposal to the **unchanged closed Musical Interpretation v1 compiler**;
7. run existing downstream gameplay safety where applicable;
8. evaluate proposal and accepted-compiled output with the frozen Semantic Quality v1 evaluator in a separate evaluation job.

The evaluation/reference job must not feed anything back into the same generation request.

## Provider-independent harness proof

Before any external model is used, this lane must prove the harness itself by using only static conformance fixtures:

Positive fixtures:

- the two already-frozen evidence-only v1 proposals, used only because they conform to the existing proposal schema.

Negative synthetic mutations must include at least:

- top-level independent timestamp;
- event `time` or `t`;
- BPM/beat-grid edit attempt;
- mismatched analysis hash;
- out-of-range anchor index;
- unsupported anchor type;
- unsupported semantic kind;
- non-finite/out-of-range confidence;
- section with no usable name;
- unexpected extra event key;
- non-drop `duration`;
- too many events.

Every negative fixture must be rejected deterministically.

This harness proof measures **contract enforcement only**, not semantic quality.

## Semantic-quality comparison

After a real provider is connected, its product-fixture output may be compared descriptively to the frozen v1 baseline using the unchanged Semantic Quality v1 evaluator.

The central existing baseline at 4 seconds is:

- proposal-intent exact-kind micro F1: `0.18181818181818182`;
- proposal-intent landmark-only micro F1: `0.4090909090909091`;
- accepted-compiled exact-kind micro F1: `0.1395348837209302`;
- accepted-compiled landmark-only micro F1: `0.4186046511627907`.

Those scores are **not** production thresholds because the two songs are visible project fixtures, not an independent holdout.

The development goal is to improve meaning assignment without taking timing authority away from deterministic evidence.

## Promotion boundary

No provider/model becomes a production semantic interpreter merely by beating the two-song development baseline.

Production consideration additionally requires a separately frozen, independently labeled evaluation set large enough to test semantic quality outside these visible product fixtures, plus unchanged compiler and downstream safety gates.

## Current lane scope

Until a model/provider connection is available, Learned Interpretation v1 may complete:

- provider-neutral request construction;
- strict proposal validation;
- provenance/run-manifest construction;
- conformance CI;
- generation/evaluation job separation;
- integration hooks for a future provider.

It must not fabricate model output and call it learned inference.

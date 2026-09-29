# Stage 1 V4 Development Protocol — Drop Presence + Track-Relative Distinctiveness

Status: **FROZEN DESIGN BEFORE ANY V4 PROVIDER RESPONSE**

## Purpose

V4 tests one scientific variable: whether changing the learned semantic decision architecture improves RAW Drop selection when all deterministic evidence and timing authority remain frozen.

V3 changed evidence richness while preserving the prior Drop meaning instruction as closely as possible. V4 does the inverse: it reuses the exact frozen V3 Structure Evidence v2 packet bytes and changes only the semantic decision procedure.

The V4 hypothesis is that two explicit decisions improve semantic precision without surrendering recall:

1. decide whether the track contains a semantically justified Drop at all; and
2. when a Drop may be present, compare plausible Drop-like transitions against other strong transitions in the same track and emit only transitions that are distinct enough to justify the Drop label.

## Immutable inputs

V4 inherits unchanged:

- Analyzer release: v0.19.
- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`.
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`.
- Structure Evidence v2 freeze commit: `708e824fd977a240e86dd9425a1a5e1b437775ad`.
- Structure Evidence v2 bundle SHA-256: `16858488f584ef85164241679c6dcf3675393e46ff33d99f8bde6b6617a7c4ca`.
- selected evidence policy: `current-core-accent-table-v2`.
- the same frozen Stage 1 50-track development set.
- the same frozen reference labels, matcher, and tolerance windows for later evaluation.
- the same sole timing source: `packet.anchors[event.anchor.index][0]`.

V4 preparation must reuse the exact `structure-evidence-v2.json` bytes already frozen in the successful V3 preparation artifact:

- V3 prep run: `36457485587`.
- V3 prep artifact ID: `10986506165`.
- V3 prep artifact digest: `sha256:5f9e4159faf620f6b527fecc649b456633a3dccfca074dca7c6a422d3527e376`.
- V3 prep manifest SHA-256: `df7ceff4c82291552a2d55dd7ddf872269477d0766bf4cb785a90b5730779257`.

V4 preparation does not reconstruct or regenerate Structure Evidence v2.

The terminal 50-track holdout remains untouched.

## Learned-layer contract

Provider-neutral request schema: `trackcade-learned-interpretation-request-v3`.

Provider proposal schema: `trackcade-musical-interpretation-v3`.

Development revision: `stage1-drop-semantics-v4-presence-relative-distinctiveness`.

The sole selectable anchor form remains:

```json
{"type":"evidence","index":N}
```

`N` is the zero-based row index of `packet.anchors`. The provider may not emit or alter an independent timestamp, BPM, beat grid, beat offset, timing tier, song length, or any other timing authority.

## V4 semantic variable

### Stage A — track-level Drop presence

Before selecting any Drop event, the model must make one explicit track-level decision:

- `drop_present`
- `no_drop`
- `insufficient_semantic_evidence`

`no_drop` and `insufficient_semantic_evidence` are valid successful semantic conclusions, not provider failures.

The following observations are not sufficient by themselves to establish a Drop:

- chorus entrance or repeated chorus entrance;
- ordinary section return;
- generic re-entry after a break;
- breakdown ending;
- ordinary verse-to-chorus transition;
- isolated high-energy peak;
- large positive energy delta;
- quiet passage followed by loud material;
- strong Analyzer salience, priority, or confidence;
- multiple similar low-to-high transitions.

### Stage B — track-relative comparison

When the track decision is `drop_present`, plausible Drop-like transitions must be compared against other strong transitions in the same track.

The learned layer must not ask only whether an anchor resembles preparation → impact/release → stronger passage. It must also ask what makes that transition more Drop-like than the track's other major transitions.

If multiple transitions have substantially interchangeable structural geometry and the packet does not establish why a candidate has a distinct payoff/release role, the model must classify the candidate as ordinary or ambiguous and abstain from emitting a Drop at that anchor.

No arbitrary maximum number of semantic Drops is introduced. The existing technical maximum event count remains a safety bound only.

## Proposal contract

Top-level proposal fields are:

- `schema`
- `source`
- `trackSemanticDecision`
- `candidateComparisons`
- `events`

`trackSemanticDecision` contains:

- `dropPresence`: one of `drop_present`, `no_drop`, `insufficient_semantic_evidence`;
- `presenceConfidence`: diagnostic 0..1 value;
- `localizationStatus`: one of `localized`, `no_selectable_anchor`, `not_applicable`;
- `rationale`: concise track-level explanation.

`candidateComparisons` is a sparse set of plausible Drop/re-entry transitions needed to justify the track-level decision. Each row contains:

- an Analyzer-derived evidence anchor;
- `role`: `selected_drop`, `ordinary_transition`, or `ambiguous`;
- diagnostic `distinctiveness` in 0..1;
- a concise comparative rationale.

Every emitted Drop and every `selected_drop` comparison must correspond one-for-one at the same evidence anchor.

Decision consistency rules:

- `no_drop` requires `localizationStatus=not_applicable`, zero Drop events, and zero `selected_drop` comparisons.
- `insufficient_semantic_evidence` requires `localizationStatus=not_applicable`, zero Drop events, and zero `selected_drop` comparisons.
- `drop_present` + `localized` requires at least one Drop event and matching `selected_drop` comparison.
- `drop_present` + `no_selectable_anchor` requires zero Drop events and zero `selected_drop` comparisons.
- `drop_present` + `not_applicable` is invalid.

Non-Drop semantic events (`section`, `energy`, `peak`) remain permitted so V4 does not silently collapse the broader V3 semantic vocabulary into a Drop-only task.

`presenceConfidence`, `distinctiveness`, and `semanticConfidence` are diagnostic outputs only. V4 has no deterministic confidence gate.

## Semantic instruction control

V4 is an explicitly declared semantic retuning relative to V3. The instruction-diff record must therefore set `semanticRetuningPerformed=true`.

The V4 instruction must preserve all timing-authority restrictions while adding the presence and relative-distinctiveness procedure. It must also replace the prior numeric confidence-band language with the rule that semantic confidence is diagnostic only and cannot license a Drop by itself.

No benchmark-specific cue, per-track exception, label-derived threshold, proposal-count target, or hidden deterministic filter is allowed.

## Provider contract

No provider call is authorized by this protocol or by preparation.

For a future paid V4 generation, the intended controlled comparison remains:

- provider: OpenAI
- API: Responses
- model: `gpt-6-sol`
- reasoning effort: `high`
- max output tokens: `4096`
- store: `false`
- exactly one completed semantic response per Stage 1 track under the normal protocol.

The V4 response contract is intentionally sparse so no structural requirement forces large candidate-comparison arrays. Offline preparation must report payload footprint. The 4096 output budget must not be silently increased.

## Preparation boundary

Before any V4 provider call, all 50 exact V4 requests and OpenAI payloads must be generated and frozen offline.

Preparation must verify:

- exact reuse of all 50 V3-frozen Structure Evidence v2 packet bytes;
- exact Stage 1 identities and ordinals 1–50;
- exact Analyzer identity;
- exact V3 prep source artifact identity and manifest SHA-256;
- zero reference-label access;
- zero terminal-track processing;
- zero Analyzer execution;
- zero audio decoding;
- zero provider calls;
- zero compiler invocation;
- source-map aliases absent from provider input;
- benchmark labels and diagnostic semantic hints absent from provider input;
- exact instruction, builder, validator, adapter, request, and payload hashes.

## Future evaluation contract — declared now, not run during preparation

V4 Stage 1 evaluation remains **RAW Drop proposal only**.

For every validated Drop proposal, time resolves only as:

`packet.anchors[event.anchor.index][0]`

The unchanged one-to-one matcher and scoring logic remain authoritative.

Primary tolerance: ±2 seconds.

Sensitivity windows: ±1 and ±5 seconds.

Headline metrics remain proposal count, matches, false positives, false negatives, precision, recall, and F1.

Predeclared diagnostic counts are:

- predicted `no_drop` tracks;
- predicted `drop_present` tracks;
- predicted `insufficient_semantic_evidence` tracks;
- true zero-Drop tracks correctly abstained;
- zero-Drop tracks incorrectly declared positive;
- positive tracks incorrectly abstained;
- proposals per predicted-positive track.

These diagnostics do not alter RAW scoring.

Frozen comparison baselines are:

- V1 RAW ±2 F1: 27.642276%.
- V2 RAW ±2: 73 proposals, 15 matches, precision 20.5479%, recall 32.6087%, F1 25.2101%.
- V3 RAW ±2: 83 proposals, 19 matches, 64 FP, 27 FN, precision 22.8916%, recall 41.3043%, F1 29.4574%.

## Research boundaries

- Stage 1 remains development data.
- Terminal data remains untouched until an explicitly frozen final policy.
- No V4 rule may be changed after observing V4 provider results without declaring a new development revision.
- Any later confidence gate, proposal cap, heuristic filter, label-informed exception, or post-result threshold becomes V5 or later.
- Successful semantic performance never grants learned timing authority.
- Compiler cleanup is not part of the V4 headline experiment.

## Stop point

After the V4 preparation artifact succeeds and its run ID, artifact ID/digest, head SHA, manifest SHA, source identities, instruction SHA, and research-boundary checks are committed in a pre-provider freeze record, stop.

Do not dispatch V4 provider generation without Nicholas's explicit authorization for that specific paid generation.
# TrackCade Stage1 V5 Development Protocol

## Status

V5 is a **label-informed Stage1 development revision** created after the frozen V4 RAW evaluation. Stage1 is no longer an unbiased holdout. The separate terminal holdout remains untouched and is the only reserved final holdout.

This protocol freezes the V5 scientific variable before any V5 provider generation.

## Why V5 exists

Frozen V4 sharply reduced false positives on zero-Drop tracks but collapsed recall. V4's track-level presence-first and track-relative-distinctiveness procedure treated similarity among strong transitions as negative evidence. Post-V4 diagnostics showed that this architecture can reject legitimate repeated Drops simply because multiple transitions share similar Drop-like geometry.

V5 keeps the useful negative discrimination while removing that uniqueness assumption.

## Single semantic revision

V5 changes the semantic decision architecture to:

1. assess plausible Drop/re-entry transition anchors individually;
2. classify each candidate against one absolute Drop definition;
3. allow any number of repeated or structurally similar candidates to be Drops when each independently satisfies that absolute definition;
4. derive the track-level summary only after candidate classifications are complete.

The absolute Drop definition is one coherent transition with packet-supported:

- preparation / withdrawal / tension;
- a distinct impact or release;
- a sustained stronger passage after the impact/release.

A candidate may be classified `drop` only when all three components are clear.

Similarity to another Drop-like transition is **not negative evidence** and cannot by itself cause rejection or abstention. Repetition is also not positive evidence by itself: repeated chorus entrances, section returns, re-entries, or other strong transitions still require the full absolute Drop pattern.

## Explicit negatives retained

The following are not sufficient by themselves to authorize a Drop:

- chorus entrance or repeated chorus entrance;
- ordinary section return;
- generic re-entry after a break;
- breakdown ending;
- ordinary verse-to-chorus transition;
- isolated peak;
- large positive energy delta;
- quiet-to-loud change;
- high Analyzer salience, priority, or confidence;
- a strong transition in general.

## Derived summary, not gate

`trackSummary` is a consistency summary and cannot veto candidate decisions.

- one or more `drop` candidate assessments -> `drop_present`;
- zero Drops and one or more `ambiguous` assessments -> `ambiguous_only`;
- otherwise -> `no_drop`.

`trackSummary.dropCount` and `trackSummary.ambiguousCandidateCount` must exactly match the candidate assessments.

Every `drop` candidate assessment maps one-for-one to a Drop event at the same frozen evidence anchor, and every Drop event requires one matching `drop` assessment.

## Frozen controls

V5 does **not** change:

- the 50-track Stage1 identity set;
- Structure Evidence v2 bytes;
- Analyzer timing authority;
- Analyzer v0.19 identity;
- BPM or beat grid;
- benchmark labels;
- one-to-one evaluation matcher or tolerances;
- RAW-only evaluation policy;
- terminal holdout policy;
- compiler policy (compiler remains outside the experiment).

Analyzer identity:

- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

Structure Evidence v2 identity:

- freeze commit: `708e824fd977a240e86dd9425a1a5e1b437775ad`
- bundle SHA256: `16858488f584ef85164241679c6dcf3675393e46ff33d99f8bde6b6617a7c4ca`
- policy: `current-core-accent-table-v2`

## Timing authority

The learned layer has no independent timestamp authority. All Drop times are the time in the selected frozen evidence-anchor row. Provider timestamps, offsets, averaging, BPM edits, and grid edits are forbidden.

## Confidence

All semantic confidence fields are diagnostic only. No confidence threshold accepts, rejects, or authorizes a Drop.

## Provider contract to freeze offline

The preparation artifact freezes exact provider payloads with:

- provider: OpenAI Responses;
- model: `gpt-6-sol`;
- reasoning effort: `high`;
- max output tokens: `8192`;
- `store: false`.

The move from 4096 to 8192 is predeclared from V4 output-capacity/transport evidence. It is not selected after observing any V5 semantic output and is not a semantic scoring threshold.

Preparation performs **zero provider calls**.

## Research boundary during V5 preparation

Preparation must prove:

- exactly 50 payloads;
- exact frozen Structure Evidence v2 reuse;
- benchmark reference labels absent from the prep path;
- terminal holdout untouched;
- Analyzer not executed;
- audio not decoded;
- compiler not invoked;
- provider calls = 0;
- source, request, payload, and evidence hashes frozen.

Stage1 label-informed design provenance is documented here and in the prep manifest, but labels themselves are not supplied to V5 generation payloads.

## Future generation rule

No V5 provider generation is authorized by this protocol. After the complete prep artifact is frozen and audited, work stops. A separate, explicit user approval is required for the specific paid V5 generation.

If later authorized, the intended generation policy is one completed provider response per track under the frozen payload contract. A completed semantic response receives no semantic retry. Provider/infrastructure failure handling must be separately evidence-bound and explicitly authorized if needed.

## Predeclared future evaluation

After a complete immutable 50-response generation freeze, Stage1 labels may be materialized for RAW evaluation only.

Primary:

- ±2 seconds: micro precision, recall, F1.

Sensitivity:

- ±1 second;
- ±5 seconds.

Diagnostics to preserve include:

- total proposal count;
- zero-reference tracks with proposals and false-positive proposal count;
- positive-reference tracks with zero proposals;
- candidate assessment role counts;
- repeated-similar candidates classified Drop vs ordinary vs ambiguous;
- proposals per predicted-positive track.

No compiler cleanup, semanticConfidence threshold, post-result filtering, or timestamp adjustment is part of V5. Any new filter after observing V5 results is a new development revision.

# Stage1 V7 semantic development protocol

Status: label-informed Stage1 development only. No provider call, terminal evaluation, compiler invocation, or Analyzer execution is authorized by this document.

## Why V7 exists

Frozen V6 development scoring exposed a specific contract failure rather than a candidate-discovery failure.

- Frozen V3 RAW ±2: 19 TP / 64 FP / 27 FN, F1 29.46%.
- Frozen V5 RAW ±2: 19 TP / 83 FP / 27 FN, F1 25.68%.
- Frozen V6 RAW ±2: 2 TP / 0 FP / 44 FN, F1 8.33%.
- V6 still produced 220 candidate assessments, including 22 with `decisiveImpact=clear`.
- V6 marked `ordinaryReturnAlternative=plausible` on 218/220 candidates and `ruled_out` on only 2/220, exactly matching the two emitted Drops.

The observed failure is therefore not that V6 stopped seeing musically meaningful transitions. The V6 contract made an ordinary chorus/section return, generic re-entry, or breakdown ending function as a competing explanation that had to be ruled out before a Drop could be emitted. That assumption is too strong: structural function and impact morphology are not mutually exclusive. A chorus entrance or re-entry can itself contain a concentrated Drop-like impact.

Post-hoc development counterfactuals are diagnostic only and are not V7 acceptance rules. In particular, removing only the V6 ordinary-return veto from frozen V6 assessments produced 7 TP / 7 FP / 39 FN at ±2, while additionally admitting `decisiveImpact=unclear` produced 12 TP / 26 FP / 34 FN. Those observations motivate the variable separation below but do not authorize a threshold, shortcut, or label-derived exception.

## Frozen inputs and boundaries

V7 must reuse the exact frozen Stage1 Structure Evidence v2 packets, Analyzer v0.19 identity, and Analyzer-owned anchor times used by V3/V4/V5/V6.

V7 must not:

- decode audio;
- run or modify the Analyzer;
- edit BPM, grid, anchors, or timestamps;
- invoke the compiler;
- use prior-model outputs as provider input;
- expose Stage1 reference labels in provider input;
- use terminal data;
- add a confidence, salience, priority, count, or cross-version agreement threshold.

Primary development evaluation remains RAW Drop matching at ±2 seconds with sensitivity at ±1 and ±5 seconds under the unchanged frozen one-to-one matcher. No compiler result may replace the RAW headline.

Stage1 is label-informed development. A V7 development score is not an unbiased generalization estimate.

## V7 scientific variable: separate impact morphology from structural function

V7 keeps the candidate-first architecture, repeated-Drop permission, clear preparation requirement, clear decisive-impact requirement, and clear sustained-stronger-passage requirement from V6.

V7 removes `ordinaryReturnAlternative` as a Drop veto and replaces it with an orthogonal descriptive field named `structuralContext`.

For every plausible candidate, the model must answer two independent questions:

1. **Impact morphology:** Does this anchor contain the local musical shape required for a semantic Drop?
2. **Structural context:** What larger-form function, if any, is occurring at the same anchor?

The structural context must never by itself authorize or reject a Drop.

### Impact morphology

A candidate may be classified `drop` only when all three of the following hold at the same Analyzer-owned anchor:

1. `preparation=clear`: packet-supported withdrawal, tension, restraint, or preparation exists before the candidate.
2. `decisiveImpact=clear`: the candidate itself is a concentrated, locally distinct onset/impact/release point, not merely a gradual energy rise or the unmarked start of a stronger passage.
3. `sustainedStrongerPassage=clear`: a meaningfully stronger passage persists after the impact.

If any of those three fields is weak, absent, or unclear, the candidate must not be classified `drop`.

A generic energy rise, sustained high energy, section boundary, strong transition, return to previously heard energy, high Analyzer confidence/salience/priority, or high semantic confidence cannot by itself satisfy the impact-morphology requirements.

### Structural context

`structuralContext` is descriptive and orthogonal. Allowed values are:

- `chorus_or_section_entrance`
- `section_return`
- `generic_reentry`
- `breakdown_ending`
- `other_transition`
- `none_identified`
- `unclear`

A qualifying semantic Drop may have **any** structuralContext value, including `chorus_or_section_entrance`, `section_return`, `generic_reentry`, or `breakdown_ending`.

Conversely, merely identifying one of those structural functions never makes a candidate a Drop. The three impact-morphology conditions must still be independently satisfied.

This is the sole intended V7 semantic change relative to V6: structural function becomes an orthogonal annotation instead of a counterfactual veto.

## Repetition and track-level behavior

Repeated or structurally similar candidates remain independent semantic decisions. Multiple repeated-similar candidates may all be Drops if each independently satisfies the three impact-morphology conditions.

Similarity is neither positive nor negative evidence by itself. Do not rank candidates against one another, prefer uniqueness, impose a per-track Drop count, or let track summary veto a qualifying candidate.

`trackSummary` remains mechanically derived after all candidate decisions:

- `drop_present` when one or more candidates are `drop`;
- otherwise `ambiguous_only` when one or more candidates are `ambiguous`;
- otherwise `no_drop`.

## Explicit non-variables

V7 does **not** authorize:

- `decisiveImpact=unclear` as a Drop;
- a semanticConfidence threshold;
- an Analyzer confidence/salience/priority threshold;
- a per-track Drop cap, target, or ranking;
- V3/V5/V6 agreement as a production gate;
- candidate uniqueness as evidence;
- timestamp movement, averaging, or offsets;
- label-derived per-track exceptions;
- compiler cleanup in the RAW experiment;
- gameplay/actionability labels as semantic Drop labels.

The diagnostic observation that admitting `decisiveImpact=unclear` improved development recall is explicitly **not** carried into the V7 contract.

## Response contract intent

Each sparse candidate assessment records:

- `anchor`
- `semanticRole`: `drop | ordinary_transition | ambiguous`
- `preparation`: `clear | weak | absent | unclear`
- `decisiveImpact`: `clear | weak | absent | unclear`
- `sustainedStrongerPassage`: `clear | weak | absent | unclear`
- `structuralContext`
- `repetitionRelation`: `independent | repeated_similar | unclear`
- diagnostic-only `semanticConfidence`
- `rationale`

Every candidate classified `drop` must correspond one-for-one to an emitted RAW `drop` event at the same evidence anchor.

## Semantic versus gameplay boundary

V7 remains a semantic Drop experiment only. A candidate classified `ordinary_transition` or `ambiguous` may still be a highly useful TrackCade gameplay/action moment. Semantic non-Drop must not be interpreted as musically meaningless or non-actionable.

The future gameplay layer should consume meaningful candidate moments and semantic context separately rather than treating semantic Drop as the only action source.

## Evaluation plan

Before any paid V7 generation is considered:

1. implement the V7 request builder, validator, and provider adapter offline;
2. add synthetic contract tests proving structural context cannot veto a qualifying Drop and cannot rescue weak impact morphology;
3. prove repeated qualifying Drops remain valid;
4. prove `decisiveImpact=unclear` remains rejected for Drop;
5. prove labels, source-map aliases, terminal data, prior-model outputs, and independent timestamps cannot enter provider input;
6. run only provider-free CI and freeze the tested contract identities.

No V7 provider generation is authorized by this protocol.

## Holdout isolation note

The existing repository reference JSON physically contains both Stage1 development rows and a separate `terminal` section. V6 development metrics used only the Stage1 rows, but opening that file means the existing terminal labels cannot honestly be described as physically unseen after development-label access.

Do not run a final generalization claim on that terminal section. A future unbiased final test requires a fresh sealed holdout whose labels are physically isolated from development materials and remain inaccessible until the semantic contract is frozen.
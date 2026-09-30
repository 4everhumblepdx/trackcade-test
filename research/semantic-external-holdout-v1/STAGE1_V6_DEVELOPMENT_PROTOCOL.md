# Stage1 V6 semantic development protocol

Status: label-informed Stage1 development only. Terminal holdout remains untouched. No provider call is authorized by this document.

## Frozen inputs and boundaries

V6 reuses the exact frozen Stage1 Structure Evidence v2 packets, Analyzer v0.19 identity, and Analyzer-owned anchor times used by V3/V4/V5. V6 does not decode audio, run or modify the Analyzer, edit BPM/grid/timestamps, invoke the compiler, or use terminal data.

Primary development evaluation remains RAW Drop matching at ±2 seconds with sensitivity at ±1 and ±5 under the unchanged frozen one-to-one matcher. No compiler result may replace the RAW headline.

Stage1 labels have already informed V4/V5 diagnosis and therefore V6 is explicitly label-informed development. Any apparent improvement is not unbiased generalization. The terminal holdout remains the only final unbiased semantic test.

## Evidence motivating V6

Frozen V3 RAW ±2: 19 TP / 64 FP / 27 FN, F1 29.46%.
Frozen V5 RAW ±2: 19 TP / 83 FP / 27 FN, F1 25.68%.

The completed V5 post-mortems show:

- Repeated-similar proposals are not uniquely bad: 10/49 were TP versus 9/49 independent proposals. Removing repeated-similar proposals post hoc collapses recall and F1.
- V5 proposals more than ±2 seconds away from any V3 proposal were overwhelmingly false: 1 TP / 23 FP. This is diagnostic evidence of overproduction, not authorization to run V3 as a production gate.
- Confidence has post-hoc separation (AUC 0.722), but confidence remains diagnostic only and no numeric confidence threshold is authorized.
- The strongest numeric packet separator was the compact anchor confidence column. Structure Evidence v2 explicitly defines Analyzer priority/salience/confidence as descriptors, not Drop probability or semantic authorization; V6 must not use them as deterministic semantic gates.
- V5 rationale language mentioning generic release, sustained energy, stronger passage, or return remained dominated by false positives. Explicit impact language was much more enriched for true positives (7 TP / 6 FP among 13 proposals mentioning impact), motivating a narrower semantic variable.

## V6 scientific variable

V6 keeps the V5 candidate-first architecture and repeated-Drop permission, but replaces the permissive `impactRelease` condition with a stricter `decisiveImpact` condition and adds an explicit `ordinaryReturnAlternative` assessment.

For a candidate to be classified `drop`, all of the following must hold for the same Analyzer-owned anchor:

1. `preparation` is `clear`: packet-supported withdrawal, tension, restraint, or preparation before the candidate.
2. `decisiveImpact` is `clear`: the candidate itself is a concentrated, locally distinct onset/impact/release point, not merely the start of a louder or stronger section.
3. `sustainedStrongerPassage` is `clear`: a meaningfully stronger passage persists after the impact.
4. `ordinaryReturnAlternative` is `ruled_out`: the available packet context supports a Drop interpretation beyond an ordinary chorus entrance, verse-to-chorus change, section return, generic re-entry, breakdown ending, or quiet-to-loud transition.

If decisive impact is weak/absent/unclear, or ordinary return remains plausible/unclear, the candidate must be `ordinary_transition` or `ambiguous`, not `drop`.

A generic energy rise, sustained high energy, high salience, high Analyzer confidence, section boundary, strong transition, or generic release from a quiet passage cannot by itself satisfy `decisiveImpact` or rule out an ordinary return.

Repeated or structurally similar candidates remain independent semantic decisions. Multiple repeated-similar candidates may all be Drops if each satisfies the four V6 conditions. Similarity is neither positive nor negative evidence by itself.

## Explicit non-variables

V6 does **not** add or authorize:

- a semanticConfidence threshold;
- an Analyzer confidence/salience/priority threshold;
- a per-track Drop count limit or preferred count;
- V3/V5 agreement as a production gate;
- candidate uniqueness or within-track ranking;
- timestamp movement, averaging, or offsets;
- label-derived per-track exceptions;
- compiler cleanup as part of the RAW experiment.

## Response contract intent

Each sparse candidate assessment records:

- `anchor`
- `semanticRole`: `drop | ordinary_transition | ambiguous`
- `preparation`: `clear | weak | absent | unclear`
- `decisiveImpact`: `clear | weak | absent | unclear`
- `sustainedStrongerPassage`: `clear | weak | absent | unclear`
- `ordinaryReturnAlternative`: `ruled_out | plausible | unclear`
- `repetitionRelation`: `independent | repeated_similar | unclear`
- diagnostic-only `semanticConfidence`
- rationale

Track summary remains mechanically derived after candidate decisions and may not veto a qualifying candidate.

## Evaluation plan

If V6 is ever authorized for provider generation, all 50 Stage1 provider responses must be completed and frozen label-blind before Stage1 references are opened for V6 scoring. Partial scoring is forbidden.

Report RAW proposal count plus TP/FP/FN, precision, recall and F1 at ±1/±2/±5. Primary comparison remains ±2 against frozen V3 and V5. Also report zero-reference false-positive proposals and positive-reference recall/proposal volume.

No terminal holdout, compiler invocation, or further paid retry is authorized by this protocol.

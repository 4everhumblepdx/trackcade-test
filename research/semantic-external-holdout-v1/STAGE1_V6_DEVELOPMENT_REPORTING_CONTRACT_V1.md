# Stage 1 V6 Development Reporting Contract v1

Status: PRECOMMITTED / INERT

This document fixes how the Stage-1 V6 development result will be reported after lawful completion of V6 generation, label-blind freeze, and separately authorized development scoring. It does not authorize provider execution, label access, scoring, terminal-holdout access, compiler execution, or Analyzer execution/modification.

## Purpose

Prevent post-result goalpost movement. The semantic benchmark report must use the already-frozen RAW Drop evaluation view and must remain separate from TrackCade gameplay/actionability judgment.

## Preconditions before any V6 development result may be reported

All of the following must already exist and validate:

1. A complete immutable Stage-1 V6 generation freeze containing exactly 50 development cases: frozen canary ordinal 1 plus completed ordinals 2-50.
2. Evidence that all 50 provider responses were completed and frozen label-blind before Stage-1 development reference labels were opened.
3. A valid, explicit development-scoring activation/receipt naming the exact generation-freeze identity.
4. A completed result from the precommitted compiler-free V6 RAW scorer.
5. The exact frozen historical matcher provenance used for V3/V5 RAW comparison.

If any precondition fails, no partial V6 score or result interpretation is permitted.

## Frozen semantic reporting view

Primary tolerance: +/-2 seconds.

Sensitivity tolerances: +/-1 second and +/-5 seconds.

At each tolerance, report at minimum:
- TP
- FP
- FN
- precision
- recall
- F1

The matcher remains the frozen one-to-one RAW Drop matcher:
1. maximize matching cardinality under the tolerance;
2. among maximum-cardinality matchings, minimize total absolute timing error;
3. use deterministic lexical pair tie-breaking.

No compiler cleanup is allowed in the RAW semantic result.

## Frozen comparison baselines

For the primary RAW +/-2-second view, the precommitted historical baselines are:

- V3: 19 TP / 64 FP / 27 FN; F1 29.46%.
- V5: 19 TP / 83 FP / 27 FN; F1 25.68%.

V6 must be compared only against the same RAW scoring view. Historical results from other scoring views must not be mixed into this comparison.

For +/-1-second and +/-5-second V3/V5 comparisons, use only values recovered from the frozen historical evaluation artifacts with provenance recorded in the final report. Do not infer or reconstruct missing historical values from the +/-2-second result.

## Forbidden post-result tuning

After V6 scores are visible, the development report must not introduce any of the following to improve the reported result:

- semantic-confidence thresholds;
- Analyzer confidence, salience, or priority thresholds;
- per-track Drop caps or preferred counts;
- V3/V5 agreement gates;
- candidate uniqueness/ranking filters;
- timestamp movement, averaging, offsets, or retiming;
- label-derived exceptions;
- compiler cleanup;
- selective case exclusion;
- a new primary tolerance.

Any later experiment motivated by the result must be declared as a new experiment rather than substituted into the frozen V6 result.

## Required provenance in the final development report

Record exact identities/hashes for:

- the complete V6 generation freeze;
- the V6 RAW scorer source/result;
- the scoring activation/receipt;
- the Stage-1 development reference set opened for scoring;
- the historical matcher source/provenance;
- the V3/V5 baseline sources used for comparison.

Also record the aggregate V6 raw Drop count and any other directly reported proposal/event counts with their source artifact.

## Interpretation boundary

The 50-track Stage-1 result is a development-set semantic benchmark. It is not an unbiased estimate of generalization, because Stage-1 development labels informed earlier V4/V5 diagnosis. The two-track terminal holdout remains the only reserved unbiased semantic check and must remain untouched until the development sequence is complete and its own access is explicitly authorized.

The semantic benchmark answers whether proposed `drop` events match the reference Drop labels under the frozen matcher. It does not determine whether a musical moment is useful for TrackCade gameplay.

Therefore:
- a semantic false positive may still be a meaningful gameplay/action point;
- an `ordinary_transition` or `ambiguous` event may still be actionable;
- chorus entrances, re-entries, energy lifts, breakdown endings, peaks, and major section boundaries are not to be discarded merely because they are not semantic Drops;
- gameplay/actionability evaluation must remain a separate layer from semantic Drop correctness.

The intended product pipeline remains:

`music evidence -> meaningful moments -> semantic meaning -> gameplay/action decision`

not:

`music evidence -> Drops -> gameplay`

## Current state at precommit

At the time this contract is added:

- V6 ordinal 1 is the already-frozen canary.
- V6 ordinals 2-50 have not been executed.
- No V6 development reference labels have been opened for V6 scoring.
- No V6 partial score exists.
- No claim is made here that V6 is better, worse, or equivalent to V3 or V5.
- No terminal-holdout access is authorized.
- No provider/API call or paid spend is authorized by this document.
- No compiler or Analyzer execution is authorized by this document.

This file is a reporting precommit only.
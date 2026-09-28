# Trackcade External Semantic Holdout v1 — Drop Evaluation Contract

Status: **FROZEN BEFORE ANY EXTERNAL-CORPUS SOL RESPONSE**

This contract scores only the expert `drop` point annotations from the Socially Significant Music Event dataset. Build and Break labels are not mapped to Trackcade semantic kinds in this benchmark.

## Inputs

1. `REFERENCE_DROPS_V3.json` is the answer key. It is evaluation-only and must never be available to Analyzer, packet/request construction, or provider generation.
2. Candidate input must use schema `trackcade-semantic-external-drop-candidates-v1` and stage `stage1`.
3. Candidate input contains the same 50 frozen Stage 1 track IDs as `SPLIT_V3.json`, with no extras or omissions.
4. Two candidate views are scored independently:
   - `proposalDropsSeconds`: validated Sol proposal events whose semantic kind is exactly `drop`, resolved only to deterministic packet anchors.
   - `acceptedDropsSeconds`: `drop` events accepted by the frozen deterministic semantic compiler. Compiler-ineligible timing tiers remain in the frozen sample and contribute an empty accepted view; they are not replaced.

## Timing windows

The primary tolerance is **±2.0 seconds**.

Predeclared sensitivity windows are **±1.0 seconds** and **±5.0 seconds**.

No tolerance may be changed after observing provider output.

## Matching

For each track and candidate view, sort reference and candidate timestamps ascending.

Within each tolerance window, compute a one-to-one matching that:

1. maximizes matched-pair count;
2. among maximum-cardinality matchings, minimizes total absolute timing error;
3. uses a deterministic lexical tie-break on the ordered matched `(referenceIndex,candidateIndex)` pairs.

A reference or candidate timestamp may participate in at most one pair.

## Metrics

For each track, view, and tolerance report:

- reference count;
- candidate count;
- true positives / matched count;
- false positives;
- false negatives;
- precision;
- recall;
- F1;
- matched timing errors and mean/median/max absolute timing error when matches exist.

Aggregate reporting includes:

- **micro** precision / recall / F1 from summed TP/FP/FN;
- **macro** arithmetic mean of per-track precision / recall / F1 across all 50 frozen tracks, including zero-event tracks using the definitions below;
- reference support;
- candidate support;
- matched support;
- mean/median/max absolute timing error over all matched pairs.

Primary benchmark headline: micro precision / recall / F1 for `proposalDropsSeconds` and `acceptedDropsSeconds` at ±2.0 seconds. The ±1.0 and ±5.0 results are sensitivity analyses, not alternate tuning targets.

## Zero-count metric definitions

For an individual track:

- if reference=0 and candidate=0, precision=1, recall=1, F1=1;
- if reference=0 and candidate>0, precision=0, recall=1, F1=0;
- if reference>0 and candidate=0, precision=1, recall=0, F1=0;
- otherwise use the ordinary definitions.

Aggregate micro precision / recall use summed counts. If the aggregate denominator is zero, use the analogous convention above.

## Claim boundary

Stage 1 scores may be used for development decisions. The terminal 50-track set remains untouched until Stage 1 decisions are frozen.

This evaluator measures agreement with expert Drop annotations. It does not transfer timing authority to the model, and it does not authorize changes to Analyzer v0.19, deterministic anchors, or the frozen compiler merely to improve benchmark scores.

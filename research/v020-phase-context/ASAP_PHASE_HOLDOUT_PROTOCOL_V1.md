# Trackcade Analyzer v0.20 — Independent ASAP/MAESTRO Phase Holdout V1

Status: **pre-registered holdout protocol**. The selection rule and pass/fail criteria in this file are frozen before Analyzer output is inspected for the selected holdout.

## Frozen Analyzer under test

- production baseline: Trackcade Analyzer v0.19
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- shadow selector: `research/v020-phase-context/FROZEN_SELECTOR_V1.json`
- selector freeze commit: `08a6e0cea4463413401e8824e857ba34c825f877`

No production phase switch is authorized by this experiment.

## Independent corpus

- ASAP dataset pinned commit: `afc815c75c42e83a79c03feb6da8a35e77d4c6b8`
- MAESTRO audio/metadata: v2.0.0
- raw audio source ZIP: `https://storage.googleapis.com/magentadata/datasets/maestro/v2.0.0/maestro-v2.0.0.zip`

ASAP documents `performance_beats` as beat positions in seconds. For rows with `start`, ASAP documents that ASAP performance time 0 corresponds to the original MAESTRO performance at that `start` time. Therefore, after cropping the MAESTRO source at `start`, `performance_beats` are the phase reference on the cropped audio timeline.

## Population eligibility — fixed before Analyzer output

A performance is eligible only if all conditions hold:

1. ASAP has a MAESTRO audio mapping.
2. ASAP has an annotation entry for the performance.
3. At least one performance time-signature segment exists.
4. The performance is **not pure three-beat meter**: at least one annotated meter segment has `beats_per_measure != 3`.
5. At least 32 finite annotated `performance_beats` remain on the cropped performance timeline.
6. The MAESTRO audio filename maps exactly to MAESTRO v2 metadata.
7. Crop duration can be determined from ASAP `start`/`end` or MAESTRO source duration.
8. Reference beats outside the cropped performance interval, allowing a 250 ms annotation-edge tolerance, are excluded before the minimum-beat check.

The 100 pure-three-beat performances used by the v0.19 ASAP triple-candidate holdout are explicitly excluded by identity as an additional integrity check, even though rule 4 should already make the populations disjoint.

## Deterministic selection

From the eligible population:

1. compute SHA-256 of the exact `midi_performance` path string;
2. sort by `(sha256, midi_performance)` ascending;
3. walk that ordering and accept at most one performance per unique `maestro_audio_filename`;
4. stop after exactly 100 performances.

If fewer than 100 unique eligible MAESTRO source WAVs exist, fail closed. No Analyzer output participates in selection.

The resulting 100-performance manifest, source filenames, exact reference beat times, crop boundaries, meters, and source hashes become frozen evidence before the Analyzer is run.

## Evaluation

For each frozen performance:

1. range-fetch only its required MAESTRO source WAV from the pinned v2.0.0 ZIP;
2. crop using ASAP `start`/`end` semantics;
3. run exact v0.19 normally;
4. run the exact same v0.19 bits with the Diagnostic V1 debug metadata patch only;
5. require canonical equality after removing only `phaseContextDebug`;
6. for every existing tempo segment, compute selected-grid and exact half-cycle beat F1 against ASAP `performance_beats` at the pre-existing 70 ms tolerance;
7. apply frozen selector V1 exactly, shadow-only, independently per existing segment.

No thresholds may be changed after holdout selection or after any holdout Analyzer output is viewed.

## Pre-registered interpretation

Corpus integrity requires:

- exactly 100 selected performances;
- exactly 100 unique MAESTRO source WAVs;
- 100 performances analyzed;
- zero processing errors;
- zero canonical invariance failures.

Selector outcome:

- **inconclusive** if fewer than 2 segments trigger;
- **reject** if any triggered segment has `half_f1 - selected_f1 <= -0.20`;
- **reject** if the worst triggered delta is below `-0.10`;
- **reject** if trigger mean delta is not positive;
- **safe but not useful** if safety conditions pass but no triggered segment has delta `>= +0.20`;
- **holdout pass** only if there are at least 2 triggers, zero large-hurt triggers, worst triggered delta `>= -0.10`, positive mean triggered delta, and at least one large-help trigger `>= +0.20`.

A holdout pass is evidence to proceed to broad shadow regression and implementation testing. It does **not** by itself authorize production phase switching.

## Non-negotiable guardrails

- Do not alter `release/analyzer-v0.19`.
- Do not retune `FROZEN_SELECTOR_V1.json` from this holdout.
- Do not add track IDs, composers, titles, genres, meters, or annotation labels as selector inputs.
- Do not alter BPM, tempo-segment boundaries, timing confidence, timing tier, or interaction beats during this shadow test.
- If the selector fails, record the rejection and design a genuinely new hypothesis; do not patch individual holdout tracks.

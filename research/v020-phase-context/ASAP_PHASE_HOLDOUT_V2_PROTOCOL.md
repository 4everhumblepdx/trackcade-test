# Trackcade Analyzer v0.20 — Independent ASAP/MAESTRO Phase Holdout V2

Status: **pre-registered terminal holdout protocol** for `FROZEN_SELECTOR_V2.json`. The selector, selection rule, pass/fail criteria, and terminal decision rule in this file are frozen before Analyzer-derived output from the V2 holdout is inspected.

## Frozen Analyzer and selector

- production baseline: Trackcade Analyzer v0.19
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- shadow selector: `research/v020-phase-context/FROZEN_SELECTOR_V2.json`
- selector freeze commit: `ae88e5087d4a8e6d85970a38f54cca0873b300f1`

No production phase switch is authorized by this experiment.

## Why this is a new holdout

The selector-v1 ASAP holdout is burned and cannot validate selector v2. V2 must therefore use a second deterministic set of 100 ASAP/MAESTRO performances whose MIDI performance identities **and MAESTRO source WAVs are disjoint from the V1 holdout**.

The V1 selection is reproduced deterministically from the pinned corpus and must hash exactly to the frozen V1 selected-manifest SHA-256 `c5d0da75f6fecb97e9fd7eb45ea3cc4db3b900c68737d5f4eab3ea97e3b47bff`. If that reproduction fails, selection fails closed.

## Corpus pins and eligibility

Use the same corpus pins and eligibility semantics as V1:

- ASAP commit: `afc815c75c42e83a79c03feb6da8a35e77d4c6b8`
- MAESTRO audio/metadata: v2.0.0
- exclude the prior v0.19 pure-three holdout population by identity
- require MAESTRO audio mapping and exact metadata mapping
- require at least one annotated meter segment
- exclude pure-three-beat performances
- require at least 32 finite cropped `performance_beats`
- use the same 250 ms annotation-edge tolerance and ASAP crop semantics

## Deterministic V2 selection

1. Build the exact eligible population using the V1 rules.
2. Sort by `(sha256(midi_performance), midi_performance)` ascending.
3. Reproduce the first 100 unique-source V1 selections exactly and verify the frozen selected-manifest hash.
4. Continue through the same frozen ordering.
5. Reject any performance whose `midi_performance` or `maestro_audio_filename` belongs to V1.
6. Accept at most one performance per unique MAESTRO source WAV.
7. Stop after exactly 100 additional performances.

If fewer than 100 disjoint unique-source eligible performances exist, fail closed. Analyzer output must not participate in V2 selection.

## Evaluation

For each frozen V2 performance:

1. range-fetch only the required MAESTRO source WAV from the pinned v2.0.0 ZIP;
2. crop with frozen ASAP semantics;
3. run exact v0.19 normally;
4. run the exact same bits with Diagnostic V1 debug metadata only;
5. require canonical equality after removing only `phaseContextDebug`;
6. evaluate selected-grid and exact half-cycle F1 at 70 ms for every existing tempo segment;
7. apply `FROZEN_SELECTOR_V2.json` exactly, shadow-only.

Selector V2 triggers only when all frozen conditions hold:

- `delta_g2_periodicity <= -0.18`
- `delta_g3_periodicity >= +0.12`
- at least four complete g2/g3 long-context windows on both selected and half-cycle grids
- at least 32 beats on both grids

No threshold may be changed after V2 holdout selection or after any V2 Analyzer output is inspected.

## Pre-registered integrity requirements

- exactly 100 V2 selected performances
- exactly 100 V2 unique MAESTRO source WAVs
- zero V1 MIDI-performance overlap
- zero V1 MAESTRO-source overlap
- 100 performances analyzed
- zero processing errors
- zero canonical invariance failures

## Pre-registered selector interpretation

- **inconclusive** if fewer than 2 segments trigger;
- **reject** if any triggered segment has `half_f1 - selected_f1 <= -0.20`;
- **reject** if the worst triggered delta is below `-0.10`;
- **reject** if mean triggered delta is not positive;
- **safe but not useful** if safety conditions pass but no triggered segment reaches `+0.20`;
- **holdout pass** only with at least 2 triggers, zero large hurts, worst delta `>= -0.10`, positive mean delta, and at least one large help `>= +0.20`.

A pass would authorize broad shadow-regression and implementation testing only. It would still not by itself authorize a production switch.

## Terminal decision rule

This is the final bounded deterministic phase-selector holdout for v0.20 research.

- If V2 is rejected: stop automatic deterministic phase switching for v0.20.
- If V2 is inconclusive: stop automatic deterministic phase switching for v0.20 rather than creating V2.1 or repeatedly drawing holdouts.
- If V2 is safe but not useful: stop automatic deterministic phase switching for v0.20.
- Do not retune V2 from this holdout.
- Do not remove failed tracks, add track/composer/genre/meter exceptions, or alter confidence tiers.

If the terminal gate does not pass, v0.19 remains the production Analyzer baseline and phase ambiguity remains confidence-aware for later higher-level/learned treatment if needed.

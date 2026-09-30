# TrackCade semantic classification vs gameplay action principle

Status: product/research interpretation note only. This document does not modify the frozen Stage 1 V6 semantic experiment, scoring protocol, Analyzer, compiler, provider contract, or holdout boundaries.

## Core distinction

TrackCade must keep two questions separate:

1. **Semantic classification:** What musical event is this?
2. **Gameplay/action mapping:** Is this musically meaningful moment useful as a player touch/action point, and if so, what interaction should it drive?

A candidate that is not semantically a `drop` is **not automatically a bad TrackCade event**.

For Stage 1 Drop benchmarking, terms such as `false positive` mean false positive **relative to the frozen Drop reference labels**. They do not mean that the detected moment is musically useless or unsuitable for gameplay.

Examples of potentially actionable non-Drop moments include:

- chorus or major-section entrances;
- strong re-entries after reduced passages;
- energy lifts;
- breakdown endings;
- major section boundaries;
- peaks or crests;
- other musically salient transitions.

Likewise, a correctly classified semantic event does not automatically require a gameplay action. Gameplay usefulness is a later, separate decision.

## Architectural direction

The intended conceptual flow is:

`music evidence -> meaningful moments -> semantic meaning -> gameplay/action decision`

not:

`music evidence -> Drops -> gameplay`

The current Drop benchmark is therefore a semantic research task used to improve TrackCade's ability to distinguish musical-event types. It is not the definition of the finished product's interaction vocabulary.

## Consequence for V5/V6 interpretation

V6's stricter Drop definition is intended to improve semantic precision by separating decisive Drops from ordinary returns, re-entries, section changes, and other transitions. Those rejected-as-Drop candidates should not be discarded merely because they fail the Drop definition. Their possible value as interaction points remains available for later gameplay/action mapping research.

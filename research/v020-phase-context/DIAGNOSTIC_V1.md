# Trackcade Analyzer v0.20 — Phase Context Diagnostic V1

Status: **diagnostic only**. This definition does not authorize an automatic phase switch, confidence change, timing-tier change, interaction-beat change, or production Analyzer modification.

Frozen baseline under study:
- v0.19 source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- v0.19 runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

## Compared grids

For each existing tempo segment at BPM `b` with selected beat phase `p`, compare:
- selected grid: `p`
- exact half-cycle grid: `p + 0.5 * (60 / b)`

No other phase alternative participates in Diagnostic V1.

## Beat salience

At each grid time, use the existing v0.19 `locateBeatOnset` function and define beat salience as:

`strength = sqrt(max(0, located_onset_strength))`

Beat confidence is the existing local evidence combination:

`0.5 * sqrt(max(0, strength_raw)) + 0.5 * proximity`

clamped to `[0, 1]`.

For each grid record:
- beat count
- mean beat strength
- median beat strength
- mean beat confidence

## Selected-vs-half asymmetry

For two salience sequences A and B:

`contrast(A,B) = (mean(A) - mean(B)) / max(0.08, mean(A) + mean(B))`

Record this contrast for:
- the Analyzer's combined beat-onset locator
- low-frequency pulse layer
- transient layer

The low/transient contrasts are secondary descriptors only and may not independently authorize a future selector.

## Repeated bar-scale organization

Evaluate group lengths `g ∈ {2,3,4}` over each grid's beat-strength sequence.

For each possible anchor phase `q ∈ [0, g-1]`:
- anchors are positions `(i - q) mod g == 0`
- other positions are all remaining beats
- `anchor_contrast = contrast(anchors, others)`
- `anchor_consistency = clamp(1 - std(anchors) / max(0.12, mean(anchors)), 0, 1)`
- `periodicity = existing patternCorrelation(beat_strengths, g)`
- descriptive score = `0.55 * anchor_contrast + 0.30 * periodicity + 0.15 * anchor_consistency`

Diagnostic V1 reports the anchor phase with the largest descriptive score. This score is **not a selector score** and has no production threshold.

## Multi-window stability

Using the best descriptive anchor phase for each group length:
- window size = `max(4*g, 16)` beats
- stride = `max(2*g, 8)` beats
- compute anchor contrast in each complete window

Record:
- number of windows
- mean window contrast
- standard deviation of window contrast
- fraction of windows with positive contrast
- minimum window contrast

If no complete window exists but at least `4*g` beats exist, report one whole-sequence contrast window. If fewer than `4*g` beats exist, group evidence is unavailable/zeroed.

## Development labels

Ballroom is discovery data only. Human beat annotations may be used after descriptor extraction to label whether the exact half-cycle candidate would be a large help or large hurt at the pre-existing 70 ms matching tolerance:
- large help: `half_cycle_F1 - selected_F1 >= 0.20`
- large hurt: `half_cycle_F1 - selected_F1 <= -0.20`

These labels are never inputs to the Analyzer or descriptor computation.

## Guardrails

- With `TRACKCADE_PHASE_CONTEXT_DEBUG` unset, patched-runner analysis must be identical to the exact v0.19 analysis.
- With debug enabled, removing only `phaseContextDebug` must recover the exact v0.19 result.
- Diagnostic V1 applies no phase switch and no confidence/tier modification.
- No track IDs, genres, annotation labels, or benchmark-specific exceptions may become Analyzer features.
- The killed v0.19 phase predicates are not inputs to this diagnostic.
- A future selector may be designed only after this descriptor family is evaluated as a discovery experiment; any selector must then be frozen before an independent holdout is opened.

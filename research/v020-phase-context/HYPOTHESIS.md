# Trackcade Analyzer v0.20 research — longer-context phase evidence

## Status
Research only. **No production Analyzer change is authorized by this file.**

Frozen release baseline:
- v0.19 final source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- v0.19 runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- frozen v0.18 core SHA-256: `baf6c3701f9b3ccbe67237b04dcca2e9a158f180ceabb6e1c3e9f0b1a8594c15`

## Motivation
The prior v0.19 phase-selection experiments showed that half-cycle alternatives can rescue a small number of severe phase failures, but simple global/window statistics also produce catastrophic false switches. Those rules are rejected and must not be resurrected or retuned.

The new hypothesis is qualitatively different:

> Correct beat phase should exhibit stronger **long-context metrical organization** than its half-cycle alternative when salience is evaluated over repeated bar-scale positions, not merely local wins or global onset strength.

The signal should come from recurring accent structure across many beats/bars rather than a blanket preference for one onset layer or a fixed half-cycle rule.

## Scope of the first experiment
Diagnostic only. Do not change canonical BPM, confidence, timing tier, interaction beats, or selected phase.

For each existing phase candidate, compute a compact long-context evidence vector using the already-decoded audio/onset data where practical:
1. beat-position salience sequence over a minimum long window;
2. alternating-position asymmetry (candidate beat vs half-cycle positions);
3. periodic accent consistency at plausible bar lengths (2, 3, 4 beats where supported);
4. stability of that contrast across multiple windows rather than one global mean;
5. optional low-frequency/transient emphasis contrast only as a secondary descriptor, never a standalone switch rule.

The first artifact must expose descriptors and oracle relationships only. **No automatic phase switch may be implemented in the first experiment.**

## Pre-registered safety rules
- Do not modify or move `release/analyzer-v0.19`.
- Do not alter the v0.19 runner while gathering diagnostics.
- Do not reuse the killed v0.19 predicates as candidate rules.
- Do not choose thresholds after inspecting a held-out corpus and then claim that corpus as validation.
- Ballroom/Candombe may be used for discovery because they have already been inspected extensively.
- Promotion requires a frozen rule/hypothesis before a genuinely independent real-audio evaluation.
- Any candidate phase selector must fail closed to the existing selected phase unless evidence is strong.
- Any selector with a catastrophic phase regression on a previously strong track is rejected, not patched track-by-track.
- Timing confidence tiers retain their gameplay meaning and may not be tuned to annotation labels.

## Success criteria for diagnostic stage
A useful descriptor family should separate at least some large-help half-cycle cases from large-hurt cases without relying on track identity, genre labels, annotation BPM labels, or post-hoc exception lists.

Before an automatic rule is tested on unseen data, the descriptor definition, aggregation method, thresholding logic, and fallback behavior must be frozen in-repo.

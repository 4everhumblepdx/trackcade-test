# Trackcade Analyzer v0.20 — Phase Context Research Conclusion

Status: **closed — no production phase switch promoted**

## Production decision

Trackcade Analyzer **v0.19 remains the production baseline**.

No v0.20 automatic deterministic half-cycle phase selector is promoted. The research branch remains evidence/history only unless a separate future project explicitly reopens phase ambiguity with a genuinely different approach.

Released baseline remains:

- release branch: `release/analyzer-v0.19`
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

## What v0.20 research established

The phase problem is real but highly asymmetric: rare half-cycle rescues exist inside a much larger population where the existing selected phase is preferable. Conservative deterministic switching therefore has to demonstrate both meaningful usefulness and very high specificity.

Selector V1 failed its independent preregistered ASAP/MAESTRO holdout. Its 100-performance corpus completed with zero processing errors and zero canonical-invariance failures, but the selector produced a catastrophic triggered regression and a negative mean triggered delta. V1 is rejected and must not be retuned from that holdout.

Selector V2 was a genuinely different long-context hypothesis based on directional g2/g3 periodicity reorganization plus minimum repeated-window and beat-count evidence. It was frozen before a second 100-performance holdout that was disjoint from V1 by both MIDI identity and MAESTRO source.

The original V2 run encountered one research-harness timeout on `Liszt/Sonata/Yeletskiy05M.mid`. This was classified as infrastructure/runtime failure rather than algorithm evidence. A timeout-only recovery reran the exact frozen experiment with a larger subprocess timeout; selector thresholds, corpus membership, v0.19 bits, diagnostic semantics, and pass/fail criteria were unchanged.

The completed V2 terminal holdout produced:

- 100 selected performances
- 100 analyzed performances
- 100 unique MAESTRO sources
- 0 V1 MIDI overlap
- 0 V1 MAESTRO-source overlap
- 999 evaluated tempo segments
- 0 processing errors
- 0 canonical-invariance failures
- 6 raw cross-periodicity matches
- 0 complete selector triggers

Because the preregistered protocol defines fewer than two triggers as inconclusive, V2 is **inconclusive**, not a pass and not a scientific rejection by regression.

The terminal rule was frozen in advance: on rejection, inconclusive result, or safe-but-not-useful result, stop automatic deterministic phase switching for v0.20 rather than drawing more holdouts or creating V2.1.

Therefore the terminal decision is:

> **Stop deterministic phase-selector research for v0.20 and keep v0.19.**

## Safety observation

The V2 long-context gate was materially protective. The independent V2 holdout contained six segments that matched the raw directional periodicity pair, but all failed the frozen repeated-window/length requirements. The worst raw-pair phase change would have produced `half_f1 - selected_f1 = -0.4`.

The already-open V1 corpus showed the same pattern more strongly: raw periodicity matching without the long-context gate included much larger negative examples. This is evidence against loosening the gate after seeing the holdout, not an invitation to retune it.

## Guardrails going forward

Do not:

- create selector V2.1 by moving these thresholds;
- loosen the repeated-window or beat-count gate;
- exclude inconvenient holdout tracks;
- add composer, title, genre, meter, or track-specific exceptions;
- alter confidence tiers to make phase results look better;
- modify or reinterpret released v0.19 because this research did not pass;
- hold the rest of Trackcade development hostage to this rare ambiguity problem.

If phase ambiguity is revisited later, treat it as a separate project. A higher-level learned musical-understanding layer may eventually reason about phase/downbeat ambiguity while the deterministic Analyzer continues to expose confidence-aware timing evidence.

## Product direction

The low-level timing engine is sufficiently strong to move on.

The next Trackcade work should build upward from v0.19 rather than continue automatic phase-selector tuning:

1. musical structure / section understanding;
2. gameplay event generation from the trustworthy timing map;
3. difficulty generation;
4. visual/world generation;
5. optional AI musical interpretation and personalization;
6. end-to-end QC using the Analyzer confidence/timing semantics.

The architectural rule remains:

**Audio DSP → trustworthy timing map → optional AI musical-understanding layer → gameplay generation.**

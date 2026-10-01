# Musical meaning and gameplay actionability

Standing product rule: semantic classification describes the musical event. A separate gameplay decision determines whether and how a player interacts with it. `ordinary_transition` and `ambiguous` are semantic outcomes, not automatic instructions to delete a moment.

The V6 RAW Drop experiment remains unchanged. Its Drop-only scoring must not be presented as a gameplay-event quality score. Chorus entrances, re-entries, energy lifts, section boundaries, peaks and breakdown endings may remain meaningful even when the V6 Drop conditions do not apply.

After the research freeze and evaluation, a future actionability layer should consume retained musical events and candidate assessments, preserve the original semantic role, and record a separate interaction decision and reason. An event retained for review need not generate an interaction. No `semanticRole != drop` filter may serve as the sole discard rule. Preserve Analyzer-owned timing; do not move timestamps to improve results.

Free design acceptance examples:

| Musical moment | Semantic result | Separate gameplay question |
|---|---|---|
| Ordinary chorus entrance | ordinary_transition | Does this entrance merit a new interaction or pattern? |
| Energy lift or section return | non-Drop event or ordinary_transition | Is its contrast meaningful enough for the player? |
| Uncertain re-entry | ambiguous | Retain evidence and uncertainty for a separate decision. |
| Qualifying decisive impact | drop | Choose interaction type and intensity separately. |
| Breakdown ending or peak | May be non-Drop | Evaluate the musical moment without forcing a Drop label. |

These are design questions, not frozen actionability labels, scoring rules, new thresholds or production mappings. No actionability execution, label access, compiler invocation, paid generation or semantic tuning is authorized by this note. The reconciliation tests demonstrate that the collector retains a non-Drop energy event alongside a Drop in a synthetic response; actual response collections must retain all normalized proposal content.

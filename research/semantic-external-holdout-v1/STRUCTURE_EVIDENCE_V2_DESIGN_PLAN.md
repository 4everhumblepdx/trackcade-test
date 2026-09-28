# Pre-evaluation design decision

Starting GitHub commit: ca438c1ca0e223d7c3933cf3f65203d92c000435.

The prior interaction coverage audit is frozen and will not be rerun. Its saved result is the comparison baseline.

Preferred policy before this experiment: current plus all core/accent candidates, losslessly projected into a column table, with exact-time alias merging. Preserve all existing non-anchor context. Preserve boundary and landmark context records, replacing their time with a unified anchor index. Do not prune by labels, distance, salience, confidence, section, or song. Do not quantize, average, snap, or shift timestamps. Preserve the original candidate source index for every selected record in a separately hashed source map.

Policies to compare: current+core table; current+core+accent object rows; current+core+accent table; current+all table. All retain current anchors/context. The object/table pair isolates serialization rather than changing timing coverage. Core-only measures the information/cost tradeoff; all measures the cost of including optional priorities. The existing Analyzer priority vocabulary is the rationale for preferring core+accent, not maximizing Stage 1 recall. Do not add adaptive policies after inspecting scores.

Tables use one shared column legend, source and priority enums, and implicit row-index anchor IDs. Exposed features: exact time, priority, deterministic source type, salience and confidence. Retain strict-timing and window fields in the immutable source only; this evidence is not gameplay timing authorization. Where multiple records have exactly equal times, all original indices are preserved. Choose the displayed interaction record by priority core, accent, optional, then lowest original source index. Boundary/landmark-only rows have null interaction features.

Acceptance: exact source linkage for every anchor and alias; exact reconstruction of original packet context; unchanged fixed matcher/windows; same unique timing set as the chosen current+core+accent union; fewer bytes than full-record union; repeated exports byte-identical; tamper rejection; no provider payload, compiler change, audio processing, terminal-track processing or V3 run.

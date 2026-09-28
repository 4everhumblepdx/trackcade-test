# Structure Evidence v2 — frozen compact format

Status: offline evidence prototype frozen before any V3 provider run. The existing Analyzer, exporter v1, request builders, provider workflows and compiler are unchanged. This artifact is not an accepted input to the existing compiler.

## Decision and rationale

Predeclared current+core+accent exact union. Retain current context and both intended interaction priorities without label-based pruning; table versus objects is lossless encoding. Optional candidates are not added solely for the last Stage 1 match.

The design plan was written before scoring these policies. Existing Stage 1 coverage was already known, so this is label-aware development, not a blind evaluation. No reference label enters the exporter. There is no per-track cap, proximity threshold, confidence cutoff, time quantization, or label-dependent selection. No terminal data is evaluated.

## Measured comparison

| Policy | ±1s | ±2s | ±5s | Mean anchors/song | Mean bytes/song | Estimated tokens/song |
|---|---:|---:|---:|---:|---:|---:|
| current-core-table-v2 | 29/46 | 39/46 | 46/46 | 121.64 | 21907.70 | 5477.34 |
| current-core-accent-objects-v2 | 41/46 | 45/46 | 46/46 | 274.28 | 42281.10 | 10570.66 |
| current-core-accent-table-v2 | 41/46 | 45/46 | 46/46 | 274.28 | 26094.58 | 6524.02 |
| current-all-table-v2 | 45/46 | 46/46 | 46/46 | 449.14 | 30865.58 | 7716.82 |

Chosen format: 53.45% fewer bytes than the prior 56,061.66-byte full-record union estimate. Current packets average 18,042.84 bytes; v2 averages 26094.58 bytes. Bytes/4 estimates are not tokenizer measurements or actual billed usage. Evidence costs include metadata, legends, hashes and context. The separate source map averages 4478.22 bytes and is excluded from prospective model input; total stored sizes are reported separately.

The chosen union has 13714 unique anchors and removes 420 duplicate raw records: 277 duplicates among current anchors plus 143 exact overlaps between interaction candidates and current times. There are 0 within-interaction duplicates in this frozen set. Distinct nearby times remain distinct. Current-only context is deliberately preserved, explaining the 274.28 union anchors versus 254.64 interaction-only anchors per song.

## Normative format

A packet is canonical UTF-8 JSON, sorted object keys, no insignificant whitespace, no trailing newline, ensure_ascii=False and allow_nan=False. Array order is significant. SHA-256 hashes are over those exact bytes. The packet schema and source-map schema are Draft 7 JSON Schemas; the source-backed validator is additionally mandatory.

`anchors` is a time-sorted table. Its zero-based row number is the sole new anchor identifier. Columns are `[time, priorityCode, sourceCode, salience, confidence]`. Time is copied from the source without numerical transformation. Priority codes are 0=core, 1=accent, 2=optional; the selected policy never emits code 2. Source codes are 0=beat, 1=onset, 2=downbeat, 3=transition. Current-only anchors have null in all four feature columns. The legends appear once in each packet.

Exact numeric timestamp equality merges aliases. If multiple selected interaction records share a time, display the record with the highest existing priority (core before accent), breaking ties by original interactionCandidates index. Never average times or features. All aliases survive in the source map, even when one representative supplies displayed features.

`context` preserves v1 timingTrust, structureTrust, energy, sections and lowDemandWindows exactly. It also preserves every boundary and landmark record in its original order, replacing only its `time` field with `anchor`, the unified row index. These context rows are not extra selectable anchors. Replacing anchor with its table time reconstructs the original packet context exactly. Redundant contextual records are retained to avoid changing the available semantic evidence at the same time as the anchor vocabulary.

`source` retains every original packet source field and adds the SHA-256 of the original interpretation packet and structure evidence. It includes the full analysis JSON hash, frozen Analyzer commit and runner hash. `sourceMapSha256` binds the separate canonical source map.

The source map has one `aliases` row per anchor, with `[boundaryIndices, landmarkIndices, interactionCandidateIndices]`. All indices are zero-based. The first two point into the exact hashed v1 interpretation packet; the third points into the exact hashed analysis-v019.json. Every exposed anchor has at least one source reference, every selected source record has exactly one alias, and every referenced timestamp equals its anchor time. Strict-timing/window fields remain recoverable from those immutable originals; their omission from the compact view does not authorize any compiler or scoring change.

The provider-facing evidence and local source map are separate: do not append the source map to a future model prompt merely to obtain provenance. The map is retained for deterministic resolution and audit. No future consumer may trust a packet without verifying its hash, map, input hashes, schema and source-backed reconstruction.

## Validation and limits

All four policies have per-track scoring at fixed ±1/±2/±5 windows through the unchanged frozen matcher. No new interaction coverage audit was run: the prior committed result was consumed as a hash-checked baseline. The chosen policy reproduces the frozen union aggregates, including timing errors. All 50 chosen packets/source maps are included in the bundle with per-file hashes.

The exporter validates by rebuilding the expected packet from immutable input bytes and comparing every field. It additionally resolves every alias and reconstructs original context. Tests reject altered times, aliases, context, source bytes and unknown policies; test exact duplicate alias preservation and retention of distinct nearby times; and check object/table equivalence and all 50 bundled packets. Two independent evaluation executions produced identical result and archive bytes.

JSON Schema checks shape; source-backed validation enforces ordering, index bounds, completeness, exact context and source agreement. Raw source-record type/priority distributions and post-merge displayed-anchor distributions are both reported, avoiding ambiguity at merged rows. Counts include all 50 songs; 27 contain the 46 reference Drops.

This is representability, not semantic detection performance. Reducing bytes does not prove equal model comprehension. The current compiler only understands its existing anchor vocabulary; integration, provider prompt/output contracts, and a V3 experiment remain uncreated. Stop here.

## Reproduction

Use the exact Stage 1 base and V2 prep archives recorded in the preceding freeze. Keep both ZIPs and extract them to base-prep and v2-prep. Keep the unchanged matcher and baseline scoring helper in this research directory alongside the new scripts. Use Python 3.10+ standard library only.

```text
python evaluate_structure_evidence_v2.py --base-root base-prep --v2-root v2-prep --base-zip stage1-base-prep.zip --v2-zip stage1-v2-prep.zip --references REFERENCE_DROPS_V3.json --prior-result STAGE1_INTERACTION_COVERAGE_V1.json --output-dir reproduced-v2
python test_structure_evidence_v2.py --base-root base-prep --v2-root v2-prep --bundle reproduced-v2/STAGE1_STRUCTURE_EVIDENCE_V2_PACKETS.zip
```

Compare result and individual packet/source-map hashes with the freeze and bundle manifest. ZIP metadata is fixed; compressed archive bytes can depend on Python/zlib, so individual content hashes are the portable authority. Input archive identities and hashes are checked before scoring. Only Stage 1 reference rows are selected from the existing shared reference container. The archive includes no audio or terminal packets.

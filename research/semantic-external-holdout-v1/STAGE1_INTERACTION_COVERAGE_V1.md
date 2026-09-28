# Stage 1 interaction-candidate anchor coverage

The provisional core+accent result reproduces: 45/46 expert Drops are representable within +/-2 seconds (97.83%), versus 28/46 (60.87%) with current anchors. This is a recall ceiling, not semantic model performance. No family was tuned or selected from these results.

| Family | +/-1s | +/-2s | +/-5s | Mean unique anchors/song | Mean compact packet bytes | Estimated token delta/song |
|---|---:|---:|---:|---:|---:|---:|
| beatGrid all | 46/46 | 46/46 | 46/46 | 487.56 | 114876.00 | +24208.34 |
| current | 19/46 | 28/46 | 41/46 | 22.50 | 18042.84 | +0.00 |
| current+core | 29/46 | 39/46 | 46/46 | 121.64 | 33053.40 | +3752.62 |
| current+core+accent | 41/46 | 45/46 | 46/46 | 274.28 | 56061.66 | +9504.66 |
| interaction all | 45/46 | 46/46 | 46/46 | 429.98 | 74837.60 | +14198.66 |
| interaction core | 28/46 | 37/46 | 46/46 | 101.10 | 25084.10 | +1760.26 |
| interaction core+accent | 41/46 | 45/46 | 46/46 | 254.64 | 48092.36 | +7512.32 |

All 50 development tracks are included in cost statistics; 27 tracks contain the 46 reference Drops. Full beatGrid is a descriptive density upper bound only.

## Counts and duplicate accounting

The JSON report includes every track, all matched pairs at each fixed window, raw records, unique times, within-family duplicates, exact overlaps with current anchors, new times, type/priority distributions, and count/footprint totals, means, medians and ranges. Times are deduplicated using the original coverage script's round(time, 9) rule; no new proximity filter is introduced.

| Family | Raw records total | Unique times total | Duplicate records | Extra records at current times | New extra times |
|---|---:|---:|---:|---:|---:|
| beatGrid all | 24378 | 24378 | 0 | 1125 | 23253 |
| current | 1402 | 1125 | 277 | 0 | 0 |
| current+core | 6457 | 6082 | 375 | 98 | 4957 |
| current+core+accent | 14134 | 13714 | 420 | 143 | 12589 |
| interaction all | 21499 | 21499 | 0 | 167 | 21332 |
| interaction core | 5055 | 5055 | 0 | 98 | 4957 |
| interaction core+accent | 12732 | 12732 | 0 | 143 | 12589 |

## Footprint definition

Descriptive compact sorted UTF-8 JSON: retain other packet fields; remove boundaries/landmarks for interaction-only and beatGrid; append full source records as auditCandidateRecords. Unions retain current fields. No schema or provider request is changed.

Tokens are estimated as ceil(compact UTF-8 bytes / 4), not counted with a model tokenizer. Deltas use the same serialization on both sides. These full-record envelopes are descriptive cost probes, not valid provider payloads, a final evidence design, or actual API billing. Actual curated encoding may cost less. Original packet file sizes are also retained in the report.

## Provenance and reproduction

Starting branch HEAD: `7e63c00df981b116b502ba0ddfcf11af8a62bc2e`. The GitHub tree was checked for prior interaction coverage work; no such script/result existed. Both archive byte hashes, both prep manifests, the reference container, all 50 analysis JSON hashes, evidence hashes and packet hashes are verified before scoring. Base and V2 Stage 1 identities are cross-checked. Only the Stage 1 field of the existing shared reference container is selected; terminal rows are never scored or inspected. No audio, Analyzer execution, Sol calls, exporter edits or terminal-track processing occurs.

Download the two exact artifact IDs listed in STAGE1_INTERACTION_COVERAGE_FREEZE_V1.json, retaining the ZIPs; extract them to base-prep and v2-prep. Run from this repository directory using Python 3.10+ (standard library only):

```text
python analyze_stage1_interaction_coverage_v1.py --base-root base-prep --v2-root v2-prep --base-zip stage1-base-prep.zip --v2-zip stage1-v2-prep.zip --references REFERENCE_DROPS_V3.json --output reproduced.json
```

The original matcher and baseline helper must remain alongside the script. Their exact Git blob identities are enforced. Compare the resulting SHA-256 with the freeze file. The full result also records all 50 input identities. Validation: two independent executions produced byte-identical results; the prior [19, 28, 41] baseline reproduced; all 350 track/family rows were checked for one-to-one matches, tolerance bounds and distribution totals; a tampered reference file was rejected.

The result and script are committed directly, rather than relying on a new workflow artifact. Source archives have GitHub retention limits; retain the exact downloaded archives for later reproduction. Structure Evidence v2 and further semantic generation remain separate future work.

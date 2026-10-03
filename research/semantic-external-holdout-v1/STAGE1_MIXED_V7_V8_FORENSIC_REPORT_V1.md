# Frozen Stage1 RAW development forensics â€” 2026-10-03

The dominant observed problem is Drop selection relative to the Stage1 definition, rather than a small timestamp offset. The evidence does **not** establish a reliable energy, chorus, repetition, confidence, or quiet-break separator. It suggests that the existing impact requirement is being asserted more readily than the available packet evidence can independently substantiate. This last statement is a working hypothesis, not a proven acoustic diagnosis or validation on unseen music.

Starting HEAD: `284c723148f72c3f5b05fed73660231b22012d14`. Tables were frozen first at `66043b858e13eb3706d24f77d26baf7afb0b14d5` (local metadata commit `fe13853b83a6cebf3272c9d6e684c5e3213f2814`, identical Git tree). Hypotheses below were written only after that freeze.

## Evidence and methods

This analysis consumes the existing manifest, 50 cached packet/proposal pairs, and the frozen primary result. All 100 packet/proposal byte hashes match the prediction manifest. Every Drop time equals the corresponding frozen result time. Outcomes are copied from the frozen two-second match indices: no matcher, scorer, validator, provider, Analyzer, or compiler was executed. The primary result, scoring contract, predictions and all previous receipts remain unchanged.

The event table contains 81 rows; the FN table contains 25; the track table contains 50. The feature summary covers every one of the 79 scalar pre-label features extracted, across TP (21), all FP (60), zero-reference FP (30), and positive-reference-track FP more than five seconds from every reference (28). Numeric fields have available/missing counts, median, quartiles, IQR and range; categorical fields have counts and proportions with both denominators. Raw names, rationales, assessments, track summaries and selected structural context are retained in the rows. Free text, identities and anchor indices are not converted into fitted categories.

Packet boundary/landmark measurements retain their original anchor and the distance to the queried event. They are not silently attributed to a different timestamp. Sections are structural intervals, not inferred chorus labels. Curve interpolation is deterministic interpolation of already-frozen samples, not fresh audio analysis. Most recent low-demand windows retain their gap to the event; an old window is not assumed to prepare a later event. The FN context is explicitly reference-conditioned diagnostic data, not a deployable feature. Only outcomes and nearest-reference distance enter the predicted-event table as label-dependent values; error-group membership is an outcome grouping and never a model feature.

No trained classifier, significance test, exhaustive threshold search, counterfactual F1, filtering, relabeling or proposal repair was performed. Events are clustered within tracks; apparent descriptive differences are not independent observations or validated decision rules. V7/V8 provenance and the original scientific recommendation A are preserved.

## Selection versus timing

Frozen headline: 46 references, 81 predictions, TP 21, FP 60, FN 25; precision 25.93%, recall 45.65%, micro F1 33.07%. Increasing the tolerance from two to five seconds adds only two matches: TP 23, FP 58, FN 23, F1 36.22%. Matched two-second timing MAE is 0.719 seconds. Thirty FPs occur where the track has no reference Drop; another 28 are more than five seconds from every reference. These 58/60 FPs cannot be repaired by widening this window to five seconds. This establishes a larger event-selection/definition problem without proving every musical transition is meaningless or every reference is acoustically unambiguous.

## What the frozen features distinguish

Selected summaries below are **median [Q1, Q3]**. Complete 79-feature results, ranges and missingness are in `STAGE1_MIXED_V7_V8_FORENSIC_FEATURE_SUMMARIES_V1.json`.

| Pre-label feature | TP n=21 | All FP n=60 | Zero-reference FP n=30 | >5s FP n=28 |
|---|---:|---:|---:|---:|
| Event semantic confidence | .880 [.820,.900] | .820 [.788,.873] | .830 [.793,.880] | .820 [.770,.843] |
| Nearest-boundary incoming section energy | .871 [.797,.895] | .802 [.689,.873] | .794 [.647,.861] | .802 [.700,.873] |
| Nearest-boundary section energy jump | .360 [.281,.435] | .355 [.211,.468] | .374 [.258,.461] | .314 [.190,.437] |
| Nearest-boundary local energy after | .898 [.802,.943] | .839 [.636,.894] | .837 [.643,.895] | .838 [.632,.861] |
| Nearest-boundary local net energy change | .370 [.331,.460] | .358 [.274,.470] | .413 [.290,.524] | .337 [.258,.400] |
| Curve energy at proposal time | .830 [.783,.922] | .771 [.627,.831] | .766 [.631,.824] | .752 [.582,.824] |
| Previous structural section duration (seconds) | 21.56 [9.43,46.29] | 23.57 [14.07,33.85] | 23.57 [11.25,28.86] | 19.49 [14.80,34.49] |
| Previous structural section energy | .530 [.459,.633] | .423 [.298,.571] | .356 [.185,.526] | .500 [.376,.600] |
| Track semantic event count, event-weighted | 9 [8,12] | 12 [9,13] | 12 [9,14.75] | 11 [9,13] |

Previous-section values are available for 21/21 TP, 59/60 FP, 29/30 zero-reference FP and 28/28 >5s FP. Other displayed fields are complete. Nearest-boundary distance can be as large as 9.765 seconds for a TP and 4.115 seconds for an FP, so these boundary values cannot all be interpreted as impact measurements at the proposal itself. Frozen local windows also vary (approximately 1.6â€“3.8 seconds); a before/at/after increase across that interval is not independent evidence of a concentrated acoustic onset.

TPs tend to have higher absolute arrival/post-transition energy and model confidence, but distributions overlap substantially. FP confidence extends to .94, above the TP maximum .93. Available Analyzer salience is slightly **higher** for FPs (.933 vs .920 median), with 8 TP and 23 FP values unavailable. That supports keeping Analyzer salience diagnostic. No confidence, salience or absolute-energy cutoff is selected.

Large jumps, deeper preceding reductions and long breaks do not provide the hoped-for simple separation: zero-reference FPs have higher median local net change and lower previous-section energy than TPs. A completed earlier low-demand window exists for 15/21 TP, 43/60 FP and 25/30 zero-reference FP; its duration medians are 20.24, 25.56 and 25.56 seconds respectively. Gaps are substantial and variable. Requiring an extended quiet preparation could remove real TPs while retaining many FPs.

All 81 Drops have `preparation=clear`, `decisiveImpact=clear`, and `sustainedStrongerPassage=clear`. These are output-schema/validator-compatible model assertions, not three independently measured acoustic signals. TP/FP rationales use closely similar language: ordinal 6 TP cites a long lower-energy passage and sharp local jump; ordinal 4 zero-reference FPs cite long subdued passages, withdrawals, sharp rises and sustained stronger sections. The table retains the exact wording for inspection. The presence of that language does not demonstrate fabrication, nor establish its musical interpretation as correct.

Structural context overlaps: TP chorus/entrance 10/21, return 5/21, generic reentry 5/21, other transition 1/21; FP chorus/entrance 30/60, return 15/60, breakdown ending 8/60, generic reentry 7/60. Repeated-similar candidates account for 13/21 TP and 37/60 FP (61.9% and 61.7%). A chorus, return or repetition veto would discard established positives. Breakdown ending has eight FPs and no TP in this small development sample; that is insufficient evidence for a universal ban.

Independent spectral novelty, instrumentation/density change, rhythmic change, physical silence, explicit buildup measurements, semantic section labels, event importance and an independent impact descriptor are unavailable. Frozen section activity is retained as a proxy, not renamed as rhythmic or instrumentation evidence. The current evidence cannot test agreement of multiple independent acoustic modalities.

## Zero-reference tracks

There are 23 zero-reference tracks. Fourteen received one or more Drop proposals, accounting for all 30 zero-reference FPs. Drop-count distribution across all 23 tracks: zero=9, one=6, two=4, three=1, four=2, five=1. Context of these 30 proposals: chorus/entrance 17 (56.7%), section return 7 (23.3%), breakdown ending 3 (10%), generic reentry 3 (10%). Repeated-similar accounts for 19/30 (63.3%). Their cited evidence consistently includes the same quiet-to-stronger/withdrawal/sharp-rise narrative seen in TPs; exact per-event evidence remains in the table, without creating an inferred genre or reference lookup.

Track-weighted comparisons are less separated than event-weighted summaries suggest. The 27 reference-positive versus 23 zero-reference tracks have median global energy .654 vs .668, median semantic event count 9 vs 9, low-demand window count 2 vs 2, duration 274.31 vs 281.60 seconds, and section count 9 vs 7. Full distributions overlap. Track prediction counts are outcomes of the semantic system and valid pre-label observations, but are not causal audio evidence or a reason to cap Drops. No trained track-presence gate is justified by this analysis.

These FPs may still be meaningful chorus entrances, reentries, energy lifts, section boundaries or breakdown endings. A semantic non-Drop remains eligible for gameplay/action mapping. This analysis does not discard those events or equate a wrong Drop type with a bad gameplay opportunity.

## False-negative causes: observation, not invented musical diagnosis

| Observable category using existing tolerances | Count | Interpretation |
|---|---:|---|
| Nearest semantic event is non-Drop within two seconds | 6 | Local representation exists with another type; compatible with a typing disagreement, not proof the same musical function was recognized |
| Semantic event is more than two but at most five seconds away, without a nearby Drop | 11 | Nearby non-Drop representation with offset; typing and location remain confounded |
| No semantic event within five seconds | 6 | Missing local proposal representation, not proof the model failed to hear a musical event |
| Nearest proposed Drop is more than two but at most five seconds away | 2 | Direct Drop timing mismatch: ordinals 39 and 43, distances 2.761 and 2.476 seconds |

The six within-two-second non-Drop events are on ordinals 7, 17, 25, 32, 35 and 47; three are section events and three energy events. Five nearest assessments are ordinary_transition and one ambiguous, but the ordinal-25 assessment is 5.246 seconds away and must not be attributed to its near-reference section event. Individual FN rows preserve event and assessment distances separately.

Seven FNs are on tracks with zero Drop proposals: two have a non-Drop event within two seconds, three have one within two-to-five seconds, and two have no event within five seconds. These are overlapping track circumstances, not extra FN categories. The earlier frozen Drop-only breakdown (16 distant, seven zero-proposal-track, two timing) is preserved and not replaced or rescored.

Several nearby ordinary-transition rationales cite already-rising energy, staged increases or no decisive impact. Other FN locations have a distant structural boundary or nearest assessment. The frozen packets do not support inferring that every reference Drop has a pronounced measured energy jump. Lowering the impact condition indiscriminately would conflict with the large FP burden.

## Two candidate hypotheses â€” not implemented

1. **Evidence-ground the existing decisive-impact judgment.** Require the existing candidate rationale to identify the actual anchor-local packet observations supporting a concentrated onset, and distinguish that evidence from a section-average jump or a multi-second rise. If the packet cannot support that distinction, retain an uncertain impact judgment and represent the musical transition with an available non-Drop type. This belongs in semantic interpretation, not post-semantic confidence filtering or a new Drop definition. V7 already states the musical requirement; the proposed change is a mandatory evidence-citation procedure within the existing rationale field, rather than merely repeating the definition. It targets generic quiet-to-stronger narratives and unsupported all-clear assertions underlying the 58 distant/zero-reference FPs. Support is the overlapping energy/context distributions and identical asserted gates. Risk: coarse packets may not substantiate real impacts, so legitimate TPs, including the 15 chorus/return TPs and low-contrast TPs, could be lost. No new acoustic evidence or predicted benefit is claimed.

2. **Audit candidate coverage independently of final Drop acceptance.** In a separately controlled future semantic-interpretation experiment, ensure a plausible local transition represented as section/energy/peak is considered as a candidate when packet evidence warrants it, without automatically promoting it or weakening the existing impact criterion. It targets six absent local representations and the 17 nearby non-Drop representations. Existing sparse candidate-first behavior may miss candidates; the FN table supplies a development motivation, not a proven cause. Risk: broader candidate coverage can add FPs, confuse ordinary transitions and increase generation tokens. This is a separate hypothesis and must not be combined with hypothesis 1 in the recommended run.

No deterministic cutoff, chorus/return ban, repetition veto, fixed Drop-count rule, confidence threshold or retrospective repair is proposed. Neither candidate is coded or expressed as a new executable prompt/contract here.

## ONE recommended next controlled experiment

Recommend hypothesis 1 only: add a mandatory anchor-local evidence-citation procedure for `decisiveImpact` in the existing candidate rationale. Do not alter its musical definition, other evidence gates, structural-context orthogonality or non-Drop gameplay eligibility. This is a conceptual recommendation, **not** a drafted prompt, implementation, authorization, activation or new semantic version.

If Nicholas later authorizes staging and execution, freeze a new independently versioned treatment and a static diff audit before generation. Preserve all 50 Stage1 input packets, preprocessing, ordinal mapping, source anchors, schema, validators, scoring contract, provider API/model (`gpt-6-sol`), high reasoning, flex service tier and store=false. Preserve the frozen per-ordinal output ceilings: 8,192 for original V7 ordinals 1–3 and 25,000 for V8 ordinals 4–50. Raising the first three caps too would introduce a second variable relative to this mixed baseline; it is not part of this recommendation. One initial attempt per ordinal; zero retries, fallbacks or partial recovery; immutable pre-call lock and post-call evidence; reserve-then-reconcile fail-closed budget accounting; no Analyzer/compiler. Semantic generation must remain label-blind, and terminal input/labels must remain inaccessible. Reuse frozen outputs only as the historical baseline, never as new predictions.

Fresh generation is required for **all 50 development cases: 50 calls**, not a hand-picked FP/FN subset or an ordinal-5 continuation. Freeze all valid outputs and provenance before one evaluation under the existing RAW Â±2-second one-to-one scorer, with frozen Â±1/Â±5 sensitivities. If any attempt fails, stop according to the execution contract; do not substitute an old response, retry, score a partial set or compare an incomplete treatment as a completed experiment.

Observed completed-valid V8 ordinal 4â€“50 costs: 47 attempts, total frozen estimate **$1.97344100**, mean **$0.0419881064**, observed min/max **$0.02514175/$0.06575800**. Using V8 observed costs as the requested approximation for all 50 calls (the first three retain their smaller caps), the 50-call central projection is **$2.09940532**, about **$2.10**. Scaling the observed per-attempt minimum/maximum gives **$1.25708750â€“$3.28790000**; this is an illustrative observed-cost envelope, not a prediction interval or spending ceiling. More demanding evidence grounding could increase output/reasoning use. Cost is calculated with the frozen method `(input - cache_write - cached + 1.25*cache_write + 0.1*cached + 5*output)/1,000,000`, counting reasoning once within output. Actual future usage would control reconciliation; no provider balance or billing statement was inspected. No future budget is authorized by this forecast.

Before execution, preregister the comparison and stop rule. Useful positive development evidence would be fewer than 60 FPs, fewer than 30 zero-reference FPs, and at least 21 TPs at the frozen two-second tolerance, accompanied by verifiable anchor-local rationales. Also report FN tradeoffs, all per-track outcomes, total calls/tokens/spend and treatment failures. A lower FP count bought by substantial TP loss or merely suppressing chorus/return events would not support the hypothesis. These are proposed future comparison criteria, not a fitted classifier threshold or a claim of improved F1.

Run this one predetermined treatment once; do not repeatedly revise rules against the same Stage1 labels. Both existing baseline and proposed treatment are development-informed, so Stage1 improvement cannot establish generalization. Unseen-track validation requires a separately authorized, independently planned future evaluation; this task does not open or prepare terminal holdout access.

## Frozen stop state

Tables, descriptive summaries, report, cost projection and receipt are the only additions. Predictions, contracts, semantic builders, validators, Analyzer, workflows, existing authorization/activation files and earlier experimental records are unchanged. V7 ordinals 1â€“3 and V8 ordinals 4â€“50 retain their original provenance; incomplete V7 ordinal-4 attempts remain excluded. No provider calls; $0 provider spend; no credential exposure; no terminal access or new terminal metadata inspection; no new score or semantic version. Stop after this forensic receipt is frozen.

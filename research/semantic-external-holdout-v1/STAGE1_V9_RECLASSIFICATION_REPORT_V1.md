# Stage1 V9 reclassification forensics V1

Provider-free development analysis of the **V7/V8 accepted50 baseline** (ordinals 1–3 V7; 4–50 V8) against frozen V9. Source HEAD `e06de28e8d5bc2d062a766ab6d133b2edd1140c9`. Predictions and all RAW scores remain immutable. No new Drop scoring pass, model execution, semantic reinterpretation, or gameplay mapping is performed.

**Main finding:** nine of the ten baseline Drop TPs lost by V9 still have a semantic event within ±2s (and ±5s). Fifty baseline FPs lose their nearby Drop label; 47 retain a non-Drop event within ±2s and 48 within ±5s. The incremental recall loss mostly concerns semantic labeling. Across all expert references, candidate timing and coverage also remain incomplete.

## Method and evidence limits

Frozen ±2s `matchedPairs` and unmatched indices supply the original TP/FP/FN membership; the matcher is not rerun. Every V9 event time resolves its unchanged object evidence anchor to the shared frozen packet. Baseline/V9 proposal hashes and packet hashes are checked for all 50 tracks. Only the previously isolated Stage1 reference excerpt is used, SHA-256 `0f2d546c90d522d266c99cf5311c0efaeb7f5750e736ba5dac08f3b42b0c6859`; its baseline isolation proof records zero terminal bytes.

For each query, nearest means minimum absolute distance, then earlier timestamp, then original event-array index. Equal-distance ties and all nearby kinds are retained in JSON/CSV. An event can serve more than one query. This proximity correspondence is not one-to-one matching and does not prove cross-run causal identity, semantic correctness, or player interaction quality. Windows are inclusive and use the existing 1e-12 timing tolerance. Other kinds would be included, but V9 contains only Drop, Peak, Energy, and Section.

“Correct moment retained” in the focused categories means temporal correspondence to an expert reference. It does not adjudicate a new semantic label after seeing labels. Priority, salience, confidence and onset source codes are frozen Analyzer-derived features, not Drop probability or proof of a waveform impact. No audio, new attack measurements, interpolated energy, or label-derived thresholds are introduced.

## A. Baseline 21 TP transitions

Exact frozen-reference overlap: 11 retained V9 Drop TPs, 10 lost, and zero new V9 TPs among the baseline’s 25 missed references. Thus the requested ten-event lost set is confirmed rather than inferred from net counts.

| Transition | ±2s primary | ±5s sensitivity |
| --- | --- | --- |
| Retained RAW Drop TP | 11 | 11 |
| Nearest Peak | 1 | 1 |
| Nearest Energy | 7 | 7 |
| Nearest Section | 1 | 1 |
| Other semantic event | 0 | 0 |
| Event only within 2–5s | 0 | included above |
| Absent within ±5s | 1 | 1 |

All 21 event rows, original matched timestamps/errors and V9 descriptions appear in the event CSV and forensic JSON.

## B. Baseline 60 FP transitions

| Nearest V9 kind/correspondence | ±2s | ±5s |
| --- | --- | --- |
| Drop | 10 | 10 |
| Peak | 0 | 0 |
| Energy | 28 | 28 |
| Section | 19 | 20 |
| Other | 0 | 0 |
| No event in the specified window | 3 | 2 |

At ±2s, the three without event comprise one shifted Section at 3.211s and two absent within ±5s. Each of the 60 original FP timestamps and its nearest-reference distance (null for zero-reference tracks) is preserved in the CSV. A nearby V9 Drop is not automatically called an FP by this proximity analysis; its frozen RAW status is separate.

## C. All 35 V9 Drop FNs

| Nearest semantic event | ±2s | ±5s |
| --- | --- | --- |
| Peak | 1 | 2 |
| Energy | 11 | 17 |
| Section | 3 | 9 |
| Other including Drop | 0 | 0 |
| Event only within 2–5s | 13 | included above |
| Absent within ±5s | 7 | 7 |
| Any-event coverage total | 15 | 28 |

The ten lost baseline TPs contribute nine covered references and one absent reference. The 25 references already missed by the baseline contribute six covered within ±2s, 13 additional covered only at 2–5s, and six absent within ±5s. None becomes a V9 RAW Drop TP. The FN CSV reports immutable baseline FN membership separately from proximity to any unmatched baseline Drop; these groups are not conflated.

## D. Focused ten lost baseline TPs

| Ordinal / stem | Reference s | Baseline Drop s (error) | Nearest V9 event s | Kind | Distance s | Outcome |
| --- | --- | --- | --- | --- | --- | --- |
| 6 / 45052168 | 32.000 | 30.494 (1.506) | 33.306 | peak | 1.306 | Retained moment within ±2s |
| 10 / 60779381 | 100.000 | 99.803 (0.197) | 99.803 | energy | 0.197 | Retained moment within ±2s |
| 12 / 91570090 | 55.000 | 54.957 (0.043) | 54.958 | energy | 0.042 | Retained moment within ±2s |
| 12 / 91570090 | 158.000 | 158.792 (0.792) | 158.804 | energy | 0.804 | Retained moment within ±2s |
| 26 / 60864932 | 109.000 | 108.786 (0.214) | 108.786 | energy | 0.214 | Retained moment within ±2s |
| 26 / 60864932 | 244.000 | 242.849 (1.151) | 242.849 | energy | 1.151 | Retained moment within ±2s |
| 28 / 126774902 | 90.000 | 89.102 (0.898) | 89.098 | section | 0.902 | Retained moment within ±2s |
| 41 / 79678819 | 224.000 | 223.286 (0.714) | 213.521 | section | 10.479 | Absent within ±5s |
| 45 / 37088222 | 74.000 | 73.860 (0.140) | 73.885 | energy | 0.115 | Retained moment within ±2s |
| 45 / 37088222 | 132.000 | 132.958 (0.958) | 133.426 | energy | 1.426 | Retained moment within ±2s |

**Nearest-kind caveat:** ordinal 6 also retains Energy at the exact baseline anchor 30.494s, while a Peak at 33.306s lies closer to the 32s reference. Its headline bin is Peak under the specified nearest-reference query, not evidence of a literal Drop→Peak rewrite. Ordinal 45 at 132s also has a nearby Peak, but the Energy event is closest.

### Ordinal 6 / 45052168, reference 32.000s

Baseline: A sharp jump from the preceding lower-energy passage leads into sustained high intensity.

V9 nearest event: The sampled energy reaches its strongest point within the intense passage.

Frozen evidence: The existing samples rise 0.5750→0.8639 between 29.410 and 29.964s, before the 30.494s baseline anchor. V9 retains Energy at that exact anchor as well as the nearer Peak at 33.306s.

Concentrated-onset evidence: Sampled rise present; no nearby onset source tag or direct concentrated attack measurement.


V9 assessment at anchor 18: decisiveImpact=weak, preparation=clear, sustainedStrongerPassage=clear, role=ambiguous. Rationale: A sustained moderate passage precedes a much stronger one. Nearby samples jump from about 0.575 to 0.864 before this anchor and remain high afterward; they do not establish a distinct impact at the anchor itself.

The frozen output explicitly says impact at the anchor is unsubstantiated; together with the non-Drop event this supports an impact-grounding demotion interpretation. It does not literally state a cross-version rejection of the baseline Drop, and hidden model reasoning is unavailable. The nearby semantic event remains eligible for gameplay mapping; interaction suitability is untested.


### Ordinal 10 / 60779381, reference 100.000s

Baseline: A short withdrawal is followed by an abrupt onset and a sustained, much stronger passage.

V9 nearest event: After a brief decline, energy rises sharply nearby and remains high; the precise impact onset is unresolved.

Frozen evidence: Samples rise 0.2072→0.7398 between 98.736 and 99.369s, then 0.8395 at 100.002s. V9 explicitly describes a concentrated sampled rise already preceding the same 99.803s anchor.

Concentrated-onset evidence: Rapid adjacent sampled rise present; its acoustic attack and exact impact onset remain unmeasured.


V9 assessment at anchor 28: decisiveImpact=unclear, preparation=clear, sustainedStrongerPassage=clear, role=ambiguous. Rationale: Energy falls through the samples at 97.470–98.736, then jumps from 0.2072 at 98.736 to 0.7398 at 99.369; the following passage remains near 0.8–0.9. That concentrated sampled rise is adjacent to, but already largely precedes, this anchor. The packet does not isolate an impact onset at the anchor itself.

The frozen output explicitly says impact at the anchor is unsubstantiated; together with the non-Drop event this supports an impact-grounding demotion interpretation. It does not literally state a cross-version rejection of the baseline Drop, and hidden model reasoning is unavailable. The nearby semantic event remains eligible for gameplay mapping; interaction suitability is untested.


### Ordinal 12 / 91570090, reference 55.000s

Baseline: The marked onset follows a sustained quiet passage and leads into an abrupt rise and a persistently stronger section.

V9 nearest event: Energy rises from the quiet break into a stronger passage, without a substantiated concentrated impact.

Frozen evidence: Samples are 0.3885 at 53.891s, 0.6764 at 54.789s and 0.9816 at 55.688s. Adjacent transition/boundary anchors differ by 0.001s; V9 uses the boundary.

Concentrated-onset evidence: Sampled multi-point increase present; transition tag does not prove a concentrated onset.


V9 assessment at anchor 37: decisiveImpact=weak, preparation=clear, sustainedStrongerPassage=clear, role=ordinary_transition. Rationale: A sustained low-energy passage precedes this boundary, and the following passage is stronger. The sampled energy rises across the boundary, but neither those coarse samples nor the adjacent transition anchor establish a concentrated impact at this anchor.

The frozen output explicitly says impact at the anchor is unsubstantiated; together with the non-Drop event this supports an impact-grounding demotion interpretation. It does not literally state a cross-version rejection of the baseline Drop, and hidden model reasoning is unavailable. The nearby semantic event remains eligible for gameplay mapping; interaction suitability is untested.


### Ordinal 12 / 91570090, reference 158.000s

Baseline: A long quiet passage precedes a marked, abrupt re-entry with nearby accents and sustained stronger energy.

V9 nearest event: Energy rises out of the long quiet passage and remains higher.

Frozen evidence: Samples are 0.4307 at 158.081s, 0.6610 at 158.979s, and 0.7248 at 159.877s. An existing onset-tagged anchor occurs at 159.057s. V9 moves from baseline anchor 126 to adjacent boundary anchor 127 (+0.012s).

Concentrated-onset evidence: Nearby onset tag and sampled increase present; tag salience 0.6750/confidence 0.6892 are not acoustic impact proof.


V9 assessment at anchor 127: decisiveImpact=weak, preparation=clear, sustainedStrongerPassage=clear, role=ordinary_transition. Rationale: A long quiet passage precedes a persistent stronger passage. Nearby samples show energy rising across the boundary, without anchor-local evidence of a distinct impact onset.

The frozen output explicitly says impact at the anchor is unsubstantiated; together with the non-Drop event this supports an impact-grounding demotion interpretation. It does not literally state a cross-version rejection of the baseline Drop, and hidden model reasoning is unavailable. The nearby semantic event remains eligible for gameplay mapping; interaction suitability is untested.


### Ordinal 26 / 60864932, reference 109.000s

Baseline: A lower-energy preparation culminates in a distinct onset and sustained high energy.

V9 nearest event: A quieter passage is followed by sustained curve values near or above 0.9; a distinct anchor-local impact is unconfirmed.

Frozen evidence: Samples rise 0.5891→0.9320 from 106.894 to 108.443s and remain high. V9 retains Energy at the exact 108.786s baseline anchor.

Concentrated-onset evidence: Strong sampled rise precedes anchor; no nearby onset source tag or attack measurement.


V9 assessment at anchor 69: decisiveImpact=unclear, preparation=clear, sustainedStrongerPassage=clear, role=ambiguous. Rationale: A quieter passage precedes a sustained, much stronger one. The curve has already risen from 0.5891 to 0.932 before this anchor; it does not establish a concentrated impact at the anchor itself.

The frozen output explicitly says impact at the anchor is unsubstantiated; together with the non-Drop event this supports an impact-grounding demotion interpretation. It does not literally state a cross-version rejection of the baseline Drop, and hidden model reasoning is unavailable. The nearby semantic event remains eligible for gameplay mapping; interaction suitability is untested.


### Ordinal 26 / 60864932, reference 244.000s

Baseline: The break and partial build resolve in a distinct impact followed by sustained high energy.

V9 nearest event: The quieter passage gives way to sustained high curve values; the precise impact morphology remains unclear.

Frozen evidence: Samples rise from 0.5852 at 241.673s to 0.8611 at 243.222s and 0.9596 at 244.771s. V9 retains Energy at the exact 242.849s baseline anchor.

Concentrated-onset evidence: Rise across spaced samples present; concentration and acoustic impact unresolved.


V9 assessment at anchor 145: decisiveImpact=unclear, preparation=clear, sustainedStrongerPassage=clear, role=ambiguous. Rationale: The preceding quieter passage gives way to sustained high energy. Curve samples of 0.5852 before and 0.8611 after this anchor show a strong rise, but their spacing does not establish a concentrated impact at the anchor.

The frozen output explicitly says impact at the anchor is unsubstantiated; together with the non-Drop event this supports an impact-grounding demotion interpretation. It does not literally state a cross-version rejection of the baseline Drop, and hidden model reasoning is unavailable. The nearby semantic event remains eligible for gameplay mapping; interaction suitability is untested.


### Ordinal 28 / 126774902, reference 90.000s

Baseline: A long quiet passage is followed by a sharp impact and sustained high energy.

V9 nearest event: A long subdued passage gives way to sustained high energy.

Frozen evidence: Samples rise 0.3581→0.8492 from 87.914 to 89.430s, followed by 0.9656 at 90.946s. Onset-tagged anchor 72 is at 88.746s; V9 uses transition anchor 73 (89.098s), adjacent to baseline boundary anchor 74 (89.102s).

Concentrated-onset evidence: Nearby onset tag and sampled rise present; tag salience 0.6602/confidence 0.6940 do not prove impact morphology.


V9 assessment at anchor 73: decisiveImpact=unclear, preparation=clear, sustainedStrongerPassage=clear, role=ordinary_transition. Rationale: A long subdued passage precedes this entrance, and the following section stays strong. Energy samples rise from 0.3581 before the anchor to 0.8492 after it, but do not resolve a concentrated impact at this anchor.

The frozen output explicitly says impact at the anchor is unsubstantiated; together with the non-Drop event this supports an impact-grounding demotion interpretation. It does not literally state a cross-version rejection of the baseline Drop, and hidden model reasoning is unavailable. The nearby semantic event remains eligible for gameplay mapping; interaction suitability is untested.


### Ordinal 41 / 79678819, reference 224.000s

Baseline: A locally sharp rise follows the lower passage and build, leading into sustained high energy.

V9 nearest event: A quieter passage gives way to a long, substantially stronger one.

Frozen evidence: Samples are already elevated: 0.7824 at 221.262s, 0.7233 at 222.595s, 0.9087 at 223.928s and 0.9150 at 225.261s. No V9 event or candidate assessment is within ±5s. Nearest event is Section at 213.521s.

Concentrated-onset evidence: Modest sampled rise within an already energetic passage; no local boundary or onset tag within the inspected windows. No frozen explanation for omission.


No candidate assessment within ±5s explains the omission. Impact-grounding rejection cannot be inferred for this case. This is a semantic-event coverage loss around the reference; the frozen samples cannot establish the acoustic cause.


### Ordinal 45 / 37088222, reference 74.000s

Baseline: A distinct onset releases the lower-energy lead-in into a sustained high-energy passage.

V9 nearest event: Section energy increases again, and subsequent curve samples remain substantially higher.

Frozen evidence: Samples rise 0.4720→0.7651→0.8690 at 72.707/74.053/75.399s. V9 uses the adjacent boundary anchor 43 (73.885s) rather than baseline transition anchor 42 (73.860s).

Concentrated-onset evidence: Increase spans multiple samples; no nearby onset source tag or direct attack measurement.


V9 assessment at anchor 43: decisiveImpact=weak, preparation=weak, sustainedStrongerPassage=clear, role=ordinary_transition. Rationale: A stronger passage follows, but sampled energy rises across several seconds, from 0.472 near the boundary to 0.7651 and then 0.869. The packet does not isolate an impact at anchor 43.

The frozen output explicitly says impact at the anchor is unsubstantiated; together with the non-Drop event this supports an impact-grounding demotion interpretation. It does not literally state a cross-version rejection of the baseline Drop, and hidden model reasoning is unavailable. The nearby semantic event remains eligible for gameplay mapping; interaction suitability is untested.


### Ordinal 45 / 37088222, reference 132.000s

Baseline: A sharp onset follows the quieter section and leads into sustained near-maximum energy.

V9 nearest event: A long lower-energy section gives way to a sustained section with much higher average energy.

Frozen evidence: Samples rise 0.3380→0.6056→0.9964 at 130.602/131.949/133.295s, reaching 1.0 at 134.642s. V9 uses boundary anchor 92 (133.426s); baseline used beat anchor 91 (132.958s). A Peak at 133.495s is also within ±2s.

Concentrated-onset evidence: Broad sampled rise already reaches high level before V9 boundary; no nearby onset source tag or direct attack measurement.


V9 assessment at anchor 92: decisiveImpact=weak, preparation=clear, sustainedStrongerPassage=clear, role=ambiguous. Rationale: A long lower-energy section precedes a sustained high-energy one. The curve rises from 0.6056 to 0.9964 before this boundary, while the boundary's local value is about 0.997; that broad rise does not substantiate a concentrated onset at anchor 92.

The frozen output explicitly says impact at the anchor is unsubstantiated; together with the non-Drop event this supports an impact-grounding demotion interpretation. It does not literally state a cross-version rejection of the baseline Drop, and hidden model reasoning is unavailable. The nearby semantic event remains eligible for gameplay mapping; interaction suitability is untested.


## E. The 50 eliminated baseline FPs

For each original FP, “eliminated as Drop” means no V9 Drop within ±2s of that baseline timestamp; ±5s repeats the check. Here that independently identified set is 50 in both windows. Of those 50, 28 become nearest Energy and 19 nearest Section within ±2s; one more Section appears at 3.211s; two have no event within ±5s. The retained ten nearby Drop events are ten distinct V9 event indices and retain their frozen FP identity (verified independently).

| Existing pre-label feature / nearest assessment | Lost TPs (10) | Eliminated FPs (50) |
| --- | --- | --- |
| Assessment within ±5s | 9 | 49 |
| Impact weak / unclear / absent / missing | 5 / 4 / 0 / 1 | 31 / 15 / 3 / 1 |
| Preparation clear / weak / missing | 8 / 1 / 1 | 45 / 4 / 1 |
| Sustained stronger passage clear | 9 | 45 |
| Existing onset source tag within ±2s of baseline anchor | 2 | 18 |
| Existing section boundary within ±5s | 9 | 50 |

This table counts existing categorical judgments and source tags, not new acoustic measurements. Assessments are selected by nearest anchor to the original baseline timestamp within ±5s; all exact rationales remain in JSON.

**No clean qualitative separator is established.** Lost TPs and most eliminated FPs both have clear preparation, persistent stronger energy and weak/unclear impact assessments. Their V9 rationales frequently invoke the same uncertainty: a sampled rise already precedes the chosen anchor, straddles it, or does not isolate an attack at that exact point.

Examples make the overlap concrete. Lost TP ordinal 10 has 0.2072→0.7398 across adjacent samples before the anchor, and V9 calls the sampled rise concentrated but the impact unresolved. Eliminated FP ordinal 1 on a zero-reference track has 0.3993→0.9763 across adjacent samples, an existing onset tag, clear preparation and persistence, yet the same unclear-impact judgment. Eliminated FP ordinal 20 has 0.3996→0.9255 around a nearby onset tag and again clear preparation/persistence. Hence an adjacent jump, preparation, persistence, or onset tag alone cannot be offered as a separating rule from these data.

Some eliminated FPs have genuinely different frozen evidence: ordinal 44 at 368.791s has weak preparation and no sustained stronger passage; ordinal 32 at 64.580s has weak persistence and only a brief stronger level; ordinal 4 at 168.007s describes a recovery whose high point falls back and whose adjacent sections have similar energy. These observations justify case-specific caution but cover only a subset, not the majority. No threshold or classifier is fitted. A rationale is an output claim, and cited observations can refer to a broader neighborhood than the baseline anchor; the exact packet samples are included so that such claims remain inspectable.

Every eliminated FP’s frozen assessments, rationale, section-boundary context and anchor-local samples appear in JSON; CSV retains the correspondence rows.

## F. Semantic-event coverage around expert Drop references

**Descriptive gameplay coverage only; these are not Drop true positives.**

| Tolerance | Covered references / 46 | Coverage | Nearest Drop | Nearest Peak | Nearest Energy | Nearest Section |
| --- | --- | --- | --- | --- | --- | --- |
| ±1s | 19 / 46 | 41.30% | 9 | 0 | 8 | 2 |
| ±2s | 26 / 46 | 56.52% | 11 | 1 | 11 | 3 |
| ±5s | 39 / 46 | 84.78% | 11 | 2 | 17 | 9 |

Nearest-kind bins are exclusive. Nonexclusive reference-kind presence is also recorded: at ±2s, references have nearby Drop/Peak/Energy/Section in 11/2/12/3 cases; at ±5s in 11/7/18/11 cases. A reference can have several nearby kinds.

| V9 kind | Total events | Events within ±2s of any reference | Events within ±5s |
| --- | --- | --- | --- |
| section | 242 | 3 | 11 |
| peak | 84 | 2 | 7 |
| energy | 113 | 12 | 18 |
| drop | 21 | 11 | 11 |

The event-count table counts each V9 event once, regardless of how many references it neighbors; it differs from counting covered references. Section, Peak and Energy events remain potentially useful for chorus entrances, re-entries, energy lifts, boundaries, peaks and breakdown endings. None is discarded or converted to Drop.

## G. Fifty-track view

Full IDs are in `STAGE1_V9_TRACK_COVERAGE_V1.csv`. Baseline columns always mean V7/V8 accepted50 baseline.

| Ord / stem | Refs | Baseline Drops | Baseline TP/FP/FN | V9 Drops | V9 TP/FP/FN | Peak | Energy | Section | Any-event refs ±2 / ±5 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 / 86533027 | 0 | 1 | 0/1/0 | 0 | 0/0/0 | 1 | 1 | 8 | 0 / 0 |
| 2 / 54634175 | 0 | 0 | 0/0/0 | 0 | 0/0/0 | 1 | 2 | 5 | 0 / 0 |
| 3 / 41211831 | 0 | 0 | 0/0/0 | 0 | 0/0/0 | 1 | 1 | 5 | 0 / 0 |
| 4 / 87619325 | 0 | 5 | 0/5/0 | 0 | 0/0/0 | 3 | 2 | 5 | 0 / 0 |
| 5 / 73229079 | 0 | 0 | 0/0/0 | 0 | 0/0/0 | 3 | 1 | 6 | 0 / 0 |
| 6 / 45052168 | 1 | 2 | 1/1/0 | 0 | 0/0/1 | 1 | 5 | 6 | 1 / 1 |
| 7 / 97169237 | 1 | 3 | 0/3/1 | 2 | 0/2/1 | 2 | 2 | 4 | 0 / 0 |
| 8 / 39637970 | 2 | 0 | 0/0/2 | 0 | 0/0/2 | 1 | 1 | 2 | 0 / 1 |
| 9 / 60170982 | 1 | 2 | 0/2/1 | 0 | 0/0/1 | 0 | 1 | 5 | 0 / 1 |
| 10 / 60779381 | 1 | 1 | 1/0/0 | 0 | 0/0/1 | 1 | 2 | 4 | 1 / 1 |
| 11 / 98468953 | 0 | 0 | 0/0/0 | 0 | 0/0/0 | 1 | 0 | 4 | 0 / 0 |
| 12 / 91570090 | 2 | 2 | 2/0/0 | 0 | 0/0/2 | 0 | 3 | 3 | 2 / 2 |
| 13 / 125282679 | 1 | 0 | 0/0/1 | 0 | 0/0/1 | 3 | 5 | 7 | 1 / 1 |
| 14 / 121885015 | 1 | 2 | 1/1/0 | 1 | 1/0/0 | 1 | 1 | 3 | 1 / 1 |
| 15 / 53652782 | 0 | 3 | 0/3/0 | 3 | 0/3/0 | 2 | 1 | 6 | 0 / 0 |
| 16 / 48207706 | 0 | 2 | 0/2/0 | 0 | 0/0/0 | 0 | 5 | 6 | 0 / 0 |
| 17 / 81381341 | 2 | 0 | 0/0/2 | 0 | 0/0/2 | 3 | 3 | 7 | 1 / 2 |
| 18 / 91744869 | 1 | 1 | 0/1/1 | 1 | 0/1/1 | 1 | 1 | 4 | 1 / 1 |
| 19 / 70906479 | 1 | 1 | 1/0/0 | 1 | 1/0/0 | 1 | 0 | 6 | 1 / 1 |
| 20 / 109446919 | 0 | 1 | 0/1/0 | 0 | 0/0/0 | 0 | 3 | 2 | 0 / 0 |
| 21 / 85840934 | 0 | 1 | 0/1/0 | 0 | 0/0/0 | 1 | 2 | 3 | 0 / 0 |
| 22 / 126290034 | 0 | 1 | 0/1/0 | 0 | 0/0/0 | 3 | 2 | 2 | 0 / 0 |
| 23 / 84061701 | 2 | 1 | 1/0/1 | 1 | 1/0/1 | 1 | 3 | 5 | 1 / 1 |
| 24 / 74937346 | 0 | 0 | 0/0/0 | 0 | 0/0/0 | 3 | 1 | 2 | 0 / 0 |
| 25 / 32192109 | 2 | 2 | 0/2/2 | 0 | 0/0/2 | 2 | 2 | 5 | 1 / 2 |
| 26 / 60864932 | 2 | 3 | 2/1/0 | 0 | 0/0/2 | 2 | 5 | 5 | 2 / 2 |
| 27 / 39970700 | 0 | 2 | 0/2/0 | 1 | 0/1/0 | 1 | 2 | 3 | 0 / 0 |
| 28 / 126774902 | 2 | 4 | 1/3/1 | 0 | 0/0/2 | 2 | 1 | 10 | 1 / 1 |
| 29 / 76926936 | 2 | 1 | 0/1/2 | 0 | 0/0/2 | 2 | 4 | 5 | 0 / 1 |
| 30 / 60368032 | 2 | 4 | 2/2/0 | 3 | 2/1/0 | 1 | 3 | 5 | 2 / 2 |
| 31 / 60809730 | 0 | 0 | 0/0/0 | 0 | 0/0/0 | 3 | 2 | 2 | 0 / 0 |
| 32 / 57232773 | 3 | 2 | 0/2/3 | 0 | 0/0/3 | 1 | 4 | 7 | 1 / 3 |
| 33 / 37942877 | 0 | 0 | 0/0/0 | 0 | 0/0/0 | 2 | 1 | 3 | 0 / 0 |
| 34 / 57931601 | 0 | 2 | 0/2/0 | 0 | 0/0/0 | 1 | 7 | 5 | 0 / 0 |
| 35 / 96730252 | 2 | 0 | 0/0/2 | 0 | 0/0/2 | 3 | 2 | 4 | 0 / 2 |
| 36 / 53719180 | 0 | 1 | 0/1/0 | 0 | 0/0/0 | 2 | 0 | 3 | 0 / 0 |
| 37 / 72517913 | 0 | 4 | 0/4/0 | 0 | 0/0/0 | 3 | 2 | 8 | 0 / 0 |
| 38 / 127164225 | 2 | 5 | 2/3/0 | 3 | 2/1/0 | 1 | 4 | 5 | 2 / 2 |
| 39 / 47275398 | 2 | 2 | 1/1/1 | 1 | 1/0/1 | 1 | 2 | 5 | 1 / 2 |
| 40 / 91165591 | 0 | 0 | 0/0/0 | 0 | 0/0/0 | 3 | 1 | 2 | 0 / 0 |
| 41 / 79678819 | 2 | 1 | 1/0/1 | 0 | 0/0/2 | 2 | 1 | 8 | 0 / 1 |
| 42 / 60529832 | 2 | 3 | 0/3/2 | 0 | 0/0/2 | 6 | 1 | 12 | 0 / 1 |
| 43 / 65673638 | 1 | 2 | 0/2/1 | 0 | 0/0/1 | 1 | 3 | 1 | 0 / 1 |
| 44 / 32339733 | 0 | 4 | 0/4/0 | 0 | 0/0/0 | 3 | 3 | 9 | 0 / 0 |
| 45 / 37088222 | 2 | 2 | 2/0/0 | 0 | 0/0/2 | 2 | 4 | 6 | 2 / 2 |
| 46 / 34226765 | 0 | 2 | 0/2/0 | 0 | 0/0/0 | 2 | 4 | 2 | 0 / 0 |
| 47 / 84747227 | 2 | 2 | 1/1/1 | 2 | 1/1/1 | 1 | 3 | 5 | 2 / 2 |
| 48 / 57561267 | 0 | 0 | 0/0/0 | 0 | 0/0/0 | 2 | 2 | 2 | 0 / 0 |
| 49 / 92251267 | 0 | 1 | 0/1/0 | 0 | 0/0/0 | 1 | 2 | 6 | 0 / 0 |
| 50 / 57916551 | 2 | 3 | 2/1/0 | 2 | 2/0/0 | 0 | 0 | 4 | 2 / 2 |

All 50 tracks have semantic events. Missing reference-local coverage is not an entire-track disappearance. Seven references lack any event within ±5s: ordinal 7 at 150s (nearest distance 5.151s), 8 at 200s (34.524s), 23 at 68s (5.381s), 28 at 178s (38.598s), 29 at 293s (24.500s), 41 at 224s (10.479s), and 42 at 159s (10.082s). The first and third are near the window edge; the larger distances are substantive reference-local omissions under this descriptive test.

## H. Conclusions and one unimplemented development hypothesis

1. **Reclassification predominates in incremental loss:** nine of ten lost baseline TPs retain a nearby semantic event. Only one is absent within ±5s.
2. **Lost TP coverage:** nine within ±2s and nine within ±5s.
3. **Absorbing nearest kinds:** seven Energy, one Peak, one Section, zero other. Exact-anchor correspondence can differ from nearest-reference kind, as ordinal 6 illustrates.
4. **Eliminated FPs:** 47/50 retain nearby non-Drops at ±2s, 48/50 at ±5s; two disappear within ±5s and one shifts by 3.211s.
5. **Gameplay usefulness:** the preserved moments support keeping non-Drops eligible for separate action mapping. This improves the assessment of candidate preservation, but does not establish gameplay readiness or successful gameplay interactions. Only 26/46 expert references have any event within ±2s. The failed Drop-retention preregistration remains failed.
6. **Main issue:** semantic classification dominates the ten incremental TP losses. For the full reference set, the issue is a mixture: classification, 13 event correspondences only at 2–5s, and seven without coverage within ±5s.
7. **Recommended H1 (label-informed, not implemented):** Separate anchor-timing uncertainty from musical impact absence in grounded semantic judgments: prepared, sustained transitions with a nearby sampled rise may be conservatively demoted because the frozen anchor does not coincide exactly with an independently resolved attack. A future development study could test whether evaluating existing local temporal evidence jointly preserves true Drops while retaining resistance to ordinary re-entry overcalling.

This is a falsifiable development hypothesis, not an established correction. The same evidence motifs occur among many eliminated FPs, so there is no demonstrated rule that would recover the lost TPs without reviving overcalling. No new prompt, model, treatment, threshold, deterministic post-filter, or V10 is created. Stage1 labels inform this hypothesis; repeated Stage1 tuning increases overfit risk. These data provide no unseen validation. Terminal holdout remains untouched, and no terminal preparation occurs.

## Integrity and continuation stop

Provider calls this analysis: **0**; spend: **$0**. Predictions, semantic treatment, scoring contracts and prior RAW records are unchanged. No generation rerun, scoring rerun, Analyzer or compiler invocation, terminal labels or terminal metadata inspection. The complete input hashes/artifact identities and output hashes are pinned in the JSON receipt. Commit/push this provider-free analysis and stop.

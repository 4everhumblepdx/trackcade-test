# Trackcade micro-events and recurring figures — research v1

**Classification D. STOP: no live integration.** Recurrence candidates are detectable, but their scores do not distinguish them from rhythm-preserving descriptor-shuffle controls. Event timing on real mixes is not independently calibrated. This is a negative research result, not evidence that either song lacks motifs.

Source: `b981d270a098a91619168dfd904f19713c66d4c1`. One fixed configuration was set before fixture DSP and is hash-verified against PREFLIGHT.json. No hand occurrences, subjective times, semantic labels, instrument/vocal identities or genre rules entered analysis. Existing v0.19, V9, and Pulse Tap v2.3 remain unchanged. RESEARCH_STATE.json is the authoritative interpretation and stop record.

## Method and provenance

Local Chrome WebAudio decodes the two authorized MP3s to mono 22050Hz float32, without trimming or beat snapping. Independent decodes produced identical PCM hashes. Centered 1024/2048-sample spectra, 128-sample hops (5.805ms), logarithmic spectral novelty and local-average subtraction detect candidates. Sample-domain energy rise refines event time. Provisional timing requires multiscale agreement within 15ms, proxy uncertainty at most 20ms and heuristic confidence at least 0.75. These proxies are not measured mixture error bounds. Production-validated timing count is zero.

The approach follows [FMP spectral novelty](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C6/C6S1_NoveltySpectral.html) and feature comparison principles from [FMP self-similarity](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C4/C4S2_SSM.html). A custom NumPy implementation is used, with no existing Analyzer modification.

Consecutive windows of 2–6 events, lasting 0.16–3 seconds, use normalized intervals, relative attack strength, 12-band acoustic contours and mixture chroma. Four non-overlapping recurrences, separated by at least one second, are required. Stable IDs hash canonical patterns. Twelve families is a review cap, not the number of meaningful motifs in a song. Greedy seed grouping is phase-sensitive and cannot robustly align missing/extra attacks. No note-level/relative melodic pitch or release-duration estimate is established. All source identities remain UNKNOWN.

`recurrenceConfidence` is mean heuristic similarity, not a calibrated probability. `motifProminence` combines recurrence count, similarity, strength, song span and distinctiveness; it is not perceptual ground truth. Full-mix spectral/chroma features can follow accompaniment instead of a foreground phrase.

## Controls and timing interpretation

Uniform quarter-note events with constant acoustics/attacks produce zero families. This necessary false-motif control passes. The stronger fixed-seed shuffle retains event times and rhythms while jointly permuting acoustic/chroma/strength descriptors; timing flags remain attached to original events. It produces equally many capped families with higher top prominence on BOTH songs. The scorer lacks sufficient specificity beyond rhythmic density. This surrogate is diagnostic, not a p-value, complete false-discovery correction, or proof every real candidate is false.

31 synthetic tests pass: rescaling, gross rhythm mismatch, acoustic/chroma separation, deterministic IDs/counts, trust gates, timing preservation, silence/nonfinite handling, source UNKNOWN, coverage and safety. Both full analyses repeat with eight byte-identical result files and identical PCM hashes. Synthetic isolated attacks have maximum timing error 0.4082ms; that result cannot be extrapolated to compressed polyphonic mixtures. The listening report passes three phone-width browser groups with no outside network requests.

## Results

| Track | Detected events | Provisional DSP timing passes | Production-validated | Near beat ±20ms | Outside ±20ms |
|---|---:|---:|---:|---:|---:|
| ALLDAT | 972 | 220 | 0 | 131 (13.48%) | 841 (86.52%) |
| CVB G.E.M.F. | 1893 | 501 | 0 | 298 (15.74%) | 1595 (84.26%) |

Outside ±20ms is a legal-vocabulary mismatch, not proof of a separate off-beat musical intention. Detector uncertainty can also produce mismatch. Existing beat times are never moved.

| Track / candidate | Events | Recurrences | Similarity | Prominence |
|---|---:|---:|---:|---:|
| ALLDAT `motif-eb28d5e25baf` | 2 | 14 | .947289 | .762538 |
| ALLDAT `motif-a3018d92302e` | 2 | 17 | .959724 | .752323 |
| ALLDAT `motif-12e0307b5a48` | 2 | 11 | .954053 | .752263 |
| ALLDAT `motif-eb660115479f` | 3 | 8 | .947978 | .689006 |
| CVB `motif-a1789288fe20` | 3 | 17 | .938772 | .809253 |
| CVB `motif-fced585fc7b0` | 2 | 20 | .949374 | .806255 |
| CVB `motif-9bc5270ec349` | 3 | 14 | .925030 | .802492 |

Strongest shuffled prominence: ALLDAT .793951, CVB .859407, both above the corresponding real maximum. The shuffle even produces five preliminary eligible CVB families; real eligible families are zero. Thus recurrence/prominence alone is not a defensible gameplay-anchor gate.

The blind ALLDAT three-event candidate naturally emerged without labels: normalized gaps 1.238721 : .761279; starts include 24.213, 27.612, 76.017 and 93.285 seconds. These are algorithm-generated post-analysis inspection points, not supplied hints. It lacks sufficient all-event timing trust, and the overall detector fails shuffle specificity. It is NOT validated as Nicholas's perceptually obvious three-note figure. No thresholds were tuned until such a family appeared.

All 12 candidate families per song, all occurrence/event times, confidence/strength/beat offsets, canonical descriptors, section distributions and rejection reasons are in the JSON outputs and listening artifact. Sections are the unchanged v2.2 objective section timestamps, not semantic labels.

## Current v2.3 coverage versus proposed anchors

| Track | Candidate occurrences | v2.3 partial / full | v2.3 event hits / misses | Proposed coverage |
|---|---:|---:|---:|---:|
| ALLDAT | 136 | 35 / 0 | 35 / 245 | 0% |
| CVB | 380 | 71 / 0 | 75 / 806 | 0% |

Counts are occurrence-weighted and may duplicate events across candidate families. Nearby v2.3 hits within ±20ms count as approximate representation, not identical impact times. These unvalidated families do not establish perceptual anchor-coverage loss.

Unique candidate-family events: ALLDAT 230 (33 near beats, 197 outside tolerance); CVB 556 (94 near, 462 outside). Faithful representation of those 197/462 detected times would require independently validated micro-events. Accepted/proposed new off-beat hits: zero. No family is anchor-eligible under the current gates; every simulated occurrence records why it was rejected. Gates remain fail-closed rather than manufacturing coverage.

Chroma ablation retains 136 recurrences versus 147 without chroma for ALLDAT; CVB 380 versus 382. Both family lists cap at 12 and identify different sets. Counts alone do not measure accuracy. Chroma filters matches, but material matching improvement is not established, and null scores remain strong. Note-level pitch accuracy and a useful relative melodic contour are unproven. Current rhythm/acoustic recurrence and mixture chroma are insufficient under these controls.

## Anchor / event / flow policy

POLICY.json specifies the future hierarchy: validated recurring anchors and important one-off events reserve opportunities before difficulty-aware flow fills remaining capacity. Anchor coverage should enumerate eligible occurrences and document every loss, with no universal fixed percentage. Canonical event-position subsets should preserve motif identity through reduced/partial/full forms; expanded forms may add independently trusted nearby events only. Context can vary event/flow choices and bounded spatial routes. Semantic non-Drop events remain eligible for gameplay/action mapping.

The implemented anchor-only simulation explores strength-ranked reduced/partial/full transformations with per-occurrence stage capacity, prominence-priority overlap handling, minimum intervals and protected Landing/ending. It rejects every real family in this run. It does NOT implement expanded patterns, complete event/flow scheduling, global stage optimization, spatial routing, or full canonical-subset consistency. Those remain explicit integration requirements, not claims about completed runtime behavior. Total challenge, burst/interval/spatial safety and locked Landing/ending would remain mandatory.

## Specific evidence gaps / STOP

The next specific capabilities needed are more discriminative event-local descriptors and alignment that tolerates missing/extra attacks, validated against rhythm-preserving surrogates. Harmonic/percussive separation or foreground-aware tonal contours are possible provider-free research approaches. Timing also requires known-onset polyphonic calibration and auditory review. No source identity should be asserted without separate evidence.

No live integration or Pages deployment. No difficulty or visual changes. v2.3/V9/v0.19 changed NO; Stage1 labels accessed NO; terminal holdout accessed NO; provider calls 0; spend $0. No further experiment starts automatically.

Human inspection: REPORT.html, or the scoped server at `http://127.0.0.1:8766/research/micro-motif-v1/REPORT.html`. Every occurrence can be listened to with event spacing, timing-gate status and beat offsets; interpreting raw DSP arrays is unnecessary. Reproduce with `decode.cjs`, `export-v23.cjs`, `analyze.py`, `verify_results.py` and `build_review.py` using explicit scratch PCM directories. NumPy and an existing Chrome/Playwright runtime are the only analysis dependencies; no package or model download is needed.

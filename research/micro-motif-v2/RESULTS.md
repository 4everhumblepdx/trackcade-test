# Micro-Motif v2 — frozen five-song result
Classification **D**. No integration. Provider calls 0; spend $0.
Source/v1 `6f1555db2a6a7aa2c8cf7e7b59390c17788b39b9`. Committed external method freeze `d39f7a2748821aff2a585ae2305c77aca8599df6`.
Configuration SHA-256 `4de7f3a58edb70689d958dca751567aeecdede212e04882c98ec8eb2799e4638`. Exact code/input/result hashes: RESEARCH_STATE.json, PREFLIGHT.json and VERIFICATION.json.

## Independent synthetic validation
|Condition|Matched|Missed|FP|Median ms|P90 ms|P95 ms|Max ms|Bias ms|Pass|
|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
|clustered|42|0|0|1.270|2.857|6.078|8.866|0.062|True|
|compressed|30|0|30|14.626|34.989|40.736|46.440|-11.498|False|
|harmonic-bed|30|0|3|2.993|10.893|13.229|14.739|4.292|True|
|isolated|30|0|0|1.179|2.857|2.870|2.880|-0.178|True|
|near-pulses|67|8|3|4.603|9.474|13.036|45.238|5.359|True|
|noise-attacks|30|0|0|1.349|1.481|4.261|9.070|-0.618|True|
|overlapping-tones|30|0|21|1.134|2.857|2.870|2.880|-0.268|False|
|simultaneous|30|0|0|1.066|3.424|7.878|15.193|0.704|True|
|soft-over-bed|30|0|55|4.093|12.147|14.535|19.977|1.224|False|
|variable-envelope|30|0|11|6.088|28.755|28.776|28.776|10.467|False|

Calibration gate supported: False. Internal stability and low matched timing errors cannot hide missed attacks or false detections. No recording has independent real onset ground truth; production-validated count is zero.

## Five-song generalization
|Track|Events|Internal stable|Strict|Near grid|Outside grid|Families|Real top|Null max|Separated|Anchors|
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
|alldat|972|220|0|131|841|1|0.610777|0.684093|0|0|
|cvb|1893|501|0|298|1595|3|0.730120|0.767369|0|0|
|laid-back|794|219|0|98|696|0|0.000000|0.596382|0|0|
|wanna-get-lit|898|213|0|55|843|2|0.699555|0.736813|0|0|
|need-a-bag|1164|310|0|111|1053|0|0.000000|0.670683|0|0|

Development near/outside uses the frozen analyzer beat evidence within 20ms. External counts use a **generic exploratory pulse proxy**, not known beats; actual on/off-beat truth is unavailable. Timing annotations do not affect matching. No external track used special handling.

## Track details and ablations

### alldat
Audio `ALLDAT_ruffmix.mp3`, duration 196.075102s; input SHA-256 `d8f73630ba1acf3db816ac0e1674588c3002df9d2436f5417b270ac434a57c7a`; decoded PCM `2735def511c8da418edec9ef7b29e324cd9aa85014657a46a090b9ea8cef68d7`; mono 22050Hz.
Event density 4.957/s; canonical 2/3/4/5/6 distribution `{'2': 0, '3': 1, '4': 0, '5': 0, '6': 0}`. Total retained occurrences 4; gapped 2.
|Family|Length range|Returns|Prominence|Span|Search-max exceedance|Reason|
|---|---|---:|---:|---:|---:|---|
|v2-032097fd49d1|3 canonical / [2, 3]|4|0.610777|0.406507|0.15625|rejected: search-max null not separated|
descriptor-shuffle: 31 fixed realizations; top-score range 0.000000–0.000000, median 0.000000; searched-family count range 0–0. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
rhythm-preserving: 31 fixed realizations; top-score range 0.000000–0.000000, median 0.000000; searched-family count range 0–0. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
timing-misalignment: 31 fixed realizations; top-score range 0.000000–0.684093, median 0.000000; searched-family count range 0–1. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
|Representation|Real top|Null max|Separated retained|Returns|
|---|---:|---:|---:|---:|
|v1-texture|0.792845|0.855143|0|153|
|without-chroma|0.611624|0.684729|0|4|
|without-hp|0.615254|0.716347|0|4|
Chroma and HP are supported only to the extent of this measured ablation separation; neither validates note pitch or foreground/source identity. Source UNKNOWN.

### cvb
Audio `cvb-gemf-sample.mp3`, duration 309.420408s; input SHA-256 `fbdc3cb2d30abc3403626f5b808bbafc44b0fd834f64524bca2fb646817b13bb`; decoded PCM `7c7ce88ff17759057c57470d25b4d48dd8240b911130e02cb3b456dd12f7a6b8`; mono 22050Hz.
Event density 6.118/s; canonical 2/3/4/5/6 distribution `{'2': 3, '3': 0, '4': 0, '5': 0, '6': 0}`. Total retained occurrences 17; gapped 3.
|Family|Length range|Returns|Prominence|Span|Search-max exceedance|Reason|
|---|---|---:|---:|---:|---:|---|
|v2-5e69ba3296d1|2 canonical / [2, 2]|6|0.730120|0.698571|0.06250|rejected: search-max null not separated|
|v2-1040fffd4a4b|2 canonical / [2, 2]|6|0.717432|0.808460|0.06250|rejected: search-max null not separated|
|v2-8069b3c1ac2b|2 canonical / [2, 3]|5|0.710138|0.750382|0.06250|rejected: search-max null not separated|
descriptor-shuffle: 31 fixed realizations; top-score range 0.000000–0.000000, median 0.000000; searched-family count range 0–0. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
rhythm-preserving: 31 fixed realizations; top-score range 0.000000–0.000000, median 0.000000; searched-family count range 0–0. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
timing-misalignment: 31 fixed realizations; top-score range 0.000000–0.767369, median 0.000000; searched-family count range 0–3. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
|Representation|Real top|Null max|Separated retained|Returns|
|---|---:|---:|---:|---:|
|v1-texture|0.840164|0.895063|0|447|
|without-chroma|0.730367|0.767661|0|17|
|without-hp|0.733244|0.777611|0|18|
Chroma and HP are supported only to the extent of this measured ablation separation; neither validates note pitch or foreground/source identity. Source UNKNOWN.

### laid-back
Audio `Laid Back (REST100) Final (1).mp3`, duration 171.206531s; input SHA-256 `c46ae2b7d4fa8faa0997a99d9b19c04410b51b838a1880557b2ded6ced97a9e6`; decoded PCM `1e103bcd43ba854e8db96ad0fce64f3e5e01940d3342faae3711802b3ff3ad6f`; mono 22050Hz.
Event density 4.638/s; canonical 2/3/4/5/6 distribution `{'2': 0, '3': 0, '4': 0, '5': 0, '6': 0}`. Total retained occurrences 0; gapped 0.
|Family|Length range|Returns|Prominence|Span|Search-max exceedance|Reason|
|---|---|---:|---:|---:|---:|---|
descriptor-shuffle: 31 fixed realizations; top-score range 0.000000–0.000000, median 0.000000; searched-family count range 0–0. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
rhythm-preserving: 31 fixed realizations; top-score range 0.000000–0.596382, median 0.000000; searched-family count range 0–1. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
timing-misalignment: 31 fixed realizations; top-score range 0.000000–0.000000, median 0.000000; searched-family count range 0–0. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
|Representation|Real top|Null max|Separated retained|Returns|
|---|---:|---:|---:|---:|
|v1-texture|0.783924|0.859052|0|89|
|without-chroma|0.000000|0.597953|0|0|
|without-hp|0.000000|0.601674|0|0|
Chroma and HP are supported only to the extent of this measured ablation separation; neither validates note pitch or foreground/source identity. Source UNKNOWN.

### wanna-get-lit
Audio `Wanna get lit (REST100) Final.mp3`, duration 230.504490s; input SHA-256 `09aefc0d77d4b3ac2c2e23bad60f887973d57bc29e39cd6c06347908b2ee42cb`; decoded PCM `7d14b046d006e557fe5e0be46fc4897866cd5f48f7f5455edc9b8e0c8b8c0159`; mono 22050Hz.
Event density 3.896/s; canonical 2/3/4/5/6 distribution `{'2': 2, '3': 0, '4': 0, '5': 0, '6': 0}`. Total retained occurrences 9; gapped 1.
|Family|Length range|Returns|Prominence|Span|Search-max exceedance|Reason|
|---|---|---:|---:|---:|---:|---|
|v2-11556d75cff5|2 canonical / [2, 2]|5|0.699555|0.651451|0.06250|rejected: search-max null not separated|
|v2-8e36d40daa77|2 canonical / [2, 3]|4|0.534579|0.314149|0.25000|rejected: search-max null not separated|
descriptor-shuffle: 31 fixed realizations; top-score range 0.000000–0.630467, median 0.000000; searched-family count range 0–1. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
rhythm-preserving: 31 fixed realizations; top-score range 0.000000–0.572841, median 0.000000; searched-family count range 0–1. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
timing-misalignment: 31 fixed realizations; top-score range 0.000000–0.736813, median 0.000000; searched-family count range 0–1. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
|Representation|Real top|Null max|Separated retained|Returns|
|---|---:|---:|---:|---:|
|v1-texture|0.863132|0.881679|0|199|
|without-chroma|0.700952|0.737841|0|9|
|without-hp|0.729969|0.761356|0|14|
Chroma and HP are supported only to the extent of this measured ablation separation; neither validates note pitch or foreground/source identity. Source UNKNOWN.

### need-a-bag
Audio `Need A Bag (REST100) Final.mp3`, duration 233.351837s; input SHA-256 `f7fc89b87881d5201a3830465a7d1680f63b9aee147e24221313c6c3c1a29548`; decoded PCM `1c1adb921434ee06df046e63cb5d158e313c9e8872c713b8a2a30c3aa8b68901`; mono 22050Hz.
Event density 4.988/s; canonical 2/3/4/5/6 distribution `{'2': 0, '3': 0, '4': 0, '5': 0, '6': 0}`. Total retained occurrences 0; gapped 0.
|Family|Length range|Returns|Prominence|Span|Search-max exceedance|Reason|
|---|---|---:|---:|---:|---:|---|
descriptor-shuffle: 31 fixed realizations; top-score range 0.000000–0.000000, median 0.000000; searched-family count range 0–0. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
rhythm-preserving: 31 fixed realizations; top-score range 0.000000–0.000000, median 0.000000; searched-family count range 0–0. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
timing-misalignment: 31 fixed realizations; top-score range 0.000000–0.670683, median 0.000000; searched-family count range 0–1. Full distributions include similarity, occurrence count and pre-timing eligibility, in the track JSON/local report.
|Representation|Real top|Null max|Separated retained|Returns|
|---|---:|---:|---:|---:|
|v1-texture|0.784310|0.860490|0|112|
|without-chroma|0.000000|0.670960|0|0|
|without-hp|0.000000|0.676201|0|0|
Chroma and HP are supported only to the extent of this measured ablation separation; neither validates note pitch or foreground/source identity. Source UNKNOWN.

## v1 comparison and ALLDAT three-event question
alldat: v1 972 events, 220 provisional gates, 12 display-capped families. v2 972 events, 220 internal gates, 1 retained families, 0 null-separated. Candidate count reduction alone is not proven false-family reduction: v2 search sampling/alignment/representation differ. Same-search ablations are the more controlled feature comparison.
cvb: v1 1893 events, 501 provisional gates, 12 display-capped families. v2 1893 events, 501 internal gates, 3 retained families, 0 null-separated. Candidate count reduction alone is not proven false-family reduction: v2 search sampling/alignment/representation differ. Same-search ablations are the more controlled feature comparison.
ALLDAT three-event candidates are reported only as blind numerical recurrence. If present, gapped matching improves tolerance; no source/perceptual correspondence or validated improvement is claimed without null separation. No subjective timestamps were used.

## Multiplicity, eligibility and coverage
The per-track plus-one maximum-surrogate screen covers all searched candidate families before display suppression, across three controls and 31 seeds. <=.05 is required. It is not a proven statistical FDR or calibrated probability. Search caps and surrogate exchangeability are evidence limitations. Exact rates, maxima and reasons are in each family JSON.
No live gameplay selection was generated. Coverage lists are empty if no research anchor family passes; that means no newly validated motif coverage claim is available, not that existing gameplay has zero coverage. External live baseline is N/A.

## Remaining gaps / integrity
Independent real onset truth/stems are absent. Synthetic failures, mixture/source ambiguity, weak null separation, finite surrogate resolution, sampled motif search, one-interior-gap limits and lack of human blind motif ground truth remain. Titles/lyrics/genre/artwork never guide computation. No compiler or Analyzer was invoked. v1, V9, Pulse Tap v2.3 and Pages remain unchanged; Stage1 labels and terminal holdout untouched. Private MP3s/PCM were neither copied into nor tracked by the repository.
Local five-song inspection: use README instructions and the explicit scratch input map with review-server.cjs; open http://127.0.0.1:8767/. REPORT.html embeds only derived numerical results. Audio routes bind loopback and read originals from explicit paths.
Additional timing evidence gap: TIMING_COORDINATE_NOTE.md records private MP3 media-duration versus analysis-PCM differences (~0.14–0.20s). This does not establish an onset offset; listening seeks are approximate and real time-coordinate mapping is unvalidated. No post-freeze correction was applied.

**STOP.** No integration, visuals, publishing private audio or next experiment.

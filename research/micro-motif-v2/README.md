# Trackcade Micro-Motif v2

Isolated upstream research. v1 remains D. No gameplay integration, visual work,
semantic evaluation, Analyzer invocation, production compiler or paid provider.
Song names are provenance/display metadata only. Source identity is UNKNOWN.

## Frozen method

The onset detector is a private copy of the frozen v1 numerical detector. Its
strength/transform agreement establishes internal stability, not true mix timing.
Independent generated onset truth covers ten polyphonic/envelope conditions, with
development seeds 1009/1013/1019 and disjoint validation 9001/9007/9011. Every class
must meet precision/recall .85, P95 <=20ms and absolute signed bias <=10ms before
any calibration-supported strict candidates are released. Real production-validated
timestamps remain zero even if this synthetic gate passes. Missing generated truth
and extra detections both count; matching tolerance is 50ms, not the strict target.

New descriptors measure positive pre/post-event band contrast over 0–23, 23–64,
64–122ms, relative to approximately -52 to -12ms. Temporal/frequency median soft
masks partition harmonic/percussive texture. They do not identify a source or
separate a proven foreground. Per-track robust band scaling limits persistent
accompaniment dominance. This is an investigation of event locality, not source
separation ground truth. Compare the same search and all null seeds with HP removed,
chroma removed and v1 mixture texture replacing the descriptors. Chroma is mixture
evidence; no note names or validated pitch contour is claimed.

The design builds on [spectral novelty](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C6/C6S1_NoveltySpectral.html),
[harmonic/percussive separation](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C8/C8S1_HPS-Application.html)
and [monotone sequence alignment](https://www.audiolabs-erlangen.de/resources/MIR/FMP/C3/C3S2_DTWbasic.html).
Our bounded matcher enumerates exact mappings or one interior insertion/deletion,
rather than unrestricted DTW. Endpoints remain observed, no missing time is invented.
Canonical lengths 2–6 match observed lengths 2–7. Normalized endpoint displacement
<=.13, tempo ratio .8–1.25, acoustic cosine >=.86, chroma >=.82, attack contour
deviation <=.22, cost <=.19; one gap costs .10. Minimum four nonoverlapping returns,
1s inter-occurrence separation. A pattern needs rhythmic/attack/acoustic contrast
>=.16: constant pure pulse alone is rejected. These fixed search constraints can
miss a true motif, including endpoint omissions and ornaments with more than one gap.

## Search multiplicity and controls

Computational scope is fixed uniform sampling of at most 384 target windows per
observed length and 16 seed windows per canonical length, duration .16–3s. Sampling
does not use a subjective target, song title, genre, lyric or external result.
It limits sensitivity; no exhaustive discovery claim is made. Top score is measured
over **all searched families before** duplicate suppression and the display cap 12.

Seeds 1729–1759 are fixed for each of three controls: global descriptor/strength
shuffle; within-32-event-block descriptor/timing shift; strength/density-stratified
descriptor shuffle retaining actual rhythm density. Every surrogate runs the same
search. Record top-score/similarity/occurrence/pre-timing-eligibility distributions.
For each seed take the maximum top score over all three controls. Family empirical
exceedance = (1 + number of seed maxima >= real score)/32. Require <=.05. This is
a conservative **per-track, search-max surrogate screen** accounting for searched
windows/families, not a calibrated p-value, posterior probability or proven FDR.
Exchangeability and independence of these musical surrogates are unproven. No
across-song inferential claim is licensed. With 31 seeds only zero exceedances pass.
Uniform synthetic pulse is an additional deterministic rejection test. Descriptor
shuffles can retain broad musical organization: that conservative null is reported,
never rerolled to favor real data.

Research anchor eligibility additionally needs the calibration gate, >=4 internally
stable occurrences, score >=.55, song span >=.15, and all observed spacings >=180ms.
`trustedMicroEventTime` remains false because real independent timing truth is absent.
Even a research anchor is not automatic production approval. Meaningful non-Drop
musical events remain eligible for later independent gameplay mapping. Future anchors
may use reduced/partial/full/expanded representations; no current gameplay changes.

## Blind freeze and privacy

PREFLIGHT.json freezes code hashes, configuration, seeds, decision rules and calibration
before any private audio bytes are read. The committed preflight is verified before
each external decode and analysis. Scratch exclusive-create decode/analysis attempt
locks enforce one run per supplied private input; a failure consumes the attempt.
The same method and ablations run for every song. No post-external parameter changes.

Private originals and PCM remain outside the Git checkout. Only hashes, timestamps,
aggregate descriptors/scores and derived summaries are committed. No lyrics, audio
bytes, clips or reconstructed audio are published. Chrome WebAudio decodes explicit
local paths to mono float32 22050Hz with no trim or beat snapping. Development songs
reuse hash-verified v1 PCM. External beat annotations are explicitly an exploratory
autocorrelation pulse proxy: they are not a trusted analyzer grid, and are not used
to decide motif matches. No live baseline is created for the external songs.

## Local review

Run `node research/micro-motif-v2/review-server.cjs <absolute-local-input-map.json>`
from the checkout. The map has `records` with `id` and absolute `audioPath` fields;
it stays outside Git. Open `http://127.0.0.1:8767/`. The report contains no embedded
audio or private paths; loopback-only allowlisted routes resolve the supplied originals.
Each retained family exposes accepted/rejected status, event times, spacing, bounded
alignment and listening buttons. Null examples are numerical shuffled descriptors,
not audio; listening to the original at their timestamps would misrepresent them.

Classification is frozen after all five results: A only when both specificity and
timing support controlled research integration; B timing only; C specificity only;
D both inadequate or external failure; E development succeeds but externals fail.
No automatic integration even for A. STOP after this experiment.

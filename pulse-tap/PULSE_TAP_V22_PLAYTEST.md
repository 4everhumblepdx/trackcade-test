# Pulse Tap v2.2 — verified evidence, selection and impact contract

Continues clean v2.1 `1229ce87e82af6a6bc53b2a4bc29ad0e316b5756` on
`trackcade-semantic-external-holdout-v1`. Historical experimental records remain unchanged.

## Evidence inventory completed before Interpreter changes

Recovered the existing product-fixture objective analyses, run **36280612767**,
artifact **10918484114**, ZIP SHA-256
`6d494c7c3ac9e7d0096833c67f13c102a67b104b8e8eb7c99fd1b5f5906e0682`.
Read only `analysis/alldat-v019.json` and `analysis/cvb-gemf-v019.json`;
did not open the authored-fixture audit. Also recovered Structure Evidence v1,
run **36281298997**, artifact **10919375182**, ZIP SHA-256
`3d4364ab01ee51b4b244f0033aeb5ca598393164e805c6149d4f25c37d9805fc`.
Both exact analysis hashes match the earlier frozen workflow and structure evidence.
No analysis was executed. See `PULSE_TAP_V22_EVIDENCE_INVENTORY.json` for field names,
confidence/diagnostics, identities, counts and explicit absences.

| Frozen objective evidence | ALLDAT | CVB G.E.M.F. |
|---|---:|---:|
| Exact legal beats / per-beat evidence | 590 | 812 |
| Generic onsets/transients | 1,141 | 2,447 |
| Engine-facing interaction candidates (not direct gameplay commands) | 312 | 589 |
| Energy samples and exact sample times | 240 | 240 |
| Sections / internal boundaries | 14 / 13 | 8 / 7 |
| Objective landmark times and intensities | 24 | 26 |
| Low-demand windows | 2 | 2 |
| Tempo-map segments / descriptive tempo-curve points | 1 / 148 | 5 / 204 |
| Region-local meter-map entries | 0 | 0 |
| Strict onset anchors | 0 | 0 |

Raw per-beat records contain strength, confidence, salience, interaction score,
and, where present, generic attackTime/attackOffsetMs. Onset records contain time,
strength, confidence, beat relation, interaction score and recommended half-window.
These are mixed-audio transient/attack evidence, not instrument or vocal identity.
Rhythmic evidence includes pulse/tactus alternatives and a conservative meter summary.
Sections contain energy/activity/confidence; timing and structure diagnostics are frozen.
No exported spectral-novelty time series, note identities, instrument attacks identified
by source, stem classification, vocal activity, vocal-specific onsets/intensity/salience,
or vocal phrase boundaries exist in these two raw analyses. Structural detection uses
timbre/novelty according to its frozen assumptions; that does not make a novelty series
available to the game.

Vocal classification: **generic onset/transient evidence may capture vocals but cannot
reliably identify them** (category 2). Vocal-specific action evidence is absent.
A mixed-audio onset can improve a legal beat choice regardless of whether its source is
a voice, drum or instrument; no vocal source is invented or excluded by semantic kind.

Off-beat onset/attack timestamps exist, but both songs are `loose`, strict scoring is
disallowed and every onset has `strictTimingCandidate=false`. This task conservatively
adds **zero** micro-event timing positions. Fine-grained/vocal gameplay remains limited
by source identity and timing trust; no new Analyzer experiment is authorized here.

## Selection

`action.js` evaluates evidence at **musicalImpactTime**, never at appearance time.
The bounded total is the sum of: beat strength × confidence (weight .30), nearest
onset strength × confidence × proximity (.30), nearest landmark intensity × proximity
(.15), energy (.08), positive rise over 1.5 seconds (.06), absolute before/after energy
contrast (.06), section proximity (.05), and low-demand penalty (-.20), clamped to [0,1].
Onset proximity falls to zero within min(.18 seconds, .45 beat interval); landmark and
section proximity fall to zero within max(.4 seconds, two beat intervals). Energy uses
the existing exact sample-time lookup. These weights are deterministic design choices,
not a calibrated probability of musical salience. Missing evidence contributes zero.

Difficulty establishes a target quota per local four-beat window, split at stage changes.
Selection maximizes evidence within that quota, with .035 displacement penalty per
source beat from the established pattern. A bounded state search carries trailing burst
length across windows to keep at most five consecutive beats. It does not move targets
between windows or globally sort events. Index 15 remains a readable block gap outside
the protected tutorial/landing. All-low-demand windows cap the quota at one action.
Tutorial safety, ending safety, local quotas and continuity may retain weaker targets.
No Analyzer semantic labels are consumed as commands. Meaningful non-Drop musical events
remain eligible through their objective evidence.

Tutorial is **6 seconds**, then build begins immediately. Mid-hard push stays 50–63%,
relief 63–72%, rebuild 72–82%, climax 82–94%, landing 94–100%. Climax has the highest
action rate on both tracks; its target count is unchanged (ALLDAT 56, CVB 78), radius
changes only 29→28 pixels, travel cap 250→255 pixels, timing window remains ±.23 seconds.
No arbitrary late-song score multiplier. CVB's frozen low-demand passage reduces rebuild
actions (57→42); its rebuild still exceeds relief in action rate, then rises to climax.

Landing retains **all exact v2.1 selections**, boundaries, windows, radii, lead, spread
and travel rules: ALLDAT 8 targets, CVB 11. The shared incoming/impact presentation and
precision reward changes apply there too. Route rules are unchanged; earlier selection
changes can change the route's serial position and entry position.
`ending.js` and `timing.js` are byte-identical to the starting commit.
ALLDAT ends at **190.357 seconds**; CVB falls back to decoded **309.420408 seconds**.
Last target remains 188.855 / 306.629 seconds. No inputs, new targets or effects after
playable ending; explicit replay still resets the run.

## Comparison and limits

`PULSE_TAP_V22_COMPARISON.json` contains exact old-only/new-only choices, missed strong
evidence and continuity-retained weak choices. `test-baseline-v21.cjs` is the frozen
v2.1 comparison fixture, never a runtime path.

| Metric | ALLDAT | CVB |
|---|---:|---:|
| Selected v2.1 → v2.2 | 282 → 283 | 401 → 389 |
| Unchanged | 217 | 294 |
| v2.1-only / v2.2-only | 65 / 66 | 107 / 95 |
| Mean selected / skipped salience | .196766 / .119097 | .203431 / .141610 |
| v2.1 selections evaluated with same salience | .165243 | .168105 |
| Selected within .5 seconds of an objective landmark | 51 | 49 |
| Missed strong candidates (total ≥.50) | 1 | 0 |
| Weak (<.20) retained for continuity/both | 143 | 186 |
| Weak selected by salience among local alternatives | 21 | 30 |

The one strong missed ALLDAT beat is source #539 at 179.224 seconds, total .520622,
inside the preserved landing. It is intentionally left unchanged. Weak retained counts
include rhythm/displacement tradeoffs and protected stages, not a proof that each weak
target is uniquely necessary. Selection means are affected by the earlier difficulty
ramp and low-demand quotas. Better objective evidence does **not** prove subjective fun.

## Musical impact, scoring and device diagnosis

v2.1 used .54–.82 seconds lead (about 1.6–2.5 median ALLDAT beats). The timestamp was
already the judgement center and ring completion, but appearance had a strong core,
stroke and bright dot. Appearance could coincide with a different earlier sound.
v2.2 explicitly stores preparation start/lead and musical impact; preparation is faded,
the ring closes exactly to core radius at impact and the stroke resolves strongly then.
Rendering shows that state on the first available frame at/after impact. Frame delay
is recorded; no claim of zero physical display latency is made.

The selected legal source time = impact = zero hit delta = PERFECT center = maximum
timing score (120 before existing combo multiplier). PERFECT/GREAT/GOOD cutoffs remain
30%/65%/100% of the existing generous window. Each band now decreases continuously
by up to 15 base points with increasing error, with monotonic downward band transitions.
Final integer rounding can tie very close hits; smaller error never scores worse under
the same combo/conditions. Generous windows are retained; no physical-latency offset is
introduced. Completion bonus and combo rules remain unchanged.

Diagnosis A: supported in a bounded sense—v2.1 ignored existing beat/onset/landmark
selection evidence. B: partly supported—generic micro-events exist, but trusted strict
off-beat anchors and vocal/source identity do not. C: plausible from code and the user's
observation; preparation was visually strong, although source/impact timing was aligned.
D: unmeasured; desktop/emulated tests cannot establish a stable physical phone offset.

The game uses HTMLMediaElement.currentTime and Phaser frames. HTML's media time does
not expose a speaker-to-display latency measurement. Web Audio's outputLatency and
getOutputTimestamp concern an AudioContext graph, not this unchanged direct media
element route. No new audio route or assumed Safari/Chrome correction was added.
References: [HTML media timing](https://html.spec.whatwg.org/multipage/media.html#dom-media-currenttime),
[Web Audio output latency](https://www.w3.org/TR/webaudio/#dom-audiocontext-outputlatency).
Physical iPhone Safari/Android Chrome latency has **not** been newly measured.

Debug shows preparation, impact, audio time, source index, evidence total, selection
reason and hit precision. `pulseTapDebug.snapshot()`, `.candidates(time, span)` and
`.hits()` expose component contributions, nearest landmark/onset and distance/intensity,
energy/delta/contrast, sections, low-demand state, nearby skipped candidates/reasons,
actual presentation/impact frame/hit times, bounded frame cadence and device metadata.
Output/display latency remain explicitly null and applied offset remains 0.
For physical testing compare speaker and wired/Bluetooth routes, record device/browser,
capture visible impact against audio and inspect repeated signed hit errors; these errors
also contain player/source effects and must not automatically become calibration offsets.

## Validation and continuation

72 deterministic tests pass (40 v2.2-specific plus 32 existing/adapted tests), zero fail.
Browser evidence in the receipt covers actual MP3 playback, pause/resume, precise-impact
geometry and scoring, full 60fps Phaser timelines, ending/input cleanup, explicit replay,
normal mode and two portrait touch emulations. This is not a new physical phone playtest.
Hosted verification is recorded separately after publication. Run deterministic checks:

```
node --test pulse-tap/test-timing.cjs pulse-tap/test-ending.cjs pulse-tap/test-difficulty.cjs pulse-tap/test-v22.cjs
node pulse-tap/compare-v22.cjs
```

Frozen projection regeneration uses `freeze-action-evidence-v22.py --frozen-source-dir`
with the verified saved product/structure ZIPs and allowlisted extracted objective files;
it performs no network, Analyzer or compiler execution.

Provider calls **0**, spend **$0**. Source music timestamps/manifests unchanged.
No Analyzer invocation/modification, compiler invocation, semantic V9 change, V10,
Stage1 labels, terminal holdout, by-ear timestamp tuning, Hop or another engine.
Publish only the existing safe Pages game assets. Stop after verification; physical
playtesting is the next source of product feedback, not an automatic Analyzer experiment.

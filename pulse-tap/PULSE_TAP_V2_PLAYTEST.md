# Pulse Tap v2: progression before musical-placement investigation

Source branch HEAD at task start: `1a0f42c442ebd433c99f3ff47ce268b88603f03f`. The 590 frozen ALLDAT beats, continuous energy, generic sections, source provenance, and existing audio are unchanged. This is gameplay pacing, not an Analyzer or semantic experiment.

## Phone play

Normal: https://4everhumblepdx.github.io/trackcade-test/pulse-tap/v2/

Debug: https://4everhumblepdx.github.io/trackcade-test/pulse-tap/v2/?debug=1

ALLDAT loads by default; no query parameter is needed. Tap to start and tap the circle as the ring closes. The lower-right 56 px pause button pauses/resumes. After completion, tap to reset, then tap to start again. Use normal mode to judge feel. Portrait, one finger, no landscape or multi-touch requirement. The page prevents scrolling/gesture zoom and uses viewport safe-area insets for controls and reachable target placement.

The public deployment uses the existing GitHub Pages site with six added static assets in a separate `pulse-tap/v2/` directory on its `main` source. Runtime helpers are copied exactly from the working branch; manifest deployment changes only relative audio URLs to `../../` for existing root MP3s. Those audio blobs match the working branch. No domain, tunnel, firewall change, paid service, provider credential, or new workflow is needed.

## Difficulty contract

Progress is source beat time divided by frozen song duration. Energy is a bounded selector modifier: below 0.25 permits simpler later patterns; at least 0.65 permits an extra developing pair. It cannot replace a progress stage or create hard opening play. Patterns vary deterministically across 16-beat blocks. Indices 0–3 are a teaching lead-in; the first selected ALLDAT beat is an existing beat at 1.549 s.

| Stage | Progress | Selected targets | Typical selection | Window | Visible / hit radius | Maximum travel | Visual lead |
|---|---|---:|---|---|---|---|---|
| Opening | 0–12% | 17 | Every fourth beat | ±0.36 s | 44 / 54 px | 86 px | 0.82 s |
| Early | 12–30% | 33 | Quarter-rate and half-rate blocks | ±0.34 s | 42 / 52 px | 122 px | 0.75 s |
| Developing | 30–55% | 76 | Mostly alternate beats; bounded high-energy pair | ±0.30 s | 38 / 48 px | 165 px | 0.65 s |
| Hard | 55–80% | 92 | Alternate beats plus pairs; simpler at low energy | ±0.27 s | 34 / 44 px | 210 px | 0.60 s |
| Finale | 80–100% | 84 | Frequent pairs and short bursts | ±0.24 s | 30 / 40 px | 245 px | 0.55 s |

Total: **302 selected targets from 590 legal source positions**. Actual stage densities are about 24%, 31%, 51%, 63%, 71%. Average gaps: 1.328, 1.079, 0.646, 0.529, 0.464 seconds. Minimum gaps: 1.328, 0.664, 0.332, 0.332, 0.332 seconds. Exact values are in `ALLDAT_V2_PROGRESSION_SUMMARY.json`.

Routes are deterministic and bounded inside a central reachable field; adjacent beats closer than 0.4 s additionally cap travel at 110 px. Bursts are separated by omitted original beats. Target-time windows/radii are frozen when each selected target is created. Perfect and Great thresholds scale with that target's allowed window (30% and 65%); Good extends to its full window. Visual lead changes when an animation begins, never its music target timestamp. Late frames skip expired opportunities rather than creating a backlog. No timing-latency correction or musical-place inference is introduced.

Debug shows progress, stage, beat index, whether the upcoming source beat is selected, nominal block density, window, visible radius, max travel, energy, target/audio time, and signed hit delta. The normal page has no debug overlay.

## Tests and limits

Run `node --test pulse-tap/test-timing.cjs pulse-tap/test-difficulty.cjs`: 22 deterministic tests cover exact source membership, reproducibility, stage density, opening protection, later bursts, travel/phone bounds, timing/radius progression, energy bounds, full timelines, duplicate prevention, and BPM fallback. Legacy `timing.js` defaults still reproduce the original exact-grid scheduler. Pulse Tap v2 passes a separate bounded visual-lead function and selects a subset afterward.

The optional `test-browser.cjs` uses an existing Playwright/browser installation and the local server. `PULSE_BASE_URL` can point to the HTTPS deployment; `PLAYWRIGHT_BROWSER`, `NODE_PATH`, and `PULSE_SMOKE_OUTPUT` configure existing dependencies and output paths. It checks both complete simulated Phaser timelines, real audio loading/playback, ending after seek, replay, default normal ALLDAT, and touch hits/pause/resume at 375×667 and 360×740. This is Chromium touch emulation, not physical iPhone Safari/Android testing; Nicholas's phone play remains necessary. HTML Audio starts from the initial touch, safe-area CSS is used, and controls need one touch. No subjective synchronization or musical correctness is inferred.

## Recorded observation: do not fix yet

Nicholas reported that during ALLDAT some generated actions did not feel aligned with the most obvious musical note/accent, while obvious notes/accents sometimes received no action. Classification: **future gameplay-interpreter / salient-action-selection investigation**. The first test also began too hard and used a laptop mousepad for touch-oriented targeting. This v2 change isolates pacing and phone playability. No hand judgments about ALLDAT notes are used to choose beats, and no salient-note fix is attempted.

Provider calls 0; spend $0. No Analyzer, compiler, reference labels, terminal holdout, semantic/V9 changes, or new engine. Stop after the verified phone URLs are delivered.

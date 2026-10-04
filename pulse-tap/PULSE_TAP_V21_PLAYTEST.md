# Pulse Tap v2.1: two scoring peaks and a musical-ending boundary

Task start: clean experiment branch `604d6cd81b61279d3db27c8353c6df21527eee31`. This is an engine/game-design change only. The complete frozen ALLDAT and CVB manifests remain byte-identical. Historical v1/v2 receipts and summaries remain unchanged.

Nicholas's physical-phone v2 playtest was pretty good for most of ALLDAT, with substantially improved progression and more suitable controls than laptop/mousepad play. He reported continued actions after the audible ending and requested two scoring peaks followed by resolution. Musical/action placement still needs a **future salient-action / Gameplay Interpreter investigation**: some actions missed obvious notes/accents and some obvious accents received no action; G.E.M.F. appeared somewhat better than ALLDAT. Those observations are recorded only. No note-specific action adjustment is made here.

## Ending rule and provenance

Recovered immutable Structure v1 safe manifests provide continuous energy, sample times, and legal beats, but no preserved terminal-silence decision. `ending.js` therefore uses only those frozen objective fields. It requires valid energy/time arrays, an explicit beat grid, and samples covering the actual terminal duration (at most 1.5 median sample intervals uncovered).

The threshold is `min(0.10, 0.15 * 90th-percentile energy)`. A qualifying low-energy run must be the **entire final suffix** with no later recovery, have at least four samples spanning at least `max(2.5 seconds, two median sample intervals)`, and begin within the final 15% of the raw duration. The 90th-percentile activity must be at least 0.30, and at least two samples in the preceding eight seconds must exceed three times the low-energy threshold. Beat coverage must support the boundary. Missing, malformed, sparse, weak-contrast, or nonterminal evidence falls back to actual audio duration (declared duration only until metadata loads). This is a conservative gameplay heuristic, not a claim that energy precisely measures an acoustic last note.

ALLDAT: declared raw duration **196.075102 s**, decoded browser duration **196.075100 s**. Its terminal suffix starts at the exact frozen sample time **190.357 s**, with seven samples at or below 0.10 through 195.259 s, spanning **4.902 s**. The preceding active region supplies eight contrasting samples. This sets `playableEndTime=190.357` without a track-specific timestamp in the rule. Temporary quiet passages that recover are not terminal suffixes.

CVB: only the last sample qualifies at the threshold; the suffix is not sustained. It safely retains **309.420408 s** actual duration. Its final target is **306.629 s**, leaving **2.791408 s** of resolution.

## No actions after the ending

The runtime checks the playable boundary before scheduling, visual updates, or miss processing. Target creation, hit input, and feedback independently reject timestamps at or beyond the ending, including input arriving before the next render frame. Finishing clears targets, transient feedback, and tweens. Ordinary post-ending taps cannot change score/combo, produce feedback, spawn targets, or restart play. A separate **REPLAY** control explicitly resets a new run, then a start tap starts it. Audio may finish its low-demand tail after the gameplay boundary.

Each selected target must have its full hit window before the ending and its timestamp at least `clamp(4 * median beat interval, 1.25, 2.5)` seconds before it. ALLDAT's minimum center-to-ending release is 1.328 s. The final selected target is the exact source beat **188.855 s**: actual release **1.502 s**, with its ±0.34 s window ending at 189.195 s. No selected timestamp is shifted or synthesized.

## Designed arc (progress is relative to playable end)

| Stage | Progress | ALLDAT targets | Beat density | Targets/s | Window | Visible radius | Max travel |
|---|---|---:|---:|---:|---|---|---|
| Opening | 0–12% | 17 | 24.6% | 0.744 | ±0.36 s | 44 px | 86 px |
| Build | 12–32% | 34 | 29.8% | 0.893 | ±0.34→0.32 s | 42→40 px | 110→145 px |
| Developing | 32–50% | 53 | 51.5% | 1.547 | ±0.31→0.29 s | 38→36 px | 160→190 px |
| Mid Hard Push | 50–63% | 47 | 62.7% | 1.899 | ±0.27 s | 34 px | 210 px |
| Relief | 63–72% | 26 | 50.0% | 1.518 | ±0.30 s | 38 px | 170 px |
| Final Build | 72–82% | 41 | 71.9% | 2.154 | ±0.28→0.25 s | 35→31 px | 205→240 px |
| Final Climax | 82–94% | 56 | 81.2% | 2.452 | ±0.23 s | 29 px | 250 px |
| Landing | 94–100% | 8 | 23.5% | 0.700 | ±0.34 s | 42 px | 110 px |

Total **282 targets from 590 unchanged legal beats**. Full average/minimum intervals and both fixture summaries are in `PULSE_TAP_V21_DIFFICULTY_SUMMARY.json`.

The first hard plateau is after the midpoint (50–63%, centered at 56.5%). Relief remains above the early Build's density, with smaller targets and tighter windows than Build. Final Build increases challenge again, and its later portion exceeds the earlier plateau. Final Climax dominates all other stages in action rate, density, smaller circles, tighter timing, and maximum travel. Landing starts at 94%, approximately 178.936 s for ALLDAT, and releases challenge for about 11.421 s before completion.

Patterns vary deterministically across blocks. Final Climax allows at most five consecutive selected source beats in short bursts separated by gaps; travel on adjacent beats closer than 0.4 s is capped at 110 px. Energy only chooses bounded patterns within the stage; it never creates early climax difficulty. Normal scoring/combo mechanics and the existing completion bonus are retained. No time-based score multiplier or new late-song bonus is added. Final Climax offers 56 opportunities / 6,720 base Perfect points before combo, compared with 47 / 5,640 in Mid Hard Push; its scoring opportunity comes from actions and maintained combo.

## Play and verify

Normal phone URL: https://4everhumblepdx.github.io/trackcade-test/pulse-tap/v2/?v=2.1

Debug URL: https://4everhumblepdx.github.io/trackcade-test/pulse-tap/v2/?v=2.1&debug=1

The same public v2 path now serves v2.1. ALLDAT remains the default. Portrait, one-touch play, safe-area controls, reachable targets, pause/resume and replay are retained. Debug adds raw duration, playable end, remaining time, detector source/reason, playable progress, stage, density, window/radius/travel, energy, original beat index/selected state, target/audio times and hit delta. Normal mode has no debug clutter.

Deterministic checks: `node --test pulse-tap/test-timing.cjs pulse-tap/test-difficulty.cjs pulse-tap/test-ending.cjs` (32 tests). Browser checks: `test-browser.cjs` with an existing Playwright/browser installation, local server or `PULSE_BASE_URL` set to public HTTPS. They test exact full runtime plans, completion at the playable boundary, clearing an injected live target, input blocked before the finish frame and afterward, ordinary taps after completion, explicit replay, real audio/pause/resume, and portrait touch at two sizes. Simulated clocks verify complete timelines; they do not make subjective musical judgments or substitute for physical-device testing.

Provider calls 0, spend $0. No Analyzer, compiler, semantic/V9 changes, Stage1 labels, terminal holdout, new engine or Gameplay Interpreter work. Stop after the verified public URLs are delivered.

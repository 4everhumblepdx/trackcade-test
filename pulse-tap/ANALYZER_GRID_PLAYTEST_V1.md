# Pulse Tap: first analyzer-grid playtest

This integration starts from clean branch commit `62b649ed6e90fc97096d0cc138a6c7f3ad5ac1c3`. It reuses frozen Structure v1 safe manifests; it does not regenerate musical facts or modify V9. Musical feel has not been judged automatically: Nicholas plays the actual songs next.

## Play locally

From the repository root, run `node pulse-tap/serve-local.cjs`. The server binds only to localhost, serves only the playtest folder and the two existing MP3s, and supports audio seeking. Stop it with Ctrl+C. An existing Phaser 3.90 CDN script needs internet access; no provider credential or provider request is involved.

| Song | Normal play | Timing debug |
|---|---|---|
| CVB — G.E.M.F. Sample | http://127.0.0.1:8765/pulse-tap/?track=./cvb-analyzer-test.json | http://127.0.0.1:8765/pulse-tap/?track=./cvb-analyzer-test.json&debug=1 |
| Forever Humble PDX — ALLDAT | http://127.0.0.1:8765/pulse-tap/?track=./alldat-analyzer-test.json | http://127.0.0.1:8765/pulse-tap/?track=./alldat-analyzer-test.json&debug=1 |

Judge feel in normal mode. Tap to start, tap a target as its ring closes, use the lower-right pause button, and tap after completion to reset for replay; tap again to start.

## Frozen inputs and adaptation

Source run `36281039225`, artifact `10918329894`, archive SHA-256 `4a1ab80859fdc9b02df7e18254bb0420bdbbd3d3540911963870a1d940994851` were recovered and verified. Analyzer v0.19 source is `e308d867980fb1877c3f2e4ce27950deecac0855`; runner SHA-256 is `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`.

| Fixture | Beat count | Generic sections | Energy samples | First / last beat | Declared duration |
|---|---:|---:|---:|---|---:|
| CVB | 812 | 8 | 240 | 0.289 / 309.253 s | 309.420408 s |
| ALLDAT | 590 | 14 | 240 | 0.221 / 195.829 s | 196.075102 s |

Both timing tiers remain `loose`. Integration manifests preserve every source event, continuous energy sample, energy sample timestamp, BPM, offset, duration, generation record, palette, and art identity. Only the relative audio URL and isolated high-score key are adapted, with added source provenance. Historical manifests remain unchanged. Both fixtures contain zero automatic Drop, Peak, or discrete Energy commands.

Two or more valid numeric nonnegative beat entries select `explicit-beat-grid`. Scheduling uses the exact timestamps, sorted in time; coincident entries create one opportunity. Variable intervals affect only bounded visual lead (0.08–0.62 s), never musical timestamps. Delayed frames consume expired opportunities once instead of creating a backlog. Continuous energy adjusts visuals; generic sections alternate the grid palette and show numbered passages. Semantic classification and gameplay actionability remain separate; no Drop label is required for these beat opportunities or passage changes.

With fewer than two valid beat entries, `bpm-fallback` retains the legacy BPM clamp of 40–240, default 120, and initial timestamp `max(beatOffset, 0.6)`. Both paths stop at audio duration. Existing legacy Drop accents affect presentation only; they no longer add off-grid targets.

## Verification

Run `node --test pulse-tap/test-timing.cjs`: 12 tests cover exact fixture timestamps/counts, deliberately conflicting BPM/offset, complete 60 fps scheduling, duplicate prevention, delayed frames, variable spacing, fallback, track boundaries, zero energy, and generic sections.

Optional browser smoke: start the local server and run `node pulse-tap/test-browser.cjs` using an existing Playwright installation. Set `PLAYWRIGHT_BROWSER` to an installed browser executable when its managed Chromium is unavailable; `NODE_PATH` may point to an existing module directory. `PULSE_SMOKE_OUTPUT` selects an output folder (default: the system temporary folder).

Browser checks load and briefly play both actual MP3s, verify pause/resume, seek to natural endings, verify completion and replay reset, and check that normal mode exposes no debug object. Separate full-song Phaser simulations replace only the test audio clock and tween delta at 60 fps, verifying all opportunities, bounded targets, cleanup, and completion. These simulations do not assert subjective synchronization. The receipt records results and decoded durations; ALLDAT's decoded duration differs from its declared duration by approximately two microseconds.

## Nicholas's playtest

Report: tap/music synchronization; sensible pulse points; off-grid stretches; density and fatigue; connection to the song; energy visuals; passage variation; dead stretches; ending alignment; and whether Pulse Tap is fun enough to develop further. Include the song and approximate timestamp for any issue. No subjective answers are assumed here.

Provider calls: 0. Spend: $0. Analyzer and compiler were not invoked. Stage1 reference labels and terminal holdout were not accessed. Stop after this integration delivery; no Hop or new semantic experiment is staged.

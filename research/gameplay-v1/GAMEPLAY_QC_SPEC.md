# Trackcade Gameplay / Difficulty v1 — QC Foundation

Status: **diagnostic first; no gameplay tuning change authorized yet**

## Frozen upstream dependency

Gameplay v1 starts from the closed Structure v1 automatic pipeline.

The safe baseline already provides:

- exact v0.19 authored beat events;
- v0.19 energy curve;
- generic section events;
- no automatic `drop`, `peak`, or discrete `energy` commands;
- `standard` or `loose` timing only;
- Trackcade loader fallback physics/tuning when upload metadata is minimal.

Do not reopen Analyzer timing or Structure v1 unless gameplay evidence proves a concrete upstream defect.

## Existing runtime behavior under study

The current game:

- spawns an obstacle row on every `spawnRowEveryBeats`-th authored beat;
- uses `Difficulty.spawnIntensity(elapsedSec, songTime)` to drive row density/type;
- blends speed-derived difficulty 50/50 with the song energy curve;
- uses deterministic `RowGenerator` seeds;
- guarantees every individual row has at least one obstacle-free or jumpable lane;
- spawns rows at world depth `VIEW_Z = 560`;
- rider collision depth is `PLAYER_Z = 26`;
- obstacle pool size is 28;
- pickup pool size is 24;
- default lane switch time is 0.12 s per lane;
- default jump duration is 0.58 s.

A per-row survivability guarantee is not by itself a whole-song guarantee. Consecutive rows can still theoretically demand maneuvers faster than the player can execute, and pools can theoretically saturate when beat cadence is dense.

## Diagnostic questions

For each generated safe manifest:

1. How many authored beat events and spawned rows exist?
2. What is the minimum / p1 / p5 / median beat interval?
3. At each spawn time, what speed and spawn intensity are used?
4. When does each spawned row actually reach `PLAYER_Z` under the deterministic speed ramp?
5. What is the minimum / p1 / p5 / median row-arrival gap?
6. Is there a complete **lane-only** path through every obstacle row without jumping, while respecting `laneSwitchTime` between row collision times?
7. What is the minimum maneuver slack along the best lane-only path?
8. What is the maximum simultaneous obstacle-pool demand before objects pass behind the player?
9. What is the maximum simultaneous pickup-pool demand?
10. Would current fixed pool sizes silently drop generated objects?

## Conservative lane-only proof

For QC v1, treat **every obstacle lane as blocked**, including low obstacles that could actually be jumped.

At each row collision time:

- safe lanes are lanes with no obstacle in that row;
- a transition from previous safe lane `a` to next safe lane `b` is allowed only if:
  `abs(a-b) * laneSwitchTime <= collision_time_gap`;
- the first row may be entered from the player's initial center lane using the full pre-collision lead time.

If a path exists under this conservative rule, the song is physically survivable without requiring jump timing at all. That is stronger than the runtime's existing per-row guarantee.

If the lane-only proof fails, that does **not** immediately mean the game is impossible: low obstacles and jumping may rescue it. Such a song is classified `needs_jump_aware_analysis` rather than failed.

## Reaction-window metrics

Obstacle rows are visible from spawn until collision. QC records:

- spawn-to-collision lead time;
- row-to-row collision gap;
- lane transition requirement;
- lane transition slack.

This is more useful than BPM alone because authored v0.19 beat grids may be nonuniform and speed changes through the song.

## Pool-demand model

Runtime object pools silently refuse a spawn when no dead object is available. QC must therefore model lifetime from spawn until the object passes the runtime cull point (`z < -30`).

For the safe baseline:

- obstacles use the real deterministic row generator;
- pickups use the real deterministic row generator;
- no peak spiral is present;
- no overdrive semantic events are present.

A later semantic-gameplay QC pass can extend the model to peak spirals and overdrive.

## Initial pass criteria

These are diagnostic product gates, not music-analysis benchmark claims.

Safe baseline is `qc_pass` only when:

- every generated row is individually `rowIsSurvivable`;
- a conservative lane-only full-song path exists;
- obstacle-pool demand <= 28;
- pickup-pool demand <= 24;
- no nonfinite timing/speed/intensity value appears;
- row collision times are strictly increasing.

Otherwise:

- `needs_jump_aware_analysis` when only lane-only path proof fails;
- `pool_overflow_risk` when pool demand exceeds runtime capacity;
- `invalid_generation` for nonfinite/ordering/integrity failures.

Do not tune speed, beat skipping, jump time, or spawn cadence merely to make a fixture green. Measure first.

## First fixtures

Use the exact safe automatic manifests already produced by Structure v1 for:

- ALLDAT
- CVB — G.E.M.F.

Then include the built-in fallback demo as a runtime reference.

The two product tracks are diagnostics, not a general benchmark. Broader audio/gameplay coverage comes after the simulator is trusted.

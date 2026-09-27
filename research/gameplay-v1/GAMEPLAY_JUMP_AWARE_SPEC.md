# Trackcade Gameplay v1 — Jump-Aware Reachability Specification

Status: **preregistered before jump-aware results**

Purpose: resolve only the conservative lane-only uncertainty exposed by the frozen Gameplay v1 tuning-stress experiment. This experiment does not retune gameplay, change Analyzer v0.19, alter Structure v1 music facts, increase pools, or reinterpret pool-overflow failures.

## Frozen provenance

Use the exact Structure v1 safe-manifest artifact from run `36281637484`, artifact `10918568524`, digest `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`.

Production Analyzer remains v0.19:

- release branch: `release/analyzer-v0.19`
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

The closed v0.20 phase-context research explicitly did not promote a replacement.

## Frozen fixtures

Use the same two product timing fixtures as the preregistered tuning stress:

- ALLDAT minimal safe baseline
- CVB G.E.M.F. safe music facts with optional legacy/custom tuning stripped before validation

Do not change beat grids, safe section events, energy curves, song lengths, or generation metadata.

## Frozen profiles

Primary unresolved profiles from the already-completed stress matrix:

| ID | Overrides |
| --- | --- |
| `lane-0.20` | `laneSwitchTime=0.20` |
| `lane-0.24` | `laneSwitchTime=0.24` |
| `fast-dense-tight-lanes` | `baseSpeed=160`, `maxSpeed=500`, `speedRampPerSec=2.0`, `laneSwitchTime=0.20`, `spawnRowEveryBeats=1` |

Reference controls:

| ID | Overrides | Prior result |
| --- | --- | --- |
| `default` | none | lane-only pass on both fixtures |
| `lane-0.16` | `laneSwitchTime=0.16` | lane-only pass on both fixtures; ALLDAT margin nearly zero |

No profile value may be changed after jump-aware results are observed.

## Runtime facts that define the proof

The proof must match these current runtime semantics:

- `VIEW_Z = 560`
- `PLAYER_Z = 26`
- `HIT_DEPTH = 10`
- an obstacle is collision-active while `abs(o.z - PLAYER_Z) < HIT_DEPTH`
- lateral collision threshold is `abs(player.x - o.lane) < 0.42`
- a `wall` obstacle is never jump-clearable
- a `low` obstacle clears only while `player.jumpOffset > 20`
- jump trajectory while airborne is `sin(pi * jumpT / jumpTime) * jumpHeight`
- a new jump may start only when grounded
- steering remains enabled while airborne
- lane motion is continuous at one lane per `laneSwitchTime` seconds

For minimal/default product manifests the fallback vertical parameters are frozen at:

- `jumpTime = 0.58`
- `jumpHeight = 46`

## Collision windows

Do not approximate row collision occupancy with a fixed number of milliseconds. Reuse the same speed/distance integration semantics as the existing whole-song auditor.

For a row spawned at time `t`, compute:

- collision entry after traveling `VIEW_Z - (PLAYER_Z + HIT_DEPTH)`
- collision center after traveling `VIEW_Z - PLAYER_Z`
- collision exit after traveling `VIEW_Z - (PLAYER_Z - HIT_DEPTH)`

All three times must be finite and strictly ordered.

## Conservative low-obstacle clearing rule

This proof deliberately requires a jump to clear a low obstacle for the **entire row collision window**, even though the live game only needs vertical clearance while the rider is laterally overlapping that obstacle. This is conservative and may produce false negatives; it must not produce a false positive from mid-lane timing tricks.

If `jumpHeight <= 20`, no low obstacle is jump-clearable.

Otherwise define:

`alpha = asin(20 / jumpHeight) / pi`

For jump duration `T = jumpTime`, vertical clearance is strictly above 20 only during the relative interval:

`(alpha*T, (1-alpha)*T)`

A jump starting at `s` clears a low row with collision window `[entry, exit]` only if the whole window lies strictly inside that clear interval.

Use a fixed numerical epsilon of `1e-9` seconds when converting the runtime's strict `> 20` condition into interval comparisons.

## Lane-transition model

To isolate the vertical question that produced `needs_jump_aware_analysis`, preserve the existing v1 auditor's lane-center transition semantics:

- rider starts in the center lane
- each evaluated row ends at a lane center
- required lateral time between row centers is `abs(a-b) * laneSwitchTime`
- first-row availability uses the same spawn-to-collision-center lead time as the existing lane-only proof
- later-row availability uses collision-center to collision-center time

Do not introduce mid-lane threading as a rescue mechanism.

This means the experiment is a jump-aware extension of the existing row-center lane proof, not a claim of exact continuous-input playability.

## Jump scheduling state

Jump starts are continuous-time actions. The implementation must not use arbitrary frame-rate stepping.

For each low-row traversal, derive the interval of jump-start times that would cover its full collision window. Build a finite candidate set from the analytically derived interval boundaries (offset inward by the fixed epsilon) for all low-row requirements.

A reachable path state must track at least:

- lane at the current row center;
- the start time of the most recent jump, or no prior jump.

For a low traversal, it may be satisfied by:

1. the existing most-recent jump if that jump's clear interval covers the full current collision window; or
2. a new candidate jump whose start lies in the current requirement interval and is no earlier than the previous jump start plus `jumpTime`.

A free-lane traversal needs no jump. A wall lane is blocked regardless of jump state.

Equivalent interval-DP implementations are allowed only if they preserve the same continuous-time feasibility set. Candidate states may be dominance-pruned, but pruning must not discard a state that can enable a future jump earlier or cover a later low-row window.

## Self-consistency requirement

The jump-aware implementation will necessarily reconstruct the deterministic row timeline. Before interpreting reachability, it must cross-check its reconstructed baseline against the existing `audit_gameplay_v1.mjs` result for the same fixture/profile.

At minimum require exact agreement on:

- beat count
- row count
- obstacle count
- pickup count
- maximum obstacle-pool demand
- maximum pickup-pool demand
- existing lane-only pass/fail classification

Any mismatch invalidates that fixture/profile result as `model_mismatch`; do not infer gameplay behavior from it.

## Result statuses

Per fixture/profile:

- `jump_aware_pass`: self-consistency checks pass, pool/finite-generation checks are acceptable, and the conservative jump-aware state search reaches the final row.
- `jump_aware_unresolved`: self-consistency checks pass, but the conservative jump-aware search cannot prove a full-song path.
- `model_mismatch`: reconstructed row/timing facts disagree with the existing auditor.
- `out_of_scope`: the existing auditor reports `pool_overflow_risk` or `invalid_generation`; jumping is not allowed to rescue those failures.

Do **not** emit `jump_aware_fail` or call a song unplayable. This experiment is a proof attempt; inability to prove a route remains unresolved.

## Determinism requirement

Run every fixture/profile proof twice into independently materialized output directories and byte-compare corresponding JSON outputs. Any mismatch invalidates the run.

Five profiles × two fixtures = **10 proofs per deterministic pass**, **20 total proof executions**.

## Fixed decision rules

1. `default` and `lane-0.16` must remain provable on both fixtures. If either control regresses, invalidate the experiment and investigate the proof implementation.
2. A primary unresolved profile may be upgraded from prior `needs_jump_aware_analysis` only when the new result is `jump_aware_pass` with all self-consistency checks green.
3. `jump_aware_unresolved` remains unsupported; do not tune thresholds or physics after seeing it.
4. Pool-overflow profiles remain unsupported and are not reconsidered here.
5. Do not change `jumpTime`, `jumpHeight`, lane timing, collision depth, obstacle kinds, row seeds, or pool capacities during this experiment.
6. Do not change Analyzer/Structure inputs.
7. Do not generalize beyond the two frozen real product beat grids.

## Non-claims

A green proof establishes conservative full-song route existence under the current deterministic row generator, exact current timing facts, full-window low-obstacle clearance, and the existing row-center lane-transition model. It does not measure fun, human reaction time, control latency, input-device ergonomics, semantic event safety, or universal music coverage.

The value of this experiment is to distinguish genuinely jump-resolvable lane-only uncertainty from cases that remain unproven without altering the game to force a green result.

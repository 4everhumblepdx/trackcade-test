# Trackcade Gameplay v1 — Tuning Envelope Stress Specification

Status: **preregistered before stress-run results**

Purpose: map a deterministic, evidence-based gameplay tuning envelope against the two frozen real product beat grids without changing Analyzer v0.19, Structure v1, the row generator, pool capacities, or the gameplay auditor.

This experiment is diagnostic. It is not permission to retune values after seeing failures.

## Frozen inputs

Use the exact safe generated music facts from Structure v1 artifact run `36281637484`:

- ALLDAT minimal safe baseline (`alldat-minimal-auto-safe-v1.json`)
- CVB G.E.M.F. safe music facts with optional legacy/custom tuning stripped before validation

The music facts remain fixed within each fixture:

- artist/title/audio identity
- BPM and beat offset
- song length
- authored Analyzer beat events
- safe section events
- energy curve
- generation/provenance metadata

Do not add generated `energy`, `drop`, or `peak` semantic gameplay commands in this experiment.

## Frozen runtime/auditor

- Auditor: `research/gameplay-v1/audit_gameplay_v1.mjs`
- Existing QC schema: `trackcade-gameplay-qc-v1`
- Obstacle pool capacity: `28`
- Pickup pool capacity: `24`
- Row generator: unchanged
- Difficulty equations: unchanged
- Current runtime fact: `spawnMinGapZ` is not enforced on the beat-driven spawn path

## Default reference profile

The loader-default profile under test is:

| Field | Default |
| --- | ---: |
| `spawnRowEveryBeats` | 1 |
| `baseSpeed` | 120 |
| `maxSpeed` | 380 |
| `speedRampPerSec` | 1.1 |
| `laneSwitchTime` | 0.12 |

Other loader defaults stay unchanged in every stress profile unless explicitly listed.

## Preregistered matrix

Each profile is applied independently to BOTH frozen product beat grids.

### Reference

| ID | Overrides |
| --- | --- |
| `default` | none |

### Spawn cadence — one factor

| ID | Overrides |
| --- | --- |
| `cadence-2` | `spawnRowEveryBeats=2` |
| `cadence-4` | `spawnRowEveryBeats=4` |

No denser value than 1 exists because the runtime field is integer beats per row and 1 is already the densest supported cadence.

### Base speed — one factor

| ID | Overrides |
| --- | --- |
| `base-80` | `baseSpeed=80` |
| `base-100` | `baseSpeed=100` |
| `base-140` | `baseSpeed=140` |
| `base-160` | `baseSpeed=160` |

### Maximum speed — one factor

| ID | Overrides |
| --- | --- |
| `max-260` | `maxSpeed=260` |
| `max-320` | `maxSpeed=320` |
| `max-440` | `maxSpeed=440` |
| `max-500` | `maxSpeed=500` |

### Speed ramp — one factor

| ID | Overrides |
| --- | --- |
| `ramp-0` | `speedRampPerSec=0` |
| `ramp-0.4` | `speedRampPerSec=0.4` |
| `ramp-2.0` | `speedRampPerSec=2.0` |
| `ramp-3.0` | `speedRampPerSec=3.0` |

### Lane-switch time — one factor

| ID | Overrides |
| --- | --- |
| `lane-0.08` | `laneSwitchTime=0.08` |
| `lane-0.16` | `laneSwitchTime=0.16` |
| `lane-0.20` | `laneSwitchTime=0.20` |
| `lane-0.24` | `laneSwitchTime=0.24` |

### Combined profiles

These are fixed before observing stress results and intentionally combine plausible pressure directions.

| ID | Overrides |
| --- | --- |
| `slow-dense` | `baseSpeed=80`, `maxSpeed=260`, `speedRampPerSec=0.4`, `spawnRowEveryBeats=1` |
| `slow-dense-tight-lanes` | `baseSpeed=80`, `maxSpeed=260`, `speedRampPerSec=0.4`, `laneSwitchTime=0.20`, `spawnRowEveryBeats=1` |
| `slow-sparse` | `baseSpeed=80`, `maxSpeed=260`, `speedRampPerSec=0.4`, `spawnRowEveryBeats=2` |
| `fast-dense` | `baseSpeed=160`, `maxSpeed=500`, `speedRampPerSec=2.0`, `spawnRowEveryBeats=1` |
| `fast-dense-tight-lanes` | `baseSpeed=160`, `maxSpeed=500`, `speedRampPerSec=2.0`, `laneSwitchTime=0.20`, `spawnRowEveryBeats=1` |
| `fast-sparse-tight-lanes` | `baseSpeed=160`, `maxSpeed=500`, `speedRampPerSec=2.0`, `laneSwitchTime=0.20`, `spawnRowEveryBeats=2` |

Total preregistered profiles: **25** including the default reference. Total product-fixture audits per deterministic pass: **50**.

## Determinism requirement

Run the complete 50-audit matrix twice from independently materialized output directories and byte-compare every corresponding QC JSON result.

Any deterministic mismatch invalidates the matrix run.

## Recorded metrics

For every fixture/profile pair record at minimum:

- QC status
- rows spawned
- minimum and p05 row-arrival gap
- minimum spawn-to-collision lead time
- lane-only proof pass/fail
- lane-only bottleneck slack
- maximum obstacle pool demand and capacity
- maximum pickup pool demand and capacity
- minimum spatial gap between row spawns
- effective runtime profile values

## Fixed classification rule

For each profile across the two product fixtures:

- `cross_fixture_pass`: both fixture audits return `qc_pass`
- `fixture_sensitive`: exactly one fixture returns `qc_pass`
- `cross_fixture_fail`: neither fixture returns `qc_pass`

Also preserve the underlying auditor status for each fixture (`qc_pass`, `pool_overflow_risk`, `needs_jump_aware_analysis`, or `invalid_generation`).

A profile is **not** considered supported merely because the aggregate label sounds close to safe. Only `cross_fixture_pass` is evidence of passing both currently available real product beat grids.

## Decision rules

1. Do not change the default gameplay profile during this matrix.
2. Do not increase pool capacities to turn a failure into a pass.
3. Do not modify beat grids, energy curves, or safe section events.
4. Do not change matrix values after any matrix result is observed.
5. Do not interpolate untested values into the supported envelope. Report only tested points.
6. A profile that fails either real product fixture remains unsupported unless a later separately preregistered experiment explains and resolves the failure.
7. If the default reference does not reproduce `qc_pass` on both fixtures, invalidate the experiment and investigate provenance/runtime drift before interpreting any other profile.

## Explicit exclusions / non-claims

### `jumpTime`

The current v1 auditor uses a conservative lane-only path proof and does not model jump timing as a route to survivability. Varying `jumpTime` in this matrix would create misleading apparent coverage, so it is excluded.

### `spawnMinGapZ`

The current beat-driven runtime does not enforce this field. Varying it cannot establish a runtime safety effect and is excluded until a separate runtime-contract experiment is specified.

### Semantic high-impact events

The safe automatic baseline intentionally does not generate `energy`, `drop`, or `peak` commands. This matrix therefore does not establish the safety envelope for optional semantically authored overdrive/energy/peak gameplay. That requires separate semantic gameplay QC.

### Universal music claim

The repository currently contains two real product audio fixtures. Even a fully green matrix establishes behavior only on those frozen beat grids, not every possible song.

## Success condition for this experiment

A valid experiment produces:

- deterministic duplicate outputs,
- a complete 25-profile × 2-fixture matrix,
- the unchanged default reference passing both fixtures,
- a machine-readable aggregate classifying each tested profile without post-hoc tuning.

The scientific/product value is the map itself, including failures; the goal is not to make every profile green.
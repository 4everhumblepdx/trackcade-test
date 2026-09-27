# Trackcade Musical Interpretation v1 — Peak Pickup / Pool QC Spec

Status: **preregistered semantic runtime proof**

## Question

Do the exact accepted `peak` events from Musical Interpretation v1 fit inside Trackcade's fixed pickup pool when combined with ordinary row-generator pickups under the already-validated loader-default difficulty modes?

This test exists because Gameplay/Difficulty v1 intentionally counted only row-generator pickups and explicitly deferred peak-spiral accounting to later semantic QC.

## Frozen upstream

- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- interpretation/gameplay v1.1 run: `36324127397`
- interpretation/gameplay v1.1 artifact ID: `10933222747`
- artifact digest: `sha256:cd6c00e9886d167f54f120f8ad8511fb059cbf9789f95b8d1965e2c67f67a40b`
- v1.1 result record: `research/interpretation-v1/CROSS_LAYER_GAMEPLAY_V1_1_RESULT.md`

No semantic proposal, compiler threshold, Gameplay-v1 tuning mode, pool capacity, Analyzer bit, Structure Evidence, or runtime physics may be changed in this experiment.

## Exact runtime facts under test

From `src/scenes/play.js`:

- fixed pickup pool capacity: `24`;
- all row pickups and peak orbs share that same pool;
- `spawnPickup()` silently returns without spawning if no inactive pool slot exists;
- a `peak` event assigns `peakQueue = 14`;
- during the same update, the runtime subtracts `dt * 9` and then drains every remaining whole queue unit in a `while` loop;
- every drained unit attempts one `orb` pickup at `VIEW_Z = 560`;
- pickups move with the same runtime distance/speed integration as gameplay and are freed when `z < -30` or collected;
- QC must conservatively assume pickups are **not collected**, so each attempted pickup occupies a slot until cull;
- a later peak replaces `peakQueue` with `14`; it does not add to an undrained queue, but already-spawned prior peak orbs remain alive and consume pool slots.

## Two peak-attempt bounds

The current positive-frame-delta update path cannot drain all 14 queue units after first subtracting `dt * 9`; for ordinary positive `dt <= 1/9 s`, it attempts at most `13` peak orbs. Larger positive frame deltas only reduce that count.

QC therefore records both:

1. **current-runtime bound** — `13` simultaneous peak-orb attempts per peak event;
2. **queue-cap stress bound** — `14` attempts per peak event, directly matching the assigned queue capacity and covering a zero/tiny-delta boundary or future scheduling change without changing the pool.

The product gate requires **both** bounds to fit the 24-slot pool. This is intentionally conservative and uses only runtime constants, not a new tuned threshold.

## Reconstruction / parity requirement

The new semantic QC must not replace the trusted Gameplay-v1 auditor.

For every fixture/mode it must:

1. run `research/gameplay-v1/audit_gameplay_v1.mjs` unchanged;
2. independently reconstruct the same beat rows, runtime speed table, row pickup spawn/cull intervals, and row-only concurrent pickup occupancy;
3. require exact parity with the trusted audit on:
   - beat count;
   - row count;
   - total row pickup count;
   - row-only maximum concurrent pickup count;
   - row-only pickup pool capacity;
4. fail closed on any parity mismatch before interpreting peak results.

## Peak occupancy model

For each accepted `peak` event in the loader-resolved manifest:

- peak spawn time is the deterministic event time `e.t`;
- each peak batch starts at `VIEW_Z` and uses the same distance-to-cull calculation as a row pickup;
- no pickup collection is assumed;
- peak batches are combined with all row-pickup intervals;
- additions are processed before removals on exact time ties, matching the existing conservative pool accounting convention.

Report separately for 13-orb and 14-orb peak batches:

- number and times of peak events;
- attempted peak orbs;
- maximum concurrent row-only pickups;
- maximum concurrent combined pickups;
- time of combined maximum;
- pool capacity `24`;
- overflow count / silent-drop risk.

## Pass/fail

`qc_pass` requires:

- trusted Gameplay-v1 audit itself is `qc_pass`;
- reconstruction parity is exact;
- at least one `peak` event exists (otherwise this test is not applicable);
- combined maximum at 13 orbs/peak is `<= 24`;
- combined maximum at 14 orbs/peak is `<= 24`;
- all reconstructed times/counts are finite and deterministic across duplicate runs.

Any combined maximum above 24 is `peak_pickup_pool_overflow_risk`; do not enlarge the pool or reduce peak orb count inside this experiment.

## Scope

Run the exact six publishable v1.1 manifests:

- ALLDAT: relaxed / standard / rush;
- CVB — G.E.M.F.: relaxed / standard / rush.

Run every case twice and require byte-identical QC output.

## Claim boundary

A green result proves only fixed-pool occupancy safety for current accepted peak events on these two product fixtures/modes under conservative no-collection assumptions.

It does not prove musical correctness, collectible-route fun/accessibility, visual readability, or broad-song safety. Those remain separate questions.

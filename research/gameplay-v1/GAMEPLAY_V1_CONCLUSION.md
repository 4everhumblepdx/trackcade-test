# Trackcade Gameplay / Difficulty v1 — Conclusion

Status: **closed as a validated product foundation**

## Decision

Gameplay / Difficulty v1 is complete for its intended product-foundation scope.

Do not reopen Analyzer timing, Structure v1, fixed pool sizes, or core runtime physics merely to make arbitrary tuning profiles pass. The validated architecture is now:

**v0.19 Analyzer → Structure Evidence / safe manifest → deterministic Gameplay v1 variant generation → whole-song fail-closed QC → publish only safe variants → runtime**

The safe loader-default manifest remains the invariant fallback.

## Frozen upstream identity

Production Analyzer remains unchanged:

- branch: `release/analyzer-v0.19`
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

The later v0.20 phase-context research was closed without promoting a production replacement.

Canonical Structure v1 safe-manifest handoff:

- run: `36281637484`
- artifact ID: `10918568524`
- digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`

Gameplay v1 did not alter Analyzer or Structure music facts.

## What Gameplay v1 established

### 1. Deterministic whole-song gameplay QC

`research/gameplay-v1/audit_gameplay_v1.mjs`

The auditor models the actual authored beat grid, deterministic row generator, runtime speed ramp, row arrival timing, lane-transition timing, and fixed object lifetimes/pools across the full song.

It distinguishes:

- `qc_pass`
- `pool_overflow_risk`
- `needs_jump_aware_analysis`
- `invalid_generation`

It deliberately refuses to call lane-only uncertainty impossible when current jump mechanics may resolve it.

### 2. Fail-closed publish preflight

`research/gameplay-v1/preflight_gameplay_v1.mjs`

A manifest is accepted only when the existing whole-song auditor returns exact `qc_pass`.

Validated QC/preflight run:

- run: `36283334780`
- head: `38c4b41b9e2fddc7b58fe47cbb3e85fe8106c737`
- artifact ID: `10920135382`
- artifact digest: `sha256:d7d3283936f52f57eb8f240c3ecd88c9ec33d57b5629b63563cfb1f1b4164859`

The two current real product songs pass with minimal/default tuning:

- ALLDAT: obstacle peak `27 / 28`
- CVB G.E.M.F.: obstacle peak `24 / 28`

The old inherited template tuning does not pass:

- ALLDAT template: `36 / 28`
- CVB template: `33 / 28`

Therefore unsafe template behavior is rejected rather than hidden by enlarging pools.

### 3. Preregistered tuning-envelope stress

`research/gameplay-v1/GAMEPLAY_TUNING_STRESS_SPEC.md`

The frozen matrix ran 25 profiles against both real product grids, twice, without post-hoc value changes.

Validation:

- run: `36283670077`
- artifact ID: `10919383994`
- artifact digest: `sha256:46773e421237ae2dd4f578a5ece68bdcc8217f5169b6f63138aaf55ba39b6101`
- summary SHA-256: `5262d240a1d77df00d592e155bcfcd632098c302da6ebae7c5d0b457ea9cd15c`

Results:

- 16 profiles passed both fixtures under conservative lane-only QC;
- 3 were fixture-sensitive;
- 6 did not pass both under that auditor;
- fixed-pool pressure, especially at slower/dense tuning, emerged as a real validated boundary.

Important product finding: slower forward speed can be *less* safe for fixed pools because obstacles remain alive longer and overlap more heavily.

### 4. Conservative jump-aware route proof

The stress matrix correctly classified three lane-pressure points as `needs_jump_aware_analysis` rather than failed.

A separately preregistered continuous-time jump-aware proof then tested:

- `lane-0.20`
- `lane-0.24`
- `fast-dense-tight-lanes`

with `default` and `lane-0.16` controls.

Validation:

- preregistration commit: `13c0e663344db3861bae8fb2ddee9f61bb9ba096`
- workflow run: `36288101196`
- workflow head: `856a61ae4fa596cf900cc134a43ee9c56fff4ddf`
- artifact ID: `10921990035`
- artifact digest: `sha256:bf5d33cb8c73f6d06fb727f1275aa0fbab57e362268ee9547263e711343d8aa8`
- summary SHA-256: `c8c53339d70c0f3f3a0742f1d070e2657605b9053ab004c91130930d886ee809`

All five profiles were conservatively route-provable on both current real product songs.

The proof is stricter than live low-obstacle collision handling: when it uses a low-obstacle lane, vertical clearance must cover the entire row collision-depth window. It does not use mid-lane threading as an escape hatch.

This resolves the earlier lane-only uncertainty without changing runtime physics or historical stress classifications.

### 5. Deterministic song-specific difficulty generation

`research/gameplay-v1/generate_difficulty_variants_v1.mjs`

The generator creates a fixed preregistered candidate set and lets full-song QC decide what is publishable for the exact song.

Current modes:

- `relaxed`: row every 2 beats;
- `standard`: unchanged loader-default safe baseline;
- `rush`: faster preregistered profile (`baseSpeed=160`, `maxSpeed=500`, `speedRampPerSec=2.0`).

It does **not** guess difficulty from unvalidated BPM, genre, or energy thresholds. Song adaptation is based on the full deterministic gameplay consequence.

Validation:

- spec commit: `c6027dbe3a0f6e5f535a8bd5645ee06e46150f50`
- implementation commit: `d30a93d8bd8636eb8c7c1a08e83b837c9ff4c64e`
- workflow run: `36288512590`
- workflow head: `d82a7022d61baefb2a57e6dbcaf55d6fee43a1b6`
- artifact ID: `10921566934`
- artifact digest: `sha256:cd52c03393f3aa5cd9f45ed45e0e3833b145220232ff719dc5353b4e3d12b5c8`

Both product packs reproduced byte-identically across duplicate generation runs.

Both current real songs publish all three modes, with every published mode carrying its own `qc_pass` evidence.

ALLDAT pool peaks:

- relaxed: `14 / 28`
- standard: `27 / 28`
- rush: `20 / 28`

CVB G.E.M.F. pool peaks:

- relaxed: `12 / 28`
- standard: `24 / 28`
- rush: `18 / 28`

If `standard` fails on a future song, the generator refuses the whole pack. If an optional mode fails, that mode is unavailable for that song and is not silently retuned under the same name.

## `spawnMinGapZ` runtime-contract finding

The active beat-driven spawn path does not enforce `spawnMinGapZ`.

The successful default fixtures already contain measured spatial row gaps below the configured fallback value.

Therefore:

- do not describe `spawnMinGapZ` as a current safety guarantee;
- do not blindly enforce it as a corrective patch;
- changing this behavior is a separate runtime/product-contract decision because it would materially alter currently validated beat-driven gameplay.

## What is finished

Gameplay / Difficulty v1 has established:

- deterministic whole-song gameplay auditing;
- fail-closed publish preflight;
- fixed-pool demand validation;
- conservative lane-transition route proof;
- conservative jump-aware resolution for lane-only uncertainty;
- preregistered tuning-envelope evidence;
- deterministic song-specific difficulty variant generation;
- immutable Analyzer/Structure music-fact preservation;
- reproducible artifacts, hashes, and duplicate-run proofs for the current real fixtures.

## What is not claimed or not finished

This closure does **not** establish:

- universal safety for every possible future song;
- a broad music corpus benchmark;
- arbitrary custom tuning safety;
- human reaction-time, accessibility, or subjective fun calibration;
- final UX naming/calibration of `relaxed`, `standard`, and `rush`;
- learned difficulty prediction or genre understanding;
- automatic high-impact semantic `energy`, `drop`, or `peak` gameplay events;
- semantic-event gameplay QC for peak spirals / overdrive;
- visual/world generation from artist/song identity;
- personalization;
- enforcement of `spawnMinGapZ` on the beat-spawn runtime path.

Those are future layers, not reasons to keep this foundation lane open.

## Product rules carried forward

1. Analyzer v0.19 and Structure v1 remain frozen unless later product evidence demonstrates a concrete upstream defect.
2. The safe loader-default manifest remains the invariant fallback.
3. Never enlarge fixed pools merely to preserve a tuning profile that fails deterministic QC.
4. Every custom or generated gameplay profile must pass whole-song preflight before publication.
5. Lane-only uncertainty may be investigated with the validated jump-aware proof; pool overflow may not be reclassified as a jump problem.
6. Do not claim `spawnMinGapZ` enforcement that the runtime does not currently perform.
7. Do not add automatic high-impact semantic events to the safe baseline without their own deterministic gameplay QC.
8. Broader-song claims require a genuinely broader corpus, not repeated tuning against the same two tracks.

## Next project lane

Proceed to **visual / world generation v1** as the next independent product layer.

Reason: the automatic audio-to-safe-game path now has deterministic music timing, safe structure, and publishable gameplay variants. The next missing piece that most directly changes a newly uploaded track from a generic fallback game into an artist/song-specific game is its visual/world identity.

Keep gameplay safety independent from visual generation. Visual generation must not be allowed to modify beat timing, energy curves, gameplay tuning, collision rules, pools, or the validated Gameplay v1 publication decision.

A learned/audio-capable semantic interpreter remains a separate optional future lane and must continue to pass through the existing Structure v1 trust boundary before it can affect gameplay.

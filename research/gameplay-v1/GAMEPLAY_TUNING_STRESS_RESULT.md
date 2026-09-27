# Trackcade Gameplay v1 — Tuning Stress Result

Status: **completed, deterministic, preregistered matrix**

This result records the first deterministic gameplay-tuning envelope experiment against both real product beat grids currently present in the repository. It does not alter the preregistered matrix after observing results.

## Experiment identity

- Preregistered matrix commit: `84efef63fa895af0001517f89c4f26621aa0f2b6`
- Matrix runner commit: `b6f7b140a15ddd4e8c428046d9ca6f2c801018d0`
- Workflow/head commit: `ac12b16cb83efad8c0ebf5cd35b651b990552288`
- Workflow run: `36283670077`
- Workflow conclusion: `success`
- Artifact: `trackcade-gameplay-v1-tuning-stress`
- Artifact ID: `10919383994`
- Artifact digest: `sha256:46773e421237ae2dd4f578a5ece68bdcc8217f5169b6f63138aaf55ba39b6101`
- Aggregate summary SHA-256: `5262d240a1d77df00d592e155bcfcd632098c302da6ebae7c5d0b457ea9cd15c`
- Preregistered spec SHA-256: `77b1aef852d2172d2fe481d8d67a9dc6e02a248b91d831f03f2a96ada4a6f29d`
- Runner SHA-256: `39528127122f8eac71a619082fb1e2e577e8d4674ba2e2d442003d4490abb78e`

Upstream Structure v1 artifact identity remained frozen:

- source run `36281637484`
- artifact ID `10918568524`
- digest `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`
- Analyzer source commit `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer v0.19 runner SHA-256 `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

## Determinism

The full 25-profile × 2-fixture matrix was run twice, for 100 whole-song audits total. The workflow recursively diffed both output trees and found no differences.

The default reference reproduced `qc_pass` on both fixtures, so the experiment remained valid under the preregistered decision rule.

## Aggregate result

| Classification | Profiles |
| --- | ---: |
| `cross_fixture_pass` | 16 |
| `fixture_sensitive` | 3 |
| `cross_fixture_fail` | 6 |
| **Total** | **25** |

`cross_fixture_fail` does not always mean the same thing. Some profiles exceeded fixed pool capacity; others produced `needs_jump_aware_analysis`, meaning the conservative lane-only proof was insufficient and v1 did not determine whether jumping rescues the route.

## Complete preregistered profile map

| Profile | Classification | ALLDAT | CVB G.E.M.F. |
| --- | --- | --- | --- |
| `default` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `cadence-2` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `cadence-4` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `base-80` | `cross_fixture_fail` | `pool_overflow_risk` | `pool_overflow_risk` |
| `base-100` | `fixture_sensitive` | `pool_overflow_risk` | `qc_pass` |
| `base-140` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `base-160` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `max-260` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `max-320` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `max-440` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `max-500` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `ramp-0` | `fixture_sensitive` | `pool_overflow_risk` | `qc_pass` |
| `ramp-0.4` | `fixture_sensitive` | `pool_overflow_risk` | `qc_pass` |
| `ramp-2.0` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `ramp-3.0` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `lane-0.08` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `lane-0.16` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `lane-0.20` | `cross_fixture_fail` | `needs_jump_aware_analysis` | `needs_jump_aware_analysis` |
| `lane-0.24` | `cross_fixture_fail` | `needs_jump_aware_analysis` | `needs_jump_aware_analysis` |
| `slow-dense` | `cross_fixture_fail` | `pool_overflow_risk` | `pool_overflow_risk` |
| `slow-dense-tight-lanes` | `cross_fixture_fail` | `pool_overflow_risk` | `pool_overflow_risk` |
| `slow-sparse` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `fast-dense` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |
| `fast-dense-tight-lanes` | `cross_fixture_fail` | `needs_jump_aware_analysis` | `needs_jump_aware_analysis` |
| `fast-sparse-tight-lanes` | `cross_fixture_pass` | `qc_pass` | `qc_pass` |

## Important measured boundaries

### Default reference

- ALLDAT: obstacle demand `27/28`, lane-only bottleneck slack `0.0800146295 s`, minimum lead `1.58794 s`
- CVB: obstacle demand `24/28`, lane-only bottleneck slack `0.121579341 s`, minimum lead `1.40526 s`

The default remains inside the fixed pools on both current real product grids.

### Slower base speed increases pool pressure

With only `baseSpeed=80` changed:

- ALLDAT obstacle demand rose to `37/28`
- CVB obstacle demand rose to `34/28`

With `baseSpeed=100`:

- ALLDAT reached `32/28` and failed pool QC
- CVB reached exactly `28/28` and passed

The tested values therefore show that lowering initial speed can be more dangerous to fixed pool capacity because spawned rows remain alive longer and overlap more heavily. No untested threshold is inferred between the sampled values.

### Slow speed ramp can also create pool pressure

- `speedRampPerSec=0`: ALLDAT `29/28`, CVB `28/28`
- `speedRampPerSec=0.4`: ALLDAT `29/28`, CVB `26/28`
- default `1.1`: both pass
- tested `2.0` and `3.0`: both pass

Again, these are tested points only; the experiment does not interpolate a universal boundary.

### Sparse cadence relieves pressure

- `cadence-2`: obstacle demand `14/28` ALLDAT and `12/28` CVB
- `cadence-4`: `8/28` on both
- `slow-dense`: `41/28` ALLDAT and `36/28` CVB
- the same slow speed profile with `spawnRowEveryBeats=2` (`slow-sparse`) passes at `21/28` and `18/28`

This confirms that spawn cadence is a strong deterministic control over concurrent pool demand on these beat grids.

### Maximum speed one-factor samples all passed

`maxSpeed` values `260`, `320`, `440`, and `500` all passed both fixtures under otherwise-default tuning. This is evidence only for those tested one-factor profiles on these two grids.

### Lane-switch timing exposes the v1 proof boundary

- `laneSwitchTime=0.08`: passes both
- default `0.12`: passes both
- `laneSwitchTime=0.16`: passes both, but ALLDAT bottleneck slack is only `0.0000146295 s` (about 14.6 microseconds)
- `laneSwitchTime=0.20`: `needs_jump_aware_analysis` on both
- `laneSwitchTime=0.24`: `needs_jump_aware_analysis` on both

The `0.16` sample satisfies the existing v1 mathematical pass rule but has essentially no lane-only timing margin on ALLDAT. This experiment did not preregister a minimum-slack product policy, so no new threshold is imposed post hoc.

The `0.20` and `0.24` outcomes are **not proof that gameplay is impossible**. They mean the conservative lane-only dynamic-programming proof cannot establish a route; jump-aware survivability would need a separate specified model.

The combined `fast-dense-tight-lanes` profile produces the same `needs_jump_aware_analysis` classification, while `fast-sparse-tight-lanes` passes both fixtures because the reduced row cadence restores lane-transition time.

## Product interpretation

1. The loader-default profile remains supported by all current deterministic Gameplay v1 evidence.
2. Fixed pool capacities should remain unchanged; slower/dense custom profiles reveal genuine overflow pressure that larger pools would merely mask.
3. Per-manifest gameplay preflight remains necessary for custom tuning. The matrix demonstrates why a single globally assumed custom envelope is unsafe.
4. The tested safe points are not a continuous guaranteed region. Untested intermediate or combined profiles must still run preflight.
5. `laneSwitchTime=0.16` is a tested v1 pass, but the measured ALLDAT margin is too small to treat as evidence of a robust general-purpose default without a separately preregistered margin policy.
6. `laneSwitchTime>=0.20` in these sampled profiles enters an unresolved jump-aware region, not a proven-failure region.
7. `spawnMinGapZ` remains outside this experiment because the current beat-driven runtime does not enforce it.

## Evidence boundary

This matrix is materially stronger than the original two default-profile checks, but it still uses the only two real product beat grids currently in the repository. It establishes deterministic behavior for the 25 explicitly tested tuning profiles on those grids. It does not establish universal safety across all music.

## Next justified research question

The remaining concrete uncertainty exposed by this matrix is **jump-aware survivability for lane-only failures**, particularly the preregistered `lane-0.20`, `lane-0.24`, and `fast-dense-tight-lanes` profiles.

If Gameplay v1 continues, the next experiment should specify a jump-aware route model before implementation. It should not modify current QC classifications retroactively or loosen the existing fail-closed preflight.
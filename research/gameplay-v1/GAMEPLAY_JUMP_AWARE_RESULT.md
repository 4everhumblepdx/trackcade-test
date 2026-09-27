# Trackcade Gameplay v1 — Jump-Aware Reachability Result

Status: **completed — deterministic conservative proof passed all preregistered cases**

This result records the separately preregistered jump-aware experiment. It does not rewrite the earlier tuning-stress result or move any threshold after seeing outcomes.

## Frozen provenance

Jump-aware preregistration commit:

`13c0e663344db3861bae8fb2ddee9f61bb9ba096`

Workflow execution:

- workflow: `Trackcade Gameplay v1 — Jump-Aware Proof`
- run: `36288101196`
- workflow head: `856a61ae4fa596cf900cc134a43ee9c56fff4ddf`
- conclusion: `success`

Exact Structure v1 input:

- run: `36281637484`
- artifact: `10918568524`
- digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`

Production Analyzer identity remained unchanged:

- release branch: `release/analyzer-v0.19`
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

The later v0.20 phase-context research was already closed without promoting a production replacement, so v0.19 remained the correct package for this experiment.

## Evidence artifact

- artifact: `trackcade-gameplay-v1-jump-aware-proof`
- artifact ID: `10921990035`
- size: `26660` bytes
- artifact digest: `sha256:bf5d33cb8c73f6d06fb727f1275aa0fbab57e362268ee9547263e711343d8aa8`
- summary SHA-256: `c8c53339d70c0f3f3a0742f1d070e2657605b9053ab004c91130930d886ee809`

Frozen source hashes captured by the workflow:

- `GAMEPLAY_JUMP_AWARE_SPEC.md`: `397c2acde7d86ab65e06a549afc5a408f943add3cda1a019cf288781e343328d`
- `audit_jump_aware_v1.mjs`: `74354f10f6083f8226f7c8225de674d7e8559f8c9861ba8377736b35b0f2c4a4`
- `run_jump_aware_v1.mjs`: `387bf127b94d7f969106ddb96918d6b81cd8ae1638d6b80fd1de55820123135b`
- existing `audit_gameplay_v1.mjs`: `4bfdf8d1055fbc59012871b9dbecb2bd264d6af0d236ad88aa473fc379e24763`

## Validity checks

The complete 10-proof matrix was run twice. The two output trees were byte-identical.

The run also required, and passed:

- exact baseline-status reproduction from the earlier whole-song/tuning work;
- self-consistency parity between the new row reconstruction and the existing gameplay auditor;
- unchanged pool capacities;
- unchanged fallback jump parameters (`jumpTime=0.58`, `jumpHeight=46`);
- unchanged collision depth (`HIT_DEPTH=10`);
- both preregistered controls remaining provable.

`provenanceValid = true`

`controlsPass = true`

## Results

| Profile | Prior lane-only baseline | ALLDAT | CVB G.E.M.F. | Cross-fixture result |
| --- | --- | --- | --- | --- |
| `default` | `qc_pass` | `jump_aware_pass` | `jump_aware_pass` | pass |
| `lane-0.16` | `qc_pass` | `jump_aware_pass` | `jump_aware_pass` | pass |
| `lane-0.20` | `needs_jump_aware_analysis` | `jump_aware_pass` | `jump_aware_pass` | pass |
| `lane-0.24` | `needs_jump_aware_analysis` | `jump_aware_pass` | `jump_aware_pass` | pass |
| `fast-dense-tight-lanes` | `needs_jump_aware_analysis` | `jump_aware_pass` | `jump_aware_pass` | pass |

No case produced `model_mismatch`, `out_of_scope`, or `jump_aware_unresolved`.

The proof-state search remained small after sound dominance pruning:

- ALLDAT cases: maximum retained reachable states `7`
- CVB G.E.M.F. cases: maximum retained reachable states `6`

Candidate continuous-time jump starts were derived analytically rather than frame-stepped:

- ALLDAT default/lane profiles: `1566`
- CVB default/lane profiles: `2148`
- ALLDAT fast-dense-tight-lanes: `1554`
- CVB fast-dense-tight-lanes: `2139`

## What this resolves

The earlier lane-only auditor intentionally treated low obstacles as blocked because it did not model jumping. Therefore these three profiles were classified as `needs_jump_aware_analysis` rather than proven unsafe:

- `lane-0.20`
- `lane-0.24`
- `fast-dense-tight-lanes`

The preregistered jump-aware proof now establishes a full-song route on both frozen product beat grids for all three profiles under a deliberately conservative model.

The proof is stricter than live collision handling in one important way: whenever a route uses a low obstacle lane, jump height must stay strictly above the runtime clear threshold for the **entire row collision-depth window**, not merely during the rider's actual lateral overlap with that obstacle. Mid-lane threading is not used as a rescue mechanism.

Therefore the prior uncertainty is resolved as **jump-resolvable**, not as a hidden gameplay failure.

## Relationship to the earlier tuning-stress map

Do not edit the historical stress classifications. They correctly describe the original lane-only auditor result.

For product decisions that include current jump mechanics, the separately validated jump-aware evidence supersedes the earlier `needs_jump_aware_analysis` uncertainty for these exact tested points.

This does **not** rescue or reconsider profiles that failed because of fixed-pool pressure. In particular, the following remain unsupported by this experiment:

- `base-80`
- ALLDAT side of `base-100`
- ALLDAT side of `ramp-0`
- ALLDAT side of `ramp-0.4`
- `slow-dense`
- `slow-dense-tight-lanes`

Jumping does not change their pool-overflow classification.

## Product interpretation

For the two currently available real product songs, the default new-upload gameplay path remains safe under the existing whole-song QC, and the three tested lane-pressure profiles that previously required jump analysis now also have conservative full-song route proofs.

This strengthens the evidence that lane/jump mechanics are not the current limiting safety factor inside those tested points. Fixed object-pool pressure at slower/dense tuning remains the clearer validated boundary.

## Non-claims

This result does not establish:

- universal safety for every future song;
- human reaction-time comfort or fun;
- input latency/device ergonomics;
- safety of arbitrary custom tuning;
- safety of semantic `energy`, `drop`, or `peak` gameplay events;
- enforcement of `spawnMinGapZ` on the current beat-spawn path;
- exact continuous-input optimal play.

It establishes conservative deterministic route existence only for the preregistered profiles and the two frozen real product beat grids.

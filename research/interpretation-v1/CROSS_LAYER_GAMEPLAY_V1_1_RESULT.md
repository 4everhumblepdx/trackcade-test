# Trackcade Musical Interpretation v1 — Cross-Layer Gameplay Safety v1.1 Result

Status: **passed for loader-default product-path row generation, including drop/energy effects; peak-spiral pickup safety remains separately unresolved**

## Frozen run

- branch: `trackcade-musical-interpretation-v1`
- tested commit: `b60af9d335208de9f2d594798f9090bdb54c666c`
- workflow: `Trackcade Musical Interpretation v1 — Gameplay Safety v1.1`
- run ID: `36324127397`
- job ID: `108633478523`
- conclusion: `success`
- artifact: `trackcade-musical-interpretation-v1-gameplay-safety-v1-1`
- artifact ID: `10933222747`
- artifact digest: `sha256:cd6c00e9886d167f54f120f8ad8511fb059cbf9789f95b8d1965e2c67f67a40b`

## Upstream identity

The workflow re-downloaded and verified the exact closed upstream artifacts:

- Structure Evidence run `36281298997`, artifact `10919375182`, digest `sha256:3d4364ab01ee51b4b244f0033aeb5ca598393164e805c6149d4f25c37d9805fc`;
- Structure safe-manifest run `36281637484`, artifact `10918568524`, digest `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`;
- Analyzer runner SHA-256 `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`.

No Analyzer or Structure re-analysis occurred.

## Semantic compilation reproduced

The same frozen proposals and unchanged semantic compiler were used against the loader-default/minimal product manifests.

### ALLDAT

- proposed: `6`
- accepted: `5`
- rejected: `1`
- compilation report SHA-256: `61f5308064747c83a1c2fa1c9ec006713eb7c191273608074398fbeaf0ac0516`
- interpreted minimal manifest SHA-256: `e013dabc006ced906515ad5854cc8f6a8b5eed78687de267bba8ce4814c6a631`

### CVB — G.E.M.F.

- proposed: `9`
- accepted: `9`
- rejected: `0`
- compilation report SHA-256: `98108dd3773d21e3a2f606fbb377333aba3f51cdd045073d61a3ca1b50773af2`
- interpreted minimal manifest SHA-256: `4b37d07b33d3f99153af797b4a7a01812efc68ddd453a629d80b6ec9a8ec02b3`

The semantic acceptance reports are byte-identical to the first interpretation proof because optional art/game tuning is outside the semantic compiler trust boundary.

## Gameplay result

The existing closed Gameplay/Difficulty v1 generator ran twice per fixture. Duplicate output trees matched exactly. All three fixed modes passed whole-song QC for both songs.

### ALLDAT

| Mode | QC | Obstacle peak | Capacity | Pickup peak | Lane-only | Bottleneck slack |
| --- | --- | ---: | ---: | ---: | --- | ---: |
| relaxed | `qc_pass` | 14 | 28 | 6 | pass | 0.24426411564572903 s |
| standard | `qc_pass` | 27 | 28 | 11 | pass | 0.08001462946688709 s |
| rush | `qc_pass` | 20 | 28 | 10 | pass | 0.08002925062462318 s |

Published modes: `relaxed`, `standard`, `rush`.

### CVB — G.E.M.F.

| Mode | QC | Obstacle peak | Capacity | Pickup peak | Lane-only | Bottleneck slack |
| --- | --- | ---: | ---: | ---: | --- | ---: |
| relaxed | `qc_pass` | 12 | 28 | 6 | pass | 0.4152061517702573 s |
| standard | `qc_pass` | 24 | 28 | 12 | pass | 0.028233646426235603 s |
| rush | `qc_pass` | 18 | 28 | 9 | pass | 0.028195431229509405 s |

Published modes: `relaxed`, `standard`, `rush`.

These obstacle peaks reproduce the previously validated loader-default Gameplay-v1 envelope rather than the known-bad inherited-template signature.

## Semantic preservation

For every fixed difficulty candidate the workflow required exact preservation of:

- compiled event list, including accepted `drop`, `peak`, and `energy` events;
- interpretation provenance;
- authored beat grid;
- energy curve;
- BPM and beat offset;
- song length and source identity.

All published manifests validated through Trackcade's real loader.

Loader-resolved semantic counts remained:

- ALLDAT: `590` beat events and `4` high-impact semantic events;
- CVB: `812` beat events and `5` high-impact semantic events.

## What the existing Gameplay-v1 auditor actually covers

`audit_gameplay_v1.mjs` is semantic-aware for two high-impact runtime effects:

1. `drop` events activate overdrive for their duration and therefore affect runtime speed and row generation;
2. `energy` events increment runtime energy level and therefore affect speed/spawn intensity.

Those effects are incorporated into the distance table, row spawn intensity, row travel timing, pool overlap, and lane-only proof used by this v1.1 result.

Therefore this run is legitimate cross-layer evidence for the current accepted `drop` and `energy` semantics on the two product fixtures.

## Explicit unresolved boundary: peak pickup spirals

The current Gameplay-v1 auditor labels pickup-pool accounting as:

> row-generator pickups only; peak spiral modeled in later semantic QC

Therefore the v1.1 `qc_pass` results do **not** prove that runtime `peak` events and their golden-orb spiral emissions stay inside the fixed pickup pool or preserve collectible timing/readability.

Do not call semantic gameplay safety complete yet.

## Decision

- keep the exact interpretation proposals frozen;
- keep Analyzer v0.19, Structure Evidence, semantic compiler gates, Gameplay-v1 modes, pools, and physics unchanged;
- treat Attempt 1 as a known template-tuning confound;
- accept v1.1 as green evidence for loader-default gameplay with `drop` and `energy` effects;
- next run a separately preregistered semantic QC for the real runtime `peak` spiral/pickup behavior and combined pickup-pool demand.

No semantic or gameplay retuning is authorized by this result.

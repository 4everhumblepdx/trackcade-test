# Trackcade Musical Interpretation v1 — Peak Pickup / Pool QC Result

Status: **passed on all six frozen product manifests**

## Frozen run

- branch: `trackcade-musical-interpretation-v1`
- tested commit: `d9e8dfd1ec2efb1a0f4ce6c2f4ee8e52ff6ae005`
- workflow: `Trackcade Musical Interpretation v1 — Peak Pickup Pool QC`
- run ID: `36341941857`
- job ID: `108683615749`
- conclusion: `success`
- artifact: `trackcade-musical-interpretation-v1-peak-pickup-qc`
- artifact ID: `10939396632`
- artifact digest: `sha256:99919b66c580aed64229b846b9db9bfb179ccea1db6e211f49c9b49cc5520964`
- summary SHA-256: `3603219ef38905f7278a2869c2752f0b2f59dee5fc214cd5411159b86f981141`

## Frozen upstream identity

The run consumed the exact prior interpretation/gameplay v1.1 artifact:

- run ID: `36324127397`
- artifact ID: `10933222747`
- artifact digest: `sha256:cd6c00e9886d167f54f120f8ad8511fb059cbf9789f95b8d1965e2c67f67a40b`

Analyzer production identity remained unchanged:

- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

No Analyzer, Structure Evidence, semantic proposal, compiler threshold, Gameplay-v1 tuning, pool capacity, or runtime physics was changed.

## Determinism and parity

All six frozen manifests were evaluated twice. The two QC trees were byte-identical.

For every case:

- the unchanged trusted Gameplay-v1 auditor returned `qc_pass`;
- independent reconstruction matched trusted beat count, row count, total row-pickup count, row-only maximum pickup occupancy, and pickup-pool capacity exactly;
- all timing/count values were finite;
- two accepted `peak` events were present;
- the fixed pickup capacity remained `24`;
- both the current-runtime 13-orb bound and conservative 14-orb queue-cap bound stayed within capacity.

## Results

### ALLDAT

Accepted peak times: `51.365 s`, `178.892 s`.

| Mode | Row-only max | Combined 13-orb max | Combined 14-orb max | Capacity | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| relaxed | 6 | 18 | 19 | 24 | `qc_pass` |
| standard | 11 | 22 | 23 | 24 | `qc_pass` |
| rush | 10 | 19 | 20 | 24 | `qc_pass` |

The tightest case is ALLDAT `standard`: conservative 14-orb peak accounting reaches `23/24`, leaving one slot of modeled headroom.

### CVB — G.E.M.F.

Accepted peak times: `61.794 s`, `214.032 s`.

| Mode | Row-only max | Combined 13-orb max | Combined 14-orb max | Capacity | Result |
| --- | ---: | ---: | ---: | ---: | --- |
| relaxed | 6 | 16 | 17 | 24 | `qc_pass` |
| standard | 12 | 19 | 20 | 24 | `qc_pass` |
| rush | 9 | 18 | 19 | 24 | `qc_pass` |

No case produced modeled pickup overflow or silent-drop risk under the preregistered no-collection assumption.

## Decision

Accept this as green cross-layer safety evidence for the currently accepted `peak` events on the two product fixtures and all three published difficulty modes.

Together with the prior v1.1 result, the current accepted high-impact semantic runtime effects now have fixed-product evidence for:

- `drop` → overdrive speed / row-generation effects;
- `energy` → runtime difficulty / speed effects;
- `peak` → shared pickup-pool occupancy, including the conservative 14-orb stress bound.

Do **not** infer broader-song safety or musical correctness from this run. It does not prove that peak placement is musically ideal, that orb routes are fun or accessible, or that arbitrary future semantic proposals will fit the pool.

No retuning is authorized by this result.

## Next unresolved interpretation questions

The remaining Musical Interpretation work is about semantic quality and player-facing behavior rather than fixed-pool capacity. Appropriate next evidence includes semantic correctness against authored/reference intent and collectible-route/readability behavior. Before starting another experiment, re-check the live branch for already-preregistered work.

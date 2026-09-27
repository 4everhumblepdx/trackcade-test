# Trackcade Musical Structure v1 — Conclusion

Status: **closed as a validated product foundation**

## Decision

Do not create a second low-level structure detector before product evidence demonstrates a real gap.

Trackcade Analyzer v0.19 already supplies enough objective larger-scale evidence to build a conservative automatic game baseline:

- exact timing map and beat times;
- timing confidence/tier;
- 240-sample energy curve;
- structural event/landmark times and intensity;
- section candidates and confidence;
- low-demand windows;
- structure confidence/diagnostics.

The correct architecture is now:

**v0.19 Analyzer → Structure Evidence v1 → safe playable baseline → optional semantic interpretation → deterministic semantic QC → gameplay**

v0.19 remains frozen and unchanged.

## What the two product fixtures established

Using existing hand-authored ALLDAT and CVB manifests as qualitative product fixtures rather than scientific ground truth:

### Energy is strong

- ALLDAT energy-curve Pearson correlation: `0.9376664141`
- CVB energy-curve Pearson correlation: `0.8879806896`

The Analyzer energy curve is sufficiently useful to drive the existing continuous difficulty blend directly.

### Structural timing contains useful signal

Within 2 seconds, Analyzer event/section landmarks recovered:

- ALLDAT: `72.73%` of authored landmarks
- CVB: `50%`

Within 4 seconds:

- ALLDAT: `100%`
- CVB: `75%`

The Analyzer often finds the right musical neighborhood even when its broad section segmentation differs from hand authoring.

### Analyzer semantic labels are not gameplay authority

Among nearest Analyzer/authored events within two seconds, exact kind agreement was only `1/8` on each fixture.

Therefore Analyzer labels such as `drop`, `peak`, `build`, and section names remain diagnostic hints only.

They must not directly trigger Trackcade effects.

## Structure Evidence v1

`research/structure-v1/export_structure_evidence_v1.py`

Exports objective evidence while explicitly marking all semantic Analyzer hints non-authoritative.

Validation run:

- workflow: `Trackcade Structure v1 — Evidence Export`
- run ID: `36281298997`
- artifact ID: `10919375182`
- artifact digest: `sha256:3d4364ab01ee51b4b244f0033aeb5ca598393164e805c6149d4f25c37d9805fc`

## Safe automatic gameplay baseline

`research/structure-v1/generate_safe_manifest_v1.py`

Generation uses:

- every v0.19 `beatTimes` entry as an authored Trackcade beat;
- v0.19 `energyCurve` directly;
- v0.19 section starts as generic unnamed visual section changes;
- zero automatic `drop`, `peak`, or discrete `energy` commands.

`visual-only` timing is refused for beat-driven gameplay.

The generator now accepts only minimal new-song metadata:

- artist;
- title;
- audio URL.

Palette, art, and gameplay tuning may be omitted; Trackcade's real loader fills its built-in `FALLBACK_TRACK` values.

Minimal-metadata validation run:

- workflow: `Trackcade Structure v1 — Safe Manifest Generation`
- run ID: `36281637484`
- conclusion: success

## Per-song immutable identity

v0.19 `sourceFingerprint` was observed as 64 zeroes on multiple distinct raw-run fixture tracks, so it is not trusted as a uniqueness key in this pipeline.

Both Structure Evidence and the safe manifest now record:

`analysisJsonSha256`

This is the SHA-256 of the exact v0.19 analysis JSON consumed by the downstream layer.

The semantic compiler requires exact agreement across safe manifest, evidence, and interpretation proposal.

## Semantic interpretation trust boundary

`research/structure-v1/compile_semantic_events_v1.py`

A higher-level interpreter may propose:

- named sections;
- energy commands;
- peaks;
- drops.

It cannot propose final timing independently. Every semantic event must reference an existing deterministic evidence anchor.

The compiler enforces:

- exact Analyzer/analysis identity;
- timing-tier eligibility;
- confidence thresholds;
- objective energy/intensity gates;
- low-demand suppression;
- same-kind and high-impact cooldowns;
- preservation of beat grid, energy curve, BPM, beat offset, duration, identity, and game tuning.

Validation run:

- workflow: `Trackcade Structure v1 — Semantic QC Compiler`
- run ID: `36281496925`
- conclusion: success
- artifact ID: `10918508553`
- artifact digest: `sha256:2165c09e3819de1405a024b1cc5331bf68cb31b2e05a3174dbd8a35eb11829f6`

The test suite proved:

- valid real-evidence anchors can compile;
- low-confidence proposals are rejected;
- weak objective evidence is rejected;
- low-demand high-impact events are rejected;
- cooldown conflicts are rejected;
- invalid anchor references are rejected;
- an empty interpretation leaves the safe gameplay baseline unchanged;
- a proposal for CVB applied to ALLDAT fails closed on `analysisJsonSha256`.

## End-to-end audio → game proof

`research/structure-v1/run_audio_to_trackcade_v1.py`

Workflow:

`Trackcade v1 — Audio to Safe Game`

Run:

`36281724431`

Artifact:

- name: `trackcade-audio-to-game-v1-alldat`
- artifact ID: `10918194081`
- artifact digest: `sha256:cf24b180a3c6072913628b399d2798f0fc095818c5f188c5b08dd0bbe110b9d7`

Input:

- actual `ALLDAT_ruffmix.mp3`
- minimal metadata containing only artist/title/audio URL

The pipeline:

1. rebuilt exact released v0.19;
2. verified runner SHA `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`;
3. decoded the MP3 deterministically;
4. reran the Analyzer;
5. reproduced the previously audited analysis SHA exactly:
   `a95621998fcd296bd382c553f43853cc71aa98f019914cb2b9f90cdcb7c0d405`;
6. generated Structure Evidence v1;
7. generated the safe Trackcade manifest;
8. validated the final manifest using Trackcade's real loader.

Output facts:

- timing tier: `loose`
- timing confidence: `0.5383`
- structure confidence: `0.6664`
- 590 Analyzer-authored beat events
- 14 generic section events
- 240 energy samples
- 0 semantic high-impact events
- safe and final manifest SHA-256 identical:
  `73f94cd76ada36ac402152587b0854b0025429c0e6d474fa1bc44880737e2133`
- Structure Evidence SHA-256:
  `bc6e7d289a71dc25447b6771c58fccba05d3adfa9fb4012b21595fa999658cee`

This is the first validated automatic path from a music file plus basic identity metadata to a playable Trackcade manifest without a hand-authored music timeline.

## What is finished vs. what is not

Finished:

- low-level deterministic timing foundation;
- objective structure/energy evidence bridge;
- conservative playable auto-manifest fallback;
- minimal uploader metadata path;
- optional semantic proposal/QC interface;
- end-to-end deterministic audio-to-game pipeline proof.

Not finished:

- a real learned/audio-capable semantic interpreter;
- song-adaptive gameplay/difficulty profile generation beyond the current energy curve + fallback tuning;
- visual/world generation;
- difficulty variants;
- personalization;
- broad end-to-end gameplay QC across many songs.

## Next project lane

Proceed to **gameplay/difficulty generation v1**.

Use the current safe automatic manifest as the invariant fallback.

Do not reopen Analyzer phase research or rewrite structure DSP unless later gameplay evidence proves a concrete deficiency.

# Trackcade Musical Interpretation v1 — Evidence-Only Integration Proof

Status: **preregistered integration proof; not a production learned interpreter**

This proof extends, but does not replace, `research/structure-v1/MUSICAL_INTERPRETATION_V1_SPEC.md`.

## Purpose

Prove that a higher-level interpreter can consume label-blind deterministic Structure Evidence, propose semantic meaning only, and have those proposals pass through the already-validated deterministic semantic compiler without gaining timing authority.

This proof does **not** claim that an audio-capable or broadly learned musical-understanding model is finished.

## Frozen upstream

- Analyzer release: `v0.19`
- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- Structure v1 closure commit: `d2da0110c8303f2de7e661e4cf440a883819b0c7`
- Structure Evidence workflow run: `36281298997`
- Structure Evidence artifact ID: `10919375182`
- Structure Evidence artifact digest: `sha256:3d4364ab01ee51b4b244f0033aeb5ca598393164e805c6149d4f25c37d9805fc`
- Safe-manifest workflow run: `36281637484`

## Interpretation packet

`build_interpretation_packet_v1.py` consumes `trackcade-structure-evidence-v1` and emits `trackcade-interpretation-packet-v1`.

The packet must preserve objective evidence needed for interpretation:

- immutable Analyzer/source identity;
- timing trust;
- structure trust excluding diagnostic semantic fields;
- objective sections;
- objective boundaries and local energy context;
- objective landmarks/intensity and local energy context;
- low-demand windows;
- global and sampled energy evidence.

The packet must remove all keys containing `diagnostic` and all `semanticGameplayAuthorized` flags. Analyzer semantic hints such as `drop`, `peak`, `build`, or section-label hints are therefore unavailable to the interpreter.

The packet explicitly states that independent timestamps, beat edits, and BPM edits are forbidden.

## Fixture proposals

The first integration proof uses two explicit evidence-only proposal fixtures, one for ALLDAT and one for CVB — G.E.M.F.

The proposals are authored from the label-blind interpretation packets using objective energy change, landmark intensity, section confidence, low-demand windows, and temporal spacing. They are fixture evidence for the integration architecture only; they are not a production-model benchmark and do not authorize a provider-specific runtime dependency.

No hand-authored Trackcade event labels are used to choose the proposals.

## Deterministic gates

For each fixture:

1. build the interpretation packet twice and require byte-identical output;
2. assert the packet contains no `diagnostic` text;
3. require proposal source identity to match the exact Structure Evidence and safe manifest;
4. compile the same proposal twice using the existing `compile_semantic_events_v1.py` unchanged;
5. require byte-identical compiled manifests and reports;
6. require at least one semantic proposal to survive QC;
7. preserve all beat events, energy curve, BPM, beat offset, duration, art/palette, and gameplay tuning from the safe baseline;
8. require every compiled semantic event time to come from its referenced deterministic Structure Evidence anchor;
9. preserve the safe baseline if an individual proposal is rejected.

## Fail-closed interpretation

A failure of packet construction, source identity, semantic confidence, objective gates, cooldowns, or immutable-field preservation is evidence against that proposal/integration path. Do not move compiler thresholds or edit anchor evidence to make this proof green.

## Outcome boundary

A green result proves the optional interpretation architecture works end-to-end on the two current product fixtures:

**frozen v0.19 / Structure Evidence → label-blind semantic proposal → deterministic semantic QC → safe manifest plus accepted semantics**

It does not prove broad musical-form recognition, audio-native semantic understanding, or production-quality generalized inference across arbitrary songs.

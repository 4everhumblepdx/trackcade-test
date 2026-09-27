# Semantic Internal Holdout v1 — Recovery Status (2026-09-27)

Status: **HOLD — NO SOL SEMANTIC CALLS AUTHORIZED YET**

This note records recovery/verification work performed after commit `61701d6feb34305f514cf2059d67c2f55e537175` without changing any frozen scientific identity or semantic policy.

## Current frozen prerequisite

The committed compiler-input manifest requires the exact pre-Sol archive:

- `compiler-inputs-v1.tgz`
- size: `49,885` bytes
- SHA-256: `d89d23ebde2f47e46113c834f60ec18308fef1834ed6e81e2bbacdae8048832a`

That archive is still absent from the Git tree. No seven-track semantic workflow run exists on this branch and no semantic provider call has been made for these seven tracks during this recovery.

## Exact source audio recovered

The seven source MP3s were recovered from the user Library and each byte identity matches `FROZEN_TRACKS_V1.json`:

| track | source SHA-256 |
|---|---|
| I Feel Music (Instrumental) (1) | `890dbe77dd952d36cc55e491e3836b276e149264f62701de814f93845152d96d` |
| luda_20bars | `9a9f7133009adbbca631352675293bd4468f89eb1abcc24414001e18507a26de` |
| M and Ms - MELTS IN YOUR MIND v1BL-SO-11102013 | `fd7b553138b14773f5f0c6477e401eadd0a3e4ecb686b5e985b3f4a6592d01b3` |
| MuddyWatersRough | `8846281e7341358198e8daada77b464d3514d022e00502146edc6803f4014fac` |
| Retro 9 Samp | `1e473e6a6149adb7611138201360ae22d2e19f762e3b212e68ece50b4c665c33` |
| retro not (2) | `1684bd605baa3233d8cf529cf6be5622615595d87d31991cc725fab61979b722` |
| vlado | `8e13ce1fd5f120eb21ebae9b5915d2fc30b2cedde5604c80c6aa2228198a2bc6` |

## Exact production Analyzer recovered

Historical Actions artifact `10910744049` was downloaded and verified:

- v0.19 final ZIP SHA-256: `22525126e3e3020c9c2621a71f62b694a81085b910929dfb473057293c5300ec`
- extracted Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

Both match the frozen release identities.

## Objective evidence reconstruction check

Using the exact v0.19 runner with the recovered source audio, native source sample rate, native stereo channel count, and each MP3 SHA-256 as `sourceFingerprint`, the deterministic analysis content reproduces all seven frozen Structure-v1 evidence bodies.

For verification, each reconstructed evidence document was serialized with the already-frozen `analysisJsonSha256` from `PACKET_MANIFEST_V1.json`. All seven resulting evidence SHA-256 values then matched `COMPILER_INPUTS_MANIFEST_V1.json` exactly:

- I Feel: `5eaf3fa6aadead43bc9ac1cd6f9f929e8e1e978aa114a1b57f93a0a1854807cd`
- luda: `501aa8f92ffa69c9d5dd6065bd0dff3eeef54320ba9a7ae7fc2618f90f224b90`
- M and Ms: `56a114fed793e86510692fec555ea9169040ea84fbf3bfd49a277832bd7a9610`
- Muddy: `c0791943246ea10067d451f667917bdd1c7951b844972f75a93aa04c28bfe02e`
- Retro 9: `cd3b9be6764184fb9fcb3b094f2e969b288e68f4003d52e18dafc64cb58a8e93`
- retro not: `25e269c5bd7432964ace9f0e53ffb45bba31a4b47a7eaa97f1a77ba0a5e908ee`
- vlado: `49a818d46128b47273df8b6109745d14a7064857a7107a6881ae6f8e43a0fe1a`

This establishes recovery of the frozen objective evidence content. It does **not** establish byte identity of the original Analyzer JSON files, because the recovered rerun has not matched the frozen `analysisJsonSha256` values.

## Packet files and packet archive packaging recovered exactly

Building `trackcade-interpretation-packet-v1` from the reconstructed exact evidence reproduces all seven committed packet SHA-256 values from `PACKET_MANIFEST_V1.json`.

The deterministic archive recipe was also recovered by forensic comparison against the frozen packet archive. The exact `packets-v1.tgz` identity is reproduced when:

- members are named `packets/<case-id>.json`;
- GNU tar format is used;
- regular-file mode is `0644`;
- uid/gid are `0` with numeric ownership;
- member mtime is normalized to Unix timestamp `1790467200` (`2026-09-27 00:00:00 UTC`);
- members are supplied in frozen case order;
- tar output is piped to GNU gzip with `-n -6` (gzip mtime/name suppressed).

The resulting archive is exactly:

- size: `26,841` bytes
- SHA-256: `6484057569732e6064203efeb92cc1909516ff8387a5f86e2f66ab255210a848`

This is a byte-for-byte reproduction of the already-frozen packet archive.

## Remaining blocker: frozen safe manifests / compiler archive

The seven frozen safe-manifest SHA-256 values have **not** been reproduced yet. The persisted Git state contains their hashes but not their bytes or the original per-track metadata inputs (`artist`, `title`, `audioUrl`, and any additional metadata), and the frozen raw Analyzer JSON byte identities have not yet been recovered.

Because `generate_safe_manifest_v1.py` depends on the full Analyzer beat grid plus track metadata, creating a new semantically equivalent safe manifest would not satisfy the already-frozen byte identities.

The original exact `compiler-inputs-v1.tgz` was previously known locally but was not persisted to GitHub or the current file Library. Current branch/ref inspection, Actions inspection, Library inspection, prior-context recovery, and runtime filesystem inspection did not recover those original archive bytes.

## Scientific decision

Do **not** run Sol on the seven tracks yet.

Do **not** replace the frozen compiler archive with a newly generated equivalent archive.

The next acceptable action is recovery of one of the following pre-Sol frozen artifacts:

1. the original `compiler-inputs-v1.tgz` whose SHA-256 is `d89d23ebde2f47e46113c834f60ec18308fef1834ed6e81e2bbacdae8048832a`; or
2. the original seven safe-manifest bytes plus sufficient original inputs/provenance to reconstruct and verify that exact archive.

Only after the exact compiler archive hash is verified should the seven-track Sol workflow be wired/executed under `PROTOCOL_V1.md`.

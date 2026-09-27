# Trackcade Art Assets v1 — Skyline Publication Attempt 1

Status: **publication blocked by current tool transport; production remains unchanged**

This result records publication-path work after `ART_ASSETS_V1_CURRENT_STATE.md` so later work does not repeat the same dead ends.

## State verified before action

Branch `trackcade-art-assets-v1` was still at checkpoint `78dfa5dff3a8c7bb7f6ba2f716d371f67d39c899` before this record was created.

Upstream production remains unchanged:

- Analyzer: `release/analyzer-v0.19`
- Analyzer source: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- Gameplay/Difficulty v1 closure: `141bf6127d7af763ea04e497bfe5fcf6e5ff364c`
- Visual/World v1 closure: `8c3bc6dc07067c3cea016ff76b2023a29fde7933`

No production manifest art URL was changed.

## Accepted bytes reverified

The already-accepted normalized skyline files were rechecked locally before attempting publication.

### ALLDAT / violet-circuit

- final format: 384 × 240, 8-bit RGBA PNG, non-interlaced
- byte length: 220970
- SHA-256: `40a5528c9548c2d0c09f3db59804efb1609cd5199c6f900728aa96cc77062110`

### CVB — G.E.M.F. / neon-night

- final format: 384 × 240, 8-bit RGBA PNG, non-interlaced
- byte length: 224685
- SHA-256: `32133839842b3bf8855e2164e6489b0e0956b2de7246887602b355d24f9d7f54`

No image regeneration or renormalization occurred.

## Publication paths tested

### 1. Direct GitHub binary publication through the available connector

The GitHub connection can create UTF-8 files and can create blobs from an inline `content` string with `encoding=base64`, but the available action surface does not expose a binary-file parameter or release-asset upload that can consume the existing local PNG file reference directly.

Relaying these accepted 220–225 KB PNGs through model-visible base64 text was rejected as an unsafe publication method because tool-output/payload truncation could corrupt bytes or break provenance.

Result: **not used**.

### 2. Google Drive byte-preserving staging

Both exact accepted PNGs were uploaded to Drive as raw `image/png` files. Provider metadata reported the expected byte lengths.

However, their Drive permission metadata is private owner-only. The available Drive sharing action can grant access to named users or the connected Workspace/domain, but it does not expose anonymous public sharing suitable for a Trackcade runtime asset URL.

Result: **bytes preserved, but not a valid public runtime host**.

### 3. Higgsfield media hosting bridge

A Higgsfield upload slot can provide an HTTPS CloudFront media URL after the exact bytes are PUT to its presigned upload endpoint.

The normal local execution environment has no outbound DNS, so it could not PUT the local files to the presigned S3 endpoint. A second attempt used the internet-enabled Higgsfield sandbox and tried to fetch the temporary authenticated raw-file URL created from the Drive-staged bytes; that request returned HTTP 403.

No Higgsfield media upload was confirmed, and no Higgsfield URL was placed into a manifest.

Result: **bridge unavailable from the current tool boundary**.

## Integrity decision

Do **not** weaken the existing Art Assets v1 publication gate to work around tool transport.

Specifically, do not:

- regenerate the skyline merely to obtain a different host;
- re-normalize or recompress the accepted final PNGs to make transport easier;
- use a private/authenticated Drive URL as `art.skyline`;
- use an expiring signed URL as a production asset URL;
- copy large binary payloads through lossy/truncated model-visible base64;
- modify production manifests before hosted bytes can be independently re-hashed.

The existing production skyline remains the fallback.

## Next valid action

Obtain a byte-preserving public hosting path that can ingest the exact accepted PNG file references directly. Once available:

1. publish the two exact normalized PNGs without transcoding;
2. fetch each public URL independently and verify the frozen SHA-256;
3. run the existing fail-closed skyline candidate/manifest immutability proof;
4. create test manifests changing only `art.skyline`;
5. verify runtime loading plus unchanged Analyzer / Structure / Gameplay / Visual semantics;
6. promote only after the hosted-byte proof is green.

A connected deployment/storage provider that can accept local file references directly is an appropriate way to reopen this publication step. Until then, Art Assets v1 is **blocked at hosting only, not generation or normalization**.

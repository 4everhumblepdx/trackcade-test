# Trackcade Art Assets v1 — Skyline Publication Attempt 2

Status: **GitHub text-staging route rejected; production remains unchanged**

## Why this attempt existed

After Publication Attempt 1 established that the exact accepted skyline PNGs could not yet be handed directly to a public byte-preserving host through the connected tools, a GitHub-native reconstruction route was explored: encode the accepted PNG bytes as base64 text chunks, reconstruct them in GitHub Actions, verify the frozen final PNG SHA-256 values, and only then allow binary publication.

This attempt was diagnostic only. No production manifest URL was changed.

## Frozen accepted identities

### ALLDAT / violet-circuit

- final PNG byte length: `220970`
- final SHA-256: `40a5528c9548c2d0c09f3db59804efb1609cd5199c6f900728aa96cc77062110`
- complete base64 length from the accepted local PNG: `294628` characters

### CVB — G.E.M.F. / neon-night

- final PNG byte length: `224685`
- final SHA-256: `32133839842b3bf8855e2164e6489b0e0956b2de7246887602b355d24f9d7f54`
- complete base64 length from the accepted local PNG: `299580` characters

## Staging observations

An earlier `staging/skyline-v1` experiment created only three roughly 20k-character text files per song. Those files are far shorter than the complete accepted base64 payloads and are therefore incomplete by construction. They are not candidate assets and must not be decoded or published.

A later `staging/skyline-v1-fixed` probe attempted an approximately 18k-character source slice for ALLDAT. The stored GitHub file reported `17999` bytes and did not establish byte-for-byte identity with the locally expected source slice. It is non-authoritative.

A final smaller probe at `staging/skyline-v1-fixed8k/alldat/part-00.b64` also failed as a transport proof. The request payload itself was malformed/truncated before storage; GitHub stored only `5617` bytes. Because the source request was not trustworthy, this is **not evidence of a GitHub storage defect**. It is evidence that manually relaying large binary-derived text through the model/tool payload is not an acceptable provenance-preserving channel.

## Decision

Reject manual/model-visible base64 staging as an Art Assets v1 publication mechanism.

Do not:

- concatenate any existing staging fragments into a PNG;
- treat any staging fragment as accepted asset data;
- generate additional chunk-size probes;
- regenerate or recompress the accepted skyline PNGs to work around transport;
- change `art.skyline` until a public host can ingest the exact accepted bytes directly and they can be independently re-hashed.

The existing production skyline remains the fallback.

## Art-lane boundary

The preregistered replacement contract remains controlling: gameplay sprite generation stays blocked until the skyline path proves generation → normalization → QC → manifest publication safely.

Art Assets v1 therefore remains open but externally blocked at exact-byte public publication. Other independent Trackcade layers may continue, but this lane must resume from the frozen accepted skyline hashes above rather than regenerate candidates.

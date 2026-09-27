# Trackcade Art Assets v1 — Skyline Generation v1.1 Result

Status: **generated candidates structurally accepted as evidence; not production-published**

## Frozen prerequisites

- replacement contract commit: `9053a0b9045450460558607876da68ccfc03f9b7`
- v1.1 normalization spec commit: `14ec1c1ef541145dd4895c031291c2b6646add78`
- terminal v1.1 normalizer proof run: `36292880983`
- terminal v1.1 normalizer artifact ID: `10923196092`
- terminal v1.1 normalizer artifact digest: `sha256:6e2f3fa88da158e63e38ac18ec410f4236a84c02f3c6f348856902a6af21006b`
- normalizer proof result commit: `abaf6bf6a389037fe632b495a1117fa07c23184d`

The v1.1 contract and its synthetic variable-size normalization proof existed before either primary candidate below was generated.

## ALLDAT / violet-circuit v1.1 primary candidate

The exact frozen ALLDAT skyline instruction from `ART_ASSET_REPLACEMENT_SPEC.md` was used for one new primary candidate after v1.1 preregistration.

Generation identity:

- generation ID: `4bbaf656-04d2-4ede-8a09-0cd1cd9e19dc`
- returned source dimensions: `2048 × 768`
- PNG bit depth: `8`
- PNG color type: `2` (RGB)
- interlace: `0`
- source byte length: `2152806`
- source SHA-256: `e7642268ae3fe86bfbe9d2dc8196093d0a71b8c82445b606476b33b35925f139`

Frozen v1.1 normalization:

- integer scale `k`: `3`
- centered crop x: `448`
- centered crop y: `24`
- crop size: `1152 × 720`
- frozen background: `#08061a` → `#24134a`
- final dimensions: `384 × 240`
- final PNG bit depth/color type/interlace: `8 / 6 RGBA / 0`
- final alpha > 0 coverage: `1.0`
- final alpha >= 128 coverage: `1.0`
- fully opaque pixels: `92160 / 92160`
- distinct final RGB colors: `36502`
- final byte length: `220970`
- final SHA-256: `40a5528c9548c2d0c09f3db59804efb1609cd5199c6f900728aa96cc77062110`

The frozen normalization was executed twice from the same source bytes in the current evidence session; final PNG bytes matched exactly.

Structural decision:

`ACCEPTED AS EVIDENCE`

## CVB — G.E.M.F. / neon-night v1.1 primary candidate

The exact frozen CVB skyline instruction from `ART_ASSET_REPLACEMENT_SPEC.md` was used for one new primary candidate after v1.1 preregistration.

Generation identity:

- generation ID: `5aeabffb-afba-45e1-be88-1eddb0a60059`
- returned source dimensions: `2048 × 768`
- PNG bit depth: `8`
- PNG color type: `2` (RGB)
- interlace: `0`
- source byte length: `2265490`
- source SHA-256: `f01d7c0980298dbdfb7990a01b798d016230d098f5fa149bffcfe04eb123d552`

Frozen v1.1 normalization:

- integer scale `k`: `3`
- centered crop x: `448`
- centered crop y: `24`
- crop size: `1152 × 720`
- frozen background: `#070a1e` → `#1b1440`
- final dimensions: `384 × 240`
- final PNG bit depth/color type/interlace: `8 / 6 RGBA / 0`
- final alpha > 0 coverage: `1.0`
- final alpha >= 128 coverage: `1.0`
- fully opaque pixels: `92160 / 92160`
- distinct final RGB colors: `30610`
- final byte length: `224685`
- final SHA-256: `32133839842b3bf8855e2164e6489b0e0956b2de7246887602b355d24f9d7f54`

The frozen normalization was executed twice from the same source bytes in the current evidence session; final PNG bytes matched exactly.

Structural decision:

`ACCEPTED AS EVIDENCE`

## Independent final-file validation

Both normalized final files were independently parsed after normalization and confirmed:

- valid `384 × 240` PNG structure;
- 8-bit RGBA color type 6;
- non-interlaced;
- scanlines decode correctly;
- all `92160` pixels fully opaque;
- more than two distinct opaque RGB colors.

This satisfies the frozen skyline structural PNG/alpha/content gate.

## Production publication boundary

These structurally accepted files are **not yet production skyline replacements**.

The generated final bytes currently exist as evidence files in the active ChatGPT work session, but Art Assets v1 has not established a stable public HTTP(S) URL whose bytes are pinned to the final SHA-256 values above.

Therefore:

- no Trackcade manifest has been changed;
- no `art.skyline` URL has been replaced;
- relaxed/standard/rush continue to use the existing closed Visual-v1 production skyline URL;
- gameplay/music/palette/provenance remain unchanged.

This is the fail-closed behavior explicitly required by the replacement contract.

## Attempt 1 remains closed

The two previously refused Attempt 1 candidates remain refused. They were not reused or grandfathered into v1.1.

The v1.1 candidates recorded here are newly generated after the revised source-size contract and validated normalizer proof existed.

## Next evidence step

Establish stable hosting for the exact normalized PNG bytes (or an equivalent immutable repository asset path), verify the hosted-byte SHA-256, then run the already-created fail-closed skyline candidate intake / manifest-immutability path before any production URL is changed.

Until that succeeds, existing production art remains authoritative.
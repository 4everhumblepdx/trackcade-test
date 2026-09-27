# Trackcade Art Assets v1 — Skyline Normalization Verified Result

Status: **verified deterministic normalization path; no generated skyline candidate consumed yet**

## Identity

- Replacement contract commit: `9053a0b9045450460558607876da68ccfc03f9b7`
- Normalization spec commit: `0154bf24d3ab7128f01055cb1efac78b76336843`
- Normalizer implementation commit: `043116e5b073f890e9b8f25b6903e670dcb3d636`
- Workflow/head commit: `207b0e4e2d9a5d9295f0ff8060017accb4969ee4`
- Workflow run: `36292179242`
- Conclusion: `success`
- Artifact: `trackcade-art-assets-v1-skyline-normalizer-proof`
- Artifact ID: `10922687091`
- Artifact size: `772018` bytes
- Artifact digest: `sha256:208f98d1f35cdcff02b49983179f3e096d8b6ba200150b3f55a4677acaec1196`

## Proof fixture

A deterministic `1536 × 1024` RGBA PNG fixture with opaque, partially transparent, and fully transparent regions was built in CI.

Fixture SHA-256:

`324140ac6187557cf4bb8b5127d2eec1840299e567504543757ef61acbee428f`

This deliberately exercised the same alpha-compositing path a generated PNG may need.

## ALLDAT / violet-circuit normalization

Frozen background:

- skyTop: `#08061a`
- skyBottom: `#24134a`

Verified final output:

- dimensions: `384 × 240`
- 8-bit RGBA PNG
- non-interlaced
- alpha coverage: `1.0`
- fully transparent pixels: `0`
- fully opaque pixels: `92160`
- distinct opaque RGB colors: `46287`
- output SHA-256: `f3342b6a0307fb7eade052876faaf879a4883181b5b83eeb40954be20684af5a`
- output bytes: `143248`
- report SHA-256: `097e6b4f8d9099c22ccf4e717a4fea72cc40b0984fee33157153a9843103b54f`

## CVB — G.E.M.F. / neon-night normalization

Frozen background:

- skyTop: `#070a1e`
- skyBottom: `#1b1440`

Verified final output:

- dimensions: `384 × 240`
- 8-bit RGBA PNG
- non-interlaced
- alpha coverage: `1.0`
- fully transparent pixels: `0`
- fully opaque pixels: `92160`
- distinct opaque RGB colors: `45718`
- output SHA-256: `92b8dec4397cc5d1e154395ea6e809318f5ce96e8caaa1f284da7d55e40a7783`
- output bytes: `141559`
- report SHA-256: `76815df220c47c7f265cb3d64ddcf5f0ead06973405116f976b79ba85ba83965`

## Determinism

Each palette normalization was executed twice from the same fixture.

The two final PNGs and two JSON reports for each song were byte-identical.

## Frozen source hashes

From terminal run `36292179242`:

- replacement spec: `efa8905fdead74e6176f01c4511b31c70d363b42ceece3623f0aff3b123e127b`
- skyline normalization spec: `192cb4ef0cf7da7948be1c4825f668657678e18a9b8e07547e1209a70213e962`
- skyline normalizer: `d11f1bef5239966a6b7081c884aebaf563a1d67836de0ad427eec14f9bcaf0ef`

## What this proves

The candidate-to-final skyline transformation is deterministic and handles source transparency without browser canvas, GPU, Pillow, ImageMagick, or implementation-dependent resampling.

The engineering path is now ready to consume one real generated `1536 × 1024` PNG candidate per song under the already-frozen generation instructions.

## What this does not prove

This run did not consume AI-generated art and therefore does not claim:

- generated-image aesthetic quality;
- generated candidate format compliance;
- tile/seam quality;
- successful hosting/public URL publication;
- production manifest replacement.

Until those are separately proven, the existing production skyline remains the fail-closed release asset.
# Trackcade Art Assets v1 — Skyline Normalization v1.1 Verified Result

Status: **verified deterministic variable-source normalization path**

## Identity

- v1.1 normalization spec commit: `14ec1c1ef541145dd4895c031291c2b6646add78`
- implementation commit: `9b72572b22d22e3785e24912ef7fe649afac9139`
- first validation workflow/head: `17d52e5fad50b52b356dfb68aedd4da112639d9c`
- first run: `36292825291`
- first run result: `failure` from implementation bug `row is not defined`; no contract failure inferred
- bug-fix commit: `1518a84d617b2f3b2075ea6a83e01412b6fff490`
- terminal validation run: `36292880983`
- terminal conclusion: `success`
- artifact: `trackcade-art-assets-v1-skyline-normalizer-v1-1-proof`
- artifact ID: `10923196092`
- artifact size: `607084` bytes
- artifact digest: `sha256:6e2f3fa88da158e63e38ac18ec410f4236a84c02f3c6f348856902a6af21006b`

## Verified variable-source cases

### 2076 × 758 RGBA fixture

- integer reduction scale: `3`
- exact centered crop: x `462`, y `19`, size `1152 × 720`
- final: `384 × 240`, 8-bit RGBA, non-interlaced
- alpha coverage: `1.0`
- fully opaque pixels: `92160`
- distinct RGB colors: `26086`
- final SHA-256: `b48f053ae1810421a50b9390da576c14c46ac40a3dd26fcc39fc98921ed4cca3`
- report SHA-256: `589367205d3ad030364d4e20d0c72dd01b589aff62e0dffa885d0f008a481f12`

### 1947 × 808 RGB fixture

- integer reduction scale: `3`
- exact centered crop: x `397`, y `44`, size `1152 × 720`
- final: `384 × 240`, 8-bit RGBA, non-interlaced
- alpha coverage: `1.0`
- fully opaque pixels: `92160`
- distinct RGB colors: `18937`
- final SHA-256: `8bc2d903b0feae800795a8a41d3c4552efe2d3a22e7ec40f648fdf942f6ea1b0`
- report SHA-256: `4556d8d92cd67cf7ea2520305f93871c641bd4933d30690cd6cd908d09b6086d`

Both cases were normalized twice and byte-compared; outputs and reports matched exactly.

## Frozen source hashes

- v1.1 spec SHA-256: `d661979f383d57a19b1fc5e562bee2caf891be93dd6de73f5a77dd11d4f299b9`
- fixed v1.1 normalizer SHA-256: `faac75b218b10a4b9e70f3500530639d34edd68aed516b93e92cfb02a4b5a14e`

## Decision

The v1.1 source-dimension policy is now validated before any v1.1 primary generated skyline candidate is accepted.

The separately preregistered next step is to generate exactly one new primary candidate per product song using the frozen instruction text, then apply only this validated v1.1 normalization path.

Attempt 1 refused images remain refused and are not grandfathered into this proof.
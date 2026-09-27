# Trackcade Art Asset Generation v1 — Verified Production Baseline

Status: **verified read-only baseline; no replacement art generated yet**

## Provenance

- Analyzer production: `release/analyzer-v0.19`
- Analyzer commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- Structure artifact digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`
- Gameplay/Difficulty v1 closure: `141bf6127d7af763ea04e497bfe5fcf6e5ff364c`
- Gameplay variant artifact digest: `sha256:cd52c03393f3aa5cd9f45ed45e0e3833b145220232ff719dc5353b4e3d12b5c8`
- Visual/World v1 closure: `8c3bc6dc07067c3cea016ff76b2023a29fde7933`
- Visual artifact digest: `sha256:054e34dbb20a10184138167066476d64e9a5ede42c1c6bbbd19ae156ba29ada0`

## Audit identity

- Preregistered baseline spec commit: `b6ef8090d570e0e01d8cc5a8f232ae788d75497c`
- Audit implementation commit: `90e8607bc51e53b23a1aceebd32837ac70b95ad1`
- Workflow/head commit: `6a1c8275ef08fdf65c28a7b3c9e489380d48668f`
- Workflow run: `36291898561`
- Conclusion: `success`
- Artifact: `trackcade-art-assets-v1-baseline-audit`
- Artifact ID: `10921669972`
- Artifact size: `101583` bytes
- Artifact digest: `sha256:7e8f509e30d24e928c0ded97126af08d904e01a0bd4fe50ac3faa757dc1ae31e`
- Audit report SHA-256: `ce4b26a5ad629e4f3a7fb7b2be5e40a467098a002b26dad52ae55a77a6468949`

The workflow fetched every current production art URL twice. Both downloaded asset sets and both reports matched byte-for-byte.

## Engine frame behavior

The current Trackcade path is now verified from checked-in engine source:

1. `Play.preload()` queues each art URL with `load.image(url)`.
2. `Play.setup()` calls `game.assets.framesOf(url)` without frame dimensions.
3. `Assets.registerImage()` therefore uses the full image height as its only row.
4. `Atlas.add()` defaults an absent frame width to `src.width`.
5. Each art URL is therefore one complete image/frame, not a sprite sheet.

This is the format contract Art Assets v1 must preserve unless the runtime itself is deliberately changed in a later project.

## Verified production PNG facts

All six current assets are:

- valid PNG files;
- 8-bit;
- PNG color type `6` (RGBA);
- non-interlaced;
- successfully decoded by the deterministic baseline auditor.

### Player

- source dimensions: `49 × 64`
- runtime presentation basis: `49 × 64`
- exact dimension match: yes
- alpha > 0 coverage: `0.5487882653061225`
- alpha >= 128 coverage: `0.5487882653061225`
- alpha > 0 bounding box: full `49 × 64` canvas
- asset SHA-256: `4e2960a4170d83238cde2c885cf35d28a9d49b898e4fcf444b03c74c88c1aee8`

### Low obstacle

- source dimensions: `64 × 33`
- runtime presentation basis: `64 × 33`
- exact dimension match: yes
- alpha > 0 coverage: `0.8338068181818182`
- alpha >= 128 coverage: `0.8338068181818182`
- alpha > 0 bounding box: full `64 × 33` canvas
- asset SHA-256: `4d01e3153b9852c8a77a949a4d8bbcc384083ca3f9a6d01b2ba39600aa35572d`

### Wall obstacle

- source dimensions: `59 × 64`
- runtime presentation basis: `59 × 64`
- exact dimension match: yes
- alpha > 0 coverage: `0.9536546610169492`
- alpha >= 128 coverage: `0.9536546610169492`
- alpha > 0 bounding box: full `59 × 64` canvas
- asset SHA-256: `ef1c45d3dcac946f5485251d2c699c12d64adc65df47071f5f6629d9268edc69`

### Orb

- source dimensions: `63 × 64`
- runtime presentation basis: `63 × 64`
- exact dimension match: yes
- alpha > 0 coverage: `0.7614087301587301`
- alpha >= 128 coverage: `0.7614087301587301`
- alpha > 0 bounding box: x `0..62`, y `1..63` (`63 × 63`)
- asset SHA-256: `9bb2bf2e8940ea405bea709542a427266304aed30b527492b257bb04ef20e6ee`

### Energy cell

- source dimensions: `36 × 64`
- runtime presentation basis: `36 × 64`
- exact dimension match: yes
- alpha > 0 coverage: `0.9105902777777778`
- alpha >= 128 coverage: `0.9105902777777778`
- alpha > 0 bounding box: full `36 × 64` canvas
- asset SHA-256: `6985b0d0a82e21657b7689e015943c84bddaf97f143c21bcaccbd10d9baade75`

### Skyline

- source dimensions: `384 × 240`
- runtime presentation aspect basis: `384 × 240`
- exact dimension/aspect match: yes
- alpha > 0 coverage: `1.0`
- alpha >= 128 coverage: `1.0`
- alpha > 0 bounding box: full `384 × 240` canvas
- asset SHA-256: `b07a00af394df02c98a95475ec3d95c7cdbe304ed6e1c4f6990ca37ddd7fedc7`

## Key finding

The renderer’s hard-coded role dimensions were not merely approximate presentation hints. They exactly match the source dimensions of all six proven production art assets.

That allows Art Assets v1 to require exact replacement dimensions with no resizing ambiguity at runtime.

The five gameplay sprites use RGBA transparency. The current skyline is RGBA-encoded but fully nontransparent across the image.

## Frozen source hashes from terminal run

- baseline audit spec: `e213d22037736a03304363547ec68f8b6b4728a727d8258d51d14faebd002d04`
- baseline auditor: `18ef6756dc678288cef1351b2418b3461028808e40a1a64d1b24ad78fcecdccf`
- `src/track.config.js`: `6a1ec54d83b404d07b26c252091a6486a58b0619799583aaec7adc137aa94bdf`
- `src/scenes/play.js`: `d067ffbe1e28cf620bb932f94f34a02003f0aabd5e9642cefe1b72e3c68fc398`
- `engine/webgpu.js`: `e88ce9f770f8fc7ae4dd705f91f2df366bdda4791c54cbe032c37c340334fd6e`
- `engine/shared-kkws-wjJ.js`: `34473ea1858dcc495cc0265afb82bc430f2f9f00b80e77ce835aea555e4e191f`

## Evidence boundary

This baseline describes the current production assets. It does not by itself establish which deviations remain safe for generated replacements.

Replacement acceptance thresholds must be preregistered separately before any replacement image is generated.
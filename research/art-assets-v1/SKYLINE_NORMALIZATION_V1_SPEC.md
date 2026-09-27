# Trackcade Art Assets v1 — Skyline Normalization Algorithm

Status: **preregistered before any generated skyline candidate exists**

This file makes the normalization step referenced by `ART_ASSET_REPLACEMENT_SPEC.md` exact and reproducible.

## Candidate input

For the first skyline proof, request exactly one candidate per product song at:

`1536 × 1024` pixels

The candidate must be PNG and must decode as a non-interlaced 8-bit PNG with color type 2 (RGB) or 6 (RGBA).

A candidate in another size/encoding is refused in this proof rather than resized through a different path.

## Exact crop

Target Trackcade aspect is `384:240 = 8:5`.

From the required `1536 × 1024` input:

- keep full width `1536`;
- crop height to `960`;
- remove exactly `32` rows from the top and `32` rows from the bottom;
- resulting crop: `1536 × 960`.

No content-aware crop, face/object detection, or manual repositioning is allowed.

## Alpha compositing

Before downsampling, composite every cropped source pixel over a deterministic vertical sky gradient derived from the already-closed Visual-v1 palette for the song.

For crop row `y` in `0..959`:

`t = y / 959`

For each sRGB channel independently:

`bg = round(top * (1 - t) + bottom * t)`

where `top` is `skyTop` and `bottom` is `skyBottom` converted from hex to 8-bit sRGB channels.

Source alpha blend uses integer-equivalent straight-alpha compositing in sRGB channel space:

`out = round((src * alpha + bg * (255 - alpha)) / 255)`

Final composited alpha is always `255`.

RGB candidates are treated as alpha `255`.

## Exact downsample

The `1536 × 960` composited crop is reduced to `384 × 240` by a fixed non-overlapping `4 × 4` box average.

For every output pixel and each RGB channel:

1. sum the corresponding 16 input channel values;
2. output `floor((sum + 8) / 16)` (integer nearest-average with half-up behavior);
3. output alpha `255`.

No Lanczos, bicubic, browser canvas, GPU resampling, Pillow, ImageMagick, or implementation-dependent color-management path is used.

## Exact PNG write

Final output must be written as:

- PNG signature;
- one IHDR chunk;
- width `384`;
- height `240`;
- bit depth `8`;
- color type `6` (RGBA);
- compression method `0`;
- filter method `0`;
- interlace method `0`;
- scanline filter byte `0` for every row;
- one IDAT stream produced by Node zlib `deflateSync(..., { level: 9 })`;
- one IEND chunk.

PNG chunk CRC-32 values must be calculated and written explicitly.

## Determinism check

For each accepted source candidate:

- normalize twice independently;
- byte-compare final PNGs;
- require identical SHA-256 values;
- require deterministic decoder to report `384 × 240`, color type `6`, alpha coverage exactly `1.0`, and full-image bbox.

## Frozen song palettes for first proof

ALLDAT / `violet-circuit`:

- `skyTop`: `#08061a`
- `skyBottom`: `#24134a`

CVB — G.E.M.F. / `neon-night`:

- `skyTop`: `#070a1e`
- `skyBottom`: `#1b1440`

These values are copied from the closed Visual-v1 skin catalog and may not be altered to make a generated image pass.

## No fallback transformation

If candidate decode, source dimensions, source encoding, crop, or output QC fails, normalization refuses the candidate.

Do not add a second resize algorithm or alternate crop after seeing a failure. The existing proven production skyline remains the release fallback.
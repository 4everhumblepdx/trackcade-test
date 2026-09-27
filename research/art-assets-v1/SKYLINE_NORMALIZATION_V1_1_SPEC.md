# Trackcade Art Assets v1 — Skyline Normalization v1.1

Status: **separately preregistered after Attempt 1 refusal and before any v1.1 primary candidate is generated**

## Why a new experiment exists

Attempt 1 correctly refused both primary generated skylines because the image generator returned valid PNGs whose dimensions differed from the requested `1536 × 1024` source size.

This v1.1 experiment does not retroactively accept those candidates and does not alter the closed Attempt 1 decision.

The only experimental change is source-dimension handling. All final Trackcade output requirements, frozen song prompts, palette identity, music/gameplay immutability, and production fallback remain unchanged.

## Candidate input gate

A v1.1 skyline primary candidate must be:

- PNG;
- bit depth `8`;
- color type `2` (RGB) or `6` (RGBA);
- non-interlaced;
- source width `>= 768`;
- source height `>= 480`.

The image generator's returned dimensions are treated as observed candidate facts rather than assumed from the requested tool size.

## Deterministic integer-scale crop

Final output remains exactly `384 × 240` (`8:5`).

For source width `W` and height `H`, compute:

`k = min(floor(W / 384), floor(H / 240))`

Require:

`k >= 2`

Then define the exact crop size:

- crop width = `384 * k`
- crop height = `240 * k`

Center the crop using integer floor offsets:

- crop x = `floor((W - cropWidth) / 2)`
- crop y = `floor((H - cropHeight) / 2)`

This chooses the largest exact integer-scale `8:5` rectangle supported by both source dimensions. It never stretches the candidate and never uses content-aware positioning.

Examples are illustrative only:

- `1536 × 1024` → `k=4`, crop `1536 × 960`, y offset `32`;
- `2076 × 758` → `k=3`, crop `1152 × 720`, centered;
- `1947 × 808` → `k=3`, crop `1152 × 720`, centered.

The previously refused Attempt 1 files remain refused; these examples do not grandfather them into v1.1 evidence.

## Alpha compositing

Composite the selected centered crop over the frozen Visual-v1 sky gradient before reduction.

For crop row `y` in `0..cropHeight-1`:

`t = y / (cropHeight - 1)`

For each 8-bit sRGB channel:

`bg = round(top * (1 - t) + bottom * t)`

Straight-alpha composite:

`out = round((src * alpha + bg * (255 - alpha)) / 255)`

RGB input is alpha `255`.

Composited alpha is always `255`.

Frozen first-proof song backgrounds remain:

- ALLDAT / `violet-circuit`: `#08061a` → `#24134a`
- CVB — G.E.M.F. / `neon-night`: `#070a1e` → `#1b1440`

## Exact integer box reduction

Each final output pixel represents exactly one non-overlapping `k × k` source block from the composited crop.

For each RGB channel:

1. sum the `k*k` 8-bit values;
2. let `n = k*k`;
3. output `floor((sum + floor(n/2)) / n)`.

Final alpha is `255`.

This is an exact integer box average. No browser canvas, GPU resampling, Pillow, ImageMagick, bicubic, or Lanczos path is allowed.

## Exact PNG output

Final output remains:

- `384 × 240`;
- bit depth `8`;
- color type `6` RGBA;
- compression method `0`;
- filter method `0`;
- non-interlaced;
- filter byte `0` on every row;
- one IDAT stream from Node `zlib.deflateSync(..., { level: 9 })`;
- explicit PNG CRC-32 values.

## Final skyline gates

Unchanged from the replacement contract:

- alpha > 0 coverage exactly `1.0`;
- alpha >= 128 coverage exactly `1.0`;
- no fully transparent pixels;
- full-image nontransparent bbox;
- at least 2 distinct RGB colors among alpha >= 128 pixels.

## Generation instructions

The exact ALLDAT and CVB primary-candidate instruction text remains the text frozen in `ART_ASSET_REPLACEMENT_SPEC.md`.

For v1.1, generate exactly one **new** primary candidate per song after this spec commit exists.

Do not reuse either Attempt 1 refused primary candidate as v1.1 proof evidence.

## Fail-closed rule

For each song:

- one new primary candidate;
- one normalization path defined here;
- no manual crop/repositioning;
- no alternate candidate within the same proof;
- no threshold change after result;
- failed candidate leaves the existing production skyline active.

## Production boundary

Even a normalized v1.1 candidate does not replace a production manifest until a stable public URL for the exact final PNG bytes is established and the manifest swap passes loader/immutability checks.

A normalized evidence file may therefore pass while the closed Visual-v1 production skyline remains the active release asset.
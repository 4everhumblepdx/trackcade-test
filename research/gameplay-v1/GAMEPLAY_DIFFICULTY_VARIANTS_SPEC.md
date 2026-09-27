# Trackcade Gameplay / Difficulty v1 — Deterministic Variant Generation Specification

Status: **preregistered before variant-generation validation**

Purpose: turn the closed Structure v1 safe manifest into a small song-specific set of publishable gameplay modes without inventing unsupported music heuristics or weakening the existing whole-song safety gate.

This is the first gameplay/difficulty **generation** step. It does not change Analyzer v0.19, Structure v1, row-generation logic, pool sizes, collision rules, or semantic music events.

## Frozen upstream identity

Input manifests must come from the closed Structure v1 safe-manifest path.

Canonical validation source:

- Structure safe-manifest run: `36281637484`
- artifact ID: `10918568524`
- artifact digest: `sha256:10a67643cf985652c2a5974f59f0b95183ee0f2921253e525b8945eceae63c87`

Production Analyzer remains:

- branch: `release/analyzer-v0.19`
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

The later v0.20 phase-context research did not promote a production replacement.

## Why v1 uses fixed candidate modes

The repository currently has only two real product audio fixtures. That is not enough evidence to justify arbitrary BPM, genre, energy, or section thresholds for choosing difficulty.

Therefore v1 does **not** guess difficulty from a hand-written music heuristic.

Instead it:

1. creates three fixed candidate gameplay modes from the same safe music facts;
2. runs the existing deterministic whole-song preflight on each song/mode pair;
3. publishes only modes that return `qc_pass` for that exact song.

The adaptation is therefore based on the song's complete deterministic gameplay consequence, not an unvalidated proxy threshold.

## Frozen candidate modes

These values are fixed before this generator is validated.

### `relaxed`

Override only:

- `spawnRowEveryBeats = 2`

All other gameplay values remain loader defaults.

This is intentionally sparser than standard. The prior tuning stress passed this point on both current product fixtures.

### `standard`

No gameplay override.

This is the existing loader-default safe baseline and remains the invariant fallback/reference.

### `rush`

Overrides:

- `baseSpeed = 160`
- `maxSpeed = 500`
- `speedRampPerSec = 2.0`
- `spawnRowEveryBeats = 1`

All other gameplay values remain loader defaults, including `laneSwitchTime = 0.12`, `jumpTime = 0.58`, and `jumpHeight = 46`.

This is exactly the previously tested `fast-dense` point. It passed both real product fixtures under the conservative lane-only whole-song QC.

## Music facts are immutable

For every generated mode, preserve the input safe manifest's music/content facts exactly:

- artist
- title
- audio URL
- BPM
- beat offset
- song length
- event array
- energy curve
- palette/art unless already present in the source manifest
- `generation.analysisJsonSha256`
- timing tier / upstream provenance

The generator may add gameplay-generation provenance metadata, but must not add, delete, retime, or relabel music events.

In particular it must not introduce automatic `energy`, `drop`, or `peak` semantic commands.

## Existing safety gate is authoritative

Every candidate manifest must be checked through:

`research/gameplay-v1/preflight_gameplay_v1.mjs`

A mode is publishable only if preflight exits `0` and the resulting QC status is exactly `qc_pass`.

Do not use pool enlargement, beat deletion, event mutation, jump-aware reinterpretation, or a second candidate search to turn a refused mode green inside this generator.

This first generator intentionally uses the stricter lane-only preflight even though a separate jump-aware proof exists. That keeps generated modes inside the simplest already-established safety envelope.

## Failure behavior

### Standard

`standard` is mandatory.

If the exact safe input with default tuning does not return `qc_pass`, generation must fail closed for the song. Do not publish a variant pack.

### Relaxed / rush

These are optional per-song modes.

If either mode does not return `qc_pass`:

- mark that mode `unavailable` in the generation report;
- preserve its QC evidence;
- do not place that candidate manifest in the publishable output directory;
- do not substitute a different tuning profile under the same mode name.

The remaining safe modes may still be published if `standard` passed.

## Output contract

For a successful song generation, emit:

- `publishable/standard.json`
- `publishable/relaxed.json` only if relaxed passed
- `publishable/rush.json` only if rush passed
- `qc/<mode>.json` for all three attempted modes
- `difficulty-variants-report.json`

The report must record:

- input identity and analysis SHA;
- preregistration/spec identity;
- exact overrides for each mode;
- preflight exit/result status;
- publishable/unavailable decision;
- obstacle/pickup pool peaks;
- lane-only proof status and bottleneck slack;
- integrity check proving immutable music facts were preserved.

## Determinism

Run complete generation twice into separate directories and byte-compare all corresponding outputs.

A mismatch invalidates the validation run.

## Current validation fixtures

Use the same frozen real product safe inputs:

- ALLDAT minimal safe manifest
- CVB G.E.M.F. safe music facts with optional legacy/custom tuning stripped before validation

The built-in fallback may be retained as a reference, but the two real product fixtures are the required validation set.

## Success criteria

The v1 generator is validated when:

1. both real product inputs reproduce identical outputs across duplicate runs;
2. `standard` is publishable on both;
3. immutable music facts remain byte-equivalent at the JSON-value level for every candidate;
4. every published mode has its own `qc_pass` evidence;
5. no refused candidate is copied into `publishable/`;
6. the report carries exact Analyzer/Structure identity and generator/spec identity.

`relaxed` and `rush` are not required to pass every future song. Per-song unavailability is a valid fail-closed product outcome.

## Non-claims

This v1 generator does not claim:

- universal safety across all music;
- that three modes are final UX naming or final human difficulty calibration;
- automatic genre understanding;
- semantic-event safety;
- human reaction-time validation;
- a broad learned difficulty model;
- enforcement of `spawnMinGapZ` in the runtime.

It establishes a deterministic, auditable bridge from a safe music manifest to song-specific publishable gameplay variants using the already-validated whole-song QC as the authority.

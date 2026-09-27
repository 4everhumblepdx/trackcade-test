# Trackcade Semantic Internal Holdout v1 — Frozen Protocol

Status: **FROZEN BEFORE ANY SOL SEMANTIC CALL ON THESE SEVEN TRACKS**

## Purpose

Evaluate whether the frozen GPT-6 Sol semantic interpretation architecture generalizes beyond the two already-visible ALLDAT/CVB fixtures, using seven user-provided tracks that have not previously been exposed to the Astra/Sol semantic layer.

These tracks are **not Analyzer-unseen**. Prior Trackcade project notes identify them as part of the established real-song Analyzer regression set. Their older Analyzer expectations are inherited regression knowledge and are not semantic labels.

## Frozen upstream identities

- Production Analyzer: `v0.19`
- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`
- Sol comparison base result: `d04649893aaf550f4594670a27694b6c4aa3b82e`
- Frozen seven-track set: `FROZEN_TRACKS_V1.json`

## Frozen tracks

Exactly seven source tracks are included. No track may be removed, replaced, or substituted after this protocol freeze:

1. MuddyWatersRough
2. M and Ms - MELTS IN YOUR MIND v1BL-SO-11102013
3. Retro 9 Samp
4. luda_20bars
5. retro not (2)
6. vlado
7. I Feel Music (Instrumental) (1)

Source-audio SHA-256 values, byte sizes, and durations are frozen in `FROZEN_TRACKS_V1.json`.

## Analyzer regression verification already completed

Before semantic generation, the exact packaged v0.19 runner was executed on all seven source files with zero decode/hash/Analyzer failures.

Prior established expectations remain consistent, including:

- I Feel remains strict.
- Retro remains conservative/standard.
- luda remains approximately 149 BPM rather than jumping near 200 BPM.
- Muddy avoids bogus fragmented tempo behavior.

These facts are Analyzer-regression checks only. They must not be used as semantic answers.

## Semantic input contract

The model may see only the label-blind `trackcade-interpretation-packet-v1` representation derived from objective v0.19 evidence.

The packets must:

- expose no Analyzer diagnostic section/event label hints,
- preserve the frozen Analyzer/timing provenance,
- permit only `section`, `energy`, `peak`, and `drop` semantic proposal kinds,
- permit anchors only by existing `boundary` or `landmark` index,
- forbid independent timestamps,
- forbid beat/BPM edits,
- forbid timing-authority changes.

The Structure-v1 evidence logic remains frozen. The holdout compatibility wrapper changes only the accepted timing-tier vocabulary so the exporter accepts the exact packaged v0.19 runner's `strict/standard/loose/unsafe` tiers; it does not alter any evidence values or semantic policy.

## Provider experiment

For each of the seven tracks:

- Provider: OpenAI Responses API
- Requested model: `gpt-6-sol`
- Reasoning effort: `high`
- Maximum output tokens: `4096`
- `store=false`
- Exactly one semantic response is allowed per track when the provider returns a completed valid response.
- No semantic retry is allowed because a result scores poorly, looks odd, or is aesthetically disappointing.
- Infrastructure-only failures that produce no completed semantic response may be retried on the exact frozen payload.

The existing frozen learned-interpreter request builder, OpenAI adapter, proposal validator, and auditable ingestion layer must be reused unchanged.

## Evaluation scope

There is no pre-existing human-authored section/drop/peak/energy ground truth for these seven tracks in the recovered project materials.

Therefore this experiment is **NOT an accuracy/F1 benchmark**.

It may measure and report:

- all seven requests/payloads reproduced deterministically,
- provider completion/validation/ingestion status,
- proposal count and proposal-kind distribution,
- anchor validity,
- zero independent timing/BPM authority,
- source/timing provenance invariance,
- compiler acceptance/rejection counts if the frozen compiler is applied,
- API token usage and cost,
- cross-track qualitative consistency only as descriptive evidence.

It must NOT report semantic precision, recall, F1, or claim semantic correctness without independent human reference labels.

## No-retune rule

After any of these seven Sol semantic outputs are observed:

- do not change the prompt on the basis of these results and rerun the same track,
- do not change model settings and rerun the same track as if it were untouched,
- do not change compiler thresholds to improve these seven results,
- do not delete inconvenient tracks,
- do not substitute source files,
- do not present these seven as an independent future holdout again.

If later human semantic annotations are created, they may be used as a retrospective evaluation set, but must be clearly identified as annotations created after the frozen Sol outputs unless independently documented otherwise.

## Interpretation of the result

A clean seven-track run would establish broader **pipeline/generalization evidence**, not production-grade semantic accuracy. Promotion of a production semantic interpreter still requires a genuinely labeled broader benchmark/holdout or equivalent independent validation.

# Trackcade Semantic External Holdout v1

Status: **FROZEN BEFORE ANY MODEL OUTPUT ON THIS CORPUS**

## Purpose

Measure whether Trackcade's learned semantic layer can identify expert-labeled **Drop** events on fresh EDM while preserving deterministic Analyzer timing authority.

This benchmark is intentionally separate from the seven-track internal smoke/generalization set. The internal set has no independent semantic ground truth and is not used for semantic precision/recall/F1.

## Corpus

Primary source: **Socially Significant Music Event dataset** by Karthik Yadati et al.

- dataset landing page: https://osf.io/eydxk/
- descriptive source: https://records.sigmm.org/2018/03/07/socially-significant-music-events/
- published description reports 402 Creative-Commons EDM tracks, expert ground-truth event locations, and 435 Drop events across the corpus.

Only expert ground-truth event timestamps are evaluation labels. Timed social comments are not ground truth and must not be used as reference labels for this benchmark.

## Scope

Stage 1 evaluates **Drop only**.

No claim is made in v1 that dataset Build maps to Trackcade `energy` or `peak`, or that dataset Break maps to Trackcade `section`. Those mappings require separate evidence and a separately frozen protocol.

## Eligibility

A corpus track is eligible only if, before any model call for this benchmark:

1. its audio file is publicly retrievable from the frozen OSF corpus inventory;
2. the fixed corpus parser can associate that audio with its expert annotation record without manual judgment;
3. the expert annotation record parses successfully under the frozen parser;
4. the audio decodes successfully for the frozen Analyzer v0.19 path;
5. its exact audio SHA-256 does not match any previously burned Trackcade semantic-development song.

Eligibility failures are infrastructure/corpus failures, not semantic failures. They must be recorded. Tracks may not be removed because their semantic result is difficult or poor.

## Deterministic split

After the eligible corpus inventory is frozen, define each track's canonical identifier as the normalized OSF-relative audio path emitted by the frozen corpus parser.

For each eligible identifier `id`, compute:

`SHA256("trackcade-semantic-external-holdout-v1\n" + id)`

Sort ascending by `(selectionHash, id)`.

- first 50 eligible tracks: **Stage 1 labeled benchmark**
- next 50 eligible tracks: **terminal holdout**

Both sets are frozen before observing any Sol output on this corpus. No hard track may be replaced after selection. The terminal 50 must remain untouched until the Stage 1 result and any permitted post-Stage-1 development decisions are complete.

## Analyzer authority

Frozen production Analyzer:

- version: v0.19
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

Analyzer remains the sole timing authority.

The semantic model may only select existing Trackcade packet anchors. It may not invent timestamps, modify BPM, move the beat grid, modify beat offset, alter song length, or otherwise obtain independent timing authority.

## Learned semantic contract

Use the existing frozen Trackcade learned-interpretation request/adapter/validation path unchanged unless an infrastructure/API compatibility change is required before any corpus model output. Any such change must be committed and frozen before calls and must not change timing authority or expose reference labels to the model.

The model input must be **label blind**. Expert Drop labels, timed comments, benchmark identities, and evaluation tolerances must not appear in the semantic request payload.

Planned provider configuration, subject to current API verification immediately before live execution:

- provider: OpenAI Responses API
- requested model: `gpt-6-sol`
- reasoning effort: `high`
- max output tokens: `4096`
- `store=false`

Exactly one completed semantic response is allowed per track. A retry is allowed only for a genuine infrastructure failure that produced **no completed semantic response**, and the retry must use the identical frozen payload. A completed poor/empty/invalid semantic answer is scientific evidence and must not be regenerated for quality.

## Evaluation representations

Evaluate two distinct outputs:

1. **proposal-level Drop detection** — every valid learned proposal whose semantic kind is `drop`, resolved to the timestamp of its referenced existing packet anchor;
2. **compiler-accepted Drop detection** — only learned `drop` proposals accepted by the frozen deterministic semantic compiler, using the compiler-resolved event time.

Report both. Compiler rejection must not erase the raw proposal result.

## Matching rule

Expert Drop timestamps and predicted Drop timestamps are matched one-to-one per track.

For each tolerance, use a deterministic maximum-cardinality matching subject to `abs(predictedTime - referenceTime) <= tolerance`. Among maximum-cardinality matchings, minimize total absolute timing error. Deterministic tie-breaking is by ascending prediction time, then ascending reference time.

A matched pair is one true positive. Unmatched predictions are false positives. Unmatched expert Drops are false negatives.

## Frozen timing tolerances

Primary benchmark tolerance:

- **±2.0 seconds**

This is the only primary precision/recall/F1 result.

Predeclared sensitivity views, reported without selecting a winner after seeing results:

- ±1.0 second
- ±5.0 seconds

No additional tolerance may be introduced as the headline result after seeing model output.

## Metrics

For proposal-level and compiler-accepted Drop detection, report per-track and aggregate:

- eligible/evaluated track count
- expert reference Drop support
- predicted Drop count
- true positives
- false positives
- false negatives
- precision
- recall
- F1
- signed and absolute timing error for matched pairs
- median and mean absolute timing error
- model/provider request validity
- proposal validation status
- compiler accepted/rejected Drop counts
- anchor validity
- Analyzer runner/source identity
- BPM invariance
- beat-offset invariance
- beat-grid/timing-authority invariance
- input/output token use when supplied by provider
- API cost when determinable from verified current pricing

Zero-denominator metrics must be reported explicitly, not silently coerced.

## Failure classification

Record failures as one of:

- `corpus_ineligible_pre_model`
- `analyzer_infrastructure_failure`
- `provider_infrastructure_no_completed_response`
- `provider_completed_semantic_outcome`
- `proposal_validation_failure`
- `compiler_rejection`
- `evaluation_failure`

A semantic miss, extra Drop, empty proposal, low confidence, or compiler rejection is not an infrastructure excuse.

## Stage 1 / terminal discipline

Stage 1 results may inform later development, but every change made after Stage 1 must be versioned and documented.

The frozen terminal 50 may not be inspected through Sol, used for prompt/threshold tuning, selectively replaced, or repeatedly queried. When a final post-Stage-1 candidate is chosen, run the terminal set once under its frozen terminal protocol.

## Non-negotiable interpretation limits

- A good semantic benchmark result does not make the learned model timing authority.
- A bad result must remain visible; do not tune the holdout into success.
- Do not claim Build/Break performance from this Drop-only protocol.
- Do not claim general semantic correctness beyond the event/population actually evaluated.
- Do not remove hard songs after model output.
- Preserve source hashes, request hashes, provider response identities, workflow run IDs, commits, compiler identities, and evaluation artifacts.
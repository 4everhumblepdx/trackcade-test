# Trackcade External Semantic Holdout v1 — Stage 1 V2 Development Protocol

Status: **FROZEN BEFORE ANY V2 PROVIDER RESPONSE**

## Purpose

Stage 1 V1 established that the learned layer has some expert-Drop agreement but over-proposes `drop` and that the frozen compiler then removes most remaining Drop recall. The V1 result identity is frozen in `STAGE1_EVALUATION_FREEZE_V1.json` before this V2 development revision.

V2 tests one development hypothesis only: **the V1 semantic instruction defines `drop` too broadly, causing ordinary energy lifts, section returns, peaks, and generic re-entries to be proposed as Drops.**

## Single semantic V2 change

V2 changes only the learned semantic instruction used to build the provider-neutral request.

The V2 instruction must:

- keep the same label-blind deterministic interpretation packet;
- keep the same allowed semantic kinds and anchor-only timing contract;
- define `drop` as a distinct preparation → impact/release → sustained stronger passage pattern, not merely an upward energy change;
- explicitly distinguish `drop` from an ordinary `energy` lift, `section` return, isolated `peak`, or generic re-entry;
- prefer omission when Drop meaning is ambiguous;
- discourage emitting both `energy` and `drop` at the same anchor merely to hedge;
- calibrate high Drop confidence to clear packet-supported preparation/release evidence.

No benchmark/reference timestamps or expert labels may be included in any V2 request or provider payload.

## Compatibility-only V2 wrappers

The existing V1 OpenAI adapter and provider ingester both validate requests against the exact V1 `INSTRUCTION` module constant. Therefore they cannot execute or ingest a genuinely different V2 instruction unchanged.

Before any V2 provider response, versioned compatibility wrappers are frozen:

- `openai_responses_adapter_v2.py`
- `ingest_provider_response_v2.py`

Each wrapper may only:

- require the exact V2 development revision marker in the request;
- verify `instructionSha256` against the exact instruction already present in that request;
- bind that exact request instruction into the corresponding V1 validation path;
- delegate the complete V1 implementation unchanged after that compatibility gate.

For the adapter, delegated V1 behavior includes payload construction, OpenAI Responses transport, JSON-schema output contract, response extraction, and adapter reporting.

For ingestion, delegated V1 behavior includes packet/request identity checks, proposal validation and normalization, provider/run metadata validation, provenance, trust flags, validation reports, normalized proposal output, and run manifests.

These wrappers are infrastructure required to permit the single semantic instruction change. They must not modify packets, anchors, allowed proposal kinds, response schema, provider/model settings, timing authority, proposal semantics, compiler policy, or benchmark scoring.

## Frozen components

V2 does **not** change:

1. Analyzer v0.19 source, runner, BPM, beat grid, phase, energy curve, or timing tiers.
2. The frozen 50 Stage 1 track identities.
3. The interpretation packets, structure evidence, or safe manifests produced by the frozen Stage 1 prep artifact.
4. OpenAI Responses payload/transport semantics and provider-response ingestion semantics beyond the compatibility boundaries documented above.
5. Proposal validation/normalization logic.
6. Provider/model contract: OpenAI Responses API, `gpt-6-sol`, reasoning `high`, max output tokens 4096, `store=false`.
7. The deterministic semantic compiler v1.
8. `DROP_EVALUATION_V1.md`, including the primary ±2.0 s window and predeclared ±1.0/±5.0 sensitivity windows.
9. The terminal 50-track set, which remains untouched.

## V2 preparation rule

Before any V2 provider call, all 50 V2 provider-neutral requests and exact OpenAI payloads must be generated label-blind from the already-frozen Stage 1 interpretation packets and stored in one immutable preparation artifact with file hashes.

The V2 prep artifact must record zero completed provider responses.

## Provider execution rule

After the V2 prep artifact identity is frozen:

- exactly one completed V2 semantic response is permitted per Stage 1 track;
- no semantic retry is allowed because an answer is weak, sparse, invalid, or scores poorly;
- only a genuine infrastructure failure that yields no completed provider semantic response may retry the identical frozen payload;
- a completed response, including a format/validation failure, is a frozen semantic outcome for that track.

This is a new versioned Stage 1 development experiment, not a retry of V1.

## Evaluation and comparison

V2 is scored under the unchanged `DROP_EVALUATION_V1.md` contract.

Primary development comparison: proposal-level micro F1 at ±2.0 seconds versus the frozen V1 proposal-level result. Precision and recall at ±2.0 seconds are mandatory companion metrics; ±1.0 and ±5.0 remain sensitivity analyses.

Compiler-accepted V2 results are also reported using the unchanged compiler v1, but V2 does not alter compiler policy. This isolates the semantic-instruction effect.

A V2 result must be frozen before any further Stage 1-driven semantic or compiler change. No terminal-model outputs may be generated until the Stage 1 development decision is explicitly frozen.

## Claim boundary

V2 remains development-set evidence. Improvement on these 50 burned Stage 1 tracks is not fresh generalization evidence and cannot be presented as terminal performance. Analyzer timing authority remains deterministic regardless of V2 outcome.

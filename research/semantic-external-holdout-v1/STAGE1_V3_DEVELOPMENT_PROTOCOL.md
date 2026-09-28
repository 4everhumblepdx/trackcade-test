# Stage 1 V3 Development Protocol — Structure Evidence v2

Status: **FROZEN BEFORE ANY V3 PROVIDER RESPONSE**

## Purpose

V3 tests one scientific variable: whether the already-frozen compact Structure Evidence v2 improves semantic Drop interpretation when the learned layer receives the richer deterministic Analyzer-derived anchor vocabulary.

V3 does **not** change Analyzer v0.19, the Stage 1 corpus, reference labels, matcher, tolerance windows, model family, reasoning effort, output budget, or the meaning definition used in the V2 semantic instruction except for mechanical compatibility changes required by the new packet/anchor contract.

## Immutable inputs

- Analyzer release: v0.19.
- Analyzer source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`.
- Analyzer runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`.
- Structure Evidence v2 freeze commit: `708e824fd977a240e86dd9425a1a5e1b437775ad`.
- Structure Evidence v2 bundle SHA-256: `16858488f584ef85164241679c6dcf3675393e46ff33d99f8bde6b6617a7c4ca`.
- Selected evidence policy: `current-core-accent-table-v2`.
- Stage 1 remains the same frozen 50-track development set.
- Terminal 50 tracks remain untouched.

No audio is decoded and Analyzer is not executed during V3 preparation or semantic generation.

## Learned-layer contract

Provider-neutral request schema: `trackcade-learned-interpretation-request-v2`.

Provider proposal schema: `trackcade-musical-interpretation-v2`.

Development revision: `stage1-drop-semantics-v2-structure-evidence-v2`.

The sole selectable anchor form is:

```json
{"type":"evidence","index":N}
```

`N` is the zero-based row index of `packet.anchors`. The row's first element is the deterministic timestamp. A provider may not emit an independent timestamp, BPM, beat-grid edit, beat offset, timing tier, song length edit, or other timing authority.

The packet's separate source map is local deterministic provenance only. It is hash-bound by `sourceMapSha256` but is not included in provider input.

## Semantic instruction control

The V3 instruction is generated mechanically from the frozen V2 instruction. Allowed changes are limited to:

1. proposal schema identifier v1 → v2;
2. `boundary|landmark` output anchors → unified `evidence` row-index anchors;
3. landmark-specific Drop wording → generic evidence-anchor wording;
4. explicit Structure Evidence v2 clarification that priority, salience, and confidence are Analyzer descriptors, not Drop probability, `semanticConfidence`, or gameplay authorization.

No Drop-definition retuning, confidence-threshold retuning, label-informed exception, per-track rule, or benchmark-specific cue is allowed.

The builder emits a machine-readable instruction-diff record and binds both V2 and V3 instruction SHA-256 values.

## Provider contract

The eventual V3 provider contract is unchanged from V2:

- provider: OpenAI
- API: Responses
- model: `gpt-6-sol`
- reasoning effort: `high`
- max output tokens: `4096`
- store: `false`
- exactly one completed semantic response per Stage 1 track

Preparation uses `--prepare-only` and performs zero provider calls.

A completed provider response scientifically closes that case. Semantic retries are forbidden. Retry is authorized only for infrastructure outcomes where no completed provider response was obtained.

## Preparation boundary

Before any provider call, all 50 V3 requests and exact OpenAI payloads must be generated and frozen. Preparation must verify:

- exact frozen Stage 1 identities;
- exact Analyzer identity;
- exact Structure Evidence v2 bundle identity and internal manifest;
- source-backed reconstruction of every evidence packet and source map from immutable v0.19 analysis and v1 interpretation/evidence bytes;
- zero reference-label access during request/payload construction;
- zero terminal-track processing;
- zero Analyzer execution;
- zero audio decoding;
- zero provider calls;
- zero compiler invocation;
- source-map content absent from provider input;
- label/diagnostic leakage absent from provider-facing packet/request/payload.

The V3 prep artifact and manifest must be frozen with run ID, artifact ID/digest, head SHA, manifest SHA, source blobs, instruction SHA, and evidence-bundle identity before provider generation is dispatched.

## Evaluation contract

V3 Stage 1 evaluation is **RAW Drop proposal only**.

For each validated Drop proposal, time is resolved solely as:

`packet.anchors[event.anchor.index][0]`

The evaluator imports the unchanged one-to-one matcher and scoring functions from `evaluate_stage1_drop_v1.py`. Fixed windows remain ±1 s, ±2 s primary, and ±5 s sensitivity.

The current semantic compiler is not invoked by the V3 experiment because it only understands the prior `boundary|landmark` vocabulary. No V3 compiler-accepted metric will be created by silently modifying compiler semantics.

This means V3 answers a narrow question: did richer frozen deterministic evidence improve semantic Drop selection at the raw proposal layer?

## Research boundaries

- Stage 1 is development data and may be analyzed after a frozen V3 result.
- Terminal holdout remains untouched until a final protocol is explicitly frozen.
- No hard song may be deleted.
- No rule may be added after observing a V3 failure without declaring a new development revision.
- External reference labels are never model input.
- Successful semantic performance never grants the learned layer timing authority.
- Structure Evidence v2 representability is not semantic accuracy.
- Model-reported confidence is not assumed calibrated merely because it crosses a deterministic threshold.

## Stop point

After the V3 prep artifact is produced and its identities are committed in a pre-provider freeze record, stop. Do not dispatch V3 provider generation as part of preparation.

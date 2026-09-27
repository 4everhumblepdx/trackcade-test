# Trackcade Learned Interpretation v1 — Harness Conformance Result

Status: **passed; provider-neutral request/validation boundary is deterministic and fail closed**

## Frozen run

- branch: `trackcade-learned-interpretation-v1`
- tested commit: `c037f21936cc26518f6caaa763effb455886b810`
- workflow: `Trackcade Learned Interpretation v1 — Harness Conformance`
- run ID: `36343433196`
- job ID: `108687835315`
- conclusion: `success`
- artifact: `trackcade-learned-interpretation-v1-harness-conformance`
- artifact ID: `10939822320`
- artifact digest: `sha256:83f348657eba050bf242b16eb5ccf07acaff6397d9269bed77a1e67ae9553564`

## Frozen upstream

The workflow independently verified and downloaded the exact Musical Interpretation v1 integration artifact:

- run ID: `36323696425`
- artifact ID: `10933550802`
- artifact digest: `sha256:6a6b05b6da7c5f59d4473cbb497edce7de2ad2a3ecc7a4d795a6d6f63bc784ab`

Production Analyzer identity remained:

- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

No model/provider inference occurred in this proof.

## Request determinism

The two frozen label-blind interpretation packets produced byte-identical provider request packages across duplicate runs.

Packet SHA-256 values:

- ALLDAT: `579cbdb6a0ec06e46f93230929949077079d8272b4fb86c2cb274edeb5dabdfa`
- CVB — G.E.M.F.: `69df2dba4ae905a96d51149feed5a57394412c5dba1972085f33e5633a88516f`

Frozen provider instruction SHA-256:

- `8bf1231fc4bfeee4897367a72cd77bd569fc9df53c93532052ca43f7446d88e9`

Generated request package SHA-256 values:

- ALLDAT: `409ce78afcd4c6062827a0ba60aeb94f6ec311aaa1ccf6e292fd137686c2e03a`
- CVB — G.E.M.F.: `2d6650e1ceb72ddff9f40f13e8f04dbaacc84f7b7935b8843e1ba25088e85e93`

The workflow verified that the request packet is exactly the downloaded label-blind packet and that Analyzer diagnostic semantic hint keys remain absent.

## Positive schema fixtures

The two already-frozen evidence-only v1 proposals were used only as known-good schema fixtures.

Both validated twice and normalized without changing semantic content:

- ALLDAT: 6 events, valid;
- CVB — G.E.M.F.: 9 events, valid.

Normalized proposal SHA-256 values:

- ALLDAT: `5cb5abd337e6ad3ebdd11eca973812ce22a8076db7a4f755a8736388b24158c1`
- CVB — G.E.M.F.: `9d359e220de0139acfd44b38c3749e1e26323ece3e9c90169619a3c2685bc2ab`

These are conformance fixtures, not learned/model outputs and not new semantic evidence.

## Negative conformance result

All 14 preregistered hostile/malformed mutations were deterministically rejected with validator exit code `2` and the expected error class:

- analysis source SHA mismatch;
- anchor index out of range;
- unsupported anchor type;
- beat-grid edit attempt;
- semantic confidence outside `[0,1]`;
- event `t` injection;
- event `time` injection;
- duration on a non-drop event;
- missing required section name;
- unsupported semantic kind;
- source BPM injection;
- more than 64 events;
- top-level independent `time` injection;
- unexpected event key.

A separate duplicate-JSON-key probe was also rejected without repair:

- error: `invalid_json: duplicate JSON key: schema`.

The validator therefore fails closed on timing-authority attempts, source mismatch, malformed anchor semantics, schema drift, and ambiguous provider JSON rather than silently repairing them.

## Frozen source hashes

- contract: `f7701d17f3a309329ec04526b8bfd2019ac1301447ebe4525081456cec0d0d55`
- validator: `9f6a0fb0386bce1f5f6d8a9344cdffe3f398be1c78f3cff6253aa24d469ab06a`
- request builder: `a34513e618206fa8729f96a10543ed7eaaf10d06a829873f9e11ac370259edd2`
- conformance fixture generator: `ae56cdcf878cd67f99f3904cf6770072b4d121e1db2e6a05b13c9638cb20fcde`

## Decision

Accept the provider-neutral request/validation boundary as green infrastructure for Learned Interpretation v1.

This result does **not** establish semantic quality for any learned model because no model was called.

The next provider-independent step is to make provider-response ingestion and provenance recording deterministic so a future external model call can be treated as an auditable input rather than trusted application code.

A real provider execution must still obey the frozen generation/evaluation separation and must not receive authored benchmark references, prior song-specific proposal answers, or compiler outcomes as prompt input.

# Trackcade Learned Interpretation v1 — OpenAI Adapter Conformance Result

Status: **passed; OpenAI Responses transport is deterministic offline, byte-bound to the frozen Trackcade request, and remains subordinate to provider-neutral validation/compilation**

## Frozen run

- branch: `trackcade-learned-interpretation-v1`
- tested commit: `f24c1f75a9be5f0c297f9f951258baf638c76e51`
- workflow: `Trackcade Learned Interpretation v1 — OpenAI Adapter Conformance`
- run ID: `36348011272`
- job ID: `108701052737`
- conclusion: `success`
- artifact: `trackcade-openai-adapter-v1-conformance`
- artifact ID: `10941198404`
- artifact digest: `sha256:20e82e10d85a669c20ef2beb0e2e79f409d3cb058c092adad3603a91754c3072`
- evidence files uploaded: `68`

## Frozen upstream

The workflow independently verified and downloaded the exact Musical Interpretation v1 integration artifact:

- upstream run ID: `36323696425`
- upstream artifact ID: `10933550802`
- upstream artifact: `trackcade-musical-interpretation-v1-evidence-only`
- upstream digest: `sha256:6a6b05b6da7c5f59d4473cbb497edce7de2ad2a3ecc7a4d795a6d6f63bc784ab`

Production Analyzer identity remained unchanged:

- release: `v0.19`
- source commit: `e308d867980fb1877c3f2e4ce27950deecac0855`
- runner SHA-256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`

No live model/provider inference occurred in this conformance proof.

## Exact label-blind inputs

Frozen packet SHA-256 values:

- ALLDAT: `579cbdb6a0ec06e46f93230929949077079d8272b4fb86c2cb274edeb5dabdfa`
- CVB — G.E.M.F.: `69df2dba4ae905a96d51149feed5a57394412c5dba1972085f33e5633a88516f`

Provider-neutral request SHA-256 values:

- ALLDAT: `409ce78afcd4c6062827a0ba60aeb94f6ec311aaa1ccf6e292fd137686c2e03a`
- CVB — G.E.M.F.: `2d6650e1ceb72ddff9f40f13e8f04dbaacc84f7b7935b8843e1ba25088e85e93`

Frozen provider instruction SHA-256 remains:

- `8bf1231fc4bfeee4897367a72cd77bd569fc9df53c93532052ca43f7446d88e9`

## OpenAI request determinism

Using the offline sentinel model identifier `gpt-conformance-sentinel`, reasoning effort `medium`, `max_output_tokens=4096`, and `store=false`, duplicate adapter executions produced byte-identical API payloads.

Payload SHA-256 values:

- ALLDAT: `311ad650bd18e1644e6238a65b86841b9a39bd69f5efb4aad93f230d1d22d38d`
- CVB — G.E.M.F.: `8f3add0acabc12f1936921acd4fae9aefba63c91fa327dd20fd0548a29034335`

The payload contains only the frozen Trackcade instruction plus the label-blind packet/response contract/integrity fields. It does not receive authored benchmark references, prior song-specific semantic answers, compiler outcomes, or independent timing authority.

The OpenAI Structured Outputs schema is intentionally a strict subset of the provider-neutral proposal contract:

- allowed kinds: `section`, `energy`, `peak`, `drop`;
- anchors: existing `boundary` or `landmark` index only;
- maximum events: `64`;
- every event requires semantic confidence, anchor, name, and rationale;
- no independent timestamp, BPM, beat-grid, or song-length field exists;
- provider-specific drop duration is omitted so provider bytes require no null-stripping or semantic repair; the frozen compiler retains its existing default behavior.

## Valid response path

Synthetic OpenAI Responses objects were used only as transport/conformance fixtures, not semantic-quality evidence.

The adapter:

1. preserved exact raw provider-response bytes;
2. required a completed OpenAI `response` object;
3. required exactly one `output_text` candidate and no refusal;
4. extracted candidate bytes without Markdown stripping, concatenation, or JSON repair;
5. passed those exact candidate bytes through the existing provider-neutral learned-proposal validator;
6. passed validated candidates through the existing auditable provider-ingestion boundary;
7. preserved trust flags showing the provider response remains untrusted and the deterministic semantic compiler remains required.

Extracted candidate SHA-256 values:

- ALLDAT: `0007461085b8071ef4de87b350c4fe744b655eae0f8514936ccf4101082cd1d9`
- CVB — G.E.M.F.: `693ba822abfb21957d40afc64e48e918506a8366492c409c988a40f69fb15426`

Normalized proposal SHA-256 values after provider-neutral validation:

- ALLDAT: `e73855fb0421ccc5825c819ddd1054e6cff47c4ed95d47b36ae0f4aa5a80ef5b`
- CVB — G.E.M.F.: `f9bd033c5670a2827164fad1fa4e005156243e453878acdb05555f3e48fa2982`

## Fail-closed transport result

All preregistered hostile/framing fixtures were rejected before a proposal candidate could be emitted:

- incomplete response;
- provider refusal;
- multiple `output_text` parts;
- wrong top-level object type;
- missing response ID;
- missing response model;
- duplicate JSON key inside the proposal candidate.

For each framing failure, raw response evidence was preserved while no candidate file was emitted.

Additional provenance checks passed:

- a whitespace-only mutation of the supplied packet bytes is rejected because its exact SHA no longer matches the frozen request;
- live mode without `OPENAI_API_KEY` fails closed before any raw response or candidate is emitted.

## Ingestion scrubber correction

The first OpenAI adapter conformance run (`36347827682`, commit `e69d468f17bf6cbeddffe971e6b91faf9b7234ad`) reached valid extraction/validation but failed during auditable ingestion because the existing sensitive-parameter scrubber treated the harmless field `maxOutputTokens` as a secret due to substring matching on `token`.

Commit `f24c1f75a9be5f0c297f9f951258baf638c76e51` corrected only that metadata scrubber: credential-like key segments such as `apiKey`, `authToken`, `password`, `authorization`, `secret`, and `credential` remain forbidden, while ordinary generation metrics such as `maxOutputTokens`, `inputTokens`, and `outputTokens` are allowed for provenance. The provider-neutral harness also passed on the same corrected commit.

No semantic-selection, timing, benchmark, Analyzer, or compiler rule changed.

## Frozen source hashes

- OpenAI Responses adapter: `57c6279ded65a1f14316c043a4aa3fcb4d0203dd624154f17d9c35705775980b`
- OpenAI adapter fixture generator: `8707d63e23772688ccfb7f10ac9cf11af01a920ca4295f13f6079af2b2f1ec4f`

## Decision

Accept the OpenAI Responses adapter as green provider transport infrastructure for Learned Interpretation v1.

This result does **not** establish learned semantic quality because no live OpenAI model was called. The next valid experiment is a frozen live provider execution on the two existing label-blind packets, followed by the already-frozen validator/compiler and the already-frozen Semantic Quality v1 benchmark. Generation must remain isolated from authored reference timelines, prior song-specific proposal answers, and benchmark outcomes.

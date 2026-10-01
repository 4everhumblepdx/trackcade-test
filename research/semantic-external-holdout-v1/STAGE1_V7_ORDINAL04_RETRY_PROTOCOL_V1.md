# Stage1 V7 ordinal-4 one-retry protocol

Status: staged protocol only. This document authorizes no provider call.

## Why a retry is being considered

The first authorized V7 attempt for ordinal 4 completed transport successfully with HTTP 200 but the provider response status was `incomplete` because the frozen `max_output_tokens=8192` ceiling was exhausted. The run consumed one provider attempt and produced no completed semantic proposal. The partial response is not accepted as a development result.

This is not a V7 semantic validation rejection. The validator never received a completed semantic proposal for ordinal 4.

The interruption is frozen in `STAGE1_V7_REMAINING49_INTERRUPTION_ORDINAL04_V1.json`.

## Frozen retry variable

A retry, if explicitly authorized by Nicholas, must use the exact same frozen ordinal-4 inputs and transport contract as the first attempt:

- same Stage1 Structure Evidence v2 packet;
- same learned request and semantic instructions;
- same OpenAI payload except for transport-generated request identity;
- provider `openai`;
- Responses API;
- model `gpt-6-sol`;
- reasoning effort `high`;
- `max_output_tokens=8192`;
- `service_tier=flex`;
- `store=false`.

The retry must not change prompt wording, semantic contract, anchors, timestamps, candidate inventory, Analyzer evidence, output-token cap, service tier, or model.

## Retry limit

Exactly one retry of ordinal 4 may be authorized under this protocol.

- The original ordinal-4 attempt remains immutable evidence.
- The retry must receive its own immutable attempt lock and result artifact with retry-specific names.
- No automatic retry is allowed.
- No Standard fallback is allowed.
- If the retry is incomplete, invalid, or otherwise not `completed-valid`, stop again. A second retry is not authorized by this protocol.

## Development continuity

Ordinals 2 and 3 are already frozen `completed-valid` V7 development responses. Ordinals 5-50 remain unattempted.

If and only if the one authorized ordinal-4 retry becomes `completed-valid`, the untouched ordinals 5-50 may later continue under the original explicit remaining49 authorization, subject to a provider-free resume audit proving:

1. ordinal 1 is the frozen V7 canary;
2. ordinals 2 and 3 each have exactly one frozen completed-valid result;
3. ordinal 4 has exactly one frozen original incomplete attempt plus exactly one frozen completed-valid retry;
4. ordinals 5-50 have no provider-attempt locks or results before resume;
5. no Stage1 reference labels have been opened;
6. no terminal holdout has been accessed;
7. no Analyzer or compiler has been run or changed;
8. the V7 semantic contract and frozen provider contract remain unchanged.

The ordinal-4 retry does not authorize a retry for any later ordinal. Any later failed/incomplete ordinal still requires fresh explicit approval.

## Scientific interpretation

The retry is a transport-completion recovery under an unchanged frozen contract, not a new semantic variant. Results must preserve provenance for both the first incomplete attempt and the retry. The original incomplete attempt must never be deleted, replaced, or scored as a semantic result.

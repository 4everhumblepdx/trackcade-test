#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

from build_learned_request_v1 import INSTRUCTION, PROPOSAL_SCHEMA, REQUEST_SCHEMA
from validate_learned_proposal_v1 import load_json_strict, validate_packet

ADAPTER_SCHEMA = "trackcade-openai-responses-adapter-v1"
ENDPOINT = "https://api.openai.com/v1/responses"
REASONING_EFFORTS = {"none", "minimal", "low", "medium", "high", "xhigh"}


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_json_bytes_strict(data: bytes, label: str):
    def no_dupes(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise ValueError(f"duplicate JSON key: {key}")
            out[key] = value
        return out

    try:
        return json.loads(data.decode("utf-8"), object_pairs_hook=no_dupes)
    except (UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
        raise SystemExit(f"{label} is not strict JSON: {exc}") from exc


def verify_trackcade_request(request_path: Path, packet_path: Path):
    request_bytes = request_path.read_bytes()
    request = load_json_strict(request_path)
    if request.get("schema") != REQUEST_SCHEMA:
        raise SystemExit("Trackcade request schema mismatch")
    if request.get("instruction") != INSTRUCTION:
        raise SystemExit("Trackcade request instruction mismatch")

    packet_bytes = packet_path.read_bytes()
    packet = load_json_strict(packet_path)
    packet_errors = validate_packet(packet)
    if packet_errors:
        raise SystemExit("Trackcade packet invalid: " + "; ".join(packet_errors))
    if request.get("packet") != packet:
        raise SystemExit("Trackcade request packet does not equal supplied exact packet")

    integrity = request.get("integrity") or {}
    if integrity.get("packetSha256") != sha256_bytes(packet_bytes):
        raise SystemExit("Trackcade request packet hash does not match supplied exact packet bytes")
    if integrity.get("analyzerRunnerSha256") != packet["source"]["analyzerRunnerSha256"]:
        raise SystemExit("Trackcade request Analyzer identity mismatch")
    if integrity.get("analysisJsonSha256") != packet["source"]["analysisJsonSha256"]:
        raise SystemExit("Trackcade request analysis identity mismatch")
    if integrity.get("instructionSha256") != sha256_bytes(INSTRUCTION.encode("utf-8")):
        raise SystemExit("Trackcade request instruction hash mismatch")

    return request_bytes, request, packet, packet_bytes


def proposal_json_schema(request: dict) -> dict:
    contract = request.get("responseContract") or {}
    if contract.get("schema") != PROPOSAL_SCHEMA:
        raise SystemExit("response contract schema mismatch")
    allowed_kinds = contract.get("allowedKinds")
    allowed_anchor_types = contract.get("allowedAnchorTypes")
    max_events = contract.get("maxEvents")
    if not isinstance(allowed_kinds, list) or set(allowed_kinds) != {"section", "energy", "peak", "drop"}:
        raise SystemExit("response contract semantic kinds mismatch")
    if not isinstance(allowed_anchor_types, list) or set(allowed_anchor_types) != {"boundary", "landmark"}:
        raise SystemExit("response contract anchor types mismatch")
    if max_events != 64:
        raise SystemExit("response contract maxEvents mismatch")

    source = request["packet"]["source"]
    # This is deliberately a strict subset of the provider-neutral proposal schema.
    # Every event gets a name and rationale; optional drop duration is omitted so the
    # provider output can pass through byte-for-byte without null stripping/repair.
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["schema", "source", "events"],
        "properties": {
            "schema": {"type": "string", "enum": [PROPOSAL_SCHEMA]},
            "source": {
                "type": "object",
                "additionalProperties": False,
                "required": ["analyzerRunnerSha256", "analysisJsonSha256"],
                "properties": {
                    "analyzerRunnerSha256": {
                        "type": "string",
                        "enum": [source["analyzerRunnerSha256"]],
                    },
                    "analysisJsonSha256": {
                        "type": "string",
                        "enum": [source["analysisJsonSha256"]],
                    },
                },
            },
            "events": {
                "type": "array",
                "maxItems": 64,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["kind", "semanticConfidence", "anchor", "name", "rationale"],
                    "properties": {
                        "kind": {"type": "string", "enum": allowed_kinds},
                        "semanticConfidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "anchor": {
                            "type": "object",
                            "additionalProperties": False,
                            "required": ["type", "index"],
                            "properties": {
                                "type": {"type": "string", "enum": allowed_anchor_types},
                                "index": {"type": "integer", "minimum": 0},
                            },
                        },
                        "name": {"type": "string", "minLength": 1, "maxLength": 80},
                        "rationale": {"type": "string", "minLength": 1, "maxLength": 500},
                    },
                },
            },
        },
    }


def build_api_payload(request: dict, model: str, reasoning_effort: str, max_output_tokens: int) -> dict:
    model = " ".join(model.strip().split())
    if not model or len(model) > 200:
        raise SystemExit("model invalid")
    if reasoning_effort not in REASONING_EFFORTS:
        raise SystemExit("unsupported reasoning effort")
    if not 256 <= max_output_tokens <= 32768:
        raise SystemExit("max-output-tokens outside adapter bounds")

    provider_input = {
        "packet": request["packet"],
        "responseContract": request["responseContract"],
        "integrity": request["integrity"],
    }
    return {
        "model": model,
        "store": False,
        "instructions": request["instruction"],
        "input": json.dumps(provider_input, sort_keys=True, separators=(",", ":")),
        "reasoning": {"effort": reasoning_effort},
        "max_output_tokens": max_output_tokens,
        "text": {
            "format": {
                "type": "json_schema",
                "name": "trackcade_musical_interpretation_v1",
                "strict": True,
                "schema": proposal_json_schema(request),
            }
        },
    }


def extract_candidate(raw_response_bytes: bytes):
    response = load_json_bytes_strict(raw_response_bytes, "OpenAI response")
    if not isinstance(response, dict):
        raise SystemExit("OpenAI response must be an object")
    if response.get("object") != "response":
        raise SystemExit("OpenAI response object type mismatch")
    if response.get("status") != "completed":
        raise SystemExit(f"OpenAI response not completed: {response.get('status')}")

    response_id = response.get("id")
    response_model = response.get("model")
    if not isinstance(response_id, str) or not response_id.strip():
        raise SystemExit("OpenAI response id missing")
    if not isinstance(response_model, str) or not response_model.strip():
        raise SystemExit("OpenAI response model missing")

    texts = []
    refusals = []
    for item in response.get("output") or []:
        if not isinstance(item, dict) or item.get("type") != "message":
            continue
        for part in item.get("content") or []:
            if not isinstance(part, dict):
                continue
            if part.get("type") == "refusal":
                refusals.append(part.get("refusal"))
            elif part.get("type") == "output_text":
                text = part.get("text")
                if not isinstance(text, str):
                    raise SystemExit("OpenAI output_text is not text")
                texts.append(text)

    if refusals:
        raise SystemExit("OpenAI response contained a refusal")
    if len(texts) != 1:
        raise SystemExit(f"expected exactly one OpenAI output_text candidate, got {len(texts)}")

    candidate_bytes = texts[0].encode("utf-8")
    candidate = load_json_bytes_strict(candidate_bytes, "OpenAI proposal candidate")
    if not isinstance(candidate, dict):
        raise SystemExit("OpenAI proposal candidate must be one JSON object")
    return response, candidate_bytes


def perform_request(payload_bytes: bytes, api_key: str, timeout_s: int):
    client_request_id = str(uuid.uuid4())
    req = urllib.request.Request(
        ENDPOINT,
        data=payload_bytes,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "trackcade-learned-interpretation-v1",
            "X-Client-Request-Id": client_request_id,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            raw = resp.read()
            request_id = resp.headers.get("x-request-id")
            status = resp.status
    except urllib.error.HTTPError as exc:
        body = exc.read()
        sys.stderr.write(
            f"OpenAI HTTP error {exc.code}; client_request_id={client_request_id}; "
            f"response_sha256={sha256_bytes(body)}\n"
        )
        raise SystemExit(3) from exc
    except urllib.error.URLError as exc:
        raise SystemExit(f"OpenAI transport error; client_request_id={client_request_id}: {exc.reason}") from exc

    if status != 200:
        raise SystemExit(f"unexpected OpenAI HTTP status {status}")
    return raw, request_id, client_request_id


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--request", type=Path, required=True)
    ap.add_argument("--packet", type=Path, required=True,
                    help="Exact packet bytes used to build the Trackcade provider-neutral request")
    ap.add_argument("--model", required=True)
    ap.add_argument("--reasoning-effort", default="medium", choices=sorted(REASONING_EFFORTS))
    ap.add_argument("--max-output-tokens", type=int, default=4096)
    ap.add_argument("--timeout-seconds", type=int, default=180)
    ap.add_argument("--payload-output", type=Path, required=True)
    ap.add_argument("--raw-response-output", type=Path)
    ap.add_argument("--proposal-candidate-output", type=Path)
    ap.add_argument("--adapter-report-output", type=Path, required=True)
    ap.add_argument("--response-fixture", type=Path,
                    help="Offline conformance only: parse these exact response bytes instead of calling OpenAI")
    ap.add_argument("--prepare-only", action="store_true")
    args = ap.parse_args()

    request_bytes, request, packet, packet_bytes = verify_trackcade_request(args.request, args.packet)
    payload = build_api_payload(request, args.model, args.reasoning_effort, args.max_output_tokens)
    payload_bytes = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")
    args.payload_output.parent.mkdir(parents=True, exist_ok=True)
    args.payload_output.write_bytes(payload_bytes)

    base_report = {
        "schema": ADAPTER_SCHEMA,
        "provider": "openai",
        "endpoint": ENDPOINT,
        "requestedModel": args.model,
        "reasoningEffort": args.reasoning_effort,
        "maxOutputTokens": args.max_output_tokens,
        "store": False,
        "integrity": {
            "trackcadeRequestSha256": sha256_bytes(request_bytes),
            "packetSha256": sha256_bytes(packet_bytes),
            "apiPayloadSha256": sha256_bytes(payload_bytes),
            "analyzerRunnerSha256": packet["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
        },
    }

    if args.prepare_only:
        if args.response_fixture or args.raw_response_output or args.proposal_candidate_output:
            raise SystemExit("prepare-only cannot be combined with response outputs/fixture")
        base_report["status"] = "payload_prepared_no_provider_call"
        args.adapter_report_output.parent.mkdir(parents=True, exist_ok=True)
        args.adapter_report_output.write_text(json.dumps(base_report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps({"status": base_report["status"], "apiPayloadSha256": base_report["integrity"]["apiPayloadSha256"]}, indent=2))
        return

    if not args.raw_response_output or not args.proposal_candidate_output:
        raise SystemExit("live/fixture mode requires raw-response-output and proposal-candidate-output")

    if args.response_fixture:
        raw_response_bytes = args.response_fixture.read_bytes()
        http_request_id = None
        client_request_id = None
        execution_mode = "offline_fixture"
    else:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise SystemExit("OPENAI_API_KEY is required for live OpenAI execution")
        if not 1 <= args.timeout_seconds <= 900:
            raise SystemExit("timeout-seconds outside adapter bounds")
        raw_response_bytes, http_request_id, client_request_id = perform_request(
            payload_bytes, api_key, args.timeout_seconds
        )
        execution_mode = "live"

    # Preserve provider bytes even if framing/extraction subsequently fails.
    args.raw_response_output.parent.mkdir(parents=True, exist_ok=True)
    args.raw_response_output.write_bytes(raw_response_bytes)

    response, candidate_bytes = extract_candidate(raw_response_bytes)
    args.proposal_candidate_output.parent.mkdir(parents=True, exist_ok=True)
    args.proposal_candidate_output.write_bytes(candidate_bytes)

    report = dict(base_report)
    report.update({
        "status": "provider_response_extracted",
        "executionMode": execution_mode,
        "responseId": response["id"],
        "responseModel": response["model"],
        "httpRequestId": http_request_id,
        "clientRequestId": client_request_id,
    })
    report["integrity"] = dict(base_report["integrity"])
    report["integrity"].update({
        "rawProviderResponseSha256": sha256_bytes(raw_response_bytes),
        "proposalCandidateSha256": sha256_bytes(candidate_bytes),
    })
    usage = response.get("usage")
    if isinstance(usage, dict):
        report["usage"] = usage

    args.adapter_report_output.parent.mkdir(parents=True, exist_ok=True)
    args.adapter_report_output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": report["status"],
        "responseId": report["responseId"],
        "responseModel": report["responseModel"],
        "proposalCandidateSha256": report["integrity"]["proposalCandidateSha256"],
    }, indent=2))


if __name__ == "__main__":
    main()

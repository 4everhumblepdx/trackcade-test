#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path

import openai_responses_adapter_v1 as transport
from build_learned_request_v4 import (
    DEVELOPMENT_REVISION,
    INSTRUCTION,
    MAX_COMPARISONS,
    MAX_EVENTS,
    PROPOSAL_SCHEMA,
    REQUEST_SCHEMA,
    sha256_bytes,
)
from validate_learned_proposal_v3 import load_json_strict, validate_packet

ADAPTER_SCHEMA = "trackcade-openai-responses-adapter-v3"
REASONING_EFFORTS = transport.REASONING_EFFORTS


def verify_request(request_path: Path, packet_path: Path):
    request_bytes = request_path.read_bytes()
    request = load_json_strict(request_path)
    if request.get("schema") != REQUEST_SCHEMA:
        raise SystemExit("V4 request schema mismatch")
    if request.get("instruction") != INSTRUCTION:
        raise SystemExit("V4 request instruction mismatch")
    packet_bytes = packet_path.read_bytes()
    packet = load_json_strict(packet_path)
    errors = validate_packet(packet)
    if errors:
        raise SystemExit("V4 packet invalid: " + "; ".join(errors))
    if request.get("packet") != packet:
        raise SystemExit("V4 request packet does not equal supplied exact packet")
    integrity = request.get("integrity") or {}
    if integrity.get("developmentRevision") != DEVELOPMENT_REVISION:
        raise SystemExit("V4 development revision mismatch")
    if integrity.get("packetSha256") != sha256_bytes(packet_bytes):
        raise SystemExit("V4 packet hash mismatch")
    if integrity.get("sourceMapSha256") != packet.get("sourceMapSha256"):
        raise SystemExit("V4 source-map binding mismatch")
    if integrity.get("instructionSha256") != sha256_bytes(INSTRUCTION.encode("utf-8")):
        raise SystemExit("V4 instruction hash mismatch")
    if integrity.get("analyzerRunnerSha256") != packet["source"]["analyzerRunnerSha256"]:
        raise SystemExit("V4 Analyzer identity mismatch")
    if integrity.get("analysisJsonSha256") != packet["source"]["analysisJsonSha256"]:
        raise SystemExit("V4 analysis identity mismatch")
    return request_bytes, request, packet, packet_bytes


def _anchor_schema(max_index: int) -> dict:
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["type", "index"],
        "properties": {
            "type": {"type": "string", "enum": ["evidence"]},
            "index": {"type": "integer", "minimum": 0, "maximum": max_index},
        },
    }


def proposal_json_schema(request: dict) -> dict:
    contract = request.get("responseContract") or {}
    if contract.get("schema") != PROPOSAL_SCHEMA:
        raise SystemExit("V4 response contract schema mismatch")
    if contract.get("allowedKinds") != ["section", "energy", "peak", "drop"]:
        raise SystemExit("V4 semantic kinds mismatch")
    if contract.get("allowedAnchorTypes") != ["evidence"]:
        raise SystemExit("V4 anchor type mismatch")
    if contract.get("allowedDropPresence") != ["drop_present", "no_drop", "insufficient_semantic_evidence"]:
        raise SystemExit("V4 dropPresence contract mismatch")
    if contract.get("allowedLocalizationStatus") != ["localized", "no_selectable_anchor", "not_applicable"]:
        raise SystemExit("V4 localization contract mismatch")
    if contract.get("allowedComparisonRoles") != ["selected_drop", "ordinary_transition", "ambiguous"]:
        raise SystemExit("V4 comparison-role contract mismatch")
    if contract.get("maxEvents") != MAX_EVENTS or contract.get("maxCandidateComparisons") != MAX_COMPARISONS:
        raise SystemExit("V4 technical collection bound mismatch")
    if contract.get("confidenceFieldsDiagnosticOnly") is not True:
        raise SystemExit("V4 confidence diagnostics contract mismatch")

    source = request["packet"]["source"]
    anchors = request["packet"]["anchors"]
    if not anchors:
        raise SystemExit("V4 packet has no anchors")
    anchor_schema = _anchor_schema(len(anchors) - 1)
    return {
        "type": "object",
        "additionalProperties": False,
        "required": ["schema", "source", "trackSemanticDecision", "candidateComparisons", "events"],
        "properties": {
            "schema": {"type": "string", "enum": [PROPOSAL_SCHEMA]},
            "source": {
                "type": "object",
                "additionalProperties": False,
                "required": ["analyzerRunnerSha256", "analysisJsonSha256"],
                "properties": {
                    "analyzerRunnerSha256": {"type": "string", "enum": [source["analyzerRunnerSha256"]]},
                    "analysisJsonSha256": {"type": "string", "enum": [source["analysisJsonSha256"]]},
                },
            },
            "trackSemanticDecision": {
                "type": "object",
                "additionalProperties": False,
                "required": ["dropPresence", "presenceConfidence", "localizationStatus", "rationale"],
                "properties": {
                    "dropPresence": {
                        "type": "string",
                        "enum": ["drop_present", "no_drop", "insufficient_semantic_evidence"],
                    },
                    "presenceConfidence": {"type": "number", "minimum": 0, "maximum": 1},
                    "localizationStatus": {
                        "type": "string",
                        "enum": ["localized", "no_selectable_anchor", "not_applicable"],
                    },
                    "rationale": {"type": "string", "minLength": 1, "maxLength": 800},
                },
            },
            "candidateComparisons": {
                "type": "array",
                "maxItems": MAX_COMPARISONS,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["anchor", "role", "distinctiveness", "rationale"],
                    "properties": {
                        "anchor": anchor_schema,
                        "role": {
                            "type": "string",
                            "enum": ["selected_drop", "ordinary_transition", "ambiguous"],
                        },
                        "distinctiveness": {"type": "number", "minimum": 0, "maximum": 1},
                        "rationale": {"type": "string", "minLength": 1, "maxLength": 500},
                    },
                },
            },
            "events": {
                "type": "array",
                "maxItems": MAX_EVENTS,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["kind", "semanticConfidence", "anchor", "name", "rationale"],
                    "properties": {
                        "kind": {"type": "string", "enum": ["section", "energy", "peak", "drop"]},
                        "semanticConfidence": {"type": "number", "minimum": 0, "maximum": 1},
                        "anchor": anchor_schema,
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
    serialized = json.dumps(provider_input, sort_keys=True, separators=(",", ":")).lower()
    for token in ('"aliases"', '"aliascolumns"', '"dropsseconds"', "reference_drops", '"diagnosticlabelhint"', '"diagnostictypehint"'):
        if token in serialized:
            raise SystemExit(f"forbidden provider-input content: {token}")
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
                "name": "trackcade_musical_interpretation_v3",
                "strict": True,
                "schema": proposal_json_schema(request),
            }
        },
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--request", type=Path, required=True)
    ap.add_argument("--packet", type=Path, required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--reasoning-effort", default="medium", choices=sorted(REASONING_EFFORTS))
    ap.add_argument("--max-output-tokens", type=int, default=4096)
    ap.add_argument("--timeout-seconds", type=int, default=180)
    ap.add_argument("--payload-output", type=Path, required=True)
    ap.add_argument("--raw-response-output", type=Path)
    ap.add_argument("--proposal-candidate-output", type=Path)
    ap.add_argument("--adapter-report-output", type=Path, required=True)
    ap.add_argument("--response-fixture", type=Path)
    ap.add_argument("--prepare-only", action="store_true")
    args = ap.parse_args()

    request_bytes, request, packet, packet_bytes = verify_request(args.request, args.packet)
    payload = build_api_payload(request, args.model, args.reasoning_effort, args.max_output_tokens)
    payload_bytes = (json.dumps(payload, indent=2, sort_keys=True) + "\n").encode("utf-8")
    args.payload_output.parent.mkdir(parents=True, exist_ok=True)
    args.payload_output.write_bytes(payload_bytes)

    report = {
        "schema": ADAPTER_SCHEMA,
        "provider": "openai",
        "endpoint": transport.ENDPOINT,
        "requestedModel": args.model,
        "reasoningEffort": args.reasoning_effort,
        "maxOutputTokens": args.max_output_tokens,
        "store": False,
        "developmentRevision": DEVELOPMENT_REVISION,
        "confidenceFieldsDiagnosticOnly": True,
        "integrity": {
            "trackcadeRequestSha256": sha256_bytes(request_bytes),
            "packetSha256": sha256_bytes(packet_bytes),
            "sourceMapSha256": packet["sourceMapSha256"],
            "apiPayloadSha256": sha256_bytes(payload_bytes),
            "analyzerRunnerSha256": packet["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
        },
    }

    if args.prepare_only:
        if args.response_fixture or args.raw_response_output or args.proposal_candidate_output:
            raise SystemExit("prepare-only cannot be combined with response outputs/fixture")
        report["status"] = "payload_prepared_no_provider_call"
        args.adapter_report_output.parent.mkdir(parents=True, exist_ok=True)
        args.adapter_report_output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        print(json.dumps({
            "status": report["status"],
            "apiPayloadSha256": report["integrity"]["apiPayloadSha256"],
        }, indent=2))
        return

    if not args.raw_response_output or not args.proposal_candidate_output:
        raise SystemExit("live/fixture mode requires raw-response-output and proposal-candidate-output")
    if args.response_fixture:
        raw = args.response_fixture.read_bytes()
        http_request_id = None
        client_request_id = None
        execution_mode = "offline_fixture"
    else:
        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise SystemExit("OPENAI_API_KEY is required for live OpenAI execution")
        if not 1 <= args.timeout_seconds <= 900:
            raise SystemExit("timeout-seconds outside adapter bounds")
        raw, http_request_id, client_request_id = transport.perform_request(payload_bytes, api_key, args.timeout_seconds)
        execution_mode = "live"

    args.raw_response_output.parent.mkdir(parents=True, exist_ok=True)
    args.raw_response_output.write_bytes(raw)
    response, candidate_bytes = transport.extract_candidate(raw)
    args.proposal_candidate_output.parent.mkdir(parents=True, exist_ok=True)
    args.proposal_candidate_output.write_bytes(candidate_bytes)

    report.update({
        "status": "provider_response_extracted",
        "executionMode": execution_mode,
        "responseId": response["id"],
        "responseModel": response["model"],
        "httpRequestId": http_request_id,
        "clientRequestId": client_request_id,
    })
    report["integrity"].update({
        "rawProviderResponseSha256": sha256_bytes(raw),
        "proposalCandidateSha256": sha256_bytes(candidate_bytes),
    })
    if isinstance(response.get("usage"), dict):
        report["usage"] = response["usage"]
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

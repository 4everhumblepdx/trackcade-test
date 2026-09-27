#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

from validate_learned_proposal_v1 import load_json_strict, validate_and_normalize
from build_learned_request_v1 import REQUEST_SCHEMA, INSTRUCTION

RUN_SCHEMA = "trackcade-learned-interpretation-provider-run-v1"
SENSITIVE_PARAM_TOKENS = ("secret", "token", "password", "authorization", "apikey", "api_key", "credential")
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def sha256_bytes(data: bytes):
    return hashlib.sha256(data).hexdigest()


def clean_required_text(value, name, max_len=200):
    if not isinstance(value, str):
        raise SystemExit(f"{name} must be text")
    out = " ".join(value.strip().split())
    if not out or len(out) > max_len:
        raise SystemExit(f"{name} invalid")
    return out


def validate_timestamp(value):
    text = clean_required_text(value, "executed-at", 80)
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError as exc:
        raise SystemExit("executed-at must be ISO-8601") from exc
    if parsed.tzinfo is None:
        raise SystemExit("executed-at must include timezone")
    return text


def reject_sensitive_params(value, path="parameters"):
    if isinstance(value, dict):
        for key, child in value.items():
            low = str(key).lower().replace("-", "_")
            if any(token in low for token in SENSITIVE_PARAM_TOKENS):
                raise SystemExit(f"sensitive parameter key forbidden: {path}.{key}")
            reject_sensitive_params(child, f"{path}.{key}")
    elif isinstance(value, list):
        for i, child in enumerate(value):
            reject_sensitive_params(child, f"{path}[{i}]")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--request", type=Path, required=True)
    ap.add_argument("--raw-provider-response", type=Path, required=True)
    ap.add_argument("--proposal-candidate", type=Path, required=True,
                    help="Exact JSON content extracted from provider response by a provider-specific adapter; no repair")
    ap.add_argument("--provider", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--provider-request-id")
    ap.add_argument("--parameters", type=Path, help="JSON object of non-secret observable/configured generation parameters")
    ap.add_argument("--executed-at", required=True)
    ap.add_argument("--harness-source-commit", required=True)
    ap.add_argument("--normalized-proposal", type=Path, required=True)
    ap.add_argument("--validation-report", type=Path, required=True)
    ap.add_argument("--run-manifest", type=Path, required=True)
    args = ap.parse_args()

    request_bytes = args.request.read_bytes()
    request = load_json_strict(args.request)
    if request.get("schema") != REQUEST_SCHEMA:
        raise SystemExit("request schema mismatch")
    if request.get("instruction") != INSTRUCTION:
        raise SystemExit("request instruction mismatch")
    packet = request.get("packet")
    if not isinstance(packet, dict):
        raise SystemExit("request packet missing")
    integrity = request.get("integrity") or {}
    expected_packet_sha = integrity.get("packetSha256")
    if not isinstance(expected_packet_sha, str) or not HEX64.fullmatch(expected_packet_sha):
        raise SystemExit("request packet hash invalid")
    # Reproduce the packet serialization identity used by the request builder only through
    # the explicit hash it recorded; packet source identity is validated again below.
    if integrity.get("instructionSha256") != sha256_bytes(INSTRUCTION.encode("utf-8")):
        raise SystemExit("request instruction hash mismatch")

    raw_response_bytes = args.raw_provider_response.read_bytes()
    candidate_bytes = args.proposal_candidate.read_bytes()
    candidate = load_json_strict(args.proposal_candidate)
    normalized, errors = validate_and_normalize(packet, candidate)

    args.validation_report.parent.mkdir(parents=True, exist_ok=True)
    report = {
        "schema": "trackcade-learned-proposal-validation-v1",
        "status": "valid" if not errors else "rejected",
        "requestSha256": sha256_bytes(request_bytes),
        "rawProviderResponseSha256": sha256_bytes(raw_response_bytes),
        "proposalCandidateSha256": sha256_bytes(candidate_bytes),
        "errors": errors,
    }
    args.validation_report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if errors:
        raise SystemExit(2)

    args.normalized_proposal.parent.mkdir(parents=True, exist_ok=True)
    normalized_bytes = (json.dumps(normalized, indent=2, sort_keys=True) + "\n").encode("utf-8")
    args.normalized_proposal.write_bytes(normalized_bytes)

    params = {}
    params_sha = None
    if args.parameters:
        params_bytes = args.parameters.read_bytes()
        params = load_json_strict(args.parameters)
        if not isinstance(params, dict):
            raise SystemExit("parameters JSON must be an object")
        reject_sensitive_params(params)
        params_sha = sha256_bytes(params_bytes)

    provider = clean_required_text(args.provider, "provider")
    model = clean_required_text(args.model, "model")
    request_id = None if args.provider_request_id is None else clean_required_text(args.provider_request_id, "provider-request-id", 300)
    executed_at = validate_timestamp(args.executed_at)
    commit = clean_required_text(args.harness_source_commit, "harness-source-commit", 80)
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise SystemExit("harness-source-commit must be a full lowercase git SHA")

    run_manifest = {
        "schema": RUN_SCHEMA,
        "provider": provider,
        "model": model,
        "providerRequestId": request_id,
        "executedAt": executed_at,
        "harnessSourceCommit": commit,
        "parameters": params,
        "integrity": {
            "requestSha256": sha256_bytes(request_bytes),
            "packetSha256": expected_packet_sha,
            "instructionSha256": integrity["instructionSha256"],
            "rawProviderResponseSha256": sha256_bytes(raw_response_bytes),
            "proposalCandidateSha256": sha256_bytes(candidate_bytes),
            "normalizedProposalSha256": sha256_bytes(normalized_bytes),
            "parametersSha256": params_sha,
            "analyzerRunnerSha256": packet["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
        },
        "trust": {
            "providerResponseTrusted": False,
            "proposalValidated": True,
            "timingAuthority": "deterministic-structure-evidence-only",
            "semanticCompilerStillRequired": True,
            "benchmarkReferencesUsedForGeneration": False,
        },
    }
    args.run_manifest.parent.mkdir(parents=True, exist_ok=True)
    args.run_manifest.write_text(json.dumps(run_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "ingested_valid_provider_proposal",
        "provider": provider,
        "model": model,
        "events": len(normalized["events"]),
        "normalizedProposalSha256": run_manifest["integrity"]["normalizedProposalSha256"],
    }, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from pathlib import Path


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def write_json(path: Path, obj) -> None:
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--case-dir", type=Path, required=True)
    ap.add_argument("--learned-dir", type=Path, required=True)
    ap.add_argument("--timeout-seconds", type=int, default=300)
    args = ap.parse_args()

    if not 1 <= args.timeout_seconds <= 900:
        raise SystemExit("timeout-seconds outside one-attempt runner bounds")
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise SystemExit("OPENAI_API_KEY is required for the authorized live canary")

    sys.path.insert(0, str(args.learned_dir.resolve()))
    import openai_responses_adapter_v1 as transport
    import validate_learned_proposal_v7 as validator

    case = args.case_dir
    status_path = case / "stage1-v7-canary-case-status-v1.json"
    packet_path = case / "structure-evidence-v2.json"
    payload_path = case / "openai-payload-v7-flex8192.json"
    raw_path = case / "openai-raw-response-v7.json"
    candidate_path = case / "learned-proposal-v7-candidate.json"
    normalized_path = case / "learned-proposal-v7-normalized.json"
    validation_path = case / "learned-proposal-v7-validation.json"

    status = json.loads(status_path.read_text(encoding="utf-8"))
    if status.get("schema") != "trackcade-semantic-external-stage1-v7-canary-provider-case-v1":
        raise SystemExit("canary status schema mismatch")
    if status.get("ordinal") != 1 or status.get("providerCallAttempted") is not False:
        raise SystemExit("canary status is not pristine ordinal-1 preflight")
    if status.get("retryAuthorized") is not False or status.get("standardFallbackUsed") is not False:
        raise SystemExit("retry/fallback boundary mismatch")
    if status.get("referenceLabelsRead") is not False or status.get("scoringPerformed") is not False:
        raise SystemExit("label/scoring boundary mismatch")
    if status.get("analyzerExecuted") is not False or status.get("compilerInvoked") is not False:
        raise SystemExit("Analyzer/compiler boundary mismatch")
    if status.get("terminalTracksProcessed") is not False:
        raise SystemExit("terminal boundary mismatch")

    payload_bytes = payload_path.read_bytes()
    if sha_bytes(payload_bytes) != status.get("amendedPayloadSha256"):
        raise SystemExit("amended payload identity mismatch")
    payload = json.loads(payload_bytes.decode("utf-8"))
    if payload.get("model") != "gpt-6-sol":
        raise SystemExit("model mismatch")
    if payload.get("reasoning") != {"effort": "high"}:
        raise SystemExit("reasoning mismatch")
    if payload.get("max_output_tokens") != 8192:
        raise SystemExit("max-output mismatch")
    if payload.get("service_tier") != "flex":
        raise SystemExit("service-tier mismatch")
    if payload.get("store") is not False:
        raise SystemExit("store mismatch")

    # Persist the attempt lock before the only provider-call site executes.
    status["providerCallAttempted"] = True
    status["classification"] = "provider_attempt_started_no_retry_authorized"
    write_json(status_path, status)

    try:
        raw, http_request_id, client_request_id = transport.perform_request(
            payload_bytes, api_key, args.timeout_seconds
        )
    except BaseException as exc:
        status["classification"] = "attempted_no_valid_response"
        status["errors"].append(f"provider_transport_failure:{type(exc).__name__}:{exc}")
        write_json(status_path, status)
        print(json.dumps({"classification": status["classification"], "providerCallAttempted": True}, indent=2))
        return

    raw_path.write_bytes(raw)
    status["providerResponseObserved"] = True
    status["rawProviderResponseSha256"] = sha_bytes(raw)
    status["httpRequestId"] = http_request_id
    status["clientRequestId"] = client_request_id
    write_json(status_path, status)

    try:
        response, candidate_bytes = transport.extract_candidate(raw)
    except BaseException as exc:
        status["classification"] = "attempted_no_valid_response"
        status["errors"].append(f"provider_response_extraction_failure:{type(exc).__name__}:{exc}")
        write_json(status_path, status)
        print(json.dumps({"classification": status["classification"], "providerResponseObserved": True}, indent=2))
        return

    candidate_path.write_bytes(candidate_bytes)
    status["responseId"] = response.get("id")
    status["responseModel"] = response.get("model")
    if isinstance(response.get("usage"), dict):
        status["usage"] = response["usage"]
    status["proposalCandidateSha256"] = sha_bytes(candidate_bytes)

    try:
        packet = validator.load_json_strict(packet_path)
        proposal = validator.load_json_strict(candidate_path)
        normalized, errors = validator.validate_and_normalize(packet, proposal)
    except BaseException as exc:
        normalized, errors = None, [f"validator_exception:{type(exc).__name__}:{exc}"]

    validation = {
        "schema": "trackcade-learned-proposal-validation-v7",
        "status": "valid" if not errors else "rejected",
        "packet": str(packet_path),
        "proposal": str(candidate_path),
        "errors": errors,
        "timingAuthority": "frozen-analyzer-derived-anchor-only",
        "confidenceFieldsDiagnosticOnly": True,
        "analyzerDescriptorsNotSemanticGates": True,
        "trackSummaryDerivedNotGate": True,
        "repeatedSimilarDropsAllowed": True,
        "decisiveImpactRequiredForDrop": True,
        "decisiveImpactUnclearInsufficientForDrop": True,
        "structuralContextOrthogonalNotGate": True,
    }
    write_json(validation_path, validation)

    if errors or normalized is None:
        status["classification"] = "attempted_no_valid_response"
        status["errors"].extend(errors)
        write_json(status_path, status)
        print(json.dumps({"classification": status["classification"], "validationErrors": errors}, indent=2))
        return

    write_json(normalized_path, normalized)
    status["providerCompletedSemanticResponse"] = True
    status["proposalValidated"] = True
    status["normalizedProposalSha256"] = sha_bytes(normalized_path.read_bytes())
    status["classification"] = "completed_valid"
    write_json(status_path, status)
    print(json.dumps({
        "classification": status["classification"],
        "responseId": status.get("responseId"),
        "responseModel": status.get("responseModel"),
        "proposalCandidateSha256": status.get("proposalCandidateSha256"),
        "normalizedProposalSha256": status.get("normalizedProposalSha256"),
        "providerAttempts": 1,
        "retries": 0,
        "standardFallbackUsed": False,
    }, indent=2))


if __name__ == "__main__":
    main()

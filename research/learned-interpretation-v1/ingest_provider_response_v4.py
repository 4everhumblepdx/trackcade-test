#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import ingest_provider_response_v1 as v1
from build_learned_request_v4 import REQUEST_SCHEMA, INSTRUCTION, DEVELOPMENT_REVISION, sha256_bytes
from validate_learned_proposal_v3 import load_json_strict, validate_packet
from validate_learned_proposal_v4 import validate_and_normalize

RUN_SCHEMA = "trackcade-learned-interpretation-provider-run-v3"
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--request", type=Path, required=True)
    ap.add_argument("--packet", type=Path, required=True)
    ap.add_argument("--raw-provider-response", type=Path, required=True)
    ap.add_argument("--proposal-candidate", type=Path, required=True)
    ap.add_argument("--provider", required=True)
    ap.add_argument("--model", required=True)
    ap.add_argument("--provider-request-id")
    ap.add_argument("--parameters", type=Path)
    ap.add_argument("--executed-at", required=True)
    ap.add_argument("--harness-source-commit", required=True)
    ap.add_argument("--normalized-proposal", type=Path, required=True)
    ap.add_argument("--validation-report", type=Path, required=True)
    ap.add_argument("--run-manifest", type=Path, required=True)
    args = ap.parse_args()

    request_bytes = args.request.read_bytes()
    request = load_json_strict(args.request)
    if request.get("schema") != REQUEST_SCHEMA:
        raise SystemExit("V4 request schema mismatch")
    if request.get("instruction") != INSTRUCTION:
        raise SystemExit("V4 request instruction mismatch")
    integrity = request.get("integrity") or {}
    if integrity.get("developmentRevision") != DEVELOPMENT_REVISION:
        raise SystemExit("V4 development revision mismatch")

    packet_bytes = args.packet.read_bytes()
    packet = load_json_strict(args.packet)
    packet_errors = validate_packet(packet)
    if packet_errors:
        raise SystemExit("V4 packet invalid: " + "; ".join(packet_errors))
    if request.get("packet") != packet:
        raise SystemExit("V4 request packet mismatch")
    actual_packet_sha = sha256_bytes(packet_bytes)
    expected_packet_sha = integrity.get("packetSha256")
    if not isinstance(expected_packet_sha, str) or not HEX64.fullmatch(expected_packet_sha) or expected_packet_sha != actual_packet_sha:
        raise SystemExit("V4 request packet hash mismatch")
    if integrity.get("sourceMapSha256") != packet.get("sourceMapSha256"):
        raise SystemExit("V4 source-map binding mismatch")
    if integrity.get("instructionSha256") != sha256_bytes(INSTRUCTION.encode("utf-8")):
        raise SystemExit("V4 instruction hash mismatch")
    if integrity.get("analyzerRunnerSha256") != packet["source"]["analyzerRunnerSha256"]:
        raise SystemExit("V4 Analyzer identity mismatch")
    if integrity.get("analysisJsonSha256") != packet["source"]["analysisJsonSha256"]:
        raise SystemExit("V4 analysis identity mismatch")

    raw_bytes = args.raw_provider_response.read_bytes()
    candidate_bytes = args.proposal_candidate.read_bytes()
    try:
        candidate = load_json_strict(args.proposal_candidate)
        normalized, errors = validate_and_normalize(packet, candidate)
    except ValueError as exc:
        normalized, errors = None, [str(exc)]

    if errors:
        args.validation_report.parent.mkdir(parents=True, exist_ok=True)
        report = {
            "schema": "trackcade-learned-proposal-validation-v3",
            "status": "rejected",
            "requestSha256": sha256_bytes(request_bytes),
            "packetSha256": actual_packet_sha,
            "sourceMapSha256": packet["sourceMapSha256"],
            "rawProviderResponseSha256": sha256_bytes(raw_bytes),
            "proposalCandidateSha256": sha256_bytes(candidate_bytes),
            "confidenceFieldsDiagnosticOnly": True,
            "errors": errors,
        }
        args.validation_report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        raise SystemExit(2)

    params = {}
    params_sha = None
    if args.parameters:
        params_bytes = args.parameters.read_bytes()
        params = load_json_strict(args.parameters)
        if not isinstance(params, dict):
            raise SystemExit("parameters JSON must be object")
        v1.reject_sensitive_params(params)
        params_sha = sha256_bytes(params_bytes)

    provider = v1.clean_required_text(args.provider, "provider")
    model = v1.clean_required_text(args.model, "model")
    request_id = None if args.provider_request_id is None else v1.clean_required_text(args.provider_request_id, "provider-request-id", 300)
    executed_at = v1.validate_timestamp(args.executed_at)
    commit = v1.clean_required_text(args.harness_source_commit, "harness-source-commit", 80)
    if not re.fullmatch(r"[0-9a-f]{40}", commit):
        raise SystemExit("harness-source-commit must be a full lowercase git SHA")

    normalized_bytes = (json.dumps(normalized, indent=2, sort_keys=True) + "\n").encode("utf-8")
    report = {
        "schema": "trackcade-learned-proposal-validation-v3",
        "status": "valid",
        "requestSha256": sha256_bytes(request_bytes),
        "packetSha256": actual_packet_sha,
        "sourceMapSha256": packet["sourceMapSha256"],
        "rawProviderResponseSha256": sha256_bytes(raw_bytes),
        "proposalCandidateSha256": sha256_bytes(candidate_bytes),
        "confidenceFieldsDiagnosticOnly": True,
        "errors": [],
    }
    run_manifest = {
        "schema": RUN_SCHEMA,
        "provider": provider,
        "model": model,
        "providerRequestId": request_id,
        "executedAt": executed_at,
        "harnessSourceCommit": commit,
        "developmentRevision": DEVELOPMENT_REVISION,
        "parameters": params,
        "semanticDecision": {
            "dropPresence": normalized["trackSemanticDecision"]["dropPresence"],
            "localizationStatus": normalized["trackSemanticDecision"]["localizationStatus"],
            "candidateComparisonCount": len(normalized["candidateComparisons"]),
            "dropEventCount": sum(1 for e in normalized["events"] if e.get("kind") == "drop"),
        },
        "integrity": {
            "requestSha256": sha256_bytes(request_bytes),
            "packetSha256": actual_packet_sha,
            "sourceMapSha256": packet["sourceMapSha256"],
            "instructionSha256": integrity["instructionSha256"],
            "rawProviderResponseSha256": sha256_bytes(raw_bytes),
            "proposalCandidateSha256": sha256_bytes(candidate_bytes),
            "normalizedProposalSha256": sha256_bytes(normalized_bytes),
            "parametersSha256": params_sha,
            "analyzerRunnerSha256": packet["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
        },
        "trust": {
            "providerResponseTrusted": False,
            "proposalValidated": True,
            "timingAuthority": "frozen-analyzer-derived-anchor-only",
            "confidenceFieldsDiagnosticOnly": True,
            "semanticCompilerStillRequiredForProduction": True,
            "compilerInvokedByV4Experiment": False,
            "benchmarkReferencesUsedForGeneration": False,
        },
    }

    args.validation_report.parent.mkdir(parents=True, exist_ok=True)
    args.normalized_proposal.parent.mkdir(parents=True, exist_ok=True)
    args.run_manifest.parent.mkdir(parents=True, exist_ok=True)
    args.validation_report.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    args.normalized_proposal.write_bytes(normalized_bytes)
    args.run_manifest.write_text(json.dumps(run_manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "ingested_valid_v4_provider_proposal",
        "provider": provider,
        "model": model,
        "dropPresence": normalized["trackSemanticDecision"]["dropPresence"],
        "candidateComparisons": len(normalized["candidateComparisons"]),
        "events": len(normalized["events"]),
        "normalizedProposalSha256": run_manifest["integrity"]["normalizedProposalSha256"],
    }, indent=2))


if __name__ == "__main__":
    main()

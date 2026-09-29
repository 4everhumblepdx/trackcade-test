#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request
import uuid
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEARNED = HERE.parent / "learned-interpretation-v1"
sys.path.insert(0, str(LEARNED))

import openai_responses_adapter_v1 as transport  # noqa: E402
import openai_responses_adapter_v5 as v5  # noqa: E402

MODEL = "gpt-6-sol"
REASONING_EFFORT = "high"
MAX_OUTPUT_TOKENS = 8192
SERVICE_TIER = "flex"
SOURCE_PREP_SCHEMA = "trackcade-semantic-external-stage1-v5-prep-v1"
AMENDED_PREP_SCHEMA = "trackcade-semantic-external-stage1-v5-flex-prep-v1"
STATUS_SCHEMA = "trackcade-semantic-external-stage1-v5-flex-provider-case-v1"
EXPECTED_REVISION = "stage1-drop-semantics-v5-candidate-first-absolute-pattern"


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha(path: Path) -> str:
    return sha_bytes(path.read_bytes())


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def semantic_projection(payload: dict) -> dict:
    out = dict(payload)
    out.pop("service_tier", None)
    return out


def strict_json_bytes(data: bytes, label: str):
    def no_dupes(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise ValueError(f"duplicate JSON key in {label}: {key}")
            out[key] = value
        return out
    return json.loads(data.decode("utf-8"), object_pairs_hook=no_dupes)


def perform_request_capture(payload_bytes: bytes, api_key: str, timeout_s: int, output_dir: Path):
    client_request_id = str(uuid.uuid4())
    req = urllib.request.Request(
        transport.ENDPOINT,
        data=payload_bytes,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "trackcade-stage1-v5-flex8192",
            "X-Client-Request-Id": client_request_id,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            raw = resp.read()
            return {
                "httpStatus": int(resp.status),
                "raw": raw,
                "httpRequestId": resp.headers.get("x-request-id"),
                "clientRequestId": client_request_id,
                "httpError": False,
            }
    except urllib.error.HTTPError as exc:
        body = exc.read()
        error_path = output_dir / "provider-http-error-response.bin"
        error_path.write_bytes(body)
        return {
            "httpStatus": int(exc.code),
            "raw": body,
            "httpRequestId": exc.headers.get("x-request-id") if exc.headers else None,
            "clientRequestId": client_request_id,
            "httpError": True,
            "errorPath": str(error_path),
        }
    except urllib.error.URLError as exc:
        return {
            "httpStatus": None,
            "raw": None,
            "httpRequestId": None,
            "clientRequestId": client_request_id,
            "httpError": True,
            "transportError": str(exc.reason),
        }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-prep-root", type=Path, required=True)
    ap.add_argument("--amended-prep-root", type=Path, required=True)
    ap.add_argument("--ordinal", type=int, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--harness-source-commit", required=True)
    ap.add_argument("--ingester", type=Path, required=True)
    ap.add_argument("--timeout-seconds", type=int, default=900)
    ap.add_argument("--preflight-only", action="store_true")
    args = ap.parse_args()

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    status_path = out / "stage1-v5-flex-case-status-v1.json"
    status = {
        "schema": STATUS_SCHEMA,
        "stage": "stage1-v5",
        "transportAmendment": "flex",
        "ordinal": args.ordinal,
        "providerContract": {
            "provider": "openai", "api": "responses", "model": MODEL,
            "reasoningEffort": REASONING_EFFORT, "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "serviceTier": SERVICE_TIER, "store": False,
        },
        "providerCallAttempted": False,
        "providerResponseObserved": False,
        "providerCompletedSemanticResponse": False,
        "standardFallbackUsed": False,
        "retryAuthorized": False,
        "compilerInvoked": False,
        "terminalTracksProcessed": False,
        "classification": "preflight_not_started",
        "errors": [],
    }

    def finish(code: int) -> int:
        status["finishedAt"] = now()
        write_json(status_path, status)
        return code

    try:
        if not 1 <= args.ordinal <= 50:
            raise ValueError("ordinal must be 1..50")
        if not re.fullmatch(r"[0-9a-f]{40}", args.harness_source_commit):
            raise ValueError("harness source commit must be full lowercase SHA")
        if not 1 <= args.timeout_seconds <= 900:
            raise ValueError("timeout seconds must be 1..900")

        source_manifest_path = args.source_prep_root / "STAGE1_V5_PREP_MANIFEST_V1.json"
        amended_manifest_path = args.amended_prep_root / "STAGE1_V5_FLEX_PREP_MANIFEST_V1.json"
        source_manifest = strict_json_bytes(source_manifest_path.read_bytes(), "source V5 prep manifest")
        amended_manifest = strict_json_bytes(amended_manifest_path.read_bytes(), "V5 Flex prep manifest")
        if source_manifest.get("schema") != SOURCE_PREP_SCHEMA:
            raise ValueError("source V5 prep schema mismatch")
        if amended_manifest.get("schema") != AMENDED_PREP_SCHEMA:
            raise ValueError("V5 Flex prep schema mismatch")
        if source_manifest.get("trackCount") != 50 or amended_manifest.get("trackCount") != 50:
            raise ValueError("prep track count mismatch")
        if source_manifest.get("providerCallsObserved") != 0 or amended_manifest.get("providerCallsObserved") != 0:
            raise ValueError("prep unexpectedly observed provider calls")
        for manifest in (source_manifest, amended_manifest):
            if manifest.get("terminalTracksProcessed") is not False:
                raise ValueError("prep touched terminal holdout")
            if manifest.get("analyzerExecuted") is not False or manifest.get("audioDecoded") is not False:
                raise ValueError("prep Analyzer/audio boundary mismatch")
            if manifest.get("compilerInvoked") is not False:
                raise ValueError("prep compiler boundary mismatch")

        amendment = amended_manifest.get("transportAmendment") or {}
        expected_amendment = {
            "provider": "openai", "api": "responses", "model": MODEL,
            "reasoningEffort": REASONING_EFFORT, "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "store": False, "serviceTier": SERVICE_TIER,
            "allowedChangesOnly": ["service_tier"], "semanticPayloadUnchanged": True,
        }
        if amendment != expected_amendment:
            raise ValueError("V5 Flex amendment contract mismatch")

        source_rows = [r for r in source_manifest["tracks"] if int(r.get("ordinal", 0)) == args.ordinal]
        amended_rows = [r for r in amended_manifest["tracks"] if int(r.get("ordinal", 0)) == args.ordinal]
        if len(source_rows) != 1 or len(amended_rows) != 1:
            raise ValueError("ordinal is not uniquely represented in prep manifests")
        sr, ar = source_rows[0], amended_rows[0]
        if sr["id"] != ar["id"] or sr["stem"] != ar["stem"]:
            raise ValueError("source/amended track identity mismatch")
        stem = sr["stem"]
        source_case = args.source_prep_root / "cases" / f"{args.ordinal:02d}-{stem}"
        amended_case = args.amended_prep_root / "cases" / f"{args.ordinal:02d}-{stem}"
        request_path = source_case / "learned-request-v5.json"
        packet_path = source_case / "structure-evidence-v2.json"
        source_payload_path = source_case / "openai-payload-v5.json"
        amended_payload_path = amended_case / "openai-payload-v5-flex.json"

        request_bytes, request, packet, packet_bytes = v5.verify_request(request_path, packet_path)
        integrity = request.get("integrity") or {}
        if integrity.get("developmentRevision") != EXPECTED_REVISION:
            raise ValueError("V5 semantic revision mismatch")

        source_payload_bytes = source_payload_path.read_bytes()
        amended_payload_bytes = amended_payload_path.read_bytes()
        if sha(source_payload_path) != ar["sourceV5PayloadSha256"]:
            raise ValueError("source payload hash mismatch against amendment manifest")
        if sha(amended_payload_path) != ar["amendedFlexPayloadSha256"]:
            raise ValueError("amended payload hash mismatch against amendment manifest")
        rebuilt_source = v5.build_api_payload(request, MODEL, REASONING_EFFORT, MAX_OUTPUT_TOKENS)
        rebuilt_source_bytes = (json.dumps(rebuilt_source, indent=2, sort_keys=True) + "\n").encode("utf-8")
        if rebuilt_source_bytes != source_payload_bytes:
            raise ValueError("live path cannot reproduce exact frozen source V5 payload")

        source_payload = strict_json_bytes(source_payload_bytes, "source V5 payload")
        amended_payload = strict_json_bytes(amended_payload_bytes, "amended V5 Flex payload")
        if source_payload.get("max_output_tokens") != MAX_OUTPUT_TOKENS or "service_tier" in source_payload:
            raise ValueError("source transport contract mismatch")
        if amended_payload.get("model") != MODEL or amended_payload.get("reasoning") != {"effort": REASONING_EFFORT}:
            raise ValueError("amended model/reasoning mismatch")
        if amended_payload.get("max_output_tokens") != MAX_OUTPUT_TOKENS or amended_payload.get("service_tier") != SERVICE_TIER:
            raise ValueError("amended transport contract mismatch")
        if amended_payload.get("store") is not False:
            raise ValueError("amended store mismatch")
        if semantic_projection(source_payload) != semantic_projection(amended_payload):
            raise ValueError("semantic payload drift detected")

        status.update({
            "id": sr["id"], "stem": stem, "developmentRevision": EXPECTED_REVISION,
            "harnessSourceCommit": args.harness_source_commit,
            "sourceRequestSha256": sha_bytes(request_bytes),
            "packetSha256": sha_bytes(packet_bytes),
            "sourcePayloadSha256": sha_bytes(source_payload_bytes),
            "amendedPayloadSha256": sha_bytes(amended_payload_bytes),
            "semanticProjectionSha256": ar["semanticProjectionSha256"],
            "semanticPayloadUnchanged": True,
            "classification": "offline_preflight_complete_no_provider_call",
        })
        write_json(status_path, status)
        if args.preflight_only:
            return finish(0)

        api_key = os.environ.get("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY missing")

        status["providerCallAttempted"] = True
        status["providerCallStartedAt"] = now()
        write_json(status_path, status)
        result = perform_request_capture(amended_payload_bytes, api_key, args.timeout_seconds, out)
        status["providerCallFinishedAt"] = now()
        status["httpStatus"] = result.get("httpStatus")
        status["httpRequestId"] = result.get("httpRequestId")
        status["clientRequestId"] = result.get("clientRequestId")

        if result.get("httpError"):
            raw = result.get("raw")
            if raw is not None:
                status["providerResponseObserved"] = True
                status["providerHttpErrorResponseSha256"] = sha_bytes(raw)
                try:
                    err = strict_json_bytes(raw, "provider HTTP error response")
                    status["providerHttpError"] = err.get("error") if isinstance(err, dict) else None
                except Exception:
                    status["providerHttpError"] = None
            if result.get("transportError"):
                status["transportError"] = result["transportError"]
            status["classification"] = "flex_http_or_transport_failure_no_completed_response"
            return finish(75)

        raw = result["raw"]
        status["providerResponseObserved"] = True
        raw_path = out / "raw-response.json"
        raw_path.write_bytes(raw)
        status["rawResponseSha256"] = sha_bytes(raw)
        response = strict_json_bytes(raw, "OpenAI response")
        if not isinstance(response, dict) or response.get("object") != "response":
            status["classification"] = "provider_response_object_invalid_no_completed_response"
            return finish(75)
        status["observedProviderStatus"] = response.get("status")
        status["observedProviderResponseId"] = response.get("id")
        status["observedProviderServiceTier"] = response.get("service_tier")
        if isinstance(response.get("usage"), dict):
            status["usage"] = response["usage"]
        if response.get("status") != "completed":
            status["incompleteDetails"] = response.get("incomplete_details")
            status["classification"] = "provider_incomplete_no_completed_response"
            return finish(75)
        status["providerCompletedSemanticResponse"] = True
        if response.get("service_tier") != SERVICE_TIER:
            status["errors"].append(f"completed response service_tier was {response.get('service_tier')!r}, expected 'flex'")
            status["classification"] = "provider_completed_wrong_service_tier_no_retry"
            return finish(0)

        response_obj, candidate_bytes = transport.extract_candidate(raw)
        candidate_path = out / "proposal-candidate.json"
        candidate_path.write_bytes(candidate_bytes)
        status["proposalCandidateSha256"] = sha_bytes(candidate_bytes)

        params = {
            "adapter": "exact-frozen-payload-v5-flex8192",
            "requestedModel": MODEL, "responseModel": response_obj.get("model"),
            "reasoningEffort": REASONING_EFFORT, "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "serviceTierRequested": SERVICE_TIER, "serviceTierObserved": response_obj.get("service_tier"),
            "store": False, "openaiResponseId": response_obj.get("id"),
            "httpRequestId": result.get("httpRequestId"), "clientRequestId": result.get("clientRequestId"),
            "usage": response_obj.get("usage"), "developmentRevision": EXPECTED_REVISION,
            "confidenceFieldsDiagnosticOnly": True, "trackSummaryDerivedNotGate": True,
            "repeatedSimilarDropsAllowed": True, "compilerInvoked": False,
            "semanticPayloadUnchanged": True,
        }
        params_path = out / "parameters.json"
        write_json(params_path, params)
        normalized = out / "normalized-proposal.json"
        validation = out / "validation-report.json"
        run_manifest = out / "provider-run-manifest.json"
        ingest_rc = subprocess.run([
            sys.executable, str(args.ingester),
            "--request", str(request_path), "--packet", str(packet_path),
            "--raw-provider-response", str(raw_path), "--proposal-candidate", str(candidate_path),
            "--provider", "openai", "--model", str(response_obj.get("model")),
            "--provider-request-id", str(response_obj.get("id")), "--parameters", str(params_path),
            "--executed-at", status["providerCallFinishedAt"], "--harness-source-commit", args.harness_source_commit,
            "--normalized-proposal", str(normalized), "--validation-report", str(validation),
            "--run-manifest", str(run_manifest),
        ], check=False).returncode
        status["ingestionReturnCode"] = ingest_rc
        if validation.is_file(): status["validationReportSha256"] = sha(validation)
        if normalized.is_file():
            status["normalizedProposalSha256"] = sha(normalized)
            norm = strict_json_bytes(normalized.read_bytes(), "normalized proposal")
            status["dropPresence"] = norm["trackSummary"]["dropPresence"]
            status["dropCount"] = norm["trackSummary"]["dropCount"]
            status["ambiguousCandidateCount"] = norm["trackSummary"]["ambiguousCandidateCount"]
            status["candidateAssessmentCount"] = len(norm["candidateAssessments"])
            status["dropProposalCount"] = sum(1 for e in norm["events"] if e.get("kind") == "drop")
        if run_manifest.is_file(): status["providerRunManifestSha256"] = sha(run_manifest)

        if ingest_rc == 0 and normalized.is_file():
            status["classification"] = "provider_completed_validated_v5_flex8192_proposal_no_retry"
        elif ingest_rc == 2:
            status["classification"] = "provider_completed_v5_flex8192_validation_failure_no_retry"
        else:
            status["classification"] = "provider_completed_postprovider_ingestion_failure_no_retry"
            status["errors"].append(f"ingestion return code {ingest_rc}")
        return finish(0)

    except Exception as exc:
        status["errors"].append(str(exc))
        status["classification"] = "local_preprovider_or_postprovider_infrastructure_failure"
        return finish(2)


if __name__ == "__main__":
    raise SystemExit(main())

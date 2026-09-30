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

ORDINAL = 4
MODEL = "gpt-6-sol"
REASONING_EFFORT = "high"
BASE_MAX_OUTPUT_TOKENS = 8192
RETRY_MAX_OUTPUT_TOKENS = 16384
SERVICE_TIER = "flex"
EXPECTED_REVISION = "stage1-drop-semantics-v5-candidate-first-absolute-pattern"
STATUS_SCHEMA = "trackcade-semantic-external-stage1-v5-flex16384-retry4-provider-case-v1"


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha(path: Path) -> str:
    return sha_bytes(path.read_bytes())


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def strict_json_bytes(data: bytes, label: str):
    def no_dupes(pairs):
        out = {}
        for key, value in pairs:
            if key in out:
                raise ValueError(f"duplicate JSON key in {label}: {key}")
            out[key] = value
        return out
    return json.loads(data.decode("utf-8"), object_pairs_hook=no_dupes)


def without_max_output(payload: dict) -> dict:
    out = dict(payload)
    out.pop("max_output_tokens", None)
    return out


def perform_request(payload_bytes: bytes, api_key: str, timeout_s: int, out: Path):
    client_request_id = str(uuid.uuid4())
    req = urllib.request.Request(
        transport.ENDPOINT,
        data=payload_bytes,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "trackcade-stage1-v5-flex16384-retry4",
            "X-Client-Request-Id": client_request_id,
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            return {
                "httpStatus": int(resp.status),
                "raw": resp.read(),
                "httpRequestId": resp.headers.get("x-request-id"),
                "clientRequestId": client_request_id,
                "httpError": False,
            }
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        (out / "provider-http-error-response.bin").write_bytes(raw)
        return {
            "httpStatus": int(exc.code), "raw": raw,
            "httpRequestId": exc.headers.get("x-request-id") if exc.headers else None,
            "clientRequestId": client_request_id, "httpError": True,
        }
    except urllib.error.URLError as exc:
        return {
            "httpStatus": None, "raw": None, "httpRequestId": None,
            "clientRequestId": client_request_id, "httpError": True,
            "transportError": str(exc.reason),
        }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-prep-root", type=Path, required=True)
    ap.add_argument("--flex-prep-root", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--harness-source-commit", required=True)
    ap.add_argument("--ingester", type=Path, required=True)
    ap.add_argument("--timeout-seconds", type=int, default=900)
    ap.add_argument("--preflight-only", action="store_true")
    args = ap.parse_args()

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    status_path = out / "stage1-v5-flex16384-retry4-case-status-v1.json"
    status = {
        "schema": STATUS_SCHEMA,
        "stage": "stage1-v5",
        "ordinal": ORDINAL,
        "retryEvidenceBound": True,
        "providerContract": {
            "provider": "openai", "api": "responses", "model": MODEL,
            "reasoningEffort": REASONING_EFFORT,
            "maxOutputTokens": RETRY_MAX_OUTPUT_TOKENS,
            "serviceTier": SERVICE_TIER, "store": False,
        },
        "providerCallAttempted": False,
        "providerResponseObserved": False,
        "providerCompletedSemanticResponse": False,
        "standardFallbackUsed": False,
        "additionalRetryAuthorized": False,
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
        if not re.fullmatch(r"[0-9a-f]{40}", args.harness_source_commit):
            raise ValueError("harness source commit must be full lowercase SHA")
        if not 1 <= args.timeout_seconds <= 900:
            raise ValueError("timeout seconds must be 1..900")

        source_manifest_path = args.source_prep_root / "STAGE1_V5_PREP_MANIFEST_V1.json"
        flex_manifest_path = args.flex_prep_root / "STAGE1_V5_FLEX_PREP_MANIFEST_V1.json"
        source_manifest = strict_json_bytes(source_manifest_path.read_bytes(), "source prep manifest")
        flex_manifest = strict_json_bytes(flex_manifest_path.read_bytes(), "flex prep manifest")
        if source_manifest.get("schema") != "trackcade-semantic-external-stage1-v5-prep-v1":
            raise ValueError("source prep schema mismatch")
        if flex_manifest.get("schema") != "trackcade-semantic-external-stage1-v5-flex-prep-v1":
            raise ValueError("flex prep schema mismatch")
        if source_manifest.get("providerCallsObserved") != 0 or flex_manifest.get("providerCallsObserved") != 0:
            raise ValueError("prep observed provider calls")
        for m in (source_manifest, flex_manifest):
            if m.get("terminalTracksProcessed") is not False or m.get("compilerInvoked") is not False:
                raise ValueError("research boundary mismatch")
            if m.get("analyzerExecuted") is not False or m.get("audioDecoded") is not False:
                raise ValueError("Analyzer/audio boundary mismatch")

        sr = [r for r in source_manifest["tracks"] if int(r.get("ordinal", 0)) == ORDINAL]
        fr = [r for r in flex_manifest["tracks"] if int(r.get("ordinal", 0)) == ORDINAL]
        if len(sr) != 1 or len(fr) != 1:
            raise ValueError("ordinal 4 not uniquely represented")
        sr, fr = sr[0], fr[0]
        if sr["id"] != fr["id"] or sr["stem"] != fr["stem"]:
            raise ValueError("track identity mismatch")
        stem = sr["stem"]
        source_case = args.source_prep_root / "cases" / f"04-{stem}"
        flex_case = args.flex_prep_root / "cases" / f"04-{stem}"
        request_path = source_case / "learned-request-v5.json"
        packet_path = source_case / "structure-evidence-v2.json"
        source_payload_path = source_case / "openai-payload-v5.json"
        flex_payload_path = flex_case / "openai-payload-v5-flex.json"

        request_bytes, request, packet, packet_bytes = v5.verify_request(request_path, packet_path)
        if (request.get("integrity") or {}).get("developmentRevision") != EXPECTED_REVISION:
            raise ValueError("V5 development revision mismatch")
        if sha(source_payload_path) != fr["sourceV5PayloadSha256"]:
            raise ValueError("source payload hash mismatch")
        if sha(flex_payload_path) != fr["amendedFlexPayloadSha256"]:
            raise ValueError("frozen Flex payload hash mismatch")

        source_payload_bytes = source_payload_path.read_bytes()
        flex_payload_bytes = flex_payload_path.read_bytes()
        source_payload = strict_json_bytes(source_payload_bytes, "source payload")
        flex_payload = strict_json_bytes(flex_payload_bytes, "frozen Flex payload")
        if source_payload.get("max_output_tokens") != BASE_MAX_OUTPUT_TOKENS or "service_tier" in source_payload:
            raise ValueError("source 8192 transport contract mismatch")
        if flex_payload.get("model") != MODEL:
            raise ValueError("Flex model mismatch")
        if flex_payload.get("reasoning") != {"effort": REASONING_EFFORT}:
            raise ValueError("Flex reasoning mismatch")
        if flex_payload.get("max_output_tokens") != BASE_MAX_OUTPUT_TOKENS:
            raise ValueError("Flex base output ceiling mismatch")
        if flex_payload.get("service_tier") != SERVICE_TIER or flex_payload.get("store") is not False:
            raise ValueError("Flex service/store mismatch")

        retry_payload = dict(flex_payload)
        retry_payload["max_output_tokens"] = RETRY_MAX_OUTPUT_TOKENS
        if without_max_output(retry_payload) != without_max_output(flex_payload):
            raise ValueError("retry payload changed more than max_output_tokens")
        retry_payload_bytes = (json.dumps(retry_payload, indent=2, sort_keys=True) + "\n").encode("utf-8")
        retry_payload_path = out / "openai-payload-v5-flex16384-retry4.json"
        retry_payload_path.write_bytes(retry_payload_bytes)

        status.update({
            "id": sr["id"], "stem": stem,
            "developmentRevision": EXPECTED_REVISION,
            "harnessSourceCommit": args.harness_source_commit,
            "sourceRequestSha256": sha_bytes(request_bytes),
            "packetSha256": sha_bytes(packet_bytes),
            "sourcePayloadSha256": sha_bytes(source_payload_bytes),
            "frozenFlex8192PayloadSha256": sha_bytes(flex_payload_bytes),
            "retryFlex16384PayloadSha256": sha_bytes(retry_payload_bytes),
            "transportOnlyChange": {"field": "max_output_tokens", "from": 8192, "to": 16384},
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

        result = perform_request(retry_payload_bytes, api_key, args.timeout_seconds, out)
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
                    status["providerHttpError"] = strict_json_bytes(raw, "HTTP error response").get("error")
                except Exception:
                    status["providerHttpError"] = None
            if result.get("transportError"):
                status["transportError"] = result["transportError"]
            status["classification"] = "flex16384_http_or_transport_failure_no_completed_response"
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
            status["classification"] = "provider_completed_wrong_service_tier_no_further_retry"
            return finish(0)

        response_obj, candidate_bytes = transport.extract_candidate(raw)
        candidate_path = out / "proposal-candidate.json"
        candidate_path.write_bytes(candidate_bytes)
        status["proposalCandidateSha256"] = sha_bytes(candidate_bytes)
        params = {
            "adapter": "evidence-bound-v5-flex16384-retry4",
            "requestedModel": MODEL, "responseModel": response_obj.get("model"),
            "reasoningEffort": REASONING_EFFORT,
            "maxOutputTokens": RETRY_MAX_OUTPUT_TOKENS,
            "serviceTierRequested": SERVICE_TIER,
            "serviceTierObserved": response_obj.get("service_tier"),
            "store": False,
            "openaiResponseId": response_obj.get("id"),
            "httpRequestId": result.get("httpRequestId"),
            "clientRequestId": result.get("clientRequestId"),
            "usage": response_obj.get("usage"),
            "developmentRevision": EXPECTED_REVISION,
            "semanticPayloadUnchanged": True,
            "transportOnlyChange": {"field": "max_output_tokens", "from": 8192, "to": 16384},
            "confidenceFieldsDiagnosticOnly": True,
            "trackSummaryDerivedNotGate": True,
            "repeatedSimilarDropsAllowed": True,
            "compilerInvoked": False,
        }
        params_path = out / "parameters.json"
        write_json(params_path, params)
        normalized = out / "normalized-proposal.json"
        validation = out / "validation-report.json"
        run_manifest = out / "provider-run-manifest.json"
        ingest = subprocess.run([
            sys.executable, str(args.ingester),
            "--request", str(request_path), "--packet", str(packet_path),
            "--raw-provider-response", str(raw_path),
            "--proposal-candidate", str(candidate_path),
            "--provider", "openai", "--model", str(response_obj.get("model")),
            "--provider-request-id", str(response_obj.get("id")),
            "--parameters", str(params_path),
            "--executed-at", status["providerCallFinishedAt"],
            "--harness-source-commit", args.harness_source_commit,
            "--normalized-proposal", str(normalized),
            "--validation-report", str(validation),
            "--run-manifest", str(run_manifest),
        ], check=False)
        status["ingesterReturnCode"] = int(ingest.returncode)
        if ingest.returncode == 0:
            status["classification"] = "provider_completed_validated_v5_flex16384_retry4_proposal_no_further_retry"
        else:
            status["classification"] = "provider_completed_v5_flex16384_retry4_validation_failure_no_further_retry"
            if validation.exists():
                status["validationReportSha256"] = sha(validation)
        return finish(0)
    except Exception as exc:
        status["errors"].append(f"{type(exc).__name__}: {exc}")
        if status.get("providerCallAttempted"):
            status["classification"] = "local_failure_after_provider_attempt_no_further_retry"
            return finish(75)
        status["classification"] = "local_preflight_failure_no_provider_call"
        return finish(70)


if __name__ == "__main__":
    raise SystemExit(main())

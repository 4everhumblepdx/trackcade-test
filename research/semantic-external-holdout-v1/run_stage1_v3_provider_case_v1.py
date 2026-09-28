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
from pathlib import Path

MODEL = "gpt-6-sol"
REASONING_EFFORT = "high"
MAX_OUTPUT_TOKENS = 4096
ANALYZER_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"
ANALYZER_SOURCE_COMMIT = "e308d867980fb1877c3f2e4ce27950deecac0855"
EXPECTED_REVISION = "stage1-drop-semantics-v2-structure-evidence-v2"
PREP_SCHEMA = "trackcade-semantic-external-stage1-v3-prep-v1"
STATUS_SCHEMA = "trackcade-semantic-external-stage1-v3-provider-case-v1"


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def run(cmd: list[str]) -> int:
    return subprocess.run(cmd, check=False).returncode


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prep-root", type=Path, required=True)
    ap.add_argument("--ordinal", type=int, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--adapter", type=Path, required=True)
    ap.add_argument("--ingester", type=Path, required=True)
    ap.add_argument("--harness-source-commit", required=True)
    ap.add_argument("--prep-artifact-id", required=True)
    args = ap.parse_args()

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    status_path = out / "stage1-v3-case-status-v1.json"
    status = {
        "schema": STATUS_SCHEMA,
        "stage": "stage1-v3",
        "developmentRevision": EXPECTED_REVISION,
        "ordinal": args.ordinal,
        "harnessSourceCommit": args.harness_source_commit,
        "prepArtifactId": str(args.prep_artifact_id),
        "githubRunId": os.environ.get("GITHUB_RUN_ID"),
        "githubRunAttempt": int(os.environ.get("GITHUB_RUN_ATTEMPT", "1")),
        "githubJob": os.environ.get("GITHUB_JOB"),
        "providerContract": {
            "provider": "openai",
            "api": "responses",
            "model": MODEL,
            "reasoningEffort": REASONING_EFFORT,
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "store": False,
        },
        "providerCallAttempted": False,
        "providerResponseObserved": False,
        "providerCompletedSemanticResponse": False,
        "retryAuthorized": False,
        "semanticRetryCount": 0,
        "compilerInvoked": False,
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

        manifest_path = args.prep_root / "STAGE1_V3_PREP_MANIFEST_V1.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("schema") != PREP_SCHEMA:
            raise ValueError("V3 prep manifest schema mismatch")
        if manifest.get("status") != "frozen-v3-provider-payloads-prepared-no-provider-call":
            raise ValueError("V3 prep manifest status mismatch")
        if manifest.get("developmentRevision") != EXPECTED_REVISION:
            raise ValueError("V3 prep revision mismatch")
        if manifest.get("trackCount") != 50 or len(manifest.get("tracks") or []) != 50:
            raise ValueError("V3 prep track count mismatch")
        if manifest.get("referenceLabelsReadByPreparation") is not False:
            raise ValueError("V3 prep was not label blind")
        if manifest.get("terminalTracksProcessed") is not False:
            raise ValueError("V3 prep touched terminal")
        if manifest.get("providerCallsObserved") != 0:
            raise ValueError("V3 prep already observed provider calls")
        if manifest.get("compilerInvoked") is not False:
            raise ValueError("V3 prep compiler boundary mismatch")
        expected_contract = {
            "provider": "openai", "api": "responses", "model": MODEL,
            "reasoningEffort": REASONING_EFFORT, "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "store": False, "completedResponsesPerTrack": 0,
        }
        if manifest.get("modelContract") != expected_contract:
            raise ValueError("V3 prep model contract mismatch")

        rows = [x for x in manifest["tracks"] if x.get("ordinal") == args.ordinal]
        if len(rows) != 1:
            raise ValueError("ordinal not unique")
        row = rows[0]
        stem = row["stem"]
        case = args.prep_root / "cases" / f"{args.ordinal:02d}-{stem}"
        status.update({
            "id": row["id"],
            "stem": stem,
            "timingTier": row["timingTier"],
            "compilerEligible": row["compilerEligible"],
            "analyzerRunnerSha256": row["analyzerRunnerSha256"],
            "analyzerSourceCommit": row["analyzerSourceCommit"],
            "analysisJsonSha256": row["analysisJsonSha256"],
            "sourceMapSha256": row["hashes"]["sourceMapSha256"],
        })
        if row["analyzerRunnerSha256"] != ANALYZER_RUNNER_SHA256:
            raise ValueError("Analyzer runner mismatch")
        if row["analyzerSourceCommit"] != ANALYZER_SOURCE_COMMIT:
            raise ValueError("Analyzer source mismatch")

        h = row["hashes"]
        expectations = {
            "structure-evidence-v2.json": h["structureEvidenceV2Sha256"],
            "structure-evidence-v2-source-map.json": h["sourceMapSha256"],
            "learned-request-v3.json": h["learnedRequestV3Sha256"],
            "instruction-diff-v3.json": h["instructionDiffV3Sha256"],
            "openai-payload-v3.json": h["openaiPayloadV3Sha256"],
            "openai-adapter-prepare-report-v3.json": h["adapterPrepareReportV3Sha256"],
        }
        for name, expected in expectations.items():
            p = case / name
            if not p.is_file() or sha(p) != expected:
                raise ValueError(f"frozen V3 prep file mismatch: {name}")

        packet = case / "structure-evidence-v2.json"
        request = case / "learned-request-v3.json"
        frozen_payload = case / "openai-payload-v3.json"
        req = json.loads(request.read_text(encoding="utf-8"))
        if (req.get("integrity") or {}).get("developmentRevision") != EXPECTED_REVISION:
            raise ValueError("V3 request revision mismatch")
        if (req.get("integrity") or {}).get("sourceMapSha256") != h["sourceMapSha256"]:
            raise ValueError("V3 request source-map binding mismatch")
        if "reference_drops" in request.read_text(encoding="utf-8").lower():
            raise ValueError("benchmark token in V3 request")
        if not os.environ.get("OPENAI_API_KEY"):
            raise ValueError("OPENAI_API_KEY missing")

        preflight_payload = out / "preflight-openai-payload-v3.json"
        preflight_report = out / "preflight-openai-adapter-report-v3.json"
        rc = run([
            sys.executable, str(args.adapter),
            "--request", str(request), "--packet", str(packet),
            "--model", MODEL, "--reasoning-effort", REASONING_EFFORT,
            "--max-output-tokens", str(MAX_OUTPUT_TOKENS),
            "--payload-output", str(preflight_payload),
            "--adapter-report-output", str(preflight_report),
            "--prepare-only",
        ])
        status["preflightAdapterReturnCode"] = rc
        if rc != 0:
            raise ValueError("V3 prepare-only preflight failed")
        if preflight_payload.read_bytes() != frozen_payload.read_bytes():
            raise ValueError("V3 live preflight payload differs from frozen payload")
        status["frozenPayloadSha256"] = sha(frozen_payload)
        status["preflightPayloadSha256"] = sha(preflight_payload)
        status["classification"] = "preflight_passed_no_provider_call_yet"
        write_json(status_path, status)

        live_payload = out / "openai-payload-v3.json"
        raw = out / "raw-response.json"
        candidate = out / "proposal-candidate.json"
        adapter_report = out / "adapter-report.json"
        status["providerCallAttempted"] = True
        status["providerCallStartedAt"] = now()
        write_json(status_path, status)
        rc = run([
            sys.executable, str(args.adapter),
            "--request", str(request), "--packet", str(packet),
            "--model", MODEL, "--reasoning-effort", REASONING_EFFORT,
            "--max-output-tokens", str(MAX_OUTPUT_TOKENS),
            "--timeout-seconds", "300",
            "--payload-output", str(live_payload),
            "--raw-response-output", str(raw),
            "--proposal-candidate-output", str(candidate),
            "--adapter-report-output", str(adapter_report),
        ])
        status["adapterReturnCode"] = rc
        status["providerCallFinishedAt"] = now()
        if live_payload.is_file():
            status["livePayloadSha256"] = sha(live_payload)
            if live_payload.read_bytes() != frozen_payload.read_bytes():
                status["errors"].append("live V3 payload differed from frozen payload")

        response = None
        if raw.is_file():
            status["providerResponseObserved"] = True
            status["rawResponseSha256"] = sha(raw)
            try:
                response = json.loads(raw.read_text(encoding="utf-8"))
            except Exception as exc:
                status["errors"].append(f"raw response JSON parse failed: {exc}")
                status["classification"] = "provider_response_observed_completion_unknown_no_retry"
                status["retryAuthorized"] = False
                return finish(0)

        completed = (
            isinstance(response, dict)
            and response.get("object") == "response"
            and response.get("status") == "completed"
            and isinstance(response.get("id"), str) and bool(response.get("id").strip())
            and isinstance(response.get("model"), str) and bool(response.get("model").strip())
        )
        status["providerCompletedSemanticResponse"] = bool(completed)
        if not completed:
            status["classification"] = "provider_infrastructure_no_completed_response"
            status["retryAuthorized"] = True
            if isinstance(response, dict):
                status["observedProviderStatus"] = response.get("status")
                status["observedProviderResponseId"] = response.get("id")
            return finish(75)

        status["retryAuthorized"] = False
        status["openaiResponseId"] = response["id"]
        status["responseModel"] = response["model"]
        if isinstance(response.get("usage"), dict):
            status["usage"] = response["usage"]

        if not (candidate.is_file() and adapter_report.is_file()):
            status["classification"] = "provider_completed_semantic_format_or_extraction_outcome_no_retry"
            return finish(0)

        status["proposalCandidateSha256"] = sha(candidate)
        status["adapterReportSha256"] = sha(adapter_report)
        report = json.loads(adapter_report.read_text(encoding="utf-8"))
        params = {
            "adapter": "openai-responses-v3-structure-evidence-v2",
            "requestedModel": report.get("requestedModel"),
            "responseModel": report.get("responseModel"),
            "reasoningEffort": report.get("reasoningEffort"),
            "maxOutputTokens": report.get("maxOutputTokens"),
            "store": report.get("store"),
            "openaiResponseId": report.get("responseId"),
            "httpRequestId": report.get("httpRequestId"),
            "clientRequestId": report.get("clientRequestId"),
            "usage": report.get("usage"),
            "developmentRevision": EXPECTED_REVISION,
            "compilerInvoked": False,
        }
        params_path = out / "parameters.json"
        write_json(params_path, params)
        normalized = out / "normalized-proposal.json"
        validation = out / "validation-report.json"
        run_manifest = out / "provider-run-manifest.json"
        ingest_rc = run([
            sys.executable, str(args.ingester),
            "--request", str(request), "--packet", str(packet),
            "--raw-provider-response", str(raw),
            "--proposal-candidate", str(candidate),
            "--provider", "openai", "--model", str(response["model"]),
            "--provider-request-id", str(response["id"]),
            "--parameters", str(params_path),
            "--executed-at", status["providerCallFinishedAt"],
            "--harness-source-commit", args.harness_source_commit,
            "--normalized-proposal", str(normalized),
            "--validation-report", str(validation),
            "--run-manifest", str(run_manifest),
        ])
        status["ingestionReturnCode"] = ingest_rc
        if validation.is_file():
            status["validationReportSha256"] = sha(validation)
        if normalized.is_file():
            status["normalizedProposalSha256"] = sha(normalized)
        if run_manifest.is_file():
            status["providerRunManifestSha256"] = sha(run_manifest)

        if ingest_rc == 0 and normalized.is_file():
            status["classification"] = "provider_completed_validated_v3_proposal_no_retry"
        elif ingest_rc == 2:
            status["classification"] = "provider_completed_v3_proposal_validation_failure_no_retry"
        else:
            status["classification"] = "provider_completed_postprovider_v3_ingestion_failure_no_retry"
            status["errors"].append(f"V3 ingestion infrastructure return code {ingest_rc}")
        return finish(0)

    except Exception as exc:
        status["errors"].append(str(exc))
        if status.get("providerCompletedSemanticResponse"):
            status["classification"] = "provider_completed_postprovider_v3_harness_failure_no_retry"
            return finish(0)
        status["classification"] = "preprovider_v3_harness_failure_no_completed_response"
        status["retryAuthorized"] = not status.get("providerResponseObserved", False)
        return finish(70)


if __name__ == "__main__":
    raise SystemExit(main())

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
EXPECTED_REVISION = "stage1-drop-semantics-v4-presence-relative-distinctiveness"
PREP_SCHEMA = "trackcade-semantic-external-stage1-v4-prep-v1"
STATUS_SCHEMA = "trackcade-semantic-external-stage1-v4-provider-case-v1"


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
    ap.add_argument("--preflight-only", action="store_true")
    args = ap.parse_args()

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    status_path = out / "stage1-v4-case-status-v1.json"
    status = {
        "schema": STATUS_SCHEMA,
        "stage": "stage1-v4",
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

        manifest_path = args.prep_root / "STAGE1_V4_PREP_MANIFEST_V1.json"
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest.get("schema") != PREP_SCHEMA:
            raise ValueError("V4 prep manifest schema mismatch")
        if manifest.get("status") != "frozen-v4-provider-payloads-prepared-no-provider-call":
            raise ValueError("V4 prep manifest status mismatch")
        if manifest.get("developmentRevision") != EXPECTED_REVISION:
            raise ValueError("V4 prep revision mismatch")
        if manifest.get("trackCount") != 50 or len(manifest.get("tracks") or []) != 50:
            raise ValueError("V4 prep track count mismatch")
        if manifest.get("referenceLabelsReadByPreparation") is not False:
            raise ValueError("V4 prep was not label blind")
        if manifest.get("terminalTracksProcessed") is not False:
            raise ValueError("V4 prep touched terminal")
        if manifest.get("analyzerExecuted") is not False or manifest.get("audioDecoded") is not False:
            raise ValueError("V4 prep Analyzer/audio boundary mismatch")
        if manifest.get("providerCallsObserved") != 0 or manifest.get("compilerInvoked") is not False:
            raise ValueError("V4 prep provider/compiler boundary mismatch")
        expected_contract = {
            "provider": "openai", "api": "responses", "model": MODEL,
            "reasoningEffort": REASONING_EFFORT, "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "store": False, "completedResponsesPerTrack": 0,
        }
        if manifest.get("modelContract") != expected_contract:
            raise ValueError("V4 prep model contract mismatch")

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
            "sourceMapSha256": row["hashes"]["sourceMapBindingSha256"],
        })
        if row["analyzerRunnerSha256"] != ANALYZER_RUNNER_SHA256:
            raise ValueError("Analyzer runner mismatch")
        if row["analyzerSourceCommit"] != ANALYZER_SOURCE_COMMIT:
            raise ValueError("Analyzer source mismatch")
        if row["hashes"]["structureEvidenceV2Sha256"] != row["sourceV3PacketSha256"]:
            raise ValueError("V4 packet is not exact frozen V3 packet")

        h = row["hashes"]
        expectations = {
            "structure-evidence-v2.json": h["structureEvidenceV2Sha256"],
            "structure-evidence-v2-source-map.json": h["sourceMapFileSha256"],
            "learned-request-v4.json": h["learnedRequestV4Sha256"],
            "instruction-diff-v4.json": h["instructionDiffV4Sha256"],
            "openai-payload-v4.json": h["openaiPayloadV4Sha256"],
            "openai-adapter-prepare-report-v4.json": h["adapterPrepareReportV4Sha256"],
        }
        for name, expected in expectations.items():
            p = case / name
            if not p.is_file() or sha(p) != expected:
                raise ValueError(f"frozen V4 prep file mismatch: {name}")

        packet = case / "structure-evidence-v2.json"
        request = case / "learned-request-v4.json"
        frozen_payload = case / "openai-payload-v4.json"
        req = json.loads(request.read_text(encoding="utf-8"))
        integrity = req.get("integrity") or {}
        if integrity.get("developmentRevision") != EXPECTED_REVISION:
            raise ValueError("V4 request revision mismatch")
        if integrity.get("sourceMapSha256") != h["sourceMapBindingSha256"]:
            raise ValueError("V4 request source-map binding mismatch")
        request_low = request.read_text(encoding="utf-8").lower()
        for token in ("reference_drops", '"dropsseconds"', '"diagnosticlabelhint"', '"diagnostictypehint"'):
            if token in request_low:
                raise ValueError(f"forbidden token in V4 request: {token}")

        preflight_payload = out / "preflight-openai-payload-v4.json"
        preflight_report = out / "preflight-openai-adapter-report-v4.json"
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
            raise ValueError("V4 prepare-only preflight failed")
        if preflight_payload.read_bytes() != frozen_payload.read_bytes():
            raise ValueError("V4 live preflight payload differs from frozen payload")
        status["frozenPayloadSha256"] = sha(frozen_payload)
        status["preflightPayloadSha256"] = sha(preflight_payload)
        status["classification"] = "preflight_passed_no_provider_call_yet"
        write_json(status_path, status)

        if args.preflight_only:
            status["classification"] = "offline_preflight_complete_no_provider_call"
            return finish(0)
        if not os.environ.get("OPENAI_API_KEY"):
            raise ValueError("OPENAI_API_KEY missing")

        live_payload = out / "openai-payload-v4.json"
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
                status["errors"].append("live V4 payload differed from frozen payload")

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
                status["observedProviderError"] = response.get("error")
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
            "adapter": "openai-responses-v4-presence-relative-distinctiveness",
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
            "confidenceFieldsDiagnosticOnly": True,
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
            norm = json.loads(normalized.read_text(encoding="utf-8"))
            status["dropPresence"] = norm["trackSemanticDecision"]["dropPresence"]
            status["localizationStatus"] = norm["trackSemanticDecision"]["localizationStatus"]
            status["candidateComparisonCount"] = len(norm["candidateComparisons"])
            status["dropProposalCount"] = sum(1 for e in norm["events"] if e.get("kind") == "drop")
        if run_manifest.is_file():
            status["providerRunManifestSha256"] = sha(run_manifest)

        if ingest_rc == 0 and normalized.is_file():
            status["classification"] = "provider_completed_validated_v4_proposal_no_retry"
        elif ingest_rc == 2:
            status["classification"] = "provider_completed_v4_proposal_validation_failure_no_retry"
        else:
            status["classification"] = "provider_completed_postprovider_v4_ingestion_failure_no_retry"
            status["errors"].append(f"V4 ingestion infrastructure return code {ingest_rc}")
        return finish(0)

    except Exception as exc:
        status["errors"].append(str(exc))
        if status.get("providerCompletedSemanticResponse"):
            status["classification"] = "provider_completed_postprovider_v4_harness_failure_no_retry"
            return finish(0)
        status["classification"] = "preprovider_v4_harness_failure_no_completed_response"
        status["retryAuthorized"] = not status.get("providerResponseObserved", False)
        return finish(70)


if __name__ == "__main__":
    raise SystemExit(main())

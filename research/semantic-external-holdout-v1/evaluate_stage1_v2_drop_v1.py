#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import evaluate_stage1_drop_v1 as frozen

V2_PREP_SCHEMA = "trackcade-semantic-external-stage1-v2-prep-v1"
V2_PREP_STATUS = "frozen-v2-provider-payloads-prepared-no-provider-call"
V2_CASE_SCHEMA = "trackcade-semantic-external-stage1-v2-provider-case-v1"
V2_REVISION = "stage1-drop-semantics-v2"
V2_CANDIDATE_SCHEMA = "trackcade-semantic-external-stage1-v2-drop-candidates-v1"
V2_EVALUATION_SCHEMA = "trackcade-semantic-external-stage1-v2-drop-evaluation-v1"
V2_FREEZE_SCHEMA = "trackcade-semantic-external-stage1-v2-generation-freeze-v1"
V2_FREEZE_STATUS = "frozen-after-exactly-one-completed-v2-response-per-stage1-track-before-v2-evaluation"


def fail(msg: str) -> None:
    raise SystemExit(f"V2 EVAL FAIL-CLOSED: {msg}")


def find_case_dirs(provider_root: Path):
    statuses = list(provider_root.rglob("stage1-v2-case-status-v1.json"))
    if len(statuses) != 50:
        fail(f"expected 50 V2 provider case statuses, found {len(statuses)}")
    out = {}
    for status_path in statuses:
        status = frozen.load(status_path)
        ordinal = status.get("ordinal")
        if not isinstance(ordinal, int) or isinstance(ordinal, bool) or not 1 <= ordinal <= 50 or ordinal in out:
            fail(f"invalid/duplicate V2 provider ordinal: {ordinal!r}")
        out[ordinal] = status_path.parent
    if set(out) != set(range(1, 51)):
        fail("V2 provider ordinals are not exactly 1..50")
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prep-root", type=Path, required=True)
    ap.add_argument("--provider-root", type=Path, required=True)
    ap.add_argument("--references", type=Path, required=True)
    ap.add_argument("--compiler", type=Path, required=True)
    ap.add_argument("--generation-freeze", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--generation-run-id", required=True)
    ap.add_argument("--generation-head-sha", required=True)
    ap.add_argument("--prep-run-id", required=True)
    ap.add_argument("--prep-artifact-id", required=True)
    args = ap.parse_args()

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    compiled_root = out / "compiled"
    compiled_root.mkdir(exist_ok=True)

    generation_freeze = frozen.load(args.generation_freeze)
    if generation_freeze.get("schema") != V2_FREEZE_SCHEMA or generation_freeze.get("status") != V2_FREEZE_STATUS:
        fail("V2 generation freeze schema/status mismatch")
    source_generation = generation_freeze.get("sourceGeneration") or {}
    expected_generation = {
        "runId": int(args.generation_run_id),
        "headSha": args.generation_head_sha,
        "runAttempt": 1,
        "runConclusion": "success",
        "expectedCases": 50,
        "completedCases": 50,
        "retryEligibleCases": 0,
        "noRetryObservedCases": 0,
        "providerRerunPermitted": False,
    }
    for key, want in expected_generation.items():
        if source_generation.get(key) != want:
            fail(f"generation freeze mismatch: {key}={source_generation.get(key)!r}, expected {want!r}")
    boundary = generation_freeze.get("researchBoundary") or {}
    if boundary.get("v2EvaluationPerformedAtFreeze") is not False or boundary.get("terminalSetUntouched") is not True or boundary.get("aiTimingAuthority") is not False:
        fail("generation freeze research boundary mismatch")

    prep_manifest_path = args.prep_root / "STAGE1_V2_PREP_MANIFEST_V1.json"
    prep = frozen.load(prep_manifest_path)
    if prep.get("schema") != V2_PREP_SCHEMA or prep.get("status") != V2_PREP_STATUS:
        fail("V2 prep manifest schema/status mismatch")
    if prep.get("developmentRevision") != V2_REVISION:
        fail("V2 prep development revision mismatch")
    tracks = prep.get("tracks")
    if not isinstance(tracks, list) or len(tracks) != 50 or prep.get("trackCount") != 50:
        fail("V2 prep manifest does not contain exact 50-track Stage 1 set")
    if prep.get("referenceLabelsReadByPreparation") is not False or prep.get("terminalTracksProcessed") is not False:
        fail("V2 prep violates label-blind/terminal boundary")
    if prep.get("modelContract") != {
        "provider": "openai",
        "api": "responses",
        "model": "gpt-6-sol",
        "reasoningEffort": "high",
        "maxOutputTokens": 4096,
        "store": False,
        "completedResponsesPerTrack": 0,
    }:
        fail("V2 prep provider contract mismatch")

    refs_doc = frozen.load(args.references)
    if refs_doc.get("schema") != frozen.REFERENCE_SCHEMA or refs_doc.get("eventKind") != "drop":
        fail("reference schema/event kind mismatch")
    ref_rows = refs_doc.get("stage1")
    if not isinstance(ref_rows, list) or len(ref_rows) != 50:
        fail("reference Stage 1 set must contain exactly 50 tracks")
    refs_by_id = {x.get("id"): x.get("dropsSeconds") for x in ref_rows if isinstance(x, dict)}
    if len(refs_by_id) != 50:
        fail("reference Stage 1 IDs are not unique/exact")

    cases = find_case_dirs(args.provider_root)
    candidates = []
    provenance_cases = []
    usage_totals = {"input_tokens": 0, "output_tokens": 0, "reasoning_tokens": 0, "total_tokens": 0}

    prep_ids = []
    for row in sorted(tracks, key=lambda x: x["ordinal"]):
        ordinal = row["ordinal"]
        track_id = row["id"]
        prep_ids.append(track_id)
        if ordinal < 1 or ordinal > 50 or row.get("compilerEligible") is not True or row.get("timingTier") not in {"standard", "loose"}:
            fail(f"V2 prep track {ordinal} is not frozen compiler-eligible")
        if row.get("analyzerRunnerSha256") != frozen.ANALYZER_RUNNER_SHA256 or row.get("analyzerSourceCommit") != frozen.ANALYZER_SOURCE_COMMIT:
            fail(f"Analyzer identity mismatch in V2 prep row {ordinal}")
        if track_id not in refs_by_id:
            fail(f"V2 prep track missing from reference Stage 1 set: {track_id}")

        prep_case = args.prep_root / "cases" / f"{ordinal:02d}-{row['stem']}"
        provider_case = cases[ordinal]
        status_path = provider_case / "stage1-v2-case-status-v1.json"
        status = frozen.load(status_path)
        proposal_path = provider_case / "normalized-proposal.json"
        if status.get("schema") != V2_CASE_SCHEMA or status.get("stage") != "stage1-v2" or status.get("developmentRevision") != V2_REVISION:
            fail(f"V2 provider case schema/stage/revision mismatch ordinal {ordinal}")
        payload_sha = row.get("hashes", {}).get("openaiPayloadV2Sha256")
        required_status = {
            "id": track_id,
            "ordinal": ordinal,
            "providerCompletedSemanticResponse": True,
            "providerResponseObserved": True,
            "retryAuthorized": False,
            "semanticRetryCount": 0,
            "harnessSourceCommit": args.generation_head_sha,
            "githubRunId": str(args.generation_run_id),
            "githubRunAttempt": 1,
            "prepArtifactId": str(args.prep_artifact_id),
            "analyzerRunnerSha256": frozen.ANALYZER_RUNNER_SHA256,
            "analyzerSourceCommit": frozen.ANALYZER_SOURCE_COMMIT,
            "analysisJsonSha256": row["analysisJsonSha256"],
            "frozenPayloadSha256": payload_sha,
            "livePayloadSha256": payload_sha,
            "preflightPayloadSha256": payload_sha,
        }
        for key, want in required_status.items():
            if status.get(key) != want:
                fail(f"V2 provider status mismatch ordinal {ordinal}: {key}={status.get(key)!r}, expected {want!r}")
        contract = status.get("providerContract") or {}
        if contract != {"provider": "openai", "api": "responses", "model": "gpt-6-sol", "reasoningEffort": "high", "maxOutputTokens": 4096, "store": False}:
            fail(f"V2 provider contract mismatch ordinal {ordinal}")
        if status.get("responseModel") != "gpt-6-sol" or status.get("classification") != "provider_completed_validated_v2_proposal_no_retry":
            fail(f"V2 provider completion classification mismatch ordinal {ordinal}")
        if not proposal_path.exists() or frozen.sha256(proposal_path) != status.get("normalizedProposalSha256"):
            fail(f"V2 normalized proposal identity mismatch ordinal {ordinal}")

        evidence_path = prep_case / "structure-evidence-v1.json"
        safe_path = prep_case / "trackcade-safe-v1.json"
        if frozen.sha256(evidence_path) != row["hashes"]["structureEvidenceSha256"] or frozen.sha256(safe_path) != row["hashes"]["safeManifestSha256"]:
            fail(f"V2 prep compiler input identity mismatch ordinal {ordinal}")
        evidence = frozen.load(evidence_path)
        proposal = frozen.load(proposal_path)
        if proposal.get("schema") != frozen.PROPOSAL_SCHEMA:
            fail(f"V2 normalized proposal schema mismatch ordinal {ordinal}")
        source = proposal.get("source") or {}
        if source.get("analyzerRunnerSha256") != frozen.ANALYZER_RUNNER_SHA256 or source.get("analysisJsonSha256") != row["analysisJsonSha256"]:
            fail(f"V2 proposal source identity mismatch ordinal {ordinal}")

        proposal_drops = []
        for event in proposal.get("events") or []:
            if not isinstance(event, dict):
                fail(f"non-object validated V2 proposal event ordinal {ordinal}")
            if any(k in event for k in ("t", "time", "timestamp", "seconds")):
                fail(f"independent V2 semantic timestamp field observed ordinal {ordinal}")
            if event.get("kind") == "drop":
                proposal_drops.append(frozen.resolve_anchor(evidence, event.get("anchor")))

        case_out = compiled_root / f"{ordinal:02d}-{row['stem']}"
        case_out.mkdir(parents=True, exist_ok=True)
        compiled_manifest = case_out / "compiled-manifest.json"
        compile_report = case_out / "compile-report.json"
        subprocess.run(
            [sys.executable, str(args.compiler), "--safe-manifest", str(safe_path), "--evidence", str(evidence_path), "--proposal", str(proposal_path), "--output", str(compiled_manifest), "--report", str(compile_report)],
            check=True,
        )
        report = frozen.load(compile_report)
        if report.get("schema") != "trackcade-semantic-compile-v1" or report.get("fallbackSafeBaselinePreserved") is not True:
            fail(f"compiler report closure failure ordinal {ordinal}")
        report_source = report.get("source") or {}
        if report_source.get("analyzerRunnerSha256") != frozen.ANALYZER_RUNNER_SHA256 or report_source.get("analysisJsonSha256") != row["analysisJsonSha256"] or report_source.get("timingTier") != row["timingTier"]:
            fail(f"compiler source identity mismatch ordinal {ordinal}")
        accepted_drops = [float(x["compiledTime"]) for x in report.get("accepted") or [] if isinstance(x, dict) and x.get("kind") == "drop"]

        usage = status.get("usage") or {}
        for key in ("input_tokens", "output_tokens", "total_tokens"):
            value = usage.get(key, 0)
            if not isinstance(value, int) or isinstance(value, bool) or value < 0:
                fail(f"invalid V2 usage field {key} ordinal {ordinal}")
            usage_totals[key] += value
        reasoning = ((usage.get("output_tokens_details") or {}).get("reasoning_tokens", 0))
        if not isinstance(reasoning, int) or isinstance(reasoning, bool) or reasoning < 0:
            fail(f"invalid V2 reasoning token count ordinal {ordinal}")
        usage_totals["reasoning_tokens"] += reasoning

        candidates.append({
            "ordinal": ordinal,
            "id": track_id,
            "timingTier": row["timingTier"],
            "proposalDropsSeconds": sorted(proposal_drops),
            "acceptedDropsSeconds": sorted(accepted_drops),
        })
        provenance_cases.append({
            "ordinal": ordinal,
            "id": track_id,
            "providerStatusSha256": frozen.sha256(status_path),
            "normalizedProposalSha256": frozen.sha256(proposal_path),
            "structureEvidenceSha256": frozen.sha256(evidence_path),
            "safeManifestSha256": frozen.sha256(safe_path),
            "compileReportSha256": frozen.sha256(compile_report),
            "compiledManifestSha256": frozen.sha256(compiled_manifest),
            "openaiResponseId": status.get("openaiResponseId"),
            "usage": usage,
        })

    if set(prep_ids) != set(refs_by_id) or len(set(prep_ids)) != 50:
        fail("V2 prep/reference Stage 1 identity sets differ")

    candidate_doc = {
        "schema": V2_CANDIDATE_SCHEMA,
        "stage": "stage1",
        "developmentRevision": V2_REVISION,
        "status": "frozen-offline-derived-from-completed-v2-provider-evidence",
        "timingAuthority": "deterministic-structure-evidence-anchor-only",
        "trackCount": 50,
        "tracks": candidates,
    }
    candidate_path = out / "STAGE1_V2_DROP_CANDIDATES_V1.json"
    candidate_path.write_text(json.dumps(candidate_doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    evaluation = {
        "schema": V2_EVALUATION_SCHEMA,
        "stage": "stage1",
        "developmentRevision": V2_REVISION,
        "status": "evaluated-under-unchanged-predeclared-drop-contract",
        "primaryToleranceSeconds": frozen.PRIMARY_TOLERANCE,
        "sensitivityToleranceSeconds": [1.0, 5.0],
        "scoringImplementation": "imported-unchanged-from-evaluate_stage1_drop_v1.py",
        "trackCount": 50,
        "views": {},
    }
    for view_key in ("proposalDropsSeconds", "acceptedDropsSeconds"):
        by_tol = {}
        for tol in frozen.TOLERANCES:
            rows = []
            per_track = []
            for c in candidates:
                scored = frozen.score_track(refs_by_id[c["id"]], c[view_key], tol)
                rows.append(scored)
                per_track.append({"ordinal": c["ordinal"], "id": c["id"], **scored})
            by_tol[str(tol)] = {"toleranceSeconds": tol, "aggregate": frozen.aggregate(rows), "tracks": per_track}
        evaluation["views"][view_key] = by_tol
    eval_path = out / "STAGE1_V2_DROP_EVALUATION_V1.json"
    eval_path.write_text(json.dumps(evaluation, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    frozen_scoring_path = Path(frozen.__file__).resolve()
    provenance = {
        "schema": "trackcade-semantic-external-stage1-v2-evaluation-provenance-v1",
        "developmentRevision": V2_REVISION,
        "generationRunId": str(args.generation_run_id),
        "generationHeadSha": args.generation_head_sha,
        "generationFreezeSha256": frozen.sha256(args.generation_freeze),
        "prepRunId": str(args.prep_run_id),
        "prepArtifactId": str(args.prep_artifact_id),
        "prepManifestSha256": frozen.sha256(prep_manifest_path),
        "basePrepManifestSha256": prep.get("basePrepManifestSha256"),
        "referenceDropsSha256": frozen.sha256(args.references),
        "compilerSha256": frozen.sha256(args.compiler),
        "frozenScoringImplementationSha256": frozen.sha256(frozen_scoring_path),
        "analyzerRunnerSha256": frozen.ANALYZER_RUNNER_SHA256,
        "analyzerSourceCommit": frozen.ANALYZER_SOURCE_COMMIT,
        "providerCallsMadeByEvaluator": 0,
        "terminalTracksProcessed": False,
        "stage1TrackCount": 50,
        "usageTotals": usage_totals,
        "cases": provenance_cases,
        "candidateSha256": frozen.sha256(candidate_path),
        "evaluationSha256": frozen.sha256(eval_path),
    }
    prov_path = out / "STAGE1_V2_EVALUATION_PROVENANCE_V1.json"
    prov_path.write_text(json.dumps(provenance, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    headline = {
        "schema": "trackcade-semantic-external-stage1-v2-drop-headline-v1",
        "developmentRevision": V2_REVISION,
        "toleranceSeconds": frozen.PRIMARY_TOLERANCE,
        "proposal": evaluation["views"]["proposalDropsSeconds"][str(frozen.PRIMARY_TOLERANCE)]["aggregate"],
        "accepted": evaluation["views"]["acceptedDropsSeconds"][str(frozen.PRIMARY_TOLERANCE)]["aggregate"],
        "usageTotals": usage_totals,
    }
    (out / "STAGE1_V2_DROP_HEADLINE_V1.json").write_text(json.dumps(headline, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(headline, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

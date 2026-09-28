#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

CANDIDATE_SCHEMA = "trackcade-semantic-external-drop-candidates-v1"
EVALUATION_SCHEMA = "trackcade-semantic-external-drop-evaluation-v1"
REFERENCE_SCHEMA = "trackcade-semantic-external-drop-references-v3"
PREP_SCHEMA = "trackcade-semantic-external-stage1-prep-v1"
CASE_SCHEMA = "trackcade-semantic-external-stage1-provider-case-v1"
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v1"
ANALYZER_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"
ANALYZER_SOURCE_COMMIT = "e308d867980fb1877c3f2e4ce27950deecac0855"
TOLERANCES = (1.0, 2.0, 5.0)
PRIMARY_TOLERANCE = 2.0


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL-CLOSED: {msg}")


def load(path: Path):
    return json.loads(path.read_text())


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def finite_number(x) -> bool:
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(float(x))


def metric_values(ref_count: int, cand_count: int, tp: int):
    fp = cand_count - tp
    fn = ref_count - tp
    if ref_count == 0 and cand_count == 0:
        p = r = f1 = 1.0
    elif ref_count == 0:
        p, r, f1 = 0.0, 1.0, 0.0
    elif cand_count == 0:
        p, r, f1 = 1.0, 0.0, 0.0
    else:
        p = tp / cand_count
        r = tp / ref_count
        f1 = 0.0 if p + r == 0 else 2.0 * p * r / (p + r)
    return p, r, f1, fp, fn


@dataclass(frozen=True)
class MatchState:
    count: int
    error: float
    pairs: tuple[tuple[int, int], ...]


def better(a: MatchState, b: MatchState) -> MatchState:
    # Frozen contract: maximize cardinality, minimize total absolute error,
    # then deterministic lexical tie-break on ordered (referenceIndex,candidateIndex).
    ka = (-a.count, round(a.error, 12), a.pairs)
    kb = (-b.count, round(b.error, 12), b.pairs)
    return a if ka <= kb else b


def match_one_to_one(refs: list[float], cands: list[float], tolerance: float):
    n, m = len(refs), len(cands)
    dp = [[MatchState(0, 0.0, tuple()) for _ in range(m + 1)] for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            best = better(dp[i + 1][j], dp[i][j + 1])
            err = abs(refs[i] - cands[j])
            if err <= tolerance + 1e-12:
                tail = dp[i + 1][j + 1]
                matched = MatchState(tail.count + 1, tail.error + err, ((i, j),) + tail.pairs)
                best = better(best, matched)
            dp[i][j] = best
    state = dp[0][0]
    errors = [abs(refs[i] - cands[j]) for i, j in state.pairs]
    return state.pairs, errors


def timing_summary(errors: list[float]):
    if not errors:
        return {"meanAbsoluteErrorSeconds": None, "medianAbsoluteErrorSeconds": None, "maxAbsoluteErrorSeconds": None}
    return {
        "meanAbsoluteErrorSeconds": sum(errors) / len(errors),
        "medianAbsoluteErrorSeconds": statistics.median(errors),
        "maxAbsoluteErrorSeconds": max(errors),
    }


def resolve_anchor(evidence: dict, anchor: dict) -> float:
    if not isinstance(anchor, dict):
        fail("proposal drop anchor missing/not-object")
    typ = anchor.get("type")
    idx = anchor.get("index")
    if typ not in {"boundary", "landmark"} or not isinstance(idx, int) or isinstance(idx, bool):
        fail(f"invalid proposal anchor: {anchor!r}")
    rows = evidence.get("boundaries" if typ == "boundary" else "landmarks")
    if not isinstance(rows, list) or idx < 0 or idx >= len(rows):
        fail(f"proposal anchor out of range: {anchor!r}")
    t = rows[idx].get("time") if isinstance(rows[idx], dict) else None
    if not finite_number(t):
        fail(f"proposal anchor has invalid deterministic time: {anchor!r}")
    return float(t)


def score_track(refs: list[float], cands: list[float], tolerance: float):
    refs = sorted(float(x) for x in refs)
    cands = sorted(float(x) for x in cands)
    pairs, errors = match_one_to_one(refs, cands, tolerance)
    tp = len(pairs)
    p, r, f1, fp, fn = metric_values(len(refs), len(cands), tp)
    return {
        "referenceCount": len(refs),
        "candidateCount": len(cands),
        "truePositives": tp,
        "falsePositives": fp,
        "falseNegatives": fn,
        "precision": p,
        "recall": r,
        "f1": f1,
        "matchedPairs": [
            {
                "referenceIndex": i,
                "candidateIndex": j,
                "referenceSeconds": refs[i],
                "candidateSeconds": cands[j],
                "absoluteErrorSeconds": abs(refs[i] - cands[j]),
            }
            for i, j in pairs
        ],
        "matchedTimingErrorsSeconds": errors,
        **timing_summary(errors),
    }


def aggregate(rows: list[dict]):
    tp = sum(x["truePositives"] for x in rows)
    fp = sum(x["falsePositives"] for x in rows)
    fn = sum(x["falseNegatives"] for x in rows)
    ref_count = tp + fn
    cand_count = tp + fp
    p, r, f1, _, _ = metric_values(ref_count, cand_count, tp)
    errors = [e for x in rows for e in x["matchedTimingErrorsSeconds"]]
    return {
        "referenceSupport": ref_count,
        "candidateSupport": cand_count,
        "matchedSupport": tp,
        "micro": {"precision": p, "recall": r, "f1": f1, "truePositives": tp, "falsePositives": fp, "falseNegatives": fn},
        "macro": {
            "precision": sum(x["precision"] for x in rows) / len(rows),
            "recall": sum(x["recall"] for x in rows) / len(rows),
            "f1": sum(x["f1"] for x in rows) / len(rows),
        },
        **timing_summary(errors),
    }


def find_case_dirs(provider_root: Path):
    statuses = list(provider_root.rglob("stage1-case-status-v1.json"))
    if len(statuses) != 50:
        fail(f"expected 50 provider case statuses, found {len(statuses)}")
    out = {}
    for status_path in statuses:
        status = load(status_path)
        ordinal = status.get("ordinal")
        if not isinstance(ordinal, int) or not 1 <= ordinal <= 50 or ordinal in out:
            fail(f"invalid/duplicate provider ordinal: {ordinal!r}")
        out[ordinal] = status_path.parent
    if set(out) != set(range(1, 51)):
        fail("provider ordinals are not exactly 1..50")
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prep-root", type=Path, required=True)
    ap.add_argument("--provider-root", type=Path, required=True)
    ap.add_argument("--references", type=Path, required=True)
    ap.add_argument("--compiler", type=Path, required=True)
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

    prep_manifest_path = args.prep_root / "STAGE1_PREP_MANIFEST_V1.json"
    prep = load(prep_manifest_path)
    if prep.get("schema") != PREP_SCHEMA or prep.get("status") != "frozen-provider-payloads-prepared-no-provider-call":
        fail("prep manifest schema/status mismatch")
    tracks = prep.get("tracks")
    if not isinstance(tracks, list) or len(tracks) != 50 or prep.get("trackCount") != 50:
        fail("prep manifest does not contain exact 50-track Stage 1 set")
    if prep.get("referenceLabelsReadByPreparation") is not False or prep.get("terminalTracksProcessed") is not False:
        fail("prep manifest violates label-blind/terminal boundary")

    refs_doc = load(args.references)
    if refs_doc.get("schema") != REFERENCE_SCHEMA or refs_doc.get("eventKind") != "drop":
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
            fail(f"prep track {ordinal} is not frozen compiler-eligible")
        if row.get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256 or row.get("analyzerSourceCommit") != ANALYZER_SOURCE_COMMIT:
            fail(f"Analyzer identity mismatch in prep row {ordinal}")
        if track_id not in refs_by_id:
            fail(f"prep track missing from reference Stage 1 set: {track_id}")

        prep_case = args.prep_root / "cases" / f"{ordinal:02d}-{row['stem']}"
        provider_case = cases[ordinal]
        status = load(provider_case / "stage1-case-status-v1.json")
        proposal_path = provider_case / "normalized-proposal.json"
        if status.get("schema") != CASE_SCHEMA or status.get("stage") != "stage1":
            fail(f"provider case schema/stage mismatch for ordinal {ordinal}")
        required_status = {
            "id": track_id,
            "ordinal": ordinal,
            "providerCompletedSemanticResponse": True,
            "providerResponseObserved": True,
            "retryAuthorized": False,
            "semanticRetryCount": 0,
            "harnessSourceCommit": args.generation_head_sha,
            "githubRunId": str(args.generation_run_id),
            "analyzerRunnerSha256": ANALYZER_RUNNER_SHA256,
            "analyzerSourceCommit": ANALYZER_SOURCE_COMMIT,
            "analysisJsonSha256": row["analysisJsonSha256"],
            "frozenPayloadSha256": row["hashes"]["openaiPayloadSha256"],
            "livePayloadSha256": row["hashes"]["openaiPayloadSha256"],
            "preflightPayloadSha256": row["hashes"]["openaiPayloadSha256"],
        }
        for key, want in required_status.items():
            if status.get(key) != want:
                fail(f"provider status mismatch ordinal {ordinal}: {key}={status.get(key)!r}, expected {want!r}")
        contract = status.get("providerContract") or {}
        if contract != {"provider": "openai", "api": "responses", "model": "gpt-6-sol", "reasoningEffort": "high", "maxOutputTokens": 4096, "store": False}:
            fail(f"provider contract mismatch ordinal {ordinal}")
        if status.get("responseModel") != "gpt-6-sol" or status.get("classification") != "provider_completed_validated_proposal_no_retry":
            fail(f"provider completion classification mismatch ordinal {ordinal}")
        if not proposal_path.exists() or sha256(proposal_path) != status.get("normalizedProposalSha256"):
            fail(f"normalized proposal identity mismatch ordinal {ordinal}")

        evidence_path = prep_case / "structure-evidence-v1.json"
        safe_path = prep_case / "trackcade-safe-v1.json"
        if sha256(evidence_path) != row["hashes"]["structureEvidenceSha256"] or sha256(safe_path) != row["hashes"]["safeManifestSha256"]:
            fail(f"prep compiler input identity mismatch ordinal {ordinal}")
        evidence = load(evidence_path)
        proposal = load(proposal_path)
        if proposal.get("schema") != PROPOSAL_SCHEMA:
            fail(f"normalized proposal schema mismatch ordinal {ordinal}")
        source = proposal.get("source") or {}
        if source.get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256 or source.get("analysisJsonSha256") != row["analysisJsonSha256"]:
            fail(f"proposal source identity mismatch ordinal {ordinal}")

        proposal_drops = []
        for event in proposal.get("events") or []:
            if not isinstance(event, dict):
                fail(f"non-object validated proposal event ordinal {ordinal}")
            # The learned layer has no timestamp authority: candidate timing must be anchor-derived.
            if any(k in event for k in ("t", "time", "timestamp", "seconds")):
                fail(f"independent semantic timestamp field observed ordinal {ordinal}")
            if event.get("kind") == "drop":
                proposal_drops.append(resolve_anchor(evidence, event.get("anchor")))

        case_out = compiled_root / f"{ordinal:02d}-{row['stem']}"
        case_out.mkdir(parents=True, exist_ok=True)
        compiled_manifest = case_out / "compiled-manifest.json"
        compile_report = case_out / "compile-report.json"
        subprocess.run(
            [sys.executable, str(args.compiler), "--safe-manifest", str(safe_path), "--evidence", str(evidence_path), "--proposal", str(proposal_path), "--output", str(compiled_manifest), "--report", str(compile_report)],
            check=True,
        )
        report = load(compile_report)
        if report.get("schema") != "trackcade-semantic-compile-v1" or report.get("fallbackSafeBaselinePreserved") is not True:
            fail(f"compiler report closure failure ordinal {ordinal}")
        report_source = report.get("source") or {}
        if report_source.get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256 or report_source.get("analysisJsonSha256") != row["analysisJsonSha256"] or report_source.get("timingTier") != row["timingTier"]:
            fail(f"compiler source identity mismatch ordinal {ordinal}")
        accepted_drops = [float(x["compiledTime"]) for x in report.get("accepted") or [] if isinstance(x, dict) and x.get("kind") == "drop"]

        usage = status.get("usage") or {}
        for key in ("input_tokens", "output_tokens", "total_tokens"):
            value = usage.get(key, 0)
            if not isinstance(value, int) or value < 0:
                fail(f"invalid usage field {key} ordinal {ordinal}")
            usage_totals[key] += value
        reasoning = ((usage.get("output_tokens_details") or {}).get("reasoning_tokens", 0))
        if not isinstance(reasoning, int) or reasoning < 0:
            fail(f"invalid reasoning token count ordinal {ordinal}")
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
            "providerStatusSha256": sha256(provider_case / "stage1-case-status-v1.json"),
            "normalizedProposalSha256": sha256(proposal_path),
            "structureEvidenceSha256": sha256(evidence_path),
            "safeManifestSha256": sha256(safe_path),
            "compileReportSha256": sha256(compile_report),
            "compiledManifestSha256": sha256(compiled_manifest),
            "openaiResponseId": status.get("openaiResponseId"),
            "usage": usage,
        })

    if set(prep_ids) != set(refs_by_id) or len(set(prep_ids)) != 50:
        fail("prep/reference Stage 1 identity sets differ")

    candidate_doc = {
        "schema": CANDIDATE_SCHEMA,
        "stage": "stage1",
        "status": "frozen-offline-derived-from-completed-provider-evidence",
        "timingAuthority": "deterministic-structure-evidence-anchor-only",
        "trackCount": 50,
        "tracks": candidates,
    }
    candidate_path = out / "STAGE1_DROP_CANDIDATES_V1.json"
    candidate_path.write_text(json.dumps(candidate_doc, indent=2, sort_keys=True) + "\n")

    evaluation = {
        "schema": EVALUATION_SCHEMA,
        "stage": "stage1",
        "status": "evaluated-under-predeclared-drop-contract",
        "primaryToleranceSeconds": PRIMARY_TOLERANCE,
        "sensitivityToleranceSeconds": [1.0, 5.0],
        "trackCount": 50,
        "views": {},
    }
    for view_key in ("proposalDropsSeconds", "acceptedDropsSeconds"):
        by_tol = {}
        for tol in TOLERANCES:
            rows = []
            per_track = []
            for c in candidates:
                scored = score_track(refs_by_id[c["id"]], c[view_key], tol)
                rows.append(scored)
                per_track.append({"ordinal": c["ordinal"], "id": c["id"], **scored})
            by_tol[str(tol)] = {"toleranceSeconds": tol, "aggregate": aggregate(rows), "tracks": per_track}
        evaluation["views"][view_key] = by_tol
    eval_path = out / "STAGE1_DROP_EVALUATION_V1.json"
    eval_path.write_text(json.dumps(evaluation, indent=2, sort_keys=True) + "\n")

    provenance = {
        "schema": "trackcade-semantic-external-stage1-evaluation-provenance-v1",
        "generationRunId": str(args.generation_run_id),
        "generationHeadSha": args.generation_head_sha,
        "prepRunId": str(args.prep_run_id),
        "prepArtifactId": str(args.prep_artifact_id),
        "prepManifestSha256": sha256(prep_manifest_path),
        "referenceDropsSha256": sha256(args.references),
        "compilerSha256": sha256(args.compiler),
        "analyzerRunnerSha256": ANALYZER_RUNNER_SHA256,
        "analyzerSourceCommit": ANALYZER_SOURCE_COMMIT,
        "providerCallsMadeByEvaluator": 0,
        "terminalTracksProcessed": False,
        "stage1TrackCount": 50,
        "usageTotals": usage_totals,
        "cases": provenance_cases,
        "candidateSha256": sha256(candidate_path),
        "evaluationSha256": sha256(eval_path),
    }
    prov_path = out / "STAGE1_EVALUATION_PROVENANCE_V1.json"
    prov_path.write_text(json.dumps(provenance, indent=2, sort_keys=True) + "\n")

    headline = {
        "schema": "trackcade-semantic-external-stage1-drop-headline-v1",
        "toleranceSeconds": PRIMARY_TOLERANCE,
        "proposal": evaluation["views"]["proposalDropsSeconds"][str(PRIMARY_TOLERANCE)]["aggregate"],
        "accepted": evaluation["views"]["acceptedDropsSeconds"][str(PRIMARY_TOLERANCE)]["aggregate"],
        "usageTotals": usage_totals,
    }
    (out / "STAGE1_DROP_HEADLINE_V1.json").write_text(json.dumps(headline, indent=2, sort_keys=True) + "\n")
    print(json.dumps(headline, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

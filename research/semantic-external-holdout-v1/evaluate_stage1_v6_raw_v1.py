#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import math
import statistics
from dataclasses import dataclass
from pathlib import Path

FREEZE_SCHEMA = "trackcade-semantic-external-stage1-v6-generation-freeze-v1"
FREEZE_STATUS = "frozen-complete-v6-generation-before-reference-access"
PREP_SCHEMA = "trackcade-semantic-external-stage1-v6-prep-v1"
PREP_STATUS = "frozen-v6-provider-payloads-prepared-no-provider-call"
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v5"
REFERENCE_SCHEMA = "trackcade-semantic-external-drop-references-v3"
ACTIVATION_SCHEMA = "trackcade-semantic-external-stage1-v6-raw-scoring-activation-v1"
OUTPUT_SCHEMA = "trackcade-semantic-external-stage1-v6-raw-evaluation-v1"
DEVELOPMENT_REVISION = "stage1-drop-semantics-v6-decisive-impact-ordinary-return-counterfactual"
REFERENCE_SHA256 = "1b74d185d47ea52db62d4c23cdbd44375b6ba0a05cf3824c4278e88646db9d1c"
HISTORICAL_SCORER_COMMIT = "81985328360e7cd0f70c03ea2b3c63fa94f1d14f"
HISTORICAL_SCORER_PATH = "research/semantic-external-holdout-v1/evaluate_stage1_drop_v1.py"
HISTORICAL_SCORER_BLOB = "3d74996281ec260e170ea10929bd0115a6d4ac70"
HISTORICAL_SCORER_SHA256 = "90aefb42a868553c75de4c3cca26bb646fc4706e8fbd09892e4a412323b62bb8"
TOLERANCES = (1.0, 2.0, 5.0)
PRIMARY_TOLERANCE = 2.0


def fail(message: str) -> None:
    raise SystemExit(f"V6 RAW SCORE FAIL-CLOSED: {message}")


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def finite_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(float(value))


@dataclass(frozen=True)
class MatchState:
    count: int
    error: float
    pairs: tuple[tuple[int, int], ...]


def better(a: MatchState, b: MatchState) -> MatchState:
    # Frozen historical RAW contract from Git blob 3d749962...:
    # maximize cardinality, minimize total absolute error, then lexical pair tie-break.
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


def timing_summary(errors: list[float]):
    if not errors:
        return {
            "meanAbsoluteErrorSeconds": None,
            "medianAbsoluteErrorSeconds": None,
            "maxAbsoluteErrorSeconds": None,
        }
    return {
        "meanAbsoluteErrorSeconds": sum(errors) / len(errors),
        "medianAbsoluteErrorSeconds": statistics.median(errors),
        "maxAbsoluteErrorSeconds": max(errors),
    }


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
        "micro": {
            "precision": p, "recall": r, "f1": f1,
            "truePositives": tp, "falsePositives": fp, "falseNegatives": fn,
        },
        "macro": {
            "precision": sum(x["precision"] for x in rows) / len(rows),
            "recall": sum(x["recall"] for x in rows) / len(rows),
            "f1": sum(x["f1"] for x in rows) / len(rows),
        },
        **timing_summary(errors),
    }


def verify_complete_freeze(freeze_root: Path, prep_root: Path, expected_freeze_sha256: str):
    freeze_path = freeze_root / "STAGE1_V6_GENERATION_FREEZE_V1.json"
    if not freeze_path.is_file():
        fail("complete V6 generation freeze file missing")
    if sha256(freeze_path) != expected_freeze_sha256:
        fail("generation freeze SHA-256 mismatch")
    freeze = load(freeze_path)
    required = {
        "schema": FREEZE_SCHEMA,
        "status": FREEZE_STATUS,
        "developmentRevision": DEVELOPMENT_REVISION,
        "trackCount": 50,
        "referenceLabelsReadByFreeze": False,
        "partialScoringPerformed": False,
        "terminalTracksProcessed": False,
        "compilerInvoked": False,
        "analyzerExecuted": False,
        "providerCallsByFreeze": 0,
        "ordinal1Source": "frozen-canary",
        "remainingSource": "authorized-remaining49-artifacts",
    }
    for key, expected in required.items():
        if freeze.get(key) != expected:
            fail(f"freeze closure mismatch: {key}")

    cases = freeze.get("cases")
    if not isinstance(cases, list) or len(cases) != 50 or any(not isinstance(x, dict) for x in cases):
        fail("freeze must contain exactly 50 case objects")
    cases = sorted(cases, key=lambda x: x.get("ordinal", 0))
    if [x.get("ordinal") for x in cases] != list(range(1, 51)):
        fail("freeze ordinals must be exactly 1..50")
    if cases[0].get("variant") != "canary" or any(x.get("variant") != "remaining49" for x in cases[1:]):
        fail("freeze must reuse one canary plus 49 remaining cases")
    if len({x.get("id") for x in cases}) != 50:
        fail("freeze track IDs are not unique")
    if len({x.get("openaiResponseId") for x in cases}) != 50:
        fail("freeze provider response IDs are not unique")

    prep_path = prep_root / "STAGE1_V6_PREP_MANIFEST_V1.json"
    if not prep_path.is_file():
        fail("V6 prep manifest missing")
    prep = load(prep_path)
    if prep.get("schema") != PREP_SCHEMA or prep.get("status") != PREP_STATUS or prep.get("trackCount") != 50:
        fail("V6 prep manifest identity mismatch")
    if prep.get("referenceLabelsReadByPreparation") is not False or prep.get("terminalTracksProcessed") is not False:
        fail("V6 prep label/terminal boundary mismatch")
    if prep.get("analyzerExecuted") is not False or prep.get("providerCallsObserved") != 0 or prep.get("compilerInvoked") is not False:
        fail("V6 prep execution boundary mismatch")
    rows = sorted(prep.get("tracks") or [], key=lambda x: x.get("ordinal", 0))
    if len(rows) != 50 or [x.get("ordinal") for x in rows] != list(range(1, 51)):
        fail("V6 prep ordinals must be exactly 1..50")
    prep_by_ordinal = {x["ordinal"]: x for x in rows}

    for case in cases:
        ordinal = case["ordinal"]
        row = prep_by_ordinal[ordinal]
        if case.get("id") != row.get("id") or case.get("stem") != row.get("stem"):
            fail(f"freeze/prep identity mismatch ordinal {ordinal}")
        expected_packet_sha = (row.get("hashes") or {}).get("structureEvidenceV2Sha256")
        if case.get("packetSha256") != expected_packet_sha:
            fail(f"freeze/prep packet hash mismatch ordinal {ordinal}")
        proposal_path = freeze_root / "proposals" / f"{ordinal:02d}-{case['stem']}.json"
        if not proposal_path.is_file() or sha256(proposal_path) != case.get("normalizedProposalSha256"):
            fail(f"frozen proposal identity mismatch ordinal {ordinal}")
        packet_path = prep_root / "cases" / f"{ordinal:02d}-{case['stem']}" / "structure-evidence-v2.json"
        if not packet_path.is_file() or sha256(packet_path) != case.get("packetSha256"):
            fail(f"frozen packet identity mismatch ordinal {ordinal}")
    return freeze_path, cases


def verify_activation(path: Path, expected_freeze_sha256: str):
    if not path.is_file():
        fail("separate scoring activation receipt missing")
    activation = load(path)
    required = {
        "schema": ACTIVATION_SCHEMA,
        "status": "authorized-after-complete-50-response-freeze",
        "developmentSetScoringAuthorized": True,
        "stage1ReferenceOpeningAuthorized": True,
        "terminalHoldoutAuthorized": False,
        "compilerAuthorized": False,
        "analyzerExecutionAuthorized": False,
        "providerCallsAuthorized": False,
        "tolerancesSeconds": [1.0, 2.0, 5.0],
        "primaryToleranceSeconds": 2.0,
        "generationFreezeSha256": expected_freeze_sha256,
    }
    for key, expected in required.items():
        if activation.get(key) != expected:
            fail(f"activation receipt mismatch: {key}")
    return activation


def candidate_times(cases: list[dict], freeze_root: Path, prep_root: Path):
    out = {}
    for case in cases:
        ordinal = case["ordinal"]
        proposal = load(freeze_root / "proposals" / f"{ordinal:02d}-{case['stem']}.json")
        packet = load(prep_root / "cases" / f"{ordinal:02d}-{case['stem']}" / "structure-evidence-v2.json")
        if proposal.get("schema") != PROPOSAL_SCHEMA:
            fail(f"proposal schema mismatch ordinal {ordinal}")
        anchors = packet.get("anchors")
        if not isinstance(anchors, list) or not anchors:
            fail(f"packet anchors missing ordinal {ordinal}")
        drops = []
        for event in proposal.get("events") or []:
            if not isinstance(event, dict):
                fail(f"non-object proposal event ordinal {ordinal}")
            if event.get("kind") != "drop":
                continue
            anchor = event.get("anchor")
            if not isinstance(anchor, dict) or anchor.get("type") != "evidence":
                fail(f"invalid Drop anchor ordinal {ordinal}")
            idx = anchor.get("index")
            if not isinstance(idx, int) or isinstance(idx, bool) or idx < 0 or idx >= len(anchors):
                fail(f"Drop anchor out of range ordinal {ordinal}")
            row = anchors[idx]
            if not isinstance(row, list) or not row or not finite_number(row[0]):
                fail(f"invalid Analyzer-owned anchor time ordinal {ordinal}")
            drops.append(float(row[0]))
        if len(drops) != case.get("dropCount"):
            fail(f"frozen Drop count mismatch ordinal {ordinal}")
        out[case["id"]] = sorted(drops)
    return out


def open_references_after_closure(path: Path, expected_ids: set[str]):
    # Call only after verify_complete_freeze() AND verify_activation().
    if not path.is_file() or sha256(path) != REFERENCE_SHA256:
        fail("Stage1 reference identity mismatch")
    refs = load(path)
    if refs.get("schema") != REFERENCE_SCHEMA or refs.get("eventKind") != "drop":
        fail("reference schema/event kind mismatch")
    rows = refs.get("stage1")
    if not isinstance(rows, list) or len(rows) != 50:
        fail("Stage1 references must contain exactly 50 development tracks")
    by_id = {}
    for row in rows:
        if not isinstance(row, dict) or not isinstance(row.get("id"), str):
            fail("invalid Stage1 reference row")
        values = row.get("dropsSeconds")
        if not isinstance(values, list) or any(not finite_number(x) or float(x) < 0 for x in values):
            fail(f"invalid reference Drop list for {row.get('id')}")
        if row["id"] in by_id:
            fail("duplicate Stage1 reference ID")
        by_id[row["id"]] = [float(x) for x in values]
    if set(by_id) != expected_ids:
        fail("reference/frozen development ID set mismatch")
    return by_id


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--freeze-root", type=Path, required=True)
    ap.add_argument("--prep-root", type=Path, required=True)
    ap.add_argument("--references", type=Path, required=True)
    ap.add_argument("--activation-receipt", type=Path, required=True)
    ap.add_argument("--expected-freeze-sha256", required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()

    # Gate order is scientific protocol: references are untouched until both checks pass.
    freeze_path, cases = verify_complete_freeze(args.freeze_root, args.prep_root, args.expected_freeze_sha256)
    verify_activation(args.activation_receipt, args.expected_freeze_sha256)
    cands_by_id = candidate_times(cases, args.freeze_root, args.prep_root)
    refs_by_id = open_references_after_closure(args.references, set(cands_by_id))

    sensitivity = {}
    per_track = {}
    for tolerance in TOLERANCES:
        rows = []
        for case in cases:
            score = score_track(refs_by_id[case["id"]], cands_by_id[case["id"]], tolerance)
            score["ordinal"] = case["ordinal"]
            score["id"] = case["id"]
            rows.append(score)
        key = str(int(tolerance))
        sensitivity[key] = aggregate(rows)
        per_track[key] = rows

    output = {
        "schema": OUTPUT_SCHEMA,
        "status": "scored-complete-50-track-v6-development-after-freeze",
        "developmentRevision": DEVELOPMENT_REVISION,
        "generationFreezeSha256": sha256(freeze_path),
        "activationReceiptSha256": sha256(args.activation_receipt),
        "referenceSha256": sha256(args.references),
        "terminalHoldoutProcessed": False,
        "providerCallsByEvaluation": 0,
        "compilerInvoked": False,
        "analyzerExecuted": False,
        "rawCandidateTimingAuthority": "frozen-analyzer-derived-anchor-only",
        "historicalMatcherProvenance": {
            "commit": HISTORICAL_SCORER_COMMIT,
            "path": HISTORICAL_SCORER_PATH,
            "gitBlobSha": HISTORICAL_SCORER_BLOB,
            "sha256": HISTORICAL_SCORER_SHA256,
            "contract": "maximize-cardinality_then-minimize-total-absolute-error_then-lexical-pair-tiebreak",
        },
        "primaryToleranceSeconds": PRIMARY_TOLERANCE,
        "tolerancesSeconds": list(TOLERANCES),
        "headline": sensitivity[str(int(PRIMARY_TOLERANCE))],
        "sensitivity": sensitivity,
        "perTrack": per_track,
        "scientificQualification": {
            "labelInformedDevelopmentRevision": True,
            "developmentScoreUnbiasedGeneralizationEstimate": False,
            "terminalHoldoutRemainsOnlyUnbiasedSemanticTest": True,
        },
    }

    args.output_dir.mkdir(parents=True, exist_ok=False)
    (args.output_dir / "STAGE1_V6_RAW_EVALUATION_V1.json").write_text(
        json.dumps(output, indent=2, sort_keys=True) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "schema": OUTPUT_SCHEMA,
        "trackCount": 50,
        "headline": output["headline"],
        "terminalHoldoutProcessed": False,
        "providerCallsByEvaluation": 0,
        "compilerInvoked": False,
        "analyzerExecuted": False,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

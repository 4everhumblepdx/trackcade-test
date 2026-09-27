#!/usr/bin/env python3
import argparse
import hashlib
import json
import math
import statistics
from functools import lru_cache
from pathlib import Path

KINDS = ("section", "drop", "energy", "peak")
WINDOWS = (1.0, 2.0, 4.0)
ANALYZER_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"
CLOSURE_COMMIT = "76c247a5df79a8dc169c4cd933e4499a0ced1fa5"
INTEGRATION_RUN_ID = 36323696425
INTEGRATION_ARTIFACT_ID = 10933550802
INTEGRATION_ARTIFACT_DIGEST = "sha256:6a6b05b6da7c5f59d4473cbb497edce7de2ad2a3ecc7a4d795a6d6f63bc784ab"


def finite_number(x):
    return isinstance(x, (int, float)) and not isinstance(x, bool) and math.isfinite(float(x))


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_json(path):
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def metric_counts(candidate_count, reference_count, matched_count):
    precision = matched_count / candidate_count if candidate_count else None
    recall = matched_count / reference_count if reference_count else None
    if precision is None or recall is None:
        f1 = None
    elif precision + recall == 0:
        f1 = 0.0
    else:
        f1 = 2.0 * precision * recall / (precision + recall)
    return {
        "candidateCount": candidate_count,
        "referenceCount": reference_count,
        "matchedCount": matched_count,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def timing_stats(values):
    if not values:
        return {"count": 0, "mae": None, "medianAbsoluteError": None, "maxAbsoluteError": None}
    vals = [float(x) for x in values]
    return {
        "count": len(vals),
        "mae": sum(vals) / len(vals),
        "medianAbsoluteError": statistics.median(vals),
        "maxAbsoluteError": max(vals),
    }


def better(a, b):
    # State tuple: (match_count, total_abs_error, pair_key_tuple)
    if b is None:
        return a
    if a[0] != b[0]:
        return a if a[0] > b[0] else b
    if not math.isclose(a[1], b[1], rel_tol=0.0, abs_tol=1e-12):
        return a if a[1] < b[1] else b
    return a if a[2] < b[2] else b


def deterministic_match(candidates, references, window, exact_kind):
    cands = sorted(candidates, key=lambda e: (e["time"], e["originalIndex"]))
    refs = sorted(references, key=lambda e: (e["time"], e["originalIndex"]))

    def eligible(c, r):
        if exact_kind and c["kind"] != r["kind"]:
            return False
        return abs(c["time"] - r["time"]) <= window + 1e-12

    @lru_cache(maxsize=None)
    def dp(i, j):
        if i >= len(cands) or j >= len(refs):
            return (0, 0.0, ())
        best = better(dp(i + 1, j), dp(i, j + 1))
        if eligible(cands[i], refs[j]):
            tail = dp(i + 1, j + 1)
            pair_key = (refs[j]["originalIndex"], cands[i]["originalIndex"])
            matched = (
                tail[0] + 1,
                tail[1] + abs(cands[i]["time"] - refs[j]["time"]),
                (pair_key,) + tail[2],
            )
            best = better(best, matched)
        return best

    state = dp(0, 0)
    c_by_index = {e["originalIndex"]: e for e in cands}
    r_by_index = {e["originalIndex"]: e for e in refs}
    pairs = []
    for ref_idx, cand_idx in state[2]:
        c = c_by_index[cand_idx]
        r = r_by_index[ref_idx]
        pairs.append({
            "candidateIndex": cand_idx,
            "referenceIndex": ref_idx,
            "candidateKind": c["kind"],
            "referenceKind": r["kind"],
            "candidateTime": c["time"],
            "referenceTime": r["time"],
            "absoluteTimingError": abs(c["time"] - r["time"]),
            "candidateDuration": c.get("duration"),
            "referenceDuration": r.get("duration"),
        })
    return pairs


def score_matching(candidates, references, window, exact_kind):
    pairs = deterministic_match(candidates, references, window, exact_kind)
    base = metric_counts(len(candidates), len(references), len(pairs))
    errors = [p["absoluteTimingError"] for p in pairs]
    out = {**base, "timing": timing_stats(errors), "pairs": pairs}

    if exact_kind:
        per_kind = {}
        for kind in KINDS:
            cand_count = sum(1 for e in candidates if e["kind"] == kind)
            ref_count = sum(1 for e in references if e["kind"] == kind)
            match_count = sum(1 for p in pairs if p["candidateKind"] == kind)
            per_kind[kind] = metric_counts(cand_count, ref_count, match_count)
        out["perKind"] = per_kind
        duration_errors = []
        for p in pairs:
            if p["candidateKind"] != "drop":
                continue
            cd = p.get("candidateDuration")
            rd = p.get("referenceDuration")
            if finite_number(cd) and finite_number(rd):
                duration_errors.append(abs(float(cd) - float(rd)))
        out["dropDurationAbsoluteError"] = timing_stats(duration_errors)
    else:
        confusion = {}
        for p in pairs:
            key = f'{p["candidateKind"]}->{p["referenceKind"]}'
            confusion[key] = confusion.get(key, 0) + 1
        out["kindConfusion"] = dict(sorted(confusion.items()))
    return out


def reference_events(raw):
    out = []
    for idx, e in enumerate(raw.get("events", [])):
        if e.get("kind") not in KINDS:
            continue
        if not finite_number(e.get("t")):
            raise ValueError(f"reference event {idx} has invalid time")
        out.append({
            "originalIndex": idx,
            "kind": e["kind"],
            "time": float(e["t"]),
            "name": e.get("name"),
            "duration": float(e["duration"]) if finite_number(e.get("duration")) else None,
        })
    return out


def build_candidate_views(proposal, report):
    if proposal.get("schema") != "trackcade-musical-interpretation-v1":
        raise ValueError("unexpected proposal schema")
    if proposal.get("source", {}).get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256:
        raise ValueError("proposal analyzer runner identity mismatch")
    if report.get("schema") != "trackcade-semantic-compile-v1":
        raise ValueError("unexpected compiler report schema")
    if report.get("source", {}).get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256:
        raise ValueError("compiler report analyzer runner identity mismatch")
    if proposal.get("source", {}).get("analysisJsonSha256") != report.get("source", {}).get("analysisJsonSha256"):
        raise ValueError("proposal/report analysis source mismatch")

    proposed = proposal.get("events", [])
    accepted = report.get("accepted", [])
    rejected = report.get("rejected", [])
    if report.get("proposalEventCount") != len(proposed):
        raise ValueError("proposal count mismatch")
    if report.get("acceptedEventCount") != len(accepted):
        raise ValueError("accepted count mismatch")
    if report.get("rejectedEventCount") != len(rejected):
        raise ValueError("rejected count mismatch")
    if len(accepted) + len(rejected) != len(proposed):
        raise ValueError("compiler decisions do not cover every proposal")

    decisions = {}
    for status, rows in (("accepted", accepted), ("rejected", rejected)):
        for row in rows:
            idx = row.get("proposalIndex")
            if not isinstance(idx, int) or idx < 0 or idx >= len(proposed):
                raise ValueError("invalid proposalIndex in report")
            if idx in decisions:
                raise ValueError("duplicate compiler decision for proposal")
            anchor = row.get("anchor", {})
            if not finite_number(anchor.get("time")):
                raise ValueError("compiler decision missing finite anchor time")
            decisions[idx] = (status, row)

    if set(decisions) != set(range(len(proposed))):
        raise ValueError("not every proposal resolved exactly once")

    intent = []
    for idx, e in enumerate(proposed):
        if e.get("kind") not in KINDS:
            raise ValueError(f"unsupported proposal kind at {idx}")
        status, row = decisions[idx]
        if row.get("kind") != e.get("kind"):
            raise ValueError("proposal/report kind mismatch")
        intent.append({
            "originalIndex": idx,
            "kind": e["kind"],
            "time": float(row["anchor"]["time"]),
            "name": e.get("name"),
            "duration": float(e["duration"]) if finite_number(e.get("duration")) else None,
            "semanticConfidence": e.get("semanticConfidence"),
            "compilerDecision": status,
        })

    compiled = []
    for row in accepted:
        idx = row["proposalIndex"]
        if not finite_number(row.get("compiledTime")):
            raise ValueError("accepted event missing compiledTime")
        anchor_time = float(row["anchor"]["time"])
        compiled_time = float(row["compiledTime"])
        if not math.isclose(anchor_time, compiled_time, rel_tol=0.0, abs_tol=1e-12):
            raise ValueError("compiler shifted semantic timing away from deterministic anchor")
        compiled.append({
            "originalIndex": idx,
            "kind": row["kind"],
            "time": compiled_time,
            "name": row.get("name"),
            "duration": float(row["duration"]) if finite_number(row.get("duration")) else None,
            "semanticConfidence": row.get("semanticConfidence"),
            "compilerDecision": "accepted",
        })
    return {"proposal_intent": intent, "accepted_compiled": compiled}


def assert_metrics_finite(obj, path="root"):
    if isinstance(obj, dict):
        for k, v in obj.items():
            assert_metrics_finite(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            assert_metrics_finite(v, f"{path}[{i}]")
    elif isinstance(obj, float):
        if not math.isfinite(obj):
            raise ValueError(f"nonfinite metric at {path}")


def evaluate_case(name, reference_path, proposal_path, report_path):
    reference_raw = load_json(reference_path)
    proposal = load_json(proposal_path)
    report = load_json(report_path)
    refs = reference_events(reference_raw)
    views = build_candidate_views(proposal, report)

    windows = {}
    for window in WINDOWS:
        key = f"{window:.1f}"
        windows[key] = {}
        for view_name, candidates in views.items():
            windows[key][view_name] = {
                "exactKind": score_matching(candidates, refs, window, True),
                "landmarkOnly": score_matching(candidates, refs, window, False),
            }

    result = {
        "fixture": name,
        "inputs": {
            "referencePath": str(reference_path),
            "referenceSha256": sha256_file(reference_path),
            "proposalPath": str(proposal_path),
            "proposalSha256": sha256_file(proposal_path),
            "compilerReportPath": str(report_path),
            "compilerReportSha256": sha256_file(report_path),
            "analysisJsonSha256": proposal["source"]["analysisJsonSha256"],
            "analyzerRunnerSha256": proposal["source"]["analyzerRunnerSha256"],
        },
        "referenceEvents": refs,
        "candidateViews": views,
        "windowsSeconds": windows,
    }
    assert_metrics_finite(result)
    return result


def aggregate(fixtures):
    out = {}
    for window in WINDOWS:
        wk = f"{window:.1f}"
        out[wk] = {}
        for view in ("proposal_intent", "accepted_compiled"):
            out[wk][view] = {}
            for mode in ("exactKind", "landmarkOnly"):
                rows = [f["windowsSeconds"][wk][view][mode] for f in fixtures.values()]
                cc = sum(r["candidateCount"] for r in rows)
                rc = sum(r["referenceCount"] for r in rows)
                mc = sum(r["matchedCount"] for r in rows)
                macro_vals = [r["f1"] for r in rows if r["f1"] is not None]
                out[wk][view][mode] = {
                    "micro": metric_counts(cc, rc, mc),
                    "macroF1": (sum(macro_vals) / len(macro_vals)) if macro_vals else None,
                }
    return out


def parse_case(text):
    parts = text.split("::")
    if len(parts) != 4:
        raise argparse.ArgumentTypeError("--case must be NAME::REFERENCE::PROPOSAL::REPORT")
    return parts


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--case", action="append", type=parse_case, required=True,
                    help="NAME::REFERENCE::PROPOSAL::REPORT; supply exactly two frozen product fixtures")
    ap.add_argument("--output", required=True)
    args = ap.parse_args()
    if len(args.case) != 2:
        raise SystemExit("semantic-quality-v1 requires exactly two frozen product fixture cases")

    fixtures = {}
    for name, reference, proposal, report in args.case:
        if name in fixtures:
            raise SystemExit(f"duplicate fixture name: {name}")
        fixtures[name] = evaluate_case(name, Path(reference), Path(proposal), Path(report))

    result = {
        "schema": "trackcade-semantic-quality-benchmark-v1",
        "status": "benchmark_valid",
        "frozen": {
            "musicalInterpretationV1ClosureCommit": CLOSURE_COMMIT,
            "analyzerRunnerSha256": ANALYZER_RUNNER_SHA256,
            "integrationRunId": INTEGRATION_RUN_ID,
            "integrationArtifactId": INTEGRATION_ARTIFACT_ID,
            "integrationArtifactDigest": INTEGRATION_ARTIFACT_DIGEST,
            "timingWindowsSeconds": list(WINDOWS),
            "qualityThreshold": None,
            "claimBoundary": "two visible product fixtures; descriptive regression baseline, not independent holdout",
        },
        "fixtures": fixtures,
        "aggregate": aggregate(fixtures),
        "integrity": {
            "fixtureCount": len(fixtures),
            "referenceLabelsUsedForProposalGeneration": False,
            "compilerTimingShiftAllowed": False,
            "qualityGateApplied": False,
        },
    }
    assert_metrics_finite(result)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    compact = {
        "status": result["status"],
        "fixtures": {
            name: {
                wk: {
                    view: {
                        "exactF1": vals[view]["exactKind"]["f1"],
                        "landmarkF1": vals[view]["landmarkOnly"]["f1"],
                    }
                    for view in ("proposal_intent", "accepted_compiled")
                }
                for wk, vals in fixture["windowsSeconds"].items()
            }
            for name, fixture in fixtures.items()
        },
        "aggregate": result["aggregate"],
    }
    print(json.dumps(compact, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

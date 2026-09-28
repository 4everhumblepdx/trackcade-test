#!/usr/bin/env python3
from __future__ import annotations

import argparse
import functools
import json
import math
import statistics
from pathlib import Path

WINDOWS = (1.0, 2.0, 5.0)
VIEWS = ("proposalDropsSeconds", "acceptedDropsSeconds")
EXPECTED_TRACKS = 50


def load_object(path: Path) -> dict:
    value = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(value, dict):
        raise ValueError(f"expected JSON object: {path}")
    return value


def times(value, label: str) -> list[float]:
    if not isinstance(value, list):
        raise ValueError(f"{label} must be an array")
    out = []
    for i, item in enumerate(value):
        if not isinstance(item, (int, float)) or isinstance(item, bool):
            raise ValueError(f"{label}[{i}] must be numeric")
        x = float(item)
        if not math.isfinite(x) or x < 0:
            raise ValueError(f"{label}[{i}] invalid timestamp {item!r}")
        out.append(x)
    return sorted(out)


def better(a, b):
    """Return the preferred matching result.

    Result is (match_count, total_error, pairs_tuple). Primary objective is
    cardinality, secondary total error, tertiary lexical pair indices.
    """
    if b is None:
        return a
    if a[0] != b[0]:
        return a if a[0] > b[0] else b
    if abs(a[1] - b[1]) > 1e-12:
        return a if a[1] < b[1] else b
    return a if a[2] < b[2] else b


def match(refs: list[float], cands: list[float], tolerance: float) -> list[tuple[int, int]]:
    @functools.lru_cache(maxsize=None)
    def dp(i: int, j: int):
        if i >= len(refs) or j >= len(cands):
            return (0, 0.0, ())

        best = dp(i + 1, j)
        best = better(best, dp(i, j + 1))
        error = abs(refs[i] - cands[j])
        if error <= tolerance + 1e-12:
            tail = dp(i + 1, j + 1)
            candidate = (tail[0] + 1, tail[1] + error, ((i, j),) + tail[2])
            best = better(best, candidate)
        return best

    return list(dp(0, 0)[2])


def prf(reference_count: int, candidate_count: int, tp: int) -> dict:
    fp = candidate_count - tp
    fn = reference_count - tp
    if candidate_count == 0:
        precision = 1.0
    else:
        precision = tp / candidate_count
    if reference_count == 0:
        recall = 1.0
    else:
        recall = tp / reference_count
    if precision + recall == 0:
        f1 = 0.0
    else:
        f1 = 2 * precision * recall / (precision + recall)
    return {
        "referenceCount": reference_count,
        "candidateCount": candidate_count,
        "truePositive": tp,
        "falsePositive": fp,
        "falseNegative": fn,
        "precision": precision,
        "recall": recall,
        "f1": f1,
    }


def error_stats(values: list[float]) -> dict:
    if not values:
        return {"matchedErrorsSeconds": [], "meanAbsErrorSeconds": None, "medianAbsErrorSeconds": None, "maxAbsErrorSeconds": None}
    return {
        "matchedErrorsSeconds": values,
        "meanAbsErrorSeconds": sum(values) / len(values),
        "medianAbsErrorSeconds": statistics.median(values),
        "maxAbsErrorSeconds": max(values),
    }


def score_track(refs: list[float], cands: list[float], tolerance: float) -> dict:
    pairs = match(refs, cands, tolerance)
    errors = [abs(refs[i] - cands[j]) for i, j in pairs]
    result = prf(len(refs), len(cands), len(pairs))
    result.update(error_stats(errors))
    result["matches"] = [
        {
            "referenceIndex": i,
            "candidateIndex": j,
            "referenceSeconds": refs[i],
            "candidateSeconds": cands[j],
            "absErrorSeconds": abs(refs[i] - cands[j]),
        }
        for i, j in pairs
    ]
    return result


def aggregate(per_track: list[dict]) -> dict:
    ref = sum(x["referenceCount"] for x in per_track)
    cand = sum(x["candidateCount"] for x in per_track)
    tp = sum(x["truePositive"] for x in per_track)
    micro = prf(ref, cand, tp)
    errors = [e for row in per_track for e in row["matchedErrorsSeconds"]]
    micro.update(error_stats(errors))
    return {
        "micro": micro,
        "macro": {
            "precision": sum(x["precision"] for x in per_track) / len(per_track),
            "recall": sum(x["recall"] for x in per_track) / len(per_track),
            "f1": sum(x["f1"] for x in per_track) / len(per_track),
            "trackCount": len(per_track),
        },
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--references", type=Path, required=True)
    ap.add_argument("--candidates", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    refs_doc = load_object(args.references)
    cand_doc = load_object(args.candidates)
    if refs_doc.get("schema") != "trackcade-semantic-external-drop-references-v3":
        raise SystemExit("FAIL-CLOSED: wrong reference schema")
    if refs_doc.get("status") != "frozen-before-any-model-output-on-corpus":
        raise SystemExit("FAIL-CLOSED: references are not the pre-model frozen V3 answer key")
    if cand_doc.get("schema") != "trackcade-semantic-external-drop-candidates-v1":
        raise SystemExit("FAIL-CLOSED: wrong candidate schema")
    if cand_doc.get("stage") != "stage1":
        raise SystemExit("FAIL-CLOSED: evaluator is Stage 1 only")

    refs_rows = refs_doc.get("stage1") or []
    cand_rows = cand_doc.get("tracks") or []
    if len(refs_rows) != EXPECTED_TRACKS or len(cand_rows) != EXPECTED_TRACKS:
        raise SystemExit(f"FAIL-CLOSED: expected {EXPECTED_TRACKS} tracks in both inputs")

    refs_by_id = {}
    for row in refs_rows:
        track_id = row.get("id")
        if not isinstance(track_id, str) or not track_id or track_id in refs_by_id:
            raise SystemExit("FAIL-CLOSED: malformed/duplicate reference track id")
        refs_by_id[track_id] = times(row.get("dropsSeconds"), f"references[{track_id}]")

    cands_by_id = {}
    for row in cand_rows:
        track_id = row.get("id")
        if not isinstance(track_id, str) or not track_id or track_id in cands_by_id:
            raise SystemExit("FAIL-CLOSED: malformed/duplicate candidate track id")
        views = {view: times(row.get(view), f"candidates[{track_id}].{view}") for view in VIEWS}
        cands_by_id[track_id] = {
            **views,
            "compilerEligible": row.get("compilerEligible"),
            "timingTier": row.get("timingTier"),
        }

    if set(refs_by_id) != set(cands_by_id):
        raise SystemExit("FAIL-CLOSED: candidate Stage 1 track identities differ from frozen references")

    ordered_ids = [row["id"] for row in refs_rows]
    output = {
        "schema": "trackcade-semantic-external-drop-evaluation-v1",
        "stage": "stage1",
        "eventKind": "drop",
        "primaryToleranceSeconds": 2.0,
        "sensitivityToleranceSeconds": [1.0, 5.0],
        "matchingRule": "one-to-one maximum cardinality, then minimum total absolute timing error, then lexical matched-index tie-break",
        "trackCount": EXPECTED_TRACKS,
        "views": {},
    }

    for view in VIEWS:
        window_results = {}
        for tolerance in WINDOWS:
            track_results = []
            for track_id in ordered_ids:
                refs = refs_by_id[track_id]
                cands = cands_by_id[track_id][view]
                score = score_track(refs, cands, tolerance)
                score.update({
                    "id": track_id,
                    "timingTier": cands_by_id[track_id]["timingTier"],
                    "compilerEligible": cands_by_id[track_id]["compilerEligible"],
                })
                track_results.append(score)
            window_results[str(tolerance)] = {
                "tracks": track_results,
                "aggregate": aggregate(track_results),
            }
        output["views"][view] = window_results

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(output, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    p = output["views"]["proposalDropsSeconds"]["2.0"]["aggregate"]["micro"]
    a = output["views"]["acceptedDropsSeconds"]["2.0"]["aggregate"]["micro"]
    print(json.dumps({
        "primaryToleranceSeconds": 2.0,
        "proposalMicro": {k: p[k] for k in ("referenceCount", "candidateCount", "truePositive", "precision", "recall", "f1")},
        "acceptedMicro": {k: a[k] for k in ("referenceCount", "candidateCount", "truePositive", "precision", "recall", "f1")},
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

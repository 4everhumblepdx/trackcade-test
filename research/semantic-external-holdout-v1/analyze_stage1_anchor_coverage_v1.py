#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
from pathlib import Path

import evaluate_stage1_drop_v1 as frozen

PREP_SCHEMA = "trackcade-semantic-external-stage1-v2-prep-v1"
PREP_STATUS = "frozen-v2-provider-payloads-prepared-no-provider-call"
TOLERANCES = (1.0, 2.0, 5.0)


def fail(msg: str) -> None:
    raise SystemExit(f"ANCHOR COVERAGE FAIL-CLOSED: {msg}")


def unique_times(values):
    return sorted({round(float(x), 9) for x in values})


def score_refs(refs, anchors, tolerance):
    refs = sorted(float(x) for x in refs)
    anchors = sorted(float(x) for x in anchors)
    pairs, errors = frozen.match_one_to_one(refs, anchors, tolerance)
    return {
        "referenceCount": len(refs),
        "anchorCount": len(anchors),
        "matchedReferenceCount": len(pairs),
        "recallCeiling": 1.0 if not refs else len(pairs) / len(refs),
        "matchedPairs": [
            {
                "referenceIndex": i,
                "anchorIndex": j,
                "referenceSeconds": refs[i],
                "anchorSeconds": anchors[j],
                "absoluteErrorSeconds": abs(refs[i] - anchors[j]),
            }
            for i, j in pairs
        ],
        **frozen.timing_summary(errors),
    }


def aggregate(rows):
    refs = sum(x["referenceCount"] for x in rows)
    matched = sum(x["matchedReferenceCount"] for x in rows)
    errors = [p["absoluteErrorSeconds"] for x in rows for p in x["matchedPairs"]]
    return {
        "referenceSupport": refs,
        "matchedReferenceSupport": matched,
        "microRecallCeiling": 1.0 if refs == 0 else matched / refs,
        "tracksWithReferences": sum(1 for x in rows if x["referenceCount"] > 0),
        "tracksWithAllReferencesCovered": sum(1 for x in rows if x["referenceCount"] > 0 and x["matchedReferenceCount"] == x["referenceCount"]),
        **frozen.timing_summary(errors),
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--prep-root", type=Path, required=True)
    ap.add_argument("--references", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    prep_path = args.prep_root / "STAGE1_V2_PREP_MANIFEST_V1.json"
    prep = frozen.load(prep_path)
    if prep.get("schema") != PREP_SCHEMA or prep.get("status") != PREP_STATUS:
        fail("prep schema/status mismatch")
    if prep.get("developmentRevision") != "stage1-drop-semantics-v2":
        fail("prep development revision mismatch")
    if prep.get("trackCount") != 50 or len(prep.get("tracks") or []) != 50:
        fail("prep is not exact 50-track Stage 1 set")
    if prep.get("referenceLabelsReadByPreparation") is not False or prep.get("terminalTracksProcessed") is not False:
        fail("prep violates frozen research boundary")

    refs_doc = frozen.load(args.references)
    if refs_doc.get("schema") != frozen.REFERENCE_SCHEMA or refs_doc.get("eventKind") != "drop":
        fail("reference schema/event kind mismatch")
    ref_rows = refs_doc.get("stage1")
    if not isinstance(ref_rows, list) or len(ref_rows) != 50:
        fail("reference Stage 1 set is not exact 50")
    refs_by_id = {x.get("id"): x.get("dropsSeconds") for x in ref_rows if isinstance(x, dict)}
    if len(refs_by_id) != 50:
        fail("reference IDs are not unique/exact")

    per_view = {"boundary": [], "landmark": [], "anyAnchor": []}
    prep_ids = []
    for row in sorted(prep["tracks"], key=lambda x: x["ordinal"]):
        ordinal = row["ordinal"]
        track_id = row["id"]
        prep_ids.append(track_id)
        if track_id not in refs_by_id:
            fail(f"prep/reference identity mismatch: {track_id}")
        if row.get("analyzerRunnerSha256") != frozen.ANALYZER_RUNNER_SHA256 or row.get("analyzerSourceCommit") != frozen.ANALYZER_SOURCE_COMMIT:
            fail(f"Analyzer identity mismatch ordinal {ordinal}")
        case_dir = args.prep_root / "cases" / f"{ordinal:02d}-{row['stem']}"
        evidence_path = case_dir / "structure-evidence-v1.json"
        if frozen.sha256(evidence_path) != row["hashes"]["structureEvidenceSha256"]:
            fail(f"structure evidence identity mismatch ordinal {ordinal}")
        evidence = frozen.load(evidence_path)
        if evidence.get("schema") != "trackcade-structure-evidence-v1":
            fail(f"structure evidence schema mismatch ordinal {ordinal}")
        source = evidence.get("source") or {}
        if source.get("analyzerRunnerSha256") != frozen.ANALYZER_RUNNER_SHA256 or source.get("analysisJsonSha256") != row["analysisJsonSha256"]:
            fail(f"structure evidence source mismatch ordinal {ordinal}")

        boundaries = unique_times(x.get("time") for x in (evidence.get("boundaries") or []) if isinstance(x, dict) and frozen.finite_number(x.get("time")))
        landmarks = unique_times(x.get("time") for x in (evidence.get("landmarks") or []) if isinstance(x, dict) and frozen.finite_number(x.get("time")))
        any_anchor = unique_times(boundaries + landmarks)
        refs = refs_by_id[track_id]
        if not isinstance(refs, list) or any(not frozen.finite_number(x) for x in refs):
            fail(f"invalid reference list ordinal {ordinal}")

        for view, anchors in (("boundary", boundaries), ("landmark", landmarks), ("anyAnchor", any_anchor)):
            by_tol = {}
            for tol in TOLERANCES:
                by_tol[str(tol)] = score_refs(refs, anchors, tol)
            per_view[view].append({
                "ordinal": ordinal,
                "id": track_id,
                "timingTier": row["timingTier"],
                "referenceDropsSeconds": refs,
                "anchorCount": len(anchors),
                "byTolerance": by_tol,
            })

    if len(set(prep_ids)) != 50 or set(prep_ids) != set(refs_by_id):
        fail("prep/reference identity sets differ")

    views = {}
    for view, tracks in per_view.items():
        aggregates = {}
        for tol in TOLERANCES:
            aggregates[str(tol)] = aggregate([x["byTolerance"][str(tol)] for x in tracks])
        views[view] = {"aggregates": aggregates, "tracks": tracks}

    result = {
        "schema": "trackcade-semantic-external-stage1-anchor-coverage-v1",
        "status": "offline-deterministic-anchor-recall-ceiling-analysis",
        "stage": "stage1",
        "trackCount": 50,
        "referenceEventKind": "drop",
        "referenceDropsSha256": frozen.sha256(args.references),
        "prepManifestSha256": frozen.sha256(prep_path),
        "analyzerRunnerSha256": frozen.ANALYZER_RUNNER_SHA256,
        "analyzerSourceCommit": frozen.ANALYZER_SOURCE_COMMIT,
        "matchingImplementation": "imported-unchanged-from-evaluate_stage1_drop_v1.py",
        "tolerancesSeconds": [1.0, 2.0, 5.0],
        "providerCallsMade": 0,
        "terminalTracksProcessed": False,
        "meaning": "Maximum reference recall available from the existing deterministic anchor locations only. This is not semantic precision, model performance, or a new timing authority.",
        "views": views,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({k: v["aggregates"] for k, v in views.items()}, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

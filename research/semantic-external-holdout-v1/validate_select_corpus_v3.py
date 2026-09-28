#!/usr/bin/env python3
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import math
from pathlib import Path

import numpy as np
from scipy.io import loadmat

from validate_select_corpus_v2 import exact_extracted_files, probe_and_decode, sha256_file

SCHEMA_ELIGIBILITY = "trackcade-semantic-external-corpus-eligibility-v3"
SCHEMA_SPLIT = "trackcade-semantic-external-split-v3"
SCHEMA_REFERENCES = "trackcade-semantic-external-drop-references-v3"
EXPECTED_TRACKS = 402
EXPECTED_COUNTS = {"drop": 435, "build": 596, "break": 372}
AUX_KEYS = ("build_start", "build_end", "break_start", "break_end")
ALL_EXPERT_KEYS = ("drop",) + AUX_KEYS


def finite_values(value, name: str) -> list[float]:
    if value is None:
        return []
    arr = np.asarray(value)
    if arr.size == 0:
        return []
    try:
        vals = [float(x) for x in arr.reshape(-1)]
    except Exception as exc:
        raise ValueError(f"{name} is not a flat numeric array: {exc}") from exc
    for item in vals:
        if not math.isfinite(item):
            raise ValueError(f"{name} contains non-finite timestamp {item!r}")
    return vals


def nonzero_with_sentinel_count(vals: list[float]) -> tuple[list[float], int]:
    zero_count = sum(1 for x in vals if x == 0.0)
    return [x for x in vals if x != 0.0], zero_count


def parse_annotation(path: Path) -> tuple[dict, dict, list[dict]]:
    """Parse the external corpus for the predeclared Drop-only benchmark.

    Exact zero values are the dataset's observed empty-array sentinel. Drop labels
    must otherwise be positive finite timestamps. Build/Break fields are parsed
    only for corpus-integrity accounting; their observed annotation defects are
    recorded but do not invalidate a track for the Drop-only benchmark.
    """
    raw = loadmat(path, squeeze_me=True, struct_as_record=False)
    parsed: dict[str, list[float]] = {}
    zero_counts: dict[str, int] = {}
    for key in ALL_EXPERT_KEYS:
        values = finite_values(raw.get(key), key)
        parsed[key], zero_counts[key] = nonzero_with_sentinel_count(values)

    if any(x < 0.0 for x in parsed["drop"]):
        raise ValueError(f"drop contains negative timestamp(s): {parsed['drop']}")
    drops = sorted(parsed["drop"])

    anomalies: list[dict] = []
    for key in AUX_KEYS:
        negatives = [{"index": i, "value": x} for i, x in enumerate(parsed[key]) if x < 0.0]
        if negatives:
            anomalies.append({"type": "negative-auxiliary-timestamp", "field": key, "values": negatives})

    for kind in ("build", "break"):
        starts = parsed[f"{kind}_start"]
        ends = parsed[f"{kind}_end"]
        if len(starts) != len(ends):
            anomalies.append({
                "type": "auxiliary-interval-length-mismatch",
                "kind": kind,
                "startCount": len(starts),
                "endCount": len(ends),
            })
        inverted = [
            {"index": i, "start": start, "end": end}
            for i, (start, end) in enumerate(zip(starts, ends))
            if end < start
        ]
        if inverted:
            anomalies.append({"type": "auxiliary-inverted-interval", "kind": kind, "intervals": inverted})

    return {
        "dropReferences": drops,
        "expertEventCounts": {
            "drop": len(drops),
            "build": len(parsed["build_start"]),
            "break": len(parsed["break_start"]),
        },
    }, zero_counts, anomalies


def validate_one(pair: dict, corpus_root: Path, burned_hashes: set[str]) -> dict:
    audio = corpus_root / pair["audioPath"]
    ann = corpus_root / pair["annotationPath"]
    row = {
        "id": pair["id"],
        "stem": pair["stem"],
        "audioPath": pair["audioPath"],
        "annotationPath": pair["annotationPath"],
        "selectionHash": pair["selectionHash"],
        "annotationParsed": False,
        "eligible": False,
        "ineligibilityReason": None,
    }
    try:
        if not audio.is_file():
            raise FileNotFoundError(f"audio-not-found:{pair['audioPath']}")
        if not ann.is_file():
            raise FileNotFoundError(f"annotation-not-found:{pair['annotationPath']}")

        row["audioSha256"] = sha256_file(audio)
        row["annotationSha256"] = sha256_file(ann)

        ann_data, zero_counts, anomalies = parse_annotation(ann)
        row["annotationParsed"] = True
        row["expertEventCounts"] = ann_data["expertEventCounts"]
        row["zeroSentinelCounts"] = zero_counts
        row["auxiliaryAnnotationAnomalies"] = anomalies
        row["dropReferences"] = ann_data["dropReferences"]

        if row["audioSha256"] in burned_hashes:
            row["ineligibilityReason"] = "burned-semantic-development-audio-sha256"
            return row

        row.update(probe_and_decode(audio))
        row["eligible"] = True
        return row
    except Exception as exc:
        row["ineligibilityReason"] = f"pre-model-validation-failure:{type(exc).__name__}:{str(exc)[:1000]}"
        return row


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pairs", type=Path, required=True)
    ap.add_argument("--index", type=Path, required=True)
    ap.add_argument("--corpus-root", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--burned-audio", type=Path, action="append", default=[])
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    pairs_bytes = args.pairs.read_bytes()
    index_bytes = args.index.read_bytes()
    pairs_doc = json.loads(pairs_bytes.decode("utf-8"))
    index_doc = json.loads(index_bytes.decode("utf-8"))
    pairs = pairs_doc.get("pairs") or []
    if len(pairs) != EXPECTED_TRACKS:
        raise SystemExit(f"FAIL-CLOSED: expected {EXPECTED_TRACKS} frozen pairs, got {len(pairs)}")

    expected_files = exact_extracted_files(index_doc)
    actual_files = {
        p.relative_to(args.corpus_root).as_posix()
        for p in args.corpus_root.rglob("*") if p.is_file()
    }
    if actual_files != expected_files:
        missing = sorted(expected_files - actual_files)
        extra = sorted(actual_files - expected_files)
        raise SystemExit(
            "FAIL-CLOSED: extracted file set differs from frozen ZIP central directory: "
            + json.dumps({"missingCount": len(missing), "extraCount": len(extra), "missing": missing[:20], "extra": extra[:20]})
        )

    burned: dict[str, str] = {}
    for path in args.burned_audio:
        if not path.is_file():
            raise SystemExit(f"FAIL-CLOSED: burned reference audio missing: {path}")
        burned[path.name] = sha256_file(path)
    burned_hashes = set(burned.values())

    rows: list[dict] = []
    workers = max(1, min(args.workers, 4))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {
            pool.submit(validate_one, pair, args.corpus_root, burned_hashes): pair["id"]
            for pair in pairs
        }
        for n, future in enumerate(concurrent.futures.as_completed(futures), 1):
            row = future.result()
            rows.append(row)
            if n % 25 == 0 or not row["eligible"] or row.get("auxiliaryAnnotationAnomalies"):
                print(json.dumps({
                    "validated": n,
                    "id": row["id"],
                    "eligible": row["eligible"],
                    "reason": row["ineligibilityReason"],
                    "auxiliaryAnomalies": row.get("auxiliaryAnnotationAnomalies") or [],
                }, sort_keys=True), flush=True)

    rows.sort(key=lambda r: r["id"])
    annotation_parsed = [r for r in rows if r.get("annotationParsed")]
    if len(annotation_parsed) != EXPECTED_TRACKS:
        failures = [
            {"id": r["id"], "reason": r["ineligibilityReason"]}
            for r in rows if not r.get("annotationParsed")
        ]
        raise SystemExit(
            f"FAIL-CLOSED: Drop-ground-truth annotations parsed for only {len(annotation_parsed)}/{EXPECTED_TRACKS} tracks: "
            + json.dumps(failures[:20], sort_keys=True)
        )

    aggregate_counts = {
        kind: sum(r["expertEventCounts"][kind] for r in annotation_parsed)
        for kind in ("drop", "build", "break")
    }
    if aggregate_counts != EXPECTED_COUNTS:
        raise SystemExit(
            "FAIL-CLOSED: zero-sentinel-corrected expert event counts do not reproduce published corpus totals: "
            + json.dumps({"parsed": aggregate_counts, "expected": EXPECTED_COUNTS}, sort_keys=True)
        )

    zero_sentinel_totals = {
        key: sum(r["zeroSentinelCounts"].get(key, 0) for r in annotation_parsed)
        for key in ALL_EXPERT_KEYS
    }
    anomaly_tracks = [r for r in annotation_parsed if r.get("auxiliaryAnnotationAnomalies")]
    anomaly_count = sum(len(r.get("auxiliaryAnnotationAnomalies") or []) for r in anomaly_tracks)

    eligible = [r for r in rows if r["eligible"]]
    ineligible = [r for r in rows if not r["eligible"]]
    if len(eligible) < 100:
        raise SystemExit(f"FAIL-CLOSED: only {len(eligible)} tracks eligible; need at least 100")

    ordered = sorted(eligible, key=lambda r: (r["selectionHash"], r["id"]))
    stage1_rows = ordered[:50]
    terminal_rows = ordered[50:100]
    if {r["id"] for r in stage1_rows} & {r["id"] for r in terminal_rows}:
        raise SystemExit("FAIL-CLOSED: Stage 1 / terminal split overlap")

    def split_identity(r: dict) -> dict:
        return {
            "id": r["id"],
            "stem": r["stem"],
            "audioPath": r["audioPath"],
            "annotationPath": r["annotationPath"],
            "selectionHash": r["selectionHash"],
            "audioSha256": r["audioSha256"],
            "annotationSha256": r["annotationSha256"],
            "sampleRate": r["sampleRate"],
            "durationSeconds": r["durationSeconds"],
        }

    references = {
        "schema": SCHEMA_REFERENCES,
        "status": "frozen-before-any-model-output-on-corpus",
        "warning": "Evaluation labels only. Semantic-model workflows must not read this file.",
        "eventKind": "drop",
        "labelScope": "expert Drop timestamps only; Build/Break are not evaluation targets",
        "zeroTimestampPolicy": "exact 0 values are dataset empty-value sentinels; interpretation is accepted only after exact reproduction of published full-corpus event counts",
        "stage1": [{"id": r["id"], "dropsSeconds": r["dropReferences"]} for r in stage1_rows],
        "terminal": [{"id": r["id"], "dropsSeconds": r["dropReferences"]} for r in terminal_rows],
    }

    eligibility_rows = []
    for r in rows:
        eligibility_rows.append({k: v for k, v in r.items() if k != "dropReferences"})

    eligibility_doc = {
        "schema": SCHEMA_ELIGIBILITY,
        "status": "frozen-before-any-model-output-on-corpus",
        "supersedes": [
            {"schema": "trackcade-semantic-external-corpus-eligibility-v1", "reason": "V1 counted MAT zero sentinels as expert events"},
            {"schema": "trackcade-semantic-external-corpus-eligibility-v2", "reason": "V2 rejected valid Drop labels because unused Build/Break annotations contain documented pre-model anomalies"},
        ],
        "sourceCandidatePairsSha256": hashlib.sha256(pairs_bytes).hexdigest(),
        "sourceSplitZipIndexSha256": hashlib.sha256(index_bytes).hexdigest(),
        "burnedSemanticDevelopmentAudioSha256": burned,
        "eligibilityRule": "mechanical pair + valid expert Drop parse + exact source hash not burned + frozen Analyzer media decode path; auxiliary Build/Break defects are recorded, not used as Drop-benchmark exclusion criteria",
        "summary": {
            "candidateTracks": len(rows),
            "annotationParsedTracks": len(annotation_parsed),
            "eligibleTracks": len(eligible),
            "ineligibleTracks": len(ineligible),
            "expertEventCountsAll402": aggregate_counts,
            "publishedExpertEventCounts": EXPECTED_COUNTS,
            "zeroSentinelTotals": zero_sentinel_totals,
            "auxiliaryAnnotationAnomalyTracks": len(anomaly_tracks),
            "auxiliaryAnnotationAnomalyCount": anomaly_count,
        },
        "tracks": eligibility_rows,
    }

    split_doc = {
        "schema": SCHEMA_SPLIT,
        "status": "frozen-before-any-model-output-on-corpus",
        "labelScope": "Drop-only external semantic benchmark",
        "selectionRule": "eligible tracks sorted ascending by (selectionHash,id); first 50 Stage 1, next 50 terminal",
        "stage1": [split_identity(r) for r in stage1_rows],
        "terminal": [split_identity(r) for r in terminal_rows],
        "summary": {
            "stage1Tracks": len(stage1_rows),
            "terminalTracks": len(terminal_rows),
            "stage1ReferenceDrops": sum(len(r["dropReferences"]) for r in stage1_rows),
            "terminalReferenceDrops": sum(len(r["dropReferences"]) for r in terminal_rows),
        },
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        "CORPUS_ELIGIBILITY_V3.json": eligibility_doc,
        "SPLIT_V3.json": split_doc,
        "REFERENCE_DROPS_V3.json": references,
    }
    for name, doc in outputs.items():
        path = args.output_dir / name
        path.write_text(json.dumps(doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        (args.output_dir / f"{name}.sha256").write_text(f"{sha256_file(path)}  {name}\n", encoding="utf-8")

    print(json.dumps({
        "annotationParsedTracks": len(annotation_parsed),
        "eligibleTracks": len(eligible),
        "ineligibleTracks": len(ineligible),
        "expertEventCountsAll402": aggregate_counts,
        "auxiliaryAnnotationAnomalyTracks": len(anomaly_tracks),
        "auxiliaryAnnotationAnomalyCount": anomaly_count,
        "stage1Tracks": len(stage1_rows),
        "stage1Drops": split_doc["summary"]["stage1ReferenceDrops"],
        "terminalTracks": len(terminal_rows),
        "terminalDrops": split_doc["summary"]["terminalReferenceDrops"],
    }, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()

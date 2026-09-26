#!/usr/bin/env python3
"""Aggregate all deterministic shards of the frozen ASAP triple-meter holdout."""
from __future__ import annotations

import argparse
import csv
import json
from collections import defaultdict
from pathlib import Path


def as_bool(v):
    return str(v).strip().lower() == "true"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--shards-root", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--expected-baseline-sha", required=True)
    ap.add_argument("--expected-dev-sha", required=True)
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    summaries = []
    rows = []
    errors = []
    invariance = []
    sources = []

    result_files = sorted(args.shards_root.rglob("results.csv"))
    summary_files = sorted(args.shards_root.rglob("summary.json"))
    error_files = sorted(args.shards_root.rglob("errors.json"))
    inv_files = sorted(args.shards_root.rglob("invariance_failures.json"))
    source_files = sorted(args.shards_root.rglob("sources.json"))

    if not (len(result_files) == len(summary_files) == len(error_files) == len(inv_files) == len(source_files) == 4):
        raise SystemExit(
            "FAIL-CLOSED: expected exactly four complete shard artifacts; "
            f"results={len(result_files)} summaries={len(summary_files)} errors={len(error_files)} "
            f"invariance={len(inv_files)} sources={len(source_files)}"
        )

    for p in summary_files:
        summaries.append(json.loads(p.read_text()))
    shard_indices = sorted(s["shard_index"] for s in summaries)
    if shard_indices != [0, 1, 2, 3] or any(s["shard_count"] != 4 for s in summaries):
        raise SystemExit(f"FAIL-CLOSED: shard identity mismatch {shard_indices}")
    for s in summaries:
        if s["baseline_sha256"] != args.expected_baseline_sha or s["dev_sha256"] != args.expected_dev_sha:
            raise SystemExit("FAIL-CLOSED: runner SHA mismatch across shards")

    for p in result_files:
        with p.open(newline="") as f:
            rows.extend(csv.DictReader(f))
    for p in error_files:
        errors.extend(json.loads(p.read_text()))
    for p in inv_files:
        invariance.extend(json.loads(p.read_text()))
    for p in source_files:
        sources.extend(json.loads(p.read_text()))

    tracks = [r["track"] for r in rows]
    source_names = [s["source"] for s in sources]
    if len(rows) != 100 or len(set(tracks)) != 100:
        raise SystemExit(f"FAIL-CLOSED: expected 100 unique analyzed performances, got rows={len(rows)} unique={len(set(tracks))}")
    if len(sources) != 98 or len(set(source_names)) != 98:
        raise SystemExit(f"FAIL-CLOSED: expected 98 unique sources, got rows={len(sources)} unique={len(set(source_names))}")
    if errors:
        raise SystemExit(f"FAIL-CLOSED: {len(errors)} processing errors")
    if invariance:
        raise SystemExit(f"FAIL-CLOSED: {len(invariance)} canonical invariance failures")

    rows.sort(key=lambda r: r["track"])
    improved = [r for r in rows if not as_bool(r["baseline_reference_recalled"]) and as_bool(r["dev_reference_recalled"])]
    regressed = [r for r in rows if as_bool(r["baseline_reference_recalled"]) and not as_bool(r["dev_reference_recalled"])]
    tier_changes = [r for r in rows if r["timing_tier_baseline"] != r["timing_tier_dev"]]
    triple = [r for r in rows if r["reference_relation_to_selected"] in ("one-third", "triple")]
    runtime_ratios = [float(r["runtime_ratio"]) for r in rows]

    by_composer = {}
    for composer in sorted({r["composer"] for r in rows}):
        rr = [r for r in rows if r["composer"] == composer]
        by_composer[composer] = {
            "tracks": len(rr),
            "baseline_reference_recall": sum(as_bool(r["baseline_reference_recalled"]) for r in rr),
            "dev_reference_recall": sum(as_bool(r["dev_reference_recalled"]) for r in rr),
            "improvements": sum((not as_bool(r["baseline_reference_recalled"])) and as_bool(r["dev_reference_recalled"]) for r in rr),
            "regressions": sum(as_bool(r["baseline_reference_recalled"]) and (not as_bool(r["dev_reference_recalled"])) for r in rr),
            "triple_family_tracks": sum(r["reference_relation_to_selected"] in ("one-third", "triple") for r in rr),
        }

    summary = {
        "corpus": "ASAP v1.2 / MAESTRO v2.0.0 frozen pure-three-beat holdout full 100",
        "selection_frozen_before_analyzer_output": True,
        "selection_plan_run_id": 36254145100,
        "selection_plan_artifact_id": 10910171359,
        "remote_zip_smoke_run_id": 36254313279,
        "remote_zip_smoke_artifact_id": 10910300658,
        "baseline_sha256": args.expected_baseline_sha,
        "dev_sha256": args.expected_dev_sha,
        "tracks_expected": 100,
        "tracks_analyzed": len(rows),
        "unique_maestro_sources": len(set(source_names)),
        "errors": len(errors),
        "canonical_invariance_passed": not invariance,
        "canonical_invariance_failures": len(invariance),
        "baseline_reference_recall": sum(as_bool(r["baseline_reference_recalled"]) for r in rows),
        "dev_reference_recall": sum(as_bool(r["dev_reference_recalled"]) for r in rows),
        "reference_recall_improvements": len(improved),
        "reference_recall_regressions": len(regressed),
        "triple_family_reference_tracks": len(triple),
        "triple_family_baseline_recall": sum(as_bool(r["baseline_reference_recalled"]) for r in triple),
        "triple_family_dev_recall": sum(as_bool(r["dev_reference_recalled"]) for r in triple),
        "timing_tier_changes": len(tier_changes),
        "mean_runtime_ratio": sum(runtime_ratios) / len(runtime_ratios),
        "max_runtime_ratio": max(runtime_ratios),
        "remote_range_requests_total": sum(int(s["remote_range_requests"]) for s in summaries),
        "remote_range_bytes_fetched_total": sum(int(s["remote_range_bytes_fetched"]) for s in summaries),
        "extracted_source_bytes_total": sum(int(s["extracted_source_bytes"]) for s in summaries),
        "by_composer": by_composer,
        "improved_tracks": [r["track"] for r in improved],
        "regressed_tracks": [r["track"] for r in regressed],
    }

    fields = list(rows[0].keys())
    with (args.output / "results.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    (args.output / "errors.json").write_text(json.dumps(errors, indent=2) + "\n")
    (args.output / "invariance_failures.json").write_text(json.dumps(invariance, indent=2) + "\n")
    (args.output / "sources.json").write_text(json.dumps(sorted(sources, key=lambda x: x["source"]), indent=2) + "\n")
    (args.output / "shard_summaries.json").write_text(json.dumps(sorted(summaries, key=lambda x: x["shard_index"]), indent=2) + "\n")
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))

    if regressed:
        raise SystemExit(f"FAIL-CLOSED: {len(regressed)} reference-recall regressions")
    if tier_changes:
        raise SystemExit(f"FAIL-CLOSED: {len(tier_changes)} timing-tier changes")


if __name__ == "__main__":
    main()

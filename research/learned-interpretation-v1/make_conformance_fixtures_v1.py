#!/usr/bin/env python3
from __future__ import annotations

import argparse
import copy
import json
from pathlib import Path


def write(path: Path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def first_event(proposal, predicate=lambda e: True):
    for e in proposal.get("events", []):
        if predicate(e):
            return e
    raise SystemExit("positive fixture does not contain required event kind for mutation")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--proposal", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()

    base = json.loads(args.proposal.read_text(encoding="utf-8"))
    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    write(out / "valid.json", base)

    cases = {}

    def add(name, mutate, expected):
        p = copy.deepcopy(base)
        mutate(p)
        write(out / f"{name}.json", p)
        cases[name] = expected

    add("top_level_time", lambda p: p.__setitem__("time", 12.3), "forbidden_timing_key")
    add("event_time", lambda p: p["events"][0].__setitem__("time", 12.3), "forbidden_timing_key")
    add("event_t", lambda p: p["events"][0].__setitem__("t", 12.3), "forbidden_timing_key")
    add("source_bpm", lambda p: p["source"].__setitem__("bpm", 120), "forbidden_timing_key")
    add("beat_grid_edit", lambda p: p["events"][0].__setitem__("beatGrid", [0, 1]), "forbidden_timing_key")
    add("analysis_sha_mismatch", lambda p: p["source"].__setitem__("analysisJsonSha256", "0" * 64), "proposal_analysis_sha_mismatch")
    add("anchor_index_out_of_range", lambda p: p["events"][0]["anchor"].__setitem__("index", 1000000), "anchor_index_out_of_range")
    add("anchor_type_invalid", lambda p: p["events"][0]["anchor"].__setitem__("type", "beat"), "anchor_type_invalid")
    add("semantic_kind_invalid", lambda p: p["events"][0].__setitem__("kind", "chorus"), "unsupported_kind")
    add("confidence_out_of_range", lambda p: p["events"][0].__setitem__("semanticConfidence", 1.1), "semantic_confidence_invalid")

    def remove_section_name(p):
        e = first_event(p, lambda x: x.get("kind") == "section")
        e.pop("name", None)
    add("section_name_missing", remove_section_name, "section_name_required")

    add("unexpected_event_key", lambda p: p["events"][0].__setitem__("foo", "bar"), "unexpected_keys")

    def non_drop_duration(p):
        e = first_event(p, lambda x: x.get("kind") != "drop")
        e["duration"] = 12
    add("non_drop_duration", non_drop_duration, "duration_only_allowed_for_drop")

    def too_many(p):
        seed = copy.deepcopy(p["events"][0])
        p["events"] = [copy.deepcopy(seed) for _ in range(65)]
    add("too_many_events", too_many, "proposal_too_many_events")

    manifest = {
        "schema": "trackcade-learned-proposal-conformance-fixtures-v1",
        "positive": "valid.json",
        "negative": [
            {"file": f"{name}.json", "expectedErrorSubstring": expected}
            for name, expected in sorted(cases.items())
        ],
    }
    write(out / "manifest.json", manifest)
    print(json.dumps({"negativeFixtures": len(cases), "outputDir": str(out)}, indent=2))


if __name__ == "__main__":
    main()

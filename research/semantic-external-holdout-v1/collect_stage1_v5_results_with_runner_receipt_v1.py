#!/usr/bin/env python3
"""Narrow compatibility wrapper for the frozen V5 generation collector.

Some completed V5 GitHub Actions artifacts contain runner-exit-code.txt in
addition to the collector's semantic evidence files. This wrapper does not
relax semantic validation. It accepts that one auxiliary file only when its
contents prove exit code zero, keeps it in the frozen/hash-bound provider case,
and delegates every other check to collect_stage1_v5_results_v1.py.
"""
from __future__ import annotations

import argparse
import importlib.util
from pathlib import Path

HERE = Path(__file__).resolve().parent
CORE = HERE / "collect_stage1_v5_results_v1.py"

spec = importlib.util.spec_from_file_location("trackcade_v5_collector_core", CORE)
if spec is None or spec.loader is None:
    raise RuntimeError("cannot load V5 collector core")
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)

_original_detect_variant = core.detect_variant


def detect_variant_with_runner_receipt(files: dict[str, bytes], ordinal: int):
    if "runner-exit-code.txt" not in files:
        return _original_detect_variant(files, ordinal)
    core.require(
        files["runner-exit-code.txt"] in {b"0", b"0\n", b"0\r\n"},
        f"ordinal {ordinal}: runner-exit-code.txt must prove exit code zero",
    )
    semantic_files = dict(files)
    semantic_files.pop("runner-exit-code.txt")
    return _original_detect_variant(semantic_files, ordinal)


core.detect_variant = detect_variant_with_runner_receipt


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-prep-root", type=Path, required=True)
    ap.add_argument("--flex-prep-root", type=Path, required=True)
    ap.add_argument("--artifact-root", type=Path, required=True)
    ap.add_argument("--inventory", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()
    core.collect(
        args.source_prep_root,
        args.flex_prep_root,
        args.artifact_root,
        core.load(args.inventory),
        args.output_dir,
    )


if __name__ == "__main__":
    main()

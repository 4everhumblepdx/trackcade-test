#!/usr/bin/env python3
"""Narrow compatibility wrapper for the frozen V5 generation collector.

Compatibility accepted here is intentionally limited to two execution-wrapper
facts already present in immutable successful artifacts:

1. Base 8192 artifacts may include runner-exit-code.txt. It is accepted only
   when it proves exit code zero and remains copied/hash-bound in the freeze.
2. The separately authorized 16384 retries for ordinals 4 and 35 used lean
   status receipts that omit several redundant hashes/counts which are present
   in the immutable artifact files themselves. For those two ordinals only,
   this wrapper derives the omitted bindings in-memory so the original strict
   collector can verify the same semantic evidence. Original artifact bytes
   are never modified and their hashes remain the ones recorded in the freeze.
"""
from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
CORE = HERE / "collect_stage1_v5_results_v1.py"

spec = importlib.util.spec_from_file_location("trackcade_v5_collector_core", CORE)
if spec is None or spec.loader is None:
    raise RuntimeError("cannot load V5 collector core")
core = importlib.util.module_from_spec(spec)
spec.loader.exec_module(core)

_original_detect_variant = core.detect_variant
_original_inspect_case = core.inspect_case


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


def inspect_case_with_retry_bindings(
    files: dict[str, bytes], artifact: dict, run: dict, row: dict,
    source_root: Path, flex_root: Path,
) -> dict:
    ordinal = row["ordinal"]
    if ordinal not in {4, 35}:
        return _original_inspect_case(files, artifact, run, row, source_root, flex_root)

    # The retry artifacts are immutable and complete, but their lean status
    # receipts omitted redundant bindings that base8192 receipts included.
    # Require those fields to be genuinely absent so this path cannot silently
    # overwrite contradictory evidence.
    variant_name, variant = detect_variant_with_runner_receipt(files, ordinal)
    core.require(variant_name in {"retry4_16384", "retry35_16384"},
                 f"ordinal {ordinal}: retry compatibility used on wrong variant")
    status_name = variant["statusFile"]
    status = json.loads(files[status_name])
    missing_only = {
        "normalizedProposalSha256", "validationReportSha256",
        "providerRunManifestSha256", "dropProposalCount",
        "candidateAssessmentCount",
    }
    core.require(all(k not in status for k in missing_only),
                 f"ordinal {ordinal}: retry receipt unexpectedly contains compatibility fields")

    proposal = json.loads(files["normalized-proposal.json"])
    assessments = proposal.get("candidateAssessments")
    events = proposal.get("events")
    core.require(isinstance(assessments, list) and isinstance(events, list),
                 f"ordinal {ordinal}: retry normalized proposal structure")
    drop_count = sum(
        1 for e in events if isinstance(e, dict) and e.get("kind") == "drop"
    )

    compat_status = dict(status)
    compat_status.update({
        "normalizedProposalSha256": core.digest(files["normalized-proposal.json"]),
        "validationReportSha256": core.digest(files["validation-report.json"]),
        "providerRunManifestSha256": core.digest(files["provider-run-manifest.json"]),
        "dropProposalCount": drop_count,
        "candidateAssessmentCount": len(assessments),
    })
    compat_files = dict(files)
    compat_files[status_name] = (
        json.dumps(compat_status, sort_keys=True, separators=(",", ":")) + "\n"
    ).encode("utf-8")

    entry = _original_inspect_case(
        compat_files, artifact, run, row, source_root, flex_root
    )
    # The canonical freeze must bind the bytes actually uploaded by the live
    # run, not the ephemeral compatibility view used above.
    entry["files"] = {
        name: core.digest(data) for name, data in sorted(files.items())
    }
    return entry


core.detect_variant = detect_variant_with_runner_receipt
core.inspect_case = inspect_case_with_retry_bindings


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

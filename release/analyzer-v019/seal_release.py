#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path


EXPECTED = {
    "mirror": {"tracks": 96},
    "candombe": {"tracks": 35},
    "ballroom": {"tracks": 698},
    "giantsteps": {"tracks": 664},
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def load_exactly_one(root: Path, filename: str):
    matches = sorted(p for p in root.rglob(filename) if p.is_file())
    if len(matches) != 1:
        raise SystemExit(
            f"FAIL-CLOSED: expected exactly one {filename!r} under {root}, "
            f"found {len(matches)}: {[str(p) for p in matches]}"
        )
    return matches[0], json.loads(matches[0].read_text())


def require(condition: bool, message: str):
    if not condition:
        raise SystemExit(f"FAIL-CLOSED: {message}")


def validate_gate(name: str, root: Path):
    summary_path, summary = load_exactly_one(root, "summary.json")
    errors_path, errors = load_exactly_one(root, "errors.json")
    inv_path, invariance = load_exactly_one(root, "invariance_failures.json")

    require(errors == [], f"{name}: errors.json is not empty: {errors!r}")
    require(invariance == [], f"{name}: invariance_failures.json is not empty: {invariance!r}")
    require(summary.get("errors") == 0, f"{name}: summary errors != 0")
    require(
        summary.get("canonical_invariance_passed") is True,
        f"{name}: canonical_invariance_passed is not true",
    )
    require(
        summary.get("canonical_invariance_failures") == 0,
        f"{name}: canonical_invariance_failures != 0",
    )
    require(
        summary.get("timing_tier_changes") == 0,
        f"{name}: timing_tier_changes != 0",
    )

    expected = EXPECTED[name]["tracks"]
    analyzed = summary.get("tracks_analyzed")
    require(analyzed == expected, f"{name}: expected {expected} analyzed tracks, got {analyzed}")

    if name == "mirror":
        require(summary.get("tracks_expected") == expected, "mirror: tracks_expected drift")
        require(
            summary.get("baseline_recall_both_all") == summary.get("dev_recall_both_all"),
            "mirror: candidate recall regressed",
        )
        require(
            summary.get("baseline_recall_both_all") == expected,
            "mirror: expected 96/96 baseline candidate recall",
        )
    else:
        require(
            summary.get("tracks_discovered") == expected,
            f"{name}: tracks_discovered denominator drift",
        )
        if name == "giantsteps":
            require(
                summary.get("annotations_discovered") == expected,
                "giantsteps: annotation denominator drift",
            )
        require(
            summary.get("reference_recall_regressions") == 0,
            f"{name}: reference recall regressions != 0",
        )
        require(
            summary.get("dev_reference_recall", -1) >= summary.get("baseline_reference_recall", -1),
            f"{name}: dev reference recall below baseline",
        )

    return {
        "summary_path": str(summary_path.relative_to(root)),
        "errors_path": str(errors_path.relative_to(root)),
        "invariance_failures_path": str(inv_path.relative_to(root)),
        "summary": summary,
    }


def main():
    ap = argparse.ArgumentParser(description="Seal Trackcade Analyzer v0.19 RC1 from existing gate evidence.")
    ap.add_argument("--package-dir", required=True)
    ap.add_argument("--source-run-id", required=True, type=int)
    ap.add_argument("--source-commit", required=True)
    ap.add_argument("--candidate-sha", required=True)
    ap.add_argument("--release-spec", required=True)
    args = ap.parse_args()

    package = Path(args.package_dir)
    runner = package / "trackcade-analyzer-v0.19-rc1.js"
    build_manifest_path = package / "build_manifest.json"
    spec_src = Path(args.release_spec)
    spec_dst = package / "RELEASE_SPEC.json"

    require(runner.is_file(), f"missing packaged runner: {runner}")
    require(build_manifest_path.is_file(), f"missing build manifest: {build_manifest_path}")
    require(spec_src.is_file(), f"missing release spec: {spec_src}")

    actual_runner_sha = sha256(runner)
    require(
        actual_runner_sha == args.candidate_sha,
        f"runner SHA mismatch: {actual_runner_sha} != {args.candidate_sha}",
    )

    build = json.loads(build_manifest_path.read_text())
    require(build.get("runner_sha256") == args.candidate_sha, "build manifest runner SHA mismatch")
    require(
        build.get("frozen_v018_sha256")
        == "baf6c3701f9b3ccbe67237b04dcca2e9a158f180ceabb6e1c3e9f0b1a8594c15",
        "frozen v0.18 SHA mismatch",
    )
    require(build.get("automatic_tactus_switching") is False, "automatic tactus switching must be false")
    require(
        build.get("added_descriptive_relations") == ["one-third", "triple"],
        "unexpected descriptive relation set",
    )

    spec = json.loads(spec_src.read_text())
    require(spec.get("release") == "trackcade-analyzer-v0.19-rc1", "release spec name mismatch")
    require(
        spec.get("included_change", {}).get("canonical_behavior", "").startswith("descriptive only"),
        "release spec no longer describes a descriptive-only change",
    )
    spec_dst.write_text(json.dumps(spec, indent=2) + "\n")

    gates = {}
    for name in ("mirror", "candombe", "ballroom", "giantsteps"):
        root = package / "evidence" / name
        require(root.is_dir(), f"missing evidence directory: {root}")
        gates[name] = validate_gate(name, root)

    final = {
        "release": "trackcade-analyzer-v0.19-rc1",
        "status": "FINAL_RELEASE_GATE_PASSED",
        "source_commit": args.source_commit,
        "workflow_run_id": args.source_run_id,
        "runner_sha256": args.candidate_sha,
        "frozen_v018_sha256": build["frozen_v018_sha256"],
        "frozen_v017_archive_sha256": build["frozen_v017_archive_sha256"],
        "descriptive_patch_sha256": build["descriptive_patch_sha256"],
        "automatic_tactus_switching": False,
        "added_descriptive_relations": ["one-third", "triple"],
        "confidence_tiers": spec["timing_guardrail_contract"],
        "gates": {name: data["summary"] for name, data in gates.items()},
        "evidence_locations": {
            name: {
                "summary": data["summary_path"],
                "errors": data["errors_path"],
                "invariance_failures": data["invariance_failures_path"],
            }
            for name, data in gates.items()
        },
        "rejected_automatic_selectors": [
            "v1 GTZAN rejection",
            "v2 Meter2800 rejection",
        ],
    }
    (package / "RELEASE_MANIFEST.json").write_text(json.dumps(final, indent=2) + "\n")

    checksum_lines = []
    for path in sorted(p for p in package.rglob("*") if p.is_file() and p.name != "SHA256SUMS"):
        checksum_lines.append(f"{sha256(path)}  {path.relative_to(package).as_posix()}")
    (package / "SHA256SUMS").write_text("\n".join(checksum_lines) + "\n")

    print(json.dumps({
        "status": final["status"],
        "source_commit": args.source_commit,
        "workflow_run_id": args.source_run_id,
        "runner_sha256": args.candidate_sha,
        "gates": {
            "mirror": "PASS 96/96",
            "candombe": "PASS 35/35",
            "ballroom": "PASS 698/698",
            "giantsteps": "PASS 664/664",
        },
        "sha256_entries": len(checksum_lines),
    }, indent=2))


if __name__ == "__main__":
    main()

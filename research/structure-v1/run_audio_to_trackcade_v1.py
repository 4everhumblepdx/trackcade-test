#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

EXPECTED_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"


def sha256_file(path: Path):
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def run(cmd, *, stdout_path: Path | None = None, timeout=1800):
    if stdout_path is None:
        q = subprocess.run(cmd, text=True, capture_output=True, timeout=timeout)
    else:
        stdout_path.parent.mkdir(parents=True, exist_ok=True)
        with stdout_path.open("w") as out:
            q = subprocess.run(cmd, text=True, stdout=out, stderr=subprocess.PIPE, timeout=timeout)
    if q.returncode != 0:
        stderr = q.stderr if isinstance(q.stderr, str) else ""
        stdout = q.stdout if isinstance(getattr(q, "stdout", None), str) else ""
        raise SystemExit(
            "pipeline command failed:\n"
            + " ".join(str(x) for x in cmd)
            + "\n"
            + (stderr or stdout)[-4000:]
        )
    return q


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--audio", type=Path, required=True)
    ap.add_argument("--track-metadata", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--proposal", type=Path)
    ap.add_argument("--sample-rate", type=int, default=44100)
    args = ap.parse_args()

    if not args.audio.is_file():
        raise SystemExit(f"audio file not found: {args.audio}")
    if not args.track_metadata.is_file():
        raise SystemExit(f"track metadata file not found: {args.track_metadata}")
    if args.proposal is not None and not args.proposal.is_file():
        raise SystemExit(f"proposal file not found: {args.proposal}")
    if args.sample_rate < 8000 or args.sample_rate > 192000:
        raise SystemExit("sample rate out of supported pipeline range")

    repo = Path(__file__).resolve().parents[2]
    out = args.output_dir.resolve()
    work = out / "work"
    out.mkdir(parents=True, exist_ok=True)
    work.mkdir(parents=True, exist_ok=True)

    runner = work / "trackcade-analyzer-v0.19.js"
    build_manifest = out / "analyzer-build-manifest.json"
    raw = work / "audio.f32"
    analysis = out / "analysis-v019.json"
    evidence = out / "structure-evidence-v1.json"
    safe_manifest = out / "trackcade-safe-v1.json"
    final_manifest = out / "trackcade-final-v1.json"
    semantic_report = out / "semantic-compile-report-v1.json"
    pipeline_report = out / "pipeline-report-v1.json"

    run([
        sys.executable,
        str(repo / "release/analyzer-v019/build_release.py"),
        "--output", str(runner),
        "--manifest", str(build_manifest),
    ], timeout=120)
    runner_sha = sha256_file(runner)
    if runner_sha != EXPECTED_RUNNER_SHA256:
        raise SystemExit(f"FAIL-CLOSED: v0.19 runner SHA mismatch {runner_sha}")

    run([
        "ffmpeg", "-v", "error", "-y", "-i", str(args.audio),
        "-ac", "1", "-ar", str(args.sample_rate),
        "-f", "f32le", "-acodec", "pcm_f32le", str(raw),
    ], timeout=900)
    if not raw.is_file() or raw.stat().st_size <= 0:
        raise SystemExit("decoded PCM is empty")

    run([
        "node", str(runner), str(raw), str(args.sample_rate), "1", args.audio.name,
    ], stdout_path=analysis, timeout=2400)
    parsed_analysis = json.loads(analysis.read_text())
    if not isinstance(parsed_analysis, dict):
        raise SystemExit("Analyzer output is not a JSON object")
    analysis_sha = sha256_file(analysis)

    run([
        sys.executable,
        str(repo / "research/structure-v1/export_structure_evidence_v1.py"),
        "--analysis", str(analysis),
        "--output", str(evidence),
    ], timeout=120)

    run([
        sys.executable,
        str(repo / "research/structure-v1/generate_safe_manifest_v1.py"),
        "--analysis", str(analysis),
        "--track-metadata", str(args.track_metadata),
        "--output", str(safe_manifest),
    ], timeout=120)

    final_mode = "safe-baseline"
    if args.proposal is not None:
        run([
            sys.executable,
            str(repo / "research/structure-v1/compile_semantic_events_v1.py"),
            "--safe-manifest", str(safe_manifest),
            "--evidence", str(evidence),
            "--proposal", str(args.proposal),
            "--output", str(final_manifest),
            "--report", str(semantic_report),
        ], timeout=120)
        final_mode = "semantic-qc-compiled"
    else:
        shutil.copyfile(safe_manifest, final_manifest)

    safe = json.loads(safe_manifest.read_text())
    ev = json.loads(evidence.read_text())
    final = json.loads(final_manifest.read_text())
    if safe.get("generation", {}).get("analysisJsonSha256") != analysis_sha:
        raise SystemExit("FAIL-CLOSED: safe manifest analysis identity mismatch")
    if ev.get("source", {}).get("analysisJsonSha256") != analysis_sha:
        raise SystemExit("FAIL-CLOSED: structure evidence analysis identity mismatch")

    safe_beats = [e for e in safe.get("events", []) if isinstance(e, dict) and e.get("kind") == "beat"]
    final_beats = [e for e in final.get("events", []) if isinstance(e, dict) and e.get("kind") == "beat"]
    if final_beats != safe_beats:
        raise SystemExit("FAIL-CLOSED: final manifest altered Analyzer-authored beat grid")
    if final.get("energyCurve") != safe.get("energyCurve"):
        raise SystemExit("FAIL-CLOSED: final manifest altered Analyzer energy curve")

    report = {
        "schema": "trackcade-audio-to-game-pipeline-v1",
        "audio": {
            "filename": args.audio.name,
            "inputSha256": sha256_file(args.audio),
            "decodedPcmBytes": raw.stat().st_size,
            "sampleRate": args.sample_rate,
        },
        "analyzer": {
            "release": "v0.19",
            "runnerSha256": runner_sha,
            "analysisJsonSha256": analysis_sha,
            "timingTier": safe.get("generation", {}).get("timingTier"),
            "timingConfidence": safe.get("generation", {}).get("timingConfidence"),
            "structureConfidence": safe.get("generation", {}).get("structureConfidence"),
        },
        "outputs": {
            "analysis": analysis.name,
            "structureEvidence": evidence.name,
            "safeManifest": safe_manifest.name,
            "finalManifest": final_manifest.name,
            "semanticReport": semantic_report.name if semantic_report.exists() else None,
            "finalMode": final_mode,
        },
        "counts": {
            "beatEvents": len(safe_beats),
            "sectionEvents": sum(1 for e in safe.get("events", []) if e.get("kind") == "section"),
            "energySamples": len(safe.get("energyCurve") or []),
            "finalSemanticEvents": sum(1 for e in final.get("events", []) if e.get("kind") in {"drop", "peak", "energy"}),
        },
        "hashes": {
            "structureEvidenceSha256": sha256_file(evidence),
            "safeManifestSha256": sha256_file(safe_manifest),
            "finalManifestSha256": sha256_file(final_manifest),
        },
        "safety": {
            "beatGridPreserved": True,
            "energyCurvePreserved": True,
            "visualOnlyGameplayGenerationAllowed": False,
            "safeBaselineAvailable": True,
        },
    }
    pipeline_report.write_text(json.dumps(report, indent=2) + "\n")
    print(json.dumps(report, indent=2))

    raw.unlink(missing_ok=True)
    runner.unlink(missing_ok=True)
    try:
        work.rmdir()
    except OSError:
        pass


if __name__ == "__main__":
    main()

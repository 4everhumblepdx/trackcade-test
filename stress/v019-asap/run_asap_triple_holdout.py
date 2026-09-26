#!/usr/bin/env python3
"""Run one deterministic shard of the frozen ASAP/MAESTRO triple-meter holdout.

Selection comes exclusively from the previously frozen plan artifact. This script
never filters tracks based on Analyzer output. It compares exact frozen v0.18
against the sealed v0.19-rc1 runner, requiring canonical/timing invariance while
measuring descriptive candidate recall against annotation-derived median beat BPM.
"""
from __future__ import annotations

import argparse
import copy
import csv
import hashlib
import importlib.util
import json
import subprocess
import tempfile
import time
import wave
import zipfile
from collections import defaultdict
from pathlib import Path


def load_range_reader():
    p = Path(__file__).with_name("inspect_maestro_remote_zip.py")
    spec = importlib.util.spec_from_file_location("trackcade_remote_zip", p)
    if spec is None or spec.loader is None:
        raise RuntimeError("unable to load range reader module")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.HTTPRangeReader


HTTPRangeReader = load_range_reader()


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def canonical(x):
    y = copy.deepcopy(x)
    y.pop("tactusCandidates", None)
    return y


def match_rank(cands, bpm, tol=0.04):
    if not bpm or bpm <= 0:
        return None
    for i, c in enumerate(cands, 1):
        cb = float(c.get("bpm") or 0)
        if cb > 0 and abs(cb - bpm) / bpm <= tol:
            return i
    return None


def relation(selected, reference):
    if not selected or not reference:
        return None
    ratio = reference / selected
    fam = [
        ("one-third", 1 / 3), ("half", 1 / 2), ("two-thirds", 2 / 3),
        ("same", 1), ("three-halves", 1.5), ("double", 2), ("triple", 3),
    ]
    name, target = min(fam, key=lambda z: abs(ratio - z[1]) / z[1])
    return name if abs(ratio - target) / target <= 0.06 else "other"


def run_analyzer(node, runner: Path, raw: Path, sr: int, name: str):
    start = time.perf_counter()
    q = subprocess.run(
        [node, str(runner), str(raw), str(sr), "1", name],
        text=True, capture_output=True, timeout=900,
    )
    elapsed = time.perf_counter() - start
    if q.returncode:
        raise RuntimeError((q.stderr or q.stdout)[-2000:])
    return json.loads(q.stdout), elapsed


def decode_crop(source: Path, raw: Path, sr: int, start_s, end_s):
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", str(source)]
    if start_s is not None:
        cmd += ["-ss", f"{float(start_s):.9f}"]
    if end_s is not None:
        origin = float(start_s) if start_s is not None else 0.0
        duration = float(end_s) - origin
        if duration <= 0:
            raise RuntimeError(f"invalid crop duration start={start_s} end={end_s}")
        cmd += ["-t", f"{duration:.9f}"]
    cmd += ["-ac", "1", "-ar", str(sr), "-f", "f32le", "-acodec", "pcm_f32le", str(raw)]
    q = subprocess.run(cmd, text=True, capture_output=True, timeout=900)
    if q.returncode:
        raise RuntimeError((q.stderr or q.stdout)[-2000:])
    if raw.stat().st_size <= 0:
        raise RuntimeError("decoded crop is empty")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--eligible-json", type=Path, required=True)
    ap.add_argument("--zip-url", required=True)
    ap.add_argument("--baseline-runner", type=Path, required=True)
    ap.add_argument("--dev-runner", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--shard-index", type=int, required=True)
    ap.add_argument("--shard-count", type=int, required=True)
    ap.add_argument("--expected-baseline-sha", required=True)
    ap.add_argument("--expected-dev-sha", required=True)
    ap.add_argument("--node", default="node")
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    if not 0 <= args.shard_index < args.shard_count:
        raise SystemExit("invalid shard index/count")
    base_sha = sha256_file(args.baseline_runner)
    dev_sha = sha256_file(args.dev_runner)
    if base_sha != args.expected_baseline_sha:
        raise SystemExit(f"FAIL-CLOSED: baseline SHA {base_sha}")
    if dev_sha != args.expected_dev_sha:
        raise SystemExit(f"FAIL-CLOSED: dev SHA {dev_sha}")

    eligible = json.loads(args.eligible_json.read_text())
    if len(eligible) != 100:
        raise SystemExit(f"FAIL-CLOSED: frozen plan expected 100 performances, got {len(eligible)}")

    by_source = defaultdict(list)
    for r in eligible:
        by_source[r["maestro_audio_filename"]].append(r)
    all_sources = sorted(by_source)
    if len(all_sources) != 98:
        raise SystemExit(f"FAIL-CLOSED: frozen plan expected 98 sources, got {len(all_sources)}")
    assigned_sources = [s for i, s in enumerate(all_sources) if i % args.shard_count == args.shard_index]
    assigned_tracks = sum((by_source[s] for s in assigned_sources), [])

    remote = HTTPRangeReader(args.zip_url)
    rows = []
    errors = []
    invariance_failures = []
    extracted_source_bytes = 0
    source_details = []

    with zipfile.ZipFile(remote, "r") as zf:
        infos = zf.infolist()
        member_by_source = {}
        for source in assigned_sources:
            matches = [i for i in infos if i.filename == source or i.filename.endswith("/" + source)]
            if len(matches) != 1:
                raise SystemExit(f"FAIL-CLOSED: source mapping {source!r} matches={len(matches)}")
            member_by_source[source] = matches[0]

        for source_num, source in enumerate(assigned_sources, 1):
            info = member_by_source[source]
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tf:
                source_path = Path(tf.name)
            try:
                h = hashlib.sha256()
                written = 0
                with zf.open(info, "r") as src, source_path.open("wb") as dst:
                    while True:
                        chunk = src.read(1024 * 1024)
                        if not chunk:
                            break
                        h.update(chunk)
                        dst.write(chunk)
                        written += len(chunk)
                if written != info.file_size:
                    raise RuntimeError(f"source extract size {written} != {info.file_size}")
                extracted_source_bytes += written
                with wave.open(str(source_path), "rb") as wf:
                    sr = wf.getframerate()
                    channels = wf.getnchannels()
                    width = wf.getsampwidth()
                if channels != 2 or width != 2 or sr not in (44100, 48000):
                    raise RuntimeError(f"unexpected source WAV format channels={channels} width={width} sr={sr}")
                source_details.append({
                    "source": source,
                    "zip_member": info.filename,
                    "compressed_bytes": info.compress_size,
                    "uncompressed_bytes": info.file_size,
                    "crc32": f"{info.CRC:08x}",
                    "sha256": h.hexdigest(),
                    "sample_rate": sr,
                    "performances": len(by_source[source]),
                })

                for perf in sorted(by_source[source], key=lambda r: r["midi_performance"]):
                    track = perf["midi_performance"]
                    raw = None
                    try:
                        with tempfile.NamedTemporaryFile(suffix=".f32", delete=False) as rf:
                            raw = Path(rf.name)
                        decode_crop(source_path, raw, sr, perf.get("crop_start_s"), perf.get("crop_end_s"))
                        base, tb = run_analyzer(args.node, args.baseline_runner, raw, sr, track)
                        dev, td = run_analyzer(args.node, args.dev_runner, raw, sr, track)
                        invariant = canonical(base) == canonical(dev)
                        if not invariant:
                            invariance_failures.append(track)
                        ref = float(perf["reference_median_beat_bpm"])
                        bc = base.get("tactusCandidates") or []
                        dc = dev.get("tactusCandidates") or []
                        br = match_rank(bc, ref)
                        dr = match_rank(dc, ref)
                        selected = float(base.get("bpm") or 0)
                        rows.append({
                            "track": track,
                            "composer": perf.get("composer") or "",
                            "title": perf.get("title") or "",
                            "maestro_source": source,
                            "reference_bpm": round(ref, 6),
                            "selected_bpm": selected,
                            "reference_relation_to_selected": relation(selected, ref),
                            "canonical_invariant": invariant,
                            "baseline_reference_rank": br or "",
                            "dev_reference_rank": dr or "",
                            "baseline_reference_recalled": br is not None,
                            "dev_reference_recalled": dr is not None,
                            "baseline_candidate_count": len(bc),
                            "dev_candidate_count": len(dc),
                            "new_triple_relation_count": sum(c.get("relationToSource") in ("one-third", "triple") for c in dc),
                            "baseline_runtime_s": round(tb, 6),
                            "dev_runtime_s": round(td, 6),
                            "runtime_ratio": round(td / max(tb, 1e-9), 6),
                            "timing_tier_baseline": (base.get("timingGuardrail") or {}).get("tier"),
                            "timing_tier_dev": (dev.get("timingGuardrail") or {}).get("tier"),
                            "crop_start_s": perf.get("crop_start_s"),
                            "crop_end_s": perf.get("crop_end_s"),
                            "estimated_crop_duration_s": perf.get("estimated_crop_duration_s"),
                        })
                    except Exception as e:
                        errors.append({"track": track, "source": source, "error": str(e)})
                    finally:
                        if raw is not None:
                            raw.unlink(missing_ok=True)
            except Exception as e:
                for perf in by_source[source]:
                    errors.append({"track": perf["midi_performance"], "source": source, "error": f"source-level: {e}"})
            finally:
                source_path.unlink(missing_ok=True)
            print(json.dumps({
                "shard": args.shard_index,
                "source_progress": f"{source_num}/{len(assigned_sources)}",
                "rows": len(rows),
                "errors": len(errors),
                "invariance_failures": len(invariance_failures),
            }), flush=True)

    fields = list(rows[0].keys()) if rows else []
    with (args.output / "results.csv").open("w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        if fields:
            w.writeheader()
            w.writerows(rows)
    (args.output / "errors.json").write_text(json.dumps(errors, indent=2) + "\n")
    (args.output / "invariance_failures.json").write_text(json.dumps(invariance_failures, indent=2) + "\n")
    (args.output / "sources.json").write_text(json.dumps(source_details, indent=2) + "\n")

    improved = [r for r in rows if not r["baseline_reference_recalled"] and r["dev_reference_recalled"]]
    regressed = [r for r in rows if r["baseline_reference_recalled"] and not r["dev_reference_recalled"]]
    tier_changes = [r for r in rows if r["timing_tier_baseline"] != r["timing_tier_dev"]]
    triple = [r for r in rows if r["reference_relation_to_selected"] in ("one-third", "triple")]
    ratios = [r["runtime_ratio"] for r in rows]
    summary = {
        "corpus": "ASAP v1.2 / MAESTRO v2.0.0 frozen pure-three-beat holdout",
        "shard_index": args.shard_index,
        "shard_count": args.shard_count,
        "baseline_sha256": base_sha,
        "dev_sha256": dev_sha,
        "assigned_sources": len(assigned_sources),
        "assigned_performances": len(assigned_tracks),
        "tracks_analyzed": len(rows),
        "errors": len(errors),
        "canonical_invariance_failures": len(invariance_failures),
        "baseline_reference_recall": sum(bool(r["baseline_reference_recalled"]) for r in rows),
        "dev_reference_recall": sum(bool(r["dev_reference_recalled"]) for r in rows),
        "reference_recall_improvements": len(improved),
        "reference_recall_regressions": len(regressed),
        "triple_family_reference_tracks": len(triple),
        "triple_family_baseline_recall": sum(bool(r["baseline_reference_recalled"]) for r in triple),
        "triple_family_dev_recall": sum(bool(r["dev_reference_recalled"]) for r in triple),
        "timing_tier_changes": len(tier_changes),
        "mean_runtime_ratio": sum(ratios) / len(ratios) if ratios else None,
        "max_runtime_ratio": max(ratios) if ratios else None,
        "remote_range_requests": remote.range_requests,
        "remote_range_bytes_fetched": remote.range_bytes,
        "extracted_source_bytes": extracted_source_bytes,
        "improved_tracks": [r["track"] for r in improved],
        "regressed_tracks": [r["track"] for r in regressed],
    }
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    print(json.dumps(summary, indent=2))

    if len(rows) != len(assigned_tracks):
        raise SystemExit(f"FAIL-CLOSED: expected {len(assigned_tracks)} analyzed tracks, got {len(rows)}")
    if errors:
        raise SystemExit(f"FAIL-CLOSED: {len(errors)} processing errors")
    if invariance_failures:
        raise SystemExit(f"FAIL-CLOSED: {len(invariance_failures)} canonical invariance failures")
    if regressed:
        raise SystemExit(f"FAIL-CLOSED: {len(regressed)} reference recall regressions")
    if tier_changes:
        raise SystemExit(f"FAIL-CLOSED: {len(tier_changes)} timing tier changes")


if __name__ == "__main__":
    main()

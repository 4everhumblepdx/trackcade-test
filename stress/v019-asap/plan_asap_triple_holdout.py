#!/usr/bin/env python3
"""Plan an independent ASAP/MAESTRO triple-meter holdout without downloading audio.

The selection rule is fixed before Analyzer output is inspected:
  * ASAP v1.2 performance has an audio mapping to MAESTRO v2.0.0.
  * Performance time-signature annotations exist.
  * Every annotated meter segment has exactly 3 annotated beats per measure.

This intentionally includes the full eligible audio-backed population rather than
selecting pieces based on Analyzer behavior or reference tempo. The output is a
compact, reproducible manifest for a later real-audio validation run.
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
import statistics
from pathlib import Path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def present(value: object) -> bool:
    return value is not None and str(value).strip() not in {"", "nan", "NaN", "None"}


def load_csv(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def robust_bpm(beats: list[float]) -> float | None:
    vals = sorted(float(x) for x in beats if x is not None and float(x) >= 0)
    intervals = [b - a for a, b in zip(vals, vals[1:]) if 0.15 <= b - a <= 2.0]
    if len(intervals) < 8:
        return None
    return 60.0 / statistics.median(intervals)


def meter_segments(annotation: dict) -> list[dict]:
    ts = annotation.get("perf_time_signatures") or {}
    out = []
    for raw_time, value in ts.items():
        try:
            when = float(raw_time)
        except Exception:
            continue
        if not isinstance(value, (list, tuple)) or len(value) < 2:
            continue
        sig = str(value[0])
        try:
            beats_per_measure = int(value[1])
        except Exception:
            continue
        out.append({"time": when, "signature": sig, "beats_per_measure": beats_per_measure})
    return sorted(out, key=lambda x: x["time"])


def resolve_maestro_key(raw: str) -> str:
    x = raw.replace("\\", "/").strip()
    prefix = "{maestro}/"
    if x.startswith(prefix):
        x = x[len(prefix):]
    return x.lstrip("/")


def maybe_float(x: object) -> float | None:
    if not present(x):
        return None
    try:
        return float(x)
    except Exception:
        return None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--asap-root", type=Path, required=True)
    ap.add_argument("--maestro-metadata", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--asap-commit", required=True)
    args = ap.parse_args()

    args.output.mkdir(parents=True, exist_ok=True)
    asap_meta_path = args.asap_root / "metadata.csv"
    asap_ann_path = args.asap_root / "asap_annotations.json"
    if not asap_meta_path.is_file() or not asap_ann_path.is_file():
        raise SystemExit("FAIL-CLOSED: ASAP metadata/annotation files missing")

    asap_rows = load_csv(asap_meta_path)
    annotations = json.loads(asap_ann_path.read_text(encoding="utf-8"))
    maestro_rows = load_csv(args.maestro_metadata)

    maestro_by_audio: dict[str, dict[str, str]] = {}
    for row in maestro_rows:
        key = (row.get("audio_filename") or "").replace("\\", "/").lstrip("/")
        if key:
            maestro_by_audio[key] = row

    eligible = []
    rejection_counts: dict[str, int] = {}
    mapped_audio_rows = 0
    for row in asap_rows:
        reason = None
        audio_perf = row.get("audio_performance")
        maestro_audio = row.get("maestro_audio_performance")
        midi_perf = (row.get("midi_performance") or "").replace("\\", "/")
        if not present(audio_perf) or not present(maestro_audio):
            reason = "no_audio_mapping"
        else:
            mapped_audio_rows += 1
            ann = annotations.get(midi_perf)
            if ann is None:
                reason = "annotation_missing"
            else:
                meters = meter_segments(ann)
                if not meters:
                    reason = "meter_missing"
                elif any(m["beats_per_measure"] != 3 for m in meters):
                    reason = "not_pure_three_beat_meter"
                else:
                    maestro_key = resolve_maestro_key(str(maestro_audio))
                    maestro = maestro_by_audio.get(maestro_key)
                    if maestro is None:
                        reason = "maestro_metadata_unmapped"
                    else:
                        beats = ann.get("performance_beats") or []
                        bpm = robust_bpm(beats)
                        if bpm is None:
                            reason = "insufficient_valid_beats"
                        else:
                            source_duration = maybe_float(maestro.get("duration"))
                            start = maybe_float(row.get("start"))
                            end = maybe_float(row.get("end"))
                            crop_start = start if start is not None else 0.0
                            if end is not None:
                                crop_duration = max(0.0, end - crop_start)
                            elif source_duration is not None:
                                crop_duration = max(0.0, source_duration - crop_start)
                            else:
                                crop_duration = None
                            eligible.append({
                                "composer": row.get("composer") or "",
                                "title": row.get("title") or "",
                                "midi_performance": midi_perf,
                                "performance_annotations": row.get("performance_annotations") or "",
                                "audio_performance": str(audio_perf),
                                "maestro_audio_filename": maestro_key,
                                "maestro_midi_filename": (maestro.get("midi_filename") or "").replace("\\", "/"),
                                "maestro_split": maestro.get("split") or "",
                                "maestro_year": maestro.get("year") or "",
                                "maestro_source_duration_s": source_duration,
                                "crop_start_s": start,
                                "crop_end_s": end,
                                "estimated_crop_duration_s": crop_duration,
                                "reference_median_beat_bpm": round(bpm, 6),
                                "meter_segments": meters,
                                "time_signatures": sorted({m["signature"] for m in meters}),
                                "annotated_beats": len(beats),
                                "annotated_downbeats": len(ann.get("performance_downbeats") or []),
                            })
        if reason:
            rejection_counts[reason] = rejection_counts.get(reason, 0) + 1

    eligible.sort(key=lambda r: (r["composer"], r["title"], r["midi_performance"]))
    unique_sources = sorted({r["maestro_audio_filename"] for r in eligible})
    source_duration_by_name = {}
    for r in eligible:
        if r["maestro_source_duration_s"] is not None:
            source_duration_by_name[r["maestro_audio_filename"]] = r["maestro_source_duration_s"]
    source_duration_total = sum(source_duration_by_name.values())
    crop_durations = [r["estimated_crop_duration_s"] for r in eligible if r["estimated_crop_duration_s"] is not None]
    ref_bpms = [r["reference_median_beat_bpm"] for r in eligible]

    # Uncompressed MAESTRO audio is 44.1–48 kHz, 16-bit stereo. Use the high end
    # as a conservative storage estimate; this is not an integrity measurement.
    estimated_source_bytes_upper = source_duration_total * 48000 * 2 * 2
    estimated_crop_bytes_upper = sum(crop_durations) * 48000 * 2 * 2

    summary = {
        "corpus": "ASAP v1.2 / MAESTRO v2.0.0 pure-three-beat audio holdout plan",
        "selection_rule": "audio-backed ASAP performances where every perf_time_signatures segment has beats_per_measure == 3",
        "selection_frozen_before_analyzer_output": True,
        "asap_commit": args.asap_commit,
        "asap_metadata_sha256": sha256_file(asap_meta_path),
        "asap_annotations_sha256": sha256_file(asap_ann_path),
        "maestro_metadata_sha256": sha256_file(args.maestro_metadata),
        "asap_metadata_rows": len(asap_rows),
        "asap_annotation_entries": len(annotations),
        "maestro_metadata_rows": len(maestro_rows),
        "asap_rows_with_audio_mapping": mapped_audio_rows,
        "eligible_performances": len(eligible),
        "eligible_unique_pieces": len({(r["composer"], r["title"]) for r in eligible}),
        "eligible_unique_maestro_source_wavs": len(unique_sources),
        "eligible_reference_bpm_min": min(ref_bpms) if ref_bpms else None,
        "eligible_reference_bpm_median": statistics.median(ref_bpms) if ref_bpms else None,
        "eligible_reference_bpm_max": max(ref_bpms) if ref_bpms else None,
        "eligible_crop_duration_hours": sum(crop_durations) / 3600.0,
        "eligible_unique_source_duration_hours": source_duration_total / 3600.0,
        "estimated_unique_source_pcm_upper_gb": estimated_source_bytes_upper / 1_000_000_000,
        "estimated_crop_pcm_upper_gb": estimated_crop_bytes_upper / 1_000_000_000,
        "rejections": dict(sorted(rejection_counts.items())),
    }

    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    (args.output / "eligible_performances.json").write_text(json.dumps(eligible, indent=2) + "\n")
    with (args.output / "eligible_performances.csv").open("w", newline="", encoding="utf-8") as f:
        fields = [
            "composer", "title", "midi_performance", "performance_annotations", "audio_performance",
            "maestro_audio_filename", "maestro_midi_filename", "maestro_split", "maestro_year",
            "maestro_source_duration_s", "crop_start_s", "crop_end_s", "estimated_crop_duration_s",
            "reference_median_beat_bpm", "annotated_beats", "annotated_downbeats", "time_signatures",
        ]
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        for r in eligible:
            x = {k: r.get(k) for k in fields}
            x["time_signatures"] = ";".join(r["time_signatures"])
            w.writerow(x)
    (args.output / "unique_maestro_sources.txt").write_text("\n".join(unique_sources) + ("\n" if unique_sources else ""))
    print(json.dumps(summary, indent=2))

    if len(asap_rows) != 1067:
        raise SystemExit(f"FAIL-CLOSED: expected 1067 ASAP metadata rows, got {len(asap_rows)}")
    if len(annotations) != 1067:
        raise SystemExit(f"FAIL-CLOSED: expected 1067 ASAP annotation entries, got {len(annotations)}")
    if len(maestro_rows) != 1282:
        raise SystemExit(f"FAIL-CLOSED: expected 1282 MAESTRO v2 metadata rows, got {len(maestro_rows)}")
    if not eligible:
        raise SystemExit("FAIL-CLOSED: no eligible pure-three-beat audio performances")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import io
import json
from pathlib import Path

import numpy as np
from scipy.io import loadmat

from audit_mat_labels_v1 import disk_name, extract_entry_from_disk
from download_osf_split_v1 import fetch_one

TARGETS = (
    "mp3s_soundcloud_cc_event_detection/114061375.mat",
    "mp3s_soundcloud_cc_event_detection/118125022.mat",
    "mp3s_soundcloud_cc_event_detection/90268834.mat",
)
KEYS = (
    "drop", "drop_tc",
    "build_start", "build_end", "build_tc",
    "break_start", "break_end", "break_tc",
)


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def summarize(value):
    if value is None:
        return {"present": False}
    arr = np.asarray(value)
    out = {
        "present": True,
        "shape": list(arr.shape),
        "size": int(arr.size),
        "dtype": str(arr.dtype),
    }
    if arr.size:
        try:
            flat = [float(x) for x in arr.reshape(-1)]
            out["numericFlatCount"] = len(flat)
            out["numericValues"] = flat if len(flat) <= 64 else flat[:64]
            out["numericValuesTruncated"] = len(flat) > 64
        except Exception as exc:
            out["numericError"] = f"{type(exc).__name__}:{exc}"
            out["reprValues"] = [repr(x)[:300] for x in arr.reshape(-1)[:16]]
    return out


def main() -> None:
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--inventory", type=Path, required=True)
    ap.add_argument("--index", type=Path, required=True)
    ap.add_argument("--work-dir", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    inventory = load_json(args.inventory)
    index = load_json(args.index)
    by_name = {
        e["name"]: e for e in index.get("entries", [])
        if isinstance(e, dict) and e.get("name")
    }
    inv_by_name = {
        e["name"]: e for e in inventory.get("entries", [])
        if isinstance(e, dict) and e.get("kind") == "file"
    }

    missing = [name for name in TARGETS if name not in by_name]
    if missing:
        raise SystemExit(f"target MAT entries absent from frozen central directory: {missing}")

    args.work_dir.mkdir(parents=True, exist_ok=True)
    segments: dict[int, bytes] = {}
    verified_segments: dict[int, dict] = {}
    audited = []

    for name in TARGETS:
        entry = by_name[name]
        disk = int(entry["diskStart"])
        if disk not in segments:
            seg_name = disk_name(disk)
            inv = inv_by_name.get(seg_name)
            if not inv:
                raise SystemExit(f"frozen inventory missing split segment {seg_name}")
            verified_segments[disk] = fetch_one(inv, args.work_dir)
            segments[disk] = (args.work_dir / seg_name).read_bytes()

        mat_bytes = extract_entry_from_disk(segments[disk], entry)
        raw_default = loadmat(io.BytesIO(mat_bytes))
        raw_squeezed = loadmat(io.BytesIO(mat_bytes), squeeze_me=True, struct_as_record=False)
        audited.append({
            "name": name,
            "diskStart": disk,
            "localHeaderOffsetOnDisk": entry["localHeaderOffsetOnDisk"],
            "compressedSize": entry["compressedSize"],
            "uncompressedSize": entry["uncompressedSize"],
            "crc32": entry["crc32"],
            "defaultLoadmat": {k: summarize(raw_default.get(k)) for k in KEYS},
            "squeezedLoadmat": {k: summarize(raw_squeezed.get(k)) for k in KEYS},
            "allUserKeys": sorted(k for k in raw_default if not k.startswith("__")),
        })

    report = {
        "schema": "trackcade-semantic-external-mat-anomaly-audit-v1",
        "purpose": "pre-model audit of the exact three MAT files rejected by corrected corpus parser v2; not semantic evaluation",
        "targets": list(TARGETS),
        "verifiedSegments": [verified_segments[k] for k in sorted(verified_segments)],
        "audited": audited,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    for row in audited:
        print("===", row["name"], "===")
        for key in KEYS:
            print(key, json.dumps(row["squeezedLoadmat"][key], sort_keys=True))


if __name__ == "__main__":
    main()

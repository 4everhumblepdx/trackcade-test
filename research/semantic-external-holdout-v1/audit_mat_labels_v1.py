#!/usr/bin/env python3
from __future__ import annotations

import argparse
import binascii
import io
import json
import struct
import sys
import zlib
from pathlib import Path

import numpy as np
from scipy.io import loadmat

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
from download_osf_split_v1 import fetch_one  # noqa: E402

KEYS = (
    "drop", "drop_tc",
    "build_start", "build_end", "build_tc",
    "break_start", "break_end", "break_tc",
)
LOCAL_SIG = b"PK\x03\x04"


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def disk_name(disk_start: int) -> str:
    if 0 <= disk_start <= 14:
        return f"mp3s_soundcloud_cc_event_detection.z{disk_start + 1:02d}"
    if disk_start == 15:
        return "mp3s_soundcloud_cc_event_detection.zip"
    raise ValueError(f"unsupported split disk {disk_start}")


def extract_entry_from_disk(segment: bytes, entry: dict) -> bytes:
    base = int(entry["localHeaderOffsetOnDisk"])
    candidates = [base]
    # Some split archives include the optional PK\x07\x08 spanning marker at disk 0.
    if entry["diskStart"] == 0:
        candidates.append(base + 4)
    pos = next((p for p in candidates if segment[p:p+4] == LOCAL_SIG), None)
    if pos is None:
        raise RuntimeError(
            f"local header signature not found for {entry['name']} at {candidates}"
        )
    if pos + 30 > len(segment):
        raise RuntimeError("truncated local header")
    fields = struct.unpack_from("<4s5H3L2H", segment, pos)
    _, _version, flags, method, _mtime, _mdate, _crc_local, _csize_local, _usize_local, name_len, extra_len = fields
    name_start = pos + 30
    data_start = name_start + name_len + extra_len
    data_end = data_start + int(entry["compressedSize"])
    if data_end > len(segment):
        raise RuntimeError(
            f"entry crosses split boundary: {entry['name']} data_end={data_end} disk_size={len(segment)}"
        )
    raw_name = segment[name_start:name_start + name_len]
    try:
        local_name = raw_name.decode("utf-8" if flags & 0x800 else "cp437")
    except Exception:
        local_name = repr(raw_name)
    if local_name != entry["name"]:
        raise RuntimeError(f"local/central filename mismatch: {local_name!r} vs {entry['name']!r}")
    comp = segment[data_start:data_end]
    if method == 0:
        data = comp
    elif method == 8:
        data = zlib.decompress(comp, -15)
    else:
        raise RuntimeError(f"unsupported ZIP compression method {method}")
    if len(data) != int(entry["uncompressedSize"]):
        raise RuntimeError(f"uncompressed size mismatch for {entry['name']}")
    crc = binascii.crc32(data) & 0xFFFFFFFF
    if f"{crc:08x}" != entry["crc32"].lower():
        raise RuntimeError(f"CRC mismatch for {entry['name']}")
    return data


def summarize_value(value):
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
            out["numericSample"] = flat[:12]
        except Exception as exc:
            out["numericError"] = f"{type(exc).__name__}:{exc}"
            out["reprSample"] = [repr(x)[:300] for x in arr.reshape(-1)[:4]]
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inventory", type=Path, required=True)
    ap.add_argument("--index", type=Path, required=True)
    ap.add_argument("--work-dir", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--sample-count", type=int, default=12)
    args = ap.parse_args()

    inventory = load_json(args.inventory)
    index = load_json(args.index)
    mat_entries = [
        e for e in index.get("entries", [])
        if isinstance(e, dict) and str(e.get("name", "")).endswith(".mat")
    ]
    if len(mat_entries) != 402:
        raise SystemExit(f"expected 402 MAT entries, got {len(mat_entries)}")

    # Pick small MAT entries from disk 0 that are wholly resident in the first split
    # segment. This is a schema audit, not a benchmark sample.
    candidates = sorted(
        [e for e in mat_entries if e.get("diskStart") == 0],
        key=lambda e: (int(e.get("compressedSize", 0)), e["name"]),
    )
    if not candidates:
        raise SystemExit("no MAT entries begin on split disk 0")

    inv_by_name = {
        e["name"]: e for e in inventory.get("entries", [])
        if isinstance(e, dict) and e.get("kind") == "file"
    }
    seg_name = disk_name(0)
    seg_entry = inv_by_name.get(seg_name)
    if not seg_entry:
        raise SystemExit(f"frozen inventory missing {seg_name}")
    args.work_dir.mkdir(parents=True, exist_ok=True)
    verified = fetch_one(seg_entry, args.work_dir)
    seg_path = args.work_dir / seg_name
    segment = seg_path.read_bytes()

    audited = []
    failures = []
    for entry in candidates:
        if len(audited) >= args.sample_count:
            break
        try:
            mat_bytes = extract_entry_from_disk(segment, entry)
            raw_default = loadmat(io.BytesIO(mat_bytes))
            raw_squeezed = loadmat(io.BytesIO(mat_bytes), squeeze_me=True, struct_as_record=False)
            record = {
                "name": entry["name"],
                "diskStart": entry["diskStart"],
                "localHeaderOffsetOnDisk": entry["localHeaderOffsetOnDisk"],
                "compressedSize": entry["compressedSize"],
                "uncompressedSize": entry["uncompressedSize"],
                "defaultLoadmat": {k: summarize_value(raw_default.get(k)) for k in KEYS},
                "squeezedLoadmat": {k: summarize_value(raw_squeezed.get(k)) for k in KEYS},
                "allUserKeys": sorted(k for k in raw_default if not k.startswith("__")),
            }
            audited.append(record)
        except Exception as exc:
            failures.append({"name": entry["name"], "error": f"{type(exc).__name__}:{exc}"})

    if len(audited) < min(args.sample_count, 3):
        raise SystemExit(f"insufficient successful MAT audits: {len(audited)}; failures={failures[:10]}")

    report = {
        "schema": "trackcade-semantic-external-mat-label-audit-v1",
        "purpose": "pre-model parser/schema audit only; not semantic evaluation",
        "segment": verified,
        "auditedCount": len(audited),
        "failureCount": len(failures),
        "audited": audited,
        "failures": failures,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"auditedCount": len(audited), "failureCount": len(failures)}, sort_keys=True))
    for row in audited[:5]:
        print("===", row["name"], "===")
        for key in KEYS:
            print(key, json.dumps(row["defaultLoadmat"][key], sort_keys=True))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import shutil
import urllib.request
from pathlib import Path

USER_AGENT = "trackcade-semantic-external-holdout-v1/1.0"
BASE = "mp3s_soundcloud_cc_event_detection"
PART_RE = re.compile(rf"^{re.escape(BASE)}\.(?:z\d{{2}}|zip)$", re.IGNORECASE)
EXPECTED_NAMES = [f"{BASE}.z{i:02d}" for i in range(1, 16)] + [f"{BASE}.zip"]


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def expected_sha(entry: dict) -> str:
    value = (((entry.get("extra") or {}).get("hashes") or {}).get("sha256"))
    if not isinstance(value, str) or len(value) != 64:
        raise RuntimeError(f"missing frozen SHA-256 for {entry.get('name')}")
    return value.lower()


def fetch_one(entry: dict, out_dir: Path) -> dict:
    name = entry["name"]
    url = (entry.get("links") or {}).get("download")
    if not isinstance(url, str) or not url:
        raise RuntimeError(f"missing frozen download URL for {name}")
    dst = out_dir / name
    tmp = out_dir / f".{name}.partial"
    tmp.unlink(missing_ok=True)
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT}, method="GET")
    try:
        with urllib.request.urlopen(req, timeout=900) as resp, tmp.open("wb") as f:
            if resp.status != 200:
                raise RuntimeError(f"HTTP {resp.status} for {name}")
            shutil.copyfileobj(resp, f, length=1024 * 1024)
        size = tmp.stat().st_size
        expected_size = entry.get("size")
        if not isinstance(expected_size, int) or size != expected_size:
            raise RuntimeError(f"size mismatch for {name}: expected {expected_size}, got {size}")
        actual = sha256_file(tmp)
        expected = expected_sha(entry)
        if actual != expected:
            raise RuntimeError(f"SHA-256 mismatch for {name}: expected {expected}, got {actual}")
        tmp.replace(dst)
        return {"name": name, "size": size, "sha256": actual}
    finally:
        tmp.unlink(missing_ok=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inventory", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--verification-output", type=Path, required=True)
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    inventory = json.loads(args.inventory.read_text(encoding="utf-8"))
    entries = [
        e for e in inventory.get("entries", [])
        if e.get("kind") == "file" and isinstance(e.get("name"), str) and PART_RE.match(e["name"])
    ]
    by_name = {e["name"]: e for e in entries}
    if sorted(by_name) != sorted(EXPECTED_NAMES) or len(entries) != 16:
        raise SystemExit(
            "FAIL-CLOSED: frozen OSF inventory does not contain exactly z01-z15 plus final zip; "
            f"found {sorted(by_name)}"
        )

    args.output_dir.mkdir(parents=True, exist_ok=True)
    workers = max(1, min(args.workers, 4))
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_one, by_name[name], args.output_dir): name for name in EXPECTED_NAMES}
        for future in concurrent.futures.as_completed(futures):
            name = futures[future]
            result = future.result()
            results.append(result)
            print(json.dumps({"verifiedSegment": name, "bytes": result["size"]}), flush=True)

    results.sort(key=lambda r: EXPECTED_NAMES.index(r["name"]))
    report = {
        "schema": "trackcade-semantic-external-split-download-verification-v1",
        "segmentCount": len(results),
        "totalBytes": sum(r["size"] for r in results),
        "segments": results,
    }
    args.verification_output.parent.mkdir(parents=True, exist_ok=True)
    args.verification_output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({"segmentCount": report["segmentCount"], "totalBytes": report["totalBytes"]}), flush=True)


if __name__ == "__main__":
    main()

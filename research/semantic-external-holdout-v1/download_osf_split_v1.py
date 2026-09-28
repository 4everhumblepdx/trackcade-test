#!/usr/bin/env python3
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import re
import shutil
import socket
import time
import urllib.error
import urllib.request
from pathlib import Path

USER_AGENT = "trackcade-semantic-external-holdout-v1/1.0"
BASE = "mp3s_soundcloud_cc_event_detection"
PART_RE = re.compile(rf"^{re.escape(BASE)}\.(?:z\d{{2}}|zip)$", re.IGNORECASE)
EXPECTED_NAMES = [f"{BASE}.z{i:02d}" for i in range(1, 16)] + [f"{BASE}.zip"]
RETRYABLE_HTTP = {403, 408, 425, 429, 500, 502, 503, 504}
MAX_ATTEMPTS = 6


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


def request(url: str):
    return urllib.request.Request(
        url,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "*/*",
            "Cache-Control": "no-cache",
        },
        method="GET",
    )


def refresh_download_url(entry: dict) -> str:
    """Refresh only transport metadata; frozen bytes/size/hash remain authoritative."""
    info = (entry.get("links") or {}).get("info")
    frozen_id = entry.get("id")
    if not isinstance(info, str) or not info or not isinstance(frozen_id, str) or not frozen_id:
        url = (entry.get("links") or {}).get("download")
        if not isinstance(url, str) or not url:
            raise RuntimeError(f"missing frozen download URL for {entry.get('name')}")
        return url
    try:
        with urllib.request.urlopen(request(info), timeout=60) as resp:
            payload = json.loads(resp.read().decode("utf-8"))
        data = payload.get("data") or {}
        if data.get("id") != frozen_id:
            raise RuntimeError(
                f"OSF file-detail identity changed for {entry.get('name')}: "
                f"expected {frozen_id!r}, got {data.get('id')!r}"
            )
        live = (data.get("links") or {}).get("download")
        if isinstance(live, str) and live:
            return live
    except Exception as exc:
        print(json.dumps({
            "transportMetadataRefreshWarning": entry.get("name"),
            "error": f"{type(exc).__name__}:{exc}",
        }), flush=True)
    url = (entry.get("links") or {}).get("download")
    if not isinstance(url, str) or not url:
        raise RuntimeError(f"missing frozen download URL for {entry.get('name')}")
    return url


def fetch_one(entry: dict, out_dir: Path) -> dict:
    name = entry["name"]
    dst = out_dir / name
    tmp = out_dir / f".{name}.partial"
    expected_size = entry.get("size")
    expected = expected_sha(entry)
    if not isinstance(expected_size, int) or expected_size <= 0:
        raise RuntimeError(f"missing/invalid frozen size for {name}")

    last_error = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        tmp.unlink(missing_ok=True)
        try:
            url = refresh_download_url(entry)
            with urllib.request.urlopen(request(url), timeout=900) as resp, tmp.open("wb") as f:
                if resp.status != 200:
                    raise RuntimeError(f"HTTP {resp.status} for {name}")
                shutil.copyfileobj(resp, f, length=1024 * 1024)
            size = tmp.stat().st_size
            if size != expected_size:
                raise RuntimeError(f"size mismatch for {name}: expected {expected_size}, got {size}")
            actual = sha256_file(tmp)
            if actual != expected:
                raise RuntimeError(f"SHA-256 mismatch for {name}: expected {expected}, got {actual}")
            tmp.replace(dst)
            return {"name": name, "size": size, "sha256": actual, "attempts": attempt}
        except urllib.error.HTTPError as exc:
            last_error = exc
            if exc.code not in RETRYABLE_HTTP or attempt == MAX_ATTEMPTS:
                raise RuntimeError(f"download failed for {name} on attempt {attempt}: HTTP {exc.code}") from exc
        except (urllib.error.URLError, TimeoutError, socket.timeout, ConnectionError) as exc:
            last_error = exc
            if attempt == MAX_ATTEMPTS:
                raise RuntimeError(
                    f"download transport failed for {name} after {attempt} attempts: {type(exc).__name__}:{exc}"
                ) from exc
        except RuntimeError as exc:
            # Size/hash mismatch can be a truncated transport response. Retry identical
            # frozen identity, but never accept bytes unless frozen size+SHA both match.
            last_error = exc
            if attempt == MAX_ATTEMPTS:
                raise

        delay = min(30, 2 ** attempt)
        print(json.dumps({
            "retrySegment": name,
            "attempt": attempt,
            "nextDelaySeconds": delay,
            "error": f"{type(last_error).__name__}:{last_error}",
        }), flush=True)
        time.sleep(delay)

    raise RuntimeError(f"unreachable retry exhaustion for {name}: {last_error}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--inventory", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--verification-output", type=Path, required=True)
    ap.add_argument("--workers", type=int, default=2)
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
    workers = max(1, min(args.workers, 2))
    results = []
    errors = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(fetch_one, by_name[name], args.output_dir): name for name in EXPECTED_NAMES}
        for future in concurrent.futures.as_completed(futures):
            name = futures[future]
            try:
                result = future.result()
            except Exception as exc:
                errors.append({"name": name, "error": f"{type(exc).__name__}:{exc}"})
                print(json.dumps({"segmentFailure": name, "error": errors[-1]["error"]}), flush=True)
                continue
            results.append(result)
            print(json.dumps({
                "verifiedSegment": name,
                "bytes": result["size"],
                "attempts": result["attempts"],
            }), flush=True)

    if errors:
        raise SystemExit("FAIL-CLOSED: one or more OSF split segments failed: " + json.dumps(errors, sort_keys=True))

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

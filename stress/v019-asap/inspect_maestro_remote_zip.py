#!/usr/bin/env python3
"""Inspect targeted MAESTRO v2 WAV entries through HTTP Range requests.

Uses Python's stdlib zipfile against a seekable HTTP range reader, so the 103 GB
archive itself is never downloaded. The script maps every source named by the
frozen ASAP holdout plan, reports exact compressed/uncompressed byte totals, and
fully streams the smallest eligible WAV as a transport/CRC smoke test.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import urllib.request
import wave
import zipfile
from pathlib import Path


class HTTPRangeReader(io.BufferedIOBase):
    def __init__(self, url: str, block_size: int = 8 * 1024 * 1024):
        self.url = url
        self.block_size = block_size
        req = urllib.request.Request(url, method="HEAD", headers={"User-Agent": "TrackcadeHoldout/1.0"})
        with urllib.request.urlopen(req, timeout=60) as r:
            self.size = int(r.headers["Content-Length"])
            self.accept_ranges = (r.headers.get("Accept-Ranges") or "").lower()
            self.etag = r.headers.get("ETag")
            self.last_modified = r.headers.get("Last-Modified")
        if "bytes" not in self.accept_ranges:
            raise RuntimeError(f"server does not advertise byte ranges: {self.accept_ranges!r}")
        self.pos = 0
        self.cache_start = -1
        self.cache = b""
        self.range_requests = 0
        self.range_bytes = 0

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.pos

    def seek(self, offset, whence=io.SEEK_SET):
        if whence == io.SEEK_SET:
            target = offset
        elif whence == io.SEEK_CUR:
            target = self.pos + offset
        elif whence == io.SEEK_END:
            target = self.size + offset
        else:
            raise ValueError(f"invalid whence {whence}")
        if target < 0:
            raise ValueError("negative seek")
        self.pos = min(target, self.size)
        return self.pos

    def _fetch(self, start: int, minimum: int):
        fetch_len = max(self.block_size, minimum)
        end = min(self.size - 1, start + fetch_len - 1)
        req = urllib.request.Request(
            self.url,
            headers={"Range": f"bytes={start}-{end}", "User-Agent": "TrackcadeHoldout/1.0"},
        )
        with urllib.request.urlopen(req, timeout=120) as r:
            status = getattr(r, "status", None)
            if status != 206:
                raise RuntimeError(f"expected HTTP 206, got {status}")
            data = r.read()
            content_range = r.headers.get("Content-Range") or ""
        expected = end - start + 1
        if len(data) != expected:
            raise RuntimeError(f"range length mismatch {len(data)} != {expected} for {start}-{end}")
        if not content_range.startswith(f"bytes {start}-{end}/"):
            raise RuntimeError(f"unexpected Content-Range: {content_range!r}")
        self.cache_start = start
        self.cache = data
        self.range_requests += 1
        self.range_bytes += len(data)

    def read(self, size=-1):
        if self.pos >= self.size:
            return b""
        if size is None or size < 0:
            size = self.size - self.pos
        size = min(size, self.size - self.pos)
        if size <= 0:
            return b""
        out = bytearray()
        remaining = size
        while remaining:
            cache_end = self.cache_start + len(self.cache)
            if not (self.cache_start <= self.pos < cache_end):
                self._fetch(self.pos, min(remaining, self.block_size))
                cache_end = self.cache_start + len(self.cache)
            offset = self.pos - self.cache_start
            take = min(remaining, cache_end - self.pos)
            out += self.cache[offset:offset + take]
            self.pos += take
            remaining -= take
        return bytes(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--zip-url", required=True)
    ap.add_argument("--eligible-json", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--plan-run-id", required=True)
    ap.add_argument("--plan-artifact-id", required=True)
    args = ap.parse_args()
    args.output.mkdir(parents=True, exist_ok=True)

    eligible = json.loads(args.eligible_json.read_text())
    sources = sorted({r["maestro_audio_filename"] for r in eligible})
    if len(eligible) != 100 or len(sources) != 98:
        raise SystemExit(f"FAIL-CLOSED: frozen plan expected 100 performances/98 sources, got {len(eligible)}/{len(sources)}")

    remote = HTTPRangeReader(args.zip_url)
    with zipfile.ZipFile(remote, "r") as zf:
        infos = zf.infolist()
        by_source = {}
        missing = []
        ambiguous = []
        for source in sources:
            matches = [i for i in infos if i.filename == source or i.filename.endswith("/" + source)]
            if not matches:
                missing.append(source)
            elif len(matches) > 1:
                ambiguous.append({"source": source, "matches": [m.filename for m in matches]})
            else:
                by_source[source] = matches[0]

        if missing or ambiguous:
            (args.output / "mapping_failures.json").write_text(json.dumps({"missing": missing, "ambiguous": ambiguous}, indent=2) + "\n")
            raise SystemExit(f"FAIL-CLOSED: ZIP mapping failures missing={len(missing)} ambiguous={len(ambiguous)}")

        mapped = []
        for source in sources:
            info = by_source[source]
            mapped.append({
                "source": source,
                "zip_member": info.filename,
                "compress_type": info.compress_type,
                "compressed_bytes": info.compress_size,
                "uncompressed_bytes": info.file_size,
                "crc32": f"{info.CRC:08x}",
            })

        smoke = min(mapped, key=lambda x: (x["compressed_bytes"], x["source"]))
        smoke_info = by_source[smoke["source"]]
        smoke_path = args.output / "smoke.wav"
        h = hashlib.sha256()
        written = 0
        with zf.open(smoke_info, "r") as src, smoke_path.open("wb") as dst:
            while True:
                chunk = src.read(1024 * 1024)
                if not chunk:
                    break
                h.update(chunk)
                dst.write(chunk)
                written += len(chunk)
        if written != smoke_info.file_size:
            raise SystemExit(f"FAIL-CLOSED: smoke extraction size {written} != {smoke_info.file_size}")

    with wave.open(str(smoke_path), "rb") as wf:
        wav = {
            "channels": wf.getnchannels(),
            "sample_width_bytes": wf.getsampwidth(),
            "sample_rate": wf.getframerate(),
            "frames": wf.getnframes(),
            "duration_s": wf.getnframes() / wf.getframerate(),
        }
    smoke_path.unlink(missing_ok=True)

    compressed_total = sum(x["compressed_bytes"] for x in mapped)
    uncompressed_total = sum(x["uncompressed_bytes"] for x in mapped)
    summary = {
        "corpus": "MAESTRO v2 remote ZIP mapping for frozen ASAP pure-three-beat holdout",
        "zip_url": args.zip_url,
        "zip_content_length": remote.size,
        "zip_accept_ranges": remote.accept_ranges,
        "zip_etag": remote.etag,
        "zip_last_modified": remote.last_modified,
        "zip_entries": len(infos),
        "plan_run_id": int(args.plan_run_id),
        "plan_artifact_id": int(args.plan_artifact_id),
        "planned_performances": len(eligible),
        "planned_unique_sources": len(sources),
        "mapped_unique_sources": len(mapped),
        "mapping_missing": 0,
        "mapping_ambiguous": 0,
        "source_compressed_bytes_total": compressed_total,
        "source_uncompressed_bytes_total": uncompressed_total,
        "source_compressed_gb_total": compressed_total / 1_000_000_000,
        "source_uncompressed_gb_total": uncompressed_total / 1_000_000_000,
        "zip_compression_ratio_for_sources": (compressed_total / uncompressed_total) if uncompressed_total else None,
        "smoke_source": smoke["source"],
        "smoke_zip_member": smoke["zip_member"],
        "smoke_compressed_bytes": smoke["compressed_bytes"],
        "smoke_uncompressed_bytes": smoke["uncompressed_bytes"],
        "smoke_sha256": h.hexdigest(),
        "smoke_wav": wav,
        "http_range_requests_including_smoke": remote.range_requests,
        "http_range_bytes_fetched_including_smoke": remote.range_bytes,
    }
    (args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n")
    (args.output / "mapped_sources.json").write_text(json.dumps(mapped, indent=2) + "\n")
    (args.output / "mapping_failures.json").write_text(json.dumps({"missing": [], "ambiguous": []}, indent=2) + "\n")
    print(json.dumps(summary, indent=2))

    if len(mapped) != 98:
        raise SystemExit(f"FAIL-CLOSED: expected 98 mapped sources, got {len(mapped)}")
    if remote.size != 109945081707:
        raise SystemExit(f"FAIL-CLOSED: MAESTRO v2 ZIP length drift {remote.size}")
    if wav["channels"] != 2 or wav["sample_width_bytes"] != 2:
        raise SystemExit(f"FAIL-CLOSED: unexpected smoke WAV format {wav}")


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import struct
import urllib.request
import zlib
from pathlib import Path

SCHEMA = "trackcade-semantic-external-split-zip-index-v1"
USER_AGENT = "trackcade-semantic-external-holdout-v1/1.0"
EOCD_SIG = b"PK\x05\x06"
CD_SIG = b"PK\x01\x02"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def load_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def download(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT}, method="GET")
    with urllib.request.urlopen(req, timeout=120) as resp:
        if resp.status != 200:
            raise RuntimeError(f"HTTP {resp.status} for {url}")
        return resp.read()


def expected_sha(entry: dict) -> str:
    hashes = ((entry.get("extra") or {}).get("hashes") or {})
    value = hashes.get("sha256")
    if not isinstance(value, str) or len(value) != 64:
        raise RuntimeError(f"missing SHA-256 for {entry.get('path')}")
    return value.lower()


def download_verified(entry: dict) -> bytes:
    url = (entry.get("links") or {}).get("download")
    if not isinstance(url, str) or not url:
        raise RuntimeError(f"missing download URL for {entry.get('path')}")
    data = download(url)
    actual = sha256_bytes(data)
    expected = expected_sha(entry)
    if actual != expected:
        raise RuntimeError(
            f"SHA-256 mismatch for {entry.get('path')}: expected {expected}, got {actual}"
        )
    expected_size = entry.get("size")
    if isinstance(expected_size, int) and len(data) != expected_size:
        raise RuntimeError(
            f"size mismatch for {entry.get('path')}: expected {expected_size}, got {len(data)}"
        )
    return data


def find_entry(inventory: dict, name: str) -> dict:
    matches = [e for e in inventory.get("entries", []) if e.get("kind") == "file" and e.get("name") == name]
    if len(matches) != 1:
        raise RuntimeError(f"expected exactly one inventory entry named {name!r}, got {len(matches)}")
    return matches[0]


def parse_eocd(data: bytes):
    # EOCD must begin within final 65,557 bytes (22-byte fixed record + max 65,535 comment).
    start = max(0, len(data) - 65557)
    pos = data.rfind(EOCD_SIG, start)
    if pos < 0:
        raise RuntimeError("ZIP EOCD signature not found in final segment")
    if pos + 22 > len(data):
        raise RuntimeError("truncated ZIP EOCD")
    fields = struct.unpack_from("<4s4H2LH", data, pos)
    _, disk_no, cd_start_disk, entries_disk, entries_total, cd_size, cd_offset, comment_len = fields
    if pos + 22 + comment_len > len(data):
        raise RuntimeError("truncated ZIP EOCD comment")
    return {
        "eocdOffsetInFinalSegment": pos,
        "diskNumber": disk_no,
        "centralDirectoryStartDisk": cd_start_disk,
        "entriesOnFinalDisk": entries_disk,
        "totalEntries": entries_total,
        "centralDirectorySize": cd_size,
        "centralDirectoryOffsetOnStartDisk": cd_offset,
        "commentLength": comment_len,
    }


def decode_name(raw: bytes, flags: int) -> str:
    if flags & 0x800:
        return raw.decode("utf-8")
    return raw.decode("cp437")


def parse_central_directory(data: bytes, eocd: dict):
    disk_no = eocd["diskNumber"]
    start_disk = eocd["centralDirectoryStartDisk"]
    if start_disk != disk_no:
        raise RuntimeError(
            "central directory begins on an earlier split disk; final segment alone is insufficient"
        )
    pos = eocd["centralDirectoryOffsetOnStartDisk"]
    end = pos + eocd["centralDirectorySize"]
    if not (0 <= pos <= end <= len(data)):
        raise RuntimeError(
            f"central directory bounds outside final segment: start={pos} end={end} size={len(data)}"
        )

    entries = []
    for index in range(eocd["totalEntries"]):
        if pos + 46 > end or data[pos:pos + 4] != CD_SIG:
            raise RuntimeError(f"invalid central directory header at entry {index}, offset {pos}")
        fields = struct.unpack_from("<4s6H3L5H2L", data, pos)
        flags = fields[3]
        method = fields[4]
        crc32 = fields[7]
        compressed = fields[8]
        uncompressed = fields[9]
        name_len = fields[10]
        extra_len = fields[11]
        comment_len = fields[12]
        disk_start = fields[13]
        external_attrs = fields[15]
        local_offset = fields[16]
        fixed_end = pos + 46
        name_end = fixed_end + name_len
        extra_end = name_end + extra_len
        comment_end = extra_end + comment_len
        if comment_end > end:
            raise RuntimeError(f"central directory entry {index} exceeds declared bounds")
        raw_name = data[fixed_end:name_end]
        name = decode_name(raw_name, flags)
        entries.append({
            "index": index,
            "name": name,
            "flags": flags,
            "compressionMethod": method,
            "crc32": f"{crc32:08x}",
            "compressedSize": compressed,
            "uncompressedSize": uncompressed,
            "diskStart": disk_start,
            "localHeaderOffsetOnDisk": local_offset,
            "externalAttributes": external_attrs,
        })
        pos = comment_end

    if pos != end:
        trailing = end - pos
        raise RuntimeError(f"central directory parser ended with {trailing} unparsed bytes")
    return entries


def classify(entries):
    audio_exts = {".mp3", ".wav", ".flac", ".m4a", ".ogg", ".aac"}
    annotation_exts = {".csv", ".tsv", ".txt", ".json", ".xml", ".mat", ".arff"}
    audio = []
    annotations = []
    for entry in entries:
        suffix = Path(entry["name"]).suffix.lower()
        if suffix in audio_exts:
            audio.append(entry["name"])
        if suffix in annotation_exts:
            annotations.append(entry["name"])
    return audio, annotations


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--inventory", type=Path, required=True)
    ap.add_argument("--readme-output", type=Path, required=True)
    ap.add_argument("--index-output", type=Path, required=True)
    args = ap.parse_args()

    inventory_bytes = args.inventory.read_bytes()
    inventory = json.loads(inventory_bytes.decode("utf-8"))
    readme_entry = find_entry(inventory, "readme.txt")
    final_entry = find_entry(inventory, "mp3s_soundcloud_cc_event_detection.zip")

    readme = download_verified(readme_entry)
    final_segment = download_verified(final_entry)
    eocd = parse_eocd(final_segment)
    entries = parse_central_directory(final_segment, eocd)
    audio, annotations = classify(entries)

    args.readme_output.parent.mkdir(parents=True, exist_ok=True)
    args.readme_output.write_bytes(readme)

    report = {
        "schema": SCHEMA,
        "sourceInventorySha256": sha256_bytes(inventory_bytes),
        "readme": {
            "osfPath": readme_entry["path"],
            "sha256": sha256_bytes(readme),
            "size": len(readme),
        },
        "finalZipSegment": {
            "osfPath": final_entry["path"],
            "sha256": sha256_bytes(final_segment),
            "size": len(final_segment),
        },
        "eocd": eocd,
        "summary": {
            "entryCount": len(entries),
            "audioEntryCount": len(audio),
            "annotationCandidateCountByExtension": len(annotations),
        },
        "audioEntries": audio,
        "annotationCandidates": annotations,
        "entries": entries,
    }
    args.index_output.parent.mkdir(parents=True, exist_ok=True)
    args.index_output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], indent=2, sort_keys=True))
    print(json.dumps(eocd, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

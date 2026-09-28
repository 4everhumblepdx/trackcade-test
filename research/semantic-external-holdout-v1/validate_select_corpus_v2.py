#!/usr/bin/env python3
from __future__ import annotations

import argparse
import concurrent.futures
import hashlib
import json
import math
import subprocess
from pathlib import Path

import numpy as np
from scipy.io import loadmat

SCHEMA_ELIGIBILITY = "trackcade-semantic-external-corpus-eligibility-v2"
SCHEMA_SPLIT = "trackcade-semantic-external-split-v2"
SCHEMA_REFERENCES = "trackcade-semantic-external-drop-references-v2"
EXPECTED_TRACKS = 402
EXPECTED_COUNTS = {"drop": 435, "build": 596, "break": 372}
EXPERT_KEYS = ("build_start", "build_end", "drop", "break_start", "break_end")


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for block in iter(lambda: f.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def parse_timestamp_array(value, name: str) -> tuple[list[float], int]:
    """Parse expert timestamps and remove the dataset's observed zero sentinel.

    The frozen README describes positive event timestamps, while the pre-model MAT
    audit demonstrated files whose empty expert arrays are serialized as [0].
    Zero is therefore treated as an empty-value sentinel, not an event. This
    interpretation is accepted only if full-corpus aggregate counts reproduce the
    independently published dataset totals exactly.
    """
    if value is None:
        return [], 0
    arr = np.asarray(value)
    if arr.size == 0:
        return [], 0
    try:
        vals = [float(x) for x in arr.reshape(-1)]
    except Exception as exc:
        raise ValueError(f"{name} is not a flat numeric array: {exc}") from exc
    for value in vals:
        if not math.isfinite(value) or value < 0:
            raise ValueError(f"{name} contains non-finite/negative timestamp {value!r}")
    zero_count = sum(1 for value in vals if value == 0.0)
    positive = sorted(value for value in vals if value > 0.0)
    return positive, zero_count


def parse_annotation(path: Path) -> tuple[dict, dict]:
    raw = loadmat(path, squeeze_me=True, struct_as_record=False)
    events = {}
    zero_sentinels = {}
    for key in EXPERT_KEYS:
        events[key], zero_sentinels[key] = parse_timestamp_array(raw.get(key), key)

    if len(events["build_start"]) != len(events["build_end"]):
        raise ValueError("build_start/build_end length mismatch after zero-sentinel removal")
    if len(events["break_start"]) != len(events["break_end"]):
        raise ValueError("break_start/break_end length mismatch after zero-sentinel removal")
    if any(end < start for start, end in zip(events["build_start"], events["build_end"])):
        raise ValueError("build interval has end before start")
    if any(end < start for start, end in zip(events["break_start"], events["break_end"])):
        raise ValueError("break interval has end before start")
    return events, zero_sentinels


def probe_and_decode(path: Path) -> dict:
    probe = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "a:0",
            "-show_entries", "stream=sample_rate:format=duration", "-of", "json", str(path),
        ],
        text=True, capture_output=True, timeout=60,
    )
    if probe.returncode:
        raise RuntimeError((probe.stderr or probe.stdout)[-1500:])
    parsed = json.loads(probe.stdout)
    streams = parsed.get("streams") or []
    if len(streams) != 1:
        raise RuntimeError(f"expected exactly one selected audio stream, got {len(streams)}")
    sample_rate = int(streams[0].get("sample_rate") or 0)
    duration = float((parsed.get("format") or {}).get("duration") or 0)
    if sample_rate <= 0 or not math.isfinite(duration) or duration <= 0:
        raise RuntimeError(f"invalid sample rate/duration: {sample_rate}, {duration}")

    decode = subprocess.run(
        [
            "ffmpeg", "-v", "error", "-nostdin", "-i", str(path),
            "-ac", "1", "-ar", str(sample_rate), "-f", "f32le",
            "-acodec", "pcm_f32le", "-",
        ],
        stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=240,
    )
    if decode.returncode:
        err = decode.stderr.decode("utf-8", errors="replace") if isinstance(decode.stderr, bytes) else str(decode.stderr)
        raise RuntimeError(err[-1500:])
    return {"sampleRate": sample_rate, "durationSeconds": round(duration, 6)}


def validate_one(pair: dict, corpus_root: Path, burned_hashes: set[str]) -> dict:
    audio = corpus_root / pair["audioPath"]
    ann = corpus_root / pair["annotationPath"]
    row = {
        "id": pair["id"],
        "stem": pair["stem"],
        "audioPath": pair["audioPath"],
        "annotationPath": pair["annotationPath"],
        "selectionHash": pair["selectionHash"],
        "annotationParsed": False,
        "eligible": False,
        "ineligibilityReason": None,
    }
    try:
        if not audio.is_file():
            raise FileNotFoundError(f"audio-not-found:{pair['audioPath']}")
        if not ann.is_file():
            raise FileNotFoundError(f"annotation-not-found:{pair['annotationPath']}")

        row["audioSha256"] = sha256_file(audio)
        row["annotationSha256"] = sha256_file(ann)

        events, zero_sentinels = parse_annotation(ann)
        row["annotationParsed"] = True
        row["expertEventCounts"] = {
            "build": len(events["build_start"]),
            "drop": len(events["drop"]),
            "break": len(events["break_start"]),
        }
        row["zeroSentinelCounts"] = zero_sentinels
        row["dropReferences"] = events["drop"]

        if row["audioSha256"] in burned_hashes:
            row["ineligibilityReason"] = "burned-semantic-development-audio-sha256"
            return row

        row.update(probe_and_decode(audio))
        row["eligible"] = True
        return row
    except Exception as exc:
        row["ineligibilityReason"] = f"pre-model-validation-failure:{type(exc).__name__}:{str(exc)[:1000]}"
        return row


def exact_extracted_files(index: dict) -> set[str]:
    return {
        e["name"] for e in index.get("entries", [])
        if isinstance(e, dict) and not str(e.get("name", "")).endswith("/")
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--pairs", type=Path, required=True)
    ap.add_argument("--index", type=Path, required=True)
    ap.add_argument("--corpus-root", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--burned-audio", type=Path, action="append", default=[])
    ap.add_argument("--workers", type=int, default=4)
    args = ap.parse_args()

    pairs_bytes = args.pairs.read_bytes()
    index_bytes = args.index.read_bytes()
    pairs_doc = json.loads(pairs_bytes.decode("utf-8"))
    index_doc = json.loads(index_bytes.decode("utf-8"))
    pairs = pairs_doc.get("pairs") or []
    if len(pairs) != EXPECTED_TRACKS:
        raise SystemExit(f"FAIL-CLOSED: expected {EXPECTED_TRACKS} frozen pairs, got {len(pairs)}")

    expected_files = exact_extracted_files(index_doc)
    actual_files = {
        p.relative_to(args.corpus_root).as_posix()
        for p in args.corpus_root.rglob("*") if p.is_file()
    }
    if actual_files != expected_files:
        missing = sorted(expected_files - actual_files)
        extra = sorted(actual_files - expected_files)
        raise SystemExit(
            "FAIL-CLOSED: extracted split ZIP file set differs from frozen central directory: "
            + json.dumps({"missing": missing[:50], "extra": extra[:50], "missingCount": len(missing), "extraCount": len(extra)})
        )

    burned = {}
    for path in args.burned_audio:
        if not path.is_file():
            raise SystemExit(f"FAIL-CLOSED: burned reference audio missing: {path}")
        burned[path.name] = sha256_file(path)
    burned_hashes = set(burned.values())

    rows = []
    workers = max(1, min(args.workers, 4))
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = {pool.submit(validate_one, pair, args.corpus_root, burned_hashes): pair["id"] for pair in pairs}
        for n, future in enumerate(concurrent.futures.as_completed(futures), 1):
            row = future.result()
            rows.append(row)
            if n % 25 == 0 or not row["eligible"]:
                print(json.dumps({"validated": n, "id": row["id"], "eligible": row["eligible"], "reason": row["ineligibilityReason"]}), flush=True)

    rows.sort(key=lambda r: r["id"])
    annotation_parsed = [r for r in rows if r.get("annotationParsed")]
    if len(annotation_parsed) != EXPECTED_TRACKS:
        failures = [
            {"id": r["id"], "reason": r["ineligibilityReason"]}
            for r in rows if not r.get("annotationParsed")
        ]
        raise SystemExit(
            f"FAIL-CLOSED: expert annotations parsed for only {len(annotation_parsed)}/{EXPECTED_TRACKS} tracks: "
            + json.dumps(failures[:20], sort_keys=True)
        )

    aggregate_counts = {
        kind: sum(r["expertEventCounts"][kind] for r in annotation_parsed)
        for kind in ("drop", "build", "break")
    }
    if aggregate_counts != EXPECTED_COUNTS:
        raise SystemExit(
            "FAIL-CLOSED: zero-sentinel-corrected expert counts do not reproduce published corpus totals: "
            + json.dumps({"parsed": aggregate_counts, "expected": EXPECTED_COUNTS}, sort_keys=True)
        )

    zero_sentinel_totals = {
        key: sum(r["zeroSentinelCounts"][key] for r in annotation_parsed)
        for key in EXPERT_KEYS
    }

    eligible = [r for r in rows if r["eligible"]]
    ineligible = [r for r in rows if not r["eligible"]]
    if len(eligible) < 100:
        raise SystemExit(f"FAIL-CLOSED: only {len(eligible)} tracks eligible; need at least 100")

    ordered = sorted(eligible, key=lambda r: (r["selectionHash"], r["id"]))
    stage1_rows = ordered[:50]
    terminal_rows = ordered[50:100]
    if set(r["id"] for r in stage1_rows) & set(r["id"] for r in terminal_rows):
        raise SystemExit("FAIL-CLOSED: Stage 1 / terminal split overlap")

    def split_identity(r: dict) -> dict:
        return {
            "id": r["id"],
            "stem": r["stem"],
            "audioPath": r["audioPath"],
            "annotationPath": r["annotationPath"],
            "selectionHash": r["selectionHash"],
            "audioSha256": r["audioSha256"],
            "annotationSha256": r["annotationSha256"],
            "sampleRate": r["sampleRate"],
            "durationSeconds": r["durationSeconds"],
        }

    references = {
        "schema": SCHEMA_REFERENCES,
        "status": "frozen-before-any-model-output-on-corpus",
        "warning": "Evaluation labels only. Semantic-model workflows must not read this file.",
        "eventKind": "drop",
        "zeroTimestampPolicy": "exact 0 values are dataset empty-value sentinels, established pre-model and full-corpus-count-validated",
        "stage1": [{"id": r["id"], "dropsSeconds": r["dropReferences"]} for r in stage1_rows],
        "terminal": [{"id": r["id"], "dropsSeconds": r["dropReferences"]} for r in terminal_rows],
    }

    eligibility_rows = []
    for r in rows:
        clean = {k: v for k, v in r.items() if k != "dropReferences"}
        eligibility_rows.append(clean)

    eligibility_doc = {
        "schema": SCHEMA_ELIGIBILITY,
        "status": "frozen-before-any-model-output-on-corpus",
        "supersedes": {
            "schema": "trackcade-semantic-external-corpus-eligibility-v1",
            "reason": "V1 counted MAT zero empty-value sentinels as expert events; defect discovered before any model output on this corpus",
        },
        "sourceCandidatePairsSha256": hashlib.sha256(pairs_bytes).hexdigest(),
        "sourceSplitZipIndexSha256": hashlib.sha256(index_bytes).hexdigest(),
        "burnedSemanticDevelopmentAudioSha256": burned,
        "eligibilityRule": "mechanical pair + corrected expert MAT parse + exact source hash not burned + frozen Analyzer media decode path",
        "zeroTimestampPolicy": "filter exact zero sentinels; accept interpretation only because all 402 expert annotations reproduce published event totals exactly",
        "summary": {
            "candidateTracks": len(rows),
            "annotationParsedTracks": len(annotation_parsed),
            "eligibleTracks": len(eligible),
            "ineligibleTracks": len(ineligible),
            "expertEventCountsAll402": aggregate_counts,
            "publishedExpertEventCounts": EXPECTED_COUNTS,
            "zeroSentinelTotals": zero_sentinel_totals,
        },
        "tracks": eligibility_rows,
    }
    split_doc = {
        "schema": SCHEMA_SPLIT,
        "status": "frozen-before-any-model-output-on-corpus",
        "supersedes": {
            "schema": "trackcade-semantic-external-split-v1",
            "reason": "V1 reference parser defect discovered pre-model; V2 is the only valid benchmark split/reference identity",
        },
        "selectionRule": "eligible tracks sorted ascending by (selectionHash,id); first 50 Stage 1, next 50 terminal",
        "stage1": [split_identity(r) for r in stage1_rows],
        "terminal": [split_identity(r) for r in terminal_rows],
        "summary": {
            "stage1Tracks": len(stage1_rows),
            "terminalTracks": len(terminal_rows),
            "stage1ReferenceDrops": sum(len(r["dropReferences"]) for r in stage1_rows),
            "terminalReferenceDrops": sum(len(r["dropReferences"]) for r in terminal_rows),
        },
    }

    args.output_dir.mkdir(parents=True, exist_ok=True)
    outputs = {
        "CORPUS_ELIGIBILITY_V2.json": eligibility_doc,
        "SPLIT_V2.json": split_doc,
        "REFERENCE_DROPS_V2.json": references,
    }
    for name, doc in outputs.items():
        path = args.output_dir / name
        path.write_text(json.dumps(doc, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        (args.output_dir / f"{name}.sha256").write_text(f"{sha256_file(path)}  {name}\n", encoding="utf-8")

    print(json.dumps({
        "annotationParsedTracks": len(annotation_parsed),
        "eligibleTracks": len(eligible),
        "ineligibleTracks": len(ineligible),
        "expertEventCountsAll402": aggregate_counts,
        "zeroSentinelTotals": zero_sentinel_totals,
        "stage1Tracks": len(stage1_rows),
        "stage1Drops": split_doc["summary"]["stage1ReferenceDrops"],
        "terminalTracks": len(terminal_rows),
        "terminalDrops": split_doc["summary"]["terminalReferenceDrops"],
    }, sort_keys=True), flush=True)


if __name__ == "__main__":
    main()

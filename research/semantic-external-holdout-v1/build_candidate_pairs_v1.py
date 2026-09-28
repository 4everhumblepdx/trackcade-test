#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

SCHEMA = "trackcade-semantic-external-candidate-pairs-v1"
SELECTION_SEED = "trackcade-semantic-external-holdout-v1\n"
EXPECTED_TRACKS = 402
ROOT = "mp3s_soundcloud_cc_event_detection/"


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def selection_hash(canonical_audio_path: str) -> str:
    return hashlib.sha256((SELECTION_SEED + canonical_audio_path).encode("utf-8")).hexdigest()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    args = ap.parse_args()

    raw = args.index.read_bytes()
    index = json.loads(raw.decode("utf-8"))
    audio = index.get("audioEntries")
    anns = index.get("annotationCandidates")
    if not isinstance(audio, list) or not isinstance(anns, list):
        raise SystemExit("FAIL-CLOSED: index missing audioEntries/annotationCandidates arrays")
    if len(audio) != EXPECTED_TRACKS or len(anns) != EXPECTED_TRACKS:
        raise SystemExit(f"FAIL-CLOSED: expected {EXPECTED_TRACKS} audio and annotations, got {len(audio)} / {len(anns)}")

    audio_set = set(audio)
    ann_set = set(anns)
    if len(audio_set) != len(audio) or len(ann_set) != len(anns):
        raise SystemExit("FAIL-CLOSED: duplicate paths in central-directory index")

    pairs = []
    missing = []
    for audio_path in sorted(audio):
        if not isinstance(audio_path, str) or not audio_path.startswith(ROOT) or not audio_path.endswith(".mp3"):
            raise SystemExit(f"FAIL-CLOSED: unexpected audio path {audio_path!r}")
        stem = Path(audio_path).stem
        ann_path = str(Path(audio_path).with_suffix(".mat")).replace("\\", "/")
        if ann_path not in ann_set:
            missing.append({"audioPath": audio_path, "expectedAnnotationPath": ann_path})
            continue
        pairs.append({
            "id": audio_path,
            "stem": stem,
            "audioPath": audio_path,
            "annotationPath": ann_path,
            "selectionHash": selection_hash(audio_path),
        })

    orphan_annotations = sorted(
        p for p in ann_set if str(Path(p).with_suffix(".mp3")).replace("\\", "/") not in audio_set
    )
    if missing or orphan_annotations:
        raise SystemExit(
            "FAIL-CLOSED: one-to-one MP3/MAT pairing failed: "
            + json.dumps({"missing": missing, "orphanAnnotations": orphan_annotations}, sort_keys=True)
        )
    if len(pairs) != EXPECTED_TRACKS:
        raise SystemExit(f"FAIL-CLOSED: expected {EXPECTED_TRACKS} pairs, got {len(pairs)}")

    ids = [p["id"] for p in pairs]
    stems = [p["stem"] for p in pairs]
    hashes = [p["selectionHash"] for p in pairs]
    if len(ids) != len(set(ids)) or len(stems) != len(set(stems)) or len(hashes) != len(set(hashes)):
        raise SystemExit("FAIL-CLOSED: candidate IDs, stems, or selection hashes are not unique")

    report = {
        "schema": SCHEMA,
        "status": "frozen-before-corpus-eligibility-and-before-model-output",
        "sourceSplitZipIndexSha256": sha256_bytes(raw),
        "selectionSeedUtf8": SELECTION_SEED,
        "selectionRule": "SHA256(selectionSeedUtf8 + canonical OSF-relative audio path); eligible tracks later sort by (selectionHash,id)",
        "summary": {
            "candidateTrackCount": len(pairs),
            "pairedAudioCount": len(pairs),
            "pairedAnnotationCount": len(pairs),
        },
        "pairs": pairs,
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], sort_keys=True))


if __name__ == "__main__":
    main()

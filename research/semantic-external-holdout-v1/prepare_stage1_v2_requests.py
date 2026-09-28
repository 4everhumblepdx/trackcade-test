#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import subprocess
import sys
from pathlib import Path

MODEL = "gpt-6-sol"
REASONING_EFFORT = "high"
MAX_OUTPUT_TOKENS = 4096
ANALYZER_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"
ANALYZER_SOURCE_COMMIT = "e308d867980fb1877c3f2e4ce27950deecac0855"


def fail(msg: str) -> None:
    raise SystemExit(f"FAIL-CLOSED: {msg}")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def copy_exact(src: Path, dst: Path, expected_sha: str) -> str:
    if not src.is_file() or sha(src) != expected_sha:
        fail(f"source identity mismatch: {src.name}")
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
    actual = sha(dst)
    if actual != expected_sha:
        fail(f"copy identity mismatch: {dst.name}")
    return actual


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-prep-root", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--builder", type=Path, required=True)
    ap.add_argument("--adapter", type=Path, required=True)
    args = ap.parse_args()

    base_manifest_path = args.base_prep_root / "STAGE1_PREP_MANIFEST_V1.json"
    base = load(base_manifest_path)
    if base.get("schema") != "trackcade-semantic-external-stage1-prep-v1":
        fail("base prep schema mismatch")
    if base.get("status") != "frozen-provider-payloads-prepared-no-provider-call":
        fail("base prep status mismatch")
    if base.get("trackCount") != 50 or len(base.get("tracks") or []) != 50:
        fail("base prep does not contain exactly 50 tracks")
    if base.get("referenceLabelsReadByPreparation") is not False or base.get("terminalTracksProcessed") is not False:
        fail("base prep violates label-blind/terminal boundary")

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    rows_out = []

    for row in sorted(base["tracks"], key=lambda x: x["ordinal"]):
        ordinal = row["ordinal"]
        if not isinstance(ordinal, int) or not 1 <= ordinal <= 50:
            fail("invalid ordinal in base prep")
        if row.get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256 or row.get("analyzerSourceCommit") != ANALYZER_SOURCE_COMMIT:
            fail(f"Analyzer identity mismatch ordinal {ordinal}")
        if row.get("compilerEligible") is not True or row.get("timingTier") not in {"standard", "loose"}:
            fail(f"Stage 1 base case is not compiler eligible ordinal {ordinal}")

        stem = row["stem"]
        src = args.base_prep_root / "cases" / f"{ordinal:02d}-{stem}"
        dst = out / "cases" / f"{ordinal:02d}-{stem}"
        dst.mkdir(parents=True, exist_ok=True)

        packet_sha = copy_exact(src / "interpretation-packet-v1.json", dst / "interpretation-packet-v1.json", row["hashes"]["interpretationPacketSha256"])
        evidence_sha = copy_exact(src / "structure-evidence-v1.json", dst / "structure-evidence-v1.json", row["hashes"]["structureEvidenceSha256"])
        safe_sha = copy_exact(src / "trackcade-safe-v1.json", dst / "trackcade-safe-v1.json", row["hashes"]["safeManifestSha256"])

        request = dst / "learned-request-v2.json"
        payload = dst / "openai-payload-v2.json"
        report = dst / "openai-adapter-prepare-report-v2.json"
        run([sys.executable, str(args.builder), "--packet", str(dst / "interpretation-packet-v1.json"), "--output", str(request)])
        run([
            sys.executable, str(args.adapter),
            "--request", str(request),
            "--packet", str(dst / "interpretation-packet-v1.json"),
            "--model", MODEL,
            "--reasoning-effort", REASONING_EFFORT,
            "--max-output-tokens", str(MAX_OUTPUT_TOKENS),
            "--payload-output", str(payload),
            "--adapter-report-output", str(report),
            "--prepare-only",
        ])

        prepare_report = load(report)
        if prepare_report.get("status") != "payload_prepared_no_provider_call":
            fail(f"adapter prep status mismatch ordinal {ordinal}")
        if prepare_report.get("requestedModel") != MODEL or prepare_report.get("reasoningEffort") != REASONING_EFFORT:
            fail(f"adapter model contract mismatch ordinal {ordinal}")
        if prepare_report.get("maxOutputTokens") != MAX_OUTPUT_TOKENS or prepare_report.get("store") is not False:
            fail(f"adapter output/store contract mismatch ordinal {ordinal}")

        for p in (dst / "interpretation-packet-v1.json", request, payload):
            lowered = p.read_text(encoding="utf-8").lower()
            for token in ('reference_drops', '"dropsseconds"', '"diagnosticlabelhint"', '"diagnostictypehint"'):
                if token in lowered:
                    fail(f"benchmark/diagnostic leakage token {token} ordinal {ordinal} in {p.name}")

        req = load(request)
        if (req.get("integrity") or {}).get("developmentRevision") != "stage1-drop-semantics-v2":
            fail(f"V2 request revision marker missing ordinal {ordinal}")
        if (req.get("integrity") or {}).get("packetSha256") != packet_sha:
            fail(f"V2 request packet identity mismatch ordinal {ordinal}")

        rows_out.append({
            "ordinal": ordinal,
            "id": row["id"],
            "stem": stem,
            "timingTier": row["timingTier"],
            "compilerEligible": True,
            "analysisJsonSha256": row["analysisJsonSha256"],
            "analyzerRunnerSha256": ANALYZER_RUNNER_SHA256,
            "analyzerSourceCommit": ANALYZER_SOURCE_COMMIT,
            "hashes": {
                "interpretationPacketSha256": packet_sha,
                "structureEvidenceSha256": evidence_sha,
                "safeManifestSha256": safe_sha,
                "learnedRequestV2Sha256": sha(request),
                "openaiPayloadV2Sha256": sha(payload),
                "adapterPrepareReportV2Sha256": sha(report),
            },
        })

    if [x["ordinal"] for x in rows_out] != list(range(1, 51)):
        fail("V2 prep ordinal closure failed")
    if len({x["id"] for x in rows_out}) != 50:
        fail("V2 prep track identity uniqueness failed")

    manifest = {
        "schema": "trackcade-semantic-external-stage1-v2-prep-v1",
        "status": "frozen-v2-provider-payloads-prepared-no-provider-call",
        "developmentRevision": "stage1-drop-semantics-v2",
        "trackCount": 50,
        "basePrepManifestSha256": sha(base_manifest_path),
        "builderSha256": sha(args.builder),
        "adapterSha256": sha(args.adapter),
        "referenceLabelsReadByPreparation": False,
        "terminalTracksProcessed": False,
        "modelContract": {
            "provider": "openai",
            "api": "responses",
            "model": MODEL,
            "reasoningEffort": REASONING_EFFORT,
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "store": False,
            "completedResponsesPerTrack": 0,
        },
        "tracks": rows_out,
    }
    manifest_path = out / "STAGE1_V2_PREP_MANIFEST_V1.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (out / "STAGE1_V2_PREP_MANIFEST_V1.json.sha256").write_text(f"{sha(manifest_path)}  STAGE1_V2_PREP_MANIFEST_V1.json\n")
    print(json.dumps({
        "schema": manifest["schema"],
        "trackCount": 50,
        "providerCalls": 0,
        "terminalTracksProcessed": False,
        "manifestSha256": sha(manifest_path),
    }, indent=2))


if __name__ == "__main__":
    main()

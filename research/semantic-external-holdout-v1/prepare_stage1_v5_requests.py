#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
import statistics
import subprocess
import sys
from pathlib import Path

MODEL = "gpt-6-sol"
REASONING_EFFORT = "high"
MAX_OUTPUT_TOKENS = 8192
DEVELOPMENT_REVISION = "stage1-drop-semantics-v5-candidate-first-absolute-pattern"
ANALYZER_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"
ANALYZER_SOURCE_COMMIT = "e308d867980fb1877c3f2e4ce27950deecac0855"
STRUCTURE_FREEZE_COMMIT = "708e824fd977a240e86dd9425a1a5e1b437775ad"
STRUCTURE_BUNDLE_SHA256 = "16858488f584ef85164241679c6dcf3675393e46ff33d99f8bde6b6617a7c4ca"
V3_PREP_RUN_ID = 36457485587
V3_PREP_HEAD_SHA = "a0e58581a213f74ce166d4a02deea4d3bb89e9e3"
V3_PREP_ARTIFACT_ID = 10986506165
V3_PREP_ARTIFACT_NAME = "trackcade-semantic-external-stage1-v3-prep-v1"
V3_PREP_ARTIFACT_DIGEST = "sha256:5f9e4159faf620f6b527fecc649b456633a3dccfca074dca7c6a422d3527e376"
V3_PREP_MANIFEST_SHA256 = "df7ceff4c82291552a2d55dd7ddf872269477d0766bf4cb785a90b5730779257"
V3_FILES_MANIFEST_SHA256 = "1ed91477e0d4b64c4a8d134537add835bc190ce463b653c2559405204bf53fc5"
V3_FILES_ENTRIES = 302


def fail(msg: str) -> None:
    raise SystemExit(f"V5 PREP FAIL-CLOSED: {msg}")


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha(path: Path) -> str:
    return sha_bytes(path.read_bytes())


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def verify_v3_files_manifest(root: Path) -> None:
    manifest = root / "FILES_SHA256.txt"
    if not manifest.is_file():
        fail("V3 FILES_SHA256.txt missing")
    if sha(manifest) != V3_FILES_MANIFEST_SHA256:
        fail("V3 FILES_SHA256.txt SHA-256 mismatch")
    lines = [line for line in manifest.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(lines) != V3_FILES_ENTRIES:
        fail(f"V3 FILES_SHA256 entry count mismatch: {len(lines)}")
    for line in lines:
        try:
            expected, rel = line.split("  ", 1)
        except ValueError:
            fail(f"malformed V3 FILES_SHA256 line: {line}")
        path = root / rel
        if not path.is_file() or sha(path) != expected:
            fail(f"V3 frozen file hash mismatch: {rel}")


def write_files_manifest(root: Path) -> tuple[Path, int]:
    out = root / "FILES_SHA256.txt"
    rows = []
    for path in sorted(p for p in root.rglob("*") if p.is_file() and p != out):
        rows.append(f"{sha(path)}  {path.relative_to(root).as_posix()}")
    out.write_text("\n".join(rows) + "\n", encoding="utf-8")
    return out, len(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--v3-prep-root", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--builder", type=Path, required=True)
    ap.add_argument("--adapter", type=Path, required=True)
    args = ap.parse_args()

    v3_manifest_path = args.v3_prep_root / "STAGE1_V3_PREP_MANIFEST_V1.json"
    if not v3_manifest_path.is_file() or sha(v3_manifest_path) != V3_PREP_MANIFEST_SHA256:
        fail("V3 prep manifest identity mismatch")
    verify_v3_files_manifest(args.v3_prep_root)
    v3 = load(v3_manifest_path)
    if v3.get("schema") != "trackcade-semantic-external-stage1-v3-prep-v1":
        fail("V3 prep schema mismatch")
    if v3.get("status") != "frozen-v3-provider-payloads-prepared-no-provider-call":
        fail("V3 prep status mismatch")
    if v3.get("developmentRevision") != "stage1-drop-semantics-v2-structure-evidence-v2":
        fail("V3 prep revision mismatch")
    if v3.get("trackCount") != 50:
        fail("V3 prep track count mismatch")
    if v3.get("referenceLabelsReadByPreparation") is not False or v3.get("terminalTracksProcessed") is not False:
        fail("V3 label/terminal research boundary mismatch")
    if v3.get("analyzerExecuted") is not False or v3.get("audioDecoded") is not False:
        fail("V3 Analyzer/audio research boundary mismatch")
    if v3.get("providerCallsObserved") != 0 or v3.get("compilerInvoked") is not False:
        fail("V3 provider/compiler research boundary mismatch")
    source_structure = v3.get("sourceStructureEvidenceV2") or {}
    if source_structure.get("freezeCommit") != STRUCTURE_FREEZE_COMMIT:
        fail("V3 Structure Evidence freeze commit mismatch")
    if source_structure.get("bundleSha256") != STRUCTURE_BUNDLE_SHA256:
        fail("V3 Structure Evidence bundle mismatch")
    if source_structure.get("policy") != "current-core-accent-table-v2":
        fail("V3 Structure Evidence policy mismatch")

    out = args.output_dir
    if out.exists() and any(out.iterdir()):
        # SOURCE_BLOBS_V1.json may be pre-created by CI before this script runs.
        extras = [p for p in out.iterdir() if p.name != "SOURCE_BLOBS_V1.json"]
        if extras:
            fail("output directory already contains non-source-blob files")
    out.mkdir(parents=True, exist_ok=True)

    rows_out = []
    v3_rows = sorted(v3.get("tracks") or [], key=lambda r: r.get("ordinal", 0))
    if len(v3_rows) != 50:
        fail("V3 prep rows missing")

    for row in v3_rows:
        ordinal = row.get("ordinal")
        track_id = row.get("id")
        stem = row.get("stem")
        if not isinstance(ordinal, int) or not 1 <= ordinal <= 50:
            fail("invalid ordinal")
        if not isinstance(track_id, str) or not track_id or not isinstance(stem, str) or not stem:
            fail(f"invalid identity ordinal {ordinal}")
        if row.get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256 or row.get("analyzerSourceCommit") != ANALYZER_SOURCE_COMMIT:
            fail(f"Analyzer identity mismatch ordinal {ordinal}")
        if row.get("compilerEligible") is not True or row.get("timingTier") not in {"standard", "loose"}:
            fail(f"V3 eligibility mismatch ordinal {ordinal}")

        case_rel = f"cases/{ordinal:02d}-{stem}"
        src = args.v3_prep_root / case_rel
        packet_src = src / "structure-evidence-v2.json"
        map_src = src / "structure-evidence-v2-source-map.json"
        hashes = row.get("hashes") or {}
        if not packet_src.is_file() or not map_src.is_file():
            fail(f"V3 packet/source-map missing ordinal {ordinal}")
        if sha(packet_src) != hashes.get("structureEvidenceV2Sha256"):
            fail(f"V3 packet row hash mismatch ordinal {ordinal}")
        packet = load(packet_src)
        if packet.get("sourceMapSha256") != hashes.get("sourceMapSha256"):
            fail(f"V3 packet source-map binding mismatch ordinal {ordinal}")
        if packet.get("source", {}).get("analysisJsonSha256") != row.get("analysisJsonSha256"):
            fail(f"V3 packet analysis identity mismatch ordinal {ordinal}")
        if packet.get("source", {}).get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256:
            fail(f"V3 packet Analyzer identity mismatch ordinal {ordinal}")

        dst = out / case_rel
        dst.mkdir(parents=True, exist_ok=True)
        packet_path = dst / "structure-evidence-v2.json"
        map_path = dst / "structure-evidence-v2-source-map.json"
        shutil.copyfile(packet_src, packet_path)
        shutil.copyfile(map_src, map_path)
        if packet_path.read_bytes() != packet_src.read_bytes() or map_path.read_bytes() != map_src.read_bytes():
            fail(f"V5 evidence copy changed bytes ordinal {ordinal}")

        request = dst / "learned-request-v5.json"
        diff = dst / "instruction-diff-v5.json"
        payload = dst / "openai-payload-v5.json"
        report = dst / "openai-adapter-prepare-report-v5.json"
        run([
            sys.executable, str(args.builder), "--packet", str(packet_path),
            "--output", str(request), "--instruction-diff-output", str(diff),
        ])
        run([
            sys.executable, str(args.adapter), "--request", str(request), "--packet", str(packet_path),
            "--model", MODEL, "--reasoning-effort", REASONING_EFFORT,
            "--max-output-tokens", str(MAX_OUTPUT_TOKENS), "--payload-output", str(payload),
            "--adapter-report-output", str(report), "--prepare-only",
        ])

        req = load(request)
        d = load(diff)
        adapter_report = load(report)
        if req.get("integrity", {}).get("developmentRevision") != DEVELOPMENT_REVISION:
            fail(f"V5 request revision mismatch ordinal {ordinal}")
        if req.get("integrity", {}).get("packetSha256") != sha(packet_path):
            fail(f"V5 request packet identity mismatch ordinal {ordinal}")
        if req.get("integrity", {}).get("sourceMapSha256") != packet["sourceMapSha256"]:
            fail(f"V5 request source-map binding mismatch ordinal {ordinal}")
        if d.get("semanticRetuningPerformed") is not True or d.get("labelInformedDevelopmentRevision") is not True:
            fail(f"V5 instruction diff research declaration mismatch ordinal {ordinal}")
        if d.get("retuningVariable") != "candidate-first-absolute-drop-pattern-with-repeated-drop-permission":
            fail(f"V5 retuning variable mismatch ordinal {ordinal}")
        if d.get("terminalHoldoutUsed") is not False:
            fail(f"V5 instruction diff terminal boundary mismatch ordinal {ordinal}")
        if adapter_report.get("status") != "payload_prepared_no_provider_call":
            fail(f"V5 adapter prepare status mismatch ordinal {ordinal}")
        if adapter_report.get("requestedModel") != MODEL or adapter_report.get("reasoningEffort") != REASONING_EFFORT:
            fail(f"V5 model/reasoning mismatch ordinal {ordinal}")
        if adapter_report.get("maxOutputTokens") != MAX_OUTPUT_TOKENS or adapter_report.get("store") is not False:
            fail(f"V5 output/store mismatch ordinal {ordinal}")
        if adapter_report.get("confidenceFieldsDiagnosticOnly") is not True:
            fail(f"V5 confidence contract mismatch ordinal {ordinal}")
        if adapter_report.get("trackSummaryDerivedNotGate") is not True or adapter_report.get("repeatedSimilarDropsAllowed") is not True:
            fail(f"V5 semantic architecture mismatch ordinal {ordinal}")

        for p in (packet_path, request, payload):
            low = p.read_text(encoding="utf-8").lower()
            for token in ('reference_drops', '"dropsseconds"', '"diagnosticlabelhint"', '"diagnostictypehint"'):
                if token in low:
                    fail(f"label/diagnostic leakage {token} ordinal {ordinal} in {p.name}")
        request_low = request.read_text(encoding="utf-8").lower()
        if '"aliases"' in request_low or '"aliascolumns"' in request_low:
            fail(f"source-map content leaked into request ordinal {ordinal}")
        payload_obj = load(payload)
        provider_input = json.loads(payload_obj["input"])
        if provider_input.get("packet") != packet:
            fail(f"provider packet mismatch ordinal {ordinal}")
        provider_encoded = json.dumps(provider_input, sort_keys=True).lower()
        if '"aliases"' in provider_encoded or '"aliascolumns"' in provider_encoded:
            fail(f"source-map content leaked into provider payload ordinal {ordinal}")

        rows_out.append({
            "ordinal": ordinal,
            "id": track_id,
            "stem": stem,
            "timingTier": row["timingTier"],
            "compilerEligible": True,
            "analysisJsonSha256": row["analysisJsonSha256"],
            "analyzerRunnerSha256": ANALYZER_RUNNER_SHA256,
            "analyzerSourceCommit": ANALYZER_SOURCE_COMMIT,
            "anchorCount": len(packet["anchors"]),
            "sourceV3PacketSha256": hashes["structureEvidenceV2Sha256"],
            "bytes": {
                "structureEvidenceV2": packet_path.stat().st_size,
                "sourceMapStoredNotProviderInput": map_path.stat().st_size,
                "request": request.stat().st_size,
                "openaiPayload": payload.stat().st_size,
            },
            "hashes": {
                "structureEvidenceV2Sha256": sha(packet_path),
                "sourceMapFileSha256": sha(map_path),
                "sourceMapBindingSha256": packet["sourceMapSha256"],
                "learnedRequestV5Sha256": sha(request),
                "instructionDiffV5Sha256": sha(diff),
                "openaiPayloadV5Sha256": sha(payload),
                "adapterPrepareReportV5Sha256": sha(report),
            },
        })

    if [r["ordinal"] for r in rows_out] != list(range(1, 51)):
        fail("ordinal closure failed")
    if len({r["id"] for r in rows_out}) != 50:
        fail("track identity uniqueness failed")
    if any(r["hashes"]["structureEvidenceV2Sha256"] != r["sourceV3PacketSha256"] for r in rows_out):
        fail("V5 did not preserve exact V3 packet hashes")

    payload_sizes = [r["bytes"]["openaiPayload"] for r in rows_out]
    request_sizes = [r["bytes"]["request"] for r in rows_out]
    packet_sizes = [r["bytes"]["structureEvidenceV2"] for r in rows_out]
    manifest = {
        "schema": "trackcade-semantic-external-stage1-v5-prep-v1",
        "status": "frozen-v5-provider-payloads-prepared-no-provider-call",
        "developmentRevision": DEVELOPMENT_REVISION,
        "trackCount": 50,
        "labelInformedDevelopmentRevision": True,
        "developmentBasis": "V4 Stage1 aggregate/per-track diagnostic failure analysis; no terminal holdout",
        "scientificVariable": "candidate-first absolute Drop classification with repeated-similar qualifying Drops permitted; derived track summary cannot veto candidate decisions",
        "sourceV3FrozenPrep": {
            "runId": V3_PREP_RUN_ID,
            "headSha": V3_PREP_HEAD_SHA,
            "artifactId": V3_PREP_ARTIFACT_ID,
            "artifactName": V3_PREP_ARTIFACT_NAME,
            "artifactDigest": V3_PREP_ARTIFACT_DIGEST,
            "manifestSha256": V3_PREP_MANIFEST_SHA256,
            "filesManifestSha256": V3_FILES_MANIFEST_SHA256,
            "filesManifestEntries": V3_FILES_ENTRIES,
        },
        "sourceStructureEvidenceV2": {
            "freezeCommit": STRUCTURE_FREEZE_COMMIT,
            "bundleSha256": STRUCTURE_BUNDLE_SHA256,
            "policy": "current-core-accent-table-v2",
            "reusePolicy": "exact-packet-and-source-map-bytes-from-frozen-v3-prep",
        },
        "v3PrepManifestSha256": sha(v3_manifest_path),
        "builderSha256": sha(args.builder),
        "adapterSha256": sha(args.adapter),
        "referenceLabelsReadByPreparation": False,
        "terminalTracksProcessed": False,
        "analyzerExecuted": False,
        "audioDecoded": False,
        "providerCallsObserved": 0,
        "compilerInvoked": False,
        "modelContract": {
            "provider": "openai",
            "api": "responses",
            "model": MODEL,
            "reasoningEffort": REASONING_EFFORT,
            "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "store": False,
            "completedResponsesPerTrack": 0,
            "maxOutputTokensRationale": "8192 is predeclared from V4 transport/output-capacity evidence; this is not a semantic threshold and no V5 provider response was observed during preparation",
        },
        "semanticContract": {
            "candidateFirst": True,
            "absoluteThreePartDropPattern": True,
            "repeatedSimilarDropsAllowed": True,
            "similarityIsNotNegativeEvidence": True,
            "trackSummaryDerivedNotGate": True,
            "confidenceFieldsDiagnosticOnly": True,
            "providerTimestampsForbidden": True,
            "timingAuthority": "frozen-analyzer-derived-anchor-only",
        },
        "footprint": {
            "structureEvidenceBytesTotal": sum(packet_sizes),
            "requestBytesTotal": sum(request_sizes),
            "openaiPayloadBytesTotal": sum(payload_sizes),
            "openaiPayloadBytesMean": statistics.mean(payload_sizes),
            "openaiPayloadBytesMax": max(payload_sizes),
        },
        "tracks": rows_out,
    }
    manifest_path = out / "STAGE1_V5_PREP_MANIFEST_V1.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    files_path, entry_count = write_files_manifest(out)
    print(json.dumps({
        "status": manifest["status"],
        "trackCount": 50,
        "providerCalls": 0,
        "terminalTracksProcessed": False,
        "analyzerExecuted": False,
        "compilerInvoked": False,
        "exactV3PacketReuse": True,
        "maxOutputTokens": MAX_OUTPUT_TOKENS,
        "manifestSha256": sha(manifest_path),
        "filesManifestSha256": sha(files_path),
        "filesManifestEntries": entry_count,
        "payloadBytesMean": manifest["footprint"]["openaiPayloadBytesMean"],
        "payloadBytesMax": manifest["footprint"]["openaiPayloadBytesMax"],
    }, indent=2))


if __name__ == "__main__":
    main()

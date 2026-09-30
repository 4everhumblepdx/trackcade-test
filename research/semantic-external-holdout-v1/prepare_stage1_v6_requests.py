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
DEVELOPMENT_REVISION = "stage1-drop-semantics-v6-decisive-impact-ordinary-return-counterfactual"
ANALYZER_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"
ANALYZER_SOURCE_COMMIT = "e308d867980fb1877c3f2e4ce27950deecac0855"
STRUCTURE_FREEZE_COMMIT = "708e824fd977a240e86dd9425a1a5e1b437775ad"
STRUCTURE_BUNDLE_SHA256 = "16858488f584ef85164241679c6dcf3675393e46ff33d99f8bde6b6617a7c4ca"
V5_PREP_RUN_ID = 36645240283
V5_PREP_HEAD_SHA = "fd6e06bf9b1cff11f257d4eb5c2e2703d913e745"
V5_PREP_ARTIFACT_ID = 11068032294
V5_PREP_ARTIFACT_NAME = "trackcade-semantic-external-stage1-v5-prep-v1"
V5_PREP_ARTIFACT_DIGEST = "sha256:55db9b9144debbf71ec3ca780fd0ff6b91609221337045e4d6b43f02a822dc05"
V5_PREP_MANIFEST_SHA256 = "f93545e534b11bd207df3f032709f5cd3c1f198cf5529bbf04c0158c696f4799"
V5_FILES_MANIFEST_SHA256 = "1393038c09afff244e4aeb2c745eb5a6f40c5f728991cec5051d3dfb4d34cb6c"
V5_FILES_ENTRIES = 302


def fail(msg: str) -> None:
    raise SystemExit(f"V6 PREP FAIL-CLOSED: {msg}")


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha(path: Path) -> str:
    return sha_bytes(path.read_bytes())


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def verify_v5_files_manifest(root: Path) -> None:
    manifest = root / "FILES_SHA256.txt"
    if not manifest.is_file() or sha(manifest) != V5_FILES_MANIFEST_SHA256:
        fail("V5 FILES_SHA256.txt identity mismatch")
    lines = [line for line in manifest.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(lines) != V5_FILES_ENTRIES:
        fail(f"V5 FILES_SHA256 entry count mismatch: {len(lines)}")
    for line in lines:
        try:
            expected, rel = line.split("  ", 1)
        except ValueError:
            fail(f"malformed V5 FILES_SHA256 line: {line}")
        p = root / rel
        if not p.is_file() or sha(p) != expected:
            fail(f"V5 frozen file hash mismatch: {rel}")


def write_files_manifest(root: Path) -> tuple[Path, int]:
    out = root / "FILES_SHA256.txt"
    rows = []
    for p in sorted(x for x in root.rglob("*") if x.is_file() and x != out):
        rows.append(f"{sha(p)}  {p.relative_to(root).as_posix()}")
    out.write_text("\n".join(rows) + "\n", encoding="utf-8")
    return out, len(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--v5-prep-root", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--builder", type=Path, required=True)
    ap.add_argument("--adapter", type=Path, required=True)
    args = ap.parse_args()

    source_manifest = args.v5_prep_root / "STAGE1_V5_PREP_MANIFEST_V1.json"
    if not source_manifest.is_file() or sha(source_manifest) != V5_PREP_MANIFEST_SHA256:
        fail("V5 prep manifest identity mismatch")
    verify_v5_files_manifest(args.v5_prep_root)
    v5 = load(source_manifest)
    if v5.get("schema") != "trackcade-semantic-external-stage1-v5-prep-v1":
        fail("V5 prep schema mismatch")
    if v5.get("status") != "frozen-v5-provider-payloads-prepared-no-provider-call":
        fail("V5 prep status mismatch")
    if v5.get("developmentRevision") != "stage1-drop-semantics-v5-candidate-first-absolute-pattern":
        fail("V5 prep revision mismatch")
    if v5.get("trackCount") != 50:
        fail("V5 prep track count mismatch")
    if v5.get("referenceLabelsReadByPreparation") is not False or v5.get("terminalTracksProcessed") is not False:
        fail("V5 label/terminal boundary mismatch")
    if v5.get("analyzerExecuted") is not False or v5.get("audioDecoded") is not False:
        fail("V5 Analyzer/audio boundary mismatch")
    if v5.get("providerCallsObserved") != 0 or v5.get("compilerInvoked") is not False:
        fail("V5 provider/compiler boundary mismatch")
    source_structure = v5.get("sourceStructureEvidenceV2") or {}
    if source_structure.get("freezeCommit") != STRUCTURE_FREEZE_COMMIT or source_structure.get("bundleSha256") != STRUCTURE_BUNDLE_SHA256:
        fail("V5 Structure Evidence identity mismatch")
    if source_structure.get("policy") != "current-core-accent-table-v2":
        fail("V5 Structure Evidence policy mismatch")

    out = args.output_dir
    if out.exists() and any(out.iterdir()):
        extras = [p for p in out.iterdir() if p.name != "SOURCE_BLOBS_V1.json"]
        if extras:
            fail("output directory already contains non-source-blob files")
    out.mkdir(parents=True, exist_ok=True)

    source_rows = sorted(v5.get("tracks") or [], key=lambda r: r.get("ordinal", 0))
    if len(source_rows) != 50 or [r.get("ordinal") for r in source_rows] != list(range(1, 51)):
        fail("V5 prep ordinal closure mismatch")

    rows_out = []
    for row in source_rows:
        ordinal, track_id, stem = row.get("ordinal"), row.get("id"), row.get("stem")
        if not isinstance(track_id, str) or not track_id or not isinstance(stem, str) or not stem:
            fail(f"invalid source identity ordinal {ordinal}")
        if row.get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256 or row.get("analyzerSourceCommit") != ANALYZER_SOURCE_COMMIT:
            fail(f"Analyzer identity mismatch ordinal {ordinal}")
        case_rel = f"cases/{ordinal:02d}-{stem}"
        src = args.v5_prep_root / case_rel
        packet_src = src / "structure-evidence-v2.json"
        map_src = src / "structure-evidence-v2-source-map.json"
        hashes = row.get("hashes") or {}
        if not packet_src.is_file() or not map_src.is_file():
            fail(f"V5 packet/source-map missing ordinal {ordinal}")
        if sha(packet_src) != hashes.get("structureEvidenceV2Sha256"):
            fail(f"V5 packet hash mismatch ordinal {ordinal}")
        if sha(map_src) != hashes.get("sourceMapFileSha256"):
            fail(f"V5 source-map file hash mismatch ordinal {ordinal}")
        packet = load(packet_src)
        if packet.get("sourceMapSha256") != hashes.get("sourceMapBindingSha256"):
            fail(f"V5 packet source-map binding mismatch ordinal {ordinal}")

        dst = out / case_rel
        dst.mkdir(parents=True, exist_ok=True)
        packet_path = dst / "structure-evidence-v2.json"
        map_path = dst / "structure-evidence-v2-source-map.json"
        shutil.copyfile(packet_src, packet_path)
        shutil.copyfile(map_src, map_path)
        if packet_path.read_bytes() != packet_src.read_bytes() or map_path.read_bytes() != map_src.read_bytes():
            fail(f"V6 evidence copy changed bytes ordinal {ordinal}")

        request = dst / "learned-request-v6.json"
        diff = dst / "instruction-diff-v6.json"
        payload = dst / "openai-payload-v6.json"
        report = dst / "openai-adapter-prepare-report-v6.json"
        run([sys.executable, str(args.builder), "--packet", str(packet_path), "--output", str(request), "--instruction-diff-output", str(diff)])
        run([
            sys.executable, str(args.adapter), "--request", str(request), "--packet", str(packet_path),
            "--model", MODEL, "--reasoning-effort", REASONING_EFFORT,
            "--max-output-tokens", str(MAX_OUTPUT_TOKENS), "--payload-output", str(payload),
            "--adapter-report-output", str(report), "--prepare-only",
        ])

        req, d, adapter_report = load(request), load(diff), load(report)
        integrity = req.get("integrity") or {}
        if integrity.get("developmentRevision") != DEVELOPMENT_REVISION:
            fail(f"V6 request revision mismatch ordinal {ordinal}")
        if integrity.get("packetSha256") != sha(packet_path) or integrity.get("sourceMapSha256") != packet["sourceMapSha256"]:
            fail(f"V6 request evidence binding mismatch ordinal {ordinal}")
        if d.get("retuningVariable") != "decisive-impact-plus-ordinary-return-counterfactual":
            fail(f"V6 retuning variable mismatch ordinal {ordinal}")
        if d.get("labelInformedDevelopmentRevision") is not True or d.get("terminalHoldoutUsed") is not False:
            fail(f"V6 research declaration mismatch ordinal {ordinal}")
        if adapter_report.get("status") != "payload_prepared_no_provider_call":
            fail(f"V6 adapter prepare status mismatch ordinal {ordinal}")
        if adapter_report.get("requestedModel") != MODEL or adapter_report.get("reasoningEffort") != REASONING_EFFORT:
            fail(f"V6 model/reasoning mismatch ordinal {ordinal}")
        if adapter_report.get("maxOutputTokens") != MAX_OUTPUT_TOKENS or adapter_report.get("store") is not False:
            fail(f"V6 transport mismatch ordinal {ordinal}")
        for key in (
            "confidenceFieldsDiagnosticOnly", "analyzerDescriptorsNotSemanticGates", "trackSummaryDerivedNotGate",
            "repeatedSimilarDropsAllowed", "decisiveImpactRequiredForDrop", "ordinaryReturnMustBeRuledOutForDrop",
            "priorModelAgreementNotProviderInput", "proposalCountNotSemanticCriterion",
        ):
            if adapter_report.get(key) is not True:
                fail(f"V6 contract flag {key} mismatch ordinal {ordinal}")

        for p in (packet_path, request, payload):
            low = p.read_text(encoding="utf-8").lower()
            for token in ('reference_drops', '"dropsseconds"', '"diagnosticlabelhint"', '"diagnostictypehint"'):
                if token in low:
                    fail(f"label/diagnostic leakage {token} ordinal {ordinal} in {p.name}")
        payload_obj = load(payload)
        provider_input = json.loads(payload_obj["input"])
        if provider_input.get("packet") != packet:
            fail(f"provider packet mismatch ordinal {ordinal}")
        provider_encoded = json.dumps(provider_input, sort_keys=True).lower()
        for token in ('"aliases"', '"aliascolumns"', 'v3proposal', 'v5proposal'):
            if token in provider_encoded:
                fail(f"forbidden provider-input content {token} ordinal {ordinal}")

        rows_out.append({
            "ordinal": ordinal, "id": track_id, "stem": stem,
            "timingTier": row.get("timingTier"), "compilerEligible": row.get("compilerEligible"),
            "analysisJsonSha256": row.get("analysisJsonSha256"),
            "analyzerRunnerSha256": ANALYZER_RUNNER_SHA256, "analyzerSourceCommit": ANALYZER_SOURCE_COMMIT,
            "anchorCount": len(packet["anchors"]),
            "sourceV5PacketSha256": hashes["structureEvidenceV2Sha256"],
            "bytes": {
                "structureEvidenceV2": packet_path.stat().st_size,
                "sourceMapStoredNotProviderInput": map_path.stat().st_size,
                "request": request.stat().st_size, "openaiPayload": payload.stat().st_size,
            },
            "hashes": {
                "structureEvidenceV2Sha256": sha(packet_path),
                "sourceMapFileSha256": sha(map_path),
                "sourceMapBindingSha256": packet["sourceMapSha256"],
                "learnedRequestV6Sha256": sha(request),
                "instructionDiffV6Sha256": sha(diff),
                "openaiPayloadV6Sha256": sha(payload),
                "adapterPrepareReportV6Sha256": sha(report),
            },
        })

    if len({r["id"] for r in rows_out}) != 50:
        fail("track identity uniqueness failed")
    if any(r["hashes"]["structureEvidenceV2Sha256"] != r["sourceV5PacketSha256"] for r in rows_out):
        fail("V6 did not preserve exact V5 packet hashes")

    payload_sizes = [r["bytes"]["openaiPayload"] for r in rows_out]
    request_sizes = [r["bytes"]["request"] for r in rows_out]
    packet_sizes = [r["bytes"]["structureEvidenceV2"] for r in rows_out]
    manifest = {
        "schema": "trackcade-semantic-external-stage1-v6-prep-v1",
        "status": "frozen-v6-provider-payloads-prepared-no-provider-call",
        "developmentRevision": DEVELOPMENT_REVISION,
        "trackCount": 50,
        "labelInformedDevelopmentRevision": True,
        "developmentBasis": "frozen V5 Stage1 result, candidate-level postmortem, discriminator analysis; no terminal holdout",
        "scientificVariable": "candidate-first decisive-impact requirement plus ordinary-return counterfactual; repeated-similar qualifying Drops remain permitted",
        "sourceV5FrozenPrep": {
            "runId": V5_PREP_RUN_ID, "headSha": V5_PREP_HEAD_SHA,
            "artifactId": V5_PREP_ARTIFACT_ID, "artifactName": V5_PREP_ARTIFACT_NAME,
            "artifactDigest": V5_PREP_ARTIFACT_DIGEST, "manifestSha256": V5_PREP_MANIFEST_SHA256,
            "filesManifestSha256": V5_FILES_MANIFEST_SHA256, "filesManifestEntries": V5_FILES_ENTRIES,
        },
        "sourceStructureEvidenceV2": {
            "freezeCommit": STRUCTURE_FREEZE_COMMIT, "bundleSha256": STRUCTURE_BUNDLE_SHA256,
            "policy": "current-core-accent-table-v2", "reusePolicy": "exact-packet-and-source-map-bytes-from-frozen-v5-prep",
        },
        "v5PrepManifestSha256": sha(source_manifest),
        "builderSha256": sha(args.builder), "adapterSha256": sha(args.adapter),
        "referenceLabelsReadByPreparation": False, "terminalTracksProcessed": False,
        "analyzerExecuted": False, "audioDecoded": False, "providerCallsObserved": 0, "compilerInvoked": False,
        "modelContract": {
            "provider": "openai", "api": "responses", "model": MODEL,
            "reasoningEffort": REASONING_EFFORT, "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "store": False, "completedResponsesPerTrack": 0,
            "transportStatus": "semantic prep only; service tier and any future output-capacity amendment require separate freeze/authorization",
        },
        "semanticContract": {
            "candidateFirst": True, "decisiveImpactRequiredForDrop": True,
            "ordinaryReturnMustBeRuledOutForDrop": True, "repeatedSimilarDropsAllowed": True,
            "similarityIsNotNegativeEvidence": True, "trackSummaryDerivedNotGate": True,
            "confidenceFieldsDiagnosticOnly": True, "analyzerDescriptorsNotSemanticGates": True,
            "priorModelAgreementNotProviderInput": True, "proposalCountNotSemanticCriterion": True,
            "providerTimestampsForbidden": True, "timingAuthority": "frozen-analyzer-derived-anchor-only",
        },
        "footprint": {
            "structureEvidenceBytesTotal": sum(packet_sizes), "requestBytesTotal": sum(request_sizes),
            "openaiPayloadBytesTotal": sum(payload_sizes), "openaiPayloadBytesMean": statistics.mean(payload_sizes),
            "openaiPayloadBytesMax": max(payload_sizes),
        },
        "tracks": rows_out,
    }
    manifest_path = out / "STAGE1_V6_PREP_MANIFEST_V1.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    files_path, entry_count = write_files_manifest(out)
    print(json.dumps({
        "status": manifest["status"], "trackCount": 50, "providerCalls": 0,
        "terminalTracksProcessed": False, "analyzerExecuted": False, "compilerInvoked": False,
        "exactV5PacketReuse": True, "maxOutputTokens": MAX_OUTPUT_TOKENS,
        "manifestSha256": sha(manifest_path), "filesManifestSha256": sha(files_path),
        "filesManifestEntries": entry_count, "payloadBytesMean": manifest["footprint"]["openaiPayloadBytesMean"],
        "payloadBytesMax": manifest["footprint"]["openaiPayloadBytesMax"],
    }, indent=2))


if __name__ == "__main__":
    main()

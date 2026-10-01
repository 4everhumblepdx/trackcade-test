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
DEVELOPMENT_REVISION = "stage1-drop-semantics-v7-orthogonal-structural-context"
ANALYZER_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"
ANALYZER_SOURCE_COMMIT = "e308d867980fb1877c3f2e4ce27950deecac0855"

V6_PREP_RUN_ID = 36747819119
V6_PREP_ARTIFACT_ID = 11112534029
V6_PREP_ARTIFACT_NAME = "trackcade-semantic-external-stage1-v6-prep-v1"
V6_PREP_ARTIFACT_DIGEST = "sha256:0d586b737ba729a1386914663d92e7bae1fd85e404f1480e8f034084cbd80134"
V6_PREP_MANIFEST_SHA256 = "ebdbf2232a813dbe89b87f4fb3bd938f037d6f15707943c2c0b639a15bc202c8"
V6_FILES_MANIFEST_SHA256 = "a8a81dca2fd4f9c5297ebbe594f5144f28f9ae2a7542066db3a3169cd07d1e35"
V6_FILES_ENTRIES = 302


def fail(msg: str) -> None:
    raise SystemExit(f"V7 PREP FAIL-CLOSED: {msg}")


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha(path: Path) -> str:
    return sha_bytes(path.read_bytes())


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def verify_v6_files_manifest(root: Path) -> None:
    manifest = root / "FILES_SHA256.txt"
    if not manifest.is_file() or sha(manifest) != V6_FILES_MANIFEST_SHA256:
        fail("V6 FILES_SHA256.txt identity mismatch")
    lines = [line for line in manifest.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(lines) != V6_FILES_ENTRIES:
        fail(f"V6 FILES_SHA256 entry count mismatch: {len(lines)}")
    for line in lines:
        try:
            expected, rel = line.split("  ", 1)
        except ValueError:
            fail(f"malformed V6 FILES_SHA256 line: {line}")
        p = root / rel
        if not p.is_file() or sha(p) != expected:
            fail(f"V6 frozen file hash mismatch: {rel}")


def write_files_manifest(root: Path) -> tuple[Path, int]:
    out = root / "FILES_SHA256.txt"
    rows = []
    for p in sorted(x for x in root.rglob("*") if x.is_file() and x != out):
        rows.append(f"{sha(p)}  {p.relative_to(root).as_posix()}")
    out.write_text("\n".join(rows) + "\n", encoding="utf-8")
    return out, len(rows)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--v6-prep-root", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--builder", type=Path, required=True)
    ap.add_argument("--adapter", type=Path, required=True)
    args = ap.parse_args()

    source_manifest = args.v6_prep_root / "STAGE1_V6_PREP_MANIFEST_V1.json"
    if not source_manifest.is_file() or sha(source_manifest) != V6_PREP_MANIFEST_SHA256:
        fail("V6 prep manifest identity mismatch")
    verify_v6_files_manifest(args.v6_prep_root)
    v6 = load(source_manifest)
    if v6.get("schema") != "trackcade-semantic-external-stage1-v6-prep-v1":
        fail("V6 prep schema mismatch")
    if v6.get("status") != "frozen-v6-provider-payloads-prepared-no-provider-call":
        fail("V6 prep status mismatch")
    if v6.get("developmentRevision") != "stage1-drop-semantics-v6-decisive-impact-ordinary-return-counterfactual":
        fail("V6 prep revision mismatch")
    if v6.get("trackCount") != 50:
        fail("V6 prep track count mismatch")
    if v6.get("referenceLabelsReadByPreparation") is not False or v6.get("terminalTracksProcessed") is not False:
        fail("V6 label/terminal boundary mismatch")
    if v6.get("analyzerExecuted") is not False or v6.get("audioDecoded") is not False:
        fail("V6 Analyzer/audio boundary mismatch")
    if v6.get("providerCallsObserved") != 0 or v6.get("compilerInvoked") is not False:
        fail("V6 provider/compiler boundary mismatch")

    out = args.output_dir
    if out.exists() and any(out.iterdir()):
        fail("output directory must be empty")
    out.mkdir(parents=True, exist_ok=True)

    source_rows = sorted(v6.get("tracks") or [], key=lambda r: r.get("ordinal", 0))
    if len(source_rows) != 50 or [r.get("ordinal") for r in source_rows] != list(range(1, 51)):
        fail("V6 prep ordinal closure mismatch")

    rows_out = []
    for row in source_rows:
        ordinal, track_id, stem = row.get("ordinal"), row.get("id"), row.get("stem")
        if not isinstance(track_id, str) or not track_id or not isinstance(stem, str) or not stem:
            fail(f"invalid source identity ordinal {ordinal}")
        if row.get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256 or row.get("analyzerSourceCommit") != ANALYZER_SOURCE_COMMIT:
            fail(f"Analyzer identity mismatch ordinal {ordinal}")

        case_rel = f"cases/{ordinal:02d}-{stem}"
        src = args.v6_prep_root / case_rel
        packet_src = src / "structure-evidence-v2.json"
        map_src = src / "structure-evidence-v2-source-map.json"
        hashes = row.get("hashes") or {}
        if not packet_src.is_file() or not map_src.is_file():
            fail(f"V6 packet/source-map missing ordinal {ordinal}")
        if sha(packet_src) != hashes.get("structureEvidenceV2Sha256"):
            fail(f"V6 packet hash mismatch ordinal {ordinal}")
        if sha(map_src) != hashes.get("sourceMapFileSha256"):
            fail(f"V6 source-map file hash mismatch ordinal {ordinal}")

        packet = load(packet_src)
        if packet.get("sourceMapSha256") != hashes.get("sourceMapBindingSha256"):
            fail(f"V6 packet source-map binding mismatch ordinal {ordinal}")

        dst = out / case_rel
        dst.mkdir(parents=True, exist_ok=True)
        packet_path = dst / "structure-evidence-v2.json"
        map_path = dst / "structure-evidence-v2-source-map.json"
        shutil.copyfile(packet_src, packet_path)
        shutil.copyfile(map_src, map_path)
        if packet_path.read_bytes() != packet_src.read_bytes() or map_path.read_bytes() != map_src.read_bytes():
            fail(f"V7 evidence copy changed bytes ordinal {ordinal}")

        request = dst / "learned-request-v7.json"
        diff = dst / "instruction-diff-v7.json"
        payload = dst / "openai-payload-v7.json"
        report = dst / "openai-adapter-prepare-report-v7.json"

        run([
            sys.executable, str(args.builder),
            "--packet", str(packet_path),
            "--output", str(request),
            "--instruction-diff-output", str(diff),
        ])
        run([
            sys.executable, str(args.adapter),
            "--request", str(request),
            "--packet", str(packet_path),
            "--model", MODEL,
            "--reasoning-effort", REASONING_EFFORT,
            "--max-output-tokens", str(MAX_OUTPUT_TOKENS),
            "--payload-output", str(payload),
            "--adapter-report-output", str(report),
            "--prepare-only",
        ])

        req, d, adapter_report = load(request), load(diff), load(report)
        integrity = req.get("integrity") or {}
        if integrity.get("developmentRevision") != DEVELOPMENT_REVISION:
            fail(f"V7 request revision mismatch ordinal {ordinal}")
        if integrity.get("packetSha256") != sha(packet_path) or integrity.get("sourceMapSha256") != packet["sourceMapSha256"]:
            fail(f"V7 request evidence binding mismatch ordinal {ordinal}")
        if d.get("retuningVariable") != "orthogonalize-structural-context-from-drop-impact-morphology":
            fail(f"V7 retuning variable mismatch ordinal {ordinal}")
        if d.get("labelInformedDevelopmentRevision") is not True or d.get("terminalHoldoutUsed") is not False:
            fail(f"V7 research declaration mismatch ordinal {ordinal}")
        if d.get("existingTerminalPhysicallyUnseenClaimAllowed") is not False:
            fail(f"V7 terminal-isolation declaration mismatch ordinal {ordinal}")
        if adapter_report.get("status") != "payload_prepared_no_provider_call":
            fail(f"V7 adapter prepare status mismatch ordinal {ordinal}")
        if adapter_report.get("requestedModel") != MODEL or adapter_report.get("reasoningEffort") != REASONING_EFFORT:
            fail(f"V7 model/reasoning mismatch ordinal {ordinal}")
        if adapter_report.get("maxOutputTokens") != MAX_OUTPUT_TOKENS or adapter_report.get("store") is not False:
            fail(f"V7 transport mismatch ordinal {ordinal}")
        for key in (
            "confidenceFieldsDiagnosticOnly", "analyzerDescriptorsNotSemanticGates", "trackSummaryDerivedNotGate",
            "repeatedSimilarDropsAllowed", "decisiveImpactRequiredForDrop", "decisiveImpactUnclearInsufficientForDrop",
            "structuralContextOrthogonalNotGate", "priorModelAgreementNotProviderInput", "proposalCountNotSemanticCriterion",
        ):
            if adapter_report.get(key) is not True:
                fail(f"V7 contract flag {key} mismatch ordinal {ordinal}")

        for p in (packet_path, request, payload):
            low = p.read_text(encoding="utf-8").lower()
            for token in (
                'reference_drops', '"dropsseconds"', '"diagnosticlabelhint"', '"diagnostictypehint"',
                '"v3proposal"', '"v5proposal"', '"v6proposal"', '"terminal"',
            ):
                if token in low:
                    fail(f"label/diagnostic/prior/terminal leakage {token} ordinal {ordinal} in {p.name}")

        payload_obj = load(payload)
        provider_input = json.loads(payload_obj["input"])
        if provider_input.get("packet") != packet:
            fail(f"provider packet mismatch ordinal {ordinal}")
        provider_encoded = json.dumps(provider_input, sort_keys=True).lower()
        for token in ('"aliases"', '"aliascolumns"', 'v3proposal', 'v5proposal', 'v6proposal', '"terminal"'):
            if token in provider_encoded:
                fail(f"forbidden provider-input content {token} ordinal {ordinal}")

        rows_out.append({
            "ordinal": ordinal,
            "id": track_id,
            "stem": stem,
            "timingTier": row.get("timingTier"),
            "compilerEligible": row.get("compilerEligible"),
            "analysisJsonSha256": row.get("analysisJsonSha256"),
            "analyzerRunnerSha256": ANALYZER_RUNNER_SHA256,
            "analyzerSourceCommit": ANALYZER_SOURCE_COMMIT,
            "anchorCount": len(packet["anchors"]),
            "sourceV6PacketSha256": hashes["structureEvidenceV2Sha256"],
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
                "learnedRequestV7Sha256": sha(request),
                "instructionDiffV7Sha256": sha(diff),
                "openaiPayloadV7Sha256": sha(payload),
                "adapterPrepareReportV7Sha256": sha(report),
            },
        })

    if len({r["id"] for r in rows_out}) != 50:
        fail("track identity uniqueness failed")
    if any(r["hashes"]["structureEvidenceV2Sha256"] != r["sourceV6PacketSha256"] for r in rows_out):
        fail("V7 did not preserve exact V6 packet hashes")

    payload_sizes = [r["bytes"]["openaiPayload"] for r in rows_out]
    request_sizes = [r["bytes"]["request"] for r in rows_out]
    packet_sizes = [r["bytes"]["structureEvidenceV2"] for r in rows_out]

    manifest = {
        "schema": "trackcade-semantic-external-stage1-v7-prep-v1",
        "status": "frozen-v7-provider-payloads-prepared-no-provider-call",
        "developmentRevision": DEVELOPMENT_REVISION,
        "trackCount": 50,
        "labelInformedDevelopmentRevision": True,
        "developmentBasis": "frozen V6 Stage1 RAW development result and post-hoc gate-collapse diagnostic; no terminal evaluation",
        "scientificVariable": "structural context is orthogonal descriptive context rather than a Drop veto; clear preparation, decisive impact, and sustained stronger passage remain mandatory",
        "sourceV6FrozenPrep": {
            "runId": V6_PREP_RUN_ID,
            "artifactId": V6_PREP_ARTIFACT_ID,
            "artifactName": V6_PREP_ARTIFACT_NAME,
            "artifactDigest": V6_PREP_ARTIFACT_DIGEST,
            "manifestSha256": V6_PREP_MANIFEST_SHA256,
            "filesManifestSha256": V6_FILES_MANIFEST_SHA256,
            "filesManifestEntries": V6_FILES_ENTRIES,
        },
        "reusePolicy": "exact-packet-and-source-map-bytes-from-frozen-v6-prep",
        "v6PrepManifestSha256": sha(source_manifest),
        "builderSha256": sha(args.builder),
        "adapterSha256": sha(args.adapter),
        "referenceLabelsReadByPreparation": False,
        "terminalTracksProcessed": False,
        "existingTerminalPhysicallyUnseenClaimAllowed": False,
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
            "serviceTier": "not-frozen-by-this-prep; any future paid V7 run must separately preserve or explicitly freeze the intended transport tier before authorization",
        },
        "semanticContract": {
            "candidateFirst": True,
            "clearPreparationRequiredForDrop": True,
            "decisiveImpactRequiredForDrop": True,
            "decisiveImpactUnclearInsufficientForDrop": True,
            "clearSustainedStrongerPassageRequiredForDrop": True,
            "structuralContextOrthogonalNotGate": True,
            "ordinaryReturnAlternativeVetoRemoved": True,
            "repeatedSimilarDropsAllowed": True,
            "confidenceFieldsDiagnosticOnly": True,
            "analyzerDescriptorsNotSemanticGates": True,
            "trackSummaryDerivedNotGate": True,
            "priorModelAgreementNotProviderInput": True,
            "proposalCountNotSemanticCriterion": True,
            "timingAuthority": "frozen-analyzer-derived-anchor-only",
        },
        "sizeSummaryBytes": {
            "packet": {"min": min(packet_sizes), "median": statistics.median(packet_sizes), "max": max(packet_sizes)},
            "request": {"min": min(request_sizes), "median": statistics.median(request_sizes), "max": max(request_sizes)},
            "payload": {"min": min(payload_sizes), "median": statistics.median(payload_sizes), "max": max(payload_sizes)},
        },
        "tracks": rows_out,
    }

    manifest_path = out / "STAGE1_V7_PREP_MANIFEST_V1.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    files_path, entries = write_files_manifest(out)

    print(json.dumps({
        "schema": manifest["schema"],
        "status": manifest["status"],
        "trackCount": 50,
        "manifestSha256": sha(manifest_path),
        "filesManifestSha256": sha(files_path),
        "filesManifestEntries": entries,
        "providerCallsObserved": 0,
        "referenceLabelsReadByPreparation": False,
        "terminalTracksProcessed": False,
        "analyzerExecuted": False,
        "compilerInvoked": False,
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

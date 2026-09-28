#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import subprocess
import sys
import zipfile
from pathlib import Path

MODEL = "gpt-6-sol"
REASONING_EFFORT = "high"
MAX_OUTPUT_TOKENS = 4096
DEVELOPMENT_REVISION = "stage1-drop-semantics-v2-structure-evidence-v2"
ANALYZER_RUNNER_SHA256 = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"
ANALYZER_SOURCE_COMMIT = "e308d867980fb1877c3f2e4ce27950deecac0855"
STRUCTURE_BUNDLE_SHA256 = "16858488f584ef85164241679c6dcf3675393e46ff33d99f8bde6b6617a7c4ca"
STRUCTURE_FREEZE_COMMIT = "708e824fd977a240e86dd9425a1a5e1b437775ad"


def fail(msg: str) -> None:
    raise SystemExit(f"V3 PREP FAIL-CLOSED: {msg}")


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha(path: Path) -> str:
    return sha_bytes(path.read_bytes())


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def run(cmd: list[str]) -> None:
    subprocess.run(cmd, check=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base-prep-root", type=Path, required=True)
    ap.add_argument("--v2-prep-root", type=Path, required=True)
    ap.add_argument("--structure-bundle", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--builder", type=Path, required=True)
    ap.add_argument("--adapter", type=Path, required=True)
    ap.add_argument("--exporter", type=Path, required=True)
    args = ap.parse_args()

    if sha(args.structure_bundle) != STRUCTURE_BUNDLE_SHA256:
        fail("Structure Evidence v2 bundle SHA-256 mismatch")
    base_manifest_path = args.base_prep_root / "STAGE1_PREP_MANIFEST_V1.json"
    v2_manifest_path = args.v2_prep_root / "STAGE1_V2_PREP_MANIFEST_V1.json"
    base = load(base_manifest_path)
    v2 = load(v2_manifest_path)
    if base.get("schema") != "trackcade-semantic-external-stage1-prep-v1" or base.get("trackCount") != 50:
        fail("base prep schema/count mismatch")
    if v2.get("schema") != "trackcade-semantic-external-stage1-v2-prep-v1" or v2.get("trackCount") != 50:
        fail("V2 prep schema/count mismatch")
    for doc, label in ((base, "base"), (v2, "v2")):
        if doc.get("referenceLabelsReadByPreparation") is not False or doc.get("terminalTracksProcessed") is not False:
            fail(f"{label} prep research-boundary mismatch")
    if v2.get("developmentRevision") != "stage1-drop-semantics-v2":
        fail("V2 prep revision mismatch")

    import importlib.util
    spec = importlib.util.spec_from_file_location("trackcade_export_structure_v2", args.exporter)
    exporter = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(exporter)

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    rows_out = []
    base_by_id = {r["id"]: r for r in base["tracks"]}
    v2_rows = sorted(v2["tracks"], key=lambda r: r["ordinal"])

    with zipfile.ZipFile(args.structure_bundle) as z:
        names = set(z.namelist())
        if "MANIFEST.json" not in names:
            fail("structure bundle MANIFEST missing")
        bundle_manifest = json.loads(z.read("MANIFEST.json"))
        if bundle_manifest.get("schema") != "trackcade-stage1-structure-evidence-v2-bundle":
            fail("structure bundle manifest schema mismatch")
        if bundle_manifest.get("policy") != "current-core-accent-table-v2":
            fail("structure bundle policy mismatch")
        manifest_files = bundle_manifest.get("files") or {}
        if len(manifest_files) != 100:
            fail("structure bundle must bind exactly 100 packet/map files")

        for row in v2_rows:
            ordinal = row["ordinal"]
            track_id = row["id"]
            stem = row["stem"]
            if ordinal < 1 or ordinal > 50:
                fail("invalid ordinal")
            if track_id not in base_by_id:
                fail(f"missing base identity ordinal {ordinal}")
            old = base_by_id[track_id]
            for key in ("ordinal", "id", "stem", "analysisJsonSha256", "analyzerRunnerSha256", "analyzerSourceCommit"):
                if old.get(key) != row.get(key):
                    fail(f"base/V2 linkage mismatch ordinal {ordinal}: {key}")
            if row.get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256 or row.get("analyzerSourceCommit") != ANALYZER_SOURCE_COMMIT:
                fail(f"Analyzer identity mismatch ordinal {ordinal}")
            if row.get("compilerEligible") is not True or row.get("timingTier") not in {"standard", "loose"}:
                fail(f"unexpected Stage 1 eligibility ordinal {ordinal}")

            case_rel = f"cases/{ordinal:02d}-{stem}"
            packet_name = f"{case_rel}/structure-evidence-v2.json"
            map_name = f"{case_rel}/structure-evidence-v2-source-map.json"
            if packet_name not in names or map_name not in names:
                fail(f"bundle case missing ordinal {ordinal}")
            packet_bytes = z.read(packet_name)
            map_bytes = z.read(map_name)
            for name, data in ((packet_name, packet_bytes), (map_name, map_bytes)):
                meta = manifest_files.get(name)
                if not isinstance(meta, dict) or meta.get("sha256") != sha_bytes(data) or meta.get("bytes") != len(data):
                    fail(f"bundle manifest file identity mismatch: {name}")

            packet = json.loads(packet_bytes)
            source_map = json.loads(map_bytes)
            if packet.get("sourceMapSha256") != sha_bytes(exporter.canonical(source_map)):
                fail(f"source-map binding mismatch ordinal {ordinal}")
            if packet.get("source", {}).get("analysisJsonSha256") != row["analysisJsonSha256"]:
                fail(f"packet analysis identity mismatch ordinal {ordinal}")
            if packet.get("source", {}).get("analyzerRunnerSha256") != ANALYZER_RUNNER_SHA256:
                fail(f"packet Analyzer identity mismatch ordinal {ordinal}")

            base_case = args.base_prep_root / case_rel
            v2_case = args.v2_prep_root / case_rel
            analysis_path = base_case / "analysis-v019.json"
            old_packet_path = v2_case / "interpretation-packet-v1.json"
            old_evidence_path = v2_case / "structure-evidence-v1.json"
            if sha(analysis_path) != row["analysisJsonSha256"]:
                fail(f"analysis bytes mismatch ordinal {ordinal}")
            if sha(old_packet_path) != row["hashes"]["interpretationPacketSha256"]:
                fail(f"interpretation packet mismatch ordinal {ordinal}")
            if sha(old_evidence_path) != row["hashes"]["structureEvidenceSha256"]:
                fail(f"structure evidence v1 mismatch ordinal {ordinal}")
            exporter.validate(
                packet,
                source_map,
                analysis_path.read_bytes(),
                old_packet_path.read_bytes(),
                row["hashes"]["structureEvidenceSha256"],
            )

            dst = out / case_rel
            dst.mkdir(parents=True, exist_ok=True)
            packet_path = dst / "structure-evidence-v2.json"
            source_map_path = dst / "structure-evidence-v2-source-map.json"
            packet_path.write_bytes(packet_bytes)
            source_map_path.write_bytes(map_bytes)

            request = dst / "learned-request-v3.json"
            diff = dst / "instruction-diff-v3.json"
            payload = dst / "openai-payload-v3.json"
            report = dst / "openai-adapter-prepare-report-v3.json"
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

            req = load(request)
            adapter_report = load(report)
            if req.get("integrity", {}).get("developmentRevision") != DEVELOPMENT_REVISION:
                fail(f"request revision mismatch ordinal {ordinal}")
            if req.get("integrity", {}).get("packetSha256") != sha_bytes(packet_bytes):
                fail(f"request packet identity mismatch ordinal {ordinal}")
            if req.get("integrity", {}).get("sourceMapSha256") != packet["sourceMapSha256"]:
                fail(f"request source-map binding mismatch ordinal {ordinal}")
            if adapter_report.get("status") != "payload_prepared_no_provider_call":
                fail(f"adapter prepare status mismatch ordinal {ordinal}")
            if adapter_report.get("requestedModel") != MODEL or adapter_report.get("reasoningEffort") != REASONING_EFFORT:
                fail(f"adapter model/reasoning mismatch ordinal {ordinal}")
            if adapter_report.get("maxOutputTokens") != MAX_OUTPUT_TOKENS or adapter_report.get("store") is not False:
                fail(f"adapter output/store mismatch ordinal {ordinal}")

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
            if "aliases" in json.dumps(provider_input).lower() or "aliascolumns" in json.dumps(provider_input).lower():
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
                "bytes": {
                    "structureEvidenceV2": len(packet_bytes),
                    "sourceMapStoredNotProviderInput": len(map_bytes),
                    "request": request.stat().st_size,
                    "openaiPayload": payload.stat().st_size,
                },
                "hashes": {
                    "structureEvidenceV2Sha256": sha_bytes(packet_bytes),
                    "sourceMapSha256": sha_bytes(exporter.canonical(source_map)),
                    "learnedRequestV3Sha256": sha(request),
                    "instructionDiffV3Sha256": sha(diff),
                    "openaiPayloadV3Sha256": sha(payload),
                    "adapterPrepareReportV3Sha256": sha(report),
                },
            })

    if [r["ordinal"] for r in rows_out] != list(range(1, 51)):
        fail("ordinal closure failed")
    if len({r["id"] for r in rows_out}) != 50:
        fail("track identity uniqueness failed")

    payload_total = sum(r["bytes"]["openaiPayload"] for r in rows_out)
    request_total = sum(r["bytes"]["request"] for r in rows_out)
    packet_total = sum(r["bytes"]["structureEvidenceV2"] for r in rows_out)
    manifest = {
        "schema": "trackcade-semantic-external-stage1-v3-prep-v1",
        "status": "frozen-v3-provider-payloads-prepared-no-provider-call",
        "developmentRevision": DEVELOPMENT_REVISION,
        "trackCount": 50,
        "sourceStructureEvidenceV2": {
            "freezeCommit": STRUCTURE_FREEZE_COMMIT,
            "bundleSha256": STRUCTURE_BUNDLE_SHA256,
            "policy": "current-core-accent-table-v2",
        },
        "basePrepManifestSha256": sha(base_manifest_path),
        "v2PrepManifestSha256": sha(v2_manifest_path),
        "builderSha256": sha(args.builder),
        "adapterSha256": sha(args.adapter),
        "exporterSha256": sha(args.exporter),
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
        },
        "footprint": {
            "packetBytesTotal": packet_total,
            "packetBytesMean": packet_total / 50,
            "requestBytesTotal": request_total,
            "requestBytesMean": request_total / 50,
            "openaiPayloadBytesTotal": payload_total,
            "openaiPayloadBytesMean": payload_total / 50,
            "tokenEstimateMethod": "No tokenizer invoked; no bytes/4 value is represented as billed token usage.",
        },
        "tracks": rows_out,
    }
    manifest_path = out / "STAGE1_V3_PREP_MANIFEST_V1.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    (out / "STAGE1_V3_PREP_MANIFEST_V1.json.sha256").write_text(
        f"{sha(manifest_path)}  STAGE1_V3_PREP_MANIFEST_V1.json\n",
        encoding="utf-8",
    )
    files = sorted(p for p in out.rglob("*") if p.is_file() and p.name != "FILES_SHA256.txt")
    with (out / "FILES_SHA256.txt").open("w", encoding="utf-8") as f:
        for p in files:
            f.write(f"{sha(p)}  {p.relative_to(out).as_posix()}\n")
    print(json.dumps({
        "schema": manifest["schema"],
        "trackCount": 50,
        "providerCalls": 0,
        "terminalTracksProcessed": False,
        "manifestSha256": sha(manifest_path),
        "openaiPayloadBytesTotal": payload_total,
        "openaiPayloadBytesMean": payload_total / 50,
    }, indent=2))


if __name__ == "__main__":
    main()

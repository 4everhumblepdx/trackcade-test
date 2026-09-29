#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

SOURCE_SCHEMA = "trackcade-semantic-external-stage1-v5-prep-v1"
OUTPUT_SCHEMA = "trackcade-semantic-external-stage1-v5-flex-prep-v1"
MODEL = "gpt-6-sol"
REASONING_EFFORT = "high"
MAX_OUTPUT_TOKENS = 8192
SERVICE_TIER = "flex"
DEVELOPMENT_REVISION = "stage1-drop-semantics-v5-candidate-first-absolute-pattern"
SOURCE_MANIFEST_SHA256 = "f93545e534b11bd207df3f032709f5cd3c1f198cf5529bbf04c0158c696f4799"
SOURCE_FILES_MANIFEST_SHA256 = "1393038c09afff244e4aeb2c745eb5a6f40c5f728991cec5051d3dfb4d34cb6c"
SOURCE_FILES_ENTRIES = 302
SOURCE_PREP_RUN_ID = 36645240283
SOURCE_PREP_HEAD_SHA = "fd6e06bf9b1cff11f257d4eb5c2e2703d913e745"
SOURCE_PREP_ARTIFACT_ID = 11068032294
SOURCE_PREP_ARTIFACT_NAME = "trackcade-semantic-external-stage1-v5-prep-v1"
SOURCE_PREP_ARTIFACT_DIGEST = "sha256:55db9b9144debbf71ec3ca780fd0ff6b91609221337045e4d6b43f02a822dc05"


def fail(msg: str) -> None:
    raise SystemExit(f"V5 FLEX PREP FAIL-CLOSED: {msg}")


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha(path: Path) -> str:
    return sha_bytes(path.read_bytes())


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def semantic_projection(payload: dict) -> dict:
    out = dict(payload)
    out.pop("service_tier", None)
    return out


def verify_source_files(root: Path) -> None:
    p = root / "FILES_SHA256.txt"
    if not p.is_file() or sha(p) != SOURCE_FILES_MANIFEST_SHA256:
        fail("source FILES_SHA256 identity mismatch")
    lines = [x for x in p.read_text(encoding="utf-8").splitlines() if x.strip()]
    if len(lines) != SOURCE_FILES_ENTRIES:
        fail(f"source FILES_SHA256 entry count mismatch: {len(lines)}")
    for line in lines:
        expected, rel = line.split("  ", 1)
        f = root / rel
        if not f.is_file() or sha(f) != expected:
            fail(f"source frozen file mismatch: {rel}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-prep-root", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()

    source_manifest_path = args.source_prep_root / "STAGE1_V5_PREP_MANIFEST_V1.json"
    if not source_manifest_path.is_file() or sha(source_manifest_path) != SOURCE_MANIFEST_SHA256:
        fail("source V5 prep manifest identity mismatch")
    verify_source_files(args.source_prep_root)
    src = load(source_manifest_path)
    if src.get("schema") != SOURCE_SCHEMA or src.get("status") != "frozen-v5-provider-payloads-prepared-no-provider-call":
        fail("source V5 prep schema/status mismatch")
    if src.get("developmentRevision") != DEVELOPMENT_REVISION or src.get("trackCount") != 50:
        fail("source V5 prep revision/count mismatch")
    if src.get("providerCallsObserved") != 0 or src.get("terminalTracksProcessed") is not False:
        fail("source V5 prep research boundary mismatch")
    if src.get("analyzerExecuted") is not False or src.get("audioDecoded") is not False or src.get("compilerInvoked") is not False:
        fail("source V5 Analyzer/audio/compiler boundary mismatch")
    mc = src.get("modelContract") or {}
    required_model_fields = {
        "provider": "openai", "api": "responses", "model": MODEL,
        "reasoningEffort": REASONING_EFFORT, "maxOutputTokens": MAX_OUTPUT_TOKENS,
        "store": False, "completedResponsesPerTrack": 0,
    }
    for key, value in required_model_fields.items():
        if mc.get(key) != value:
            fail(f"source V5 model contract mismatch: {key}")
    rationale = mc.get("maxOutputTokensRationale")
    if not isinstance(rationale, str) or "V4" not in rationale or "not a semantic threshold" not in rationale:
        fail("source V5 8192 rationale missing or unexpected")

    out = args.output_dir
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    source_rows = sorted(src.get("tracks") or [], key=lambda r: r.get("ordinal", 0))
    if [r.get("ordinal") for r in source_rows] != list(range(1, 51)):
        fail("source ordinal closure mismatch")

    for row in source_rows:
        ordinal, stem = row["ordinal"], row["stem"]
        src_case = args.source_prep_root / "cases" / f"{ordinal:02d}-{stem}"
        dst_case = out / "cases" / f"{ordinal:02d}-{stem}"
        dst_case.mkdir(parents=True, exist_ok=True)
        for name in ("structure-evidence-v2.json", "structure-evidence-v2-source-map.json", "learned-request-v5.json", "instruction-diff-v5.json", "openai-payload-v5.json", "openai-adapter-prepare-report-v5.json"):
            s = src_case / name
            if not s.is_file():
                fail(f"missing source file ordinal {ordinal}: {name}")
            shutil.copyfile(s, dst_case / name)
            if (dst_case / name).read_bytes() != s.read_bytes():
                fail(f"copy changed bytes ordinal {ordinal}: {name}")

        source_payload_path = src_case / "openai-payload-v5.json"
        if sha(source_payload_path) != row["hashes"]["openaiPayloadV5Sha256"]:
            fail(f"source payload row hash mismatch ordinal {ordinal}")
        source_payload = load(source_payload_path)
        if source_payload.get("model") != MODEL or source_payload.get("reasoning") != {"effort": REASONING_EFFORT}:
            fail(f"source model/reasoning mismatch ordinal {ordinal}")
        if source_payload.get("max_output_tokens") != MAX_OUTPUT_TOKENS or source_payload.get("store") is not False:
            fail(f"source output/store mismatch ordinal {ordinal}")
        if "service_tier" in source_payload:
            fail(f"source payload unexpectedly already fixes service_tier ordinal {ordinal}")

        amended = dict(source_payload)
        amended["service_tier"] = SERVICE_TIER
        if semantic_projection(amended) != source_payload:
            fail(f"semantic payload drift ordinal {ordinal}")
        amended_path = dst_case / "openai-payload-v5-flex.json"
        amended_path.write_text(json.dumps(amended, indent=2, sort_keys=True) + "\n", encoding="utf-8")
        semantic_sha = sha_bytes((json.dumps(source_payload, sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8"))
        amended_semantic_sha = sha_bytes((json.dumps(semantic_projection(amended), sort_keys=True, separators=(",", ":")) + "\n").encode("utf-8"))
        if semantic_sha != amended_semantic_sha:
            fail(f"semantic projection hash drift ordinal {ordinal}")

        rows.append({
            "ordinal": ordinal, "id": row["id"], "stem": stem,
            "sourceV5PayloadSha256": sha(source_payload_path),
            "amendedFlexPayloadSha256": sha(amended_path),
            "semanticProjectionSha256": semantic_sha,
            "structureEvidenceV2Sha256": row["hashes"]["structureEvidenceV2Sha256"],
            "learnedRequestV5Sha256": row["hashes"]["learnedRequestV5Sha256"],
        })

    manifest = {
        "schema": OUTPUT_SCHEMA,
        "status": "frozen-v5-flex-transport-payloads-prepared-no-provider-call",
        "developmentRevision": DEVELOPMENT_REVISION,
        "trackCount": 50,
        "sourceV5FrozenPrep": {
            "runId": SOURCE_PREP_RUN_ID, "headSha": SOURCE_PREP_HEAD_SHA,
            "artifactId": SOURCE_PREP_ARTIFACT_ID, "artifactName": SOURCE_PREP_ARTIFACT_NAME,
            "artifactDigest": SOURCE_PREP_ARTIFACT_DIGEST, "manifestSha256": SOURCE_MANIFEST_SHA256,
            "filesManifestSha256": SOURCE_FILES_MANIFEST_SHA256, "filesManifestEntries": SOURCE_FILES_ENTRIES,
        },
        "transportAmendment": {
            "provider": "openai", "api": "responses", "model": MODEL,
            "reasoningEffort": REASONING_EFFORT, "maxOutputTokens": MAX_OUTPUT_TOKENS,
            "store": False, "serviceTier": SERVICE_TIER,
            "allowedChangesOnly": ["service_tier"], "semanticPayloadUnchanged": True,
        },
        "referenceLabelsReadByPreparation": False,
        "terminalTracksProcessed": False,
        "analyzerExecuted": False,
        "audioDecoded": False,
        "providerCallsObserved": 0,
        "compilerInvoked": False,
        "tracks": rows,
    }
    manifest_path = out / "STAGE1_V5_FLEX_PREP_MANIFEST_V1.json"
    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True) + "\n", encoding="utf-8")

    file_rows = []
    for p in sorted(out.rglob("*")):
        if p.is_file() and p.name != "FILES_SHA256.txt":
            file_rows.append(f"{sha(p)}  {p.relative_to(out).as_posix()}")
    files_path = out / "FILES_SHA256.txt"
    files_path.write_text("\n".join(file_rows) + "\n", encoding="utf-8")

    print(json.dumps({
        "status": manifest["status"], "trackCount": 50, "providerCalls": 0,
        "serviceTier": SERVICE_TIER, "maxOutputTokens": MAX_OUTPUT_TOKENS,
        "semanticPayloadUnchanged": True, "manifestSha256": sha(manifest_path),
        "filesManifestSha256": sha(files_path), "filesManifestEntries": len(file_rows),
    }, indent=2))


if __name__ == "__main__":
    main()

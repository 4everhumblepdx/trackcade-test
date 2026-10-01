#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import shutil
from pathlib import Path

CANARY_ORDINAL = 1
DEVELOPMENT_REVISION = "stage1-drop-semantics-v7-orthogonal-structural-context"

SOURCE_MANIFEST_SHA256 = "455602ea8c5a721fac9b3381aca46285fe3c14f1fbcc36f0d08b4ffec01be875"
SOURCE_FILES_SHA256 = "9a55eff093ac8552ef8868c60d410b0b6ade0e243c11a5588066c9d16d9f3672"
SOURCE_FILES_ENTRIES = 301

FLEX_MANIFEST_SHA256 = "a41fdd4e4138fdfda18cda20004f609eb089aeb64ed1be486ee2442b1241a713"
FLEX_FILES_SHA256 = "18805ff58dd5580a7002bc9f7d3a9fa5042539f80ae4b7d1c8a9ddc62e1668f0"
FLEX_FILES_ENTRIES = 351


def fail(msg: str) -> None:
    raise SystemExit(f"V7 CANARY PREFLIGHT FAIL-CLOSED: {msg}")


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def verify_files(root: Path, expected_sha: str, expected_entries: int, label: str) -> None:
    manifest = root / "FILES_SHA256.txt"
    if not manifest.is_file() or sha(manifest) != expected_sha:
        fail(f"{label} FILES_SHA256 identity mismatch")
    lines = [line for line in manifest.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(lines) != expected_entries:
        fail(f"{label} FILES_SHA256 entry count mismatch: {len(lines)}")
    for line in lines:
        expected, rel = line.split("  ", 1)
        path = root / rel
        if not path.is_file() or sha(path) != expected:
            fail(f"{label} frozen file mismatch: {rel}")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-prep-root", type=Path, required=True)
    ap.add_argument("--flex-prep-root", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()

    source_manifest_path = args.source_prep_root / "STAGE1_V7_PREP_MANIFEST_V1.json"
    flex_manifest_path = args.flex_prep_root / "STAGE1_V7_FLEX8192_PREP_MANIFEST_V1.json"
    if not source_manifest_path.is_file() or sha(source_manifest_path) != SOURCE_MANIFEST_SHA256:
        fail("source V7 manifest identity mismatch")
    if not flex_manifest_path.is_file() or sha(flex_manifest_path) != FLEX_MANIFEST_SHA256:
        fail("Flex V7 manifest identity mismatch")
    verify_files(args.source_prep_root, SOURCE_FILES_SHA256, SOURCE_FILES_ENTRIES, "source")
    verify_files(args.flex_prep_root, FLEX_FILES_SHA256, FLEX_FILES_ENTRIES, "Flex")

    source = load(source_manifest_path)
    flex = load(flex_manifest_path)
    if source.get("schema") != "trackcade-semantic-external-stage1-v7-prep-v1":
        fail("source V7 schema mismatch")
    if source.get("status") != "frozen-v7-provider-payloads-prepared-no-provider-call":
        fail("source V7 status mismatch")
    if flex.get("schema") != "trackcade-semantic-external-stage1-v7-flex8192-prep-v1":
        fail("Flex V7 schema mismatch")
    if flex.get("status") != "frozen-v7-flex8192-transport-payloads-prepared-no-provider-call":
        fail("Flex V7 status mismatch")
    if source.get("developmentRevision") != DEVELOPMENT_REVISION or flex.get("developmentRevision") != DEVELOPMENT_REVISION:
        fail("V7 development revision mismatch")
    if source.get("trackCount") != 50 or flex.get("trackCount") != 50:
        fail("V7 track-count mismatch")

    for obj, label in ((source, "source"), (flex, "Flex")):
        if obj.get("providerCallsObserved") != 0:
            fail(f"{label} provider-call boundary mismatch")
        if obj.get("referenceLabelsReadByPreparation") is not False:
            fail(f"{label} label boundary mismatch")
        if obj.get("terminalTracksProcessed") is not False:
            fail(f"{label} terminal boundary mismatch")
        if obj.get("existingTerminalPhysicallyUnseenClaimAllowed") is not False:
            fail(f"{label} terminal-isolation declaration mismatch")
        if obj.get("analyzerExecuted") is not False or obj.get("audioDecoded") is not False:
            fail(f"{label} Analyzer/audio boundary mismatch")
        if obj.get("compilerInvoked") is not False:
            fail(f"{label} compiler boundary mismatch")

    if flex.get("paidCallsAuthorizedByThisManifest") is not False:
        fail("Flex manifest unexpectedly authorizes paid calls")
    amendment = flex.get("transportAmendment") or {}
    if amendment != {
        "provider": "openai",
        "api": "responses",
        "model": "gpt-6-sol",
        "reasoningEffort": "high",
        "maxOutputTokens": 8192,
        "store": False,
        "serviceTier": "flex",
        "allowedChangesOnly": ["service_tier"],
        "semanticPayloadUnchanged": True,
    }:
        fail("V7 Flex transport amendment mismatch")
    semantic = flex.get("semanticContractPreserved") or {}
    if semantic != {
        "structuralContextOrthogonalNotGate": True,
        "decisiveImpactRequiredForDrop": True,
        "decisiveImpactUnclearInsufficientForDrop": True,
    }:
        fail("V7 semantic-contract preservation mismatch")

    source_rows = [r for r in source.get("tracks") or [] if r.get("ordinal") == CANARY_ORDINAL]
    flex_rows = [r for r in flex.get("tracks") or [] if r.get("ordinal") == CANARY_ORDINAL]
    if len(source_rows) != 1 or len(flex_rows) != 1:
        fail("ordinal-1 row closure mismatch")
    sr, fr = source_rows[0], flex_rows[0]
    if sr.get("id") != fr.get("id") or sr.get("stem") != fr.get("stem"):
        fail("ordinal-1 identity mismatch between source and Flex")
    stem = sr["stem"]

    source_case = args.source_prep_root / "cases" / f"01-{stem}"
    flex_case = args.flex_prep_root / "cases" / f"01-{stem}"
    request = source_case / "learned-request-v7.json"
    packet = source_case / "structure-evidence-v2.json"
    source_payload = source_case / "openai-payload-v7.json"
    amended_payload = flex_case / "openai-payload-v7-flex8192.json"
    for path in (request, packet, source_payload, amended_payload):
        if not path.is_file():
            fail(f"missing ordinal-1 canary file: {path.name}")

    sh = sr.get("hashes") or {}
    if sha(request) != sh.get("learnedRequestV7Sha256"):
        fail("ordinal-1 request hash mismatch")
    if sha(packet) != sh.get("structureEvidenceV2Sha256"):
        fail("ordinal-1 packet hash mismatch")
    if sha(source_payload) != fr.get("sourceV7PayloadSha256"):
        fail("ordinal-1 source payload hash mismatch")
    if sha(amended_payload) != fr.get("amendedFlex8192PayloadSha256"):
        fail("ordinal-1 amended payload hash mismatch")

    source_payload_obj = load(source_payload)
    amended_payload_obj = load(amended_payload)
    projection = dict(amended_payload_obj)
    projection.pop("service_tier", None)
    if projection != source_payload_obj:
        fail("ordinal-1 semantic payload changed by transport amendment")
    if amended_payload_obj.get("model") != "gpt-6-sol":
        fail("ordinal-1 model mismatch")
    if amended_payload_obj.get("reasoning") != {"effort": "high"}:
        fail("ordinal-1 reasoning mismatch")
    if amended_payload_obj.get("max_output_tokens") != 8192:
        fail("ordinal-1 max-output mismatch")
    if amended_payload_obj.get("service_tier") != "flex":
        fail("ordinal-1 service-tier mismatch")
    if amended_payload_obj.get("store") is not False:
        fail("ordinal-1 store mismatch")

    out = args.output_dir
    if out.exists() and any(out.iterdir()):
        fail("output directory must be empty")
    out.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(request, out / "learned-request-v7.json")
    shutil.copyfile(packet, out / "structure-evidence-v2.json")
    shutil.copyfile(source_payload, out / "openai-payload-v7.json")
    shutil.copyfile(amended_payload, out / "openai-payload-v7-flex8192.json")

    status = {
        "schema": "trackcade-semantic-external-stage1-v7-canary-provider-case-v1",
        "stage": "stage1-v7",
        "purpose": "one-track-live-contract-behavior-canary",
        "developmentRevision": DEVELOPMENT_REVISION,
        "ordinal": CANARY_ORDINAL,
        "id": sr["id"],
        "stem": stem,
        "providerContract": {
            "provider": "openai",
            "api": "responses",
            "model": "gpt-6-sol",
            "reasoningEffort": "high",
            "maxOutputTokens": 8192,
            "serviceTier": "flex",
            "store": False,
        },
        "sourceRequestSha256": sha(request),
        "packetSha256": sha(packet),
        "sourcePayloadSha256": sha(source_payload),
        "amendedPayloadSha256": sha(amended_payload),
        "semanticProjectionSha256": fr["semanticProjectionSha256"],
        "semanticPayloadUnchanged": True,
        "providerCallAttempted": False,
        "providerResponseObserved": False,
        "providerCompletedSemanticResponse": False,
        "proposalValidated": False,
        "standardFallbackUsed": False,
        "retryAuthorized": False,
        "referenceLabelsRead": False,
        "scoringPerformed": False,
        "analyzerExecuted": False,
        "analyzerChanged": False,
        "compilerInvoked": False,
        "terminalTracksProcessed": False,
        "existingTerminalPhysicallyUnseenClaimAllowed": False,
        "classification": "offline_preflight_complete_no_provider_call",
        "errors": [],
    }
    status_path = out / "stage1-v7-canary-case-status-v1.json"
    status_path.write_text(json.dumps(status, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": status["classification"],
        "ordinal": CANARY_ORDINAL,
        "id": sr["id"],
        "stem": stem,
        "amendedPayloadSha256": status["amendedPayloadSha256"],
        "providerCalls": 0,
    }, indent=2))


if __name__ == "__main__":
    main()

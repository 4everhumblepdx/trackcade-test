#!/usr/bin/env python3
"""Offline V4 evidence verification/collection. Never opens benchmark labels or provider clients."""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import shutil
import zipfile

REVISION = "stage1-drop-semantics-v4-presence-relative-distinctiveness"
STATUS_FILE = "stage1-v4-flex8192-case-status-v1.json"
STATUS_SCHEMA = "trackcade-semantic-external-stage1-v4-flex8192-provider-case-v1"
VALID_CLASSIFICATION = "provider_completed_validated_v4_flex8192_proposal_no_retry"
CONTRACT = {
    "provider": "openai",
    "api": "responses",
    "model": "gpt-6-sol",
    "reasoningEffort": "high",
    "maxOutputTokens": 8192,
    "serviceTier": "flex",
    "store": False,
}
SOURCE_PREP_SCHEMA = "trackcade-semantic-external-stage1-v4-prep-v1"
AMENDED_PREP_SCHEMA = "trackcade-semantic-external-stage1-v4-flex8192-prep-v1"
SOURCE_MANIFEST = "STAGE1_V4_PREP_MANIFEST_V1.json"
AMENDED_MANIFEST = "STAGE1_V4_FLEX8192_PREP_MANIFEST_V1.json"
SOURCE_MANIFEST_SHA256 = "613937e6ae16a3b09762f8bbd4e3dcfc70881e8d4bf0eeebdafb6f86858cf972"
AMENDED_MANIFEST_SHA256 = "c294fc9e8017609673da03694c3b318b71706804380f8b06e7d4cb71c2dbc342"
ALLOWED_FILES = {
    STATUS_FILE,
    "raw-response.json",
    "proposal-candidate.json",
    "parameters.json",
    "normalized-proposal.json",
    "validation-report.json",
    "provider-run-manifest.json",
}
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def fail(message: str) -> None:
    raise ValueError("V4 COLLECTION FAIL-CLOSED: " + message)


def require(ok, message: str) -> None:
    if not ok:
        fail(message)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha(path: Path) -> str:
    return digest(Path(path).read_bytes())


def load(path: Path):
    return json.loads(Path(path).read_bytes())


def same(a, b) -> bool:
    return type(a) is type(b) and a == b


def check_fields(data: dict, expected: dict, context: str) -> None:
    for key, value in expected.items():
        require(same(data.get(key), value), f"{context}: {key} mismatch: {data.get(key)!r} != {value!r}")


def prep_rows(source_root: Path, amended_root: Path):
    source_root, amended_root = Path(source_root), Path(amended_root)
    source_path = source_root / SOURCE_MANIFEST
    amended_path = amended_root / AMENDED_MANIFEST
    require(sha(source_path) == SOURCE_MANIFEST_SHA256, "source prep manifest hash")
    require(sha(amended_path) == AMENDED_MANIFEST_SHA256, "amended prep manifest hash")
    source, amended = load(source_path), load(amended_path)
    check_fields(source, {
        "schema": SOURCE_PREP_SCHEMA,
        "trackCount": 50,
        "providerCallsObserved": 0,
        "terminalTracksProcessed": False,
        "analyzerExecuted": False,
        "audioDecoded": False,
        "compilerInvoked": False,
        "developmentRevision": REVISION,
    }, "source prep")
    check_fields(amended, {
        "schema": AMENDED_PREP_SCHEMA,
        "trackCount": 50,
        "providerCallsObserved": 0,
        "terminalTracksProcessed": False,
        "analyzerExecuted": False,
        "audioDecoded": False,
        "compilerInvoked": False,
    }, "amended prep")
    sr = source.get("tracks") or []
    ar = amended.get("tracks") or []
    require(len(sr) == 50 and len(ar) == 50, "prep row count")
    sm = {r.get("ordinal"): r for r in sr if isinstance(r, dict)}
    am = {r.get("ordinal"): r for r in ar if isinstance(r, dict)}
    require(set(sm) == set(range(1, 51)) and set(am) == set(range(1, 51)), "prep ordinals")
    for ordinal in range(1, 51):
        require(sm[ordinal].get("id") == am[ordinal].get("id"), f"prep id mismatch {ordinal}")
        require(sm[ordinal].get("stem") == am[ordinal].get("stem"), f"prep stem mismatch {ordinal}")
    return sm, am


def read_archive(zip_path: Path, artifact: dict) -> dict[str, bytes]:
    raw = Path(zip_path).read_bytes()
    require("sha256:" + digest(raw) == artifact.get("digest"), f"artifact {artifact.get('id')} digest")
    require(len(raw) == artifact.get("size_in_bytes"), f"artifact {artifact.get('id')} size")
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        require(len(names) == len(set(names)), "duplicate ZIP entries")
        require(set(names) == ALLOWED_FILES, f"unexpected ZIP contents for artifact {artifact.get('id')}: {sorted(names)}")
        require(sum(i.file_size for i in z.infolist()) <= 20_000_000, "ZIP expanded size limit")
        return {name: z.read(name) for name in names}


def inspect_case(files: dict[str, bytes], artifact: dict, run: dict, row: dict,
                 source_root: Path, amended_root: Path) -> dict:
    status = json.loads(files[STATUS_FILE])
    ordinal = row["ordinal"]
    stem = row["stem"]
    source_case = Path(source_root) / "cases" / f"{ordinal:02d}-{stem}"
    amended_case = Path(amended_root) / "cases" / f"{ordinal:02d}-{stem}"
    request_path = source_case / "learned-request-v4.json"
    packet_path = source_case / "structure-evidence-v2.json"
    source_payload_path = source_case / "openai-payload-v4.json"
    amended_payload_path = amended_case / "openai-payload-v4-flex8192.json"
    for p in (request_path, packet_path, source_payload_path, amended_payload_path):
        require(p.is_file(), f"missing frozen prep file {ordinal}/{p.name}")

    check_fields(status, {
        "schema": STATUS_SCHEMA,
        "stage": "stage1-v4",
        "transportAmendment": "flex8192",
        "ordinal": ordinal,
        "id": row["id"],
        "stem": stem,
        "developmentRevision": REVISION,
        "harnessSourceCommit": run["head_sha"],
        "providerContract": CONTRACT,
        "providerCallAttempted": True,
        "providerResponseObserved": True,
        "providerCompletedSemanticResponse": True,
        "standardFallbackUsed": False,
        "retryAuthorized": False,
        "compilerInvoked": False,
        "terminalTracksProcessed": False,
        "semanticPayloadUnchanged": True,
        "classification": VALID_CLASSIFICATION,
        "observedProviderStatus": "completed",
        "observedProviderServiceTier": "flex",
        "sourceRequestSha256": sha(request_path),
        "packetSha256": sha(packet_path),
        "sourcePayloadSha256": sha(source_payload_path),
        "amendedPayloadSha256": sha(amended_payload_path),
    }, f"case {ordinal}")
    require(status.get("errors") == [], f"case {ordinal}: status errors")

    file_bindings = {
        "raw-response.json": "rawResponseSha256",
        "proposal-candidate.json": "proposalCandidateSha256",
        "normalized-proposal.json": "normalizedProposalSha256",
        "validation-report.json": "validationReportSha256",
        "provider-run-manifest.json": "providerRunManifestSha256",
    }
    for name, key in file_bindings.items():
        require(isinstance(status.get(key), str) and HEX64.fullmatch(status[key]) is not None,
                f"case {ordinal}: missing {key}")
        require(digest(files[name]) == status[key], f"case {ordinal}: {name} hash")

    raw = json.loads(files["raw-response.json"])
    require(raw.get("object") == "response" and raw.get("status") == "completed", f"case {ordinal}: raw completion")
    require(raw.get("model") == "gpt-6-sol", f"case {ordinal}: raw model")
    require(raw.get("service_tier") == "flex", f"case {ordinal}: raw service tier")
    response_id = raw.get("id")
    require(isinstance(response_id, str) and response_id and response_id == status.get("observedProviderResponseId"),
            f"case {ordinal}: response identity")

    validation = json.loads(files["validation-report.json"])
    require(validation.get("status") == "valid" and validation.get("errors") == [], f"case {ordinal}: validation")
    require(validation.get("packetSha256") == status["packetSha256"], f"case {ordinal}: validation packet")
    require(validation.get("rawProviderResponseSha256") == status["rawResponseSha256"], f"case {ordinal}: validation raw")
    require(validation.get("proposalCandidateSha256") == status["proposalCandidateSha256"], f"case {ordinal}: validation candidate")
    require(validation.get("confidenceFieldsDiagnosticOnly") is True, f"case {ordinal}: confidence gate drift")

    manifest = json.loads(files["provider-run-manifest.json"])
    require(manifest.get("provider") == "openai" and manifest.get("model") == "gpt-6-sol", f"case {ordinal}: run manifest provider")
    require(manifest.get("developmentRevision") == REVISION, f"case {ordinal}: run manifest revision")
    trust = manifest.get("trust") or {}
    check_fields(trust, {
        "timingAuthority": "frozen-analyzer-derived-anchor-only",
        "confidenceFieldsDiagnosticOnly": True,
        "compilerInvokedByV4Experiment": False,
        "benchmarkReferencesUsedForGeneration": False,
    }, f"case {ordinal}: trust")

    proposal = json.loads(files["normalized-proposal.json"])
    decision = proposal.get("trackSemanticDecision") or {}
    presence = decision.get("dropPresence")
    require(presence in {"drop_present", "no_drop", "insufficient_semantic_evidence"}, f"case {ordinal}: dropPresence")
    events = proposal.get("events")
    comparisons = proposal.get("candidateComparisons")
    require(isinstance(events, list) and isinstance(comparisons, list), f"case {ordinal}: normalized arrays")
    drop_events = [e for e in events if isinstance(e, dict) and e.get("kind") == "drop"]
    require(len(drop_events) == status.get("dropProposalCount"), f"case {ordinal}: Drop count/status")
    require(len(comparisons) == status.get("candidateComparisonCount"), f"case {ordinal}: comparison count/status")
    require(decision.get("localizationStatus") == status.get("localizationStatus"), f"case {ordinal}: localization/status")
    if presence in {"no_drop", "insufficient_semantic_evidence"}:
        require(not drop_events, f"case {ordinal}: abstention contains Drop")
    for event in drop_events:
        require(not any(k in event for k in ("t", "time", "timestamp", "seconds")), f"case {ordinal}: independent timestamp")
        anchor = event.get("anchor")
        require(isinstance(anchor, dict) and anchor.get("type") == "evidence", f"case {ordinal}: Drop anchor")
        idx = anchor.get("index")
        require(isinstance(idx, int) and not isinstance(idx, bool) and idx >= 0, f"case {ordinal}: Drop anchor index")

    usage = status.get("usage") or {}
    for key in ("input_tokens", "output_tokens", "total_tokens"):
        require(isinstance(usage.get(key), int) and not isinstance(usage.get(key), bool) and usage[key] >= 0,
                f"case {ordinal}: usage {key}")

    return {
        "ordinal": ordinal,
        "id": row["id"],
        "stem": stem,
        "artifactId": artifact["id"],
        "artifactName": artifact["name"],
        "artifactDigest": artifact["digest"],
        "artifactSizeBytes": artifact["size_in_bytes"],
        "githubRunId": str(run["id"]),
        "githubRunAttempt": run["run_attempt"],
        "harnessSourceCommit": run["head_sha"],
        "openaiResponseId": response_id,
        "dropPresence": presence,
        "localizationStatus": decision.get("localizationStatus"),
        "candidateComparisonCount": len(comparisons),
        "dropProposalCount": len(drop_events),
        "usage": usage,
        "files": {name: digest(data) for name, data in sorted(files.items())},
        "packetSha256": status["packetSha256"],
        "sourcePayloadSha256": status["sourcePayloadSha256"],
        "amendedPayloadSha256": status["amendedPayloadSha256"],
        "normalizedProposalSha256": status["normalizedProposalSha256"],
    }


def collect(source_root: Path, amended_root: Path, artifact_root: Path,
            inventory: dict, output_dir: Path) -> dict:
    output_dir = Path(output_dir)
    require(not output_dir.exists(), "output already exists")
    sm, _ = prep_rows(source_root, amended_root)
    require(inventory.get("schema") == "trackcade-stage1-v4-generation-source-inventory-v1", "inventory schema")
    runs = inventory.get("runs") or []
    require(len(runs) == 2, "expected exactly two generation runs")
    selected = {}
    response_ids = set()
    observations = []
    for group in runs:
        run = group.get("run") or {}
        require(run.get("status") == "completed" and run.get("conclusion") == "success", "generation run not successful")
        require(run.get("run_attempt") == 1, "generation run attempt")
        require(run.get("head_branch") == "trackcade-semantic-external-holdout-v1", "generation branch")
        artifacts = group.get("artifacts") or []
        require(group.get("total_count") == len(artifacts), "artifact pagination/count")
        for artifact in artifacts:
            name = artifact.get("name", "")
            m = re.fullmatch(r"trackcade-semantic-external-stage1-v4-flex8192(?:-retry)?-v1-case-([1-9]|[1-4][0-9]|50)-completed", name)
            require(m is not None, f"unexpected V4 artifact name: {name}")
            ordinal = int(m.group(1))
            require(ordinal not in selected, f"duplicate completed ordinal {ordinal}")
            binding = artifact.get("workflow_run") or {}
            require(binding.get("id") == run.get("id") and binding.get("head_sha") == run.get("head_sha"), f"artifact/run binding {ordinal}")
            files = read_archive(Path(artifact_root) / f"{artifact['id']}.zip", artifact)
            entry = inspect_case(files, artifact, run, sm[ordinal], source_root, amended_root)
            require(entry["openaiResponseId"] not in response_ids, f"reused response id {ordinal}")
            response_ids.add(entry["openaiResponseId"])
            selected[ordinal] = entry
            observations.append(entry)
            case_out = output_dir / "provider" / f"{ordinal:02d}-{entry['stem']}"
            case_out.mkdir(parents=True, exist_ok=True)
            for file_name, data in files.items():
                (case_out / file_name).write_bytes(data)
    require(set(selected) == set(range(1, 51)), f"completed ordinals are not exactly 1..50: {sorted(selected)}")
    require(len(response_ids) == 50, "response ids not unique")
    audit = {
        "schema": "trackcade-semantic-external-stage1-v4-collection-v1",
        "status": "complete-ready-to-freeze",
        "expectedTracks": 50,
        "completedTracks": 50,
        "providerCallsMadeByCollector": 0,
        "compilerInvoked": False,
        "terminalTracksProcessed": False,
        "benchmarkLabelsRead": False,
        "observations": [selected[o] for o in range(1, 51)],
    }
    (output_dir / "STAGE1_V4_COLLECTION_AUDIT_V1.json").write_text(json.dumps(audit, indent=2, sort_keys=True) + "\n")
    freeze = {
        "schema": "trackcade-semantic-external-stage1-v4-generation-freeze-v1",
        "status": "frozen-exactly-50-completed-validated-responses-before-evaluation",
        "developmentRevision": REVISION,
        "transportAmendment": "flex8192",
        "providerContract": CONTRACT,
        "trackCount": 50,
        "providerCallsMadeByCollector": 0,
        "benchmarkLabelsRead": False,
        "terminalTracksProcessed": False,
        "compilerInvoked": False,
        "cases": {str(o): selected[o] for o in range(1, 51)},
    }
    (output_dir / "STAGE1_V4_GENERATION_FREEZE_V1.json").write_text(json.dumps(freeze, indent=2, sort_keys=True) + "\n")
    return freeze


def verify_freeze(freeze_path: Path, source_root: Path, provider_root: Path) -> dict[int, dict]:
    freeze = load(freeze_path)
    check_fields(freeze, {
        "schema": "trackcade-semantic-external-stage1-v4-generation-freeze-v1",
        "status": "frozen-exactly-50-completed-validated-responses-before-evaluation",
        "developmentRevision": REVISION,
        "transportAmendment": "flex8192",
        "providerContract": CONTRACT,
        "trackCount": 50,
        "providerCallsMadeByCollector": 0,
        "benchmarkLabelsRead": False,
        "terminalTracksProcessed": False,
        "compilerInvoked": False,
    }, "generation freeze")
    source_manifest = load(Path(source_root) / SOURCE_MANIFEST)
    sm = {r["ordinal"]: r for r in source_manifest["tracks"]}
    cases_doc = freeze.get("cases") or {}
    require(set(cases_doc) == {str(x) for x in range(1, 51)}, "freeze case keys")
    out = {}
    response_ids = set()
    for ordinal in range(1, 51):
        entry = cases_doc[str(ordinal)]
        row = sm[ordinal]
        case_dir = Path(provider_root) / f"{ordinal:02d}-{row['stem']}"
        require(case_dir.is_dir(), f"provider case missing {ordinal}")
        for name, expected in entry.get("files", {}).items():
            require((case_dir / name).is_file() and sha(case_dir / name) == expected, f"frozen provider file {ordinal}/{name}")
        status = load(case_dir / STATUS_FILE)
        require(status.get("classification") == VALID_CLASSIFICATION and status.get("providerCompletedSemanticResponse") is True,
                f"frozen status invalid {ordinal}")
        require(status.get("normalizedProposalSha256") == entry.get("normalizedProposalSha256"), f"frozen proposal binding {ordinal}")
        rid = entry.get("openaiResponseId")
        require(isinstance(rid, str) and rid not in response_ids, f"freeze response id {ordinal}")
        response_ids.add(rid)
        out[ordinal] = entry
    require(len(out) == 50 and len(response_ids) == 50, "freeze closure")
    return out

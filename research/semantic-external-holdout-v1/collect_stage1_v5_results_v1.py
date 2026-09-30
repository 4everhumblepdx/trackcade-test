#!/usr/bin/env python3
"""Offline V5 provider-evidence collector/freeze.

Never opens benchmark references and never calls a provider. It accepts an
explicit inventory of 50 already-completed immutable GitHub Actions artifacts,
verifies them against the frozen V5 prep, and emits the canonical generation
freeze used by the later RAW evaluator.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import zipfile

REVISION = "stage1-drop-semantics-v5-candidate-first-absolute-pattern"
SOURCE_PREP_SCHEMA = "trackcade-semantic-external-stage1-v5-prep-v1"
FLEX_PREP_SCHEMA = "trackcade-semantic-external-stage1-v5-flex-prep-v1"
SOURCE_MANIFEST = "STAGE1_V5_PREP_MANIFEST_V1.json"
FLEX_MANIFEST = "STAGE1_V5_FLEX_PREP_MANIFEST_V1.json"
SOURCE_MANIFEST_SHA256 = "f93545e534b11bd207df3f032709f5cd3c1f198cf5529bbf04c0158c696f4799"
FLEX_MANIFEST_SHA256 = "1b9c47e55463fafab4d1be94418b8ffb58e8b6799f2c5a527af40fa5f7d9c93e"
INVENTORY_SCHEMA = "trackcade-stage1-v5-generation-source-inventory-v1"
FREEZE_SCHEMA = "trackcade-semantic-external-stage1-v5-generation-freeze-v1"
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v4"
BRANCH = "trackcade-semantic-external-holdout-v1"
HEX64 = re.compile(r"^[0-9a-f]{64}$")

BASE_CONTRACT = {
    "provider": "openai", "api": "responses", "model": "gpt-6-sol",
    "reasoningEffort": "high", "maxOutputTokens": 8192,
    "serviceTier": "flex", "store": False,
}
RETRY_CONTRACT = {**BASE_CONTRACT, "maxOutputTokens": 16384}

VARIANTS = {
    "base8192": {
        "statusFile": "stage1-v5-flex-case-status-v1.json",
        "statusSchema": "trackcade-semantic-external-stage1-v5-flex-provider-case-v1",
        "contract": BASE_CONTRACT,
        "classification": "provider_completed_validated_v5_flex8192_proposal_no_retry",
        "allowedOrdinals": set(range(1, 51)) - {4, 35},
        "retry": False,
    },
    "retry4_16384": {
        "statusFile": "stage1-v5-flex16384-retry4-case-status-v1.json",
        "statusSchema": "trackcade-semantic-external-stage1-v5-flex16384-retry4-provider-case-v1",
        "contract": RETRY_CONTRACT,
        "classification": "provider_completed_validated_v5_flex16384_retry4_proposal_no_further_retry",
        "allowedOrdinals": {4},
        "retry": True,
    },
    "retry35_16384": {
        "statusFile": "stage1-v5-flex16384-retry35-case-status-v1.json",
        "statusSchema": "trackcade-semantic-external-stage1-v5-flex16384-retry35-provider-case-v1",
        "contract": RETRY_CONTRACT,
        "classification": "provider_completed_validated_v5_flex16384_retry35_proposal_no_further_retry",
        "allowedOrdinals": {35},
        "retry": True,
    },
}
CORE_FILES = {
    "raw-response.json", "proposal-candidate.json", "parameters.json",
    "normalized-proposal.json", "validation-report.json", "provider-run-manifest.json",
}
RETRY_PAYLOAD_FILES = {
    4: "openai-payload-v5-flex16384-retry4.json",
    35: "openai-payload-v5-flex16384-retry35.json",
}


def fail(message: str) -> None:
    raise ValueError("V5 COLLECTION FAIL-CLOSED: " + message)


def require(ok, message: str) -> None:
    if not ok:
        fail(message)


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha(path: Path) -> str:
    return digest(Path(path).read_bytes())


def load(path: Path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def check_fields(data: dict, expected: dict, context: str) -> None:
    for key, value in expected.items():
        require(type(data.get(key)) is type(value) and data.get(key) == value,
                f"{context}: {key} mismatch: {data.get(key)!r} != {value!r}")


def prep_rows(source_root: Path, flex_root: Path):
    source_path = Path(source_root) / SOURCE_MANIFEST
    flex_path = Path(flex_root) / FLEX_MANIFEST
    require(source_path.is_file() and sha(source_path) == SOURCE_MANIFEST_SHA256,
            "source prep manifest identity")
    require(flex_path.is_file() and sha(flex_path) == FLEX_MANIFEST_SHA256,
            "Flex prep manifest identity")
    source, flex = load(source_path), load(flex_path)
    check_fields(source, {
        "schema": SOURCE_PREP_SCHEMA, "trackCount": 50, "providerCallsObserved": 0,
        "terminalTracksProcessed": False, "analyzerExecuted": False,
        "audioDecoded": False, "compilerInvoked": False,
        "developmentRevision": REVISION,
    }, "source prep")
    check_fields(flex, {
        "schema": FLEX_PREP_SCHEMA, "trackCount": 50, "providerCallsObserved": 0,
        "terminalTracksProcessed": False, "analyzerExecuted": False,
        "audioDecoded": False, "compilerInvoked": False,
    }, "Flex prep")
    amendment = flex.get("transportAmendment") or {}
    check_fields(amendment, {
        "provider": "openai", "api": "responses", "model": "gpt-6-sol",
        "reasoningEffort": "high", "maxOutputTokens": 8192,
        "serviceTier": "flex", "store": False, "semanticPayloadUnchanged": True,
    }, "Flex amendment")
    sr, fr = source.get("tracks") or [], flex.get("tracks") or []
    require(len(sr) == 50 and len(fr) == 50, "prep track count")
    sm = {r.get("ordinal"): r for r in sr if isinstance(r, dict)}
    fm = {r.get("ordinal"): r for r in fr if isinstance(r, dict)}
    require(set(sm) == set(range(1, 51)) and set(fm) == set(range(1, 51)), "prep ordinals")
    for ordinal in range(1, 51):
        require(sm[ordinal].get("id") == fm[ordinal].get("id"), f"prep id mismatch {ordinal}")
        require(sm[ordinal].get("stem") == fm[ordinal].get("stem"), f"prep stem mismatch {ordinal}")
    return sm


def detect_variant(files: dict[str, bytes], ordinal: int):
    matches = [(name, spec) for name, spec in VARIANTS.items() if spec["statusFile"] in files]
    require(len(matches) == 1, f"ordinal {ordinal}: expected exactly one recognized status file")
    name, spec = matches[0]
    require(ordinal in spec["allowedOrdinals"], f"ordinal {ordinal}: variant {name} is not allowed")
    allowed = set(CORE_FILES) | {spec["statusFile"]}
    if spec["retry"]:
        allowed.add(RETRY_PAYLOAD_FILES[ordinal])
    require(set(files) == allowed,
            f"ordinal {ordinal}: unexpected archive file set: {sorted(set(files) - allowed)}")
    return name, spec


def read_archive(zip_path: Path, artifact: dict) -> dict[str, bytes]:
    raw = Path(zip_path).read_bytes()
    require("sha256:" + digest(raw) == artifact.get("digest"),
            f"artifact {artifact.get('id')} digest")
    if isinstance(artifact.get("size_in_bytes"), int):
        require(len(raw) == artifact["size_in_bytes"], f"artifact {artifact.get('id')} size")
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        require(len(names) == len(set(names)), f"artifact {artifact.get('id')}: duplicate ZIP entries")
        require(sum(i.file_size for i in z.infolist()) <= 25_000_000, "ZIP expanded size limit")
        require(all("/" not in n.rstrip("/") and "\\" not in n for n in names),
                "nested/path ZIP entry")
        return {name: z.read(name) for name in names}


def frozen_paths(source_root: Path, flex_root: Path, row: dict):
    ordinal, stem = row["ordinal"], row["stem"]
    source_case = Path(source_root) / "cases" / f"{ordinal:02d}-{stem}"
    flex_case = Path(flex_root) / "cases" / f"{ordinal:02d}-{stem}"
    paths = {
        "request": source_case / "learned-request-v5.json",
        "packet": source_case / "structure-evidence-v2.json",
        "sourcePayload": source_case / "openai-payload-v5.json",
        "flexPayload": flex_case / "openai-payload-v5-flex.json",
    }
    for key, path in paths.items():
        require(path.is_file(), f"ordinal {ordinal}: missing frozen {key}")
    return paths


def inspect_case(files: dict[str, bytes], artifact: dict, run: dict, row: dict,
                 source_root: Path, flex_root: Path) -> dict:
    ordinal = row["ordinal"]
    variant_name, spec = detect_variant(files, ordinal)
    status = json.loads(files[spec["statusFile"]])
    paths = frozen_paths(source_root, flex_root, row)
    check_fields(status, {
        "schema": spec["statusSchema"], "stage": "stage1-v5", "ordinal": ordinal,
        "id": row["id"], "stem": row["stem"], "developmentRevision": REVISION,
        "harnessSourceCommit": run["head_sha"], "providerContract": spec["contract"],
        "providerCallAttempted": True, "providerResponseObserved": True,
        "providerCompletedSemanticResponse": True, "standardFallbackUsed": False,
        "compilerInvoked": False, "terminalTracksProcessed": False,
        "semanticPayloadUnchanged": True, "classification": spec["classification"],
        "observedProviderStatus": "completed", "observedProviderServiceTier": "flex",
        "sourceRequestSha256": sha(paths["request"]), "packetSha256": sha(paths["packet"]),
        "sourcePayloadSha256": sha(paths["sourcePayload"]),
    }, f"ordinal {ordinal}")
    if spec["retry"]:
        require(status.get("additionalRetryAuthorized") is False, f"ordinal {ordinal}: further retry flag")
        require(status.get("transportOnlyChange") == {"field": "max_output_tokens", "from": 8192, "to": 16384},
                f"ordinal {ordinal}: retry transport delta")
        require(status.get("frozenFlex8192PayloadSha256") == sha(paths["flexPayload"]),
                f"ordinal {ordinal}: retry frozen Flex payload")
        retry_file = RETRY_PAYLOAD_FILES[ordinal]
        require(status.get("retryFlex16384PayloadSha256") == digest(files[retry_file]),
                f"ordinal {ordinal}: retry payload identity")
    else:
        require(status.get("retryAuthorized") is False, f"ordinal {ordinal}: retry flag")
        require(status.get("amendedPayloadSha256") == sha(paths["flexPayload"]),
                f"ordinal {ordinal}: Flex payload identity")
    require(status.get("errors") == [], f"ordinal {ordinal}: status errors")

    bindings = {
        "raw-response.json": "rawResponseSha256",
        "proposal-candidate.json": "proposalCandidateSha256",
        "normalized-proposal.json": "normalizedProposalSha256",
        "validation-report.json": "validationReportSha256",
        "provider-run-manifest.json": "providerRunManifestSha256",
    }
    for file_name, field in bindings.items():
        require(isinstance(status.get(field), str) and HEX64.fullmatch(status[field]) is not None,
                f"ordinal {ordinal}: missing {field}")
        require(digest(files[file_name]) == status[field], f"ordinal {ordinal}: {file_name} hash")

    raw = json.loads(files["raw-response.json"])
    require(raw.get("object") == "response" and raw.get("status") == "completed",
            f"ordinal {ordinal}: raw completion")
    require(raw.get("model") == "gpt-6-sol" and raw.get("service_tier") == "flex",
            f"ordinal {ordinal}: raw provider contract")
    response_id = raw.get("id")
    require(isinstance(response_id, str) and response_id and response_id == status.get("observedProviderResponseId"),
            f"ordinal {ordinal}: response id")

    validation = json.loads(files["validation-report.json"])
    check_fields(validation, {
        "status": "valid", "errors": [], "confidenceFieldsDiagnosticOnly": True,
        "trackSummaryDerivedNotGate": True, "repeatedSimilarDropsAllowed": True,
    }, f"ordinal {ordinal}: validation")
    require(validation.get("packetSha256") == status["packetSha256"], f"ordinal {ordinal}: validation packet")
    require(validation.get("rawProviderResponseSha256") == status["rawResponseSha256"],
            f"ordinal {ordinal}: validation raw")
    require(validation.get("proposalCandidateSha256") == status["proposalCandidateSha256"],
            f"ordinal {ordinal}: validation candidate")

    manifest = json.loads(files["provider-run-manifest.json"])
    require(manifest.get("provider") == "openai" and manifest.get("model") == "gpt-6-sol",
            f"ordinal {ordinal}: run manifest provider")
    require(manifest.get("developmentRevision") == REVISION, f"ordinal {ordinal}: run revision")
    check_fields(manifest.get("trust") or {}, {
        "timingAuthority": "frozen-analyzer-derived-anchor-only",
        "confidenceFieldsDiagnosticOnly": True, "trackSummaryDerivedNotGate": True,
        "repeatedSimilarDropsAllowed": True, "compilerInvokedByV5Experiment": False,
        "benchmarkReferencesUsedForGeneration": False,
    }, f"ordinal {ordinal}: trust")

    proposal = json.loads(files["normalized-proposal.json"])
    require(proposal.get("schema") == PROPOSAL_SCHEMA, f"ordinal {ordinal}: proposal schema")
    packet = load(paths["packet"])
    source, psource = proposal.get("source") or {}, packet.get("source") or {}
    require(source.get("analyzerRunnerSha256") == psource.get("analyzerRunnerSha256"),
            f"ordinal {ordinal}: Analyzer binding")
    require(source.get("analysisJsonSha256") == psource.get("analysisJsonSha256"),
            f"ordinal {ordinal}: analysis binding")
    assessments, summary, events = proposal.get("candidateAssessments"), proposal.get("trackSummary"), proposal.get("events")
    require(isinstance(assessments, list) and isinstance(summary, dict) and isinstance(events, list),
            f"ordinal {ordinal}: proposal structure")
    drop_assessments = [a for a in assessments if isinstance(a, dict) and a.get("semanticRole") == "drop"]
    ambiguous = [a for a in assessments if isinstance(a, dict) and a.get("semanticRole") == "ambiguous"]
    drop_events = [e for e in events if isinstance(e, dict) and e.get("kind") == "drop"]
    require(summary.get("dropCount") == len(drop_assessments) == len(drop_events),
            f"ordinal {ordinal}: derived Drop count")
    require(summary.get("ambiguousCandidateCount") == len(ambiguous),
            f"ordinal {ordinal}: derived ambiguous count")
    expected_presence = "drop_present" if drop_assessments else ("ambiguous_only" if ambiguous else "no_drop")
    require(summary.get("dropPresence") == expected_presence, f"ordinal {ordinal}: derived presence")
    require(status.get("dropProposalCount") == len(drop_events), f"ordinal {ordinal}: status Drop count")
    require(status.get("candidateAssessmentCount") == len(assessments), f"ordinal {ordinal}: assessment count")
    for event in drop_events:
        require(not any(k in event for k in ("t", "time", "timestamp", "seconds")),
                f"ordinal {ordinal}: independent timestamp")
        anchor = event.get("anchor")
        require(isinstance(anchor, dict) and anchor.get("type") == "evidence",
                f"ordinal {ordinal}: Drop anchor")
        idx = anchor.get("index")
        require(isinstance(idx, int) and not isinstance(idx, bool) and 0 <= idx < len(packet.get("anchors") or []),
                f"ordinal {ordinal}: Drop anchor index")

    usage = status.get("usage") or {}
    for key in ("input_tokens", "output_tokens", "total_tokens"):
        require(isinstance(usage.get(key), int) and not isinstance(usage.get(key), bool) and usage[key] >= 0,
                f"ordinal {ordinal}: usage {key}")
    reasoning = (usage.get("output_tokens_details") or {}).get("reasoning_tokens", 0)
    require(isinstance(reasoning, int) and not isinstance(reasoning, bool) and reasoning >= 0,
            f"ordinal {ordinal}: reasoning usage")

    return {
        "ordinal": ordinal, "id": row["id"], "stem": row["stem"],
        "transportVariant": variant_name, "maxOutputTokens": spec["contract"]["maxOutputTokens"],
        "artifactId": artifact["id"], "artifactName": artifact["name"],
        "artifactDigest": artifact["digest"], "artifactSizeBytes": artifact.get("size_in_bytes"),
        "githubRunId": str(run["id"]), "githubRunAttempt": run["run_attempt"],
        "harnessSourceCommit": run["head_sha"], "openaiResponseId": response_id,
        "dropPresence": summary["dropPresence"], "dropCount": summary["dropCount"],
        "ambiguousCandidateCount": summary["ambiguousCandidateCount"],
        "candidateAssessmentCount": len(assessments), "usage": usage,
        "files": {name: digest(data) for name, data in sorted(files.items())},
        "packetSha256": status["packetSha256"], "sourcePayloadSha256": status["sourcePayloadSha256"],
        "normalizedProposalSha256": status["normalizedProposalSha256"],
    }


def verify_freeze(freeze_path: Path, source_root: Path, provider_root: Path) -> dict[int, dict]:
    freeze = load(freeze_path)
    check_fields(freeze, {
        "schema": FREEZE_SCHEMA, "status": "frozen-complete-v5-generation-before-reference-access",
        "developmentRevision": REVISION, "trackCount": 50,
        "referenceLabelsReadByFreeze": False, "terminalTracksProcessed": False,
        "compilerInvoked": False, "analyzerExecuted": False,
    }, "generation freeze")
    cases = freeze.get("cases") or []
    require(len(cases) == 50, "generation freeze case count")
    by_ordinal = {c.get("ordinal"): c for c in cases if isinstance(c, dict)}
    require(set(by_ordinal) == set(range(1, 51)), "generation freeze ordinals")
    response_ids = set()
    for ordinal, entry in by_ordinal.items():
        case_root = Path(provider_root) / f"{ordinal:02d}-{entry['stem']}"
        require(case_root.is_dir(), f"freeze provider case missing {ordinal}")
        files = entry.get("files") or {}
        require(files and {p.name for p in case_root.iterdir() if p.is_file()} == set(files),
                f"freeze file set mismatch {ordinal}")
        for name, expected in files.items():
            require(HEX64.fullmatch(expected or "") is not None, f"freeze file hash format {ordinal}/{name}")
            require(sha(case_root / name) == expected, f"freeze file hash {ordinal}/{name}")
        require(entry.get("openaiResponseId") not in response_ids, f"duplicate frozen response id {ordinal}")
        response_ids.add(entry.get("openaiResponseId"))
    require(len(response_ids) == 50, "frozen response id uniqueness")
    return by_ordinal


def collect(source_root: Path, flex_root: Path, artifact_root: Path, inventory: dict, output_dir: Path) -> dict:
    output_dir = Path(output_dir)
    require(not output_dir.exists(), "output already exists")
    source_rows = prep_rows(source_root, flex_root)
    require(inventory.get("schema") == INVENTORY_SCHEMA, "inventory schema")
    cases = inventory.get("cases")
    require(isinstance(cases, list) and len(cases) == 50,
            "inventory must select exactly 50 completed cases")
    ordinals = [c.get("ordinal") for c in cases if isinstance(c, dict)]
    require(len(ordinals) == 50 and set(ordinals) == set(range(1, 51)),
            "inventory ordinals must be exactly 1..50")
    selected, response_ids = {}, set()
    for item in sorted(cases, key=lambda x: x["ordinal"]):
        ordinal = item["ordinal"]
        run, artifact = item.get("run") or {}, item.get("artifact") or {}
        require(run.get("id") and run.get("run_attempt") == 1, f"ordinal {ordinal}: run identity")
        require(run.get("head_branch") == BRANCH and run.get("status") == "completed",
                f"ordinal {ordinal}: run state/branch")
        require(isinstance(run.get("head_sha"), str) and re.fullmatch(r"[0-9a-f]{40}", run["head_sha"]),
                f"ordinal {ordinal}: run head SHA")
        require(isinstance(artifact.get("id"), int) and artifact["id"] > 0,
                f"ordinal {ordinal}: artifact id")
        require(isinstance(artifact.get("digest"), str) and artifact["digest"].startswith("sha256:"),
                f"ordinal {ordinal}: artifact digest")
        binding = artifact.get("workflow_run") or {}
        require(binding.get("id") == run.get("id") and binding.get("head_sha") == run.get("head_sha"),
                f"ordinal {ordinal}: artifact/run binding")
        zip_path = Path(artifact_root) / f"{artifact['id']}.zip"
        require(zip_path.is_file(), f"ordinal {ordinal}: artifact ZIP missing")
        files = read_archive(zip_path, artifact)
        entry = inspect_case(files, artifact, run, source_rows[ordinal], source_root, flex_root)
        require(entry["ordinal"] == ordinal, f"ordinal {ordinal}: selected artifact ordinal mismatch")
        require(entry["openaiResponseId"] not in response_ids, f"ordinal {ordinal}: reused provider response")
        response_ids.add(entry["openaiResponseId"])
        selected[ordinal] = entry
        case_out = output_dir / "provider" / f"{ordinal:02d}-{entry['stem']}"
        case_out.mkdir(parents=True, exist_ok=True)
        for name, data in files.items():
            (case_out / name).write_bytes(data)

    require(set(selected) == set(range(1, 51)) and len(response_ids) == 50, "50-case closure")
    retry_ordinals = sorted(o for o, e in selected.items() if e["transportVariant"].startswith("retry"))
    require(retry_ordinals == [4, 35],
            f"expected evidence-bound retries only at ordinals 4 and 35, got {retry_ordinals}")
    usage = {"input_tokens": 0, "output_tokens": 0, "reasoning_tokens": 0, "total_tokens": 0}
    for entry in selected.values():
        u = entry["usage"]
        usage["input_tokens"] += u["input_tokens"]
        usage["output_tokens"] += u["output_tokens"]
        usage["total_tokens"] += u["total_tokens"]
        usage["reasoning_tokens"] += (u.get("output_tokens_details") or {}).get("reasoning_tokens", 0)

    freeze = {
        "schema": FREEZE_SCHEMA, "status": "frozen-complete-v5-generation-before-reference-access",
        "developmentRevision": REVISION, "trackCount": 50,
        "referenceLabelsReadByFreeze": False, "terminalTracksProcessed": False,
        "compilerInvoked": False, "analyzerExecuted": False,
        "sourcePrepManifestSha256": SOURCE_MANIFEST_SHA256,
        "flexPrepManifestSha256": FLEX_MANIFEST_SHA256,
        "provider": "openai", "api": "responses", "model": "gpt-6-sol",
        "reasoningEffort": "high", "serviceTier": "flex", "store": False,
        "baseMaxOutputTokens": 8192, "evidenceBoundRetryMaxOutputTokens": 16384,
        "evidenceBoundRetryOrdinals": [4, 35], "usageTotals": usage,
        "cases": [selected[o] for o in range(1, 51)],
    }
    output_dir.mkdir(parents=True, exist_ok=True)
    freeze_path = output_dir / "STAGE1_V5_GENERATION_FREEZE_V1.json"
    freeze_path.write_text(json.dumps(freeze, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    inv_path = output_dir / "STAGE1_V5_GENERATION_SOURCE_INVENTORY_V1.json"
    inv_path.write_text(json.dumps(inventory, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    rows = []
    for p in sorted(output_dir.rglob("*")):
        if p.is_file() and p.name != "FILES_SHA256.txt":
            rows.append(f"{sha(p)}  {p.relative_to(output_dir).as_posix()}")
    files_path = output_dir / "FILES_SHA256.txt"
    files_path.write_text("\n".join(rows) + "\n", encoding="utf-8")
    print(json.dumps({
        "status": "frozen_complete_v5_generation_no_reference_access", "trackCount": 50,
        "generationFreezeSha256": sha(freeze_path), "filesManifestSha256": sha(files_path),
        "retryOrdinals": retry_ordinals, "usageTotals": usage,
    }, indent=2))
    return freeze


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-prep-root", type=Path, required=True)
    ap.add_argument("--flex-prep-root", type=Path, required=True)
    ap.add_argument("--artifact-root", type=Path, required=True)
    ap.add_argument("--inventory", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()
    collect(args.source_prep_root, args.flex_prep_root, args.artifact_root,
            load(args.inventory), args.output_dir)


if __name__ == "__main__":
    main()

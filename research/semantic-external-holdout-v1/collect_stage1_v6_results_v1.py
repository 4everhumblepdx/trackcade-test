#!/usr/bin/env python3
"""Offline Stage-1 V6 provider-evidence collector/freeze.

This collector never opens benchmark references and never calls a provider. It
accepts an explicit inventory of 50 already-completed immutable GitHub Actions
artifacts, verifies them against the frozen V6 semantic/Flex prep artifacts,
and emits the canonical label-blind V6 generation freeze.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import shutil
import zipfile

REVISION = "stage1-drop-semantics-v6-decisive-impact-ordinary-return-counterfactual"
SOURCE_SCHEMA = "trackcade-semantic-external-stage1-v6-prep-v1"
FLEX_SCHEMA = "trackcade-semantic-external-stage1-v6-flex8192-prep-v1"
SOURCE_MANIFEST = "STAGE1_V6_PREP_MANIFEST_V1.json"
FLEX_MANIFEST = "STAGE1_V6_FLEX8192_PREP_MANIFEST_V1.json"
SOURCE_MANIFEST_SHA256 = "ebdbf2232a813dbe89b87f4fb3bd938f037d6f15707943c2c0b639a15bc202c8"
FLEX_MANIFEST_SHA256 = "de9328b8cba76b82f879e348cc0b0133d33f53d2855b67885d3ed2b96afb9058"
INVENTORY_SCHEMA = "trackcade-stage1-v6-generation-source-inventory-v1"
FREEZE_SCHEMA = "trackcade-semantic-external-stage1-v6-generation-freeze-v1"
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v5"
BRANCH = "trackcade-semantic-external-holdout-v1"
HEX64 = re.compile(r"^[0-9a-f]{64}$")
CONTRACT = {
    "provider": "openai", "api": "responses", "model": "gpt-6-sol",
    "reasoningEffort": "high", "maxOutputTokens": 8192,
    "serviceTier": "flex", "store": False,
}

CANARY = {
    "statusFile": "stage1-v6-canary-case-status-v1.json",
    "statusSchema": "trackcade-semantic-external-stage1-v6-canary-provider-case-v1",
    "classification": "provider_completed_validated_v6_flex8192_canary_no_retry",
    "allowedOrdinals": {1},
}
REMAINING = {
    "statusFile": "stage1-v6-remaining49-case-status-v1.json",
    "statusSchema": "trackcade-semantic-external-stage1-v6-remaining49-provider-case-v1",
    "classification": "provider_completed_validated_v6_flex8192_remaining49_no_retry",
    "allowedOrdinals": set(range(2, 51)),
}
VARIANTS = {"canary": CANARY, "remaining49": REMAINING}
COMMON_FILES = {
    "learned-request-v6.json", "structure-evidence-v2.json",
    "openai-payload-v6.json", "openai-payload-v6-flex8192.json",
    "raw-response.json", "proposal-candidate.json", "normalized-proposal.json",
    "validation-report.json", "validator-stdout.txt", "validator-stderr.txt",
    "provider-step-exit-code.txt", "FILES_SHA256.txt",
}


def fail(message: str) -> None:
    raise ValueError("V6 COLLECTION FAIL-CLOSED: " + message)


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
    sp = source_root / SOURCE_MANIFEST
    fp = flex_root / FLEX_MANIFEST
    require(sp.is_file() and sha(sp) == SOURCE_MANIFEST_SHA256, "source prep manifest identity")
    require(fp.is_file() and sha(fp) == FLEX_MANIFEST_SHA256, "Flex prep manifest identity")
    source, flex = load(sp), load(fp)
    check_fields(source, {
        "schema": SOURCE_SCHEMA, "trackCount": 50, "providerCallsObserved": 0,
        "terminalTracksProcessed": False, "analyzerExecuted": False,
        "audioDecoded": False, "compilerInvoked": False,
        "developmentRevision": REVISION, "referenceLabelsReadByPreparation": False,
    }, "source prep")
    check_fields(flex, {
        "schema": FLEX_SCHEMA, "trackCount": 50, "providerCallsObserved": 0,
        "terminalTracksProcessed": False, "analyzerExecuted": False,
        "audioDecoded": False, "compilerInvoked": False,
        "developmentRevision": REVISION, "referenceLabelsReadByPreparation": False,
        "paidCallsAuthorizedByThisManifest": False,
    }, "Flex prep")
    check_fields(flex.get("transportAmendment") or {}, {
        **CONTRACT, "allowedChangesOnly": ["service_tier"],
        "semanticPayloadUnchanged": True,
    }, "Flex amendment")
    sr, fr = source.get("tracks") or [], flex.get("tracks") or []
    require(len(sr) == 50 and len(fr) == 50, "prep track count")
    sm = {r.get("ordinal"): r for r in sr if isinstance(r, dict)}
    fm = {r.get("ordinal"): r for r in fr if isinstance(r, dict)}
    require(set(sm) == set(range(1, 51)) and set(fm) == set(range(1, 51)), "prep ordinals")
    for ordinal in range(1, 51):
        s, f = sm[ordinal], fm[ordinal]
        require(s.get("id") == f.get("id") and s.get("stem") == f.get("stem"), f"prep identity {ordinal}")
        h = s.get("hashes") or {}
        require(h.get("learnedRequestV6Sha256") == f.get("learnedRequestV6Sha256"), f"request binding {ordinal}")
        require(h.get("structureEvidenceV2Sha256") == f.get("structureEvidenceV2Sha256"), f"packet binding {ordinal}")
        require(h.get("openaiPayloadV6Sha256") == f.get("sourceV6PayloadSha256"), f"payload binding {ordinal}")
    return sm, fm


def frozen_paths(source_root: Path, flex_root: Path, srow: dict):
    ordinal, stem = srow["ordinal"], srow["stem"]
    scase = source_root / "cases" / f"{ordinal:02d}-{stem}"
    fcase = flex_root / "cases" / f"{ordinal:02d}-{stem}"
    paths = {
        "request": scase / "learned-request-v6.json",
        "packet": scase / "structure-evidence-v2.json",
        "sourcePayload": scase / "openai-payload-v6.json",
        "flexPayload": fcase / "openai-payload-v6-flex8192.json",
    }
    for key, path in paths.items():
        require(path.is_file(), f"ordinal {ordinal}: missing frozen {key}")
    return paths


def read_archive(zip_path: Path, artifact: dict) -> dict[str, bytes]:
    raw = zip_path.read_bytes()
    require("sha256:" + digest(raw) == artifact.get("digest"), f"artifact {artifact.get('id')} digest")
    if isinstance(artifact.get("size_in_bytes"), int):
        require(len(raw) == artifact["size_in_bytes"], f"artifact {artifact.get('id')} size")
    with zipfile.ZipFile(zip_path) as z:
        names = z.namelist()
        require(len(names) == len(set(names)), f"artifact {artifact.get('id')}: duplicate ZIP entries")
        require(all("/" not in n.rstrip("/") and "\\" not in n for n in names), "nested/path ZIP entry")
        require(sum(i.file_size for i in z.infolist()) <= 30_000_000, "ZIP expanded size limit")
        files = {name: z.read(name) for name in names}
    return files


def verify_internal_manifest(files: dict[str, bytes], ordinal: int) -> None:
    require("FILES_SHA256.txt" in files, f"ordinal {ordinal}: missing FILES_SHA256.txt")
    rows = files["FILES_SHA256.txt"].decode("utf-8").splitlines()
    observed = {}
    for line in rows:
        if not line.strip():
            continue
        require("  " in line, f"ordinal {ordinal}: malformed FILES_SHA256 row")
        expected, name = line.split("  ", 1)
        require(HEX64.fullmatch(expected) is not None, f"ordinal {ordinal}: malformed internal hash")
        require(name not in observed, f"ordinal {ordinal}: duplicate internal file {name}")
        observed[name] = expected
    expected_names = set(files) - {"FILES_SHA256.txt"}
    require(set(observed) == expected_names, f"ordinal {ordinal}: FILES_SHA256 inventory mismatch")
    for name, expected in observed.items():
        require(digest(files[name]) == expected, f"ordinal {ordinal}: internal hash mismatch {name}")


def detect_variant(files: dict[str, bytes], ordinal: int):
    matches = [(name, spec) for name, spec in VARIANTS.items() if spec["statusFile"] in files]
    require(len(matches) == 1, f"ordinal {ordinal}: expected exactly one recognized V6 status file")
    name, spec = matches[0]
    require(ordinal in spec["allowedOrdinals"], f"ordinal {ordinal}: variant {name} not allowed")
    allowed = set(COMMON_FILES) | {spec["statusFile"]}
    require(set(files) == allowed, f"ordinal {ordinal}: unexpected artifact files {sorted(set(files) ^ allowed)}")
    return name, spec


def inspect_case(files: dict[str, bytes], artifact: dict, run: dict, srow: dict, frow: dict,
                 source_root: Path, flex_root: Path) -> tuple[dict, bytes]:
    ordinal = srow["ordinal"]
    verify_internal_manifest(files, ordinal)
    variant_name, spec = detect_variant(files, ordinal)
    status = json.loads(files[spec["statusFile"]])
    paths = frozen_paths(source_root, flex_root, srow)
    check_fields(status, {
        "schema": spec["statusSchema"], "stage": "stage1-v6", "ordinal": ordinal,
        "id": srow["id"], "stem": srow["stem"], "harnessSourceCommit": run["head_sha"],
        "providerContract": CONTRACT, "providerCallAttempted": True,
        "providerResponseObserved": True, "providerCompletedSemanticResponse": True,
        "proposalValidated": True, "standardFallbackUsed": False,
        "retryAuthorized": False, "compilerInvoked": False,
        "terminalTracksProcessed": False, "semanticPayloadUnchanged": True,
        "classification": spec["classification"], "observedProviderStatus": "completed",
        "observedProviderServiceTier": "flex", "observedProviderModel": "gpt-6-sol",
        "sourceRequestSha256": sha(paths["request"]), "packetSha256": sha(paths["packet"]),
        "sourcePayloadSha256": sha(paths["sourcePayload"]),
        "amendedPayloadSha256": sha(paths["flexPayload"]),
        "semanticProjectionSha256": frow["semanticProjectionSha256"],
        "errors": [], "validatorExitCode": 0,
    }, f"ordinal {ordinal}")
    if variant_name == "remaining49":
        require(status.get("stage1ReferencesOpened") is False, f"ordinal {ordinal}: references flag")
    require(files["provider-step-exit-code.txt"] in {b"0", b"0\n", b"0\r\n"}, f"ordinal {ordinal}: provider step exit receipt")
    for file_name, field in {
        "raw-response.json": "rawResponseSha256",
        "proposal-candidate.json": "proposalCandidateSha256",
        "normalized-proposal.json": "normalizedProposalSha256",
    }.items():
        value = status.get(field)
        require(isinstance(value, str) and HEX64.fullmatch(value) is not None, f"ordinal {ordinal}: missing {field}")
        require(digest(files[file_name]) == value, f"ordinal {ordinal}: {file_name} hash")

    raw = json.loads(files["raw-response.json"])
    check_fields(raw, {"object": "response", "status": "completed", "model": "gpt-6-sol", "service_tier": "flex"}, f"ordinal {ordinal}: raw")
    response_id = raw.get("id")
    require(isinstance(response_id, str) and response_id and response_id == status.get("observedProviderResponseId"), f"ordinal {ordinal}: response id")
    usage = raw.get("usage")
    require(isinstance(usage, dict), f"ordinal {ordinal}: raw usage")
    require(status.get("usage") == usage, f"ordinal {ordinal}: status/raw usage mismatch")

    validation = json.loads(files["validation-report.json"])
    check_fields(validation, {
        "schema": "trackcade-learned-proposal-validation-v6", "status": "valid", "errors": [],
        "confidenceFieldsDiagnosticOnly": True, "trackSummaryDerivedNotGate": True,
        "repeatedSimilarDropsAllowed": True, "decisiveImpactRequiredForDrop": True,
        "ordinaryReturnMustBeRuledOutForDrop": True, "analyzerDescriptorsNotSemanticGates": True,
        "timingAuthority": "frozen-analyzer-derived-anchor-only",
    }, f"ordinal {ordinal}: validation")

    proposal_bytes = files["normalized-proposal.json"]
    proposal = json.loads(proposal_bytes)
    require(proposal.get("schema") == PROPOSAL_SCHEMA, f"ordinal {ordinal}: proposal schema")
    packet = load(paths["packet"])
    source, psource = proposal.get("source") or {}, packet.get("source") or {}
    require(source.get("analyzerRunnerSha256") == psource.get("analyzerRunnerSha256"), f"ordinal {ordinal}: Analyzer binding")
    require(source.get("analysisJsonSha256") == psource.get("analysisJsonSha256"), f"ordinal {ordinal}: analysis binding")
    assessments = proposal.get("candidateAssessments"); events = proposal.get("events"); summary = proposal.get("trackSummary")
    require(isinstance(assessments, list) and isinstance(events, list) and isinstance(summary, dict), f"ordinal {ordinal}: proposal structure")
    drops = [a for a in assessments if isinstance(a, dict) and a.get("semanticRole") == "drop"]
    ambiguous = [a for a in assessments if isinstance(a, dict) and a.get("semanticRole") == "ambiguous"]
    drop_events = [e for e in events if isinstance(e, dict) and e.get("kind") == "drop"]
    for a in drops:
        require(a.get("preparation") == "clear", f"ordinal {ordinal}: Drop preparation")
        require(a.get("decisiveImpact") == "clear", f"ordinal {ordinal}: Drop decisive impact")
        require(a.get("sustainedStrongerPassage") == "clear", f"ordinal {ordinal}: Drop sustained passage")
        require(a.get("ordinaryReturnAlternative") == "ruled_out", f"ordinal {ordinal}: Drop ordinary-return counterfactual")
    require(summary.get("dropCount") == len(drops) == len(drop_events), f"ordinal {ordinal}: derived Drop count")
    require(summary.get("ambiguousCandidateCount") == len(ambiguous), f"ordinal {ordinal}: derived ambiguous count")
    presence = "drop_present" if drops else ("ambiguous_only" if ambiguous else "no_drop")
    require(summary.get("dropPresence") == presence, f"ordinal {ordinal}: derived presence")
    require({a.get("anchor") for a in drops} == {e.get("anchor") for e in drop_events}, f"ordinal {ordinal}: Drop event/assessment anchor equality")

    ud = usage.get("input_tokens_details") or {}; od = usage.get("output_tokens_details") or {}
    entry = {
        "ordinal": ordinal, "id": srow["id"], "stem": srow["stem"], "variant": variant_name,
        "run": run, "artifact": artifact, "openaiResponseId": response_id,
        "normalizedProposalSha256": digest(proposal_bytes), "rawResponseSha256": digest(files["raw-response.json"]),
        "packetSha256": status["packetSha256"], "dropCount": len(drops),
        "ambiguousCandidateCount": len(ambiguous), "candidateAssessmentCount": len(assessments),
        "eventCount": len(events), "usage": {
            "inputTokens": usage.get("input_tokens"), "cacheWriteTokens": ud.get("cache_write_tokens", 0),
            "cachedTokens": ud.get("cached_tokens", 0), "outputTokens": usage.get("output_tokens"),
            "reasoningTokens": od.get("reasoning_tokens", 0), "totalTokens": usage.get("total_tokens"),
        },
        "files": {name: digest(data) for name, data in sorted(files.items())},
    }
    for key, value in entry["usage"].items():
        require(isinstance(value, int) and value >= 0, f"ordinal {ordinal}: usage {key}")
    return entry, proposal_bytes


def collect(source_root: Path, flex_root: Path, artifact_root: Path, inventory: dict, output_dir: Path) -> None:
    srows, frows = prep_rows(source_root, flex_root)
    require(inventory.get("schema") == INVENTORY_SCHEMA, "inventory schema")
    rows = inventory.get("cases")
    require(isinstance(rows, list) and len(rows) == 50, "inventory case count")
    require([r.get("ordinal") for r in rows] == list(range(1, 51)), "inventory ordinals/order")
    entries, proposals = [], {}
    seen_artifacts, seen_responses = set(), set()
    for inv in rows:
        ordinal = inv["ordinal"]; run = inv.get("run") or {}; artifact = inv.get("artifact") or {}
        check_fields(run, {"run_attempt": 1, "head_branch": BRANCH, "status": "completed"}, f"ordinal {ordinal}: run")
        require(run.get("conclusion") in {"success", "failure"}, f"ordinal {ordinal}: run conclusion")
        require(isinstance(run.get("id"), int) and isinstance(run.get("head_sha"), str), f"ordinal {ordinal}: run identity")
        require(isinstance(artifact.get("id"), int) and artifact["id"] not in seen_artifacts, f"ordinal {ordinal}: artifact identity")
        seen_artifacts.add(artifact["id"])
        require(artifact.get("expired") is False, f"ordinal {ordinal}: artifact expired")
        require((artifact.get("workflow_run") or {}).get("id") == run["id"], f"ordinal {ordinal}: artifact run binding")
        require((artifact.get("workflow_run") or {}).get("head_sha") == run["head_sha"], f"ordinal {ordinal}: artifact head binding")
        zip_path = artifact_root / f"{artifact['id']}.zip"
        require(zip_path.is_file(), f"ordinal {ordinal}: missing artifact ZIP")
        files = read_archive(zip_path, artifact)
        entry, proposal_bytes = inspect_case(files, artifact, run, srows[ordinal], frows[ordinal], source_root, flex_root)
        require(entry["openaiResponseId"] not in seen_responses, f"ordinal {ordinal}: duplicate response id")
        seen_responses.add(entry["openaiResponseId"]); entries.append(entry); proposals[ordinal] = proposal_bytes

    require(len(entries) == 50 and len(seen_artifacts) == 50 and len(seen_responses) == 50, "complete unique 50-case set")
    require(entries[0]["variant"] == "canary" and all(e["variant"] == "remaining49" for e in entries[1:]), "1 canary + 49 remaining variants")
    totals = {k: sum(e["usage"][k] for e in entries) for k in entries[0]["usage"]}
    freeze = {
        "schema": FREEZE_SCHEMA, "status": "frozen-complete-v6-generation-before-reference-access",
        "developmentRevision": REVISION, "trackCount": 50, "referenceLabelsReadByFreeze": False,
        "partialScoringPerformed": False, "terminalTracksProcessed": False, "compilerInvoked": False,
        "analyzerExecuted": False, "providerCallsByFreeze": 0, "providerContract": CONTRACT,
        "ordinal1Source": "frozen-canary", "remainingSource": "authorized-remaining49-artifacts",
        "usageTotals": totals, "cases": entries,
    }
    output_dir.mkdir(parents=True, exist_ok=False)
    pdir = output_dir / "proposals"; pdir.mkdir()
    for ordinal, data in proposals.items():
        (pdir / f"{ordinal:02d}-{srows[ordinal]['stem']}.json").write_bytes(data)
    (output_dir / "STAGE1_V6_GENERATION_SOURCE_INVENTORY_V1.json").write_text(json.dumps(inventory, indent=2, sort_keys=True) + "\n")
    (output_dir / "STAGE1_V6_GENERATION_FREEZE_V1.json").write_text(json.dumps(freeze, indent=2, sort_keys=True) + "\n")
    rows_out=[]
    for p in sorted(x for x in output_dir.rglob('*') if x.is_file() and x.name != 'FILES_SHA256.txt'):
        rows_out.append(f"{sha(p)}  {p.relative_to(output_dir).as_posix()}")
    (output_dir / "FILES_SHA256.txt").write_text("\n".join(rows_out) + "\n")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source-prep-root", type=Path, required=True)
    ap.add_argument("--flex-prep-root", type=Path, required=True)
    ap.add_argument("--artifact-root", type=Path, required=True)
    ap.add_argument("--inventory", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    args = ap.parse_args()
    collect(args.source_prep_root, args.flex_prep_root, args.artifact_root, load(args.inventory), args.output_dir)


if __name__ == "__main__":
    main()

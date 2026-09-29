#!/usr/bin/env python3
"""Offline only: verify GitHub artifact ZIPs; freeze only a complete V3 set."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import tempfile
import zipfile

PREP_SHA = "df7ceff4c82291552a2d55dd7ddf872269477d0766bf4cb785a90b5730779257"
PREP_ID = "10986506165"
BASELINE_FILE = Path(__file__).with_name("STAGE1_V3_ARTIFACT_INVENTORY_V1.json")
BASELINE_SHA = "6cdd7853aaaf6128302bc627cb9e81b52cdb8542ed052214b05a270294cf91a4"
ANALYZER_SHA = "9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432"
ANALYZER_SOURCE = "e308d867980fb1877c3f2e4ce27950deecac0855"
REVISION = "stage1-drop-semantics-v2-structure-evidence-v2"
STATUS_FILE = "stage1-v3-case-status-v1.json"
FREEZE_FILE = "STAGE1_V3_GENERATION_FREEZE_V1.json"
FREEZE_STATUS = "frozen-exactly-50-completed-validated-responses-before-evaluation"
CONTRACT = dict(provider="openai", api="responses", model="gpt-6-sol",
                reasoningEffort="high", maxOutputTokens=4096, store=False)
VALID = "provider_completed_validated_v3_proposal_no_retry"
NAME = re.compile(r"trackcade-semantic-external-stage1-v3-sol-v1-case-([1-9]|[1-4][0-9]|50)-(completed|retry-eligible|no-retry-observed)")
FILES = {
    "raw-response.json": "rawResponseSha256",
    "normalized-proposal.json": "normalizedProposalSha256",
    "proposal-candidate.json": "proposalCandidateSha256",
    "adapter-report.json": "adapterReportSha256",
    "provider-run-manifest.json": "providerRunManifestSha256",
    "validation-report.json": "validationReportSha256",
    "openai-payload-v3.json": "livePayloadSha256",
    "preflight-openai-payload-v3.json": "preflightPayloadSha256",
}
ALLOWED = set(FILES) | {STATUS_FILE, "parameters.json", "preflight-openai-adapter-report-v3.json", "retry-provenance.json"}


def require(ok, message):
    if not ok:
        raise ValueError("V3 COLLECTION FAIL-CLOSED: " + message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def load(path):
    return json.loads(Path(path).read_bytes())


def same(actual, expected):
    # Do not let Python's True == 1 comparison weaken research boundaries.
    return type(actual) is type(expected) and actual == expected


def check_fields(data, expected, context):
    for key, value in expected.items():
        require(same(data.get(key), value), f"{context}: {key} mismatch")


def prep_rows(root):
    root = Path(root)
    raw = (root / "STAGE1_V3_PREP_MANIFEST_V1.json").read_bytes()
    require(digest(raw) == PREP_SHA, "frozen prep manifest hash")
    prep = json.loads(raw)
    rows = prep["tracks"]
    require(len(rows) == 50 and {r["ordinal"] for r in rows} == set(range(1, 51)), "prep ordinals")
    require(len({r["id"] for r in rows}) == 50, "prep identities")
    mapping = {
        "structure-evidence-v2.json": "structureEvidenceV2Sha256",
        "structure-evidence-v2-source-map.json": "sourceMapSha256",
        "learned-request-v3.json": "learnedRequestV3Sha256",
        "openai-payload-v3.json": "openaiPayloadV3Sha256",
        "instruction-diff-v3.json": "instructionDiffV3Sha256",
        "openai-adapter-prepare-report-v3.json": "adapterPrepareReportV3Sha256",
    }
    for row in rows:
        require(row["analyzerRunnerSha256"] == ANALYZER_SHA and row["analyzerSourceCommit"] == ANALYZER_SOURCE, "Analyzer identity")
        case = root / "cases" / f"{row['ordinal']:02d}-{row['stem']}"
        for name, key in mapping.items():
            require(digest((case / name).read_bytes()) == row["hashes"][key], f"prep file {row['ordinal']}/{name}")
    return {r["ordinal"]: r for r in rows}


def read_archive(path, artifact):
    raw = path.read_bytes()
    require("sha256:" + digest(raw) == artifact["digest"], f"artifact {artifact['id']} digest")
    require(len(raw) == artifact["size_in_bytes"], "artifact size")
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        require(len(names) == len(set(names)), "duplicate ZIP entries")
        require(set(names) <= ALLOWED and STATUS_FILE in names, "unexpected ZIP contents")
        require(sum(i.file_size for i in archive.infolist()) <= 20000000, "ZIP expanded size limit")
        return {n: archive.read(n) for n in names}


def inspect_case(files, artifact, run, row, suffix):
    status = json.loads(files[STATUS_FILE])
    retry_workflows = {
        ".github/workflows/trackcade-semantic-external-stage1-v3-retry-v1.yml": (42, 11028077891),
        ".github/workflows/trackcade-semantic-external-stage1-v3-retry-46-v1.yml": (46, 11030495842),
    }
    if run["path"] in retry_workflows:
        n, prior = retry_workflows[run["path"]]
        require(row["ordinal"] == n and "retry-provenance.json" in files, "retry provenance absent")
        check_fields(json.loads(files["retry-provenance.json"]), {
            "ticket": f"ordinal-{n}-evidence-{prior}-v1", "ordinal": n,
            "originalLock": f"refs/tags/trackcade-v3-provider-attempt-ordinal-{n}",
            "retryLock": f"refs/tags/trackcade-v3-retry-ordinal-{n}-evidence-{prior}-v1",
            "priorArtifactId": prior, "source": run["head_sha"], "runId": str(run["id"]),
        }, "retry provenance")
    else:
        require("retry-provenance.json" not in files, "unexpected retry provenance")
    ordinal = row["ordinal"]
    check_fields(status, {
        "schema": "trackcade-semantic-external-stage1-v3-provider-case-v1",
        "stage": "stage1-v3", "developmentRevision": REVISION,
        "ordinal": ordinal, "id": row["id"], "stem": row["stem"],
        "githubRunId": str(run["id"]), "githubRunAttempt": artifact.get("run_attempt", run["run_attempt"]),
        "harnessSourceCommit": run["head_sha"], "prepArtifactId": PREP_ID,
        "analyzerRunnerSha256": ANALYZER_SHA, "analyzerSourceCommit": ANALYZER_SOURCE,
        "analysisJsonSha256": row["analysisJsonSha256"],
        "sourceMapSha256": row["hashes"]["sourceMapSha256"],
        "compilerInvoked": False, "semanticRetryCount": 0,
        "providerContract": CONTRACT,
    }, f"case {ordinal}")
    for name, key in FILES.items():
        if key in status:
            require(name in files and digest(files[name]) == status[key], f"case {ordinal}: {name} hash")
    for name, key in (("openai-payload-v3.json", "livePayloadSha256"),
                      ("preflight-openai-payload-v3.json", "preflightPayloadSha256")):
        require(name in files and digest(files[name]) == row["hashes"]["openaiPayloadV3Sha256"], f"case {ordinal}: frozen payload")
        require(status.get(key) == row["hashes"]["openaiPayloadV3Sha256"], f"case {ordinal}: payload binding")
    require(status.get("frozenPayloadSha256") == row["hashes"]["openaiPayloadV3Sha256"], "frozen payload binding")
    raw = json.loads(files["raw-response.json"]) if "raw-response.json" in files else None
    completed = status.get("providerCompletedSemanticResponse")
    require(type(completed) is bool, "missing completion state")
    raw_completed = isinstance(raw, dict) and raw.get("object") == "response" and raw.get("status") == "completed"
    require(completed == raw_completed, "raw/status completion disagreement")
    if completed:
        require(suffix == "completed", "completed response hidden in non-completed artifact")
        check_fields(status, {"retryAuthorized": False, "providerResponseObserved": True,
                              "providerCallAttempted": True, "responseModel": "gpt-6-sol"}, "completed status")
        require(isinstance(raw.get("id"), str) and raw["id"] and raw["id"] == status.get("openaiResponseId"), "response identity")
        require(raw.get("model") == "gpt-6-sol", "raw model")
    else:
        require(suffix != "completed", "artifact falsely marked completed")
        if suffix == "retry-eligible":
            check_fields(status, {"retryAuthorized": True,
                "classification": "provider_infrastructure_no_completed_response"}, "retry status")
    validated = completed and status.get("classification") == VALID
    if validated:
        require(not status.get("errors"), "completed case has errors")
        require(all(n in files and k in status for n, k in FILES.items()), "validated response missing evidence")
    return status, validated


def verify_baseline(inventory):
    raw = BASELINE_FILE.read_bytes()
    require(digest(raw) == BASELINE_SHA, "historical artifact inventory changed")
    baseline = json.loads(raw)
    groups = {g["run"]["id"]: g for g in inventory["runs"]}
    for original in baseline["runs"]:
        group = groups.get(original["run"]["id"])
        require(group is not None, "historical run omitted")
        for key in ("id", "head_sha", "run_attempt", "head_branch", "path"):
            require(group["run"][key] == original["run"][key], "historical run identity changed")
        artifacts = {a["id"]: a for a in group["artifacts"]}
        for prior in original["artifacts"]:
            current = artifacts.get(prior["id"])
            require(current is not None, "historical artifact omitted")
            for key in ("name", "digest", "size_in_bytes", "workflow_run"):
                require(current[key] == prior[key], "historical artifact identity changed")


def audit(prep_root, artifact_root, inventory):
    verify_baseline(inventory)
    rows = prep_rows(prep_root)
    require(inventory.get("repository") == "4everhumblepdx/trackcade-test", "repository")
    require(inventory.get("branch") == "trackcade-semantic-external-holdout-v1", "branch")
    seen_artifacts, seen_runs, response_ids = set(), set(), set()
    selected, observations, blocked = {}, [], []
    for group in inventory["runs"]:
        run = group["run"]
        require(run["id"] not in seen_runs, "duplicate run inventory")
        seen_runs.add(run["id"])
        require(run["status"] == "completed", "run still active")
        require(run["head_branch"] == inventory["branch"], "run branch")
        require(run["path"] in {
            ".github/workflows/trackcade-semantic-external-stage1-v3-sol-v1.yml",
            ".github/workflows/trackcade-semantic-external-stage1-v3-single-resume-v1.yml",
            ".github/workflows/trackcade-semantic-external-stage1-v3-retry-v1.yml",
            ".github/workflows/trackcade-semantic-external-stage1-v3-retry-46-v1.yml",
        }, "run workflow")
        require(re.fullmatch(r"[0-9a-f]{40}", run["head_sha"]) is not None, "run source SHA")
        require(group["total_count"] == len(group["artifacts"]), "incomplete artifact pagination")
        for artifact in group["artifacts"]:
            aid = artifact["id"]
            require(type(aid) is int and aid > 0 and aid not in seen_artifacts, "duplicate/invalid artifact")
            seen_artifacts.add(aid)
            binding = artifact["workflow_run"]
            require(binding["id"] == run["id"] and binding["head_sha"] == run["head_sha"], "artifact/run source binding")
            match = NAME.fullmatch(artifact["name"])
            require(match is not None, "unexpected artifact name")
            ordinal, suffix = int(match[1]), match[2]
            files = read_archive(Path(artifact_root) / f"{aid}.zip", artifact)
            status, validated = inspect_case(files, artifact, run, rows[ordinal], suffix)
            entry = {
                "ordinal": ordinal, "id": rows[ordinal]["id"], "artifactId": aid,
                "artifactDigest": artifact["digest"], "artifactName": artifact["name"],
                "artifactSizeBytes": artifact["size_in_bytes"],
                "githubRunId": str(run["id"]), "githubRunAttempt": artifact.get("run_attempt", run["run_attempt"]),
                "harnessSourceCommit": run["head_sha"],
                "classification": status["classification"],
                "providerCallStartedAt": status.get("providerCallStartedAt"),
                "finishedAt": status.get("finishedAt"),
                "completed": status["providerCompletedSemanticResponse"], "validated": validated,
                "openaiResponseId": status.get("openaiResponseId"),
                "files": {n: digest(b) for n, b in sorted(files.items())},
            }
            observations.append(entry)
            if entry["completed"]:
                require(ordinal not in selected, f"duplicate completed response for case {ordinal}; no choosing winners")
                rid = entry["openaiResponseId"]
                require(rid not in response_ids, "response ID reused across cases")
                response_ids.add(rid)
                selected[ordinal] = (entry, files)
                if not validated:
                    blocked.append(ordinal)
            elif suffix != "retry-eligible":
                blocked.append(ordinal)
    for entry in observations:
        if not entry["completed"] and entry["ordinal"] in selected:
            completion = selected[entry["ordinal"]][0]
            require(isinstance(entry["providerCallStartedAt"], str)
                    and isinstance(completion["finishedAt"], str)
                    and entry["providerCallStartedAt"] < completion["finishedAt"],
                    "provider retry after a completed response")
    missing = sorted(set(range(1, 51)) - set(selected))
    result = {
        "schema": "trackcade-semantic-external-stage1-v3-collection-v1",
        "status": "complete-ready-to-freeze" if not missing and not blocked else "incomplete-or-blocked-no-evaluation",
        "expectedTracks": 50, "completedTracks": len(selected),
        "missingCompletedResponseOrdinals": missing, "blockedOrdinals": sorted(set(blocked)),
        "providerCallsMade": 0, "compilerInvoked": False, "terminalTracksProcessed": False,
        "evaluationPerformed": False, "observations": observations,
    }
    return result, selected


def write_json(path, value):
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def collect(prep_root, artifact_root, inventory_path, output_dir):
    output_dir = Path(output_dir)
    require(not output_dir.exists(), "output already exists; refusing to overwrite")
    inventory = load(inventory_path)
    result, selected = audit(prep_root, artifact_root, inventory)
    result["inventorySha256"] = digest(Path(inventory_path).read_bytes())
    result["prepManifestSha256"] = PREP_SHA
    result["baselineInventorySha256"] = BASELINE_SHA
    result["sourceIdentities"] = {name: digest(Path(__file__).with_name(name).read_bytes())
        for name in ("collect_stage1_v3_results_v1.py", "evaluate_stage1_v3_drop_v1.py", "evaluate_stage1_drop_v1.py")}
    output_dir.parent.mkdir(parents=True, exist_ok=True)
    # Publish the complete directory atomically. Failed validation never leaves a freeze.
    with tempfile.TemporaryDirectory(dir=output_dir.parent) as temporary:
        staging = Path(temporary) / "collection"
        staging.mkdir()
        write_json(staging / "STAGE1_V3_COLLECTION_AUDIT_V1.json", result)
        (staging / "github-inventory.json").write_bytes(Path(inventory_path).read_bytes())
        if result["status"] == "complete-ready-to-freeze":
            cases = []
            for ordinal, (entry, files) in sorted(selected.items()):
                case_dir = staging / "provider" / f"{ordinal:02d}"
                case_dir.mkdir(parents=True)
                for name, content in files.items():
                    (case_dir / name).write_bytes(content)
                cases.append(entry)
            freeze = {
                "schema": "trackcade-semantic-external-stage1-v3-generation-freeze-v1",
                "status": FREEZE_STATUS, "developmentRevision": REVISION,
                "trackCount": 50, "prepArtifactId": PREP_ID, "prepManifestSha256": PREP_SHA,
                "inventorySha256": result["inventorySha256"],
                "collectionAuditSha256": digest((staging / "STAGE1_V3_COLLECTION_AUDIT_V1.json").read_bytes()),
                "sourceIdentities": result["sourceIdentities"],
                "providerRerunPermitted": False, "evaluationPerformed": False,
                "terminalSetUntouched": True, "compilerInvoked": False, "cases": cases,
            }
            write_json(staging / FREEZE_FILE, freeze)
        os.rename(staging, output_dir)
    return result


def verify_freeze(path, prep_root, provider_root):
    """Evaluator gate: run before opening reference labels or writing results."""
    path, provider_root = Path(path), Path(provider_root)
    freeze = load(path)
    check_fields(freeze, {
        "schema": "trackcade-semantic-external-stage1-v3-generation-freeze-v1",
        "status": FREEZE_STATUS, "developmentRevision": REVISION, "trackCount": 50,
        "prepArtifactId": PREP_ID, "prepManifestSha256": PREP_SHA,
        "providerRerunPermitted": False, "evaluationPerformed": False,
        "terminalSetUntouched": True, "compilerInvoked": False,
    }, "generation freeze")
    prep_rows(prep_root)
    require(digest((path.parent / "github-inventory.json").read_bytes()) == freeze["inventorySha256"], "inventory hash")
    verify_baseline(load(path.parent / "github-inventory.json"))
    for name in ("collect_stage1_v3_results_v1.py", "evaluate_stage1_v3_drop_v1.py", "evaluate_stage1_drop_v1.py"):
        require(digest(Path(__file__).with_name(name).read_bytes()) == freeze["sourceIdentities"][name], "evaluation/collection source drift")
    audit_doc = path.parent / "STAGE1_V3_COLLECTION_AUDIT_V1.json"
    require(digest(audit_doc.read_bytes()) == freeze["collectionAuditSha256"], "collection audit hash")
    audited = load(audit_doc)
    require(audited["status"] == "complete-ready-to-freeze" and audited["completedTracks"] == 50
            and not audited["missingCompletedResponseOrdinals"] and not audited["blockedOrdinals"], "audit incomplete")
    cases = freeze["cases"]
    require(len(cases) == 50 and {c["ordinal"] for c in cases} == set(range(1, 51)), "freeze case set")
    require(len({c["openaiResponseId"] for c in cases}) == 50, "freeze duplicate response IDs")
    expected_paths = set()
    for case in cases:
        require(case in audited["observations"] and case["validated"] is True, "case absent from audit")
        root = provider_root / f"{case['ordinal']:02d}"
        for name, expected in case["files"].items():
            require(name in ALLOWED, "unsafe frozen file path")
            p = root / name
            require(not p.is_symlink() and digest(p.read_bytes()) == expected, "frozen provider file changed")
            expected_paths.add(p.resolve())
    require({p.resolve() for p in provider_root.rglob("*") if p.is_file()} == expected_paths, "unexpected provider files")
    return {c["ordinal"]: c for c in cases}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--prep-root", type=Path, required=True)
    parser.add_argument("--artifact-root", type=Path, required=True)
    parser.add_argument("--inventory", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, required=True)
    args = parser.parse_args()
    try:
        result = collect(args.prep_root, args.artifact_root, args.inventory, args.output_dir)
    except (ValueError, KeyError, OSError, zipfile.BadZipFile) as exc:
        parser.exit(2, str(exc) + "\n")
    print(json.dumps({k: v for k, v in result.items() if k != "observations"}, indent=2))
    return 0 if result["status"] == "complete-ready-to-freeze" else 2


if __name__ == "__main__":
    raise SystemExit(main())


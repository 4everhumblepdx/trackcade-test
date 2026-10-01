#!/usr/bin/env python3
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
import uuid

SOURCE_MANIFEST_SHA256 = "455602ea8c5a721fac9b3381aca46285fe3c14f1fbcc36f0d08b4ffec01be875"
FLEX_MANIFEST_SHA256 = "a41fdd4e4138fdfda18cda20004f609eb089aeb64ed1be486ee2442b1241a713"
SOURCE_SCHEMA = "trackcade-semantic-external-stage1-v7-prep-v1"
FLEX_SCHEMA = "trackcade-semantic-external-stage1-v7-flex8192-prep-v1"
STATUS_SCHEMA = "trackcade-semantic-external-stage1-v7-remaining49-provider-case-v1"
SUCCESS_CLASSIFICATION = "provider_completed_validated_v7_flex8192_remaining49_no_retry"
CONTRACT = {
    "provider": "openai",
    "api": "responses",
    "model": "gpt-6-sol",
    "reasoningEffort": "high",
    "maxOutputTokens": 8192,
    "serviceTier": "flex",
    "store": False,
}
LOCK_SCHEMA = "trackcade-semantic-external-stage1-v7-remaining49-attempt-lock-v1"
BRANCH = "refs/heads/trackcade-semantic-external-holdout-v1"


def exact(data: dict, expected: dict) -> None:
    for key, value in expected.items():
        if type(data.get(key)) is not type(value) or data[key] != value:
            raise ValueError(f"execution gate mismatch: {key}")


def sha_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha(path: Path) -> str:
    return sha_bytes(path.read_bytes())


def load(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat().replace("+00:00", "Z")


def save_json(path: Path, obj: dict) -> None:
    path.write_text(json.dumps(obj, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def execution_gate(auth: dict, act: dict, ordinal: int, harness_commit: str) -> None:
    if type(ordinal) is not int or ordinal not in range(2, 51):
        raise ValueError("remaining49 ordinal must be in 2..50")
    exact(auth, {
        "schema": "trackcade-semantic-external-stage1-v7-remaining49-provider-authorization-v1",
        "authorized": True,
        "status": "authorized-explicit-paid-remaining49",
        "ordinals": list(range(2, 51)),
        "maximumInitialProviderAttempts": 49,
        "attemptsPerOrdinal": 1,
        "providerContract": CONTRACT,
    })
    rb = auth.get("researchBoundary") or {}
    for key in (
        "automaticRetriesAuthorized", "standardFallbackAuthorized", "partialScoringAuthorized",
        "stage1ReferenceAccessAuthorized", "terminalHoldoutAccessAuthorized",
        "compilerInvocationAuthorized", "analyzerExecutionAuthorized", "analyzerChangesAuthorized",
        "semanticContractChangesAuthorized",
    ):
        if rb.get(key) is not False:
            raise ValueError(f"authorization boundary mismatch: {key}")
    if rb.get("retryAfterAnyFailedOrInvalidOrdinalRequiresNewExplicitApproval") is not True:
        raise ValueError("retry approval boundary mismatch")
    exact(act, {
        "schema": "trackcade-semantic-external-stage1-v7-remaining49-provider-activation-v1",
        "activatePaidRemaining49": True,
        "ordinals": list(range(2, 51)),
        "maximumProviderAttempts": 49,
        "attemptsPerOrdinal": 1,
        "providerContract": CONTRACT,
    })
    for key in (
        "automaticRetriesAuthorized", "standardFallbackAuthorized", "partialScoringAuthorized",
        "stage1ReferenceOpeningAuthorized", "terminalHoldoutAccessAuthorized",
        "compilerInvocationAuthorized", "analyzerExecutionAuthorized", "analyzerChangesAuthorized",
        "semanticContractChangesAuthorized",
    ):
        if act.get(key) is not False:
            raise ValueError(f"activation boundary mismatch: {key}")
    if auth.get("templateOnly") or act.get("templateOnly"):
        raise ValueError("templates are never executable receipts")
    if os.environ.get("GITHUB_REF") != BRANCH or os.environ.get("GITHUB_EVENT_NAME") != "push":
        raise ValueError("runner requires canonical activation-push workflow")
    if os.environ.get("GITHUB_RUN_ATTEMPT") != "1" or os.environ.get("GITHUB_SHA") != harness_commit:
        raise ValueError("rerun or execution commit mismatch")
    if not os.environ.get("GITHUB_RUN_ID"):
        raise ValueError("missing workflow run identity")


def verify_uploaded_lock(lock: dict, artifact: dict, ordinal: int, commit: str) -> None:
    exact(lock, {
        "schema": LOCK_SCHEMA,
        "ordinal": ordinal,
        "harnessSourceCommit": commit,
        "runId": os.environ["GITHUB_RUN_ID"],
        "runAttempt": 1,
        "reservationIsSpendAuthorization": False,
    })
    exact(artifact, {
        "id": int(os.environ["LOCK_ARTIFACT_ID"]),
        "expired": False,
        "name": f"trackcade-semantic-external-stage1-v7-remaining49-v1-case-{ordinal:02d}-attempt-lock",
    })
    exact(artifact.get("workflow_run") or {}, {"id": int(lock["runId"]), "head_sha": commit})
    if not str(artifact.get("digest", "")).startswith("sha256:"):
        raise ValueError("uploaded attempt lock lacks digest")


def verify_files_manifest(out: Path) -> None:
    manifest = out / "FILES_SHA256.txt"
    if not manifest.is_file():
        raise ValueError("result FILES_SHA256 missing")
    rows = [line for line in manifest.read_text(encoding="utf-8").splitlines() if line.strip()]
    expected_names = {p.name for p in out.iterdir() if p.is_file() and p.name != "FILES_SHA256.txt"}
    seen = set()
    for line in rows:
        expected, name = line.split("  ", 1)
        p = out / name
        if name in seen or not p.is_file() or sha(p) != expected:
            raise ValueError(f"result manifest closure mismatch: {name}")
        seen.add(name)
    if seen != expected_names:
        raise ValueError("result manifest file-set mismatch")


def check_completed(out: Path, ordinal: int, commit: str) -> None:
    status = load(out / "stage1-v7-remaining49-case-status-v1.json")
    exact(status, {
        "schema": STATUS_SCHEMA,
        "ordinal": ordinal,
        "harnessSourceCommit": commit,
        "classification": SUCCESS_CLASSIFICATION,
        "providerContract": CONTRACT,
        "providerCallAttempted": True,
        "providerResponseObserved": True,
        "providerCompletedSemanticResponse": True,
        "proposalValidated": True,
        "observedProviderStatus": "completed",
        "observedProviderServiceTier": "flex",
        "observedProviderModel": "gpt-6-sol",
        "semanticPayloadUnchanged": True,
        "retryAuthorized": False,
        "standardFallbackUsed": False,
        "referenceLabelsRead": False,
        "scoringPerformed": False,
        "analyzerExecuted": False,
        "analyzerChanged": False,
        "compilerInvoked": False,
        "terminalTracksProcessed": False,
        "stage1ReferencesOpened": False,
        "errors": [],
        "validatorExitCode": 0,
    })
    if (out / "provider-step-exit-code.txt").read_text(encoding="utf-8").strip() != "0":
        raise ValueError("provider runner exit receipt failed")
    if sha(out / "normalized-proposal.json") != status["normalizedProposalSha256"]:
        raise ValueError("normalized proposal hash mismatch")
    verify_files_manifest(out)


def verify_prep(source_root: Path, flex_root: Path, ordinal: int) -> tuple[dict, dict, dict[str, Path]]:
    sp = source_root / "STAGE1_V7_PREP_MANIFEST_V1.json"
    fp = flex_root / "STAGE1_V7_FLEX8192_PREP_MANIFEST_V1.json"
    if not sp.is_file() or sha(sp) != SOURCE_MANIFEST_SHA256:
        raise ValueError("frozen V7 semantic prep manifest identity mismatch")
    if not fp.is_file() or sha(fp) != FLEX_MANIFEST_SHA256:
        raise ValueError("frozen V7 Flex prep manifest identity mismatch")
    source, flex = load(sp), load(fp)
    if source.get("schema") != SOURCE_SCHEMA or source.get("trackCount") != 50:
        raise ValueError("V7 semantic prep schema/count mismatch")
    if flex.get("schema") != FLEX_SCHEMA or flex.get("trackCount") != 50:
        raise ValueError("V7 Flex prep schema/count mismatch")
    for data, label in ((source, "semantic"), (flex, "Flex")):
        if data.get("providerCallsObserved") != 0:
            raise ValueError(f"{label} prep unexpectedly contains provider calls")
        if data.get("terminalTracksProcessed") is not False:
            raise ValueError(f"{label} prep terminal boundary mismatch")
        if data.get("analyzerExecuted") is not False or data.get("compilerInvoked") is not False:
            raise ValueError(f"{label} prep Analyzer/compiler boundary mismatch")
    if flex.get("paidCallsAuthorizedByThisManifest") is not False:
        raise ValueError("V7 Flex prep must not authorize paid calls")
    amendment = flex.get("transportAmendment") or {}
    expected_amendment = {**CONTRACT, "allowedChangesOnly": ["service_tier"], "semanticPayloadUnchanged": True}
    if amendment != expected_amendment:
        raise ValueError("V7 Flex transport amendment mismatch")
    preserved = flex.get("semanticContractPreserved") or {}
    if preserved.get("structuralContextOrthogonalNotGate") is not True:
        raise ValueError("V7 structural-context contract drift")
    if preserved.get("decisiveImpactRequiredForDrop") is not True or preserved.get("decisiveImpactUnclearInsufficientForDrop") is not True:
        raise ValueError("V7 decisive-impact contract drift")
    sr = [x for x in source.get("tracks") or [] if x.get("ordinal") == ordinal]
    fr = [x for x in flex.get("tracks") or [] if x.get("ordinal") == ordinal]
    if len(sr) != 1 or len(fr) != 1:
        raise ValueError("ordinal missing or duplicated in frozen V7 prep")
    srow, frow = sr[0], fr[0]
    if srow.get("id") != frow.get("id") or srow.get("stem") != frow.get("stem"):
        raise ValueError("V7 semantic/Flex track identity mismatch")
    stem = srow["stem"]
    scase = source_root / "cases" / f"{ordinal:02d}-{stem}"
    fcase = flex_root / "cases" / f"{ordinal:02d}-{stem}"
    paths = {
        "request": scase / "learned-request-v7.json",
        "packet": scase / "structure-evidence-v2.json",
        "sourcePayload": scase / "openai-payload-v7.json",
        "flexPayload": fcase / "openai-payload-v7-flex8192.json",
    }
    if not all(p.is_file() for p in paths.values()):
        raise ValueError("frozen V7 case files missing")
    if sha(paths["request"]) != frow.get("learnedRequestV7Sha256"):
        raise ValueError("V7 learned request hash mismatch")
    if sha(paths["packet"]) != frow.get("structureEvidenceV2Sha256"):
        raise ValueError("V7 packet hash mismatch")
    if sha(paths["sourcePayload"]) != frow.get("sourceV7PayloadSha256"):
        raise ValueError("V7 source payload hash mismatch")
    if sha(paths["flexPayload"]) != frow.get("amendedFlex8192PayloadSha256"):
        raise ValueError("V7 Flex payload hash mismatch")
    source_payload = load(paths["sourcePayload"])
    flex_payload = load(paths["flexPayload"])
    projection = dict(flex_payload)
    projection.pop("service_tier", None)
    if projection != source_payload:
        raise ValueError("V7 Flex payload changed semantic payload")
    if flex_payload.get("model") != "gpt-6-sol" or flex_payload.get("reasoning") != {"effort": "high"}:
        raise ValueError("V7 model/reasoning contract mismatch")
    if flex_payload.get("max_output_tokens") != 8192 or flex_payload.get("service_tier") != "flex" or flex_payload.get("store") is not False:
        raise ValueError("V7 transport contract mismatch")
    return srow, frow, paths


def prepare_output(out: Path, ordinal: int, srow: dict, frow: dict, paths: dict[str, Path], harness_commit: str) -> tuple[dict, Path]:
    out.mkdir(parents=True, exist_ok=False)
    shutil.copyfile(paths["request"], out / "learned-request-v7.json")
    shutil.copyfile(paths["packet"], out / "structure-evidence-v2.json")
    shutil.copyfile(paths["sourcePayload"], out / "openai-payload-v7.json")
    shutil.copyfile(paths["flexPayload"], out / "openai-payload-v7-flex8192.json")
    status = {
        "schema": STATUS_SCHEMA,
        "stage": "stage1-v7",
        "purpose": "complete-remaining-49-development-responses-before-reference-access",
        "ordinal": ordinal,
        "id": srow["id"],
        "stem": srow["stem"],
        "harnessSourceCommit": harness_commit,
        "providerContract": CONTRACT,
        "developmentRevision": "stage1-drop-semantics-v7-orthogonal-structural-context",
        "sourceRequestSha256": sha(paths["request"]),
        "packetSha256": sha(paths["packet"]),
        "sourcePayloadSha256": sha(paths["sourcePayload"]),
        "amendedPayloadSha256": sha(paths["flexPayload"]),
        "semanticProjectionSha256": frow["semanticProjectionSha256"],
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
        "stage1ReferencesOpened": False,
        "classification": "offline_preflight_complete_no_provider_call",
        "errors": [],
    }
    status_path = out / "stage1-v7-remaining49-case-status-v1.json"
    save_json(status_path, status)
    return status, status_path


def one_provider_attempt(out: Path, status: dict, status_path: Path, validator: Path) -> None:
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("OPENAI_API_KEY missing at authorized live-call step")
    payload_path = out / "openai-payload-v7-flex8192.json"
    payload_bytes = payload_path.read_bytes()
    client_request_id = str(uuid.uuid4())
    status["providerCallAttempted"] = True
    status["providerCallStartedAt"] = now()
    status["clientRequestId"] = client_request_id
    status["classification"] = "provider_attempt_started_no_retry"
    save_json(status_path, status)
    req = urllib.request.Request(
        "https://api.openai.com/v1/responses",
        data=payload_bytes,
        method="POST",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "trackcade-stage1-v7-remaining49-v1",
            "X-Client-Request-Id": client_request_id,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=900) as resp:
            raw = resp.read()
            http_status = int(resp.status)
            http_request_id = resp.headers.get("x-request-id")
            http_error = False
    except urllib.error.HTTPError as exc:
        raw = exc.read()
        http_status = int(exc.code)
        http_request_id = exc.headers.get("x-request-id") if exc.headers else None
        http_error = True
    except urllib.error.URLError as exc:
        status.update({
            "providerCallFinishedAt": now(),
            "httpStatus": None,
            "httpRequestId": None,
            "transportError": str(exc.reason),
            "classification": "flex_transport_failure_no_completed_response_no_retry",
        })
        save_json(status_path, status)
        return
    status.update({
        "providerCallFinishedAt": now(),
        "httpStatus": http_status,
        "httpRequestId": http_request_id,
        "providerResponseObserved": True,
    })
    (out / "raw-response.json").write_bytes(raw)
    status["rawResponseSha256"] = sha_bytes(raw)
    if http_error:
        try:
            status["providerHttpError"] = json.loads(raw.decode("utf-8")).get("error")
        except Exception:
            status["providerHttpError"] = None
        status["classification"] = "flex_http_failure_no_completed_response_no_retry"
        save_json(status_path, status)
        return
    response = json.loads(raw.decode("utf-8"))
    status["observedProviderStatus"] = response.get("status")
    status["observedProviderResponseId"] = response.get("id")
    status["observedProviderModel"] = response.get("model")
    status["observedProviderServiceTier"] = response.get("service_tier")
    if isinstance(response.get("usage"), dict):
        status["usage"] = response["usage"]
    if response.get("status") != "completed":
        status["incompleteDetails"] = response.get("incomplete_details")
        status["classification"] = "provider_incomplete_no_completed_response_no_retry"
        save_json(status_path, status)
        return
    status["providerCompletedSemanticResponse"] = True
    if response.get("service_tier") != "flex":
        status["errors"].append(f"completed response service_tier was {response.get('service_tier')!r}, expected 'flex'")
        status["classification"] = "provider_completed_wrong_service_tier_no_retry"
        save_json(status_path, status)
        return
    if response.get("model") != "gpt-6-sol":
        status["errors"].append(f"completed response model was {response.get('model')!r}, expected 'gpt-6-sol'")
        status["classification"] = "provider_completed_wrong_model_no_retry"
        save_json(status_path, status)
        return
    learned = validator.parent.resolve()
    sys.path.insert(0, str(learned))
    import openai_responses_adapter_v1 as transport
    _, candidate_bytes = transport.extract_candidate(raw)
    candidate = out / "proposal-candidate.json"
    candidate.write_bytes(candidate_bytes)
    status["proposalCandidateSha256"] = sha_bytes(candidate_bytes)
    normalized = out / "normalized-proposal.json"
    report = out / "validation-report.json"
    proc = subprocess.run(
        [sys.executable, str(validator), "--packet", str(out / "structure-evidence-v2.json"),
         "--proposal", str(candidate), "--output", str(normalized), "--report", str(report)],
        capture_output=True, text=True, check=False,
    )
    (out / "validator-stdout.txt").write_text(proc.stdout, encoding="utf-8")
    (out / "validator-stderr.txt").write_text(proc.stderr, encoding="utf-8")
    status["validatorExitCode"] = proc.returncode
    if proc.returncode == 0:
        status["proposalValidated"] = True
        status["normalizedProposalSha256"] = sha(normalized)
        status["classification"] = SUCCESS_CLASSIFICATION
    else:
        status["classification"] = "provider_completed_v7_validation_failure_no_retry"
    save_json(status_path, status)


def finalize_manifest(out: Path) -> None:
    rows = []
    for p in sorted(x for x in out.iterdir() if x.is_file() and x.name != "FILES_SHA256.txt"):
        rows.append(f"{sha(p)}  {p.name}")
    (out / "FILES_SHA256.txt").write_text("\n".join(rows) + "\n", encoding="utf-8")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=("prepare", "run", "check"), required=True)
    ap.add_argument("--ordinal", type=int, required=True)
    ap.add_argument("--source-root", type=Path, required=True)
    ap.add_argument("--flex-root", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--harness-commit", required=True)
    ap.add_argument("--validator", type=Path, required=True)
    ap.add_argument("--authorization", type=Path, required=True)
    ap.add_argument("--activation", type=Path, required=True)
    ap.add_argument("--lock-file", type=Path, required=True)
    ap.add_argument("--uploaded-lock", type=Path)
    args = ap.parse_args()
    execution_gate(load(args.authorization), load(args.activation), args.ordinal, args.harness_commit)
    if args.mode == "check":
        check_completed(args.output_dir, args.ordinal, args.harness_commit)
        return
    srow, frow, paths = verify_prep(args.source_root, args.flex_root, args.ordinal)
    if args.mode == "prepare":
        if os.environ.get("OPENAI_API_KEY"):
            raise ValueError("credentials must not be available during reservation")
        prepare_output(args.output_dir, args.ordinal, srow, frow, paths, args.harness_commit)
        args.lock_file.parent.mkdir(parents=True, exist_ok=False)
        save_json(args.lock_file, {
            "schema": LOCK_SCHEMA,
            "ordinal": args.ordinal,
            "harnessSourceCommit": args.harness_commit,
            "runId": os.environ["GITHUB_RUN_ID"],
            "runAttempt": 1,
            "reservationIsSpendAuthorization": False,
        })
        return
    if args.uploaded_lock is None:
        raise ValueError("uploaded attempt lock required before a call")
    verify_uploaded_lock(load(args.lock_file), load(args.uploaded_lock), args.ordinal, args.harness_commit)
    status_path = args.output_dir / "stage1-v7-remaining49-case-status-v1.json"
    status = load(status_path)
    exact(status, {
        "schema": STATUS_SCHEMA,
        "ordinal": args.ordinal,
        "harnessSourceCommit": args.harness_commit,
        "providerContract": CONTRACT,
        "providerCallAttempted": False,
        "classification": "offline_preflight_complete_no_provider_call",
    })
    for key, filename in {
        "request": "learned-request-v7.json",
        "packet": "structure-evidence-v2.json",
        "sourcePayload": "openai-payload-v7.json",
        "flexPayload": "openai-payload-v7-flex8192.json",
    }.items():
        if sha(args.output_dir / filename) != sha(paths[key]):
            raise ValueError("prepared V7 case changed after reservation")
    try:
        one_provider_attempt(args.output_dir, status, status_path, args.validator)
        (args.output_dir / "provider-step-exit-code.txt").write_text("0\n", encoding="utf-8")
    except Exception as exc:
        status["errors"].append(f"unexpected runner exception: {type(exc).__name__}: {exc}")
        status["classification"] = "runner_exception_after_or_before_single_attempt_no_retry"
        save_json(status_path, status)
        (args.output_dir / "provider-step-exit-code.txt").write_text("1\n", encoding="utf-8")
    outcome = "completed-valid" if status.get("classification") == SUCCESS_CLASSIFICATION else (
        "attempted-no-valid-response" if status.get("providerCallAttempted") else "local-no-provider-attempt")
    status["artifactOutcome"] = outcome
    save_json(status_path, status)
    finalize_manifest(args.output_dir)
    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write(f"artifact_outcome={outcome}\n")
    print(json.dumps({
        "ordinal": args.ordinal,
        "classification": status.get("classification"),
        "providerCallAttempted": status.get("providerCallAttempted"),
        "providerResponseObserved": status.get("providerResponseObserved"),
        "usage": status.get("usage"),
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

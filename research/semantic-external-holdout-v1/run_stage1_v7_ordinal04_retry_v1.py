#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys

import run_stage1_v7_remaining49_case_v1 as base

RETRY_AUTH_SCHEMA = "trackcade-semantic-external-stage1-v7-ordinal04-retry-authorization-v1"
RETRY_ACT_SCHEMA = "trackcade-semantic-external-stage1-v7-ordinal04-retry-activation-v1"
RETRY_LOCK_SCHEMA = "trackcade-semantic-external-stage1-v7-ordinal04-retry-lock-v1"
RETRY_SUCCESS_CLASSIFICATION = "provider_completed_validated_v7_ordinal04_retry01"
BRANCH = "refs/heads/trackcade-semantic-external-holdout-v1"
ORDINAL = 4
RETRY_NUMBER = 1


def exact(data: dict, expected: dict) -> None:
    for key, value in expected.items():
        if type(data.get(key)) is not type(value) or data[key] != value:
            raise ValueError(f"retry execution gate mismatch: {key}")


def execution_gate(auth: dict, act: dict, interruption: dict, harness_commit: str) -> None:
    exact(auth, {
        "schema": RETRY_AUTH_SCHEMA,
        "status": "authorized-explicit-one-retry",
        "authorized": True,
        "ordinal": ORDINAL,
        "maximumRetryProviderAttempts": 1,
        "attemptsPerOrdinal": 1,
        "providerContract": base.CONTRACT,
    })
    original = auth.get("originalAttempt") or {}
    exact(original, {
        "runId": 36935550063,
        "jobId": 110615748113,
        "attemptLockArtifactId": 11198480361,
        "resultArtifactId": 11197856837,
        "resultArtifactName": "trackcade-semantic-external-stage1-v7-remaining49-v1-case-04-attempted-no-valid-response",
        "resultArtifactDigest": "sha256:6d0050f200487c4005b8da443d01e0835c1e4ecda1de277cfffb486764346110",
        "classification": "provider_incomplete_no_completed_response_no_retry",
        "incompleteReason": "max_output_tokens",
        "providerAttemptsConsumed": 1,
    })
    rb = auth.get("researchBoundary") or {}
    for key in (
        "automaticRetriesAuthorized", "secondRetryAuthorized", "standardFallbackAuthorized",
        "maxOutputTokensChangeAuthorized", "semanticContractChangesAuthorized",
        "stage1ReferenceAccessAuthorized", "partialScoringAuthorized",
        "terminalHoldoutAccessAuthorized", "analyzerExecutionAuthorized",
        "analyzerChangesAuthorized", "compilerInvocationAuthorized",
    ):
        if rb.get(key) is not False:
            raise ValueError(f"retry authorization boundary mismatch: {key}")

    exact(act, {
        "schema": RETRY_ACT_SCHEMA,
        "activatePaidOrdinal04Retry": True,
        "ordinal": ORDINAL,
        "retryNumber": RETRY_NUMBER,
        "maximumProviderAttempts": 1,
        "providerContract": base.CONTRACT,
    })
    for key in (
        "automaticRetryAuthorized", "secondRetryAuthorized", "standardFallbackAuthorized",
        "maxOutputTokensChangeAuthorized", "semanticContractChangesAuthorized",
        "stage1ReferenceOpeningAuthorized", "partialScoringAuthorized",
        "terminalHoldoutAccessAuthorized", "analyzerExecutionAuthorized",
        "analyzerChangesAuthorized", "compilerInvocationAuthorized",
    ):
        if act.get(key) is not False:
            raise ValueError(f"retry activation boundary mismatch: {key}")

    exact(interruption, {
        "schema": "trackcade-semantic-external-stage1-v7-remaining49-interruption-ordinal04-v1",
        "status": "frozen-interrupted-after-ordinal-4-provider-incomplete-no-retry",
    })
    interrupted = interruption.get("interruptedOrdinal") or {}
    exact(interrupted, {
        "ordinal": ORDINAL,
        "classification": "provider_incomplete_no_completed_response_no_retry",
        "providerCallAttempted": True,
        "providerResponseObserved": True,
        "providerCompletedSemanticResponse": False,
        "proposalValidated": False,
        "httpStatus": 200,
        "incompleteReason": "max_output_tokens",
    })
    if interruption.get("unattemptedOrdinals") != list(range(5, 51)):
        raise ValueError("frozen unattempted ordinal boundary mismatch")
    boundary = interruption.get("researchBoundary") or {}
    for key in (
        "automaticRetryPerformed", "standardFallbackUsed", "partialResponseAccepted",
        "partialScoringPerformed", "stage1ReferenceAccessed", "terminalHoldoutAccessed",
        "compilerInvoked", "analyzerExecuted", "analyzerChanged", "semanticContractChanged",
    ):
        if boundary.get(key) is not False:
            raise ValueError(f"frozen interruption boundary mismatch: {key}")
    if boundary.get("ordinals5Through50ProviderCalls") != 0:
        raise ValueError("later ordinal provider-call boundary mismatch")
    if boundary.get("freshExplicitApprovalRequiredForAnyOrdinal4Retry") is not True:
        raise ValueError("fresh retry approval boundary mismatch")

    if os.environ.get("GITHUB_REF") != BRANCH or os.environ.get("GITHUB_EVENT_NAME") != "push":
        raise ValueError("retry runner requires canonical activation-push workflow")
    if os.environ.get("GITHUB_RUN_ATTEMPT") != "1" or os.environ.get("GITHUB_SHA") != harness_commit:
        raise ValueError("retry rerun or execution commit mismatch")
    if not os.environ.get("GITHUB_RUN_ID"):
        raise ValueError("missing retry workflow run identity")


def verify_uploaded_lock(lock: dict, artifact: dict, harness_commit: str) -> None:
    exact(lock, {
        "schema": RETRY_LOCK_SCHEMA,
        "ordinal": ORDINAL,
        "retryNumber": RETRY_NUMBER,
        "harnessSourceCommit": harness_commit,
        "runId": os.environ["GITHUB_RUN_ID"],
        "runAttempt": 1,
        "reservationIsSpendAuthorization": False,
        "freshExplicitApprovalRecorded": True,
    })
    exact(artifact, {
        "id": int(os.environ["LOCK_ARTIFACT_ID"]),
        "expired": False,
        "name": "trackcade-semantic-external-stage1-v7-remaining49-v1-case-04-retry-01-attempt-lock",
    })
    exact(artifact.get("workflow_run") or {}, {
        "id": int(lock["runId"]),
        "head_sha": harness_commit,
    })
    if not str(artifact.get("digest", "")).startswith("sha256:"):
        raise ValueError("uploaded retry attempt lock lacks digest")


def prepare_output(
    out: Path,
    source_root: Path,
    flex_root: Path,
    harness_commit: str,
) -> tuple[dict, Path, dict[str, Path]]:
    srow, frow, paths = base.verify_prep(source_root, flex_root, ORDINAL)
    status, status_path = base.prepare_output(out, ORDINAL, srow, frow, paths, harness_commit)
    status.update({
        "purpose": "ordinal-4-transport-completion-retry-under-unchanged-frozen-contract",
        "retryAuthorized": True,
        "retryAttemptNumber": RETRY_NUMBER,
        "originalAttemptRunId": 36935550063,
        "originalAttemptJobId": 110615748113,
        "originalAttemptLockArtifactId": 11198480361,
        "originalAttemptResultArtifactId": 11197856837,
        "originalAttemptClassification": "provider_incomplete_no_completed_response_no_retry",
        "originalAttemptIncompleteReason": "max_output_tokens",
        "classification": "offline_retry_preflight_complete_no_provider_call",
    })
    base.save_json(status_path, status)
    return status, status_path, paths


def verify_prepared_files(out: Path, paths: dict[str, Path]) -> None:
    for key, filename in {
        "request": "learned-request-v7.json",
        "packet": "structure-evidence-v2.json",
        "sourcePayload": "openai-payload-v7.json",
        "flexPayload": "openai-payload-v7-flex8192.json",
    }.items():
        if base.sha(out / filename) != base.sha(paths[key]):
            raise ValueError("prepared V7 retry case changed after reservation")


def check_completed(
    out: Path,
    source_root: Path,
    flex_root: Path,
    harness_commit: str,
) -> None:
    _, _, paths = base.verify_prep(source_root, flex_root, ORDINAL)
    verify_prepared_files(out, paths)
    status = base.load(out / "stage1-v7-remaining49-case-status-v1.json")
    exact(status, {
        "schema": base.STATUS_SCHEMA,
        "ordinal": ORDINAL,
        "harnessSourceCommit": harness_commit,
        "classification": RETRY_SUCCESS_CLASSIFICATION,
        "providerContract": base.CONTRACT,
        "providerCallAttempted": True,
        "providerResponseObserved": True,
        "providerCompletedSemanticResponse": True,
        "proposalValidated": True,
        "observedProviderStatus": "completed",
        "observedProviderServiceTier": "flex",
        "observedProviderModel": "gpt-6-sol",
        "semanticPayloadUnchanged": True,
        "retryAuthorized": True,
        "retryAttemptNumber": RETRY_NUMBER,
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
        "artifactOutcome": "completed-valid",
    })
    if status.get("baseClassification") != base.SUCCESS_CLASSIFICATION:
        raise ValueError("retry success did not originate from frozen V7 success classification")
    if (out / "provider-step-exit-code.txt").read_text(encoding="utf-8").strip() != "0":
        raise ValueError("retry provider runner exit receipt failed")
    if base.sha(out / "normalized-proposal.json") != status["normalizedProposalSha256"]:
        raise ValueError("retry normalized proposal hash mismatch")
    base.verify_files_manifest(out)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--mode", choices=("prepare", "run", "check"), required=True)
    ap.add_argument("--source-root", type=Path, required=True)
    ap.add_argument("--flex-root", type=Path, required=True)
    ap.add_argument("--output-dir", type=Path, required=True)
    ap.add_argument("--harness-commit", required=True)
    ap.add_argument("--validator", type=Path, required=True)
    ap.add_argument("--authorization", type=Path, required=True)
    ap.add_argument("--activation", type=Path, required=True)
    ap.add_argument("--interruption", type=Path, required=True)
    ap.add_argument("--lock-file", type=Path, required=True)
    ap.add_argument("--uploaded-lock", type=Path)
    args = ap.parse_args()

    auth = base.load(args.authorization)
    act = base.load(args.activation)
    interruption = base.load(args.interruption)
    execution_gate(auth, act, interruption, args.harness_commit)

    if args.mode == "check":
        check_completed(args.output_dir, args.source_root, args.flex_root, args.harness_commit)
        return

    if args.mode == "prepare":
        if os.environ.get("OPENAI_API_KEY"):
            raise ValueError("provider credentials must not be available during retry reservation")
        _, _, _ = prepare_output(args.output_dir, args.source_root, args.flex_root, args.harness_commit)
        args.lock_file.parent.mkdir(parents=True, exist_ok=False)
        base.save_json(args.lock_file, {
            "schema": RETRY_LOCK_SCHEMA,
            "ordinal": ORDINAL,
            "retryNumber": RETRY_NUMBER,
            "harnessSourceCommit": args.harness_commit,
            "runId": os.environ["GITHUB_RUN_ID"],
            "runAttempt": 1,
            "reservationIsSpendAuthorization": False,
            "freshExplicitApprovalRecorded": True,
            "originalAttemptLockArtifactId": 11198480361,
            "originalAttemptResultArtifactId": 11197856837,
        })
        return

    if args.uploaded_lock is None:
        raise ValueError("uploaded retry attempt lock required before provider call")
    verify_uploaded_lock(base.load(args.lock_file), base.load(args.uploaded_lock), args.harness_commit)
    _, _, paths = base.verify_prep(args.source_root, args.flex_root, ORDINAL)
    verify_prepared_files(args.output_dir, paths)

    status_path = args.output_dir / "stage1-v7-remaining49-case-status-v1.json"
    status = base.load(status_path)
    exact(status, {
        "schema": base.STATUS_SCHEMA,
        "ordinal": ORDINAL,
        "harnessSourceCommit": args.harness_commit,
        "providerContract": base.CONTRACT,
        "providerCallAttempted": False,
        "retryAuthorized": True,
        "retryAttemptNumber": RETRY_NUMBER,
        "classification": "offline_retry_preflight_complete_no_provider_call",
    })

    try:
        base.one_provider_attempt(args.output_dir, status, status_path, args.validator)
        (args.output_dir / "provider-step-exit-code.txt").write_text("0\n", encoding="utf-8")
    except Exception as exc:
        status["errors"].append(f"unexpected retry runner exception: {type(exc).__name__}: {exc}")
        status["classification"] = "retry_runner_exception_after_or_before_single_attempt"
        base.save_json(status_path, status)
        (args.output_dir / "provider-step-exit-code.txt").write_text("1\n", encoding="utf-8")

    status = base.load(status_path)
    status["retryAuthorized"] = True
    status["retryAttemptNumber"] = RETRY_NUMBER
    status["originalAttemptRunId"] = 36935550063
    status["originalAttemptLockArtifactId"] = 11198480361
    status["originalAttemptResultArtifactId"] = 11197856837
    if status.get("classification") == base.SUCCESS_CLASSIFICATION:
        status["baseClassification"] = base.SUCCESS_CLASSIFICATION
        status["classification"] = RETRY_SUCCESS_CLASSIFICATION

    outcome = "completed-valid" if status.get("classification") == RETRY_SUCCESS_CLASSIFICATION else (
        "attempted-no-valid-response" if status.get("providerCallAttempted") else "local-no-provider-attempt"
    )
    status["artifactOutcome"] = outcome
    base.save_json(status_path, status)
    base.finalize_manifest(args.output_dir)

    if os.environ.get("GITHUB_OUTPUT"):
        with open(os.environ["GITHUB_OUTPUT"], "a", encoding="utf-8") as output:
            output.write(f"artifact_outcome={outcome}\n")
    print(json.dumps({
        "ordinal": ORDINAL,
        "retryNumber": RETRY_NUMBER,
        "classification": status.get("classification"),
        "providerCallAttempted": status.get("providerCallAttempted"),
        "providerResponseObserved": status.get("providerResponseObserved"),
        "usage": status.get("usage"),
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()

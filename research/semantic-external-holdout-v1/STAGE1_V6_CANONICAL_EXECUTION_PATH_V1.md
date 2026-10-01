# V6 remaining-49 canonical execution path

Current authority: `STAGE1_V6_REMAINING49_RECONCILIATION_RECEIPT_V1.json`, in this directory. The earlier staging receipts are historical snapshots; their matrix and inline-runner descriptions no longer describe the reconciled source.

- Workflow: `.github/workflows/trackcade-semantic-external-stage1-v6-remaining49-v1.yml`.
- Sole call implementation: `run_stage1_v6_remaining49_case_v1.py`, with `prepare`, `run`, and `check` phases. No inline provider implementation remains in the workflow.
- Authorization: `STAGE1_V6_REMAINING49_PROVIDER_AUTHORIZATION_V1.json`, still `authorized=false`. The authorization template uses this exact schema but is marked `templateOnly=true` and cannot execute.
- Activation: the **absent** `STAGE1_V6_REMAINING49_PROVIDER_ACTIVATE_V1.json`. The activation template is inert and schema-aligned. Fresh explicit paid approval is required before any real authorization/activation. Future actual receipts must omit the template-only marker, preserve every boundary, and bind the authorization commit, activation parent, and reviewed workflow/runner hashes. Authorization precedes a separate activation-file-only commit.
- Artifact/status contract: `STAGE1_V6_REMAINING49_ARTIFACT_CONTRACT_V1.json`.
- Collector: `collect_stage1_v6_results_v1.py`, invoked by `.github/workflows/trackcade-semantic-external-stage1-v6-generation-freeze-v1.yml`. Its distinct offline-freeze activation file remains absent. It requires exactly 50 responses; ordinal 1 is the immutable frozen canary and ordinals 2–50 each bind a same-run reservation.

Execution is explicit ascending steps for 2–50 in one job. For each ordinal: reject any prior reservation/result → verify frozen prep and prepare locally → upload reservation → verify uploaded reservation identity → one runner attempt → upload result → require valid completion and successful upload. A failure skips every later ordinal. Workflow reruns and any earlier remaining-49 workflow execution are refused. No resume, retries or fallback exist. Reserved-but-interrupted ordinals remain closed, including when no result is available. Expired evidence is not permission to repeat a call; do not delete run history or locks to bypass this rule.

The job has a 360-minute ceiling. A timeout may leave fewer than 49 completed responses and must stop closed; it does not authorize a replacement run. This reconciliation proves local structure and behavior with synthetic tests, not successful paid execution or hosted Actions validation. No real prep/canary ZIP was retrieved or revalidated during this audit; their frozen identities are preserved from the branch receipts.

Historical competing implementations are superseded in-place: the matrix and inline HTTP runner in the same workflow are replaced, and the formerly incompatible templates now mirror the canonical receipt fields. Other V6 workflows are prep, contract, canary, scorer-contract, or offline-freeze workflows; they are not alternate remaining-49 execution routes. The canary remains frozen, and its historical workflow/receipts are unchanged.

Local validation: run `python -B -m unittest test_stage1_v6_remaining49_reconciliation_v1 test_stage1_v6_contract` from this directory. Tests use synthetic data and mocked transport only. Never run the paid runner CLI as an offline test. The RAW scorer is not part of this reconciliation and must remain inactive.

Product boundary: semantic non-Drops remain eligible for separate gameplay/action decisions. See `GAMEPLAY_ACTIONABILITY_BOUNDARY_V1.md`. This documentation changes no frozen V6 prompt, validator, scoring contract, Analyzer or gameplay implementation.

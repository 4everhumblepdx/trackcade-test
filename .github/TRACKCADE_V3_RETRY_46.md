# Trackcade V3: one-use retry for ordinal 46

This separate workflow reuses the successful ordinal-42 retry design. It adds no
changes to the ordinal-42 workflow, code, artifacts, or permanent locks.

## Manual inputs (paid execution only when you choose to run)

Open https://github.com/4everhumblepdx/trackcade-test/actions/workflows/trackcade-semantic-external-stage1-v3-retry-46-v1.yml

1. Click **Run workflow** to open the form.
2. Branch: **trackcade-semantic-external-holdout-v1**.
3. Ordinal: **46**.
4. Authorization: **ordinal-46-evidence-11030495842-v1**.
5. Click the green **Run workflow** once. Never use **Re-run jobs**.

The default-branch registration is inert. Selecting main cannot call OpenAI.

```sh
gh workflow run trackcade-semantic-external-stage1-v3-retry-46-v1.yml --repo 4everhumblepdx/trackcade-test --ref trackcade-semantic-external-holdout-v1 -f ordinal=46 -f authorization=ordinal-46-evidence-11030495842-v1
```

## Evidence and permanent locks

- Prior run: `36561301273`, attempt 1.
- Prior source: `5a78e69fc6a69346bc699ab233d666f2c1d658b3`.
- Retry-eligible artifact: `11030495842`.
- ZIP SHA256: `0c5275d74e0be07504cab7781a6daa0c0fafc1243967cb12b254842cd9d09da7`.
- Original lock: `refs/tags/trackcade-v3-provider-attempt-ordinal-46`.
- Original tag object: `37af0c79f341c6272c0cb458041579801a1ac431`.
- New one-use reservation, created only during a future authorized dispatch:
  `refs/tags/trackcade-v3-retry-ordinal-46-evidence-11030495842-v1`.

The original lock must match exactly and is never deleted or changed. An atomic
create-only retry reservation is consumed before invoking the frozen single-call
harness. No transport or orchestration retry loop exists. Preflight refusal makes
zero provider calls; a passing invocation makes one request. Any existing retry
reservation refuses reuse, including after failure, cancellation or lost output.

All completed, no-retry, unknown or newer ordinal-46 evidence refuses execution.
Expired completed evidence still refuses. Missing/expired authorized evidence
refuses. The exact ZIP digest, status, incomplete raw response, payload hashes,
prep identity, Analyzer identity and prior run must pass before a provider call.
The workflow rejects reruns, wrong branches, stale HEADs and unapproved inputs.
The shared V3 concurrency group serializes it with existing provider workflows.

Frozen settings remain `gpt-6-sol`, high reasoning, 4096 max output tokens,
`store:false`. No prompt, schema, prep, compiler, evaluation or terminal changes.
Analyzer source: `e308d867980fb1877c3f2e4ce27950deecac0855`.
Analyzer runner SHA256: `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`.

New case evidence uses the existing `case-46-completed`, `case-46-retry-eligible`
or `case-46-no-retry-observed` naming contract in a new run. Separate
`trackcade-v3-retry-46-audit-RUN_ID-ATTEMPT` artifacts preserve the prior ZIP,
authorization, both lock identities, live inventory, per-file hashes and new
case artifact identity. Artifacts retain for 90 days; locks remain permanently.
Any provider failure stops. Completed output stays closed even if validation fails.

## Offline checks

```sh
python -m unittest discover -s .github/scripts -p test_trackcade_v3_retry_46.py -v
```

Tests use synthetic fixtures and block unmocked subprocess/socket access. Live
GitHub metadata was verified; real prior ZIP content is checked at runtime before
any paid call. No workflow was dispatched or provider credit consumed to build this.

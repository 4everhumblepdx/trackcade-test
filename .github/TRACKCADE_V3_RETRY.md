# Trackcade V3: evidence-bound single retry

This separate manual workflow authorizes one attempt for development ordinal 42,
bound to preserved incomplete-response artifact **11028077891** from run
**36556254870**, attempt 1, source
`686a1b1c6d17a6343a5007db8ebbf325d758672d`.
It does not open the ordinary batch lane or change that lane's permanent locks.

## Run later, only when ready to spend API credit

1. Open Actions → **Trackcade V3 — Evidence-bound single retry**.
2. Click **Run workflow** to open the input form.
3. Select branch **trackcade-semantic-external-holdout-v1**.
4. Set **ordinal** to **42**.
5. Set **authorization** to **ordinal-42-evidence-11028077891-v1**.
6. Click the green **Run workflow** once. This is the paid execution step.

Equivalent command (do not run during build-only work):

```sh
gh workflow run trackcade-semantic-external-stage1-v3-retry-v1.yml --repo 4everhumblepdx/trackcade-test --ref trackcade-semantic-external-holdout-v1 -f ordinal=42 -f authorization=ordinal-42-evidence-11028077891-v1
```

Never use **Re-run jobs**. A rerun is excluded at both job and helper level.
The default-branch workflow is an inert registration stub; selecting `main`
cannot call the provider.

## Safeguards

- `workflow_dispatch` only; one ordinal, one job, one invocation of the unchanged
  frozen harness. Its adapter performs one HTTP request, with no transport retry.
  Failed preflight makes zero provider calls. No failure starts a second call.
- Same concurrency group as the existing V3 provider workflows.
- Complete paginated live artifact inventory must contain no completed,
  no-retry, unknown, or newer ordinal-42 evidence. Expired completed evidence
  still refuses; missing or expired authorized evidence refuses.
- The evidence ZIP must match SHA256
  `9b727163883eb7ec36de2e4023547f0b3e5250f1c00f0679d31e22087193faee`.
  Status, raw incomplete response, original run, payload hashes, frozen prep and
  Analyzer provenance must agree. Existing semantic proposal files refuse.
- Original permanent lock
  `refs/tags/trackcade-v3-provider-attempt-ordinal-42` must still point to tag object
  `042809e4b480a651034aca2b202f23407a30f88c`. It is never modified or deleted.
- Before the provider call, an atomic create-only reservation consumes this ticket:
  `refs/tags/trackcade-v3-retry-ordinal-42-evidence-11028077891-v1`.
  Any existing ordinal-42 retry reservation refuses further use. Both locks remain
  after success, failure, cancellation, timeout or missing output. An ambiguous
  outcome stays closed; it is never treated as permission to call again.
- GPT-6 Sol (`gpt-6-sol`), high reasoning, 4096 max output tokens, `store:false`.
  No prompt, prep, schema, compiler, Analyzer, evaluation or terminal-data changes.
- Analyzer source `e308d867980fb1877c3f2e4ce27950deecac0855`; runner SHA256
  `9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432`.

## Evidence after an authorized run

The new case artifact uses the existing `case-42-completed`, `case-42-retry-eligible`
or `case-42-no-retry-observed` naming contract, in its new run, so existing guards
can recognize it. It never overwrites the prior artifact. Separate
`trackcade-v3-retry-audit-RUN_ID-ATTEMPT` evidence preserves the authorization,
original ZIP, live inventories, original and retry lock objects, per-file hashes,
result status and new case artifact ID/digest/URL. GitHub upload outputs also
record the audit artifact identity. Uploads retain evidence for 90 days; permanent
lock refs outlive artifacts and are never automatically released.

If the response completes, it is closed even if semantic validation fails.
On 429, incomplete response, timeout or other failure, stop and review the new
evidence. This ticket cannot be reused. A future authorization requires a separate
reviewed change tied to that new evidence; do not remove either lock.

## Build-only verification

25 offline tests cover guarded inputs, reruns, completion/no-retry evidence,
missing/expired/altered evidence, stale authorization, permanent locks, changed
payloads, successful completion, 429, incomplete output, and timeout. Tests block
all unmocked subprocess and socket access. Run from a checkout with:

```sh
python -m unittest discover -s .github/scripts -p test_trackcade_v3_retry.py -v
```

Static validation confirms unchanged frozen pins and preflight checks, dispatch
only, shared concurrency, one provider step, and upload-before-stop ordering.
No workflow was dispatched and no provider credit was used to build this change.
The prior artifact metadata and failure logs were checked live. Local downloading
of the prior ZIP failed, so its inner-content checks were tested with synthetic
fixtures; the real ZIP must pass all checks at dispatch before any provider call.

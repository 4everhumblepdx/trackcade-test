# Trackcade V3 serialized resume

Build-only change: no workflow was dispatched and no provider request was made.
Baseline: branch 2465d2038c822c9bac0eb174469531b8e4c657b5, 37/50 complete.
Ordinal 4 closed in run 36498243430, completed artifact 11004511477,
SHA256 c41cd80f0c16c1c7fe14fe84864237609a24fdd46b9f5c742242a53f5b9c9a5b.

The existing registered filename is retained:
`.github/workflows/trackcade-semantic-external-stage1-v3-single-resume-v1.yml`.
Its displayed name is now **Trackcade V3 — Serialized batch resume (max 3)**.

## First batch (manual, incurs provider usage when dispatched)

```sh
gh workflow run trackcade-semantic-external-stage1-v3-single-resume-v1.yml --repo 4everhumblepdx/trackcade-test --ref trackcade-semantic-external-holdout-v1 -f ordinals=13,23,31
```

UI: Actions → Trackcade V3 — Serialized batch resume (max 3) → Run workflow →
branch `trackcade-semantic-external-holdout-v1` → `ordinals`: `13,23,31`.
This command was documented only, NOT executed during development.

One to three comma-separated, distinct development ordinals are required. Order is preserved.
Initial allowlist: 13,23,31,35,38,42,44,45,46,47,48,49,50.
These are development ordinals; development ordinal 50 is not the untouched terminal set.
All 37 prior completions, including 4, are permanently excluded by this allowlist.
Every selected ordinal must also pass a fresh, complete GitHub artifact and lock inventory.
Missing history, expired retry history, completed/no-retry/unknown evidence, source drift,
API errors, malformed input, and workflow reruns all fail closed.

## Serialization and durable closure

One job contains three ordered execute → upload → stop-check sequences, no matrix.
Only a completed, validated response with verified raw/payload hashes permits continuation.
Any infrastructure failure, 429, timeout, malformed response, validation failure, or upload
failure prevents all later songs from running. There are no automatic retries.
The workflow shares the existing V3 concurrency group and does not cancel active runs.

Before each provider invocation, GitHub atomically creates the annotated tag
`trackcade-v3-provider-attempt-ordinal-N`. The tag records source commit, ordinal,
run ID/attempt, and provider contract. An existing tag prevents any new attempt.
Tags are never updated or deleted by this machinery. They survive artifact expiration.
This requires `contents: write` only on the batch job; the script creates tag objects/refs,
not source edits. The existing GitHub token is used, with no new credential.

Conservative recovery rule: failed or interrupted attempts also retain their reservation.
A later paid retry needs a separate evidence review and explicit recovery change; this
workflow cannot unlock one. Never remove a lock for a completed/no-retry response.
Do not use the older matrix workflow or GitHub rerun controls.

Per-song artifact names retain the existing completed/retry-eligible/no-retry-observed
convention. The batch audit artifact includes the ordered plan, live inventories, tag
records, per-song status and file hashes, and upload artifact IDs/digests/URLs.
The frozen harness still records one run ID with a distinct ordinal for each song.

## Frozen scientific boundary

No changes to provider harness, prompt, model, schema, Analyzer, compiler, evaluator,
prep artifacts, or terminal data. All existing source blob and prep identity checks remain.
GPT-6 Sol, reasoning high, max_output_tokens 4096, store false are unchanged.
Analyzer source: e308d867980fb1877c3f2e4ce27950deecac0855.
Analyzer runner SHA256: 9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432.

Evaluation/collection logic is intentionally unchanged. The existing offline collector's
workflow-path restriction predates the single-song resume; it must be reconciled in a
separately authorized collection task before collecting new resume runs for evaluation.

## Offline tests

```sh
python -m unittest discover -s .github/scripts -p test_trackcade_v3_batch.py -v
```

Tests block unmocked subprocesses. Provider outcomes are synthetic fixtures, not API calls.
The registration copy on main cannot run provider work; select the experiment branch.

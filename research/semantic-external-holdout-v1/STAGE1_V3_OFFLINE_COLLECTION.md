# V3 offline collection and evaluation

## Current state and scope

Verified starting branch: trackcade-semantic-external-holdout-v1 at
2451c1f8f99de754331eaac52b6c6b8b3d070226.

The original evaluate_stage1_v3_drop_v1.py already existed at that commit
(Git blob 992449c16c3b74a15235f0a16a736a925fcc39b0). It imports the frozen
V1 scorer. This change extends that evaluator with a mandatory complete
generation-freeze gate and per-case provenance for multiple generation runs;
it does not introduce another scorer.

The initial run 36460242177 contains 36 completed responses. Runs
36461495392 and 36462381190 each contain 14 infrastructure-retry artifacts.
None of these retries added a completed response. Missing ordinals:
4, 13, 23, 31, 35, 38, 42, 44, 45, 46, 47, 48, 49, 50.

STAGE1_V3_ARTIFACT_INVENTORY_V1.json is a checksum-pinned, label-free
GitHub metadata snapshot, not a completed-generation freeze. All 64 case
ZIP digests were verified locally. The audit records the 36 completions
and the 28 unsuccessful retry observations without scoring any song.

No provider access is part of these programs. There is no audio loading,
Analyzer execution, compiler invocation, workflow dispatch, or terminal-set
evaluation. HTTP 429 retry failures do not justify another retry here.
Future provider work requires a separate live-state check and authorization.

## Offline inputs

- Exact frozen V3 preparation directory from artifact 10986506165,
  run 36457485587, source a0e58581a213f74ce166d4a02deea4d3bb89e9e3.
- Preparation ZIP SHA256:
  5f9e4159faf620f6b527fecc649b456633a3dccfca074dca7c6a422d3527e376.
- Preparation manifest SHA256:
  df7ceff4c82291552a2d55dd7ddf872269477d0766bf4cb785a90b5730779257.
- Case ZIPs named ARTIFACT_ID.zip in one directory, downloaded by immutable
  artifact ID. The collector verifies their exact GitHub digest and size.
- An inventory in the checked-in snapshot's format. A future inventory must
  retain every historical artifact and run identity and append all newly
  verified runs/artifacts. Record all artifact pages; total_count must match.
  Downloading and live inventory refresh are separate, read-only steps.
  The collector cannot establish that an offline inventory is the latest
  GitHub state, so re-check GitHub before freezing.

Keep the preparation and case ZIPs; GitHub artifacts expire.

## Collection

From this directory, with Python 3.10 or newer:

~~~text
python collect_stage1_v3_results_v1.py --prep-root PREP --artifact-root ZIPS --inventory STAGE1_V3_ARTIFACT_INVENTORY_V1.json --output-dir NEW_COLLECTION
~~~

Use a new, nonexistent output directory. Existing results are never overwritten.

An incomplete collection returns exit code 2 and writes an audit and inventory
only. It does not emit provider staging, a generation freeze, candidates, or
scores. Tampering and invalid provenance fail before publication.

A complete collection requires exactly one completed, validated response for
each frozen ordinal 1..50, with unique response IDs. Duplicate completions are
an error, never a choice between answers. A completed but invalid semantic
response remains scientifically closed: it blocks this evaluator and must
not be retried or silently treated as an empty Drop prediction. Ambiguous
non-retry outcomes also block freezing.

Once complete, the collector atomically publishes:
- an audit retaining all observed runs, artifacts, and file hashes;
- exact copies of the selected provider files under provider/01 ... provider/50;
- STAGE1_V3_GENERATION_FREEZE_V1.json binding all 50 cases, source identities,
  preparation identity, and inventory/audit checksums before label access.

## Evaluation, only after a complete freeze

~~~text
python evaluate_stage1_v3_drop_v1.py --prep-root PREP --provider-root NEW_COLLECTION/provider --generation-freeze NEW_COLLECTION/STAGE1_V3_GENERATION_FREEZE_V1.json --prep-artifact-id 10986506165 --references FROZEN_REFERENCES --output-dir NEW_EVALUATION
~~~

The gate rechecks all 50 selected files, the historical inventory, preparation,
and collection/evaluation/scoring source hashes before opening reference labels.
FROZEN_REFERENCES must match the already-frozen V1/V2 reference SHA256
1b74d185d47ea52db62d4c23cdbd44375b6ba0a05cf3824c4278e88646db9d1c.
Only its stage1 identities and Drop labels are scored. No reference file was
downloaded or read during the current collection work.

Drop times resolve only to packet.anchors[event.anchor.index][0].
The imported, unchanged V1 matcher remains Git blob
3d74996281ec260e170ea10929bd0115a6d4ac70 and file SHA256
90aefb42a868553c75de4c3cca26bb646fc4706e8fbd09892e4a412323b62bb8.
Windows are ±1 second, ±2 seconds primary, and ±5 seconds.
V3 remains raw-proposal-only. There is no compiler-accepted metric.

Analyzer v0.19 source:
e308d867980fb1877c3f2e4ce27950deecac0855.
Analyzer runner SHA256:
9d579842207a1482ef6d12d34d6d82d03b02021d88de65c19abaf41f8692f432.

## Tests

~~~text
python -m unittest discover -s . -p test_stage1_v3_collection.py -v
~~~

Tests construct explicitly synthetic prep, response, and reference fixtures
inside temporary directories. Test-only mocks permit synthetic prep/reference
hashes and omit the real historical inventory; production has no bypass flag.
Tests include partial 36/50 refusal, complete multi-run freezing/scoring,
duplicate completion rejection, archive and frozen-file tampering, run/model
drift, invalid semantic completions, late retries, missing historical runs,
no overwrite, bad anchors, and refusing reference access before the freeze gate.

## Remaining work

Obtain the 14 missing responses only when separately justified provider access
is restored, using the unchanged frozen requests and no semantic retries.
Re-verify live GitHub state, append new artifact provenance, collect all 50,
freeze, and then run this evaluator with the unchanged frozen references.
A completed invalid response requires an explicit protocol decision, not an
automatic retry or a new metric. Terminal 50 stays untouched.


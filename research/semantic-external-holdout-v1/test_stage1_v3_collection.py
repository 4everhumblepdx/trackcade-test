"""Synthetic offline fixtures only; no provider, audio, or benchmark labels."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import zipfile

import collect_stage1_v3_results_v1 as c
import evaluate_stage1_v3_drop_v1 as evaluator


def encoded(value):
    return (json.dumps(value, sort_keys=True) + "\n").encode()


class CollectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.prep = self.root / "prep"
        self.artifacts = self.root / "artifacts"
        self.artifacts.mkdir()
        self.inventory = {"repository": "4everhumblepdx/trackcade-test",
                          "branch": "trackcade-semantic-external-holdout-v1", "runs": []}
        self.rows = {}
        for ordinal in range(1, 51):
            hashes = {}
            case = self.prep / "cases" / f"{ordinal:02d}-synthetic{ordinal}"
            case.mkdir(parents=True)
            for name, key, value in [
                ("structure-evidence-v2.json", "structureEvidenceV2Sha256", {"anchors": [[10.0, 0, 0, 0, 0]]}),
                ("structure-evidence-v2-source-map.json", "sourceMapSha256", {}),
                ("learned-request-v3.json", "learnedRequestV3Sha256", {}),
                ("openai-payload-v3.json", "openaiPayloadV3Sha256", c.CONTRACT),
                ("instruction-diff-v3.json", "instructionDiffV3Sha256", {}),
                ("openai-adapter-prepare-report-v3.json", "adapterPrepareReportV3Sha256", {}),
            ]:
                data = encoded(value)
                (case / name).write_bytes(data)
                hashes[key] = c.digest(data)
            self.rows[ordinal] = {
                "ordinal": ordinal, "id": f"synthetic/{ordinal}", "stem": f"synthetic{ordinal}",
                "analyzerRunnerSha256": c.ANALYZER_SHA, "analyzerSourceCommit": c.ANALYZER_SOURCE,
                "analysisJsonSha256": "a" * 64, "hashes": hashes, "timingTier": "standard",
            }
        manifest = {"schema": evaluator.PREP_SCHEMA,
                    "status": "frozen-v3-provider-payloads-prepared-no-provider-call",
                    "developmentRevision": c.REVISION, "trackCount": 50,
                    "tracks": list(self.rows.values()), "referenceLabelsReadByPreparation": False,
                    "terminalTracksProcessed": False, "compilerInvoked": False, "providerCallsObserved": 0}
        data = encoded(manifest)
        (self.prep / "STAGE1_V3_PREP_MANIFEST_V1.json").write_bytes(data)
        self.pin = patch.object(c, "PREP_SHA", c.digest(data))
        self.pin.start()
        self.addCleanup(self.pin.stop)
        self.inv_path = self.root / "inventory.json"
        self.baseline_check = c.verify_baseline
        baseline_patch = patch.object(c, "verify_baseline")
        baseline_patch.start()
        self.addCleanup(baseline_patch.stop)

    def add(self, ordinal, run_id=101, completed=True, edit=None):
        row = self.rows[ordinal]
        run = next((g for g in self.inventory["runs"] if g["run"]["id"] == run_id), None)
        if run is None:
            run = {"run": {"id": run_id, "run_attempt": 1, "head_sha": f"{run_id:040x}",
                          "head_branch": self.inventory["branch"], "status": "completed",
                          "path": ".github/workflows/trackcade-semantic-external-stage1-v3-sol-v1.yml"},
                   "total_count": 0, "artifacts": []}
            self.inventory["runs"].append(run)
        files = {n: encoded({}) for n in c.FILES}
        files["openai-payload-v3.json"] = encoded(c.CONTRACT)
        files["preflight-openai-payload-v3.json"] = encoded(c.CONTRACT)
        raw = {"object": "response", "status": "completed", "id": f"synthetic-response-{ordinal}-{run_id}",
               "model": "gpt-6-sol"}
        files["raw-response.json"] = encoded(raw if completed else {"error": "synthetic HTTP 429"})
        files["normalized-proposal.json"] = encoded({
            "schema": evaluator.PROPOSAL_SCHEMA,
            "source": {"analyzerRunnerSha256": c.ANALYZER_SHA, "analysisJsonSha256": "a" * 64},
            "events": [{"kind": "drop", "anchor": {"type": "evidence", "index": 0}}],
        })
        status = {
            "schema": evaluator.CASE_SCHEMA, "stage": "stage1-v3", "developmentRevision": c.REVISION,
            "ordinal": ordinal, "id": row["id"], "stem": row["stem"],
            "githubRunId": str(run_id), "githubRunAttempt": 1,
            "harnessSourceCommit": run["run"]["head_sha"], "prepArtifactId": c.PREP_ID,
            "analyzerRunnerSha256": c.ANALYZER_SHA, "analyzerSourceCommit": c.ANALYZER_SOURCE,
            "analysisJsonSha256": row["analysisJsonSha256"], "sourceMapSha256": row["hashes"]["sourceMapSha256"],
            "compilerInvoked": False, "semanticRetryCount": 0, "providerContract": c.CONTRACT,
            "frozenPayloadSha256": row["hashes"]["openaiPayloadV3Sha256"],
            "providerCompletedSemanticResponse": completed, "providerResponseObserved": True,
            "providerCallAttempted": True, "retryAuthorized": not completed,
            "responseModel": "gpt-6-sol", "openaiResponseId": raw["id"] if completed else None,
            "classification": c.VALID if completed else "provider_infrastructure_no_completed_response",
            "providerCallStartedAt": f"2026-09-28T{10 if run_id == 101 else 11}:00:00Z",
            "finishedAt": f"2026-09-28T{10 if run_id == 101 else 11}:01:00Z",
        }
        for name, key in c.FILES.items():
            status[key] = c.digest(files[name])
        if edit:
            edit(status, files)
        files[c.STATUS_FILE] = encoded(status)
        aid = sum(g["total_count"] for g in self.inventory["runs"]) + 1000
        path = self.artifacts / f"{aid}.zip"
        with zipfile.ZipFile(path, "w") as z:
            for name, value in files.items():
                z.writestr(name, value)
        artifact = {"id": aid, "name": f"trackcade-semantic-external-stage1-v3-sol-v1-case-{ordinal}-"
                    + ("completed" if completed else "retry-eligible"),
                    "digest": "sha256:" + c.digest(path.read_bytes()), "size_in_bytes": path.stat().st_size,
                    "workflow_run": {"id": run_id, "head_sha": run["run"]["head_sha"]}}
        run["artifacts"].append(artifact)
        run["total_count"] += 1
        return path

    def collect(self):
        self.inv_path.write_bytes(encoded(self.inventory))
        return c.collect(self.prep, self.artifacts, self.inv_path, self.root / "collection")

    def test_pinned_artifact_attempt_overrides_latest_run_attempt(self):
        path=self.add(1)
        g=self.inventory['runs'][0]
        g['run']['run_attempt']=2
        g['artifacts'][0]['run_attempt']=1
        self.assertEqual(self.collect()['completedTracks'],1)

    def test_retry_workflow_requires_bound_provenance(self):
        path=self.add(42)
        g=self.inventory['runs'][0]
        g['run']['path']='.github/workflows/trackcade-semantic-external-stage1-v3-retry-v1.yml'
        with self.assertRaisesRegex(ValueError,'retry provenance absent'): self.collect()

    def test_retry_workflow_accepts_exact_provenance(self):
        path=self.add(46)
        g=self.inventory['runs'][0]
        g['run']['path']='.github/workflows/trackcade-semantic-external-stage1-v3-retry-46-v1.yml'
        provenance=dict(ticket='ordinal-46-evidence-11030495842-v1',ordinal=46,
            originalLock='refs/tags/trackcade-v3-provider-attempt-ordinal-46',
            retryLock='refs/tags/trackcade-v3-retry-ordinal-46-evidence-11030495842-v1',
            priorArtifactId=11030495842,source=g['run']['head_sha'],runId='101')
        with zipfile.ZipFile(path,'a') as z: z.writestr('retry-provenance.json',encoded(provenance))
        g['artifacts'][0].update(digest='sha256:'+c.digest(path.read_bytes()),size_in_bytes=path.stat().st_size)
        self.assertEqual(self.collect()['completedTracks'],1)

    def test_partial_36_does_not_freeze(self):
        for o in range(1, 37):
            self.add(o)
        result = self.collect()
        self.assertEqual(result["completedTracks"], 36)
        self.assertFalse((self.root / "collection" / c.FREEZE_FILE).exists())
        self.assertFalse((self.root / "collection/provider").exists())

    def test_missing_historical_runs_rejected(self):
        with self.assertRaisesRegex(ValueError, "historical run omitted"):
            self.baseline_check(self.inventory)

    def test_all_50_multirun_freeze_and_frozen_scoring(self):
        self.add(50, completed=False)
        for o in range(1, 51):
            self.add(o, 101 if o < 50 else 102)
        self.assertEqual(self.collect()["status"], "complete-ready-to-freeze")
        root = self.root / "collection"
        cases = c.verify_freeze(root / c.FREEZE_FILE, self.prep, root / "provider")
        self.assertEqual(len(cases), 50)
        refs = self.root / "synthetic-references.json"
        refs.write_bytes(encoded({"schema": evaluator.frozen.REFERENCE_SCHEMA, "eventKind": "drop",
                                 "stage1": [{"id": r["id"], "dropsSeconds": [10.0]} for r in self.rows.values()]}))
        args = ["eval", "--prep-root", str(self.prep), "--provider-root", str(root / "provider"),
                "--references", str(refs), "--generation-freeze", str(root / c.FREEZE_FILE),
                "--prep-artifact-id", c.PREP_ID, "--output-dir", str(self.root / "scores")]
        with patch("sys.argv", args), patch.object(evaluator, "REFERENCE_SHA256", c.digest(refs.read_bytes())), contextlib.redirect_stdout(io.StringIO()):
            evaluator.main()
        scores = c.load(self.root / "scores/STAGE1_V3_DROP_EVALUATION_V1.json")
        self.assertEqual(set(scores["proposalDropsSeconds"]), {"1.0", "2.0", "5.0"})
        for tol in evaluator.frozen.TOLERANCES:
            expected = evaluator.frozen.aggregate([evaluator.frozen.score_track([10.0], [10.0], tol)] * 50)
            self.assertEqual(scores["proposalDropsSeconds"][str(tol)]["aggregate"], expected)

    def test_duplicate_completion_rejected(self):
        self.add(1)
        self.add(1, 102)
        with self.assertRaisesRegex(ValueError, "duplicate completed"):
            self.collect()

    def test_tampered_archive_rejected(self):
        path = self.add(1)
        path.write_bytes(path.read_bytes() + b"tamper")
        with self.assertRaisesRegex(ValueError, "digest"):
            self.collect()

    def test_wrong_run_binding_rejected(self):
        self.add(1, edit=lambda s, f: s.update(githubRunId="other"))
        with self.assertRaisesRegex(ValueError, "githubRunId"):
            self.collect()

    def test_changed_model_rejected(self):
        self.add(1, edit=lambda s, f: s.update(providerContract={**c.CONTRACT, "model": "other"}))
        with self.assertRaisesRegex(ValueError, "providerContract"):
            self.collect()

    def test_completed_invalid_proposal_never_retry_or_freeze(self):
        self.add(1, edit=lambda s, f: s.update(classification="provider_completed_v3_proposal_validation_failure_no_retry"))
        result = self.collect()
        self.assertEqual(result["completedTracks"], 1)
        self.assertEqual(result["blockedOrdinals"], [1])
        self.assertNotIn(1, result["missingCompletedResponseOrdinals"])

    def test_incomplete_gate_precedes_reference_access(self):
        with patch("sys.argv", ["eval", "--prep-root", str(self.prep),
                              "--provider-root", str(self.root / "missing"),
                              "--references", str(self.root / "DO_NOT_READ"),
                              "--generation-freeze", str(self.root / "missing-freeze"),
                              "--prep-artifact-id", c.PREP_ID, "--output-dir", str(self.root / "scores")]):
            with patch.object(evaluator, "load", side_effect=AssertionError("read references too early")):
                with self.assertRaises(FileNotFoundError):
                    evaluator.main()
        self.assertFalse((self.root / "scores").exists())

    def test_post_freeze_tampering_rejected(self):
        for o in range(1, 51):
            self.add(o)
        self.collect()
        root = self.root / "collection"
        (root / "provider/01/raw-response.json").write_text("{}")
        with self.assertRaisesRegex(ValueError, "changed"):
            c.verify_freeze(root / c.FREEZE_FILE, self.prep, root / "provider")

    def test_retry_after_completion_rejected(self):
        self.add(1)
        self.add(1, 102, completed=False)
        with self.assertRaisesRegex(ValueError, "retry after"):
            self.collect()

    def test_no_output_overwrite(self):
        self.collect()
        with self.assertRaisesRegex(ValueError, "overwrite"):
            self.collect()

    def test_bad_anchor_rejected(self):
        for anchor in [{"type": "evidence", "index": True}, {"type": "boundary", "index": 0},
                       {"type": "evidence", "index": 99}]:
            with self.assertRaises(SystemExit):
                evaluator.resolve_drop_times({"anchors": [[10, 0, 0, 0, 0]]},
                                             {"events": [{"kind": "drop", "anchor": anchor}]})

    def test_nonfinite_anchor_time_rejected(self):
        for time in [True, float("nan"), float("inf"), -1]:
            with self.assertRaises(SystemExit):
                evaluator.resolve_drop_times({"anchors": [[time, 0, 0, 0, 0]]},
                    {"events": [{"kind": "drop", "anchor": {"type": "evidence", "index": 0}}]})


if __name__ == "__main__":
    unittest.main()


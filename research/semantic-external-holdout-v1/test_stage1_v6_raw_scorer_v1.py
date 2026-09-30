#!/usr/bin/env python3
from __future__ import annotations

import importlib.util
import json
import tempfile
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
SCORER_PATH = HERE / "evaluate_stage1_v6_raw_v1.py"
TEMPLATE_PATH = HERE / "STAGE1_V6_RAW_SCORING_ACTIVATION_TEMPLATE_V1.json"

spec = importlib.util.spec_from_file_location("v6raw", SCORER_PATH)
v6raw = importlib.util.module_from_spec(spec)
assert spec.loader is not None
spec.loader.exec_module(v6raw)


class V6RawScorerContractTests(unittest.TestCase):
    def test_historical_matcher_provenance_is_exact(self):
        self.assertEqual(v6raw.HISTORICAL_SCORER_COMMIT, "81985328360e7cd0f70c03ea2b3c63fa94f1d14f")
        self.assertEqual(v6raw.HISTORICAL_SCORER_PATH, "research/semantic-external-holdout-v1/evaluate_stage1_drop_v1.py")
        self.assertEqual(v6raw.HISTORICAL_SCORER_BLOB, "3d74996281ec260e170ea10929bd0115a6d4ac70")
        self.assertEqual(v6raw.HISTORICAL_SCORER_SHA256, "90aefb42a868553c75de4c3cca26bb646fc4706e8fbd09892e4a412323b62bb8")

    def test_matcher_maximizes_cardinality_then_minimizes_error(self):
        pairs, errors = v6raw.match_one_to_one([0.0, 10.0], [1.0, 8.0, 10.5], 3.0)
        self.assertEqual(pairs, ((0, 0), (1, 2)))
        self.assertEqual(errors, [1.0, 0.5])

    def test_matcher_uses_deterministic_lexical_tie_break(self):
        pairs, errors = v6raw.match_one_to_one([0.0, 10.0], [1.0, 9.0, 11.0], 2.0)
        self.assertEqual(pairs, ((0, 0), (1, 1)))
        self.assertEqual(errors, [1.0, 1.0])

    def test_frozen_tolerances_and_boundary_are_exact(self):
        self.assertEqual(v6raw.TOLERANCES, (1.0, 2.0, 5.0))
        self.assertEqual(v6raw.PRIMARY_TOLERANCE, 2.0)
        pairs, _ = v6raw.match_one_to_one([10.0], [11.0], 1.0)
        self.assertEqual(pairs, ((0, 0),))
        pairs, _ = v6raw.match_one_to_one([10.0], [11.000001], 1.0)
        self.assertEqual(pairs, ())

    def test_inactive_activation_template_must_fail(self):
        template = json.loads(TEMPLATE_PATH.read_text(encoding="utf-8"))
        self.assertFalse(template["developmentSetScoringAuthorized"])
        self.assertFalse(template["stage1ReferenceOpeningAuthorized"])
        self.assertFalse(template["terminalHoldoutAuthorized"])
        with self.assertRaises(SystemExit):
            v6raw.verify_activation(TEMPLATE_PATH, "0" * 64)

    def test_candidate_time_is_analyzer_owned_packet_anchor(self):
        with tempfile.TemporaryDirectory() as td:
            root = Path(td)
            freeze = root / "freeze"
            prep = root / "prep"
            (freeze / "proposals").mkdir(parents=True)
            (prep / "cases" / "01-demo").mkdir(parents=True)
            proposal = {
                "schema": v6raw.PROPOSAL_SCHEMA,
                "source": {},
                "candidateAssessments": [],
                "trackSummary": {},
                "events": [
                    {"kind": "drop", "anchor": {"type": "evidence", "index": 1}},
                    {"kind": "section", "anchor": {"type": "evidence", "index": 0}},
                ],
            }
            packet = {"anchors": [[3.25, None, None, None, None], [17.75, None, None, None, None]]}
            (freeze / "proposals" / "01-demo.json").write_text(json.dumps(proposal), encoding="utf-8")
            (prep / "cases" / "01-demo" / "structure-evidence-v2.json").write_text(json.dumps(packet), encoding="utf-8")
            cases = [{"ordinal": 1, "id": "demo.mp3", "stem": "demo", "dropCount": 1}]
            self.assertEqual(v6raw.candidate_times(cases, freeze, prep), {"demo.mp3": [17.75]})

    def test_scorer_has_no_provider_or_compiler_execution_path(self):
        source = SCORER_PATH.read_text(encoding="utf-8")
        self.assertNotIn("import subprocess", source)
        self.assertNotIn("OPENAI_API_KEY", source)
        self.assertNotIn("--compiler", source)
        main_start = source.index("def main():")
        main_text = source[main_start:]
        self.assertLess(main_text.index("verify_complete_freeze("), main_text.index("verify_activation("))
        self.assertLess(main_text.index("verify_activation("), main_text.index("open_references_after_closure("))

    def test_scoring_math_matches_frozen_edge_conventions(self):
        both_empty = v6raw.score_track([], [], 2.0)
        self.assertEqual((both_empty["precision"], both_empty["recall"], both_empty["f1"]), (1.0, 1.0, 1.0))
        no_refs = v6raw.score_track([], [10.0], 2.0)
        self.assertEqual((no_refs["precision"], no_refs["recall"], no_refs["f1"]), (0.0, 1.0, 0.0))
        no_cands = v6raw.score_track([10.0], [], 2.0)
        self.assertEqual((no_cands["precision"], no_cands["recall"], no_cands["f1"]), (1.0, 0.0, 0.0))


if __name__ == "__main__":
    unittest.main(verbosity=2)

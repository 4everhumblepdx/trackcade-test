#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEARNED = HERE.parent / "learned-interpretation-v1"
sys.path.insert(0, str(LEARNED))

import build_learned_request_v3 as v3_builder
import build_learned_request_v4 as v4_builder
import openai_responses_adapter_v4 as adapter
import validate_learned_proposal_v3 as packet_validator
import validate_learned_proposal_v4 as validator


def packet():
    return {
        "schema": "trackcade-structure-evidence-v2",
        "policy": "current-core-accent-table-v2",
        "encoding": "table",
        "source": {
            "analysisJsonSha256": "1" * 64,
            "analyzerRelease": "v0.19",
            "analyzerRunnerSha256": packet_validator.ANALYZER_RUNNER_SHA256,
            "analyzerSourceCommit": packet_validator.ANALYZER_SOURCE_COMMIT,
            "beatOffset": 0.1,
            "bpm": 128.0,
            "duration": 120.0,
            "interpretationPacketV1Sha256": "2" * 64,
            "structureEvidenceV1Sha256": "3" * 64,
        },
        "sourceMapSha256": "4" * 64,
        "anchorColumns": ["time", "priorityCode", "sourceCode", "salience", "confidence"],
        "priorityCodes": ["core", "accent", "optional"],
        "sourceCodes": ["beat", "onset", "downbeat", "transition"],
        "anchors": [
            [10.0, None, None, None, None],
            [20.0, 0, 3, 0.8, 0.9],
            [30.0, 1, 1, 0.7, 0.8],
        ],
        "context": {
            "timingTrust": {},
            "structureTrust": {},
            "energy": {},
            "sections": [],
            "boundaries": [{"anchor": 0}],
            "landmarks": [{"anchor": 1}],
            "lowDemandWindows": [],
        },
        "interpretationContract": {
            "analyzerSemanticHintsExposed": False,
            "anchorReference": "zero-based anchors row index",
            "beatOrBpmEditsAllowed": False,
            "compilerIntegration": "not-enabled",
            "independentTimestampsAllowed": False,
            "instruction": "Anchor time is deterministic.",
            "timingAuthority": "frozen-analyzer-derived-anchor-only",
            "usage": "offline-evidence-research-only",
        },
    }


def source(p):
    return {
        "analyzerRunnerSha256": p["source"]["analyzerRunnerSha256"],
        "analysisJsonSha256": p["source"]["analysisJsonSha256"],
    }


def comparison(index=1, role="selected_drop", distinctiveness=0.8):
    return {
        "anchor": {"type": "evidence", "index": index},
        "role": role,
        "distinctiveness": distinctiveness,
        "rationale": "Compared with the track's other strong transitions.",
    }


def event(index=1, kind="drop", confidence=0.5):
    return {
        "kind": kind,
        "semanticConfidence": confidence,
        "anchor": {"type": "evidence", "index": index},
        "name": "Drop" if kind == "drop" else "Energy lift",
        "rationale": "Meaning is supported by the supplied frozen evidence.",
    }


def proposal(p=None, presence="drop_present", localization="localized", comparisons=None, events=None):
    p = p or packet()
    if comparisons is None:
        comparisons = [comparison()]
    if events is None:
        events = [event()]
    return {
        "schema": v4_builder.PROPOSAL_SCHEMA,
        "source": source(p),
        "trackSemanticDecision": {
            "dropPresence": presence,
            "presenceConfidence": 0.7,
            "localizationStatus": localization,
            "rationale": "Track-level decision after comparing plausible strong transitions.",
        },
        "candidateComparisons": comparisons,
        "events": events,
    }


def request(p=None):
    p = p or packet()
    return {
        "schema": v4_builder.REQUEST_SCHEMA,
        "instruction": v4_builder.INSTRUCTION,
        "packet": p,
        "responseContract": {
            "schema": v4_builder.PROPOSAL_SCHEMA,
            "topLevelKeys": ["schema", "source", "trackSemanticDecision", "candidateComparisons", "events"],
            "sourceKeys": ["analyzerRunnerSha256", "analysisJsonSha256"],
            "trackSemanticDecisionKeys": ["dropPresence", "presenceConfidence", "localizationStatus", "rationale"],
            "allowedDropPresence": ["drop_present", "no_drop", "insufficient_semantic_evidence"],
            "allowedLocalizationStatus": ["localized", "no_selectable_anchor", "not_applicable"],
            "candidateComparisonKeys": ["anchor", "role", "distinctiveness", "rationale"],
            "allowedComparisonRoles": ["selected_drop", "ordinary_transition", "ambiguous"],
            "allowedKinds": ["section", "energy", "peak", "drop"],
            "allowedAnchorTypes": ["evidence"],
            "maxEvents": 64,
            "maxCandidateComparisons": 64,
            "independentTimestampsAllowed": False,
            "beatOrBpmEditsAllowed": False,
            "confidenceFieldsDiagnosticOnly": True,
            "outputFormat": "json_object_only",
        },
        "integrity": {
            "packetSha256": "0" * 64,
            "sourceMapSha256": p["sourceMapSha256"],
            "instructionSha256": v4_builder.sha256_bytes(v4_builder.INSTRUCTION.encode()),
            "v3SourceInstructionSha256": v4_builder.sha256_bytes(v3_builder.INSTRUCTION.encode()),
            "analyzerRunnerSha256": p["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": p["source"]["analysisJsonSha256"],
            "developmentRevision": v4_builder.DEVELOPMENT_REVISION,
        },
    }


class V4ContractTests(unittest.TestCase):
    def test_localized_drop_valid(self):
        norm, errors = validator.validate_and_normalize(packet(), proposal())
        self.assertEqual(errors, [])
        self.assertEqual(norm["trackSemanticDecision"]["dropPresence"], "drop_present")
        self.assertEqual(norm["events"][0]["anchor"], {"type": "evidence", "index": 1})

    def test_no_drop_abstention_valid_with_non_drop_event(self):
        q = proposal(
            presence="no_drop",
            localization="not_applicable",
            comparisons=[comparison(1, "ordinary_transition", 0.2)],
            events=[event(1, "energy", 0.9)],
        )
        norm, errors = validator.validate_and_normalize(packet(), q)
        self.assertEqual(errors, [])
        self.assertEqual(norm["trackSemanticDecision"]["dropPresence"], "no_drop")

    def test_insufficient_semantic_evidence_valid(self):
        q = proposal(
            presence="insufficient_semantic_evidence",
            localization="not_applicable",
            comparisons=[comparison(1, "ambiguous", 0.4)],
            events=[],
        )
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertEqual(errors, [])

    def test_no_drop_with_drop_event_rejected(self):
        q = proposal(presence="no_drop", localization="not_applicable")
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("abstention_forbids_drop_events" in x for x in errors))

    def test_insufficient_with_selected_drop_rejected(self):
        q = proposal(
            presence="insufficient_semantic_evidence",
            localization="not_applicable",
            comparisons=[comparison(1, "selected_drop")],
            events=[],
        )
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("abstention_forbids_selected_drop" in x for x in errors))

    def test_drop_event_requires_matching_selected_comparison(self):
        q = proposal(comparisons=[comparison(1, "ordinary_transition")])
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("missing_selected_comparison" in x for x in errors))

    def test_selected_comparison_requires_matching_drop_event(self):
        q = proposal(events=[event(1, "energy")])
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("missing_drop_event" in x for x in errors))

    def test_no_selectable_anchor_valid_without_drop(self):
        q = proposal(
            presence="drop_present",
            localization="no_selectable_anchor",
            comparisons=[comparison(1, "ambiguous")],
            events=[],
        )
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertEqual(errors, [])

    def test_localized_requires_drop(self):
        q = proposal(
            presence="drop_present",
            localization="localized",
            comparisons=[comparison(1, "ambiguous")],
            events=[],
        )
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("localized_requires_drop_event" in x for x in errors))

    def test_duplicate_comparison_anchor_rejected(self):
        q = proposal(comparisons=[comparison(1, "selected_drop"), comparison(1, "ordinary_transition")])
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("duplicate_anchor" in x for x in errors))

    def test_out_of_range_and_independent_time_rejected(self):
        q = proposal(comparisons=[comparison(99, "selected_drop")], events=[event(99)])
        q["events"][0]["time"] = 20.0
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("anchor_index_out_of_range" in x for x in errors))
        self.assertTrue(any("forbidden_timing_key" in x or "unexpected_keys" in x for x in errors))

    def test_confidence_is_not_a_gate(self):
        q = proposal(events=[event(1, "drop", 0.2)])
        q["trackSemanticDecision"]["presenceConfidence"] = 0.2
        q["candidateComparisons"][0]["distinctiveness"] = 0.2
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertEqual(errors, [])

    def test_instruction_declares_semantic_retuning_and_abstention(self):
        diff = v4_builder.instruction_diff_record()
        self.assertTrue(diff["semanticRetuningPerformed"])
        self.assertEqual(diff["retuningVariable"], "drop-presence-and-track-relative-distinctiveness")
        low = v4_builder.INSTRUCTION.lower()
        self.assertIn("drop_present", low)
        self.assertIn("no_drop", low)
        self.assertIn("insufficient_semantic_evidence", low)
        self.assertIn("other strong transitions", low)
        self.assertIn("diagnostic only", low)
        self.assertNotIn("semanticconfidence >= 0.92", low)
        self.assertNotIn("reference_drops", low)
        self.assertNotIn("dropsseconds", low)

    def test_adapter_strict_schema_matches_local_contract(self):
        schema = adapter.proposal_json_schema(request())
        self.assertEqual(
            schema["required"],
            ["schema", "source", "trackSemanticDecision", "candidateComparisons", "events"],
        )
        event_required = schema["properties"]["events"]["items"]["required"]
        self.assertEqual(event_required, ["kind", "semanticConfidence", "anchor", "name", "rationale"])
        self.assertEqual(schema["properties"]["events"]["items"]["properties"]["anchor"]["properties"]["index"]["maximum"], 2)

    def test_adapter_provider_input_excludes_source_map_and_labels(self):
        payload = adapter.build_api_payload(request(), "gpt-6-sol", "high", 4096)
        provider_input = json.loads(payload["input"])
        encoded = json.dumps(provider_input).lower()
        for token in ('"aliases"', '"aliascolumns"', '"dropsseconds"', "reference_drops", '"diagnosticlabelhint"'):
            self.assertNotIn(token, encoded)
        self.assertEqual(provider_input["packet"]["sourceMapSha256"], "4" * 64)
        self.assertEqual(payload["model"], "gpt-6-sol")
        self.assertEqual(payload["reasoning"], {"effort": "high"})
        self.assertEqual(payload["max_output_tokens"], 4096)
        self.assertFalse(payload["store"])


if __name__ == "__main__":
    unittest.main()

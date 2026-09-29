#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEARNED = HERE.parent / "learned-interpretation-v1"
sys.path.insert(0, str(LEARNED))

import build_learned_request_v5 as builder
import openai_responses_adapter_v5 as adapter
import validate_learned_proposal_v3 as packet_validator
import validate_learned_proposal_v5 as validator


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
            [40.0, 0, 3, 0.9, 0.9],
        ],
        "context": {
            "timingTrust": {}, "structureTrust": {}, "energy": {}, "sections": [],
            "boundaries": [{"anchor": 0}], "landmarks": [{"anchor": 1}], "lowDemandWindows": [],
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


def assessment(index=1, role="drop", repetition="independent", confidence=0.5,
               preparation="clear", impact="clear", sustained="clear"):
    return {
        "anchor": {"type": "evidence", "index": index},
        "semanticRole": role,
        "preparation": preparation,
        "impactRelease": impact,
        "sustainedStrongerPassage": sustained,
        "repetitionRelation": repetition,
        "semanticConfidence": confidence,
        "rationale": "Candidate judged against the absolute three-part Drop definition.",
    }


def event(index=1, kind="drop", confidence=0.5):
    return {
        "kind": kind,
        "semanticConfidence": confidence,
        "anchor": {"type": "evidence", "index": index},
        "name": "Drop" if kind == "drop" else "Energy lift",
        "rationale": "Meaning is supported by the supplied frozen evidence.",
    }


def proposal(p=None, assessments=None, events=None, presence=None, drop_count=None, ambiguous_count=None):
    p = p or packet()
    if assessments is None:
        assessments = [assessment()]
    if events is None:
        events = [event()]
    drops = sum(1 for a in assessments if a["semanticRole"] == "drop")
    ambiguous = sum(1 for a in assessments if a["semanticRole"] == "ambiguous")
    if presence is None:
        presence = "drop_present" if drops else ("ambiguous_only" if ambiguous else "no_drop")
    return {
        "schema": builder.PROPOSAL_SCHEMA,
        "source": source(p),
        "candidateAssessments": assessments,
        "trackSummary": {
            "dropPresence": presence,
            "dropCount": drops if drop_count is None else drop_count,
            "ambiguousCandidateCount": ambiguous if ambiguous_count is None else ambiguous_count,
            "rationale": "Summary derived after candidate-level decisions.",
        },
        "events": events,
    }


def request(p=None):
    p = p or packet()
    return {
        "schema": builder.REQUEST_SCHEMA,
        "instruction": builder.INSTRUCTION,
        "packet": p,
        "responseContract": {
            "schema": builder.PROPOSAL_SCHEMA,
            "topLevelKeys": ["schema", "source", "candidateAssessments", "trackSummary", "events"],
            "sourceKeys": ["analyzerRunnerSha256", "analysisJsonSha256"],
            "candidateAssessmentKeys": ["anchor", "semanticRole", "preparation", "impactRelease", "sustainedStrongerPassage", "repetitionRelation", "semanticConfidence", "rationale"],
            "allowedSemanticRoles": builder.SEMANTIC_ROLES,
            "allowedPatternStates": builder.PATTERN_STATES,
            "allowedRepetitionRelations": builder.REPETITION_RELATIONS,
            "trackSummaryKeys": ["dropPresence", "dropCount", "ambiguousCandidateCount", "rationale"],
            "allowedDerivedDropPresence": builder.DERIVED_PRESENCE,
            "allowedKinds": ["section", "energy", "peak", "drop"],
            "allowedAnchorTypes": ["evidence"],
            "maxEvents": builder.MAX_EVENTS,
            "maxCandidateAssessments": builder.MAX_ASSESSMENTS,
            "independentTimestampsAllowed": False,
            "beatOrBpmEditsAllowed": False,
            "confidenceFieldsDiagnosticOnly": True,
            "trackSummaryDerivedNotGate": True,
            "repeatedSimilarDropsAllowed": True,
            "outputFormat": "json_object_only",
        },
        "integrity": {
            "packetSha256": "0" * 64,
            "sourceMapSha256": p["sourceMapSha256"],
            "instructionSha256": builder.sha256_bytes(builder.INSTRUCTION.encode()),
            "v3SourceInstructionSha256": builder.sha256_bytes(builder.V3_INSTRUCTION.encode()),
            "analyzerRunnerSha256": p["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": p["source"]["analysisJsonSha256"],
            "developmentRevision": builder.DEVELOPMENT_REVISION,
        },
    }


class V5ContractTests(unittest.TestCase):
    def test_single_absolute_drop_valid(self):
        norm, errors = validator.validate_and_normalize(packet(), proposal())
        self.assertEqual(errors, [])
        self.assertEqual(norm["trackSummary"]["dropPresence"], "drop_present")
        self.assertEqual(norm["trackSummary"]["dropCount"], 1)

    def test_repeated_similar_drops_are_explicitly_valid(self):
        assessments = [assessment(1, repetition="repeated_similar"), assessment(3, repetition="repeated_similar")]
        events = [event(1), event(3)]
        norm, errors = validator.validate_and_normalize(packet(), proposal(assessments=assessments, events=events))
        self.assertEqual(errors, [])
        self.assertEqual(norm["trackSummary"]["dropCount"], 2)
        self.assertEqual([a["semanticRole"] for a in norm["candidateAssessments"]], ["drop", "drop"])

    def test_ordinary_repeated_transition_does_not_become_drop_by_repetition(self):
        a = assessment(1, role="ordinary_transition", repetition="repeated_similar", preparation="weak", impact="clear", sustained="clear")
        norm, errors = validator.validate_and_normalize(packet(), proposal(assessments=[a], events=[]))
        self.assertEqual(errors, [])
        self.assertEqual(norm["trackSummary"]["dropPresence"], "no_drop")

    def test_drop_requires_all_three_pattern_components_clear(self):
        for field in ("preparation", "impact", "sustained"):
            kwargs = {"preparation": "clear", "impact": "clear", "sustained": "clear"}
            kwargs[field] = "weak"
            q = proposal(assessments=[assessment(1, **kwargs)], events=[event(1)])
            _, errors = validator.validate_and_normalize(packet(), q)
            self.assertTrue(any("drop_requires_clear" in x for x in errors), field)

    def test_ambiguous_only_is_derived_not_gate(self):
        a = assessment(1, role="ambiguous", preparation="clear", impact="unclear", sustained="clear")
        norm, errors = validator.validate_and_normalize(packet(), proposal(assessments=[a], events=[]))
        self.assertEqual(errors, [])
        self.assertEqual(norm["trackSummary"]["dropPresence"], "ambiguous_only")
        self.assertEqual(norm["trackSummary"]["ambiguousCandidateCount"], 1)

    def test_wrong_track_summary_cannot_veto_drop(self):
        q = proposal(presence="no_drop")
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("presence_not_derived" in x for x in errors))

    def test_wrong_derived_counts_rejected(self):
        q = proposal(drop_count=0, ambiguous_count=1)
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("drop_count_not_derived" in x for x in errors))
        self.assertTrue(any("ambiguous_count_not_derived" in x for x in errors))

    def test_drop_assessment_requires_matching_drop_event(self):
        q = proposal(events=[event(1, kind="energy")])
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("missing_drop_event" in x for x in errors))

    def test_drop_event_requires_matching_drop_assessment(self):
        a = assessment(1, role="ordinary_transition", preparation="weak")
        q = proposal(assessments=[a], events=[event(1)])
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("missing_drop_assessment" in x for x in errors))

    def test_duplicate_assessment_anchor_rejected(self):
        q = proposal(assessments=[assessment(1), assessment(1)], events=[event(1)])
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("duplicate_anchor" in x for x in errors))

    def test_out_of_range_and_independent_time_rejected(self):
        q = proposal(assessments=[assessment(99)], events=[event(99)])
        q["events"][0]["time"] = 20.0
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("anchor_index_out_of_range" in x for x in errors))
        self.assertTrue(any("forbidden_timing_key" in x or "unexpected_keys" in x for x in errors))

    def test_confidence_is_not_a_gate(self):
        q = proposal(assessments=[assessment(1, confidence=0.01)], events=[event(1, confidence=0.01)])
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertEqual(errors, [])

    def test_instruction_encodes_v5_scientific_variable(self):
        low = builder.INSTRUCTION.lower()
        self.assertIn("candidate first", low)
        self.assertIn("absolute drop definition", low)
        self.assertIn("repeated or structurally similar transitions may all be drops", low)
        self.assertIn("similarity to another drop-like transition is not negative evidence", low)
        self.assertIn("do not rank candidates against one another", low)
        self.assertIn("tracksummary may summarize but may not veto", low)
        self.assertIn("diagnostic only", low)
        self.assertNotIn("reference_drops", low)
        self.assertNotIn("dropsseconds", low)
        diff = builder.instruction_diff_record()
        self.assertEqual(diff["retuningVariable"], "candidate-first-absolute-drop-pattern-with-repeated-drop-permission")
        self.assertTrue(diff["labelInformedDevelopmentRevision"])
        self.assertFalse(diff["terminalHoldoutUsed"])

    def test_adapter_strict_schema_matches_contract(self):
        schema = adapter.proposal_json_schema(request())
        self.assertEqual(schema["required"], ["schema", "source", "candidateAssessments", "trackSummary", "events"])
        self.assertEqual(schema["properties"]["candidateAssessments"]["items"]["properties"]["anchor"]["properties"]["index"]["maximum"], 3)
        self.assertEqual(schema["properties"]["candidateAssessments"]["items"]["properties"]["semanticRole"]["enum"], builder.SEMANTIC_ROLES)

    def test_adapter_provider_input_excludes_labels_and_source_map_content(self):
        payload = adapter.build_api_payload(request(), "gpt-6-sol", "high", 8192)
        provider_input = json.loads(payload["input"])
        encoded = json.dumps(provider_input).lower()
        for token in ('"aliases"', '"aliascolumns"', '"dropsseconds"', "reference_drops", '"diagnosticlabelhint"'):
            self.assertNotIn(token, encoded)
        self.assertEqual(provider_input["packet"]["sourceMapSha256"], "4" * 64)
        self.assertEqual(payload["model"], "gpt-6-sol")
        self.assertEqual(payload["reasoning"], {"effort": "high"})
        self.assertEqual(payload["max_output_tokens"], 8192)
        self.assertFalse(payload["store"])


if __name__ == "__main__":
    unittest.main()

#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEARNED = HERE.parent / "learned-interpretation-v1"
sys.path.insert(0, str(LEARNED))

import build_learned_request_v6 as builder
import openai_responses_adapter_v6 as adapter
import validate_learned_proposal_v3 as packet_validator
import validate_learned_proposal_v6 as validator


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
    return {"analyzerRunnerSha256": p["source"]["analyzerRunnerSha256"], "analysisJsonSha256": p["source"]["analysisJsonSha256"]}


def assessment(index=1, role="drop", repetition="independent", confidence=0.5,
               preparation="clear", impact="clear", sustained="clear", ordinary="ruled_out"):
    return {
        "anchor": {"type": "evidence", "index": index},
        "semanticRole": role,
        "preparation": preparation,
        "decisiveImpact": impact,
        "sustainedStrongerPassage": sustained,
        "ordinaryReturnAlternative": ordinary,
        "repetitionRelation": repetition,
        "semanticConfidence": confidence,
        "rationale": "Candidate judged for decisive impact and against the ordinary-return alternative.",
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
            "candidateAssessmentKeys": ["anchor", "semanticRole", "preparation", "decisiveImpact", "sustainedStrongerPassage", "ordinaryReturnAlternative", "repetitionRelation", "semanticConfidence", "rationale"],
            "allowedSemanticRoles": builder.SEMANTIC_ROLES,
            "allowedPatternStates": builder.PATTERN_STATES,
            "allowedOrdinaryReturnAlternatives": builder.ORDINARY_RETURN_STATES,
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
            "analyzerDescriptorsNotSemanticGates": True,
            "trackSummaryDerivedNotGate": True,
            "repeatedSimilarDropsAllowed": True,
            "decisiveImpactRequiredForDrop": True,
            "ordinaryReturnMustBeRuledOutForDrop": True,
            "priorModelAgreementNotProviderInput": True,
            "proposalCountNotSemanticCriterion": True,
            "outputFormat": "json_object_only",
        },
        "integrity": {
            "packetSha256": "0" * 64,
            "sourceMapSha256": p["sourceMapSha256"],
            "instructionSha256": builder.sha256_bytes(builder.INSTRUCTION.encode()),
            "v5SourceInstructionSha256": builder.sha256_bytes(builder.V5_INSTRUCTION.encode()),
            "analyzerRunnerSha256": p["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": p["source"]["analysisJsonSha256"],
            "developmentRevision": builder.DEVELOPMENT_REVISION,
        },
    }


class V6ContractTests(unittest.TestCase):
    def test_decisive_impact_drop_valid(self):
        norm, errors = validator.validate_and_normalize(packet(), proposal())
        self.assertEqual(errors, [])
        self.assertEqual(norm["trackSummary"]["dropPresence"], "drop_present")

    def test_repeated_similar_qualifying_drops_remain_valid(self):
        aa = [assessment(1, repetition="repeated_similar"), assessment(3, repetition="repeated_similar")]
        ee = [event(1), event(3)]
        norm, errors = validator.validate_and_normalize(packet(), proposal(assessments=aa, events=ee))
        self.assertEqual(errors, [])
        self.assertEqual(norm["trackSummary"]["dropCount"], 2)

    def test_drop_requires_clear_decisive_impact(self):
        q = proposal(assessments=[assessment(impact="weak")], events=[event()])
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("drop_requires_clear_decisiveImpact" in x for x in errors))

    def test_drop_requires_preparation_and_sustained_passage(self):
        for field in ("preparation", "sustained"):
            kw = {"preparation": "clear", "sustained": "clear"}
            kw[field] = "weak"
            q = proposal(assessments=[assessment(**kw)], events=[event()])
            _, errors = validator.validate_and_normalize(packet(), q)
            self.assertTrue(any("drop_requires_clear" in x for x in errors), field)

    def test_drop_requires_ordinary_return_ruled_out(self):
        for value in ("plausible", "unclear"):
            q = proposal(assessments=[assessment(ordinary=value)], events=[event()])
            _, errors = validator.validate_and_normalize(packet(), q)
            self.assertTrue(any("ordinary_return_ruled_out" in x for x in errors), value)

    def test_ordinary_return_can_be_high_confidence_without_becoming_drop(self):
        a = assessment(role="ordinary_transition", confidence=0.99, impact="weak", ordinary="plausible")
        norm, errors = validator.validate_and_normalize(packet(), proposal(assessments=[a], events=[]))
        self.assertEqual(errors, [])
        self.assertEqual(norm["trackSummary"]["dropPresence"], "no_drop")

    def test_high_confidence_cannot_rescue_weak_drop_semantics(self):
        q = proposal(assessments=[assessment(confidence=0.99, impact="weak")], events=[event(confidence=0.99)])
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("drop_requires_clear_decisiveImpact" in x for x in errors))

    def test_low_confidence_is_not_a_gate_when_semantics_qualify(self):
        q = proposal(assessments=[assessment(confidence=0.01)], events=[event(confidence=0.01)])
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertEqual(errors, [])

    def test_ambiguous_when_ordinary_return_cannot_be_resolved(self):
        a = assessment(role="ambiguous", impact="clear", ordinary="unclear")
        norm, errors = validator.validate_and_normalize(packet(), proposal(assessments=[a], events=[]))
        self.assertEqual(errors, [])
        self.assertEqual(norm["trackSummary"]["dropPresence"], "ambiguous_only")

    def test_summary_is_derived_not_gate(self):
        q = proposal(presence="no_drop")
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("presence_not_derived" in x for x in errors))

    def test_matching_drop_event_required(self):
        q = proposal(events=[event(kind="energy")])
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("missing_drop_event" in x for x in errors))

    def test_independent_timestamp_rejected(self):
        q = proposal()
        q["events"][0]["time"] = 20.0
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("forbidden_timing_key" in x or "unexpected_keys" in x for x in errors))

    def test_instruction_encodes_v6_variable_and_nonvariables(self):
        low = builder.INSTRUCTION.lower()
        self.assertIn("decisive impact onset", low)
        self.assertIn("ordinaryreturnalternative", low)
        self.assertIn("ordinary-return explanation remains plausible", low)
        self.assertIn("repeated or structurally similar transitions may all be drops", low)
        self.assertIn("proposal count is not a semantic criterion", low)
        self.assertIn("do not use agreement with any prior model/version as evidence", low)
        self.assertIn("analyzer priority, salience, confidence", low)
        self.assertNotIn("reference_drops", low)
        self.assertNotIn("dropsseconds", low)
        diff = builder.instruction_diff_record()
        self.assertEqual(diff["retuningVariable"], "decisive-impact-plus-ordinary-return-counterfactual")
        self.assertTrue(diff["labelInformedDevelopmentRevision"])
        self.assertFalse(diff["terminalHoldoutUsed"])

    def test_adapter_strict_schema_matches_contract(self):
        schema = adapter.proposal_json_schema(request())
        props = schema["properties"]["candidateAssessments"]["items"]["properties"]
        self.assertIn("decisiveImpact", props)
        self.assertIn("ordinaryReturnAlternative", props)
        self.assertEqual(props["ordinaryReturnAlternative"]["enum"], builder.ORDINARY_RETURN_STATES)

    def test_adapter_provider_input_excludes_labels_source_map_and_prior_model_outputs(self):
        payload = adapter.build_api_payload(request(), "gpt-6-sol", "high", 8192)
        provider_input = json.loads(payload["input"])
        encoded = json.dumps(provider_input).lower()
        for token in ('"aliases"', '"aliascolumns"', '"dropsseconds"', "reference_drops", '"diagnosticlabelhint"', 'v3proposal', 'v5proposal'):
            self.assertNotIn(token, encoded)
        self.assertEqual(payload["model"], "gpt-6-sol")
        self.assertEqual(payload["reasoning"], {"effort": "high"})
        self.assertEqual(payload["max_output_tokens"], 8192)
        self.assertFalse(payload["store"])


if __name__ == "__main__":
    unittest.main()

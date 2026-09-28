#!/usr/bin/env python3
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
LEARNED = HERE.parent / "learned-interpretation-v1"
sys.path.insert(0, str(LEARNED))

import build_learned_request_v2 as v2_builder
import build_learned_request_v3 as v3_builder
import openai_responses_adapter_v3 as adapter
import validate_learned_proposal_v3 as validator


def packet():
    return {
        "schema": "trackcade-structure-evidence-v2",
        "policy": "current-core-accent-table-v2",
        "encoding": "table",
        "source": {
            "analysisJsonSha256": "1" * 64,
            "analyzerRelease": "v0.19",
            "analyzerRunnerSha256": validator.ANALYZER_RUNNER_SHA256,
            "analyzerSourceCommit": validator.ANALYZER_SOURCE_COMMIT,
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
            "instruction": "Anchor time is deterministic. Priority, salience and confidence are Analyzer features, not Drop probability or gameplay authorization. No provider request or compiler policy is defined here.",
            "timingAuthority": "frozen-analyzer-derived-anchor-only",
            "usage": "offline-evidence-research-only",
        },
    }


def proposal(index=1):
    p = packet()
    return {
        "schema": "trackcade-musical-interpretation-v2",
        "source": {
            "analyzerRunnerSha256": p["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": p["source"]["analysisJsonSha256"],
        },
        "events": [{
            "kind": "drop",
            "semanticConfidence": 0.93,
            "anchor": {"type": "evidence", "index": index},
            "name": "Drop",
            "rationale": "Clear preparation and release in supplied evidence.",
        }],
    }


class V3ContractTests(unittest.TestCase):
    def test_packet_and_proposal_valid(self):
        norm, errors = validator.validate_and_normalize(packet(), proposal())
        self.assertEqual(errors, [])
        self.assertEqual(norm["events"][0]["anchor"], {"type": "evidence", "index": 1})

    def test_out_of_range_anchor_rejected(self):
        _, errors = validator.validate_and_normalize(packet(), proposal(99))
        self.assertTrue(any("anchor_index_out_of_range" in x for x in errors))

    def test_independent_timestamp_rejected(self):
        q = proposal()
        q["events"][0]["time"] = 20.0
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("forbidden_timing_key" in x or "unexpected_keys" in x for x in errors))

    def test_wrong_anchor_type_rejected(self):
        q = proposal()
        q["events"][0]["anchor"]["type"] = "landmark"
        _, errors = validator.validate_and_normalize(packet(), q)
        self.assertTrue(any("anchor_type_invalid" in x for x in errors))

    def test_packet_tamper_rejected(self):
        p = packet()
        p["anchors"][1][0] = -1
        self.assertTrue(validator.validate_packet(p))

    def test_instruction_is_mechanical_v2_adaptation(self):
        self.assertNotEqual(v2_builder.INSTRUCTION, v3_builder.INSTRUCTION)
        diff = v3_builder.instruction_diff_record()
        self.assertFalse(diff["semanticRetuningPerformed"])
        self.assertEqual(len(diff["adaptations"]), 4)
        self.assertIn('{"type":"evidence","index":N}', v3_builder.INSTRUCTION)
        self.assertIn("not Drop probability", v3_builder.INSTRUCTION)

    def test_adapter_provider_input_excludes_source_map_contents(self):
        p = packet()
        request = {
            "schema": v3_builder.REQUEST_SCHEMA,
            "instruction": v3_builder.INSTRUCTION,
            "packet": p,
            "responseContract": {
                "schema": v3_builder.PROPOSAL_SCHEMA,
                "topLevelKeys": ["schema", "source", "events"],
                "sourceKeys": ["analyzerRunnerSha256", "analysisJsonSha256"],
                "allowedKinds": ["section", "energy", "peak", "drop"],
                "allowedAnchorTypes": ["evidence"],
                "maxEvents": 64,
                "independentTimestampsAllowed": False,
                "beatOrBpmEditsAllowed": False,
                "outputFormat": "json_object_only",
            },
            "integrity": {
                "packetSha256": "0" * 64,
                "sourceMapSha256": p["sourceMapSha256"],
                "instructionSha256": v3_builder.sha256_bytes(v3_builder.INSTRUCTION.encode()),
                "v2SourceInstructionSha256": v3_builder.sha256_bytes(v2_builder.INSTRUCTION.encode()),
                "analyzerRunnerSha256": p["source"]["analyzerRunnerSha256"],
                "analysisJsonSha256": p["source"]["analysisJsonSha256"],
                "developmentRevision": v3_builder.DEVELOPMENT_REVISION,
            },
        }
        payload = adapter.build_api_payload(request, "gpt-6-sol", "high", 4096)
        provider_input = json.loads(payload["input"])
        encoded = json.dumps(provider_input).lower()
        self.assertNotIn('"aliases"', encoded)
        self.assertNotIn('"aliascolumns"', encoded)
        self.assertEqual(provider_input["packet"]["sourceMapSha256"], "4" * 64)

    def test_builder_never_mentions_reference_labels(self):
        low = v3_builder.INSTRUCTION.lower()
        self.assertNotIn("reference_drops", low)
        self.assertNotIn("dropsseconds", low)


if __name__ == "__main__":
    unittest.main()

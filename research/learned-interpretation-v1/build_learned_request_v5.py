#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from build_learned_request_v3 import INSTRUCTION as V3_INSTRUCTION
from validate_learned_proposal_v3 import load_json_strict, validate_packet

REQUEST_SCHEMA = "trackcade-learned-interpretation-request-v4"
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v4"
DEVELOPMENT_REVISION = "stage1-drop-semantics-v5-candidate-first-absolute-pattern"
MAX_EVENTS = 64
MAX_ASSESSMENTS = 64
PATTERN_STATES = ["clear", "weak", "absent", "unclear"]
SEMANTIC_ROLES = ["drop", "ordinary_transition", "ambiguous"]
REPETITION_RELATIONS = ["independent", "repeated_similar", "unclear"]
DERIVED_PRESENCE = ["drop_present", "no_drop", "ambiguous_only"]


def _v5_instruction() -> str:
    text = V3_INSTRUCTION
    replacements = (
        (
            "2. The JSON schema must be trackcade-musical-interpretation-v2.",
            "2. The JSON schema must be trackcade-musical-interpretation-v4.",
        ),
        (
            "7. semanticConfidence must be a calibrated number from 0 to 1. Prefer omission over unsupported certainty.",
            "7. semanticConfidence must be a number from 0 to 1 used only to describe uncertainty after semantic reasoning. It is diagnostic, not an acceptance threshold or authorization gate. Prefer ambiguity over unsupported certainty.",
        ),
        (
            "- Treat semanticConfidence >= 0.92 for drop as reserved for clear packet-supported preparation -> impact/release -> sustained stronger-passage evidence. Values 0.85-0.91 indicate substantial remaining ambiguity. Speculative lower-confidence drops should usually be omitted rather than emitted.",
            "- No semanticConfidence value by itself licenses a drop. Confidence is diagnostic only; the absolute semantic pattern must justify every emitted drop.",
        ),
    )
    for old, new in replacements:
        if text.count(old) != 1:
            raise RuntimeError(f"V3 instruction source mismatch: {old}")
        text = text.replace(old, new)

    marker = "The deterministic compiler will independently decide whether each proposal is safe and sufficiently supported. You should choose meaning and anchors only; the compiler owns final acceptance and final event time."
    addition = """V5 Drop decision procedure — candidate first, absolute semantics:
- First assess plausible drop/re-entry transition anchors individually. Do not make a track-level presence decision before the candidate assessments.
- For each plausible candidate, classify semanticRole as drop, ordinary_transition, or ambiguous using the absolute Drop definition below. candidateAssessments must remain sparse: include plausible drop/re-entry transitions needed for the semantic decision, not every packet anchor.
- A Drop requires one coherent transition with packet-supported (1) preparation/withdrawal/tension, (2) a distinct impact or release, and (3) a sustained stronger passage after that impact/release. Mark preparation, impactRelease, and sustainedStrongerPassage as clear only when the packet supports that role for the same candidate transition.
- semanticRole drop is allowed only when all three required pattern components are clear. If a required component is weak, absent, or unclear, use ordinary_transition or ambiguous instead of drop.
- A chorus entrance, repeated chorus entrance, ordinary section return, generic re-entry after a break, breakdown ending, ordinary verse-to-chorus transition, isolated high-energy peak, large positive energy delta, quiet-to-loud change, high Analyzer salience/priority/confidence, or a strong transition by itself is not sufficient evidence of a Drop.
- Repeated or structurally similar transitions may all be Drops. Similarity to another Drop-like transition is not negative evidence and must never by itself cause abstention or rejection. If two or more repeated_similar candidates each independently satisfy the absolute Drop definition, classify and emit each of them as Drop.
- Repetition does not itself prove a Drop either. A repeated chorus or repeated strong return that does not satisfy the absolute Drop pattern remains ordinary_transition or ambiguous.
- Do not rank candidates against one another and do not require one Drop to be more distinctive or unique than another. Judge every candidate against the same absolute semantic definition.
- Every candidateAssessment with semanticRole drop must correspond one-for-one to an emitted drop event at the same evidence anchor, and every emitted drop event must have one matching drop assessment.
- After all candidate assessments are complete, derive trackSummary from them. trackSummary may summarize but may not veto a candidate already classified drop.
- Set trackSummary.dropPresence to drop_present if one or more candidates are classified drop; otherwise set it to ambiguous_only if one or more candidates are ambiguous; otherwise set it to no_drop.
- trackSummary.dropCount must equal the number of candidates classified drop. trackSummary.ambiguousCandidateCount must equal the number classified ambiguous.
- Do not impose or aim for a fixed number of Drops. Emit every candidate justified by the absolute definition and omit unsupported candidates.
- semanticConfidence is diagnostic only. No numeric value is a deterministic gate.
- Candidate and event anchors never grant timing authority. Event time remains solely the Analyzer-derived packet anchor time. Never invent, adjust, average, or offset a timestamp.

""" + marker
    if text.count(marker) != 1:
        raise RuntimeError("V3 compiler-ownership marker mismatch")
    return text.replace(marker, addition)


INSTRUCTION = _v5_instruction()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def instruction_diff_record() -> dict:
    return {
        "sourceInstructionSha256": sha256_bytes(V3_INSTRUCTION.encode("utf-8")),
        "v5InstructionSha256": sha256_bytes(INSTRUCTION.encode("utf-8")),
        "adaptations": [
            "proposal schema identifier v2 -> v4",
            "replaced track-level presence-first gating with candidate-first assessment",
            "replaced track-relative distinctiveness with an absolute three-part Drop pattern",
            "made repeated_similar qualifying Drops explicitly valid and non-negative evidence",
            "made trackSummary derived from candidate classifications rather than a semantic gate",
            "retained explicit negative examples for generic strong transitions and section returns",
            "retained diagnostic-only confidence semantics and Analyzer-only timing authority",
        ],
        "semanticRetuningPerformed": True,
        "retuningVariable": "candidate-first-absolute-drop-pattern-with-repeated-drop-permission",
        "labelInformedDevelopmentRevision": True,
        "terminalHoldoutUsed": False,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--packet", type=Path, required=True)
    ap.add_argument("--output", type=Path, required=True)
    ap.add_argument("--instruction-diff-output", type=Path)
    args = ap.parse_args()

    packet_bytes = args.packet.read_bytes()
    packet = load_json_strict(args.packet)
    errors = validate_packet(packet)
    if errors:
        raise SystemExit("invalid Structure Evidence v2 packet: " + "; ".join(errors))

    request = {
        "schema": REQUEST_SCHEMA,
        "instruction": INSTRUCTION,
        "packet": packet,
        "responseContract": {
            "schema": PROPOSAL_SCHEMA,
            "topLevelKeys": ["schema", "source", "candidateAssessments", "trackSummary", "events"],
            "sourceKeys": ["analyzerRunnerSha256", "analysisJsonSha256"],
            "candidateAssessmentKeys": [
                "anchor", "semanticRole", "preparation", "impactRelease",
                "sustainedStrongerPassage", "repetitionRelation", "semanticConfidence", "rationale",
            ],
            "allowedSemanticRoles": SEMANTIC_ROLES,
            "allowedPatternStates": PATTERN_STATES,
            "allowedRepetitionRelations": REPETITION_RELATIONS,
            "trackSummaryKeys": ["dropPresence", "dropCount", "ambiguousCandidateCount", "rationale"],
            "allowedDerivedDropPresence": DERIVED_PRESENCE,
            "allowedKinds": ["section", "energy", "peak", "drop"],
            "allowedAnchorTypes": ["evidence"],
            "maxEvents": MAX_EVENTS,
            "maxCandidateAssessments": MAX_ASSESSMENTS,
            "independentTimestampsAllowed": False,
            "beatOrBpmEditsAllowed": False,
            "confidenceFieldsDiagnosticOnly": True,
            "trackSummaryDerivedNotGate": True,
            "repeatedSimilarDropsAllowed": True,
            "outputFormat": "json_object_only",
        },
        "integrity": {
            "packetSha256": sha256_bytes(packet_bytes),
            "sourceMapSha256": packet["sourceMapSha256"],
            "instructionSha256": sha256_bytes(INSTRUCTION.encode("utf-8")),
            "v3SourceInstructionSha256": sha256_bytes(V3_INSTRUCTION.encode("utf-8")),
            "analyzerRunnerSha256": packet["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
            "developmentRevision": DEVELOPMENT_REVISION,
        },
    }

    serialized = json.dumps(request, sort_keys=True).lower()
    forbidden = (
        '"diagnosticlabelhint"',
        '"diagnostictypehint"',
        '"dropsseconds"',
        "reference_drops",
        '"aliases"',
        '"aliascolumns"',
    )
    if any(token in serialized for token in forbidden):
        raise SystemExit("request leaked diagnostic, benchmark, or source-map content")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(request, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if args.instruction_diff_output:
        args.instruction_diff_output.parent.mkdir(parents=True, exist_ok=True)
        args.instruction_diff_output.write_text(
            json.dumps(instruction_diff_record(), indent=2, sort_keys=True) + "\n",
            encoding="utf-8",
        )
    print(json.dumps({
        "schema": REQUEST_SCHEMA,
        "developmentRevision": DEVELOPMENT_REVISION,
        "packetSha256": request["integrity"]["packetSha256"],
        "sourceMapSha256": request["integrity"]["sourceMapSha256"],
        "instructionSha256": request["integrity"]["instructionSha256"],
        "sourceInstructionSha256": request["integrity"]["v3SourceInstructionSha256"],
        "semanticRetuningPerformed": True,
        "labelInformedDevelopmentRevision": True,
        "terminalHoldoutUsed": False,
        "anchors": len(packet["anchors"]),
    }, indent=2))


if __name__ == "__main__":
    main()

#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from build_learned_request_v6 import INSTRUCTION as V6_INSTRUCTION
from validate_learned_proposal_v3 import load_json_strict, validate_packet

REQUEST_SCHEMA = "trackcade-learned-interpretation-request-v6"
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v6"
DEVELOPMENT_REVISION = "stage1-drop-semantics-v7-orthogonal-structural-context"
MAX_EVENTS = 64
MAX_ASSESSMENTS = 64
PATTERN_STATES = ["clear", "weak", "absent", "unclear"]
STRUCTURAL_CONTEXTS = [
    "chorus_or_section_entrance",
    "section_return",
    "generic_reentry",
    "breakdown_ending",
    "other_transition",
    "none_identified",
    "unclear",
]
SEMANTIC_ROLES = ["drop", "ordinary_transition", "ambiguous"]
REPETITION_RELATIONS = ["independent", "repeated_similar", "unclear"]
DERIVED_PRESENCE = ["drop_present", "no_drop", "ambiguous_only"]

COMPILER_MARKER = "The deterministic compiler will independently decide whether each proposal is safe and sufficiently supported. You should choose meaning and anchors only; the compiler owns final acceptance and final event time."
V6_START = "V6 Drop decision procedure — candidate first, decisive impact, ordinary-return counterfactual:"


def _v7_instruction() -> str:
    if V6_INSTRUCTION.count(V6_START) != 1 or V6_INSTRUCTION.count(COMPILER_MARKER) != 1:
        raise RuntimeError("V6 instruction block markers changed")
    before, remainder = V6_INSTRUCTION.split(V6_START, 1)
    _v6_block, after = remainder.split(COMPILER_MARKER, 1)

    old_schema = "2. The JSON schema must be trackcade-musical-interpretation-v5."
    new_schema = "2. The JSON schema must be trackcade-musical-interpretation-v6."
    if before.count(old_schema) != 1:
        raise RuntimeError("V6 schema instruction source mismatch")
    before = before.replace(old_schema, new_schema)

    v7 = """V7 Drop decision procedure — candidate first, impact morphology separated from structural context:
- First assess plausible Drop/re-entry transition anchors individually. Do not make a track-level presence decision before the candidate assessments.
- For each plausible candidate, classify semanticRole as drop, ordinary_transition, or ambiguous. candidateAssessments must remain sparse: include plausible Drop/re-entry transitions needed for the semantic decision, not every packet anchor.
- Judge two independent dimensions at every candidate: (A) local impact morphology and (B) larger-form structural context. Structural context is descriptive and must never by itself authorize or reject a Drop.
- A Drop requires one coherent transition with packet-supported (1) clear preparation/withdrawal/tension before the candidate, (2) a clear decisive impact onset at the candidate itself, and (3) a clear sustained stronger passage after that impact.
- `decisiveImpact` requires a concentrated, locally distinct onset/impact/release point supported by the packet around that same anchor. A generic release from a quiet passage, a gradual energy rise, the unmarked beginning of a stronger section, a section boundary, or a return to previously heard energy is not by itself a decisive impact.
- Set `structuralContext` independently to one of chorus_or_section_entrance, section_return, generic_reentry, breakdown_ending, other_transition, none_identified, or unclear.
- A qualifying Drop may have ANY structuralContext value. A chorus entrance, section return, generic re-entry, or breakdown ending can also be a Drop when the local impact morphology independently satisfies all three Drop conditions.
- Conversely, identifying a chorus entrance, section return, generic re-entry, breakdown ending, or other strong structural transition never proves a Drop. If preparation, decisiveImpact, or sustainedStrongerPassage is weak, absent, or unclear, do not classify the candidate as Drop.
- In particular, `decisiveImpact=unclear` is not sufficient for Drop. Do not carry the post-hoc V6 diagnostic relaxation into V7.
- semanticRole drop is allowed only when preparation, decisiveImpact, and sustainedStrongerPassage are all clear. structuralContext is never a fourth gate.
- Analyzer priority, salience, confidence, source type, or a large local energy value may help describe evidence but can never by themselves satisfy preparation, decisiveImpact, sustainedStrongerPassage, or authorize a Drop. semanticConfidence is likewise diagnostic only and never an acceptance threshold.
- Repeated or structurally similar transitions may all be Drops. Similarity to another Drop-like transition is not negative evidence and must never by itself cause abstention or rejection. If two or more repeated_similar candidates each independently satisfy the V7 Drop definition, classify and emit each of them as Drop.
- Repetition does not itself prove a Drop. A repeated chorus or repeated strong return remains ordinary_transition or ambiguous unless that candidate independently satisfies every V7 impact-morphology condition.
- Do not rank candidates against one another and do not require one Drop to be more distinctive or unique than another. Judge every candidate against the same V7 definition.
- Do not impose or aim for a fixed number of Drops. Proposal count is not a semantic criterion.
- Do not use agreement with any prior model/version as evidence. The provider input contains only the frozen packet and this contract.
- Every candidateAssessment with semanticRole drop must correspond one-for-one to an emitted drop event at the same evidence anchor, and every emitted drop event must have one matching drop assessment.
- After all candidate assessments are complete, derive trackSummary from them. trackSummary may summarize but may not veto a candidate already classified drop.
- Set trackSummary.dropPresence to drop_present if one or more candidates are classified drop; otherwise set it to ambiguous_only if one or more candidates are ambiguous; otherwise set it to no_drop.
- trackSummary.dropCount must equal the number of candidates classified drop. trackSummary.ambiguousCandidateCount must equal the number classified ambiguous.
- Candidate and event anchors never grant timing authority. Event time remains solely the Analyzer-derived packet anchor time. Never invent, adjust, average, or offset a timestamp.

"""
    return before + v7 + COMPILER_MARKER + after


INSTRUCTION = _v7_instruction()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def instruction_diff_record() -> dict:
    return {
        "sourceInstructionSha256": sha256_bytes(V6_INSTRUCTION.encode("utf-8")),
        "v7InstructionSha256": sha256_bytes(INSTRUCTION.encode("utf-8")),
        "adaptations": [
            "proposal schema identifier v5 -> v6",
            "removed ordinaryReturnAlternative as a Drop veto",
            "added orthogonal descriptive structuralContext annotation",
            "allowed qualifying Drops to coexist with chorus/section entrance, section return, generic re-entry, or breakdown ending context",
            "retained clear preparation, clear decisiveImpact, and clear sustainedStrongerPassage as mandatory Drop morphology",
            "explicitly kept decisiveImpact=unclear insufficient for Drop despite post-hoc development diagnostic",
            "retained candidate-first architecture and repeated-similar Drop permission",
            "retained prohibitions on confidence/salience/priority/model-agreement/count gates",
            "retained Analyzer-only timing authority and derived track summary",
        ],
        "semanticRetuningPerformed": True,
        "retuningVariable": "orthogonalize-structural-context-from-drop-impact-morphology",
        "labelInformedDevelopmentRevision": True,
        "developmentBasis": "frozen V6 Stage1 RAW development result and post-hoc gate-collapse diagnostic",
        "terminalHoldoutUsed": False,
        "existingTerminalPhysicallyUnseenClaimAllowed": False,
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
                "anchor", "semanticRole", "preparation", "decisiveImpact",
                "sustainedStrongerPassage", "structuralContext",
                "repetitionRelation", "semanticConfidence", "rationale",
            ],
            "allowedSemanticRoles": SEMANTIC_ROLES,
            "allowedPatternStates": PATTERN_STATES,
            "allowedStructuralContexts": STRUCTURAL_CONTEXTS,
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
            "analyzerDescriptorsNotSemanticGates": True,
            "trackSummaryDerivedNotGate": True,
            "repeatedSimilarDropsAllowed": True,
            "decisiveImpactRequiredForDrop": True,
            "structuralContextOrthogonalNotGate": True,
            "decisiveImpactUnclearInsufficientForDrop": True,
            "priorModelAgreementNotProviderInput": True,
            "proposalCountNotSemanticCriterion": True,
            "outputFormat": "json_object_only",
        },
        "integrity": {
            "packetSha256": sha256_bytes(packet_bytes),
            "sourceMapSha256": packet["sourceMapSha256"],
            "instructionSha256": sha256_bytes(INSTRUCTION.encode("utf-8")),
            "v6SourceInstructionSha256": sha256_bytes(V6_INSTRUCTION.encode("utf-8")),
            "analyzerRunnerSha256": packet["source"]["analyzerRunnerSha256"],
            "analysisJsonSha256": packet["source"]["analysisJsonSha256"],
            "developmentRevision": DEVELOPMENT_REVISION,
        },
    }

    serialized = json.dumps(request, sort_keys=True).lower()
    forbidden = (
        '"diagnosticlabelhint"', '"diagnostictypehint"', '"dropsseconds"',
        "reference_drops", '"aliases"', '"aliascolumns"',
        '"v3proposal"', '"v5proposal"', '"v6proposal"', '"terminal"',
    )
    if any(token in serialized for token in forbidden):
        raise SystemExit("request leaked diagnostic, benchmark, prior-model, terminal, or source-map content")

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(request, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    if args.instruction_diff_output:
        args.instruction_diff_output.parent.mkdir(parents=True, exist_ok=True)
        args.instruction_diff_output.write_text(json.dumps(instruction_diff_record(), indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(json.dumps({
        "schema": REQUEST_SCHEMA,
        "developmentRevision": DEVELOPMENT_REVISION,
        "packetSha256": request["integrity"]["packetSha256"],
        "sourceMapSha256": request["integrity"]["sourceMapSha256"],
        "instructionSha256": request["integrity"]["instructionSha256"],
        "sourceInstructionSha256": request["integrity"]["v6SourceInstructionSha256"],
        "semanticRetuningPerformed": True,
        "labelInformedDevelopmentRevision": True,
        "terminalHoldoutUsed": False,
        "anchors": len(packet["anchors"]),
    }, indent=2))


if __name__ == "__main__":
    main()

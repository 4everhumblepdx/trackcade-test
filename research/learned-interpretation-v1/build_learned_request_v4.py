#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from build_learned_request_v3 import INSTRUCTION as V3_INSTRUCTION
from validate_learned_proposal_v3 import load_json_strict, validate_packet

REQUEST_SCHEMA = "trackcade-learned-interpretation-request-v3"
PROPOSAL_SCHEMA = "trackcade-musical-interpretation-v3"
DEVELOPMENT_REVISION = "stage1-drop-semantics-v4-presence-relative-distinctiveness"
MAX_EVENTS = 64
MAX_COMPARISONS = 64


def _v4_instruction() -> str:
    text = V3_INSTRUCTION
    replacements = (
        (
            "2. The JSON schema must be trackcade-musical-interpretation-v2.",
            "2. The JSON schema must be trackcade-musical-interpretation-v3.",
        ),
        (
            "7. semanticConfidence must be a calibrated number from 0 to 1. Prefer omission over unsupported certainty.",
            "7. semanticConfidence must be a number from 0 to 1 used only to describe uncertainty after semantic reasoning. It is diagnostic, not an acceptance threshold or authorization gate. Prefer omission over unsupported certainty.",
        ),
        (
            "- Treat semanticConfidence >= 0.92 for drop as reserved for clear packet-supported preparation -> impact/release -> sustained stronger-passage evidence. Values 0.85-0.91 indicate substantial remaining ambiguity. Speculative lower-confidence drops should usually be omitted rather than emitted.",
            "- No semanticConfidence value by itself licenses a drop. Confidence is diagnostic only; the presence decision and track-relative comparison must justify every emitted drop.",
        ),
    )
    for old, new in replacements:
        if text.count(old) != 1:
            raise RuntimeError(f"V3 instruction source mismatch: {old}")
        text = text.replace(old, new)

    marker = "The deterministic compiler will independently decide whether each proposal is safe and sufficiently supported. You should choose meaning and anchors only; the compiler owns final acceptance and final event time."
    addition = """V4 Drop decision procedure:
- Before selecting any drop anchor, make exactly one track-level dropPresence decision: drop_present, no_drop, or insufficient_semantic_evidence.
- no_drop is a successful semantic conclusion. insufficient_semantic_evidence is also a successful abstention. Neither is a provider failure.
- A chorus entrance, repeated chorus entrance, ordinary section return, generic re-entry after a break, breakdown ending, ordinary verse-to-chorus transition, isolated high-energy peak, large positive energy delta, quiet-to-loud change, high Analyzer salience/priority/confidence, or repeated low-to-high geometry is not by itself sufficient evidence of a drop.
- If dropPresence is drop_present, compare plausible drop/re-entry transitions against other strong transitions in the same track. Do not ask only whether a candidate exhibits preparation -> release -> stronger passage; ask what makes it more drop-like than the track's other major transitions.
- candidateComparisons must be sparse: include only plausible drop/re-entry transitions needed to justify the decision, not every packet anchor.
- candidateComparisons.role may be selected_drop, ordinary_transition, or ambiguous. Use selected_drop only for anchors emitted as drop events. Every selected_drop row and emitted drop event must correspond one-for-one at the same evidence anchor.
- If multiple transitions have substantially interchangeable structural geometry and the packet cannot establish a distinct payoff/release role, classify them ordinary_transition or ambiguous and abstain from drop output at those anchors.
- Do not impose or aim for a fixed number of drops. Emit only semantically justified drops.
- If dropPresence is drop_present but no selectable evidence anchor can be justified, use localizationStatus no_selectable_anchor and emit no drop event.
- For no_drop or insufficient_semantic_evidence, use localizationStatus not_applicable and emit no drop event.
- presenceConfidence, candidate distinctiveness, and semanticConfidence are diagnostic only. No numeric value is a deterministic gate.
- The track-level presence/localization decision never grants timing authority. Event time remains solely the Analyzer-derived packet anchor time.

""" + marker
    if text.count(marker) != 1:
        raise RuntimeError("V3 compiler-ownership marker mismatch")
    return text.replace(marker, addition)


INSTRUCTION = _v4_instruction()


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def instruction_diff_record() -> dict:
    return {
        "sourceInstructionSha256": sha256_bytes(V3_INSTRUCTION.encode("utf-8")),
        "v4InstructionSha256": sha256_bytes(INSTRUCTION.encode("utf-8")),
        "adaptations": [
            "proposal schema identifier v2 -> v3",
            "added explicit track-level dropPresence and localizationStatus decision",
            "added sparse track-relative candidate comparison requirement",
            "added successful no_drop and insufficient_semantic_evidence abstention states",
            "added one-for-one selected_drop comparison and emitted Drop correspondence",
            "replaced numeric confidence-band guidance with diagnostic-only confidence semantics",
        ],
        "semanticRetuningPerformed": True,
        "retuningVariable": "drop-presence-and-track-relative-distinctiveness",
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
            "topLevelKeys": ["schema", "source", "trackSemanticDecision", "candidateComparisons", "events"],
            "sourceKeys": ["analyzerRunnerSha256", "analysisJsonSha256"],
            "trackSemanticDecisionKeys": ["dropPresence", "presenceConfidence", "localizationStatus", "rationale"],
            "allowedDropPresence": ["drop_present", "no_drop", "insufficient_semantic_evidence"],
            "allowedLocalizationStatus": ["localized", "no_selectable_anchor", "not_applicable"],
            "candidateComparisonKeys": ["anchor", "role", "distinctiveness", "rationale"],
            "allowedComparisonRoles": ["selected_drop", "ordinary_transition", "ambiguous"],
            "allowedKinds": ["section", "energy", "peak", "drop"],
            "allowedAnchorTypes": ["evidence"],
            "maxEvents": MAX_EVENTS,
            "maxCandidateComparisons": MAX_COMPARISONS,
            "independentTimestampsAllowed": False,
            "beatOrBpmEditsAllowed": False,
            "confidenceFieldsDiagnosticOnly": True,
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
        "anchors": len(packet["anchors"]),
    }, indent=2))


if __name__ == "__main__":
    main()
